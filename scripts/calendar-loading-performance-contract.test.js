const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const runtimeSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/48-render-calendar-support-runtime.js'), 'utf8');

assert.match(
    source,
    /const SCHEDULE_READ_CACHE_TTL_MS = 10000;[\s\S]*async function loadScheduleAll\(\)[\s\S]*Date\.now\(\) - \(Number\(cache\.loadedAt\) \|\| 0\) < SCHEDULE_READ_CACHE_TTL_MS/,
    'schedule reads must survive the delay between preload and sidebar mount',
);
assert.match(
    source,
    /function readScheduleLocalStorageSnapshot\(\)[\s\S]*function queueScheduleAuthoritativeRefresh\([\s\S]*authoritativeInflight[\s\S]*setScheduleCache\(localSnapshot\.out, localSnapshot\.signature\)[\s\S]*queueScheduleAuthoritativeRefresh\(\)/,
    'cold schedule reads must paint from the last confirmed local snapshot while refreshing from the kernel in the background',
);
assert.match(
    source,
    /const mainCalendarEventSourceRequestSignatures = .*new Map\(\);[\s\S]*rememberMainCalendarEventSourceRequest\(EVENT_SOURCE_IDS\.mainAux[\s\S]*rememberMainCalendarEventSourceRequest\(EVENT_SOURCE_IDS\.mainSchedule[\s\S]*rememberMainCalendarEventSourceRequest\(EVENT_SOURCE_IDS\.mainTaskDate/,
    'all main event sources must record their requested view and range',
);
assert.match(
    fs.readFileSync(path.join(root, 'src/task-horizon/main/render/39-render-doc-group-sync-and-refresh.js'), 'utf8'),
    /styleKind: 'topbar',[\s\S]*delayMs: 180/,
    'refresh loading indicator must be delayed so short refreshes do not flash in the top-right corner',
);
assert.match(
    source,
    /sourceIds\.every\(\(sourceId\) => mainCalendarEventSourceRequestSignatures\.get\(sourceId\) === expectedSignature\)[\s\S]*return;[\s\S]*callCalendarAdapter\(calendar, 'refetchEvents'\)/,
    'view changes must skip the fallback refetch only after every source requested the new range',
);
assert.match(
    source,
    /const currentDateKey = \(\(\) => \{[\s\S]*const preferredDateKey = formatDateKey\(preferredInitialDate\)[\s\S]*else if \(currentDateKey !== preferredDateKey\)[\s\S]*callCalendarAdapter\(calendar, 'gotoDate'/,
    'initial calendar mount must not navigate to the same date and race the first event-source fetch',
);
assert.match(
    source,
    /function setScheduleCache\(items, sourceSignature\)[\s\S]*state\.scheduleRangeCache\.clear\(\)/,
    'schedule mutations and reloads must invalidate completed range results',
);
assert.match(
    source,
    /function saveScheduleAll\(items, options\)[\s\S]*state\.scheduleWriteTail = pending\.catch[\s\S]*async function performScheduleSaveAll\(items, options\)[\s\S]*const optimisticSignature = computeScheduleSourceSignature\(serialized\);[\s\S]*setScheduleCache\(list, optimisticSignature\)/,
    'local schedule writes must replace the extended read cache immediately',
);
assert.match(
    source,
    /async function performScheduleSaveAll\(items, options\)[\s\S]*const optimisticSignature = computeScheduleSourceSignature\(serialized\);[\s\S]*setScheduleCache\(list, optimisticSignature\)[\s\S]*catch \(e\) \{[\s\S]*setScheduleCache\(previousList, computeScheduleSourceSignature\(rollbackSerialized\)\)/,
    'failed schedule persistence must roll back the optimistic memory snapshot',
);
assert.match(
    source,
    /if \(kernelSave\)[\s\S]*await kernelSave\(list, opts\)[\s\S]*else \{[\s\S]*await putFileText\(STORAGE\.SCHEDULE_FILE, serialized\)/,
    'schedule persistence must complete the selected authoritative write before post-save side effects',
);
assert.match(
    source,
    /async function refreshScheduleCacheFromSharedFile\(\)[\s\S]*const parsed = JSON\.parse\(raw\);[\s\S]*normalizeScheduleList\(parsed\)[\s\S]*computeScheduleSourceSignature\(JSON\.stringify\(out, null, 2\)\)/,
    'shared-file schedule polling must compare normalized content, not raw file formatting',
);
assert.match(
    source,
    /const cachedList = Array\.isArray\(state\.scheduleCache\.list\) \? state\.scheduleCache\.list : null;[\s\S]*normalizeScheduleList\(cachedList\)\.out[\s\S]*if \(!state\.scheduleCache\.sourceSignature\) state\.scheduleCache\.sourceSignature = prevSignature;/,
    'shared-file polling must initialize a missing signature from the mounted cache before deciding to refresh',
);
assert.match(
    source,
    /const pending = state\.scheduleRangeInflight\.get\(rangeKey\);[\s\S]*if \(pending\)[\s\S]*await pending[\s\S]*return (?:list\.slice\(\)|\(await pending\)\.slice\(\);)/,
    'parallel schedule sources must share one range computation',
);
assert.match(
    source,
    /async function __tmBuildTaskDateSourceEvents[\s\S]*if \(!settings\.showTaskDates\) return \[\];[\s\S]*needsScheduleTaskDaySet \? loadScheduleForRange\(start, end\)/,
    'disabled task dates and views without schedule dedupe must not load schedule ranges',
);
assert.match(
    source,
    /A dock is allowed to finish a full load[\s\S]*fastFirst: opts\.fastFirst/,
    'sidebar task-date reads must use an available task-store snapshot before waiting for a full load',
);
assert.match(
    source,
    /const rangeKey = `\$\{version\}\|\$\{startMs\}\|\$\{endMs\}`;[\s\S]*Date\.now\(\) - Number\(cached\.ts \|\| 0\) < 1200/,
    'tomato history range requests must use a short versioned cache',
);
assert.match(
    source,
    /async function loadRecordsForRange\(rangeStart, rangeEnd\)[\s\S]*if \(!s\.linkDockTomato\) return \[\];[\s\S]*if \(s\.showTomatoMaster === false\) return \[\];/,
    'hidden sidebar tomato records must not pre-read Dock Tomato history',
);
assert.match(
    source,
    /function peekReminderBlocks\(\)[\s\S]*function peekCnHolidayYear\(year\)[\s\S]*cachedHolidayParts[\s\S]*remindersNeedBackgroundRead/,
    'optional reminder and holiday data must use snapshots on the calendar paint path',
);
assert.match(
    source,
    /deferFullLoad: taskDateCalendarName === 'side'[\s\S]*side-taskdate-background-complete/,
    'side task-date sources must defer the authoritative full load after fast-first paint',
);
assert.match(
    source,
    /const DOCK_HISTORY_PAINT_BUDGET_MS = 120;[\s\S]*peekRecordsForRange\(info\.start, info\.end\)[\s\S]*historyNeedsBackgroundRead[\s\S]*optionalBackgroundPromise[\s\S]*deferCalendarTomatoHistoryRefetch\(optionalBackgroundPromise/,
    'cold tomato history and optional auxiliary data must paint from snapshots and refetch after cache-miss reads complete',
);
assert.match(
    source,
    /const auxReadIncomplete = historyNeedsBackgroundRead[\s\S]*if \(info\?\.context\?\.sourceRefetch === true[\s\S]*&& auxReadIncomplete[\s\S]*failure\(new Error\('calendar-aux-partial-result'\)\)/,
    'normal page navigation must not preserve overlapping events from the previous page',
);
assert.match(
    runtimeSource,
    /scheduleTaskDateCacheWarm\('taskdate-side-deferred'\)/,
    'side task-date queries must warm the shared cache without blocking the source request',
);
assert.match(
    source,
    /let pending = state\.dockHistoryRangeInflight\.get\(rangeKey\);[\s\S]*state\.dockHistoryRangeInflight\.set\(rangeKey, pending\);/,
    'parallel tomato history requests must share one in-flight request',
);
assert.match(
    source,
    /function findMaterializedDockHistoryRange\([\s\S]*cachedStart > requestedStart \|\| cachedEnd < requestedEnd[\s\S]*findMaterializedDockHistoryRange\(startMs, endMs, version\)/,
    'a materialized larger tomato range must serve contained view ranges',
);
assert.match(
    source,
    /state\.tomatoListener = \(ev\) => \{[\s\S]*clearDockHistoryRangeCache\(\);[\s\S]*scheduleReminderCalendarRefetch\(\);/,
    'tomato history updates must invalidate range results before refetching',
);
assert.match(
    source,
    /state\.tomatoListener = \(ev\) => \{[\s\S]*dockHistoryReadInFlight[\s\S]*dockHistoryLastInvalidationAt[\s\S]*< 750/,
    'tomato history notifications must be coalesced while a range read or recent invalidation is settling',
);
assert.match(
    source,
    /function isCalendarAuxRangeMaterialized\(rangeStart, rangeEnd\)[\s\S]*peekRecordsForRange\(rangeStart, rangeEnd\)[\s\S]*peekReminderBlocks\(\)/,
    'deferred auxiliary refetches must verify all snapshots are materialized before scheduling another source request',
);
assert.match(
    source,
    /async function loadCnHolidayYearUncached\(year, options = \{\}\)[\s\S]*async function loadCnHolidayYear\(year, options = \{\}\)[\s\S]*cnHolidayInflight/,
    'holiday year reads must share one in-flight request per year',
);
assert.match(
    source,
    /state\.dockHistoryRangeVersion = \(Number\(state\.dockHistoryRangeVersion \|\| 0\) \+ 1\)[\s\S]*state\.linkedDocIdInflight\.clear\(\)[\s\S]*state\.scheduleTaskTitleInflight\.clear\(\)/,
    'calendar unmount must invalidate late reads and release auxiliary query caches',
);
assert.match(
    source,
    /const renderKey = `\$\{state\.miniMonthKey\}\|\$\{selectedKey\}\|\$\{firstDay\}\|\$\{formatDateKey\(new Date\(\)\)\}`;[\s\S]*if \(state\.miniRenderKey === renderKey && state\.miniAbort\) return;/,
    'the sidebar mini calendar must reuse unchanged DOM and listeners',
);

const rangeStart = source.indexOf('    async function loadScheduleForRange');
const rangeEnd = source.indexOf('    function __tmNormalizeTaskTitleFromRow', rangeStart);
assert.ok(rangeStart >= 0 && rangeEnd > rangeStart, 'schedule range loader must remain inspectable');

let loadCount = 0;
let occurrenceCheckCount = 0;
const runtimeState = {
    scheduleCache: { loadedAt: 1 },
    scheduleRangeCache: new Map(),
    scheduleRangeInflight: new Map(),
};
const context = {
    state: runtimeState,
    formatDateKey(value) { return value instanceof Date ? value.toISOString().slice(0, 10) : ''; },
    toMs(value) { return value instanceof Date ? value.getTime() : Number(value); },
    async loadScheduleAll() {
        loadCount += 1;
        await Promise.resolve();
        return [{ id: 'a' }, { id: 'b' }];
    },
    hasScheduleOccurrenceInRange(item) {
        occurrenceCheckCount += 1;
        return item.id === 'a';
    },
};
vm.createContext(context);
vm.runInContext(`${source.slice(rangeStart, rangeEnd)}\nthis.loadRange = loadScheduleForRange;`, context);

(async () => {
    const start = new Date('2026-07-01T00:00:00Z');
    const end = new Date('2026-08-01T00:00:00Z');
    const [first, second] = await Promise.all([
        context.loadRange(start, end),
        context.loadRange(start, end),
    ]);
    assert.equal(loadCount, 1, 'parallel range requests must load schedules once');
    assert.equal(occurrenceCheckCount, 2, 'parallel range requests must filter the schedule list once');
    assert.deepEqual(first.map((item) => item.id), ['a']);
    assert.deepEqual(second.map((item) => item.id), ['a']);

    await context.loadRange(start, end);
    assert.equal(loadCount, 1, 'a repeated request inside the short TTL must reuse its result');
    assert.equal(occurrenceCheckCount, 2, 'a cached range must not repeat recurrence checks');

    console.log('calendar loading performance contract tests passed');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
