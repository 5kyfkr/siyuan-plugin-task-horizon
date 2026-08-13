'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const projectionRuntime = read('src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js');
const runtimeServices = read('src/task-horizon/main/20-api-and-runtime-services.js');

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
    throw new Error(`Unable to extract ${name}`);
}

const projectionBatch = extractFunction(projectionRuntime, '__tmRunTaskProjectionBatch');
assert.match(
    projectionBatch,
    /mode === 'checklist'[\s\S]*checklistCompletionReconcileRequired[\s\S]*projected = false;[\s\S]*else[\s\S]*__tmTryApplyChecklistOptimisticProjectionInPlace/,
    'completion changes must skip the single-task checklist mover and request grouped reconciliation',
);
assert.match(
    projectionBatch,
    /batch\.structural === true \|\| checklistCompletionReconcileRequired[\s\S]*__tmMarkChecklistProjectionGroupRefresh\(taskIds\)[\s\S]*__tmScheduleViewRefresh/,
    'completion closure must mark every affected checklist group before the current view refresh',
);
assert.match(
    projectionBatch,
    /bypassInteractionDefer:\s*batch\.structural === true\s*\|\| checklistCompletionReconcileRequired/,
    'completion reconciliation must not be starved by the checkbox interaction that requested it',
);
assert.match(
    projectionBatch,
    /mode === 'kanban'[\s\S]*kanbanCompletionReconcileRequired[\s\S]*projected = false;[\s\S]*else[\s\S]*__tmTryApplyKanbanOptimisticProjectionInPlace/,
    'kanban completion changes must rebuild from the authoritative board projection instead of moving one card',
);
assert.match(
    projectionBatch,
    /kanbanCompletionReconcileRequired[\s\S]*__tmKanbanColsHtmlCache = null[\s\S]*__tmScheduleViewRefresh/,
    'the authoritative kanban completion refresh must not reuse a stale rendered-column cache',
);
assert.match(
    projectionBatch,
    /bypassInteractionDefer:\s*batch\.structural === true[\s\S]*checklistCompletionReconcileRequired[\s\S]*kanbanCompletionReconcileRequired/,
    'completion reconciliation in checklist and kanban must not be starved by the requesting checkbox interaction',
);

const checklistPlacement = extractFunction(projectionRuntime, '__tmTryApplyChecklistOptimisticProjectionInPlace');
assert.match(
    checklistPlacement,
    /let nextTaskRow = null;[\s\S]*nextTaskRow = taskRows\[index\];[\s\S]*if \(nextTaskRow && !\(nextNode instanceof HTMLElement\)\)[\s\S]*return false;/,
    'a missing desired next peer must fall back to grouped rendering instead of appending the task to the end',
);
assert.match(
    checklistPlacement,
    /__tmPushDetailDebug\('detail-checklist-placement',[\s\S]*nextTaskId:[\s\S]*result:/,
    'detail-driven checklist placement must print its intended neighbor and result',
);

const checklistRerender = extractFunction(runtimeServices, '__tmRerenderChecklistInPlace');
assert.match(
    checklistRerender,
    /const checklistProjectionTaskIds = __tmGetChecklistProjectionGroupRefreshTaskIds\(\);[\s\S]*checklistProjectionTaskIds\.length === 0[\s\S]*state\.listDomRenderSignature/,
    'pending checklist completion reconciliation must take precedence over the sampled render-signature fast path',
);

const tasks = {};
const makeTask = (id, parentTaskId = '', children = []) => {
    const task = { id, parentTaskId, children };
    tasks[id] = task;
    return task;
};
const task51 = makeTask('51', '5');
const task52 = makeTask('52', '5');
const task53 = makeTask('53', '5');
const task1 = makeTask('1', 'parent');
const task2 = makeTask('2', 'parent');
const task3 = makeTask('3', 'parent');
const task4 = makeTask('4', 'parent');
const task5 = makeTask('5', 'parent', [task51, task52, task53]);
makeTask('parent', '', [task1, task2, task3, task4, task5]);

const closureContext = vm.createContext({
    Set,
    Array,
    String,
    globalThis: null,
    __tmTaskStateKernel: { getTask: (taskId) => tasks[taskId] || null },
});
closureContext.globalThis = closureContext;
closureContext.__tmTaskStore = { getProjected: (taskId) => tasks[taskId] || null };
vm.runInContext(extractFunction(projectionRuntime, '__tmCollectTaskProjectionClosure'), closureContext);
const closureIds = closureContext.__tmCollectTaskProjectionClosure(['51'], [{ requiresClosure: true }]);
assert.deepEqual(
    Array.from(closureIds).sort(),
    ['1', '2', '3', '4', '5', '51', '52', '53', 'parent'].sort(),
    'a subtask completion must reconcile its whole parent tree, including document-order siblings',
);

class FakeElement {
    constructor(className = '', attrs = {}, children = []) {
        this.className = className;
        this.attributes = new Map(Object.entries(attrs));
        this.children = [];
        this.parentNode = null;
        children.forEach((child) => this.appendChild(child));
    }

    get classList() {
        return { contains: (name) => this.className.split(/\s+/).includes(name) };
    }

    get firstElementChild() {
        return this.children[0] || null;
    }

    getAttribute(name) {
        return this.attributes.has(name) ? this.attributes.get(name) : null;
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    }

    removeAttribute(name) {
        this.attributes.delete(name);
    }

    querySelector(selector) {
        if (selector === ':scope > .tm-checklist-group') {
            return this.children.find((child) => child.classList.contains('tm-checklist-group')) || null;
        }
        if (selector === ':scope > .tm-checklist-group-card-items') {
            return this.children.find((child) => child.classList.contains('tm-checklist-group-card-items')) || null;
        }
        return null;
    }

    appendChild(node) {
        node.parentNode?.removeChild(node);
        this.children.push(node);
        node.parentNode = this;
        return node;
    }

    removeChild(node) {
        const index = this.children.indexOf(node);
        if (index >= 0) this.children.splice(index, 1);
        node.parentNode = null;
        return node;
    }

    insertBefore(node, reference) {
        node.parentNode?.removeChild(node);
        const index = reference ? this.children.indexOf(reference) : -1;
        if (index < 0) this.children.push(node);
        else this.children.splice(index, 0, node);
        node.parentNode = this;
        return node;
    }

    replaceWith(node) {
        if (!this.parentNode) return;
        const parent = this.parentNode;
        const index = parent.children.indexOf(this);
        if (index < 0) return;
        node.parentNode?.removeChild(node);
        parent.children[index] = node;
        node.parentNode = parent;
        this.parentNode = null;
    }

    remove() {
        this.parentNode?.removeChild(this);
    }

    cloneNode(deep = false) {
        return new FakeElement(
            this.className,
            Object.fromEntries(this.attributes),
            deep ? this.children.map((child) => child.cloneNode(true)) : [],
        );
    }
}

const row = (id, depth) => new FakeElement('tm-checklist-item', { 'data-id': id, 'data-depth': depth });
const card = (ids) => new FakeElement('tm-checklist-group-card', {}, [
    new FakeElement('tm-checklist-group'),
    new FakeElement('tm-checklist-group-card-items', {}, ids.map(([id, depth]) => row(id, depth))),
]);
const wrongOrder = [
    ['parent', 0], ['1', 1], ['5', 1], ['52', 2], ['53', 2],
    ['2', 1], ['3', 1], ['4', 1], ['51', 2],
];
const documentOrder = [
    ['parent', 0], ['1', 1], ['2', 1], ['3', 1], ['4', 1],
    ['5', 1], ['51', 2], ['52', 2], ['53', 2],
];
const currentCard = card(wrongOrder);
const nextCard = card(documentOrder);
const currentBody = currentCard.querySelector(':scope > .tm-checklist-group-card-items');
const currentTaskNodes = new Map(currentBody.children.map((item) => [item.getAttribute('data-id'), item]));
const reconcileContext = vm.createContext({ FakeElement, HTMLElement: FakeElement, Set, Array, String });
vm.runInContext(extractFunction(runtimeServices, '__tmReconcileChecklistProjectionCard'), reconcileContext);
assert.equal(
    reconcileContext.__tmReconcileChecklistProjectionCard(
        currentCard,
        nextCard,
        currentTaskNodes,
        new Set(closureIds),
    ),
    true,
);
assert.deepEqual(
    currentCard.querySelector(':scope > .tm-checklist-group-card-items').children
        .map((item) => item.getAttribute('data-id')),
    documentOrder.map(([id]) => id),
    'group reconciliation must replace 1,5,2,3,4-style drift with the staged authoritative order',
);

const taskDetailTree = extractFunction(projectionRuntime, '__tmBuildTaskDetailSubtaskTree');
assert.doesNotMatch(taskDetailTree, /\.sort\s*\(/,
    'task detail must keep its strict document sibling order instead of adopting checklist sorting');

console.log('checklist completion order consistency contract tests passed');
