'use strict';

// Exercise production picker, document creation, location prompt and detail add handler.
// The fixture replaces only host APIs, task storage and attachment previews.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, 'src/task-horizon/main', file), 'utf8');
const attachments = read('task-runtime/51-whiteboard-and-link-runtime.js');
const detail = read('task-runtime/52-task-detail-runtime.js');
const store = read('10-stores-rules-and-cache.js');
const api = read('20-api-and-runtime-services.js');
const dialogs = read('30-dialogs-and-ui-foundation.js');
const settings = read('settings/60-settings-screen.js');
const settingsActions = read('settings/70-doc-group-and-settings-actions.js');
const apiMethods = api.slice(api.indexOf('        async createDocWithMd('), api.indexOf('        async createDailyNote('));
const fn = (source, name) => {
    const start = source.search(new RegExp(`    (?:async )?function ${name}\\(`));
    const end = source.indexOf('\n    }', start);
    assert.ok(start >= 0 && end > start, name);
    return source.slice(start, end + 6);
};
const stack = api.slice(api.indexOf('    const __tmModalStack = [];'), api.indexOf('    function __tmGetTodayDateKey('));
const addStart = detail.indexOf("                if (target.hasAttribute('data-tm-detail-attachment-add')) {", detail.indexOf('let attachmentActionPending = false;'));
const addEnd = detail.indexOf('                const index = __tmResolveTaskDetailAttachmentActionIndex', addStart);
assert.ok(addStart >= 0 && addEnd > addStart);
const production = [stack,
    dialogs.slice(dialogs.indexOf('    function __tmNormalizeLucideIconName('), dialogs.indexOf('    function __tmRenderInlineIcon(')),
    ...['__tmNormalizeTaskAttachmentBlockId', '__tmBuildTaskAttachmentBlockToken', '__tmNormalizeTaskAttachmentPath', '__tmNormalizeTaskAttachmentPaths'].map(name => fn(store, name)),
    ...['__tmUpdateTaskAttachmentsField', '__tmCreateTaskAttachmentDocument', '__tmOpenTaskAttachmentPicker'].map(name => fn(attachments, name)),
    ...['__tmNormalizeSettingsDocPickerText', '__tmSettingsDocPickerMatches', '__tmNormalizeSettingsDocPickerPath', '__tmBuildSettingsDocPickerTree', '__tmRenderDocPickerTree'].map(name => fn(settings, name)),
    ...['__tmFilterDocPicker', '__tmOpenDocumentLocationPicker'].map(name => fn(settingsActions, name)),
].join('\n');
const fixtureScript = `
    const __TM_TASK_ATTACHMENT_BLOCK_ID_PATTERN = /^[0-9]{14}-[A-Za-z0-9]+$/;
    const __TM_TASK_ATTACHMENT_BLOCK_PREFIX = 'block:';
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const escSq = value => String(value);
    const __tmEscAttr = esc;
    const __tmApplyPopupOpenAnimation = () => {};
    const __tmNormalizeTaskAttachmentLocalPath = () => '';
    const meta = new Map();
    const __tmPrimeTaskAttachmentBlockMeta = item => meta.set(item.id, item);
    const __tmGetQueuedTaskAttachmentPatchPaths = () => null;
    const __tmGetCurrentTaskAttachmentPatchBase = () => task.attachments.slice();
    const __tmReconcileQueuedTaskAttachmentPaths = (_id, paths) => paths;
    const __tmNewTaskBlockId = () => '20261025080000-doc0001';
    const __tmGetDocRawName = () => '';
    const __tmGetDocDisplayName = doc => doc.name;
    const __tmGetDocAliasValue = doc => doc.alias || '';
    const __tmBuildTaskAttachmentEntries = paths => paths.map(path => ({ path, name: meta.get(path.slice(6))?.content || path, displayPath: path }));
    const __tmBuildTaskAttachmentThumbHtml = () => '';
    const __tmBuildTaskAttachmentClipboardFiles = () => [];
    const __tmParseTaskAttachmentAssetPathsFromText = text => text.startsWith('assets/') ? [text] : [];
    const __tmParseTaskAttachmentLocalPathsFromText = () => [];
    const __tmParseTaskAttachmentBlockIdsFromText = () => [];
    const __tmTaskAttachmentDataTransferHasFiles = () => false;
    const __tmResolveTaskAttachmentTextItems = async text => [text];
    const __tmOpenTaskAttachmentBlockRef = async id => opened.push(id);
    const hint = text => hints.push(text);
    window.task = { id:'20261025080000-task001', root_id:'20261025080000-parent1', content:'项目复盘会议记录', attachments:['assets/说明.pdf'] };
    window.docs = [
        { id:task.root_id, name:'项目计划', path:'/工作/项目计划', notebook:'box-1' },
        { id:'20261025080000-parent2', name:'项目资料', path:'/归档/项目资料', notebook:'box-2' },
    ];
    window.creates = []; window.patches = []; window.opened = []; window.hints = [];
    window.mode = { createFail:false, saveFail:false, holdSave:false };
    const API = {
        ${apiMethods}
        getDocMetaById: async id => docs.find(doc => doc.id === id),
        getAllDocuments: async () => docs,
        lsNotebooks: async () => [{id:'box-1',name:'工作笔记本'}, {id:'box-2',name:'归档笔记本'}],
        getTaskTitlePresentation: () => ({ text:task.content }),
        searchAssets: async () => [{ path:'assets/设计稿.pdf', name:'设计稿.pdf' }],
        searchDocs: async () => [{ path:'block:' + docs[1].id, name:docs[1].name }],
        call: async (endpoint, payload) => {
            if (endpoint === '/api/filetree/getDocPaths') return {code:0, data:{documents:[{id:payload.ids[0]}], missingIDs:[]}};
            if (endpoint !== '/api/filetree/createDocByParent' || 'path' in payload || 'hPath' in payload) {
                throw new Error('legacy document paths are unsupported; use structured document addressing');
            }
            if (!payload.id || payload.title?.format !== 'plain' || typeof payload.title?.text !== 'string') throw new Error('invalid structured document request');
            creates.push(payload);
            if (mode.createFail) return {code:-1, msg:'测试创建失败'};
            return {code:0, data:{id:payload.id, document:{id:payload.id}}};
        },
    };
    window.__tmRequireTaskMutation = () => async (id, patch, options) => {
        patches.push({id,patch,options});
        if (mode.holdSave) await new Promise(resolve => { window.releaseSave = resolve; });
        if (mode.saveFail) throw new Error('测试保存失败');
        task.attachments = patch.attachments.slice();
        return {id};
    };
    const getBoundTask = () => task;
    const getCurrentAttachmentPaths = () => task.attachments.slice();
    const syncAttachmentSectionPaths = (_task, paths) => {
        task.attachments = paths.slice();
        document.querySelector('#attachments').textContent = paths.map(path => meta.get(path.slice(6))?.content || path).join('、');
    };
    ${production}
    let attachmentActionPending = false;
    document.querySelector('#add').addEventListener('click', async ev => {
        if (attachmentActionPending) return;
        const target = ev.currentTarget;
        const currentPaths = getCurrentAttachmentPaths(task);
        ${detail.slice(addStart, addEnd)}
    });
`;

async function run() {
    const output = path.join(root, 'output/playwright');
    fs.mkdirSync(output, { recursive: true });
    const fixture = path.join(output, 'attachment-document-create-fixture.html');
    fs.writeFileSync(fixture, `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>新建附件文档测试</title>
        <link rel="stylesheet" href="../../task-horizon.css"><style>
        :root{--tm-bg-color:#f7f8fa;--tm-card-bg:#f7f8fa;--tm-text-color:#242834;--tm-secondary-text:#687080;--tm-primary-color:#527f99;--tm-border-color:#cfd3da;--tm-input-bg:#fcfcfd;--tm-input-border:#cfd3da;--tm-modal-overlay:rgba(24,28,36,.35);--tm-shadow:0 12px 40px #20253020;--b3-theme-error:#ba3e46}
        body{margin:24px;font:14px system-ui;background:#edf0f4;color:var(--tm-text-color)}main{max-width:720px;margin:auto}h1{font-size:20px}#attachments{margin:20px 0;color:var(--tm-secondary-text)}
        html[data-theme=dark]{--tm-bg-color:#252932;--tm-card-bg:#252932;--tm-text-color:#e1e4e9;--tm-secondary-text:#aeb4bf;--tm-border-color:#464b55;--tm-input-bg:#20242b;--tm-input-border:#505763;--b3-theme-error:#ec8a91}html[data-theme=dark] body{background:#191d24}
        </style><main><h1>项目复盘会议记录</h1><p>独立测试夹具</p><div id="attachments">说明.pdf</div><button id="add" class="tm-prompt-btn tm-prompt-btn-primary" data-tm-detail-attachment-add>添加附件</button></main>
        <script>${fixtureScript.replace(/<\/script/gi, '<\\/script')}</script></html>`);
    const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        page.setDefaultTimeout(5000);
        const errors = [];
        page.on('pageerror', e => { errors.push(e.message); console.error(e.message); });
        const load = async () => page.goto(pathToFileURL(fixture).href);
        const createView = async () => {
            await page.getByRole('button', { name: '添加附件', exact: true }).click();
            await page.getByRole('button', { name: '新建文档', exact: true }).click();
            await page.waitForFunction(() => !document.querySelector('[data-tm-attachment-create-location]').disabled);
        };
        const status = page.locator('[data-tm-attachment-create-status]');
        const assertFits = async selector => {
            const geometry = await page.locator(selector).evaluate(el => {
                const rect = el.getBoundingClientRect();
                return { left:rect.left, right:rect.right, top:rect.top, bottom:rect.bottom, width:innerWidth, height:innerHeight, overflow:el.scrollWidth > el.clientWidth + 1 };
            });
            assert.ok(geometry.left >= 0 && geometry.right <= geometry.width && geometry.top >= 0 && geometry.bottom <= geometry.height && !geometry.overflow, JSON.stringify(geometry));
        };

        await load(); await createView();
        assert.equal(await page.getByLabel('文档标题', { exact: true }).inputValue(), '项目复盘会议记录');
        assert.match(await page.locator('[data-tm-attachment-create-location]').textContent(), /工作\/项目计划/);
        await page.getByLabel('文档标题', { exact: true }).fill('');
        assert.equal(await page.getByRole('button', { name: '创建并关联', exact: true }).isDisabled(), true);
        await page.getByLabel('文档标题', { exact: true }).fill('方案/错误路径');
        await page.getByRole('button', { name: '创建并关联', exact: true }).click();
        await status.filter({ hasText: '不能包含斜杠' }).waitFor();
        assert.equal(await page.evaluate(() => creates.length), 0);
        await page.getByLabel('文档标题', { exact: true }).fill('复盘纪要');
        await page.locator('[data-tm-attachment-create-location]').click();
        await page.locator('.tm-document-location-picker [data-tm-doc-picker-tree][aria-busy="false"]').waitFor();
        assert.equal(await page.locator('.tm-document-location-picker').count(), 1);
        assert.equal(await page.locator('.tm-task-attachment-picker-modal').count(), 1);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.tm-task-attachment-picker-modal').count(), 1);
        await page.locator('[data-tm-attachment-create-location]').click();
        await page.locator('[data-tm-doc-picker-search-input]').fill('归档');
        await page.getByRole('radio', { name:'项目资料', exact:true }).check();
        await page.getByRole('button', { name:'选择位置', exact:true }).click();
        assert.match(await page.locator('[data-tm-attachment-create-location]').textContent(), /归档\/项目资料/);
        await assertFits('.tm-task-attachment-picker-box');
        await page.screenshot({ path: path.join(output, 'attachment-document-create-desktop.png') });
        await page.getByRole('button', { name: '创建并关联', exact: true }).click();
        await status.filter({ hasText: '已创建并关联到当前任务' }).waitFor();
        assert.deepEqual(await page.evaluate(() => creates), [{ notebook:'box-2', parentID:'20261025080000-parent2', id:'20261025080000-doc0001', title:{format:'plain',text:'复盘纪要'}, markdown:'' }]);
        assert.match(await page.locator('#attachments').textContent(), /复盘纪要/);
        await page.getByRole('button', { name: '打开文档', exact: true }).click();
        assert.deepEqual(await page.evaluate(() => opened), ['20261025080000-doc0001']);
        await page.getByRole('button', { name: '完成', exact: true }).click();
        assert.equal(await page.evaluate(() => patches.length), 1, 'closing the picker does not save the new attachment twice');

        await load(); await createView();
        await page.evaluate(() => { mode.saveFail = true; });
        await page.getByRole('button', { name: '创建并关联', exact: true }).click();
        await status.filter({ hasText: '文档已创建，关联失败' }).waitFor();
        assert.equal(await page.getByLabel('文档标题', { exact: true }).isDisabled(), true);
        assert.equal(await page.getByRole('button', { name: '打开文档', exact: true }).isVisible(), true);
        await page.evaluate(() => { mode.saveFail = false; task.attachments.push('assets/同时添加.pdf'); });
        await page.getByRole('button', { name: '重试关联', exact: true }).click();
        await status.filter({ hasText: '已创建并关联到当前任务' }).waitFor();
        assert.equal(await page.evaluate(() => creates.length), 1);
        assert.deepEqual(await page.evaluate(() => task.attachments), ['assets/说明.pdf', 'assets/同时添加.pdf', 'block:20261025080000-doc0001']);

        await load(); await createView();
        await page.evaluate(() => { mode.createFail = true; });
        await page.getByRole('button', { name: '创建并关联', exact: true }).click();
        await status.filter({ hasText: '测试创建失败' }).waitFor();
        assert.equal(await page.evaluate(() => patches.length), 0);
        assert.equal(await page.getByLabel('文档标题', { exact: true }).isEditable(), true);
        await page.keyboard.press('Escape');
        assert.equal(await page.getByRole('button', { name: '新建文档', exact: true }).isVisible(), true);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.tm-task-attachment-picker-modal').count(), 0);

        await load(); await createView();
        await page.evaluate(() => { mode.holdSave = true; document.querySelector('form').requestSubmit(); document.querySelector('form').requestSubmit(); });
        await page.waitForFunction(() => typeof releaseSave === 'function');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.tm-task-attachment-picker-modal').count(), 1);
        assert.equal(await page.evaluate(() => creates.length), 1);
        assert.equal(await page.evaluate(() => patches.length), 1);
        await page.evaluate(() => releaseSave());
        await status.filter({ hasText: '已创建并关联到当前任务' }).waitFor();
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.tm-task-attachment-picker-modal').count(), 0);

        await load();
        await page.getByRole('button', { name: '添加附件', exact: true }).click();
        await page.locator('.tm-task-attachment-picker-input').fill('设计稿');
        await page.locator('[data-tm-attachment-picker-path="assets/设计稿.pdf"]').click();
        await page.getByRole('button', { name: '添加 1 个', exact: true }).click();
        await page.waitForFunction(() => task.attachments.includes('assets/设计稿.pdf'));

        await load();
        await page.getByRole('button', { name:'添加附件', exact:true }).click();
        await page.getByRole('tab', { name:'思源文档', exact:true }).click();
        await page.getByRole('searchbox', { name:'搜索文档', exact:true }).fill('项目资料');
        await page.locator('[data-tm-attachment-picker-path="block:20261025080000-parent2"]').click();
        await page.getByRole('button', { name:'添加 1 个', exact:true }).click();
        await page.waitForFunction(() => task.attachments.includes('block:20261025080000-parent2'));
        assert.equal(await page.evaluate(() => creates.length), 0, 'selecting an existing document never creates a new one');

        for (const [width, height, theme] of [[320,568,'light'], [390,844,'dark'], [768,1024,'light']]) {
            await page.setViewportSize({ width, height });
            await load();
            await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
            await page.getByRole('button', { name: '添加附件', exact: true }).click();
            for (const selector of ['[data-tm-attachment-picker-upload] > span:last-child', '[data-tm-attachment-picker-create] > span:last-child']) {
                const lines = await page.locator(selector).evaluate(el => {
                    const range = document.createRange(); range.selectNodeContents(el);
                    return new Set(Array.from(range.getClientRects(), rect => Math.round(rect.top))).size;
                });
                assert.equal(lines, 1, 'action labels must remain on a single line');
            }
            await assertFits('.tm-task-attachment-picker-box');
            await page.screenshot({ path:path.join(output, `attachment-picker-${width}-${theme}.png`) });
            await page.getByRole('tab', { name:'思源文档', exact:true }).click();
            assert.equal(await page.getByRole('tab', { name:'思源文档', exact:true }).getAttribute('aria-selected'), 'true');
            assert.equal(await page.getByRole('button', { name:'上传本地', exact:true }).isVisible(), false);
            await page.keyboard.press('ArrowLeft');
            assert.equal(await page.getByRole('tab', { name:'文件附件', exact:true }).getAttribute('aria-selected'), 'true');
            await page.getByRole('button', { name:'新建文档', exact:true }).click();
            await page.waitForFunction(() => !document.querySelector('[data-tm-attachment-create-location]').disabled);
            await assertFits('.tm-task-attachment-picker-box');
            await page.screenshot({ path:path.join(output, `attachment-document-create-${width}-${theme}.png`) });
            await page.locator('[data-tm-attachment-create-location]').click();
            await page.locator('.tm-document-location-picker [data-tm-doc-picker-tree][aria-busy="false"]').waitFor();
            await assertFits('.tm-document-location-picker .tm-doc-group-manager__picker-dialog-box');
            await page.screenshot({ path:path.join(output, `attachment-document-location-${width}-${theme}.png`) });
            await page.keyboard.press('Escape');
            await page.evaluate(() => { mode.saveFail = true; });
            await page.getByRole('button', { name: '创建并关联', exact: true }).click();
            await status.filter({ hasText: '文档已创建，关联失败' }).waitFor();
            await assertFits('.tm-task-attachment-picker-box');
            await page.screenshot({ path:path.join(output, `attachment-document-create-retry-${width}-${theme}.png`) });
        }
        assert.deepEqual(errors, []);
        console.log('Attachment document browser tests passed: success, retry, cancellation, busy, existing picker, 320/390/768/1280px.');
        console.log(`Fixture: ${fixture}`);
    } finally { await browser.close(); }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
