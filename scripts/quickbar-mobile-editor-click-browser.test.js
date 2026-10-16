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
const nativeInteractionRuntime = segment('    function isQuickbarNativeInteractionTarget(', '    function shouldPreserveQuickbarNativeEditorDOM(');
const inlinePointerRuntime = segment('    const __tmQBResolveInlineMetaPointerTarget =', '    const __tmQBOnInlineMetaPointerdownCapture =');
const nativeCases = [
    ['web-link', '<span data-type="a" data-href="https://example.com">Web link</span>'],
    ['formatted-link', '<span data-type="strong a em" data-href="https://example.com"><b>Formatted link</b></span>'],
    ['block-link', '<span data-type="a" data-href="siyuan://blocks/20261016120000-abcdefg">Block link</span>'],
    ['asset-link', '<span data-type="a" data-href="assets/example.pdf">Asset link</span>'],
    ['html-link', '<a href="https://example.com"><b>HTML link</b></a>'],
    ['dynamic-ref', '<span data-type="block-ref" data-subtype="d" data-id="20261016120000-abcdefg">Dynamic reference</span>'],
    ['static-ref', '<span data-type="block-ref" data-subtype="s" data-id="20261016120000-abcdefg">Static reference</span>'],
    ['formatted-ref', '<span data-type="strong block-ref em" data-id="20261016120000-abcdefg"><b>Formatted reference</b></span>'],
    ['virtual-ref', '<span data-type="strong virtual-block-ref"><b>Virtual reference</b></span>'],
    ['annotation-ref', '<span data-type="strong file-annotation-ref" data-id="assets/example.pdf/annotation"><b>PDF reference</b></span>'],
    ['tag', '<span data-type="strong tag"><b>Tag</b></span>'],
    ['memo', '<span data-type="strong inline-memo" data-inline-memo-content="Memo"><b>Inline memo</b></span>'],
    ['math', '<span data-type="inline-math" data-subtype="math"><span>Rendered math</span></span>'],
    ['native-action', '<span class="protyle-action protyle-action__reload"><svg width="24" height="24"><use href="#iconUncheck"/></svg></span>'],
    ['native-attribute', '<span class="protyle-attr"><span class="protyle-attr--refcount">2 references</span></span>'],
    ['open-float', '<span data-action="openFloat" data-id="20261016120000-abcdefg"><b>Open float</b></span>'],
    ['image', '<span class="img"><img width="24" height="24" alt="Image" src="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27/%3E"></span>'],
    ['button', '<button type="button">Native button</button>'],
    ['text-input', '<input aria-label="Native input" value="Native input">'],
];

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
                    <div class="native-content" contenteditable="true">${nativeCases.map(([id, html]) =>
                        `<div data-native-case="${id}">${html}</div>`).join('')}</div>
                </div>
            </div>
            <div class="ordinary" contenteditable="true">Ordinary text</div>
            <div class="floatbar sy-custom-props-floatbar" style="display:none"><button>Quickbar control</button></div>
            <div class="select-menu sy-custom-props-floatbar__select"></div><div class="input-editor sy-custom-props-floatbar__input-editor"></div>`);
        await page.evaluate(({ platform, deviceRuntime, triggerRuntime, nativeInteractionRuntime }) => {
            window.__taskHorizonFrontend = platform === 'browser-mobile' ? platform : platform === 'desktop' ? 'desktop' : 'mobile';
            window.siyuan = { config: { system: { container: platform } } };
            window.quickbarOpens = 0;
            window.keyboardRequests = 0;
            window.checkboxToggles = 0;
            window.nativeClicks = [];
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
                ${nativeInteractionRuntime}
                ${deviceRuntime}
                ${triggerRuntime}
                return handleTrigger;
            `);
            document.addEventListener('click', factory(), true);

            // SiYuan toggles native task markers from the editor's click listener.
            document.querySelector('.protyle-wysiwyg').addEventListener('click', event => {
                const nativeCase = event.target.closest('[data-native-case]');
                if (nativeCase) {
                    window.nativeClicks.push({ id: nativeCase.dataset.nativeCase, prevented: event.defaultPrevented,
                        ctrl: event.ctrlKey, meta: event.metaKey, shift: event.shiftKey, alt: event.altKey });
                    event.preventDefault();
                    return;
                }
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
                if (event.target.closest('[data-native-case]')) return;
                if (!event.target.closest('[contenteditable="true"]')) return;
                if (window.JSAndroid) window.JSAndroid.showKeyboard();
                else if (window.JSHarmony) window.JSHarmony.showKeyboard();
                else showKeyboard();
            });
        }, { platform, deviceRuntime, triggerRuntime, nativeInteractionRuntime });

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

        const opensBeforeNativeClicks = await page.evaluate(() => window.quickbarOpens);
        for (const [id] of nativeCases) {
            await page.evaluate(() => { document.querySelector('.floatbar').style.display = 'block'; });
            await page.waitForTimeout(90);
            const target = page.locator(`[data-native-case="${id}"] > :first-child`).locator('b, use, img, .protyle-attr--refcount, span').last();
            const clickable = await target.count() ? target : page.locator(`[data-native-case="${id}"] > :first-child`);
            if (mobile) await clickable.tap();
            else await clickable.click();
            assert.deepEqual(await page.evaluate(() => window.nativeClicks.at(-1)),
                { id, prevented: false, ctrl: false, meta: false, shift: false, alt: false },
                `${platform}: ${id} reaches SiYuan without cancellation`);
            assert.equal(await page.evaluate(() => window.quickbarOpens), opensBeforeNativeClicks,
                `${platform}: ${id} must not open quickbar`);
            assert.equal(await page.locator('.floatbar').isVisible(), false,
                `${platform}: ${id} hides the previous quickbar`);
        }
        assert.equal(await page.evaluate(() => window.nativeClicks.length), nativeCases.length,
            `${platform}: native handlers run exactly once per click`);

        // Keep split-pane and background-open modifiers intact, even during debounce.
        for (const modifier of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey']) {
            await page.evaluate(modifier => {
                document.querySelector('.floatbar').style.display = 'block';
                document.querySelector('[data-native-case="formatted-ref"] b').dispatchEvent(
                    new MouseEvent('click', { bubbles: true, cancelable: true, [modifier]: true }));
            }, modifier);
            const click = await page.evaluate(() => window.nativeClicks.at(-1));
            assert.equal(click[{ ctrlKey: 'ctrl', metaKey: 'meta', shiftKey: 'shift', altKey: 'alt' }[modifier]], true,
                `${platform}: reference keeps ${modifier}`);
            assert.equal(await page.locator('.floatbar').isVisible(), false,
                `${platform}: modified references bypass quickbar debounce`);
        }

        await page.waitForTimeout(90);
        if (mobile) await page.locator('.ordinary').tap();
        else await page.locator('.ordinary').click();
        assert.equal(await page.evaluate(() => window.keyboardRequests), mobile ? 2 : 1,
            `${platform}: ordinary editor click reaches the host keyboard listener`);
        assert.equal(await page.evaluate(() => window.quickbarOpens), 1, `${platform}: ordinary block does not open quickbar`);
        assert.equal(await page.locator('.floatbar').isVisible(), false, `${platform}: ordinary block hides quickbar`);

        const pointerChecks = await page.evaluate(({ nativeInteractionRuntime, inlinePointerRuntime }) => {
            const resolve = new Function(`
                const isQuickbarNativeEditorSurface = () => false;
                ${nativeInteractionRuntime}
                ${inlinePointerRuntime}
                return __tmQBResolveInlineMetaPointerTarget;
            `)();
            const parent = document.querySelector('.native-content');
            parent.classList.add('sy-custom-props-inline-parent');
            const attr = document.createElement('div');
            attr.className = 'protyle-attr';
            attr.innerHTML = '<span class="sy-custom-props-inline-host is-ready" data-inline-placement="in-block"><span class="sy-custom-props-inline-chip"><svg><use href="#iconUncheck"/></svg></span></span>';
            parent.appendChild(attr);
            const chip = attr.querySelector('.sy-custom-props-inline-chip');
            chip.getBoundingClientRect = () => ({ left: 10, right: 50, top: 10, bottom: 50, width: 40, height: 40 });
            const event = target => ({ target, clientX: 20, clientY: 20 });
            return {
                nativeTargets: [...parent.querySelectorAll('[data-native-case] *')]
                    .every(target => resolve(event(target)) === null),
                textNode: resolve(event(parent.querySelector('[data-native-case="dynamic-ref"] span').firstChild)) === null,
                chip: resolve(event(chip.querySelector('use')))?.chip === chip,
                fallback: resolve(event(parent))?.chip === chip,
            };
        }, { nativeInteractionRuntime, inlinePointerRuntime });
        assert.deepEqual(pointerChecks, { nativeTargets: true, textNode: true, chip: true, fallback: true },
            `${platform}: native targets take priority over overlapping inline chips; quickbar chips remain usable`);
        console.log(`quickbar editor click ${platform}: passed`);
    } finally {
        await context.close();
    }
}

async function run() {
    const browser = await chromium.launch({ headless: true,
        ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
    try {
        for (const platform of ['desktop', 'android', 'harmony', 'browser-mobile']) {
            await checkClicks(browser, platform);
        }
    } finally {
        await browser.close();
    }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
