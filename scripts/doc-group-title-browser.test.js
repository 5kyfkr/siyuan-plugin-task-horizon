'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('./i18n-browser-fixture');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('src/task-horizon/manifest.main.json'));
let runtime = manifest.scripts.map(file => read('src/task-horizon/' + file)).join('\n');
const startup = runtime.lastIndexOf("    if (document.readyState === 'loading') {");
assert.ok(startup > 0);
runtime = runtime.slice(0, startup) + `
    window.groupTitleTest = {
        state, SettingsStore, applyFilters,
        mount(view, options = {}) {
            __tmCleanupKanbanLaneAppearance();
            __tmKanbanColsHtmlCache = null;
            state.viewMode = view;
            applyFilters();
            if (view === 'timeline') options.rowModel = __tmBuildTaskRowModel();
            const builders = {
                kanban: __tmBuildRenderSceneKanbanBodyHtml,
                checklist: __tmBuildRenderSceneChecklistBodyHtml,
                list: __tmBuildRenderSceneListBodyHtml,
                timeline: __tmBuildRenderSceneTimelineBodyHtml,
                whiteboard: __tmBuildRenderSceneWhiteboardBodyHtml,
            };
            state.modal.innerHTML = builders[view](options);
        },
    };
    SettingsStore.loaded = true;
    SettingsStore.save = async () => {};
    WhiteboardStore.loaded = true;
    WhiteboardStore.scheduleSave = () => {};
})();`;

(async () => {
    const server = http.createServer((_req, res) => {
        res.setHeader('Content-Type', 'text/html');
        res.end('<!doctype html><html><body></body></html>');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.goto('http://127.0.0.1:' + server.address().port);
        await page.route('**/api/**', route => route.fulfill({ json: { code: 0, data: [] } }));
        await page.addStyleTag({ content: read('task-horizon.css') });
        await page.addScriptTag({ content: runtime });
        await page.evaluate(() => {
            const { state, SettingsStore: store } = groupTitleTest;
            const host = document.createElement('main');
            host.className = 'tm-modal';
            host.style.cssText = 'position:relative;inset:0;transform:none;width:100%;height:760px;background:var(--tm-bg-color);color:var(--tm-text-color);--tm-font-size:14px;--tm-bg-color:#f8fafb;--tm-header-bg:#eef2f4;--tm-text-color:#29353b;--tm-secondary-text:#64747b;--tm-primary-color:#307baa;--tm-border-color:#d6dfe3;font:14px/1.5 sans-serif;';
            document.body.append(host);
            state.modal = host;
            const docIds = ['20261104000000-aaaaaaa', '20261104000000-bbbbbbb'];
            const heading = "((20261104000000-ccccccc '阶段引用')) / [阶段链接](https://example.com/heading)";
            const name = "((20261104000000-ccccccc '文档引用')) / [文档链接](https://example.com/doc)";
            const tasks = docIds.map((root_id, index) => ({
                id: '20261104000000-' + ['ddddddd', 'eeeeeee'][index], root_id,
                content: '示例任务 ' + index, markdown: '- [ ] 示例任务 ' + index,
                h2: heading, h2Id: '20261104000000-fffffff', headingLevel: 'h2',
                startDate: '2026-11-04', dueDate: '2026-11-05',
                done: false, customStatus: 'todo', children: [],
            }));
            state.taskTree = docIds.map((id, index) => ({ id, name: index ? '普通文档 & 名称' : name, tasks: [tasks[index]] }));
            state.allDocuments = state.taskTree.slice();
            state.flatTasks = Object.fromEntries(tasks.map(task => [task.id, task]));
            state.__tmLoadedDocIdsForTasks = docIds;
            Object.assign(state, {
                activeDocId: 'all', showCompletedTasks: false, rule: {}, filterRules: [],
                groupByDocName: true, groupByTime: false, groupByTaskName: false,
                quadrantEnabled: false, searchKeyword: '', otherBlocks: [], collapsedGroups: new Set(),
            });
            Object.assign(store.data, {
                currentGroupId: 'all', newTaskDocId: '', selectedDocIds: docIds,
                docH2SubgroupEnabled: true, taskHeadingLevel: 'h2', checklistCompactMode: true,
                kanbanBoardMode: 'heading', kanbanAppearance: 'lanes',
                completedTasksInlineInGroups: true, whiteboardAllTabsLayoutMode: 'docs',
            });
            __tmTaskStore.acceptAuthoritative(tasks, { replaceAll: true, replaceDocuments: true, docIds, replaceStructure: true });
            window.openedDocs = [];
            window.tmOpenDocById = id => openedDocs.push(id);
        });
        const checkTitle = async (selector, reference, link) => {
            const title = page.locator(selector).filter({ hasText: reference }).first();
            assert.ok(await title.count(), selector + ' must exist');
            assert.equal(await title.locator('.tm-task-title-block-ref__text').first().textContent(), reference);
            if (link) assert.equal(await title.locator('.tm-task-title-link').first().getAttribute('data-tm-title-link-href'), link);
            assert.doesNotMatch(await title.textContent(), /\(\(2026|\]\(https:/);
            return title;
        };
        for (const view of ['checklist', 'list', 'timeline', 'kanban']) {
            await page.evaluate(view => groupTitleTest.mount(view), view);
            await checkTitle(view === 'kanban' ? '.tm-kanban-col-title-text' : '.tm-group-label, .tm-checklist-group-label', '文档引用', 'https://example.com/doc');
            assert.ok((await page.locator('.tm-modal').textContent()).includes('普通文档 & 名称'));
        }
        const docTitle = page.locator('.tm-kanban-col-title-text').filter({ hasText: '文档引用' });
        assert.equal(await docTitle.getAttribute('title'), '点击跳转至文档：文档引用 / 文档链接');
        await docTitle.click();
        assert.deepEqual(await page.evaluate(() => openedDocs), ['20261104000000-aaaaaaa']);
        await page.evaluate(() => {
            groupTitleTest.SettingsStore.data.kanbanBoardMode = 'status';
            groupTitleTest.mount('kanban');
        });
        await checkTitle('.tm-kanban-group-title', '文档引用', 'https://example.com/doc');
        await page.evaluate(() => {
            groupTitleTest.SettingsStore.data.kanbanBoardMode = 'heading';
            groupTitleTest.state.activeDocId = '20261104000000-aaaaaaa';
            groupTitleTest.mount('kanban');
        });
        const headingTitle = await checkTitle('.tm-kanban-col-title-text', '阶段引用');
        assert.ok((await headingTitle.textContent()).includes('阶段链接'));
        for (const layout of ['board', 'stream', 'global']) {
            await page.evaluate(layout => {
                groupTitleTest.state.activeDocId = 'all';
                groupTitleTest.SettingsStore.data.whiteboardAllTabsLayoutMode = layout;
                groupTitleTest.mount('whiteboard');
            }, layout);
            await checkTitle(layout === 'board' ? '.tm-whiteboard-doc-head'
                : layout === 'stream' ? '.tm-whiteboard-stream-doc-title' : '.tm-whiteboard-pool-doc-name',
            '文档引用', 'https://example.com/doc');
        }
        await page.evaluate(() => groupTitleTest.mount('kanban'));
        const output = path.join(root, 'output/playwright');
        fs.mkdirSync(output, { recursive: true });
        await page.screenshot({ path: path.join(output, 'doc-group-title-desktop.png') });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.evaluate(() => groupTitleTest.mount('kanban', { isMobile: true }));
        await checkTitle('.tm-kanban-col-title-text', '文档引用', 'https://example.com/doc');
        const navLabel = await page.locator('.tm-kanban-board-nav__item').first().textContent();
        assert.equal(navLabel, '文档引用 / 文档链接');
        await page.screenshot({ path: path.join(output, 'doc-group-title-mobile.png') });
        assert.deepEqual(errors, [], 'group names must render without browser errors');
        console.log('document and heading group title browser tests passed');
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
