'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, 'src/task-horizon/main', file), 'utf8');
const storeSource = read('10-stores-rules-and-cache.js');
const syncSource = read('render/39-render-doc-group-sync-and-refresh.js');
const controlsSource = read('render/45-render-shell-controls-and-resize.js');
const dialogSource = read('30-dialogs-and-ui-foundation.js');
const exportSource = read('settings/64-export-runtime.js');
const plain = (value) => JSON.parse(JSON.stringify(value));

function between(source, start, end) {
    const a = source.indexOf(start);
    const b = source.indexOf(end, a + start.length);
    assert.ok(a >= 0 && b > a, `source section missing: ${start}`);
    return source.slice(a, b);
}

const helpers = between(storeSource, '    function __tmNormalizeShowCompletedTasksByGroup(', '    function __tmNormalizeTaskDeleteMode(');
const localLoad = between(storeSource, '            const hasStoredShowCompletedTasks =', '            this.data.startDate =');
const localSave = '            __tmNormalizeCompletedVisibilitySettings(this.data);\n' + between(storeSource, "            Storage.set('tm_show_completed_tasks',", "            Storage.set('tm_start_date',");

function harness(overrides = {}) {
    const storage = new Map();
    const data = {
        currentGroupId: 'A', showCompletedTasks: true, excludeCompletedTasks: false,
        showCompletedTasksByGroup: {}, docGroups: [{ id: 'A' }, { id: 'B' }],
        ...overrides,
    };
    const renders = [];
    const context = vm.createContext({
        SettingsStore: { data, save: async () => {}, syncToLocal() {}, normalizeColumns() {} },
        Storage: {
            has: (key) => storage.has(key),
            get: (key, fallback) => storage.has(key) ? plain(storage.get(key)) : fallback,
            set: (key, value) => storage.set(key, plain(value)),
        },
        state: { showCompletedTasks: true, excludeCompletedTasks: false, modal: {}, activeDocId: 'all' },
        document: { body: { contains: () => true } },
        __tmRecomputeTaskProjection: () => renders.push([data.currentGroupId, context.state.showCompletedTasks]),
        __tmRerenderCurrentViewInPlace: () => true,
        render() {}, showSettings() {},
        __tmNormalizeDocIdListForSync: (value) => value || [],
        __tmNormalizeDefaultDocIdByGroupForSync: (value) => value || {},
        __tmNormalizeDocGroupExcludedDocIds: (value) => value || [],
        __tmNormalizeOtherBlockRefs: (value) => value || [],
        __tmNormalizeDocPinnedByGroupForSync: (value) => value || {},
        __tmNormalizeDocTabsManualArchivedByGroupForSync: (value) => value || {},
        __tmNormalizeDocTabCustomGroups: (value) => value || [],
        __tmNormalizeDocGroupConfig: (value) => value,
        __tmNormalizeDocColorSchemeConfig: () => ({}),
        __tmGetDefaultDocColorSchemeConfig: () => ({}),
        __tmNormalizeCalendarSearchOptimization: () => ({}),
        __tmSafeCloneJson: (value) => plain(value),
        __tmParseUpdatedAtNumber: (value) => Number(value) || 0,
        __tmIsOtherBlockTabId: () => false,
        __tmGetDocTabCustomGroupScopeId: (value) => value.docGroupId,
        WhiteboardStore: { loaded: false },
    });
    context.window = context;
    vm.runInContext(helpers, context);
    vm.runInContext(between(syncSource, '    function __tmBuildDocGroupSyncSnapshot(', '    function __tmBuildDocScopeFingerprint('), context);
    vm.runInContext(between(syncSource, '    function __tmApplyDocGroupSyncSnapshot(', '    function __tmEnsureActiveDocValidAfterDocGroupSync('), context);
    vm.runInContext(between(controlsSource, '    window.tmToggleShowCompletedTasks =', '    window.tmToggleCompletedTasksInlineInGroups ='), context);
    return { context, data, storage, renders };
}

test('new installations default to visible; old explicit and legacy choices survive', () => {
    const { context } = harness();
    for (const [data, expected] of [
        [{}, true], [{ showCompletedTasks: false }, false],
        [{ excludeCompletedTasks: true }, false], [{ excludeCompletedTasks: false }, true],
        [{ showCompletedTasks: true, excludeCompletedTasks: true }, true],
    ]) {
        context.__tmNormalizeCompletedVisibilitySettings(data);
        assert.equal(context.__tmGetShowCompletedTasksFromSettings(data), expected);
        assert.deepEqual(plain(data.showCompletedTasksByGroup), {});
        assert.equal(data.excludeCompletedTasks, !expected);
    }
});

test('A, B and all remember independent values without rewriting the legacy default', async () => {
    const { context, data } = harness();
    await context.tmToggleShowCompletedTasks(false);
    data.currentGroupId = 'B';
    context.__tmApplyCompletedVisibilityToRuntime();
    assert.equal(context.state.showCompletedTasks, true);
    await context.tmToggleShowCompletedTasks(true);
    data.currentGroupId = 'all';
    await context.tmToggleShowCompletedTasks(false);
    assert.deepEqual(plain(data.showCompletedTasksByGroup), { A: false, B: true, all: false });
    assert.equal(context.__tmGetShowCompletedTasksFromSettings(data, 'A'), false);
    assert.equal(context.__tmGetShowCompletedTasksFromSettings(data, 'B'), true);
    assert.equal(context.__tmGetShowCompletedTasksFromSettings(data, 'new-group'), true);
    context.__tmNormalizeCompletedVisibilitySettings(data);
    assert.equal(data.showCompletedTasks, true);
    assert.equal(data.excludeCompletedTasks, false);
});

test('explicit overrides work when the old global choice was hidden', () => {
    const { context, data } = harness({ showCompletedTasks: false, excludeCompletedTasks: true });
    context.__tmSetShowCompletedTasksInSettings(true, data, 'A');
    assert.equal(context.__tmGetShowCompletedTasksFromSettings(data, 'A'), true);
    assert.equal(context.__tmGetShowCompletedTasksFromSettings(data, 'B'), false);
    assert.equal(context.__tmGetShowCompletedTasksFromSettings(data, 'all'), false);
    assert.equal(data.showCompletedTasks, false);
});

test('normalization retains false and discards invalid values with deterministic key order', () => {
    const { context } = harness();
    const normalized = context.__tmNormalizeShowCompletedTasksByGroup({ B: true, A: false, broken: 'false', '': true, zero: 0 });
    assert.equal(JSON.stringify(normalized), '{"A":false,"B":true}');
    assert.deepEqual(plain(context.__tmNormalizeShowCompletedTasksByGroup([])), {});
    assert.deepEqual(plain(context.__tmNormalizeShowCompletedTasksByGroup(null)), {});
});

test('actual local save/load blocks restore group choices after restart', () => {
    const { context, data, storage } = harness();
    context.__tmSetShowCompletedTasksInSettings(false, data, 'A');
    context.__tmSetShowCompletedTasksInSettings(true, data, 'B');
    vm.runInContext(`(function() { ${localSave} }).call(SettingsStore)`, context);
    context.SettingsStore.data = { currentGroupId: 'A', showCompletedTasks: true, excludeCompletedTasks: false };
    vm.runInContext(`(function() { ${localLoad} }).call(SettingsStore)`, context);
    assert.equal(context.state.showCompletedTasks, false);
    assert.equal(context.__tmGetShowCompletedTasksFromSettings(null, 'B'), true);
    assert.equal(context.SettingsStore.data.showCompletedTasks, true);
    storage.delete('tm_show_completed_tasks');
    storage.delete('tm_show_completed_tasks_by_group');
    storage.set('tm_exclude_completed_tasks', true);
    context.SettingsStore.data = { currentGroupId: 'A', showCompletedTasks: true, excludeCompletedTasks: false };
    vm.runInContext(`(function() { ${localLoad} }).call(SettingsStore)`, context);
    assert.equal(context.SettingsStore.data.showCompletedTasks, false);
    assert.equal(context.state.showCompletedTasks, false);
    assert.deepEqual(plain(context.SettingsStore.data.showCompletedTasksByGroup), {});
});

test('a delayed save from A cannot overwrite or rerender B after a rapid switch', async () => {
    const { context, data, renders } = harness();
    let finishSave;
    context.SettingsStore.save = () => new Promise((resolve) => { finishSave = resolve; });
    const pending = context.tmToggleShowCompletedTasks(false);
    data.currentGroupId = 'B';
    context.__tmApplyCompletedVisibilityToRuntime();
    finishSave();
    await pending;
    assert.equal(context.state.showCompletedTasks, true);
    assert.deepEqual(plain(data.showCompletedTasksByGroup), { A: false });
    assert.equal(renders.length, 0);
});

test('settings and whiteboard entrances delegate to the same group update path', async () => {
    const { context, data } = harness();
    vm.runInContext(between(read('settings/70-doc-group-and-settings-actions.js'), '    window.updateShowCompletedTasks =', '    window.updateSemanticDateAutoPromptEnabled ='), context);
    vm.runInContext(between(read('render/49-render-whiteboard-interactions.js'), '    window.tmWhiteboardToggleShowDone =', '    window.tmWhiteboardMoveBackToParent ='), context);
    await context.updateShowCompletedTasks(false);
    data.currentGroupId = 'B';
    await context.tmWhiteboardToggleShowDone(true);
    assert.deepEqual(plain(data.showCompletedTasksByGroup), { A: false, B: true });
    await context.updateExcludeCompletedTasks(true);
    assert.equal(data.showCompletedTasksByGroup.B, false);
    assert.equal(data.showCompletedTasks, true);
});

test('group sync fingerprints include visibility and remote preferences update runtime', () => {
    const { context, data } = harness();
    const before = context.__tmBuildDocGroupSyncFingerprint(data);
    context.__tmSetShowCompletedTasksInSettings(false, data, 'B');
    assert.notEqual(context.__tmBuildDocGroupSyncFingerprint(data), before);
    const remote = { ...data, docGroupSettingsUpdatedAt: 200, showCompletedTasksByGroup: { A: false, B: true, all: true } };
    assert.equal(context.__tmShouldPreferRemoteDocGroupState({ ...data, docGroupSettingsUpdatedAt: 100 }, remote), true);
    context.__tmApplyDocGroupSyncSnapshot(remote);
    context.__tmEnsureDocGroupContextValidAfterSync();
    assert.equal(context.state.showCompletedTasks, false);
    assert.deepEqual(plain(data.showCompletedTasksByGroup), remote.showCompletedTasksByGroup);
    assert.equal(context.__tmIsDocGroupSnapshotEmpty({ showCompletedTasksByGroup: { all: false } }), false);
});

test('syncing older data without a map preserves local choices, while an explicit empty map resets them', () => {
    const { context, data } = harness({ showCompletedTasksByGroup: { A: false } });
    const oldRemote = { ...data };
    delete oldRemote.showCompletedTasksByGroup;
    context.__tmApplyDocGroupSyncSnapshot(oldRemote);
    assert.deepEqual(plain(data.showCompletedTasksByGroup), { A: false });
    context.__tmApplyDocGroupSyncSnapshot({ ...oldRemote, showCompletedTasksByGroup: {} });
    assert.deepEqual(plain(data.showCompletedTasksByGroup), {});
});

test('deleting a group removes only its visibility preference', async () => {
    const { context, data } = harness({ showCompletedTasksByGroup: { A: false, B: true, all: false } });
    const method = between(storeSource, '        async updateDocGroups(groups) {', '        // 便捷方法：更新当前分组ID');
    const update = vm.runInContext(`({ ${method} }).updateDocGroups`, context);
    await update.call(context.SettingsStore, [{ id: 'B' }]);
    assert.deepEqual(plain(data.showCompletedTasksByGroup), { B: true, all: false });
});

test('document-group import merges preferences without clearing unrelated groups', () => {
    const { context, data } = harness({ showCompletedTasksByGroup: { A: false, B: false } });
    vm.runInContext(between(exportSource, '    function __tmApplyMigrationSettingsPatch(', '    function __tmGetHolidayMigrationYears('), context);
    context.__tmApplyMigrationSettingsPatch({ showCompletedTasksByGroup: { A: true, all: false } }, 'docGroups');
    assert.deepEqual(plain(data.showCompletedTasksByGroup), { A: true, B: false, all: false });
    const keysSource = between(exportSource, '    const TM_DOC_GROUP_SETTING_KEYS =', '    const TM_AI_SETTING_KEYS =');
    assert.ok(vm.runInContext(`${keysSource}\nTM_DOC_GROUP_SETTING_KEYS.includes('showCompletedTasksByGroup')`, context));
});

test('importing a hidden preference immediately updates the active projection', async () => {
    const { context, renders } = harness();
    vm.runInContext(between(exportSource, '    function __tmApplyMigrationSettingsPatch(', '    function __tmGetHolidayMigrationYears('), context);
    vm.runInContext(between(exportSource, '    async function __tmApplySettingsMigrationPackage(', '    window.tmOpenSettingsImportDialog ='), context);
    await context.__tmApplySettingsMigrationPackage({ modules: { docGroups: { settings: { showCompletedTasksByGroup: { A: false } } } } }, ['docGroups']);
    assert.equal(context.state.showCompletedTasks, false);
    assert.deepEqual(renders, [['A', false]]);
});

test('a failed legacy group switch restores the previous group preference', async () => {
    const { context, data } = harness({ showCompletedTasksByGroup: { A: false, B: true } });
    context.__tmApplyCompletedVisibilityToRuntime();
    context.loadSelectedDocuments = async () => {
        assert.equal(context.state.showCompletedTasks, true);
        throw new Error('load failed');
    };
    vm.runInContext(between(read('settings/62-settings-columns-and-rules.js'), '    window.switchDocGroup =', '    async function __tmCreateGroupAndSelect('), context);
    await assert.rejects(context.switchDocGroup('B'), /load failed/);
    assert.equal(data.currentGroupId, 'A');
    assert.equal(context.state.showCompletedTasks, false);
});

test('session cache keys resolve the requested group even when another group is active', () => {
    const { context, data } = harness({ showCompletedTasksByGroup: { A: false, B: true } });
    context.__tmNormalizeTaskSnapshotDocIds = (ids) => ids;
    vm.runInContext(between(storeSource, '    function __tmBuildGroupSessionTaskCacheKey(', '    function __tmRememberGroupSessionTaskState('), context);
    const key = () => context.__tmBuildGroupSessionTaskCacheKey({ groupId: 'B', docIds: ['doc'], viewMode: 'list' });
    const before = key();
    data.currentGroupId = 'B';
    assert.equal(key(), before);
    data.showCompletedTasksByGroup.B = false;
    assert.notEqual(key(), before);
});

test('locating another document and returning restores each group preference', async () => {
    const { context, data } = harness({ showCompletedTasksByGroup: { A: false, B: true } });
    context.__tmApplyCompletedVisibilityToRuntime();
    context.__tmResolveDocTopbarTargetGroup = async () => ({ groupId: 'B', matchedBy: 'direct' });
    vm.runInContext(between(read('20-api-and-runtime-services.js'), '    async function __tmTryApplyDocTopbarManagerTarget(', '    async function __tmOpenManagerFromDocTopbarEntry('), context);
    await context.__tmTryApplyDocTopbarManagerTarget({ forceLocate: true, requireTasks: false, docId: 'doc-in-B' });
    assert.equal(data.currentGroupId, 'B');
    assert.equal(context.state.showCompletedTasks, true);
    await context.__tmRestoreDefaultManagerContextAfterDocTopbarLocate();
    assert.equal(data.currentGroupId, 'A');
    assert.equal(context.state.showCompletedTasks, false);
});

test('group switches and loader restore visibility before any asynchronous first paint', () => {
    const switchCode = between(dialogSource, '    window.tmSwitchDocGroup =', '        state.openToken =');
    assert.match(switchCode, /SettingsStore\.data\.currentGroupId = nextGroupId;\s*__tmApplyCompletedVisibilityToRuntime\(\);/);
    const loader = read('task-runtime/53c-document-loader-runtime.js');
    assert.match(loader, /async function loadSelectedDocuments\(options = \{\}\) \{\s*__tmApplyCompletedVisibilityToRuntime\(\);/);
    assert.doesNotMatch(loader, /state\.showCompletedTasks = !!SettingsStore\.data\.showCompletedTasks/);
    assert.match(storeSource, /showCompleted: __tmGetShowCompletedTasksFromSettings\(data, opts\.groupId\)/);
});
