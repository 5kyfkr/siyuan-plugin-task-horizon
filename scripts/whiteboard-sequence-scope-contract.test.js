'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const storeSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const apiSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const filterSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/30-dialogs-and-ui-foundation.js'), 'utf8');
const renderSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/40-render-runtime.js'), 'utf8');
const desktopMenuSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/45-render-shell-controls-and-resize.js'), 'utf8');
const settingsSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/60-settings-screen.js'), 'utf8');
const actionsSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/70-doc-group-and-settings-actions.js'), 'utf8');

assert.match(apiSource, /function __tmNormalizeWhiteboardSequenceScope[\s\S]*?'global'[\s\S]*?'document'/, 'sequence scope must normalize to global or document');
assert.match(storeSource, /whiteboardSequenceScope:\s*'document'/, 'existing users must keep document whiteboards as the default sequence source');
assert.match(storeSource, /tm_whiteboard_sequence_scope/, 'sequence scope must persist locally');
assert.match(settingsSource, /白板顺序依据[\s\S]*?value="document"[\s\S]*?单文档白板[\s\S]*?value="global"[\s\S]*?全局白板/, 'settings must expose both sequence sources');
assert.doesNotMatch(renderSource, /白板顺序模式（/, 'mobile menu must not append the sequence source to the mode label');
assert.doesNotMatch(desktopMenuSource, /白板顺序模式（/, 'desktop menu must not append the sequence source to the mode label');
assert.match(actionsSource, /updateWhiteboardSequenceScope[\s\S]*?applyFilters\(\)/, 'changing the sequence source must immediately reapply filters');

const sequenceStart = filterSource.indexOf('function __tmIsTaskAndDescDoneForSequence');
const sequenceEnd = filterSource.indexOf('async function __tmTryRestoreCurrentDocTabViewSnapshot');
assert.ok(sequenceStart >= 0 && sequenceEnd > sequenceStart, 'sequence filter functions must be extractable for behavior verification');

const tasks = {
    a: { id: 'a', docId: 'doc-a', root_id: 'doc-a', parentTaskId: '', done: false, children: [] },
    b: { id: 'b', docId: 'doc-b', root_id: 'doc-b', parentTaskId: '', done: false, children: [] },
    c: { id: 'c', docId: 'doc-b', root_id: 'doc-b', parentTaskId: '', done: false, children: [] },
};
const context = {
    SettingsStore: { data: { whiteboardSequenceMode: true, whiteboardSequenceScope: 'document' } },
    state: { viewMode: 'list', flatTasks: tasks },
    console,
};
context.globalThis = context;
context.__tmRuntimeState = { getFlatTaskById: (id) => tasks[id] || null };

vm.runInNewContext(`
    function __tmNormalizeWhiteboardSequenceScope(scope) {
        return String(scope || '').trim().toLowerCase() === 'global' ? 'global' : 'document';
    }
    function __tmGetTaskDocIdById(id) { return state.flatTasks[id]?.docId || ''; }
    function __tmGetWhiteboardGlobalBoardState() {
        return { placedTaskIds: { a: true, b: true }, detachedChildren: {} };
    }
    function __tmGetWhiteboardGlobalTaskLinks() { return [{ from: 'a', to: 'b' }]; }
    function __tmGetManualTaskLinksRuntime() { return { byDoc: new Map() }; }
    function __tmResolveWhiteboardTaskParentId(id) { return state.flatTasks[id]?.parentTaskId || ''; }
    function __tmIsWhiteboardChildDetached() { return false; }
    function __tmIsTaskDoneEffective(task) { return task?.done === true; }
    ${filterSource.slice(sequenceStart, sequenceEnd)}
    globalThis.__testBuildWhiteboardSequenceVisibleTaskSet = __tmBuildWhiteboardSequenceVisibleTaskSet;
`, context, { filename: 'whiteboard-sequence-scope-runtime.js' });

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

console.log('whiteboard sequence scope contract tests passed');
