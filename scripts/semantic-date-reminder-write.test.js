'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const mainRoot = path.resolve(__dirname, '..', 'src', 'task-horizon', 'main');
const apiSource = fs.readFileSync(path.join(mainRoot, '20-api-and-runtime-services.js'), 'utf8');
const repeatSource = fs.readFileSync(path.join(mainRoot, 'task-runtime', '54-recurring-task-runtime.js'), 'utf8');
const modelSource = fs.readFileSync(path.join(mainRoot, 'task-runtime', '50-task-model-and-repeat-utils.js'), 'utf8');

function segment(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start + startMarker.length);
    assert.ok(start >= 0 && end > start, 'missing source segment: ' + startMarker);
    return source.slice(start, end);
}

const runtime = [
    segment(apiSource, '    function __tmSemanticPad2', '    async function __tmCollectSemanticDateSuggestions'),
    segment(apiSource, '    function __tmGetSemanticSuggestionWrites', '    function __tmShowSemanticDateConfirmModal'),
    segment(apiSource, '    function __tmReminderToDateSafe', '    function __tmReminderOccurrenceKey'),
    segment(apiSource, '    function __tmGetTomatoReminderBridgeV1', '    function __tmInvalidateTaskReminderMark'),
    segment(modelSource, '    function __tmNormalizeDateOnly', '    function __tmParseTaskRepeatJson'),
    segment(repeatSource, '    async function __tmApplyFollowReminderDraft', '    async function __tmClearFollowReminderDraft'),
].join('\n');

function createHarness(overrides = {}, options = {}) {
    const task = {
        id: 'task-1',
        root_id: 'doc-1',
        content: '明天记得去寄快递',
        startDate: '',
        completionTime: '',
        repeatRule: { enabled: false, type: 'none' },
        repeatState: {},
        ...overrides,
    };
    const sameNameTask = { ...task, id: 'task-2' };
    const tasks = new Map([[task.id, task], [sameNameTask.id, sameNameTask]]);
    const writes = [];
    const reminders = [];
    const patchTask = async (taskId, patch) => {
        writes.push({ taskId, patch: { ...patch } });
        Object.assign(tasks.get(taskId), patch);
        return true;
    };
    const context = vm.createContext({
        Date,
        SettingsStore: { data: { semanticDateDefaultReminderTime: options.defaultTime || '08:00' } },
        __TM_REMINDER_REPEAT_MODE_FOLLOW_TASK: 'followTaskRepeat',
        __tmTaskBoundary: { getTask: (taskId) => tasks.get(taskId) },
        __tmRequireTaskMutation: () => patchTask,
        __tmResolveTaskForRepeat: async (taskId) => ({ ...tasks.get(taskId) }),
        __tmResolveTaskBindingFromAnyBlockId: async (taskId) => ({
            taskId,
            attrHostId: 'host-' + taskId,
            task: { ...tasks.get(taskId), ...options.bindingSnapshot },
        }),
        __tmGetTaskAttrHostId: (candidate) => 'host-' + candidate.id,
        __tmApplyTaskMetaPatchWithUndo: patchTask,
        __tmGetTaskRepeatRule: (candidate) => candidate.repeatRule,
        __tmNormalizeTaskRepeatRule: (value) => value,
        __tmNormalizeTaskRepeatState: (value) => value,
        __tmInvalidateTasksQueryCacheByDocId: () => {},
        __tomatoReminder: {
            version: 1,
            get: async () => ({ hasReminder: options.existingReminder === true }),
            upsert: async (taskId, reminder) => {
                reminders.push({ taskId, ...reminder });
                return { ok: true, attrHostId: reminder.blockId, reminder };
            },
        },
    });
    vm.runInContext(runtime, context);
    const suggestion = context.__tmExtractSemanticTaskDateSuggestion(task, new Date(2026, 8, 10, 10));
    assert.ok(suggestion);
    suggestion.writes = context.__tmSemanticBuildSuggestionWrites(suggestion, {});
    return {
        task, sameNameTask, writes, reminders, context, suggestion,
        apply: (selectedWriteIds) => context.__tmApplySemanticDateSuggestions([{ ...suggestion, selectedWriteIds }]),
    };
}

async function assertReminderWrite(harness, expectedTime = '08:00') {
    assert.equal(harness.suggestion.reminderAt, '2026-09-11 ' + expectedTime);
    const result = await harness.apply(['reminder']);
    assert.equal(result.failures.length, 0);
    assert.equal(result.reminderApplied, 1);
    assert.equal(harness.reminders.length, 1);
    assert.equal(harness.reminders[0].startDate, '2026-09-11', 'saved reminder must use the preview date, not the old task deadline');
    assert.equal(harness.reminders[0].taskCompletionTime, '2026-09-11');
    assert.equal(harness.reminders[0].times.join(','), expectedTime);
    assert.equal(harness.reminders[0].repeatMode, 'followTaskRepeat');
    assert.equal(harness.reminders[0].blockId, 'host-task-1');
    assert.equal(harness.task.completionTime, '2026-09-11');
    assert.ok(harness.writes.every((write) => write.taskId === 'task-1'));
    return result;
}

(async () => {
    const existingDue = createHarness({ completionTime: '2026-09-10' });
    assert.equal(existingDue.suggestion.completionValue, '');
    assert.equal(existingDue.suggestion.writes.length, 1, 'an existing deadline leaves only the reminder suggestion');
    assert.equal(existingDue.suggestion.writes[0].id, 'reminder');
    assert.equal(existingDue.suggestion.writes[0].checked, false);
    await assertReminderWrite(existingDue);
    assert.equal(existingDue.writes.length, 1);
    assert.equal(existingDue.sameNameTask.completionTime, '2026-09-10', 'same-name tasks must not be changed');

    const fresh = createHarness();
    assert.equal(fresh.suggestion.completionValue, '2026-09-11');
    await assertReminderWrite(fresh);
    assert.equal(fresh.sameNameTask.completionTime, '');

    const unchanged = createHarness({ completionTime: '2026-09-11 18:00' });
    const unchangedResult = await unchanged.apply(['reminder']);
    assert.equal(unchangedResult.failures.length, 0);
    assert.equal(unchanged.reminders[0].startDate, '2026-09-11');
    assert.equal(unchanged.task.completionTime, '2026-09-11 18:00');
    assert.equal(unchanged.writes.length, 0, 'same-day reminder edits must preserve the existing deadline clock');

    const stale = createHarness({}, { bindingSnapshot: { completionTime: '2026-09-10' } });
    await assertReminderWrite(stale);

    const explicitTime = createHarness({ content: '明天9点提醒我寄快递', completionTime: '2026-09-10' });
    await assertReminderWrite(explicitTime, '09:00');

    const midnight = createHarness({ completionTime: '2026-09-10' }, { defaultTime: '00:05' });
    await assertReminderWrite(midnight, '00:05');

    const repeating = createHarness({
        completionTime: '2026-09-10',
        repeatRule: { enabled: true, type: 'daily', every: 2 },
        repeatState: { occurrenceCount: 3 },
    });
    await assertReminderWrite(repeating);
    assert.deepEqual(repeating.writes[0].patch, { completionTime: '2026-09-11' });
    assert.equal(repeating.reminders[0].taskRepeatRule, repeating.task.repeatRule);
    assert.equal(repeating.reminders[0].taskRepeatState, repeating.task.repeatState);

    const existingReminder = createHarness({ completionTime: '2026-09-10' }, { existingReminder: true });
    const skipped = await existingReminder.apply(['reminder']);
    assert.equal(skipped.reminderApplied, 0);
    assert.match(skipped.failures[0], /已有提醒/);
    assert.equal(existingReminder.task.completionTime, '2026-09-10');
    assert.equal(existingReminder.writes.length, 0);
    assert.equal(existingReminder.reminders.length, 0);

    const deadlineOnly = createHarness();
    const deadlineResult = await deadlineOnly.apply(['completionTime']);
    assert.equal(deadlineResult.failures.length, 0);
    assert.equal(deadlineOnly.task.completionTime, '2026-09-11');
    assert.equal(deadlineOnly.reminders.length, 0, 'unchecked reminders must not be saved');

    const both = createHarness();
    const bothResult = await both.apply(['completionTime', 'reminder']);
    assert.equal(bothResult.failures.length, 0);
    assert.equal(bothResult.completionApplied, 1);
    assert.equal(bothResult.reminderApplied, 1);
    assert.equal(both.reminders[0].startDate, '2026-09-11');
    assert.equal(both.writes.length, 1, 'a selected deadline must not be rewritten by the reminder bridge');

    console.log('semantic date reminder write tests passed');
})().catch((error) => {
    process.nextTick(() => { throw error; });
});
