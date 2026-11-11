'use strict';
// Production group merge, flushSave and sync cancellation; no live SiYuan access.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');
const storeSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8').replace(/\r\n/g, '\n');
const syncSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/39-render-doc-group-sync-and-refresh.js'), 'utf8').replace(/\r\n/g, '\n');
const slice = (source, a, b) => {
    const start = source.indexOf(a), end = source.indexOf(b, start + a.length);
    assert.ok(start >= 0 && end > start, a);
    return source.slice(start, end);
};
const method = name => {
    const start = storeSource.indexOf(`        async ${name}(`, storeSource.indexOf('    const SettingsStore ='));
    const end = storeSource.indexOf('\n        },', start);
    assert.ok(start >= 0 && end > start, name);
    return storeSource.slice(start, end + 11);
};
const clone = value => JSON.parse(JSON.stringify(value));
const oldData = {
    settingsUpdatedAt: 100, docGroupSettingsUpdatedAt: 100, currentGroupId: 'all',
    docGroups: [{ id: 'daily', name: 'Daily', docs: [{ id: 'example-doc', recursive: false }] }],
    selectedDocIds: [], defaultDocIdByGroup: {}, customFieldDefs: [], customFieldDefsVersion: 0,
    whiteboardStateVersion: 0, collapseStateUpdatedAt: 0,
};
const newerData = { ...clone(oldData), settingsUpdatedAt: 200, docGroupSettingsUpdatedAt: 200,
    docGroups: [{ ...clone(oldData.docGroups[0]), name: 'Renamed' }, { id: 'new', name: 'New group', docs: [] }] };

async function run({ downloadedBeforeSave = false, downloadDuringSave = false, downloadDuringRead = false, downloadBeforeResponse = false, downloadDuringWrite = false, newerSaveRunning = false } = {}) {
    let disk = clone(downloadedBeforeSave ? newerData : oldData);
    const written = [], failures = [];
    let context;
    const identity = value => value || {};
    context = vm.createContext({
        console, JSON, Math, Map, Set, Number, String, Object, Array, Promise, FormData, Blob, AbortController,
        probeErrors: failures,
        Date: class extends Date { static now() { return 1000; } },
        setTimeout, clearTimeout,
        PLUGIN_STORAGE_DIR: '/fixture', SETTINGS_FILE_PATH: '/fixture/task-settings.json',
        __tmNormalizeDocIdListForSync: value => value || [],
        __tmNormalizeDefaultDocIdByGroupForSync: identity,
        __tmNormalizeShowCompletedTasksByGroup: identity,
        __tmNormalizeDocGroupExcludedDocIds: value => value || [],
        __tmNormalizeOtherBlockRefs: value => value || [],
        __tmNormalizeDocPinnedByGroupForSync: identity,
        __tmNormalizeDocTabsManualArchivedByGroupForSync: identity,
        __tmNormalizeDocTabCustomGroups: value => value || [],
        __tmNormalizeDocGroupConfig: value => value,
        __tmNormalizeDocColorSchemeConfig: () => ({}), __tmGetDefaultDocColorSchemeConfig: () => ({}),
        __tmNormalizeCalendarSearchOptimization: () => ({}),
        __tmSafeCloneJson: clone,
        __tmParseUpdatedAtNumber: value => Number(value) || 0,
        __tmParseVersionNumber: value => Number(value) || 0,
        __tmCloneJsonSafe: clone,
        __tmGetWhiteboardSettingsFingerprint: () => 'stable',
        __tmGetCustomFieldDefsFingerprint: () => 'stable',
        __tmGetCollapsedSessionStateFingerprint: () => 'stable',
        __tmCloneCustomFieldDefs: clone,
        __tmMergeSameVersionCustomFieldDefs: value => value,
        __tmGetCollapsedSessionUpdatedAt: () => 0,
        __tmShouldUseRemoteWhiteboardSettings: () => false,
        __tmShouldPreferRemoteCollapsedSessionState: () => false,
        __tmMigrateLegacyTaskTitleClickSettings() {}, __tmMarkMobileCloseSyncDirty() {},
        __tmReadJsonFile: async () => {
            const result = clone(disk);
            if (downloadDuringRead) receiveDownload();
            return result;
        },
        fetch: async (_url, options) => {
            if (!options.body.get('file')) {
                if (downloadDuringSave) {
                    receiveDownload();
                }
            } else {
                if (downloadDuringWrite) {
                    receiveDownload();
                    if (options.signal?.aborted) {
                        const error = new Error('aborted');
                        error.name = 'AbortError';
                        throw error;
                    }
                }
                disk = JSON.parse(await options.body.get('file').text());
                written.push(clone(disk));
                if (downloadBeforeResponse) receiveDownload();
            }
            return { ok: true, status: 200, json: async () => ({ code: 0 }) };
        },
    });
    function receiveDownload() {
        context.__tmCancelSettingsStorePendingSave();
        disk = clone(newerData);
        Object.assign(context.SettingsStore.data, clone(newerData));
        if (newerSaveRunning) {
            context.SettingsStore.saving = true;
            context.SettingsStore.saveDirty = true;
            context.SettingsStore.lastSaveResult = { owner: 'new-save' };
        }
    }
    context.window = context;
    vm.runInContext(slice(syncSource, '    function __tmCancelSettingsStorePendingSave(', '    function __tmCancelSimpleStorePendingSave('), context);
    vm.runInContext(slice(syncSource, '    function __tmBuildDocGroupSyncSnapshot(', '    function __tmBuildDocScopeFingerprint('), context);
    vm.runInContext(slice(syncSource, '    function __tmApplyDocGroupSyncSnapshot(', '    function __tmEnsureDocGroupContextValidAfterSync('), context);
    vm.runInContext(slice(storeSource, '    const __TM_DOC_GROUP_SETTINGS_KEYS', '    const __TM_LEGACY_TASK_TITLE_SETTING_KEYS'), context);
    vm.runInContext(slice(storeSource, '    function __tmStableSettingsJsonValue(', '    function __tmNormalizeWhiteboardLinkArray('), context);
    const store = context.SettingsStore = {
        data: { ...clone(oldData), currentGroupId: 'daily' },
        saveDirty: true, saving: false, loadedDocGroupUpdatedAt: 100,
        lastWhiteboardFingerprint: 'stable', lastCustomFieldDefsFingerprint: 'stable', loadedCollapseFingerprint: 'stable',
        loadedCustomFieldDefsVersion: 0, loadedCustomFieldDefsSnapshot: [],
        syncToLocal() {}, normalizeColumns() {},
        buildCloudPayload() { return clone(this.data); },
        refreshDocGroupSyncState() { this.loadedDocGroupFingerprint = context.__tmBuildDocGroupSyncFingerprint(this.data); },
        refreshCustomFieldSyncState() {}, refreshCollapsedStateSyncState() {}, refreshSettingsSyncState() {},
    };
    store.loadedDocGroupFingerprint = context.__tmBuildDocGroupSyncFingerprint(oldData);
    const flush = method('flushSave').replace('            } catch (e) {\n            } finally {', '            } catch (e) { probeErrors.push(String(e.stack));\n            } finally {');
    store.flushSave = vm.runInContext(`({${flush}}).flushSave`, context);
    await store.flushSave();
    assert.deepEqual(failures, [], 'the production save must not swallow a fixture error');
    if (!downloadDuringSave && !downloadDuringRead && !downloadBeforeResponse && !downloadDuringWrite) assert.equal(store.lastSaveResult.ok, true);
    await Promise.resolve();
    return { written, disk, memory: clone(store.data), failures, store };
}


test('ordinary settings save writes the current client snapshot without merging an already downloaded file', async () => {
    const h = await run({ downloadedBeforeSave: true });
    assert.equal(h.disk.docGroups.length, 1);
    assert.equal(h.disk.docGroups[0].name, 'Daily');
    assert.equal(h.disk.settingsUpdatedAt, 1000);
});

test('ordinary settings saves persist current group contents', async () => {
    const h = await run();
    assert.equal(h.disk.settingsUpdatedAt, 1000);
    assert.equal(Object.hasOwn(h.disk, 'settingsFieldUpdatedAt'), false);
    assert.equal(h.disk.docGroups.length, 1);
});

test('sync invalidates a pre-sync save after it enters the file write queue', async () => {
    const h = await run({ downloadDuringSave: true });
    assert.equal(h.written.length, 0, 'the stale save must not submit its settings payload');
    assert.equal(h.disk.docGroups.length, 2);
    assert.equal(h.disk.docGroups[0].name, 'Renamed');
    assert.equal(h.memory.docGroups.length, 2);
});

test('a cancelled save cannot clear the next save owner or pending changes', async () => {
    const h = await run({ downloadDuringSave: true, newerSaveRunning: true });
    assert.equal(h.written.length, 0);
    assert.equal(h.store.saving, true);
    assert.equal(h.store.saveDirty, true);
    assert.deepEqual(h.store.lastSaveResult, { owner: 'new-save' });
});

test('a late response from a pre-sync write cannot reset the post-sync save owner', async () => {
    const h = await run({ downloadBeforeResponse: true, newerSaveRunning: true });
    assert.equal(h.written.length, 1, 'the first write was already submitted before the download');
    assert.equal(h.disk.docGroups.length, 2);
    assert.equal(h.store.saving, true);
    assert.equal(h.store.saveDirty, true);
    assert.deepEqual(h.store.lastSaveResult, { owner: 'new-save' });
});

test('sync aborts a settings write that has not reached the file API yet', async () => {
    const h = await run({ downloadDuringWrite: true });
    assert.equal(h.written.length, 0, 'the invalidated request must not write its stale payload');
    assert.equal(h.disk.docGroups.length, 2);
    assert.equal(h.disk.docGroups[0].name, 'Renamed');
});

