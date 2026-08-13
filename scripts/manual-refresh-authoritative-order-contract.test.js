const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(
    __dirname,
    '../src/task-horizon/main/render/39-render-doc-group-sync-and-refresh.js',
), 'utf8');
const documentLoaderSource = fs.readFileSync(path.join(
    __dirname,
    '../src/task-horizon/main/task-runtime/53c-document-loader-runtime.js',
), 'utf8');
const runtimeServicesSource = fs.readFileSync(path.join(
    __dirname,
    '../src/task-horizon/main/20-api-and-runtime-services.js',
), 'utf8');

function extractFunction(name) {
    return extractFunctionFromSource(source, name);
}

function extractFunctionFromSource(input, name) {
    const start = input.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `${name} must exist`);
    const bodyStart = input.indexOf('{', input.indexOf(')', start));
    let depth = 0;
    for (let index = bodyStart; index < input.length; index += 1) {
        if (input[index] === '{') depth += 1;
        if (input[index] !== '}') continue;
        depth -= 1;
        if (depth === 0) return input.slice(start, index + 1);
    }
    throw new Error(`Unable to extract ${name}`);
}

const buildProjection = extractFunction('__tmBuildManualRefreshMutationProjection');
const applyProjection = extractFunction('__tmApplyManualRefreshMutationProjection');
const refreshCore = extractFunction('__tmRefreshCore');
const loadSelectedDocuments = extractFunctionFromSource(documentLoaderSource, 'loadSelectedDocuments');
const silentQuickbarRefresh = extractFunctionFromSource(runtimeServicesSource, '__tmSilentRefreshAfterQuickbarUpdate');

assert.match(source, /__TM_MANUAL_REFRESH_WRITE_PROTECT_FIELDS = new Set\(\[\s*\.\.\.\(globalThis\.__tmTaskFieldSchema\?\.getGroup\?\.\('completion'\)/,
    'manual refresh must protect the schema completion fields while the local write watermark is active');
assert.match(buildProjection, /return \{ patchMap \}/);
assert.doesNotMatch(buildProjection, /__tmBuildQueuedTaskMoveMap|__tmBuildQueuedTaskDeleteSet/,
    'manual refresh must not rebuild pending structural projections');
assert.doesNotMatch(applyProjection, /__tmApplyQueuedTaskMovePatchToTask|__tmRemoveTaskFromLocalState/,
    'manual refresh must keep the authoritative SiYuan hierarchy and order');
assert.doesNotMatch(refreshCore, /__tmScheduleOpQueueDrain|__tmDrainOpQueue|__tmEnqueueQueuedOp/,
    'manual refresh must not start or enqueue writes');
assert.doesNotMatch(refreshCore, /__tmFlushSqlTransactionsSafe/,
    'manual refresh must not duplicate the document loader transaction flush');
assert.doesNotMatch(loadSelectedDocuments, /__tmHydrateOpQueue|__tmScheduleOpQueueDrain|__tmDrainOpQueue|__tmEnqueueQueuedOp/,
    'document loading must stay independent from the mutation lifecycle');
assert.match(refreshCore, /authoritativeDocumentOrder = reason === 'manual' \|\| reason\.startsWith\('manual-'\)[\s\S]*preserveExistingSiblingOrder = !authoritativeDocumentOrder[\s\S]*forceFreshTasks:\s*true[\s\S]*forceRefreshScope:\s*authoritativeDocumentOrder[\s\S]*skipPersistedScope:\s*authoritativeDocumentOrder[\s\S]*skipResolvedDocIdsCache:\s*authoritativeDocumentOrder[\s\S]*forceSyncFlowRank:\s*authoritativeDocumentOrder \|\| !preserveExistingSiblingOrder/,
    'manual refresh must ignore existing sibling order and rebuild from uncached authoritative document flow');
assert.match(refreshCore, /deferIfDetailBusy = commitView && !authoritativeDocumentOrder[\s\S]*if \(deferIfDetailBusy\)[\s\S]*__tmGetBusyTaskDetailBarrier/,
    'manual refresh and data-only synchronization must not be blocked by an active task detail');
assert.match(refreshCore, /__tmRefreshMainViewInPlace\(\{[\s\S]*withFilters:\s*false,[\s\S]*deferIfDetailBusy,[\s\S]*reason:/,
    'manual refresh must carry the detail-busy bypass into the final main-view redraw');
assert.match(loadSelectedDocuments, /forceRefreshScope: !!state\.isRefreshing \|\| !!\(options && options\.forceRefreshScope === true\)[\s\S]*skipPersistedScope: isSwitchDocGroupLoad \|\| !!\(options && options\.skipPersistedScope === true\)[\s\S]*skipResolvedDocIdsCache: !!\(options && options\.skipResolvedDocIdsCache === true\)/,
    'the document loader must honor manual refresh scope cache bypass options');
assert.match(loadSelectedDocuments, /fetchTaskEnhanceBundle\(taskIds0,[\s\S]*forceFresh:\s*forceFreshTasks/,
    'a force-fresh task load must bypass the cached document order bundle');
assert.match(loadSelectedDocuments, /const needFlowRank = forceSyncFlowRank[\s\S]*const syncFlowBeforeFirstRender = forceSyncFlowRank/,
    'manual refresh must load document flow ranks even when the active view has an explicit sort rule');
assert.match(loadSelectedDocuments, /shouldSkipSiblingRank\s*=\s*fastSwitchFirstPaint\s*\|\|\s*skipSiblingRankFirstPaint\s*\|\|\s*forceSyncFlowRank\s*\|\|\s*preserveExistingSiblingOrder/,
    'an authoritative flow refresh must not issue redundant per-parent sibling reads');
assert.match(refreshCore, /loadSelectedDocuments\(\{[\s\S]*?deferProjection:\s*true/,
    'manual refresh must defer projection until restored state and whiteboard cleanup settle');
assert.equal((refreshCore.match(/__tmRecomputeTaskProjection\(\{ reason: 'doc-group-refresh' \}\)/g) || []).length, 1,
    'manual refresh must rebuild the task projection exactly once');
assert.ok(refreshCore.indexOf('__tmSyncWhiteboardFrozenTasksWithLiveTasks()')
        < refreshCore.indexOf("__tmRecomputeTaskProjection({ reason: 'doc-group-refresh' })"),
    'manual refresh must project after whiteboard cleanup');
const loaderProjectionCalls = loadSelectedDocuments.match(/__tmRecomputeTaskProjection\(\{ reason: 'document-loader' \}\)/g) || [];
const guardedLoaderProjectionCalls = loadSelectedDocuments.match(/if \(!deferProjection\) __tmRecomputeTaskProjection\(\{ reason: 'document-loader' \}\)/g) || [];
assert.equal(guardedLoaderProjectionCalls.length, loaderProjectionCalls.length,
    'every loader-owned projection must honor the deferProjection option');
assert.match(silentQuickbarRefresh, /loadSelectedDocuments\(\{[\s\S]*?deferProjection:\s*true/,
    'quickbar background refresh must defer the loader projection');
assert.equal((silentQuickbarRefresh.match(/__tmRecomputeTaskProjection\(/g) || []).length, 1,
    'quickbar background refresh must rebuild the task projection exactly once');

const protectionStart = source.indexOf('const __TM_MANUAL_REFRESH_WRITE_PROTECT_FIELDS');
const protectionEnd = source.indexOf('function __tmClearAutoRefreshDirtyFlags', protectionStart);
assert.ok(protectionStart >= 0 && protectionEnd > protectionStart, 'manual refresh protection runtime must exist');
const liveTask = {
    id: 'task-child',
    done: true,
    customStatus: 'finish',
    taskCompleteAt: '2026-08-09T10:00:00+08:00',
    parentTaskId: 'task-parent',
};
const staleTask = {
    ...liveTask,
    done: false,
    customStatus: 'todo',
    taskCompleteAt: '',
};
const state = {
    flatTasks: { 'task-child': liveTask },
    pendingInsertedTasks: {},
    taskTree: [{ id: 'doc-a', tasks: [{ id: 'task-parent', children: [staleTask] }] }],
};
const context = vm.createContext({
    Map,
    Set,
    Object,
    Array,
    String,
    state,
    globalThis: null,
    __tmTaskFieldSchema: {
        getGroup: (name) => name === 'completion' ? ['done', 'customStatus', 'taskCompleteAt'] : [],
    },
    __tmTaskBoundary: { getTask: (taskId) => state.flatTasks[taskId] || null },
    __tmNormalizeLocalPatchFieldKey: (key) => String(key || '').trim(),
    __tmApplyQueuedTaskFieldPatchToTask(task, patch) { Object.assign(task, patch); },
    __tmInvalidateFilteredTaskDerivedStateCache() {},
    recalcStats() {},
});
context.globalThis = context;
vm.runInContext(source.slice(protectionStart, protectionEnd), context, { filename: 'manual-refresh-protection.js' });
const completionProjection = context.__tmBuildManualRefreshMutationProjection(new Map([
    ['task-child', {
        done: true,
        customStatus: 'finish',
        taskCompleteAt: '2026-08-09T10:00:00+08:00',
    }],
]));
state.flatTasks['task-child'] = staleTask;
assert.equal(context.__tmApplyManualRefreshMutationProjection(completionProjection), true);
assert.equal(staleTask.done, true, 'a stale manual refresh must not reveal a locally completed task');
assert.equal(staleTask.customStatus, 'finish', 'completion status must remain atomic with the done field');
assert.equal(staleTask.taskCompleteAt, '2026-08-09T10:00:00+08:00', 'completion timestamp must remain atomic with the done field');
assert.equal(staleTask.parentTaskId, 'task-parent', 'field protection must not alter authoritative task placement');

console.log('manual refresh authoritative order contract tests passed');
