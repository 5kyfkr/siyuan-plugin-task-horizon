'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('./i18n-browser-fixture');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

async function fixture(browser, kind, width = 1280) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.stack || String(error)));
    await page.route('https://calendar.test/**', route => route.fulfill({ contentType:'text/html', body: `<style>body{margin:0;font:13px system-ui;--b3-theme-primary:#3576aa;--b3-theme-background:#f8f9fa;--b3-theme-on-background:#243443;--b3-theme-on-surface:#5a6b78;--b3-theme-surface-light:#dbe2e8;--b3-theme-primary-lightest:#e2edf7;--tm-bg-color:var(--b3-theme-background);--tm-text-color:var(--b3-theme-on-background);--tm-card-bg:var(--b3-theme-background);--tm-border-color:var(--b3-theme-surface-light);--tm-primary-color:var(--b3-theme-primary)}</style><div id="${kind === 'side' ? 'tmCalendarSideDockTimeline' : 'root'}" data-tm-ui-mode="desktop" data-tm-host-mode="tab" style="${kind === 'side' ? 'position:absolute;right:0;width:360px;' : 'width:100%;'}height:900px"></div>` }));
    await page.goto('https://calendar.test');
    await page.addStyleTag({ content: read('task-horizon.css') });
    await page.addStyleTag({ content: read('calendar-view.css') });
    await page.evaluate(kind => {
        window.siyuan = { config: { system: { container:'browser' }, appearance: { mode:0 } }, languages:{} };
        window.fetch = async () => ({ ok:true, status:200, json:async () => ({ code:0, data:[] }), text:async () => '' });
        window.__tmSuppressStorageWrites = true;
        window.__tmCalendarAllTasksCache = { complete:true, tasks:[] };
        window.hostStore = { loaded:true, data:{ calendarInitialViewDesktop:'dayGridMonth', calendarLinkDockTomato:true, calendarMonthAggregate:true }, save:async () => {} };
        window.historyRows = [{ recordId:'host-focus', sessionId:'host-focus', start:new Date('2026-11-16T10:00:00').toISOString(), end:new Date('2026-11-16T11:00:00').toISOString(), mode:'countdown', durationMin:60, timestamp:new Date('2026-11-16T11:00:00').getTime() }];
        window.historyReads = [];
        window.historyGate = kind === 'month' ? new Promise(resolve => { window.releaseHistory = resolve; }) : null;
        window.__dockTomato = { history:{ loadRange:async (start, end) => {
            historyReads.push([start, end]);
            if (historyGate) await historyGate;
            return historyRows.filter(row => Date.parse(row.start) < Date.parse(end) && Date.parse(row.end) > Date.parse(start)).map(row => ({...row}));
        } } };
    }, kind);
    const model = read('src/task-horizon/main/task-runtime/50-task-model-and-repeat-utils.js');
    await page.addScriptTag({ content: model.slice(model.indexOf('function __tmParseTaskRepeatJson'), model.indexOf('function __tmGetTaskRepeatWeekdayLabel')) });
    for (const name of ['date','store','layout','renderer','interaction','engine']) await page.addScriptTag({ content: read(`src/calendar/calendar-${name}.js`) });
    await page.addScriptTag({ content: read('calendar-view.js').replace('    globalThis.__tmCalendar = {', '    window.__railHosts = { state, getSettings, renderPrototypeSelectionPreview, closeTrackedPrototypeEventPopover, refreshCalendarNowIndicators };\n    globalThis.__tmCalendar = {') });
    const mounted = await page.evaluate(kind => {
        if (kind === 'side') return __tmCalendar.mountSideDayTimeline(document.querySelector('#tmCalendarSideDockTimeline'), { settingsStore:hostStore, date:'2026-11-16', enableExternalDrag:false });
        __tmCalendar.navigateToDate('2026-11-16');
        return __tmCalendar.mount(document.querySelector('#root'), { settingsStore:hostStore });
    }, kind);
    assert.equal(mounted, true, `${kind} mounts`);
    return { page, errors };
}

async function checkDraft(page, panel) {
    const result = await panel.evaluate(el => {
        const surface = el.closest('[data-tm-cal-surface], [data-tm-side-proto-surface]');
        const canvas = el.querySelector('.tm-proto-time-canvas');
        const range = { start:new Date('2026-11-16T10:00:00'), end:new Date('2026-11-16T11:00:00'), canvas };
        const geometry = node => { const rect = node.getBoundingClientRect(); return { x:rect.left, right:rect.right, width:rect.width }; };
        __railHosts.renderPrototypeSelectionPreview(surface, { started:true, moved:true, draft:true }, range);
        const draft = geometry(el.querySelector('[data-tm-proto-draft]'));
        el.querySelectorAll('[data-tm-proto-draft]').forEach(node => node.remove());
        __railHosts.renderPrototypeSelectionPreview(surface, { started:true, moved:true }, range);
        const selection = geometry(el.querySelector('[data-tm-proto-selection-preview]'));
        el.querySelectorAll('[data-tm-proto-selection-preview]').forEach(node => node.remove());
        return { draft, selection, rail:geometry(el.querySelector('.tm-proto-tomato-rail')) };
    });
    assert.ok(Math.abs(result.rail.x - result.draft.right - 4) < 1, `draft reserves the rail gap: ${JSON.stringify(result)}`);
    assert.ok(Math.abs(result.rail.x - result.selection.right - 4) < 1, `selection reserves the rail gap: ${JSON.stringify(result)}`);
}

async function checkPopover(page, rail, expectedSide, screenshotName) {
    await rail.scrollIntoViewIfNeeded();
    await rail.hover();
    const popover = page.locator('.tm-proto-event-popover');
    await popover.waitFor();
    await popover.evaluate(el => el.getAnimations({subtree:true}).forEach(animation => animation.finish()));
    const box = await popover.boundingBox(), anchor = await rail.boundingBox();
    assert.ok(box.x + box.width <= anchor.x - 7 || box.x >= anchor.x + anchor.width + 7, `popover stays beside rail: ${JSON.stringify({box,anchor})}`);
    assert.ok(box.y < anchor.y + anchor.height && box.y + box.height > anchor.y, 'popover aligns vertically with the record');
    if (expectedSide === 'left') assert.ok(box.x < anchor.x, 'right sidebar popover opens to its left');
    assert.ok(box.x >= 0 && box.x + box.width <= page.viewportSize().width + 1, 'popover fits window');
    const hostBox = await rail.evaluate(node => {
        const box = node.closest('.tm-proto-day-panel').getBoundingClientRect();
        return {left:Math.max(0,box.left),right:Math.min(window.innerWidth,box.right),top:Math.max(0,box.top),bottom:Math.min(window.innerHeight,box.bottom)};
    });
    assert.ok(box.x >= hostBox.left - 1 && box.x + box.width <= hostBox.right + 1, `popover fits visible day sidebar: ${JSON.stringify({box,hostBox})}`);
    assert.ok(box.y >= hostBox.top - 1 && box.y + box.height <= hostBox.bottom + 1, `popover fits sidebar height: ${JSON.stringify({box,hostBox})}`);
    if (screenshotName) {
        fs.mkdirSync(path.join(root, 'output/playwright'), {recursive:true});
        await page.screenshot({path:path.join(root, `output/playwright/rail-${screenshotName}-popover.png`)});
    }
    await page.locator('.tm-proto-event-popover-close').click();
}

async function run() {
    const browser = await chromium.launch({headless:true, ...(process.env.PLAYWRIGHT_EXECUTABLE ? {executablePath:process.env.PLAYWRIGHT_EXECUTABLE} : {})});
    try {
        for (const kind of ['side', 'month']) {
            const {page, errors} = await fixture(browser, kind);
            try {
                if (kind === 'month') {
                    assert.equal(await page.locator('.tm-proto-month-cell [data-tm-proto-event^="tm-"]').count(), 0, 'aggregate month grid still hides record cards');
                    await page.locator('.tm-proto-month-cell[data-tm-proto-day="2026-11-16"] .tm-proto-day-number').first().click();
                    await page.evaluate(() => releaseHistory());
                }
                const panel = kind === 'side' ? page.locator('[data-tm-side-proto-surface]') : page.locator('.tm-proto-day-panel[data-tm-proto-panel-date="2026-11-16"]');
                await panel.locator('.tm-proto-tomato-rail').first().waitFor();
                assert.equal(await panel.locator('.tm-proto-tomato-rail').count(), 1, `${kind} reads actual history records`);
                assert.equal(await page.evaluate(() => __railHosts.getSettings().tomatoDisplayMode), 'rail');
                if (kind === 'side') assert.equal(await page.evaluate(() => __railHosts.state.calendar), null, 'list side calendar works without a main calendar');
                await checkDraft(page, panel);
                await checkPopover(page, panel.locator('.tm-proto-tomato-rail').first(), 'left', kind);
                if (kind === 'side') {
                    await page.evaluate(() => {document.querySelector('#tmCalendarSideDockTimeline').style.width='240px';});
                    await panel.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
                    await checkPopover(page,panel.locator('.tm-proto-tomato-rail').first(),'left','side-narrow');
                    await page.evaluate(() => {document.querySelector('#tmCalendarSideDockTimeline').style.height='160px';});
                    await panel.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
                    await checkPopover(page,panel.locator('.tm-proto-tomato-rail').first(),'left','side-short');
                    await page.evaluate(() => {document.querySelector('#tmCalendarSideDockTimeline').style.height='900px';document.body.style.zoom='1.25';});
                    await panel.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
                    await checkPopover(page,panel.locator('.tm-proto-tomato-rail').first(),'left','side-scaled');
                    await page.evaluate(() => {document.body.style.zoom='';});
                    await page.evaluate(() => {document.querySelector('#tmCalendarSideDockTimeline').style.width='360px';});
                } else {
                    await page.addStyleTag({content:'.tm-proto-day-panel{width:220px!important;min-width:0!important;flex:0 0 220px!important}'});
                    await panel.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
                    await checkPopover(page,panel.locator('.tm-proto-tomato-rail').first(),'left','month-narrow');
                }
                fs.mkdirSync(path.join(root, 'output/playwright'), {recursive:true});
                await panel.screenshot({path:path.join(root, `output/playwright/rail-${kind}-host.png`)});
                if (kind === 'side') {
                    await page.evaluate(() => {
                        __railHosts.state.dockHistoryReadSuppressUntil = 0;
                        historyRows.push({...historyRows[0], recordId:'host-second', sessionId:'host-second', start:new Date('2026-11-16T12:00:00').toISOString(), end:new Date('2026-11-16T12:30:00').toISOString(), durationMin:30, timestamp:new Date('2026-11-16T12:30:00').getTime()});
                        window.dispatchEvent(new CustomEvent('tomato:history-updated'));
                    });
                    await page.waitForFunction(() => document.querySelectorAll('.tm-proto-tomato-rail').length === 2);
                    await page.setViewportSize({width:390,height:900});
                    await checkPopover(page, panel.locator('.tm-proto-tomato-rail').first(), 'left');
                    await page.setViewportSize({width:320,height:600});
                    await checkPopover(page, panel.locator('.tm-proto-tomato-rail').first(), 'left');
                    await page.evaluate(() => __tmCalendar.unmountSideDayTimeline());
                    assert.equal(await page.evaluate(() => __railHosts.state.sideDay.historyListener), null, 'side history subscription is disposed');
                }
                assert.deepEqual(errors, [], `${kind} runtime errors`);
                console.log(`${kind}: real source, rail default, draft spacing and side popover passed`);
            } finally { await page.close(); }
        }
    } finally { await browser.close(); }
}
if (require.main === module) run().catch(error => {console.error(error);process.exitCode=1;});
module.exports = { fixture };
