'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, 'src/task-horizon/main', file), 'utf8');
const services = read('20-api-and-runtime-services.js');
const events = read('32-runtime-state-and-events.js');
const fields = read('task-runtime/51-whiteboard-and-link-runtime.js');
const loader = read('task-runtime/53c-document-loader-runtime.js');
const foundation = read('30-dialogs-and-ui-foundation.js');
const stores = read('10-stores-rules-and-cache.js');
const schemaSource = read('09-task-field-schema.js');
const doneSource = read('task-runtime/53-list-render-and-document-loader.js');

function segment(source, start, end) {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, 'missing segment: ' + start);
    return source.slice(from, to);
}

const baseTask = () => ({
    id: '20260911090000-task001',
    root_id: '20260911090000-doc0001',
    updated: '20260911090000',
    markdown: '* [ ] Test',
    priority: 'low',
    custom_priority: 'low',
    customStatus: 'todo',
    custom_status: 'todo',
});

function createContext() {
    const task = baseTask();
    const saves = [];
    const queued = [];
    const projections = [];
    const context = vm.createContext({
        state: { filteredTasks: [task], __tmLoadedDocIdsForTasks: [task.root_id], viewMode: 'kanban' },
        SettingsStore: { data: { currentGroupId: 'all' } },
        __TM_TASK_INDEX_QUERY_LIMIT: 500,
        __tmMarkLocalTaskPatchWatermark: () => {},
        __tmSchedulePersistTaskSnapshot: (options) => saves.push(options),
        __tmTaskBoundary: { getTask: () => task },
        __tmTaskStateKernel: { getTask: () => task },
        __tmBuildTaskCommandPlan: (taskId, patch) => ({ normalizedPatch: patch, projectionPatch: patch }),
        __tmCaptureTaskPatchInverse: () => ({ priority: 'low' }),
        __tmIsPatchNoop: () => false,
        __tmHasCalendarSidebarChecklist: () => false,
        __tmGetTaskAttachmentPaths: () => [],
        __tmGetTaskAttachmentMetaMap: () => new Map(),
        __tmGetTaskAttachmentAttrSlotCount: () => 0,
        __tmEnqueueQueuedOp: (definition) => { queued.push(definition); return Promise.resolve('queued'); },
        normalizeId: (value) => String(value || '').trim(),
        normalizeTaskMutation: (mutation) => mutation,
        normalizeTaskChangeSet: () => ({ structural: false }),
        scheduleTaskChangeSet: (mutation) => projections.push(mutation),
        subscribeTaskMutation: () => {},
    });
    vm.runInContext(schemaSource, context);
    vm.runInContext(segment(stores, 'const __TM_TASK_META_ATTR_FIELDS =', 'const __TM_TASK_META_ATTR_DEFAULT_KEY_MAP =')
        + segment(stores, 'function __tmGetTaskMetaAttrFieldDefs(', 'function __tmGetTaskMetaAttrFieldDef('), context);
    vm.runInContext(segment(stores, 'function __tmGetTaskMetaAttrFieldDef(', 'function __tmNormalizeTaskMetaAttrKeyName(')
        + segment(stores, 'function __tmStableSettingsJsonValue(', 'function __tmGetSettingsFieldFingerprint('), context);
    vm.runInContext(segment(loader, 'function isVerifyRawTaskSignatureSourceTask(', 'function buildVerifyRawTaskSignatureFromTasks('), context);
    vm.runInContext(segment(loader, 'function buildVerifyRawTaskSignatureFromTasks(', 'function buildVerifyRawTaskRowsFromSignature('), context);
    vm.runInContext(segment(foundation, 'function __tmGetVisibleTaskFingerprint(', 'function __tmScheduleSilentCacheVerifyAfterFirstPaint('), context);
    vm.runInContext(segment(services, 'function __tmScheduleTaskSnapshotAfterLocalPatch(', 'function __tmBuildMarkdownMutationRetentionPatch('), context);
    vm.runInContext(segment(fields, 'function __tmQueueTaskFieldPatch(', 'function __tmCommitTaskPatchThroughMutation('), context);
    vm.runInContext(segment(events, 'const scheduleMutationSnapshotRefresh =', 'const normalizeTaskChangeSet =')
        + segment(events, 'const __tmProjectionManager =', 'subscribeTaskMutation((mutation) =>')
        + '; globalThis.manager = __tmProjectionManager;', context);
    return { context, saves, queued, projections, task };
}

const metadataChanges = [
    ['content', 'content', 'Changed title'],
    ['markdown', 'markdown', '* [ ] Changed title'],
    ['done', 'done', true],
    ['priority', 'custom_priority', 'high'],
    ['customStatus', 'custom_status', 'doing'],
    ['startDate', 'start_date', '2026-09-12'],
    ['completionTime', 'completion_time', '2026-09-13'],
    ['customTime', 'custom_time', '2026-09-14'],
    ['taskCompleteAt', 'task_complete_at', '2026-09-11 09:00:00'],
    ['remark', 'remark', 'new remark'],
    ['duration', 'duration', '45'],
    ['taskDateColor', 'task_date_color', '#ff0000'],
    ['pinned', 'pinned', true],
    ['milestone', 'milestone', true],
    ['allDayBottom', 'custom_all_day_bottom', true],
    ['tomatoMinutes', 'tomato_minutes', '25'],
    ['tomatoHours', 'tomato_hours', '1'],
    ['tomatoCount', 'tomato_count', '2'],
    ['tomatoEstimateCount', 'tomato_estimate_count', '4'],
    ['repeatRule', 'repeat_rule', { enabled: true, type: 'daily' }],
    ['repeatState', 'repeat_state', { lastInstanceDue: '2026-09-12' }],
    ['repeatHistory', 'repeat_history', [{ completedAt: '2026-09-11' }]],
    ['customFieldValues', '__customFieldRawValues', { project: 'new-project' }],
    ['attachments', '__attachmentPaths', ['assets/test.png']],
    ['attachmentMeta', '__attachmentMeta', [{ path: 'assets/test.png', name: 'New label' }]],
    ['taskMarker', 'task_marker', 'X'],
];

for (const [field, sqlAlias, value] of metadataChanges) {
    test('raw startup verification detects ' + field + ' without a timestamp change', () => {
        const { context, task } = createContext();
        const fresh = { ...task, [field]: value, [sqlAlias]: value };
        assert.notEqual(context.buildVerifyRawTaskSignatureFromTasks([task]),
            context.buildVerifyRawTaskSignatureFromTasks([fresh]));
    });
    test('visible startup verification detects ' + field + ' without reordering', () => {
        const { context, task } = createContext();
        const before = context.__tmGetVisibleTaskFingerprint();
        context.state.filteredTasks = [{ ...task, [field]: value, [sqlAlias]: value }];
        assert.notEqual(before, context.__tmGetVisibleTaskFingerprint());
    });
    test('committed field schedules cache maintenance: ' + field, async () => {
        const { context, queued, saves, task } = createContext();
        const mutationType = field === 'content' || field === 'markdown' ? 'contentPatch'
            : (field === 'done' ? 'setDone' : 'taskPatch');
        let data = {};
        if (mutationType === 'taskPatch') {
            await context.__tmQueueTaskFieldPatch(task.id, { [field]: value });
            data = queued[0].data;
        }
        context.manager.handle({ type: mutationType, phase: 'commit', taskId: task.id,
            patch: { [field]: value }, data });
        assert.equal(saves.length, 1);
    });
}

test('unchanged metadata and authoritative empty values remain distinguishable', () => {
    const { context, task } = createContext();
    const signature = context.buildVerifyRawTaskSignatureFromTasks([task]);
    assert.equal(signature, context.buildVerifyRawTaskSignatureFromTasks([{ ...task }]));
    assert.notEqual(signature, context.buildVerifyRawTaskSignatureFromTasks([{ ...task, custom_priority: '' }]));
});

test('ordinary priority edits schedule a snapshot only after kernel commit', async () => {
    const { context, saves, queued, task } = createContext();
    await context.__tmQueueTaskFieldPatch(task.id, { priority: 'high' }, { source: 'inline-priority' });
    const definition = queued[0];
    const mutation = { type: definition.type, taskId: task.id, docId: task.root_id, patch: definition.data.patch, data: definition.data };
    context.manager.handle({ ...mutation, phase: 'optimistic' });
    assert.equal(saves.length, 0);
    context.manager.handle({ ...mutation, phase: 'commit' });
    assert.equal(saves.length, 1);
    assert.equal(saves[0].changedDocIds[0], task.root_id);
    assert.equal(saves[0].delayMs, 360);
});

test('rollback and local optimistic updates do not persist unconfirmed fields', () => {
    const { context, saves, task } = createContext();
    context.__tmScheduleTaskSnapshotAfterLocalPatch(task.id, { priority: 'high' });
    context.manager.handle({ type: 'taskPatch', phase: 'rollback', taskId: task.id, patch: { priority: 'low' }, data: {} });
    assert.equal(saves.length, 0);
});

test('presentation-only deferral still persists committed metadata', async () => {
    const { context, saves, queued, projections, task } = createContext();
    await context.__tmQueueTaskFieldPatch(task.id, { priority: 'high' }, { deferProjection: true, deferSnapshot: false });
    context.manager.handle({ type: 'taskPatch', phase: 'commit', taskId: task.id, patch: queued[0].data.patch, data: queued[0].data });
    assert.equal(saves.length, 1);
    assert.equal(projections.length, 0);
});

test('composite operations cannot persist an intermediate deferred commit', async () => {
    const { context, saves, queued, task } = createContext();
    await context.__tmQueueTaskFieldPatch(task.id, { repeatState: { pendingNativeDoneReset: true } }, { deferProjection: true });
    context.manager.handle({ type: 'taskPatch', phase: 'commit', taskId: task.id,
        patch: queued[0].data.patch, data: queued[0].data });
    assert.equal(saves.length, 0);
    context.__tmScheduleTaskSnapshotAfterLocalPatch(task.id, { repeatState: { pendingNativeDoneReset: false } }, { persistSnapshot: true });
    assert.equal(saves.length, 1);
});

test('the real setDone builder preserves default persistence and explicit deferral', () => {
    const { context, saves, task } = createContext();
    Object.assign(context, {
        __tmResolveTaskMarker: () => ' ',
        __tmBuildCheckboxStatusPatch: () => ({}),
        __tmBuildTaskCompleteAtPatch: () => ({ taskCompleteAt: '2026-09-11 10:00:00' }),
        __tmBuildTaskMarkdownWithMarker: () => '* [X] Test',
        __tmGetTaskRepeatRule: () => ({ enabled: false }),
        __tmBuildTaskRepeatAdvancePatch: () => null,
    });
    vm.runInContext(segment(doneSource, 'function __tmBuildSetDoneQueuedDefinition(', 'async function __tmSyncParentDoneStateFromSubtasks('), context);
    const definition = context.__tmBuildSetDoneQueuedDefinition(task.id, true, task).definition;
    assert.equal(definition.data.persistSnapshot, true);
    context.manager.handle({ type: 'setDone', phase: 'commit', taskId: task.id,
        patch: definition.data.patch, data: definition.data });
    assert.equal(saves.length, 1);
    for (const options of [{ persistSnapshot: false }, { skipSnapshotPersist: true }]) {
        assert.equal(context.__tmBuildSetDoneQueuedDefinition(task.id, true, task, options).definition.data.persistSnapshot, false);
    }
    context.__tmBuildTaskRepeatAdvancePatch = () => ({ startDate: '2026-09-12' });
    const recurring = context.__tmBuildSetDoneQueuedDefinition(task.id, true, task).definition;
    assert.equal(recurring.data.deferProjection, true);
    context.manager.handle({ type: 'setDone', phase: 'commit', taskId: task.id,
        patch: recurring.data.patch, data: recurring.data });
    assert.equal(saves.length, 1);
});

for (const options of [{ persistSnapshot: false }, { skipSnapshotPersist: true }]) {
    test('explicit cache opt-out is preserved: ' + JSON.stringify(options), async () => {
        const { context, saves, queued, task } = createContext();
        await context.__tmQueueTaskFieldPatch(task.id, { priority: 'high' }, options);
        context.manager.handle({ type: 'taskPatch', phase: 'commit', taskId: task.id, patch: queued[0].data.patch, data: queued[0].data });
        assert.equal(saves.length, 0);
    });
}

test('silent verification repaints stale priority after a fresh read', async () => {
    const { context, task } = createContext();
    const timers = [];
    let renders = 0;
    Object.assign(context, {
        setTimeout: (callback) => { timers.push(callback); return timers.length; },
        clearTimeout: () => {},
        __tmScheduleIdleTask: (callback) => { timers.push(callback); },
        __tmShouldDeferMainViewRefreshForActiveScroll: () => false,
        loadSelectedDocuments: async () => { context.state.filteredTasks = [{ ...task, priority: 'high', custom_priority: 'high' }]; },
        recalcStats: () => {},
        Element: class Element {},
        render: () => { renders += 1; },
    });
    vm.runInContext(segment(foundation, 'function __tmScheduleSilentCacheVerifyAfterFirstPaint(', 'async function __tm'), context);
    context.__tmScheduleSilentCacheVerifyAfterFirstPaint({ source: 'snapshot-cache' });
    while (timers.length) await timers.shift()();
    assert.equal(renders, 1);
    assert.equal(context.state.__tmCacheFirstPaintNeedsVerify, false);
});

test('structured field key order does not cause a false cache change', () => {
    const { context, task } = createContext();
    const first = { ...task, customFieldValues: { project: 'alpha', tag: 'beta' } };
    const second = { ...task, customFieldValues: { tag: 'beta', project: 'alpha' } };
    assert.equal(context.buildVerifyTaskFieldSignature(first), context.buildVerifyTaskFieldSignature(second));
});

test('JSON-looking titles remain exact text rather than structured metadata', () => {
    const { context, task } = createContext();
    assert.notEqual(context.buildVerifyTaskFieldSignature({ ...task, content: '{"a":1,"b":2}' }),
        context.buildVerifyTaskFieldSignature({ ...task, content: '{"b":2,"a":1}' }));
});

test('authoritative SQL nulls and raw repeat fields override stale normalized aliases', () => {
    const { context, task } = createContext();
    const signature = context.buildVerifyTaskFieldSignature(task, { raw: true });
    assert.notEqual(signature, context.buildVerifyTaskFieldSignature({ ...task, custom_priority: null }, { raw: true }));
    assert.notEqual(context.buildVerifyTaskFieldSignature({ ...task, repeatRule: { enabled: true }, repeat_rule: '' }, { raw: true }),
        context.buildVerifyTaskFieldSignature({ ...task, repeatRule: { enabled: true }, repeat_rule: '{"enabled":true}' }, { raw: true }));
});

test('SQL aliases, structured JSON and explicit clears participate in verification', () => {
    const { context, task } = createContext();
    const baseline = context.buildVerifyTaskFieldSignature(task, { raw: true });
    assert.notEqual(baseline, context.buildVerifyTaskFieldSignature({ ...task, custom_priority: '' }, { raw: true }));
    assert.notEqual(baseline, context.buildVerifyTaskFieldSignature({ ...task,
        customFieldValues: { project: 'old' }, __customFieldRawValues: {} }, { raw: true }));
    assert.equal(context.buildVerifyTaskFieldSignature({ ...task, repeatRule: { enabled: true } }),
        context.buildVerifyTaskFieldSignature({ ...task, repeat_rule: '{"enabled":true}' }));
});
