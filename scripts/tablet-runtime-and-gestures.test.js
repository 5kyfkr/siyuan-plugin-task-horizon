'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('./i18n-vm-fixture');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const entry = read('index.js');
const runtime = read('src/task-horizon/main/20-api-and-runtime-services.js');
const calendar = read('calendar-view.js');
const gantt = read('src/task-horizon/main/shell/82-gantt-runtime.js');
const kanban = read('src/task-horizon/main/40-render-runtime.js');
function section(source, start, end) {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, `missing section: ${start}`);
    return source.slice(from, to);
}

const entryStart = entry.indexOf('const hasOfficialMobileRuntimeSignal =');
const entryEnd = entry.indexOf('\n};', entry.indexOf('const getRuntimeClientKind =')) + 3;
const runtimeDetection = section(runtime, 'const __tmGetRuntimeBackendType =', 'const __tmResolveNavigationTopWindow =');
const calendarDetection = section(calendar, 'function getRuntimeBackendType()', 'function isMobileBrowserViewport()')
    + section(calendar, 'function isNativeMobileRuntime()', 'function normalizeNotificationId(')
    + section(calendar, 'function getNotificationBridgeCandidates()', 'function getPlatformUtilsCompat()');
for (const options of [
    { frontend: 'desktop', container: 'android', bridge: 'JSAndroid', native: true },
    { frontend: 'browser-desktop', container: 'android', native: false },
    { frontend: 'browser-mobile', container: 'android', native: false },
    { frontend: 'desktop', container: 'harmony', bridge: 'JSHarmony', native: true },
    { frontend: 'browser-desktop', container: 'harmony', native: false },
    { frontend: 'desktop', container: 'ios', bridge: 'webkit', native: true },
    { frontend: 'desktop', container: 'windows', native: false },
]) {
    const context = {
        getFrontend: () => options.frontend,
        __taskHorizonFrontend: options.frontend,
        __tmHostUsesMobileUI: () => false,
        __tmSiyuanSdk: null,
        navigator: { userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 5 },
        document: { documentElement: { dataset: {} } },
        siyuan: { config: { system: { container: options.container } } },
    };
    context.window = context;
    if (options.bridge === 'webkit') context.webkit = { messageHandlers: { sendNotification: { postMessage() {} } } };
    else if (options.bridge) context[options.bridge] = { sendNotification() {} };
    vm.createContext(context);
    vm.runInContext(entry.slice(entryStart, entryEnd), context);
    const nativeFlag = vm.runInContext('isNativeMobileRuntimeClient()', context);
    assert.equal(nativeFlag, options.native, `${options.frontend}/${options.container}: entry native capability`);
    const expectedKind = options.frontend === 'browser-mobile' ? 'mobile-browser' : 'desktop-browser';
    assert.equal(vm.runInContext('getRuntimeClientKind()', context), expectedKind, 'native capability must not change the chosen desktop UI');
    vm.runInContext(runtimeDetection, context);
    assert.equal(vm.runInContext('__tmIsNativeMobileRuntimeClient()', context), options.native, 'runtime must agree with entry native capability');
    assert.equal(vm.runInContext('__tmGetRuntimeClientKind()', context), expectedKind, 'runtime must preserve frontend classification');
    assert.equal(vm.runInContext('__tmShouldUseCustomTouchTaskDrag()', context), true, 'desktop tablets must bind the touch entry');
    context.__taskHorizonPluginIsNativeMobile = nativeFlag;
    vm.runInContext(`(function () { ${calendarDetection}\n globalThis.testPreferDeviceNotificationBackend = shouldPreferDeviceNotificationBackend; })();`, context);
    assert.equal(context.testPreferDeviceNotificationBackend(), options.native, 'notification scheduling must follow the local native bridge');
    delete context.__taskHorizonPluginIsNativeMobile;
    assert.equal(context.testPreferDeviceNotificationBackend(), options.native, 'standalone calendar detection must agree');
}

class FakeElement {
    constructor() {
        this.attrs = new Map();
        this.style = {};
        this.dataset = {};
        this.classes = new Set();
        this.classList = {
            contains: (value) => this.classes.has(value),
            add: (value) => this.classes.add(value),
            remove: (value) => this.classes.delete(value),
            toggle: (value, enabled) => enabled ? this.classes.add(value) : this.classes.delete(value),
        };
    }
    getAttribute(key) { return this.attrs.get(key) ?? null; }
    setAttribute(key, value) { this.attrs.set(key, value); }
    removeAttribute(key) { this.attrs.delete(key); }
    contains(element) {
        for (let current = element; current; current = current.parentElement) {
            if (current === this) return true;
        }
        return false;
    }
    querySelector() { return null; }
    closest() { return null; }
    setPointerCapture() { this.captured = true; }
    hasPointerCapture() { return !!this.captured; }
    releasePointerCapture() { this.captured = false; }
}
function gestureContext() {
    const timers = new Map();
    const listeners = new Map();
    let now = 0;
    let timerId = 0;
    const context = {
        Element: FakeElement, HTMLElement: FakeElement,
        state: { viewMode: 'kanban', timelineMultiSelectedTaskIds: [] },
        setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, at: now + delay }); return id; },
        clearTimeout(id) { timers.delete(id); },
        __tmRuntimeEvents: {
            on(target, type, handler) { listeners.set(type, handler); },
            off(target, type, handler) { if (listeners.get(type) === handler) listeners.delete(type); },
        },
        document: {
            addEventListener(type, handler) { listeners.set(type, handler); },
            removeEventListener(type, handler) { if (listeners.get(type) === handler) listeners.delete(type); },
        },
        addEventListener(type, handler) { listeners.set(type, handler); },
        removeEventListener(type, handler) { if (listeners.get(type) === handler) listeners.delete(type); },
    };
    context.window = context;
    vm.createContext(context);
    return {
        context, timers, listeners,
        advance(ms) {
            now += ms;
            for (const [id, timer] of [...timers]) {
                if (timer.at > now) continue;
                timers.delete(id);
                timer.fn();
            }
        },
    };
}
const event = (target, pointerType, x = 100, y = 100) => ({
    target, currentTarget: target, pointerType, pointerId: 1, button: 0, clientX: x, clientY: y,
    preventDefault() { this.prevented = true; }, stopPropagation() {},
});

function timelineGesture(pointerType) {
    const harness = gestureContext();
    const { context } = harness;
    const bar = new FakeElement();
    const row = new FakeElement();
    const body = new FakeElement();
    const scroll = new FakeElement();
    const modal = new FakeElement();
    row.setAttribute('data-id', 'task-1');
    bar.style = { left: '100px', width: '50px' };
    bar.closest = (selector) => selector === '.tm-gantt-bar' ? bar : selector === '.tm-gantt-row' ? row : null;
    body.dataset = { tmGanttStartTs: '1', tmGanttDayWidth: '50', tmGanttDayCount: '30', tmGanttSnapDays: '1' };
    scroll.scrollLeft = 0;
    modal.querySelector = (selector) => selector === '.tm-timeline-right-body' ? scroll : null;
    Object.assign(context, {
        bodyEl: body, mobileTimelineModalEl: modal, isMobileTimelineGlobal: false,
        onUpdateTaskDates: async () => {}, onUpdateGroupDates: null,
        getTaskById: () => ({ id: 'task-1' }), findTimelineBarAtPointer: () => bar,
        clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
        TIMELINE_MIN_RESIZE_WIDTH_PX: 5, isDark: false,
        setTimelineDraggingX(enabled) { context.dragActive = enabled; },
        setMobileTimelineTouchLock(enabled, touchInput) { context.touchLocked = enabled && touchInput; },
    });
    vm.runInContext(section(gantt, 'const onPointerDown = (e) =>', 'const onPanPointerDown = (e) =>'), context);
    const down = event(bar, pointerType);
    context.down = down;
    vm.runInContext('onPointerDown(down)', context);
    return { ...harness, bar, scroll, down };
}
for (const pointerType of ['touch', 'pen']) {
    const scrollGesture = timelineGesture(pointerType);
    assert.equal(scrollGesture.down.prevented, undefined, 'a desktop tablet press must allow scrolling');
    scrollGesture.advance(999);
    assert.equal(scrollGesture.context.dragActive, undefined, 'timeline must not activate before 1000ms');
    const move = event(scrollGesture.bar, pointerType, 100, 120);
    scrollGesture.listeners.get('pointermove')(move);
    scrollGesture.advance(1);
    assert.equal(move.prevented, undefined, 'vertical movement before long press must remain native');
    assert.equal(scrollGesture.context.dragActive, undefined, 'scrolling must cancel pending timeline drag');

    const holdGesture = timelineGesture(pointerType);
    holdGesture.advance(500);
    assert.equal(holdGesture.context.dragActive, undefined, 'timeline must still wait at the old 500ms threshold');
    holdGesture.advance(499);
    assert.equal(holdGesture.context.dragActive, undefined, 'timeline must wait until the full 1000ms hold');
    holdGesture.advance(1);
    assert.equal(holdGesture.context.dragActive, true, 'desktop tablet timeline hold must activate drag');
    assert.equal(holdGesture.context.touchLocked, true, 'active tablet dragging must lock scrolling');
}
const mouseTimeline = timelineGesture('mouse');
assert.equal(mouseTimeline.down.prevented, true, 'desktop mouse must retain its immediate drag entry');
assert.equal(mouseTimeline.timers.size, 0, 'mouse must not acquire a long-press timer');

function kanbanGesture(pointerType, { nested = false } = {}) {
    const harness = gestureContext();
    const { context } = harness;
    const card = new FakeElement();
    const body = new FakeElement();
    const column = new FakeElement();
    const parentCard = new FakeElement();
    column.parentElement = body;
    parentCard.parentElement = column;
    parentCard.setAttribute('draggable', 'true');
    card.parentElement = nested ? parentCard : column;
    card.setAttribute('draggable', 'true');
    card.setAttribute('data-id', 'task-1');
    card.closest = (selector) => selector === '.tm-body.tm-body--kanban' ? body : null;
    body.scrollLeft = 0;
    Object.assign(context, {
        __tmShouldUseCustomTouchTaskDrag: () => true,
        __tmIsMultiSelectActive: () => false,
        __tmResolveKanbanEffectiveDragTarget: (taskId, cardEl) => ({ taskId, cardEl }),
        __tmBuildTaskDragSelectionIds: () => ['task-1'],
        __tmClearKanbanCardGesture() { context.state.__tmKanbanCardGestureCleanup?.(); },
        __tmStopKanbanMomentum() {}, __tmGetKanbanMaxPanScrollLeft: () => 0,
        __tmFlushKanbanScrollLeftRaf() {}, __tmSetKanbanSnapPanActive() {},
        __tmIsKanbanColumnSnapMode: () => false,
        __tmBuildKanbanTouchDragGhost: () => null, __tmPlaceKanbanTouchDragGhost() {},
        __tmResolveKanbanPointTarget: () => null, __tmApplyKanbanDragHoverFromTarget() {},
    });
    vm.runInContext(section(kanban, 'function __tmIsKanbanTouchPointer', 'function __tmResolveKanbanPointTarget'), context);
    vm.runInContext(section(kanban, 'window.tmKanbanCardPointerDown = function', 'function __tmGetKanbanBottomNavAvoidanceState'), context);
    context.tmKanbanCardPointerDown(event(card, pointerType), 'task-1');
    return { ...harness, card, body, column, parentCard };
}
for (const pointerType of ['touch', 'pen']) {
    const scrollGesture = kanbanGesture(pointerType);
    assert.equal(scrollGesture.card.getAttribute('draggable'), 'false', 'wide tablet cards must suspend native drag before touchstart reaches SiYuan');
    scrollGesture.advance(999);
    assert.equal(scrollGesture.context.state.draggingTaskId, undefined, 'kanban must wait 1000ms');
    const move = event(scrollGesture.card, pointerType, 100, 120);
    scrollGesture.listeners.get('pointermove')(move);
    scrollGesture.advance(1);
    assert.ok(!scrollGesture.context.state.draggingTaskId, 'scrolling must cancel pending kanban drag');
    assert.equal(move.prevented, undefined, 'kanban vertical scrolling must remain native');
    assert.equal(scrollGesture.card.getAttribute('draggable'), 'false', 'scrolling must keep native dragging suspended until release');
    scrollGesture.listeners.get('pointerup')(event(scrollGesture.card, pointerType));
    assert.equal(scrollGesture.card.getAttribute('draggable'), 'true', 'release after scrolling must restore mouse dragging');
    const holdGesture = kanbanGesture(pointerType);
    holdGesture.advance(500);
    assert.equal(holdGesture.context.state.draggingTaskId, undefined, 'kanban must still wait at the old 500ms threshold');
    holdGesture.advance(499);
    assert.equal(holdGesture.context.state.draggingTaskId, undefined, 'kanban must wait until the full 1000ms hold');
    holdGesture.advance(1);
    assert.equal(holdGesture.context.state.draggingTaskId, 'task-1', 'wide tablet kanban hold must activate custom drag');
    holdGesture.context.state.__tmKanbanCardGestureCleanup();
    assert.equal(holdGesture.card.getAttribute('draggable'), 'true', 'gesture cleanup must restore the native drag attribute');
}
const mouseKanban = kanbanGesture('mouse');
assert.equal(mouseKanban.card.getAttribute('draggable'), 'true', 'external mouse must keep native kanban drag');
assert.equal(mouseKanban.timers.size, 0, 'external mouse must not acquire a touch gesture');

const nestedKanban = kanbanGesture('touch', { nested: true });
assert.equal(nestedKanban.parentCard.getAttribute('draggable'), 'false', 'a child-card touch must also suspend draggable ancestors before the host bridge sees touchstart');
const nativeDrag = event(nestedKanban.parentCard, '');
nestedKanban.listeners.get('dragstart')(nativeDrag);
assert.equal(nativeDrag.prevented, true, 'a host-generated native drag must not bypass the 1000ms custom gate');
nestedKanban.context.state.__tmKanbanCardGestureCleanup();
assert.equal(nestedKanban.parentCard.getAttribute('draggable'), 'true', 'ancestor drag attributes must be restored exactly on cleanup');

const touchEvent = (target, type, x = 100, y = 100) => ({
    ...event(target, 'touch', x, y), type,
    touches: type === 'touchend' || type === 'touchcancel' ? [] : [{ identifier: 7, clientX: x, clientY: y }],
    changedTouches: [{ identifier: 7, clientX: x, clientY: y }],
});
const touchOnlyScroll = kanbanGesture('touch');
touchOnlyScroll.listeners.get('touchstart')(touchEvent(touchOnlyScroll.card, 'touchstart'));
touchOnlyScroll.advance(600);
const touchMove = touchEvent(touchOnlyScroll.card, 'touchmove', 100, 120);
touchOnlyScroll.listeners.get('touchmove')(touchMove);
touchOnlyScroll.advance(1000);
assert.ok(!touchOnlyScroll.context.state.draggingTaskId, 'touch-only scroll updates must cancel the timer even without pointermove');
assert.equal(touchMove.prevented, undefined, 'pending Touch events must preserve native vertical scrolling');
assert.equal(touchOnlyScroll.card.getAttribute('draggable'), 'false', 'touch-only scrolling must retain native drag isolation');
touchOnlyScroll.listeners.get('pointercancel')({ ...event(touchOnlyScroll.card, 'touch'), type: 'pointercancel' });
assert.equal(touchOnlyScroll.card.getAttribute('draggable'), 'false', 'native scrolling pointercancel must retain isolation until touchend');
touchOnlyScroll.listeners.get('touchend')(touchEvent(touchOnlyScroll.card, 'touchend', 100, 120));
assert.equal(touchOnlyScroll.card.getAttribute('draggable'), 'true', 'touchend must restore dragging after the Pointer stream was canceled');
assert.equal(touchOnlyScroll.listeners.size, 0, 'touch completion must remove every gesture listener');

const scrolledColumn = kanbanGesture('touch');
scrolledColumn.listeners.get('scroll')({ target: scrolledColumn.column });
scrolledColumn.advance(1200);
assert.ok(!scrolledColumn.context.state.draggingTaskId, 'actual column scrolling must cancel a hold even if pointer coordinates are stale');
scrolledColumn.context.state.__tmKanbanCardGestureCleanup();

const unrelatedScroll = kanbanGesture('touch');
unrelatedScroll.listeners.get('scroll')({ target: new FakeElement() });
unrelatedScroll.advance(1000);
assert.equal(unrelatedScroll.context.state.draggingTaskId, 'task-1', 'scrolling outside the kanban must not cancel an intentional hold');
unrelatedScroll.context.state.__tmKanbanCardGestureCleanup();

for (const cancelType of ['pointercancel', 'touchcancel', 'blur']) {
    const canceledDrag = kanbanGesture('touch');
    let dropCalls = 0;
    canceledDrag.context.__tmCalendar = {
        finalizeFloatingMiniCalendarTouchDrop() { dropCalls += 1; return true; },
    };
    canceledDrag.advance(1000);
    canceledDrag.listeners.get(cancelType)({ ...event(canceledDrag.card, 'touch'), type: cancelType });
    assert.equal(dropCalls, 0, `${cancelType} must abort the drag without committing a drop`);
    assert.ok(!canceledDrag.context.state.draggingTaskId, `${cancelType} must clear the active drag immediately`);
    assert.equal(canceledDrag.listeners.size, 0, `${cancelType} must remove gesture listeners`);
}

const releasedTouch = kanbanGesture('touch');
releasedTouch.listeners.get('touchend')(touchEvent(releasedTouch.card, 'touchend'));
releasedTouch.advance(1000);
assert.ok(!releasedTouch.context.state.draggingTaskId, 'touchend without pointerup must not leave a timer that starts dragging after release');

const tinyJitter = kanbanGesture('touch');
tinyJitter.listeners.get('pointermove')(event(tinyJitter.card, 'touch', 102, 101));
tinyJitter.advance(1000);
assert.equal(tinyJitter.context.state.draggingTaskId, 'task-1', 'small finger jitter must still allow an intentional 1000ms hold');
tinyJitter.context.state.__tmKanbanCardGestureCleanup();

const edgeScroll = kanbanGesture('touch');
edgeScroll.listeners.get('pointermove')(event(edgeScroll.card, 'touch', 100, 0));
edgeScroll.advance(1000);
assert.ok(!edgeScroll.context.state.draggingTaskId, 'zero-valued coordinates at the screen edge must cancel the hold');
edgeScroll.context.state.__tmKanbanCardGestureCleanup();

const multiTouch = kanbanGesture('touch');
multiTouch.listeners.get('touchstart')(touchEvent(multiTouch.card, 'touchstart'));
const secondTouch = touchEvent(new FakeElement(), 'touchstart');
secondTouch.touches.push({ identifier: 8, clientX: 300, clientY: 300 });
multiTouch.listeners.get('touchstart')(secondTouch);
multiTouch.advance(1000);
assert.ok(!multiTouch.context.state.draggingTaskId, 'a second finger must cancel the task hold instead of starting a drag');

async function checkKanbanSingleDrop() {
    const gesture = kanbanGesture('touch');
    let drops = 0;
    gesture.context.__tmCalendar = {
        async finalizeFloatingMiniCalendarTouchDrop() { drops += 1; return true; },
    };
    gesture.advance(1000);
    const onUp = gesture.listeners.get('pointerup');
    const onTouchEnd = gesture.listeners.get('touchend');
    await Promise.all([
        onUp(event(gesture.card, 'touch')),
        onTouchEnd(touchEvent(gesture.card, 'touchend')),
    ]);
    assert.equal(drops, 1, 'pointerup and touchend for the same release must commit exactly one drop');
    assert.ok(!gesture.context.state.draggingTaskId, 'a completed touch drop must clear drag state');
    assert.equal(gesture.listeners.size, 0, 'a completed touch drop must remove all gesture listeners');
}

async function checkNotificationReservation() {
    let sends = 0;
    let cancels = 0;
    const context = {
        state: { isMobileDevice: false }, isLikelyMobileRuntime: () => false,
        shouldPreferDeviceNotificationBackend: () => true,
        getScheduleDeviceSchedule: () => null,
        sanitizeScheduleNotificationEntries: (entries) => entries || [],
        collectScheduleMobileNotificationTargets: () => [{ atMs: Date.now() + 60000, notificationKey: 'reminder-1' }],
        buildScheduleMobilePlanKey: () => 'plan-1',
        sendDeviceNotificationCompat: async () => { sends += 1; return 42; },
        cancelScheduleMobileNotificationEntries: async () => { cancels += 1; },
        getScheduleMobileNotificationTitle: () => 'Task', getScheduleMobileNotificationBody: () => '',
        normalizeNotificationId: Number, getScheduleNotificationMutationSignature: () => 'signature-1',
        setScheduleDeviceSchedule() {}, DEVICE_NOTIFICATION_CHANNEL: 'Task Horizon',
    };
    vm.createContext(context);
    vm.runInContext(section(calendar, 'async function reconcileSingleScheduleMobileNotification(', 'async function cleanupOrphanScheduleMobileRegistry('), context);
    const registry = {};
    await context.reconcileSingleScheduleMobileNotification({ id: 'schedule-1' }, {}, registry);
    assert.equal(sends, 1, 'native tablet desktop UI must reserve its notification');
    assert.equal(registry['schedule-1'].entries[0].id, 42, 'native reservation must be retained');
    assert.equal(cancels, 0, 'desktop UI must not clear a native tablet reservation');
}
Promise.all([checkNotificationReservation(), checkKanbanSingleDrop()]).then(() => console.log('tablet runtime and gesture tests passed')).catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
