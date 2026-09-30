'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../src/task-horizon/main');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const segment = (source, start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, `missing source segment: ${start}`);
    return source.slice(from, to);
};

const lines = [];
const warnings = [];
let filterCalls = 0;
const context = vm.createContext({
    state: { viewMode: 'checklist', filteredTasks: [{ id: 'task' }] },
    console: { log: (...args) => lines.push(args), warn: (...args) => warnings.push(args) },
    applyFilters: () => { filterCalls += 1; },
});
vm.runInContext(read('35-task-projection-service.js'), context);
const result = context.__tmRecomputeTaskProjection({ reason: 'queue-createSubtask-optimistic' });
assert.equal(result.applied, true);
assert.equal(filterCalls, 1);
assert.equal(lines.length, 0, 'successful refreshes must stay quiet');
assert.equal(context.__tmLogTaskRefresh, undefined);
assert.equal(context.__tmCreateTaskRefreshTrace, undefined);
assert.equal(context.__tmTaskRefreshNow, undefined);
context.console.log = () => { throw new Error('unexpected debug output'); };
assert.equal(context.__tmRecomputeTaskProjection().applied, true);
context.applyFilters = () => { throw new Error('filter failure'); };
const failed = context.__tmRecomputeTaskProjection();
assert.equal(failed.applied, false);
assert.equal(failed.error.message, 'filter failure');
assert.equal(warnings.length, 1, 'real errors must still produce warnings');

const frames = [];
let projectionCalls = 0;
context.requestAnimationFrame = (callback) => { frames.push(callback); return frames.length; };
context.__tmTaskProjectionEngine = { mergeChangeSets: () => ({ structural: true }) };
context.__tmCanUseDetailSubtaskProjection = () => true;
context.__tmRunTaskProjectionBatch = () => { projectionCalls += 1; };
vm.runInContext(segment(read('task-runtime/51-whiteboard-and-link-runtime.js'),
    'const __tmPendingProjectionEntries = [];', 'function __tmApplyTaskProjectionChangeSets'), context);
for (const phase of ['optimistic', 'commit']) {
    context.__tmScheduleTaskProjectionBatch({ structural: true }, [{
        mutation: { opId: 'create-1', type: 'createSubtask', phase }, changeSet: { structural: true },
    }]);
}
assert.equal(frames.length, 1);
frames.shift()();
assert.equal(projectionCalls, 1, 'refresh must preserve frame coalescing');
class Element {
    constructor(id, version = 1) { this.id = id; this.version = version; this.children = []; this.parentElement = null; }
    getAttribute(name) { return name === 'data-id' ? this.id : ''; }
    matches() { return false; }
    isEqualNode(other) { return this.id === other.id && this.version === other.version; }
    get nextElementSibling() { return this.parentElement?.children[this.parentElement.children.indexOf(this) + 1] || null; }
    insertBefore(node, cursor) {
        node.remove();
        const index = cursor ? this.children.indexOf(cursor) : this.children.length;
        assert.ok(index >= 0);
        this.children.splice(index, 0, node);
        node.parentElement = this;
    }
    remove() {
        if (!this.parentElement) return;
        this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
        this.parentElement = null;
    }
}
context.Element = Element;
context.HTMLElement = Element;
vm.runInContext(segment(read('20-api-and-runtime-services.js'),
    'function __tmReconcileKeyedViewRows', '    try { globalThis.__tmReconcileKeyedViewRows'), context);
const parent = new Element('parent');
const originalA = new Element('a');
const originalB = new Element('b');
parent.insertBefore(originalA, null);
parent.insertBefore(originalB, null);
assert.equal(context.__tmReconcileKeyedViewRows(parent, [new Element('a'), new Element('b', 2), new Element('c')]), true);
assert.equal(parent.children[0], originalA);
assert.equal(originalB.parentElement, null);
assert.deepEqual(parent.children.map((row) => row.id), ['a', 'b', 'c']);
// A WS batch mixing a task and an unmatched structural block must still
// reject the partial patch, without mutating the board or logging diagnostics.
const modal = new Element('modal');
const body = new Element('body');
const board = new Element('board');
const column = new Element('column');
const nextColumn = new Element('column');
for (const node of [column, nextColumn]) {
    node.matches = (selector) => selector === '.tm-kanban-col';
    node.getAttribute = () => 'status:todo';
    node.querySelectorAll = () => [];
}
board.children = [column];
body.querySelector = () => board;
body.scrollLeft = 0;
modal.querySelector = () => body;
context.state.viewMode = 'kanban';
context.state.modal = modal;
context.__tmTaskBoundary = { getTask: (id) => id === 'known' ? { id } : null };
context.__tmStartProgressiveViewRender = () => null;
context.__tmScheduleProgressiveViewRender = () => {};
let renderCalls = 0;
let parseCalls = 0;
context.state.renderKanbanBodyHtml = ({ columnPatch }) => {
    renderCalls += 1;
    columnPatch.handled = true;
    columnPatch.resultColumnKeys = ['status:todo'];
    columnPatch.matchedTaskIds = new Set(['known']);
    return '<column></column>';
};
context.__tmBuildElementFromHtml = () => {
    parseCalls += 1;
    const staged = new Element('staged');
    staged.children = [nextColumn];
    staged.querySelectorAll = () => [];
    return staged;
};
vm.runInContext(segment(read('20-api-and-runtime-services.js'),
    'function __tmTryRefreshKanbanColumns(', '    try { globalThis.__tmTryRefreshKanbanColumns'), context);
assert.equal(context.__tmTryRefreshKanbanColumns(modal, ['known', 'block-parent'], { reason: 'ws-test' }), false);
assert.equal(renderCalls, 1, 'refresh must not invoke the renderer again');
assert.equal(parseCalls, 0, 'a rejected partial refresh must not proceed to DOM parsing');
assert.equal(board.children[0], column);
assert.equal(context.__tmTryRefreshKanbanColumns(modal, ['known']), true);
assert.equal(board.children[0], column, 'unchanged columns must retain their live nodes');
context.console.log = () => { throw new Error('console unavailable'); };
assert.equal(context.__tmTryRefreshKanbanColumns(modal, ['known']), true);


async function verifyDocumentReadGuard() {
    Object.assign(context, {
        document: { body: { contains: () => true } },
        __tmFlushSqlTransactionsSafe: async () => {},
        __tmResolveIncrementalRefreshDocIds: async () => ['doc'],
        __tmCaptureEditorDocumentTaskOrder: () => [],
        __tmTaskStore: { captureRead: () => ({}), isReadCurrent: () => false },
        __tmGetIncrementalTaskQueryLimit: () => 5000,
        __tmBuildLoadedDocumentTaskIdMap: () => new Map(),
        SettingsStore: { data: { columnOrder: [] } },
        __tmBuildTaskEnhanceLoadPlan: () => ({ customFieldLoadPlan: { bulkFieldIds: [] } }),
        __tmCaptureLocalTaskPatchWatermarkRevisions: () => ({}),
    });
    let queries = 0;
    context.API = { getTasksByDocuments: async () => { queries += 1; return { tasks: [{ id: 'known' }] }; } };
    vm.runInContext(segment(read('10-stores-rules-and-cache.js'),
        'async function __tmRefreshAffectedDocsIncrementally(', '    let __tmSqlTransactionFlushInFlight'), context);
    let deferredReason = '';
    const applied = await context.__tmRefreshAffectedDocsIncrementally({
        docIds: ['doc'], blockIds: ['known'], forceDocRefresh: true, committed: true,
        reason: 'ws-test', onDeferred: (reason) => { deferredReason = reason; },
    });
    assert.equal(applied, false, 'refresh must preserve rejection of a stale task-store read');
    assert.equal(deferredReason, 'task-store-changed');
    assert.equal(queries, 1, 'confirmation must not perform additional data queries');

}
verifyDocumentReadGuard().then(() => {
    assert.equal(lines.length, 0, 'refresh and confirmation paths must not print debug logs');
    const inspect = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const file = path.join(dir, entry.name);
            if (entry.isDirectory()) inspect(file);
            else if (entry.name.endsWith('.js')) {
                assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /__tm(?:LogTaskRefresh|CreateTaskRefreshTrace|TaskRefreshNow)|\[task-horizon:refresh\]/, file);
            }
        }
    };
    inspect(root);
    console.log('task refresh cleanup tests passed: silent success, retained error warnings, coalescing, node reuse, safe fallback and stale-read guards');
}).catch((error) => { console.error(error); process.exitCode = 1; });
