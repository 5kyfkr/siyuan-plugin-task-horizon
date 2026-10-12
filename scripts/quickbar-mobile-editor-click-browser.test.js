'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'quickbar.js'), 'utf8');

function segment(startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start + startMarker.length);
    assert.ok(start >= 0 && end > start, startMarker);
    return source.slice(start, end);
}

const deviceRuntime = segment('    function getSiyuanRuntimeBackend()', '    function isAiFeatureEnabled()');
const triggerRuntime = segment('        let lastTriggerTime = 0;', '        function isQuickbarEnabled()');

async function checkClicks(browser, platform) {
    const mobile = platform !== 'desktop';
    const context = await browser.newContext({
        viewport: mobile ? { width: 390, height: 780 } : { width: 1280, height: 800 },
        isMobile: mobile,
        hasTouch: mobile,
    });
    try {
        const page = await context.newPage();
        await page.setContent(`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1">
            <style>[contenteditable="true"]{padding:24px;margin:12px;border:1px solid #ccc}button{padding:12px}
                .protyle-action--task{display:inline-block;width:24px;height:24px;margin:12px}
                .protyle-action--task svg{width:24px;height:24px}</style>
            <svg style="display:none"><symbol id="iconUncheck" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20"/></symbol></svg>
            <div class="protyle-wysiwyg">
                <div class="task li" data-node-id="task-1" data-type="NodeListItem" data-subtype="t" data-task=" ">
                    <div class="protyle-action protyle-action--task" contenteditable="false"><svg><use href="#iconUncheck"/></svg></div>
                    <div class="task-text" contenteditable="true">Task text</div>
                    <input type="checkbox" aria-label="Task checkbox">
                </div>
            </div>
            <div class="ordinary" contenteditable="true">Ordinary text</div>
            <div class="floatbar" style="display:none"><button>Quickbar control</button></div>
            <div class="select-menu"></div><div class="input-editor"></div>`);
        await page.evaluate(({ platform, deviceRuntime, triggerRuntime }) => {
            window.__taskHorizonFrontend = platform === 'browser-mobile' ? platform : platform === 'desktop' ? 'desktop' : 'mobile';
            window.siyuan = { config: { system: { container: platform } } };
            window.quickbarOpens = 0;
            window.keyboardRequests = 0;
            window.checkboxToggles = 0;
            const showKeyboard = () => { window.keyboardRequests += 1; };
            if (platform === 'android') window.JSAndroid = { showKeyboard };
            if (platform === 'harmony') window.JSHarmony = { showKeyboard };

            const factory = new Function(`
                const floatBar = document.querySelector('.floatbar');
                const selectMenu = document.querySelector('.select-menu');
                const inputEditor = document.querySelector('.input-editor');
                const inlineMetaInteractUntil = 0;
                const isQuickbarNativeEditorSurface = () => false;
                const isQuickbarInteractionTarget = () => false;
                const noteQuickbarActivity = () => {};
                const shouldSuppressFloatBarForTarget = () => false;
                const getTaskBlockElementFromTarget = target => target.closest('.task');
                const showFloatBar = () => { window.quickbarOpens += 1; floatBar.style.display = 'block'; };
                const hideFloatBar = () => { floatBar.style.display = 'none'; };
                ${deviceRuntime}
                ${triggerRuntime}
                return handleTrigger;
            `);
            document.addEventListener('click', factory(), true);

            // SiYuan toggles native task markers from the editor's click listener.
            document.querySelector('.protyle-wysiwyg').addEventListener('click', event => {
                const action = event.target.closest('.protyle-action--task');
                if (!action) return;
                const task = action.closest('.task');
                task.dataset.task = task.dataset.task === ' ' ? 'x' : ' ';
                window.checkboxToggles += 1;
                event.preventDefault();
                event.stopPropagation();
            });

            // SiYuan mobile requests the keyboard from its window click listener.
            window.addEventListener('click', event => {
                if (!event.target.closest('[contenteditable="true"]')) return;
                if (window.JSAndroid) window.JSAndroid.showKeyboard();
                else if (window.JSHarmony) window.JSHarmony.showKeyboard();
                else showKeyboard();
            });
        }, { platform, deviceRuntime, triggerRuntime });

        const taskAction = page.locator('.protyle-action--task use');
        for (const marker of ['x', ' ']) {
            if (mobile) await taskAction.tap();
            else await taskAction.click();
            assert.equal(await page.locator('.task').getAttribute('data-task'), marker,
                `${platform}: native task checkbox toggles to ${JSON.stringify(marker)}`);
            assert.equal(await page.evaluate(() => window.quickbarOpens), 0,
                `${platform}: task checkbox does not open quickbar`);
            assert.equal(await page.evaluate(() => window.keyboardRequests), 0,
                `${platform}: task checkbox does not request the document keyboard`);
        }
        assert.equal(await page.evaluate(() => window.checkboxToggles), 2, `${platform}: native task toggles exactly once per click`);

        const inputCheckbox = page.getByRole('checkbox', { name: 'Task checkbox' });
        for (const checked of [true, false]) {
            if (mobile) await inputCheckbox.tap();
            else await inputCheckbox.click();
            assert.equal(await inputCheckbox.isChecked(), checked, `${platform}: HTML checkbox toggles normally`);
            assert.equal(await page.evaluate(() => window.quickbarOpens), 0,
                `${platform}: HTML checkbox does not open quickbar`);
        }

        await page.waitForTimeout(90);
        if (mobile) await page.locator('.task-text').tap();
        else await page.locator('.task-text').click();
        assert.equal(await page.evaluate(() => window.quickbarOpens), 1, `${platform}: task click opens quickbar`);
        assert.equal(await page.evaluate(() => window.keyboardRequests), mobile ? 1 : 0,
            `${platform}: mobile task click reaches the host keyboard listener`);
        assert.equal(await page.evaluate(() => document.activeElement.matches('.task-text')), true,
            `${platform}: task editor retains focus`);

        await page.waitForTimeout(90);
        await page.locator('.floatbar button').click();
        assert.equal(await page.evaluate(() => window.quickbarOpens), 1, `${platform}: quickbar control does not reopen the bar`);
        assert.equal(await page.evaluate(() => window.keyboardRequests), mobile ? 1 : 0,
            `${platform}: quickbar control does not request the document keyboard`);

        await page.waitForTimeout(90);
        if (mobile) await page.locator('.ordinary').tap();
        else await page.locator('.ordinary').click();
        assert.equal(await page.evaluate(() => window.keyboardRequests), mobile ? 2 : 1,
            `${platform}: ordinary editor click reaches the host keyboard listener`);
        assert.equal(await page.evaluate(() => window.quickbarOpens), 1, `${platform}: ordinary block does not open quickbar`);
        assert.equal(await page.locator('.floatbar').isVisible(), false, `${platform}: ordinary block hides quickbar`);
        console.log(`quickbar editor click ${platform}: passed`);
    } finally {
        await context.close();
    }
}

async function run() {
    const browser = await chromium.launch({ headless: true,
        ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
    try {
        for (const platform of ['android', 'harmony', 'browser-mobile', 'desktop']) {
            await checkClicks(browser, platform);
        }
    } finally {
        await browser.close();
    }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
