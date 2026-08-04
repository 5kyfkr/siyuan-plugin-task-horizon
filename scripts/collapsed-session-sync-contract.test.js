'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const stores = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'),
    'utf8',
);
const refreshRuntime = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/render/39-render-doc-group-sync-and-refresh.js'),
    'utf8',
);

function sliceBetween(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
    assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
    return source.slice(start, end);
}

const timestampContext = vm.createContext({
    __tmParseTimeToTs: () => 0,
    Set,
    Object,
    Array,
    String,
    Number,
    JSON,
});
const parseUpdatedAtSource = sliceBetween(
    stores,
    'function __tmParseUpdatedAtNumber',
    'function __tmNormalizeQuickAddRecentDocs',
);
const collapsedStateSource = sliceBetween(
    stores,
    'function __tmBuildCollapsedSessionState',
    'function __tmNormalizeWhiteboardStoreData',
);
vm.runInContext(`${parseUpdatedAtSource}\n${collapsedStateSource}\nthis.testApi = { __tmGetCollapsedSessionUpdatedAt, __tmShouldPreferRemoteCollapsedSessionState };`, timestampContext);

const {
    __tmGetCollapsedSessionUpdatedAt: getUpdatedAt,
    __tmShouldPreferRemoteCollapsedSessionState: preferRemote,
} = timestampContext.testApi;

assert.equal(getUpdatedAt({
    collapseStateUpdatedAt: 500,
    settingsUpdatedAt: 900,
    collapsedTaskIds: [],
}), 500, 'an explicit collapse timestamp must be authoritative even for an empty state');
assert.equal(getUpdatedAt({
    settingsUpdatedAt: 900,
    collapsedTaskIds: [],
    collapsedGroups: [],
}), 0, 'a legacy empty state must not inherit the unrelated settings timestamp');
assert.equal(getUpdatedAt({
    settingsUpdatedAt: 700,
    collapsedTaskIds: ['task-a'],
}), 700, 'legacy non-empty collapse state must migrate through settingsUpdatedAt');
assert.equal(getUpdatedAt({
    collapseStateUpdatedAt: 400,
    settingsUpdatedAt: 900,
    collapsedGroups: ['group-a'],
}), 400, 'the explicit collapse clock must take precedence over the global settings clock');

assert.equal(preferRemote(400, 500), true, 'a newer explicit remote collapse action must win');
assert.equal(preferRemote(500, 400), false, 'an older remote collapse action must not overwrite local state');
assert.equal(preferRemote(0, 0), false, 'an unversioned remote empty state must not win by a timestamp tie');
assert.doesNotMatch(stores, /cloudCollapseUpdatedAt\s*>=\s*localCollapseUpdatedAt/, 'collapse state merge must not let an equal or missing remote clock win');
assert.equal((stores.match(/__tmShouldPreferRemoteCollapsedSessionState\(/g) || []).length, 4, 'all collapse merge paths must use the strict timestamp comparison');

const SettingsStore = {
    data: {},
    normalizeColumns() {},
    syncToLocal() {},
    refreshCollapsedStateSyncState() {},
};
const state = {};
const restoreContext = vm.createContext({
    SettingsStore,
    state,
    Set,
    String,
    Array,
    __tmParseUpdatedAtNumber: (value) => Number(value) || 0,
    __tmGetCollapsedSessionUpdatedAt: (data) => Number(data?.collapseStateUpdatedAt) || 0,
});
const restoreSource = sliceBetween(
    refreshRuntime,
    'function __tmRestoreManualRefreshSessionState',
    'function __tmCaptureRefreshUiState',
);
vm.runInContext(`${restoreSource}\nthis.restore = __tmRestoreManualRefreshSessionState;`, restoreContext);

const snapshot = {
    currentGroupId: 'saved-group',
    currentRule: { id: 'saved-rule' },
    collapsedTaskIds: ['saved-task'],
    collapsedGroups: ['saved-group-collapse'],
    expandedCompletedGroups: ['saved-completed-group'],
    kanbanCollapsedTaskIds: ['saved-kanban-task'],
    kanbanCollapsedColumnKeys: ['saved-column'],
    collapseStateUpdatedAt: 100,
    groupMode: 'status',
    groupByDocName: true,
    groupByTime: false,
    groupByTaskName: true,
};

SettingsStore.data = {
    currentGroupId: 'remote-group',
    currentRule: { id: 'remote-rule' },
    collapsedTaskIds: ['remote-task'],
    collapsedGroups: ['remote-group-collapse'],
    expandedCompletedGroups: ['remote-completed-group'],
    kanbanCollapsedTaskIds: ['remote-kanban-task'],
    kanbanCollapsedColumnKeys: ['remote-column'],
    collapseStateUpdatedAt: 900,
    groupMode: 'none',
};
restoreContext.restore(snapshot, { restoreCollapse: false });
assert.equal(SettingsStore.data.currentGroupId, 'saved-group', 'automatic reload must preserve the current group context');
assert.equal(SettingsStore.data.currentRule.id, 'saved-rule', 'automatic reload must preserve the current rule context');
assert.deepEqual(Array.from(SettingsStore.data.collapsedTaskIds), ['remote-task'], 'automatic reload must retain the merged collapse state');
assert.deepEqual(Array.from(state.collapsedTaskIds), ['remote-task'], 'runtime sets must hydrate from the merged collapse state');
assert.equal(SettingsStore.data.collapseStateUpdatedAt, 900, 'automatic reload must retain the merged collapse timestamp');

SettingsStore.data = {
    collapsedTaskIds: ['remote-task'],
    collapsedGroups: [],
    expandedCompletedGroups: [],
    kanbanCollapsedTaskIds: [],
    kanbanCollapsedColumnKeys: [],
    collapseStateUpdatedAt: 900,
};
restoreContext.restore(snapshot);
assert.deepEqual(Array.from(SettingsStore.data.collapsedTaskIds), ['saved-task'], 'manual session restoration must still restore its collapse snapshot by default');
assert.equal(SettingsStore.data.collapseStateUpdatedAt, 100, 'manual session restoration must still restore its collapse timestamp by default');

console.log('collapsed session sync contract tests passed');
