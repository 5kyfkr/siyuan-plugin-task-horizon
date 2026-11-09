'use strict';

const assert = require('node:assert/strict');
const fs = require('./i18n-source-fixture');
const path = require('node:path');
const vm = require('./i18n-vm-fixture');

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
const getCnSolarTermName = readFunction('getCnSolarTermName', {
    Date,
    Map,
    formatDateKey,
    parseDateOnly,
    pad2: (value) => String(value).padStart(2, '0'),
    cnSolarTermCache: new Map(),
    CN_SOLAR_TERM_NAMES: [
        '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
        '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑',
        '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至',
    ],
    CN_SOLAR_TERM_MINUTES: [
        0, 21208, 42467, 63836, 85337, 107014, 128867, 150921,
        173149, 195551, 218072, 240693, 263343, 285989, 308563, 331033,
        353350, 375494, 397447, 419210, 441758, 463504, 485718, 504758,
    ],
});
const getCnHolidayDisplayInfo = readFunction('getCnHolidayDisplayInfo', {
    canonicalCnFestivalName,
    cnFestivalBonus,
    formatCnLunarDateKey: () => '',
    getCnSolarTermName,
});
const buildCnHolidayEvents = readFunction('buildCnHolidayEvents', {
    canonicalCnFestivalName,
    cnFestivalBonus,
    getCnHolidayDisplayInfo,
    formatDateKey,
    normalizeCnHolidayName,
    parseDateOnly,
    toMs,
    Map,
});
const parseHolidayCnYearPayload = readFunction('parseHolidayCnYearPayload', {
    __tmT: (key) => key === 'calendar.adjustedWorkingDay' ? '调休工作日' : '公共假日',
});

const parsedHolidayCn2027 = parseHolidayCnYearPayload({
    year: 2027,
    days: [
        { name: '春节', date: '2027-02-06', isOffDay: true },
        { name: '春节', date: '2027-01-31', isOffDay: false },
        { name: '无效日期', date: '2027-02-30', isOffDay: true },
        { name: '其他年度', date: '2028-01-01', isOffDay: true },
        { name: '无效类型', date: '2027-03-01', isOffDay: 'yes' },
    ],
}, 2027);
assert.deepEqual(
    JSON.parse(JSON.stringify(parsedHolidayCn2027)),
    [
        { date: '2027-02-06', type: 2, name: '春节', lunar: '', extra_info: '' },
        { date: '2027-01-31', type: 4, name: '春节', lunar: '', extra_info: '' },
    ],
    'holiday-cn payloads must map official rest days and makeup workdays',
);
assert.match(
    source,
    /cdn\.jsdelivr\.net\/gh\/NateScarlet\/holiday-cn@master[\s\S]*raw\.githubusercontent\.com\/NateScarlet\/holiday-cn\/master[\s\S]*tryFetchTimor\('https:\/\/timor\.cn'\)[\s\S]*tryFetchTimor\('https:\/\/timor\.tech'\)/,
    'holiday-cn must be the primary official-data source before the legacy timor hosts',
);

const days = [
    { date: '2026-09-20', type: 4, name: '中秋节前补班' },
    { date: '2026-09-25', type: 2, name: '中秋节', lunar: '八月十五' },
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

const expectedDates = ['2026-09-25'];
assert.deepEqual(
    Array.from(events, (event) => event.start),
    expectedDates,
    'list view must retain only the actual festival card',
);
assert.deepEqual(
    Array.from(monthEvents, (event) => event.start),
    expectedDates,
    'month view must retain only the actual festival card',
);
assert.deepEqual(
    Array.from(monthEvents, (event) => event.extendedProps.__tmCnHolidayType),
    [2],
    'month holiday events must preserve the actual festival type',
);
assert.deepEqual(
    Array.from(events, (event) => event.extendedProps.__tmCnHolidayType),
    [2],
    'holiday events must preserve the actual festival type',
);
assert.equal(new Set(events.map((event) => event.id)).size, events.length, 'holiday event ids must remain unique per date');

console.log('calendar holiday loading contract tests passed');
