'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8').replace(/\r\n/g, '\n');
const styles = fs.readFileSync(path.join(root, 'calendar-view.css'), 'utf8');
const start = source.indexOf('            const position = () => {', source.indexOf('const showPrototypeScheduleEditorCard ='));
const end = source.indexOf('\n            let inlineMonthDays', start);
assert.ok(start >= 0 && end > start, 'inline editor positioner exists');
const positioner = source.slice(start, end);
const hubStart = source.indexOf('            const positionTimeHub = () => {', source.indexOf('const showPrototypeScheduleEditorCard ='));
const hubEnd = source.indexOf('\n            const scrollTimeHubToCurrent', hubStart);
assert.ok(hubStart >= 0 && hubEnd > hubStart, 'date/time hub positioner exists');
const hubPositioner = source.slice(hubStart, hubEnd);
assert.match(source, /__tmFromDraftCard: true/);
assert.match(source, /fromDraftCard: params\.__tmFromDraftCard === true/);
assert.match(source, /let moreExpanded = isMobileFullscreen/);
assert.match(source, /if \(more\) more.hidden = !moreExpanded/);

async function checkViewport(browser, width, height, keyboardHeight) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
    try {
        const page = await context.newPage();
        await page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1"><style>${styles}</style>
            <style>body{margin:0;--tm-cal-panel:#fff;--tm-cal-border:#ddd;--tm-cal-text:#222;--tm-cal-muted:#666;--tm-cal-primary:#478cac;--tm-cal-on-primary:#fff}</style>
            <div id="anchor"></div><div id="editor" class="ev-pop unified-summary quick-pop tm-proto-event-popover tm-proto-inline-schedule-editor is-new is-mobile-fullscreen" role="dialog" aria-modal="true" aria-label="新建日程">
                <div class="hd tm-proto-event-popover-head tm-proto-inline-editor-head">
                    <div class="quick-head-row"><span class="entity-badge">独立日程</span><button class="tm-proto-event-popover-close">×</button></div>
                    <textarea class="quick-title tm-proto-inline-title" placeholder="日程标题"></textarea>
                    <div class="tm-proto-inline-date-time-rows"><div class="tm-proto-inline-date-time-row">开始 <button data-tm-proto-edit-date-card="start">9月29日</button><button data-tm-proto-edit-time-card="start">10:00</button></div><div class="tm-proto-inline-date-time-row">结束 <button data-tm-proto-edit-date-card="end">9月29日</button><button data-tm-proto-edit-time-card="end">11:00</button></div></div>
                    <div class="quick-range-note">共 1 小时</div>
                </div>
                <div class="bd tm-proto-event-popover-body tm-proto-inline-editor-body"><div>日历　未分组</div><button>更多设置</button>${'<div class="quick-setting-row">更多设置内容</div>'.repeat(20)}</div>
                <div class="ft quick-new-foot tm-proto-event-popover-actions tm-proto-inline-editor-actions"><button>取消</button><button class="primary tm-proto-inline-save">创建日程</button></div>
            </div>`);
        await page.addScriptTag({ content: `
            const pop = document.querySelector('#editor');
            const anchorEl = document.querySelector('#anchor');
            const isMobileFullscreen = true;
            const isNew = true;
            ${positioner}
            ${hubPositioner}
            const getPrototypePopoverViewport = () => ({ left: 0, top: 180, right: ${width}, bottom: ${height}, width: ${width}, height: ${height} - 180 });
            let timeHub = null;
            let timeHubMode = 'date';
            let timeHubEndpoint = 'start';
            const viewport = { width: ${width}, height: ${height}, offsetTop: 0, offsetLeft: 0 };
            Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
            window.setVisibleHeight = (nextHeight) => { viewport.height = nextHeight; position(); };
            window.showHub = (mode) => {
                timeHub?.remove();
                timeHubMode = mode;
                timeHub = document.createElement('div');
                timeHub.className = 'tm-proto-inline-time-hub';
                timeHub.style.height = mode === 'date' ? '360px' : '220px';
                timeHub.innerHTML = mode === 'date' ? '<div>日期选择</div>' : '<div>时间选择</div>';
                document.body.appendChild(timeHub);
                positionTimeHub();
                return timeHub.getBoundingClientRect().toJSON();
            };
            position();
        ` });
        async function geometry() {
            return page.evaluate(() => {
                const pop = document.querySelector('#editor');
                const footer = pop.querySelector('.tm-proto-inline-editor-actions');
                const save = footer.querySelector('.tm-proto-inline-save');
                const body = pop.querySelector('.tm-proto-inline-editor-body');
                return { shell: pop.getBoundingClientRect().toJSON(), footer: footer.getBoundingClientRect().toJSON(),
                    save: save.getBoundingClientRect().toJSON(), body: body.getBoundingClientRect().toJSON(),
                    scrollable: body.scrollHeight > body.clientHeight, viewportHeight: window.visualViewport.height };
            });
        }
        let boxes = await geometry();
        assert.equal(Math.round(boxes.shell.width), width, 'editor fills mobile width');
        assert.equal(Math.round(boxes.shell.height), height, 'editor fills mobile height');
        await page.evaluate((nextHeight) => window.setVisibleHeight(nextHeight), keyboardHeight);
        boxes = await geometry();
        assert.equal(Math.round(boxes.shell.height), keyboardHeight, 'editor follows the visible viewport');
        assert.ok(boxes.save.bottom <= keyboardHeight + 1, `save remains visible above keyboard: ${JSON.stringify(boxes)}`);
        assert.ok(boxes.body.bottom <= boxes.footer.top + 1, 'settings scroll above the fixed actions');
        assert.equal(boxes.scrollable, true, 'settings remain scrollable');
        await page.locator('.tm-proto-inline-editor-body').evaluate((body) => { body.scrollTop = body.scrollHeight; });
        boxes = await geometry();
        assert.ok(boxes.save.bottom <= keyboardHeight + 1, 'scrolling does not move the actions');
        for (const mode of ['date', 'time']) {
            const hub = await page.evaluate((value) => window.showHub(value), mode);
            assert.ok(hub.width > 200 && hub.height > 100, `${mode} picker has a usable surface`);
            assert.ok(hub.top >= -1 && hub.bottom <= keyboardHeight + 1,
                `${mode} picker stays within the full-screen editor: ${JSON.stringify(hub)}`);
            assert.ok(hub.top < 180, `${mode} picker is not clamped below the all-day area`);
            const hit = await page.evaluate(({ x, y }) =>
                !!document.elementFromPoint(x, y)?.closest('.tm-proto-inline-time-hub'),
            { x: hub.left + hub.width / 2, y: hub.top + hub.height / 2 });
            assert.equal(hit, true, `${mode} picker is above the editor`);
        }
        if (width === 390) {
            fs.mkdirSync(path.join(root, 'output', 'playwright'), { recursive: true });
            await page.screenshot({ path: path.join(root, 'output', 'playwright', 'calendar-mobile-draft-editor-keyboard.png'), animations: 'disabled' });
        }
        console.log(`mobile draft editor viewport ${width}x${height} -> ${keyboardHeight} passed`);
    } finally {
        await context.close();
    }
}

async function run() {
    const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
    try {
        await checkViewport(browser, 390, 780, 420);
        await checkViewport(browser, 320, 640, 340);
        await checkViewport(browser, 780, 390, 260);
    } finally {
        await browser.close();
    }
}

if (require.main === module) run().catch((error) => { console.error(error); process.exitCode = 1; });
