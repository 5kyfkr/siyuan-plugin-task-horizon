'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('./i18n-vm-fixture');

const source = fs.readFileSync(path.join(__dirname, '..', 'calendar-view.js'), 'utf8');
function between(start, end) {
    const from = source.indexOf(start), to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, start);
    return source.slice(from, to);
}
class HTMLElement extends EventTarget {
    constructor() {
        super();
        const properties = new Map();
        this.style = { setProperty: (key, value) => properties.set(key, value), getPropertyValue: key => properties.get(key) };
        this.scrollTop = 320;
        this.querySelector = () => null;
    }
}
const window = new EventTarget();
const root = new HTMLElement();
const prototypeSurface = new HTMLElement();
const app = new HTMLElement();
prototypeSurface.querySelector = selector => selector === '.tm-proto-app' ? app : null;
const local = new Map([
    ['tm_calendar_event_opacity_light', '0.15'],
    ['tm_calendar_event_opacity_dark', '0.45'],
]);
let theme = 'light', saves = 0, renders = 0;
const store = { loaded: false, data: { calendarIcsCalendarName: 'Test' }, save: () => { saves++; } };
const state = { settingsStore: store, sideDay: { rootEl: root, calendar: {} } };
const document = new EventTarget();
document.documentElement = { getAttribute: key => key === 'data-theme-mode' ? theme : '' };
const context = vm.createContext({
    console, Event, EventTarget, AbortController, HTMLElement, window, document, state, prototypeSurface,
    localStorage: { getItem: key => local.get(key), setItem: (key, value) => local.set(key, value) },
    __tmCalendarEngine: { createCalendarEngine() {} },
    ensureCalendarEngineExternalDragHostForEvent() {},
    requestAnimationFrame: fn => { fn(); return 1; },
    callCalendarAdapter() {}, bindSideDayNativeDrop() {}, scheduleSideDayLayout() {},
    getSettings: () => ({}), queuePrototypeSurfaceRender: () => { renders++; },
    bindScheduleReminderEngine() {}, reconcileCalendarSubscriptionPublisher() {},
    CALENDAR_EXTERNAL_DRAG_ENGINE_ONLY: true,
});
vm.runInContext([
    between('    function isDarkThemeMode()', '    function getCalendarDoneTextColor()'),
    between('    const __tmCalendarModuleLifecycleAbort =', '    function isVisibleCalendarExternalDragMirror('),
    between('    function mountSideDayTimeline(', '    function setSideDayDate('),
    between('    function setSettingsStore(', '    async function openScheduleEditorById('),
    'globalThis.dispose = () => __tmCalendarModuleLifecycleAbort.abort();',
].join('\n'), context);

const opacity = el => el.style.getPropertyValue('--tm-cal-event-opacity');
assert.equal(context.mountSideDayTimeline(root, { settingsStore: store, enableExternalDrag: false }), true);
assert.equal(opacity(root), '15%', 'a checklist side calendar must load saved opacity without a main calendar');
assert.equal(root.scrollTop, 320, 'opacity sync must preserve the sidebar scroll position');
theme = 'dark';
window.dispatchEvent(new Event('tm:appearance-theme-updated'));
assert.equal(opacity(root), '45%', 'theme changes must work when only the side calendar exists');

store.loaded = true;
Object.assign(store.data, { calendarEventOpacityLight: 0.4, calendarEventOpacityDark: 0.6 });
context.setSettingsStore(store);
assert.equal(opacity(root), '60%', 'late settings hydration must replace the local fallback');
theme = 'light';
window.dispatchEvent(new Event('tm:appearance-theme-updated'));
assert.equal(opacity(root), '40%');

vm.runInContext([
    between('        const prototypeOpacityByTheme =', '        const applyPrototypeSelectedEventState ='),
    between("            prototypeSurface.addEventListener('input', (event) => {",
        "            prototypeSurface.addEventListener('contextmenu', (event) => {"),
    'globalThis.syncMainTheme = syncPrototypeOpacityTheme;',
].join('\n'), context);
context.syncMainTheme();
assert.equal(opacity(root), opacity(app), 'both calendar entry points must use the same setting');

function slide(mode, value) {
    const target = new HTMLElement();
    target.value = String(value);
    target.matches = selector => selector === '[data-tm-proto-opacity]';
    target.getAttribute = () => mode;
    const event = new Event('input');
    Object.defineProperty(event, 'target', { value: target });
    prototypeSurface.dispatchEvent(event);
}
slide('light', 0.55);
assert.equal(opacity(root), '55%', 'the main slider must immediately update the mounted side calendar');
assert.equal(opacity(root), opacity(app));
assert.equal(store.data.calendarEventOpacityLight, 0.55);
assert.equal(local.get('tm_calendar_event_opacity_light'), '0.55');
slide('dark', 0.1);
assert.equal(opacity(root), '55%', 'changing the inactive theme must preserve the current theme');
theme = 'dark';
window.dispatchEvent(new Event('tm:appearance-theme-updated'));
context.syncMainTheme();
assert.equal(opacity(root), '10%');
assert.equal(opacity(root), opacity(app));

Object.assign(store.data, { calendarEventOpacityLight: 0.35, calendarEventOpacityDark: 0.5 });
context.setSettingsStore(store);
assert.equal(opacity(root), '50%', 'cloud refresh must update an already mounted side calendar');
assert.equal(opacity(root), opacity(app));
assert.equal(saves, 2, 'synchronizing presentation must not introduce extra settings writes');
assert.equal(renders, 1, 'side opacity updates must not trigger calendar rebuilds');

const savedSideRoot = state.sideDay.rootEl;
state.sideDay.rootEl = null;
assert.doesNotThrow(() => window.dispatchEvent(new Event('tm:appearance-theme-updated')));
state.sideDay.rootEl = savedSideRoot;
context.dispose();
theme = 'light';
window.dispatchEvent(new Event('tm:appearance-theme-updated'));
assert.equal(opacity(root), '50%', 'module cleanup must remove the theme listener');

console.log('calendar side event opacity regression tests passed');
