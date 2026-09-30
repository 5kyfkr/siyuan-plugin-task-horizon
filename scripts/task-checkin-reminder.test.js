'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = process.env.TASK_HORIZON_TEST_ROOT || path.resolve(__dirname, '../src/task-horizon/main');
const api = fs.readFileSync(path.join(root, '20-api-and-runtime-services.js'), 'utf8');
const recurring = fs.readFileSync(path.join(root, 'task-runtime/54-recurring-task-runtime.js'), 'utf8');
const extract = (source, name) => {
    const start = source.search(new RegExp(`    (?:async )?function ${name}\\(`));
    const end = source.indexOf('\n    }', start);
    assert.ok(start >= 0 && end > start, name);
    return source.slice(start, end + 6);
};
const history = new Map([['2026-09-30', true]]);
const task = { id: 'habit', done: true, startDate: '', completionTime: '', repeatRule: { enabled: true, trigger: 'checkin', type: 'weekly', weekdays: [1, 3, 5], anchorDate: '2026-09-28' }, repeatState: {} };
let canceled = false, writes = 0;
const context = vm.createContext({
    console, SettingsStore: { data: { enableTomatoIntegration: true } }, __tmNs: {},
    __TM_REMINDER_REPEAT_MODE_FOLLOW_TASK: 'followTaskRepeat',
    __tmReminderUpdateDetailLooksUncomplete: () => false,
    __tmParseReminderRecordFromValue: value => value,
    __tmGetReminderRepeatMode: value => value.repeatMode,
    __tmResolveTaskIdFromAnyBlockId: async () => task.id,
    __tmResolveTaskForRepeat: async () => task,
    __tmIsRecurringInstanceTask: () => false,
    __tmIsTaskCanceled: () => canceled,
    __tmIsTaskDoneEffective: () => true,
    __tmGetTaskRepeatRule: value => value.repeatRule,
    __tmNormalizeTaskRepeatRule: value => value,
    __tmNormalizeTaskRepeatState: value => ({ ...value, checkinHistory: value?.checkinHistory || [] }),
    __tmNormalizeDateOnly: value => String(value || ''),
    __tmNormalizeReminderDateKey: value => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '',
    __tmNormalizeReminderTaskRepeatRule: value => value,
    __tmParseReminderTime: value => ({ key: value }),
    __tmGetTaskAttrHostId: () => 'habit',
    __tmApplyTaskMetaPatchWithUndo: async () => { throw new Error('check-in reminder settings must not rewrite task dates'); },
    tmSetTaskCheckin: async (id, date, checked) => {
        if (date > '2026-09-30') throw new Error('future');
        assert.equal(id, 'habit'); writes++; checked ? history.set(date, true) : history.delete(date); return true;
    },
});
context.window = context;
vm.runInContext(extract(api, '__tmMaybeAdvanceRecurringTaskFromReminderRecord') + extract(recurring, '__tmApplyFollowReminderDraft'), context);
vm.runInContext(extract(api, '__tmGetReminderCompletedOccurrences'), context);
const bridgeStart = api.indexOf('    __tmNs.reminderBridge = {');
const bridgeEnd = api.indexOf('\n    function __tmApplyReminderTaskNameMarks', bridgeStart);
vm.runInContext(api.slice(bridgeStart, bridgeEnd), context);
const reminder = { repeatMode: 'followTaskRepeat', syncTaskDone: true };
const set = (date, checked) => context.__tmNs.reminderBridge.setCheckinFromReminder({ taskId: 'habit', reminder, occurrenceKey: `${date} 09:00`, checked });
(async () => {
    const projected = context.__tmGetReminderCompletedOccurrences({ ...reminder, times: ['09:00', '18:00'], taskRepeatRule: task.repeatRule,
        taskRepeatState: { checkinHistory: [{ scheduledDate: '2026-09-30', checkedAt: '2026-09-30T10:00:00' }] }, completedOccurrences: [{ date: '2026-09-28', time: '09:00' }] });
    assert.equal(projected.length, 2); assert.equal(projected[0].date, '2026-09-30');
    assert.equal((await set('2026-09-28', true)).applied, true, 'today checked must not block making up a past reminder');
    assert.equal((await set('2026-09-28', false)).applied, true);
    assert.equal(history.has('2026-09-30'), true, 'undo must preserve another date');
    assert.equal((await set('2026-09-29', true)).applied, true, 'extra check-ins keep the original recurrence');
    assert.equal((await set('2026-10-01', true)).ok, false);
    assert.equal((await context.__tmApplyFollowReminderDraft({ taskId: 'habit', completionTime: '2026-10-15' })).completionTime, '');
    assert.equal(task.startDate, ''); assert.equal(task.completionTime, '');
    assert.deepEqual(task.repeatRule.weekdays, [1, 3, 5]);
    const before = writes;
    canceled = true; assert.equal((await set('2026-09-28', true)).ok, false); canceled = false;
    task.repeatRule.trigger = 'due'; assert.equal((await set('2026-09-28', true)).ok, false);
    task.repeatRule.trigger = 'checkin'; task.repeatRule.enabled = false; assert.equal((await set('2026-09-28', true)).ok, false);
    task.repeatRule.enabled = true; context.SettingsStore.data.enableTomatoIntegration = false; assert.equal((await set('2026-09-28', true)).ok, false);
    assert.equal(writes, before, 'ordinary, disabled, canceled and disconnected tasks must not be changed');
    console.log('Task Horizon date-specific reminder check-in bridge and date ownership tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
