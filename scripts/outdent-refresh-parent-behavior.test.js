'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const read = (name) => fs.readFileSync(path.join(__dirname, '../src/task-horizon/main', name), 'utf8');
function between(source, start, end) {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from);
    return source.slice(from, to);
}

test('outdent stays at root while sibling order is still awaiting SQL confirmation', async () => {
    const local = {
        id: 'child', root_id: 'doc', parent_id: 'root-list', parentId: 'root-list',
        parentTaskId: '', parent_task_id: '',
        // These joined aliases still describe the list before the move.
        parent_list_parent_id: 'old-parent', parentListParentId: 'old-parent',
    };
    const context = vm.createContext({
        Map, Set, Date, console,
        normalizeId: (value) => String(value || '').trim(),
        getTaskById: (id) => id === 'child' ? local : null,
        __tmNormalizeTaskParentLookupDepth: () => 0,
        SettingsStore: { data: {} },
    });
    vm.runInContext('const pendingStructuralMutations = new Map();\n' + between(
        read('32-runtime-state-and-events.js'), 'const prunePendingStructuralMutations', 'const getModal',
    ) + '\nglobalThis.pending = { rememberPendingStructuralMutation, mergePendingStructuralRows, pendingStructuralMutations };', context);
    vm.runInContext(between(read('40-render-runtime.js'),
        'async function __tmResolveDocTaskParentLinks(', 'function __tmIsOtherBlockTabId('), context);
    const pending = context.pending;
    pending.rememberPendingStructuralMutation({
        type: 'moveTask', phase: 'commit', taskId: 'child',
        data: { mode: 'after', targetTaskId: 'old-parent', targetParentTaskId: '' },
        placement: { taskID: 'child', documentID: 'doc', parentListID: 'root-list', parentTaskID: '',
            previousSiblingID: 'old-parent', nextSiblingID: '' },
    });
    // Placement has reached SQL, but SQL order has not. This keeps the overlay active.
    const rows = [
        { id: 'child', root_id: 'doc', parent_id: 'root-list', parent_task_id: null, parent_list_parent_id: 'doc', doc_seq: 1 },
        { id: 'old-parent', root_id: 'doc', parent_id: 'root-list', parent_task_id: null, parent_list_parent_id: 'doc', doc_seq: 2 },
    ];
    const projected = pending.mergePendingStructuralRows(rows, { docIds: ['doc'] });
    assert.equal(pending.pendingStructuralMutations.has('child'), true);
    const tree = await context.__tmResolveDocTaskParentLinks(projected, { docId: 'doc' });
    assert.deepEqual(Array.from(tree.rootTasks, (task) => task.id), ['child', 'old-parent']);
    assert.equal(projected[0].parentTaskId, '');
    assert.equal(projected[0].parent_list_parent_id, '');
    assert.equal(projected[0].parentListParentId, '');
    assert.equal(projected[1].children.length, 0);
    const confirmed = pending.mergePendingStructuralRows([
        { ...rows[1], doc_seq: 1 }, { ...rows[0], doc_seq: 2 },
    ], { docIds: ['doc'] });
    assert.equal(pending.pendingStructuralMutations.size, 0);
    assert.equal(confirmed[1].parent_list_parent_id, 'doc', 'confirmed SQL ancestry is kept intact');
});

test('queued and optimistic moves reset all aliases before a document refresh', () => {
    const context = vm.createContext({
        state: { allDocuments: [] },
        __tmResolveMoveTargetListId: (payload) => payload.targetListId,
        __tmGetMoveTargetHeadingMeta: () => ({ h2Id: '', h2: '', h2Rank: 0 }),
    });
    vm.runInContext(between(read('task-runtime/53b-task-create-and-quick-add-runtime.js'),
        'function __tmResetMovedTaskAttrHostProjection(', 'function __tmCloneTaskTreeForMove('), context);
    for (const method of ['__tmApplyQueuedTaskMovePatchToTask', '__tmApplyMovePayloadToTaskRecursive']) {
        const task = { id: 'child', parentTaskId: 'old', parent_task_id: 'old',
            parent_list_parent_id: 'old', parentListParentId: 'old', parent_id: 'old-list' };
        context[method](task, { mode: 'after', targetDocId: 'doc', targetParentTaskId: '', targetListId: 'root-list' });
        assert.equal(task.parentTaskId, '');
        assert.equal(task.parent_task_id, '');
        assert.equal(task.parent_list_parent_id, '');
        assert.equal(task.parentListParentId, '');
        assert.equal(task.parentListId, 'root-list');
        context[method](task, { mode: 'child', targetDocId: 'doc', targetTaskId: 'new-parent',
            targetListId: 'new-list', targetChildListId: 'new-list' });
        assert.equal(task.parent_list_parent_id, 'new-parent');
        assert.equal(task.parentListParentId, 'new-parent');
        assert.equal(task.parentListId, 'new-list');
    }
});

test('an incremental confirmation keeps resolved placement when SQL still describes the old parent', () => {
    const context = vm.createContext({ Map, Set });
    vm.runInContext(between(read('10-stores-rules-and-cache.js'),
        'function __tmBuildStructuredAuthoritativeTaskList(', 'function __tmPrepareTaskBlockIncrementalRow('), context);
    const raw = new Map([
        ['old-parent', { id: 'old-parent', root_id: 'doc', children: [] }],
        ['child', { id: 'child', root_id: 'doc', docId: 'doc', parentTaskId: 'old-parent',
            parent_task_id: 'old-parent', parent_id: 'old-list', parentListId: 'old-list',
            parent_list_parent_id: 'old-parent', parentListParentId: 'old-parent', doc_seq: 9,
            content: 'Fresh server content', priority: 'high' }],
    ]);
    const projectedChild = { id: 'child', root_id: 'doc', docId: 'doc', parentTaskId: '',
        parent_task_id: '', parent_id: 'root-list', parentId: 'root-list', parentListId: 'root-list',
        parent_list_parent_id: '', parentListParentId: '', doc_seq: 2, level: 0, children: [],
        content: 'Local content', priority: 'low' };
    const result = context.__tmBuildStructuredAuthoritativeTaskList(raw, [{ nextDoc: { tasks: [
        { id: 'old-parent', children: [] }, projectedChild,
    ] } }]);
    const child = result.find((task) => task.id === 'child');
    assert.equal(child.parentTaskId, '', 'confirmed state must not reintroduce the SQL parent after outdent');
    assert.equal(child.parent_task_id, '');
    assert.equal(child.parent_id, 'root-list');
    assert.equal(child.parentListId, 'root-list');
    assert.equal(child.parent_list_parent_id, '');
    assert.equal(child.doc_seq, 2);
    assert.equal(child.content, 'Fresh server content', 'only structure comes from the resolved tree');
    assert.equal(child.priority, 'high');
});

test('a sparse move receipt promotes the acknowledged aliases and current descendants', () => {
    const stale = { id: 'child', root_id: 'doc', docId: 'doc', parentTaskId: 'old-parent',
        parent_task_id: 'old-parent', parent_id: 'old-list', parentListParentId: 'old-parent',
        parent_list_parent_id: 'old-parent', children: [{ id: 'stale-descendant' }] };
    const state = { flatTasks: { child: { ...stale } }, pendingInsertedTasks: {}, pendingDeletedTasks: {},
        taskTree: [], filteredTasks: [], otherBlocks: [], doneOverrides: {} };
    const context = vm.createContext({ state, Map, Set, Date, Symbol, console, SettingsStore: { data: {} } });
    vm.runInContext(read('32-runtime-state-and-events.js'), context);
    const store = context.__tmTaskStore;
    store.acceptAuthoritative([stale], { docIds: ['doc'], replaceDocuments: true });
    store.applyMutation({ type: 'moveTask', phase: 'optimistic', opId: 'outdent', taskId: 'child' }, { applyLocal: false });
    state.flatTasks.child = { ...stale, parentTaskId: '', parent_task_id: '', parent_id: 'root-list',
        parentListParentId: '', parent_list_parent_id: '', children: [{ id: 'current-descendant' }] };
    store.applyMutation({ type: 'moveTask', phase: 'commit', opId: 'outdent', taskId: 'child',
        placement: { taskID: 'child', documentID: 'doc', parentListID: 'root-list', parentTaskID: '' },
        task: { id: 'child', root_id: 'doc', docId: 'doc', parentTaskId: '', parent_task_id: '', parent_id: 'root-list' },
    }, { applyLocal: false });
    const projected = store.getProjected('child');
    assert.equal(projected.parent_list_parent_id, '', 'sparse kernel receipt must not resurrect an old joined parent');
    assert.equal(projected.parentListParentId, '');
    assert.deepEqual(Array.from(projected.children, (task) => task.id), ['current-descendant']);
});
