'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', 'task-runtime', '50-task-model-and-repeat-utils.js'),
    'utf8',
);
const start = source.indexOf('function __tmParseTaskRepeatJson');
const end = source.indexOf('function __tmGetTaskRepeatWeekdayLabel', start);
assert.ok(start >= 0 && end > start, 'repeat helper slice must remain extractable');

const normalizeDateOnly = (value) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const pad = (n) => String(n).padStart(2, '0');
        return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
    }
    const match = String(value || '').match(/^\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : '';
};

const context = vm.createContext({
    Date,
    Intl,
    Math,
    Number,
    String,
    JSON,
    Set,
    Map,
    Array,
    Object,
    globalThis: null,
    __tmNormalizeDateOnly: normalizeDateOnly,
});
context.globalThis = context;
vm.runInContext(`${source.slice(start, end)}\nthis.core = globalThis.tmRepeatCore;`, context);
const core = context.core;
assert.equal(core?.version, 1, 'repeat core version must be stable');
for (const key of ['normalizeRule', 'nextDateKey', 'nextWeekly', 'monthlyDate', 'monthlyWeekday', 'yearlyDate', 'iterate', 'isWorkday', 'lunarInfo']) {
    assert.equal(typeof core?.[key], 'function', `repeat core must expose ${key}`);
}

function dates(rule, fromDateKey, toDateKey) {
    return Array.from(core.iterate(rule, { fromDateKey, toDateKey, limit: 2400 }), (item) => String(item.dateKey));
}

assert.deepEqual(
    dates({ enabled: true, type: 'daily', every: 2, anchorDate: '2026-08-29' }, '2026-08-29', '2026-09-05'),
    ['2026-08-29', '2026-08-31', '2026-09-02', '2026-09-04'],
    'daily every-N sequence must remain stable',
);
assert.deepEqual(
    dates({ enabled: true, type: 'workday', every: 1, anchorDate: '2026-08-28' }, '2026-08-28', '2026-09-03'),
    ['2026-08-28', '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03'],
    'workday sequence must skip weekends',
);
assert.deepEqual(
    dates({ enabled: true, type: 'weekly', every: 1, weekdays: [1, 3, 5], anchorDate: '2026-08-24' }, '2026-08-24', '2026-08-31'),
    ['2026-08-24', '2026-08-26', '2026-08-28', '2026-08-31'],
    'weekly multi-weekday sequence must use Monday-based buckets',
);
assert.deepEqual(
    dates({ enabled: true, type: 'monthly', every: 1, monthlyMode: 'date', anchorDate: '2026-01-31' }, '2026-01-31', '2026-04-30'),
    ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'],
    'monthly date sequence must clamp month ends',
);
assert.deepEqual(
    dates({ enabled: true, type: 'monthly', every: 1, monthlyMode: 'weekday', anchorDate: '2026-08-31' }, '2026-08-31', '2027-04-01'),
    ['2026-08-31', '2026-11-30', '2027-03-29'],
    'missing monthly weekday occurrences must be skipped while making progress',
);
assert.deepEqual(
    dates({ enabled: true, type: 'daily', every: 1, maxOccurrences: 3, anchorDate: '2026-08-29' }, '2026-08-29', '2026-12-31'),
    ['2026-08-29', '2026-08-30', '2026-08-31'],
    'count-based ending must stop at the configured ordinal',
);
assert.deepEqual(
    dates({ enabled: true, type: 'daily', every: 1, until: '2026-08-31', anchorDate: '2026-08-29' }, '2026-08-29', '2026-12-31'),
    ['2026-08-29', '2026-08-30', '2026-08-31'],
    'date-based ending must include the end date',
);
assert.deepEqual(
    dates({ enabled: true, type: 'daily', every: 1, until: '2026-08-28', anchorDate: '2026-08-29' }, '2026-08-29', '2026-12-31'),
    [],
    'an invalid legacy end date before the anchor must not emit occurrences',
);

const lunar = dates({ enabled: true, type: 'yearly', every: 1, calendarMode: 'lunar', anchorDate: '2025-01-29' }, '2025-01-29', '2028-12-31');
assert.deepEqual(lunar, ['2025-01-29', '2026-02-17', '2027-02-07', '2028-01-26'], 'lunar yearly baseline must remain stable');

console.log('repeat parity tests passed');
