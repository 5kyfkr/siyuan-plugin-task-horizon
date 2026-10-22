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
const committedEffectsFunction = extractBetween(
    listSource,
    'async function __tmRunCommittedSetDoneEffects(',
    'try { globalThis.__tmRunCommittedSetDoneEffects = __tmRunCommittedSetDoneEffects; }',
);
assert.match(committedEffectsFunction, /set-done-tomato-failed[\s\S]*完成状态已保存，但番茄联动/,
    'a failed Tomato side effect must report partial completion instead of disappearing');
assert.doesNotMatch(committedEffectsFunction, /catch\(\(\) => null\)/,
    'completion side effects must not silently swallow Tomato failures');
assert.match(apiSource, /set-done-effects-failed[\s\S]*完成状态已保存，但关联处理/,
    'the mutation service must distinguish a committed completion from failed follow-up effects');
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
const deleteHistoryFunction = extractBetween(
    recurringSource,
    'async function __tmDeleteTaskRepeatHistoryEntry(',
    'async function __tmSetDetachedTaskRepeatHistoryEntry(',
);
const scheduleAdvanceFunction = extractBetween(
    recurringSource,
    'function __tmScheduleRecurringTaskAdvanceAfterCompletion(',
    'let __tmRecurringNativeDoneResetSweepPromise = null;',
);
const resetNativeDoneFunction = extractBetween(
    recurringSource,
    'const __tmRecurringNativeDoneResetInFlight = new Map();',
    'const __tmRecurringAdvanceTimers = new Map();',
);
const resetNativeDoneSweepRuntime = extractBetween(
    recurringSource,
    'let __tmRecurringNativeDoneResetSweepPromise = null;',
    'let __tmRecurringDueReconcilePromise = null;',
);
const reconcileRuntime = extractBetween(
    recurringSource,
    'let __tmRecurringDueReconcilePromise = null;',
    'window.tmGetTaskRepeatRule = async function',
);

function testPostCommitDefersRecurringReminderSettlementToAdvance() {
    const events = [];
    const task = {
        id: 'task-1',
        taskCompleteAt: '2026-07-23T10:00:00.000+08:00',
        repeatRule: { enabled: true, type: 'daily' },
    };
    const context = vm.createContext({
        state: { flatTasks: { 'task-1': task }, pendingInsertedTasks: {} },
        __tmNormalizeTaskCompleteAtValue: (value) => String(value || '').trim(),
        __tmGetTaskRepeatRule: (value) => value.repeatRule,
        __tmBuildTaskRepeatAdvancePatch: () => ({ startDate: '2026-07-24' }),
        __tmScheduleRecurringTaskAdvanceAfterCompletion: (_taskId, options) => events.push(['recurring', options.completedAt]),
        __tmQueueTaskDoneDelight: () => events.push(['delight']),
        __tmSettleTomatoAfterTaskDone: () => {
            events.push(['tomato']);
            return new Promise(() => {});
        },
        __tmGetTaskAttrHostId: () => 'task-1',
        __tmDispatchTaskCompletedForReward: () => events.push(['reward']),
        __tmSyncParentDoneStateFromSubtasks: () => {
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
    assert.deepEqual(events.map((item) => item[0]), ['recurring', 'delight', 'reward', 'parent'],
        'a recurring completion must let the recurrence transaction settle the current reminder exactly once');

    context.runPostCommit('task-1', { done: true, previousDone: true, completedAt: task.taskCompleteAt });
    assert.equal(events.length, 4, 'an already-completed write must not replay post-commit effects');
    context.runPostCommit('task-1', { done: false, previousDone: true });
    assert.deepEqual(events.slice(-2).map((item) => item[0]), ['clear', 'parent'],
        'restoring a child must clear recurring work and synchronize its parent');
}

async function testCommittedEffectsRewardDoesNotWaitForStaleSqlOrTomato() {
    const events = [];
    let resolveRead = null;
    const readGate = new Promise((resolve) => { resolveRead = resolve; });
    const localTask = {
        id: 'task-1',
        done: true,
        content: 'Committed task',
        root_id: 'doc-1',
        taskCompleteAt: '2026-08-07T10:00:00.000+08:00',
        repeatRule: { enabled: false, type: 'none' },
    };
    const context = vm.createContext({
        Promise,
        SettingsStore: { data: { taskCompletionArchiveMode: 'none', taskCompletionArchiveDocId: '' } },
        state: { flatTasks: { 'task-1': localTask }, pendingInsertedTasks: {} },
        API: {
            getTaskById: () => readGate,
        },
        __tmNormalizeTaskCompleteAtValue: (value) => String(value || '').trim(),
        __tmGetTaskAttrHostId: () => 'task-1',
        __tmDispatchTaskCompletedForReward: (_task, detail) => {
            events.push(['reward', detail.priorityScore, detail.idempotencyKey]);
            return true;
        },
        normalizeTaskFields: () => {},
        __tmGetTaskRepeatRule: (task) => task.repeatRule || { enabled: false, type: 'none' },
        __tmAdvanceRecurringTaskAfterCompletion: async () => false,
        __tmSettleTomatoAfterTaskDone: () => {
            events.push(['tomato']);
            return new Promise(() => {});
        },
        __tmSyncParentDoneStateFromSubtasks: async () => null,
        __tmNormalizeTaskCompletionArchiveMode: (value) => String(value || 'none'),
        __tmClearRecurringTaskAdvanceTimer: () => {},
    });
    context.__tmRuntimeState = { getTaskById: () => localTask };
    vm.runInContext(`${committedEffectsFunction}\nthis.runCommittedEffects = __tmRunCommittedSetDoneEffects;`, context);

    const completion = context.runCommittedEffects('task-1', {
        done: true,
        previousDone: false,
        completedAt: localTask.taskCompleteAt,
        rewardPriorityScore: 120,
        effectId: 'completion-op-1',
    });
    assert.deepEqual(events, [['reward', 120, 'completion-op-1:reward']],
        'reward dispatch must happen synchronously after the acknowledged completion, before SQL readback');

    resolveRead({
        ...localTask,
        done: false,
        markdown: '* [ ] stale SQL row',
    });
    const result = await completion;
    assert.equal(result.rewardDispatched, true);
    assert.equal(result.skipped, undefined, 'a stale SQL done flag must not cancel committed completion effects');
    assert.deepEqual(events.map((item) => item[0]), ['reward', 'tomato']);

    await context.runCommittedEffects('task-1', {
        done: true,
        previousDone: true,
        rewardPriorityScore: 120,
        effectId: 'completion-op-2',
    });
    assert.equal(events.filter((item) => item[0] === 'reward').length, 1,
        'an already-completed transition must not dispatch a second reward');
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

async function testQueuedCompletionPreservesTimestamp() {
    const completedAt = '2026-09-08T00:23:06.395+08:00';
    const task = { id: 'task-1', done: false, taskCompleteAt: '' };
    let writtenOptions = null;
    const context = vm.createContext({
        __tmIsMutationTaskPendingDeleted: () => false,
        __tmTaskBoundary: { getTask: () => task },
        __tmSetDoneKernel: async (_taskId, done, _event, options) => {
            writtenOptions = options;
            task.done = done;
            task.taskCompleteAt = Object.prototype.hasOwnProperty.call(options, 'taskCompleteAt')
                ? options.taskCompleteAt
                : (done ? '2026-09-08T00:23:06.429+08:00' : '');
            return true;
        },
    });
    vm.runInContext([
        extractBetween(apiSource, 'async function __tmExecuteQueuedOp(', 'function __tmGetQueuedTaskPatchForVerification('),
        extractBetween(apiSource, 'function __tmBuildSetDoneEffectsOp(', 'function __tmEnqueueMutationFollowUpOps('),
    ].join('\n'), context);
    const operation = {
        id: 'done-1', type: 'setDone', data: {
            taskId: task.id, done: true, previousDone: false,
            taskCompleteAtDerived: true, patch: { done: true, taskCompleteAt: completedAt },
        },
    };
    const result = await context.__tmExecuteQueuedOp(operation);
    const effects = context.__tmBuildSetDoneEffectsOp(operation);
    assert.equal(result.task.taskCompleteAt, effects.data.completedAt,
        'the kernel write and recurrence history must share the same completion timestamp, not regenerate it 34ms later');
    assert.equal(writtenOptions.taskCompleteAt, completedAt);

    await context.__tmExecuteQueuedOp({ type: 'setDone', data: {
        taskId: task.id, done: false, previousDone: true, patch: { done: false, taskCompleteAt: '' },
    } });
    assert.equal(writtenOptions.taskCompleteAt, '', 'explicit timestamp clearing must survive queue execution');
    await context.__tmExecuteQueuedOp({ type: 'setDone', data: {
        taskId: task.id, done: true, previousDone: true, patch: { done: true },
    } });
    assert.equal(Object.prototype.hasOwnProperty.call(writtenOptions, 'taskCompleteAt'), false,
        'a completion timestamp discarded during baseline reconciliation must not be injected again');
}


async function testRecurringNativeDoneResetIsDateBoundAndIdempotent() {
    const completedAt = '2026-07-23T10:00:00.000+08:00';
    const task = {
        id: 'task-1',
        done: true,
        taskMarker: 'X',
        taskCompleteAt: completedAt,
        startDate: '2026-07-24',
        completionTime: '2026-07-24',
        repeatRule: { enabled: true, type: 'daily' },
        repeatState: { lastCompletedAt: completedAt, pendingNativeDoneReset: true },
    };
    const calls = { reset: 0, reconcile: 0, snapshots: [] };
    const context = vm.createContext({
        window: {},
        __tmResolveTaskForRepeat: async () => task,
        __tmNormalizeTaskRepeatState: (value) => ({ occurrenceCount: 1, pendingNativeDoneReset: false, ...(value || {}) }),
        __tmGetTaskRepeatRule: (value) => value.repeatRule,
        __tmIsTaskNativeDone: (value) => value?.taskMarker !== ' ',
        __tmIsRecurringNativeDoneHeld: (value) => value?.repeatState?.pendingNativeDoneReset === true
            && value.repeatState.lastCompletedAt === value.taskCompleteAt,
        __tmGetRecurringNativeDoneResetDateKey: () => '2026-07-24',
        __tmGetTaskOccurrenceId: () => 'next-round',
        __tmTaskSnapshotService: { scheduleAfterLocalPatch: (taskId, patch, options) => calls.snapshots.push({ taskId, patch, options }) },
        __tmNormalizeDateOnly: (value) => String(value || '').slice(0, 10),
        __tmApplyTaskMetaPatchWithUndo: async (_taskId, patch) => {
            calls.reconcile += 1;
            task.repeatState = patch.repeatState;
        },
    });
    context.__tmRequireTaskMutation = () => async (_taskId, done, options) => {
        calls.reset += 1;
        task.done = done;
        task.taskMarker = done ? 'X' : ' ';
        task.taskCompleteAt = options.additionalPatch.taskCompleteAt;
        task.repeatState = options.additionalPatch.repeatState;
        return true;
    };
    vm.runInContext(`${resetNativeDoneFunction}\nthis.resetNativeDone = __tmResetRecurringNativeDoneIfDue;`, context);

    assert.equal(await context.resetNativeDone(task, { todayKey: '2026-07-23' }), false);
    assert.equal(calls.reset, 0);
    assert.equal(task.done, true);
    assert.equal(await context.resetNativeDone(task, { todayKey: '2026-07-24' }), true);
    assert.equal(calls.reset, 1);
    assert.equal(task.done, false);
    assert.equal(task.taskCompleteAt, '');
    assert.equal(task.repeatState.pendingNativeDoneReset, false);
    assert.equal(await context.resetNativeDone(task, { todayKey: '2026-07-24' }), false);
    assert.equal(calls.reset, 1, 'a second client-side check must not write the same reset twice');
    assert.equal(calls.snapshots.length, 1);
    assert.equal(calls.snapshots[0].options.persistSnapshot, true);
    assert.equal(calls.snapshots[0].patch.done, false);

    const closedTask = {
        ...task,
        done: true,
        taskMarker: 'X',
        taskCompleteAt: completedAt,
        repeatRule: { enabled: false, type: 'none' },
        repeatState: { lastCompletedAt: completedAt, pendingNativeDoneReset: true },
    };
    assert.equal(await context.resetNativeDone(closedTask, { todayKey: '2026-07-24' }), true);
    assert.equal(closedTask.done, true, 'closing recurrence must keep the native completed marker');
    assert.equal(calls.reconcile, 1);
}


async function testRecurringNativeDoneResetSweepRunsOncePerLocalDay() {
    const tasks = {
        one: { id: 'one', repeatState: { pendingNativeDoneReset: true } },
        two: { id: 'two', repeatState: { pendingNativeDoneReset: true } },
    };
    const calls = { reset: [], refresh: 0 };
    const context = vm.createContext({
        state: {
            flatTasks: tasks,
            taskTree: [{ tasks: [tasks.one, tasks.two] }],
        },
        __tmNormalizeTaskRepeatState: (value) => ({ pendingNativeDoneReset: false, ...(value || {}) }),
        __tmNormalizeDateOnly: (value) => String(value || '').slice(0, 10),
        __tmResetRecurringNativeDoneIfDue: async (taskId) => {
            calls.reset.push(taskId);
            return true;
        },
        __tmRefreshViewsAfterTaskMutation: () => { calls.refresh += 1; },
        setTimeout: () => 1,
        clearTimeout: () => {},
        Date,
    });
    vm.runInContext(`${resetNativeDoneSweepRuntime}\nthis.runResetSweep = __tmRunRecurringNativeDoneResetSweep;`, context);

    assert.equal(await context.runResetSweep({ todayKey: '2026-07-24' }), 2);
    assert.deepEqual(calls.reset, ['one', 'two'], 'tree and flat mirrors must be de-duplicated');
    assert.equal(calls.refresh, 1, 'a sweep must batch its view refresh');
    assert.equal(await context.runResetSweep({ todayKey: '2026-07-24' }), 0);
    assert.deepEqual(calls.reset, ['one', 'two'], 'repeated wake events on the same day must not scan again');
    assert.equal(calls.refresh, 1);
}


async function testRecurringFailureSchedulesOneFallbackRefresh() {
    let refreshCount = 0;
    let hintCount = 0;
    let scheduledDelay = null;
    const context = vm.createContext({
        __tmRecurringAdvanceTimers: new Map(),
        __tmLogRecurringAdvance: () => {},
        __tmClearRecurringTaskAdvanceTimer: () => true,
        __tmAdvanceRecurringTaskAfterCompletion: async () => { throw new Error('advance failed'); },
        __tmRefreshViewsAfterTaskMutation: () => { refreshCount += 1; },
        hint: () => { hintCount += 1; },
        setTimeout: (callback, delay) => {
            scheduledDelay = delay;
            Promise.resolve().then(callback);
            return 1;
        },
    });
    vm.runInContext(`${scheduleAdvanceFunction}\nthis.scheduleAdvance = __tmScheduleRecurringTaskAdvanceAfterCompletion;`, context);
    context.scheduleAdvance('task-1', { completedAt: '2026-07-23T10:00:00.000+08:00' });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(scheduledDelay, 80, 'completion-driven recurring advancement should not wait 280ms by default');
    assert.equal(refreshCount, 1);
    assert.equal(hintCount, 1);
}


async function run() {
    testPostCommitDefersRecurringReminderSettlementToAdvance();
    await testCommittedEffectsRewardDoesNotWaitForStaleSqlOrTomato();
    testRecurringInstanceSyncOnlyTouchesLoadedDocuments();
    await testQueuedCompletionPreservesTimestamp();
    await testRecurringNativeDoneResetIsDateBoundAndIdempotent();
    await testRecurringNativeDoneResetSweepRunsOncePerLocalDay();
    await testRecurringFailureSchedulesOneFallbackRefresh();
    require('./recurring-transition-behavior.test.js');
    console.log('completion effects, timestamps, reset lifecycle and transactional transitions passed');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
