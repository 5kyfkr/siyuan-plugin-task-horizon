'use strict';

// Production dialog in Chromium, with SiYuan services and persistence stubbed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, 'src/task-horizon/main', file), 'utf8');
function section(source, start, end) {
    const from = source.indexOf(start), to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from, start);
    return source.slice(from, to);
}
const stores = read('10-stores-rules-and-cache.js');
const code = [
    section(stores, '    function __tmNormalizeCustomFieldIdList(', '    function __tmBuildRuntimeCustomFieldLoadPlan('),
    section(stores, '    function __tmNormalizeCustomFieldOption(', '    const __tmCustomFieldDefsRuntimeCache'),
    section(read('20-api-and-runtime-services.js'), '    function __tmNormalizeDocAliasValue(', '    function __tmRefreshTaskDocDisplayNames('),
    section(read('settings/62-settings-columns-and-rules.js'), '    function __tmEnsureCustomFieldScopeDialogStyles(', '    window.tmOpenTaskMetaAttrMigrationDialog ='),
].join('\n');
const docs = [{ id: 'doc-a', name: '甲项目', alias: 'Alpha' }, { id: 'doc-b', name: '乙项目', alias: 'Beta' }];
const options = [
    { id: 'a', name: 'A' }, { id: 'a1', name: 'A1', parentId: 'a' },
    { id: 'a2', name: 'A2', parentId: 'a' }, { id: 'a21', name: 'A21', parentId: 'a2' },
    { id: 'a22', name: 'A22', parentId: 'a2' }, { id: 'b', name: 'B' },
    { id: 'b1', name: 'B1', parentId: 'b' }, { id: 'b2', name: 'B2', parentId: 'b' },
    { id: 'b21', name: 'B21', parentId: 'b2' }, { id: 'c', name: 'C', archived: true },
];
const scope = { docIds: ['doc-b', 'deleted-doc'], docGroupIds: ['group-a'], docTabGroupIds: ['tab-a'] };
const sel = (name) => `[data-tm-custom-field-${name}]`;

async function setup(page, selected = false, mobile = false) {
    await page.goto('about:blank');
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    await page.setContent('<style>:root{--tm-bg-color:#fafafa;--tm-text-color:#333;--tm-secondary-text:#666;--tm-border-color:#ddd;--tm-card-bg:#fafafa;--tm-primary-color:#3575ac;--tm-input-bg:#fff;--tm-input-border:#ccc;--tm-hover-bg:#eee}body{font:14px system-ui}</style>');
    await page.addStyleTag({ path: path.join(root, 'task-horizon.css') });
    await page.evaluate(({ selected, mobile, options, scope }) => {
        window.state = { allDocuments: [], taskTree: [] };
        window.loads = 0; window.moves = 0; window.saved = []; window.messages = [];
        window.SettingsStore = {
            data: { docDisplayNameMode: 'name', customFieldDefs: [{ id: 'tags', name: '标签', attrKey: 'tags', type: 'multi', options, scope: selected ? scope : null }], docGroups: [{ id: 'group-a', name: '文档组' }] },
            normalizeColumns: () => {}, save: async () => { saved.push(structuredClone(SettingsStore.data.customFieldDefs)); },
        };
        window.esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
        window.__tmGetCustomFieldDefs = () => SettingsStore.data.customFieldDefs;
        window.__tmRemoveElementsById = (id) => document.getElementById(id)?.remove();
        window.__tmNormalizeCustomFieldId = window.__tmNormalizeCustomFieldAttrName = (value, fallback) => String(value || fallback || '').trim();
        window.__tmNormalizeHexColor = (value, fallback) => value || fallback;
        window.__tmGetCustomFieldPresetColor = () => '#3575ac';
        window.__tmGetDocTabCustomGroups = () => [{ id: 'tab-a', name: '页签组' }];
        window.__tmIsMobileDevice = () => mobile;
        window.__tmRenderLucideIcon = () => '<span aria-hidden="true">·</span>';
        window.__tmRefreshCustomFieldScopeMembership = async () => {};
        window.__tmRefreshSettingsProjectionView = window.render = () => {};
        window.hint = (message) => messages.push(message);
        window.__tmEnsureAllDocumentsLoaded = () => {
            loads++;
            return new Promise((resolve, reject) => {
                window.completeDocuments = (result) => { state.allDocuments = result; resolve(result); };
                window.rejectDocuments = reject;
            });
        };
    }, { selected, mobile, options, scope });
    await page.addScriptTag({ content: code + '\nconst originalMove = __tmMoveCustomFieldOptionSubtree; __tmMoveCustomFieldOptionSubtree = (...args) => { moves++; return originalMove(...args); };' });
}

(async () => {
    const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
        await setup(page);
        await page.evaluate(() => tmOpenCustomFieldDialog('', { manager: true }));
        assert.equal(await page.locator(sel('name')).isVisible(), true);
        assert.equal(await page.evaluate(() => loads), 0, 'global scope must not load documents');
        assert.equal(await page.evaluate(() => moves), 0, 'render must not simulate moves');
        await page.locator(sel('scope-mode')).selectOption('selected');
        await page.waitForFunction(() => loads === 1);
        await page.locator(sel('name')).fill('正在编辑');
        await page.locator(sel('scope-doc-search')).fill('甲');
        await page.evaluate(() => { window.searchNode = document.activeElement; });
        await page.evaluate((value) => completeDocuments(value), docs);
        await page.waitForFunction(() => document.querySelector('[data-tm-custom-field-scope-doc-status]').hidden);
        assert.equal(await page.locator(sel('name')).inputValue(), '正在编辑');
        assert.equal(await page.evaluate(() => searchNode === document.activeElement), true);
        await page.locator(sel('scope-docs')).check();
        await page.locator(sel('scope-doc-search')).fill('乙');
        await page.locator(sel('scope-docs')).check();
        await page.locator(sel('save')).click();
        await page.waitForFunction(() => saved.length === 1);
        assert.deepEqual(await page.evaluate(() => saved[0][1].scope.docIds), ['doc-a', 'doc-b']);
        console.log('PASS immediate open, deferred load, input/focus preservation and scope save');

        await setup(page, true);
        await page.evaluate(() => tmOpenCustomFieldDialog('tags'));
        await page.waitForFunction(() => loads === 1);
        assert.equal((await page.locator('.tm-custom-field-scope-selection').textContent()).includes('已失效'), false);
        await page.evaluate((value) => completeDocuments(value), docs);
        await page.waitForFunction(() => document.querySelector('[data-tm-custom-field-scope-doc-status]').hidden);
        assert.ok((await page.locator('.tm-custom-field-scope-selection').textContent()).includes('乙项目'));
        assert.ok((await page.locator('.tm-custom-field-scope-selection').textContent()).includes('deleted-doc（已失效）'));
        await page.locator(sel('save')).click();
        await page.waitForFunction(() => saved.length === 1);
        assert.deepEqual(await page.evaluate(() => saved[0][0].scope), { docIds: ['deleted-doc', 'doc-b'], docGroupIds: ['group-a'], docTabGroupIds: ['tab-a'] });
        console.log('PASS document/group/tab and invalid selections survive hydration');

        await setup(page, true);
        await page.evaluate(() => tmOpenCustomFieldDialog('tags'));
        await page.waitForFunction(() => loads === 1);
        await page.evaluate(() => rejectDocuments(new Error('Simulated failure')));
        await page.waitForFunction(() => document.querySelector('[data-tm-custom-field-scope-doc-status] button'));
        await page.locator('[data-tm-custom-field-scope-doc-status] button').click();
        await page.waitForFunction(() => loads === 2);
        await page.locator(sel('close')).click();
        await page.evaluate((value) => completeDocuments(value), docs);
        assert.equal(await page.locator('#tm-custom-field-dialog-backdrop').count(), 0);
        console.log('PASS failed loads can retry; closed dialogs ignore completion');

        await setup(page);
        await page.evaluate(() => {
            tmOpenCustomFieldDialog('tags');
            const mode = document.querySelector('[data-tm-custom-field-scope-mode]');
            mode.value = 'selected'; mode.dispatchEvent(new Event('change'));
            document.querySelector('[data-tm-custom-field-close]').click();
        });
        await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 20)));
        assert.equal(await page.evaluate(() => loads), 0, 'close must cancel deferred work');

        await setup(page);
        await page.evaluate(() => tmOpenCustomFieldDialog('tags'));
        const parity = await page.evaluate(() => {
            const runtime = __tmBuildCustomFieldOptionRuntime(SettingsStore.data.customFieldDefs[0]);
            return runtime.options.map((option) => {
                const siblings = runtime.childrenByParentId.get(option.parentId || '');
                const index = siblings.findIndex((item) => item.id === option.id);
                const previous = siblings[index - 1];
                const expected = !!previous && __tmMoveCustomFieldOptionSubtree(runtime.options, { sourceId: option.id, targetParentId: previous.id, targetSiblingIndex: runtime.childrenByParentId.get(previous.id).length }).ok;
                const button = [...document.querySelectorAll('[data-tm-custom-field-option-action="indent"]')].find((el) => el.dataset.optionId === option.id);
                return { id: option.id, expected, actual: !button.disabled };
            });
        });
        assert.ok(parity.every(({ expected, actual }) => expected === actual), JSON.stringify(parity));
        await page.locator('[data-tm-custom-field-option-action="indent"][data-option-id="c"]').click();
        assert.equal(await page.locator('.tm-custom-field-option-row[data-option-id="c"]').getAttribute('data-depth'), '1');
        await page.locator('[data-tm-custom-field-option-action="promote"][data-option-id="c"]').click();
        assert.equal(await page.locator('.tm-custom-field-option-row[data-option-id="c"]').getAttribute('data-depth'), '0');
        console.log('PASS indent eligibility matches moves at all depths; indent/promote work');

        const timings = await page.evaluate(() => {
            const documents = Array.from({ length: 5000 }, (_, i) => ({ id: 'doc-' + i, name: '文档 ' + String((i * 7919) % 5000).padStart(6, '0'), alias: '' }));
            state.allDocuments = documents;
            state.taskTree = [{ id: 'doc-0', name: '任务树名称', alias: '任务树别名' }];
            const expectedNames = documents.slice(0, 20).map((doc) => [doc.id, __tmGetDocDisplayName(doc, doc.name)]);
            SettingsStore.data.docDisplayNameMode = 'alias';
            const expectedAliases = documents.slice(0, 20).map((doc) => [doc.id, __tmGetDocDisplayName(doc, doc.name)]);
            documents.find = state.taskTree.find = () => { throw new Error('Unexpected linear metadata lookup'); };
            let start = performance.now();
            const data = __tmBuildCustomFieldScopeDocumentData(documents, state.taskTree, 'name');
            const documentPreparationMs = performance.now() - start;
            const aliases = __tmBuildCustomFieldScopeDocumentData(documents, state.taskTree, 'alias');
            if (!expectedNames.every(([id, label]) => data.labels.get(id) === label)) throw new Error('Name fallback changed');
            if (!expectedAliases.every(([id, label]) => aliases.labels.get(id) === label)) throw new Error('Alias fallback changed');
            const options = Array.from({ length: 2000 }, (_, i) => ({ id: 'option-' + i, name: '选项 ' + i, parentId: '' }));
            const runtime = __tmBuildCustomFieldOptionRuntime(options);
            start = performance.now();
            const metrics = __tmBuildCustomFieldOptionRenderMetrics(runtime);
            for (const option of runtime.options) {
                const index = metrics.siblingIndexById.get(option.id);
                const canIndent = index > 0 && runtime.depthById.get(option.id) + 1 + metrics.subtreeHeightById.get(option.id) < 3;
                if (canIndent !== (index > 0)) throw new Error('Flat option eligibility changed');
            }
            return { documents: documents.length, documentPreparationMs, options: options.length, optionButtonChecksMs: performance.now() - start };
        });
        console.log('PASS indexed names, alias fallback and performance', JSON.stringify(timings));

        await setup(page, true, true);
        await page.evaluate(() => tmOpenCustomFieldDialog('tags'));
        await page.waitForFunction(() => loads === 1);
        await page.locator(sel('name')).fill('手机编辑');
        await page.evaluate((value) => completeDocuments(value), docs);
        await page.waitForFunction(() => document.querySelector('[data-tm-custom-field-scope-doc-status]').hidden);
        assert.equal(await page.locator(sel('name')).inputValue(), '手机编辑');
        const output = path.join(root, 'output/playwright');
        fs.mkdirSync(output, { recursive: true });
        await page.screenshot({ path: path.join(output, 'custom-field-dialog-lazy-mobile.png') });
        console.log('PASS mobile dialog hydration');
        assert.deepEqual(errors, [], 'no browser errors');
    } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
