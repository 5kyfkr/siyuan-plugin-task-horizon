'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHarness, IDS } = require('./kernel-contract.test.js');

const root = path.resolve(__dirname, '..');
const services = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const lifecycle = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/56-task-lifecycle-runtime.js'), 'utf8');
const lifecycleAttr = 'custom-task-horizon-lifecycle';
function segment(source, start, end) {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, start);
    return source.slice(from, to);
}

async function setup(options = {}) {
    const kernel = createHarness();
    await kernel.start();
    if (options.emptyTarget) {
        for (const [id, block] of kernel.blocks) {
            if (block.root_id === IDS.otherDoc && id !== IDS.otherDoc) kernel.blocks.delete(id);
        }
    }
    const context = vm.createContext({
        console, setTimeout, clearTimeout,
        SettingsStore: { data: { taskCompletionArchiveMode: 'document', taskCompletionArchiveDocId: IDS.otherDoc } },
        normalizeTaskFields: task => task,
        __tmNormalizeTaskCompletionArchiveMode: value => value,
        __tmIsRecurringInstanceTask: () => false,
        __tmGetTaskRepeatRule: task => task.repeatRule || { enabled: false },
        __tmNormalizeQueuedKernelTaskSnapshot: task => task,
        __tmResolveDefaultNewTaskInsertOptions: async id => ({ insertParentId: id }),
        API: {
            async getTaskById(id) {
                const result = await kernel.call('taskHorizonGetTask', id);
                if (!result.ok) throw new Error(result.error.message);
                return { ...result.data, root_id: result.data.documentID, parent_task_id: result.data.parentTaskID };
            },
            async call(route, body) {
                assert.equal(route, '/api/attr/getBlockAttrs');
                return { code: 0, data: kernel.attrs.get(body.id) || {} };
            },
        },
        __tmBackendAdapter: {
            async setAttrs(id, attrs) {
                kernel.attrs.set(id, { ...kernel.attrs.get(id), ...attrs });
            },
        },
        async __tmExecuteTaskCommandGateway(command) {
            const response = await kernel.call('taskHorizonMutateTask', command);
            if (!response.ok || response.data.outcome !== 'committed') {
                throw new Error(response.error?.message || response.data?.error?.message || 'move not committed');
            }
            return response.data;
        },
    });
    vm.runInContext(segment(services, 'function __tmNormalizeQueuedTaskPlacement(', 'async function __tmReadQueuedTaskPlacement('), context);
    vm.runInContext(lifecycle, context);
    async function complete(taskId) {
        const result = await kernel.call('taskHorizonMutateTask', { action: 'patch', taskID: taskId, patch: { done: true } });
        assert.equal(result.data.outcome, 'committed');
        return context.__tmTaskLifecycle.execute({ action: 'archiveCompleted', taskId, committedDone: true });
    }
    async function restore(taskId) {
        const result = await kernel.call('taskHorizonMutateTask', { action: 'patch', taskID: taskId, patch: { done: false } });
        assert.equal(result.data.outcome, 'committed');
        return context.__tmTaskLifecycle.execute({ action: 'restoreCompleted', taskId });
    }
    function assertPlacement(taskId, documentId) {
        const task = kernel.blocks.get(taskId);
        const list = kernel.blocks.get(task.parent_id);
        assert.equal(list.type, 'l', 'task must remain inside a list');
        assert.equal(list.parent_id, documentId);
        assert.equal(task.root_id, documentId);
        return list.id;
    }
    return { kernel, context, complete, restore, assertPlacement };
}

async function run() {
    for (const emptyTarget of [true, false]) {
        const h = await setup({ emptyTarget });
        h.kernel.attrs.set(IDS.singleTask, { 'custom-priority': 'high' });
        const result = await h.complete(IDS.singleTask);
        assert.equal(result.ok, true);
        assert.equal(h.assertPlacement(IDS.singleTask, IDS.otherDoc), IDS.singleList,
            'an independent task must move with its original list');
        assert.equal(h.kernel.blocks.get(IDS.childTask).root_id, IDS.otherDoc, 'descendant IDs must survive the move');
        assert.equal(h.kernel.blocks.get(IDS.childTask).parent_id, IDS.childList);
        assert.equal(h.kernel.attrs.get(IDS.singleTask)['custom-priority'], 'high');
        const meta = JSON.parse(h.kernel.attrs.get(IDS.singleTask)[lifecycleAttr]);
        assert.equal(meta.completed.originDocId, IDS.doc);
        assert.equal(meta.completed.archiveListId, IDS.singleList);
        const moveCalls = h.kernel.apiCalls.filter(call => call.pathname === '/api/block/moveBlock');
        assert.equal(moveCalls.length, 1);
        assert.equal(moveCalls[0].body.id, IDS.singleList, 'archive must move the outer list, not a naked task item');
        await h.restore(IDS.singleTask);
        h.assertPlacement(IDS.singleTask, IDS.doc);
        assert.equal(h.kernel.attrs.get(IDS.singleTask)[lifecycleAttr], '');
    }

    const shared = await setup();
    await shared.complete(IDS.firstTask);
    const archiveList = shared.assertPlacement(IDS.firstTask, IDS.otherDoc);
    assert.notEqual(archiveList, IDS.multiList);
    assert.equal(shared.kernel.blocks.get(IDS.secondTask).parent_id, IDS.multiList,
        'archiving one task must leave its sibling at the source');
    assert.equal([...shared.kernel.blocks.values()].filter(block => block.parent_id === archiveList).length, 1,
        'the temporary scaffold task must be removed');
    await shared.restore(IDS.firstTask);
    shared.assertPlacement(IDS.firstTask, IDS.doc);

    for (const taskId of [IDS.singleTask, IDS.firstTask]) {
        const rejected = await setup();
        rejected.kernel.skipMoveOnce();
        const idsBefore = new Set(rejected.kernel.blocks.keys());
        await assert.rejects(() => rejected.complete(taskId));
        rejected.assertPlacement(taskId, IDS.doc);
        assert.equal(rejected.kernel.attrs.get(taskId)?.[lifecycleAttr], undefined,
            'a rejected move must not commit archive metadata');
        assert.deepEqual(new Set(rejected.kernel.blocks.keys()), idsBefore,
            'a rejected move must clean up only the empty scaffold');
        await rejected.complete(taskId);
        rejected.assertPlacement(taskId, IDS.otherDoc);
    }

    const concurrent = await setup();
    await Promise.all([concurrent.complete(IDS.firstTask), concurrent.complete(IDS.secondTask)]);
    concurrent.assertPlacement(IDS.firstTask, IDS.otherDoc);
    concurrent.assertPlacement(IDS.secondTask, IDS.otherDoc);

    const titled = await setup();
    const headingId = '20260922000000-heading';
    titled.kernel.blocks.set(headingId, {
        id: headingId, type: 'h', subtype: 'h2', parent_id: IDS.otherDoc, root_id: IDS.otherDoc,
        markdown: '## Archive', content: 'Archive', created: '20260922000000', updated: '20260922000000', sort: 0,
    });
    titled.context.__tmNormalizeHeadingText = value => value;
    titled.context.__tmResolveDefaultNewTaskInsertOptions = async id => id === IDS.otherDoc
        ? { insertParentId: id, headingPatch: { h2Id: headingId, h2: 'Archive' } }
        : { insertParentId: id };
    await titled.complete(IDS.firstTask);
    const headingList = titled.assertPlacement(IDS.firstTask, IDS.otherDoc);
    const headingMove = titled.kernel.apiCalls.find(call => call.pathname === '/api/block/insertBlock');
    assert.equal(headingMove.body.previousID, headingId, 'configured heading must retain its existing placement path');
    assert.ok(headingList);
    await titled.restore(IDS.firstTask);
    titled.assertPlacement(IDS.firstTask, IDS.doc);

    const guarded = await setup();
    for (const placement of [{ parentID: IDS.otherDoc }, { previousID: IDS.otherList }]) {
        const before = guarded.kernel.apiCalls.filter(call => call.pathname === '/api/block/moveBlock').length;
        const response = await guarded.kernel.call('taskHorizonMutateTask', {
            action: 'move', taskID: IDS.firstTask, ...placement,
        });
        assert.notEqual(response.data.outcome, 'committed');
        assert.equal(guarded.kernel.apiCalls.filter(call => call.pathname === '/api/block/moveBlock').length, before,
            'invalid direct placement must be rejected before sending a move to SiYuan');
        guarded.assertPlacement(IDS.firstTask, IDS.doc);
    }
    console.log('completion archive document integration tests passed');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
