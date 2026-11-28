'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('./i18n-vm-fixture');
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
    const initialAttrs = { ...host.attrs.get(IDS.firstTask), 'custom-task-repeat-history': '' };
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
    const records = () => [...host.storage.keys()].filter(path => path.startsWith('recurring-transitions-v1/'));
    assert.equal(records().length, 1, 'one independently synced file per committed transition');
    const converged = await host.call('taskHorizonReconcileRecurringTransitions');
    assert.deepEqual(Array.from(converged.data.taskIDs), [IDS.firstTask],
        'a document that already contains the synced transition still refreshes linked reminders');
    assert.equal((await host.call('taskHorizonReconcileRecurringTransitions')).data.taskIDs.length, 0,
        'the converged reminder refresh is acknowledged once');
    host.attrs.set(IDS.firstTask, { ...initialAttrs });
    const replay = await host.call('taskHorizonReconcileRecurringTransitions');
    assert.equal(replay.ok, true, JSON.stringify(replay));
    assert.deepEqual(Array.from(replay.data.taskIDs), [IDS.firstTask]);
    assert.equal((await context.__tmReadTaskMutationBaseline()).completionTime, '2026-10-22');
    assert.equal((await host.call('taskHorizonReconcileRecurringTransitions')).data.taskIDs.length, 0);
    assert.equal(records().length, 1, 'replay must not create another event');
    const completedAttrs = { ...host.attrs.get(IDS.firstTask) };
    const undo = await execute('real-undo', { done: false, restoreCompletionId: 'real-completion' });
    assert.equal(undo.task.completionTime, '2026-10-21');
    assert.equal(undo.task.repeatHistory.length, 0);
    assert.equal(records().length, 2, 'undo has its own record');
    host.attrs.set(IDS.firstTask, completedAttrs);
    const undoReplay = await host.call('taskHorizonReconcileRecurringTransitions');
    assert.deepEqual(Array.from(undoReplay.data.taskIDs), [IDS.firstTask]);
    assert.equal((await context.__tmReadTaskMutationBaseline()).repeatHistory.length, 0);
    assert.equal((await host.call('taskHorizonReconcileRecurringTransitions')).data.taskIDs.length, 0,
        'repeated reconciliation must not reapply an undone completion');
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
    assert.equal((await host.call('taskHorizonReconcileRecurringTransitions')).data.taskIDs.length, 0, 'changed dates must not be overwritten');
    assert.equal(records().length, 2, 'failed or conflicting mutations must not be journaled');
    console.log('real kernel completion, retry, undo, failure and conflict integration passed');
}

async function testReminderDeletionMarkers() {
    const attr = 'custom-tomato-reminder';
    const reminder = JSON.stringify({ reminderGeneration: 'old-generation', repeatMode: 'manual', startDate: '2026-10-21', times: ['09:00'] });
    const markerCalls = host => host.apiCalls.filter(call => call.pathname === '/api/file/putFile');
    for (const encryptedNotebook of [false, true]) {
        const host = createHarness({ encryptedNotebook });
        await host.start();
        for (const id of [IDS.singleTask, IDS.childTask, IDS.firstTask]) {
            host.blocks.get(id).box = 'box';
            host.attrs.set(id, { ...host.attrs.get(id), [attr]: reminder });
        }
        const result = await host.call('taskHorizonMutateTask', { action: 'blockOperation', operation: { action: 'deleteBlock', id: IDS.singleTask } });
        assert.equal(result.data.outcome, 'committed', JSON.stringify(result));
        assert.equal(host.blocks.has(IDS.childTask), false);
        const cleared = await host.call('taskHorizonConfigureTaskReminder', { action: 'apply', operation: 'clear', taskID: IDS.firstTask });
        assert.equal(cleared.ok, true, JSON.stringify(cleared));
        const expected = [IDS.singleTask, IDS.childTask, IDS.firstTask].map(id => ({ pathname: '/api/file/putFile', body: {
            path: `/data/storage/petal/siyuan-plugin-docktomato/reminder-deletions-v1/${id}--old-generation.json`, text: '{"deleted":true}',
        } }));
        const actual = markerCalls(host).map(call => {
            const { at, ...data } = JSON.parse(call.body.text);
            assert.ok(Number.isFinite(at));
            return { ...call, body: { ...call.body, text: JSON.stringify(data) } };
        });
        assert.deepEqual(actual.sort((a, b) => a.body.path.localeCompare(b.body.path)), encryptedNotebook ? []
            : expected.sort((a, b) => a.body.path.localeCompare(b.body.path)));
        assert.equal(host.attrs.get(IDS.firstTask)[attr], '');
    }
    console.log('task and nested reminder deletion markers passed');
}

async function testPostponementAndRetention() {
    const nextCleanup = Date.parse('2028-01-01T00:00:00+08:00');
    const cutoff = Date.parse('2027-01-01T00:00:00+08:00');
    let clock = nextCleanup - 1;
    let tick;
    let delay;
    class ClockDate extends Date {
        constructor(...args) { super(...(args.length ? args : [clock])); }
        static now() { return clock; }
    }
    const setTimeout = (fn, ms) => { tick = fn; delay = ms; return 1; };
    const host = createHarness({ Date: ClockDate, setTimeout });
    await host.start();
    const taskID = IDS.firstTask;
    const mutate = (patch, options) => host.call('taskHorizonMutateTask', { action: 'patch', taskID, patch, options });
    const rule = { enabled: true, type: 'weekly', trigger: 'due', anchorDate: '2026-10-19', weekdays: [1, 3, 5] };
    assert.equal((await mutate({ repeatRule: rule, startDate: '2026-10-19', completionTime: '2026-10-21' })).data.outcome, 'committed');
    const before = { ...host.attrs.get(taskID) };
    const shifted = await mutate({ repeatRule: { ...rule, weekdays: [1, 5] },
        completionTime: '2026-10-23', repeatState: { occurrenceCount: 1 } },
        { allowSystem: true, source: 'tomato-reminder-dialog' });
    assert.equal(shifted.data.outcome, 'committed');
    const paths = [...host.storage.keys()].filter(name => name.startsWith('recurring-transitions-v1/'));
    assert.equal(paths.length, 1);
    host.attrs.set(taskID, { ...before });
    assert.deepEqual(Array.from((await host.call('taskHorizonReconcileRecurringTransitions')).data.taskIDs), [taskID]);
    const current = (await host.call('taskHorizonGetTask', taskID)).data;
    assert.equal(current.completionTime, '2026-10-23');
    assert.equal(current.startDate, '2026-10-19');
    assert.equal(current.repeatRule.anchorDate, rule.anchorDate);
    assert.deepEqual(Array.from(current.repeatRule.weekdays), [1, 5], 'sync preserves the merged multi-date rule');
    const transition = JSON.parse(host.storage.get(paths[0]));
    host.storage.set(paths[0], JSON.stringify({ ...transition, at: cutoff - 1 }));
    host.attrs.set(taskID, { ...before });
    assert.deepEqual(Array.from((await host.call('taskHorizonReconcileRecurringTransitions')).data.taskIDs), [taskID],
        'a record between annual cutoffs still replays before the new year');
    assert.equal(JSON.parse(host.storage.get(paths[0])).taskID, taskID);
    const retention = 'recurring-history-retention-v1.json';
    await host.startMaintenance();
    assert.equal(delay, 1, 'schedule the next check at Beijing midnight rather than the next UTC day');
    assert.deepEqual(JSON.parse(host.storage.get(retention)), { year: 2027 });
    clock = nextCleanup;
    host.attrs.set(taskID, { ...before });
    assert.deepEqual(Array.from((await host.call('taskHorizonReconcileRecurringTransitions')).data.taskIDs), []);
    assert.equal(JSON.parse(host.storage.get(paths[0])).taskID, taskID, 'ordinary sync does not clear old records');
    const keepPath = `recurring-transitions-v1/${taskID}--transition_at_cutoff.json`;
    host.storage.set(keepPath, JSON.stringify({ ...transition, at: cutoff }));
    await tick();
    assert.deepEqual(JSON.parse(host.storage.get(paths[0])), {}, 'expired transition is cleared in place');
    assert.equal(JSON.parse(host.storage.get(keepPath)).at, cutoff, 'a transition exactly at the cutoff is retained');
    assert.deepEqual(JSON.parse(host.storage.get(retention)), { year: 2028 });
    const restarted = createHarness({ Date: ClockDate, setTimeout, storage: host.storage });
    const latePath = `recurring-transitions-v1/${taskID}--transition_synced_late.json`;
    host.storage.set(latePath, JSON.stringify({ ...transition, at: cutoff - 1 }));
    await restarted.start();
    await restarted.startMaintenance();
    assert.equal(JSON.parse(host.storage.get(latePath)).at, cutoff - 1, 'a completed year is not swept again after restart');
    console.log('postponement replay and in-place transition retention passed');
}

async function testDeletionRestartRetry() {
    const host = createHarness({ failReminderMarker: true });
    await host.start();
    host.blocks.get(IDS.singleTask).box = 'box';
    host.attrs.set(IDS.singleTask, { ...host.attrs.get(IDS.singleTask), 'custom-tomato-reminder': '{"reminderGeneration":"legacy"}' });
    const deleted = await host.call('taskHorizonMutateTask', { action: 'blockOperation', operation: { action: 'deleteBlock', id: IDS.singleTask } });
    assert.equal(deleted.data.outcome, 'committed');
    const path = `reminder-deletion-outbox-v1/${IDS.singleTask}--legacy.json`;
    const queued = JSON.parse(host.storage.get(path));
    const restarted = createHarness({ storage: host.storage });
    await restarted.start();
    await restarted.call('taskHorizonReconcileRecurringTransitions');
    const uploaded = restarted.apiCalls.find(call => call.pathname === '/api/file/putFile');
    assert.deepEqual(JSON.parse(uploaded.body.text), { deleted: true, at: queued.at });
    assert.deepEqual(JSON.parse(host.storage.get(path)), {});
    await restarted.call('taskHorizonReconcileRecurringTransitions');
    assert.equal(restarted.apiCalls.filter(call => call.pathname === '/api/file/putFile').length, 1);
    console.log('persistent reminder deletion retry passed');
}

run().then(testReminderDeletionMarkers).then(testPostponementAndRetention).then(testDeletionRestartRetry)
    .catch(error => { console.error(error); process.exitCode = 1; });
