const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/task-horizon/main/40-render-runtime.js'), 'utf8');
const detailLoader = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js'), 'utf8');
const detailRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/52-task-detail-runtime.js'), 'utf8');
const uiFoundation = fs.readFileSync(path.join(root, 'src/task-horizon/main/30-dialogs-and-ui-foundation.js'), 'utf8');
const start = source.indexOf('window.tmKanbanCardPointerDown = function');
const end = source.indexOf('\n    };', start);

assert.ok(start >= 0 && end > start, 'kanban pointer gesture handler must exist');
const handler = source.slice(start, end);
assert.match(handler, /const interactiveOrigin = pointerTarget instanceof Element[\s\S]*pointerTarget\.closest\('button,input,select,textarea,a,\[contenteditable="true"\],\[role="button"\]'\)/, 'interactive controls must disable card dragging without disabling gesture classification');
assert.match(handler, /const multiSelectActive = __tmIsMultiSelectActive\('kanban'\);[\s\S]*const gestureAllowsDrag = !interactiveOrigin[\s\S]*!multiSelectActive \|\| __tmIsTaskMultiSelected\(rawTaskId\)/, 'multi-select mode must allow long-press dragging only from a selected kanban card');
assert.doesNotMatch(handler, /if \(__tmIsMultiSelectActive\('kanban'\)\)\s*\{?\s*return;/, 'multi-select mode must not create a dead zone for horizontal board swipes');
assert.doesNotMatch(handler, /pointerTarget\.closest\('button,input,select,textarea,a,\[contenteditable="true"\],\[role="button"\]'\)\)\s*\{?\s*return;/, 'interactive card descendants must not create a dead zone for horizontal board swipes');
assert.match(handler, /const startDrag = \(options = \{\}\) => \{\s*if \(!gestureAllowsDrag\) return;/, 'the shared card gesture must guard drag activation independently from horizontal panning');
assert.match(handler, /if \(gestureAllowsDrag\) \{\s*longPressTimer = setTimeout/, 'only draggable card origins may arm the long-press timer');
assert.match(handler, /state\.draggingTaskIds = dragTaskIds\.length \? dragTaskIds : \[taskId\];[\s\S]*state\.__tmKanbanDragIds = state\.draggingTaskIds;/, 'mobile kanban drags must retain the full selected task set');
assert.match(handler, /t === 'application\/x-tm-task-ids'\) return JSON\.stringify\(dragTaskIds\.length \? dragTaskIds : \[taskId\]\)/, 'mobile synthetic drops must expose all selected task ids');
assert.match(handler, /const bodyEl = cardEl\.closest\('\.tm-body\.tm-body--kanban'\)\s*\|\| state\.modal\?\.querySelector/, 'card gestures must resolve their owning kanban body before the global modal fallback so Dock and main hosts cannot cross-control each other');

const dockBindStart = uiFoundation.indexOf('function __tmBindDockPointerTaskDrag');
const dockBindEnd = uiFoundation.indexOf('window.tmRowClick = async function', dockBindStart);
assert.ok(dockBindStart >= 0 && dockBindEnd > dockBindStart, 'dock pointer task drag binding must exist');
const dockBind = uiFoundation.slice(dockBindStart, dockBindEnd);
assert.doesNotMatch(dockBind.slice(0, dockBind.indexOf("modal.addEventListener('click'")), /if \(__tmIsMultiSelectActive\(\)\) return;/, 'dock pointer dragging must remain bound while kanban multi-select mode is active');
assert.match(dockBind, /__tmIsMultiSelectActive\(\)[\s\S]*source\.sourceType === 'kanban' && __tmIsTaskMultiSelected\(source\.taskId\)/, 'dock pointer dragging must accept only selected kanban cards during multi-select mode');
assert.match(dockBind, /state\.__tmKanbanDragIds = state\.draggingTaskIds;/, 'dock kanban dragging must preserve the selected task set');

const detailStart = detailLoader.indexOf('window.tmOpenTaskDetail = async function');
const detailEnd = detailLoader.indexOf('window.tmToggleTaskDetailCompletedSubtasks', detailStart);
assert.ok(detailStart >= 0 && detailEnd > detailStart, 'shared task detail opener must exist');
const detailOpen = detailLoader.slice(detailStart, detailEnd);
const sheetOpen = detailOpen.indexOf('await __tmOpenTaskDetailSheetInPlace(tid, {');
const blockingAttrs = detailOpen.indexOf('task = await __tmEnsureTaskDetailFieldAttrs(task, {');

assert.ok(sheetOpen >= 0 && blockingAttrs > sheetOpen, 'compact task sheets must open before authoritative field-attribute hydration');
assert.doesNotMatch(detailOpen.slice(sheetOpen, blockingAttrs), /__tmScheduleTaskDetailFieldAttrHydration/, 'view call sites must not duplicate task-sheet hydration scheduling');
assert.match(detailOpen, /const shouldReconcileDetailOpen = detailOpenOptions\.reconcile === true;/, 'ordinary mobile detail opens must not enqueue a document reload');
const compactOpenBranch = detailOpen.slice(detailOpen.indexOf('if (useTaskDetailSheetMode) {'), blockingAttrs);
assert.doesNotMatch(compactOpenBranch, /__tmCacheTaskInState/, 'opening a compact detail sheet must not write a read-only projected snapshot back into the task store');

const sheetStart = detailRuntime.indexOf('async function __tmOpenTaskDetailSheetInPlace');
const sheetEnd = detailRuntime.indexOf('function __tmPatchVisibleTaskDetailSubtaskPriorityInPlace', sheetStart);
assert.ok(sheetStart >= 0 && sheetEnd > sheetStart, 'shared compact task sheet opener must exist');
const sheet = detailRuntime.slice(sheetStart, sheetEnd);
const sheetRefresh = sheet.indexOf('__tmRefreshTaskDetailSheetInPlace(modal, source, { task: openingTask })');
const sheetHydrate = sheet.indexOf('__tmScheduleTaskDetailFieldAttrHydration(tid, openingTask, {');
assert.ok(sheetRefresh >= 0 && sheetHydrate > sheetRefresh, 'shared task sheet must render before scheduling authoritative field hydration');
assert.doesNotMatch(sheet.slice(0, sheetRefresh), /await __tmEnsureTaskDetailFieldAttrs/, 'shared task sheet must not wait for field attributes before first paint');
assert.match(sheet, /__tmRefreshTaskDetailSheetInPlace\(modal, source, \{ task: openingTask \}\)/, 'task sheet open must pass the already resolved task snapshot into its first refresh');
assert.doesNotMatch(sheet, /__tmEnsureTaskDetailSheetMounted\(modal, task, tid, source\)[\s\S]*__tmRefreshTaskDetailSheetInPlace\(modal, `\$\{source\}:mounted`\)/, 'a newly mounted task sheet must not rebuild the same detail immediately');

const bindStart = detailRuntime.indexOf('function __tmBindTaskDetailEditor(');
const bindEnd = detailRuntime.indexOf('function __tmBuildTaskDetailLocationSignature', bindStart);
assert.ok(bindStart >= 0 && bindEnd > bindStart, 'task detail editor binding must remain extractable');
const bindEditor = detailRuntime.slice(bindStart, bindEnd);
const getBoundStart = bindEditor.indexOf('const getBoundTask = () => {');
const getBoundEnd = bindEditor.indexOf('const getBoundTaskId = () => {', getBoundStart);
assert.ok(getBoundStart >= 0 && getBoundEnd > getBoundStart, 'bound task resolver must remain extractable');
const getBoundTask = bindEditor.slice(getBoundStart, getBoundEnd);
assert.match(getBoundTask, /root\.__tmTaskDetailTask/, 'bound task resolver must reuse the snapshot already attached to the mounted panel');
assert.ok(getBoundTask.indexOf('root.__tmTaskDetailTask') < getBoundTask.indexOf('__tmGetTaskDetailTaskById'), 'mounted snapshot reuse must happen before any projected task-tree rebuild');

const checklistStart = uiFoundation.indexOf('window.tmChecklistSelectTask = async function');
const checklistEnd = uiFoundation.indexOf('function __tmIsTouchLikeChecklistPointer', checklistStart);
assert.ok(checklistStart >= 0 && checklistEnd > checklistStart, 'checklist detail selection handler must exist');
const checklist = uiFoundation.slice(checklistStart, checklistEnd);
const checklistRefresh = checklist.indexOf('__tmRefreshChecklistSelectionInPlace');
const checklistHydrate = checklist.indexOf('__tmScheduleTaskDetailFieldAttrHydration');
assert.ok(checklistRefresh >= 0 && checklistHydrate > checklistRefresh, 'checklist detail must use the same render-then-hydrate policy');
assert.doesNotMatch(checklist.slice(0, checklistRefresh), /await __tmEnsureTaskDetailFieldAttrs/, 'checklist detail must not wait for field attributes before first paint');

const hydrateStart = detailRuntime.indexOf('function __tmScheduleTaskDetailFieldAttrHydration');
const hydrateEnd = detailRuntime.indexOf('function __tmShouldDismissTaskTimeHubEditor', hydrateStart);
assert.ok(hydrateStart >= 0 && hydrateEnd > hydrateStart, 'detail field hydrator must exist');
const hydrate = detailRuntime.slice(hydrateStart, hydrateEnd);
assert.match(hydrate, /const fieldPatch = \{\}[\s\S]*fieldPatch\.customFieldValues = afterState\?\.customFieldValues \|\| \{\}[\s\S]*__tmRefreshVisibleTaskDetailForTask\(tid, \{[\s\S]*patch: repeatChanged \? null : fieldPatch/, 'background hydration must patch changed standard and custom fields through the shared detail projection');
assert.doesNotMatch(hydrate, /__tmRefreshTaskDetailSheetInPlace\([\s\S]*forceRebuild: true/, 'ordinary hydrated fields must not rebuild the complete task sheet');

const ensureAttrsStart = detailRuntime.indexOf('async function __tmEnsureTaskDetailFieldAttrs');
const ensureAttrsEnd = detailRuntime.indexOf('async function __tmEnsureTaskDetailAttachmentAttrs', ensureAttrsStart);
assert.ok(ensureAttrsStart >= 0 && ensureAttrsEnd > ensureAttrsStart, 'detail field attribute hydration must remain extractable');
const ensureAttrs = detailRuntime.slice(ensureAttrsStart, ensureAttrsEnd);
const hostAttrRead = ensureAttrs.indexOf('await __tmApplyTaskAttrHostOverrides([task], {');
const recentCustomFieldReplay = ensureAttrs.indexOf("__tmGetLocalTaskPatchWatermarkValue(tid, 'customFieldValues')");
const cacheHydratedTask = ensureAttrs.indexOf('__tmCacheTaskInState(task, {');
assert.ok(hostAttrRead >= 0
    && recentCustomFieldReplay > hostAttrRead
    && cacheHydratedTask > recentCustomFieldReplay,
    'detail hydration must restore recent local task patches after host reads and before caching so a first kanban reopen cannot render stale custom-field labels');

const positionStart = detailRuntime.indexOf('function __tmPositionKanbanDetailFloat');
const positionEnd = detailRuntime.indexOf('function __tmScheduleKanbanDetailFloatSettledPosition', positionStart);
assert.ok(positionStart >= 0 && positionEnd > positionStart, 'kanban detail positioning helper must exist');
const position = detailRuntime.slice(positionStart, positionEnd);
const hiddenAnchorGuard = position.indexOf('if (card.hidden || cardRect.width <= 0 || cardRect.height <= 0) return false;');
const temporaryOriginWrite = position.indexOf("panel.style.left = '24px';");
assert.ok(hiddenAnchorGuard >= 0 && temporaryOriginWrite > hiddenAnchorGuard,
    'a filtered or hidden anchor must keep the current floating-detail position before temporary origin styles are written');

console.log('kanban mobile detail performance contract tests passed');
