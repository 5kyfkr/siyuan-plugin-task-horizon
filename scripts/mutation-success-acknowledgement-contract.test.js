'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const dialogs = read('src/task-horizon/main/30-dialogs-and-ui-foundation.js');
const apiRuntime = read('src/task-horizon/main/20-api-and-runtime-services.js');
const renderRuntime = read('src/task-horizon/main/40-render-runtime.js');
const taskLoader = read('src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js');
const createRuntime = read('src/task-horizon/main/task-runtime/53b-task-create-and-quick-add-runtime.js');
const lifecycle = read('src/task-horizon/main/shell/80-shell-lifecycle.js');
const calendarView = read('calendar-view.js');
const fieldEditRuntime = read('src/task-horizon/main/task-runtime/53a-list-field-edit-runtime.js');

function segment(source, startNeedle, endNeedle) {
    const start = source.indexOf(startNeedle);
    const end = source.indexOf(endNeedle, start + startNeedle.length);
    assert.ok(start >= 0, `missing ${startNeedle}`);
    assert.ok(end > start, `missing boundary ${endNeedle}`);
    return source.slice(start, end);
}

function assertAwaitedBeforeSuccess(source, awaitedNeedle, successNeedle, label) {
    const awaitedAt = source.indexOf(awaitedNeedle);
    const successAt = source.indexOf(successNeedle);
    assert.ok(awaitedAt >= 0, `${label} must await its authoritative mutation`);
    assert.ok(successAt > awaitedAt, `${label} must not announce success before the authoritative mutation settles`);
}

const headingDrop = segment(dialogs, 'window.tmDocHeadingGroupDrop = async function', 'function __tmTaskHasExpandedVisibleChildren');
const rowMove = segment(dialogs, 'async function __tmQueueTaskRowMove', 'async function __tmHandleTaskRowDropCore');
const rowDropCore = segment(dialogs, 'async function __tmHandleTaskRowDropCore', 'window.tmTaskRowDragOver');
const rowDrop = segment(dialogs, 'window.tmTaskRowDrop = async function', 'window.tmDocTabDrop = async function');
const batchMoveQueue = segment(taskLoader, 'function __tmQueueBatchMoveTasks', 'function __tmGetTaskForDetachSubtask');
const docTabDrop = segment(dialogs, 'window.tmDocTabDrop = async function', 'function __tmIsWhiteboardTaskDragSource');
const headingCreate = segment(createRuntime, 'window.tmCreateTaskForHeadingGroup = async function', 'async function __tmAppendBlockOnce');
const subtaskCreate = segment(createRuntime, 'window.tmCreateSubtask = async function', 'window.tmCreateSiblingTask = async function');
const siblingCreate = segment(createRuntime, 'window.tmCreateSiblingTask = async function', 'let __tmQuickbarScheduledRefreshTimer');
const quickAddCreate = segment(createRuntime, 'window.tmQuickAddSubmit = async function', 'window.tmAdd = async function');
const kanbanChildCandidate = segment(renderRuntime, 'function __tmUpdateKanbanChildDropCandidate', 'function __tmTakeReadyKanbanChildDropTarget');
const kanbanDragStart = segment(renderRuntime, 'window.tmKanbanDragStart = function', 'window.tmKanbanDragEnd = function');
const kanbanDrop = segment(renderRuntime, 'window.tmKanbanDrop = async function', 'window.tmKanbanPickDate = async function');
const floatingPriorityDrop = segment(calendarView, 'async function applyFloatingMiniTaskPriority', 'function clearFloatingMiniAutoFlipTimer');
const floatingDateDrop = segment(calendarView, 'async function applyFloatingMiniCalendarDate', 'async function finalizeFloatingMiniCalendarTouchDrop');
const allDayDueDateDrop = segment(calendarView, 'async function maybeUpdateEmptyTaskDueDateFromAllDayDrop', 'function parseTaskDropPayload');
const priorityFieldEntry = segment(fieldEditRuntime, 'window.tmSetTaskPriority = async function', 'window.tmSetTaskCompletionTime = async function');
const completionTimeFieldEntry = segment(fieldEditRuntime, 'window.tmSetTaskCompletionTime = async function', 'function __tmOpenPriorityInlinePicker');

assert.match(headingDrop, /await moveTask\([\s\S]*wait: true/);
assert.match(headingDrop, /wait: true,[\s\S]*showErrorHint: false/);
assertAwaitedBeforeSuccess(headingDrop, 'await moveTask(', "hint(String(check.payload", 'heading-group move');
assert.match(rowMove, /const moveResult = await moveTask\([\s\S]*wait: true,[\s\S]*showErrorHint: false/);
assert.doesNotMatch(rowMove, /wait: false|onError:/, 'row moves must surface settlement failures to the drop handler');
assert.match(rowDropCore, /if \(moveAsChild\)[\s\S]*__tmRequireTaskMutation\?\.\('batchMoveTasks'\)[\s\S]*await batchMoveTasks\(ids, payload,[\s\S]*wait: true/,
    'multi-select child moves must settle through one batch task mutation');
assert.match(rowDropCore, /if \(moveAsChild\)[\s\S]*return \{[\s\S]*batchCount:[\s\S]*\};[\s\S]*for \(const sourceId of moveSources\)[\s\S]*await __tmQueueTaskRowMove/,
    'only non-child multi-select moves may retain the serial anchor path');
assert.match(batchMoveQueue, /type: 'batchMoveTasks',[\s\S]*taskIds: ids,[\s\S]*snapshots,[\s\S]*sourceDocIds/,
    'the batch queue must reserve one operation with every selected task and source document');
assert.match(apiRuntime, /if \(type === 'batchMoveTasks'\)[\s\S]*action: 'batchMove',[\s\S]*rawItems\.length !== payload\.taskIds\.length/,
    'the mutation executor must require a complete Kernel acknowledgement for the batch');
assert.match(apiRuntime, /if \(type === 'batchMoveTasks'\)[\s\S]*results\.forEach\(\(item, index\)[\s\S]*type: 'moveTask',[\s\S]*__tmCommitQueuedOp\(moveOp, item\)/,
    'a committed batch must reuse the established per-task move projection path');
assertAwaitedBeforeSuccess(rowDrop, 'await __tmHandleTaskRowDropCore(', 'hint(successText', 'task-row move');
assert.match(docTabDrop, /await moveTask\([\s\S]*wait: true/);
assert.match(docTabDrop, /wait: true,[\s\S]*showErrorHint: false/);
assertAwaitedBeforeSuccess(docTabDrop, 'await moveTask(', "hint('✅ 任务已移动'", 'document-tab move');

assert.doesNotMatch(headingCreate, /wait: false/);
assertAwaitedBeforeSuccess(headingCreate, 'await Promise.allSettled(', 'hint(taskLines.length', 'heading-group create');
assert.match(headingCreate, /showErrorHint: false/);
assert.match(headingCreate, /createFailures\.length > 0[\s\S]*已创建 \$\{createdTaskIds\.length\} 个任务，\$\{createFailures\.length\} 个失败/);
assert.match(subtaskCreate, /await Promise\.allSettled\([\s\S]*wait: true/);
assertAwaitedBeforeSuccess(subtaskCreate, 'await Promise.allSettled(', 'hint(taskLines.length', 'subtask create');
assert.match(subtaskCreate, /createFailures\.length > 0[\s\S]*已新增 \$\{successCount\} 个子任务，\$\{createFailures\.length\} 个失败/);
assert.match(siblingCreate, /await __tmQueueCreateSiblingTask\([\s\S]*wait: true/);
assertAwaitedBeforeSuccess(siblingCreate, 'await __tmQueueCreateSiblingTask(', "hint('✅ 同级任务已创建'", 'sibling create');
assert.match(quickAddCreate, /createTaskInDoc\(\{[\s\S]*wait: true/);
assertAwaitedBeforeSuccess(quickAddCreate, 'await Promise.allSettled(createContents', 'hint(payload.contents.length', 'quick add');
assert.match(quickAddCreate, /showErrorHint: false/);
assert.match(quickAddCreate, /createFailures\.length > 0[\s\S]*已创建 \$\{createdTaskIds\.length\} 个任务，\$\{createFailures\.length\} 个失败/);

assert.match(kanbanChildCandidate, /__tmCanHandleTaskRowBatchDrop\(sourceIds, targetId\)/, 'kanban child-drop eligibility must validate the full selected task set');
assert.match(kanbanChildCandidate, /sourceIds: sourceIds\.slice\(\)[\s\S]*activeSourceIds\.join\('\\n'\) !== sourceKey/, 'kanban child-drop hold state must retain and revalidate the same selected task set');
assert.doesNotMatch(kanbanChildCandidate, /sourceIds\.length !== 1/, 'kanban child-drop eligibility must not collapse multi-select drags to one task');
assert.match(kanbanDragStart, /const dragTaskIds = __tmBuildTaskDragSelectionIds\(taskId\);[\s\S]*state\.__tmKanbanDragIds = sourceIds;/, 'native kanban dragging must retain the selected task roots');
assert.match(kanbanDragStart, /setData\('application\/x-tm-task-ids', JSON\.stringify\(sourceIds\)\)/, 'native kanban dragging must publish all selected task ids');
assert.match(kanbanDrop, /const draggedIds = __tmGetDraggedTaskIds\(ev\);[\s\S]*await __tmHandleTaskRowDropCore\(ev, targetId, 'child'\)/, 'kanban child drops must reuse the settled batch row-move core');
assert.match(kanbanDrop, /const batchCount = Math\.max\(1, Number\(result\?\.batchCount\) \|\| 0\);[\s\S]*hint\(batchCount > 1/, 'kanban child-drop success must report the settled batch count');
assert.match(kanbanDrop, /let movingHint = hint\([\s\S]*正在移动[\s\S]*await __tmHandleTaskRowDropCore/, 'kanban child drops must show progress before waiting for the settled batch move');
assert.match(kanbanDrop, /finally \{[\s\S]*__tmRemoveHint\(movingHint\);[\s\S]*__tmClearMultiTaskSelection\(\{ keepMode: true \}\)/, 'kanban child drops must dismiss progress and clear selected tasks after every terminal outcome');
assert.doesNotMatch(kanbanDrop, /baseIds\.length === 1/, 'kanban child drops must not require a single source task');

assert.match(floatingPriorityDrop, /await window\.tmSetTaskPriority\([\s\S]*wait: true/);
assertAwaitedBeforeSuccess(floatingPriorityDrop, 'await window.tmSetTaskPriority(', 'toast(`✅ 重要性已更新', 'floating calendar priority');
assert.match(floatingDateDrop, /await window\.tmUpdateTaskDates\([\s\S]*wait: true,[\s\S]*showErrorHint: false/);
assertAwaitedBeforeSuccess(floatingDateDrop, 'await window.tmUpdateTaskDates(', 'toast(`✅ 截止日期已更新', 'floating calendar due date');
assert.match(allDayDueDateDrop, /await window\.tmUpdateTaskDates\([\s\S]*wait: true,[\s\S]*showErrorHint: false/);
assertAwaitedBeforeSuccess(allDayDueDateDrop, 'await window.tmUpdateTaskDates(', 'toast(`✅ 截止日期已更新', 'all-day calendar due date');
const priorityBackgroundBranch = priorityFieldEntry.slice(priorityFieldEntry.indexOf('Promise.resolve(result).catch'));
const completionTimeBackgroundBranch = completionTimeFieldEntry.slice(completionTimeFieldEntry.indexOf('Promise.resolve(result).catch'));
assert.doesNotMatch(priorityBackgroundBranch, /✅|['"]success['"]/,
    'background priority updates must not report enqueue as success');
assert.doesNotMatch(completionTimeBackgroundBranch, /✅|['"]success['"]/,
    'background due-date updates must not report enqueue as success');

assert.match(lifecycle, /function __tmCleanup\(\)[\s\S]*pendingRefs[\s\S]*mutation-pending-on-unload/,
    'runtime cleanup must report mutations that are still pending at unload');

function createDeferred() {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

async function waitForCallCount(calls, expected) {
    for (let attempt = 0; attempt < 20 && calls.length < expected; attempt += 1) {
        await new Promise((resolve) => setImmediate(resolve));
    }
    assert.equal(calls.length, expected);
}

async function verifyMultiSelectChildMoveSettlement() {
    const calls = [];
    let moveDeferred = createDeferred();
    class HTMLElement {}
    const context = {
        HTMLElement,
        globalThis: null,
        state: { collapsedTaskIds: new Set() },
        __tmGetDraggedTaskIds: () => ['task-a', 'task-b', 'task-c'],
        __tmCanHandleTaskRowBatchDrop: (ids) => ({ ok: true, sourceIds: ids }),
        __tmResolveTaskRowOrDropGapFromTarget: () => null,
        __tmGetTaskDropCapabilities: () => ({ before: true, child: true, after: true }),
        __tmResolveTaskRowDropIntent: () => 'child',
        __tmNormalizeTaskRowDropKind: (kind) => kind,
        __tmApplyTaskRowDropIndicator() {},
        __tmFilterDraggedTaskRootIds: (ids) => ids.slice(),
        __tmEnsureTaskRowDropTaskById: async (id) => ({ id }),
        __tmTaskSupportsRowDrop: () => true,
        __tmIsTaskInSubtree: () => false,
        __tmEnsureEditableTaskLike: () => true,
        __tmGetCurrentRule: () => null,
        __tmRuleUsesCustomOrderSort: () => false,
        __tmBuildTaskRowMovePayload: async (sourceId, targetId, kind) => ({ sourceId, targetTaskId: targetId, mode: kind }),
        __tmQueueTaskRowMove: async () => { throw new Error('serial move must not run'); },
    };
    context.globalThis = context;
    context.__tmRequireTaskMutation = (method) => {
        assert.equal(method, 'batchMoveTasks');
        return (ids, payload, options) => {
            calls.push({ ids: ids.slice(), payload: { ...payload }, options: { ...options } });
            return moveDeferred.promise;
        };
    };
    vm.runInNewContext(`${rowDropCore}\nthis.handleRowDrop = __tmHandleTaskRowDropCore;`, context);
    const dropPromise = context.handleRowDrop({ currentTarget: new HTMLElement() }, 'parent-task', 'child');
    await waitForCallCount(calls, 1);
    assert.deepEqual(calls[0].ids, ['task-a', 'task-b', 'task-c']);
    assert.equal(calls[0].payload.targetTaskId, 'parent-task');
    assert.equal(calls[0].payload.mode, 'child');
    assert.equal(calls[0].options.wait, true);
    moveDeferred.resolve({ results: [{}, {}, {}] });
    const result = await dropPromise;
    assert.equal(result.batchCount, 3);

    calls.length = 0;
    moveDeferred = createDeferred();
    const failedDrop = context.handleRowDrop({ currentTarget: new HTMLElement() }, 'parent-task', 'child');
    await waitForCallCount(calls, 1);
    moveDeferred.reject(new Error('move failed'));
    await assert.rejects(
        failedDrop,
        /move failed/,
    );
    assert.equal(calls.length, 1, 'a failed batch must not continue with per-task writes');
}

async function verifyKanbanChildDropSettlement() {
    class Element {
        closest(selector) {
            if (selector === '[data-tm-kb-drop-kind]') return null;
            if (selector === '.tm-kanban-col') return this;
            return null;
        }
    }
    const dropHost = new Element();
    dropHost.dataset = { kind: 'status', status: 'todo' };
    const events = [];
    let moveDeferred = createDeferred();
    const context = {
        Element,
        window: {},
        state: { modal: null },
        SettingsStore: { data: { kanbanDragSyncSubtasks: false, kanbanShowDoneColumn: false } },
        __tmTakeReadyKanbanChildDropTarget: () => ({
            sourceId: 'task-a',
            sourceIds: ['task-a', 'task-b', 'task-c'],
            targetId: 'parent-task',
        }),
        __tmResolveKanbanDropHost: () => dropHost,
        __tmKanbanClearSurfaceDragOver() {},
        __tmGetDraggedTaskIds: () => ['task-a', 'task-b', 'task-c'],
        __tmGetKanbanBoardMode: () => 'status',
        __tmCanHandleTaskRowBatchDrop: (ids) => ({ ok: true, sourceIds: ids }),
        __tmKanbanGetTaskById: (id) => ({ id, parentTaskId: id === 'parent-task' ? '' : 'old-parent' }),
        __tmKanbanGetParentTaskId: (task) => task.parentTaskId,
        __tmRememberKanbanViewScroll() {},
        __tmKanbanGetCollapsedSet: () => new Set(),
        __tmKanbanPersistCollapsed() {},
        __tmHandleTaskRowDropCore: () => moveDeferred.promise,
        hint: (message, type) => {
            const marker = { message, type };
            events.push({ kind: 'hint', message, type });
            return marker;
        },
        __tmRemoveHint: (marker) => {
            if (marker) events.push({ kind: 'remove', message: marker.message });
        },
        __tmClearMultiTaskSelection: (options) => events.push({ kind: 'clear', keepMode: options?.keepMode === true }),
    };
    vm.runInNewContext(kanbanDrop + '\nthis.kanbanDrop = window.tmKanbanDrop;', context);
    const event = {
        preventDefault() {},
        stopPropagation() {},
        dataTransfer: {
            getData(type) {
                return type === 'text/plain' ? 'task-a' : '';
            },
        },
    };

    const dropPromise = context.kanbanDrop(event);
    assert.deepEqual(events, [{ kind: 'hint', message: '正在移动 3 个任务...', type: 'info' }]);
    moveDeferred.resolve({ kind: 'child', batchCount: 3 });
    await dropPromise;
    assert.deepEqual(events, [
        { kind: 'hint', message: '正在移动 3 个任务...', type: 'info' },
        { kind: 'remove', message: '正在移动 3 个任务...' },
        { kind: 'hint', message: '✅ 已将 3 个任务设为子任务', type: 'success' },
        { kind: 'clear', keepMode: true },
    ]);

    events.length = 0;
    moveDeferred = createDeferred();
    const failedDrop = context.kanbanDrop(event);
    moveDeferred.reject(new Error('move failed'));
    await failedDrop;
    assert.deepEqual(events, [
        { kind: 'hint', message: '正在移动 3 个任务...', type: 'info' },
        { kind: 'remove', message: '正在移动 3 个任务...' },
        { kind: 'hint', message: '❌ 移动失败: move failed', type: 'error' },
        { kind: 'clear', keepMode: true },
    ]);
}

Promise.resolve().then(async () => {
    await verifyMultiSelectChildMoveSettlement();
    await verifyKanbanChildDropSettlement();
}).then(() => {
    console.log('mutation success acknowledgement contract tests passed');
}).catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
