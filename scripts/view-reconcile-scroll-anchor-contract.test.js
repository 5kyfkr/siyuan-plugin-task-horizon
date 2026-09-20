'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const services = read('src/task-horizon/main/20-api-and-runtime-services.js');
const projection = read('src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js');
const renderRuntime = read('src/task-horizon/main/40-render-runtime.js');
const scrollState = read('src/task-horizon/main/21-view-render-state.js');
const documentLoader = read('src/task-horizon/main/task-runtime/53c-document-loader-runtime.js');
const checklistBody = read('src/task-horizon/main/render/42-render-list-and-checklist-body.js');
const stylesheet = read('task-horizon.css');

const segment = (source, start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(from, -1, `missing segment start: ${start}`);
    assert.notEqual(to, -1, `missing segment end: ${end}`);
    return source.slice(from, to);
};

assert.match(services, /function __tmCaptureViewScrollAnchor\(hostEl, itemSelector = '\[data-id\]'\)/);
assert.match(services, /function __tmRestoreViewScrollAnchor\(hostEl, snapshot\)/);

const listRerender = segment(services, 'function __tmRerenderListInPlace', 'function __tmShouldUseGlobalTimelineScroll');
assert.match(listRerender, /const scrollAnchor = __tmCaptureViewScrollAnchor\(body, 'tr\[data-id\]'\)/);
assert.match(listRerender, /__tmRestoreViewScrollAnchor\(body, scrollAnchor\)/);
assert.match(listRerender, /scrollEpochAtCapture/);
assert.match(listRerender, /scrollEpochChanged/);
assert.doesNotMatch(listRerender, /else if \(body\) body\.scrollTop/);

const listAppend = segment(services, 'function __tmReconcileListRowsForAppend', 'function __tmRerenderListInPlace');
assert.match(listAppend, /currentByKey = new Map/);
assert.match(listAppend, /before the next already-mounted stable row/);
assert.match(listAppend, /tbody\.insertBefore\(entry\.row, anchor\)/);
assert.match(listAppend, /liveLoadMoreRow/, 'append reconciliation must keep the live tail control mounted while loading');
assert.match(listAppend, /tmLastIncrementalAppendTailOnly/, 'append reconciliation must record whether insertion stayed at the tail');
assert.doesNotMatch(listAppend, /currentRows\.forEach\(\(row\) => \{[\\s\\S]*?row\.remove\(\)/, 'append reconciliation must not remove the tail control before inserting new rows');

const checklistRerender = segment(services, 'function __tmRerenderChecklistInPlace', 'function __tmGetKanbanColScrollKey');
assert.match(checklistRerender, /const scrollAnchor = __tmCaptureViewScrollAnchor\(pane, '\.tm-checklist-item\[data-id\]'\)/);
assert.match(checklistRerender, /__tmRestoreViewScrollAnchor\(pane, scrollAnchor\)/);
assert.match(checklistRerender, /__tmRestoreViewScrollAnchor\(nextPane, scrollAnchor\)/);

assert.match(stylesheet, /tm-modal--mobile \.tm-body\.tm-body--checklist \.tm-checklist-item,[\s\S]*content-visibility: visible;[\s\S]*contain-intrinsic-size: none;/);

const parentReconcile = segment(services, 'function __tmTryReconcileKanbanParentCards', 'function __tmRerenderKanbanInPlace');
assert.match(parentReconcile, /currentCard\.replaceChildren\([\s\S]*nextCard\.childNodes/);
assert.match(parentReconcile, /globalThis\.__tmTryReconcileKanbanParentCards = __tmTryReconcileKanbanParentCards/);
assert.doesNotMatch(parentReconcile, /body\.replaceWith\(nextBody\)/);
assert.match(parentReconcile, /state\.\__tmProgressiveViewRender = null/);
assert.match(parentReconcile, /state\.\__tmProgressiveViewRender = progressiveJob/);

const optimisticFrame = segment(projection, 'const __tmOptimisticProjectionFramePending', 'function __tmCollectChecklistProjectionDomBlock');
assert.match(optimisticFrame, /entry\.mode === 'kanban'[\s\S]*__tmTryReconcileKanbanParentCards/);

const batch = segment(projection, 'function __tmRunTaskProjectionBatch', 'const __tmPendingProjectionEntries');
assert.match(batch, /batch\.structural === true[\s\S]*createSubtask[\s\S]*__tmTryReconcileKanbanParentCards/);

assert.match(renderRuntime, /savedChecklistScrollAnchor = __tmCaptureViewScrollAnchor\(pane, '\.tm-checklist-item\[data-id\]'\)/);
assert.match(renderRuntime, /savedListScrollAnchor = __tmCaptureViewScrollAnchor\(body, 'tr\[data-id\]'\)/);
assert.match(renderRuntime, /__tmRestoreViewScrollAnchor\(pane, desiredListAnchor\)/);
assert.match(renderRuntime, /__tmRestoreViewScrollAnchor\(body, desiredListAnchor\)/);
assert.match(renderRuntime, /listRestoreCancelled/);
assert.match(renderRuntime, /savedListScrollEpoch/);
assert.match(renderRuntime, /hasListScrollChangedSinceCapture/);
assert.match(renderRuntime, /restored !== false/);
assert.match(scrollState, /userScrollEpoch: 0/);
assert.match(scrollState, /gate\.userScrollEpoch = Math\.max\(0, Number\(gate\.userScrollEpoch\) \|\| 0\) \+ 1/);
assert.match(documentLoader, /background full-load/);
assert.match(documentLoader, /const shouldPatchCurrentView = !forceShellRender/);

// Reproduce the mobile log: 154 filtered tasks, only 44 visible after collapse.
// Exercise the real bounded row builder and HTML renderer, including grouped
// caches, rather than accepting an empty batch solely because its HTML is short.
const roots = Array.from({ length: 44 }, (_, index) => ({
    id: `task-${index}`, root_id: `doc-${index % 3}`, content: `doc-${index % 3}`, children: [],
}));
roots[0].children = Array.from({ length: 110 }, (_, index) => ({ id: `child-${index}`, root_id: 'doc-0' }));
const tasks = [...roots, ...roots[0].children];
const docIds = ['doc-0', 'doc-1', 'doc-2'];
const state = {
    viewMode: 'checklist', activeDocId: 'all', filteredTasks: tasks,
    collapsedTaskIds: new Set(['task-0']), collapsedGroups: new Set(),
    listRenderLimit: 39, listRenderStep: 20, detailTaskId: '',
};
const fixture = {
    state, Map, Set, SettingsStore: { data: { docH2SubgroupEnabled: false } },
    __tmBuildTaskRowModelCacheMeta: () => ({ viewMode: 'checklist', filteredTasksRef: tasks }),
    __tmGetAlwaysVisibleTaskDocHeadingTasks: () => [],
    __tmGetFilteredTaskDerivedState: () => ({
        filteredIdSet: new Set(tasks.map((task) => task.id)),
        baseOrderMap: new Map(tasks.map((task, index) => [task.id, index])),
        docsInOrder: docIds, docEntryById: new Map(docIds.map((id) => [id, { name: id }])),
        filteredTasksByDoc: new Map(), rootTasks: roots,
        docRootTasksByDoc: new Map(docIds.map((id) => [id, roots.filter((task) => task.root_id === id)])),
    }),
    __tmBuildRuleSortContext: () => ({}),
    __tmSplitTasksByDoneState: (list) => ({ active: list, done: [] }),
    __tmGetProjectedOrderedTaskChildren: (task) => task.children || [],
    __tmShouldKeepChildTaskVisible: () => true,
    __tmResolveHideCompletedDescendantsFlag: () => false,
    __tmShouldSeparateCompletedRootGroup: () => false,
    __tmGetTaskTimePriorityInfo: () => ({ diffDays: 0 }),
    __tmNormalizeHexColor: (_value, fallback) => fallback,
    __tmNormalizeHeadingLevel: () => 'h2',
    __tmBuildTimelineRangeMeta: () => null,
    __tmIsDarkMode: () => false, __tmHasCalendarSidebarChecklist: () => false,
    __tmClamp: (value) => value, __tmWithAlpha: (value) => value,
    esc: (value) => String(value),
    __TM_CHECKLIST_COMPACT_META_FIELD_DEFAULTS: [],
    __tmGetCustomFieldDefs: () => [], __tmGetWrapConfig: () => ({ enabled: false }),
    __tmGetCompactChecklistMetaFieldsForCurrentHost: () => [],
    __tmChecklistUseSheetMode: () => true,
    __tmResolveFirstVisibleTaskIdFromRowModel: () => '',
    __tmGetStatusOptions: () => [], __tmResolveTaskStatusDisplayOption: () => ({ color: '', name: '' }),
    GlobalLock: { isLocked: () => false },
    API: { getTaskTitlePresentation: (_md, text) => ({ text }), renderTaskContentHtml: (_md, text) => text },
};
for (const name of [
    '__tmCalcGroupDurationText', '__tmGetDocColorHex', '__tmNormalizeDateOnly',
    '__tmGetChecklistCompactRightFontSize', '__tmGetEffectiveProgressBarColor', '__tmGetTaskRepeatWeekdayLabel',
    '__tmRenderToggleIcon', '__tmRenderBadgeIcon', '__tmBuildDocGroupQuickAddBtnHtml',
    '__tmRenderDocGroupLabel', '__tmBuildTimeGroupQuickAddBtnHtml',
    '__tmIsTaskMultiSelected', '__tmIsTomatoFocusModeEnabled', '__tmHasReminderMark',
    '__tmRenderCompletedTodayBadge', '__tmRenderRemarkIcon', '__tmRenderTaskAttachmentIcon', '__tmRenderTaskCardRemark',
    '__tmBuildStatusChipStyle', '__tmShouldShowCompactChecklistDocName',
    '__tmGetTaskTomatoSummaryText', '__tmGetTaskTomatoSummaryHtml', '__tmRenderPriorityJira',
    '__tmShouldUseDesktopTaskDragLogic', '__tmShouldUseCustomTouchTaskDrag', '__tmRenderTaskCheckbox',
    '__tmBuildTooltipAttrs', '__tmBuildTaskTitleOpacityStyle', '__tmRenderGlobalCollectDocTaskInlineIcon',
    '__tmRenderRecurringTaskInlineIcon', '__tmRenderPinnedTaskInlineIcon', '__tmRenderRecurringInstanceBadge',
]) fixture[name] = () => '';
const modelContext = vm.createContext(fixture);
vm.runInContext(segment(projection, 'function __tmTaskRowModelCacheMatches', 'function __tmResolveFirstVisibleTaskIdFromRowModel'), modelContext);
vm.runInContext(checklistBody, modelContext);
vm.runInContext(segment(read('src/task-horizon/main/30-dialogs-and-ui-foundation.js'),
    'function __tmGetListAutoLoadMoreState', 'function __tmGetRenderStepForFilteredScope'), modelContext);
const htmlTaskIds = (html) => [...html.matchAll(/class="tm-checklist-item[^"\n]*" data-id="([^"]+)"/g)].map((match) => match[1]);
for (const compact of [false, true]) {
fixture.SettingsStore.data.checklistCompactMode = compact;
for (const grouping of ['', 'groupByDocName', 'groupByTaskName', 'groupByTime']) {
    for (const key of ['groupByDocName', 'groupByTaskName', 'groupByTime']) state[key] = key === grouping;
    state.__tmTaskRowModelCacheByMode = new Map();
    modelContext.__tmBuildTaskRowModel({ maxTaskRows: 20 });
    const fullRows = modelContext.__tmBuildTaskRowModel().filter((row) => row.type === 'task');
    assert.equal(fullRows.length, 44, `${grouping}: a bounded build must not poison the full model cache`);
    const first = modelContext.__tmBuildRenderSceneChecklistBodyHtml();
    assert.equal(htmlTaskIds(first).length, 39);
    assert.match(first, /tm-checklist-load-more/);
    const tail = modelContext.__tmBuildRenderSceneChecklistBodyHtml({
        fragmentOnly: true, fragmentStartTaskCount: 39, fragmentEndTaskCount: 59,
    });
    assert.deepEqual(htmlTaskIds(tail), Array.from(fullRows.slice(39), (row) => row.id));
    assert.match(tail, /fragment-complete="1"/, 'hidden descendants must not keep loading alive');
    const emptyTail = modelContext.__tmBuildRenderSceneChecklistBodyHtml({
        fragmentOnly: true, fragmentStartTaskCount: 59, fragmentEndTaskCount: 79,
    });
    assert.deepEqual(htmlTaskIds(emptyTail), []);
    assert.match(emptyTail, /fragment-complete="1"/);
    state.listRenderLimit = 44;
    assert.doesNotMatch(modelContext.__tmBuildRenderSceneChecklistBodyHtml(), /tm-checklist-load-more/,
        'an exact window boundary with no visible successor must finish loading');
    state.listRenderLimit = 39;
}
}
for (const compact of [false, true]) {
    fixture.SettingsStore.data.checklistCompactMode = compact;
    state.groupByDocName = true;
    state.groupByTime = false;
    state.collapsedGroups.add('doc_doc-2');
    const lastGroupBatch = modelContext.__tmBuildRenderSceneChecklistBodyHtml({
        fragmentOnly: true, fragmentStartTaskCount: 20, fragmentEndTaskCount: 40,
    });
    assert.match(lastGroupBatch, /data-group-key="doc_doc-2"/, 'the last batch must retain trailing collapsed document controls');
    assert.match(lastGroupBatch, /fragment-complete="1"/);
    state.collapsedGroups.clear();
}
state.groupByDocName = false;
state.groupByTime = false;
state.collapsedTaskIds.clear();
state.__tmTaskRowModelCacheByMode = new Map();
const middleBatch = modelContext.__tmBuildRenderSceneChecklistBodyHtml({
    fragmentOnly: true, fragmentStartTaskCount: 39, fragmentEndTaskCount: 59,
});
assert.equal(htmlTaskIds(middleBatch).length, 20);
assert.match(middleBatch, /fragment-complete="0"/, 'real remaining children must remain loadable');
modelContext.__tmCollapseMotion = { config: { maxDisclosureItems: 24 } };
const expandedLargeBranch = modelContext.__tmBuildRenderSceneChecklistBodyHtml({ taskBranchId: 'task-0' });
assert.equal(htmlTaskIds(expandedLargeBranch).length, 39,
    'a large expanded branch must retain the bounded full-list fallback');
assert.match(expandedLargeBranch, /tm-checklist-load-more/,
    'a large branch fallback must keep the remaining tasks loadable');
modelContext.__tmGetViewRenderWindow = () => ({ initial: 20, limit: 59 });
let hasMore = false;
state.modal = { querySelector: () => ({ querySelector: () => hasMore ? {} : null }) };
assert.equal(modelContext.__tmGetListAutoLoadMoreState().remaining, 0, 'scroll rechecks must stop at the visible end');
hasMore = true;
assert.equal(modelContext.__tmGetListAutoLoadMoreState().remaining, 95, 'expanding a branch must permit more batches');

console.log('view reconcile and scroll anchor contract tests passed');
