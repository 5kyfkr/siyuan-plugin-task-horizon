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
    __tmRuleUsesCustomOrderSort: () => false, __tmIsOtherBlockTabId: () => false,
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
        assert.deepEqual(visible(), ['work-task'], `${groupId}/${view}: All excludes the inbox subtree`);
    }
}
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
data.newTaskDocId = 'work';
assert.deepEqual(visible(), ['inbox-task', 'inbox-child'], 'changing the configured inbox immediately changes the exclusion');
data.newTaskDocId = '';
assert.deepEqual(visible(), ['inbox-task', 'inbox-child', 'work-task'], 'an unconfigured inbox excludes nothing');
data.newTaskDocId = 'inbox';

vm.runInContext(section(read('render/48-render-calendar-support-runtime.js'), '    function __tmGetCalendarTaskCandidatesSync()', '    function __tmResolveCalendarTaskDisplayTitle('), context);
state.filteredTasks = [];
context.__tmCalendarAllTasksCache = { tasks: [inbox, child] };
assert.deepEqual(Array.from(context.__tmGetCalendarTaskCandidatesSync().tasks), [], 'calendar fallback cannot restore hidden inbox tasks');
state.activeDocId = 'inbox';
assert.equal(context.__tmGetCalendarTaskCandidatesSync().tasks.length, 2, 'calendar still reads inbox tasks in its own tab');

const stores = read('10-stores-rules-and-cache.js');
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
    assert.equal(saves, 2);
    console.log('inbox All tab visibility tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
