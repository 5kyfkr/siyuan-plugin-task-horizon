'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../src/task-horizon/main');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const model = read('task-runtime/50-task-model-and-repeat-utils.js');
const stores = read('10-stores-rules-and-cache.js');

function extract(source, name) {
    const start = source.search(new RegExp(`    (?:async )?function ${name}\\(`));
    assert.ok(start >= 0, name);
    const end = source.indexOf('\n    }', start);
    assert.ok(end > start, name);
    return source.slice(start, end + 6);
}

let now = new Date(2026, 8, 29, 12).getTime(); // Tuesday
class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
    static [Symbol.hasInstance](value) { return value instanceof Date; }
}
let saves = 0;
const context = vm.createContext({
    console, Date: Clock, Intl, Map, Set, WeakMap,
    SettingsStore: {
        loaded: true,
        data: { taskHeadingLevel: 'h2', settingsUpdatedAt: 1, columnOrder: [] },
        save: async () => { saves += 1; },
    },
    Storage: { get: () => [] }, state: {},
    __TM_CUSTOM_ORDER_SORT_FIELD: '__customOrder',
    __tmParseVersionNumber: value => Number(value) || 0,
    __tmGetCustomFieldDefs: () => [],
    __tmParseCustomFieldColumnKey: () => '',
    __tmGetStatusOptions: () => [],
    __tmGetDefaultUndoneStatusId: () => '',
    __tmRuleUsesDocFlowSort: () => false,
    __tmRuleUsesCustomOrderSort: () => false,
    __tmRuleSortsUseCustomOrderField: () => false,
    __tmGetNormalizedRuleSorts: rule => rule.sort || [],
    __tmIsTaskCanceled: () => false,
    __tmIsTaskActive: task => !task.done,
    __tmIsTaskDoneEffective: task => !context.__tmIsCheckinTask(task) && task.done === true,
    __tmFormatTaskTime: value => value || '',
    __tmFormatTaskDetailShortDate: value => value || '', esc: String,
    __tmNormalizeTaskCompleteAtValue: value => String(value || ''),
    __tmIsDarkMode: () => false,
    __tmNormalizeHexColor: (value, fallback) => value || fallback,
});
vm.runInContext(extract(model, '__tmNormalizeDateOnly'), context);
vm.runInContext(model.slice(model.indexOf('function __tmParseTaskRepeatJson'), model.indexOf('function __tmGetTaskRepeatWeekdayLabel')), context);
for (const name of [
    '__tmParseTimeToTs', '__tmShouldUseBestSubtaskTimeForSort', '__tmGetTaskTimePriorityInfo',
    '__tmGetTaskEffectiveCompletionTimeInfo', '__tmGetTaskEffectiveCompletionTimeSortValue',
    '__tmGetTaskCardDateValue', '__tmHasTaskCardDate', '__tmFormatTaskCardDateValue',
    '__tmShouldRenderTaskCardDate', '__tmShouldRenderTaskCardRemainingTime',
    '__tmFormatTaskCardDateValueFromValue', '__tmIsTaskCardDateOverdue',
    '__tmGetTaskDateFieldDisplayValue', '__tmFormatTaskDateFieldDisplayValue',
]) vm.runInContext(extract(model, name), context);
vm.runInContext(extract(read('settings/64-export-runtime.js'), '__tmGetTaskRemainingTimeInfo'), context);
vm.runInContext(extract(read('task-runtime/51-whiteboard-and-link-runtime.js'), '__tmResolvePriorityScoreCacheUntil'), context);
vm.runInContext(stores.slice(stores.indexOf('const RuleManager = {'), stores.indexOf('    const __tmTasksQueryCache')) + '\nglobalThis.rules = RuleManager;', context);
for (const name of ['__tmRenderTaskTimeHubCheckinDateCardHtml', '__tmRenderTaskTimeHubCheckinDayHtml']) {
    vm.runInContext(extract(read('task-runtime/52-task-detail-runtime.js'), name), context);
}

const task = {
    id: 'weekly', done: false, startDate: '2026-09-28', completionTime: '2026-09-28',
    repeatRule: { enabled: true, trigger: 'checkin', type: 'weekly', every: 1, anchorDate: '2026-09-28', weekdays: [1, 3, 5] },
    repeatState: {},
};
const original = JSON.stringify(task);
const setDay = day => { now = new Date(`${day}T12:00:00`).getTime(); };
const date = () => context.__tmGetTaskCheckinCurrentDate(task);
const info = options => context.__tmGetTaskTimePriorityInfo(task, options);
const todayRule = context.rules.getDefaultRules().find(rule => rule.id === 'default_today');
const isToday = () => context.rules.applyRuleFilter([task], todayRule).length === 1;
const card = () => context.__tmFormatTaskCardDateValue(task);
const remaining = () => context.__tmGetTaskRemainingTimeInfo(task).label;
const check = day => { task.repeatState = { checkinHistory: [{ scheduledDate: day, checkedAt: `${day}T12:00:00+08:00`, source: 'test' }] }; };

async function run() {
    assert.equal(date(), '2026-09-30', 'a missed Monday must not stall the next plan');
    assert.equal(info().diffDays, 1);
    assert.equal(isToday(), false);
    assert.equal(card(), '下次打卡 9月30日');
    assert.equal(remaining(), '下次打卡 1天后');
    assert.equal(context.__tmShouldRenderTaskCardRemainingTime(task, true), false, 'a check-in date replaces the remaining-time chip');
    assert.equal(context.__tmShouldRenderTaskCardRemainingTime(task, false), true, 'remaining time alone still conveys the next check-in');
    assert.equal(context.__tmShouldRenderTaskCardRemainingTime({ completionTime: '2026-09-30' }, true), true, 'ordinary tasks retain both fields');
    assert.equal(context.__tmShouldRenderTaskCardRemainingTime({}, false), false, 'undated tasks retain the existing card behavior');
    assert.equal(context.__tmIsTaskCardDateOverdue(task), false);
    assert.equal(JSON.stringify(task), original, 'deriving dates must not mutate the task');
    assert.equal(context.__tmGetTaskDateFieldDisplayValue(task, 'startDate'), '');
    assert.equal(context.__tmFormatTaskDateFieldDisplayValue(task, 'completionTime'), '打卡 2026-09-30');
    assert.match(context.__tmRenderTaskTimeHubCheckinDateCardHtml(task), /2026-09-30/);
    assert.doesNotMatch(context.__tmRenderTaskTimeHubCheckinDateCardHtml(task), /data-tm-time-hub-clear-date|data-tm-time-hub-date-card/);
    const dayHtml = (day, checked, planned) => context.__tmRenderTaskTimeHubCheckinDayHtml(day, 29, '', checked, planned, '2026-09-29');
    assert.doesNotMatch(dayHtml('2026-09-29', false, false), / disabled/);
    assert.match(dayHtml('2026-09-30', false, true), / disabled/);
    assert.doesNotMatch(dayHtml('2026-09-28', false, true), / disabled/);
    assert.doesNotMatch(dayHtml('2026-09-27', false, false), / disabled/);
    assert.match(dayHtml('2026-09-27', true, false), /aria-pressed="true"/);
    assert.doesNotMatch(dayHtml('2026-09-27', true, false), / disabled/);
    assert.match(dayHtml('2026-09-27', true, false), /class="tm-task-time-hub__checkin-mark"/);

    check('2026-09-29');
    assert.equal(date(), '2026-09-29', 'an extra check-in belongs to Today');
    assert.equal(info().diffDays, 0);
    assert.equal(isToday(), true);
    assert.equal(card(), '今日已打卡');
    assert.equal(context.__tmShouldRenderTaskCardRemainingTime(task, true), false, 'checked tasks must not repeat 今日已打卡');
    assert.equal(remaining(), '今日已打卡');
    task.repeatState = {};
    assert.equal(date(), '2026-09-30', 'undo extra check-in restores next planned group');
    assert.equal(isToday(), false);

    setDay('2026-09-30');
    assert.equal(date(), '2026-09-30');
    assert.equal(info().diffDays, 0);
    assert.equal(isToday(), true);
    assert.equal(card(), '今日待打卡');
    assert.equal(remaining(), '今日待打卡');
    check('2026-09-30');
    task.done = true; // native note may still carry a checked marker
    assert.equal(isToday(), true, 'today check-in must not be filtered out as permanently done');
    assert.equal(card(), '今日已打卡');
    const cacheUntil = context.__tmResolvePriorityScoreCacheUntil(task, {
        config: { weights: { due: 1 } }, dueInfo: info(), dueRanges: [{ days: 0, delta: 1 }],
    });
    assert.equal(cacheUntil, new Date(2026, 9, 1).getTime());

    setDay('2026-10-01');
    assert.equal(date(), '2026-10-02');
    assert.equal(info().diffDays, 1);
    assert.equal(isToday(), false);
    assert.equal(card(), '下次打卡 10月2日');
    setDay('2026-10-02');
    assert.equal(date(), '2026-10-02');
    assert.equal(card(), '今日待打卡', 'previous check-in must not complete Friday');
    assert.equal(isToday(), true);
    setDay('2026-10-03');
    assert.equal(date(), '2026-10-05', 'missing Friday does not stall Monday');

    task.children = [{ id: 'overdue-child', completionTime: '2026-09-01', done: false }];
    assert.equal(info({ useBestSubtaskTime: true }).diffDays, 2, 'children must not replace the check-in plan');
    delete task.children;
    task.done = false;
    const parent = { id: 'parent', children: [task] };
    assert.equal(context.__tmGetTaskTimePriorityInfo(parent, { useBestSubtaskTime: true }).diffDays, 2);

    // Explicit date filters stay tied to stored dates; the virtual field follows the plan.
    const filter = (field, operator, value) => context.rules.applyRuleFilter([task], {
        id: 'custom-date', conditions: [{ field, operator, value }],
    }).length;
    assert.equal(filter('completionTime', 'before_today', ''), 1);
    assert.equal(filter('startDate', 'before_today', ''), 1);
    assert.equal(filter('completionTime', 'range_overlap_today', ''), 0);
    assert.equal(filter('taskDate', 'after_today', ''), 1);
    const ordinary = { id: 'ordinary', completionTime: '2026-10-04', done: false };
    for (const field of ['completionTime', 'taskDate']) {
        assert.deepEqual(Array.from(context.rules.applyRuleSort([task, ordinary], {
            id: 'date-sort', sort: [{ field, order: 'asc' }],
        }), item => item.id), ['ordinary', 'weekly']);
    }
    const spanning = { id: 'spanning', startDate: '2026-09-01', completionTime: '2026-10-10' };
    assert.equal(context.rules.applyRuleFilter([spanning], todayRule).length, 1, 'ordinary spanning tasks retain Today semantics');

    task.repeatRule.until = '2026-10-02';
    assert.equal(date(), '');
    assert.equal(info().hasDate, false);
    assert.equal(remaining(), '打卡计划已结束');
    check('2026-10-03');
    assert.equal(isToday(), true, 'extra check-ins remain supported after the schedule ends');
    setDay('2026-10-04');
    assert.equal(date(), '');
    delete task.repeatRule.until;
    task.repeatRule.maxOccurrences = 3;
    assert.equal(date(), '', 'occurrence limits also govern derived dates');
    delete task.repeatRule.maxOccurrences;

    task.repeatRule.trigger = 'completion';
    assert.ok(info().diffDays < 0, 'switching recurrence mode restores stored due-date grouping');
    assert.equal(context.__tmGetTaskCardDateValue(task), '2026-09-28');
    task.repeatRule.trigger = 'checkin';
    task.repeatRule.enabled = false;
    assert.ok(info().diffDays < 0);
    task.repeatRule.enabled = true;
    assert.equal(task.startDate, '2026-09-28');
    assert.equal(task.completionTime, '2026-09-28');
    assert.equal(task.repeatRule.anchorDate, '2026-09-28');
    const support = read('render/48-render-calendar-support-runtime.js');
    context.window = context;
    context.__tmGetCalendarFlatTaskByIdSync = () => task;
    vm.runInContext(support.slice(support.indexOf('    window.tmUpdateTaskDates = async function'), support.indexOf('    const __tmUpdateTaskDatesCore')), context);
    await assert.rejects(context.tmUpdateTaskDates(task.id, { completionTime: '2026-10-10' }), /循环计划/);
    await assert.rejects(context.tmUpdateTaskDates(task.id, { startDate: '' }), /循环计划/);

    // Migrate only the built-in Today criterion; user-defined date rules keep their meaning.
    const legacy = { id: 'default_today', conditions: [{ field: 'completionTime', operator: 'range_overlap_today', value: '' }] };
    const custom = { ...legacy, id: 'custom-today' };
    const edited = { ...legacy, conditions: [{ field: 'completionTime', operator: 'before_today', value: '' }] };
    context.SettingsStore.data.filterRules = [legacy, custom];
    const migrated = await context.rules.initRules();
    assert.equal(migrated[0].conditions[0].field, 'taskDate');
    assert.strictEqual(migrated[1], custom);
    await context.rules.initRules();
    assert.equal(saves, 1, 'migration must be idempotent');
    context.SettingsStore.data.filterRules = [edited];
    assert.strictEqual((await context.rules.initRules())[0], edited);
    context.SettingsStore.data.filterRules = [{ ...legacy, conditions: [{ field: 'completionTime', operator: 'range_today', value: '' }] }];
    assert.equal((await context.rules.initRules())[0].conditions[0].field, 'taskDate');

    console.log('check-in current date, grouping, sorting and filter tests passed');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
