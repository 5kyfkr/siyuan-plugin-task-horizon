'use strict';

// Real Chromium exercises production pickers; only task persistence and SiYuan services are stubbed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const main = (file) => read(`src/task-horizon/main/${file}`);
const picker = main('task-runtime/53a-list-field-edit-runtime.js');
const quickAdd = main('task-runtime/53b-task-create-and-quick-add-runtime.js');
const dialogs = main('30-dialogs-and-ui-foundation.js');
const quickbar = read('quickbar.js');
function fn(source, name, indent = 4) {
    const prefix = ' '.repeat(indent);
    const from = source.indexOf(`${prefix}function ${name}(`);
    const asyncFrom = source.indexOf(`${prefix}async function ${name}(`);
    const start = from < 0 ? asyncFrom : from;
    const end = source.indexOf(`\n${prefix}}`, start);
    assert.ok(start >= 0 && end > start, `missing function ${name}`);
    return source.slice(start, end + indent + 2);
}
const qaStart = quickAdd.indexOf('    window.tmQuickAddOpenCustomFieldPicker = function(');
const qaEnd = quickAdd.indexOf('\n    };', qaStart);
const pickerCode = picker.slice(picker.indexOf('    function __tmGetDefaultExpandedCustomFieldOptionIds('), picker.indexOf('    window.tmOpenCustomFieldSelect ='));
const inline = main('task-runtime/51-whiteboard-and-link-runtime.js');
const runtime = main('20-api-and-runtime-services.js');
const stackStart = runtime.indexOf('    const __tmModalStack = [];');
const stackEnd = runtime.indexOf('    function __tmGetTodayDateKey(', stackStart);
const production = [
    fn(main('10-stores-rules-and-cache.js'), '__tmBuildCustomFieldOptionRuntime'),
    runtime.slice(stackStart, stackEnd),
    fn(inline, '__tmOpenInlineEditor'),
    pickerCode,
    quickAdd.slice(qaStart, qaEnd + 7),
    fn(dialogs, '__tmShowCustomFieldValuePrompt'),
    fn(dialogs, '__tmBatchSetCustomField'),
    fn(quickbar, 'closeSelectMenu', 8),
    fn(quickbar, 'showSelectMenu', 8),
].join('\n');
const options = [
    { id: 'work', name: '工作', color: '#5680a0' },
    { id: 'design', name: '设计', parentId: 'work', color: '#5680a0' },
    { id: 'dev', name: 'API Dev', parentId: 'work', color: '#5680a0' },
    { id: 'personal', name: '个人', color: '#5680a0' },
    { id: 'personal-design', name: '设计', parentId: 'personal', color: '#5680a0' },
    { id: 'archive', name: '旧项目', archived: true, color: '#888888' },
    { id: 'archive-child', name: '设计', parentId: 'archive', color: '#888888' },
];

async function setup(page, mobile = false) {
    await page.goto('about:blank');
    await page.setViewportSize(mobile ? { width: 375, height: 667 } : { width: 900, height: 700 });
    await page.setContent('<button id="anchor">标签</button><main id="qa"><input id="tmQuickAddInput"><button id="qa-anchor">标签</button></main>');
    await page.addStyleTag({ content: `:root{--b3-theme-primary:#3575ac;--b3-theme-background:#fafafa;--b3-theme-on-surface:#333;--b3-theme-on-surface-light:#777;--b3-theme-surface-light:#eee;--b3-border-color:#ddd;--tm-text-color:#333;--tm-card-bg:#fafafa;--tm-primary-color:#3575ac;--tm-secondary-text:#777;--tm-input-bg:#fff;--tm-border-color:#ddd}body{font:14px sans-serif}.b3-text-field{box-sizing:border-box;padding:6px;border:1px solid #ccc;border-radius:4px}.block__icon{border:0;background:transparent}#anchor{position:absolute;left:180px;top:100px}#qa{position:absolute;left:12px;top:220px}.tm-prompt-box{width:320px;padding:16px;background:var(--tm-card-bg);border:1px solid #ddd;box-sizing:border-box}.tm-prompt-modal{position:fixed;inset:0;background:#0002}.tm-prompt-buttons{display:flex;gap:8px;margin-top:12px}` });
    await page.addStyleTag({ content: read('task-horizon.css') });
    const cssStart = quickbar.indexOf('            .sy-custom-props-floatbar__select {');
    const cssEnd = quickbar.indexOf('            .sy-custom-props-floatbar__input-editor {', cssStart);
    await page.addStyleTag({ content: quickbar.slice(cssStart, cssEnd) });
    await page.evaluate(({ options, mobile }) => {
        window.mobile = mobile;
        window.field = { id: 'tags', name: '标签', type: 'multi', options };
        window.task = { id: 'task-a', customFieldValues: { tags: ['archive-child', 'missing'] } };
        window.writes = [];
        window.messages = [];
        window.failSave = false;
        window.holdSave = false;
        window.state = { quickAdd: { customFieldValues: {} }, quickAddModal: document.querySelector('#qa') };
        window.__tmInlineEditorState = null;
        window.__inlineEditorUnstack = null;
        window.__tmCloseInlineEditor = () => {
            window.__inlineEditorUnstack?.();
            window.__tmInlineEditorState?.cleanup();
            window.__tmInlineEditorState?.el.remove();
            window.__tmInlineEditorState = null;
        };
        window.__tmResolveInlineEditorZIndex = () => 100;
        window.__tmSanitizeCustomFieldOptionHierarchy = (values) => values;
        window.__tmIsMobileDevice = () => mobile;
        window.__tmRenderLucideIcon = () => '<span>›</span>';
        window.__tmBuildStatusChipStyle = () => '';
        window.__tmGetCustomFieldDefMap = () => new Map([[field.id, field]]);
        window.__tmGetCustomFieldDefs = () => [field];
        window.__tmGetQuickAddVisibleOptionCustomFieldDefs = () => [field];
        window.__tmNormalizeQuickAddCustomFieldValues = (value) => value;
        window.__tmResolveTaskForCardEdit = () => task;
        window.__tmIsCustomFieldApplicableToTask = () => true;
        window.__tmNormalizeCustomFieldValue = (definition, value) => definition.type === 'multi' ? (Array.isArray(value) ? value : []) : String(value || '');
        window.__tmGetTaskCustomFieldValue = (value, id) => value.customFieldValues[id];
        window.__tmPersistTaskCustomFieldValue = async (taskId, fieldId, value) => {
            if (holdSave) await new Promise((resolve) => { window.releaseSave = resolve; });
            if (failSave) return false;
            writes.push(value);
            task.customFieldValues[fieldId] = value;
            return true;
        };
        window.__tmApplyBatchAttrPatch = async (patch) => writes.push(patch.customFieldValues.tags);
        window.showSelectPrompt = async () => field.id;
        window.hint = (message) => messages.push(message);
        window.isMobileDevice = () => mobile;
        window.currentBlockId = 'task-a';
        window.currentProps = {};
        window.selectMenu = document.createElement('div');
        selectMenu.className = 'sy-custom-props-floatbar__select';
        document.body.appendChild(selectMenu);
        window.customFieldViewportCleanup = null;
        window.selectMenuSession = 0;
        window.normalizeQuickbarCustomFieldValue = (_, value) => value;
        window.serializeQuickbarCustomFieldValueForSave = (_, value) => value;
        window.buildStatusChipStyle = () => '';
        window.renderPhosphorBoldIcon = () => '<span>›</span>';
        window.esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        window.saveTaskAttrWithUndo = async (_, attr, value) => {
            const success = await __tmPersistTaskCustomFieldValue('task-a', field.id, value);
            return { success, taskId: 'task-a' };
        };
        for (const name of ['renderFloatBar', 'setInlineMetaOptimisticPatch', 'patchInlineMetaCache', 'refreshInlineMetaByTaskId', 'dispatchTaskAttrUpdated']) window[name] = () => {};
        window.resolveQuickbarAttrBindingFromBlockId = () => ({ taskId: 'task-a' });
        window.showMessage = hint;
    }, { options, mobile });
    await page.addScriptTag({ content: production });
    await page.evaluate(() => {
        globalThis['siyuan-plugin-task-horizon'] = { quickbarBridge: {
            createCustomFieldOptionSearch: __tmCreateCustomFieldOptionSearch,
            bindCustomFieldPickerViewport: (panel, anchor) => __tmBindCustomFieldPickerViewport(panel, anchor, true),
        } };
        window.openMain = () => __tmOpenCustomFieldInlineEditor(task.id, field.id, document.querySelector('#anchor'));
        window.openQuickAdd = () => tmQuickAddOpenCustomFieldPicker(field.id, { currentTarget: document.querySelector('#qa-anchor') });
        window.openQuickbar = () => {
            const runtime = __tmBuildCustomFieldOptionRuntime(field);
            showSelectMenu(document.querySelector('#anchor'), {
                name: field.name, customFieldId: field.id, customFieldType: field.type, attrKey: 'custom-tags',
                options: runtime.options.map((option) => ({ ...option, value: option.id, label: option.name,
                    pathLabel: runtime.pathById.get(option.id), effectiveArchived: runtime.effectiveArchivedById.get(option.id) })),
            }, task.customFieldValues.tags);
        };
    });
}

(async () => {
    const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || undefined });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const search = () => page.getByRole('searchbox', { name: '搜索选项' });
    const choice = (id) => page.locator(`[data-tm-custom-field-choice="${id}"]`);
    try {
        for (const entry of ['openMain', 'openQuickAdd', 'openQuickbar']) {
            await setup(page);
            await page.evaluate((entry) => window[entry](), entry);
            assert.equal(await search().count(), 1, entry);
            assert.equal(await search().evaluate((input) => document.activeElement === input), true);
            await page.evaluate(() => { window.originalInput = document.querySelector('.tm-custom-field-search input'); });
            await search().fill('  设计  ');
            assert.deepEqual(await page.locator('[data-tm-custom-field-choice]').allTextContents().then((a) => a.map((s) => s.trim())), ['工作 / 设计', '个人 / 设计']);
            await choice('design').click();
            await page.waitForFunction(() => document.querySelector('.tm-custom-field-search-count')?.textContent.includes('已选'));
            await search().fill('API');
            await search().press('Enter');
            await page.waitForFunction((entry) => (entry === 'openQuickAdd' ? state.quickAdd.customFieldValues.tags : task.customFieldValues.tags).includes('dev'), entry);
            const values = await page.evaluate((entry) => entry === 'openQuickAdd' ? state.quickAdd.customFieldValues.tags : task.customFieldValues.tags, entry);
            assert.ok(values.includes('design') && values.includes('dev'), `${entry}: cross-query selections survive`);
            if (entry !== 'openQuickAdd') assert.ok(values.includes('archive-child') && values.includes('missing'));
            assert.equal(await page.evaluate(() => originalInput === document.querySelector('.tm-custom-field-search input')), true);
            assert.equal(await search().inputValue(), 'API');
            const before = await page.evaluate(() => writes.length);
            await search().fill('no such option');
            await search().press('Enter');
            assert.equal(await page.evaluate(() => writes.length), before, 'search never writes');
            assert.equal(await page.getByText('没有匹配的选项', { exact: true }).count(), 1);
            await page.getByRole('button', { name: '清除搜索', exact: true }).click();
            assert.equal(await choice('archive-child').count(), 0, 'archived descendants cannot be added');
            assert.equal(await choice('work').count(), 1);
            await search().evaluate((input) => {
                input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
                input.value = '个人';
                input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
                input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', isComposing: true }));
            });
            assert.equal(await choice('work').count(), 1, 'IME waits for compositionend');
            await search().dispatchEvent('compositionend');
            assert.equal(await choice('work').count(), 0);
            assert.equal(await page.evaluate(() => writes.length), before);
            await search().press('Escape');
            assert.equal(await search().isVisible().catch(() => false), false, `${entry}: Escape closes`);
            console.log(`PASS ${entry}: search, selection, history, IME, keyboard, stable input`);
        }

        await setup(page);
        await page.evaluate(() => { window.batch = __tmBatchSetCustomField(); });
        await search().fill('设计');
        await choice('design').click();
        assert.equal(await page.evaluate(() => writes.length), 0);
        await page.getByRole('button', { name: '取消', exact: true }).click();
        assert.equal(await page.evaluate(async () => { await batch; return writes.length; }), 0);
        await page.evaluate(() => { window.batch = __tmBatchSetCustomField(); });
        await page.getByRole('button', { name: '清空', exact: true }).click();
        await page.getByRole('button', { name: '确定', exact: true }).click();
        assert.deepEqual(await page.evaluate(async () => { await batch; return writes; }), [[]]);
        await page.evaluate(() => { window.batch = __tmBatchSetCustomField(); });
        await search().fill('设计');
        await choice('design').click();
        await search().fill('api');
        await choice('dev').click();
        await page.getByRole('button', { name: '确定', exact: true }).click();
        assert.deepEqual(await page.evaluate(async () => { await batch; return writes.at(-1); }), ['design', 'dev']);
        console.log('PASS batch: cancel without writes, explicit clear, confirm once across queries');

        for (const entry of ['openMain', 'openQuickAdd', 'openQuickbar']) {
            await setup(page);
            await page.evaluate((entry) => { field.type = 'single'; task.customFieldValues.tags = ''; window[entry](); }, entry);
            await search().fill('设计');
            await search().press('ArrowDown');
            await search().press('Enter');
            await page.waitForFunction((entry) => (entry === 'openQuickAdd' ? state.quickAdd.customFieldValues.tags : task.customFieldValues.tags) === 'personal-design', entry);
            assert.equal(await search().isVisible().catch(() => false), false, 'single selection closes');
            await page.evaluate((entry) => { field.options = []; task.customFieldValues.tags = ''; state.quickAdd.customFieldValues = {}; window[entry](); }, entry);
            assert.equal(await page.getByText('当前字段没有可选项', { exact: true }).count(), 1);
            await search().fill('<>&" no-match');
            await search().press('Enter');
            assert.equal(await page.locator('[data-tm-custom-field-choice]').count(), 0);
            console.log(`PASS ${entry}: single selection, arrow keys, empty options, special characters`);
        }

        await setup(page);
        await page.evaluate(() => openMain());
        await page.locator('.tm-custom-field-picker-tree-row').first().getByTitle('收起子项').click();
        assert.equal(await choice('design').count(), 0);
        await search().fill('设计');
        assert.equal(await choice('design').count(), 1, 'collapsed descendants remain searchable');
        await page.getByRole('button', { name: '清除搜索', exact: true }).click();
        assert.equal(await choice('design').count(), 0, 'clearing search restores collapsed state');
        await search().fill('API');
        await page.getByRole('button', { name: '清空', exact: true }).click();
        await page.waitForFunction(() => writes.length === 1);
        assert.deepEqual(await page.evaluate(() => writes), [[]]);
        assert.equal(await search().inputValue(), 'API', 'field clear preserves query');
        console.log('PASS collapse restoration and explicit field clear');

        for (const entry of ['openMain', 'openQuickbar']) {
            await setup(page);
            await page.evaluate((entry) => { failSave = true; window[entry](); }, entry);
            await search().fill('api');
            await choice('dev').click();
            await page.waitForFunction(() => messages.length > 0);
            assert.deepEqual(await page.evaluate(() => task.customFieldValues.tags), ['archive-child', 'missing']);
            assert.equal(await search().isVisible(), true);
            assert.equal(await page.locator('[inert]').count(), 0);
            await page.evaluate(() => { failSave = false; holdSave = true; });
            await search().press('Enter');
            await page.waitForFunction(() => typeof releaseSave === 'function');
            await search().press('Enter');
            await page.evaluate(() => { holdSave = false; releaseSave(); });
            await page.waitForFunction(() => writes.length === 1);
            console.log(`PASS ${entry}: save failure and pending-save guard`);
        }

        await setup(page);
        const timings = [];
        for (const size of [100, 500, 1000]) {
            timings.push(await page.evaluate((size) => {
                __tmCloseInlineEditor();
                field.options = Array.from({ length: size }, (_, i) => ({ id: `o-${i}`, name: `Option ${i}`, color: '#5680a0' }));
                const start = performance.now(); openMain();
                const opened = performance.now();
                const input = document.querySelector('.tm-custom-field-search input');
                input.value = 'Option 99'; input.dispatchEvent(new Event('input'));
                return { size, openMs: Math.round(opened - start), searchMs: Math.round(performance.now() - opened), matches: document.querySelectorAll('[data-tm-custom-field-choice]').length };
            }, size));
        }
        assert.deepEqual(timings.map((item) => item.matches), [1, 1, 11]);
        console.log('PERFORMANCE', JSON.stringify(timings));

        const output = path.join(root, 'output/playwright');
        fs.mkdirSync(output, { recursive: true });
        for (const entry of ['openMain', 'openQuickAdd', 'openQuickbar', 'batch']) {
            await setup(page, true);
            await page.evaluate((entry) => { if (entry === 'batch') window.batch = __tmBatchSetCustomField(); else window[entry](); }, entry);
            assert.equal(await search().evaluate((input) => document.activeElement === input), false, 'mobile must not auto-focus search');
            await search().fill('设计');
            await page.setViewportSize({ width: 375, height: 290 });
            await page.waitForTimeout(80);
            const panel = page.locator(entry === 'batch' ? '.tm-custom-field-value-prompt' : entry === 'openQuickbar' ? '.sy-custom-props-floatbar__select' : '.tm-custom-field-inline-editor');
            const bounds = await panel.boundingBox();
            assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 375 && bounds.y + bounds.height <= 290, `${entry}: ${JSON.stringify(bounds)}`);
            await page.screenshot({ path: path.join(output, `custom-field-search-${entry}-mobile.png`) });
            console.log(`PASS ${entry} mobile: explicit focus and constrained viewport`);
        }
        await setup(page);
        await page.evaluate(() => {
            renderFloatBar = () => document.querySelector('#anchor')?.remove();
            openQuickbar();
        });
        await search().fill('api');
        await page.waitForTimeout(40);
        const originalBounds = await page.locator('.sy-custom-props-floatbar__select').boundingBox();
        await choice('dev').click();
        await page.waitForFunction(() => !document.querySelector('#anchor'));
        await page.waitForTimeout(40);
        const refreshedBounds = await page.locator('.sy-custom-props-floatbar__select').boundingBox();
        assert.equal(refreshedBounds.x, originalBounds.x, 'replacing the anchor must not move an open menu');
        assert.equal(refreshedBounds.y, originalBounds.y, 'replacing the anchor must preserve vertical position');
        console.log('PASS menu position survives task chip replacement');
        assert.deepEqual(errors, [], 'no browser errors');
    } finally {
        await browser.close();
    }
})().catch((error) => { console.error(error); process.exitCode = 1; });
