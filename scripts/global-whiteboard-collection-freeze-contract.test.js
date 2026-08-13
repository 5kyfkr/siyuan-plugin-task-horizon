'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const storeSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const runtimeSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js'), 'utf8');
const loaderSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53c-document-loader-runtime.js'), 'utf8');
const renderSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/44-render-whiteboard-body.js'), 'utf8');
const interactionSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/49-render-whiteboard-interactions.js'), 'utf8');
const refreshSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/39-render-doc-group-sync-and-refresh.js'), 'utf8');

assert.match(storeSource, /linkedTaskSnapshots:\s*__tmNormalizeWhiteboardLinkedTaskSnapshotMap/, 'per-group boards must normalize linked endpoint snapshots');
assert.match(storeSource, /__tmIsPlainObjectWithKeys\(board\.linkedTaskSnapshots\)/, 'endpoint snapshots must keep an otherwise empty group board alive');
assert.match(runtimeSource, /if \(phase !== 'commit'\) return;[\s\S]*?__tmReconcileGlobalWhiteboardsAfterCommittedMove/, 'only committed moves may trigger structural board reconciliation');
assert.match(runtimeSource, /nextBoard\.linkedTaskSnapshots = linkedTaskSnapshots/, 'task id remapping must include endpoint snapshots');
assert.match(runtimeSource, /snapshot\.parentTaskId[\s\S]*?parentTaskId: to/, 'task id remapping must update parent references inside endpoint snapshots');
assert.match(runtimeSource, /groupScopeAuthoritative[\s\S]*?authoritativeScope\?\.complete === true/, 'cleanup authority must require a complete fresh group scope');
assert.match(runtimeSource, /__tmGlobalWhiteboardMoveRevisions[\s\S]*?moveRevision/, 'committed move reconciliation must reject stale async completions');
assert.match(runtimeSource, /__tmGlobalWhiteboardOptimisticMoves[\s\S]*?__tmGlobalOptimisticRetained/, 'optimistic moves must retain their pre-move live card until commit');
assert.match(loaderSource, /__tmGlobalWhiteboardAuthoritativeScope[\s\S]*?complete: resolvedScopeFresh && limitReachedDocIds\.length === 0/, 'stale scopes or task loads that hit a query limit must not authorize board cleanup');
assert.match(renderSource, /globalCanvasSourceDocIds[\s\S]*?globalCollectionDocId/, 'the global collection document must be overlaid only into the global whiteboard source');
assert.match(renderSource, /data-tm-whiteboard-frozen="1" aria-readonly="true"/, 'frozen cards must expose a read-only DOM state');
assert.match(interactionSource, /tmWhiteboardDeleteCard[\s\S]*?data-tm-whiteboard-frozen/, 'direct deletion must reject frozen cards');
assert.match(refreshSource, /await __tmReconcileCurrentGlobalWhiteboardAuthoritative\(\{ forceFresh: true \}\)/, 'manual refresh must run authoritative global-board reconciliation');

const snapshotStart = storeSource.indexOf('function __tmNormalizeWhiteboardLinkedTaskSnapshotMap');
const snapshotEnd = storeSource.indexOf('\n    function __tmNormalizeWhiteboardGlobalBoardState', snapshotStart);
assert.ok(snapshotStart >= 0 && snapshotEnd > snapshotStart, 'linked snapshot normalizer must be extractable');

const snapshotContext = {};
vm.runInNewContext(`
    ${storeSource.slice(snapshotStart, snapshotEnd)}
    globalThis.normalizeSnapshots = __tmNormalizeWhiteboardLinkedTaskSnapshotMap;
`, snapshotContext, { filename: 'global-whiteboard-snapshot-normalizer.js' });

const normalized = snapshotContext.normalizeSnapshots({
    taskA: {
        id: 'ignored',
        root_id: 'doc-a',
        raw_content: 'Frozen title',
        parent_task_id: 'parent-a',
        custom_time: '25m',
        done: true,
    },
    invalid: { docId: '', content: '' },
});
assert.deepEqual(JSON.parse(JSON.stringify(normalized)), {
    taskA: {
        id: 'taskA',
        docId: 'doc-a',
        root_id: 'doc-a',
        content: 'Frozen title',
        markdown: '',
        raw_content: 'Frozen title',
        parentTaskId: 'parent-a',
        h2: '',
        h2Id: '',
        h2Path: '',
        h2Sort: 0,
        h2Created: '',
        h2Rank: 0,
        headingLevel: '',
        startDate: '',
        completionTime: '',
        done: true,
        priority: '',
        customStatus: '',
        remark: '',
        duration: '',
        customTime: '25m',
        tomatoEstimateCount: 0,
        tomatoCount: 0,
        focusDuration: 0,
        updatedAt: normalized.taskA.updatedAt,
    },
}, 'snapshot normalization must preserve the compact frozen-card fields and reject invalid entries');
assert.equal(snapshotContext.normalizeSnapshots({
    rooted: { docId: 'doc-a', content: 'Root task', parentTaskId: '', parent_task_id: 'stale-parent' },
}).rooted.parentTaskId, '', 'an explicit empty parent id must clear stale snapshot ancestry');

const projectionStart = runtimeSource.indexOf('function __tmProjectGlobalWhiteboard');
const projectionEnd = runtimeSource.indexOf('\n    async function __tmResolveGlobalWhiteboardGroupDocIdSet', projectionStart);
const moveStart = runtimeSource.indexOf('function __tmCollectGlobalWhiteboardMovedTaskSnapshots');
const moveEnd = runtimeSource.indexOf('\n    async function __tmReconcileCurrentGlobalWhiteboardAuthoritative', moveStart);
assert.ok(projectionStart >= 0 && projectionEnd > projectionStart, 'global board projection must be extractable');
assert.ok(moveStart >= 0 && moveEnd > moveStart, 'committed move reconciler must be extractable');

const boards = {
    g1: {
        nodePos: { task: { docId: 'doc-old', x: 10, y: 20 } },
        placedTaskIds: { task: true },
        detachedChildren: {},
        frames: [],
        links: [{ from: 'task', to: 'peer' }],
        linkedTaskSnapshots: {
            task: { id: 'task', docId: 'doc-old', root_id: 'doc-old', content: 'Before move' },
            peer: { id: 'peer', docId: 'doc-old', root_id: 'doc-old', content: 'Peer' },
        },
    },
    g2: {
        nodePos: { task: { docId: 'doc-old', x: 30, y: 40 } },
        placedTaskIds: { task: true },
        detachedChildren: {},
        frames: [],
        links: [{ from: 'task', to: 'other' }],
        linkedTaskSnapshots: {},
    },
    g3: {
        nodePos: { task: { docId: 'doc-old', x: 50, y: 60 } },
        placedTaskIds: { task: true },
        detachedChildren: {},
        frames: [{ id: 'frame', memberTaskIds: ['task'] }],
        links: [],
        linkedTaskSnapshots: {},
    },
    g4: {
        nodePos: { parent: { docId: 'doc-old', x: 70, y: 80 } },
        placedTaskIds: { parent: true },
        detachedChildren: {},
        frames: [],
        links: [{ from: 'child', to: 'peer-4' }],
        linkedTaskSnapshots: {},
    },
};
let boardWriteCount = 0;
const confirmedFrozen = new Map();
const clone = (value) => JSON.parse(JSON.stringify(value));
const liveTask = { id: 'task', docId: 'doc-new', root_id: 'doc-new', content: 'After move' };
const context = {
    console,
    SettingsStore: { data: {}, save: () => Promise.resolve(true) },
    __tmGetWhiteboardGlobalBoardGroupId: (groupId) => String(groupId || 'g1'),
    __tmGetWhiteboardGlobalBoardState: (groupId) => clone(boards[groupId]),
    __tmGetGlobalWhiteboardTaskSource: () => ({ tasks: [], taskMap: new Map(), authoritative: true }),
    __tmNormalizeWhiteboardGlobalBoardState: (board) => ({
        nodePos: {},
        placedTaskIds: {},
        detachedChildren: {},
        frames: [],
        links: [],
        linkedTaskSnapshots: {},
        ...clone(board || {}),
    }),
    __tmNormalizeWhiteboardFrameArray: (frames) => clone(Array.isArray(frames) ? frames : []),
    __tmBuildGlobalWhiteboardLinkedTaskSnapshot: (task, previous, docIdOverride) => ({
        ...(previous || {}),
        ...(task || {}),
        id: String(task?.id || previous?.id || ''),
        docId: String(docIdOverride || task?.docId || task?.root_id || previous?.docId || ''),
        root_id: String(docIdOverride || task?.docId || task?.root_id || previous?.docId || ''),
        content: String(task?.content || previous?.content || ''),
    }),
    __tmSetWhiteboardGlobalBoardState: (groupId, board) => {
        boards[groupId] = clone(board);
        boardWriteCount += 1;
    },
    __tmInvalidateGlobalWhiteboardCollectionTasks: () => false,
    __tmGetWhiteboardGlobalBoardsByGroupMap: () => clone(boards),
    __tmGetGlobalWhiteboardCollectionDocId: () => 'doc-collection',
    __tmResolveGlobalWhiteboardGroupDocIdSet: async (groupId) => new Set({
        g1: ['doc-old'],
        g2: ['doc-new'],
        g3: ['doc-old'],
        g4: ['doc-old'],
    }[groupId] || []),
    __tmScheduleGlobalWhiteboardRender: () => true,
    __tmEnsureGlobalWhiteboardCollectionTasks: async () => [],
    __tmGlobalWhiteboardMoveRevisions: new Map(),
    __tmGlobalWhiteboardMoveRevisionSeq: 0,
    __tmIsGlobalWhiteboardConfirmedFrozen: (groupId, taskId) => confirmedFrozen.get(String(groupId))?.has(String(taskId)) === true,
    __tmSetGlobalWhiteboardConfirmedFrozen: (groupId, taskId, frozen) => {
        const gid = String(groupId);
        const id = String(taskId);
        const ids = confirmedFrozen.get(gid) || new Set();
        if (frozen) ids.add(id);
        else ids.delete(id);
        if (ids.size) confirmedFrozen.set(gid, ids);
        else confirmedFrozen.delete(gid);
        return true;
    },
};
context.globalThis = context;
context.__tmTaskBoundary = { getTask: (taskId) => taskId === 'task' ? liveTask : null };

vm.runInNewContext(`
    ${runtimeSource.slice(projectionStart, projectionEnd)}
    ${runtimeSource.slice(moveStart, moveEnd)}
    globalThis.projectBoard = __tmProjectGlobalWhiteboard;
    globalThis.reconcileBoard = __tmReconcileGlobalWhiteboard;
    globalThis.reconcileMove = __tmReconcileGlobalWhiteboardsAfterCommittedMove;
`, context, { filename: 'global-whiteboard-projection-runtime.js' });

const liveA = { id: 'a', docId: 'doc-a', root_id: 'doc-a', content: 'Live A' };
boards.projection = {
    nodePos: { a: { docId: 'doc-a', x: 1, y: 2 }, c: { docId: 'doc-a', x: 3, y: 4 } },
    placedTaskIds: { a: true, c: true },
    detachedChildren: {},
    frames: [],
    links: [{ from: 'a', to: 'b' }],
    linkedTaskSnapshots: { b: { id: 'b', docId: 'doc-b', root_id: 'doc-b', content: 'Frozen B' } },
};
const source = { tasks: [liveA], taskMap: new Map([['a', liveA]]), authoritative: true };
const writesBeforeProjection = boardWriteCount;
const projection = context.projectBoard('projection', source);
assert.equal(boardWriteCount, writesBeforeProjection, 'pure projection must not write persisted board state');
assert.equal(projection.taskMap.get('a'), liveA, 'live tasks must remain live projection nodes');
assert.equal(projection.taskMap.get('b').__tmGlobalFrozen, true, 'missing linked endpoints must project from the per-group frozen snapshot');
assert.deepEqual(Array.from(projection.cleanupCandidates.absentUnlinkedPlacedTaskIds), ['c'], 'missing unlinked placed cards must only become cleanup candidates');
const partialProjection = context.projectBoard('projection', { tasks: [liveA], taskMap: new Map([['a', liveA]]), authoritative: false });
assert.equal(partialProjection.taskMap.get('b').__tmGlobalRetained, true, 'partial task loads must retain a historical endpoint without declaring it frozen');
assert.equal(partialProjection.taskMap.get('b').__tmGlobalFrozen, undefined, 'partial task loads must never project a frozen state');

context.reconcileBoard('projection', { source: { ...source, authoritative: false }, authoritative: true });
assert.equal(boards.projection.placedTaskIds.c, true, 'non-authoritative reconciliation must not remove layout data');
context.reconcileBoard('projection', { source, authoritative: true });
assert.equal(boards.projection.placedTaskIds.c, undefined, 'authoritative reconciliation may remove a missing unlinked card');

const thawSource = { tasks: [liveA, { id: 'b', docId: 'doc-a', root_id: 'doc-a', content: 'Live B' }], authoritative: true };
thawSource.taskMap = new Map(thawSource.tasks.map((task) => [task.id, task]));
const thawed = context.projectBoard('projection', thawSource);
assert.equal(thawed.frozenTaskIds.has('b'), false, 'a returning task must naturally thaw without a persisted frozen flag');
assert.equal(thawed.taskMap.get('b').content, 'Live B', 'the live task must replace its historical snapshot after returning');

(async () => {
    const rollbackBoards = clone(boards);
    const writesBeforeRollback = boardWriteCount;
    const rollbackResult = await context.reconcileMove({ type: 'moveTask', phase: 'rollback', taskId: 'task' });
    assert.equal(rollbackResult, false, 'rollback events must not reconcile global boards');
    assert.equal(boardWriteCount, writesBeforeRollback, 'rollback events must not write board state');
    assert.deepEqual(boards, rollbackBoards, 'rollback events must leave every group board unchanged');

    await context.reconcileMove({
        type: 'moveTask',
        phase: 'commit',
        taskId: 'task',
        previousDocId: 'doc-old',
        nextDocId: 'doc-new',
        snapshot: {
            docId: 'doc-old',
            task: { id: 'task', docId: 'doc-old', root_id: 'doc-old', content: 'Before move' },
        },
    });
    assert.equal(boards.g1.linkedTaskSnapshots.task.content, 'Before move', 'a linked endpoint leaving a group must freeze the committed pre-move snapshot');
    assert.equal(boards.g1.nodePos.task.x, 10, 'freezing must preserve the card position');
    assert.equal(boards.g1.links[0].fromDocId, 'doc-old', 'a frozen link endpoint must retain its leave-time document id');
    assert.equal(confirmedFrozen.get('g1')?.has('task'), true, 'a committed leave must immediately confirm the frozen projection even during partial loads');
    assert.equal(boards.g2.linkedTaskSnapshots.task.content, 'After move', 'a linked endpoint entering a group must refresh to the live task');
    assert.equal(boards.g2.nodePos.task.x, 30, 'thawing must preserve the existing per-group card position');
    assert.equal(boards.g2.links[0].fromDocId, 'doc-new', 'a thawed link endpoint must use its live document id');
    assert.equal(confirmedFrozen.get('g2')?.has('task') === true, false, 'a committed entry must clear any transient frozen confirmation');
    assert.equal(boards.g3.placedTaskIds.task, undefined, 'an unlinked placed card leaving a group must be removed');
    assert.deepEqual(boards.g3.frames[0].memberTaskIds, [], 'unlinked cleanup must remove stale frame membership');

    await context.reconcileMove({
        type: 'moveTask',
        phase: 'commit',
        taskId: 'parent',
        previousDocId: 'doc-old',
        nextDocId: 'doc-outside',
        snapshot: {
            docId: 'doc-old',
            task: {
                id: 'parent',
                docId: 'doc-old',
                root_id: 'doc-old',
                content: 'Parent',
                children: [{
                    id: 'child',
                    docId: 'doc-old',
                    root_id: 'doc-old',
                    parentTaskId: 'parent',
                    content: 'Linked child',
                    children: [],
                }],
            },
        },
    });
    assert.equal(boards.g4.placedTaskIds.parent, undefined, 'an unlinked parent card must leave the board');
    assert.equal(boards.g4.placedTaskIds.child, true, 'a linked nested endpoint must be promoted to a standalone frozen card');
    assert.equal(boards.g4.nodePos.child.x, 70, 'a promoted nested endpoint must reuse its parent card position');
    assert.equal(boards.g4.linkedTaskSnapshots.child.content, 'Linked child', 'a promoted nested endpoint must retain its own leave-time snapshot');

    console.log('global whiteboard collection freeze contract tests passed');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
