'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('./i18n-vm-fixture');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const calendar = read('calendar-view.js');
const model = read('src/task-horizon/main/task-runtime/50-task-model-and-repeat-utils.js');
function extract(name) {
    const start = calendar.search(new RegExp(`    (?:async )?function ${name}\\(`));
    const end = calendar.indexOf('\n    }', start);
    assert.ok(start >= 0 && end > start, name);
    return calendar.slice(start, end + 6);
}
const key = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
let schedules = [];
let titleReads = [];
const moves = [];
const context = vm.createContext({
    Date, console, Map, Set, Intl,
    state: { scheduleCache: { lastLoadError: false }, rootEl: { isConnected: false } },
    __tmNormalizeDateOnly: (value) => value instanceof Date ? key(value) : String(value || '').slice(0, 10),
    toMs: (value) => value instanceof Date ? value.getTime() : Date.parse(value),
    formatDateKey: key,
    pad2: (value) => String(value).padStart(2, '0'),
    overlap: (start, end, from, to) => end > from && start < to,
    isAllDayRange: (start, end) => start.getHours() === 0 && start.getMinutes() === 0 && end.getHours() === 0 && end.getMinutes() === 0,
    loadScheduleAll: async () => schedules,
    __tmBuildScheduleLinkedMetadataMaps: async (items) => {
        titleReads = items;
        return { titleMap: new Map([['linked-task', '跟随标题发布会']]) };
    },
    getScheduleLinkedTaskId: (item) => item.taskId || '',
    getScheduleLinkedBlockId: (item) => item.blockId || '',
    normalizeCalendarScheduleTitleText: (value, fallback) => String(value || '').trim() || fallback,
    getSettings: () => ({}),
    getCalendarDefs: () => [{ id: 'default', name: '默认日历' }],
    normalizeDateOnly: (value) => {
        const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
        return Number.isNaN(date.getTime()) ? null : new Date(date.getFullYear(), date.getMonth(), date.getDate());
    },
    getCalendarView: () => ({ type: 'timeGridWeek' }),
    resolveMainCalendarAnchorDate: (date) => date,
    callCalendarAdapter: (instance, action, date) => { moves.push({ instance, action, date }); return true; },
    renderMiniCalendar: () => {},
});
vm.runInContext(model.slice(model.indexOf('function __tmParseTaskRepeatJson'), model.indexOf('function __tmGetTaskRepeatWeekdayLabel')), context);
vm.runInContext(calendar.slice(calendar.indexOf('    function getScheduleRepeatCore()'), calendar.indexOf('    function setScheduleCache(')), context);
for (const name of ['parseDateOnly', 'normalizeDateOnly', 'getScheduleSearchOccurrence', 'searchSchedules', 'navigateToDate']) vm.runInContext(extract(name), context);

const daily = {
    id: 'daily', start: '2020-01-01T09:00:00', end: '2020-01-01T10:00:00',
    repeatRule: { enabled: true, type: 'daily', trigger: 'due', every: 1, anchorDate: '2020-01-01', until: '2029-12-31' },
};
const now = new Date(2026, 0, 10, 10);
const occurrence = context.getScheduleSearchOccurrence(daily, now);
assert.equal(key(occurrence.start), '2026-01-11', 'series seek to the next real occurrence');
assert.equal(key(context.getScheduleSearchOccurrence({ ...daily, skippedOccurrences: [String(occurrence.start.getTime())] }, now).start), '2026-01-12', 'skip removed occurrences');
assert.equal(key(context.getScheduleSearchOccurrence(daily, new Date(2030, 0, 1)).start), '2029-12-31', 'ended series find the last occurrence beyond 2400 records');
assert.equal(key(context.getScheduleSearchOccurrence({ ...daily, repeatRule: { ...daily.repeatRule, until: '', maxOccurrences: 3 } }, now).start), '2020-01-03', 'count-based ending is respected');
assert.equal(context.getScheduleSearchOccurrence({ start: 'bad', end: 'bad' }, now), null);

(async () => {
    const single = { start: '2026-11-20T09:00:00', end: '2026-11-20T10:00:00', calendarId: 'default' };
    schedules = Array.from({ length: 501 }, (_, index) => ({ ...single, id: `schedule-${index}`, title: index === 500 ? '发布会 [x]' : '其他安排' }));
    assert.deepEqual(Array.from(await context.searchSchedules('[x]'), (item) => item.id), ['schedule-500'], 'keywords match beyond the first 500 records, including literal syntax');
    schedules.push({ ...single, id: 'note', title: '独立日程', note: `${'普通文字'.repeat(80)}API 检查` });
    schedules.push({ ...single, id: 'linked', taskId: 'linked-task', title: '' });
    schedules.push({ ...single, id: 'bad', title: '发布会', start: 'bad' });
    const notes = await context.searchSchedules('api');
    assert.equal(notes[0].id, 'note', 'notes match without a task link');
    assert.match(notes[0].snippet, /API/, 'the snippet contains a late note match');
    assert.equal((await context.searchSchedules('跟随标题'))[0].id, 'linked', 'empty schedule titles follow linked block titles');
    assert.equal(titleReads.length, 1, 'only missing titles need metadata');
    assert.equal((await context.searchSchedules('发布会')).length, 2, 'invalid dates do not produce navigation targets');
    assert.equal(notes[0].date, '2026-11-20');
    assert.match(notes[0].dateLabel, /2026-11-20 09:00/);
    assert.equal((await context.searchSchedules('')).length, 0);
    context.state.scheduleCache.lastLoadError = true;
    await assert.rejects(context.searchSchedules('发布会'), /结果可能不完整/);

    assert.equal(context.navigateToDate('2026-11-20'), true, 'navigation can be queued before mount');
    assert.equal(moves.length, 0);
    assert.equal(key(context.state.pendingNavigationDate), '2026-11-20');
    context.state.calendar = {};
    context.state.rootEl.isConnected = true;
    assert.equal(context.navigateToDate(context.state.pendingNavigationDate), true);
    assert.equal(key(moves[0].date), '2026-11-20');
    assert.equal(context.state.pendingNavigationDate, null);
    context.state.navigateMiniCalendarDate = (date) => { moves.push({ mini: true, date }); return true; };
    assert.equal(context.navigateToDate('2026-12-21'), true);
    assert.equal(moves.at(-1).mini, true, 'month and list views use their existing date navigation');
    assert.equal(context.navigateToDate('invalid'), false);
    console.log('calendar search behavior tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
