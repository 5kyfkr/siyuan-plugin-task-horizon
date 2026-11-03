'use strict';

// Production group headers, drop handlers and pointer routing in isolated Chromium.
// The host field writer is replaced at its public boundary.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('./i18n-browser-fixture');
const read = (file) => fs.readFileSync(path.join(__dirname, '../src/task-horizon/main', file), 'utf8');
function section(source, start, end) {
    const from = source.indexOf(start), to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, start);
    return source.slice(from, to);
}
const foundation = read('30-dialogs-and-ui-foundation.js');
const render = read('40-render-runtime.js');
const projection = read('task-runtime/51-whiteboard-and-link-runtime.js');
const services = read('20-api-and-runtime-services.js');
function extract(source, name) {
    const start = source.indexOf(`    function ${name}(`), end = source.indexOf('\n    }', start);
    assert.ok(start >= 0 && end > start, name);
    return source.slice(start, end + 6);
}
const production = [
    read('render/40-render-list-context-helpers.js'),
    section(read('render/46-render-local-task-time-refresh.js'), 'const __TM_TASK_PRIORITY_NORMALIZE_MAP', 'function __tmBindTaskDateFollowUpdatedRefresh('),
    section(render, 'function __tmNormalizeTaskPriorityValue(', 'function __tmParseTaskLooseBoolean('),
    section(foundation, 'function __tmGetDraggedTaskId(', 'function __tmClearDocTabDropTarget('),
    section(foundation, 'function __tmClearTaskRowDropIndicators(', 'try { globalThis.__tmClearTaskRowDropIndicators'),
    section(foundation, 'function __tmResolveQuadrantGroupDropElementFromTarget(', 'function __tmResolveDocHeadingGroupDropElementFromTarget('),
    section(render, 'window.tmKanbanDragOver = function', 'window.tmKanbanGroupDragOver = function'),
    section(render, 'window.tmKanbanDrop = async function', 'window.tmKanbanPickDate = async function'),
    read('41-external-task-drag-routing.js'),
    section(projection, 'function __tmCollectChecklistProjectionDomBlock(', 'function __tmGetProjectedDirectChildStats('),
    section(projection, 'function __tmTryApplyListProjectionBatchInPlace(', 'function __tmCollectTaskProjectionClosure('),
    extract(services, '__tmGetListRowStableKey'),
    section(projection, 'function __tmBuildTaskRowModel(', 'function __tmResolveFirstVisibleTaskIdFromRowModel'),
    section(read('task-runtime/53-list-render-and-document-loader.js'), 'function renderTaskList(', 'window.tmListLoadMoreRows = async function'),
    `function renderChecklistGroups(rows) {
        const isDark = false;
        let currentGroupAccent = '';
        ${section(read('render/42-render-list-and-checklist-body.js'), 'const renderGroup = (row) => {', 'const renderTask = (row) => {')}
        const rowModel = rows, taskBranchRows = null, renderWindowFragment = false;
        const checklistTaskLimit = Infinity, hasMoreChecklistTaskRows = false;
        let renderedChecklistTaskCount = 0;
        const renderTask = (row) => '<article class="tm-checklist-item" data-id="' + row.id + '" data-depth="0">测试任务</article>';
        const renderDropGap = () => '';
        ${section(read('render/42-render-list-and-checklist-body.js'), 'const items = [];', 'const itemsHtml = items.join(')}
        return '<div class="tm-checklist-items">' + items.join('') + '</div>';
    }`,
].join('\n');

async function setup(page, mode) {
    await page.setContent('<main id="host"><div id="source" draggable="true">拖拽测试任务</div><div id="groups"></div></main>');
    await page.addStyleTag({ path: path.join(__dirname, '../task-horizon.css') });
    await page.addStyleTag({ content: `body{font-family:system-ui;background:#f8f9fb;color:#28303d;padding:24px}
        #host{max-width:780px;margin:auto;--tm-text-color:#28303d;--tm-header-bg:#eef0f5}
        #source{padding:16px;border:1px solid #bfc7d5;margin-bottom:20px;cursor:grab}
        #groups{display:block}.tm-checklist-group{min-height:44px;margin:10px 0}
        .tm-group-row td{height:44px}.tm-kanban-col{min-height:70px;margin-bottom:12px;padding:12px;border:1px solid #bfc7d5}
        .tm-kanban-col--dragover{background:#dce9fa}.tm-table{width:100%}` });
    await page.evaluate(() => {
        const rules = [
            { id: 'urgent-important', name: '重要紧急', color: 'red', importance: ['high', 'medium'], timeRanges: ['overdue', 'within7days'] },
            { id: 'not-urgent-important', name: '重要不紧急', color: 'yellow', importance: ['high', 'medium'], timeRanges: ['beyond7days', 'nodate'] },
            { id: 'urgent-not-important', name: '不重要紧急', color: 'blue', importance: ['low', 'none'], timeRanges: ['overdue', 'within7days'] },
            { id: 'not-urgent-not-important', name: '不重要不紧急', color: 'green', importance: ['low', 'none'], timeRanges: ['beyond7days', 'nodate'] },
        ];
        window.task = { id: 'drag-task', priority: 'low', completionTime: '2026-11-03', startDate: '2026-11-01', root_id: 'doc', parentTaskId: '' };
        window.writes = [];
        window.hints = [];
        window.state = { modal: document.querySelector('#host'), viewMode: 'checklist', quadrantEnabled: true,
            filteredTasks: [task], collapsedGroups: new Set(), collapsedTaskIds: new Set(), taskTree: [], activeDocId: 'all' };
        window.SettingsStore = { data: { quadrantConfig: { rules } } };
        Object.assign(window, {
            GlobalLock: { isLocked: () => false },
            __tmTaskBoundary: { getTask: (id) => id === task.id ? task : null },
            __tmGetTaskRowDropTaskById: (id) => __tmTaskBoundary.getTask(id),
            __tmEnsureEditableTaskLike: () => true,
            __tmIsCheckinTask: (value) => !!value?.checkin,
            __tmNormalizeDateOnly: (value) => typeof value === 'string' ? value.slice(0, 10)
                : `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`,
            hint: (message, kind) => hints.push({ message, kind }),
            __tmRequireTaskMutation: () => async (id, patch, options) => {
                writes.push({ id, patch, options });
                Object.assign(task, patch);
                if (state.viewMode === 'checklist') {
                    __tmTryApplyChecklistOptimisticProjectionInPlace(id, patch, { filtersApplied: true });
                } else if (state.viewMode === 'list') {
                    __tmTryApplyListProjectionBatchInPlace([id]);
                }
                return true;
            },
            __tmGetAlwaysVisibleTaskDocHeadingTasks: () => [],
            __tmBuildTaskRowModelCacheMeta: () => ({ viewMode: state.viewMode }),
            __tmTaskRowModelCacheMatches: () => false,
            __tmRememberTaskRowModelCache: (rows) => rows,
            __tmGetFilteredTaskDerivedState: () => {
                const roots = state.filteredTasks.slice();
                return { rootTasks: roots, filteredIdSet: new Set(roots.map((item) => item.id)),
                    baseOrderMap: new Map(roots.map((item, index) => [item.id, index])),
                    docsInOrder: ['doc'], docEntryById: new Map([['doc', { name: '测试文档' }]]),
                    filteredTasksByDoc: new Map([['doc', roots]]), docRootTasksByDoc: new Map([['doc', roots]]) };
            },
            __tmBuildRuleSortContext: () => ({}),
            __tmSplitTasksByDoneState: (tasks) => ({ active: tasks, done: [] }),
            __tmHasCalendarSidebarChecklist: () => false,
            __tmGetProjectedOrderedTaskChildren: () => [],
            __tmResolveHideCompletedDescendantsFlag: () => false,
            __tmShouldKeepChildTaskVisible: () => true,
            __tmIsTaskClosedForDisplay: () => false,
            __tmIsTaskMultiSelected: () => false,
            __tmIsDarkMode: () => false,
            __tmNormalizeHexColor: (_color, fallback) => fallback,
            __tmCalcGroupDurationText: () => '',
            __tmGetEffectiveProgressBarColor: () => '',
            __tmShouldUseCustomTouchTaskDrag: () => false,
            __tmShouldUseDesktopTaskDragLogic: () => true,
            __tmIsTomatoFocusModeEnabled: () => false,
            __tmGetDefaultColumnOrder: () => ['content'],
            __tmRenderToggleIcon: () => '▸',
            __tmClearDocTabDropTarget: () => {},
            __tmIsMultiSelectActive: () => false,
            __tmResolveDocHeadingGroupDropElementFromTarget: () => null,
            __tmResolveKanbanChildDropCard: () => null,
            __tmTakeReadyKanbanChildDropTarget: () => null,
            __tmUpdateKanbanChildDropCandidate: () => {},
            __tmGetKanbanBoardMode: () => 'quadrant',
            __tmResolveKanbanDropHost: (ev) => ev.currentTarget,
            __tmKanbanClearSurfaceDragOver: () => document.querySelectorAll('.tm-kanban-col--dragover').forEach((el) => el.classList.remove('tm-kanban-col--dragover')),
            esc: (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])),
            escSq: (value) => String(value).replace(/'/g, "\\'"),
        });
        document.querySelector('#source').ondragstart = (ev) => {
            state.draggingTaskId = task.id;
            state.draggingTaskIds = [task.id];
            ev.dataTransfer.setData('text/plain', task.id);
        };
    });
    await page.addScriptTag({ content: production });
    await page.evaluate((mode) => {
        state.viewMode = mode === 'table' ? 'list' : 'checklist';
        const host = document.querySelector('#groups');
        if (mode === 'table') {
            const rows = __tmBuildTaskRowModel().map((row) => row.type === 'group'
                ? `<tr class="tm-group-row" data-group-kind="${row.kind}" data-group-key="${row.key}"${row.kind === 'quadrant' ? ` data-quadrant="${String(row.key).replace('quadrant_', '')}" ondragenter="tmQuadrantGroupDragOver(event)" ondragover="tmQuadrantGroupDragOver(event)" ondragleave="tmQuadrantGroupDragLeave(event)" ondrop="tmQuadrantGroupDrop(event)"` : ''}><td>${row.label}<span class="tm-badge tm-badge--count">${row.count}</span></td></tr>`
                : `<tr data-id="${row.id}" data-depth="${row.depth}"><td>测试任务</td></tr>`);
            host.innerHTML = `<table id="tmTaskTable" class="tm-table"><tbody>${rows.join('')}</tbody></table>`;
        } else if (mode === 'checklist' || mode === 'checklist-compact') {
            const paneClass = mode === 'checklist-compact' ? ' tm-checklist-pane--compact' : '';
            host.innerHTML = `<div class="tm-checklist-pane${paneClass} tm-checklist-scroll">${renderChecklistGroups(__tmBuildTaskRowModel())}</div>`;
        } else {
            host.innerHTML = SettingsStore.data.quadrantConfig.rules.map((rule) => `<section class="tm-kanban-col" data-kind="quadrant" data-quadrant="${rule.id}"
                ondragover="tmKanbanDragOver(event)" ondrop="tmKanbanDrop(event)">${rule.name}</section>`).join('');
        }
    }, mode);
}

async function dropTask(page, quadrant) {
    const transfer = await page.evaluateHandle(() => new DataTransfer());
    const target = page.locator(`[data-quadrant="${quadrant}"]`);
    await page.locator('#source').dispatchEvent('dragstart', { dataTransfer: transfer });
    await target.dispatchEvent('dragenter', { dataTransfer: transfer });
    await target.dispatchEvent('dragover', { dataTransfer: transfer });
    await target.dispatchEvent('drop', { dataTransfer: transfer });
    await transfer.dispose();
}

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        for (const mode of ['kanban', 'checklist', 'checklist-compact', 'table']) {
            const page = await browser.newPage();
            const errors = [];
            page.on('pageerror', (error) => errors.push(error.message));
            try {
                await setup(page, mode);
                assert.equal(await page.locator('[data-quadrant]').count(), 4, `${mode}: all empty targets remain visible`);
                await dropTask(page, 'not-urgent-important');
                await page.waitForFunction(() => writes.length === 1, null, { timeout: 5000 }).catch(async (error) => {
                    console.error({ mode, errors, state: await page.evaluate(() => ({ hints, dragging: state.draggingTaskId, writes })) });
                    throw error;
                });
                const result = await page.evaluate(() => ({ patch: writes[0].patch, task, hints }));
                assert.deepEqual(result.patch, { priority: 'high', completionTime: '' }, mode);
                assert.equal(result.task.startDate, '2026-11-01');
                assert.equal(result.task.root_id, 'doc');
                assert.deepEqual(result.hints, [{ message: '已移动至目标象限', kind: 'success' }], `${mode}: concise success notification`);
                if (mode.startsWith('checklist') || mode === 'table') {
                    const placement = await page.evaluate(() => {
                        const source = document.querySelector('[data-group-key="quadrant_urgent-not-important"]');
                        const target = document.querySelector('[data-group-key="quadrant_not-urgent-important"]');
                        const item = document.querySelector(`.tm-checklist-item[data-id="${task.id}"], tr[data-id="${task.id}"]`);
                        return {
                            sourceRetained: !!source,
                            sourceCount: source?.querySelector('.tm-badge--count')?.textContent,
                            targetCount: target?.querySelector('.tm-badge--count')?.textContent,
                            moved: state.viewMode === 'checklist'
                                ? target?.closest('section')?.contains(item) === true
                                : target?.nextElementSibling === item,
                        };
                    });
                    assert.deepEqual(placement, {
                        sourceRetained: true, sourceCount: '0', targetCount: '1', moved: true,
                    }, `${mode}: dropping the last task immediately updates both quadrant groups`);
                }
                await dropTask(page, 'not-urgent-important');
                assert.equal(await page.evaluate(() => writes.length), 1, `${mode}: same-quadrant drop is a no-op`);
                assert.deepEqual(errors, [], mode);
                if (mode === 'checklist') {
                    const output = path.join(__dirname, '../output/playwright/quadrant-drag');
                    fs.mkdirSync(output, { recursive: true });
                    await page.screenshot({ path: path.join(output, 'empty-quadrant-groups.png') });
                }
            } finally { await page.close(); }
        }
        for (const mode of ['checklist', 'checklist-compact', 'table']) {
            const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
            try {
                await setup(page, mode);
                const result = await page.evaluate(async () => {
                    const target = document.querySelector('[data-quadrant="not-urgent-important"]');
                    const options = { taskId: task.id, target, clientX: 10, clientY: 10 };
                    const hover = __tmHandleExternalTaskDragOver(options);
                    const highlighted = target.classList.contains('tm-time-group-drop--active');
                    const dropped = await __tmHandleExternalTaskDrop(options);
                    return { hover, highlighted, dropped, patch: writes[0]?.patch, hints };
                });
                assert.deepEqual(result, { hover: true, highlighted: true, dropped: true, patch: { priority: 'high', completionTime: '' }, hints: [{ message: '已移动至目标象限', kind: 'success' }] }, `${mode}: pointer drag routing`);
            } finally { await page.close(); }
        }
        console.log('quadrant drag browser tests passed: four native targets and three mobile pointer routes');
    } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
