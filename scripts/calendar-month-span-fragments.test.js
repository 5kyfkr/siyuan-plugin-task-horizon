'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'calendar-view.js'), 'utf8');
const extract = (startMarker, endMarker) => {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    assert.ok(start >= 0 && end > start, `${startMarker} must remain inspectable`);
    return source.slice(start, end);
};
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const context = {
    Date, Map, Set,
    formatDateKey: dateKey,
    parseDateOnly: (value) => new Date(`${String(value).slice(0, 10)}T00:00:00`),
    toMs: (value) => new Date(value).getTime(),
    isScheduleAllDayBottom: (event) => event.__tmAllDayBottom === true,
    esc: (value) => String(value ?? ''),
    getSettings: () => ({}),
    isCalendarBuiltinScheduleEvent: () => true,
    shouldShowCalendarEventCheckbox: () => true,
    buildCalendarRecurringTaskIconMarkup: () => '',
    resolveCalendarEventDoneState: (ext) => ext.done === true,
    getCalendarEventColor: () => '#527acc',
    protoEventColor: () => '#527acc',
    isCompactDockLayout: () => false,
};
vm.runInNewContext([
    extract('    function resolveSharedPrototypeEventEnd(', '    function countSharedPrototypeAllDayEvents('),
    extract('    function buildSharedPrototypeSpanMarkup(', '    function buildSharedPrototypeTimelineMarkup('),
    extract('        const protoSafeDate =', '        const protoTimeMinutes ='),
    extract('        const protoEventSource =', '        const protoEventTime ='),
    extract('        const protoEventIsAllDayBottom =', '        const protoLunarText ='),
    extract('        const protoRangeEvents =', '        const protoSpanMarkup ='),
    extract('        const protoSpanMarkup =', '        const protoEventMarkup ='),
    extract('            const protoMonthSpanLayout =', '        const protoRenderMonthSection ='),
    'globalThis.buildLayout = protoBuildMonthCompactedLayout;',
    'globalThis.renderSpan = protoSpanMarkup;',
].join('\n'), context);

const days = Array.from({ length: 14 }, (_, index) => new Date(2026, 8, 7 + index));
const makeSpan = (id, start = 0, end = 7) => ({
    id, title: id, allDay: true,
    start: new Date(2026, 8, 7 + start),
    end: new Date(2026, 8, 7 + end),
    extendedProps: { __tmSource: 'schedule' },
});
const buildLayout = (events, capacities = new Map(), visibleDays = days) => context.buildLayout(visibleDays, events, {
    defaultCapacity: 8,
    spanLimit: 8,
    capacityByDay: capacities,
});
const segmentsOf = (layout, event) => Array.from(layout.spanLayout.starts.values()).flat().filter((segment) => segment.eventApi === event);
const markupFor = (event, segment, shared = false) => shared
    ? context.buildSharedPrototypeSpanMarkup(event, days[segment.segmentStartIndex], {}, segment, true, 'dayGridMonth')
    : context.renderSpan(event, days[segment.segmentStartIndex], segment, 'dayGridMonth');
const assertNoResize = (event, segment) => {
    for (const shared of [false, true]) {
        const markup = markupFor(event, segment, shared);
        assert.ok(markup.includes(`data-tm-proto-event="${event.id}"`), 'a clipped fragment must remain an interactive event');
        assert.ok(markup.includes(`<span class="tm-proto-span-title">${event.title}</span>`), 'every visible fragment must retain its title');
        assert.doesNotMatch(markup, /data-tm-proto-resize=/, 'neither date-range handle may appear on a clipped fragment');
    }
};

const whole = makeSpan('whole-span');
const wholeSegment = segmentsOf(buildLayout([whole]), whole)[0];
assert.equal(wholeSegment.days, 7, 'a fitting same-week span must remain uninterrupted');
for (const shared of [false, true]) {
    const markup = markupFor(whole, wholeSegment, shared);
    assert.match(markup, /data-tm-proto-resize="start"/);
    assert.match(markup, /data-tm-proto-resize="end"/);
}

const clippedCapacities = new Map([[dateKey(days[2]), 0], [dateKey(days[4]), 0]]);
const clipped = buildLayout([whole], clippedCapacities);
const clippedSegments = segmentsOf(clipped, whole);
assert.deepEqual(clippedSegments.map((segment) => [segment.segmentStartIndex, segment.segmentEndIndex]), [[0, 2], [3, 4], [5, 7]]);
clippedSegments.forEach((segment) => assertNoResize(whole, segment));
assert.equal(clipped.moreByDay.get(1), 0);
assert.equal(clipped.moreByDay.get(2), 1);
assert.equal(clipped.moreByDay.get(3), 0, 'a one-day fragment must be shown instead of forced into +N');

for (const event of [makeSpan('wrap-week', 4, 11), makeSpan('before-window', -2, 3), makeSpan('after-window', 11, 17)]) {
    segmentsOf(buildLayout([event]), event).forEach((segment) => assertNoResize(event, segment));
}
const scheduleSplit = makeSpan('schedule-split', 0, 3);
scheduleSplit.extendedProps = { __tmSource: 'taskdate', __tmTaskDateScheduleSplit: true, __tmScheduledTaskDayKeys: [dateKey(days[1])] };
const scheduleLayout = buildLayout([scheduleSplit]);
segmentsOf(scheduleLayout, scheduleSplit).forEach((segment) => assertNoResize(scheduleSplit, segment));
assert.equal(scheduleLayout.moreByDay.get(1), 0, 'task-date deduplication must not reappear in the overflow count');

const first = makeSpan('first', 0, 2);
const second = makeSpan('second', 1, 4);
const continuous = buildLayout([first, second]);
assert.equal(segmentsOf(continuous, second).length, 1, 'spare capacity must preserve continuity even when a lower lane becomes free');
assert.equal(segmentsOf(continuous, second)[0].lane, 1);
const changedLane = buildLayout([first, second], new Map([[dateKey(days[2]), 1]]));
const changedSegments = segmentsOf(changedLane, second);
assert.deepEqual(changedSegments.map((segment) => [segment.segmentStartIndex, segment.segmentEndIndex, segment.lane]), [[1, 2, 1], [2, 4, 0]]);
changedSegments.forEach((segment) => assertNoResize(second, segment));
assert.equal(changedLane.moreByDay.get(2), 0, 'a span must move to a free lane rather than disappear');

let seed = 90517;
const random = (limit) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % limit;
};
for (let sample = 0; sample < 100; sample += 1) {
    const events = Array.from({ length: 24 }, (_, index) => {
        const start = random(18) - 2;
        const event = makeSpan(`sample-${sample}-${index}`, start, start + 1 + random(10));
        event.allDay = random(3) !== 0;
        return event;
    });
    const capacities = new Map(days.map((date) => [dateKey(date), random(9)]));
    const snapshot = JSON.stringify(events);
    const layout = buildLayout(events, capacities);
    assert.equal(JSON.stringify(events), snapshot, 'compaction must not mutate schedule dates or completion state');
    days.forEach((date, index) => {
        const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
        const candidates = events.filter((event) => event.start < end && event.end > date);
        const spans = layout.spanLayout.byDay.get(index) || [];
        const regular = layout.visibleRegularByDay.get(index) || [];
        const hidden = layout.moreByDay.get(index) || 0;
        const capacity = capacities.get(dateKey(date));
        const expectedVisible = candidates.length <= capacity ? candidates.length : Math.max(0, capacity - 1);
        assert.equal(spans.length + regular.length, expectedVisible, `sample ${sample}, day ${index}: use every available slot before folding`);
        assert.equal(spans.length + regular.length + hidden, candidates.length, 'every event must appear either visibly or in +N exactly once');
        assert.equal(new Set(spans.map((segment) => segment.lane)).size, spans.length, 'span lanes must not overlap');
        assert.equal(new Set([...spans.map((segment) => segment.eventApi), ...regular]).size, spans.length + regular.length);
        const reserved = layout.spanLayout.reserves.get(index) || 0;
        assert.ok(reserved + regular.length + (hidden ? 1 : 0) <= Math.max(1, capacity), 'span geometry, regular chips and +N must fit within the same cell');
        const hiddenSpans = layout.spanLayout.hiddenByDay.get(index)?.size || 0;
        assert.equal(hiddenSpans + spans.length, candidates.filter((event) => event.allDay && (event.end - event.start) > 86400000).length);
    });
}

console.log('calendar month span fragment tests passed (100 mixed-layout scenarios)');
