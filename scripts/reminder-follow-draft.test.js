'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
    path.resolve(__dirname, '..', 'src', 'task-horizon', 'main', 'task-runtime', '54-recurring-task-runtime.js'),
    'utf8',
);
const start = source.indexOf('async function __tmApplyFollowReminderDraft');
const end = source.indexOf('\n    try {\n        const previousBridge', start);
assert.ok(start >= 0 && end > start, 'follow draft bridge helper must remain extractable');

let task = {
    id: 'task-1',
    content: 'Canonical task',
    startDate: '2026-07-01',
    completionTime: '2026-07-18',
    repeatRule: { enabled: true, type: 'daily', every: 1 },
    repeatState: { occurrenceCount: 2 },
};
const writes = [];
const context = vm.createContext({
    JSON,
    Object,
    String,
    __tmResolveTaskForRepeat: async () => ({ ...task }),
    __tmNormalizeDateOnly: (value) => String(value || '').slice(0, 10),
    __tmBuildTaskRepeatRuleMetaPatch: (candidate, repeatRule) => {
        const enabled = !!repeatRule?.enabled && repeatRule?.type !== 'none';
        return {
            repeatRule: enabled ? repeatRule : { enabled: false, type: 'none' },
            repeatState: enabled
                ? candidate.repeatState
                : { ...candidate.repeatState, occurrenceCount: 1, lastInstanceDue: '' },
        };
    },
    __tmNormalizeTaskRepeatRule: (value) => value,
    __tmNormalizeTaskRepeatState: (value) => value,
    __tmApplyTaskMetaPatchWithUndo: async (taskId, patch, options) => {
        writes.push({ taskId, patch, options });
        return true;
    },
    __tmGetTaskAttrHostId: () => 'host-1',
});
vm.runInContext(`${source.slice(start, end)}\nthis.applyFollowDraft = __tmApplyFollowReminderDraft;\nthis.clearFollowDraft = __tmClearFollowReminderDraft;`, context);

(async () => {
    const unchanged = await context.applyFollowDraft({
        taskId: 'task-1',
        completionTime: '2026-07-18',
        repeatRule: task.repeatRule,
    });
    assert.equal(unchanged.changed, false, 'saving notification-only edits must not rewrite task fields');
    assert.equal(writes.length, 0);

    const moved = await context.applyFollowDraft({
        taskId: 'task-1',
        completionTime: '2026-07-19',
        repeatRule: task.repeatRule,
    });
    assert.equal(moved.changed, true);
    assert.equal(writes.length, 1, 'task-linked fields must be written once');
    assert.equal(writes[0].patch.completionTime, '2026-07-19');
    assert.equal(writes[0].patch.repeatRule.type, 'daily');
    assert.equal(writes[0].patch.repeatState.occurrenceCount, 2);
    assert.equal(moved.attrHostId, 'host-1');
    assert.equal(moved.taskTitle, 'Canonical task');

    await assert.rejects(
        () => context.applyFollowDraft({ taskId: 'task-1', completionTime: '', repeatRule: null }),
        /截止日不能为空/,
    );

    const cleared = await context.clearFollowDraft({ taskId: 'task-1' });
    assert.equal(cleared.changed, true);
    assert.equal(writes.length, 2, 'follow reminder deletion must write task-linked fields once');
    assert.equal(writes[1].patch.completionTime, '');
    assert.equal(writes[1].patch.repeatRule.enabled, false);
    assert.equal(writes[1].patch.repeatRule.type, 'none');
    assert.equal(writes[1].patch.repeatState.occurrenceCount, 1);
    assert.equal(writes[1].patch.repeatState.lastInstanceDue, '');

    task = {
        ...task,
        completionTime: '',
        repeatRule: cleared.repeatRule,
        repeatState: cleared.repeatState,
    };
    const clearedAgain = await context.clearFollowDraft({ taskId: 'task-1' });
    assert.equal(clearedAgain.changed, false, 'repeated cleanup must be idempotent');
    assert.equal(writes.length, 2);

    console.log('reminder follow draft tests passed');
})().catch((error) => {
    process.nextTick(() => { throw error; });
});
