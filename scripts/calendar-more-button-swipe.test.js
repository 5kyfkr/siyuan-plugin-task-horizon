'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'calendar-view.js'), 'utf8');
const start = source.indexOf('const mobileMonthSwipeTarget =');
const end = source.indexOf('prototypeMobileMonthTouchStartListener =', start);
assert.ok(start >= 0 && end > start);

class Element {
    constructor(kind, parentElement = null) {
        this.kind = kind;
        this.parentElement = parentElement;
    }
    matches(selector) {
        const value = selector.trim();
        if (value === '.tm-proto-more') return this.kind === 'more';
        if (value === 'button') return this.kind === 'more' || this.kind === 'button';
        if (value === '.tm-proto-month-cell[data-tm-proto-day]') return this.kind === 'month-cell';
        if (value === '.tm-proto-week-grid') return this.kind === 'week-grid';
        if (value === '.tm-proto-main-view > .tm-proto-timeline') return this.kind === 'timeline';
        if (value === '.tm-proto-list-month-grid') return this.kind === 'list-month-grid';
        if (value === '.tm-proto-list-week-picker') return this.kind === 'list-week-picker';
        return false;
    }
    closest(selector) {
        for (let node = this; node; node = node.parentElement) {
            if (selector.split(',').some((part) => node.matches(part))) return node;
        }
        return null;
    }
}

let viewType = 'dayGridMonth';
const monthCell = new Element('month-cell');
const more = new Element('more', monthCell);
const scheduleCard = new Element('schedule-card', monthCell);
const scheduleTitle = new Element('title', scheduleCard);
const moreLabel = new Element('label', more);
const regularButton = new Element('button', monthCell);
let monthShifts = 0;
let engineShifts = 0;
const context = vm.createContext({
    Element,
    HTMLElement: Element,
    state: {},
    calendar: {},
    isMobileDevice: true,
    isDockHost: false,
    prototypeListState: { calendarExpanded: true, focusDate: new Date(2026, 8, 24), monthCursor: new Date(2026, 8, 1) },
    prototypeSurface: {
        clientWidth: 390,
        classList: { add() {}, remove() {} },
        setAttribute() {},
        removeAttribute() {},
    },
    prototypeMobileMonthTouch: null,
    prototypePointerSelection: null,
    prototypeMonthLastUserInputAt: 0,
    prototypeMobileMonthSuppressClickUntil: 0,
    prototypeMobileMonthSwipeDirection: 0,
    prototypeMobileTimelineSwipeAnchorDate: null,
    getCalendarView: () => ({ type: viewType, range: { days: 7 } }),
    getCalendarDate: () => context.prototypeListState.focusDate,
    isCalendarListViewType: (type) => type === 'listMonth',
    isTimeGridViewType: (type) => type.startsWith('timeGrid'),
    isSlidingWeekViewType: (type) => type === 'timeGridWeek' || type === 'dayGridWeek',
    protoListFocusDate: () => context.prototypeListState.focusDate,
    protoSafeDate: (date) => new Date(date),
    protoDayStart: (date) => date instanceof Date ? new Date(date.getFullYear(), date.getMonth(), date.getDate()) : null,
    protoAddDays: (date, amount) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount),
    protoDateKey: (date) => date.toISOString().slice(0, 10),
    shiftPrototypeMonthScroll: () => { monthShifts += 1; return true; },
    callCalendarAdapter: () => { engineShifts += 1; return true; },
    rememberMainCalendarNonMonthAnchorDate() {},
    navigateMobileTimeline: () => { engineShifts += 1; return true; },
    queuePrototypeSurfaceRender() {},
    setTimeout: () => 1,
});
vm.runInContext(source.slice(start, end)
    + ';this.gestures = {target:mobileMonthSwipeTarget,begin:beginMobileMonthSwipe,move:moveMobileMonthSwipe,finish:finishMobileMonthSwipe};', context);

assert.equal(context.gestures.target(more), monthCell, '+N remains a calendar swipe surface');
assert.equal(context.gestures.target(scheduleCard), monthCell, 'month-view schedule cards remain a calendar swipe surface');
assert.equal(context.gestures.target(scheduleTitle), monthCell, 'nested schedule card text resolves to its month cell');
assert.equal(context.gestures.target(moreLabel), monthCell, 'nested +N text resolves to its month cell');
assert.equal(context.gestures.target(regularButton), null, 'other buttons retain their tap behavior');

const pointer = (type, target, x, y) => ({
    type,
    target,
    pointerType: 'touch',
    pointerId: 1,
    clientX: x,
    clientY: y,
    cancelable: true,
    prevented: false,
    preventDefault() { this.prevented = true; },
});
context.gestures.begin(pointer('pointerdown', more, 100, 100), 'pointer');
const move = pointer('pointermove', more, 20, 102);
context.gestures.move(move, 'pointer');
assert.equal(move.prevented, true, 'the calendar claims a horizontal swipe that starts on +N');
context.gestures.finish(pointer('pointerup', more, 20, 102), 'pointer');
assert.equal(monthShifts, 1, 'swiping +N navigates within the calendar');

context.gestures.begin(pointer('pointerdown', more, 100, 100), 'pointer');
context.gestures.finish(pointer('pointerup', more, 100, 100), 'pointer');
assert.equal(monthShifts, 1, 'tapping +N does not become a page swipe');

for (const target of [moreLabel, scheduleTitle]) {
    const before = monthShifts;
    context.gestures.begin(pointer('pointerdown', target, 100, 100), 'pointer');
    const horizontalMove = pointer('pointermove', target, 20, 102);
    context.gestures.move(horizontalMove, 'pointer');
    context.gestures.finish(pointer('pointerup', target, 20, 102), 'pointer');
    assert.equal(horizontalMove.prevented, true, 'horizontal swipes on card and +N descendants are claimed');
    assert.equal(monthShifts, before + 1, 'each horizontal gesture navigates exactly once');

    context.gestures.begin(pointer('pointerdown', target, 100, 100), 'pointer');
    const verticalMove = pointer('pointermove', target, 102, 20);
    context.gestures.move(verticalMove, 'pointer');
    context.gestures.finish(pointer('pointerup', target, 102, 20), 'pointer');
    assert.equal(verticalMove.prevented, false, 'vertical scrolling remains native');
    assert.equal(monthShifts, before + 1, 'vertical swipes do not navigate months');

    context.gestures.begin(pointer('pointerdown', target, 100, 100), 'pointer');
    context.gestures.finish(pointer('pointerup', target, 100, 100), 'pointer');
    assert.equal(monthShifts, before + 1, 'taps remain available to the card or +N click handler');
}

const touch = (type, target, x, y) => ({
    ...pointer(type, target, x, y),
    changedTouches: [{ identifier: 2, target, clientX: x, clientY: y }],
});
const beforeFallback = monthShifts;
context.gestures.begin(touch('touchstart', scheduleTitle, 100, 100), 'touch');
const fallbackMove = touch('touchmove', scheduleTitle, 20, 102);
context.gestures.move(fallbackMove, 'touch');
context.gestures.finish(touch('touchend', scheduleTitle, 20, 102), 'touch');
assert.equal(fallbackMove.prevented, true, 'older WebViews claim touch-only card swipes');
assert.equal(monthShifts, beforeFallback + 1, 'the touch fallback navigates exactly once');

viewType = 'dayGridWeek';
const weekGrid = new Element('week-grid');
const weekMore = new Element('more', weekGrid);
assert.equal(context.gestures.target(weekMore), weekGrid, 'week-grid +N is also a swipe surface');
context.gestures.begin(pointer('pointerdown', weekMore, 100, 100), 'pointer');
const weekMove = pointer('pointermove', weekMore, 20, 102);
context.gestures.move(weekMove, 'pointer');
context.gestures.finish(pointer('pointerup', weekMore, 20, 102), 'pointer');
assert.equal(weekMove.prevented, true);
assert.equal(engineShifts, 1, 'swiping week-grid +N pages the calendar');

viewType = 'timeGridDay';
const timeline = new Element('timeline');
const timeGridMore = new Element('more', timeline);
assert.equal(context.gestures.target(timeGridMore), timeline, 'time-grid +N is also a swipe surface');
context.gestures.begin(pointer('pointerdown', timeGridMore, 100, 100), 'pointer');
const timeGridMove = pointer('pointermove', timeGridMore, 20, 102);
context.gestures.move(timeGridMove, 'pointer');
context.gestures.finish(pointer('pointerup', timeGridMore, 20, 102), 'pointer');
assert.equal(timeGridMove.prevented, true);
assert.equal(engineShifts, 2, 'swiping time-grid +N pages the calendar');

console.log('calendar +N horizontal swipe tests passed');
