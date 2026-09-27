'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'calendar-view.js'), 'utf8');
function between(start, end) {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, start);
    return source.slice(from, to);
}

class Element {
    constructor(parent = null, eventId = '') {
        this.parent = parent;
        this.eventId = eventId;
        this.isConnected = true;
    }
    contains(node) { return node === this || !!node?.parent && this.contains(node.parent); }
    closest(selector) {
        if (selector === '[data-tm-proto-event]' && this.eventId) return this;
        return this.parent?.closest(selector) || null;
    }
}

const surface = new Element();
const mainCard = new Element(surface, 'same-schedule');
const sideSurface = new Element();
const sideCard = new Element(sideSurface, 'same-schedule');
const mainEvent = { id: 'same-schedule', title: 'Main cached schedule', extendedProps: { __tmSource: 'schedule' } };
const sideEvent = { ...mainEvent, title: 'Current side schedule' };
const calendar = { event: mainEvent };
const sideCalendar = { event: sideEvent };
const opened = [];
const showEvent = (event, anchor) => opened.push({ event, anchor });
const state = { calendar, mainCalendarSuspended: false, __tmShowPrototypeEventPopover: showEvent };
const context = vm.createContext({
    state, calendar, cal: sideCalendar, prototypeSurface: surface,
    Element, HTMLElement: Element, HTMLInputElement: class extends Element {},
    prototypeSuppressClickUntil: 0, prototypeSuppressClickEventId: '',
    getCalendarEventIdFromElement: (el) => el?.eventId || '',
    getCalendarEventById: (cal, id) => cal.event.id === id ? cal.event : null,
    getCalendarEvents: (cal) => [cal.event],
    getCalendarView: () => ({ type: 'timeGridWeek' }),
    openPrototypeListTaskDetail: () => false,
    isCompactDockLayout: () => false,
    showPrototypeEventPopover: showEvent,
    resolveCalendarEventInteractiveHit: (event) => ({ eventEl: event.target }),
});
vm.runInContext(between('            const onPrototypeEventDocumentClick = (event) => {',
    "            document.addEventListener('click', onPrototypeEventDocumentClick, true);")
    + '\nglobalThis.mainClick = onPrototypeEventDocumentClick;\n'
    + 'globalThis.sideClick = (' + between('            eventClick: (arg) => {',
        '            eventContextMenu: (arg) => handleCalendarEventContextMenu(arg),')
        .trim().replace(/^eventClick:\s*/, '').replace(/,$/, '') + ');', context);

function click(target, fromSide = false) {
    const event = {
        target, prevented: false, stopped: false,
        preventDefault() { this.prevented = true; },
        stopPropagation() { this.stopped = true; },
    };
    context.mainClick(event);
    if (fromSide && !event.stopped) context.sideClick({ event: sideEvent, el: target, jsEvent: event });
    return event;
}

click(mainCard);
assert.equal(opened.at(-1).event, mainEvent, 'the active main calendar opens its event');
for (let pass = 0; pass < 3; pass++) {
    state.mainCalendarSuspended = true;
    surface.isConnected = false;
    opened.length = 0;
    const event = click(sideCard, true);
    assert.equal(event.stopped, false, 'the parked main calendar must leave side clicks to the side calendar');
    assert.equal(opened.length, 1, 'a side click must open exactly one popover');
    assert.equal(opened[0].event, sideEvent, 'the popover must use the current side event, even with a shared ID');
    assert.equal(opened[0].anchor, sideCard);

    state.mainCalendarSuspended = false;
    surface.isConnected = true;
    opened.length = 0;
    click(mainCard);
    assert.equal(opened.length, 1, 'resuming must retain the main click listener');
    assert.equal(opened[0].event, mainEvent);
}

opened.length = 0;
assert.equal(click(sideCard, true).stopped, false, 'a live main calendar must not intercept another surface');
assert.equal(opened[0].event, sideEvent);

// Body-level +N popovers have their own event handlers. The main document
// delegate must leave their events alone so the owning calendar handles them.
const portalCard = new Element(null, 'same-schedule');
opened.length = 0;
assert.equal(click(portalCard).stopped, false);
assert.equal(opened.length, 0);

surface.isConnected = false;
assert.equal(click(mainCard).stopped, false, 'a detached host must not consume document clicks');
surface.isConnected = true;
state.calendar = sideCalendar;
assert.equal(click(mainCard).stopped, false, 'a stale mount must not consume document clicks');

console.log('calendar side popover view switch tests passed');
