'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('./i18n-vm-fixture');

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
assert.deepEqual(lunar, ['2025-01-29', '2026-02-17', '2027-02-06', '2028-01-26'], 'lunar yearly dates must use the authoritative table instead of stale ICU data');
assert.deepEqual(
    { ...core.lunarInfo('2027-02-06') },
    { relatedYear: 2027, month: 1, day: 1, isLeap: false },
    '2027 lunar New Year must be February 6',
);

// Public festival dates, including ones after a leap month (2023 闰二月, 2025 闰六月, 2028 闰五月).
const lunarDay = (key) => { const info = core.lunarInfo(key); return `${info.relatedYear}-${info.isLeap ? 'L' : ''}${info.month}-${info.day}`; };
const festivals = [
    ['2024-01-18', '2023-12-8'], ['2023-03-22', '2023-L2-1'], ['2025-05-31', '2025-5-5'], ['2025-10-06', '2025-8-15'],
    ['2025-10-29', '2025-9-9'], ['2026-06-19', '2026-5-5'], ['2026-09-25', '2026-8-15'], ['2028-05-28', '2028-5-5'],
    ['2028-08-26', '2028-7-7'], ['2028-10-03', '2028-8-15'], ['2029-02-12', '2028-12-29'], ['2029-02-13', '2029-1-1'],
];
for (const [key, expected] of festivals) assert.equal(lunarDay(key), expected, `lunar date of ${key}`);

function chain(rule, from, steps) {
    const out = [from];
    for (let i = 0; i < steps; i += 1) out.push(core.nextDateKey(out[out.length - 1], rule));
    return out;
}
assert.deepEqual(
    chain({ enabled: true, type: 'yearly', every: 1, calendarMode: 'lunar', anchorDate: '2024-02-09' }, '2024-02-09', 3),
    ['2024-02-09', '2025-01-28', '2026-02-16', '2027-02-05'],
    'a yearly rule on lunar 12-30 uses the last day of a 29-day month instead of skipping the year',
);
assert.deepEqual(
    chain({ enabled: true, type: 'yearly', every: 1, calendarMode: 'lunar', anchorDate: '2025-07-25' }, '2025-07-25', 2),
    ['2025-07-25', '2026-07-14', '2027-07-04'],
    'a yearly rule anchored in a leap month uses the regular month in other years',
);
assert.deepEqual(
    chain({ enabled: true, type: 'monthly', every: 1, calendarMode: 'lunar', anchorDate: '2026-01-18' }, '2026-01-18', 3),
    ['2026-01-18', '2026-02-16', '2026-03-18', '2026-04-16'],
    'a monthly rule on lunar day 30 uses the last day of a 29-day month',
);

const tomatoPath = path.resolve(root, '../siyuan-plugin-docktomato/tomato.js');
if (fs.existsSync(tomatoPath)) {
    const table = (text, name) => {
        const at = text.indexOf(`const ${name} = Object.freeze([`);
        return text.slice(text.indexOf('[', at), text.indexOf(']);', at)).replace(/\s+/g, '');
    };
    assert.equal(table(fs.readFileSync(tomatoPath, 'utf8'), '__REMINDER_LUNAR_INFO_1900_2049'), table(source, '__TM_LUNAR_INFO_1900_2049'),
        'Dock Tomato must carry the same lunar table');
}

// The conversion counts calendar days, so it must not depend on the local UTC offset or DST.
// Kept last: the time zone override applies to the rest of the process.
for (const zone of ['Asia/Hong_Kong', 'Asia/Singapore', 'America/New_York', 'Europe/London']) {
    process.env.TZ = zone;
    for (const [key, expected] of festivals) assert.equal(lunarDay(key), expected, `lunar date of ${key} in ${zone}`);
}

console.log('repeat parity tests passed');
