'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const calendar = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const taskModel = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', 'task-runtime', '50-task-model-and-repeat-utils.js'),
    'utf8',
);

const modelStart = taskModel.indexOf('function __tmParseTaskRepeatJson');
const modelEnd = taskModel.indexOf('function __tmGetTaskRepeatWeekdayLabel', modelStart);
const modelContext = vm.createContext({ Date, Intl, Math, Number, String, JSON, Set, Map, Array, Object, __tmNormalizeDateOnly: (value) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const pad = (n) => String(n).padStart(2, '0');
        return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
    }
    return String(value || '').match(/^\d{4}-\d{2}-\d{2}/)?.[0] || '';
}});
modelContext.globalThis = modelContext;
vm.runInContext(`${taskModel.slice(modelStart, modelEnd)}\nthis.__core = globalThis.tmRepeatCore;`, modelContext);
const calendarStart = calendar.indexOf('    function getScheduleRepeatCore()');
const calendarEnd = calendar.indexOf('    function refreshScheduleAfterMutationResult(', calendarStart);
assert.ok(calendarStart >= 0 && calendarEnd > calendarStart, 'calendar repeat adapter slice must remain extractable');
const calendarContext = vm.createContext({
    Date, Intl, Math, Number, String, JSON, Set, Map, Array, Object,
    globalThis: null,
    tmRepeatCore: modelContext.__core,
    toMs: (value) => value instanceof Date ? value.getTime() : Date.parse(String(value || '')),
    formatDateKey: (value) => {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        const pad = (n) => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    },
    uuid: () => 'uuid-test',
    safeISO: (value) => value instanceof Date ? value.toISOString() : '',
    getScheduleLinkedBlockId: () => '',
    normalizeCalendarScheduleTitleText: (value, fallback) => String(value || '').trim() || fallback,
    sanitizeScheduleNotificationSchedules: (value) => value && typeof value === 'object' ? value : {},
    overlap: (start, end, rangeStart, rangeEnd) => end > rangeStart && start < rangeEnd,
    isAllDayRange: (start, end) => start.getHours() === 0 && start.getMinutes() === 0 && end.getHours() === 0 && end.getMinutes() === 0,
});
calendarContext.globalThis = calendarContext;
vm.runInContext(`${calendar.slice(calendarStart, calendarEnd)}\nthis.__test = { normalizeScheduleList, serializeScheduleForSave, collectScheduleOccurrencesInRange, applyScheduleRecurringScopeMutation };`, calendarContext);
const calendarApi = calendarContext.__test;

assert.match(taskModel, /tmRepeatCore\s*=\s*Object\.freeze\([\s\S]*normalizeRule:[\s\S]*next:[\s\S]*iterate:/,
    'task runtime must expose the shared repeat facade');
assert.match(calendar, /function getScheduleRepeatRule\(item\)[\s\S]*normalizeScheduleRepeatRule\(item\)/,
    'calendar repeat reads must go through the canonical rule resolver');
assert.match(calendar, /function collectScheduleOccurrencesInRange\(item, rangeStart, rangeEnd, options\)[\s\S]*const rule = getScheduleRepeatView\(item\)[\s\S]*core\.iterate\(rule/,
    'calendar occurrence rendering must delegate date iteration to the task core');
assert.doesNotMatch(calendar, /isScheduleLunarOccurrenceDate|buildScheduleMonthlyOccurrenceDate|buildScheduleYearlyOccurrenceDate/,
    'calendar must not retain a parallel lunar/monthly occurrence algorithm');
assert.match(calendar, /function serializeScheduleForSave\(item\)[\s\S]*base\.repeatRule = rule[\s\S]*SCHEDULE_LEGACY_REPEAT_FIELDS/,
    'schedule persistence must use canonical repeatRule and strip legacy fields');
assert.match(calendar, /data-tm-cal-field="repeatEndMode"[\s\S]*value="count"[\s\S]*data-tm-cal-field="repeatMaxOccurrences"/,
    'schedule editor must expose count-based recurrence ending');
assert.match(calendar, /data-tm-cal-weekday/,
    'schedule editor must expose multi-weekday selection');
assert.match(calendar, /if \(split\.ordinal <= 1\) \{[\s\S]*buildScheduleRecurringSeriesUpdate\(prevItem, draftItem, occurrenceStartMs\)/,
    'future edits at the first occurrence must replace the whole series instead of creating an unlimited empty prefix');

const legacyWeekly = calendarApi.normalizeScheduleList([{
    id: 'schedule-1',
    title: 'Legacy weekly',
    start: new Date(2026, 7, 24, 9, 0, 0, 0),
    end: new Date(2026, 7, 24, 10, 0, 0, 0),
    repeatType: 'weekly',
    repeatEvery: 1,
}]).out[0];
assert.deepEqual(Array.from(legacyWeekly.repeatRule.weekdays), [1], 'legacy weekly schedule must derive its anchor weekday');
const migratedOccurrences = calendarApi.collectScheduleOccurrencesInRange(
    legacyWeekly,
    new Date(2026, 7, 24, 0, 0, 0, 0),
    new Date(2026, 8, 1, 0, 0, 0, 0),
    { limit: 20 },
);
const localDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
assert.deepEqual(Array.from(migratedOccurrences, (item) => localDateKey(item.start)), ['2026-08-24', '2026-08-31'], 'calendar collector must use task core dates');
const serialized = calendarApi.serializeScheduleForSave(legacyWeekly);
assert.ok(serialized.repeatRule && !Object.prototype.hasOwnProperty.call(serialized, 'repeatType'), 'canonical saves must remove legacy repeat fields');
const stringRuleSchedule = calendarApi.normalizeScheduleList([{
    id: 'schedule-string-rule',
    title: 'String rule',
    start: new Date(2026, 7, 24, 9, 0, 0, 0),
    end: new Date(2026, 7, 24, 10, 0, 0, 0),
    repeatRule: JSON.stringify({ enabled: true, trigger: 'complete', type: 'daily', every: 1, anchorDate: '2026-08-24' }),
}]).out[0];
assert.equal(stringRuleSchedule.repeatRule.trigger, 'due', 'string canonical rules must normalize to due-trigger schedule rules');
const occurrenceEditShape = calendarApi.normalizeScheduleList([{
    id: 'schedule-occurrence-edit',
    title: 'Occurrence edit',
    start: new Date(2026, 7, 31, 9, 0, 0, 0),
    end: new Date(2026, 7, 31, 10, 0, 0, 0),
    repeatRule: { enabled: true, type: 'daily', every: 1, anchorDate: '2026-08-24' },
}]).out[0];
assert.equal(occurrenceEditShape.repeatRule.anchorDate, '2026-08-24', 'editing an occurrence must preserve the series anchor date');
const invalidAnchorShape = calendarApi.normalizeScheduleList([{
    id: 'schedule-invalid-anchor',
    start: new Date(2026, 7, 24, 9, 0, 0, 0),
    end: new Date(2026, 7, 24, 10, 0, 0, 0),
    repeatRule: { enabled: true, type: 'daily', every: 1, anchorDate: 'invalid' },
}]).out[0];
assert.equal(invalidAnchorShape.repeatRule.anchorDate, '2026-08-24', 'invalid canonical anchors must fall back to the schedule start date');
const fsrsScheduleShape = calendarApi.normalizeScheduleList([{
    id: 'schedule-fsrs',
    start: new Date(2026, 7, 24, 9, 0, 0, 0),
    end: new Date(2026, 7, 24, 10, 0, 0, 0),
    repeatRule: { enabled: true, type: 'fsrs', trigger: 'complete', anchorDate: '2026-08-24' },
}]).out[0];
assert.equal(fsrsScheduleShape.repeatRule.type, 'none', 'task-only FSRS rules must not enter the schedule recurrence domain');
assert.deepEqual(
    Array.from(calendarApi.collectScheduleOccurrencesInRange(
        stringRuleSchedule,
        new Date(2026, 7, 24),
        new Date(2026, 7, 27),
        { limit: 10 },
    ), (item) => localDateKey(item.start)),
    ['2026-08-24', '2026-08-25', '2026-08-26'],
    'string canonical rules must remain expandable after migration',
);
const sharedTaskSchedules = [
    {
        id: 'task-shared-daily', taskId: 'task-1',
        start: new Date(2026, 7, 24, 9, 0, 0, 0), end: new Date(2026, 7, 24, 10, 0, 0, 0),
        repeatRule: { enabled: true, type: 'daily', every: 1, anchorDate: '2026-08-24' },
    },
    {
        id: 'task-shared-weekly', taskId: 'task-1',
        start: new Date(2026, 7, 24, 14, 0, 0, 0), end: new Date(2026, 7, 24, 15, 0, 0, 0),
        repeatRule: { enabled: true, type: 'weekly', every: 1, weekdays: [1, 3], anchorDate: '2026-08-24' },
    },
];
assert.deepEqual(
    Array.from(calendarApi.collectScheduleOccurrencesInRange(sharedTaskSchedules[0], new Date(2026, 7, 24), new Date(2026, 7, 28), { limit: 20 }), (item) => localDateKey(item.start)),
    ['2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27'],
    'one task may own an independent daily schedule',
);
assert.deepEqual(
    Array.from(calendarApi.collectScheduleOccurrencesInRange(sharedTaskSchedules[1], new Date(2026, 7, 24), new Date(2026, 8, 1), { limit: 20 }), (item) => localDateKey(item.start)),
    ['2026-08-24', '2026-08-26', '2026-08-31'],
    'one task may own a separate multi-weekday schedule without sharing recurrence state',
);
const countSeries = {
    id: 'count-series',
    start: new Date(2026, 7, 24, 9, 0, 0, 0),
    end: new Date(2026, 7, 24, 10, 0, 0, 0),
    repeatRule: { enabled: true, type: 'daily', every: 1, maxOccurrences: 4, anchorDate: '2026-08-24' },
};
const firstFutureList = [countSeries];
const firstFutureResult = calendarApi.applyScheduleRecurringScopeMutation(firstFutureList, 0, {
    ...countSeries,
    start: new Date(2026, 7, 25, 11, 0, 0, 0),
    end: new Date(2026, 7, 25, 12, 0, 0, 0),
}, 'future', { occurrenceStartMs: new Date(2026, 7, 24, 9, 0, 0, 0).getTime() });
assert.equal(firstFutureList.length, 1, 'future edit at ordinal one must not leave a second prefix series');
assert.equal(firstFutureResult.item.id, 'count-series', 'first future edit must keep the original series ID');
assert.equal(firstFutureResult.item.repeatRule.anchorDate, '2026-08-25', 'first future edit must re-anchor the whole series to the new start');
const laterFutureList = [{ ...countSeries }];
calendarApi.applyScheduleRecurringScopeMutation(laterFutureList, 0, {
    ...countSeries,
    start: new Date(2026, 7, 25, 11, 0, 0, 0),
    end: new Date(2026, 7, 25, 12, 0, 0, 0),
}, 'future', { occurrenceStartMs: new Date(2026, 7, 25, 9, 0, 0, 0).getTime() });
assert.equal(laterFutureList.length, 2, 'future edit after the first occurrence must split the series');
assert.equal(laterFutureList[0].repeatRule.maxOccurrences, 1, 'split prefix must retain the completed ordinal count');
assert.equal(laterFutureList[1].repeatRule.maxOccurrences, 3, 'split suffix must retain the remaining ordinal count');
const allDayOccurrences = calendarApi.collectScheduleOccurrencesInRange({
    id: 'all-day',
    start: new Date(2026, 7, 24, 0, 0, 0, 0),
    end: new Date(2026, 7, 25, 0, 0, 0, 0),
    allDay: true,
    repeatRule: { enabled: true, type: 'daily', every: 1, anchorDate: '2026-08-24' },
}, new Date(2026, 7, 24), new Date(2026, 7, 27), { limit: 10 });
assert.deepEqual(Array.from(allDayOccurrences, (item) => [localDateKey(item.start), localDateKey(item.end)]), [
    ['2026-08-24', '2026-08-25'],
    ['2026-08-25', '2026-08-26'],
    ['2026-08-26', '2026-08-27'],
], 'all-day recurrence must preserve local day spans');

console.log('calendar repeat core contract tests passed');
