'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const stores = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const services = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const taskList = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js'), 'utf8');
const nativeHooks = fs.readFileSync(path.join(root, 'src/task-horizon/main/shell/72-shell-entrances-and-native-doc-hooks.js'), 'utf8');
const quickbar = fs.readFileSync(path.join(root, 'quickbar.js'), 'utf8');
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
assert.match(attrHostRead, /const uniqueQueryIds = Array\.from\(new Set\(taskIds\.filter\(Boolean\)\)\)/,
    'task attribute reads must query task item IDs only');
assert.doesNotMatch(attrHostRead, /taskIds\.concat\(hostIds\)|hostIds\.push\(parentId\)/,
    'task attribute reads must not query parent list hosts');

assert.match(
    services,
    /async function __tmReconcileTaskAttrHostsKernel[\s\S]*action: 'reconcileAttrs'[\s\S]*__tmExecuteTaskCommandGateway/,
    'delayed structural reconciliation must use the single kernel mutation gateway'
);
assert.doesNotMatch(
    services,
    /__tmPrepareTaskAttrHostsForMove|__tmReconcileTaskAttrHostsAfterMove|__tmScheduleTaskAttrHostReconcileAfterMove/,
    'the removed frontend attribute writer and migration pipeline must not return'
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
assert.deepEqual(state1.mirrorHostIDs, []);
assert.deepEqual(state1.legacyHostIDs, []);

const state3 = buildAttrContext({
    id: 'task-a',
    parent_id: 'list-a',
    parent_type: 'l',
    parent_task_count: 2,
    first_task_id: 'task-a',
});
assert.equal(state3.state, 'state3-list-item');
assert.equal(state3.primaryHostID, 'task-a');
assert.deepEqual(state3.mirrorHostIDs, []);
assert.deepEqual(state3.legacyHostIDs, []);

const state2 = buildAttrContext({
    id: 'task-b',
    parent_id: 'list-a',
    parent_type: 'l',
    parent_task_count: 2,
    first_task_id: 'task-a',
});
assert.equal(state2.state, 'state2-list-item');
assert.equal(state2.primaryHostID, 'task-b');
assert.deepEqual(state2.mirrorHostIDs, []);
assert.deepEqual(state2.legacyHostIDs, []);
assert.match(
    kernel,
    /async function buildTaskAttrWriteOperations[\s\S]*const taskID = requireID\(binding\.taskID[\s\S]*return \[\{ action: 'setAttrs', id: taskID/,
    'kernel writes must target only the task item ID'
);
assert.doesNotMatch(
    kernel,
    /async function reconcileTaskAttrHostsNow[\s\S]*allowListMirrorTakeover: true[\s\S]*clearListManagedAttrs: true/,
    'normal structural reconciliation must not migrate or mirror task attributes'
);
assert.match(
    kernel,
    /async function buildTaskAttrPreservationOperation\(row, registryInput\)[\s\S]*buildCanonicalTaskAttrs\(context[\s\S]*return \{ action: 'setAttrs', id: context\.taskID/,
    'moves must preserve task item attributes on the same task item ID'
);
assert.match(
    kernel,
    /async function moveTask\(input, options\)[\s\S]*return runTaskLane\(laneID,[\s\S]*await preserveTaskAttrsOnOwnBlockBeforeMove\(beforeTask\)[\s\S]*await api\('\/api\/block\/moveBlock'/,
    'attribute preservation and the structural move must remain ordered in one kernel lane'
);
const completionAttrExpression = sliceFunction(kernel, 'function completionAttrExpression', 'function normalizeTaskScope');
assert.doesNotMatch(completionAttrExpression, /\.parent_id|first task/i,
    'task filters and statistics must not read legacy parent-list attributes');

const anyBlockBinding = sliceFunction(
    taskList,
    'async function __tmResolveTaskBindingFromAnyBlockId',
    'async function __tmResolveTaskAttrHostIdFromAnyBlockId'
);
assert.match(anyBlockBinding, /if \(type === 'l'\)[\s\S]*return \{ taskId, attrHostId: taskId, task: null \}/,
    'resolving a list block must return its first task item as the attribute host');
assert.doesNotMatch(anyBlockBinding, /taskIds\.length === 1 \? rowId : taskId/,
    'a singleton list ID must never become the attribute host');

const nativeCheckboxHost = sliceFunction(
    nativeHooks,
    'function __tmResolveNativeDocCheckboxAttrHostIdFromDom',
    'function __tmMirrorDocCheckboxStatusPatch'
);
assert.match(nativeCheckboxHost, /return tid \|\| readId\(directTaskItems\(el\)\[0\]\)/,
    'a native checkbox on a list wrapper must resolve to its task item');
assert.doesNotMatch(nativeCheckboxHost, /return listId|return parentListId/,
    'native checkbox writes must not target a list wrapper');

const quickbarBinding = sliceFunction(
    quickbar,
    'function resolveTaskBindingFromBlockEl',
    'function resolveTaskNodeIdForDetail'
);
assert.match(quickbarBinding, /taskId,[\s\S]*attrHostId: taskId/,
    'quickbar DOM bindings must use the task item as their attribute host');
assert.doesNotMatch(quickbarBinding, /useParentHost|attrHostMigrationSourceId/,
    'quickbar bindings must not retain parent-host selection or rescue sources');
const quickbarRead = sliceFunction(
    quickbar,
    'async function getMergedTaskCustomAttrs',
    'function isReminderRelatedAttrKey'
);
assert.match(quickbarRead, /getBlockCustomAttrs\(taskId\)/,
    'quickbar reads must fetch only task item attributes');
assert.doesNotMatch(quickbarRead, /mirrorIds|parentListId|legacy/,
    'quickbar reads must not merge parent-list attributes');

const attachmentPersist = sliceFunction(
    services,
    'async function __tmPersistMetaAndAttrsKernel',
    'function __tmEnqueueTimelineMutation'
);
assert.match(attachmentPersist, /const taskId = String\(id[\s\S]*let attrTargetId = taskId/,
    'attachment pre-reads must use the task item ID');

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
