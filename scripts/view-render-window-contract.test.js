'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const runtime = read('src/task-horizon/main/21-view-render-state.js');
const manifest = JSON.parse(read('src/task-horizon/manifest.main.json'));
const stores = read('src/task-horizon/main/10-stores-rules-and-cache.js');
const services = read('src/task-horizon/main/20-api-and-runtime-services.js');
const dialogs = read('src/task-horizon/main/30-dialogs-and-ui-foundation.js');
const refresh = read('src/task-horizon/main/render/39-render-doc-group-sync-and-refresh.js');
const viewSwitch = read('src/task-horizon/main/render/47-render-side-panels-and-view-switching.js');
const listRuntime = read('src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js');

const segment = (source, start, end) => {
    const from = source.indexOf(start);
    assert.notEqual(from, -1, `missing segment start: ${start}`);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(to, -1, `missing segment end: ${end}`);
    return source.slice(from, to);
};

const context = {
    state: { viewMode: 'list', filteredTasks: Array.from({ length: 400 }, (_, index) => ({ id: `task-${index}` })) },
    __tmIsMobileDevice: () => false,
    __tmIsRuntimeMobileClient: () => false,
    __tmHostUsesMobileUI: () => false,
};
vm.createContext(context);
vm.runInContext(runtime, context, { filename: '21-view-render-state.js' });

let windowState = context.__tmResetViewRenderWindow('list', 400);
assert.equal(windowState.limit, 80, 'desktop table view must start with 80 tasks');
assert.equal(context.state.listRenderStep, 80);
windowState = context.__tmGrowViewRenderWindow('list', 400);
assert.equal(windowState.previousLimit, 80);
assert.equal(windowState.limit, 120, 'desktop table auto-load must add 40 tasks');

const progressiveJob = context.__tmStartProgressiveViewRender('list');
assert.equal(progressiveJob, null, 'table view switches must use the shared near-bottom loader instead of a frame loop');
windowState = context.__tmResetViewRenderWindow('list', 400);
assert.equal(windowState.limit, 80, 'table switches must keep the desktop initial viewport window');
windowState = context.__tmGrowViewRenderWindow('list', 400);
assert.equal(windowState.limit, 120, 'table switches must grow through the shared near-bottom policy');
context.__tmCancelProgressiveViewRender();

const timelineJob = context.__tmStartProgressiveViewRender('timeline');
assert.equal(timelineJob, null, 'timeline switches must use the shared near-bottom loader instead of a frame loop');
windowState = context.__tmResetViewRenderWindow('timeline', 400);
assert.equal(windowState.limit, 80, 'timeline switches must keep the desktop initial viewport window');
windowState = context.__tmGrowViewRenderWindow('timeline', 400);
assert.equal(windowState.limit, 120, 'timeline switches must grow through the shared near-bottom policy');
const sliced = context.__tmSliceTaskRowModelByTaskWindow([
    { type: 'group', key: 'group-a' },
    { type: 'task', id: 'task-0' },
    { type: 'task', id: 'task-1' },
    { type: 'group', key: 'group-b' },
    { type: 'task', id: 'task-2' },
    { type: 'task', id: 'task-3' },
], 1, 3);
assert.deepEqual(Array.from(sliced.rows, (row) => `${row.type}:${row.key || row.id}`), [
    'task:task-1',
    'group:group-b',
    'task:task-2',
], 'timeline slices must retain only group rows introduced inside the selected task window');
const trailingCollapsedGroupSlice = context.__tmSliceTaskRowModelByTaskWindow([
    { type: 'group', key: 'doc-a' },
    { type: 'task', id: 'task-0' },
    { type: 'task', id: 'task-1' },
    { type: 'group', key: 'doc-collapsed-tail' },
], 0, 2);
assert.deepEqual(Array.from(trailingCollapsedGroupSlice.rows, (row) => `${row.type}:${row.key || row.id}`), [
    'group:doc-a',
    'task:task-0',
    'task:task-1',
    'group:doc-collapsed-tail',
], 'the window containing the final visible task must retain trailing collapsed document groups');
const trailingCollapsedGroupNextSlice = context.__tmSliceTaskRowModelByTaskWindow([
    { type: 'group', key: 'doc-a' },
    { type: 'task', id: 'task-0' },
    { type: 'task', id: 'task-1' },
    { type: 'group', key: 'doc-collapsed-tail' },
], 2, 4);
assert.deepEqual(Array.from(trailingCollapsedGroupNextSlice.rows), [], 'later windows must not append a trailing collapsed document group twice');
const allCollapsedGroupSlice = context.__tmSliceTaskRowModelByTaskWindow([
    { type: 'group', key: 'doc-collapsed-a' },
    { type: 'group', key: 'doc-collapsed-b' },
], 0, 20);
assert.deepEqual(Array.from(allCollapsedGroupSlice.rows, (row) => `${row.type}:${row.key}`), [
    'group:doc-collapsed-a',
    'group:doc-collapsed-b',
], 'the first timeline window must retain document groups when every document is collapsed');
const deferredBoundaryGroups = [
    { type: 'group', key: 'doc-a' },
    { type: 'task', id: 'task-0' },
    { type: 'task', id: 'task-1' },
    { type: 'group', key: 'doc-b' },
    { type: 'task', id: 'task-2' },
];
assert.deepEqual(Array.from(context.__tmSliceTaskRowModelByTaskWindow(deferredBoundaryGroups, 0, 2).rows, (row) => `${row.type}:${row.key || row.id}`), [
    'group:doc-a',
    'task:task-0',
    'task:task-1',
], 'groups belonging to a task beyond the window boundary must stay deferred');
assert.deepEqual(Array.from(context.__tmSliceTaskRowModelByTaskWindow(deferredBoundaryGroups, 2, 4).rows, (row) => `${row.type}:${row.key || row.id}`), [
    'group:doc-b',
    'task:task-2',
], 'a deferred boundary group must appear with its task in the next window');
context.__tmCancelProgressiveViewRender();

const kanbanJob = context.__tmStartProgressiveViewRender('kanban');
assert.ok(kanbanJob, 'large kanban switches must create a cancellable progressive render job');
assert.equal(kanbanJob.batchSize, 10, 'kanban switches must render ten cards per expanded column first');
assert.deepEqual(Array.from(kanbanJob.columns), [], 'kanban columns must register their own fair progressive queues');
assert.equal(context.__tmRegisterKanbanProgressiveColumn(kanbanJob, {
    key: 'status:todo',
    loadNextBatch: () => ({ done: true }),
}), true);
assert.equal(kanbanJob.columns.length, 1, 'expanded kanban columns must register one independent continuation');
context.__tmCancelProgressiveViewRender();

windowState = context.__tmResetViewRenderWindow('checklist', 400);
assert.equal(windowState.limit, 120, 'desktop checklist must start with 120 tasks');
windowState = context.__tmGrowViewRenderWindow('checklist', 400);
assert.equal(windowState.limit, 180, 'desktop checklist auto-load must add 60 tasks');

context.__tmIsMobileDevice = () => true;
windowState = context.__tmResetViewRenderWindow('list', 400);
assert.equal(windowState.limit, 64, 'mobile table view must use the smaller initial window');
windowState = context.__tmGrowViewRenderWindow('list', 400);
assert.equal(windowState.limit, 96, 'mobile table auto-load must add 32 tasks');
context.state.viewMode = 'checklist';
windowState = context.__tmResetViewRenderWindow('checklist', 400);
assert.equal(windowState.limit, 20, 'mobile checklist must commit after its first 20 tasks are ready');
windowState = context.__tmGrowViewRenderWindow('checklist', 400);
assert.equal(windowState.limit, 40, 'mobile checklist load-more must add 20 tasks');
const preservedChecklistWindow = context.__tmCaptureViewRenderWindow('checklist');
context.state.listRenderLimit = 20;
assert.equal(context.__tmRestoreViewRenderWindow(preservedChecklistWindow, 400), true, 'same-context task refreshes must restore the grown checklist window');
assert.equal(context.state.listRenderLimit, 40, 'task refreshes must not collapse a 40-row mobile checklist back to 20 rows');
context.state.activeDocId = 'other-doc';
context.state.listRenderLimit = 20;
assert.equal(context.__tmRestoreViewRenderWindow(preservedChecklistWindow, 400), false, 'a changed document context must reject a stale render window');
assert.equal(context.state.listRenderLimit, 20, 'context changes must retain their fresh initial render window');
context.state.activeDocId = 'all';

const serviceIndex = manifest.scripts.indexOf('main/20-api-and-runtime-services.js');
const renderStateIndex = manifest.scripts.indexOf('main/21-view-render-state.js');
const dialogsIndex = manifest.scripts.indexOf('main/30-dialogs-and-ui-foundation.js');
assert.ok(serviceIndex >= 0 && serviceIndex < renderStateIndex && renderStateIndex < dialogsIndex, 'render state must load after state creation and before UI consumers');

const snapshotViewState = segment(stores, 'function __tmBuildTaskSnapshotViewState', 'function __tmGetTaskSnapshotViewStateCandidates');
assert.doesNotMatch(snapshotViewState, /listRender(?:Limit|Step)/, 'task snapshots must not persist transient render windows');
const snapshotRestore = segment(stores, 'function __tmRestoreTaskSnapshotViewState', 'function __tmBuildTaskSnapshotPayload');
assert.match(snapshotRestore, /__tmResetViewRenderWindow\(state\.viewMode, filtered\.length\)/, 'snapshot restore must start from a fresh render window');

const hostCapture = segment(services, 'function __tmCaptureHostSessionState', 'function __tmRestoreHostSessionState');
const hostRestore = segment(services, 'function __tmRestoreHostSessionState', 'function __tmIsMultiSelectSupportedView');
assert.doesNotMatch(hostCapture, /listRender(?:Limit|Step)/, 'host sessions must not capture transient render windows');
assert.doesNotMatch(hostRestore, /snap\.listRender(?:Limit|Step)/, 'host sessions must not restore stale render windows');

const refreshCapture = segment(refresh, 'function __tmCaptureRefreshUiState', 'function __tmRestoreRefreshUiState');
const refreshRestore = segment(refresh, 'function __tmRestoreRefreshUiState', 'const __TM_MANUAL_REFRESH_WRITE_PROTECT_FIELDS');
assert.doesNotMatch(refreshCapture, /listRender(?:Limit|Step)/, 'manual refresh snapshots must not capture render windows');
assert.doesNotMatch(refreshRestore, /saved\.listRender(?:Limit|Step)/, 'manual refresh must not restore render windows');

assert.match(viewSwitch, /state\.viewMode = next;[\s\S]*__tmScheduleViewSwitchCommit\(generation, next,[\s\S]*progressiveJob = __tmStartProgressiveViewRender\(next\);[\s\S]*__tmResetViewRenderWindow\(next\)/, 'deferred view entry must reset its initial render window after the interface paint');
assert.match(runtime, /value !== 'kanban' \|\| tasks\.length <= __TM_KANBAN_PROGRESSIVE_BATCH_SIZE/, 'only kanban snapshots larger than the first ten cards need a progressive job');
assert.match(runtime, /Table, checklist, and timeline already share the near-bottom append-only loader/, 'list-like views must not retain a frame-driven fill loop');
assert.doesNotMatch(runtime, /job\.frameId = requestAnimationFrame\(run\)/, 'progressive view rendering must not continuously refill table or timeline rows');
assert.match(viewSwitch, /__tmScheduleProgressiveViewRender\(next, progressiveJob\)/, 'view switches must retain the shared kanban continuation hook');
assert.match(dialogs, /const grown = __tmGrowViewRenderWindow\(mode, meta\.total\);[\s\S]*?appendOnly: true,[\s\S]*?previousLimit: grown\.previousLimit/, 'scroll auto-load must grow the window and request an incremental table patch');
assert.match(services, /renderTaskList\(null, opts\.appendOnly === true[\s\S]*?startTaskRow: currentTaskRowCount/, 'incremental table rendering must generate only rows after the current DOM task count');
assert.match(services, /function __tmReconcileListRowsForAppend[\s\S]*?stagingTable\.innerHTML[\s\S]*?currentKeys[\s\S]*?tbody\.appendChild/, 'incremental table patches must parse and append only the new batch');
assert.doesNotMatch(services, /commonDesiredOrder|currentOrder\.some/, 'incremental table patches must not reconcile a regenerated full prefix');
assert.match(listRuntime, /const taskRowIndex = visitedTaskRows;[\s\S]*?if \(taskRowIndex < startTaskRow\) return '';/, 'skipped task rows must not build complex table-cell HTML');
assert.doesNotMatch(stores, /const progressiveListRender = state\?\.__tmProgressiveViewRender\?\.mode === mode/, 'list render signatures must not depend on the removed table/timeline frame job');
assert.match(listRuntime, /__tmGrowViewRenderWindow\('list', state\.filteredTasks\.length\)[\s\S]*?appendOnly: true/, 'manual load-more must reuse the incremental path');
assert.match(dialogs, /window\.tmChecklistLoadMoreRows[\s\S]*?__tmAutoLoadMoreVisibleRows\(\{[\s\S]*?mode: 'checklist'/, 'checklist manual load-more must use the checklist render window');
assert.match(dialogs, /mode === 'checklist'[\s\S]*?__tmRenderChecklistPreserveScroll\(\{[\s\S]*?appendOnly: true,[\s\S]*?previousLimit: grown\.previousLimit/, 'checklist auto-load must request an append-only in-place render');
const checklistAppend = segment(services, 'function __tmTryAppendChecklistRenderWindow', 'function __tmInsertChecklistCardByNextOrder');
assert.match(checklistAppend, /__tmIsStringSequencePrefix\(currentTaskIds, nextTaskIds\)/, 'checklist append must validate the visible task order before mutating DOM');
assert.match(services, /function __tmGetChecklistAppendNodeKey[\s\S]*?tm-checklist-group-card[\s\S]*?tm-checklist-item[\s\S]*?__tmIsChecklistGroupHeader/, 'checklist append keys must cover compact cards, ordinary groups, and ungrouped tasks');
assert.match(services, /function __tmGetChecklistCardItemsContainer[\s\S]*?tm-checklist-group-card-items/, 'compact checklist cards must expose their nested append container');
assert.match(checklistAppend, /cardPlans[\s\S]*?nextCardNodes\.slice[\s\S]*?topLevelNodes/, 'checklist append must merge a compact card tail before appending new top-level groups or tasks');
assert.match(checklistAppend, /currentItems\.insertBefore\(clone, currentLoadMore\)/, 'checklist append must insert new nodes without replacing visible checklist nodes');
assert.doesNotMatch(checklistAppend, /body\.replaceWith|replaceChildren|innerHTML\s*=/, 'successful checklist append must not replace the checklist body or existing rows');
assert.match(services, /opts\.appendOnly === true && __tmTryAppendChecklistRenderWindow[\s\S]*?state\.listDomRenderSignature = renderSignature/, 'successful checklist append must commit the new DOM signature');
assert.match(dialogs, /window\.__tmBindAutoLoadMoreOnScroll = __tmBindAutoLoadMoreOnScroll;/, 'checklist body swaps must be able to rebind the shared auto-load listener');
assert.match(dialogs, /mode !== 'list' && mode !== 'checklist' && mode !== 'timeline'[\s\S]*?window\.tmTimelineLoadMoreRows\?\.\(\)/, 'timeline must use the shared automatic render-window continuation');
assert.match(dialogs, /function __tmScheduleAutoLoadMoreRecheck[\s\S]*?__tmAutoLoadMoreScrollHandler/, 'successful batches must recheck the live scroll host without another user gesture');
assert.match(dialogs, /const progressiveJob = state\.__tmProgressiveViewRender;[\s\S]*?progressiveJob\.tasksRef === state\.filteredTasks\) return;/, 'scroll continuation must not compete with an active view-switch progressive job');
assert.doesNotMatch(dialogs, /if \(maxScrollTop <= 0\) return;/, 'short initial batches must continue loading until the viewport can scroll');
assert.match(services, /function __tmBindTimelineStageInteractions[\s\S]*?__tmBindAutoLoadMoreOnScroll\?\.\(modal, 'timeline'\)/, 'full and in-place timeline mounts must bind near-bottom auto loading');

console.log('view render window contract tests passed');
