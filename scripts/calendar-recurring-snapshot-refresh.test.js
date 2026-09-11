'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/48-render-calendar-support-runtime.js'), 'utf8');
const start = source.indexOf('async function __tmLoadAllTasksForCalendarCache(');
const end = source.indexOf('function __tmCalendarTaskCacheIsFresh(', start);
assert.ok(start >= 0 && end > start);
const loader = source.slice(start, end);
const clone = (value) => JSON.parse(JSON.stringify(value));

function createHarness() {
    const staleTasks = [
        { id: 'task-1', root_id: 'doc-1', completionTime: '2026-09-11', repeatState: { occurrenceCount: 3 }, repeatHistory: [] },
        { id: 'task-2', root_id: 'doc-1', completionTime: '2026-09-10', repeatState: { occurrenceCount: 3 }, repeatHistory: [] },
    ];
    const persistedTasks = clone(staleTasks);
    const calls = { query: [], snapshot: 0, index: 0 };
    let sharedLoad = null;
    let scopeMatches = false;
    let readGate = null;
    let readError = null;
    const context = vm.createContext({
        console, Map, Set, Date,
        state: { flatTasks: {}, __tmLoadedDocIdsForTasks: [] },
        __TM_TASK_INDEX_QUERY_LIMIT: 20000,
        __tmCalendarTaskFullLoadPromise: null,
        __tmCalendarTaskFullLoadRequireComplete: false,
        __tmGetCalendarTaskSharedLoadState: () => sharedLoad,
        __tmSetCalendarTaskSharedLoadState: (value) => { sharedLoad = value; },
        __tmClearCalendarTaskSharedLoadState: (promise) => { if (sharedLoad?.promise === promise) sharedLoad = null; },
        __tmResolveCalendarTaskDocIdsShared: async () => ['doc-1'],
        __tmCalendarTaskStoreScopeMatches: () => scopeMatches,
        __tmGetCalendarTaskStoreRowsSync: () => clone(persistedTasks),
        __tmNormalizeCalendarTaskRows: (tasks) => tasks,
        __tmAppendCalendarTaskAndRepeatHistory: (tasks, task) => { tasks.push(task); },
        __tmTaskStore: { revision: () => 1 },
        __tmLoadCalendarTasksFromSharedSnapshot: async () => {
            calls.snapshot += 1;
            return { tasks: clone(staleTasks), complete: true, source: 'task-snapshot', snapshotUpdatedAt: 1, reloadDocIds: [] };
        },
        __tmLoadCalendarTasksFromSharedTaskIndex: async () => {
            calls.index += 1;
            return { tasks: clone(staleTasks), complete: true, source: 'task-index', reloadDocIds: [] };
        },
        MetaStore: { load: async () => {} },
        API: {
            getTasksByDocuments: async (docIds, limit, options) => {
                calls.query.push({ docIds: Array.from(docIds), limit, options });
                if (readGate) await readGate;
                if (readError) throw readError;
                return { tasks: clone(persistedTasks), limitReached: false };
            },
        },
    });
    context.window = context;
    vm.runInContext(`${loader}\nthis.load = __tmLoadAllTasksForCalendarCache;`, context);
    const complete = (index, due, count) => {
        const task = persistedTasks[index];
        task.repeatHistory.unshift({ sourceDue: task.completionTime, nextDue: due });
        task.completionTime = due;
        task.repeatState = { occurrenceCount: count, lastInstanceDue: due, pendingNativeDoneReset: true };
        context.state.flatTasks[task.id] = clone(task);
        context.__tmCalendarAllTasksCache = null;
    };
    const refresh = () => {
        context.state.flatTasks = {};
        context.__tmCalendarAllTasksCache = null;
        return context.load({ requireCompleteCache: true });
    };
    return {
        context, calls, persistedTasks, complete, refresh,
        setScopeMatches: (value) => { scopeMatches = value; },
        setReadGate: (value) => { readGate = value; },
        setReadError: (value) => { readError = value; },
    };
}

async function run() {
    const harness = createHarness();
    harness.complete(0, '2026-09-13', 5);
    let tasks = await harness.refresh();
    assert.equal(tasks[0].completionTime, '2026-09-13', 'refresh without local overlays must read the committed due date, not the persisted startup snapshot');
    assert.equal(tasks[0].repeatState.occurrenceCount, 5);
    assert.equal(harness.context.__tmCalendarAllTasksCache.source, 'sql');
    assert.equal(harness.calls.snapshot, 0);
    assert.equal(harness.calls.index, 0, 'an unvalidated durable index must not be another stale fallback');

    harness.complete(1, '2026-09-13', 6);
    tasks = await harness.refresh();
    assert.deepEqual(tasks.map((task) => task.completionTime), ['2026-09-13', '2026-09-13'], 'completing a second task must not restore the first task from a stale snapshot');
    assert.deepEqual(tasks.map((task) => task.repeatState.occurrenceCount), [5, 6]);
    assert.deepEqual(tasks.map((task) => task.repeatHistory[0].nextDue), ['2026-09-13', '2026-09-13']);
    assert.equal(harness.calls.query.length, 2);
    await harness.context.load();
    assert.equal(harness.calls.query.length, 2, 'the short-lived authoritative calendar cache must still be reused');
    harness.context.__tmCalendarAllTasksCache.ts = Date.now() - 9000;
    await harness.context.load();
    assert.equal(harness.calls.query.length, 3, 'cache expiry must revalidate through the canonical task query instead of renewing a durable snapshot');

    const parallel = createHarness();
    let releaseRead;
    parallel.setReadGate(new Promise((resolve) => { releaseRead = resolve; }));
    const requests = [parallel.context.load(), parallel.context.load()];
    await new Promise(setImmediate);
    assert.equal(parallel.calls.query.length, 1, 'main calendar and side dock must retain shared in-flight loading');
    releaseRead();
    await Promise.all(requests);

    const loaded = createHarness();
    loaded.setScopeMatches(true);
    await loaded.context.load();
    assert.equal(loaded.calls.query.length, 0, 'a matching authoritative task-store scope must retain its fast path');
    await loaded.context.load({ forceFresh: true });
    assert.equal(loaded.calls.query.length, 1);
    assert.equal(loaded.calls.query[0].options.forceFresh, true);

    const failed = createHarness();
    failed.setReadError(new Error('task query failed'));
    await assert.rejects(failed.context.load(), /task query failed/);
    assert.equal(failed.context.__tmCalendarAllTasksCache, undefined, 'read failure must not promote stale startup data to a complete cache');
    failed.setReadError(null);
    await failed.context.load();
    assert.equal(failed.calls.query.length, 2, 'failed reads must release the shared load for recovery');

    assert.ok(harness.calls.query.every((call) => call.options.skipParentTaskJoin === true
        && call.options.customFieldIds.length === 0 && call.options.disableChunkedQuery === true));
    console.log('calendar recurring snapshot refresh tests passed');
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
