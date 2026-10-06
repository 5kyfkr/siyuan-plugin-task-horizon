'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
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
    scrollGesture.advance(499);
    assert.equal(scrollGesture.context.dragActive, undefined, 'timeline must not activate before 500ms');
    const move = event(scrollGesture.bar, pointerType, 100, 120);
    scrollGesture.listeners.get('pointermove')(move);
    scrollGesture.advance(1);
    assert.equal(move.prevented, undefined, 'vertical movement before long press must remain native');
    assert.equal(scrollGesture.context.dragActive, undefined, 'scrolling must cancel pending timeline drag');

    const holdGesture = timelineGesture(pointerType);
    holdGesture.advance(500);
    assert.equal(holdGesture.context.dragActive, true, 'desktop tablet timeline hold must activate drag');
    assert.equal(holdGesture.context.touchLocked, true, 'active tablet dragging must lock scrolling');
}
const mouseTimeline = timelineGesture('mouse');
assert.equal(mouseTimeline.down.prevented, true, 'desktop mouse must retain its immediate drag entry');
assert.equal(mouseTimeline.timers.size, 0, 'mouse must not acquire a long-press timer');

function kanbanGesture(pointerType) {
    const harness = gestureContext();
    const { context } = harness;
    const card = new FakeElement();
    const body = new FakeElement();
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
    return { ...harness, card };
}
for (const pointerType of ['touch', 'pen']) {
    const scrollGesture = kanbanGesture(pointerType);
    assert.equal(scrollGesture.card.getAttribute('draggable'), 'false', 'wide tablet cards must suspend native drag before touchstart reaches SiYuan');
    scrollGesture.advance(499);
    assert.equal(scrollGesture.context.state.draggingTaskId, undefined, 'kanban must wait 500ms');
    const move = event(scrollGesture.card, pointerType, 100, 120);
    scrollGesture.listeners.get('pointermove')(move);
    scrollGesture.advance(1);
    assert.ok(!scrollGesture.context.state.draggingTaskId, 'scrolling must cancel pending kanban drag');
    assert.equal(move.prevented, undefined, 'kanban vertical scrolling must remain native');
    assert.equal(scrollGesture.card.getAttribute('draggable'), 'true', 'scroll cancellation must restore mouse dragging');
    const holdGesture = kanbanGesture(pointerType);
    holdGesture.advance(500);
    assert.equal(holdGesture.context.state.draggingTaskId, 'task-1', 'wide tablet kanban hold must activate custom drag');
    holdGesture.context.state.__tmKanbanCardGestureCleanup();
    assert.equal(holdGesture.card.getAttribute('draggable'), 'true', 'gesture cleanup must restore the native drag attribute');
}
const mouseKanban = kanbanGesture('mouse');
assert.equal(mouseKanban.card.getAttribute('draggable'), 'true', 'external mouse must keep native kanban drag');
assert.equal(mouseKanban.timers.size, 0, 'external mouse must not acquire a touch gesture');

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
checkNotificationReservation().then(() => console.log('tablet runtime and gesture tests passed')).catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
