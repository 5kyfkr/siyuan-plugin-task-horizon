'use strict';
// Run with PLAYWRIGHT_MODULE pointing to playwright or playwright-core when not installed locally.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const unindexedSettingsControls = () => [...document.querySelectorAll('.tm-settings-content input:not([type="hidden"]),.tm-settings-content select,.tm-settings-content textarea,.tm-settings-content button[onclick],.tm-settings-content button[data-tm-call],.tm-settings-content button[data-tm-action],.tm-settings-content a[href]')]
    .filter(el => !el.closest('.tm-settings-subtabs,.tm-settings-choice-group,dialog,.tm-doc-group-manager__picker') && el.dataset.tmCall !== 'tmOpenSettingsV3Subpage')
    .filter(el => !el.closest('[data-tm-settings-search-key]') || el.closest('[data-tm-settings-search-key]').matches('.tm-settings-panel'))
    .map(el => el.getAttribute('aria-label') || el.id || el.getAttribute('placeholder') || el.getAttribute('onchange') || el.textContent.trim());
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('src/task-horizon/manifest.main.json'));
let runtime = manifest.scripts.map((file) => read(`src/task-horizon/${file}`)).join('\n');
const end = runtime.lastIndexOf("    if (document.readyState === 'loading') {");
assert.ok(end > 0);
runtime = runtime.slice(0, end) + `
    window.__settingsTest = { state, SettingsStore, RuleManager, render, pages: TM_SETTINGS_V2_PAGES,
        searchEntries: __tmGetSettingsSearchEntries, searchResults: __tmGetSettingsSearchResults, searchStaticText: __tmSettingsSearchStaticText,
        searchIndexReady: () => !__tmSettingsSearchIndexBuilding && !__tmSettingsSearchIndexBuildTimer,
        queue: __tmQueueSettingsSave, run: __tmRunSettingsSave, jobs: __tmSettingsSaveJobs,
        pageFor: __tmSettingsV2PageFor, policy: __tmAgentPolicyView,
        flush: __tmFlushSettingsAutosave, failures: __tmSettingsSaveErrors, applyTheme: __tmApplyAppearanceThemeVars,
        persistPolicy: __tmPersistPolicySetting, policySnapshot: () => __tmSettingsDomainSnapshot('policy') };
    const cached = localStorage.getItem('settings-test');
    if (cached) Object.assign(SettingsStore.data, JSON.parse(cached));
    SettingsStore.loaded = true;
    SettingsStore.save = async () => {
        if (window.__saveDelay) await new Promise(resolve => setTimeout(resolve, window.__saveDelay));
        if (window.__failSave) throw new Error('Simulated disk error');
        localStorage.setItem('settings-test', JSON.stringify(SettingsStore.data));
    };
    SettingsStore.flushSave = SettingsStore.save;
    state.notebooks = [{ id: 'notebook-test', name: '测试笔记本' }];
    state.notebooksFetchedAt = Date.now();
    state.allDocuments = [{ id: '20260924000000-abcdefg', name: '测试项目', notebook: 'notebook-test', path: '/test.sy' }];
    state.filterRules = SettingsStore.data.filterRules || [];
    __tmAgentPolicyApplyLoaded(__tmAgentPolicyNormalize(null));
    window.__hasPro = true;
    window.tmLicenseHasFeature = () => window.__hasPro;
    const clone = value => JSON.parse(JSON.stringify(value));
    const service = window.__settingsService = { policy: clone(__tmAgentPolicyView.policy), events: [], calls: [], patches: new Map(), delay: 0, active: 0, maxActive: 0 };
    window.__taskHorizonHostBridge = { kernel: { rpc: { call: {
        taskHorizonGetPolicy: async () => ({ ok: true, data: clone(service.policy) }),
        taskHorizonPreviewPolicyPatch: async request => {
            service.calls.push(['preview', request.expectedRevision]);
            if (request.expectedRevision !== service.policy.revision) return { ok: false, error: { code: 'STALE_REVISION', message: 'Stale policy' } };
            const token = String(service.calls.length);
            service.patches.set(token, clone(request.patch));
            return { ok: true, data: { expectedRevision: request.expectedRevision, previewToken: token } };
        },
        taskHorizonApplyPolicyPatch: async request => {
            service.active++;
            service.maxActive = Math.max(service.maxActive, service.active);
            await new Promise(resolve => setTimeout(resolve, service.delay));
            service.active--;
            if (request.expectedRevision !== service.policy.revision) return { ok: false, error: { code: 'STALE_REVISION', message: 'Stale policy' } };
            const patch = service.patches.get(request.previewToken);
            for (const key of ['global', 'durationDefaults']) service.policy[key] = clone(patch[key]);
            for (const key of ['documentOverrides', 'groupOverrides']) {
                for (const [id, value] of Object.entries(patch[key])) {
                    if (value === null) delete service.policy[key][id];
                    else service.policy[key][id] = clone(value);
                }
            }
            service.policy.revision++;
            service.calls.push(['apply', service.policy.revision]);
            return { ok: true, data: { policy: clone(service.policy) } };
        },
    } } } };
    globalThis['siyuan-plugin-task-horizon'] ||= {};
    globalThis['siyuan-plugin-task-horizon'].scheduledEvents = {
        list: () => clone(service.events),
        save: async event => {
            if (service.eventFailure) throw new Error('Scheduled write failed');
            const index = service.events.findIndex(item => item.id === event.id);
            if (index < 0) service.events.push(clone(event)); else service.events[index] = clone(event);
        },
        remove: async id => { service.events = service.events.filter(item => item.id !== id); },
    };
    window.showSettings();
})();`;
const prelude = `window.siyuan={config:{system:{kernelVersion:'3.7.3',container:'desktop'},appearance:{mode:0}},languages:{}};
window.__tmSuppressStorageWrites=true;
window.fetch=async()=>({ok:true,status:200,json:async()=>({code:0,data:[]}),text:async()=>'',blob:async()=>new Blob()});`;
const nativeStyles = `body{margin:0;font:14px/1.5 system-ui;background:#eef0f3} :root{--b3-theme-background:#fff;--b3-theme-surface:#f5f6f8;--b3-theme-on-background:#252932;--b3-theme-on-surface:#647084;--b3-theme-primary:#3877c9;--b3-border-color:#e1e5eb;--b3-theme-error:#bb3545} [data-theme-mode=dark]{--b3-theme-background:#1e1e1e;--b3-theme-surface:#262626;--b3-theme-on-background:#e5e5e5;--b3-theme-on-surface:#a4aab5;--b3-border-color:#444} .b3-switch{appearance:none;width:32px;height:18px;flex-shrink:0;background:#b2b8c2;border-radius:12px;position:relative}.b3-switch:checked{background:var(--b3-switch-checked-background,var(--b3-theme-primary))}.b3-switch:after{content:'';position:absolute;width:14px;height:14px;top:2px;left:2px;border-radius:50%;background:white}.b3-switch:checked:after{left:16px;background:var(--b3-switch-checked,#fff)}.b3-select,.b3-text-field{border:1px solid var(--b3-border-color);padding:6px 10px;border-radius:6px;background:var(--b3-theme-background);color:inherit}.fn__flex-center{display:flex;align-items:center}`;
// The host injects these styles after the workspace CSS; previews reuse the real quickbar classes.
const quickbarStyles = read('quickbar.js').match(/style\.id = 'sy-custom-props-floatbar-style';\s*style\.textContent = `([\s\S]*?)`;/)[1];
const server = http.createServer((req, res) => {
    if (req.url === '/runtime.js') { res.setHeader('content-type', 'text/javascript'); res.end(prelude + runtime); return; }
    if (req.url === '/calendar.js') { res.setHeader('content-type', 'text/javascript'); res.end(read('calendar-view.js')); return; }
    if (req.url.endsWith('.css')) { res.setHeader('content-type', 'text/css'); res.end(req.url === '/basecoat.css' ? read('src/basecoat/basecoat.css') : req.url === '/calendar.css' ? read('calendar-view.css') : read('task-horizon.css')); return; }
    res.setHeader('content-type', 'text/html; charset=utf-8');
    const calendarScript = req.url.includes('lazy-calendar')
        ? `<script>window.__taskHorizonEnsureCalendarAssets = () => window.__calendarLoading ||= new Promise(resolve => { window.__loadCalendarForTest = () => { const script = document.createElement('script'); script.src = '/calendar.js'; script.onload = resolve; document.head.append(script); }; });</script>`
        : '<script src="/calendar.js"></script>';
    res.end(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${nativeStyles}</style><link rel="stylesheet" href="/task.css"><link rel="stylesheet" href="/basecoat.css"><link rel="stylesheet" href="/calendar.css"><style>${quickbarStyles}</style></head><body>${calendarScript}<script src="/runtime.js"></script></body></html>`);
});
async function checkSettingsLayouts(page, mobile = false) {
    if (mobile) await page.evaluate(() => {
        window.__tmRuntimeHost = { getInfo: () => ({ runtimeMobileClient: true, hostUsesMobileUI: true, isMobileDevice: true, isDockHost: false }) };
    });
    const pages = await page.evaluate(() => __settingsTest.pages.map(([id]) => id));
    for (const viewport of [{ width: 320, height: 740 }, { width: 360, height: 844 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 844, height: 390 }, { width: 1440, height: 1000 }]) {
        await page.setViewportSize(viewport);
        for (const id of pages) {
            await page.evaluate(id => tmOpenSettingsV2Page(id), id);
            const subpages = await page.locator('.tm-settings-v3-sections button').evaluateAll(nodes => nodes.map(node => node.dataset.settingsSubpage));
            for (const sub of subpages.length ? subpages : ['']) {
                if (sub) await page.evaluate(sub => tmOpenSettingsV3Subpage(sub), sub);
                if (sub === 'd-sync') await page.locator('.tm-settings-device-details').evaluate(el => { el.open = true; });
                const layout = await page.locator('.tm-settings-content').evaluate(el => {
                    const bounds = el.getBoundingClientRect();
                    const controls = [...el.querySelectorAll('.tm-setting-field-control,.tm-settings-chip-stack,.tm-settings-chip,.tm-field-preview,.tm-settings-choice-group,.tm-column-row,.tm-status-option-row,input:not([type="hidden"]),select,textarea')];
                    const outside = controls.filter(node => {
                        const rect = node.getBoundingClientRect();
                        return rect.width && rect.height && (rect.right > bounds.right + 1 || rect.left < bounds.left - 1);
                    }).map(node => [node.className || node.tagName, Math.round(node.getBoundingClientRect().width), (node.textContent || '').trim().slice(0, 40)]);
                    const previews = [...el.querySelectorAll('.tm-field-preview__stage')].filter(node => node.getClientRects().length && node.scrollWidth > node.clientWidth + 1).map(node => node.parentElement.dataset.tmFieldPreview);
                    const cramped = [...el.querySelectorAll('.tm-setting-switch-copy')].filter(node => node.getClientRects().length && node.getBoundingClientRect().width < 140).length;
                    return { overflow: el.scrollWidth - el.clientWidth, outside, previews, cramped };
                });
                const context = `${mobile ? 'mobile host' : 'browser'} ${id}/${sub || 'default'} at ${viewport.width}x${viewport.height}`;
                if (layout.overflow > 2 || layout.outside.length || layout.previews.length) {
                    await page.screenshot({ path: path.join(root, 'output/playwright/settings-v2-overflow.png') });
                }
                assert.ok(layout.overflow <= 2, `${context} overflows by ${layout.overflow}px`);
                assert.deepEqual(layout.outside, [], `${context} controls must fit the content`);
                assert.deepEqual(layout.previews, [], `${context} previews must fit without clipped fields`);
                assert.equal(layout.cramped, 0, `${context} switch descriptions must stay readable`);
                if (mobile && viewport.width === 390 && sub === 'v-float') {
                    const status = page.locator('.tm-settings-chip__input[onchange="updateQuickbarVisibleItem(\'custom-status\', this.checked)"]');
                    const checked = await status.isChecked();
                    await status.setChecked(!checked);
                    await page.waitForFunction(expected => JSON.parse(localStorage.getItem('settings-test')).quickbarVisibleItems.includes('custom-status') === expected, !checked);
                    assert.equal(await page.locator('[data-tm-field-preview="quickbar"] [data-attr="custom-status"]').count(), checked ? 0 : 1, 'mobile selection updates the preview');
                    await status.setChecked(checked);
                    await page.waitForFunction(expected => JSON.parse(localStorage.getItem('settings-test')).quickbarVisibleItems.includes('custom-status') === expected, checked);
                }
                if (viewport.width === 390 && ['v-float', 'v-fields', 'v-tl'].includes(sub)) {
                    await page.screenshot({ path: path.join(root, `output/playwright/settings-mobile-${sub}.png`) });
                    if (sub === 'v-float') await page.locator('.tm-setting-field-row').filter({ hasText: '悬浮条显示图标' }).screenshot({ path: path.join(root, 'output/playwright/settings-mobile-quickbar-fields.png') });
                }
            }
        }
        console.log(`Settings layout passed (${mobile ? 'mobile host' : 'browser'}) at ${viewport.width}x${viewport.height}`);
    }
    if (mobile) await page.evaluate(() => { delete window.__tmRuntimeHost; });
}
async function checkBoundStatusDeletion(page) {
    const original = await page.evaluate(() => {
        const data = __settingsTest.SettingsStore.data;
        const original = JSON.parse(JSON.stringify({ customStatusOptions: data.customStatusOptions,
            checkboxDoneStatusId: data.checkboxDoneStatusId, checkboxUndoneStatusId: data.checkboxUndoneStatusId }));
        Object.assign(data, {
            customStatusOptions: [
                { id: 'todo', name: '待办', marker: ' ' },
                { id: 'finish', name: '已完成', marker: 'X' },
                { id: 'backlog', name: '待处理', marker: ' ' },
            ],
            checkboxDoneStatusId: 'finish', checkboxUndoneStatusId: 'todo',
        });
        tmOpenSettingsV2Page('docs', 't-status');
        return original;
    });
    try {
        for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 1000 });
            const doneDelete = page.locator('[onclick="deleteStatusOption(1)"]');
            const todoDelete = page.locator('[onclick="deleteStatusOption(0)"]');
            const backlogDelete = page.locator('[onclick="deleteStatusOption(2)"]');
            assert.equal(await doneDelete.isDisabled(), true);
            assert.match(await doneDelete.getAttribute('title'), /勾选完成时状态/);
            assert.equal(await todoDelete.isDisabled(), true);
            assert.match(await todoDelete.getAttribute('title'), /未完成状态默认状态/);
            assert.equal(await backlogDelete.isEnabled(), true);
            const binding = page.locator('[onchange="updateCheckboxStatusBinding(\'undone\', this.value)"]');
            await binding.selectOption('backlog');
            await page.waitForFunction(() => !document.querySelector('[onclick="deleteStatusOption(0)"]').disabled
                && document.querySelector('[onclick="deleteStatusOption(2)"]').disabled);
            assert.equal(await doneDelete.isDisabled(), true);
            await page.screenshot({ path: path.join(root, `output/playwright/settings-bound-status-${width}.png`) });
            await binding.selectOption('todo');
            await page.waitForFunction(() => document.querySelector('[onclick="deleteStatusOption(0)"]').disabled);
        }
    } finally {
        await page.evaluate(async (original) => {
            Object.assign(__settingsTest.SettingsStore.data, original);
            await __settingsTest.SettingsStore.save();
            showSettings();
        }, original);
        await page.setViewportSize({ width: 1440, height: 1000 });
    }
}

(async () => {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.stack));
    page.on('console', (msg) => { if (msg.type() === 'error') console.error(msg.text().slice(0, 400)); });
    try {
        fs.mkdirSync(path.join(root, 'output/playwright'), { recursive: true });
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        await page.waitForTimeout(300);
        if (errors.length) throw new Error(errors.join('\n'));
        await page.locator('.tm-settings-v2').waitFor();
        if (process.env.SETTINGS_LAYOUT_ONLY) {
            await checkSettingsLayouts(page);
            await checkSettingsLayouts(page, true);
            assert.deepEqual(errors, [], 'layout checks must not cause runtime errors');
            return;
        }
        await checkBoundStatusDeletion(page);
        await page.evaluate(() => tmOpenSettingsV2Page('docs', 't-new'));
        const inboxVisibility = page.locator('[onchange="updateHideInboxFromAllTab(this.checked)"]');
        assert.equal(await inboxVisibility.isChecked(), false, 'inbox remains visible in All by default');
        await inboxVisibility.check();
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('settings-test')).hideInboxFromAllTab === true);
        await page.reload();
        await page.locator('.tm-settings-v2').waitFor();
        await page.evaluate(() => tmOpenSettingsV2Page('docs', 't-new'));
        assert.equal(await inboxVisibility.isChecked(), true, 'inbox visibility survives settings reload');
        await inboxVisibility.uncheck();
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('settings-test')).hideInboxFromAllTab === false);
        await page.evaluate(() => tmOpenSettingsV2Page('docs', 't-done'));
        const completedChoices = page.locator('[onchange="updateCompletedTasksGroupBy(this.value)"] + .tm-settings-choice-group');
        assert.equal(await completedChoices.getByRole('radio').count(), 2, 'completed grouping uses exactly two segmented choices');
        assert.equal(await completedChoices.locator('[aria-checked="true"]').getAttribute('data-choice-value'), 'date', 'completed grouping defaults to date');
        assert.ok(await page.locator('[onchange="updateCompletedTasksGroupBy(this.value)"]').isHidden(), 'completed grouping does not display a dropdown');
        await completedChoices.getByRole('radio', { name: '按文档与标题', exact: true }).click();
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('settings-test')).completedTasksGroupBy === 'title');
        await page.reload();
        await page.locator('.tm-settings-v2').waitFor();
        await page.evaluate(() => tmOpenSettingsV2Page('docs', 't-done'));
        assert.equal(await completedChoices.locator('[aria-checked="true"]').getAttribute('data-choice-value'), 'title', 'completed grouping survives reload');
        await completedChoices.getByRole('radio', { name: '按文档与标题', exact: true }).focus();
        await page.keyboard.press('Home');
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('settings-test')).completedTasksGroupBy === 'date');
        await completedChoices.locator('..').locator('..').screenshot({ path: path.join(root, 'output/playwright/completed-grouping-setting.png') });
        await page.evaluate(() => tmOpenSettingsV2Page('view', 'v-tl'));
        const appearanceChoices = page.locator('[onchange="updateKanbanAppearance(this.value)"] + .tm-settings-choice-group');
        const dependencyChoices = page.locator('[onchange="tmUpdateTimelineDependencyScope(this.value)"] + .tm-settings-choice-group');
        assert.equal(await appearanceChoices.getByRole('radio').count(), 2, 'kanban appearance uses two segmented choices');
        assert.equal(await appearanceChoices.getAttribute('class'), await dependencyChoices.getAttribute('class'), 'kanban appearance reuses the timeline dependency choice styling');
        assert.ok(await page.locator('[onchange="updateKanbanAppearance(this.value)"]').isHidden(), 'native dropdown remains the hidden value source');
        await appearanceChoices.getByRole('radio', { name: '卡片样式', exact: true }).click();
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('settings-test')).kanbanAppearance === 'classic');
        assert.equal(await page.getByRole('slider', { name: '分区颜色浓度', exact: true }).count(), 0, 'color strength is available only for vertical lanes');
        await page.reload();
        await page.locator('.tm-settings-v2').waitFor();
        await page.evaluate(() => tmOpenSettingsV2Page('view', 'v-tl'));
        assert.equal(await appearanceChoices.locator('[aria-checked="true"]').getAttribute('data-choice-value'), 'classic', 'segmented choice survives reload');
        await appearanceChoices.getByRole('radio', { name: '卡片样式', exact: true }).focus();
        await page.keyboard.press('Home');
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('settings-test')).kanbanAppearance === 'lanes');
        assert.equal(await appearanceChoices.locator('[aria-checked="true"]').getAttribute('data-choice-value'), 'lanes', 'keyboard switches to vertical lanes');
        const laneStrength = page.getByRole('slider', { name: '分区颜色浓度', exact: true });
        assert.equal(await laneStrength.inputValue(), '15', 'default lane color strength is 15 percent');
        await laneStrength.fill('26');
        await laneStrength.dispatchEvent('change');
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('settings-test')).kanbanLaneColorStrength === 26);
        await page.reload();
        await page.locator('.tm-settings-v2').waitFor();
        await page.evaluate(() => tmOpenSettingsV2Page('view', 'v-tl'));
        assert.equal(await laneStrength.inputValue(), '26', 'lane color strength survives reload');
        await appearanceChoices.getByRole('radio', { name: '卡片样式', exact: true }).click();
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('settings-test')).kanbanAppearance === 'classic');
        assert.equal(await laneStrength.count(), 0, 'switching back hides color-only setting');
        await appearanceChoices.getByRole('radio', { name: '竖向分区', exact: true }).click();
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('settings-test')).kanbanAppearance === 'lanes');
        assert.equal(await laneStrength.inputValue(), '26', 'switching appearances retains the saved strength');
        await laneStrength.fill('15');
        await laneStrength.dispatchEvent('change');
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('settings-test')).kanbanLaneColorStrength === 15);
        await appearanceChoices.locator('..').locator('..').screenshot({ path: path.join(root, 'output/playwright/kanban-appearance-setting.png') });
        await laneStrength.locator('..').locator('..').screenshot({ path: path.join(root, 'output/playwright/kanban-color-strength-setting.png') });
        if (process.env.TM_TEST_SMOKE === '1') {
            await page.evaluate(() => tmOpenSettingsV2Page('general'));
            const choices = page.locator('[onchange="updateDefaultViewMode(this.value)"] + .tm-settings-choice-group');
            await choices.getByRole('radio', { name: '看板视图', exact: true }).click();
            await page.waitForFunction(() => JSON.parse(localStorage.getItem('settings-test')).defaultViewMode === 'kanban');
            await page.reload();
            await page.locator('.tm-settings-v2').waitFor();
            await page.evaluate(() => tmOpenSettingsV2Page('general'));
            assert.equal(await choices.locator('[aria-checked="true"]').getAttribute('data-choice-value'), 'kanban', 'saved setting survives a fresh runtime');
            assert.equal(await page.evaluate(() => __settingsTest.SettingsStore.data.defaultViewMode), 'kanban');
            await page.locator('.tm-settings-v2-close').click();
            await page.waitForFunction(() => !document.querySelector('.tm-settings-v2'));
            await page.evaluate(() => showSettings());
            await page.locator('.tm-settings-v2').waitFor();
            assert.deepEqual(errors, []);
            console.log('Settings release smoke passed: open, change, persist, reload, close and reopen');
            return;
        }
        // Long source lists must stay in normal flow in compact settings containers.
        await page.evaluate(() => {
            const { state, SettingsStore } = __settingsTest;
            window.__sourceListBackup = { documents: state.allDocuments, selected: SettingsStore.data.selectedDocIds };
            state.allDocuments = Array.from({ length: 18 }, (_, index) => ({
                id: '20261017000000-doc' + String(index).padStart(4, '0'),
                name: '移动端长文档名称与来源布局回归检查 ' + (index + 1), notebook: 'notebook-test', path: '/主题/来源.sy',
            }));
            SettingsStore.data.selectedDocIds = state.allDocuments.map(doc => doc.id);
            tmOpenSettingsV2Page('docs', 't-src');
        });
        for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 1000 }]) {
            await page.setViewportSize(viewport);
            const bounds = await page.locator('.tm-doc-group-manager__source-list').first().evaluate(list => ({
                rows: list.children.length, bottom: list.getBoundingClientRect().bottom,
                lastBottom: list.lastElementChild.getBoundingClientRect().bottom,
                panelBottom: list.closest('.tm-settings-panel').getBoundingClientRect().bottom,
            }));
            assert.equal(bounds.rows, 18);
            assert.ok(bounds.lastBottom <= bounds.bottom + 1, `${viewport.width}px: source rows must not overflow the list: ${JSON.stringify(bounds)}`);
            assert.ok(bounds.lastBottom <= bounds.panelBottom + 1, `${viewport.width}px: source rows must not cover following settings`);
            const remove = page.locator('.tm-doc-group-manager__source-list').first().getByRole('button', { name: '移除', exact: true }).last();
            await remove.scrollIntoViewIfNeeded();
            assert.ok(await remove.evaluate(button => {
                const rect = button.getBoundingClientRect();
                return button.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
            }), `${viewport.width}px: the last source action remains reachable by scrolling`);
        }
        await page.evaluate(() => {
            __settingsTest.state.allDocuments = __sourceListBackup.documents;
            __settingsTest.SettingsStore.data.selectedDocIds = __sourceListBackup.selected;
            delete window.__sourceListBackup;
            __settingsTest.SettingsStore.data.customDurationOptions = ['0.5', '1', '2', '3'];
            tmOpenSettingsV2Page('view', 'v-tl');
        });
        await page.waitForFunction(() => __settingsTest.searchIndexReady());
        const relevance = await page.evaluate(() => {
            return {
                kanban: __settingsTest.searchResults('看板').map(entry => entry.title),
                durations: __settingsTest.searchResults('时长预设').map(entry => entry.title),
                durationRoute: __settingsTest.searchResults('时长预设')[0]?.route,
                weekly: __settingsTest.searchResults('每周可安排时间').map(entry => entry.title),
                actionEntries: __settingsTest.searchEntries().filter(entry => /^(?:删除|编辑规则|重置|亮色|夜间|\+ 添加)$|^rgb\(/.test(entry.title)),
                arrowEntries: __settingsTest.searchEntries().filter(entry => /(?:^|·)\s*[↑↓×＋+−-]\s*$/.test(entry.title)).map(entry => entry.title)
            };
        });
        assert.deepEqual(relevance.arrowEntries, [], 'reorder/delete controls are not independent settings');
        assert.ok(relevance.kanban.includes('看板卡片字段'), 'real kanban settings remain searchable');
        assert.ok(!relevance.kanban.some(title => /时长预设|白板文字默认字号|汇总时间轴连线来源/.test(title)), 'a category breadcrumb alone never matches a setting');
        assert.deepEqual(relevance.durations, ['时长预设'], 'preset values and actions resolve to one meaningful settings group');
        assert.deepEqual(relevance.durationRoute, { page: 'calendar', sub: 'c-focus' }, 'duration presets belong to time and focus settings');
        assert.deepEqual(relevance.weekly, ['每周可安排时间'], 'repeated time ranges resolve to their actual setting');
        for (const entry of relevance.actionEntries) {
            assert.equal(entry.tab, 'priority', 'standalone actions are scoped to the priority module editor');
            assert.match(decodeURIComponent(entry.key), /tm(?:Add|Remove)Priority(?:DueRange|DurationBucket|TitleOpacityRange|DocDelta|GroupDelta)\|/);
            assert.deepEqual(entry.route, { page: 'algo', sub: 'r-priority' });
            assert.equal(entry.sectionLabel, '优先级数值', 'action results retain their settings context');
        }
        assert.equal(new Set(relevance.actionEntries.map(entry => entry.key)).size, relevance.actionEntries.length,
            'repeated module actions have unique search targets');
        const tabLayout = await page.evaluate(() => {
            tmOpenSettingsV2Page('calendar', 'c-focus');
            const content = document.querySelector('.tm-settings-content');
            const tabs = content?.querySelector('.tm-settings-subtabs');
            const close = document.querySelector('.tm-settings-v2-close');
            const contentStyle = content ? getComputedStyle(content) : null;
            const contentInnerWidth = content && contentStyle
                ? content.clientWidth - parseFloat(contentStyle.paddingLeft) - parseFloat(contentStyle.paddingRight)
                : 0;
            return {
                tabsWidth: tabs?.getBoundingClientRect().width || 0,
                contentWidth: contentInnerWidth,
                rightPadding: tabs ? getComputedStyle(tabs).paddingRight : '',
                closeVisible: !!close?.getClientRects().length
            };
        });
        assert.equal(tabLayout.tabsWidth, tabLayout.contentWidth, 'secondary tabs fill the complete content row');
        assert.equal(tabLayout.rightPadding, '52px', 'secondary tabs reserve only the close-button safe area');
        assert.equal(tabLayout.closeVisible, true, 'close button remains visible above the full-width tab row');
        await page.locator('.tm-settings-v3-rail-search').click();
        await page.locator('[data-tm-settings-search-input]').fill('看板');
        await page.waitForFunction(() => __settingsTest.searchIndexReady());
        assert.deepEqual(
            (await page.locator('.tm-settings-search-result__title').allTextContents()).sort(),
            [...relevance.kanban].sort(),
            'live result list uses the same relevance filtering'
        );
        await page.locator('.tm-settings-v3').screenshot({ path: path.join(root, 'output/playwright/settings-v3-search-kanban.png') });
        await page.locator('[data-tm-settings-search-input]').press('Escape');
        const rows = new Map();
        const pages = await page.evaluate(() => __settingsTest.pages.map(([id]) => id));
        assert.equal(pages.length, 8, 'v3 exposes eight primary categories');
        let subpageCount = 0;
        for (const id of pages) {
            await page.evaluate((id) => tmOpenSettingsV2Page(id), id);
            await page.waitForTimeout(50);
            const data = await page.evaluate(() => ({
                title: document.querySelector('.tm-settings-v2-header h2')?.textContent,
                controls: document.querySelector('.tm-settings-content').querySelectorAll('input,select,textarea,button').length,
                rows: [...document.querySelectorAll('.tm-settings-content [data-tm-settings-search-key]')].map((el) => [el.dataset.tmSettingsSearchKey, el.dataset.tmSettingsSearchTitle]),
                duplicateIds: [...document.querySelectorAll('[id]')].map((el) => el.id).filter((id, i, all) => all.indexOf(id) !== i),
                sections: [...document.querySelectorAll('.tm-settings-panel[data-tm-settings-section]')].filter(panel => !panel.hidden).map((panel) => ({
                    id: panel.dataset.tmSettingsSection,
                    label: panel.querySelector('.tm-settings-section-title')?.textContent?.trim() || '',
                })),
            }));
            console.log('PAGE', id, data.title, data.controls, 'controls');
            assert.ok(data.controls > 0, `${id} must have controls`);
            assert.deepEqual(await page.evaluate(unindexedSettingsControls), [], `${id} has no unindexed setting controls`);
            assert.deepEqual(data.duplicateIds, [], `${id} duplicate IDs`);
            const sectionIds = data.sections.map((section) => section.id);
            assert.equal(new Set(sectionIds).size, sectionIds.length, `${id} duplicate section ids`);
            assert.ok(data.sections.every(section => /[\u4e00-\u9fff]/.test(section.label)), `${id} section labels must include Chinese`);
            const tabLabels = await page.locator('.tm-settings-subtabs .tm-settings-subtab-btn').allTextContents();
            assert.deepEqual(tabLabels, data.sections.map(section => section.label), `${id} tabs match section headings`);
            assert.equal(new Set(tabLabels).size, tabLabels.length, `${id} duplicate tab labels`);
            const subpages = await page.locator('.tm-settings-v3-sections button').evaluateAll(nodes => nodes.map(node => node.dataset.settingsSubpage));
            subpageCount += subpages.length;
            for (const sub of subpages) {
                await page.evaluate(sub => tmOpenSettingsV3Subpage(sub), sub);
                assert.equal(await page.locator('.tm-settings-v3').getAttribute('data-settings-subpage'), sub);
                assert.ok(await page.locator('.tm-settings-content [data-tm-settings-subpage]:not([hidden])').count() > 0, `${sub} has production content or an explicit mode explanation`);
            }
            if (subpages.length) await page.evaluate(sub => tmOpenSettingsV3Subpage(sub), subpages[0]);
            if (id === 'docs') assert.ok(tabLabels.includes('扫描范围'), 'scan settings remain available');
            if (id === 'calendar') assert.ok(subpages.includes('c-ics'), 'calendar subscription is reachable');
            if (id === 'about') {
                assert.ok(data.sections.some((section) => section.label === '设置备份与迁移'), 'backup section label');
                await page.evaluate(() => tmOpenSettingsV3Subpage('d-sync'));
                assert.equal(await page.getByRole('button', { name: '复制诊断', exact: true }).count(), 1, 'diagnostic action appears once');
                await page.evaluate(() => tmOpenSettingsV3Subpage('d-io'));
                assert.ok(await page.getByRole('button', { name: '导入滴答 CSV', exact: true }).isVisible(), 'task import is in data / import export');
            }
            await page.screenshot({ path: path.join(root, `output/playwright/settings-v2-${id}-desktop.png`) });
            if (id === 'about') {
                await page.evaluate(() => tmOpenSettingsV3Subpage('d-sync'));
                await page.locator('.tm-settings-device-details > summary').click();
                assert.ok(await page.getByText('当前判定链路', { exact: true }).isVisible(), 'diagnostic details can be expanded');
                assert.equal(await page.locator('.tm-settings-content').evaluate(el => el.scrollWidth > el.clientWidth + 2), false, 'expanded diagnostics fit the page');
                await page.screenshot({ path: path.join(root, 'output/playwright/settings-v2-about-expanded-desktop.png') });
                await page.getByRole('button', { name: '兼容与同步', exact: true }).click();
                assert.equal(await page.getByRole('button', { name: '兼容与同步', exact: true }).getAttribute('aria-pressed'), 'true');
                assert.ok(await page.locator('.tm-settings-v2-close').isVisible(), 'close remains available after scrolling');
            }
            data.rows.forEach(([key, title]) => rows.set(key, title));
            assert.equal(await page.locator('.tm-settings-actions').count(), 0, 'no separate save/cancel footer');
        }
        await page.waitForFunction(() => __settingsTest.searchIndexReady());
        const expected = await page.evaluate(() => __settingsTest.state.settingsSearchGeneratedEntries.filter((entry) => entry.rendered).map((entry) => [entry.key, entry.title]));
        assert.equal(subpageCount, 29, 'v3 exposes twenty-nine secondary pages after removing reset');
        const missing = expected.filter(([key]) => !rows.has(key));
        console.log('COVERAGE', rows.size, 'rows;', missing.length, 'missing', JSON.stringify(missing));
        assert.deepEqual(missing, [], 'every indexed production setting must remain reachable');
        await page.evaluate(() => tmOpenSettingsV2Page('appearance', 'l-density'));
        await page.locator('.tm-settings-v3-rail-search').click();
        // Page navigation rebuilds the index; settle it before testing synchronous input results.
        await page.waitForFunction(() => __settingsTest.searchIndexReady());
        const realtime = await page.evaluate(() => {
            const input = document.querySelector('[data-tm-settings-search-input]');
            const jobCount = __settingsTest.jobs.size;
            const queries = ['跟随思源主题色', '主题方案', '控件圆角', '导入设置包', '领取试用', '日历'];
            const matches = queries.map(query => {
                input.value = query;
                input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: query }));
                return { query, state: __settingsTest.state.settingsSearchQuery,
                    titles: [...document.querySelectorAll('.tm-settings-search-result__title')].map(el => el.textContent) };
            });
            input.value = 'zhuti';
            input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
            const composingQuery = __settingsTest.state.settingsSearchQuery;
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, isComposing: true }));
            const composingOpen = document.querySelector('.tm-settings-v3').classList.contains('is-searching');
            input.value = '主题方案';
            input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '主题方案' }));
            return { matches, composingQuery, composingOpen, committed: __settingsTest.state.settingsSearchQuery,
                committedTitles: [...document.querySelectorAll('.tm-settings-search-result__title')].map(el => el.textContent),
                saved: __settingsTest.jobs.size - jobCount };
        });
        realtime.matches.forEach(({ query, state, titles }) => {
            assert.equal(state, query, 'input updates the query in the same event');
            assert.ok(titles.some(title => title.includes(query)), `${query} has an immediate result without waiting or Enter`);
        });
        assert.equal(realtime.composingQuery, '日历', 'IME draft does not replace the committed query');
        assert.equal(realtime.composingOpen, true, 'IME Enter does not navigate to a result');
        assert.equal(realtime.committed, '主题方案');
        assert.ok(realtime.committedTitles.includes('主题方案'), 'IME commit immediately refreshes results');
        assert.equal(realtime.saved, 0, 'search never enters settings autosave');
        await page.getByRole('button', { name: '主题方案 外观 / 配色', exact: true }).click();
        await page.waitForTimeout(60);
        assert.equal(await page.locator('.tm-settings-v3').getAttribute('data-settings-subpage'), 'l-color');
        assert.ok(await page.locator('.tm-settings-search-hit').isVisible(), 'a newly indexed theme control receives visible focus');
        const secretText = await page.evaluate(() => {
            const parent = document.createElement('div');
            parent.innerHTML = '<span>API 密钥</span><input value="private-input"><textarea>private-prompt</textarea><select><option>private-choice</option></select>';
            return [__settingsTest.searchStaticText(parent), ...[...parent.querySelectorAll('input,textarea,select')].map(__settingsTest.searchStaticText)];
        });
        assert.deepEqual(secretText, ['API 密钥', '', '', ''], 'index descriptions never contain stored field values');
        const badSearchRoutes = await page.evaluate(() => {
            const failures = [];
            const entries = __settingsTest.state.settingsSearchGeneratedEntries.filter(entry => entry.rendered);
            for (const entry of entries) {
                tmOpenSettingsSearchResult(entry.tab, entry.section, entry.key);
                if (![...document.querySelectorAll('.tm-settings-content [data-tm-settings-search-key]')].some(el => el.dataset.tmSettingsSearchKey === entry.key && (el.__tmChoiceGroup || el).getClientRects().length)) failures.push(entry.title);
            }
            return failures;
        });
        assert.deepEqual(badSearchRoutes, [], 'each search result must open the page containing its control');
        await page.evaluate(() => tmClearSettingsSearch());
        // Conditional AI fields and restricted/mobile hosts must retain their production settings.
        for (const scenario of ['legacy', 'mobile-restricted']) {
            await page.evaluate(scenario => {
                __settingsTest.SettingsStore.data.aiExperienceMode = scenario === 'legacy' ? 'legacy' : 'agent';
                __hasPro = scenario !== 'mobile-restricted';
                __tmRuntimeHost = { getInfo: () => ({ runtimeMobileClient: scenario === 'mobile-restricted', hostUsesMobileUI: scenario === 'mobile-restricted', isMobileDevice: scenario === 'mobile-restricted', isDockHost: false }) };
            }, scenario);
            const covered = new Set();
            for (const id of pages) {
                const keys = await page.evaluate(id => {
                    tmOpenSettingsV2Page(id);
                    return [...document.querySelectorAll('.tm-settings-content [data-tm-settings-search-key]')].map(el => el.dataset.tmSettingsSearchKey);
                }, id);
                keys.forEach(key => covered.add(key));
                assert.deepEqual(await page.evaluate(unindexedSettingsControls), [], `${scenario}/${id} has no unindexed setting controls`);
            }
            await page.waitForFunction(() => __settingsTest.searchIndexReady());
            const expectedKeys = await page.evaluate(() => __settingsTest.state.settingsSearchGeneratedEntries.filter(entry => entry.rendered).map(entry => entry.key));
            assert.deepEqual(expectedKeys.filter(key => !covered.has(key)), [], `${scenario} setting coverage`);
            await page.locator('.tm-settings-v3-rail-search').click();
            assert.ok(await page.locator('[data-tm-settings-search-input]').isVisible(), `${scenario} search`);
        }
        await page.evaluate(() => { __hasPro = true; delete window.__tmRuntimeHost; __settingsTest.SettingsStore.data.aiExperienceMode = 'agent'; });
        await page.evaluate(() => tmOpenSettingsV2Page('general'));
        const defaultChoices = page.locator('[onchange="updateDefaultViewMode(this.value)"] + .tm-settings-choice-group');
        assert.equal(await defaultChoices.getByRole('radio').count(), 6, 'default view is a button group');
        await page.evaluate(() => {
            window.__choiceChanges = 0;
            document.querySelector('[onchange="updateDefaultViewMode(this.value)"]').addEventListener('change', () => window.__choiceChanges++);
        });
        await defaultChoices.getByRole('radio', { name: '看板视图', exact: true }).click();
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('settings-test')).defaultViewMode === 'kanban');
        assert.equal(await page.evaluate(() => document.activeElement.dataset.choiceValue), 'kanban', 'focus survives full redraw');
        await defaultChoices.getByRole('radio', { name: '看板视图', exact: true }).click();
        assert.equal(await page.evaluate(() => __choiceChanges), 1, 'a selection dispatches exactly one change');
        await page.keyboard.press('ArrowRight');
        await page.waitForFunction(() => __settingsTest.SettingsStore.data.defaultViewMode === 'calendar');
        await page.keyboard.press('End');
        await page.waitForFunction(() => __settingsTest.SettingsStore.data.defaultViewMode === 'whiteboard');
        assert.equal(await defaultChoices.locator('[tabindex="0"]').count(), 1, 'each group has one tab stop');
        assert.equal(await defaultChoices.locator('[aria-checked="true"]').count(), 1, 'each group has one selected option');
        await page.evaluate(() => {
            const source = document.querySelector('[onchange="updateDefaultViewMode(this.value)"]');
            source.options[1].disabled = true;
        });
        await page.waitForFunction(() => document.querySelector('[onchange="updateDefaultViewMode(this.value)"]').__tmChoiceGroup.children[1].disabled);
        await defaultChoices.getByRole('radio', { name: '表格视图', exact: true }).focus();
        await page.keyboard.press('ArrowRight');
        await page.waitForFunction(() => __settingsTest.SettingsStore.data.defaultViewMode === 'timeline');
        await page.evaluate(() => updateDockSidebarEnabled(false));
        const dockChoices = page.locator('[onchange="updateDockDefaultViewMode(this.value)"] + .tm-settings-choice-group');
        assert.equal(await dockChoices.locator('button:not(:disabled)').count(), 0, 'parent switch disables every choice');
        await page.evaluate(() => updateDockSidebarEnabled(true));
        await defaultChoices.getByRole('radio', { name: '清单视图', exact: true }).click();
        await page.evaluate(() => tmOpenSettingsV2Page('behavior'));
        assert.equal(await page.locator('[onchange="updateNewTaskDailyNoteNotebookId(this.value)"]').getAttribute('hidden'), null, 'dynamic notebook picker stays native');
        await page.evaluate(() => tmOpenSettingsV2Page('calendar', 'c-cal'));
        const firstDayChoices = page.locator('[data-tm-cal-setting="calendarFirstDay"] + .tm-settings-choice-group');
        await firstDayChoices.getByRole('radio', { name: '周日', exact: true }).click();
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('settings-test')).calendarFirstDay === 0);
        assert.equal(await page.locator('[data-tm-cal-setting="calendarVisibleStartTime"]').getAttribute('hidden'), null, 'long time scale stays native');
        await page.evaluate(() => tmOpenSettingsV3Subpage('c-ics'));
        await page.evaluate(() => document.querySelectorAll('.tm-settings-content details').forEach(el => { el.open = true; }));
        const providerChoices = page.locator('[data-tm-cal-setting="calendarIcsProvider"] + .tm-settings-choice-group');
        await providerChoices.getByRole('radio', { name: 'WebDAV', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('[data-tm-cal-setting="calendarIcsProvider"]').__tmChoiceGroup?.querySelector('[aria-checked="true"]')?.textContent === 'WebDAV');
        assert.equal(await page.evaluate(() => document.activeElement.dataset.choiceValue), 'webdav', 'focus survives calendar partial redraw');
        assert.equal(await page.locator('[data-tm-settings-section="calendar-subscription"] > .tm-settings-v2-section-head .tm-settings-section-title').textContent(), '日历订阅', 'calendar heading survives partial redraw');
        assert.equal(await page.locator('.tm-settings-v2-section-body .tm-settings-v2-section-body').count(), 0, 'section decoration is idempotent');
        await page.evaluate(() => { __settingsTest.SettingsStore.data.calendarIcsEnabled = true; });
        page.once('dialog', dialog => dialog.dismiss());
        await providerChoices.getByRole('radio', { name: '链滴', exact: true }).click();
        assert.equal(await providerChoices.locator('[aria-checked="true"]').textContent(), 'WebDAV', 'rejected choice restores its previous selection');
        await page.evaluate(() => { __settingsTest.SettingsStore.data.calendarIcsEnabled = false; tmOpenSettingsV2Page('general'); });
        fs.mkdirSync(path.join(root, 'output/playwright'), { recursive: true });
        await page.waitForTimeout(250);
        for (const [width, height] of [[1440, 1000], [1366, 768], [1280, 600]]) {
            await page.setViewportSize({ width, height });
            const bounds = await page.locator('.tm-settings-box').boundingBox();
            assert.ok(bounds.height <= Math.min(740, height * 0.86) + 1, 'desktop height adapts to the available screen');
            assert.ok(bounds.y >= 24 && bounds.y + bounds.height <= height - 24, 'desktop dialog leaves space above and below');
            await page.locator('.tm-settings-nav-btn').filter({ hasText: '数据' }).click();
            assert.ok(await page.locator('.tm-settings-v2-close').isVisible(), 'close stays reachable on short screens');
            await page.locator('.tm-settings-nav-btn').filter({ hasText: '视图' }).click();
        }
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.screenshot({ path: path.join(root, 'output/playwright/settings-v2-integrated-desktop.png') });
        // Exercise the real palette resolver, including a light primary that
        // needs dark button text. Wait for the existing color transition to finish.
        await page.evaluate(() => {
            window.__savedTheme = {
                config: structuredClone(__settingsTest.SettingsStore.data.themeConfig),
                follow: __settingsTest.SettingsStore.data.enableSiyuanThemeColors,
            };
            __settingsTest.SettingsStore.data.enableSiyuanThemeColors = false;
            __settingsTest.SettingsStore.data.themeConfig = {
                ...__settingsTest.SettingsStore.data.themeConfig,
                overrideLight: { background: '#f4f6f8', primary: '#eed180', 'primary-foreground': '#202934' },
            };
            __settingsTest.applyTheme();
        });
        await page.waitForFunction(() => getComputedStyle(document.querySelector('.tm-settings-subtab-btn.is-active')).color === 'rgb(238, 209, 128)');
        assert.equal(await page.locator('.tm-settings-box').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(244, 246, 248)');
        assert.equal(await page.locator('.tm-settings-choice-group [aria-checked="true"]').first().evaluate(el => getComputedStyle(el).color), 'rgb(238, 209, 128)');
        assert.equal(await page.locator('.b3-switch:checked').first().evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(238, 209, 128)', 'switch follows plugin primary');
        await page.evaluate(() => tmOpenSettingsV2Page('about', 'd-io'));
        const exportButton = page.getByRole('button', { name: '导出设置包', exact: true });
        assert.equal(await exportButton.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(238, 209, 128)');
        assert.equal(await exportButton.evaluate(el => getComputedStyle(el).color), 'rgb(32, 41, 52)', 'custom primary foreground is retained');
        await page.screenshot({ path: path.join(root, 'output/playwright/settings-v2-custom-theme.png') });
        await page.evaluate(() => {
            __settingsTest.SettingsStore.data.enableSiyuanThemeColors = true;
            document.documentElement.style.setProperty('--b3-theme-primary', '#247a60');
            document.documentElement.style.setProperty('--b3-theme-background', '#f5f4ee');
            __settingsTest.applyTheme();
        });
        await page.waitForFunction(() => getComputedStyle(document.querySelector('.tm-settings-subtab-btn.is-active')).color === 'rgb(36, 122, 96)');
        assert.equal(await page.locator('.tm-settings-box').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(245, 244, 238)', 'follow mode uses SiYuan background');
        assert.equal(await exportButton.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(36, 122, 96)', 'follow mode uses SiYuan primary');
        await page.screenshot({ path: path.join(root, 'output/playwright/settings-v2-siyuan-theme.png') });
        await page.evaluate(() => {
            document.documentElement.style.removeProperty('--b3-theme-primary');
            document.documentElement.style.removeProperty('--b3-theme-background');
            __settingsTest.SettingsStore.data.themeConfig = __savedTheme.config;
            __settingsTest.SettingsStore.data.enableSiyuanThemeColors = __savedTheme.follow;
            delete window.__savedTheme;
            __settingsTest.applyTheme();
        });
        await page.evaluate(() => tmOpenSettingsV2Page('algo', 'r-priority'));
        await page.locator('[data-tm-call="tmSetPriorityBase"]').fill('77');
        await page.getByRole('spinbutton', { name: '置顶加减分', exact: true }).fill('25');
        await page.waitForTimeout(750);
        assert.equal(await page.evaluate(() => __settingsTest.SettingsStore.data.priorityScoreConfig.base), 77);
        assert.equal(await page.evaluate(() => __settingsTest.SettingsStore.data.priorityScoreConfig.pinnedDelta), 25, 'pinned score automatically saves');
        await page.locator('.tm-priority-modules').screenshot({ path: path.join(root, 'output/playwright/priority-pinned-score-setting.png') });
        await page.reload();
        await page.evaluate(() => tmOpenSettingsV2Page('algo', 'r-priority'));
        assert.equal(await page.locator('[data-tm-call="tmSetPriorityBase"]').inputValue(), '77');
        assert.equal(await page.getByRole('spinbutton', { name: '置顶加减分', exact: true }).inputValue(), '25', 'pinned score survives reload');
        await page.getByRole('spinbutton', { name: '置顶加减分', exact: true }).fill('0');
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('settings-test'))?.priorityScoreConfig?.pinnedDelta === 0);
        assert.equal(await page.evaluate(() => __settingsTest.SettingsStore.data.priorityScoreConfig.pinnedDelta), 0, 'zero pinned score saves without reverting to the previous value');
        await page.evaluate(() => tmOpenSettingsV2Page('algo', 'r-rules'));
        await page.evaluate(() => {
            __settingsTest.render();
            window.__ruleShellBeforeSave = __settingsTest.state.modal;
        });
        await page.locator('[data-tm-action="addNewRule"]').click();
        await page.locator('input[placeholder="规则名称"]').fill('自动保存规则');
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('settings-test'))?.filterRules?.some(rule => rule.name === '自动保存规则'));
        assert.ok(await page.evaluate(() => __settingsTest.state.filterRules.some((rule) => rule.name === '自动保存规则')));
        const autosaveRuleId = await page.evaluate(() => __settingsTest.state.editingRule.id);
        for (const id of ['tmTopbarRuleSelect', 'tmMobileRuleSelect']) {
            assert.equal(await page.locator(`#${id} [data-tm-option-value="${autosaveRuleId}"]`).getAttribute('data-tm-option-label'), '自动保存规则', 'new rules appear without rebuilding the task view');
        }
        assert.equal(await page.evaluate(() => __settingsTest.state.modal === __ruleShellBeforeSave), true);
        await page.evaluate(() => tmToggleTopbarSelect('tmTopbarRuleSelect'));
        await page.locator('input[placeholder="规则名称"]').evaluate(input => {
            input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
            input.value = '中文输入法规则';
            input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true, inputType: 'insertCompositionText', data: '中文输入法规则' }));
            input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '中文输入法规则' }));
        });
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('settings-test')).filterRules.find(rule => rule.id === __settingsTest.state.editingRule.id)?.name === '中文输入法规则');
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('settings-test')).filterRules.find(rule => rule.id === __settingsTest.state.editingRule.id)?.name), '中文输入法规则', 'IME confirmation autosaves the name while the input retains focus');
        assert.equal(await page.locator('input[placeholder="规则名称"]').evaluate(input => input === document.activeElement), true);
        assert.equal(await page.locator(`#tmTopbarFloatingMenu [data-tm-option-value="${autosaveRuleId}"]`).getAttribute('data-tm-option-label'), '中文输入法规则', 'an already-open dropdown also receives renamed options');
        await page.evaluate(() => tmToggleTopbarSelect('tmTopbarRuleSelect'));
        await page.evaluate(async id => { toggleRuleEnabled(id, false); await __settingsTest.flush(); }, autosaveRuleId);
        assert.equal(await page.locator(`#tmTopbarRuleSelect [data-tm-option-value="${autosaveRuleId}"]`).count(), 0, 'disabled rules disappear from the dropdown');
        await page.evaluate(async id => { toggleRuleEnabled(id, true); await __settingsTest.flush(); }, autosaveRuleId);
        assert.equal(await page.locator(`#tmTopbarRuleSelect [data-tm-option-value="${autosaveRuleId}"]`).count(), 1, 'reenabled rules return immediately');
        await page.locator('[data-tm-action="addCondition"]').click();
        await page.locator('[data-tm-change="updateConditionField"][data-index="0"]').selectOption('completionTime');
        await page.locator('[data-tm-change="updateConditionOperator"][data-index="0"]').selectOption('range_week');
        await page.locator('[data-tm-action="addCondition"]').click();
        const textOperator = page.locator('[data-tm-change="updateConditionOperator"][data-index="1"]');
        assert.equal(await textOperator.isVisible(), true, 'text comparisons remain a visible native dropdown');
        assert.deepEqual(await textOperator.locator('option').allTextContents().then(labels => labels.map(label => label.trim())), ['等于', '不等于', '在列表中', '不在列表中', '包含', '不包含', '为空', '不为空']);
        await textOperator.selectOption('is_empty');
        assert.equal(await page.locator('.tm-rule-condition-value-empty').count(), 2, 'empty and relative-date comparisons need no value');
        await textOperator.selectOption('contains');
        await page.locator('[data-tm-change="updateConditionValue"][data-index="1"]').fill('周报');
        assert.deepEqual(await page.locator('[data-tm-change="updateConditionOperator"]').evaluateAll(selects => selects.map(select => ({ hidden: select.hidden, hasButtons: !!select.__tmChoiceGroup }))), [{ hidden: false, hasButtons: false }, { hidden: false, hasButtons: false }], 'rerendering never turns comparisons into button groups');
        await page.locator('[data-tm-action="addCondition"]').click();
        const pinField = page.locator('[data-tm-change="updateConditionField"][data-index="2"]');
        const pinValue = page.locator('[data-tm-change="updateConditionValue"][data-index="2"]');
        await pinField.selectOption('done');
        assert.equal(await pinValue.locator('option[value="__all__"]').count(), 1, 'completion filters retain the all-statuses option');
        await pinField.selectOption('pinned');
        assert.equal(await pinValue.inputValue(), 'true', 'pin filters default to pinned tasks');
        assert.deepEqual(await pinValue.locator('option').allTextContents(), ['已置顶', '未置顶'], 'pin filters must only offer pin states');
        await pinValue.selectOption('false');
        await page.locator('[data-tm-change="updateConditionOperator"][data-index="2"]').selectOption('!=');
        await page.locator('.tm-rule-group').filter({ has: page.locator('input[placeholder="规则名称"]') }).screenshot({ path: path.join(root, 'output/playwright/settings-rules-dropdown.png') });
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(await textOperator.isVisible(), true, 'comparison dropdown remains available on mobile');
        await page.locator('.tm-rule-group').filter({ has: page.locator('input[placeholder="规则名称"]') }).screenshot({ path: path.join(root, 'output/playwright/settings-rules-dropdown-mobile.png') });
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.locator('input[placeholder="规则名称"]').fill('关闭前的规则名称');
        await page.locator('.tm-settings-v2-close').click();
        await page.waitForFunction(id => {
            const saved = JSON.parse(localStorage.getItem('settings-test')).filterRules.find(rule => rule.id === id);
            return saved?.name === '关闭前的规则名称' && saved.conditions[1]?.value === '周报'
                && saved.conditions[2]?.field === 'pinned' && saved.conditions[2]?.value === 'false';
        }, autosaveRuleId);
        await page.reload();
        await page.evaluate(() => tmOpenSettingsV2Page('algo', 'r-rules'));
        await page.locator(`[data-tm-action="editRule"][data-rule-id="${autosaveRuleId}"]`).click();
        assert.equal(await page.locator('input[placeholder="规则名称"]').inputValue(), '关闭前的规则名称', 'closing immediately and reloading retains the name');
        assert.equal(await textOperator.inputValue(), 'contains');
        assert.equal(await pinField.inputValue(), 'pinned', 'pin filter fields survive closing and reloading');
        assert.equal(await pinValue.inputValue(), 'false', 'pin filter values survive closing and reloading');
        assert.equal(await page.locator('[data-tm-change="updateConditionOperator"][data-index="2"]').inputValue(), '!=');
        await page.evaluate(async id => { await applyFilterRule(id); }, autosaveRuleId);
        await page.locator('input[placeholder="规则名称"]').fill('已有规则自动保存');
        await page.locator('[data-settings-subpage="r-priority"]').click();
        await page.waitForFunction(id => JSON.parse(localStorage.getItem('settings-test')).filterRules.find(rule => rule.id === id)?.name === '已有规则自动保存', autosaveRuleId);
        assert.equal(await page.locator('#tmTopbarRuleSelect .bc-select-trigger__value').textContent(), '已有规则自动保存', 'renaming the applied rule updates its displayed selection');
        assert.match(await page.locator('#tmMobileMenu .tm-topbar-menu__summary-text').textContent(), /规则 已有规则自动保存/);
        await page.locator('[data-settings-subpage="r-rules"]').click();
        await page.evaluate(() => {
            __settingsTest.state.modal.querySelector('.tm-header-selectors').style.display = 'none';
            tmToggleDesktopMenu();
        });
        assert.equal(await page.locator('#tmDesktopRuleSelect .bc-select-trigger__value').textContent(), '已有规则自动保存');
        await page.locator('input[placeholder="规则名称"]').evaluate(input => {
            input.value = '菜单同步名称';
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await page.waitForFunction(id => JSON.parse(localStorage.getItem('settings-test')).filterRules.find(rule => rule.id === id)?.name === '菜单同步名称', autosaveRuleId);
        assert.equal(await page.locator('#tmDesktopRuleSelect .bc-select-trigger__value').textContent(), '菜单同步名称', 'the desktop menu receives the current name');
        await page.evaluate(() => tmCloseDesktopMenu());
        await page.locator('[data-settings-subpage="r-priority"]').click();
        await page.evaluate(() => { window.__failSave = true; tmSetPriorityBase('88'); });
        await page.waitForTimeout(250);
        assert.equal(await page.evaluate(() => __settingsTest.SettingsStore.data.priorityScoreConfig.base), 77);
        assert.match(await page.locator('.tm-settings-v2-error').textContent(), /Simulated disk error/);
        await page.evaluate(() => { window.__failSave = false; tmSetPriorityBase('90'); });
        await page.waitForTimeout(250);
        assert.equal(await page.evaluate(() => __settingsTest.SettingsStore.data.priorityScoreConfig.base), 90);
        // Closing and background redraws flush text, preserve focus, and never reopen the dialog.
        await page.evaluate(() => tmOpenSettingsV2Page('appearance', 'l-density'));
        await page.locator('[onchange="updateFontSize(this.value)"]').fill('17');
        await page.evaluate(() => showSettings());
        assert.equal(await page.evaluate(() => document.activeElement.getAttribute('onchange')), 'updateFontSize(this.value)');
        await page.locator('[onchange="updateFontSize(this.value)"]').fill('18');
        await page.evaluate(() => { window.__saveDelay = 150; closeSettings(); });
        await page.waitForTimeout(400);
        assert.equal(await page.locator('.tm-settings-v2').count(), 0);
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('settings-test')).fontSize), 18);
        await page.evaluate(() => { window.__saveDelay = 0; showSettings(); tmOpenSettingsV2Page('appearance'); });
        await page.evaluate(() => { window.__failSave = true; updateFontSize('19'); });
        await page.waitForTimeout(40);
        assert.match(await page.locator('.tm-settings-v2-error').textContent(), /Simulated disk error/);
        await page.evaluate(() => { window.__failSave = false; });
        await page.locator('.tm-settings-v2-error button').click();
        await page.waitForTimeout(100);
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('settings-test')).fontSize), 19);
        // Different rule jobs share a writer: neither rule is lost while the store is slow.
        await page.evaluate(async () => {
            tmOpenSettingsV2Page('algo');
            window.__saveDelay = 80;
            addNewRule(); updateEditingRuleName('并发规则 A');
            addNewRule(); updateEditingRuleName('并发规则 B');
            await __settingsTest.flush();
            window.__saveDelay = 0;
        });
        assert.deepEqual(await page.evaluate(() => __settingsTest.state.filterRules.filter(rule => rule.name.startsWith('并发')).map(rule => rule.name).sort()), ['并发规则 A', '并发规则 B']);
        page.once('dialog', dialog => dialog.accept());
        await page.evaluate(async () => {
            const id = __settingsTest.state.editingRule.id;
            updateEditingRuleName('待删除规则');
            await deleteRule(id);
        });
        await page.waitForTimeout(200);
        assert.equal(await page.evaluate(() => __settingsTest.state.filterRules.some(rule => rule.name === '待删除规则' || rule.name === '并发规则 B')), false);
        page.once('dialog', dialog => dialog.accept());
        await page.evaluate(async id => { await deleteRule(id); }, autosaveRuleId);
        assert.equal(await page.locator(`#tmTopbarRuleSelect [data-tm-option-value="${autosaveRuleId}"]`).count(), 0, 'deleted rules disappear immediately');
        assert.equal(await page.locator('#tmTopbarRuleSelect .bc-select-trigger__value').textContent(), '全部', 'deleting the applied rule restores the all-tasks selection');
        // Rule order shares the rule writer, including pending edits and rapid clicks.
        await page.evaluate(async () => {
            cancelEditRule();
            const rules = ['a', 'b', 'c'].map(id => ({
                id: `order-${id}`, name: `顺序规则 ${id.toUpperCase()}`, enabled: true,
                conditions: [{ field: 'pinned', operator: '=', value: 'true' }], sort: [],
            }));
            await __settingsTest.RuleManager.saveRules(rules);
            __settingsTest.state.filterRules = rules;
            __settingsTest.render();
            showSettings(); tmOpenSettingsV2Page('algo', 'r-rules');
        });
        const ruleOrder = () => page.locator('#tm-rules-list [data-tm-action="editRule"]').evaluateAll(buttons => buttons.map(button => button.dataset.ruleId));
        const moveButton = (id, delta) => page.locator(`#tm-rules-list [data-tm-action="moveRule"][data-rule-id="order-${id}"][data-delta="${delta}"]`);
        const waitForRuleOrder = ids => page.waitForFunction(ids => JSON.stringify(__settingsTest.state.filterRules.map(rule => rule.id)) === JSON.stringify(ids), ids);
        const topbarRuleOrder = () => page.locator('#tmTopbarRuleSelect [data-tm-option-value^="order-"]').evaluateAll(options => options.map(option => option.dataset.tmOptionValue));
        assert.equal(await moveButton('a', -1).isDisabled(), true);
        assert.equal(await moveButton('c', 1).isDisabled(), true);
        assert.match(await page.locator('#tm-rules-list').textContent(), /已置顶/, 'pin conditions use readable summary labels');
        await moveButton('c', -1).click();
        await waitForRuleOrder(['order-a', 'order-c', 'order-b']);
        assert.deepEqual(await ruleOrder(), ['order-a', 'order-c', 'order-b']);
        assert.deepEqual(await topbarRuleOrder(), ['order-a', 'order-c', 'order-b'], 'rule menus follow the list order');
        await moveButton('c', 1).click();
        await waitForRuleOrder(['order-a', 'order-b', 'order-c']);
        await page.evaluate(async () => {
            window.__saveDelay = 60;
            await Promise.all([moveRule('order-c', -1), moveRule('order-c', -1)]);
            window.__saveDelay = 0;
        });
        assert.deepEqual(await ruleOrder(), ['order-c', 'order-a', 'order-b'], 'both rapid moves are saved');
        await page.reload();
        await page.evaluate(() => tmOpenSettingsV2Page('algo', 'r-rules'));
        assert.deepEqual(await ruleOrder(), ['order-c', 'order-a', 'order-b'], 'rule order survives reloading');
        await page.locator('[data-tm-action="editRule"][data-rule-id="order-a"]').click();
        await page.locator('input[placeholder="规则名称"]').fill('调整排序时保存规则');
        await moveButton('b', -1).click();
        await waitForRuleOrder(['order-c', 'order-b', 'order-a']);
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('settings-test')).filterRules.find(rule => rule.id === 'order-a')?.name === '调整排序时保存规则');
        assert.equal(await page.locator('input[placeholder="规则名称"]').inputValue(), '调整排序时保存规则', 'moving another rule preserves the editing draft');
        await page.evaluate(() => cancelEditRule());
        await page.evaluate(() => { window.__failSave = true; });
        await moveButton('a', -1).click();
        await page.waitForFunction(() => document.querySelector('.tm-settings-v2-error')?.textContent.includes('Simulated disk error'));
        assert.deepEqual(await ruleOrder(), ['order-c', 'order-b', 'order-a'], 'failed moves preserve the last saved order');
        await page.evaluate(() => { window.__failSave = false; });
        await page.locator('.tm-settings-v2-error button').click();
        await waitForRuleOrder(['order-c', 'order-a', 'order-b']);
        await page.setViewportSize({ width: 390, height: 844 });
        await moveButton('c', 1).click();
        await waitForRuleOrder(['order-a', 'order-c', 'order-b']);
        await page.locator('#tm-rules-list').screenshot({ path: path.join(root, 'output/playwright/settings-rule-order-mobile.png') });
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.locator('#tm-rules-list').screenshot({ path: path.join(root, 'output/playwright/settings-rule-order.png') });
        await page.evaluate(() => { closeSettings(); showRulesManager(); });
        await moveButton('c', -1).click();
        await waitForRuleOrder(['order-c', 'order-a', 'order-b']);
        await page.evaluate(() => { closeSettings(); showSettings(); });
        await page.evaluate(() => tmEditQuadrantRule(0));
        await page.locator('[data-quadrant-importance][value="low"]').check();
        await page.evaluate(() => __settingsTest.flush());
        assert.ok(await page.evaluate(() => __settingsTest.SettingsStore.data.quadrantConfig.rules[0].importance.includes('low')));
        await page.locator('#tm-cancel-quadrant-rule').click();
        // External priority entry keeps the same immediate semantics.
        await page.evaluate(() => showPriorityScoreSettings());
        await page.locator('.tm-modal [data-tm-call="tmSetPriorityBase"]').fill('95');
        await page.locator('.tm-modal [data-tm-call="tmSetPriorityPinned"]').fill('-15');
        await page.evaluate(() => closePriorityScoreSettings());
        await page.evaluate(() => __settingsTest.flush());
        assert.equal(await page.evaluate(() => __settingsTest.SettingsStore.data.priorityScoreConfig.base), 95);
        assert.equal(await page.evaluate(() => __settingsTest.SettingsStore.data.priorityScoreConfig.pinnedDelta), -15, 'external priority settings save negative pinned deltas');
        // Serial policy requests retain edits made during a slow request; stale revisions are reloaded.
        await page.evaluate(() => { tmOpenSettingsV2Page('ai'); __settingsService.delay = 150; tmAgentPolicySetDurationFallback('30'); });
        await page.waitForTimeout(180);
        await page.evaluate(() => { tmAgentPolicySetDurationFallback('45'); tmAgentPolicySetCustomInstructions('保留最新要求'); });
        await page.evaluate(() => __settingsTest.flush());
        assert.equal(await page.evaluate(() => __settingsService.maxActive), 1);
        assert.equal(await page.evaluate(() => __settingsService.policy.durationDefaults.fallbackMinutes), 45);
        assert.equal(await page.evaluate(() => __settingsService.policy.global.customInstructions), '保留最新要求');
        await page.evaluate(async () => {
            __settingsService.delay = 0;
            __settingsTest.policy.addDocumentOverrideID = '20260924000000-abcdefg';
            tmAgentPolicyAddDocumentOverride(); tmAgentPolicySetCustomInstructions('文档要求');
            await __settingsTest.flush();
            tmAgentPolicyDeleteOverride(); await __settingsTest.flush();
        });
        assert.deepEqual(await page.evaluate(() => __settingsService.policy.documentOverrides), {});
        await page.evaluate(async () => {
            __settingsService.policy.revision++;
            __settingsService.policy.durationDefaults.fallbackMinutes = 60;
            tmAgentPolicySetDurationFallback('90'); await __settingsTest.flush();
        });
        assert.equal(await page.evaluate(() => __settingsTest.policy.draft.durationDefaults.fallbackMinutes), 60);
        assert.match(await page.locator('.tm-settings-v2-error').textContent(), /已重新读取最新设置/);
        assert.equal(await page.locator('.tm-settings-v2-error button').count(), 0, 'never retry stale policy patches');
        await page.evaluate(async () => { tmAgentPolicySetDurationFallback('75'); await __settingsTest.flush(); });
        // New automations are paused; edits and toggles cannot overwrite scheduler-owned run records.
        await page.evaluate(async () => { tmScheduledCreate(); await __settingsTest.flush(); });
        assert.equal(await page.evaluate(() => __settingsService.events[0].enabled), false);
        await page.evaluate(async () => {
            const event = __settingsService.events[0]; event.lastRun = { status: 'succeeded', title: '运行记录' };
            tmScheduledUpdateDraft('name', '自动保存定时事件');
            await tmScheduledToggle(event.id, true);
            tmScheduledUpdateDraft('prompt', '新的提示词');
            await __settingsTest.flush();
        });
        assert.deepEqual(await page.evaluate(() => [__settingsService.events[0].enabled, __settingsService.events[0].name, __settingsService.events[0].lastRun.title]), [true, '自动保存定时事件', '运行记录']);
        await page.evaluate(async () => { __settingsService.eventFailure = true; tmScheduledUpdateDraft('name', '重试后事件'); await __settingsTest.flush(); });
        assert.match(await page.locator('.tm-settings-v2-error').textContent(), /Scheduled write failed/);
        await page.evaluate(() => { __settingsService.eventFailure = false; });
        await page.locator('.tm-settings-v2-error button').click();
        await page.waitForTimeout(100);
        assert.equal(await page.evaluate(() => __settingsService.events[0].name), '重试后事件');
        await page.evaluate(() => tmScheduledCancelEdit());
        page.once('dialog', dialog => dialog.accept());
        await page.evaluate(async () => { const id = __settingsService.events[0].id; tmScheduledEdit(id); tmScheduledUpdateDraft('name', '待删除事件'); await tmScheduledDelete(id); });
        await page.waitForTimeout(200);
        assert.equal(await page.evaluate(() => __settingsService.events.length), 0);
        await checkSettingsLayouts(page);
        await checkSettingsLayouts(page, true);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.evaluate(() => tmOpenSettingsV2Page('general'));
        await page.waitForTimeout(250);
        await page.screenshot({ path: path.join(root, 'output/playwright/settings-v2-integrated-mobile.png') });
        const contentBeforeSearch = await page.locator('.tm-settings-content').boundingBox();
        const secondaryBeforeSearch = await page.locator('.tm-settings-v3-sections').boundingBox();
        const actionsBeforeSearch = await page.locator('.tm-settings-v2-header').boundingBox();
        assert.ok(secondaryBeforeSearch.x + secondaryBeforeSearch.width <= actionsBeforeSearch.x, 'tabs never extend under search or close');
        await page.locator('.tm-settings-v3-search-toggle').click();
        const searchBounds = await page.locator('.tm-settings-search-input-wrap').boundingBox();
        const closeBounds = await page.locator('.tm-settings-v2-close').boundingBox();
        assert.ok(searchBounds.y <= 8, 'narrow search opens at the top');
        assert.ok(searchBounds.x + searchBounds.width <= closeBounds.x, 'close remains beside search');
        assert.equal((await page.locator('.tm-settings-content').boundingBox()).y, contentBeforeSearch.y, 'search adds no header row');
        assert.ok(await page.locator('[data-tm-settings-search-input]').isVisible(), 'mobile search remains available');
        await page.locator('[data-tm-settings-search-input]').fill('默认视图');
        await page.locator('[data-tm-settings-search-input]').press('Enter');
        await page.waitForTimeout(100);
        assert.ok(await page.locator('.tm-settings-search-hit').count() > 0, 'keyboard search locates a real setting');
        assert.equal(await page.evaluate(() => document.activeElement.getAttribute('role')), 'radio', 'search focuses the visible selected button, not its hidden select');
        await page.evaluate(() => { siyuan.config.appearance.mode = 1; document.documentElement.dataset.themeMode = 'dark'; __settingsTest.applyTheme(); tmClearSettingsSearch(); tmOpenSettingsV2Page('general'); });
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.locator('.tm-settings-v2-close').focus();
        await page.locator('.tm-settings-content').evaluate(el => { el.scrollTop = 0; });
        await page.waitForTimeout(250);
        await page.screenshot({ path: path.join(root, 'output/playwright/settings-v2-integrated-dark.png') });
        assert.notEqual(await page.locator('.tm-settings-box').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)');
        await page.locator('.tm-settings-v2-close').focus();
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.tm-settings-v2').count(), 0, 'Escape closes the active dialog');
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto(`http://127.0.0.1:${server.address().port}/?lazy-calendar`);
        await page.locator('.tm-settings-v3').waitFor();
        await page.waitForFunction(() => typeof window.__loadCalendarForTest === 'function');
        await page.locator('.tm-settings-v3-rail-search').click();
        await page.locator('[data-tm-settings-search-input]').fill('日历起始日');
        const beforeCalendar = await page.evaluate(() => {
            window.__searchModalBeforeCalendar = document.querySelector('.tm-settings-v3');
            return __searchModalBeforeCalendar.dataset.settingsPage;
        });
        await page.evaluate(() => __loadCalendarForTest());
        await page.waitForFunction(() => __settingsTest.state.settingsSearchGeneratedEntries.some(entry => entry.tab === 'calendar'));
        assert.equal(await page.locator('[data-tm-settings-search-input]').inputValue(), '日历起始日', 'lazy loading preserves the in-progress search');
        assert.equal(await page.evaluate(() => document.querySelector('.tm-settings-v3') === __searchModalBeforeCalendar), true, 'lazy indexing does not rebuild the current page');
        assert.equal(await page.locator('.tm-settings-v3').getAttribute('data-settings-page'), beforeCalendar);
        assert.ok(await page.locator('.tm-settings-search-result').filter({ hasText: '日历起始日' }).count() > 0, 'calendar settings are searchable before visiting Time');
        await page.locator('.tm-settings-search-result').filter({ hasText: '日历起始日' }).first().click();
        await page.waitForTimeout(60);
        assert.equal(await page.locator('.tm-settings-v3').getAttribute('data-settings-page'), 'calendar');
        assert.ok(await page.locator('.tm-settings-search-hit').isVisible());
        assert.deepEqual(errors, []);
        console.log('Settings v3 browser integration passed');
    } finally { await browser.close(); server.close(); }
})().catch((error) => { console.error(error); server.close(); process.exitCode = 1; });
