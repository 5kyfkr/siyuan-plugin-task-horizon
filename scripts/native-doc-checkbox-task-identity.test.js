'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', 'src', 'task-horizon', 'main');
const nativeSource = fs.readFileSync(path.join(root, 'shell', '72-shell-entrances-and-native-doc-hooks.js'), 'utf8');
const listSource = fs.readFileSync(path.join(root, 'task-runtime', '53-list-render-and-document-loader.js'), 'utf8');
const completedAt = '2026-09-08T10:00:00+08:00';

function segment(source, start, end) {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, `missing source segment: ${start}`);
    return source.slice(from, to);
}

function createHarness(options = {}) {
    const taskID = '20260908090000-task001';
    const blockID = options.blockID || taskID;
    const tasks = new Map();
    const blocks = new Map([[blockID, { id: blockID, type: options.blockType || 'p', parent_id: '' }]]);
    const calls = { reads: [], writes: [], mirrors: [], projections: [], retries: [], errors: [], synthesized: [], advances: [], rollbacks: [] };
    let syncVersion = 0;
    const task = { id: taskID, root_id: '20260908090000-doc0001', done: false, customStatus: '', ...(options.task || {}) };
    if (options.exists) tasks.set(taskID, task);
    const context = vm.createContext({
        API: {
            async getTaskById(id) {
                calls.reads.push(id);
                if (options.readError) throw new Error('read unavailable');
                return tasks.has(id) ? { ...tasks.get(id) } : null;
            },
            async getBlocksByIds(ids) {
                return ids.map((id) => blocks.get(id)).filter(Boolean);
            },
            async getTaskIdsInList() {
                return Array.from(tasks.keys());
            },
        },
        SettingsStore: { data: { customStatusOptions: [] } },
        __tmTaskBoundary: { getTask: () => options.cached ? { ...task } : null },
        __tmResolveLocalTaskBindingFromAnyBlockId: () => options.cached
            ? { taskId: taskID, task: { ...task } }
            : null,
        __tmBuildTaskLikeFromBlockId: async (id) => {
            calls.synthesized.push(id);
            return { ...task, id };
        },
        __tmBumpNativeDocCheckboxReconcileVersion: () => ++syncVersion,
        __tmIsNativeDocCheckboxReconcileVersionCurrent: (id, version) => version === syncVersion,
        __tmFlushSqlTransactionsSafe: async () => {},
        __tmReadNativeDocTaskDoneFromDom: () => options.domDone ?? false,
        __tmReadNativeDocTaskMarkerFromDom: () => options.marker || (options.domDone ? 'X' : ' '),
        __tmResolveTaskStatusId: (task) => ({ ' ': 'todo', X: 'completed', '/': 'doing', '-': 'cancelled', '?': 'custom' }[task.taskMarker]),
        __tmFindStatusOptionById: (id) => ({ marker: ({ todo: ' ', completed: 'X', doing: '/', cancelled: '-', custom: '?' })[id] }),
        __tmResolveTaskMarker: (task) => task.taskMarker || (task.done ? 'X' : ' '),
        __tmIsTaskMarkerClosed: (marker) => marker !== ' ' && marker !== '/',
        __tmNormalizeTaskRepeatState: (value) => value || {},
        __tmBuildTaskMarkdownWithMarker: (task, marker) => `* [${marker}] Task`,
        __tmWasNativeDocCheckboxRecentlySynced: () => false,
        __tmConsumeNativeDocCheckboxPreviousState: () => ({ previousDone: false, userInitiated: true, ...(options.previousState || {}) }),
        __tmIsRecurringNativeDoneHeld: (value) => value.repeatState?.pendingNativeDoneReset === true && value.taskMarker === 'X',
        __tmDeleteTaskRepeatHistoryEntry: async (...args) => { calls.rollbacks.push(args); return false; },
        __tmScheduleRecurringTaskAdvanceAfterCompletion: (...args) => calls.advances.push(args),
        __tmConsumeNativeDocCheckboxInsertedBlock: () => false,
        normalizeTaskFields: () => {},
        __tmResolveNativeDocCheckboxAttrHostIdFromDom: (id, resolvedTaskID) => resolvedTaskID,
        __tmGetTaskAttrHostId: (value) => value.id,
        __tmMarkNativeDocCheckboxSyncedState: () => {},
        __tmResolveCheckboxLinkedStatusId: (done) => done ? 'completed' : 'todo',
        __tmDoesStatusIdResolveToDone: (status) => status === 'completed',
        __tmReadDocCheckboxBlockAttrs: async () => ({ status: options.persistedStatus || '', taskCompleteAt: options.persistedCompleteAt || '' }),
        __tmHasRecentNativeDocCheckboxStructuralChange: () => false,
        __tmShouldApplyUndoneStatusFallback: () => true,
        __tmBuildTaskCompleteAtPatch: () => ({ taskCompleteAt: completedAt }),
        __tmNormalizeTaskCompleteAtValue: (value) => String(value || '').trim(),
        __tmMirrorNativeDocTaskStatusAttr: (...args) => calls.mirrors.push(args),
        __tmApplyNativeDocCheckboxLocalState: (...args) => calls.projections.push(args),
        __tmScheduleNativeDocCheckboxStatusReconcile: (...args) => calls.retries.push(args),
        __tmRequireTaskMutation: () => async (id, patch, mutationOptions) => {
            calls.writes.push({ id, patch: { ...patch }, options: { ...mutationOptions } });
            return true;
        },
        __tmReportTaskMutationFailure: (error) => calls.errors.push(error),
    });
    vm.runInContext(segment(listSource,
        'async function __tmResolveTaskBindingFromAnyBlockId(',
        'async function __tmBuildTaskLikeFromBlockId('), context);
    vm.runInContext(segment(nativeSource,
        'async function __tmSyncNativeDocCheckboxLinkedStatus(',
        'function __tmDrainNativeDocCheckboxSyncQueue('), context);
    vm.runInContext(segment(nativeSource,
        'async function __tmReconcileNativeDocCheckboxStatus(',
        'function __tmScheduleNativeDocCheckboxStatusReconcile('), context);
    return {
        taskID, blockID, task, tasks, blocks, calls,
        sync: () => context.__tmSyncNativeDocCheckboxLinkedStatus(blockID),
        reconcile: () => context.__tmReconcileNativeDocCheckboxStatus(blockID, taskID,
            { customStatus: options.domDone ? 'completed' : 'todo' }, options.domDone ?? false, syncVersion),
    };
}

function assertSkipped(harness) {
    for (const key of ['writes', 'mirrors', 'projections', 'retries', 'errors', 'synthesized']) {
        assert.equal(harness.calls[key].length, 0, `non-task block must not trigger ${key}`);
    }
}

async function main() {
    for (const blockType of ['d', 'p', 'l', 'i']) {
        const harness = createHarness({ blockType });
        assert.equal(await harness.sync(), false, `ordinary ${blockType} block must not be synchronized as a task`);
        assertSkipped(harness);
    }

    for (const options of [{ cached: true }, { readError: true }]) {
        const harness = createHarness(options);
        assert.equal(await harness.sync(), false, 'cached or unreadable blocks must not be treated as confirmed tasks');
        assertSkipped(harness);
    }

    const missing = createHarness();
    missing.blocks.clear();
    assert.equal(await missing.sync(), false, 'a deleted block must not be synthesized into a task');
    assertSkipped(missing);

    for (const domDone of [false, true]) {
        const harness = createHarness({ exists: true, domDone });
        assert.equal(await harness.sync(), true, 'uncached native tasks must still synchronize');
        assert.equal(harness.calls.writes.length, 1);
        assert.equal(harness.calls.writes[0].id, harness.taskID);
        assert.equal(harness.calls.writes[0].patch.customStatus, domDone ? 'completed' : 'todo');
        if (domDone) assert.equal(harness.calls.writes[0].patch.taskCompleteAt, completedAt);
        assert.equal(harness.calls.synthesized.length, 0);
        assert.equal(harness.calls.errors.length, 0);
        assert.equal(harness.calls.retries.length, 0);
    }

    for (const marker of ['/', '-']) {
        const repeatState = { pendingNativeDoneReset: true, completedCount: 4, lastCompletedAt: completedAt, tomatoBaselineMinutes: 25 };
        const harness = createHarness({ exists: true, marker, task: { repeatState, repeatHistory: [{ completedAt }] } });
        assert.equal(await harness.sync(), true);
        assert.equal(harness.calls.writes[0].patch.customStatus, marker === '/' ? 'doing' : 'cancelled');
        assert.equal(harness.calls.writes[0].patch.taskCompleteAt, marker === '-' ? completedAt : undefined,
            'cancellation stamps its completed-group time while progress remains untimed');
        assert.equal(harness.calls.writes[0].patch.repeatState.pendingNativeDoneReset, false);
        assert.equal(harness.calls.writes[0].patch.repeatState.completedCount, 4);
        assert.equal(harness.calls.writes[0].patch.repeatState.tomatoBaselineMinutes, 25);
        assert.equal(harness.calls.writes[0].patch.repeatHistory, undefined, 'must not rewrite past rounds');
        assert.equal(harness.calls.projections[0][1], false);
        assert.equal(harness.calls.projections[0][5].marker, marker);
        assert.equal(harness.calls.advances.length, 0);
        assert.equal(harness.calls.rollbacks.length, 0);
    }

    const explicitUncheck = createHarness({ exists: true,
        task: { taskMarker: 'X', taskCompleteAt: completedAt, repeatState: { pendingNativeDoneReset: true, lastCompletedAt: completedAt } },
        previousState: { previousDone: true, previousMarker: 'X' },
    });
    await explicitUncheck.sync();
    assert.equal(explicitUncheck.calls.rollbacks.length, 1, 'native X → space still explicitly rolls back held completion');
    const completeProgress = createHarness({ exists: true, marker: 'X', domDone: true, previousState: { previousDone: false, previousMarker: '/' } });
    await completeProgress.sync();
    assert.equal(completeProgress.calls.writes[0].patch.taskCompleteAt, completedAt);
    assert.equal(completeProgress.calls.advances.length, 1, '/ → X may advance only after becoming completed');

    for (const beforeMarker of [' ', '/', 'X', '?']) {
        const cancel = createHarness({ exists: true, marker: '-',
            task: { taskMarker: beforeMarker, taskCompleteAt: '2026-09-01T10:00:00+08:00' },
            previousState: { previousMarker: beforeMarker, previousDone: beforeMarker === 'X' || beforeMarker === '?' },
        });
        assert.equal(await cancel.sync(), true);
        assert.equal(cancel.calls.writes[0].patch.taskCompleteAt, completedAt, `${beforeMarker} -> - must stamp the transition time`);
        assert.equal(cancel.calls.advances.length, 0, 'canceling never advances recurrence');
    }
    for (const marker of [' ', '/']) {
        const resume = createHarness({ exists: true, marker,
            task: { taskMarker: '-', taskCompleteAt: completedAt },
            previousState: { previousMarker: '-', taskCompleteAt: completedAt },
        });
        assert.equal(await resume.sync(), true);
        assert.equal(resume.calls.writes[0].patch.taskCompleteAt, '', '- -> unfinished must clear completed-group time');
        assert.equal(resume.calls.advances.length, 0);
    }
    const duplicateCancel = createHarness({ exists: true, marker: '-', persistedStatus: 'cancelled', persistedCompleteAt: completedAt,
        task: { taskMarker: '-', customStatus: 'cancelled', taskCompleteAt: completedAt },
        previousState: { previousMarker: '-', status: 'cancelled', taskCompleteAt: completedAt },
    });
    assert.equal(await duplicateCancel.sync(), true);
    assert.equal(duplicateCancel.calls.writes.length, 0, 'repeated native synchronization must preserve the original cancellation time');
    const customComplete = createHarness({ exists: true, marker: '?', domDone: true, previousState: { previousMarker: '/' } });
    assert.equal(await customComplete.sync(), true);
    assert.equal(customComplete.calls.writes[0].patch.taskCompleteAt, completedAt, 'other nonblank markers also receive completion time');

    const wrapper = createHarness({ exists: true, blockType: 'l', blockID: '20260908090000-list001' });
    assert.equal(await wrapper.sync(), true);
    assert.equal(wrapper.calls.writes[0].id, wrapper.taskID, 'list wrappers must resolve to the actual task item');
    assert.equal(wrapper.calls.writes[0].options.attrTargetId, wrapper.taskID);

    const delayed = createHarness();
    assert.equal(await delayed.sync(), false);
    delayed.tasks.set(delayed.taskID, delayed.task);
    assert.equal(await delayed.sync(), true, 'a task that becomes available later must not remain excluded');
    assert.equal(delayed.calls.writes.length, 1);

    const removed = createHarness({ exists: true });
    assert.equal(await removed.sync(), true);
    removed.tasks.clear();
    assert.equal(await removed.reconcile(), false, 'reconciliation must stop when the task no longer exists');
    assert.equal(removed.calls.writes.length, 1, 'a deleted task must not be written again by reconciliation');
    assert.equal(removed.calls.mirrors.length, 1, 'a deleted task must not have its DOM status mirrored again');

    const surviving = createHarness({ exists: true });
    assert.equal(await surviving.reconcile(), true, 'existing task attributes must still be reconciled');
    assert.equal(surviving.calls.writes.length, 1);
    assert.equal(surviving.calls.writes[0].options.source, 'native-doc-checkbox-reconcile');

    console.log('native document checkbox task identity tests passed');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
