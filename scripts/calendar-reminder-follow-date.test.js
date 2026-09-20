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
const timers = [];
const refetches = [];
const loads = [];
const context = vm.createContext({
    Date, Map, Set,
    state: { reminderCacheEpoch: 0 },
    EVENT_SOURCE_IDS: { mainAux: 'main-aux', sideAux: 'side-aux' },
    getSettings: () => settings,
    setTimeout: (callback) => { timers.push(callback); return callback; },
    clearTimeout() {},
    releaseCalendarSourceEventSnapshotHolds() {},
    getReminderCalendarRefetchSuppression: () => null,
    buildCalendarTaskMetaLegacyReadKeys: (field, legacy) => [field === 'completionTime' ? 'custom-my-deadline' : 'custom-start-date', ...legacy],
    getKernelScheduleRpc: () => null,
    pad2: (value) => String(value).padStart(2, '0'),
    formatDateKey: (date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-'),
    parseDateOnly: (value) => new Date(String(value).slice(0, 10) + 'T00:00:00'),
});
context.window = context;
vm.runInContext([
    segment('    function reminderOccurrenceKey(', '    function normalizeCalendarCustomHolidayOverrides('),
    segment('    function scheduleTomatoRefetch(', '    function refreshDockTomatoCalendarData('),
    segment('        state.reminderRefreshListener =', "        ['tomato-reminder-updated', 'tomato-reminder-badge-update', 'tm-task-attr-updated', 'task-horizon:task-completed'].forEach"),
].join('\n'), context);
for (const file of ['calendar-date.js', 'calendar-store.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'src/calendar', file), 'utf8'), context);
}
const from = new Date(2026, 8, 17);
const to = new Date(2026, 8, 24);
let currentDue = '2026-09-20';
const follow = {
    blockId: 'task-block', taskId: 'task', blockName: '工时登记', enabled: true,
    repeatMode: 'followTaskRepeat', interval: 'once', times: ['16:00'],
    startDate: '2026-09-20', taskCompletionTime: '2026-09-18',
};
const dates = (record) => Array.from(context.buildEventsFromReminders([record], from, to, settings), (event) => event.start);
assert.deepEqual(dates(follow), ['2026-09-18'], 'Follow reminders use the current task deadline, not their originally saved date');
assert.deepEqual(dates({ ...follow, repeatMode: 'manual' }), ['2026-09-20'], 'Independent reminders retain their own date');
assert.deepEqual(dates({ ...follow, taskCompletionTime: '' }), [], 'Clearing the deadline must not restore the stale reminder date');
const legacy = { ...follow };
delete legacy.taskCompletionTime;
assert.deepEqual(dates(legacy), ['2026-09-20'], 'Old reminder records without a task date remain readable');
for (const repeatMode of ['follow', 'task']) assert.deepEqual(dates({ ...follow, repeatMode }), ['2026-09-18']);
assert.deepEqual(dates({ ...follow, repeatMode: '', syncTaskDone: true }), ['2026-09-18']);
assert.deepEqual(dates({ ...follow, interval: 'daily', trigger: 'complete', taskRepeatRule: { enabled: true, type: 'daily' }, repeatState: { lastInstanceDue: '2026-09-20' } }), ['2026-09-18'], 'Recurring follow reminders show the current task occurrence only');

const main = context.__tmCalendarStore.createCalendarStore();
const side = context.__tmCalendarStore.createCalendarStore();
context.state.calendar = main;
context.state.sideDay = { calendar: side };
let reads = 0;
context.__tomatoReminder = {
    getBlocks: async () => {
        reads++;
        return [{ ...follow, taskCompletionTime: currentDue }];
    },
};
context.__tmRefetchCalendarSource = (calendar, sourceId) => {
    assert.ok(Array.isArray(context.state.reminderCache.list), 'Fresh reminders must be ready before repainting the auxiliary source');
    refetches.push(sourceId);
    loads.push(context.loadReminderBlocks().then((records) => {
        calendar.setSourceEvents(sourceId, context.buildEventsFromReminders(records, from, to, settings));
    }));
    return true;
};
async function flush() {
    await new Promise(setImmediate);
    while (timers.length) timers.shift()();
    await Promise.all(loads.splice(0));
}
function notify(attrKey, phase = 'commit') {
    context.state.reminderRefreshListener({ type: 'tm-task-attr-updated', detail: { taskId: 'task', attrKey, phase } });
}
async function run() {
    const records = await context.loadReminderBlocks();
    for (const [calendar, id] of [[main, 'main-aux'], [side, 'side-aux']]) {
        calendar.setSourceEvents(id, context.buildEventsFromReminders(records, from, to, settings));
    }
    assert.equal(reads, 1);
    notify('custom-completion-time', 'optimistic');
    await flush();
    assert.equal(reads, 1, 'Do not read persisted task dates before the mutation commits');
    currentDue = '2026-09-18';
    notify('custom-completion-time');
    await flush();
    assert.equal(reads, 2, 'A deadline commit must invalidate the 60-second reminder cache');
    assert.deepEqual(refetches, ['main-aux', 'side-aux']);
    for (const calendar of [main, side]) {
        assert.equal(calendar.getEventById('reminder:task-block:2026-09-20'), null, 'Remove the old date from both mounted calendars');
        assert.ok(calendar.getEventById('reminder:task-block:2026-09-18'));
    }
    currentDue = '2026-09-20';
    notify('custom-my-deadline', 'rollback');
    await flush();
    assert.ok(main.getEventById('reminder:task-block:2026-09-20'), 'Rollback restores the reminder date, including custom deadline attribute names');
    notify('custom-priority');
    await flush();
    assert.equal(reads, 3, 'Unrelated task edits do not reload reminders');
    currentDue = '';
    notify('custom-completion-time');
    await flush();
    assert.equal(main.getEvents().length, 0);
    assert.equal(side.getEvents().length, 0);
    console.log('calendar reminder follow date tests passed');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
