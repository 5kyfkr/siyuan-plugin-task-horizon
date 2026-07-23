'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const stores = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const services = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const taskList = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js'), 'utf8');

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

const movePreparation = sliceFunction(
    services,
    'async function __tmPrepareTaskAttrHostsForMove',
    'async function __tmReconcileTaskAttrHostsAfterMove'
);
assert.match(
    movePreparation,
    /__tmIsManagedTaskAttrStorageKeyForMirror\(key\)[\s\S]*const normalizedValue = String\(value \?\? ''\);[\s\S]*normalizedValue\.trim\(\) === ''\) return;/,
    'structural attribute migration must never copy implicit blank values'
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
