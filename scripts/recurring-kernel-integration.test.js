'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHarness, IDS } = require('./kernel-contract.test.js');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const model = read('src/task-horizon/main/task-runtime/50-task-model-and-repeat-utils.js');
const recurring = read('src/task-horizon/main/task-runtime/54-recurring-task-runtime.js');
const api = read('src/task-horizon/main/20-api-and-runtime-services.js');
const fn = (source, name) => {
    const match = source.match(new RegExp('    (?:async )?function ' + name + '\\('));
    assert.ok(match, name);
    return source.slice(match.index, source.indexOf('\n    }', match.index) + 6);
};
async function run() {
    const host = createHarness();
    await host.start();
    const setup = await host.call('taskHorizonMutateTask', { action: 'patch', taskID: IDS.firstTask,
        patch: { startDate: '2026-10-19', completionTime: '2026-10-21',
            repeatRule: { enabled: true, type: 'daily', trigger: 'due', anchorDate: '2026-10-21', maxOccurrences: 3 } }, recordUndo: false });
    assert.equal(setup.data.outcome, 'committed');
    let beforeWrite = null;
    const local = [], undos = [];
    let sequence = 0;
    const context = vm.createContext({ Date, Intl, Math, Number, String, JSON, Set, Map, Array, Object,
        SettingsStore: { data: {} }, state: {}, MetaStore: { set() {} }, __tmUndoState: { applying: false },
        __tmNormalizeTaskCompleteAtValue: value => String(value || ''),
        __tmCreateMutationOperationId: () => 'integration-' + (++sequence),
        __tmNormalizeTaskAttachmentPaths: value => value || [], __tmGetCustomFieldDefs: () => [], __tmNormalizeCustomFieldValue: (_field, value) => value,
        __tmBuildCheckboxStatusPatch: (_task, done) => ({ customStatus: done ? 'done' : 'todo' }),
        __tmFindStatusOptionById: id => ({ marker: id === 'done' ? 'X' : ' ' }), __tmIsTaskMarkerClosed: marker => marker === 'X',
        __tmResolveTaskMarker: value => value.done ? 'X' : ' ', __tmGetActiveTaskMutationLaneId: id => id,
        __tmSettleTomatoAfterTaskDone: async () => {}, __tmTaskStore: { upsertLocal: task => local.push(task) },
        __tmApplyTaskFieldPatchToLocalMirrors() {}, __tmMarkLocalTaskPatchWatermark() {}, __tmSyncRecurringInstanceTasks() {},
        __tmPushUndoRecord: record => undos.push(record), __tmDispatchTaskAttrPatchUpdated() {}, __tmScheduleViewRefresh() {},
    });
    vm.runInContext(model.slice(model.indexOf('    function __tmNormalizeDateOnly('), model.indexOf('    function __tmRenderRecurringInstanceBadge(')), context);
    vm.runInContext(fn(api, '__tmNormalizeQueuedKernelTaskSnapshot'), context);
    vm.runInContext(['__tmGetTaskRepeatRule', '__tmBuildTaskTomatoBaselinePatch', '__tmGetTaskRepeatScheduleSignature', '__tmBuildRecurringTaskRollbackPatch', '__tmBuildTaskCompletionPlan', '__tmExecuteTaskCompletion'].map(name => fn(recurring, name)).join('\n'), context);
    context.__tmReadTaskMutationBaseline = async () => {
        const response = await host.call('taskHorizonGetTask', IDS.firstTask);
        assert.equal(response.ok, true);
        return context.__tmNormalizeQueuedKernelTaskSnapshot(response.data);
    };
    context.__tmExecuteTaskCommandGateway = async input => {
        if (beforeWrite) { const mutate = beforeWrite; beforeWrite = null; await mutate(); }
        const response = await host.call('taskHorizonMutateTask', JSON.parse(JSON.stringify(input)));
        if (!response.ok || response.data.outcome !== 'committed') throw new Error(response.data?.error?.message || response.error?.message || 'write failed');
        return response.data;
    };
    const transactionCount = () => host.apiCalls.filter(call => call.pathname === '/api/transactions').length;
    let lastOperation;
    const execute = (id, data = {}) => context.__tmExecuteTaskCompletion(lastOperation = { id, data: { taskId: IDS.firstTask,
        done: true, previousDone: false, completedAt: '2026-10-21T09:00:00.123+08:00', ...data } });
    const before = transactionCount();
    const completion = await execute('real-completion');
    assert.equal(transactionCount() - before, 1, 'the real kernel must commit marker, repeat state and history in one transaction');
    assert.equal(completion.task.done, false);
    assert.equal(completion.task.completionTime, '2026-10-22');
    assert.equal(completion.task.repeatHistory[0].id, 'real-completion');
    assert.equal(undos[0].completionId, 'real-completion');
    const retry = await execute('real-completion');
    assert.equal(retry.completion.outcome, 'alreadyApplied');
    assert.equal(lastOperation.data.committedPatch.done, false, 'a duplicate must acknowledge the current round instead of publishing its stale optimistic check');
    assert.equal(lastOperation.data.committedPatch.completionTime, '2026-10-22');
    assert.equal(transactionCount() - before, 1);
    const undo = await execute('real-undo', { done: false, restoreCompletionId: 'real-completion' });
    assert.equal(undo.task.completionTime, '2026-10-21');
    assert.equal(undo.task.repeatHistory.length, 0);
    host.failTransactionOnce();
    const localsBefore = local.length;
    await assert.rejects(execute('failed-write'));
    assert.equal(local.length, localsBefore);
    const afterFailure = await context.__tmReadTaskMutationBaseline();
    assert.equal(afterFailure.repeatHistory.length, 0);
    beforeWrite = () => host.call('taskHorizonMutateTask', { action: 'patch', taskID: IDS.firstTask,
        patch: { completionTime: '2026-11-01' }, recordUndo: false });
    await assert.rejects(execute('conflicting-write'), /变化|CONFLICT|write failed/);
    const afterConflict = await context.__tmReadTaskMutationBaseline();
    assert.equal(afterConflict.completionTime, '2026-11-01');
    assert.equal(afterConflict.repeatHistory.length, 0);
    console.log('real kernel completion, retry, undo, failure and conflict integration passed');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
