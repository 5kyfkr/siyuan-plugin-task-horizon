const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const calendarSource = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const calendarStyles = fs.readFileSync(path.join(root, 'calendar-view.css'), 'utf8');
const taskStyles = fs.readFileSync(path.join(root, 'task-horizon.css'), 'utf8');

assert.match(
    calendarSource,
    /function scheduleCalendarSidebarResizeFrame\(calendar\)[\s\S]*callFullCalendarUpdateSize\(targetCalendar\)/,
    'calendar sidebar transitions must keep live FullCalendar size updates',
);
assert.match(
    calendarSource,
    /function beginCalendarSidebarTransition\(wrap\)[\s\S]*transitionend[\s\S]*scheduleCalendarSidebarResizeSettle/,
    'calendar sidebar transitions must finish with one trailing resize settle',
);
assert.match(
    calendarSource,
    /if \(state\.calendarSidebarTransitionWrap === wrap\) \{[\s\S]*scheduleCalendarSidebarResizeFrame\(calendar\);[\s\S]*return;/,
    'resize observer must skip repeated full layout passes during the sidebar transition',
);
assert.match(
    calendarSource,
    /state\.calendarSidebarTransitionCleanup\?\.\(\)[\s\S]*cancelAnimationFrame\(state\.calendarSidebarResizeRaf\)/,
    'calendar teardown must clean transition listeners, timers, and animation frames',
);
assert.match(
    calendarSource,
    /const docTabsTransitioning = !widthChanged[\s\S]*scheduleCalendarHostResizeSettle\(wrap, host, calendar\);[\s\S]*return;/,
    'document-tab height transitions must defer expensive calendar layout work',
);
assert.match(
    calendarSource,
    /function scheduleCalendarHostResizeSettle\(wrap, host, calendar\)[\s\S]*setTimeout\([\s\S]*requestAnimationFrame\([\s\S]*finishOverflowGuard[\s\S]*}, 80\)/,
    'deferred calendar height transitions must use a short trailing overflow settle timer',
);
assert.match(
    calendarSource,
    /scheduleCalendarHostResizeSettle\(wrap, host, calendar\)[\s\S]*classList\?\.add\?\.\('tm-calendar-root--host-height-transitioning'\)[\s\S]*requestAnimationFrame\(finishOverflowGuard\)/,
    'the month overflow guard must remain active until the final calendar layout has painted',
);
assert.match(
    calendarSource,
    /function scheduleTaskPageRender\(wrap, settings\) \{[\s\S]*if \(!isCalendarTaskPageVisible\(targetWrap\)\) return false;[\s\S]*if \(!isCalendarTaskPageVisible\(nextWrap\)\) return;/,
    'calendar task page rendering must be skipped while its sidebar page is hidden',
);
assert.match(
    calendarSource,
    /setCalendarSidebarOpen\(wrap, !s\.collapseDesktopSidebarDefault\);[\s\S]*if \(isCalendarTaskPageVisible\(wrap\)\) renderTaskPage\(wrap, s\);/,
    'the initial task page must render synchronously only when the sidebar and task page are visible',
);
const monthLayoutStart = calendarSource.indexOf('    function syncMainCalendarMonthViewLayout');
const monthLayoutEnd = calendarSource.indexOf('    function applyMainCalendarMonthCellMinHeightLayout', monthLayoutStart);
assert.ok(monthLayoutStart >= 0 && monthLayoutEnd > monthLayoutStart, 'month layout runtime must remain inspectable');
const monthLayoutBlock = calendarSource.slice(monthLayoutStart, monthLayoutEnd);
assert.match(monthLayoutBlock, /targetCalendar\.batchRendering\(applyCalendarOptions\)/, 'month view option changes must be batched into one FullCalendar render');

const layoutRefreshStart = calendarSource.indexOf('    function scheduleMainCalendarLayoutRefresh');
const layoutFrameStart = calendarSource.indexOf('state.mainLayoutRaf = requestAnimationFrame', layoutRefreshStart);
const layoutFrameEnd = calendarSource.indexOf('            return true;', layoutFrameStart);
assert.ok(layoutRefreshStart >= 0 && layoutFrameStart > layoutRefreshStart && layoutFrameEnd > layoutFrameStart, 'calendar layout frame must remain inspectable');
const layoutFrameBlock = calendarSource.slice(layoutFrameStart, layoutFrameEnd);
assert.equal((layoutFrameBlock.match(/applyMainCalendarMonthLayoutPass\(/g) || []).length, 1, 'one layout frame must traverse month cells only once');
assert.equal((layoutFrameBlock.match(/applyTimeGridAllDayMoreLinkLayout\(/g) || []).length, 1, 'one layout frame must apply all-day more-link layout only once');
assert.equal((layoutFrameBlock.match(/applyTimeAxisColumnLayout\(/g) || []).length, 1, 'one layout frame must apply time-axis layout only once');
assert.match(calendarSource, /eventsSet: \(\) => \{[\s\S]*if \(!wrap\.classList\.contains\('tm-calendar-wrap--view-switching'\)\)/, 'eventsSet must leave final layout to the loading completion while a view is switching');
assert.match(calendarSource, /datesSet: \(\) => \{[\s\S]*if \(!wrap\.classList\.contains\('tm-calendar-wrap--view-switching'\)\)/, 'datesSet must leave final layout to the loading completion while a view is switching');
assert.match(
    calendarStyles,
    /\.tm-calendar-sidebar\s*\{[\s\S]*transition: width 0\.2s ease, min-width 0\.2s ease, max-width 0\.2s ease, border-color 0\.2s ease, opacity 0\.16s ease;/,
    'calendar sidebar animation timing and properties must remain unchanged',
);
assert.match(
    calendarStyles,
    /\.tm-modal--doc-tabs-transitioning \.tm-calendar-root--month-fit,\s*\.tm-calendar-root--month-fit\.tm-calendar-root--host-height-transitioning\s*\{\s*overflow-y: hidden !important;/,
    'adaptive month view must suppress transient scrollbars while document-tab height settles',
);

const readRule = (pattern, label) => {
    const rule = taskStyles.match(pattern)?.[0] || '';
    assert.ok(rule, `${label} rule must exist`);
    return rule;
};

const popupRule = readRule(/\.tm-popup-surface\s*\{[\s\S]*?\}/, 'popup surface');
assert.doesNotMatch(popupRule, /will-change/, 'popup surfaces must not retain a permanent compositor hint');
const stageAnimationRules = readRule(/\.tm-main-stage\.tm-stage-anim[\s\S]*?@keyframes tmPopupOverlayFadeIn/, 'main-stage animation');
assert.doesNotMatch(stageAnimationRules, /will-change/, 'main-stage animation classes must not retain a compositor hint');
assert.match(stageAnimationRules, /animation: tmBoxFadeSlide 240ms ease-out;/, 'main-stage fade animation must remain unchanged');
assert.match(stageAnimationRules, /animation: tmBoxInFromRight 300ms cubic-bezier\(0\.2, 0, 0, 1\);/, 'main-stage right animation must remain unchanged');
assert.match(stageAnimationRules, /animation: tmBoxInFromLeft 300ms cubic-bezier\(0\.2, 0, 0, 1\);/, 'main-stage left animation must remain unchanged');
const popupEnterRule = readRule(/\.tm-popup-surface-enter\s*\{[\s\S]*?\}/, 'popup entrance');
assert.doesNotMatch(popupEnterRule, /will-change/, 'popup entrance classes must not retain a compositor hint after animation');
assert.match(popupEnterRule, /animation: tmPopupSurfaceIn 220ms cubic-bezier\(0\.2, 0\.9, 0\.2, 1\) both;/, 'popup entrance animation must remain unchanged');
const popupSheetEnterRule = readRule(/\.tm-popup-surface-enter--sheet\s*\{[\s\S]*?\}/, 'popup sheet entrance');
assert.doesNotMatch(popupSheetEnterRule, /will-change/, 'popup sheet entrance classes must not retain a compositor hint after animation');
assert.match(popupSheetEnterRule, /animation: tmPopupSheetIn 240ms cubic-bezier\(0\.2, 0\.9, 0\.2, 1\) both;/, 'popup sheet entrance animation must remain unchanged');

class FakeElement {
    constructor() {
        this.listeners = new Map();
        const classes = new Set();
        this.classList = {
            add: (name) => classes.add(name),
            remove: (name) => classes.delete(name),
            contains: (name) => classes.has(name),
            toggle: (name, active) => active ? classes.add(name) : classes.delete(name),
        };
    }

    addEventListener(type, handler) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type).add(handler);
    }

    removeEventListener(type, handler) {
        this.listeners.get(type)?.delete(handler);
    }

    emit(type, event) {
        Array.from(this.listeners.get(type) || []).forEach((handler) => handler(event));
    }
}

class FakeWrap extends FakeElement {
    constructor(sidebar) {
        super();
        this.sidebar = sidebar;
        this.isConnected = true;
    }

    querySelector(selector) {
        return selector === '.tm-calendar-sidebar' ? this.sidebar : null;
    }
}

const taskPageFrames = [];
let taskPageBodyRenderCount = 0;
const taskPageRuntimeState = {
    sidePage: 'calendar',
    taskPageRenderRaf: null,
    taskPageRenderWrap: null,
    taskPageRenderSettings: null,
};
const taskPageRuntimeContext = {
    Element: FakeElement,
    state: taskPageRuntimeState,
    getSettings() { return {}; },
    renderTaskPanel() {},
    renderTaskPage() { taskPageBodyRenderCount += 1; },
    requestAnimationFrame(callback) {
        taskPageFrames.push(callback);
        return taskPageFrames.length;
    },
};
vm.createContext(taskPageRuntimeContext);
const taskPageRuntimeStart = calendarSource.indexOf('    function isCalendarTaskPageVisible');
const taskPageRuntimeEnd = calendarSource.indexOf('    function scheduleMainCalendarLayoutRefresh', taskPageRuntimeStart);
assert.ok(taskPageRuntimeStart >= 0 && taskPageRuntimeEnd > taskPageRuntimeStart, 'calendar task-page runtime must remain inspectable');
vm.runInContext(
    `${calendarSource.slice(taskPageRuntimeStart, taskPageRuntimeEnd)}\nthis.scheduleTaskPage = scheduleTaskPageRender;`,
    taskPageRuntimeContext,
);

const hiddenTaskWrap = new FakeWrap(new FakeElement());
hiddenTaskWrap.classList.toggle('tm-calendar-wrap--sidebar-collapsed', true);
taskPageRuntimeState.sidePage = 'tasks';
assert.equal(taskPageRuntimeContext.scheduleTaskPage(hiddenTaskWrap, {}), false, 'collapsed task sidebar must not schedule a render');
assert.equal(taskPageFrames.length, 0, 'collapsed task sidebar must not retain a render frame');

hiddenTaskWrap.classList.toggle('tm-calendar-wrap--sidebar-collapsed', false);
assert.equal(taskPageRuntimeContext.scheduleTaskPage(hiddenTaskWrap, {}), true, 'visible task sidebar must schedule a render');
hiddenTaskWrap.classList.toggle('tm-calendar-wrap--sidebar-collapsed', true);
taskPageFrames.shift()();
assert.equal(taskPageBodyRenderCount, 0, 'a queued task-page render must stop if the sidebar closes first');

let nextTimerId = 1;
let nextFrameId = 1;
let liveResizeCount = 0;
let fullRefreshCount = 0;
let taskPageRenderCount = 0;
const timers = new Map();
const frames = new Map();
const runtimeState = {
    calendar: { updateSize() { liveResizeCount += 1; } },
    calendarEl: new FakeElement(),
    rootEl: new FakeElement(),
    sidebarOpen: true,
    calendarSidebarTransitionWrap: null,
    calendarSidebarTransitionCleanup: null,
    calendarSidebarResizeRaf: null,
    calendarHostResizeSettleTimer: null,
    calendarHostResizeSettleRoot: null,
};
const runtimeContext = {
    HTMLElement: FakeElement,
    state: runtimeState,
    getSettings() { return {}; },
    scheduleTaskPageRender() { taskPageRenderCount += 1; },
    callFullCalendarUpdateSize() { liveResizeCount += 1; },
    scheduleMainCalendarLayoutRefresh() { fullRefreshCount += 1; },
    requestAnimationFrame(callback) {
        const id = nextFrameId++;
        frames.set(id, callback);
        return id;
    },
    cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout(callback) {
        const id = nextTimerId++;
        timers.set(id, callback);
        return id;
    },
    clearTimeout(id) { timers.delete(id); },
};
vm.createContext(runtimeContext);
const runtimeStart = calendarSource.indexOf('    function scheduleCalendarSidebarResizeFrame');
const runtimeEnd = calendarSource.indexOf('    function toggleMobileSidebar', runtimeStart);
assert.ok(runtimeStart >= 0 && runtimeEnd > runtimeStart, 'calendar sidebar runtime must remain inspectable');
vm.runInContext(
    `${calendarSource.slice(runtimeStart, runtimeEnd)}\nthis.scheduleResize = scheduleCalendarSidebarResizeFrame; this.scheduleHostSettle = scheduleCalendarHostResizeSettle; this.setOpen = setCalendarSidebarOpen;`,
    runtimeContext,
);

const sidebar = new FakeElement();
const wrap = new FakeWrap(sidebar);
for (let index = 0; index < 1000; index += 1) {
    const isOpen = !wrap.classList.contains('tm-calendar-wrap--sidebar-collapsed');
    runtimeContext.setOpen(wrap, !isOpen);
    assert.equal(timers.size, 1, 'repeated sidebar toggles must retain only one fallback timer');
    assert.equal(sidebar.listeners.get('transitionend')?.size || 0, 1, 'repeated sidebar toggles must retain only one transition listener');
}
runtimeState.calendarSidebarTransitionCleanup();
assert.equal(timers.size, 0, 'transition cleanup must clear its fallback timer');
assert.equal(sidebar.listeners.get('transitionend')?.size || 0, 0, 'transition cleanup must remove its listener');

runtimeContext.setOpen(wrap, wrap.classList.contains('tm-calendar-wrap--sidebar-collapsed'));
sidebar.emit('transitionend', { target: sidebar, propertyName: 'width' });
assert.equal(fullRefreshCount, 0, 'transition completion must defer the final full layout refresh');
const sidebarSettleCallback = Array.from(timers.values())[0];
timers.clear();
sidebarSettleCallback();
assert.equal(fullRefreshCount, 1, 'sidebar settle must run one full layout refresh');
assert.equal(timers.size, 0, 'sidebar settle must clear its trailing resize timer');

const taskSidebar = new FakeElement();
const taskWrap = new FakeWrap(taskSidebar);
taskWrap.classList.toggle('tm-calendar-wrap--sidebar-collapsed', true);
runtimeState.sidePage = 'tasks';
runtimeContext.setOpen(taskWrap, true);
assert.equal(taskPageRenderCount, 1, 'opening the task sidebar must schedule one fresh task-page render');
runtimeState.calendarSidebarTransitionCleanup();

for (let index = 0; index < 20; index += 1) runtimeContext.scheduleResize(runtimeState.calendar);
assert.equal(frames.size, 1, 'live sidebar resize updates must coalesce into one frame');
Array.from(frames.values()).forEach((callback) => callback());
frames.clear();
assert.equal(liveResizeCount, 1, 'a coalesced resize frame must update FullCalendar once');

for (let index = 0; index < 1000; index += 1) {
    runtimeContext.scheduleHostSettle(wrap, runtimeState.calendarEl, runtimeState.calendar);
}
assert.equal(timers.size, 1, 'repeated host height changes must retain only one settle timer');
assert.equal(runtimeState.rootEl.classList.contains('tm-calendar-root--host-height-transitioning'), true, 'host height changes must activate the overflow guard');
const settleCallback = Array.from(timers.values())[0];
timers.clear();
settleCallback();
assert.equal(fullRefreshCount, 1, 'settled host height must not add another full calendar layout refresh');
assert.equal(runtimeState.rootEl.classList.contains('tm-calendar-root--host-height-transitioning'), true, 'the overflow guard must remain through the final layout frame');
const firstSettleFrame = Array.from(frames.values())[0];
frames.clear();
firstSettleFrame();
assert.equal(runtimeState.rootEl.classList.contains('tm-calendar-root--host-height-transitioning'), true, 'the overflow guard must remain for one paint after final layout');
const finalSettleFrame = Array.from(frames.values())[0];
frames.clear();
finalSettleFrame();
assert.equal(runtimeState.rootEl.classList.contains('tm-calendar-root--host-height-transitioning'), false, 'the overflow guard must be removed after settling');
assert.equal(runtimeState.calendarHostResizeSettleRoot, null, 'settling must release the guarded root reference');

console.log('calendar sidebar animation performance contract tests passed');
