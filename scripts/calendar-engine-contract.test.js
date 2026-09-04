const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = {
    console,
    Date,
    Math,
    Map,
    Set,
    Promise,
    Intl,
    AbortController,
    setTimeout,
    clearTimeout,
};
context.globalThis = context;
vm.createContext(context);

[
    'calendar-date.js',
    'calendar-store.js',
    'calendar-layout.js',
    'calendar-renderer.js',
    'calendar-interaction.js',
    'calendar-engine.js',
].forEach((file) => {
    const source = fs.readFileSync(path.join(root, 'src', 'calendar', file), 'utf8');
    vm.runInContext(source, context, { filename: file });
});

const date = new Date(2026, 7, 24, 10, 0, 0, 0);
const dateMath = context.__tmCalendarDate;
const monthEnd = dateMath.toDate('2026-08-31');
assert.equal(monthEnd.getFullYear(), 2026, 'date-only keys must preserve the local year');
assert.equal(monthEnd.getMonth(), 7, 'date-only keys must preserve the local month');
assert.equal(monthEnd.getDate(), 31, 'date-only keys must preserve the local day');
assert.equal(dateMath.formatDateKey(dateMath.addDays(monthEnd, 1)), '2026-09-01', 'adding one day at month end must enter the next month');
assert.equal(dateMath.formatDateKey(dateMath.addDays(dateMath.toDate('2026-09-01'), -1)), '2026-08-31', 'subtracting one day at month start must return to the prior month');
const monthRange = context.__tmCalendarDate.getVisibleRange('dayGridMonth', date, { firstDay: 1 });
assert.ok(monthRange.days >= 28 && monthRange.days <= 42, 'month range must cover complete calendar weeks');

const layout = context.__tmCalendarLayout.layoutAllDay([
    { id: 'span', title: 'span', allDay: true, start: new Date(2026, 7, 24), end: new Date(2026, 7, 27) },
], { start: new Date(2026, 7, 24), end: new Date(2026, 7, 31), days: 7 });
assert.equal(layout.segments.length, 1, 'one logical cross-day event must produce one layout segment');
assert.equal(layout.segments[0].span, 3, 'cross-day event must span its date columns');

const dateOnlyLayout = context.__tmCalendarLayout.layoutAllDay([
    { id: 'date-only', title: 'date-only', allDay: true, start: '2026-08-24', end: '2026-08-25' },
], { start: new Date(2026, 7, 23), end: new Date(2026, 7, 30), days: 7 });
assert.equal(dateOnlyLayout.segments.length, 1, 'one date-only event must produce one layout segment');
assert.equal(dateOnlyLayout.segments[0].startCol, 1, 'date-only events must start in their local calendar-day column');
assert.equal(dateOnlyLayout.segments[0].span, 1, 'an exclusive next-day date-only end must span one day');

let clicked = 0;
let dropped = 0;
const engine = context.__tmCalendarEngine.createCalendarEngine(null, {
    initialView: 'timeGridWeek',
    initialDate: date,
    eventSources: [{
        id: 'contract',
        events: () => [{
            id: 'event-1',
            title: 'Event',
            start: date,
            end: new Date(date.getTime() + 60 * 60 * 1000),
            extendedProps: { __tmSource: 'schedule' },
        }],
    }],
    eventClick: () => { clicked += 1; },
    eventDrop: () => { dropped += 1; },
});
engine.render();

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function verifySourceRefreshIsolation() {
    let holidayRequests = 0;
    let scheduleRequests = 0;
    let failHoliday = false;
    const sourceEngine = context.__tmCalendarEngine.createCalendarEngine(null, {
        initialView: 'dayGridMonth',
        initialDate: date,
        eventSources: [{
            id: 'holiday',
            events: () => {
                holidayRequests += 1;
                if (failHoliday) throw new Error('temporary holiday failure');
                return [{
                    id: 'holiday-1',
                    title: 'Holiday',
                    start: new Date(2026, 7, 25),
                    end: new Date(2026, 7, 26),
                    allDay: true,
                    extendedProps: { __tmSource: 'cnHoliday' },
                }];
            },
        }, {
            id: 'schedule',
            events: () => {
                scheduleRequests += 1;
                return [{
                    id: 'schedule-1',
                    title: 'Schedule',
                    start: date,
                    end: new Date(date.getTime() + 60 * 60 * 1000),
                    extendedProps: { __tmSource: 'schedule' },
                }];
            },
        }],
    });
    sourceEngine.render();
    await wait(20);
    assert.equal(sourceEngine.getEventSourceById('missing'), null, 'unknown event sources must not expose a refetch handle');
    assert.deepEqual(
        Array.from(sourceEngine.getEvents(), (event) => event.id).sort(),
        ['holiday-1', 'schedule-1'],
        'initial range load must merge every source',
    );

    const scheduleRequestsBeforeRefetch = scheduleRequests;
    assert.equal(sourceEngine.getEventSourceById('holiday').refetch(), true);
    await wait(20);
    assert.equal(holidayRequests, 2, 'holiday source refetch must reload the requested source');
    assert.equal(scheduleRequests, scheduleRequestsBeforeRefetch, 'holiday source refetch must not reload schedule data');

    failHoliday = true;
    assert.equal(sourceEngine.getEventSourceById('holiday').refetch(), true);
    await wait(20);
    assert.ok(sourceEngine.getEventById('holiday-1'), 'a failed holiday refresh must retain the last successful snapshot');
    assert.ok(sourceEngine.getEventById('schedule-1'), 'a failed holiday refresh must not disturb other sources');
    sourceEngine.destroy();
}

function verifyMonthViewRangeSemantics() {
    const monthEngine = context.__tmCalendarEngine.createCalendarEngine(null, {
        initialView: 'dayGridMonth',
        initialDate: new Date(2026, 7, 31),
        firstDay: 1,
    });
    monthEngine.render();
    assert.equal(monthEngine.view.currentStart.getTime(), new Date(2026, 7, 1).getTime(), 'month currentStart must be the logical month start');
    assert.equal(monthEngine.view.activeStart.getTime(), new Date(2026, 6, 27).getTime(), 'month activeStart must retain the leading spillover week');
    assert.equal(monthEngine.view.title, '2026年8月', 'month title must follow the selected month, not the grid start');
    monthEngine.destroy();
}

async function verifyNewerSourceResultWins() {
    let holidayRequest = 0;
    const raceEngine = context.__tmCalendarEngine.createCalendarEngine(null, {
        initialView: 'dayGridMonth',
        initialDate: date,
        eventSources: [{
            id: 'holiday',
            events: () => new Promise((resolve) => {
                holidayRequest += 1;
                const current = holidayRequest;
                setTimeout(() => resolve(current === 1 ? [] : [{
                    id: 'holiday-race',
                    title: 'Holiday',
                    start: new Date(2026, 7, 25),
                    end: new Date(2026, 7, 26),
                    allDay: true,
                }]), current === 1 ? 30 : 5);
            }),
        }, {
            id: 'schedule',
            events: () => new Promise((resolve) => setTimeout(() => resolve([{
                id: 'schedule-race',
                title: 'Schedule',
                start: date,
                end: new Date(date.getTime() + 60 * 60 * 1000),
            }]), 40)),
        }],
    });
    raceEngine.render();
    await wait(2);
    raceEngine.getEventSourceById('holiday').refetch();
    await wait(70);
    assert.ok(raceEngine.getEventById('holiday-race'), 'an older range response must not overwrite a newer holiday result');
    assert.ok(raceEngine.getEventById('schedule-race'), 'source-only refresh must not cancel the remaining range sources');
    raceEngine.destroy();
}

setTimeout(async () => {
    assert.equal(engine.getEvents().length, 1, 'engine must load source events');
    assert.equal(engine.getEventById('event-1').extendedProps.__tmSource, 'schedule');
    engine.changeView('timeGridWeek', date);
    assert.equal(engine.view.type, 'timeGridWeek', 'engine must accept a direct switch to week view');
    engine.changeView('timeGridDay', date);
    assert.equal(engine.view.type, 'timeGridDay', 'engine must switch directly from week view to day view');
    engine.changeView('timeGridWorkdays', date);
    assert.equal(engine.view.type, 'timeGridWorkdays');
    engine.next();
    assert.equal(engine.view.currentStart.getTime(), new Date(2026, 7, 31).getTime(), 'workday next must advance by one calendar week');
    engine.prev();
    assert.equal(engine.view.currentStart.getTime(), new Date(2026, 7, 24).getTime(), 'workday prev must return by one calendar week');
    engine.changeView('timeGridDay', date);
    assert.equal(engine.view.type, 'timeGridDay');
    engine.getEventById('event-1').setExtendedProp('__tmTest', true);
    assert.equal(engine.getEventById('event-1').extendedProps.__tmTest, true);
    assert.equal(engine.dispatchEventClick('event-1'), true);
    assert.equal(clicked, 1, 'event click must dispatch through engine');
    assert.equal(engine.dispatchEventDrop('event-1', new Date(date.getTime() + 86400000), new Date(date.getTime() + 25 * 60 * 60000)), true);
    assert.equal(dropped, 1, 'event drop must dispatch through engine');
    engine.destroy();
    verifyMonthViewRangeSemantics();
    await verifySourceRefreshIsolation();
    await verifyNewerSourceResultWins();
    console.log('calendar engine contract ok');
}, 20);
