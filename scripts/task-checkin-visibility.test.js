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
let now = new Date(2026, 8, 30, 12).getTime();
class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
    static [Symbol.hasInstance](value) { return value instanceof Date; }
}
const task = {
    id: 'checkin', root_id: 'doc', done: false, content: 'Check-in', children: [],
    repeatRule: { enabled: true, trigger: 'checkin', type: 'weekly', every: 1, weekdays: [1, 3, 5], anchorDate: '2026-09-28' },
    repeatState: {},
};
const ordinary = { id: 'ordinary', root_id: 'doc', done: false, children: [] };
const completed = { id: 'completed', root_id: 'doc', done: true, children: [] };
const flatTasks = Object.fromEntries([task, ordinary, completed].map(item => [item.id, item]));
const state = {
    taskTree: [{ id: 'doc', tasks: Object.values(flatTasks) }], flatTasks,
    activeDocId: 'all', otherBlocks: [], showCompletedTasks: false, groupByDocName: true, searchKeyword: '',
};
const context = vm.createContext({
    console, Date: Clock, Map, Set, state,
    SettingsStore: { data: { currentGroupId: 'all' } },
    window: { dispatchEvent() {} }, CustomEvent: class {},
    __tmTaskStore: { revision: () => 0, getFlatMap: () => flatTasks },
    __tmGetCurrentRule: () => ({ conditions: [] }),
    __tmGetArchiveModeFilterRule: value => value,
    __tmRuleUsesCustomOrderSort: () => false,
    __tmIsOtherBlockTabId: () => false,
    __tmParseDocTabCustomGroupActiveId: () => '',
    __tmGetActiveDocTabCustomGroupDocIdSet: () => new Set(),
    __tmSortDocEntriesForTabs: docs => docs,
    __tmShouldIncludeDocInActiveAggregateTaskScope: () => true,
    __tmIsTaskNativeDone: value => value.done === true,
    __tmIsTaskCanceled: () => false,
    __tmRuleIncludesCanceledStatus: () => false,
    __tmRuleHasExplicitSort: () => false,
    __tmIsAllRuleLike: () => true,
    __tmHasActiveDocTabContentFilter: () => true,
    __tmRuleUsesDocFlowSort: () => true,
    __tmDocShouldShowInDocTabs: () => true,
    __tmIsCollectedOtherBlockTask: () => false,
    __tmApplyWhiteboardSequenceFilter: values => values,
    __tmUpdateFilteredTaskRenderWindowState() {},
    RuleManager: { applyRuleFilter: values => values, applyRuleSort: values => values },
});
const model = read('task-runtime/50-task-model-and-repeat-utils.js');
vm.runInContext(extract(model, '__tmNormalizeDateOnly'), context);
vm.runInContext(model.slice(model.indexOf('function __tmParseTaskRepeatJson'), model.indexOf('function __tmGetTaskRepeatWeekdayLabel')), context);
vm.runInContext(extract(read('20-api-and-runtime-services.js'), '__tmIsTaskDoneEffective'), context);
context.__tmTaskBoundary = { isTaskCompleted: context.__tmIsTaskDoneEffective };
vm.runInContext(read('34-task-projection-engine.js'), context);
const views = read('task-runtime/51-whiteboard-and-link-runtime.js');
for (const name of ['__tmIsTaskCompletedForProjection', '__tmResolveHideCompletedDescendantsFlag', '__tmShouldKeepChildTaskVisible']) {
    vm.runInContext(extract(views, name), context);
}
const filters = read('30-dialogs-and-ui-foundation.js');
vm.runInContext(filters.slice(filters.indexOf('    function applyFilters()'), filters.indexOf('    function __tmIsTaskAndDescDone(')), context);
const visible = () => {
    context.applyFilters();
    return Array.from(state.filteredTasks, item => item.id);
};
const check = day => {
    task.repeatState = { checkinHistory: [{ scheduledDate: day, checkedAt: `${day}T12:00:00+08:00` }] };
};
const engine = context.__tmTaskProjectionEngine;
for (const scope of ['all', 'doc']) {
    state.activeDocId = scope;
    for (const view of ['list', 'checklist', 'kanban', 'timeline', 'whiteboard']) {
        state.viewMode = view;
        state.showCompletedTasks = false;
        task.repeatState = {};
        assert.deepEqual(visible(), ['checkin', 'ordinary'], `${scope}/${view}: today's pending check-in is visible`);
        check('2026-09-30');
        assert.deepEqual(visible(), ['ordinary'], `${scope}/${view}: today's check-in obeys hide completed`);
        assert.equal(engine.isKanbanTaskVisibleByCompletion(task, false), false);
        assert.equal(context.__tmShouldKeepChildTaskVisible(ordinary, task), false);
        assert.equal(context.__tmIsTaskDoneEffective(task), false, 'visibility must not change permanent completion');
        assert.equal(task.done, false);
        state.showCompletedTasks = true;
        assert.deepEqual(visible(), ['checkin', 'ordinary', 'completed']);
        assert.equal(context.__tmShouldKeepChildTaskVisible(ordinary, task), true);
        state.showCompletedTasks = false;
        task.repeatState = {};
        assert.deepEqual(visible(), ['checkin', 'ordinary'], 'undo restores the task');
        check('2026-09-29');
        assert.deepEqual(visible(), ['checkin', 'ordinary'], 'a make-up for yesterday does not hide today');
    }
}
now = new Date(2026, 8, 29, 12).getTime();
check('2026-09-29');
assert.deepEqual(visible(), ['ordinary'], 'an extra check-in on Tuesday also obeys the toggle');
task.done = true; // native note marker may remain checked after the previous day
now = new Date(2026, 8, 30, 12).getTime();
assert.deepEqual(visible(), ['checkin', 'ordinary'], 'a new day restores visibility even with a stale native done marker');
assert.equal(engine.isKanbanTaskVisibleByCompletion(task, false), true);
task.repeatRule.enabled = false;
assert.deepEqual(visible(), ['ordinary'], 'disabling check-in restores ordinary completion semantics');
console.log('check-in completion visibility, undo, extra check-in and rollover tests passed');
