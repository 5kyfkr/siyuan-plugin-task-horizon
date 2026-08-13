'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', '30-dialogs-and-ui-foundation.js'),
    'utf8',
);
const start = source.indexOf('async function __tmBatchDeleteSelectedTasks(');
const end = source.indexOf('\n    async function __tmBatchSetDoneStatus(', start);
assert.ok(start >= 0 && end > start, 'batch delete function must remain extractable');
const batchDeleteSource = source.slice(start, end);
const moreMenuStart = source.indexOf('function __tmOpenMultiSelectMoreMenu(');
const moreMenuEnd = source.indexOf('\n    window.tmMultiSelectToggleMoreMenu', moreMenuStart);
assert.ok(moreMenuStart >= 0 && moreMenuEnd > moreMenuStart, 'multi-select more menu must remain extractable');
const moreMenuSource = source.slice(moreMenuStart, moreMenuEnd);
assert.doesNotMatch(moreMenuSource, /\b__tmBindOutsideCloseHandler\b/,
    'multi-select more menu must not call the removed outside-close helper');
assert.match(moreMenuSource, /__tmScheduleBindOutsideCloseHandler\(closeHandler,\s*\{[\s\S]*ignoreSelector:/,
    'multi-select more menu must use the shared delayed outside-close binding');

function createHarness(tasks, selectedIds) {
    const calls = { normal: [], normalOptions: [], recurring: [], hints: [] };
    const state = {
        flatTasks: Object.fromEntries(tasks.map((task) => [task.id, task])),
        pendingInsertedTasks: {},
        taskTree: [],
        multiSelectedTaskIds: selectedIds.slice(),
        modal: null,
    };
    const context = vm.createContext({
        state,
        SettingsStore: { data: { taskDeleteMode: 'permanent' } },
        window: {},
        confirm: () => true,
        showConfirm: async () => true,
        hint: (message, type) => calls.hints.push({ message, type }),
        __tmGetMultiSelectTargetIds: () => selectedIds.slice(),
        __tmGetTopLevelMultiSelectTaskIds: (ids) => ids.slice(),
        __tmIsRecurringInstanceTask: (task) => task?.isRecurringInstance === true,
        __tmIsCollectedOtherBlockTask: () => false,
        __tmEnsureEditableTaskLike: () => true,
        __tmCaptureTaskLocalSnapshot: (id) => ({ task: state.flatTasks[id] }),
        __tmCollectTaskTreeIdsForScheduleCleanup: (_task, id) => [id],
        __tmNormalizeTaskRepeatHistory: (history) => Array.isArray(history) ? history : [],
        __tmSetMultiSelectedTaskIds: (ids) => { state.multiSelectedTaskIds = ids.slice(); },
        __tmGetMultiSelectedTaskIds: () => state.multiSelectedTaskIds.slice(),
        __tmRefreshMultiSelectUiInPlace: () => true,
        __tmDeleteTaskRepeatHistoryEntry: async (sourceTaskId, completedAt) => {
            calls.recurring.push({ sourceTaskId, completedAt });
            return true;
        },
        __tmScheduleRender: () => {},
        __tmBuildBatchResultHint: (result) => `${result.successCount}/${result.failureCount}`,
        __tmNormalizeTaskDeleteMode: (value) => value === 'recycle' ? 'recycle' : 'permanent',
    });
    context.__tmTaskBoundary = {
        getTask: (id) => state.flatTasks[id] || null,
    };
    context.__tmRequireTaskMutation = (name) => {
        assert.equal(name, 'deleteTask');
        return async (id, options) => {
            calls.normal.push(id);
            calls.normalOptions.push(options);
        };
    };
    vm.runInContext(`${batchDeleteSource}\nthis.batchDelete = __tmBatchDeleteSelectedTasks;`, context);
    return { batchDelete: context.batchDelete, calls, state };
}

async function testMixedBatchRoutesRecurringRecords() {
    const latest = '2026-07-23T10:00:00.000+08:00';
    const older = '2026-07-22T10:00:00.000+08:00';
    const sourceTask = {
        id: 'source-1',
        repeatHistory: [{ completedAt: latest }, { completedAt: older }],
    };
    const recurringOlder = {
        id: 'repeat-old',
        isRecurringInstance: true,
        sourceTaskId: sourceTask.id,
        recurringCompletedAt: older,
    };
    const recurringLatest = {
        id: 'repeat-new',
        isRecurringInstance: true,
        sourceTaskId: sourceTask.id,
        recurringCompletedAt: latest,
    };
    const normalTask = { id: 'task-2', root_id: 'doc-1' };
    const harness = createHarness(
        [sourceTask, recurringOlder, recurringLatest, normalTask],
        [recurringOlder.id, normalTask.id, recurringLatest.id],
    );

    const result = await harness.batchDelete();

    assert.deepEqual(harness.calls.normal, [normalTask.id], 'virtual recurring IDs must not reach the block delete mutation');
    assert.equal(harness.calls.normalOptions[0]?.wait, true, 'batch deletion must settle every permanent writer before reporting completion');
    assert.deepEqual(harness.calls.recurring, [
        { sourceTaskId: sourceTask.id, completedAt: latest },
        { sourceTaskId: sourceTask.id, completedAt: older },
    ], 'records from one series must be deleted newest first');
    assert.equal(result.successCount, 3);
    assert.equal(result.failureCount, 0);
    assert.deepEqual(harness.state.multiSelectedTaskIds, []);
}

async function testDeletingSourceCoversSelectedHistoryRecord() {
    const completedAt = '2026-07-23T10:00:00.000+08:00';
    const sourceTask = {
        id: 'source-1',
        root_id: 'doc-1',
        repeatHistory: [{ completedAt }],
    };
    const recurringTask = {
        id: 'repeat-1',
        isRecurringInstance: true,
        sourceTaskId: sourceTask.id,
        recurringCompletedAt: completedAt,
    };
    const harness = createHarness([sourceTask, recurringTask], [sourceTask.id, recurringTask.id]);

    const result = await harness.batchDelete();

    assert.deepEqual(harness.calls.normal, [sourceTask.id]);
    assert.equal(harness.calls.normalOptions[0]?.wait, true);
    assert.deepEqual(harness.calls.recurring, [], 'deleting the source task already removes its history records');
    assert.equal(result.successCount, 1);
    assert.equal(result.failureCount, 0);
}

Promise.resolve()
    .then(testMixedBatchRoutesRecurringRecords)
    .then(testDeletingSourceCoversSelectedHistoryRecord)
    .then(() => console.log('task recurring batch delete tests passed'))
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
