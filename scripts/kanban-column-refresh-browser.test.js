'use strict';

// Production column membership, tree traversal, progressive loaders and DOM
// commit in isolated Chromium. Only card decoration and host services are stubs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const read = (name) => fs.readFileSync(path.join(__dirname, '../src/task-horizon/main', name), 'utf8');
function section(source, start, end) {
    const from = source.indexOf(start), to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from, start);
    return source.slice(from, to);
}
const runtime = read('20-api-and-runtime-services.js');
const completionRuntime = read('task-runtime/51-whiteboard-and-link-runtime.js');
const viewSwitch = read('render/47-render-side-panels-and-view-switching.js');
const dialogRuntime = read('30-dialogs-and-ui-foundation.js');
const filterCode = [
    read('34-task-projection-engine.js'),
    section(dialogRuntime, 'function __tmGetDocTaskStateForTabs(', 'function __tmGetArchiveModeFilterRule('),
    section(dialogRuntime, 'function applyFilters()', 'function __tmIsTaskAndDescDone('),
].join('\n');
let renderer = section(read('render/43-render-timeline-kanban-calendar-body.js'),
    'function __tmBuildRenderSceneKanbanBodyHtml(', 'function __tmBuildRenderSceneCalendarBodyHtml(');
const decoration = section(renderer, 'const renderCard = ', 'const kanbanBoardNavItems = ');
renderer = renderer.replace(decoration, `const renderCard = (task, depth, sub, childRoot, title, children, toggle) => {
    renderedTaskIds.push(task.id);
    return '<article class="tm-kanban-card' + (sub ? ' tm-kanban-card--sub' : '')
        + '" data-id="' + task.id + '" data-done="' + !!task.done + '" data-status="' + task.customStatus
        + '" data-tm-placement-parent="' + (task.parentTaskId || '')
        + '"><span class="tm-task-content-clickable" style="color:rgb(70,70,70)">' + task.content + '</span>' + (toggle || '')
        + '<div class="tm-kanban-subtasks-list" data-tm-kanban-subtasks-list'
        + (__tmKanbanGetCollapsedSet().has(task.id) ? ' hidden' : '') + '>' + children + '</div></article>';
};\n`);
const code = [read('32-runtime-state-and-events.js'), read('33-task-boundary-facades.js'), read('34-task-projection-engine.js'), read('21-view-render-state.js'), read('render/40-render-list-context-helpers.js'),
    section(read('10-stores-rules-and-cache.js'), 'function __tmNormalizeCompletedTasksGroupBy(', 'function __tmGetTaskSnapshotRuleForView('),
    section(runtime, 'function __tmGetDocHeadingBucket(', 'function __tmTaskHasResolvedHeading('),
    section(runtime, 'function __tmBuildDocHeadingBuckets(', 'let __tmKanbanColsHtmlCache'),
    section(read('40-render-runtime.js'), 'function __tmBuildHeadingGroupContextMenuAttrs(', 'async function __tmReadHeadingGroupBlock('),
    section(read('10-stores-rules-and-cache.js'), 'function __tmIsLikelyBlockId(', 'function __tmExtractDocIdsFromTx('),
    section(runtime, 'function __tmHashStringFNV1a(', 'function __tmSafeAttrName('), renderer,
    section(completionRuntime, 'function __tmGetArchivedDocIdsForAllTabCompletedTailGroup(', 'function __tmGetTaskDoneSortTs('),
    section(completionRuntime, 'function __tmShouldShowTaskInCompletedRootGroup(', 'function __tmBuildTaskRowModelCacheMeta('),
    section(runtime, 'function __tmGetCompletedRootGroupScopeKey(', 'function __tmPersistExpandedCompletedGroups('),
    section(read('task-runtime/53b-task-create-and-quick-add-runtime.js'), 'function __tmRemoveTaskDomNodes(', 'function __tmApplyDeleteOptimisticLocal('),
    section(read('10-stores-rules-and-cache.js'), 'function __tmResolveKanbanRefreshTaskIds(', 'async function __tmRefreshAffectedDocsIncrementally('),
    section(runtime, 'function __tmPatchKanbanColumnBranches(', 'function __tmTryReconcileKanbanParentCards('),
    section(runtime, 'function __tmApplyTodayScheduledTaskNameMarks(', 'function __tmGetPriorityTitleOpacityRanges('),
    section(viewSwitch, 'function __tmCaptureBodyOnlyViewScroll(', 'function __tmRenderBodyOnlyViewToolbarExtra('),
    section(viewSwitch, 'window.tmSwitchViewMode = function(mode)', '\n    };') + '\n    };',
].join('\n');

async function setup(page) {
    await page.route('**/*', (route) => route.abort());
    await page.setContent(`<style>
        .tm-body--kanban { width: 700px; overflow: auto; }
        .tm-kanban { display: flex; gap: 12px; }
        .tm-kanban-col-body { height: 190px; overflow-y: auto; }
        .tm-kanban-card > span { display: block; min-height: 40px; }
    </style><main id="manager"></main>`);
    await page.evaluate(() => {
        Object.assign(window, {
            state: { modal: document.querySelector('#manager'), viewMode: 'kanban', activeDocId: 'all',
                flatTasks: {}, taskTree: [], filteredTasks: [], otherBlocks: [], pendingInsertedTasks: {},
                pendingDeletedTasks: {}, showCompletedTasks: true, rule: {}, searchKeyword: '' },
            __TM_OTHER_BLOCK_TAB_ID: '__other__',
            SettingsStore: { data: { completedTasksInlineInGroups: true, kanbanAppearance: 'classic' } },
            GlobalLock: { isLocked: () => false },
            __tmGroupBgFromLabelColor: () => '',
            __tmKanbanColsHtmlCache: null,
            __tmProjectionService: { getAppliedGeneration: () => 0 },
            __tmGetKanbanBoardMode: () => window.boardMode || 'status',
            __tmGetKanbanColScrollKey: (column) => column.dataset.colKey,
            __tmGetTimelineGlobalScrollHost: (modal) => modal.querySelector('#tmTimelineLeftBody'),
            __tmGetSafeViewMode: (mode) => mode,
            __tmMarkHighPriorityInteraction: () => {},
            __tmShowViewSwitchPendingShell: () => state.modal,
            __tmClearViewSwitchPendingShell: () => {},
            __tmScheduleViewSwitchCommit: (_generation, _mode, callback) => callback(),
            __tmScheduleTimelineDateHydrationAfterViewSwitch: () => {},
            __tmTrySwitchViewBodyInPlace: () => commitView(),
            render: () => commitView(),
            __tmGetWhiteboardView: () => window.boardViewport || { x: 64, y: 40, zoom: 1 },
            __tmSetWhiteboardView: (value) => { window.boardViewport = { ...value }; },
            __tmFitWhiteboardToVisibleCards: () => { window.fitCalls = (window.fitCalls || 0) + 1; return true; },
            __tmGetTaskCardFieldList: () => [],
            __tmGetTaskCardAlwaysShowFieldList: () => [],
            __tmTaskCardAlwaysShowFieldEnabled: () => false,
            __tmKanbanGetCollapsedColumnSet: () => new Set(),
            __tmKanbanGetCollapsedSet: () => new Set(),
            __tmIsMobileDevice: () => false,
            __tmIsRuntimeMobileClient: () => false,
            __tmGetStatusOptions: () => ['todo', 'doing', 'done'].map((id) => ({ id, name: id, color: '#777777' })),
            __tmGetDefaultUndoneStatusId: () => 'todo',
            __tmResolveTaskStatusId: (task) => task.customStatus || 'todo',
            __tmResolveTaskStatusDisplayOption: (task) => ({ id: task.customStatus || 'todo', name: 'status' }),
            __tmIsTaskDoneEffective: (task) => !!task.done,
            __tmIsTaskCanceled: (task) => task?.taskMarker === '-',
            __tmIsTaskDoneForTailGroup: (task) => !!task.done,
            __tmDoesStatusIdResolveToDone: (id) => id === 'done',
            __tmDocShouldShowInDocTabs: () => false,
            __tmIsTaskCompletedToday: (task) => task.taskCompleteAt === '2026-09-26',
            __tmResolveHideCompletedDescendantsFlag: () => false,
            __tmShouldKeepChildTaskVisible: () => true,
            __tmIsDarkMode: () => false,
            __tmGetCurrentRule: () => ({}),
            __tmRuleUsesDocFlowSort: () => false,
            __tmRuleHasExplicitSort: () => false,
            __tmNormalizeHexColor: (_, fallback) => fallback,
            __tmNormalizeHeadingLevel: () => 'h2',
            __tmNormalizeHeadingText: (value) => String(value || '').trim(),
            __tmNormalizeDateOnly: () => '2026-09-26',
            __tmGetTaskCompletedAtDateKey: (task) => String(task.taskCompleteAt || '').slice(0, 10),
            __tmGetTaskRepeatWeekdayLabel: () => '',
            __tmGetTaskTimePriorityInfo: (task) => ({ diffDays: task.days }),
            __tmSortDocEntriesForTabs: (docs) => docs,
            __tmMoveGlobalNewTaskDocFirst: (docs) => docs,
            __tmGetDocColorHex: () => '#777777',
            __tmCompareTasksByDocFlow: () => 0,
            __tmCompareCompletedTasksRecentFirst: (_, __, fallback) => 0,
            __tmRenderDocGroupLabel: (id, label) => label,
            __tmIsTaskPinned: () => false,
            __tmSortPinnedTasksFirst: (tasks) => tasks,
            __tmParseCssColorToRgba: () => null,
            __tmClamp: (value, min, max) => Math.max(min, Math.min(value, max)),
            __tmWithAlpha: (color) => color,
            __tmCalcGroupDurationText: () => '',
            __tmRenderLucideIcon: () => '',
            __tmRenderBadgeIcon: () => '',
            __tmRenderDocIcon: () => '',
            __tmRenderHeadingLevelIconLabel: () => '',
            __tmIsOtherBlockTabId: () => false,
            __tmIsViewDomCommitBlocked: () => false,
            esc: (value) => String(value ?? ''),
            renderedTaskIds: [],
            __tmBuildElementFromHtml: (html) => {
                const t = document.createElement('template'); t.innerHTML = html; return t.content.firstElementChild;
            },
            __tmBuildTaskDetailInnerHtml: () => { throw new Error('column patch must not render detail'); },
        });
        window.setModel = (rows) => {
            const tasks = rows.map((row) => ({ root_id: 'doc', docId: 'doc', content: row.id, parentTaskId: '',
                customStatus: 'todo', done: false, ...row, children: [] }));
            const byId = Object.fromEntries(tasks.map((task) => [task.id, task]));
            for (const task of tasks) if (byId[task.parentTaskId]) byId[task.parentTaskId].children.push(task);
            state.flatTasks = byId;
            state.filteredTasks = tasks;
            state.taskTree = Array.from(new Set(tasks.map((task) => task.root_id)), (id) => ({ id, name: id,
                tasks: tasks.filter((task) => task.root_id === id && !task.parentTaskId) }));
            __tmTaskStore.acceptAuthoritative(tasks, { replaceAll: true, replaceDocuments: true,
                docIds: ['doc', 'doc2', 'doc3'], replaceStructure: true });
        };
        window.column = (key) => Array.from(state.modal.querySelectorAll('.tm-kanban-col')).find((el) => el.dataset.colKey === key);
        window.placement = (id) => Array.from(state.modal.querySelectorAll('.tm-kanban-card')).filter((el) => el.dataset.id === id)
            .map((el) => ({ column: el.closest('.tm-kanban-col').dataset.colKey,
                parent: el.parentElement.closest('.tm-kanban-card')?.dataset.id || '' }));
        window.mount = () => {
            __tmCancelProgressiveViewRender();
            state.__tmProgressiveViewRender = null;
            state.renderKanbanBodyHtml = (opts) => __tmBuildRenderSceneKanbanBodyHtml(opts);
            state.modal.innerHTML = state.renderKanbanBodyHtml();
            renderedTaskIds.length = 0;
        };
        window.patch = (ids, parents = []) => {
            renderedTaskIds.length = 0;
            return __tmTryRefreshKanbanColumns(state.modal, ids, { parentTaskIds: parents });
        };
        window.commitView = () => {
            const mode = state.viewMode;
            state.modal.innerHTML = mode === 'kanban' ? __tmBuildRenderSceneKanbanBodyHtml()
                : mode === 'whiteboard' ? '<div class="tm-whiteboard-canvas"></div>'
                : `<div ${mode === 'timeline' ? 'id="tmTimelineLeftBody"' : ''}
                    class="tm-body ${mode === 'checklist' ? 'tm-checklist-scroll' : 'tm-body--list'}"
                    style="height:190px;overflow:auto"><div style="height:6000px">${mode}</div></div>`;
            state.modal.setAttribute('data-tm-render-mode', mode);
            return true;
        };
    });
    await page.addScriptTag({ content: code });
}

(async () => {
    const browser = await chromium.launch({ headless: true });
    let passed = 0;
    const failures = [];
    const smoke = process.env.TM_TEST_SMOKE === '1';
    const smokeCases = new Set([
        'subtask status survives a later full render with the same filtered parent',
        'all rule fields preserve attached subtasks through local edits',
        'outdent updates one column; later confirmation preserves placement (false)',
        'cross-column nesting updates both columns, retains third column',
        'fresh title styles are retained while reused descendants clear stale today marks',
        'optimistic top-level removal retains its source column for counts and keyed refresh',
        'completed grouping stays independent of main grouping and preserves document headings',
        'last task leaving a dynamic column or group removes its shell without manual refresh',
    ]);
    async function run(name, check, mobile = false) {
        if (smoke && !smokeCases.has(name)) return;
        const page = await browser.newPage(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {});
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        try { await setup(page); await check(page); assert.deepEqual(errors, []); passed++; }
        catch (error) { failures.push({ name, error: error.stack }); }
        finally { await page.close(); }
    }
    try {
        await run('completed grouping stays independent of main grouping and preserves document headings', async (page) => {
            const results = await page.evaluate(() => {
                SettingsStore.data.completedTasksInlineInGroups = false;
                SettingsStore.data.kanbanShowDoneColumn = true;
                boardMode = 'heading';
                __tmRenderHeadingLevelIconLabel = (label) => label;
                __tmCompareCompletedTasksRecentFirst = (a, b) => (Date.parse(b.taskCompleteAt) || 0) - (Date.parse(a.taskCompleteAt) || 0);
                __tmCompareTasksByDocFlow = (a, b) => (a.h2Rank ?? 999) - (b.h2Rank ?? 999);
                setModel([
                    { id: 'old', done: true, h2Id: 'head-a', h2: '开发', h2Rank: 0, taskCompleteAt: '2026-09-25 09:00' },
                    { id: 'new', done: true, h2Id: 'head-a', h2: '开发', h2Rank: 0, taskCompleteAt: '2026-09-25 18:00' },
                    { id: 'other', root_id: 'doc2', docId: 'doc2', done: true, h2Id: 'head-b', h2: '开发', h2Rank: 0, taskCompleteAt: '2026-09-26 10:00' },
                    { id: 'child', parentTaskId: 'new', h2: '开发' },
                ]);
                const completedMarkup = () => column('done:heading').querySelector('.tm-kanban-col-body').innerHTML;
                const snapshots = [];
                for (const mode of ['date', 'title']) {
                    SettingsStore.data.completedTasksGroupBy = mode;
                    let baseline;
                    for (const mainMode of ['none', 'doc', 'time', 'task', 'quadrant']) {
                        state.groupByDocName = mainMode === 'doc'; state.groupByTime = mainMode === 'time';
                        state.groupByTaskName = mainMode === 'task'; state.quadrantEnabled = mainMode === 'quadrant';
                        mount();
                        const html = completedMarkup();
                        if (baseline === undefined) baseline = html;
                        if (html !== baseline) throw new Error(mode + ': completed markup changed with ' + mainMode);
                    }
                    const body = column('done:heading').querySelector('.tm-kanban-col-body');
                    const groups = [...body.querySelectorAll('.tm-kanban-group-title')].map((el) => el.textContent.trim());
                    const cards = [...body.querySelectorAll('.tm-kanban-card')].map((el) => el.dataset.id);
                    snapshots.push({ mode, groups, cards, childParent: placement('child')[0]?.parent });
                }
                state.activeDocId = 'doc'; state.groupByDocName = false; state.groupByTime = true;
                setModel([{ id: 'single', done: true, h2Id: 'head-a', h2: '开发', taskCompleteAt: '2026-09-26 10:00' }]);
                mount();
                snapshots.push({ single: [...column('done:heading').querySelectorAll('.tm-kanban-group-title')].map((el) => el.textContent.trim()) });
                return snapshots;
            });
            assert.deepEqual(results[0].cards, ['other', 'new', 'child', 'old']);
            assert.equal(results[0].groups.length, 2, 'date mode has no document or heading wrapper');
            assert.deepEqual(results[1].cards, ['new', 'child', 'old', 'other']);
            assert.deepEqual(results[1].groups.map((value) => value.replace(/\s*\d+$/, '').trim()), ['doc', '开发', 'doc2', '开发']);
            assert.equal(results[1].childParent, 'new', 'unfinished descendants stay attached to their completed parent');
            assert.equal(results[2].single.length, 1, 'a single document shows only heading groups');
        });
        for (const inline of [false, true]) {
            await run(`canceled tasks follow completion visibility after column and full refresh (${inline})`, async (page) => {
                await page.addScriptTag({ content: read('34-task-projection-engine.js') });
                const result = await page.evaluate((inline) => {
                    SettingsStore.data.completedTasksInlineInGroups = inline;
                    __tmIsTaskCanceled = (task) => task?.taskMarker === '-';
                    __tmGetStatusOptions = () => ['todo', 'doing', 'done', 'quit'].map((id) => ({ id, name: id, color: '#777777' }));
                    state.showCompletedTasks = false;
                    setModel([{ id: 'active' }, { id: 'other' }]);
                    mount();
                    const visibleIds = () => Array.from(state.modal.querySelectorAll('.tm-kanban-card'))
                        .filter((card) => !card.closest('[hidden]')).map((card) => card.dataset.id);
                    const mutation = { type: 'taskPatch', opId: 'cancel-active', taskId: 'active',
                        patch: { done: false, taskMarker: '-', customStatus: 'quit' } };
                    __tmTaskStore.applyMutation({ ...mutation, phase: 'optimistic' });
                    patch(['active']);
                    const afterColumnRefresh = visibleIds();
                    __tmTaskStore.applyMutation({ ...mutation, phase: 'commit' });
                    commitView();
                    const afterFullRefresh = visibleIds();
                    state.showCompletedTasks = true;
                    commitView();
                    const canceledCard = state.modal.querySelector('[data-id="active"]');
                    const shownCanceled = { visible: !canceledCard.closest('[hidden]'), done: canceledCard.dataset.done };
                    state.showCompletedTasks = false;
                    __tmTaskStore.applyMutation({ type: 'taskPatch', phase: 'optimistic', opId: 'resume-active',
                        taskId: 'active', patch: { done: false, taskMarker: ' ', customStatus: 'todo' } });
                    commitView();
                    return { afterColumnRefresh, afterFullRefresh, shownCanceled, resumed: visibleIds() };
                }, inline);
                assert.deepEqual(result, { afterColumnRefresh: ['other'], afterFullRefresh: ['other'],
                    shownCanceled: { visible: true, done: 'false' }, resumed: ['active', 'other'] });
            });
        }
        for (const scope of ['all', 'group']) {
            for (const inline of [false, true]) {
                await run(`completion column survives task filtering (${scope}, inline ${inline})`, async (page) => {
                    await page.evaluate(({ scope, inline }) => {
                        SettingsStore.data.completedTasksInlineInGroups = inline;
                        SettingsStore.data.currentGroupId = 'all';
                        setModel([
                            { id: 'active' },
                            { id: 'auto-done', root_id: 'doc2', docId: 'doc2', done: true, customStatus: 'done' },
                            { id: 'manual-done', root_id: 'doc3', docId: 'doc3', done: true, customStatus: 'done' },
                        ]);
                        state.activeDocId = scope;
                        Object.assign(window, {
                            __tmIsDocManuallyArchivedInGroup: (id) => id === 'doc3',
                            __tmIsDocManuallyUnarchivedInGroup: () => false,
                            __tmGetArchiveModeFilterRule: (rule) => rule,
                            __tmRuleUsesCustomOrderSort: () => false,
                            __tmParseDocTabCustomGroupActiveId: (id) => id === 'group' ? 'group' : '',
                            __tmGetDocTabCustomGroupDocIdSet: () => new Set(['doc', 'doc2', 'doc3']),
                            __tmFindDocTabCustomGroupById: () => ({}),
                            __tmGetDocTabCustomGroupRegionState: () => ({ hasActive: true, hasArchived: true }),
                            __tmShouldShowDocTabCustomGroupInRegion: () => true,
                            __tmIsDocTabCustomGroupActiveId: (id) => id === 'group',
                            __tmGetActiveDocTabCustomGroupDocIdSet: (id) => new Set(id === 'group' ? ['doc', 'doc2', 'doc3'] : []),
                            __tmIsAllRuleLike: () => true,
                            __tmHasActiveDocTabContentFilter: () => false,
                            __tmRuleIncludesCanceledStatus: () => false,
                            __tmIsTaskCanceled: () => false,
                            __tmIsCollectedOtherBlockTask: () => false,
                            __tmApplyWhiteboardSequenceFilter: (tasks) => tasks,
                            __tmUpdateFilteredTaskRenderWindowState: () => {},
                        });
                    }, { scope, inline });
                    await page.addScriptTag({ content: filterCode });
                    const result = await page.evaluate(() => {
                        applyFilters();
                        mount();
                        return {
                            filtered: state.filteredTasks.map((task) => task.id),
                            cards: Array.from(column('status:done').querySelectorAll('.tm-kanban-card'), (card) => card.dataset.id),
                            activeTabs: state.filteredDocIdsForTabs,
                        };
                    });
                    assert.deepEqual(result.filtered, ['active', 'auto-done']);
                    assert.deepEqual(result.cards, ['auto-done']);
                    assert.deepEqual(result.activeTabs, ['doc']);
                    const toggled = await page.evaluate(() => {
                        state.showCompletedTasks = false;
                        applyFilters();
                        mount();
                        const hidden = Array.from(state.modal.querySelectorAll('.tm-kanban-card'), (card) => card.dataset.id);
                        state.showCompletedTasks = true;
                        applyFilters();
                        mount();
                        const restored = Array.from(column('status:done').querySelectorAll('.tm-kanban-card'), (card) => card.dataset.id);
                        __tmTaskStore.applyMutation({ type: 'taskPatch', phase: 'optimistic', opId: 'complete-last-active',
                            taskId: 'active', patch: { done: true, customStatus: 'done' } });
                        applyFilters();
                        mount();
                        const completed = Array.from(column('status:done').querySelectorAll('.tm-kanban-card'), (card) => card.dataset.id);
                        return { hidden, restored, completed };
                    });
                    assert.deepEqual(toggled.hidden, ['active']);
                    assert.deepEqual(toggled.restored, ['auto-done']);
                    assert.deepEqual(toggled.completed, ['active', 'auto-done']);
                });
            }
        }
        for (const inline of [false, true]) {
            await run(`completed status cards remain visible with inline grouping ${inline}`, async (page) => {
                const result = await page.evaluate((inline) => {
                    SettingsStore.data.completedTasksInlineInGroups = inline;
                    SettingsStore.data.kanbanShowDoneColumn = true;
                    __tmGetStatusOptions = () => [
                        { id: 'todo', name: '待办', marker: ' ', color: '#777777' },
                        { id: 'finish-custom', name: '已完成1', marker: 'X', color: '#777777' },
                    ];
                    __tmDoesStatusIdResolveToDone = (id) => id === 'finish-custom';
                    setModel([
                        { id: 'active' },
                        { id: 'completed-parent', done: true, customStatus: 'finish-custom' },
                        { id: 'completed-child', done: true, customStatus: 'finish-custom', parentTaskId: 'completed-parent' },
                        { id: 'completed-other-doc', root_id: 'doc2', done: true, customStatus: 'finish-custom' },
                    ]);
                    // A completed status column must use the filtered task scope,
                    // including documents that are automatically archived in tabs.
                    __tmDocShouldShowInDocTabs = (doc) => doc.id === 'doc2';
                    mount();
                    const doneCol = column('status:finish-custom');
                    const cards = Array.from(doneCol.querySelectorAll('.tm-kanban-card'));
                    const before = cards.map((card) => ({ id: card.dataset.id, visible: !card.closest('[hidden]') }));
                    __tmTaskStore.applyMutation({ type: 'taskPatch', phase: 'optimistic', opId: 'complete-root',
                        taskId: 'active', patch: { done: true, customStatus: 'finish-custom' } });
                    const refreshed = patch(['active']);
                    return { before, child: placement('completed-child'),
                        completedGroups: doneCol.querySelectorAll('[data-group-key^="completed_root_tasks"]').length,
                        refreshed, moved: placement('active'), movedVisible: !state.modal.querySelector('[data-id="active"]').closest('[hidden]') };
                }, inline);
                assert.deepEqual(result.before, [
                    { id: 'completed-parent', visible: true },
                    { id: 'completed-child', visible: true },
                    { id: 'completed-other-doc', visible: true },
                ]);
                assert.equal(result.completedGroups, 0);
                assert.deepEqual(result.child, [{ column: 'status:finish-custom', parent: 'completed-parent' }]);
                assert.equal(result.refreshed, true);
                assert.deepEqual(result.moved, [{ column: 'status:finish-custom', parent: '' }]);
                assert.equal(result.movedVisible, true);
            });
        }
        for (const mode of ['status', 'heading', 'time']) {
            await run(`completed column preserves task hierarchy and recent root order (${mode})`, async (page) => {
                await page.evaluate((mode) => {
                    window.boardMode = mode;
                    SettingsStore.data.completedTasksInlineInGroups = false;
                    SettingsStore.data.kanbanShowDoneColumn = true;
                    const collapsed = state.__tmKanbanCollapsedIds = new Set();
                    __tmKanbanGetCollapsedSet = () => collapsed;
                    __tmResolveTaskCompletedAtRaw = (task) => task.taskCompleteAt;
                    __tmParseTimeToTs = (value) => Date.parse(value);
                    setModel([
                        { id: 'active' },
                        { id: 'child-second', parentTaskId: 'parent', done: true, customStatus: 'done', taskCompleteAt: '2026-09-28' },
                        { id: 'grandchild', parentTaskId: 'child-first', done: true, customStatus: 'done', taskCompleteAt: '2026-09-29' },
                        { id: 'old-root', done: true, customStatus: 'done', taskCompleteAt: '2026-09-24' },
                        { id: 'child-first', parentTaskId: 'parent', done: true, customStatus: 'done', taskCompleteAt: '2026-09-27' },
                        { id: 'parent', done: true, customStatus: 'done', taskCompleteAt: '2026-09-26', pinned: true },
                        { id: 'orphan', parentTaskId: 'active', done: true, customStatus: 'done', taskCompleteAt: '2026-09-25' },
                    ]);
                    const key = mode === 'status' ? 'status:done' : 'done:' + mode;
                    window.completedSnapshot = () => {
                        const col = column(key);
                        const cards = Array.from(col.querySelectorAll('.tm-kanban-card'));
                        return {
                            cards: cards.map((card) => ({ id: card.dataset.id,
                                parent: card.parentElement.closest('.tm-kanban-card')?.dataset.id || '' })),
                            roots: cards.filter((card) => !card.parentElement.closest('.tm-kanban-card')).map((card) => card.dataset.id),
                            count: Number(col.querySelector('.tm-kanban-col-header .tm-badge--count').textContent),
                        };
                    };
                }, mode);
                await page.addScriptTag({ content: section(completionRuntime,
                    'function __tmGetTaskDoneSortTs(', 'function __tmShouldShowTaskInCompletedRootGroup(') });
                const initial = await page.evaluate(() => { mount(); return completedSnapshot(); });
                assert.deepEqual(initial, {
                    cards: [
                        { id: 'parent', parent: '' },
                        { id: 'child-second', parent: 'parent' },
                        { id: 'child-first', parent: 'parent' },
                        { id: 'grandchild', parent: 'child-first' },
                        { id: 'orphan', parent: '' },
                        { id: 'old-root', parent: '' },
                    ],
                    roots: ['parent', 'orphan', 'old-root'], count: 3,
                });
                const collapsed = await page.evaluate(() => {
                    __tmKanbanGetCollapsedSet().add('parent');
                    commitView();
                    const parent = state.modal.querySelector('[data-id="parent"]');
                    const hidden = ['child-second', 'child-first', 'grandchild'].map((id) =>
                        !!state.modal.querySelector('[data-id="' + id + '"]').closest('[hidden]'));
                    return { expanded: parent.querySelector('[data-tm-kanban-collapse-owner]').getAttribute('aria-expanded'), hidden };
                });
                assert.deepEqual(collapsed, { expanded: 'false', hidden: [true, true, true] });
                const moved = await page.evaluate(() => {
                    __tmKanbanGetCollapsedSet().delete('parent');
                    __tmTaskStore.applyMutation({ type: 'taskPatch', phase: 'optimistic', opId: 'restore-completed-child',
                        taskId: 'child-first', patch: { done: false, customStatus: 'todo' } });
                    const refreshed = patch(['child-first'], ['parent']);
                    const afterRestore = completedSnapshot();
                    __tmTaskStore.applyMutation({ type: 'taskPatch', phase: 'optimistic', opId: 'recomplete-child',
                        taskId: 'child-first', patch: { done: true, customStatus: 'done', taskCompleteAt: '2026-09-30' } });
                    const completed = patch(['child-first'], ['parent']);
                    const afterComplete = completedSnapshot();
                    commitView();
                    return { refreshed, completed, afterRestore, afterComplete, afterFullRender: completedSnapshot() };
                });
                assert.equal(moved.refreshed, true);
                assert.equal(moved.completed, true);
                assert.deepEqual(moved.afterRestore, initial,
                    'reopening a child must preserve its position within the completed parent tree');
                assert.deepEqual(moved.afterComplete, initial);
                assert.deepEqual(moved.afterFullRender, initial);
                const attached = await page.evaluate(() => {
                    SettingsStore.data.kanbanPreventSubtaskSeparation = true;
                    commitView();
                    return completedSnapshot();
                });
                assert.deepEqual(attached, { cards: initial.cards.filter((card) => card.id !== 'orphan'),
                    roots: ['parent', 'old-root'], count: 2 });
            });
        }
        for (const mode of ['status', 'heading', 'time']) {
            await run(`completed column filters roots and keeps their full visible subtree (${mode})`, async (page) => {
                const result = await page.evaluate((mode) => {
                    window.boardMode = mode;
                    SettingsStore.data.completedTasksInlineInGroups = false;
                    SettingsStore.data.kanbanShowDoneColumn = true;
                    SettingsStore.data.completedTasksTodayOnly = true;
                    __tmGetStatusOptions = () => ['todo', 'doing', 'done', 'done-other'].map((id) => ({ id, name: id, color: '#777777' }));
                    __tmDoesStatusIdResolveToDone = (id) => id === 'done' || id === 'done-other';
                    setModel([
                        { id: 'active' },
                        { id: 'old-root', done: true, customStatus: 'done', taskCompleteAt: '2026-09-25' },
                        { id: 'old-child-today', parentTaskId: 'old-root', done: true, customStatus: 'done', taskCompleteAt: '2026-09-26' },
                        { id: 'today-root', done: true, customStatus: 'done', taskCompleteAt: '2026-09-26' },
                        { id: 'earlier-child', parentTaskId: 'today-root', done: true, customStatus: 'done-other', taskCompleteAt: '2026-09-25' },
                        { id: 'unfinished-child', parentTaskId: 'today-root', customStatus: 'doing' },
                        { id: 'nested-leaf', parentTaskId: 'unfinished-child', done: true, customStatus: 'done', taskCompleteAt: '2026-09-25' },
                        { id: 'standalone', parentTaskId: 'active', done: true, customStatus: 'done', taskCompleteAt: '2026-09-26' },
                    ]);
                    const key = mode === 'status' ? 'status:done' : 'done:' + mode;
                    const snapshot = () => ({
                        cards: Array.from(column(key).querySelectorAll('.tm-kanban-card'), (card) => ({ id: card.dataset.id,
                            parent: card.parentElement.closest('.tm-kanban-card')?.dataset.id || '' })),
                        count: Number(column(key).querySelector('.tm-kanban-col-header .tm-badge--count').textContent),
                        oldCards: placement('old-root').length + placement('old-child-today').length,
                    });
                    mount();
                    const before = snapshot();
                    __tmTaskStore.applyMutation({ type: 'taskPatch', phase: 'optimistic', opId: 'edit-completed-subtree',
                        taskId: 'unfinished-child', patch: { content: 'updated child' } });
                    const refreshed = patch(['unfinished-child'], ['today-root']);
                    const afterPatch = snapshot();
                    const title = state.modal.querySelector('[data-id="unfinished-child"] > span')?.textContent;
                    commitView();
                    const afterFullRender = snapshot();
                    SettingsStore.data.completedTasksTodayOnly = false;
                    commitView();
                    const placements = () => Object.fromEntries(state.filteredTasks.map((task) => [task.id, placement(task.id)]));
                    __tmTaskStore.applyMutation({ type: 'taskPatch', phase: 'optimistic', opId: 'reopen-completed-root',
                        taskId: 'today-root', patch: { done: false, customStatus: 'todo' } });
                    const rootRestored = patch(['today-root']);
                    const afterRootRestore = placements();
                    commitView();
                    const afterRootRestoreFullRender = placements();
                    __tmTaskStore.applyMutation({ type: 'taskPatch', phase: 'optimistic', opId: 'complete-root-again',
                        taskId: 'today-root', patch: { done: true, customStatus: 'done' } });
                    const rootCompleted = patch(['today-root']);
                    const afterRootComplete = placements();
                    commitView();
                    return { before, refreshed, afterPatch, title, afterFullRender, rootRestored,
                        afterRootRestore, afterRootRestoreFullRender, rootCompleted,
                        afterRootComplete, afterRootCompleteFullRender: placements() };
                }, mode);
                const expected = { cards: [
                    { id: 'today-root', parent: '' },
                    { id: 'earlier-child', parent: 'today-root' },
                    { id: 'unfinished-child', parent: 'today-root' },
                    { id: 'nested-leaf', parent: 'unfinished-child' },
                    { id: 'standalone', parent: '' },
                ], count: 2, oldCards: 0 };
                assert.deepEqual(result.before, expected);
                assert.equal(result.refreshed, true);
                assert.deepEqual(result.afterPatch, expected);
                assert.equal(result.title, 'updated child');
                assert.deepEqual(result.afterFullRender, expected);
                assert.equal(result.rootRestored, true);
                assert.deepEqual(result.afterRootRestore, result.afterRootRestoreFullRender,
                    'reopening a completed root must refresh all descendant destination columns');
                assert.equal(result.rootCompleted, true);
                assert.deepEqual(result.afterRootComplete, result.afterRootCompleteFullRender,
                    'completing a root must remove separated descendants from their previous columns');
            });
        }
        await run('completed status columns retain today-only and hide-completed filters', async (page) => {
            const result = await page.evaluate(() => {
                SettingsStore.data.completedTasksInlineInGroups = false;
                SettingsStore.data.completedTasksTodayOnly = true;
                setModel([
                    { id: 'active' },
                    { id: 'today', done: true, customStatus: 'done', taskCompleteAt: '2026-09-26' },
                    { id: 'earlier', done: true, customStatus: 'done', taskCompleteAt: '2026-09-25' },
                ]);
                mount();
                const ids = Array.from(column('status:done').querySelectorAll('.tm-kanban-card'), (card) => card.dataset.id);
                state.showCompletedTasks = false;
                __tmKanbanColsHtmlCache = null;
                commitView();
                return { ids, hiddenCount: column('status:done').querySelectorAll('.tm-kanban-card').length };
            });
            assert.deepEqual(result, { ids: ['today'], hiddenCount: 0 });
        });
        await run('unfinished status columns retain their collapsed completed tail group', async (page) => {
            const result = await page.evaluate(() => {
                SettingsStore.data.completedTasksInlineInGroups = false;
                setModel([{ id: 'active' }, { id: 'closed-in-todo', done: true }]);
                mount();
                const task = state.modal.querySelector('[data-id="closed-in-todo"]');
                return { column: task.closest('.tm-kanban-col').dataset.colKey,
                    hiddenByGroup: !!task.closest('[data-tm-kanban-group-items][hidden]'),
                    completedGroupCount: column('status:todo').querySelectorAll('[data-group-key^="completed_root_tasks"]').length };
            });
            assert.deepEqual(result, { column: 'status:todo', hiddenByGroup: true, completedGroupCount: 1 });
        });
        await run('all rule fields preserve attached subtasks through local edits', async (page) => {
            await page.evaluate(() => {
                SettingsStore.data.kanbanPreventSubtaskSeparation = true;
                SettingsStore.data.customStatusOptions = [{ id: 'todo', name: '待办' }, { id: 'doing', name: '进行中' }];
                Object.assign(window, {
                    __tmGetCurrentRule: () => state.rule,
                    __tmParseVersionNumber: (value) => Number(value) || 0,
                    __tmGetCustomFieldDefs: () => ['text', 'single', 'multi'].map((type) => ({ id: type, name: type, type,
                        options: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] })),
                    __tmBuildCustomFieldColumnKey: (id) => 'customField:' + id,
                    __tmParseCustomFieldColumnKey: (key) => key.startsWith('customField:') ? key.slice(12) : '',
                    __tmGetTaskCustomFieldValue: (task, id) => task.customFieldValues?.[id] ?? '',
                    __tmEnsureTaskPriorityScore: (task) => Number(task.priorityScore || 0),
                    __tmGetTaskTomatoEstimateCount: (task) => Number(task.tomatoEstimateCount || 0),
                    __tmGetTaskTomatoCount: (task) => Number(task.tomatoCount || 0),
                    __tmParseTimeToTs: (value) => Date.parse(value) || 0,
                    __tmRuleUsesCustomOrderSort: () => false,
                    __tmGetArchiveModeFilterRule: (rule) => rule,
                    __tmParseDocTabCustomGroupActiveId: () => '',
                    __tmGetActiveDocTabCustomGroupDocIdSet: () => new Set(),
                    __tmIsAllRuleLike: () => false,
                    __tmHasActiveDocTabContentFilter: () => true,
                    __tmIsCollectedOtherBlockTask: () => false,
                    __tmApplyWhiteboardSequenceFilter: (tasks) => tasks,
                    __tmUpdateFilteredTaskRenderWindowState: () => {},
                    __tmGetKanbanExpectedProjectionGroupKeys: () => [],
                    __tmUpdateTaskDoneInDOM: () => true,
                    __tmSyncTaskCardMetaChipsInDOM: () => true,
                    __tmSyncKanbanCompletedTodayBadgeInDOM: () => {},
                    __tmScheduleViewRefresh: (options) => {
                        if (!patch(options.taskIds, ['parent'])) throw new Error('automatic column refresh failed');
                    },
                });
            });
            await page.addScriptTag({ content: section(read('10-stores-rules-and-cache.js'),
                'const RuleManager = {', '    const __tmTasksQueryCache') });
            await page.addScriptTag({ content: filterCode + '\n' + read('35-task-projection-service.js') + '\n'
                + section(completionRuntime, 'const __tmOptimisticProjectionFramePending =', 'function __tmCollectChecklistProjectionDomBlock(')
                + section(completionRuntime, 'function __tmSyncKanbanProjectionCounts(', 'function __tmGetKanbanTaskProjectionGroupSignature(')
                + section(completionRuntime, 'function __tmTryApplyKanbanOptimisticProjectionInPlace(', 'function __tmRefreshKanbanProjectionPatchNow(') });
            const results = await page.evaluate(async () => {
                __tmDocShouldShowInDocTabs = () => true;
                __tmShouldIncludeDocInActiveAggregateTaskScope = () => true;
                const visible = () => Array.from(state.modal.querySelectorAll('.tm-kanban-card'))
                    .filter((card) => !card.closest('[hidden]')).map((card) => card.dataset.id);
                const snapshots = [];
                for (const field of RuleManager.getAvailableFields()) {
                    let match = 'match', miss = 'miss', operator = '=';
                    if (field.type === 'boolean') { match = field.value !== 'done'; miss = !match; }
                    else if (field.type === 'number') { match = 10; miss = 1; }
                    else if (field.type === 'datetime') { match = '2026-10-15'; miss = '2026-11-20'; operator = 'before'; }
                    else if (field.type === 'select') { match = field.options[0]; miss = field.options[1]; }
                    const fieldPatch = (value) => field.customFieldId
                        ? { customFieldValues: { [field.customFieldId]: field.multi ? [value] : value } }
                        : { [field.value === 'taskDate' ? 'completionTime' : field.value]: value };
                    setModel([
                        { id: 'parent', ...fieldPatch(match) },
                        { id: 'child', parentTaskId: 'parent', ...fieldPatch(miss) },
                        { id: 'grandchild', parentTaskId: 'child', ...fieldPatch(miss) },
                        { id: 'unrelated', ...fieldPatch(miss) },
                    ]);
                    state.rule = { id: 'field-' + field.value, conditions: [{ field: field.value, operator,
                        value: field.type === 'datetime' ? '2026-10-20' : match }] };
                    applyFilters();
                    if (state.filteredTasks.map((task) => task.id).join() !== 'parent') throw new Error(field.value + ': fixture must match only the parent');
                    mount();
                    const initial = visible();
                    for (const taskId of ['child', 'grandchild']) {
                        const edit = fieldPatch(miss);
                        for (const phase of ['optimistic', 'commit']) {
                            __tmTaskStore.applyMutation({ type: 'taskPatch', phase, opId: field.value + '-' + taskId, taskId, patch: edit });
                            __tmScheduleOptimisticProjectionFrame('kanban', taskId, edit);
                            await new Promise((resolve) => requestAnimationFrame(resolve));
                            if (visible().join() !== initial.join()) throw new Error(field.value + ': ' + taskId + ' disappeared after ' + phase);
                        }
                    }
                    commitView();
                    snapshots.push({ field: field.value, initial, afterFullRender: visible() });
                }
                state.searchKeyword = state.flatTasks.parent.content;
                __tmTaskMatchesSearch = (task, keyword) => task.content.includes(keyword);
                __tmScheduleOptimisticProjectionFrame('kanban', 'child', { remark: 'search edit' });
                await new Promise((resolve) => requestAnimationFrame(resolve));
                return { snapshots, searched: visible() };
            });
            assert.equal(results.snapshots.length, 21, 'cover every built-in and custom field');
            for (const snapshot of results.snapshots) {
                assert.deepEqual(snapshot.initial, ['parent', 'child', 'grandchild'], snapshot.field);
                assert.deepEqual(snapshot.afterFullRender, snapshot.initial, snapshot.field + ': local and full rendering must agree');
            }
            assert.deepEqual(results.searched, ['parent'], 'search must not inject nonmatching descendants');
        });
        await run('last task leaving a dynamic column or group removes its shell without manual refresh', async (page) => {
            await page.addScriptTag({ content:
                section(completionRuntime, 'const __tmOptimisticProjectionFramePending =', 'function __tmCollectChecklistProjectionDomBlock(')
                + section(completionRuntime, 'function __tmGetKanbanProjectionColumnId(', 'function __tmSyncKanbanCompletedTodayBadgeInDOM(')
                + section(completionRuntime, 'function __tmFindKanbanNormalProjectionContainer(', 'function __tmRefreshKanbanProjectionPatchNow(') });
            const results = await page.evaluate(async () => {
                Object.assign(window, {
                    __tmTaskStateKernel: { getTask: (id) => __tmTaskStore.getProjected(id) },
                    __tmRecomputeTaskProjection: () => {},
                    __tmUpdateTaskDoneInDOM: () => {},
                    __tmSyncTaskCardMetaChipsInDOM: () => {},
                    __tmSyncKanbanCompletedTodayBadgeInDOM: () => {},
                    __tmScheduleViewRefresh: ({ taskIds }) => { if (!patch(taskIds)) mount(); },
                });
                const results = [];
                for (const mode of ['time', 'heading', 'status']) {
                    for (const action of ['filter', 'move', 'regroup', 'delete']) {
                        for (const grouped of [false, true]) {
                            if (action === 'regroup' && !grouped) continue;
                            boardMode = mode;
                            state.groupByTaskName = grouped;
                            const last = { id: 'last', content: 'source', days: 0, root_id: 'doc', docId: 'doc' };
                            const kept = { id: 'kept', content: 'destination', days: 1, customStatus: 'doing', root_id: 'doc2', docId: 'doc2' };
                            if (action === 'regroup') Object.assign(kept, { days: 0, customStatus: 'todo', root_id: 'doc', docId: 'doc' });
                            setModel([last, kept]); mount();
                            const source = state.modal.querySelector('[data-id="last"]').closest('.tm-kanban-col');
                            const sourceKey = source.dataset.colKey;
                            const sourceGroupKey = state.modal.querySelector('[data-id="last"]').closest('.tm-kanban-group')?.querySelector('[data-group-key]')?.dataset.groupKey;
                            const destinationKey = state.modal.querySelector('[data-id="kept"]').closest('.tm-kanban-col').dataset.colKey;
                            const destinationCard = state.modal.querySelector('[data-id="kept"]');
                            const edit = action === 'filter' ? { priority: 'low' } : action === 'regroup' ? { content: 'destination' }
                                : { content: 'destination', days: 1, customStatus: 'doing', root_id: 'doc2', docId: 'doc2' };
                            if (action === 'delete') __tmRemoveTaskDomNodes('last');
                            setModel(action === 'delete' ? [kept] : [{ ...last, ...edit }, kept]);
                            if (action === 'filter') state.filteredTasks = state.filteredTasks.filter((task) => task.id !== 'last');
                            __tmScheduleOptimisticProjectionFrame('kanban', 'last', edit);
                            await new Promise((resolve) => requestAnimationFrame(resolve));
                            const after = {
                                columns: Array.from(state.modal.querySelectorAll('.tm-kanban-col'), (col) => col.dataset.colKey),
                                groups: Array.from(state.modal.querySelectorAll('[data-group-key]'), (group) => group.dataset.groupKey),
                                cards: Array.from(state.modal.querySelectorAll('.tm-kanban-card')).filter((card) => !card.closest('[hidden]')).map((card) => card.dataset.id),
                            };
                            const destinationRetained = destinationCard === state.modal.querySelector('[data-id="kept"]');
                            mount();
                            const expected = {
                                columns: Array.from(state.modal.querySelectorAll('.tm-kanban-col'), (col) => col.dataset.colKey),
                                groups: Array.from(state.modal.querySelectorAll('[data-group-key]'), (group) => group.dataset.groupKey),
                                cards: Array.from(state.modal.querySelectorAll('.tm-kanban-card')).filter((card) => !card.closest('[hidden]')).map((card) => card.dataset.id),
                            };
                            results.push({ mode, action, grouped, sourceKey, sourceGroupKey, destinationKey, destinationRetained, after, expected });
                        }
                    }
                }
                return results;
            });
            for (const result of results) {
                assert.deepEqual(result.after, result.expected, JSON.stringify(result));
                assert.ok(result.after.columns.includes(result.destinationKey));
                if (result.mode === 'status') {
                    assert.ok(result.after.columns.includes(result.sourceKey), 'configured status columns stay available');
                    assert.equal(result.destinationRetained, true, 'unaffected cards retain their DOM nodes');
                } else if (result.action !== 'regroup') {
                    assert.ok(!result.after.columns.includes(result.sourceKey), 'empty dynamic columns disappear');
                }
                if (result.grouped) assert.ok(!result.after.groups.includes(result.sourceGroupKey), 'empty inner groups disappear');
            }
        });
        await run('subtask status survives a later full render with the same filtered parent', async (page) => {
            const result = await page.evaluate(() => {
                SettingsStore.data.kanbanPreventSubtaskSeparation = true;
                setModel([{ id: 'parent' }, { id: 'child', parentTaskId: 'parent' }]);
                state.filteredTasks = [state.flatTasks.parent];
                mount();
                const filtered = state.filteredTasks;
                const readChild = () => {
                    const card = state.modal.querySelector('[data-id="child"]');
                    return { done: card.dataset.done, status: card.dataset.status };
                };
                const initial = readChild();
                const beforeKey = __tmBuildKanbanColsCacheKey();
                __tmTaskStore.applyMutation({ type: 'taskPatch', phase: 'optimistic', opId: 'complete-child',
                    taskId: 'child', patch: { done: true, customStatus: 'done' } });
                const afterKey = __tmBuildKanbanColsCacheKey();
                // Model the successful local DOM patch before a later redraw.
                const liveCard = state.modal.querySelector('[data-id="child"]');
                liveCard.dataset.done = 'true'; liveCard.dataset.status = 'done';
                commitView();
                const completed = readChild();
                __tmTaskStore.applyMutation({ type: 'taskPatch', phase: 'commit', opId: 'complete-child',
                    taskId: 'child', patch: { done: true, customStatus: 'done' } });
                __tmTaskStore.applyMutation({ type: 'taskPatch', phase: 'optimistic', opId: 'restore-child',
                    taskId: 'child', patch: { done: false, customStatus: 'todo' } });
                commitView();
                const restored = readChild();
                return { initial, completed, restored, cacheInvalidated: beforeKey !== afterKey,
                    sameFiltered: filtered === state.filteredTasks, childCount: state.flatTasks.parent.children.length };
            });
            assert.deepEqual(result, { initial: { done: 'false', status: 'todo' },
                completed: { done: 'true', status: 'done' }, restored: { done: 'false', status: 'todo' },
                cacheInvalidated: true, sameFiltered: true, childCount: 1 });
        });
        for (const initialDone of [false, true]) {
            await run(`column refresh uses pending completion instead of the stale flat mirror (${initialDone})`, async (page) => {
                const result = await page.evaluate((done) => {
                    setModel([{ id: 'parent' }, { id: 'child', parentTaskId: 'parent', done,
                        customStatus: done ? 'done' : 'todo', taskMarker: done ? 'X' : ' ' }]);
                    mount();
                    const newStatus = done ? 'todo' : 'done';
                    const patchData = { done: !done, customStatus: newStatus, taskMarker: done ? ' ' : 'X' };
                    const mutation = { type: 'taskPatch', opId: 'pending-completion', taskId: 'child', patch: patchData };
                    __tmTaskStore.applyMutation({ ...mutation, phase: 'optimistic' }, { applyLocal: false });
                    const flatDone = state.flatTasks.child.done;
                    const pendingDone = __tmTaskStore.getProjected('child').done;
                    const refreshed = patch(['child'], ['parent']);
                    const card = state.modal.querySelector('[data-id="child"]');
                    const rendered = { done: card.dataset.done, status: card.dataset.status };
                    const indexDone = state.__tmKanbanRenderIndexCache.projectedById.get('child').done;
                    __tmTaskStore.applyMutation({ ...mutation, phase: 'commit' }, { applyLocal: false });
                    commitView();
                    const afterCommit = state.modal.querySelector('[data-id="child"]');
                    const committed = { done: afterCommit.dataset.done, status: afterCommit.dataset.status };
                    // A later SQL/visibility refresh can retain an older flat receipt.
                    state.flatTasks.child = { ...state.flatTasks.child, done,
                        customStatus: done ? 'done' : 'todo', taskMarker: done ? 'X' : ' ' };
                    state.filteredTasks = Object.values(state.flatTasks);
                    commitView();
                    const afterReadback = state.modal.querySelector('[data-id="child"]');
                    return { flatDone, pendingDone, refreshed, rendered, indexDone,
                        committed, afterReadback: { done: afterReadback.dataset.done, status: afterReadback.dataset.status } };
                }, initialDone);
                const expected = { done: String(!initialDone), status: initialDone ? 'todo' : 'done' };
                assert.deepEqual(result, { flatDone: initialDone, pendingDone: !initialDone, refreshed: true,
                    rendered: expected, indexDone: !initialDone, committed: expected, afterReadback: expected });
            });
        }
        for (const mobile of [false, true]) {
            await run(`outdent updates one column; later confirmation preserves placement (${mobile})`, async (page) => {
                const result = await page.evaluate(() => {
                    const other = Array.from({ length: 20 }, (_, i) => ({ id: 'other-' + i, customStatus: 'doing' }));
                    setModel([{ id: 'parent' }, { id: 'child', parentTaskId: 'parent' }, ...other]); mount();
                    const body = state.modal.querySelector('.tm-body');
                    const untouched = column('status:doing');
                    const card = untouched.querySelector('.tm-kanban-card');
                    const scroll = untouched.querySelector('.tm-kanban-col-body'); scroll.scrollTop = 170;
                    const detail = document.createElement('aside'); detail.id = 'tmKanbanDetailPanel'; body.append(detail);
                    setModel([{ id: 'parent' }, { id: 'child' }, ...other]);
                    state.kanbanDetailTaskId = 'child';
                    const ok = patch(['child'], ['parent']);
                    const rendered = renderedTaskIds.slice();
                    const first = placement('child');
                    const moved = column('status:todo');
                    const again = patch(['child'], ['parent']);
                    return { ok, again, rendered, first, later: placement('child'),
                        sameMoved: moved === column('status:todo'),
                        sameColumn: untouched === column('status:doing'), sameCard: card === untouched.querySelector('.tm-kanban-card'),
                        sameBody: body === state.modal.querySelector('.tm-body'), sameDetail: detail === document.querySelector('#tmKanbanDetailPanel'),
                        scroll: scroll.scrollTop };
                });
                assert.equal(result.ok, true); assert.equal(result.again, true);
                assert.deepEqual(new Set(result.rendered), new Set(['parent', 'child']));
                assert.deepEqual(result.first, [{ column: 'status:todo', parent: '' }]);
                assert.deepEqual(result.later, result.first);
                for (const key of ['sameMoved', 'sameColumn', 'sameCard', 'sameBody', 'sameDetail']) assert.equal(result[key], true, key);
                assert.equal(result.scroll, 170);
            }, mobile);
        }
        await run('cross-column nesting updates both columns, retains third column', async (page) => {
            const result = await page.evaluate(() => {
                SettingsStore.data.kanbanPreventSubtaskSeparation = true;
                const rows = [{ id: 'a' }, { id: 'child', parentTaskId: 'a' }, { id: 'b', customStatus: 'doing' }, { id: 'c', customStatus: 'done' }];
                setModel(rows); mount(); const untouched = column('status:done');
                setModel(rows.map((t) => t.id === 'child' ? { ...t, parentTaskId: 'b' } : t));
                const ok = patch(['child'], ['a', 'b']);
                return { ok, rendered: renderedTaskIds.slice(), child: placement('child'), same: untouched === column('status:done') };
            });
            assert.equal(result.ok, true); assert.equal(result.same, true);
            assert.deepEqual(result.child, [{ column: 'status:doing', parent: 'b' }]);
            assert.deepEqual(new Set(result.rendered), new Set(['a', 'child', 'b']));
        });
        await run('fresh title styles are retained while reused descendants clear stale today marks', async (page) => {
            const result = await page.evaluate(() => {
                const rows = [{ id: 'parent' }, { id: 'child', parentTaskId: 'parent' }, { id: 'other' }];
                setModel(rows); mount();
                const child = state.modal.querySelector('[data-id="child"]');
                child.querySelector('.tm-task-content-clickable').style.color = 'var(--tm-primary-color)';
                const updatedTitles = [];
                window.__tmHasTaskScheduledToday = (id) => id === 'new';
                window.__tmApplyTaskTitleOpacityToElement = (el, task) => {
                    updatedTitles.push(task.id); el.style.color = 'rgb(11, 22, 33)';
                };
                setModel(rows.map((task) => task.id === 'parent' ? { ...task, content: 'changed parent' } : task)
                    .concat({ id: 'new', parentTaskId: 'parent' }));
                const ok = patch(['parent', 'new']);
                const color = (id) => state.modal.querySelector('[data-id="' + id + '"] > .tm-task-content-clickable').style.color;
                return { ok, updatedTitles, sameChild: child === state.modal.querySelector('[data-id="child"]'),
                    parentColor: color('parent'), childColor: color('child'), newColor: color('new'),
                    newTodayMarked: state.modal.querySelector('[data-id="new"] > .tm-task-content-clickable').classList.contains('tm-task-scheduled-today') };
            });
            assert.equal(result.ok, true); assert.equal(result.sameChild, true);
            assert.deepEqual(result.updatedTitles, ['child']);
            assert.equal(result.parentColor, 'rgb(70, 70, 70)');
            assert.equal(result.childColor, 'rgb(11, 22, 33)');
            assert.equal(result.newColor, 'rgb(70, 70, 70)');
            assert.equal(result.newTodayMarked, true);
        });
        await run('document boards use real source and destination membership', async (page) => {
            const result = await page.evaluate(() => {
                boardMode = 'heading';
                const rows = [{ id: 'a' }, { id: 'child' }, { id: 'b', root_id: 'doc2', docId: 'doc2' }, { id: 'c', root_id: 'doc3', docId: 'doc3' }];
                setModel(rows); mount(); const untouched = column('doc:doc3');
                setModel(rows.map((t) => t.id === 'child' ? { ...t, root_id: 'doc2', docId: 'doc2' } : t));
                return { ok: patch(['child']), child: placement('child'), same: untouched === column('doc:doc3'), rendered: renderedTaskIds.slice() };
            });
            assert.equal(result.ok, true); assert.equal(result.same, true);
            assert.deepEqual(result.child, [{ column: 'doc:doc2', parent: '' }]);
            assert.deepEqual(new Set(result.rendered), new Set(['child']));
        });
        await run('outdent reuses unaffected branches inside the changed column', async (page) => {
            const result = await page.evaluate(() => {
                const others = Array.from({ length: 12 }, (_, i) => ({ id: 'same-column-' + i }));
                setModel([{ id: 'parent' }, { id: 'child', parentTaskId: 'parent' }, ...others]); mount();
                const beforeColumn = column('status:todo');
                const beforeBody = beforeColumn.querySelector('.tm-kanban-col-body');
                beforeBody.scrollTop = 130;
                const stable = others.map((task) => beforeColumn.querySelector(`[data-id="${task.id}"]`)).filter(Boolean);
                setModel([{ id: 'parent' }, { id: 'child' }, ...others]);
                const ok = patch(['child'], ['parent']);
                const rendered = renderedTaskIds.slice();
                const firstCount = beforeColumn.querySelectorAll('.tm-kanban-card').length;
                const echo = patch(['child'], ['parent']);
                return { ok, echo, rendered, sameColumn: beforeColumn === column('status:todo'),
                    sameBody: beforeBody === beforeColumn.querySelector('.tm-kanban-col-body'),
                    retained: stable.every((node) => node === beforeColumn.querySelector(`[data-id="${node.dataset.id}"]`)),
                    noGrowth: firstCount === beforeColumn.querySelectorAll('.tm-kanban-card').length,
                    placeholders: state.modal.querySelectorAll('[data-tm-kanban-reuse]').length,
                    scroll: beforeBody.scrollTop, child: placement('child') };
            });
            assert.deepEqual(new Set(result.rendered), new Set(['parent', 'child']));
            for (const key of ['ok', 'echo', 'sameColumn', 'sameBody', 'retained', 'noGrowth']) assert.equal(result[key], true, key);
            assert.equal(result.placeholders, 0); assert.equal(result.scroll, 130);
            assert.deepEqual(result.child, [{ column: 'status:todo', parent: '' }]);
        });
        await run('hidden completed task confirmations preserve the mobile board and lazy cards', async (page) => {
            const result = await page.evaluate(() => {
                boardMode = 'heading'; state.showCompletedTasks = false;
                setModel([{ id: 'hidden', done: true }, ...Array.from({ length: 35 }, (_, i) => ({ id: 'visible-' + i }))]); mount();
                __tmStartProgressiveViewRender('kanban'); state.modal.innerHTML = state.renderKanbanBodyHtml();
                const body = state.modal.querySelector('.tm-body--kanban');
                const first = state.modal.querySelector('[data-id="visible-0"]');
                const ok = patch(['hidden']);
                const entry = state.__tmProgressiveViewRender.columns.find((item) => item.key === 'doc:doc');
                const before = column('doc:doc').querySelectorAll('.tm-kanban-card').length;
                const load = entry.loadNextBatch(state.modal);
                return { ok, sameBody: body === state.modal.querySelector('.tm-body--kanban'), sameCard: first === state.modal.querySelector('[data-id="visible-0"]'),
                    hidden: placement('hidden').length, before, after: column('doc:doc').querySelectorAll('.tm-kanban-card').length, retry: load?.retry === true };
            });
            assert.deepEqual(result, { ok: true, sameBody: true, sameCard: true, hidden: 0, before: 10, after: 20, retry: false });
        }, true);
        await run('mixed visible and excluded task updates patch only mounted branches', async (page) => {
            const result = await page.evaluate(() => {
                state.showCompletedTasks = false;
                const rows = [{ id: 'visible' }, { id: 'hidden', done: true }, { id: 'other', customStatus: 'doing' }];
                setModel(rows); mount();
                const other = state.modal.querySelector('[data-id="other"]');
                const body = state.modal.querySelector('.tm-body--kanban');
                setModel(rows.map((task) => task.id === 'visible' ? { ...task, content: 'fresh' } : task));
                return { ok: patch(['visible', 'hidden']), title: state.modal.querySelector('[data-id="visible"] > span').textContent,
                    sameBody: body === state.modal.querySelector('.tm-body--kanban'), otherKept: other === state.modal.querySelector('[data-id="other"]') };
            });
            assert.deepEqual(result, { ok: true, title: 'fresh', sameBody: true, otherKept: true });
        });
        await run('a hidden completed task becoming visible still enters its destination', async (page) => {
            const result = await page.evaluate(() => {
                state.showCompletedTasks = false;
                setModel([{ id: 'visible' }, { id: 'hidden', done: true }]); mount();
                setModel([{ id: 'visible' }, { id: 'hidden', done: false }]);
                return { ok: patch(['hidden']), destination: placement('hidden') };
            });
            assert.deepEqual(result, { ok: true, destination: [{ column: 'status:todo', parent: '' }] });
        });
        await run('a hidden child completion still refreshes its visible parent summary', async (page) => {
            const result = await page.evaluate(() => {
                state.showCompletedTasks = false;
                setModel([{ id: 'parent' }, { id: 'child', parentTaskId: 'parent' }, { id: 'other', customStatus: 'doing' }]); mount();
                const other = state.modal.querySelector('[data-id="other"]');
                setModel([{ id: 'parent' }, { id: 'child', done: true, parentTaskId: 'parent' }, { id: 'other', customStatus: 'doing' }]);
                const ok = patch(['child']);
                return { ok, renderedParent: renderedTaskIds.includes('parent'), otherKept: other === state.modal.querySelector('[data-id="other"]') };
            });
            assert.deepEqual(result, { ok: true, renderedParent: true, otherKept: true });
        });
        await run('changed document-column layout declines before mutating DOM', async (page) => {
            const result = await page.evaluate(() => {
                boardMode = 'heading'; setModel([{ id: 'child' }, { id: 'b', root_id: 'doc2', docId: 'doc2' }]); mount();
                const before = state.modal.innerHTML;
                setModel([{ id: 'child', root_id: 'doc2', docId: 'doc2' }, { id: 'b', root_id: 'doc2', docId: 'doc2' }]);
                return { ok: patch(['child']), unchanged: state.modal.innerHTML === before };
            });
            assert.deepEqual(result, { ok: false, unchanged: true });
        });
        await run('document groups inside a status column retain unrelated cards and group containers', async (page) => {
            const result = await page.evaluate(() => {
                state.groupByDocName = true;
                const rows = [{ id: 'parent' }, { id: 'child', parentTaskId: 'parent' },
                    { id: 'other', root_id: 'doc2', docId: 'doc2' }];
                setModel(rows); mount();
                const before = state.modal.querySelector('[data-id="other"]');
                const group = before.closest('.tm-kanban-group');
                setModel(rows.map((task) => task.id === 'child' ? { ...task, parentTaskId: '' } : task));
                const ok = patch(['child'], ['parent']);
                const after = state.modal.querySelector('[data-id="other"]');
                return { ok, retainedCard: before === after, retainedGroup: group === after.closest('.tm-kanban-group'),
                    child: placement('child'), rendered: renderedTaskIds.slice() };
            });
            assert.equal(result.ok, true); assert.equal(result.retainedCard, true); assert.equal(result.retainedGroup, true);
            assert.deepEqual(result.child, [{ column: 'status:todo', parent: '' }]);
            assert.deepEqual(new Set(result.rendered), new Set(['parent', 'child']));
        });
        await run('nested outdent retains unchanged siblings inside a rebuilt parent branch', async (page) => {
            const result = await page.evaluate(() => {
                const rows = [{ id: 'grand' }, { id: 'parent', parentTaskId: 'grand' },
                    { id: 'child', parentTaskId: 'parent' }, { id: 'sibling', parentTaskId: 'grand' }];
                setModel(rows); mount();
                const sibling = state.modal.querySelector('[data-id="sibling"]');
                setModel(rows.map((task) => task.id === 'child' ? { ...task, parentTaskId: 'grand' } : task));
                const ok = patch(['child'], ['parent', 'grand']);
                return { ok, child: placement('child'), sameSibling: sibling === state.modal.querySelector('[data-id="sibling"]'),
                    rendered: renderedTaskIds.slice(), placeholders: state.modal.querySelectorAll('[data-tm-kanban-reuse]').length };
            });
            assert.equal(result.ok, true); assert.equal(result.sameSibling, true); assert.equal(result.placeholders, 0);
            assert.deepEqual(result.child, [{ column: 'status:todo', parent: 'grand' }]);
            assert.deepEqual(new Set(result.rendered), new Set(['grand', 'parent', 'child']));
        });
        await run('mixed WS block IDs update a task without replacing the board or unrelated cards', async (page) => {
            const result = await page.evaluate(() => {
                setModel([{ id: 'parent' }, { id: 'other', customStatus: 'doing' }]); mount();
                const body = state.modal.querySelector('.tm-body--kanban');
                const other = state.modal.querySelector('[data-id="other"]');
                setModel([{ id: 'parent' }, { id: 'child', parentTaskId: 'parent' }, { id: 'other', customStatus: 'doing' }]);
                const ids = __tmResolveKanbanRefreshTaskIds(['child', 'list-container', 'paragraph'], ['parent']);
                const ok = patch(ids);
                return { ok, ids, child: placement('child'), bodyKept: body === state.modal.querySelector('.tm-body--kanban'),
                    otherKept: other === state.modal.querySelector('[data-id="other"]') };
            });
            assert.deepEqual(result, { ok: true, ids: ['child', 'parent'], child: [{ column: 'status:todo', parent: 'parent' }],
                bodyKept: true, otherKept: true });
        });
        await run('a deleted child already removed by projection does not force a board replacement', async (page) => {
            const result = await page.evaluate(() => {
                setModel([{ id: 'parent' }, { id: 'child', parentTaskId: 'parent' }, { id: 'other' }]); mount();
                const body = state.modal.querySelector('.tm-body--kanban');
                const other = state.modal.querySelector('[data-id="other"]');
                state.modal.querySelector('[data-id="child"]').remove();
                setModel([{ id: 'parent' }, { id: 'other' }]);
                __tmTaskStore.markPendingDeleted('child');
                const ok = patch(['child', 'parent']);
                return { ok, children: placement('child').length, bodyKept: body === state.modal.querySelector('.tm-body--kanban'),
                    otherKept: other === state.modal.querySelector('[data-id="other"]') };
            });
            assert.deepEqual(result, { ok: true, children: 0, bodyKept: true, otherKept: true });
        });
        await run('optimistic top-level removal retains its source column for counts and keyed refresh', async (page) => {
            const result = await page.evaluate(() => {
                setModel([{ id: 'deleted' }, { id: 'sibling' }, { id: 'other', customStatus: 'doing' }]); mount();
                const body = state.modal.querySelector('.tm-body--kanban');
                const sibling = state.modal.querySelector('[data-id="sibling"]');
                const headerBefore = column('status:todo').querySelector('.tm-kanban-col-header').textContent;
                __tmRemoveTaskDomNodes('deleted');
                setModel([{ id: 'sibling' }, { id: 'other', customStatus: 'doing' }]);
                __tmTaskStore.markPendingDeleted('deleted');
                const ok = patch(['deleted']);
                return { ok, bodyKept: body === state.modal.querySelector('.tm-body--kanban'),
                    siblingKept: sibling === state.modal.querySelector('[data-id="sibling"]'),
                    deleted: placement('deleted').length,
                    countChanged: headerBefore !== column('status:todo').querySelector('.tm-kanban-col-header').textContent,
                    pendingRemovals: column('status:todo').__tmKanbanRemovedTasks.size };
            });
            assert.deepEqual(result, { ok: true, bodyKept: true, siblingKept: true, deleted: 0, countChanged: true, pendingRemovals: 0 });
        });
        await run('document-only confirmation updates affected cards while preserving other documents', async (page) => {
            const result = await page.evaluate(() => {
                setModel([{ id: 'changed' }, { id: 'deleted' }, { id: 'other', root_id: 'doc2', customStatus: 'doing' }]); mount();
                const body = state.modal.querySelector('.tm-body--kanban');
                const other = state.modal.querySelector('[data-id="other"]');
                setModel([{ id: 'changed', content: 'fresh title' }, { id: 'created' }, { id: 'other', root_id: 'doc2', customStatus: 'doing' }]);
                const ok = __tmTryRefreshKanbanColumns(state.modal, [], { docIds: ['doc'] });
                return { ok, bodyKept: body === state.modal.querySelector('.tm-body--kanban'),
                    otherKept: other === state.modal.querySelector('[data-id="other"]'),
                    title: state.modal.querySelector('[data-id="changed"] > span').textContent,
                    created: placement('created').length, deleted: placement('deleted').length };
            });
            assert.deepEqual(result, { ok: true, bodyKept: true, otherKept: true, title: 'fresh title', created: 1, deleted: 0 });
        });
        await run('document-only confirmation outside visible columns leaves the board unchanged', async (page) => {
            const result = await page.evaluate(() => {
                setModel([{ id: 'visible' }]); mount();
                const body = state.modal.querySelector('.tm-body--kanban');
                const card = state.modal.querySelector('[data-id="visible"]');
                const ok = __tmTryRefreshKanbanColumns(state.modal, [], { docIds: ['doc3'] });
                return { ok, bodyKept: body === state.modal.querySelector('.tm-body--kanban'),
                    cardKept: card === state.modal.querySelector('[data-id="visible"]') };
            });
            assert.deepEqual(result, { ok: true, bodyKept: true, cardKept: true });
        });
        await run('scroll-deferred refresh merges document scopes without losing updates', async (page) => {
            const result = await page.evaluate(() => {
                setModel([{ id: 'a' }, { id: 'b', root_id: 'doc2' }, { id: 'other', root_id: 'doc3' }]); mount();
                const other = state.modal.querySelector('[data-id="other"]');
                const gate = __tmGetViewScrollGate('kanban'); gate.scrolling = true;
                setModel([{ id: 'a', content: 'new a' }, { id: 'b', root_id: 'doc2', content: 'new b' }, { id: 'other', root_id: 'doc3' }]);
                const first = __tmTryRefreshKanbanColumns(state.modal, [], { docIds: ['doc'] });
                const second = __tmTryRefreshKanbanColumns(state.modal, [], { docIds: ['doc2'] });
                gate.scrolling = false;
                const flushed = __tmFlushViewDomCommit('kanban');
                return { first, second, flushed, otherKept: other === state.modal.querySelector('[data-id="other"]'),
                    a: state.modal.querySelector('[data-id="a"] > span').textContent,
                    b: state.modal.querySelector('[data-id="b"] > span').textContent };
            });
            assert.deepEqual(result, { first: true, second: true, flushed: true, otherKept: true, a: 'new a', b: 'new b' });
        });
        await run('scroll-deferred moves merge scopes and survive a later pagination request', async (page) => {
            const result = await page.evaluate(() => {
                const initial = [{ id: 'a' }, { id: 'one', parentTaskId: 'a' },
                    { id: 'b' }, { id: 'two', parentTaskId: 'b' }, { id: 'unrelated' }];
                setModel(initial); mount();
                const untouched = state.modal.querySelector('[data-id="unrelated"]');
                const gate = __tmGetViewScrollGate('kanban'); gate.scrolling = true;
                setModel(initial.map((task) => task.id === 'one' ? { ...task, parentTaskId: '' } : task));
                const first = patch(['one'], ['a']);
                setModel(initial.map((task) => ['one', 'two'].includes(task.id) ? { ...task, parentTaskId: '' } : task));
                const second = patch(['two'], ['b']);
                let pagerRan = false;
                __tmQueueViewDomCommit('kanban', () => { pagerRan = true; }, { priority: 0 });
                gate.scrolling = false;
                const flushed = __tmFlushViewDomCommit('kanban');
                return { first, second, flushed, pagerRan, one: placement('one'), two: placement('two'),
                    retained: untouched === state.modal.querySelector('[data-id="unrelated"]') };
            });
            assert.deepEqual(result, { first: true, second: true, flushed: true, pagerRan: false,
                one: [{ column: 'status:todo', parent: '' }], two: [{ column: 'status:todo', parent: '' }], retained: true });
        });
        await run('collapsed time groups retain their loaded cards after an unrelated move', async (page) => {
            const result = await page.evaluate(() => {
                boardMode = 'heading'; state.groupByTime = true;
                const rows = [{ id: 'parent' }, { id: 'child', parentTaskId: 'parent' },
                    ...Array.from({ length: 35 }, (_, i) => ({ id: 'folded-' + i, root_id: 'doc2', docId: 'doc2', days: 1 }))];
                setModel(rows); mount();
                const titles = Array.from(column('doc:doc2').querySelectorAll('.tm-kanban-group-title[data-group-key]'));
                state.collapsedGroups = new Set(titles.map((title) => title.dataset.groupKey)); mount();
                const untouched = column('doc:doc2');
                const first = untouched.querySelector('.tm-kanban-card');
                const before = untouched.querySelectorAll('.tm-kanban-card').length;
                state.modal.setAttribute('data-tm-render-mode', 'kanban');
                __tmRememberViewSwitchWindow('kanban');
                const saved = state.__tmViewSwitchWindows.get('kanban').columnLimits.get('doc:doc2');
                setModel(rows.map((task) => task.id === 'child' ? { ...task, parentTaskId: '' } : task));
                const ok = patch(['child'], ['parent']);
                const entry = state.__tmProgressiveViewRender.columns.find((item) => item.key === 'doc:doc2');
                const load = entry?.loadNextBatch(state.modal);
                return { ok, groups: titles.length, before, saved, after: untouched.querySelectorAll('.tm-kanban-card').length,
                    firstKept: first === untouched.querySelector('.tm-kanban-card'), done: load?.done === true };
            });
            assert.ok(result.groups > 0);
            assert.deepEqual({ ...result, groups: 1 }, { ok: true, groups: 1, before: 35, saved: 35, after: 35, firstKept: true, done: true });
        }, true);
        await run('untouched lazy column can still load after a structural change', async (page) => {
            const result = await page.evaluate(() => {
                const others = Array.from({ length: 35 }, (_, i) => ({ id: 'other-' + i, customStatus: 'doing' }));
                setModel([{ id: 'parent' }, { id: 'child', parentTaskId: 'parent' }, ...others]);
                __tmStartProgressiveViewRender('kanban');
                state.renderKanbanBodyHtml = (opts) => __tmBuildRenderSceneKanbanBodyHtml(opts);
                state.modal.innerHTML = state.renderKanbanBodyHtml();
                const untouched = column('status:doing'); const first = untouched.querySelector('.tm-kanban-card');
                const before = untouched.querySelectorAll('.tm-kanban-card').length;
                setModel([{ id: 'parent' }, { id: 'child' }, ...others]);
                const ok = patch(['child'], ['parent']);
                const afterPatch = untouched.querySelectorAll('.tm-kanban-card').length;
                const loader = state.__tmProgressiveViewRender.columns.find((entry) => entry.key === 'status:doing');
                const load = loader.loadNextBatch(state.modal);
                return { ok, before, afterPatch, afterLoad: untouched.querySelectorAll('.tm-kanban-card').length,
                    same: untouched === column('status:doing'), sameCard: first === untouched.querySelector('.tm-kanban-card'), load };
            });
            assert.equal(result.ok, true); assert.equal(result.same, true); assert.equal(result.sameCard, true);
            assert.equal(result.before, 10); assert.equal(result.afterPatch, 10); assert.equal(result.afterLoad, 20);
            assert.equal(result.load.done, false);
        });
        await run('mobile return restores column windows and scroll against current tasks', async (page) => {
            const result = await page.evaluate(() => {
                __tmIsMobileDevice = () => true;
                const rows = Array.from({ length: 70 }, (_, i) => ({ id: 'return-' + i, customStatus: i < 35 ? 'todo' : 'doing' }));
                setModel(rows);
                const oldJob = __tmStartProgressiveViewRender('kanban'); commitView();
                const todo = oldJob.columns.find((entry) => entry.key === 'status:todo');
                todo.loadNextBatch(state.modal); todo.loadNextBatch(state.modal);
                oldJob.columns.find((entry) => entry.key === 'status:doing').loadNextBatch(state.modal);
                column('status:todo').querySelector('.tm-kanban-col-body').scrollTop = 240;
                tmSwitchViewMode('checklist');
                setModel(rows.map((row) => row.id === 'return-0' ? { ...row, content: 'changed while away' } : row));
                tmSwitchViewMode('kanban');
                const result = {
                    todo: column('status:todo').querySelectorAll('.tm-kanban-card').length,
                    doing: column('status:doing').querySelectorAll('.tm-kanban-card').length,
                    top: column('status:todo').querySelector('.tm-kanban-col-body').scrollTop,
                    fresh: state.modal.querySelector('[data-id="return-0"] > span').textContent,
                    cancelled: oldJob.status === 'cancelled' && oldJob.tasksRef === null && oldJob.columns.length === 0
                        && oldJob.viewportListeners.length === 0 && !oldJob.unsubscribeTaskStore && !oldJob.boundBody,
                };
                const next = state.__tmProgressiveViewRender.columns.find((entry) => entry.key === 'status:todo');
                next.loadNextBatch(state.modal);
                result.afterMore = column('status:todo').querySelectorAll('.tm-kanban-card').length;
                return result;
            });
            assert.deepEqual(result, { todo: 30, doing: 20, top: 240, fresh: 'changed while away', cancelled: true, afterMore: 35 });
        }, true);
        await run('table checklist and timeline restore independent windows, reset on scope changes, and clamp deleted rows', async (page) => {
            const result = await page.evaluate(() => {
                __tmIsMobileDevice = () => true;
                setModel(Array.from({ length: 100 }, (_, i) => ({ id: 'row-' + i })));
                state.viewMode = 'list'; __tmStartProgressiveViewRender('list'); __tmResetViewRenderWindow('list'); commitView();
                state.listRenderLimit = 82; state.modal.querySelector('.tm-body').scrollTop = 111;
                tmSwitchViewMode('checklist'); state.listRenderLimit = 54; state.modal.querySelector('.tm-body').scrollTop = 333;
                tmSwitchViewMode('timeline'); state.listRenderLimit = 68; state.modal.querySelector('.tm-body').scrollTop = 555;
                const restored = [];
                for (const mode of ['list', 'checklist', 'timeline']) {
                    tmSwitchViewMode(mode); restored.push([mode, state.listRenderLimit, state.modal.querySelector('.tm-body').scrollTop]);
                }
                tmSwitchViewMode('list'); state.searchKeyword = 'new-scope'; tmSwitchViewMode('checklist');
                const reset = state.listRenderLimit <= 24;
                state.searchKeyword = ''; tmSwitchViewMode('kanban');
                setModel(Array.from({ length: 12 }, (_, i) => ({ id: 'row-' + i })));
                tmSwitchViewMode('list');
                return { restored, reset, clamped: state.listRenderLimit };
            });
            assert.deepEqual(result, { restored: [['list', 82, 111], ['checklist', 54, 333], ['timeline', 68, 555]], reset: true, clamped: 12 });
        }, true);
        await run('returning whiteboard keeps pan and zoom without fitting again', async (page) => {
            const result = await page.evaluate(async () => {
                setModel([{ id: 'one' }]); state.viewMode = 'whiteboard'; commitView();
                boardViewport = { x: -230, y: 175, zoom: 1.6 }; fitCalls = 0;
                tmSwitchViewMode('list'); boardViewport = { x: 0, y: 0, zoom: 1 };
                tmSwitchViewMode('whiteboard');
                await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                return { viewport: boardViewport, fits: fitCalls };
            });
            assert.deepEqual(result, { viewport: { x: -230, y: 175, zoom: 1.6 }, fits: 0 });
        });
        await run('repeated switches keep bounded numeric snapshots and release cancelled loaders', async (page) => {
            await page.evaluate(() => {
                setModel(Array.from({ length: 40 }, (_, i) => ({ id: 'memory-' + i })));
                __tmStartProgressiveViewRender('kanban'); commitView();
                window.cycleViews = async (count) => {
                    for (let i = 0; i < count; i++) {
                        for (const mode of ['list', 'checklist', 'timeline', 'whiteboard', 'kanban']) {
                            const old = state.__tmProgressiveViewRender;
                            tmSwitchViewMode(mode);
                            if (old && (old.tasksRef || old.columns.length || old.boundBody || old.viewportListeners.length
                                || old.viewportTimer || old.unsubscribeTaskStore)) throw new Error('cancelled job retained resources');
                        }
                        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                    }
                };
            });
            const session = await page.context().newCDPSession(page);
            await page.evaluate(() => cycleViews(50));
            await session.send('HeapProfiler.collectGarbage');
            const before = await session.send('Memory.getDOMCounters');
            const heapBefore = await session.send('Runtime.getHeapUsage');
            await page.evaluate(() => cycleViews(150));
            await session.send('HeapProfiler.collectGarbage');
            const after = await session.send('Memory.getDOMCounters');
            const heapAfter = await session.send('Runtime.getHeapUsage');
            const snapshots = await page.evaluate(() => {
                const hasRetainedObject = (value) => {
                    if (value instanceof Node || typeof value === 'function') return true;
                    if (value instanceof Map) return Array.from(value.values()).some(hasRetainedObject);
                    return !!value && typeof value === 'object' && Object.values(value).some(hasRetainedObject);
                };
                return { size: state.__tmViewSwitchWindows.size, retained: hasRetainedObject(state.__tmViewSwitchWindows) };
            });
            assert.deepEqual(snapshots, { size: 5, retained: false });
            assert.ok(after.nodes <= before.nodes + 20, JSON.stringify({ before, after }));
            assert.ok(after.jsEventListeners <= before.jsEventListeners + 2, JSON.stringify({ before, after }));
            console.log('view switch resources after 250 / 1000 switches:', JSON.stringify({ before, after,
                heapUsedBefore: heapBefore.usedSize, heapUsedAfter: heapAfter.usedSize }));
            await session.detach();
        }, true);
    } finally { await browser.close(); }
    if (failures.length) { console.error(JSON.stringify(failures, null, 2)); process.exitCode = 1; }
    if (smoke) assert.equal(passed + failures.length, smokeCases.size, 'every release smoke case must run');
    console.log(`kanban column browser regressions: ${passed} passed, ${failures.length} failed`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
