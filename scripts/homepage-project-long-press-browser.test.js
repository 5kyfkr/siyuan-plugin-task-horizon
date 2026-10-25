'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

(async () => {
    const server = http.createServer((req, res) => {
        res.setHeader('Content-Type', 'text/html');
        res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div class="tm-modal tm-modal--mobile tm-modal--runtime-mobile"><div class="tm-box"><div class="tm-body tm-body--homepage"><main id="homepage"></main></div></div></div>');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.goto('http://127.0.0.1:' + server.address().port);
        await page.addStyleTag({ content: read('task-horizon.css') });
        await page.addStyleTag({ content: 'body{margin:0;--b3-theme-surface:#fafbfc;--b3-theme-on-surface:#27313b;--b3-border-color:#d7dce2} #homepage{width:100%;min-height:100vh}' });
        await page.evaluate(() => {
            window.__saved = {};
            window.__switches = [];
            window.__dateEdits = 0;
            window.__tmHost = {
                async loadData() { return structuredClone(__saved); },
                async saveData(key, value) { __saved = structuredClone(value); },
            };
            window.tmSwitchDoc = id => __switches.push(id);
            window.tmOpenTimelineGroupRangeEditor = () => __dateEdits++;
        });
        await page.addScriptTag({ content: read('src/task-horizon/main/37-project-visibility-service.js') });
        await page.addScriptTag({ content: read('homepage.js') });
        await page.evaluate(async () => {
            await __tmProjectVisibility.load();
            const doc = { id: 'demo-doc', name: '演示项目', total: 2, done: 1, progress: 50 };
            window.__mountProjects = (heading = false) => __tmHomepage.mount(document.getElementById('homepage'), {
                todayKey: '2026-10-25', isMobileDevice: true, animateOnMount: false, tasks: [],
                projects: heading
                    ? { scope: 'doc', doc, h2Cards: [{ h2Id: 'demo-heading', name: '演示阶段', total: 2, done: 1, progress: 50 }] }
                    : { scope: 'group', sections: [{ label: '演示分组', cards: [doc], agg: { total: 2, done: 1, pct: 50 } }] },
            });
            __mountProjects();
        });
        const card = page.locator('.tm-home-project-card').first();
        const menu = page.locator('#tm-home-project-context-menu');
        const item = menu.getByRole('menuitem');
        const cdp = await page.context().newCDPSession(page);
        const touch = (type, point) => cdp.send('Input.dispatchTouchEvent', {
            type, touchPoints: point ? [{ x: point.x, y: point.y, id: 1 }] : [],
        });
        const pointOnCard = async () => {
            await card.scrollIntoViewIfNeeded();
            const rect = await card.boundingBox();
            return { x: rect.x + 80, y: rect.y + 32 };
        };
        const hold = async () => {
            const point = await pointOnCard();
            await touch('touchStart', point);
            await item.waitFor({ state: 'visible' });
            return point;
        };
        // Let the initial settings/resize render settle before starting a gesture.
        await page.waitForTimeout(300);
        await card.tap();
        assert.deepEqual(await page.evaluate(() => __switches), ['demo-doc'], 'a short tap still opens the document');
        await card.locator('[data-tm-home-project-dates]').tap();
        assert.equal(await page.evaluate(() => __dateEdits), 1, 'a short tap still edits dates');
        assert.equal(await menu.count(), 0);

        const point = await hold();
        const bounds = await menu.boundingBox();
        assert.equal(await item.evaluate(el => {
            const rect = el.getBoundingClientRect();
            return el.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
        }), true, 'the menu must be above the real fullscreen shell and receive touches');
        assert.ok(Math.abs(bounds.x - point.x) <= 1 && Math.abs(bounds.y - point.y) <= 1,
            `the menu must open at the finger, got ${JSON.stringify({ bounds, point })}`);
        assert.ok(bounds.x + bounds.width <= 382 && bounds.y + bounds.height <= 836, 'the menu stays within the mobile viewport');
        assert.ok(await item.evaluate(el => el.offsetHeight >= 44), 'the mobile menu item has a touch-sized target');
        await page.waitForTimeout(1400);
        await touch('touchEnd');
        assert.equal(await page.evaluate(() => __switches.length), 1, 'releasing even a prolonged hold must not open the document');
        assert.equal(await page.evaluate(() => String(getSelection())), '', 'holding card text must not select it');
        await item.tap();
        await page.waitForFunction(() => __saved.completedProjects?.['doc:demo-doc'] === true);
        assert.equal(await card.evaluate(el => el.classList.contains('is-completed')), true);
        await hold();
        await touch('touchEnd');
        assert.equal(await item.textContent(), '取消完成标记并恢复任务');
        await item.tap();
        await page.waitForFunction(() => !__saved.completedProjects?.['doc:demo-doc']);

        // Small consecutive moves must be measured from the start, not from the previous event.
        const dispatch = (type, init = {}) => card.dispatchEvent(type, {
            pointerType: 'touch', pointerId: 7, isPrimary: true, clientX: 80, clientY: 200, ...init,
        });
        await dispatch('pointerdown');
        await dispatch('pointermove', { clientX: 88 });
        await dispatch('pointermove', { clientX: 96 });
        await page.waitForTimeout(650);
        assert.equal(await menu.count(), 0, 'scrolling in small increments cancels the hold');
        await dispatch('pointerup');
        await dispatch('pointerdown');
        await dispatch('pointerdown', { pointerId: 8, isPrimary: false });
        await page.waitForTimeout(650);
        assert.equal(await menu.count(), 0, 'a second finger cancels the hold');
        await dispatch('pointerup');
        await dispatch('pointerdown');
        await dispatch('pointercancel');
        await page.waitForTimeout(650);
        assert.equal(await menu.count(), 0, 'a cancelled touch cannot open a menu');

        await page.evaluate(() => __mountProjects(true));
        await page.waitForTimeout(300);
        await hold();
        await touch('touchEnd');
        await item.tap();
        await page.waitForFunction(() => __saved.completedProjects?.['heading:demo-heading'] === true);
        assert.equal(await card.evaluate(el => el.classList.contains('is-completed')), true, 'heading cards support the same completion action');
        await hold();
        await touch('touchEnd');
        await page.touchscreen.tap(4, 4);
        assert.equal(await menu.count(), 0, 'tapping outside dismisses the menu');
        await card.click({ button: 'right' });
        await item.waitFor({ state: 'visible' });
        await page.keyboard.press('Escape');
        assert.equal(await menu.count(), 0, 'desktop context menus still close with Escape');
        await dispatch('pointerdown');
        await page.evaluate(() => __tmHomepage.unmount());
        await page.waitForTimeout(650);
        assert.equal(await menu.count(), 0, 'unmounting clears the pending hold');
        assert.deepEqual(errors, []);
        console.log('homepage project long-press browser tests passed');
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
