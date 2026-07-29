'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const stores = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const services = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const taskRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js'), 'utf8');
const createRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53b-task-create-and-quick-add-runtime.js'), 'utf8');
const localTimeRefresh = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/46-render-local-task-time-refresh.js'), 'utf8');
const calendarSupport = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/48-render-calendar-support-runtime.js'), 'utf8');
const sidePanels = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/47-render-side-panels-and-view-switching.js'), 'utf8');
const manualRefresh = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/39-render-doc-group-sync-and-refresh.js'), 'utf8');
const calendarView = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const listRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js'), 'utf8');

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
const taskDatePatch = segment(
    calendarView,
    'function syncTaskDateEventFromDateFollowPatch',
    'async function __tmPatchTaskDateInCalendar',
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
const calendarDateUpdate = segment(
    calendarSupport,
    'async function __tmSyncCalendarTaskDatePatchAfterUpdate',
    'window.tmUpdateTaskDates = async function',
);
const optimisticCreateRefresh = segment(
    createRuntime,
    'function __tmRefreshAfterOptimisticTaskCreate',
    'function __tmSyncCommittedCreatedTaskDateInCalendar',
);
const committedCreateDatePatch = segment(
    createRuntime,
    'function __tmSyncCommittedCreatedTaskDateInCalendar',
    'function __tmEnsureOptimisticSubtaskInFilteredTasks',
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
    'function __tmShouldRetryBlockMutationError',
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
    'function __tmScheduleQueuedCreateOpMissingRealIdReconcile',
);
const queuedCreateIdRecord = segment(
    services,
    'function __tmRecordQueuedCreateOpInserted',
    'function __tmGetOutboxCreateOpForTempTaskId',
);
assert.match(
    taskTxRefresh,
    /reason: 'task-tx-refresh',[\s\S]*main: String\(state\.viewMode \|\| ''\)\.trim\(\) === 'calendar',[\s\S]*side: false,[\s\S]*flushTaskPanel: false/,
    'generic task transactions may refresh the active main calendar but must not reload the calendar task sidebar',
);
assert.doesNotMatch(taskTxRefresh, /side:\s*true/, 'generic task transactions must keep the side calendar isolated');

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
    optimisticCreateRefresh,
    /const mainCalendarActive = String\(state\.viewMode[\s\S]*if \(mainCalendarActive\)[\s\S]*return true;[\s\S]*__tmScheduleViewRefresh/,
    'main-calendar creates must suppress current-view refresh while side-dock views retain their local main-view refresh',
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
    assert.match(createQueue, /const isolateCalendarRefresh = __tmShouldIsolateCalendarTaskCreateRefresh\(\)/);
    assert.match(createQueue, /refreshPolicy: __tmBuildTaskCreateRefreshPolicy/);
    assert.match(createQueue, /skipSettledViewRefresh:[^\n]*isolateCalendarRefresh/);
    assert.match(createQueue, /scheduleSnapshotRefresh: isolateCalendarRefresh \? false/);
});

[headingCreate, quickAddCreate, siblingCreate].forEach((createEntry) => {
    assert.match(createEntry, /__tmRefreshAfterOptimisticTaskCreate/);
    assert.doesNotMatch(createEntry, /__tmScheduleViewRefresh/);
    assert.doesNotMatch(createEntry, /__tmScheduleRender/);
});
assert.match(subtaskCreate, /__tmRefreshAfterOptimisticTaskCreate\(refreshIds, 'create-subtask-current-optimistic'\)/);
assert.doesNotMatch(subtaskCreate, /mode:\s*'current'/, 'subtask creation may refresh its detail panel but not the calendar sidebar');
assert.match(
    queuedCreateCommit,
    /__tmBuildQueuedCreateCommitOptions\(op,[\s\S]*__tmRefreshQueuedStructuralProjection/,
    'queued create commit must preserve the captured create refresh policy through ID commit and settled reconciliation',
);
assert.match(queuedCreateCommitPolicy, /refreshPolicy[\s\S]*refreshCurrentView/, 'queued create commits must preserve their captured refresh policy');
assert.match(
    createRuntime,
    /function __tmCommitOptimisticTaskId[\s\S]*__tmShouldIsolateCalendarTaskCreateRefresh\(\) \? \{ current: false, snapshot: false \} : \{\}/,
    'every create ID commit must suppress current-view and snapshot refreshes while the calendar is active',
);
assert.match(
    queuedCreateIdRecord,
    /__tmCommitOptimisticTaskId\(tempId, rid, __tmBuildQueuedCreateCommitOptions\(op/,
    'the early real-ID record path must not bypass the queued create refresh policy',
);

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
assert.match(
    calendarDateUpdate,
    /const main = String\(state\.viewMode \|\| ''\)\.trim\(\) === 'calendar';[\s\S]*__tmShouldShowCalendarSideDock\(\)[\s\S]*sideSourceRefresh: false[\s\S]*allowRefetch: false/,
    'the task-date API must not update hidden calendar surfaces or refetch after a successful local patch',
);
assert.match(
    manualRefresh,
    /reason: 'manual-calendar-light',[\s\S]*main: true,[\s\S]*side: true,[\s\S]*flushTaskPanel: true/,
    'explicit calendar refresh must continue to refresh every calendar surface',
);

console.log('calendar task mutation refresh isolation contract tests passed');
