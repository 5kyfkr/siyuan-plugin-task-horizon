'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const TASK_COUNT = 1000;
const taskIDs = Array.from({ length: TASK_COUNT }, (_, index) => `20260101${String(index).padStart(6, '0')}-task`);
const documentID = '20260101000000-doc';

function virtualTask(index = 0) {
    const sourceTaskID = taskIDs[index % taskIDs.length];
    return {
        id: `repeatinst:${sourceTaskID}:202601${String(index).padStart(8, '0')}`,
        sourceTaskID,
        title: `Recurring completion ${index}`,
        markdown: `- [x] Recurring completion ${index}`,
        documentID,
        documentName: 'Scope Doc',
        priority: 'high',
        priorityScore: 180,
        customStatus: 'done',
        startDate: '2026-01-01',
        completionTime: '2026-01-02',
        taskCompleteAt: '2026-01-02T08:00:00+08:00',
        duration: '45分钟',
        remark: 'Recurring read-only record',
        tomatoEstimateCount: 2,
        tomatoCount: 1,
        tomatoMinutes: 25,
        attachments: [{ path: 'assets/recurring.pdf', name: 'recurring.pdf', kind: 'asset' }],
        customFieldValues: { energy: 'high' },
    };
}

function taskRow(id, index) {
    return {
        id,
        markdown: '* [x] Task',
        raw_content: `Task ${index}`,
        parent_id: `20260102${String(index).padStart(6, '0')}-list`,
        root_id: documentID,
        box: 'box',
        block_path: '',
        block_sort: index,
        created: '20260101000000',
        updated: '20260101000000',
        doc_name: 'Scope Doc',
        doc_path: '/Scope Doc',
        parent_type: 'l',
        parent_task_count: 1,
        first_task_id: id,
        title: `Task ${index}`,
        completed_at: '2026-01-01T08:00:00+08:00',
        custom_status: 'done',
        priority: 'normal',
        estimate: '30',
        tomato_minutes: '20',
        tomato_hours: '',
    };
}

async function run() {
    let now = Date.parse('2026-07-15T00:00:00Z');
    let lastSQL = '';
    const rpcCalls = {};
    const mcpTools = {};
    const schedules = taskIDs.slice(0, 600).map((taskId, index) => ({
        id: `schedule-${index}`,
        taskId,
        start: '2026-01-01T09:00:00+08:00',
        end: '2026-01-01T09:30:00+08:00',
    }));
    const storage = new Map([
        ['agent-mcp-config.json', JSON.stringify({ schemaVersion: 2, enabled: true, tools: {} })],
        ['task-attr-storage.json', JSON.stringify({ version: 1, status: 'complete' })],
        ['task-settings.json', JSON.stringify({})],
        ['calendar-events.json', JSON.stringify(schedules)],
    ]);
    class FakeDate extends Date {
        static now() { return now; }
    }
    const query = (statement) => {
        lastSQL = statement;
        if (/1 = 0/.test(statement)) return [];
        const taskTreeMatch = statement.match(/WITH RECURSIVE task_tree\(id, depth\)[\s\S]*SELECT id, 0 FROM blocks WHERE id = '([^']+)'/);
        if (taskTreeMatch) return taskIDs.includes(taskTreeMatch[1]) ? [{ id: taskTreeMatch[1] }] : [];
        if (/FROM blocks task/.test(statement)) return taskIDs.slice(0, 201).map(taskRow);
        if (/SELECT COUNT\(\*\) AS completed_in_scope/.test(statement)) {
            return [{ completed_in_scope: TASK_COUNT, missing_completion_time: 0 }];
        }
        if (/FROM blocks t LEFT JOIN blocks d/.test(statement)) return taskIDs.map(taskRow);
        if (/SELECT t\.id,/.test(statement) && /FROM blocks t WHERE/.test(statement)) return taskIDs.map(taskRow);
        throw new Error(`Unhandled SQL: ${statement}`);
    };
    const siyuan = {
        plugin: { lifecycle: {} },
        rpc: {
            async bind(name, handler) { rpcCalls[name] = handler; },
            async unbind(name) { delete rpcCalls[name]; },
        },
        agent: {
            async registerCapability(name, schema, handler) { mcpTools[name] = { schema, handler }; },
            async unregisterCapability(name) { delete mcpTools[name]; },
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
                    const body = JSON.parse(options?.body || '{}');
                    if (pathname === '/api/query/sql') return { ok: true, status: 200, async json() { return { code: 0, data: query(String(body.stmt || '')) }; } };
                    if (pathname === '/api/attr/getBlockAttrs') return { ok: true, status: 200, async json() { return { code: 0, data: {} }; } };
                    if (pathname === '/api/block/deleteBlock') return { ok: true, status: 200, async json() { return { code: 0, data: null }; } };
                    throw new Error(`Unhandled API: ${pathname}`);
                } catch (error) {
                    return { ok: true, status: 200, async json() { return { code: -1, msg: error.message }; } };
                }
            },
        },
    };
    const source = fs.readFileSync(path.join(__dirname, '..', 'kernel.js'), 'utf8');
    vm.runInNewContext(source, { siyuan, console, setTimeout, clearTimeout, Date: FakeDate, Math, JSON, Map, Set, Promise });
    await siyuan.plugin.lifecycle.onload();
    const entitlement = await rpcCalls.taskHorizonSyncMcpEntitlement({ allowed: true });
    assert.equal(entitlement.ok, true);
    assert.equal(entitlement.data.mcpEnabled, true);

    const registered = await rpcCalls.taskHorizonRegisterTaskScope({
        scopeID: 'group-a|all',
        taskIDs,
        documentIDs: [documentID],
        taskValues: taskIDs.map((id, index) => ({
            id,
            priorityScore: index + 100,
            tomatoMinutes: index === 0 ? 5 : 0,
            tomatoHours: index === 0 ? 0.08 : 0,
            tomatoCount: index === 0 ? 1 : 0,
        })),
    });
    assert.equal(registered.ok, true);
    assert.equal(registered.data.taskCount, TASK_COUNT);
    assert.ok(registered.data.scopeToken.startsWith('task_scope_'));

    const queryResult = await mcpTools.query_tasks.handler({ action: 'query', filters: { scopeToken: registered.data.scopeToken }, fields: ['title', 'priorityScore', 'tomatoMinutes', 'tomatoHours', 'tomatoCount'], limit: 200 });
    assert.equal(queryResult.ok, true);
    assert.equal(queryResult.data.items.length, 200);
    assert.ok(queryResult.data.nextCursor);
    assert.equal(queryResult.data.items[0].priorityScore, 100);
    assert.equal(queryResult.data.items[0].tomatoMinutes, 5, 'scoped recurring focus minutes must override the cumulative task attribute');
    assert.equal(queryResult.data.items[0].tomatoHours, 0.08);
    assert.equal(queryResult.data.items[0].tomatoCount, 1);
    assert.match(lastSQL, new RegExp(taskIDs[0]));
    assert.match(lastSQL, new RegExp(taskIDs[TASK_COUNT - 1]));

    const documentScope = await rpcCalls.taskHorizonRegisterTaskScope({
        scopeID: 'focused-document',
        scopeMode: 'documents',
        taskIDs: [],
        documentIDs: [documentID],
    });
    assert.equal(documentScope.ok, true);
    assert.equal(documentScope.data.scopeMode, 'documents');
    const documentQuery = await mcpTools.query_tasks.handler({ action: 'query', filters: { scopeToken: documentScope.data.scopeToken }, limit: 50 });
    assert.equal(documentQuery.ok, true);
    assert.equal(documentQuery.data.items.length, 50);
    assert.match(lastSQL, new RegExp(`task\\.root_id IN \\('${documentID}'\\)`));
    assert.doesNotMatch(lastSQL, /task\.id IN/);

    const compactDocumentScope = await rpcCalls.taskHorizonRegisterTaskScope({
        scopeID: 'compact-document',
        scopeMode: 'documents',
        taskIDs: [],
        documentIDs: [documentID],
        taskValues: taskIDs.slice(0, 3).map((id, index) => ({ id, documentID, priorityScore: 300 + index })),
    });
    assert.equal(compactDocumentScope.ok, true);
    assert.equal(compactDocumentScope.data.realTaskCount, 3);
    const compactDocumentQuery = await mcpTools.query_tasks.handler({
        action: 'query',
        filters: { scopeToken: compactDocumentScope.data.scopeToken },
        fields: ['title', 'priorityScore'],
        limit: 3,
    });
    assert.equal(compactDocumentQuery.ok, true);
    assert.equal(compactDocumentQuery.data.items[0].priorityScore, 300);
    assert.match(lastSQL, new RegExp(`task\\.root_id IN \\('${documentID}'\\)`));
    assert.doesNotMatch(lastSQL, /task\.id IN/);

    const filterSchema = mcpTools.query_tasks.schema.inputSchema.properties.filters;
    assert.equal(filterSchema.additionalProperties, false);
    assert.deepEqual(Array.from(filterSchema.properties.dateRange.properties.field.enum), ['taskSpan', 'startDate', 'completionTime', 'taskCompleteAt']);
    assert.equal(filterSchema.properties.priorities.maxItems, 50);
    assert.equal(filterSchema.properties.customStatuses.maxItems, 50);
    assert.equal(filterSchema.properties.includeVirtual.type, 'boolean');
    const filteredQuery = await mcpTools.query_tasks.handler({
        action: 'query',
        filters: {
            scopeToken: documentScope.data.scopeToken,
            done: false,
            dateRange: { field: 'taskSpan', from: '2026-07-01', to: '2026-07-31', mode: 'overlap' },
            overdue: true,
            priorities: ['high'],
            customStatuses: ['in_progress'],
            includeVirtual: false,
        },
        limit: 5,
    });
    assert.equal(filteredQuery.ok, true);
    assert.match(lastSQL, /NOT \(task\.markdown LIKE/);
    assert.match(lastSQL, /custom-priority/);
    assert.match(lastSQL, /custom-status/);
    assert.match(lastSQL, /custom-start-date/);
    assert.match(lastSQL, /custom-completion-time/);
    assert.match(lastSQL, /2026-07-01/);
    assert.match(lastSQL, /2026-07-31/);
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    assert.match(lastSQL, new RegExp(todayKey));
    const invalidDateRange = await mcpTools.query_tasks.handler({
        action: 'query',
        filters: { scopeToken: documentScope.data.scopeToken, dateRange: { field: 'completionTime', from: '07/01/2026' } },
    });
    assert.equal(invalidDateRange.ok, false);
    assert.equal(invalidDateRange.error.code, 'INVALID_ARGUMENT');

    const virtualItems = Array.from({ length: 250 }, (_, index) => virtualTask(index));
    const virtualScope = await rpcCalls.taskHorizonRegisterTaskScope({
        scopeID: 'recurring-history',
        taskIDs: [],
        documentIDs: [documentID],
        virtualTasks: virtualItems,
    });
    assert.equal(virtualScope.ok, true);
    assert.equal(virtualScope.data.taskCount, 250);
    assert.equal(virtualScope.data.realTaskCount, 0);
    assert.equal(virtualScope.data.virtualTaskCount, 250);

    const virtualFirstPage = await mcpTools.query_tasks.handler({
        action: 'query',
        filters: { scopeToken: virtualScope.data.scopeToken },
        limit: 200,
    });
    assert.equal(virtualFirstPage.ok, true);
    assert.equal(virtualFirstPage.data.items.length, 200);
    assert.equal(virtualFirstPage.data.items[0].virtualTask, true);
    assert.equal(virtualFirstPage.data.items[0].readOnly, true);
    assert.equal(virtualFirstPage.data.items[0].priorityScore, 180);
    assert.equal(virtualFirstPage.data.items[0].taskCompleteAt, '2026-01-02T08:00:00+08:00');
    assert.equal(virtualFirstPage.data.items[0].tomatoMinutes, 25);
    assert.equal(virtualFirstPage.data.items[0].attachments[0].path, 'assets/recurring.pdf');
    assert.equal(virtualFirstPage.data.items[0].customFieldValues.energy, 'high');
    assert.equal(virtualFirstPage.data.nextCursor, 'virtual:200');

    const filteredVirtual = await mcpTools.query_tasks.handler({
        action: 'query',
        filters: {
            scopeToken: virtualScope.data.scopeToken,
            dateRange: { field: 'completionTime', from: '2026-01-02', to: '2026-01-02' },
            priorities: ['high'],
            customStatuses: ['done'],
            includeVirtual: true,
        },
        limit: 200,
    });
    assert.equal(filteredVirtual.ok, true);
    assert.equal(filteredVirtual.data.items.length, 200);
    const hiddenVirtual = await mcpTools.query_tasks.handler({
        action: 'query',
        filters: { scopeToken: virtualScope.data.scopeToken, includeVirtual: false },
        limit: 200,
    });
    assert.equal(hiddenVirtual.ok, true);
    assert.equal(hiddenVirtual.data.items.length, 0);

    const virtualSecondPage = await mcpTools.query_tasks.handler({
        action: 'query',
        filters: { scopeToken: virtualScope.data.scopeToken },
        limit: 200,
        cursor: virtualFirstPage.data.nextCursor,
    });
    assert.equal(virtualSecondPage.ok, true);
    assert.equal(virtualSecondPage.data.items.length, 50);
    assert.equal(virtualSecondPage.data.nextCursor, '');

    const virtualWithoutScope = await mcpTools.get_task.handler({ action: 'get', taskID: virtualItems[0].id });
    assert.equal(virtualWithoutScope.ok, false);
    assert.equal(virtualWithoutScope.error.code, 'NOT_FOUND');
    const virtualRead = await mcpTools.get_task.handler({ action: 'get', taskID: virtualItems[0].id, scopeToken: virtualScope.data.scopeToken });
    assert.equal(virtualRead.ok, true);
    assert.equal(virtualRead.data.sourceTaskID, virtualItems[0].sourceTaskID);
    assert.equal(virtualRead.data.virtualType, 'recurring-history');

    const createScheduleSchema = mcpTools.create_schedule.schema.inputSchema.properties;
    const updateScheduleSchema = mcpTools.update_schedule.schema.inputSchema.properties;
    assert.equal(createScheduleSchema.scopeToken.type, 'string');
    assert.equal(updateScheduleSchema.scopeToken.type, 'string');
    const virtualScheduleInput = {
        action: 'create',
        taskId: virtualItems[0].id,
        start: '2026-07-16T09:00:00+08:00',
        end: '2026-07-16T09:45:00+08:00',
    };
    const virtualScheduleWithoutScope = await mcpTools.create_schedule.handler(virtualScheduleInput);
    assert.equal(virtualScheduleWithoutScope.ok, false);
    assert.equal(virtualScheduleWithoutScope.error.code, 'NOT_FOUND');
    const virtualScheduleWrongScope = await mcpTools.create_schedule.handler({ ...virtualScheduleInput, scopeToken: registered.data.scopeToken });
    assert.equal(virtualScheduleWrongScope.ok, false);
    assert.equal(virtualScheduleWrongScope.error.code, 'NOT_FOUND');

    const virtualScheduleCreate = await mcpTools.create_schedule.handler({ ...virtualScheduleInput, scopeToken: virtualScope.data.scopeToken });
    assert.equal(virtualScheduleCreate.ok, true);
    const virtualSchedule = virtualScheduleCreate.data.schedule;
    assert.equal(virtualSchedule.taskId, virtualItems[0].id);
    assert.equal(virtualSchedule.title, virtualItems[0].title);
    assert.equal(virtualSchedule.virtualTask, true);
    assert.equal(virtualSchedule.virtualType, 'recurring-history');
    assert.equal(virtualSchedule.sourceTaskId, virtualItems[0].sourceTaskID);
    assert.equal(virtualSchedule.docId, documentID);
    assert.equal(virtualSchedule.recurringCompletedAt, virtualItems[0].taskCompleteAt);

    const queriedVirtualSchedule = await mcpTools.query_schedules.handler({
        action: 'query',
        filters: { taskIDs: [virtualItems[0].id] },
    });
    assert.equal(queriedVirtualSchedule.ok, true);
    assert.equal(queriedVirtualSchedule.data.items.some((item) => item.id === virtualSchedule.id), true);

    const virtualScheduleTimeUpdate = await mcpTools.update_schedule.handler({
        action: 'update',
        id: virtualSchedule.id,
        patch: {
            start: '2026-07-16T10:00:00+08:00',
            end: '2026-07-16T10:45:00+08:00',
        },
    });
    assert.equal(virtualScheduleTimeUpdate.ok, true);
    assert.equal(virtualScheduleTimeUpdate.data.schedule.taskId, virtualItems[0].id);
    assert.equal(virtualScheduleTimeUpdate.data.schedule.sourceTaskId, virtualItems[0].sourceTaskID);
    assert.equal(virtualScheduleTimeUpdate.data.schedule.virtualTask, true);

    const virtualScheduleRelink = await mcpTools.update_schedule.handler({
        action: 'update',
        id: virtualSchedule.id,
        scopeToken: virtualScope.data.scopeToken,
        patch: { taskId: virtualItems[1].id },
    });
    assert.equal(virtualScheduleRelink.ok, true);
    assert.equal(virtualScheduleRelink.data.schedule.taskId, virtualItems[1].id);
    assert.equal(virtualScheduleRelink.data.schedule.sourceTaskId, virtualItems[1].sourceTaskID);
    const undoVirtualScheduleRelink = await rpcCalls.taskHorizonUndoLastMutation({});
    assert.equal(undoVirtualScheduleRelink.ok, true);
    assert.equal(undoVirtualScheduleRelink.data.data.schedule.taskId, virtualItems[0].id);
    assert.equal(undoVirtualScheduleRelink.data.data.schedule.sourceTaskId, virtualItems[0].sourceTaskID);
    assert.equal(undoVirtualScheduleRelink.data.data.schedule.virtualTask, true);

    const batchVirtualSchedule = await mcpTools.batch_schedules.handler({
        action: 'apply',
        phase: 'execute',
        operations: [{
            kind: 'create',
            taskId: virtualItems[2].id,
            scopeToken: virtualScope.data.scopeToken,
            start: '2026-07-17T09:00:00+08:00',
            end: '2026-07-17T09:45:00+08:00',
        }],
    });
    assert.equal(batchVirtualSchedule.ok, true);
    assert.equal(batchVirtualSchedule.data.summary.succeeded, 1);
    assert.equal(batchVirtualSchedule.data.items[0].changes.schedule.virtualTask, true);

    const plannedVirtualSchedule = await mcpTools.apply_task_operation_plan.handler({
        action: 'apply',
        taskOperations: [],
        scheduleOperations: [{
            kind: 'create',
            taskId: virtualItems[3].id,
            scopeToken: virtualScope.data.scopeToken,
            start: '2026-07-18T09:00:00+08:00',
            end: '2026-07-18T09:45:00+08:00',
        }],
    });
    assert.equal(plannedVirtualSchedule.ok, true);
    assert.equal(plannedVirtualSchedule.data.summary.succeeded, 1);
    assert.equal(plannedVirtualSchedule.data.items[0].changes.schedule.sourceTaskId, virtualItems[3].sourceTaskID);

    const virtualUpdate = await mcpTools.update_task.handler({ action: 'update', taskID: virtualItems[0].id, patch: { priority: 'low' } });
    assert.equal(virtualUpdate.ok, false);
    assert.equal(virtualUpdate.error.code, 'INVALID_ARGUMENT');
    const virtualDelete = await mcpTools.delete_task.handler({ action: 'get', phase: 'preview', taskID: virtualItems[0].id });
    assert.equal(virtualDelete.ok, false);
    assert.equal(virtualDelete.error.code, 'INVALID_ARGUMENT');

    const virtualStats = await mcpTools.aggregate_task_stats.handler({ action: 'query', scopeToken: virtualScope.data.scopeToken });
    assert.equal(virtualStats.ok, true);
    assert.equal(virtualStats.data.totalCompleted, 0);
    assert.equal(virtualStats.data.coverage.virtualTaskCount, 250);
    assert.equal(virtualStats.data.coverage.virtualTasksIncluded, false);

    const stats = await mcpTools.aggregate_task_stats.handler({ action: 'query', scopeToken: registered.data.scopeToken, period: 'month' });
    assert.equal(stats.ok, true);
    assert.equal(stats.data.totalCompleted, TASK_COUNT);
    assert.equal(stats.data.coverage.taskCount, TASK_COUNT);
    assert.equal(Object.hasOwn(stats.data.coverage, 'taskIDs'), false);

    const usage = await mcpTools.aggregate_time_usage.handler({ action: 'query', scopeToken: registered.data.scopeToken });
    assert.equal(usage.ok, true);
    assert.equal(usage.data.estimated.availableCount, TASK_COUNT);
    assert.equal(usage.data.planned.availableCount, 600);
    assert.equal(usage.data.coverage.taskCount, TASK_COUNT);

    const sourceDeletePreview = await mcpTools.delete_task.handler({ action: 'get', phase: 'preview', taskID: virtualItems[0].sourceTaskID });
    assert.equal(sourceDeletePreview.ok, true);
    assert.equal(sourceDeletePreview.data.linkedScheduleCount, 2);
    const sourceDelete = await mcpTools.delete_task.handler({
        action: 'delete',
        phase: 'execute',
        taskID: virtualItems[0].sourceTaskID,
        previewToken: sourceDeletePreview.data.previewToken,
    });
    assert.equal(sourceDelete.ok, true);
    const sourceSchedulesAfterDelete = await mcpTools.query_schedules.handler({
        action: 'query',
        filters: { taskIDs: [virtualItems[0].sourceTaskID, virtualItems[0].id] },
    });
    assert.equal(sourceSchedulesAfterDelete.ok, true);
    assert.equal(sourceSchedulesAfterDelete.data.items.length, 0);

    const empty = await rpcCalls.taskHorizonRegisterTaskScope({ scopeID: 'empty', taskIDs: [], documentIDs: [documentID] });
    const emptyQuery = await mcpTools.query_tasks.handler({ action: 'query', filters: { scopeToken: empty.data.scopeToken }, limit: 50 });
    assert.equal(emptyQuery.ok, true);
    assert.equal(emptyQuery.data.items.length, 0);
    assert.match(lastSQL, /1 = 0/);

    const second = await rpcCalls.taskHorizonRegisterTaskScope({ scopeID: 'group-b|all', taskIDs: taskIDs.slice(0, 5), documentIDs: [documentID] });
    assert.notEqual(second.data.scopeToken, registered.data.scopeToken);
    assert.equal(second.data.taskCount, 5);

    const unknown = await mcpTools.query_tasks.handler({ action: 'query', filters: { scopeToken: 'task_scope_missing' } });
    assert.equal(unknown.ok, false);
    assert.equal(unknown.error.code, 'NOT_FOUND');

    now += 11 * 60 * 1000;
    const expired = await mcpTools.aggregate_task_stats.handler({ action: 'query', scopeToken: second.data.scopeToken });
    assert.equal(expired.ok, false);
    assert.equal(expired.error.code, 'NOT_FOUND');

    now = Date.parse('2026-07-15T01:00:00Z');
    const tokens = [];
    for (let index = 0; index < 65; index += 1) {
        const item = await rpcCalls.taskHorizonRegisterTaskScope({ scopeID: `bounded-${index}`, taskIDs: [taskIDs[index]], documentIDs: [documentID] });
        tokens.push(item.data.scopeToken);
    }
    const evicted = await mcpTools.query_tasks.handler({ action: 'query', filters: { scopeToken: tokens[0] } });
    assert.equal(evicted.ok, false);
    assert.equal(evicted.error.code, 'NOT_FOUND');

    process.stdout.write('task scope token tests passed\n');
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
