'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'task-horizon', 'main', '10-stores-rules-and-cache.js'),
    'utf8',
);

function sliceSource(startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    assert.ok(start >= 0, `missing source marker: ${startMarker}`);
    const end = source.indexOf(endMarker, start);
    assert.ok(end > start, `missing source marker: ${endMarker}`);
    return source.slice(start, end);
}

const customFieldDefs = [
    { id: 'notes', name: '说明', type: 'text', options: [] },
    {
        id: 'stage',
        name: '阶段',
        type: 'single',
        options: [
            { id: 'later', name: '稍后' },
            { id: 'now', name: '当前' },
        ],
    },
    {
        id: 'tags',
        name: '标签',
        type: 'multi',
        options: [
            { id: 'red', name: '红色' },
            { id: 'blue', name: '蓝色' },
        ],
    },
];

const context = vm.createContext({
    console,
    Date,
    Intl,
    Map,
    Set,
    WeakMap,
    SettingsStore: {
        data: {
            taskHeadingLevel: 'h2',
            settingsUpdatedAt: 1,
            customFieldDefsVersion: 1,
            customStatusOptions: [],
            columnOrder: [],
        },
    },
    state: {},
    __TM_CUSTOM_ORDER_SORT_FIELD: '__customOrder',
    __tmParseVersionNumber: (value) => Number(value) || 0,
    __tmGetCustomFieldDefs: () => customFieldDefs,
    __tmBuildCustomFieldColumnKey: (fieldId) => `customField:${String(fieldId || '').trim()}`,
    __tmParseCustomFieldColumnKey: (key) => {
        const raw = String(key || '').trim();
        return raw.startsWith('customField:') ? raw.slice('customField:'.length) : '';
    },
    __tmGetTaskCustomFieldValue: (task, fieldId) => task?.customFieldValues?.[fieldId] ?? '',
    __tmGetStatusOptions: (options) => Array.isArray(options) ? options : [],
    __tmGetDefaultUndoneStatusId: (options) => String(options?.[0]?.id || ''),
    __tmRuleUsesDocFlowSort: () => false,
    __tmRuleUsesCustomOrderSort: () => false,
    __tmGetNormalizedRuleSorts: (rule) => Array.isArray(rule?.sort) ? rule.sort : [],
    __tmShouldUseBestSubtaskTimeForSort: () => false,
    __tmGetTaskEffectiveCompletionTimeSortValue: () => 0,
    __tmEnsureTaskPriorityScore: (task) => Number(task?.priorityScore || 0),
    __tmParseDurationMinutes: (value) => Number(value) || 0,
    __tmParseTimeToTs: (value) => Date.parse(value) || 0,
    __tmIsTaskDoneEffective: (task) => task?.done === true,
    __tmCompareTasksByDocFlow: (a, b) => Number(a?.resolvedFlowRank) - Number(b?.resolvedFlowRank),
});

const ruleManagerSource = sliceSource(
    'const RuleManager = {',
    '    const __tmTasksQueryCache',
);
vm.runInContext(`${ruleManagerSource}\nglobalThis.ruleManager = RuleManager;`, context);
const RuleManager = context.ruleManager;

const fieldMap = new Map(
    Array.from(RuleManager.getAvailableFields(), (field) => [field.value, field]),
);
assert.equal(fieldMap.get('customField:notes')?.type, 'text');
assert.equal(fieldMap.get('customField:notes')?.customFieldId, 'notes');
assert.equal(fieldMap.get('customField:stage')?.type, 'select');
assert.equal(fieldMap.get('customField:tags')?.type, 'select');
assert.equal(fieldMap.get('customField:tags')?.multi, true);

const sortFieldIds = new Set(Array.from(RuleManager.getSortFields(), (field) => field.value));
assert.equal(sortFieldIds.has('customField:notes'), true);
assert.equal(sortFieldIds.has('customField:stage'), true);
assert.equal(sortFieldIds.has('customField:tags'), true);

assert.deepEqual(
    Array.from(RuleManager.getOperators('text'), (operator) => operator.value),
    ['=', '!=', 'in', 'not_in', 'contains', 'not_contains'],
);

const tasks = [
    { id: 'alpha10', customFieldValues: { notes: 'Alpha 10' } },
    { id: 'alpha2', customFieldValues: { notes: 'alpha 2' } },
    { id: 'project10', customFieldValues: { notes: '项目10' } },
    { id: 'project2', customFieldValues: { notes: '项目2' } },
    { id: 'empty', customFieldValues: { notes: '' } },
];
const filterIds = (operator, value) => Array.from(
    RuleManager.applyRuleFilter(tasks, {
        id: 'custom-text-filter',
        conditions: [{ field: 'customField:notes', operator, value }],
    }),
    (task) => task.id,
);

assert.deepEqual(filterIds('=', 'ALPHA 10'), ['alpha10']);
assert.deepEqual(filterIds('!=', 'ALPHA 10'), ['alpha2', 'project10', 'project2', 'empty']);
assert.deepEqual(filterIds('contains', 'ALPHA'), ['alpha10', 'alpha2']);
assert.deepEqual(filterIds('not_contains', 'ALPHA'), ['project10', 'project2', 'empty']);
assert.deepEqual(filterIds('in', 'Alpha 10,项目2'), ['alpha10', 'project2']);
assert.deepEqual(filterIds('not_in', 'Alpha 10,项目2'), ['alpha2', 'project10', 'empty']);
assert.deepEqual(filterIds('=', ''), ['empty']);

const sortIds = (sourceTasks, field, order) => Array.from(
    RuleManager.applyRuleSort(sourceTasks, {
        id: 'custom-field-sort',
        sort: [{ field, order }],
    }),
    (task) => task.id,
);
const ascending = sortIds(tasks, 'customField:notes', 'asc');
assert.ok(ascending.indexOf('alpha2') < ascending.indexOf('alpha10'));
assert.ok(ascending.indexOf('project2') < ascending.indexOf('project10'));
assert.equal(ascending.at(-1), 'empty');

const descending = sortIds(tasks, 'customField:notes', 'desc');
assert.ok(descending.indexOf('alpha10') < descending.indexOf('alpha2'));
assert.ok(descending.indexOf('project10') < descending.indexOf('project2'));
assert.equal(descending.at(-1), 'empty');

assert.deepEqual(
    sortIds([
        { id: 'same-first', customFieldValues: { notes: 'Same' } },
        { id: 'same-second', customFieldValues: { notes: 'same' } },
    ], 'customField:notes', 'asc'),
    ['same-first', 'same-second'],
);
assert.deepEqual(
    sortIds([
        { id: 'normal', customFieldValues: { notes: 'A' } },
        { id: 'pinned-empty', pinned: true, customFieldValues: { notes: '' } },
    ], 'customField:notes', 'asc'),
    ['pinned-empty', 'normal'],
);

const staleSameValueTasks = [1, 5, 2, 3, 4].map((id) => ({
    id: String(id),
    root_id: 'doc-1',
    resolvedFlowRank: id,
    customFieldValues: { notes: 'same' },
}));
assert.deepEqual(
    sortIds(staleSameValueTasks, 'customField:notes', 'asc'),
    ['1', '2', '3', '4', '5'],
    'equal rule values must use authoritative document order instead of stale source order',
);
assert.deepEqual(
    Array.from(RuleManager.applyRuleSort(staleSameValueTasks, { id: 'all', sort: [] }), (task) => task.id),
    ['1', '2', '3', '4', '5'],
    'the default no-rule sort must use authoritative document order',
);
context.__tmRuleUsesDocFlowSort = () => true;
assert.deepEqual(
    Array.from(RuleManager.applyRuleSort(staleSameValueTasks, { id: 'all', sort: [] }), (task) => task.id),
    ['1', '2', '3', '4', '5'],
    'the explicit document-flow rule must use authoritative document order',
);
context.__tmRuleUsesDocFlowSort = () => false;

assert.deepEqual(
    sortIds([
        { id: 'stage-now', customFieldValues: { stage: 'now' } },
        { id: 'stage-later', customFieldValues: { stage: 'later' } },
    ], 'customField:stage', 'asc'),
    ['stage-later', 'stage-now'],
);
assert.deepEqual(
    sortIds([
        { id: 'tag-blue', customFieldValues: { tags: ['blue'] } },
        { id: 'tag-red', customFieldValues: { tags: ['red'] } },
    ], 'customField:tags', 'asc'),
    ['tag-red', 'tag-blue'],
);

vm.runInContext(sliceSource(
    'function __tmNormalizePriorityCustomFieldDelta',
    '    function __tmCollectCustomFieldLoadPlan',
), context);
vm.runInContext(sliceSource(
    'function __tmCollectCustomFieldLoadPlan',
    '    function __tmNormalizeCustomFieldIdList',
), context);
vm.runInContext(sliceSource(
    'function __tmNormalizeCustomFieldIdList',
    '    function __tmBuildRuntimeCustomFieldLoadPlan',
), context);
vm.runInContext(sliceSource(
    'function __tmDoesCustomFieldPlanNeedReload',
    '    async function __tmCommitCustomFieldLoadPlan',
), context);

const loadPlan = vm.runInContext(`__tmCollectCustomFieldLoadPlan({
    viewMode: 'list',
    colOrder: [],
    rule: {
        conditions: [{ field: 'customField:notes', operator: 'contains', value: '项目' }],
        sort: [{ field: 'customField:notes', order: 'asc' }],
    },
})`, context);
assert.deepEqual(Array.from(loadPlan.bulkFieldIds), ['notes']);
assert.equal(vm.runInContext(
    `__tmDoesCustomFieldPlanNeedReload({ bulkFieldIds: [] }, { bulkFieldIds: ['notes'] })`,
    context,
), true);

process.stdout.write('custom text rule contract tests passed\n');
