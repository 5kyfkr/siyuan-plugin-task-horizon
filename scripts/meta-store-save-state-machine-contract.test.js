'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'task-horizon', 'main', '10-stores-rules-and-cache.js'),
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

function createRuntime(options = {}) {
    const writes = [];
    const localWrites = [];
    const fileUploadGate = options.fileUploadGate || null;
    let firstFileUploadStartedResolve;
    const firstFileUploadStarted = new Promise((resolve) => { firstFileUploadStartedResolve = resolve; });

    class FormDataStub {
        constructor() { this.values = new Map(); }
        append(key, value) { this.values.set(key, value); }
        get(key) { return this.values.get(key); }
    }
    class BlobStub {
        constructor(parts) { this.parts = parts; }
    }

    const context = vm.createContext({
        console,
        Date,
        Map,
        Set,
        Promise,
        setTimeout,
        clearTimeout,
        FormData: FormDataStub,
        Blob: BlobStub,
        META_FILE_PATH: '/meta.json',
        PLUGIN_STORAGE_DIR: '/plugin',
        __TM_CUSTOM_TASK_ORDER_META_KEY: '__tmCustomTaskOrder',
        __TM_META_ORPHAN_CLEANUP_INTERVAL_MS: 10 * 60 * 1000,
        __TM_META_ORPHAN_CLEANUP_MIN_AGE_MS: 24 * 60 * 60 * 1000,
        __TM_META_ORPHAN_CLEANUP_MAX_IDS: 1000,
        __TM_META_ORPHAN_CLEANUP_BATCH_SIZE: options.orphanBatchSize || 250,
        __TM_TASK_ATTACHMENT_BLOCK_ID_PATTERN: /^[0-9]{14}-[A-Za-z0-9]+$/,
        API: { call: options.apiCall || (async () => ({ code: 0, data: [] })) },
        Storage: {
            get: () => options.initialData || {},
            setSerialized: (key, value) => localWrites.push({ key, value }),
        },
        __tmGetSettingsFieldFingerprint: (value) => JSON.stringify(value || {}),
        __tmGetCustomFieldDefMap: () => new Map(),
        __tmNormalizeCustomFieldValue: (_field, value) => value,
        __tmReadJsonFile: async () => ({}),
        __tmMergeCustomTaskOrderStore: (local) => local || {},
        __tmGetTaskAttachmentPaths: () => [],
        __tmGetTaskAttachmentMetaMap: () => new Map(),
        __tmMarkMobileCloseSyncDirty: () => {},
        fetch: async (_url, request) => {
            const file = request?.body?.get?.('file');
            if (file) {
                writes.push(file.parts.join(''));
                if (writes.length === 1) {
                    firstFileUploadStartedResolve();
                    if (fileUploadGate) await fileUploadGate.promise;
                }
            }
            return { ok: true };
        },
    });

    const runtimeSource = sliceSource(
        'function __tmNormalizeMetaPriorityForStore',
        '    function __tmCreateEmptyCustomTaskOrderStore',
    );
    vm.runInContext(`${runtimeSource}\nglobalThis.MetaStoreForTest = MetaStore;`, context);
    return { store: context.MetaStoreForTest, writes, localWrites, firstFileUploadStarted };
}

(async () => {
    {
        const runtime = createRuntime();
        runtime.store.set('task-a', { remark: 'one' });
        await runtime.store.saveNow();
        await new Promise((resolve) => setTimeout(resolve, 550));
        assert.equal(runtime.writes.length, 1, 'set plus saveNow must cancel the pending debounce write');
        assert.equal(runtime.localWrites.length, 1, 'one committed revision must update localStorage once');
    }

    {
        const uploadGate = deferred();
        const runtime = createRuntime({ fileUploadGate: uploadGate });
        runtime.store.set('task-a', { remark: 'first' });
        const pendingSave = runtime.store.saveNow();
        await runtime.firstFileUploadStarted;
        runtime.store.set('task-b', { remark: 'trailing' });
        uploadGate.resolve();
        await pendingSave;
        assert.equal(runtime.writes.length, 2, 'a mutation during upload must produce one trailing flush');
        assert.deepEqual(JSON.parse(runtime.writes.at(-1)), {
            'task-a': { remark: 'first' },
            'task-b': { remark: 'trailing' },
        });
    }

    {
        const runtime = createRuntime();
        runtime.store.set('task-compact', {
            priority: 'none',
            remark: '',
            done: false,
            attachments: [],
        });
        assert.deepEqual(JSON.parse(JSON.stringify(runtime.store.get('task-compact'))), { done: false, attachments: [] },
            'compaction must retain explicit false and empty attachment state');
        const seeded = runtime.store.mergeFromTaskIfMissing({ id: 'task-default', priority: 'none' }, { save: false });
        assert.equal(seeded, undefined);
        assert.equal(runtime.store.get('task-default'), null, 'default priority must not create a MetaStore entry');
    }

    {
        const customOrder = { version: 1, updatedAt: 1, rules: {} };
        const runtime = createRuntime({
            orphanBatchSize: 1,
            initialData: {
                '20000101000000-existing': { remark: 'keep' },
                '20000101000001-stale': { remark: 'remove' },
                '20000101000002-queryfail': { remark: 'keep-on-error' },
                'temporary-task-key': { remark: 'keep-non-block-key' },
                __tmCustomTaskOrder: customOrder,
            },
            apiCall: async (_url, body) => {
                const stmt = String(body?.stmt || '');
                if (stmt.includes('20000101000000-existing')) {
                    return { code: 0, data: [{ id: '20000101000000-existing' }] };
                }
                if (stmt.includes('20000101000002-queryfail')) return { code: -1, data: [] };
                return { code: 0, data: [] };
            },
        });
        runtime.store.loaded = true;
        const removed = await runtime.store.cleanupOrphans();
        assert.equal(removed, 1, 'orphan cleanup must remove only SQL-confirmed missing block IDs');
        assert.equal(runtime.store.get('20000101000001-stale'), null);
        assert.ok(runtime.store.get('20000101000000-existing'));
        assert.ok(runtime.store.get('20000101000002-queryfail'), 'a failed SQL batch must not delete metadata');
        assert.ok(runtime.store.get('temporary-task-key'), 'non-block metadata keys must not be queried or deleted');
        assert.deepEqual(JSON.parse(JSON.stringify(runtime.store.data.__tmCustomTaskOrder)), customOrder);
        await runtime.store.saveNow();
    }

    {
        const queryGate = deferred();
        let queryStartedResolve;
        const queryStarted = new Promise((resolve) => { queryStartedResolve = resolve; });
        const taskId = '20000101000003-restored';
        const runtime = createRuntime({
            initialData: { [taskId]: { remark: 'old' } },
            apiCall: async () => {
                queryStartedResolve();
                await queryGate.promise;
                return { code: 0, data: [] };
            },
        });
        runtime.store.loaded = true;
        const cleanupPromise = runtime.store.cleanupOrphans();
        await queryStarted;
        runtime.store.set(taskId, { remark: 'restored-during-query' });
        queryGate.resolve();
        assert.equal(await cleanupPromise, 0, 'cleanup must not delete metadata replaced while its SQL query is in flight');
        assert.equal(runtime.store.get(taskId)?.remark, 'restored-during-query');
        await runtime.store.saveNow();
    }

    console.log('MetaStore save state machine contract tests passed');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
