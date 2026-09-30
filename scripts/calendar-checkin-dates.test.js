'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const model = read('src/task-horizon/main/task-runtime/50-task-model-and-repeat-utils.js');
const detail = read('src/task-horizon/main/task-runtime/52-task-detail-runtime.js');
const recurring = read('src/task-horizon/main/task-runtime/54-recurring-task-runtime.js');
const support = read('src/task-horizon/main/render/48-render-calendar-support-runtime.js');
const calendar = read('calendar-view.js');
function extract(source, name) {
    const start = source.indexOf(`    function ${name}(`);
    assert.ok(start >= 0, name);
    return source.slice(start, source.indexOf('\n    }', start) + 6);
}
const dateKey = value => value instanceof Date
    ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
    : String(value || '').match(/^\d{4}-\d{2}-\d{2}/)?.[0] || '';
const shiftDateKey = (key, days) => {
    const date = new Date(`${key}T12:00:00`);
    date.setDate(date.getDate() + days);
    return dateKey(date);
};
function createContext(today = '2026-10-10') {
    class Clock extends Date {
        constructor(...args) { super(...(args.length ? args : [`${today}T12:00:00`])); }
        static now() { return new Clock().getTime(); }
        static [Symbol.hasInstance](value) { return value instanceof Date; }
    }
    const context = vm.createContext({
        Date: Clock, Intl, Math, Number, String, JSON, Set, Map, Array, Object,
        setToday: value => { today = value; }, formatDateKey: dateKey,
        __tmNormalizeDateOnly: dateKey,
        __tmIsCalendarTaskPendingDeletedSync: () => false,
        __tmResolveCalendarTaskDisplayTitle: task => task.content,
        __tmReadTaskMetaAttrValue: () => '',
        __tmGetCalendarDocsToGroupMapSync: () => new Map(),
        startKey: '2026-09-28', endKey: '2026-10-10', nextDay: key => shiftDateKey(key, 1),
        getCalendarDefs: () => [], getCalendarTaskSnapshotById: () => null,
        isScheduleAllDayBottom: () => false, isCalendarEnabled: () => true,
        isCalendarDocVisibleForEvent: () => true, readCalendarConfiguredTaskMetaAttrValue: () => '',
        shiftDateKey, isCalendarMonthViewType: type => type === 'dayGridMonth',
        resolveCalendarEventDoneState: ext => ext?.__tmTaskDone === true,
    });
    context.globalThis = context;
    context.window = context;
    const modelStart = model.indexOf('function __tmParseTaskRepeatJson');
    const modelEnd = model.indexOf('function __tmGetTaskRepeatWeekdayLabel', modelStart);
    const builderStart = support.indexOf('        const buildTaskDateEventsFromTasks =');
    const builderEnd = support.indexOf('\n        };', builderStart) + 11;
    assert.ok(builderStart >= 0 && builderEnd > builderStart);
    vm.runInContext([
        model.slice(modelStart, modelEnd),
        extract(recurring, '__tmGetTaskRepeatRule'),
        extract(model, '__tmCollectTaskRepeatPreviewDates'),
        extract(detail, '__tmGetTaskTimeHubRepeatDates'),
        extract(support, '__tmGetCalendarTaskDateIndex'),
        extract(support, '__tmGetCalendarTaskDateCandidates'),
        extract(support, '__tmBuildCalendarCheckinTaskDateEvents'),
        'window.tmBuildCalendarCheckinTaskDateEvents = __tmBuildCalendarCheckinTaskDateEvents;',
        support.slice(builderStart, builderEnd),
        extract(calendar, 'resolveTaskDateDisplayRange'),
        extract(calendar, 'shouldHideCompletedAllDayCalendarEvent'),
        extract(calendar, 'buildEventsFromTaskDates'),
        extract(calendar, '__tmCalendarTaskDateEventMatchesTaskIds'),
        extract(calendar, '__tmDedupeTaskDateEventsInCalendar'),
        extract(calendar, 'applyPendingTaskDateEventPatches'),
        extract(calendar, 'syncTaskDateEventFromDateFollowPatch'),
        'this.projectTaskDates = buildTaskDateEventsFromTasks;',
    ].join('\n'), context);
    return context;
}
const task = {
    id: 'habit-1', content: '周一三五打卡', root_id: 'doc-1', startDate: '', completionTime: '',
    repeatRule: { enabled: true, trigger: 'checkin', type: 'weekly', every: 1, weekdays: [1, 3, 5], anchorDate: '2026-09-28' },
    repeatState: { checkinHistory: [{ scheduledDate: '2026-09-30', checkedAt: '2026-09-30T09:00:00+08:00' }] },
};
const plannedDays = ['2026-09-28', '2026-09-30', '2026-10-02', '2026-10-05', '2026-10-07', '2026-10-09'];

test('weekly check-in expands every selected weekday without task start/due dates', () => {
    const context = createContext();
    const candidates = context.__tmGetCalendarTaskDateCandidates([task], new Date('2026-09-28T12:00:00').getTime(), new Date('2026-10-10T12:00:00').getTime());
    const dates = context.projectTaskDates(candidates.tasks);
    assert.deepEqual(Array.from(dates, item => item.start), plannedDays);
    const events = context.buildEventsFromTaskDates(dates, { showTaskDates: true, showCompletedAllDaySchedules: false }, { viewType: 'dayGridMonth' });
    assert.deepEqual(Array.from(events, item => item.start), plannedDays);
    assert.equal(new Set(events.map(item => item.id)).size, plannedDays.length);
    assert.deepEqual(Array.from(events, item => item.id), plannedDays.map(day => `checkin:${task.id}:${day}`));
    assert.equal(events[1].extendedProps.__tmTaskDone, true);
    assert.equal(events[1].extendedProps.__tmTaskId, task.id);
});

test('calendar hides future check-ins, keeps history and reveals each date when it arrives', () => {
    const context = createContext('2026-09-30');
    const extraTask = { ...task, repeatState: { checkinHistory: [
        ...task.repeatState.checkinHistory,
        { scheduledDate: '2026-09-29', checkedAt: '2026-09-29T12:00:00+08:00' },
    ] } };
    const dates = context.projectTaskDates([extraTask]);
    assert.ok(dates.some(item => item.start === '2026-10-09'), 'future plans must remain available to reminder queries');
    assert.deepEqual(Array.from(context.__tmGetTaskTimeHubRepeatDates(extraTask, {}, '2026-10-10', '2026-09-28')), plannedDays);
    for (const viewType of ['dayGridMonth', 'timeGridWeek', 'timeGridDay']) {
        const events = context.buildEventsFromTaskDates(dates, { showTaskDates: true, showCompletedAllDaySchedules: false }, { viewType });
        assert.deepEqual(Array.from(events, item => item.start), ['2026-09-28', '2026-09-29', '2026-09-30']);
        assert.equal(events[1].extendedProps.__tmTaskDone, true, 'extra check-ins keep their own calendar date');
    }
    context.setToday('2026-10-02');
    const arrived = context.buildEventsFromTaskDates(dates, { showTaskDates: true });
    assert.deepEqual(Array.from(arrived, item => item.start), ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-02']);
    assert.equal(arrived.at(-1).extendedProps.__tmTaskDateReadOnly, false, 'cached future plans become writable on their date');
    assert.equal(arrived.at(-1).extendedProps.__tmCheckinFuture, false);
    const ordinary = context.buildEventsFromTaskDates([{ id: 'ordinary', start: '2026-10-09', endExclusive: '2026-10-10' }], { showTaskDates: true });
    assert.equal(ordinary.length, 1, 'ordinary future tasks remain visible');
});

test('date picker marks all scheduled dates in the visible month, including the anchor and past days', () => {
    const context = createContext();
    const before = JSON.stringify(task);
    const dates = context.__tmGetTaskTimeHubRepeatDates(task, {}, '2026-10-10', '2026-09-28');
    assert.deepEqual(Array.from(dates), plannedDays);
    assert.equal(JSON.stringify(task), before, 'preview must not advance dates or completion state');
    const oldTask = { ...task, repeatRule: { ...task.repeatRule, anchorDate: '2020-01-01' } };
    assert.deepEqual(Array.from(context.__tmGetTaskTimeHubRepeatDates(oldTask, {}, '2026-10-10', '2026-09-28')), plannedDays);
    assert.deepEqual(Array.from(context.__tmGetTaskTimeHubRepeatDates(task, {}, '2026-09-25', '2026-09-01')), []);
});

test('upcoming check-in preview uses selected weekdays and respects count limits', () => {
    const context = createContext();
    assert.deepEqual(Array.from(context.__tmCollectTaskRepeatPreviewDates(task, { fromDateKey: '2026-09-30', limit: 4 })), ['2026-09-30', '2026-10-02', '2026-10-05', '2026-10-07']);
    const limited = { ...task, repeatRule: { ...task.repeatRule, maxOccurrences: 3 } };
    assert.deepEqual(Array.from(context.__tmGetTaskTimeHubRepeatDates(limited, {}, '2026-10-10', '2026-09-28')), plannedDays.slice(0, 3));
});

test('source-load deduplication preserves every planned day and removes only actual duplicates', () => {
    const context = createContext();
    vm.runInContext(read('src/calendar/calendar-date.js') + '\n' + read('src/calendar/calendar-store.js'), context);
    const store = context.__tmCalendarStore.createCalendarStore();
    Object.assign(context, {
        getCalendarEvents: () => store.getEvents(),
        __tmBeginCalendarLocalEventMutation: () => {},
        __tmEndCalendarLocalEventMutation: () => {},
        __tmSyncCalendarUiAfterDirectEventMutation: () => {},
    });
    for (const [start, end, expected] of [
        ['2026-09-28', '2026-10-04', ['2026-09-30', '2026-10-02']],
        ['2026-10-05', '2026-10-11', ['2026-10-05', '2026-10-07', '2026-10-09']],
    ]) {
        const input = context.tmBuildCalendarCheckinTaskDateEvents({ ...task, repeatRule: { ...task.repeatRule, anchorDate: '2026-09-30' } }, start, end);
        const projected = context.buildEventsFromTaskDates(input, { showTaskDates: true }, { viewType: 'timeGridWeek' });
        const ordinary = { id: 'taskdate:ordinary', allDay: true, start, end, extendedProps: { __tmSource: 'taskdate', __tmTaskId: 'ordinary' } };
        store.setSourceEvents('task-dates', [...projected, ordinary]);
        store.setSourceEvents('manual', [
            { ...projected[0], id: 'duplicate-checkin' },
            { ...ordinary, id: 'duplicate-ordinary' },
        ]);
        context.__tmDedupeTaskDateEventsInCalendar(store, 'task-dates');
        assert.deepEqual(Array.from(store.getEvents().filter(event => event.extendedProps.__tmCheckin), event => event.extendedProps.__tmCheckinDate), expected);
        assert.equal(store.getEvents().length, expected.length + 1);
        assert.equal(context.__tmDedupeTaskDateEventsInCalendar(store, 'task-dates').removed, 0);
    }
});

test('pending task start/due patches cannot move independent check-in occurrences', () => {
    const context = createContext();
    const events = context.buildEventsFromTaskDates(context.projectTaskDates([task]), { showTaskDates: true });
    Object.assign(context, {
        state: { pendingTaskDateEventPatches: new Map([[task.id, { startDate: '2026-10-05', completionTime: '2026-10-05', updatedAt: Date.now() }]]) },
        CALENDAR_PENDING_TASK_DATE_PATCH_TTL_MS: 10000,
        parseDateOnly: value => new Date(value + 'T00:00:00'),
        copyTaskDateQueryMetadata: (source, result) => result,
    });
    const projected = context.applyPendingTaskDateEventPatches(events, 'main-task-date-source');
    assert.deepEqual(Array.from(projected, event => dateKey(event.start)), plannedDays);
});

test('local task updates retain every check-in occurrence instead of deleting all but Monday', () => {
    const context = createContext();
    const settings = { showTaskDates: true, showCompletedAllDaySchedules: false };
    const cal = { events: [] };
    const addEvent = input => {
        const event = { ...input, source: { id: 'task-dates' },
            remove() { cal.events = cal.events.filter(item => item !== event); },
        };
        cal.events.push(event);
        return event;
    };
    context.buildEventsFromTaskDates(context.projectTaskDates([task]), settings).forEach(addEvent);
    Object.assign(context, {
        state: { calendar: cal }, EVENT_SOURCE_IDS: { mainTaskDate: 'task-dates' },
        getSettings: () => settings, getCalendarTaskSnapshotById: () => task,
        getCalendarEvents: calendar => calendar.events,
        getCalendarView: () => ({ type: 'dayGridMonth' }),
        __tmGetCalendarVisibleRange: () => ({ start: new Date('2026-09-28T00:00:00'), end: new Date('2026-10-10T00:00:00') }),
        syncReminderDateFromTaskPatch: () => {},
        __tmBeginCalendarLocalEventMutation: () => '', __tmEndCalendarLocalEventMutation: () => {},
        queueTaskDateCalendarRender: () => {},
        getCalendarAdapter: () => ({ getEventSourceById: () => ({ id: 'task-dates' }), addEvent }),
        normalizeCalendarEngineEventInput: input => input,
        buildTaskDatePatchScheduleTaskDaySet: () => null,
        buildTaskDateEventFromDateFollowPatch: (id, patch, calendar, config, existing) => existing && ({ ...existing, title: patch.content }),
        __tmApplyTaskDateEventProps: (event, next) => Object.assign(event, next),
    });
    context.syncTaskDateEventFromDateFollowPatch(task.id, { content: '修改标题' });
    assert.deepEqual(cal.events.map(event => event.start).sort(), plannedDays);
    assert.ok(cal.events.every(event => event.title === '修改标题'));
    context.syncTaskDateEventFromDateFollowPatch(task.id, { startDate: '2026-10-01', completionTime: '2026-10-01' });
    assert.deepEqual(cal.events.map(event => event.start).sort(), plannedDays, 'editing task dates must not collapse the independent check-in schedule');
    context.syncTaskDateEventFromDateFollowPatch(task.id, { repeatState: { checkinHistory: [] } });
    assert.ok(cal.events.every(event => event.extendedProps.__tmTaskDone === false), 'undoing a day must update its calendar occurrence');
    context.syncTaskDateEventFromDateFollowPatch(task.id, { repeatRule: { ...task.repeatRule, weekdays: [5] } });
    assert.deepEqual(cal.events.map(event => event.start).sort(), ['2026-09-30', '2026-10-02', '2026-10-09'], 'rule edits must replace planned dates while keeping saved history');
    context.syncTaskDateEventFromDateFollowPatch(task.id, { repeatRule: { enabled: false, type: 'none' } });
    assert.equal(cal.events.length, 0, 'disabling recurrence without task dates removes planned events');
});

test('month layout keeps Monday, Wednesday and Friday in their own cells with a Wednesday anchor', () => {
    const context = createContext();
    Object.assign(context, {
        formatDateKey: dateKey, parseDateOnly: value => new Date(`${value}T00:00:00`),
        toMs: value => new Date(value).getTime(),
    });
    const segment = (startMarker, endMarker) => {
        const start = calendar.indexOf(startMarker);
        const end = calendar.indexOf(endMarker, start);
        assert.ok(start >= 0 && end > start, startMarker);
        return calendar.slice(start, end);
    };
    vm.runInContext([
        extract(calendar, 'isIndependentScheduleEventExt'),
        extract(calendar, 'mergeCalendarAllDayReminders'),
        extract(calendar, 'resolveSharedPrototypeEventStart'),
        extract(calendar, 'resolveSharedPrototypeEventEnd'),
        segment('        const protoSafeDate =', '        const protoTimeMinutes ='),
        segment('        const protoEventSource =', '        const protoEventTime ='),
        segment('        const protoEventIsAllDayBottom =', '        const protoLunarText ='),
        segment('        const protoRangeEvents =', '        const protoSpanMarkup ='),
        segment('            const protoMonthSpanLayout =', '        const protoRenderMonthSection ='),
        'this.buildMonthLayout = protoBuildMonthCompactedLayout;',
    ].join('\n'), context);
    const anchoredTask = { ...task, repeatRule: { ...task.repeatRule, anchorDate: '2026-09-30' } };
    const items = context.projectTaskDates([anchoredTask]);
    const input = context.buildEventsFromTaskDates(items, { showTaskDates: true }, { viewType: 'dayGridMonth' });
    vm.runInContext(read('src/calendar/calendar-date.js') + '\n' + read('src/calendar/calendar-store.js'), context);
    const store = context.__tmCalendarStore.createCalendarStore();
    Object.assign(context, {
        getCalendarEvents: () => store.getEvents(),
        __tmBeginCalendarLocalEventMutation: () => {},
        __tmEndCalendarLocalEventMutation: () => {},
        __tmSyncCalendarUiAfterDirectEventMutation: () => {},
    });
    store.setSourceEvents('task-dates', input);
    context.__tmDedupeTaskDateEventsInCalendar(store, 'task-dates');
    const events = store.getEvents();
    const days = Array.from({ length: 14 }, (_, i) => new Date(2026, 8, 28 + i));
    const layout = context.buildMonthLayout(days, events, { defaultCapacity: 4, spanLimit: 8 });
    const visibleDays = Array.from(layout.visibleRegularByDay)
        .filter(([, dayEvents]) => dayEvents.length > 0).map(([index]) => dateKey(days[index]));
    assert.deepEqual(visibleDays, plannedDays.slice(1));
});
