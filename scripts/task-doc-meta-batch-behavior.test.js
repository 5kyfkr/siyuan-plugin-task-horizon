'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const apiSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const storeSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const docId = (n) => `20261115000000-${String(n).padStart(7, '0')}`;
const deferred = () => {
    let resolve;
    const promise = new Promise((yes) => { resolve = yes; });
    return { promise, resolve };
};
const apiMethodsStart = apiSource.indexOf('        async getDocMetaByIds(');
const apiMethodsLast = apiSource.indexOf('        async getDocMetaById(', apiMethodsStart);
const apiMethodsEnd = apiSource.indexOf('\n        },', apiMethodsLast) + '\n        },'.length;
assert.ok(apiMethodsStart >= 0 && apiMethodsLast > apiMethodsStart && apiMethodsEnd > apiMethodsLast);
const apiMethods = apiSource.slice(apiMethodsStart, apiMethodsEnd);

function createApi() {
    const context = vm.createContext({
        Map,
        Set,
        __tmDocMetaReadInFlight: new Map(),
        __tmT: () => 'Untitled',
    });
    vm.runInContext(`globalThis.api = {${apiMethods}};`, context);
    context.api.__inFlight = context.__tmDocMetaReadInFlight;
    return context.api;
}

function idsFromSql(stmt) {
    return Array.from(new Set(String(stmt || '').match(/\d{14}-[a-z0-9]{7}/g) || []));
}

test('document metadata reads are batched and in-flight requests share one SQL per chunk', async () => {
    const api = createApi();
    const ids = Array.from({ length: 450 }, (_, index) => docId(index));
    const requests = [];
    const pending = deferred();
    api.call = async (_url, { stmt }) => {
        requests.push(stmt);
        if (requests.length === 1) await pending.promise;
        return {
            code: 0,
            data: idsFromSql(stmt).map((id) => ({ id, content: `Doc ${id}`, hpath: `/Book/${id}`, box: 'box' })),
        };
    };
    api.getHPathByID = async () => assert.fail('complete SQL metadata must not use per-document fallback');
    const first = api.getDocMetaByIds(ids);
    const second = api.getDocMetaByIds(ids.slice().reverse());
    await Promise.resolve();
    assert.equal(requests.length, 1, 'the same first chunk must share one in-flight request');
    pending.resolve();
    const [firstMap, secondMap] = await Promise.all([first, second]);
    assert.equal(requests.length, 3, '450 documents require three bounded SQL chunks');
    assert.equal(firstMap.size, 450);
    assert.equal(secondMap.size, 450);
    firstMap.get(ids[0]).name = 'Mutated';
    assert.notEqual(secondMap.get(ids[0]).name, 'Mutated', 'consumers must not share mutable metadata objects');
    assert.equal(api.__inFlight.size, 0);
});

test('batch metadata falls back to the document-path endpoint only for IDs missing from SQL', async () => {
    const api = createApi();
    const ids = [docId(1), docId(2)];
    let sqlCalls = 0;
    let fallbackCalls = 0;
    api.call = async () => {
        sqlCalls += 1;
        return { code: 0, data: [{ id: ids[0], content: 'Known', hpath: '/Book/Known', box: 'box' }] };
    };
    api.getHPathByID = async (id) => {
        fallbackCalls += 1;
        return `/Book/${id}`;
    };
    const result = await api.getDocMetaByIds(ids);
    assert.equal(sqlCalls, 1);
    assert.equal(fallbackCalls, 1);
    assert.equal(result.get(ids[0]).name, 'Known');
    assert.equal(result.get(ids[1]).path, `/Book/${ids[1]}`);
});

function extractFunction(source, name) {
    const start = source.indexOf(`    async function ${name}(`);
    assert.ok(start >= 0, `${name} must exist`);
    const bodyStart = source.indexOf('{', start);
    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        if (source[index] !== '}') continue;
        depth -= 1;
        if (depth === 0) return source.slice(start, index + 1);
    }
    throw new Error(`Unable to extract ${name}`);
}

test('configured task scope resolves missing documents through one batch instead of per-document SQL', async () => {
    const quickAdd = docId(1);
    const selected = docId(2);
    const batchCalls = [];
    const context = vm.createContext({
        Map,
        Set,
        SettingsStore: { data: { newTaskDocId: quickAdd, selectedDocIds: [selected], docGroups: [] } },
        state: { allDocuments: [] },
        API: {
            async getDocMetaByIds(ids) {
                batchCalls.push(ids.slice());
                return new Map(ids.map((id) => [id, {
                    id, name: `Doc ${id}`, path: `/Book/${id}`, notebook: 'box',
                }]));
            },
            async getDocMetaById() {
                assert.fail('batch-capable API must not use per-document reads');
            },
        },
        __tmIsLikelyBlockId: (id) => /^\d{14}-[a-z0-9]{7}$/.test(id),
        __tmGetGroupSourceEntries: () => [],
        __tmExpandSourceEntryDocIds: async () => { throw new Error('force metadata fallback'); },
        __tmT: () => 'Untitled',
    });
    vm.runInContext(`${extractFunction(storeSource, '__tmCollectAllConfiguredTaskScopeDocIds')}
this.collect = __tmCollectAllConfiguredTaskScopeDocIds;`, context);
    const result = await context.collect();
    assert.deepEqual(Array.from(result), [quickAdd, selected]);
    assert.deepEqual(JSON.parse(JSON.stringify(batchCalls)), [[quickAdd, selected]]);
    assert.equal(context.state.allDocuments.length, 2);
});

const fallbackMapStart = storeSource.indexOf('    async function __tmBuildDocQueryInfoMapWithFallback(');
const fallbackMapEnd = storeSource.indexOf('\n    function __tmApplyDocQueryInfoToTasks(', fallbackMapStart);
const fallbackMapSource = storeSource.slice(fallbackMapStart, fallbackMapEnd);
assert.match(fallbackMapSource, /API\.getDocMetaByIds\(missingIds\)/,
    'task query enrichment must reuse the shared document metadata batch');
assert.match(fallbackMapSource, /metaById instanceof Map[\s\S]*docsById[\s\S]*missingIds\.forEach/,
    'batch metadata must update the existing document cache without one request per document');

console.log('task document metadata batch behavioral tests passed');
