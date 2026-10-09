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
    ...['isIndependentScheduleEventExt', 'resolveSharedPrototypeEventStart', 'resolveSharedPrototypeEventEnd', 'mergeCalendarAllDayReminders', 'buildCalendarMergedReminderMarkup'].map(readFunction),
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
const independentSchedules = ['independent-a', 'independent-b', 'independent-c'].map(id => {
    const schedule = event(id, 'task-a', 'schedule');
    schedule.extendedProps.__tmScheduleCompletionIndependent = true;
    return schedule;
});
assert.deepEqual(renderIds(independentSchedules), ['independent-a', 'independent-b', 'independent-c'], 'Independent all-day schedules keep separate identities');
assert.doesNotMatch(context.renderList({}, independentSchedules, {}), /tm-proto-list-task-card|onchange="tmSetDone/, 'Independent schedules must use event controls rather than task card controls');
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

// Reproduce the logged case: two missed occurrences plus today's occurrence
// share a task identity, but have different calendar event IDs.
for (const sourceType of ['reminder', 'taskdate', 'schedule']) {
    const occurrences = [-5, -1, 0].map((offset) => {
        const start = addDays(day, offset);
        const occurrence = event(`${sourceType}:repeat:${dateKey(start)}`, 'repeat-task', sourceType);
        occurrence.start = start;
        occurrence.end = addDays(start, 1);
        if (sourceType === 'reminder') {
            occurrence.extendedProps.__tmReminderDate = dateKey(start);
            occurrence.extendedProps.__tmReminderRecord = { interval: 'weekly' };
        }
        else occurrence.extendedProps.__tmRepeatType = 'weekly';
        return occurrence;
    });
    const [oldest, latest, current] = occurrences;
    assert.deepEqual(renderIds(occurrences), [current.id], `${sourceType}: today's task must suppress both expired copies`);
    assert.deepEqual(renderIds([latest, oldest]), [latest.id], `${sourceType}: yesterday's missed occurrence appears once when there is no task today`);
    assert.deepEqual(renderIds([oldest, latest]), [latest.id], 'Expired selection must not depend on input order');
    assert.match(context.renderList({}, [latest], {}), /tm-proto-list-row--expired/, 'Yesterday\'s missed recurring occurrence belongs to the expired group');
    current.extendedProps.done = true;
    assert.deepEqual(renderIds(occurrences), [current.id], 'Completing today must not bring historical copies back into the expired group');
    assert.deepEqual(renderIds([...occurrences, yesterdayDue]), ['due-a', current.id], 'Other overdue tasks remain visible');
    context.protoListVisibleDays = () => [oldest.start];
    assert.deepEqual(renderIds(occurrences), [oldest.id], 'Browsing a past day preserves its occurrence');
    context.protoListVisibleDays = () => [day];
}
const checkins = [-5, -2, 0].map((offset) => {
    const start = addDays(day, offset);
    return { ...event(`checkin:habit:${dateKey(start)}`, 'habit'), start, end: addDays(start, 1),
        extendedProps: { __tmSource: 'taskdate', __tmTaskId: 'habit', __tmCheckin: true, __tmCheckinDate: dateKey(start) } };
});
assert.deepEqual(renderIds(checkins), [checkins[2].id], 'Check-in occurrences use the same task deduplication rule');
assert.deepEqual(renderIds(checkins.slice(0, 2)), [checkins[1].id], 'The latest missed check-in appears once when there is no occurrence today');
const followedReminder = { ...yesterdayReminder, extendedProps: { ...yesterdayReminder.extendedProps,
    __tmReminderRecord: { repeatMode: 'followTaskRepeat', interval: 'once', taskRepeatRule: { enabled: true, type: 'weekly' } } } };
assert.deepEqual(renderIds([followedReminder]), [followedReminder.id], 'A missed reminder following a recurring task appears in the expired group');
assert.deepEqual(renderIds([yesterdayReminder]), [yesterdayReminder.id], 'A one-off overdue reminder remains visible');
assert.deepEqual(renderIds([yesterdayDue, scheduled, secondSchedule]), ['scheduled-a', 'second-scheduled-a'], 'Distinct timed schedule slots stay visible while suppressing the overdue task');

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
