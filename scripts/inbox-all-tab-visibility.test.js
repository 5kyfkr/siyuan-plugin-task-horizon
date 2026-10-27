'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '../src/task-horizon/main', file), 'utf8');
const foundation = read('30-dialogs-and-ui-foundation.js');
function section(source, start, end) {
    const from = source.indexOf(start), to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, start);
    return source.slice(from, to);
}

const child = { id: 'inbox-child', root_id: 'inbox', parentTaskId: 'inbox-task', children: [], content: 'match child' };
const inbox = { id: 'inbox-task', root_id: 'inbox', children: [child], content: 'match inbox' };
const ordinary = { id: 'work-task', root_id: 'work', children: [], content: 'match work' };
const flatTasks = Object.fromEntries([inbox, child, ordinary].map(task => [task.id, task]));
const state = {
    activeDocId: 'all', taskTree: [{ id: 'inbox', tasks: [inbox] }, { id: 'work', tasks: [ordinary] }],
    flatTasks, otherBlocks: [], showCompletedTasks: true, groupByDocName: true, searchKeyword: '',
};
const data = { currentGroupId: 'group-a', newTaskDocId: 'inbox', hideInboxFromAllTab: false };
let rule = { conditions: [] };
let saves = 0;
const storage = new Map();
const context = vm.createContext({
    Map, Set, state, SettingsStore: { data, save: async () => { saves++; } },
    Storage: { get: (key, fallback) => storage.has(key) ? storage.get(key) : fallback, set: (key, value) => storage.set(key, value) },
    CustomEvent: class {}, document: { body: { contains: () => false } },
    __tmTaskStore: { getFlatMap: () => flatTasks },
    __tmGetCurrentRule: () => rule, __tmGetArchiveModeFilterRule: value => value,
    __tmRuleUsesCustomOrderSort: () => false, __tmIsOtherBlockTabId: id => id === 'other',
    __tmParseDocTabCustomGroupActiveId: id => id === 'tabs' ? 'tabs' : '',
    __tmSortDocEntriesForTabs: docs => docs,
    __tmGetDocTabCustomGroupDocIdSet: () => new Set(['inbox', 'work']),
    __tmFindDocTabCustomGroupById: () => ({}), __tmGetDocTabCustomGroupRegionState: () => ({}),
    __tmShouldShowDocTabCustomGroupInRegion: () => true,
    __tmGetActiveDocTabCustomGroupDocIdSet: id => new Set(id === 'tabs' ? ['inbox', 'work'] : []),
    __tmIsDocManuallyArchivedInGroup: () => false, __tmIsDocManuallyUnarchivedInGroup: () => false,
    __tmRuleHasExplicitSort: () => false, __tmIsAllRuleLike: value => !value.conditions.length,
    __tmHasActiveDocTabContentFilter: () => true, __tmRuleUsesDocFlowSort: () => true,
    __tmTaskMatchesSearch: (task, keyword) => task.content.includes(keyword),
    __tmGetTaskSearchFields: () => ['content', 'remark'],
    __tmDocShouldShowInDocTabs: () => true, __tmIsCollectedOtherBlockTask: () => false,
    __tmApplyWhiteboardSequenceFilter: tasks => tasks, __tmUpdateFilteredTaskRenderWindowState() {},
    __tmGetCalendarDocsToGroupMapSync: () => new Map(), __tmIsCalendarTaskPendingDeletedSync: () => false,
    __tmFlattenCalendarTaskTreeSync: () => [inbox, child], __tmGetCalendarFlatTasksSync: () => [inbox, child],
    RuleManager: { applyRuleFilter: tasks => tasks, applyRuleSort: tasks => tasks },
});
context.window = context;
context.dispatchEvent = () => {};
vm.runInContext(read('34-task-projection-engine.js'), context);
vm.runInContext(section(foundation, '    function __tmIsInboxHiddenFromAllTab(', '    function __tmGetArchiveModeFilterRule('), context);
vm.runInContext(section(foundation, '    function applyFilters()', '    function __tmIsTaskAndDescDone('), context);
context.__tmRecomputeTaskProjection = () => context.applyFilters();
const visible = () => { context.applyFilters(); return Array.from(state.filteredTasks, task => task.id); };
assert.deepEqual(visible(), ['inbox-task', 'inbox-child', 'work-task']);
data.hideInboxFromAllTab = true;
for (const groupId of ['group-a', 'group-b', 'all']) {
    data.currentGroupId = groupId;
    for (const view of ['list', 'checklist', 'kanban', 'timeline', 'calendar', 'whiteboard']) {
        state.viewMode = view;
        const expected = groupId === 'all' ? ['inbox-task', 'inbox-child', 'work-task'] : ['work-task'];
        assert.deepEqual(visible(), expected, `${groupId}/${view}: only custom document groups exclude the inbox subtree`);
    }
}
state.searchKeyword = 'inbox';
assert.deepEqual(visible(), ['inbox-task'], 'All Documents keeps inbox tasks searchable');
state.searchKeyword = 'match';
rule = { conditions: [{ field: 'priority' }] };
assert.deepEqual(visible(), ['inbox-task', 'inbox-child', 'work-task'], 'All Documents keeps inbox tasks eligible for rule filtering');
data.currentGroupId = 'group-a';
state.searchKeyword = 'inbox';
assert.deepEqual(visible(), [], 'search must not bring inbox tasks back into All');
state.searchKeyword = 'match';
rule = { conditions: [{ field: 'priority' }] };
assert.deepEqual(visible(), ['work-task'], 'rule filtering keeps inbox tasks hidden');
state.searchKeyword = '';
rule = { conditions: [] };
state.activeDocId = 'inbox';
assert.deepEqual(visible(), ['inbox-task', 'inbox-child'], 'clicking the inbox tab restores its subtree');
state.activeDocId = 'work';
assert.deepEqual(visible(), ['work-task']);
state.activeDocId = 'tabs';
assert.deepEqual(visible(), ['inbox-task', 'inbox-child', 'work-task'], 'custom tab groups keep their explicit scope');
state.activeDocId = 'all';
state.otherBlocks = [{ id: 'collected-inbox', root_id: 'inbox', children: [], content: 'match collected inbox' }];
assert.deepEqual(visible(), ['work-task'], 'collecting an inbox block must not restore it in a custom group All tab');
data.currentGroupId = 'all';
assert.deepEqual(visible(), ['inbox-task', 'inbox-child', 'work-task', 'collected-inbox'], 'All Documents retains collected inbox blocks');
data.currentGroupId = 'group-a';
state.activeDocId = 'other';
assert.deepEqual(visible(), ['collected-inbox'], 'the Other Blocks tab keeps its explicit scope');
state.activeDocId = 'all';
state.otherBlocks = [];

data.newTaskDocId = 'work';
assert.deepEqual(visible(), ['inbox-task', 'inbox-child'], 'changing the configured inbox immediately changes the exclusion');
data.newTaskDocId = '';
assert.deepEqual(visible(), ['inbox-task', 'inbox-child', 'work-task'], 'an unconfigured inbox excludes nothing');
data.newTaskDocId = 'inbox';

vm.runInContext(section(read('render/48-render-calendar-support-runtime.js'), '    function __tmGetCalendarTaskCandidatesSync()', '    function __tmResolveCalendarTaskDisplayTitle('), context);
state.filteredTasks = [];
context.__tmCalendarAllTasksCache = { tasks: [inbox, child] };
data.currentGroupId = 'all';
assert.deepEqual(Array.from(context.__tmGetCalendarTaskCandidatesSync().tasks, task => task.id), ['inbox-task', 'inbox-child'], 'All Documents calendar fallback keeps inbox tasks');
data.currentGroupId = 'group-a';
assert.deepEqual(Array.from(context.__tmGetCalendarTaskCandidatesSync().tasks), [], 'calendar fallback cannot restore hidden inbox tasks');
state.activeDocId = 'inbox';
assert.equal(context.__tmGetCalendarTaskCandidatesSync().tasks.length, 2, 'calendar still reads inbox tasks in its own tab');

const stores = read('10-stores-rules-and-cache.js');
const storeFunction = name => {
    const from = stores.indexOf(`    function ${name}(`);
    const to = stores.indexOf('\n    }', from);
    assert.ok(from >= 0 && to > from, name);
    return stores.slice(from, to + 6);
};
Object.assign(context, {
    __tmGetEffectiveGroupModeValue: () => 'doc', __tmGetTaskSnapshotRuleForView: () => rule,
    __tmStableSettingsJsonValue: value => value, __tmGetShowCompletedTasksFromSettings: () => true,
    __tmNormalizeCompletedTasksGroupBy: () => 'date', __tmBuildTaskSnapshotViewStructureSignature: () => '',
    __tmNormalizeWhiteboardSequenceScope: () => '', __tmRuleSortsUseCustomOrderField: () => false,
    __tmParseVersionNumber: value => Number(value) || 0,
    __tmNormalizeTaskMetaAttrKeySettings: () => ({}), __tmNormalizeTaskMetaAttrAliasSettings: () => ({}),
    __tmTaskBoundary: { getTask: id => flatTasks[id] },
});
vm.runInContext([
    '__tmBuildTaskSnapshotViewSignature', '__tmBuildTaskSnapshotViewState',
    '__tmGetTaskSnapshotViewStateCandidates', '__tmRestoreTaskSnapshotViewState',
].map(storeFunction).join('\n'), context);
state.activeDocId = 'all';
data.hideInboxFromAllTab = false;
visible();
const unhiddenSnapshot = { viewState: context.__tmBuildTaskSnapshotViewState() };
data.hideInboxFromAllTab = true;
assert.equal(context.__tmRestoreTaskSnapshotViewState(unhiddenSnapshot), null, 'enabling the setting invalidates a cached unfiltered group view');
assert.deepEqual(visible(), ['work-task']);
const hiddenSnapshot = { viewState: context.__tmBuildTaskSnapshotViewState() };
data.hideInboxFromAllTab = false;
assert.equal(context.__tmRestoreTaskSnapshotViewState(hiddenSnapshot), null, 'disabling the setting invalidates a cached filtered group view');
data.hideInboxFromAllTab = true;
const legacySignature = JSON.parse(hiddenSnapshot.viewState.signature);
delete legacySignature.hideInboxFromAllTab;
delete legacySignature.newTaskDocId;
assert.equal(context.__tmRestoreTaskSnapshotViewState({ viewState: { ...hiddenSnapshot.viewState, signature: JSON.stringify(legacySignature) } }), null, 'snapshots made before inbox filtering participated in the signature must be recomputed');
data.newTaskDocId = 'work';
assert.equal(context.__tmRestoreTaskSnapshotViewState(hiddenSnapshot), null, 'changing the inbox invalidates a cached group view');
data.newTaskDocId = 'inbox';
hiddenSnapshot.viewState.filteredTaskIds = ['inbox-task', 'inbox-child', 'work-task'];
assert.ok(context.__tmRestoreTaskSnapshotViewState(hiddenSnapshot));
assert.deepEqual(Array.from(state.filteredTasks, task => task.id), ['work-task'], 'cache restoration enforces the current inbox exclusion');
data.currentGroupId = 'all';
visible();
const allDocsSnapshot = { viewState: context.__tmBuildTaskSnapshotViewState() };
state.filteredTasks = [];
assert.ok(context.__tmRestoreTaskSnapshotViewState(allDocsSnapshot));
assert.deepEqual(Array.from(state.filteredTasks, task => task.id), ['inbox-task', 'inbox-child', 'work-task'], 'All Documents keeps inbox tasks after cache restoration');
data.currentGroupId = 'group-a';
state.activeDocId = 'inbox';
visible();
const inboxSnapshot = { viewState: context.__tmBuildTaskSnapshotViewState() };
state.filteredTasks = [];
assert.ok(context.__tmRestoreTaskSnapshotViewState(inboxSnapshot));
assert.deepEqual(Array.from(state.filteredTasks, task => task.id), ['inbox-task', 'inbox-child'], 'the inbox document tab still restores its own tasks');

const persistenceLine = marker => stores.split('\n').find(line => line.includes(marker));
const save = persistenceLine("Storage.set('tm_hide_inbox_from_all_tab'");
const load = persistenceLine("Storage.get('tm_hide_inbox_from_all_tab'");
for (const value of [true, false]) {
    data.hideInboxFromAllTab = value;
    vm.runInContext(`(function() { ${save} }).call(SettingsStore)`, context);
    data.hideInboxFromAllTab = !value;
    vm.runInContext(`(function() { ${load} }).call(SettingsStore)`, context);
    assert.equal(data.hideInboxFromAllTab, value, 'local save/load retains both switch states');
}

vm.runInContext(section(read('settings/70-doc-group-and-settings-actions.js'), '    window.updateHideInboxFromAllTab =', '    window.updateNewTaskLocationMode ='), context);
(async () => {
    state.activeDocId = 'all';
    await context.updateHideInboxFromAllTab(true);
    assert.deepEqual(Array.from(state.filteredTasks, task => task.id), ['work-task'], 'enabling the setting updates the open view');
    await context.updateHideInboxFromAllTab(false);
    assert.deepEqual(Array.from(state.filteredTasks, task => task.id), ['inbox-task', 'inbox-child', 'work-task']);
    data.currentGroupId = 'all';
    for (const enabled of [true, false]) {
        await context.updateHideInboxFromAllTab(enabled);
        assert.deepEqual(Array.from(state.filteredTasks, task => task.id), ['inbox-task', 'inbox-child', 'work-task'], 'toggling the setting keeps inbox tasks in All Documents');
    }
    assert.equal(saves, 4);
    console.log('inbox All tab visibility tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
