'use strict';

// Exercise the production composer and pickers; only SiYuan storage and writes are mocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('./i18n-vm-fixture');
const { chromium } = require('./i18n-browser-fixture');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, 'src/task-horizon/main', name), 'utf8');
const runtime = read('task-runtime/53b-task-create-and-quick-add-runtime.js');
const stores = read('10-stores-rules-and-cache.js');
const services = read('20-api-and-runtime-services.js');
const inline = read('task-runtime/51-whiteboard-and-link-runtime.js');
const picker = read('task-runtime/53a-list-field-edit-runtime.js');
const detail = read('task-runtime/52-task-detail-runtime.js');
function section(source, from, to) {
    const start = source.indexOf(from), end = source.indexOf(to, start + from.length);
    assert.ok(start >= 0 && end > start, `Missing production section: ${from}`);
    return source.slice(start, end);
}
function fn(source, name) {
    const from = source.indexOf(`    function ${name}(`);
    const end = source.indexOf('\n    }', from);
    assert.ok(from >= 0 && end > from, name);
    return source.slice(from, end + 6);
}

// Use the real local-load statements and field merge rules to verify migration and cross-device saves.
const preferenceHarness = vm.createContext({ Date, Set, Map });
vm.runInContext([
    `const __TM_DOC_GROUP_SETTINGS_FIELD_KEY = 'docGroupSyncState';
     function __tmBuildDocGroupSyncSnapshot() { return {}; }`,
    section(stores, '    const __TM_QUICK_ADD_FIELD_VISIBILITY_KEY =', '    const __TM_QUICK_ADD_RECENT_DOCS_LIMIT ='),
    section(stores, '    const __TM_SETTINGS_FIELD_SYNC_EXCLUDED_KEYS =', '    const __TM_LEGACY_TASK_TITLE_SETTING_KEYS ='),
    fn(stores, '__tmCloneJsonSafe'), fn(stores, '__tmParseUpdatedAtNumber'),
    section(stores, '    function __tmIsSettingsFieldSyncKey(', '    function __tmNormalizeWhiteboardLinkArray('),
    `function loadPreferences() { ${stores.split('\n').filter(line => /this\.data\.quickAdd(?:Mobile)?FieldVisibility = .*Storage\.get/.test(line)).join('\n')} }`,
    `const storedPreferences = new Map([['tm_quick_add_field_visibility', { date: false }]]);
     const Storage = { get: (key, fallback) => storedPreferences.has(key) ? storedPreferences.get(key) : fallback };
     const migrated = { data: { quickAddFieldVisibility: {}, quickAddMobileFieldVisibility: null } };
     loadPreferences.call(migrated);
     const baseline = { quickAddFieldVisibility: {}, quickAddMobileFieldVisibility: {} };
     const desktop = __tmCloneJsonSafe(baseline), mobile = __tmCloneJsonSafe(baseline);
     desktop.quickAddFieldVisibility.date = false;
     mobile.quickAddMobileFieldVisibility.customFields = false;
     const desktopChange = __tmMarkChangedSettingsFields(desktop, baseline, 3000);
     const mobileChange = __tmMarkChangedSettingsFields(mobile, baseline, 4000);
     __tmApplySettingsFieldUpdatesByMap(desktop, mobile, { skipKeys: desktopChange.changedKeys });
     __tmApplySettingsFieldUpdatesByMap(mobile, desktop, { skipKeys: mobileChange.changedKeys });
     globalThis.preferenceResult = { migrated: migrated.data, desktop, mobile };
     const cloudMobile = { data: { quickAddFieldVisibility: {}, quickAddMobileFieldVisibility: { date: true } } };
     loadPreferences.call(cloudMobile);
     globalThis.cloudMobileResult = cloudMobile.data;`,
].join('\n'), preferenceHarness);
const preferenceResult = JSON.parse(JSON.stringify(preferenceHarness.preferenceResult));
assert.deepEqual(preferenceResult.migrated, { quickAddFieldVisibility: { date: false }, quickAddMobileFieldVisibility: { date: false } }, 'legacy preferences initialize both platforms');
for (const client of [preferenceResult.desktop, preferenceResult.mobile]) {
    assert.deepEqual(client.quickAddFieldVisibility, { date: false }, 'sync preserves the desktop edit');
    assert.deepEqual(client.quickAddMobileFieldVisibility, { customFields: false }, 'sync preserves the mobile edit');
}
assert.deepEqual(JSON.parse(JSON.stringify(preferenceHarness.cloudMobileResult.quickAddMobileFieldVisibility)), { date: true }, 'a missing local mobile key retains the cloud mobile preference');
console.log('PASS legacy preference migration and independent desktop/mobile sync');

const production = [
    section(read('30-dialogs-and-ui-foundation.js'), '    function __tmNormalizeLucideIconName(', '    function __tmRenderInlineIcon('),
    section(services, '    const __tmModalStack = [];', '    function __tmGetTodayDateKey('),
    section(read('30-dialogs-and-ui-foundation.js'), '    function __tmNormalizeTaskInputLine(', '    function showConfirm('),
    fn(stores, '__tmBuildCustomFieldOptionRuntime'),
    fn(stores, '__tmNormalizeQuickAddFieldVisibility'),
    section(services, '    function __tmNormalizeCreateTaskCustomFieldValues(', '    function __tmMutationTempTaskExistsForOptimisticApply('),
    section(inline, '    let __tmInlineEditorState = null;', '    function __tmCollectTaskDetailFallbackDeferReasons('),
    section(inline, '    const __TM_QUICK_ADD_DRAFT_STORAGE_KEY =', '    function __tmCaptureTaskDetailSubtaskDraftSnapshot('),
    section(picker, '    function __tmGetDefaultExpandedCustomFieldOptionIds(', '    window.tmOpenCustomFieldSelect ='),
    section(runtime, '    function __tmGetQuickAddVisibleOptionCustomFieldDefs(', '    function __tmApplyOptimisticDocTask('),
    section(runtime, '    window.tmQuickAddClose =', '    window.tmQuickAddOpenForDoc ='),
    section(runtime, '    function __tmBuildHeadingGroupCreateBtnHtml(', '    async function __tmAppendBlockOnce('),
    section(runtime, '    window.tmQuickAddOpenForDoc =', '    window.tmQuickAddOpenForPreset ='),
    section(runtime, '    window.tmQuickAddRenderMeta =', '    window.tmQuickAddOpenDocPicker ='),
    section(runtime, '    window.tmQuickAddSubmit =', '    window.tmAdd ='),
    fn(runtime, '__tmNewTaskBlockId'),
    read('task-runtime/53d-task-template-runtime.js'),
].join('\n');
const productionTimeHub = [
    ...['__tmTaskDetailTimeHubIcon', '__tmTaskTimeHubShortcutDate', '__tmRenderTaskTimeHubQuickDatesHtml',
        '__tmShouldDismissTaskTimeHubEditor', '__tmGetStableTaskTimeHubAnchorRect', '__tmGetTaskTimeHubViewport',
        '__tmPositionTaskTimeHubPopover', '__tmFormatTaskDetailShortDate', '__tmGetTaskTimeHubCalendarFirstDay',
        '__tmGetTaskTimeHubWeekdayLabels', '__tmGetTaskTimeHubMonthGridStart', '__tmNormalizeTaskTimeHubTitle'].map(name => fn(detail, name)),
    section(detail, '    let __tmStandaloneTaskTimeHub = null;', '    function __tmBuildTaskDetailWhiteboardOutlineChipHtml('),
].join('\n');

async function setup(page, theme = 'dark') {
    await page.goto('about:blank');
    await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1"><main aria-label="任务列表"></main>');
    await page.addStyleTag({ content: fs.readFileSync(path.join(root, 'task-horizon.css'), 'utf8') });
    await page.addStyleTag({ content: `:root{--tm-text-color:${theme === 'dark' ? '#e0e0e0' : '#252525'};--tm-secondary-text:${theme === 'dark' ? '#aaa' : '#666'};--tm-card-bg:${theme === 'dark' ? '#202224' : '#fff'};--tm-primary-color:#528aa2;--tm-border-color:${theme === 'dark' ? '#444' : '#ddd'};--tm-hover-bg:${theme === 'dark' ? '#ffffff12' : '#00000008'};--tm-modal-overlay:#0008;--tm-input-bg:var(--tm-card-bg);--b3-theme-background:var(--tm-card-bg);--b3-theme-primary:#528aa2}body{margin:0;font:14px system-ui;background:${theme === 'dark' ? '#141619' : '#f6f6f6'}}.tm-prompt-box{background:var(--tm-card-bg);color:var(--tm-text-color)}.b3-switch{appearance:none;width:28px;height:16px;border-radius:10px;background:#888;position:relative;cursor:pointer}.b3-switch:checked{background:#528aa2}.b3-switch:after{content:'';position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:white}.b3-switch:checked:after{left:14px}.tm-btn-primary{background:#528aa2;color:white}.tm-inline-editor{position:fixed;background:var(--tm-card-bg);border:1px solid var(--tm-border-color)}*{animation:none!important}` });
    await page.evaluate(() => {
        window.state = {};
        window.SettingsStore = { data: { columnOrder: ['cf:dev', 'cf:link'], customStatusOptions: [
            { id: 'todo', name: '待办', color: '#528aa2' }, { id: 'doing', name: '进行中', color: '#ad854f' },
        ], quickAddFieldVisibility: {}, quickAddMobileFieldVisibility: {} }, save: async () => {
            window.savedVisibility = JSON.parse(JSON.stringify({ desktop: SettingsStore.data.quickAddFieldVisibility, mobile: SettingsStore.data.quickAddMobileFieldVisibility }));
        } };
        window.defs = [
            { id: 'dev', name: '开发', type: 'single', options: [{ id: 'feature', name: '功能' }, { id: 'fix', name: '修复' }] },
            { id: 'link', name: '链接', type: 'text' },
            { id: 'out-of-scope', name: '其他文档的字段', type: 'single', options: [{ id: 'x' }] },
            { id: 'disabled', name: '已禁用的字段', enabled: false, options: [{ id: 'x' }] },
            { id: 'not-shown', name: '未显示的列', type: 'single', options: [{ id: 'x' }] },
        ];
        window.writes = []; window.uploads = []; window.notices = []; window.failUpload = false; window.failWrite = false;
        window.__tmEnsureSettingsLoaded = async () => {};
        window.__tmResolveQuickAddInitialLocation = async () => ({ mode: 'doc', docId: 'doc-a' });
        window.__tmResolveQuickAddDocName = () => '任务管理器';
        window.__tmGetDefaultUndoneStatusId = () => 'todo';
        window.__tmResolveQuickAddDefaultCompletionTime = () => '';
        window.__tmNormalizeTaskRepeatRule = () => ({});
        window.__tmNormalizeTaskRepeatState = () => ({});
        window.__tmResolveOptimisticTaskForLocalUse = () => ({ task: {} });
        window.__tmBuildSubtaskInheritedPatch = () => ({});
        window.__tmIsMobileDevice = () => window.innerWidth <= 640;
        window.__tmSanitizeCustomFieldOptionHierarchy = values => values;
        window.__tmGetCustomFieldDefs = () => defs;
        window.__tmIsCustomFieldApplicableToDoc = (field, docId) => field.id !== 'out-of-scope' && (field.id !== 'dev' || docId === 'doc-a');
        window.__tmGetDefaultColumnOrder = () => [];
        window.__tmBuildCustomFieldColumnKey = id => `cf:${id}`;
        window.__tmNormalizeCustomFieldValue = (field, value) => field.type === 'multi' ? (Array.isArray(value) ? value : []) : String(value || '');
        window.__tmFindCustomFieldOption = (field, id) => (field.options || []).find(option => option.id === id);
        window.__tmBuildCustomFieldDisplayHtml = (field, value) => esc(__tmFindCustomFieldOption(field, value)?.name || value || '未设置');
        window.__tmBuildStatusChipStyle = () => '';
        window.__tmResolveUndoneStatusValue = value => value;
        window.__tmGetStatusOptions = values => values;
        window.__tmFormatTaskTimeCompact = value => value;
        window.__tmFormatTaskTime = value => value;
        window.__tmNormalizeDateOnly = value => value;
        window.__tmGetTaskRepeatRule = () => null;
        window.esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        window.escSq = value => String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        window.__tmEscAttr = window.esc;
        window.__tmRenderPriorityJira = () => '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
        window.__tmBuildAttrPayloadFromPatch = patch => Object.fromEntries(Object.entries(patch).map(([key, value]) => [`custom-${key}`, value]));
        window.__tmNormalizeTaskAttachmentPaths = paths => [...new Set(paths)];
        window.__tmResolveDefaultNewTaskInsertOptions = async () => (window.reverseInsert ? { insertAfterId: 'heading' } : {});
        window.savedDrafts = new Map();
        window.__tmSaveQuickAddDraft = (value, extra = {}) => {
            const scope = String(extra.scope || '');
            const entry = { value, remark: extra.remark || '', template: extra.template || null, scope, updatedAt: Date.now() };
            if (!String(value || '').trim() && !entry.remark.trim() && !entry.template) savedDrafts.delete(scope);
            else savedDrafts.set(scope, entry);
        };
        window.__tmGetQuickAddDraft = (scope = '') => savedDrafts.get(String(scope || '')) || null;
        window.__tmClearQuickAddDraft = (expected = null, scope = expected?.scope || '') => {
            const current = savedDrafts.get(String(scope || ''));
            if (!current) return false;
            if (expected && (current.updatedAt !== expected.updatedAt || current.value !== expected.value)) return false;
            return savedDrafts.delete(String(scope || ''));
        };
        window.__tmRequireTaskMutation = name => async (...args) => {
            if (failWrite) throw new Error('任务写入失败');
            const payload = name === 'createTaskInDoc' ? args[0] : args[2].initialPatch;
            writes.push({ name, payload, attrs: __tmBuildAtomicCreateAttrs('task-a', __tmBuildCreateTaskInDocAttrPatchFromPayload(payload)) });
            return `task-${writes.length}`;
        };
        window.__tmUploadTaskAttachmentFiles = async files => {
            uploads.push(files[0].name);
            if (failUpload) throw new Error('上传失败');
            if (window.holdUpload) await new Promise(resolve => { window.releaseUpload = resolve; });
            return [`assets/${files[0].name}`];
        };
        window.__tmOpenPriorityInlinePicker = (anchor, options) => __tmOpenInlineEditor(anchor, ({ editor, close }) => {
            if (options.editorClassName) editor.classList.add(options.editorClassName);
            editor.innerHTML = '<button type="button" class="tm-priority-option-btn">高</button>';
            editor.querySelector('button').onclick = () => { options.onPick('high'); close(); };
        });
        window.tmOpenTaskTimeHub = async (_, anchor, options) => {
            window.dateAnchor = anchor.id;
            options.onApply?.({ startDate: '', completionTime: '2026-10-08', repeatRule: {} });
            state.quickAdd.completionTime = '2026-10-08';
            tmQuickAddRenderMeta();
        };
        for (const name of ['__tmApplyAppearanceThemeVars', '__tmApplyPopupOpenAnimation', 'showSettings']) window[name] = () => {};
        window.hint = message => notices.push(message);
    });
    await page.addScriptTag({ content: production });
    await page.evaluate(() => tmQuickAddOpen());
    assert.deepEqual(await page.evaluate(() => notices), []);
}

const image = { name: 'capture.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5J8AAAAASUVORK5CYII=','base64') };
async function more(page) { await page.getByRole('button', { name: '更多', exact: true }).click(); }
async function settings(page) { await more(page); await page.getByRole('menuitem', { name: '显示字段设置' }).click(); }
async function hoverCenter(page, locator) {
    const bounds = await locator.boundingBox();
    assert.ok(bounds, 'hover target is visible');
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.waitForTimeout(180);
}
async function backgroundRgb(locator) {
    return locator.evaluate(element => {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const context = canvas.getContext('2d');
        context.fillStyle = getComputedStyle(element).backgroundColor;
        context.fillRect(0, 0, 1, 1);
        return Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
    });
}
function assertVisibleBackgroundChange(start, end, label) {
    const distance = Math.hypot(...start.map((channel, index) => channel - end[index]));
    assert.ok(distance >= 20, `${label} hover background should be visibly different (${start} -> ${end})`);
}
async function screenshot(page, name) {
    const directory = path.join(root, 'output/playwright');
    fs.mkdirSync(directory, { recursive: true });
    await page.screenshot({ path: path.join(directory, `quick-add-integrated-${name}.png`) });
}

async function run() {
    const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || undefined,
        ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
    const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await setup(page);
        await page.evaluate(() => { tmQuickAddClose(); SettingsStore.data.pinNewTasksByDefault = true; return tmQuickAddOpen(); });
        await page.waitForFunction(() => state.quickAdd?.initializing === false);
        const pinButton = page.locator('#tmQuickAddPinBtn');
        assert.equal(await pinButton.getAttribute('aria-pressed'), 'true', 'the default pin setting checks the new-task pin option');
        assert.equal(await pinButton.evaluate(button => button.nextElementSibling?.classList.contains('tm-quick-add-doc')), true, 'pin option appears before document selection');
        const documentButton = page.locator('.tm-quick-add-doc');
        const documentBackground = await backgroundRgb(documentButton);
        const documentTransform = await documentButton.evaluate(button => getComputedStyle(button).transform);
        await hoverCenter(page, documentButton);
        assertVisibleBackgroundChange(documentBackground, await backgroundRgb(documentButton), 'toolbar fields');
        assert.equal(await documentButton.evaluate(button => getComputedStyle(button).transform), documentTransform, 'toolbar hover does not scale');
        await page.locator('#tmQuickAddStatusBtn').click();
        const statusOption = page.locator('.tm-quick-add-status-picker .tm-status-option-btn').first();
        const statusBackground = await backgroundRgb(statusOption);
        const statusTransform = await statusOption.evaluate(button => getComputedStyle(button).transform);
        await hoverCenter(page, statusOption);
        assertVisibleBackgroundChange(statusBackground, await backgroundRgb(statusOption), 'status options');
        assert.equal(await statusOption.evaluate(button => getComputedStyle(button).transform), statusTransform, 'status hover does not scale');
        await page.keyboard.press('Escape');
        await page.locator('#tmQuickAddPriorityBtn').click();
        const priorityOption = page.locator('.tm-quick-add-priority-picker .tm-priority-option-btn').first();
        const priorityBackground = await backgroundRgb(priorityOption);
        const priorityTransform = await priorityOption.evaluate(button => getComputedStyle(button).transform);
        await hoverCenter(page, priorityOption);
        assertVisibleBackgroundChange(priorityBackground, await backgroundRgb(priorityOption), 'importance options');
        assert.equal(await priorityOption.evaluate(button => getComputedStyle(button).transform), priorityTransform, 'importance hover does not scale');
        await page.keyboard.press('Escape');
        await page.locator('[data-tm-quick-add-custom-field="dev"]').click();
        const customOption = page.locator('.tm-quick-add-custom-field-picker .tm-custom-field-inline-option').first();
        const customBackground = await backgroundRgb(customOption);
        const customTransform = await customOption.evaluate(button => getComputedStyle(button).transform);
        await hoverCenter(page, customOption);
        assertVisibleBackgroundChange(customBackground, await backgroundRgb(customOption), 'custom field options');
        assert.equal(await customOption.evaluate(button => getComputedStyle(button).transform), customTransform, 'custom field hover does not scale');
        await page.keyboard.press('Escape');
        await page.locator('#tmQuickAddInput').fill('默认置顶任务');
        await page.evaluate(() => tmQuickAddSubmit());
        assert.equal(await page.evaluate(() => writes.at(-1)?.payload.pinned), true, 'default pin state reaches task creation');
        await page.evaluate(() => { SettingsStore.data.pinNewTasksByDefault = true; return tmQuickAddOpen(); });
        await page.waitForFunction(() => state.quickAdd?.initializing === false);
        await page.locator('#tmQuickAddPinBtn').click();
        assert.equal(await page.locator('#tmQuickAddPinBtn').getAttribute('aria-pressed'), 'false', 'the option can override the default');
        await page.locator('#tmQuickAddInput').fill('手动取消置顶任务');
        await page.evaluate(() => tmQuickAddSubmit());
        assert.equal(await page.evaluate(() => writes.at(-1)?.payload.pinned), false, 'an explicit unpinned choice reaches task creation');
        for (const relation of ['subtask', 'sibling']) {
            await page.evaluate(relation => tmQuickAddOpen({ relation, sourceTaskId: 'task-parent', docId: 'doc-a' }), relation);
            await page.waitForFunction(() => state.quickAdd?.initializing === false);
            assert.equal(await page.locator('#tmQuickAddPinBtn').isVisible(), true, `${relation} creation shows the pin control`);
            assert.equal(await page.locator('#tmQuickAddPinBtn').getAttribute('aria-pressed'), 'true', `${relation} creation uses the default pin setting`);
            await page.locator('#tmQuickAddInput').fill(`默认置顶 ${relation}`);
            await page.evaluate(() => tmQuickAddSubmit());
            assert.equal(await page.evaluate(() => writes.at(-1)?.payload.pinned), true, `${relation} creation saves the default pin state`);
            await page.evaluate(relation => tmQuickAddOpen({ relation, sourceTaskId: 'task-parent', docId: 'doc-a' }), relation);
            await page.locator('#tmQuickAddPinBtn').click();
            await page.locator('#tmQuickAddInput').fill(`取消置顶 ${relation}`);
            await page.evaluate(() => tmQuickAddSubmit());
            assert.equal(await page.evaluate(() => writes.at(-1)?.payload.pinned), false, `${relation} creation saves an explicit unpinned choice`);
        }
        await page.evaluate(() => { SettingsStore.data.pinNewTasksByDefault = false; notices.length = 0; writes.length = 0; });
        const touchContext = await browser.newContext({ viewport: { width: 390, height: 760 }, hasTouch: true, isMobile: true });
        const touchPage = await touchContext.newPage();
        const touchErrors = [];
        touchPage.on('pageerror', error => touchErrors.push(error.message));
        try {
            await setup(touchPage);
            await touchPage.waitForFunction(() => state.quickAdd?.initializing === false);
            assert.ok(await touchPage.evaluate(() => matchMedia('(hover: none)').matches || matchMedia('(pointer: coarse)').matches), 'touch context exposes touch pointer capabilities');
            const touchPinButton = touchPage.locator('#tmQuickAddPinBtn');
            assert.equal(await touchPinButton.isVisible(), false, 'pin toolbar button is hidden by default on mobile');
            const touchStatusButton = touchPage.locator('#tmQuickAddStatusBtn');
            const touchStatusBackground = await touchStatusButton.evaluate(button => getComputedStyle(button).backgroundColor);
            const touchStatusBounds = await touchStatusButton.boundingBox();
            await touchPage.touchscreen.tap(touchStatusBounds.x + touchStatusBounds.width / 2, touchStatusBounds.y + touchStatusBounds.height / 2);
            await touchPage.waitForTimeout(180);
            assert.equal(await touchStatusButton.evaluate(button => getComputedStyle(button).backgroundColor), touchStatusBackground, 'touch tap does not leave a toolbar hover background');
            await touchPage.keyboard.press('Escape');
            await touchPage.evaluate(() => { SettingsStore.data.quickAddMobileFieldVisibility.pin = true; tmQuickAddRenderMeta(); });
            assert.equal(await touchPinButton.isVisible(), true, 'mobile field preference can enable the pin button');
            assert.deepEqual(touchErrors, [], 'touch hover handling has no browser errors');
            console.log('PASS touch controls do not retain hover styling and mobile pin visibility defaults off');
        } finally {
            await touchContext.close();
        }
        for (const width of [1100, 390]) {
            await page.setViewportSize({ width, height: 760 });
            await page.evaluate(() => {
                tmQuickAddClose();
                window.__tmResolveQuickAddInitialLocation = async () => { throw new Error('没有默认文档'); };
                document.querySelector('main').innerHTML = `<div class="tm-checklist-group">目标标题${__tmBuildHeadingGroupCreateBtnHtml('doc-a', 'heading-a', '在该标题下新建任务')}</div>`;
            });
            await page.locator('.tm-checklist-group').hover();
            await page.getByRole('button', { name: '在该标题下新建任务', exact: true }).click();
            await page.waitForFunction(() => state.quickAdd?.initializing === false);
            assert.equal(await page.getByRole('dialog', { name: '新建任务', exact: true }).isVisible(), true);
            assert.deepEqual(await page.evaluate(() => [state.quickAdd.docId, state.quickAdd.headingId]), ['doc-a', 'heading-a']);
            assert.equal(await page.locator('#tmQuickAddRemark').isVisible(), true, 'heading capture has the shared remark field');
            assert.equal(await page.getByRole('button', { name: '更多', exact: true }).isVisible(), true, 'heading capture has the shared toolbar');
            await screenshot(page, `heading-${width}`);
        }
        await page.setViewportSize({ width: 1100, height: 760 });
        await page.evaluate(() => {
            tmQuickAddClose();
            document.querySelector('main').innerHTML = `<div class="tm-checklist-group">文档名称${__tmBuildDocGroupQuickAddBtnHtml('doc-a')}</div>`;
        });
        await page.locator('.tm-checklist-group').hover();
        await page.getByRole('button', { name: '新建任务', exact: true }).click();
        await page.waitForFunction(() => state.quickAdd?.initializing === false);
        assert.deepEqual(await page.evaluate(() => [state.quickAdd.docId, state.quickAdd.headingId]), ['doc-a', '']);
        await page.evaluate(() => {
            window.__tmResolveQuickAddInitialLocation = async () => ({ mode: 'doc', docId: 'doc-a' });
            document.querySelector('main').innerHTML = '';
            return tmQuickAddOpen();
        });
        assert.deepEqual(await page.evaluate(() => notices), [], 'heading capture works without a configured default document');
        console.log('PASS desktop/mobile heading actions open the shared composer with the target document and heading');
        assert.deepEqual(await page.evaluate(() => __tmNormalizeQuickAddFieldVisibility({ pin: false, date: false, customFields: false, 'custom:dev': false, unknown: true })),
            { pin: false, date: false, customFields: false }, 'only supported field preferences are stored');
        assert.equal(await page.locator('#tmQuickAddDateLabel').innerText(), '日期', 'desktop retains the empty date label');
        assert.deepEqual(await page.evaluate(() => __tmGetQuickAddVisibleOptionCustomFieldDefs().map(field => field.id)), ['dev', 'link']);
        await page.evaluate(() => { state.quickAdd.docId = 'doc-b'; tmQuickAddRenderMeta(); });
        assert.equal(await page.locator('[data-tm-quick-add-custom-field="dev"]').count(), 0, 'custom columns follow the destination document scope');
        assert.equal(await page.locator('[data-tm-quick-add-custom-field="link"]').count(), 1);
        await settings(page);
        assert.equal(await page.locator('[data-quick-add-visibility="customFields"]').count(), 1, 'one switch regardless of the document group');
        await page.locator('[data-quick-add-visibility="customFields"]').uncheck();
        await page.getByRole('button', { name: '完成', exact: true }).click();
        await more(page);
        assert.equal(await page.getByRole('menuitem', { name: /^设置开发/ }).count(), 0);
        assert.equal(await page.getByRole('menuitem', { name: /^设置链接/ }).count(), 1, 'collapsed custom columns still respect document scope');
        await page.keyboard.press('Escape');
        await page.evaluate(() => { state.quickAdd.docId = 'doc-a'; SettingsStore.data.quickAddFieldVisibility = {}; tmQuickAddRenderMeta(); });
        await page.locator('#tmQuickAddInput').fill('保留草稿');
        await page.locator('#tmQuickAddRemark').fill('保留备注');
        await settings(page);
        await screenshot(page, 'desktop-settings');
        const pinSettingRow = page.locator('.tm-quick-add-field-setting').first();
        const pinSettingBackground = await backgroundRgb(pinSettingRow);
        const pinSettingTransform = await pinSettingRow.locator('.tm-lucide-emoji').evaluate(icon => getComputedStyle(icon).transform);
        await hoverCenter(page, pinSettingRow);
        assertVisibleBackgroundChange(pinSettingBackground, await backgroundRgb(pinSettingRow), 'field-setting rows');
        assert.equal(await pinSettingRow.locator('.tm-lucide-emoji').evaluate(icon => getComputedStyle(icon).transform), pinSettingTransform, 'field-setting hover does not scale icons');
        assert.equal(await page.locator('[data-quick-add-visibility]').count(), 6, 'five base fields and one aggregate custom-column switch');
        for (const id of ['date', 'priority', 'status', 'customFields', 'pin']) await page.locator(`[data-quick-add-visibility="${id}"]`).uncheck();
        await page.getByRole('button', { name: '完成', exact: true }).click();
        assert.equal(await page.locator('#tmQuickAddPriorityBtn').isVisible(), false);
        assert.equal(await page.locator('#tmQuickAddPinBtn').isVisible(), false, 'field settings hide the pin button');
        await more(page);
        assert.equal(await page.locator('[data-quick-add-field="pin"]').count(), 1, 'hidden pin remains available in the more menu');
        await page.locator('[data-quick-add-field="pin"]').click();
        assert.equal(await page.evaluate(() => state.quickAdd.pinned), true, 'more menu can toggle a hidden pin field');
        await more(page);
        await page.getByRole('menuitem', { name: /^设置开发/ }).click();
        await page.getByText('修复', { exact: true }).click();
        await more(page);
        assert.equal(await page.getByRole('menuitem', { name: '设置开发：修复' }).count(), 1);
        await screenshot(page, 'desktop-more');
        await page.getByRole('menuitem', { name: /^设置状态/ }).click();
        await page.getByRole('button', { name: '进行中', exact: true }).click();
        await more(page);
        await page.getByRole('menuitem', { name: /^设置重要性/ }).click();
        await page.getByRole('button', { name: '高', exact: true }).click();
        await more(page);
        await page.getByRole('menuitem', { name: /^设置日期/ }).click();
        assert.equal(await page.evaluate(() => dateAnchor), 'tmQuickAddMoreBtn', 'collapsed date uses a mounted anchor');
        await more(page);
        await page.getByRole('menuitem', { name: /^设置链接/ }).click();
        await page.getByRole('textbox', { name: '链接', exact: true }).fill('https://example.com');
        await page.getByRole('button', { name: '完成', exact: true }).click();
        await settings(page);
        for (const id of ['date', 'priority', 'status', 'customFields']) await page.locator(`[data-quick-add-visibility="${id}"]`).check();
        await page.getByRole('button', { name: '完成', exact: true }).click();
        assert.equal((await page.locator('[data-tm-quick-add-custom-field="dev"]').innerText()).replace(/\s+/g, ' '), '开发 修复');
        assert.equal(await page.locator('#tmQuickAddInput').inputValue(), '保留草稿');
        assert.equal(await page.locator('#tmQuickAddRemark').inputValue(), '保留备注');
        assert.equal(await page.evaluate(() => savedVisibility.desktop.customFields), true, 'desktop aggregate preference is saved');
        assert.deepEqual(await page.evaluate(() => SettingsStore.data.columnOrder), ['cf:dev', 'cf:link'], 'composer settings preserve the existing column configuration');
        assert.ok(await page.evaluate(() => new Set([...document.querySelectorAll('.tm-quick-add-tools button')]
            .filter(button => !button.hidden).map(button => Math.round(button.getBoundingClientRect().y))).size > 1), 'desktop toolbar wraps when fields exceed the row width');
        await screenshot(page, 'desktop');
        console.log('PASS collapsed fields remain editable; values, drafts and column preferences survive toggles');

        const desktopPreferences = await page.evaluate(() => ({ ...SettingsStore.data.quickAddFieldVisibility }));
        await page.setViewportSize({ width: 390, height: 568 });
        await page.evaluate(() => { state.quickAdd.completionTime = ''; tmQuickAddRenderMeta(); });
        assert.equal(await page.locator('.tm-quick-add-date').isVisible(), true);
        assert.equal(await page.locator('#tmQuickAddDateLabel').isVisible(), false, 'mobile empty date button only shows the calendar icon');
        assert.ok((await page.locator('.tm-quick-add-date').boundingBox()).width <= 45, 'mobile empty date button occupies one touch target');
        await screenshot(page, 'mobile-date-icon');
        await page.locator('.tm-quick-add-date').click();
        assert.equal(await page.locator('#tmQuickAddDateLabel').innerText(), '2026-10-08');
        assert.equal(await page.locator('#tmQuickAddDateLabel').isVisible(), true, 'selected date remains visible on mobile');
        await settings(page);
        assert.ok((await page.locator('.tm-quick-add-settings-description').innerText()).includes('仅设置移动端'));
        for (const id of ['date', 'customFields']) await page.locator(`[data-quick-add-visibility="${id}"]`).uncheck();
        await page.getByRole('button', { name: '完成', exact: true }).click();
        assert.deepEqual(await page.evaluate(() => savedVisibility.desktop), desktopPreferences, 'mobile saves preserve desktop preferences');
        await page.evaluate(() => { tmQuickAddClose(); return tmQuickAddOpen(); });
        assert.equal(await page.locator('.tm-quick-add-date-wrap').isVisible(), false, 'mobile preference survives reopening');
        await page.setViewportSize({ width: 1100, height: 760 });
        await page.evaluate(() => tmQuickAddRenderMeta());
        assert.equal(await page.locator('.tm-quick-add-date-wrap').isVisible(), true, 'desktop date remains enabled');
        assert.equal(await page.locator('[data-tm-quick-add-custom-field="dev"]').isVisible(), true, 'desktop custom columns remain enabled');
        const mobilePreferences = await page.evaluate(() => ({ ...SettingsStore.data.quickAddMobileFieldVisibility }));
        await settings(page);
        assert.ok((await page.locator('.tm-quick-add-settings-description').innerText()).includes('仅设置桌面端'));
        await page.locator('[data-quick-add-visibility="status"]').uncheck();
        assert.deepEqual(await page.evaluate(() => savedVisibility.mobile), mobilePreferences, 'desktop saves preserve mobile preferences');
        await page.locator('[data-quick-add-visibility="status"]').check();
        await page.getByRole('button', { name: '完成', exact: true }).click();
        await page.evaluate(() => { state.quickAdd.completionTime = '2026-10-08'; tmQuickAddRenderMeta(); });
        console.log('PASS desktop/mobile preferences save independently and mobile date icon expands after selection');

        for (const width of [390, 320]) {
            await page.setViewportSize({ width, height: 568 });
            await settings(page);
            for (const id of ['doc', 'date', 'priority', 'status', 'customFields']) await page.locator(`[data-quick-add-visibility="${id}"]`).check();
            await page.getByRole('button', { name: '完成', exact: true }).click();
            const wrapped = await page.evaluate(() => {
                const tools = document.querySelector('.tm-quick-add-tools');
                const rect = tools.getBoundingClientRect();
                const buttons = [...tools.querySelectorAll('button')].filter(button => !button.hidden).map(button => button.getBoundingClientRect().toJSON());
                return { wrap: getComputedStyle(tools).flexWrap, width: tools.clientWidth, scrollWidth: tools.scrollWidth,
                    rows: [...new Set(buttons.map(button => Math.round(button.y)))].length,
                    clipped: buttons.some(button => button.left < rect.left - 1 || button.right > rect.right + 1) };
            });
            assert.equal(wrapped.wrap, 'wrap');
            assert.ok(wrapped.rows > 1, `toolbar wraps at ${width}px`);
            assert.ok(wrapped.scrollWidth <= wrapped.width + 1 && !wrapped.clipped, `all field buttons fit at ${width}px: ${JSON.stringify(wrapped)}`);
            await screenshot(page, `mobile-wrapped-${width}`);
            await settings(page);
            for (const id of ['doc', 'date', 'priority', 'status', 'customFields']) await page.locator(`[data-quick-add-visibility="${id}"]`).uncheck();
            await page.getByRole('button', { name: '完成', exact: true }).click();
            await more(page);
            const geometry = await page.evaluate(() => {
                const menu = document.querySelector('#tmQuickAddMoreMenu').getBoundingClientRect();
                return { menu: menu.toJSON(), width: document.documentElement.scrollWidth,
                    more: document.querySelector('#tmQuickAddMoreBtn').getBoundingClientRect().height,
                    add: document.querySelector('#tmQuickAddSubmitBtn').getBoundingClientRect().height };
            });
            assert.ok(geometry.menu.left >= 0 && geometry.menu.right <= width && geometry.menu.bottom <= 568);
            assert.equal(geometry.width, width);
            assert.ok(geometry.more >= 44 && geometry.add >= 44);
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('.tm-quick-add-box').isVisible(), true, 'Escape only dismisses more');
        }
        await page.setViewportSize({ width: 320, height: 568 });
        await page.evaluate(() => {
            const viewport = new EventTarget();
            Object.assign(viewport, { width: 320, height: 348, offsetTop: 0, offsetLeft: 0 });
            Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
            __tmBindQuickAddViewport(state.quickAddModal);
        }); // keyboard shrinks the visual viewport without resizing the layout viewport
        await more(page);
        const [fileChooser] = await Promise.all([
            page.waitForEvent('filechooser'), page.getByRole('menuitem', { name: '添加图片' }).click(),
        ]);
        await fileChooser.setFiles([image, { ...image, name: 'second.png' }]);
        await page.evaluate(() => {
            const file = state.quickAdd.images[0].file;
            for (const type of ['paste', 'drop']) {
                const data = new DataTransfer();
                data.items.add(new File([file], `${type}.png`, { type: file.type }));
                const event = type === 'paste' ? new ClipboardEvent(type, { clipboardData: data, bubbles: true, cancelable: true })
                    : new DragEvent(type, { dataTransfer: data, bubbles: true, cancelable: true });
                document.querySelector('#tmQuickAddInput').dispatchEvent(event);
            }
        });
        assert.equal(await page.locator('.tm-quick-add-image').count(), 4, 'picker, clipboard and drag accept images');
        assert.equal(await page.locator('#tmQuickAddInput').inputValue(), '保留草稿');
        await page.getByRole('button', { name: '移除 paste.png', exact: true }).click();
        await page.getByRole('button', { name: '移除 drop.png', exact: true }).click();
        await more(page);
        await page.waitForFunction(() => {
            const menu = document.querySelector('#tmQuickAddMoreMenu');
            return menu && parseFloat(menu.style.maxHeight) <= 348;
        });
        const rect = await page.locator('#tmQuickAddMoreMenu').boundingBox();
        assert.ok(rect.y >= 0 && rect.y + rect.height <= 349, `more remains above the keyboard with all fields collapsed: ${JSON.stringify(rect)}`);
        await screenshot(page, 'mobile-more');
        await page.getByRole('menuitem', { name: '显示字段设置' }).click();
        await page.locator('[data-quick-add-visibility="customFields"]').check();
        await screenshot(page, 'mobile-settings');
        await page.getByRole('button', { name: '完成', exact: true }).click();
        await page.getByRole('button', { name: '预览 capture.png', exact: true }).click();
        assert.equal(await page.locator('dialog[open]').count(), 1);
        await page.locator('dialog img').evaluate(img => { img.style.width = '260px'; img.style.height = '260px'; });
        const preview = await page.locator('dialog[open]').boundingBox();
        assert.ok(preview.y >= 0 && preview.y + preview.height <= 348, 'image preview fits the keyboard viewport');
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: '预览 capture.png', exact: true }).click();
        await page.evaluate(() => tmQuickAddOpen());
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.tm-quick-add-modal--composer').count(), 0, 'reopening cleans up the previous image preview modal stack');
        await page.evaluate(() => tmQuickAddOpen());
        await page.getByRole('button', { name: '移除 second.png', exact: true }).click();
        await screenshot(page, 'mobile-images');
        assert.equal(await page.locator('.tm-quick-add-image').count(), 1);
        await page.evaluate(() => { tmQuickAddClose(); return tmQuickAddOpen(); });
        assert.equal(await page.locator('.tm-quick-add-image').count(), 1, 'closing and reopening preserves image draft');
        assert.equal(await page.locator('#tmQuickAddDateLabel').isVisible(), false, 'visibility survives reopening');
        console.log('PASS 390/320px, keyboard viewport, all collapsed, image preview/removal and reopening');

        await page.locator('#tmQuickAddInput').fill('第一条\n第二条');
        await page.evaluate(() => { window.failUpload = true; });
        await page.locator('#tmQuickAddSubmitBtn').click();
        await page.waitForFunction(() => notices.some(message => message.includes('上传失败')));
        assert.equal(await page.evaluate(() => writes.length), 0, 'upload failure cannot create an attachment-less task');
        assert.equal(await page.locator('#tmQuickAddInput').inputValue(), '第一条\n第二条');
        assert.equal(await page.locator('.tm-quick-add-image').count(), 1);
        await page.evaluate(() => { window.failUpload = false; window.reverseInsert = true; state.quickAdd.customFieldValues.link = 'https://example.com'; });
        await page.locator('#tmQuickAddSubmitBtn').click();
        await page.waitForFunction(() => writes.length === 2);
        const writes = await page.evaluate(() => window.writes);
        assert.equal(writes[0].payload.content, '第二条');
        assert.equal(writes[0].payload.attachments, undefined);
        assert.deepEqual(writes[1].payload.attachments, ['assets/capture.png']);
        assert.deepEqual(writes[1].attrs['custom-attachments'], ['assets/capture.png'], 'attachment joins atomic creation attributes');
        assert.equal(writes[1].attrs['custom-customFieldValues'].link, 'https://example.com', 'text custom column joins atomic attributes');
        await page.evaluate(() => tmQuickAddOpen());
        assert.equal(await page.locator('.tm-quick-add-image').count(), 0, 'successful creation clears submitted images');
        console.log('PASS upload failure/retry and reversed batch: images only join the first task atomically');

        await page.locator('#tmQuickAddInput').fill('取消上传');
        await page.locator('#tmQuickAddImageInput').setInputFiles(image);
        await page.evaluate(() => { window.holdUpload = true; window.pendingSubmit = tmQuickAddSubmit(); });
        await page.waitForFunction(() => typeof releaseUpload === 'function');
        await page.evaluate(() => { tmQuickAddClose(); releaseUpload(); return pendingSubmit; });
        assert.equal(await page.evaluate(() => writes.length), 2, 'closing during upload cancels task creation');
        await page.evaluate(() => { window.holdUpload = false; return tmQuickAddOpen(); });
        assert.equal(await page.locator('.tm-quick-add-image').count(), 1);
        console.log('PASS close during upload cancels submission and retains the image');
        const uploadCount = await page.evaluate(() => uploads.length);
        await page.evaluate(() => { window.failWrite = true; return tmQuickAddSubmit(); });
        await page.evaluate(() => tmQuickAddOpen());
        assert.equal(await page.locator('.tm-quick-add-image').count(), 1, 'failed task creation retains uploaded image draft');
        assert.equal(await page.evaluate(() => uploads.length), uploadCount, 'retry reuses staged assets');
        await page.evaluate(() => { window.failWrite = false; return tmQuickAddSubmit(); });
        assert.equal(await page.evaluate(() => writes.length), 3);
        await page.evaluate(() => tmQuickAddOpen());
        assert.equal(await page.locator('.tm-quick-add-image').count(), 0);
        console.log('PASS task write failure retains images; retry reuses uploaded assets');
        await page.setViewportSize({ width: 1100, height: 760 });
        await page.evaluate(() => tmQuickAddClose());
        await setup(page, 'light');
        await settings(page);
        await screenshot(page, 'light-settings');
        assert.equal(await page.locator('.tm-quick-add-field-setting').count(), 6);
        await page.getByRole('button', { name: '完成', exact: true }).click();
        await page.evaluate(() => {
            window.API = { getTaskTitlePresentation: (value, fallback) => ({ text: value || fallback }) };
            window.__tmNormalizeDateOnly = value => value instanceof Date
                ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}` : String(value || '').slice(0, 10);
            window.__tmGetTaskRepeatRule = () => ({ enabled: false, type: 'none' });
            window.__tmAnimatePopupIn = () => {};
            window.__tmAnimatePopupOutAndRemove = element => element.remove();
        });
        await page.addStyleTag({ content: ':root{--popover:var(--tm-card-bg);--foreground:var(--tm-text-color);--border:var(--tm-border-color);--radius:8px}' });
        await page.addScriptTag({ content: productionTimeHub });
        await page.locator('#tmQuickAddInput').fill('日期关闭后继续输入');
        await page.locator('#tmQuickAddRemark').fill('备注保留光标');
        for (const width of [390, 320]) {
            await page.setViewportSize({ width, height: 640 });
            await page.evaluate(() => {
                const viewport = new EventTarget();
                Object.assign(viewport, { width: innerWidth, height: 348, offsetTop: 0, offsetLeft: 0 });
                Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
                __tmBindQuickAddViewport(state.quickAddModal);
                tmQuickAddRenderMeta();
            });
            for (const inputId of ['tmQuickAddInput', 'tmQuickAddRemark']) {
                await page.locator(`#${inputId}`).focus();
                await page.locator(`#${inputId}`).evaluate(input => {
                    input.setSelectionRange(2, 2);
                    window.taskInputBlurCount = 0;
                    input.addEventListener('blur', () => window.taskInputBlurCount++ , { once: true });
                });
                await page.locator('.tm-quick-add-date').click();
                await page.waitForSelector('.tm-task-time-hub__external-close');
                const geometry = await page.evaluate(() => {
                    const button = document.querySelector('.tm-task-time-hub__external-close');
                    const close = button.getBoundingClientRect(), panel = document.querySelector('.tm-task-time-hub-popover').getBoundingClientRect();
                    return { close: close.toJSON(), panel: panel.toJSON(), focused: document.activeElement.id,
                        hit: button.contains(document.elementFromPoint(close.x + close.width / 2, close.y + close.height / 2)) };
                });
                assert.equal(geometry.focused, inputId, 'opening the real date popover preserves the active task input');
                assert.ok(geometry.close.width === 28 && geometry.close.height === 28 && geometry.hit, 'external close appearance and hit target are both 28px');
                assert.ok(Math.abs(geometry.panel.top - geometry.close.bottom - 4) < 1, 'external close stays 4px above the panel');
                assert.ok(geometry.close.bottom <= geometry.panel.top && geometry.close.top >= 0
                    && geometry.close.right <= width && geometry.panel.bottom <= 349, `external close fits above the calendar and keyboard: ${JSON.stringify(geometry)}`);
                await page.getByRole('button', { name: '明天', exact: true }).click();
                assert.equal(await page.locator('.tm-task-time-hub__external-close').count(), 1, 'the external close survives date panel redraws');
                await screenshot(page, `mobile-date-close-${width}`);
                await page.getByRole('button', { name: '关闭日期设置', exact: true }).click();
                assert.equal(await page.locator('.tm-task-time-hub-popover').count(), 0, 'only the date popover closes');
                assert.equal(await page.locator('.tm-task-time-hub__external-close').count(), 0, 'the external close button is cleaned up');
                assert.equal(await page.locator('.tm-quick-add-box').isVisible(), true, 'task composer stays open');
                assert.deepEqual(await page.evaluate(() => ({ id: document.activeElement.id, caret: document.activeElement.selectionStart })),
                    { id: inputId, caret: 2 }, 'closing preserves focus and the caret without blurring the input');
                assert.equal(await page.evaluate(() => taskInputBlurCount), 0, 'opening and closing never blur the input');
                await page.keyboard.type('继续');
                assert.ok((await page.locator(`#${inputId}`).inputValue()).includes('继续'));
            }
            await page.evaluate(() => document.activeElement.blur());
            await page.locator('.tm-quick-add-date').click();
            assert.equal(await page.getByRole('button', { name: '关闭日期设置', exact: true }).isVisible(), true, 'the external close is available even without an active keyboard');
            await page.getByRole('button', { name: '关闭日期设置', exact: true }).click();
        }
        await page.setViewportSize({ width: 1100, height: 760 });
        await page.evaluate(() => tmQuickAddRenderMeta());
        await page.locator('.tm-quick-add-date').click();
        assert.equal(await page.locator('.tm-task-time-hub__external-close').count(), 0, 'the external close is mobile only');
        await page.keyboard.press('Escape');
        console.log('PASS real date popover external close at 390/320px preserves task/remark focus, caret and keyboard viewport');
        assert.deepEqual(errors, [], 'no browser errors');
        console.log('PASS light theme and browser error check');
    } finally { await browser.close(); }
}
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { setup, run };
