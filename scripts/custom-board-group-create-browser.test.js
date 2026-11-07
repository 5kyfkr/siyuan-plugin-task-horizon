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
    window.customBoardTest = { state, SettingsStore, plan: __tmBuildTaskEnhanceLoadPlan,
        mount(columns) {
            __tmKanbanColsHtmlCache = null;
            state.modal.innerHTML = __tmBuildRenderSceneKanbanBodyHtml({ customBoardColumns: columns });
        }
    };
    SettingsStore.loaded = true;
    SettingsStore.save = async () => {};
})();`;

(async () => {
    const server = http.createServer((_req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('<!doctype html><html><body></body></html>');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
        page.setDefaultTimeout(5000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('http://127.0.0.1:' + server.address().port);
        await page.route('**/api/**', route => route.fulfill({ json: { code: 0, data: [] } }));
        await page.addStyleTag({ content: read('task-horizon.css') });
        await page.addScriptTag({ content: runtime });
        const ids = await page.evaluate(() => {
            const { state, SettingsStore: store } = customBoardTest;
            const docA = '20261107000000-aaaaaaa', docB = '20261107000000-bbbbbbb';
            const headingA = '20261107000000-hhhhhha', headingB = '20261107000000-hhhhhhb';
            const task = (id, docId, headingId, rank, extra = {}) => ({
                id, root_id: docId, content: id, done: false, children: [],
                ...(headingId ? { h2: '计划', h2Id: headingId, h2Rank: rank } : {}), ...extra,
            });
            const child = task('child', docA, headingA, 0, { parentTaskId: 'parent' });
            const tasks = [
                task('parent', docA, headingA, 0, { children: [child] }), child,
                task('second-heading', docA, headingB, 1), task('no-heading', docA, '', 0),
                task('completed', docA, headingA, 0, { done: true }),
                task('other-doc', docB, headingA, 0),
            ];
            state.taskTree = [{ id: docA, name: '工作文档', tasks: tasks.filter(t => t.root_id === docA && !t.parentTaskId) },
                { id: docB, name: '另一文档', tasks: tasks.filter(t => t.root_id === docB) }];
            state.allDocuments = state.taskTree.slice();
            Object.assign(state, {
                viewMode: 'comboBoard', activeDocId: 'all', showCompletedTasks: true,
                groupByDocName: false, groupByTime: false, groupByTaskName: false,
                quadrantEnabled: false, currentRule: null, rule: {}, filterRules: [],
                otherBlocks: [], searchKeyword: '', collapsedGroups: new Set(), filteredTasks: tasks,
            });
            Object.assign(store.data, {
                currentGroupId: 'all', newTaskDocId: '', taskHeadingLevel: 'h2', columnOrder: [],
                kanbanBoardMode: 'status', kanbanAppearance: 'lanes', kanbanFillColumns: false,
                docH2SubgroupEnabled: false, completedTasksInlineInGroups: false,
                completedTasksTodayOnly: false, enableTomatoIntegration: false,
            });
            __tmTaskStore.acceptAuthoritative(tasks, { replaceAll: true, replaceDocuments: true,
                docIds: [docA, docB], replaceStructure: true });
            const manager = document.createElement('main');
            manager.className = 'tm-modal';
            manager.style.cssText = 'position:relative;inset:0;width:100%;height:800px;--tm-font-size:14px;--tm-bg-color:#f8fafb;--tm-header-bg:#eef2f4;--tm-text-color:#29353b;--tm-secondary-text:#64747b;--tm-primary-color:#307baa;--tm-border-color:#d6dfe3;--card:#fcfdfd;--border:#d6dfe3;font:14px/1.5 sans-serif;';
            document.body.append(manager);
            state.modal = manager;
            window.testColumns = [
                { id: 'groups', name: '跨文档', groupMode: 'doc', scope: { mode: 'groups', groupIds: ['group-a'] }, tasks },
                { id: 'single', name: '指定单个文档', groupMode: 'doc', scope: { mode: 'docs', docIds: [docA] }, tasks: tasks.filter(t => t.root_id === docA) },
                { id: 'multiple', name: '指定多个文档', groupMode: 'doc', scope: { mode: 'docs', docIds: [docA, docB] }, tasks },
                { id: 'ungrouped', name: '不分组', groupMode: 'none', scope: { mode: 'docs', docIds: [docA] }, tasks: tasks.filter(t => t.root_id === docA) },
            ];
            store.data.customBoardSets = [{ id: 'set-test', name: 'Test', boards: testColumns }];
            store.data.activeCustomBoardSetId = 'set-test';
            window.createCalls = [];
            window.tmQuickAddOpen = async options => { createCalls.push(options); return options; };
            return { docA, docB, headingA, headingB };
        });
        const plan = await page.evaluate(() => customBoardTest.plan({ viewMode: 'comboBoard', colOrder: [] }));
        assert.equal(plan.needH2, true, 'specified-document grouping needs heading data even when ordinary heading grouping is off');
        assert.equal(plan.docHeadingSubgroupActive, true, 'heading enhancement must finish before committing the projection');

        for (const width of [1100, 390]) {
            await page.setViewportSize({ width, height: 850 });
            await page.evaluate(() => customBoardTest.mount(testColumns));
            const lane = id => page.locator(`[data-col-key="custom:${id}"]`);
            const groups = lane('groups');
            const docRows = groups.locator('.tm-kanban-group-title[data-tm-kb-drop-kind="doc"]');
            assert.equal(await docRows.count(), 2);
            assert.equal(await docRows.locator('.tm-kanban-group-add').count(), 2,
                'each document group must expose a create button');
            assert.equal(await groups.locator('[data-group-key*="\:h2\:"]').count(), 0,
                'a document-group scope keeps document rows');
            await docRows.filter({ hasText: '另一文档' }).locator('.tm-kanban-group-add').click();
            assert.deepEqual(await page.evaluate(() => createCalls.at(-1)), { docId: ids.docB, headingId: '' });

            const single = lane('single');
            const headingRows = single.locator('.tm-kanban-group-title[data-group-key*="\:h2\:"]');
            assert.equal(await headingRows.count(), 3, 'same-name headings stay separate and unheaded tasks retain their own group');
            assert.equal(await single.locator('.tm-kanban-group-title[data-tm-kb-drop-kind="doc"]').count(), 0,
                'a single specified document shows headings directly');
            const headingRow = single.locator(`[data-group-key*="${ids.headingB}"]`);
            await headingRow.locator('.tm-kanban-group-add').click();
            assert.deepEqual(await page.evaluate(() => createCalls.at(-1)), { docId: ids.docA, headingId: ids.headingB });
            assert.equal(await headingRow.getAttribute('aria-expanded'), 'true', 'clicking create must not collapse the group');
            await headingRows.filter({ hasText: '无二级标题' }).locator('.tm-kanban-group-add').click();
            assert.deepEqual(await page.evaluate(() => createCalls.at(-1)), { docId: ids.docA, headingId: '__none__' });
            assert.equal(await single.locator('[data-id="child"]').count(), 1, 'a child stays with its parent without duplication');
            assert.match(await single.locator('.tm-kanban-col-body > .tm-kanban-group').last().textContent(), /已完成/);
            assert.equal(await lane('multiple').locator('.tm-kanban-group-title[data-tm-kb-drop-kind="doc"]').count(), 2);
            assert.equal(await lane('multiple').locator('.tm-kanban-group-title[data-group-key*="\:h2\:"]').count(), 4,
                'each specified document contains its own heading groups');
            assert.equal(await lane('ungrouped').locator('[data-group-key*="\:h2\:"]').count(), 0);
        }
        const ordinaryScopePlan = await page.evaluate(() => {
            customBoardTest.SettingsStore.data.customBoardSets[0].boards = testColumns.filter(column => column.id === 'groups');
            return customBoardTest.plan({ viewMode: 'comboBoard', colOrder: [] });
        });
        assert.equal(ordinaryScopePlan.needH2, false, 'document-group scopes must not add unnecessary heading reads');
        assert.deepEqual(errors, [], 'combination-board group actions must cause no browser errors');
        console.log('custom-board group creation and heading browser tests passed');
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
