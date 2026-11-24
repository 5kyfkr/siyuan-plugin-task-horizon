'use strict';

const assert = require('node:assert/strict');
const fs = require('./i18n-source-fixture');
const path = require('node:path');
const vm = require('./i18n-vm-fixture');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'calendar-view.js'), 'utf8');
const rawSource = require('node:fs').readFileSync(path.resolve(__dirname, '..', 'calendar-view.js'), 'utf8');
const storeSource = fs.readFileSync(path.resolve(__dirname, '..', 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const migrationSource = fs.readFileSync(path.resolve(__dirname, '..', 'src/task-horizon/main/settings/64-export-runtime.js'), 'utf8');
const syncReloadSource = fs.readFileSync(path.resolve(__dirname, '..', 'src/task-horizon/main/render/39-render-doc-group-sync-and-refresh.js'), 'utf8');

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
assert.match(rawSource, /data-tm-cal-setting="calendarHolidayFetchMode"[\s\S]*data-tm-cal-setting-action="refreshOfficialHolidays"/,
    'calendar settings must expose the synchronized mode and explicit update action');
assert.match(storeSource, /calendarHolidayFetchMode: 'auto'/);
assert.match(storeSource, /if \(typeof cloudData\.calendarHolidayFetchMode === 'string'\)/,
    'the holiday fetching mode must load from synchronized settings');
assert.doesNotMatch(storeSource, /tm_calendar_holiday_fetch_mode/,
    'the holiday fetching mode must not introduce a separate localStorage setting');
assert.match(migrationSource, /'calendarHolidayFetchMode'/,
    'calendar settings export/import must include the fetch mode');
assert.match(syncReloadSource, /reloadHolidayCache/,
    'synchronized petal cache updates must invalidate the in-memory holiday cache');

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

async function testSyncedHolidayCache() {
    const year = new Date().getFullYear();
    const cachePath = '/data/storage/petal/siyuan-plugin-task-horizon/calendar-holidays.json';
    const record = (y, name) => ({ ts: 1, checkedDay: '2020-01-01', cacheVersion: 3, data: [{ date: `${y}-01-01`, name, type: 2 }] });
    const legacyCurrent = record(year, 'Legacy');
    legacyCurrent.data.push({ date: `${year}-01-02`, name: 'Prediction', type: 2, predicted: true });
    const legacy = new Map([
        [`tm_cn_holiday_${year}`, JSON.stringify(legacyCurrent)],
        [`tm_cn_holiday_${year + 1}`, JSON.stringify({ ...record(year + 1, 'Prediction'), predicted: true })],
        [`tm_cn_holiday_${year + 2}`, JSON.stringify({ ...record(year + 2, 'Outdated'), cacheVersion: 1 })],
    ]);
    let file = { version: 1, years: {} };
    let writes = 0;
    let requests = 0;
    let refreshes = 0;
    let now = Date.now();
    class TestDate extends Date { static now() { return ++now; } }
    let networkFails = false;
    let writeFails = false;
    const messages = [];
    const state = {
        settingsStore: { data: { calendarHolidayFetchMode: 'manual' } },
        cnHolidayCache: new Map(), cnHolidayInflight: new Map(), cnHolidayMissUntil: new Map(), sideDay: {},
    };
    const navigator = { onLine: true };
    const context = vm.createContext({
        Date: TestDate, AbortController, setTimeout, clearTimeout, formatDateKey, state, navigator,
        localStorage: { getItem: (key) => legacy.get(key) ?? null },
        getFileText: async (path) => { assert.equal(path, cachePath); return JSON.stringify(file); },
        putFileText: async (path, text) => {
            assert.equal(path, cachePath);
            if (writeFails) throw new Error('write failed');
            file = JSON.parse(text);
            writes += 1;
        },
        refetchAllCalendars: () => { refreshes += 1; },
        toast: (_, type) => messages.push(type),
        mergeCnHolidayFestivalFallback: (days) => days,
        fetch: async (url) => {
            requests += 1;
            if (networkFails) throw new Error('network unavailable');
            const y = Number(url.match(/\/(\d{4})\.json$/)[1]);
            return { ok: true, json: async () => ({ days: [{ date: `${y}-01-01`, name: `Fetched ${y}`, isOffDay: true }] }) };
        },
    });
    const slice = (from, to) => rawSource.slice(rawSource.indexOf(from), rawSource.indexOf(to, rawSource.indexOf(from)));
    const api = vm.runInContext(`
        ${slice('    const CN_HOLIDAY_CACHE_VERSION', '    // View changes')}
        ${slice('    function parseHolidayCnYearPayload', '    function getCnHolidayYearsForRange')}
        ${slice('    async function exportMigrationData', '    globalThis.__tmCalendar =')}
        ({ loadCnHolidayYear, refreshOfficialHolidayData, reloadCnHolidayCache, peekCnHolidayYear, exportMigrationData, importMigrationData });
    `, context);

    assert.equal((await api.loadCnHolidayYear(year))[0].name, 'Legacy');
    assert.equal(file.years[year].data[0].name, 'Legacy', 'legacy data must be migrated to the shared file');
    assert.equal(file.years[year].data.length, 1, 'mixed legacy records must not migrate predicted days');
    assert.equal((await api.loadCnHolidayYear(year + 1)).length, 0, 'predictions are not official data');
    assert.equal((await api.loadCnHolidayYear(year + 2)).length, 0, 'outdated future-year data must not be reused');
    assert.equal(api.peekCnHolidayYear(year + 2).length, 0, 'the in-memory snapshot must not promote outdated future data');
    assert.equal(writes, 1, 'unusable legacy records must not be copied');
    assert.equal(legacy.get(`tm_cn_holiday_${year}`), JSON.stringify(legacyCurrent), 'migration must keep legacy values untouched');

    file.years[year] = record(year, 'Synced');
    await api.reloadCnHolidayCache();
    navigator.onLine = false;
    assert.equal((await api.loadCnHolidayYear(year))[0].name, 'Synced', 'offline device must use the synced record');
    assert.equal(refreshes, 1, 'sync must refresh calendar views after invalidating the cache');
    state.settingsStore.data.calendarHolidayFetchMode = 'auto';
    await api.loadCnHolidayYear(year);
    assert.equal(requests, 0, 'offline auto mode must skip external requests');

    navigator.onLine = true;
    assert.equal(api.peekCnHolidayYear(year)?.[0].name, 'Synced', 'the calendar must reuse a synced year regardless of its check date');
    assert.equal((await api.loadCnHolidayYear(year))[0].name, 'Synced');
    assert.equal(requests, 0, 'automatic loads must not refetch an existing year on another day');
    assert.equal((await api.loadCnHolidayYear(year + 1))[0].name, 'Fetched ' + (year + 1), 'a prediction is not a saved official year');
    await api.loadCnHolidayYear(year + 1);
    assert.equal(requests, 1, 'automatic mode fetches only the missing year and reuses it');
    state.settingsStore.data.calendarHolidayFetchMode = 'manual';
    const exportOptions = { includeSchedule: false, holidayYears: [year], refreshCurrentYear: true };
    assert.equal((await api.exportMigrationData(exportOptions)).cnHolidays[year].data[0].name, 'Synced');
    assert.equal(requests, 1, 'export must not bypass manual mode');
    assert.equal(await api.refreshOfficialHolidayData({ textContent: 'Update' }), true);
    assert.equal(messages.at(-1), 'success');
    assert.equal(requests, 3, 'explicit update refetches both saved years');
    assert.deepEqual(Object.keys(file.years).map(Number), [year, year + 1], 'concurrent annual writes must merge into one file');
    state.settingsStore.data.calendarHolidayFetchMode = 'auto';
    await api.loadCnHolidayYear(year);
    await api.loadCnHolidayYear(year + 1);
    assert.equal(requests, 3, 'both saved years must be reused');

    writeFails = true;
    assert.equal(await api.refreshOfficialHolidayData({ textContent: 'Update' }), false);
    assert.equal(messages.at(-1), 'error', 'failed saves must not claim that synced data was updated');
    assert.equal((await api.loadCnHolidayYear(year))[0].name, `Fetched ${year}`, 'a failed save must keep the last synchronized data');
    writeFails = false;
    const requestsAfterFailure = requests;
    navigator.onLine = false;
    assert.equal(await api.refreshOfficialHolidayData({ textContent: 'Update' }), false);
    assert.equal(requests, requestsAfterFailure, 'explicit update must not contact external sources when offline');
    navigator.onLine = true;
    assert.equal(await api.refreshOfficialHolidayData({ textContent: 'Update' }), true);
    assert.equal(requests, requestsAfterFailure + 2, 'explicit update bypasses saved data and automatic retry delays for both years');
    networkFails = true;
    state.settingsStore.data.calendarHolidayFetchMode = 'auto';
    const before = { writes, requests };
    await Promise.all([api.loadCnHolidayYear(year - 1), api.loadCnHolidayYear(year - 1)]);
    await api.loadCnHolidayYear(year - 1);
    assert.equal(requests - before.requests, 4, 'auto failure backoff must also cover reminder-style async loads');
    assert.equal(writes, before.writes, 'failure and fallback must not write to shared storage');

    const imported = await api.importMigrationData({ cnHolidays: { [year - 1]: record(year - 1, 'Imported') } });
    assert.equal(imported.holidayYears, 1);
    assert.equal(file.years[year - 1].data[0].name, 'Imported');
    assert.equal(file.years[year].data[0].name, `Fetched ${year}`);
}

testSyncedHolidayCache().then(() => console.log('calendar holiday loading contract tests passed'), (error) => {
    console.error(error);
    process.exitCode = 1;
});
