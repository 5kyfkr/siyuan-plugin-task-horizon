'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const deleteSourceFile = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', 'task-runtime', '53-list-render-and-document-loader.js'),
    'utf8',
);
const detailMenuSource = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', '30-dialogs-and-ui-foundation.js'),
    'utf8',
);
const start = deleteSourceFile.indexOf('window.tmDelete = async function(');
const end = deleteSourceFile.indexOf('\n    // 任务提醒', start);
assert.ok(start >= 0 && end > start, 'single delete function must remain extractable');
const singleDeleteSource = deleteSourceFile.slice(start, end);

function createHarness(task) {
    const calls = { confirms: [], recurring: [], queued: [], detailRefresh: [], hints: [] };
    const state = {
        flatTasks: { [task.id]: task },
        pendingInsertedTasks: {},
    };
    const window = {};
    const context = vm.createContext({
        state,
        SettingsStore: { data: { taskDeleteMode: 'permanent' } },
        window,
        globalThis: null,
        confirm: () => true,
        showConfirm: async (title, message) => {
            calls.confirms.push({ title, message });
            return true;
        },
        hint: (message, type) => calls.hints.push({ message, type }),
        __tmIsRecurringInstanceTask: (item) => item?.isRecurringInstance === true,
        __tmResolveRecurringInstanceSourceTaskId: (_id, item) => item?.sourceTaskId || '',
        __tmDeleteTaskRepeatHistoryEntry: async (sourceTaskId, completedAt, options) => {
            calls.recurring.push({ sourceTaskId, completedAt, options });
            return true;
        },
        __tmRefreshVisibleTaskDetailForTask: (taskId, options) => {
            calls.detailRefresh.push({ taskId, options });
            return true;
        },
        __tmEnsureEditableTaskLike: () => true,
        __tmCaptureTaskLocalSnapshot: (id) => ({ task: state.flatTasks[id] }),
        __tmCollectTaskTreeIdsForScheduleCleanup: (_task, id) => [id],
        __tmEnqueueQueuedOp: (op, options) => {
            calls.queued.push(op);
            const pending = Promise.resolve(true);
            options?.onPending?.(pending);
            return pending;
        },
        __tmNormalizeTaskDeleteMode: (value) => value === 'recycle' ? 'recycle' : 'permanent',
    });
    context.globalThis = context;
    context.__tmRuntimeState = {
        getTaskById: (id) => state.flatTasks[id] || null,
    };
    context.__tmTaskBoundary = {
        getTask: (id) => state.pendingInsertedTasks[id] || state.flatTasks[id] || null,
    };
    vm.runInContext(singleDeleteSource, context);
    return { remove: context.window.tmDelete, calls };
}

async function testRecurringInstanceDeletesHistoryOnly() {
    const task = {
        id: 'repeatinst:source-1:20260723090000',
        isRecurringInstance: true,
        sourceTaskId: 'source-1',
        recurringCompletedAt: '2026-07-23T09:00:00+08:00',
    };
    const harness = createHarness(task);

    assert.equal(await harness.remove(task.id, { source: 'test-detail-delete' }), true);
    assert.deepEqual(harness.calls.queued, [], 'virtual recurring IDs must never reach the block delete queue');
    assert.equal(harness.calls.recurring.length, 1);
    assert.equal(harness.calls.recurring[0]?.sourceTaskId, task.sourceTaskId);
    assert.equal(harness.calls.recurring[0]?.completedAt, task.recurringCompletedAt);
    assert.equal(harness.calls.recurring[0]?.options?.source, 'test-detail-delete');
    assert.equal(harness.calls.detailRefresh.length, 1);
    assert.equal(harness.calls.detailRefresh[0]?.taskId, task.id);
    assert.equal(harness.calls.detailRefresh[0]?.options?.forceRebuild, true);
    assert.equal(harness.calls.confirms[0]?.title, '删除循环记录');
}

async function testNormalTaskStillUsesBlockDeleteQueue() {
    const task = { id: '20260723000000-normal', root_id: 'doc-1' };
    const harness = createHarness(task);

    assert.equal(await harness.remove(task.id), true);
    assert.deepEqual(harness.calls.recurring, []);
    assert.deepEqual(harness.calls.detailRefresh, []);
    assert.equal(harness.calls.queued.length, 1);
    assert.equal(harness.calls.queued[0]?.type, 'deleteTask');
    assert.equal(harness.calls.queued[0]?.data?.taskId, task.id);
    assert.equal(harness.calls.confirms[0]?.title, '删除任务');
}

assert.match(detailMenuSource, /else if \(isRecurringInstance\) \{[\s\S]*label: '删除记录'[\s\S]*window\.tmDelete\?\.\(tid, \{ source: 'detail-more-repeat-history-delete' \}\)/, 'detail more menu must route recurring records through the shared delete entry');
assert.match(deleteSourceFile, /if \(__tmIsRecurringInstanceTask\(task\)\) \{[\s\S]*删除记录[\s\S]*tmDelete\(taskId, \{ source: 'context-repeat-history-delete' \}\)/, 'context menu must route recurring records through the shared delete entry');

Promise.resolve()
    .then(testRecurringInstanceDeletesHistoryOnly)
    .then(testNormalTaskStillUsesBlockDeleteQueue)
    .then(() => console.log('task recurring single delete tests passed'))
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
