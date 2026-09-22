'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'calendar-view.js'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, '..', 'calendar-view.css'), 'utf8');
const actionStart = source.indexOf('const performPrototypeListAction =');
const actionEnd = source.indexOf('const openPrototypeListTaskDetail =', actionStart);
assert.ok(actionStart >= 0 && actionEnd > actionStart);

function attributes(values = {}) {
    return {
        values: { ...values },
        getAttribute(name) { return this.values[name] ?? null; },
        setAttribute(name, value) { this.values[name] = value; },
    };
}
function subtaskSection(taskId) {
    const toggle = attributes({ 'data-tm-proto-list-action': 'toggle-subtasks', 'data-tm-proto-list-task-id': taskId, 'aria-expanded': 'true' });
    const list = attributes({ 'aria-hidden': 'false' });
    const section = attributes({ 'data-tm-proto-list-subtasks-owner': taskId });
    section.classList = { toggle(name, value) { section.collapsed = value; } };
    section.querySelector = (selector) => selector.includes('toggle-subtasks') ? toggle : list;
    return { section, toggle, list };
}
const first = subtaskSection('task-a');
const repeated = subtaskSection('task-a');
const unrelated = subtaskSection('task-b');
let renders = 0;
let persisted = 0;
let navigations = 0;
const timers = [];
const context = vm.createContext({
    prototypeMobileMonthSuppressClickUntil: 0,
    state: {},
    calendar: {},
    prototypeListState: { focusDate: new Date(2026, 8, 14), collapsedSubtasks: new Set(), selectionTransitionToken: 0 },
    prototypeSurface: {
        querySelectorAll: () => [first.section, repeated.section, unrelated.section],
        querySelector: () => { throw new Error('Subtask toggle must not capture global list scroll'); },
    },
    getCalendarView: () => ({}),
    protoListFocusDate: () => new Date(2026, 8, 14),
    protoDateKey: (date) => date ? [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-') : '',
    protoDayStart: (date) => date,
    protoAddDays: (date, amount) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount),
    protoListVisibleDays: (date) => [-1, 0, 1].map((amount) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount)),
    queuePrototypeSurfaceRender: () => { renders += 1; },
    persistPrototypeListState: () => { persisted += 1; },
    callCalendarAdapter: () => { navigations += 1; },
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); },
});
vm.runInContext(source.slice(actionStart, actionEnd) + ';this.performAction = performPrototypeListAction;', context);
const click = (target) => context.performAction({ preventDefault() {}, stopPropagation() {} }, target);
assert.equal(click(first.toggle), true);
for (const item of [first, repeated]) {
    assert.equal(item.section.collapsed, true);
    assert.equal(item.toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(item.toggle.getAttribute('title'), '展开子任务');
    assert.equal(item.list.getAttribute('aria-hidden'), 'true');
}
assert.equal(unrelated.section.collapsed, undefined);
assert.equal(click(repeated.toggle), true);
assert.equal(first.section.collapsed, false);
assert.equal(repeated.list.getAttribute('aria-hidden'), 'false');
assert.equal(context.prototypeListState.collapsedSubtasks.size, 0);
assert.equal(persisted, 2);
assert.equal(renders, 0, 'Subtask toggles must not queue a surface render');
assert.equal(navigations, 0);
const dateButton = (key) => attributes({ 'data-tm-proto-list-action': 'select-date', 'data-tm-proto-list-date': key });
click(dateButton('2026-09-14'));
assert.equal(renders, 0, 'Clicking the selected date must be a no-op');
assert.equal(navigations, 0);
assert.equal(timers.length, 0);
click(dateButton('2026-09-17'));
assert.equal(context.prototypeListState.selectionTransitionPhase, 'fade-out');
assert.equal(timers.length, 2);
timers.find((timer) => timer.delay === 280).callback();
assert.equal(context.protoDateKey(context.prototypeListState.focusDate), '2026-09-17');
assert.equal(context.prototypeListState.selectionTransitionPhase, 'fade-in');
timers.find((timer) => timer.delay === 700).callback();
assert.equal(context.prototypeListState.selectionTransitionPhase, '');

const dateStart = source.indexOf('const protoListDateCell =');
const dateEnd = source.indexOf('const syncPrototypeListControl =', dateStart);
assert.ok(dateEnd > dateStart);
Object.assign(context, {
    esc: (text) => String(text).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;'),
    protoListDateLabel: (date) => String(date.getDate()),
    protoWeekLabels: ['日', '一', '二', '三', '四', '五', '六'],
    protoRangeEvents: (events) => events,
    getCalendarDateHeaderInfo: () => ({ lunar: '初四', label: '测试节日名称', status: 'rest' }),
});
vm.runInContext(source.slice(dateStart, dateEnd) + ';this.renderDate = protoListDateCell;', context);
const focusDate = new Date(2026, 8, 14);
const renderDate = (settings) => context.renderDate(focusDate, focusDate, new Set(), [], settings);
const lunar = renderDate({ showLunar: true });
assert.match(lunar, /<strong>14<\/strong><small class="tm-proto-list-date-subtext"[^>]*>初四<\/small><\/span>/);
assert.doesNotMatch(renderDate({}), /date-subtext|date-status--rest/);
const holiday = renderDate({ showLunar: true, showCnHoliday: true });
assert.match(holiday, /title="测试节日名称">测试节<\/small>/);
assert.doesNotMatch(holiday, /初四/);
assert.match(holiday, /date-status--rest/);
assert.ok(styles.includes('grid-template-rows: 11px 30px 4px;'));
assert.ok(styles.includes('grid-template-rows: 30px 4px;'));
assert.doesNotMatch(styles, /grid-template-rows: (?:11px )?30px 11px 3px;/);
assert.doesNotMatch(styles, /is-visibility-fade-(?:in|out) strong/);
assert.match(styles, /is-selected \.tm-proto-list-date-number::before\{[^}]*transition: none;[^}]*animation: none;/);
assert.ok(source.includes('!isCalendarListViewType(viewType) || !patchPrototypeListSurface(markup)'));

const toolbarStart = source.indexOf('const protoToolbarMarkup =');
const toolbarEnd = source.indexOf('const snapshotPrototypeEvent =', toolbarStart);
assert.ok(toolbarEnd > toolbarStart);
Object.assign(context, {
    MAIN_CALENDAR_ALLOWED_VIEWS: new Set(['listMonth', 'dayGridMonth']),
    MAIN_CALENDAR_VIEW_OPTIONS: [],
    getMainCalendarViewOptions: () => [],
    isCompactDockLayout: () => false,
    isCalendarListViewType: (viewType) => viewType === 'listMonth',
    protoListFocusDate: () => context.prototypeListState.focusDate,
    protoSafeDate: (date) => date,
    protoToolbarIcon: () => '',
    prototypeOpenMenu: '',
    isMobileDevice: false,
    isDockHost: false,
    prototypeShowDayPanel: false,
});
vm.runInContext(source.slice(toolbarStart, toolbarEnd) + ';this.renderToolbar = protoToolbarMarkup;', context);
const view = { currentStart: new Date(2026, 8, 1) };
context.prototypeListState.focusDate = new Date(2026, 8, 14);
assert.match(context.renderToolbar(view, 'listMonth', {}, '2026年9月'), />2026年9月14日<\/div>/);
context.prototypeListState.focusDate = new Date(2026, 9, 2);
assert.match(context.renderToolbar(view, 'listMonth', {}, '2026年9月'), />2026年10月2日<\/div>/);
assert.match(context.renderToolbar(view, 'dayGridMonth', {}, '2026年9月'), />2026年9月<\/div>/);
context.isCompactDockLayout = () => true;
assert.match(context.renderToolbar(view, 'listMonth', {}, '2026年9月'), /data-tm-proto-toolbar-month="1">10月2日<\/span>/);
assert.doesNotMatch(styles, /\.tm-proto-list-week-nav:(?:first|last)-child/);
assert.match(styles, /\.tm-proto-list-date-cell:not\(\.has-date-meta\) \.tm-proto-list-date-number > strong\{[^}]*grid-row: 1 \/ -1;[^}]*align-self: center;/);
assert.match(source, /const expiredEvents = isToday[\s\S]*?eventApi\?\.allDay === true/);
assert.match(styles, /\.tm-proto-list-time\{[^}]*width:\s*40px;[^}]*white-space:\s*normal;/);
assert.match(styles, /\.tm-proto-list-row\{[\s\S]*grid-template-columns:\s*40px minmax\(0, 1fr\);/);
assert.match(styles, /\.tm-proto-list-time\{[^}]*width:\s*40px;[^}]*max-width:\s*40px;/);
assert.match(source, /const listWidth = Number\(prototypeSurface\?\.querySelector\?\.\('\.tm-proto-list'\)\?\.clientWidth \|\| 0\);/);
assert.match(source, /const count = width >= 900 \? 3 : \(width >= 560 \? 2 : 1\);/);
assert.match(source, /`is-day-count-\$\{visibleDays\.length\}`/);
assert.match(styles, /\.tm-proto-list\.is-day-count-1 \.tm-proto-list-days\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) !important;/);
console.log('calendar list local update tests passed');
