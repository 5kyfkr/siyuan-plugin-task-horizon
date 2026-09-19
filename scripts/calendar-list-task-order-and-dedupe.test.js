'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'calendar-view.js'), 'utf8');
function segment(start, end) {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, start);
    return source.slice(from, to);
}
const day = new Date();
day.setHours(0, 0, 0, 0);
const addDays = (date, count) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + count);
const dateKey = (date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
const context = vm.createContext({
    Date,
    window: {}, state: {},
    prototypeListState: { focusDate: day, collapsedGroups: new Set() },
    esc: String,
    protoDayStart: (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()),
    protoAddDays: addDays, protoDateKey: dateKey, protoSafeDate: (date) => date,
    protoEventEnd: (event) => event.end,
    protoRangeEvents: (events, start, end) => events.filter((event) => event.start < end && event.end > start),
    resolveCalendarEventDoneState: (ext) => ext.done === true,
    getCalendarTaskSnapshotById: () => null,
    protoListFocusDate: () => day,
    protoListVisibleDays: () => [day],
    protoListWeekDates: () => [], protoListMonthDates: () => [], protoListWeekdayLabels: () => [],
    protoWeekLabels: ['日', '一', '二', '三', '四', '五', '六'],
    protoListDateLabel: dateKey,
    protoIsSpanEvent: (event) => event.end - event.start > 86400000,
    protoListEventRow: (event) => `<article data-event="${event.id}"></article>`,
    parseDateOnly: (value) => new Date(value + 'T00:00:00'),
    formatDateKey: dateKey,
    getReminderTimes: () => ['09:00'], getReminderCompletedSet: () => new Set(),
    doesReminderOccurOnDate: () => true, isReminderDateCompleted: () => false,
});
vm.runInContext([
    segment('const protoListEventOverlapsDay =', 'const protoListTaskParentId ='),
    segment('const protoListSortEvents =', 'const protoListDateCell ='),
    segment('const protoRenderList =', 'const protoRenderDayPanel ='),
    segment('function buildEventsFromReminders(', 'function normalizeCalendarCustomHolidayOverrides('),
    'this.sortEvents = protoListSortEvents; this.renderList = protoRenderList;',
].join('\n'), context);

function event(id, taskId, sourceType = 'taskdate', hour = null) {
    const start = new Date(day);
    if (hour !== null) start.setHours(hour);
    return {
        id, title: '相同名称', start,
        end: hour === null ? addDays(day, 1) : new Date(start.getTime() + 3600000),
        allDay: hour === null,
        extendedProps: { __tmTaskId: taskId, __tmSource: sourceType },
    };
}
const due = event('due-a', 'task-a');
const otherDue = event('due-b', 'task-b');
const early = event('early', '', 'schedule', 8);
const late = event('late', '', 'schedule', 15);
const pinned = event('pinned', 'pinned', 'schedule', 10);
pinned.extendedProps.__tmTaskPinned = true;
const ids = (events) => Array.from(events, (item) => item.id);
assert.deepEqual(ids(context.sortEvents([late, due, early, pinned])), ['due-a', 'pinned', 'early', 'late']);
context.__tmApplyCalendarRuleSort = (tasks) => tasks.slice().reverse();
assert.deepEqual(ids(context.sortEvents([early, due, late, otherDue])), ['due-b', 'due-a', 'early', 'late'], 'All-day task rules still sort within the all-day section');
const holiday = event('holiday', '', 'cnHoliday');
assert.deepEqual(ids(context.sortEvents([late, holiday, early])), ['holiday', 'early', 'late']);

const renderIds = (events) => Array.from(context.renderList({}, events, {}).matchAll(/data-event="([^"]+)"/g), (match) => match[1]);
function reminder(taskId, blockId) {
    const [raw] = context.buildEventsFromReminders([{ taskId, blockId }], day, addDays(day, 1), { linkDockTomato: true });
    return { ...raw, start: new Date(raw.start + 'T00:00:00'), end: new Date(raw.end + 'T00:00:00') };
}
const taskReminder = reminder('task-a', 'paragraph-a');
assert.deepEqual(renderIds([taskReminder, due]), ['due-a'], 'A reminder and deadline for the same task render one card');
assert.deepEqual(renderIds([reminder('', 'task-a'), due]), ['due-a'], 'Legacy reminders use their block ID');
assert.deepEqual(renderIds([taskReminder]), [taskReminder.id], 'A reminder without a deadline stays visible');
assert.deepEqual(renderIds([taskReminder, otherDue]).sort(), [taskReminder.id, 'due-b'].sort(), 'Matching titles on different tasks are not duplicates');
const tomorrowDue = { ...due, start: addDays(day, 1), end: addDays(day, 2) };
assert.deepEqual(renderIds([taskReminder, tomorrowDue]), [taskReminder.id], 'A deadline on another day must not hide today’s reminder');
const scheduled = event('scheduled-a', 'task-a', 'schedule', 9);
assert.deepEqual(renderIds([taskReminder, due, scheduled]), ['scheduled-a'], 'Schedule, deadline, and reminder collapse to the existing schedule card');
assert.deepEqual(renderIds([late, due, early]), ['due-a', 'early', 'late']);
const spanDue = { ...due, start: addDays(day, -1) };
assert.deepEqual(renderIds([taskReminder, spanDue]), ['due-a'], 'Spanning task date cards also suppress the same-day reminder');
console.log('calendar list task order and dedupe tests passed');
