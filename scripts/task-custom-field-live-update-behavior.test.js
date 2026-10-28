'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { DatabaseSync } = require('node:sqlite');

const main = path.join(__dirname, '../src/task-horizon/main');
const read = (file) => fs.readFileSync(path.join(main, file), 'utf8');
const stores = read('10-stores-rules-and-cache.js');
const services = read('20-api-and-runtime-services.js');
const runtime = read('32-runtime-state-and-events.js');
const coordinator = read('task-runtime/51-whiteboard-and-link-runtime.js');
const detail = read('task-runtime/52-task-detail-runtime.js');
const list = read('task-runtime/53-list-render-and-document-loader.js');
const foundation = read('30-dialogs-and-ui-foundation.js');
const loader = read('task-runtime/53c-document-loader-runtime.js');
const clone = (value) => JSON.parse(JSON.stringify(value));
const extract = (source, name) => {
    const start = source.search(new RegExp(`    (?:async )?function ${name}\\(`));
    const end = source.indexOf('\n    }', start);
    assert.ok(start >= 0 && end > start, `missing function: ${name}`);
    return source.slice(start, end + 6);
};

function createHarness(taskOverrides = {}) {
    const defs = [
        { id: 'stage', type: 'single', options: [{ id: 'old', name: '旧阶段' }, { id: 'new', name: '新阶段' }] },
        { id: 'labels', type: 'multi', options: [{ id: 'a', name: '标签甲' }, { id: 'b', name: '标签乙' }] },
        { id: 'notes', type: 'text' },
    ];
    const original = {
        id: 'task-a', root_id: 'doc-a', content: 'Task', children: [],
        customFieldValues: { stage: 'old', labels: ['a'], notes: '原备注' },
        __customFieldRawValues: { stage: '旧阶段', labels: '标签甲', notes: '原备注' },
        __tmLoadedAllCustomFields: true,
        ...taskOverrides,
    };
    const mirrors = Array.from({ length: 3 }, () => clone(original));
    const context = vm.createContext({
        console, Map, Set, queueMicrotask: () => {},
        state: {
            flatTasks: { 'task-a': mirrors[0] },
            taskTree: [{ id: 'doc-a', tasks: [mirrors[1]] }],
            filteredTasks: [mirrors[2]], otherBlocks: [],
        },
        SettingsStore: { data: {} },
        MetaStore: { set() {} },
        __tmGetCustomFieldDefs: () => defs,
        __tmGetCustomFieldDefMap: () => new Map(defs.map((field) => [field.id, field])),
        __tmBuildCustomFieldOptionRuntime: () => ({ pathById: new Map() }),
    });
    for (const name of [
        '__tmFindCustomFieldOption', '__tmNormalizeCustomFieldValue', '__tmSerializeCustomFieldValue',
        '__tmGetTaskCustomFieldRawValues', '__tmNormalizeTaskCustomFieldValues',
    ]) vm.runInContext(extract(stores, name), context);
    for (const name of ['__tmNormalizeQueueTaskValue', '__tmApplyQueuedTaskFieldPatchToTask']) {
        vm.runInContext(extract(services, name), context);
    }
    vm.runInContext(runtime, context);
    const store = context.__tmTaskStore;
    store.replaceFlat(context.state.flatTasks, { authoritative: true, mergeOtherBlocks: false });
    const mutate = (phase, patch, extra = {}) => store.applyMutation({
        type: 'taskPatch', taskId: original.id, opId: 'edit-custom-field', phase, patch, ...extra,
    });
    const readAfterNormalization = (task) => clone(context.__tmNormalizeTaskCustomFieldValues(
        context.__tmGetTaskCustomFieldRawValues(task), task.customFieldValues,
    ));
    return { context, store, mirrors, original, mutate, readAfterNormalization };
}

function createHydrationHarness() {
    const h = createHarness({ customFieldValues: {}, __customFieldRawValues: {}, __tmLoadedAllCustomFields: false });
    const saves = [];
    Object.assign(h.context, {
        MetaStore: { get: () => null, applyToTask() {} },
        __tmCollectVisibleListTasks: () => [h.mirrors[0]],
        __tmMergeLocalTaskPatchIntoTask() {},
        __tmInvalidateFilteredTaskDerivedStateCache() {},
        __tmTaskSnapshotService: { schedulePersist: (options) => saves.push({ options, tree: clone(h.context.state.taskTree) }) },
        __tmAttachCustomFieldAttrsToTasks: async (tasks) => {
            for (const task of tasks) {
                task.__customFieldRawValues = { stage: '新阶段', labels: '标签乙', notes: '补读的备注' };
                task.__tmLoadedCustomFieldIds = ['stage', 'labels', 'notes'];
            }
            return { queryComplete: true, cacheMissCount: tasks.length, hostAssignedCount: tasks.length };
        },
    });
    h.context.state.viewMode = 'list';
    for (const name of ['__tmNormalizeCustomFieldIdList', '__tmHydrateMissingRuntimeCustomFields', '__tmHydrateVisibleListCustomFields']) {
        vm.runInContext(extract(stores, name), h.context);
    }
    return { ...h, saves };
}

function createAggregateHarness() {
    const h = createHydrationHarness();
    const database = new DatabaseSync(':memory:');
    database.exec('CREATE TABLE attributes (block_id TEXT, name TEXT, value TEXT)');
    const insert = database.prepare('INSERT INTO attributes VALUES (?, ?, ?)');
    const docs = Array.from({ length: 3 }, (_, i) => ({ id: `20261028000000-doc000${i}`, tasks: [] }));
    const tasks = Array.from({ length: 450 }, (_, i) => {
        const task = { id: `20261028000000-${String(i).padStart(7, '0')}`, root_id: docs[i % 3].id, children: [], customFieldValues: {} };
        docs[i % 3].tasks.push(task);
        insert.run(task.id, 'custom-stage', '新阶段');
        insert.run(task.id, 'custom-labels', '标签乙');
        insert.run(task.id, 'custom-notes', `任务备注 ${i}`);
        return task;
    });
    h.context.state.taskTree = docs;
    h.context.state.filteredTasks = tasks;
    h.context.state.activeDocId = '__tm_doc_tab_group__:project';
    h.context.state.openToken = 1;
    h.context.state.__tmLoadedDocIdsForTasks = docs.map((doc) => doc.id);
    h.store.replaceFlat(Object.fromEntries(tasks.map((task) => [task.id, task])), { authoritative: true, mergeOtherBlocks: false });
    const queries = [];
    Object.assign(h.context, {
        API: { call: async (_url, { stmt }) => {
            queries.push(stmt);
            // SiYuan adds its configured search limit when SQL has no outer LIMIT.
            const hasLimit = /\bLIMIT\s+\d+\s*$/i.test(stmt);
            return { code: 0, data: database.prepare(hasLimit ? stmt : `${stmt} LIMIT 64`).all() };
        } },
        __tmCustomFieldAttrValueCache: new Map(),
        __tmParseVersionNumber: (value) => Number(value) || 0,
        __tmBuildCustomFieldAttrStorageKey: (value) => `custom-${value}`,
    });
    for (const name of ['__tmQueryCustomFieldAttrRowsByTaskIds', '__tmAttachCustomFieldAttrsToTasks']) {
        vm.runInContext(extract(stores, name), h.context);
    }
    return { ...h, tasks, docs, queries, database };
}

test('all tabs reads every custom value across 450 tasks despite the host default SQL row limit', async () => {
    const h = createAggregateHarness();
    try {
        const result = await h.context.__tmAttachCustomFieldAttrsToTasks(h.tasks, { fieldIds: ['stage', 'labels', 'notes'], forceFresh: true });
        assert.equal(result.queryComplete, true);
        for (const [i, task] of h.tasks.entries()) {
            assert.deepEqual(clone(task.__customFieldRawValues), { stage: '新阶段', labels: '标签乙', notes: `任务备注 ${i}` });
        }
    } finally { h.database.close(); }
});

test('all tabs repairs an unchanged but incomplete cached scope without clicking a task row', async () => {
    const h = createAggregateHarness();
    try {
        h.context.state.viewMode = 'checklist';
        Object.assign(h.context, {
            __tmBuildRuntimeCustomFieldLoadPlan: () => ({ bulkFieldIds: ['stage', 'labels', 'notes'], deferredListFieldIds: [] }),
            __tmProbeCurrentGroupTaskFreshness: async () => ({ status: 'unchanged' }),
            __tmRecomputeTaskProjection() {},
        });
        vm.runInContext(extract(foundation, '__tmVerifyCachedTaskScope'), h.context);
        const result = await h.context.__tmVerifyCachedTaskScope();
        assert.equal(result.complete, true);
        assert.equal(result.changed, true, 'unchanged block timestamps do not prove cached fields are complete');
        assert.equal(h.tasks.filter((task) => h.store.getProjected(task.id).customFieldValues.stage === 'new').length, 450);
        assert.equal(h.saves.length, 1);
        const reads = h.queries.length;
        assert.equal((await h.context.__tmVerifyCachedTaskScope()).changed, false);
        assert.equal(h.queries.length, reads, 'a complete scope must not repeat the bulk read');
    } finally { h.database.close(); }
});

for (const [scope, viewMode] of ['all', 'document-group', 'tab-group'].flatMap((scope) =>
    ['checklist', 'list', 'timeline', 'kanban', 'whiteboard'].map((mode) => [scope, mode]))) {
test(`${scope} all-tabs ${viewMode} repairs cached fields without row clicks`, async () => {
    const h = createAggregateHarness();
    try {
        const work = [];
        let repaints = 0;
        class Element {}
        Object.assign(h.context, {
            Element, HTMLElement: Element, window: {},
            setTimeout: (run) => { work.push(run); return work.length; }, clearTimeout() {},
            __tmScheduleIdleTask: (run) => work.push(run),
            __tmFindDocTabCustomGroupById: () => ({ id: 'project' }),
            __tmGetDocTabCustomGroupDocIdSet: () => new Set(h.docs.map((doc) => doc.id)),
            __TM_DOC_TAB_CUSTOM_GROUP_ACTIVE_PREFIX: '__tm_doc_tab_group__:',
            __TM_CUSTOM_FIELD_COLUMN_PREFIX: 'cf:',
            __tmResolveDocTabSwitchTarget: (docId) => docId,
            __tmMarkContextInteractionQuiet() {}, recalcStats() {},
            __tmApplyCurrentContextViewProfile: async () => ({ customFieldReloadNeeded: false }),
            __tmCollectVisibleListTasks: () => h.tasks,
            __tmNormalizePriorityCustomFieldDelta: () => ({}),
            __tmNormalizeCompactChecklistMetaFields: (values) => values || [],
            __tmGetTaskCardFieldList: () => [],
            __tmGetTimelineColumnOrder: () => h.context.SettingsStore.data.columnOrder,
            __tmProbeCurrentGroupTaskFreshness: async () => ({ status: 'unchanged' }),
            __tmRecomputeTaskProjection() {},
            __tmScheduleRender() {},
            __tmTryRestoreCurrentDocTabViewSnapshot: async () => ({ restored: true }),
            __tmShouldDeferMainViewRefreshForActiveScroll: () => false,
            __tmRerenderCurrentViewInPlace: () => { repaints += 1; return true; },
        });
        h.context.state.viewMode = viewMode;
        h.context.state.activeDocId = h.docs[0].id;
        h.context.state.__tmCacheFirstPaintNeedsVerify = false;
        h.context.SettingsStore.data.currentGroupId = scope === 'all' ? 'all' : 'project';
        h.context.SettingsStore.data.columnOrder = ['customField:stage', 'customField:labels', 'customField:notes'];
        h.context.state.modal = new Element();
        vm.runInContext(read('09-task-field-schema.js'), h.context);
        vm.runInContext(extract(stores, '__tmStableSettingsJsonValue'), h.context);
        vm.runInContext(extract(loader, 'buildVerifyTaskFieldSignature'), h.context);
        for (const name of ['__tmNormalizeCustomFieldId', '__tmParseCustomFieldColumnKey', '__tmCollectCustomFieldLoadPlan', '__tmBuildRuntimeCustomFieldLoadPlan']) {
            vm.runInContext(extract(stores, name), h.context);
        }
        for (const name of ['__tmGetVisibleTaskFingerprint', '__tmBuildDocTabCustomGroupActiveId', '__tmVerifyCachedTaskScope', '__tmScheduleSilentCacheVerifyAfterFirstPaint']) {
            vm.runInContext(extract(foundation, name), h.context);
        }
        const method = scope === 'tab-group' ? 'tmSwitchDocTabCustomGroup' : 'tmSwitchDoc';
        const start = foundation.indexOf(`    window.${method} =`);
        const end = foundation.indexOf('\n    };', start);
        vm.runInContext(foundation.slice(start, end + 7), h.context);
        await h.context.window[method](scope === 'tab-group' ? 'project' : 'all');
        assert.ok(work.length, 'snapshot-only tab switches must schedule a coverage check');
        while (work.length) await work.shift()();
        assert.equal(h.tasks.filter((task) => h.store.getProjected(task.id).customFieldValues.stage === 'new').length, 450);
        assert.equal(repaints, 1);
        assert.equal(h.context.state.__tmCacheFirstPaintNeedsVerify, false);
        const reads = h.queries.length;
        await h.context.window[method](scope === 'tab-group' ? 'project' : 'all');
        while (work.length) await work.shift()();
        assert.equal(h.queries.length, reads, 'returning to a complete aggregate must not reread custom attributes');
        assert.equal(repaints, 1, 'an unchanged aggregate must not repaint during verification');
    } finally { h.database.close(); }
});
}

test('document group snapshot verification repairs custom fields even when all document stamps match', async () => {
    const h = createAggregateHarness();
    try {
        const work = [];
        let repaints = 0;
        class Element {}
        Object.assign(h.context, {
            Element, HTMLElement: Element,
            setTimeout: (run) => { work.push(run); return work.length; }, clearTimeout() {},
            __tmScheduleIdleTask: (run) => work.push(run),
            __tmGetBackgroundRefreshGateMeta: () => ({ allowRun: true }),
            __tmSyncRemoteDocGroupSettingsIfNeeded: async () => false,
            __tmProbeCurrentGroupTaskFreshness: async () => ({ status: 'unchanged' }),
            __tmBuildRuntimeCustomFieldLoadPlan: () => ({ bulkFieldIds: ['stage', 'labels', 'notes'], deferredListFieldIds: [] }),
            __tmRecomputeTaskProjection() {}, recalcStats() {},
            __tmRerenderCurrentViewInPlace: () => { repaints += 1; return true; },
        });
        h.context.state.viewMode = 'checklist';
        h.context.state.activeDocId = 'all';
        h.context.state.modal = new Element();
        h.context.SettingsStore.data.currentGroupId = 'project';
        for (const name of ['__tmVerifyCachedTaskScope', '__tmScheduleDocGroupSwitchVerifyAfterFirstPaint']) {
            vm.runInContext(extract(foundation, name), h.context);
        }
        h.context.__tmScheduleDocGroupSwitchVerifyAfterFirstPaint();
        while (work.length) await work.shift()();
        assert.equal(h.tasks.filter((task) => h.store.getProjected(task.id).customFieldValues.stage === 'new').length, 450);
        assert.equal(repaints, 1);
    } finally { h.database.close(); }
});

test('truncated attribute queries never mark omitted task fields as loaded', async () => {
    const h = createAggregateHarness();
    try {
        const call = h.context.API.call;
        h.context.API.call = async (...args) => ({ ...(await call(...args)), truncated: true });
        const result = await h.context.__tmAttachCustomFieldAttrsToTasks(h.tasks, { fieldIds: ['stage', 'labels', 'notes'] });
        assert.equal(result.queryComplete, false);
        assert.equal(h.tasks.some((task) => task.__tmLoadedCustomFieldIds?.length), false);
        assert.equal(h.context.__tmCustomFieldAttrValueCache.size, 0);
    } finally { h.database.close(); }
});

test('switching the all-tabs context during field repair discards the old result', async () => {
    const h = createAggregateHarness();
    try {
        Object.assign(h.context, {
            __tmBuildRuntimeCustomFieldLoadPlan: () => ({ bulkFieldIds: ['stage'], deferredListFieldIds: [] }),
            __tmProbeCurrentGroupTaskFreshness: async () => ({ status: 'unchanged' }),
            __tmRecomputeTaskProjection() {},
        });
        vm.runInContext(extract(foundation, '__tmVerifyCachedTaskScope'), h.context);
        const attach = h.context.__tmAttachCustomFieldAttrsToTasks;
        h.context.__tmAttachCustomFieldAttrsToTasks = async (...args) => {
            const result = await attach(...args);
            h.context.state.activeDocId = h.docs[0].id;
            return result;
        };
        const result = await h.context.__tmVerifyCachedTaskScope();
        assert.equal(result.complete, false);
        assert.equal(h.tasks.some((task) => h.store.getProjected(task.id).customFieldValues.stage), false);
        assert.equal(h.saves.length, 0);
    } finally { h.database.close(); }
});

test('deferred table fields reach projected reads, every task mirror and the next snapshot', async () => {
    const h = createHydrationHarness();
    await h.context.__tmHydrateVisibleListCustomFields(['stage', 'labels', 'notes']);
    const expected = { stage: 'new', labels: ['b'], notes: '补读的备注' };
    assert.deepEqual(clone(h.store.getProjected('task-a').customFieldValues), expected);
    for (const task of h.mirrors) assert.deepEqual(clone(task.customFieldValues), expected);
    assert.equal(h.saves.length, 1, 'a read after the initial snapshot save must schedule another save');
    assert.deepEqual(h.saves[0].tree[0].tasks[0].customFieldValues, expected);
    await h.context.__tmHydrateVisibleListCustomFields(['stage', 'labels', 'notes']);
    assert.equal(h.saves.length, 1, 'unchanged cache reads must not keep rewriting the snapshot');
});

test('failed and superseded table field reads cannot publish partial fields or schedule snapshots', async () => {
    for (const superseded of [false, true]) {
        const h = createHydrationHarness();
        h.context.__tmAttachCustomFieldAttrsToTasks = async (tasks) => {
            tasks[0].__customFieldRawValues = { stage: 'new' };
            if (superseded) h.mutate('local', { customFieldValues: { stage: 'old' } });
            return { queryComplete: superseded, cacheMissCount: 1 };
        };
        const result = await h.context.__tmHydrateVisibleListCustomFields(['stage']);
        assert.equal(result.queryComplete, false);
        assert.equal(h.mirrors[0].__customFieldRawValues.stage, superseded ? '旧阶段' : undefined);
        assert.equal(h.saves.length, 0);
    }
});

test('a deferred field read retries once after a concurrent task update invalidates its result', async () => {
    const h = createHydrationHarness();
    const timers = [];
    let refreshed = 0;
    Object.assign(h.context, {
        setTimeout: (callback) => { timers.push(callback); return timers.length; },
        clearTimeout() {},
        __tmShouldDeferTaskFieldRefreshWork: () => false,
        __tmShouldDeferMainViewRefreshForActiveScroll: () => false,
        __tmScheduleViewRefresh: () => { refreshed += 1; },
    });
    h.context.state.deferredListCustomFieldIds = ['stage', 'labels', 'notes'];
    vm.runInContext(extract(foundation, '__tmScheduleListAutoLoadMoreHydration'), h.context);
    const attach = h.context.__tmAttachCustomFieldAttrsToTasks;
    let reads = 0;
    h.context.__tmAttachCustomFieldAttrsToTasks = async (...args) => {
        const result = await attach(...args);
        if (++reads === 1) h.mutate('local', { priority: 'high' });
        return result;
    };
    assert.equal(h.context.__tmScheduleListAutoLoadMoreHydration(), true);
    await timers.shift()();
    assert.equal(h.saves.length, 0);
    assert.equal(timers.length, 1, 'a superseded read must get another chance without requiring a click');
    await timers.shift()();
    assert.equal(h.store.getProjected('task-a').customFieldValues.stage, 'new');
    assert.equal(refreshed, 1);
});

test('a freshly cleared custom field stays cleared in projected reads and snapshots', async () => {
    const h = createHydrationHarness();
    h.mutate('local', { customFieldValues: { stage: 'old' } });
    h.context.__tmAttachCustomFieldAttrsToTasks = async (tasks, options) => {
        assert.equal(options.forceFresh, true, 'an explicit refresh must bypass the attribute cache');
        tasks[0].__customFieldRawValues = { stage: '' };
        tasks[0].__tmLoadedCustomFieldIds = ['stage'];
        return { queryComplete: true, cacheMissCount: 1 };
    };
    await h.context.__tmHydrateVisibleListCustomFields(['stage'], { forceFresh: true });
    assert.equal(h.readAfterNormalization(h.store.getProjected('task-a')).stage, undefined);
    assert.equal(h.saves[0].tree[0].tasks[0].customFieldValues.stage, undefined);
});

test('checklist detail attribute hydration updates the confirmed data used on the next render', async () => {
    for (const useProjected of [true, false]) {
        const h = createHydrationHarness();
        h.context.state.viewMode = 'checklist';
        Object.assign(h.context, {
            __tmIsTaskDetailWhiteboardSnapshotTask: () => false,
            __tmGetTaskDetailRemarkRaw: (task) => task.remark || '',
            __tmTaskHasOwnHeadingContextFields: () => true,
            normalizeTaskFields: (task) => {
                task.customFieldValues = h.context.__tmNormalizeTaskCustomFieldValues(h.context.__tmGetTaskCustomFieldRawValues(task));
            },
        });
        vm.runInContext(extract(list, '__tmCacheTaskInState'), h.context);
        vm.runInContext(extract(detail, '__tmEnsureTaskDetailFieldAttrs'), h.context);
        const sourceTask = useProjected ? h.store.getProjected('task-a') : h.mirrors[0];
        await h.context.__tmEnsureTaskDetailFieldAttrs(sourceTask, { force: true });
        assert.equal(h.store.getProjected('task-a').customFieldValues.stage, 'new');
        assert.equal(h.saves.length, 1);
        assert.equal(h.saves[0].tree[0].tasks[0].customFieldValues.stage, 'new');
    }
});

test('saved custom fields survive JSON storage and replace the old baseline when reopened', async () => {
    const h = createHydrationHarness();
    Object.assign(h.context, {
        __TM_TASK_REPEAT_RULE_ATTR: 'custom-repeat-rule',
        __TM_TASK_REPEAT_STATE_ATTR: 'custom-repeat-state',
        __TM_TASK_REPEAT_HISTORY_ATTR: 'custom-repeat-history',
        __tmGetTaskMetaAttrReadKeys: () => [],
        __tmNormalizeTaskRepeatRule: (value) => value || { enabled: false, type: 'none' },
        __tmNormalizeTaskRepeatState: (value) => value || {},
        __tmNormalizeTaskRepeatHistory: (value) => value || [],
        __tmNormalizeTaskSnapshotDocIds: (ids) => [...new Set(ids)].sort(),
        __tmGetTaskCountCoverageStatus: () => ({ ok: true }),
        __tmMergeLocalTaskPatchIntoTaskTree() {},
    });
    for (const name of [
        '__tmCloneTaskSnapshotValue', '__tmIsTaskSnapshotMeaningfulValue',
        '__tmSnapshotPickFirstValue', '__tmSnapshotPickBooleanTrue',
        '__tmSnapshotNormalizeTaskRepeatRuleForStore', '__tmSnapshotNormalizeTaskRepeatStateForStore',
        '__tmSnapshotNormalizeTaskRepeatHistoryForStore', '__tmSnapshotNormalizeTaskCustomFieldsForStore',
        '__tmCompactTaskSnapshotTaskForStore', '__tmHydrateTaskSnapshotTaskForRuntime',
        '__tmBuildFlatTasksFromTaskSnapshotTree', '__tmReplaceFlatTasksThroughTaskStore',
        '__tmRestoreTaskSnapshotIntoState',
    ]) vm.runInContext(extract(stores, name), h.context);
    await h.context.__tmHydrateVisibleListCustomFields(['stage', 'labels', 'notes']);
    const saved = clone({ docIds: ['doc-a'], taskTree: [{ id: 'doc-a', tasks: [
        h.context.__tmCompactTaskSnapshotTaskForStore(h.saves[0].tree[0].tasks[0]),
    ] }] });
    h.store.replaceFlat({ 'task-a': clone(h.original) }, { authoritative: true, mergeOtherBlocks: false });
    assert.deepEqual(clone(h.store.getProjected('task-a').customFieldValues), {});
    saved.taskTree[0].tasks.forEach(h.context.__tmHydrateTaskSnapshotTaskForRuntime);
    assert.ok(h.context.__tmRestoreTaskSnapshotIntoState(saved));
    assert.deepEqual(clone(h.store.getProjected('task-a').customFieldValues), {
        stage: 'new', labels: ['b'], notes: '补读的备注',
    });
});

test('custom edits merge into every mounted task mirror and survive view normalization', () => {
    const h = createHarness();
    h.mutate('optimistic', { customFieldValues: { stage: 'new' } });
    for (const task of h.mirrors) {
        assert.deepEqual(clone(task.customFieldValues), { stage: 'new', labels: ['a'], notes: '原备注' });
        assert.equal(h.readAfterNormalization(task).stage, 'new', 'view switches must not restore the old raw attribute');
    }
});

test('projected custom values and raw attributes advance together without mutating the confirmed baseline', () => {
    const h = createHarness();
    h.mutate('optimistic', { customFieldValues: { stage: 'new', labels: ['a', 'b'], notes: '新备注' } });
    assert.deepEqual(h.readAfterNormalization(h.store.getProjected('task-a')), {
        stage: 'new', labels: ['a', 'b'], notes: '新备注',
    });
    h.mutate('rollback', {}, { inversePatch: h.original });
    assert.deepEqual(h.readAfterNormalization(h.store.getProjected('task-a')), h.original.customFieldValues);
});

test('confirmed field edits remain fresh when another view normalizes the task', () => {
    const h = createHarness();
    const patch = { customFieldValues: { stage: 'new', notes: '保存后的备注' } };
    h.mutate('optimistic', patch);
    h.mutate('commit', patch);
    assert.deepEqual(h.readAfterNormalization(h.store.getProjected('task-a')), {
        stage: 'new', labels: ['a'], notes: '保存后的备注',
    });
});

test('clearing custom fields does not resurrect old values during the next view render', () => {
    const h = createHarness();
    const patch = { customFieldValues: { stage: '', labels: [], notes: '' } };
    h.mutate('optimistic', patch);
    assert.deepEqual(h.readAfterNormalization(h.store.getProjected('task-a')), {});
    h.mutate('commit', patch);
    assert.deepEqual(h.readAfterNormalization(h.store.getProjected('task-a')), {});
    for (const task of h.mirrors) assert.deepEqual(h.readAfterNormalization(task), {});
});

test('checklist detail updates custom fields locally while preserving the active text draft', () => {
    const h = createHarness();
    class Element {}
    class TextArea extends Element {}
    const selectValue = new Element();
    const textarea = Object.assign(new TextArea(), { value: '正在编辑的草稿' });
    const panel = Object.assign(new Element(), {
        id: 'tmChecklistDetailPanel', dataset: { tmDetailTaskId: 'task-a' },
        querySelector: (selector) => {
            if (selector === '[data-tm-detail-custom-field="stage"] .tm-task-detail-custom-field-value') return selectValue;
            if (selector === 'textarea[data-tm-detail-custom-text-field="notes"]') return textarea;
            return null;
        },
    });
    Object.assign(h.context, {
        Element, HTMLElement: Element, HTMLTextAreaElement: TextArea,
        document: { activeElement: textarea },
        __tmTaskBoundary: { getTask: (id) => h.store.getProjected(id) },
        __tmIsTaskDetailRootUsable: () => true,
        __tmAreTaskDetailIdsEquivalent: (a, b) => a === b,
        __tmIsCustomFieldApplicableToTask: () => true,
        __tmBuildCustomFieldDisplayHtml: (_field, value) => value || '未设置',
    });
    vm.runInContext(extract(stores, '__tmGetTaskCustomFieldValue'), h.context);
    vm.runInContext(extract(detail, '__tmGetChecklistDetailTaskById'), h.context);
    vm.runInContext(extract(detail, '__tmPatchTaskDetailPanelInPlace'), h.context);
    const patch = { customFieldValues: { stage: 'new', notes: '其他视图的新备注' } };
    h.mutate('local', patch);
    assert.equal(h.context.__tmPatchTaskDetailPanelInPlace(panel, 'task-a', patch), true);
    assert.equal(selectValue.innerHTML, 'new');
    assert.equal(textarea.value, '正在编辑的草稿');
    h.context.document.activeElement = null;
    h.context.__tmPatchTaskDetailPanelInPlace(panel, 'task-a', patch);
    assert.equal(textarea.value, '其他视图的新备注');
    h.mutate('local', { customFieldValues: { stage: '' } });
    h.context.__tmPatchTaskDetailPanelInPlace(panel, 'task-a', { customFieldValues: { stage: '' } });
    assert.equal(selectValue.innerHTML, '未设置');
});

test('timeline custom field cells receive the same local patch as other views', () => {
    class Element {}
    const row = new Element();
    const modal = Object.assign(new Element(), { querySelector: () => row });
    const calls = [];
    const task = { id: 'task-a', customFieldValues: { stage: 'new' } };
    const context = vm.createContext({
        Element, HTMLElement: Element, CSS: { escape: (value) => value },
        state: { modal, viewMode: 'timeline' },
        __tmTaskStore: { getProjected: () => task },
        __tmDoesPatchAffectPriorityScore: () => false,
        __tmUpdateTaskCustomFieldsInDOM: (...args) => { calls.push(args); return true; },
    });
    const start = coordinator.indexOf('    const __tmViewControllers = {');
    const end = coordinator.indexOf('\n    };', start);
    assert.ok(start >= 0 && end > start);
    vm.runInContext(coordinator.slice(start, end + 7) + '\nthis.controllers = __tmViewControllers;', context);
    const patch = { customFieldValues: { stage: 'new' } };
    assert.equal(context.controllers.timeline.patchTask('task-a', patch), true);
    assert.deepEqual(calls, [[row, task, patch]]);
});
