'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const start = source.indexOf('    function __tmComputeTaskIndexCheckpointDelay(');
const end = source.indexOf('\n    }', start) + '\n    }'.length;
assert.ok(start >= 0 && end > start, 'task-index checkpoint delay helper must exist');

const context = vm.createContext({});
vm.runInContext(`${source.slice(start, end)}
this.delay = __tmComputeTaskIndexCheckpointDelay;`, context);

assert.equal(context.delay({ now: 1000, firstDirtyAt: 1000, lastCheckpointAt: 0, requestedDelay: 700 }), 5000,
    'the first index checkpoint must wait for the quiet window');
assert.equal(context.delay({ now: 4000, firstDirtyAt: 1000, lastCheckpointAt: 0, requestedDelay: 700 }), 5000,
    'continuous edits must not reset the original dirty timestamp');
assert.equal(context.delay({ now: 19000, firstDirtyAt: 1000, lastCheckpointAt: 0, requestedDelay: 700 }), 2000,
    'the soft deadline must bound indefinite debounce');
assert.equal(context.delay({ now: 22000, firstDirtyAt: 1000, lastCheckpointAt: 0, requestedDelay: 700 }), 120,
    'an expired soft deadline must checkpoint promptly');
assert.equal(context.delay({ now: 31000, firstDirtyAt: 31000, lastCheckpointAt: 30000, requestedDelay: 700 }), 14000,
    'a successful checkpoint must impose a minimum gap');
assert.equal(context.delay({ now: 31000, firstDirtyAt: 31000, lastCheckpointAt: 24000, requestedDelay: 20000 }), 20000,
    'an explicit longer delay may exceed the quiet window but not ignore the deadline');

const { test } = require('node:test');
const clone = (value) => JSON.parse(JSON.stringify(value));
const tick = async () => { for (let i = 0; i < 40; i += 1) await Promise.resolve(); };
const docA = '20261115000000-a000001';
const docB = '20261115000000-b000001';
const docC = '20261115000000-c000001';
const entry = (id, content = 'new') => ({ id, docUpdated: '20261115000001', updatedAt: 200, taskCount: 1, content });
function extract(name) {
    const start = source.search(new RegExp(`    (?:async )?function ${name}\\(`));
    assert.ok(start >= 0, name);
    return source.slice(start, source.indexOf('\n    }', start) + 6);
}

function harness() {
    const timers = new Map();
    let timerId = 0;
    const revisions = new Map();
    const writes = [];
    const builds = [];
    const rewarm = [];
    const ctx = vm.createContext({
        Date, Map, Set, Promise,
        state: { taskTree: [entry(docA), entry(docB)], allDocuments: [], __tmLoadedDocIdsForTasks: [docA, docB] },
        __tmTaskIndexSaveTimer: null, __tmTaskIndexSaveInFlight: false, __tmTaskIndexSaveGeneration: 0,
        __tmTaskIndexFirstDirtyAt: 0, __tmTaskIndexLastCheckpointAt: 0,
        __tmTaskIndexPendingDocs: new Map(), __tmTaskIndexStoreCache: { docs: {} },
        __tmTaskIndexStoreLoadPromise: null,
        __TM_TASK_INDEX_MAX_DOCS: 1200, __TM_TASK_INDEX_MAX_SINGLE_DOC_BYTES: 100000,
        TASK_INDEX_FILE_PATH: 'index.json', disk: { docs: {} }, writeError: false, readHook: null,
        setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; },
        clearTimeout(id) { timers.delete(id); },
        __tmIsLikelyBlockId: (id) => /^\d{14}-[a-z0-9]{7}$/.test(id),
        __tmNormalizeTaskSnapshotDocIds: (ids) => [...new Set(ids)],
        __tmNormalizeDocAliasValue: (v) => v || '', __tmNormalizeDocIconValue: (v) => v || '',
        __tmGetHighPriorityInteractionWaitMs: () => 0, __tmGetExternalTaskTxQuietWaitMs: () => 0,
        __tmGetExpectedTaskCountMapFromOptions: (opts) => opts.taskCountMap || new Map(),
        __tmGetExpectedTaskCountFromMap: (map, id) => map.get(id),
        __tmBuildTaskIndexDocEntry(doc, options) {
            builds.push({ id: doc.id, options });
            return { ...doc, queryLimit: options.queryLimit };
        },
        __tmEstimateJsonByteSize: () => 1, __tmScheduleIdleTask: (fn) => fn(),
        __tmScheduleTaskIndexPrewarmForDocIds: (ids) => rewarm.push(...ids),
        __tmWithTaskIndexWriteLock: (fn) => fn(),
        __tmReadDerivedCacheFile: async () => { ctx.readHook?.(); return clone(ctx.disk); },
        __tmNormalizeTaskIndexStore: (value) => clone(value),
        __tmPruneTaskIndexStoreToLimits: (value) => value,
        __tmWriteJsonFile: async (_path, value) => {
            if (ctx.writeError) return false;
            ctx.disk = clone(value);
            writes.push(clone(value));
            return true;
        },
    });
    ctx.__tmTaskStore = {
        captureRead: (ids) => Object.fromEntries(ids.map((id) => [id, revisions.get(id) || 0])),
        isReadCurrent: (token) => Object.entries(token).every(([id, revision]) => (revisions.get(id) || 0) === revision),
    };
    vm.runInContext([
        '__tmComputeTaskIndexCheckpointDelay', '__tmTaskIndexEntryIsNewerOrEqual',
        '__tmRememberTaskIndexEntriesForCheckpoint', '__tmSchedulePersistTaskIndex',
        '__tmMergeTaskIndexEntries', '__tmPersistTaskIndexEntries', '__tmInvalidateTaskIndexStoreCache',
    ].map(extract).join('\n'), ctx);
    return {
        ctx, timers, writes, builds, rewarm,
        change(id) { revisions.set(id, (revisions.get(id) || 0) + 1); },
        async flush() {
            const callbacks = [...timers.values()];
            timers.clear();
            callbacks.forEach((fn) => fn());
            await tick();
        },
    };
}

test('prewarm and projection requests share one checkpoint without losing documents or options', async () => {
    const h = harness();
    h.ctx.__tmSchedulePersistTaskIndex({ docIds: [docA], queryLimit: 500, taskCountMap: new Map([[docA, 1]]) });
    await h.ctx.__tmMergeTaskIndexEntries([entry(docC)]);
    h.ctx.__tmSchedulePersistTaskIndex({ docIds: [docB], queryLimit: 20000 });
    assert.equal(h.builds.length, 0, 'scheduling stays outside document serialization');
    assert.deepEqual(h.ctx.__tmTaskIndexStoreCache.docs, {}, 'pending entries are not published as confirmed cache');
    h.ctx.state.taskTree[0].content = 'latest at checkpoint';
    await h.flush();
    assert.equal(h.writes.length, 1);
    assert.deepEqual(Object.keys(h.ctx.disk.docs).sort(), [docA, docB, docC]);
    assert.equal(h.ctx.disk.docs[docA].content, 'latest at checkpoint');
    assert.equal(h.ctx.disk.docs[docA].queryLimit, 500);
    assert.equal(h.ctx.disk.docs[docB].queryLimit, 20000);
    assert.equal(h.ctx.__tmTaskIndexPendingDocs.size, 0);
});

test('prewarm cannot replace an already queued rebuild of the same loaded document', async () => {
    const h = harness();
    h.ctx.__tmSchedulePersistTaskIndex({ docIds: [docA] });
    await h.ctx.__tmMergeTaskIndexEntries([entry(docA, 'old prewarm')]);
    await h.flush();
    assert.equal(h.ctx.disk.docs[docA].content, 'new');
});

test('prewarm entries retain their source token across the checkpoint delay', async () => {
    const h = harness();
    const token = h.ctx.__tmTaskStore.captureRead([docC]);
    await h.ctx.__tmMergeTaskIndexEntries([entry(docC)], { readToken: token });
    h.change(docC);
    await h.flush();
    assert.equal(h.writes.length, 0);
    assert.deepEqual(h.rewarm, [docC]);
    assert.equal(h.ctx.__tmTaskIndexPendingDocs.size, 0);
    assert.equal(await h.ctx.__tmMergeTaskIndexEntries([entry(docC)], { readToken: token }), false,
        'a read invalidated before enqueue must also be rejected');
});

test('the persistence token covers prewarm documents while waiting on file reads', async () => {
    const h = harness();
    await h.ctx.__tmMergeTaskIndexEntries([entry(docC)]);
    h.ctx.readHook = () => h.change(docC);
    await h.flush();
    assert.equal(h.writes.length, 0);
    assert.equal(h.ctx.__tmTaskIndexPendingDocs.size, 1);
});

test('switching groups does not save an unloaded document as an empty document', async () => {
    const h = harness();
    h.ctx.__tmSchedulePersistTaskIndex({ docIds: [docA] });
    h.ctx.state.taskTree = [entry(docB)];
    h.ctx.state.__tmLoadedDocIdsForTasks = [docB];
    h.ctx.__tmSchedulePersistTaskIndex({ docIds: [docB] });
    await h.flush();
    assert.deepEqual(Object.keys(h.ctx.disk.docs), [docB]);
});

test('a loaded document with no tasks can still checkpoint its zero-task entry', async () => {
    const h = harness();
    h.ctx.state.taskTree = [];
    h.ctx.__tmSchedulePersistTaskIndex({ docIds: [docA], taskCountMap: new Map([[docA, 0]]) });
    await h.flush();
    assert.equal(h.ctx.disk.docs[docA].tasks.length, 0);
    assert.equal(h.ctx.disk.docs[docA].inTaskTree, undefined);
    assert.equal(h.builds[0].options.inTaskTree, false);
});

test('failed writes retain requests and do not publish unconfirmed values', async () => {
    const h = harness();
    const cache = h.ctx.__tmTaskIndexStoreCache;
    await h.ctx.__tmMergeTaskIndexEntries([entry(docC)]);
    h.ctx.writeError = true;
    await h.flush();
    assert.equal(h.ctx.__tmTaskIndexStoreCache, cache);
    assert.equal(h.ctx.__tmTaskIndexPendingDocs.size, 1);
    h.ctx.writeError = false;
    h.ctx.__tmSchedulePersistTaskIndex({ docIds: [docA] });
    await h.flush();
    assert.deepEqual(Object.keys(h.ctx.disk.docs).sort(), [docA, docC]);
});

test('a newer request arriving during a write survives the previous completion', async () => {
    const h = harness();
    let release;
    h.ctx.__tmWriteJsonFile = async () => new Promise((resolve) => { release = resolve; });
    h.ctx.__tmSchedulePersistTaskIndex({ docIds: [docA] });
    await h.flush();
    assert.equal(typeof release, 'function');
    h.ctx.__tmSchedulePersistTaskIndex({ docIds: [docA, docB] });
    release(true);
    await tick();
    assert.equal(h.ctx.__tmTaskIndexPendingDocs.size, 2);
    assert.equal(h.timers.size, 1);
});

test('a task change during the file write cannot confirm or clear the older projection', async () => {
    const h = harness();
    const cache = h.ctx.__tmTaskIndexStoreCache;
    h.ctx.__tmWriteJsonFile = async () => { h.change(docA); return true; };
    h.ctx.__tmSchedulePersistTaskIndex({ docIds: [docA] });
    await h.flush();
    assert.equal(h.ctx.__tmTaskIndexStoreCache, cache);
    assert.equal(h.ctx.__tmTaskIndexPendingDocs.has(docA), true);
});

test('successful sibling writes do not clear a document rejected by coverage checks', async () => {
    const h = harness();
    h.ctx.__tmSchedulePersistTaskIndex({ docIds: [docA], taskCountMap: new Map([[docA, 2]]) });
    h.ctx.__tmSchedulePersistTaskIndex({ docIds: [docB] });
    await h.flush();
    assert.deepEqual(Object.keys(h.ctx.disk.docs), [docB]);
    assert.equal(h.ctx.__tmTaskIndexPendingDocs.has(docA), true);
    assert.equal(h.ctx.__tmTaskIndexPendingDocs.has(docB), false);
});

test('cache invalidation discards queued entries and cancels their timer', async () => {
    const h = harness();
    await h.ctx.__tmMergeTaskIndexEntries([entry(docC)]);
    h.ctx.__tmInvalidateTaskIndexStoreCache();
    await h.flush();
    assert.equal(h.writes.length, 0);
    assert.equal(h.ctx.__tmTaskIndexPendingDocs.size, 0);
    assert.equal(h.timers.size, 0);
});

function installPrewarm(h, stage = '') {
    const { ctx } = h;
    const schedule = ctx.setTimeout;
    ctx.setTimeout = (fn, delay) => delay <= 80 ? Promise.resolve().then(fn) : schedule(fn);
    Object.assign(ctx, {
        __TM_TASK_INDEX_QUERY_LIMIT: 20000,
        __tmTaskIndexPrewarmState: { running: false, timer: null, pendingDocIds: new Set([docC]) },
        __tmGetPerfTuningOptions: () => ({ taskIndexPrewarm: true }),
        __tmBuildRuntimeCustomFieldLoadPlan: () => ({ bulkFieldIds: [] }),
        __tmNormalizeCustomFieldIdList: (ids) => ids,
        __tmLoadTaskIndexStore: async () => ctx.__tmTaskIndexStoreCache,
        __tmBuildDocUpdatedFingerprintMap: () => new Map(),
        __tmIsUsableTaskIndexDoc: () => false,
        API: { async getTasksByDocuments() {
            if (stage === 'query') h.change(docC);
            if (stage === 'invalidate') ctx.__tmInvalidateTaskIndexStoreCache();
            return { tasks: [{ id: 'task', root_id: docC }] };
        } },
        __tmBuildTaskIndexEntriesFromRows: async () => {
            if (stage === 'build') h.change(docC);
            return [entry(docC)];
        },
    });
    vm.runInContext(extract('__tmRunTaskIndexPrewarm'), ctx);
}

for (const stage of ['query', 'build', 'invalidate']) {
    test(`prewarm invalidated during ${stage} keeps its document pending for a fresh read`, async () => {
        const h = harness();
        installPrewarm(h, stage);
        await h.ctx.__tmRunTaskIndexPrewarm();
        assert.equal(h.ctx.__tmTaskIndexPendingDocs.size, 0);
        assert.equal(h.ctx.__tmTaskIndexPrewarmState.pendingDocIds.has(docC), true);
        assert.equal(h.writes.length, 0);
    });
}

test('prewarm passes the query token to the shared checkpoint instead of renewing it', async () => {
    const h = harness();
    installPrewarm(h);
    await h.ctx.__tmRunTaskIndexPrewarm();
    assert.equal(h.ctx.__tmTaskIndexPendingDocs.has(docC), true);
    h.change(docC);
    await h.flush();
    assert.equal(h.writes.length, 0);
    assert.deepEqual(h.rewarm, [docC]);
});
