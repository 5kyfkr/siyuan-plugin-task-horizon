'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const createSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53b-task-create-and-quick-add-runtime.js'), 'utf8');
const editSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53a-list-field-edit-runtime.js'), 'utf8');

function segment(source, start, end) {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, 'Missing source segment: ' + start);
    return source.slice(from, to);
}

const runtime = [
    segment(editSource, '    function __tmResolveTaskForCardEdit(', '    window.tmSetTaskPriority'),
    segment(createSource, '    function __tmUpsertLocalTask(', '    function __tmGenerateTempTaskId('),
    segment(createSource, '    function __tmResolveOptimisticTaskForLocalUse(', '    function __tmInsertTaskIntoDocLocal('),
    segment(createSource, '    async function __tmCreateSubtaskForTaskKernel(', '    async function __tmCreateTaskInDoc('),
    segment(createSource, '    function __tmQueueCreateSubtask(', '    function __tmQueueCreateTaskInDoc('),
    segment(createSource, '    function __tmQueueCreateSiblingTask(', '    let __tmQuickbarScheduledRefreshTimer'),
].join('\n');

function createHarness() {
    const active = { id: 'active', docId: 'doc-a', parent_id: 'list-a', children: [], content: '当前任务' };
    const child = { id: 'foreign-child', docId: 'doc-b', parent_id: 'child-list', parentTaskId: 'foreign', level: 1 };
    const foreign = { id: 'foreign', docId: 'doc-b', parent_id: 'list-b', children: [child], priority: 'high', startDate: '2026-09-14' };
    const pending = new Map();
    const hints = [];
    const operations = [];
    const writes = [];
    const prompts = [];
    const invalidations = [];
    const deleted = new Set();
    const blocks = new Map([active, foreign, child].map((task) => [task.id, { ...task, root_id: task.docId, type: 'i', subtype: 't' }]));
    let sequence = 0;
    let context;
    const sandbox = {
        state: { filteredTasks: [active], flatTasks: { active }, taskTree: [{ id: 'doc-a', tasks: [active] }], collapsedTaskIds: new Set() },
        __tmTaskBoundary: { getTask: (id) => id === 'active' ? active : pending.get(id) },
        __tmTaskStore: {
            createPendingTask: (task) => { pending.set(task.id, task); return task; },
            upsertLocal: (task) => { pending.set(task.id, task); return task; },
        },
        __tmCalendarAllTasksCache: { tasks: [foreign, child] },
        __tmResolveOptimisticTaskId: (id) => id === 'alias' ? 'foreign' : id,
        __tmIsMutationTaskPendingDeleted: (id) => deleted.has(id),
        __tmNewTaskBlockId: () => 'new-' + (++sequence),
        __tmGenerateTempTaskId: () => 'client-' + sequence,
        __tmBuildSubtaskInheritedPatch: (task) => ({ priority: task.priority || '', startDate: task.startDate || '' }),
        __tmNormalizeSubtaskInheritedPatch: (patch) => patch,
        __tmEnsureEditableTaskLike: (task) => task.readOnly !== true,
        __tmSplitTaskInputLines: (text) => text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
        __TM_PENDING_INSERTED_TASK_KEEPALIVE_MS: 60000,
        __tmIsTaskListItemBlockId: async () => false,
        __tmInvalidateTasksQueryCacheByDocId: (id) => invalidations.push(id),
        __tmInsertBlockOnce: async (listId, data, position, options) => {
            writes.push({ type: 'sibling', listId, previousId: position.previousID, id: options.requestedID });
            return options.requestedID;
        },
        __tmBackendAdapter: {
            createSubtask: async (parentId, taskId, listId) => {
                writes.push({ type: 'subtask', parentId, id: taskId, listId });
                return { listID: listId };
            },
        },
        API: {
            getBlocksByIds: async (ids) => ids.map((id) => blocks.get(id)).filter(Boolean),
            getChildBlocks: async () => [],
            getChildListIdOfTask: async () => '',
            generateTaskDOM: (id, text) => id + ':' + text,
        },
        hint: (text, kind) => hints.push({ text, kind }),
        showPrompt: async (title) => { prompts.push(title); return sandbox.promptText; },
        promptText: '新增任务',
        dropCacheBeforeWrite: false,
    };
    sandbox.window = sandbox;
    sandbox.__tmCalendarGetTaskSnapshot = (id) => {
        const task = sandbox.__tmCalendarAllTasksCache?.tasks.find((item) => item.id === id);
        return task ? { ...task, children: [...(task.children || [])] } : null;
    };
    sandbox.__tmRequireTaskMutation = (name) => name === 'createSubtask' ? context.__tmQueueCreateSubtask : null;
    sandbox.__tmEnqueueQueuedOp = async (operation) => {
        operations.push(operation);
        const payload = operation.data;
        const isSubtask = operation.type === 'createSubtask';
        const projected = isSubtask
            ? context.__tmApplyOptimisticSubtask(payload.parentTaskId, payload.tempId, payload.content, payload.inheritedPatch, { parentListId: payload.requestedContainerId })
            : context.__tmApplyOptimisticSiblingTask(payload.sourceTaskId, payload.tempId, payload.content);
        assert.ok(projected, 'Cross-document creation must have an optimistic task snapshot');
        if (sandbox.dropCacheBeforeWrite) sandbox.__tmCalendarAllTasksCache = null;
        const options = { ...payload, scheduleSnapshotRefresh: false, deferInheritedAttrs: true, deferResolveInsertedTaskId: true };
        const realId = isSubtask
            ? await context.__tmCreateSubtaskForTaskKernel(payload.parentTaskId, payload.content, options)
            : await context.__tmCreateSiblingTaskForTaskKernel(payload.sourceTaskId, payload.content, options);
        return { realId };
    };
    context = vm.createContext(sandbox);
    vm.runInContext(runtime, context);
    return { context, active, foreign, child, pending, hints, operations, writes, prompts, invalidations, deleted };
}

async function main() {
    for (const dropCache of [false, true]) {
        for (const action of ['tmCreateSubtask', 'tmCreateSiblingTask']) {
            for (const sourceId of ['foreign', 'foreign-child', 'active']) {
                const harness = createHarness();
                const { context, operations, writes, hints, pending } = harness;
                context.dropCacheBeforeWrite = dropCache;
                await context[action](sourceId);
                assert.equal(harness.prompts.length, 1, action + ' must open the prompt for ' + sourceId);
                assert.equal(operations.length, 1);
                assert.equal(writes.length, 1, action + ' must reach the kernel writer');
                const expectedDoc = sourceId === 'active' ? 'doc-a' : 'doc-b';
                assert.equal(operations[0].docId, expectedDoc);
                assert.equal(operations[0].laneKey, 'doc:' + expectedDoc);
                assert.equal(harness.invalidations[0], expectedDoc);
                const task = pending.get(writes[0].id);
                assert.equal(task.docId, expectedDoc);
                if (action === 'tmCreateSubtask') {
                    assert.equal(writes[0].parentId, sourceId);
                    assert.equal(task.parentTaskId, sourceId);
                    if (sourceId === 'foreign') assert.equal(task.priority, 'high');
                } else {
                    assert.equal(writes[0].previousId, sourceId);
                    assert.equal(writes[0].listId, sourceId === 'foreign-child' ? 'child-list' : sourceId === 'active' ? 'list-a' : 'list-b');
                    assert.equal(task.parentTaskId, sourceId === 'foreign-child' ? 'foreign' : null);
                }
                assert.equal(hints.some((item) => item.kind === 'error'), false, JSON.stringify(hints));
                assert.deepEqual(context.state.taskTree.map((doc) => doc.id), ['doc-a']);
                assert.ok(context.state.taskTree[0].tasks.every((item) => item.docId === 'doc-a'));
            }
        }
    }
    const harness = createHarness();
    assert.equal(harness.context.__tmResolveOptimisticTaskForLocalUse('alias').id, 'foreign');
    harness.context.__tmCalendarAllTasksCache.tasks.push({ id: 'active', content: '旧缓存' });
    assert.equal(harness.context.__tmResolveOptimisticTaskForLocalUse('active').task, harness.active);
    await harness.context.tmCreateSubtask('alias');
    assert.equal(harness.operations[0].data.parentTaskId, 'foreign');
    for (const action of ['tmCreateSubtask', 'tmCreateSiblingTask']) {
        for (const reason of ['missing', 'readonly', 'deleted', 'cancel']) {
            const guarded = createHarness();
            if (reason === 'readonly') guarded.foreign.readOnly = true;
            if (reason === 'deleted') guarded.deleted.add('foreign');
            if (reason === 'cancel') guarded.context.promptText = null;
            await guarded.context[action](reason === 'missing' ? 'missing' : 'foreign');
            assert.equal(guarded.operations.length, 0, action + ' guard: ' + reason);
            assert.equal(guarded.writes.length, 0);
        }
    }
    const missingParent = createHarness();
    await assert.rejects(missingParent.context.__tmCreateSubtaskForTaskKernel('missing', '任务'), /未找到父任务/);
    console.log('calendar cross-document task creation regression tests passed');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

