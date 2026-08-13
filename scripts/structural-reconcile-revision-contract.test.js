'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const runtime = read('src/task-horizon/main/20-api-and-runtime-services.js');
const stores = read('src/task-horizon/main/10-stores-rules-and-cache.js');

const segment = (source, start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(from, -1, `missing segment start: ${start}`);
    assert.notEqual(to, -1, `missing segment end: ${end}`);
    return source.slice(from, to);
};

const enqueue = segment(runtime, 'function __tmEnqueueSimpleMutation', 'function __tmEnqueueQueuedOp');
const reconcile = segment(runtime, 'function __tmRefreshQueuedStructuralProjection', 'function __tmCommitQueuedOp');
const commit = segment(runtime, 'function __tmCommitQueuedOp', 'function __tmRemapQueuedOpTaskReferences');
const taskBlockIncremental = segment(stores, 'async function __tmRefreshAffectedTaskBlocksIncrementally', 'function __tmCountLoadedDocTasksForQueryLimit');
const incremental = segment(stores, 'async function __tmRefreshAffectedDocsIncrementally', 'async function __tmFlushSqlTransactionsSafe');
const classifyTxRefresh = segment(stores, 'async function __tmClassifyPendingTaskTxRefresh', 'function __tmApplyDoneOverrideToTaskIfPresent');
const flushTxRefresh = segment(stores, 'async function __tmFlushTaskIncrementalRefreshFromTx', 'function __tmRequestCalendarRefresh');
const autoRefresh = segment(runtime, 'async function __tmRunAutoRefreshIfNeeded', 'function __tmScheduleSilentRefreshAfterQuickbarUpdate');

assert.match(runtime, /const __tmStructuralMutationRevisions = new Map\(\)/,
    'structural mutations must share one in-memory revision source');
assert.match(runtime, /function __tmBumpStructuralMutationRevision\(op\)[\s\S]*op\.__tmStructuralRevision = token/,
    'each structural operation must retain the revision captured at enqueue');
assert.match(runtime, /let __tmStructuralMutationRevisionSeq = 0[\s\S]*const revision = \+\+__tmStructuralMutationRevisionSeq/,
    'released revision keys must use a monotonic sequence so stale tokens cannot become current again');
assert.match(runtime, /function __tmReleaseStructuralMutationRevision\(token\)[\s\S]*__tmStructuralMutationRevisions\.delete\(normalizedKey\)/,
    'settled structural mutations must release their in-memory revision entries');
assert.match(reconcile, /__tmStructuralCorrectionPromise = correctionPromise/,
    'rollback correction must retain its revision until the authoritative read finishes');
assert.match(enqueue, /__tmBumpStructuralMutationRevision\(op\)[\s\S]*__tmApplySimpleOptimisticPresentation\(op\)/,
    'the revision must advance before the optimistic structural projection is exposed');
assert.match(reconcile, /!__tmIsStructuralMutationRevisionCurrent\(revisionToken\)[\s\S]*isCurrent: revisionToken[\s\S]*__tmIsStructuralMutationRevisionCurrent\(revisionToken\)/,
    'authoritative reconciliation must reject stale operations before and during its query');
assert.match(reconcile, /structural-reconcile-failed[\s\S]*任务回滚后的视图校正失败/,
    'the single rollback reconcile must remain observable when it fails');
assert.doesNotMatch(reconcile, /setTimeout|__tmScheduleSimpleStructuralRefresh/,
    'rollback reconciliation must not start a retry loop');
assert.doesNotMatch(reconcile, /committed:\s*true/,
    'structural reconciliation must keep the existing SQL visibility barrier');
assert.doesNotMatch(commit, /__tmRefreshQueuedStructuralProjection|__tmScheduleSimpleStructuralRefresh/,
    'successful structural commits must rely on optimistic state plus the SiYuan transaction event');

assert.match(incremental, /const guardCurrent = \(\) =>[\s\S]*await __tmFlushSqlTransactionsSafe[\s\S]*if \(!guardCurrent\(\)\) return false/,
    'the revision must be checked after the SQL visibility wait');
assert.match(incremental, /queryTasks = \(\) => API\.getTasksByDocuments[\s\S]*let res = await queryTasks\(\)[\s\S]*if \(!guardCurrent\(\) \|\| !taskStoreReadCurrent\(\)\) return false/,
    'the structural revision and TaskStore read token must be checked after the document query');
assert.match(taskBlockIncremental, /const guardCurrent = \(\) =>[\s\S]*await API\.getTaskById\(taskId\)[\s\S]*if \(!guardCurrent\(\) \|\| !taskStoreReadCurrent\(\)\) return false/,
    'the task-block fast path must reject a stale structural revision before applying local state or DOM');
assert.match(incremental, /__tmRefreshAffectedTaskBlocksIncrementally\(\{[\s\S]*skipFlush:\s*true/,
    'the task-block fast path must reuse the outer SQL visibility barrier instead of flushing twice');
assert.match(incremental, /const docReplacements = \[\][\s\S]*docReplacements\.push\(\{ docId, nextDoc, shouldKeepDoc \}\)[\s\S]*state\.taskTree = nextTaskTree/,
    'document replacements must be staged before one synchronous state commit');
assert.doesNotMatch(
    segment(incremental, 'const docReplacements = []', 'let nextTaskTree ='),
    /state\.taskTree\s*(?:\[|=|\.push|\.splice)/,
    'async document assembly must not partially mutate the mounted task tree',
);
assert.match(incremental, /__tmMergeLocalTaskPatchIntoTask\(task\)/,
    'authoritative structural rows must retain newer optimistic field watermarks');
assert.match(incremental, /viewMode === 'checklist'[\s\S]*__tmChecklistProjectionGroupRefreshTaskIds[\s\S]*__tmScheduleViewRefresh/,
    'checklist reconciliation must stage affected task groups before the existing in-place refresh');
assert.match(classifyTxRefresh, /const preserveExistingSiblingOrder = meta\.structural !== true[\s\S]*resolved\.needsDocRefresh === true[\s\S]*preserveExistingSiblingOrder,/,
    'large non-structural transaction batches must retain sibling order independently of requiring a document read');
assert.match(flushTxRefresh, /preserveExistingSiblingOrder: classified\.preserveExistingSiblingOrder === true/,
    'the transaction flush must forward the sibling-order policy');
assert.match(autoRefresh, /preserveExistingSiblingOrder: options\?\.preserveExistingSiblingOrder === true/,
    'auto refresh must forward the sibling-order policy to incremental document refresh');
assert.match(incremental, /opts\.preserveExistingSiblingOrder === true && !forcePositionRank && existingDoc[\s\S]*__tmSortTaskTreeByExistingOrder\(rootTasks, existingDoc\.tasks, siblingOrderRanks\)[\s\S]*else if \(preferResolvedFlowOrder\)/,
    'non-structural document reads must preserve the previous tree while structural rank refreshes bypass it');

console.log('structural reconcile revision contract tests passed');
