'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const root = path.join(__dirname, '../src/task-horizon/main');
const services = fs.readFileSync(path.join(root, '20-api-and-runtime-services.js'), 'utf8');
const stores = fs.readFileSync(path.join(root, '10-stores-rules-and-cache.js'), 'utf8');
function section(source, start, end) {
    const a = source.indexOf(start); const b = source.indexOf(end, a + start.length);
    assert.ok(a >= 0 && b > a, start); return source.slice(a, b);
}

function autoHarness({ incremental = 'success', quickbar = false, synced = false } = {}) {
    const calls = { incremental: 0, full: 0, cleared: 0 };
    const state = { externalTaskTxDirty: true, __tmSyncedDataReloadPending: synced, viewMode: 'kanban' };
    const context = vm.createContext({
        state, Set, Date, Promise,
        document: { querySelector: () => null },
        __tmTabEnterAutoRefreshLastTs: 0, __tmTabEnterAutoRefreshInFlight: false,
        __tmTxTaskRefreshDocIds: new Set(['doc']), __tmTxTaskRefreshBlockIds: new Set(['task']),
        __tmIsPluginVisibleNow: () => true,
        __tmHasAutoRefreshPendingSync: () => state.externalTaskTxDirty || quickbar || state.__tmSyncedDataReloadPending,
        __tmGetBusyTaskDetailBarrier: () => null,
        __tmGetEnterAutoRefreshDelayMeta: () => ({ shouldDelay: false }),
        __tmGetBackgroundRefreshGateMeta: () => ({ allowRun: true }),
        __tmHasQuickbarModificationsSync: () => quickbar,
        __tmHasExternalTaskTxDirtySync: () => state.externalTaskTxDirty,
        __tmClearPendingTxRefreshTargets: () => { calls.cleared++; return true; },
        __tmClearExternalTaskTxDirty: () => { state.externalTaskTxDirty = false; },
        __tmQuickbarDirtyTasksHaveLocalPatchWatermarks: () => false,
        __tmClearQuickbarModifications: () => { quickbar = false; },
        __tmFlushDeferredViewRefreshAfterTaskFieldWork() {},
        setTimeout: (callback) => { callback(); return 1; },
        __tmRefreshAffectedDocsIncrementally: async (options) => {
            calls.incremental++;
            if (incremental === 'deferred') { options.onDeferred?.('task-store-changed'); return false; }
            if (incremental === 'unsupported') return false;
            return true;
        },
        __tmRefreshCore: async () => { calls.full++; return true; },
    });
    vm.runInContext(section(services, 'async function __tmRunAutoRefreshIfNeeded(', 'function __tmScheduleSilentRefreshAfterQuickbarUpdate('), context);
    vm.runInContext(section(services, 'async function __tmMaybeAutoRefreshOnEnter(', 'function __tmIsTaskHorizonHostActiveForAutoRefresh('), context);
    return { context, state, calls };
}

test('returning to the plugin leaves pending websocket work with its existing coordinator', async () => {
    const h = autoHarness();
    let flushes = 0;
    h.context.__tmFlushTaskIncrementalRefreshFromTx = async () => { flushes++; return false; };
    assert.equal(await h.context.__tmMaybeAutoRefreshOnEnter('tabActivatedObserver'), false);
    assert.equal(flushes, 1);
    assert.equal(h.calls.incremental, 0, 'no second read while the websocket coordinator is deferred/in flight');
    assert.equal(h.calls.full, 0);
    assert.equal(h.state.externalTaskTxDirty, true, 'notification remains pending');
});

test('invalidated incremental reads keep dirty targets without escalating to a full scope reload', async () => {
    const h = autoHarness({ incremental: 'deferred' });
    assert.equal(await h.context.__tmRunAutoRefreshIfNeeded('ws-main-batch', { committed: true }), false);
    assert.deepEqual(h.calls, { incremental: 1, full: 0, cleared: 0 });
    assert.equal(h.state.externalTaskTxDirty, true);
});

test('an ordinary external edit still refreshes its affected documents and clears its notification', async () => {
    const h = autoHarness();
    assert.equal(await h.context.__tmRunAutoRefreshIfNeeded('ws-main-batch', { committed: true }), true);
    assert.deepEqual(h.calls, { incremental: 1, full: 0, cleared: 1 });
    assert.equal(h.state.externalTaskTxDirty, false);
});

test('unsupported scope retains the full refresh fallback', async () => {
    const h = autoHarness({ incremental: 'unsupported' });
    assert.equal(await h.context.__tmRunAutoRefreshIfNeeded('ws-main-batch', { committed: true }), true);
    assert.equal(h.calls.full, 1);
    assert.equal(h.state.externalTaskTxDirty, false);
});

test('independent pending shared-data changes still refresh after websocket work completes', async () => {
    const h = autoHarness({ synced: true });
    h.context.__tmFlushTaskIncrementalRefreshFromTx = async () => { h.state.externalTaskTxDirty = false; return true; };
    assert.equal(await h.context.__tmMaybeAutoRefreshOnEnter('focus'), true);
    assert.equal(h.calls.full, 1);
    assert.equal(h.state.__tmSyncedDataReloadPending, false);
});

test('a stale document read reports deferral before issuing another backend query', async () => {
    const reasons = []; let flushes = 0;
    const context = vm.createContext({
        state: { viewMode: 'kanban', modal: {} }, document: { body: { contains: () => true } },
        __tmFlushSqlTransactionsSafe: async () => { flushes++; },
    });
    vm.runInContext(section(stores, 'async function __tmRefreshAffectedDocsIncrementally(', 'let __tmSqlTransactionFlushInFlight'), context);
    const result = await context.__tmRefreshAffectedDocsIncrementally({
        docIds: ['doc'], isCurrent: () => false, onDeferred: (reason) => reasons.push(reason),
    });
    assert.equal(result, false); assert.equal(flushes, 0);
    assert.deepEqual(reasons, ['structural-revision-changed']);
});

test('a stale task-only read cannot fall through to a wider document read', async () => {
    const reasons = []; let documentReads = 0;
    const context = vm.createContext({
        state: { viewMode: 'kanban', modal: {} }, document: { body: { contains: () => true } },
        __tmRefreshAffectedTaskBlocksIncrementally: async (options) => { options.onDeferred?.('task-store-changed'); return false; },
        __tmResolveIncrementalRefreshDocIds: async () => { documentReads++; return ['doc']; },
    });
    vm.runInContext(section(stores, 'async function __tmRefreshAffectedDocsIncrementally(', 'let __tmSqlTransactionFlushInFlight'), context);
    const result = await context.__tmRefreshAffectedDocsIncrementally({ committed: true, onDeferred: (reason) => reasons.push(reason) });
    assert.equal(result, false); assert.equal(documentReads, 0);
    assert.deepEqual(reasons, ['task-store-changed']);
});

test('a mutation during an awaited document read stops further reads and preserves the pending notification', async () => {
    const h = autoHarness();
    const task = { id: 'task', root_id: 'doc', docId: 'doc', children: [] };
    Object.assign(h.state, { flatTasks: { task }, pendingInsertedTasks: {}, pendingDeletedTasks: {},
        taskTree: [], filteredTasks: [], otherBlocks: [], doneOverrides: {}, modal: {} });
    Object.assign(h.context, {
        Map, Symbol, console, SettingsStore: { data: {} },
        document: { body: { contains: () => true }, querySelector: () => null },
        __tmFlushSqlTransactionsSafe: async () => true,
        __tmResolveIncrementalRefreshDocIds: async () => ['doc'],
        __tmCaptureEditorDocumentTaskOrder: () => [],
        __tmInvalidateTasksQueryCacheByDocId() {},
        __tmGetIncrementalTaskQueryLimit: () => 100,
        __TM_TASK_INDEX_QUERY_LIMIT: 1000,
        __tmBuildLoadedDocumentTaskIdMap: () => new Map(),
        __tmBuildTaskEnhanceLoadPlan: () => ({ customFieldLoadPlan: { bulkFieldIds: [] } }),
        __tmCaptureLocalTaskPatchWatermarkRevisions: () => new Map(),
    });
    vm.runInContext(fs.readFileSync(path.join(root, '32-runtime-state-and-events.js'), 'utf8'), h.context);
    h.context.__tmTaskStore.acceptAuthoritative([task], { docIds: ['doc'], replaceDocuments: true });
    let reads = 0;
    h.context.API = { getTaskFreshnessByDocuments: async () => ({ map: new Map([['doc', { docUpdated: '20261023123000' }]]) }),
        getTasksByDocuments: async () => {
        reads++;
        h.context.__tmTaskStore.applyMutation({ type: 'taskPatch', phase: 'optimistic',
            opId: 'newer-edit', taskId: 'task', docId: 'doc', patch: { priority: 'high' } }, { applyLocal: false });
        return { tasks: [task], limitReachedDocIds: ['doc'] };
    } };
    vm.runInContext(section(stores, 'async function __tmRefreshAffectedDocsIncrementally(', 'let __tmSqlTransactionFlushInFlight'), h.context);
    assert.equal(await h.context.__tmRunAutoRefreshIfNeeded('ws-main-batch', {
        committed: true, forceDocRefresh: true,
    }), false);
    assert.equal(reads, 1, 'discard a stale result before retrying with a larger limit');
    assert.equal(h.calls.full, 0);
    assert.equal(h.state.externalTaskTxDirty, true);
    assert.equal(h.context.__tmTaskStore.getProjected('task').priority, 'high');
});

test('a notification arriving during refresh survives until its own refresh completes', async () => {
    const h = autoHarness();
    Object.assign(h.context, { __tmTxTaskRefreshGeneration: 1, __tmTxTaskRefreshMeta: {}, __tmTxTaskRefreshAttemptCount: 0 });
    vm.runInContext(section(stores, 'function __tmClearPendingTxRefreshTargets(', 'async function __tmResolveIncrementalRefreshDocIds('), h.context);
    h.context.__tmRefreshAffectedDocsIncrementally = async () => {
        h.context.__tmTxTaskRefreshGeneration = 2;
        h.context.__tmTxTaskRefreshDocIds.add('other-doc');
        return true;
    };
    assert.equal(await h.context.__tmRunAutoRefreshIfNeeded('ws-main-batch', { committed: true,
        pendingTargets: { generation: 1, docIds: ['doc'], blockIds: ['task'] },
    }), true);
    assert.equal(h.state.externalTaskTxDirty, true);
    assert.deepEqual([...h.context.__tmTxTaskRefreshDocIds], ['doc', 'other-doc']);
    h.context.__tmRefreshAffectedDocsIncrementally = async () => true;
    assert.equal(await h.context.__tmRunAutoRefreshIfNeeded('ws-main-batch', { committed: true, bypassThrottle: true,
        pendingTargets: { generation: 2, docIds: ['doc', 'other-doc'], blockIds: ['task'] },
    }), true);
    assert.equal(h.state.externalTaskTxDirty, false);
    assert.equal(h.context.__tmTxTaskRefreshDocIds.size, 0);
    assert.equal(h.calls.full, 0);
});

test('deleting a task container saves the empty document with its fresh revision', async () => {
    const docId = '20260202084650-rzxfgy1';
    const taskId = '20261023122910-2rywfhn';
    const containerId = '20261023122910-wsph94o';
    const oldRevision = '20260202084650';
    const newRevision = '20261023123000';
    const task = { id: taskId, root_id: docId, parent_id: containerId, children: [] };
    const state = { viewMode: 'list', modal: {}, taskTree: [{ id: docId, updated: oldRevision, tasks: [task] }],
        allDocuments: [{ id: docId, updated: oldRevision }], flatTasks: { [taskId]: task },
        __tmLoadedDocIdsForTasks: [docId], stats: {} };
    const calls = { snapshots: [], order: [] };
    const noop = () => {};
    let revision = 0;
    const context = vm.createContext({
        state, Map, Set, Date, console: { log: noop },
        SettingsStore: { data: {} }, document: { body: { contains: () => true } },
        __TM_TASK_INDEX_QUERY_LIMIT: 20000,
        API: {
            getTaskFreshnessByDocuments: async () => {
                calls.order.push('freshness');
                return { map: new Map([[docId, { exists: true, docUpdated: newRevision, taskCount: 0 }]]) };
            },
            getTasksByDocuments: async () => { calls.order.push('tasks'); return { tasks: [] }; },
        },
        __tmTaskStore: { captureRead: () => ({ revision }), isReadCurrent: (token) => token.revision === revision,
            getFlatMap: () => ({}), removeFlatByDoc: noop },
        __tmFlushSqlTransactionsSafe: async () => true,
        __tmResolveIncrementalRefreshDocIds: async () => [docId],
        __tmCaptureEditorDocumentTaskOrder: () => [], __tmInvalidateTasksQueryCacheByDocId: noop,
        __tmGetIncrementalTaskQueryLimit: () => 20000,
        __tmBuildTaskEnhanceLoadPlan: () => ({ customFieldLoadPlan: { bulkFieldIds: [], deferredListFieldIds: [] } }),
        __tmCaptureLocalTaskPatchWatermarkRevisions: () => new Map(),
        __tmCollectTaskEnhanceTargets: () => ({ taskIds: [], taskDocMap: new Map() }),
        __tmApplyEditorDocumentTaskOrderToFlowRankMap: () => 0,
        __tmGetCustomFieldDefs: () => [], __tmBuildVisibleDateFallbackTaskIdSet: () => new Set(),
        __tmGetDocDisplayNameMode: () => 'name', __tmNormalizeDateOnly: () => '2026-10-23',
        __tmResolveTaskSiblingOrderRanks: async () => new Map(),
        __tmResolveDocTaskParentLinks: async () => ({ rootTasks: [] }),
        __tmShouldUseResolvedFlowRankForDoc: () => false, __tmSortTaskTreeBySiblingRankMap: noop,
        __tmAssignDocSeqByTree: noop, __tmNormalizeDocAliasValue: () => '', __tmNormalizeDocIconValue: () => '',
        __tmInvalidateFilteredTaskDerivedStateCache: noop,
        __tmReplaceFlatTasksThroughTaskStore: (flat) => { state.flatTasks = flat; },
        recalcStats: noop, __tmSchedulePersistTaskIndex: noop,
        __tmNormalizeTaskSnapshotDocIds: (ids) => ids,
        __tmSchedulePersistTaskSnapshot: (options) => calls.snapshots.push(options),
    });
    vm.runInContext(section(stores, 'function __tmBuildEditorDocumentTaskIdMap',
        'function __tmBuildAuthoritativeTaskConfirmationCandidate'), context);
    context.__tmIsLikelyBlockId = (id) => /^\d{14}-[a-z0-9]{7}$/.test(id);
    vm.runInContext(section(stores, 'async function __tmRefreshAffectedDocsIncrementally(',
        'let __tmSqlTransactionFlushInFlight'), context);
    const options = { docIds: [docId], deletedBlockIds: [containerId], forceDocRefresh: true, committed: true,
        commitView: false, reason: 'ws-main-hidden' };
    assert.equal(await context.__tmRefreshAffectedDocsIncrementally(options), true);
    assert.deepEqual(calls.order, ['freshness', 'tasks'], 'read the document revision before reading its task rows');
    assert.equal(state.taskTree[0].docUpdated, newRevision, 'the stale document list must not supply the saved revision');
    assert.equal(state.taskTree[0].tasks.length, 0);
    assert.equal(state.flatTasks[taskId], undefined);
    assert.equal(calls.snapshots.length, 1);
    assert.equal(state.allDocuments[0].updated, oldRevision);

    // A failed freshness read must leave the existing projection and dirty
    // targets available for the coordinator's retry, without querying tasks.
    calls.order.length = 0;
    context.API.getTaskFreshnessByDocuments = async () => ({ unavailable: true });
    const deferred = [];
    assert.equal(await context.__tmRefreshAffectedDocsIncrementally({ ...options, onDeferred: (reason) => deferred.push(reason) }), false);
    assert.deepEqual(deferred, ['document-freshness-unavailable']);
    assert.equal(calls.order.length, 0);
    assert.equal(calls.snapshots.length, 1);
    context.API.getTaskFreshnessByDocuments = async () => {
        revision++;
        return { map: new Map([[docId, { exists: true, docUpdated: newRevision }]]) };
    };
    deferred.length = 0;
    assert.equal(await context.__tmRefreshAffectedDocsIncrementally({ ...options, onDeferred: (reason) => deferred.push(reason) }), false);
    assert.deepEqual(deferred, ['task-store-changed'], 'a mutation during the revision read must prevent the task query');
    assert.equal(calls.order.length, 0);
});
