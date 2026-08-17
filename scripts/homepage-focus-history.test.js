const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'homepage.js'), 'utf8');
const runtimeSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'task-horizon', 'main', '20-api-and-runtime-services.js'), 'utf8');

assert.match(source, /__tmFocusStatisticsService/, 'homepage focus data must come from the shared statistics service');
assert.match(source, /bucket:\s*"day"[\s\S]*groupBy:\s*"task"/, 'homepage must request daily task statistics directly');
assert.match(source, /FOCUS_STATS_CONTRACT_VERSION = 2/, 'homepage must declare the compatible statistics DTO version once');
assert.match(source, /Number\(records\.contractVersion\) === FOCUS_STATS_CONTRACT_VERSION/,
    'homepage must reject incompatible statistics DTOs');
assert.match(source, /records\?\.totals\?\.buckets/, 'calendar and daily totals must use service buckets');
assert.match(source, /records\?\.tasks/, 'task rows must use semantically projected task aggregates');
assert.match(source, /service\.queryFocus\(options, control\)/,
    'homepage queries must let the shared service stop superseded projection work');
assert.match(source, /function isTomatoFocusStatisticsAvailable\(\)[\s\S]*service\.isAvailable\(\) === true/,
    'homepage focus visibility must follow the shared service capability check');
assert.match(source, /function isTomatoPluginPresent\(\)[\s\S]*globalThis\.__dockTomato[\s\S]*siyuan-plugin-docktomato[\s\S]*function shouldRenderFocusSection\(ctx\)[\s\S]*tomatoIntegrationEnabled === true[\s\S]*isTomatoPluginPresent\(\) \|\| isTomatoFocusStatisticsAvailable\(\)/,
    'homepage must reserve the focus module while an installed DockTomato runtime initializes statistics');
assert.match(source, /readHomepageModuleOrder\(\)[\s\S]*filter\(\(id\) => id !== "focus" \|\| shouldRenderFocusSection\(runtime\.ctx \|\| \{\}\)\)/,
    'homepage settings must use the same stable focus-module visibility rule');
assert.match(runtimeSource, /__tmTomatoStatsAvailabilityHandler = \(\) =>[\s\S]*__tmScheduleHomepageRefresh\('tomato-stats-availability-changed', 0\)/,
    'an already open homepage must react when DockTomato is loaded or unloaded');
const availabilityHandlerStart = runtimeSource.indexOf('        __tmTomatoStatsAvailabilityHandler = () =>');
const availabilityHandlerEnd = runtimeSource.indexOf('        __tmTomatoDefaultDurationChangedHandler = () =>', availabilityHandlerStart);
assert.ok(availabilityHandlerStart >= 0 && availabilityHandlerEnd > availabilityHandlerStart,
    'Tomato statistics availability handler must remain inspectable');
assert.doesNotMatch(runtimeSource.slice(availabilityHandlerStart, availabilityHandlerEnd), /__tmTomatoHistoryVersion/,
    'statistics startup transitions must not invalidate loaded homepage data or make the module blink');
assert.match(runtimeSource, /on\?\.\(window, 'tomato:stats-availability-changed', __tmTomatoStatsAvailabilityHandler\)/,
    'the Tomato statistics availability handler must be registered through the shared event lifecycle');
const visibilityStart = source.indexOf('    function isTomatoFocusStatisticsAvailable()');
const visibilityEnd = source.indexOf('    function hashFocusScopeTaskIDs', visibilityStart);
assert.ok(visibilityStart >= 0 && visibilityEnd > visibilityStart, 'focus visibility policy must remain extractable');
const visibilityContext = vm.createContext({ globalThis: null });
visibilityContext.globalThis = visibilityContext;
vm.runInContext(`${source.slice(visibilityStart, visibilityEnd)}\nthis.shouldRenderFocusSection = shouldRenderFocusSection;`, visibilityContext);
assert.equal(visibilityContext.shouldRenderFocusSection({ tomatoIntegrationEnabled: true }), false,
    'focus statistics must stay hidden when DockTomato is not installed');
visibilityContext.siyuan = { plugins: [{ name: 'siyuan-plugin-docktomato' }] };
assert.equal(visibilityContext.shouldRenderFocusSection({ tomatoIntegrationEnabled: true }), true,
    'the registered DockTomato plugin must reserve the focus module before its renderer facade is ready');
visibilityContext.siyuan = { plugins: [] };
visibilityContext.__dockTomato = {};
assert.equal(visibilityContext.shouldRenderFocusSection({ tomatoIntegrationEnabled: true }), true,
    'an installed DockTomato runtime must keep a stable focus-module placeholder during startup');
assert.equal(visibilityContext.shouldRenderFocusSection({ tomatoIntegrationEnabled: false }), false,
    'disabling Tomato integration must still hide the focus module');
const payloadStart = source.indexOf('    async function loadTomatoFocusPayload');
const payloadEnd = source.indexOf('    function buildFocusCalendarKey', payloadStart);
const payloadBlock = source.slice(payloadStart, payloadEnd);
assert.ok(payloadBlock.indexOf('if (!isTomatoFocusStatisticsAvailable())') < payloadBlock.indexOf('loadTomatoUserSettings()'),
    'missing DockTomato must skip settings and statistics reads before they start');
assert.match(source, /Array\.isArray\(options\.taskIDs\)\s*&&\s*options\.taskIDs\.length\s*===\s*0[\s\S]*return \{ stats: null, unavailable: false, emptyScope: true \}/,
    'an explicitly empty homepage task scope must skip the Tomato statistics query without reporting an error');
assert.match(source, /function ensureFocusStatsLoaded\(ctx\)[\s\S]*if \(!isTomatoFocusStatisticsAvailable\(\)\) return true;[\s\S]*loadTomatoFocusPayload/,
    'the stable startup placeholder must not trigger focus history IO before the statistics facade is ready');
const coverageStart = source.indexOf('    function focusStatisticsCoverMonth');
const coverageEnd = source.indexOf('    function setLoadedFocusCalendar', coverageStart);
assert.ok(coverageStart >= 0 && coverageEnd > coverageStart, 'focus calendar range coverage must remain available');
assert.match(source.slice(coverageStart, coverageEnd), /stats\?\.range\?\.from[\s\S]*stats\?\.range\?\.to/,
    'calendar coverage must validate both statistics range boundaries');
const calendarSyncStart = source.indexOf('    function syncFocusCalendarFromStatistics');
const calendarSyncEnd = source.indexOf('    function ensureFocusCalendarLoaded', calendarSyncStart);
assert.ok(calendarSyncStart >= 0 && calendarSyncEnd > calendarSyncStart, 'focus calendar summary reuse must remain available');
assert.match(source.slice(calendarSyncStart, calendarSyncEnd), /focusStatisticsCoverMonth\(ctx, stats, month\)[\s\S]*buildFocusCalendarKey\(ctx, month\.key\)/,
    'the initial calendar must reuse homepage statistics when their range covers the visible month');
const renderStart = source.indexOf('    function doRender()');
const renderEnd = source.indexOf('    function doRenderRangeOnly()', renderStart);
assert.doesNotMatch(source.slice(renderStart, renderEnd), /ensureFocusCalendarLoaded/,
    'homepage initial render must not start a second calendar statistics query');
assert.doesNotMatch(source, /__dockTomato\?\.history\?\.loadRange/, 'homepage must not load raw Tomato history');
assert.doesNotMatch(source, /function getHistoryRecordOverlapSeconds/, 'homepage must not keep a duplicate duration calculator');
assert.doesNotMatch(source, /function buildFocusTaskIndex/, 'homepage must not duplicate task association logic');
assert.doesNotMatch(source, /function mergeFocusRecords/, 'homepage must not merge raw history records');

const queryStart = source.indexOf('    function buildHomepageFocusQueryOptions');
const queryEnd = source.indexOf('    async function loadTomatoFocusStatistics', queryStart);
assert.ok(queryStart >= 0 && queryEnd > queryStart, 'homepage focus query builder must remain available');
const queryBlock = source.slice(queryStart, queryEnd);
assert.match(queryBlock, /if \(!isGlobalFocusScope\(ctx\)\)/, 'non-global homepage views must scope statistics');
assert.match(queryBlock, /const scope = buildFocusScopeDescriptor\(ctx\)[\s\S]*options\.taskIDs = scope\.taskIDs/, 'homepage scope must use the canonical projected task IDs');
assert.match(source, /FOCUS_SCOPE_TASK_ID_LIMIT = 10000[\s\S]*function buildFocusScopeDescriptor[\s\S]*while \(stack\.length\)[\s\S]*taskIDs\.length > FOCUS_SCOPE_TASK_ID_LIMIT/,
    'homepage task scope traversal must be iterative and bounded');
assert.doesNotMatch(source.slice(source.indexOf('    function buildFocusScopeKey'), source.indexOf('    function buildFocusLoadKey')), /taskIDs\.join/,
    'homepage cache keys must not concatenate every task ID');

const loadKeyStart = source.indexOf('    function buildFocusLoadKey');
const loadKeyEnd = source.indexOf('    function normalizeTomatoUserSettings', loadKeyStart);
const loadKeyBlock = source.slice(loadKeyStart, loadKeyEnd);
assert.match(loadKeyBlock, /buildFocusScopeKey\(ctx\)/, 'focus cache keys must change with document groups and projected task IDs');
const calendarKeyStart = source.indexOf('    function buildFocusCalendarKey');
const calendarKeyEnd = source.indexOf('    function ensureFocusCalendarLoaded', calendarKeyStart);
assert.match(source.slice(calendarKeyStart, calendarKeyEnd), /buildFocusScopeKey\(ctx\)/, 'calendar cache keys must change with document groups');
assert.match(source, /FOCUS_CALENDAR_CACHE_LIMIT = 12[\s\S]*FOCUS_CALENDAR_CACHE_BYTE_LIMIT = 4 \* 1024 \* 1024/,
    'calendar result reuse must have count and approximate byte budgets');
assert.match(source, /const slotKey = key\.replace\(\/:v\\d\+\$\/, ""\)[\s\S]*cachedSlotKey === slotKey[\s\S]*deleteFocusCalendarCacheEntry/,
    'a new history revision must replace the prior cache entry for the same scope and month');
assert.match(source, /while \(cache\.size > FOCUS_CALENDAR_CACHE_LIMIT[\s\S]*runtime\.focusCalendarCacheBytes > FOCUS_CALENDAR_CACHE_BYTE_LIMIT/,
    'calendar cache eviction must enforce both budgets');
const cacheStart = source.indexOf('function estimateFocusCalendarCacheBytes(');
const cacheEnd = source.indexOf('function focusStatisticsCoverMonth(', cacheStart);
assert.ok(cacheStart >= 0 && cacheEnd > cacheStart, 'calendar cache implementation must remain extractable');
const cacheContext = vm.createContext({
    Array,
    Map,
    Math,
    Number,
    Object,
    String,
    WeakSet,
    FOCUS_CALENDAR_CACHE_LIMIT: 12,
    FOCUS_CALENDAR_CACHE_BYTE_LIMIT: 1024,
    FOCUS_STATS_CONTRACT_VERSION: 2,
    runtime: { focusCalendarCache: new Map(), focusCalendarCacheBytes: 0 },
    toNumber: (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback,
});
vm.runInContext(`${source.slice(cacheStart, cacheEnd)}\nthis.cacheApi = { readFocusCalendarCache, writeFocusCalendarCache };`, cacheContext);
const statsV1 = { contractVersion: 2, range: {}, tasks: [{ id: 'a' }] };
const statsV2 = { contractVersion: 2, range: {}, tasks: [{ id: 'b' }] };
assert.equal(cacheContext.cacheApi.writeFocusCalendarCache('scope:2026-01:v1', statsV1), true);
assert.equal(cacheContext.cacheApi.writeFocusCalendarCache('scope:2026-01:v2', statsV2), true);
assert.equal(cacheContext.runtime.focusCalendarCache.size, 1,
    'same-month history revisions must not accumulate duplicate snapshots');
assert.equal(cacheContext.cacheApi.readFocusCalendarCache('scope:2026-01:v1'), null);
assert.equal(cacheContext.cacheApi.readFocusCalendarCache('scope:2026-01:v2').tasks[0].id, 'b');
for (let month = 2; month <= 20; month += 1) {
    cacheContext.cacheApi.writeFocusCalendarCache(`scope:2026-${String(month).padStart(2, '0')}:v2`, statsV2);
}
assert.ok(cacheContext.runtime.focusCalendarCache.size <= 12);
assert.ok(cacheContext.runtime.focusCalendarCacheBytes <= 1024);
assert.equal(cacheContext.cacheApi.writeFocusCalendarCache('scope:oversized:v1', {
    contractVersion: 2,
    payload: 'x'.repeat(2000),
}), false, 'an oversized statistics graph must remain usable without becoming resident cache');
assert.match(source, /ensureFocusCalendarLoaded[\s\S]*readFocusCalendarCache\(key\)[\s\S]*focusStatisticsCoverMonth\(ctx, summaryStats, month\)[\s\S]*loadTomatoFocusStatistics/,
    'month switches must reuse exact or already-covered statistics before issuing another query');
assert.match(source, /if \(payload\?\.stats\) writeFocusCalendarCache\(key, payload\.stats\);[\s\S]*updateFocusCalendarSlot/,
    'month query completion must update only the calendar surface');
assert.match(source, /data-tm-home-focus-calendar-month[\s\S]*ensureFocusCalendarLoaded\(ctx, nextMonth\)[\s\S]*updateFocusCalendarSlot/,
    'month navigation must avoid replacing the complete focus panel');

console.log('homepage focus statistics contract tests passed');
