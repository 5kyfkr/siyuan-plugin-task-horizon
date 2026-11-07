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
    window.kanbanLoadingTest = {
        state, SettingsStore, render,
        showPending: __tmShowViewSwitchPendingShell,
        clearPending: () => __tmClearViewSwitchPendingShell(state.modal),
        loading: __tmSetInlineLoading,
        open: openManager,
    };
    SettingsStore.loaded = true;
    WhiteboardStore.loaded = true;
    MetaStore.loaded = true;
    __tmEnsureSettingsLoaded = async () => SettingsStore.data;
    __tmPromptInitialNotebookGroupImportIfNeeded = async () => {};
    checkAnyGroupHasDocs = async () => kanbanLoadingTest.hasDocs !== false;
    showSettings = () => { kanbanLoadingTest.settingsShown = true; };
    __tmShortcuts.restoreSession = async () => false;
    __tmRefreshNotebookCache = async force => {
        if (force && !kanbanLoadingTest.notebookReady) await new Promise(resolve => {
            kanbanLoadingTest.releaseNotebook = () => { kanbanLoadingTest.notebookReady = true; resolve(); };
        });
        return state.notebooks;
    };
    loadSelectedDocuments = async options => {
        kanbanLoadingTest.loadOptions = options;
        __tmSetInlineLoading(true, { token: state.openToken, styleKind: options.loadingStyleKind, delayMs: options.loadingDelayMs });
        await new Promise(resolve => { kanbanLoadingTest.releaseLoad = resolve; });
        __tmSetInlineLoading(false);
        render();
        return true;
    };
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
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
        page.setDefaultTimeout(4000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('http://127.0.0.1:' + server.address().port);
        await page.route('**/api/**', route => route.fulfill({ json: { code: 0, data: [] } }));
        await page.addStyleTag({ content: read('src/basecoat/basecoat.css') + read('task-horizon.css') });
        await page.addScriptTag({ content: runtime });
        await page.evaluate(() => {
            globalThis.__taskHorizonRuntimeClientKind = 'mobile-app';
            globalThis.__taskHorizonMobileColdStartPending = true;
            globalThis.siyuan = { isReady: true };
            const { state, SettingsStore: store } = kanbanLoadingTest;
            Object.assign(store.data, { defaultViewMode: 'kanban', defaultViewModeMobile: 'kanban',
                enabledViews: ['list', 'checklist', 'kanban'], currentGroupId: 'all', newTaskDocId: '',
                viewProfiles: { global: { groupMode: 'doc' } } });
            Object.assign(state, { viewMode: 'kanban', viewModeInitialized: true, homepageOpen: false,
                attachmentLibraryOpen: false, taskTree: [], flatTasks: {}, filteredTasks: [], activeDocId: 'all',
                notebooks: [{ id: 'fixture-notebook', name: 'Fixture' }], wasHidden: false });
            kanbanLoadingTest.openPromise = kanbanLoadingTest.open({ source: 'mobile-startup-auto-open', preserveViewMode: true, awaitInitialLoad: true })
                .then(() => { kanbanLoadingTest.openSettled = true; });
        });
        const skeleton = page.locator('.tm-inline-loading-overlay--skeleton[data-tm-loading-mode="kanban"]');
        await skeleton.waitFor({ state: 'visible', timeout: 800 });
        assert.equal(await page.evaluate(() => typeof kanbanLoadingTest.releaseNotebook), 'function',
            'cold startup must show feedback while notebook discovery is still waiting');
        const card = skeleton.locator('.tm-inline-loading-kanban-card').first();
        assert.ok(await card.isVisible(), 'the mobile loading overlay must contain visible skeleton cards');
        const box = await card.boundingBox();
        assert.ok(box.width > 250 && box.height > 40, 'the skeleton must use the mobile single-column layout');
        assert.equal(await card.evaluate(el => getComputedStyle(el, '::after').animationName), 'tm-inline-loading-shimmer');
        assert.equal(await skeleton.locator('.tm-inline-loading-kanban-col:visible').count(), 1);
        const firstTransform = await card.evaluate(el => getComputedStyle(el, '::after').transform);
        await page.waitForFunction(transform => {
            const card = document.querySelector('.tm-inline-loading-kanban-card');
            return card && getComputedStyle(card, '::after').transform !== transform;
        }, firstTransform);
        const output = path.join(root, 'output/playwright');
        fs.mkdirSync(output, { recursive: true });
        await page.screenshot({ path: path.join(output, 'mobile-kanban-loading.png') });
        await page.evaluate(() => kanbanLoadingTest.releaseNotebook());
        await page.waitForFunction(() => typeof kanbanLoadingTest.releaseLoad === 'function');
        assert.equal(await skeleton.count(), 1, 'starting the task loader must preserve the visible skeleton');
        await page.evaluate(() => kanbanLoadingTest.releaseLoad());
        await page.waitForFunction(() => kanbanLoadingTest.openSettled === true);
        assert.equal(await page.locator('.tm-inline-loading-overlay').count(), 0, 'successful loads must remove the skeleton');

        const pending = await page.evaluate(() => {
            kanbanLoadingTest.showPending('kanban');
            return { visible: kanbanLoadingTest.state.uiInlineLoadingVisible,
                style: kanbanLoadingTest.state.uiInlineLoadingStyleKind };
        });
        assert.deepEqual(pending, { visible: true, style: 'skeleton' },
            'the skeleton must be visible before synchronous card construction blocks the reveal timer');
        await skeleton.waitFor({ state: 'visible', timeout: 800 });
        assert.equal(await card.evaluate(el => getComputedStyle(el, '::after').animationPlayState), 'running');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        assert.equal(await card.evaluate(el => getComputedStyle(el, '::after').animationName), 'none',
            'loading motion must still respect reduced-motion settings');
        await page.evaluate(() => kanbanLoadingTest.clearPending());
        assert.equal(await page.locator('.tm-inline-loading-overlay').count(), 0);
        await page.evaluate(() => kanbanLoadingTest.showPending('checklist'));
        await page.locator('.tm-inline-loading-overlay--topbar').waitFor({ state: 'attached' });
        await page.evaluate(() => kanbanLoadingTest.clearPending());
        await page.evaluate(() => {
            kanbanLoadingTest.hasDocs = false;
            kanbanLoadingTest.state.wasHidden = false;
            void kanbanLoadingTest.open({ preserveViewMode: true });
        });
        await page.waitForFunction(() => kanbanLoadingTest.settingsShown === true);
        assert.equal(await page.evaluate(() => kanbanLoadingTest.state.uiInlineLoadingActive), false,
            'an empty configuration must clear early loading before opening settings');
        assert.equal(await page.locator('.tm-inline-loading-overlay').count(), 0);
        assert.deepEqual(errors, [], 'mobile kanban feedback must produce no browser errors');
        console.log('mobile kanban loading skeleton lifecycle and animation browser tests passed');
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
