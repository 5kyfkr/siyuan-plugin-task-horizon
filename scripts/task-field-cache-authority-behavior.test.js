'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const main = path.join(__dirname, '../src/task-horizon/main');
const stores = fs.readFileSync(path.join(main, '10-stores-rules-and-cache.js'), 'utf8');
const render = fs.readFileSync(path.join(main, '40-render-runtime.js'), 'utf8');
const extract = (source, name) => {
    let start = source.indexOf('    function ' + name + '(');
    if (start < 0) start = source.indexOf('    async function ' + name + '(');
    const end = source.indexOf('\n    }', start);
    assert.ok(start >= 0 && end > start, 'missing function: ' + name);
    return source.slice(start, end + 6);
};

function createContext(meta = {}) {
    const writes = [];
    const defs = [{ id: 'project', type: 'text' }, { id: 'tag', type: 'text' }];
    const normalizeJson = (value, fallback) => {
        if (value && typeof value === 'object') return value;
        try { return JSON.parse(value) || fallback; } catch (error) { return fallback; }
    };
    const context = vm.createContext({
        Map, Set,
        SettingsStore: { data: { enableTomatoIntegration: true } },
        MetaStore: { get: () => meta },
        __TM_TASK_REPEAT_RULE_ATTR: 'custom-repeat-rule',
        __TM_TASK_REPEAT_STATE_ATTR: 'custom-repeat-state',
        __TM_TASK_REPEAT_HISTORY_ATTR: 'custom-repeat-history',
        __TM_TASK_ATTACHMENT_META_ATTR: 'custom-attachment-meta',
        __tmGetDocDisplayNameMode: () => 'name',
        __tmGetDocDisplayName: (doc, fallback) => fallback,
        __tmGetPerfTuningOptions: () => ({}),
        __tmSafeAttrName: (value, fallback) => value || fallback,
        __tmGetTaskMetaAttrReadKeys: (field) => [field],
        __tmHasPendingVisibleDatePersistence: () => false,
        __tmHasPendingTaskFieldPersistence: () => false,
        __tmNormalizeTaskPriorityValue: (value) => String(value || ''),
        __tmParseTaskLooseBoolean: (value) => value === true || value === '1' || value === 1,
        __tmNormalizeTaskRepeatRule: (value) => normalizeJson(value, { enabled: false }),
        __tmNormalizeTaskRepeatState: (value) => normalizeJson(value, {}),
        __tmNormalizeTaskRepeatHistory: (value) => normalizeJson(value, []),
        __tmNormalizeTomatoCountValue: (value) => String(value || ''),
        __tmGetTaskAttachmentPaths: () => [],
        __tmGetTaskAttachmentMetaMap: () => new Map(),
        __tmHasTaskAttachmentAttrSnapshot: () => true,
        __tmNormalizeTaskAttachmentPaths: (value) => value || [],
        __tmApplyTaskAttachmentPathsToTask: () => {},
        __tmGetCustomFieldDefs: () => defs,
        __tmGetCustomFieldDefMap: () => new Map(defs.map((field) => [field.id, field])),
        __tmNormalizeCustomFieldValue: (field, value) => String(value || ''),
        __tmSerializeCustomFieldValue: (field, value) => String(value || ''),
        __tmCustomFieldAttrBackfillInFlight: new Set(),
        __tmRequireTaskMutation: () => async (...args) => { writes.push(args); },
        __tmNormalizeTaskCompleteAtValue: (value) => String(value || ''),
        __tmNormalizeTaskStatusMarker: (value) => value || '',
        __tmResolveTaskMarkdownMarker: () => '',
        __tmNormalizeTaskContentField: () => {},
    });
    const definitionsStart = stores.indexOf('const __TM_TASK_META_ATTR_FIELDS =');
    const definitionsEnd = stores.indexOf('const __TM_TASK_META_ATTR_DEFAULT_KEY_MAP =', definitionsStart);
    vm.runInContext(stores.slice(definitionsStart, definitionsEnd), context);
    for (const name of ['__tmShouldReadRepeatAttrsInline', '__tmGetTaskInlineAttrSpecs',
        '__tmNormalizeTaskCustomFieldValues', '__tmMaybeBackfillTaskCustomFieldAttrs']) {
        vm.runInContext(extract(stores, name), context);
    }
    for (const name of ['__tmMarkTaskInlineAttrsLoaded', '__tmGetTaskCustomFieldRawValues']) {
        vm.runInContext(extract(stores, name), context);
    }
    vm.runInContext(extract(render, 'normalizeTaskFields'), context);
    const applyStart = stores.indexOf('        applyToTask(task) {');
    const applyEnd = stores.indexOf('        mergeFromTaskIfMissing(', applyStart);
    vm.runInContext('Object.assign(MetaStore, {' + stores.slice(applyStart, applyEnd) + '});', context);
    const markLoaded = (task) => {
        context.__tmMarkTaskInlineAttrsLoaded([task]);
        return task;
    };
    return { context, writes, markLoaded };
}

const fields = [
    ['priority', 'custom_priority', 'high', ''],
    ['duration', 'duration', '90', ''],
    ['remark', 'remark', 'old remark', ''],
    ['taskCompleteAt', 'task_complete_at', '2026-09-10 10:00', ''],
    ['taskDateColor', 'task_date_color', '#ff0000', ''],
    ['pinned', 'pinned', true, false],
    ['milestone', 'milestone', true, false],
    ['allDayBottom', 'custom_all_day_bottom', true, false],
    ['repeatRule', 'repeat_rule', { enabled: true }, { enabled: false }],
    ['repeatState', 'repeat_state', { lastCompleted: 'yesterday' }, {}],
    ['repeatHistory', 'repeat_history', [{ date: '2026-09-10' }], []],
];

for (const [field, alias, oldValue, emptyValue] of fields) {
    test('fresh empty ' + field + ' must beat a stale MetaStore value', () => {
        const { context, markLoaded } = createContext({ [field]: oldValue });
        const task = markLoaded({ id: 'task-a', [alias]: '' });
        context.normalizeTaskFields(task, 'Test');
        assert.deepEqual(JSON.parse(JSON.stringify(task[field])), emptyValue);
    });
}

for (const field of ['pinned', 'milestone', 'allDayBottom']) {
    test('fresh enabled ' + field + ' must beat a stale disabled value', () => {
        const { context, markLoaded } = createContext({ [field]: false });
        const alias = field === 'allDayBottom' ? 'custom_all_day_bottom' : field;
        const task = markLoaded({ id: 'task-a', [alias]: '1' });
        context.normalizeTaskFields(task, 'Test');
        assert.equal(task[field], true);
    });
}

for (const [field, alias] of [['tomatoCount', 'tomato_count'], ['tomatoEstimateCount', 'tomato_estimate_count']]) {
    test('cleared focus counters must not be restored from MetaStore: ' + field, () => {
        const { context, markLoaded } = createContext({ [field]: '5' });
        const task = markLoaded({ id: 'task-a', [alias]: '' });
        context.MetaStore.applyToTask(task);
        context.normalizeTaskFields(task, 'Test');
        assert.equal(task[field], '');
    });
}

test('unloaded fields retain the legacy metadata fallback', () => {
    const { context } = createContext({ priority: 'high', repeatRule: { enabled: true } });
    const task = { id: 'task-a' };
    context.normalizeTaskFields(task, 'Test');
    assert.equal(task.priority, 'high');
    assert.equal(task.repeatRule.enabled, true);
});

test('the real SQL attribute-read entry marks absent attributes before metadata fallback', async () => {
    const { context } = createContext({ priority: 'high', pinned: true, repeatRule: { enabled: true } });
    context.__tmPopulateTaskAttrHostIds = async () => {};
    context.__tmQueryTaskMetaAttrRowsByBlockIds = async () => [];
    vm.runInContext(extract(stores, '__tmApplyTaskAttrHostOverrides'), context);
    const task = { id: 'task-a', custom_priority: null, pinned: null, repeat_rule: null };
    await context.__tmApplyTaskAttrHostOverrides([task]);
    context.normalizeTaskFields(task, 'Test');
    assert.equal(task.priority, '');
    assert.equal(task.pinned, false);
    assert.equal(task.repeatRule.enabled, false);
});

test('disabled inline repeat reads do not turn SQL placeholders into authoritative clears', () => {
    const { context, markLoaded } = createContext({ repeatRule: { enabled: true } });
    context.__tmGetPerfTuningOptions = () => ({ readRepeatAttrsInline: false });
    const task = markLoaded({ id: 'task-a', repeat_rule: null });
    context.normalizeTaskFields(task, 'Test');
    assert.equal(task.repeatRule.enabled, true);
});

test('loaded missing custom fields stay cleared while unloaded custom fields retain fallback', async () => {
    const { context, writes } = createContext({ customFieldValues: { project: 'old', tag: 'legacy' } });
    const task = { id: 'task-a', __customFieldRawValues: {}, __tmLoadedCustomFieldIds: ['project'] };
    context.normalizeTaskFields(task, 'Test');
    context.MetaStore.applyToTask(task);
    await Promise.resolve();
    assert.equal(task.customFieldValues.project, undefined);
    assert.equal(task.customFieldValues.tag, 'legacy');
    assert.equal(writes.length, 0, 'partial reads must not migrate old values into fields that have not been read');
});

test('old custom metadata cannot write back over a fresh value or an explicit clear', async () => {
    const { context, writes } = createContext({ customFieldValues: { project: 'old', tag: 'old' } });
    const task = { id: 'task-a', __customFieldRawValues: { project: 'new', tag: '' }, __tmLoadedAllCustomFields: true };
    context.normalizeTaskFields(task, 'Test');
    context.MetaStore.applyToTask(task);
    await Promise.resolve();
    assert.equal(task.customFieldValues.project, 'new');
    assert.equal(task.customFieldValues.tag, undefined);
    assert.equal(writes.length, 0);
});
