'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../src/task-horizon/main');
const apiSource = fs.readFileSync(path.join(root, '20-api-and-runtime-services.js'), 'utf8');
const stores = fs.readFileSync(path.join(root, '10-stores-rules-and-cache.js'), 'utf8');
const siblingSource = fs.readFileSync(path.join(root, 'task-runtime/53b-task-create-and-quick-add-runtime.js'), 'utf8');
const helpers = stores.slice(stores.indexOf('    function __tmRunReadQueued('), stores.indexOf('    function __tmInvalidateTasksQueryCacheByDocId('));
const readHelpers = apiSource.slice(apiSource.indexOf('    const __tmReadApiPaths'), apiSource.indexOf('    const API ='));
const sibling = siblingSource.slice(siblingSource.indexOf('    async function __tmResolveTaskSiblingOrderRanks('), siblingSource.indexOf('    function __tmCompareTasksBySiblingRankMap('));
function method(name) {
    const start = apiSource.indexOf(`        async ${name}(`);
    const end = apiSource.indexOf('\n        },', start) + 11;
    assert.ok(start >= 0 && end > start, name);
    return apiSource.slice(start, end);
}
const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
function harness(fetchImpl = async () => ({ ok: true, status: 200, text: async () => '{"code":0}' })) {
    const timers = new Set();
    const context = vm.createContext({ console, Map, Set, Date, AbortController, fetch: fetchImpl,
        __tmSqlQueue: { max: 3, active: 0, q: [] }, __tmSqlInFlight: new Map(), __tmTaskReadGeneration: 0,
        __tmDocEnhanceSnapshotCache: new Map(), SettingsStore: { data: {} },
        __tmHashIds: (ids) => ids.join(','), __tmGetAuxCache: () => null, __tmSetAuxCache: () => {},
        __tmGetPerfTuningOptions: () => ({ docEnhanceFetchConcurrency: 99 }),
        setTimeout(fn, delay) {
            if (delay < 30000) return setTimeout(fn, 0);
            const timer = { fn };
            timers.add(timer);
            return timer;
        },
        clearTimeout(timer) { if (!timers.delete(timer)) clearTimeout(timer); },
    });
    vm.runInContext(helpers + readHelpers + `globalThis.API = {${['call', 'getBlockDOM', 'getBlockKramdown', 'getDocEnhanceSnapshot', 'fetchTaskEnhanceBundle'].map(method).join('\n')}};`, context);
    return { context, api: context.API, timers, async expire() {
        for (const timer of Array.from(timers)) if (timers.delete(timer)) timer.fn();
        await tick();
    } };
}

test('mixed SQL/content/attribute reads share three slots; writes bypass read backlog', async () => {
    const requests = [];
    let active = 0, peak = 0;
    const h = harness(async (url, options) => {
        if (url === '/api/block/updateBlock') {
            assert.equal(options.signal, undefined, 'write cancellation semantics stay unchanged');
            return { ok: true, status: 200, text: async () => '{"code":0}' };
        }
        const job = deferred();
        active++;
        peak = Math.max(peak, active);
        requests.push({ url, options, finish: () => { active--; job.resolve({ ok: true, status: 200, text: async () => '{"code":0}' }); } });
        return job.promise;
    });
    const paths = ['/api/query/sql', '/api/block/getBlockDOM', '/api/block/getBlockKramdown', '/api/attr/batchGetBlockAttrs'];
    const jobs = Array.from({ length: 60 }, (_, i) => h.api.call(paths[i % paths.length], { id: i, stmt: `SELECT ${i}` }));
    await tick();
    assert.equal(requests.length, 3);
    assert.equal((await h.api.call('/api/block/updateBlock', { id: 'task', data: 'changed' })).code, 0);
    let done = 0;
    while (done < 60) {
        const batch = requests.slice(done);
        assert.ok(batch.length > 0);
        batch.forEach((request) => request.finish());
        done += batch.length;
        await tick();
    }
    assert.ok((await Promise.all(jobs)).every((result) => result.code === 0));
    assert.equal(peak, 3);
    assert.equal(h.context.__tmSqlQueue.active, 0);
    assert.equal(h.context.__tmSqlQueue.q.length, 0);
    assert.equal(h.timers.size, 0);
});

for (const phase of ['headers', 'body']) test(`read deadline aborts a stalled ${phase} request and releases its slot`, async () => {
    let signal, aborted = 0;
    const h = harness(async (url, options) => {
        signal = options.signal;
        const pending = new Promise((resolve, reject) => signal.addEventListener('abort', () => {
            aborted++;
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        }, { once: true }));
        if (phase === 'headers') return pending;
        return { ok: true, status: 200, text: () => pending };
    });
    const job = h.api.call('/api/block/getBlockDOM', { id: 'doc' });
    await tick();
    await h.expire();
    const result = await job;
    assert.equal(signal.aborted, true);
    assert.equal(aborted, 1);
    assert.equal(result.code, -1);
    assert.equal(result.readFailure, true);
    assert.equal(result.errorCode, 'TM_READ_TIMEOUT');
    assert.equal(h.context.__tmSqlQueue.active, 0);
    assert.equal(h.timers.size, 0);
    h.context.fetch = async () => ({ ok: true, status: 200, text: async () => '{"code":0}' });
    assert.equal((await h.api.call('/api/block/getBlockDOM', { id: 'next' })).code, 0);
});

test('overload bounds the waiting queue, expires queued reads without sending them', async () => {
    let sent = 0;
    const h = harness(async (url, { signal }) => {
        sent++;
        return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
    });
    const jobs = Array.from({ length: 200 }, (_, id) => h.api.call('/api/block/getBlockDOM', { id }));
    await tick();
    assert.equal(sent, 3);
    assert.equal(h.context.__tmSqlQueue.q.length, 128);
    await h.expire();
    const results = await Promise.all(jobs);
    assert.equal(results.filter((r) => r.errorCode === 'TM_READ_OVERLOAD').length, 69);
    assert.equal(results.filter((r) => r.errorCode === 'TM_READ_TIMEOUT').length, 131);
    assert.equal(sent, 3, 'expired jobs must not later hit the backend');
    assert.equal(h.context.__tmSqlQueue.active, 0);
    assert.equal(h.context.__tmSqlQueue.q.length, 0);
});

test('bounded mapper preserves order and stops dispatching when a view becomes stale', async () => {
    const h = harness();
    let active = 0, peak = 0;
    const ids = Array.from({ length: 1000 }, (_, i) => i);
    const results = await h.context.__tmMapReadLimited(ids, async (id) => {
        active++; peak = Math.max(peak, active);
        await Promise.resolve(); active--;
        return id * 2;
    }, 100);
    assert.equal(peak, 3);
    assert.deepEqual(Array.from(results), ids.map((i) => i * 2));
    let current = true, started = 0;
    await h.context.__tmMapReadLimited(ids, async () => { started++; current = false; }, 3, () => current);
    assert.equal(started, 1);
});

function siblingHarness(readSnapshot) {
    const h = harness();
    h.api.getDocEnhanceSnapshot = readSnapshot;
    h.api.getDirectChildTaskIdsOfTask = h.api.getTaskIdsInList = () => { throw new Error('per-block request is forbidden'); };
    Object.assign(h.context, {
        __tmGetTaskSiblingRankEntry: (ranks, id) => ranks.get(id),
        __tmIsRecurringInstanceTask: (task) => task.recurring === true,
        __tmShouldUseResolvedFlowRankForDoc: () => false,
    });
    vm.runInContext(sibling, h.context);
    return h;
}

test('1000 tasks across 20 documents need 20 order reads; parent order spans child lists', async () => {
    const docs = new Map(), flow = new Map();
    for (let d = 0; d < 20; d++) {
        const docId = `doc-${d}`;
        const tasks = Array.from({ length: 50 }, (_, i) => ({ id: `${docId}-${i}`, root_id: docId, parent_id: `list-${d}-${Math.floor(i / 5)}`, parentTaskId: `parent-${d}-${Math.floor(i / 10)}` }));
        tasks.forEach((task, i) => flow.set(task.id, i));
        docs.set(docId, tasks.reverse());
    }
    let calls = 0, active = 0, peak = 0;
    const h = siblingHarness(async (docId, level, options) => {
        calls++; active++; peak = Math.max(peak, active);
        assert.equal(options.needH2, false);
        assert.equal(options.forceFresh, true);
        await Promise.resolve(); active--;
        return { flowRankMap: flow };
    });
    const ranks = await h.context.__tmResolveTaskSiblingOrderRanks(docs);
    assert.equal(calls, 20);
    assert.ok(peak <= 3);
    assert.equal(ranks.size, 1000);
    for (let d = 0; d < 20; d++) for (let i = 0; i < 50; i++) {
        assert.equal(ranks.get(`doc-${d}-${i}`).localRank, i % 5);
        assert.equal(ranks.get(`doc-${d}-${i}`).parentRank, i % 10);
    }
    calls = 0;
    await h.context.__tmResolveTaskSiblingOrderRanks(docs, { flowRankMap: flow });
    assert.equal(calls, 0, 'reuse the authoritative flow ranks already fetched for this load');
});

test('incomplete document ranks preserve the whole sibling group; virtual tasks do not trigger reads', async () => {
    let calls = 0;
    const h = siblingHarness(async () => { calls++; return { flowRankMap: new Map([['b', 1]]) }; });
    const tasks = [{ id: 'a', parent_id: 'list' }, { id: 'b', parent_id: 'list' }, { id: 'repeat', recurring: true, parent_id: 'virtual' }];
    const ranks = await h.context.__tmResolveTaskSiblingOrderRanks(new Map([['doc', tasks]]));
    assert.equal(calls, 1);
    assert.equal(ranks.get('a').localRank, 0);
    assert.equal(ranks.get('b').localRank, 1);
    assert.equal(ranks.has('repeat'), false);
});

test('documents without siblings to compare need no order reads', async () => {
    let calls = 0;
    const h = siblingHarness(async () => { calls++; return { flowRankMap: new Map() }; });
    const docs = new Map(Array.from({ length: 1000 }, (_, i) => [`doc-${i}`, [{ id: `task-${i}`, parent_id: `list-${i}` }]]));
    const ranks = await h.context.__tmResolveTaskSiblingOrderRanks(docs);
    assert.equal(ranks.size, 1000);
    assert.equal(calls, 0);
});

test('transport failure stops document enhancement without legacy fallback or caching empty success', async () => {
    const h = harness();
    const failure = Object.assign(new Error('timeout'), { readFailure: true });
    h.api.getBlockKramdown = async () => { throw failure; };
    await assert.rejects(h.api.getDocEnhanceSnapshot('doc'), /timeout/);
    assert.equal(h.context.__tmDocEnhanceSnapshotCache.size, 0);
    let calls = 0, fallback = 0;
    h.api.getDocEnhanceSnapshot = async () => { calls++; throw failure; };
    h.api.fetchTaskFlowRanksLegacy = h.api.fetchH2ContextsLegacy = async () => { fallback++; return new Map(); };
    const ids = Array.from({ length: 100 }, (_, i) => `task-${i}`);
    await assert.rejects(h.api.fetchTaskEnhanceBundle(ids, { taskDocMap: new Map(ids.map((id, i) => [id, `doc-${i}`])) }), /timeout/);
    assert.ok(calls <= 3);
    assert.equal(fallback, 0);
});

test('failed batch transport does not fan out, while SQL compatibility fallback remains bounded and complete', async () => {
    const h = harness();
    let cached = 0;
    Object.assign(h.context, {
        console: { ...console, error() {} },
        __TM_TASK_INDEX_QUERY_LIMIT: 20000, __TM_SQL_MAX_TOTAL_LIMIT: 500000,
        __tmCaptureTaskReadToken: () => ({}), __tmShouldReadRepeatAttrsInline: () => false,
        __tmGetTaskQueryCache: () => null, __tmRememberTaskQueryCache: () => { cached++; },
        compatTaskAliasTypeCondition: () => "type = 'i'", compatTaskMarkdownCondition: () => '1 = 1',
        __tmBuildTaskInlineAttrAggregateSql: () => '', __tmBuildTaskInlineAttrNamesSql: () => "'custom-priority'",
        __tmCloneTaskQueryResult: (value) => structuredClone(value), __tmCloneTaskQueryRows: (rows) => structuredClone(rows),
    });
    vm.runInContext(`API.getTasksByDocuments = ({${method('getTasksByDocuments')}}).getTasksByDocuments;`, h.context);
    const ids = Array.from({ length: 20 }, (_, i) => `20260925-doc${i}`);
    let fallback = 0, active = 0, peak = 0;
    h.api.getTasksByDocument = async (id) => {
        fallback++; active++; peak = Math.max(peak, active);
        await Promise.resolve(); active--;
        return { tasks: [{ id }] };
    };
    h.api.call = async () => ({ code: -1, msg: 'timeout', readFailure: true });
    await assert.rejects(h.api.getTasksByDocuments(ids), /timeout/);
    assert.equal(fallback, 0);
    assert.equal(cached, 0);
    h.api.call = async () => ({ code: -1, msg: 'SQL compatibility error' });
    const result = await h.api.getTasksByDocuments(ids);
    assert.deepEqual(Array.from(result.tasks, (task) => task.id).sort(), ids.slice().sort());
    assert.equal(fallback, 20);
    assert.equal(peak, 3);
    assert.equal(cached, 1);
    cached = 0; fallback = 0;
    h.api.getTasksByDocument = async () => { fallback++; throw Object.assign(new Error('timeout'), { readFailure: true }); };
    await assert.rejects(h.api.getTasksByDocuments(ids), /timeout/);
    assert.ok(fallback <= 3);
    assert.equal(cached, 0, 'partial fallback results must not be cached as an empty success');
    fallback = 0;
    h.context.SettingsStore.data.legacyWin7CompatMode = true;
    await assert.rejects(h.api.getTasksByDocuments(ids), /timeout/);
    assert.equal(fallback, 1, 'legacy sequential loading must stop on transport failure too');
    assert.equal(cached, 0);
});
