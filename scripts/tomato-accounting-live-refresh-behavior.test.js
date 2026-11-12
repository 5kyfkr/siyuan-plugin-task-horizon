'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('./i18n-vm-fixture');
const { test } = require('node:test');
const main = path.join(__dirname, '../src/task-horizon/main');
const read = (file) => fs.readFileSync(path.join(main, file), 'utf8');
const services = read('20-api-and-runtime-services.js');
const views = read('task-runtime/51-whiteboard-and-link-runtime.js');
const detail = read('task-runtime/52-task-detail-runtime.js');
const list = read('task-runtime/53-list-render-and-document-loader.js');
function section(source, start, end) {
    const from = source.indexOf(start), to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, start);
    return source.slice(from, to);
}
function extract(source, name) {
    const start = source.search(new RegExp(`    (?:async )?function ${name}\\(`));
    const end = source.indexOf('\n    }', start);
    assert.ok(start >= 0 && end > start, name);
    return source.slice(start, end + 6);
}

function setup(mode = 'kanban', unit = 'minutes', customKeys = false) {
    class Element {
        constructor() {
            this.nodes = new Map(); this.dataset = {}; this.style = {};
            this.classList = { toggle() {}, contains: () => false };
        }
        querySelector(selector) { return this.nodes.get(selector) || null; }
        querySelectorAll(selector) { const node = this.querySelector(selector); return node ? [node] : []; }
        setAttribute() {}
        removeAttribute() {}
    }
    class Input extends Element {}
    const task = { id: 'task-a', root_id: 'doc-a', docId: 'doc-a', docName: 'A', children: [],
        duration: '60', tomatoMinutes: '0', tomatoHours: '0', tomatoCount: '0', tomatoEstimateCount: '3' };
    const mirrors = [task, { ...task }, { ...task }];
    const row = new Element(), modal = new Element(), panel = new Element();
    panel.id = mode === 'checklist' ? 'tmChecklistDetailPanel' : 'tmTaskDetailSheetPanel';
    panel.dataset.tmDetailTaskId = task.id;
    const draft = new Input(); draft.value = 'Active editor draft';
    panel.nodes.set('[data-tm-detail="content"]', draft);
    const summaryFace = new Element();
    panel.nodes.set('[data-tm-detail-chip-face="tomatoSummary"]', summaryFace);
    const summaryCell = new Element();
    row.nodes.set('[data-tm-task-time-field="tomatoSummary"]', summaryCell);
    const minutesKey = customKeys ? 'custom-focus-mins' : 'custom-tomato-minutes';
    const hoursKey = customKeys ? 'custom-focus-hours' : 'custom-tomato-time';
    const countKey = customKeys ? 'custom-focus-count' : 'custom-tomato-count';
    const frames = [];
    const meta = new Map();
    const summary = (value) => `${unit === 'hours' ? value.tomatoHours : value.tomatoMinutes}/${value.duration}; count=${value.tomatoCount}`;
    const context = vm.createContext({
        Element, HTMLElement: Element, HTMLInputElement: Input, HTMLTextAreaElement: Input,
        CSS: { escape: (value) => value },
        state: { viewMode: mode, modal, flatTasks: { [task.id]: task }, pendingInsertedTasks: {},
            filteredTasks: [mirrors[1]], taskTree: [{ id: 'doc-a', tasks: [mirrors[2]] }], otherBlocks: [] },
        SettingsStore: { data: { enableTomatoIntegration: true, tomatoSpentAttrMode: unit } },
        MetaStore: { get: (id) => meta.get(id), set: (id, patch) => meta.set(id, { ...meta.get(id), ...patch }), applyToTask() {} },
        document: { activeElement: draft, body: { contains: () => true } },
        queueMicrotask: (callback) => frames.push(callback),
        __tmMutationEngine: { isTaskSuppressed: () => false },
        __tmTaskStateKernel: { getTask: (id) => context.__tmTaskStore.get(id) },
        __tmResolveTaskMetaFieldByAttrKey: () => '',
        __tmIsTaskAttachmentAttrKey: () => false,
        __tmMirrorNativeDocTaskPriorityAttr() {},
        __tmIsVisibleDateAttrKey: () => false,
        __tmIsPluginVisibleNow: () => true,
        __tmDoesPatchAffectProjection: () => false,
        __TM_TASK_REPEAT_RULE_ATTR: 'custom-repeat-rule',
        __TM_TASK_REPEAT_STATE_ATTR: 'custom-repeat-state',
        __tmMarkQuickbarModifiedTask() { throw new Error('An applied duration update must not reload the task list'); },
        __tmGetCustomFieldDefByAttrStorageKey: () => null,
        __tmGetTomatoEstimateAttrKey: () => 'custom-tomato-estimate-count',
        __tmGetTomatoCountAttrKey: () => countKey,
        __tmGetTomatoSpentMinutesAttrKey: () => minutesKey,
        __tmGetTomatoSpentHoursAttrKey: () => hoursKey,
        __tmNormalizeTomatoCountValue: (value) => String(value || ''),
        __tmTaskHasOwnHeadingContextFields: () => true,
        normalizeTaskFields() {},
        __tmIsTaskDetailRootUsable: () => true,
        __tmAreTaskDetailIdsEquivalent: (a, b) => a === b,
        __tmGetChecklistDetailTaskById: (id) => context.__tmTaskStore.getProjected(id),
        __tmGetTaskDetailTaskById: (id) => context.__tmTaskStore.getProjected(id),
        __tmGetTaskTomatoEstimateCount: (value) => value.tomatoEstimateCount,
        __tmGetTaskTomatoSummaryText: summary,
        __tmGetTaskTomatoSummaryHtml: summary,
        __tmBuildTaskDetailCoreChipFace: (_kind, value) => summary(value),
        __tmDoesPatchAffectPriorityScore: () => false,
        __tmDoesPatchAffectTaskCardMetaChips: () => true,
        __tmSyncTaskCardMetaChipsInDOM(_row, value) { summaryCell.innerHTML = summary(value); return true; },
        __tmRefreshVisibleTaskDetailForTask: (id, { patch }) => context.__tmPatchTaskDetailPanelInPlace(panel, id, patch),
        __tmFormatTaskDateFieldDisplayValue: () => '',
        __tmFormatTaskCompletedAtTime: () => '', __tmResolveTaskCompletedAtRaw: () => '',
        __tmFormatDurationDisplayValue: (value) => value,
        __tmGetTomatoCountDisplayHtml: (value) => value, __tmGetActualTomatoCountDisplayHtml: (value) => value,
        __tmGetTaskTomatoCount: (value) => value.tomatoCount,
        __tmGetTaskRemainingTimeInfo: () => null, __tmRenderTaskRemainingTimeInfoHtml: () => '',
        esc: (value) => value,
    });
    vm.runInContext(read('09-task-field-schema.js'), context);
    vm.runInContext(read('32-runtime-state-and-events.js'), context);
    context.__tmTaskBoundary = { getTask: (id) => context.__tmTaskStore.get(id) };
    for (const name of ['__tmBuildMetaPatchFromAttrUpdate', '__tmNormalizeQueueTaskValue', '__tmCaptureTaskPatchInverse', '__tmIsPatchNoop', '__tmUndoComparableValue']) {
        vm.runInContext(extract(services, name), context);
    }
    for (const name of ['__tmCacheTaskInState', '__tmApplyQuickbarAttrUpdateInState']) vm.runInContext(extract(list, name), context);
    vm.runInContext(section(views, '    const __tmChangeFeed = {', '\n    function __tmCloseCellEditor(') + '\nthis.feed = __tmChangeFeed;', context);
    vm.runInContext(section(read('shell/80-shell-lifecycle.js'), '            __tmQuickbarTaskUpdateHandler = (e) => {',
        "            globalThis.__tmRuntimeEvents?.on?.(window, 'tm-task-attr-updated'"), context);
    vm.runInContext(extract(detail, '__tmPatchTaskDetailPanelInPlace'), context);
    vm.runInContext(extract(read('render/46-render-local-task-time-refresh.js'), '__tmUpdateListTaskTimeInDOM'), context);
    vm.runInContext(section(views, '    const __tmViewControllers = {', '\n    };') + '\n    };\nthis.controllers = __tmViewControllers;', context);
    modal.querySelector = () => row; modal.querySelectorAll = () => [row];
    context.__tmUpdateChecklistTaskTimeInDOM = (_id, _row, value) => { summaryCell.innerHTML = summary(value); return true; };
    context.__tmTaskProjectionEngine = { flush(entries) {
        for (const { mutation } of entries) {
            const controller = context.controllers[mode === 'comboBoard' ? 'kanban' : mode];
            controller.patchTask(mutation.taskId, mutation.patch);
            context.controllers.detail.patchTask(mutation.taskId, mutation.patch);
        }
    } };
    context.__tmTaskStore.replaceFlat(context.state.flatTasks, { authoritative: true, mergeOtherBlocks: false });
    const drain = () => { while (frames.length) frames.shift()(); };
    const update = (key, value) => context.feed.handleAttrUpdate(task.id, key, value, { reason: 'docktomato' });
    const emit = (key, value, extra = {}) => context.__tmQuickbarTaskUpdateHandler({
        detail: { taskId: task.id, requestedTaskId: task.id, attrHostId: task.id, attrKey: key, value, source: 'docktomato', ...extra },
    });
    return { context, task, mirrors, summaryCell, summaryFace, draft, minutesKey, hoursKey, countKey, drain, update, emit };
}

for (const mode of ['list', 'checklist', 'kanban', 'comboBoard', 'timeline', 'whiteboard']) {
    for (const unit of ['minutes', 'hours']) {
        test(`${mode} and active task detail immediately show ${unit} after a Tomato attribute update`, () => {
            const h = setup(mode, unit);
            h.emit(unit === 'hours' ? h.hoursKey : h.minutesKey, unit === 'hours' ? '0.50' : '30');
            h.emit(h.countKey, '1');
            h.drain();
            const field = unit === 'hours' ? 'tomatoHours' : 'tomatoMinutes';
            const value = unit === 'hours' ? '0.50' : '30';
            assert.equal(h.context.__tmTaskStore.getProjected('task-a')[field], value);
            assert.equal(h.context.__tmTaskStore.getConfirmed('task-a')[field], value);
            assert.equal(h.summaryCell.innerHTML, `${value}/60; count=1`);
            assert.equal(h.summaryFace.innerHTML, `${value}/60; count=1`);
            assert.equal(h.draft.value, 'Active editor draft');
            for (const task of h.mirrors) assert.equal(task[field], value);
        });
    }
}

test('an attribute no-op still repairs a stale confirmed baseline with custom Tomato attribute keys', () => {
    const h = setup('kanban', 'minutes', true);
    h.task.tomatoMinutes = '45';
    assert.equal(h.update(h.minutesKey, '45'), true);
    h.drain();
    assert.equal(h.context.__tmTaskStore.getConfirmed('task-a').tomatoMinutes, '45');
    assert.equal(h.summaryCell.innerHTML, '45/60; count=0');
});

test('a subsequent attribute correction clears spent time and count without reviving old projected values', () => {
    const h = setup();
    for (const [minutes, count] of [['25', '1'], ['50', '2'], ['', '']]) {
        h.update(h.minutesKey, minutes); h.update(h.countKey, count); h.drain();
        assert.equal(h.context.__tmTaskStore.getProjected('task-a').tomatoMinutes, minutes);
        assert.equal(h.summaryCell.innerHTML, `${minutes}/60; count=${count}`);
        assert.equal(h.summaryFace.innerHTML, `${minutes}/60; count=${count}`);
    }
});

test('settlement updates spent time while preserving an unrelated pending edit and its rollback', () => {
    const h = setup('list');
    h.context.__tmTaskStore.applyMutation({ type: 'taskPatch', phase: 'optimistic', opId: 'pending-estimate',
        taskId: h.task.id, patch: { duration: '90' } });
    h.emit(h.minutesKey, '25'); h.drain();
    assert.equal(h.summaryCell.innerHTML, '25/90; count=0');
    h.context.__tmTaskStore.applyMutation({ type: 'taskPatch', phase: 'rollback', opId: 'pending-estimate',
        taskId: h.task.id, patch: { duration: '90' }, inversePatch: { duration: '60' } });
    h.drain();
    assert.equal(h.summaryCell.innerHTML, '25/60; count=0');
    assert.equal(h.context.__tmTaskStore.getConfirmed(h.task.id).tomatoMinutes, '25');
});

test('local mutation notifications do not reapply their optimistic values as confirmed external writes', () => {
    const h = setup();
    h.context.__tmTaskStore.applyMutation({ type: 'taskPatch', phase: 'optimistic', opId: 'pending-duration',
        taskId: h.task.id, patch: { duration: '90' } });
    h.emit('custom-duration', '90', { localMutation: true });
    assert.equal(h.context.__tmTaskStore.getConfirmed(h.task.id).duration, '60');
    assert.equal(h.context.__tmTaskStore.getProjected(h.task.id).duration, '90');
});
