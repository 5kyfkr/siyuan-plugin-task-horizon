'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('./i18n-vm-fixture');

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
            { id: 'now', name: '当前', parentId: 'later' },
            { id: 'later', name: '稍后', archived: true },
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
    __tmResolvePriorityScoreCacheUntil: () => 0,
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
    dialogsSource,
    'function __tmIsTaskPinned',
    '    function __tmSortPinnedTasksFirst',
), context);
vm.runInContext(sliceSource(
    scoreSource,
    'function __tmComputePriorityScore',
    '    function __tmEnsureTaskPriorityScore',
), context);
vm.runInContext(sliceSource(
    scoreSource,
    'function __tmEnsureTaskPriorityScore',
    '    let __tmCellEditorState',
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
assert.equal(compute({ stage: 'now' }), 112, 'hierarchy and archive metadata must not change direct option scoring');
assert.equal(compute({ tags: ['urgent', 'blocked'] }), 104, 'multi-select option deltas should be summed');
assert.equal(compute({ stage: 'now', tags: ['urgent', 'blocked'] }), 116, 'different custom fields should accumulate');
assert.equal(compute({ stage: 'missing', tags: [] }), 100, 'unknown and empty values should not affect the score');
assert.equal(compute({ stage: 'now' }, { ...priorityScoreConfig, customFieldDelta: undefined }), 100, 'legacy configs should keep their previous score');

const computePinned = (pinned, pinnedDelta, weights = priorityScoreConfig.weights) => {
    context.SettingsStore.data.priorityScoreConfig = { ...priorityScoreConfig, pinnedDelta, weights };
    context.task = { pinned, priority: 'none', customFieldValues: { stage: 'now' } };
    return vm.runInContext('__tmComputePriorityScore(task, { nowTs: 0 })', context);
};
assert.equal(computePinned(true, 25), 137, 'pinned delta should accumulate with other score sources');
assert.equal(computePinned(false, 25), 112, 'unpinning removes only the pinned contribution');
assert.equal(computePinned(true, undefined), 112, 'legacy pinned tasks keep their score until a delta is configured');
assert.equal(computePinned(true, 0), 112, 'zero disables the pinned contribution');
assert.equal(computePinned(true, -20), 92, 'pinned delta may subtract points');
assert.equal(computePinned(true, 2.5), 114.5, 'fractional pinned deltas are preserved');
assert.equal(computePinned(true, 25, { ...priorityScoreConfig.weights, pinned: 2 }), 162, 'pinned weight scales the configured delta');
assert.equal(computePinned(true, 25, { ...priorityScoreConfig.weights, pinned: 0 }), 112, 'zero pinned weight disables the contribution');
assert.equal(computePinned(true, 'invalid'), 112, 'invalid pinned deltas do not discard other score contributions');
for (const pinned of [true, 1, '1', 'true', 'yes']) assert.equal(computePinned(pinned, 25), 137);
for (const pinned of [false, 0, '0', 'false', '', undefined]) assert.equal(computePinned(pinned, 25), 112);
assert.equal(vm.runInContext('__tmDoesPatchAffectPriorityScore({ pinned: false })', context), true, 'pin changes must invalidate derived scores');

context.SettingsStore.data.priorityScoreConfig = { ...priorityScoreConfig, pinnedDelta: 25 };
Object.assign(context.state, {
    flatTasks: {}, pendingInsertedTasks: {}, pendingDeletedTasks: {}, doneOverrides: {},
    taskTree: [], filteredTasks: [], otherBlocks: [], collapsedTaskIds: new Set(),
});
Object.assign(context, { setTimeout, clearTimeout, queueMicrotask, MetaStore: { set() {}, remapId() {} } });
vm.runInContext(fs.readFileSync(path.join(root, 'src/task-horizon/main/32-runtime-state-and-events.js'), 'utf8'), context);
const store = context.__tmTaskStore;
const pinTask = { id: 'pin-score-task', pinned: false, priority: 'none', customFieldValues: { stage: 'now' }, priorityScore: 112, children: [] };
store.replaceFlat({ [pinTask.id]: pinTask }, { authoritative: true, mergeOtherBlocks: false });
store.applyMutation({ type: 'taskPatch', phase: 'optimistic', opId: 'pin', taskId: pinTask.id, patch: { pinned: true } }, { applyLocal: false });
assert.equal(store.getProjected(pinTask.id).priorityScore, 137, 'optimistic pinning recomputes the cached score');
store.applyMutation({ type: 'taskPatch', phase: 'commit', opId: 'pin', taskId: pinTask.id, patch: { pinned: true }, task: { ...pinTask, pinned: true } }, { applyLocal: false });
assert.equal(store.getProjected(pinTask.id).priorityScore, 137, 'committed pinning retains its score contribution');
store.applyMutation({ type: 'taskPatch', phase: 'optimistic', opId: 'unpin', taskId: pinTask.id, patch: { pinned: false } }, { applyLocal: false });
assert.equal(store.getProjected(pinTask.id).priorityScore, 112, 'optimistic unpinning immediately removes the contribution');
store.applyMutation({ type: 'taskPatch', phase: 'rollback', opId: 'unpin', taskId: pinTask.id, patch: { pinned: false } }, { applyLocal: false });
assert.equal(store.getProjected(pinTask.id).priorityScore, 137, 'a failed unpin restores the pinned score');

context.SettingsStore.data.priorityScoreConfig = priorityScoreConfig;
Object.assign(context, {
    __tmGetPriorityTitleOpacityRanges: () => [
        { minScore: 0, maxScore: 0, opacity: 0.5, color: '#666666', index: 0 },
        { minScore: 1, maxScore: Infinity, opacity: 1, color: '#cc3300', index: 1 },
    ],
    __tmIsDarkMode: () => false,
    __tmGetReadablePriorityTitleColor: (color) => color,
});
for (const [start, end] of [
    ['function __tmResolveTaskTitleOpacity(', '    function __tmRelativeLuminanceFromRgba('],
    ['function __tmResolveTaskTitleVisual(', '    function __tmApplyTaskTitleOpacityToElement('],
    ['function __tmBuildTaskTitleOpacityStyle(', '    function __tmApplyTaskTitleOpacityInContainer('],
]) {
    vm.runInContext(sliceSource(servicesSource, start, end), context);
}

for (const mode of ['child', 'after']) {
    const taskId = `move-score-${mode}`;
    const task = { id: taskId, docId: 'doc', root_id: 'doc', priority: 'none',
        customFieldValues: { stage: 'now' }, priorityScore: 112, children: [] };
    store.replaceFlat({ [taskId]: task }, { authoritative: true, mergeOtherBlocks: false });
    store.applyMutation({ type: 'moveTask', phase: 'optimistic', opId: taskId, taskId,
        data: { mode, targetDocId: 'doc', targetTaskId: 'parent' },
    }, { applyLocal: false });
    const parentTaskId = mode === 'child' ? 'parent' : '';
    context.state.flatTasks[taskId] = { ...task, parentTaskId, parent_task_id: parentTaskId };
    // Kernel move receipts do not calculate a priority score and return null.
    store.applyMutation({ type: 'moveTask', phase: 'commit', opId: taskId, taskId,
        data: { mode, targetDocId: 'doc', targetTaskId: 'parent' },
        placement: { taskID: taskId, documentID: 'doc', parentListID: 'list', parentTaskID: parentTaskId },
        task: { id: taskId, docId: 'doc', root_id: 'doc', parentTaskId, priorityScore: null },
    }, { applyLocal: false });
    const projected = store.getProjected(taskId);
    assert.equal(projected.priorityScore, null, 'the fixture must exercise a null kernel score');
    assert.equal(context.__tmBuildTaskTitleOpacityStyle(projected), 'opacity:1;color:#cc3300;',
        `${mode}: the first render after a move must retain the computed score color`);
    assert.equal(projected.priorityScore, 112, `${mode}: rendering recomputes the missing score`);
    assert.equal(context.__tmResolveTaskTitleOpacity({ ...projected, priorityScore: null }), 1,
        `${mode}: opacity must use the computed score rather than treating null as zero`);
    assert.equal(context.__tmEnsureTaskPriorityScore({ ...projected, priorityScore: null }), 112,
        `${mode}: a null score is never a valid cached score`);
}
const zeroScoreTask = { priorityScore: 0, customFieldValues: { stage: 'now' } };
assert.equal(context.__tmBuildTaskTitleOpacityStyle(zeroScoreTask), 'opacity:0.5;color:#666666;',
    'an explicitly calculated zero must retain its zero-score color');
assert.equal(context.__tmResolveTaskTitleOpacity(zeroScoreTask), 0.5,
    'an explicit zero must retain its zero-score opacity');
assert.equal(context.__tmEnsureTaskPriorityScore(zeroScoreTask), 0,
    'an explicit zero must remain a valid cached score');

const loadPlan = vm.runInContext(`__tmCollectCustomFieldLoadPlan({
    viewMode: 'list',
    colOrder: ['customField:stage'],
    rule: null,
})`, context);
assert.deepEqual(Array.from(loadPlan.bulkFieldIds).sort(), ['stage', 'tags']);
assert.deepEqual(Array.from(loadPlan.deferredListFieldIds), []);
assert.equal(vm.runInContext(`__tmDoesPatchAffectPriorityScore({ customFieldValues: { stage: 'now' } })`, context), true);

context.staleProjectedTask = {
    priority: 'none',
    customFieldValues: { stage: 'now' },
    priorityScore: 100,
    __tmPriorityScoreCacheVersion: 0,
};
assert.equal(
    vm.runInContext('__tmEnsureTaskPriorityScore(staleProjectedTask)', context),
    100,
    'a projected task can still expose its previous cached score',
);
assert.equal(
    vm.runInContext('__tmEnsureTaskPriorityScore(staleProjectedTask, { force: true })', context),
    112,
    'a score refresh must recompute a projected task instead of accepting its stale cache',
);
const scoreDomUpdater = sliceSource(
    scoreSource,
    'function __tmUpdateTaskScoreInDOM',
    '    function __tmUpdateTaskPinnedInDOM',
);
assert.match(
    scoreDomUpdater,
    /__tmEnsureTaskPriorityScore\(taskLike, \{ force: true \}\)/,
    'the in-place score cell refresh must force recomputation after a score-affecting patch',
);

assert.match(dialogsSource, /task.customColumnScoreAdjustments/);
assert.match(dialogsSource, /class="b3-text-field tm-priority-number-input"/);
assert.match(dialogsSource, /window\.tmSetPriorityCustomField = function/);
assert.match(cssSource, /\.tm-priority-field-row\s*\{/);
assert.doesNotMatch(dialogsSource, /tm-priority-status-input/);

process.stdout.write('custom field priority score contract tests passed\n');
