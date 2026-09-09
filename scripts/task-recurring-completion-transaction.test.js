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

function createAdvanceHarness(task, buildPatch, options = {}) {
    const calls = { persist: [], reset: 0, sync: 0, refresh: 0, viewRefreshes: [], reminderSettle: 0, projections: [], broadcasts: [], snapshots: [], localPatches: [] };
    const context = vm.createContext({
        state: { viewMode: 'list' },
        SettingsStore: {
            data: {
                recurringTaskKeepNativeDoneUntilNextOccurrence: options.keepNativeDone === true,
            },
        },
        window: {},
        __tmWaitForGlobalUnlock: async () => true,
        __tmLogRecurringAdvance: () => {},
        __tmResolveTaskForRepeat: async () => task,
        __tmResolveTaskIdFromAnyBlockId: async (id) => id,
        __tmGetTaskRepeatRule: (value) => value.repeatRule,
        __tmNormalizeTaskRepeatState: (value) => ({ occurrenceCount: 1, lastCompletedAt: '', ...(value || {}) }),
        __tmIsTaskNativeDone: (value) => value?.done === true,
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
        __tmIsRecurringNativeDoneHeld: (value) => value?.repeatState?.pendingNativeDoneReset === true
            && String(value?.taskCompleteAt || '') === String(value?.repeatState?.lastCompletedAt || ''),
        __tmSettleTomatoAfterTaskDone: async () => {
            calls.reminderSettle += 1;
            return true;
        },
        __tmApplyTaskMetaPatchWithUndo: async (_taskId, patch, persistOptions) => {
            calls.persist.push({ patch, options: persistOptions });
            if (options.persistError) throw options.persistError;
            Object.assign(task, patch);
        },
        __tmReassignCompletedScheduleToRecurringInstance: async () => true,
        __tmSyncRecurringInstanceTasks: () => { calls.sync += 1; },
        __tmBuildRecurringInstanceTask: () => ({ id: 'repeatinst:task-1:20260723100000' }),
        __tmRefreshViewsAfterTaskMutation: () => { calls.refresh += 1; },
        __tmScheduleViewRefresh: (detail) => { calls.viewRefreshes.push(detail); },
        __tmTaskMutationBus: {
            apply: (mutation) => calls.projections.push(mutation),
        },
        __tmApplyTaskFieldPatchToLocalMirrors: (taskId, patch) => {
            calls.localPatches.push({ taskId, patch });
            return true;
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
    return { advance: context.advance, calls, context };
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

async function testRecurringAdvanceLiveProjection() {
    const completedAt = '2026-09-07T10:00:00.000+08:00';
    for (const keepNativeDone of [false, true]) {
        for (const rawCompletedAt of ['2026-09-06T10:00:00.000+08:00', '2026-09-07T02:00:00.000Z', '']) {
            const task = {
                id: 'task-1', root_id: 'doc-1', content: 'Daily task', children: [],
                done: true, taskMarker: 'X', task_marker: 'X',
                taskCompleteAt: completedAt, task_complete_at: completedAt,
                'custom-task-complete-at': rawCompletedAt,
                startDate: '2026-09-07', completionTime: '2026-09-07',
                repeatRule: { enabled: true, type: 'daily', maxOccurrences: 0 },
                repeatState: { occurrenceCount: 1, lastCompletedAt: '' }, repeatHistory: [],
            };
            const harness = createAdvanceHarness(task, () => ({
                startDate: '2026-09-08', completionTime: '2026-09-08',
                repeatState: { occurrenceCount: 2, lastCompletedAt: completedAt },
            }), { keepNativeDone });
            const { context, calls } = harness;
            Object.assign(context.state, {
                flatTasks: { [task.id]: task }, pendingInsertedTasks: {}, pendingDeletedTasks: {},
                doneOverrides: {}, taskTree: [{ id: 'doc-1', tasks: [{ ...task }] }],
                filteredTasks: [], otherBlocks: [], collapsedTaskIds: new Set(),
            });
            Object.assign(context, {
                MetaStore: { set() {} },
                setTimeout, clearTimeout, queueMicrotask,
                __TM_CHINA_TZ_OFFSET_MINUTES: 480,
                __TM_CHINA_TZ_SUFFIX: '+08:00',
                __tmParseTimeToTs: (value) => Date.parse(value),
                __tmNormalizeQueueTaskValue: (_key, value) => value,
                __tmIsTaskNativeDone: (value) => value?.taskMarker === 'X',
                __tmInvalidateFilteredTaskDerivedStateCache: () => {},
                __tmIsCollectedOtherBlockTask: () => false,
                __tmBuildTaskCheckboxStyle: () => '',
                esc: (value) => String(value || ''),
            });
            vm.runInContext(read('src/task-horizon/main/32-runtime-state-and-events.js'), context);
            context.__tmTaskStore.acceptAuthoritative([task], { docIds: ['doc-1'] });
            vm.runInContext([
                extractBetween(apiSource, 'function __tmFormatTsToChinaTimezoneIso(', 'function __tmBuildTaskCompleteAtPatch('),
                extractBetween(apiSource, 'function __tmApplyQueuedTaskFieldPatchToTask(', 'function __tmApplyTaskFieldPatchToLocalMirrors('),
                extractBetween(apiSource, 'function __tmApplyTaskFieldPatchToLocalMirrors(', 'function __tmClearInlineLoadingTimer('),
                extractBetween(modelSource, 'function __tmResolveTaskCompletedAtRaw(', 'function __tmFormatTaskCompletedAtTime('),
                extractBetween(modelSource, 'function __tmIsRecurringNativeDoneHeld(', 'function __tmGetRecurringNativeDoneResetDateKey('),
                extractBetween(apiSource, 'function __tmIsTaskDoneEffective(', 'function __tmNormalizeCheckboxStatusBindingValue('),
                extractBetween(modelSource, 'function __tmRenderTaskCheckbox(', 'function __tmRenderTaskCheckboxWrap('),
            ].join('\n'), context);
            context.__tmResolveTaskForRepeat = async () => context.__tmTaskStore.get(task.id);
            const persist = context.__tmApplyTaskMetaPatchWithUndo;
            context.__tmApplyTaskMetaPatchWithUndo = async (taskId, patch, options) => {
                await persist(taskId, patch, options);
                context.__tmApplyTaskFieldPatchToLocalMirrors(taskId, patch);
            };
            context.window.tmSetDone = async (_taskId, _done, _event, options = {}) => {
                calls.reset += 1;
                context.__tmTaskStore.mutateLocal(task.id, (value) => Object.assign(value, {
                    done: false, taskMarker: ' ', task_marker: ' ', taskCompleteAt: '', task_complete_at: '',
                    ...options.additionalPatch,
                }), { includeLists: true });
                return true;
            };
            const rendered = [];
            context.__tmScheduleViewRefresh = (detail) => {
                rendered.push({
                    detail,
                    checkbox: context.__tmRenderTaskCheckbox(task.id, context.__tmTaskStore.get(task.id), { checked: false }),
                    tasks: context.state.taskTree[0].tasks
                        .filter((value) => !context.__tmIsTaskDoneEffective(value))
                        .map((value) => ({ id: value.id, date: value.completionTime })),
                });
            };

            assert.equal(await harness.advance(task.id, { completedAt, suppressHint: true }), true);
            assert.equal(rendered.length, 1);
            assert.doesNotMatch(rendered[0].checkbox, / checked/,
                'the first rendered checkbox must use the next occurrence, not the old confirmed completion');
            assert.equal(context.__tmTaskStore.getProjected(task.id).completionTime, '2026-09-08',
                'the confirmed projection must advance with the local task mirrors');
            assert.deepEqual(rendered[0].tasks, [{ id: task.id, date: '2026-09-08' }],
                'the first refresh must show the unfinished next occurrence: ' + JSON.stringify({ keepNativeDone, rawCompletedAt }));
            assert.equal(context.__tmIsTaskNativeDone(context.__tmTaskStore.get(task.id)), keepNativeDone,
                'the rendered state must not overwrite the native checkbox');
            assert.equal(context.__tmTaskStore.getConfirmed(task.id).done, keepNativeDone,
                'the final projection must preserve native completion in its authoritative task snapshot');
            const confirmedTask = context.__tmTaskStore.getConfirmed(task.id);
            context.__tmTaskStore.acceptAuthoritative([{
                ...confirmedTask,
                'custom-task-complete-at': confirmedTask.taskCompleteAt,
            }], { docIds: ['doc-1'] });
            assert.equal(context.__tmIsTaskDoneEffective(context.__tmTaskStore.getProjected(task.id)), false,
                'an authoritative reload must not turn the next occurrence back into a completed task');
            const advancedTask = context.__tmTaskStore.get(task.id);
            context.__tmTaskMutationBus.apply({
                type: 'taskPatch', phase: 'local', taskId: task.id, patch: { remark: 'Updated after completion' },
            });
            assert.equal(context.__tmIsTaskDoneEffective(advancedTask), false,
                'a subsequent local projection must not restore the old completed state');
            if (keepNativeDone) {
                assert.equal(context.__tmIsRecurringNativeDoneHeld({
                    ...advancedTask, taskCompleteAt: '2026-09-07T02:00:00.000Z',
                }), true, 'equivalent completion timestamps must match across time zones');
                assert.equal(context.__tmIsRecurringNativeDoneHeld({
                    ...advancedTask, taskCompleteAt: undefined, task_complete_at: undefined,
                    'custom-task-complete-at': '2026-09-07T02:00:00.000Z',
                }), true, 'raw-only task records must still recognize the held occurrence');
                assert.equal(context.__tmIsRecurringNativeDoneHeld({ ...advancedTask, taskCompleteAt: '' }), false,
                    'an explicitly cleared completion must not fall back to stale native attributes');
                assert.equal(context.__tmIsRecurringNativeDoneHeld({
                    ...advancedTask, taskCompleteAt: '2026-09-08T10:00:00.000+08:00',
                }), false, 'a new completion must not be mistaken for the previous held occurrence');
            }
            context.__tmClearRecurringTaskAdvanceTimer = () => {};
            context.__tmPurgeRecurringInstanceTasks = () => {};
            context.__tmSetDoneKernel = context.window.tmSetDone;
            vm.runInContext([
                extractBetween(recurringSource, 'function __tmBuildRecurringTaskRollbackPatch(', 'function __tmGetTaskRepeatScheduleSignature('),
                deleteHistoryFunction,
            ].join('\n'), context);
            assert.equal(await context.__tmDeleteTaskRepeatHistoryEntry(task.id, completedAt, {
                resetNativeDone: true, recordUndo: false,
            }), true);
            const rolledBackTask = context.__tmTaskStore.getProjected(task.id);
            assert.equal(rolledBackTask.completionTime, '2026-09-07', 'undo must restore the prior occurrence in the confirmed projection');
            assert.equal(rolledBackTask.repeatState.occurrenceCount, 1);
            assert.equal(rolledBackTask.repeatHistory.length, 0);
            assert.equal(context.__tmIsTaskNativeDone(rolledBackTask), false);
            assert.doesNotMatch(context.__tmRenderTaskCheckbox(task.id, rolledBackTask), / checked/);
        }
    }
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
    assert.equal(first.calls.localPatches.length, 1, 'the next occurrence must enter local mirrors before projection is published');
    assert.equal(first.calls.localPatches[0].patch.done, undefined,
        'local mirrors must preserve the native done marker when the keep-native setting is enabled');
    assert.equal(first.calls.localPatches[0].patch.completionTime, '2026-07-24');
    assert.equal(first.calls.viewRefreshes.length, 1);
    assert.equal(first.calls.viewRefreshes[0].reason, 'task-repeat-advance-final');
    assert.equal(first.calls.viewRefreshes[0].bypassDefer, true);
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

    const heldTask = {
        ...newTask,
        done: true,
        taskCompleteAt: completedAt,
        startDate: '2026-07-23',
        completionTime: '2026-07-23',
        repeatState: { occurrenceCount: 1, lastCompletedAt: '' },
        repeatHistory: [],
    };
    const held = createAdvanceHarness(heldTask, nextPatch, { keepNativeDone: true });
    assert.equal(await held.advance('task-1', { completedAt, suppressHint: true }), true);
    assert.equal(held.calls.persist.length, 1);
    assert.equal(held.calls.persist[0].patch.repeatState.pendingNativeDoneReset, true);
    assert.equal(held.calls.reset, 0, 'enabled mode must preserve the native completed marker');
    assert.equal(heldTask.done, true);
    assert.equal(heldTask.taskCompleteAt, completedAt);
    assert.equal(held.calls.projections.length, 1);
    assert.equal(held.calls.projections[0].patch.done, false,
        'the plugin must project the advanced occurrence as unfinished');
    assert.equal(held.calls.projections[0].patch.completionTime, '2026-07-24');
    assert.equal(held.calls.localPatches.length, 1);
    assert.equal(held.calls.localPatches[0].patch.done, undefined);
    assert.equal(held.calls.localPatches[0].patch.completionTime, '2026-07-24');
    assert.equal(held.calls.viewRefreshes.length, 1);
    assert.equal(held.calls.broadcasts[0].done, undefined,
        'the projected unfinished state must not be broadcast as a persisted native attribute');
    assert.equal(held.calls.broadcasts[0].taskCompleteAt, undefined);

    const mismatchedDuplicateTask = {
        ...newTask,
        done: true,
        taskCompleteAt: completedAt,
        startDate: '2026-07-24',
        completionTime: '2026-07-24',
        repeatState: { occurrenceCount: 2, lastCompletedAt: completedAt, pendingNativeDoneReset: true },
        repeatHistory: [{ completedAt, nextStart: '2026-07-24', nextDue: '2026-07-24' }],
    };
    const mismatchedDuplicate = createAdvanceHarness(mismatchedDuplicateTask, () => {
        throw new Error('a held duplicate must not advance again');
    }, { keepNativeDone: true });
    assert.equal(await mismatchedDuplicate.advance('task-1', {
        completedAt: '2026-07-23T10:00:01.000+08:00',
        suppressHint: true,
    }), false);
    assert.equal(mismatchedDuplicate.calls.persist.length, 0,
        'a held recurring completion must reject a duplicate callback with a different timestamp');

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

async function testRecurringHistoryUndoResetsHeldNativeCompletionInOneTransaction() {
    const completedAt = '2026-07-23T10:00:00.000+08:00';
    const previousCompletedAt = '2026-07-22T10:00:00.000+08:00';
    const task = {
        id: 'task-undo',
        done: true,
        taskCompleteAt: completedAt,
        repeatState: { occurrenceCount: 2, lastCompletedAt: completedAt, pendingNativeDoneReset: true },
        repeatHistory: [
            { completedAt, sourceStart: '2026-07-23', sourceDue: '2026-07-23' },
            { completedAt: previousCompletedAt, sourceStart: '2026-07-22', sourceDue: '2026-07-22' },
        ],
    };
    const calls = { meta: [], reset: [], local: [], purge: [], lifecycle: [], clear: 0 };
    const context = vm.createContext({
        __tmResolveTaskForRepeat: async () => task,
        __tmNormalizeTaskRepeatHistory: (value) => Array.isArray(value) ? value : [],
        __tmBuildRecurringTaskRollbackPatch: () => ({
            startDate: '2026-07-22',
            completionTime: '2026-07-22',
            repeatState: { occurrenceCount: 1, lastCompletedAt: previousCompletedAt, pendingNativeDoneReset: false },
        }),
        __tmClearRecurringTaskAdvanceTimer: () => { calls.clear += 1; },
        __tmIsRecurringNativeDoneHeld: (value) => value?.repeatState?.pendingNativeDoneReset === true
            && value.taskCompleteAt === value.repeatState.lastCompletedAt,
        __tmSetDoneKernel: async (_taskId, done, _event, options) => {
            calls.reset.push(options);
            task.done = done;
            task.taskCompleteAt = done ? (options.additionalPatch.taskCompleteAt || task.taskCompleteAt) : '';
            task.repeatHistory = options.additionalPatch.repeatHistory;
            task.repeatState = options.additionalPatch.repeatState;
            return true;
        },
        __tmApplyTaskMetaPatchWithUndo: async (_taskId, patch, options) => {
            calls.meta.push({ patch, options });
        },
        __tmApplyTaskFieldPatchToLocalMirrors: (_taskId, patch) => {
            calls.local.push(patch);
            return true;
        },
        __tmBuildRecurringInstanceTask: (_task, entry) => ({ id: `repeatinst:task-undo:${entry.completedAt}` }),
        __tmPurgeRecurringInstanceTasks: (_taskId, ids) => { calls.purge.push(ids); },
        __tmTaskMutationBus: { apply: (mutation) => calls.lifecycle.push(mutation) },
    });
    vm.runInContext(`${deleteHistoryFunction}\nthis.deleteHistory = __tmDeleteTaskRepeatHistoryEntry;`, context);

    assert.equal(await context.deleteHistory(task.id, completedAt, {
        source: 'test-recurring-undo',
        recordUndo: true,
        resetNativeDone: true,
    }), true);
    assert.equal(calls.clear, 1, 'undoing the active occurrence must cancel any queued advance');
    assert.equal(calls.meta.length, 0, 'native reset and history rollback must share one set-done transaction');
    assert.equal(calls.reset.length, 1);
    assert.equal(calls.reset[0].previousDone, true);
    assert.equal(calls.reset[0].recordUndo, true);
    assert.equal(calls.reset[0].additionalPatch.repeatHistory.length, 1);
    assert.equal(task.done, false);
    assert.equal(task.taskCompleteAt, '');
    assert.equal(calls.local.length, 1);
    assert.equal(calls.lifecycle.length, 1);
    assert.deepEqual(calls.lifecycle[0].patch.repeatHistory, task.repeatHistory);
    assert.deepEqual(JSON.parse(JSON.stringify(calls.purge)), [['2026-07-23T10:00:00.000+08:00']]);
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
    const calls = { reset: 0, reconcile: 0 };
    const context = vm.createContext({
        window: {},
        __tmResolveTaskForRepeat: async () => task,
        __tmNormalizeTaskRepeatState: (value) => ({ occurrenceCount: 1, pendingNativeDoneReset: false, ...(value || {}) }),
        __tmGetTaskRepeatRule: (value) => value.repeatRule,
        __tmIsTaskNativeDone: (value) => value?.taskMarker !== ' ',
        __tmIsRecurringNativeDoneHeld: (value) => value?.repeatState?.pendingNativeDoneReset === true
            && value.repeatState.lastCompletedAt === value.taskCompleteAt,
        __tmGetRecurringNativeDoneResetDateKey: () => '2026-07-24',
        __tmNormalizeDateOnly: (value) => String(value || '').slice(0, 10),
        __tmApplyTaskMetaPatchWithUndo: async (_taskId, patch) => {
            calls.reconcile += 1;
            task.repeatState = patch.repeatState;
        },
    });
    context.window.tmSetDone = async (_taskId, done, _event, options) => {
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

async function testRecurringNativeDoneResetStaysAtUncompletedOccurrence() {
    const task = {
        id: 'task-catch-up',
        done: true,
        taskMarker: 'X',
        taskCompleteAt: '2026-07-23T10:00:00.000+08:00',
        startDate: '2026-07-24',
        completionTime: '2026-07-24',
        repeatRule: { enabled: true, trigger: 'due', type: 'daily' },
        repeatState: { lastCompletedAt: '2026-07-23T10:00:00.000+08:00', pendingNativeDoneReset: true },
    };
    const calls = [];
    let nativeDoneHeld = true;
    const context = vm.createContext({
        window: {},
        __tmResolveTaskForRepeat: async () => ({ ...task }),
        __tmNormalizeTaskRepeatState: (value) => ({ pendingNativeDoneReset: false, ...(value || {}) }),
        __tmNormalizeDateOnly: (value) => String(value || '').slice(0, 10),
        __tmResetRecurringNativeDoneIfDue: async () => true,
        __tmGetTaskRepeatRule: () => task.repeatRule,
        __tmIsTaskNativeDone: (value) => value?.taskMarker !== ' ',
        __tmIsRecurringNativeDoneHeld: () => nativeDoneHeld,
        __tmGetRecurringNativeDoneResetDateKey: () => '2026-07-24',
        __tmApplyTaskMetaPatchWithUndo: async (_id, patch) => { calls.push(patch); return { changed: true }; },
    });
    vm.runInContext(`${resetNativeDoneSweepRuntime.replace(/let __tmRecurringDueReconcilePromise = null;[\s\S]*$/, '')}\n${extractBetween(recurringSource, 'let __tmRecurringDueReconcilePromise = null;', 'window.tmGetTaskRepeatRule = async function')}
this.reconcile = __tmReconcileRecurringTasksOnLoad;`, context);
    const changed = await context.reconcile(['task-catch-up'], { todayKey: '2026-07-26' });
    assert.equal(changed, 1, 'resetting a held completion must not advance an uncompleted next occurrence');
    assert.equal(calls.length, 0, 'an overdue incomplete occurrence must not persist a due catch-up patch');
    nativeDoneHeld = false;
    task.done = false;
    task.taskMarker = ' ';
    const reconciledOnly = await context.reconcile(['task-catch-up'], { todayKey: '2026-07-26' });
    assert.equal(reconciledOnly, 1, 'an inconsistent pending flag must be reconciled without advancing the occurrence');
    assert.equal(calls.length, 0, 'state-only reconciliation must not persist a due catch-up patch');
    assert.equal(task.startDate, '2026-07-24');
    assert.equal(task.completionTime, '2026-07-24');
}

async function testRecurringLoadAdvancesNewCompletionAfterClearingStaleHold() {
    const previousCompletedAt = '2026-09-08T00:55:14.293+08:00';
    const completedAt = '2026-09-08T00:55:56.378+08:00';
    for (const keepNativeDone of [false, true]) {
        const task = {
            id: 'task-recovered', done: true, taskMarker: 'X', taskCompleteAt: completedAt,
            startDate: '', completionTime: '2026-09-11',
            repeatRule: { enabled: true, type: 'daily', trigger: 'complete' },
            repeatState: { occurrenceCount: 4, lastCompletedAt: previousCompletedAt, pendingNativeDoneReset: true },
            repeatHistory: [{ completedAt: previousCompletedAt }],
        };
        const harness = createAdvanceHarness(task, () => ({
            startDate: '', completionTime: '2026-09-12',
            repeatState: { occurrenceCount: 5, lastCompletedAt: completedAt },
        }), { keepNativeDone });
        Object.assign(harness.context, {
            __tmAdvanceRecurringTaskAfterCompletion: harness.advance,
            __tmGetRecurringNativeDoneResetDateKey: () => '2026-09-12',
        });
        vm.runInContext([
            resetNativeDoneFunction,
            extractBetween(recurringSource, 'let __tmRecurringDueReconcilePromise = null;', 'window.tmGetTaskRepeatRule = async function'),
        ].join('\n'), harness.context);
        const changed = await harness.context.__tmReconcileRecurringTasksOnLoad([task.id], { todayKey: '2026-09-08' });
        assert.equal(changed, 2, 'one reload must both clear the stale hold and advance the newly completed occurrence');
        assert.equal(task.completionTime, '2026-09-12');
        assert.equal(task.repeatState.occurrenceCount, 5);
        assert.equal(task.repeatHistory.length, 2);
        assert.equal(task.repeatHistory[0].completedAt, completedAt);
        assert.equal(task.repeatHistory[0].sourceDue, '2026-09-11');
        assert.equal(task.done, keepNativeDone);
        assert.equal(task.repeatState.pendingNativeDoneReset, keepNativeDone);
        assert.equal(harness.calls.projections.length, 1);
        assert.equal(harness.calls.projections[0].patch.done, false);
    }
}

async function testRecurringLoadDistinguishesCompletionTimestampDrift() {
    const completedAt = '2026-09-07T09:00:00.000+08:00';
    const cases = [
        { timestamp: completedAt, duplicate: true },
        { timestamp: '2026-09-07T09:00:00.034+08:00', duplicate: true },
        { timestamp: '2026-09-07T01:00:00.034Z', duplicate: true },
        { timestamp: '2026-09-07T09:00:01.001+08:00', duplicate: false },
        { timestamp: '2026-09-07T08:59:59.999+08:00', duplicate: false },
        { timestamp: '2026-09-07T18:00:00.000+08:00', duplicate: false },
        { timestamp: '2026-09-08T09:00:00.000+08:00', duplicate: false },
    ];
    const reconcileRuntime = extractBetween(recurringSource,
        'let __tmRecurringDueReconcilePromise = null;', 'window.tmGetTaskRepeatRule = async function');
    for (const entry of cases) {
        const task = {
            id: 'task-recovered', done: true, taskCompleteAt: entry.timestamp,
            startDate: '2026-09-08', completionTime: '2026-09-08',
            repeatRule: { enabled: true, type: 'daily', trigger: 'complete', maxOccurrences: 0 },
            repeatState: { occurrenceCount: 2, lastCompletedAt: completedAt, pendingNativeDoneReset: false },
            repeatHistory: [{ completedAt }],
        };
        const harness = createAdvanceHarness(task, () => ({
            startDate: '2026-09-09', completionTime: '2026-09-09',
            repeatState: { occurrenceCount: 3, lastCompletedAt: entry.timestamp },
        }));
        harness.context.__tmAdvanceRecurringTaskAfterCompletion = harness.advance;
        vm.runInContext(reconcileRuntime, harness.context);
        await harness.context.__tmReconcileRecurringTasksOnLoad([task.id], { todayKey: '2026-09-08' });
        assert.equal(harness.calls.persist.length, entry.duplicate ? 0 : 1, entry.timestamp);
        assert.equal(task.repeatHistory.length, entry.duplicate ? 1 : 2, entry.timestamp);
        assert.equal(task.repeatState.occurrenceCount, entry.duplicate ? 2 : 3, entry.timestamp);
        assert.equal(task.completionTime, entry.duplicate ? '2026-09-08' : '2026-09-09', entry.timestamp);
        assert.equal(task.done, false, 'completion reset must not discard a distinct occurrence');
        assert.equal(task.repeatHistory[0].completedAt, entry.duplicate ? completedAt : entry.timestamp);
    }
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

async function testOverdueRecurringTasksWaitForCompletion() {
    const modelHelpers = extractBetween(modelSource,
        'function __tmParseTaskRepeatJson', 'function __tmGetTaskRepeatWeekdayLabel');
    for (const trigger of ['due', 'complete']) {
        for (const dates of [
            { startDate: '2026-06-08', completionTime: '2026-06-08' },
            { startDate: '', completionTime: '2026-06-08' },
            { startDate: '2026-06-08', completionTime: '' },
        ]) {
            const task = {
                id: 'task-overdue-monthly', done: false, taskCompleteAt: '',
                ...dates,
                repeatRule: { enabled: true, trigger, type: 'monthly', every: 1, anchorDate: '2026-06-08', maxOccurrences: 3 },
                repeatState: { occurrenceCount: 1, lastCompletedAt: '', tomatoBaselineMinutes: 55, tomatoBaselineHours: 0.92, tomatoBaselineCount: 3, tomatoBaselineSet: true },
                repeatHistory: [], tomatoMinutes: 80, tomatoHours: 1.33, tomatoCount: 4,
            };
            const harness = createAdvanceHarness(task, () => { throw new Error('must use real repeat date helpers'); });
            vm.runInContext(modelHelpers, harness.context);
            harness.context.__tmAdvanceRecurringTaskAfterCompletion = harness.advance;
            vm.runInContext(reconcileRuntime, harness.context);
            const beforeLoad = JSON.stringify(task);
            for (const todayKey of ['2026-06-08', '2026-06-09', '2026-09-09', '2026-09-09']) {
                assert.equal(await harness.context.__tmReconcileRecurringTasksOnLoad([task.id], { todayKey }), 0);
                assert.equal(JSON.stringify(task), beforeLoad, 'reloads must preserve the incomplete occurrence, history, count and focus baseline');
            }
            const completedAt = '2026-09-09T09:00:00.000+08:00';
            assert.equal(await harness.advance(task.id, { completedAt }), false, 'a completion timestamp alone must not advance an unchecked task');
            assert.equal(harness.calls.persist.length, 0);
            assert.equal(harness.calls.reset, 0);
            assert.equal(harness.calls.reminderSettle, 0);
            task.done = true;
            task.taskCompleteAt = completedAt;
            assert.equal(await harness.context.__tmReconcileRecurringTasksOnLoad([task.id], { todayKey: '2026-09-09' }), 1,
                'a committed completion must advance both due and complete rules');
            assert.equal(task.startDate, dates.startDate ? '2026-07-08' : '');
            assert.equal(task.completionTime, dates.completionTime ? '2026-07-08' : '');
            assert.equal(task.repeatRule.trigger, trigger, 'completion must preserve the configured repeat rule');
            assert.equal(task.repeatState.occurrenceCount, 2, 'one completion must advance only one occurrence even when several months overdue');
            assert.equal(task.repeatHistory.length, 1);
            assert.equal(task.repeatHistory[0].sourceDue, dates.completionTime);
            assert.equal(task.repeatHistory[0].sourceStart, dates.startDate);
            assert.equal(task.repeatHistory[0].completedAt, completedAt);
            assert.equal(task.repeatState.tomatoBaselineMinutes, 80);
            assert.equal(task.repeatState.tomatoBaselineHours, 1.33);
            assert.equal(task.repeatState.tomatoBaselineCount, 4);
            assert.equal(task.done, false);
            assert.equal(harness.calls.persist.length, 1);
            assert.equal(harness.calls.reset, 1);
            const afterCompletion = JSON.stringify(task);
            for (const todayKey of ['2026-09-09', '2026-09-10']) {
                assert.equal(await harness.context.__tmReconcileRecurringTasksOnLoad([task.id], { todayKey }), 0);
                assert.equal(JSON.stringify(task), afterCompletion, 'the next overdue occurrence must wait for its own completion');
            }
            assert.equal(harness.calls.persist.length, 1, 'reloads must not consume the remaining occurrence count');
        }
    }
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
    await testQueuedCompletionPreservesTimestamp();
    await testRecurringAdvanceLiveProjection();
    testPostCommitDefersRecurringReminderSettlementToAdvance();
    await testCommittedEffectsRewardDoesNotWaitForStaleSqlOrTomato();
    testRecurringInstanceSyncOnlyTouchesLoadedDocuments();
    await testRecurringAdvanceStateMachine();
    await testRecurringHistoryUndoResetsHeldNativeCompletionInOneTransaction();
    await testRecurringNativeDoneResetIsDateBoundAndIdempotent();
    await testRecurringNativeDoneResetStaysAtUncompletedOccurrence();
    await testRecurringLoadAdvancesNewCompletionAfterClearingStaleHold();
    await testRecurringLoadDistinguishesCompletionTimestampDrift();
    await testRecurringNativeDoneResetSweepRunsOncePerLocalDay();
    await testFsrsCompletionUsesTheSameRecoverableTransaction();
    await testRecurringFailureSchedulesOneFallbackRefresh();
    await testOverdueRecurringTasksWaitForCompletion();

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
    assert.match(apiSource, /advanceHintSuppressed: data\.advanceHintSuppressed === true/,
        'the queued completion must preserve whether the user explicitly requested silent follow-up effects');
    assert.match(committedEffects, /suppressHint: opts\.advanceHintSuppressed === true/,
        'a normal recurring completion must show the advance hint after the committed transaction');
    assert.doesNotMatch(recurringSource, /wait:\s*false[\s\S]*task-repeat-advance/);
    assert.doesNotMatch(recurringSource, /__tmBuildTaskRepeatDueAdvancePatch|__tmRecurringDueReconcileMemo|task-repeat-due/,
        'recurring tasks must not retain an automatic due-advance path');
    console.log('task recurring completion transaction tests passed');
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
