'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const dependencySource = read('src/task-horizon/main/task-runtime/55-timeline-dependency-runtime.js');
const stores = read('src/task-horizon/main/10-stores-rules-and-cache.js');
const settings = read('src/task-horizon/main/settings/60-settings-screen.js');
const actions = read('src/task-horizon/main/settings/61-settings-appearance-and-import.js');
const gantt = read('src/task-horizon/main/shell/82-gantt-runtime.js');
const undo = read('src/task-horizon/main/20-api-and-runtime-services.js');
const manifest = JSON.parse(read('src/task-horizon/manifest.main.json'));

assert.equal(manifest.scripts.includes('main/task-runtime/55-timeline-dependency-runtime.js'), true, 'timeline dependency runtime must be part of the manifest');
assert.match(stores, /timelineDependencyScope:\s*'global'/, 'global whiteboard dependency scope must be the default');
assert.match(stores, /tm_timeline_dependency_scope/, 'dependency scope must round-trip through local storage');
assert.match(stores, /cloudData\.timelineDependencyScope/, 'dependency scope must load from cloud settings');
assert.match(settings, /全部页签时间轴依赖线[\s\S]*tmUpdateTimelineDependencyScope\(this\.value\)/, 'settings page must expose the dependency scope selector');
assert.match(
    settings,
    /activeTab === 'main'[\s\S]*settingsSearchCurrentSection = 'layout'[\s\S]*全部页签时间轴依赖线[\s\S]*settingsSearchCurrentSection = 'search'/,
    'dependency scope selector must live under General settings > View layout',
);
assert.match(actions, /window\.tmUpdateTimelineDependencyScope[\s\S]*__tmNormalizeTimelineDependencyScope/, 'dependency scope must have a normalized settings action');
assert.match(gantt, /__tmGetTimelineDependencyLinks\(/, 'timeline dependency rendering must use the unified dependency resolver');
assert.match(gantt, /cascadeRequestedAtStart[\s\S]*__tmCommitTimelineDependencyShift/, 'shift-drag must call the dependency cascade commit');
assert.match(undo, /record\.type === 'taskPatchBatch'/, 'undo must support one-step task patch batches');

const context = {
    console,
    Date,
    Map,
    Set,
    SettingsStore: { data: { currentGroupId: 'group-1', timelineDependencyScope: 'global' } },
    state: { activeDocId: 'all' },
    __tmNormalizeTimelineDependencyScope: (value) => String(value || '').trim().toLowerCase() === 'local' ? 'local' : 'global',
    __tmGetWhiteboardGlobalTaskLinks: () => [{ from: 'A', to: 'G', id: 'global-1' }],
    __tmGetAllTaskLinks: () => [{ from: 'A', to: 'L', id: 'local-1' }],
};
vm.createContext(context);
vm.runInContext(`${dependencySource}\nglobalThis.getScope = __tmGetEffectiveTimelineDependencyScope;\nglobalThis.getLinks = __tmGetTimelineDependencyLinks;\nglobalThis.buildPatches = __tmBuildTimelineDependencyCascadePatches;\nglobalThis.commitShift = __tmCommitTimelineDependencyShift;`, context);

assert.equal(context.getScope({ activeDocId: 'all' }), 'global');
assert.equal(context.getScope({ activeDocId: 'doc-1' }), 'local', 'single-document timelines must always use local links');
assert.equal(context.getLinks({ activeDocId: 'all' })[0].id, 'global-1');
assert.equal(context.getLinks({ activeDocId: 'doc-1' })[0].id, 'local-1');

const tasks = new Map([
    ['A', { id: 'A', startDate: '2026-08-18', completionTime: '2026-08-19' }],
    ['B', { id: 'B', startDate: '2026-08-20', completionTime: '2026-08-22' }],
    ['C', { id: 'C' }],
    ['D', { id: 'D', startDate: '2026-08-25' }],
]);
const result = context.buildPatches({
    sourceTaskId: 'A',
    deltaDays: 2,
    links: [
        { from: 'A', to: 'B' },
        { from: 'A', to: 'C' },
        { from: 'C', to: 'D' },
        { from: 'D', to: 'A' },
    ],
    getTaskById: (id) => tasks.get(id) || null,
});
assert.equal(JSON.stringify(result.patches), JSON.stringify([
    {
        taskId: 'B',
        patch: { startDate: '2026-08-22', completionTime: '2026-08-24' },
        inversePatch: { startDate: '2026-08-20', completionTime: '2026-08-22' },
    },
    {
        taskId: 'D',
        patch: { startDate: '2026-08-27' },
        inversePatch: { startDate: '2026-08-25' },
    },
]), 'cascade patches must shift dated descendants once and continue through undated nodes');
assert.equal(JSON.stringify(result.skippedTaskIds), '[]');
assert.equal(result.visitedTaskIds.includes('C'), true, 'undated nodes must remain in the traversal');
assert.equal(result.visitedTaskIds.includes('A'), true, 'cycles must terminate through visited tracking');

async function runBatchCommitContract() {
    const calls = [];
    const undoRecords = [];
    context.window = {
        tmUpdateTaskDates: async (taskId, patch, options) => {
            calls.push({ taskId, patch, options });
            return { id: taskId };
        },
    };
    context.__tmEnqueueTimelineMutation = async (operation) => operation();
    context.__tmPushUndoRecord = (record) => undoRecords.push(record);
    context.__tmGetWhiteboardGlobalTaskLinks = () => [{ from: 'A', to: 'B', id: 'global-1' }];
    const batchResult = await context.commitShift({
        sourceTaskId: 'A',
        sourcePatch: { startDate: '2026-08-20', completionTime: '2026-08-21' },
        deltaDays: 2,
        getTaskById: (id) => tasks.get(id) || null,
        activeDocId: 'all',
        groupId: 'group-1',
    });
    assert.equal(batchResult.cascadeCount, 1);
    assert.deepEqual(calls.map((item) => item.taskId), ['A', 'B']);
    assert.equal(undoRecords.length, 1);
    assert.equal(undoRecords[0].type, 'taskPatchBatch');
    assert.equal(undoRecords[0].items.length, 2);

    calls.length = 0;
    undoRecords.length = 0;
    context.window.tmUpdateTaskDates = async (taskId, patch) => {
        calls.push({ taskId, patch });
        if (taskId === 'B') throw new Error('expected batch failure');
        return { id: taskId };
    };
    await assert.rejects(() => context.commitShift({
        sourceTaskId: 'A',
        sourcePatch: { startDate: '2026-08-20', completionTime: '2026-08-21' },
        deltaDays: 2,
        getTaskById: (id) => tasks.get(id) || null,
        activeDocId: 'all',
        groupId: 'group-1',
    }), /expected batch failure/);
    assert.deepEqual(calls.map((item) => item.taskId), ['A', 'B', 'A'], 'failed batches must roll back applied tasks in reverse order');
    assert.equal(undoRecords.length, 0, 'failed batches must not create an undo record');
}

runBatchCommitContract()
    .then(() => console.log('timeline dependency contract tests passed'))
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
