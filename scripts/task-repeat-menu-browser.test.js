'use strict';

// Exercise production menus, click handlers, dialog and editor API in a browser.
// Only the host task storage and date-panel shell are replaced by a fixture.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, 'src/task-horizon/main', name), 'utf8');
const detail = read('task-runtime/52-task-detail-runtime.js');
const model = read('task-runtime/50-task-model-and-repeat-utils.js');
function section(source, from, to, offset = 0) {
    const start = source.indexOf(from, offset), end = source.indexOf(to, start + from.length);
    assert.ok(start >= 0 && end > start, from);
    return source.slice(start, end);
}
function fn(source, name) {
    const start = source.indexOf(`    function ${name}(`), end = source.indexOf('\n    }', start);
    assert.ok(start >= 0 && end > start, name);
    return source.slice(start, end + 6);
}
const customHandlers = [...detail.matchAll(/const customRepeatBtn = target\.closest\('\[data-tm-time-hub-repeat-custom\]'\);[\s\S]*?(?=const endModeBtn =)/g)].map(match => match[0]);
const positioners = [...detail.matchAll(/const positionEditorPanel = \(\) => \{[\s\S]*?panel\.style\.top = `\$\{top\}px`;\s*\};/g)].map(match => match[0]);
assert.equal(customHandlers.length, 2);
assert.equal(positioners.length, 2);
const production = [
    fn(model, '__tmNormalizeDateOnly'),
    section(model, '    function __tmParseTaskRepeatJson(', '    function __tmIsRecurringInstanceTask('),
    section(read('20-api-and-runtime-services.js'), '    const __tmModalStack = [];', '    function __tmGetTodayDateKey('),
    ...['__tmGetTaskTimeHubRepeatChoice', '__tmRenderTaskTimeHubRepeatEditorHtml', '__tmBuildTaskTimeHubRepeatPresetRule', '__tmGetTaskTimeHubViewport'].map(name => fn(detail, name)),
    section(read('30-dialogs-and-ui-foundation.js'), '    function showTaskRepeatRuleDialog(', '    function showSelectPrompt('),
    section(read('task-runtime/54-recurring-task-runtime.js'), '    window.tmEditTaskRepeatRule =', '    window.tmReviewFsrsTask ='),
].join('\n');
const baseRule = { enabled: true, type: 'weekly', trigger: 'due', every: 2, weekdays: [1, 3], anchorDate: '2026-10-19', until: '2026-12-31' };

async function setup(page, entry, theme = 'light') {
    await page.goto('about:blank');
    await page.setContent('<meta charset="utf-8"><main><h2>任务日期</h2><p>循环规则预览</p></main><div id="hub" class="tm-task-time-hub-popover"></div>');
    await page.addStyleTag({ path: path.join(root, 'task-horizon.css') });
    await page.addStyleTag({ content: `:root{--tm-text-color:${theme === 'dark' ? '#e0e3e8' : '#242834'};--tm-secondary-text:${theme === 'dark' ? '#aeb4bf' : '#687080'};--tm-card-bg:${theme === 'dark' ? '#242830' : '#f8f9fb'};--tm-primary-color:#528aa2;--tm-border-color:${theme === 'dark' ? '#464b55' : '#cfd3da'};--tm-input-bg:var(--tm-card-bg);--tm-input-border:var(--tm-border-color);--tm-modal-overlay:#151a2480;--popover:var(--tm-card-bg);--radius:8px;--background:var(--tm-card-bg);--foreground:var(--tm-text-color)}body{margin:24px;font:14px system-ui;background:${theme === 'dark' ? '#181c22' : '#edf0f4'};color:var(--tm-text-color)}#hub{left:40px;top:100px;width:286px;height:430px;min-height:0;overflow:visible;background:var(--tm-card-bg)}#hub>.tm-task-time-hub__setting{position:absolute;left:12px;bottom:12px;width:250px}*{animation:none!important}@media(max-width:640px){#hub{left:14px;right:14px;top:40px;bottom:auto;width:auto;height:360px}}` });
    await page.evaluate(({ rule, isDraft }) => {
        window.esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        window.__tmApplyPopupOpenAnimation = () => {};
        window.hint = text => { throw new Error(text); };
        window.task = { id: 'task-1', completionTime: '2026-10-19', repeatRule: rule, repeatState: { occurrenceCount: 1 } };
        window.writes = []; window.drafts = [];
        window.__tmResolveTaskForRepeat = async () => task;
        window.tmSetTaskRepeatRule = async (id, value) => { writes.push(value); task.repeatRule = value; return task; };
        window.tmClearTaskRepeatRule = async () => { throw new Error('unexpected clear'); };
        window.draftMode = isDraft;
        window.opts = {};
        window.hubState = { editor: 'repeat' };
        window.getBoundTask = () => task;
        window.getBoundTaskId = window.getEffectiveTaskId = () => task.id;
        window.getRepeatRule = () => task.repeatRule;
        window.refreshTask = async () => {};
        window.notifyChange = async () => {};
        window.syncMetaChipFaces = window.syncSerializedSnapshot = () => {};
        window.applyDraftRepeatRule = async value => { drafts.push(value); task.repeatRule = value; render(); };
    }, { rule: baseRule, isDraft: entry === 2 });
    await page.addScriptTag({ content: production });
    await page.addScriptTag({ content: `
        const popover = document.querySelector('#hub'), root = popover, taskId = task.id;
        ${positioners[entry === 1 ? 1 : 0]}
        window.render = () => {
            popover.innerHTML = '<button class="tm-task-time-hub__setting" data-tm-time-hub-card="repeat"><span class="tm-task-time-hub__setting-icon">↻</span><span class="tm-task-time-hub__setting-text"><span>循环</span><strong>自定义规则</strong></span></button>' + __tmRenderTaskTimeHubRepeatEditorHtml(task.repeatRule);
            positionEditorPanel();
        };
        popover.addEventListener('click', async ev => {
            const target = ev.target;
            ${customHandlers[entry === 1 ? 1 : 0]}
        });
        window.addEventListener('resize', positionEditorPanel);
        render();
    ` });
}

async function run() {
    const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
    const output = path.join(root, 'output/playwright');
    fs.mkdirSync(output, { recursive: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        page.setDefaultTimeout(5000);
        const errors = [];
        page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
        for (const entry of [0, 1, 2]) {
            await setup(page, entry);
            const panel = page.locator('.tm-task-time-hub__subpanel--repeat');
            assert.equal(await panel.locator('[role="group"][aria-label="自定义循环"] button').count(), 3);
            assert.equal(await panel.locator('button.is-selected').count(), 1);
            assert.equal(await panel.locator('[data-tm-time-hub-repeat-custom="due"]').getAttribute('aria-pressed'), 'true');
            assert.equal(await panel.locator('[data-tm-time-hub-repeat-custom="complete"] .tm-task-time-hub__choice-mark').count(), 0, 'unselected options have no trailing decoration');
            for (const mode of ['due', 'complete', 'checkin']) {
                const before = await page.evaluate(() => JSON.stringify(task.repeatRule));
                await panel.locator(`[data-tm-time-hub-repeat-custom="${mode}"]`).click();
                assert.equal(await page.locator('#tm-repeat-trigger-type').inputValue(), mode);
                assert.deepEqual(await page.locator('#tm-repeat-trigger-type option').evaluateAll(nodes => nodes.map(node => node.value)), ['due', 'complete', 'checkin']);
                assert.equal(await page.evaluate(() => JSON.stringify(task.repeatRule)), before, 'opening does not save the preselected mode');
                if (mode === 'due') await page.getByRole('button', { name: '取消', exact: true }).click();
                if (mode === 'complete') await page.keyboard.press('Escape');
                if (mode === 'checkin') await page.locator('.tm-repeat-modal').click({ position: { x: 2, y: 2 } });
                assert.equal(await page.locator('.tm-repeat-modal').count(), 0);
                assert.equal(await page.evaluate(() => JSON.stringify(task.repeatRule)), before, 'all cancellation paths preserve the rule');
            }
            assert.equal(await page.evaluate(() => writes.length + drafts.length), 0);
            await panel.locator('[data-tm-time-hub-repeat-custom="complete"]').click();
            await page.locator('[data-tm-repeat-field="every"]').fill('3');
            await page.getByRole('button', { name: '确定', exact: true }).click();
            await page.waitForFunction(() => task.repeatRule.trigger === 'complete');
            assert.equal(await page.evaluate(() => task.repeatRule.every), 3);
            assert.equal(await page.evaluate(() => writes.length), entry === 2 ? 0 : 1);
            assert.equal(await page.evaluate(() => drafts.length), entry === 2 ? 1 : 0);
            assert.equal(await panel.locator('[data-tm-time-hub-repeat-custom="complete"]').getAttribute('aria-pressed'), 'true');
            console.log(`PASS ${['standalone', 'detail', 'draft'][entry]} preselection, cancellation, save and selection`);
        }
        await page.evaluate(() => { task.repeatRule = { enabled: true, type: 'fsrs', trigger: 'complete', anchorDate: '2026-10-19' }; window.compatResult = tmEditTaskRepeatRule(task.id); });
        assert.equal(await page.locator('#tm-repeat-trigger-type').inputValue(), 'fsrs');
        assert.equal(await page.locator('#tm-repeat-trigger-type option').count(), 5);
        await page.getByRole('button', { name: '确定', exact: true }).click();
        await page.evaluate(() => window.compatResult);
        assert.equal(await page.evaluate(() => task.repeatRule.type), 'fsrs', 'legacy editor preserves FSRS');
        const presetResults = await page.evaluate(() => {
            const result = [];
            for (const trigger of ['due', 'complete', 'checkin']) {
                for (const type of ['daily', 'workday', 'weekly', 'monthly', 'yearly', 'lunar-monthly', 'lunar-yearly', 'fsrs']) {
                    const rule = __tmBuildTaskTimeHubRepeatPresetRule({ enabled: true, trigger, type: 'monthly', every: 5, monthlyMode: 'weekday', monthWeek: { ordinal: 2, weekday: 3 }, anchorDate: '2026-10-19' }, type, '2026-10-19');
                    result.push({ requested: type, rule, selected: __tmGetTaskTimeHubRepeatChoice(rule) });
                }
            }
            return result;
        });
        for (const { requested, rule, selected } of presetResults) {
            assert.equal(rule.trigger, requested === 'fsrs' ? 'complete' : 'due');
            assert.equal(rule.every, 1);
            assert.equal(selected, requested, 'preset label and saved rule agree');
        }
        console.log('PASS FSRS legacy editor and 24 preset transitions');
        for (const theme of ['light', 'dark']) {
            for (const viewport of [{ width: 1280, height: 900 }, { width: 720, height: 540 }, { width: 390, height: 844 }, { width: 320, height: 640 }]) {
                await page.setViewportSize(viewport);
                await setup(page, 0, theme);
                const geometry = await page.locator('.tm-task-time-hub__subpanel--repeat').evaluate(panel => {
                    const rect = panel.getBoundingClientRect();
                    const last = panel.querySelector('[data-tm-time-hub-repeat-custom="checkin"]').getBoundingClientRect();
                    return { rect: rect.toJSON(), last: last.toJSON(), viewport: { width: innerWidth, height: innerHeight } };
                });
                assert.ok(geometry.rect.left >= 0 && geometry.rect.right <= viewport.width && geometry.rect.top >= 0 && geometry.rect.bottom <= viewport.height, JSON.stringify(geometry));
                assert.ok(geometry.last.bottom <= geometry.rect.bottom, 'all three custom modes are visible without scrolling');
                await page.locator('.tm-task-time-hub__subpanel--repeat').screenshot({ path: path.join(output, `task-repeat-menu-${theme}-${viewport.width}.png`) });
                await page.locator('[data-tm-time-hub-repeat-custom="checkin"]').click();
                await page.screenshot({ path: path.join(output, `task-repeat-dialog-${theme}-${viewport.width}.png`) });
                const card = await page.locator('.tm-repeat-card').boundingBox();
                assert.ok(card.x >= 0 && card.x + card.width <= viewport.width && card.y >= 0 && card.y + card.height <= viewport.height, 'dialog fits the viewport');
                assert.equal(await page.locator('.tm-repeat-card').evaluate(card => card.scrollWidth <= card.clientWidth), true, 'dialog controls do not overflow horizontally');
                await page.keyboard.press('Escape');
            }
        }
        assert.deepEqual(errors, [], 'no browser errors');
        console.log('PASS light/dark layouts at 1280/720/390/320px, custom modes visible without scrolling');
    } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
