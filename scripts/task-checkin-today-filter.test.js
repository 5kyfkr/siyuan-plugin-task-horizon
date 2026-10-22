'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '../src/task-horizon/main', file), 'utf8');
const extract = (source, name) => {
    const start = source.search(new RegExp(`    (?:async )?function ${name}\\(`));
    assert.ok(start >= 0, name);
    return source.slice(start, source.indexOf('\n    }', start) + 6);
};

let now = new Date(2026, 9, 22, 12).getTime();
class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
    static [Symbol.hasInstance](value) { return value instanceof Date; }
}
const alternating = ['2026-10-22', '2026-10-23'].map((anchorDate, index) => ({
    id: ['chest', 'abs'][index], content: ['胸肌', '腹肌'][index], root_id: 'health', done: false,
    // Legacy task dates must not override either check-in plan.
    startDate: '2026-10-01', completionTime: '2026-10-22', children: [],
    repeatRule: { enabled: true, type: 'daily', trigger: 'checkin', every: 2, anchorDate },
    repeatState: {},
}));
const ordinary = { id: 'ordinary', root_id: 'health', completionTime: '2026-10-22', done: false, children: [] };
const tasks = [...alternating, ordinary];
const flatTasks = Object.fromEntries(tasks.map(task => [task.id, task]));
const state = {
    taskTree: [{ id: 'health', tasks }], flatTasks, activeDocId: 'all', otherBlocks: [],
    showCompletedTasks: false, groupByDocName: true, searchKeyword: '', filterRules: [],
};
const context = vm.createContext({
    console, Date: Clock, Map, Set, WeakMap, Intl, state,
    window: { dispatchEvent() {} }, CustomEvent: class {},
    SettingsStore: { data: { currentGroupId: 'all', columnOrder: [] } },
    MetaStore: { get: () => null },
    __TM_TASK_REPEAT_RULE_ATTR: 'custom-repeat-rule',
    __TM_TASK_REPEAT_STATE_ATTR: 'custom-repeat-state',
    __TM_TASK_REPEAT_HISTORY_ATTR: 'custom-repeat-history',
    __TM_CUSTOM_ORDER_SORT_FIELD: '__customOrder',
    __tmParseVersionNumber: value => Number(value) || 0,
    __tmGetCustomFieldDefs: () => [], __tmParseCustomFieldColumnKey: () => '',
    __tmGetStatusOptions: () => [], __tmGetDefaultUndoneStatusId: () => '',
    __tmTaskStore: { revision: () => 0, getFlatMap: () => flatTasks },
    __tmIsOtherBlockTabId: () => false,
    __tmParseDocTabCustomGroupActiveId: () => '',
    __tmGetActiveDocTabCustomGroupDocIdSet: () => new Set(),
    __tmSortDocEntriesForTabs: docs => docs,
    __tmShouldIncludeDocInActiveAggregateTaskScope: () => true,
    __tmIsTaskNativeDone: task => task.done === true,
    __tmIsTaskActive: task => !task.done,
    __tmIsTaskCanceled: () => false,
    __tmDocShouldShowInDocTabs: () => true,
    __tmIsCollectedOtherBlockTask: () => false,
    __tmApplyWhiteboardSequenceFilter: values => values,
    __tmUpdateFilteredTaskRenderWindowState() {},
    __tmGetDocDisplayNameMode: () => 'name',
    __tmGetDocDisplayName: (_doc, fallback) => fallback,
    __tmHasPendingVisibleDatePersistence: () => false,
    __tmHasPendingTaskFieldPersistence: () => false,
    __tmNormalizeTaskPriorityValue: value => String(value || ''),
    __tmParseTaskLooseBoolean: value => value === true || value === '1',
    __tmApplyTaskAttachmentPathsToTask() {},
    __tmGetTaskAttachmentPaths: () => [],
    __tmNormalizeTomatoCountValue: value => String(value || ''),
    __tmGetTaskCustomFieldRawValues: () => ({}),
    __tmNormalizeTaskCustomFieldValues: values => values,
    __tmNormalizeTaskCompleteAtValue: value => String(value || ''),
    __tmNormalizeTaskStatusMarker: value => value || '',
    __tmResolveTaskMarkdownMarker: () => '',
    __tmNormalizeTaskContentField() {},
});
const model = read('task-runtime/50-task-model-and-repeat-utils.js');
for (const name of [
    '__tmNormalizeDateOnly', '__tmParseTimeToTs', '__tmShouldUseBestSubtaskTimeForSort',
    '__tmGetTaskTimePriorityInfo', '__tmGetTaskEffectiveCompletionTimeInfo', '__tmGetTaskEffectiveCompletionTimeSortValue',
]) {
    vm.runInContext(extract(model, name), context);
}
vm.runInContext(model.slice(model.indexOf('function __tmParseTaskRepeatJson'), model.indexOf('function __tmGetTaskRepeatWeekdayLabel')), context);
vm.runInContext(extract(read('20-api-and-runtime-services.js'), '__tmIsTaskDoneEffective'), context);
context.__tmTaskBoundary = { isTaskCompleted: context.__tmIsTaskDoneEffective };
vm.runInContext(read('34-task-projection-engine.js'), context);
vm.runInContext(extract(read('task-runtime/51-whiteboard-and-link-runtime.js'), '__tmIsTaskCompletedForProjection'), context);
const stores = read('10-stores-rules-and-cache.js');
vm.runInContext(stores.slice(stores.indexOf('const RuleManager = {'), stores.indexOf('    const __tmTasksQueryCache')) + '\nglobalThis.rules = RuleManager;', context);
const dialogs = read('30-dialogs-and-ui-foundation.js');
for (const name of [
    '__tmGetArchiveModeFilterRule', '__tmHasActiveDocTabContentFilter', '__tmIsAllRuleLike',
    '__tmGetNormalizedRuleSorts', '__tmRuleHasExplicitSort', '__tmRuleUsesDocFlowSort',
    '__tmRuleUsesCustomOrderSort', '__tmGetCurrentRule',
]) vm.runInContext(extract(dialogs, name), context);
vm.runInContext(dialogs.slice(dialogs.indexOf('    function applyFilters()'), dialogs.indexOf('    function __tmIsTaskAndDescDone(')), context);
vm.runInContext(extract(read('40-render-runtime.js'), 'normalizeTaskFields'), context);

const todayRule = context.rules.getDefaultRules().find(rule => rule.id === 'default_today');
const rules = [todayRule, ...['completionTime', 'taskDate'].flatMap(field => (
    ['range_today', 'range_overlap_today'].map(operator => ({
        id: `${field}-${operator}`, conditions: [
            { field: 'done', operator: '=', value: false }, { field, operator, value: '' },
        ], sort: [],
    }))
))];
state.filterRules = rules;
const visible = () => {
    context.applyFilters();
    return Array.from(state.filteredTasks, task => task.id);
};
for (const scope of ['all', 'health']) {
    state.activeDocId = scope;
    for (const view of ['list', 'checklist', 'kanban', 'timeline', 'whiteboard']) {
        state.viewMode = view;
        for (const rule of rules) {
            state.currentRule = rule.id;
            for (const [day, expected] of [
                ['2026-10-22', ['chest', 'ordinary']], ['2026-10-23', ['abs']],
                ['2026-10-24', ['chest']], ['2026-10-25', ['abs']],
            ]) {
                now = new Date(`${day}T12:00:00`).getTime();
                for (const task of tasks) context.normalizeTaskFields(task, '健康', { todayDateKey: day });
                assert.deepEqual(visible(), expected, `${scope}/${view}/${rule.id}/${day}: only today's plan is visible`);
                assert.deepEqual(alternating.map(task => task.repeatRule.anchorDate), ['2026-10-22', '2026-10-23'],
                    'loading and refreshing tasks must preserve the staggered plan anchors');
            }
        }
    }
}

// SQL attributes and the metadata fallback use the same saved schedule.
for (const source of ['repeat_rule', 'custom-repeat-rule', 'metadata']) {
    for (const type of ['daily', 'weekly', 'monthly', 'yearly']) {
        const savedRule = { enabled: true, trigger: 'checkin', type, every: 2, anchorDate: '2026-10-23', weekdays: [5] };
        const loaded = { id: `${source}-${type}`, startDate: '2026-10-01', completionTime: '2026-10-22' };
        if (source === 'metadata') context.MetaStore.get = () => ({ repeatRule: savedRule });
        else loaded[source] = JSON.stringify(savedRule);
        for (const day of ['2026-10-22', '2026-10-24']) {
            context.normalizeTaskFields(loaded, '健康', { todayDateKey: day });
            assert.equal(loaded.repeatRule.anchorDate, savedRule.anchorDate, `${source}/${type}: preserve the saved anchor after refresh`);
            assert.equal(loaded.repeat_rule.anchorDate, savedRule.anchorDate, 'the rule alias must also retain the plan');
        }
        context.MetaStore.get = () => null;
    }
}
for (const [dates, expected] of [
    [{ startDate: '2026-10-01', completionTime: '2026-10-02' }, '2026-10-01'],
    [{ completionTime: '2026-10-02' }, '2026-10-02'],
    [{}, '2026-10-22'],
]) {
    const loaded = { id: 'legacy-without-anchor', ...dates, repeatRule: { enabled: true, type: 'daily', trigger: 'checkin', every: 2 } };
    context.normalizeTaskFields(loaded, '健康', { todayDateKey: '2026-10-22' });
    assert.equal(loaded.repeatRule.anchorDate, expected, 'legacy rules fall back to stored dates before today');
}
console.log('alternating check-in plans follow Today filters across task views and document scopes');
