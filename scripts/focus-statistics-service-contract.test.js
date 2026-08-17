const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'src/task-horizon/main/36-focus-statistics-service.js'), 'utf8');
let revision = 1;
let dockCalls = 0;
let projectCalls = 0;
let scopeResolveCalls = 0;
let resolvedScopeOverride = null;
const tasks = [{
    id: 'task-a',
    content: 'Task A',
    parentTaskId: 'parent-a',
    docId: 'doc-a',
    docName: 'Doc A',
    customStatus: 'todo',
    priority: 'high',
    customFieldValues: { tag: ['one', 'two'], ignored: 'must-not-cross-rpc' },
}];
const focusPayload = () => ({
    contractVersion: 2,
    totals: { focusSec: 600 },
    associations: [{ candidateIds: ['task-a'], focusSec: 600, buckets: [] }],
});
const context = vm.createContext({
    AbortController,
    console,
    Error,
    Map,
    Number,
    Object,
    Promise,
    Set,
    String,
    clearTimeout,
    setTimeout,
    globalThis: null,
    __tmCallTaskHorizonKernelRpc: async (name, raw, options, snapshot) => {
        if (name === 'taskHorizonResolveFocusCandidateIDs') {
            scopeResolveCalls += 1;
            const rootTaskID = String(raw?.rootTaskID || raw?.rootTaskId || '').trim();
            const candidateIDs = Array.isArray(resolvedScopeOverride)
                ? resolvedScopeOverride
                : [rootTaskID, 'child-of-root'].filter(Boolean);
            return { available: true, data: { candidateIDs } };
        }
        projectCalls += 1;
        if (projectCalls === 1) revision += 1;
        assert.equal(name, 'taskHorizonProjectFocusStatistics');
        assert.equal(raw.contractVersion, 2);
        assert.equal(snapshot.tasks[0].parentTaskID, 'parent-a');
        return { available: true, data: { contractVersion: 2, tasks: snapshot.tasks, totals: raw.totals } };
    },
});
context.globalThis = context;
context.__tmTaskStore = {
    captureRead: () => ({ revision }),
    isReadCurrent: (token) => token.revision === revision,
    revision: () => revision,
    listFlat: () => tasks,
    listPending: () => [],
    getProjected: (id) => tasks.find((task) => task.id === id),
    getAliases: (id) => [id, `alias-${id}`],
    resolveId: (id) => id,
};
context.__dockTomato = {
    stats: {
        contractVersion: 2,
        queryFocus: async (input) => {
            dockCalls += 1;
            return focusPayload();
        },
        queryRoutine: async () => ({ contractVersion: 2, groups: [] }),
        listSessions: async () => ({ contractVersion: 2, items: [] }),
    },
};
vm.runInContext(source, context);
const defaultProjectFocus = context.__tmCallTaskHorizonKernelRpc;

(async () => {
    assert.equal(context.__tmFocusStatisticsService.isAvailable(), true);
    assert.equal(typeof context.__tmFocusStatisticsService.dispose, 'function');
    const normalSnapshot = context.__tmFocusStatisticsService.buildTaskSnapshot(null, { groupBy: 'task' }).snapshot;
    assert.equal(JSON.stringify(normalSnapshot.tasks[0].customFieldValues), '{}',
        'normal task grouping must not copy unused custom fields into the RPC snapshot');
    const customFieldSnapshot = context.__tmFocusStatisticsService.buildTaskSnapshot(null, {
        groupBy: 'customField',
        customFieldID: 'tag',
    }).snapshot;
    assert.equal(JSON.stringify(customFieldSnapshot.tasks[0].customFieldValues), JSON.stringify({ tag: ['one', 'two'] }),
        'custom-field grouping must project only the requested field');
    tasks[0].customFieldValues.oversized = 'x'.repeat(8 * 1024 * 1024 + 1);
    assert.throws(() => context.__tmFocusStatisticsService.buildTaskSnapshot(null, {
        groupBy: 'customField',
        customFieldID: 'oversized',
    }), (error) => error?.code === 'FOCUS_SCOPE_TOO_LARGE'
        && error?.details?.maxSnapshotBytes === 8 * 1024 * 1024,
    'oversized projected custom fields must fail before Kernel RPC serialization');
    delete tasks[0].customFieldValues.oversized;
    const kernelSource = fs.readFileSync(path.resolve(__dirname, '..', 'kernel.js'), 'utf8');
    assert.match(kernelSource, /FOCUS_STATS_SNAPSHOT_BYTE_LIMIT\s*=\s*8\s*\*\s*1024\s*\*\s*1024/,
        'frontend and Kernel snapshot budgets must stay aligned');
    const availableDockTomato = context.__dockTomato;
    context.__dockTomato = null;
    assert.equal(context.__tmFocusStatisticsService.isAvailable(), false);
    await assert.rejects(context.__tmFocusStatisticsService.queryFocus({}),
        (error) => error?.code === 'DOCK_TOMATO_STATS_UNAVAILABLE');
    context.__dockTomato = availableDockTomato;
    context.__dockTomato.stats.contractVersion = 1;
    assert.equal(context.__tmFocusStatisticsService.isAvailable(), false,
        'an incompatible DockTomato statistics service must be treated as unavailable');
    await assert.rejects(context.__tmFocusStatisticsService.queryFocus({}),
        (error) => error?.code === 'STATS_CONTRACT_MISMATCH');
    context.__dockTomato.stats.contractVersion = 2;

    const result = await context.__tmFocusStatisticsService.queryFocus({
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-02T00:00:00.000Z',
    });
    assert.equal(result.contractVersion, 2);
    assert.equal(dockCalls, 1, 'a stale TaskStore read must reuse the same Dock statistics');
    assert.equal(projectCalls, 2);
    assert.deepEqual(Array.from(result.tasks[0].aliasIDs), ['task-a', 'alias-task-a']);

    let releaseConcurrentDock;
    let concurrentDockCalls = 0;
    let concurrentDockInput = null;
    const concurrentDockGate = new Promise((resolve) => { releaseConcurrentDock = resolve; });
    context.__dockTomato.stats.queryFocus = async (input) => {
        concurrentDockCalls += 1;
        concurrentDockInput = input;
        await concurrentDockGate;
        return focusPayload();
    };
    const concurrentOptions = {
        from: '2026-02-01T00:00:00.000Z',
        to: '2026-02-02T00:00:10.000Z',
        bucket: 'day',
        taskIDs: ['task-a'],
    };
    const concurrentFirst = context.__tmFocusStatisticsService.queryFocus(concurrentOptions);
    const concurrentSecond = context.__tmFocusStatisticsService.queryFocus({
        ...concurrentOptions,
        to: '2026-02-02T00:00:40.000Z',
        taskIDs: ['task-a'],
    });
    await Promise.resolve();
    releaseConcurrentDock();
    await Promise.all([concurrentFirst, concurrentSecond]);
    assert.equal(concurrentDockCalls, 1, 'requests in the same minute must share one Dock query');
    assert.equal(concurrentDockInput.to, '2026-02-02T00:01:00.000Z', 'dynamic query times must use a stable minute boundary');
    assert.ok(Number(concurrentDockInput.deadlineAt) > 0, 'the frontend timeout deadline must reach the DockTomato Kernel query');

    let rootScopeDockInput = null;
    const rootScopeAliasCalls = [];
    context.__tmTaskStore.getAliases = (id) => {
        rootScopeAliasCalls.push(id);
        return [`alias-${id}`];
    };
    context.__dockTomato.stats.queryFocus = async (input) => {
        rootScopeDockInput = input;
        return focusPayload();
    };
    await context.__tmFocusStatisticsService.queryFocus({
        from: '2026-02-02T00:00:00.000Z',
        to: '2026-02-03T00:00:00.000Z',
        rootTaskID: 'root-task',
    });
    assert.equal(scopeResolveCalls, 1, 'root-task semantics must be resolved before querying DockTomato');
    assert.deepEqual(Array.from(rootScopeDockInput.candidateIDs), [
        'alias-child-of-root',
        'alias-root-task',
        'child-of-root',
        'root-task',
    ], 'task details must expand aliases for every authoritative root-subtree task');
    assert.deepEqual(rootScopeAliasCalls.filter((id) => id === 'root-task' || id === 'child-of-root').sort(),
        ['child-of-root', 'root-task'], 'kernel-resolved tasks must use the same alias expansion as explicit tasks');
    assert.equal(rootScopeDockInput.candidateIDsConstrainTotals, true,
        'a resolved task scope must constrain DockTomato totals before session aggregation');

    resolvedScopeOverride = [];
    let emptyIntersectionDockInput = null;
    context.__dockTomato.stats.queryFocus = async (input) => {
        emptyIntersectionDockInput = input;
        return focusPayload();
    };
    await context.__tmFocusStatisticsService.queryFocus({
        from: '2026-02-03T00:00:00.000Z',
        to: '2026-02-04T00:00:00.000Z',
        rootTaskID: 'root-task',
        taskIDs: ['outside-task'],
    });
    assert.deepEqual(Array.from(emptyIntersectionDockInput.candidateIDs), [],
        'an empty kernel intersection must not retain raw tasks or aliases outside the root subtree');
    assert.equal(emptyIntersectionDockInput.candidateIDsConstrainTotals, true,
        'an explicitly empty scope must fail closed to zero totals');
    resolvedScopeOverride = null;

    let expandedAliasCalls = 0;
    let expandedAliasDockCalls = 0;
    context.__tmTaskStore.getAliases = (id) => {
        expandedAliasCalls += 1;
        return expandedAliasCalls === 1
            ? Array.from({ length: 20001 }, (_, index) => `alias-${index}`)
            : [id];
    };
    context.__dockTomato.stats.queryFocus = async () => {
        expandedAliasDockCalls += 1;
        return focusPayload();
    };
    await assert.rejects(
        context.__tmFocusStatisticsService.queryFocus({ ...concurrentOptions, from: '2026-02-05T00:00:00.000Z' }),
        (error) => error?.code === 'FOCUS_SCOPE_TOO_LARGE'
            && error?.details?.maxCandidateCount === 20000,
        'oversized alias expansion must fail closed instead of triggering an unfiltered history query',
    );
    assert.equal(expandedAliasDockCalls, 0, 'an oversized alias scope must fail before DockTomato IO');
    context.__tmTaskStore.getAliases = (id) => [id, `alias-${id}`];
    await assert.rejects(
        context.__tmFocusStatisticsService.queryFocus({
            ...concurrentOptions,
            from: '2026-02-06T00:00:00.000Z',
            taskIDs: Array.from({ length: 10001 }, (_, index) => `task-${index}`),
        }),
        (error) => error?.code === 'FOCUS_SCOPE_TOO_LARGE',
        'an unbounded explicit task scope must fail before creating a large RPC payload',
    );

    let resolvedDockCalls = 0;
    let heldProjectionCalls = 0;
    let markProjectionStarted;
    let releaseProjection;
    const projectionStarted = new Promise((resolve) => { markProjectionStarted = resolve; });
    const projectionGate = new Promise((resolve) => { releaseProjection = resolve; });
    context.__dockTomato.stats.queryFocus = async () => {
        resolvedDockCalls += 1;
        return focusPayload();
    };
    context.__tmCallTaskHorizonKernelRpc = async (...args) => {
        heldProjectionCalls += 1;
        if (heldProjectionCalls === 1) {
            markProjectionStarted();
            await projectionGate;
        }
        return defaultProjectFocus(...args);
    };
    const resolvedOptions = {
        from: '2026-03-01T00:00:00.000Z',
        to: '2026-03-02T00:00:00.000Z',
        bucket: 'day',
    };
    const projectionFirst = context.__tmFocusStatisticsService.queryFocus(resolvedOptions);
    await projectionStarted;
    const projectionSecond = context.__tmFocusStatisticsService.queryFocus(resolvedOptions);
    await Promise.resolve();
    assert.equal(resolvedDockCalls, 1,
        'the resolved Dock result must remain shared while its Task Horizon projection is still active');
    releaseProjection();
    await Promise.all([projectionFirst, projectionSecond]);
    context.__tmCallTaskHorizonKernelRpc = defaultProjectFocus;
    await context.__tmFocusStatisticsService.queryFocus(resolvedOptions);
    assert.equal(resolvedDockCalls, 2,
        'the shared Dock result must be released after all service requests finish');

    let supersededCurrent = true;
    let supersededDockCalls = 0;
    const projectCallsBeforeSupersession = projectCalls;
    context.__dockTomato.stats.queryFocus = async () => {
        supersededDockCalls += 1;
        supersededCurrent = false;
        return focusPayload();
    };
    await assert.rejects(
        context.__tmFocusStatisticsService.queryFocus({}, { isCurrent: () => supersededCurrent }),
        (error) => error?.code === 'FOCUS_STATS_SUPERSEDED' && error?.details?.stage === 'before-task-projection',
        'a superseded homepage query must stop before Task Horizon projection',
    );
    assert.equal(supersededDockCalls, 1);
    assert.equal(projectCalls, projectCallsBeforeSupersession);

    let activeLatestDockCalls = 0;
    let maxActiveLatestDockCalls = 0;
    const latestDockInputs = [];
    const releaseLatestDockCalls = [];
    context.__dockTomato.stats.queryFocus = (input) => {
        activeLatestDockCalls += 1;
        maxActiveLatestDockCalls = Math.max(maxActiveLatestDockCalls, activeLatestDockCalls);
        latestDockInputs.push(input);
        return new Promise((resolve) => {
            releaseLatestDockCalls.push(() => {
                activeLatestDockCalls -= 1;
                resolve(focusPayload());
            });
        });
    };
    const latestControl = { channel: 'latest-only-contract' };
    const latestFirst = context.__tmFocusStatisticsService.queryFocus({
        from: '2026-04-01T00:00:00.000Z',
        to: '2026-04-02T00:00:00.000Z',
    }, latestControl);
    const latestFirstRejected = assert.rejects(latestFirst,
        (error) => error?.code === 'FOCUS_STATS_SUPERSEDED' && error?.details?.stage === 'before-task-projection');
    while (latestDockInputs.length < 1) await new Promise((resolve) => setImmediate(resolve));
    const latestSecond = context.__tmFocusStatisticsService.queryFocus({
        from: '2026-04-02T00:00:00.000Z',
        to: '2026-04-03T00:00:00.000Z',
    }, latestControl);
    const latestSecondRejected = assert.rejects(latestSecond,
        (error) => error?.code === 'FOCUS_STATS_SUPERSEDED' && error?.details?.stage === 'dock-query-queued');
    const latestThird = context.__tmFocusStatisticsService.queryFocus({
        from: '2026-04-03T00:00:00.000Z',
        to: '2026-04-04T00:00:00.000Z',
    }, latestControl);
    assert.equal(latestDockInputs.length, 1, 'new requests must wait behind the active Dock query');
    releaseLatestDockCalls[0]();
    await latestFirstRejected;
    await latestSecondRejected;
    while (latestDockInputs.length < 2) await new Promise((resolve) => setImmediate(resolve));
    assert.equal(latestDockInputs.length, 2, 'only the newest queued Dock query may run');
    assert.equal(latestDockInputs[1].from, '2026-04-03T00:00:00.000Z');
    releaseLatestDockCalls[1]();
    assert.equal((await latestThird).contractVersion, 2);
    assert.equal(maxActiveLatestDockCalls, 1, 'a query channel must never run two Dock requests concurrently');

    let markAbortableDockStarted;
    let abortableDockSignal = null;
    const abortableDockStarted = new Promise((resolve) => { markAbortableDockStarted = resolve; });
    context.__dockTomato.stats.queryFocus = (_input, requestControl = {}) => new Promise((resolve, reject) => {
        abortableDockSignal = requestControl.signal || null;
        markAbortableDockStarted();
        abortableDockSignal?.addEventListener?.('abort', () => {
            const error = new Error('aborted');
            error.code = 'STATS_QUERY_ABORTED';
            reject(error);
        }, { once: true });
    });
    const detailController = new AbortController();
    const canceledDetail = context.__tmFocusStatisticsService.queryFocus({
        from: '2026-04-04T00:00:00.000Z',
        to: '2026-04-05T00:00:00.000Z',
    }, {
        channel: 'task-detail:closed-task',
        signal: detailController.signal,
    });
    await abortableDockStarted;
    detailController.abort();
    await assert.rejects(canceledDetail, (error) => error?.code === 'FOCUS_STATS_SUPERSEDED',
        'closing a task detail must stop waiting for its active history query');
    assert.equal(abortableDockSignal?.aborted, true,
        'the task-detail AbortSignal must reach the underlying DockTomato query');
    context.__dockTomato.stats.queryFocus = async () => focusPayload();
    assert.equal((await context.__tmFocusStatisticsService.queryFocus({
        from: '2026-04-05T00:00:00.000Z',
        to: '2026-04-06T00:00:00.000Z',
    }, { channel: 'task-detail:closed-task' })).contractVersion, 2,
    'an aborted detail query must immediately release its scheduler channel');

    context.__tmFocusStatsTimeoutMs = 20;
    context.__dockTomato.stats.queryFocus = () => new Promise(() => {});
    await assert.rejects(
        context.__tmFocusStatisticsService.queryFocus({}, { channel: 'timeout-dock' }),
        (error) => error?.code === 'FOCUS_STATS_TIMEOUT' && error?.details?.stage === 'dock-query-focus',
        'an unresolved DockTomato query must time out',
    );
    context.__dockTomato.stats.queryFocus = async () => focusPayload();
    assert.equal((await context.__tmFocusStatisticsService.queryFocus({}, {
        channel: 'timeout-dock',
    })).contractVersion, 2, 'a timed-out active query must release its scheduler channel');

    context.__tmCallTaskHorizonKernelRpc = () => new Promise(() => {});
    await assert.rejects(
        context.__tmFocusStatisticsService.queryFocus({}, { channel: 'timeout-project' }),
        (error) => error?.code === 'FOCUS_STATS_TIMEOUT' && error?.details?.stage === 'task-project-focus',
        'an unresolved Task Horizon projection must time out',
    );

    context.__dockTomato.stats.queryRoutine = () => new Promise(() => {});
    await assert.rejects(
        context.__tmFocusStatisticsService.queryRoutine({}),
        (error) => error?.code === 'FOCUS_STATS_TIMEOUT' && error?.details?.stage === 'dock-query-routine',
    );

    context.__dockTomato.stats.listSessions = () => new Promise(() => {});
    await assert.rejects(
        context.__tmFocusStatisticsService.listSessions({}),
        (error) => error?.code === 'FOCUS_STATS_TIMEOUT' && error?.details?.stage === 'dock-list-sessions',
    );
    let disposedDockCalls = 0;
    context.__dockTomato.stats.queryFocus = () => {
        disposedDockCalls += 1;
        return new Promise(() => {});
    };
    const disposedFirst = context.__tmFocusStatisticsService.queryFocus({
        from: '2026-05-01T00:00:00.000Z',
        to: '2026-05-02T00:00:00.000Z',
    }, { channel: 'service-dispose' });
    while (disposedDockCalls < 1) await new Promise((resolve) => setImmediate(resolve));
    const disposedSecond = context.__tmFocusStatisticsService.queryFocus({
        from: '2026-05-02T00:00:00.000Z',
        to: '2026-05-03T00:00:00.000Z',
    }, { channel: 'service-dispose' });
    await new Promise((resolve) => setImmediate(resolve));
    const disposedCount = context.__tmFocusStatisticsService.dispose();
    assert.ok(disposedCount >= 2, 'service disposal must release active and queued statistics jobs');
    await assert.rejects(disposedFirst,
        (error) => error?.code === 'FOCUS_STATS_SUPERSEDED' && error?.details?.stage === 'service-dispose');
    await assert.rejects(disposedSecond,
        (error) => error?.code === 'FOCUS_STATS_SUPERSEDED' && error?.details?.stage === 'service-dispose');
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(disposedDockCalls, 1, 'a disposed queued query must never start');
    console.log('focus statistics service contract tests passed');
})().catch((error) => {
    process.nextTick(() => { throw error; });
});
