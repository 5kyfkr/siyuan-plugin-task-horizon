'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const render = fs.readFileSync(path.join(root, 'src/task-horizon/main/40-render-runtime.js'), 'utf8');
const switches = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/47-render-side-panels-and-view-switching.js'), 'utf8');
function between(start, end) {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, start);
    return source.slice(from, to);
}

class Element {
    constructor(signature = 'mobile-dock:mobile') {
        this.signature = signature;
        this.dataset = { tmUiMode: 'mobile' };
        this.classList = { add() {}, remove() {}, toggle() {} };
        this.style = { removeProperty() {} };
        this.isConnected = true;
    }
    contains(node) { return this.child === node; }
    remove() { this.isConnected = false; }
    replaceWith(node) { this.replacement = node; this.remove(); node.isConnected = true; }
    replaceChildren(node) { this.child = node; }
    closest() { return null; }
    querySelector() { return null; }
}

const counts = { refetch: 0, sideRefetch: 0, layout: 0, render: 0, destroy: 0, popoverClose: 0, unsubscribe: 0 };
const oldRoot = new Element();
const wrap = new Element();
oldRoot.child = wrap;
const calendar = {
    view: { type: 'dayGridWeek' }, date: '2026-09-28', events: [{ id: 'task-a' }],
    render() {}, refetchEvents() { counts.refetch++; }, destroy() { counts.destroy++; },
};
const state = {
    mounted: true, rootEl: oldRoot, wrapEl: wrap, calendar,
    mainCalendarHostSignature: oldRoot.signature,
    queuePrototypeSurfaceRender() { counts.render++; },
    taskMutationUnsubscribe() { counts.unsubscribe++; },
};
const context = vm.createContext({
    state, Element, HTMLElement: Element, console,
    window: { removeEventListener() {} }, document: { removeEventListener() {} },
    __tmCalendarEngine: { createCalendarEngine: (node, options) => options.testEngine },
    getMainCalendarHostDefaultMeta: (node) => ({ hostSignature: node.signature }),
    getCalendarView: (engine) => engine?.view,
    normalizeCalendarSidebarDefaultPage: (value) => value,
    syncWrapBottomInset() {}, closeModal() {},
    closeTrackedPrototypeMorePopover() {},
    closeTrackedPrototypeEventPopover() { counts.popoverClose++; },
    clearDockHistoryRangeCache() {}, destroyTaskDraggable() {}, clearCalendarHostResizeSettle() {},
    calendarTomatoDocCache: new Map(),
    getSettings: () => ({}),
    scheduleTaskPageRender() { counts.layout++; },
    applyCalendarSlotHeightStyle() { counts.layout++; },
    scheduleMainCalendarLayoutRefresh() { counts.layout++; },
    stabilizeCalendarLayout() { counts.layout++; },
});
let pinchDisposals = 0, pinchCancellations = 0;
state.calendarEl = new Element();
state.calendarEl.__tmTimelinePinch = {
    cancel() { pinchCancellations++; },
    dispose() { pinchDisposals++; },
};
vm.runInContext(between('    const calendarAdapterByInstance =', '    function getCalendarView(')
    + between('    function refreshInPlace(options) {', '    function collectCalendarsForTaskSync('), context);
state.calendarAdapter = context.createCalendarEngineAdapter(oldRoot, { testEngine: calendar });
state.calendarAdapter.mount();
const side = { render() {}, refetchEvents() { counts.sideRefetch++; } };
const sideAdapter = context.createCalendarEngineAdapter(new Element(), { testEngine: side });
sideAdapter.mount();
// Run the production reuse branch; a miss explicitly falls back to unmount.
vm.runInContext(between('    function mount(rootEl, opts) {', '        unmount({ preserveRootHtml:')
    + '        unmount(); return false;\n    }\n'
    + between('    function unmount(options = {}) {', '    const calendarSubscriptionPublisher ='), context);

const allMainCalendarViews = [
    'timeGridDay', 'timeGrid3Day', 'timeGridWorkdays',
    'timeGridWeek', 'dayGridWeek', 'dayGridMonth', 'listMonth',
];
for (const viewType of allMainCalendarViews) {
    calendar.view.type = viewType;
    context.unmount({ preserveInstance: true });
    assert.equal(state.mainCalendarSuspended, true);
    assert.equal(oldRoot.isConnected, false);
    assert.equal(state.calendar, calendar);
    assert.equal(counts.destroy, 0);
    assert.equal(pinchDisposals, 0, 'parking the calendar must retain its pinch listeners');
    const placeholder = new Element();
    assert.equal(context.mount(placeholder, {}), true);
    assert.equal(placeholder.replacement, oldRoot, 'resume must reuse the root captured by handlers');
    assert.equal(oldRoot.child, wrap, 'the card DOM must survive the switch');
    assert.equal(state.mainCalendarSuspended, false);
    assert.equal(calendar.date, '2026-09-28');
    assert.equal(counts.refetch, 0, 'unchanged task-view switches must not reload sources');
}

vm.runInContext(between('    function __tmRefetchCalendarSource(', '    async function __tmBuildVisibleTaskDateEvent(')
    + between('    function __tmRefreshTaskDateSourceInPlace(', '    function __tmRefetchTaskDateSources('), context);
context.unmount({ preserveInstance: true });
context.__tmRefetchCalendarSource(calendar, 'schedule');
context.__tmRefreshTaskDateSourceInPlace(calendar, 'taskdate');
assert.equal(state.mainCalendarNeedsRefresh, true);
assert.equal(counts.refetch, 0, 'background invalidation must wait for resume');
context.mount(new Element(), {});
assert.equal(counts.refetch, 1, 'multiple invalidations must coalesce into one refresh');
assert.equal(state.mainCalendarNeedsRefresh, false);

for (const viewType of allMainCalendarViews) {
    calendar.view.type = viewType;
    const reads = counts.refetch, sideReads = counts.sideRefetch;
    context.unmount({ preserveInstance: true });
    context.refreshInPlace({ layoutOnly: true });
    assert.equal(state.mainCalendarNeedsRefresh, false, 'layout-only work must not dirty the data snapshot');
    context.refreshInPlace({});
    state.calendarAdapter.refetchEvents();
    state.calendarAdapter.refetchEvents();
    sideAdapter.refetchEvents();
    assert.equal(counts.refetch, reads, `${viewType}: direct and in-place refresh must wait for resume`);
    assert.equal(counts.sideRefetch, sideReads + 1, 'the visible side calendar must remain independent');
    assert.equal(counts.layout, 0, 'a suspended calendar must not schedule detached layout work');
    assert.deepEqual(calendar.events, [{ id: 'task-a' }], 'the retained event snapshot must survive');
    context.mount(new Element(), {});
    assert.equal(counts.refetch, reads + 1, `${viewType}: deferred refreshes must coalesce on resume`);
    assert.equal(state.mainCalendarNeedsRefresh, false);
}

context.unmount({ preserveInstance: true });
context.unmount();
assert.equal(counts.destroy, 1, 'closing a suspended calendar must destroy the engine');
assert.equal(pinchDisposals, 1, 'closing must dispose the retained pinch listeners');
assert.ok(pinchCancellations >= allMainCalendarViews.length, 'parking must cancel any active pinch without losing its listeners');
assert.equal(counts.unsubscribe, 1, 'closing must remove the retained mutation subscription');
assert.equal(state.calendar, null);
assert.equal(state.rootEl, null);
assert.equal(state.mainCalendarSuspended, false);
assert.ok(counts.popoverClose >= 4, 'body-level editors must close on every view switch');

assert.match(render, /preserveInstance: state\.__tmPreserveShellDuringViewSwitchRender === true/, 'full shell switching must retain the calendar');
assert.match(switches, /prevMode === 'calendar'[\s\S]*?unmount\?\.\(\{ preserveInstance: true \}\)/, 'stage-only switching must retain the calendar too');
console.log('calendar view switch lifecycle tests passed');
