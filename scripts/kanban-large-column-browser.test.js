'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const { chromium } = require('./i18n-browser-fixture');
const root = path.resolve(__dirname, '..');
const baseline = process.argv.includes('--baseline');
const changedRuntimeFiles = new Set(['src/task-horizon/main/21-view-render-state.js',
    'src/task-horizon/main/40-render-runtime.js', 'src/task-horizon/main/render/43-render-timeline-kanban-calendar-body.js', 'task-horizon.css']);
const read = file => baseline && changedRuntimeFiles.has(file)
    ? execFileSync('git', ['show', 'HEAD:' + file], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
    : fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('src/task-horizon/manifest.main.json'));
let runtime = manifest.scripts.map(file => read('src/task-horizon/' + file)).join('\n');
const cardStart = 'const renderCard = (task, depthInCol, isSub, isChildRoot, parentTxt, childrenHtml, toggleHtml, isParent, inCompletedRootGroup = false, usePassedTask = false) => {';
assert.ok(runtime.includes(cardStart));
runtime = runtime.replace(cardStart, cardStart + '\nwindow.largeBoardTest.cardRenders++;');
const startup = runtime.lastIndexOf("    if (document.readyState === 'loading') {");
runtime = runtime.slice(0, startup) + `
    window.largeBoardTest = { state, SettingsStore, cardRenders: 0,
        cancel: __tmCancelProgressiveViewRender,
        mount: function(options) {
            __tmCancelProgressiveViewRender();
            const tasks = Array.from({ length: options.count }, (_, i) => ({
                id: 'task-' + i, root_id: 'doc-one', content: 'Task ' + i,
                markdown: options.done ? '- [X] Task ' + i : '- [ ] Task ' + i,
                done: options.done, taskMarker: options.done ? 'X' : ' ',
                taskCompleteAt: new Date(Date.UTC(2026, 10, 16 - (options.dates ? Math.floor(i / 5) : 0))).toISOString(), children: [],
            }));
            Object.assign(SettingsStore.data, { currentGroupId: 'all', enableTomatoIntegration: false,
                kanbanBoardMode: 'heading', kanbanShowDoneColumn: true,
                completedTasksInlineInGroups: options.inline !== false && !options.dates, completedTasksGroupBy: 'date',
                kanbanCardFields: [], kanbanAppearance: 'classic', kanbanFillColumns: false });
            Object.assign(state, { modal: document.getElementById('host'), viewMode: options.combo ? 'comboBoard' : 'kanban',
                activeDocId: options.inline === false || options.dates ? 'doc-one' : 'all', showCompletedTasks: true, groupByDocName: false, groupByTime: false,
                groupByTaskName: false, quadrantEnabled: false, currentRule: null, rule: {}, searchKeyword: '',
                collapsedGroups: new Set(), expandedCompletedGroups: new Set(),
                listRenderLimit: 1,
                taskTree: [{ id: 'doc-one', name: 'Tasks', tasks }], allDocuments: [{ id: 'doc-one', name: 'Tasks' }],
                flatTasks: Object.fromEntries(tasks.map(task => [task.id, task])), filteredTasks: tasks, otherBlocks: [] });
            __tmTaskStore.replaceFlat(state.flatTasks, { authoritative: true, mergeOtherBlocks: false });
            state.customBoardProjection = options.combo ? [{ id: 'one', name: 'One', groupMode: options.group || 'doc', tasks }] : [];
            if (options.combo && options.dates) state.expandedCompletedGroups.add(__tmBuildCompletedRootGroupKey('combination:one'));
            state.renderKanbanBodyHtml = () => __tmBuildRenderSceneKanbanBodyHtml({ fullShell: true,
                customBoardColumns: options.combo ? state.customBoardProjection : undefined });
            this.cardRenders = 0;
            const started = performance.now();
            state.modal.innerHTML = state.renderKanbanBodyHtml();
            state.modal.setAttribute('data-tm-render-mode', state.viewMode);
            this.bind();
            return { ms: performance.now() - started, renders: this.cardRenders };
        },
        bind: function() { return __tmScheduleProgressiveViewRender(state.viewMode, state.__tmProgressiveViewRender); },
        load: function() {
            const entry = state.__tmProgressiveViewRender?.columns?.find(item => !item.done);
            const before = this.cardRenders;
            const started = performance.now();
            const result = entry?.loadNextBatch(state.modal);
            if (result?.done) entry.done = true;
            return { result, renders: this.cardRenders - before, ms: performance.now() - started };
        },
        expand: function(key) { return tmToggleGroupCollapse(key); },
    };
    SettingsStore.loaded = WhiteboardStore.loaded = MetaStore.loaded = true;
    SettingsStore.save = async () => {};
})();`;

(async () => {
    const server = http.createServer((_req, res) => res.end('<!doctype html><html><body><main id="host"></main></body></html>'));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    const failures = [];
    const metrics = [];
    try {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
        page.setDefaultTimeout(4000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('http://127.0.0.1:' + server.address().port);
        await page.route('**/api/**', route => route.fulfill({ json: { code: 0, data: [] } }));
        await page.addStyleTag({ content: read('task-horizon.css') + `
            #host { width: 1000px; height: 750px; }
            .tm-body--kanban { height: 680px; }
            .tm-kanban-col-body { height: 580px; max-height: 580px; overflow-y: auto; }
        ` });
        await page.addScriptTag({ content: runtime });
        async function check(name, fn) {
            try { await fn(); } catch (error) {
                failures.push(name + ': ' + error.message);
                console.log(name, await page.evaluate(() => ({
                    groups: Array.from(document.querySelectorAll('.tm-kanban-group-title')).slice(0, 4).map(el => ({ key: el.dataset.groupKey, expanded: el.getAttribute('aria-expanded') })),
                    expanded: Array.from(largeBoardTest.state.expandedCompletedGroups),
                    deferred: document.querySelectorAll('[data-tm-kanban-deferred-group]').length,
                    job: largeBoardTest.state.__tmProgressiveViewRender?.status,
                    cards: document.querySelectorAll('.tm-kanban-card').length,
                })));
            }
            await page.evaluate(() => largeBoardTest.cancel());
        }
        for (const combo of [false, true]) for (const done of [false, true]) {
            await check('idle and continuation ' + JSON.stringify({ combo, done }), async () => {
                const first = await page.evaluate(options => largeBoardTest.mount(options), { combo, done, count: 10000 });
                await page.waitForTimeout(450);
                const idle = await page.locator('.tm-kanban-card').count();
                metrics.push({ combo, done, first, idle });
                assert.ok(idle > 0 && idle <= 30, 'idle columns must stop loading, got ' + idle);
                const batch = await page.evaluate(() => largeBoardTest.load());
                metrics[metrics.length - 1].batch = batch;
                assert.equal(batch.renders, 10, 'continuation must decorate only the next ten cards');
                assert.equal(await page.locator('.tm-kanban-card').count(), idle + 10);
                const original = await page.locator('.tm-kanban-card').first().elementHandle();
                await page.evaluate(() => {
                    const body = document.querySelector('.tm-kanban-col-body');
                    body.scrollTop = body.scrollHeight;
                    body.dispatchEvent(new Event('scroll'));
                });
                await page.waitForFunction(n => document.querySelectorAll('.tm-kanban-card').length > n, idle + 10, { timeout: 2000 });
                assert.equal(await original.evaluate(el => el.isConnected), true);
            });
        }
        for (const combo of [false, true]) await check('all dates load ' + combo, async () => {
            await page.evaluate(combo => largeBoardTest.mount({ combo, done: true, count: 209, dates: true }), combo);
            await page.waitForTimeout(250);
            assert.ok(await page.locator('.tm-kanban-group--completed-subgroup').count() > 1, 'fixture must exercise real completion date groups');
            for (let batch = 0; batch < 30; batch++) {
                const progress = await page.evaluate(() => {
                    const body = document.querySelector('.tm-kanban-col-body');
                    const cards = body.querySelectorAll('.tm-kanban-card').length;
                    const groups = Array.from(body.querySelectorAll('.tm-kanban-group'))
                        .filter(group => getComputedStyle(group).display !== 'none');
                    const empty = groups.filter(group => !group.querySelector('.tm-kanban-card')
                        && group.querySelector('.tm-kanban-group-title')?.getAttribute('aria-expanded') === 'true').length;
                    body.scrollTop = body.scrollHeight;
                    body.dispatchEvent(new Event('scroll'));
                    return { cards, empty };
                });
                assert.equal(progress.empty, 0, 'expanded dates must not show empty future headers');
                if (progress.cards === 209) break;
                await page.waitForFunction(n => document.querySelectorAll('.tm-kanban-card').length > n,
                    progress.cards, { timeout: 2000 });
            }
            assert.equal(await page.locator('.tm-kanban-card').count(), 209, 'the earliest completion must be reachable by scrolling');
            assert.equal(await page.locator('.tm-kanban-card').evaluateAll(nodes => new Set(nodes.map(node => node.dataset.id)).size), 209);
            assert.equal(await page.evaluate(() => largeBoardTest.state.listRenderLimit), 1, 'column loading must remain independent of the checklist window');
        });
        await check('replaced column scroll listener', async () => {
            await page.evaluate(() => largeBoardTest.mount({ combo: false, done: true, count: 1116 }));
            await page.waitForTimeout(200);
            await page.evaluate(() => {
                const column = document.querySelector('.tm-kanban-col');
                column.replaceWith(column.cloneNode(true));
                largeBoardTest.bind();
            });
            await page.waitForTimeout(200);
            const before = await page.locator('.tm-kanban-card').count();
            await page.evaluate(() => {
                const body = document.querySelector('.tm-kanban-col-body');
                body.scrollTop = body.scrollHeight;
                body.dispatchEvent(new Event('scroll'));
            });
            await page.waitForFunction(n => document.querySelectorAll('.tm-kanban-card').length > n, before, { timeout: 2000 });
        });
        await check('collapsed completed group stays lazy', async () => {
            await page.evaluate(() => largeBoardTest.mount({ combo: true, done: true, inline: false, count: 10000 }));
            await page.waitForTimeout(450);
            assert.equal(await page.locator('.tm-kanban-card').count(), 0);
            const key = await page.locator('.tm-kanban-group-title').first().getAttribute('data-group-key');
            await page.evaluate(key => largeBoardTest.expand(key), key);
            await page.waitForFunction(() => document.querySelectorAll('.tm-kanban-card').length > 0, null, { timeout: 2000 });
            assert.ok(await page.locator('.tm-kanban-card').count() <= 30);
        });
        assert.deepEqual(errors, []);
        for (const combo of [false, true]) await check('late batch cost ' + combo, async () => {
            await page.evaluate(combo => largeBoardTest.mount({ combo, done: true, count: 10000 }), combo);
            await page.evaluate(() => {
                const job = largeBoardTest.state.__tmProgressiveViewRender;
                if (job.viewportTimer) clearTimeout(job.viewportTimer);
                job.viewportTimer = 0;
                job.batchSize = 990;
                largeBoardTest.load();
                job.batchSize = 10;
            });
            const before = await page.locator('.tm-kanban-card').count();
            const batch = await page.evaluate(() => largeBoardTest.load());
            metrics.push({ combo, loaded: before, lateBatch: batch });
            assert.equal(batch.renders, 10, 'a deep batch must not regenerate the thousand mounted cards');
            assert.equal(await page.locator('.tm-kanban-card').count(), before + 10);
        });
        for (const combo of [false, true]) await check('mobile dates ' + combo, async () => {
            await page.setViewportSize({ width: 390, height: 844 });
            await page.addStyleTag({ content: '#host { width: 390px; }' });
            await page.evaluate(combo => largeBoardTest.mount({ combo, done: true, count: 1173, dates: true }), combo);
            await page.waitForTimeout(200);
            const before = await page.locator('.tm-kanban-card').count();
            await page.evaluate(() => {
                const body = document.querySelector('.tm-kanban-col-body');
                body.scrollTop = body.scrollHeight;
                body.dispatchEvent(new Event('scroll'));
            });
            await page.waitForFunction(n => document.querySelectorAll('.tm-kanban-card').length > n, before, { timeout: 2000 });
        });
        const output = path.join(root, 'output/playwright');
        fs.mkdirSync(output, { recursive: true });
        fs.writeFileSync(path.join(output, 'kanban-large-column-' + (baseline ? 'before' : 'after') + '.json'),
            JSON.stringify({ baseline, metrics, failures }, null, 2));
        console.log(JSON.stringify({ baseline, metrics, failures }, null, 2));
        if (!baseline) assert.deepEqual(failures, []);
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
