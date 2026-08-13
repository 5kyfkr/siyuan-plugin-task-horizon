'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const schemaSource = read('src/task-horizon/main/09-task-field-schema.js');
const engineSource = read('src/task-horizon/main/34-task-projection-engine.js');
const stateSource = read('src/task-horizon/main/32-runtime-state-and-events.js');
const servicesSource = read('src/task-horizon/main/20-api-and-runtime-services.js');
const viewSource = read('src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js');
const kanbanRenderSource = read('src/task-horizon/main/render/43-render-timeline-kanban-calendar-body.js');
const manifest = JSON.parse(read('src/task-horizon/manifest.main.json'));
const recurringSource = read('src/task-horizon/main/task-runtime/54-recurring-task-runtime.js');

const context = {
    console,
    Map,
    Set,
    Object,
    Array,
    String,
    Number,
    Boolean,
    __tmTaskBoundary: {
        isTaskCompleted: (task) => task?.done === true || task?.customStatus === 'finish',
    },
};
context.globalThis = context;
vm.runInNewContext(schemaSource, context, { filename: '09-task-field-schema.js' });
vm.runInNewContext(engineSource, context, { filename: '34-task-projection-engine.js' });
const engine = context.__tmTaskProjectionEngine;
assert.ok(engine, 'ProjectionEngine must be exported');

const baseContext = {
    viewMode: 'list',
    groupMode: 'none',
    searchActive: false,
    kanbanMode: '',
    kanbanCardFields: [],
    rule: null,
};

assert.equal(engine.analyzePatch({ remark: 'x' }, baseContext).projection, false,
    'a display-only field must not rebuild projection');
assert.equal(engine.analyzePatch({ pinned: true }, baseContext).projection, true,
    'pinned always changes ordering');
assert.equal(engine.analyzePatch({ content: 'x' }, { ...baseContext, searchActive: true }).filter, true,
    'searchable content must update active search projection');
assert.equal(engine.analyzePatch({ remark: 'x' }, { ...baseContext, searchActive: true }).filter, true,
    'searchable remarks must update active search projection');
assert.equal(engine.analyzePatch({ markdown: 'x' }, { ...baseContext, searchActive: true }).filter, false,
    'fields outside the actual search matcher must not rebuild active search projection');
assert.equal(engine.analyzePatch({ customFieldValues: { effort: 4 } }, { ...baseContext, searchActive: true }).filter, false,
    'custom fields must not rebuild search until the matcher supports them');
assert.equal(engine.analyzePatch({ content: 'x' }, { ...baseContext, groupMode: 'task' }).group, true,
    'task-name grouping must depend on content');
assert.equal(engine.analyzePatch({ completionTime: '2026-08-09' }, { ...baseContext, groupMode: 'time' }).group, true,
    'time grouping must depend on task dates');
assert.equal(engine.analyzePatch({ h2Id: 'heading-a' }, { ...baseContext, viewMode: 'kanban', kanbanMode: 'heading' }).group, true,
    'heading kanban must depend on heading identity');
assert.equal(engine.isKanbanTaskVisibleByCompletion({ done: true }, false), false,
    'kanban must hide completed tasks when completed visibility is disabled');
assert.equal(engine.isKanbanTaskVisibleByCompletion({ done: false }, false), true,
    'kanban must keep incomplete tasks visible');
assert.equal(engine.isKanbanTaskVisibleByCompletion({ done: true }, true), true,
    'kanban must keep completed tasks when completed visibility is enabled');
assert.equal(engine.isKanbanTaskVisibleByCompletion({ done: false, customStatus: 'finish' }, false), false,
    'authoritative kanban rendering must use the canonical completion resolver');
assert.match(kanbanRenderSource, /__tmTaskProjectionEngine\?\.isKanbanTaskVisibleByCompletion/,
    'authoritative kanban rendering must use ProjectionEngine completion visibility');
assert.match(kanbanRenderSource, /hideCompletedDescendants && isKanbanTaskCompleted\(child\)/,
    'authoritative kanban descendant filtering must use the canonical completion resolver');
assert.match(viewSource, /hideCompleted && __tmIsTaskCompletedForProjection\(childTask\)/,
    'shared child projection filtering must use the canonical completion resolver');
assert.match(viewSource, /const projectedTask = \{\s*\.\.\.task,\s*\.\.\.\(\(patch && typeof patch === 'object'\) \? patch : \{\}\),\s*\};/,
    'optimistic kanban projection must build the operation after-state');
assert.match(viewSource, /visibleByCompletion = checker\(projectedTask, state\.showCompletedTasks\)/,
    'optimistic kanban projection must evaluate completion visibility from that after-state');
assert.match(viewSource, /const cards = Array\.from\(modal\.querySelectorAll[\s\S]*cards\.forEach\(\(node\) => \{[\s\S]*node\.hidden = true/,
    'optimistic kanban projection must hide every mounted representation of the completed task');

const scoreRule = {
    conditions: [{ field: 'priorityScore', operator: '>=', value: 10 }],
    sort: [{ field: 'priorityScore', direction: 'desc' }],
};
for (const field of ['priority', 'startDate', 'completionTime', 'customTime', 'taskCompleteAt', 'duration', 'customFieldValues', 'docId', 'root_id', 'done', 'customStatus']) {
    assert.equal(engine.analyzePatch({ [field]: 'changed' }, { ...baseContext, rule: scoreRule }).projection, true,
        `priorityScore must depend on ${field}`);
}

for (const field of ['content', 'priority', 'customStatus', 'duration', 'remark', 'pinned', 'completionTime', 'tomatoCount']) {
    const directRule = { conditions: [], sort: [{ field, direction: 'desc' }] };
    assert.equal(engine.analyzePatch({ [field]: 'changed' }, { ...baseContext, rule: directRule }).projection, true,
        `a direct ${field} sort must refresh after that field changes`);
}

const customRule = {
    conditions: [{ field: 'customField:effort', operator: '>=', value: 3 }],
    sort: [],
};
assert.equal(engine.analyzePatch({ customFieldValues: { effort: 4 } }, { ...baseContext, rule: customRule }).filter, true);
assert.equal(engine.analyzePatch({ customFieldValues: { cost: 4 } }, { ...baseContext, rule: customRule }).projection, false,
    'unrelated custom fields must not trigger rule projection');

const merged = engine.mergeChangeSets([
    {
        mutation: { type: 'taskPatch', phase: 'optimistic', source: 'first' },
        changeSet: {
            fieldChanges: [{ taskId: 'task-a', patch: { priority: 'high' } }],
            upsertedTaskIds: [], deletedTaskIds: [], placementChanges: [],
            affectedGroupIds: [], affectedDocumentIds: ['doc-a'], structural: false,
        },
    },
    {
        mutation: { type: 'taskPatch', phase: 'optimistic', source: 'second' },
        changeSet: {
            fieldChanges: [{ taskId: 'task-a', patch: { startDate: '2026-08-09' } }],
            upsertedTaskIds: [], deletedTaskIds: [], placementChanges: [],
            affectedGroupIds: ['parent-a'], affectedDocumentIds: ['doc-a'], structural: false,
        },
    },
]);
assert.deepEqual(JSON.parse(JSON.stringify(merged.fieldChanges)), [{
    taskId: 'task-a',
    patch: { priority: 'high', startDate: '2026-08-09' },
    fields: ['priority', 'startDate'],
}]);
assert.deepEqual(Array.from(merged.taskIds), ['task-a']);
assert.deepEqual(Array.from(merged.affectedGroupIds), ['parent-a']);

const mergedCustomFields = engine.mergeChangeSets([
    {
        mutation: { type: 'taskPatch', phase: 'optimistic', source: 'custom-first' },
        changeSet: { fieldChanges: [{ taskId: 'task-custom', patch: { customFieldValues: { effort: 3 } } }] },
    },
    {
        mutation: { type: 'taskPatch', phase: 'commit', source: 'custom-second' },
        changeSet: { fieldChanges: [{ taskId: 'task-custom', patch: { customFieldValues: { cost: 5 } } }] },
    },
]);
assert.deepEqual(JSON.parse(JSON.stringify(mergedCustomFields.fieldChanges)), [{
    taskId: 'task-custom',
    patch: { customFieldValues: { effort: 3, cost: 5 } },
    fields: ['customFieldValues', 'customField:effort', 'customField:cost'],
}], 'custom field patches in the same projection batch must merge by field ID');

const rapidCompletion = engine.mergeChangeSets([
    {
        mutation: { type: 'setDone', phase: 'optimistic', source: 'done-1' },
        changeSet: { fieldChanges: [{ taskId: 'task-a', patch: { done: true, customStatus: 'finish' } }] },
    },
    {
        mutation: { type: 'setDone', phase: 'optimistic', source: 'done-2' },
        changeSet: { fieldChanges: [{ taskId: 'task-a', patch: { done: false, customStatus: 'todo' } }] },
    },
    {
        mutation: { type: 'setDone', phase: 'optimistic', source: 'done-3' },
        changeSet: { fieldChanges: [{ taskId: 'task-a', patch: { done: true, customStatus: 'finish' } }] },
    },
]);
assert.deepEqual(JSON.parse(JSON.stringify(rapidCompletion.fieldChanges)), [{
    taskId: 'task-a',
    patch: { done: true, customStatus: 'finish' },
    fields: ['done', 'customStatus'],
}], 'one projection frame must retain the last completion intent for each task');

const unchangedCompletionStatus = engine.mergeChangeSets([{
    mutation: {
        type: 'taskPatch',
        phase: 'optimistic',
        source: 'detail-status',
        data: { statusBefore: { done: false } },
    },
    changeSet: {
        fieldChanges: [{
            taskId: 'task-status',
            patch: { customStatus: 'delay', done: false, priorityScore: 70 },
        }],
    },
}]);
assert.equal(unchangedCompletionStatus.fieldChanges[0].completionChanged, false,
    'an incomplete-to-incomplete status change must not request completion-tree reconciliation');

const completedStatus = engine.mergeChangeSets([{
    mutation: {
        type: 'taskPatch',
        phase: 'optimistic',
        source: 'detail-status',
        data: { statusBefore: { done: false } },
    },
    changeSet: {
        fieldChanges: [{
            taskId: 'task-status',
            patch: { customStatus: 'done', done: true, taskCompleteAt: '2026-08-11T12:00:00+08:00' },
        }],
    },
}]);
assert.equal(completedStatus.fieldChanges[0].completionChanged, true,
    'a real incomplete-to-complete transition must keep completion-tree reconciliation');

const queuedMutationStart = servicesSource.indexOf('function __tmBuildQueuedOpMutation(');
const queuedMutationEnd = servicesSource.indexOf('\n\n    function __tmPublishQueuedOpMutation', queuedMutationStart);
assert.ok(queuedMutationStart >= 0 && queuedMutationEnd > queuedMutationStart,
    'queued mutation builder must remain extractable');
const queuedMutationSource = servicesSource.slice(queuedMutationStart, queuedMutationEnd);
const mutationContext = {
    __tmBuildQueuedOpAffectedScope: () => ({ taskIds: ['task-score'] }),
    __tmDoesPatchAffectPriorityScore: (patch) => Object.prototype.hasOwnProperty.call(patch || {}, 'customStatus'),
    __tmTaskBoundary: { getTask: () => ({ id: 'task-score', priorityScore: 70 }) },
};
mutationContext.globalThis = mutationContext;
vm.runInNewContext(`${queuedMutationSource}\nthis.buildQueuedMutation = __tmBuildQueuedOpMutation;`, mutationContext);
const scoreMutation = mutationContext.buildQueuedMutation({
    type: 'taskPatch',
    data: { taskId: 'task-score', patch: { customStatus: 'postponed' } },
}, 'optimistic');
assert.deepEqual(JSON.parse(JSON.stringify(scoreMutation.patch)), {
    customStatus: 'postponed',
    priorityScore: 70,
}, 'score-affecting mutations must publish the recomputed score to overlays and projection consumers');

const engineIndex = manifest.scripts.indexOf('main/34-task-projection-engine.js');
const schemaIndex = manifest.scripts.indexOf('main/09-task-field-schema.js');
assert.ok(schemaIndex > manifest.scripts.indexOf('main/08-license-runtime.js'));
assert.ok(schemaIndex < manifest.scripts.indexOf('main/10-stores-rules-and-cache.js'));
assert.ok(engineIndex > manifest.scripts.indexOf('main/33-task-boundary-facades.js'));
assert.ok(engineIndex < manifest.scripts.indexOf('main/task-runtime/51-whiteboard-and-link-runtime.js'));

const flushStart = stateSource.indexOf('const flushTaskChangeSets = () =>');
const flushEnd = stateSource.indexOf('\n    const scheduleTaskChangeSet', flushStart);
assert.ok(flushStart >= 0 && flushEnd > flushStart);
const flushBlock = stateSource.slice(flushStart, flushEnd);
assert.match(flushBlock, /__tmTaskProjectionEngine\?\.flush\?\.\(entries\)/,
    'TaskStore projection manager must delegate the whole batch to ProjectionEngine');
assert.doesNotMatch(flushBlock, /__tmDoesPatchNeedProjectionRefresh|__tmRefreshTaskFieldsAcrossViews|withFilters/,
    'state layer must not own view or rule refresh decisions');
const managerStart = stateSource.indexOf('const __tmProjectionManager =');
const managerEnd = stateSource.indexOf('subscribeTaskMutation((mutation)', managerStart);
assert.ok(managerStart >= 0 && managerEnd > managerStart);
const managerSource = stateSource.slice(managerStart, managerEnd);
assert.ok(managerSource.indexOf('deferProjection') < managerSource.indexOf("normalized.phase === 'commit'"),
    'a deferred composite mutation must not persist or project an intermediate commit');
assert.match(viewSource, /setRuntimeHandler\(__tmApplyTaskProjectionChangeSets\)/,
    'the view runtime must register one ProjectionEngine adapter');

const handlerStart = viewSource.indexOf('function __tmApplyTaskProjectionChangeSets(');
const handlerEnd = viewSource.indexOf('globalThis.__tmApplyTaskProjectionChangeSets', handlerStart);
assert.ok(handlerStart >= 0 && handlerEnd > handlerStart);
const handlerSource = viewSource.slice(handlerStart, handlerEnd);
assert.ok(handlerSource.indexOf('__tmRefreshTaskFieldsAcrossViews') < handlerSource.indexOf('__tmScheduleTaskProjectionBatch'),
    'visible field DOM must patch before expensive projection is scheduled');
assert.match(handlerSource, /presentationByTaskId[\s\S]*preserveActiveDetail[\s\S]*allowMountedInactive/,
    'batched ChangeSets must preserve active-detail and split-pane presentation context');

const schedulerStart = viewSource.indexOf('function __tmScheduleTaskProjectionBatch(');
const schedulerEnd = viewSource.indexOf('function __tmApplyTaskProjectionChangeSets(', schedulerStart);
assert.ok(schedulerStart >= 0 && schedulerEnd > schedulerStart);
const schedulerSource = viewSource.slice(schedulerStart, schedulerEnd);
assert.equal((schedulerSource.match(/requestAnimationFrame\(/g) || []).length, 1,
    'projection work must be coalesced into one animation frame');
assert.match(schedulerSource, /isInputPending\?\.\(\{ includeContinuous: true \}\)[\s\S]*setTimeout\(run, 16\)/,
    'projection work must yield while touch, scroll, or other continuous input is pending');
assert.match(schedulerSource, /mergeChangeSets\?\.\(pending\)/,
    'all mutations arriving before the frame must merge into one projection batch');
assert.match(schedulerSource, /presentation\?\.allowMountedInactive === true[\s\S]*allowMountedInactive,/,
    'projection batches must preserve permission to update a mounted view behind task detail');

const projectionRunStart = viewSource.indexOf('function __tmRunTaskProjectionBatch(');
const projectionRunEnd = viewSource.indexOf('const __tmPendingProjectionEntries =', projectionRunStart);
assert.ok(projectionRunStart >= 0 && projectionRunEnd > projectionRunStart);
const projectionRunSource = viewSource.slice(projectionRunStart, projectionRunEnd);
assert.match(projectionRunSource, /const allowMountedInactive = liveModal && opts\.allowMountedInactive === true;[\s\S]*const visible = liveModal && \(allowMountedInactive/,
    'mounted inactive views must remain eligible for immediate projection');
assert.match(projectionRunSource, /changes\[index\]\?\.completionChanged !== false/,
    'status changes that preserve completion state must stay on the single-task projection path');
assert.match(projectionRunSource, /__tmScheduleViewRefresh\(\{[\s\S]*allowMountedInactive,/,
    'projection fallbacks must retain mounted inactive refresh permission for non-DOM-reorder views');
assert.doesNotMatch(projectionRunSource, /bypassScrollDefer:\s*true|bypassInteractionDefer:\s*true/,
    'projection fallback must not redraw the view through active scrolling or touch input');

const listPatchStart = viewSource.indexOf('function __tmTryApplyListProjectionBatchInPlace(');
const listPatchEnd = viewSource.indexOf('function __tmCollectTaskProjectionClosure(', listPatchStart);
assert.ok(listPatchStart >= 0 && listPatchEnd > listPatchStart);
const listPatchSource = viewSource.slice(listPatchStart, listPatchEnd);
assert.doesNotMatch(listPatchSource, /innerHTML|replaceWith|getBoundingClientRect|offsetWidth|offsetHeight|scrollHeight/,
    'list projection must reorder keyed rows without rebuilding HTML or forcing layout');
assert.match(listPatchSource, /tbody\.insertBefore\(node/,
    'list projection must reuse mounted row nodes');
assert.match(listPatchSource, /affected[\s\S]*unmountedAffected[\s\S]*currentByKey\.has\(`task:\$\{taskId\}`\)[\s\S]*rowModel\.some[\s\S]*return false/,
    'list projection must fall back when an affected projected task has no mounted row');
const checklistPatchStart = viewSource.indexOf('function __tmTryApplyChecklistOptimisticProjectionInPlace(');
const checklistPatchEnd = viewSource.indexOf('function __tmGetProjectedDirectChildStats(', checklistPatchStart);
assert.ok(checklistPatchStart >= 0 && checklistPatchEnd > checklistPatchStart);
const checklistPatchSource = viewSource.slice(checklistPatchStart, checklistPatchEnd);
assert.match(checklistPatchSource, /nextNode instanceof Node[\s\S]*nextNode\.parentNode !== targetContainer[\s\S]*return false/,
    'checklist projection must reject an insertBefore anchor that no longer belongs to the target container');
assert.match(checklistPatchSource, /block\.includes\(nextNode\)[\s\S]*return false/,
    'checklist projection must fall back before moving an insertion anchor into its own fragment');
assert.match(viewSource, /if \(mode === 'list'\) \{\s*projected = __tmTryApplyListProjectionBatchInPlace\(taskIds\)/,
    'structural list moves must attempt keyed row reuse before falling back to a view redraw');
assert.match(projectionRunSource, /fieldPatchByTaskId[\s\S]*placementTaskIds\.forEach\(\(taskId\) => \{[\s\S]*const taskPatch = fieldPatchByTaskId\.get\(taskId\) \|\| \{\}[\s\S]*__tmTryApplyKanbanOptimisticProjectionInPlace\(taskId, \{[\s\S]*\.\.\.taskPatch,[\s\S]*__tmPlacement: true/,
    'batched kanban projection must preserve each changed task after-state without repositioning closure-only siblings');
assert.match(projectionRunSource, /let projected = !projectionRequired \|\| !visible;[\s\S]*mode === 'list'[\s\S]*mode === 'checklist'[\s\S]*mode === 'kanban'[\s\S]*visible && projectionRequired && !projected[\s\S]*__tmScheduleViewRefresh\(\{/,
    'timeline, whiteboard, and calendar projection changes must fall back to an immediate current-view refresh');
assert.match(projectionRunSource, /if \(batch\.structural === true \|\| fieldPatchByTaskId\.has\(taskId\)\) projected = false;/,
    'an unmounted closure-only task must not force a full view refresh after a field mutation');
assert.match(kanbanRenderSource, /resolveKanbanProjectedTask[\s\S]*__tmTaskBoundary\?\.getTask\?\.\(tid, \{[\s\S]*includePending: true,[\s\S]*preferPending: true[\s\S]*pushKanbanChildForParent[\s\S]*kanbanChildrenByParentId\.get\(pid\)\.push\(projectedChild\)/,
    'kanban child indexing must prefer the current projected task over stale nested snapshots');

const recurringDeleteStart = recurringSource.indexOf('async function __tmDeleteTaskRepeatHistoryEntry(');
const recurringDeleteEnd = recurringSource.indexOf('\n    async function __tmSetDetachedTaskRepeatHistoryEntry(', recurringDeleteStart);
assert.ok(recurringDeleteStart >= 0 && recurringDeleteEnd > recurringDeleteStart);
const recurringDeleteSource = recurringSource.slice(recurringDeleteStart, recurringDeleteEnd);
assert.match(recurringDeleteSource, /__tmTaskMutationBus\?\.publish\?\.\(\{[\s\S]*deletedTaskIds:[\s\S]*structural: true/,
    'recurring history deletion must publish the removed virtual row through the common structural projection');
assert.doesNotMatch(recurringDeleteSource, /__tmRefreshViewsAfterTaskMutation/,
    'normal recurring history deletion must not own a second generic refresh path');

const recurringAdvanceStart = recurringSource.indexOf('async function __tmAdvanceRecurringTaskAfterCompletionInternal(');
const recurringAdvanceEnd = recurringSource.indexOf('\n    function __tmScheduleRecurringTaskAdvanceAfterCompletion(', recurringAdvanceStart);
assert.ok(recurringAdvanceStart >= 0 && recurringAdvanceEnd > recurringAdvanceStart);
const recurringAdvanceSource = recurringSource.slice(recurringAdvanceStart, recurringAdvanceEnd);
assert.match(recurringAdvanceSource, /type:\s*'taskLifecycle'[\s\S]*upsertedTaskIds:[\s\S]*recurringInstanceTaskId[\s\S]*structural:\s*true/,
    'recurring completion must publish the new virtual row through one structural projection');

console.log('task projection engine contract tests passed');
