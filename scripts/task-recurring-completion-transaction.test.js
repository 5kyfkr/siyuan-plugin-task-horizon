'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const listSource = read('src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js');
const modelSource = read('src/task-horizon/main/task-runtime/50-task-model-and-repeat-utils.js');
const recurringSource = read('src/task-horizon/main/task-runtime/54-recurring-task-runtime.js');
const apiSource = read('src/task-horizon/main/20-api-and-runtime-services.js');

function extractBetween(source, startNeedle, endNeedle) {
    const start = source.indexOf(startNeedle);
    const end = source.indexOf(endNeedle, start + startNeedle.length);
    assert.ok(start >= 0, `missing ${startNeedle}`);
    assert.ok(end > start, `missing boundary ${endNeedle}`);
    return source.slice(start, end).trim();
}

const postCommitFunction = extractBetween(
    listSource,
    'function __tmRunSetDonePostCommitEffects(',
    'async function __tmSetDoneKernel(',
);
const syncInstancesFunction = extractBetween(
    modelSource,
    'function __tmSyncRecurringInstanceTasks(',
    'function __tmCollectTaskRepeatPreviewDates(',
);
const advanceFunction = extractBetween(
    recurringSource,
    'async function __tmAdvanceRecurringTaskAfterCompletionInternal(',
    'function __tmScheduleRecurringTaskAdvanceAfterCompletion(',
);
const scheduleAdvanceFunction = extractBetween(
    recurringSource,
    'function __tmScheduleRecurringTaskAdvanceAfterCompletion(',
    'function __tmBuildTaskRepeatDueAdvancePatch(',
);

function testPostCommitRunsOnceAndDoesNotWaitForTomato() {
    const events = [];
    const task = {
        id: 'task-1',
        taskCompleteAt: '2026-07-23T10:00:00.000+08:00',
        repeatRule: { enabled: true, type: 'daily' },
    };
    const context = vm.createContext({
        state: { flatTasks: { 'task-1': task }, pendingInsertedTasks: {} },
        __tmNormalizeTaskCompleteAtValue: (value) => String(value || '').trim(),
        __tmGetTaskRepeatRule: () => task.repeatRule,
        __tmBuildTaskRepeatAdvancePatch: () => ({ startDate: '2026-07-24' }),
        __tmScheduleRecurringTaskAdvanceAfterCompletion: (_taskId, options) => events.push(['recurring', options.completedAt]),
        __tmQueueTaskDoneDelight: () => events.push(['delight']),
        __tmSettleTomatoAfterTaskDone: () => {
            events.push(['tomato']);
            return new Promise(() => {});
        },
        __tmGetTaskAttrHostId: () => 'task-1',
        __tmDispatchTaskCompletedForReward: () => events.push(['reward']),
        __tmMaybeAutoCompleteParentAfterSubtaskDone: () => {
            events.push(['parent']);
            return Promise.resolve();
        },
        __tmClearRecurringTaskAdvanceTimer: () => events.push(['clear']),
    });
    context.__tmRuntimeState = { getTaskById: () => task };
    vm.runInContext(`${postCommitFunction}\nthis.runPostCommit = __tmRunSetDonePostCommitEffects;`, context);

    const scheduled = context.runPostCommit('task-1', {
        done: true,
        previousDone: false,
        completedAt: task.taskCompleteAt,
        rewardPriorityScore: 3,
    });
    assert.equal(scheduled, true);
    assert.deepEqual(events[0], ['recurring', task.taskCompleteAt], 'recurring advance must be scheduled before optional effects');
    assert.deepEqual(events.map((item) => item[0]), ['recurring', 'delight', 'tomato', 'reward', 'parent']);

    context.runPostCommit('task-1', { done: true, previousDone: true, completedAt: task.taskCompleteAt });
    assert.equal(events.length, 5, 'an already-completed write must not replay post-commit effects');
    context.runPostCommit('task-1', { done: false, previousDone: true });
    assert.equal(events.at(-1)[0], 'clear');
}

function testRecurringInstanceSyncOnlyTouchesLoadedDocuments() {
    const sourceTask = {
        id: 'task-1',
        root_id: 'doc-1',
        repeatHistory: [
            { completedAt: '2026-07-23T10:00:00.000+08:00' },
            { completedAt: '2026-07-22T10:00:00.000+08:00', docId: 'doc-unloaded' },
        ],
    };
    const oldVirtual = { id: 'old-virtual', sourceTaskId: 'task-1', isRecurringInstance: true };
    const state = {
        taskTree: [{ id: 'doc-1', tasks: [sourceTask, oldVirtual] }],
        flatTasks: { 'task-1': sourceTask, 'old-virtual': oldVirtual },
    };
    let invalidated = 0;
    const context = vm.createContext({
        state,
        __tmPurgeRecurringInstanceTasks: () => {
            state.taskTree[0].tasks = state.taskTree[0].tasks.filter((task) => !task.isRecurringInstance);
            delete state.flatTasks['old-virtual'];
        },
        __tmNormalizeTaskRepeatHistory: (history) => history,
        __tmBuildRecurringInstanceTask: (_source, history, index) => ({
            id: `virtual-${index}`,
            root_id: history.docId || 'doc-1',
            sourceTaskId: 'task-1',
            isRecurringInstance: true,
        }),
        __tmInvalidateFilteredTaskDerivedStateCache: () => { invalidated += 1; },
    });
    context.__tmTaskStore = {
        upsertLocal: (task) => { state.flatTasks[task.id] = task; },
    };
    vm.runInContext(`${syncInstancesFunction}\nthis.syncInstances = __tmSyncRecurringInstanceTasks;`, context);

    assert.equal(context.syncInstances(sourceTask), 1);
    assert.equal(state.flatTasks['old-virtual'], undefined);
    assert.ok(state.flatTasks['virtual-0']);
    assert.equal(state.flatTasks['virtual-1'], undefined, 'unloaded historical documents must not gain a partial projection');
    assert.deepEqual(state.taskTree[0].tasks.map((task) => task.id), ['task-1', 'virtual-0']);
    assert.equal(invalidated, 1);
}

function createAdvanceHarness(task, buildPatch, options = {}) {
    const calls = { persist: [], reset: 0, sync: 0, refresh: 0 };
    const context = vm.createContext({
        state: { viewMode: 'list' },
        window: {},
        __tmWaitForGlobalUnlock: async () => true,
        __tmResolveTaskForRepeat: async () => task,
        __tmResolveTaskIdFromAnyBlockId: async (id) => id,
        __tmGetTaskRepeatRule: () => task.repeatRule,
        __tmNormalizeTaskRepeatState: (value) => ({ occurrenceCount: 1, lastCompletedAt: '', ...(value || {}) }),
        __tmNormalizeTaskCompleteAtValue: (value) => String(value || '').trim(),
        __tmNormalizeTaskRepeatHistory: (value) => Array.isArray(value) ? value : [],
        __tmBuildTaskRepeatAdvancePatch: buildPatch,
        __tmNormalizeDateOnly: (value) => String(value || '').slice(0, 10),
        __tmApplyTaskMetaPatchWithUndo: async (_taskId, patch, persistOptions) => {
            calls.persist.push({ patch, options: persistOptions });
            if (options.persistError) throw options.persistError;
            task.startDate = patch.startDate;
            task.completionTime = patch.completionTime;
            task.repeatState = patch.repeatState;
            task.repeatHistory = patch.repeatHistory;
        },
        __tmReassignCompletedScheduleToRecurringInstance: async () => true,
        __tmSyncRecurringInstanceTasks: () => { calls.sync += 1; },
        __tmRefreshViewsAfterTaskMutation: () => { calls.refresh += 1; },
        hint: () => {},
    });
    context.window.tmSetDone = async () => {
        calls.reset += 1;
        if (options.resetFails) return false;
        task.done = false;
        task.taskCompleteAt = '';
        return true;
    };
    vm.runInContext(`${advanceFunction}\nthis.advance = __tmAdvanceRecurringTaskAfterCompletionInternal;`, context);
    return { advance: context.advance, calls };
}

async function testRecurringAdvanceStateMachine() {
    const completedAt = '2026-07-23T10:00:00.000+08:00';
    const newTask = {
        id: 'task-1',
        done: true,
        taskCompleteAt: completedAt,
        startDate: '2026-07-23',
        completionTime: '2026-07-23',
        content: 'Daily task',
        root_id: 'doc-1',
        docName: 'Tasks',
        docSeq: 4,
        repeatRule: { enabled: true, type: 'daily', maxOccurrences: 0 },
        repeatState: { occurrenceCount: 1, lastCompletedAt: '' },
        repeatHistory: [],
    };
    const nextPatch = () => ({
        startDate: '2026-07-24',
        completionTime: '2026-07-24',
        repeatState: { occurrenceCount: 2, lastCompletedAt: completedAt },
    });
    const first = createAdvanceHarness(newTask, nextPatch);
    assert.equal(await first.advance('task-1', { completedAt, suppressHint: true }), true);
    assert.equal(first.calls.persist.length, 1);
    assert.equal(first.calls.persist[0].options.wait, true);
    assert.equal(first.calls.persist[0].options.background, false);
    assert.equal(first.calls.persist[0].patch.repeatHistory[0].content, 'Daily task');
    assert.equal(first.calls.reset, 1);
    assert.equal(first.calls.sync, 1);
    assert.equal(first.calls.refresh, 1);

    const resetOnlyTask = {
        ...newTask,
        done: true,
        taskCompleteAt: completedAt,
        repeatState: { occurrenceCount: 2, lastCompletedAt: completedAt },
        repeatHistory: [{ completedAt, nextStart: '2026-07-24', nextDue: '2026-07-24' }],
    };
    const resetOnly = createAdvanceHarness(resetOnlyTask, () => { throw new Error('must not advance twice'); });
    assert.equal(await resetOnly.advance('task-1', { completedAt, suppressHint: true }), true);
    assert.equal(resetOnly.calls.persist.length, 0);
    assert.equal(resetOnly.calls.reset, 1);

    const finishedTask = {
        ...newTask,
        done: true,
        taskCompleteAt: completedAt,
        repeatRule: { enabled: true, type: 'daily', maxOccurrences: 1 },
        repeatState: { occurrenceCount: 1, lastCompletedAt: '' },
        repeatHistory: [],
    };
    const finished = createAdvanceHarness(finishedTask, () => null);
    assert.equal(await finished.advance('task-1', { completedAt, suppressHint: true }), false);
    assert.equal(finished.calls.persist.length, 0);
    assert.equal(finished.calls.reset, 0);
    assert.equal(finishedTask.done, true);

    const persistFailureTask = {
        ...newTask,
        done: true,
        taskCompleteAt: completedAt,
        repeatState: { occurrenceCount: 1, lastCompletedAt: '' },
        repeatHistory: [],
    };
    const persistFailure = createAdvanceHarness(persistFailureTask, nextPatch, {
        persistError: new Error('persist failed'),
    });
    await assert.rejects(() => persistFailure.advance('task-1', { completedAt, suppressHint: true }), /persist failed/);
    assert.equal(persistFailureTask.done, true, 'a repeat metadata failure must preserve the committed completion');
    assert.equal(persistFailure.calls.reset, 0);

    const resetFailureTask = {
        ...newTask,
        done: true,
        taskCompleteAt: completedAt,
        repeatState: { occurrenceCount: 1, lastCompletedAt: '' },
        repeatHistory: [],
    };
    const resetFailure = createAdvanceHarness(resetFailureTask, nextPatch, { resetFails: true });
    await assert.rejects(() => resetFailure.advance('task-1', { completedAt, suppressHint: true }));
    assert.equal(resetFailureTask.done, true);
    assert.equal(resetFailureTask.repeatHistory.length, 1);

    const recovery = createAdvanceHarness(resetFailureTask, () => { throw new Error('recovery must not advance twice'); });
    assert.equal(await recovery.advance('task-1', { completedAt, suppressHint: true }), true);
    assert.equal(recovery.calls.persist.length, 0);
    assert.equal(recovery.calls.reset, 1);
    assert.equal(resetFailureTask.repeatHistory.length, 1);
}

async function testRecurringFailureSchedulesOneFallbackRefresh() {
    let refreshCount = 0;
    let hintCount = 0;
    const context = vm.createContext({
        __tmRecurringAdvanceTimers: new Map(),
        __tmClearRecurringTaskAdvanceTimer: () => true,
        __tmAdvanceRecurringTaskAfterCompletion: async () => { throw new Error('advance failed'); },
        __tmRefreshViewsAfterTaskMutation: () => { refreshCount += 1; },
        hint: () => { hintCount += 1; },
        setTimeout: (callback) => {
            Promise.resolve().then(callback);
            return 1;
        },
    });
    vm.runInContext(`${scheduleAdvanceFunction}\nthis.scheduleAdvance = __tmScheduleRecurringTaskAdvanceAfterCompletion;`, context);
    context.scheduleAdvance('task-1', { completedAt: '2026-07-23T10:00:00.000+08:00' });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(refreshCount, 1);
    assert.equal(hintCount, 1);
}

async function run() {
    testPostCommitRunsOnceAndDoesNotWaitForTomato();
    testRecurringInstanceSyncOnlyTouchesLoadedDocuments();
    await testRecurringAdvanceStateMachine();
    await testRecurringFailureSchedulesOneFallbackRefresh();

    const kernel = extractBetween(listSource, 'async function __tmSetDoneKernel(', 'const __tmAutoCompleteParentTaskIdsInFlight');
    const applyStatus = extractBetween(apiSource, 'async function __tmApplyTaskStatus(', 'async function __tmApplyTaskStatusBatch(');
    assert.ok(kernel.indexOf('__tmUpdateTaskListItemMarkerWithFallback') < kernel.indexOf('GlobalLock.lock()'));
    assert.ok(kernel.indexOf('__tmUpdateTaskListItemMarkerWithFallback') < kernel.indexOf('TreeProtector.saveTree'));
    assert.ok(applyStatus.indexOf('__tmScheduleRecurringTaskAdvanceAfterCompletion') < applyStatus.indexOf('__tmSettleTomatoAfterTaskDone'));
    assert.match(apiSource, /deferCompletionEffects:\s*true/);
    assert.doesNotMatch(recurringSource, /wait:\s*false[\s\S]*task-repeat-advance/);
    console.log('task recurring completion transaction tests passed');
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
