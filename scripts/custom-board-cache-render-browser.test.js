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
    window.comboTest = { state, SettingsStore, render, setMount: __tmSetMount, project: __tmBuildCustomBoardProjection,
        restore: __tmTryRestoreCachedCustomBoardProjection,
        changed: () => __tmGetChangedCachedCustomBoardDocIds(__tmCustomBoardProjectionCache.get('set-test')),
        tryRefresh: globalThis.__tmTryRefreshKanbanColumns,
        returnScope: __tmRememberCustomBoardReturnScope, cancel: __tmCancelProgressiveViewRender,
        html: () => __tmBuildRenderSceneKanbanBodyHtml({ customBoardColumns: state.customBoardProjection }),
        snapshotView: __tmBuildTaskSnapshotViewState, restoreSnapshotView: __tmRestoreTaskSnapshotViewState,
        refreshCache: () => __tmScheduleCustomBoardProjectionRefresh('set-test'),
        fullLoads: 0, batches: [], verifies: 0,
    };
    SettingsStore.loaded = WhiteboardStore.loaded = MetaStore.loaded = true;
    SettingsStore.save = async () => {};
    __tmScheduleSilentCacheVerifyAfterFirstPaint = () => { comboTest.verifies++; return true; };
    loadSelectedDocuments = async () => { comboTest.fullLoads++; return false; };
    __tmRefreshAffectedDocsIncrementally = async options => { comboTest.batches.push(options.docIds); return true; };
})();`;

(async () => {
    const server = http.createServer((_req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('<!doctype html><html><body><div id="host" style="height:850px;width:100%"></div></body></html>');
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
        await page.addStyleTag({ content: read('src/basecoat/basecoat.css') + read('task-horizon.css') });
        await page.addScriptTag({ content: runtime });
        const first = await page.evaluate(() => {
            const { state, SettingsStore: store } = comboTest;
            window.docs = Array.from({ length: 25 }, (_, i) => '20261107000000-' + String(i + 1).padStart(7, '0'));
            window.tasks = Array.from({ length: 180 }, (_, i) => ({
                id: '20261107100000-' + String(i + 1).padStart(7, '0'), root_id: docs[i % docs.length],
                content: 'Task ' + i, markdown: '- [ ] Task ' + i, done: false, children: [],
            }));
            Object.assign(store.data, { currentGroupId: 'all', newTaskDocId: '', selectedDocIds: docs,
                enabledViews: ['checklist', 'kanban', 'comboBoard'], kanbanAppearance: 'lanes', kanbanFillColumns: false,
                enableTomatoIntegration: false, docH2SubgroupEnabled: false, excludeCompletedTasks: true });
            Object.assign(state, { viewMode: 'checklist', viewModeInitialized: true, activeDocId: 'all',
                showCompletedTasks: false, otherBlocks: [], currentRule: null, filterRules: [], rule: {},
                searchKeyword: '', homepageOpen: false, attachmentLibraryOpen: false, groupByDocName: true });
            state.taskTree = docs.map(id => ({ id, name: id, tasks: tasks.filter(t => t.root_id === id) }));
            state.allDocuments = state.taskTree.slice();
            state.flatTasks = Object.fromEntries(tasks.map(t => [t.id, t]));
            state.__tmLoadedDocIdsForTasks = docs.slice();
            __tmTaskStore.acceptAuthoritative(tasks, { replaceDocuments: true, replaceStructure: true, docIds: docs });
            comboTest.returnScope();
            store.data.customBoardSets = [{ id: 'set-test', name: 'Test', boards: [
                { id: 'a', name: 'A', groupMode: 'none', scope: { mode: 'docs', docIds: docs } },
                { id: 'b', name: 'B', groupMode: 'none', scope: { mode: 'docs', docIds: docs } },
                { id: 'c', name: 'C', groupMode: 'none', scope: { mode: 'docs', docIds: docs.slice(1) } },
                { id: 'd', name: 'D', groupMode: 'none', scope: { mode: 'docs', docIds: docs } },
            ] }];
            store.data.activeCustomBoardSetId = 'set-test';
            state.__tmCustomBoardSourceDocIdsByBoard = Object.fromEntries(store.data.customBoardSets[0].boards.map(b => [b.id, b.scope.docIds]));
            state.viewMode = 'comboBoard';
            comboTest.project();
            comboTest.setMount(document.getElementById('host'));
            const startedAt = performance.now();
            comboTest.render();
            return { cards: document.querySelectorAll('.tm-kanban-card').length,
                columns: document.querySelectorAll('.tm-kanban-col').length, total: state.filteredTasks.length,
                renderMs: +(performance.now() - startedAt).toFixed(1) };
        });
        assert.equal(first.columns, 4);
        assert.equal(first.total, 180);
        assert.ok(first.cards > 0 && first.cards <= 40, 'initial render must bound cards rather than create all repeated occurrences: ' + JSON.stringify(first));
        console.log('combination-board initial paint:', first);
        const firstCard = await page.locator('[data-col-key="custom:a"] .tm-kanban-card').first().elementHandle();
        const nextBatch = await page.evaluate(() => {
            const before = document.querySelector('[data-col-key="custom:a"]').querySelectorAll('.tm-kanban-card').length;
            const job = comboTest.state.__tmProgressiveViewRender;
            job.columns.find(c => c.key === 'custom:a').loadNextBatch(comboTest.state.modal);
            return { before, after: document.querySelector('[data-col-key="custom:a"]').querySelectorAll('.tm-kanban-card').length };
        });
        assert.equal(await firstCard.evaluate(el => el.isConnected), true, 'loading the next batch preserves live card nodes');
        assert.equal(nextBatch.after, nextBatch.before + 10);
        assert.equal(await page.locator('[data-col-key="custom:a"] .tm-kanban-card').evaluateAll(nodes => new Set(nodes.map(n => n.dataset.id)).size), nextBatch.after);

        const unchanged = await page.evaluate(() => {
            __tmTaskStore.acceptAuthoritative(tasks, { replaceDocuments: true, replaceStructure: true, docIds: docs });
            return { changed: comboTest.changed(), restored: comboTest.restore() };
        });
        assert.deepEqual(unchanged, { changed: [], restored: true }, 'identical authoritative data must not invalidate cached document contents');

        await page.evaluate(() => {
            comboTest.project();
            comboTest.render();
            window.untouchedColumn = document.querySelector('[data-col-key="custom:c"]');
            window.untouchedCard = untouchedColumn.querySelector('.tm-kanban-card');
            __tmTaskStore.patchLocal(tasks[0].id, { content: 'Updated shared task', markdown: '- [ ] Updated shared task' });
            __tmRecomputeTaskProjection({ reason: 'test-combo-partial' });
            const rawHtml = comboTest.html();
            window.rawHtmlUpdated = rawHtml.includes('Updated shared task');
            window.rawDebug = { projection: comboTest.state.customBoardProjection.map(column => ({
                id: column.id, content: column.tasks.find(task => task.id === tasks[0].id)?.content,
            })), cards: Array.from(comboTest.state.modal.querySelectorAll('.tm-kanban-card')).slice(0, 8).map(card => card.textContent.trim()),
                generatedTasks: (rawHtml.match(/Task 0|Updated shared task/g) || []).slice(0, 10) };
            window.refreshResult = comboTest.tryRefresh(comboTest.state.modal, [tasks[0].id], {
                reason: 'test-combo-partial', __tmQueuedCommit: true,
            });
        });
        assert.equal(await page.evaluate(() => untouchedColumn === document.querySelector('[data-col-key="custom:c"]') && untouchedCard.isConnected), true,
            'changing a shared task must preserve an unrelated sub-board and its cards');
        assert.equal(await page.evaluate(() => refreshResult), true, 'changed shared cards must use the partial column refresh');
        assert.equal(await page.evaluate(() => rawHtmlUpdated), true,
            'the renderer must receive the updated combination-board projection: ' + JSON.stringify(await page.evaluate(() => rawDebug)));
        await page.waitForFunction(() => Array.from(document.querySelectorAll('[data-id="20261107100000-0000001"]'))
            .some(card => card.textContent.includes('Updated shared task')), null, { timeout: 3000 });
        assert.equal(await page.locator(`[data-col-key="custom:a"] [data-id="20261107100000-0000001"]`).count(), 1);
        assert.match(await page.locator(`[data-col-key="custom:a"] [data-id="20261107100000-0000001"]`).textContent(), /Updated shared task/);
        assert.match(await page.locator(`[data-col-key="custom:b"] [data-id="20261107100000-0000001"]`).textContent(), /Updated shared task/);

        for (const mode of ['checklist', 'comboBoard', 'kanban', 'comboBoard']) {
            await page.evaluate(mode => tmSwitchViewMode(mode), mode);
            await page.waitForFunction(mode => comboTest.state.modal.getAttribute('data-tm-render-mode') === mode, mode);
            assert.equal(await page.evaluate(() => comboTest.fullLoads), 0, 'unchanged scope round trips must use the existing memory cache');
        }
        assert.ok(await page.evaluate(() => comboTest.verifies) > 0, 'memory restores still schedule authoritative background checks');

        await page.evaluate(() => {
            const changed = tasks.map((task, index) => index < docs.length ? { ...task, priority: 'high' } : task);
            __tmTaskStore.replaceFlat(Object.fromEntries(changed.map(task => [task.id, task])), {
                authoritative: true, docIds: docs,
            });
            window.changedBeforeRefresh = comboTest.changed();
            comboTest.refreshCache();
        });
        assert.equal(await page.evaluate(() => changedBeforeRefresh.length), 25,
            'all changed documents must be detected before incremental refresh');
        await page.waitForFunction(() => comboTest.batches.length === 3);
        assert.deepEqual(await page.evaluate(() => comboTest.batches.map(b => b.length)), [12, 12, 1],
            'more than twelve changed documents must refresh in bounded batches');
        assert.equal(await page.evaluate(() => comboTest.fullLoads), 0);

        const viewRestore = await page.evaluate(() => {
            comboTest.cancel();
            comboTest.state.viewMode = 'checklist';
            const view = comboTest.snapshotView();
            const hit = !!comboTest.restoreSnapshotView({ viewState: view });
            __tmTaskStore.patchLocal(tasks[0].id, { priority: 'low' });
            return { hit, staleHit: !!comboTest.restoreSnapshotView({ viewState: view }) };
        });
        assert.deepEqual(viewRestore, { hit: true, staleHit: false }, 'cached filtered IDs are reusable only while their task content matches');
        assert.deepEqual(errors, [], 'cache and progressive refresh paths must cause no browser errors');
        console.log('combination-board cache round trips, bounded rendering, partial refresh and batch validation passed');
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
