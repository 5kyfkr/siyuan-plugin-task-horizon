const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const list = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js'), 'utf8');
const create = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53b-task-create-and-quick-add-runtime.js'), 'utf8');
const fieldRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js'), 'utf8');
const lifecycle = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/56-task-lifecycle-runtime.js'), 'utf8');
const store = fs.readFileSync(path.join(root, 'src/task-horizon/main/32-runtime-state-and-events.js'), 'utf8');

function extractFunction(source, name) {
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `${name} must exist`);
    const signatureEnd = source.indexOf(')', start);
    const bodyStart = source.indexOf('{', signatureEnd);
    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        if (source[index] !== '}') continue;
        depth -= 1;
        if (depth === 0) return source.slice(start, index + 1);
    }
    throw new Error(`unable to extract ${name}`);
}

const simpleRunner = extractFunction(api, '__tmRunSimpleMutation');
const enqueueFollowUps = extractFunction(api, '__tmEnqueueMutationFollowUpOps');
const enqueueSimple = extractFunction(api, '__tmEnqueueSimpleMutation');
const optimisticPresentation = extractFunction(api, '__tmApplySimpleOptimisticPresentation');
const watermarkOwnership = extractFunction(api, '__tmDoesMutationStillOwnLocalWatermark');
const acknowledge = extractFunction(api, '__tmAcknowledgeSimpleMutationResult');
const rollback = extractFunction(api, '__tmRollbackQueuedOp');
const resolveCreateSnapshot = extractFunction(api, '__tmResolveQueuedCreateTaskSnapshot');
const canRunDuringPendingDelete = extractFunction(api, '__tmCanMutationRunDuringPendingDelete');
const executeQueuedOp = extractFunction(api, '__tmExecuteQueuedOp');
const commitQueuedOp = extractFunction(api, '__tmCommitQueuedOp');
const buildBatchMoveItemOp = extractFunction(api, '__tmBuildQueuedBatchMoveItemOp');
const applyQueuedOpOptimistic = extractFunction(api, '__tmApplyQueuedOpOptimistic');
const ensurePendingDeletedStore = extractFunction(create, '__tmEnsurePendingDeletedTaskStore');
const rememberPendingDeleted = extractFunction(create, '__tmRememberPendingDeletedTaskIds');
const forgetPendingDeleted = extractFunction(create, '__tmForgetPendingDeletedTaskIds');

assert.match(api, /const __TM_PENDING_INSERTED_TASK_KEEPALIVE_MS = 120000;/,
    'optimistic creates must retain their shared pending-task lifetime definition');
assert.match(api, /const __TM_SIMPLE_MUTATION_TYPES = new Set\(/);
assert.match(api, /__tmShouldUseSimpleMutationService\(op\)/);
assert.match(api, /__tmEnqueueSimpleMutation\(op, options\)/);
assert.match(api, /function __tmApplySimpleOptimisticPresentation\(op\)/);
assert.match(simpleRunner, /__tmRollbackQueuedOp\(op\)/);
assert.equal((simpleRunner.match(/__tmRollbackQueuedOp\(op\)/g) || []).length, 1,
    'a failed simple mutation must have exactly one rollback path');
assert.equal((simpleRunner.match(/__tmExecuteQueuedOp\(op\)/g) || []).length, 1,
    'a simple mutation must execute the kernel writer exactly once');
assert.match(simpleRunner, /const tail = run\.finally\([\s\S]*tail\.catch\(\(\) => null\)/,
    'a failed lane cleanup promise must be observed instead of surfacing as an unhandled rejection');
assert.match(simpleRunner, /data\.showErrorHint !== false && data\.suppressHint !== true[\s\S]*__tmReportTaskMutationFailure/,
    'the mutation service must respect caller-owned error presentation');
assert.match(api, /showErrorHint: opts\.showErrorHint !== false && typeof opts\.onError !== 'function'/,
    'delete mutations with a caller error callback must not also show a generic error');
assert.match(list, /showErrorHint: hooks\.showErrorHint !== false && typeof hooks\.onError !== 'function'/,
    'move mutations with a caller error callback must not also show a generic error');
assert.match(list, /showErrorHint: options\.showErrorHint !== false,[\s\S]*suppressHint: options\.suppressHint === true/,
    'content mutations must preserve their error presentation contract');
assert.match(fieldRuntime, /showErrorHint: opts\.showErrorHint !== false,[\s\S]*suppressHint: opts\.suppressHint === true/,
    'field mutations must preserve their error presentation contract');
assert.match(create, /type: 'createSubtask'[\s\S]*suppressHint: true/,
    'subtask creation helper must own its contextual failure message');
assert.match(create, /type: 'createSibling'[\s\S]*suppressHint: true/,
    'sibling creation helper must own its contextual failure message');
assert.match(create, /showErrorHint: opts\.showErrorHint !== false[\s\S]*typeof hooks\.onError !== 'function'[\s\S]*typeof optsOnError !== 'function'/,
    'top-level creation callbacks must replace the generic failure message');
assert.match(lifecycle, /type: 'taskLifecycle'[\s\S]*suppressHint: true/,
    'lifecycle helper must own its contextual failure message');
assert.doesNotMatch(simpleRunner, /OutboxStorage\.(put|remove|get|putMany|removeMany)/,
    'interactive mutation runner must not persist or delete durable records');
assert.doesNotMatch(simpleRunner, /__tmScheduleOpQueueDrain/,
    'interactive mutation runner must not wake the legacy drain loop');
assert.match(enqueueSimple, /__tmRunSimpleMutation\(op\)/);
assert.doesNotMatch(enqueueSimple, /writeRetryDelays|retryDelays/,
    'interactive creates must not carry retry controls');
assert.match(enqueueSimple, /__tmApplySimpleOptimisticPresentation\(op\)[\s\S]*__tmRunSimpleMutation\(op\)/,
    'local optimistic presentation must run before kernel execution is scheduled');
assert.doesNotMatch(api, /function __tmScheduleSimpleOptimisticRender/,
    'structural optimistic mutations must not retain a second render queue outside ProjectionEngine');
assert.doesNotMatch(optimisticPresentation, /mutationDriven|deferChecklistRender|optimisticFilterStateReady|skipOptimisticMainRefresh/,
    'simple mutation presentation must only update local state and publish its ChangeSet');
assert.match(store, /localApplied = moveTaskLocal\([\s\S]*notified\.localApplied = localApplied/,
    'TaskStore must report whether a local move actually reached the canonical task tree');
assert.match(commitQueuedOp, /applyLocal: op\?\.optimisticApplied !== true/,
    'a confirmed move must repair local state when optimistic application failed');

const batchMovePublications = [];
const batchMoveRuntime = new Function(
    '__tmMutationTempTaskExistsForOptimisticApply',
    '__tmPublishQueuedOpMutation',
    '__tmMarkDocsPreferSiblingOrder',
    `${buildBatchMoveItemOp}\n${applyQueuedOpOptimistic}\n${rollback}\n${commitQueuedOp}\nreturn { apply: __tmApplyQueuedOpOptimistic, rollback: __tmRollbackQueuedOp, commit: __tmCommitQueuedOp };`,
)(
    (taskId) => ['task-a', 'task-b'].includes(taskId),
    (op, phase, detail) => batchMovePublications.push({ op, phase, detail }),
    () => true,
);
const batchMoveOp = {
    id: 'batch-1',
    type: 'batchMoveTasks',
    data: {
        taskIds: ['task-a', 'task-b'],
        snapshots: [
            { taskId: 'task-a', task: { id: 'task-a' } },
            { taskId: 'task-b', task: { id: 'task-b' } },
        ],
        targetDocId: 'doc-target',
        targetTaskId: 'parent-target',
        mode: 'child',
    },
};
assert.equal(batchMoveRuntime.apply(batchMoveOp), true,
    'a batch move must apply its local task-tree moves before the kernel response');
assert.deepEqual(batchMovePublications.map(({ op, phase }) => [op.id, op.type, phase]), [
    ['batch-1:move:0', 'moveTask', 'optimistic'],
    ['batch-1:move:1', 'moveTask', 'optimistic'],
]);
assert.equal(batchMovePublications.every(({ op }) => !Object.prototype.hasOwnProperty.call(op.data, 'taskIds')), true,
    'each batch item overlay must be scoped to one task');
batchMovePublications.length = 0;
batchMoveRuntime.commit(batchMoveOp, { results: [{ placement: {} }, { placement: {} }] });
assert.deepEqual(batchMovePublications.map(({ op, phase }) => [op.id, phase]), [
    ['batch-1:move:0', 'commit'],
    ['batch-1:move:1', 'commit'],
], 'batch commit must settle the same per-task overlays created optimistically');
batchMovePublications.length = 0;
batchMoveRuntime.rollback(batchMoveOp);
assert.deepEqual(batchMovePublications.map(({ op, phase }) => [op.id, phase]), [
    ['batch-1:move:1', 'rollback'],
    ['batch-1:move:0', 'rollback'],
], 'batch rollback must restore every moved task and settle its overlay');
batchMovePublications.length = 0;
assert.equal(batchMoveRuntime.apply({
    ...batchMoveOp,
    data: { ...batchMoveOp.data, snapshots: [batchMoveOp.data.snapshots[0]] },
}), false, 'an incomplete batch snapshot must not partially move the local tree');
assert.equal(batchMovePublications.length, 0);

const failedMovePublications = [];
const failedMoveRuntime = new Function(
    '__tmMutationTempTaskExistsForOptimisticApply',
    '__tmPublishQueuedOpMutation',
    `${buildBatchMoveItemOp}\n${applyQueuedOpOptimistic}\nreturn __tmApplyQueuedOpOptimistic;`,
)(
    () => true,
    (op, phase, detail) => {
        failedMovePublications.push({ op, phase, detail });
        return phase === 'optimistic' && op.data.taskId === 'task-b'
            ? { localApplied: false }
            : { localApplied: true };
    },
);
assert.equal(failedMoveRuntime(batchMoveOp), false,
    'a partially failed batch projection must not be marked optimistic');
assert.deepEqual(failedMovePublications.map(({ op, phase, detail }) => [op.id, phase, detail.applyLocal]), [
    ['batch-1:move:0', 'optimistic', undefined],
    ['batch-1:move:1', 'optimistic', undefined],
    ['batch-1:move:1', 'rollback', false],
    ['batch-1:move:0', 'rollback', undefined],
], 'a partial batch projection must settle the failed overlay and restore prior successful items');

const buildOptimisticPresentation = new Function(
    '__TM_SIMPLE_MUTATION_TYPES',
    '__tmApplyQueuedOpOptimistic',
    '__tmPublishQueuedOpMutation',
    `${optimisticPresentation}; return __tmApplySimpleOptimisticPresentation;`,
);
let applyCount = 0;
let publishedLifecycleMutation = null;
const applyOptimistic = buildOptimisticPresentation(
    new Set(['contentPatch', 'taskPatch', 'createTaskInDoc', 'createSubtask', 'createSibling', 'moveTask', 'deleteTask', 'setDone', 'taskLifecycle']),
    () => {
        applyCount += 1;
        return true;
    },
    (op, phase, detail) => {
        publishedLifecycleMutation = { op, phase, detail };
        return true;
    },
);
const fieldOp = { type: 'taskPatch', data: { taskId: 'task-1', patch: { pinned: '' } } };
assert.equal(applyOptimistic(fieldOp), true);
assert.equal(fieldOp.optimisticApplied, true, 'task field mutation must be marked optimistic before kernel execution');
assert.equal(applyCount, 1, 'task field mutation must reuse the existing optimistic implementation exactly once');
assert.equal(applyOptimistic(fieldOp), true);
assert.equal(applyCount, 1, 're-entering optimistic presentation must not apply the field patch twice');

const structuralOp = { type: 'moveTask', data: { taskId: 'task-2' } };
assert.equal(applyOptimistic(structuralOp), true);
assert.equal(applyCount, 2);
const topLevelCreateOp = {
    type: 'createTaskInDoc',
    data: { tempId: 'task-created' },
};
assert.equal(applyOptimistic(topLevelCreateOp), true);
assert.equal(applyCount, 3);
const detailOwnedSubtaskOp = {
    type: 'createSubtask',
    data: { tempId: 'subtask-created' },
};
assert.equal(applyOptimistic(detailOwnedSubtaskOp), true);
assert.equal(applyCount, 4);
const lifecycleOp = {
    type: 'taskLifecycle',
    data: {
        action: 'archiveDeleted',
        taskId: 'task-3',
        snapshot: { taskId: 'task-3', task: { id: 'task-3' } },
    },
};
assert.equal(applyOptimistic(lifecycleOp), false);
assert.equal(lifecycleOp.optimisticApplied, undefined,
    'recycle lifecycle must wait for the kernel move before removing its local projection');
assert.equal(publishedLifecycleMutation, null,
    'recycle lifecycle must not publish an optimistic delete before the kernel move commits');
const restoreSnapshot = { taskId: 'task-3', task: { id: 'task-3', content: 'Restored' } };
const restoreLifecycleOp = {
    type: 'taskLifecycle',
    data: {
        action: 'restoreDeleted',
        taskId: 'task-3',
        snapshot: restoreSnapshot,
    },
};
assert.equal(applyOptimistic(restoreLifecycleOp), true);
assert.equal(restoreLifecycleOp.optimisticApplied, true, 'recycle undo must restore its local snapshot optimistically');
assert.equal(publishedLifecycleMutation?.detail?.snapshot, restoreSnapshot);
assert.equal(publishedLifecycleMutation?.detail?.task, restoreSnapshot.task,
    'the restore overlay must retain the deleted task until kernel settlement');
assert.doesNotMatch(api, /__tmHydrateOpQueue|__tmVerifyQueuedOpCommit|__tmScheduleSimpleStructuralRefresh/,
    'one-shot mutations must not hydrate, poll, or schedule a successful-write readback');
assert.match(simpleRunner, /__tmAcknowledgeSimpleMutationResult\(op, result\)[\s\S]*__tmCommitQueuedOp\(op, result\)/,
    'the kernel transaction response must be acknowledged before the optimistic commit settles');
assert.match(simpleRunner, /const effectsResult = await __tmRunInTaskWriterContext\([\s\S]*__tmEnqueueMutationFollowUpOps\(effectsResult\)/,
    'committed completion effects must dispatch their returned mutations through the shared queue');
assert.doesNotMatch(simpleRunner, /await __tmEnqueueMutationFollowUpOps/,
    'same-lane follow-up mutations must be queued without deadlocking the current mutation');

const enqueuedFollowUps = [];
const followUpContext = vm.createContext({
    Promise,
    __tmEnqueueQueuedOp: (definition, options) => {
        enqueuedFollowUps.push({ definition, options });
        return Promise.resolve(definition.id);
    },
    __tmDescribeMutationOpType: (type) => type,
    __tmReportTaskMutationFailure: () => {},
});
vm.runInContext(`${enqueueFollowUps}\nthis.enqueueFollowUps = __tmEnqueueMutationFollowUpOps;`, followUpContext);
assert.equal(followUpContext.enqueueFollowUps({
    followUpOps: [
        { id: 'parent-op', type: 'setDone', data: { taskId: 'parent-1', done: true } },
        { id: 'archive-op', type: 'taskLifecycle', data: { taskId: 'task-1', action: 'archiveCompleted' } },
    ],
}), 2);
assert.deepEqual(enqueuedFollowUps.map((item) => item.definition.id), ['parent-op', 'archive-op']);
assert.ok(enqueuedFollowUps.every((item) => item.options.wait === false),
    'follow-up mutations must not await a lane still owned by the current mutation');
assert.ok(enqueuedFollowUps.every((item) => typeof item.options.onPending === 'function'),
    'follow-up diagnostics must observe the real pending promise instead of the immediate operation ID');
assert.ok(enqueuedFollowUps.every((item) => String(item.definition.data?.label || '').startsWith('完成状态已保存，但')),
    'follow-up failures must report partial success after the completion core has committed');
assert.match(simpleRunner, /requiresPlacementAcknowledgement[\s\S]*if \(requiresPlacementAcknowledgement\) throw error;[\s\S]*requiresPlacementAcknowledgement && !acknowledged/,
    'structural moves must fail instead of committing an unconfirmed kernel placement');
assert.match(acknowledge, /if \(__tmDoesQueuedTaskMatchPatch\(task, expectedPatch\)\) return true;/,
    'matching kernel responses must acknowledge the write without starting another readback');
assert.match(acknowledge, /!__tmDoesMutationStillOwnLocalWatermark\(taskId, expectedPatch\)/,
    'an older kernel response must not correct over a newer optimistic value');
assert.match(watermarkOwnership, /__tmGetLocalTaskPatchWatermarkValue\(tid, key\)[\s\S]*__tmQueuedVerificationValuesMatch/,
    'kernel correction ownership must compare each field against its latest expected value');
assert.doesNotMatch(acknowledge, /__tmClearLocalTaskPatchWatermark/,
    'a write ACK must not expose optimistic fields to a lagging SQL or websocket query');
assert.match(acknowledge, /__tmMarkLocalTaskPatchWatermark\(taskId, authoritativePatch/,
    'kernel-normalized corrections must remain protected until an authoritative query observes them');
assert.doesNotMatch(acknowledge, /__tmReadTaskMutationBaseline|__tmReadQueuedTaskBlockContentSnapshot|setTimeout/,
    'simple acknowledgement must not add SQL polling or delayed readback');
assert.ok((rollback.match(/__tmDoesMutationStillOwnLocalWatermark\(taskId, expectedPatch\)/g) || []).length >= 3,
    'each active field, title, and completion rollback must prove it still owns the latest watermark before clearing it');
assert.match(rollback, /type === 'contentPatch'[\s\S]*__tmDoesMutationStillOwnLocalWatermark\(taskId, expectedPatch\)[\s\S]*__tmClearLocalTaskPatchWatermark\(taskId, \{ content: '', markdown: '' \}\)/,
    'a failed title write may clear its title watermark only when no newer title edit replaced it');
assert.match(create, /async function __tmAppendBlockOnce[\s\S]*return await __tmBackendAdapter\.appendBlock/,
    'append writes must execute exactly once');
assert.match(create, /async function __tmInsertBlockOnce[\s\S]*return await __tmBackendAdapter\.insertBlock/,
    'insert writes must execute exactly once');
assert.doesNotMatch(create, /__tmShouldRetryBlockMutationError|__tmBackendAdapter\.flushTransaction\(\)/,
    'block writes must not retry behind a global transaction flush');
assert.match(api, /function __tmBuildAtomicCreateAttrs\(taskId, patch\)[\s\S]*__tmBuildAttrPayloadFromPatch\(sourcePatch\)/,
    'initial task fields must be encoded into the pre-generated task DOM');
assert.match(api, /const taskElements = Array\.from\(host\.querySelectorAll\('\[data-type="NodeListItem"\]'\)\)\.filter[\s\S]*taskElements\.length !== 1/,
    'stable task DOM must reject content that expands into zero or multiple task items');
assert.match(api, /\['SetProtyleWYSIWYG', true\],[\s\S]*\['SetBlockRef', true\],[\s\S]*\['SetDataTask', true\]/,
    'stable task DOM must parse inline block references before inserting generated DOM');
assert.match(api, /if \(!\/\^\\d\{14\}-\[a-z0-9\]\{7\}\$\/i\.test\(taskId\)/,
    'stable task DOM must only accept a SiYuan-generated node ID');
assert.match(create, /API\.generateTaskDOM\(stableTaskId, text, __tmIsTaskMarkerDone\(initialMarker\), \{ attrs: initialAttrs \}\)/,
    'task creation must commit content and initial fields in the same block transaction');
assert.doesNotMatch(api, /__tmQueueCreateOpPostInsertAttrs|__tmRecoverQueuedCreateOpRealId/,
    'task creation must not retain a post-insert repair write or real-ID probe loop');
assert.doesNotMatch(create, /__tmMarkLocalCreateTxSuppressionIds/,
    'create transaction events must reach the authoritative incremental refresh path');
assert.doesNotMatch(optimisticPresentation, /__tmMarkLocalMoveTxSuppressionIds/,
    'move transaction events must not be discarded after optimistic projection');
assert.match(list, /type: 'moveTask'/);
assert.doesNotMatch(api + list, /atMostOnceVersion|coalesceKey:/,
    'one-shot operations must not carry durable-queue merge or replay metadata');
assert.match(api, /restoreDeleted'[\s\S]*result\?\.ok !== true[\s\S]*throw new Error/,
    'a skipped restore must fail the mutation so its optimistic snapshot is rolled back');

const optimisticCreateTask = { id: 'temp-task', content: 'Created task', root_id: 'doc-1' };
const createSnapshotContext = vm.createContext({
    __tmNormalizeQueuedKernelTaskSnapshot: (task) => task ? { ...task } : null,
});
createSnapshotContext.__tmTaskStore = {
    getProjected: (id) => id === 'temp-task' ? optimisticCreateTask : null,
};
vm.runInContext(`${resolveCreateSnapshot}\nthis.resolveCreateSnapshot = __tmResolveQueuedCreateTaskSnapshot;`, createSnapshotContext);
const createdSnapshot = createSnapshotContext.resolveCreateSnapshot({
    requestedTaskId: '20260807180000-abcdefg',
    tempId: 'temp-task',
}, '20260807180000-abcdefg');
assert.equal(createdSnapshot.id, '20260807180000-abcdefg',
    'a successful create must return its optimistic snapshot under the pre-generated kernel ID');
assert.equal(createdSnapshot.content, 'Created task');
assert.equal(optimisticCreateTask.id, 'temp-task', 'normalizing a create receipt must not mutate the optimistic source');
assert.doesNotMatch(resolveCreateSnapshot, /state\.(?:pendingInsertedTasks|flatTasks)|__tmRuntimeState/,
    'create receipt normalization must read its optimistic source only through TaskStore');
assert.equal((api.match(/__tmResolveQueuedCreateTaskSnapshot\(payload, effectiveTaskId\)/g) || []).length, 3,
    'all three create commands must use the same receipt normalizer');

const pendingDeleteStore = {};
const pendingDeleteContext = vm.createContext({
    Date,
    __tmTaskStore: { getPendingDeletedMap: () => pendingDeleteStore },
});
vm.runInContext(`${ensurePendingDeletedStore}\n${rememberPendingDeleted}\n${forgetPendingDeleted}\nthis.remember = __tmRememberPendingDeletedTaskIds;\nthis.forget = __tmForgetPendingDeletedTaskIds;`, pendingDeleteContext);
pendingDeleteContext.remember(['task-root', 'task-child'], { rootTaskId: 'task-root' });
pendingDeleteContext.forget('task-root');
assert.deepEqual(pendingDeleteStore, {}, 'restoring a deleted root must clear pending-delete markers for its subtree');

const executedLifecycleActions = [];
const executeContext = vm.createContext({
    __tmIsMutationTaskPendingDeleted: () => true,
    __tmTaskLifecycle: {
        execute: async (data) => {
            executedLifecycleActions.push(data.action);
            return { ok: true, action: data.action };
        },
    },
});
vm.runInContext(`${canRunDuringPendingDelete}\nasync ${executeQueuedOp}\nthis.executeQueuedOp = __tmExecuteQueuedOp;`, executeContext);

(async () => {
    const blockedFieldResult = await executeContext.executeQueuedOp({
        type: 'taskPatch',
        data: { taskId: 'task-root', patch: { pinned: true } },
    });
    assert.equal(blockedFieldResult.reason, 'pending-delete', 'ordinary writes must remain blocked during pending deletion');
    const restoreResult = await executeContext.executeQueuedOp({
        type: 'taskLifecycle',
        data: { taskId: 'task-root', action: 'restoreDeleted' },
    });
    assert.equal(restoreResult.ok, true, 'restoreDeleted must pass through the pending-delete guard');
    assert.deepEqual(executedLifecycleActions, ['restoreDeleted']);

    const clearedPendingDeleteIds = [];
    const publishedCommits = [];
    const commitContext = vm.createContext({
        __tmForgetPendingDeletedTaskIds: (ids) => clearedPendingDeleteIds.push(ids),
        __tmPublishQueuedOpMutation: (op, phase, detail) => publishedCommits.push({ op, phase, detail }),
    });
    vm.runInContext(`${commitQueuedOp}\nthis.commitQueuedOp = __tmCommitQueuedOp;`, commitContext);
    commitContext.commitQueuedOp({
        type: 'taskLifecycle',
        data: { taskId: 'task-root', action: 'restoreDeleted' },
    }, { ok: true, action: 'restoreDeleted' });
    assert.deepEqual(clearedPendingDeleteIds, ['task-root'], 'restore commit must clear the delete watermark');
    assert.equal(publishedCommits[0]?.phase, 'commit', 'restore commit must reach the shared projection pipeline');

    console.log('simple mutation service contract tests passed');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
