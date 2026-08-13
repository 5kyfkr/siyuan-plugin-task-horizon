'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const stores = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', '10-stores-rules-and-cache.js'), 'utf8');
const services = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', '20-api-and-runtime-services.js'), 'utf8');
const dialogs = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', '30-dialogs-and-ui-foundation.js'), 'utf8');
const listRuntime = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', 'task-runtime', '53-list-render-and-document-loader.js'), 'utf8');
const calendarRuntime = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', 'render', '48-render-calendar-support-runtime.js'), 'utf8');
const refreshRuntime = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', 'render', '39-render-doc-group-sync-and-refresh.js'), 'utf8');
const documentLoaderRuntime = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', 'task-runtime', '53c-document-loader-runtime.js'), 'utf8');

const segment = (source, start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(from, -1, `missing segment start: ${start}`);
    assert.notEqual(to, -1, `missing segment end: ${end}`);
    return source.slice(from, to);
};

const summarySource = segment(stores, 'function __tmIsLikelyBlockId', 'function __tmExtractBlockIdsFromTx');
const summaryRuntime = new Function(`
    const __TM_TASK_TX_OPERATION_LIMIT = 240;
    const __TM_TASK_TX_BLOCK_ID_LIMIT = 256;
    const __TM_TASK_TX_DOC_ID_LIMIT = 32;
    ${summarySource}
    return { summarize: __tmSummarizeWsMainTaskTx };
`)();

const docId = '20260804120000-docroot';
const operations = Array.from({ length: 300 }, (_, index) => ({
    action: 'update',
    id: `2026080412${String(index).padStart(4, '0')}-block${index}`,
}));
const largeSummary = summaryRuntime.summarize({
    detail: {
        cmd: 'transactions',
        context: { rootIDs: [docId] },
        data: [{ doOperations: operations, undoOperations: [] }],
    },
});
assert.deepEqual(Array.from(largeSummary.docIds), [docId], 'transaction context rootIDs must define the affected document');
assert.equal(largeSummary.operationCount, 240, 'a transaction summary must inspect at most 240 operations');
assert.equal(largeSummary.truncated, true, 'oversized transaction batches must degrade to a bounded refresh');
assert.ok(largeSummary.blockIds.size <= 256, 'pending block IDs must remain bounded');
assert.equal(largeSummary.committed, true, 'transactions events are committed kernel notifications');

const textSummary = summaryRuntime.summarize({
    detail: {
        cmd: 'transactions',
        context: { rootIDs: [docId] },
        data: [{ doOperations: [{ action: 'update', id: '20260804121000-paragraph' }] }],
    },
});
assert.equal(textSummary.structural, false, 'plain block updates must stay eligible for the single-task impact probe');
assert.deepEqual(Array.from(textSummary.blockIds), ['20260804121000-paragraph']);

assert.match(stores, /const __TM_TASK_TX_DEBOUNCE_MS = 180;/);
assert.match(stores, /const __TM_TASK_TX_MAX_WAIT_MS = 800;/);
assert.match(stores, /const __TM_TASK_TX_BLOCK_ID_LIMIT = 256;/);
assert.match(stores, /const __TM_TASK_TX_DOC_ID_LIMIT = 32;/);
assert.match(stores, /const __TM_TASK_TX_MAX_REFRESH_ATTEMPTS = 3;/);

const messageFilter = segment(
    stores,
    'function __tmShouldIgnoreWsMainTaskRefreshMessage',
    'async function __tmResolveDocIdsFromBlockIds',
);
assert.match(messageFilter, /return cmd !== 'transactions';/, 'savedoc must not create a second structural refresh path');

const localDoneSuppression = segment(
    stores,
    'function __tmShouldSuppressLocalDoneTx',
    'function __tmShouldSuppressLocalTimeTx',
);
assert.match(localDoneSuppression, /if \(!__tmHasOnlyAttrOperationsInTx\(payload\)\) return false;/, 'local done suppression must never swallow title or body transactions');
assert.match(localDoneSuppression, /if \(!updates\.length\) return false;/, 'a matching task or document ID is not enough to suppress a content transaction');

const batchScheduler = segment(
    stores,
    'function __tmScheduleBatchedTaskIncrementalRefreshFromTx',
    'function __tmScheduleTaskIncrementalRefreshFromTx',
);
assert.match(batchScheduler, /clearTimeout\(__tmWsTaskTxBatchTimer\)/, 'new edits must reset the trailing debounce timer');
assert.match(
    batchScheduler,
    /Math\.min\(__TM_TASK_TX_DEBOUNCE_MS, __TM_TASK_TX_MAX_WAIT_MS - ageMs\)/,
    'continuous edits must flush at the maximum wait instead of postponing forever',
);
assert.doesNotMatch(batchScheduler, /__tmGetExternalTaskTxQuietWaitMs/, 'bounded batching must not add a multi-second burst delay');

const refreshScheduler = segment(
    stores,
    'function __tmScheduleTaskIncrementalRefreshFromTx',
    'async function __tmFlushTaskIncrementalRefreshFromTx',
);
assert.match(refreshScheduler, /Number\.isFinite\(requestedDelayMs\)/, 'an explicit zero delay must run immediately after the 180ms batch window');
assert.doesNotMatch(refreshScheduler, /Number\(opts\.delayMs[^\n]+\|\| 280/, 'zero delay must not fall back to 280ms');

const autoRefresh = segment(
    services,
    'async function __tmRunAutoRefreshIfNeeded',
    'function __tmScheduleSilentRefreshAfterQuickbarUpdate',
);
assert.match(autoRefresh, /__tmRefreshCore\(\{[\s\S]*preserveExistingSiblingOrder:\s*options\?\.preserveExistingSiblingOrder === true/,
    'a non-structural transaction fallback must preserve the current sibling order');
assert.match(refreshRuntime, /forceSyncFlowRank:\s*authoritativeDocumentOrder \|\| !preserveExistingSiblingOrder,[\s\S]*preserveExistingSiblingOrder,/,
    'refresh core must only force a new document order for authoritative structural or manual refreshes');
assert.match(documentLoaderRuntime, /existingDoc = preserveExistingSiblingOrder[\s\S]*__tmSortTaskTreeByExistingOrder\(rootTasks, existingDoc\.tasks, siblingOrderRanks\)/,
    'a non-structural full reload must merge fresh fields without replacing sibling order');

const impactResolver = segment(
    stores,
    'async function __tmResolveLoadedTaskIdsFromBlockIds',
    'function __tmApplyDoneOverrideToTaskIfPresent',
);
assert.match(impactResolver, /API\.resolveTaskChangeImpacts\(unresolvedBlockIds\)/, 'unknown blocks must use one batch impact query');
assert.doesNotMatch(impactResolver, /await API\.getTaskById\(blockId\)/, 'impact detection must not query each changed block separately');
assert.doesNotMatch(impactResolver, /__tmResolveTaskIdFromAnyBlockId\(blockId\)/, 'impact detection must not walk ancestors with per-level requests');
assert.match(impactResolver, /if \(!resolved\?\.hasTaskImpact\)/, 'ordinary document updates must stop before a task refresh');

const apiResolver = segment(services, 'async resolveTaskChangeImpacts(ids)', 'async getOtherBlocksByIds(ids)');
assert.match(apiResolver, /WITH RECURSIVE task_ancestors/);
assert.match(apiResolver, /a\.depth < 16/);
assert.match(apiResolver, /\.slice\(0, 256\)/);
assert.match(apiResolver, /type = 'i' AND subtype = 't'/);

const eventHandler = segment(stores, '__tmSqlCacheEventBusHandler = (msg) => {', 'buses.forEach((eb) => {');
assert.match(eventHandler, /txTargets\.docIds = new Set\(loadedTargets\)/, 'known unrelated documents must leave the visible task scope early');
assert.match(eventHandler, /blockIds: Array\.from\(txTargets\.blockIds \|\| \[\]\)[\s\S]*hiddenDocOnly: true/,
    'hidden hosts must retain block targets so update-shaped task inserts can be recognized');
assert.match(eventHandler, /__tmScheduleTaskIncrementalRefreshFromTx\(null, \{[\s\S]*hiddenDocOnly: true,[\s\S]*source: 'ws-main-hidden'/,
    'hidden document transactions must schedule a data refresh instead of waiting for the manager tab');
assert.match(eventHandler, /allowDetailedTxInspection = txTargets\.truncated !== true && txTargets\.wholeScopeDirty !== true/, 'oversized transactions must skip repeated deep inspection');
assert.doesNotMatch(eventHandler, /__tmInvalidateAllSqlCaches\(\)/, 'targeted transactions must not clear every SQL cache');
const genericTxTail = segment(eventHandler, 'if (!__tmAddBoundedTaskTxIds(', '__tmScheduleBatchedTaskIncrementalRefreshFromTx(null, {');
assert.doesNotMatch(genericTxTail, /__tmScheduleCalendarRefetchFromTx/, 'unclassified text edits must not preemptively refresh the calendar');
assert.doesNotMatch(stores, /__tmLogTaskLiveRefresh|__tmDescribeWsMainTaskTxOperations|\[task-horizon\]\[live-refresh\]/, 'retired console-only live-refresh diagnostics must not return');
assert.doesNotMatch(stores, /__tmPushDocumentRefreshDiagnostic|__tmPushDiagnosticLog/,
    'temporary document refresh diagnostics must not ship in production runtime');
assert.match(refreshScheduler, /Array\.from\(blockIds \|\| \[\]\)[\s\S]*allowHiddenDataRefresh: hidden/,
    'the hidden scheduler must preserve block targets and allow a background data-only refresh');
assert.match(autoRefresh, /allowHiddenDataRefresh = options\?\.allowHiddenDataRefresh === true[\s\S]*if \(!allowHiddenDataRefresh && !__tmIsPluginVisibleNow\(\)\)/,
    'auto refresh must allow hidden data reconciliation while keeping the normal visibility gate');

const taskIncremental = segment(
    stores,
    'async function __tmRefreshAffectedTaskBlocksIncrementally',
    'function __tmCountLoadedDocTasksForQueryLimit',
);
assert.match(taskIncremental, /if \(opts\.committed !== true && opts\.skipFlush !== true\)[\s\S]*__tmFlushSqlTransactionsSafe/,
    'a standalone task refresh must flush, while a nested fast path may reuse the outer visibility barrier');
assert.match(taskIncremental, /documentContentPatch = opts\.committed === true[\s\S]*__tmReadLiveDocumentTaskContentPatch\(taskId\)/, 'committed task edits must use the current document DOM before a lagging SQL index');
assert.match(taskIncremental, /nextTask\.content = documentContentPatch\.content;[\s\S]*nextTask\.markdown = documentContentPatch\.markdown;/, 'the document DOM patch must update both plain content and its render source');
assert.match(taskIncremental, /taskIds\.forEach\(\(taskId\) => __tmCustomFieldAttrValueCache\.delete\(taskId\)\)[\s\S]*readWatermarkRevision[\s\S]*await API\.getTaskById\(taskId\)[\s\S]*__tmBuildAuthoritativeTaskConfirmationCandidate\(row,[\s\S]*__tmPrepareTaskBlockIncrementalRow\(row,[\s\S]*__tmConfirmLocalTaskPatchWatermarkFromTask\(taskId, authoritativeTask,[\s\S]*readWatermarkRevision[\s\S]*__tmMergeLocalTaskPatchIntoTask\(nextTask\)/,
    'a task refresh must confirm against the raw API row captured after its field revision, then merge remaining optimistic values into the presentation task');
assert.doesNotMatch(taskIncremental, /__tmClearLocalTaskPatchWatermark\(taskId, \{ content: '', markdown: '' \}\)|excludeFields/,
    'a committed transaction event must not unconditionally expose title fields to a lagging index');

const authoritativeCandidateSource = segment(
    stores,
    'function __tmBuildAuthoritativeTaskConfirmationCandidate',
    'function __tmPrepareTaskBlockIncrementalRow',
);
assert.doesNotMatch(authoritativeCandidateSource, /MetaStore|prevTask|normalizeTaskFields|__tmMergeVisibleDateFieldsFromPrevTask|__tmApplyDoneOverrideToTaskIfPresent/,
    'the confirmation candidate must never read presentation caches or optimistic overlays');
const buildAuthoritativeCandidate = new Function('API', '__tmNormalizeTaskStatusMarker', `
    ${authoritativeCandidateSource}
    return __tmBuildAuthoritativeTaskConfirmationCandidate;
`)(
    { parseTaskStatus: () => ({ done: false, content: 'stale SQL title', marker: ' ' }) },
    (marker) => marker,
);
const authoritativeCandidate = buildAuthoritativeCandidate({
    id: 'task1',
    markdown: '- [ ] stale SQL title',
    start_date: '2026-08-01',
    __customFieldRawValues: { owner: 'stale-owner' },
});
assert.equal(authoritativeCandidate.content, 'stale SQL title');
assert.equal(authoritativeCandidate.start_date, '2026-08-01', 'the candidate must retain the SQL date instead of a newer local fallback');
assert.deepEqual(authoritativeCandidate.__customFieldRawValues, { owner: 'stale-owner' });

const contentOptimisticPatch = segment(
    listRuntime,
    'function __tmApplyContentPatchLocally',
    'function __tmQueueMoveTask',
);
assert.match(contentOptimisticPatch, /__tmMarkLocalTaskPatchWatermark\(tid, presentationPatch/,
    'title edits must use the same field-level read-your-writes protection as metadata edits');

const confirmWatermarkSource = segment(
    stores,
    'function __tmConfirmLocalTaskPatchWatermarkFromTask',
    'function __tmMergeLocalTaskPatchIntoTask',
);
const clearedWatermarkFields = [];
let currentWatermark = {
    revision: 3,
    fields: ['content', 'priority'],
    values: { content: 'new title', priority: 'high' },
};
const confirmWatermark = new Function(
    '__tmGetLocalTaskPatchWatermark',
    '__tmNormalizeLocalPatchFieldKey',
    '__tmReadQueuedVerificationField',
    '__tmQueuedVerificationValuesMatch',
    '__tmClearLocalTaskPatchWatermarkFields',
    `${confirmWatermarkSource}; return __tmConfirmLocalTaskPatchWatermarkFromTask;`,
)(
    () => currentWatermark,
    (key) => String(key || '').trim(),
    (task, key) => task[key],
    (_key, actual, expected) => String(actual ?? '').trim() === String(expected ?? '').trim(),
    (_taskId, fields) => clearedWatermarkFields.push(...fields),
);
assert.deepEqual(confirmWatermark('task1', { id: 'task1', content: 'old title', priority: 'low' }), [],
    'a stale query must not confirm or clear any optimistic field');
assert.deepEqual(clearedWatermarkFields, [], 'a stale query must leave every field watermark intact');
assert.deepEqual(confirmWatermark('task1', { id: 'task1', content: 'new title', priority: 'high' }, { readWatermarkRevision: 2 }), [],
    'a query started before the latest local edit must not confirm fields even when values happen to match');
assert.deepEqual(clearedWatermarkFields, [], 'a superseded query must not release any field watermark');
assert.deepEqual(confirmWatermark('task1', { id: 'task1', content: 'new title', priority: 'low' }), ['content'],
    'an authoritative query must confirm fields independently');
assert.deepEqual(clearedWatermarkFields, ['content'], 'only the matching field may be released');

const verificationReaderSource = segment(
    services,
    'function __tmReadQueuedVerificationField',
    'function __tmQueuedVerificationValuesMatch',
);
const fieldSchemaSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/09-task-field-schema.js'), 'utf8');
const verificationContext = { Object, Array, String, Map, Set };
verificationContext.globalThis = verificationContext;
vm.runInNewContext(fieldSchemaSource, verificationContext, { filename: '09-task-field-schema.js' });
const readVerificationField = new Function('globalThis', `${verificationReaderSource}; return __tmReadQueuedVerificationField;`)(verificationContext);
assert.equal(readVerificationField(authoritativeCandidate, 'startDate'), '2026-08-01', 'raw SQL aliases must be readable without presentation normalization');
assert.equal(readVerificationField({ custom_priority: 'high' }, 'priority'), 'high');
assert.equal(readVerificationField({ custom_pinned: '' }, 'pinned'), '', 'cleared boolean attributes must remain authoritative blank values');
const clearedDateFields = [];
const confirmDateWatermark = new Function(
    '__tmGetLocalTaskPatchWatermark',
    '__tmNormalizeLocalPatchFieldKey',
    '__tmReadQueuedVerificationField',
    '__tmQueuedVerificationValuesMatch',
    '__tmClearLocalTaskPatchWatermarkFields',
    `${confirmWatermarkSource}; return __tmConfirmLocalTaskPatchWatermarkFromTask;`,
)(
    () => ({ revision: 7, fields: ['startDate'], values: { startDate: '2026-08-07' } }),
    (key) => String(key || '').trim(),
    readVerificationField,
    (_key, actual, expected) => String(actual ?? '').trim() === String(expected ?? '').trim(),
    (_taskId, fields) => clearedDateFields.push(...fields),
);
assert.deepEqual(confirmDateWatermark('task1', authoritativeCandidate, { readWatermarkRevision: 7 }), [],
    'a newer local or MetaStore date must not make the stale SQL date look confirmed');
assert.deepEqual(clearedDateFields, []);

const mergeWatermarkSource = segment(
    stores,
    'function __tmMergeLocalTaskPatchIntoTask',
    'function __tmMergeLocalTaskPatchIntoTaskList',
);
const mergeWatermarkRuntime = new Function(`
    const state = {
        flatTasks: {
            task1: { id: 'task1', content: 'old title', markdown: '* old title', priority: 'high' },
        },
        pendingInsertedTasks: {},
    };
    const __tmNormalizeLocalPatchFieldKey = (key) => String(key || '').trim();
    const __tmApplyDoneOverrideToTaskIfPresent = () => {};
    const __tmGetLocalTaskPatchWatermark = () => ({ fields: ['content', 'markdown', 'priority'] });
    const __tmIsTaskMarkerDone = () => false;
    ${mergeWatermarkSource}
    return __tmMergeLocalTaskPatchIntoTask;
`)();
const mergedWithoutExclusion = mergeWatermarkRuntime({ id: 'task1', content: 'fresh title', markdown: '* fresh title', priority: 'low' });
assert.equal(mergedWithoutExclusion.content, 'old title', 'local optimistic content remains protected by default');
assert.equal(mergedWithoutExclusion.markdown, '* old title', 'local optimistic render source remains protected by default');
assert.equal(mergedWithoutExclusion.priority, 'high', 'unrelated optimistic fields must remain protected independently');

const liveDocumentContentSource = segment(
    stores,
    'function __tmFindLiveDocumentTaskContentBlock',
    'function __tmCanPatchTaskBlockIncrementally',
);
class FakeElement {}
const editable = Object.assign(new FakeElement(), {
    textContent: 'fresh title\u200B',
    innerHTML: '<strong>fresh title</strong>',
});
const contentBlock = Object.assign(new FakeElement(), {
    getAttribute: (key) => key === 'data-type' ? 'NodeParagraph' : '',
    matches: () => false,
    querySelector: () => editable,
});
const taskItem = Object.assign(new FakeElement(), {
    children: [contentBlock],
    closest: () => ({}),
    querySelector: () => ({ getAttribute: (key) => key === 'href' ? '#iconUncheck' : '' }),
    classList: { contains: () => false },
});
const readLiveDocumentContent = new Function('globalThis', 'Element', 'document', `
    ${liveDocumentContentSource}
    return __tmReadLiveDocumentTaskContentPatch;
`)({ __tmCompat: { findTaskListItemById: () => taskItem } }, FakeElement, {});
const liveDocumentPatch = readLiveDocumentContent('20260804120000-taskid');
assert.equal(liveDocumentPatch.content, 'fresh title', 'live document content must remove editor caret characters');
assert.equal(liveDocumentPatch.markdown, '- [ ] <strong>fresh title</strong>', 'live document inline markup must remain available to the sidebar renderer');
assert.doesNotMatch(liveDocumentContentSource, /MutationObserver|setInterval/, 'the live document fast path must remain event-driven');

const taskDomPatch = segment(
    stores,
    'function __tmApplyTaskBlockDomPatches',
    'async function __tmRefreshAffectedTaskBlocksIncrementally',
);
assert.match(taskDomPatch, /if \(!hadEffectivePatch\) return true;/, 'an already-applied local done echo must not trigger a redundant full render');

const docIncremental = segment(
    stores,
    'async function __tmRefreshAffectedDocsIncrementally',
    'async function __tmFlushSqlTransactionsSafe',
);
assert.match(docIncremental, /if \(opts\.committed !== true \|\| opts\.forceDocRefresh === true\)[\s\S]*__tmFlushSqlTransactionsSafe/,
    'structural committed events must still cross a SQL visibility barrier');
assert.match(docIncremental, /readWatermarkRevisions = __tmCaptureLocalTaskPatchWatermarkRevisions\(\);[\s\S]*queryTasks = \(\) => API\.getTasksByDocuments[\s\S]*let res = await queryTasks\(\)[\s\S]*authoritativeTasksById[\s\S]*__tmBuildAuthoritativeTaskConfirmationCandidate\(row,[\s\S]*mergePendingStructuralRows[\s\S]*__tmConfirmLocalTaskPatchWatermarkFromTask\(taskId, authoritativeTask,[\s\S]*readWatermarkRevision: readWatermarkRevisions\.get\(taskId\) \|\| 0[\s\S]*__tmMergeLocalTaskPatchIntoTask\(task\)/,
    'full document queries must preserve raw confirmation rows before structural and presentation overlays');
assert.match(docIncremental, /upsertLocal\?\.\(task, \{[\s\S]*status: 'partial-index-reload',[\s\S]*replaceStructure: true/,
    'authoritative document refresh must replace empty child arrays instead of retaining deleted subtasks');
assert.match(stores, /const forceFresh = opts\.forceFresh === true;[\s\S]*const cacheSatisfied = !!\([\s\S]*!forceFresh/,
    'authoritative task queries must be able to bypass the custom-field value cache');
assert.match(services, /options\?\.committed === true \? 0 : 80/, 'committed transactions must skip the extra settle delay');
assert.match(services, /ignoreAutoRefreshInFlight: true/, 'the late gate must not reject the refresh that owns the in-flight flag');
assert.match(dialogs, /opts\.ignoreAutoRefreshInFlight !== true && __tmTabEnterAutoRefreshInFlight/);
assert.match(stores, /generation !== __tmTxTaskRefreshGeneration\) return false;/, 'an in-flight refresh must not clear newer edits');
assert.match(stores, /__tmTxTaskRefreshAttemptCount >= __TM_TASK_TX_MAX_REFRESH_ATTEMPTS/, 'failed refreshes must park instead of polling forever');

const protectedDocReload = segment(
    listRuntime,
    'async function reloadDocTasksProtected',
    'const __tmFreshTaskDetailDocReloads',
);
assert.match(protectedDocReload, /__tmRestoreTaskTreeFromMeta\(rootTasks\);[\s\S]*__tmSortTaskTreeByExistingOrder\(rootTasks, currentDoc\.tasks, siblingOrderRanks\)[\s\S]*acceptAuthoritative\?\.\(authoritativeTasks,[\s\S]*__tmMergeLocalTaskPatchIntoTaskTree\(\[\{ tasks: rootTasks \}\]\)/,
    'detail document reloads must preserve document order before replacing TaskStore and reapplying protected fields');
const calendarCacheLoad = segment(
    calendarRuntime,
    'async function __tmLoadAllTasksForCalendarCache',
    'function __tmCalendarTaskCacheIsFresh',
);
assert.match(calendarCacheLoad, /normalizeTaskFields\(task,[\s\S]*__tmMergeLocalTaskPatchIntoTask\(task\)[\s\S]*__tmAppendCalendarTaskAndRepeatHistory/,
    'calendar cache refreshes must not publish stale values over protected local fields');

console.log('task document live refresh contract tests passed');
