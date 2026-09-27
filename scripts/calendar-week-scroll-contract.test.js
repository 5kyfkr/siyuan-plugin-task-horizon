'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const source = read('calendar-view.js');
const styles = read('calendar-view.css');
const dateSource = read('src/calendar/calendar-date.js');
const engineSource = read('src/calendar/calendar-engine.js');

// The week window is a sliding seven-day range, so the range itself is
// verified against the real date math and the real engine instead of only
// matching source text.
const sandbox = {
    console,
    Date,
    Math,
    JSON,
    Number,
    String,
    Array,
    Object,
    Map,
    Set,
    Promise,
    setTimeout,
    clearTimeout,
    requestAnimationFrame: (callback) => setTimeout(callback, 0),
    cancelAnimationFrame: (handle) => clearTimeout(handle),
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
sandbox.__tmCalendarRenderer = {
    createCalendarRenderer: () => ({
        render() {},
        invalidate() {},
        destroy() {},
        buildViewModel: () => ({}),
    }),
};
sandbox.__tmCalendarStore = {
    createCalendarStore: () => ({
        loadSources: async () => ({ stale: false }),
        getEvents: () => [],
        getEventById: () => null,
        beginBatch() {},
        endBatch() {},
        abort() {},
    }),
};
vm.createContext(sandbox);
vm.runInContext(dateSource, sandbox, { filename: 'calendar-date.js' });
vm.runInContext(engineSource, sandbox, { filename: 'calendar-engine.js' });

const dateMath = sandbox.__tmCalendarDate;
const keyOf = (value) => dateMath.formatDateKey(value);
const dayKey = (year, month, day) => keyOf(new Date(year, month - 1, day));

assert.equal(
    keyOf(dateMath.getVisibleRange('timeGridWeek', dayKey(2026, 9, 24), { firstDay: 0 }).start),
    dayKey(2026, 9, 20),
    'the default week range must still snap to the configured week start',
);
assert.equal(
    keyOf(dateMath.getVisibleRange('timeGridWeek', dayKey(2026, 9, 24), { firstDay: 0, weekScroll: true }).start),
    dayKey(2026, 9, 24),
    'the sliding week range must keep the requested anchor day as its first column',
);
assert.equal(
    dateMath.getVisibleRange('timeGridWeek', dayKey(2026, 9, 24), { weekScroll: true }).days,
    7,
    'the sliding week range must always expose exactly seven days',
);

const createEngine = (initialKey, options = {}) => sandbox.__tmCalendarEngine.createCalendarEngine(
    { dataset: {}, setAttribute() {}, removeAttribute() {} },
    {
        initialView: 'timeGridWeek',
        initialDate: initialKey,
        firstDay: 1,
        views: { timeGridWeek: { type: 'timeGridWeek' } },
        ...options,
    },
);

const todayKey = dayKey(2026, 9, 24);
const minKey = dayKey(2026, 9, 18);
// The view layer hands the engine the natural week around today, so the
// window opens with today in the fourth column until the user scrolls.
const engine = createEngine(dayKey(2026, 9, 21), { weekScroll: true, weekScrollToday: todayKey });

assert.equal(keyOf(engine.getDate()), dayKey(2026, 9, 21), 'the engine must start on the requested day');
assert.equal(keyOf(engine.view.activeStart), dayKey(2026, 9, 21), 'the engine keeps the requested day as the first column');
assert.equal(keyOf(engine.view.activeEnd), dayKey(2026, 9, 28), 'the visible window is seven days wide');

let state = engine.getWeekScrollState();
assert.equal(keyOf(state.min), minKey, 'the oldest allowed window starts six days before today');
assert.equal(keyOf(state.max), todayKey, 'the newest allowed window starts on today');
assert.equal(keyOf(state.min), minKey, 'the day scroll range starts six days before today');
assert.equal(keyOf(state.max), todayKey);
assert.equal(state.active, true, 'the feature is active while today is on screen');
assert.equal(state.canEarlier, true);
assert.equal(state.canLater, true);

// Day-granular moves (scroll bar drag, Shift+wheel, keyboard) walk the window
// one day at a time and stop where today would leave the visible week.
assert.equal(engine.stepSlidingWeekDay(1), true);
assert.equal(keyOf(engine.getDate()), dayKey(2026, 9, 22), 'the window walks one day at a time');
assert.equal(engine.view.range.days, 7, 'the range keeps seven columns after a move');
assert.equal(engine.stepSlidingWeekDay(1), true);
assert.equal(engine.stepSlidingWeekDay(1), true);
assert.equal(keyOf(engine.getDate()), todayKey, 'today is leftmost at the future limit');
assert.equal(keyOf(engine.view.activeStart), todayKey);
assert.equal(keyOf(engine.view.activeEnd), dayKey(2026, 10, 1));
assert.equal(engine.getWeekScrollState().canLater, false, 'the day scroll stops at the future limit');
assert.equal(engine.stepSlidingWeekDay(1), false, 'scrolling past today must be rejected');
assert.equal(keyOf(engine.getDate()), todayKey, 'a rejected day step must not move the window');
for (let index = 0; index < 6; index += 1) {
    assert.equal(engine.stepSlidingWeekDay(-1), true, 'the window must keep walking backwards');
}
assert.equal(keyOf(engine.getDate()), minKey, 'today is rightmost at the past limit');
assert.equal(keyOf(engine.view.activeStart), minKey);
assert.equal(keyOf(engine.view.activeEnd), dayKey(2026, 9, 25));
assert.equal(engine.getWeekScrollState().canEarlier, false, 'the day scroll stops at the past limit');
assert.equal(engine.stepSlidingWeekDay(-1), false, 'scrolling before the oldest window must be rejected');

// Toolbar arrows and swipes page whole weeks on the natural-week grid. They
// are never clamped, so repeated taps always keep working.
const pager = createEngine(dayKey(2026, 9, 21), { weekScroll: true, weekScrollToday: todayKey });
assert.equal(pager.next(), true);
assert.equal(keyOf(pager.getDate()), dayKey(2026, 9, 28), 'the forward arrow moves a whole week');
assert.equal(pager.next(), true);
assert.equal(keyOf(pager.getDate()), dayKey(2026, 10, 5), 'the forward arrow keeps working past today');
assert.equal(pager.prev(), true);
assert.equal(pager.prev(), true);
assert.equal(keyOf(pager.getDate()), dayKey(2026, 9, 21), 'paging back returns to the natural week');
assert.equal(pager.prev(), true);
assert.equal(keyOf(pager.getDate()), dayKey(2026, 9, 14), 'the back arrow keeps working before the oldest window');
assert.equal(pager.getWeekScrollState().active, false, 'a week without today deactivates the day scroll');
assert.equal(pager.getWeekScrollState().canEarlier, false, 'an inactive window cannot scroll backwards');
assert.equal(pager.getWeekScrollState().canLater, false, 'an inactive window cannot scroll forwards');
assert.equal(pager.stepSlidingWeekDay(-1), false, 'a week without today must ignore the day scroll');
assert.equal(pager.stepSlidingWeekDay(1), false, 'a week without today must ignore the day scroll forwards');
assert.equal(keyOf(pager.getDate()), dayKey(2026, 9, 14), 'the rejected steps must not move the window');

// A scroll-bar drag re-anchors the pager on the nearest week grid page.
const dragPager = createEngine(dayKey(2026, 9, 21), { weekScroll: true, weekScrollToday: todayKey });
assert.equal(dragPager.stepSlidingWeekDay(-1), true, 'the scroll bar can land between pages');
assert.equal(keyOf(dragPager.getDate()), dayKey(2026, 9, 20));
assert.equal(dragPager.next(), true);
assert.equal(keyOf(dragPager.getDate()), dayKey(2026, 9, 28), 'the next page is the nearest week boundary');
assert.equal(dragPager.prev(), true);
assert.equal(keyOf(dragPager.getDate()), dayKey(2026, 9, 21), 'the previous page is the natural week');

// The window slider walks the range day by day: exactly seven stops.
const walker = createEngine(minKey, { weekScroll: true, weekScrollToday: todayKey });
const stops = [keyOf(walker.getDate())];
for (let index = 0; index < 6; index += 1) {
    assert.equal(walker.stepSlidingWeekDay(1), true, `day step ${index + 1} must be accepted inside the range`);
    stops.push(keyOf(walker.getDate()));
}
assert.deepEqual(stops, [
    dayKey(2026, 9, 18),
    dayKey(2026, 9, 19),
    dayKey(2026, 9, 20),
    dayKey(2026, 9, 21),
    dayKey(2026, 9, 22),
    dayKey(2026, 9, 23),
    dayKey(2026, 9, 24),
], 'the bounded window must expose seven day-by-day stops');

// A view without the sliding option keeps the original whole-week paging.
const plainEngine = createEngine(todayKey);
assert.equal(plainEngine.getWeekScrollState(), null, 'non-sliding views expose no window slider state');
assert.equal(plainEngine.next(), true);
assert.equal(keyOf(plainEngine.getDate()), dayKey(2026, 9, 31), 'plain week views still page by seven days');

assert.match(
    source,
    /function isSlidingWeekViewType\(viewType\) \{[\s\S]*type === 'timeGridWeek' \|\| type === 'dayGridWeek'/,
    'the sliding week window must be scoped to week views',
);
assert.match(
    source,
    /if \(isSlidingWeekViewType\(type\)\) \{[\s\S]*const distance = \(base\.getDay\(\) - firstDay \+ 7\) % 7;[\s\S]*base\.setDate\(base\.getDate\(\) - distance\);/,
    'opening a week view must still land on the configured week start',
);
assert.match(
    source,
    /role="scrollbar"[\s\S]*aria-valuenow="\$\{weekScrollIndex\}"/,
    'the compact scroll bar must expose scrollbar semantics with its current stop',
);
assert.match(
    source,
    /function isSlidingWeekWindowWithToday\(view\) \{[\s\S]*today\.getTime\(\) >= start\.getTime\(\) && today\.getTime\(\) < end\.getTime\(\)/,
    'the rail visibility must depend on today being inside the visible week',
);
assert.match(
    source,
    /const weekScrollState = isSlidingWeekViewType\(viewType\) && isSlidingWeekWindowWithToday\(view\)/,
    'a week that no longer contains today must not show the rail',
);
assert.match(
    source,
    /if \(event\.shiftKey !== true && !horizontal\) return;[\s\S]*callCalendarAdapter\(calendar, 'stepSlidingWeekDay', direction\)/,
    'Shift+wheel must walk the week window one day at a time',
);
assert.match(
    source,
    /const shifted = isSlidingWeekViewType\(type\)\s*\?\s*callCalendarAdapter\(activeCalendar, Number\(direction\) < 0 \? 'prev' : 'next'\) === true/,
    'compact week swipes must reuse the engine week pager',
);
assert.match(
    source,
    /prototypeWeekScrollPointerDownListener = \(event\) => \{[\s\S]*prototypeWeekScrollDrag = \{[\s\S]*startDate,/,
    'dragging the compact scroll bar must start a tracked window drag',
);
assert.match(
    source,
    /const steps = Math\.round\(\(Number\(event\.clientX\) - drag\.startX\) \/ Math\.max\(1, rect\.width \/ 6\)\);/,
    'the compact scroll bar must convert drag distance into day steps',
);
assert.match(
    source,
    /const from = protoDayStart\(range\.min\);[\s\S]*return target < from \? from : \(target > to \? to : target\);/,
    'day-granular targets must stay inside the today-visible limits',
);
// Dragging the rail must move the thumb immediately and commit every stop so
// the days follow the finger, while the repaint keeps the toolbar element
// alive (replacing it under the pointer was the flicker).
const dragMoveBody = source.slice(
    source.indexOf('const prototypeWeekScrollPointerMoveListener'),
    source.indexOf('const prototypeWeekScrollPointerUpListener'),
);
assert.ok(dragMoveBody.includes('prototypeWeekScrollPendingDate = bounded;'), 'the drag must queue the new stop');
assert.ok(dragMoveBody.includes('previewPrototypeWeekScroll(bounded);'), 'the rail must follow the pointer immediately');
assert.ok(dragMoveBody.includes('flushPrototypeWeekDayCommit();'), 'the drag must commit each stop');
assert.match(
    source,
    /const patchPrototypeSurfaceKeepingToolbar = \(markup\) => \{[\s\S]*if \(!prototypeWeekScrollDrag\) return false;[\s\S]*currentMain\.replaceWith\(nextMain\);/,
    'a repaint during the drag must replace the day grid only',
);
assert.match(
    source,
    /if \(!patchPrototypeSurfaceKeepingToolbar\(markup\)\s*&& \(!isCalendarListViewType\(viewType\) \|\| !patchPrototypeListSurface\(markup\)\)\) \{\s*prototypeSurface\.innerHTML = markup;/,
    'the toolbar-preserving repaint must be preferred over the full rebuild',
);
assert.match(
    source,
    /const flushPrototypeWeekDayCommit = \(\) => \{[\s\S]*callCalendarAdapter\(calendar, 'gotoDate', target\);/,
    'the deferred commit must be the single place that repaints the day window',
);
assert.doesNotMatch(
    source,
    /prevDisabled|nextDisabled/,
    'week paging must never leave a dead arrow button',
);
assert.match(
    source,
    /if \(isSlidingWeekViewType\(type\) \|\| type === 'timeGridWorkdays'\) return 7;/,
    'compacts swipes must keep whole-week paging while the slider walks days',
);
assert.doesNotMatch(
    source,
    /data-tm-proto-week-scroll[^>]*type="range"/,
    'the compact scroll bar must not be a native range input that dies on repaint',
);
assert.match(
    styles,
    /\.tm-calendar-wrap--mobile \.tm-proto-toolbar > \.tm-proto-week-scroll,[\s\S]*\[data-tm-host-mode="dock"\] \.tm-proto-toolbar > \.tm-proto-week-scroll\{[\s\S]*display: inline-flex;/,
    'the scroll bar must only appear where the compact toolbar has room for it',
);
assert.match(
    styles,
    /\.tm-proto-week-scroll-thumb\{[\s\S]*left: calc\(var\(--tm-proto-week-scroll-progress, 100\) \* 1%\);[\s\S]*transform: translate\(calc\(var\(--tm-proto-week-scroll-progress, 100\) \* -1%\), -50%\);/,
    'the thumb must track the window position across the whole track',
);
assert.doesNotMatch(
    styles,
    /\.tm-proto-week-scroll:hover \.tm-proto-week-scroll-thumb/,
    'the week rail must not restyle itself on hover',
);
assert.match(
    styles,
    /\.tm-proto-surface\.tm-proto-week-scrolling \.tm-proto-week-scroll-thumb\{[\s\S]*background: var\(--tm-cal-primary\);/,
    'the rail must keep one steady appearance while dragging',
);
// A repaint replaces the rail element under the pointer, so no repaint may run
// while the drag is active.
assert.doesNotMatch(
    source,
    /prototypeWeekScrollRenderHeld/,
    'the drag must keep repainting the window instead of freezing it',
);

console.log('calendar week scroll contract tests passed');
