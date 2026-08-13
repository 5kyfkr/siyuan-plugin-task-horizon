'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const storesSource = read('src', 'task-horizon', 'main', '10-stores-rules-and-cache.js');
const coordinatorSource = read('src', 'task-horizon', 'main', 'task-runtime', '51-whiteboard-and-link-runtime.js');
const detailSource = read('src', 'task-horizon', 'main', 'task-runtime', '52-task-detail-runtime.js');
const loaderSource = read('src', 'task-horizon', 'main', 'task-runtime', '53-list-render-and-document-loader.js');
const fieldEditSource = read('src', 'task-horizon', 'main', 'task-runtime', '53a-list-field-edit-runtime.js');
const timeRefreshSource = read('src', 'task-horizon', 'main', 'render', '46-render-local-task-time-refresh.js');

const protectedReloadStart = loaderSource.indexOf('async function reloadDocTasksProtected(');
const protectedReloadEnd = loaderSource.indexOf('\n\n    const __tmFreshTaskDetailDocReloads', protectedReloadStart);
assert.ok(protectedReloadStart >= 0 && protectedReloadEnd > protectedReloadStart,
    'protected document reload must remain extractable');
const protectedReload = loaderSource.slice(protectedReloadStart, protectedReloadEnd);
assert.match(protectedReload, /done: !!parsed\.done/,
    'document markdown marker must remain the authoritative persisted completion state');
assert.doesNotMatch(protectedReload, /done:\s*meta\.done/,
    'cached metadata must not override a document completion marker');
assert.match(protectedReload, /acceptAuthoritative\?\.\(authoritativeTasks,[\s\S]*replaceDocuments: true/,
    'a full document reload must replace the TaskStore confirmation baseline before detail reads it');
assert.match(protectedReload, /opts\.preserveExistingSiblingOrder === true[\s\S]*__tmSortTaskTreeByExistingOrder\(rootTasks, currentDoc\.tasks, siblingOrderRanks\)/,
    'a detail refresh must preserve the mounted document sibling order');
assert.ok(
    protectedReload.indexOf('__tmSortTaskTreeByExistingOrder(rootTasks, currentDoc.tasks, siblingOrderRanks)')
        < protectedReload.indexOf('acceptAuthoritative?.(authoritativeTasks'),
    'document sibling order must be fixed before the TaskStore confirmation baseline is replaced',
);
assert.ok(
    protectedReload.indexOf('acceptAuthoritative?.(authoritativeTasks')
        < protectedReload.indexOf('__tmMergeLocalTaskPatchIntoTaskTree'),
    'authoritative document state must be accepted before pending field projections are reapplied',
);
assert.match(loaderSource, /preserveExistingSiblingOrder: opts\.preserveExistingSiblingOrder !== false/,
    'fresh detail reads must preserve document order unless a caller explicitly requests a structural rank refresh');
assert.match(loaderSource, /const shouldFreshenDetailOpen = detailOpenOptions\.forceFresh === true \|\| isQuickbarDetailOpen;/,
    'explicit fresh and quickbar detail opens must wait for authoritative document data');
assert.match(loaderSource, /const shouldReconcileDetailOpen = detailOpenOptions\.reconcile === true;/,
    'ordinary task detail opens must avoid a document reload unless a caller explicitly requests reconciliation');
assert.match(loaderSource, /function __tmScheduleTaskDetailDocumentReconcile[\s\S]*requestIdleCallback[\s\S]*__tmProjectVisibleTaskDetailSubtasks[\s\S]*__tmRefreshVisibleTaskDetailForTask/,
    'explicit background reconciliation must patch the mounted projection without blocking or rebuilding the initial render');

const detailControllerStart = coordinatorSource.indexOf('        detail: {', coordinatorSource.indexOf('const __tmViewControllers = {'));
const detailControllerEnd = coordinatorSource.indexOf('        timeline: {', detailControllerStart);
assert.ok(detailControllerStart >= 0 && detailControllerEnd > detailControllerStart, 'detail view controller must remain extractable');
const detailController = coordinatorSource.slice(detailControllerStart, detailControllerEnd);
assert.match(
    detailController,
    /__tmRefreshVisibleTaskDetailForTask\(taskId, \{\s*patch: nextPatch,\s*\}\)/,
    'detail field refreshes must preserve the originating patch scope',
);
const detailFieldCommitStart = detailSource.indexOf('const commitDetailFieldPatch =');
const detailFieldCommitEnd = detailSource.indexOf('\n        const setSubtaskContentEditingHold =', detailFieldCommitStart);
assert.ok(detailFieldCommitStart >= 0 && detailFieldCommitEnd > detailFieldCommitStart,
    'direct detail field commit helper must remain extractable');
const detailFieldCommit = detailSource.slice(detailFieldCommitStart, detailFieldCommitEnd);
assert.match(detailFieldCommit, /skipDetailPatch: opts\.skipDetailPatch !== false,[\s\S]*allowMountedInactive: true/,
    'direct detail field commits must refresh the still-mounted host view without redrawing the active detail');
assert.match(detailSource, /source: 'detail',[\s\S]*skipDetailPatch: true,[\s\S]*allowMountedInactive: true/,
    'detail autosaves must retain the same mounted host refresh permission');
assert.match(detailSource, /window\.tmUpdateTaskDates\(boundId, patch, \{[\s\S]*skipDetailPatch: true,[\s\S]*allowMountedInactive: true/,
    'detail date controls must retain mounted host refresh permission');
assert.match(detailSource, /window\.tmOpenCustomFieldSelect\(currentTaskId, fieldId,[\s\S]*skipDetailPatch: true,[\s\S]*allowMountedInactive: true/,
    'detail custom select fields must retain mounted host refresh permission');
assert.match(fieldEditSource, /skipDetailPatch: opts\.skipDetailPatch === true,[\s\S]*allowMountedInactive: opts\.allowMountedInactive === true/,
    'custom field persistence must forward mounted inactive projection permission');
assert.doesNotMatch(storesSource, /__TM_DIRECT_DETAIL_ORDER_DEBUG_TAGS|\[Task Horizon\]\[detail-order-refresh\]/,
    'resolved detail-order diagnostics must not keep an unconditional console hot path');
assert.match(
    coordinatorSource,
    /__tmPushDetailDebug\('detail-projection-change-set',[\s\S]*taskIds:[\s\S]*fields:[\s\S]*viewMode:/,
    'projection change-set handling must print the affected detail task and fields',
);
assert.match(
    coordinatorSource,
    /__tmPushDetailDebug\('detail-projection-batch',[\s\S]*projectionRequired,[\s\S]*filtersApplied,[\s\S]*projected,[\s\S]*fallbackRequired:/,
    'opt-in projection diagnostics must retain the in-place and fallback result without recalculating task scores',
);

const performViewRefreshStart = coordinatorSource.indexOf('function __tmPerformViewRefresh(');
const performViewRefreshEnd = coordinatorSource.indexOf('\n\n\n    function __tmScheduleViewRefresh(', performViewRefreshStart);
assert.ok(performViewRefreshStart >= 0 && performViewRefreshEnd > performViewRefreshStart,
    'main view refresh executor must remain extractable');
const performViewRefresh = coordinatorSource.slice(performViewRefreshStart, performViewRefreshEnd);
assert.match(
    performViewRefresh,
    /const bypassBusyDetailDefer = next\.bypassDefer === true \|\| next\.bypassTaskFieldDefer === true;[\s\S]*if \(next\.mode !== 'detail' && !bypassBusyDetailDefer\)/,
    'immediate task-field projections must bypass the busy detail barrier while ordinary refreshes remain protected',
);
assert.match(
    performViewRefresh,
    /__tmRefreshMainViewInPlace\(\{[\s\S]*deferIfDetailBusy: !bypassBusyDetailDefer,[\s\S]*allowMountedInactive,/,
    'the task-field projection bypass and mounted-inactive permission must reach the in-place main view refresh',
);
const refreshMainViewStart = coordinatorSource.indexOf('function __tmRefreshMainViewInPlace(');
const refreshMainViewEnd = coordinatorSource.indexOf('\n\n    const __tmTaskStateKernel =', refreshMainViewStart);
assert.ok(refreshMainViewStart >= 0 && refreshMainViewEnd > refreshMainViewStart,
    'in-place main view refresh must remain extractable');
const refreshMainView = coordinatorSource.slice(refreshMainViewStart, refreshMainViewEnd);
assert.match(
    refreshMainView,
    /const allowMountedInactive = options\?\.allowMountedInactive === true[\s\S]*!__tmIsPluginVisibleNow\(\)[\s\S]*&& !allowMountedInactive/,
    'a mounted host view must remain refreshable while its task detail is active',
);

const visibleRefreshStart = detailSource.indexOf('function __tmRefreshVisibleTaskDetailForTask(');
const visibleRefreshEnd = detailSource.indexOf('\n\n    let __tmKanbanDetailOutsideClickHandler', visibleRefreshStart);
assert.ok(visibleRefreshStart >= 0 && visibleRefreshEnd > visibleRefreshStart, 'visible detail refresh must remain extractable');
const visibleRefresh = detailSource.slice(visibleRefreshStart, visibleRefreshEnd);
assert.match(
    detailSource,
    /const __TM_TASK_DETAIL_NON_VISUAL_PATCH_KEYS = new Set\(\[[\s\S]*'priorityScore'[\s\S]*'allDayBottom'[\s\S]*'milestone'[\s\S]*'taskDateColor'[\s\S]*'customTime'[\s\S]*\]\);/,
    'fields that are not rendered by task detail must share one explicit refresh exclusion set',
);
assert.match(
    visibleRefresh,
    /targetedPatch[\s\S]*patchKeys\.every\(\(key\) => __TM_TASK_DETAIL_NON_VISUAL_PATCH_KEYS\.has\(key\)\)[\s\S]*return false/,
    'non-visual patches must not redraw unrelated parent detail fields',
);
assert.match(
    visibleRefresh,
    /const detailPatch = targetedPatch \|\| defaultDetailPatch;[\s\S]*__tmPatchTaskDetailPanelInPlace\(panel, tid, detailPatch\)/,
    'visible detail panels must patch only the fields named by the originating mutation',
);
assert.match(
    visibleRefresh,
    /const detailPatched = !!patchVisibleDetailPanel\(overlay\)/,
    'standalone details must use the same field-scoped patch path as embedded drawers',
);

assert.match(
    timeRefreshSource,
    /__tmRefreshVisibleTaskDetailForTask\(tid, \{\s*patch,\s*\}\)/,
    'time-field refreshes must preserve their patch scope when updating a visible detail',
);
assert.match(
    detailSource,
    /case 'custom-tomato-count':[\s\S]*__tmRefreshVisibleTaskDetailForTask\([\s\S]*?patch: \{ tomatoCount: true \},[\s\S]*?\}\);/,
    'tomato-count attribute refreshes must not redraw unrelated detail fields',
);
const subtaskProjectionStart = detailSource.indexOf('const projectSubtasksInPlace =');
const subtaskProjectionEnd = detailSource.indexOf('try { root.__tmTaskDetailProjectSubtasks = projectSubtasksInPlace;', subtaskProjectionStart);
assert.ok(subtaskProjectionStart >= 0 && subtaskProjectionEnd > subtaskProjectionStart,
    'detail subtask projection must remain extractable');
const subtaskProjection = detailSource.slice(subtaskProjectionStart, subtaskProjectionEnd);
assert.match(subtaskProjection, /__tmGetTaskDetailTaskById\(boundId, \{ includePending: true, preferPending: true \}\)/,
    'detail subtask projection must combine the latest fields with the complete detail structure');
assert.doesNotMatch(subtaskProjection, /__tmTaskStore\?\.getProjected\?\.\(boundId\)/,
    'detail subtask projection must not treat a shallow field projection as a complete child tree');
const subtaskSummaryStart = detailSource.indexOf('const syncSubtaskSectionSummary =');
const subtaskSummaryEnd = detailSource.indexOf('const projectSubtasksInPlace =', subtaskSummaryStart);
assert.ok(subtaskSummaryStart >= 0 && subtaskSummaryEnd > subtaskSummaryStart,
    'detail subtask summary must remain extractable');
const subtaskSummary = detailSource.slice(subtaskSummaryStart, subtaskSummaryEnd);
assert.match(detailSource, /function __tmGetTaskDetailProjectedDirectChildren[\s\S]*listFlat[\s\S]*listPending/,
    'task detail must build one projected child index from the flat and pending task sources');
assert.doesNotMatch(
    detailSource.slice(
        detailSource.indexOf('function __tmGetTaskDetailProjectedDirectChildren'),
        detailSource.indexOf('function __tmResolveTaskDetailParentTaskId'),
    ),
    /listProjectedDirectChildren/,
    'task detail must not rescan the full task store once per descendant',
);
assert.doesNotMatch(
    detailSource.slice(
        detailSource.indexOf('function __tmGetTaskDetailProjectedDirectChildren'),
        detailSource.indexOf('function __tmResolveTaskDetailParentTaskId'),
    ),
    /\.sort\(/,
    'task detail must render the document sibling order without applying a view sort',
);
assert.match(detailSource, /function __tmGetTaskDetailTaskById[\s\S]*children:[\s\S]*__tmGetTaskDetailProjectedDirectChildren\(projectedTask, \{ structuralTask \}\)/,
    'task detail must use projected sibling order instead of a reordered structural mirror');
assert.match(subtaskSummary, /__tmGetTaskDetailProjectedDirectChildren[\s\S]*__tmIsTaskCompletedForProjection/,
    'detail subtask summary must count projected direct children and their effective completion state');
assert.match(
    coordinatorSource,
    /catch \(e\) \{\s*try \{ __tmRefreshVisibleTaskDetailForTask\(taskId, \{ patch: \{ attachments: true \} \}\); \} catch \(e2\) \{\}\s*\}/,
    'attachment fallback refreshes must remain field-scoped',
);

const mainControllers = coordinatorSource.slice(
    coordinatorSource.indexOf('const __tmViewControllers = {'),
    coordinatorSource.indexOf('function __tmSyncVisibleCalendarTaskPatch', coordinatorSource.indexOf('const __tmViewControllers = {')),
);
for (const view of ['list', 'checklist', 'timeline', 'kanban', 'whiteboard']) {
    const start = mainControllers.indexOf(`        ${view}: {`);
    const end = mainControllers.indexOf('\n        },', start);
    assert.ok(start >= 0 && end > start, `${view} view controller must remain extractable`);
    const controller = mainControllers.slice(start, end);
    assert.match(controller, /hasOwnProperty\.call\(patch,|__tmDoesPatchAffect/, `${view} must keep field-aware in-place refresh behavior`);
    assert.doesNotMatch(controller, /__tmRefreshVisibleTaskDetailForTask|\brender\s*\(/, `${view} must not enter an unrelated full detail or shell refresh`);
}

console.log('task detail field refresh isolation contract tests passed');
