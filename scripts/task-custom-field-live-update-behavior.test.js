'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const main = path.join(__dirname, '../src/task-horizon/main');
const read = (file) => fs.readFileSync(path.join(main, file), 'utf8');
const stores = read('10-stores-rules-and-cache.js');
const services = read('20-api-and-runtime-services.js');
const runtime = read('32-runtime-state-and-events.js');
const coordinator = read('task-runtime/51-whiteboard-and-link-runtime.js');
const detail = read('task-runtime/52-task-detail-runtime.js');
const clone = (value) => JSON.parse(JSON.stringify(value));
const extract = (source, name) => {
    const start = source.indexOf(`    function ${name}(`);
    const end = source.indexOf('\n    }', start);
    assert.ok(start >= 0 && end > start, `missing function: ${name}`);
    return source.slice(start, end + 6);
};

function createHarness() {
    const defs = [
        { id: 'stage', type: 'single', options: [{ id: 'old', name: '旧阶段' }, { id: 'new', name: '新阶段' }] },
        { id: 'labels', type: 'multi', options: [{ id: 'a', name: '标签甲' }, { id: 'b', name: '标签乙' }] },
        { id: 'notes', type: 'text' },
    ];
    const original = {
        id: 'task-a', root_id: 'doc-a', content: 'Task', children: [],
        customFieldValues: { stage: 'old', labels: ['a'], notes: '原备注' },
        __customFieldRawValues: { stage: '旧阶段', labels: '标签甲', notes: '原备注' },
        __tmLoadedAllCustomFields: true,
    };
    const mirrors = Array.from({ length: 3 }, () => clone(original));
    const context = vm.createContext({
        console, Map, Set, queueMicrotask: () => {},
        state: {
            flatTasks: { 'task-a': mirrors[0] },
            taskTree: [{ id: 'doc-a', tasks: [mirrors[1]] }],
            filteredTasks: [mirrors[2]], otherBlocks: [],
        },
        SettingsStore: { data: {} },
        MetaStore: { set() {} },
        __tmGetCustomFieldDefs: () => defs,
        __tmGetCustomFieldDefMap: () => new Map(defs.map((field) => [field.id, field])),
        __tmBuildCustomFieldOptionRuntime: () => ({ pathById: new Map() }),
    });
    for (const name of [
        '__tmFindCustomFieldOption', '__tmNormalizeCustomFieldValue', '__tmSerializeCustomFieldValue',
        '__tmGetTaskCustomFieldRawValues', '__tmNormalizeTaskCustomFieldValues',
    ]) vm.runInContext(extract(stores, name), context);
    for (const name of ['__tmNormalizeQueueTaskValue', '__tmApplyQueuedTaskFieldPatchToTask']) {
        vm.runInContext(extract(services, name), context);
    }
    vm.runInContext(runtime, context);
    const store = context.__tmTaskStore;
    store.replaceFlat(context.state.flatTasks, { authoritative: true, mergeOtherBlocks: false });
    const mutate = (phase, patch, extra = {}) => store.applyMutation({
        type: 'taskPatch', taskId: original.id, opId: 'edit-custom-field', phase, patch, ...extra,
    });
    const readAfterNormalization = (task) => clone(context.__tmNormalizeTaskCustomFieldValues(
        context.__tmGetTaskCustomFieldRawValues(task), task.customFieldValues,
    ));
    return { context, store, mirrors, original, mutate, readAfterNormalization };
}

test('custom edits merge into every mounted task mirror and survive view normalization', () => {
    const h = createHarness();
    h.mutate('optimistic', { customFieldValues: { stage: 'new' } });
    for (const task of h.mirrors) {
        assert.deepEqual(clone(task.customFieldValues), { stage: 'new', labels: ['a'], notes: '原备注' });
        assert.equal(h.readAfterNormalization(task).stage, 'new', 'view switches must not restore the old raw attribute');
    }
});

test('projected custom values and raw attributes advance together without mutating the confirmed baseline', () => {
    const h = createHarness();
    h.mutate('optimistic', { customFieldValues: { stage: 'new', labels: ['a', 'b'], notes: '新备注' } });
    assert.deepEqual(h.readAfterNormalization(h.store.getProjected('task-a')), {
        stage: 'new', labels: ['a', 'b'], notes: '新备注',
    });
    h.mutate('rollback', {}, { inversePatch: h.original });
    assert.deepEqual(h.readAfterNormalization(h.store.getProjected('task-a')), h.original.customFieldValues);
});

test('confirmed field edits remain fresh when another view normalizes the task', () => {
    const h = createHarness();
    const patch = { customFieldValues: { stage: 'new', notes: '保存后的备注' } };
    h.mutate('optimistic', patch);
    h.mutate('commit', patch);
    assert.deepEqual(h.readAfterNormalization(h.store.getProjected('task-a')), {
        stage: 'new', labels: ['a'], notes: '保存后的备注',
    });
});

test('clearing custom fields does not resurrect old values during the next view render', () => {
    const h = createHarness();
    const patch = { customFieldValues: { stage: '', labels: [], notes: '' } };
    h.mutate('optimistic', patch);
    assert.deepEqual(h.readAfterNormalization(h.store.getProjected('task-a')), {});
    h.mutate('commit', patch);
    assert.deepEqual(h.readAfterNormalization(h.store.getProjected('task-a')), {});
    for (const task of h.mirrors) assert.deepEqual(h.readAfterNormalization(task), {});
});

test('checklist detail updates custom fields locally while preserving the active text draft', () => {
    const h = createHarness();
    class Element {}
    class TextArea extends Element {}
    const selectValue = new Element();
    const textarea = Object.assign(new TextArea(), { value: '正在编辑的草稿' });
    const panel = Object.assign(new Element(), {
        id: 'tmChecklistDetailPanel', dataset: { tmDetailTaskId: 'task-a' },
        querySelector: (selector) => {
            if (selector === '[data-tm-detail-custom-field="stage"] .tm-task-detail-custom-field-value') return selectValue;
            if (selector === 'textarea[data-tm-detail-custom-text-field="notes"]') return textarea;
            return null;
        },
    });
    Object.assign(h.context, {
        Element, HTMLElement: Element, HTMLTextAreaElement: TextArea,
        document: { activeElement: textarea },
        __tmTaskBoundary: { getTask: (id) => h.store.getProjected(id) },
        __tmIsTaskDetailRootUsable: () => true,
        __tmAreTaskDetailIdsEquivalent: (a, b) => a === b,
        __tmIsCustomFieldApplicableToTask: () => true,
        __tmBuildCustomFieldDisplayHtml: (_field, value) => value || '未设置',
    });
    vm.runInContext(extract(stores, '__tmGetTaskCustomFieldValue'), h.context);
    vm.runInContext(extract(detail, '__tmGetChecklistDetailTaskById'), h.context);
    vm.runInContext(extract(detail, '__tmPatchTaskDetailPanelInPlace'), h.context);
    const patch = { customFieldValues: { stage: 'new', notes: '其他视图的新备注' } };
    h.mutate('local', patch);
    assert.equal(h.context.__tmPatchTaskDetailPanelInPlace(panel, 'task-a', patch), true);
    assert.equal(selectValue.innerHTML, 'new');
    assert.equal(textarea.value, '正在编辑的草稿');
    h.context.document.activeElement = null;
    h.context.__tmPatchTaskDetailPanelInPlace(panel, 'task-a', patch);
    assert.equal(textarea.value, '其他视图的新备注');
    h.mutate('local', { customFieldValues: { stage: '' } });
    h.context.__tmPatchTaskDetailPanelInPlace(panel, 'task-a', { customFieldValues: { stage: '' } });
    assert.equal(selectValue.innerHTML, '未设置');
});

test('timeline custom field cells receive the same local patch as other views', () => {
    class Element {}
    const row = new Element();
    const modal = Object.assign(new Element(), { querySelector: () => row });
    const calls = [];
    const task = { id: 'task-a', customFieldValues: { stage: 'new' } };
    const context = vm.createContext({
        Element, HTMLElement: Element, CSS: { escape: (value) => value },
        state: { modal, viewMode: 'timeline' },
        __tmTaskStore: { getProjected: () => task },
        __tmDoesPatchAffectPriorityScore: () => false,
        __tmUpdateTaskCustomFieldsInDOM: (...args) => { calls.push(args); return true; },
    });
    const start = coordinator.indexOf('    const __tmViewControllers = {');
    const end = coordinator.indexOf('\n    };', start);
    assert.ok(start >= 0 && end > start);
    vm.runInContext(coordinator.slice(start, end + 7) + '\nthis.controllers = __tmViewControllers;', context);
    const patch = { customFieldValues: { stage: 'new' } };
    assert.equal(context.controllers.timeline.patchTask('task-a', patch), true);
    assert.deepEqual(calls, [[row, task, patch]]);
});
