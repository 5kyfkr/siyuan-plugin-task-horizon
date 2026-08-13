'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');

const rootDir = path.resolve(__dirname, '..');
const detailSource = fs.readFileSync(path.join(rootDir, 'src', 'task-horizon', 'main', 'task-runtime', '52-task-detail-runtime.js'), 'utf8');
const loaderSource = fs.readFileSync(path.join(rootDir, 'src', 'task-horizon', 'main', 'task-runtime', '53-list-render-and-document-loader.js'), 'utf8');

const helperStart = detailSource.indexOf('function __tmGetTaskDetailProjectedDirectChildren(');
const helperEnd = detailSource.indexOf('\n\n    function __tmResolveTaskDetailParentTaskId', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'projected child helper must remain extractable');
const helperSource = detailSource.slice(helperStart, helperEnd);
const taskGetterStart = detailSource.indexOf('function __tmGetTaskDetailTaskById(');
const taskGetterEnd = detailSource.indexOf('\n\n    function __tmGetTaskDetailProjectedDirectChildren', taskGetterStart);
assert.ok(taskGetterStart >= 0 && taskGetterEnd > taskGetterStart, 'task detail getter must remain extractable');
const taskGetterSource = detailSource.slice(taskGetterStart, taskGetterEnd);
assert.match(
    taskGetterSource,
    /'h2', 'h2Name', 'h2Id'[\s\S]*hasOwnProperty\.call\(structuralTask, key\)[\s\S]*merged\[key\] = structuralTask\[key\]/,
    'detail projections must preserve the current structural heading placement instead of applying a stale projected heading',
);

const structuralHeadingTask = {
    id: 'heading-task',
    content: 'Heading task',
    root_id: 'doc-a',
    docId: 'doc-a',
    h2: '二级标题 A',
    h2Name: '二级标题 A',
    h2Id: 'heading-a',
    children: [],
};
const staleProjectedHeadingTask = {
    ...structuralHeadingTask,
    h2: '',
    h2Name: '',
    h2Id: '',
};
const getterContext = {
    state: {},
    __tmResolveTaskDetailEffectiveId: (id) => String(id || '').trim(),
    __tmCountTaskDetailRawSubtasks: () => 0,
    __tmPreferWhiteboardSnapshotForPlaceholderTask: (task) => task,
    __tmGetTaskDetailProjectedDirectChildren: () => [],
    __tmTaskStateKernel: { getTask: () => null },
    __tmBuildTaskDetailWhiteboardSnapshotTask: () => null,
    __tmTaskStore: { getProjected: () => staleProjectedHeadingTask },
    __tmTaskBoundary: { getTask: () => structuralHeadingTask },
};
vm.runInNewContext(`${taskGetterSource}\nglobalThis.readHeadingTask = __tmGetTaskDetailTaskById;`, getterContext);
const resolvedHeadingTask = getterContext.readHeadingTask('heading-task');
assert.equal(resolvedHeadingTask.h2, '二级标题 A', 'opening detail must retain the current heading label');
assert.equal(resolvedHeadingTask.h2Id, 'heading-a', 'opening detail must retain the current heading id');

function buildHarness(rootTask, flatTasks, pendingTasks = {}, projectedPatches = {}) {
    const metrics = {
        listProjectedCalls: 0,
        fullScanVisits: 0,
        getProjectedCalls: 0,
    };
    const normalizeId = (value) => String(value || '').trim();
    const getStructural = (id) => flatTasks[normalizeId(id)] || pendingTasks[normalizeId(id)] || null;
    const getProjected = (id) => {
        metrics.getProjectedCalls += 1;
        const task = getStructural(id);
        if (!task) return null;
        return { ...task, ...(projectedPatches[normalizeId(id)] || {}) };
    };
    const listProjectedDirectChildren = (parentId) => {
        metrics.listProjectedCalls += 1;
        const pid = normalizeId(parentId);
        const children = new Map();
        const add = (candidate, nested = false) => {
            const childId = normalizeId(candidate?.id);
            if (!childId || childId === pid) return;
            const projected = getProjected(childId);
            if (!projected) return;
            const projectedParentId = normalizeId(projected.parentTaskId || projected.parent_task_id);
            if ((!nested || projectedParentId) && projectedParentId !== pid) return;
            children.set(childId, projected);
        };
        const parent = getStructural(pid);
        (Array.isArray(parent?.children) ? parent.children : []).forEach((child) => add(child, true));
        [flatTasks, pendingTasks].forEach((taskMap) => {
            Object.values(taskMap).forEach((candidate) => {
                metrics.fullScanVisits += 1;
                add(candidate, false);
            });
        });
        return Array.from(children.values());
    };
    const context = {
        state: {
            taskTree: [{ tasks: [rootTask] }],
            flatTasks,
            pendingInsertedTasks: pendingTasks,
        },
        __tmResolveTaskDetailEffectiveId: (id) => normalizeId(id),
        __tmTaskStore: {
            resolveId: (id) => normalizeId(id),
            getAliases: (id) => [normalizeId(id)],
            getProjected,
            getFlatMap: () => flatTasks,
            getPendingMap: () => pendingTasks,
            listFlat: () => {
                const values = Object.values(flatTasks);
                metrics.fullScanVisits += values.length;
                return values;
            },
            listPending: () => {
                const values = Object.values(pendingTasks);
                metrics.fullScanVisits += values.length;
                return values;
            },
            listPendingOverlays: () => Object.keys(projectedPatches).map((taskId) => ({ taskIds: [taskId] })),
            listProjectedDirectChildren,
        },
        __tmTaskBoundary: {
            getTask: (id) => getStructural(id),
        },
    };
    vm.runInNewContext(`${helperSource}\nglobalThis.runProjectedChildren = __tmGetTaskDetailProjectedDirectChildren;`, context);
    return { context, metrics };
}

const childCount = 600;
const largeChildren = Array.from({ length: childCount }, (_, index) => ({
    id: `child-${index}`,
    parentTaskId: 'root',
    content: `Child ${index}`,
    children: [],
}));
const largeRoot = { id: 'root', content: 'Root', children: largeChildren };
const largeFlatTasks = Object.fromEntries([largeRoot, ...largeChildren].map((task) => [task.id, task]));
const largeHarness = buildHarness(largeRoot, largeFlatTasks);
const startedAt = performance.now();
const largeResult = largeHarness.context.runProjectedChildren(largeRoot, { structuralTask: largeRoot });
const elapsedMs = performance.now() - startedAt;
assert.equal(largeResult.length, childCount, 'all direct children must remain available');
assert.ok(
    largeHarness.metrics.fullScanVisits === 0,
    `an unchanged ${childCount}-child detail must not scan unrelated task maps; got ${largeHarness.metrics.fullScanVisits} visits in ${elapsedMs.toFixed(2)} ms`,
);
assert.ok(
    largeHarness.metrics.getProjectedCalls <= childCount + 1,
    `each projected child should be read at most once; got ${largeHarness.metrics.getProjectedCalls} reads`,
);
const cachedRoot = { ...largeRoot, children: largeResult };
const cachedVisits = largeHarness.metrics.fullScanVisits;
const cachedReads = largeHarness.metrics.getProjectedCalls;
assert.strictEqual(
    largeHarness.context.runProjectedChildren(cachedRoot, { structuralTask: largeRoot }),
    largeResult,
    'an already projected detail tree must be reused within the same render session',
);
assert.equal(largeHarness.metrics.fullScanVisits, cachedVisits, 'reusing a projected tree must not rescan task maps');
assert.equal(largeHarness.metrics.getProjectedCalls, cachedReads, 'reusing a projected tree must not reread child projections');

const childC = { id: 'c', parentTaskId: 'b', content: 'C', children: [] };
const childA = { id: 'a', parentTaskId: 'small-root', content: 'A', children: [] };
const childB = { id: 'b', parentTaskId: 'small-root', content: 'B', children: [childC] };
const smallRoot = { id: 'small-root', content: 'Small root', children: [childA, childB] };
const pendingD = { id: 'd', parentTaskId: 'b', content: 'D', children: [] };
const smallFlatTasks = Object.fromEntries([smallRoot, childA, childB, childC].map((task) => [task.id, task]));
const smallHarness = buildHarness(smallRoot, smallFlatTasks, { d: pendingD }, {
    a: { parentTaskId: 'b', content: 'A projected' },
    c: { done: true },
});
const smallResult = smallHarness.context.runProjectedChildren(smallRoot, { structuralTask: smallRoot });
assert.deepEqual(Array.from(smallResult, (task) => task.id), ['b'], 'moved children must leave their structural parent');
assert.deepEqual(Array.from(smallResult[0].children, (task) => task.id), ['c', 'a', 'd'], 'native, moved, and pending children must keep deterministic order');
assert.equal(smallResult[0].children[0].done, true, 'projected child fields must be applied');
assert.equal(smallResult[0].children[1].content, 'A projected', 'moved child projections must be applied');

const toggleStart = loaderSource.indexOf('window.tmToggleTaskDetailCompletedSubtasks = function(');
const toggleEnd = loaderSource.indexOf('\n\n    // 辅助：手动插入任务到树中', toggleStart);
assert.ok(toggleStart >= 0 && toggleEnd > toggleStart, 'completed-subtask toggle must remain extractable');
const toggleSource = loaderSource.slice(toggleStart, toggleEnd);
assert.match(toggleSource, /__tmProjectVisibleTaskDetailSubtasks/, 'completed-subtask visibility must project mounted subtask lists in place');
assert.doesNotMatch(toggleSource, /forceRebuild:\s*true|__tmRerenderCurrentViewInPlace|\brender\s*\(/, 'completed-subtask visibility must not rebuild the detail or current view');

const kanbanOpenStart = detailSource.indexOf('function __tmOpenKanbanDetailFloatingInPlace(');
const kanbanOpenEnd = detailSource.indexOf('\n\n    function __tmChecklistUseSheetMode', kanbanOpenStart);
assert.ok(kanbanOpenStart >= 0 && kanbanOpenEnd > kanbanOpenStart, 'kanban detail open path must remain extractable');
const kanbanOpenSource = detailSource.slice(kanbanOpenStart, kanbanOpenEnd);
assert.match(kanbanOpenSource, /opts\.task[\s\S]*__tmBuildTaskDetailInnerHtml[\s\S]*__tmBindTaskDetailEditor/, 'kanban detail open must reuse the task snapshot already resolved by the caller');
const initialBindAt = kanbanOpenSource.indexOf("source: 'kanban-detail-open-in-place'");
assert.ok(initialBindAt >= 0, 'kanban detail initial bind must remain identifiable');
assert.match(kanbanOpenSource.slice(initialBindAt), /__tmBindKanbanDetailFloatingHandlers\(modal\)/, 'kanban detail open must bind outside-close handlers after the first mount');
assert.doesNotMatch(kanbanOpenSource.slice(initialBindAt), /__tmRefreshKanbanDetailInPlace/, 'kanban detail open must not immediately rebuild and rebind the panel it just mounted');

const floatingHandlersStart = detailSource.indexOf('function __tmBindKanbanDetailFloatingHandlers(');
const floatingHandlersEnd = detailSource.indexOf('\n\n    async function __tmCloseKanbanDetailFloating', floatingHandlersStart);
assert.ok(floatingHandlersStart >= 0 && floatingHandlersEnd > floatingHandlersStart, 'kanban floating handlers must remain extractable');
const floatingHandlersSource = detailSource.slice(floatingHandlersStart, floatingHandlersEnd);
assert.match(floatingHandlersSource, /__tmClearKanbanDetailFloatingHandlers\(\)/, 'rebinding must remove stale floating handlers first');
assert.match(floatingHandlersSource, /document, 'pointerdown'[\s\S]*document, 'click'/, 'outside-close handling must track pointer origin and the following click');
assert.match(floatingHandlersSource, /__tmCloseKanbanDetailFloating\(\)/, 'an outside click must close the kanban detail float');

const reconcileStart = loaderSource.indexOf('function __tmScheduleTaskDetailDocumentReconcile(');
const reconcileEnd = loaderSource.indexOf('\n\n    window.tmOpenTaskDetail', reconcileStart);
assert.ok(reconcileStart >= 0 && reconcileEnd > reconcileStart, 'detail background reconcile must remain extractable');
const reconcileSource = loaderSource.slice(reconcileStart, reconcileEnd);
assert.match(reconcileSource, /requestIdleCallback\(run, \{ timeout: 1200 \}\)/, 'background detail reconciliation must yield the initial render to the browser');
assert.match(reconcileSource, /__tmProjectVisibleTaskDetailSubtasks[\s\S]*patch:[\s\S]*content: true/, 'background reconciliation must update the mounted detail in place');
assert.doesNotMatch(reconcileSource, /forceRebuild:\s*true/, 'background reconciliation must not rebuild a large mounted detail');

console.log(`task detail subtask performance contract passed (${childCount} children in ${elapsedMs.toFixed(2)} ms, ${largeHarness.metrics.fullScanVisits} full-scan visits)`);
