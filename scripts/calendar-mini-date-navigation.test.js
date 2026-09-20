'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const extract = (start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from, start);
    return source.slice(from, to);
};
class Element {}
class HTMLElement extends Element {}
const canvas = new HTMLElement();
const scroller = Object.assign(new HTMLElement(), {
    scrollHeight: 1000000, clientHeight: 500, scrollTop: 0,
    querySelector: () => canvas,
    scrollTo({ top }) { this.scrollTop = top; },
});
let compact = false;
let invalidations = 0;
let renders = 0;
let pending = null;
let weekDate = null;
const timers = [];
const calls = [];
const calendar = { type: 'dayGridMonth', date: new Date(2026, 8, 1) };
const context = vm.createContext({
    Date, Element, HTMLElement, console,
    state: { calendar }, calendar,
    prototypeSurface: { querySelector: () => scroller },
    prototypeListState: {
        focusDate: new Date(2026, 8, 1), monthCursor: new Date(2026, 8, 1),
        selectionTransitionToken: 0,
    },
    isMobileDevice: false,
    isCompactDockLayout: () => compact,
    getCalendarView: c => ({ type: c.type }),
    getCalendarDate: c => c.date,
    isCalendarListViewType: type => type === 'listMonth',
    getPrototypeMonthCanvasGeometry: () => ({ rowHeight: 130 }),
    getPrototypeMonthWeekIndex: (geometry, date) => { weekDate = date; return date.getDate() + date.getMonth() * 5; },
    setPrototypeMonthPendingScrollRestore: (date, top) => { pending = { date, top }; },
    prototypeMonthLoadingScrollSnapshot: { top: 100 },
    prototypeMonthPendingScrollRestore: { top: 200 },
    prototypeMonthEngineSyncTimer: 9,
    prototypeMonthAutoSyncedMonthKey: '2026-08',
    prototypeMobileTimelineSwipeAnchorDate: new Date(2026, 7, 1),
    prototypeMonthProgrammaticScrollTop: 0,
    prototypeMonthProgrammaticScrollUntil: 0,
    prototypeMonthScrollAnchorDate: null,
    prototypeMobileMonthSuppressClickUntil: 0,
    invalidatePrototypeMonthMeasurement: () => { invalidations += 1; },
    syncPrototypeMonthTitle() {}, schedulePrototypeMonthScrollSync() {},
    rememberMainCalendarNonMonthAnchorDate: (c, type, date) => { context.state.mainCalendarNonMonthAnchorDate = date; },
    queuePrototypeSurfaceRender: () => { renders += 1; },
    callCalendarAdapter: (c, action, date) => { calls.push(action); c.date = date; return true; },
    clearTimeout() {}, setTimeout: callback => { timers.push(callback); return timers.length; },
});
vm.runInContext(fs.readFileSync(path.join(root, 'src/calendar/calendar-date.js'), 'utf8'), context);
vm.runInContext(`
    const protoDayStart = value => __tmCalendarDate.startOfDay(value);
    const protoSafeDate = value => __tmCalendarDate.toDate(value);
    const protoDateKey = value => __tmCalendarDate.formatDateKey(value);
    const miniMonthKeyFromDate = date => protoDateKey(date).slice(0, 7);
    const monthKeyLabel = miniMonthKeyFromDate;
    const protoListVisibleDays = date => [date];
    ${extract('const scrollPrototypeMonthToDate =', 'const shiftPrototypeMonthScroll =')}
    ${extract('const protoListFocusDate =', 'const protoListVisibleDays =')}
    ${extract('const performPrototypeListAction =', 'const openPrototypeListTaskDetail =')}
    globalThis.scrollMonth = scrollPrototypeMonthToDate;
    globalThis.listFocus = protoListFocusDate;
    globalThis.listAction = performPrototypeListAction;
`, context);

const pick = date => context.state.navigateMiniCalendarDate(new Date(`${date}T12:00:00`));
for (const date of ['2026-09-28', '2026-09-03', '2027-01-15']) {
    assert.equal(pick(date), true);
    assert.equal(calendar.type, 'dayGridMonth', 'sidebar dates must retain month view');
    assert.equal(context.__tmCalendarDate.formatDateKey(weekDate), date, 'scroll to the selected week, not the first week of its month');
    assert.equal(scroller.scrollTop, (weekDate.getDate() + weekDate.getMonth() * 5) * 130);
    assert.equal(context.__tmCalendarDate.formatDateKey(calendar.date), date);
    assert.equal(context.prototypeMonthLoadingScrollSnapshot, null, 'old loading snapshot must not undo explicit navigation');
}
context.scrollMonth(new Date(2027, 0, 15));
assert.equal(weekDate.getDate(), 1, 'toolbar month navigation still targets the first week');
scroller.scrollHeight = 0;
pick('2027-02-24');
assert.equal(context.__tmCalendarDate.formatDateKey(pending.date), '2027-02-24', 'hidden month canvas retains the requested date');
scroller.scrollHeight = 1000000;
const beforeCompact = scroller.scrollTop;
compact = true;
pick('2027-03-20');
assert.equal(invalidations, 1);
assert.equal(scroller.scrollTop, beforeCompact, 'compact month must use its page navigation');
assert.equal(calendar.date.getMonth(), 2);
compact = false;
context.isMobileDevice = true;
pick('2027-04-20');
assert.equal(invalidations, 2);
assert.equal(calendar.type, 'dayGridMonth');
context.isMobileDevice = false;

calendar.type = 'listMonth';
// Start an actual delayed selection, then supersede it from the sidebar.
context.listAction({ preventDefault() {}, stopPropagation() {} }, {
    getAttribute: name => name === 'data-tm-proto-list-action' ? 'select-date' : '2026-09-18',
});
assert.equal(timers.length, 2);
for (const date of ['2026-09-23', '2027-01-12']) {
    pick(date);
    assert.equal(context.__tmCalendarDate.formatDateKey(context.listFocus({})), date, 'list rendering must read the newly picked date');
    assert.equal(context.__tmCalendarDate.formatDateKey(calendar.date), date);
    assert.equal(context.state.miniMonthKey, date.slice(0, 7));
    assert.equal(context.prototypeListState.monthCursor.getMonth(), calendar.date.getMonth());
    assert.equal(context.prototypeListState.listScrollRestore.top, 0);
    assert.equal(context.prototypeListState.selectionTransitionPhase, '');
}
timers.forEach(run => run());
assert.equal(context.__tmCalendarDate.formatDateKey(context.listFocus({})), '2027-01-12', 'stale animation must not replace the sidebar selection');
assert.equal(context.prototypeListState.selectionTransitionPhase, '');
assert.ok(renders >= 8, 'date navigation queues the visible surface immediately');
assert.ok(calls.every(action => action === 'gotoDate'), 'sidebar dates never change the current view');
calendar.type = 'timeGridWeek';
assert.equal(pick('2027-05-04'), false, 'timeline dates continue through the existing navigation path');
console.log('calendar mini date navigation tests passed');
