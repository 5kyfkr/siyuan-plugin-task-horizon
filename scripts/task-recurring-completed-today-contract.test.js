'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const modelSource = read('src/task-horizon/main/task-runtime/50-task-model-and-repeat-utils.js');
const completedGroupSource = read('src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js');

function extractFunction(source, name) {
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `${name} must exist`);
    const bodyStart = source.indexOf('{', source.indexOf(')', start));
    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        if (source[index] !== '}') continue;
        depth -= 1;
        if (depth === 0) return source.slice(start, index + 1);
    }
    throw new Error(`Unable to extract ${name}`);
}

const repeatStart = modelSource.indexOf('function __tmNormalizeDateOnly(');
const repeatEnd = modelSource.indexOf('function __tmGetTaskRepeatWeekdayLabel', repeatStart);
assert.ok(repeatStart >= 0 && repeatEnd > repeatStart, 'repeat helper block must remain extractable');

const settings = {
    data: {
        completedTasksTodayOnly: true,
        customStatusOptions: [],
    },
};
const context = vm.createContext({
    Date,
    Intl,
    Math,
    Number,
    String,
    JSON,
    SettingsStore: settings,
    esc: (value) => String(value || ''),
    normalizeTaskFields: () => {},
    __tmReadTaskMetaAttrValue: () => '',
    __tmResolveCheckboxLinkedStatusId: () => 'done',
    __tmGetTaskMetaAttrKey: () => 'custom-task-complete-at',
    __tmIsTaskDoneEffective: (task) => task?.done === true,
});
vm.runInContext([
    modelSource.slice(repeatStart, repeatEnd),
    extractFunction(modelSource, '__tmResolveTaskCompletedAtRaw'),
    extractFunction(modelSource, '__tmGetTaskCompletedAtDateKey'),
    extractFunction(modelSource, '__tmIsTaskCompletedToday'),
    extractFunction(modelSource, '__tmIsRecurringInstanceTask'),
    extractFunction(modelSource, '__tmRenderCompletedTodayBadge'),
    extractFunction(modelSource, '__tmBuildRecurringInstanceTask'),
    extractFunction(completedGroupSource, '__tmShouldShowTaskInCompletedRootGroup'),
    'this.__test = { __tmNormalizeTaskRepeatRule, __tmBuildRecurringInstanceTask, __tmIsTaskCompletedToday, __tmRenderCompletedTodayBadge, __tmShouldShowTaskInCompletedRootGroup };',
].join('\n'), context);

const today = new Date();
const pad = (value) => String(value).padStart(2, '0');
const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
const completedAt = `${todayKey}T10:30:00+08:00`;
const repeatCases = [
    ['daily', { enabled: true, type: 'daily', every: 1 }],
    ['custom-daily', { enabled: true, type: 'daily', every: 3 }],
    ['workday', { enabled: true, type: 'workday', every: 1 }],
    ['weekly-due-day', { enabled: true, type: 'weekly', every: 1, weekdays: [] }],
    ['weekly-single-day', { enabled: true, type: 'weekly', every: 1, weekdays: [1] }],
    ['weekly-multiple-days', { enabled: true, type: 'weekly', every: 1, weekdays: [1, 3, 5] }],
    ['monthly-date', { enabled: true, type: 'monthly', every: 1, monthlyMode: 'date' }],
    ['monthly-weekday', { enabled: true, type: 'monthly', every: 1, monthlyMode: 'weekday' }],
    ['lunar-monthly', { enabled: true, type: 'monthly', every: 1, monthlyMode: 'date', calendarMode: 'lunar' }],
    ['yearly', { enabled: true, type: 'yearly', every: 1 }],
    ['lunar-yearly', { enabled: true, type: 'yearly', every: 1, calendarMode: 'lunar' }],
    ['fsrs', { enabled: true, type: 'fsrs' }],
];

repeatCases.forEach(([label, ruleInput], index) => {
    const repeatRule = context.__test.__tmNormalizeTaskRepeatRule({
        ...ruleInput,
        anchorDate: todayKey,
    });
    const sourceTask = {
        id: `task-${index}`,
        done: false,
        content: label,
        root_id: 'doc-1',
        docName: 'Tasks',
        repeatRule,
        repeatState: { occurrenceCount: 2, lastCompletedAt: completedAt },
    };
    const virtualTask = context.__test.__tmBuildRecurringInstanceTask(sourceTask, {
        completedAt,
        occurrenceNumber: 1,
        sourceStart: todayKey,
        sourceDue: todayKey,
        content: label,
        docId: 'doc-1',
        docName: 'Tasks',
    }, 0);

    assert.ok(virtualTask, `${label} must build a recurring completion record`);
    assert.equal(virtualTask.done, true, `${label} completion record must remain completed`);
    assert.equal(virtualTask.taskCompleteAt, completedAt, `${label} must preserve the exact completion time`);
    assert.equal(context.__test.__tmIsTaskCompletedToday(virtualTask, todayKey), true,
        `${label} completed today must pass the shared today predicate`);
    assert.equal(context.__test.__tmShouldShowTaskInCompletedRootGroup(virtualTask), true,
        `${label} completed today must survive the today-only completed-group filter`);
    assert.match(context.__test.__tmRenderCompletedTodayBadge(virtualTask, {
        todayKey,
        inCompletedRootGroup: false,
    }), /tm-task-completed-today-badge[^>]*>今天</,
        `${label} completed today must render the today badge`);
});

const ordinaryCompletedToday = {
    id: 'ordinary-completed-today',
    done: true,
    taskCompleteAt: completedAt,
};
assert.equal(context.__test.__tmShouldShowTaskInCompletedRootGroup(ordinaryCompletedToday), true,
    'ordinary tasks completed today must survive the completed-today-only filter');
assert.equal(context.__test.__tmRenderCompletedTodayBadge(ordinaryCompletedToday, {
    todayKey,
    inCompletedRootGroup: false,
}), '', 'ordinary completed tasks outside the completed root group must keep the existing badge behavior');
assert.match(context.__test.__tmRenderCompletedTodayBadge(ordinaryCompletedToday, {
    todayKey,
    inCompletedRootGroup: true,
}), /tm-task-completed-today-badge[^>]*>今天</,
'ordinary completed tasks in the completed root group must still render the today badge');
const ordinaryCompletedEarlier = {
    id: 'ordinary-completed-earlier',
    done: true,
    taskCompleteAt: '2000-01-01T10:30:00+08:00',
};
assert.equal(context.__test.__tmShouldShowTaskInCompletedRootGroup(ordinaryCompletedEarlier), false,
    'ordinary tasks completed before today must be excluded by the completed-today-only filter');

const viewContracts = [
    ['list', read('src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js')],
    ['checklist', read('src/task-horizon/main/render/42-render-list-and-checklist-body.js')],
    ['timeline-and-kanban', read('src/task-horizon/main/render/43-render-timeline-kanban-calendar-body.js')],
    ['whiteboard', read('src/task-horizon/main/render/44-render-whiteboard-body.js')],
    ['legacy-timeline', read('src/task-horizon/main/20-api-and-runtime-services.js')],
];
viewContracts.forEach(([label, source]) => {
    const calls = source.match(/__tmRenderCompletedTodayBadge\(task,\s*\{[^}]*\}\)/g) || [];
    assert.ok(calls.length > 0,
        `${label} completed groups must render the shared today badge`);
    calls.forEach((call) => assert.match(call, /inCompletedRootGroup/,
        `${label} must let the shared badge helper handle recurring records outside the completed root group`));
    assert.doesNotMatch(source, /\?\s*__tmRenderCompletedTodayBadge\(/,
        `${label} must not discard recurring records before calling the shared badge helper`);
});
assert.ok((viewContracts[2][1].match(/__tmRenderCompletedTodayBadge\(/g) || []).length >= 2,
    'timeline and kanban must each render the shared today badge');
const kanbanSource = viewContracts[2][1];
assert.match(kanbanSource,
    /showDoneCol && key === '__done__' && !__tmShouldShowTaskInCompletedRootGroup\(task\)/,
    'the standalone kanban completed column must honor the completed-today-only filter');
const renderDoneColumnStart = kanbanSource.indexOf('const renderDoneColumnList =');
const renderDoneColumnEnd = kanbanSource.indexOf('\n                };', renderDoneColumnStart);
assert.ok(renderDoneColumnStart >= 0 && renderDoneColumnEnd > renderDoneColumnStart,
    'the standalone kanban completed column renderer must remain extractable');
const renderDoneColumn = kanbanSource.slice(renderDoneColumnStart, renderDoneColumnEnd);
assert.match(renderDoneColumn, /renderCard\([\s\S]*false,\s*true\s*\)/,
    'standalone completed-column cards must render ordinary completed-today badges');

console.log('task recurring completed-today contract tests passed');
