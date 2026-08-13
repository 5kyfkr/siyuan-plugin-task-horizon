'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'task-horizon.css'), 'utf8');
const start = source.indexOf('function __tmTryApplyKanbanOptimisticProjectionInPlace');
const end = source.indexOf('\n    function __tmRefreshKanbanProjectionPatchNow', start);
assert.ok(start >= 0 && end > start, 'kanban optimistic projection helper must exist');

class FakeElement {
    constructor(classes = []) {
        this.hidden = false;
        this.attrs = new Map();
        this.style = {};
        this.parentElement = null;
        this.column = null;
        this.children = [];
        const values = new Set(classes);
        this.classList = {
            contains: (name) => values.has(name),
            toggle: (name, enabled) => {
                if (enabled) values.add(name);
                else values.delete(name);
            },
        };
    }

    setAttribute(name, value) { this.attrs.set(name, String(value)); }
    getAttribute(name) { return this.attrs.get(name) || null; }
    removeAttribute(name) { this.attrs.delete(name); }
    closest(selector) {
        if (selector === '.tm-kanban-col') return this.column;
        if (selector === '.tm-kanban-group') return null;
        return null;
    }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    insertBefore(node, next) {
        this.children = this.children.filter((item) => item !== node);
        const index = next ? this.children.indexOf(next) : -1;
        if (index >= 0) this.children.splice(index, 0, node);
        else this.children.push(node);
        node.parentElement = this;
    }
}

const column = new FakeElement(['tm-kanban-col']);
const container = new FakeElement(['tm-kanban-col-body']);
const cards = [
    new FakeElement(['tm-kanban-card', 'tm-kanban-card--sub']),
    new FakeElement(['tm-kanban-card', 'tm-kanban-card--sub']),
];
cards.forEach((card) => {
    card.setAttribute('data-id', 'task-a');
    card.checkboxChecked = true;
    card.column = column;
    card.parentElement = container;
    container.children.push(card);
});
const modal = new FakeElement();
modal.querySelectorAll = () => cards;
let task = { id: 'task-a', done: false };
let countSyncs = 0;
let completedBadgeSyncs = 0;
const context = vm.createContext({
    Map,
    Set,
    Array,
    String,
    Number,
    CSS: { escape: (value) => String(value) },
    Element: FakeElement,
    HTMLElement: FakeElement,
    Node: FakeElement,
    SettingsStore: { data: {} },
    state: {
        modal,
        viewMode: 'kanban',
        showCompletedTasks: false,
        filteredTasks: [task],
        groupByDocName: false,
        groupByTaskName: false,
        groupByTime: false,
        quadrantEnabled: false,
    },
    __tmTaskStateKernel: { getTask: () => task },
    __tmTaskProjectionEngine: {
        isKanbanTaskVisibleByCompletion: (item, showCompleted) => showCompleted === true || !item?.done,
    },
    __tmSyncKanbanProjectionCounts: () => { countSyncs += 1; },
    __tmUpdateTaskDoneInDOM: (card, item) => {
        card.checkboxChecked = item?.done === true;
        return true;
    },
    __tmSyncTaskCardMetaChipsInDOM: () => true,
    __tmSyncKanbanCompletedTodayBadgeInDOM: () => { completedBadgeSyncs += 1; },
    __tmGetKanbanExpectedProjectionGroupKeys: () => [],
    __tmIsTaskPinned: () => false,
    __tmScheduleOptimisticProjectionFrame: () => true,
    __tmKanbanColsHtmlCache: null,
});
context.globalThis = context;
vm.runInContext(source.slice(start, end), context, { filename: 'kanban-optimistic-projection.js' });

assert.equal(context.__tmTryApplyKanbanOptimisticProjectionInPlace('task-a', { done: true }, { filtersApplied: true }), true);
assert.ok(cards.every((card) => card.hidden && card.attrs.get('aria-hidden') === 'true'),
    'the operation after-state must hide every mounted completed subtask immediately');
assert.ok(cards.every((card) => card.attrs.get('data-tm-hidden-by-completion') === 'true'),
    'cards hidden by the completed-task filter must retain their visibility reason');
assert.equal(countSyncs, 1, 'completion visibility must update the affected kanban counts once');

context.state.filteredTasks = [{ id: 'task-a', done: false }];
assert.equal(context.__tmTryApplyKanbanOptimisticProjectionInPlace('task-a', { __tmPlacement: true }, { filtersApplied: true }), true);
assert.ok(cards.every((card) => card.hidden && card.attrs.get('data-tm-hidden-by-completion') === 'true'),
    'a stale closure-only placement projection must not reveal a task hidden by completion');

task = { id: 'task-a', done: true };
context.state.filteredTasks = [{ id: 'task-a', done: false }];
const badgeSyncsBeforeRestore = completedBadgeSyncs;
assert.equal(context.__tmTryApplyKanbanOptimisticProjectionInPlace('task-a', { done: false }, { filtersApplied: true }), true);
assert.ok(cards.every((card) => !card.hidden && !card.attrs.has('aria-hidden')),
    'restoring the task must reveal every mounted subtask from the same after-state path');
assert.ok(cards.every((card) => !card.attrs.has('data-tm-hidden-by-completion')),
    'an explicit restore must clear the completed-task visibility reason');
assert.ok(cards.every((card) => card.checkboxChecked === false),
    'restoring a hidden task must also reset every mounted checkbox from the projected after-state');
assert.equal(completedBadgeSyncs - badgeSyncsBeforeRestore, cards.length,
    'an in-place kanban projection must synchronize the completed-today badge on every mounted card');
assert.match(css, /\.tm-body--kanban \.tm-kanban-card\[hidden\]\s*\{\s*display: none !important;/,
    'kanban card hiding must not depend on the host theme user-agent hidden rule');

console.log('kanban completed visibility projection tests passed');
