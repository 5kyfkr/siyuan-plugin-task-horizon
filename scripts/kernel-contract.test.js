const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IDS = Object.freeze({
    doc: '20260101000000-doc',
    singleList: '20260101000001-list',
    singleTask: '20260101000002-task',
    childBlock: '20260101000003-child',
    multiList: '20260101000004-list',
    firstTask: '20260101000005-task',
    secondTask: '20260101000006-task',
    otherDoc: '20260101000007-doc',
    otherList: '20260101000008-list',
    otherTask: '20260101000009-task',
    formattedList: '20260101000010-list',
    formattedTask: '20260101000010-task',
    fuzzyList: '20260101000012-list',
    fuzzyTask: '20260101000013-task',
});

function createHarness() {
    const blocks = new Map([
        [IDS.doc, { id: IDS.doc, parent_id: '', root_id: IDS.doc, type: 'd', subtype: '', markdown: '', content: 'Contract Doc', hpath: '/Contract Doc', updated: '20260101000000', created: '20260101000000', sort: 0 }],
        [IDS.singleList, { id: IDS.singleList, parent_id: IDS.doc, root_id: IDS.doc, type: 'l', subtype: '', markdown: '', content: '', updated: '20260101000001', created: '20260101000001', sort: 1 }],
        [IDS.singleTask, { id: IDS.singleTask, parent_id: IDS.singleList, root_id: IDS.doc, type: 'i', subtype: 't', markdown: '* [ ] Alpha\n\n  detail', content: 'Alpha detail', updated: '20260101000002', created: '20260101000002', sort: 1 }],
        [IDS.childBlock, { id: IDS.childBlock, parent_id: IDS.singleTask, root_id: IDS.doc, type: 'p', subtype: '', markdown: 'detail', content: 'detail', updated: '20260101000003', created: '20260101000003', sort: 1 }],
        [IDS.multiList, { id: IDS.multiList, parent_id: IDS.doc, root_id: IDS.doc, type: 'l', subtype: '', markdown: '', content: '', updated: '20260101000004', created: '20260101000004', sort: 2 }],
        [IDS.firstTask, { id: IDS.firstTask, parent_id: IDS.multiList, root_id: IDS.doc, type: 'i', subtype: 't', markdown: '* [ ] First', content: 'First', updated: '20260101000005', created: '20260101000005', sort: 1 }],
        [IDS.secondTask, { id: IDS.secondTask, parent_id: IDS.multiList, root_id: IDS.doc, type: 'i', subtype: 't', markdown: '* [ ] Second', content: 'Second', updated: '20260101000006', created: '20260101000006', sort: 2 }],
        [IDS.otherDoc, { id: IDS.otherDoc, parent_id: '', root_id: IDS.otherDoc, type: 'd', subtype: '', markdown: '', content: 'Other Doc', hpath: '/Other Doc', updated: '20260101000007', created: '20260101000007', sort: 0 }],
        [IDS.otherList, { id: IDS.otherList, parent_id: IDS.otherDoc, root_id: IDS.otherDoc, type: 'l', subtype: '', markdown: '', content: '', updated: '20260101000008', created: '20260101000008', sort: 1 }],
        [IDS.otherTask, { id: IDS.otherTask, parent_id: IDS.otherList, root_id: IDS.otherDoc, type: 'i', subtype: 't', markdown: '* [ ] 全局同名提醒任务', content: '全局同名提醒任务', updated: '20260101000009', created: '20260101000009', sort: 1 }],
        [IDS.formattedList, { id: IDS.formattedList, parent_id: IDS.otherDoc, root_id: IDS.otherDoc, type: 'l', subtype: '', markdown: '', content: '', updated: '20260101000010', created: '20260101000010', sort: 2 }],
        [IDS.formattedTask, { id: IDS.formattedTask, parent_id: IDS.formattedList, root_id: IDS.otherDoc, type: 'i', subtype: 't', markdown: '* [ ] **Formatted Reminder Task**', content: 'Formatted Reminder Task', updated: '20260101000011', created: '20260101000011', sort: 1 }],
        [IDS.fuzzyList, { id: IDS.fuzzyList, parent_id: IDS.otherDoc, root_id: IDS.otherDoc, type: 'l', subtype: '', markdown: '', content: '', updated: '20260101000012', created: '20260101000012', sort: 3 }],
        [IDS.fuzzyTask, { id: IDS.fuzzyTask, parent_id: IDS.fuzzyList, root_id: IDS.otherDoc, type: 'i', subtype: 't', markdown: '* [ ] 准备发布说明', content: '准备发布说明', updated: '20260101000013', created: '20260101000013', sort: 1 }],
    ]);
    const attrs = new Map([
        [IDS.singleList, { 'custom-existing-extension': 'keep-me' }],
    ]);
    const storage = new Map([
        ['agent-mcp-config.json', JSON.stringify({ schemaVersion: 2, enabled: true, tools: {} })],
        ['calendar-events.json', JSON.stringify([{
            id: 'schedule-existing',
            taskId: IDS.singleTask,
            title: 'Existing schedule',
            start: '2026-07-14T09:00:00+08:00',
            end: '2026-07-14T10:00:00+08:00',
            reminder: { minutes: 15 },
            recurrence: { type: 'weekly' },
            extension: 'keep-me',
        }])],
        ['task-settings.json', JSON.stringify({
            customFieldDefs: [{ id: 'energy', name: 'Energy', type: 'single', options: [{ id: 'high', name: 'High' }], agentWritable: true }],
            docGroups: [{ id: 'work', name: '工作', docs: [{ id: IDS.doc, recursive: false }] }],
            taskMetaAttrKeyAliases: { priority: ['custom-old-priority'] },
            customStatusOptions: [
                { id: 'todo', name: '待办', color: '#777777', marker: ' ' },
                { id: 'in_progress', name: '进行中', color: '#4285f4', marker: '?' },
                { id: 'done', name: '已完成', color: '#34a853', marker: 'X' },
            ],
        })],
    ]);
    const rpcCalls = {};
    const mcpTools = {};
    const apiCalls = [];
    let failNextToolRegistration = '';
    let createdBlockSequence = 0;

    const firstTaskForList = (parentID) => Array.from(blocks.values())
        .filter((block) => block.parent_id === parentID && block.type === 'i' && block.subtype === 't')
        .sort((left, right) => left.sort - right.sort)[0] || null;

    function taskRow(id) {
        const task = blocks.get(id);
        if (!task || task.type !== 'i' || task.subtype !== 't') return null;
        const parent = blocks.get(task.parent_id);
        const siblings = Array.from(blocks.values()).filter((block) => block.parent_id === task.parent_id && block.type === 'i' && block.subtype === 't');
        return {
            ...task,
            raw_content: task.content,
            block_path: '',
            block_sort: task.sort,
            box: 'box',
            doc_name: blocks.get(task.root_id)?.content || '',
            doc_path: blocks.get(task.root_id)?.hpath || '',
            parent_type: parent?.type || '',
            parent_task_count: siblings.length,
            first_task_id: firstTaskForList(task.parent_id)?.id || '',
        };
    }

    function query(statement) {
        if (/SELECT 1 AS task_horizon_session_probe/.test(statement)) return [{ task_horizon_session_probe: 1 }];
        if (/SELECT id, box, hpath FROM blocks WHERE type = 'd' AND id IN/.test(statement)) {
            const ids = Array.from(statement.matchAll(/'(\d{14}-[^']+)'/g)).map((match) => match[1]);
            return ids.map((id) => blocks.get(id)).filter((block) => block?.type === 'd').map((block) => ({
                id: block.id,
                box: 'box',
                hpath: block.hpath,
            }));
        }
        if (/FROM blocks doc\s+WHERE doc\.type = 'd'/.test(statement)) {
            return Array.from(blocks.values())
                .filter((block) => block.type === 'd' && /contract/i.test(`${block.content} ${block.hpath}`))
                .map((block) => ({ id: block.id, name: block.content, path: block.hpath, box: 'box', updated: block.updated }));
        }
        const reminderTitleQuery = /SELECT task\.id, task\.markdown, task\.content AS raw_content, task\.updated/.test(statement);
        if (reminderTitleQuery) {
            const titles = Array.from(statement.matchAll(/instr\(lower\(task\.markdown\), lower\('((?:''|[^'])*)'\)\) > 0/g))
                .map((match) => match[1].replace(/''/g, "'").toLocaleLowerCase());
            return Array.from(blocks.values())
                .filter((block) => {
                    if (block.type !== 'i' || block.subtype !== 't') return false;
                    const haystack = `${block.markdown || ''}\n${block.content || ''}`.toLocaleLowerCase();
                    return titles.some((title) => haystack.includes(title));
                })
                .sort((left, right) => String(right.updated || '').localeCompare(String(left.updated || '')))
                .map((block) => ({ id: block.id, markdown: block.markdown, raw_content: block.content, updated: block.updated }));
        }
        const taskMatch = statement.match(/WHERE task\.id = '([^']+)'/);
        if (taskMatch) {
            const row = taskRow(taskMatch[1]);
            return row ? [row] : [];
        }
        const blockMatch = statement.match(/SELECT id, parent_id, (?:root_id, )?type, subtype FROM blocks WHERE id = '([^']+)'/);
        if (blockMatch) {
            const block = blocks.get(blockMatch[1]);
            return block ? [{ id: block.id, parent_id: block.parent_id, root_id: block.root_id, type: block.type, subtype: block.subtype }] : [];
        }
        const siblingsMatch = statement.match(/SELECT id FROM blocks WHERE parent_id = '([^']+)' ORDER BY sort ASC, created ASC, id ASC/);
        if (siblingsMatch) {
            return Array.from(blocks.values())
                .filter((block) => block.parent_id === siblingsMatch[1] && (!/type = 'i'/.test(statement) || (block.type === 'i' && block.subtype === 't')))
                .sort((left, right) => left.sort - right.sort)
                .slice(0, /LIMIT 2/.test(statement) ? 2 : undefined)
                .map((block) => ({ id: block.id }));
        }
        const insertedTreeMatch = statement.match(/WITH RECURSIVE tree[\s\S]*SELECT '([^']+)', 0/);
        if (insertedTreeMatch) {
            const rootID = insertedTreeMatch[1];
            const queue = [rootID];
            const seen = new Set();
            while (queue.length) {
                const id = queue.shift();
                if (!id || seen.has(id)) continue;
                seen.add(id);
                const block = blocks.get(id);
                if (block?.type === 'i' && block?.subtype === 't') return [{ id }];
                Array.from(blocks.values())
                    .filter((item) => item.parent_id === id)
                    .sort((left, right) => left.sort - right.sort)
                    .forEach((item) => queue.push(item.id));
            }
            return [];
        }
        throw new Error(`Unhandled SQL in contract test: ${statement}`);
    }

    async function api(pathname, body) {
        apiCalls.push({ pathname, body: JSON.parse(JSON.stringify(body || {})) });
        if (pathname === '/api/query/sql') return query(String(body.stmt || ''));
        if (pathname === '/api/attr/getBlockAttrs') return { ...(attrs.get(body.id) || {}) };
        if (pathname === '/api/attr/setBlockAttrs') {
            attrs.set(body.id, { ...(attrs.get(body.id) || {}), ...(body.attrs || {}) });
            return null;
        }
        if (pathname === '/api/block/updateTaskListItemMarker') {
            const block = blocks.get(body.id);
            const marker = body.marker === 'X' ? 'x' : String(body.marker || ' ');
            block.markdown = block.markdown.replace(/^(\s*[*+-]\s+)\[[^\]]\]/, `$1[${marker}]`);
            block.updated = String(Number(block.updated) + 1).padStart(14, '0');
            return null;
        }
        if (pathname === '/api/block/batchUpdateTaskListItemMarker') {
            for (const item of body.items || []) await api('/api/block/updateTaskListItemMarker', item);
            return null;
        }
        if (pathname === '/api/block/updateBlock') {
            const block = blocks.get(body.id);
            block.markdown = String(body.data || '');
            block.content = block.markdown.replace(/^\s*[*+-]\s+\[[ xX-]\]\s*/, '').split('\n')[0];
            block.updated = String(Number(block.updated) + 1).padStart(14, '0');
            return null;
        }
        if (pathname === '/api/block/moveBlock') {
            const block = blocks.get(body.id);
            if (!block) throw new Error('move source not found');
            if (body.previousID) {
                const previous = blocks.get(body.previousID);
                if (!previous) throw new Error('move previous block not found');
                block.parent_id = previous.parent_id;
                block.root_id = previous.root_id;
                block.sort = previous.sort + 0.1;
            } else if (body.parentID) {
                const parent = blocks.get(body.parentID);
                if (!parent) throw new Error('move parent block not found');
                block.parent_id = parent.id;
                block.root_id = parent.type === 'd' ? parent.id : parent.root_id;
                const childSorts = Array.from(blocks.values()).filter((item) => item.parent_id === parent.id && item.id !== block.id).map((item) => item.sort);
                block.sort = childSorts.length ? Math.min(...childSorts) - 1 : 1;
            }
            return null;
        }
        if (pathname === '/api/block/appendBlock') {
            const parent = blocks.get(body.parentID);
            if (!parent) throw new Error('append parent not found');
            createdBlockSequence += 1;
            const stamp = `202607200100${String(createdBlockSequence).padStart(2, '0')}`;
            const listID = `${stamp}-list`;
            const taskID = `${stamp}-task`;
            const title = String(body.data || '').replace(/^\s*[*+-]\s+\[[ xX-]\]\s*/, '').split('\n')[0];
            const rootID = parent.type === 'd' ? parent.id : parent.root_id;
            const nextSort = Array.from(blocks.values()).filter((item) => item.parent_id === parent.id).length + 1;
            blocks.set(listID, { id: listID, parent_id: parent.id, root_id: rootID, type: 'l', subtype: '', markdown: '', content: '', updated: stamp.slice(0, 14), created: stamp.slice(0, 14), sort: nextSort });
            blocks.set(taskID, { id: taskID, parent_id: listID, root_id: rootID, type: 'i', subtype: 't', markdown: String(body.data || ''), content: title, updated: stamp.slice(0, 14), created: stamp.slice(0, 14), sort: 1 });
            return [{ doOperations: [{ id: listID }] }];
        }
        if (pathname === '/api/block/deleteBlock') {
            const queue = [body.id];
            while (queue.length) {
                const id = queue.shift();
                Array.from(blocks.values()).filter((item) => item.parent_id === id).forEach((item) => queue.push(item.id));
                blocks.delete(id);
                attrs.delete(id);
            }
            return null;
        }
        throw new Error(`Unhandled API in contract test: ${pathname}`);
    }

    const siyuan = {
        plugin: { lifecycle: {} },
        rpc: {
            async bind(name, handler) { rpcCalls[name] = handler; },
            async unbind(name) { delete rpcCalls[name]; },
        },
        mcp: {
            async registerTool(name, schema, handler) {
                if (failNextToolRegistration === name) {
                    failNextToolRegistration = '';
                    throw new Error(`register failed: ${name}`);
                }
                mcpTools[name] = { schema, handler };
            },
            async unregisterTool(name) { delete mcpTools[name]; },
        },
        storage: {
            async get(name) {
                if (!storage.has(name)) throw new Error('not found');
                return { async text() { return storage.get(name); } };
            },
            async put(name, content) { storage.set(name, String(content)); },
        },
        client: {
            async fetch(pathname, options) {
                try {
                    const data = await api(pathname, JSON.parse(options?.body || '{}'));
                    return { ok: true, status: 200, async json() { return { code: 0, data }; } };
                } catch (error) {
                    return { ok: true, status: 200, async json() { return { code: -1, msg: error.message }; } };
                }
            },
        },
    };
    const source = fs.readFileSync(path.join(__dirname, '..', 'kernel.js'), 'utf8');
    vm.runInNewContext(source, { siyuan, console, setTimeout, clearTimeout, Date, Math, JSON, Map, Set, Promise });

    async function start() {
        await siyuan.plugin.lifecycle.onload();
    }

    async function call(name, ...args) {
        assert.equal(typeof rpcCalls[name], 'function', `${name} RPC should be bound`);
        return await rpcCalls[name](...args);
    }

    return {
        apiCalls,
        attrs,
        blocks,
        call,
        mcpTools,
        start,
        storage,
        failNextRegistration(name) { failNextToolRegistration = name; },
    };
}

async function run() {
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'plugin.json'), 'utf8'));
    assert.ok(Array.isArray(manifest.kernels) && manifest.kernels.includes('all'), 'plugin.json must enable the kernel plugin on supported backends');
    assert.equal(manifest.minAppVersion, '3.7.3', 'the release must require the SiYuan version whose plugin readOnly and startup RPC contracts were reviewed');

    const harness = createHarness();
    await harness.start();

    const initialCapabilities = await harness.call('taskHorizonGetCapabilities');
    assert.equal(initialCapabilities.ok, true);
    assert.equal(initialCapabilities.data.totalToolCount, 21);
    assert.equal(initialCapabilities.data.mcpAuthorized, false);
    assert.equal(initialCapabilities.data.mcpEnabled, false);
    assert.equal(initialCapabilities.data.registeredToolCount, 0, 'kernel startup must not restore MCP tools before entitlement verification');
    assert.equal(initialCapabilities.data.toolGroups.length, 6);

    const freeEnable = await harness.call('taskHorizonSetMcpEnabled', true);
    assert.equal(freeEnable.ok, false, 'an unauthorized kernel client must not enable MCP tools');
    assert.equal(freeEnable.error.code, 'UNSUPPORTED');
    const freeEntitlement = await harness.call('taskHorizonSyncMcpEntitlement', { allowed: false });
    assert.equal(freeEntitlement.ok, true);
    assert.equal(freeEntitlement.data.mcpEnabled, false);
    assert.equal(freeEntitlement.data.registeredToolCount, 0);
    const proEntitlement = await harness.call('taskHorizonSyncMcpEntitlement', { allowed: true });
    assert.equal(proEntitlement.ok, true);
    assert.equal(proEntitlement.data.mcpAuthorized, true);
    assert.equal(proEntitlement.data.mcpEnabled, true, 'verified Pro entitlement must restore the persisted MCP preference');
    assert.equal(proEntitlement.data.registeredToolCount, 21);
    assert.equal(proEntitlement.data.toolGroups.flatMap((group) => group.tools).find((tool) => tool.name === 'query_tasks').readOnly, true);
    assert.equal(harness.mcpTools.query_tasks.schema.readOnly, true, 'SiYuan 3.7.3 requires plugin read tools to declare readOnly explicitly');
    assert.equal(harness.mcpTools.aggregate_task_stats.schema.readOnly, true);
    assert.notEqual(harness.mcpTools.create_task.schema.readOnly, true, 'write tools must not claim to be read-only');

    const statsOff = await harness.call('taskHorizonSetMcpToolConfig', { groupID: 'stats', enabled: false });
    assert.equal(statsOff.ok, true);
    assert.equal(statsOff.data.registeredToolCount, 19);
    assert.equal(harness.mcpTools.aggregate_task_stats, undefined);
    assert.equal(harness.mcpTools.aggregate_time_usage, undefined);
    const oneStatOn = await harness.call('taskHorizonSetMcpToolConfig', { toolName: 'aggregate_task_stats', enabled: true });
    assert.equal(oneStatOn.ok, true);
    assert.ok(harness.mcpTools.aggregate_task_stats);
    assert.equal(harness.mcpTools.aggregate_time_usage, undefined);
    await harness.call('taskHorizonSetMcpToolConfig', { groupID: 'stats', enabled: true });

    const createOff = await harness.call('taskHorizonSetMcpToolConfig', { toolName: 'create_task', enabled: false });
    assert.equal(createOff.ok, true);
    assert.equal(harness.mcpTools.create_task, undefined);
    const guardedBatch = await harness.mcpTools.batch_tasks.handler({
        action: 'get',
        phase: 'preview',
        operations: [{ kind: 'create', title: 'Must stay blocked', documentID: IDS.doc }],
    });
    assert.equal(guardedBatch.ok, false);
    assert.equal(guardedBatch.error.code, 'UNSUPPORTED');
    harness.failNextRegistration('create_task');
    const failedCreateOn = await harness.call('taskHorizonSetMcpToolConfig', { toolName: 'create_task', enabled: true });
    assert.equal(failedCreateOn.ok, false, 'failed MCP registration must surface to the caller');
    assert.equal(harness.mcpTools.create_task, undefined, 'failed MCP registration must restore the previous registered tool set');
    assert.equal(JSON.parse(harness.storage.get('agent-mcp-config.json')).tools.create_task, false, 'failed MCP registration must restore the previous persisted config');
    await harness.call('taskHorizonSetMcpToolConfig', { toolName: 'create_task', enabled: true });
    const storedMcpConfig = JSON.parse(harness.storage.get('agent-mcp-config.json'));
    assert.equal(storedMcpConfig.schemaVersion, 2);
    assert.equal(storedMcpConfig.tools.create_task, true);

    const resolved = await harness.call('taskHorizonResolveTaskBinding', IDS.childBlock);
    assert.equal(resolved.ok, true);
    assert.equal(resolved.data.taskID, IDS.singleTask);
    assert.equal(resolved.data.primaryHostID, IDS.singleList);

    const invalidCreateTarget = await harness.call('taskHorizonCreateTask', { title: 'Invalid target', documentID: IDS.childBlock });
    assert.equal(invalidCreateTarget.ok, false);
    assert.equal(invalidCreateTarget.error.code, 'INVALID_ARGUMENT');
    assert.match(harness.mcpTools.create_task.schema.description, /^任务管理器插件：/, 'MCP tools must identify the task manager plugin in their descriptions');
    assert.match(harness.mcpTools.create_task.schema.description, /无需预览/, 'single-task creation must advertise its direct path');
    const directCreate = await harness.mcpTools.create_task.handler({ action: 'create', title: 'Direct task', documentID: IDS.doc });
    assert.equal(directCreate.ok, true);
    assert.equal(directCreate.data.task.title, 'Direct task');
    assert.equal(directCreate.data.task.documentID, IDS.doc);
    assert.equal(directCreate.data.refresh.kind, 'task-mutation');
    assert.equal(directCreate.data.refresh.action, 'create');
    assert.deepEqual(Array.from(directCreate.data.refresh.documentIDs), [IDS.doc]);
    const undoCreated = await harness.mcpTools.create_task.handler({ action: 'create', title: 'Undo-created task', documentID: IDS.doc });
    assert.equal(undoCreated.ok, true);
    assert.match(undoCreated.data.undoID, /^undo_/, 'reversible writes must return their undo ID');
    const unrelatedCreate = await harness.mcpTools.create_task.handler({ action: 'create', title: 'Other write', documentID: IDS.doc });
    assert.equal(unrelatedCreate.ok, true);
    const staleUndo = await harness.call('taskHorizonUndoLastMutation', { undoID: undoCreated.data.undoID });
    assert.equal(staleUndo.ok, false, 'an older receipt must not undo a newer write');
    assert.equal(staleUndo.error.code, 'NOT_FOUND');
    const undoCreatedResult = await harness.call('taskHorizonUndoLastMutation', { undoID: unrelatedCreate.data.undoID });
    assert.equal(undoCreatedResult.ok, true);
    assert.equal(undoCreatedResult.data.data.refresh.action, 'delete');
    assert.deepEqual(Array.from(undoCreatedResult.data.data.refresh.taskIDs), [unrelatedCreate.data.task.id]);

    const invalidMoveTarget = await harness.call('taskHorizonMoveTask', { taskID: IDS.firstTask, parentID: IDS.childBlock });
    assert.equal(invalidMoveTarget.ok, false);
    assert.equal(invalidMoveTarget.error.code, 'INVALID_ARGUMENT');
    const invalidPreviousTarget = await harness.call('taskHorizonMoveTask', { taskID: IDS.firstTask, previousID: IDS.doc });
    assert.equal(invalidPreviousTarget.ok, false);
    assert.equal(invalidPreviousTarget.error.code, 'INVALID_ARGUMENT');
    const moveBefore = await harness.call('taskHorizonMoveTask', { taskID: IDS.firstTask, nextID: IDS.secondTask });
    assert.equal(moveBefore.ok, true);
    assert.equal(moveBefore.data.refresh.action, 'move');
    assert.deepEqual(Array.from(moveBefore.data.refresh.taskIDs), [IDS.firstTask]);
    assert.deepEqual(Array.from(moveBefore.data.refresh.documentIDs), [IDS.doc]);
    const moveRequest = harness.apiCalls.filter((item) => item.pathname === '/api/block/moveBlock').at(-1)?.body || {};
    assert.equal(moveRequest.nextID, undefined, 'nextID must be translated before calling the SiYuan move API');
    assert.equal(moveRequest.parentID, IDS.multiList);
    const moveUndo = await harness.call('taskHorizonUndoLastMutation', {});
    assert.equal(moveUndo.ok, true);
    assert.equal(moveUndo.data.data.refresh.action, 'move');
    const moveUndoRequest = harness.apiCalls.filter((item) => item.pathname === '/api/block/moveBlock').at(-1)?.body || {};
    assert.equal(moveUndoRequest.nextID, undefined, 'move undo must use the same SiYuan-compatible placement resolver');

    const documents = await harness.call('taskHorizonSearchDocuments', { keyword: 'Contract', limit: 20 });
    assert.equal(documents.ok, true);
    assert.equal(documents.data.items.length, 1);
    assert.equal(documents.data.items[0].id, IDS.doc);
    assert.equal(documents.data.items[0].name, 'Contract Doc');

    const single = await harness.call('taskHorizonUpdateTask', IDS.singleTask, { priority: 'high' });
    assert.equal(single.ok, true);
    assert.equal(harness.attrs.get(IDS.singleList)['custom-priority'], 'high');
    assert.equal(harness.attrs.get(IDS.singleTask)['custom-priority'], 'high');
    assert.equal(harness.attrs.get(IDS.singleList)['custom-existing-extension'], 'keep-me');

    const first = await harness.call('taskHorizonUpdateTask', IDS.firstTask, { startDate: '2026-07-14' });
    assert.equal(first.ok, true);
    assert.equal(harness.attrs.get(IDS.firstTask)['custom-start-date'], '2026-07-14');
    assert.equal(harness.attrs.get(IDS.multiList)['custom-start-date'], '2026-07-14');

    const second = await harness.call('taskHorizonUpdateTask', IDS.secondTask, { completionTime: '2026-07-20' });
    assert.equal(second.ok, true);
    assert.equal(harness.attrs.get(IDS.secondTask)['custom-completion-time'], '2026-07-20');
    assert.equal(harness.attrs.get(IDS.multiList)['custom-completion-time'], undefined);

    const custom = await harness.call('taskHorizonUpdateTask', IDS.singleTask, { customFieldValues: { energy: 'high' } });
    assert.equal(custom.ok, true);
    assert.equal(harness.attrs.get(IDS.singleList)['custom-tm-energy'], 'High');

    harness.attrs.set(IDS.singleList, {
        ...harness.attrs.get(IDS.singleList),
        'custom-status': 'in_progress',
        'custom-start-date': '',
        'custom-completion-time': '',
        'custom-task-complete-at': '2026-07-15T10:30:00+08:00',
        'custom-duration': '90分钟',
        'custom-remark': 'Read every task field',
        'custom-tomato-estimate-count': '4',
        'custom-tomato-count': '3',
        'custom-tomato-minutes': '75',
        'custom-data-assets-th-0': 'assets/report.pdf',
        'custom-data-assets-th-1': `block:${IDS.childBlock}`,
        'custom-data-assets-th-meta': JSON.stringify({ version: 1, items: [{ path: 'assets/report.pdf', addedAt: 123456 }] }),
        'custom-tomato-reminder': JSON.stringify({ enabled: true, at: '2026-07-20T09:00:00+08:00', extension: 'keep-reminder-extension' }),
        'custom-task-repeat-rule': JSON.stringify({ enabled: true, type: 'weekly' }),
        'custom-task-repeat-state': JSON.stringify({ next: '2026-07-22' }),
    });
    harness.attrs.set(IDS.singleTask, {
        ...harness.attrs.get(IDS.singleTask),
        'custom-start-date': '2026-07-16',
        'custom-completion-time': '2026-07-20',
    });
    const readable = await harness.call('taskHorizonGetTask', IDS.singleTask, [
        'priority', 'customStatus', 'startDate', 'completionTime', 'taskCompleteAt', 'duration', 'remark',
        'tomatoEstimateCount', 'tomatoCount', 'tomatoMinutes', 'attachments', 'attachmentCount',
        'reminder', 'hasReminder', 'repeatRule', 'repeatState', 'customFieldValues',
    ]);
    assert.equal(readable.ok, true);
    assert.equal(readable.data.priority, 'high');
    assert.equal(readable.data.priorityName, '高');
    assert.equal(readable.data.customStatus, 'in_progress');
    assert.equal(readable.data.customStatusName, '进行中');
    assert.equal(readable.data.statusDefinitions.find((item) => item.id === 'in_progress').name, '进行中');
    assert.equal(readable.data.priorityDefinitions.find((item) => item.id === 'high').name, '高');
    assert.equal(readable.data.startDate, '2026-07-16');
    assert.equal(readable.data.completionTime, '2026-07-20');
    assert.equal(readable.data.taskCompleteAt, '2026-07-15T10:30:00+08:00');
    assert.equal(readable.data.duration, '90分钟');
    assert.equal(readable.data.remark, 'Read every task field');
    assert.equal(readable.data.tomatoEstimateCount, 4);
    assert.equal(readable.data.tomatoCount, 3);
    assert.equal(readable.data.tomatoMinutes, 75);
    assert.equal(readable.data.attachmentCount, 2);
    assert.equal(readable.data.attachments[0].path, 'assets/report.pdf');
    assert.equal(readable.data.attachments[0].addedAt, 123456);
    assert.equal(readable.data.attachments[1].kind, 'block-ref');
    assert.equal(readable.data.hasReminder, true);
    assert.equal(readable.data.reminder.enabled, true);
    assert.equal(readable.data.repeatRule.type, 'weekly');
    assert.equal(readable.data.repeatState.next, '2026-07-22');
    assert.equal(readable.data.customFieldValues.energy, 'High');
    assert.equal(readable.data.customFieldDefinitions.length, 1);
    assert.equal(readable.data.customFieldDefinitions[0].id, 'energy');
    assert.equal(readable.data.customFieldDefinitions[0].label, 'Energy');
    assert.equal(readable.data.customFieldDefinitions[0].type, 'single');
    assert.equal(readable.data.customFieldDefinitions[0].options[0].id, 'high');
    assert.equal(readable.data.customFieldDefinitions[0].options[0].label, 'High');

    const reminderTool = harness.mcpTools.configure_task_reminder;
    assert.ok(reminderTool, 'configure_task_reminder must be registered');
    const reminderSchema = reminderTool.schema.inputSchema;
    assert.deepEqual(Array.from(reminderSchema.properties.action.enum), ['apply'], 'reminder writes must use one direct apply call');
    assert.equal(reminderSchema.properties.phase, undefined, 'the public reminder schema must not expose a preview phase');
    assert.equal(reminderSchema.properties.previewToken, undefined, 'the public reminder schema must not require a second preview-token call');
    assert.deepEqual(Array.from(reminderSchema.required), ['action', 'operation'], 'a new reminder task must not require a pre-existing taskID');
    assert.equal(reminderSchema.properties.taskTitle.type, 'string');
    assert.equal(reminderSchema.properties.documentID.type, 'string');
    assert.match(reminderTool.schema.description, /先用 query_tasks 检索已有任务[\s\S]*先精确、再按可见标题模糊匹配[\s\S]*允许少量错字/, 'unbound reminder lookup must search candidates first and retain fuzzy visible-title matching');
    const reminderFollowSchema = reminderTool.schema.inputSchema.properties.follow;
    assert.deepEqual(Array.from(reminderFollowSchema.required), ['date', 'times']);
    assert.deepEqual(Object.keys(reminderFollowSchema.properties), ['date', 'times'], 'follow reminders must accept only the requested date and times');
    const completedDuplicate = await harness.mcpTools.create_task.handler({
        action: 'create',
        title: '全局同名提醒任务',
        documentID: IDS.doc,
        patch: { done: true },
    });
    assert.equal(completedDuplicate.ok, true);
    const tasksBeforeReuse = Array.from(harness.blocks.values()).filter((block) => block.type === 'i' && block.subtype === 't').length;
    const reusedGlobalTask = await reminderTool.handler({
        action: 'apply',
        operation: 'set',
        taskTitle: '全局同名提醒任务',
        mode: 'independent',
        schedule: { startDate: '2026-07-22', times: ['08:30'], interval: 'once' },
    });
    assert.equal(reusedGlobalTask.ok, true);
    assert.equal(reusedGlobalTask.data.taskID, IDS.otherTask, 'global lookup must bind an unfinished exact-title task from another document');
    assert.equal(reusedGlobalTask.data.taskReused, true);
    assert.equal(reusedGlobalTask.data.taskCreated, false);
    assert.equal(Array.from(harness.blocks.values()).filter((block) => block.type === 'i' && block.subtype === 't').length, tasksBeforeReuse, 'reusing a global exact-title task must not create another task');
    assert.equal(JSON.parse(harness.attrs.get(IDS.otherList)['custom-tomato-reminder']).taskId, IDS.otherTask);
    const reusedFormattedTask = await reminderTool.handler({
        action: 'apply',
        operation: 'set',
        taskTitle: 'formatted reminder task',
        mode: 'independent',
        schedule: { startDate: '2026-07-22', times: ['09:30'], interval: 'once' },
    });
    assert.equal(reusedFormattedTask.ok, true);
    assert.equal(reusedFormattedTask.data.taskID, IDS.formattedTask, 'global exact-title lookup must compare the visible title without Markdown or case differences');
    assert.equal(reusedFormattedTask.data.taskReused, true);
    assert.equal(reusedFormattedTask.data.taskMatchType, 'exact');
    assert.equal(reusedFormattedTask.data.taskCreated, false);
    assert.equal(Array.from(harness.blocks.values()).filter((block) => block.type === 'i' && block.subtype === 't').length, tasksBeforeReuse, 'formatted exact-title reuse must not create another task');
    const reusedFuzzyTask = await reminderTool.handler({
        action: 'apply',
        operation: 'set',
        taskTitle: '准备发布说名',
        mode: 'independent',
        schedule: { startDate: '2026-07-22', times: ['10:30'], interval: 'once' },
    });
    assert.equal(reusedFuzzyTask.ok, true, JSON.stringify(reusedFuzzyTask));
    assert.equal(reusedFuzzyTask.data.taskID, IDS.fuzzyTask, 'a one-character typo must reuse the closest existing task');
    assert.equal(reusedFuzzyTask.data.taskTitle, '准备发布说明');
    assert.equal(reusedFuzzyTask.data.taskReused, true);
    assert.equal(reusedFuzzyTask.data.taskMatchType, 'fuzzy');
    assert.equal(reusedFuzzyTask.data.taskMatchDistance, 1);
    assert.equal(reusedFuzzyTask.data.taskCreated, false);
    assert.equal(Array.from(harness.blocks.values()).filter((block) => block.type === 'i' && block.subtype === 't').length, tasksBeforeReuse, 'fuzzy reminder matching must not create a duplicate task');
    const createdIndependent = await reminderTool.handler({
        action: 'apply',
        operation: 'set',
        taskTitle: '新建独立提醒任务',
        documentID: IDS.doc,
        mode: 'independent',
        schedule: { startDate: '2026-07-23', times: ['09:15'], interval: 'once' },
    });
    assert.equal(createdIndependent.ok, true);
    assert.equal(createdIndependent.data.taskCreated, true);
    assert.equal(createdIndependent.data.createdDocumentID, IDS.doc);
    assert.equal(createdIndependent.data.taskTitle, '新建独立提醒任务');
    assert.equal(JSON.parse(harness.attrs.get(createdIndependent.data.attrHostID)['custom-tomato-reminder']).repeatMode, 'manual');
    const createdFollow = await reminderTool.handler({
        action: 'apply',
        operation: 'set',
        taskTitle: '新建跟随提醒任务',
        documentID: IDS.doc,
        mode: 'follow_task',
        follow: { date: '2026-07-24', times: ['20:00'] },
    });
    assert.equal(createdFollow.ok, true);
    assert.equal(createdFollow.data.taskCreated, true);
    assert.equal(createdFollow.data.completionTime, '2026-07-24');
    assert.equal(createdFollow.data.task.title, '新建跟随提醒任务');
    assert.equal(createdFollow.data.refresh.action, 'reminder');
    assert.deepEqual(Array.from(createdFollow.data.refresh.documentIDs), [IDS.doc]);
    assert.equal(JSON.parse(harness.attrs.get(createdFollow.data.attrHostID)['custom-tomato-reminder']).repeatMode, 'followTaskRepeat');
    const missingReminderTarget = await reminderTool.handler({
        action: 'apply',
        operation: 'set',
        taskTitle: '缺少位置',
        mode: 'independent',
        schedule: { startDate: '2026-07-25', times: ['10:00'], interval: 'once' },
    });
    assert.equal(missingReminderTarget.ok, false);
    assert.equal(missingReminderTarget.error.code, 'INVALID_ARGUMENT');
    const tasksBeforeFailedReminder = Array.from(harness.blocks.values()).filter((block) => block.type === 'i' && block.subtype === 't').length;
    const failedCreatedReminder = await reminderTool.handler({
        action: 'apply',
        operation: 'set',
        taskTitle: '不应残留的提醒任务',
        documentID: IDS.doc,
        mode: 'independent',
        schedule: { startDate: '2026-07-25', times: ['10:00'], interval: 'unsupported' },
    });
    assert.equal(failedCreatedReminder.ok, false);
    assert.equal(failedCreatedReminder.error.code, 'INVALID_ARGUMENT');
    assert.equal(Array.from(harness.blocks.values()).filter((block) => block.type === 'i' && block.subtype === 't').length, tasksBeforeFailedReminder, 'failed reminder creation must remove its carrier task');
    harness.attrs.set(IDS.singleList, {
        ...harness.attrs.get(IDS.singleList),
        'custom-completion-time': '',
    });
    harness.attrs.set(IDS.singleTask, {
        ...harness.attrs.get(IDS.singleTask),
        'custom-completion-time': '',
    });
    harness.attrs.set(IDS.singleTask, {
        ...harness.attrs.get(IDS.singleTask),
        'custom-tomato-reminder': JSON.stringify({ taskId: IDS.singleTask, enabled: true, startDate: '2026-07-19', times: ['08:00'] }),
        bookmark: '⏰',
    });
    const reminderExecute = await reminderTool.handler({
        action: 'apply',
        operation: 'set',
        taskID: IDS.singleTask,
        mode: 'follow_task',
        follow: { date: '2026-07-20', times: ['08:00'] },
    });
    assert.equal(reminderExecute.ok, true);
    assert.equal(reminderExecute.data.task.id, IDS.singleTask);
    assert.equal(reminderExecute.data.refresh.kind, 'task-mutation');
    assert.equal(reminderExecute.data.refresh.action, 'reminder');
    assert.equal(reminderExecute.data.reminder.startDate, '2026-07-20');
    assert.equal(reminderExecute.data.taskTitle, 'Alpha');
    assert.equal(reminderExecute.data.reminder.blockName, 'Alpha', 'a parent reminder name must exclude descendant content');
    assert.equal(reminderExecute.data.reminder.blockContent, 'Alpha', 'a parent reminder body must exclude descendant content');
    assert.equal(reminderExecute.data.reminder.followAnchor, 'completionTime');
    assert.equal(reminderExecute.data.reminder.followDayOffset, 0);
    assert.equal(reminderExecute.data.reminder.syncTaskDone, true);
    const followedReminder = JSON.parse(harness.attrs.get(IDS.singleList)['custom-tomato-reminder']);
    assert.equal(followedReminder.repeatMode, 'followTaskRepeat');
    assert.equal(followedReminder.syncTaskDone, true);
    assert.equal(followedReminder.followAnchor, 'completionTime');
    assert.equal(followedReminder.followDayOffset, 0);
    assert.equal(followedReminder.blockName, 'Alpha');
    assert.equal(followedReminder.blockContent, 'Alpha');
    assert.equal(reminderExecute.data.completionTime, '2026-07-20');
    assert.equal(reminderExecute.data.completionChanged, true);
    assert.equal(harness.attrs.get(IDS.singleList)['custom-completion-time'], '2026-07-20', 'execute must write the requested reminder date as the task deadline');
    assert.equal(harness.attrs.get(IDS.singleTask)['custom-completion-time'], '2026-07-20', 'the derived deadline must follow normal task mirroring');
    assert.equal(followedReminder.extension, 'keep-reminder-extension');
    assert.equal(followedReminder.at, undefined, 'stale legacy time aliases must be cleared');
    assert.equal(harness.attrs.get(IDS.singleList).bookmark, '⏰');
    assert.equal(harness.attrs.get(IDS.singleTask)['custom-tomato-reminder'], '', 'a reminder must exist only on the real attribute host');
    assert.equal(harness.attrs.get(IDS.singleTask).bookmark, '', 'the stale mirrored reminder mark must be removed');

    const clearFollowReminder = await reminderTool.handler({
        action: 'apply',
        operation: 'clear',
        taskID: IDS.singleTask,
    });
    assert.equal(clearFollowReminder.ok, true);
    assert.equal(clearFollowReminder.data.completionCleared, true, 'clearing a follow-task reminder must clear its synchronized deadline');
    assert.equal(harness.attrs.get(IDS.singleList)['custom-completion-time'], '');
    assert.equal(harness.attrs.get(IDS.singleTask)['custom-completion-time'], '');

    const independentPreview = await reminderTool.handler({
        action: 'get',
        phase: 'preview',
        operation: 'set',
        taskID: IDS.singleTask,
        mode: 'independent',
        schedule: {
            startDate: '2026-07-21',
            endDate: '2026-08-31',
            times: ['09:30'],
            interval: 'weekly',
            every: 2,
            monthlyMode: 'date',
            calendarMode: 'solar',
        },
    });
    assert.equal(independentPreview.ok, true);
    const independentExecute = await reminderTool.handler({
        action: 'apply',
        phase: 'execute',
        operation: 'set',
        taskID: IDS.singleTask,
        previewToken: independentPreview.data.previewToken,
    });
    assert.equal(independentExecute.ok, true);
    const independentReminder = JSON.parse(harness.attrs.get(IDS.singleList)['custom-tomato-reminder']);
    assert.equal(independentReminder.repeatMode, 'manual');
    assert.equal(independentReminder.syncTaskDone, false);
    assert.equal(independentReminder.taskRepeatRule, null);
    assert.deepEqual(independentReminder.completedOccurrences, []);
    assert.equal(harness.attrs.get(IDS.singleTask)['custom-tomato-reminder'], '', 'independent reminders must not be mirrored to the task block');

    harness.attrs.set(IDS.singleList, { ...harness.attrs.get(IDS.singleList), 'custom-completion-time': '2026-08-15' });
    harness.attrs.set(IDS.singleTask, { ...harness.attrs.get(IDS.singleTask), 'custom-completion-time': '2026-08-15' });

    const clearPreview = await reminderTool.handler({ action: 'get', phase: 'preview', operation: 'clear', taskID: IDS.singleTask });
    assert.equal(clearPreview.ok, true);
    const clearExecute = await reminderTool.handler({
        action: 'apply',
        phase: 'execute',
        operation: 'clear',
        taskID: IDS.singleTask,
        previewToken: clearPreview.data.previewToken,
    });
    assert.equal(clearExecute.ok, true);
    assert.equal(harness.attrs.get(IDS.singleList)['custom-tomato-reminder'], '');
    assert.equal(harness.attrs.get(IDS.singleList).bookmark, '');
    assert.equal(clearExecute.data.completionCleared, false, 'clearing an independent reminder must not clear the task deadline');
    assert.equal(harness.attrs.get(IDS.singleList)['custom-completion-time'], '2026-08-15');

    harness.attrs.set(IDS.multiList, {
        ...harness.attrs.get(IDS.multiList),
        'custom-tomato-reminder': JSON.stringify({ taskId: IDS.firstTask, enabled: true, startDate: '2026-07-22', times: ['10:00'], legacyExtension: 'keep-on-move' }),
        bookmark: '⏰',
    });
    const multiReminderPreview = await reminderTool.handler({
        action: 'get',
        phase: 'preview',
        operation: 'set',
        taskID: IDS.firstTask,
        mode: 'independent',
        schedule: { startDate: '2026-07-22', times: ['10:00'], interval: 'once' },
    });
    assert.equal(multiReminderPreview.ok, true);
    const multiReminderExecute = await reminderTool.handler({
        action: 'apply',
        phase: 'execute',
        operation: 'set',
        taskID: IDS.firstTask,
        previewToken: multiReminderPreview.data.previewToken,
    });
    assert.equal(multiReminderExecute.ok, true);
    const movedMultiReminder = JSON.parse(harness.attrs.get(IDS.firstTask)['custom-tomato-reminder']);
    assert.equal(movedMultiReminder.taskId, IDS.firstTask);
    assert.equal(movedMultiReminder.legacyExtension, 'keep-on-move', 'host migration must preserve unknown reminder fields');
    assert.equal(harness.attrs.get(IDS.multiList)['custom-tomato-reminder'], '', 'multi-task reminders must be removed from the parent-list mirror');
    assert.equal(harness.attrs.get(IDS.multiList).bookmark, '');

    const agentScheduleTool = harness.mcpTools.manage_agent_schedules;
    assert.ok(agentScheduleTool, 'manage_agent_schedules must be registered');
    const invalidAgentSchedule = await agentScheduleTool.handler({
        action: 'create',
        event: {
            name: 'Invalid date',
            prompt: 'Must not persist',
            schedule: { kind: 'once', date: '2026-02-31', time: '19:00' },
            output: { mode: 'notification' },
        },
    });
    assert.equal(invalidAgentSchedule.ok, false, 'nonexistent calendar dates must be rejected');
    assert.equal(invalidAgentSchedule.error.code, 'INVALID_ARGUMENT');
    assert.match(agentScheduleTool.schema.description, /必须先用 question/);
    const createdAgentSchedule = await agentScheduleTool.handler({
        action: 'create',
        event: {
            name: '每日任务复盘',
            prompt: '总结今天完成的任务',
            condition: 'today_has_completed_tasks',
            schedule: { kind: 'daily', time: '19:00' },
            output: { mode: 'notification' },
        },
    });
    assert.equal(createdAgentSchedule.ok, true);
    assert.equal(createdAgentSchedule.data.schedule.time, '19:00');
    const listedAgentSchedules = await agentScheduleTool.handler({ action: 'list' });
    assert.equal(listedAgentSchedules.ok, true);
    assert.equal(listedAgentSchedules.data.items.length, 1);
    const agentScheduleID = createdAgentSchedule.data.id;
    const occurrenceKey = `${agentScheduleID}:2026-07-21T19:00`;
    const concurrentClaims = await Promise.all([
        harness.call('taskHorizonClaimAgentScheduleOccurrence', { scheduleID: agentScheduleID, occurrenceKey }),
        harness.call('taskHorizonClaimAgentScheduleOccurrence', { scheduleID: agentScheduleID, occurrenceKey }),
    ]);
    assert.equal(concurrentClaims.filter((result) => result.ok && result.data.claimed).length, 1, 'the kernel must grant one runner per occurrence');
    const winningClaim = concurrentClaims.find((result) => result.ok && result.data.claimed).data;
    const staleScheduleSave = await harness.call('taskHorizonSaveAgentSchedule', {
        ...createdAgentSchedule.data,
        name: '每日任务复盘（已编辑）',
        lastOccurrence: {},
        lastRun: {},
    });
    assert.equal(staleScheduleSave.ok, true);
    assert.equal(staleScheduleSave.data.lastOccurrence.ownerId, winningClaim.ownerID, 'definition edits must not overwrite an active Kernel lease');
    const rejectedRenewal = await harness.call('taskHorizonRenewAgentScheduleOccurrence', {
        scheduleID: agentScheduleID,
        occurrenceKey,
        ownerID: 'another-runner',
    });
    assert.equal(rejectedRenewal.ok, false);
    assert.equal(rejectedRenewal.error.code, 'CONFLICT');
    const renewedOccurrence = await harness.call('taskHorizonRenewAgentScheduleOccurrence', {
        scheduleID: agentScheduleID,
        occurrenceKey,
        ownerID: winningClaim.ownerID,
    });
    assert.equal(renewedOccurrence.ok, true);
    assert.ok(renewedOccurrence.data.leaseUntil >= winningClaim.event.lastOccurrence.leaseUntil, 'the active runner must be able to extend its lease');
    const finishedOccurrence = await harness.call('taskHorizonFinishAgentScheduleOccurrence', {
        scheduleID: agentScheduleID,
        occurrenceKey,
        ownerID: winningClaim.ownerID,
        status: 'succeeded',
        patch: { title: '完成', markdown: '结果' },
    });
    assert.equal(finishedOccurrence.ok, true);
    const terminalClaim = await harness.call('taskHorizonClaimAgentScheduleOccurrence', { scheduleID: agentScheduleID, occurrenceKey });
    assert.equal(terminalClaim.ok, true);
    assert.equal(terminalClaim.data.claimed, false, 'terminal occurrences must stay deduplicated');
    const updatedAgentSchedule = await agentScheduleTool.handler({
        action: 'update',
        scheduleID: agentScheduleID,
        patch: { enabled: false },
    });
    assert.equal(updatedAgentSchedule.ok, true);
    assert.equal(updatedAgentSchedule.data.enabled, false);
    const rpcAgentSchedules = await harness.call('taskHorizonLoadAgentSchedules');
    assert.equal(rpcAgentSchedules.ok, true);
    assert.equal(rpcAgentSchedules.data[0].id, agentScheduleID);
    const deletedAgentSchedule = await agentScheduleTool.handler({ action: 'delete', scheduleID: agentScheduleID });
    assert.equal(deletedAgentSchedule.ok, true);
    assert.deepEqual(JSON.parse(harness.storage.get('agent-scheduled-events.json')), []);

    harness.storage.set('ai-policy-config.json', JSON.stringify({
        schemaVersion: 2,
        revision: 3,
        global: { keywordClassification: [{ keyword: '报销', targetDocumentID: IDS.doc }] },
        documentOverrides: { [IDS.doc]: { keywordClassification: [{ keyword: '会议', targetDocumentID: IDS.doc }] } },
        groupOverrides: { work: { keywordClassification: [{ keyword: '项目', targetDocumentID: IDS.doc }] } },
        previous: { global: { keywordClassification: [{ keyword: '旧规则', targetDocumentID: IDS.doc }] } },
    }));
    const policy = await harness.call('taskHorizonGetPolicy');
    assert.equal(policy.ok, true);
    assert.equal(policy.data.durationDefaults.enabled, true);
    assert.equal(policy.data.durationDefaults.syncToManualDrag, false);
    assert.equal(policy.data.durationDefaults.fallbackMinutes, 25);
    assert.deepEqual(Array.from(policy.data.durationDefaults.rules[0].keywords), ['会议', '例会', '周会']);
    const disabledManualDurations = await harness.call('taskHorizonResolveDurationDefaults', {
        mode: 'manual-drag',
        items: [{ taskID: 'manual-disabled', title: '周会' }],
    });
    assert.equal(disabledManualDurations.ok, true);
    assert.deepEqual(JSON.parse(JSON.stringify(disabledManualDurations.data.items[0])), {
        taskID: 'manual-disabled', minutes: null, source: 'missing', ruleID: '', ruleName: '',
    });
    assert.equal(policy.data.global.keywordClassification, undefined);
    assert.equal(policy.data.documentOverrides[IDS.doc].keywordClassification, undefined);
    assert.equal(policy.data.groupOverrides.work.keywordClassification, undefined);
    assert.equal(policy.data.previous.global.keywordClassification, undefined);
    const removedPolicyPreview = await harness.call('taskHorizonPreviewPolicyPatch', {
        expectedRevision: policy.data.revision,
        patch: { global: { keywordClassification: [] } },
    });
    assert.equal(removedPolicyPreview.ok, false);
    assert.equal(removedPolicyPreview.error.code, 'INVALID_ARGUMENT');
    const policyPreview = await harness.call('taskHorizonPreviewPolicyPatch', {
        expectedRevision: policy.data.revision,
        patch: {
            durationDefaults: { ...policy.data.durationDefaults, syncToManualDrag: true },
            global: { weeklyAvailability: { mon: '09:00-18:00' }, defaultCalendarID: 'default' },
            groupOverrides: { work: { defaultCalendarID: 'group:work', customInstructions: '会议前后预留 15 分钟' } },
            documentOverrides: { [IDS.doc]: { deadlinePriority: { enabled: true, priority: 'high' } } },
        },
    });
    assert.equal(policyPreview.ok, true);
    const policyApply = await harness.call('taskHorizonApplyPolicyPatch', {
        expectedRevision: policyPreview.data.expectedRevision,
        previewToken: policyPreview.data.previewToken,
    });
    assert.equal(policyApply.ok, true);
    assert.equal(policyApply.data.policy.durationDefaults.syncToManualDrag, true);
    assert.equal(policyApply.data.policy.groupOverrides.work.defaultCalendarID, 'group:work');
    assert.equal(policyApply.data.policy.documentOverrides[IDS.doc].deadlinePriority.priority, 'high');
    const effectivePolicy = await harness.mcpTools.get_task_policy.handler({
        action: 'get',
        documentIDs: [IDS.doc],
        durationCandidates: [
            { taskID: 'duration-meeting', title: '准备周会', documentID: IDS.doc },
            { taskID: 'duration-writing', title: '写 Q3 复盘报告', documentID: IDS.doc },
            { taskID: `repeatinst:${IDS.firstTask}:20260720120000`, title: '周报更新', documentID: IDS.doc },
            { taskID: 'duration-sync', title: 'sync project status', documentID: IDS.doc },
            { taskID: 'duration-standup', title: 'standup', documentID: IDS.doc },
            { taskID: 'duration-fallback', title: '同步计划', documentID: IDS.doc },
        ],
    });
    assert.equal(effectivePolicy.ok, true);
    assert.equal(effectivePolicy.data.effectiveByDocument[IDS.doc].documentGroupID, 'work');
    assert.equal(effectivePolicy.data.effectiveByDocument[IDS.doc].config.defaultCalendarID, 'group:work');
    assert.equal(effectivePolicy.data.effectiveByDocument[IDS.doc].config.customInstructions, '会议前后预留 15 分钟');
    assert.equal(effectivePolicy.data.effectiveByDocument[IDS.doc].config.deadlinePriority.priority, 'high');
    assert.deepEqual(Array.from(effectivePolicy.data.durationEstimates, (item) => [item.taskID, item.minutes, item.source]), [
        ['duration-meeting', 30, 'rule'],
        ['duration-writing', 60, 'rule'],
        [`repeatinst:${IDS.firstTask}:20260720120000`, 60, 'rule'],
        ['duration-sync', 25, 'fallback'],
        ['duration-standup', 25, 'fallback'],
        ['duration-fallback', 25, 'fallback'],
    ]);
    const manualDurations = await harness.call('taskHorizonResolveDurationDefaults', {
        mode: 'manual-drag',
        items: [
            { taskID: 'manual-meeting', title: '例会准备' },
            { taskID: 'manual-fallback', title: '整理本周计划' },
        ],
    });
    assert.equal(manualDurations.ok, true);
    assert.deepEqual(Array.from(manualDurations.data.items, (item) => [item.minutes, item.source]), [[30, 'rule'], [15, 'rule']]);
    const invalidDurationDefaults = await harness.call('taskHorizonPreviewPolicyPatch', {
        expectedRevision: policyApply.data.policy.revision,
        patch: { durationDefaults: { ...policyApply.data.policy.durationDefaults, fallbackMinutes: 10 } },
    });
    assert.equal(invalidDurationDefaults.ok, false);
    assert.equal(invalidDurationDefaults.error.code, 'INVALID_ARGUMENT');
    const policyDeletePreview = await harness.call('taskHorizonPreviewPolicyPatch', {
        expectedRevision: policyApply.data.policy.revision,
        patch: { documentOverrides: { [IDS.doc]: null }, groupOverrides: { work: null } },
    });
    const policyDelete = await harness.call('taskHorizonApplyPolicyPatch', {
        expectedRevision: policyDeletePreview.data.expectedRevision,
        previewToken: policyDeletePreview.data.previewToken,
    });
    assert.equal(policyDelete.ok, true);
    assert.equal(policyDelete.data.policy.documentOverrides[IDS.doc], undefined);
    assert.equal(policyDelete.data.policy.groupOverrides.work, undefined);

    const readableFieldSchema = harness.mcpTools.get_task.schema.inputSchema.properties.fields;
    assert.match(readableFieldSchema.description, /completionTime=截止日期/);
    assert.ok(readableFieldSchema.items.enum.includes('customStatus'));
    assert.ok(readableFieldSchema.items.enum.includes('customStatusName'));
    assert.ok(readableFieldSchema.items.enum.includes('priorityName'));
    assert.ok(readableFieldSchema.items.enum.includes('priorityScore'));
    assert.ok(readableFieldSchema.items.enum.includes('attachments'));
    assert.ok(readableFieldSchema.items.enum.includes('customFieldValues'));
    const queryFilterSchema = harness.mcpTools.query_tasks.schema.inputSchema.properties.filters;
    assert.equal(queryFilterSchema.additionalProperties, false);
    assert.equal(queryFilterSchema.properties.dateRange.additionalProperties, false);
    assert.ok(queryFilterSchema.properties.dateRange.properties.field.enum.includes('taskSpan'));
    assert.equal(queryFilterSchema.properties.overdue.type, 'boolean');
    assert.equal(harness.mcpTools.aggregate_task_stats.schema.inputSchema.properties.customFieldIDs.maxItems, 20);
    const kernelSource = fs.readFileSync(path.join(__dirname, '..', 'kernel.js'), 'utf8');
    assert.match(kernelSource, /completionAttrExpression\(names, alias\)[\s\S]*SELECT s\.id FROM blocks s WHERE s\.parent_id = \$\{table\}\.parent_id[\s\S]*ORDER BY s\.sort ASC/, 'attribute filters must only fall back to the parent list for its first task');
    const calendarSource = fs.readFileSync(path.join(__dirname, '..', 'calendar-view.js'), 'utf8');
    assert.match(calendarSource, /async function dedupeReminderBlocks[\s\S]*taskHorizonResolveTaskBinding[\s\S]*primaryHostID/, 'duplicate reminder reads must prefer the real attribute host');
    assert.match(calendarSource, /const safe = await dedupeReminderBlocks/, 'calendar reminder reads must apply logical-task deduplication');

    const uiAttrs = await harness.call('taskHorizonPersistUiTaskAttrs', IDS.singleTask, {
        'custom-task-repeat-rule': '{"enabled":true}',
        'custom-data-assets-th-0': 'assets/example.png',
        'custom-data-assets-th-meta': '[]',
    });
    assert.equal(uiAttrs.ok, true);
    assert.equal(harness.attrs.get(IDS.singleList)['custom-data-assets-th-0'], 'assets/example.png');
    assert.equal(harness.attrs.get(IDS.singleTask)['custom-task-repeat-rule'], '{"enabled":true}');

    const unsafeUiAttrs = await harness.call('taskHorizonPersistUiTaskAttrs', IDS.singleTask, { 'custom-unregistered': 'no' });
    assert.equal(unsafeUiAttrs.ok, false);
    assert.equal(unsafeUiAttrs.error.code, 'INVALID_ARGUMENT');

    const unknownTaskField = await harness.call('taskHorizonUpdateTask', IDS.singleTask, { arbitrary: 'no' });
    assert.equal(unknownTaskField.ok, false);
    assert.equal(unknownTaskField.error.code, 'INVALID_ARGUMENT');

    const marker = await harness.call('taskHorizonPersistUiBlockOperation', { action: 'updateMarker', id: IDS.secondTask, marker: '?' });
    assert.equal(marker.ok, true);
    assert.match(harness.blocks.get(IDS.secondTask).markdown, /^\* \[\?\]/);

    const content = await harness.call('taskHorizonPersistUiBlockOperation', { action: 'updateBlock', id: IDS.secondTask, data: '* [ ] Renamed' });
    assert.equal(content.ok, true);
    assert.equal(harness.blocks.get(IDS.secondTask).content, 'Renamed');

    const createScheduleSchema = harness.mcpTools.create_schedule.schema.inputSchema.properties;
    assert.deepEqual(Array.from(createScheduleSchema.reminderMode.enum), ['inherit', 'custom']);
    assert.equal(createScheduleSchema.reminderEnabled.type, 'boolean');
    assert.equal(createScheduleSchema.reminderOffsetMin.enum, undefined, 'SiYuan Kernel only accepts string-valued JSON Schema enums');
    assert.equal(createScheduleSchema.reminderOffsetMin.minimum, 0);
    assert.equal(createScheduleSchema.reminderOffsetMin.maximum, 60);
    assert.match(createScheduleSchema.reminderOffsetMin.description, /0、5、10、15、30、60/);
    const assertStringSchemaEnums = (value, schemaPath = 'inputSchema') => {
        if (!value || typeof value !== 'object') return;
        if (Array.isArray(value.enum)) {
            assert.equal(value.enum.every((item) => typeof item === 'string'), true, `${schemaPath}.enum must contain strings for SiYuan Kernel`);
        }
        Object.entries(value).forEach(([key, child]) => assertStringSchemaEnums(child, `${schemaPath}.${key}`));
    };
    Object.entries(harness.mcpTools).forEach(([name, tool]) => assertStringSchemaEnums(tool.schema.inputSchema, name));

    const invalidScheduleLink = await harness.mcpTools.create_schedule.handler({
        action: 'create',
        taskId: IDS.doc,
        title: 'Invalid link',
        start: '2026-07-16T09:00:00+08:00',
        end: '2026-07-16T10:00:00+08:00',
    });
    assert.equal(invalidScheduleLink.ok, false);
    assert.equal(invalidScheduleLink.error.code, 'NOT_FOUND');
    const childLinkedSchedule = await harness.mcpTools.create_schedule.handler({
        action: 'create',
        taskId: IDS.childBlock,
        title: 'Canonical link',
        start: '2026-07-16T10:00:00+08:00',
        end: '2026-07-16T11:00:00+08:00',
        reminderMode: 'custom',
        reminderEnabled: true,
        reminderOffsetMin: 15,
    });
    assert.equal(childLinkedSchedule.ok, true);
    assert.equal(childLinkedSchedule.data.schedule.taskId, IDS.singleTask, 'schedule links must store the real task ID');
    assert.equal(childLinkedSchedule.data.schedule.reminderMode, 'custom');
    assert.equal(childLinkedSchedule.data.schedule.reminderEnabled, true);
    assert.equal(childLinkedSchedule.data.schedule.reminderOffsetMin, 15);

    const scheduleUpdate = await harness.call('taskHorizonUpdateSchedule', {
        id: 'schedule-existing',
        patch: {
            title: 'Updated schedule',
            start: '2026-07-14T10:00:00+08:00',
            end: '2026-07-14T11:00:00+08:00',
            reminderMode: 'custom',
            reminderEnabled: false,
            reminderOffsetMin: 30,
        },
    });
    assert.equal(scheduleUpdate.ok, true);
    const savedSchedules = JSON.parse(harness.storage.get('calendar-events.json'));
    assert.equal(savedSchedules[0].reminder.minutes, 15);
    assert.equal(savedSchedules[0].recurrence.type, 'weekly');
    assert.equal(savedSchedules[0].extension, 'keep-me');
    assert.equal(savedSchedules[0].reminderMode, 'custom');
    assert.equal(savedSchedules[0].reminderEnabled, false);
    assert.equal(savedSchedules[0].reminderOffsetMin, 30);

    const inheritedScheduleReminder = await harness.call('taskHorizonUpdateSchedule', {
        id: 'schedule-existing',
        patch: { reminderMode: 'inherit' },
    });
    assert.equal(inheritedScheduleReminder.ok, true);
    assert.equal(inheritedScheduleReminder.data.schedule.reminderMode, 'inherit');
    assert.equal(inheritedScheduleReminder.data.schedule.reminderEnabled, null);
    assert.equal(inheritedScheduleReminder.data.schedule.reminderOffsetMin, null);

    const invalidScheduleReminder = await harness.call('taskHorizonUpdateSchedule', {
        id: 'schedule-existing',
        patch: { reminderMode: 'custom', reminderEnabled: true, reminderOffsetMin: 7 },
    });
    assert.equal(invalidScheduleReminder.ok, false);
    assert.equal(invalidScheduleReminder.error.code, 'INVALID_ARGUMENT');

    const [groupedScheduleA, groupedScheduleB] = await Promise.all([
        harness.call('taskHorizonCreateSchedule', {
            id: 'schedule-group-a', title: 'Group A', start: '2026-07-14T11:00:00+08:00', end: '2026-07-14T11:30:00+08:00',
        }),
        harness.call('taskHorizonCreateSchedule', {
            id: 'schedule-group-b', title: 'Group B', start: '2026-07-14T11:30:00+08:00', end: '2026-07-14T12:00:00+08:00',
        }),
    ]);
    const groupedUndo = await harness.call('taskHorizonGroupUndoMutations', {
        undoIDs: [groupedScheduleB.data.undoID, groupedScheduleA.data.undoID],
        label: '撤销本轮 AI 操作',
    });
    assert.equal(groupedUndo.ok, true);
    assert.equal(groupedUndo.data.count, 2);
    const undoGroupedSchedules = await harness.call('taskHorizonUndoLastMutation', { undoID: groupedUndo.data.undoID });
    assert.equal(undoGroupedSchedules.ok, true);
    assert.equal(JSON.parse(harness.storage.get('calendar-events.json')).some((item) => item.id === 'schedule-group-a'), false);
    assert.equal(JSON.parse(harness.storage.get('calendar-events.json')).some((item) => item.id === 'schedule-group-b'), false);

    await Promise.all([
        harness.call('taskHorizonCreateSchedule', { id: 'schedule-a', title: 'A', start: '2026-07-14T12:00:00+08:00', end: '2026-07-14T12:30:00+08:00' }),
        harness.call('taskHorizonCreateSchedule', { id: 'schedule-b', title: 'B', start: '2026-07-14T13:00:00+08:00', end: '2026-07-14T13:30:00+08:00' }),
    ]);
    assert.equal(JSON.parse(harness.storage.get('calendar-events.json')).length, 4);

    const invalidAction = await harness.mcpTools.create_task.handler({ action: 'update', title: 'Should not write', documentID: IDS.doc });
    assert.equal(invalidAction.ok, false);
    assert.equal(invalidAction.error.code, 'INVALID_ARGUMENT');

    const batchPreview = await harness.mcpTools.batch_tasks.handler({
        action: 'get',
        phase: 'preview',
        operations: [{ kind: 'update', taskID: IDS.singleTask, patch: { priority: 'preview-only' } }],
    });
    assert.equal(batchPreview.ok, true);
    assert.equal(batchPreview.data.previewOnly, true);
    assert.notEqual(harness.attrs.get(IDS.singleList)['custom-priority'], 'preview-only');

    const batchExecute = await harness.mcpTools.batch_tasks.handler({
        action: 'apply',
        phase: 'execute',
        operations: [{ kind: 'update', taskID: IDS.singleTask, patch: { priority: 'batch-value' } }],
    });
    assert.equal(batchExecute.ok, true);
    assert.equal(harness.attrs.get(IDS.singleList)['custom-priority'], 'batch-value');
    assert.equal(batchExecute.data.items[0].changes.refresh.action, 'update');
    const batchUndo = await harness.call('taskHorizonUndoLastMutation', {});
    assert.equal(batchUndo.ok, true);
    assert.equal(harness.attrs.get(IDS.singleList)['custom-priority'], 'high');
    assert.equal(batchUndo.data.data.items[0].refresh.action, 'update');

    const deleteWithoutToken = await harness.mcpTools.delete_task.handler({ action: 'delete', phase: 'execute', taskID: IDS.singleTask });
    assert.equal(deleteWithoutToken.ok, false);
    assert.equal(deleteWithoutToken.error.code, 'CONFIRMATION_REQUIRED');

    const deletePreview = await harness.mcpTools.delete_task.handler({ action: 'get', phase: 'preview', taskID: directCreate.data.task.id });
    assert.equal(deletePreview.ok, true);
    const deletedDirectTask = await harness.mcpTools.delete_task.handler({
        action: 'delete',
        phase: 'execute',
        taskID: directCreate.data.task.id,
        previewToken: deletePreview.data.previewToken,
    });
    assert.equal(deletedDirectTask.ok, true);
    assert.equal(deletedDirectTask.data.refresh.action, 'delete');
    assert.deepEqual(Array.from(deletedDirectTask.data.refresh.taskIDs), [directCreate.data.task.id]);
    assert.deepEqual(Array.from(deletedDirectTask.data.refresh.documentIDs), [IDS.doc]);

    const done = await harness.call('taskHorizonUpdateTask', IDS.singleTask, { done: true });
    assert.equal(done.ok, true);
    assert.equal(done.data.refresh.action, 'update');
    assert.match(harness.blocks.get(IDS.singleTask).markdown, /^\* \[x\]/);
    assert.match(harness.attrs.get(IDS.singleList)['custom-task-complete-at'], /^\d{4}-\d{2}-\d{2}T/);

    const undone = await harness.call('taskHorizonUpdateTask', IDS.singleTask, { done: false });
    assert.equal(undone.ok, true);
    assert.match(harness.blocks.get(IDS.singleTask).markdown, /^\* \[ \]/);
    assert.equal(harness.attrs.get(IDS.singleList)['custom-task-complete-at'], '');

    const guardedUpdate = await harness.call('taskHorizonUpdateTask', IDS.singleTask, { priority: 'undo-guard' });
    assert.equal(guardedUpdate.ok, true);
    harness.attrs.set(IDS.singleList, { ...harness.attrs.get(IDS.singleList), 'custom-priority': 'external-change' });
    const conflictedUndo = await harness.call('taskHorizonUndoLastMutation', {});
    assert.equal(conflictedUndo.ok, false);
    assert.equal(conflictedUndo.error.code, 'CONFLICT');
    assert.equal(harness.attrs.get(IDS.singleList)['custom-priority'], 'external-change');

    const downgraded = await harness.call('taskHorizonSyncMcpEntitlement', { allowed: false });
    assert.equal(downgraded.ok, true);
    assert.equal(downgraded.data.mcpAuthorized, false);
    assert.equal(downgraded.data.mcpEnabled, false);
    assert.equal(downgraded.data.registeredToolCount, 0, 'losing Pro entitlement must unregister every MCP tool immediately');
    const enableAfterDowngrade = await harness.call('taskHorizonSetMcpEnabled', true);
    assert.equal(enableAfterDowngrade.ok, false);
    assert.equal(enableAfterDowngrade.error.code, 'UNSUPPORTED');
    const enableToolAfterDowngrade = await harness.call('taskHorizonSetMcpToolConfig', { toolName: 'create_task', enabled: true });
    assert.equal(enableToolAfterDowngrade.ok, false);
    assert.equal(enableToolAfterDowngrade.error.code, 'UNSUPPORTED');
}

run().then(() => {
    process.stdout.write('kernel contract tests passed\n');
}).catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
