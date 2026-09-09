'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'calendar-view.css'), 'utf8');
const storeSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const exportSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/64-export-runtime.js'), 'utf8');
const extract = (startMarker, endMarker) => {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    assert.ok(start >= 0 && end > start, `${startMarker} must remain inspectable`);
    return source.slice(start, end);
};
const context = {
    Date, Map, Set,
    window: { innerWidth: 1280 },
    isLikelyMobileRuntime: () => false,
    getSettings: () => ({}),
    getPrototypeHourHeight: () => 48,
    PROTOTYPE_TIME_COLLAPSE_BAND_HEIGHT: 28,
    esc: (value) => String(value ?? ''),
    pad2: (value) => String(value).padStart(2, '0'),
    formatDateKey: (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    parseDateOnly: (value) => new Date(`${String(value).slice(0, 10)}T00:00:00`),
    toMs: (value) => new Date(value).getTime(),
    isScheduleAllDayBottom: (event) => event.__tmAllDayBottom === true,
};
for (const name of [
    'normalizeCalendarWeekAllDayVisibleRows',
    'normalizeCalendarVisibleTime',
    'getCalendarVisibleSlotRange',
    'getPrototypeTimelineMetrics',
    'getPrototypeTimelineVisibleEventSegments',
    'prototypeTimelineYForMinute',
    'resolveSharedPrototypeEventStart',
    'countSharedPrototypeAllDayEvents',
    'buildSharedPrototypeAllDayToggleMarkup',
    'buildSharedPrototypeTimelineMarkup',
]) {
    const body = extract(`    function ${name}(`, '\n    function ');
    vm.runInNewContext(`${body}\nglobalThis.${name} = ${name};`, context);
}
vm.runInNewContext([
    extract('    function resolveSharedPrototypeEventEnd(', '    function resolveSharedPrototypeEventStart('),
    extract('        const protoSafeDate =', '        const protoTimeMinutes ='),
    extract('        const protoEventSource =', '        const protoEventTime ='),
    extract('        const protoEventIsAllDayBottom =', '        const protoLunarText ='),
    extract('        const protoRangeEvents =', '        const protoSpanMarkup ='),
    extract('            const protoMonthSpanLayout =', '        const protoBuildMonthCompactedLayout ='),
    'globalThis.spanLayout = protoMonthSpanLayout;',
].join('\n'), context);

for (const [input, expected] of [[undefined, 5], ['invalid', 5], [Infinity, 5], [0, 1], [-2, 1], [1, 1], [5, 5], ['15', 15], [99, 15], [7.6, 8]]) {
    assert.equal(context.normalizeCalendarWeekAllDayVisibleRows(input), expected);
}
const day = new Date(2026, 8, 9);
const makeEvents = (count, span = false) => Array.from({ length: count }, (_, index) => ({
    id: `${span ? 'span' : 'regular'}-${String(index).padStart(2, '0')}`,
    allDay: true,
    start: day,
    end: new Date(2026, 8, span ? 12 : 10),
    extendedProps: { __tmSource: 'schedule' },
}));
const timedEvent = {
    id: 'completed-timed',
    allDay: false,
    start: new Date(2026, 8, 9, 10),
    end: new Date(2026, 8, 9, 11),
    extendedProps: { done: true },
};
const render = (rows, events, extra = {}) => context.buildSharedPrototypeTimelineMarkup({
    days: [day],
    events: [...events, timedEvent],
    settings: { weekAllDayVisibleRows: rows, visibleStartTime: '00:00', visibleEndTime: '24:00' },
    eventEnd: (event) => event.end,
    eventMarkup: (event, mode) => `<div data-test-mode="${mode}" data-tm-proto-event="${event.id}" style="--tm-proto-event-color:red"></div>`,
    spanMarkup: (event, date, segment) => `<div data-test-span="${event.id}" data-test-lane="${segment.lane}"></div>`,
    ...extra,
});
const regularCount = (markup) => (markup.match(/data-test-mode="allday"/g) || []).length;
const spanCount = (markup) => (markup.match(/data-test-span=/g) || []).length;

for (const [rows, count, visible, hidden] of [[undefined, 6, 4, 2], [1, 1, 1, 0], [1, 2, 0, 2], [5, 5, 5, 0], [15, 15, 15, 0], [15, 16, 14, 2]]) {
    const markup = render(rows, makeEvents(count));
    assert.equal(regularCount(markup), visible, `${rows} rows must respect the regular-event budget`);
    if (hidden) assert.ok(markup.includes(`+${hidden} 项`), 'overflow must include the event displaced by the +N row');
    else assert.doesNotMatch(markup, /class="tm-proto-more"/, 'exact-fit events must not be folded');
    assert.match(markup, /data-test-mode="block" data-tm-proto-lane=.*data-tm-proto-event="completed-timed"/, 'all-day row limits must not affect completed timed schedules');
}

for (const spanLayout of [undefined, context.spanLayout]) {
    for (const [rows, count, visible, hidden] of [[1, 1, 1, 0], [1, 2, 0, 2], [5, 5, 5, 0], [15, 15, 15, 0], [15, 16, 14, 2]]) {
        const markup = render(rows, makeEvents(count, true), { spanLayout });
        assert.equal(spanCount(markup), visible, `${rows} rows must also control cross-day lanes`);
        if (hidden) assert.ok(markup.includes(`+${hidden} 项`));
        else assert.doesNotMatch(markup, /class="tm-proto-more"/);
    }
    const mixed = render(5, [...makeEvents(5, true), ...makeEvents(2)], { spanLayout });
    assert.equal(spanCount(mixed), 4);
    assert.equal(regularCount(mixed), 0);
    assert.ok(mixed.includes('+3 项'), 'cross-day and regular overflow must share a single accurate +N count');
}

const collapsed = render(15, [...makeEvents(16), ...makeEvents(2, true)], { allDayCollapsed: true });
assert.equal(regularCount(collapsed) + spanCount(collapsed), 0);
assert.match(collapsed, /aria-label="查看当天 18 个全天日程">\+18/);
assert.match(render(15, makeEvents(15)), /--tm-proto-allday-max-height:383px/);
assert.match(styles, /\.tm-proto-allday\{[^}]*max-height:\s*var\(--tm-proto-allday-max-height, 140px\)/);
assert.match(styles, /\.tm-proto-day-panel-allday\{[^}]*max-height:\s*var\(--tm-proto-allday-max-height, 140px\) !important/);
assert.match(styles, /\.tm-proto-allday\.is-collapsed\{[^}]*max-height:\s*32px/);
assert.match(source, /spanLayout: \(visibleDays, spanEvents, laneLimit\) => protoMonthSpanLayout\(visibleDays, spanEvents, laneLimit\)/);
assert.match(source, /data-tm-cal-setting="calendarWeekAllDayVisibleRows"/);
assert.match(source, /Array\.from\(\{ length: 15 \}/);
assert.match(source, /weekAllDayVisibleRows: weekAllDayVisibleRows0/);
assert.match(source, /normalizeCalendarWeekAllDayVisibleRows\(readStoredString\('tm_calendar_week_all_day_visible_rows', s\.calendarWeekAllDayVisibleRows\)/);
assert.match(source, /key === 'calendarWeekAllDayVisibleRows'\) \{\s*store\.data\[key\] = normalizeCalendarWeekAllDayVisibleRows\(el\.value\)/);
assert.match(source, /key === 'calendarWeekAllDayVisibleRows'\) \{\s*try \{ state\.queuePrototypeSurfaceRender\?\.\(\); \} catch \(e2\) \{\}\s*try \{ state\.sideDay\?\.prototypeRender\?\.\(\)/);
assert.match(storeSource, /calendarWeekAllDayVisibleRows: 5/);
assert.match(exportSource, /'calendarWeekAllDayVisibleRows'/);

const persisted = new Map();
const storageContext = {
    data: { calendarWeekAllDayVisibleRows: 15 },
    cloudData: { calendarWeekAllDayVisibleRows: 9 },
    Storage: { set: (key, value) => persisted.set(key, value), get: (key, fallback) => persisted.get(key) ?? fallback },
};
const storeStatement = (pattern) => {
    const match = storeSource.match(pattern);
    assert.ok(match, 'the setting must participate in the full persistence lifecycle');
    vm.runInNewContext(match[0], storageContext);
};
storeStatement(/Storage\.set\('tm_calendar_week_all_day_visible_rows'[^;]+;/);
storageContext.data.calendarWeekAllDayVisibleRows = 5;
storeStatement(/this\.data\.calendarWeekAllDayVisibleRows = Number\(Storage\.get\([^;]+;/);
assert.equal(storageContext.data.calendarWeekAllDayVisibleRows, 15, 'local reload must preserve the chosen row count');
storeStatement(/if \(typeof cloudData\.calendarWeekAllDayVisibleRows[^;]+;/);
assert.equal(storageContext.data.calendarWeekAllDayVisibleRows, 9, 'cloud restore must include the row count');
const normalizeStore = storeSource.match(/\{\s*const weekAllDayVisibleRows = Number\(this\.data\.calendarWeekAllDayVisibleRows\);[\s\S]*?\}/)?.[0];
assert.ok(normalizeStore);
for (const [input, expected] of [[undefined, 5], ['invalid', 5], [0, 1], [99, 15], [7.6, 8]]) {
    storageContext.data.calendarWeekAllDayVisibleRows = input;
    vm.runInNewContext(normalizeStore, storageContext);
    assert.equal(storageContext.data.calendarWeekAllDayVisibleRows, expected);
}

console.log('calendar week all-day rows contract tests passed');
