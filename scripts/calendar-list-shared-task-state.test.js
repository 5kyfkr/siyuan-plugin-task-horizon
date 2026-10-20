'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const calendar = read('calendar-view.js');
const model = read('src/task-horizon/main/task-runtime/50-task-model-and-repeat-utils.js');
const stores = read('src/task-horizon/main/10-stores-rules-and-cache.js');
const actions = read('src/task-horizon/main/settings/70-doc-group-and-settings-actions.js');
function between(source, start, end) {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, start);
    return source.slice(from, to);
}
const storage = new Map();
let saved = 0;
let sidebarRenders = 0;
let calendarRenders = 0;
const SettingsStore = {
    data: { currentGroupId: 'work', showCompletedTasks: true, showCompletedTasksByGroup: { work: false }, collapsedTaskIds: ['parent'] },
    save: () => { saved++; return Promise.resolve(); },
};
const taskState = { collapsedTaskIds: new Set(SettingsStore.data.collapsedTaskIds), viewMode: 'calendar', modal: {} };
const taskContext = vm.createContext({
    state: taskState, SettingsStore,
    Storage: { set: (key, value) => storage.set(key, JSON.parse(JSON.stringify(value))) },
    __tmMarkCollapseStateChanged: () => { SettingsStore.data.collapseStateUpdatedAt = 100; },
    __tmHasCalendarSidebarChecklist: () => true,
    __tmRefreshCalendarSidebarChecklistPreserveScroll: () => { sidebarRenders++; },
    __tmGetCollapseAnimMode: () => 'none',
    __tmResetFlipState() {},
    __tmCalendar: { refreshTaskListState: () => { calendarRenders++; } },
});
taskContext.window = taskContext;
vm.runInContext(between(stores, '    function __tmGetShowCompletedTasksFromSettings(', '    function __tmSetShowCompletedTasksInSettings(')
    + model.slice(model.indexOf('    globalThis.__tmCalendarKanbanCardHelpers ='))
    + between(actions, '    window.tmToggleCollapse =', '    function __tmCollectVisibleGroupKeysFromDom('), taskContext);
const bridge = taskContext.__tmCalendarKanbanCardHelpers;
const calendarContext = vm.createContext({
    state: { settingsStore: SettingsStore },
    __tmCalendarKanbanCardHelpers: bridge,
});
vm.runInContext(between(calendar, '            const protoListShowCompletedTasks =', '            const protoListTaskDone =')
    + 'this.showCompleted = protoListShowCompletedTasks; this.collapsedIds = protoListCollapsedTaskIds;', calendarContext);
assert.equal(calendarContext.showCompleted(), false, 'Calendar reads the current group’s main task setting');
SettingsStore.data.currentGroupId = 'personal';
assert.equal(calendarContext.showCompleted(), true, 'Group changes use the global fallback immediately');
assert.equal(calendarContext.collapsedIds().has('parent'), true, 'Existing main-list folds apply on the first calendar render');

bridge.setTaskCollapsed('parent', false);
assert.equal(taskState.collapsedTaskIds.has('parent'), false, 'Calendar expansion updates the main view’s live state');
assert.deepEqual(storage.get('tm_collapsed_task_ids'), []);
bridge.setTaskCollapsed('parent', true);
assert.deepEqual(Array.from(SettingsStore.data.collapsedTaskIds), ['parent']);
assert.deepEqual(storage.get('tm_collapsed_task_ids'), ['parent']);
assert.equal(saved, 2);
assert.equal(sidebarRenders, 2, 'The visible task sidebar follows calendar fold changes');
assert.equal(SettingsStore.data.collapseStateUpdatedAt, 100, 'Shared folds participate in existing settings synchronization');

// Restore through the actual settings load and shell initialization statements.
SettingsStore.data.collapsedTaskIds = [];
taskState.collapsedTaskIds = new Set();
taskContext.Storage.get = (key, fallback) => storage.get(key) || fallback;
const localLoad = stores.match(/^\s*this\.data\.collapsedTaskIds = Storage\.get\('tm_collapsed_task_ids'.*$/m)[0];
vm.runInContext(`(function() { ${localLoad} }).call(SettingsStore); state.collapsedTaskIds = new Set(SettingsStore.data.collapsedTaskIds || []);`, taskContext);
assert.equal(calendarContext.collapsedIds().has('parent'), true, 'Reopening restores the same saved state to both views');

async function checkMainTaskControls() {
    await taskContext.tmToggleCollapse('parent');
    assert.equal(calendarContext.collapsedIds().has('parent'), false, 'Main task expansion is immediately visible to the calendar');
    assert.equal(calendarRenders, 1, 'Main task controls repaint the calendar list without refetching events');
    assert.deepEqual(storage.get('tm_collapsed_task_ids'), []);
    await taskContext.tmToggleCollapse('other');
    assert.equal(calendarContext.collapsedIds().has('other'), true);
    assert.deepEqual(storage.get('tm_collapsed_task_ids'), ['other']);
    console.log('calendar list shared visibility, collapse synchronization and restart persistence tests passed');
}
checkMainTaskControls().catch((error) => { console.error(error); process.exitCode = 1; });
