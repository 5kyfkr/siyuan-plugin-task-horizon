'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const model = read('src/task-horizon/main/task-runtime/50-task-model-and-repeat-utils.js');
const runtime = read('src/task-horizon/main/task-runtime/54-recurring-task-runtime.js');
const stores = read('src/task-horizon/main/10-stores-rules-and-cache.js');
const fn = (source, name) => {
    const found = source.match(new RegExp('    (?:async )?function ' + name + '\\('));
    assert.ok(found, name);
    return source.slice(found.index, source.indexOf('\n    }', found.index) + 6);
};
const clone = value => JSON.parse(JSON.stringify(value));
let operationSequence = 0;
const day = value => value instanceof Date ? [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-') : String(value || '').slice(0, 10);
const context = vm.createContext({ Date, Intl, Math, Number, String, JSON, Set, Map, WeakMap, WeakSet, Array, Object, TextEncoder,
    __tmNormalizeTaskCompleteAtValue: value => String(value || ''),
    __tmCreateMutationOperationId: () => 'generated-' + (++operationSequence),
    __tmIsTaskDoneEffective: task => task.done === true && !task.repeatState?.pendingNativeDoneReset,
});
vm.runInContext(model.slice(model.indexOf('    function __tmNormalizeDateOnly('), model.indexOf('    function __tmRenderRecurringInstanceBadge(')), context);
vm.runInContext(['__tmGetTaskRepeatRule', '__tmBuildTaskTomatoBaselinePatch', '__tmBuildTaskCompletionPlan', '__tmBuildRecurringTaskRollbackPatch', '__tmGetTaskRepeatScheduleSignature', '__tmBuildTaskRepeatRuleMetaPatch'].map(name => fn(runtime, name)).join('\n'), context);
const task = (patch = {}) => ({ id: '20261021120000-abcdefg', root_id: '20261021120000-doc0001', content: 'Daily task',
    done: false, customStatus: 'todo', taskCompleteAt: '', startDate: '2026-09-10', completionTime: '2026-09-12',
    repeatRule: { enabled: true, trigger: 'complete', type: 'daily', every: 1, anchorDate: '2026-09-12' },
    repeatState: { occurrenceCount: 1 }, repeatHistory: [], ...patch });
const settings = id => ({ operationId: id, now: '2026-09-11T09:00:00.123+08:00', completedAt: '2026-09-11T09:00:00.123+08:00',
    doneStatus: { customStatus: 'done' }, undoneStatus: { customStatus: 'todo' }, targetClosed: true, previousDone: false });
const plan = (value, intent, id = 'operation-1', extra = {}) => context.__tmBuildTaskCompletionPlan(value, intent, { ...settings(id), ...extra });

const initial = task();
const first = plan(initial, { done: true });
assert.equal(first.patch.done, false);
assert.equal(first.patch.completionTime, '2026-09-12', 'early completion may keep the planned date for another round');
assert.equal(first.patch.startDate, '2026-09-10');
assert.equal(first.patch.repeatState.occurrenceCount, 2);
assert.equal(first.receipt.completedOccurrence, true, 'completion is independent of the final checkbox');
assert.equal(first.patch.repeatHistory[0].id, 'operation-1');
const advanced = { ...initial, ...clone(first.patch) };
const duplicate = plan(advanced, { done: true, occurrenceId: first.receipt.occurrenceId }, 'duplicate-request');
assert.equal(duplicate.receipt.outcome, 'alreadyApplied');
assert.deepEqual(clone(duplicate.patch), {});
const second = plan(advanced, { done: true }, 'operation-2');
assert.equal(second.patch.repeatState.occurrenceCount, 3);
assert.notEqual(context.__tmBuildRecurringInstanceTask(advanced, first.patch.repeatHistory[0]).id,
    context.__tmBuildRecurringInstanceTask(advanced, second.patch.repeatHistory[0]).id, 'same-second records must have different stable IDs');
assert.equal(context.__tmBuildRecurringInstanceTask(advanced, first.patch.repeatHistory[0]).id,
    context.__tmBuildRecurringInstanceTask(advanced, first.patch.repeatHistory[0], 99).id, 'render order must not change identity');

const restored = plan(advanced, { done: false, restoreCompletionId: 'operation-1' }, 'undo-1');
assert.equal(restored.patch.completionTime, initial.completionTime);
assert.equal(restored.patch.startDate, initial.startDate);
assert.equal(restored.patch.repeatState.occurrenceCount, 1);
assert.equal(restored.patch.repeatHistory.length, 0);
assert.equal(restored.patch.done, false);
const restoredTask = { ...advanced, ...clone(restored.patch) };
assert.equal(plan(restoredTask, { done: false, restoreCompletionId: 'operation-1' }, 'undo-retry').receipt.outcome, 'alreadyApplied');
const replay = plan(restoredTask, { done: false, restoreState: {
    patch: first.patch, historyEntry: first.patch.repeatHistory[0], expectedOccurrenceId: restored.patch.repeatState.occurrenceId,
} }, 'undo-uncheck');
assert.equal(replay.patch.repeatHistory.length, 1);
assert.equal(replay.receipt.completedOccurrence, false, 'undoing an uncheck must not dispatch another completion reward');
assert.throws(() => plan({ ...advanced, completionTime: '2026-10-01' }, { done: false, restoreCompletionId: 'operation-1' }), /改期/);
assert.throws(() => plan({ ...advanced, ...clone(second.patch) }, { done: false, restoreCompletionId: 'operation-1' }), /后续完成/);
for (const keepNativeDone of [false, true]) {
    const result = plan(initial, { done: true }, 'held-' + keepNativeDone, { keepNativeDone });
    assert.equal(result.patch.done, keepNativeDone);
    assert.equal(result.patch.repeatState.pendingNativeDoneReset, keepNativeDone);
    assert.equal(plan({ ...initial, ...clone(result.patch) }, { done: false, restoreCompletionId: result.receipt.completionId }).patch.repeatHistory.length, 0);
}
const terminal = plan(task({ repeatRule: { ...initial.repeatRule, maxOccurrences: 1 } }), { done: true });
assert.equal(terminal.patch.done, true);
assert.equal(terminal.patch.repeatHistory.length, 1, 'the last occurrence must also have a record');
assert.equal(terminal.receipt.advanced, false);
assert.equal(context.__tmBuildRecurringInstanceTask({ ...initial, ...clone(terminal.patch) }, terminal.patch.repeatHistory[0]), null, 'the completed source row represents the final occurrence without a duplicate virtual row');
const native = plan(task({ done: true }), { done: true, nativeObserved: { previousDone: false, done: false, targetMarker: 'X' } });
assert.equal(native.receipt.completedOccurrence, true);
assert.equal(native.patch.repeatHistory.length, 1);
const cancel = plan(task(), { done: false }, 'cancel', { targetClosed: true, undoneStatus: { customStatus: 'cancelled' } });
assert.equal(cancel.receipt.completedOccurrence, false);
assert.equal(cancel.patch.taskCompleteAt, settings('cancel').completedAt, 'cancelled markers keep their closed timestamp without successful completion');

const annual = Array.from(context.tmRepeatCore.iterate({ enabled: true, trigger: 'due', type: 'yearly', anchorDate: '2024-02-29' }, { fromDateKey: '2024-02-29', toDateKey: '2032-03-01' }), item => item.dateKey);
assert.equal(annual[4], '2028-02-29');
assert.equal(annual[8], '2032-02-29');
for (const type of ['monthly', 'yearly']) {
    const range = context.__tmBuildTaskRepeatAdvancePatch({ startDate: '2026-02-17', completionTime: '2026-02-22' },
        { enabled: true, trigger: 'due', type, calendarMode: 'lunar', every: 1, anchorDate: '2026-02-22' }, { completedAt: settings('lunar').completedAt });
    assert.equal((new Date(range.completionTime + 'T12:00:00') - new Date(range.startDate + 'T12:00:00')) / 86400000, 5);
}
assert.ok(context.__tmAdvanceTaskRepeatDateKey('2025-07-25', { enabled: true, type: 'monthly', calendarMode: 'lunar', anchorDate: '2025-07-25' }), 'a leap-month seed must have a following regular month');
const checkin = task({ repeatRule: { enabled: true, trigger: 'checkin', type: 'daily', anchorDate: '2026-09-10', maxOccurrences: 2 },
    repeatState: { checkinHistory: ['2026-09-10', '2026-09-11', '2026-09-12'].map(scheduledDate => ({ scheduledDate, checkedAt: scheduledDate + 'T09:00:00Z' })) } });
assert.equal(context.__tmGetTaskRepeatProgressText(checkin), '计划打卡 2/2 · 额外 1 次');
vm.runInContext(read('src/task-horizon/vendor/ts-fsrs-5.4.1.umd.js') + '\n' + read('src/task-horizon/main/task-runtime/50a-fsrs-runtime.js'), context);
for (const rating of [2, 3, 4]) {
    const review = plan(task({ repeatRule: { enabled: true, type: 'fsrs' } }), { done: true, fsrsRating: rating }, 'review-' + rating);
    assert.ok(review.patch.completionTime > '2026-09-11');
    assert.equal(review.patch.repeatHistory[0].rating, rating);
    assert.equal(review.patch.repeatState.fsrsCard.reps, 1);
}
assert.throws(() => plan(task({ repeatRule: { enabled: true, type: 'fsrs' } }), { done: true, fsrsRating: 1 }), /FSRS/);
const focused = task({ tomatoMinutes: '120', tomatoHours: '2', tomatoCount: '4', repeatState: {
    tomatoBaselineMinutes: 100, tomatoBaselineHours: 1.67, tomatoBaselineCount: 3, tomatoBaselineSet: true,
} });
const focusPlan = plan(focused, { done: true }, 'focus');
assert.equal(focusPlan.patch.repeatHistory[0].tomatoOccurrenceMinutes, '20');
assert.equal(focusPlan.patch.repeatState.tomatoBaselineMinutes, 120);
const focusUndo = plan({ ...focused, ...clone(focusPlan.patch) }, { done: false, restoreCompletionId: 'focus' });
assert.equal(focusUndo.patch.repeatState.tomatoBaselineMinutes, 100, 'undo restores the occurrence baseline without deleting real focus totals');

Object.assign(context, { SettingsStore: { data: {} }, __tmIsLikelyBlockId: () => true,
    __tmGetTaskAttachmentPaths: () => [], __tmGetTaskAttachmentMetaMap: () => new Map(), __tmNormalizeTomatoCountValue: value => value,
    __tmHasTaskAttachmentAttrSnapshot: () => false });
vm.runInContext(['__tmEstimateJsonByteSize', '__tmCloneTaskSnapshotValue', '__tmCompactTaskIndexText', '__tmCompactTaskIndexValue', '__tmBuildTaskIndexBlockEntry', '__tmIsUsableTaskIndexDoc'].map(name => fn(stores, name)).join('\n'), context);
const large = context.__tmBuildTaskIndexBlockEntry(task({ repeatHistory: [{ content: 'x'.repeat(40000) }] }));
assert.equal(large.incomplete, true);
assert.equal(context.__tmIsUsableTaskIndexDoc({ id: initial.root_id, blocks: [large], updatedAt: Date.now() }), false);

async function testExecutor() {
    let stored = task();
    let failWrite = false;
    let failSettlement = false;
    const calls = { writes: 0, locals: 0, undos: [] };
    Object.assign(context, { state: {}, MetaStore: { set() {} }, __tmUndoState: { applying: false },
        __tmReadTaskMutationBaseline: async () => clone(stored),
        __tmSettleTomatoAfterTaskDone: async () => { if (failSettlement) throw new Error('settlement failed'); },
        __tmBuildCheckboxStatusPatch: (_task, done) => ({ customStatus: done ? 'done' : 'todo' }),
        __tmFindStatusOptionById: id => ({ marker: id === 'done' ? 'X' : ' ' }), __tmIsTaskMarkerClosed: marker => marker === 'X',
        __tmExecuteTaskCommandGateway: async input => { calls.writes++; if (failWrite) throw new Error('disk failed'); stored = { ...stored, ...clone(input.patch), taskMarker: input.patch.done ? 'X' : ' ' }; return { task: clone(stored) }; },
        __tmGetActiveTaskMutationLaneId: id => id, __tmNormalizeQueuedKernelTaskSnapshot: value => value,
        __tmResolveTaskMarker: value => value.taskMarker || (value.done ? 'X' : ' '),
        __tmTaskStore: { upsertLocal: () => calls.locals++ }, __tmApplyTaskFieldPatchToLocalMirrors() {},
        __tmMarkLocalTaskPatchWatermark() {},
        __tmSyncRecurringInstanceTasks() {}, __tmPushUndoRecord: record => calls.undos.push(record),
        __tmDispatchTaskAttrPatchUpdated() {}, __tmScheduleViewRefresh() {},
    });
    vm.runInContext(fn(runtime, '__tmExecuteTaskCompletion'), context);
    const execute = id => context.__tmExecuteTaskCompletion({ id, data: { taskId: initial.id, done: true, previousDone: false, completedAt: settings(id).completedAt } });
    const result = await execute('commit-once');
    assert.equal(calls.writes, 1, 'marker, history, dates and state must share one kernel command');
    assert.equal(result.task.done, false);
    assert.equal(result.completion.completionId, 'commit-once');
    assert.ok(result.task.repeatState.occurrenceId.startsWith('generated-'));
    assert.equal(calls.undos[0].completionId, 'commit-once');
    const before = clone(stored), localCount = calls.locals, undoCount = calls.undos.length;
    failSettlement = true;
    await assert.rejects(execute('failed-settlement'), /settlement failed/);
    assert.equal(calls.writes, 1, 'failed focus settlement must not submit an incomplete occurrence snapshot');
    failSettlement = false;
    failWrite = true;
    await assert.rejects(execute('failed'), /disk failed/);
    assert.deepEqual(stored, before);
    assert.equal(calls.locals, localCount, 'failed persistence must not publish a final state');
    assert.equal(calls.undos.length, undoCount);
}
async function testRestoredEffects() {
    const notifications = [], rewards = [];
    let links = 0;
    const ordinary = task({ done: true, repeatRule: { enabled: false, type: 'none' } });
    Object.assign(context, { __tmTaskBoundary: { getTask: () => ordinary },
        __tmTaskLifecycle: { notifyCompletion: (_id, done) => notifications.push(done) },
        __tmDispatchTaskCompletedForReward: value => rewards.push(value),
        __tmSynchronizeCompletionLinks: async () => { links++; return { ok: true }; },
        __tmSyncParentDoneStateFromSubtasks: async () => null,
    });
    vm.runInContext(fn(runtime, '__tmApplyCompletionReceiptEffects'), context);
    const api = read('src/task-horizon/main/20-api-and-runtime-services.js');
    vm.runInContext(fn(api, '__tmBuildSetDoneEffectsOp'), context);
    const completion = { recurring: false, restoredState: true, completedOccurrence: false, outcome: 'committed' };
    const effects = context.__tmBuildSetDoneEffectsOp({ id: 'undo-uncheck', type: 'setDone', data: {
        taskId: ordinary.id, done: false, previousDone: false, completion,
    } });
    assert.ok(effects, 'restoring an uncheck must run lifecycle effects even without a new completion');
    await context.__tmApplyCompletionReceiptEffects(ordinary.id, effects.data);
    assert.deepEqual(notifications, [true], 'archive/restore must follow the restored final task state');
    assert.deepEqual(rewards, [], 'undo must not issue a second completion reward');
    const retry = { ...completion, restoredState: false, recurring: true, outcome: 'alreadyApplied', completionId: 'old-completion' };
    assert.ok(context.__tmBuildSetDoneEffectsOp({ id: 'retry', type: 'setDone', data: { taskId: ordinary.id, done: true, previousDone: true, completion: retry } }));
    await context.__tmApplyCompletionReceiptEffects(ordinary.id, { completion: retry, rewardPriorityScore: 10 });
    assert.equal(links, 2, 'retry repairs completion links without another task transition');
    assert.deepEqual(notifications, [true]);
    assert.deepEqual(rewards, []);
}

async function testCapturedIntent() {
    const api = read('src/task-horizon/main/20-api-and-runtime-services.js');
    let latest = { id: 'task', occurrence: 'old-round' }, sessionId = 'old-timer', release, queued;
    const pending = new Promise(resolve => { release = resolve; });
    const captured = vm.createContext({ Promise,
        __tmMutationGetTask: () => latest, __tmGetTaskOccurrenceId: value => value.occurrence,
        __tmWaitForPendingTaskWrites: () => pending,
        __tomatoTimerV2: { getSettlementContext: () => ({ sessionId }) },
        __tmQueueSetDoneTask: (_id, _done, _task, options) => { queued = options; return true; },
    });
    vm.runInContext(fn(api, '__tmMutationSetDone'), captured);
    const request = captured.__tmMutationSetDone('task', true, { wait: true });
    latest = { id: 'task', occurrence: 'new-round' }; sessionId = 'new-timer';
    release({ ok: true }); await request;
    assert.equal(queued.occurrenceId, 'old-round', 'waiting for writes cannot retarget a click to a newer round');
    assert.equal(queued.timerContext.sessionId, 'old-timer');
}

testExecutor().then(testRestoredEffects).then(testCapturedIntent).then(() => console.log('recurring transition, dates, identity, undo, index and single-write behavior passed')).catch(error => { console.error(error); process.exitCode = 1; });
