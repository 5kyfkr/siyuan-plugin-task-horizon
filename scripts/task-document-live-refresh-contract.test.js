'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const stores = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', '10-stores-rules-and-cache.js'), 'utf8');
const services = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', '20-api-and-runtime-services.js'), 'utf8');
const dialogs = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', '30-dialogs-and-ui-foundation.js'), 'utf8');

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
assert.match(eventHandler, /hiddenDocOnly: true/, 'hidden hosts must retain document dirtiness without block-level work');
assert.match(eventHandler, /allowDetailedTxInspection = txTargets\.truncated !== true && txTargets\.wholeScopeDirty !== true/, 'oversized transactions must skip repeated deep inspection');
assert.doesNotMatch(eventHandler, /__tmInvalidateAllSqlCaches\(\)/, 'targeted transactions must not clear every SQL cache');
const genericTxTail = segment(eventHandler, 'if (!__tmAddBoundedTaskTxIds(', '__tmScheduleBatchedTaskIncrementalRefreshFromTx(null, {');
assert.doesNotMatch(genericTxTail, /__tmScheduleCalendarRefetchFromTx/, 'unclassified text edits must not preemptively refresh the calendar');
assert.doesNotMatch(stores, /__tmLogTaskLiveRefresh|__tmDescribeWsMainTaskTxOperations|\[task-horizon\]\[live-refresh\]/, 'temporary live-refresh diagnostics must not remain in production source');

const taskIncremental = segment(
    stores,
    'async function __tmRefreshAffectedTaskBlocksIncrementally',
    'function __tmCountLoadedDocTasksForQueryLimit',
);
assert.match(taskIncremental, /if \(opts\.committed !== true\)[\s\S]*__tmFlushSqlTransactionsSafe/);
assert.match(taskIncremental, /documentContentPatch = opts\.committed === true[\s\S]*__tmReadLiveDocumentTaskContentPatch\(taskId\)/, 'committed task edits must use the current document DOM before a lagging SQL index');
assert.match(taskIncremental, /nextTask\.content = documentContentPatch\.content;[\s\S]*nextTask\.markdown = documentContentPatch\.markdown;/, 'the document DOM patch must update both plain content and its render source');
assert.match(taskIncremental, /__tmHasActiveLocalTaskFieldWrite\(taskId, \['content', 'markdown'\]\)/, 'committed document content may retain a watermark only while a local write is active');
assert.match(taskIncremental, /__tmClearLocalTaskPatchWatermark\(taskId, \{ content: '', markdown: '' \}\)/, 'committed document content must clear stale title watermarks');
assert.match(taskIncremental, /excludeFields:[\s\S]*\['content', 'markdown'\]/, 'fresh committed content must bypass stale content and markdown watermarks');

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
const mergedCommitted = mergeWatermarkRuntime(
    { id: 'task1', content: 'fresh title', markdown: '* fresh title', priority: 'low' },
    { excludeFields: ['content', 'markdown'] },
);
assert.equal(mergedCommitted.content, 'fresh title', 'committed document content must survive a stale local watermark');
assert.equal(mergedCommitted.markdown, '* fresh title', 'committed document markdown must survive a stale local watermark');
assert.equal(mergedCommitted.priority, 'high', 'unrelated optimistic fields must remain protected');

const liveDocumentContentSource = segment(
    stores,
    'function __tmReadLiveDocumentTaskContentPatch',
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
assert.match(docIncremental, /if \(opts\.committed !== true\)[\s\S]*__tmFlushSqlTransactionsSafe/);
assert.match(services, /options\?\.committed === true \? 0 : 80/, 'committed transactions must skip the extra settle delay');
assert.match(services, /ignoreAutoRefreshInFlight: true/, 'the late gate must not reject the refresh that owns the in-flight flag');
assert.match(dialogs, /opts\.ignoreAutoRefreshInFlight !== true && __tmTabEnterAutoRefreshInFlight/);
assert.match(stores, /generation !== __tmTxTaskRefreshGeneration\) return false;/, 'an in-flight refresh must not clear newer edits');
assert.match(stores, /__tmTxTaskRefreshAttemptCount >= __TM_TASK_TX_MAX_REFRESH_ATTEMPTS/, 'failed refreshes must park instead of polling forever');

console.log('task document live refresh contract tests passed');
