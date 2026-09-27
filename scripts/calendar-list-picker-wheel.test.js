'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'calendar-view.js'), 'utf8');
function extract(start, end) {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from);
    return source.slice(from, to);
}
const action = extract('const performPrototypeListAction =', 'const openPrototypeListTaskDetail =');
const listener = extract('const prototypeListWheelState =', "prototypeSurface.addEventListener('click',");
const cleanup = extract('if (prototypeListWheelListener) {', 'if (prototypeWeekWheelResetTimer) {');

for (const host of ['desktop', 'dock']) {
    let now = 1000;
    let viewType = 'listMonth';
    let runtimeMobile = false;
    let renders = 0;
    const navigations = [];
    const registered = new Map();
    class Element {
        constructor(inPicker) { this.inPicker = inPicker; }
        closest(selector) { return selector === '.tm-proto-list-picker' && this.inPicker ? this : null; }
    }
    class ClockDate extends Date { static now() { return now; } }
    const context = vm.createContext({
        Date: ClockDate, Element,
        isMobileDevice: host === 'dock',
        state: { isMobileDevice: host === 'dock', isDockHost: host === 'dock' },
        isLikelyMobileRuntime: () => runtimeMobile,
        calendar: {},
        prototypeListWheelListener: null,
        prototypeListState: {
            calendarExpanded: true,
            focusDate: new Date(2026, 11, 31),
            monthCursor: new Date(2026, 11, 1),
        },
        prototypeSurface: {
            addEventListener(name, callback, options) { registered.set(name, { callback, options }); },
            removeEventListener(name, callback, capture) {
                assert.equal(callback, registered.get(name).callback);
                assert.equal(capture, true);
                registered.delete(name);
            },
        },
        getCalendarView: () => ({ type: viewType }),
        isCalendarListViewType: (type) => type === 'listMonth',
        protoListFocusDate: () => context.prototypeListState.focusDate,
        protoSafeDate: (date) => new Date(date),
        protoAddDays: (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days),
        callCalendarAdapter: (_, name, date) => navigations.push({ name, date }),
        queuePrototypeSurfaceRender: () => { renders += 1; },
    });
    vm.runInContext(action + listener, context);
    assert.equal(registered.get('wheel').options.passive, false);
    assert.equal(registered.get('wheel').options.capture, true);
    function wheel(deltaY, options = {}) {
        now += options.elapsed ?? 250;
        const event = {
            target: new Element(true), deltaY, deltaX: 0, deltaMode: 0,
            defaultPrevented: false, stopped: false,
            preventDefault() { this.defaultPrevented = true; },
            stopPropagation() { this.stopped = true; },
            ...options,
        };
        registered.get('wheel')?.callback(event);
        return event;
    }
    const focusTime = context.prototypeListState.focusDate.getTime();
    assert.equal(wheel(100).defaultPrevented, true);
    assert.equal(context.prototypeListState.monthCursor.getFullYear(), 2027);
    assert.equal(context.prototypeListState.monthCursor.getMonth(), 0);
    wheel(-100, { elapsed: 10 });
    assert.equal(context.prototypeListState.monthCursor.getFullYear(), 2026, 'Reversing the wheel responds immediately');
    assert.equal(context.prototypeListState.monthCursor.getMonth(), 11);
    assert.equal(context.prototypeListState.focusDate.getTime(), focusTime, 'Browsing months retains the selected day');
    assert.equal(navigations.length, 0, 'Browsing months must not navigate the task list');

    context.prototypeListState.calendarExpanded = false;
    wheel(100, { elapsed: 10 });
    assert.equal(context.prototypeListState.focusDate.getTime(), new Date(2027, 0, 7).getTime());
    assert.equal(navigations.at(-1).name, 'gotoDate');
    wheel(-100, { elapsed: 10 });
    assert.equal(context.prototypeListState.focusDate.getTime(), focusTime);
    assert.equal(context.prototypeListState.calendarExpanded, false);
    assert.equal(navigations.length, 2);

    const beforeFine = renders;
    wheel(10);
    wheel(10, { elapsed: 10 });
    wheel(10, { elapsed: 10 });
    assert.equal(renders, beforeFine, 'Fine deltas accumulate before navigation');
    wheel(14, { elapsed: 10 });
    assert.equal(renders, beforeFine + 1);
    for (let i = 0; i < 5; i += 1) wheel(300, { elapsed: 10 });
    assert.equal(renders, beforeFine + 1, 'A high-frequency wheel burst must not race through weeks');
    wheel(100, { elapsed: 200 });
    assert.equal(renders, beforeFine + 2, 'Continued scrolling may advance after the cooldown');

    const beforeModes = renders;
    wheel(3, { deltaMode: 1 });
    wheel(-1, { deltaMode: 2 });
    assert.equal(renders, beforeModes + 2, 'Line and page deltas support both directions');
    wheel(20);
    wheel(30);
    assert.equal(renders, beforeModes + 2, 'An idle gap resets an incomplete wheel gesture');

    const beforeIgnored = renders;
    for (const options of [
        { target: new Element(false) }, { target: null },
        { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true },
        { deltaX: 200 }, { deltaY: 0 },
    ]) {
        const event = wheel(100, options);
        assert.equal(event.defaultPrevented, false, 'Other scrolling and browser shortcuts remain native');
        assert.equal(event.stopped, false);
    }
    wheel(100, { defaultPrevented: true });
    viewType = 'timeGridWeek';
    assert.equal(wheel(100).defaultPrevented, false);
    viewType = 'listMonth';
    runtimeMobile = true;
    assert.equal(wheel(100).defaultPrevented, false);
    runtimeMobile = false;
    assert.equal(renders, beforeIgnored);

    vm.runInContext(cleanup, context);
    assert.equal(registered.has('wheel'), false, 'Unmount removes the delegated listener');
    wheel(100);
    assert.equal(renders, beforeIgnored);
}
console.log('calendar list picker wheel tests passed (desktop and dock)');
