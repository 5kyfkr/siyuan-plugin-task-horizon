'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const readStart = source.indexOf('    async function __tmReadJsonFile(');
const start = source.indexOf('    const __TM_DOC_GROUP_SYNC_LOG_PATH =');
const end = source.indexOf('    async function __tmWriteJsonFile(', start);
assert.ok(readStart >= 0 && start > readStart && end > start, 'missing PETAL group-sync logger');
const readJsonSource = source.slice(readStart, start);
const loggerSource = source.slice(start, end);
const logPath = '/data/storage/petal/siyuan-plugin-task-horizon/doc-group-sync-debug.json';

function createLogger(options = {}) {
    let stored = options.initial || null;
    const writes = [];
    const context = vm.createContext({
        PLUGIN_STORAGE_DIR: '/data/storage/petal/siyuan-plugin-task-horizon',
        Date, Set, String, Number, Math, JSON, Object, Array, FormData, Blob, AbortController,
        setTimeout, clearTimeout,
        console: { info() {}, warn() {} },
        globalThis: null,
        __taskHorizonPluginManifest: { version: '3.4.0' },
        __tmHost: { appendStorageRequestApp() {}, getRuntimeClientKind: () => 'android-app', getStorageRequestApp: () => 'test-app' },
        fetch: async (url, options) => {
            if (url.endsWith('/getFile')) {
                if (!stored) return { status: 404, ok: false };
                return { status: 200, ok: true, text: async () => JSON.stringify(stored) };
            }
            const form = options.body;
            assert.equal(form.get('path'), logPath);
            assert.equal(form.get('isDir'), 'false');
            stored = JSON.parse(await form.get('file').text());
            writes.push(stored);
            return { status: 200, ok: true, json: async () => ({ code: 0 }) };
        },
    });
    context.globalThis = context;
    vm.runInContext(readJsonSource + loggerSource + '\nthis.log = __tmLogDocGroupSync; this.summarize = __tmSummarizeDocGroupsForSyncLog;', context);
    return { log: context.log, summarize: context.summarize, writes };
}

test('group-sync diagnostics persist redacted summaries under PETAL with a bounded history', async () => {
    const h = createLogger();
    const names = [{ id: 'work', name: 'Work', docs: [{ id: 'private-document-id' }] }];
    await h.log('settings-write', { local: h.summarize({ docGroups: names }) }, 'write-1');
    await h.log('settings-write', { local: h.summarize({ docGroups: names }) }, 'write-1');
    assert.equal(h.writes.length, 1, 'the same write event must not be appended twice');
    assert.deepEqual(h.writes[0].entries[0].local.items[0], {
        id: 'work', name: 'Work', documents: 1, notebook: false,
    });
    assert.doesNotMatch(JSON.stringify(h.writes[0]), /private-document-id/);

    for (let index = 0; index < 105; index += 1) {
        await h.log(`event-${index}`, {}, `event-${index}`);
    }
    assert.equal(h.writes.at(-1).entries.length, 100);
    assert.equal(h.writes.at(-1).entries[0].event, 'event-5');
    assert.equal(h.writes.at(-1).entries.at(-1).event, 'event-104');
});

test('raw snapshot fingerprints are hashed in new entries and retained history', async () => {
    const raw = JSON.stringify({ docGroups: [{ docs: [{ id: 'private-document-id' }] }] });
    const h = createLogger({ initial: { version: 1, entries: [{ event: 'old', fingerprints: { local: raw } }] } });
    await h.log('settings-hydration', { fingerprints: { local: raw, file: raw + ' ' } }, 'hydrate-safe');
    const entries = h.writes[0].entries;
    for (const record of entries) for (const fingerprint of Object.values(record.fingerprints)) {
        assert.match(fingerprint, /^fnv1a:[0-9a-f]{8}$/);
    }
    assert.equal(entries[0].fingerprints.local, entries[1].fingerprints.local);
    assert.notEqual(entries[1].fingerprints.local, entries[1].fingerprints.file);
    assert.doesNotMatch(JSON.stringify(h.writes[0]), /private-document-id/);
    assert.equal(entries[1].diagnosticVersion, 4);
    assert.deepEqual(entries[1].client, { kind: 'android-app', appId: 'test-app', pluginVersion: '3.4.0', kernelVersion: 'unknown' });
});

test('concurrent diagnostic events append in order and preserve the bounded file', async () => {
    const h = createLogger();
    await Promise.all(Array.from({ length: 12 }, (_, index) => h.log('event-' + index, {}, 'ordered-' + index)));
    assert.equal(h.writes.length, 12);
    assert.deepEqual(h.writes.at(-1).entries.map(record => record.event), Array.from({ length: 12 }, (_, index) => 'event-' + index));
    await h.log('repeat', {}, 'ordered-11');
    assert.equal(h.writes.length, 12);
});
