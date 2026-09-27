'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../src/task-horizon/main');
const dialog = fs.readFileSync(path.join(root, '30-dialogs-and-ui-foundation.js'), 'utf8');
const apiSource = fs.readFileSync(path.join(root, '20-api-and-runtime-services.js'), 'utf8');
const probeStart = dialog.indexOf('    async function __tmProbeCurrentGroupTaskFreshness(');
const verifyStart = dialog.indexOf('    async function __tmVerifyCachedTaskScope(');
const verifyEnd = dialog.indexOf('    function __tmScheduleDocGroupSwitchVerifyAfterFirstPaint(');
assert.ok(probeStart > 0 && verifyStart > probeStart && verifyEnd > verifyStart);
const id = (n) => `20260925000000-${String(n).padStart(7, '0')}`;
const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function deferred() { let resolve; const promise = new Promise((yes) => { resolve = yes; }); return { promise, resolve }; }
function harness(overrides = {}) {
    const calls = { probe: 0, batches: [], full: 0, projection: 0, index: [], snapshot: [] };
    const context = vm.createContext({ Map, Set, console, Date, setTimeout,
        state: { openToken: 1, __tmLoadedDocIdsForTasks: Array.from({ length: 697 }, (_, i) => id(i)), taskTree: [], allDocuments: [] },
        SettingsStore: { data: { currentGroupId: 'all' } },
        __TM_TASK_INDEX_QUERY_LIMIT: 100000,
        __tmIsLikelyBlockId: (value) => /^\d{14}-[a-z0-9]{7}$/.test(String(value || '')),
        __tmProbeCurrentGroupTaskFreshness: async () => { calls.probe++; return { status: 'unchanged' }; },
        __tmRefreshAffectedDocsIncrementally: async (options) => { calls.batches.push(options); return true; },
        loadSelectedDocuments: async () => { calls.full++; return true; },
        __tmRecomputeTaskProjection: () => { calls.projection++; },
        __tmSchedulePersistTaskIndex: (options) => calls.index.push(options),
        __tmSchedulePersistTaskSnapshot: (options) => calls.snapshot.push(options),
        ...overrides,
    });
    vm.runInContext(dialog.slice(verifyStart, verifyEnd), context);
    return { context, calls, verify: (options) => context.__tmVerifyCachedTaskScope(options) };
}

test('697 unchanged cached documents require no task, DOM, projection or cache rewrite work', async () => {
    const h = harness();
    const result = await h.verify();
    assert.equal(result.complete, true);
    assert.equal(result.changed, false);
    assert.equal(h.calls.probe, 1);
    assert.equal(h.calls.full + h.calls.projection + h.calls.batches.length + h.calls.index.length + h.calls.snapshot.length, 0);
});

test('only changed documents refresh; sequential batches merge persistence and projection', async () => {
    const h = harness();
    const changedDocIds = Array.from({ length: 25 }, (_, i) => id(i));
    const map = new Map();
    let active = 0, peak = 0;
    h.context.__tmRefreshAffectedDocsIncrementally = async (options) => {
        h.calls.batches.push(options);
        peak = Math.max(peak, ++active);
        await tick();
        active--;
        assert.equal(options.commitView, false);
        assert.equal(options.persistCaches, false);
        assert.equal(options.docFreshnessMap, map);
        assert.equal(options.isCurrent(), true);
        return true;
    };
    const result = await h.verify({ freshness: { status: 'changed', changedDocIds, docFreshnessMap: map } });
    assert.equal(result.complete, true);
    assert.equal(peak, 1);
    assert.deepEqual(h.calls.batches.map((batch) => batch.docIds.length), [12, 12, 1]);
    assert.deepEqual(h.calls.batches.flatMap((batch) => Array.from(batch.docIds)), changedDocIds);
    assert.equal(h.calls.full, 0);
    assert.equal(h.calls.projection, 1);
    assert.equal(h.calls.index.length, 1);
    assert.equal(h.calls.snapshot.length, 1);
    assert.deepEqual(Array.from(h.calls.snapshot[0].changedDocIds), changedDocIds);
});

test('two simultaneous verifications share the same pending metadata request', async () => {
    const pending = deferred();
    const h = harness();
    h.context.__tmProbeCurrentGroupTaskFreshness = () => { h.calls.probe++; return pending.promise; };
    const a = h.verify(), b = h.verify();
    await tick();
    assert.equal(h.calls.probe, 1);
    pending.resolve({ status: 'unchanged' });
    assert.equal((await a).complete, true);
    assert.equal((await b).complete, true);
    assert.equal(h.context.state.__tmCachedScopeVerifyInFlight, null);
});

test('switching group while metadata is pending prevents stale task reads', async () => {
    const pending = deferred();
    const h = harness({ __tmProbeCurrentGroupTaskFreshness: () => pending.promise });
    const result = h.verify();
    await tick();
    h.context.SettingsStore.data.currentGroupId = 'other';
    pending.resolve({ status: 'changed', changedDocIds: [id(1)] });
    assert.equal((await result).complete, false);
    assert.equal(h.calls.batches.length + h.calls.full, 0);
});

test('closing the view during a batch stops dispatch and stale cache persistence', async () => {
    const h = harness();
    h.context.__tmRefreshAffectedDocsIncrementally = async (options) => {
        h.calls.batches.push(options);
        h.context.state.openToken++;
        return true;
    };
    const result = await h.verify({ freshness: { status: 'changed', changedDocIds: Array.from({ length: 25 }, (_, i) => id(i)) } });
    assert.equal(result.complete, false);
    assert.equal(h.calls.batches.length, 1);
    assert.equal(h.calls.projection + h.calls.index.length + h.calls.snapshot.length, 0);
});

test('a failed metadata transport keeps the snapshot without amplifying reads', async () => {
    const h = harness();
    const result = await h.verify({ freshness: { status: 'unknown', readFailure: true } });
    assert.equal(result.complete, false);
    assert.equal(h.calls.full + h.calls.batches.length, 0);
    assert.equal(h.context.state.__tmDocGroupFreshnessFallbackAtByGroup, undefined);
});

test('unsupported metadata gets one compatibility fallback per group per minute', async () => {
    let now = 100000;
    const h = harness({ Date: { now: () => now } });
    assert.equal((await h.verify({ freshness: { status: 'unknown' } })).complete, true);
    assert.equal((await h.verify({ freshness: { status: 'unknown' } })).complete, false);
    assert.equal(h.calls.full, 1);
    now += 60001;
    assert.equal((await h.verify({ freshness: { status: 'unknown' } })).complete, true);
    assert.equal(h.calls.full, 2);
});

test('a failed later batch preserves successful updates without clearing verification or launching a full load', async () => {
    const h = harness();
    h.context.__tmRefreshAffectedDocsIncrementally = async (options) => {
        h.calls.batches.push(options);
        return h.calls.batches.length === 1;
    };
    const result = await h.verify({ freshness: { status: 'changed', changedDocIds: Array.from({ length: 25 }, (_, i) => id(i)) } });
    assert.equal(result.complete, false);
    assert.equal(result.changed, true);
    assert.equal(h.calls.full, 0);
    assert.equal(h.calls.projection, 1);
    assert.equal(h.calls.snapshot[0].changedDocIds.length, 12);
});

test('metadata probe compares count and update stamps, deduplicates shared children and terminates cycles', async () => {
    const h = harness();
    const task = { id: id(10), updated: '20260925182000', hash: 'abc1234', block_sort: 1, children: [] };
    task.children.push(task);
    const emptyId = id(2), docId = id(1);
    const doc = { id: docId, updated: '20260925182100', tasks: [task, task] };
    h.context.state.__tmLoadedDocIdsForTasks = [docId, emptyId];
    h.context.state.taskTree = [doc];
    h.context.state.allDocuments = [doc, { id: emptyId, updated: '20260925182100' }];
    const map = new Map([
        [docId, { exists: true, docUpdated: doc.updated, taskCount: 1, taskUpdated: task.updated, taskFingerprint: `${task.id}:abc1234:1` }],
        [emptyId, { exists: true, docUpdated: doc.updated, taskCount: 0, taskUpdated: '' }],
    ]);
    h.context.API = { getTaskFreshnessByDocuments: async () => ({ map }) };
    vm.runInContext(dialog.slice(probeStart, verifyStart), h.context);
    assert.equal((await h.context.__tmProbeCurrentGroupTaskFreshness()).status, 'unchanged');
    map.get(docId).taskCount = 2;
    const result = await h.context.__tmProbeCurrentGroupTaskFreshness();
    assert.deepEqual(Array.from(result.changedDocIds), [docId]);
    assert.equal(result.docFreshnessMap, map);
    map.get(docId).taskCount = 1;
    map.get(docId).taskFingerprint = `${task.id}:def5678:1`;
    assert.equal((await h.context.__tmProbeCurrentGroupTaskFreshness()).status, 'changed', 'hash-only changes must refresh even when all timestamps and counts match');
    map.get(docId).taskFingerprint = `${task.id}:abc1234:2`;
    assert.equal((await h.context.__tmProbeCurrentGroupTaskFreshness()).status, 'changed', 'sort-only changes must refresh too');
});

function metadataApi(call) {
    const start = apiSource.indexOf('        async getTaskFreshnessByDocuments(');
    const end = apiSource.indexOf('\n        },', start) + 11;
    const context = vm.createContext({ Map, Set, Date, setTimeout, SettingsStore: { data: {} } });
    vm.runInContext(`globalThis.API = { ${apiSource.slice(start, end)} };`, context);
    context.API.call = call;
    return context.API;
}

test('697 documents use four compact aggregate queries rather than individual task reads', async () => {
    const statements = [];
    const api = metadataApi(async (url, payload) => {
        assert.equal(url, '/api/query/sql');
        statements.push(payload.stmt);
        assert.match(payload.stmt, /COUNT\(DISTINCT t.id\)/);
        assert.match(payload.stmt, /GROUP_CONCAT\(t.id[\s\S]*t.hash[\s\S]*t.sort/);
        return { code: 0, data: [] };
    });
    const result = await api.getTaskFreshnessByDocuments(Array.from({ length: 697 }, (_, i) => id(i)));
    assert.equal(statements.length, 4);
    assert.equal(result.map.size, 697);
    assert.equal(result.unavailable, false);
});

test('metadata transport failure stops the remaining chunks immediately', async () => {
    let calls = 0;
    const api = metadataApi(async () => { calls++; return { code: -1, readFailure: true }; });
    const result = await api.getTaskFreshnessByDocuments(Array.from({ length: 697 }, (_, i) => id(i)));
    assert.equal(calls, 1);
    assert.equal(result.readFailure, true);
    assert.equal(result.unavailable, true);
});

test('a thrown transport error also stops metadata chunks without a compatibility retry', async () => {
    let calls = 0;
    const api = metadataApi(async () => { calls++; throw new TypeError('Failed to fetch'); });
    const result = await api.getTaskFreshnessByDocuments(Array.from({ length: 697 }, (_, i) => id(i)));
    assert.equal(calls, 1);
    assert.equal(result.readFailure, true);
});

test('task index round-trip retains the update stamp needed to reuse unchanged snapshots', () => {
    const source = fs.readFileSync(path.join(root, '10-stores-rules-and-cache.js'), 'utf8');
    const names = ['__tmBuildTaskIndexBlockEntry', '__tmRestoreTaskIndexBlockEntry'];
    const functions = names.map((name) => {
        const start = source.indexOf(`    function ${name}(`);
        const end = source.indexOf('\n    }', start) + 6;
        assert.ok(start >= 0 && end > start);
        return source.slice(start, end);
    });
    const context = vm.createContext({ Map, Set,
        SettingsStore: { data: {} },
        __TM_TASK_ATTACHMENT_META_ATTR: 'custom-attachment-meta',
        __tmIsLikelyBlockId: (value) => /^\d{14}-[a-z0-9]{7}$/.test(value),
        __tmCompactTaskIndexText: (value) => String(value || ''),
        __tmCompactTaskIndexValue: (value) => value,
        __tmGetTaskAttachmentMetaMap: () => new Map(), __tmGetTaskAttachmentPaths: () => [],
        __tmHasTaskAttachmentAttrSnapshot: () => false, __tmNormalizeTomatoCountValue: (value) => value,
        __tmNormalizeTaskAttachmentMetaMap: () => new Map(), __tmSerializeTaskAttachmentMeta: () => '',
        __tmCloneTaskSnapshotValue: (value) => value,
    });
    vm.runInContext(functions.join('\n'), context);
    const task = { id: id(10), root_id: id(1), updated: '20260925182000', hash: 'abc1234', content: 'unchanged task' };
    const entry = context.__tmBuildTaskIndexBlockEntry(task, { id: id(1) });
    const stored = JSON.parse(JSON.stringify(entry));
    const restored = context.__tmRestoreTaskIndexBlockEntry(stored, { id: id(1) });
    assert.equal(restored.updated, task.updated);
    assert.equal(restored.hash, task.hash);
    assert.equal(restored.id, task.id);
    assert.equal(restored.content, task.content);
});
