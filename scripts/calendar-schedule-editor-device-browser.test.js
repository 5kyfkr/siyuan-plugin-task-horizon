'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('./i18n-browser-fixture');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const windowsUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/132.0.0.0 Safari/537.36';
const cases = [
    { name: 'desktop tab', uiMode: 'desktop', hostMode: 'tab', width: 1440, fullscreen: false },
    { name: 'desktop Dock', uiMode: 'mobile', hostMode: 'dock', width: 1440, fullscreen: false },
    { name: 'narrow touch-capable desktop Dock', uiMode: 'mobile', hostMode: 'dock', width: 700, touch: true, fullscreen: false },
    { name: 'phone', uiMode: 'mobile', width: 390, touch: true, mobile: true, fullscreen: true },
    { name: 'native tablet Dock with desktop frontend', uiMode: 'mobile', hostMode: 'dock', width: 1280, touch: true, nativeMobile: true, fullscreen: true },
    { name: 'native tablet tab with desktop frontend', uiMode: 'desktop', hostMode: 'tab', width: 1280, touch: true, nativeMobile: true, fullscreen: true },
    { name: 'iPad browser with desktop frontend', uiMode: 'mobile', hostMode: 'dock', width: 1180, touch: true, platform: 'MacIntel',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', fullscreen: true },
    { name: 'Android tablet browser with desktop frontend', uiMode: 'mobile', hostMode: 'dock', width: 1280, touch: true,
        userAgent: 'Mozilla/5.0 (Linux; Android 15; Tablet) AppleWebKit/537.36 Chrome/132.0.0.0 Safari/537.36', fullscreen: true },
];

async function checkHost(browser, scenario) {
    const context = await browser.newContext({
        viewport: { width: scenario.width, height: 820 },
        userAgent: scenario.userAgent || windowsUa,
        isMobile: scenario.mobile === true,
        hasTouch: scenario.touch === true,
    });
    try {
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.stack || String(error)));
        await page.route('https://calendar.test/**', route => route.fulfill({
            contentType: 'text/html',
            body: `<meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}</style>
                <div id="root" data-tm-ui-mode="${scenario.uiMode}" data-tm-host-mode="${scenario.hostMode || 'mobile'}"
                    style="width:${scenario.hostMode === 'dock' ? 360 : scenario.width}px;height:820px"></div>`,
        }));
        await page.goto('https://calendar.test');
        await page.addStyleTag({ content: read('calendar-view.css') });
        await page.evaluate(scenario => {
            window.siyuan = { config: { system: { container: 'browser' }, appearance: { mode: 0 } }, languages: {} };
            window.fetch = async () => ({ ok: true, status: 200, json: async () => ({ code: 0, data: [] }), text: async () => '' });
            window.__tmSuppressStorageWrites = true;
            window.__taskHorizonPluginIsMobile = scenario.mobile === true;
            window.__taskHorizonPluginIsNativeMobile = scenario.nativeMobile === true;
            window.__taskHorizonFrontend = scenario.mobile ? 'browser-mobile' : 'browser-desktop';
            Object.defineProperty(navigator, 'platform', { configurable: true, value: scenario.platform || 'Win32' });
            Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: scenario.touch ? 5 : 0 });
        }, scenario);
        const model = read('src/task-horizon/main/task-runtime/50-task-model-and-repeat-utils.js');
        await page.addScriptTag({ content: model.slice(model.indexOf('function __tmParseTaskRepeatJson'), model.indexOf('function __tmGetTaskRepeatWeekdayLabel')) });
        for (const name of ['date', 'store', 'layout', 'renderer', 'interaction', 'engine']) {
            await page.addScriptTag({ content: read(`src/calendar/calendar-${name}.js`) });
        }
        await page.addScriptTag({ content: read('calendar-view.js').replace(
            '    globalThis.__tmCalendar = {',
            '    window.__calendarEditorDeviceTest = { state };\n    globalThis.__tmCalendar = {',
        ) });
        assert.equal(await page.evaluate(() => __tmCalendar.mount(document.querySelector('#root'), {
            settingsStore: { loaded: true, data: { calendarDefaultViewMobile: 'timeGridDay', calendarDefaultViewDesktop: 'timeGridDay' } },
        })), true, `${scenario.name}: calendar mounts`);
        await page.locator('.tm-proto-time-col').first().waitFor();
        const point = await page.evaluate(() => {
            const column = document.querySelector('.tm-proto-time-col');
            const scroller = column.closest('.tm-proto-time-scroll');
            scroller.scrollTop = 200;
            const rect = column.getBoundingClientRect();
            const viewport = scroller.getBoundingClientRect();
            return { x: rect.left + rect.width / 2, y: viewport.top + Math.min(100, viewport.height / 2) };
        });
        if (scenario.touch) await page.touchscreen.tap(point.x, point.y);
        else await page.mouse.click(point.x, point.y);
        const draft = page.locator('[data-tm-proto-draft] .tm-proto-schedule-draft-open');
        await draft.waitFor();
        if (scenario.touch) await draft.tap();
        else await draft.click();
        const editor = page.locator('.tm-proto-inline-schedule-editor');
        await editor.waitFor();
        assert.equal(await editor.evaluate(node => node.classList.contains('is-mobile-fullscreen')),
            scenario.fullscreen, `${scenario.name}: draft editor fullscreen behavior`);
        const box = await editor.boundingBox();
        if (scenario.fullscreen) {
            assert.equal(Math.round(box.width), scenario.width, `${scenario.name}: editor fills screen width`);
            assert.equal(Math.round(box.height), 820, `${scenario.name}: editor fills screen height`);
        } else {
            assert.ok(box.width <= 326 && box.height < 820, `${scenario.name}: editor retains desktop popover size`);
        }
        await page.locator('[data-tm-proto-edit-action="cancel"]').click();
        assert.equal(await editor.count(), 0, `${scenario.name}: cancel closes the editor`);
        assert.equal(await page.evaluate(() => __calendarEditorDeviceTest.state.openPrototypeNewScheduleCard({
            start: new Date('2026-10-11T10:00:00'), end: new Date('2026-10-11T11:00:00'),
        }, document.querySelector('.tm-proto-time-col'))), true);
        assert.equal(await editor.evaluate(node => node.classList.contains('is-mobile-fullscreen')), false,
            `${scenario.name}: ordinary creation entry retains its popover`);
        assert.deepEqual(errors, [], `${scenario.name}: ${errors.join('\n')}`);
        console.log(`${scenario.name}: ${scenario.fullscreen ? 'fullscreen' : 'popover'} passed`);
    } finally {
        await context.close();
    }
}

async function run() {
    const browser = await chromium.launch({ headless: true,
        ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
    try {
        const selectedCases = process.env.TM_TEST_SMOKE === '1'
            ? cases.filter(scenario => ['desktop Dock', 'phone', 'native tablet tab with desktop frontend'].includes(scenario.name))
            : cases;
        assert.ok(selectedCases.length >= 3, 'release checks must include desktop, phone and tablet');
        for (const scenario of selectedCases) await checkHost(browser, scenario);
    } finally {
        await browser.close();
    }
}

if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
