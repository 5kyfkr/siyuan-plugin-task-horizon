'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const listSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js'),
    'utf8',
);
const settingsSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/settings/60-settings-screen.js'),
    'utf8',
);
const nativeSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/shell/72-shell-entrances-and-native-doc-hooks.js'),
    'utf8',
);

function extractFunction(source, name) {
    const start = source.indexOf(`async function ${name}(`);
    assert.notEqual(start, -1, `${name} must exist`);
    const bodyStart = source.indexOf('{', source.indexOf(')', start));
    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        if (source[index] !== '}') continue;
        depth -= 1;
        if (depth === 0) return source.slice(start, index + 1);
    }
    throw new Error(`unable to extract ${name}`);
}

const syncParentSource = extractFunction(listSource, '__tmSyncParentDoneStateFromSubtasks');

function createHarness() {
    const tasks = {
        grandparent: { id: 'grandparent', done: false, parentTaskId: '' },
        parent: { id: 'parent', done: false, parentTaskId: 'grandparent' },
        child1: { id: 'child1', done: true, parentTaskId: 'parent' },
        child2: { id: 'child2', done: true, parentTaskId: 'parent' },
    };
    const definitions = [];
    const context = vm.createContext({
        SettingsStore: { data: { autoCompleteParentOnSubtasksDone: true } },
        __tmAutoCompleteGetTaskById: (id) => tasks[id] || null,
        __tmAutoCompleteGetTaskDone: (task) => task?.done === true,
        __tmAutoCompleteIsTaskDone: (task) => task?.done === true,
        __tmFindParentTaskIdForAutoComplete: (_id, task) => String(task?.parentTaskId || ''),
        __tmCollectDirectChildrenForAutoComplete: (parentId) => Object.values(tasks)
            .filter((task) => task.parentTaskId === parentId),
        __tmRefreshTaskDocForFreshDetail: async () => null,
        __tmBuildSetDoneQueuedDefinition: (taskId, done, task, options) => {
            const definition = {
                id: options.operationId,
                type: 'setDone',
                data: {
                    taskId,
                    done,
                    previousDone: options.previousDone,
                    source: options.source,
                },
            };
            definitions.push(definition);
            return { targetDone: done, definition };
        },
        window: { tmSetDone: async () => true },
    });
    vm.runInContext(`${syncParentSource}\nthis.syncParent = __tmSyncParentDoneStateFromSubtasks;`, context);
    return { context, tasks, definitions };
}

async function run() {
    const completion = createHarness();
    const completeParent = await completion.context.syncParent('child2', {
        done: true,
        effectId: 'child-complete',
        returnMutationDefinition: true,
    });
    assert.equal(completeParent.data.taskId, 'parent');
    assert.equal(completeParent.data.done, true, 'all direct children done must complete the parent');
    assert.equal(completeParent.data.previousDone, false);

    completion.tasks.parent.done = true;
    completion.tasks.child2.done = false;
    const restoreParent = await completion.context.syncParent('child2', {
        done: false,
        effectId: 'child-restore',
        returnMutationDefinition: true,
    });
    assert.equal(restoreParent.data.done, false, 'one restored child must restore the parent');
    assert.equal(restoreParent.data.previousDone, true);

    completion.tasks.parent.done = true;
    completion.tasks.child2.done = true;
    const alreadyMatching = await completion.context.syncParent('child2', {
        done: true,
        returnMutationDefinition: true,
    });
    assert.equal(alreadyMatching, false, 'a matching parent must not enqueue a duplicate write');

    completion.tasks.parent.done = false;
    completion.tasks.child2.done = false;
    const incompleteSibling = await completion.context.syncParent('child1', {
        done: true,
        returnMutationDefinition: true,
        skipFreshDoc: true,
    });
    assert.equal(incompleteSibling, false, 'completing one child must not complete a parent with another incomplete child');

    completion.context.SettingsStore.data.autoCompleteParentOnSubtasksDone = false;
    const disabled = await completion.context.syncParent('child2', {
        done: false,
        returnMutationDefinition: true,
    });
    assert.equal(disabled, false, 'the disabled setting must not mutate the parent');

    completion.context.SettingsStore.data.autoCompleteParentOnSubtasksDone = true;
    completion.tasks.parent.done = true;
    completion.tasks.grandparent.done = false;
    const completeGrandparent = await completion.context.syncParent('parent', {
        done: true,
        effectId: 'parent-complete',
        returnMutationDefinition: true,
    });
    assert.equal(completeGrandparent.data.taskId, 'grandparent');
    assert.equal(completeGrandparent.data.done, true, 'the same rule must support cascading to grandparents');

    assert.match(settingsSource, /任一直接子任务恢复未完成时，父任务也会恢复为未完成/);
    assert.equal((nativeSource.match(/__tmSyncParentDoneStateFromSubtasks\?\.\(tid/g) || []).length, 2,
        'both native checkbox write branches must use the symmetric parent synchronizer');
    const parentSyncOffsets = Array.from(nativeSource.matchAll(/__tmSyncParentDoneStateFromSubtasks\?\.\(tid/g), (match) => match.index);
    const tomatoOffsets = Array.from(nativeSource.matchAll(/await __tmSettleTomatoAfterTaskDone\(tid/g), (match) => match.index);
    assert.equal(tomatoOffsets.length, 2);
    assert.ok(parentSyncOffsets.every((offset, index) => offset < tomatoOffsets[index]),
        'native parent synchronization must not wait for external Tomato settlement');
    assert.doesNotMatch(listSource, /childTaskId === cid \|\|/,
        'parent completion must inspect the effective child state instead of assuming the triggering child is done');

    console.log('parent subtask completion sync contract tests passed');
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
