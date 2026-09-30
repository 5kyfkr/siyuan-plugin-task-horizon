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
const viewSwitch = read('render/47-render-side-panels-and-view-switching.js');
let renderer = section(read('render/43-render-timeline-kanban-calendar-body.js'),
    'function __tmBuildRenderSceneKanbanBodyHtml(', 'function __tmBuildRenderSceneCalendarBodyHtml(');
const decoration = section(renderer, 'const renderCard = ', 'const kanbanBoardNavItems = ');
renderer = renderer.replace(decoration, `const renderCard = (task, depth, sub, childRoot, title, children) => {
    renderedTaskIds.push(task.id);
    return '<article class="tm-kanban-card' + (sub ? ' tm-kanban-card--sub' : '')
        + '" data-id="' + task.id + '" data-tm-placement-parent="' + (task.parentTaskId || '')
        + '"><span class="tm-task-content-clickable" style="color:rgb(70,70,70)">' + task.content + '</span><div class="tm-kanban-subtasks-list">' + children + '</div></article>';
};\n`);
const code = [read('32-runtime-state-and-events.js'), read('21-view-render-state.js'), renderer,
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
            SettingsStore: { data: { completedTasksInlineInGroups: true } },
            GlobalLock: { isLocked: () => false },
            __tmGroupBgFromLabelColor: () => '',
            __tmKanbanColsHtmlCache: null,
            __tmProjectionService: { getAppliedGeneration: () => 0 },
            __tmTaskBoundary: { getTask: (id) => __tmTaskStore.getProjected(id) },
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
            __tmIsTaskDoneForTailGroup: (task) => !!task.done,
            __tmDoesStatusIdResolveToDone: (id) => id === 'done',
            __tmResolveHideCompletedDescendantsFlag: () => false,
            __tmShouldKeepChildTaskVisible: () => true,
            __tmIsDarkMode: () => false,
            __tmGetCurrentRule: () => ({}),
            __tmRuleUsesDocFlowSort: () => false,
            __tmRuleHasExplicitSort: () => false,
            __tmNormalizeHexColor: (_, fallback) => fallback,
            __tmNormalizeHeadingLevel: () => 'h2',
            __tmNormalizeDateOnly: () => '2026-09-26',
            __tmGetTaskRepeatWeekdayLabel: () => '',
            __tmGetTaskTimePriorityInfo: (task) => ({ diffDays: task.days }),
            __tmSortDocEntriesForTabs: (docs) => docs,
            __tmMoveGlobalNewTaskDocFirst: (docs) => docs,
            __tmGetDocColorHex: () => '#777777',
            __tmCompareTasksByDocFlow: () => 0,
            __tmCompareCompletedTasksRecentFirst: (_, __, fallback) => 0,
            __tmIsTaskPinned: () => false,
            __tmSortPinnedTasksFirst: (tasks) => tasks,
            __tmBuildKanbanColsCacheKey: () => String(__tmTaskStore.revision()),
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
    async function run(name, check, mobile = false) {
        const page = await browser.newPage(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {});
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        try { await setup(page); await check(page); assert.deepEqual(errors, []); passed++; }
        catch (error) { failures.push({ name, error: error.stack }); }
        finally { await page.close(); }
    }
    try {
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
                    parentColor: color('parent'), childColor: color('child'), newColor: color('new') };
            });
            assert.equal(result.ok, true); assert.equal(result.sameChild, true);
            assert.deepEqual(result.updatedTitles, ['child']);
            assert.equal(result.parentColor, 'rgb(70, 70, 70)');
            assert.equal(result.childColor, 'rgb(11, 22, 33)');
            assert.equal(result.newColor, 'var(--tm-primary-color)');
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
    console.log(`kanban column browser regressions: ${passed} passed, ${failures.length} failed`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
