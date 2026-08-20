const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', 'task-runtime', '51-whiteboard-and-link-runtime.js'),
    'utf8'
);
const start = source.indexOf('function __tmGetArchivedDocIdsForAllTabCompletedTailGroup');
const end = source.indexOf('function __tmGetTaskDoneSortTs', start);
assert(start >= 0 && end > start, 'archive filter helper must remain extractable');

function buildRuntime(options = {}) {
    const context = {
        state: {
            activeDocId: options.activeDocId || 'all',
            docTabsArchiveMode: options.archiveMode === true,
            taskTree: Array.isArray(options.taskTree) ? options.taskTree : [],
        },
        SettingsStore: {
            data: {
                currentGroupId: options.groupId || 'all',
                completedTasksInlineInGroups: options.completedTasksInlineInGroups === true,
            },
        },
        __tmGetManualArchivedDocIdsForGroup: () => options.manualArchivedIds || [],
        __tmDocShouldShowInDocTabs: (doc, params) => {
            if (!doc || !Array.isArray(doc.tasks) || doc.tasks.length === 0) return false;
            return params.archiveMode === true && doc.autoArchived === true;
        },
        __tmIsDocTabCustomGroupActiveId: () => false,
        __tmIsTaskDoneEffective: (task) => task?.done === true,
        __tmIsTaskDoneForTailGroup: (task) => task?.done === true,
        __tmShouldShowTaskInCompletedRootGroup: () => true,
    };
    vm.runInNewContext(`${source.slice(start, end)}\nthis.getArchived = __tmGetArchivedDocIdsForAllTabCompletedTailGroup;\nthis.splitByDone = __tmSplitTasksByDoneState;`, context);
    return context;
}

const runtime = buildRuntime({
    manualArchivedIds: ['manual-doc'],
    completedTasksInlineInGroups: true,
    taskTree: [{ id: 'manual-doc' }, { id: 'auto-doc', autoArchived: true, tasks: [{ id: 'done' }] }],
});
const ids = runtime.getArchived();
assert.deepStrictEqual(Array.from(ids).sort(), ['auto-doc', 'manual-doc']);
const split = runtime.splitByDone([
    { id: 'manual-task', root_id: 'manual-doc', done: true },
    { id: 'active-task', root_id: 'active-doc', done: true },
]);
assert.deepStrictEqual(Array.from(split.active, (task) => task.id), ['active-task']);
assert.deepStrictEqual(Array.from(split.done, (task) => task.id), []);

assert.deepStrictEqual(Array.from(buildRuntime({
    manualArchivedIds: ['manual-doc'],
    activeDocId: 'specific-doc',
}).getArchived()), []);
assert.deepStrictEqual(Array.from(buildRuntime({
    manualArchivedIds: ['manual-doc'],
    archiveMode: true,
}).getArchived()), []);

console.log('doc tab completed archive contract tests passed');
