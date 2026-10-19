'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = file => fs.readFileSync(path.join(__dirname, '../src/task-horizon/main', file), 'utf8');
const projection = read('task-runtime/51-whiteboard-and-link-runtime.js');
const render = read('40-render-runtime.js');
const extract = name => {
    const start = projection.indexOf(`    function ${name}(`);
    assert.ok(start >= 0, name);
    return projection.slice(start, projection.indexOf('\n    }', start) + 6);
};
const countExpression = render.match(/const filteredCount = ([^;]+);/)?.[1];
assert.ok(countExpression, 'topbar count expression must exist');

const state = { filteredTasks: [], taskTree: [], collapsedTaskIds: new Set(), collapsedGroups: new Set() };
const context = vm.createContext({
    state,
    SettingsStore: { data: { currentGroupId: 'work' } },
    __tmSortDocEntriesForTabs: docs => docs,
    __tmGetDocTabSortMode: () => 'manual',
    __tmGetDocPinnedIdsForGroup: () => [],
    __tmResolveOptimisticTaskId: id => id === 'temp-parent' ? 'parent' : id,
});
vm.runInContext([
    extract('__tmInvalidateFilteredTaskDerivedStateCache'),
    extract('__tmBuildFilteredTaskDerivedState'),
    extract('__tmGetFilteredTaskDerivedState'),
].join('\n'), context);
const count = () => vm.runInContext(countExpression, context);
const setTasks = tasks => {
    state.filteredTasks = tasks;
    context.__tmInvalidateFilteredTaskDerivedStateCache();
};

const pinned = Array.from({ length: 4 }, (_, index) => ({ id: index === 3 ? 'parent' : `pinned-${index}`, pinned: true, root_id: 'work-doc' }));
const normal = { id: 'normal', root_id: 'oil-doc' };
const child = { id: 'child', parentTaskId: 'parent', root_id: 'work-doc' };
setTasks([...pinned, normal, child]);
assert.equal(state.filteredTasks.length, 6, 'reproduce five roots plus one filtered child');
assert.equal(count(), 5, 'topbar must agree with the four pinned roots plus one document root');

state.collapsedTaskIds.add('parent');
state.collapsedGroups.add('doc_oil-doc');
assert.equal(count(), 5, 'collapsing tasks or groups must not change the count');
state.collapsedTaskIds.clear();
state.collapsedGroups.clear();
assert.equal(count(), 5, 'expanding tasks or groups must not count descendants again');

setTasks([...pinned, normal, child, { id: 'grandchild', parent_task_id: 'child', root_id: 'work-doc' }]);
assert.equal(count(), 5, 'nested children must not inflate the topbar count');

setTasks([child]);
assert.equal(count(), 1, 'a child whose parent is filtered out becomes an independent result');

setTasks([pinned[3], { ...child, parentTaskId: 'temp-parent' }]);
assert.equal(count(), 1, 'temporary parent IDs must resolve before counting roots');

setTasks([normal]);
assert.equal(count(), 1, 'replacing the filter results must invalidate the cached count');
setTasks([]);
assert.equal(count(), 0, 'empty results must display zero');

console.log('topbar task count behavior tests passed');
