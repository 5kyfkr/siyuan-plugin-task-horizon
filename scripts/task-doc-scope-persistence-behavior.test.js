'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const extract = (name) => {
    const start = source.search(new RegExp(`    (?:async )?function ${name}\\(`));
    assert.ok(start >= 0, `missing ${name}`);
    return source.slice(start, source.indexOf('\n    }', start) + 6);
};
const clone = (value) => JSON.parse(JSON.stringify(value));
const docId = (number) => `20260905000000-${String(number).padStart(7, '0')}`;
const host = { disk: { version: 1, updatedAt: Date.now(), scopes: {} }, writes: 0, failRead: false, failWrite: false, beforeWrite: null };
const lockTails = new Map();
const createWindow = () => {
    const timers = new Map();
    const idle = [];
    let timerId = 0;
    const context = vm.createContext({
        Date, Map, Set, TextEncoder, console, window: {},
        __TM_DOC_SCOPE_CACHE_VERSION: 1, __TM_DOC_SCOPE_CACHE_MAX_AGE_MS: 7 * 86400000,
        __TM_DOC_SCOPE_CACHE_MAX_SCOPES: 48, __TM_DOC_SCOPE_CACHE_MAX_BYTES: 5 * 1024 * 1024,
        DOC_SCOPE_CACHE_FILE_PATH: 'scope.json',
        __tmIsLikelyBlockId: (value) => /^\d{14}-[a-z0-9]{7}$/.test(value),
        __tmDerivedCacheWriteTails: new Map(),
        navigator: { locks: { request: (name, options, callback) => {
            const pending = (lockTails.get(name) || Promise.resolve()).then(callback);
            lockTails.set(name, pending.catch(() => undefined));
            return pending;
        } } },
        setTimeout: (callback) => { timers.set(++timerId, callback); return timerId; },
        clearTimeout: (id) => timers.delete(id),
        __tmScheduleIdleTask: (callback) => idle.push(callback),
        __tmReadJsonFile: async () => {
            if (host.failRead) throw new Error('unavailable');
            return clone(host.disk);
        },
        __tmReadDerivedCacheFile: async () => context.__tmReadJsonFile(),
        __tmWriteJsonFile: async (file, store) => {
            host.writes += 1;
            if (host.beforeWrite) await host.beforeWrite();
            if (host.failWrite) return false;
            host.disk = clone(store);
            return true;
        },
    });
    const helpers = ['__tmEstimateJsonByteSize', '__tmNormalizeDocScopeDocIds', '__tmNormalizeDocScopeCache', '__tmPruneDocScopeCacheToLimits'];
    if (source.includes('function __tmWithDerivedCacheWriteLock(')) helpers.push('__tmWithDerivedCacheWriteLock');
    const start = source.indexOf('    let __tmDocScopeCacheStore = null;');
    const end = source.indexOf('    function __tmScheduleWarmDocScopeCache(', start);
    vm.runInContext(helpers.map(extract).join('\n') + source.slice(start, end) + extract('__tmInvalidateDocScopeCache'), context);
    const flush = async () => {
        const pending = Array.from(timers.values());
        timers.clear();
        pending.forEach((callback) => callback());
        for (let index = 0; index < 30; index += 1) await new Promise((resolve) => setImmediate(resolve));
    };
    return { context, flush, idle };
};

async function main() {
    const first = createWindow();
    const second = createWindow();
    first.context.__tmRememberDocScope('scope-A', [docId(1)]);
    first.context.__tmRememberDocScope('scope-B', [docId(2)]);
    await first.flush();
    assert.deepEqual(Object.keys(host.disk.scopes).sort(), ['scope-A', 'scope-B'], 'debouncing must persist every pending scope, not just the final closure');

    first.context.__tmRememberDocScope('scope-C', [docId(3)]);
    second.context.__tmRememberDocScope('scope-D', [docId(4)]);
    await Promise.all([first.flush(), second.flush()]);
    assert.deepEqual(Object.keys(host.disk.scopes).sort(), ['scope-A', 'scope-B', 'scope-C', 'scope-D'], 'windows must merge under the same lock');

    host.beforeWrite = async () => {
        host.beforeWrite = null;
        first.context.__tmRememberDocScope('scope-A', [docId(8)]);
    };
    first.context.__tmRememberDocScope('scope-A', [docId(7)]);
    await first.flush();
    assert.deepEqual(Array.from(first.context.__tmGetCachedDocScope('scope-A').docIds), [docId(8)], 'an update arriving during write must remain visible');
    await first.flush();
    assert.deepEqual(host.disk.scopes['scope-A'].docIds, [docId(8)], 'only the captured pending revision may be cleared');

    host.failWrite = true;
    first.context.__tmRememberDocScope('retry', [docId(5)]);
    await first.flush();
    assert.equal(host.disk.scopes.retry, undefined);
    host.failWrite = false;
    first.context.__tmRememberDocScope('trigger', [docId(6)]);
    await first.flush();
    assert.ok(host.disk.scopes.retry, 'a failed write must keep its pending entry for the next flush');
    host.failRead = true;
    const writes = host.writes;
    first.context.__tmRememberDocScope('offline', [docId(9)]);
    await first.flush();
    assert.equal(host.writes, writes, 'an unavailable cache must never be treated as an empty file');
    host.failRead = false;

    host.disk.scopes.expired = { key: 'expired', docIds: [docId(99)], updatedAt: 1, padding: 'x'.repeat(2048) };
    await second.context.__tmLoadDocScopeCacheStore({ force: true });
    assert.equal(second.idle.length, 1);
    host.disk.scopes.external = { key: 'external', docIds: [docId(10)], updatedAt: Date.now() };
    await second.idle.shift()();
    assert.ok(host.disk.scopes.external, 'delayed compaction must read current disk state');
    assert.equal(host.disk.scopes.expired, undefined);
    first.context.__tmRememberDocScope('cancelled', [docId(11)]);
    first.context.__tmInvalidateDocScopeCache();
    await first.flush();
    assert.equal(host.disk.scopes.cancelled, undefined, 'scope invalidation must cancel stale pending work');
    for (let index = 0; index < 100; index += 1) {
        first.context.__tmRememberDocScope(`bounded-${index}`, [docId(index + 200)]);
    }
    assert.ok(vm.runInContext('__tmDocScopeCachePending.size', first.context) <= 48, 'pending failures and updates must remain bounded');
    await first.context.__tmLoadDocScopeCacheStore({ force: true });
    assert.ok(vm.runInContext('Object.keys(__tmDocScopeCacheStore.scopes).length', first.context) <= 48, 'loaded cache plus pending overlays must respect the scope limit');
    await first.flush();
    assert.ok(Object.keys(host.disk.scopes).length <= 48);
    console.log('task document scope persistence behavioral tests passed');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
