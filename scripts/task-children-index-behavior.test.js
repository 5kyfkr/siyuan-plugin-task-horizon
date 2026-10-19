'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const state = { flatTasks: {}, pendingInsertedTasks: {}, pendingDeletedTasks: {}, doneOverrides: {}, taskTree: [], filteredTasks: [], otherBlocks: [] };
const context = vm.createContext({ state, console, SettingsStore: { data: {} }, MetaStore: { set() {}, remapId() {} }, setTimeout, clearTimeout });
vm.runInContext(read('src/task-horizon/main/32-runtime-state-and-events.js'), context);
const store = context.__tmTaskStore;
store.rememberIdentity({ clientId: 'client-parent', tempId: 'temp-parent', blockId: 'real-parent' });
const tasks = {
    'real-parent': { id: 'real-parent', children: [{ id: 'nested' }] },
    nested: { id: 'nested' },
    b: { id: 'b', parentTaskId: 'temp-parent', content: 'base' },
    c: { id: 'c', parent_task_id: 'real-parent' },
    p2: { id: 'p2', children: [] },
};
store.replaceFlat(tasks, { authoritative: true, mergeOtherBlocks: false });
store.upsertLocal({ id: 'pending', parentTaskId: 'real-parent' }, { pending: true });
function parity() {
    const reader = store.createDirectChildrenReader();
    for (const parent of ['real-parent', 'temp-parent', 'client-parent', 'p2', 'missing']) {
        assert.deepEqual(plain(reader(parent)), plain(store.listProjectedDirectChildren(parent)), parent);
    }
}
parity();
store.applyMutation({ type: 'taskPatch', taskId: 'b', patch: { content: 'optimistic' } }, { mutationId: 'edit-b' });
parity();
store.markPendingDeleted('c');
parity();
store.patchLocal('b', { parentTaskId: 'p2' });
parity();
store.removePending('pending');
parity();

// Calendar sources retain their original merge precedence, visibility filters,
// and raw hasChildren behavior, but scan each source once for a render.
const calendar = read('calendar-view.js');
const begin = calendar.indexOf('            const protoListTaskParentId =');
const end = calendar.indexOf('            const protoListTaskFieldEnabled =', begin);
const cached = [
    { id: 'cached', parentId: 'parent' },
    { id: 'duplicate', parentTaskId: 'parent', content: 'cache' },
    { id: 'cancelled', parent_id: 'parent', cancelled: true },
    { id: 'hidden', parent_task_id: 'parent', hidden: true },
];
const runtime = { r: { id: 'runtime', parentTaskId: 'parent' } };
const local = { l: { id: 'local', parentTaskId: 'parent' } };
const bridge = {
    isCanceled: task => !!task.cancelled,
    createChildrenReader: () => parent => parent === 'parent' ? [{ id: 'projected' }, { id: 'duplicate', content: 'projection' }] : [],
};
const calendarContext = vm.createContext({ state: { flatTasks: local }, window: { __tmCalendarAllTasksCache: { tasks: cached } },
    __tmRuntimeState: { getFlatTasks: () => runtime }, __tmCalendarKanbanCardHelpers: bridge,
    __tmProjectVisibility: { isTaskHidden: task => task.hidden }, getCalendarTaskSnapshotById: () => null });
vm.runInContext(calendar.slice(begin, end) + '\nthis.children = protoListTaskChildren; this.has = protoListTaskHasChildren; this.reset = () => { protoListChildContext = null; };', calendarContext);
const parent = { id: 'parent', children: [{ id: 'nested' }, { id: 'duplicate', content: 'nested' }] };
assert.deepEqual(plain(calendarContext.children(parent)), [
    { id: 'nested' }, { id: 'duplicate', content: 'nested' }, { id: 'projected' }, cached[0], runtime.r, local.l,
]);
assert.equal(calendarContext.has({ id: 'parent' }), true);
cached.push({ id: 'new', parentTaskId: 'new-parent' });
calendarContext.reset();
assert.equal(calendarContext.has({ id: 'new-parent' }), true, 'the next render must rebuild its index');

let parentReads = 0;
const many = {};
for (let i = 0; i < 2000; i++) {
    many[`task-${i}`] = { id: `task-${i}`, get parentTaskId() { parentReads++; return ''; } };
}
store.replaceFlat(many, { authoritative: true, mergeOtherBlocks: false });
parentReads = 0;
const reader = store.createDirectChildrenReader();
for (let i = 0; i < 2000; i++) assert.equal(reader(`task-${i}`).length, 0);
assert.ok(parentReads < 20000, `TaskStore reads must scale linearly (${parentReads})`);
calendarContext.state.flatTasks = {};
calendarContext.__tmRuntimeState.getFlatTasks = () => ({});
calendarContext.window.__tmCalendarAllTasksCache.tasks = Object.values(many);
bridge.createChildrenReader = () => reader;
calendarContext.reset();
parentReads = 0;
for (let i = 0; i < 2000; i++) assert.equal(calendarContext.has(many[`task-${i}`]), false);
assert.ok(parentReads < 20000, `calendar relation reads must scale linearly (${parentReads})`);
const familyTasks = {};
for (let i = 0; i < 2000; i++) {
    familyTasks[`parent-${i}`] = { id: `parent-${i}` };
    familyTasks[`child-${i}`] = { id: `child-${i}`, get parentTaskId() { parentReads++; return `parent-${i}`; } };
}
store.replaceFlat(familyTasks, { authoritative: true, mergeOtherBlocks: false });
parentReads = 0;
const familyReader = store.createDirectChildrenReader();
for (let i = 0; i < 2000; i++) assert.deepEqual(Array.from(familyReader(`parent-${i}`), task => task.id), [`child-${i}`]);
assert.ok(parentReads < 20000, `non-empty child lookups must also scale linearly (${parentReads})`);
console.log('task/calendar children index: projection parity, refresh invalidation, and 2k-task linear scan checks passed');
