'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const storesSource = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', '10-stores-rules-and-cache.js'),
    'utf8',
);
const servicesSource = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', '20-api-and-runtime-services.js'),
    'utf8',
);
const dialogsSource = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', '30-dialogs-and-ui-foundation.js'),
    'utf8',
);
const scoreSource = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', 'task-runtime', '51-whiteboard-and-link-runtime.js'),
    'utf8',
);
const cssSource = fs.readFileSync(path.join(root, 'task-horizon.css'), 'utf8');

function sliceSource(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    assert.ok(start >= 0, `missing source marker: ${startMarker}`);
    const end = source.indexOf(endMarker, start);
    assert.ok(end > start, `missing source marker: ${endMarker}`);
    return source.slice(start, end);
}

const customFieldDefs = [
    {
        id: 'stage',
        name: '阶段',
        type: 'single',
        options: [
            { id: 'now', name: '当前' },
            { id: 'later', name: '稍后' },
        ],
    },
    {
        id: 'tags',
        name: '标签',
        type: 'multi',
        options: [
            { id: 'urgent', name: '紧急' },
            { id: 'blocked', name: '受阻' },
        ],
    },
    {
        id: 'notes',
        name: '说明',
        type: 'text',
        options: [],
    },
];

const priorityScoreConfig = {
    base: 100,
    weights: { importance: 0, status: 0, due: 0, duration: 0, doc: 0 },
    customFieldDelta: {
        stage: { now: 12, later: -4 },
        tags: { urgent: 7, blocked: -3 },
        notes: { ignored: 99 },
        missing: { ignored: 99 },
    },
};

const findOption = (field, token) => (Array.isArray(field?.options) ? field.options : []).find((option) => {
    const value = String(token || '').trim();
    return String(option?.id || '').trim() === value || String(option?.name || '').trim() === value;
});

const context = vm.createContext({
    console,
    Map,
    Set,
    SettingsStore: {
        data: {
            priorityScoreConfig,
            columnOrder: [],
            checklistCompactMode: false,
        },
    },
    state: { viewMode: 'list' },
    __tmGetCustomFieldDefs: () => customFieldDefs,
    __tmGetCustomFieldDefMap: () => new Map(customFieldDefs.map((field) => [field.id, field])),
    __tmParseCustomFieldColumnKey: (key) => {
        const raw = String(key || '').trim();
        return raw.startsWith('customField:') ? raw.slice('customField:'.length) : '';
    },
    __tmGetCurrentRule: () => null,
    __tmNormalizeCompactChecklistMetaFields: () => [],
    __tmGetTaskCustomFieldValue: (task, fieldId) => task?.customFieldValues?.[fieldId],
    __tmNormalizeCustomFieldValue: (field, value) => {
        if (String(field?.type || '') === 'multi') return Array.isArray(value) ? value : [];
        return String(value || '').trim();
    },
    __tmFindCustomFieldOption: findOption,
    __tmResolveTaskStatusId: () => '',
    __tmGetTaskEffectiveCompletionTimeInfo: () => ({ ts: 0 }),
    __tmGetPriorityScoreDueRanges: () => [],
    __tmParseDurationMinutes: () => null,
    __tmGetPriorityGroupDeltaForDoc: () => 0,
    __tmGetPatchFieldKeys: (patch) => Object.keys(patch || {}),
});

vm.runInContext(sliceSource(
    storesSource,
    'function __tmNormalizePriorityCustomFieldDelta',
    '    function __tmCollectCustomFieldLoadPlan',
), context);
vm.runInContext(sliceSource(
    storesSource,
    'function __tmCollectCustomFieldLoadPlan',
    '    function __tmNormalizeCustomFieldIdList',
), context);
vm.runInContext(sliceSource(
    scoreSource,
    'function __tmComputePriorityScore',
    '    function __tmEnsureTaskPriorityScore',
), context);
vm.runInContext(sliceSource(
    servicesSource,
    'function __tmDoesPatchAffectPriorityScore',
    '    function __tmDoesPatchAffectAncestorPriorityScore',
), context);

const compute = (customFieldValues, config = priorityScoreConfig) => {
    context.SettingsStore.data.priorityScoreConfig = config;
    context.task = { priority: 'none', customFieldValues };
    return vm.runInContext('__tmComputePriorityScore(task, { nowTs: 0 })', context);
};

assert.equal(compute({ stage: 'now' }), 112, 'single-select option delta should be applied');
assert.equal(compute({ stage: 'later' }), 96, 'negative single-select option delta should be applied');
assert.equal(compute({ tags: ['urgent', 'blocked'] }), 104, 'multi-select option deltas should be summed');
assert.equal(compute({ stage: 'now', tags: ['urgent', 'blocked'] }), 116, 'different custom fields should accumulate');
assert.equal(compute({ stage: 'missing', tags: [] }), 100, 'unknown and empty values should not affect the score');
assert.equal(compute({ stage: 'now' }, { ...priorityScoreConfig, customFieldDelta: undefined }), 100, 'legacy configs should keep their previous score');

context.SettingsStore.data.priorityScoreConfig = priorityScoreConfig;
const loadPlan = vm.runInContext(`__tmCollectCustomFieldLoadPlan({
    viewMode: 'list',
    colOrder: ['customField:stage'],
    rule: null,
})`, context);
assert.deepEqual(Array.from(loadPlan.bulkFieldIds).sort(), ['stage', 'tags']);
assert.deepEqual(Array.from(loadPlan.deferredListFieldIds), []);
assert.equal(vm.runInContext(`__tmDoesPatchAffectPriorityScore({ customFieldValues: { stage: 'now' } })`, context), true);

assert.match(dialogsSource, /自定义列加减分/);
assert.match(dialogsSource, /class="b3-text-field tm-priority-number-input"/);
assert.match(dialogsSource, /window\.tmSetPriorityCustomField = function/);
assert.match(cssSource, /\.tm-priority-field-row\s*\{/);
assert.doesNotMatch(dialogsSource, /tm-priority-status-input/);

process.stdout.write('custom field priority score contract tests passed\n');
