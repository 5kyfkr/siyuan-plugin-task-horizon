'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const source = read('src/task-horizon/main/37-project-visibility-service.js');
const support = read('src/task-horizon/main/render/48-render-calendar-support-runtime.js');
const calendar = read('calendar-view.js');
const boundary = (text, start, end) => {
    const from = text.indexOf(start), to = text.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, start);
    return text.slice(from, to);
};

function createHarness(initial = {}) {
    let disk = structuredClone(initial);
    let failSave = false;
    let reads = 0;
    let refreshes = 0;
    const flatTasks = {};
    const writes = [];
    const context = vm.createContext({
        Map, Set, state: { flatTasks },
        __tmTaskStore: { getProjected: (id) => flatTasks[id] },
        __tmHost: {
            async loadData(key) { assert.equal(key, 'homepage-settings.json'); reads++; return structuredClone(disk); },
            async saveData(key, value) {
                assert.equal(key, 'homepage-settings.json');
                if (failSave) return false;
                disk = JSON.parse(JSON.stringify(value));
                writes.push(structuredClone(disk));
                return true;
            },
        },
        __tmRecomputeTaskProjection() { refreshes++; },
    });
    context.window = context;
    vm.runInContext(source, context);
    return {
        service: context.__tmProjectVisibility, context, flatTasks, writes,
        disk: () => structuredClone(disk), reads: () => reads, refreshes: () => refreshes,
        failSave: (next) => { failSave = next; },
    };
}

async function main() {
    const h = createHarness({ moduleOrder: ['projects', 'overview'], completedProjects: { 'doc:closed': true, 'heading:h1': true } });
    const s = h.service;
    await Promise.all([s.load(), s.load(), s.load()]);
    assert.equal(h.reads(), 1, 'startup and homepage must share one settings read');
    const tasks = [
        { id: 'a', root_id: 'closed', done: false, customStatus: 'doing', pinned: true },
        { id: 'b', root_id: 'open', h2Id: 'h1', h2: 'Same name', done: false },
        { id: 'c', root_id: 'open', parentTaskId: 'b', done: false },
        { id: 'd', root_id: 'open', h2Id: 'h2', h2: 'Same name', done: false },
        { id: 'e', root_id: 'open', h2Id: 'h2', done: true },
        { id: 'f', root_id: 'open', h2Id: 'h2', progress: 100, done: true },
        { id: 'repeatinst:b:1', sourceTaskId: 'b', done: true },
    ];
    tasks.forEach((task) => { h.flatTasks[task.id] = task; });
    const original = JSON.stringify(tasks);
    assert.deepEqual(Array.from(s.filterTasks(tasks), (task) => task.id), ['d', 'e', 'f']);
    assert.equal(JSON.stringify(tasks), original, 'visibility never mutates status, dates, children or attributes');
    assert.equal(s.isCompleted('doc', 'open'), false, '100% task progress must not create a manual flag');
    h.flatTasks.c.parentTaskId = 'c';
    assert.equal(s.isTaskHidden(h.flatTasks.c), false, 'a malformed parent cycle must terminate');
    h.flatTasks.c.parentTaskId = 'b';

    await Promise.all([
        s.saveSettings({ moduleLayout: { trend: 'narrow' }, completedProjects: {} }),
        s.setCompleted('doc', 'another', true),
        s.setCompleted('heading', 'h2', true),
    ]);
    assert.deepEqual(h.disk().moduleOrder, ['projects', 'overview']);
    assert.equal(h.disk().moduleLayout.trend, 'narrow');
    assert.equal(h.disk().completedProjects['doc:closed'], true, 'a layout save cannot erase completion flags');
    assert.equal(h.disk().completedProjects['doc:another'], true);
    assert.equal(h.disk().completedProjects['heading:h2'], true, 'concurrent completion writes must merge');
    const restarted = createHarness(h.disk());
    await restarted.service.load();
    assert.equal(restarted.service.isTaskHidden(tasks[0]), true, 'startup must hide tasks before the homepage has opened');
    assert.equal(restarted.service.isTaskHidden(tasks[3]), true);

    const revision = s.getRevision();
    h.failSave(true);
    await assert.rejects(s.setCompleted('doc', 'closed', false), /保存失败/);
    assert.equal(s.isCompleted('doc', 'closed'), true, 'failed saves must leave the previous visibility intact');
    assert.equal(s.getRevision(), revision);
    h.failSave(false);
    await s.setCompleted('doc', 'closed', false);
    assert.equal(s.isTaskHidden(tasks[0]), false);
    await s.setCompleted('heading', 'h2', false);
    assert.equal(s.isTaskHidden(tasks[3]), false);
    assert.ok(h.refreshes() >= 4, 'successful changes must recompute the visible projection');

    // Execute the real candidate fallback: empty filtered results cannot be
    // replenished with project-hidden tasks from the tree or calendar cache.
    h.context.state.filteredTasks = [];
    h.context.__tmGetCalendarDocsToGroupMapSync = () => new Map();
    h.context.__tmIsCalendarTaskPendingDeletedSync = () => false;
    h.context.__tmFlattenCalendarTaskTreeSync = () => [tasks[1], tasks[2]];
    h.context.__tmCalendarAllTasksCache = { tasks: [tasks[1], tasks[3]] };
    h.context.__tmGetCalendarFlatTasksSync = () => tasks;
    vm.runInContext(boundary(support, '    function __tmGetCalendarTaskCandidatesSync()', '    function __tmResolveCalendarTaskDisplayTitle'), h.context);
    assert.deepEqual(Array.from(h.context.__tmGetCalendarTaskCandidatesSync().tasks, (task) => task.id), ['d']);

    // Whiteboard canvas placements and ghost snapshots must obey the same
    // exclusion without deleting the saved placement or snapshot.
    const whiteboard = read('src/task-horizon/main/render/44-render-whiteboard-body.js');
    h.context.globalWhiteboardTaskMap = new Map();
    h.context.docIdSet = new Set(['open']);
    h.context.showDoneTasks = true;
    h.context.byDoc = new Map();
    vm.runInContext(boundary(whiteboard, '            const pushDocTask =', '            filtered.forEach(')
        + '\nglobalThis.testPushDocTask = pushDocTask;', h.context);
    h.context.testPushDocTask(tasks[1]);
    h.context.testPushDocTask(tasks[3]);
    assert.deepEqual(Array.from(h.context.byDoc.get('open'), (task) => task.id), ['d']);
    h.context.placedMap = { b: true, d: true, ghost: true };
    h.context.posMap = { b: { docId: 'open' }, d: { docId: 'open' }, ghost: { docId: 'open' } };
    h.context.snapMap = { ghost: { docId: 'open', h2Id: 'h1', content: 'Hidden snapshot', done: false } };
    h.context.isGlobalCanvasDoc = false;
    h.context.docId = 'open';
    h.context.seenDocTask = new Set();
    h.context.docTasks = [];
    const placedBefore = JSON.stringify(h.context.placedMap);
    const canvas = whiteboard.slice(whiteboard.indexOf('            const docsHtml = renderDocIds.map'));
    vm.runInContext(boundary(canvas, '                Object.keys(placedMap).forEach((taskId)', '                const taskById ='), h.context);
    assert.deepEqual(Array.from(h.context.docTasks, (task) => task.id), ['d']);
    assert.equal(JSON.stringify(h.context.placedMap), placedBefore, 'hidden placements must remain recoverable');
    assert.equal(h.context.snapMap.ghost.done, false);

    const runtime = read('src/task-horizon/main/20-api-and-runtime-services.js');
    h.context.state.activeDocId = 'all';
    h.context.__tmIsOtherBlockTabId = () => false;
    vm.runInContext(boundary(runtime, '    function __tmCollectHomepageTasks()', '    let __tmHomepageProjectsWarmupKey'), h.context);
    assert.equal(h.context.__tmCollectHomepageTasks().length, tasks.length,
        'homepage project statistics and recovery cards must retain the full task source');

    vm.runInContext(boundary(calendar, '    function isCalendarEventHiddenByProject(', '    function setCalendarEventColor('), h.context);
    h.context.normalizeCalendarEngineEventInput = (event) => event;
    const events = [
        { id: 'hidden-date', extendedProps: { __tmSource: 'taskdate', __tmTaskId: 'b', __tmDocId: 'open' } },
        { id: 'hidden-schedule', extendedProps: { __tmSource: 'schedule', __tmTaskId: 'b' } },
        { id: 'visible-date', extendedProps: { __tmSource: 'taskdate', __tmTaskId: 'd' } },
        { id: 'standalone-schedule', extendedProps: { __tmSource: 'schedule' } },
        { id: 'focus-history', extendedProps: { __tmSource: 'tomato', __tmTaskId: 'b' } },
    ];
    const eventsBefore = JSON.stringify(events);
    assert.deepEqual(Array.from(h.context.normalizeCalendarEngineEventInputs(events), (event) => event.id),
        ['visible-date', 'standalone-schedule', 'focus-history']);
    assert.equal(JSON.stringify(events), eventsBefore, 'calendar display filtering must keep source records intact');
    await s.setCompleted('heading', 'h1', false);
    assert.equal(h.context.normalizeCalendarEngineEventInputs(events).length, 5, 'unmarking restores cached calendar events');

    await s.setCompleted('heading', 'no-h2:open', true);
    assert.equal(s.isTaskHidden({ id: 'unclassified', root_id: 'open' }), true);
    assert.equal(s.isTaskHidden(tasks[3]), false, 'unclassified card scope must not cover titled tasks');
    console.log('project visibility persistence and calendar behavior tests passed');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
