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
    assert.ok(end > start);
    return source.slice(start, end + 6);
};
let now = 100000;
const context = vm.createContext({
    Map, WeakMap, FormData, Blob, AbortController, setTimeout, clearTimeout,
    Date: class extends Date { static now() { return now; } },
    TASK_INDEX_FILE_PATH: 'index.json', TASK_SNAPSHOT_FILE_PATH: 'snapshot.json', DOC_SCOPE_CACHE_FILE_PATH: 'scope.json',
    __tmTimedCachePrunedAt: new WeakMap(),
    __TM_TASK_INDEX_MAX_BYTES: 24 * 1024 * 1024, __TM_TASK_SNAPSHOT_MAX_BYTES: 20 * 1024 * 1024,
    __TM_DOC_SCOPE_CACHE_MAX_BYTES: 5 * 1024 * 1024,
});
vm.runInContext(['__tmReadJsonFile', '__tmReadDerivedCacheFile', '__tmWriteJsonFile', '__tmRememberSmallCache', '__tmRememberTimedCache'].map(extract).join('\n'), context);

async function main() {
    for (const payload of [{ code: -1 }, { code: null }, { code: '0' }, {}, null]) {
        context.fetch = async () => ({ ok: true, json: async () => payload });
        assert.equal(await context.__tmWriteJsonFile('index.json', {}), false, 'HTTP success alone is not a successful SiYuan file write');
    }
    context.fetch = async () => ({ ok: false, json: async () => ({ code: 0 }) });
    assert.equal(await context.__tmWriteJsonFile('index.json', {}), false);
    context.fetch = async () => ({ ok: true, json: async () => { throw new Error('invalid JSON'); } });
    assert.equal(await context.__tmWriteJsonFile('index.json', {}), false);
    let calls = 0;
    context.fetch = async (url, options) => {
        calls += 1;
        assert.equal(url, '/api/file/putFile');
        assert.equal(options.body.get('path'), 'index.json');
        assert.equal(await options.body.get('file').text(), JSON.stringify({ docs: {} }));
        return { ok: true, json: async () => ({ code: 0 }) };
    };
    assert.equal(await context.__tmWriteJsonFile('index.json', { docs: {} }), true);
    assert.equal(calls, 1);

    for (const response of [
        { ok: false, status: 503 },
        { ok: true, status: 202, text: async () => JSON.stringify({ code: 403 }) },
        { ok: true, status: 200, text: async () => 'truncated {' },
        { ok: true, status: 200, text: async () => 'null' },
        { ok: true, status: 200, text: async () => '' },
    ]) {
        context.fetch = async () => response;
        await assert.rejects(context.__tmReadJsonFile('index.json', { strict: true }));
        assert.equal(await context.__tmReadJsonFile('index.json'), null);
    }
    for (const response of [
        { ok: false, status: 404 },
        { ok: true, status: 202, text: async () => JSON.stringify({ code: 404 }) },
    ]) {
        context.fetch = async () => response;
        assert.equal(await context.__tmReadJsonFile('index.json', { strict: true }), null);
    }
    context.fetch = async () => { throw new Error('offline'); };
    await assert.rejects(context.__tmReadJsonFile('index.json', { strict: true }));

    context.fetch = async (url, options) => new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
    await assert.rejects(context.__tmReadJsonFile('index.json', { strict: true, timeoutMs: 5 }), /aborted/);
    await exerciseRecovery();

    let visits = 0;
    class CountingMap extends Map {
        *entries() {
            for (const item of super.entries()) { visits += 1; yield item; }
        }
    }
    const cache = new CountingMap();
    for (let index = 0; index < 10000; index += 1) {
        context.__tmRememberTimedCache(cache, `key-${index}`, { t: now, value: index }, 128, 300000);
        assert.ok(cache.size <= 128);
    }
    assert.ok(visits < 256, 'a batch must not scan the entire cache for each insertion');
    assert.equal(cache.has('key-0'), false);
    assert.equal(cache.has('key-9999'), true);
    now += 300001;
    context.__tmRememberTimedCache(cache, 'fresh', { t: now }, 128, 300000);
    assert.deepEqual(Array.from(cache.keys()), ['fresh']);
    for (let index = 0; index < 200; index += 1) {
        context.__tmRememberSmallCache(cache, `signature-${index}`, { token: 'a'.repeat(64) }, 24);
    }
    assert.equal(cache.size, 24, 'persist signature memory must remain bounded');
    console.log('task storage I/O and cache behavioral tests passed');
}

async function exerciseRecovery() {
    const broken = 'truncated {';
    const files = new Map([['index.json', broken]]);
    let writeCalls = 0;
    let failBackup = false;
    let unavailable = false;
    let invalidResponse = false;
    context.fetch = async (url, options) => {
        if (url === '/api/file/getFile') {
            const file = JSON.parse(options.body).path;
            if (unavailable) return { ok: true, status: 202, text: async () => JSON.stringify({ code: 403 }) };
            if (invalidResponse) return { ok: true, status: 202, text: async () => broken };
            if (!files.has(file)) return { ok: false, status: 404 };
            return { ok: true, status: 200, text: async () => files.get(file) };
        }
        writeCalls += 1;
        const file = options.body.get('path');
        if (failBackup && file.endsWith('.corrupt.json')) return { ok: true, json: async () => ({ code: -1 }) };
        files.set(file, await options.body.get('file').text());
        return { ok: true, json: async () => ({ code: 0 }) };
    };
    assert.equal(await context.__tmReadDerivedCacheFile('index.json'), null);
    assert.equal(JSON.parse(files.get('index.json.corrupt.json')).rawText, broken, 'recovery must back up the original content before replacing a derived cache');
    assert.deepEqual(JSON.parse(files.get('index.json')), {});
    const writes = writeCalls;
    await context.__tmReadDerivedCacheFile('index.json');
    assert.equal(writeCalls, writes, 'a successful recovery must not keep backing up on every read');

    files.set('index.json', broken);
    failBackup = true;
    await assert.rejects(context.__tmReadDerivedCacheFile('index.json'));
    assert.equal(files.get('index.json'), broken, 'failed backup must not erase the damaged original');
    failBackup = false;
    files.set('settings.json', broken);
    const beforeFailure = writeCalls;
    await assert.rejects(context.__tmReadDerivedCacheFile('settings.json'));
    unavailable = true;
    await assert.rejects(context.__tmReadDerivedCacheFile('index.json'));
    unavailable = false;
    invalidResponse = true;
    await assert.rejects(context.__tmReadDerivedCacheFile('index.json'));
    invalidResponse = false;
    context.__TM_TASK_INDEX_MAX_BYTES = 4;
    await assert.rejects(context.__tmReadDerivedCacheFile('index.json'));
    assert.equal(writeCalls, beforeFailure, 'settings, API failures and oversized corrupt files must never be automatically overwritten');
    assert.equal(files.get('index.json'), broken);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
