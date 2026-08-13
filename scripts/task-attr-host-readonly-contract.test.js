'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const stores = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const services = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const taskList = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js'), 'utf8');
const kernel = fs.readFileSync(path.join(root, 'kernel.js'), 'utf8');

function sliceFunction(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start + startMarker.length);
    assert.ok(start >= 0 && end > start, `missing function boundary: ${startMarker}`);
    return source.slice(start, end);
}

const attrHostRead = sliceFunction(
    stores,
    'async function __tmApplyTaskAttrHostOverrides',
    'async function __tmQueryCustomFieldAttrRowsByTaskIds'
);
assert.doesNotMatch(
    attrHostRead,
    /(?:batchSetAttrs|setAttrs|flushTransaction|repairPatches|rememberRepairPatch|scheduleState1PrimaryBackfill|scheduleState3ParentMirrorSync)/,
    'task attribute-host reads must never enqueue or flush persistence repairs'
);
assert.match(
    attrHostRead,
    /Object\.entries\(entry\.row \|\| \{\}\)\.forEach[\s\S]*String\(value \?\? ''\)\.trim\(\) === ''\) return;/,
    'attribute-host mirror fallback must ignore blank values'
);

assert.doesNotMatch(
    services,
    /__tmPrepareTaskAttrHostsForMove|__tmReconcileTaskAttrHostsAfterMove|__tmScheduleTaskAttrHostReconcileAfterMove/,
    'task moves must not start a second attribute migration and delayed repair path'
);

const buildAttrContextSource = sliceFunction(kernel, 'function buildAttrContext', 'async function resolveTaskBinding');
const buildAttrContext = Function('text', `${buildAttrContextSource}; return buildAttrContext;`)(
    (value) => String(value == null ? '' : value).trim()
);
const state1 = buildAttrContext({
    id: 'task-a',
    parent_id: 'list-a',
    parent_type: 'l',
    parent_task_count: 1,
    first_task_id: 'task-a',
});
assert.equal(state1.state, 'state1-parent');
assert.equal(state1.primaryHostID, 'task-a');
assert.deepEqual(state1.legacyHostIDs, ['list-a']);

const state3 = buildAttrContext({
    id: 'task-a',
    parent_id: 'list-a',
    parent_type: 'l',
    parent_task_count: 2,
    first_task_id: 'task-a',
});
assert.equal(state3.state, 'state3-list-item');
assert.equal(state3.primaryHostID, 'task-a');
assert.deepEqual(state3.legacyHostIDs, ['list-a']);

const state2 = buildAttrContext({
    id: 'task-b',
    parent_id: 'list-a',
    parent_type: 'l',
    parent_task_count: 2,
    first_task_id: 'task-a',
});
assert.equal(state2.state, 'state2-list-item');
assert.equal(state2.primaryHostID, 'task-b');
assert.deepEqual(state2.legacyHostIDs, []);
assert.match(
    kernel,
    /async function buildTaskAttrPreservationOperation\(row, registryInput\)[\s\S]*buildCanonicalTaskAttrs\(context[\s\S]*return \{ action: 'setAttrs', id: context\.taskID/,
    'all legacy list-hosted fields must be copied to the canonical task block before a move'
);
assert.match(
    kernel,
    /async function moveTask\(input, options\)[\s\S]*return runTaskLane\(laneID,[\s\S]*await preserveTaskAttrsOnOwnBlockBeforeMove\(beforeTask\)[\s\S]*await api\('\/api\/block\/moveBlock'/,
    'attribute preservation and the structural move must remain ordered in one kernel lane'
);

const contentUpdate = sliceFunction(
    taskList,
    'async function __tmUpdateTaskContentBlockKernel',
    'function __tmQueueTaskContentPatch'
);
assert.match(
    contentUpdate,
    /const contentBlockId = String\(await API\.getTaskContentBlockId\(tid\)[\s\S]*await __tmBackendAdapter\.updateBlock\(contentBlockId, text\);/,
    'content updates must target the title paragraph instead of rebuilding the task subtree'
);
assert.doesNotMatch(
    contentUpdate,
    /__tmBackendAdapter\.updateBlock\(tid, nextMarkdown\)/,
    'content updates must never replace a parent task together with its descendants'
);
assert.match(
    services,
    /async getTaskContentBlockId\(taskId\)[\s\S]*parent_id = '\$\{id\}' AND type = 'p'[\s\S]*ORDER BY sort ASC, created ASC, id ASC/,
    'task title resolution must select the first direct paragraph deterministically'
);

assert.match(
    services,
    /attrs\[taskMetaAttrKey\] = String\(val \?\? ''\);/,
    'explicit user field clears must remain supported by the normal attribute writer'
);

console.log('task attribute-host readonly contract tests passed');
