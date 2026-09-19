'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const calendar = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const runtime = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js'), 'utf8');
function segment(source, start, end) {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, start);
    return source.slice(from, to);
}
class Element {
    constructor() { this.children = []; this.style = { setProperty() {} }; }
    appendChild(child) { this.children.push(child); }
    setAttribute() {}
    remove() {}
    closest() { return null; }
}
function harness(sourceType, mode = 'permanent') {
    const active = { id: 'active', docId: 'doc-a', content: '当前任务' };
    const foreign = { id: 'foreign', docId: 'doc-b', content: '跨分组任务', children: [{ id: 'child', docId: 'doc-b' }] };
    const state = { flatTasks: { active }, filteredTasks: [active], taskTree: [{ id: 'doc-a', tasks: [active] }] };
    const calls = { confirms: [], queued: [], archived: [], hints: [] };
    const body = new Element();
    const context = vm.createContext({
        Date, Element, state,
        document: { body, createElement: () => new Element(), getElementById: () => null },
        requestAnimationFrame() {},
        SettingsStore: { data: { taskDeleteMode: mode, taskRecycleDocId: 'recycle-doc' } },
        __tmViewPolicy: { shouldSuppressMobileCalendarSidebarContextMenu: () => false },
        __tmTaskBoundary: { getTask: (id) => state.flatTasks[id] || null },
        __tmTaskStore: { upsertLocal: (task) => { state.flatTasks[task.id] = task; return task; } },
        __tmCalendarAllTasksCache: { tasks: [foreign, ...foreign.children] },
        MetaStore: { applyToTask() {} }, normalizeTaskFields() {},
        __tmTaskHasOwnHeadingContextFields: () => false,
        __tmGetCollectedOtherBlockTaskFromState: () => null,
        __tmIsCollectedOtherBlockTask: () => false,
        __tmNormalizeTimerTaskName: (text, fallback) => text || fallback,
        __tmShouldShowCompletedSubtasksForTask: () => false,
        __tmNormalizeTaskRepeatRule: () => ({ enabled: false }),
        __tmNormalizeDateOnly: (value) => String(value || ''),
        __tmPhosphorBoldSvg: () => '',
        __tmGetPriorityJiraInfo: () => ({ key: 'none', label: '无' }),
        __tmGetPriorityAccentColor: () => '', __tmRenderPriorityJira: () => '',
        __tmRenderContextMenuLabel: (_icon, label) => label,
        __tmIsAiFeatureEnabled: () => false,
        __tmScheduleBindOutsideCloseHandler() {}, __tmClearOutsideCloseHandler() {},
        __tmIsRecurringInstanceTask: () => false,
        __tmEnsureEditableTaskLike: () => true,
        __tmNormalizeTaskDeleteMode: (value) => value,
        __tmCaptureTaskLocalSnapshot: (id) => ({ task: state.flatTasks[id] }),
        __tmCollectTaskTreeIdsForScheduleCleanup: (task, id) => [id, ...(task.children || []).map((child) => child.id)],
        __tmEnqueueQueuedOp: async (operation) => { calls.queued.push(operation); return true; },
        __tmTaskLifecycle: { archiveDeleted: async (id, options) => { calls.archived.push({ id, options }); } },
        __tmShowActionHint() {},
        showConfirm: async (title) => { calls.confirms.push(title); return context.confirmResult; },
        confirmResult: true,
        hint: (message) => calls.hints.push(message),
        shouldEnableCalendarEventContextMenu: () => true,
        getCalendarEventTaskLikeForTitle: () => null,
    });
    context.window = context;
    vm.runInContext([
        segment(calendar, 'function getCalendarTaskSnapshotById(', 'function shouldEnableCalendarEventContextMenu('),
        segment(calendar, 'function buildCalendarTaskDateContextPayload(', 'function isCalendarListViewType('),
        segment(calendar, 'function handleCalendarEventContextMenu(', 'function __tmScheduleCalendarSourceRefetchRelease('),
        segment(runtime, 'function __tmCacheTaskInState(', 'function __tmApplyQuickbarAttrUpdateInState('),
        segment(runtime, 'window.tmDelete = async function(', '// 任务提醒'),
        segment(runtime, 'window.tmShowTaskContextMenu = function(', 'let __tmAllDocumentsFetchedAt'),
    ].join('\n'), context);
    const jsEvent = { preventDefault() {}, stopPropagation() {} };
    const event = {
        id: 'calendar-foreign', allDay: sourceType !== 'schedule',
        extendedProps: { __tmSource: sourceType, __tmTaskId: 'foreign', ...(sourceType === 'schedule' ? { __tmScheduleId: 'schedule-1' } : {}) },
    };
    function openAndDelete(directTaskId = '') {
        if (directTaskId) context.tmShowTaskContextMenu(jsEvent, directTaskId);
        else assert.equal(context.handleCalendarEventContextMenu({ jsEvent, event }), true);
        const menu = body.children.at(-1);
        const item = menu.children.find((child) => child.textContent === '删除任务');
        assert.ok(item, 'The actual context menu must expose delete');
        const remove = context.tmDelete;
        let pending;
        context.tmDelete = (...args) => { pending = remove(...args); return pending; };
        item.onclick(jsEvent);
        return pending;
    }
    return { context, calls, state, active, foreign, openAndDelete };
}
async function main() {
    for (const sourceType of ['taskdate', 'schedule', 'reminder']) {
        const test = harness(sourceType);
        assert.equal(await test.openAndDelete(), true, sourceType);
        assert.deepEqual(test.calls.confirms, ['删除任务']);
        assert.equal(test.calls.queued.length, 1);
        const operation = test.calls.queued[0];
        assert.equal(operation.type, 'deleteTask');
        assert.equal(operation.docId, 'doc-b', 'Deletion must target the task’s original document');
        assert.equal(operation.data.taskId, 'foreign');
        assert.deepEqual(Array.from(operation.data.scheduleCleanupTaskIds), ['foreign', 'child']);
        assert.deepEqual(test.state.filteredTasks, [test.active], 'Opening a foreign task menu must not insert it into the active group’s list');
        assert.equal(test.foreign.docId, 'doc-b');
    }
    const cancel = harness('taskdate');
    cancel.context.confirmResult = false;
    assert.equal(await cancel.openAndDelete(), false);
    assert.equal(cancel.calls.queued.length, 0, 'Cancelling confirmation must not delete anything');
    const recycle = harness('taskdate', 'recycle');
    assert.equal(await recycle.openAndDelete(), true);
    assert.equal(recycle.calls.queued.length, 0);
    assert.equal(recycle.calls.archived[0].id, 'foreign');
    assert.equal(recycle.calls.archived[0].options.targetDocId, 'recycle-doc');
    assert.equal(recycle.calls.archived[0].options.task.docId, 'doc-b');
    const cached = harness('taskdate');
    cached.state.flatTasks.foreign = { ...cached.foreign, content: '最新内容' };
    await cached.openAndDelete();
    assert.equal(cached.state.flatTasks.foreign.content, '最新内容', 'An existing task must not be overwritten by stale calendar cache');
    const nested = harness('taskdate');
    assert.equal(await nested.openAndDelete('child'), true, 'Inline child menus without an extra task payload can delete across groups');
    assert.equal(nested.calls.queued[0].docId, 'doc-b');
    assert.equal(nested.calls.queued[0].data.taskId, 'child');
    console.log('calendar cross-document delete tests passed');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
