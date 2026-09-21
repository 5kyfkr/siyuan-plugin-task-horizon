'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
function between(text, start, end) {
    const a = text.indexOf(start), b = text.indexOf(end, a + start.length);
    assert.ok(a >= 0 && b > a, start);
    return text.slice(a, b);
}
const side = between(source, '        const sideCalendarAdapter =', '\n        try {\n            cal = sideCalendarAdapter.mount');

async function run() {
    const frames = new Map(), timers = new Map(), classes = new Set(), loadingSnapshots = [];
    let nextId = 0, sourceReads = 0, paintedAllDay = [];
    const state = { sideDay: { allDayCollapsed: false }, calendarSourceRefetchInFlight: { main: 0, side: 0 } };
    const context = vm.createContext({
        console, Date, Map, Set, Promise, AbortController, state,
        rootEl: { classList: {
            contains: name => classes.has(name),
            remove: name => classes.delete(name),
            toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
        } },
        requestAnimationFrame: fn => { frames.set(++nextId, fn); return nextId; },
        cancelAnimationFrame: id => frames.delete(id),
        setTimeout: fn => { timers.set(++nextId, fn); return nextId; },
        clearTimeout: id => timers.delete(id),
        getCalendarEvents: cal => cal.getEvents(),
        getCalendarAdapter: cal => cal,
        callCalendarAdapter: (cal, method, ...args) => cal[method](...args),
        EVENT_SOURCE_IDS: { sideTaskDate: 'tm-taskdate-side' },
        sidePrototypeRenderRaf: 0,
        renderSidePrototype: () => { paintedAllDay = Array.from(context.cal.getEvents()).filter(e => e.allDay).map(e => e.id); },
        getSettings: () => ({ showTaskDates: true }),
        __tmGetCalendarVisibleRange: cal => ({ start: cal.view.activeStart, end: cal.view.activeEnd }),
        normalizeCalendarEngineEventInput: input => input,
        applyPendingTaskDateEventPatches: events => events,
    });
    for (const file of ['calendar-date.js', 'calendar-store.js', 'calendar-engine.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, 'src/calendar', file), 'utf8'), context);
    }
    vm.runInContext([
        between(source, '    function __tmDedupeTaskDateEventsInCalendar(', '    function __tmSyncCalendarUiAfterDirectEventMutation('),
        between(source, '    function __tmReleaseCalendarSourceRefetch(', '    function handleCalendarEventContextMenu('),
        between(source, '    function __tmScheduleCalendarSourceRefetchRelease(', '    function __tmRefetchCalendarSource('),
        between(source, '    function __tmRefreshTaskDateSourceInPlace(', '    function __tmRefetchTaskDateSources('),
        between(source, '        const queueSidePrototypeRender =', '        state.sideDay.prototypeRender ='),
        'globalThis.callbacks = {',
        between(side, '            eventsSet:', '            eventClick:'),
        between(side, '            datesSet:', '\n        });'),
        '};',
    ].join('\n'), context);
    const flushFrames = () => {
        while (frames.size) {
            const pending = [...frames.values()]; frames.clear();
            pending.forEach(fn => fn());
        }
    };
    context.cal = context.__tmCalendarEngine.createCalendarEngine(null, {
        ...context.callbacks,
        loading(isLoading) {
            loadingSnapshots.push({
                isLoading,
                sourceOnlyRefresh: state.calendarSourceRefetchInFlight.side > 0,
                viewSwitching: classes.has('tm-cal-view-switching'),
            });
            context.callbacks.loading(isLoading);
        },
        initialView: 'timeGridDay', initialDate: new Date(2026, 8, 21),
        eventSources: [
            { id: 'tm-schedule-side', events: () => {
                sourceReads++;
                return [{ id: 'schedule', start: new Date(2026, 8, 21, 10), end: new Date(2026, 8, 21, 11) }];
            } },
            { id: 'tm-taskdate-side', events: () => { sourceReads++; return []; } },
        ],
    });
    state.sideDay.calendar = context.cal;
    context.cal.render();
    flushFrames();
    assert.deepEqual(paintedAllDay, [], 'cold startup may paint before task cache hydration');
    await new Promise(setImmediate);
    flushFrames();
    assert.ok(loadingSnapshots.some(snapshot => !snapshot.isLoading && snapshot.sourceOnlyRefresh && snapshot.viewSwitching),
        'reproduce eventsSet dedupe marking a local mutation before loading(false)');

    const hydrated = [1, 2, 3].map(id => ({
        id: `taskdate:${id}`, start: '2026-09-21', end: '2026-09-22', allDay: true,
        extendedProps: { __tmSource: 'taskdate', __tmTaskId: String(id) },
    }));
    context.__tmBuildTaskDateSourceEvents = async () => hydrated;
    const readsBeforeWarmRefresh = sourceReads;
    assert.equal(context.__tmRefreshTaskDateSourceInPlace(context.cal, 'tm-taskdate-side', {
        calendarKey: 'side', allowInactiveFullLoad: true,
    }), true);
    await state.calendarTaskDateInPlaceRefreshPromises.side;
    flushFrames();
    assert.equal(context.cal.getEvents().length, 4, 'background hydration must reach the engine store');
    assert.deepEqual(paintedAllDay, hydrated.map(e => e.id), 'late all-day events must repaint without a collapse/expand click');
    assert.equal(classes.has('tm-cal-view-switching'), false, 'loading completion must clear the switching marker despite a local mutation');
    assert.equal(sourceReads, readsBeforeWarmRefresh, 'repainting must not reload schedule or task sources');
    for (const fn of [...timers.values()]) fn();
    assert.equal(state.calendarSourceRefetchInFlight.side, 0, 'the local mutation marker must still be released');

    Object.assign(context, {
        window: { tmQueryCalendarTaskDateEvents: async (start, end, opts) => {
            assert.equal(opts.deferFullLoad, true);
            assert.equal(opts.allowInactiveFullLoad, true);
            return Object.assign([], { __tmTaskDateQueryComplete: false, __tmTaskDateQueryPath: 'side-deferred' });
        } },
        isTimeGridViewType: () => true,
        shouldApplyMonthTaskDateScheduleDedupe: () => false,
        __tmShouldForceFreshCalendarTaskDateQuery: () => false,
        buildEventsFromTaskDates: events => events,
        copyTaskDateQueryMetadata: (events, projected) => projected,
    });
    const taskDateSource = between(source, '    async function __tmBuildTaskDateSourceEvents(', '    function __tmReleaseCalendarSourceRefetch(');
    vm.runInContext(taskDateSource, context);
    const deferred = await context.__tmBuildTaskDateSourceEvents(new Date(2026, 8, 21), new Date(2026, 8, 22),
        { showTaskDates: true }, 'timeGridDay', { calendar: 'side', allowInactiveFullLoad: true });
    assert.equal(deferred.__tmTaskDateQueryComplete, false);
    assert.equal(deferred.__tmTaskDateQueryPath, 'side-deferred');
    assert.doesNotMatch(taskDateSource, /scheduleTaskDateCacheWarm\(/, 'the source must leave warming to the query runtime without an out-of-scope helper call');
    context.cal.destroy();
    console.log('calendar side startup render regression tests passed');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
