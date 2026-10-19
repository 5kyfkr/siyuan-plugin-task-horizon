'use strict';

// Exercise production reconciliation and the complete Gantt renderer in an
// isolated browser. No SiYuan instance, storage or network is touched.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test, before, after } = require('node:test');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const read = (file) => fs.readFileSync(path.join(__dirname, '../src/task-horizon/main', file), 'utf8');
const runtime = read('20-api-and-runtime-services.js');
function section(start, end) {
    const from = runtime.indexOf(start), to = runtime.indexOf(end, from);
    assert.ok(from >= 0 && to > from, start);
    return runtime.slice(from, to);
}
const helpers = section('function __tmReconcileKeyedViewRows(', 'function __tmReconcileListRowsForAppend(')
    + section('function __tmTryReconcileWhiteboardBodies(', 'function __tmRerenderWhiteboardInPlace(');
let browser;
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });
async function withPage(run) {
    const page = await browser.newPage();
    await page.route('**/*', (route) => route.abort());
    try {
        await page.setContent('<main id="root"></main>');
        await page.addScriptTag({ content: helpers });
        return await run(page);
    } finally { await page.close(); }
}

for (const mode of ['list', 'timeline']) {
    for (const grouping of ['date', 'title']) {
        for (const archive of [false, true]) {
            test(`${mode} ${grouping} completed groups expand and collapse immediately (${archive ? 'archive' : 'active'})`, () => withPage(async (page) => {
                const actions = read('settings/70-doc-group-and-settings-actions.js');
                const list = read('task-runtime/53-list-render-and-document-loader.js');
                const timeline = read('render/43-render-timeline-kanban-calendar-body.js');
                const fn = name => {
                    const begin = runtime.indexOf(`    function ${name}(`), end = runtime.indexOf('\n    }', begin);
                    assert.ok(begin >= 0 && end > begin, name);
                    return runtime.slice(begin, end + 6);
                };
                const groupRenderer = source => {
                    const begin = source.indexOf('            const renderGroupRow = (row) =>');
                    const end = source.indexOf('        const renderTaskRow =', begin);
                    assert.ok(begin >= 0 && end > begin);
                    return `${source.slice(begin, end)}\nreturn renderGroupRow(row);`;
                };
                await page.evaluate(({ mode, archive }) => {
                    Object.assign(window, {
                        state: { modal: document.querySelector('#root'), viewMode: mode, activeDocId: 'all',
                            docTabsArchiveMode: archive, collapsedTaskIds: new Set(), collapsedGroups: new Set(), expandedCompletedGroups: new Set() },
                        SettingsStore: { data: { currentGroupId: 'all' }, save: async () => {} }, Storage: { set() {} },
                        esc: value => String(value || ''), escSq: value => String(value || ''), colCount: 1, timelineColumnCount: 1,
                        hasTaskRowBudget: () => true, __tmRenderToggleIcon: () => '<svg class="tm-group-toggle-icon"></svg>',
                        __tmRenderDocGroupLabel: (_id, label) => label, __tmRenderHeadingLevelIconLabel: label => label,
                        renderTaskTree: task => [`<tr data-id="${task.id}" data-depth="0"><td>${task.id}</td></tr>`],
                        __tmHasCalendarSidebarChecklist: () => false, __tmGetCollapseAnimMode: () => 'none',
                        __tmResetFlipState() {}, __tmMarkHighPriorityInteraction() {}, __tmMarkCollapseStateChanged() {},
                        __tmSyncCurrentViewDomRenderSignature() {},
                    });
                }, { mode, archive });
                const listBegin = list.indexOf('        const appendCompletedSubgroups = (groups) =>');
                const listEnd = list.indexOf('        const appendCompletedRootGroup =', listBegin);
                await page.addScriptTag({ content: section('    function __tmGetCompletedRootGroupScopeKey(', '    function __tmResetArchiveCompletedRootGroupCollapse(')
                    + ['__tmGetActiveTbody', '__tmApplyVisibilityFromState', '__tmUpdateToggleGlyphInDom'].map(fn).join('\n')
                    + actions.slice(actions.indexOf('    window.tmToggleGroupCollapse ='), actions.indexOf('    window.tmToggleCollapse ='))
                    + `\nwindow.renderListCompleted = groups => { const allRows = []; ${list.slice(listBegin, listEnd)} appendCompletedSubgroups(groups); return allRows.join(''); };`
                    + `\nwindow.renderTimelineInitial = row => { ${groupRenderer(timeline)} };`
                    + `\nwindow.renderTimelineCollapse = row => { ${groupRenderer(runtime)} };` });
                await page.evaluate(({ grouping, archive }) => {
                    window.completedKey = __tmBuildCompletedRootGroupKey();
                    const group = (key, depth, kind, items, groups) => ({ key, depth, groupDepth: depth, kind, label: key, count: 1, items, groups });
                    window.completedGroups = grouping === 'date'
                        ? [group('date-group', 1, 'done-date', [{ id: 'done' }])]
                        : [group('doc-group', 1, 'done-doc', [], [group('heading-group', 2, 'done-h2', [{ id: 'done' }])])];
                    if (archive) state.collapsedGroups.add(completedKey);
                    window.draw = (initial = false) => {
                        const renderGroups = groups => groups.map(item =>
                            (initial ? renderTimelineInitial : renderTimelineCollapse)({ ...item, collapsed: state.collapsedGroups.has(item.key) })
                            + (state.collapsedGroups.has(item.key) ? '' : (item.groups ? renderGroups(item.groups) : item.items.flatMap(renderTaskTree).join('')))).join('');
                        const rows = `<tr data-id="active"><td>Active</td></tr><tr data-group-key="${completedKey}"><td onclick="tmToggleGroupCollapse('${completedKey}', event)"><span class="tm-group-toggle">已完成</span></td></tr>`
                            + (__tmIsCompletedRootGroupCollapsed(completedKey) ? '' : (state.viewMode === 'list' ? renderListCompleted(completedGroups) : renderGroups(completedGroups)));
                        state.modal.innerHTML = `<table id="${state.viewMode === 'list' ? 'tmTaskTable' : 'tmTimelineLeftTable'}"><tbody>${rows}</tbody></table><div id="tmGanttBody"></div>`;
                        if (state.viewMode === 'timeline') state.modal.querySelector('#tmGanttBody').innerHTML = [...state.modal.querySelectorAll('tr')].map(row => `<div class="tm-gantt-row" data-id="${row.dataset.id || row.dataset.groupKey}">Gantt row</div>`).join('');
                    };
                    window.__tmScheduleCollapseRerender = () => draw();
                    draw(true);
                }, { grouping, archive });
                const completedHeader = page.locator('tr[data-group-key^="completed_root_tasks"] td');
                for (let cycle = 0; cycle < 3; cycle++) {
                    await completedHeader.click();
                    assert.equal(await page.locator('tr[data-id="done"]').isVisible(), true);
                    const result = await page.evaluate(async () => {
                        const task = state.modal.querySelector('tr[data-id="done"]');
                        const groups = [...state.modal.querySelectorAll('tr[data-group-level]')];
                        await tmToggleGroupCollapse(completedKey);
                        return { collapsed: __tmIsCompletedRootGroupCollapsed(completedKey),
                            retained: task === state.modal.querySelector('tr[data-id="done"]'),
                            hidden: task.style.display === 'none' && groups.every(row => row.style.display === 'none'),
                            activeVisible: state.modal.querySelector('tr[data-id="active"]').style.display !== 'none',
                            aligned: state.viewMode !== 'timeline' || [...state.modal.querySelectorAll('tbody tr')].every((row, index) => row.style.display === state.modal.querySelectorAll('.tm-gantt-row')[index].style.display) };
                    });
                    assert.deepEqual(result, { collapsed: true, retained: true, hidden: true, activeVisible: true, aligned: true });
                }
                await completedHeader.click();
                const subgroupKey = grouping === 'date' ? 'date-group' : 'doc-group';
                await page.evaluate(key => tmToggleGroupCollapse(key), subgroupKey);
                assert.equal(await page.locator('tr[data-id="done"]').isVisible(), false);
                await completedHeader.click();
                await completedHeader.click();
                assert.equal(await page.locator('tr[data-id="done"]').count(), 0, 'reopening the root preserves the nested subgroup collapse');
            }));
        }
    }
}

test('table rows reorder by identity and replace only changed depth/content', () => withPage(async (page) => {
    const result = await page.evaluate(() => {
        const root = document.querySelector('#root');
        root.innerHTML = '<table><tbody><tr data-group-key="doc"><td>Document</td></tr>'
            + '<tr data-id="a" data-depth="0"><td>A</td></tr>'
            + '<tr data-id="b" data-depth="1"><td>B</td></tr>'
            + '<tr data-id="c"><td>C</td></tr></tbody></table>';
        const parent = root.querySelector('tbody');
        const [group, a, b, c] = parent.children;
        let clicks = 0;
        a.addEventListener('click', () => clicks++);
        const staging = document.createElement('table');
        staging.innerHTML = '<tbody><tr data-group-key="doc"><td>Document</td></tr>'
            + '<tr data-id="b" data-depth="0"><td>B</td></tr>'
            + '<tr data-id="a" data-depth="0"><td>A</td></tr>'
            + '<tr data-id="d"><td>D</td></tr></tbody>';
        const ok = __tmReconcileKeyedViewRows(parent, Array.from(staging.tBodies[0].children));
        a.click();
        return { ok, order: Array.from(parent.children).map((n) => n.dataset.id || n.dataset.groupKey),
            group: group === parent.children[0], a: a === parent.children[2],
            replaced: b !== parent.children[1] && !b.isConnected, removed: !c.isConnected, clicks };
    });
    assert.deepEqual(result, { ok: true, order: ['doc', 'b', 'a', 'd'], group: true, a: true,
        replaced: true, removed: true, clicks: 1 });
}));

test('duplicate or unkeyed plans fail before mutating live rows', () => withPage(async (page) => {
    const result = await page.evaluate(() => {
        const parent = document.querySelector('#root');
        parent.innerHTML = '<div data-id="a">A</div><div data-id="b">B</div>';
        const a = parent.firstElementChild;
        const staging = document.createElement('div');
        const outcomes = [];
        for (const html of ['<div data-id="b">New B</div><div data-id="b">duplicate</div>', '<div>Unknown</div>']) {
            staging.innerHTML = html;
            outcomes.push(__tmReconcileKeyedViewRows(parent, Array.from(staging.children)));
        }
        return { outcomes, untouched: parent.firstElementChild === a && parent.textContent === 'AB' };
    });
    assert.deepEqual(result, { outcomes: [false, false], untouched: true });
}));

function whiteboardFixture() {
    return `<div class="tm-body--whiteboard"><div id="tmWhiteboardWorld" style="transform:translate(12px, 20px) scale(0.8)">
        <div class="tm-whiteboard"><section class="tm-whiteboard-doc" data-doc-id="doc">
        <div class="tm-whiteboard-doc-body" style="height:1000px;width:1200px">
        <svg class="tm-whiteboard-edges"><path d="M0 0L10 10"></path></svg>
        <svg class="tm-whiteboard-edges tm-whiteboard-edges--subtask"></svg>
        <div class="tm-whiteboard-frame" data-frame-id="frame">Frame</div>
        <svg class="tm-whiteboard-drawing-layer"><path d="M0 0L20 20"></path></svg>
        <div class="tm-whiteboard-note" data-note-id="note">Note</div>
        <div class="tm-whiteboard-node" data-task-id="parent">Parent<div class="tm-whiteboard-node" data-task-id="child">Child</div></div>
        <div class="tm-whiteboard-node" data-task-id="unrelated">Other</div>
        </div></section></div></div><div id="tmWhiteboardPoolContent">
        <section data-pool-section-key="doc">Parent: Child</section>
        <section data-pool-section-key="other">Other doc</section></div><aside id="detail">Detail</aside></div>`;
}

test('whiteboard outdent retains canvas, unrelated cards, notes, drawings and other task-pool groups', () => withPage(async (page) => {
    const result = await page.evaluate((html) => {
        const root = document.querySelector('#root');
        root.innerHTML = html;
        const body = root.firstElementChild;
        const selectors = ['#tmWhiteboardWorld', '[data-task-id="unrelated"]', '[data-note-id]',
            '[data-frame-id]', '.tm-whiteboard-drawing-layer', '.tm-whiteboard-edges', '[data-pool-section-key="other"]', '#detail'];
        const before = selectors.map((s) => body.querySelector(s));
        const next = body.cloneNode(true);
        next.querySelector('[data-task-id="child"]').remove();
        next.querySelector('.tm-whiteboard-doc-body').insertAdjacentHTML('beforeend',
            '<div class="tm-whiteboard-node" data-task-id="child">Child</div>');
        next.querySelector('.tm-whiteboard-edges').replaceChildren();
        next.querySelector('[data-pool-section-key="doc"]').textContent = 'Parent / Child';
        const confirmation = next.cloneNode(true);
        const ok = __tmTryReconcileWhiteboardBodies(body, next);
        const stable = selectors.every((s, i) => body.querySelector(s) === before[i]);
        const childRoot = body.querySelector('[data-task-id="child"]').parentElement.matches('.tm-whiteboard-doc-body');
        const parent = body.querySelector('[data-task-id="parent"]');
        const echo = __tmTryReconcileWhiteboardBodies(body, confirmation);
        return { ok, stable, childRoot, echo, echoStable: parent === body.querySelector('[data-task-id="parent"]'),
            pool: body.querySelector('[data-pool-section-key="doc"]').textContent,
            transform: body.querySelector('#tmWhiteboardWorld').style.transform };
    }, whiteboardFixture());
    assert.deepEqual(result, { ok: true, stable: true, childRoot: true, echo: true, echoStable: true,
        pool: 'Parent / Child', transform: 'translate(12px, 20px) scale(0.8)' });
}));

test('whiteboard unknown nodes and document-layout changes decline atomically', () => withPage(async (page) => {
    const result = await page.evaluate((html) => {
        const root = document.querySelector('#root'); root.innerHTML = html;
        const body = root.firstElementChild;
        const before = body.innerHTML;
        const invalid = body.cloneNode(true);
        invalid.querySelector('.tm-whiteboard-doc-body').insertAdjacentHTML('beforeend', '<div>Unknown widget</div>');
        const layout = body.cloneNode(true);
        layout.querySelector('.tm-whiteboard-doc').setAttribute('data-doc-id', 'another-doc');
        return { invalid: __tmTryReconcileWhiteboardBodies(body, invalid),
            layout: __tmTryReconcileWhiteboardBodies(body, layout), unchanged: body.innerHTML === before };
    }, whiteboardFixture());
    assert.deepEqual(result, { invalid: false, layout: false, unchanged: true });
}));

test('Gantt scoped refresh preserves the axis, layers and unchanged rows; scale changes rebuild', () => withPage(async (page) => {
    await page.evaluate(() => {
        Object.assign(window, {
            state: {}, SettingsStore: { data: {} },
            esc: (v) => String(v || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;'),
            __tmIsDarkMode: () => false, __tmGetDocColorHex: () => '#888888',
            __tmGetTaskCardFieldList: () => [], __tmNormalizeTimelineCardFields: () => ['title'],
            __tmGetStatusOptions: () => [], __tmRenderLucideIcon: () => '', __tmPhosphorBoldSvg: () => '',
            __tmResolveTaskStatusDisplayOption: () => ({ name: 'todo', color: '#888888' }),
            API: { getTaskTitlePresentation: (markdown, content) => ({ text: content, html: content }) },
            __tmIsTaskDoneEffective: (task) => !!task?.done,
            __tmGetAllTaskLinks: () => [], __tmIsTaskLinkEndpointSubtask: () => false,
            __tmBuildTooltipAttrs: () => '',
            __tmRuntimeEvents: { on: (target, event, fn, options) => target.addEventListener(event, fn, options),
                off: (target, event, fn, options) => target.removeEventListener(event, fn, options) },
        });
        document.querySelector('#root').innerHTML = '<div id="header"></div><div id="gantt"></div>';
    });
    const ganttSource = read('shell/82-gantt-runtime.js');
    // This manifest fragment also closes the outer application wrapper and
    // starts SiYuan's plugin. Execute just the complete Gantt IIFE here.
    await page.addScriptTag({ content: ganttSource.slice(0, ganttSource.indexOf("    if (document.readyState === 'loading')")) });
    const result = await page.evaluate(() => {
        const body = document.querySelector('#gantt'), header = document.querySelector('#header');
        const tasks = { a: { id: 'a', content: 'A', root_id: 'doc', startDate: '2026-09-20', completionTime: '2026-09-22' },
            b: { id: 'b', content: 'B', root_id: 'doc', startDate: '2026-09-21', completionTime: '2026-09-23' } };
        const viewState = { scale: 'day', paddingDays: 2 };
        const rows = ['a', 'b'].map((id) => ({ type: 'task', id, taskId: id, depth: 0 }));
        const options = { headerEl: header, bodyEl: body, rowModel: rows, rangeRowModel: rows, viewState, getTaskById: (id) => tasks[id] };
        __TaskHorizonGanttView.render(options);
        const inner = body.querySelector('.tm-gantt-body-inner'), axis = header.firstElementChild;
        const a = body.querySelector('[data-id="a"]'), b = body.querySelector('[data-id="b"]');
        tasks.b.content = 'B changed';
        __TaskHorizonGanttView.render({ ...options, rowModel: [rows[1], rows[0]], taskIds: ['b'] });
        const scoped = { inner: inner === body.querySelector('.tm-gantt-body-inner'), axis: axis === header.firstElementChild,
            a: a === body.querySelector('[data-id="a"]'), b: b !== body.querySelector('[data-id="b"]'),
            order: Array.from(body.querySelectorAll('.tm-gantt-row[data-id]')).map((row) => row.dataset.id),
            title: body.querySelector('[data-id="b"]').textContent.includes('B changed') };
        viewState.scale = 'week';
        __TaskHorizonGanttView.render({ ...options, taskIds: ['a'] });
        return { scoped, scaleRebuilt: inner !== body.querySelector('.tm-gantt-body-inner'),
            toolbars: document.querySelectorAll('.tm-timeline-selection-toolbar').length };
    });
    assert.deepEqual(result, { scoped: { inner: true, axis: true, a: true, b: true, order: ['b', 'a'], title: true },
        scaleRebuilt: true, toolbars: 1 });
}));
