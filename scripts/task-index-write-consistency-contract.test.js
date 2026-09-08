'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const extract = (name) => {
    const start = source.search(new RegExp(`    (?:async )?function ${name}\\(`));
    assert.ok(start >= 0, `missing function ${name}`);
    const end = source.indexOf('\n    }', start);
    assert.ok(end > start, `missing end of ${name}`);
    return source.slice(start, end + 6);
};
const docId = (number) => `20260905000000-${String(number).padStart(7, '0')}`;
const entry = (number, updated = '20260905000000', indexedAt = Date.now()) => ({
    id: docId(number), docUpdated: updated, updatedAt: indexedAt, inTaskTree: true,
    taskCount: 1, blocks: [{ id: docId(number + 100), root_id: docId(number), content: `task ${number}` }],
});
const clone = (value) => JSON.parse(JSON.stringify(value));
const createHost = () => {
    const tails = new Map();
    const host = {
        disk: { version: 6, updatedAt: 1, docs: {} }, readError: false, writeError: false, writes: 0, onRead: null,
        locks: {
            request(name, options, callback) {
                assert.equal(options.mode, 'exclusive');
                const pending = (tails.get(name) || Promise.resolve()).then(callback);
                tails.set(name, pending.catch(() => undefined));
                return pending;
            },
        },
        async fetch(url, options) {
            if (url === '/api/file/getFile') {
                if (host.onRead) host.onRead();
                if (host.readError) return { ok: true, status: 202, text: async () => JSON.stringify({ code: -3 }) };
                if (!host.disk) return { ok: true, status: 202, text: async () => JSON.stringify({ code: 404 }) };
                return { ok: true, status: 200, text: async () => JSON.stringify(host.disk) };
            }
            assert.equal(url, '/api/file/putFile', 'writes must not issue a separate mkdir request');
            host.writes += 1;
            if (host.writeError) return { ok: true, json: async () => ({ code: -1 }) };
            host.disk = JSON.parse(await options.body.get('file').text());
            return { ok: true, json: async () => ({ code: 0 }) };
        },
    };
    return host;
};
const createWindow = (host, withLocks = true) => {
    const idle = [];
    const context = vm.createContext({
        console, Date, Map, Set, WeakMap, TextEncoder, FormData, Blob, AbortController, setTimeout, clearTimeout,
        navigator: withLocks ? { locks: host.locks } : {}, fetch: host.fetch,
        TASK_INDEX_FILE_PATH: 'index.json', TASK_SNAPSHOT_FILE_PATH: 'snapshot.json', DOC_SCOPE_CACHE_FILE_PATH: 'scope.json',
        __TM_TASK_INDEX_VERSION: 6, __TM_TASK_INDEX_MAX_DOCS: 1200,
        __TM_TASK_INDEX_MAX_BYTES: 24 * 1024 * 1024, __TM_TASK_INDEX_MAX_SINGLE_DOC_BYTES: 10 * 1024 * 1024,
        __tmTaskIndexStoreCache: null, __tmTaskIndexStoreLoadPromise: null,
        __tmDerivedCacheWriteTails: new Map(), __tmTaskIndexSaveGeneration: 0,
        __TM_TASK_SNAPSHOT_MAX_BYTES: 20 * 1024 * 1024, __TM_DOC_SCOPE_CACHE_MAX_BYTES: 5 * 1024 * 1024,
        __tmIsLikelyBlockId: (value) => /^\d{14}-[a-z0-9]{7}$/.test(value),
        __tmNormalizeDocAliasValue: (value) => value || '', __tmNormalizeDocIconValue: (value) => value || '',
        __tmNormalizeTaskSnapshotDocIds: (values) => Array.from(new Set(values)),
        __tmScheduleIdleTask: (callback) => idle.push(callback),
    });
    const functions = ['__tmReadJsonFile', '__tmWriteJsonFile', '__tmReadDerivedCacheFile', '__tmWithDerivedCacheWriteLock', '__tmEstimateJsonByteSize',
        '__tmNormalizeTaskIndexBlocksForStore', '__tmNormalizeTaskIndexStore', '__tmPruneTaskIndexStoreToLimits',
        '__tmWithTaskIndexWriteLock', '__tmPersistTaskIndexEntries', '__tmMergeTaskIndexEntries', '__tmLoadTaskIndexStore'];
    vm.runInContext(functions.map(extract).join('\n'), context);
    context.revision = 0;
    context.__tmTaskStore = {
        captureRead: () => ({ revision: context.revision }),
        isReadCurrent: (token) => token.revision === context.revision,
    };
    context.idle = idle;
    return context;
};

async function main() {
    const host = createHost();
    const first = createWindow(host);
    const second = createWindow(host);
    await Promise.all([first.__tmLoadTaskIndexStore(), second.__tmLoadTaskIndexStore()]);
    assert.deepEqual(await Promise.all([
        first.__tmMergeTaskIndexEntries([entry(1)]),
        second.__tmPersistTaskIndexEntries([entry(2)]),
    ]), [true, true]);
    assert.deepEqual(Object.keys(host.disk.docs).sort(), [docId(1), docId(2)], 'stale window caches must not overwrite other documents');

    const cached = second.__tmTaskIndexStoreCache;
    const cachedBefore = clone(cached);
    host.writeError = true;
    assert.equal(await second.__tmMergeTaskIndexEntries([entry(3)]), false);
    assert.equal(second.__tmTaskIndexStoreCache, cached);
    assert.deepEqual(clone(cached), cachedBefore, 'failed writes must not mutate nested cached docs');
    host.writeError = false;
    host.readError = true;
    const beforeReads = host.writes;
    assert.equal(await second.__tmMergeTaskIndexEntries([entry(3)]), false);
    assert.equal(host.writes, beforeReads, 'an API read error must not be treated as an empty file');
    assert.equal(await second.__tmLoadTaskIndexStore({ force: true }), cached, 'failed refreshes must preserve the confirmed cache');
    assert.deepEqual(clone(cached), cachedBefore);
    host.readError = false;

    await first.__tmMergeTaskIndexEntries([entry(1, '20260905010000', 200)]);
    await second.__tmMergeTaskIndexEntries([entry(1, '20260905000000', 300)]);
    assert.equal(host.disk.docs[docId(1)].docUpdated, '20260905010000', 'older document revisions must not replace newer index entries');
    await second.__tmMergeTaskIndexEntries([entry(1, '20260905010000', 100)]);
    assert.equal(host.disk.docs[docId(1)].updatedAt, 200);

    host.disk.padding = 'x'.repeat(2048);
    await first.__tmLoadTaskIndexStore({ force: true });
    assert.equal(first.idle.length, 1);
    await second.__tmMergeTaskIndexEntries([entry(4)]);
    await first.idle.shift()();
    assert.ok(host.disk.docs[docId(4)], 'delayed compaction must read the latest file inside the lock');

    const writesBeforeCancel = host.writes;
    const pending = first.__tmPersistTaskIndexEntries([entry(5)]);
    first.__tmTaskIndexSaveGeneration += 1;
    assert.equal(await pending, false);
    assert.equal(host.writes, writesBeforeCancel, 'superseded queued writes must not commit');
    host.onRead = () => { first.revision += 1; };
    assert.equal(await first.__tmPersistTaskIndexEntries([entry(9)]), false);
    host.onRead = null;
    assert.equal(host.writes, writesBeforeCancel, 'task changes during a disk read must invalidate the captured index projection');
    const readToken = first.__tmTaskStore.captureRead();
    first.revision += 1;
    assert.equal(await first.__tmPersistTaskIndexEntries([entry(9)], { readToken }), false);
    assert.equal(host.writes, writesBeforeCancel, 'scheduled persistence must use the token captured before building its entries');

    const fallback = createWindow(host, false);
    await Promise.all([fallback.__tmMergeTaskIndexEntries([entry(6)]), fallback.__tmMergeTaskIndexEntries([entry(7)])]);
    assert.ok(host.disk.docs[docId(6)] && host.disk.docs[docId(7)], 'the promise tail must serialize writes without Web Locks');
    host.disk = null;
    assert.equal(await first.__tmMergeTaskIndexEntries([entry(8)]), true, 'SiYuan HTTP 202 / code 404 permits first-time creation');
    assert.deepEqual(Object.keys(host.disk.docs), [docId(8)]);
    console.log('task index write consistency behavioral tests passed');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
