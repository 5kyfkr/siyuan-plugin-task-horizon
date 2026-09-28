'use strict';

// Exercise the production composer with real Chromium keyboard events.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, 'src/task-horizon/main', file), 'utf8');
const runtime = read('task-runtime/53b-task-create-and-quick-add-runtime.js');
function section(source, from, to) {
    const start = source.indexOf(from);
    const end = source.indexOf(to, start + from.length);
    assert.ok(start >= 0 && end > start, `Missing production section: ${from}`);
    return source.slice(start, end);
}
const production = [
    section(read('20-api-and-runtime-services.js'), '    const __tmModalStack = [];', '    function __tmGetTodayDateKey('),
    section(read('30-dialogs-and-ui-foundation.js'), '    function __tmNormalizeTaskInputLine(', '    function showConfirm('),
    section(runtime, '    window.tmQuickAddClose =', '    function __tmBuildQuickAddCustomFieldButtonHtml('),
    section(runtime, '    function __tmRefreshQuickAddInputLayout(', '    window.tmQuickAddOpenForDoc ='),
].join('\n');

async function setup(page) {
    await page.goto('about:blank');
    await page.setContent('<input id="outside" aria-label="Outside composer">');
    await page.evaluate(() => {
        window.state = {};
        window.SettingsStore = { data: { customStatusOptions: [] } };
        window.submissions = [];
        window.notices = [];
        window.hostShortcuts = 0;
        window.__tmEnsureSettingsLoaded = async () => { await window.settingsReady; };
        window.__tmResolveQuickAddInitialLocation = async () => ({ mode: 'doc', docId: 'doc-a' });
        window.__tmRefreshQuickAddCustomFieldScope = async () => [];
        window.__tmGetDefaultUndoneStatusId = () => 'todo';
        window.__tmResolveQuickAddDefaultCompletionTime = () => '';
        window.__tmNormalizeTaskRepeatRule = () => ({});
        window.__tmNormalizeTaskRepeatState = () => ({});
        window.__tmResolveOptimisticTaskForLocalUse = () => ({ task: {} });
        window.__tmBuildSubtaskInheritedPatch = () => ({});
        window.__tmRenderLucideIcon = () => '';
        window.__tmRenderPriorityJira = () => '<span>Priority</span>';
        for (const name of ['__tmApplyAppearanceThemeVars', '__tmApplyPopupOpenAnimation',
            '__tmSaveQuickAddDraft', 'showSettings', 'tmQuickAddOpenDocPicker',
            'tmQuickAddOpenDatePicker', 'tmQuickAddOpenPriorityPicker', 'tmQuickAddOpenStatusPicker']) {
            window[name] = () => {};
        }
        window.hint = message => notices.push(message);
        window.tmQuickAddSubmit = () => submissions.push({
            title: document.getElementById('tmQuickAddInput').value,
            remark: document.getElementById('tmQuickAddRemark').value,
        });
        window.addEventListener('keydown', event => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) hostShortcuts++;
        });
    });
    await page.addScriptTag({ content: production });
    await page.evaluate(() => tmQuickAddOpen());
    assert.deepEqual(await page.evaluate(() => notices), [], 'composer opens successfully');
}

(async () => {
    const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || undefined });
    const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await setup(page);
        const title = page.locator('#tmQuickAddInput');
        const remark = page.locator('#tmQuickAddRemark');
        await title.fill('Task');
        await remark.fill('Note');
        for (const modifier of ['Meta', 'Control']) {
            for (const selector of ['#tmQuickAddInput', '#tmQuickAddRemark', '#tmQuickAddPriorityBtn', '#tmQuickAddStatusBtn', '#tmQuickAddSubmitBtn']) {
                const before = await page.evaluate(() => submissions.length);
                await page.locator(selector).press(`${modifier}+Enter`);
                assert.equal(await page.evaluate(() => submissions.length), before + 1,
                    `${modifier}+Enter submits exactly once with focus on ${selector}`);
                assert.deepEqual(await page.evaluate(() => submissions.at(-1)), { title: 'Task', remark: 'Note' });
            }
        }
        assert.equal(await page.evaluate(() => hostShortcuts), 0, 'handled submission does not reach host shortcuts');
        console.log('PASS Command/Ctrl+Enter from title, remark, toolbar and submit button');

        for (const field of [title, remark]) {
            await field.fill('First');
            await field.press('End');
            const before = await page.evaluate(() => submissions.length);
            await field.press('Enter');
            await field.press('Shift+Enter');
            assert.equal(await field.inputValue(), 'First\n\n', 'plain and Shift+Enter retain newlines');
            for (const modifiers of [{ metaKey: true }, { ctrlKey: true }]) {
                for (const ime of [{ isComposing: true }, { keyCode: 229 }]) {
                    await field.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true, ...modifiers, ...ime });
                }
            }
            assert.equal(await page.evaluate(() => submissions.length), before, 'IME Enter never submits');
        }
        console.log('PASS multiline input and IME confirmation remain unchanged');

        let guardedCount = await page.evaluate(() => submissions.length);
        await title.fill('');
        await title.press('Meta+Enter');
        assert.equal(await page.evaluate(() => submissions.length), guardedCount, 'empty composer cannot submit');
        await title.fill('Held key');
        await title.dispatchEvent('keydown', { key: 'Enter', metaKey: true, repeat: true });
        assert.equal(await page.evaluate(() => submissions.length), guardedCount, 'key repeat does not submit again');
        await page.locator('#outside').press('Meta+Enter');
        assert.equal(await page.evaluate(() => submissions.length), guardedCount, 'shortcut is scoped to the composer');
        await page.evaluate(() => {
            window.settingsReady = new Promise(resolve => { window.finishSettings = resolve; });
            window.opening = tmQuickAddOpen();
        });
        await title.fill('Task entered while loading');
        await title.press('Meta+Enter');
        assert.equal(await page.evaluate(() => submissions.length), guardedCount, 'loading composer cannot submit');
        await page.evaluate(async () => { finishSettings(); await opening; window.settingsReady = null; });
        await title.press('Meta+Enter');
        assert.equal(await page.evaluate(() => submissions.length), guardedCount + 1, 'shortcut works after initialization');
        console.log('PASS empty/loading guards, key repeat and unrelated input isolation');

        for (const relation of ['', 'subtask', 'sibling']) {
            await page.evaluate(relation => tmQuickAddOpen({ relation, sourceTaskId: 'source', docId: 'doc-a' }), relation);
            await title.fill('Reopened task');
            const before = await page.evaluate(() => submissions.length);
            await title.press('Meta+Enter');
            assert.equal(await page.evaluate(() => submissions.length), before + 1, `${relation || 'regular'} composer has no duplicate handler`);
        }
        await page.evaluate(() => tmQuickAddClose());
        const before = await page.evaluate(() => submissions.length);
        await page.locator('#outside').press('Meta+Enter');
        assert.equal(await page.evaluate(() => submissions.length), before, 'closed composer does not submit');
        assert.deepEqual(errors, [], 'no browser errors');
        console.log('PASS regular/subtask/sibling reopening and close cleanup');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
