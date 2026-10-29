'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const detail = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/52-task-detail-runtime.js'), 'utf8');
const services = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'task-horizon.css'), 'utf8');
function segment(source, startToken, endToken) {
    const start = source.indexOf(startToken);
    const end = source.indexOf(endToken, start + startToken.length);
    assert.ok(start >= 0 && end > start, startToken);
    return source.slice(start, end);
}
const viewportRuntime = segment(services, '    function __tmApplyMobileDetailSheetViewportMetrics(', '\n    const __tmRenderViewSwitcherButtons');
const autoHeightRuntime = segment(detail, '        const supportsNativeTextareaAutoHeight =', '        const setInlinePopoverBusyState =');
const titleRuntime = segment(detail, '        const titleTextarea =', '        const fsrsReviewButtons =');
const remarkRuntime = segment(detail, '\n        const remarkShell = root.querySelector(', "\n        root.querySelectorAll('textarea[data-tm-detail-custom-text-field]')");

async function settle(page) {
    await page.waitForTimeout(400);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function mount(page, { panelId = 'tmTaskDetailSheetPanel', fullscreen = true, long = false, mobile = true, fallbackHeight = false } = {}) {
    await page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1">
        <style>${css}</style><style>
        html,body { margin:0; overflow:hidden; }
        #fixture { position:fixed; inset:0; width:100%; height:100%; margin:0; padding:0; transform:none; }
        #${panelId} { scroll-behavior:auto; }
        .fixture-before { height:460px; flex-shrink:0; }
        .fixture-after { height:300px; flex-shrink:0; }
        textarea { width:100%; box-sizing:border-box; font-size:16px; }
        #keyboard { position:fixed; left:0; right:0; bottom:0; height:0; background:#cdd1d8; z-index:999999; }
        </style>
        <div id="fixture" class="tm-modal ${mobile ? 'tm-modal--mobile' : ''}">
            <div class="tm-main-stage tm-main-stage--with-bottom-viewbar">
            ${panelId !== 'tmChecklistSheetPanel' ? '<div id="tmChecklistSheetPanel" hidden></div>' : ''}
            <div id="tmTaskDetailSheet" class="tm-checklist-sheet tm-checklist-sheet--open ${fullscreen ? 'tm-checklist-sheet--fullscreen' : ''}">
                <div class="tm-checklist-sheet-handle"></div>
                <div id="${panelId}" class="tm-checklist-sheet-body">
                    <div class="fixture-before">任务标题与属性</div>
                    <section class="tm-task-detail-section">
                        <div class="tm-task-detail-section-head">备注</div>
                        <div class="tm-task-detail-remark-shell" data-tm-detail-remark-shell>
                            <div class="tm-task-detail-remark-preview" data-tm-detail-remark-preview tabindex="0"></div>
                            <textarea class="bc-textarea tm-task-detail-remark-editor" data-tm-detail="remark"></textarea>
                        </div>
                    </section>
                    <div class="fixture-after">子任务</div>
                </div>
            </div>
            <nav class="tm-mobile-bottom-viewbar">清单 · 表格 · 看板 · 日历</nav>
            </div>
        </div><div id="keyboard"></div>`);
    await page.evaluate(({ panelId, long, mobile, fallbackHeight, viewportRuntime, autoHeightRuntime, titleRuntime, remarkRuntime }) => {
        const root = document.getElementById(panelId);
        const state = { modal: document.getElementById('fixture') };
        const viewport = Object.assign(new EventTarget(), { height: innerHeight, width: innerWidth, offsetTop: 0, offsetLeft: 0 });
        Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
        const __tmGetRuntimeClientKind = () => mobile ? 'android-app' : 'desktop-browser';
        const __tmComputeMobileBottomViewbarLayoutSig = () => 'unchanged';
        const __tmApplyMobileBrowserViewportMetrics = () => {};
        const __tmRerenderCurrentViewInPlace = () => { throw new Error('keyboard changes must not rebuild the view'); };
        const __tmWasHiddenAt = 0;
        globalThis.__tmRuntimeEvents = {
            on: (target, type, handler, options) => target.addEventListener(type, handler, options),
            off: (target, type, handler, options) => target?.removeEventListener(type, handler, options),
        };
        eval(viewportRuntime);
        const task = { id: 'fixture-task', remark: long ? Array.from({ length: 70 }, (_, i) => `第 ${i + 1} 行备注内容`).join('\n') : '待补充的备注' };
        root.__tmTaskDetailTask = task;
        root.querySelector('textarea').value = task.remark;
        const abortController = new AbortController();
        const on = (target, type, handler, options = {}) => target?.addEventListener(type, handler, { ...options, signal: abortController.signal });
        const embedded = true;
        const taskId = task.id;
        const __tmIsMobileDevice = () => mobile;
        const __tmResolveChecklistDetailPanel = () => ({ panel: document.getElementById('tmChecklistSheetPanel') });
        const __tmGetTaskDetailRemarkRaw = task => task.remark;
        const __tmNormalizeRemarkMarkdown = value => String(value);
        const __tmRenderRemarkMarkdown = value => value.replace(/\n/g, '<br>') || '点击添加备注';
        const __tmBindRemarkTextareaUndoHistory = () => {};
        const __tmHandleRemarkTextareaKeydown = () => false;
        const getBoundTask = () => task;
        const getBoundTaskId = () => taskId;
        const isSessionActive = () => true;
        const pendingDetailCommitErrors = new Map();
        const syncRemarkSavedState = value => { root.querySelector('textarea').dataset.savedValue = value; };
        const commitDetailFieldPatch = patch => { Object.assign(task, patch); return Promise.resolve(true); };
        const scheduleAutoSave = () => {};
        const flushAutoSaveNow = () => Promise.resolve();
        let restores = 0;
        const __tmCaptureChecklistDetailScrollSnapshot = () => ({ top: root.scrollTop });
        const __tmRestoreChecklistDetailScrollSnapshot = snapshot => { restores++; root.scrollTop = snapshot.top; };
        const __tmCaptureKanbanDetailScrollSnapshot = () => null;
        const __tmCaptureStandaloneTaskDetailScrollSnapshot = () => null;
        // Run the production auto-height fallback too, as used by older Android WebViews.
        const CSS = fallbackHeight ? { supports: () => false } : window.CSS;
        eval(autoHeightRuntime + '\n' + remarkRuntime);
        __tmBindMobileViewportAutoRefresh(state.modal);
        window.fixture = {
            resize(height, top = 0) {
                viewport.height = height;
                viewport.offsetTop = top;
                document.getElementById('keyboard').style.height = `${innerHeight - top - height}px`;
                viewport.dispatchEvent(new Event('resize'));
                viewport.dispatchEvent(new Event('scroll'));
            },
            abort: () => { __tmUnbindMobileViewportAutoRefresh(); abortController.abort(); },
            restores: () => restores,
            bindTitle() { eval(autoHeightRuntime + '\n' + titleRuntime); },
        };
    }, { panelId, long, mobile, fallbackHeight, viewportRuntime, autoHeightRuntime, titleRuntime, remarkRuntime });
    await page.locator('[data-tm-detail-remark-preview]').evaluate(el => el.click());
    await settle(page);
}

async function geometry(page) {
    return page.locator('textarea').evaluate(input => {
        const root = input.closest('.tm-checklist-sheet-body');
        const viewport = window.visualViewport;
        return {
            input: input.getBoundingClientRect().toJSON(),
            sheet: input.closest('.tm-checklist-sheet').getBoundingClientRect().toJSON(),
            panel: root.getBoundingClientRect().toJSON(),
            scroll: root.scrollTop,
            inputOverflow: input.scrollHeight > input.clientHeight,
            focused: document.activeElement === input,
            top: viewport?.offsetTop || 0,
            bottom: (viewport?.offsetTop || 0) + (viewport?.height || innerHeight),
            restores: window.fixture.restores(),
        };
    });
}

function assertVisible(box, label) {
    assert.ok(box.input.top >= Math.max(box.top, box.panel.top) + 10, `${label}: input top must stay in view: ${JSON.stringify(box)}`);
    assert.ok(box.input.bottom <= Math.min(box.bottom, box.panel.bottom) - 10, `${label}: input bottom must stay above the keyboard: ${JSON.stringify(box)}`);
    assert.ok(box.sheet.top >= box.top && box.sheet.bottom <= box.bottom + 1, `${label}: sheet must fit the visual viewport`);
    assert.equal(box.focused, true, `${label}: keyboard resize must preserve focus`);
}

async function checkOutsideTouchDrag(page, context, kind) {
    await mount(page);
    if (kind === 'title') {
        await page.evaluate(() => {
            const title = document.createElement('textarea');
            title.dataset.tmDetail = 'content';
            title.style.cssText = 'position:fixed;top:60px;left:45px;width:280px;height:60px;z-index:99999';
            document.querySelector('.tm-checklist-sheet-body').appendChild(title);
            fixture.bindTitle();
            title.focus({ preventScroll: true });
        });
    }
    const editor = page.locator(`[data-tm-detail="${kind === 'title' ? 'content' : 'remark'}"]`);
    await editor.fill('拖动前未保存的内容');
    await page.evaluate(() => fixture.resize(460));
    await settle(page);
    const session = await context.newCDPSession(page);
    const before = await page.locator('.tm-checklist-sheet-body').evaluate(el => el.scrollTop);
    try {
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 8, y: 300 }] });
        assert.equal(await editor.evaluate(el => document.activeElement === el), true, `${kind}: touching outside must not dismiss the keyboard before gesture intent is known`);
        for (let step = 1; step <= 6; step++) {
            await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 8, y: 300 - step * 14 }] });
            await page.waitForTimeout(20);
        }
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await settle(page);
        assert.equal(await editor.evaluate(el => document.activeElement === el), true, `${kind}: scrolling outside must retain editor focus`);
        assert.equal(await editor.inputValue(), '拖动前未保存的内容', `${kind}: scrolling must retain the draft`);
        assert.ok(await page.locator('.tm-checklist-sheet-body').evaluate(el => el.scrollTop) > before + 10,
            `${kind}: the outside drag must still scroll the detail content`);
        assert.equal(await page.locator('.tm-mobile-bottom-viewbar').isVisible(), false, 'the bottom bar must stay hidden during keyboard editing');
        if (kind === 'remark') {
            assert.equal(await editor.evaluate(el => el.closest('[data-tm-detail-remark-shell]').classList.contains('is-editing')), true,
                'dragging must not exit remark editing');
        }
        // A completed tap outside still leaves the editor and commits its draft.
        await page.touchscreen.tap(8, 90);
        await settle(page);
        assert.equal(await editor.evaluate(el => document.activeElement === el), false, `${kind}: an actual outside tap must still dismiss the keyboard`);
        if (kind === 'remark') {
            assert.equal(await editor.evaluate(el => el.closest('[data-tm-detail-remark-shell]').classList.contains('is-editing')), false);
            assert.equal(await editor.evaluate(el => el.closest('.tm-checklist-sheet-body').__tmTaskDetailTask.remark), '拖动前未保存的内容');
        }
    } finally { await session.detach(); }
    await page.evaluate(() => fixture.abort());
    console.log(`outside touch drag preserves ${kind} editing; outside tap still exits`);
}

(async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE || undefined });
    try {
        const errors = [];
        const context = await browser.newContext({ viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true,
            userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/145.0.0.0 Mobile Safari/537.36' });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        for (const kind of ['remark', 'title']) await checkOutsideTouchDrag(page, context, kind);
        for (const options of [
            {},
            { fullscreen: false },
            { panelId: 'tmChecklistSheetPanel' },
            { long: true },
            { long: true, fallbackHeight: true },
        ]) {
            await mount(page, options);
            assert.equal(await page.locator('.tm-mobile-bottom-viewbar').isVisible(), true, 'focus alone must not hide the bar for a hardware keyboard');
            await page.evaluate(() => fixture.resize(innerHeight - 60));
            await settle(page);
            assert.equal(await page.locator('.tm-mobile-bottom-viewbar').isVisible(), true, 'small browser chrome changes must not count as a keyboard');
            await page.evaluate(() => fixture.resize(460));
            await settle(page);
            assert.equal(await page.locator('.tm-mobile-bottom-viewbar').isVisible(), false, 'the view switch bar must hide while the software keyboard is open');
            assertVisible(await geometry(page), JSON.stringify(options));
            for (const [height, top] of [[420, 35], [390, 65], [460, 0]]) {
                await page.evaluate(([height, top]) => fixture.resize(height, top), [height, top]);
                await settle(page);
                assertVisible(await geometry(page), 'keyboard animation / viewport pan');
            }
            const before = await geometry(page);
            await page.locator('textarea').press('End');
            await page.locator('textarea').pressSequentially('继续输入');
            await settle(page);
            const after = await geometry(page);
            assertVisible(after, 'typing');
            assert.ok(Math.abs(after.scroll - before.scroll) < 2, 'typing must not jump the outer detail scroller');
            assert.equal(after.restores, 0, 'mobile editing must not replay stale scroll snapshots');
            if (options.long) assert.equal(after.inputOverflow, true, 'long remarks scroll inside the input');
            if (options.long && !options.fallbackHeight) {
                const output = path.join(root, 'output/playwright');
                fs.mkdirSync(output, { recursive: true });
                await page.screenshot({ path: path.join(output, 'task-detail-android-remark-keyboard.png') });
            }
            await page.evaluate(() => fixture.resize(innerHeight));
            await settle(page);
            assert.equal(await page.locator('.tm-mobile-bottom-viewbar').isVisible(), true, 'the bar must return when the keyboard closes even if the input stays focused');
            assertVisible(await geometry(page), 'keyboard dismissal');
            const stable = await geometry(page);
            await page.evaluate(() => {
                for (let i = 0; i < 12; i++) visualViewport.dispatchEvent(new Event('scroll'));
            });
            await settle(page);
            assert.ok(Math.abs((await geometry(page)).scroll - stable.scroll) < 1, 'settled viewport events must not move the editor');
            await page.evaluate(() => fixture.abort());
            console.log(`remark keyboard viewport passed: ${JSON.stringify(options)}`);
        }
        for (const [width, height, keyboardHeight] of [[320, 640, 340], [780, 390, 200]]) {
            await page.setViewportSize({ width, height });
            await mount(page, { long: true, fallbackHeight: true });
            await page.evaluate(height => fixture.resize(height), keyboardHeight);
            await settle(page);
            assertVisible(await geometry(page), `${width}x${height}`);
            // Older WebViews resize the entire layout and may lack visualViewport.
            await page.setViewportSize({ width, height: keyboardHeight });
            await page.evaluate(() => {
                Object.defineProperty(window, 'visualViewport', { configurable: true, value: null });
                window.dispatchEvent(new Event('resize'));
            });
            await settle(page);
            assertVisible(await geometry(page), 'layout resize without visualViewport');
            assert.equal(await page.locator('.tm-mobile-bottom-viewbar').isVisible(), false, 'native layout resizing must also hide the bottom bar without visualViewport');
            await page.setViewportSize({ width, height });
            await page.evaluate(() => window.dispatchEvent(new Event('resize')));
            await settle(page);
            assert.equal(await page.locator('.tm-mobile-bottom-viewbar').isVisible(), true, 'native keyboard dismissal must restore the bottom bar');
            await page.evaluate(() => fixture.abort());
            console.log(`remark keyboard layout resize passed: ${width}x${height}`);
        }
        await page.setViewportSize({ width: 393, height: 851 });
        for (const kind of ['title', 'custom-text', 'custom-textarea', 'contenteditable']) {
            await mount(page);
            await page.evaluate(kind => {
                const field = document.createElement(kind === 'custom-textarea' ? 'textarea' : kind === 'contenteditable' ? 'div' : 'input');
                field.id = 'custom-editor';
                if (kind === 'contenteditable') field.contentEditable = 'true';
                else if (kind === 'custom-textarea') field.setAttribute('data-tm-detail-custom-text-field', 'description');
                else field.setAttribute('data-tm-detail', kind === 'title' ? 'content' : 'custom-text');
                field.style.cssText = 'position:fixed;top:40px;left:20px;width:220px;height:50px;z-index:99999';
                (kind === 'custom-text' ? document.body : document.getElementById('fixture')).appendChild(field);
                field.focus({ preventScroll: true });
            }, kind);
            await page.evaluate(() => fixture.resize(460));
            await settle(page);
            assert.equal(await page.locator('.tm-mobile-bottom-viewbar').isVisible(), false, `${kind} must hide the view bar when the keyboard opens`);
            await page.locator('#custom-editor').fill('自定义文本输入');
            assert.equal(await page.locator('.tm-mobile-bottom-viewbar').isVisible(), false, `${kind} must keep the view bar hidden while typing`);
            await page.evaluate(() => fixture.resize(innerHeight));
            await settle(page);
            assert.equal(await page.locator('.tm-mobile-bottom-viewbar').isVisible(), true, `${kind} must restore the bar when the keyboard closes`);
            await page.evaluate(() => fixture.abort());
            console.log(`keyboard view bar visibility passed: ${kind}`);
        }
        await mount(page, { mobile: false });
        assert.ok((await geometry(page)).restores > 0, 'desktop must retain scroll preservation');
        await page.evaluate(() => fixture.resize(460));
        await settle(page);
        assert.equal(await page.locator('.tm-mobile-bottom-viewbar').isVisible(), true, 'desktop resizing must retain its view bar');
        await page.evaluate(() => fixture.abort());
        assert.deepEqual(errors, [], 'remark interaction must not produce browser errors');
        await context.close();
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
