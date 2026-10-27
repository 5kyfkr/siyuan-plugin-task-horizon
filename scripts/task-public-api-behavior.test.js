'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const boundary = read('src/task-horizon/main/33-task-boundary-facades.js');
const recurrence = read('src/task-horizon/main/task-runtime/54-recurring-task-runtime.js');
const list = read('src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js');
const extract = (source, name) => {
    const start = source.search(new RegExp(`    (?:async )?function ${name}\\(`));
    assert.ok(start >= 0, name);
    return source.slice(start, source.indexOf('\n    }', start) + 6);
};
const plain = value => JSON.parse(JSON.stringify(value));
const id = '20261028090000-abcdefg';
const options = [
    { id: 'todo', marker: ' ', name: '待办' }, { id: 'done', marker: 'X', name: '完成' },
    { id: 'working', marker: '/', name: '处理中' }, { id: 'cancelled', marker: '-', name: '放弃' },
];
class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [2026, 9, 28, 12])); }
    static now() { return new Clock().getTime(); }
}

function fixture(plugins = []) {
    const events = new EventTarget();
    const timeouts = new Map();
    const rows = [
        { id, root_id: 'work', content: 'Today #打卡#', customStatus: 'todo', priority: 'high', tags: ['工作'], completionTime: '2026-10-28' },
        { id: '20261028090000-aaaaaaa', root_id: 'work', content: 'Done', done: true },
        { id: '20261028090000-bbbbbbb', root_id: 'other', content: 'Other', completionTime: '2026-10-28' },
    ];
    const calls = [];
    let failRead = false;
    let partialRead = false;
    let readWait = null;
    let writerWait = null;
    let writesFail = false;
    const context = vm.createContext({
        console, Date: Clock, Map, Set, Promise, structuredClone,
        CustomEvent: class extends Event { constructor(name, init) { super(name); this.detail = init.detail; } },
        addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
        dispatchEvent: events.dispatchEvent.bind(events),
        setTimeout(fn, delay) { const key = Symbol(); timeouts.set(key, { fn, delay }); return key; },
        clearTimeout: key => timeouts.delete(key),
        SettingsStore: { loaded: true, data: { currentGroupId: 'work', enablePointsRewardIntegration: false } },
        __tmEnsureSettingsLoaded: async () => {}, __TM_TASK_INDEX_QUERY_LIMIT: 20000,
        resolveDocIdsFromGroups: async ({ groupId }) => { calls.push(['scope', groupId]); return groupId === 'all' ? ['work', 'other'] : ['work']; },
        API: { async getTasksByDocuments(docs) {
            calls.push(['query', ...docs]); if (readWait) await readWait;
            return { tasks: rows.filter(row => docs.includes(row.root_id)), readFailure: failRead, limitReached: partialRead };
        }, parseTaskStatus: () => ({}) },
        MetaStore: { applyToTask() {} }, normalizeTaskFields() {},
        __tmTaskStore: { projectRead: task => ({ ...task }), get: taskId => rows.find(row => row.id === taskId) },
        __tmTaskProjectionEngine: { isTaskCompleted: task => task.done === true },
        __tmIsTaskDoneEffective: task => task.done === true,
        __tmIsCheckinTask: task => task.checkin === true,
        __tmIsTaskCheckinChecked: (task, date) => task.checkedDates?.includes(date.getDate()),
        __tmProjectVisibility: { isTaskHidden: () => false }, __tmIsTaskCanceled: task => task.customStatus === 'cancelled',
        __tmResolveTaskStatusId: task => task.customStatus || (task.done ? 'done' : 'todo'),
        __tmGetStatusOptions: () => options,
        __tmFindStatusOptionById: status => options.find(option => option.id === status),
        __tmDoesStatusIdResolveToDone: status => status === 'done',
        __tmEnsureTaskInStateById: async taskId => rows.find(row => row.id === taskId),
        __tmRequireTaskMutation: kind => async (taskId, value, opts) => {
            calls.push(['write', kind, taskId, value, opts]); if (writerWait) await writerWait;
            if (writesFail) throw new Error('disk unavailable'); return { committed: true };
        },
        RuleManager: {
            applyRuleFilter(tasks, rule, opts) {
                if (!rule.conditions.length) return tasks;
                assert.equal(rule.conditions[0].operator, 'range_overlap_today');
                const date = [opts.nowDate.getFullYear(), String(opts.nowDate.getMonth() + 1).padStart(2, '0'),
                    String(opts.nowDate.getDate()).padStart(2, '0')].join('-');
                return tasks.filter(task => task.checkin || task.completionTime === date);
            },
            applyRuleSort: tasks => tasks,
        },
        __taskHorizonPluginManifest: { version: '3.3.2' },
        __taskHorizonOpenManagerFromTopbarEntry: async opts => { calls.push(['open', opts]); return true; },
        tmSwitchViewMode: view => calls.push(['view', view]),
        __tmIsViewEnabled: view => view !== 'whiteboard',
        __tmSettleTomatoAfterTaskDone: async () => true,
        __tmSynchronizeCompletionLinks: async () => ({ ok: true }),
        __tmSyncParentDoneStateFromSubtasks: async () => null,
        __tmTaskLifecycle: { notifyCompletion() {} },
    });
    context.window = context;
    vm.runInContext(boundary, context);
    const runtime = context.__tmPublicApiRuntime;
    const plugin = { app: { plugins } };
    runtime.install(plugin);
    return { context, runtime, plugin, rows, calls, timeouts, api: context.TaskHorizon,
        setReadFailure: value => { failRead = value; }, setReadWait: value => { readWait = value; },
        setPartialRead: value => { partialRead = value; },
        setWriterWait: value => { writerWait = value; }, setWriteFailure: value => { writesFail = value; } };
}

async function main() {
    const f = fixture();
    assert.equal(f.api.version, '3.3.2');
    assert.equal(f.api.apiVersion, 1);
    assert.ok(Object.isFrozen(f.api));
    assert.equal(Object.getOwnPropertyDescriptor(f.context, 'TaskHorizon').writable, false);
    assert.ok(await f.api.whenReady());
    const result = await f.api.queryTasks({ date: '2026-10-28' });
    assert.equal(result.total, 1);
    assert.deepEqual(plain(result.tasks[0].tags), ['工作', '打卡']);
    result.tasks[0].tags.push('mutation'); result.tasks[0].title = 'mutated';
    assert.equal(f.rows[0].content, 'Today #打卡#');
    const all = await f.api.queryTasks({ scope: 'all', limit: 1 });
    assert.equal(all.total, 2); assert.equal(all.truncated, true);
    assert.equal(all.partial, false, 'a display limit does not imply incomplete source data');
    f.setPartialRead(true);
    assert.equal((await f.api.queryTasks()).partial, true);
    f.setPartialRead(false);
    assert.equal((await f.api.queryTasks({ includeCompleted: true })).total, 2);
    f.rows[0].checkin = true; f.rows[0].checkedDates = [28];
    assert.equal((await f.api.queryTasks({ date: '2026-10-28' })).tasks.length, 0);
    const historical = await f.api.queryTasks({ date: '2026-10-27' });
    assert.equal(historical.tasks[0].done, false, 'check-in completion follows the requested day');
    assert.equal((await f.api.queryTasks({ date: '2026-10-28', includeCompleted: true })).tasks[0].done, true);
    f.rows[0].checkin = false;
    await assert.rejects(f.api.queryTasks({ date: '2026-02-30' }), { code: 'INVALID_ARGUMENT' });
    await assert.rejects(f.api.queryTasks({ scope: 'unknown' }), { code: 'INVALID_ARGUMENT' });
    await assert.rejects(f.api.queryTasks({ limit: 101 }), { code: 'INVALID_ARGUMENT' });
    await assert.rejects(f.api.queryTasks(null), { code: 'INVALID_ARGUMENT' });
    f.setReadFailure(true);
    await assert.rejects(f.api.queryTasks(), { code: 'READ_FAILED' });
    f.setReadFailure(false);
    const pending = Promise.withResolvers(); f.setReadWait(pending.promise);
    const before = f.calls.filter(call => call[0] === 'query').length;
    const first = f.api.queryTasks(), second = f.api.queryTasks();
    await new Promise(setImmediate); pending.resolve();
    const [one, two] = await Promise.all([first, second]);
    assert.equal(f.calls.filter(call => call[0] === 'query').length - before, 1);
    assert.notEqual(one.tasks, two.tasks, 'concurrent consumers must receive independent snapshots');

    for (const [status, method, value] of [['done', 'setDone', true], ['todo', 'setDone', false], ['working', 'setStatus', 'working'], ['cancelled', 'setStatus', 'cancelled']]) {
        assert.equal(await f.api.setTaskStatus(id, status), true);
        const call = f.calls.findLast(call => call[0] === 'write');
        assert.deepEqual(call.slice(1, 4), [method, id, value]);
        assert.equal(call[4].wait, true);
        assert.equal(call[4].statusPatch.customStatus, status);
    }
    const persisted = Promise.withResolvers(); f.setWriterWait(persisted.promise);
    let settled = false;
    const write = f.api.setTaskStatus(id, 'done').then(() => { settled = true; });
    await new Promise(setImmediate); assert.equal(settled, false);
    persisted.resolve(); await write;
    f.setWriteFailure(true);
    await assert.rejects(f.api.setTaskStatus(id, 'done'), /disk unavailable/);
    f.setWriteFailure(false);
    await assert.rejects(f.api.setTaskStatus(id, 'unknown'), { code: 'INVALID_ARGUMENT' });
    await assert.rejects(f.api.setTaskStatus('bad', 'done'), { code: 'INVALID_ARGUMENT' });
    await assert.rejects(f.api.setTaskStatus('20261028090000-ccccccc', 'done'), { code: 'NOT_FOUND' });
    await f.api.openView('calendar');
    assert.equal(f.calls.findLast(call => call[0] === 'view')[1], 'calendar');
    await assert.rejects(f.api.openView('bad'), { code: 'INVALID_ARGUMENT' });
    await assert.rejects(f.api.openView('whiteboard'), { code: 'INVALID_ARGUMENT' });

    const published = [];
    f.context.addEventListener('tm:task-completed', event => published.push(event.detail));
    vm.runInContext(extract(recurrence, '__tmApplyCompletionReceiptEffects'), f.context);
    const receipt = { taskId: id, completedOccurrence: true, recurring: true, outcome: 'committed',
        completedAt: '2026-10-28T09:00:00+08:00', operationId: 'write-1', occurrenceId: 'round-1' };
    await f.context.__tmApplyCompletionReceiptEffects(id, { completion: receipt });
    assert.equal(published.length, 1, 'a committed recurring occurrence emits even when its next-round checkbox is unset');
    assert.equal(published[0].completedAt, Date.parse(receipt.completedAt));
    assert.deepEqual(plain(published[0].tags), ['工作', '打卡']);
    await f.context.__tmApplyCompletionReceiptEffects(id, { completion: receipt });
    await f.context.__tmApplyCompletionReceiptEffects(id, { completion: { ...receipt, outcome: 'alreadyApplied' } });
    await f.context.__tmApplyCompletionReceiptEffects(id, { completion: { ...receipt, completedOccurrence: false } });
    assert.equal(published.length, 1, 'retry, replay and uncomplete must not emit another event');
    for (const source of ['task-repeat-load-reconcile', 'auto-complete-parent-on-subtasks-done', 'undo', 'redo']) {
        assert.equal(f.runtime.notifyCompleted(f.rows[0], { ...receipt, operationId: source }, source), false);
    }
    f.runtime.notifyCompleted(f.rows[0], { ...receipt, operationId: 'write-2', occurrenceId: 'round-2' }, 'public-api');
    assert.equal(published.length, 2, 'a separate completion round has its own identity');
    assert.equal(f.runtime.notifyCompleted(f.rows[0], { ...receipt, completedAt: 'invalid' }), false);
    assert.match(list, /__tmPublicApiRuntime\?\.notifyCompleted/);

    const registrations = [], disposed = [];
    const host = { name: 'siyuan-speed-switch', registerHomeModule(definition) {
        registrations.push(definition); return () => disposed.push(definition.moduleId);
    } };
    f.plugin.app.plugins.push(host); f.context.dispatchEvent(new Event('focus'));
    assert.equal(registrations.length, 1);
    f.runtime.syncWidget(); assert.equal(registrations.length, 1);
    assert.deepEqual(plain(registrations[0].supportedDevices), ['desktop', 'sidebar', 'mobile']);
    const widget = await registrations[0].read();
    assert.equal(widget.items[0].value, id);
    assert.equal(widget.items[0].label, f.rows[0].content);
    assert.equal('done' in widget.items[0], false, 'read-only widgets must not expose the host Markdown toggle');
    f.plugin.app.plugins.splice(0); f.runtime.syncWidget();
    assert.equal(disposed.length, 1);
    f.plugin.app.plugins.push({ ...host }); f.runtime.syncWidget();
    assert.equal(registrations.length, 2);
    f.runtime.cleanup({}); assert.equal(f.context.TaskHorizon, f.api, 'other owners cannot unpublish the facade');
    f.runtime.cleanup(f.plugin);
    assert.equal(f.context.TaskHorizon, undefined);
    assert.equal(f.timeouts.size, 0);
    assert.equal(disposed.length, 2);
    await assert.rejects(f.api.getTodayTasks(), { code: 'UNAVAILABLE' });
    assert.equal(await f.api.whenReady(), false);
    f.context.dispatchEvent(new Event('focus')); assert.equal(registrations.length, 2);
    f.runtime.install(f.plugin);
    const replacement = f.context.TaskHorizon;
    await assert.rejects(f.api.setTaskStatus(id, 'done'), { code: 'UNAVAILABLE' });
    assert.equal(replacement.isReady(), true);
    Object.defineProperty(f.context, 'TaskHorizon', { value: { foreign: true }, configurable: true });
    f.runtime.cleanup(f.plugin);
    assert.equal(f.context.TaskHorizon.foreign, true, 'cleanup must retain a replacement owned by someone else');

    const dying = fixture();
    const wait = Promise.withResolvers(); dying.setReadWait(wait.promise);
    const readAfterUnload = dying.api.queryTasks();
    await new Promise(setImmediate); dying.runtime.cleanup(); wait.resolve();
    await assert.rejects(readAfterUnload, { code: 'UNAVAILABLE' });
    const late = fixture();
    const previousRegistrations = registrations.length;
    late.plugin.app.plugins.push(host);
    const [timer, discovery] = late.timeouts.entries().next().value;
    late.timeouts.delete(timer); discovery.fn();
    assert.equal(registrations.length, previousRegistrations + 1, 'late plugin enable must be discovered without a focus change');
    late.runtime.cleanup();
    assert.equal(late.timeouts.size, 0);
    console.log('Public plugin API, committed completion events and Raikiri widget lifecycle behavior passed');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
