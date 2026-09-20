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
function readFunction(name) {
    const start = source.indexOf(`    function ${name}(`);
    assert.ok(start >= 0, name);
    return source.slice(start, source.indexOf('\n    }', start) + 6);
}
const day = new Date();
day.setHours(0, 0, 0, 0);
const addDays = (date, count) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + count);
const dateKey = (date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
const context = vm.createContext({
    Date,
    window: {}, state: {},
    prototypeListState: { focusDate: day, collapsedGroups: new Set(), collapsedSubtasks: new Set() },
    esc: (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;'),
    protoDayStart: (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()),
    protoAddDays: addDays, protoDateKey: dateKey, protoSafeDate: (date) => date,
    protoEventEnd: (event) => event.end,
    protoRangeEvents: (events, start, end) => events.filter((event) => event.start < end && event.end > start),
    resolveCalendarEventDoneState: (ext) => ext.done === true,
    getCalendarTaskSnapshotById: () => null,
    getCalendarTaskRelationMeta: () => '', getCalendarTaskDocumentId: () => '',
    protoEventColor: () => '#527acc', protoEventTime: (event) => `${event.start.getHours()}:00`,
    protoEventMarkup: (event) => `<article>${event.title}</article>`,
    protoListFocusDate: () => day,
    protoListVisibleDays: () => [day],
    protoListWeekDates: () => [], protoListMonthDates: () => [], protoListWeekdayLabels: () => [],
    protoWeekLabels: ['日', '一', '二', '三', '四', '五', '六'],
    protoListDateLabel: dateKey,
    protoIsSpanEvent: (event) => event.end - event.start > 86400000,
    parseDateOnly: (value) => new Date(value + 'T00:00:00'),
    formatDateKey: dateKey,
    getReminderTimes: () => ['09:00'], getReminderCompletedSet: () => new Set(),
    doesReminderOccurOnDate: () => true, isReminderDateCompleted: () => false,
});
vm.runInContext([
    ...['resolveSharedPrototypeEventStart', 'resolveSharedPrototypeEventEnd', 'mergeCalendarAllDayReminders', 'buildCalendarMergedReminderMarkup'].map(readFunction),
    segment('const protoListEventOverlapsDay =', 'const protoListDateCell ='),
    segment('const protoRenderList =', 'const protoRenderDayPanel ='),
    segment('function isReminderFollowingTask(', 'function syncReminderDateFromTaskPatch('),
    segment('function buildEventsFromReminders(', 'function normalizeCalendarCustomHolidayOverrides('),
    'this.sortEvents = protoListSortEvents; this.renderList = protoRenderList; this.taskChildren = protoListTaskChildren;',
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

const renderIds = (events) => Array.from(context.renderList({}, events, {}).matchAll(/class="tm-proto-list-row [^"]+" data-tm-proto-event="([^"]+)"/g), (match) => match[1]);
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
const yesterdayDue = { ...due, start: addDays(day, -1), end: day };
const yesterdayReminder = { ...taskReminder, start: addDays(day, -1), end: day,
    extendedProps: { ...taskReminder.extendedProps, __tmReminderDate: dateKey(addDays(day, -1)) } };
assert.deepEqual(renderIds([yesterdayReminder, yesterdayDue]), ['due-a'], 'The expired group must also merge reminder and deadline cards');
assert.deepEqual(renderIds([taskReminder, scheduled]), ['scheduled-a'], 'A linked schedule alone is enough to merge the reminder');
const allDaySchedule = event('all-day-scheduled-a', 'task-a', 'schedule');
assert.deepEqual(renderIds([taskReminder, due, allDaySchedule]), ['all-day-scheduled-a'], 'All-day linked schedules must also deduplicate both the deadline and reminder');
const secondSchedule = event('second-scheduled-a', 'task-a', 'schedule', 16);
assert.deepEqual(renderIds([taskReminder, due, scheduled, secondSchedule]), ['scheduled-a', 'second-scheduled-a'], 'Distinct schedule slots for a task remain visible');
for (const events of [[taskReminder, due], [taskReminder, scheduled], [taskReminder, due, scheduled], [taskReminder, allDaySchedule], [yesterdayReminder, yesterdayDue], [taskReminder, spanDue]]) {
    const html = context.renderList({}, events, {});
    assert.match(html, /class="tm-proto-reminder-time"[^>]*>⏰ [^<]*09:00<\/span>/, 'The actual list task card must retain the reminder time');
    assert.match(html, /class="tm-proto-list-event tm-proto-list-task-card[^>]*title="[^"]*提醒时间：[^\"]*09:00/, 'The whole card tooltip keeps the time available when the badge shrinks');
    assert.match(html, /data-task-id="task-a"/, 'The surviving card still controls the original task');
}
const multipleTimes = { ...taskReminder, id: 'another-reminder', extendedProps: { ...taskReminder.extendedProps, __tmReminderTimes: ['18:30', '09:00'] } };
const combined = context.renderList({}, [multipleTimes, due, taskReminder], {});
assert.deepEqual(renderIds([multipleTimes, due, taskReminder]), ['due-a']);
assert.match(combined, />⏰ 09:00、18:30<\/span>/, 'Reminder times are combined and sorted without duplicates');
assert.equal(due.extendedProps.__tmMergedReminderLabel, undefined, 'List merging must not mutate the source task');
const changedReminder = { ...taskReminder, extendedProps: { ...taskReminder.extendedProps, __tmReminderTimes: ['20:15'] } };
assert.match(context.renderList({}, [changedReminder, due], {}), />⏰ 20:15<\/span>/, 'Re-rendering shows the latest reminder time');
assert.doesNotMatch(context.renderList({}, [due], {}), /tm-proto-reminder-time/, 'Removed or moved reminders must not leave stale labels');

const taskSnapshots = new Map([
    ['task-a', { id: 'task-a', taskMarker: '-', done: false }],
    ['task-b', { id: 'task-b', taskMarker: '/', done: false }],
]);
context.getCalendarTaskSnapshotById = (id) => taskSnapshots.get(id) || null;
context.__tmCalendarKanbanCardHelpers = { isCanceled: (task) => task.taskMarker === '-' };
for (const events of [[due], [taskReminder], [scheduled], [spanDue], [yesterdayDue, yesterdayReminder]]) {
    assert.deepEqual(renderIds(events), [], 'Canceled tasks must be hidden from every calendar list section');
    assert.doesNotMatch(context.renderList({}, events, {}), /1 项安排/, 'Canceled entries must not contribute to the arrangement count');
}
assert.deepEqual(renderIds([due, otherDue, early, holiday]), ['due-b', 'holiday', 'early'], 'In-progress tasks and unrelated events remain visible');
assert.deepEqual(Array.from(context.taskChildren({ id: 'parent', children: [
    { id: 'task-a', taskMarker: ' ' }, { id: 'task-b', taskMarker: '-' },
]}), (task) => task.id), ['task-b'], 'Subtasks must use their latest status and hide cancellation');
taskSnapshots.set('task-a', { id: 'task-a', taskMarker: ' ', done: false });
assert.deepEqual(renderIds([due]), ['due-a'], 'Reopened tasks must reappear');
taskSnapshots.set('task-a', { id: 'task-a', taskMarker: 'X', done: true });
assert.deepEqual(renderIds([due]), ['due-a'], 'Successful completion is not cancellation');
console.log('calendar list task order and dedupe tests passed');
