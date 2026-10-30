'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('./i18n-browser-fixture');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
require('./shortcut-sidebar-browser-fixture');
const fixture = read('output/playwright/shortcut-sidebar-plugin.html');
const locales = ['en', 'zh-CN'];
const views = ['checklist', 'list', 'timeline', 'kanban', 'whiteboard', 'calendar', 'home'];
const calendarScripts = ['calendar-date', 'calendar-store', 'calendar-layout', 'calendar-renderer', 'calendar-interaction', 'calendar-engine'];
const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/') {
        const locale = locales.includes(url.searchParams.get('lang')) ? url.searchParams.get('lang') : 'en';
        const init = `${read('src/i18n/runtime.js')}\nwindow.__taskHorizonHostBridge.i18n = window.__taskHorizonHostBridge.i18nRuntime.createI18n(${read('i18n/' + locale + '.json')}, { locale: '${locale}' });
          window.siyuan={config:{appearance:{lang:'${locale}',mode:0}},languages:{}};
          window.__tmSuppressStorageWrites=true;
          window.fetch=async()=>({ok:true,status:200,json:async()=>({code:0,data:[]}),text:async()=>'',blob:async()=>new Blob()});`;
        const scripts = calendarScripts.map(name => `<script src="/src/calendar/${name}.js"></script>`).join('')
            + '<script src="/calendar-view.js"></script><script src="/homepage.js"></script>';
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(fixture.replace('<script>', `<link rel="stylesheet" href="/calendar-view.css"><script>${init}</script>${scripts}<script>`));
        return;
    }
    const file = path.resolve(root, '.' + url.pathname);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : 'text/javascript');
    res.end(fs.readFileSync(file));
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ headless: true });
    const results = [];
    try {
        for (const locale of locales) {
            const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
            const errors = [], missing = [];
            page.on('pageerror', error => errors.push(error.message));
            page.on('console', message => { if (message.text().includes('Missing translation:')) missing.push(message.text()); });
            await page.goto('http://127.0.0.1:' + server.address().port + '/?lang=' + locale);
            await page.waitForFunction(() => !!window.shortcutTest?.state.modal);
            for (const view of views) {
                await page.evaluate(view => {
                    const { state, render, applyFilters } = shortcutTest;
                    state.homepageOpen = view === 'home';
                    if (view !== 'home') state.viewMode = view;
                    applyFilters(); render();
                }, view);
                await page.waitForTimeout(130);
                const text = await page.locator('#host').innerText();
                assert.ok(text.trim(), locale + ': ' + view + ' must render content');
                assert.doesNotMatch(text, /(?:common|settings|task|kernel|calendar|ai)\.[a-zA-Z]{3,}/);
                results.push({ locale, view, characters: text.length });
                await page.screenshot({ path: path.join(root, `output/playwright/i18n-${locale}-${view}.png`) });
            }
            await page.evaluate(async () => {
                shortcutTest.SettingsStore.data.newTaskDocId = shortcutTest.docA;
                await tmQuickAddOpen({ docId: shortcutTest.docA });
            });
            await page.locator('.tm-quick-add-box').waitFor();
            const statusLabel = await page.locator('#tmQuickAddStatusBtn').innerText();
            assert.equal(statusLabel.trim(), locale === 'en' ? 'To do' : '待办');
            await page.evaluate(() => tmQuickAddOpenStatusPicker());
            const statusOptions = await page.locator('.tm-quick-add-status-picker .tm-status-tag').allTextContents();
            assert.deepEqual(statusOptions, locale === 'en' ? ['To do', 'In progress', 'Done', 'Abandoned'] : ['待办', '进行中', '已完成', '放弃']);
            await page.screenshot({ path: path.join(root, `output/playwright/i18n-${locale}-quick-add.png`) });
            await page.evaluate(() => tmQuickAddClose());
            assert.deepEqual(missing, [], 'No missing messages in ' + locale);
            assert.deepEqual(errors, [], 'No runtime errors in ' + locale);
            await page.close();
        }
        fs.writeFileSync(path.join(root, 'output/playwright/i18n-ui-results.json'), JSON.stringify(results, null, 2));
        console.log('English and Chinese render all seven task surfaces with no missing messages or runtime errors');
    } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
