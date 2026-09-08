'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = (file) => fs.readFileSync(path.join(__dirname, '../src/task-horizon/main', file), 'utf8');
const projection = read('task-runtime/51-whiteboard-and-link-runtime.js');
const services = read('20-api-and-runtime-services.js');
const windows = read('21-view-render-state.js');
const extract = (source, name) => {
    const start = source.indexOf(`    function ${name}(`);
    assert.ok(start >= 0, name);
    return source.slice(start, source.indexOf('\n    }', start) + 6);
};
class Element {
    constructor(id, owner, group = false) {
        this.id = id;
        this.owner = owner;
        this.group = group;
        this.hidden = false;
        this.badge = { textContent: '60' };
    }
    getAttribute(name) {
        if (name === 'data-id') return this.group ? null : this.id;
        if (name === 'data-group-key') return this.group ? this.id : null;
        if (name === 'data-depth') return '0';
        return null;
    }
    querySelector(selector) { return selector === '.tm-badge--count' && this.group ? this.badge : null; }
    getBoundingClientRect() {
        const top = this.owner.rows.indexOf(this) * 30 - this.owner.scrollTop;
        return { top, bottom: top + 30, height: 30 };
    }
    remove() { this.owner.rows.splice(this.owner.rows.indexOf(this), 1); }
    get parentElement() { return this.owner; }
    get nextElementSibling() { return this.owner?.rows[this.owner.rows.indexOf(this) + 1] || null; }
    cloneNode() { const node = new Element(this.id, null, this.group); node.version = this.version; return node; }
    isEqualNode(node) { return this.id === node.id && this.group === node.group && this.version === node.version; }
}
const host = new Element('host');
host.scrollTop = 1320;
host.clientHeight = 300;
host.rows = Array.from({ length: 60 }, (_, index) => new Element(`task-${index}`, host));
Object.defineProperty(host, 'children', { get: () => host.rows });
host.insertBefore = (node, anchor) => {
    host.moves = (host.moves || 0) + 1;
    const previous = host.rows.indexOf(node);
    if (previous >= 0) host.rows.splice(previous, 1);
    host.rows.splice(anchor ? host.rows.indexOf(anchor) : host.rows.length, 0, node);
    node.owner = host;
};
Object.defineProperty(host, 'scrollHeight', { get: () => host.rows.length * 30 });
Object.defineProperty(host, 'innerHTML', { set: () => assert.fail('must not rebuild the list') });
host.getBoundingClientRect = () => ({ top: 0, bottom: 300, height: 300 });
host.querySelectorAll = () => host.rows;
host.querySelector = (selector) => host.rows.find((node) => selector.endsWith(`=${node.id}]`)) || null;
const items = { querySelectorAll: () => [] };
Object.setPrototypeOf(items, Element.prototype);
items.querySelectorAll = (selector) => selector.startsWith('.tm-task-drop-gap') ? [] : host.rows;
const state = { viewMode: 'checklist', listRenderLimit: 60, listRenderStep: 20,
    filteredTasks: host.rows.map((node) => ({ id: node.id })), modal: { querySelector: () => items } };
let model = state.filteredTasks.map((task) => ({ type: 'task', id: task.id, depth: 0 }));
let task = { id: 'task-44', children: [] };
let signatures = 0;
const context = vm.createContext({ HTMLElement: Element, Element, Map, Set, state, CSS: { escape: (value) => value },
    __tmTaskStateKernel: { getTask: () => task }, __tmBuildTaskRowModel: () => model,
    __tmSyncCurrentViewDomRenderSignature: () => { signatures += 1; },
    __tmIsListLikeViewMode: () => true, __tmGetViewRenderWindowContextKey: () => 'checklist|all',
    __tmGetViewRenderWindowPolicy: () => ({ initial: 20 }) });
context.__tmIsChecklistGroupHeader = (node) => node.group;
context.__tmGetChecklistGroupKeyFromHeader = (node) => node.id;
vm.runInContext([
    extract(projection, '__tmTryPatchChecklistCompletionRow'),
    extract(windows, '__tmSliceTaskRowModelByTaskWindow'),
    extract(windows, '__tmRestoreViewRenderWindow'),
    extract(services, '__tmCaptureViewScrollAnchor'),
    extract(services, '__tmRestoreViewScrollAnchor'),
    extract(services, '__tmBuildChecklistSegmentMap'),
    extract(services, '__tmSelectChecklistProjectionNodes'),
    extract(services, '__tmReconcileChecklistProjectionNodeList'),
    extract(services, '__tmReconcileChecklistProjectionSegment'),
].join('\n'), context);
const change = [{ taskId: task.id, completionChanged: true, patch: { done: true } }];
const original = host.rows.slice();
assert.equal(context.__tmTryPatchChecklistCompletionRow({}, change), true);
assert.deepEqual(host.rows, original, 'visible completion preserves every node');
const anchor = context.__tmCaptureViewScrollAnchor(host, '.tm-checklist-item[data-id]');
assert.equal(anchor.id, task.id);
const nextOffset = original[45].getBoundingClientRect().top;
model = model.filter((row) => row.id !== task.id);
state.filteredTasks = state.filteredTasks.filter((row) => row.id !== task.id);
state.listRenderLimit = 20;
context.__tmRestoreViewRenderWindow({ mode: 'checklist', contextKey: 'checklist|all', limit: 60, step: 20 }, 59);
assert.equal(state.listRenderLimit, 59, 'completion must not reset the loaded render window');
assert.equal(context.__tmTryPatchChecklistCompletionRow({}, change), true);
context.__tmRestoreViewScrollAnchor(host, anchor);
assert.deepEqual(host.rows, original.filter((node) => node.id !== task.id));
assert.equal(original[45].getBoundingClientRect().top, nextOffset, 'use the next surviving visible anchor');
assert.ok(host.scrollTop > 1000, 'must not jump to the top');
assert.equal(signatures, 2);
const retained = host.rows.slice();
model = model.slice().reverse();
assert.equal(context.__tmTryPatchChecklistCompletionRow({}, change), false, 'sorting uses the existing reconciler');
assert.deepEqual(host.rows, retained, 'fallback must not partially mutate DOM');
task = { ...task, children: [{ id: 'child' }] };
assert.equal(context.__tmTryPatchChecklistCompletionRow({}, change), false, 'parent completion retains closure reconciliation');
assert.equal(context.__tmTryPatchChecklistCompletionRow({ structural: true }, change), false);
task = { id: 'task-45', children: [] };
change[0] = { taskId: task.id, completionChanged: true, patch: { done: true } };
model = host.rows.map((node) => ({ type: 'task', id: node.id, depth: 0 }));
const moving = model.find((row) => row.id === task.id);
model = [...model.filter((row) => row !== moving), moving];
const unaffected = host.rows.filter((node) => node.id !== task.id);
assert.equal(context.__tmTryPatchChecklistCompletionRow({}, change), true, 'completion sorting within the same group moves only the target row');
assert.equal(host.rows.at(-1).id, task.id);
assert.deepEqual(host.rows.slice(0, -1), unaffected, 'moving a row preserves every unaffected node');
const header = new Element('doc-group', host, true);
host.rows.unshift(header);
model.unshift({ type: 'group', key: header.id, count: 59 });
assert.equal(context.__tmTryPatchChecklistCompletionRow({}, change), true);
assert.equal(header.badge.textContent, '59');
const unchangedGroupRows = host.rows.slice();
model[0] = { ...model[0], key: 'new-group' };
assert.equal(context.__tmTryPatchChecklistCompletionRow({}, change), false, 'new groups use the existing structural reconciler');
assert.deepEqual(host.rows, unchangedGroupRows);
host.moves = 0;
const authoritativeRows = host.rows.map((node) => node.cloneNode(true));
authoritativeRows.at(-1).version = 2;
assert.equal(context.__tmReconcileChecklistProjectionSegment({ nodes: host.rows.slice() }, { nodes: authoritativeRows }, [task.id]), true);
assert.equal(host.rows.at(-1).version, 2);
assert.deepEqual(host.rows.slice(1, -1), unchangedGroupRows.slice(1, -1), 'authoritative follow-up refresh must retain unrelated rows too');
assert.ok(host.moves <= 2, 'a new group header must not cause every unchanged task to move');
host.rows.shift();
const ungrouped = context.__tmBuildChecklistSegmentMap(host);
assert.equal(ungrouped.map.get('__tm_ungrouped__').nodes.length, host.rows.length, 'ungrouped checklists must also use row reconciliation');
assert.match(projection, /__tmRestoreViewRenderWindow\(renderWindow, state\.filteredTasks\?\.length \|\| 0\)/);
assert.match(projection, /completionRowPatched[\s\S]*__tmTryPatchChecklistCompletionRow\(batch, changes\)/);
console.log('checklist completion row behavior tests passed');
