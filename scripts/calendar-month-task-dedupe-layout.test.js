'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'calendar-view.js'), 'utf8');
const extract = (startMarker, endMarker) => {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    assert.ok(start >= 0 && end > start, `${startMarker} must remain inspectable`);
    return source.slice(start, end);
};
const context = {
    Date,
    Map,
    Set,
    formatDateKey: (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    parseDateOnly: (value) => new Date(`${String(value).slice(0, 10)}T00:00:00`),
    toMs: (value) => new Date(value).getTime(),
    isScheduleAllDayBottom: (event) => event.__tmAllDayBottom === true,
};
const readFunction = (sourceText, name, functionContext) => {
    const start = sourceText.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `${name} must remain inspectable`);
    const signatureEnd = sourceText.indexOf(') {', start);
    const bodyStart = signatureEnd >= 0 ? signatureEnd + 2 : sourceText.indexOf('{', start);
    let depth = 0;
    for (let index = bodyStart; index < sourceText.length; index += 1) {
        if (sourceText[index] === '{') depth += 1;
        if (sourceText[index] === '}') depth -= 1;
        if (depth === 0) return vm.runInNewContext(`(${sourceText.slice(start, index + 1)})`, functionContext);
    }
    assert.fail(`${name} must have a complete function body`);
};
const visibilityContext = {
    resolveCalendarEventDoneState: (ext) => ext?.done === true,
};
const shouldHideCompleted = readFunction(source, 'shouldHideCompletedAllDayCalendarEvent', visibilityContext);
assert.equal(shouldHideCompleted({ allDay: false, extendedProps: { done: true } }, { showCompletedAllDaySchedules: false }, { viewType: 'dayGridMonth' }), false,
    'completed timed schedules must remain visible in the month side-day timeline');
assert.equal(shouldHideCompleted({ allDay: true, extendedProps: { done: true } }, { showCompletedAllDaySchedules: false }, { viewType: 'timeGridDay' }), true,
    'completed all-day schedules must still follow the all-day visibility setting');
assert.equal(shouldHideCompleted({ allDay: false, extendedProps: { done: true } }, { showCompletedAllDaySchedules: false }, { viewType: 'timeGridDay' }), false,
    'completed timed schedules must remain visible in the normal day timeline');
const dedupeStart = source.indexOf('    function dedupeMonthScheduleEvents(');
const dedupeEnd = source.indexOf('\n    function __tmGetCalendarVisibleRange', dedupeStart);
assert.ok(dedupeStart >= 0 && dedupeEnd > dedupeStart, 'month schedule dedupe helper must remain inspectable');
vm.runInNewContext(`${source.slice(dedupeStart, dedupeEnd)}\nglobalThis.dedupe = dedupeMonthScheduleEvents;`, context);

const dayKey = '2026-09-08';
const sameTaskSchedules = [
    ['schedule-1', '11:15', '11:45'],
    ['schedule-2', '13:30', '14:30'],
    ['schedule-3', '14:45', '15:30'],
    ['schedule-4', '16:00', '17:00'],
].map(([scheduleId, start, end]) => ({
    id: scheduleId,
    start: new Date(`${dayKey}T${start}:00`),
    end: new Date(`${dayKey}T${end}:00`),
    extendedProps: { __tmScheduleId: scheduleId, __tmTaskId: 'same-task' },
}));
const duplicateSchedule = { ...sameTaskSchedules[0], id: 'duplicate-source-row' };
duplicateSchedule.extendedProps = { ...sameTaskSchedules[0].extendedProps };
assert.equal(context.dedupe([...sameTaskSchedules, duplicateSchedule]).length, 4,
    'month dedupe must preserve multiple independent schedules for one task on one day');
assert.equal(context.dedupe([sameTaskSchedules[0], sameTaskSchedules[0]]).length, 1,
    'month dedupe may remove the same schedule occurrence returned twice');
assert.match(source, /const projected = isCalendarMonthViewType\(viewType\) \? dedupeMonthScheduleEvents\(events\) : events/,
    'schedule dedupe must remain limited to month-view source projection');

vm.runInNewContext([
    extract('    function mergeCalendarAllDayReminders(', '    function buildCalendarMergedReminderMarkup('),
    extract('    function resolveSharedPrototypeEventStart(', '    function buildSharedPrototypeLunarText('),
    extract('    function resolveSharedPrototypeEventEnd(', '    function resolveSharedPrototypeEventStart('),
    extract('        const protoSafeDate =', '        const protoTimeMinutes ='),
    extract('        const protoEventSource =', '        const protoEventTime ='),
    extract('        const protoEventIsAllDayBottom =', '        const protoLunarText ='),
    extract('        const protoRangeEvents =', '        const protoSpanMarkup ='),
    extract('            const protoMonthSpanLayout =', '        const protoRenderMonthSection ='),
    'globalThis.buildLayout = protoBuildMonthCompactedLayout;',
].join('\n'), context);

const days = Array.from({ length: 7 }, (_, index) => new Date(2026, 8, 7 + index));
const timedEvents = [
    ['11:15', '11:45'],
    ['13:30', '14:30'],
    ['14:45', '15:30'],
    ['16:00', '17:00'],
].map(([start, end], index) => ({
    id: `schedule-${index + 1}`,
    title: `Schedule ${index + 1}`,
    allDay: false,
    start: new Date(`${dayKey}T${start}:00`),
    end: new Date(`${dayKey}T${end}:00`),
    extendedProps: { __tmSource: 'schedule', __tmTaskId: `task-${index + 1}` },
}));
const taskEvents = timedEvents.slice(0, 3).map((event, index) => ({
    id: `taskdate:task-${index + 1}`,
    title: event.title,
    allDay: true,
    start: new Date(`${dayKey}T00:00:00`),
    end: new Date('2026-09-09T00:00:00'),
    extendedProps: {
        __tmSource: 'taskdate',
        __tmTaskId: `task-${index + 1}`,
        __tmScheduledTaskDayKeys: [dayKey],
        __tmTaskDateScheduleSplit: true,
    },
}));
const events = [...taskEvents, ...timedEvents];
const originalEvents = JSON.stringify(events);
const visibleIds = (layout, dayIndex = 1) => Array.from(layout.visibleRegularByDay.get(dayIndex), (event) => event.id);
const buildLayout = (items, capacity, options = {}) => context.buildLayout(days, items, {
    defaultCapacity: capacity,
    spanLimit: 8,
    ...options,
});

for (const capacity of [4, 3, 8, 2, 1, 0]) {
    const layout = buildLayout(events, capacity);
    const visibleCount = capacity >= timedEvents.length ? timedEvents.length : Math.max(0, capacity - 1);
    assert.deepEqual(visibleIds(layout), timedEvents.slice(0, visibleCount).map((event) => event.id),
        `capacity ${capacity}: deduplicated all-day tasks must not displace timed schedules`);
    assert.equal(layout.moreByDay.get(1), timedEvents.length - visibleCount,
        `capacity ${capacity}: +N must count only genuine overflow, not deduplicated tasks`);
}
assert.equal(JSON.stringify(events), originalEvents, 'month compaction must preserve event data for other calendar views');

const measured = buildLayout(events, 8, { capacityByDay: new Map([[dayKey, 3]]) });
assert.deepEqual(visibleIds(measured), ['schedule-1', 'schedule-2'], 'measured cell capacity must also apply after deduplication');
assert.equal(measured.moreByDay.get(1), 2);

const allDeduplicated = buildLayout(taskEvents, 1);
assert.deepEqual(visibleIds(allDeduplicated), [], 'deduplicated tasks must not leave invisible rows');
assert.equal(allDeduplicated.moreByDay.get(1), 0, 'deduplicated tasks alone must not produce an empty +N popover');

const unblockedTasks = taskEvents.map((event) => ({
    ...event,
    extendedProps: { ...event.extendedProps, __tmScheduledTaskDayKeys: [] },
}));
const unblocked = buildLayout([...unblockedTasks, ...timedEvents], 4);
assert.deepEqual(visibleIds(unblocked), unblockedTasks.map((event) => event.id), 'tasks not marked for deduplication must keep their normal priority');
assert.equal(unblocked.moreByDay.get(1), 4);

const otherDayTask = {
    ...taskEvents[0],
    extendedProps: { ...taskEvents[0].extendedProps, __tmScheduledTaskDayKeys: ['2026-09-09'] },
};
const otherDay = buildLayout([otherDayTask], 1);
assert.deepEqual(visibleIds(otherDay), [otherDayTask.id], 'a scheduled day must not suppress a different date');
assert.equal(otherDay.moreByDay.get(1), 0);

const independentAllDay = {
    ...taskEvents[0],
    id: 'independent-all-day',
    extendedProps: { ...taskEvents[0].extendedProps, __tmSource: 'schedule' },
};
const independent = buildLayout([independentAllDay, ...events], 3);
assert.deepEqual(visibleIds(independent), [independentAllDay.id, 'schedule-1'], 'independent all-day schedules must retain their row and priority');
assert.equal(independent.moreByDay.get(1), 3);

const spanningTask = {
    ...taskEvents[0],
    start: new Date('2026-09-07T00:00:00'),
    end: new Date('2026-09-10T00:00:00'),
    extendedProps: { ...taskEvents[0].extendedProps },
};
const spanning = buildLayout([spanningTask, ...timedEvents], 3);
assert.equal(spanning.spanLayout.byDay.get(0).length, 1, 'cross-day task bars must remain on preceding unscheduled days');
assert.equal(spanning.spanLayout.byDay.get(2).length, 1, 'cross-day task bars must remain on following unscheduled days');
assert.equal(spanning.spanLayout.reserves.get(1) || 0, 0, 'a scheduled day must not reserve space for its deduplicated span');
assert.deepEqual(visibleIds(spanning), ['schedule-1', 'schedule-2']);
assert.equal(spanning.moreByDay.get(1), 2);

const crossDayTimedTask = {
    ...spanningTask,
    allDay: false,
    start: new Date('2026-09-07T11:00:00'),
    end: new Date('2026-09-10T10:00:00'),
};
const crossDayTimed = buildLayout([crossDayTimedTask, timedEvents[0]], 4, {
    capacityByDay: new Map([['2026-09-07', 0]]),
});
assert.equal(crossDayTimed.moreByDay.get(0), 1, 'a genuinely full day must still count its overflow');
assert.equal(crossDayTimed.moreByDay.get(2), 0, 'one full day must not fold a cross-day timed event on another day');
assert.deepEqual(visibleIds(crossDayTimed, 2), [crossDayTimedTask.id]);
assert.deepEqual(visibleIds(crossDayTimed), ['schedule-1']);
assert.equal(crossDayTimed.moreByDay.get(1), 0, 'local folding must not reintroduce a deduplicated day into +N');

const fullWeekSpan = {
    id: 'full-week-span',
    title: 'Full week',
    allDay: true,
    start: days[0],
    end: new Date('2026-09-14T00:00:00'),
    extendedProps: { __tmSource: 'schedule' },
};
const interrupted = buildLayout([fullWeekSpan], 8, {
    capacityByDay: new Map([[dayKey, 0]]),
});
assert.equal(interrupted.moreByDay.get(0), 0, 'available preceding days must retain the span');
assert.equal(interrupted.moreByDay.get(1), 1, 'only the unavailable day must fold');
assert.equal(interrupted.moreByDay.get(2), 0, 'available following days must retain the span');
assert.equal(interrupted.spanLayout.byDay.get(0)?.[0]?.days, 1);
assert.equal(interrupted.spanLayout.byDay.get(2)?.[0]?.days, 5, 'the remaining contiguous days must stay joined');
assert.equal(interrupted.spanLayout.byDay.get(2)?.[0]?.eventApi, fullWeekSpan, 'fragments must reference the real event without changing its dates');

const continuous = buildLayout([fullWeekSpan, ...timedEvents], 8);
assert.equal(continuous.spanLayout.starts.size, 1, 'a span that fits must remain one uninterrupted strip');
assert.equal(continuous.spanLayout.byDay.get(1)[0].days, 7);
assert.equal(continuous.moreByDay.get(1), 0);
assert.deepEqual(visibleIds(continuous), timedEvents.map((event) => event.id));

const crowdedSpans = Array.from({ length: 5 }, (_, index) => ({ ...fullWeekSpan, id: `crowded-${index}` }));
const refilled = buildLayout([...crowdedSpans, ...timedEvents], 8, {
    capacityByDay: new Map([['2026-09-09', 2]]),
});
assert.equal(refilled.spanLayout.byDay.get(1).length, 5, 'a compact neighboring date must not remove available span rows');
assert.deepEqual(visibleIds(refilled), timedEvents.slice(0, 2).map((event) => event.id));
assert.equal(refilled.moreByDay.get(1), 2, 'eight slots must hold five spans, two timed events and the overflow row');
assert.equal(refilled.spanLayout.byDay.get(2).length, 1);
assert.equal(refilled.moreByDay.get(2), 4);

const timedCrossWeek = { ...fullWeekSpan, id: 'timed-cross-week', allDay: false };
const independentDays = buildLayout([timedCrossWeek, ...timedEvents], 8, {
    capacityByDay: new Map([['2026-09-09', 0]]),
});
assert.equal(independentDays.moreByDay.get(1), 0);
assert.equal(visibleIds(independentDays).length, 5, 'spare cells must display all five events despite another day being full');
assert.equal(independentDays.moreByDay.get(2), 1);

const reminderTasks = ['工时登记', '周报更新', '泵拆解报告 NP'].map((title, index) => ({
    id: `taskdate:reminder-task-${index}`, title, allDay: true,
    start: days[1], end: days[2],
    extendedProps: { __tmSource: 'taskdate', __tmTaskId: `reminder-task-${index}` },
}));
const reminders = ['16:00', '09:00'].map((time, index) => ({
    id: `reminder:${index}`, title: `⏰ ${reminderTasks[index].title} (${time})`, allDay: true,
    start: days[1], end: days[2],
    extendedProps: { __tmSource: 'reminder', __tmTaskId: `reminder-task-${index}`, __tmReminderDate: dayKey, __tmReminderTimes: [time] },
}));
const reminderEvents = [...reminderTasks, ...reminders];
const mergedLayout = buildLayout(reminderEvents, 3);
assert.deepEqual(visibleIds(mergedLayout).sort(), reminderTasks.map((event) => event.id).sort(), 'Month cells must merge before choosing visible rows');
assert.equal(mergedLayout.moreByDay.get(1), 0, 'Five source events become three cards and must fit three rows');
assert.equal(buildLayout(reminderEvents, 2).moreByDay.get(1), 2, 'A two-row cell shows one card plus two hidden cards, not four');
assert.equal(mergedLayout.visibleRegularByDay.get(1).find((event) => event.id === reminderTasks[0].id).extendedProps.__tmMergedReminderLabel, '16:00');
assert.equal(reminderTasks[0].extendedProps.__tmMergedReminderLabel, undefined, 'Month rendering must not alter the task store');
const spanWithReminder = { ...reminderTasks[0], start: days[0], end: days[3], extendedProps: { ...reminderTasks[0].extendedProps } };
const mergedSpan = buildLayout([spanWithReminder, reminders[0]], 3);
assert.equal(mergedSpan.spanLayout.byDay.get(1)[0].eventApi.extendedProps.__tmMergedReminderLabel, '09-08 16:00');
assert.equal(mergedSpan.visibleRegularByDay.get(1).length, 0);
const sameTaskSchedule = { ...timedEvents[0], extendedProps: { __tmSource: 'schedule', __tmTaskId: 'reminder-task-0' } };
const hiddenSpan = buildLayout([spanWithReminder, reminders[0], sameTaskSchedule], 4);
assert.ok(visibleIds(hiddenSpan).includes(reminders[0].id), 'A reminder must remain visible when its task span is suppressed by a schedule that day');
const hiddenTask = { ...reminderTasks[0], extendedProps: { ...reminderTasks[0].extendedProps, __tmScheduledTaskDayKeys: [dayKey] } };
assert.ok(visibleIds(buildLayout([hiddenTask, reminders[0]], 4)).includes(reminders[0].id), 'A hidden task-date card must not swallow its reminder');

// Exercise both real month markup paths, including their shared row budget.
Object.assign(context, {
    state: {}, calendar: {},
    esc: (value) => String(value), pad2: (value) => String(value).padStart(2, '0'),
    getCalendarEventColor: () => '#527acc', resolveCalendarEventDoneState: () => false,
    shouldShowCalendarEventCheckbox: () => true, isCalendarBuiltinScheduleEvent: () => false,
    buildCalendarRecurringTaskIconMarkup: () => '<i data-recurring="true"></i>',
    getPrototypeMonthWeekDate: () => days[0], getPrototypeMonthFixedCapacity: () => 3,
    prototypeMonthVirtualEvents: reminderEvents, getSettings: () => ({ monthMinVisibleEvents: 3 }),
    protoHolidayInfo: () => ({}), protoDayNumberMarkup: (date) => String(date.getDate()),
    protoMonthHolidayMarkup: (title) => title, protoSpanMarkup: () => '',
    isCompactDockLayout: () => true, getPrototypeMonthRowHeight: () => 120,
    getPrototypeMonthRangeKey: () => '2026-09',
    prototypeSurface: { style: { getPropertyValue: () => '' }, querySelector: () => null },
    normalizeCalendarMonthMinVisibleEvents: (value) => value,
    PROTO_MONTH_EVENT_PITCH: 22, prototypeMonthCapacityByDay: new Map(),
    prototypeMonthMeasurementReady: false, prototypeMonthLastCommittedSpanLanes: null,
    protoWeekLabels: ['日', '一', '二', '三', '四', '五', '六'],
});
vm.runInNewContext([
    extract('    function buildCalendarMergedReminderMarkup(', '    function resolveSharedPrototypeEventEnd('),
    extract('        const protoRenderMonthSection =', '        const protoRenderMonth ='),
    extract('        const buildPrototypeMonthWeekRowMarkup =', '        // One bounded background retry'),
    'globalThis.renderCompactMonth = protoRenderMonthSection; globalThis.renderWeekRow = buildPrototypeMonthWeekRowMarkup;',
].join('\n'), context);
context.protoEventMarkup = (event, mode, includeTime, extraClass) => context.buildSharedPrototypeEventMarkup(event, mode, includeTime, extraClass, {}, { viewType: 'dayGridMonth' });
const monthView = { currentStart: new Date(2026, 8, 1), currentEnd: new Date(2026, 9, 1) };
const desktopMarkup = context.renderWeekRow({ rowHeight: 120 }, 0);
const compactMarkup = context.renderCompactMonth(monthView, reminderEvents, { monthMinVisibleEvents: 3 });
for (const markup of [desktopMarkup, compactMarkup]) {
    assert.equal((markup.match(/data-tm-proto-event=/g) || []).length, 3, 'The actual grid must render one card per task');
    assert.ok(markup.includes('⏰ 16:00') && markup.includes('⏰ 09:00'), `Reminder times must be visible in the grid itself: ${markup.match(/tm-proto-reminder-time[^<]+/g)}`);
    assert.ok(markup.includes('data-tm-proto-check="taskdate:reminder-task-0"'));
    assert.doesNotMatch(markup, /class="tm-proto-more"/, 'The grid must not count the merged reminder rows as overflow');
}
reminders[0].extendedProps.__tmReminderTimes = ['17:30'];
const changedMarkup = context.renderWeekRow({ rowHeight: 120 }, 0);
assert.ok(changedMarkup.includes('⏰ 17:30') && !changedMarkup.includes('⏰ 16:00'), 'Local month row rendering must use the latest reminder time');
reminders[0].start = days[2]; reminders[0].end = days[3];
reminders[0].extendedProps.__tmReminderDate = '2026-09-09';
const movedLayout = buildLayout(reminderEvents, 5);
assert.equal(movedLayout.visibleRegularByDay.get(1).find((event) => event.id === reminderTasks[0].id).extendedProps.__tmMergedReminderLabel, undefined);
assert.ok(visibleIds(movedLayout, 2).includes(reminders[0].id), 'Moving a reminder to another day removes the old merged badge and keeps its new card');

console.log('calendar month task dedupe layout tests passed');
