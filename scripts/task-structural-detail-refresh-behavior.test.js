'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js'), 'utf8');
function section(startText, endText) {
    const start = source.indexOf(startText);
    const end = source.indexOf(endText, start);
    assert.ok(start >= 0 && end > start, `missing section: ${startText}`);
    return source.slice(start, end);
}
const code = [
    section('function __tmNormalizeViewRefreshDetail(', 'function __tmCollectGlobalTaskDetailUiReasons('),
    section('function __tmPerformViewRefresh(', 'function __tmScheduleViewRefresh('),
    section('function __tmRunTaskProjectionBatch(', 'const __tmPendingProjectionEntries ='),
].join('\n');

function setup({ mode = 'kanban', projected = true, matchingDetail = '', detailThrows = false, fallbackWorks = true } = {}) {
    class Element { querySelector() { return new Element(); } }
    const calls = { detail: [], scheduled: [], main: 0, inPlace: 0, render: 0, projection: 0 };
    const state = { viewMode: mode, modal: new Element(), filteredTasks: [{ id: 'task' }], listRenderLimit: 23 };
    const context = vm.createContext({
        Element, HTMLElement: Element, state,
        CSS: { escape: (value) => value },
        document: { body: { contains: () => true } },
        __tmGetBusyTaskDetailBarrier: () => null,
        __tmIsPluginVisibleNow: () => true,
        __tmRefreshVisibleTaskDetailForTask(id, options) {
            calls.detail.push({ id, options });
            if (detailThrows) throw new Error('detail unmounted during refresh');
            return id === matchingDetail;
        },
        __tmRerenderCurrentViewInPlace() { calls.inPlace++; return fallbackWorks; },
        __tmRefreshMainViewInPlace() { calls.main++; },
        render() { calls.render++; },
        __tmAnalyzeTaskProjectionPatch: () => ({ projection: true }),
        __tmCollectTaskProjectionClosure: (ids) => ids,
        __tmGetTaskProjectionPlacementIds: () => ['task'],
        __tmCaptureViewRenderWindow: () => null,
        __tmCaptureViewScrollAnchor: () => null,
        __tmRecomputeTaskProjection() { calls.projection++; return { applied: true }; },
        __tmTryApplyListProjectionBatchInPlace: () => projected,
        __tmTryApplyChecklistOptimisticProjectionInPlace: () => projected,
        __tmTryApplyKanbanOptimisticProjectionInPlace: () => projected,
        __tmTryReconcileKanbanParentCards: () => false,
        __tmMarkChecklistProjectionGroupRefresh: () => {},
        __tmScheduleViewRefresh(options) {
            calls.scheduled.push(options);
            // Detail notifications execute immediately; main refreshes remain scheduled.
            if (options.mode === 'detail') context.__tmPerformViewRefresh(options);
        },
    });
    vm.runInContext(code, context);
    return { context, calls };
}

for (const mode of ['list', 'checklist', 'kanban']) {
    for (const matchingDetail of ['', 'unrelated-task', 'parent']) {
        test(`${mode}: optimistic and committed moves refresh matching details without a second main render (${matchingDetail || 'closed'})`, () => {
            const { context, calls } = setup({ mode, matchingDetail });
            for (const phase of ['optimistic', 'committed']) {
                assert.equal(context.__tmRunTaskProjectionBatch({
                    structural: true, taskIds: ['task'], affectedGroupIds: ['parent'],
                    fieldChanges: [], reason: `move-${phase}`,
                }, { structuralTypes: ['moveTask'] }), true);
            }
            assert.equal(calls.projection, 2, 'both mutation phases still update task projection');
            assert.equal(calls.scheduled.length, 2);
            assert.ok(calls.scheduled.every((entry) => entry.mode === 'detail' && entry.detailOnly));
            assert.deepEqual(calls.detail.map((entry) => entry.id), ['task', 'parent', 'task', 'parent']);
            assert.ok(calls.detail.every((entry) => entry.options.forceRebuild === true));
            assert.equal(calls.inPlace + calls.render + calls.main, 0, 'detail notification must not rebuild the list or board');
        });
    }

    test(`${mode}: a failed local structural update still schedules the necessary main refresh`, () => {
        const { context, calls } = setup({ mode, projected: false });
        context.__tmRunTaskProjectionBatch({ structural: true, taskIds: ['task'], fieldChanges: [], reason: 'outdent' }, {
            structuralTypes: ['moveTask'],
        });
        assert.deepEqual(calls.scheduled.map((entry) => entry.mode), ['current', 'detail']);
        assert.equal(calls.scheduled[0].withFilters, false, 'already computed projection is reused');
        assert.equal(calls.inPlace + calls.render, 0, 'detail notification must not duplicate the pending main refresh');
        context.__tmPerformViewRefresh(calls.scheduled[0]);
        assert.equal(calls.main, 1);
    });
}

test('detail disappearing during structural refresh does not trigger a full main render', () => {
    const { context, calls } = setup({ detailThrows: true });
    assert.equal(context.__tmPerformViewRefresh({ mode: 'detail', detailOnly: true, taskIds: ['task'] }), true);
    assert.equal(calls.detail.length, 1);
    assert.equal(calls.inPlace + calls.render, 0);
});

test('legacy detail callers retain their in-place and final full-render fallbacks', () => {
    for (const fallbackWorks of [true, false]) {
        const { context, calls } = setup({ fallbackWorks });
        context.__tmPerformViewRefresh({ mode: 'detail', taskIds: ['task'] });
        assert.equal(calls.inPlace, 1);
        assert.equal(calls.render, fallbackWorks ? 0 : 1);
    }
});

test('detail-only permission survives normalization without suppressing broader merged requests', () => {
    const { context, calls } = setup();
    const targeted = { mode: 'detail', detailOnly: true, taskIds: ['task'] };
    assert.equal(context.__tmMergeViewRefreshDetail(null, targeted).detailOnly, true);
    assert.equal(context.__tmMergeViewRefreshDetail(targeted, targeted).detailOnly, true);
    const legacy = { mode: 'detail', taskIds: ['parent'] };
    for (const [left, right] of [[targeted, legacy], [legacy, targeted]]) {
        const merged = context.__tmMergeViewRefreshDetail(left, right);
        assert.equal(merged.detailOnly, false);
        assert.equal(merged.taskIds.length, 2);
    }
    for (const mode of ['current', 'full']) {
        const merged = context.__tmMergeViewRefreshDetail(targeted, { mode, detailOnly: true, withFilters: false });
        assert.equal(merged.mode, mode);
        context.__tmPerformViewRefresh(merged);
    }
    assert.equal(calls.main, 1);
    assert.equal(calls.render, 1);
});

test('a scoped kanban structural commit does not enqueue another main refresh', () => {
    const { context, calls } = setup({ mode: 'kanban', projected: false });
    const scopes = [];
    context.__tmTryRefreshKanbanColumns = (modal, ids, options) => {
        scopes.push({ ids: Array.from(ids), parents: Array.from(options.parentTaskIds) });
        return true;
    };
    context.__tmRunTaskProjectionBatch({ structural: true, taskIds: ['task'], affectedGroupIds: ['parent'],
        fieldChanges: [], reason: 'outdent-commit' }, { structuralTypes: ['moveTask'] });
    assert.deepEqual(scopes, [{ ids: ['task', 'parent'], parents: ['parent'] }]);
    assert.deepEqual(calls.scheduled.map((entry) => entry.mode), ['detail']);
    assert.equal(calls.inPlace + calls.render + calls.main, 0);
});

for (const mode of ['list', 'checklist', 'timeline', 'whiteboard']) {
    test(`${mode}: main refresh forwards the changed task scope`, () => {
        const { context, calls } = setup({ mode });
        const scopes = [];
        const record = (modal, options) => { scopes.push(Array.from(options.taskIds)); return true; };
        context.__tmRerenderListInPlace = record;
        context.__tmRerenderTimelineInPlace = record;
        context.__tmRerenderCurrentViewInPlace = record;
        context.__tmMarkChecklistProjectionGroupRefresh = (ids) => scopes.push(Array.from(ids));
        context.__tmRenderChecklistPreserveScroll = () => {};
        vm.runInContext(section('function __tmRefreshMainViewInPlace(', 'const __tmTaskStateKernel ='), context);
        context.__tmRefreshMainViewInPlace({ taskIds: ['task', 'parent'], withFilters: false, reason: 'ws-main-batch' });
        assert.deepEqual(scopes, [['task', 'parent']]);
        assert.equal(calls.projection + calls.render, 0);
    });
}
