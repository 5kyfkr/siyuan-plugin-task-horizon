'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const renderRuntime = read('src/task-horizon/main/40-render-runtime.js');
const settingsActions = read('src/task-horizon/main/settings/70-doc-group-and-settings-actions.js');
const uiFoundation = read('src/task-horizon/main/30-dialogs-and-ui-foundation.js');
const runtimeState = read('src/task-horizon/main/32-runtime-state-and-events.js');
const runtimeServices = read('src/task-horizon/main/20-api-and-runtime-services.js');
const stores = read('src/task-horizon/main/10-stores-rules-and-cache.js');
const taskLoader = read('src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js');
const taskProjectionRuntime = read('src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js');
const taskCreateRuntime = read('src/task-horizon/main/task-runtime/53b-task-create-and-quick-add-runtime.js');
const checklistRenderer = read('src/task-horizon/main/render/42-render-list-and-checklist-body.js');
const kanbanRenderer = read('src/task-horizon/main/render/43-render-timeline-kanban-calendar-body.js');
const styles = read('task-horizon.css');

const segment = (source, start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(from, -1, `missing segment start: ${start}`);
    assert.notEqual(to, -1, `missing segment end: ${end}`);
    return source.slice(from, to);
};

const ganttScaleControls = segment(renderRuntime, 'function __tmRerenderTimelineScaleInPlace', 'window.tmGanttFit = function()');
assert.match(ganttScaleControls, /__tmRerenderTimelineInPlace\(state\.modal, \{ reuseLeftRows: true \}\)/, 'timeline scale controls must redraw only the timeline stage');
assert.match(ganttScaleControls, /__tmSyncTimelineToolbarStateInPlace\(state\.modal\)/, 'timeline scale controls must update their toolbar without rebuilding the shell');
assert.match(ganttScaleControls, /window\.tmGanttSetScale[\s\S]*__tmRerenderTimelineScaleInPlace\(\)/, 'day, week, and month switches must use the isolated timeline redraw');
assert.match(ganttScaleControls, /window\.tmGanttZoomIn[\s\S]*__tmRerenderTimelineScaleInPlace\(\)[\s\S]*window\.tmGanttZoomOut[\s\S]*__tmRerenderTimelineScaleInPlace\(\)/, 'timeline zoom controls must share the isolated redraw');
assert.doesNotMatch(ganttScaleControls, /__tmScheduleViewRefresh|__tmRerenderCurrentViewInPlace|__tmRequestCalendarRefresh|\brender\s*\(/, 'timeline scale controls must not enter a generic view or calendar refresh');

const ganttFit = segment(renderRuntime, 'window.tmGanttFit = function()', 'window.tmGanttExtendRange');
assert.match(ganttFit, /__tmRerenderTimelineInPlace\(state\.modal, \{ reuseLeftRows: true \}\)/, 'fit must redraw only the timeline stage');
assert.match(ganttFit, /__tmSyncTimelineToolbarStateInPlace\(state\.modal\)/, 'fit must update scale and zoom controls without rebuilding the shell');
assert.doesNotMatch(ganttFit, /__tmScheduleViewRefresh|__tmRerenderCurrentViewInPlace|__tmRequestCalendarRefresh|\brender\s*\(/, 'fit must not enter a generic view or calendar refresh');

const collapseAllHandler = segment(settingsActions, 'window.tmCollapseAllTasks = async function()', 'window.tmExpandAllTasks = async function()');
const expandAllHandler = segment(settingsActions, 'window.tmExpandAllTasks = async function()', 'window.closeSettings = function()');
const collapseAll = segment(collapseAllHandler, "if (state.viewMode === 'kanban' || state.viewMode === 'whiteboard')", 'const filteredSet');
const expandAll = segment(expandAllHandler, "if (state.viewMode === 'kanban' || state.viewMode === 'whiteboard')", 'state.collapsedTaskIds = new Set()');
for (const [label, source] of [['collapse', collapseAll], ['expand', expandAll]]) {
    assert.match(source, /state\.viewMode === 'kanban'\) __tmSyncKanbanCollapseStateInDom\(state\.modal\)/, `${label} must update the mounted kanban nodes directly`);
    assert.doesNotMatch(source, /__tmRerenderKanbanInPlace|__tmRerenderCurrentViewInPlace|__tmScheduleViewRefresh|__tmRequestCalendarRefresh|\brender\s*\(/, `${label} must not redraw the kanban or plugin shell`);
}

const kanbanTaskCollapse = segment(renderRuntime, 'window.tmKanbanToggleCollapse = function(id, ev)', 'window.tmKanbanToggleColumnCollapse');
assert.match(kanbanTaskCollapse, /__tmSetKanbanTaskCollapsedInDom\(tid, collapsed, state\.modal, \{ animate: true \}\)/, 'user task collapse must animate the mounted card branch');
assert.doesNotMatch(kanbanTaskCollapse, /__tmRerenderKanbanInPlace|__tmRerenderCurrentViewInPlace|__tmScheduleViewRefresh|\brender\s*\(/, 'task collapse must not redraw the kanban');

const kanbanColumnCollapse = segment(renderRuntime, 'window.tmKanbanToggleColumnCollapse = function(key, ev)', 'window.tmKanbanCardDblClick');
assert.match(kanbanColumnCollapse, /__tmSetKanbanColumnCollapsedInDom\(colKey, collapsed, state\.modal\)/, 'column collapse must update the mounted column');
assert.doesNotMatch(kanbanColumnCollapse, /__tmRerenderKanbanInPlace|__tmRerenderCurrentViewInPlace|__tmScheduleViewRefresh|\brender\s*\(/, 'column collapse must not redraw the kanban');
assert.doesNotMatch(renderRuntime, /__tmKanbanPendingSnapColumnKey/, 'the removed column rerender snap state must not remain as dead code');

const groupCollapse = segment(settingsActions, 'window.tmToggleGroupCollapse = async function(groupKey, ev)', 'window.tmToggleCollapse = async function(id, ev)');
const kanbanGroupCollapse = segment(groupCollapse, 'if (isKanban) {', 'if (isChecklist) {');
assert.match(kanbanGroupCollapse, /__tmSetKanbanGroupCollapsedInDom\(k0, action === 'collapse', state\.modal, \{ animate: true \}\)/, 'user group collapse must animate the mounted group');
assert.doesNotMatch(kanbanGroupCollapse, /__tmRerenderKanbanInPlace|__tmRerenderCurrentViewInPlace|__tmScheduleViewRefresh|\brender\s*\(/, 'kanban group collapse must not redraw the kanban');

assert.match(kanbanRenderer, /const childrenHtml = childList\.length[\s\S]*?childList\.map\(ch => renderTree\(/, 'collapsed task descendants must remain mounted for direct expansion');
assert.match(kanbanRenderer, /data-tm-kanban-subtasks-list aria-hidden=/, 'task branches must expose a direct visibility target');
assert.match(kanbanRenderer, /const renderKanbanGroupItems = /, 'kanban groups must keep a mounted group body');
assert.doesNotMatch(kanbanRenderer, /(?:doneCollapsed|pinnedIsCollapsed|h2Collapsed|isCollapsed) \? '' : `<div class="tm-kanban-group-items"/, 'collapsed kanban groups must not omit their body');
assert.match(kanbanRenderer, /data-tm-kanban-column-expanded-content/, 'expanded column content must remain mounted');
assert.match(kanbanRenderer, /data-tm-kanban-column-collapsed-content/, 'collapsed column header must remain mounted');
assert.doesNotMatch(kanbanRenderer, /data-tm-kanban-(?:collapsed|column-collapsed)=/, 'write-only kanban state attributes must not return');
assert.doesNotMatch(kanbanRenderer, /data-tm-kanban-(?:expanded-(?:width|min-width|max-width|flex)|collapsed-width)=/, 'column sizing must stay in CSS instead of write-only data attributes');
assert.doesNotMatch(kanbanRenderer, /__tmKanbanGetCollapsedColumnSet\(\)\.has\(columnKey\)/, 'progressive loading must finish a mounted column even while it is hidden');
assert.match(styles, /\[data-tm-kanban-column-expanded-content\]\[hidden\][\s\S]*display: none !important;/, 'mounted kanban alternatives must honor hidden even when component display rules are more specific');
assert.equal((styles.match(/^\s*width: var\(--tm-kanban-collapsed-col-width\)/gm) || []).length, 1, 'collapsed column width must have a single CSS source of truth');
assert.match(checklistRenderer, /const indent = checklistCompact \? depth \* 14 : depth \* 22;/, 'compact checklist hierarchy must keep its 14px indent reference');
assert.match(styles, /\.tm-kanban\.tm-kanban--clean\s*\{\s*--tm-kanban-subtask-indent:\s*14px;/, 'kanban subtasks must use the compact checklist hierarchy distance without changing whiteboard spacing');
assert.equal((styles.match(/padding:\s*[45]px 2px [45]px var\(--tm-kanban-subtask-indent\);/g) || []).length, 2, 'regular and compact kanban subtask rows must share the hierarchy indent token');
assert.match(styles, /\.tm-kanban\.tm-kanban--clean \.tm-kanban-subtask-row-main\s*\{\s*align-items:\s*center;/, 'kanban subtask contents must be vertically centered without changing whiteboard alignment');
assert.match(styles, /\.tm-kanban\.tm-kanban--clean \.tm-kanban-subtask-row-main > \.tm-task-checkbox-wrap,\s*\.tm-kanban\.tm-kanban--clean \.tm-kanban-subtask-row-main > \.tm-task-checkbox-wrap \.tm-task-checkbox\s*\{\s*margin-top:\s*0;/, 'kanban subtask checkbox wrappers and inputs must not retain the font-size offset while their row is vertically centered');
assert.match(
    styles,
    /\.tm-modal\.tm-modal--mobile \.tm-body\.tm-body--kanban \.tm-kanban-col:not\(\.tm-kanban-col--collapsed\)[\s\S]*\[data-tm-host-mode="dock"\] \.tm-body\.tm-body--kanban \.tm-kanban-col:not\(\.tm-kanban-col--collapsed\)/,
    'mobile and dock full-width columns must exclude collapsed kanban columns',
);
const kanbanBottomNavAvoidance = segment(renderRuntime, 'function __tmSyncKanbanBottomNavAvoidance', 'function __tmScheduleKanbanBottomNavAvoidance');
assert.match(
    kanbanBottomNavAvoidance,
    /currentAvoidanceInset[\s\S]*paddingBottom - basePadding[\s\S]*availableHeightWithoutAvoidance = Math\.max\(0, availableHeight - currentAvoidanceInset\)[\s\S]*contentHeight > availableHeightWithoutAvoidance \+ 1/,
    'bottom-nav avoidance measurements must exclude their own padding to prevent resize feedback loops',
);

const queueRowMove = segment(uiFoundation, 'async function __tmQueueTaskRowMove', 'async function __tmHandleTaskRowDropCore');
const rowDropCore = segment(uiFoundation, 'async function __tmHandleTaskRowDropCore', 'window.tmTaskRowDragOver');
const optimisticMove = segment(taskCreateRuntime, 'function __tmApplyMoveOptimisticLocal', 'function __tmRollbackMoveOptimisticLocal');
const runtimeMove = segment(runtimeState, 'const moveTaskLocal =', 'const deleteTaskLocal =');
const queuedMove = segment(taskLoader, 'function __tmQueueMoveTask', 'function __tmGetTaskForDetachSubtask');
const structuralProjection = segment(runtimeServices, 'function __tmRefreshQueuedStructuralProjection', 'function __tmCommitQueuedOp');
const checklistProjectionReconcile = segment(runtimeServices, 'function __tmReconcileChecklistProjectionCard', 'function __tmRerenderChecklistInPlace');
const checklistRerender = segment(runtimeServices, 'function __tmRerenderChecklistInPlace', 'function __tmGetKanbanColScrollKey');
const kanbanRerender = segment(runtimeServices, 'function __tmRerenderKanbanInPlace', 'function __tmRerenderWhiteboardInPlace');
const incrementalRefresh = segment(stores, 'async function __tmRefreshAffectedDocsIncrementally', 'async function __tmFlushSqlTransactionsSafe');
assert.match(queueRowMove, /payload\.preserveRenderWindow = true/, 'row drops must preserve an already-grown list render window');
assert.doesNotMatch(queueRowMove, /forceOptimisticRender|deferOptimisticRender|skipOptimisticFilterWork|__tmCanUseLightweightMoveProjection/,
    'row drops must not select a second projection strategy');
assert.doesNotMatch(queueRowMove, /onQueued|forceFullReconcile|__tmScheduleTaskRowDropReconcileRefresh/,
    'physical row drops must not schedule a competing reconciliation');
assert.doesNotMatch(rowDropCore, /forceOptimisticRender/, 'row-drop core must leave the optimistic redraw to the mutation projection manager');
assert.doesNotMatch(uiFoundation, /function __tmScheduleTaskRowDropReconcileRefresh/, 'the duplicate legacy row-drop refresh path must be removed');
assert.match(optimisticMove, /__tmRemoveTaskFromLocalState[\s\S]*__tmApplyMovePayloadToTaskRecursive[\s\S]*__tmRebuildLocalDocTree/,
    'optimistic moves must update the canonical local tree before projection');
assert.doesNotMatch(optimisticMove, /applyFilters|filteredTasks|__tmScheduleViewRefresh|__tmScheduleRender|__tmRerenderCurrentViewInPlace|requestAnimationFrame/,
    'the move state transition must not own filtering or rendering');
const simpleOptimisticPresentation = segment(runtimeServices, 'function __tmApplySimpleOptimisticPresentation', 'function __tmDoesMutationStillOwnLocalWatermark');
assert.match(simpleOptimisticPresentation, /__tmApplyQueuedOpOptimistic\(op\)/,
    'the mutation service must apply one canonical optimistic state transition');
assert.doesNotMatch(simpleOptimisticPresentation, /applyFilters|__tmScheduleViewRefresh|__tmScheduleRender|__tmRerenderCurrentViewInPlace/,
    'the mutation service must leave projection to ProjectionEngine');
assert.match(runtimeMove, /__tmApplyMoveOptimisticLocal\(data\)/,
    'TaskStore must own the move state transition');
assert.doesNotMatch(taskCreateRuntime, /function __tmApplyMoveOptimisticFilteredProjection|function __tmCanUseLightweightMoveProjection/,
    'the removed manual filtered-task move projection must not return');
assert.match(queuedMove, /preserveRenderWindow: data\.preserveRenderWindow === true \|\| hooks\.preserveRenderWindow === true/, 'the move mutation must carry render-window preservation through settlement');
assert.match(structuralProjection, /preserveRenderWindow: type === 'moveTask' && data\.preserveRenderWindow === true/, 'settled move reconciliation must preserve the render window');
assert.match(taskProjectionRuntime, /function __tmRunTaskProjectionBatch[\s\S]*__tmRecomputeTaskProjection\([\s\S]*__tmScheduleViewRefresh/,
    'ProjectionEngine must remain the only move filter and render coordinator');
assert.doesNotMatch(checklistRerender, /setTimeout\(restore/,
    'checklist redraw must not repeat layout restoration through delayed timers');
assert.match(checklistProjectionReconcile, /refreshTaskIds instanceof Set[\s\S]*hierarchyChanged[\s\S]*!affectedIds\.has\(taskId\) && !hierarchyChanged[\s\S]*nextNode\.cloneNode\(true\)/,
    'group projection must replace affected or re-indented rows instead of reusing stale hierarchy markup');
assert.doesNotMatch(kanbanRerender, /setTimeout\(restore/,
    'kanban redraw must not repeat layout restoration through delayed timers');
assert.match(incrementalRefresh, /__tmCaptureViewRenderWindow\(viewMode\)[\s\S]*restoreRenderWindow[\s\S]*__tmRestoreViewRenderWindow/, 'incremental document refresh must restore the captured render window after refiltering');

const childDropSources = [uiFoundation, runtimeState, taskLoader, taskCreateRuntime].join('\n');
assert.doesNotMatch(childDropSources, /subtaskDropTraceId|__tmLogSubtaskDrop|\[Task Horizon\]\[subtask-drop\]|forceOptimisticFilterWork/, 'temporary child-drop diagnostics and snapshot experiments must not remain');

console.log('layout and subtask refresh contract tests passed');
