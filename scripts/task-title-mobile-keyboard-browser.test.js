'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, i18nPrelude } = require('./i18n-browser-fixture');

const root = path.resolve(__dirname, '..');
const modulePath = path.join(root, 'src/task-horizon/main/task-runtime/51a-task-title-editor-runtime.js');
const lutePath = process.env.SIYUAN_LUTE_PATH || path.resolve(root, '../siyuan-3.8.8/app/stage/protyle/js/lute/lute.min.js');

async function main() {
    assert.ok(fs.existsSync(lutePath), 'Set SIYUAN_LUTE_PATH to the real SiYuan lute.min.js');
    const browser = await chromium.launch({
        headless: true,
        ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}),
    });
    try {
        const context = await browser.newContext({
            hasTouch: true,
            isMobile: true,
            viewport: { width: 393, height: 851 },
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1">
            <div id="fixture"></div>`);
        await page.addScriptTag({ content: i18nPrelude });
        await page.addScriptTag({ path: lutePath });
        await page.addScriptTag({ content: `
            window.esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            window.API = {
                extractTaskContentLine: value => String(value || '').replace(/^\\s*[-*+]\\s+\\[[^\\]]?\\]\\s*/, ''),
                getTaskContentBlockId: async () => '',
                getBlockDOM: async () => '',
            };
            window.__tmIsMobileDevice = () => true;
            window.keyboardRequests = 0;
            window.focusableRequests = 0;
            window.keyboardEvents = 0;
            window.JSHarmony = {
                showKeyboard: () => { window.keyboardRequests += 1; },
                setWebViewFocusable: enabled => { if (enabled) window.focusableRequests += 1; },
            };
            window.addEventListener('siyuan-mobile-keyboard-change', event => {
                if (event.detail === true) window.keyboardEvents += 1;
            });
        ` });
        await page.addScriptTag({ path: modulePath });
        await page.addScriptTag({ content: `
            const task = { id: '20261109090000-title01', markdown: '- [ ] 移动端标题', content: '移动端标题' };
            document.querySelector('#fixture').innerHTML = __tmBuildTaskTitleEditorHtml(task, {
                attributes: 'data-tm-detail="content"',
            });
            __tmMountTaskTitleEditor(document.querySelector('[data-tm-title-editor]'), task);
        ` });

        await page.locator('[data-tm-title-editor]').tap();
        await page.waitForFunction(() => window.keyboardRequests === 1);
        assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('[data-tm-title-editor]')), true);
        assert.equal(await page.evaluate(() => window.focusableRequests), 1, 'the Harmony WebView becomes focusable before showing the IME');
        assert.equal(await page.evaluate(() => window.keyboardEvents), 1, 'the host mobile keyboard state is notified');
        assert.deepEqual(errors, []);
        console.log('mobile task title keyboard bridge tests passed');
        await context.close();
    } finally {
        await browser.close();
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
