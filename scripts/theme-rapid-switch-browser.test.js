'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8').replace(/\r\n/g, '\n');
const manifest = JSON.parse(read('src/task-horizon/manifest.main.json'));
let runtime = manifest.scripts.map(file => read('src/task-horizon/' + file)).join('\n');
const startup = runtime.lastIndexOf("    if (document.readyState === 'loading') {");
const lifecycle = read('src/task-horizon/main/shell/80-shell-lifecycle.js');
const observerStart = lifecycle.indexOf('        try {\n            if (__tmThemeModeObserver) {');
const observerEnd = lifecycle.indexOf('\n        try { __tmApplyAppearanceThemeVars(); } catch (e) {}', observerStart);
assert.ok(startup > 0 && observerStart > 0 && observerEnd > observerStart);
runtime = runtime.slice(0, startup) + `
    window.themeTest = {
        state, SettingsStore, apply: __tmApplyAppearanceThemeVars,
        clear: __tmClearThemeColorRuntimeCaches,
        cacheBoard: value => { __tmKanbanColsHtmlCache = value; },
        cachedBoard: () => __tmKanbanColsHtmlCache,
        pendingChecks: () => __tmThemeAppearanceRefreshTimers.size,
        renders: 0,
        install() { ${lifecycle.slice(observerStart, observerEnd)} },
        dispose() {
            __tmThemeModeObserver?.disconnect();
            __tmThemeHeadObserver?.disconnect();
            cancelAnimationFrame(__tmThemeModeRefreshRaf);
            document.removeEventListener('load', __tmThemeStylesheetLoadHandler, true);
            __tmThemeAppearanceRefreshTimers.forEach(timer => clearTimeout(timer));
            __tmThemeAppearanceRefreshTimers.clear();
        },
    };
    render = () => { window.themeTest.renders++; };
    SettingsStore.loaded = true;
    SettingsStore.data.enableSiyuanThemeColors = true;
    state.modal = document.createElement('main');
    document.body.appendChild(state.modal);
    themeTest.install();
    themeTest.apply();
})();`;

const palette = dark => `:root {
    --b3-theme-background:${dark ? '#181b20' : '#fafafa'};
    --b3-theme-on-background:${dark ? '#e7e9ed' : '#23262b'};
    --b3-theme-surface:${dark ? '#252a31' : '#eeeeee'};
    --b3-theme-on-surface:${dark ? '#adb5c0' : '#556070'};
    --b3-theme-primary:${dark ? '#72b8d0' : '#317b94'};
    --b3-border-color:${dark ? '#434950' : '#cccccc'};
}`;

(async () => {
    const server = http.createServer((req, res) => {
        res.setHeader('content-type', 'text/html; charset=utf-8');
        res.end(`<!doctype html><html data-theme-mode="light"><head><style id="hostPalette">${palette(false)}</style></head><body></body></html>`);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('http://127.0.0.1:' + server.address().port);
        await page.addScriptTag({ content: runtime });
        const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const colors = () => page.evaluate(() => {
            const style = getComputedStyle(document.documentElement);
            return ['--tm-bg-color', '--tm-text-color', '--tm-topbar-text-color'].map(key => style.getPropertyValue(key).trim());
        });
        const expected = [await colors()];
        await page.evaluate(css => {
            document.documentElement.dataset.themeMode = 'dark';
            document.getElementById('hostPalette').textContent = css;
        }, palette(true));
        await settle();
        expected.push(await colors());
        assert.notDeepEqual(expected[0], expected[1], 'light and dark palettes differ');

        // A theme can apply its palette after the mode attribute, without a LINK load event.
        for (let i = 0; i < 12; i++) {
            const dark = i % 2 === 1;
            await page.evaluate(dark => { document.documentElement.dataset.themeMode = dark ? 'dark' : 'light'; }, dark);
            await settle();
            await page.evaluate(css => { document.getElementById('hostPalette').textContent = css; }, palette(dark));
            await settle();
            assert.deepEqual(await colors(), expected[dark ? 1 : 0], 'delayed palette follows the latest mode on switch ' + i);
        }

        // Cover both replacing text nodes and replacing/removing a palette STYLE element.
        await page.evaluate(css => { document.getElementById('hostPalette').firstChild.data = css; }, palette(false));
        await settle();
        assert.deepEqual(await colors(), expected[0], 'text-node palette changes refresh without a mode change');
        await page.evaluate(css => {
            const style = document.createElement('style');
            style.id = 'overridePalette'; style.textContent = css;
            document.head.appendChild(style);
        }, palette(true));
        await settle();
        assert.deepEqual(await colors(), expected[1], 'a late palette STYLE takes effect');
        await page.evaluate(() => document.getElementById('overridePalette').remove());
        await settle();
        assert.deepEqual(await colors(), expected[0], 'removing a palette restores the underlying theme');

        // SiYuan inserts the next default stylesheet before the old one and removes the old
        // sheet in its onload callback. A newer load may finish before an older request.
        const pendingSheets = new Map();
        let notifySheetsRequested;
        const sheetsRequested = new Promise(resolve => { notifySheetsRequested = resolve; });
        await page.route('**/appearance/themes/**/theme.css*', route => {
            pendingSheets.set(new URL(route.request().url()).searchParams.get('request'), route);
            if (pendingSheets.size === 2) notifySheetsRequested();
        });
        for (const [name, mode] of [['old', 'light'], ['latest', 'dark']]) {
            await page.evaluate(({ name, mode }) => {
                document.documentElement.dataset.themeMode = mode;
                const link = document.createElement('link');
                link.rel = 'stylesheet'; link.dataset.request = name;
                link.href = '/appearance/themes/' + mode + '/theme.css?request=' + name;
                link.onload = () => {
                    const currentMode = document.documentElement.dataset.themeMode;
                    if (currentMode !== mode) link.remove();
                    else document.querySelectorAll('link[data-request]').forEach(node => { if (node !== link && node.sheet) node.remove(); });
                };
                document.head.appendChild(link);
            }, { name, mode });
        }
        await sheetsRequested;
        assert.ok(pendingSheets.has('latest') && pendingSheets.has('old'), 'both stylesheet requests are pending');
        await pendingSheets.get('latest').fulfill({ contentType: 'text/css', body: palette(true) });
        await page.waitForFunction(() => document.querySelector('link[data-request="latest"]')?.sheet);
        await settle();
        assert.deepEqual(await colors(), expected[1], 'latest stylesheet load updates the palette');
        await pendingSheets.get('old').fulfill({ contentType: 'text/css', body: palette(false) });
        await page.waitForFunction(() => !document.querySelector('link[data-request="old"]'));
        await settle();
        assert.deepEqual(await colors(), expected[1], 'an obsolete load cannot leave the old palette applied');

        // Match the reported logs: after both the mode event and stylesheet load, the
        // effective host palette changes without another DOM mutation or load event.
        for (let i = 0; i < 6; i++) {
            const dark = i % 2 === 1;
            await page.evaluate(({ dark, css }) => {
                document.documentElement.dataset.themeMode = dark ? 'dark' : 'light';
                setTimeout(() => {
                    const sheet = document.querySelector('link[data-request="latest"]').sheet;
                    sheet.deleteRule(0);
                    sheet.insertRule(css, 0);
                }, 80);
            }, { dark, css: palette(dark) });
            await page.waitForFunction(expected => {
                const style = getComputedStyle(document.documentElement);
                return ['--tm-bg-color', '--tm-text-color', '--tm-topbar-text-color']
                    .every((key, index) => style.getPropertyValue(key).trim() === expected[index]);
            }, expected[dark ? 1 : 0], { timeout: 2500 });
            assert.deepEqual(await colors(), expected[dark ? 1 : 0], 'CSSOM palette follows the latest mode on switch ' + i);
        }

        const before = await page.evaluate(() => themeTest.renders);
        for (let i = 0; i < 10; i++) {
            await page.evaluate(() => {
                const style = document.getElementById('hostPalette');
                style.textContent = style.textContent;
                document.documentElement.className = document.documentElement.className;
                document.querySelector('link[data-request="latest"]').dispatchEvent(new Event('load'));
                const unrelated = document.createElement('style');
                unrelated.textContent = '.unrelated { color: var(--b3-theme-primary); }';
                document.head.appendChild(unrelated);
                unrelated.remove();
            });
            await settle();
        }
        await page.waitForFunction(() => themeTest.pendingChecks() === 0, null, { timeout: 2500 });
        assert.equal(await page.evaluate(() => themeTest.renders), before, 'identical writes, unchanged stylesheet loads and unrelated head changes do not render');

        await page.evaluate(() => { themeTest.cacheBoard({ key: 'old', html: '<div style="color:#23262b">old palette</div>' }); themeTest.clear(); });
        assert.equal(await page.evaluate(() => themeTest.cachedBoard()), null, 'theme invalidation discards HTML containing old resolved colors');
        await page.evaluate(() => { document.documentElement.dataset.themeMode = 'light'; });
        await settle();
        assert.ok(await page.evaluate(() => themeTest.pendingChecks()) > 0, 'a new switch starts bounded palette checks');
        const disposedRenders = await page.evaluate(() => { themeTest.dispose(); return themeTest.renders; });
        await page.evaluate(css => {
            const sheet = document.querySelector('link[data-request="latest"]').sheet;
            sheet.deleteRule(0); sheet.insertRule(css, 0);
        }, palette(false));
        await settle();
        assert.equal(await page.evaluate(() => themeTest.pendingChecks()), 0, 'disposal cancels all palette checks');
        assert.equal(await page.evaluate(() => themeTest.renders), disposedRenders, 'a disposed watcher cannot refresh an old view');
        assert.deepEqual(errors, [], 'no browser errors');
        console.log('theme rapid switch browser tests passed');
    } finally {
        await browser?.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
