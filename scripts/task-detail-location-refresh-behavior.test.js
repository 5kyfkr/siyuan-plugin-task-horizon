'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('./i18n-vm-fixture');
const { test } = require('node:test');

const read = (file) => fs.readFileSync(path.join(__dirname, '../src/task-horizon/main', file), 'utf8');
const detail = read('task-runtime/52-task-detail-runtime.js');
const moves = read('task-runtime/53b-task-create-and-quick-add-runtime.js');
const interactions = read('task-runtime/51-whiteboard-and-link-runtime.js');
function extract(source, name) {
    const start = source.indexOf(`    function ${name}(`);
    const end = source.indexOf('\n    }', start);
    assert.ok(start >= 0 && end > start, name);
    return source.slice(start, end + 6);
}

function setup() {
    // Only the location chip needs a DOM fixture; task reads, move overlays,
    // acknowledgements, signatures and deferred refreshes use production code.
    class Element {
        constructor() { this.dataset = {}; this.nodes = new Map(); this.isConnected = true; }
        querySelector(selector) { return this.nodes.get(selector) || null; }
        remove() { this.removed = true; }
    }
    const task = { id: 'task', root_id: 'a', docId: 'a', docName: 'A', doc_name: 'A',
        content: 'Current title', customFieldValues: { note: 'Current text' }, children: [],
        h2: 'Old heading', h2Id: 'heading-a', parentTaskId: 'parent-a' };
    const panel = new Element();
    const location = new Element();
    const chip = new Element();
    chip.innerHTML = 'A';
    panel.nodes.set('.tm-task-detail-location', location);
    location.nodes.set('[data-tm-detail="location-doc"]', chip);
    panel.dataset.tmDetailTaskId = task.id;
    panel.__tmTaskDetailTask = task;
    const timers = [];
    const context = vm.createContext({
        Element, HTMLElement: Element, HTMLTextAreaElement: Element,
        state: { flatTasks: { task }, pendingInsertedTasks: {}, taskTree: [], filteredTasks: [],
            otherBlocks: [], allDocuments: ['a', 'b', 'c'].map((id) => ({ id, name: id.toUpperCase() })) },
        SettingsStore: { data: {} }, MetaStore: { get() {}, set() {} },
        document: { activeElement: null },
        setTimeout(callback) { timers.push(callback); },
        __tmResolveTaskDetailEffectiveId: (id) => id,
        __tmPreferWhiteboardSnapshotForPlaceholderTask: (value) => value,
        __tmGetTaskDetailProjectedDirectChildren: (value) => value.children,
        __tmGetTaskDetailParentInfo: () => null,
        __tmResolveTaskDetailParentTaskId: (value) => value.parentTaskId || '',
        __tmNormalizeHeadingText: (value) => String(value || '').trim(),
        __tmGetDocDisplayName: (doc) => typeof doc === 'object' ? doc.name : String(doc).toUpperCase(),
        __tmIsCollectedOtherBlockTask: () => false,
        __tmDocHasAnyHeading: () => false,
        __tmRenderLucideIcon: () => '', esc: (value) => value,
        __tmAreTaskDetailIdsEquivalent: (a, b) => a === b,
        __tmIsTaskDetailRootUsable: () => true,
        __tmCollectTaskDetailFallbackDeferReasons: () => ['pending-save'],
        __tmShouldDeferTaskDetailFallback: () => false,
    });
    vm.runInContext(read('32-runtime-state-and-events.js'), context);
    const boundary = read('33-task-boundary-facades.js');
    vm.runInContext(boundary.slice(0, boundary.indexOf('// Public plugin contract.')), context);
    for (const name of ['__tmResetMovedTaskAttrHostProjection', '__tmApplyQueuedTaskMovePatchToTask']) {
        vm.runInContext(extract(moves, name), context);
    }
    for (const name of ['__tmGetTaskDetailTaskById', '__tmGetChecklistDetailTaskById',
        '__tmGetTaskDetailLocationDocName', '__tmSyncTaskDetailLocationInPlace',
        '__tmBuildTaskDetailLocationSignature', '__tmRememberTaskDetailLocationSignature',
        '__tmPatchTaskDetailPanelInPlace', '__tmScheduleTaskDetailForceRebuildRetry']) {
        vm.runInContext(extract(detail, name), context);
    }
    const store = context.__tmTaskStore;
    store.applyMutation({ type: 'createTaskInDoc', phase: 'commit', opId: 'initial', taskId: 'task', task }, { applyLocal: false });
    context.__tmRememberTaskDetailLocationSignature(panel, task);
    const move = (docId, phase = 'optimistic') => store.applyMutation({
        type: 'moveTask', phase, opId: `move-${docId}`, taskId: 'task',
        data: { taskId: 'task', targetDocId: docId, mode: 'docTop' },
        ...(phase === 'commit' ? { task: { id: 'task', root_id: docId, docId, docName: docId.toUpperCase() } } : {}),
    }, { applyLocal: false });
    return { context, store, task, panel, chip, timers, move };
}

for (const pendingDoc of ['', 'c', 'native']) {
    test(`document search carries the destination name before that document is loaded (${pendingDoc || 'settled'})`, async () => {
        const { context, store, task, move } = setup();
        context.state.allDocuments = [{ id: 'a', name: 'A' }];
        if (pendingDoc === 'native') Object.assign(task, { root_id: 'c', docId: 'c', docName: 'C', doc_name: 'C' });
        else if (pendingDoc) move(pendingDoc);
        const exclusions = [];
        const requests = [];
        Object.assign(context, {
            __tmTaskStateKernel: { getTask: () => task },
            __tmEnsureEditableTaskLike: () => true,
            __tmGetVisibleDocTabsForCurrentGroup: () => context.state.allDocuments,
            __tmResolveCurrentGroupAllDocEntries: async ({ excludeDocId }) => {
                exclusions.push(excludeDocId);
                return [{ id: 'b', name: 'B' }];
            },
            showSelectPrompt: async () => '__tm_search__',
            __tmOpenDocSearchPrompt: async () => 'b',
            __tmRequireTaskMutation: () => (taskId, payload) => {
                requests.push(payload);
                store.applyMutation({ type: 'moveTask', phase: 'optimistic', opId: 'search-move', taskId, data: payload }, { applyLocal: false });
            },
            hint() {},
        });
        const start = interactions.indexOf('    window.tmPickTaskDocInline = async function(');
        const end = interactions.indexOf('\n    window.tmEditPriority =', start);
        assert.ok(start >= 0 && end > start);
        vm.runInContext('this.window = this;\n' + interactions.slice(start, end), context);
        await context.tmPickTaskDocInline('task', null);
        assert.deepEqual(exclusions, [pendingDoc ? 'c' : 'a'], 'the picker excludes the latest projected owner');
        assert.equal(requests.length, 1);
        assert.equal(requests[0].targetDocName, 'B');
        for (const resolver of ['__tmGetChecklistDetailTaskById', '__tmGetTaskDetailTaskById']) {
            assert.equal(context[resolver]('task').docName, 'B');
        }
    });
}

test('checklist keeps current local editor fields while resolving the confirmed document name', () => {
    const { context, store, task } = setup();
    store.applyMutation({ type: 'moveTask', phase: 'commit', opId: 'confirmed', taskId: 'task',
        task: { id: 'task', root_id: 'b', docId: 'b', docName: 'B', doc_name: 'B' } }, { applyLocal: false });
    Object.assign(task, { root_id: 'b', docId: 'b', docName: 'A', doc_name: 'A' });
    task.content = 'Unsaved current title';
    const result = context.__tmGetChecklistDetailTaskById('task');
    assert.equal(result.docName, 'B');
    assert.equal(result.doc_name, 'B');
    assert.equal(result.content, task.content);
    assert.equal(result.customFieldValues.note, 'Current text');
    assert.equal(result.children.length, task.children.length);
    assert.equal(task.docName, 'A', 'resolving display data must not rewrite the structural mirror');
});

for (const resolver of ['__tmGetChecklistDetailTaskById', '__tmGetTaskDetailTaskById']) {
    test(`${resolver}: rapid document switches keep the latest move visible through an earlier acknowledgement`, () => {
        const { context, task, move } = setup();
        move('b');
        move('c');
        const assertLatest = () => {
            const result = context[resolver]('task');
            assert.equal(result.root_id, 'c');
            assert.equal(result.docId, 'c');
            assert.equal(result.docName, 'C');
            assert.equal(result.h2, '');
            assert.equal(result.parentTaskId, '');
        };
        assertLatest();
        Object.assign(task, { root_id: 'b', docId: 'b', docName: 'B', doc_name: 'B' });
        move('b', 'commit');
        assertLatest();
        Object.assign(task, { root_id: 'c', docId: 'c', docName: 'C', doc_name: 'C', h2: '', parentTaskId: '' });
        move('c', 'commit');
        assertLatest();
    });

    test(`${resolver}: a failed latest move reveals the previously committed location`, () => {
        const { context, task, move } = setup();
        Object.assign(task, { root_id: 'b', docId: 'b', docName: 'B', doc_name: 'B', h2: '', parentTaskId: '' });
        move('b', 'commit');
        move('c');
        move('c', 'rollback');
        assert.equal(context[resolver]('task').docId, 'b');
        assert.equal(context[resolver]('task').docName, 'B');
    });

    test(`${resolver}: a native document move keeps its current structure when there is no queued move`, () => {
        const { context, task } = setup();
        Object.assign(task, { root_id: 'b', docId: 'b', docName: 'B', doc_name: 'B', h2: 'Native heading', parentTaskId: 'native-parent' });
        const result = context[resolver]('task');
        assert.equal(result.docId, 'b');
        assert.equal(result.docName, 'B');
        assert.equal(result.h2, 'Native heading');
        assert.equal(result.parentTaskId, 'native-parent');
    });
}

for (const mode of ['list', 'checklist']) {
    test(`${mode}: a location patch updates the chip immediately while leaving structural rebuild pending`, () => {
        const { context, panel, chip, move } = setup();
        context.state.viewMode = mode;
        const oldSignature = panel.__tmTaskDetailLocationSignature;
        move('b');
        assert.equal(context.__tmPatchTaskDetailPanelInPlace(panel, 'task', { location: true }), false);
        assert.equal(chip.innerHTML.trim(), 'B');
        assert.equal(panel.__tmTaskDetailLocationSignature, oldSignature, 'parent/heading structure still requires reconciliation');
    });

    test(`${mode}: unrelated field hydration cannot mark an unrendered location as refreshed`, () => {
        const { context, panel, move } = setup();
        context.state.viewMode = mode;
        const oldSignature = panel.__tmTaskDetailLocationSignature;
        move('b');
        context.__tmPatchTaskDetailPanelInPlace(panel, 'task', { customFieldValues: {} });
        assert.equal(panel.__tmTaskDetailLocationSignature, oldSignature);
    });

    test(`${mode}: an already queued rebuild still updates the chip on each new document choice`, () => {
        const { context, panel, chip, timers, move } = setup();
        context.state.viewMode = mode;
        for (const docId of ['b', 'c']) {
            move(docId);
            panel.__tmTaskDetailTask = context[mode === 'checklist' ? '__tmGetChecklistDetailTaskById' : '__tmGetTaskDetailTaskById']('task');
            context.__tmScheduleTaskDetailForceRebuildRetry(panel, 'task');
            assert.equal(chip.innerHTML.trim(), docId.toUpperCase());
        }
        assert.equal(timers.length, 1, 'rebuild retries remain coalesced');
        const refreshedDocs = [];
        context.__tmRefreshVisibleTaskDetailForTask = (id) => {
            refreshedDocs.push(context.__tmGetTaskDetailTaskById(id).docId);
        };
        timers[0]();
        assert.deepEqual(refreshedDocs, ['c'], 'the delayed retry reads the latest location');
    });
}
