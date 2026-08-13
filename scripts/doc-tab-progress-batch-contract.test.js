'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'task-horizon', 'main', '20-api-and-runtime-services.js'),
    'utf8',
);

function sliceSource(startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    assert.ok(start >= 0 && end > start, `missing source range: ${startMarker}`);
    return source.slice(start, end);
}

function deferred() {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    return { promise, resolve };
}

function createRuntime(fetchImpl) {
    const context = vm.createContext({
        console,
        Date,
        Map,
        Set,
        Promise,
        setTimeout,
        clearTimeout,
        fetch: fetchImpl,
        window: {},
        __tmRememberSmallCache: (map, key, value, limit) => {
            if (map.has(key)) map.delete(key);
            map.set(key, value);
            while (map.size > limit) map.delete(map.keys().next().value);
            return value;
        },
    });
    vm.runInContext(`${sliceSource(
        'const __TM_DOC_PROGRESS_CACHE_TTL_MS',
        '    const __TM_DOC_EXPECTED_START_ATTR',
    )}\n${sliceSource(
        'function __tmGetFreshDocProgress',
        '    window.__tmUpdateDocTabProgress',
    )}\nglobalThis.invalidateProgress = __tmInvalidateDocProgressCache;`, context);
    return context;
}

(async () => {
    {
        let sqlCount = 0;
        let lastSql = '';
        const context = createRuntime(async (_url, request) => {
            sqlCount += 1;
            lastSql = JSON.parse(request.body).stmt;
            const ids = Array.from(lastSql.matchAll(/'(doc-\d+)'/g), (match) => match[1]);
            return {
                json: async () => ({
                    data: ids.map((rootId) => ({ root_id: rootId, total: 4, completed: 2 })),
                }),
            };
        });
        const ids = Array.from({ length: 100 }, (_, index) => `doc-${index}`);
        const result = await context.window.__tmLoadDocProgressBatch(ids);
        assert.equal(sqlCount, 1, '100 tab progress requests in one tick must use one SQL query');
        assert.match(lastSql, /root_id IN \(/);
        assert.match(lastSql, /GROUP BY root_id/);
        assert.equal(result.size, 100);
        assert.equal(result.get('doc-42'), 50);
    }

    {
        const firstQuery = deferred();
        const firstStarted = deferred();
        let sqlCount = 0;
        const context = createRuntime(async () => {
            sqlCount += 1;
            if (sqlCount === 1) {
                firstStarted.resolve();
                await firstQuery.promise;
                return { json: async () => ({ data: [{ root_id: 'doc-stale', total: 1, completed: 1 }] }) };
            }
            return { json: async () => ({ data: [{ root_id: 'doc-stale', total: 1, completed: 0 }] }) };
        });
        const pending = context.window.__tmLoadDocProgressBatch(['doc-stale']);
        await firstStarted.promise;
        context.invalidateProgress('doc-stale');
        firstQuery.resolve();
        const result = await pending;
        assert.equal(sqlCount, 2, 'invalidating an in-flight document must retry it once');
        assert.equal(result.get('doc-stale'), 0, 'stale SQL results must not refill the progress cache');
    }

    {
        let sqlCount = 0;
        const context = createRuntime(async () => {
            sqlCount += 1;
            return { ok: true, json: async () => ({ code: -1, data: [] }) };
        });
        const result = await context.window.__tmLoadDocProgressBatch(['doc-error']);
        assert.equal(result.get('doc-error'), 0, 'SQL errors may fall back for the current render');
        await context.window.__tmLoadDocProgressBatch(['doc-error']);
        assert.equal(sqlCount, 2, 'SQL errors must not be cached as authoritative zero progress');
    }

    console.log('document tab progress batch contract tests passed');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
