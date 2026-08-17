const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const store = fs.readFileSync(path.join(root, 'src/task-horizon/main/32-runtime-state-and-events.js'), 'utf8');
const cache = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const services = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const loader = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53c-document-loader-runtime.js'), 'utf8');

const segment = (source, start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(from, -1, `missing segment start: ${start}`);
    assert.notEqual(to, -1, `missing segment end: ${end}`);
    return source.slice(from, to);
};

assert.match(store, /const pendingStructuralMutations = new Map\(\)/);
assert.match(store, /const rememberPendingStructuralMutation = \(mutation = \{\}\) =>/);
assert.match(store, /phase === 'rollback' \|\| phase === 'failed'/);
assert.match(store, /type === 'commitTaskId'/);
assert.match(store, /createTaskInDoc' \|\| type === 'createSubtask' \|\| type === 'createSibling'/);
assert.match(store, /const mergePendingStructuralRows = \(rows, options = \{\}\) =>/);
assert.match(store, /const getExpectedMoveNeighbors = \(data = \{\}\) =>/);
assert.match(store, /expectedPreviousSiblingId: neighbors\.previous/);
assert.match(store, /expectedNextSiblingId: neighbors\.next/);
assert.match(store, /expectedParentListId/);
assert.match(store, /hasExpectedPreviousSibling: !!placement/);
assert.match(store, /if \(row && docMatches && parentMatches && parentListMatches && previousMatches && nextMatches\)[\s\S]*pendingStructuralMutations\.delete\(taskId\)/);
assert.match(store, /__tmPendingStructural: true/);
assert.match(store, /entry\.type !== 'moveTask' && !docMatches/);
assert.match(store, /entry\.type !== 'moveTask' && !parentMatches/);
assert.match(store, /try \{ rememberPendingStructuralMutation\(normalized\); \} catch \(e\) \{\}/);
assert.match(store, /mergePendingStructuralRows,/);

const deletedBlockExtractorSource = segment(
    cache,
    'function __tmExtractDeletedBlockIdsFromTx',
    'function __tmShouldIgnoreWsMainTaskRefreshMessage',
);
const extractDeletedBlockIds = new Function('__tmIsLikelyBlockId', '__tmGetWsMainTaskTxDetail', `
    ${deletedBlockExtractorSource}
    return __tmExtractDeletedBlockIdsFromTx;
`)(
    (id) => /^[0-9]+-[a-zA-Z0-9]+$/.test(String(id || '').trim()),
    (msg) => msg?.detail || msg || {},
);
const deletedIds = extractDeletedBlockIds({
    detail: {
        data: [{
            doOperations: [
                { action: 'delete', id: '20260810102523-task002' },
                { action: 'deleteBlock', blockID: '20260810102523-task003' },
                { action: 'remove', srcIDs: ['20260810102523-task004'] },
            ],
            undoOperations: [{ action: 'delete', id: '20260810102523-inverse' }],
        }],
    },
});
assert.deepEqual(Array.from(deletedIds), [
    '20260810102523-task002',
    '20260810102523-task003',
    '20260810102523-task004',
], 'only executed document delete operations should cancel pending create protection');
assert.match(cache, /txTargets\.deletedBlockIds[\s\S]*clearPendingStructural[\s\S]*removePending/);

assert.match(cache, /rows = globalThis\.__tmTaskStore\?\.mergePendingStructuralRows\?\.\(rows, \{/);
assert.match(cache, /docIds,[\s\S]*incremental-doc-refresh/);
const moveCommit = segment(services, 'function __tmCommitQueuedOp', 'function __tmRemapQueuedOpTaskReferences');
const moveAcknowledgement = segment(services, 'function __tmAcknowledgeSimpleMutationResult', "if (!['contentPatch', 'taskPatch'].includes(type))");
const queuedMoveKernel = segment(services, 'async function __tmExecuteQueuedMoveKernel', 'async function __tmMoveTaskToPlacement');
const childListLookup = segment(services, 'async getChildListIdOfTask', 'async getDirectChildTaskIdsOfTaskByDom');
assert.match(childListLookup, /this\.getChildBlocks\(tid\)/,
    'the next child move must see a just-created list directly from the block tree');
assert.doesNotMatch(childListLookup, /api\/query\/sql|SELECT id FROM blocks/,
    'child-list discovery must not wait for the SQL index');
assert.match(queuedMoveKernel, /targetListID: String\(payload\.targetListId \|\| ''\)\.trim\(\)/,
    'the frontend must pass its known target list as a live-verification hint to the kernel');
assert.match(moveCommit, /applyLocal: op\?\.optimisticApplied !== true/,
    'the kernel receipt must apply locally only when the optimistic move did not reach the task tree');
assert.doesNotMatch(moveCommit, /clearPendingStructural/,
    'the move overlay must survive the HTTP receipt until SQL reaches the confirmed placement');
assert.doesNotMatch(moveAcknowledgement, /clearPendingStructural/,
    'field acknowledgement must not clear structural protection early');
assert.match(store, /expiresAt: now \+ 45000/,
    'committed moves need a bounded overlay while the SQL index catches up');

const pendingRuntimeSource = segment(
    store,
    'const prunePendingStructuralMutations',
    'const getModal',
);
const localTasks = new Map([['task-1', {
    id: 'task-1', root_id: 'doc-new', docId: 'doc-new',
    parent_id: 'list-new', parentListId: 'list-new',
    parent_task_id: 'parent-new', parentTaskId: 'parent-new',
}]]);
const pendingRuntime = new Function('getTaskById', `
    const normalizeId = (value) => String(value || '').trim();
    const pendingStructuralMutations = new Map();
    ${pendingRuntimeSource}
    return { rememberPendingStructuralMutation, mergePendingStructuralRows, pendingStructuralMutations };
`)((taskId) => localTasks.get(String(taskId || '').trim()) || null);
pendingRuntime.rememberPendingStructuralMutation({
    type: 'moveTask',
    phase: 'commit',
    taskId: 'task-1',
    data: { mode: 'child', targetTaskId: 'parent-new', snapshot: { docId: 'doc-old' } },
    placement: {
        taskID: 'task-1', documentID: 'doc-new', parentListID: 'list-new', parentTaskID: 'parent-new',
        previousSiblingID: '', nextSiblingID: '',
    },
});
const protectedRows = pendingRuntime.mergePendingStructuralRows([{
    id: 'task-1', root_id: 'doc-old', parent_id: 'list-old', parent_task_id: 'parent-old', doc_seq: 1,
}], { docIds: ['doc-old', 'doc-new'] });
assert.equal(protectedRows[0].root_id, 'doc-new');
assert.equal(protectedRows[0].parent_id, 'list-new');
assert.equal(protectedRows[0].parent_task_id, 'parent-new');
assert.equal(protectedRows[0].__tmPendingStructural, true,
    'a stale SQL row must not overwrite the confirmed tree placement');
assert.equal(pendingRuntime.pendingStructuralMutations.has('task-1'), true);
const confirmedRows = pendingRuntime.mergePendingStructuralRows([{
    id: 'task-1', root_id: 'doc-new', parent_id: 'list-new', parent_task_id: 'parent-new', doc_seq: 1,
}], { docIds: ['doc-new'] });
assert.equal(confirmedRows[0].__tmPendingStructural, undefined);
assert.equal(pendingRuntime.pendingStructuralMutations.has('task-1'), false,
    'the structural overlay must clear only after SQL matches the confirmed tree placement');

const loaderReadCurrent = loader.indexOf('taskStoreReadToken && globalThis.__tmTaskStore?.isReadCurrent?.(taskStoreReadToken) !== true');
const loaderMergePending = loader.indexOf('mergePendingStructuralRows?.(res.tasks');
const loaderReplaceFlat = loader.indexOf('replaceFlat?.(nextFlatTasks');
assert.ok(loaderReadCurrent >= 0 && loaderMergePending > loaderReadCurrent,
    'full document reads must reject stale revisions before merging pending structural rows');
assert.ok(loaderReplaceFlat > loaderMergePending,
    'full document reads must preserve pending creates and moves before authoritative TaskStore replacement');

console.log('pending structural mutation contract tests passed');
