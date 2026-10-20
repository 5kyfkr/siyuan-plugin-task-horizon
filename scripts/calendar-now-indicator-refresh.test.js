'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../calendar-view.js'), 'utf8').replace(/\r\n/g, '\n');
function between(start, end) {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, start);
    return source.slice(from, to);
}
const queueSource = between('        const queuePrototypeSurfaceRender = (options = {}) => {',
    '        state.refreshTaskPinned = () => {');
const timerSource = between('    function refreshCalendarNowIndicators() {',
    '    function scheduleSideDayTaskDateSourceRefresh(');
const resumeListeners = between("    try {\n        document.addEventListener('visibilitychange', refreshCalendarNowIndicators,",
    '    function isVisibleCalendarExternalDragMirror(');

function fixture(host) {
    let now = new Date('2026-10-20T21:31:10').getTime();
    let nextId = 1;
    const timers = new Map();
    const frames = [];
    class Element {
        constructor() { this.isConnected = true; }
        querySelector() { return null; }
    }
    class ClockDate extends Date {
        constructor(...args) { super(...(args.length ? args : [now])); }
        static now() { return now; }
    }
    const surface = new Element();
    const state = { calendar: { view: { type: 'timeGridDay' } }, rootEl: surface, isDockHost: host === 'dock',
        sideDay: { rootEl: new Element() } };
    const context = vm.createContext({
        state, HTMLElement: Element, Date: ClockDate, console,
        document: Object.assign(new EventTarget(), { hidden: false }), window: new EventTarget(), AbortController,
        getCalendarView: calendar => calendar.view,
        isTimeGridViewType: type => type.startsWith('timeGrid'),
        setTimeout(callback, delay) { const id = nextId++; timers.set(id, { callback, at: now + delay }); return id; },
        clearTimeout(id) { timers.delete(id); },
        requestAnimationFrame(callback) { frames.push(callback); return frames.length; },
        prototypeSurface: surface,
        prototypeListState: {},
        prototypeRenderRaf: 0,
        prototypeLastRenderKey: '',
        prototypeLastEventSnapshot: new Map(),
        paints: 0,
        renderPrototypeSurface() {
            // Exercise the same unchanged-events cache gate as the production renderer.
            if (context.prototypeLastRenderKey === 'unchanged-events') return;
            context.prototypeLastRenderKey = 'unchanged-events';
            context.prototypeLastEventSnapshot = new Map();
            context.paints++;
            context.label = new ClockDate().toTimeString().slice(0, 5);
        },
    });
    vm.runInContext(timerSource + queueSource
        + '\nconst __tmCalendarModuleLifecycleAbort = new AbortController();\n' + resumeListeners, context);
    const flush = () => { while (frames.length) frames.shift()(); };
    return { state, context, timers, flush,
        jump(minutes) { now += minutes * 60000; },
        tick() {
            const timer = timers.get(state.nowIndicatorTimer);
            assert.ok(timer, 'current-time refresh must be scheduled');
            now = Math.max(now, timer.at);
            timers.delete(state.nowIndicatorTimer);
            timer.callback();
            flush();
        },
    };
}

for (const host of ['dock', 'tab']) {
    const test = fixture(host);
    test.state.queuePrototypeSurfaceRender();
    test.flush();
    assert.equal(test.context.label, '21:31');
    const firstTimer = test.state.nowIndicatorTimer;
    test.state.queuePrototypeSurfaceRender();
    test.flush();
    assert.equal(test.state.nowIndicatorTimer, firstTimer, `${host}: redraws must retain the minute boundary`);
    assert.equal(test.context.paints, 1, `${host}: unchanged events should retain their normal render cache`);
    test.tick();
    assert.equal(test.context.label, '21:32', `${host}: the minute timer must bypass the unchanged-events cache`);
    test.tick();
    assert.equal(test.context.label, '21:33', `${host}: refresh must continue across multiple minutes`);
    assert.equal(test.timers.size, 1, `${host}: only one main clock timer may remain`);
    test.jump(79);
    test.tick();
    assert.equal(test.context.label, '22:52', `${host}: a delayed timer must catch up to wall-clock time`);

    test.context.document.hidden = true;
    test.jump(5);
    test.context.document.dispatchEvent(new Event('visibilitychange'));
    test.flush();
    assert.equal(test.context.label, '22:52', `${host}: visibility notifications must skip a hidden document`);
    test.context.document.hidden = false;
    test.context.document.dispatchEvent(new Event('visibilitychange'));
    test.flush();
    assert.equal(test.context.label, '22:57', `${host}: document resume must refresh immediately`);

    test.state.rootEl.isConnected = false;
    test.state.mainCalendarSuspended = true;
    test.jump(3);
    test.context.window.dispatchEvent(new Event('focus'));
    test.flush();
    assert.equal(test.context.label, '22:57', `${host}: a suspended calendar must stay parked`);
    test.state.rootEl.isConnected = true;
    test.state.mainCalendarSuspended = false;
    test.context.window.dispatchEvent(new Event('tm:task-horizon-host-lifecycle'));
    test.flush();
    assert.equal(test.context.label, '23:00', `${host}: host resume must refresh without waiting for the next minute`);
    test.jump(2);
    test.context.window.dispatchEvent(new Event('focus'));
    test.flush();
    assert.equal(test.context.label, '23:02', `${host}: window focus must refresh a throttled clock`);

    test.state.calendar.view.type = 'dayGridMonth';
    test.jump(1);
    test.context.window.dispatchEvent(new Event('focus'));
    test.flush();
    assert.equal(test.context.label, '23:02', `${host}: clock resume must not redraw non-timeline views`);
    test.state.calendar.view.type = 'timeGridWeek';
    vm.runInContext('__tmCalendarModuleLifecycleAbort.abort()', test.context);
    test.context.window.dispatchEvent(new Event('focus'));
    test.context.document.dispatchEvent(new Event('visibilitychange'));
    test.context.window.dispatchEvent(new Event('tm:task-horizon-host-lifecycle'));
    test.flush();
    assert.equal(test.context.label, '23:02', `${host}: module cleanup must remove every clock resume listener`);
}

const side = fixture('tab');
let sideLabel;
side.state.sideDay.prototypeRender = () => { sideLabel = new side.context.Date().toTimeString().slice(0, 5); };
side.context.refreshCalendarNowIndicators();
assert.equal(sideLabel, '21:31');
const sideTimerId = side.state.sideDay.nowIndicatorTimer;
const sideTimer = side.timers.get(sideTimerId);
side.jump(80);
side.timers.delete(sideTimerId);
sideTimer.callback();
assert.equal(sideLabel, '22:51', 'the embedded day sidebar must continue using its independent redraw timer');
assert.ok(side.state.sideDay.nowIndicatorTimer, 'the embedded day sidebar must rearm its minute timer');

console.log('calendar now-indicator refresh tests passed');
