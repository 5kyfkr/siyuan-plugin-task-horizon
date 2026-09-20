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
    const end = source.indexOf('\n    }', start) + 6;
    return source.slice(start, end);
}
class Element {
    constructor() { this.style = { setProperty() {} }; this.innerHTML = ''; }
    getBoundingClientRect() { return { left: 0, top: 0, bottom: 20, height: 120 }; }
    querySelectorAll() { return []; }
    remove() {}
}
const settings = { weekAllDayVisibleRows: 5, visibleStartTime: '00:00', visibleEndTime: '24:00' };
const context = vm.createContext({
    Date, Map, Set, AbortController, Element, HTMLElement: Element, HTMLButtonElement: Element,
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    state: {}, innerWidth: 1280, innerHeight: 800,
    document: { createElement: () => new Element(), body: { appendChild() {} }, addEventListener() {}, removeEventListener() {} },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    getSettings: () => settings, isLikelyMobileRuntime: () => false,
    getPrototypeHourHeight: () => 48, PROTOTYPE_TIME_COLLAPSE_BAND_HEIGHT: 28,
    esc: String, pad2: (value) => String(value).padStart(2, '0'),
    formatDateKey: (date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-'),
    parseDateOnly: (value) => new Date(String(value).slice(0, 10) + 'T00:00:00'),
    toMs: (value) => new Date(value).getTime(),
    getCalendarEventColor: (event) => event.backgroundColor || '#123456',
    resolveCalendarEventDoneState: () => false,
    shouldShowCalendarEventCheckbox: () => false,
    isCalendarBuiltinScheduleEvent: () => false,
    buildCalendarRecurringTaskIconMarkup: () => '',
    shouldHideCompletedAllDayCalendarEvent: () => false,
    buildSharedPrototypeLunarText: () => '',
    bindPrototypeMorePopoverDrag: () => null,
    getCalendarView: () => ({ type: 'timeGridDay' }),
    getCalendarEvents: (calendar) => calendar.getEvents(),
});
context.window = context;
vm.runInContext(source, context);
for (const file of ['calendar-date.js', 'calendar-store.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'src/calendar', file), 'utf8'), context);
}
for (const name of [
    'normalizeCalendarWeekAllDayVisibleRows', 'normalizeCalendarVisibleTime', 'getCalendarVisibleSlotRange',
    'getPrototypeTimelineMetrics', 'getPrototypeTimelineVisibleEventSegments', 'prototypeTimelineYForMinute',
    'resolveSharedPrototypeEventStart', 'resolveSharedPrototypeEventEnd', 'countSharedPrototypeAllDayEvents',
    'isCalendarForegroundEvent',
    'mergeCalendarAllDayReminders', 'buildCalendarMergedReminderMarkup',
    'buildSharedPrototypeAllDayToggleMarkup', 'buildSharedPrototypeEventMarkup', 'buildSharedPrototypeSpanMarkup',
    'buildSharedPrototypeTimelineMarkup', 'buildSharedPrototypeDayPanelMarkup',
    'closeTrackedPrototypeMorePopover', 'showSharedPrototypeMorePopover',
]) vm.runInContext(readFunction(name), context);

const day = new Date(2026, 9, 1);
const nextDay = new Date(2026, 9, 2);
const holidayInputs = context.__tmCalendar.buildCnHolidayEvents(
    [{ date: '2026-10-01', type: 2, name: '国庆节' }], day, nextDay, 'timeGridDay', {},
);
assert.equal(holidayInputs.length, 2, 'A confirmed festival has a label event and a background event');
const background = holidayInputs.find((event) => event.display === 'background');
assert.equal(background.title, '');
const store = context.__tmCalendarStore.createCalendarStore();
store.setSourceEvents('holidays', holidayInputs);
const render = (extra = {}) => context.buildSharedPrototypeTimelineMarkup({ days: [day], events: store.getEvents(), settings, viewType: 'timeGridDay', ...extra });
const markup = render();
assert.doesNotMatch(markup, /未命名事件|data-tm-proto-event="cn-holiday-bg:/, 'Holiday background shading must not become an unnamed all-day card');
assert.match(markup, /国庆节/);
assert.equal(context.countSharedPrototypeAllDayEvents(store.getEvents(), day), 1, 'Backgrounds must not inflate the folded count');
assert.match(render({ allDayCollapsed: true }), /查看当天 1 个全天日程/);
assert.doesNotMatch(render({ settings: { ...settings, weekAllDayVisibleRows: 1 } }), /\+\d+ 项/, 'A background must not displace a real holiday into overflow');
assert.doesNotMatch(context.buildSharedPrototypeDayPanelMarkup({ date: day, events: store.getEvents(), settings }), /未命名事件|data-tm-proto-event="cn-holiday-bg:/);

const api = store.getEventById(background.id);
assert.equal(api.display, 'background', 'The engine must retain the input display mode');
assert.equal(api.toPlainObject().display, 'background', 'Snapshots must retain background semantics');
store.setSourceEvents('restored', [api.toPlainObject()]);
assert.equal(store.getEventById(background.id).display, 'background');
store.setSourceEvents('restored', []);
store.addEvent({ id: 'task', title: '真实全天任务', start: day, end: nextDay, allDay: true, extendedProps: { __tmSource: 'taskdate', __tmTaskId: 'task' } });
store.addEvent({ id: 'reminder', title: '任务提醒 (09:00)', start: day, end: nextDay, allDay: true, extendedProps: { __tmSource: 'reminder' } });
store.addEvent({ id: 'custom-bg', title: '背景标题', start: day, end: nextDay, allDay: true, display: 'background' });
store.addEvent({ id: 'hidden', title: '隐藏事件', start: day, end: nextDay, allDay: true, display: 'none' });
assert.equal(context.countSharedPrototypeAllDayEvents(store.getEvents(), day), 3);
assert.match(render(), /真实全天任务/);
assert.match(render(), /任务提醒 \(09:00\)/);
assert.doesNotMatch(render(), /背景标题|隐藏事件/);
const legacyBackground = { ...background, display: undefined };
assert.doesNotMatch(render({ events: [legacyBackground] }), /未命名事件|data-tm-proto-event="cn-holiday-bg:/, 'Old in-memory events without display metadata must also be excluded');

context.state.calendar = store;
context.showSharedPrototypeMorePopover(new Element(), '2026-10-01', store);
let popover = context.state.__tmPrototypeMorePopover.el.innerHTML;
assert.doesNotMatch(popover, /未命名事件|cn-holiday-bg:|custom-bg|隐藏事件/);
assert.match(popover, /国庆节|真实全天任务|任务提醒/);
Object.assign(context, {
    closePrototypeMorePopover: context.closeTrackedPrototypeMorePopover,
    protoSafeDate: (date) => new Date(date), protoDayStart: context.resolveSharedPrototypeEventStart,
    protoEventEnd: context.resolveSharedPrototypeEventEnd,
    protoAddDays: (date, amount) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount),
    protoCompareMonthEvents: (a, b) => a.start - b.start,
    protoWeekLabels: ['日', '一', '二', '三', '四', '五', '六'], protoLunarText: () => '',
    protoEventColor: () => '#123456', protoEventMarkup: context.buildSharedPrototypeEventMarkup,
});
const start = source.indexOf('        const showPrototypeMorePopover =');
const end = source.indexOf('\n        };', start) + 11;
vm.runInContext(source.slice(start, end) + '\nthis.openMainPopover = showPrototypeMorePopover;', context);
context.openMainPopover(new Element(), '2026-10-01', store);
popover = context.state.__tmPrototypeMorePopover.el.innerHTML;
assert.doesNotMatch(popover, /未命名事件|cn-holiday-bg:|custom-bg|隐藏事件/);
assert.match(popover, /国庆节/);

for (const name of ['我的休息日', '']) {
    const days = context.__tmCalendar.applyCalendarCustomHolidayOverrides([], {
        '2026-10-01': { type: 'rest', name },
    });
    const inputs = context.__tmCalendar.buildCnHolidayEvents(days, day, nextDay, 'timeGridDay', {});
    store.removeAll();
    store.setSourceEvents('custom-holidays', inputs);
    assert.ok(inputs.some((event) => event.display === 'background'), 'Custom rest days produce the same background input');
    const expectedCards = name ? 1 : 0;
    assert.equal(context.countSharedPrototypeAllDayEvents(store.getEvents(), day), expectedCards);
    assert.doesNotMatch(render(), /未命名事件|data-tm-proto-event="cn-holiday-bg:/);
    assert.equal(context.__tmCalendar.getCnHolidayDisplayInfo(days[0], '2026-10-01').status, 'rest');
    if (name) assert.ok(render().includes(name), 'The user’s custom holiday name stays visible');
    else assert.doesNotMatch(render(), /data-tm-proto-event=/, 'A rest marker without a custom name is not an empty schedule');
    context.showSharedPrototypeMorePopover(new Element(), '2026-10-01', store);
    assert.doesNotMatch(context.state.__tmPrototypeMorePopover.el.innerHTML, /未命名事件|cn-holiday-bg:/);
}
console.log('calendar background event visibility tests passed');
