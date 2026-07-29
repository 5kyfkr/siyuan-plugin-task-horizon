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
const taskLoader = read('src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js');
const taskCreateRuntime = read('src/task-horizon/main/task-runtime/53b-task-create-and-quick-add-runtime.js');
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
assert.match(kanbanTaskCollapse, /__tmSetKanbanTaskCollapsedInDom\(tid, collapsed, state\.modal\)/, 'task collapse must update the mounted card branch');
assert.doesNotMatch(kanbanTaskCollapse, /__tmRerenderKanbanInPlace|__tmRerenderCurrentViewInPlace|__tmScheduleViewRefresh|\brender\s*\(/, 'task collapse must not redraw the kanban');

const kanbanColumnCollapse = segment(renderRuntime, 'window.tmKanbanToggleColumnCollapse = function(key, ev)', 'window.tmKanbanCardDblClick');
assert.match(kanbanColumnCollapse, /__tmSetKanbanColumnCollapsedInDom\(colKey, collapsed, state\.modal\)/, 'column collapse must update the mounted column');
assert.doesNotMatch(kanbanColumnCollapse, /__tmRerenderKanbanInPlace|__tmRerenderCurrentViewInPlace|__tmScheduleViewRefresh|\brender\s*\(/, 'column collapse must not redraw the kanban');
assert.doesNotMatch(renderRuntime, /__tmKanbanPendingSnapColumnKey/, 'the removed column rerender snap state must not remain as dead code');

const groupCollapse = segment(settingsActions, 'window.tmToggleGroupCollapse = async function(groupKey, ev)', 'window.tmToggleCollapse = async function(id, ev)');
const kanbanGroupCollapse = segment(groupCollapse, 'if (isKanban) {', 'if (isChecklist) {');
assert.match(kanbanGroupCollapse, /__tmSetKanbanGroupCollapsedInDom\(k0, action === 'collapse', state\.modal\)/, 'group collapse must update the mounted group');
assert.doesNotMatch(kanbanGroupCollapse, /__tmRerenderKanbanInPlace|__tmRerenderCurrentViewInPlace|__tmScheduleViewRefresh|\brender\s*\(/, 'kanban group collapse must not redraw the kanban');

assert.match(kanbanRenderer, /const childrenHtml = childList\.length \? childList\.map/, 'collapsed task descendants must remain mounted for direct expansion');
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
const rowDropReconcile = segment(uiFoundation, 'function __tmScheduleTaskRowDropReconcileRefresh', 'window.tmTaskRowDragOver');
const optimisticMove = segment(taskCreateRuntime, 'function __tmApplyMoveOptimisticLocal', 'function __tmRollbackMoveOptimisticLocal');
assert.match(queueRowMove, /shouldRefreshSubtaskViews = moveKind === 'child' \|\| moveKind === 'child-top'/, 'child drops must keep their existing reconciliation path');
assert.match(queueRowMove, /forceFullReconcile: true/, 'child drops must retain the established settled reconciliation');
assert.match(rowDropReconcile, /__tmScheduleChecklistOptimisticSubtaskRefresh\?\.\(previousParentTaskId, data\?\.taskId\)[\s\S]*__tmScheduleChecklistOptimisticSubtaskRefresh\?\.\(nextParentTaskId, data\?\.taskId\)[\s\S]*__tmScheduleViewRefresh/, 'task-row reconciliation must retain its established refresh architecture');
assert.match(optimisticMove, /mode === 'child' \|\| mode === 'child-top'[\s\S]*__tmScheduleChecklistOptimisticSubtaskRefresh\(payload\?\.targetTaskId, taskId, \{ force: true \}\)[\s\S]*__tmScheduleChecklistOptimisticSubtaskRefresh\(previousParentId, taskId, \{ force: true \}\)/, 'optimistic child moves must bypass detail-panel deferral for both affected checklist groups');

const childDropSources = [uiFoundation, runtimeState, taskLoader, taskCreateRuntime].join('\n');
assert.doesNotMatch(childDropSources, /subtaskDropTraceId|__tmLogSubtaskDrop|\[Task Horizon\]\[subtask-drop\]|forceOptimisticFilterWork/, 'temporary child-drop diagnostics and snapshot experiments must not remain');

console.log('layout and subtask refresh contract tests passed');
