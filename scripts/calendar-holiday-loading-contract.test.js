'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'calendar-view.js'), 'utf8');

function readFunction(name, context = {}) {
    const start = source.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `${name} must be defined`);
    const bodyStart = source.indexOf('{', start);
    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        if (source[index] === '}') depth -= 1;
        if (depth === 0) return vm.runInNewContext(`(${source.slice(start, index + 1)})`, context);
    }
    assert.fail(`${name} must have a complete function body`);
}

const parseDateOnly = (value) => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
};
const formatDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const toMs = (value) => {
    const date = value instanceof Date ? value : parseDateOnly(value);
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.getTime() : NaN;
};
const normalizeCnHolidayName = readFunction('normalizeCnHolidayName');
const canonicalCnFestivalName = readFunction('canonicalCnFestivalName', { normalizeCnHolidayName, Set });
const cnFestivalBonus = readFunction('cnFestivalBonus');
const buildCnHolidayEvents = readFunction('buildCnHolidayEvents', {
    canonicalCnFestivalName,
    cnFestivalBonus,
    formatDateKey,
    normalizeCnHolidayName,
    parseDateOnly,
    toMs,
    Map,
});

const days = [
    { date: '2026-09-20', type: 4, name: '中秋节前补班' },
    { date: '2026-09-25', type: 2, name: '中秋节' },
    { date: '2026-09-26', type: 2, name: '中秋节' },
    { date: '2026-09-27', type: 2, name: '中秋节' },
    { date: '2026-10-01', type: 2, name: '国庆节' },
];
const events = buildCnHolidayEvents(
    days,
    new Date(2026, 8, 1),
    new Date(2026, 9, 1),
    'listMonth',
    { cnHolidayColor: '#e5484d' },
);
const monthEvents = buildCnHolidayEvents(
    days,
    new Date(2026, 8, 1),
    new Date(2026, 9, 1),
    'dayGridMonth',
    { cnHolidayColor: '#e5484d' },
);

const expectedDates = ['2026-09-20', '2026-09-25', '2026-09-26', '2026-09-27'];
assert.deepEqual(
    Array.from(events, (event) => event.start),
    expectedDates,
    'list view must retain every in-range holiday and adjusted workday',
);
assert.deepEqual(
    Array.from(monthEvents, (event) => event.start),
    expectedDates,
    'month view must retain every in-range holiday and adjusted workday',
);
assert.deepEqual(
    Array.from(monthEvents, (event) => event.extendedProps.__tmCnHolidayType),
    [4, 2, 2, 2],
    'month holiday events must preserve rest/work types for rendering',
);
assert.deepEqual(
    Array.from(events, (event) => event.extendedProps.__tmCnHolidayType),
    [4, 2, 2, 2],
    'holiday events must preserve rest/work types for rendering',
);
assert.equal(new Set(events.map((event) => event.id)).size, events.length, 'holiday event ids must remain unique per date');

console.log('calendar holiday loading contract tests passed');
