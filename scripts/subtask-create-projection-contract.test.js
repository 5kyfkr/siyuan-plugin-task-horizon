const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const runtime = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const taskCreate = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53b-task-create-and-quick-add-runtime.js'), 'utf8');
const taskList = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js'), 'utf8');
const taskDetail = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/52-task-detail-runtime.js'), 'utf8');
const viewRefresh = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js'), 'utf8');
const taskStore = fs.readFileSync(path.join(root, 'src/task-horizon/main/32-runtime-state-and-events.js'), 'utf8');
const kernel = fs.readFileSync(path.join(root, 'kernel.js'), 'utf8');

const segment = (source, start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(from, -1, `missing segment start: ${start}`);
    assert.notEqual(to, -1, `missing segment end: ${end}`);
    return source.slice(from, to);
};

assert.doesNotMatch(
    taskCreate,
    /skipSettledRefresh|refreshPolicy|skipSettledViewRefresh|skipOptimisticMainRefresh/,
    'task creation must not carry legacy per-entry refresh policy'
);
assert.doesNotMatch(
    taskCreate,
    /__tmRefreshAfterOptimisticTaskCreate|__tmScheduleChecklistOptimisticSubtaskRefresh/,
    'task creation must leave visible projection to ProjectionEngine'
);
assert.doesNotMatch(
    taskCreate,
    /__tmGenerateTempTaskId\('(subtask|task|sibling)'\)/,
    'optimistic creates must use their pre-generated kernel block ID instead of remapping a second temporary identity'
);
assert.ok((taskCreate.match(/const tempId = requestedTaskId;/g) || []).length >= 3,
    'root, subtask, and sibling creation must keep one stable identity from optimistic projection through kernel commit');
assert.match(
    taskCreate,
    /function __tmIsOptimisticTempTaskId[\s\S]*pendingInsertedTasks\?\.\[tid\][\s\S]*identity\.status[\s\S]*'committed'/,
    'pending guards must still protect pre-generated task IDs until the create mutation commits'
);
const detachRuntime = taskList.slice(
    taskList.indexOf('window.tmDetachSubtaskFromParent = async function'),
    taskList.indexOf('function __tmRollbackContentPatchLocally'),
);
assert.match(
    detachRuntime,
    /resolveOutdent: true,[\s\S]*outdentResolved: true/,
    'detaching a subtask must reuse the authoritative target resolved before enqueue'
);
assert.doesNotMatch(
    taskList,
    /function __tmRefreshDetachSubtaskViews|detach-subtask-(?:queued|success)/,
    'detaching a subtask must not run duplicate queued and settled full-view refreshes'
);
assert.doesNotMatch(
    taskDetail,
    /detail-create-subtask-current-optimistic|insertQueuedSubtaskRow|refreshBoardAfterQueuedSubtask/,
    'detail subtask creation must not maintain a second optimistic DOM projection'
);
assert.match(
    taskDetail,
    /function __tmProjectVisibleTaskDetailSubtasks[\s\S]*__tmTaskDetailProjectSubtasks/,
    'visible task details must expose one canonical structural projection adapter'
);
assert.match(
    viewRefresh,
    /globalThis\.__tmProjectVisibleTaskDetailSubtasks\?\.\(affectedDetailIds\)[\s\S]*return __tmScheduleTaskProjectionBatch/,
    'ProjectionEngine must project detail subtasks before scheduling deferred whole-view work'
);
assert.match(
    viewRefresh,
    /detailSubtaskProjectionEligible === true[\s\S]*detailSubtasksProjected = globalThis\.__tmProjectVisibleTaskDetailSubtasks\?\.\(taskIds\) === true[\s\S]*skipDetailRefresh[\s\S]*if \(!skipDetailRefresh\)[\s\S]*forceRebuild: !detailSubtasksProjected/,
    'a successful subtask projection must skip its redundant whole-detail refresh'
);
assert.match(
    viewRefresh,
    /batch\.structural === true[\s\S]*state\.viewMode[\s\S]*'checklist'[\s\S]*__tmMarkChecklistProjectionGroupRefresh\(taskIds\)[\s\S]*__tmScheduleViewRefresh/,
    'structural checklist fallbacks must reconcile the affected group without replacing the whole detail host'
);
const structuralProjectionBatch = segment(
    viewRefresh,
    'function __tmRunTaskProjectionBatch',
    'const __tmPendingProjectionEntries = []',
);
assert.match(
    structuralProjectionBatch,
    /__tmMarkChecklistProjectionGroupRefresh\(taskIds\)[\s\S]*__tmScheduleViewRefresh\(\{[\s\S]*bypassInteractionDefer:\s*batch\.structural === true/,
    'structural checklist fallbacks must not be starved by continuous detail input'
);
const optimisticProjectionFrame = segment(
    viewRefresh,
    'function __tmScheduleOptimisticProjectionFrame',
    'function __tmCollectChecklistProjectionDomBlock',
);
assert.match(optimisticProjectionFrame, /bypassInteractionDefer:\s*true/);
assert.doesNotMatch(optimisticProjectionFrame, /batch\./,
    'optimistic projection fallback must not reference an unrelated projection batch');
assert.match(
    taskCreate,
    /previousChild[\s\S]*insertAfterTaskId[\s\S]*requestedContainerId[\s\S]*parent_id[\s\S]*__tmNewTaskBlockId\(\)/,
    'burst subtask creation must reuse the optimistic tail list and capture an explicit predecessor'
);
const attachOptimisticChildStart = taskCreate.indexOf('function __tmAttachOptimisticChildToParentCandidates');
const attachOptimisticChildEnd = taskCreate.indexOf('function __tmInsertTaskIntoDocLocal', attachOptimisticChildStart);
assert.ok(attachOptimisticChildStart >= 0 && attachOptimisticChildEnd > attachOptimisticChildStart);
const attachOptimisticChildSource = taskCreate.slice(attachOptimisticChildStart, attachOptimisticChildEnd);
assert.match(
    attachOptimisticChildSource,
    /state\.taskTree[\s\S]*walkTaskTree\(doc\?\.tasks\)/,
    'optimistic subtasks must update the current authoritative task tree after a document refresh replaces parent references'
);
const treeParent = { id: 'parent', children: [] };
const flatParent = { id: 'parent', children: [] };
const filteredParent = { id: 'parent', children: [] };
const divergentState = {
    taskTree: [{ id: 'doc', tasks: [{ id: 'root', children: [treeParent] }] }],
    flatTasks: { parent: flatParent },
    pendingInsertedTasks: {},
    filteredTasks: [filteredParent],
    listDomRenderSignature: 'stale',
};
const attachOptimisticChild = new Function(
    'state',
    'globalThis',
    '__tmResolveOptimisticTaskId',
    '__tmInvalidateFilteredTaskDerivedStateCache',
    `${attachOptimisticChildSource}; return __tmAttachOptimisticChildToParentCandidates;`,
)(
    divergentState,
    { __tmRuntimeState: { getTaskIdAliases: () => [] } },
    (id) => String(id || '').trim(),
    () => {},
);
const divergentChild = { id: 'child', parentTaskId: 'parent', children: [] };
assert.equal(attachOptimisticChild(flatParent, 'parent', divergentChild), true);
[treeParent, flatParent, filteredParent].forEach((parent) => {
    assert.deepEqual(parent.children.map((child) => child.id), ['child'],
        'every live parent representation must receive the optimistic subtask exactly once');
});
assert.match(
    `${runtime}\n${taskCreate}`,
    /insertAfterTaskId[\s\S]*__tmCreateSubtaskForTaskKernel[\s\S]*requestedContainerId[\s\S]*insertAfterTaskId/,
    'the queued placement must reach the subtask writer unchanged'
);
assert.match(
    kernel,
    /requestedPreviousID[\s\S]*previousID = requestedPreviousID \|\| await resolveLastChildID\(listID\)/,
    'the kernel must prefer the queued predecessor over a lagging child-order read'
);
assert.match(
    viewRefresh,
    /__TM_DETAIL_SUBTASK_STRUCTURAL_TYPES = new Set\([\s\S]*'createSubtask'[\s\S]*'moveTask'[\s\S]*'deleteTask'[\s\S]*structuralTypes\.every/,
    'only hierarchy mutations covered by the detail subtask adapter may skip a full detail rebuild'
);
const detailDraftStart = taskDetail.indexOf('const bindSubtaskDraftRow = (draftRow) => {');
const detailDraftEnd = taskDetail.indexOf('try { root.__tmTaskDetailOpenInlineSubtaskDraft', detailDraftStart);
assert.ok(detailDraftStart >= 0 && detailDraftEnd > detailDraftStart);
const detailDraftRuntime = taskDetail.slice(detailDraftStart, detailDraftEnd);
assert.doesNotMatch(
    detailDraftRuntime,
    /requestAnimationFrame\([\s\S]*input\.focus/,
    'mobile subtask draft focus must remain in the trusted add-button click event'
);
assert.match(
    detailDraftRuntime,
    /input\.focus\(\{ preventScroll: true \}\)/,
    'mobile subtask drafts must focus synchronously without moving the detail scroll position'
);
assert.match(
    taskDetail,
    /window\.visualViewport[\s\S]*visibleBottom = Math\.min\(scrollerRect\.bottom, viewportBottom\)[\s\S]*scroller\.scrollTo\(\{ top: next, behavior: 'auto' \}\)/,
    'mobile subtask drafts must follow the visual viewport above the soft keyboard'
);
assert.doesNotMatch(
    `${taskDetail}\n${viewRefresh}`,
    /__tmLogSubtaskDetailDirect|\[Task Horizon\]\[SubtaskDetail\]\[Direct\]/,
    'normal subtask projection must not scan or serialize the detail DOM for direct diagnostics'
);
const draftVisibilityStart = taskDetail.indexOf('const cancelSubtaskDraftVisibility = () => {');
const draftVisibilityEnd = taskDetail.indexOf('const bindSubtaskDraftRow = (draftRow) => {', draftVisibilityStart);
assert.ok(draftVisibilityStart >= 0 && draftVisibilityEnd > draftVisibilityStart);
const draftVisibility = taskDetail.slice(draftVisibilityStart, draftVisibilityEnd);
assert.equal((draftVisibility.match(/requestAnimationFrame\(/g) || []).length, 1,
    'mobile draft visibility must coalesce geometry reads into one animation-frame path');
assert.doesNotMatch(draftVisibility, /\[80,\s*220,\s*380\]|ensureSubtaskDraftVisibleOnMobile\(`\$\{source\}:now`\)/,
    'mobile draft visibility must not run repeated synchronous and fixed-delay layout passes');
assert.ok((draftVisibility.match(/scheduleSubtaskDraftVisibility\(\{ frame: false \}\)/g) || []).length >= 2,
    'visual viewport animation must only request one trailing visibility correction');
const detailSubmitStart = taskDetail.indexOf('const submitDraft = () => {');
const detailSubmitEnd = taskDetail.indexOf('syncAutoHeight(input, subtaskTextareaMinHeight);', detailSubmitStart);
assert.ok(detailSubmitStart >= 0 && detailSubmitEnd > detailSubmitStart);
const detailSubmit = taskDetail.slice(detailSubmitStart, detailSubmitEnd);
assert.match(
    detailSubmit,
    /taskLines\.forEach\([\s\S]*wait: false[\s\S]*removeDraft\('submitted'\);/,
    'detail subtask drafts must leave the editing state as soon as all optimistic creates enter MutationService'
);
assert.doesNotMatch(
    detailSubmit,
    /Promise\.all\(|onFinally:[\s\S]*draftRow\.dataset\.saving|bumpDetailRefreshHold\(/,
    'detail subtask drafts must not bind their UI lock or structural refresh to a non-waiting create promise'
);
assert.match(
    detailDraftRuntime,
    /const removeDraft[\s\S]*cancelSubtaskDraftVisibility\(\)/,
    'submitting or dismissing a draft must cancel pending mobile viewport measurements'
);
const detailProjectionStart = taskDetail.indexOf('const projectSubtasksInPlace = (affectedTaskIds = []) => {');
const detailProjectionEnd = taskDetail.indexOf('try { root.__tmTaskDetailProjectSubtasks = projectSubtasksInPlace;', detailProjectionStart);
assert.ok(detailProjectionStart >= 0 && detailProjectionEnd > detailProjectionStart);
const detailProjection = taskDetail.slice(detailProjectionStart, detailProjectionEnd);
assert.doesNotMatch(detailProjection, /list\.innerHTML\s*=/,
    'optimistic subtask projection must not destroy and recreate the complete live subtask list');
assert.match(detailProjection, /currentById[\s\S]*desiredNodes[\s\S]*list\.insertBefore\(node, cursor\)[\s\S]*insertedNodes\.forEach/,
    'the canonical detail projection must reuse unchanged keyed subtask branches and bind only inserted branches');
assert.match(
    taskStore,
    /affectedGroupIds: normalizeIds\(\[[\s\S]*m\.parentTaskId,/,
    'a createSubtask ChangeSet must include its parent so an open parent detail can refresh'
);
assert.match(
    viewRefresh,
    /function __tmNormalizeViewRefreshDetail[\s\S]*bypassDefer: raw\.bypassDefer === true,[\s\S]*bypassTaskFieldDefer: raw\.bypassTaskFieldDefer === true,[\s\S]*bypassScrollDefer: raw\.bypassScrollDefer === true,[\s\S]*bypassInteractionDefer: raw\.bypassInteractionDefer === true/,
    'view refresh normalization must preserve defer bypass flags'
);
assert.match(
    viewRefresh,
    /function __tmMergeViewRefreshDetail[\s\S]*bypassDefer: left\.bypassDefer === true \|\| right\.bypassDefer === true,[\s\S]*bypassTaskFieldDefer: left\.bypassTaskFieldDefer === true \|\| right\.bypassTaskFieldDefer === true,[\s\S]*bypassScrollDefer: left\.bypassScrollDefer === true \|\| right\.bypassScrollDefer === true,[\s\S]*bypassInteractionDefer: left\.bypassInteractionDefer === true \|\| right\.bypassInteractionDefer === true/,
    'coalesced view refreshes must retain defer bypass flags'
);
const commitStart = runtime.indexOf('function __tmCommitQueuedOp');
const commitEnd = runtime.indexOf('function __tmRemapQueuedOpTaskReferences', commitStart);
assert.notEqual(commitStart, -1);
assert.notEqual(commitEnd, -1);
assert.doesNotMatch(
    runtime.slice(commitStart, commitEnd),
    /__tmRefreshQueuedStructuralProjection|__tmScheduleSimpleStructuralRefresh/,
    'successful create commits must not start a delayed authoritative reload'
);
assert.doesNotMatch(
    runtime,
    /__tmScheduleQueuedCreateOpRealIdResolve|__tmRecoverQueuedCreateOpRealId/,
    'stable pre-generated IDs must replace deferred create-ID probing'
);
const simpleOptimisticStart = runtime.indexOf('function __tmApplySimpleOptimisticPresentation');
const simpleOptimisticEnd = runtime.indexOf('function __tmDoesMutationStillOwnLocalWatermark', simpleOptimisticStart);
assert.notEqual(simpleOptimisticStart, -1);
assert.notEqual(simpleOptimisticEnd, -1);
const simpleOptimistic = runtime.slice(simpleOptimisticStart, simpleOptimisticEnd);
assert.doesNotMatch(
    simpleOptimistic,
    /__tmScheduleViewRefresh|__tmScheduleRender|requestAnimationFrame|applyFilters/,
    'simple structural presentation must only update local state and publish a ChangeSet'
);
assert.match(
    viewRefresh,
    /setRuntimeHandler\(__tmApplyTaskProjectionChangeSets\)/,
    'all structural creation views must share the ProjectionEngine runtime handler'
);
assert.match(
    viewRefresh,
    /deletedDetailIds[\s\S]*__tmDismissVisibleTaskDetailsForDeletedIds/,
    'ProjectionEngine must dismiss an open detail when its task is optimistically deleted'
);
assert.match(
    taskDetail,
    /function __tmDismissVisibleTaskDetailsForDeletedIds[\s\S]*__tmTaskDetailSkipCloseFlush = true[\s\S]*__tmTaskDetailClose\(\)/,
    'deleted task details must close immediately without trying to save the removed block'
);
assert.match(
    viewRefresh,
    /skipFlush = opts\.skipFlush === true \|\| root\.__tmTaskDetailSkipCloseFlush === true/,
    'the shared detail close lifecycle must honor deletion-driven close without a stale save attempt'
);

console.log('subtask create projection contract tests passed');
