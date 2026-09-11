'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'calendar-view.js'), 'utf8');
function readFunction(name) {
    const start = source.indexOf(`    function ${name}(`);
    assert.ok(start >= 0, `${name} must exist`);
    const end = source.indexOf('\n    }', start) + 6;
    return source.slice(start, end);
}

class FakeElement {
    constructor() {
        this.style = { setProperty() {} };
        this.innerHTML = '';
    }

    getBoundingClientRect() {
        return { left: 80, top: 80, bottom: 110, height: 180 };
    }

    querySelectorAll() { return []; }
    remove() {}
}

const settings = { showTaskReminders: true, showCompletedAllDaySchedules: false };
const dayKey = '2026-09-07';
const completedReminder = {
    id: `reminder:task:${dayKey}`,
    title: 'Completed reminder (22:00)',
    start: new Date(`${dayKey}T00:00:00`),
    end: new Date('2026-09-08T00:00:00'),
    allDay: true,
    editable: false,
    extendedProps: {
        __tmSource: 'reminder',
        __tmReminderBlockId: 'task',
        __tmReminderDate: dayKey,
        __tmReminderTimes: ['22:00'],
        __tmReminderDone: true,
    },
};
const calendar = { view: { type: 'timeGridDay' }, events: [completedReminder] };
const state = { calendar, sideDay: { calendar } };
const context = vm.createContext({
    Date, Element: FakeElement, state, calendar,
    window: { innerWidth: 1024, innerHeight: 768 },
    document: {
        createElement: () => new FakeElement(),
        body: { appendChild() {} },
        addEventListener() {},
        removeEventListener() {},
    },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    getSettings: () => settings,
    getCalendarView: (activeCalendar) => activeCalendar.view,
    getCalendarEvents: (activeCalendar) => activeCalendar.events,
    bindPrototypeMorePopoverDrag: () => null,
    esc: (value) => String(value),
    toMs: (value) => new Date(value).getTime(),
    parseDateOnly: (value) => new Date(`${String(value).slice(0, 10)}T00:00:00`),
    buildSharedPrototypeLunarText: () => '',
    getCalendarEventColor: () => '#9aa0a6',
    buildSharedPrototypeEventMarkup: (event) => event.title,
    isDetachedTaskOccurrenceEventExt: () => false,
    isDetachedScheduleOccurrenceEventExt: () => false,
    isRecurringScheduleEventExt: () => false,
    protoSafeDate: (value) => value ? new Date(value) : null,
    protoDayStart: (value) => { const date = new Date(value); date.setHours(0, 0, 0, 0); return date; },
    protoAddDays: (value, amount) => { const date = new Date(value); date.setDate(date.getDate() + amount); return date; },
    protoCompareMonthEvents: (left, right) => left.start - right.start,
    protoWeekLabels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    protoLunarText: () => '',
    protoEventColor: () => '#9aa0a6',
    protoEventMarkup: (event) => event.title,
});
vm.runInContext([
    'resolveSharedPrototypeEventStart', 'resolveSharedPrototypeEventEnd',
    'countSharedPrototypeAllDayEvents', 'resolveCalendarEventDoneState',
    'shouldHideCompletedAllDayCalendarEvent', 'closeTrackedPrototypeMorePopover',
    'showSharedPrototypeMorePopover',
].map(readFunction).join('\n'), context);
context.protoEventEnd = context.resolveSharedPrototypeEventEnd;
context.closePrototypeMorePopover = context.closeTrackedPrototypeMorePopover;
const mainStart = source.indexOf('        const showPrototypeMorePopover =');
const mainEnd = source.indexOf('\n        };', mainStart) + 11;
assert.ok(mainStart >= 0 && mainEnd > mainStart);
vm.runInContext(`${source.slice(mainStart, mainEnd)}\nglobalThis.openMainPopover = showPrototypeMorePopover;`, context);

for (const openPopover of [context.showSharedPrototypeMorePopover, context.openMainPopover]) {
    for (const viewType of ['timeGridDay', 'timeGridWeek', 'dayGridMonth']) {
        calendar.view.type = viewType;
        for (const showCompletedAllDaySchedules of [false, true]) {
            settings.showCompletedAllDaySchedules = showCompletedAllDaySchedules;
            calendar.events = [completedReminder];
            assert.equal(context.countSharedPrototypeAllDayEvents(calendar.events, dayKey), 1);
            openPopover(new FakeElement(), dayKey, calendar);
            const markup = state.__tmPrototypeMorePopover.el.innerHTML;
            assert.ok(markup.includes(completedReminder.id), `${viewType}: completed reminders counted in +1 must appear in the popover`);
            assert.ok(markup.includes(completedReminder.title), 'the reminder time label must be retained');
            assert.ok(!markup.includes('tm-proto-more-popover-empty'), 'a counted reminder must not render an empty state');
        }
    }
}

settings.showCompletedAllDaySchedules = false;
assert.equal(context.resolveCalendarEventDoneState(completedReminder.extendedProps), true, 'visibility must not change the reminder completion state');
assert.equal(completedReminder.editable, false, 'reminders must remain read-only for dragging');
for (const [sourceType, doneProps] of [
    ['schedule', { __tmScheduleOccurrenceDone: true }],
    ['taskdate', { __tmTaskDone: true }],
]) {
    const event = { ...completedReminder, extendedProps: { __tmSource: sourceType, ...doneProps } };
    assert.equal(context.shouldHideCompletedAllDayCalendarEvent(event, settings), true, 'completed schedules and task dates must still respect their visibility setting');
    assert.equal(context.shouldHideCompletedAllDayCalendarEvent({ ...event, allDay: false }, settings), false);
}
const nextDayReminder = { ...completedReminder, id: 'next-day', start: new Date('2026-09-08T00:00:00'), end: new Date('2026-09-09T00:00:00') };
calendar.events = [nextDayReminder];
for (const openPopover of [context.showSharedPrototypeMorePopover, context.openMainPopover]) {
    openPopover(new FakeElement(), dayKey, calendar);
    assert.ok(state.__tmPrototypeMorePopover.el.innerHTML.includes('tm-proto-more-popover-empty'), 'reminders must remain scoped to their occurrence date');
}

console.log('calendar completed reminder popover tests passed');
