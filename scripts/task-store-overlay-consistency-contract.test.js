'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/32-runtime-state-and-events.js'),
    'utf8',
);

const state = {
    flatTasks: {},
    pendingInsertedTasks: {},
    pendingDeletedTasks: {},
    doneOverrides: {},
    taskTree: [],
    filteredTasks: [],
    otherBlocks: [],
    collapsedTaskIds: new Set(),
    viewMode: 'list',
};
const localWatermarks = new Map();
const context = {
    console,
    state,
    SettingsStore: { data: {} },
    MetaStore: { set() {}, remapId() {} },
    setTimeout,
    clearTimeout,
    queueMicrotask,
    Promise,
    Date,
    Map,
    Set,
    Symbol,
    __tmGetLocalTaskPatchWatermark: (taskId) => localWatermarks.get(String(taskId || '').trim()) || null,
    __tmGetLocalTaskPatchWatermarkValue: (taskId, fieldKey) => {
        const entry = localWatermarks.get(String(taskId || '').trim());
        const key = String(fieldKey || '').trim() === 'task_marker' ? 'taskMarker' : String(fieldKey || '').trim();
        const fields = new Set(Array.isArray(entry?.fields) ? entry.fields : []);
        const values = entry?.values && typeof entry.values === 'object' ? entry.values : {};
        return fields.has(key) && Object.prototype.hasOwnProperty.call(values, key)
            ? { has: true, value: values[key] }
            : { has: false, value: undefined };
    },
    __tmDoesPatchAffectPriorityScore: (patch) => ['priority', 'customStatus']
        .some((key) => Object.prototype.hasOwnProperty.call(patch || {}, key)),
    __tmEnsureTaskPriorityScore: (task) => {
        const importanceDelta = { high: 20, medium: 10, low: -5, none: 0 };
        const statusDelta = { todo: 0, delayed: -30 };
        const priority = String(task?.priority || 'none').trim() || 'none';
        const status = String(task?.customStatus || 'todo').trim() || 'todo';
        const score = 100 + Number(importanceDelta[priority] || 0) + Number(statusDelta[status] || 0);
        task.priorityScore = score;
        return score;
    },
};
context.globalThis = context;
vm.runInNewContext(source, context, { filename: '32-runtime-state-and-events.js' });

const store = context.__tmTaskStore;
assert.ok(store, 'TaskStore must be exported');
const restoreSnapshotTask = (task) => {
    if (!(task && typeof task === 'object') || !String(task.id || '').trim()) return;
    state.flatTasks[task.id] = task;
    (Array.isArray(task.children) ? task.children : []).forEach(restoreSnapshotTask);
};
const removeSnapshotTask = (task) => {
    if (!(task && typeof task === 'object') || !String(task.id || '').trim()) return;
    (Array.isArray(task.children) ? task.children : []).forEach(removeSnapshotTask);
    delete state.flatTasks[task.id];
};
context.__tmRollbackDeleteOptimisticLocal = (snapshot) => {
    restoreSnapshotTask(snapshot?.task);
    return !!snapshot?.task;
};
context.__tmApplyDeleteOptimisticLocal = (snapshot) => {
    removeSnapshotTask(snapshot?.task);
    return !!snapshot?.task;
};

const baseTask = {
    id: 'task-a',
    content: 'Before',
    title: 'Before',
    priority: '',
    priorityScore: 100,
    startDate: '',
    root_id: 'doc-a',
    docId: 'doc-a',
    children: [],
};
store.replaceFlat({ 'task-a': { ...baseTask } }, { authoritative: true, mergeOtherBlocks: false });

const unrelatedRead = store.captureRead(['doc-a']);
store.applyMutation({
    type: 'taskPatch',
    phase: 'optimistic',
    opId: 'op-unrelated',
    taskId: 'task-b',
    docId: 'doc-b',
    patch: { priority: 'low' },
}, { applyLocal: false });
assert.equal(store.isReadCurrent(unrelatedRead), true, 'a mutation in another document must not invalidate this document read');
store.applyMutation({
    type: 'taskPatch',
    phase: 'rollback',
    opId: 'op-unrelated',
    taskId: 'task-b',
    docId: 'doc-b',
    patch: { priority: 'low' },
}, { applyLocal: false });

const readBeforeWrite = store.captureRead(['doc-a']);
store.applyMutation({
    type: 'taskPatch',
    phase: 'optimistic',
    opId: 'op-priority',
    taskId: 'task-a',
    patch: { priority: 'high' },
}, { applyLocal: false });
assert.equal(store.isReadCurrent(readBeforeWrite), false, 'a query started before a mutation must become stale');
assert.equal(store.getProjected('task-a').priority, 'high');
assert.equal(store.getProjected('task-a').priorityScore, 120,
    'an optimistic importance overlay must expose its recomputed priority score');

store.replaceFlat({ 'task-a': { ...baseTask, content: 'Stale query' } }, {
    authoritative: true,
    mergeOtherBlocks: false,
});
assert.equal(state.flatTasks['task-a'].priority, 'high', 'a pending overlay must survive authoritative replacement');
assert.equal(state.flatTasks['task-a'].priorityScore, 120,
    'a stale authoritative replacement must not restore the pre-mutation priority score');

store.applyMutation({
    type: 'taskPatch',
    phase: 'commit',
    opId: 'op-priority',
    taskId: 'task-a',
    patch: { priority: 'high' },
    task: { ...baseTask, content: 'Kernel title', title: 'Kernel title', priority: 'medium' },
}, { applyLocal: false });
assert.equal(store.listPendingOverlays().length, 0, 'commit must remove its overlay');
assert.equal(store.getConfirmed('task-a').priority, 'medium', 'the authoritative receipt must win over the optimistic value');
assert.equal(store.getConfirmed('task-a').priorityScore, 110,
    'the committed base must derive priority score from the final authoritative fields');
assert.equal(state.flatTasks['task-a'].priority, 'medium', 'the authoritative receipt must update mounted task mirrors');
assert.equal(state.flatTasks['task-a'].content, 'Kernel title');

store.applyMutation({
    type: 'taskPatch',
    phase: 'optimistic',
    opId: 'op-partial-receipt',
    taskId: 'task-a',
    patch: { priority: 'high' },
}, { applyLocal: false });
store.applyMutation({
    type: 'taskPatch',
    phase: 'commit',
    opId: 'op-partial-receipt',
    taskId: 'task-a',
    patch: { priority: 'high' },
    task: { id: 'task-a', priority: 'high' },
}, { applyLocal: false });
assert.equal(store.getConfirmed('task-a').content, 'Kernel title',
    'a partial authoritative receipt must preserve confirmed fields it did not return');
assert.equal(store.getConfirmed('task-a').priority, 'high');

store.applyMutation({
    type: 'taskPatch',
    phase: 'optimistic',
    opId: 'op-delayed-score',
    taskId: 'task-a',
    patch: { customStatus: 'delayed' },
}, { applyLocal: false });
assert.equal(store.getProjected('task-a').priorityScore, 90,
    'a status overlay must recompute the score from the current importance');
store.applyMutation({
    type: 'taskPatch',
    phase: 'optimistic',
    opId: 'op-clear-priority',
    taskId: 'task-a',
    patch: { priority: '' },
}, { applyLocal: false });
assert.equal(store.getProjected('task-a').priorityScore, 70,
    'stacked score overlays must derive from their final combined fields');
store.applyMutation({
    type: 'taskPatch',
    phase: 'commit',
    opId: 'op-delayed-score',
    taskId: 'task-a',
    patch: { customStatus: 'delayed' },
    task: { id: 'task-a', customStatus: 'delayed' },
}, { applyLocal: false });
assert.equal(store.getProjected('task-a').priorityScore, 70,
    'settling an older score mutation must retain the newer overlay score');
store.applyMutation({
    type: 'taskPatch',
    phase: 'rollback',
    opId: 'op-clear-priority',
    taskId: 'task-a',
    patch: { priority: '' },
}, { applyLocal: false });
assert.equal(store.getProjected('task-a').priorityScore, 90,
    'rolling back a newer score overlay must reveal the recomputed committed score');

store.applyMutation({
    type: 'taskPatch',
    phase: 'optimistic',
    opId: 'op-id-only-receipt',
    taskId: 'task-a',
    patch: { customStatus: 'doing' },
}, { applyLocal: false });
store.applyMutation({
    type: 'taskPatch',
    phase: 'commit',
    opId: 'op-id-only-receipt',
    taskId: 'task-a',
    patch: { customStatus: 'doing' },
    task: { id: 'task-a' },
}, { applyLocal: false });
assert.equal(store.getConfirmed('task-a').customStatus, 'doing',
    'an id-only successful receipt must commit the acknowledged optimistic patch');

store.applyMutation({
    type: 'taskPatch',
    phase: 'optimistic',
    opId: 'op-unified-title',
    taskId: 'task-a',
    patch: { title: 'Unified title', priority: 'medium' },
}, { applyLocal: true });
assert.equal(store.getProjected('task-a').content, 'Unified title',
    'a unified title patch must update the presentation content alias immediately');
store.applyMutation({
    type: 'taskPatch',
    phase: 'commit',
    opId: 'op-unified-title',
    taskId: 'task-a',
    patch: { title: 'Unified title', priority: 'medium' },
    task: { id: 'task-a', title: 'Unified title', priority: 'medium' },
}, { applyLocal: false });
assert.equal(store.getConfirmed('task-a').content, 'Unified title');

store.applyMutation({
    type: 'contentPatch',
    phase: 'optimistic',
    opId: 'op-title',
    taskId: 'task-a',
    patch: { content: 'Draft' },
}, { applyLocal: false });
assert.equal(store.getProjected('task-a').content, 'Draft');
store.applyMutation({
    type: 'contentPatch',
    phase: 'rollback',
    opId: 'op-title',
    taskId: 'task-a',
    patch: { content: 'Draft' },
}, { applyLocal: false });
assert.equal(store.listPendingOverlays().length, 0, 'rollback must remove its overlay');
assert.equal(store.getProjected('task-a').content, 'Unified title', 'rollback must reveal the confirmed base');

const attachmentTask = {
    ...store.getConfirmed('task-a'),
    attachments: [{ path: 'assets/old.pdf' }],
    __attachmentPaths: ['assets/old.pdf'],
    attachmentCount: 1,
};
store.replaceFlat({ 'task-a': attachmentTask }, { authoritative: true, mergeOtherBlocks: false });
store.applyMutation({
    type: 'taskPatch',
    phase: 'optimistic',
    opId: 'op-remove-attachment',
    taskId: 'task-a',
    patch: { attachments: [] },
}, { applyLocal: false });
assert.deepEqual(Array.from(store.getProjected('task-a').__attachmentPaths || []), [],
    'an attachment overlay must clear the higher-priority attachment path cache');
assert.equal(store.getProjected('task-a').attachmentCount, 0,
    'an attachment overlay must update the attachment count atomically');
store.replaceFlat({ 'task-a': attachmentTask }, { authoritative: true, mergeOtherBlocks: false });
assert.deepEqual(Array.from(store.getProjected('task-a').__attachmentPaths || []), [],
    'a stale authoritative refresh must not resurrect an attachment while removal is pending');
store.applyMutation({
    type: 'taskPatch',
    phase: 'commit',
    opId: 'op-remove-attachment',
    taskId: 'task-a',
    patch: { attachments: [] },
}, { applyLocal: false });
assert.deepEqual(Array.from(store.getProjected('task-a').__attachmentPaths || []), [],
    'committing an attachment removal without a task receipt must keep the acknowledged empty list');
assert.equal(store.getConfirmed('task-a').attachmentCount, 0);
localWatermarks.set('task-a', {
    fields: ['attachments'],
    values: { attachments: [] },
});
store.acceptAuthoritative([attachmentTask], {
    docIds: ['doc-a'],
    replaceDocuments: true,
    replaceStructure: true,
});
assert.deepEqual(Array.from(store.getProjected('task-a').__attachmentPaths || []), [],
    'a stale authoritative attachment read must not replace a locally committed removal watermark');
localWatermarks.clear();

store.applyMutation({
    type: 'taskPatch',
    phase: 'local',
    taskId: 'task-a',
    docId: 'doc-a',
    patch: { remark: 'Native edit' },
}, { applyLocal: true });
assert.equal(store.listPendingOverlays().length, 0,
    'already-applied local events must update the confirmed base without leaking pending overlays');
assert.equal(store.getConfirmed('task-a').remark, 'Native edit');

store.applyMutation({
    type: 'deleteTask',
    phase: 'optimistic',
    opId: 'op-delete',
    taskId: 'task-a',
}, { applyLocal: false });
assert.equal(store.getProjected('task-a'), null, 'a pending delete must hide the task from reads');
store.applyMutation({
    type: 'deleteTask',
    phase: 'rollback',
    opId: 'op-delete',
    taskId: 'task-a',
}, { applyLocal: false });
assert.equal(store.getProjected('task-a').content, 'Unified title', 'delete rollback must restore the confirmed task');

store.applyMutation({
    type: 'taskPatch',
    phase: 'optimistic',
    opId: 'op-a',
    taskId: 'task-a',
    patch: { startDate: '2026-08-08' },
}, { applyLocal: false });
store.applyMutation({
    type: 'taskPatch',
    phase: 'optimistic',
    opId: 'op-b',
    taskId: 'task-a',
    patch: { startDate: '2026-08-09' },
}, { applyLocal: false });
assert.equal(store.getProjected('task-a').startDate, '2026-08-09', 'the newest pending overlay must be visible');
store.applyMutation({
    type: 'taskPatch',
    phase: 'commit',
    opId: 'op-a',
    taskId: 'task-a',
    patch: { startDate: '2026-08-08' },
}, { applyLocal: false });
assert.equal(store.getProjected('task-a').startDate, '2026-08-09', 'settling an older write must preserve a newer overlay');
store.applyMutation({
    type: 'taskPatch',
    phase: 'rollback',
    opId: 'op-b',
    taskId: 'task-a',
    patch: { startDate: '2026-08-09' },
}, { applyLocal: false });
assert.equal(store.getProjected('task-a').startDate, '2026-08-08', 'rolling back the newer write must reveal the older committed value');

store.applyMutation({
    type: 'setDone',
    phase: 'optimistic',
    opId: 'op-done-1',
    taskId: 'task-a',
    patch: { done: true, customStatus: 'finish' },
}, { applyLocal: false });
store.applyMutation({
    type: 'setDone',
    phase: 'optimistic',
    opId: 'op-done-2',
    taskId: 'task-a',
    patch: { done: false, customStatus: 'todo' },
}, { applyLocal: false });
store.applyMutation({
    type: 'setDone',
    phase: 'optimistic',
    opId: 'op-done-3',
    taskId: 'task-a',
    patch: { done: true, customStatus: 'finish' },
}, { applyLocal: false });
state.doneOverrides['task-a'] = true;
assert.equal(store.getProjected('task-a').done, true, 'rapid completion overlays must expose the latest requested state');
store.applyMutation({
    type: 'setDone',
    phase: 'commit',
    opId: 'op-done-1',
    taskId: 'task-a',
    patch: { done: true, customStatus: 'finish' },
}, { applyLocal: false });
assert.equal(store.getProjected('task-a').done, true, 'settling an older completion must preserve newer intent');
assert.equal(state.doneOverrides['task-a'], true, 'the compatibility override must follow the latest pending overlay');
store.applyMutation({
    type: 'setDone',
    phase: 'rollback',
    opId: 'op-done-2',
    taskId: 'task-a',
    patch: { done: false, customStatus: 'todo' },
}, { applyLocal: false });
assert.equal(store.getProjected('task-a').done, true, 'rolling back an intermediate completion must not replace the final intent');
store.applyMutation({
    type: 'setDone',
    phase: 'commit',
    opId: 'op-done-3',
    taskId: 'task-a',
    patch: { done: true, customStatus: 'finish' },
    task: { id: 'task-a', done: true, customStatus: 'finish' },
}, { applyLocal: false });
assert.equal(store.getProjected('task-a').done, true);
assert.equal(Object.prototype.hasOwnProperty.call(state.doneOverrides, 'task-a'), false,
    'the legacy completion override must be removed after the last overlay settles');

const nativeCheckboxTask = {
    ...baseTask,
    done: false,
    customStatus: 'todo',
    custom_status: 'todo',
    taskMarker: ' ',
    task_marker: ' ',
    markdown: '- [ ] Before',
};
store.replaceFlat({ 'task-a': nativeCheckboxTask }, { authoritative: true, mergeOtherBlocks: false });
localWatermarks.set('task-a', {
    fields: ['done', 'taskMarker', 'task_marker', 'markdown'],
    values: { done: true, taskMarker: 'X', task_marker: 'X', markdown: '- [X] Before' },
    source: 'native-doc-checkbox-mutation-icon',
});
store.applyMutation({
    type: 'taskPatch',
    phase: 'local',
    taskId: 'task-a',
    source: 'native-doc-checkbox-mutation-icon',
    patch: { done: true, taskMarker: 'X', task_marker: 'X', markdown: '- [X] Before' },
}, { applyLocal: true });
localWatermarks.set('task-a', {
    fields: ['done', 'taskMarker', 'task_marker', 'markdown'],
    values: { done: false, taskMarker: ' ', task_marker: ' ', markdown: '- [ ] Before' },
    source: 'native-doc-checkbox-mutation-icon',
});
store.applyMutation({
    type: 'taskPatch',
    phase: 'local',
    taskId: 'task-a',
    source: 'native-doc-checkbox-mutation-icon',
    patch: { done: false, taskMarker: ' ', task_marker: ' ', markdown: '- [ ] Before' },
}, { applyLocal: true });
state.doneOverrides['task-a'] = true;
store.acceptAuthoritative([{ ...nativeCheckboxTask }], { docIds: ['doc-a'] });
assert.equal(store.getConfirmed('task-a').done, false,
    'a native document watermark must not replace the final authoritative checkbox state');
assert.equal(store.getProjected('task-a').done, false,
    'rapid native document toggles must project the final unchecked state');
assert.equal(Object.prototype.hasOwnProperty.call(state.doneOverrides, 'task-a'), false,
    'authoritative native document acceptance must retire a stale legacy completion override');

localWatermarks.set('task-a', {
    fields: ['done', 'taskMarker', 'task_marker', 'markdown'],
    values: { done: true, taskMarker: 'X', task_marker: 'X', markdown: '- [X] Before' },
    source: 'set-done-optimistic',
});
store.applyMutation({
    type: 'setDone',
    phase: 'optimistic',
    opId: 'op-plugin-completion-protection',
    taskId: 'task-a',
    patch: { done: true, taskMarker: 'X', task_marker: 'X', markdown: '- [X] Before' },
}, { applyLocal: false });
state.doneOverrides['task-a'] = true;
store.acceptAuthoritative([{ ...nativeCheckboxTask }], { docIds: ['doc-a'] });
assert.equal(store.getConfirmed('task-a').done, false,
    'a stale authoritative read must remain the confirmed base while a plugin completion is pending');
assert.equal(store.getProjected('task-a').done, true,
    'a pending plugin completion overlay must remain visible over a stale authoritative read');
assert.equal(state.doneOverrides['task-a'], true,
    'a pending plugin completion may continue to protect its compatibility override');
store.applyMutation({
    type: 'setDone',
    phase: 'rollback',
    opId: 'op-plugin-completion-protection',
    taskId: 'task-a',
    patch: { done: true, taskMarker: 'X', task_marker: 'X', markdown: '- [X] Before' },
}, { applyLocal: false });
localWatermarks.delete('task-a');

const undoneCompletionTask = {
    ...baseTask,
    done: false,
    customStatus: 'todo',
    custom_status: 'todo',
    taskMarker: ' ',
    task_marker: ' ',
    markdown: '- [ ] Before',
};
store.replaceFlat({ 'task-a': undoneCompletionTask }, { authoritative: true, mergeOtherBlocks: false });
store.applyMutation({
    type: 'setDone',
    phase: 'optimistic',
    opId: 'op-complete-before-cancel',
    taskId: 'task-a',
    patch: {
        done: true,
        customStatus: 'finish',
        taskMarker: 'X',
        task_marker: 'X',
        markdown: '- [X] Before',
    },
    data: { intentRevision: 10 },
}, { applyLocal: false });
store.applyMutation({
    type: 'setDone',
    phase: 'optimistic',
    opId: 'op-cancel-after-complete',
    taskId: 'task-a',
    patch: {
        done: false,
        customStatus: 'todo',
        taskMarker: ' ',
        task_marker: ' ',
        markdown: '- [ ] Before',
    },
    data: { intentRevision: 11 },
}, { applyLocal: false });
store.applyMutation({
    type: 'setDone',
    phase: 'commit',
    opId: 'op-complete-before-cancel',
    taskId: 'task-a',
    patch: {
        done: true,
        customStatus: 'finish',
        taskMarker: 'X',
        task_marker: 'X',
        markdown: '- [X] Before',
    },
    task: {
        id: 'task-a',
        done: true,
        customStatus: 'finish',
        taskMarker: 'X',
        task_marker: 'X',
        markdown: '- [X] Before',
    },
    data: { intentRevision: 10 },
}, { applyLocal: false });
const pendingCancelProjection = store.getProjected('task-a');
assert.equal(pendingCancelProjection.done, false,
    'an older completed receipt must not replace the pending cancel intent');
assert.equal(pendingCancelProjection.taskMarker, ' ',
    'the pending cancel intent must override the completed receipt marker');
assert.equal(pendingCancelProjection.markdown, '- [ ] Before',
    'the pending cancel intent must override the completed receipt markdown');
store.applyMutation({
    type: 'setDone',
    phase: 'commit',
    opId: 'op-cancel-after-complete',
    taskId: 'task-a',
    patch: {
        done: false,
        customStatus: 'todo',
        taskMarker: ' ',
        task_marker: ' ',
        markdown: '- [ ] Before',
    },
    task: {
        ...undoneCompletionTask,
        done: true,
        customStatus: 'finish',
        custom_status: 'finish',
        taskMarker: 'X',
        task_marker: 'X',
        markdown: '- [X] Before',
    },
    data: { intentRevision: 11 },
}, { applyLocal: false });
assert.equal(store.getProjected('task-a').done, false,
    'the committed completion intent must win over a stale kernel receipt');
assert.equal(store.getProjected('task-a').taskMarker, ' ',
    'a stale completed receipt must not re-check a committed cancellation');

store.replaceFlat({ 'task-a': undoneCompletionTask }, { authoritative: true, mergeOtherBlocks: false });
localWatermarks.set('task-a', {
    fields: ['done', 'taskMarker', 'markdown'],
    values: { done: true, taskMarker: 'X', markdown: '- [X] Before' },
});
store.acceptAuthoritative([undoneCompletionTask], {
    docIds: ['doc-a'],
    replaceDocuments: true,
    replaceStructure: true,
});
assert.equal(store.getConfirmed('task-a').done, true,
    'a stale document receipt must not replace a locally committed completion watermark');
assert.equal(store.getConfirmed('task-a').taskMarker, 'X');
localWatermarks.clear();

store.replaceFlat({ 'task-a': undoneCompletionTask }, { authoritative: true, mergeOtherBlocks: false });
store.applyMutation({
    type: 'setDone',
    phase: 'optimistic',
    opId: 'op-pending-watermark',
    taskId: 'task-a',
    patch: { done: true, taskMarker: 'X', task_marker: 'X', markdown: '- [X] Before' },
}, { applyLocal: false });
localWatermarks.set('task-a', {
    fields: ['done', 'taskMarker', 'markdown'],
    values: { done: true, taskMarker: 'X', markdown: '- [X] Before' },
});
store.acceptAuthoritative([{
    ...undoneCompletionTask,
    done: true,
    taskMarker: 'X',
    task_marker: 'X',
    markdown: '- [X] Before',
}], {
    docIds: ['doc-a'],
    replaceDocuments: true,
    replaceStructure: true,
});
store.applyMutation({
    type: 'setDone',
    phase: 'rollback',
    opId: 'op-pending-watermark',
    taskId: 'task-a',
    patch: { done: true, taskMarker: 'X', task_marker: 'X', markdown: '- [X] Before' },
}, { applyLocal: false });
assert.equal(store.getProjected('task-a').done, false,
    'an uncommitted watermark must not be promoted when its backend write rolls back');
localWatermarks.clear();

const createdTask = { ...baseTask, id: 'task-new', content: 'New', title: 'New' };
store.applyMutation({
    type: 'createTaskInDoc',
    phase: 'optimistic',
    opId: 'op-create',
    taskId: 'task-new',
    tempId: 'task-new',
    task: createdTask,
}, { applyLocal: false });
assert.equal(store.getProjected('task-new').content, 'New');
store.applyMutation({
    type: 'createTaskInDoc',
    phase: 'commit',
    opId: 'op-create',
    taskId: 'task-new',
    tempId: 'task-new',
    realId: 'task-new',
    task: { ...createdTask, priority: 'high' },
}, { applyLocal: false });
assert.equal(store.getConfirmed('task-new').priority, 'high', 'a committed create must enter the confirmed base');
assert.equal(store.listPendingOverlays().length, 0);

const parentTask = { ...baseTask, id: 'task-parent', content: 'Parent', title: 'Parent', children: [] };
store.acceptAuthoritative([parentTask], { docIds: ['doc-a'] });
store.upsertLocal({ ...parentTask }, { status: 'confirmed-parent' });
const tempSubtask = {
    ...baseTask,
    id: 'task-temp-child',
    content: 'First child',
    title: 'First child',
    parentTaskId: 'task-parent',
    parent_task_id: 'task-parent',
};
store.upsertLocal(tempSubtask, { pending: true, status: 'optimistic-create' });
state.flatTasks['task-parent'].children = [state.flatTasks['task-temp-child']];
store.applyMutation({
    type: 'createSubtask',
    phase: 'optimistic',
    opId: 'op-first-subtask',
    taskId: 'task-temp-child',
    tempId: 'task-temp-child',
    parentTaskId: 'task-parent',
    taskIds: ['task-temp-child', 'task-parent'],
    task: tempSubtask,
}, { applyLocal: false });
store.commitTaskId('task-temp-child', 'task-real-child', { keepPending: true });
store.applyMutation({
    type: 'createSubtask',
    phase: 'commit',
    opId: 'op-first-subtask',
    taskId: 'task-real-child',
    tempId: 'task-temp-child',
    realId: 'task-real-child',
    parentTaskId: 'task-parent',
    taskIds: ['task-real-child', 'task-parent'],
}, { applyLocal: false });
assert.deepEqual(
    Array.from(store.getConfirmed('task-parent').children, (child) => child.id),
    ['task-real-child'],
    'a structural commit must promote the optimistic parent tree instead of restoring a stale confirmed parent'
);
assert.deepEqual(
    Array.from(state.flatTasks['task-parent'].children, (child) => child.id),
    ['task-real-child'],
    'the first committed subtask must remain mounted without disappearing until snapshot refresh'
);

const recycleTask = { ...baseTask, id: 'task-recycle', content: 'Recycle', title: 'Recycle' };
const recycleChild = {
    ...baseTask,
    id: 'task-recycle-child',
    content: 'Recycle child',
    title: 'Recycle child',
    parentTaskId: 'task-recycle',
    parent_task_id: 'task-recycle',
};
recycleTask.children = [recycleChild];
store.acceptAuthoritative([recycleTask, recycleChild], { docIds: ['doc-a'] });
store.upsertLocal(recycleTask, { status: 'confirmed-recycle' });
store.upsertLocal(recycleChild, { status: 'confirmed-recycle' });
const recycleMutation = {
    type: 'taskLifecycle',
    opId: 'op-recycle',
    taskId: 'task-recycle',
    taskIds: ['task-recycle', 'task-recycle-child'],
    data: {
        action: 'archiveDeleted',
        taskId: 'task-recycle',
        scheduleCleanupTaskIds: ['task-recycle', 'task-recycle-child'],
    },
    snapshot: { taskId: 'task-recycle', task: recycleTask, docId: 'doc-a' },
};
store.applyMutation({ ...recycleMutation, phase: 'optimistic' }, { applyLocal: true });
assert.equal(store.getProjected('task-recycle'), null, 'recycle must hide its root while the kernel move is pending');
assert.equal(store.getProjected('task-recycle-child'), null, 'recycle must hide its descendants while pending');
store.applyMutation({ ...recycleMutation, phase: 'commit' }, { applyLocal: false });
assert.equal(store.getConfirmed('task-recycle'), null, 'recycle commit must remove the task from the confirmed source document');
assert.equal(store.getConfirmed('task-recycle-child'), null, 'recycle commit must remove descendants from the confirmed source document');
assert.equal(state.flatTasks['task-recycle'], undefined, 'a recycled task must not be reinserted into the visible list at settlement');

const restoreRecycleMutation = {
    ...recycleMutation,
    opId: 'op-restore-recycle',
    data: { ...recycleMutation.data, action: 'restoreDeleted' },
    task: recycleTask,
};
store.applyMutation({ ...restoreRecycleMutation, phase: 'optimistic' }, { applyLocal: true });
assert.equal(store.getProjected('task-recycle')?.content, 'Recycle',
    'recycle undo must immediately restore the root from its saved snapshot');
assert.equal(store.getProjected('task-recycle-child')?.content, 'Recycle child',
    'recycle undo must immediately restore descendants from the same snapshot');
store.applyMutation({ ...restoreRecycleMutation, phase: 'commit' }, { applyLocal: false });
assert.equal(store.getConfirmed('task-recycle')?.content, 'Recycle',
    'a successful recycle undo must promote the optimistic root to confirmed state');
assert.equal(store.getConfirmed('task-recycle-child')?.content, 'Recycle child');

const recycleAgainMutation = { ...recycleMutation, opId: 'op-recycle-again' };
store.applyMutation({ ...recycleAgainMutation, phase: 'optimistic' }, { applyLocal: true });
store.applyMutation({ ...recycleAgainMutation, phase: 'commit' }, { applyLocal: false });
const failedRestoreMutation = { ...restoreRecycleMutation, opId: 'op-restore-failed' };
store.applyMutation({ ...failedRestoreMutation, phase: 'optimistic' }, { applyLocal: true });
assert.ok(store.getProjected('task-recycle'));
store.applyMutation({ ...failedRestoreMutation, phase: 'rollback' }, { applyLocal: true });
assert.equal(store.getProjected('task-recycle'), null,
    'a failed recycle undo must remove the optimistic snapshot again');
assert.equal(store.getProjected('task-recycle-child'), null);

// Multiple sibling recycle commits must prune the confirmed parent's stale
// children array even when the authoritative receipt does not include parent.
const batchParent = { ...baseTask, id: 'task-batch-parent', content: 'Batch parent', title: 'Batch parent', children: [] };
const batchChildren = ['a', 'b', 'keep'].map((suffix) => ({
    ...baseTask,
    id: `task-batch-${suffix}`,
    content: suffix,
    title: suffix,
    parentTaskId: batchParent.id,
    parent_task_id: batchParent.id,
}));
batchParent.children = batchChildren.slice();
store.acceptAuthoritative([batchParent, ...batchChildren], { docIds: ['doc-a'] });
batchChildren.slice(0, 2).forEach((child, index) => {
    const mutation = {
        type: 'taskLifecycle',
        phase: 'optimistic',
        opId: `op-batch-recycle-${index}`,
        taskId: child.id,
        taskIds: [child.id, batchParent.id],
        data: {
            action: 'archiveDeleted',
            taskId: child.id,
            scheduleCleanupTaskIds: [child.id],
        },
        snapshot: {
            taskId: child.id,
            parentTaskId: batchParent.id,
            task: child,
            docId: 'doc-a',
        },
    };
    store.applyMutation(mutation, { applyLocal: false });
    store.applyMutation({ ...mutation, phase: 'commit' }, { applyLocal: false });
});
assert.deepEqual(
    Array.from(store.getConfirmed(batchParent.id).children, (child) => child.id),
    ['task-batch-keep'],
    'sibling recycle commits must remove deleted children from the confirmed parent tree'
);
assert.deepEqual(
    Array.from(store.listProjectedDirectChildren(batchParent.id), (child) => child.id),
    ['task-batch-keep'],
    'projected detail children must not resurrect recycled siblings from stale parent structure'
);

const readBeforeReplacement = store.captureRead(['doc-a']);
const recurringVirtualTask = {
    ...baseTask,
    id: 'repeatinst:task-a:2026-08-08',
    content: 'Historical occurrence',
    sourceTaskId: 'task-a',
    recurringSourceTaskId: 'task-a',
    recurringCompletedAt: '2026-08-08T10:00:00.000+08:00',
    isRecurringInstance: true,
};
store.upsertLocal(recurringVirtualTask, { status: 'sync-recurring-instance' });
store.replaceFlat({
    'task-a': { ...store.getConfirmed('task-a') },
    'task-new': { ...store.getConfirmed('task-new') },
    [recurringVirtualTask.id]: recurringVirtualTask,
}, { authoritative: true, mergeOtherBlocks: false });
assert.equal(store.isReadCurrent(readBeforeReplacement), false, 'a newer authoritative replacement must invalidate older reads');

store.acceptAuthoritative([
    { ...store.getConfirmed('task-a') },
    { ...store.getConfirmed('task-new') },
], { docIds: ['doc-a'], replaceDocuments: true });
assert.equal(store.getConfirmed(recurringVirtualTask.id), null,
    'virtual recurring rows must not enter the raw authoritative base');
assert.equal(store.getProjected(recurringVirtualTask.id)?.content, 'Historical occurrence',
    'replacing a document authoritative base must preserve locally rebuilt virtual recurring rows');

const fieldConfirmedGrandchild = {
    ...baseTask,
    id: 'task-field-grandchild',
    content: 'Field grandchild',
    title: 'Field grandchild',
    parentTaskId: 'task-field-child',
    parent_task_id: 'task-field-child',
};
const fieldConfirmedChild = {
    ...baseTask,
    id: 'task-field-child',
    content: 'Field child',
    title: 'Field child',
    parentTaskId: 'task-field-parent',
    parent_task_id: 'task-field-parent',
    children: [fieldConfirmedGrandchild],
};
const fieldConfirmedParent = {
    ...baseTask,
    id: 'task-field-parent',
    content: 'Field parent',
    title: 'Field parent',
    children: [fieldConfirmedChild],
};
store.acceptAuthoritative([fieldConfirmedParent, fieldConfirmedChild, fieldConfirmedGrandchild], { docIds: ['doc-a'] });
store.acceptAuthoritative([{
    id: 'task-field-parent',
    root_id: 'doc-a',
    docId: 'doc-a',
    done: true,
    children: [],
}], { docIds: ['doc-a'] });
assert.equal(store.getConfirmed('task-field-parent')?.done, true,
    'a field confirmation must still update the confirmed scalar state');
assert.deepEqual(
    Array.from(store.getConfirmed('task-field-parent')?.children || [], (child) => child.id),
    ['task-field-child'],
    'a field-only authoritative receipt must not erase an already confirmed child tree',
);

store.applyMutation({
    type: 'setDone',
    phase: 'optimistic',
    opId: 'op-child-done-with-parent-scope',
    taskId: 'task-field-child',
    parentTaskId: 'task-field-parent',
    taskIds: ['task-field-child', 'task-field-parent'],
    affected: { parentTaskIds: ['task-field-parent'] },
    patch: { done: false, taskMarker: ' ', task_marker: ' ', markdown: '- [ ] Field child' },
}, { applyLocal: false });
assert.equal(store.getProjected('task-field-child')?.done, false);
assert.equal(store.getProjected('task-field-parent')?.done, true,
    'a child field overlay must not apply its values to an affected parent');
assert.deepEqual(
    Array.from(store.getProjected('task-field-parent')?.children || [], (child) => child.id),
    ['task-field-child'],
    'a child field overlay must preserve the parent confirmation tree',
);
store.applyMutation({
    type: 'setDone',
    phase: 'commit',
    opId: 'op-child-done-with-parent-scope',
    taskId: 'task-field-child',
    parentTaskId: 'task-field-parent',
    taskIds: ['task-field-child', 'task-field-parent'],
    affected: { parentTaskIds: ['task-field-parent'] },
    patch: { done: false, taskMarker: ' ', task_marker: ' ', markdown: '- [ ] Field child' },
    task: { ...fieldConfirmedChild, done: false, children: [] },
}, { applyLocal: false });
assert.deepEqual(
    Array.from(store.getConfirmed('task-field-child')?.children || [], (child) => child.id),
    ['task-field-grandchild'],
    'a field receipt with an empty children array must preserve the target task subtree',
);
assert.deepEqual(
    Array.from(store.getConfirmed('task-field-parent')?.children || [], (child) => child.id),
    ['task-field-child'],
    'committing a child field mutation must not rewrite its parent structure',
);
store.acceptAuthoritative([{
    ...store.getConfirmed('task-field-parent'),
    children: [],
}], { docIds: ['doc-a'], replaceStructure: true });
assert.deepEqual(store.getConfirmed('task-field-parent')?.children, [],
    'an explicit structural replacement must still be allowed to clear a child tree');

const locallyMirroredParent = {
    ...baseTask,
    id: 'task-local-structure-parent',
    children: ['a', 'b', 'c'].map((suffix) => ({
        ...baseTask,
        id: `task-local-structure-child-${suffix}`,
        parentTaskId: 'task-local-structure-parent',
        parent_task_id: 'task-local-structure-parent',
    })),
};
store.upsertLocal(locallyMirroredParent, { status: 'local-structure-seed' });
store.upsertLocal({
    ...locallyMirroredParent,
    done: true,
    children: locallyMirroredParent.children.slice().reverse(),
}, { status: 'completion-field-receipt' });
assert.deepEqual(state.flatTasks[locallyMirroredParent.id]?.children?.map((child) => child.id),
    [
        'task-local-structure-child-a',
        'task-local-structure-child-b',
        'task-local-structure-child-c',
    ],
    'ordinary local field receipts must not replace structural order with a non-empty projected order');
store.acceptAuthoritative([locallyMirroredParent, ...locallyMirroredParent.children], { docIds: ['doc-a'] });
store.applyMutation({
    type: 'setDone',
    phase: 'optimistic',
    opId: 'op-local-structure-parent-done',
    taskId: locallyMirroredParent.id,
    patch: { done: true },
}, { applyLocal: false });
store.applyMutation({
    type: 'setDone',
    phase: 'commit',
    opId: 'op-local-structure-parent-done',
    taskId: locallyMirroredParent.id,
    patch: { done: true },
    task: {
        ...locallyMirroredParent,
        done: true,
        children: locallyMirroredParent.children.slice().reverse(),
    },
}, { applyLocal: false });
assert.deepEqual(
    Array.from(store.getConfirmed(locallyMirroredParent.id)?.children || [], (child) => child.id),
    [
        'task-local-structure-child-a',
        'task-local-structure-child-b',
        'task-local-structure-child-c',
    ],
    'a completion receipt must update fields without promoting its reordered child projection',
);
store.upsertLocal({ ...locallyMirroredParent, children: [] }, {
    status: 'authoritative-document-replacement',
    replaceStructure: true,
});
assert.deepEqual(state.flatTasks[locallyMirroredParent.id]?.children, [],
    'authoritative document replacement must clear children deleted in the document');

const protectedCreatedTask = {
    ...baseTask,
    id: '20260810102523-protected',
    root_id: '20260810102523-doc',
    docId: '20260810102523-doc',
    parentTaskId: '20260810102523-parent',
    parent_task_id: '20260810102523-parent',
};
store.upsertLocal({
    ...baseTask,
    id: protectedCreatedTask.parentTaskId,
    root_id: protectedCreatedTask.docId,
    docId: protectedCreatedTask.docId,
    children: [protectedCreatedTask],
}, { status: 'local-parent' });
store.upsertLocal(protectedCreatedTask, { status: 'local-create', pending: true });
store.rememberPendingStructural({
    type: 'createSubtask',
    phase: 'commit',
    taskId: protectedCreatedTask.id,
    parentTaskId: protectedCreatedTask.parentTaskId,
    docId: protectedCreatedTask.docId,
    task: protectedCreatedTask,
});
assert.deepEqual(
    Array.from(store.mergePendingStructuralRows([], { docIds: [protectedCreatedTask.docId] }), (task) => task.id),
    [protectedCreatedTask.id],
    'a recent create must remain protected while the SQL task index catches up',
);
store.clearPendingStructural(protectedCreatedTask.id);
store.removePending(protectedCreatedTask.id);
store.removeFlatByDoc(protectedCreatedTask.docId);
store.upsertLocal({
    ...baseTask,
    id: protectedCreatedTask.parentTaskId,
    root_id: protectedCreatedTask.docId,
    docId: protectedCreatedTask.docId,
    children: [],
}, { status: 'authoritative-document-replacement', replaceStructure: true });
assert.deepEqual(
    store.mergePendingStructuralRows([], { docIds: [protectedCreatedTask.docId] }),
    [],
    'an explicit host-document delete must prevent a recent create from being resurrected',
);
assert.deepEqual(
    Array.from(store.listProjectedDirectChildren(protectedCreatedTask.parentTaskId)),
    [],
    'detail projection must not retain a deleted task through the pending-insert mirror',
);

console.log('task store overlay consistency contract tests passed');
