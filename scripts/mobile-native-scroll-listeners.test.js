'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const extract = (file, start, end) => {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const from = source.indexOf(start);
    const to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from);
    return source.slice(from, to);
};
class Element {
    constructor(classes = []) {
        this.classes = new Set(classes);
        this.classList = {
            contains: name => this.classes.has(name),
            add: (...names) => names.forEach(name => this.classes.add(name)),
            remove: (...names) => names.forEach(name => this.classes.delete(name)),
            toggle: (name, on) => on ? this.classes.add(name) : this.classes.delete(name),
        };
        this.style = { setProperty() {}, removeProperty() {} };
        this.listeners = [];
        this.clientHeight = 844;
        this.clientWidth = 390;
        this.scrollWidth = 390;
    }
    addEventListener(type, handler, options = {}) {
        const capture = options === true || options.capture === true;
        if (!this.listeners.some(e => e.type === type && e.handler === handler && e.capture === capture)) {
            this.listeners.push({ type, handler, capture, passive: options.passive === true });
        }
    }
    removeEventListener(type, handler, options = {}) {
        const capture = options === true || options.capture === true;
        this.listeners = this.listeners.filter(e => !(e.type === type && e.handler === handler && e.capture === capture));
    }
    emit(type, event) {
        for (const entry of this.listeners.filter(e => e.type === type)) entry.handler(event);
    }
    querySelector(selector) { return selector === '.tm-mobile-bottom-viewbar' ? this.bar : null; }
    querySelectorAll() { return []; }
    closest(selector) { return selector === '.tm-mobile-bottom-viewbar' && this.classes.has('tm-mobile-bottom-viewbar') ? this : null; }
    removeAttribute() {}
}
const window = new Element();
window.innerHeight = 844;
window.matchMedia = () => ({ matches: true });
const document = new Element();
document.documentElement = new Element();
document.body = new Element();
const timers = new Map();
let timerId = 0;
const state = {};
const context = vm.createContext({
    window, document, state, Element, HTMLElement: Element,
    setTimeout: fn => { timers.set(++timerId, fn); return timerId; },
    clearTimeout: id => timers.delete(id),
    requestAnimationFrame: fn => fn(),
    __tmIsRuntimeMobileClient: () => true,
});
vm.runInContext(extract('src/task-horizon/main/render/45-render-shell-controls-and-resize.js',
    '    function __tmBindMobileFullscreenBottomViewbarSwipe(',
    '    function __tmMarkMobileBottomViewbarSwitching('), context);
vm.runInContext(extract('src/task-horizon/main/20-api-and-runtime-services.js',
    '    function __tmBindMobileDockHorizontalTouchScroll(',
    '    function __tmBindTopbarOverflowTooltips('), context);
const blockers = () => [window, document].flatMap(e => e.listeners).filter(e => e.type === 'touchmove' && !e.passive).length;
const modal = new Element(['tm-modal--mobile']);
modal.bar = new Element(['tm-mobile-bottom-viewbar']);
state.modal = modal;
const event = (type, target, x = 180, y = 820) => ({
    type, target, pointerType: 'touch', pointerId: 1, clientX: x, clientY: y,
    changedTouches: [{ identifier: 1, clientX: x, clientY: y }],
    touches: type === 'touchend' ? [] : [{ identifier: 1, clientX: x, clientY: y }],
    prevented: false,
    preventDefault() { this.prevented = true; },
    stopPropagation() {}, stopImmediatePropagation() {},
});

context.__tmBindMobileFullscreenBottomViewbarSwipe(modal);
assert.equal(blockers(), 0, 'idle fullscreen must not force card scrolling to wait for touchmove handlers');
const idleListenerCount = window.listeners.length + document.listeners.length;
for (let i = 0; i < 20; i++) {
    const body = new Element();
    window.emit('pointerdown', event('pointerdown', body));
    window.emit('touchstart', event('touchstart', body));
    assert.equal(blockers(), 0, 'a card swipe must never arm bottom-bar blockers');
    window.emit('pointerdown', event('pointerdown', modal.bar));
    window.emit('touchstart', event('touchstart', modal.bar));
    assert.equal(blockers(), 2, 'a bottom-bar gesture must retain window and document interception');
    const move = event('pointermove', modal.bar, 180, 828);
    window.emit('pointermove', move);
    assert.equal(move.prevented, true, 'recognized vertical bar movement must still cancel native scrolling');
    window.emit('pointerup', event('pointerup', modal.bar, 180, 828));
    window.emit('touchend', event('touchend', modal.bar, 180, 828));
    assert.equal(blockers(), 0, 'finishing a non-dismiss gesture must restore native scrolling');
    assert.equal(state.mobileBottomViewbarDismissDragging, false);
    context.__tmBindMobileFullscreenBottomViewbarSwipe(modal);
    assert.equal(window.listeners.length + document.listeners.length, idleListenerCount, 'rebinding must not leak listeners');
}
window.emit('touchstart', event('touchstart', modal.bar));
assert.equal(blockers(), 2, 'touch-only WebViews must arm the same gesture blockers');
window.emit('touchcancel', event('touchcancel', modal.bar));
assert.equal(blockers(), 0, 'cancelled touch-only gestures must release blockers');
window.emit('pointerdown', event('pointerdown', modal.bar));
window.emit('touchstart', event('touchstart', modal.bar));
window.emit('pointermove', event('pointermove', modal.bar, 210, 820));
window.emit('pointercancel', event('pointercancel', modal.bar, 0, 0));
assert.notEqual(state.mobileBottomViewbarDismissClosing, true, 'native horizontal pan cancellation at (0, 0) must not dismiss the view');
assert.equal(blockers(), 2, 'pointer cancellation must preserve the paired touch stream');
window.emit('touchend', event('touchend', modal.bar));
assert.equal(blockers(), 0, 'the paired touch end must release blockers');
window.emit('pointerdown', event('pointerdown', modal.bar));
window.emit('pointermove', event('pointermove', modal.bar, 180, 770));
assert.equal(state.mobileBottomViewbarDismissClosing, true, 'upward dismissal must still start');
assert.equal(blockers(), 2, 'dismissal must protect the tail of the active gesture until close');
state.mobileBottomViewbarSwipeCleanup();
assert.equal(blockers(), 0, 'closing during an active gesture must remove blockers');
assert.equal(window.listeners.length + document.listeners.length, 0, 'fullscreen cleanup must remove all listeners');

const dock = new Element(['tm-modal--dock', 'tm-modal--runtime-mobile']);
state.modal = dock;
assert.equal(context.__tmBindMobileDockHorizontalTouchScroll(dock), true);
assert.equal(blockers(), 0, 'the Dock propagation guard must remain passive during native card scrolling');
state.dockHorizontalTouchScrollCleanup();
assert.equal(window.listeners.length + document.listeners.length + dock.listeners.length, 0);
console.log('mobile native scroll listener lifecycle tests passed');
