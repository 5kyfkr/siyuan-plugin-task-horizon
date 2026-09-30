'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const root = path.join(__dirname, '../src/task-horizon/main');
function loadFunction(context, file, name) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const start = source.search(new RegExp('    (?:async )?function ' + name + '\\('));
    const end = source.indexOf('\n    }', start) + '\n    }'.length;
    assert.ok(start >= 0 && end > start, name);
    vm.runInContext(source.slice(start, end), context);
}

test('kanban refresh retains moved/deleted tasks and resolved parents, excluding structural block IDs', () => {
    const context = vm.createContext({ __tmTaskBoundary: { getTask: (id) => ['moved', 'new-parent'].includes(id) ? { id } : null } });
    loadFunction(context, '10-stores-rules-and-cache.js', '__tmResolveKanbanRefreshTaskIds');
    const result = context.__tmResolveKanbanRefreshTaskIds(
        ['moved', 'list-container', 'deleted', 'paragraph', 'new-parent'], ['old-parent', 'new-parent'],
        new Map([['source-doc', new Set(['deleted', 'old-parent'])]]));
    assert.deepEqual(Array.from(result), ['moved', 'deleted', 'new-parent', 'old-parent']);
});

function createStructuralTxContext(resolveImpacts) {
    const sourceDoc = '20260202084650-rzxfgy1';
    const targetDoc = '20260803224912-re9cohw';
    const otherDoc = '20241214232059-7wqf6nn';
    const container = '20261001000914-lyin57s';
    const context = vm.createContext({
        state: { __tmLoadedDocIdsForTasks: [sourceDoc, targetDoc, otherDoc] },
        __TM_TASK_TX_BLOCK_ID_LIMIT: 256,
        __tmGetPerfTuningOptions: () => ({}),
        __tmResolveLocalTaskBindingFromAnyBlockId: () => null,
        API: { resolveTaskChangeImpacts: resolveImpacts },
        txTargets: { docIds: new Set(), blockIds: new Set([container]), structural: true, committed: true },
        txAttrUpdates: [],
        __tmScheduleBatchedTaskIncrementalRefreshFromTx: (_payload, options) => { context.queued = options; },
    });
    for (const name of ['__tmIsLikelyBlockId', '__tmAddBoundedTaskTxIds', '__tmGetLoadedTaskScopeDocIds',
        '__tmResolveLoadedTaskIdsFromBlockIds', '__tmClassifyPendingTaskTxRefresh']) {
        loadFunction(context, '10-stores-rules-and-cache.js', name);
    }
    const source = fs.readFileSync(path.join(root, '10-stores-rules-and-cache.js'), 'utf8');
    const handler = source.indexOf('__tmSqlCacheEventBusHandler = (msg) => {');
    const start = source.indexOf('                if (!__tmAddBoundedTaskTxIds(', handler);
    const end = source.indexOf('\n            };', start);
    assert.ok(handler >= 0 && start > handler && end > start);
    vm.runInContext('function queueStructuralTx() {\n' + source.slice(start, end) + '\n}', context);
    context.classifyQueued = () => {
        context.queueStructuralTx();
        return context.__tmClassifyPendingTaskTxRefresh({
            docIds: Array.from(context.queued.targets.docIds),
            blockIds: Array.from(context.queued.targets.blockIds), meta: context.queued,
        });
    };
    return { context, sourceDoc, targetDoc, otherDoc, container };
}

test('rootless recycle container events resolve source and destination before widening scope', async () => {
    let queriedIds;
    const fixture = createStructuralTxContext(async (ids) => {
        queriedIds = Array.from(ids);
        return [{ docId: fixture.sourceDoc }, { docId: fixture.targetDoc }];
    });
    const result = await fixture.context.classifyQueued();
    assert.equal(fixture.context.queued.wholeScopeDirty, false);
    assert.deepEqual(queriedIds, [fixture.container]);
    assert.deepEqual(Array.from(result.docIds), [fixture.sourceDoc, fixture.targetDoc]);
    assert.equal(result.forceDocRefresh, true);
    assert.equal(result.relevant, true);
});

for (const failure of ['deleted-block', 'query-failed', 'truncated', 'explicit-whole-scope']) {
    test(`structural scope keeps conservative fallback for ${failure}`, async () => {
        let queries = 0;
        const fixture = createStructuralTxContext(async () => {
            queries++;
            if (failure === 'query-failed') throw new Error('index unavailable');
            return [];
        });
        if (failure === 'query-failed') fixture.context.txTargets.docIds.add(fixture.sourceDoc);
        if (failure === 'truncated') fixture.context.txTargets.truncated = true;
        if (failure === 'explicit-whole-scope') fixture.context.txTargets.wholeScopeDirty = true;
        const result = await fixture.context.classifyQueued();
        assert.deepEqual(Array.from(result.docIds), [fixture.sourceDoc, fixture.targetDoc, fixture.otherDoc]);
        assert.equal(result.forceDocRefresh, true);
        assert.equal(queries, ['truncated', 'explicit-whole-scope'].includes(failure) ? 0 : 1);
    });
}

for (const wholeScopeDirty of [false, true]) {
    test(`WS batch waits for a local write and retries without consuming failure attempts (wholeScope=${wholeScopeDirty})`, async () => {
        let pending = true; let classifications = 0; let refreshes = 0;
        const timers = [];
        const targets = { docIds: ['doc'], blockIds: ['task'], meta: { committed: true, wholeScopeDirty } };
        const state = { externalTaskTxDirty: true, viewMode: 'kanban' };
        const context = vm.createContext({
            state, __tmTxTaskRefreshInFlight: false, __tmTxTaskRefreshTimer: null,
            __tmTxTaskRefreshAttemptCount: 0, __TM_TASK_TX_MAX_REFRESH_ATTEMPTS: 4,
            __tmTaskMutations: { hasPending: () => pending, hasPendingForTask: (id) => pending && id === 'task' },
            __tmSnapshotPendingTxRefreshTargets: () => targets,
            __tmGetTxRefreshRetryMeta: () => ({ allowRun: true }),
            __tmClassifyPendingTaskTxRefresh: async () => { classifications++; return { relevant: true, ...targets }; },
            __tmScheduleCalendarRefetchFromTx() {},
            __tmRunAutoRefreshIfNeeded: async () => { refreshes++; state.externalTaskTxDirty = false; return true; },
            setTimeout: (callback) => { timers.push(callback); return timers.length; }, clearTimeout() {},
        });
        loadFunction(context, '10-stores-rules-and-cache.js', '__tmFlushTaskIncrementalRefreshFromTx');
        assert.equal(await context.__tmFlushTaskIncrementalRefreshFromTx({}), false);
        assert.equal(classifications, 0); assert.equal(refreshes, 0);
        assert.equal(state.externalTaskTxDirty, true);
        assert.equal(context.__tmTxTaskRefreshAttemptCount, 0);
        assert.equal(context.__tmTxTaskRefreshInFlight, false);
        assert.equal(timers.length, 1);
        pending = false;
        timers.shift()();
        await new Promise(setImmediate);
        assert.equal(classifications, 1); assert.equal(refreshes, 1);
        assert.equal(state.externalTaskTxDirty, false);
        assert.equal(timers.length, 0);
    });
}

class Element {
    constructor(id = '') { this.id = id; this.style = { color: 'priority-color', removeProperty() {} }; this.isConnected = true; }
    matches() { return false; }
    closest() { return { getAttribute: () => this.id }; }
}

test('fresh titles keep rendered priority colors; ordinary refresh still restores colors when today marks clear', () => {
    const today = new Element('today'); const normal = new Element('normal'); const modal = new Element();
    modal.querySelectorAll = () => [today, normal];
    let lookups = 0; let titleUpdates = 0; let hasToday = true;
    const context = vm.createContext({
        Element, HTMLElement: Element, state: { modal },
        __tmHasTaskScheduledToday: (id) => hasToday && id === 'today',
        __tmTaskBoundary: { getTask: (id) => { lookups++; return { id }; } },
        __tmApplyTaskTitleOpacityToElement: (el) => { titleUpdates++; el.style.color = 'priority-color'; },
    });
    loadFunction(context, '20-api-and-runtime-services.js', '__tmApplyTodayScheduledTaskNameMarks');
    context.__tmApplyTodayScheduledTaskNameMarks(modal, { preserveRenderedTitleStyle: true });
    assert.equal(today.style.color, 'var(--tm-primary-color)');
    assert.equal(normal.style.color, 'priority-color');
    assert.equal(lookups, 0); assert.equal(titleUpdates, 0);
    hasToday = false;
    context.__tmApplyTodayScheduledTaskNameMarks(modal);
    assert.equal(today.style.color, 'priority-color');
    assert.equal(titleUpdates, 2);
});

test('scheduled marks skip unchanged painted data, but still apply changes and day rollover', async () => {
    const modal = new Element(); let day = 'day-one'; let changed = false; let marks = 0;
    const context = vm.createContext({
        Element, state: { modal, todayScheduledSourceReady: true, todayScheduledTaskIdsDay: day },
        __tmGetTodayDateKey: () => day,
        __tmLoadTodayScheduledTaskIds: async () => ({ changed }),
        __tmApplyTodayScheduledTaskNameMarks: () => { marks++; },
    });
    loadFunction(context, '20-api-and-runtime-services.js', '__tmScheduleTodayScheduledTaskNameMarksRefresh');
    const refresh = async () => {
        context.__tmScheduleTodayScheduledTaskNameMarksRefresh(modal, false, modal, { alreadyApplied: true });
        await new Promise(setImmediate);
    };
    await refresh(); assert.equal(marks, 0);
    changed = true; await refresh(); assert.equal(marks, 1);
    changed = false; day = 'day-two'; await refresh(); assert.equal(marks, 2);
});

test('view refresh batching preserves document scopes through normalization and merging', () => {
    const context = vm.createContext({});
    for (const name of ['__tmNormalizeViewRefreshDetail', '__tmViewRefreshPriority', '__tmMergeViewRefreshDetail']) {
        loadFunction(context, 'task-runtime/51-whiteboard-and-link-runtime.js', name);
    }
    const result = context.__tmMergeViewRefreshDetail({ taskIds: ['task'], docIds: ['doc'] }, { docIds: ['doc', 'doc2'] });
    assert.deepEqual(Array.from(result.taskIds), ['task']);
    assert.deepEqual(Array.from(result.docIds), ['doc', 'doc2']);
});

test('single-task confirmation retries only a committed move whose local placement matches expectations', () => {
    const context = vm.createContext({});
    loadFunction(context, '10-stores-rules-and-cache.js', '__tmShouldRetryCommittedMoveTaskRow');
    const pending = { type: 'moveTask', phase: 'commit', expectedDocId: 'doc', expectedParentTaskId: '', hasExpectedParent: true };
    const previous = { root_id: 'doc', parentTaskId: '' };
    const stale = { root_id: 'doc', parent_task_id: 'old-parent' };
    const check = context.__tmShouldRetryCommittedMoveTaskRow;
    assert.equal(check(stale, previous, pending), true);
    assert.equal(check({ ...stale, parent_task_id: null }, previous, pending), false);
    assert.equal(check(stale, previous, { ...pending, phase: 'optimistic' }), false);
    assert.equal(check(stale, { ...previous, parentTaskId: 'different-local-parent' }, pending), false);
    assert.equal(check(stale, previous, null), false);
});

for (const outcome of ['caught-up', 'still-stale', 'newer-local-edit']) {
    test(`committed move confirmation retries one row safely: ${outcome}`, async () => {
        const taskId = '20261001002429-i8pwdta';
        const docId = '20260202084650-rzxfgy1';
        const previous = { id: taskId, root_id: docId, parentTaskId: '', parent_task_id: '', parent_id: 'new-list' };
        const stale = { ...previous, parent_task_id: 'old-parent', parent_id: 'old-list' };
        let queries = 0; let flushes = 0; let current = true; let patched = null;
        const deferred = [];
        const context = vm.createContext({
            state: { modal: {}, viewMode: 'kanban' }, document: { body: { contains: () => true } },
            SettingsStore: { data: {} },
            __tmGetPerfTuningOptions: () => ({ taskBlockIncrementalRefresh: true }),
            __tmCollectCustomFieldLoadPlan: () => ({}), __tmGetCustomFieldDefs: () => [],
            __tmGetDocDisplayNameMode: () => 'name', __tmBuildVisibleDateFallbackTaskIdSet: () => new Set(),
            __tmNormalizeDateOnly: () => '', __tmFindLoadedTaskTreeSlot: () => ({ task: previous }),
            __tmGetLocalTaskPatchWatermark: () => null, __tmTaskHasLocalPatchWatermarkForFields: () => false,
            __tmBuildAuthoritativeTaskConfirmationCandidate: (row) => ({ ...row }),
            __tmPrepareTaskBlockIncrementalRow: (row) => ({ ...row, parentTaskId: row.parent_task_id }),
            __tmBuildTaskBlockVisibleDomPatch: () => ({}),
            __tmPatchLoadedTaskBlockInPlace: (_id, row) => { patched = row; return docId; },
            __tmTaskStore: {
                captureRead: () => ({}), isReadCurrent: () => current,
                getPendingStructural: () => ({ type: 'moveTask', phase: 'commit', expectedDocId: docId,
                    expectedParentTaskId: '', hasExpectedParent: true }),
            },
            API: { getTaskById: async () => { queries++; return queries === 1 || outcome === 'still-stale' ? stale : previous; } },
            __tmFlushSqlTransactionsSafe: async () => { flushes++; if (outcome === 'newer-local-edit') current = false; },
        });
        for (const name of ['__tmIsLikelyBlockId', '__tmCanPatchTaskBlockIncrementally',
            '__tmShouldRetryCommittedMoveTaskRow', '__tmRefreshAffectedTaskBlocksIncrementally']) {
            loadFunction(context, '10-stores-rules-and-cache.js', name);
        }
        const result = await context.__tmRefreshAffectedTaskBlocksIncrementally({
            blockIds: [taskId], resolvedTaskIds: [taskId], docIds: [docId],
            committed: true, commitView: false, onDeferred: (reason) => deferred.push(reason),
        });
        assert.equal(flushes, 1);
        assert.equal(queries, outcome === 'newer-local-edit' ? 1 : 2);
        assert.equal(result, outcome === 'caught-up');
        if (outcome === 'caught-up') assert.equal(patched.parentTaskId, '');
        else assert.equal(patched, null);
        if (outcome === 'newer-local-edit') assert.deepEqual(deferred, ['task-store-changed']);
    });
}
