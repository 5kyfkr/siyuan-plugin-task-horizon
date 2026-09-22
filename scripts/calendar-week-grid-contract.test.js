'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const calendar = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'calendar-view.css'), 'utf8');
const dateSource = fs.readFileSync(path.join(root, 'src/calendar/calendar-date.js'), 'utf8');

assert.match(calendar, /dayGridWeek:\s*\{\s*type:\s*'dayGridWeek'/);
assert.match(calendar, /\{ value: 'dayGridWeek', label: '周格' \}/);
assert.match(calendar, /protoRenderWeekGrid/);
assert.match(calendar, /data-tm-proto-week-grid/);
assert.match(calendar, /const cellViewType = String\(getCalendarView\(activeCalendar\)\?\.type \|\| ''\)\.trim\(\);\s*if \(monthCell && \(cellViewType === 'dayGridMonth' \|\| cellViewType === 'dayGridWeek'\)\)/, 'week-grid blank cells must open the single-day panel');
assert.match(calendar, /const singleDayCountable = countable\.filter\(\(eventApi\) => !protoIsSpanEvent\(eventApi\)\);\s*const dayStats = days\.map/, 'cross-day events must stay out of the per-day completion bars');
assert.match(calendar, /const toolbarWeekNumber = viewType === 'dayGridWeek' && toolbarDate[\s\S]*?getIsoWeekNumber\(toolbarDate\)[\s\S]*?const toolbarMonthLabel[\s\S]*?W\$\{String\(toolbarWeekNumber\)\.padStart\(2, '0'\)\}/, 'week-grid toolbar must show the ISO week number beside the month');
assert.match(calendar, /tm-proto-week-span-layer/);
// Cross-day events paint one bar per two-day row instead of restarting in
// every cell, repeat their title on each row, and stay flexible at the wraps.
assert.match(calendar, /repeatTitle: true/);
assert.match(calendar, /const showSpanTitle = isSegmentStart \|\| segment\?\.repeatTitle === true;/);
assert.match(calendar, /grid-column:\$\{segment\.segmentStartIndex - rowStartIndex \+ 1\}/);
// The week grid must reuse the month pipeline for dedupe, capacity and +N.
assert.match(calendar, /const compactedWeekLayout = protoBuildMonthCompactedLayout\(days, weekEvents, \{\s*defaultCapacity: WEEK_GRID_VISIBLE_ROWS,\s*spanLimit: WEEK_GRID_VISIBLE_ROWS,\s*columns: WEEK_GRID_COLUMNS,/, 'week grid must reuse the month compaction pipeline');
assert.match(calendar, /const columns = Math\.max\(1, Math\.floor\(Number\(options\.columns\) \|\| 7\)\);/, 'the shared compactor must accept a column count');
assert.match(calendar, /tm-proto-week-span-reserve/, 'week cells must reserve the cross-day band like month cells');
assert.match(calendar, /const weekdayLabel = MAIN_CALENDAR_WEEK_DAY_HEADER_LABELS\[date\.getDay\(\)\] \|\| '';/, 'week cells must label the weekday');
assert.match(calendar, /<span class="tm-proto-week-day-label">\$\{esc\(weekdayLabel\)\}<\/span>/, 'the weekday must render left of the date');
assert.match(calendar, /const spanReserveHeight = Math\.max\(22, reserveLanes \* 25 - 3\);/, 'week grid reserve must match the month rhythm');
assert.match(calendar, /protoEventMarkup\(\s*eventApi,\s*'chip',\s*eventApi\?\.allDay !== true,\s*eventApi\?\.allDay === true \? 'tm-proto-month-event' : '',\s*'dayGridWeek',/, 'week cards must use the same markup arguments as month cards');
assert.match(calendar, /viewType === 'dayGridWeek'/);
assert.match(calendar, /viewType !== 'dayGridWeek'/);
assert.match(calendar, /navigateMobileTimeline\(activeCalendar, direction, \{ viewType \}\)/);
// Desktop tabs keep the classic view list; only compact hosts get 周格.
assert.match(calendar, /const toolbarViewOptions = getMainCalendarViewOptions\(\{ compact: compactToolbar \}\)/, 'the toolbar must resolve view options per host');
assert.match(calendar, /const desktopInitialViewOptions = renderMainCalendarViewOptionHtml\(\s*resolveMainCalendarHostView\(s\.initialViewDesktop, 'timeGridWeek', false\),/, 'the desktop default-view list must not offer the week grid');
assert.match(calendar, /const mobileInitialViewOptions = renderMainCalendarViewOptionHtml\(s\.initialViewMobile \|\| 'timeGridDay', \{ compact: true \}\)/, 'the mobile default-view list keeps the week grid');
assert.match(calendar, /return resolveMainCalendarHostView\(sessionView, 'timeGridWeek', compactHost\)/, 'a desktop host must not restore into the week grid');
// Touch paging: the week grid is a valid horizontal-swipe surface, steps a
// full week, and reuses the timeline slide cue for the new page.
assert.match(calendar, /if \(viewType === 'dayGridWeek'\) \{\s*const grid = target\.closest\('\.tm-proto-week-grid'\)/, 'week grid must accept horizontal swipe gestures');
assert.match(calendar, /viewType !== 'dayGridMonth' && viewType !== 'dayGridWeek' && !isTimeGridViewType\(viewType\)/, 'week grid must start the mobile swipe gesture');
assert.match(calendar, /const type = String\(options\.viewType \|\| getCalendarView\(activeCalendar\)\?\.type \|\| ''\)\.trim\(\);\s*if \(!activeCalendar \|\| \(type !== 'dayGridWeek' && !isTimeGridViewType\(type\)\)\) return false;/, 'week grid paging must be allowed in the mobile timeline navigator');
assert.match(calendar, /if \(type === 'timeGridWeek' \|\| type === 'dayGridWeek' \|\| type === 'timeGridWorkdays'\) return 7;/, 'week grid paging must step seven days');
assert.match(calendar, /prototypeMobileMonthSwipeDirection = direction;[\s\S]*?setAttribute\('data-tm-timeline-swipe', direction < 0 \? 'previous' : 'next'\)/, 'week grid paging must reuse the timeline slide cue');
assert.match(styles, /\.tm-proto-week-grid-cells\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
assert.match(styles, /\.tm-proto-week-completion-track/);
// The grid fills the host stage, keeps the bottom view-bar inset reserved and
// stays a vertical scroller while horizontal swipes page weeks.
assert.match(styles, /\.tm-proto-week-grid\{[\s\S]*?padding:0 4px calc\(8px \+ var\(--tm-view-bottom-inset,0px\)\)/);
assert.match(styles, /\.tm-proto-week-grid-row\{[\s\S]*?flex:1 1 0/);
assert.match(styles, /\.tm-calendar-wrap--mobile \.tm-proto-main-view > \.tm-proto-week-grid,[\s\S]*?touch-action: pan-y/);
assert.match(styles, /\[data-tm-timeline-swipe="next"\] \.tm-proto-main-view > \.tm-proto-week-grid \.tm-proto-week-grid-row\{[\s\S]*?animation: tm-proto-mobile-timeline-in-next/);
assert.match(styles, /\.tm-proto-week-span-layer\{[\s\S]*?grid-auto-rows:var\(--tm-proto-week-grid-pitch,25px\)/);
assert.match(styles, /\.tm-proto-week-span-reserve\{[\s\S]*?flex:0 0 auto/);
assert.match(styles, /\.tm-proto-week-grid-cell \.tm-proto-week-day-label\{[\s\S]*?margin-right:4px/);
assert.match(styles, /--tm-proto-week-grid-pitch:calc\(var\(--tm-proto-card-height,22px\) \+ var\(--tm-proto-card-gap,3px\)\)/, 'the week lane must reuse the shared card rhythm');
assert.match(styles, /\.tm-proto-week-span-layer \.tm-proto-span-bar\.is-continuation-start\{[\s\S]*?box-shadow:none !important/);
// Mobile and dock week-grid cards keep their text instead of collapsing into
// the compact month's dot markers.
// Cross-day bars and single-day cards share one card height and radius, so a
// wrapped bar never looks rounder than its neighbours.
assert.match(styles, /\.tm-proto-week-span-layer \.tm-proto-span-bar\{[\s\S]*?height:var\(--tm-proto-card-height,22px\)/);
assert.match(styles, /\.tm-proto-week-span-layer \.tm-proto-span-bar\{[\s\S]*?border-radius:var\(--tm-proto-card-radius,6px\) !important/);
assert.match(styles, /\.tm-calendar-wrap--mobile \.tm-proto-week-grid-cell \.tm-proto-event--chip\{[\s\S]*?height:var\(--tm-proto-card-height,22px\) !important/);
assert.match(styles, /\.tm-calendar-wrap--mobile \.tm-proto-week-grid-cell \.tm-proto-event--chip::before\{ display:none !important; \}/);

const context = { Date, Math, Number, String, Intl };
context.globalThis = context;
vm.runInNewContext(dateSource, context);
const range = context.__tmCalendarDate.getVisibleRange('dayGridWeek', new Date(2026, 8, 23), {
    firstDay: 1,
    views: { dayGridWeek: { type: 'dayGridWeek' } },
});
assert.equal(range.days, 7);
assert.equal(context.__tmCalendarDate.formatDateKey(range.start), '2026-09-21');
assert.equal(context.__tmCalendarDate.formatDateKey(range.end), '2026-09-28');

const viewOptionsStart = calendar.indexOf('    const MAIN_CALENDAR_VIEW_OPTIONS = [');
const viewOptionsEnd = calendar.indexOf('    function renderMainCalendarViewOptionHtml(', viewOptionsStart);
assert.ok(viewOptionsStart >= 0 && viewOptionsEnd > viewOptionsStart, 'view option helpers must remain inspectable');
const viewContext = {
    state: { isMobileDevice: false, isDockHost: false, isNarrowDesktopLayout: false },
    isLikelyMobileRuntime: () => false,
    MAIN_CALENDAR_ALLOWED_VIEWS: new Set(['timeGridDay', 'timeGrid3Day', 'timeGridWorkdays', 'timeGridWeek', 'dayGridWeek', 'dayGridMonth', 'listMonth']),
};
vm.runInNewContext([
    calendar.slice(viewOptionsStart, viewOptionsEnd),
    'globalThis.__views = { getMainCalendarViewOptions, resolveMainCalendarHostView, isMainCalendarCompactHost };',
].join('\n'), viewContext);
const desktopViews = Array.from(viewContext.__views.getMainCalendarViewOptions({ compact: false }), (item) => String(item.value));
assert.equal(desktopViews.join(','), 'timeGridDay,timeGrid3Day,timeGridWorkdays,timeGridWeek,dayGridMonth,listMonth', 'desktop tabs must keep the classic view list');
assert.ok(viewContext.__views.getMainCalendarViewOptions({ compact: true }).some((item) => item.value === 'dayGridWeek'), 'compact hosts must keep the week grid');
assert.equal(viewContext.__views.resolveMainCalendarHostView('dayGridWeek', 'timeGridWeek', false), 'timeGridWeek', 'desktop hosts must fall back out of the week grid');
assert.equal(viewContext.__views.resolveMainCalendarHostView('dayGridWeek', 'timeGridWeek', true), 'dayGridWeek', 'compact hosts must keep a saved week grid');
assert.equal(viewContext.__views.isMainCalendarCompactHost(), false, 'a plain desktop state is not a compact host');

// A single-day cell can be wide enough to look like a clipping pane. Its
// overflow only clips card contents; the body-level editor must use the same
// viewport as a cross-day bar painted in the sibling span layer.
const viewportStart = calendar.indexOf('        const getPrototypePopoverViewport = (anchorEl, options = {}) => {');
const viewportEnd = calendar.indexOf('        const showPrototypeScheduleEditorCard = ', viewportStart);
assert.ok(viewportStart >= 0 && viewportEnd > viewportStart);
class MockElement {
    constructor(classes, rect, parentElement = null, overflow = 'visible') {
        this.classes = new Set(classes.split(' ').filter(Boolean));
        this.rect = { ...rect, width: rect.right - rect.left, height: rect.bottom - rect.top };
        this.parentElement = parentElement;
        this.overflow = overflow;
    }
    matches(selector) {
        return selector.split(',').some((part) => {
            const value = part.trim();
            return value.startsWith('.') && this.classes.has(value.slice(1));
        });
    }
    closest(selector) {
        for (let node = this; node; node = node.parentElement) {
            if (node.matches(selector)) return node;
        }
        return null;
    }
    contains(target) {
        for (let node = target; node; node = node.parentElement) {
            if (node === this) return true;
        }
        return false;
    }
    getBoundingClientRect() { return this.rect; }
}
const browserRect = { left: 0, top: 0, right: 420, bottom: 840 };
const documentElement = new MockElement('', browserRect);
documentElement.clientWidth = 420;
documentElement.clientHeight = 840;
const body = new MockElement('', browserRect, documentElement);
const hostRect = { left: 20, top: 64, right: 400, bottom: 780 };
const host = new MockElement('tm-calendar-root', hostRect, body, 'hidden');
const surface = new MockElement('tm-calendar-surface', hostRect, host, 'hidden');
const row = new MockElement('tm-proto-week-grid-row', { left: 20, top: 100, right: 400, bottom: 270 }, surface);
const cellRect = { left: 20, top: 100, right: 210, bottom: 270 };
const cell = new MockElement('tm-proto-month-cell tm-proto-week-grid-cell', cellRect, row, 'hidden');
const events = new MockElement('tm-proto-month-events', { left: 24, top: 128, right: 206, bottom: 265 }, cell, 'hidden');
const stack = new MockElement('tm-proto-month-regular-stack', events.rect, events, 'hidden');
const cardRect = { left: 24, top: 128, right: 206, bottom: 150 };
const singleDay = new MockElement('tm-proto-event', cardRect, stack, 'hidden');
const spanLayer = new MockElement('tm-proto-week-span-layer', { left: 20, top: 128, right: 400, bottom: 150 }, row);
const crossDay = new MockElement('tm-proto-span-bar', { left: 24, top: 128, right: 396, bottom: 150 }, spanLayer, 'hidden');
const viewportContext = {
    Element: MockElement,
    window: { innerWidth: 420, innerHeight: 840 },
    document: { documentElement, body },
    rootEl: host,
    getComputedStyle: (node) => ({ overflowX: node.overflow, overflowY: node.overflow }),
};
vm.runInNewContext([
    calendar.slice(viewportStart, viewportEnd),
    'globalThis.viewport = getPrototypePopoverViewport;',
].join('\n'), viewportContext);
const singleDayViewport = viewportContext.viewport(singleDay);
const crossDayViewport = viewportContext.viewport(crossDay);
assert.deepEqual({ ...singleDayViewport }, { ...crossDayViewport }, 'single-day and cross-day cards must share the host viewport');
assert.deepEqual({ ...singleDayViewport }, { ...hostRect, width: 380, height: 716 }, 'the cell must not restrict a body-level editor');
const narrowPaneRect = { left: 50, top: 80, right: 370, bottom: 740 };
const narrowPane = new MockElement('host-pane', narrowPaneRect, host, 'hidden');
surface.parentElement = narrowPane;
assert.deepEqual({ ...viewportContext.viewport(singleDay) }, { ...narrowPaneRect, width: 320, height: 660 }, 'real clipping host panes must still constrain the editor');

console.log('calendar week grid contract tests passed');
