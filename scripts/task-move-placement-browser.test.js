'use strict';

// Isolated Chromium DOM regression; does not connect to a running SiYuan.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const read = (name) => fs.readFileSync(path.join(__dirname, '../src/task-horizon/main', name), 'utf8');
function section(source, start, end) {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from, start);
    return source.slice(from, to);
}
const runtime = read('20-api-and-runtime-services.js');
const projection = read('task-runtime/51-whiteboard-and-link-runtime.js');
const code = [
    read('32-runtime-state-and-events.js'),
    section(read('task-runtime/53b-task-create-and-quick-add-runtime.js'), 'function __tmResetMovedTaskAttrHostProjection(', 'function __tmCloneTaskTreeForMove('),
    section(runtime, 'function __tmGetChecklistGroupKeyFromCard(', 'function __tmInsertChecklistTaskBranchFragment('),
    section(runtime, 'function __tmTryRefreshChecklistProjectionGroups(', 'function __tmCollectChecklistDocumentRefreshTaskIds('),
    section(projection, 'function __tmBuildFilteredTaskDerivedState(', 'function __tmGetFilteredTaskDerivedState('),
    section(projection, 'function __tmGetProjectedOrderedTaskChildren(', 'function __tmIsTaskDoneForTailGroup('),
    section(projection, 'function __tmBuildTaskRowModel(', 'function __tmResolveFirstVisibleTaskIdFromRowModel('),
    section(projection, 'function __tmTaskPlacementMatchesDom(', 'function __tmTryApplyChecklistOptimisticProjectionInPlace('),
    section(projection, 'function __tmTryApplyChecklistOptimisticProjectionInPlace(', 'function __tmGetProjectedDirectChildStats('),
    section(projection, 'function __tmTryApplyKanbanOptimisticProjectionInPlace(', 'function __tmRefreshKanbanProjectionPatchNow('),
    section(runtime, 'function __tmTryReconcileKanbanParentCards(', 'function __tmRerenderWhiteboardInPlace('),
    section(read('10-stores-rules-and-cache.js'), 'function __tmBuildStructuredAuthoritativeTaskList(', 'function __tmPrepareTaskBlockIncrementalRow('),
    section(read('40-render-runtime.js'), 'async function __tmResolveDocTaskParentLinks(', 'function __tmIsOtherBlockTabId('),
].join('\n');

async function setup(page) {
    await page.route('**/*', (route) => route.abort());
    await page.setContent('<main id="manager"></main>');
    await page.evaluate(() => {
        window.state = { modal: document.querySelector('#manager'), viewMode: 'kanban', flatTasks: {},
            pendingInsertedTasks: {}, pendingDeletedTasks: {}, taskTree: [], filteredTasks: [],
            otherBlocks: [], doneOverrides: {}, showCompletedTasks: true };
        window.SettingsStore = { data: {} };
        window.__tmKanbanColsHtmlCache = null;
        window.__tmTaskStateKernel = { getTask: (id) => state.flatTasks[id] };
        window.__tmNormalizeTaskParentLookupDepth = () => 0;
        window.__tmBuildElementFromHtml = (html) => {
            const template = document.createElement('template');
            template.innerHTML = html;
            return template.content.firstElementChild;
        };
        window.__tmCaptureKanbanDetailScrollSnapshot = () => null;
        window.__tmPreserveActiveDetailNotePanelDuringBodySwap = () => false;
        window.__tmBindFloatingTooltipsAfterLocalRerender = () => {};
        window.__tmUpdateTaskDoneInDOM = () => {};
        window.__tmSyncTaskCardMetaChipsInDOM = () => {};
        window.__tmIsTaskPinned = () => false;
        window.__tmGetKanbanExpectedProjectionGroupKeys = () => [];
        window.__tmFindKanbanProjectionColumn = (modal, task, current) => current;
        window.__tmSyncKanbanCompletedTodayBadgeInDOM = () => {};
        window.__tmSyncKanbanProjectionCounts = () => {};
        window.renderCount = 0;
        window.setModel = (rows) => {
            const tasks = rows.map((row) => ({ done: false, docId: 'doc', root_id: 'doc',
                parentTaskId: '', parent_task_id: '', parent_id: 'root-list', parentId: 'root-list',
                parentListId: 'root-list', parent_list_parent_id: '', parentListParentId: '',
                ...row, children: [] }));
            const byId = Object.fromEntries(tasks.map((task) => [task.id, task]));
            tasks.forEach((task) => {
                if (task.parentTaskId && byId[task.parentTaskId]) byId[task.parentTaskId].children.push(task);
            });
            state.flatTasks = byId;
            state.filteredTasks = tasks;
            state.taskTree = [{ id: 'doc', tasks: tasks.filter((task) => !task.parentTaskId) }];
            __tmTaskStore.acceptAuthoritative(tasks, { replaceDocuments: true, docIds: ['doc', 'other-doc'], replaceStructure: true });
        };
        // Minimal renderer fixtures preserve the production card/container contract.
        // Placement, parent reconciliation, store confirmation and DOM swap are production code.
        state.renderKanbanBodyHtml = () => {
            renderCount++;
            const tasks = state.filteredTasks.map((task) => __tmTaskStore.getProjected(task.id));
            const card = (task) => `<article class="tm-kanban-card${task.parentTaskId ? ' tm-kanban-card--sub' : ''}" data-id="${task.id}" data-tm-placement-doc="${task.docId}" data-tm-placement-parent="${task.parentTaskId}">${task.id}<div class="children">${tasks.filter((child) => child.parentTaskId === task.id).map(card).join('')}</div></article>`;
            return `<div class="tm-body tm-body--kanban"><section class="tm-kanban-col"><div class="tm-kanban-col-body">${tasks.filter((task) => !task.parentTaskId).map(card).join('')}</div></section></div>`;
        };
        window.mount = () => { state.modal.innerHTML = state.renderKanbanBodyHtml(); renderCount = 0; };
        window.domPlacement = (id) => {
            const cards = Array.from(state.modal.querySelectorAll(`.tm-kanban-card[data-id="${id}"]`));
            return cards.map((card) => ({ parent: card.parentElement.closest('.tm-kanban-card')?.dataset.id || '',
                subtask: card.classList.contains('tm-kanban-card--sub'), doc: card.dataset.tmPlacementDoc }));
        };
    });
    await page.addScriptTag({ content: code });
}

(async () => {
    const browser = await chromium.launch({ headless: true });
    const failures = [];
    let passed = 0;
    async function run(name, check, options = {}) {
        const page = await browser.newPage(options);
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        try {
            await setup(page);
            await check(page);
            assert.deepEqual(errors, [], 'unexpected browser errors');
            passed++;
        } catch (error) { failures.push({ name, error: error.stack }); }
        finally { await page.close(); }
    }
    try {
        for (const mobile of [false, true]) {
            await run(`outdent and later refresh preserve root placement (mobile=${mobile})`, async (page) => {
                const result = await page.evaluate(() => {
                    setModel([{ id: 'old-parent' }, { id: 'child', parentTaskId: 'old-parent', parent_task_id: 'old-parent' }]);
                    mount();
                    setModel([{ id: 'old-parent' }, { id: 'child' }]);
                    const fast = __tmTryApplyKanbanOptimisticProjectionInPlace('child', {}, { filtersApplied: true, structural: true });
                    const parentOnly = __tmTryReconcileKanbanParentCards(state.modal, ['child'], { parentTaskIds: ['old-parent'] });
                    const stagingRenders = renderCount;
                    const fallback = __tmRerenderKanbanInPlace(state.modal);
                    const first = domPlacement('child');
                    __tmRerenderKanbanInPlace(state.modal);
                    return { fast, parentOnly, stagingRenders, fallback, first, later: domPlacement('child') };
                });
                assert.equal(result.fast, false);
                assert.equal(result.parentOnly, false);
                assert.equal(result.stagingRenders, 0, 'root changes must avoid a wasted full staging render');
                assert.equal(result.fallback, true);
                assert.deepEqual(result.first, [{ parent: '', subtask: false, doc: 'doc' }]);
                assert.deepEqual(result.later, result.first);
            }, mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {});
        }
        await run('child changes parent without leaving an old duplicate', async (page) => {
            const result = await page.evaluate(() => {
                setModel([{ id: 'a' }, { id: 'child', parentTaskId: 'a' }, { id: 'b' }]); mount();
                const a = state.modal.querySelector('[data-id="a"]');
                const b = state.modal.querySelector('[data-id="b"]');
                setModel([{ id: 'a' }, { id: 'b' }, { id: 'child', parentTaskId: 'b' }]);
                const fast = __tmTryApplyKanbanOptimisticProjectionInPlace('child', {}, { filtersApplied: true, structural: true });
                const reconciled = __tmTryReconcileKanbanParentCards(state.modal, ['child']);
                return { fast, reconciled, cards: domPlacement('child'), oldChildren: a.querySelectorAll('.tm-kanban-card').length,
                    sameParents: a === state.modal.querySelector('[data-id="a"]') && b === state.modal.querySelector('[data-id="b"]') };
            });
            assert.equal(result.fast, false);
            assert.equal(result.reconciled, true);
            assert.deepEqual(result.cards, [{ parent: 'b', subtask: true, doc: 'doc' }]);
            assert.equal(result.oldChildren, 0);
            assert.equal(result.sameParents, true);
        });
        await run('indent and cross-document moves reject placement-only fast paths', async (page) => {
            const result = await page.evaluate(() => {
                setModel([{ id: 'a' }, { id: 'child' }]); mount();
                setModel([{ id: 'a' }, { id: 'child', parentTaskId: 'a' }]);
                const indent = __tmTryApplyKanbanOptimisticProjectionInPlace('child', {}, { filtersApplied: true, structural: true });
                const parentOnly = __tmTryReconcileKanbanParentCards(state.modal, ['child']);
                __tmRerenderKanbanInPlace(state.modal);
                const nested = domPlacement('child');
                setModel([{ id: 'a' }, { id: 'child', docId: 'other-doc', root_id: 'other-doc' }]);
                const crossDoc = __tmTryApplyKanbanOptimisticProjectionInPlace('child', {}, { filtersApplied: true, structural: true });
                __tmRerenderKanbanInPlace(state.modal);
                return { indent, parentOnly, nested, crossDoc, moved: domPlacement('child') };
            });
            assert.equal(result.indent, false); assert.equal(result.parentOnly, false); assert.equal(result.crossDoc, false);
            assert.deepEqual(result.nested, [{ parent: 'a', subtask: true, doc: 'doc' }]);
            assert.deepEqual(result.moved, [{ parent: '', subtask: false, doc: 'other-doc' }]);
        });
        await run('same-parent reorder keeps the fast path and actual DOM order', async (page) => {
            const result = await page.evaluate(() => {
                setModel([{ id: 'a' }, { id: 'child', parentTaskId: 'a' }, { id: 'sibling', parentTaskId: 'a' }]); mount();
                const child = state.modal.querySelector('[data-id="child"]');
                setModel([{ id: 'a' }, { id: 'sibling', parentTaskId: 'a' }, { id: 'child', parentTaskId: 'a' }]);
                const fast = __tmTryApplyKanbanOptimisticProjectionInPlace('child', {}, { filtersApplied: true, structural: true });
                return { fast, renders: renderCount, retained: child === state.modal.querySelector('[data-id="child"]'),
                    order: Array.from(child.parentElement.children, (node) => node.dataset.id) };
            });
            assert.deepEqual(result, { fast: true, renders: 0, retained: true, order: ['sibling', 'child'] });
        });
        await run('stale SQL confirmation cannot bounce an outdented card into its old parent', async (page) => {
            const result = await page.evaluate(async () => {
                setModel([{ id: 'old-parent' }, { id: 'child' }]); mount();
                __tmTaskStore.rememberPendingStructural({ type: 'moveTask', phase: 'commit', taskId: 'child',
                    placement: { taskID: 'child', documentID: 'doc', parentListID: 'root-list', parentTaskID: '', previousSiblingID: 'old-parent' } });
                const raw = [{ id: 'old-parent', root_id: 'doc', docId: 'doc', parentTaskId: '', parent_task_id: '', doc_seq: 1 },
                    { id: 'child', root_id: 'doc', docId: 'doc', parentTaskId: 'old-parent', parent_task_id: 'old-parent',
                        parent_id: 'old-list', parent_list_parent_id: 'old-parent', doc_seq: 2 }];
                const authoritative = new Map(raw.map((task) => [task.id, { ...task }]));
                const rows = __tmTaskStore.mergePendingStructuralRows(raw, { docIds: ['doc'] });
                const resolved = await __tmResolveDocTaskParentLinks(rows, { docId: 'doc' });
                const list = __tmBuildStructuredAuthoritativeTaskList(authoritative, [{ nextDoc: { tasks: resolved.rootTasks } }]);
                state.flatTasks = Object.fromEntries(rows.map((task) => [task.id, task]));
                state.filteredTasks = rows;
                __tmTaskStore.acceptAuthoritative(list, { docIds: ['doc'], replaceDocuments: true, replaceStructure: true });
                __tmRerenderKanbanInPlace(state.modal);
                return { parent: __tmTaskStore.getProjected('child').parentTaskId, cards: domPlacement('child'),
                    oldChildren: __tmTaskStore.listProjectedDirectChildren('old-parent').map((task) => task.id) };
            });
            assert.equal(result.parent, ''); assert.deepEqual(result.oldChildren, []);
            assert.deepEqual(result.cards, [{ parent: '', subtask: false, doc: 'doc' }]);
        });
        await run('checklist placement guard handles outdent and unstamped older DOM', async (page) => {
            const result = await page.evaluate(() => {
                setModel([{ id: 'child' }]); state.viewMode = 'checklist';
                state.modal.innerHTML = '<div class="tm-checklist-item" data-id="child" data-tm-placement-doc="doc" data-tm-placement-parent="old-parent"></div>';
                const outdent = __tmTryApplyChecklistOptimisticProjectionInPlace('child', {}, { filtersApplied: true, structural: true });
                state.modal.firstElementChild.removeAttribute('data-tm-placement-parent');
                const oldDom = __tmTryApplyChecklistOptimisticProjectionInPlace('child', {}, { filtersApplied: true, structural: true });
                return { outdent, oldDom };
            });
            assert.deepEqual(result, { outdent: false, oldDom: false });
        });
        for (const parentPinned of [false, true]) for (const compact of [false, true]) {
            await run(`checklist pinned outdent reconciles every phase (parentPinned=${parentPinned}, compact=${compact})`, async (page) => {
                const result = await page.evaluate(({ parentPinned, compact }) => {
                    Object.assign(window, {
                        __tmClearChecklistProjectionGroupRefresh: () => {},
                        __tmBuildTaskRowModelCacheMeta: () => ({ viewMode: 'checklist' }),
                        __tmTaskRowModelCacheMatches: () => false,
                        __tmRememberTaskRowModelCache: (rows) => rows,
                        __tmGetAlwaysVisibleTaskDocHeadingTasks: () => [],
                        __tmIsDarkMode: () => false,
                        __tmNormalizeHexColor: (value, fallback) => value || fallback,
                        __tmGetFilteredTaskDerivedState: () => __tmBuildFilteredTaskDerivedState('all'),
                        __tmSortDocEntriesForTabs: (docs) => docs,
                        __tmBuildRuleSortContext: () => ({ hasExplicitSort: false }),
                        __tmSplitTasksByDoneState: (tasks) => ({ active: tasks, done: [] }),
                        __tmResolveHideCompletedDescendantsFlag: () => false,
                        __tmShouldKeepChildTaskVisible: () => true,
                        __tmCalcGroupDurationText: () => '',
                    });
                    setModel([{ id: 'anchor', pinned: true }, { id: 'parent', pinned: parentPinned },
                        { id: 'child', pinned: true, parentTaskId: 'parent', parent_task_id: 'parent' },
                        { id: 'grandchild', parentTaskId: 'child', parent_task_id: 'child' }]);
                    state.viewMode = 'checklist';
                    state.allDocuments = [];
                    state.collapsedTaskIds = new Set(); state.collapsedGroups = new Set();
                    const buildBody = () => {
                        const groups = [];
                        let group = null;
                        for (const row of __tmBuildTaskRowModel()) {
                            if (row.type === 'group') {
                                group = { header: `<div class="tm-checklist-group" data-group-key="${row.key}" data-count="${row.count}"></div>`, rows: [] };
                                groups.push(group);
                            } else if (row.type === 'task') {
                                const task = __tmTaskStore.getProjected(row.id);
                                group.rows.push(`<div class="tm-checklist-item" data-id="${row.id}" data-depth="${row.depth}" data-tm-placement-doc="${task.docId}" data-tm-placement-parent="${task.parentTaskId}"></div>`);
                            }
                        }
                        return __tmBuildElementFromHtml(`<div class="tm-body tm-body--checklist"><div class="tm-checklist-pane${compact ? ' tm-checklist-pane--compact' : ''}"><div class="tm-checklist-items">${groups.map((entry) => compact
                            ? `<section class="tm-checklist-group-card">${entry.header}<div class="tm-checklist-group-card-items">${entry.rows.join('')}</div></section>`
                            : entry.header + entry.rows.join('')).join('')}</div></div></div>`);
                    };
                    const readRows = () => Array.from(state.modal.querySelectorAll('.tm-checklist-item'), (node) => ({ id: node.dataset.id, depth: node.dataset.depth }));
                    state.modal.replaceChildren(buildBody());
                    const body = state.modal.firstElementChild;
                    const anchor = body.querySelector('[data-id="anchor"]');
                    const reconcile = () => __tmTryRefreshChecklistProjectionGroups(state.modal, body, buildBody(), ['child']);
                    __tmTaskStore.applyMutation({ type: 'moveTask', phase: 'optimistic', opId: 'outdent', taskId: 'child',
                        taskIds: ['child', 'parent'], data: { taskId: 'child', mode: 'after', targetDocId: 'doc',
                            targetTaskId: 'parent', targetParentTaskId: '', targetListId: 'root-list' },
                    }, { applyLocal: false });
                    state.flatTasks.parent = { ...state.flatTasks.parent, children: [] };
                    state.flatTasks.child = { ...state.flatTasks.child, parentTaskId: '', parent_task_id: '' };
                    state.filteredTasks = Object.values(state.flatTasks);
                    const fast = __tmTryApplyChecklistOptimisticProjectionInPlace('child', {}, { filtersApplied: true, structural: true });
                    const pendingHandled = reconcile();
                    const pending = readRows();
                    __tmTaskStore.applyMutation({ type: 'moveTask', phase: 'commit', opId: 'outdent', taskId: 'child',
                        task: { id: 'child', parentTaskId: '', parent_task_id: '' },
                        placement: { taskID: 'child', documentID: 'doc', parentListID: 'root-list', parentTaskID: '' },
                    }, { applyLocal: false });
                    const commitHandled = reconcile();
                    const first = readRows();
                    const laterHandled = reconcile();
                    const later = readRows();
                    return { fast, pendingHandled, pending, commitHandled, laterHandled, first, later,
                        bodyKept: body === state.modal.firstElementChild,
                        anchorKept: anchor === body.querySelector('[data-id="anchor"]'),
                        pinnedCount: state.modal.querySelector('[data-group-key="pinned_root_tasks"]').dataset.count };
                }, { parentPinned, compact });
                assert.equal(result.fast, false);
                assert.equal(result.pendingHandled, true);
                assert.equal(result.commitHandled, true);
                assert.equal(result.laterHandled, true);
                assert.equal(result.bodyKept, true, 'the full checklist body must not be replaced');
                assert.equal(result.anchorKept, true, 'unaffected pinned rows retain their existing nodes');
                assert.equal(result.first.filter((row) => row.id === 'child').length, 1);
                assert.equal(result.first.find((row) => row.id === 'child').depth, '0');
                assert.equal(result.first.filter((row) => row.id === 'grandchild').length, 1);
                assert.equal(result.first.find((row) => row.id === 'grandchild').depth, '1');
                assert.equal(result.first.filter((row) => row.id === 'parent').length, 1);
                assert.equal(result.pinnedCount, parentPinned ? '3' : '2');
                assert.deepEqual(result.pending, result.first, 'the pending move must already have the final unique rows');
                assert.deepEqual(result.later, result.first);
            });
        }
    } finally { await browser.close(); }
    for (const failure of failures) console.error(failure.name + '\n' + failure.error);
    console.log(`Task move placement browser regressions: ${passed} passed, ${failures.length} failed`);
    if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exitCode = 1; });
