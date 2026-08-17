const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const dialog = fs.readFileSync(path.join(root, 'src/task-horizon/main/30-dialogs-and-ui-foundation.js'), 'utf8');
const kernel = fs.readFileSync(path.join(root, 'kernel.js'), 'utf8');
const runtimeState = fs.readFileSync(path.join(root, 'src/task-horizon/main/32-runtime-state-and-events.js'), 'utf8');
const calendarSupport = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/48-render-calendar-support-runtime.js'), 'utf8');
const listFields = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53a-list-field-edit-runtime.js'), 'utf8');
const listRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js'), 'utf8');

assert.match(api, /function __tmRequireKernelGatewayForTaskMutation\(gateway, operation = ''\)[\s\S]*throw new Error\(`\$\{label\}失败：任务内核暂不可用`\)/);
assert.doesNotMatch(api, /return await API\.(?:setAttrs|batchSetAttrs|updateBlock|insertBlock|appendBlock|moveBlock|deleteBlock)\(/,
    'task backend writes must not silently fall back around the Kernel service');
assert.match(api, /mutation:[\s\S]*String\(op\.type \|\| ''\)/);
assert.doesNotMatch(api, /__tmCreateMutationWaitError|__tmWithMutationLock|navigator\.locks/);
assert.match(api, /function __tmExecuteQueuedMoveKernel[\s\S]*laneID: taskId,[\s\S]*__tmExecuteTaskCommandGateway\(\{[\s\S]*action: 'move'/,
    'interactive moves must enter the kernel through one task-scoped RPC');
assert.doesNotMatch(api, /const __TM_INTERACTIVE_MUTATION_LANE_KEY/);
assert.match(api, /function __tmResolveQueuedMutationLaneKeys\(definition = \{\}\)[\s\S]*data\.targetDocId[\s\S]*data\.targetTaskId/);
assert.match(api, /const laneKeys = __tmResolveQueuedMutationLaneKeys\(def\)[\s\S]*laneKey: laneKeys\[0\] \|\| 'default'[\s\S]*laneKeys,/);
assert.match(api, /Promise\.all\(previous\.map\([\s\S]*laneKeys\.forEach\(\(laneKey\) => __tmSimpleMutationLanes\.set\(laneKey, tail\)\)/,
    'a mutation must reserve every affected task/document lane with one shared tail');
assert.doesNotMatch(api, /function __tmGetActiveTaskMutationLaneId\(fallback = ''\)[\s\S]{0,300}__tmOpQueue\?\.currentOp/,
    'concurrent mutations must not derive kernel lanes from shared currentOp state');
assert.match(api, /async function __tmExecuteTaskCommandGateway\(input[\s\S]*__tmCallTaskHorizonKernelRpc\('taskHorizonMutateTask', command\)/);
assert.doesNotMatch(api, /__tmCallTaskHorizonKernelRpc\('taskHorizon(?:UpdateTask|MoveTask|PersistUiTaskAttrs|PersistUiBlockOperation)'/,
    'all frontend task writes must use only taskHorizonMutateTask');
assert.match(api, /const updateByBlock = async[\s\S]*action: 'reconcileAttrs',[\s\S]*__tmBackendAdapter\.updateBlock\(tid, nextMarkdown\)/,
    'the legacy marker writer must repair an invalid task container before updating block markdown');
const statelessDoneStart = listRuntime.indexOf('async function __tmSetDoneByIdStateless');
const statelessDoneEnd = listRuntime.indexOf('// 更新 markdown 中的完成状态', statelessDoneStart);
const statelessDoneSource = listRuntime.slice(statelessDoneStart, statelessDoneEnd);
assert.match(statelessDoneSource, /__tmUpdateTaskListItemMarkerWithFallback\(tid, targetDone \? 'X' : ' '\)/,
    'stateless completion must enter the guarded marker writer');
assert.doesNotMatch(statelessDoneSource, /__tmBackendAdapter\.updateBlock/,
    'stateless completion must not bypass SiYuan 3.8 structure repair');
assert.match(kernel, /const laneID = text\(source\.laneID \|\| source\.laneId\) \|\| taskID;[\s\S]*const targetLaneIDs = uniqueStrings[\s\S]*return runTaskLanes\(targetLaneIDs,/);
assert.match(kernel, /async function applyTaskPatch\(taskID, rawPatch, options\)[\s\S]*const laneID = text\(options\?\.laneID \|\| options\?\.laneId\) \|\| id;[\s\S]*return runTaskLane\(laneID,/);
assert.match(kernel, /async function persistUiTaskAttrs\(taskID, rawAttrs, options\)[\s\S]*const laneID = text\(options\?\.laneID \|\| options\?\.laneId\) \|\| id;[\s\S]*return runTaskLane\(laneID,/);
assert.match(kernel, /async function buildTaskAttrPreservationOperation\(row, registryInput\)[\s\S]*return \{ action: 'setAttrs', id: context\.taskID/,
    'legacy list-hosted fields must be represented as a task-block transaction operation before moving');
assert.match(kernel, /async function preserveTaskAttrsOnOwnBlockBeforeMove\(row\)[\s\S]*buildTaskAttrPreservationOperation\(row\)[\s\S]*pushTaskTransaction\(\[operation\]\)/,
    'single moves must keep using the shared attribute preservation operation');
assert.match(kernel, /async function moveTask\(input, options\)[\s\S]*return runTaskLanes\(targetLaneIDs,[\s\S]*await preserveTaskAttrsOnOwnBlockBeforeMove\(beforeTask\)/,
    'attribute preservation and the structural move must share the kernel task and target lanes');
assert.doesNotMatch(api + dialog, /function __tmMoveTask(?:BeforeTask|AfterTask|AsChild|AsChildTop)\(/,
    'retired frontend move writers must not return');
const patchTaskStart = api.indexOf('function __tmMutationPatchTask');
const patchTaskEnd = api.indexOf('function __tmMutationPatchContent', patchTaskStart);
const patchTaskSource = api.slice(patchTaskStart, patchTaskEnd);
assert.match(patchTaskSource, /return __tmQueueTaskFieldPatch\(tid, nextPatch/,
    'all ordinary task fields must enter the single taskPatch queue');
assert.doesNotMatch(patchTaskSource, /__tmCommitUiFriendlyTaskPatch|__tmMutationPatchAttrs|__tmPersistMetaAndAttrsKernel/,
    'the public field command must not select a second writer');
assert.doesNotMatch(api, /function __tmQueueAttrPatch|function __tmPersistMetaAndAttrsAsync/,
    'the retired attrPatch queue must not return');
assert.doesNotMatch(api + runtimeState + calendarSupport, /type === 'attrPatch'|type: 'attrPatch'|record\.type === 'attrPatch'/,
    'the retired attrPatch operation and undo record must not survive as dead branches');
assert.doesNotMatch(listFields, /__tmShouldUseChecklistLegacyFieldCommit|__tmRequestChecklistLegacyTaskPatch/,
    'list, checklist, and kanban field editors must not select a legacy writer');
assert.match(calendarSupport, /__tmPushUndoRecord\(\{[\s\S]*type: 'taskPatch',[\s\S]*patch: attrPatch/,
    'background date changes must use the unified taskPatch undo record');
assert.match(api, /setDone: __tmMutationSetDone/,
    'completion must be exposed by the same MutationService as ordinary fields and content');
const metaPatchStart = api.indexOf('async function __tmApplyTaskMetaPatchWithUndo');
const metaPatchEnd = api.indexOf('async function __tmApplyTaskAttrUpdateWithUndo', metaPatchStart);
const metaPatchSource = api.slice(metaPatchStart, metaPatchEnd);
assert.match(metaPatchSource, /const inlineMutationWrite = opts\.inlineQueuedPersist === true;[\s\S]*if \(inlineMutationWrite\)[\s\S]*__tmPersistMetaAndAttrsKernel[\s\S]*else[\s\S]*__tmRequireTaskMutation\?\.\('patchTask'\)/,
    'only an already-running mutation effect may use the inline Kernel executor');

const laneResolverStart = api.indexOf('function __tmResolveQueuedMutationLaneKeys');
const laneResolverEnd = api.indexOf('function __tmEnqueueQueuedOp', laneResolverStart + 10);
const laneResolverSource = api.slice(laneResolverStart, laneResolverEnd);
const resolveLaneKeys = new Function('state', `${laneResolverSource}; return __tmResolveQueuedMutationLaneKeys;`)({ flatTasks: {} });
const fieldKeys = resolveLaneKeys({
    type: 'taskPatch',
    docId: 'doc-a',
    laneKey: 'task:task-a',
    data: { taskId: 'task-a' },
});
assert.deepEqual(fieldKeys, ['doc:doc-a', 'task:task-a']);
const moveKeys = resolveLaneKeys({
    type: 'moveTask',
    docId: 'doc-a',
    data: { taskId: 'task-a', targetTaskId: 'task-b', targetDocId: 'doc-b' },
});
assert.deepEqual(moveKeys, ['doc:doc-a', 'doc:doc-b', 'task:task-a', 'task:task-b']);
const batchMoveKeys = resolveLaneKeys({
    type: 'batchMoveTasks',
    docId: 'doc-a',
    data: {
        taskIds: ['task-a', 'task-b'],
        targetTaskId: 'task-parent',
        targetDocId: 'doc-c',
        sourceDocIds: ['doc-a', 'doc-b'],
    },
});
assert.deepEqual(batchMoveKeys, [
    'doc:doc-a',
    'doc:doc-b',
    'doc:doc-c',
    'task:task-a',
    'task:task-b',
    'task:task-parent',
]);

console.log('task mutation single writer contract tests passed');
