'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const api = read('src/task-horizon/main/20-api-and-runtime-services.js');
const list = read('src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js');
const projection = read('src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js');
const calendar = read('src/task-horizon/main/render/48-render-calendar-support-runtime.js');

function extractFunction(source, name) {
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `${name} must exist`);
    const signatureEnd = source.indexOf(')', start);
    const bodyStart = source.indexOf('{', signatureEnd);
    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        if (source[index] !== '}') continue;
        depth -= 1;
        if (depth === 0) return source.slice(start, index + 1);
    }
    throw new Error(`unable to extract ${name}`);
}

function extractAssignedFunction(source, name) {
    const start = source.indexOf(`${name} = function(`);
    assert.notEqual(start, -1, `${name} must exist`);
    const signatureEnd = source.indexOf(')', start);
    const bodyStart = source.indexOf('{', signatureEnd);
    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        if (source[index] !== '}') continue;
        depth -= 1;
        if (depth === 0) return source.slice(start, index + 1);
    }
    throw new Error(`unable to extract ${name}`);
}

const registerIntent = extractFunction(api, '__tmRegisterSetDoneIntent');
const isLatestIntent = extractFunction(api, '__tmIsLatestSetDoneIntent');
const matchesLatestIntent = extractFunction(api, '__tmDoesSetDoneOpMatchLatestIntent');
const coalesceQueued = extractFunction(api, '__tmTryCoalesceQueuedSetDone');
const laneResolver = extractFunction(api, '__tmResolveQueuedMutationLaneKeys');
const runner = extractFunction(api, '__tmRunSimpleMutation');
const getVerificationPatch = extractFunction(api, '__tmGetQueuedTaskPatchForVerification');
const applyOptimistic = extractFunction(api, '__tmApplyQueuedOpOptimistic');
const rollbackQueued = extractFunction(api, '__tmRollbackQueuedOp');
const executeQueued = extractFunction(api, '__tmExecuteQueuedOp');
const commandPlan = extractFunction(projection, '__tmBuildTaskCommandPlan');
const queueFieldPatch = extractFunction(projection, '__tmQueueTaskFieldPatch');
const queueSetDone = extractFunction(list, '__tmQueueSetDoneTask');

assert.match(api, /const __tmQueuedSetDoneOpsByTask = new Map\(\);/);
assert.match(api, /const __tmLatestSetDoneIntentByTask = new Map\(\);/);
assert.match(runner, /__tmDoesSetDoneOpMatchLatestIntent\(op\)[\s\S]*__tmBuildSetDoneEffectsOp\(op\)/,
    'a committed writer may run completion effects only when it still matches the final intent');
assert.match(applyOptimistic, /type === 'setDone'[\s\S]*__tmMarkLocalTaskPatchWatermark\(taskId, patch/,
    'completion optimistic state must own the same local watermark as other task patches');
assert.match(rollbackQueued, /type === 'setDone'[\s\S]*__tmIsLatestSetDoneIntent\(taskId, intentRevision\)[\s\S]*__tmRollbackDoneOptimisticLocal/,
    'a failed older completion writer must not roll back a newer completion intent');
assert.doesNotMatch(executeQueued, /projectionPatch/,
    'front-end completion projection fields must never be sent to the kernel writer');
assert.match(queueSetDone, /__tmIsLatestSetDoneIntent[\s\S]*intentRevision/,
    'success, failure, and delight feedback must belong only to the latest request');
assert.match(commandPlan, /statusPatch\.customStatus[\s\S]*normalizedPatch\.done = __tmIsTaskMarkerDone\(targetMarker\)/,
    'a custom status marker must derive the same completion state as a checkbox');
assert.match(commandPlan, /const projectionPatch = \{ \.\.\.normalizedPatch \};[\s\S]*taskMarker: targetMarker,[\s\S]*task_marker: targetMarker,[\s\S]*markdown: __tmBuildTaskMarkdownWithMarker\(task, targetMarker\)/,
    'a custom status patch must project its marker and markdown atomically with the derived completion state');
assert.match(queueFieldPatch, /plan\.explicitDone === true[\s\S]*plan\.explicitCustomStatus !== true[\s\S]*__tmBuildSetDoneQueuedDefinition/,
    'only an explicit checkbox completion request may enter the shared setDone queue');
assert.match(queueFieldPatch, /__tmCaptureTaskPatchInverse\(tid, plan\.projectionPatch\)[\s\S]*projectionPatch: \{ \.\.\.plan\.projectionPatch \}/,
    'custom status rollback and optimistic projection must use the marker-aware presentation patch');
assert.match(applyOptimistic, /type === 'taskPatch'[\s\S]*const persistedPatch[\s\S]*const projectionPatch[\s\S]*patchTaskLocal\(taskId, projectionPatch[\s\S]*__tmDispatchQueuedTaskAttrPatch\(op, 'optimistic', taskId, persistedPatch\)[\s\S]*patch: projectionPatch/,
    'task status projection must update marker-aware local state without broadcasting presentation fields as attrs');
assert.match(getVerificationPatch, /type === 'taskPatch'[\s\S]*data\.projectionPatch[\s\S]*data\.patch/,
    'task status acknowledgement and rollback must verify the complete marker-aware projection');
assert.match(executeQueued, /type === 'taskPatch'[\s\S]*hasOwnProperty\.call\(normalizedPatch, 'customStatus'\)[\s\S]*__tmApplyQueuedTaskStatusPatch/,
    'a pure custom status patch must stay on the dedicated marker writer path');
assert.match(executeQueued, /type === 'contentPatch'[\s\S]*__tmUpdateTaskContentBlockKernel\(taskId,[\s\S]*fromQueue: true,[\s\S]*touchState: false/,
    'title edits must update only the direct content paragraph');
assert.match(executeQueued, /type === 'contentPatch'[\s\S]*title: nextContent,[\s\S]*content: nextContent,[\s\S]*raw_content: nextContent/,
    'the title writer receipt must acknowledge the new title instead of correcting optimistic state back to the old snapshot');
assert.match(executeQueued, /type === 'deleteTask'[\s\S]*__tmDeleteTaskKernel\(taskId/,
    'permanent deletion must reuse the high-level delete kernel');
assert.match(executeQueued, /type === 'setDone'[\s\S]*__tmSetDoneKernel\(taskId/,
    'checkbox completion must reuse the existing high-level completion writer');
assert.doesNotMatch(executeQueued, /patch: \{ title:/,
    'the queue must not send title changes through the whole-task kernel patch');
assert.doesNotMatch(`${list}\n${read('src/task-horizon/main/task-runtime/53b-task-create-and-quick-add-runtime.js')}`,
    /__tmPendingDoneRequest|pending-create-set-done/,
    'new-task completion must not use a second pending-create side channel');
assert.match(list, /const explicitCheckboxIntent[\s\S]*currentDone === targetDone && !explicitCheckboxIntent/,
    'explicit checkbox clicks must never be discarded as matching a possibly stale local state');

const commandPlanContext = vm.createContext({
    Object,
    String,
    __tmTaskStateKernel: { getTask: () => ({ done: true, customStatus: 'done', markdown: '* [X] Done' }) },
    __tmBuildMergedAttrPatch: (_taskId, patch) => ({ ...patch }),
    __tmNormalizeQueueTaskValue: (_key, value) => String(value ?? '').trim(),
    __tmGetStatusOptions: () => [{ id: 'todo', marker: ' ' }, { id: 'done', marker: 'X' }],
    __tmGetDefaultUndoneStatusId: () => 'todo',
    __tmResolveTaskMarkdownMarker: () => 'X',
    __tmResolveTaskMarker: () => 'X',
    __tmFindStatusOptionById: (id) => id === 'todo' ? { id: 'todo', marker: ' ' } : null,
    __tmNormalizeCompatTaskStatusMarker: (marker) => marker,
    __tmGuessStatusOptionDefaultMarker: () => ' ',
    __tmIsTaskMarkerDone: (marker) => marker !== ' ',
    __tmBuildTaskMarkdownWithMarker: (task, marker) => String(task.markdown || '').replace(/\[[^\]]\]/, `[${marker}]`),
    __tmBuildTaskCompleteAtPatch: () => ({ taskCompleteAt: 'derived' }),
    __tmResolveTaskStatusId: () => 'done',
});
vm.runInContext(`${commandPlan}\nthis.buildCommandPlan = __tmBuildTaskCommandPlan;`, commandPlanContext);
const emptyStatusPlan = commandPlanContext.buildCommandPlan('task-a', { customStatus: '' });
assert.equal(emptyStatusPlan.normalizedPatch.customStatus, 'todo', 'an explicit empty status must fall back to the default undone status');
assert.equal(emptyStatusPlan.normalizedPatch.done, false);
assert.equal(emptyStatusPlan.normalizedPatch.taskCompleteAt, '');
assert.equal(emptyStatusPlan.explicitCustomStatus, true);

commandPlanContext.__tmTaskStateKernel.getTask = () => ({
    done: false,
    customStatus: 'todo',
    taskMarker: ' ',
    task_marker: ' ',
    markdown: '* [ ] Open task',
});
commandPlanContext.__tmResolveTaskMarkdownMarker = () => ' ';
commandPlanContext.__tmResolveTaskMarker = () => ' ';
commandPlanContext.__tmFindStatusOptionById = (id) => id === 'done' ? { id: 'done', marker: 'X' } : null;
const completedStatusPlan = commandPlanContext.buildCommandPlan('task-a', { customStatus: 'done' });
assert.equal(completedStatusPlan.normalizedPatch.done, true);
assert.equal(completedStatusPlan.projectionPatch.taskMarker, 'X');
assert.equal(completedStatusPlan.projectionPatch.task_marker, 'X');
assert.equal(completedStatusPlan.projectionPatch.markdown, '* [X] Open task');
assert.equal(completedStatusPlan.projectionPatch.taskCompleteAt, 'derived');
const completedStatusProjection = JSON.parse(JSON.stringify(completedStatusPlan.projectionPatch));

let appliedTaskPatch = null;
let dispatchedAttrPatch = null;
let publishedTaskPatch = null;
const optimisticTaskPatchContext = vm.createContext({
    Object,
    String,
    __tmMutationTempTaskExistsForOptimisticApply: () => true,
    __tmTaskStateKernel: {
        patchTaskLocal: (_taskId, patch) => { appliedTaskPatch = { ...patch }; },
    },
    __tmMarkLocalTaskPatchWatermark: () => true,
    __tmDispatchQueuedTaskAttrPatch: (_op, _phase, _taskId, patch) => { dispatchedAttrPatch = { ...patch }; },
    __tmPublishQueuedOpMutation: (_op, _phase, detail) => { publishedTaskPatch = { ...detail.patch }; },
});
vm.runInContext(`${applyOptimistic}\nthis.applyOptimistic = __tmApplyQueuedOpOptimistic;`, optimisticTaskPatchContext);
optimisticTaskPatchContext.applyOptimistic({
    type: 'taskPatch',
    data: {
        taskId: 'task-a',
        patch: { customStatus: 'done', done: true, taskCompleteAt: 'derived' },
        projectionPatch: completedStatusPlan.projectionPatch,
        source: 'detail-status',
    },
});
assert.deepEqual(appliedTaskPatch, completedStatusProjection,
    'detail status completion must reach local task projection before the kernel response');
assert.deepEqual(dispatchedAttrPatch, { customStatus: 'done', done: true, taskCompleteAt: 'derived' },
    'marker and markdown presentation fields must not leak into attr-change broadcasts');
assert.deepEqual(publishedTaskPatch, completedStatusProjection,
    'view projection must receive the marker-aware completion patch immediately');

const context = vm.createContext({
    Map,
    Promise,
    Object,
    String,
    Number,
    Array,
    Set,
    __tmSetDoneIntentRevision: 1,
    __tmQueuedSetDoneOpsByTask: new Map(),
    __tmLatestSetDoneIntentByTask: new Map(),
    __tmEnsureQueuedOpPromise: (op) => op.promise,
    __tmApplySimpleOptimisticPresentation: (op) => {
        op.optimisticApplied = true;
        context.appliedDone = op.data.done;
        return true;
    },
});
context.globalThis = context;
vm.runInContext([
    registerIntent,
    isLatestIntent,
    matchesLatestIntent,
    coalesceQueued,
].join('\n'), context);

const pendingPromise = Promise.resolve('committed');
const queuedOp = {
    id: 'set-done-queued',
    type: 'setDone',
    status: 'queued',
    docId: 'doc-a',
    data: {
        taskId: 'task-a',
        done: false,
        patch: { done: false, startDate: '2026-08-09' },
        additionalPatch: { startDate: '2026-08-09' },
        statusPatch: { customStatus: 'todo' },
        intentRevision: 1,
    },
    inversePatch: { done: true, startDate: '2026-08-08' },
    optimisticApplied: true,
    promise: pendingPromise,
};
context.__tmQueuedSetDoneOpsByTask.set('task-a', queuedOp);
context.__tmLatestSetDoneIntentByTask.set('task-a', { revision: 1, done: false });
let pendingOp = null;
const coalesced = context.__tmTryCoalesceQueuedSetDone({
    type: 'setDone',
    docId: 'doc-a',
    data: {
        taskId: 'task-a',
        done: true,
        patch: { done: true },
        additionalPatch: {},
        statusPatch: { customStatus: 'finish' },
        previousStatePrepared: false,
    },
    inversePatch: { done: false },
}, {
    wait: false,
    onPending: (_promise, op) => { pendingOp = op; },
});

assert.ok(coalesced && typeof coalesced.then === 'function');
assert.equal(pendingOp, queuedOp, 'the final click must reuse the one queued writer and its promise');
assert.equal(queuedOp.data.done, true);
assert.equal(queuedOp.data.patch.startDate, '2026-08-09', 'unrelated fields already queued with the operation must be preserved');
assert.equal(queuedOp.inversePatch.done, true, 'coalescing must retain the rollback baseline from before the first optimistic patch');
assert.equal(context.appliedDone, true, 'coalescing must immediately replace the optimistic overlay with the final state');
assert.equal(context.__tmIsLatestSetDoneIntent('task-a', queuedOp.data.intentRevision), true);

const staleRunningOp = { type: 'setDone', data: { taskId: 'task-a', done: false } };
assert.equal(context.__tmDoesSetDoneOpMatchLatestIntent(staleRunningOp), false,
    'an older commit must not run effects for a state the user already replaced');
const matchingRunningOp = { type: 'setDone', data: { taskId: 'task-a', done: true } };
assert.equal(context.__tmDoesSetDoneOpMatchLatestIntent(matchingRunningOp), true,
    'true -> false -> true may run the first true effect once because it matches the final state');

let localRollbackCount = 0;
let publishedRollbackCount = 0;
const rollbackContext = vm.createContext({
    Object,
    String,
    Number,
    __tmGetQueuedTaskPatchForVerification: () => ({ done: true, taskMarker: 'X' }),
    __tmDoesMutationStillOwnLocalWatermark: () => true,
    __tmClearLocalTaskPatchWatermark: () => true,
    __tmIsLatestSetDoneIntent: (_taskId, revision) => revision === 2,
    __tmRollbackDoneOptimisticLocal: () => { localRollbackCount += 1; },
    __tmPublishQueuedOpMutation: () => { publishedRollbackCount += 1; },
});
vm.runInContext(`${rollbackQueued}\nthis.rollbackQueued = __tmRollbackQueuedOp;`, rollbackContext);
rollbackContext.rollbackQueued({
    type: 'setDone',
    data: { taskId: 'task-a', intentRevision: 1 },
    inversePatch: { done: false },
});
assert.equal(localRollbackCount, 0,
    'a failed stale revision must leave the latest optimistic completion state untouched');
assert.equal(publishedRollbackCount, 1,
    'a failed stale revision must still settle and remove its own overlay');
rollbackContext.rollbackQueued({
    type: 'setDone',
    data: { taskId: 'task-a', intentRevision: 2 },
    inversePatch: { done: false },
});
assert.equal(localRollbackCount, 1,
    'the latest failed revision may restore its confirmed baseline');

const laneContext = vm.createContext({
    Set,
    Array,
    String,
    globalThis: {
        __tmTaskBoundary: {
            getTask: () => ({ id: 'task-a', root_id: 'doc-a' }),
        },
    },
});
vm.runInContext(`${laneResolver}\nthis.resolveLanes = __tmResolveQueuedMutationLaneKeys;`, laneContext);
assert.deepEqual(Array.from(laneContext.resolveLanes({
    type: 'setDone',
    docId: 'doc-a',
    data: { taskId: 'task-a' },
})), ['task:task-a'], 'completion writes must serialize by task without blocking unrelated tasks in the same document');
const createSubtaskLanes = Array.from(laneContext.resolveLanes({
    type: 'createSubtask',
    docId: 'doc-a',
    data: {
        parentTaskId: 'task-parent',
        requestedTaskId: 'task-new',
        tempId: 'task-new',
        docId: 'doc-a',
    },
}));
assert.deepEqual(createSubtaskLanes, ['doc:doc-a', 'task:task-new', 'task:task-parent'],
    'a create must reserve the stable new-task lane as well as its structural parent and document lanes');
const immediateSetDoneLanes = Array.from(laneContext.resolveLanes({
    type: 'setDone',
    data: { taskId: 'task-new' },
}));
assert.ok(createSubtaskLanes.includes(immediateSetDoneLanes[0]),
    'an immediate checkbox click must wait on the same new-task lane as its create writer');

const maxYieldMatch = projection.match(/const __TM_PROJECTION_INPUT_YIELD_MAX_MS = (\d+);/);
assert.ok(maxYieldMatch, 'projection scheduling must define a finite input-yield budget');
assert.ok(Number(maxYieldMatch[1]) > 0 && Number(maxYieldMatch[1]) <= 300);
const optimisticScheduler = extractFunction(projection, '__tmScheduleOptimisticProjectionFrame');
const batchScheduler = extractFunction(projection, '__tmScheduleTaskProjectionBatch');
for (const scheduler of [optimisticScheduler, batchScheduler]) {
    assert.match(scheduler, /Date\.now\(\) - scheduledAt < __TM_PROJECTION_INPUT_YIELD_MAX_MS/,
        'continuous input may defer projection only until the bounded deadline');
}

const calendarBuildStart = calendar.indexOf('const buildTaskDateEventsFromTasks =');
const calendarBuildEnd = calendar.indexOf('\n        const ensureCompleteTaskCache', calendarBuildStart);
const calendarBuild = calendar.slice(calendarBuildStart, calendarBuildEnd);
const calendarDone = extractAssignedFunction(calendar, 'window.tmIsTaskDone');
assert.doesNotMatch(calendarBuild, /doneOverrides/,
    'calendar event filtering must read the shared projected task instead of a compatibility override');
assert.doesNotMatch(calendarDone, /doneOverrides/,
    'calendar interactions must read the shared projected task instead of a compatibility override');
assert.match(calendarBuild, /__tmGetCalendarFlatTaskByIdSync\(id\)/);

console.log('task set-done latest intent contract tests passed');
