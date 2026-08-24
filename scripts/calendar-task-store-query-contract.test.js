'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const support = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/render/48-render-calendar-support-runtime.js'),
    'utf8',
);
const calendar = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');

assert.match(
    support,
    /function __tmGetCalendarTaskStoreRowsSync\(\)[\s\S]*store\.getProjected\?\.[\s\S]*store\.listFlat\(\)/,
    'calendar task reads must reuse the canonical task store',
);
assert.match(
    support,
    /function __tmCalendarTaskStoreScopeMatches\(docIds = \[\]\)[\s\S]*__tmLoadedDocIdsForTasks/,
    'store reuse must be guarded by the loaded document scope',
);
assert.match(
    support,
    /let __tmCalendarTaskFullLoadPromise = null[\s\S]*if \(__tmCalendarTaskFullLoadPromise\) \{[\s\S]*return __tmCalendarTaskFullLoadPromise;[\s\S]*\}/,
    'parallel calendar task reads must share one full-load promise',
);
assert.match(
    support,
    /__tmGetCalendarTaskSharedLoadState\(key\)[\s\S]*sharedLoad\.key === key[\s\S]*sharedLoad\.anyScope === true[\s\S]*__tmSetCalendarTaskSharedLoadState\(\{ key, scopeKey: key, anyScope: true, promise: tracked \}\)/,
    'parallel reads from duplicate runtime instances must share the stable-window full-load promise',
);
assert.match(
    support,
    /same authoritative[\s\S]*all documents[\s\S]*duplicate 20k-row SQL reads/,
    'parallel startup reads with equivalent but differently ordered document scopes must share one any-scope load lock',
);
assert.match(support, /__tmCalendarTaskFullLoadAnyState = value/);
assert.match(
    support,
    /sharedLoad\?\.promise[\s\S]*sharedLoad\.anyScope === true[\s\S]*__tmSetCalendarTaskSharedLoadState\(\{ key, scopeKey: key, anyScope: true, promise: tracked \}\)/,
    'different document fingerprints must reuse the same authoritative in-flight load',
);
assert.match(
    support,
    /function __tmResolveCalendarTaskDocIdsShared\(options = \{\}\)[\s\S]*__tmCalendarTaskDocIdsResolveState[\s\S]*__tmLoadAllTasksForCalendarCache\(options = \{\}\)[\s\S]*__tmResolveCalendarTaskDocIdsShared\(/,
    'cold calendar mounts must share document-scope expansion before starting the full task query',
);
assert.match(
    support,
    /const earlySharedLoad = __tmGetCalendarTaskSharedLoadState\(\)[\s\S]*return earlySharedLoad\.promise;[\s\S]*const allDocIds = await __tmResolveCalendarTaskDocIdsShared/,
    'an existing full load must be reused before duplicate document-scope expansion',
);
assert.match(
    support,
    /Object\.assign\(opts, \{ forceFresh, maxAgeMs: 8000 \}\);[\s\S]*__tmLoadAllTasksForCalendarCache\(opts\)/,
    'task-date diagnostics must retain cache reuse metadata from the shared loader',
);
assert.match(
    support,
    /source: 'task-store'[\s\S]*storeRevision/,
    'task-store reads must record their source and revision for diagnostics/invalidation',
);
assert.match(
    support,
    /API\.getTasksByDocuments\(allDocIds, limit, \{[\s\S]*skipParentTaskJoin: true[\s\S]*customFieldIds: \[\],[\s\S]*\}\)/,
    'calendar task reads must reuse the canonical query with parent/custom-field work disabled',
);
assert.match(
    support,
    /const cacheRevisionMatches = prev\?\.source !== 'task-store'[\s\S]*cacheRevisionMatches[\s\S]*Date\.now\(\) - \(Number\(prev\.ts\) \|\| 0\) < maxAgeMs/,
    'SQL task snapshots must not be invalidated by unrelated task-store hydration revisions',
);
assert.match(
    support,
    /function __tmRequestCalendarTaskCacheWarmRefresh\(options = \{\}, tasks = \[\]\)[\s\S]*previousTaskCount[\s\S]*refreshTaskDateSources[\s\S]*task-date-in-place/,
    'a changed full task snapshot must refresh mounted task-date sources in place',
);
assert.match(
    support,
    /const allowInactiveFullLoad = opts\.allowInactiveFullLoad === true \|\| opts\.allowInactiveView === true[\s\S]*tmWarmCalendarTaskCacheIfStale\?\.\(\{[\s\S]*allowInactiveFullLoad[\s\S]*allowInactiveView: allowInactiveFullLoad/,
    'sidebar fast-first task-date reads must carry inactive-load permission into the background cache warm-up',
);
assert.match(
    support,
    /function __tmCalendarTaskCacheIsFresh\(maxAgeMs = 8000\)[\s\S]*if \(prev\.complete !== true\) return false/,
    'partial task snapshots must not suppress the full calendar task-cache warm-up',
);
assert.match(
    support,
    /cacheComplete = cache\?\.complete === true[\s\S]*!cacheComplete[\s\S]*scheduleTaskDateCacheWarm\(/,
    'fast-first task-date reads must warm the full index when their cache is incomplete',
);
assert.match(
    support,
    /function __tmIsAnyCalendarSurfaceActiveForTaskCache\(\)[\s\S]*__tmIsCalendarMainViewActiveForTaskCache\(\) \|\| __tmIsCalendarSideDockActiveForTaskCache\(\)/,
    'task cache warm completion must remain active when only the calendar side dock is mounted',
);
assert.match(
    support,
    /const previousCache = window\.__tmCalendarAllTasksCache[\s\S]*__tmPreviousTaskCount: previousTaskCount/,
    'task-cache warming must compare the pre-load snapshot before requesting a source refresh',
);
assert.match(
    support,
    /function __tmGetCalendarTaskDateIndex\(tasks\)[\s\S]*globalThis\.__tmCalendarTaskDateIndex[\s\S]*function __tmGetCalendarTaskDateCandidates\(tasks, rangeStartTs, rangeEndTs\)/,
    'calendar date queries must use a lightweight shared interval index',
);
assert.match(support, /candidateCount: indexed\.tasks\.length[\s\S]*indexHit: indexed\.hit/, 'date index usage must be observable in performance diagnostics');
assert.match(support, /__tmCalendarTaskLastStoreScope[\s\S]*expectedDocCount[\s\S]*loadedDocCount/, 'store scope misses must expose document counts without task content');
assert.match(
    calendar,
    /function bindCalendarTaskMutationSubscription\(\)[\s\S]*__tmTaskMutationBus[\s\S]*syncTaskDateEventFromDateFollowPatch/,
    'calendar mutations must update visible task-date events through the existing mutation bus',
);
assert.match(
    calendar,
    /bindCalendarTaskMutationSubscription\(\)[\s\S]*state\.taskMutationUnsubscribe/,
    'calendar mutation subscriptions must be attached and cleaned up with the calendar lifecycle',
);
assert.doesNotMatch(
    calendar.slice(calendar.indexOf('function bindCalendarTaskMutationSubscription'), calendar.indexOf('function toLocalDateKey')),
    /refetchEvents|__tmRefreshTaskDateSourceInPlace/,
    'incremental task mutations must not refetch FullCalendar sources',
);

const sideRefreshStart = calendar.indexOf('function scheduleSideDayTaskDateSourceRefresh');
const sideRefreshEnd = calendar.indexOf('function getSideDayCurrentDateStart', sideRefreshStart);
assert.ok(sideRefreshStart >= 0 && sideRefreshEnd > sideRefreshStart, 'sidebar refresh function must remain inspectable');
const sideRefresh = calendar.slice(sideRefreshStart, sideRefreshEnd);
assert.doesNotMatch(sideRefresh, /__tmCalendarAllTasksCache\s*=\s*null/, 'sidebar refresh must not clear the task cache');
assert.doesNotMatch(sideRefresh, /__tmCalendarTaskDateForceFreshUntil/, 'sidebar refresh must not force a fresh full task query');
assert.match(sideRefresh, /allowInactiveFullLoad:\s*false/, 'sidebar refresh must stay on the mounted task-store path');

const taskDateRefetch = calendar.slice(
    calendar.indexOf('function __tmRefetchTaskDateSources'),
    calendar.indexOf('function __tmSchedulePostMutationRefresh', calendar.indexOf('function __tmRefetchTaskDateSources')),
);
assert.match(taskDateRefetch, /allowInactiveFullLoad: opt\.allowInactiveFullLoad === true/, 'full load must be opt-in for task-date source refresh');
assert.match(
    calendar,
    /deferFullLoad: taskDateCalendarName === 'side'[\s\S]*side-taskdate-background-complete/,
    'the side dock must defer an incomplete fast-first task-date read to the shared warm path',
);
assert.match(
    support,
    /opts\.deferFullLoad === true[\s\S]*taskdate-side-deferred[\s\S]*cacheStatus: 'warming'/,
    'the shared task query must return the side lane without waiting for the full task index',
);

console.log('calendar task store query contract tests passed');
