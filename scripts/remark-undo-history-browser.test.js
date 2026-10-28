'use strict';

// Uses production history, toolbar bindings, quickbar editor and styles in an isolated page.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
function segment(source, start, end) {
    const from = source.indexOf(start), to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, start);
    return source.slice(from, to);
}
const services = read('src/task-horizon/main/20-api-and-runtime-services.js');
const foundation = read('src/task-horizon/main/30-dialogs-and-ui-foundation.js');
const coordinator = read('src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js');
const quickbar = read('quickbar.js');
const quick = (start, end) => segment(quickbar, start, end);
const script = `(() => {
    const esc = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const __tmEscAttr = esc;
    ${segment(foundation, '    function __tmNormalizeLucideIconName(', '    function __tmRenderInlineIcon(')}
    ${quick('function buildTooltipAttrs(', 'function getFloatbarCoreIconName(')}
    const __tmBuildTooltipAttrs = (text, options = {}) => buildTooltipAttrs(text, options.side || 'top');
    const __tmNormalizeRemarkMarkdown = value => String(value || '').trim();
    const __tmRenderRemarkMarkdown = value => esc(value);
    const __tmStripRemarkMarkdown = value => String(value || '');
    ${segment(services, '    function __tmGetTextareaSelectionRange(', '    function __tmNormalizeHeadingText(')}
    ${segment(coordinator, '    function __tmBuildRemarkMarkdownToolbarHtml(', '    function __tmBuildTaskRepeatHistorySectionHtml(')}
    const detail = document.querySelector('#detail');
    detail.innerHTML = __tmBuildTaskDetailRemarkSectionHtml('原有备注', () => '');
    const textarea = detail.querySelector('textarea');
    const toolbar = detail.querySelector('[data-tm-detail-remark-toolbar]');
    detail.querySelector('[data-tm-detail-remark-shell]').classList.add('is-editing');
    toolbar.classList.add('is-open');
    __tmBindRemarkTextareaUndoHistory(textarea);
    __tmBindRemarkMarkdownToolbar(toolbar, textarea);
    textarea.addEventListener('keydown', event => __tmHandleRemarkTextareaKeydown(textarea, event));
    window.detailInputEvents = 0;
    textarea.addEventListener('input', () => window.detailInputEvents++);
    window.resetDetail = value => { textarea.value = value; __tmResetRemarkTextareaUndoHistory(textarea); };
    window.externalDetail = value => __tmSetRemarkTextareaExternalValue(textarea, value);
    window.stickyToolbar = () => __tmBuildRemarkMarkdownToolbarHtml();
    ${quick('function renderQuickbarRemarkIcon(', 'async function saveRawTaskAttrWithUndo(')}
    ${quick('// 输入编辑器', '// 状态变量')}
    let currentBlockId = 'task-a', currentProps = {}, quickbarTextEditorAutoSave = null, inputEditorViewportCleanup = null;
    const getRemarkMarkdownTools = () => globalThis.__tmRemarkMarkdownTools;
    const getQuickbarDurationPresetOptions = () => [];
    const normalizeRemarkMarkdown = __tmNormalizeRemarkMarkdown;
    const normalizeTomatoCountValue = value => String(value || '').trim();
    const renderFloatBar = () => {}, patchInlineMetaCache = () => {}, refreshInlineMetaByTaskId = () => {};
    const showMessage = () => {}, dispatchTaskAttrUpdated = () => {}, closeSelectMenu = () => {};
    window.savedRemarks = [];
    const saveTaskAttrWithUndo = async (blockId, attrKey, value) => {
        window.savedRemarks.push({ blockId, attrKey, value }); return { success: true };
    };
    ${quick('function getInputEditorControls()', 'function isQuickbarInteractionTarget(')}
    ${quick('function setInputEditorMode(', 'function getBlockElById(')}
    ${quick('function showTextEditor(', '// 隐藏所有弹出层')}
    ${quick('function hideAllPopups()', '// 更新悬浮条位置')}
    window.openQuickbar = (value = '原有备注', taskId = 'task-a') => {
        currentBlockId = taskId;
        showTextEditor(document.querySelector('#anchor'), { attrKey: 'custom-remark', name: '备注' }, value);
    };
    document.querySelector('#anchor').onclick = () => window.openQuickbar();
})();`;
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${read('src/basecoat/basecoat.css')}\n${read('task-horizon.css')}\n${quick('style.textContent = `', '`.trim();').slice('style.textContent = `'.length)}</style>
<style>
    :root{--b3-theme-background:#f8f8f6;--b3-theme-surface:#f0f0ed;--b3-theme-on-surface:#30312e;
        --b3-theme-primary:#527e68;--b3-border-color:#d3d5cf;--b3-list-hover:#e3e6df;
        --background:#f8f8f6;--foreground:#30312e;--border:#d3d5cf;--primary:#527e68;
        --secondary:#f0f0ed;--secondary-foreground:#30312e;--input:#f8f8f6;--ring:#527e6840;
        --popover:#f8f8f6;--popover-foreground:#30312e;--radius:8px}
    body{margin:0;padding:16px;box-sizing:border-box;background:var(--background);color:var(--foreground);font:14px system-ui}
    main{max-width:600px;margin:0 auto} h1{font-size:16px}
    #detail{margin:20px 0 32px;padding:0;width:100%;max-width:100%;box-sizing:border-box;border:0;box-shadow:none;background:transparent}
    #anchor{display:block;margin:0 auto} textarea{box-sizing:border-box;width:100%}
</style><main><h1>备注撤销与重做</h1><div id="detail" class="tm-task-detail"></div><button id="anchor">打开悬浮条备注</button></main>
<script>${script.replace(/<\/script/gi, '<\\/script')}</script></html>`;
const output = path.join(root, 'output/playwright');
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'remark-undo-history.html'), html);

async function checkEditor(page, textarea, undo, redo) {
    assert.equal(await undo.isDisabled(), true);
    assert.equal(await redo.isDisabled(), true);
    await textarea.click();
    await textarea.press('End');
    await textarea.pressSequentially('ab');
    assert.equal(await undo.isEnabled(), true);
    await undo.click();
    assert.equal(await textarea.inputValue(), '原有备注');
    assert.equal(await textarea.evaluate(el => el === document.activeElement), true, 'buttons preserve editor focus');
    assert.equal(await undo.isDisabled(), true);
    assert.equal(await redo.isEnabled(), true);
    await textarea.press('Control+z');
    assert.equal(await textarea.inputValue(), '原有备注', 'exhausted history cannot run native undo');
    await redo.click();
    assert.equal(await textarea.inputValue(), '原有备注ab');
    await textarea.press('Control+z');
    await textarea.press('Control+y');
    assert.equal(await textarea.inputValue(), '原有备注ab');
    await textarea.press('Control+z');
    await textarea.press('Control+Shift+z');
    assert.equal(await textarea.inputValue(), '原有备注ab');
    await textarea.press('Control+z');
    await textarea.pressSequentially('X');
    assert.equal(await redo.isDisabled(), true);
    await textarea.evaluate(el => el.setSelectionRange(0, 4));
    await textarea.press('Control+b');
    assert.equal(await textarea.inputValue(), '**原有备注**X');
    await undo.click();
    assert.equal(await textarea.inputValue(), '原有备注X');
    assert.deepEqual(await textarea.evaluate(el => [el.selectionStart, el.selectionEnd]), [0, 4]);
    await textarea.evaluate(el => el.dispatchEvent(new InputEvent('beforeinput', { inputType: 'historyRedo', cancelable: true, bubbles: true })));
    assert.equal(await textarea.inputValue(), '**原有备注**X', 'native history menu uses the same stack');
}

async function checkIndent(textarea, indent, outdent, undo) {
    const original = await textarea.inputValue();
    await textarea.evaluate(el => el.setSelectionRange(0, el.value.length));
    await indent.click();
    assert.equal(await textarea.inputValue(), '    ' + original);
    await undo.click();
    assert.equal(await textarea.inputValue(), original, 'indent is one undoable edit');
    await indent.click();
    await outdent.click();
    assert.equal(await textarea.inputValue(), original, 'outdent uses the same selection and indent width');
}

async function run() {
    const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
    const browser = await chromium.launch({ headless: true,
        ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
    try {
        for (const width of [320, 768, 1440]) {
            const page = await browser.newPage({ viewport: { width, height: 900 } });
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.goto('file:///' + path.join(output, 'remark-undo-history.html').replace(/\\/g, '/'));
            const detailTextarea = page.locator('#detail textarea');
            await checkEditor(page, detailTextarea, page.locator('[data-tm-detail-remark-tool="undo"]'), page.locator('[data-tm-detail-remark-tool="redo"]'));
            await checkIndent(detailTextarea, page.locator('[data-tm-detail-remark-tool="indent"]'),
                page.locator('[data-tm-detail-remark-tool="outdent"]'), page.locator('[data-tm-detail-remark-tool="undo"]'));
            assert.ok(await page.evaluate(() => window.detailInputEvents >= 10), 'undo and redo reuse the input/save path');
            await page.evaluate(() => window.externalDetail('外部更新'));
            assert.equal(await page.locator('[data-tm-detail-remark-tool="undo"]').isDisabled(), true);
            assert.equal(await page.locator('[data-tm-detail-remark-tool="redo"]').isDisabled(), true);
            assert.equal(await page.evaluate(() => window.stickyToolbar().includes('="undo"')), false, 'shared sticky toolbar keeps its existing scope');
            await page.evaluate(() => window.resetDetail('原有备注'));
            await detailTextarea.click();
            await detailTextarea.press('End');
            await detailTextarea.pressSequentially('ab');
            await page.evaluate(() => window.openQuickbar());
            const quickTextarea = page.locator('.sy-custom-props-floatbar__textarea');
            await checkEditor(page, quickTextarea, page.locator('[data-remark-tool="undo"]'), page.locator('[data-remark-tool="redo"]'));
            await checkIndent(quickTextarea, page.locator('[data-remark-tool="indent"]'),
                page.locator('[data-remark-tool="outdent"]'), page.locator('[data-remark-tool="undo"]'));
            const icons = await page.evaluate(() => [...document.querySelectorAll('[data-remark-tool]')].map(button => {
                const name = button.dataset.remarkTool;
                const quick = button.querySelector('svg');
                const detail = document.querySelector('[data-tm-detail-remark-tool="' + name + '"] svg');
                return { name, samePath: quick.querySelector('path').getAttribute('d') === detail.querySelector('path').getAttribute('d'),
                    quick: [quick.getBoundingClientRect().width, quick.getBoundingClientRect().height],
                    detail: [detail.getBoundingClientRect().width, detail.getBoundingClientRect().height] };
            }));
            assert.equal(icons.length, 11);
            for (const icon of icons) {
                assert.equal(icon.samePath, true, icon.name + ' shares the official Bold SVG in both toolbars');
                assert.deepEqual(icon.quick, [16, 16], icon.name + ' quickbar size');
                assert.deepEqual(icon.detail, [16, 16], icon.name + ' detail size');
            }
            await page.mouse.move(width - 1, 899);
            await page.waitForTimeout(160);
            await page.screenshot({ path: path.join(output, `remark-undo-history-${width}.png`) });
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'page must not overflow horizontally');
            await quickTextarea.press('Control+Enter');
            assert.equal((await page.evaluate(() => window.savedRemarks)).at(-1).value, '**原有备注**X');
            await page.evaluate(() => window.openQuickbar('任务乙备注', 'task-b'));
            assert.equal(await page.locator('[data-remark-tool="undo"]').isDisabled(), true);
            await quickTextarea.press('Control+z');
            assert.equal(await quickTextarea.inputValue(), '任务乙备注', 'opening another task resets native and custom history ownership');
            assert.deepEqual(errors, []);
            await page.close();
            console.log(`remark history buttons, keyboard, save and reset: ${width}px passed`);
        }
    } finally { await browser.close(); }
}
if (process.argv.includes('--fixture')) console.log(path.join(output, 'remark-undo-history.html'));
else run().catch(error => { console.error(error); process.exitCode = 1; });
