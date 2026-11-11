'use strict';

// Cache-first paint: the task index and the snapshot store must stay usable for
// groups where most documents have no tasks, and for groups opened by several views.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('./i18n-vm-fixture');

const main = path.join(__dirname, '../src/task-horizon/main');
const store = fs.readFileSync(path.join(main, '10-stores-rules-and-cache.js'), 'utf8');
const api = fs.readFileSync(path.join(main, '20-api-and-runtime-services.js'), 'utf8');
const extract = (name) => {
    const start = store.search(new RegExp(`    (?:async )?function ${name}\\(`));
    assert.ok(start >= 0, `missing function ${name}`);
    const end = store.indexOf('\n    }', start);
    assert.ok(end > start, `missing end of ${name}`);
    return store.slice(start, end + 6);
};
const plain = (value) => JSON.parse(JSON.stringify(value));
const docId = (index) => `20261111${String(100000 + index)}-aaaaaaa`;

async function run() {
    // 1. Documents without tasks are never stored in the index. A current count of
    //    zero must not make them "missing"; an unknown or non-zero count still must.
    const indexContext = vm.createContext({
        console, Map, Set,
        __tmIsLikelyBlockId: (value) => /^\d{14}-[a-z0-9]{7}$/.test(String(value)),
        __tmBuildTaskTreeFromTaskIndexBlocks: (entry) => (entry.blocks || []).map((block) => ({ id: block.id, children: [] })),
        __tmNormalizeDocAliasValue: (value) => String(value || ''),
        __tmNormalizeDocIconValue: (value) => String(value || ''),
    });
    vm.runInContext(['__tmNormalizeTaskSnapshotDocIds', '__tmBuildFlatTasksFromTaskSnapshotTree',
        '__tmGetExpectedTaskCountFromMap', '__tmGetExpectedTaskCountMapFromOptions',
        '__tmIsUsableTaskIndexDoc', '__tmBuildTaskIndexTaskTreeForDocs'].map(extract).join('\n')
        + '\nthis.build = __tmBuildTaskIndexTaskTreeForDocs;', indexContext);
    const [indexed, empty, unindexed, unknown] = [1, 2, 3, 4].map(docId);
    const indexStore = { docs: { [indexed]: {
        id: indexed, name: 'Indexed', updatedAt: 1, queryLimit: 20000, taskCount: 2, inTaskTree: true,
        blocks: [{ id: 'task-1' }, { id: 'task-2' }],
    } } };
    const scope = [indexed, empty, unindexed, unknown];
    const counts = new Map([[indexed, 2], [empty, 0], [unindexed, 3]]);
    for (const optionName of ['taskCountMap', 'expectedTaskCountMap']) {
        const built = indexContext.build(indexStore, scope, { queryLimit: 20000, [optionName]: counts });
        assert.deepEqual(plain(built.missingDocIds), [unindexed, unknown],
            `${optionName}: only documents that have tasks, or whose count is unknown, are missing`);
        assert.deepEqual(plain(built.taskTree.map((doc) => doc.id)), [indexed]);
        assert.equal(built.staleDocIds.length, 0);
    }
    assert.deepEqual(plain(indexContext.build(indexStore, scope, { queryLimit: 20000 }).missingDocIds),
        [empty, unindexed, unknown], 'without current counts every unindexed document stays missing');
    const outdated = indexContext.build(indexStore, scope, { queryLimit: 20000, taskCountMap: new Map([[indexed, 5], [empty, 0]]) });
    assert.deepEqual(plain(outdated.staleDocIds), [indexed], 'an indexed document with fewer tasks than the current count stays stale');

    // 2. Zero now means "no tasks", so a failed count read must report unknown.
    const start = api.indexOf('        async getTaskCountsByDocuments(');
    const end = api.indexOf('        async getTaskFreshnessByDocuments(', start);
    assert.ok(start >= 0 && end > start, 'missing getTaskCountsByDocuments');
    const apiContext = vm.createContext({ console, Map, Set, Date, Promise, setTimeout, SettingsStore: { data: {} } });
    const API = vm.runInContext(`({ ${api.slice(start, end)} })`, apiContext);
    const statements = [];
    let responses = [];
    API.call = async (url, body) => { statements.push(body.stmt); return responses.shift(); };

    responses = [{ code: 0, data: [{ root_id: docId(1), task_count: 4 }] }];
    let result = await API.getTaskCountsByDocuments([docId(1), docId(2), docId(3)]);
    assert.deepEqual(Array.from(result.map), [[docId(1), 4], [docId(2), 0], [docId(3), 0]],
        'a successful read reports zero for documents without task rows');
    assert.match(statements[0], /LIMIT 3\s*$/, 'the count query must carry an explicit row limit');

    for (const failure of [{ code: -1, msg: 'HTTP 500' }, { code: 0, data: [], truncated: true }, null]) {
        responses = [failure];
        result = await API.getTaskCountsByDocuments([docId(1), docId(2)]);
        assert.equal(result.map.size, 0, 'a failed or truncated read must leave every document unknown');
    }
    API.call = async () => { throw new Error('offline'); };
    result = await API.getTaskCountsByDocuments([docId(1)]);
    assert.equal(result.map.size, 0, 'a thrown read must leave every document unknown');

    const many = Array.from({ length: 221 }, (_, index) => docId(index));
    responses = [{ code: 0, data: [] }, { code: -1 }];
    API.call = async () => responses.shift();
    result = await API.getTaskCountsByDocuments(many);
    assert.equal(result.map.size, 220, 'only the failed chunk becomes unknown');
    assert.equal(result.map.has(many[220]), false);
    assert.equal(result.map.get(many[0]), 0);

    // 3. One group is saved with several document scopes (list views include the
    //    quick-add document, the combination board does not). They must coexist.
    const snapshotContext = vm.createContext({ console, Map, Set });
    vm.runInContext(['__tmGetPreservedTaskSnapshotBucket', '__tmSelectPreservedTaskSnapshotCandidates'].map(extract).join('\n')
        + '\nthis.select = __tmSelectPreservedTaskSnapshotCandidates;', snapshotContext);
    const snap = (groupId, name) => ({ groupId, scopeKey: `${groupId}|${name}`, preserve: true });
    const newestFirst = [
        snap('group-a', 'list'), snap('group-b', 'list'), snap('group-a', 'board-1'),
        snap('group-a', 'board-2'), snap('group-a', 'oldest'), snap('all', 'x'), snap('all', 'y'),
    ];
    assert.deepEqual(plain(snapshotContext.select(newestFirst)).map((item) => item.scopeKey), [
        'group-a|list', 'group-b|list', 'group-a|board-1', 'group-a|board-2', 'all|x', 'all|y',
    ], 'the three newest scopes of a group are kept; older ones are dropped');

    // 4. A first paint must not wait for the "did the snapshot file change" check
    //    when a store is already in memory; the check still runs in the background.
    let releasePeek;
    let peeks = 0;
    let loads = 0;
    const refreshContext = vm.createContext({
        console, Date, Promise,
        __tmTaskSnapshotStoreCache: { updatedAt: 1 },
        __tmTaskSnapshotStoreLoadedAt: 0,
        __tmGetTaskSnapshotStoreVersionSignature: () => 'v1',
        __tmGetTaskSnapshotFileMetaSignatureCached: () => 'same',
        __tmScheduleTaskSnapshotFileMetaCacheRefresh: () => {},
        __tmRememberTaskSnapshotFileMeta: () => {},
        __tmPeekTaskSnapshotFileMeta: () => { peeks += 1; return new Promise((resolve) => { releasePeek = () => resolve({ signature: 'same' }); }); },
        __tmPeekTaskSnapshotStoreVersionMeta: async () => ({}),
        __tmLoadTaskSnapshotStore: async () => { loads += 1; return { updatedAt: 2 }; },
    });
    vm.runInContext(extract('__tmRefreshTaskSnapshotStoreCacheIfChanged')
        + '\nthis.refresh = __tmRefreshTaskSnapshotStoreCacheIfChanged;', refreshContext);
    const deferred = await refreshContext.refresh({ source: 'snapshot-first-paint', background: true });
    assert.equal(deferred.deferred, true, 'with a store in memory the check must return without waiting');
    assert.equal(peeks, 1, 'the check must still run in the background');
    const blocking = refreshContext.refresh({ source: 'other' });
    let settled = false;
    blocking.then(() => { settled = true; });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(settled, false, 'other callers keep waiting for the check');
    releasePeek();
    assert.equal((await blocking).fileMetaUnchanged, true);
    refreshContext.__tmTaskSnapshotStoreCache = null;
    vm.runInContext('__tmTaskSnapshotStoreCache = null;', refreshContext);
    const initial = await refreshContext.refresh({ source: 'snapshot-first-paint', background: true });
    assert.equal(initial.initialized, true, 'without a store in memory the first read is still awaited');
    assert.equal(loads, 1);

    console.log('cache first-paint behavior tests passed');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
