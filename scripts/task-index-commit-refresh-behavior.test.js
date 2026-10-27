'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const root = path.join(__dirname, '../src/task-horizon/main');
const stores = fs.readFileSync(path.join(root, '10-stores-rules-and-cache.js'), 'utf8');
const services = fs.readFileSync(path.join(root, '20-api-and-runtime-services.js'), 'utf8');
const docId = '20261027120000-docroot';
const otherDocId = '20261027120000-otherdoc';
const taskId = '20261027120000-task001';

function loadFunction(context, source, name) {
    const start = source.search(new RegExp('    (?:async )?function ' + name + '\\('));
    const end = source.indexOf('\n    }', start) + '\n    }'.length;
    assert.ok(start >= 0 && end > start, name);
    vm.runInContext(source.slice(start, end), context);
}

for (const scenario of [
    { name: 'delete', action: 'delete', inverse: 'insert', inserted: false },
    { name: 'undo creation', action: 'delete', inverse: 'insert', inserted: false },
    { name: 'redo creation', action: 'insert', inverse: 'delete', inserted: true },
    { name: 'undo deletion', action: 'insert', inverse: 'delete', inserted: true },
    { name: 'move', action: 'move', inverse: 'insert', inserted: false },
]) {
    test('insert candidates follow executed operations during ' + scenario.name, () => {
        const context = vm.createContext({});
        loadFunction(context, stores, '__tmIsLikelyBlockId');
        loadFunction(context, stores, '__tmExtractInsertedBlockIdsFromTx');
        const result = context.__tmExtractInsertedBlockIdsFromTx({ detail: { cmd: 'transactions', data: [{
            doOperations: [{ action: scenario.action, id: taskId }],
            undoOperations: [{ action: scenario.inverse, id: taskId }],
        }] } });
        assert.deepEqual(Array.from(result), scenario.inserted ? [taskId] : []);
    });
}

test('insert candidates retain nested block IDs from executed append and prepend operations', () => {
    const context = vm.createContext({});
    loadFunction(context, stores, '__tmIsLikelyBlockId');
    loadFunction(context, stores, '__tmExtractInsertedBlockIdsFromTx');
    const result = context.__tmExtractInsertedBlockIdsFromTx({ data: [{
        doOperations: [
            { action: 'append', data: '<div data-node-id="' + taskId + '"></div>' },
            { action: 'prependInsert', id: otherDocId },
        ],
        undoOperations: [{ action: 'insert', id: docId }],
    }] });
    assert.deepEqual(Array.from(result), [taskId, otherDocId]);
});

function refreshHarness({ visible = true } = {}) {
    const timers = new Map();
    let timerId = 0;
    let listener;
    const calls = { reads: 0, full: 0, options: [] };
    const controls = {
        gate: { allowRun: true },
        read: async (options) => { options.onDeferred('insert-index-not-visible'); return false; },
    };
    const state = { externalTaskTxDirty: true, viewMode: 'kanban' };
    const context = vm.createContext({
        state, Set, Map, Date, Promise,
        document: { querySelector: () => null },
        window: { addEventListener() {} },
        __tmHost: { getEventBuses: () => [{ on: (_name, handler) => { listener = handler; } }] },
        __tmSqlCacheInvalidationBound: false,
        __tmTxTaskRefreshDocIds: new Set([docId]),
        __tmTxTaskRefreshBlockIds: new Set([taskId]),
        __tmTxTaskRefreshGeneration: 1,
        __tmTxTaskRefreshAttemptCount: 0,
        __tmTxTaskRefreshTimer: null,
        __tmTxTaskRefreshInFlight: false,
        __tmTxTaskRefreshMeta: { committed: true, structural: true, indexWaitDocIds: [] },
        __TM_TASK_TX_DOC_ID_LIMIT: 32, __TM_TASK_TX_BLOCK_ID_LIMIT: 256,
        __TM_TASK_TX_MAX_REFRESH_ATTEMPTS: 3,
        __tmTabEnterAutoRefreshLastTs: 0, __tmTabEnterAutoRefreshInFlight: false,
        __tmIsPluginVisibleNow: () => visible,
        __tmHasAutoRefreshPendingSync: () => state.externalTaskTxDirty,
        __tmHasExternalTaskTxDirtySync: () => state.externalTaskTxDirty,
        __tmClearExternalTaskTxDirty: () => { state.externalTaskTxDirty = false; },
        __tmGetTxRefreshRetryMeta: () => controls.gate,
        __tmGetBackgroundRefreshGateMeta: () => controls.gate,
        __tmGetBusyTaskDetailBarrier: () => null,
        __tmGetEnterAutoRefreshDelayMeta: () => ({ shouldDelay: false }),
        __tmHasQuickbarModificationsSync: () => false,
        __tmScheduleCalendarRefetchFromTx() {},
        __tmFlushDeferredViewRefreshAfterTaskFieldWork() {},
        __tmClassifyPendingTaskTxRefresh: async (targets) => ({
            relevant: true, docIds: targets.docIds, blockIds: targets.blockIds,
            committed: true, forceDocRefresh: true,
        }),
        __tmRefreshAffectedDocsIncrementally: async (options) => {
            calls.reads++;
            calls.options.push(options);
            return await controls.read(options);
        },
        __tmRefreshCore: async () => { calls.full++; return true; },
        setTimeout: (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId; },
        clearTimeout: (id) => { timers.delete(id); },
    });
    for (const name of [
        '__tmIsLikelyBlockId', '__tmAddBoundedTaskTxIds', '__tmGetWsMainTaskTxDetail',
        '__tmRememberPendingTxRefreshTargets', '__tmSnapshotPendingTxRefreshTargets',
        '__tmClearPendingTxRefreshTargets', '__tmShouldIgnoreWsMainTaskRefreshMessage',
        '__tmWakePendingTaskRefreshAfterIndexCommit', '__tmFlushTaskIncrementalRefreshFromTx',
        '__tmBindSqlCacheInvalidation',
    ]) loadFunction(context, stores, name);
    loadFunction(context, services, '__tmRunAutoRefreshIfNeeded');
    context.__tmBindSqlCacheInvalidation();
    return {
        context, state, calls, controls, timers,
        defer: () => context.__tmFlushTaskIncrementalRefreshFromTx({ allowHiddenDataRefresh: !visible }),
        emit: (rootIDs, wrapped = true) => {
            const message = { cmd: 'databaseIndexCommit', data: { rootIDs } };
            listener(wrapped ? { detail: message } : message);
        },
        runTimer: async () => {
            const [id, timer] = timers.entries().next().value;
            timers.delete(id);
            timer.callback();
            await new Promise(setImmediate);
        },
    };
}

test('an affected index commit replaces the retry timer and confirms through the existing coordinator', async () => {
    const h = refreshHarness();
    await h.defer();
    assert.deepEqual(Array.from(h.context.__tmTxTaskRefreshMeta.indexWaitDocIds), [docId]);
    assert.equal(h.timers.size, 1);
    assert.equal(Array.from(h.timers.values())[0].delay, 400);
    h.controls.read = async () => true;
    h.emit([docId]);
    assert.equal(h.calls.reads, 1, 'the listener must not query synchronously');
    assert.equal(h.state.externalTaskTxDirty, true, 'an index notification is not task confirmation');
    assert.equal(h.context.__tmTxTaskRefreshGeneration, 1);
    assert.equal(h.timers.size, 1);
    assert.equal(Array.from(h.timers.values())[0].delay, 0);
    await h.runTimer();
    assert.equal(h.calls.reads, 2);
    assert.equal(h.calls.full, 0);
    assert.equal(h.state.externalTaskTxDirty, false);
    assert.equal(h.timers.size, 0);
});

test('duplicate notifications coalesce and unrelated or unscoped notifications preserve the fallback', async () => {
    const h = refreshHarness();
    await h.defer();
    const fallback = Array.from(h.timers.keys())[0];
    h.emit([otherDocId]);
    h.emit([]);
    h.emit(undefined);
    assert.equal(Array.from(h.timers.keys())[0], fallback);
    h.emit([otherDocId, docId], false);
    const wake = Array.from(h.timers.keys())[0];
    h.emit([docId]);
    assert.equal(h.timers.size, 1);
    assert.equal(Array.from(h.timers.keys())[0], wake);
    assert.equal(h.context.__tmTxTaskRefreshAttemptCount, 1);
});

test('ordinary dirty work and version-invalidated reads do not subscribe to index completion', async () => {
    const h = refreshHarness();
    h.emit([docId]);
    assert.equal(h.timers.size, 0);
    h.controls.read = async (options) => { options.onDeferred('task-store-changed'); return false; };
    await h.defer();
    const fallback = Array.from(h.timers.keys())[0];
    h.emit([docId]);
    assert.equal(Array.from(h.timers.keys())[0], fallback);
    assert.equal(h.state.externalTaskTxDirty, true);
});

test('missing notifications retain bounded timeout retries and a later commit can resume a parked batch', async () => {
    const h = refreshHarness();
    await h.defer();
    await h.runTimer();
    await h.runTimer();
    assert.equal(h.calls.reads, 3);
    assert.equal(h.timers.size, 0);
    assert.equal(h.state.externalTaskTxDirty, true);
    h.controls.read = async () => true;
    h.emit([docId]);
    await h.runTimer();
    assert.equal(h.calls.reads, 4);
    assert.equal(h.state.externalTaskTxDirty, false);
});

test('a notification emitted by an in-flight index flush cannot start a refresh loop', async () => {
    const h = refreshHarness();
    await h.defer();
    h.controls.read = async (options) => {
        h.emit([docId]);
        assert.equal(h.timers.size, 0);
        options.onDeferred('insert-index-not-visible');
        return false;
    };
    await h.runTimer();
    assert.equal(h.calls.reads, 2);
    assert.equal(h.timers.size, 1);
    assert.equal(Array.from(h.timers.values())[0].delay, 400);
});

test('a newer transaction cannot inherit an index wait from an older query', async () => {
    const h = refreshHarness();
    h.controls.read = async (options) => {
        h.context.__tmRememberPendingTxRefreshTargets([otherDocId], [], { committed: true });
        options.onDeferred('insert-index-not-visible');
        return false;
    };
    await h.defer();
    assert.equal(h.context.__tmTxTaskRefreshGeneration, 2);
    assert.deepEqual(Array.from(h.context.__tmTxTaskRefreshMeta.indexWaitDocIds), []);
    const fallback = Array.from(h.timers.keys())[0];
    h.emit([docId]);
    assert.equal(Array.from(h.timers.keys())[0], fallback);
    assert.equal(h.state.externalTaskTxDirty, true);
});

test('a newer transaction remains pending when an index-triggered confirmation completes', async () => {
    const h = refreshHarness();
    await h.defer();
    h.controls.read = async () => {
        h.context.__tmRememberPendingTxRefreshTargets([otherDocId], [], { committed: true });
        return true;
    };
    h.emit([docId]);
    await h.runTimer();
    assert.equal(h.calls.reads, 2);
    assert.equal(h.state.externalTaskTxDirty, true);
    assert.equal(h.context.__tmTxTaskRefreshDocIds.has(otherDocId), true);
    assert.equal(h.context.__tmTxTaskRefreshGeneration, 2);
    assert.deepEqual(Array.from(h.context.__tmTxTaskRefreshMeta.indexWaitDocIds), []);
});

test('index completion for one side of a move preserves both pending document scopes', async () => {
    const h = refreshHarness();
    h.context.__tmTxTaskRefreshDocIds.add(otherDocId);
    await h.defer();
    h.controls.read = async () => true;
    h.emit([otherDocId]);
    await h.runTimer();
    assert.deepEqual(Array.from(h.calls.options[1].docIds), [docId, otherDocId]);
    assert.equal(h.state.externalTaskTxDirty, false);
});

test('hidden hosts use the same background reconciliation and visible edit barriers still apply', async () => {
    const hidden = refreshHarness({ visible: false });
    await hidden.defer();
    hidden.controls.read = async () => true;
    hidden.emit([docId]);
    await hidden.runTimer();
    assert.equal(hidden.calls.reads, 2);
    assert.equal(hidden.calls.options[1].commitView, true);
    assert.equal(hidden.state.externalTaskTxDirty, false);
    const busy = refreshHarness();
    await busy.defer();
    busy.controls.gate = { allowRun: false, waitMs: 250, reason: 'detail-busy' };
    busy.emit([docId]);
    await busy.runTimer();
    assert.equal(busy.calls.reads, 1);
    assert.equal(busy.timers.size, 1);
    assert.equal(Array.from(busy.timers.values())[0].delay, 250);
});

test('resolved or disposed pending batches ignore delayed index notifications', async () => {
    const h = refreshHarness();
    await h.defer();
    h.context.__tmClearPendingTxRefreshTargets();
    h.state.externalTaskTxDirty = false;
    const timer = Array.from(h.timers.keys())[0];
    h.emit([docId]);
    assert.equal(Array.from(h.timers.keys())[0], timer);
    await h.runTimer();
    assert.equal(h.calls.reads, 1);
    assert.equal(h.timers.size, 0);
});
