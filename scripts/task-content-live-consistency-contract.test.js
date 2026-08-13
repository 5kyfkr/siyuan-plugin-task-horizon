'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const readRuntime = (name) => fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', 'task-runtime', name), 'utf8');
const readMain = (name) => fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', name), 'utf8');
const viewSource = readRuntime('51-whiteboard-and-link-runtime.js');
const detailSource = readRuntime('52-task-detail-runtime.js');
const taskSource = readRuntime('53-list-render-and-document-loader.js');
const dialogsSource = readMain('30-dialogs-and-ui-foundation.js');
const renderSource = readMain('40-render-runtime.js');
const aiPanelSource = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', 'render', '47-render-side-panels-and-view-switching.js'), 'utf8');

const sliceBetween = (source, startToken, endToken, label) => {
    const start = source.indexOf(startToken);
    const end = source.indexOf(endToken, start + startToken.length);
    assert.ok(start >= 0 && end > start, `${label} must remain extractable`);
    return source.slice(start, end);
};

const normalizeContentSource = sliceBetween(
    renderSource,
    'function __tmNormalizeTaskContentFieldValue',
    'function __tmNormalizeTaskContentField(task)',
    'shared task content normalization',
);
const normalizeContentContext = {
    API: {
        parseTaskStatus: () => ({ content: '完整番茄的数量和时长才计入' }),
        extractTaskContentLine: () => '完整番茄的数量和时长才计入',
    },
};
vm.runInNewContext(`${normalizeContentSource}\nthis.normalizeTaskContent = __tmNormalizeTaskContentFieldValue;`, normalizeContentContext);
assert.equal(
    normalizeContentContext.normalizeTaskContent('- {: id="20260807084129-ks4mjzs" updated="20260807084129"}[ ] 完整番茄的数量和时长才计入\n{: id="20260807084129-ks4mjzs" updated="20260807084129"}'),
    '完整番茄的数量和时长才计入',
    'SiYuan block IAL between the list marker and checkbox must never become visible task content',
);

const applyContent = sliceBetween(
    taskSource,
    'function __tmApplyContentPatchLocally',
    'function __tmQueueMoveTask',
    'content optimistic patch',
);
assert.match(applyContent, /__tmTaskStore\?\.patchLocal\?\.\(tid, patch/, 'content optimistic updates must pass through TaskStore');
assert.match(applyContent, /raw_content:\s*text[\s\S]*rawContent:\s*text/, 'content optimistic updates must keep every local title alias in one TaskStore patch');
assert.doesNotMatch(applyContent, /task\.content\s*=|task\.markdown\s*=/, 'content optimistic updates must not mutate one task mirror directly');
assert.doesNotMatch(applyContent, /patchPending/, 'TaskStore patchLocal must own pending-task synchronization');

const rollbackContent = sliceBetween(
    taskSource,
    'function __tmRollbackContentPatchLocally',
    'async function __tmUpdateTaskContentBlockKernel',
    'content rollback',
);
assert.match(rollbackContent, /__tmTaskStore\?\.patchLocal\?\.\(tid, rollbackPatch/, 'content rollback must restore every TaskStore mirror');
assert.match(rollbackContent, /__tmRefreshContentPatchPresentation\(tid, presentationPatch/, 'content rollback must refresh the same targeted presentation path without exposing storage aliases');

const contentPresentation = sliceBetween(
    taskSource,
    'function __tmRefreshContentPatchPresentation',
    'function __tmApplyContentPatchLocally',
    'content presentation refresh',
);
assert.match(contentPresentation, /__tmTaskMutationBus\?\.publish\?\.\(\{[\s\S]*type: 'contentPatch'[\s\S]*phase: 'local'/,
    'content changes must enter the shared ChangeSet projection path');
assert.doesNotMatch(contentPresentation, /applyFilters|__tmScheduleViewRefresh|__tmScheduleRender|render\s*\(/,
    'content presentation must not run a competing filter or render path');

const detailFormSnapshot = sliceBetween(
    detailSource,
    'const collectFormState = () =>',
    'const captureFormStateSnapshot =',
    'detail form snapshot',
);
assert.match(detailFormSnapshot, /const hasContentEditor = contentEditor instanceof HTMLTextAreaElement/, 'detail snapshots must distinguish an absent title editor from an empty title');
assert.match(detailFormSnapshot, /hasContentEditor,\s*nextContent,/, 'the title-editor presence marker must travel with the immutable save snapshot');

const visibleContentPatch = sliceBetween(
    viewSource,
    'function __tmPatchVisibleTaskContentInDOM',
    'function __tmUpdateTaskCardRemarkNodeInDOM',
    'visible content DOM patch',
);
assert.match(visibleContentPatch, /__TM_TASK_DOM_HOST_SELECTOR/, 'visible content patch must use the shared task host boundary');
assert.match(visibleContentPatch, /__tmGetTaskDomHostId/, 'visible content patch must verify task ownership');
assert.match(visibleContentPatch, /data-tm-detail-subtask-content/, 'visible content patch must include detail subtask editors');
assert.doesNotMatch(visibleContentPatch, /offsetHeight|offsetWidth|scrollHeight|getBoundingClientRect/, 'visible content patch must not force layout reads');

const refreshAcrossViews = sliceBetween(
    viewSource,
    'function __tmRefreshTaskFieldsAcrossViews',
    'function __tmGetTaskSuppressionIds',
    'cross-view field refresh',
);
assert.match(refreshAcrossViews, /hasContentPatch[\s\S]*__tmPatchVisibleTaskContentInDOM\(tid\)/, 'content patches must update all simultaneously visible task hosts');
assert.match(refreshAcrossViews, /controllerPatch[\s\S]*key !== 'content' && key !== 'markdown'/, 'current-view controllers must not repeat the shared content DOM patch');

const closeDetail = sliceBetween(
    detailSource,
    'const close = async () =>',
    'let autoSaveTimer = null',
    'detail close',
);
assert.match(closeDetail, /root\.querySelector\('\[data-tm-detail="content"\]'\)/, 'normal detail drawers must detect an editable form before closing');
assert.match(closeDetail, /await __tmFlushTaskDetailBeforeClose\(root/, 'detail close must use the shared commit-aware flush');
assert.ok(closeDetail.indexOf('await __tmFlushTaskDetailBeforeClose') < closeDetail.indexOf("destroyTaskDetailNoteView('close')"), 'detail save must happen before drawer teardown');
assert.ok(closeDetail.indexOf('await __tmFlushTaskDetailBeforeClose') < closeDetail.indexOf('await onClose()'), 'detail save must happen before the host removes the drawer');
assert.match(closeDetail, /__tmTaskDetailFlushHandoffSessionId = sessionId/, 'internal close must hand its completed flush to the outer host close');
assert.match(closeDetail, /if \(result === false\) return false/, 'a failed outer close must leave the detail session open');

const closeLifecycle = sliceBetween(
    viewSource,
    'async function __tmFlushTaskDetailBeforeClose',
    'function __tmCollectBusyTaskDetailRoots',
    'shared detail close lifecycle',
);
assert.match(closeLifecycle, /waitForCommit:\s*true/, 'closing a detail must wait for the current mutation to settle');
assert.match(closeLifecycle, /__tmTaskDetailCloseFlush/, 'concurrent close flushes must share one promise');
assert.match(closeLifecycle, /__tmTaskDetailCloseRun/, 'concurrent close requests must share one close run');
assert.ok(closeLifecycle.indexOf('await __tmFlushTaskDetailBeforeClose') < closeLifecycle.indexOf('__tmMarkTaskDetailRootClosing'), 'the detail root must remain usable until its save settles');
assert.doesNotMatch(viewSource, /__tmTaskDetailCloseDirect|\[Task Horizon\]\[DetailClose\]\[Direct\]|projection-next-frame|projection-400ms|projection-1800ms/,
    'retired detail-close diagnostics and their delayed projection checks must stay deleted');
assert.doesNotMatch(detailSource, /logDetailCloseDirect|closeTraceId|__tmTaskDetailLastContentMutation|\[Task Horizon\]\[Detail\]\[ContentSave\]/,
    'detail saves must not retain trace-only state or direct console logging');

const checklistSheetClose = sliceBetween(
    dialogsSource,
    'window.tmChecklistCloseSheet = async function',
    'window.tmTaskDetailSheetClose = async function',
    'checklist sheet close',
);
assert.match(checklistSheetClose, /return await __tmRunTaskDetailClose/, 'checklist sheet close must use the shared lifecycle');
assert.ok(checklistSheetClose.indexOf('__tmRunTaskDetailClose') < checklistSheetClose.indexOf('state.checklistDetailSheetOpen = false'), 'checklist sheet must save before hiding');
assert.doesNotMatch(checklistSheetClose, /Promise\.resolve\(flushPromise\)/, 'checklist sheet must not fire-and-forget its close save');

const taskSheetClose = sliceBetween(
    dialogsSource,
    'window.tmTaskDetailSheetClose = async function',
    'let __tmChecklistSheetLastTouchStartAt',
    'task sheet close',
);
assert.match(taskSheetClose, /return await __tmRunTaskDetailClose/, 'task sheet close must use the shared lifecycle');
assert.ok(taskSheetClose.indexOf('__tmRunTaskDetailClose') < taskSheetClose.indexOf('state.checklistDetailSheetOpen = false'), 'task sheet must save before hiding');
assert.doesNotMatch(taskSheetClose, /Promise\.resolve\(flushPromise\)/, 'task sheet must not fire-and-forget its close save');

const standaloneClose = sliceBetween(
    taskSource,
    'const close = async () =>',
    'let overlayPointerStartedOnBackdrop',
    'standalone detail close',
);
assert.match(standaloneClose, /return await __tmRunTaskDetailClose\(overlay/, 'standalone detail close must await the shared lifecycle');
assert.ok(standaloneClose.indexOf('__tmRunTaskDetailClose') < standaloneClose.indexOf('overlay.remove()'), 'standalone overlay removal must happen after its save');

const kanbanClose = sliceBetween(
    detailSource,
    'async function __tmCloseKanbanDetailFloating',
    'function __tmCaptureKanbanDetailScrollSnapshot',
    'kanban detail close',
);
assert.match(kanbanClose, /return await __tmRunTaskDetailClose\(panel/, 'kanban detail close must await the shared lifecycle');
assert.ok(kanbanClose.indexOf('__tmRunTaskDetailClose') < kanbanClose.indexOf("state.kanbanDetailTaskId = ''"), 'kanban detail state must remain available until its save settles');

const explicitFlush = sliceBetween(
    detailSource,
    'const flushAutoSaveNow = async',
    'try { root.__tmTaskDetailFlushSave = flushAutoSaveNow;',
    'explicit detail flush',
);
assert.match(explicitFlush, /captureFormStateSnapshot\(\)/, 'explicit blur and close flushes must capture the current DOM value');
assert.doesNotMatch(explicitFlush, /pendingAutoSaveRequest\?\.formState/, 'explicit flushes must not replay an older debounced snapshot');
assert.match(explicitFlush, /await waitForPendingDetailCommits\(\)/, 'close must also settle mutations started by an earlier autosave');

const saveRequestOptions = sliceBetween(
    detailSource,
    'const createSaveRequestOptions =',
    'const resetQueuedSaveRequest =',
    'detail save request options',
);
assert.match(saveRequestOptions, /waitForCommit:\s*opts\.waitForCommit === true/, 'detail save options must preserve explicit commit waits');
assert.match(saveRequestOptions, /waitForCommit:\s*left\.waitForCommit === true \|\| right\.waitForCommit === true/, 'queued and explicit saves must merge commit waits');

const saveOnce = sliceBetween(
    detailSource,
    'const runSaveOnce = async',
    'const doSave = async',
    'detail save runner',
);
assert.match(saveOnce, /background:\s*!waitForCommit[\s\S]*wait:\s*waitForCommit/, 'explicit close saves must request a foreground wait without changing normal autosave');
assert.match(saveOnce, /if \(waitForCommit\) \{\s*await contentSavePromise;/, 'close must wait for content mutation settlement');
assert.match(saveOnce, /if \(waitForCommit\) \{\s*const fieldResult = await fieldSavePromise;/, 'close must wait for field mutation settlement');
assert.match(saveOnce, /trackDetailCommit\(pendingPromise,/, 'detail saves must track queued mutation settlement independently of enqueue mode');
assert.match(saveOnce, /reason:\s*'serialized-same'/, 'an earlier autosave may already own the current title');
assert.match(saveOnce, /formState\.hasContentEditor === false[\s\S]*reason:\s*'content-editor-absent'[\s\S]*return true;/, 'note view close must skip absent form controls without reporting a failed save');
assert.ok(saveOnce.indexOf('formState.hasContentEditor === false') < saveOnce.indexOf('if (!nextContent)'), 'an absent note-view title editor must be handled before real empty-title validation');
assert.doesNotMatch(saveOnce, /reason:\s*'detail-content-save'[\s\S]*__tmScheduleBusyDetailViewRefresh/, 'parent title save must not queue a stale full-view refresh for drawer close');

const subtaskSave = sliceBetween(
    detailSource,
    'const saveSubtaskContent = async',
    'const scheduleSubtaskSave =',
    'detail subtask title save',
);
assert.match(subtaskSave, /renderOptimistic:\s*true/, 'subtask titles must use the shared optimistic content mutation');
assert.match(subtaskSave, /trackDetailCommit\(pendingPromise, \[commitKey\], String\(op\?\.id/, 'drawer close must also wait for and identify subtask title mutations');
assert.doesNotMatch(subtaskSave, /Object\.assign\(task|__tmTaskStore\?\.patchLocal|__tmScheduleBusyDetailViewRefresh|__tmScheduleViewRefresh/, 'subtask titles must not maintain a second local patch or deferred full-refresh path');

const detailPatch = sliceBetween(
    detailSource,
    'function __tmPatchTaskDetailPanelInPlace',
    'function __tmScheduleTaskDetailForceRebuildRetry',
    'detail in-place patch',
);
assert.match(detailPatch, /hasOwnProperty\.call\(nextPatch, 'content'\)/, 'detail panels must handle content as an in-place patch');
assert.match(detailPatch, /titleTextarea === document\.activeElement \|\| titleTextarea\.dataset\.composing === 'true'/, 'detail content patch must preserve active and IME drafts');

const checklistRefresh = sliceBetween(
    detailSource,
    'function __tmRefreshChecklistSelectionInPlace',
    'function __tmResolveTaskDetailSheetPanel',
    'checklist detail reuse',
);
assert.match(checklistRefresh, /__tmPatchTaskDetailPanelInPlace\(panel, selectedId, \{\s*content:\s*true/, 'reused checklist details must receive the committed title');

const taskSheetRefresh = sliceBetween(
    detailSource,
    'function __tmRefreshTaskDetailSheetInPlace',
    'async function __tmOpenTaskDetailSheetInPlace',
    'task sheet reuse',
);
assert.match(taskSheetRefresh, /__tmPatchTaskDetailPanelInPlace\(panel, selectedId, \{\s*content:\s*true/, 'reused task sheets must receive the committed title');
assert.match(renderSource, /onClose:\s*\(\) => \{\s*return window\.tmTaskDetailSheetClose\?\.\(\);/, 'render-bound sheet close must return the outer close promise');

const aiDetailHandoff = sliceBetween(
    aiPanelSource,
    'async function __tmPrepareChecklistDetailForAiSidebar',
    'window.tmMultiSelectSendToAi',
    'AI detail handoff',
);
assert.match(aiDetailHandoff, /await __tmFlushTaskDetailBeforeClose\(panel/, 'opening AI from checklist must use the same commit-aware detail flush');
assert.match(aiDetailHandoff, /if \(!saved\) return false/, 'AI handoff must stop when the current detail cannot be saved');
assert.match(aiPanelSource, /if \(!await __tmPrepareChecklistDetailForAiSidebar\(\)\) return false;/, 'AI sidebar must honor a failed detail handoff');

console.log('task content live consistency contract tests passed');
