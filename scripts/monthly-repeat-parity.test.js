'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const modelSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/50-task-model-and-repeat-utils.js'), 'utf8');
const runtimeSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/54-recurring-task-runtime.js'), 'utf8');
const dateKey = (value) => value instanceof Date
    ? [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-')
    : String(value || '').match(/^\d{4}-\d{2}-\d{2}/)?.[0] || '';
const context = vm.createContext({ Date, Intl, Math, Number, String, JSON, Set, Map, Array, Object,
    __tmNormalizeDateOnly: dateKey,
    __tmNormalizeTaskCompleteAtValue: (value) => String(value || ''),
    __tmBuildTaskTomatoBaselinePatch: () => ({ tomatoBaselineSet: true }),
});
vm.runInContext(modelSource.slice(modelSource.indexOf('function __tmParseTaskRepeatJson'), modelSource.indexOf('function __tmGetTaskRepeatWeekdayLabel')), context);
const core = context.tmRepeatCore;
const monthly = core.monthDates;
const datePicker = monthly.pickerHTML([10, 11, -1], '2026-09-10');
assert.ok(datePicker.includes('grid-template-columns:repeat(7,minmax(0,1fr))'));
assert.match(datePicker, /width:100%;min-width:0/);
assert.doesNotMatch(datePicker, /max-width:/, 'month date grid must fill its dialog');
assert.doesNotMatch(monthly.weekdayPickerHTML({ ordinal: -1, weekday: 5 }, '2026-09-10'), /max-width:/, 'weekday selectors must fill their dialog');
const rule = (patch = {}) => ({ enabled: true, type: 'monthly', monthlyMode: 'date', calendarMode: 'solar', every: 1, anchorDate: '2026-09-10', monthDays: [10, 11, 17, 18, 19], ...patch });
const dates = (input, from = input.anchorDate, to = '2026-11-30') => Array.from(core.iterate(input, { fromDateKey: from, toDateKey: to }), (entry) => entry.dateKey);
assert.deepEqual(Array.from(core.normalizeRule(rule({ monthDays: [31, -1, 11, 11, 0, 32, 2.5] })).monthDays), [11, 31, -1]);
assert.deepEqual(dates(rule(), '2026-09-10', '2026-09-30'), ['2026-09-10', '2026-09-11', '2026-09-17', '2026-09-18', '2026-09-19']);
assert.deepEqual(dates(rule({ every: 2, monthDays: [10, 11] })), ['2026-09-10', '2026-09-11', '2026-11-10', '2026-11-11']);
assert.equal(core.nextDateKey('2026-10-11', rule({ every: 2 })), '2026-11-10');
assert.deepEqual(dates(rule({ anchorDate: '2026-09-12' }), '2026-09-01', '2026-09-30'), ['2026-09-17', '2026-09-18', '2026-09-19']);
assert.deepEqual(dates(rule({ anchorDate: '2026-01-31', monthDays: [31, -1] }), '2026-01-01', '2026-04-30'), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
assert.deepEqual(dates(rule({ anchorDate: '2026-01-31', monthDays: [31] }), '2026-01-01', '2026-04-30'), ['2026-01-31', '2026-03-31']);
assert.deepEqual(dates(rule({ anchorDate: '2028-02-01', monthDays: [29, -1] }), '2028-02-01', '2028-02-29'), ['2028-02-29']);
assert.deepEqual(dates(rule({ maxOccurrences: 3 })), ['2026-09-10', '2026-09-11', '2026-09-17']);
assert.deepEqual(dates(rule({ until: '2026-09-17' })), ['2026-09-10', '2026-09-11', '2026-09-17']);
assert.deepEqual(dates(rule({ monthDays: [] })), []);
assert.equal(core.nextDateKey('2026-02-01', rule({ anchorDate: '2026-02-01', every: 12, monthDays: [30, 31] })), '');
assert.equal(monthly.previousDateKey(rule(), '2026-10-01', true), '2026-09-19');
const legacy = { enabled: true, type: 'monthly', every: 1, anchorDate: '2026-01-31' };
assert.equal(Object.hasOwn(core.normalizeRule(legacy), 'monthDays'), false);
assert.deepEqual(dates(legacy, '2026-01-01', '2026-03-31'), ['2026-01-31', '2026-02-28', '2026-03-31']);
const ranged = { startDate: '2026-09-08', completionTime: '2026-09-10', repeatState: { occurrenceCount: 1 } };
const patch = context.__tmBuildTaskRepeatAdvancePatch(ranged, rule());
assert.equal(patch.startDate, '2026-09-09');
assert.equal(patch.completionTime, '2026-09-11');
assert.equal(patch.repeatState.occurrenceCount, 2);
const legacyPatch = context.__tmBuildTaskRepeatAdvancePatch(ranged, { ...legacy, anchorDate: '2026-09-10' });
assert.equal(legacyPatch.startDate, '2026-10-08');
assert.equal(legacyPatch.completionTime, '2026-10-10');
assert.equal(context.__tmBuildTaskRepeatAdvancePatch({ ...ranged, repeatState: { occurrenceCount: 2 } }, rule({ maxOccurrences: 2 })), null);
vm.runInContext(runtimeSource.slice(runtimeSource.indexOf('function __tmGetTaskRepeatScheduleSignature'), runtimeSource.indexOf('async function __tmApplyTaskRepeatRule')), context);
const changed = context.__tmBuildTaskRepeatRuleMetaPatch({ ...ranged, repeatRule: rule(), repeatState: { occurrenceCount: 4 } }, rule({ monthDays: [11, 17], maxOccurrences: 3 }));
assert.equal(changed.completionTime, '2026-09-11');
assert.equal(changed.startDate, '2026-09-09');
assert.equal(changed.repeatRule.anchorDate, '2026-09-11');
assert.equal(changed.repeatState.occurrenceCount, 1);
const monthlyWeek = rule({ monthlyMode: 'weekday', monthWeek: { ordinal: -1, weekday: 5 }, anchorDate: '2026-09-01' });
assert.deepEqual(dates(monthlyWeek), ['2026-09-25', '2026-10-30', '2026-11-27']);
assert.equal(monthly.previousDateKey(monthlyWeek, '2026-11-15', true), '2026-10-30');
assert.deepEqual(dates(rule({ monthlyMode: 'weekday', monthWeek: { ordinal: 5, weekday: 1 }, anchorDate: '2026-08-01' }), '2026-08-01', '2027-04-01'), ['2026-08-31', '2026-11-30', '2027-03-29']);
assert.deepEqual(dates(rule({ monthlyMode: 'weekday', monthWeek: { ordinal: 1, weekday: 0 }, every: 2, anchorDate: '2026-09-01' })), ['2026-09-06', '2026-11-01']);
assert.deepEqual(dates({ ...monthlyWeek, maxOccurrences: 2 }), ['2026-09-25', '2026-10-30']);
for (let ordinal = -1; ordinal <= 5; ordinal += 1) {
    if (ordinal === 0) continue;
    for (let weekday = 0; weekday <= 6; weekday += 1) {
        const input = rule({ monthWeek: { ordinal, weekday }, monthlyMode: 'weekday', anchorDate: '2026-01-01' });
        const expected = [];
        for (let month = 0; month < 12; month += 1) {
            const candidates = [];
            for (let day = 1; day <= new Date(2026, month + 1, 0).getDate(); day += 1) {
                const candidate = new Date(2026, month, day, 12);
                if (candidate.getDay() === weekday) candidates.push(dateKey(candidate));
            }
            const key = ordinal === -1 ? candidates.at(-1) : candidates[ordinal - 1];
            if (key) expected.push(key);
        }
        assert.deepEqual(dates(input, input.anchorDate, '2026-12-31'), expected);
    }
}
const allDays = Array.from({ length: 31 }, (_, index) => index + 1);
const dense = rule({ anchorDate: '2020-01-01', monthDays: allDays });
assert.equal(core.ordinal(dense, '2027-01-01'), 2558);
assert.equal(core.ordinal({ enabled: true, type: 'daily', every: 1, anchorDate: '2020-01-01' }, '2027-01-01'), 2558);
for (let sample = 0; sample < 80; sample += 1) {
    const year = 1998 + sample;
    const anchor = new Date(year, sample % 12, sample % 27 + 1, 12);
    const until = new Date(year + 2, anchor.getMonth(), anchor.getDate(), 12);
    const input = rule({ every: sample % 5 + 1, anchorDate: dateKey(anchor), monthDays: [sample % 31 + 1, (sample * 7) % 31 + 1, -1] });
    const expected = [];
    for (const cursor = new Date(anchor); cursor <= until; cursor.setDate(cursor.getDate() + 1)) {
        const delta = (cursor.getFullYear() - anchor.getFullYear()) * 12 + cursor.getMonth() - anchor.getMonth();
        const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
        if (delta % input.every === 0 && (input.monthDays.includes(cursor.getDate()) || cursor.getDate() === lastDay)) expected.push(dateKey(cursor));
    }
    const actual = dates(input, input.anchorDate, dateKey(until));
    assert.deepEqual(actual, expected, 'brute-force parity for sample ' + sample);
    for (let index = 1; index < actual.length; index += 1) {
        assert.equal(core.nextDateKey(actual[index - 1], input), actual[index]);
        assert.equal(monthly.previousDateKey(input, actual[index]), actual[index - 1]);
        assert.equal(core.ordinal(input, actual[index]), index + 1);
    }
}
const tomatoPath = path.resolve(root, '../siyuan-plugin-docktomato/tomato.js');
if (fs.existsSync(tomatoPath)) {
    const tomatoSource = fs.readFileSync(tomatoPath, 'utf8').replace(/\r\n/g, '\n');
    const normalizeSource = modelSource.replace(/\r\n/g, '\n');
    const factory = (text, instance) => text.slice(text.indexOf('    function __createMonthRepeatCore()'), text.indexOf('    const ' + instance + ' =')).trim();
    assert.equal(factory(tomatoSource, '__monthRepeatCore'), factory(normalizeSource, '__tmMonthRepeatCore'), 'embedded cores must stay identical');
} else {
    console.log('Skipped optional Dock Tomato source parity: sibling checkout unavailable');
}
const apiSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
context.__TM_REMINDER_REPEAT_MODE_FOLLOW_TASK = 'followTaskRepeat';
vm.runInContext(apiSource.slice(apiSource.indexOf('function __tmReminderToDateSafe'), apiSource.indexOf('function __tmFormatReminderDateTimeCompact')), context);
const rawReminder = { enabled: true, interval: 'monthly', repeatMode: 'manual', every: 2, monthDays: [10, 11], monthlyMode: 'date', calendarMode: 'solar', startDate: '2026-09-10', times: ['09:00', '18:00'] };
const reminder = context.__tmNormalizeReminderRecord(rawReminder, 'monthly-test');
assert.deepEqual(Array.from(reminder.monthDays), [10, 11], 'reminder bridge must retain month dates');
assert.equal(dateKey(context.__tmGetNextReminderDateTime(reminder, new Date('2026-09-10T19:00:00'))), '2026-09-11');
assert.equal(dateKey(context.__tmGetNextReminderDateTime(reminder, new Date('2026-09-11T19:00:00'))), '2026-11-10');
assert.equal(dateKey(context.__tmGetLastDueReminderDateTime(reminder, new Date('2026-10-15T10:00:00'))), '2026-09-11');
const excluded = context.__tmNormalizeReminderRecord({ ...rawReminder, excludedOccurrences: [{ date: '2026-09-11', time: '09:00' }, { date: '2026-09-11', time: '18:00' }] }, 'monthly-test');
assert.equal(dateKey(context.__tmGetNextReminderDateTime(excluded, new Date('2026-09-10T19:00:00'))), '2026-11-10');
const weekReminder = context.__tmNormalizeReminderRecord({ ...rawReminder, every: 1, monthlyMode: 'weekday', monthWeek: { ordinal: -1, weekday: 5 } }, 'monthly-week-test');
assert.equal(dateKey(context.__tmGetNextReminderDateTime(weekReminder, new Date('2026-09-10T19:00:00'))), '2026-09-25');
assert.equal(dateKey(context.__tmGetLastDueReminderDateTime(weekReminder, new Date('2026-10-31T19:00:00'))), '2026-10-30');
const followMonth = { ...reminder, repeatMode: 'followTaskRepeat', interval: 'once', taskCompletionTime: '2026-09-10', taskRepeatRule: rule({ every: 2, monthDays: [10, 11], maxOccurrences: 2 }), taskRepeatState: { occurrenceCount: 1 } };
assert.equal(dateKey(context.__tmGetNextFollowTaskReminderPreviewDateTime(followMonth, new Date('2026-09-10T19:00:00'))), '2026-09-11');
assert.equal(context.__tmGetNextFollowTaskReminderPreviewDateTime(followMonth, new Date('2026-09-11T19:00:00')), null);
console.log('monthly repeat parity tests passed (80 date ranges + 42 weekday patterns)');
