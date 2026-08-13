'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const loaderRuntime = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/task-runtime/53c-document-loader-runtime.js'),
    'utf8',
);
const shellRuntime = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/shell/80-shell-lifecycle.js'),
    'utf8',
);
const projectionRuntime = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js'),
    'utf8',
);
const ruleRuntime = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'),
    'utf8',
);
const listRuntime = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js'),
    'utf8',
);
const kanbanRuntime = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/render/43-render-timeline-kanban-calendar-body.js'),
    'utf8',
);
const whiteboardRuntime = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/render/44-render-whiteboard-body.js'),
    'utf8',
);

function segment(source, startText, endText) {
    const start = source.indexOf(startText);
    const end = source.indexOf(endText, start + startText.length);
    assert.ok(start >= 0 && end > start, 'missing segment: ' + startText);
    return source.slice(start, end);
}

const snapshotFirstPaint = segment(
    loaderRuntime,
    'let snapshotFirstRenderCommitted = false;',
    'const shouldLoadOtherBlocksLater =',
);
const restoreIndex = snapshotFirstPaint.indexOf('restoreViewState?.(');
const projectionIndex = snapshotFirstPaint.indexOf("__tmRecomputeTaskProjection({ reason: 'document-loader' })");
const renderIndex = snapshotFirstPaint.indexOf('renderLoadedState()');

assert.ok(restoreIndex >= 0, 'snapshot first paint must restore the cached view metadata');
assert.ok(projectionIndex > restoreIndex,
    'snapshot first paint must reapply the current rule after restoring cached view metadata');
assert.ok(renderIndex > projectionIndex,
    'snapshot first paint must render only after the current-rule projection is rebuilt');
assert.doesNotMatch(snapshotFirstPaint, /if\s*\(\s*!viewSnapshotMeta\s*\)[\s\S]{0,300}__tmRecomputeTaskProjection/,
    'a cached view order must not bypass current-rule sorting during plugin reload');

const coldOpen = segment(
    shellRuntime,
    'if (quickbarDirty) {',
    'if (shouldForceFreshOpenLoad) {',
);
assert.ok(coldOpen.indexOf('__tmApplyCurrentContextViewProfile({') >= 0,
    'plugin reload must restore the current context rule before loading tasks');
assert.ok(coldOpen.indexOf('__tmApplyCurrentContextViewProfile({') < coldOpen.indexOf('loadSelectedDocuments({'),
    'plugin reload must restore the current context rule before dispatching the initial task load');

const rowModel = segment(
    projectionRuntime,
    'function __tmBuildTaskRowModel()',
    'function __tmResolveFirstVisibleTaskIdFromRowModel',
);
const applyRuleSort = segment(
    ruleRuntime,
    'applyRuleSort(tasks, rule, options = {})',
    '// \u6bd4\u8f83\u503c',
);
assert.match(applyRuleSort, /ctx\.field === 'priorityScore'[\s\S]*?__tmEnsureTaskPriorityScore\(task, \{[\s\S]*?force: true/,
    'priority-score sorting must derive its key from the latest task fields instead of a stale task cache');
const customSortIndex = applyRuleSort.indexOf('for (let i = 0; i < sortRules.length; i += 1)');
const documentTieIndex = applyRuleSort.indexOf('const documentOrder = compareDocumentOrderTie');
assert.ok(customSortIndex >= 0 && documentTieIndex > customSortIndex,
    'user-defined sort keys must run before the document-order tie breaker');
assert.match(rowModel, /const appendCompletedRootGroup = \(\) => \{[\s\S]*?completedRoots\.sort\(\(a, b\) => __tmCompareCompletedTasksRecentFirst/,
    'completed tasks must always use recent-completion order instead of the active rule');
assert.doesNotMatch(rowModel, /const appendCompletedRootGroup = \(\) => \{[\s\S]*?sortRowModelGroupItems\(completedRoots\)/,
    'the row-model completed group must not inherit an explicit rule sort');

const listRender = segment(
    listRuntime,
    'function renderTaskList(',
    'function __tmUpdateDoneMarkdown',
);
assert.match(listRender, /const appendCompletedRootGroup = \(\) => \{[\s\S]*?completedRoots\.sort\(\(a, b\) => __tmCompareCompletedTasksRecentFirst/,
    'list completed groups must always use recent-completion order');
assert.doesNotMatch(listRender, /const appendCompletedRootGroup = \(\) => \{[\s\S]*?sortRenderGroupItems\(completedRoots\)/,
    'legacy list rendering must not apply the active rule inside the completed group');

const kanbanRender = segment(
    kanbanRuntime,
    'function __tmBuildRenderSceneKanbanBodyHtml(',
    'function __tmBuildRenderSceneCalendarBodyHtml',
);
assert.match(kanbanRender, /const completedRecentCompare = \(a, b\) => __tmCompareCompletedTasksRecentFirst\(a, b, rootCompare\);[\s\S]*?roots\.sort\(isCompletedStatusCol \? completedRecentCompare : rootCompare\);[\s\S]*?completedRoots\.sort\(completedRecentCompare\);/,
    'kanban completed groups and completed-status columns must use recent-completion order');
assert.match(kanbanRender, /const renderDoneColumnList = \(\) => \{[\s\S]*?list0\.slice\(\)\.sort\(completedRecentCompare\);/,
    'the dedicated kanban done column must use recent-completion order');
assert.doesNotMatch(kanbanRender, /sortKanbanItemsByCurrentRule\(completedRoots, rootCompare\)/,
    'kanban completed groups must not inherit the active rule sort');
assert.match(whiteboardRuntime, /const completedRootTasks = rootSplit\.done[\s\S]*?__tmCompareCompletedTasksRecentFirst/,
    'whiteboard completed groups must use recent-completion order');
assert.match(projectionRuntime, /function __tmCompareCompletedTasksRecentFirst\([\s\S]*?__tmGetTaskDoneSortTs\(b\) - __tmGetTaskDoneSortTs\(a\)/,
    'the shared completed-task comparator must sort newer completion timestamps first');

console.log('reload current-rule sorting contract tests passed');
