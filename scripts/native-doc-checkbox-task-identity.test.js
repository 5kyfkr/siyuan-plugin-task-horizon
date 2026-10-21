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
        __tmIsCheckinTask: () => false,
        __tmGetTaskOccurrenceId: () => 'captured-round',
        __tmApplyNativeDocCheckboxDomProjection: (...args) => calls.projections.push(args),
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
        __tmRequireTaskMutation: () => async (id, value, mutationOptions) => {
            if (options.writeError) throw new Error('write unavailable');
            calls.writes.push({ id, done: value, patch: typeof value === 'object' ? value : mutationOptions.statusPatch, options: { ...mutationOptions } });
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
        const h = createHarness({ blockType });
        assert.equal(await h.sync(), false);
        assertSkipped(h);
    }
    for (const options of [{ cached: true }, { readError: true }]) {
        const h = createHarness(options);
        assert.equal(await h.sync(), false);
        assertSkipped(h);
    }
    const deleted = createHarness();
    deleted.blocks.clear();
    assert.equal(await deleted.sync(), false);
    assertSkipped(deleted);
    for (const marker of [' ', '/', 'X', '-', '?']) {
        const done = marker === 'X' || marker === '?';
        const h = createHarness({ exists: true, domDone: done, marker,
            previousState: { previousDone: false, previousMarker: '/', occurrenceId: 'clicked-round' } });
        assert.equal(await h.sync(), true);
        assert.equal(h.calls.writes.length, 1, 'native intent enters the shared writer once');
        const write = h.calls.writes[0];
        assert.equal(write.id, h.taskID);
        assert.equal(write.done, done);
        assert.equal(write.options.nativeObserved.targetMarker, marker);
        assert.equal(write.options.nativeObserved.previousDone, false);
        assert.equal(write.options.occurrenceId, 'clicked-round');
        assert.equal(write.options.fsrsRating, 3);
        assert.equal(write.options.wait, true);
        assert.equal(h.calls.advances.length, 0, 'the adapter must not schedule another advance');
        assert.equal(h.calls.rollbacks.length, 0, 'the adapter must not independently roll back history');
    }
    const echo = createHarness({ exists: true, domDone: true, previousState: { userInitiated: false } });
    await echo.sync();
    assert.equal(echo.calls.writes.length, 0, 'synchronization echoes must not create completion commands');
    const failed = createHarness({ exists: true, domDone: false, writeError: true,
        task: { repeatState: { pendingNativeDoneReset: true } }, previousState: { previousDone: true, previousMarker: 'X' } });
    await assert.rejects(failed.sync(), /write unavailable/);
    assert.equal(failed.calls.projections.length, 0, 'failed rollback cannot publish a successful final projection');
    const wrapper = createHarness({ exists: true, blockType: 'l', blockID: '20260908090000-list001' });
    assert.equal(await wrapper.sync(), true);
    assert.equal(wrapper.calls.writes[0].id, wrapper.taskID);
    const delayed = createHarness();
    assert.equal(await delayed.sync(), false);
    delayed.tasks.set(delayed.taskID, delayed.task);
    assert.equal(await delayed.sync(), true);
    console.log('native task identity and shared completion ingress tests passed');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
