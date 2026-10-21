'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'calendar-view.js'), 'utf8');
const extract = name => {
    const match = source.match(new RegExp(`    (?:async )?function ${name}\\(`));
    assert.ok(match, name);
    return source.slice(match.index, source.indexOf('\n    }', match.index) + 6);
};
const between = (start, end) => {
    const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
    assert.ok(a >= 0 && b > a, start);
    return source.slice(a, b);
};
const taskId = '20260929090000-repeat';
let liveDone = false, advances = 0, writes = 0, failNext = false;
const painted = new Map();
const settings = { showCompletedAllDaySchedules: true };
const items = Array.from({ length: 5 }, (_, index) => ({
    id: `schedule-${index}`, taskId,
    start: `2026-09-29T${String(9 + index).padStart(2, '0')}:00:00`,
    end: `2026-09-29T${String(10 + index).padStart(2, '0')}:00:00`,
}));
let stored = JSON.stringify(items);
const events = items.map(item => ({
    id: item.id, allDay: false,
    extendedProps: {
        __tmSource: 'schedule', __tmScheduleId: item.id, __tmTaskId: taskId,
        __tmRepeatType: 'none', __tmLinkedTaskRecurring: true,
        __tmScheduleCompletionIndependent: false, __tmScheduleOccurrenceDone: false,
        __tmOccurrenceStartMs: Date.parse(item.start),
    },
}));
const context = vm.createContext({
    console, Date, Map, Set, Promise, HTMLElement: class {}, HTMLInputElement: class {},
    window: { tmIsTaskDone: () => liveDone },
    state: { calendar: { events }, sideDay: {} },
    getSettings: () => settings,
    normalizeScheduleRepeatType: value => value || 'none',
    normalizeScheduleCompletedOccurrenceKey: value => String(value || ''),
    getCalendarTaskSnapshotById: id => id === taskId ? { id, repeatRule: { enabled: true, type: 'daily' } } : null,
    findCalendarEventsByTaskId: (cal, id) => cal.events.filter(event => event.extendedProps.__tmTaskId === id),
    getCalendarView: () => ({ type: 'timeGridDay' }),
    isCalendarListViewType: () => false,
    applyRenderedEventDoneStateById: (id, done) => { painted.set(id, done); return true; },
    applyTaskDoneVisual() {}, queueTaskDateCalendarRender() {},
    collectCalendarsForTaskSync: () => [],
    loadScheduleAll: async () => JSON.parse(stored),
    getScheduleRepeatType: item => item.repeat || 'none',
    getScheduleLinkedTaskId: item => item.taskId,
    saveScheduleAll: async list => { stored = JSON.stringify(list); },
    scheduleCalendarRefresh() {},
});
vm.runInContext([
    between('    function isRecurringScheduleEventExt(', '    async function setCalendarReminderOccurrenceDone('),
    extract('isRecurringTaskDateReadOnlyOccurrence'), extract('isCalendarTaskRecurringSnapshot'),
    extract('shouldHideCompletedAllDayCalendarEvent'), extract('handleCalendarEventCheckboxToggle'),
    extract('isCalendarForegroundEvent'), extract('syncTaskDoneInPlace'), extract('withScheduleCompletionMutation'),
    extract('reassignScheduleLinkedTask'), extract('persistScheduleLinkedTaskCompletion'),
    extract('restoreTaskCompletion'), extract('persistRestoredTaskCompletion'),
].join('\n'), context);
const checked = () => events.map(event => context.resolveCalendarEventDoneState(event.extendedProps));

context.window.tmSetDone = async (id, done, event, options) => {
    assert.equal(id, taskId);
    assert.equal(done, true);
    writes++;
    if (failNext) { failNext = false; return false; }
    liveDone = true;
    context.syncTaskDoneInPlace(taskId, true, { flushTaskPanel: false });
    for (const item of events) {
        if (item.id !== options.scheduleId && !item.extendedProps.__tmVirtualTaskSchedule) {
            assert.equal(painted.get(item.id), false, 'completing one occurrence must not check its pending peers');
        }
    }
    advances++;
    // Existing recurrence completion reassigns only the clicked schedule to
    // its completed history instance. Use the production persistence helper.
    const historyId = `repeatinst:${taskId}:${advances}`;
    await context.reassignScheduleLinkedTask(options.scheduleId, historyId, { refetch: false });
    const clicked = events.find(item => item.id === options.scheduleId);
    Object.assign(clicked.extendedProps, { __tmTaskId: historyId, __tmVirtualTaskSchedule: true });
    // A cache gap after advancement must not preserve the optimistic true
    // value on all the schedules still linked to the source task.
    liveDone = null;
    return true;
};

(async () => {
    const checkbox = new context.HTMLInputElement();
    for (const index of [0, 1]) {
        checkbox.checked = true;
        const jsEvent = {};
        assert.equal(await context.handleCalendarEventCheckboxToggle(checkbox, null, null, events[index].extendedProps, taskId, { jsEvent }), true);
        await context.handleCalendarEventCheckboxToggle(checkbox, null, null, events[index].extendedProps, taskId, { jsEvent });
        assert.equal(advances, index + 1, 'each deliberate click advances once');
        assert.equal(writes, index + 1, 'duplicate dispatch must not write twice');
        assert.deepEqual(checked(), events.map((_, i) => i <= index));
        assert.deepEqual(JSON.parse(stored).map(item => item.taskId.startsWith('repeatinst:')), events.map((_, i) => i <= index));
    }
    const pending = events[2].extendedProps;
    delete pending.__tmLinkedTaskRecurring;
    liveDone = true;
    assert.equal(context.resolveCalendarEventDoneState(pending), false, 'live recurrence metadata covers an older event snapshot');
    for (const allDay of [false, true]) {
        events[2].allDay = allDay;
        assert.equal(context.shouldHideCompletedAllDayCalendarEvent(events[2], { showCompletedAllDaySchedules: false }, { taskDoneOverride: true }), false);
    }
    failNext = true; checkbox.checked = true;
    await assert.rejects(context.handleCalendarEventCheckboxToggle(checkbox, null, null, pending, taskId), /未保存/);
    assert.equal(checkbox.checked, false);
    assert.equal(context.resolveCalendarEventDoneState(pending), false);
    assert.equal(advances, 2);
    stored = JSON.stringify(items);
    await Promise.all([0, 1].map(index => context.reassignScheduleLinkedTask(`schedule-${index}`, `history-${index}`, {
        sourceTaskId: taskId, completionId: `completion-${index}`, refetch: false,
    })));
    assert.deepEqual(JSON.parse(stored).slice(0, 2).map(item => item.completionId), ['completion-0', 'completion-1'], 'concurrent completion mappings must preserve both receipts');
    await Promise.all([
        context.restoreTaskCompletion(taskId, { restoredCompletionId: 'completion-0' }),
        context.reassignScheduleLinkedTask('schedule-2', 'history-2', { sourceTaskId: taskId, completionId: 'completion-2', refetch: false }),
    ]);
    assert.equal(JSON.parse(stored)[0].taskId, taskId);
    assert.equal(JSON.parse(stored)[2].completionId, 'completion-2', 'undo and a new completion must not overwrite each other');
    assert.equal(await context.reassignScheduleLinkedTask('schedule-3', 'stale-history', { sourceTaskId: 'other-task', completionId: 'stale' }), false);
    stored = JSON.stringify([{ ...items[0], repeat: 'daily' }]);
    await Promise.all([1, 2].map(index => context.reassignScheduleLinkedTask('schedule-0', `history-${index}`, {
        sourceTaskId: taskId, completionId: `completion-${index}`, occurrenceStartMs: index, refetch: false,
    })));
    assert.equal(Object.keys(JSON.parse(stored)[0].completionRefs).length, 2);
    await context.restoreTaskCompletion('other-task', { restoredCompletionId: 'completion-1' });
    assert.equal(Object.keys(JSON.parse(stored)[0].completionRefs).length, 2, 'restore must be scoped to its source task');
    await context.restoreTaskCompletion(taskId, { restoredCompletionId: 'completion-1' });
    assert.deepEqual(Object.keys(JSON.parse(stored)[0].completionRefs), ['2']);
    console.log('calendar recurring linked schedule completion tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
