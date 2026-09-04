'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

global.window = global;
global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
global.Element = class Element {};
global.HTMLElement = class HTMLElement extends global.Element {};
global.HTMLButtonElement = class HTMLButtonElement extends global.HTMLElement {};
global.AbortController = class AbortController {
    constructor() { this.signal = {}; }
    abort() {}
};

require(path.resolve(__dirname, '..', 'calendar-view.js'));

const api = global.__tmCalendar;
const normalized = api.normalizeCalendarCustomHolidayOverrides({
    '2026-02-17': { type: 'rest', name: ' 春节 ' },
    '2026-02-28': { type: 'WORK', name: '' },
    '2026-02-30': { type: 'rest', name: '非法日期' },
    invalid: { type: 'rest' },
    '2026-03-01': { type: 'normal' },
});
assert.deepEqual(normalized, {
    '2026-02-17': { type: 'rest', name: '春节' },
    '2026-02-28': { type: 'work' },
});

const merged = api.applyCalendarCustomHolidayOverrides([
    { date: '2026-02-17', type: 2, name: '官方春节' },
    { date: '2026-02-18', type: 2, name: '官方春节' },
], {
    '2026-02-17': { type: 'work', name: '春节调休' },
    '2026-03-01': { type: 'rest', name: '家庭日' },
});
assert.deepEqual(merged.map((item) => [item.date, item.type, item.name, item.custom === true]), [
    ['2026-02-17', 4, '春节调休', true],
    ['2026-02-18', 2, '官方春节', false],
    ['2026-03-01', 2, '家庭日', true],
]);

const restored = api.applyCalendarCustomHolidayOverrides([
    { date: '2026-02-17', type: 2, name: '官方春节' },
], {});
assert.deepEqual(restored.map((item) => [item.date, item.type, item.name]), [
    ['2026-02-17', 2, '官方春节'],
]);

const mergedCustom = api.applyCalendarCustomHolidayOverrides([], {
    '2026-03-01': { type: 'rest', name: '家庭日' },
});
const events = api.buildCnHolidayEvents(mergedCustom, new Date(2026, 2, 1), new Date(2026, 2, 2), 'dayGridMonth', {
    cnHolidayColor: '#ff3333',
});
assert.equal(events.length, 1);
assert.equal(events[0].title, '家庭日');
assert.equal(events[0].extendedProps.__tmSource, 'cnHoliday');

const subscriptionEvents = api.buildCustomHolidaySubscriptionEvents({
    '2026-02-28': { type: 'work' },
    '2026-03-01': { type: 'rest', name: '家庭日' },
    '2026-03-02': { type: 'rest', name: '范围外' },
}, {
    start: new Date(2026, 1, 28),
    end: new Date(2026, 2, 2),
});
assert.deepEqual(subscriptionEvents, [
    {
        uidSeed: 'custom-holiday:2026-02-28',
        source: 'holiday',
        title: '个人调休工作日',
        allDay: true,
        startDate: '2026-02-28',
        endDate: '2026-03-01',
    },
    {
        uidSeed: 'custom-holiday:2026-03-01',
        source: 'holiday',
        title: '家庭日',
        allDay: true,
        startDate: '2026-03-01',
        endDate: '2026-03-02',
    },
]);
assert.ok(subscriptionEvents.every((event) => !Object.prototype.hasOwnProperty.call(event, 'alarm')));

console.log('calendar custom holiday tests passed');
