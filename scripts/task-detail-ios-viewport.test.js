'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const start = source.indexOf('    function __tmApplyMobileDetailSheetViewportMetrics(');
const end = source.indexOf('\n    const __tmRenderViewSwitcherButtons', start);
assert.ok(start >= 0 && end > start);

class Element extends EventTarget {
    constructor(classes = []) {
        super();
        this.classes = new Set(classes);
        this.classList = {
            contains: (name) => this.classes.has(name),
            toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name),
        };
        this.properties = new Map();
        this.style = {
            setProperty: (name, value) => this.properties.set(name, value),
            removeProperty: (name) => this.properties.delete(name),
        };
        this.offsetParent = null;
        this.clientTop = 0;
        this.clientHeight = 844;
        this.top = 0;
        this.isConnected = true;
        this.sheets = [];
    }
    querySelectorAll() { return this.sheets; }
    getBoundingClientRect() { return { top: this.top }; }
}

const modal = new Element(['tm-modal--mobile']);
const fixedSheet = new Element();
const embeddedSheet = new Element();
const host = new Element();
host.top = 64;
host.clientHeight = 780;
embeddedSheet.offsetParent = host;
modal.sheets = [fixedSheet, embeddedSheet];
const viewport = Object.assign(new EventTarget(), { height: 844, offsetTop: 0 });
const window = Object.assign(new EventTarget(), { innerHeight: 844, visualViewport: viewport });
const navigator = { userAgent: '', platform: '', maxTouchPoints: 0 };
const frames = new Map();
const timers = new Map();
let nextHandle = 0;
let clientKind = 'ios-app';
const state = { modal, checklistDetailSheetFullscreen: false };
const context = vm.createContext({
    HTMLElement: Element, Element, window, navigator, state,
    document: { documentElement: { clientHeight: 844 }, body: { contains: (node) => node.isConnected } },
    __tmGetRuntimeClientKind: () => clientKind,
    __tmComputeMobileBottomViewbarLayoutSig: () => 'unchanged',
    __tmApplyMobileBrowserViewportMetrics: () => {},
    __tmRerenderCurrentViewInPlace: () => { throw new Error('keyboard movement must not rebuild the editor'); },
    __tmRuntimeEvents: {
        on: (target, event, handler) => target.addEventListener(event, handler),
        off: (target, event, handler) => target?.removeEventListener(event, handler),
    },
    requestAnimationFrame: (callback) => { frames.set(++nextHandle, callback); return nextHandle; },
    cancelAnimationFrame: (handle) => frames.delete(handle),
    setTimeout: (callback) => { timers.set(++nextHandle, callback); return nextHandle; },
    clearTimeout: (handle) => timers.delete(handle),
});
vm.runInContext(source.slice(start, end), context);
const flush = (queue) => {
    const callbacks = [...queue.values()];
    queue.clear();
    callbacks.forEach((callback) => callback());
};
const metrics = (sheet) => ['top', 'bottom', 'height'].map((name) => parseFloat(sheet.properties.get(`--tm-sheet-visible-${name}`)));

context.__tmBindMobileViewportAutoRefresh(modal);
assert.deepEqual(metrics(fixedSheet), [0, 0, 844]);
assert.deepEqual(metrics(embeddedSheet), [0, 0, 780]);

// Layout height stays unchanged as iOS opens its keyboard and pans to an input.
viewport.height = 344;
viewport.offsetTop = 180;
viewport.dispatchEvent(new Event('resize'));
viewport.dispatchEvent(new Event('scroll'));
assert.equal(frames.size, 1, 'viewport animation must coalesce to one layout update per frame');
flush(frames);
assert.deepEqual(metrics(fixedSheet), [180, 320, 344]);
assert.deepEqual(metrics(embeddedSheet), [116, 320, 344]);
assert.equal(state.checklistDetailSheetFullscreen, false, 'editing must preserve the collapsed snap state');
flush(timers);

viewport.offsetTop = 220;
viewport.dispatchEvent(new Event('scroll'));
flush(frames);
assert.deepEqual(metrics(fixedSheet), [220, 280, 344], 'panning between title, subtask and remark must update the top limit');

// A browser shell already following visualViewport must not apply the offset twice.
host.top = 220;
host.clientHeight = 344;
context.__tmApplyMobileDetailSheetViewportMetrics(modal);
assert.deepEqual(metrics(embeddedSheet), [0, 0, 344]);

viewport.height = 844;
viewport.offsetTop = 0;
host.top = 64;
host.clientHeight = 780;
viewport.dispatchEvent(new Event('resize'));
flush(frames);
assert.deepEqual(metrics(fixedSheet), [0, 0, 844], 'keyboard dismissal must restore the original available area');
assert.deepEqual(metrics(embeddedSheet), [0, 0, 780]);

for (const kind of ['harmony-app', 'android-app', 'desktop-browser']) {
    clientKind = kind;
    context.__tmApplyMobileDetailSheetViewportMetrics(modal);
    assert.equal(fixedSheet.classes.has('tm-checklist-sheet--visual-viewport'), false, `${kind} must retain its existing layout`);
    assert.equal(fixedSheet.properties.size, 0);
}
clientKind = 'mobile-browser';
navigator.platform = 'MacIntel';
navigator.maxTouchPoints = 5;
context.__tmApplyMobileDetailSheetViewportMetrics(modal);
assert.equal(fixedSheet.classes.has('tm-checklist-sheet--visual-viewport'), true, 'iPad desktop user agents must receive the same bounds');
window.visualViewport = null;
context.__tmApplyMobileDetailSheetViewportMetrics(modal);
assert.equal(fixedSheet.properties.size, 0, 'unavailable viewport APIs must fall back cleanly');
window.visualViewport = viewport;

viewport.dispatchEvent(new Event('resize'));
context.__tmUnbindMobileViewportAutoRefresh();
assert.equal(frames.size, 0, 'closing must cancel the pending frame');
assert.equal(timers.size, 0, 'closing must cancel the pending refresh');
viewport.dispatchEvent(new Event('scroll'));
assert.equal(frames.size, 0, 'closing must remove viewport listeners');

console.log('task detail iOS viewport tests passed');
