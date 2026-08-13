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
const scheduleAdvanceFunction = extractBetween(
    recurringSource,
    'function __tmScheduleRecurringTaskAdvanceAfterCompletion(',
    'function __tmBuildTaskRepeatDueAdvancePatch(',
);
const dueAdvanceFunction = extractBetween(
    recurringSource,
    'function __tmBuildTaskRepeatDueAdvancePatch(',
    'let __tmRecurringDueReconcilePromise = null;',
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

function createAdvanceHarness(task, buildPatch, options = {}) {
    const calls = { persist: [], reset: 0, sync: 0, refresh: 0, reminderSettle: 0, projections: [], broadcasts: [], snapshots: [] };
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
        __tmNormalizeTaskTomatoAmount: (value) => Math.max(0, Math.round((Number(value) || 0) * 100) / 100),
        __tmNormalizeTaskTomatoCount: (value) => Math.max(0, Math.floor(Number(value) || 0)),
        __tmGetTaskTomatoCumulativeValues: (value) => ({
            tomatoMinutes: Math.max(0, Number(value?.tomatoMinutes) || 0),
            tomatoHours: Math.max(0, Number(value?.tomatoHours) || 0),
            tomatoCount: Math.max(0, Number(value?.tomatoCount) || 0),
        }),
        __tmGetTaskTomatoFocusValues: (value) => ({
            tomatoMinutes: Math.max(0, (Number(value?.tomatoMinutes) || 0) - (Number(value?.repeatState?.tomatoBaselineMinutes) || 0)),
            tomatoHours: Math.max(0, (Number(value?.tomatoHours) || 0) - (Number(value?.repeatState?.tomatoBaselineHours) || 0)),
            tomatoCount: Math.max(0, (Number(value?.tomatoCount) || 0) - (Number(value?.repeatState?.tomatoBaselineCount) || 0)),
        }),
        __tmBuildTaskTomatoBaselinePatch: (value) => ({
            tomatoBaselineMinutes: Math.max(0, Number(value?.tomatoMinutes) || 0),
            tomatoBaselineHours: Math.max(0, Number(value?.tomatoHours) || 0),
            tomatoBaselineCount: Math.max(0, Number(value?.tomatoCount) || 0),
            tomatoBaselineSet: true,
        }),
        __tmBuildTaskRepeatAdvancePatch: buildPatch,
        __tmNormalizeFsrsRating: (value) => Math.max(0, Math.min(4, Number(value) || 0)),
        __tmBuildFsrsReviewPatch: options.buildFsrsReviewPatch || (() => { throw new Error('unexpected FSRS review'); }),
        __tmNormalizeDateOnly: (value) => String(value || '').slice(0, 10),
        __tmGetTaskAttrHostId: () => task.id,
        __tmSettleTomatoAfterTaskDone: async () => {
            calls.reminderSettle += 1;
            return true;
        },
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
        __tmBuildRecurringInstanceTask: () => ({ id: 'repeatinst:task-1:20260723100000' }),
        __tmRefreshViewsAfterTaskMutation: () => { calls.refresh += 1; },
        __tmTaskMutationBus: {
            publish: (mutation) => calls.projections.push(mutation),
        },
        __tmDispatchTaskAttrPatchUpdated: (_taskId, patch) => calls.broadcasts.push(patch),
        __tmScheduleTaskSnapshotAfterLocalPatch: (_taskId, patch) => calls.snapshots.push(patch),
        hint: () => {},
        console,
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
        tomatoMinutes: 55,
        tomatoHours: 0.92,
        tomatoCount: 3,
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
    assert.equal(first.calls.persist[0].patch.repeatHistory[0].tomatoOccurrenceMinutes, '55');
    assert.equal(first.calls.persist[0].patch.repeatHistory[0].tomatoOccurrenceCount, '3');
    assert.equal(first.calls.persist[0].patch.repeatState.tomatoBaselineMinutes, 55);
    assert.equal(first.calls.reset, 1);
    assert.equal(first.calls.sync, 1);
    assert.equal(first.calls.refresh, 0, 'the composite transaction must not use the legacy view refresh path');
    assert.equal(first.calls.projections.length, 1, 'the recurring transaction must publish one final projection');
    assert.equal(first.calls.projections[0].type, 'taskLifecycle');
    assert.equal(first.calls.projections[0].patch.done, false);
    assert.equal(first.calls.projections[0].patch.completionTime, '2026-07-24');
    assert.equal(first.calls.projections[0].changeSet.structural, true);
    assert.deepEqual(Array.from(first.calls.projections[0].changeSet.upsertedTaskIds), [
        'task-1',
        'repeatinst:task-1:20260723100000',
    ]);
    assert.equal(first.calls.broadcasts.length, 1, 'external field consumers must receive one final patch');
    assert.equal(first.calls.snapshots.length, 1, 'the transaction must persist only its final snapshot');
    assert.equal(first.calls.reminderSettle, 1, 'the current reminder must settle before its task date advances');
    assert.equal(first.calls.persist[0].options.deferProjection, true,
        'intermediate recurring metadata must remain hidden until completion reset succeeds');

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
    assert.equal(resetOnly.calls.reminderSettle, 0,
        'crash recovery after metadata advance must not mark the next reminder occurrence complete');

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

function testDueAdvanceResetsTomatoBaseline() {
    const context = vm.createContext({
        Date,
        __tmNormalizeTaskRepeatRule: (value) => value,
        __tmNormalizeDateOnly: (value) => String(value || '').slice(0, 10),
        __tmNormalizeTaskRepeatState: (value) => ({ occurrenceCount: 1, ...(value || {}) }),
        __tmBuildTaskRepeatAdvancePatch: (task) => ({
            startDate: '2026-08-13',
            completionTime: '2026-08-13',
            repeatState: { ...task.repeatState, occurrenceCount: task.repeatState.occurrenceCount + 1 },
        }),
        __tmBuildTaskTomatoBaselinePatch: (task) => ({
            tomatoBaselineMinutes: Number(task.tomatoMinutes) || 0,
            tomatoBaselineHours: Number(task.tomatoHours) || 0,
            tomatoBaselineCount: Number(task.tomatoCount) || 0,
            tomatoBaselineSet: true,
        }),
    });
    vm.runInContext(`${dueAdvanceFunction}\nthis.buildDueAdvance = __tmBuildTaskRepeatDueAdvancePatch;`, context);
    const patch = context.buildDueAdvance({
        startDate: '2026-08-11',
        completionTime: '2026-08-11',
        tomatoMinutes: 80,
        tomatoHours: 1.33,
        tomatoCount: 4,
        repeatState: { occurrenceCount: 1, tomatoBaselineMinutes: 55, tomatoBaselineHours: 0.92, tomatoBaselineCount: 3 },
    }, { enabled: true, trigger: 'due', type: 'daily' }, { todayKey: '2026-08-13' });
    assert.equal(patch.repeatState.tomatoBaselineMinutes, 80);
    assert.equal(patch.repeatState.tomatoBaselineHours, 1.33);
    assert.equal(patch.repeatState.tomatoBaselineCount, 4);
}

async function testFsrsCompletionUsesTheSameRecoverableTransaction() {
    const completedAt = '2026-07-25T09:00:00.000+08:00';
    const task = {
        id: 'task-fsrs',
        done: true,
        taskCompleteAt: completedAt,
        startDate: '2026-07-25',
        completionTime: '2026-07-25',
        content: 'Review task',
        root_id: 'doc-1',
        repeatRule: { enabled: true, type: 'fsrs', maxOccurrences: 0 },
        repeatState: { occurrenceCount: 1, lastCompletedAt: '', fsrsCard: { due: 'before' } },
        repeatHistory: [],
    };
    const buildFsrsReviewPatch = () => ({
        startDate: '2026-07-28',
        completionTime: '2026-07-28',
        repeatState: { occurrenceCount: 2, lastCompletedAt: completedAt, fsrsCard: { due: 'after' } },
        review: {
            rating: 3,
            beforeCard: { due: 'before' },
            afterCard: { due: 'after' },
        },
    });
    const harness = createAdvanceHarness(task, () => { throw new Error('fixed scheduler must not run'); }, { buildFsrsReviewPatch });
    assert.equal(await harness.advance(task.id, { completedAt, fsrsRating: 3, suppressHint: true }), true);
    assert.equal(harness.calls.persist.length, 1);
    assert.equal(harness.calls.persist[0].patch.repeatHistory[0].rating, 3);
    assert.deepEqual(harness.calls.persist[0].patch.repeatHistory[0].fsrsBefore, { due: 'before' });
    assert.deepEqual(harness.calls.persist[0].patch.repeatHistory[0].fsrsAfter, { due: 'after' });
    assert.equal(harness.calls.reset, 1);

    const ungradedTask = {
        ...task,
        done: true,
        repeatState: { occurrenceCount: 1, lastCompletedAt: '' },
        repeatHistory: [],
    };
    const ungraded = createAdvanceHarness(ungradedTask, () => null, { buildFsrsReviewPatch });
    assert.equal(await ungraded.advance(ungradedTask.id, { completedAt, suppressHint: true }), false);
    assert.equal(ungraded.calls.persist.length, 0);
    assert.equal(ungraded.calls.reset, 0);
}

async function run() {
    testPostCommitDefersRecurringReminderSettlementToAdvance();
    await testCommittedEffectsRewardDoesNotWaitForStaleSqlOrTomato();
    testRecurringInstanceSyncOnlyTouchesLoadedDocuments();
    await testRecurringAdvanceStateMachine();
    await testFsrsCompletionUsesTheSameRecoverableTransaction();
    await testRecurringFailureSchedulesOneFallbackRefresh();
    testDueAdvanceResetsTomatoBaseline();

    const kernel = extractBetween(listSource, 'async function __tmSetDoneKernel(', 'function __tmAutoCompleteGetTaskById(');
    const committedEffects = extractBetween(listSource, 'async function __tmRunCommittedSetDoneEffects(', 'try { globalThis.__tmRunCommittedSetDoneEffects');
    assert.ok(kernel.indexOf('__tmUpdateTaskListItemMarkerWithFallback') < kernel.indexOf('GlobalLock.lock()'));
    assert.ok(kernel.indexOf('__tmUpdateTaskListItemMarkerWithFallback') < kernel.indexOf('fallbackTreeSnapshot = TreeProtector.capture(doc.tasks)'));
    assert.match(advanceFunction, /if \(!alreadyAdvanced\)[\s\S]*__tmSettleTomatoAfterTaskDone[\s\S]*__tmApplyTaskMetaPatchWithUndo/,
        'the current reminder occurrence must settle before recurring task metadata advances');
    assert.match(committedEffects, /if \(!recurringTask\)[\s\S]*__tmSettleTomatoAfterTaskDone/,
        'the recurrence transaction must own reminder settlement even when the series reaches its end');
    const reminderCompletion = extractBetween(
        apiSource,
        'async function __tmMaybeAdvanceRecurringTaskFromReminderRecord(',
        '__tmNs.reminderBridge = {',
    );
    assert.doesNotMatch(reminderCompletion, /__tmAdvanceRecurringTaskAfterCompletion\(/,
        'Tomato completion must not repeat recurrence already owned by tmSetDone effects');
    assert.doesNotMatch(apiSource, /async function __tmApplyTaskStatus\(/,
        'status changes must not keep a second marker-then-attrs writer');
    assert.match(apiSource, /__tmCommitQueuedOp\(op, result\)[\s\S]*__tmBuildSetDoneEffectsOp\(op\)[\s\S]*await __tmRunInTaskWriterContext\([\s\S]*mutation:setDoneEffects/,
        'recurring and reward effects must run only after the core set-done command commits');
    assert.doesNotMatch(recurringSource, /wait:\s*false[\s\S]*task-repeat-advance/);
    assert.doesNotMatch(dueAdvanceFunction, /__advancedCount/,
        'due-trigger reconciliation must pass only writable task fields to the mutation service');
    console.log('task recurring completion transaction tests passed');
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
