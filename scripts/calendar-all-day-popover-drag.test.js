'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'calendar-view.js'), 'utf8');
const styles = fs.readFileSync(path.resolve(__dirname, '..', 'calendar-view.css'), 'utf8');

function readFunction(name) {
    const start = source.indexOf(`    function ${name}(`);
    assert.ok(start >= 0, `${name} must exist`);
    const end = source.indexOf('\n    }', start) + 6;
    return source.slice(start, end);
}

class FakeElement {
    constructor(parent = null, selectors = []) {
        this.parent = parent;
        this.selectors = selectors;
        this.listeners = new Map();
        const classes = new Set();
        this.classList = {
            add: (name) => classes.add(name),
            remove: (name) => classes.delete(name),
            contains: (name) => classes.has(name),
        };
    }

    closest(selector) {
        const selectors = selector.split(',').map((value) => value.trim());
        return selectors.some((value) => this.selectors.includes(value)) ? this : this.parent?.closest(selector) || null;
    }

    contains(target) {
        return !!target && (target === this || this.contains(target.parent));
    }

    addEventListener(type, handler, capture) {
        assert.equal(capture, true, 'pointer handlers must keep capture-phase ordering');
        if (!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type).add(handler);
    }

    removeEventListener(type, handler) {
        this.listeners.get(type)?.delete(handler);
    }

    dispatch(type, target, extra = {}) {
        const event = { type, target, pointerId: 1, pointerType: 'mouse', button: 0, clientX: 20, clientY: 20, ...extra };
        for (const handler of this.listeners.get(type) || []) handler(event);
        return event;
    }

    remove() {
        this.removed = true;
    }
}

function createFixture(surfaceSelector, options = {}) {
    const document = new FakeElement();
    const surface = new FakeElement(document, [surfaceSelector]);
    const anchor = new FakeElement(surface);
    const pop = new FakeElement(document, ['.tm-proto-more-popover']);
    const eventEl = new FakeElement(pop, ['[data-tm-proto-event]']);
    const title = new FakeElement(eventEl);
    const checkbox = new FakeElement(eventEl, ['.tm-proto-event-check']);
    const outside = new FakeElement(document);
    const eventApi = { id: 'shared-id', allDay: true, editable: true, ...options.event };
    const activeCalendar = { view: { type: options.view || 'timeGridDay' }, events: [eventApi] };
    const calls = [];
    const state = {};
    const context = vm.createContext({
        Element: FakeElement, document, state,
        getCalendarView: (calendar) => calendar.view,
        getCalendarEventIdFromElement: () => eventApi.id,
        getCalendarEventById: (calendar, id) => {
            assert.equal(calendar, activeCalendar, 'the popover must use its owning calendar');
            return options.storeFallback ? null : calendar.events.find((event) => event.id === id);
        },
        getCalendarEvents: (calendar) => calendar.events,
    });
    vm.runInContext([
        readFunction('bindPrototypeSurfacePointerHandler'),
        readFunction('bindPrototypeMorePopoverDrag'),
        readFunction('closeTrackedPrototypeMorePopover'),
    ].join('\n'), context);
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
        context.bindPrototypeSurfacePointerHandler(surface, type, (event) => {
            calls.push(type);
            if (type === 'pointermove' && event.clientY > 28) pop.classList.add('is-dragging');
        });
    }
    const cleanupDrag = context.bindPrototypeMorePopoverDrag(pop, anchor, activeCalendar);
    state.__tmPrototypeMorePopover = { el: pop, cleanupDrag };
    return { document, surface, pop, eventEl, title, checkbox, outside, calls, context, cleanupDrag };
}

for (const surfaceSelector of ['[data-tm-cal-surface]', '[data-tm-side-proto-surface]']) {
    let fixture = createFixture(surfaceSelector);
    fixture.pop.dispatch('pointerdown', fixture.title);
    fixture.document.dispatch('pointermove', fixture.title, { clientY: 70 });
    assert.equal(fixture.pop.classList.contains('is-dragging'), true, 'dragging must uncover the timeline');
    fixture.document.dispatch('pointerup', fixture.outside, { clientY: 70 });
    assert.deepEqual(fixture.calls, ['pointerdown', 'pointermove', 'pointerup']);
    assert.equal(fixture.pop.removed, true, 'a completed drag must dismiss the popup');
    for (const type of ['pointermove', 'pointerup', 'pointercancel']) {
        assert.equal(fixture.document.listeners.get(type).size, 0, 'closing must remove document listeners');
    }

    fixture = createFixture(surfaceSelector);
    fixture.pop.dispatch('pointerdown', fixture.title);
    fixture.document.dispatch('pointermove', fixture.surface, { clientY: 70 });
    fixture.surface.dispatch('pointermove', fixture.surface, { clientY: 70 });
    fixture.document.dispatch('pointerup', fixture.surface, { clientY: 70 });
    fixture.surface.dispatch('pointerup', fixture.surface, { clientY: 70 });
    assert.deepEqual(fixture.calls, ['pointerdown', 'pointermove', 'pointerup'], 'captured events must not be forwarded twice');

    for (const pointerType of ['mouse', 'touch', 'pen']) {
        fixture = createFixture(surfaceSelector);
        fixture.pop.dispatch('pointerdown', fixture.title, { pointerType });
        fixture.document.dispatch('pointermove', fixture.title, { pointerType, clientY: 22 });
        fixture.document.dispatch('pointerup', fixture.title, { pointerType, clientY: 22 });
        assert.deepEqual(fixture.calls, ['pointerdown', 'pointermove', 'pointercancel'], 'a tap must leave the native popup click intact');
        assert.notEqual(fixture.pop.removed, true);
        fixture.cleanupDrag();
    }

    fixture = createFixture(surfaceSelector);
    fixture.pop.dispatch('pointerdown', fixture.checkbox);
    fixture.pop.dispatch('pointerdown', fixture.title, { button: 2 });
    assert.deepEqual(fixture.calls, [], 'checkboxes and context clicks must not drag');
    fixture.cleanupDrag();

    for (const event of [{ editable: false }, { allDay: false }]) {
        fixture = createFixture(surfaceSelector, { event });
        fixture.pop.dispatch('pointerdown', fixture.title);
        assert.deepEqual(fixture.calls, [], 'only editable all-day events participate');
        fixture.cleanupDrag();
    }

    fixture = createFixture(surfaceSelector, { storeFallback: true });
    fixture.pop.dispatch('pointerdown', fixture.title);
    fixture.document.dispatch('pointermove', fixture.outside, { pointerId: 2, clientY: 70 });
    fixture.document.dispatch('pointerup', fixture.outside, { pointerId: 2 });
    assert.deepEqual(fixture.calls, ['pointerdown'], 'other pointers must not finish the active drag');
    fixture.document.dispatch('pointermove', fixture.outside, { clientY: 70 });
    fixture.document.dispatch('pointercancel', fixture.outside);
    assert.deepEqual(fixture.calls, ['pointerdown', 'pointermove', 'pointercancel']);
    assert.equal(fixture.pop.removed, true);

    fixture = createFixture(surfaceSelector);
    fixture.pop.dispatch('pointerdown', fixture.title);
    fixture.context.closeTrackedPrototypeMorePopover();
    assert.deepEqual(fixture.calls, ['pointerdown', 'pointercancel'], 'closing while pressed must clear timers and previews');

    fixture = createFixture(surfaceSelector, { view: 'dayGridMonth' });
    assert.equal(fixture.cleanupDrag, null, 'month overflow popovers must keep their existing behavior');
}

assert.equal((source.match(/cleanupDrag: bindPrototypeMorePopoverDrag\(pop, anchorEl, activeCalendar\)/g) || []).length, 2,
    'both the main popover and standalone sidebar fallback must bind dragging');
for (const surface of ['surface', 'prototypeSurface']) {
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
        assert.ok(source.includes(`bindPrototypeSurfacePointerHandler(${surface}, '${type}'`), `${surface} must expose ${type}`);
    }
}
assert.match(source, /!sidePrototypeEventDrag\.fromMorePopover && \(event\.pointerType/, 'sidebar popup taps must not capture away their click target');
assert.match(source, /!prototypeEventDrag\.fromMorePopover && \(event\.pointerType/, 'main popup taps must not capture away their click target');
assert.match(source, /const distance = drag\.fromMorePopover\s*\? Math\.hypot/, 'sidebar popover drags must support horizontal movement');
assert.equal((source.match(/drag\.eventEl\.closest\('\.tm-proto-more-popover'\)\?\.classList\.add\('is-dragging'\)/g) || []).length, 2);
assert.match(styles, /\.tm-proto-more-popover\.is-dragging\s*\{\s*visibility: hidden;\s*pointer-events: none;/);
assert.match(styles, /\.tm-proto-more-popover--draggable \[data-tm-proto-event\]\s*\{\s*touch-action: none;/);

console.log('calendar all-day popover drag tests passed');
