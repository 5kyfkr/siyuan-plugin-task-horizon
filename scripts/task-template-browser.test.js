'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const browserFixture = require('./i18n-browser-fixture');
const { setup } = require('./quick-add-more-menu-browser.test');
const root = path.resolve(__dirname, '..');

async function openTemplateSubmenu(page) {
    if (!(await page.locator('#tmQuickAddMoreMenu').count())) await page.getByRole('button', { name: '更多', exact: true }).click();
    const trigger = page.locator('[data-quick-add-template-trigger]');
    if (!(await page.locator('[data-quick-add-template-back]').count())) await trigger.click();
}

async function chooseTemplate(page, id) {
    if (await page.locator('#tmQuickAddMoreBtn').isHidden()) await page.locator('[data-template-plain]').click();
    await openTemplateSubmenu(page);
    await page.locator(`[data-quick-add-template-id="${id}"]`).click();
}

async function openTemplateManager(page) {
    await openTemplateSubmenu(page);
    await page.locator('[data-quick-add-action="template-manage"]').click();
}

async function run() {
    const browser = await browserFixture.chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || undefined,
        ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
    const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let mobilePage = null;
    try {
        await setup(page, 'light');
        const names = await page.evaluate(() => __tmTaskTemplateLibrary().items.map(item => item.name));
        assert.deepEqual(names, ['功能发布', '文章发布', '每周计划'], 'fresh configuration exposes three built-in templates');
        const screenshotDirectory = path.join(root, 'output/playwright');
        fs.mkdirSync(screenshotDirectory, { recursive: true });

        mobilePage = await browser.newPage({ viewport: { width: 390, height: 760 }, isMobile: true, hasTouch: true });
        mobilePage.on('pageerror', error => errors.push(error.message));
        await setup(mobilePage, 'light');
        await mobilePage.locator('#tmQuickAddMoreBtn').tap();
        await mobilePage.locator('[data-quick-add-template-trigger]').tap();
        const mobileMenu = mobilePage.locator('#tmQuickAddMoreMenu');
        assert.equal(await mobileMenu.locator('[data-quick-add-template-back]').count(), 1, 'the first touch replaces More with a template submenu and a back control');
        assert.equal(await mobileMenu.locator('[data-quick-add-template-id]').count(), 3, 'the first touch immediately reveals the templates');
        assert.equal(await mobileMenu.locator('[data-quick-add-action="image"]').count(), 0, 'the first-level actions are replaced');
        assert.ok(await mobileMenu.locator('[data-quick-add-template-back] [data-tm-lucide="arrow-left"] svg').count(), 'the replacement view has a Phosphor back icon');
        await mobilePage.screenshot({ path: path.join(screenshotDirectory, 'task-template-menu-mobile.png') });
        await mobilePage.locator('[data-quick-add-template-back]').tap();
        assert.equal(await mobileMenu.locator('[data-quick-add-action="image"]').count(), 1, 'Back restores the More menu');
        await mobilePage.locator('[data-quick-add-template-trigger]').tap();
        await mobilePage.keyboard.press('Escape');
        assert.equal(await mobileMenu.locator('[data-quick-add-template-trigger]').count(), 1, 'Escape returns from the template submenu to More');
        await mobilePage.locator('[data-quick-add-template-trigger]').tap();
        await mobilePage.locator('[data-quick-add-template-id="builtin-article"]').tap();
        assert.equal(await mobilePage.locator('[data-template-topic]').isVisible(), true, 'a template can be selected on the first mobile navigation attempt');

        await page.locator('#tmQuickAddInput').fill('保留原任务草稿');
        await page.locator('#tmQuickAddRemark').fill('普通任务备注');
        await page.getByRole('button', { name: '更多', exact: true }).click();
        assert.equal(await page.getByRole('menuitem', { name: '模板管理' }).count(), 0, 'the template manager is not duplicated at the top level');
        assert.ok(await page.locator('[data-quick-add-template-trigger] [data-tm-lucide="stack-simple"] svg').count(), 'template menu uses the Phosphor bold stack icon');
        await page.locator('[data-quick-add-template-trigger]').click();
        assert.equal(await page.locator('#tmQuickAddMoreMenu [data-quick-add-action="image"]').count(), 0, 'the template view replaces the More actions');
        assert.equal(await page.locator('[data-quick-add-template-id]').count(), 3, 'templates are listed in a second-level menu');
        assert.equal(await page.getByRole('menuitem', { name: '模板管理' }).count(), 1, 'template management stays inside the template submenu');
        await page.screenshot({ path: path.join(screenshotDirectory, 'task-template-submenu-desktop.png') });
        await page.locator('[data-quick-add-template-id="builtin-article"]').click();
        assert.equal(await page.locator('#tmQuickAddInput').isVisible(), false);
        assert.equal(await page.locator('#tmQuickAddRemark').isVisible(), false, 'template mode hides the remark input');
        assert.equal(await page.locator('#tmQuickAddBatchHint').isVisible(), false, 'template mode hides the first-task remark hint');
        assert.equal(await page.locator('.tm-quick-add-tools button:visible').count(), 1, 'template mode exposes only the existing document-location control');
        assert.equal(await page.locator('.tm-quick-add-doc').isVisible(), true, 'template mode retains document-location selection');
        assert.equal(await page.locator('#tmQuickAddMoreBtn').isVisible(), false, 'template mode does not expose other field settings through More');
        await page.evaluate(() => { SettingsStore.data.quickAddFieldVisibility.doc = false; tmQuickAddRenderMeta(); });
        assert.equal(await page.locator('.tm-quick-add-doc').isVisible(), true, 'the document location stays visible even when plain-entry preferences hide it');
        await page.evaluate(() => { delete SettingsStore.data.quickAddFieldVisibility.doc; });
        assert.equal(await page.locator('[data-template-topic]').inputValue(), '新文章');
        assert.equal(await page.locator('[data-template-include]').count(), 8, 'includes the select-all control and seven task rows');
        await page.screenshot({ path: path.join(screenshotDirectory, 'task-template-preview-actions.png') });
        const previewFold = page.locator('[data-template-fold]').first();
        assert.equal(await previewFold.locator('[data-tm-lucide="caret-down"] svg').count(), 1, 'expanded preview parents show a downward icon');
        await previewFold.click();
        assert.equal(await page.locator('[data-template-fold]').first().locator('[data-tm-lucide="chevron-right"] svg').count(), 1, 'collapsed preview parents show a rightward icon');
        assert.equal(await page.locator('[data-template-include]').count(), 2, 'collapsing a preview parent hides its child rows');
        await page.locator('[data-template-fold]').first().click();
        assert.equal(await page.locator('[data-template-fold]').first().locator('[data-tm-lucide="caret-down"] svg').count(), 1, 'expanded preview icon returns when the branch opens');
        assert.ok(await page.locator('[data-template-plain] [data-tm-lucide="list-bullets"] svg').count(), 'preview exposes the Phosphor bold plain-entry action');
        const topicComposition = await page.evaluate(() => {
            const input = document.querySelector('[data-template-topic]');
            input.focus();
            const originalTopic = state.quickAdd.templateInstance.topic;
            input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
            input.value = 'zhong';
            input.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'zhong', inputType: 'insertCompositionText', isComposing: true }));
            input.dispatchEvent(new Event('input', { bubbles: true }));
            const during = {
                sameInput: document.querySelector('[data-template-topic]') === input,
                focused: document.activeElement === input,
                topic: state.quickAdd.templateInstance.topic,
                storedTopic: __tmGetQuickAddDraft(__tmTemplateDraftScope())?.template?.topic,
            };
            input.value = '中文主题';
            input.setSelectionRange(4, 4);
            input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '中文主题' }));
            input.dispatchEvent(new InputEvent('input', { bubbles: true, data: '中文主题', inputType: 'insertText' }));
            const after = {
                sameInput: document.querySelector('[data-template-topic]') === input,
                focused: document.activeElement === input,
                caret: input.selectionStart,
                topic: state.quickAdd.templateInstance.topic,
                storedTopic: __tmGetQuickAddDraft(__tmTemplateDraftScope())?.template?.topic,
                title: document.querySelector('.tm-task-template-row').lastElementChild.textContent,
                includeLabel: document.querySelector('[data-template-include="article"]').getAttribute('aria-label'),
                foldLabel: document.querySelector('[data-template-fold="article"]').getAttribute('aria-label'),
            };
            return { originalTopic, during, after };
        });
        assert.equal(topicComposition.during.sameInput, true, 'IME composition must keep the original topic input mounted');
        assert.equal(topicComposition.during.focused, true, 'IME composition must keep focus in the topic input');
        assert.equal(topicComposition.during.topic, topicComposition.originalTopic, 'uncommitted composition does not replace the confirmed topic');
        assert.equal(topicComposition.during.storedTopic, topicComposition.originalTopic, 'uncommitted composition is not persisted');
        assert.equal(topicComposition.after.sameInput, true, 'committing Chinese text must not replace the topic input');
        assert.equal(topicComposition.after.focused, true, 'Chinese input keeps focus after committing');
        assert.equal(topicComposition.after.caret, 4, 'Chinese input keeps its caret after committing');
        assert.equal(topicComposition.after.topic, '中文主题');
        assert.equal(topicComposition.after.storedTopic, '中文主题');
        assert.match(topicComposition.after.title, /中文主题/);
        assert.match(topicComposition.after.includeLabel, /中文主题/);
        assert.match(topicComposition.after.foldLabel, /中文主题/);
        await page.locator('[data-template-topic]').fill('上线记录');
        assert.match(await page.locator('.tm-task-template-row').first().innerText(), /上线记录/);
        const editedDraft = await page.evaluate(() => ({ scope:__tmTemplateDraftScope(), instance:state.quickAdd.templateInstance,
            stored:__tmGetQuickAddDraft(__tmTemplateDraftScope()) }));
        assert.equal(editedDraft.stored?.template?.topic, '上线记录', JSON.stringify(editedDraft));
        await page.locator('[data-template-include="editing"]').uncheck();
        assert.equal(await page.evaluate(() => __tmTemplateCount()), 4, 'parent exclusion removes its descendants');
        await page.locator('[data-template-plain]').click();
        assert.equal(await page.locator('#tmQuickAddInput').isVisible(), true, 'the preview action returns to plain entry');
        assert.equal(await page.locator('#tmQuickAddRemark').isVisible(), true, 'returning to plain entry restores the remark input');
        assert.equal(await page.locator('#tmQuickAddRemark').inputValue(), '普通任务备注', 'template mode preserves the ordinary remark draft');
        assert.equal(await page.locator('#tmQuickAddMoreBtn').isVisible(), true, 'returning to plain entry restores More');
        assert.ok(await page.locator('.tm-quick-add-tools button:visible').count() > 1, 'returning to plain entry restores its original fields');
        assert.equal(await page.locator('#tmQuickAddInput').isVisible(), true);
        assert.equal(await page.locator('#tmQuickAddInput').inputValue(), '保留原任务草稿', 'switching modes restores the plain draft');
        const templateDraft = await page.evaluate(() => ({
            plainDraft: __tmGetQuickAddDraft(''),
            entry: __tmGetQuickAddDraft('template:builtin-article'),
        }));
        assert.equal(templateDraft.entry?.template?.topic, '上线记录', JSON.stringify(templateDraft));
        assert.equal(templateDraft.plainDraft.value, '保留原任务草稿', 'plain-text and template drafts use separate persisted scopes');

        await chooseTemplate(page, 'builtin-weekly');
        await page.locator('#tmQuickAddCloseBtn').click();
        assert.equal(await page.evaluate(() => state.quickAdd), null, 'closing a selected template closes the composer');
        await page.evaluate(() => {
            const saved = __tmGetQuickAddDraft('template:builtin-weekly')?.template;
            __tmSaveQuickAddDraft('保留原任务草稿', { scope: '', remark: '旧备注', template: saved });
        });
        await page.evaluate(() => tmQuickAddOpen());
        assert.equal(await page.evaluate(() => !!state.quickAdd.templateInstance), false, 'reopening defaults to plain entry after a template was selected');
        assert.equal(await page.locator('#tmQuickAddInput').inputValue(), '保留原任务草稿', 'closing a template preserves the plain draft');
        const migratedDrafts = await page.evaluate(() => ({ direct:__tmGetQuickAddDraft(''), scoped:__tmGetQuickAddDraft('template:builtin-weekly') }));
        assert.equal(migratedDrafts.direct.template, null, 'legacy template selection is removed from the direct-entry draft');
        assert.equal(migratedDrafts.direct.remark, '旧备注', 'migrating a legacy template preserves the plain draft remark');
        assert.ok(migratedDrafts.scoped.template, 'legacy template state remains available only when the template is explicitly selected');

        await openTemplateManager(page);
        const manager = page.locator('.tm-task-template-manager');
        assert.equal(await manager.isVisible(), true, 'manager opens as a separate stacked surface');
        assert.equal(await page.locator('#tmQuickAddInput').count(), 1, 'the existing composer is retained while the manager opens');
        assert.equal(await page.locator('#tmQuickAddInput').inputValue(), '保留原任务草稿');
        const originalTemplateOrder = await page.evaluate(() => __tmTaskTemplateLibrary().items.map(item => item.id));
        await manager.locator('[data-template-order="down"][data-template-id="builtin-release"]').click();
        assert.deepEqual(await manager.locator('[data-template-edit]').evaluateAll(rows => rows.map(row => row.dataset.templateEdit)),
            ['builtin-article', 'builtin-release', 'builtin-weekly'], 'moving a template down changes library order');
        assert.equal(await manager.locator('[data-template-edit="builtin-release"]').getAttribute('aria-pressed'), 'true', 'moving preserves the active template');
        await manager.locator('[data-template-order="up"][data-template-id="builtin-release"]').click();
        assert.deepEqual(await page.evaluate(() => __tmTaskTemplateLibrary().items.map(item => item.id)), originalTemplateOrder, 'moving a template back restores the original order');
        const firstFold = manager.locator('.tm-task-template-fold').first();
        assert.equal(await firstFold.locator('[data-tm-lucide="caret-down"] svg').count(), 1, 'expanded parent nodes show a downward Phosphor icon');
        await firstFold.click();
        assert.equal(await manager.locator('.tm-task-template-fold').first().locator('[data-tm-lucide="chevron-right"] svg').count(), 1, 'collapsed parent nodes show a rightward icon');
        await manager.locator('[data-template-edit="builtin-article"]').click();
        await manager.locator('[data-template-name]').fill('文章发布流程');
        await page.keyboard.press('Escape');
        assert.equal(await manager.locator('[data-template-discard]').isVisible(), true, 'Escape retains the dirty manager at the top of the modal stack');
        await page.keyboard.press('Escape');
        assert.equal(await manager.isVisible(), true, 'repeated Escape does not close the underlying composer');
        await manager.locator('[data-template-keep]').click();
        await manager.locator('[data-template-node-title]').first().fill('发布《{{主题}}》');
        await manager.locator('[data-template-child]').first().click();
        await manager.locator('[data-template-node-title]').last().fill('新添加的子任务');
        assert.equal(await manager.locator('[data-template-node-title]').count(), 8);
        assert.match(await manager.locator('.tm-task-template-default-topic summary').innerText(), /\{\{主题\}\}/, 'placeholder syntax remains visible before expanding topic details');
        await manager.locator('.tm-task-template-default-topic summary').click();
        assert.match(await manager.locator('.tm-task-template-default-topic p').innerText(), /\{\{主题\}\}/, 'default topic explains the exact placeholder syntax');
        assert.match(await manager.locator('.tm-task-template-default-topic p').innerText(), /发布「\{\{主题\}\}」/, 'default topic includes an inline example');
        await manager.locator('[data-template-default-topic]').fill('文章默认主题');
        await page.evaluate(() => {
            window.templateSaves = 0;
            Object.defineProperty(SettingsStore, 'lastSaveResult', { configurable: true, get() { return window.settingsSaveResult || { ok:false }; }, set(value) { window.settingsSaveResult=value; } });
            SettingsStore.saveTaskTemplates = async function(library) {
                window.templateSaves += 1;
                this.data.taskTemplateLibrary = library;
                window.settingsSaveResult = { ok:true, taskTemplateFingerprint: JSON.stringify(this.data.taskTemplateLibrary) };
            };
        });
        await manager.locator('[data-template-save]').click();
        assert.equal(await manager.count(), 0, 'explicit save closes the manager');
        assert.equal(await page.evaluate(() => templateSaves), 1, 'saving writes the dedicated template store');
        assert.equal(await page.evaluate(() => __tmTaskTemplateLibrary().items.find(item => item.id === 'builtin-article').name), '文章发布流程');
        assert.equal(await page.locator('#tmQuickAddInput').isVisible(), true, 'saving restores the original composer');
        await chooseTemplate(page, 'builtin-article');
        assert.equal(await page.locator('[data-template-topic]').inputValue(), '文章默认主题', 'updating a template default replaces an older-revision topic draft');
        await page.locator('[data-template-topic]').fill('本次自定义主题');
        await page.locator('[data-template-plain]').click();
        await chooseTemplate(page, 'builtin-article');
        assert.equal(await page.locator('[data-template-topic]').inputValue(), '本次自定义主题', 'a same-revision topic draft is restored');
        await page.locator('[data-template-plain]').click();

        await openTemplateManager(page);
        await manager.locator('[data-template-name]').fill('保存失败也保留');
        await page.evaluate(() => {
            window.previousTemplateSave = SettingsStore.saveTaskTemplates;
            SettingsStore.saveTaskTemplates = async function() { this.lastSaveResult = { ok:false }; };
        });
        await manager.locator('[data-template-save]').click();
        assert.equal(await manager.isVisible(), true, 'failed persistence leaves the manager open');
        assert.equal(await manager.locator('[data-template-name]').inputValue(), '保存失败也保留');
        assert.equal(await manager.locator('[data-template-manager-error]').isVisible(), true);
        assert.equal(await page.evaluate(() => __tmTaskTemplateLibrary().items.find(item => item.id === 'builtin-article').name), '文章发布流程', 'failed writes restore the committed definition');
        await manager.locator('[data-template-close]').first().click();
        await manager.locator('[data-template-discard-confirm]').click();
        await page.evaluate(() => { SettingsStore.saveTaskTemplates = window.previousTemplateSave; });

        await page.evaluate(() => {
            window.templateWrites = []; window.templateFailTitle = '实现核心流程'; window.templateFailed = false;
            window.holdTemplateWrites = true; window.templateMutationStarted = false;
        });
        await page.evaluate(() => {
            window.templateBlockId = 0;
            window.Lute = { NewNodeID: () => `20261101120000-${String(++window.templateBlockId).padStart(7, '0')}` };
            SettingsStore.data.pinNewTasksByDefault = true;
            window.__tmRequireTaskMutation = name => async (...args) => {
                const payload = name === 'createTaskInDoc' ? args[0] : args[2];
                const parentId = name === 'createTaskInDoc' ? '' : args[0];
                const content = name === 'createTaskInDoc' ? payload.content : args[1];
                if (window.holdTemplateWrites) {
                    window.templateMutationStarted = true;
                    await new Promise(resolve => { window.releaseTemplateWrites = resolve; });
                }
                if (content === window.templateFailTitle && !window.templateFailed) {
                    window.templateFailed = true;
                    throw new Error('simulated one-shot failure');
                }
                window.templateWrites.push({ name, content, parentId, requestedTaskId:payload.requestedTaskId, docId:payload.docId,
                    pinned:payload.pinned ?? payload.initialPatch?.pinned,
                    completionTime:payload.completionTime ?? payload.initialPatch?.completionTime,
                    remark:name === 'createTaskInDoc' ? payload.remark : payload.initialPatch?.remark });
                return payload.requestedTaskId;
            };
        });
        await chooseTemplate(page, 'builtin-release');
        await page.evaluate(() => { state.quickAdd.completionTime = '2026-11-01'; });
        await page.locator('[data-template-topic]').fill('任务清单');
        await page.locator('#tmQuickAddSubmitBtn').click();
        assert.equal(await page.evaluate(() => state.quickAdd), null, 'submitting a template closes the composer before background writes finish');
        const creationNotices = await page.evaluate(() => notices);
        assert.ok(creationNotices.some(message => /正在后台新建|正在新建任务/.test(message)), `closing the composer shows a background creation notice: ${JSON.stringify(creationNotices)}`);
        await page.waitForFunction(() => window.templateMutationStarted);
        await page.evaluate(() => tmQuickAddOpen());
        assert.equal(await page.evaluate(() => !!state.quickAdd.templateInstance), false, 'a new composer stays in plain mode while another template runs');
        await openTemplateSubmenu(page);
        assert.equal(await page.locator('[data-quick-add-template-id="builtin-release"]').isDisabled(), true, 'the active template cannot start a duplicate job');
        await page.locator('#tmQuickAddInput').click();
        await page.locator('#tmQuickAddCloseBtn').click();
        await page.evaluate(() => { window.holdTemplateWrites = false; window.releaseTemplateWrites?.(); });
        await page.waitForFunction(() => __tmGetQuickAddDraft('template:builtin-release')?.template?.execution?.error);
        let stateAfterFailure = await page.evaluate(() => ({ quickAdd:state.quickAdd, writes:templateWrites,
            instance:__tmGetQuickAddDraft('template:builtin-release')?.template, notices }));
        if (!stateAfterFailure.instance?.execution) throw new Error(JSON.stringify(stateAfterFailure));
        let instance = stateAfterFailure.instance;
        assert.equal(instance.execution.steps.filter(step => step.status === 'done').length, 3, 'successful ancestors stay committed after a child failure');
        assert.equal(instance.execution.steps.filter(step => step.status === 'pending').length, 5, 'unsubmitted tasks remain queued in the saved plan');
        assert.match(stateAfterFailure.notices.at(-1), /已添加 3 个任务，剩余 5 个/);
        const failedNode = instance.execution.steps.find(step => step.title === '实现核心流程');
        const failedId = failedNode.requestedTaskId;
        await page.evaluate(() => tmQuickAddOpen());
        assert.equal(await page.evaluate(() => !!state.quickAdd.templateInstance), false, 'a failed background job does not force the next composer into template mode');
        await chooseTemplate(page, 'builtin-release');
        await page.locator('#tmQuickAddSubmitBtn').click();
        assert.equal(await page.evaluate(() => state.quickAdd), null, 'retry also closes the composer before continuing in the background');
        await page.waitForFunction(() => __tmGetQuickAddDraft('template:builtin-release') === null);
        const writes = await page.evaluate(() => templateWrites);
        assert.equal(writes.length, 8, 'retry creates all pending nodes');
        assert.equal(writes.find(item => item.content === '实现核心流程').requestedTaskId, failedId, 'retry keeps the original id to avoid duplicate insertion');
        assert.equal(writes.filter(item => item.content === '发布「任务清单」').length, 1, 'retry does not recreate a committed root');
        assert.ok(writes.every(item => item.pinned !== true), 'template tasks ignore the default pinned setting');
        assert.ok(writes.every(item => item.completionTime === ''), 'template tasks ignore a default completion date already initialized in quick-add');
        assert.equal(writes.find(item => item.content === '发布「任务清单」').remark, '', 'template submission does not apply the hidden ordinary remark draft');
        const idOf = title => writes.find(item => item.content === title)?.requestedTaskId;
        assert.deepEqual(writes.filter(item => item.name === 'createSubtask').map(item => item.parentId), [
            idOf('发布「任务清单」'), idOf('发布「任务清单」'), idOf('完成开发与自测'), idOf('完成开发与自测'),
            idOf('发布「任务清单」'), idOf('验收与上线'), idOf('验收与上线'),
        ], 'every subtask is assigned to its already created parent in the saved order');
        assert.equal((await page.evaluate(() => __tmGetQuickAddDraft('')))?.value, '保留原任务草稿', 'template creation retains the original direct-entry draft');
        assert.equal((await page.evaluate(() => __tmGetQuickAddDraft('')))?.remark, '旧备注', 'template creation retains the ordinary remark draft');
        assert.equal(await page.evaluate(() => __tmGetQuickAddDraft('template:builtin-release')), null, 'successful submission clears the template instance draft');
        await page.setViewportSize({ width: 390, height: 760 });
        await page.evaluate(() => tmQuickAddOpen());
        await openTemplateManager(page);
        assert.equal(await page.locator('[data-template-mobile-list]').isVisible(), true, 'narrow manager exposes the template selector');
        await page.locator('[data-template-mobile-list]').selectOption('builtin-weekly');
        assert.equal(await page.locator('[data-template-mobile-list]').inputValue(), 'builtin-weekly');
        assert.equal(await page.locator('[data-template-order-mobile="up"]').isDisabled(), false, 'mobile reorder controls follow the selected template');
        await page.locator('[data-template-order-mobile="up"]').click();
        assert.deepEqual(await manager.locator('[data-template-edit]').evaluateAll(rows => rows.map(row => row.dataset.templateEdit)),
            ['builtin-release', 'builtin-weekly', 'builtin-article'], 'mobile ordering moves the selected template one position up');
        const mobileGeometry = await page.evaluate(() => {
            const dialog = document.querySelector('.tm-task-template-manager').getBoundingClientRect();
            return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, dialog: dialog.toJSON() };
        });
        assert.ok(mobileGeometry.dialog.left >= -1 && mobileGeometry.dialog.right <= mobileGeometry.width + 1);
        assert.ok(mobileGeometry.scrollWidth <= mobileGeometry.width + 1, 'manager has no horizontal page overflow on mobile');
        await page.screenshot({ path: path.join(root, 'output/playwright/task-template-manager-mobile.png') });
        await manager.locator('[data-template-save]').click();
        assert.equal(await manager.count(), 0, 'mobile template ordering can be saved');
        assert.deepEqual(await page.evaluate(() => __tmTaskTemplateLibrary().items.map(item => item.id)),
            ['builtin-release', 'builtin-weekly', 'builtin-article'], 'saved library order persists');
        await chooseTemplate(page, 'builtin-weekly');
        for (const width of [390, 320]) {
            await page.setViewportSize({ width, height: 760 });
            await page.evaluate(() => tmQuickAddRenderMeta());
            assert.equal(await page.locator('.tm-quick-add-tools button:visible').count(), 1, `template mode keeps only the document-location control at ${width}px`);
            assert.equal(await page.locator('#tmQuickAddMoreBtn').isVisible(), false);
            assert.equal(await page.locator('#tmQuickAddRemark').isVisible(), false, `template mode hides the remark at ${width}px`);
            assert.equal(await page.locator('#tmQuickAddBatchHint').isVisible(), false);
            assert.equal(await page.locator('[data-template-plain]').isVisible(), true);
            const geometry = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
            assert.ok(geometry.scrollWidth <= geometry.width + 1, `template mode has no horizontal page overflow at ${width}px`);
            await page.screenshot({ path: path.join(root, `output/playwright/task-template-location-only-${width}.png`) });
        }
        assert.deepEqual(errors, [], 'no browser errors');
        console.log('task template browser integration passed: built-ins, editor, IME composition, location-only toolbar, persistence, nested creation, stable partial retry');
    } finally {
        await mobilePage?.close();
        await browser.close();
    }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
