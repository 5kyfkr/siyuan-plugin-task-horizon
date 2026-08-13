'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'task-horizon', 'main', '20-api-and-runtime-services.js'),
    'utf8',
);
const mutationRuntimeSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'task-horizon', 'main', '32-runtime-state-and-events.js'),
    'utf8',
);

const segment = (startMarker, endMarker) => {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start + startMarker.length);
    assert.ok(start >= 0 && end > start, `missing source segment: ${startMarker}`);
    return source.slice(start, end);
};

const applyLocal = segment(
    'function __tmApplyAttrPatchLocally(',
    'function __tmRollbackAttrPatchLocally(',
);
const rollbackLocal = segment(
    'function __tmRollbackAttrPatchLocally(',
    'function __tmCanMutationRunDuringPendingDelete(',
);
const applyToTask = segment(
    'function __tmApplyQueuedTaskFieldPatchToTask(',
    'function __tmApplyTaskFieldPatchToLocalMirrors(',
);
const applyToMirrors = segment(
    'function __tmApplyTaskFieldPatchToLocalMirrors(',
    'function __tmClearInlineLoadingTimer(',
);
const syncPriorityScore = segment(
    'function __tmSyncTaskPriorityScoreLocal(',
    'function __tmScheduleTaskSnapshotAfterLocalPatch(',
);

assert.match(applyLocal, /__tmApplyTaskFieldPatchToLocalMirrors\(tid, nextPatch\)/,
    'forward local field application must use the shared mirror applicator');
assert.match(rollbackLocal, /__tmApplyTaskFieldPatchToLocalMirrors\(tid, prevPatch\)/,
    'rollback must use exactly the same mirror applicator as the forward patch');
assert.doesNotMatch(`${applyLocal}\n${rollbackLocal}`, /switch \(key\)|applyCustomValues|applyOne/,
    'forward and rollback paths must not keep private field-alias switch statements');
assert.match(applyToMirrors, /__tmApplyQueuedTaskFieldPatchToTask\(task, nextPatch\)/,
    'every mounted task mirror must share one field normalizer');
assert.match(applyToTask, /target\.__customFieldRawValues = nextRawValues/,
    'custom field display and serialized values must advance together');
assert.match(applyToTask, /key === 'tomatoMinutes'[\s\S]*target\.tomato_minutes/,
    'focus-minute aliases must use the shared field applicator');
assert.match(applyToTask, /key === 'tomatoHours'[\s\S]*target\.tomato_hours/,
    'focus-hour aliases must use the shared field applicator');

const patchTaskLocalStart = mutationRuntimeSource.indexOf('const patchTaskLocal =');
const patchTaskLocalEnd = mutationRuntimeSource.indexOf('\n\n    const upsertTaskLocal =', patchTaskLocalStart);
assert.ok(patchTaskLocalStart >= 0 && patchTaskLocalEnd > patchTaskLocalStart,
    'MutationService local task patching must remain extractable');
const patchTaskLocal = mutationRuntimeSource.slice(patchTaskLocalStart, patchTaskLocalEnd);
assert.match(
    patchTaskLocal,
    /__tmDoesPatchAffectPriorityScore\(nextPatch\)[\s\S]*__tmSyncTaskPriorityScoreLocal\(tid, \{[\s\S]*includeAncestors:[\s\S]*refreshAncestorViews: false/,
    'optimistic task mutations must recompute derived priority scores before projection sorting runs',
);
assert.ok(
    patchTaskLocal.indexOf('__tmSyncTaskPriorityScoreLocal(tid') < patchTaskLocal.indexOf('return touched;'),
    'derived priority score synchronization must finish before the mutation change-set is published',
);
assert.match(
    syncPriorityScore,
    /mutateLocal\?\.\(targetId, \(task\) => \{[\s\S]*const nextScore = Number\(__tmEnsureTaskPriorityScore\(task, \{ timeInfoMemo: memo, force: true \}\)\)/,
    'priority score synchronization must recompute each updated task-store mirror in place',
);
assert.match(
    syncPriorityScore,
    /ancestorIds\.filter\(\(ancestorId\) => changedScoreIds\.has\(ancestorId\)\)\.forEach/,
    'ancestor views must refresh only when their derived score actually changes',
);
assert.doesNotMatch(
    syncPriorityScore,
    /__tmTaskBoundary\?\.getTask/,
    'priority score synchronization must not copy a score from one potentially stale boundary mirror',
);

const scoreMirrors = [
    { id: 'task-a', priority: 'high', priorityScore: 70 },
    { id: 'task-a', priority: 'low', priorityScore: 70 },
];
const scoreContext = vm.createContext({
    Map,
    Set,
    globalThis: null,
    __tmCollectAncestorTaskIds: () => [],
    __tmEnsureTaskPriorityScore: (task) => (task.priority === 'high' ? 120 : 40),
});
scoreContext.globalThis = scoreContext;
scoreContext.__tmTaskStore = {
    mutateLocal: (_taskId, updater) => {
        scoreMirrors.forEach((task) => updater(task));
        return true;
    },
};
vm.runInContext(syncPriorityScore, scoreContext);
assert.equal(vm.runInContext("__tmSyncTaskPriorityScoreLocal('task-a')", scoreContext), true);
assert.deepEqual(
    scoreMirrors.map((task) => task.priorityScore),
    [120, 40],
    'each task-store mirror must derive its score from its own already-patched fields',
);

const ancestorTasks = new Map([
    ['task-a', [{ id: 'task-a', priorityScore: 70, nextScore: 80 }]],
    ['parent-a', [{ id: 'parent-a', priorityScore: 200, nextScore: 200 }]],
]);
const ancestorRefreshes = [];
const ancestorContext = vm.createContext({
    Map,
    Set,
    globalThis: null,
    __tmCollectAncestorTaskIds: () => ['parent-a'],
    __tmEnsureTaskPriorityScore: (task) => task.nextScore,
    __tmRefreshTaskFieldsAcrossViews: (taskId) => ancestorRefreshes.push(taskId),
});
ancestorContext.globalThis = ancestorContext;
ancestorContext.__tmTaskStore = {
    mutateLocal: (taskId, updater) => {
        (ancestorTasks.get(taskId) || []).forEach((task) => updater(task));
        return true;
    },
};
vm.runInContext(syncPriorityScore, ancestorContext);
vm.runInContext("__tmSyncTaskPriorityScoreLocal('task-a', { includeAncestors: true, refreshAncestorViews: true })", ancestorContext);
assert.deepEqual(ancestorRefreshes, [], 'an unchanged ancestor score must not schedule a second view refresh');
ancestorTasks.get('parent-a')[0].nextScore = 210;
vm.runInContext("__tmSyncTaskPriorityScoreLocal('task-a', { includeAncestors: true, refreshAncestorViews: true })", ancestorContext);
assert.deepEqual(ancestorRefreshes, ['parent-a'], 'a changed ancestor score must still refresh its visible projection');

console.log('task field local application contract: ok');
