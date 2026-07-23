const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');

assert.match(
    source,
    /const mainCalendarEventSourceRequestSignatures = new Map\(\);[\s\S]*rememberMainCalendarEventSourceRequest\(EVENT_SOURCE_IDS\.mainAux[\s\S]*rememberMainCalendarEventSourceRequest\(EVENT_SOURCE_IDS\.mainSchedule[\s\S]*rememberMainCalendarEventSourceRequest\(EVENT_SOURCE_IDS\.mainTaskDate/,
    'all main event sources must record their requested view and range',
);
assert.match(
    source,
    /sourceIds\.every\(\(sourceId\) => mainCalendarEventSourceRequestSignatures\.get\(sourceId\) === expectedSignature\)[\s\S]*view-type-refetch-skip[\s\S]*calendar\.refetchEvents/,
    'view changes must skip the fallback refetch only after every source requested the new range',
);
assert.match(
    source,
    /function setScheduleCache\(items, sourceSignature\)[\s\S]*state\.scheduleRangeCache\.clear\(\)/,
    'schedule mutations and reloads must invalidate completed range results',
);
assert.match(
    source,
    /const pending = state\.scheduleRangeInflight\.get\(rangeKey\);[\s\S]*if \(pending\) return \(await pending\)\.slice\(\);/,
    'parallel schedule sources must share one range computation',
);
assert.match(
    source,
    /async function __tmBuildTaskDateSourceEvents[\s\S]*if \(!settings\.showTaskDates\) return \[\];[\s\S]*needsScheduleTaskDaySet \? loadScheduleForRange\(start, end\)/,
    'disabled task dates and views without schedule dedupe must not load schedule ranges',
);
assert.match(
    source,
    /const rangeKey = `\$\{version\}\|\$\{startMs\}\|\$\{endMs\}`;[\s\S]*Date\.now\(\) - Number\(cached\.ts \|\| 0\) < 1200/,
    'tomato history range requests must use a short versioned cache',
);
assert.match(
    source,
    /let pending = state\.dockHistoryRangeInflight\.get\(rangeKey\);[\s\S]*state\.dockHistoryRangeInflight\.set\(rangeKey, pending\);/,
    'parallel tomato history requests must share one in-flight request',
);
assert.match(
    source,
    /state\.tomatoListener = \(ev\) => \{[\s\S]*clearDockHistoryRangeCache\(\);[\s\S]*scheduleReminderCalendarRefetch\(\);/,
    'tomato history updates must invalidate range results before refetching',
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
