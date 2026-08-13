'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const stores = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const services = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const taskRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js'), 'utf8');
const projectionEngine = fs.readFileSync(path.join(root, 'src/task-horizon/main/34-task-projection-engine.js'), 'utf8');
const createRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53b-task-create-and-quick-add-runtime.js'), 'utf8');
const localTimeRefresh = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/46-render-local-task-time-refresh.js'), 'utf8');
const calendarSupport = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/48-render-calendar-support-runtime.js'), 'utf8');
const sidePanels = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/47-render-side-panels-and-view-switching.js'), 'utf8');
const manualRefresh = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/39-render-doc-group-sync-and-refresh.js'), 'utf8');
const calendarView = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const listRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js'), 'utf8');
const lifecycleRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/56-task-lifecycle-runtime.js'), 'utf8');

const segment = (source, start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(from, -1, `missing segment start: ${start}`);
    assert.notEqual(to, -1, `missing segment end: ${end}`);
    return source.slice(from, to);
};

const taskTxRefresh = segment(
    stores,
    'function __tmScheduleCalendarRefetchFromTx',
    'function __tmBindSqlCacheInvalidation',
);
const appliedAttrTxPolicy = segment(
    stores,
    'function __tmShouldSkipCalendarTxRefreshForAppliedAttrPatch',
    'function __tmDedupeTaskQueryRowsById',
);
const taskMutationRefresh = segment(
    services,
    'function __tmRefreshViewsAfterTaskMutation',
    'async function __tmDoesBlockIdExist',
);
const visibleTaskPatch = segment(
    taskRuntime,
    'function __tmSyncVisibleCalendarTaskPatch',
    'function __tmRefreshTaskFieldsAcrossViews',
);
const taskFieldRefresh = segment(
    taskRuntime,
    'function __tmRefreshTaskFieldsAcrossViews',
    'function __tmGetTaskSuppressionIds',
);
const calendarPatchClassifier = segment(
    taskRuntime,
    'function __tmPatchAffectsCalendar',
    'function __tmArmChecklistRenderGuard',
);
const taskDatePatch = segment(
    calendarView,
    'function syncTaskDateEventFromDateFollowPatch',
    'async function __tmPatchTaskDateInCalendar',
);
const taskDateEventBuild = segment(
    calendarView,
    'function buildEventsFromTaskDates',
    'function __tmUpdateMainCalendarStatus',
);
const localTaskDateEventPatch = segment(
    calendarView,
    'function buildTaskDateEventFromDateFollowPatch',
    'function syncTaskDateEventFromDateFollowPatch',
);
const directTaskDatePatch = segment(
    calendarView,
    'function syncTaskDatePatchInPlace',
    'async function getTaskDateEventRepeatRule',
);
const calendarTaskDateQuery = segment(
    calendarSupport,
    'window.tmQueryCalendarTaskDateEvents = async function',
    'window.tmRenderCalendarTaskTableHtml = function',
);
const optimisticDelete = segment(
    createRuntime,
    'function __tmApplyDeleteOptimisticLocal',
    'function __tmRollbackDeleteOptimisticLocal',
);
const deleteRelations = segment(
    lifecycleRuntime,
    'async function __tmCleanupDeletedTaskRelations',
    'async function __tmArchiveDeletedTask',
);
const visibleSchedulePatch = segment(
    calendarView,
    'function __tmPatchVisibleSingleScheduleInCalendar',
    'function __tmPatchVisibleSingleScheduleInPlace',
);
const scheduleMutationDispatch = segment(
    calendarView,
    'function __tmPatchVisibleSingleScheduleInPlace',
    'function __tmRefetchScheduleSources',
);
const committedCreateDatePatch = segment(
    createRuntime,
    'function __tmSyncCommittedCreatedTaskDateInCalendar',
    'function __tmGetMoveTargetHeadingMeta',
);
const queueCreateSubtask = segment(
    createRuntime,
    'function __tmQueueCreateSubtask',
    'function __tmApplyOptimisticSubtask',
);
const queueCreateTask = segment(
    createRuntime,
    'function __tmQueueCreateTaskInDoc',
    'function __tmQueueCreateSiblingTask',
);
const queueCreateSibling = segment(
    createRuntime,
    'function __tmQueueCreateSiblingTask',
    'window.tmCreateSubtask = async function',
);
const headingCreate = segment(
    createRuntime,
    'window.tmCreateTaskForHeadingGroup = async function',
    'async function __tmAppendBlockOnce',
);
const subtaskCreate = segment(
    createRuntime,
    'window.tmCreateSubtask = async function',
    'window.tmCreateSiblingTask = async function',
);
const siblingCreate = segment(
    createRuntime,
    'window.tmCreateSiblingTask = async function',
    'let __tmQuickbarScheduledRefreshTimer',
);
const quickAddCreate = segment(
    createRuntime,
    'window.tmQuickAddSubmit = async function',
    'window.tmAdd = async function',
);
const queuedCreateCommit = segment(
    services,
    'function __tmCommitQueuedOp',
    'function __tmRemapQueuedOpTaskReferences',
);
const queuedCreateCommitPolicy = segment(
    services,
    'function __tmBuildQueuedCreateCommitOptions',
    'async function __tmIsTaskListItemBlockId',
);
const floatingPriority = segment(
    calendarView,
    'async function applyFloatingMiniTaskPriority',
    'async function applyFloatingMiniCalendarDate',
);
const floatingDate = segment(
    calendarView,
    'async function applyFloatingMiniCalendarDate',
    'async function finalizeFloatingMiniCalendarTouchDrop',
);
assert.match(
    taskTxRefresh,
    /reason: 'task-tx-refresh',[\s\S]*main: String\(state\.viewMode \|\| ''\)\.trim\(\) === 'calendar',[\s\S]*side: false,[\s\S]*flushTaskPanel: false/,
    'generic task transactions may refresh the active main calendar but must not reload the calendar task sidebar',
);
assert.doesNotMatch(taskTxRefresh, /side:\s*true/, 'generic task transactions must keep the side calendar isolated');
assert.doesNotMatch(appliedAttrTxPolicy, /viewMode === 'calendar'/,
    'an already-applied attribute transaction must not refetch FullCalendar only because the calendar view is active');
assert.match(appliedAttrTxPolicy, /__tmResolveTaskMetaFieldByAttrKey[\s\S]*__tmGetCustomFieldDefByAttrStorageKey/,
    'all recognized built-in and custom fields must reuse their local mutation patch');
assert.match(appliedAttrTxPolicy, /__TM_TASK_ATTR_HOST_UPDATED_AT_ATTR[\s\S]*__TM_TASK_ATTR_HOST_OWNER_ATTR/,
    'task host bookkeeping attributes must not turn a field acknowledgement into a FullCalendar refetch');

assert.match(
    taskMutationRefresh,
    /const calendarView = String\(state\.viewMode \|\| ''\)\.trim\(\) === 'calendar';[\s\S]*reason: String\(opts\.reason \|\| 'task-mutation'\)[\s\S]*main: calendarView,[\s\S]*side: false,[\s\S]*flushTaskPanel: false/,
    'generic task mutations may refresh the active main calendar but must not reload the calendar task sidebar',
);
assert.doesNotMatch(taskMutationRefresh, /side:\s*true/, 'generic task mutations must keep the side calendar isolated');
assert.match(
    taskMutationRefresh,
    /if \(!calendarOnly && !calendarView\)/,
    'generic task mutations must not fall through to a current-view rerender while the calendar is active',
);

assert.match(
    committedCreateDatePatch,
    /syncTaskDatePatchInPlace\(tid,[\s\S]*main: mainCalendarActive,[\s\S]*side: calendarSideDockVisible,[\s\S]*sideSourceRefresh: false/,
    'committed creates with visible dates must patch only the mounted main calendar or side dock directly',
);
assert.doesNotMatch(
    committedCreateDatePatch,
    /requestRefresh|refreshInPlace|__tmScheduleViewRefresh|__tmScheduleRender/,
    'create ID commit must not fall back to a calendar or view reload',
);

[queueCreateTask, queueCreateSubtask, queueCreateSibling].forEach((createQueue) => {
    assert.doesNotMatch(createQueue, /refreshPolicy|skipSettledViewRefresh|__tmRefreshAfterOptimisticTaskCreate/,
        'create commands must leave view projection to ProjectionEngine');
});

[headingCreate, quickAddCreate, siblingCreate, subtaskCreate].forEach((createEntry) => {
    assert.doesNotMatch(createEntry, /__tmRefreshAfterOptimisticTaskCreate|__tmScheduleViewRefresh|__tmScheduleRender/,
        'create entries must not own a second optimistic refresh path');
});
assert.match(queuedCreateCommit, /__tmBuildQueuedCreateCommitOptions\(op/,
    'create ID commit must preserve stable identity metadata');
assert.doesNotMatch(queuedCreateCommit, /__tmRefreshQueuedStructuralProjection|__tmScheduleSimpleStructuralRefresh/,
    'successful create commits must not reload task documents');
assert.doesNotMatch(queuedCreateCommitPolicy, /refreshPolicy|refreshCurrentView/,
    'queued create ID commits must not carry a parallel refresh policy');
assert.doesNotMatch(createRuntime, /function __tmRefreshAfterOptimisticTaskCreate|function __tmBuildTaskCreateRefreshPolicy/,
    'legacy create projection helpers must remain removed');
assert.doesNotMatch(services, /__tmRecordQueuedCreateOpInserted|__tmScheduleQueuedCreateOpRealIdResolve/,
    'pre-generated task IDs must not retain an early-ID probe path');

assert.match(
    createRuntime,
    /function __tmShouldIsolateCalendarTaskCreateRefresh[\s\S]*__tmHasMountedCalendarSideDock\(\)/,
    'create refresh isolation must cover every view that can show the calendar side dock',
);
assert.match(
    sidePanels,
    /function __tmHasMountedCalendarSideDock[\s\S]*\.tm-calendar-side-dock #tmCalendarSideDockTimeline/,
    'scheduled renders must detect the actually mounted calendar side dock',
);
assert.match(
    sidePanels,
    /mode === 'list'[\s\S]*mode === 'checklist'[\s\S]*mode === 'timeline'[\s\S]*mode === 'kanban'[\s\S]*mode === 'whiteboard'/,
    'calendar side-dock refresh isolation must cover every supported main view',
);
assert.match(
    listRuntime,
    /typeof __tmHasMountedCalendarSideDock === 'function'[\s\S]*__tmHasMountedCalendarSideDock\(\)[\s\S]*preservedCalendarSideDock = !!__tmRerenderCurrentViewInPlace\(state\.modal\)/,
    'scheduled renders and create isolation must share the mounted side-dock predicate',
);
assert.match(
    listRuntime,
    /preservedCalendarSideDock = !!__tmRerenderCurrentViewInPlace\(state\.modal\)[\s\S]*if \(!preservedCalendarSideDock\) render\(\)/,
    'scheduled task renders must prefer the current view local renderer before a full modal rebuild',
);
assert.match(
    localTimeRefresh,
    /syncTaskDateInPlace\(tid,[\s\S]*main: isCalendarView,[\s\S]*side: __tmShouldShowCalendarSideDock\(\),[\s\S]*allowRefetch: false,[\s\S]*flushTaskPanel: false/,
    'task date changes must retain the targeted side-calendar synchronization path',
);
assert.match(
    visibleTaskPatch,
    /const main = viewMode === 'calendar';[\s\S]*__tmShouldShowCalendarSideDock\(\)[\s\S]*syncTaskDatePatchInPlace[\s\S]*sideSourceRefresh: false/,
    'task field patches must target only the calendar surfaces that are currently visible',
);
assert.doesNotMatch(visibleTaskPatch, /flushTaskPanel:\s*true/, 'local calendar field patches must not reload the task sidebar');
assert.match(calendarPatchClassifier, /__tmAnalyzeTaskProjectionPatch\('', patch\)\.calendar === true/,
    'calendar classification must delegate to ProjectionEngine');
assert.match(projectionEngine, /const CALENDAR_FIELDS[\s\S]*'content'/,
    'task content must remain a calendar-visible ProjectionEngine field');
assert.match(
    visibleTaskPatch,
    /directTaskDateKeys = new Set\(\['content',\s*'startDate',\s*'completionTime',\s*'taskDateColor'\]\)/,
    'task content must reuse the direct task-date event patch instead of waiting for a SQL readback',
);
assert.match(
    taskFieldRefresh,
    /const hasCalendarPatch = __tmPatchAffectsCalendar\(nextPatch\);[\s\S]*if \(hasCalendarPatch\)[\s\S]*__tmCalendarAllTasksCache = null/,
    'calendar-visible field changes must invalidate the stale task cache before hidden-view early returns',
);
assert.match(
    taskFieldRefresh,
    /if \(viewMode === 'calendar'\)[\s\S]*requestRefresh\(\{[\s\S]*main: false,[\s\S]*side: false,[\s\S]*flushTaskPanel: true,[\s\S]*hard: false/,
    'calendar task fields must refresh only the task panel after their direct local event patch',
);
assert.match(floatingPriority, /wait: true,[\s\S]*skipInteractionGate: true/,
    'floating priority must retain optimistic interaction isolation while awaiting authoritative settlement');
assert.doesNotMatch(floatingPriority, /forceImmediate|optimisticProjectionRefresh|scheduleCalendarRefresh/,
    'floating priority must not select a special writer or global refresh policy');
assert.match(floatingDate, /background: true,[\s\S]*wait: true,[\s\S]*skipFlush: true,[\s\S]*renderOptimistic: true/,
    'floating date must render optimistically while awaiting authoritative settlement');
assert.doesNotMatch(floatingDate, /scheduleCalendarRefresh/,
    'floating date must not refetch both FullCalendar instances after a local patch');
assert.match(
    directTaskDatePatch,
    /hasOwnProperty\.call\(patch, 'content'\)[\s\S]*normalizedPatch\.content/,
    'the direct calendar patch API must retain the renamed task content',
);
assert.match(
    localTaskDateEventPatch,
    /hasOwnProperty\.call\(p, 'content'\)[\s\S]*normalizeCalendarTaskTitleText[\s\S]*title,/,
    'the direct task-date event builder must apply the optimistic task title',
);
assert.match(
    taskDateEventBuild,
    /isPendingDeletedTaskId\?\.\(taskId\)/,
    'stale task-date source results must not recreate a pending-deleted calendar event',
);
assert.match(
    calendarTaskDateQuery,
    /__tmIsCalendarTaskPendingDeletedSync\(id\)/,
    'calendar cache and memory reads must omit pending-deleted tasks',
);
assert.match(
    optimisticDelete,
    /removeTaskDateEventsByTaskIds\(ids,[\s\S]*main:\s*true,[\s\S]*side:\s*true/,
    'task deletion must remove visible main and side task-date events optimistically',
);
assert.match(
    deleteRelations,
    /deleteTaskSchedulesByTaskIds\(ids,[\s\S]*side:\s*true,[\s\S]*flushTaskPanel:\s*false/,
    'linked schedule cleanup must refresh the side calendar without rebuilding its task panel',
);
assert.match(
    taskDatePatch,
    /sideSourceRefresh === true[\s\S]*scheduleSideDayTaskDateSourceRefresh\(\)/,
    'a local task-date mutation may schedule delayed side refetches only when explicitly requested',
);
assert.doesNotMatch(
    taskDatePatch,
    /sideSourceRefresh !== false/,
    'side task-date refetches must not be enabled by default',
);
assert.match(
    visibleSchedulePatch,
    /__tmBuildSingleScheduleEventsForCalendar[\s\S]*cal\.addEvent\?\.[\s\S]*__tmApplyScheduleExtendedPropsInPlace[\s\S]*return \{ touched, needsRefresh \}/,
    'visible day and week schedule mutations must reconcile events directly',
);
assert.match(
    localTimeRefresh,
    /syncTaskDateInPlace\(tid,[\s\S]*if \(viewMode === 'calendar'\) refreshed = true;[\s\S]*if \(\(!refreshed/,
    'a successful visible calendar patch must suppress the generic current-view rerender fallback',
);
assert.match(
    scheduleMutationDispatch,
    /runtimeViewMode[\s\S]*runtimeViewMode === 'calendar'[\s\S]*runtimeViewMode !== 'calendar'[\s\S]*rootEl\.isConnected/,
    'schedule mutations must ignore mounted calendar instances that are not currently visible',
);
assert.match(
    visibleSchedulePatch,
    /isMonthScheduleEventRange[\s\S]*return \{ touched: false, needsRefresh \}/,
    'month schedule deduplication may retain its visible-source fallback',
);
assert.doesNotMatch(
    calendarSupport,
    /function __tmSyncCalendarTaskDatePatchAfterUpdate/,
    'the superseded calendar date refresh path must not return beside the unified projection route',
);
assert.match(
    manualRefresh,
    /reason: 'manual-calendar-light',[\s\S]*main: true,[\s\S]*side: true,[\s\S]*flushTaskPanel: true/,
    'explicit calendar refresh must continue to refresh every calendar surface',
);

console.log('calendar task mutation refresh isolation contract tests passed');
