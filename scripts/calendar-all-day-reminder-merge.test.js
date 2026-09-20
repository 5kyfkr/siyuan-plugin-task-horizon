'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
function readFunction(name) {
    const start = source.indexOf(`    function ${name}(`);
    assert.ok(start >= 0, name);
    return source.slice(start, source.indexOf('\n    }', start) + 6);
}
class Element {
    constructor() { this.style = { setProperty() {} }; this.innerHTML = ''; }
    getBoundingClientRect() { return { left: 0, top: 0, bottom: 20, height: 120 }; }
    querySelectorAll() { return []; }
    remove() {}
}
const settings = { weekAllDayVisibleRows: 5, visibleStartTime: '00:00', visibleEndTime: '24:00' };
const day = new Date(2026, 8, 20);
const nextDay = new Date(2026, 8, 21);
const context = vm.createContext({
    Date, Map, Set, Element,
    state: {}, innerWidth: 1280, innerHeight: 800,
    document: { createElement: () => new Element(), body: { appendChild() {} }, addEventListener() {}, removeEventListener() {} },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    getSettings: () => settings, isLikelyMobileRuntime: () => false,
    getPrototypeHourHeight: () => 48, PROTOTYPE_TIME_COLLAPSE_BAND_HEIGHT: 28,
    esc: (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;'),
    pad2: (value) => String(value).padStart(2, '0'),
    formatDateKey: (date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-'),
    parseDateOnly: (value) => new Date(String(value).slice(0, 10) + 'T00:00:00'),
    toMs: (value) => new Date(value).getTime(),
    getCalendarEventColor: () => '#527acc',
    resolveCalendarEventDoneState: (ext) => !!ext.done,
    shouldShowCalendarEventCheckbox: () => true,
    isCalendarBuiltinScheduleEvent: () => false,
    buildCalendarRecurringTaskIconMarkup: () => '<i data-recurring="true"></i>',
    shouldHideCompletedAllDayCalendarEvent: () => false,
    buildSharedPrototypeLunarText: () => '', bindPrototypeMorePopoverDrag: () => null,
    getCalendarView: () => ({ type: 'timeGridDay' }), getCalendarEvents: (calendar) => calendar.getEvents(),
});
context.window = context;
for (const file of ['calendar-date.js', 'calendar-store.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'src/calendar', file), 'utf8'), context);
}
for (const name of [
    'normalizeCalendarWeekAllDayVisibleRows', 'normalizeCalendarVisibleTime', 'getCalendarVisibleSlotRange',
    'getPrototypeTimelineMetrics', 'getPrototypeTimelineVisibleEventSegments', 'prototypeTimelineYForMinute',
    'resolveSharedPrototypeEventStart', 'resolveSharedPrototypeEventEnd', 'countSharedPrototypeAllDayEvents',
    'isCalendarForegroundEvent', 'mergeCalendarAllDayReminders', 'buildCalendarMergedReminderMarkup',
    'buildSharedPrototypeAllDayToggleMarkup', 'buildSharedPrototypeEventMarkup', 'buildSharedPrototypeSpanMarkup',
    'buildSharedPrototypeTimelineMarkup', 'buildSharedPrototypeDayPanelMarkup',
    'closeTrackedPrototypeMorePopover', 'showSharedPrototypeMorePopover',
]) vm.runInContext(readFunction(name), context);
const store = context.__tmCalendarStore.createCalendarStore();
const task = (id, title = '工时登记', extra = {}) => ({ id: `taskdate:${id}`, title, start: day, end: nextDay, allDay: true,
    extendedProps: { __tmTaskId: id, __tmSource: 'taskdate' }, ...extra });
const reminder = (id, times = ['16:00'], extra = {}) => ({ id: `reminder:${id}:2026-09-20`, title: `⏰ 工时登记 (${times.join(',')})`, start: day, end: nextDay, allDay: true,
    extendedProps: { __tmTaskId: id, __tmReminderBlockId: id, __tmSource: 'reminder', __tmReminderDate: '2026-09-20', __tmReminderTimes: times }, ...extra });
store.setSourceEvents('dates', [task('task-a'), task('task-b', '周报更新')]);
store.setSourceEvents('reminders', [reminder('task-a'), reminder('task-b', ['09:00'])]);
const original = store.getEventById('taskdate:task-a');
const render = (extra = {}) => context.buildSharedPrototypeTimelineMarkup({ days: [day], events: store.getEvents(), settings, viewType: 'timeGridDay', ...extra });
const html = render();
assert.equal((html.match(/data-tm-proto-event=/g) || []).length, 2, 'The screenshot case must render two cards instead of four');
for (const id of ['task-a', 'task-b']) {
    assert.ok(html.includes(`data-tm-proto-event="taskdate:${id}"`));
    assert.ok(html.includes(`data-tm-proto-check="taskdate:${id}"`), 'Keep the editable task identity and checkbox');
    assert.ok(!html.includes(`data-tm-proto-event="reminder:${id}`));
}
assert.ok(html.includes('⏰ 16:00') && html.includes('⏰ 09:00'), 'Both reminder times remain directly visible');
assert.ok(html.includes('data-recurring="true"'), 'The task recurrence indicator is preserved');
assert.equal(store.getEvents().length, 4, 'Merging must only affect rendering, not reminder storage or scheduling');
assert.equal(original.extendedProps.__tmMergedReminderLabel, undefined, 'Rendering must not mutate stored task metadata');
assert.equal(context.countSharedPrototypeAllDayEvents(store.getEvents(), day), 2);
assert.match(render({ allDayCollapsed: true }), /查看当天 2 个全天日程/);
assert.doesNotMatch(render({ settings: { ...settings, weekAllDayVisibleRows: 2 } }), /class="tm-proto-more"/, 'Merged cards must use two rows without false overflow');
const side = context.buildSharedPrototypeDayPanelMarkup({ date: day, events: store.getEvents(), settings, viewType: 'timeGridDay' });
assert.equal((side.match(/data-tm-proto-event=/g) || []).length, 2);
assert.ok(side.includes('⏰ 16:00') && side.includes('⏰ 09:00'));
Object.assign(context, {
    protoSafeDate: (value) => new Date(value), protoDayStart: (value) => new Date(value),
    protoAddDays: (value, amount) => new Date(value.getFullYear(), value.getMonth(), value.getDate() + amount),
    protoEventEnd: context.resolveSharedPrototypeEventEnd, protoCompareMonthEvents: (a, b) => a.start - b.start,
    protoWeekLabels: [], protoLunarText: () => '', protoEventColor: () => '#527acc',
    protoEventMarkup: context.buildSharedPrototypeEventMarkup, closePrototypeMorePopover: context.closeTrackedPrototypeMorePopover,
});
const popoverStart = source.indexOf('        const showPrototypeMorePopover =');
vm.runInContext(source.slice(popoverStart, source.indexOf('\n        };', popoverStart) + 11) + '\nglobalThis.openMainPopover = showPrototypeMorePopover;', context);
context.state.calendar = store;
for (const open of [context.showSharedPrototypeMorePopover, context.openMainPopover]) {
    open(new Element(), '2026-09-20', store);
    const markup = context.state.__tmPrototypeMorePopover.el.innerHTML;
    assert.equal((markup.match(/class="tm-proto-more-popover-event"/g) || []).length, 2);
    assert.ok(markup.includes('⏰ 16:00') && markup.includes('⏰ 09:00'), 'Overflow popovers also retain reminder times');
}
const merge = (events) => context.mergeCalendarAllDayReminders(events);
assert.equal(merge([task('task-a'), reminder('other')]).length, 2, 'Same titles on different tasks must not merge');
assert.equal(merge([task('task-a', '', { start: nextDay, end: new Date(2026, 8, 22) }), reminder('task-a')]).length, 2, 'Another day’s task must not hide today’s reminder');
assert.equal(merge([task('task-a', '', { allDay: false }), reminder('task-a')]).length, 2, 'Timed schedules keep their distinct position');
const legacy = reminder('task-a');
delete legacy.extendedProps.__tmTaskId;
assert.equal(merge([task('task-a'), legacy]).length, 1, 'Legacy reminder block IDs remain supported');
assert.equal(merge([task('task-a'), reminder('task-a', ['16:00', '09:00', '16:00'])])[0].extendedProps.__tmMergedReminderLabel, '09:00、16:00');
const spanTask = task('task-a', '跨天任务', { start: new Date(2026, 8, 19), end: new Date(2026, 8, 22) });
const span = context.buildSharedPrototypeDayPanelMarkup({ date: day, events: [spanTask, reminder('task-a')], settings });
assert.equal((span.match(/data-tm-proto-event=/g) || []).length, 1);
assert.ok(span.includes('⏰ 09-20 16:00'), 'Cross-day cards retain the date associated with the reminder time');
store.getEventById('reminder:task-a:2026-09-20').setDates('2026-09-21', '2026-09-22', { allDay: true });
assert.ok(!render().includes('⏰ 16:00'), 'Moving a reminder away must remove the old day’s merged time label');
assert.equal(original.extendedProps.__tmMergedReminderLabel, undefined);
console.log('calendar all-day reminder merge tests passed');
