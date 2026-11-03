'use strict';

const assert = require('node:assert/strict');
const fs = require('./i18n-source-fixture');
const path = require('node:path');
const vm = require('./i18n-vm-fixture');

const root = path.resolve(__dirname, '..');
const storeSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const apiSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const filterSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/30-dialogs-and-ui-foundation.js'), 'utf8');
const renderSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/40-render-runtime.js'), 'utf8');
const desktopMenuSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/45-render-shell-controls-and-resize.js'), 'utf8');
const settingsSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/60-settings-screen.js'), 'utf8');
const actionsSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/70-doc-group-and-settings-actions.js'), 'utf8');
const kanbanSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/43-render-timeline-kanban-calendar-body.js'), 'utf8');

assert.match(apiSource, /function __tmNormalizeWhiteboardSequenceScope[\s\S]*?'global'[\s\S]*?'document'/, 'sequence scope must normalize to global or document');
assert.match(storeSource, /whiteboardSequenceScope:\s*'document'/, 'existing users must keep document whiteboards as the default sequence source');
assert.match(storeSource, /tm_whiteboard_sequence_scope/, 'sequence scope must persist locally');
assert.match(settingsSource, /白板顺序依据[\s\S]*?__tmGetWhiteboardLinkSourceOptions\(\)/, 'sequence settings must use the shared source choices');
assert.doesNotMatch(renderSource, /白板顺序模式（/, 'mobile menu must not append the sequence source to the mode label');
assert.doesNotMatch(desktopMenuSource, /白板顺序模式（/, 'desktop menu must not append the sequence source to the mode label');
assert.match(actionsSource, /updateWhiteboardSequenceScope[\s\S]*?__tmRecomputeTaskProjection\(/, 'changing the sequence source must immediately reapply filters');
assert.match(kanbanSource, /respectSequenceProjection && !filteredRawTaskById\.has\(taskId\)/, 'kanban attached-task injection must respect sequence-filtered tasks');
assert.match(kanbanSource, /respectSequenceProjection && !filteredRawTaskById\.has\(childId\)\) return;/, 'kanban must not inject descendants below a sequence-hidden child');

const sequenceStart = filterSource.indexOf('function __tmIsTaskAndDescDoneForSequence');
const sequenceEnd = filterSource.indexOf('async function __tmTryRestoreCurrentDocTabViewSnapshot');
assert.ok(sequenceStart >= 0 && sequenceEnd > sequenceStart, 'sequence filter functions must be extractable for behavior verification');

const tasks = {
    a: { id: 'a', docId: 'doc-a', root_id: 'doc-a', parentTaskId: '', done: false, children: [] },
    b: { id: 'b', docId: 'doc-b', root_id: 'doc-b', parentTaskId: '', done: false, children: [] },
    c: { id: 'c', docId: 'doc-b', root_id: 'doc-b', parentTaskId: '', done: false, children: [] },
};
const context = require('./whiteboard-tab-group-scope.test.js').createHarness();
context.SettingsStore.data.whiteboardSequenceMode = true;
context.SettingsStore.data.whiteboardSequenceScope = 'document';
context.state.viewMode = 'list';
context.state.flatTasks = tasks;
context.__tmRuntimeState = { getFlatTaskById: (id) => tasks[id] || null };
context.__tmTaskBoundary = { getTask: (id) => tasks[id] || null };

vm.runInContext(`
    function __tmGetTaskDocIdById(id) { return state.flatTasks[id]?.docId || ''; }
    function __tmGetWhiteboardGlobalBoardState() {
        return globalThis.__testGlobalBoard || { placedTaskIds: { a: true, b: true }, detachedChildren: {} };
    }
    function __tmGetWhiteboardGlobalTaskLinks() { return globalThis.__testGlobalLinks || [{ from: 'a', to: 'b' }]; }
    function __tmGetManualTaskLinksRuntime() { return { byDoc: new Map(globalThis.__testManualLinksByDoc || []) }; }
    function __tmResolveWhiteboardTaskParentId(id) { return state.flatTasks[id]?.parentTaskId || ''; }
    function __tmIsWhiteboardChildDetached(id) { return globalThis.__testDetachedChildren?.has(id) || false; }
    function __tmIsTaskDoneEffective(task) { return task?.done === true; }
    ${filterSource.slice(sequenceStart, sequenceEnd)}
    globalThis.__testBuildWhiteboardSequenceVisibleTaskSet = __tmBuildWhiteboardSequenceVisibleTaskSet;
    globalThis.__testBuildWhiteboardSequenceModel = __tmBuildWhiteboardSequenceModel;
    globalThis.__testBuildWhiteboardSequenceActiveTaskList = __tmBuildWhiteboardSequenceActiveTaskList;
    globalThis.__testApplyWhiteboardSequenceFilter = __tmApplyWhiteboardSequenceFilter;
`, context, { filename: 'whiteboard-sequence-scope-runtime.js' });
assert.deepEqual(Array.from(context.__tmGetWhiteboardLinkSourceOptions(), option => option.value), ['document', 'global', 'tabGroup']);

const candidates = Object.values(tasks);
context.SettingsStore.data.whiteboardSequenceScope = 'document';
assert.deepEqual(
    Array.from(context.__testBuildWhiteboardSequenceVisibleTaskSet(candidates)).sort(),
    ['a', 'b', 'c'],
    'document scope must calculate each document whiteboard independently',
);

context.SettingsStore.data.whiteboardSequenceScope = 'global';
assert.deepEqual(
    Array.from(context.__testBuildWhiteboardSequenceVisibleTaskSet(candidates)).sort(),
    ['a'],
    'global scope must use the current global board link chain and ignore unplaced tasks',
);
assert.deepEqual(
    Array.from(context.__testBuildWhiteboardSequenceVisibleTaskSet([tasks.b, tasks.c])).sort(),
    ['a'],
    'global scope must still honor predecessors from other documents when the current candidate list is document-scoped',
);

tasks.a.done = true;
assert.deepEqual(
    Array.from(context.__testBuildWhiteboardSequenceVisibleTaskSet(candidates)).sort(),
    ['b'],
    'global scope must advance to the next linked task after the current task completes',
);

tasks.a.done = false;
context.state.activeDocId = context.__tmBuildDocTabCustomGroupActiveId('tabs-a');
context.SettingsStore.data.whiteboardSequenceScope = 'tabGroup';
context.__tmGetWhiteboardGlobalTaskLinks = key => key === context.state.activeDocId ? [{from:'b',to:'a'}] : [{from:'a',to:'b'}];
assert.deepEqual(Array.from(context.__testBuildWhiteboardSequenceVisibleTaskSet(candidates)).sort(), ['b'],
    'tab-group sequence must follow its own graph rather than the parent graph');
context.SettingsStore.data.whiteboardSequenceScope = 'global';
assert.deepEqual(Array.from(context.__testBuildWhiteboardSequenceVisibleTaskSet(candidates)).sort(), ['a'],
    'the legacy global choice must retain its parent-board meaning inside a tab group');

Object.assign(tasks, {
    parent: { id: 'parent', docId: 'doc-subtask', root_id: 'doc-subtask', parentTaskId: '', done: false, children: [{ id: 'child-a' }, { id: 'child-b' }, { id: 'child-c' }] },
    'child-a': { id: 'child-a', docId: 'doc-subtask', root_id: 'doc-subtask', parentTaskId: 'parent', done: false, children: [] },
    'child-b': { id: 'child-b', docId: 'doc-subtask', root_id: 'doc-subtask', parentTaskId: 'parent', done: false, children: [] },
    'child-c': { id: 'child-c', docId: 'doc-subtask', root_id: 'doc-subtask', parentTaskId: 'parent', done: false, children: [] },
});
const childCandidates = [tasks.parent, tasks['child-a'], tasks['child-b'], tasks['child-c']];
context.state.activeDocId = 'all';
context.state.viewMode = 'list';
context.state.flatTasks = tasks;
context.SettingsStore.data.whiteboardSequenceMode = true;
context.SettingsStore.data.whiteboardSequenceScope = 'document';
context.__testManualLinksByDoc = new Map([['doc-subtask', [
    { from: 'child-a', to: 'child-b' },
    { from: 'child-b', to: 'child-c' },
]]]);
context.__testDetachedChildren = new Set();

let childModel = context.__testBuildWhiteboardSequenceModel(childCandidates);
assert.deepEqual(Array.from(childModel.sequenceChildRoots).sort(), ['child-a', 'child-b', 'child-c'],
    'linked child endpoints must become sequence nodes without detaching them from their parent');
assert.ok(childModel.visible.has('parent') && childModel.visible.has('child-a'),
    'the parent and the current linked child may remain visible together');
assert.ok(!childModel.visible.has('child-b') && !childModel.visible.has('child-c'),
    'future linked children must stay hidden while the first child is incomplete');
assert.deepEqual(
    Array.from(context.__testApplyWhiteboardSequenceFilter(childCandidates)).map(task => task.id).sort(),
    ['child-a', 'parent'],
    'the shared projection must initially show only the first linked child and its parent',
);

tasks['child-a'].done = true;
assert.ok(context.__testBuildWhiteboardSequenceActiveTaskList(childCandidates, childModel.sequenceChildRoots).some(task => task.id === 'child-b'),
    'the second linked child must remain eligible while its parent is incomplete');
assert.deepEqual(
    Array.from(context.__testApplyWhiteboardSequenceFilter(childCandidates)).map(task => task.id).sort(),
    ['child-a', 'child-b', 'parent'],
    'completing the first child must reveal only the second child before the third',
);

tasks.parent.done = true;
childModel = context.__testBuildWhiteboardSequenceModel(childCandidates);
assert.deepEqual(
    Array.from(context.__testApplyWhiteboardSequenceFilter(childCandidates)).map(task => task.id).sort(),
    ['child-a', 'child-b', 'parent'],
    'the second child must remain visible under an already-completed parent while the third stays hidden',
);

tasks['child-a'].done = false;
context.SettingsStore.data.whiteboardSequenceScope = 'global';
context.state.activeDocId = 'all';
tasks.parent.done = false;
context.__testGlobalBoard = { placedTaskIds: { parent: true }, detachedChildren: {} };
context.__testGlobalLinks = [{ from: 'child-a', to: 'child-b' }, { from: 'child-b', to: 'child-c' }];
context.__tmGetWhiteboardGlobalTaskLinks = () => context.__testGlobalLinks;
childModel = context.__testBuildWhiteboardSequenceModel(childCandidates);
assert.deepEqual(Array.from(childModel.sequenceChildRoots).sort(), ['child-a', 'child-b', 'child-c'],
    'global whiteboards must recognize nested child endpoints inside a placed parent card');
assert.ok(childModel.visible.has('child-a') && !childModel.visible.has('child-b'),
    `global whiteboards must sequence nested child endpoints inside a placed parent card: ${Array.from(childModel.visible).join(',')}`);
assert.deepEqual(
    Array.from(context.__testApplyWhiteboardSequenceFilter(childCandidates)).map(task => task.id).sort(),
    ['child-a', 'parent'],
    'the global task projection must initially show only the first linked child and its parent',
);
tasks['child-a'].done = true;
assert.deepEqual(
    Array.from(context.__testApplyWhiteboardSequenceFilter(childCandidates)).map(task => task.id).sort(),
    ['child-a', 'child-b', 'parent'],
    'completing the first child must reveal only the second child in the global task projection',
);

tasks['child-a'].done = false;
context.__testGlobalLinks = [
    { from: 'parent', to: 'child-a' },
    { from: 'child-a', to: 'child-b' },
    { from: 'child-b', to: 'child-c' },
];
assert.ok(!context.__testApplyWhiteboardSequenceFilter(childCandidates).some(task => task.id === 'child-a'),
    'a parent explicitly linked into the whiteboard graph must still gate its child sequence');
tasks.parent.done = true;
assert.ok(context.__testApplyWhiteboardSequenceFilter(childCandidates).some(task => task.id === 'child-a'),
    'completing a linked parent must advance to its first child');

// A global board can contain old plans and a new child chain at the same time.
// Completed predecessors are absent from the view candidates but remain in flatTasks.
Object.assign(tasks, {
    'old-plan': { id: 'old-plan', docId: 'doc-subtask', root_id: 'doc-subtask', done: false, children: [] },
    'old-version': { id: 'old-version', docId: 'doc-subtask', root_id: 'doc-subtask', done: true, children: [{ id: 'old-pending-child' }] },
    'old-pending-child': { id: 'old-pending-child', docId: 'doc-subtask', root_id: 'doc-subtask', parentTaskId: 'old-version', done: false, children: [] },
    'old-next': { id: 'old-next', docId: 'doc-subtask', root_id: 'doc-subtask', done: false, children: [] },
});
tasks.parent.done = false;
tasks['child-a'].done = true;
context.__testGlobalBoard = { placedTaskIds: { parent: true, 'old-plan': true, 'old-version': true, 'old-next': true }, detachedChildren: {} };
context.__testGlobalLinks = [
    { from: 'old-plan', to: 'old-next' },
    { from: 'child-a', to: 'child-b' },
    { from: 'child-b', to: 'child-c' },
];
const unfinishedCandidates = [tasks.parent, tasks['child-b'], tasks['child-c'], tasks['old-plan'], tasks['old-next']];
for (const viewMode of ['checklist', 'list', 'kanban']) {
    context.state.viewMode = viewMode;
    assert.deepEqual(
        Array.from(context.__testApplyWhiteboardSequenceFilter(unfinishedCandidates), task => task.id).sort(),
        ['child-b', 'old-plan', 'parent'],
        `${viewMode}: unfinished tasks in other components must not block a child chain after its first task completes`,
    );
}
tasks['child-b'].done = true;
assert.deepEqual(
    Array.from(context.__testApplyWhiteboardSequenceFilter([tasks.parent, tasks['child-c'], tasks['old-plan'], tasks['old-next']]), task => task.id).sort(),
    ['child-c', 'old-plan', 'parent'],
    'the child chain must keep advancing while the old plan remains incomplete',
);
tasks['child-a'].done = false;
assert.deepEqual(
    Array.from(context.__testApplyWhiteboardSequenceFilter([tasks.parent, tasks['child-a'], tasks['child-c'], tasks['old-plan'], tasks['old-next']]), task => task.id).sort(),
    ['child-a', 'old-plan', 'parent'],
    'reopening the first child must hide its later steps without affecting other components',
);

tasks['child-a'].done = true;
tasks['child-b'].done = false;
context.state.taskTree.push({ id: 'doc-subtask', name: 'Subtasks' });
context.SettingsStore.data.docTabCustomGroups[0].entries.push({ id: 'doc-subtask' });
context.__testManualLinksByDoc = new Map([['doc-subtask', context.__testGlobalLinks]]);
for (const source of ['document', 'global', 'tabGroup']) {
    context.SettingsStore.data.whiteboardSequenceScope = source;
    context.state.activeDocId = source === 'tabGroup' ? context.__tmBuildDocTabCustomGroupActiveId('tabs-a') : 'all';
    for (const detached of [false, true]) {
        context.__testDetachedChildren = new Set(detached ? ['child-a', 'child-b', 'child-c'] : []);
        context.__testGlobalBoard = {
            placedTaskIds: { 'old-plan': true, 'old-version': true, 'old-next': true,
                ...(detached ? { 'child-a': true, 'child-b': true, 'child-c': true } : { parent: true }) },
            detachedChildren: detached ? { 'child-a': { detached: true }, 'child-b': { detached: true }, 'child-c': { detached: true } } : {},
        };
        assert.deepEqual(
            Array.from(context.__testApplyWhiteboardSequenceFilter(unfinishedCandidates), task => task.id).sort(),
            ['child-b', 'old-plan', 'parent'],
            `${source}, detached=${detached}: independent child chains must advance even when the parent is not placed`,
        );
    }
}

Object.assign(tasks, {
    split: { id: 'split', docId: 'doc-subtask', done: true, children: [] },
    left: { id: 'left', docId: 'doc-subtask', done: false, children: [] },
    right: { id: 'right', docId: 'doc-subtask', done: true, children: [] },
    join: { id: 'join', docId: 'doc-subtask', done: false, children: [] },
    'cycle-a': { id: 'cycle-a', docId: 'doc-subtask', done: false, children: [] },
    'cycle-b': { id: 'cycle-b', docId: 'doc-subtask', done: false, children: [] },
});
context.state.activeDocId = 'all';
context.SettingsStore.data.whiteboardSequenceScope = 'global';
context.__testGlobalBoard = { placedTaskIds: { split: true, left: true, right: true, join: true, 'old-plan': true, 'old-next': true, 'cycle-a': true, 'cycle-b': true }, detachedChildren: {} };
context.__testGlobalLinks = [
    { from: 'split', to: 'left' }, { from: 'split', to: 'right' },
    { from: 'left', to: 'join' }, { from: 'right', to: 'join' },
    { from: 'old-plan', to: 'old-next' },
    { from: 'cycle-a', to: 'cycle-b' }, { from: 'cycle-b', to: 'cycle-a' },
];
const branchCandidates = [tasks.left, tasks.join, tasks['old-plan'], tasks['old-next'], tasks['cycle-a'], tasks['cycle-b']];
assert.deepEqual(
    Array.from(context.__testApplyWhiteboardSequenceFilter(branchCandidates), task => task.id).sort(),
    ['cycle-a', 'cycle-b', 'left', 'old-plan'],
    'a merge must wait for the unfinished branch in its own component; cyclic cards stay visible',
);
tasks.left.done = true;
assert.deepEqual(
    Array.from(context.__testApplyWhiteboardSequenceFilter(branchCandidates.filter(task => task.id !== 'left')), task => task.id).sort(),
    ['cycle-a', 'cycle-b', 'join', 'old-plan'],
    'the merge must appear after both branches complete while other components remain incomplete',
);
console.log('whiteboard sequence scope contract tests passed');
