'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

async function run() {
    const browser = await chromium.launch({
        headless: true,
        ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}),
    });
    try {
        const context = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.stack || String(error)));
        await page.route('https://calendar.test/**', (route) => route.fulfill({
            contentType: 'text/html',
            body: '<meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}</style><div id="root" data-tm-ui-mode="mobile" style="height:780px"></div>',
        }));
        await page.goto('https://calendar.test');
        await page.addStyleTag({ content: read('calendar-view.css') });
        await page.addScriptTag({ content: `
            window.siyuan = { config: { system: { container: 'browser' }, appearance: { mode: 0 } }, languages: {} };
            window.fetch = async () => ({ ok: true, status: 200, json: async () => ({ code: 0, data: [] }), text: async () => '' });
            window.__tmSuppressStorageWrites = true;
        ` });
        const model = read('src/task-horizon/main/task-runtime/50-task-model-and-repeat-utils.js');
        await page.addScriptTag({ content: model.slice(model.indexOf('function __tmParseTaskRepeatJson'), model.indexOf('function __tmGetTaskRepeatWeekdayLabel')) });
        for (const name of ['date', 'store', 'layout', 'renderer', 'interaction', 'engine']) {
            await page.addScriptTag({ content: read(`src/calendar/calendar-${name}.js`) });
        }
        let calendarSource = read('calendar-view.js');
        calendarSource = calendarSource.replace(
            '    globalThis.__tmCalendar = {',
            '    window.__calendarOpenTest = { state };\n    globalThis.__tmCalendar = {',
        );
        await page.addScriptTag({ content: calendarSource });
        const mounted = await page.evaluate(() => __tmCalendar.mount(document.querySelector('#root'), {
            settingsStore: { loaded: true, data: { calendarDefaultViewMobile: 'timeGridDay' } },
        }));
        assert.equal(mounted, true, 'calendar mounts in mobile mode');
        await page.locator('.tm-proto-time-col').waitFor();
        const openDraft = async () => {
            const point = await page.evaluate(() => {
                const column = document.querySelector('.tm-proto-time-col');
                const scroller = column.closest('.tm-proto-time-scroll');
                scroller.scrollTop = 200;
                const rect = column.getBoundingClientRect();
                const viewport = scroller.getBoundingClientRect();
                return { x: rect.left + rect.width / 2, y: viewport.top + Math.min(100, viewport.height / 2) };
            });
            await page.touchscreen.tap(point.x, point.y);
            const draft = page.locator('[data-tm-proto-draft] .tm-proto-schedule-draft-open');
            await draft.waitFor();
            await draft.tap();
            assert.equal(await page.locator('.tm-proto-inline-schedule-editor.is-mobile-fullscreen').count(), 1);
            return point;
        };
        const point = await openDraft();

        // Fullscreen editing owns the interaction layer. A click outside the
        // card must not dismiss it, even when a touch bridge emits one.
        await page.dispatchEvent('body', 'click', { bubbles: true, clientX: point.x, clientY: point.y });
        assert.equal(await page.locator('.tm-proto-inline-schedule-editor.is-mobile-fullscreen').count(), 1,
            'an outside click does not close the fullscreen editor');

        // The rule is permanent, not a timeout for the opening gesture.
        await page.waitForTimeout(950);
        await page.dispatchEvent('body', 'click', { bubbles: true });
        assert.equal(await page.locator('.tm-proto-inline-schedule-editor').count(), 1);
        for (const type of ['click', 'pointerdown']) {
            await page.locator('[data-tm-proto-edit-date-card="start"]').tap();
            assert.equal(await page.locator('.tm-proto-inline-time-hub').count(), 1);
            await page.dispatchEvent('body', type, { bubbles: true, clientX: 0, clientY: 0 });
            assert.equal(await page.locator('.tm-proto-inline-time-hub').count(), 0, `${type} dismisses the picker`);
            assert.equal(await page.locator('.tm-proto-inline-schedule-editor').count(), 1, `${type} keeps the draft`);
        }
        await page.locator('[data-tm-proto-edit-date-card="start"]').tap();
        await page.locator('.entity-badge').tap();
        assert.equal(await page.locator('.tm-proto-inline-time-hub').count(), 0, 'a tap inside the editor also dismisses the picker');
        const title = page.locator('[data-tm-proto-edit-field="title"]');
        await title.fill('保留未保存的日程');
        await page.setViewportSize({ width: 390, height: 420 });
        await page.waitForTimeout(200);
        assert.equal(await title.inputValue(), '保留未保存的日程', 'keyboard-sized viewport keeps the same draft');
        await page.locator('[data-tm-proto-edit-action="cancel"]').tap();
        assert.equal(await page.locator('.tm-proto-inline-schedule-editor').count(), 0,
            'explicit cancel still closes the fullscreen editor');

        await page.setViewportSize({ width: 390, height: 780 });
        await page.evaluate(() => {
            const nativeFocus = HTMLElement.prototype.focus;
            HTMLElement.prototype.focus = function (...args) {
                if (this.matches('[data-tm-proto-edit-field="title"]')) throw new Error('Simulated focus rejection');
                return nativeFocus.apply(this, args);
            };
        });
        await openDraft();
        assert.equal(await title.isVisible(), true, 'rejected title focus does not close the editor');
        await page.locator('.tm-proto-event-popover-close').tap();
        assert.equal(await page.locator('.tm-proto-inline-schedule-editor').count(), 0, 'explicit close remains available');

        await page.evaluate(() => __calendarOpenTest.state.openPrototypeNewScheduleCard({
            start: new Date('2026-09-29T10:00:00'), end: new Date('2026-09-29T11:00:00'),
        }, document.querySelector('.tm-proto-time-col')));
        assert.equal(await page.locator('.tm-proto-inline-schedule-editor:not(.is-mobile-fullscreen)').count(), 1);
        await page.dispatchEvent('body', 'click', { bubbles: true });
        assert.equal(await page.locator('.tm-proto-inline-schedule-editor').count(), 0,
            'ordinary popovers retain outside-click dismissal');

        assert.deepEqual(errors, [], errors.join('\n'));
        await context.close();
        console.log('calendar mobile fullscreen open passed');
    } finally {
        await browser.close();
    }
}

if (require.main === module) run().catch((error) => { console.error(error); process.exitCode = 1; });
