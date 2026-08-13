'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const services = read('src/task-horizon/main/20-api-and-runtime-services.js');
const stores = read('src/task-horizon/main/10-stores-rules-and-cache.js');
const dialogs = read('src/task-horizon/main/30-dialogs-and-ui-foundation.js');
const viewRuntime = read('src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js');
const refreshRuntime = read('src/task-horizon/main/render/39-render-doc-group-sync-and-refresh.js');

const segment = (source, start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(from, -1, `missing segment start: ${start}`);
    assert.notEqual(to, -1, `missing segment end: ${end}`);
    return source.slice(from, to);
};

const coordinator = segment(
    services,
    'function __tmInvalidateQueuedViewCommitForVisibleResume',
    'function __tmBindWakeReload',
);
const schedulerStart = coordinator.indexOf('function __tmScheduleVisibleResumeSync');
assert.notEqual(schedulerStart, -1, 'missing visible resume scheduler');
const scheduler = coordinator.slice(schedulerStart);
const lockIndex = scheduler.indexOf('state.visibleResumeSyncInFlight = true;');
const promiseIndex = scheduler.indexOf('__tmVisibleResumeSyncPromise = new Promise');
assert.ok(lockIndex >= 0 && lockIndex < promiseIndex, 'resume rendering must be locked before asynchronous work is scheduled');
assert.match(scheduler, /if \(__tmVisibleResumeSyncPromise\) return __tmVisibleResumeSyncPromise;/,
    'visibilitychange and focus must share one in-flight resume promise');
assert.match(scheduler, /setTimeout\([\s\S]*32\);/, 'adjacent visibility and focus events must be coalesced');

const resumeRun = segment(
    coordinator,
    'async function __tmRunVisibleResumeSync',
    'function __tmScheduleVisibleResumeSync',
);
assert.match(resumeRun, /__tmMaybeAutoRefreshOnEnter\([\s\S]*commitView: false/,
    'transaction refresh must update data without exposing an intermediate view');
assert.match(resumeRun, /__tmRefreshVisibleViewAfterTaskSnapshotSync[\s\S]*commitView: false/,
    'snapshot refresh must update data without exposing an intermediate view');
assert.equal((resumeRun.match(/__tmCommitVisibleResumeView\(/g) || []).length, 1,
    'resume synchronization must have one final view commit');

const finalCommit = segment(
    coordinator,
    'function __tmCommitVisibleResumeView',
    'async function __tmRunVisibleResumeSync',
);
assert.equal((finalCommit.match(/__tmRecomputeTaskProjection\(/g) || []).length, 1,
    'the final resume commit must project exactly once');
assert.equal((finalCommit.match(/__tmRefreshMainViewInPlace\(/g) || []).length, 1,
    'the final resume commit must redraw exactly once');
assert.match(finalCommit, /preservePendingCommit[\s\S]*state\.viewRefreshPending = __tmMergeViewRefreshDetail/,
    'a blocked final commit must remain pending for the existing refresh scheduler');
assert.match(finalCommit, /state\.viewRefreshPending = null;[\s\S]*state\.listProjectionRefreshPending = null;/,
    'pending work may be cleared only after the final commit succeeds');

const wakeBinding = segment(
    services,
    'function __tmBindWakeReload',
    'let __tmOriginalCenterSwitchTab',
);
assert.equal((wakeBinding.match(/__tmScheduleVisibleResumeSync\(/g) || []).length, 2,
    'visibilitychange and focus must both enter the unified coordinator');
assert.doesNotMatch(wakeBinding, /__tmMaybeAutoRefreshOnEnter|__tmRefreshVisibleViewAfterTaskSnapshotSync|__tmSyncRemoteCollapsedSessionStateIfNeeded/,
    'window events must not run competing refresh pipelines directly');
assert.doesNotMatch(services, /function __tmScheduleWakeReload|function __tmRefreshAfterWake/,
    'retired wake refresh coordinators must not return');

const taskIncremental = segment(
    stores,
    'async function __tmRefreshAffectedTaskBlocksIncrementally',
    'function __tmCountLoadedDocTasksForQueryLimit',
);
assert.match(taskIncremental, /const commitView = opts\.commitView !== false && opts\.refreshView !== false;/);
assert.match(taskIncremental, /const canPatchDomOnly = commitView && __tmApplyTaskBlockDomPatches/,
    'data-only task refresh must not publish DOM patches');
assert.match(taskIncremental, /if \(commitView && opts\.withFilters !== false && !canPatchDomOnly\)/,
    'data-only task refresh must not project');
assert.match(taskIncremental, /if \(commitView && !canPatchDomOnly\)[\s\S]*__tmScheduleViewRefresh/,
    'data-only task refresh must not schedule a view redraw');

const docIncremental = segment(
    stores,
    'async function __tmRefreshAffectedDocsIncrementally',
    'async function __tmFlushSqlTransactionsSafe',
);
assert.match(docIncremental, /const commitView = opts\.commitView !== false && opts\.refreshView !== false;/);
assert.match(docIncremental, /if \(commitView && opts\.withFilters !== false\) __tmRecomputeTaskProjection/);
assert.match(docIncremental, /if \(commitView\) \{[\s\S]*__tmScheduleViewRefresh/);

const snapshotRefresh = segment(
    dialogs,
    'async function __tmRefreshVisibleViewAfterTaskSnapshotSync',
    'function __tmScheduleListAutoLoadMoreHydration',
);
const snapshotLockIndex = snapshotRefresh.indexOf('state.__tmTaskSnapshotSyncRefreshInFlight = true;');
const snapshotAwaitIndex = snapshotRefresh.indexOf('await snapshotService.refreshCache');
assert.ok(snapshotLockIndex >= 0 && snapshotLockIndex < snapshotAwaitIndex,
    'snapshot synchronization must lock before its first asynchronous read');
assert.match(snapshotRefresh, /commitView,[\s\S]*deferProjection: true/,
    'snapshot fallback must defer projection during data-only refresh');

const viewDefer = segment(
    viewRuntime,
    'function __tmShouldDeferTaskFieldRefreshWork',
    'function __tmBuildListProjectionRefreshScheduleOptions',
);
assert.match(viewDefer, /state\.visibleResumeSyncInFlight/,
    'all normal task-field redraws must honor the resume rendering barrier');
const viewScheduler = segment(viewRuntime, 'function __tmScheduleViewRefresh', 'function __tmScheduleListProjectionRefresh');
assert.match(viewScheduler, /const refreshSeq = state\.viewRefreshSeq =/);
assert.match(viewScheduler, /if \(refreshSeq !== Number\(state\.viewRefreshSeq\)\) return;/,
    'queued timers and animation frames from before resume must be invalidated');

const refreshCore = segment(refreshRuntime, 'async function __tmRefreshCore', 'window.tmRefreshCalendarInPlace');
assert.match(refreshCore, /const commitView = opt\.commitView !== false;/);
assert.match(refreshCore, /if \(commitView\) \{[\s\S]*__tmRecomputeTaskProjection/);
assert.match(refreshCore, /if \(commitView && mode === 'calendar'/);
assert.match(refreshCore, /\} else if \(commitView\) \{/);

console.log('visible resume single commit contract tests passed');
