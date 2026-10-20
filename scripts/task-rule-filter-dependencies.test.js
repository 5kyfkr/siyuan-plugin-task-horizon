'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = (name) => fs.readFileSync(path.join(__dirname, '../src/task-horizon/main', name), 'utf8');
const stores = read('10-stores-rules-and-cache.js');
const from = stores.indexOf('const RuleManager = {');
const to = stores.indexOf('    const __tmTasksQueryCache', from);
assert.ok(from >= 0 && to > from);
const context = vm.createContext({
    Map, Set, Date, Intl,
    SettingsStore: { data: { customStatusOptions: [{ id: 'todo', name: '待办' }, { id: 'doing', name: '进行中' }], columnOrder: [] } },
    __tmParseVersionNumber: (value) => Number(value) || 0,
    __tmGetCustomFieldDefs: () => ['text', 'single', 'multi'].map((type) => ({
        id: type, name: type, type, options: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    })),
    __tmBuildCustomFieldColumnKey: (id) => `customField:${id}`,
    __tmGetStatusOptions: (options) => options,
    __tmGetDefaultUndoneStatusId: () => 'todo',
    __tmParseCustomFieldColumnKey: (key) => key.startsWith('customField:') ? key.slice(12) : '',
    __tmParseTimeToTs: (value) => Date.parse(value) || 0,
    __tmNormalizeActualTomatoCountValue: (value) => String(value || ''),
    __tmNormalizeTomatoCountValue: (value) => String(value ?? ''),
    __tmEnsureTaskPriorityScore: (task) => Number(task.priorityScore || 0),
    __tmGetTaskTomatoEstimateCount: (task) => Number(task.tomatoEstimateCount || 0),
    __tmResolveTaskStatusId: (task) => task.customStatus || 'todo',
    __tmIsTaskDoneEffective: (task) => task.done === true,
    __tmIsTaskCanceled: (task) => task.taskMarker === '-',
    __tmGetTaskCustomFieldValue: (task, id) => task.customFieldValues?.[id] ?? '',
});
vm.runInContext(stores.slice(from, to) + '\nglobalThis.ruleManager = RuleManager;', context);
vm.runInContext(read('09-task-field-schema.js'), context);
vm.runInContext(read('34-task-projection-engine.js'), context);
const manager = context.ruleManager;
const engine = context.__tmTaskProjectionEngine;
const base = { viewMode: 'kanban', groupMode: 'doc' };
let checked = 0;

for (const field of manager.getAvailableFields()) {
    const patch = field.customFieldId
        ? { customFieldValues: { [field.customFieldId]: field.multi ? ['a'] : 'a' } }
        : { [field.value]: 'changed' };
    for (const operator of manager.getOperators(field.type)) {
        const rule = { conditions: [{ field: field.value, operator: operator.value, value: 'a' }] };
        assert.equal(engine.analyzePatch(patch, { ...base, rule }).filter, true,
            `${field.value} / ${operator.value}: editing the filtered field must recompute membership`);
        checked++;
    }
    assert.equal(engine.analyzePatch(patch, { ...base, rule: { sort: [{ field: field.value }] } }).sort, true,
        `${field.value}: editing a sort field must recompute order`);
}

for (const field of ['startDate', 'completionTime', 'repeatRule', 'repeatState', 'repeatHistory']) {
    for (const rule of [
        { conditions: [{ field: 'taskDate', operator: 'range_today' }] },
        { sort: [{ field: 'taskDate' }] },
        { conditions: [{ field: 'completionTime', operator: 'range_today' }] },
        { sort: [{ field: 'completionTime' }] },
    ]) {
        assert.equal(engine.analyzePatch({ [field]: 'changed' }, { ...base, rule }).projection, true,
            `planned task dates must depend on ${field} for both filtering and sorting`);
    }
}

for (const field of ['tomatoMinutes', 'tomatoHours', 'repeatRule', 'repeatState', 'repeatHistory']) {
    for (const rule of [
        { conditions: [{ field: 'tomatoCount', operator: '>=', value: 2 }] },
        { sort: [{ field: 'tomatoCount' }] },
    ]) {
        assert.equal(engine.analyzePatch({ [field]: 'changed' }, { ...base, rule }).projection, true,
            `actual tomato count must follow spent time and recurring baselines: ${field}`);
    }
}

for (const dateField of manager.getAvailableFields().filter((field) => field.type === 'datetime')) {
    for (const changed of ['startDate', 'completionTime']) {
        const rule = { conditions: [{ field: dateField.value, operator: 'range_overlap_today' }] };
        assert.equal(engine.analyzePatch({ [changed]: 'changed' }, { ...base, rule }).filter, true,
            `${dateField.value} / range_overlap_today: overlap must depend on both interval endpoints`);
    }
}

for (const patch of [{ remark: 'edit' }, { customFieldValues: { text: '' } }]) {
    assert.equal(engine.analyzePatch(patch, { ...base, rule: { conditions: [{ field: 'updated', operator: 'range_today' }] } }).filter, true,
        'local edits also advance the task updated timestamp');
    assert.equal(engine.analyzePatch(patch, { ...base, rule: { sort: [{ field: 'updated' }] } }).sort, true,
        'updated sorting must advance after any local field edit');
}

for (const type of ['text', 'single', 'multi']) {
    const rule = { conditions: [{ field: `customField:${type}`, operator: 'is_empty' }] };
    assert.equal(engine.analyzePatch({ customFieldValues: { [type]: type === 'multi' ? [] : '' } }, { ...base, rule }).filter, true,
        'clearing a custom field must recompute empty-value filters');
    assert.equal(engine.analyzePatch({ customFieldValues: { unrelated: 'edit' } }, { ...base, rule }).projection, false,
        'unrelated custom columns must not change filter membership');
}

// Use the real field readers and matcher to check derived membership after an
// edit, including cases where the displayed filter field is absent from patch.
const tomatoFrom = stores.indexOf('function __tmGetDefaultTomatoTimeMinutes(');
const tomatoTo = stores.indexOf('function __tmGetMeasureFontFromStyle(', tomatoFrom);
vm.runInContext(stores.slice(tomatoFrom, tomatoTo), context);
const now = new Date(2026, 9, 15, 12);
function expectMembership(condition, task, patch, before, after) {
    const rule = { conditions: [condition] };
    const matches = () => manager.applyRuleFilter([task], rule, { nowDate: now }).length > 0;
    assert.equal(matches(), before, `${condition.field}: initial membership`);
    const analysis = engine.analyzePatch(patch, { ...base, rule });
    Object.assign(task, patch);
    assert.equal(analysis.filter ? matches() : before, after,
        `${condition.field}: local projection must update membership without manual refresh`);
}
expectMembership({ field: 'taskDate', operator: 'is_empty' }, {}, { completionTime: '2026-10-15' }, true, false);
expectMembership({ field: 'taskDate', operator: 'is_empty' }, { startDate: '2026-10-15' }, { startDate: '' }, false, true);
expectMembership({ field: 'completionTime', operator: 'range_overlap_today' },
    { startDate: '2026-10-16', completionTime: '2026-10-17' }, { startDate: '2026-10-14' }, false, true);
expectMembership({ field: 'startDate', operator: 'range_overlap_today' },
    { startDate: '2026-10-14', completionTime: '2026-10-14' }, { completionTime: '2026-10-16' }, false, true);
expectMembership({ field: 'tomatoCount', operator: '>=', value: 2 },
    { tomatoMinutes: 30 }, { tomatoMinutes: 90 }, false, true);
context.SettingsStore.data.tomatoSpentAttrMode = 'hours';
expectMembership({ field: 'tomatoCount', operator: '>=', value: 2 },
    { tomatoHours: 0.5 }, { tomatoHours: 1.5 }, false, true);

context.SettingsStore.data.tomatoActualCountBySpentEnabled = false;
const numericCases = [
    ['=', '2', ['two']], ['!=', '2', ['zero', 'one', 'ten']],
    ['in', ['0', '2'], ['zero', 'two']], ['not_in', ['0', '2'], ['one', 'ten']],
    ['contains', '1', ['one', 'ten']], ['not_contains', '1', ['zero', 'two']],
    ['is_empty', '', []], ['is_not_empty', '', ['zero', 'one', 'two', 'ten']],
    ['>', '2', ['ten']], ['<', '2', ['zero', 'one']],
    ['>=', '2', ['two', 'ten']], ['<=', '2', ['zero', 'one', 'two']],
    ['between', { from: '1', to: '2' }, ['one', 'two']],
    ['between', '1,2', ['one', 'two']],
];
for (const field of manager.getAvailableFields().filter((field) => field.type === 'number')) {
    const tasks = [0, 1, 2, 10].map((value, index) => ({ id: ['zero', 'one', 'two', 'ten'][index], [field.value]: value }));
    for (const [operator, value, expected] of numericCases) {
        const rule = { conditions: [{ field: field.value, operator, value }] };
        assert.deepEqual(Array.from(manager.applyRuleFilter(tasks, rule), (task) => task.id), expected,
            `${field.value} / ${operator}: numeric operators must evaluate their actual values, including zero`);
    }
}

for (const field of manager.getAvailableFields().filter((field) => field.type === 'datetime')) {
    const key = field.value === 'taskDate' ? 'completionTime' : field.value;
    const tasks = [{ id: 'same', [key]: '2026-10-15 10:00' }, { id: 'later', [key]: '2026-10-15 11:00' }];
    for (const [operator, expected] of [['=', ['same']], ['!=', ['later']]]) {
        const rule = { conditions: [{ field: field.value, operator, value: '2026-10-15T10:00' }] };
        assert.deepEqual(Array.from(manager.applyRuleFilter(tasks, rule), (task) => task.id), expected,
            `${field.value}: equivalent stored and input date formats must compare by time`);
    }
}

for (const field of manager.getAvailableFields().filter((field) => field.type === 'text' || field.type === 'select')) {
    const values = field.type === 'select' ? [field.options[0], field.options[1]] : ['Alpha', 'Beta'];
    const makeTask = (id, value) => field.customFieldId
        ? { id, customFieldValues: { [field.customFieldId]: field.multi ? [value] : value } }
        : { id, [field.value]: value };
    const tasks = [makeTask('first', values[0]), makeTask('second', values[1])];
    for (const operator of ['=', 'in', 'contains', '!=', 'not_in', 'not_contains']) {
        const rule = { conditions: [{ field: field.value, operator, value: values[0] }] };
        const expected = ['!=', 'not_in', 'not_contains'].includes(operator) ? ['second'] : ['first'];
        assert.deepEqual(Array.from(manager.applyRuleFilter(tasks, rule), (task) => task.id), expected,
            `${field.value} / ${operator}: text and selected options must use actual membership`);
    }
}

const multiTasks = [
    { id: 'a', customFieldValues: { multi: ['a'] } },
    { id: 'b', customFieldValues: { multi: ['b'] } },
    { id: 'both', customFieldValues: { multi: ['a', 'b'] } },
    { id: 'empty', customFieldValues: { multi: [] } },
];
for (const [matchMode, operator, expected] of [
    ['any', 'in', ['a', 'b', 'both']], ['all', 'in', ['both']],
    ['any', 'not_in', ['empty']], ['all', 'not_in', ['a', 'b', 'empty']],
]) {
    const rule = { conditions: [{ field: 'customField:multi', operator, matchMode, value: ['a', 'b'] }] };
    assert.deepEqual(Array.from(manager.applyRuleFilter(multiTasks, rule), (task) => task.id), expected,
        `custom multi / ${matchMode} / ${operator}: compiled conditions must retain the selected match mode`);
}

const dateCases = [
    ['=', '2026-10-15T10:00', ['today']], ['!=', '2026-10-15T10:00', ['empty', 'past', 'future', 'far']],
    ['in', ['2026-10-15 10:00', '2026-10-16 10:00'], ['today', 'future']],
    ['not_in', ['2026-10-15 10:00', '2026-10-16 10:00'], ['empty', 'past', 'far']],
    ['contains', '2026-10', ['past', 'today', 'future']], ['not_contains', '2026-10', ['empty', 'far']],
    ['is_empty', '', ['empty']], ['is_not_empty', '', ['past', 'today', 'future', 'far']],
    ['range_today', '', ['today']], ['range_overlap_today', '', ['today']],
    ['range_week', '', ['past', 'today', 'future']], ['range_month', '', ['past', 'today', 'future']],
    ['range_recent_days', '1', ['past', 'today']], ['range_next_days', '1', ['today', 'future']],
    ['range_year', '', ['past', 'today', 'future', 'far']],
    ['before_today', '', ['past']], ['after_today', '', ['future', 'far']],
    ['on_or_before_today', '', ['past', 'today']], ['on_or_after_today', '', ['today', 'future', 'far']],
    ['before', '2026-10-15', ['past']], ['after', '2026-10-15T23:59', ['future', 'far']],
    ['between', { from: '2026-10-14', to: '2026-10-16T23:59' }, ['past', 'today', 'future']],
];
for (const field of manager.getAvailableFields().filter((field) => field.type === 'datetime')) {
    const tasks = ['', '2026-10-14 10:00', '2026-10-15 10:00', '2026-10-16 10:00', '2026-11-20 10:00']
        .map((value, index) => ({ id: ['empty', 'past', 'today', 'future', 'far'][index],
            startDate: value, completionTime: value, [field.value === 'taskDate' ? 'completionTime' : field.value]: value }));
    for (const [operator, value, expected] of dateCases) {
        const rule = { conditions: [{ field: field.value, operator, value }] };
        assert.deepEqual(Array.from(manager.applyRuleFilter(tasks, rule, { nowDate: now }), (task) => task.id), expected,
            `${field.value} / ${operator}: date rules must match the expected interval`);
    }
}
console.log(`task rule filter dependencies: ${manager.getAvailableFields().length} fields, ${checked} field/operator combinations passed`);
