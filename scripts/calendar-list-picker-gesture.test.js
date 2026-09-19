'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'calendar-view.js'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, '..', 'calendar-view.css'), 'utf8');
const gestureStart = source.indexOf('const mobileMonthSwipeTarget =');
const gestureEnd = source.indexOf('prototypeMobileMonthTouchStartListener =', gestureStart);
const actionStart = source.indexOf('const performPrototypeListAction =');
const actionEnd = source.indexOf('const openPrototypeListTaskDetail =', actionStart);
assert.ok(gestureStart >= 0 && gestureEnd > gestureStart && actionEnd > actionStart);

class Element {
    constructor(kind) { this.kind = kind; }
    matches(selector) { return selector === '.tm-proto-list-month-grid' && this.kind === 'month'; }
    closest(selector) {
        if (selector === '.tm-proto-list-picker') return picker;
        if (selector === '.tm-proto-list-week-picker') return this.kind === 'week' ? this : null;
        if (selector === '.tm-proto-list-month-grid') return this.kind === 'month' ? this : null;
        return null;
    }
}
const picker = { querySelector: (selector) => ({ getAttribute: () => selector.match(/="([^"]+)"/)[1] }) };
let renders = 0;
let navigations = 0;
const context = vm.createContext({
    Element, HTMLElement: Element,
    state: {}, calendar: {}, isMobileDevice: true, isDockHost: false,
    prototypeListState: { calendarExpanded: true, focusDate: new Date(2026, 11, 31), monthCursor: new Date(2026, 11, 1) },
    prototypeSurface: { clientWidth: 390, classList: { add() {}, remove() {} } },
    prototypeMobileMonthTouch: null, prototypePointerSelection: null,
    prototypeMonthLastUserInputAt: 0, prototypeMobileMonthSuppressClickUntil: 0,
    getCalendarView: () => ({ type: 'listMonth' }),
    isCalendarListViewType: (type) => type === 'listMonth',
    isTimeGridViewType: () => false,
    protoListFocusDate: () => context.prototypeListState.focusDate,
    protoSafeDate: (date) => new Date(date),
    protoAddDays: (date, amount) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount),
    callCalendarAdapter: () => { navigations += 1; return true; },
    queuePrototypeSurfaceRender: () => { renders += 1; },
    setTimeout: () => 1,
});
// The gesture and click listeners live in separate blocks in the application.
vm.runInContext('{' + source.slice(gestureStart, gestureEnd)
    + ';this.gestures = {begin:beginMobileMonthSwipe, move:moveMobileMonthSwipe, finish:finishMobileMonthSwipe, target:mobileMonthSwipeTarget};}'
    + '{' + source.slice(actionStart, actionEnd) + ';this.action = performPrototypeListAction;}', context);
function swipe(horizontal, vertical = 0, options = {}) {
    const target = new Element(context.prototypeListState.calendarExpanded ? 'month' : 'week');
    const event = (type, clientX, clientY) => ({
        type, pointerType: options.pointerType || 'touch', pointerId: 1, target, clientX, clientY,
        cancelable: true, preventDefault() {}, stopPropagation() {},
    });
    const source = options.source || 'pointer';
    const gestureEvent = (phase, clientX, clientY) => {
        if (source === 'pointer') return event(`pointer${phase}`, clientX, clientY);
        const touchEvent = event(`touch${phase === 'down' ? 'start' : phase === 'up' ? 'end' : 'move'}`, clientX, clientY);
        touchEvent.changedTouches = [{ identifier: 1, clientX, clientY }];
        return touchEvent;
    };
    context.gestures.begin(gestureEvent('down', 200, 100), source);
    context.gestures.move(gestureEvent('move', 200 + horizontal, 100 + vertical), source);
    context.gestures.finish(gestureEvent('up', 200 + horizontal, 100 + vertical), source, options.cancelled === true);
}
const selectedTime = context.prototypeListState.focusDate.getTime();
swipe(-100);
assert.equal(context.prototypeListState.monthCursor.getFullYear(), 2027);
assert.equal(context.prototypeListState.monthCursor.getMonth(), 0);
assert.equal(context.prototypeListState.calendarExpanded, true);
assert.equal(context.prototypeListState.focusDate.getTime(), selectedTime);
assert.equal(navigations, 0, 'Month browsing must not select a day or move the task cards');
swipe(100);
assert.equal(context.prototypeListState.monthCursor.getMonth(), 11);
assert.equal(context.prototypeListState.monthCursor.getFullYear(), 2026);
assert.doesNotMatch(source, /tm-proto-list-month-head/);
assert.equal(renders, 2);
for (const [horizontal, vertical, options] of [[5, 120, {}], [25, 0, {}], [-120, 0, { cancelled: true }], [-120, 0, { pointerType: 'mouse' }]]) swipe(horizontal, vertical, options);
assert.equal(renders, 2, 'Scrolls, taps, cancelled gestures and mouse drags must not navigate');
context.action({ preventDefault() {}, stopPropagation() {} }, { getAttribute: () => 'select-date' });
assert.equal(renders, 2, 'A synthetic click following a swipe must not select a date');
context.prototypeListState.calendarExpanded = false;
context.prototypeMobileMonthSuppressClickUntil = 0;
swipe(-100);
assert.equal(context.prototypeListState.focusDate.getTime(), new Date(2027, 0, 7).getTime());
assert.equal(navigations, 1);
swipe(100);
assert.equal(context.prototypeListState.focusDate.getTime(), selectedTime);
assert.equal(navigations, 2);
assert.equal(renders, 4, 'Each week swipe must repaint the date row and task list');
assert.equal(context.prototypeListState.calendarExpanded, false);
for (const [horizontal, vertical, options] of [[5, 120, {}], [25, 0, {}], [-120, 0, { cancelled: true }], [-120, 0, { pointerType: 'mouse' }]]) swipe(horizontal, vertical, options);
assert.equal(navigations, 2, 'Week navigation must ignore vertical scrolling, taps, cancellations and mouse drags');
context.action({ preventDefault() {}, stopPropagation() {} }, { getAttribute: () => 'select-date' });
assert.equal(renders, 4, 'A click generated by a week swipe must not select a date');
swipe(-100, 0, { source: 'touch' });
assert.equal(context.prototypeListState.focusDate.getTime(), new Date(2027, 0, 7).getTime());
assert.equal(context.prototypeListState.monthCursor.getFullYear(), 2027);
assert.equal(context.prototypeListState.monthCursor.getMonth(), 0);
swipe(100, 0, { source: 'touch' });
assert.equal(context.prototypeListState.focusDate.getTime(), selectedTime);
assert.equal(context.prototypeListState.monthCursor.getMonth(), 11);
assert.equal(navigations, 4, 'Touch-event-only WebViews must support both week swipe directions');
assert.equal(renders, 6);
assert.equal(context.gestures.target(new Element('task')), null);
assert.match(styles, /\.tm-proto-list-week-picker\s*\{[^}]*touch-action:\s*pan-y;/);
assert.match(styles, /\.tm-proto-list-month-grid\s*\{[^}]*touch-action:\s*pan-y;/);
assert.match(styles, /\.tm-proto-list-calendar-toggle span\s*\{[^}]*transform:\s*translateY\(-2px\) rotate\(45deg\);/);
console.log('calendar list picker gesture tests passed');
