'use strict';

// Exercise remark and custom text editors with a simulated keyboard visual viewport.
// PLAYWRIGHT_MODULE / PLAYWRIGHT_EXECUTABLE may point to an existing installation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(process.env.QUICKBAR_SOURCE || path.join(root, 'quickbar.js'), 'utf8').replace(/\r\n/g, '\n');
function segment(startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start + startMarker.length);
    assert.ok(start >= 0 && end > start, startMarker);
    return source.slice(start, end);
}
const styles = segment('style.textContent = `', '`.trim();').slice('style.textContent = `'.length);
const editorSetup = segment('// 输入编辑器', '// 状态变量');
const editorRuntime = [
    segment('function getInputEditorControls()', 'function isQuickbarInteractionTarget('),
    segment('function setInputEditorMode(', 'function getBlockElById('),
    segment('function showTextEditor(', '// 隐藏所有弹出层'),
    segment('function hideAllPopups()', '// 更新悬浮条位置'),
].join('\n');

async function settle(page) {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function geometry(page) {
    return page.evaluate(() => {
        const editor = document.querySelector('.sy-custom-props-floatbar__input-editor');
        const textarea = editor.querySelector('textarea');
        const control = editor.querySelector('textarea:not(.is-hidden), input:not(.is-hidden)');
        const viewport = window.visualViewport;
        return {
            editor: editor.getBoundingClientRect().toJSON(),
            textarea: textarea.getBoundingClientRect().toJSON(),
            control: control.getBoundingClientRect().toJSON(),
            save: editor.querySelector('[data-action="save"]').getBoundingClientRect().toJSON(),
            cancel: editor.querySelector('[data-action="cancel"]').getBoundingClientRect().toJSON(),
            viewport: { left: viewport?.offsetLeft || 0, top: viewport?.offsetTop || 0,
                width: viewport?.width || innerWidth, height: viewport?.height || innerHeight },
            value: textarea.value, selection: [textarea.selectionStart, textarea.selectionEnd],
            focused: document.activeElement === textarea,
            scrollable: textarea.scrollHeight > textarea.clientHeight,
            visible: editor.classList.contains('is-visible'),
            listeners: window.viewportListenerCount(),
        };
    });
}

function assertVisible(boxes, label) {
    const view = boxes.viewport;
    for (const name of ['editor', 'control', 'save', 'cancel']) {
        const rect = boxes[name];
        assert.ok(rect.width > 0 && rect.height > 0, `${label}: ${name} is visible`);
        assert.ok(rect.top >= view.top + 5 && rect.bottom <= view.top + view.height - 5,
            `${label}: ${name} stays above the keyboard: ${JSON.stringify(boxes)}`);
        assert.ok(rect.left >= view.left + 5 && rect.right <= view.left + view.width - 5,
            `${label}: ${name} stays within the visible width: ${JSON.stringify(boxes)}`);
    }
}

async function checkViewport(browser, width, height, keyboardHeight, hasVisualViewport = true) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 1000, hasTouch: width < 1000 });
    try {
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.setContent(`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1">
            <style>${styles}</style><style>
                :root{--b3-theme-background:#202126;--b3-theme-surface:#2d2e35;--b3-theme-on-surface:#e6dbcb;
                    --b3-theme-primary:#df857d;--b3-border-color:#625854;--b3-dialog-shadow:0 4px 16px #15161966}
                body{margin:0;min-height:1600px;font:14px system-ui;background:var(--b3-theme-background)}
                #anchor{position:absolute;left:${width - 85}px;top:${Math.round(height * 0.65)}px;width:40px;height:28px}
            </style><button id="anchor">备注</button>`);
        await page.addScriptTag({ content: `(() => {
            const listenerRecords = [];
            const track = (target, types) => {
                const add = target.addEventListener.bind(target), remove = target.removeEventListener.bind(target);
                target.addEventListener = (type, listener, options) => {
                    if (types.includes(type)) listenerRecords.push({ target, type, listener });
                    return add(type, listener, options);
                };
                target.removeEventListener = (type, listener, options) => {
                    const index = listenerRecords.findIndex(item => item.target === target && item.type === type && item.listener === listener);
                    if (index >= 0) listenerRecords.splice(index, 1);
                    return remove(type, listener, options);
                };
            };
            const viewport = Object.assign(new EventTarget(), { width: ${width}, height: ${height}, offsetLeft: 0, offsetTop: 0 });
            track(viewport, ['resize', 'scroll']); track(window, ['resize']); track(document, ['scroll']);
            Object.defineProperty(window, 'visualViewport', { configurable: true, value: ${hasVisualViewport ? 'viewport' : 'null'} });
            window.viewportListenerCount = () => listenerRecords.length;
            window.moveViewport = (metrics, event = 'resize') => { Object.assign(viewport, metrics); viewport.dispatchEvent(new Event(event)); };
            const buildTooltipAttrs = () => '';
            ${editorSetup}
            let currentBlockId = 'remark-test', currentProps = {}, quickbarTextEditorAutoSave = null, inputEditorViewportCleanup = null;
            const getRemarkMarkdownTools = () => null, getQuickbarDurationPresetOptions = () => [];
            const normalizeRemarkMarkdown = value => String(value || '').trim();
            const normalizeTomatoCountValue = value => String(value || '').trim();
            const renderFloatBar = () => {}, patchInlineMetaCache = () => {}, refreshInlineMetaByTaskId = () => {};
            const showMessage = () => {}, dispatchTaskAttrUpdated = () => {}, closeSelectMenu = () => {};
            window.savedRemarks = [];
            const saveTaskAttrWithUndo = async (blockId, attrKey, value) => {
                window.savedRemarks.push({ blockId, attrKey, value }); return { success: true };
            };
            ${editorRuntime}
            window.openRemark = (value = '原有备注') => showTextEditor(document.querySelector('#anchor'),
                { attrKey: 'custom-remark', name: '备注', placeholder: '输入备注' }, value);
            window.openText = () => showTextEditor(document.querySelector('#anchor'),
                { attrKey: 'custom-project-note', type: 'text', customFieldId: 'project-note', customFieldType: 'text', name: '自定义文本列' }, '自定义文本内容');
            window.hideEditor = hideAllPopups;
            window.openRemark();
        })();` });
        await settle(page);
        assertVisible(await geometry(page), 'before keyboard');

        if (hasVisualViewport) {
            await page.evaluate(next => window.moveViewport({ height: next }), keyboardHeight);
        } else {
            await page.setViewportSize({ width, height: keyboardHeight });
        }
        await settle(page);
        assertVisible(await geometry(page), 'keyboard opens without layout resize');

        if (hasVisualViewport) {
            await page.evaluate(() => window.moveViewport({ offsetTop: 90 }, 'scroll'));
            await settle(page);
            assertVisible(await geometry(page), 'keyboard pans viewport');
            await page.evaluate(() => window.scrollTo(0, 120));
            await settle(page);
            assertVisible(await geometry(page), 'document scroll');
        }

        const textarea = page.locator('.sy-custom-props-floatbar__textarea');
        const longRemark = '较长的备注内容，需要在输入框内继续编辑。\n'.repeat(80).trim();
        await textarea.fill(longRemark);
        await settle(page);
        let boxes = await geometry(page);
        assertVisible(boxes, 'long remark');
        assert.equal(boxes.scrollable, true, 'long remarks scroll inside the textarea');
        await textarea.evaluate(element => { element.scrollTop = 200; });
        await settle(page);
        assert.equal(await textarea.evaluate(element => element.scrollTop), 200, 'scrolling the draft must not reset its position');
        await page.locator('[data-action="remark-tools"]').click();
        await settle(page);
        assertVisible(await geometry(page), 'expanded formatting tools');

        await textarea.evaluate(element => {
            element.focus({ preventScroll: true }); element.setSelectionRange(2, 5);
            element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '备注' }));
        });
        if (hasVisualViewport) {
            await page.evaluate(() => window.moveViewport({ offsetTop: 120, offsetLeft: 12, width: innerWidth - 24 }, 'scroll'));
        } else {
            await page.evaluate(() => window.dispatchEvent(new Event('resize')));
        }
        await settle(page);
        boxes = await geometry(page);
        assertVisible(boxes, 'resize during composition');
        assert.equal(boxes.value, longRemark, 'viewport changes preserve the draft');
        assert.deepEqual(boxes.selection, [2, 5], 'viewport changes preserve the selection');
        assert.equal(boxes.focused, true, 'viewport changes preserve input focus');
        await textarea.evaluate(element => element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '备注' })));

        if (width === 390 && hasVisualViewport) {
            fs.mkdirSync(path.join(root, 'output', 'playwright'), { recursive: true });
            await page.screenshot({ path: path.join(root, 'output', 'playwright', 'quickbar-remark-keyboard.png'), animations: 'disabled' });
        }
        if (hasVisualViewport) {
            await page.evaluate(({ width, height }) => window.moveViewport({ width, height, offsetTop: 0, offsetLeft: 0 }), { width, height });
        } else {
            await page.setViewportSize({ width, height });
        }
        await settle(page);
        assertVisible(await geometry(page), 'keyboard closes');
        await page.locator('[data-action="save"]').click();
        await settle(page);
        boxes = await geometry(page);
        assert.equal(boxes.visible, false, 'save closes the editor');
        assert.equal(boxes.listeners, 0, 'save releases viewport listeners');
        assert.equal((await page.evaluate(() => window.savedRemarks.at(-1))).value, longRemark, 'save persists the draft');

        await page.evaluate(() => { window.openRemark(); window.openRemark(); });
        await settle(page);
        assert.equal((await geometry(page)).listeners, hasVisualViewport ? 4 : 2, 'reopening does not accumulate listeners');
        await page.locator('[data-action="cancel"]').click();
        assert.equal((await geometry(page)).listeners, 0, 'cancel releases listeners');
        await page.evaluate(() => { window.openRemark(); window.hideEditor(); });
        await settle(page);
        assert.equal((await geometry(page)).listeners, 0, 'dismissal cancels pending frames and listeners');
        await page.evaluate(() => { window.openRemark(); window.openText(); });
        await settle(page);
        assert.equal((await geometry(page)).listeners, hasVisualViewport ? 4 : 2, 'switching editor modes replaces listeners');
        const input = page.locator('.sy-custom-props-floatbar__input');
        await input.fill('自定义文本列修改后');
        if (hasVisualViewport) {
            await page.evaluate(next => window.moveViewport({ height: next }), keyboardHeight);
        } else {
            await page.setViewportSize({ width, height: keyboardHeight });
        }
        await settle(page);
        assertVisible(await geometry(page), 'custom text column keyboard opens');
        if (hasVisualViewport) {
            await page.evaluate(() => window.moveViewport({ offsetTop: 90 }, 'scroll'));
            await settle(page);
            assertVisible(await geometry(page), 'custom text column viewport pans');
        }
        assert.equal(await input.inputValue(), '自定义文本列修改后', 'custom text draft survives keyboard changes');
        await page.locator('[data-action="save"]').click();
        await settle(page);
        assert.deepEqual(await page.evaluate(() => window.savedRemarks.at(-1)),
            { blockId: 'remark-test', attrKey: 'custom-project-note', value: '自定义文本列修改后' }, 'custom text persists to the correct attribute');
        assert.equal((await geometry(page)).listeners, 0, 'custom text save releases listeners');
        await page.evaluate(() => window.openText());
        await input.press('Escape');
        assert.equal((await geometry(page)).listeners, 0, 'Escape releases listeners');
        assert.deepEqual(errors, [], 'the editor must not produce browser errors');
        console.log(`quickbar text/remark viewport ${width}x${height} -> ${keyboardHeight}, visualViewport=${hasVisualViewport}: passed`);
    } finally {
        await context.close();
    }
}

async function run() {
    const browser = await chromium.launch({ headless: true,
        ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
    try {
        await checkViewport(browser, 390, 780, 420);
        await checkViewport(browser, 320, 640, 300);
        await checkViewport(browser, 780, 390, 190);
        await checkViewport(browser, 390, 780, 420, false);
        await checkViewport(browser, 1440, 900, 900);
    } finally {
        await browser.close();
    }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
