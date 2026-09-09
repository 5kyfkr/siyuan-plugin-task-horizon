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
const predicted2027 = api.buildPredictedCnHolidayDays(2027);
const predictedByName = new Map(predicted2027.map((item) => [item.name, item.date]));
assert.equal(predictedByName.get('元旦'), '2027-01-01', 'future fixed-date holidays must be available before the official schedule update');
assert.equal(predictedByName.get('劳动节'), '2027-05-01', 'future Labor Day must be available before the official schedule update');
assert.equal(predictedByName.get('国庆节'), '2027-10-01', 'future National Day must be available before the official schedule update');
assert.ok(predictedByName.get('春节'), 'future Spring Festival must be derived from the lunar date');
assert.ok(predictedByName.get('端午节'), 'future Dragon Boat Festival must be derived from the lunar date');
assert.ok(predictedByName.get('中秋节'), 'future Mid-Autumn Festival must be derived from the lunar date');
assert.ok(predictedByName.get('清明节'), 'future Qingming Festival must be derived from the solar term');
assert.ok(predicted2027.every((item) => item.type === 2), 'future fallback must not predict makeup workdays');
const predictedEvents2027 = api.buildCnHolidayEvents(
    predicted2027,
    new Date(2027, 0, 1),
    new Date(2028, 0, 1),
    'dayGridMonth',
    { cnHolidayColor: '#ff3333' },
);
const predictedDayEvents2027 = api.buildCnHolidayEvents(
    predicted2027,
    new Date(2027, 1, 7),
    new Date(2027, 1, 8),
    'timeGridDay',
    { cnHolidayColor: '#ff3333' },
);
assert.ok(predictedEvents2027.some((event) => event.start === '2027-02-07' && event.title === '春节'), 'predicted Spring Festival must render as a holiday event');
assert.ok(predictedEvents2027.some((event) => event.start === '2027-05-01' && event.title === '劳动节'), 'predicted Labor Day must render as a holiday event');
assert.equal(predictedDayEvents2027.filter((event) => event.display === 'background').length, 0, 'predicted festivals must not render a confirmed rest background');
assert.equal(
    api.getCnHolidayDisplayInfo(predicted2027.find((item) => item.name === '春节'), '2027-02-07').status,
    '',
    'predicted festivals must not display a rest badge before official holiday data exists',
);
assert.equal(
    predictedEvents2027.find((event) => event.start === '2027-02-07').extendedProps.__tmCnHolidayPredicted,
    true,
    'predicted festival events must retain their prediction marker',
);
assert.equal(
    api.getCnHolidayDisplayInfo({ date: '2027-02-07', type: 2, name: '春节', predicted: true }, '2027-02-07').status,
    '',
    'future festival cache entries must not be interpreted as confirmed rest days',
);
assert.match(
    require('node:fs').readFileSync(require('node:path').resolve(__dirname, '..', 'calendar-view.js'), 'utf8'),
    /localCacheUsable = !futureYear \|\| Number\(obj\?\.cacheVersion\) === CN_HOLIDAY_CACHE_VERSION;[\s\S]*localCacheUsable && data\.length/,
    'persisted future holiday data must carry the current cache version before reuse',
);
assert.match(
    require('node:fs').readFileSync(require('node:path').resolve(__dirname, '..', 'calendar-view.js'), 'utf8'),
    /cachedVersionCurrent = cached\?\.cacheVersion === CN_HOLIDAY_CACHE_VERSION;[\s\S]*cachedUsable = !futureYear \|\| cachedVersionCurrent/,
    'in-memory future holiday data must carry the current cache version before reuse',
);
assert.match(
    require('node:fs').readFileSync(require('node:path').resolve(__dirname, '..', 'calendar-view.js'), 'utf8'),
    /String\(cached\.checkedDay \|\| ''\) === todayKey[\s\S]*localCheckedDay === todayKey/,
    'holiday data must be checked at most once per local calendar day',
);
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
assert.equal(merged[0].officialName, '官方春节', 'custom work overrides must preserve the official festival name');

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

const customWork = api.applyCalendarCustomHolidayOverrides([], {
    '2026-03-02': { type: 'work', name: '会议' },
});
const customWorkEvents = api.buildCnHolidayEvents(customWork, new Date(2026, 2, 2), new Date(2026, 2, 3), 'dayGridMonth', {
    cnHolidayColor: '#ff3333',
});
assert.equal(customWorkEvents.length, 0, 'named custom workdays must not create visible holiday cards');
assert.equal(api.getCnHolidayDisplayInfo(customWork[0], '2026-03-02').status, 'work');

const officialFestivalChangedToWork = api.applyCalendarCustomHolidayOverrides([
    { date: '2026-10-01', type: 2, name: '国庆节' },
], {
    '2026-10-01': { type: 'work', name: '国庆节调休' },
});
const festivalInfo = api.getCnHolidayDisplayInfo(officialFestivalChangedToWork[0], '2026-10-01');
assert.deepEqual(
    [festivalInfo.status, festivalInfo.label, festivalInfo.showEvent],
    ['work', '国庆节', true],
    'an official festival changed to work must keep its festival label and card',
);
assert.equal(api.getCnSolarTermName('2026-09-23'), '秋分');
assert.equal(api.getCnSolarTermName('2026-10-08'), '寒露');

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
