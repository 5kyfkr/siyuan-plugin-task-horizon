'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/50-task-model-and-repeat-utils.js'), 'utf8');
const dateKey = (value) => value instanceof Date
    ? [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-')
    : String(value || '').match(/^\d{4}-\d{2}-\d{2}/)?.[0] || '';
const context = vm.createContext({ Date, Intl, Math, Number, String, JSON, Set, Map, Array, Object,
    __tmNormalizeDateOnly: dateKey,
    __tmNormalizeTaskCompleteAtValue: (value) => String(value || ''),
});
vm.runInContext(source.slice(source.indexOf('function __tmParseTaskRepeatJson'), source.indexOf('function __tmGetTaskRepeatWeekdayLabel')), context);
const core = context.tmRepeatCore;
const base = { enabled: true, trigger: 'complete', type: 'monthly', every: 1, anchorDate: '2026-01-01' };
const fixed = { ...base, weekdays: [1, 5], monthDays: [10, 20], monthlyMode: 'weekday', monthWeek: { ordinal: -1, weekday: 5 }, calendarMode: 'lunar' };
for (const type of ['daily', 'workday', 'weekly', 'monthly', 'yearly']) {
    const normalized = core.normalizeRule({ ...fixed, type });
    assert.deepEqual(Array.from(normalized.weekdays), []);
    assert.equal(normalized.monthDays, undefined);
    assert.equal(normalized.monthWeek, undefined);
    assert.equal(normalized.monthlyMode, 'date');
    assert.equal(normalized.calendarMode, 'solar');
    assert.equal(core.monthDates.isExplicit(normalized), false);
    assert.deepEqual(Array.from(core.iterate(normalized, { fromDateKey: '2026-01-01', toDateKey: '2027-12-31' })), []);
    assert.equal(core.ordinal(normalized, '2026-02-01'), 0);
    assert.equal(core.next(normalized, { dateKey: '2026-01-01', ordinal: 1 }), null);
}
for (const [type, every, completedAt, expected] of [
    ['daily', 3, '2026-09-11', '2026-09-14'],
    ['weekly', 2, '2026-09-11', '2026-09-25'],
    ['workday', 1, '2026-09-11', '2026-09-14'],
    ['workday', 3, '2026-09-12', '2026-09-16'],
    ['monthly', 1, '2026-01-31', '2026-02-28'],
    ['monthly', 1, '2028-01-31', '2028-02-29'],
    ['monthly', 2, '2026-12-31', '2027-02-28'],
    ['yearly', 1, '2028-02-29', '2029-02-28'],
]) {
    const rule = { ...fixed, type, every };
    assert.equal(core.nextDateKey(completedAt, rule), expected);
    const patch = context.__tmBuildTaskRepeatAdvancePatch({ startDate: '2025-01-08', completionTime: '2025-01-10' }, rule, { completedAt });
    assert.equal(patch.completionTime, expected);
    assert.equal((new Date(patch.completionTime + 'T12:00:00') - new Date(patch.startDate + 'T12:00:00')) / 86400000, 2);
    assert.equal(patch.repeatState.occurrenceCount, 2);
    assert.equal(patch.repeatState.lastCompletedAt, completedAt);
}
assert.equal(context.__tmBuildTaskRepeatAdvancePatch({ completionTime: '2026-01-01' }, base), null, 'completion requires an actual completion timestamp');
assert.equal(context.__tmBuildTaskRepeatAdvancePatch({}, { ...base, until: '2026-01-31' }, { completedAt: '2026-01-31' }), null);
assert.equal(context.__tmBuildTaskRepeatAdvancePatch({}, base, { completedAt: '2026-01-31' }).completionTime, '2026-02-28');
assert.equal(context.__tmBuildTaskRepeatAdvancePatch({ completionTime: '2026-09-12', taskCompleteAt: '2026-09-11T09:00:00+08:00' }, { ...base, type: 'daily' }).completionTime, '2026-09-12', 'early completion may retain the same planned date for a distinct next occurrence');
assert.equal(core.next({ ...base, type: 'daily' }, { dateKey: '2026-09-12', completedAt: '2026-09-11', ordinal: 1 }).dateKey, '2026-09-12');
assert.equal(context.__tmBuildTaskRepeatAdvancePatch({ repeatState: { occurrenceCount: 3 } }, { ...base, maxOccurrences: 3 }, { completedAt: '2026-01-31' }), null);
assert.equal(core.nextDateKey('2026-01-31', { ...base, until: '2026-02-27' }), '');
assert.equal(core.nextDateKey('2026-01-31', { ...base, until: '2026-02-28' }), '2026-02-28');
assert.equal(core.nextDateKey('9999-12-31', base), '');
assert.equal(core.nextDateKey('2026-01-01', { ...base, trigger: 'due', monthDays: [10, 20] }), '2026-01-10');
assert.equal(core.nextDateKey('2026-09-11', { ...base, trigger: 'due', type: 'weekly', weekdays: [1, 5], anchorDate: '2026-09-01' }), '2026-09-14');
const apiSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const calendarSource = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const functionBlock = (text, name) => {
    const start = text.indexOf('    function ' + name + '(');
    assert.ok(start >= 0, name);
    const offset = text.slice(start + 5).search(/\n    (?:(?:async )?function |const |let )/);
    return text.slice(start, offset < 0 ? text.length : start + 5 + offset);
};
Object.assign(context, {
    __tmNormalizeReminderDateKey: dateKey,
    __tmReminderToDateSafe: (value) => new Date(value),
    __tmCollectReminderTimes: (value) => value.times || [],
    __tmParseReminderTime: (value) => ({ key: value, hh: Number(value.slice(0, 2)), mm: Number(value.slice(3, 5)) }),
    __tmNormalizeReminderInterval: (value) => typeof value === 'string' ? value : value.interval,
    __tmGetReminderEvery: (value) => value.every || 1,
    __tmGetReminderRepeatMode: (value) => value.repeatMode || 'manual',
    __tmNormalizeReminderCalendarMode: (value) => value || 'solar',
    __tmNormalizeReminderMonthlyMode: (value) => value || 'date',
    __tmNormalizeReminderWeekdays: (value) => value || [],
    __tmHasReminderFollowTaskRepeat: () => false,
    __tmIsReminderOccurrenceSuppressed: () => false,
});
for (const name of ['__tmNormalizeReminderTaskRepeatRule', '__tmNormalizeReminderRecord', '__tmGetReminderStartDateKey', '__tmGetReminderCompletionDateKey', '__tmGetNextReminderDateTime', '__tmGetLastDueReminderDateTime']) {
    vm.runInContext(functionBlock(apiSource, name), context);
}
const independent = { enabled: true, trigger: 'complete', interval: 'monthly', startDate: '2026-09-30', times: ['09:00'], maxOccurrences: 3,
    repeatState: { occurrenceCount: 2, lastCompletedAt: '2026-08-11T12:00:00+08:00', lastInstanceDue: '2026-09-11' } };
assert.equal(dateKey(context.__tmGetNextReminderDateTime(independent, new Date('2026-09-10'))), '2026-09-11', 'bridge must respect early completion dates before the original start');
assert.equal(dateKey(context.__tmGetLastDueReminderDateTime(independent, new Date('2026-12-01'))), '2026-09-11', 'bridge must retain the uncompleted current cycle');
assert.equal(context.__tmGetNextReminderDateTime(independent, new Date('2026-09-12')), null);
assert.equal(context.__tmGetNextReminderDateTime({ ...independent, maxOccurrences: 1 }, new Date('2026-09-10')), null);
for (const normalized of [context.__tmNormalizeReminderTaskRepeatRule(fixed), context.__tmNormalizeReminderRecord({ ...fixed, interval: 'monthly' })]) {
    assert.deepEqual(Array.from(normalized.weekdays), []);
    assert.equal(normalized.monthDays, undefined);
    assert.equal(normalized.monthWeek, undefined);
    assert.equal(normalized.calendarMode, 'solar');
}
const calendarContext = vm.createContext({ Date, String, Number, Math, Set, Array, formatDateKey: dateKey,
    reminderOccurrenceKey: (date, time) => date + ' ' + time });
for (const name of ['getReminderStartDateKey', 'doesReminderOccurOnDate', 'getReminderCompletedSet']) {
    vm.runInContext(functionBlock(calendarSource, name), calendarContext);
}
assert.equal(calendarContext.doesReminderOccurOnDate(independent, '2026-09-11'), true);
assert.equal(calendarContext.doesReminderOccurOnDate(independent, '2026-10-11'), false, 'calendar must not manufacture future completion occurrences');
assert.equal(calendarContext.doesReminderOccurOnDate({ ...independent, maxOccurrences: 1 }, '2026-09-11'), false);
assert.equal(calendarContext.doesReminderOccurOnDate({ ...independent, endDate: '2026-09-10' }, '2026-09-11'), false);
assert.equal(calendarContext.getReminderCompletedSet({ ...independent, completedOccurrences: [{ date: '2026-09-11', time: '09:00', occurrenceNumber: 1 }] }).size, 0);
console.log('completion repeat parity tests passed');
