'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('./i18n-vm-fixture');
const { test } = require('node:test');

const main = path.join(__dirname, '../src/task-horizon/main');
const read = (file) => fs.readFileSync(path.join(main, file), 'utf8');
const services = read('20-api-and-runtime-services.js');
const stores = read('10-stores-rules-and-cache.js');
const events = read('32-runtime-state-and-events.js');
const list = read('task-runtime/53-list-render-and-document-loader.js');
const extract = (source, name) => {
    const start = source.indexOf(`    function ${name}(`);
    const end = source.indexOf('\n    }', start);
    assert.ok(start >= 0 && end > start, `missing function: ${name}`);
    return source.slice(start, end + 6);
};

function createHarness(pinned) {
    const task = { id: 'task-new', root_id: 'doc-a', pinned, custom_pinned: pinned ? '1' : '', children: [] };
    const watermark = { fields: [], values: {}, source: 'toggle-pinned' };
    const context = vm.createContext({
        console: { log() {}, warn() {} }, Map, Set, queueMicrotask() {},
        state: { flatTasks: {}, pendingInsertedTasks: {}, taskTree: [{ id: 'doc-a', tasks: [task] }], filteredTasks: [task], otherBlocks: [] },
        SettingsStore: { data: {} }, MetaStore: { get: () => null, set() {} },
        __tmGetLocalTaskPatchWatermark: () => watermark,
        __tmGetLocalTaskPatchWatermarkValue: (_id, field) => ({ has: watermark.fields.includes(field), value: watermark.values[field] }),
        __tmApplyDoneOverrideToTaskIfPresent() {},
        __tmNormalizeLocalPatchFieldKey: (field) => field,
        __tmGetPatchFieldKeysForTaskPatch: (patch) => Object.keys(patch),
    });
    for (const name of ['__tmNormalizeQueueTaskValue', '__tmApplyQueuedTaskFieldPatchToTask']) {
        vm.runInContext(extract(services, name), context);
    }
    vm.runInContext(read('09-task-field-schema.js'), context);
    vm.runInContext(extract(stores, '__tmBuildLocalTaskPatchWatermarkPatch'), context);
    vm.runInContext(events, context);
    const store = context.__tmTaskStore;
    store.createPendingTask(task);
    store.applyMutation({ type: 'createTaskInDoc', phase: 'commit', taskId: task.id, task, opId: 'create' }, { applyLocal: false });
    const toggle = !pinned;
    watermark.fields = ['pinned'];
    watermark.values.pinned = toggle;
    store.applyMutation({ type: 'taskPatch', phase: 'optimistic', taskId: task.id, opId: 'pin', patch: { pinned: toggle } });
    store.applyMutation({ type: 'taskPatch', phase: 'commit', taskId: task.id, opId: 'pin', patch: { pinned: toggle }, task: { id: task.id, pinned: toggle } });
    return { context, store, task, watermark };
}

for (const original of [true, false]) {
    test(`a delayed create receipt cannot undo pinned=${!original} on a new task`, () => {
        const { store, context } = createHarness(original);
        store.applyMutation({
            type: 'createTaskInDoc', phase: 'commit', taskId: 'task-new', opId: 'delayed-create',
            task: { id: 'task-new', root_id: 'doc-a', pinned: original, custom_pinned: original ? '1' : '' },
        }, { applyLocal: false });
        for (const task of [store.getConfirmed('task-new'), store.getProjected('task-new'), store.getFlat('task-new'), store.getPending('task-new'), context.state.taskTree[0].tasks[0]]) {
            assert.equal(task.pinned, !original);
            assert.equal(task.custom_pinned, !original ? '1' : '');
        }
    });
    test(`an unrelated field receipt cannot undo pinned=${!original}`, () => {
        const { store } = createHarness(original);
        store.applyMutation({
            type: 'taskPatch', phase: 'commit', taskId: 'task-new', opId: 'priority',
            patch: { priority: 'high' }, task: { id: 'task-new', priority: 'high', pinned: original },
        }, { applyLocal: false });
        assert.equal(store.getProjected('task-new').priority, 'high');
        assert.equal(store.getProjected('task-new').pinned, !original);
        assert.equal(store.getPending('task-new').pinned, !original);
    });
}

test('a pin write still accepts an authoritative correction from its own receipt', () => {
    const { store } = createHarness(false);
    store.applyMutation({
        type: 'taskPatch', phase: 'commit', taskId: 'task-new', opId: 'corrected-pin',
        patch: { pinned: true }, task: { id: 'task-new', pinned: false },
    }, { applyLocal: false });
    assert.equal(store.getConfirmed('task-new').pinned, false);
    assert.equal(store.getProjected('task-new').custom_pinned, '');
});

test('a canonical pinned receipt updates the inherited alias before snapshot packing', () => {
    const { store } = createHarness(true);
    store.applyMutation({
        type: 'taskPatch', phase: 'commit', taskId: 'task-new', opId: 'authoritative-pin',
        patch: { pinned: false }, task: { id: 'task-new', pinned: false, custom_pinned: '1' },
    }, { applyLocal: false });
    assert.equal(store.getProjected('task-new').pinned, false);
    assert.equal(store.getProjected('task-new').custom_pinned, '');
});

test('snapshot reconciliation uses the protected pinned value even if the flat mirror is stale', () => {
    const { context, store } = createHarness(true);
    store.getFlat('task-new').pinned = true;
    store.getFlat('task-new').custom_pinned = '1';
    vm.runInContext(extract(stores, '__tmMergeLocalTaskPatchIntoTask'), context);
    const snapshotTask = { id: 'task-new', pinned: true, custom_pinned: '1' };
    context.__tmMergeLocalTaskPatchIntoTask(snapshotTask);
    assert.equal(snapshotTask.pinned, false);
    assert.equal(snapshotTask.custom_pinned, '');
});

test('delayed calendar pin refreshes follow the latest toggle and observe real queue settlement', async () => {
    const timers = [];
    const refreshes = [];
    const pending = [];
    const task = { id: 'task-new', pinned: false };
    const context = vm.createContext({
        window: {}, setTimeout: (run) => { timers.push(run); },
        __tmTaskBoundary: { getTask: () => task },
        __tmTaskStore: { getProjected: () => task },
        __tmCalendar: { refreshTaskPinned: (_id, value) => refreshes.push(value) },
        hint() {},
        __tmRequireTaskMutation: () => (_id, patch, options) => {
            task.pinned = patch.pinned === '1';
            let resolve;
            const promise = new Promise((done) => { resolve = done; });
            pending.push(resolve);
            options.onPending?.(promise, { id: `op-${pending.length}` });
            return Promise.resolve(`op-${pending.length}`);
        },
    });
    const start = list.indexOf('    window.tmSetPinned =');
    const end = list.indexOf('\n    window.tmSetTaskAllDayBottom', start);
    vm.runInContext(list.slice(start, end), context);
    await context.window.tmSetPinned(task.id, true);
    await context.window.tmSetPinned(task.id, false);
    assert.equal(timers.length, 0, 'enqueue is not a kernel commit');
    pending[0]({ task: { id: task.id, pinned: true } });
    await Promise.resolve();
    pending[1]({ task: { id: task.id, pinned: false } });
    await Promise.resolve();
    while (timers.length) timers.shift()();
    assert.ok(refreshes.length > 0);
    assert.ok(refreshes.every((value) => value === false), 'an older timer must not repin the calendar');
});
