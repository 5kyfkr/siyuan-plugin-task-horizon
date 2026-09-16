'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const support = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/48-render-calendar-support-runtime.js'), 'utf8');
function between(text, start, end) {
    const a = text.indexOf(start), b = text.indexOf(end, a + start.length);
    assert.ok(a >= 0 && b > a, start);
    return text.slice(a, b);
}
async function run() {
    const scheduled = new Map(); let timerId = 0;
    const context = vm.createContext({
        console, Date, Map, Set, Promise, window: {}, state: { calendarSourceRefetchInFlight: { main: 0, side: 0 } },
        setTimeout(fn) { scheduled.set(++timerId, fn); return timerId; },
        clearTimeout(id) { scheduled.delete(id); },
        normalizeScheduleRepeatType: v => v || 'none',
        normalizeScheduleCompletedOccurrenceKey: v => String(v || ''),
        HTMLInputElement: class {},
        applyTaskDoneVisual() {}, getSettings: () => ({ showCompletedAllDaySchedules: true }),
        __tmGetCalendarFlatTaskByIdSync: () => null,
        __tmIsCalendarTaskDoneSync: task => task.done === true,
    });
    vm.runInContext(fs.readFileSync(path.join(root, 'src/calendar/calendar-date.js'), 'utf8'), context);
    vm.runInContext(fs.readFileSync(path.join(root, 'src/calendar/calendar-store.js'), 'utf8'), context);
    vm.runInContext(between(source, '    function toMs(', '    function parseRgbFunctionToRgb(')
        + between(source, '    function __tmSetCalendarEventDatesIfChanged(', '    function __tmApplyScheduleExtendedPropsInPlace(')
        + between(source, '    function __tmReleaseCalendarSourceRefetch(', '    function handleCalendarEventContextMenu(')
        + between(source, '    function __tmScheduleCalendarSourceRefetchRelease(', '    function __tmRefetchCalendarSource(')
        + between(source, '    function isRecurringScheduleEventExt(', '    async function setCalendarReminderOccurrenceDone(')
        + between(source, '    function isRecurringTaskDateReadOnlyOccurrence(', '    function shouldDisableCalendarEventCheckbox(')
        + between(source, '    function shouldHideCompletedAllDayCalendarEvent(', '    function isOtherBlockCalendarEvent('), context);
    let mutations = 0;
    const store = context.__tmCalendarStore.createCalendarStore({ onChange: () => mutations++ });
    const event = store.addEvent({ id: 'date', start: '2026-09-19', end: '2026-09-20', allDay: true });
    mutations = 0;
    assert.equal(context.__tmSetCalendarEventDatesIfChanged(event, '2026-09-19', '2026-09-20', true), false,
        'date-only input and the engine local-noon Date must compare equal');
    assert.equal(mutations, 0, 'unchanged dates must not emit eventsSet');
    assert.equal(context.__tmSetCalendarEventDatesIfChanged(event, '2026-09-20', '2026-09-21', true), true);
    assert.equal(mutations, 1, 'a real date change must still be applied');
    let sourcePatches = 0;
    const input = { id: 'date', start: '2026-09-20', end: '2026-09-21', allDay: true, extendedProps: {} };
    store.setSourceEvents('tasks', [input]);
    Object.assign(context, {
        getCalendarEvents: cal => cal.getEvents(),
        __tmGetCalendarVisibleRange: () => ({ start: new Date(2026, 8, 1), end: new Date(2026, 9, 1) }),
        inferMainCalendarEventSourceViewType: () => 'dayGridMonth',
        __tmBuildTaskDateSourceEvents: async () => [input],
        applyPendingTaskDateEventPatches: events => events,
        getCalendarEventColor: () => '', getCalendarEventInputColor: () => '',
        __tmApplyTaskDateEventProps: () => sourcePatches++,
        callCalendarAdapter: (cal, method, fn) => { cal.batchRendering(fn); return true; },
    });
    vm.runInContext(between(source, '    function __tmRefreshTaskDateSourceInPlace(', '    function __tmRefetchTaskDateSources('), context);
    mutations = 0;
    assert.equal(context.__tmRefreshTaskDateSourceInPlace(store, 'tasks', { calendarKey: 'main' }), true);
    await context.state.calendarTaskDateInPlaceRefreshPromises.main;
    assert.equal(sourcePatches, 0, 'unchanged all-day source records must not patch every task');
    assert.equal(mutations, 0);
    for (const fn of [...scheduled.values()]) fn();
    scheduled.clear();
    context.state.calendar = store;
    for (let i = 0; i < 20; i++) {
        context.__tmBeginCalendarLocalEventMutation(store);
        context.__tmEndCalendarLocalEventMutation('main');
    }
    for (const fn of scheduled.values()) fn();
    assert.equal(context.state.calendarSourceRefetchInFlight.main, 0, 'coalesced release must clear the whole refresh burst');

    vm.runInContext(between(support, '    window.tmIsTaskDone =', '    window.tmUpdateTaskDates ='), context);
    const unrelated = { __tmSource: 'schedule', __tmTaskId: 'other' };
    context.window.__tmCalendarAllTasksCache = { tasks: [{ id: 'other', done: true }] };
    assert.equal(context.resolveCalendarEventDoneState(unrelated), true);
    context.window.__tmCalendarAllTasksCache = null;
    assert.equal(context.resolveCalendarEventDoneState(unrelated), true, 'cache invalidation must not uncheck unrelated completed schedules');
    context.__tmGetCalendarFlatTaskByIdSync = () => ({ id: 'other', done: false });
    assert.equal(context.resolveCalendarEventDoneState(unrelated), false, 'a known uncomplete must override the last snapshot');
    assert.equal(context.window.tmIsTaskDone('missing'), false, 'legacy boolean API must keep its default');

    let advances = 0;
    context.window.tmSetDone = async () => { await Promise.resolve(); advances++; return true; };
    const checkbox = new context.HTMLInputElement(); checkbox.checked = true;
    const click = { type: 'click' };
    const toggle = () => context.handleCalendarEventCheckboxToggle(checkbox, null, null,
        { __tmSource: 'taskdate', __tmTaskId: 'repeat' }, 'repeat', { jsEvent: click });
    await Promise.all([toggle(), toggle()]);
    await toggle();
    assert.equal(advances, 1, 'the same native click must never enqueue a second advance, even after the first finishes');
    await context.handleCalendarEventCheckboxToggle(checkbox, null, null,
        { __tmSource: 'taskdate', __tmTaskId: 'repeat' }, 'repeat', { jsEvent: { type: 'click' } });
    assert.equal(advances, 2, 'a new deliberate click must remain usable');
    const unmount = between(source, '    function unmount(', '    function ');
    assert.ok(unmount.indexOf('state.prototypeEventDocumentClick?.()') < unmount.indexOf('if (state.wrapEl)'),
        'the factory-only mount has no wrapEl but must still remove its document listener');
    console.log('calendar completion/refresh regression tests passed');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
