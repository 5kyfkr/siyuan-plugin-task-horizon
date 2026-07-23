'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const uiSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/30-dialogs-and-ui-foundation.js'), 'utf8');
const renderSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/40-render-runtime.js'), 'utf8');
const lifecycleSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/shell/80-shell-lifecycle.js'), 'utf8');

const observerStart = uiSource.indexOf('    function __tmBindDocTabsOverflowToggle');
const observerEnd = uiSource.indexOf('    function __tmEnsureActiveDocTabVisible', observerStart);
assert.ok(observerStart >= 0 && observerEnd > observerStart, 'doc tab overflow observer must remain inspectable');
const observerBlock = uiSource.slice(observerStart, observerEnd);
assert.match(observerBlock, /requestAnimationFrame\(run\)/, 'overflow measurements must be coalesced into one animation frame');
assert.match(observerBlock, /__tmDocTabsOverflowLastWidth/, 'overflow observer must cache the pane width');
assert.match(observerBlock, /ro\.observe\(pane\)/, 'overflow observer must watch the pane width');
assert.doesNotMatch(observerBlock, /ro\.observe\(tabs\)/, 'overflow observer must not react to the animated tab container height');

const disposeStart = uiSource.indexOf('    function __tmDisposeDocTabsRuntime');
const disposeEnd = uiSource.indexOf('    function __tmBindDocTabsOverflowToggle', disposeStart);
assert.ok(disposeStart >= 0 && disposeEnd > disposeStart, 'doc tab runtime cleanup must remain inspectable');
const disposeBlock = uiSource.slice(disposeStart, disposeEnd);
assert.match(disposeBlock, /__tmDocTabsOverflowResizeObserver\?\.disconnect/, 'old shells must disconnect their overflow observer');
assert.match(disposeBlock, /cancelAnimationFrame\(rafId\)/, 'old shells must cancel pending overflow measurements');

const visibilityStart = uiSource.indexOf('    function __tmSetDocTabsAutoVisible');
const visibilityEnd = uiSource.indexOf('    function __tmScheduleDocTabsAutoHide', visibilityStart);
assert.ok(visibilityStart >= 0 && visibilityEnd > visibilityStart, 'auto-hide transition code must remain inspectable');
const visibilityBlock = uiSource.slice(visibilityStart, visibilityEnd);
assert.match(visibilityBlock, /const unchanged =/, 'repeated requests for the current state must be ignored');
assert.match(visibilityBlock, /__tmBeginDocTabsVisibilitySettle\(tabs/, 'auto-hide must use the shared tab transition lifecycle');
assert.doesNotMatch(visibilityBlock, /setTimeout\([\s\S]*320/, 'the old fixed 320ms layout task must stay removed');

const settleStart = uiSource.indexOf('    function __tmBeginDocTabsVisibilitySettle');
const settleEnd = uiSource.indexOf('    function __tmDisposeDocTabsRuntime', settleStart);
assert.ok(settleStart >= 0 && settleEnd > settleStart, 'shared tab transition lifecycle must remain inspectable');
const settleBlock = uiSource.slice(settleStart, settleEnd);
assert.match(settleBlock, /addEventListener\('transitionend', onEnd\)/, 'layout sync must follow the actual transition end');
assert.match(settleBlock, /setTimeout\(finish, 360\)/, 'transition completion must retain a bounded fallback');
assert.match(settleBlock, /closest\?\.\('\.tm-modal'\)\?\.classList\?\.add\?\.\('tm-modal--doc-tabs-transitioning'\)/, 'tab transitions must expose a temporary modal state to embedded views');
assert.match(uiSource, /closest\?\.\('\.tm-modal'\)\?\.classList\?\.remove\?\.\('tm-modal--doc-tabs-transitioning'\)/, 'the temporary modal transition state must be cleared');

const collapseStart = uiSource.indexOf('    window.tmToggleDocTabsCollapsed');
const collapseEnd = uiSource.indexOf('    function __tmNormalizeLucideIconName', collapseStart);
assert.ok(collapseStart >= 0 && collapseEnd > collapseStart, 'manual tab collapse code must remain inspectable');
assert.match(uiSource.slice(collapseStart, collapseEnd), /__tmBeginDocTabsVisibilitySettle\(tabs/, 'manual multi-row collapse must expose the same transition lifecycle');

const renderCleanup = renderSource.indexOf('__tmDisposeDocTabsRuntime(prevModalSnapshot, { clearHoverTimer: true })');
const renderRemoval = renderSource.indexOf('prevModalSnapshot.remove()', renderCleanup);
assert.ok(renderCleanup >= 0 && renderRemoval > renderCleanup, 'old shell resources must be released before its DOM is removed');
assert.match(lifecycleSource, /function __tmCleanup\(\)[\s\S]*__tmDisposeDocTabsRuntime\?\.\(state\.modal, \{ clearHoverTimer: true \}\)/, 'plugin unload must reuse the doc tab runtime cleanup');

const tabRuleStart = renderSource.indexOf('                    .tm-doc-tabs {');
const tabRuleEnd = renderSource.indexOf('                    }', tabRuleStart);
assert.ok(tabRuleStart >= 0 && tabRuleEnd > tabRuleStart, 'base tab style must remain inspectable');
assert.doesNotMatch(renderSource.slice(tabRuleStart, tabRuleEnd), /will-change/, 'base tabs must not retain a permanent compositor layer');
assert.match(renderSource, /\.tm-doc-tabs\.tm-doc-tabs--transitioning \{[\s\S]*will-change: transform, opacity;/, 'compositor hint must be limited to active transitions');

class FakeElement {
    constructor() {
        this.isConnected = true;
        this.listeners = new Map();
        const classes = new Set();
        this.classList = {
            add: (name) => classes.add(name),
            remove: (name) => classes.delete(name),
            contains: (name) => classes.has(name),
        };
    }

    addEventListener(type, handler) {
        this.listeners.set(type, handler);
    }

    removeEventListener(type, handler) {
        if (this.listeners.get(type) === handler) this.listeners.delete(type);
    }

    emit(type, event) {
        this.listeners.get(type)?.(event);
    }
}

class FakePane extends FakeElement {
    constructor(width) {
        super();
        this.clientWidth = width;
    }
}

class FakeTabs extends FakeElement {
    constructor(pane) {
        super();
        this.pane = pane;
    }

    querySelector(selector) {
        return selector === '.tm-doc-tabs-scroll' ? this.pane : null;
    }

    closest(selector) {
        return selector === '.tm-modal' ? this.modal : null;
    }
}

class FakeModal extends FakeElement {
    constructor(tabs) {
        super();
        this.tabs = tabs;
        tabs.modal = this;
        this.topbar = new FakeElement();
    }

    querySelector(selector) {
        if (selector === '.tm-doc-tabs') return this.tabs;
        if (selector === '.tm-filter-rule-bar') return this.topbar;
        return null;
    }
}

class FakeResizeObserver {
    static instances = [];

    constructor(callback) {
        this.callback = callback;
        this.disconnected = false;
        FakeResizeObserver.instances.push(this);
    }

    observe(target) {
        this.target = target;
    }

    disconnect() {
        this.disconnected = true;
    }

    emitWidth(width) {
        this.callback([{ contentRect: { width } }]);
    }
}

let nextFrameId = 1;
let nextTimerId = 1;
const frames = new Map();
const timers = new Map();
let overflowSyncCount = 0;
const runtimeContext = {
    Array,
    Element: FakeElement,
    HTMLElement: FakeElement,
    Math,
    Number,
    ResizeObserver: FakeResizeObserver,
    __tmClearDocTabsAutoHideHoverTimer() {},
    __tmSyncDocTabsOverflowToggle() { overflowSyncCount += 1; },
    cancelAnimationFrame(id) { frames.delete(id); },
    clearTimeout(id) { timers.delete(id); },
    requestAnimationFrame(callback) {
        const id = nextFrameId++;
        frames.set(id, callback);
        return id;
    },
    setTimeout(callback) {
        const id = nextTimerId++;
        timers.set(id, callback);
        return id;
    },
};
runtimeContext.globalThis = runtimeContext;
vm.createContext(runtimeContext);
const runtimeStart = uiSource.indexOf('    function __tmClearDocTabsVisibilitySettle');
const runtimeBlock = uiSource.slice(runtimeStart, observerEnd);
vm.runInContext(`${runtimeBlock}\nthis.beginDocTabsSettle = __tmBeginDocTabsVisibilitySettle; this.bindDocTabsOverflow = __tmBindDocTabsOverflowToggle; this.disposeDocTabs = __tmDisposeDocTabsRuntime;`, runtimeContext);

const flushFrames = () => {
    const pending = Array.from(frames.values());
    frames.clear();
    pending.forEach((callback) => callback());
};

const lifecyclePane = new FakePane(640);
const lifecycleTabs = new FakeTabs(lifecyclePane);
const lifecycleModal = new FakeModal(lifecycleTabs);
let lifecycleSettled = 0;
runtimeContext.beginDocTabsSettle(lifecycleTabs, () => { lifecycleSettled += 1; });
assert.equal(lifecycleTabs.classList.contains('tm-doc-tabs--transitioning'), true, 'tabs must expose their active transition state');
assert.equal(lifecycleModal.classList.contains('tm-modal--doc-tabs-transitioning'), true, 'the containing modal must expose the active tab transition');
assert.equal(timers.size, 1, 'an active tab transition must retain only one fallback timer');
lifecycleTabs.emit('transitionend', { target: lifecycleTabs, propertyName: 'max-height' });
assert.equal(lifecycleSettled, 1, 'the transition end must settle once');
assert.equal(lifecycleTabs.classList.contains('tm-doc-tabs--transitioning'), false, 'the tab transition state must be removed after settling');
assert.equal(lifecycleModal.classList.contains('tm-modal--doc-tabs-transitioning'), false, 'the modal transition state must be removed after settling');
assert.equal(timers.size, 0, 'settling must clear the fallback timer');
assert.equal(lifecycleTabs.listeners.has('transitionend'), false, 'settling must remove the transition listener');

for (let index = 0; index < 1000; index += 1) {
    const pane = new FakePane(640);
    const tabs = new FakeTabs(pane);
    const modal = new FakeModal(tabs);
    runtimeContext.bindDocTabsOverflow(modal);
    const observer = FakeResizeObserver.instances[FakeResizeObserver.instances.length - 1];
    for (let heightTick = 0; heightTick < 20; heightTick += 1) observer.emitWidth(640);
    flushFrames();
    runtimeContext.disposeDocTabs(modal);
    assert.equal(observer.disconnected, true, 'each replaced shell must disconnect its observer');
    assert.equal(frames.size, 0, 'each replaced shell must leave no pending overflow frame');
}
assert.equal(overflowSyncCount, 1000, 'height-only observer activity must not add overflow measurements');
assert.equal(FakeResizeObserver.instances.filter((observer) => !observer.disconnected).length, 0, 'stress run must leave no active observer');

console.log('doc tabs auto-hide performance contract tests passed');
