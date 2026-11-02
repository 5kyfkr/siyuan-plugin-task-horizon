'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, 'src/task-horizon/main', file), 'utf8');
const stateSource = read('32-runtime-state-and-events.js');
const windowSource = read('21-view-render-state.js');
const schemaSource = read('09-task-field-schema.js');
const projectionSource = read('34-task-projection-engine.js');
const renderer = read('render/43-render-timeline-kanban-calendar-body.js');

class FakeElement {}

function createHarness(options = {}) {
    const tasks = Array.from({ length: 40 }, (_, index) => ({
        id: 'task-' + index, root_id: 'doc-one', content: 'Original title', remark: '', children: [],
    }));
    const timers = new Map();
    let timerId = 0;
    let generation = 1;
    const body = new FakeElement();
    const columnBody = new FakeElement();
    columnBody.scrollTop = 600;
    const column = Object.assign(new FakeElement(), {
        classList: { contains: () => false },
        querySelector: () => columnBody,
    });
    const modal = Object.assign(new FakeElement(), { querySelector: () => body });
    const context = vm.createContext({
        console, Map, Set, Symbol,
        Element: FakeElement, HTMLElement: FakeElement,
        queueMicrotask: () => {},
        setTimeout: (callback) => { timers.set(++timerId, callback); return timerId; },
        clearTimeout: (timer) => timers.delete(timer),
        state: {
            flatTasks: Object.fromEntries(tasks.map((task) => [task.id, task])),
            taskTree: [{ id: 'doc-one', tasks }], filteredTasks: tasks, otherBlocks: [],
            viewMode: 'kanban', modal,
            groupByTime: options.groupByTime === true,
        },
        SettingsStore: { data: {} },
        MetaStore: { set() {} },
        __tmProjectionService: { getAppliedGeneration: () => generation },
    });
    vm.runInContext([stateSource, schemaSource, projectionSource, windowSource].join('\n'), context);
    context.__tmAnalyzeTaskProjectionPatch = (_taskId, patch) => context.__tmTaskProjectionEngine.analyzePatch(patch, {
        viewMode: 'kanban', groupMode: context.state.groupByTime ? 'time' : 'none', rule: context.state.rule,
    });
    context.__tmTaskBoundary = { getTask: (taskId) => context.__tmTaskStore.getProjected(taskId) };
    context.__tmTaskStore.replaceFlat(context.state.flatTasks, { authoritative: true, mergeOtherBlocks: false });
    context.__tmGetKanbanProgressiveColumnElement = () => column;
    context.__tmIsKanbanProgressiveColumnVisible = () => true;
    context.__tmIsKanbanProgressiveColumnNearBottom = () => true;
    const resolverStart = renderer.indexOf('const resolveKanbanProjectedTask =');
    const resolverEnd = renderer.indexOf('const filteredRawTaskById =', resolverStart);
    assert.ok(resolverStart >= 0 && resolverEnd > resolverStart);
    vm.runInContext('const kanbanProjectedTaskById = new Map();\n'
        + renderer.slice(resolverStart, resolverEnd)
        + '\nthis.resolveDeferredTask = resolveKanbanProjectedTask;'
        + '\nthis.clearDeferredTasks = () => kanbanProjectedTaskById.clear();', context);
    const job = context.__tmStartProgressiveViewRender('kanban');
    const mountedCards = tasks.slice(0, 10).map((task) => ({ id: task.id }));
    const initialCards = mountedCards.slice();
    const deferredRows = tasks.map((task) => context.resolveDeferredTask(task));
    let loaded = 10;
    context.__tmRegisterKanbanProgressiveColumn(job, {
        key: 'todo', loaded: true,
        loadNextBatch: () => {
            context.clearDeferredTasks();
            const nextLimit = Math.min(tasks.length, loaded + job.batchSize);
            for (const task of deferredRows.slice(loaded, nextLimit)) {
                const latest = context.resolveDeferredTask(task);
                mountedCards.push({ id: latest.id, content: latest.content, remark: latest.remark });
            }
            loaded = nextLimit;
            return { done: loaded === tasks.length };
        },
    });
    const mutate = (phase, patch, extra = {}) => context.__tmTaskStore.applyMutation({
        type: 'taskPatch', phase, opId: 'edit-field', taskId: 'task-15', patch, ...extra,
    });
    return {
        context, job, mountedCards, initialCards, columnBody, timers, mutate,
        changeGeneration: () => { generation += 1; },
        flushOne: () => {
            const next = timers.entries().next().value;
            assert.ok(next, 'a safe field mutation must resume the viewport loader');
            timers.delete(next[0]);
            next[1]();
        },
    };
}

const harness = createHarness();
const originalColumns = harness.job.columns;
const originalSource = harness.context.state.filteredTasks;
harness.mutate('optimistic', { remark: 'Updated remark' });
assert.equal(harness.context.__tmIsProgressiveViewRenderCurrent(harness.job, 'kanban'), true,
    'a remark edit must preserve the active progressive job');
harness.mutate('commit', { remark: 'Updated remark' });
assert.equal(harness.context.__tmIsProgressiveViewRenderCurrent(harness.job, 'kanban'), true,
    'field commits must resume loading even though they do not schedule another projection');
assert.strictEqual(harness.job.columns, originalColumns);
assert.strictEqual(harness.context.state.filteredTasks, originalSource);
harness.flushOne();
assert.equal(harness.mountedCards.length, 20, 'continuation must append one batch, not restart the first batch');
assert.strictEqual(harness.mountedCards[0], harness.initialCards[0], 'mounted cards must retain their identity');
assert.equal(harness.columnBody.scrollTop, 600, 'field updates must not reset the scroll position');
assert.equal(harness.mountedCards.find((card) => card.id === 'task-15').remark, 'Updated remark');
harness.context.__tmCancelProgressiveViewRender();
assert.equal(harness.job.status, 'cancelled');
assert.equal(harness.job.unsubscribeTaskStore, null, 'cancelled jobs must release their store subscription');
const cancelledRevision = harness.job.taskStoreRevision;
harness.mutate('local', { remark: 'Later edit' });
assert.equal(harness.job.taskStoreRevision, cancelledRevision);
assert.equal(harness.timers.size, 0);

const rollback = createHarness();
rollback.mutate('optimistic', { remark: 'Failed edit' });
rollback.mutate('rollback', { remark: 'Failed edit' }, { inversePatch: { remark: '' } });
assert.equal(rollback.context.__tmIsProgressiveViewRenderCurrent(rollback.job, 'kanban'), true);
rollback.flushOne();
assert.equal(rollback.mountedCards.find((card) => card.id === 'task-15').remark, '');
rollback.context.__tmCancelProgressiveViewRender();

for (const invalidate of [
    (probe) => { probe.context.state.filteredTasks = probe.context.state.filteredTasks.slice(); },
    (probe) => { probe.context.state.activeDocId = 'other-document'; },
    (probe) => { probe.context.state.viewMode = 'list'; },
    (probe) => probe.changeGeneration(),
    (probe) => probe.mutate('local', { done: true }),
    (probe) => probe.mutate('local', { parentTaskId: 'other-parent' }),
    (probe) => probe.mutate('local', { remark: 'Deferred' }, { data: { deferProjection: true } }),
]) {
    const probe = createHarness();
    const revision = probe.job.taskStoreRevision;
    invalidate(probe);
    probe.mutate('local', { remark: 'Another edit' });
    assert.equal(probe.job.taskStoreRevision, revision, 'a field patch must not revive an invalidated view job');
    assert.equal(probe.timers.size, 0, 'stale contexts and structural changes must not append old cards');
    probe.context.__tmCancelProgressiveViewRender();
}

const orderedByRemark = createHarness();
orderedByRemark.context.state.rule = { sort: [{ field: 'remark' }] };
orderedByRemark.mutate('local', { remark: 'Changes ordering' });
assert.equal(orderedByRemark.context.__tmIsProgressiveViewRenderCurrent(orderedByRemark.job, 'kanban'), false,
    'a field used by the active ordering rule must still invalidate the captured column order');
orderedByRemark.context.__tmCancelProgressiveViewRender();

const projectedCommit = createHarness({ groupByTime: true });
projectedCommit.mutate('optimistic', { completionTime: '2026-11-03' });
const movedJob = projectedCommit.context.__tmStartProgressiveViewRender('kanban');
let resumedLoads = 0;
projectedCommit.context.__tmRegisterKanbanProgressiveColumn(movedJob, {
    key: 'time:tomorrow',
    loaded: false,
    loadNextBatch: () => {
        resumedLoads += 1;
        return { done: true };
    },
});
assert.equal(projectedCommit.context.__tmIsProgressiveViewRenderCurrent(movedJob, 'kanban'), true);
projectedCommit.mutate('commit', { completionTime: '2026-11-03' });
assert.equal(projectedCommit.context.__tmIsProgressiveViewRenderCurrent(movedJob, 'kanban'), true,
    'a projection-affecting commit with the applied projection must keep the moved column loadable');
projectedCommit.flushOne();
assert.equal(resumedLoads, 1, 'the offscreen destination column must resume loading after the write commits');
projectedCommit.context.__tmCancelProgressiveViewRender();

const statusCommit = createHarness();
statusCommit.mutate('optimistic', { customStatus: 'doing' });
const statusJob = statusCommit.context.__tmStartProgressiveViewRender('kanban');
let statusLoads = 0;
statusCommit.context.__tmRegisterKanbanProgressiveColumn(statusJob, {
    key: 'status:doing',
    loaded: false,
    loadNextBatch: () => {
        statusLoads += 1;
        return { done: true };
    },
});
statusCommit.mutate('commit', { customStatus: 'doing' });
assert.equal(statusCommit.context.__tmIsProgressiveViewRenderCurrent(statusJob, 'kanban'), true,
    'an applied status projection must remain current after its write commits');
statusCommit.flushOne();
assert.equal(statusLoads, 1, 'a status destination column outside the viewport must still load after confirmation');
statusCommit.context.__tmCancelProgressiveViewRender();

const doneCommit = createHarness();
doneCommit.mutate('optimistic', { done: true }, { type: 'setDone' });
const doneJob = doneCommit.context.__tmStartProgressiveViewRender('kanban');
let doneLoads = 0;
doneCommit.context.__tmRegisterKanbanProgressiveColumn(doneJob, {
    key: 'status:done',
    loaded: false,
    loadNextBatch: () => {
        doneLoads += 1;
        return { done: true };
    },
});
doneCommit.mutate('commit', { done: true }, { type: 'setDone' });
assert.equal(doneCommit.context.__tmIsProgressiveViewRenderCurrent(doneJob, 'kanban'), true,
    'an applied completion projection must remain current after its write commits');
doneCommit.flushOne();
assert.equal(doneLoads, 1, 'a completed task moved outside the viewport must still load after confirmation');
doneCommit.context.__tmCancelProgressiveViewRender();

assert.match(renderer, /const renderCard = \(task,[\s\S]*?task = resolveKanbanProjectedTask\(task\) \|\| task;/,
    'deferred cards must read current task fields instead of the captured projection');
assert.match(renderer, /loadNextBatch: \(modalEl(?:, loadOptions = \{\})?\) =>[\s\S]*?kanbanProjectedTaskById\.clear\(\);[\s\S]*?renderColumnListHtml\(nextLimit\)/,
    'each resumed batch must invalidate its captured field cache before rendering');

console.log('kanban field-refresh progressive behavior tests passed');
