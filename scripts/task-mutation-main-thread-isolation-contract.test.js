const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const stores = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const services = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const fields = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js'), 'utf8');
const dialogs = fs.readFileSync(path.join(root, 'src/task-horizon/main/30-dialogs-and-ui-foundation.js'), 'utf8');

function extractFunction(source, name) {
    const start = source.indexOf(`function ${name}(`);
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

const snapshotSchedule = extractFunction(stores, '__tmSchedulePersistTaskSnapshot');
const structuralSnapshot = extractFunction(stores, '__tmScheduleTaskSnapshotAfterLocalStructurePatch');
const kanbanProjection = extractFunction(fields, '__tmRefreshKanbanProjectionPatchNow');
const requestTaskPatch = fields.slice(
    fields.indexOf('requestTaskPatch(taskId, patch = {}, options = {})'),
    fields.indexOf('async requestTaskPatchBatch(', fields.indexOf('requestTaskPatch(taskId, patch = {}, options = {})')),
);
const commitQueuedOp = extractFunction(services, '__tmCommitQueuedOp');
const localSnapshotSchedule = extractFunction(services, '__tmScheduleTaskSnapshotAfterLocalPatch');
const taskIndexSchedule = extractFunction(stores, '__tmSchedulePersistTaskIndex');
const incrementalRefresh = extractFunction(stores, '__tmRefreshAffectedTaskBlocksIncrementally');

const beforeSnapshotTimer = snapshotSchedule.slice(0, snapshotSchedule.indexOf('__tmTaskSnapshotSaveTimer = setTimeout'));
assert.doesNotMatch(beforeSnapshotTimer, /__tmBuildFlatTasksFromTaskSnapshotTree|__tmBuildTaskSnapshotPayload/,
    'scheduling a snapshot must not traverse or clone the task tree in the interaction call stack');
assert.match(snapshotSchedule, /saveGeneration !== __tmTaskSnapshotSaveGeneration/,
    'obsolete idle snapshot jobs must be discarded');
assert.match(snapshotSchedule, /__tmShouldDeferMainViewRefreshForActiveScroll/,
    'snapshot work must wait for active scrolling to become quiet');
assert.match(snapshotSchedule, /__tmMutationEngine\?\.hasActiveWrites\?\.\(\)/,
    'snapshot work must wait until field mutations have settled');
assert.ok((snapshotSchedule.match(/saveGeneration !== __tmTaskSnapshotSaveGeneration/g) || []).length >= 3,
    'snapshot generation must be checked before work, after reads, and before publishing the cache');
assert.doesNotMatch(structuralSnapshot, /__tmUpsertCurrentTaskSnapshotStoreCache/,
    'structural optimistic updates must not synchronously rebuild the snapshot cache');
assert.match(localSnapshotSchedule, /__tmMarkLocalTaskPatchWatermark[\s\S]*opts\.persistSnapshot !== true/,
    'interactive field patches must retain pending protection without persisting a full snapshot by default');
const beforeTaskIndexTimer = taskIndexSchedule.slice(0, taskIndexSchedule.indexOf('__tmTaskIndexSaveTimer = setTimeout'));
assert.doesNotMatch(beforeTaskIndexTimer, /__tmBuildTaskIndexDocEntry|__tmRememberTaskIndexEntriesInMemory/,
    'task-index scheduling must not traverse or clone task documents in the mutation call stack');
assert.match(taskIndexSchedule, /__tmScheduleIdleTask\(runSave/,
    'task-index generation must run as background idle work');
assert.doesNotMatch(commitQueuedOp, /__tmRefreshQueuedStructuralProjection|__tmScheduleSimpleStructuralRefresh/,
    'a successful structural write must not schedule a delayed document readback');
assert.doesNotMatch(services, /function __tmScheduleSimpleStructuralRefresh/,
    'the retired successful-write reconcile timer must stay deleted');
assert.doesNotMatch(services, /__tmLogTaskMutation|__tmLogMutation|\[Task Horizon\]\[Mutation\]/,
    'retired always-on mutation diagnostics must stay deleted');
assert.doesNotMatch(incrementalRefresh, /__tmRebuildLocalDocTree\(docId\)/,
    'field-only authoritative refresh must not rebuild a structurally unchanged document tree');
assert.doesNotMatch(incrementalRefresh, /__tmSchedulePersistTaskIndex|__tmSchedulePersistTaskSnapshot/,
    'incremental field confirmation must not rebuild derived startup caches');
assert.match(incrementalRefresh, /affectsCompletionStats[\s\S]*recalcStats\(\)/,
    'full completion statistics must only be recalculated for completion-related field changes');

assert.match(kanbanProjection, /__tmScheduleViewRefresh\(\{/,
    'kanban field projection must use the coalesced refresh scheduler');
assert.doesNotMatch(kanbanProjection, /applyFilters\(\)|__tmRerenderKanbanInPlace|__tmRerenderCurrentViewInPlace/,
    'kanban field writes must not filter or rerender synchronously');
assert.match(requestTaskPatch, /__tmQueueTaskFieldPatch\(tid, nextPatch/,
    'task patch requests must reuse the unified optimistic mutation service');
assert.doesNotMatch(requestTaskPatch, /__tmRefreshTaskFieldsAcrossViews|__tmScheduleViewRefresh|applyFilters\(/,
    'requestTaskPatch must not run a second synchronous render path');
assert.match(commitQueuedOp, /type === 'taskPatch'[\s\S]*__tmPublishQueuedOpMutation\(op, 'commit'/,
    'field commits must only settle the shared mutation stream');
assert.doesNotMatch(commitQueuedOp, /__tmRefreshTaskFieldsAcrossViews|__tmScheduleViewRefresh|applyFilters\(/,
    'queued optimistic field writes must not repeat projection work during commit');
assert.match(fields, /hasActiveWrites\(\) \{[\s\S]*?__suppressedTaskDepth\.size > 0/,
    'the mutation service must expose active writes to background snapshot maintenance');

assert.match(dialogs, /task-touch-drag-start/);
assert.match(dialogs, /task-touch-drag-move/);
assert.match(dialogs, /task-touch-drop/);
assert.match(dialogs, /task-native-drag-start/);
assert.match(dialogs, /task-row-drop/);

console.log('task mutation main-thread isolation contract tests passed');
