'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
function segment(start, end) {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, start);
    return source.slice(from, to);
}
const settings = { linkDockTomato: true, showTaskReminders: true };
const renders = [];
let mutationListener;
let projectedDate = '2026-09-20';
let refetches = 0;
const context = vm.createContext({
    Date, Map, Set,
    state: { mounted: true, calendarSourceEventSnapshots: new Map() },
    EVENT_SOURCE_IDS: { mainAux: 'main-aux', sideAux: 'side-aux', mainTaskDate: 'main-date', sideTaskDate: 'side-date' },
    getSettings: () => settings,
    getCalendarAdapter: (calendar) => calendar,
    getCalendarView: (calendar) => calendar.view,
    getCalendarEvents: (calendar) => calendar.getEvents(),
    getCalendarTaskSnapshotById: () => ({ completionTime: projectedDate }),
    normalizeCalendarEngineEventInput: (event) => event,
    queueTaskDateCalendarRender: (calendar) => renders.push(calendar),
    __tmBeginCalendarLocalEventMutation: () => '',
    __tmEndCalendarLocalEventMutation() {},
    __tmCalendarTaskDateEventMatchesTaskIds: () => false,
    buildTaskDateEventFromDateFollowPatch: () => null,
    __tmTaskMutationBus: { subscribe: (listener) => { mutationListener = listener; return () => {}; } },
    buildCalendarTaskMetaLegacyReadKeys: (field, legacy) => ['custom-my-deadline', ...legacy],
    scheduleReminderCalendarRefetch: () => { refetches++; },
    getKernelScheduleRpc: () => null,
    pad2: (value) => String(value).padStart(2, '0'),
    formatDateKey: (date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-'),
    parseDateOnly: (value) => new Date(String(value).slice(0, 10) + 'T00:00:00'),
});
context.window = context;
for (const file of ['calendar-date.js', 'calendar-store.js', 'calendar-engine.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'src/calendar', file), 'utf8'), context);
}
vm.runInContext([
    segment('    function reminderOccurrenceKey(', '    function normalizeCalendarCustomHolidayOverrides('),
    segment('    function __tmGetCalendarVisibleRange(', '    function __tmBuildSingleScheduleEventsForCalendar('),
    segment('    function syncTaskDateEventFromDateFollowPatch(', '    async function __tmPatchTaskDateInCalendar('),
    segment('    function bindCalendarTaskMutationSubscription(', '    function toLocalDateKey('),
    segment('        state.reminderRefreshListener =', "        ['tomato-reminder-updated', 'tomato-reminder-badge-update', 'tm-task-attr-updated', 'task-horizon:task-completed'].forEach"),
].join('\n'), context);

const follow = {
    taskId: 'task', blockId: 'task-block', blockName: '工时登记', enabled: true,
    repeatMode: 'followTaskRepeat', interval: 'once', times: ['16:00'],
    startDate: '2026-09-20', taskCompletionTime: '2026-09-20',
    completedOccurrences: [{ date: '2026-09-20', time: '16:00' }],
};
const manual = { ...follow, taskId: 'manual', blockId: 'manual-block', repeatMode: 'manual' };
const unrelated = { id: 'holiday', title: '我的假日', start: '2026-09-20', allDay: true, extendedProps: { __tmSource: 'cnHoliday' } };
const sources = new Map();
const main = context.__tmCalendarEngine.createCalendarEngine(null, {
    initialDate: '2026-09-20', initialView: 'dayGridMonth',
    eventSources: [
        { id: 'main-aux', events: (info) => sources.get('main-aux')(info),
            transformEvents: (events, info) => context.applyPendingReminderDateEvents(events, info.start, info.end, settings) },
        { id: 'main-date', events: (info) => sources.get('main-date')?.(info) || [] },
    ],
});
const side = context.__tmCalendarEngine.createCalendarEngine(null, {
    initialDate: '2026-09-20', initialView: 'timeGridDay',
    eventSources: [{ id: 'side-aux', events: (info) => sources.get('side-aux')(info) }],
});
context.state.calendar = main;
context.state.sideDay = { calendar: side };
context.state.reminderCache = { list: [follow, manual], loadedAt: Date.now() };
const calendars = [[main, 'main-aux'], [side, 'side-aux']];
for (const [calendar, sourceId] of calendars) {
    const { activeStart, activeEnd } = calendar.view;
    const events = context.buildEventsFromReminders([follow, manual], activeStart, activeEnd, settings);
    for (const event of [...events, unrelated]) calendar.addEvent(event, sourceId);
    context.state.calendarSourceEventSnapshots.set(sourceId, {
        sourceId, startMs: activeStart.getTime(), endMs: activeEnd.getTime(), events: [...events, unrelated], hold: true,
    });
}
const manualCard = main.getEventById('reminder:manual-block:2026-09-20');
const holidayCard = main.getEventById('holiday');
function expectMain(date) {
    const events = main.getEvents().filter((event) => event.extendedProps.__tmReminderTaskId === 'task');
    assert.deepEqual(Array.from(events, (event) => event.id), date ? [`reminder:task-block:${date}`] : []);
    assert.equal(main.getEventById('reminder:manual-block:2026-09-20'), manualCard, 'Independent reminder cards retain their identity');
    assert.equal(main.getEventById('holiday'), holidayCard, 'Unrelated events are never replaced');
    assert.equal(refetches, 0, 'A date edit must not refetch auxiliary or whole-calendar sources');
}
function mutate(date, phase = 'optimistic', opId = 'edit-1', source = 'taskdate-editor-save') {
    if (phase === 'optimistic' || phase === 'rollback') projectedDate = date;
    mutationListener({ type: 'taskPatch', taskId: 'task', patch: { completionTime: date }, phase, opId, source });
}
function attr(date, phase, opId) {
    projectedDate = date;
    context.state.reminderRefreshListener({ type: 'tm-task-attr-updated', detail: {
        taskId: 'task', attrHostId: 'task-block', attrKey: 'custom-my-deadline', value: date, phase, opId,
    } });
}

async function run() {
    assert.ok(context.bindCalendarTaskMutationSubscription());
    mutate('2026-09-18');
    expectMain('2026-09-18'); // Assert before any promise or timer can resolve.
    assert.equal(main.getEventById('reminder:task-block:2026-09-18').extendedProps.__tmReminderDone, false, 'Completion is recomputed for the new occurrence');
    assert.equal(side.getEventById('reminder:task-block:2026-09-20'), null, 'Moving out of the side-day range removes the old card immediately');
    assert.ok(renders.includes(main) && renders.includes(side), 'Both mounted surfaces must be explicitly repainted');
    assert.ok(context.state.calendarSourceEventSnapshots.get('main-aux').events.some((event) => event.id === 'reminder:task-block:2026-09-18'));
    assert.ok(!context.state.calendarSourceEventSnapshots.get('side-aux').events.some((event) => event.extendedProps?.__tmReminderTaskId === 'task'));
    const card = main.getEventById('reminder:task-block:2026-09-18');
    const renderCount = renders.length;
    mutate('2026-09-18', 'commit');
    assert.equal(main.getEventById(card.id), card, 'Commit echoes do not replace the optimistic card');
    assert.equal(renders.length, renderCount, 'Commit echoes do not repaint reminder cards again');

    // Start a real auxiliary-source load but hold its persisted reminder read.
    let resolveOldRead;
    const oldRead = new Promise((resolve) => { resolveOldRead = resolve; });
    sources.set('main-aux', async (info) => context.buildEventsFromReminders(await oldRead, info.start, info.end, settings));
    main.getEventSourceById('main-aux').refetch();
    mutate('2026-09-19', 'optimistic', 'edit-2');
    expectMain('2026-09-19');
    mutate('2026-09-18', 'commit', 'edit-1');
    expectMain('2026-09-19');
    const stale = context.buildEventsFromReminders([follow], main.view.activeStart, main.view.activeEnd, settings);
    assert.equal(stale[0].start, '2026-09-19', 'A stale reminder record must use the latest optimistic task date');
    resolveOldRead([follow, manual]);
    await new Promise(setImmediate);
    assert.ok(main.getEventById('reminder:task-block:2026-09-19'), 'An actual in-flight source load must not restore the old reminder date');
    assert.equal(main.getEventById('reminder:task-block:2026-09-20'), null);
    // Re-capture unaffected identities after the deliberately requested reload.
    const currentManual = main.getEventById('reminder:manual-block:2026-09-20');

    attr('', 'optimistic', 'clear');
    assert.equal(main.getEvents().filter((event) => event.extendedProps.__tmReminderTaskId === 'task').length, 0);
    context.state.reminderCache = { list: null, loadedAt: 0 };
    attr('2026-09-20', 'rollback', 'clear');
    assert.ok(main.getEventById('reminder:task-block:2026-09-20'), 'Rollback restores the cleared card even while the reminder cache is invalidated');
    assert.ok(side.getEventById('reminder:task-block:2026-09-20'), 'Rollback adds the reminder back into the side-day range');
    assert.equal(main.getEventById('reminder:manual-block:2026-09-20'), currentManual);

    projectedDate = '2026-09-17';
    context.syncTaskDateEventFromDateFollowPatch('task', { completionTime: projectedDate });
    assert.ok(main.getEventById('reminder:task-block:2026-09-17'), 'Direct calendar date projection must also move the reminder');
    mutate('2026-09-21', 'optimistic', 'ordinary-edit', 'task-detail');
    assert.ok(main.getEventById('reminder:task-block:2026-09-21'), 'Ordinary task mutations use the same immediate path');
    mutate('2026-09-17', 'rollback', 'ordinary-edit', 'task-detail');
    assert.ok(main.getEventById('reminder:task-block:2026-09-17'));

    let resolveBridge;
    context.__tomatoReminder = { getBlocks: () => new Promise((resolve) => { resolveBridge = resolve; }) };
    const loading = context.loadReminderBlocks();
    attr('2026-09-22', 'optimistic', 'bridge-edit');
    resolveBridge([follow]);
    const cached = await loading;
    assert.equal(cached[0].taskCompletionTime, '2026-09-22', 'A delayed bridge read must not leave an old deadline in the 60-second cache');
    let finishOtherSource;
    sources.set('main-date', () => new Promise((resolve) => { finishOtherSource = resolve; }));
    sources.set('main-aux', (info) => context.buildEventsFromReminders([follow, manual], info.start, info.end, settings));
    main.refetchEvents();
    await new Promise(setImmediate); // Auxiliary events are built, but the combined load is still pending.
    attr('2026-09-23', 'optimistic', 'combined-load-edit');
    finishOtherSource([]);
    await new Promise(setImmediate);
    assert.ok(main.getEventById('reminder:task-block:2026-09-23'), 'An auxiliary result already built before the edit must be projected again when the combined load commits');
    assert.equal(main.getEventById('reminder:task-block:2026-09-22'), null);
    const staleEvents = context.buildEventsFromReminders([follow], main.view.activeStart, main.view.activeEnd, settings);
    const reconcile = () => context.applyPendingReminderDateEvents(staleEvents, main.view.activeStart, main.view.activeEnd, settings);
    context.state.reminderCache.list = [{ ...follow, repeatMode: 'manual' }];
    assert.equal(reconcile()[0].start, '2026-09-20', 'Switching to an independent reminder must retain its own date');
    context.state.reminderCache.list = [{ ...follow, enabled: false }];
    assert.equal(reconcile().length, 0, 'A pending date patch must not revive a disabled reminder');
    context.state.reminderCache.list = [];
    assert.equal(reconcile().length, 0, 'A pending date patch must not revive a deleted reminder');
    assert.equal(refetches, 0);
    console.log('calendar reminder local date update tests passed');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
