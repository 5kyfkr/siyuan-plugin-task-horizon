'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const runtimeSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js'),
    'utf8',
);
const stateSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/32-runtime-state-and-events.js'),
    'utf8',
);
const checklistSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/render/42-render-list-and-checklist-body.js'),
    'utf8',
);
const listSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js'),
    'utf8',
);
const kanbanSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/render/43-render-timeline-kanban-calendar-body.js'),
    'utf8',
);
const whiteboardSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/render/44-render-whiteboard-body.js'),
    'utf8',
);
const detailSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/task-runtime/52-task-detail-runtime.js'),
    'utf8',
);
const storesSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'),
    'utf8',
);
const createRuntimeSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/task-runtime/53b-task-create-and-quick-add-runtime.js'),
    'utf8',
);
const cssSource = fs.readFileSync(path.join(root, 'task-horizon.css'), 'utf8');

function extractFunction(source, name) {
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `${name} must exist`);
    const bodyStart = source.indexOf('{', source.indexOf(')', start));
    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        if (source[index] !== '}') continue;
        depth -= 1;
        if (depth === 0) return source.slice(start, index + 1);
    }
    throw new Error(`unable to extract ${name}`);
}

class FakeElement {
    constructor(classes = []) {
        this.textContent = '';
        this.style = { width: '' };
        const values = new Set(classes);
        this.classList = { contains: (name) => values.has(name) };
    }

    closest() { return null; }
}

const count = new FakeElement(['tm-badge--count']);
const progress = new FakeElement();
const modal = new FakeElement();
modal.querySelectorAll = (selector) => {
    if (selector.includes('data-tm-subtask-count-owner')) return [count];
    if (selector.includes('data-tm-subtask-progress-owner')) return [progress];
    return [];
};

const children = [
    { id: 'child-a', parentTaskId: 'parent', done: true },
    { id: 'child-b', parentTaskId: 'parent', done: false },
];
const context = vm.createContext({
    Element: FakeElement,
    HTMLElement: FakeElement,
    CSS: { escape: (value) => String(value) },
    state: { modal },
    globalThis: null,
    __tmTaskStateKernel: { getTask: () => null },
    __tmGetEffectiveProgressBarColor: () => '#16a34a',
    __tmIsDarkMode: () => false,
});
context.globalThis = context;
context.__tmTaskStore = {
    listProjectedDirectChildren: () => children,
    getProjected: () => null,
};
vm.runInContext(extractFunction(runtimeSource, '__tmIsTaskCompletedForProjection'), context);
vm.runInContext(extractFunction(runtimeSource, '__tmGetProjectedOrderedTaskChildren'), context);
vm.runInContext(extractFunction(runtimeSource, '__tmGetProjectedDirectChildStats'), context);
vm.runInContext(extractFunction(runtimeSource, '__tmSyncTaskSubtaskSummaryInPlace'), context);
vm.runInContext(extractFunction(detailSource, '__tmGetTaskDetailProjectedDirectChildren'), context);

const projectedOrder = Array.from({ length: 10 }, (_, index) => ({
    id: `ordered-child-${index + 1}`,
    content: String(index + 1),
}));
const structurallyReordered = [
    ...projectedOrder.slice(0, 5),
    projectedOrder[9],
    ...projectedOrder.slice(5, 9),
];
context.__tmTaskStore.listProjectedDirectChildren = () => projectedOrder;
assert.deepEqual(
    Array.from(context.__tmGetProjectedOrderedTaskChildren({ id: 'ordered-parent', children: structurallyReordered }), (task) => task.content),
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    'main-view child projection must remain independent from the parent structural array',
);
const documentOrderedChildren = projectedOrder.slice(0, 5).map((task) => ({ ...task, parentTaskId: 'detail-parent', children: [] }));
const ruleOrderedChildren = documentOrderedChildren.slice().reverse().map((task, index) => ({ ...task, done: index === 0 }));
context.state.taskTree = [{ id: 'detail-doc', tasks: [{ id: 'detail-parent', children: documentOrderedChildren }] }];
const detailProjectedById = new Map(ruleOrderedChildren.map((task) => [task.id, task]));
context.__tmTaskStore.resolveId = (id) => String(id || '');
context.__tmTaskStore.listFlat = () => [{ id: 'detail-parent', children: documentOrderedChildren }, ...ruleOrderedChildren];
context.__tmTaskStore.listPending = () => [];
context.__tmTaskStore.getProjected = (id) => detailProjectedById.get(String(id || '')) || null;
context.__tmTaskStore.listProjectedDirectChildren = (parentId) => (
    parentId === 'detail-parent' ? ruleOrderedChildren : []
);
assert.deepEqual(
    Array.from(context.__tmGetTaskDetailProjectedDirectChildren({ id: 'detail-parent', children: ruleOrderedChildren }), (task) => task.content),
    ['1', '2', '3', '4', '5'],
    'task detail must overlay live child fields without adopting the main-view sort order',
);
assert.equal(context.__tmGetTaskDetailProjectedDirectChildren({ id: 'detail-parent' })[4].done, true,
    'task detail must keep the latest projected child fields');
context.__tmTaskStore.listProjectedDirectChildren = () => children;
context.__tmTaskStore.listProjectedDirectChildren = () => [];
assert.deepEqual(
    Array.from(context.__tmGetProjectedOrderedTaskChildren({ id: 'empty-parent', children }), (task) => task.id),
    [],
    'an empty projected child set must not fall back to stale structural children after deletion'
);
context.__tmTaskStore.listProjectedDirectChildren = () => children;

assert.equal(context.__tmSyncTaskSubtaskSummaryInPlace('parent', modal), true);
assert.equal(count.textContent, '1/2');
assert.equal(progress.style.width, '50%');

children[0].done = false;
assert.equal(context.__tmSyncTaskSubtaskSummaryInPlace('parent', modal), true);
assert.equal(count.textContent, '0/2');
assert.equal(progress.style.width, '0%');

const summarySource = extractFunction(runtimeSource, '__tmSyncTaskSubtaskSummaryInPlace');
assert.doesNotMatch(summarySource, /render\(|__tmScheduleViewRefresh|replaceWith|innerHTML/,
    'parent progress projection must remain a small DOM patch');
assert.match(stateSource, /listProjectedDirectChildren,/,
    'TaskStore must expose one projected direct-child resolver');
assert.match(runtimeSource, /if \(Array\.isArray\(projectedChildren\)\) \{[\s\S]*return projectedChildren;/,
    'the projected child resolver must treat an empty result as authoritative');
assert.match(checklistSource, /data-tm-subtask-count-owner=/);
assert.match(checklistSource, /data-tm-subtask-progress-owner=/);
assert.match(kanbanSource, /data-tm-subtask-count-owner=/);
assert.match(kanbanSource, /data-tm-subtask-progress-owner=/);
assert.match(listSource, /const progressBgStyle = progressPercent > 0/,
    'list progress must depend on the complete child set, not the filtered visible-child set');
assert.match(kanbanSource, /const nestedSubtasksHtml = \(isSub && totalChildren > 0\)/,
    'nested kanban progress must remain mounted when every completed grandchild is filtered out');
assert.match(kanbanSource, /const hasDirectChildren = getDirectChildStats\(task\)\.total > 0;[\s\S]*depthInCol === 0 && hasDirectChildren/,
    'root kanban progress must use the complete child set even when no child card remains visible');
assert.match(whiteboardSource, /data-tm-subtask-count-owner=/);
assert.match(whiteboardSource, /data-tm-subtask-progress-owner=/);
assert.match(detailSource, /tm-task-detail-section-count" data-tm-subtask-count-owner=/);
assert.match(runtimeSource, /completionClosureRequired[\s\S]*const parentSummaryIds = new Set\(\)[\s\S]*parentSummaryIds\.forEach[\s\S]*__tmSyncTaskSubtaskSummaryInPlace/,
    'completion closure must update main-view and open-detail parent summaries from the same lightweight projection');
assert.doesNotMatch(runtimeSource, /completionClosureRequired[\s\S]{0,1200}__tmProjectVisibleTaskDetailSubtasks/,
    'field completion must not invoke the structural detail-subtask projector');
assert.match(runtimeSource, /const filteredProjectionTaskIds = new Set\(\)[\s\S]*completionPatch[\s\S]*!filteredProjectionTaskIds\.has\(taskId\)\) return/,
    'a completed task already absent from the authoritative filtered projection must not trigger a whole-view fallback');
const rowModelSource = extractFunction(runtimeSource, '__tmBuildTaskRowModel');
assert.match(rowModelSource, /const childTasks = __tmGetProjectedOrderedTaskChildren\(task\)[\s\S]*childTasks\.sort\(\(a, b\) => getTaskOrder\(a\.id\) - getTaskOrder\(b\.id\)\)/,
    'all main-view child rows, including checklist rows, must follow the active filtered-task order');
assert.doesNotMatch(rowModelSource, /viewMode[\s\S]{0,120}!== 'checklist'[\s\S]{0,120}childTasks\.sort/,
    'checklist child rows must not bypass the active sorting rule');

class FakeChecklistNode {
    constructor(classes = [], attrs = {}) {
        this.hidden = false;
        this.nextElementSibling = null;
        this.attributes = new Map(Object.entries(attrs));
        const values = new Set(classes);
        this.classList = { contains: (name) => values.has(name) };
    }

    getAttribute(name) { return this.attributes.get(name) || null; }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    removeAttribute(name) { this.attributes.delete(name); }
}

const checklistDomContext = vm.createContext({
    Array,
    Map,
    Set,
    Math,
    Number,
    String,
    HTMLElement: FakeChecklistNode,
});
vm.runInContext(extractFunction(runtimeSource, '__tmCollectChecklistProjectionDomBlock'), checklistDomContext);
vm.runInContext(extractFunction(runtimeSource, '__tmSetChecklistProjectionDomBlockVisibility'), checklistDomContext);
vm.runInContext(extractFunction(runtimeSource, '__tmGetTaskProjectionPlacementIds'), checklistDomContext);

const parentRow = new FakeChecklistNode(['tm-checklist-item'], { 'data-id': 'child-1', 'data-depth': '0' });
const childGap = new FakeChecklistNode(['tm-task-drop-gap'], { 'data-target-task-id': 'grandchild-1', 'data-depth': '1' });
const childRow = new FakeChecklistNode(['tm-checklist-item'], { 'data-id': 'grandchild-1', 'data-depth': '1' });
const nextSibling = new FakeChecklistNode(['tm-checklist-item'], { 'data-id': 'child-2', 'data-depth': '0' });
parentRow.nextElementSibling = childGap;
childGap.nextElementSibling = childRow;
childRow.nextElementSibling = nextSibling;
const checklistBlock = checklistDomContext.__tmCollectChecklistProjectionDomBlock(parentRow);
assert.deepEqual(Array.from(checklistBlock), [parentRow, childGap, childRow],
    'checklist completion visibility must operate on the target subtree without consuming its next sibling');
checklistDomContext.__tmSetChecklistProjectionDomBlockVisibility(checklistBlock, new Set(), true);
assert.equal(parentRow.hidden, true);
assert.equal(childGap.hidden, true);
assert.equal(childRow.hidden, true);
assert.equal(nextSibling.hidden, false, 'hiding a completed subtree must not hide the next sibling');
checklistDomContext.__tmSetChecklistProjectionDomBlockVisibility(checklistBlock, new Set(['child-1']), false);
assert.equal(parentRow.hidden, false, 'undoing completion must reveal the target at its existing document position');
assert.equal(childRow.hidden, true, 'a descendant excluded by the current completed-task filter must remain hidden');
checklistDomContext.__tmSetChecklistProjectionDomBlockVisibility(checklistBlock, new Set(['child-1', 'grandchild-1']), false);
assert.equal(childGap.hidden, false);
assert.equal(childRow.hidden, false);

checklistDomContext.__closureIds = ['child-1', 'parent', 'child-2', 'child-3'];
checklistDomContext.__fieldPatches = new Map([['child-1', { done: true }]]);
assert.deepEqual(
    Array.from(vm.runInContext('__tmGetTaskProjectionPlacementIds({}, __closureIds, __fieldPatches)', checklistDomContext)),
    ['child-1'],
    'a completion closure may update parent progress but must only place the task whose field changed',
);
assert.deepEqual(
    Array.from(vm.runInContext('__tmGetTaskProjectionPlacementIds({ structural: true }, __closureIds, __fieldPatches)', checklistDomContext)),
    ['child-1', 'parent', 'child-2', 'child-3'],
    'structural mutations must retain full closure placement',
);
assert.match(runtimeSource, /mode === 'checklist'[\s\S]*placementTaskIds\.forEach/,
    'checklist placement must not iterate the completion closure');
assert.match(runtimeSource, /mode === 'kanban'[\s\S]*placementTaskIds\.forEach/,
    'kanban placement must not iterate the completion closure');
assert.match(cssSource, /\.tm-checklist-item\[hidden\],[\s\S]*\.tm-task-drop-gap\[hidden\][\s\S]*display:\s*none\s*!important/,
    'author styles must not override completed-task visibility');

vm.runInContext(extractFunction(storesSource, '__tmBuildStructuredAuthoritativeTaskList'), context);
const authoritativeParent = { id: 'parent', content: 'Parent' };
const authoritativeChildren = ['child-a', 'child-b', 'child-c'].map((id) => ({ id, parentTaskId: 'parent' }));
const authoritativeMap = new Map([
    ['parent', authoritativeParent],
    ...authoritativeChildren.map((task) => [task.id, task]),
]);
context.__testAuthoritativeEntries = Array.from(authoritativeMap.entries());
const authoritativeMapInContext = vm.runInContext('new Map(__testAuthoritativeEntries)', context);
const structured = context.__tmBuildStructuredAuthoritativeTaskList(authoritativeMapInContext, [{
    nextDoc: {
        tasks: [{
            id: 'parent',
            children: [
                { id: 'child-a', children: [] },
                { id: 'child-b', children: [] },
                { id: 'child-c', children: [] },
            ],
        }],
    },
}]);
assert.deepEqual(
    Array.from(structured.find((task) => task.id === 'parent').children, (task) => task.id),
    ['child-a', 'child-b', 'child-c'],
    'an incremental authoritative refresh must retain the resolved direct-child order',
);
assert.match(storesSource, /acceptAuthoritative\?\.\(structuredAuthoritativeTasks,[\s\S]*replaceDocuments: true,[\s\S]*replaceStructure: true/,
    'incremental document replacement must commit the resolved authoritative tree');

context.__tmGetTaskParentScopedRank = () => Number.NaN;
context.__tmGetTaskLocalSiblingRank = () => Number.NaN;
context.__tmCompareSiblingTasksByBlockOrder = (a, b) => Number(a?.blockSort) - Number(b?.blockSort);
vm.runInContext(extractFunction(createRuntimeSource, '__tmCompareTasksBySiblingRankMap'), context);
vm.runInContext(extractFunction(createRuntimeSource, '__tmSortTaskTreeByExistingOrder'), context);
const previousChildren = Array.from({ length: 10 }, (_, index) => ({
    id: `stable-child-${index + 1}`,
    content: String(index + 1),
    children: [],
}));
const refreshedChildren = [
    ...previousChildren.slice(2),
    ...previousChildren.slice(0, 2),
].map((task) => ({ ...task }));
context.__testPreviousChildren = previousChildren;
context.__testRefreshedChildren = refreshedChildren;
const preservedChildren = vm.runInContext(
    '__tmSortTaskTreeByExistingOrder(__testRefreshedChildren, __testPreviousChildren)',
    context,
);
assert.deepEqual(
    Array.from(preservedChildren, (task) => task.content),
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    'a large non-structural refresh must retain the pre-refresh sibling order',
);

const previousAfterDelete = [
    { id: 'original-child-1', content: '1', children: [] },
    { id: 'original-child-5', content: '5', children: [] },
];
const refreshedAfterRecreate = [
    { id: 'original-child-1', content: '1', blockSort: 1, children: [] },
    { id: 'original-child-5', content: '5', blockSort: 5, children: [] },
    { id: 'recreated-child-2', content: '2', blockSort: 2, children: [] },
    { id: 'recreated-child-3', content: '3', blockSort: 3, children: [] },
    { id: 'recreated-child-4', content: '4', blockSort: 4, children: [] },
];
context.__testPreviousAfterDelete = previousAfterDelete;
context.__testRefreshedAfterRecreate = refreshedAfterRecreate;
const reconciledAfterRecreate = vm.runInContext(
    '__tmSortTaskTreeByExistingOrder(__testRefreshedAfterRecreate, __testPreviousAfterDelete)',
    context,
);
assert.deepEqual(
    Array.from(reconciledAfterRecreate, (task) => task.content),
    ['1', '2', '3', '4', '5'],
    'recreated siblings must keep the fresh document order instead of moving behind surviving old siblings',
);

console.log('parent subtask progress projection tests passed');
