'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = (file) => fs.readFileSync(path.join(__dirname, '../src/task-horizon/main', file), 'utf8');
const source = read('20-api-and-runtime-services.js');
const stores = read('10-stores-rules-and-cache.js');
const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((accept, fail) => { resolve = accept; reject = fail; });
    return { promise, resolve, reject };
};
let revision = 0;
let requests = [];
const api = Object.fromEntries(['getTasksByDocument', 'getTasksByDocuments', 'getTasksByIds', 'getTaskById'].map((method) => [method, (...args) => {
    const pending = deferred();
    requests.push({ method, args, ...pending });
    return pending.promise;
}]));
const settings = { data: { settingsUpdatedAt: 1 } };
const context = vm.createContext({ console, Map, Set, Date, structuredClone, API: api,
    SettingsStore: settings, __tmTaskReadInFlight: new Map(), __tmTaskReadGeneration: 0,
    __tmGetTaskInlineAttrSpecs: () => [{ name: 'custom-priority' }], __tmGetCustomFieldDefs: () => [],
    __tmTaskStore: { captureRead: (docIds) => ({ revision, docIds }), isReadCurrent: (token) => token.revision === revision } });
const start = source.indexOf('    function __tmTaskReadSettingsSignature(');
const end = source.indexOf('    globalThis.__tmGetTaskTitlePresentation', start);
assert.ok(start >= 0 && end > start);
vm.runInContext(source.slice(start, end), context);
const cacheStart = stores.indexOf('const __TM_TASK_QUERY_CACHE_MAX_ENTRIES');
const cacheEnd = stores.indexOf('    const __tmDocExpandCache', cacheStart);
vm.runInContext(stores.slice(cacheStart, cacheEnd), context);
const tick = () => Promise.resolve();
const payload = () => ({ tasks: [{ id: 'task', customFieldValues: { choices: ['first'] }, children: [{ id: 'child' }] }] });

async function main() {
    const first = api.getTasksByDocuments(['20260905-b', '20260905-a'], 500, { customFieldIds: [] });
    const second = api.getTasksByDocuments(['20260905-a', '20260905-b'], 500, { customFieldIds: [] });
    await tick();
    assert.equal(requests.length, 1, 'share the entire identical task read, not only SQL');
    requests[0].resolve(payload());
    const [firstResult, secondResult] = await Promise.all([first, second]);
    firstResult.tasks[0].customFieldValues.choices.push('changed');
    firstResult.tasks[0].children[0].id = 'changed';
    assert.deepEqual(secondResult.tasks[0].customFieldValues.choices, ['first']);
    assert.equal(secondResult.tasks[0].children[0].id, 'child');
    assert.equal(context.__tmTaskReadInFlight.size, 0, 'completed reads must not become a second result cache');
    requests = [];
    const variants = [
        api.getTasksByDocuments(['20260905-a'], 500, { customFieldIds: [] }),
        api.getTasksByDocuments(['20260905-a'], 500, { customFieldIds: ['field'] }),
        api.getTasksByDocuments(['20260905-a'], 500, { customFieldIds: [], forceFresh: true }),
        api.getTasksByDocuments(['20260905-a'], 1000, { customFieldIds: [] }),
        api.getTasksByIds(['20260905-a', '20260905-b']),
        api.getTasksByIds(['20260905-b', '20260905-a']),
        api.getTasksByDocument('20260905-a', null),
        api.getTasksByDocument('20260905-a'),
    ];
    await tick();
    assert.equal(requests.length, variants.length, 'query coverage, option values and task-ID order must remain distinct');
    requests.forEach((request) => request.resolve(payload()));
    await Promise.all(variants);
    requests = [];
    const failed = api.getTaskById('20260905-a');
    const alsoFailed = api.getTaskById('20260905-a');
    const failures = Promise.allSettled([failed, alsoFailed]);
    await tick();
    requests[0].reject(new Error('read failed'));
    assert.ok((await failures).every((result) => result.status === 'rejected'));
    assert.equal(context.__tmTaskReadInFlight.size, 0);
    const retry = api.getTaskById('20260905-a');
    await tick();
    assert.equal(requests.length, 2);
    requests[1].resolve(null);
    assert.equal(await retry, null);

    requests = [];
    const stale = api.getTasksByDocument('20260905-a');
    const staleCheck = stale.then((result) => assert.deepEqual(result, payload()));
    await tick();
    context.__tmTaskReadGeneration += 1;
    context.__tmTaskReadInFlight.clear();
    const current = api.getTasksByDocument('20260905-a');
    await tick();
    requests[0].resolve(payload());
    await staleCheck;
    assert.equal(context.__tmTaskReadInFlight.size, 1, 'old completion must not remove a newer in-flight read');
    const joined = api.getTasksByDocument('20260905-a');
    await tick();
    assert.equal(requests.length, 2);
    requests[1].resolve(payload());
    await Promise.all([current, joined]);

    requests = [];
    const olderRevision = api.getTasksByDocument('20260905-a');
    const oldCheck = olderRevision.then((result) => assert.deepEqual(result, payload()));
    const oldToken = context.__tmCaptureTaskReadToken(['20260905-a']);
    await tick();
    revision += 1;
    const newRevision = api.getTasksByDocument('20260905-a');
    await tick();
    assert.equal(requests.length, 2, 'a mutation must break sharing with pre-mutation reads');
    const cacheEntry = { t: Date.now(), ttl: 60000, docIdSet: new Set(['20260905-a']), v: payload() };
    assert.equal(context.__tmRememberTaskQueryCache('stale', cacheEntry, oldToken), null, 'late reads cannot refill invalidated result caches');
    requests[0].resolve(payload());
    requests[1].resolve(payload());
    await oldCheck;
    await newRevision;
    const currentToken = context.__tmCaptureTaskReadToken(['20260905-a']);
    context.__tmRememberTaskQueryCache('current', cacheEntry, currentToken);
    assert.ok(context.__tmGetTaskQueryCache('current', 60000));
    settings.data.settingsUpdatedAt += 1;
    assert.equal(context.__tmGetTaskQueryCache('current', 60000), null, 'settings changes invalidate task result semantics');

    requests = [];
    const bounded = Array.from({ length: 80 }, (_, index) => api.getTaskById(`20260905-id${index}`));
    await tick();
    assert.equal(requests.length, 80);
    assert.equal(context.__tmTaskReadInFlight.size, 64, 'in-flight bookkeeping must stay bounded without dropping reads');
    requests.forEach((request) => request.resolve({ id: request.args[0] }));
    await Promise.all(bounded);
    assert.equal(context.__tmTaskReadInFlight.size, 0);
    assert.equal((source.match(/ttl: cacheTtlMs \}, cacheReadToken\)/g) || []).length, 4);
    assert.match(source, /const queryModeKey = [^\n]*disableChunkedQuery[^\n]*disableLegacyPerDocQuery[^\n]*configuredDocChunkSize/);
    assert.match(source, /const cacheKey = `getTasksByDocuments:[^\n]*\$\{queryModeKey\}/, 'result cache coverage must distinguish chunked and capped reads too');
    await verifySqlCleanup();
    await verifySqlRowIsolation();
    console.log('task read coalescing behavior tests passed');
}

async function verifySqlRowIsolation() {
    const shared = { code: 0, data: [{ id: '20260905-a' }] };
    let owner = 0;
    const methodStart = source.indexOf('        async getTaskById(');
    const methodEnd = source.indexOf('\n        },', methodStart) + 11;
    const rowContext = vm.createContext({
        __tmBuildTaskInlineAttrScalarSelectSql: () => 'task.id',
        __tmApplyTaskAttrHostOverrides: async (rows) => { owner += 1; rows[0].owner = owner; },
        __tmAttachCustomFieldAttrsToTasks: async () => {},
    });
    vm.runInContext(`globalThis.api = { ${source.slice(methodStart, methodEnd)} };`, rowContext);
    rowContext.api.call = async () => shared;
    const [first, second] = await Promise.all([rowContext.api.getTaskById('20260905-a'), rowContext.api.getTaskById('20260905-a')]);
    assert.notEqual(first.owner, second.owner, 'separate enrichment pipelines must own their SQL row objects');
    assert.equal(shared.data[0].owner, undefined, 'shared SQL payloads must remain unmodified');
}

async function verifySqlCleanup() {
    const queued = [];
    const callStart = source.indexOf('        async call(');
    const callEnd = source.indexOf('\n        },', callStart) + 11;
    const sqlContext = vm.createContext({ __tmTaskReadGeneration: 0, __tmSqlInFlight: new Map(),
        __tmSqlQueue: {}, __tmRunSqlQueued: () => { const job = deferred(); queued.push(job); return job.promise; } });
    vm.runInContext(`globalThis.api = { ${source.slice(callStart, callEnd)} };`, sqlContext);
    const oldRequest = sqlContext.api.call('/api/query/sql', { stmt: 'SELECT id FROM blocks' });
    sqlContext.__tmSqlInFlight.clear();
    const newRequest = sqlContext.api.call('/api/query/sql', { stmt: 'SELECT id FROM blocks' });
    queued[0].resolve({ code: 0, data: [] });
    await oldRequest;
    assert.equal(sqlContext.__tmSqlInFlight.size, 1, 'SQL cleanup must also compare promise identity');
    queued[1].resolve({ code: 0, data: [] });
    await newRequest;
    assert.equal(sqlContext.__tmSqlInFlight.size, 0);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
