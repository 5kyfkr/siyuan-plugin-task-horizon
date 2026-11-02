'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('./i18n-browser-fixture');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'task-horizon.css'), 'utf8');
const detailSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/52-task-detail-runtime.js'), 'utf8');
const dialogsSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/30-dialogs-and-ui-foundation.js'), 'utf8');
const gesturesSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/30-dialogs-and-ui-foundation.js'), 'utf8');

function segment(source, startToken, endToken) {
    const start = source.indexOf(startToken);
    const end = source.indexOf(endToken, start + startToken.length);
    assert.ok(start >= 0 && end > start, `missing source segment: ${startToken}`);
    return source.slice(start, end);
}

const submenuBuilderSource = segment(
    dialogsSource,
    '    function __tmBuildTaskDetailMoreSubmenuItem(',
    '\n    function __tmCollectNestedSubtasksForReset',
);
const sheetGestureSource = segment(
    gesturesSource,
    '    function __tmStartChecklistSheetDrag(',
    '\n    function __tmStartChecklistSheetPointerDrag',
);

async function mountSubmenu(page) {
    await page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1">
        <style>${css}</style>
        <style>html,body{margin:0;padding:24px;font:14px system-ui}</style>
        <div id="menu-host" class="tm-popup-menu bc-dropdown-menu tm-multi-bulkbar__menu tm-task-detail-more-menu"></div>`);
    await page.evaluate((source) => {
        window.esc = (value) => String(value ?? '');
        window.__tmPhosphorBoldSvg = () => '<svg aria-hidden="true"></svg>';
        eval(source);
        const child = document.createElement('button');
        child.type = 'button';
        child.className = 'tm-multi-bulkbar__menu-item';
        child.textContent = '复制纯文本';
        const wrap = __tmBuildTaskDetailMoreSubmenuItem('复制', 'clipboard-list', () => [child], {
            labelHtml: '<span class="tm-multi-bulkbar__menu-icon"></span><span>复制</span>',
        });
        document.getElementById('menu-host').appendChild(wrap);
    }, submenuBuilderSource);
}

async function testSubmenuFirstTouch(page) {
    await mountSubmenu(page);
    const trigger = page.locator('.tm-task-detail-more-menu__submenu-trigger');
    const submenu = page.locator('.tm-task-detail-more-menu__submenu-menu');
    assert.equal(await submenu.isVisible(), false, 'the copy submenu must start closed');
    await trigger.tap();
    assert.equal(await submenu.isVisible(), true, 'the first touch must open the copy submenu');
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true', 'the first touch must expose the open state');
    await trigger.tap();
    assert.equal(await submenu.isVisible(), false, 'a second touch must close the copy submenu');
    console.log('task detail more submenu first touch passed');
}

async function testSubmenuDesktopHover(page) {
    await mountSubmenu(page);
    const trigger = page.locator('.tm-task-detail-more-menu__submenu-trigger');
    const submenu = page.locator('.tm-task-detail-more-menu__submenu-menu');
    const box = await trigger.boundingBox();
    assert.ok(box, 'the copy submenu trigger must be laid out');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(40);
    assert.equal(await submenu.isVisible(), true, 'mouse hover must still open the copy submenu');
    await page.mouse.move(4, 4);
    await page.waitForTimeout(180);
    assert.equal(await submenu.isVisible(), false, 'leaving mouse hover must still close the copy submenu');
    console.log('task detail more submenu desktop hover passed');
}

async function testStatusMenuScrollPriority(page, context) {
    await page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1">
        <style>${css}</style>
        <style>
        html,body{margin:0;overflow:hidden;background:#eef2f6}
        #fixture{position:fixed;inset:0}
        #tmTaskDetailSheet{height:76vh}
        #tmTaskDetailSheetPanel{height:100%;box-sizing:border-box}
        .fixture-lead{height:48px}
        .fixture-tail{height:1600px}
        .fixture-status-button{height:32px;width:140px}
        </style>
        <div id="fixture" class="tm-modal tm-modal--mobile">
            <div id="tmTaskDetailSheet" class="tm-checklist-sheet tm-checklist-sheet--open">
                <div class="tm-checklist-sheet-handle"></div>
                <div id="tmTaskDetailSheetPanel" class="tm-checklist-sheet-body tm-task-detail-sheet-body--popup-scroll">
                    <div class="fixture-lead">任务标题与属性</div>
                    <div class="tm-task-detail-status-select" style="position:relative;width:180px">
                        <button class="fixture-status-button" type="button">状态</button>
                        <div class="bc-select-menu tm-task-detail-status-menu" data-tm-detail-status-menu role="listbox" style="display:flex">
                            ${Array.from({ length: 24 }, (_, index) => `<button class="bc-select-option tm-task-detail-status-option" type="button">状态 ${index + 1}</button>`).join('')}
                        </div>
                    </div>
                    <div class="fixture-tail">任务详情其余内容</div>
                </div>
            </div>
        </div>`);
    await page.evaluate((source) => {
        const state = {
            modal: document.getElementById('fixture'),
            checklistDetailSheetOpen: true,
            checklistDetailSheetFullscreen: false,
        };
        const __tmChecklistUseSheetMode = () => true;
        const __tmIsTaskDetailNoteViewEventTarget = () => false;
        const __tmIsMobileDevice = () => true;
        const __tmSyncDetailSheetVisualState = () => {};
        const __tmChecklistSheetCanScrollY = (element) => {
            if (!(element instanceof HTMLElement)) return false;
            if (Number(element.scrollHeight || 0) - Number(element.clientHeight || 0) <= 2) return false;
            const overflowY = String(getComputedStyle(element).overflowY || '').toLowerCase();
            return /(auto|scroll|overlay)/.test(overflowY);
        };
        const __tmFindChecklistSheetGestureScroller = (target, body) => {
            let node = target instanceof Element ? target : null;
            while (node instanceof HTMLElement && node !== body) {
                if (__tmChecklistSheetCanScrollY(node)) return node;
                node = node.parentElement;
            }
            return body;
        };
        const __tmChecklistSheetScrollerTop = (element) => {
            if (!(element instanceof HTMLElement) || !__tmChecklistSheetCanScrollY(element)) return 0;
            return Math.max(0, Number(element.scrollTop || 0));
        };
        const __tmGetClientYFromPointerOrTouchEvent = (event) => {
            const direct = Number(event?.clientY);
            if (Number.isFinite(direct)) return direct;
            return Number(event?.touches?.[0]?.clientY || event?.changedTouches?.[0]?.clientY || 0);
        };
        const __tmGetClientXFromPointerOrTouchEvent = (event) => {
            const direct = Number(event?.clientX);
            if (Number.isFinite(direct)) return direct;
            return Number(event?.touches?.[0]?.clientX || event?.changedTouches?.[0]?.clientX || 0);
        };
        const __tmMeasureChecklistSheetDragTrack = () => ({ collapsedOffset: 180, closeOffset: 720, fullHeight: 720 });
        const __tmGetChecklistSheetVisualOffset = (offset) => Number(offset) || 0;
        eval(source);
        const sheet = document.getElementById('tmTaskDetailSheet');
        sheet.addEventListener('pointerdown', (event) => {
            __tmStartChecklistSheetDrag(event, 'pointer-touch', {
                skipSheetModeCheck: true,
                sheetSelector: '#tmTaskDetailSheet',
                bodySelector: '#tmTaskDetailSheetPanel',
                close: () => {},
                refresh: () => {},
                trackFullscreenDrag: true,
                allowBodySheetGesture: true,
            });
        });
        window.fixtureState = state;
    }, sheetGestureSource);

    const metrics = await page.locator('.tm-task-detail-status-menu').evaluate((menu) => {
        const panel = menu.closest('.tm-checklist-sheet-body');
        const rect = menu.getBoundingClientRect();
        return {
            x: Math.round(rect.left + rect.width / 2),
            y: Math.round(rect.top + Math.min(rect.height - 40, 180)),
            menuTouchAction: getComputedStyle(menu).touchAction,
            panelTouchAction: getComputedStyle(panel).touchAction,
        };
    });
    assert.equal(metrics.menuTouchAction, 'pan-y', 'the status picker must own vertical touch scrolling');
    assert.equal(metrics.panelTouchAction, 'pan-y', 'the collapsed detail sheet must yield while a popup can scroll');

    const session = await context.newCDPSession(page);
    try {
        await session.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: metrics.x, y: metrics.y }],
        });
        for (let step = 1; step <= 6; step++) {
            await session.send('Input.dispatchTouchEvent', {
                type: 'touchMove',
                touchPoints: [{ x: metrics.x, y: metrics.y - step * 18 }],
            });
            await page.waitForTimeout(20);
        }
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(180);
    } finally {
        await session.detach();
    }

    const result = await page.evaluate(() => {
        const menu = document.querySelector('.tm-task-detail-status-menu');
        const sheet = document.getElementById('tmTaskDetailSheet');
        return {
            menuScrollTop: menu.scrollTop,
            dragging: sheet.classList.contains('tm-checklist-sheet--dragging'),
            fullscreen: sheet.classList.contains('tm-checklist-sheet--fullscreen'),
            stateFullscreen: window.fixtureState.checklistDetailSheetFullscreen,
            transform: sheet.style.transform,
        };
    });
    assert.ok(result.menuScrollTop > 0, 'the status picker must scroll before the detail sheet');
    assert.equal(result.dragging, false, 'the detail sheet must not start its drag gesture inside the picker');
    assert.equal(result.fullscreen, false, 'the detail sheet must stay collapsed while the picker scrolls');
    assert.equal(result.stateFullscreen, false, 'the picker gesture must not promote the detail sheet to fullscreen');
    assert.equal(result.transform, '', 'the picker gesture must not move the detail sheet');
    console.log('task detail status menu scroll priority passed');
}

(async () => {
    assert.match(detailSource, /openMenu[\s\S]*?classList\.add\('tm-task-detail-sheet-body--popup-scroll'\)/,
        'opening the status picker must enable inner-scroll priority on the detail sheet');
    assert.match(detailSource, /closeMenu[\s\S]*?classList\.remove\('tm-task-detail-sheet-body--popup-scroll'\)/,
        'closing the status picker must restore the normal detail sheet gesture');
    assert.match(dialogsSource, /wrap\.addEventListener\('pointerenter'[\s\S]*?pointerType[\s\S]*?'mouse'/,
        'submenu hover must ignore touch and pen pointer entry');
    assert.doesNotMatch(submenuBuilderSource, /addEventListener\('mouseenter'/,
        'touch taps must not be treated as mouse hover');
    const browser = await chromium.launch({
        headless: true,
        executablePath: process.env.PLAYWRIGHT_EXECUTABLE || undefined,
    });
    try {
        const context = await browser.newContext({
            viewport: { width: 393, height: 851 },
            isMobile: true,
            hasTouch: true,
            userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/145.0.0.0 Mobile Safari/537.36',
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await testSubmenuFirstTouch(page);
        await testStatusMenuScrollPriority(page, context);
        assert.deepEqual(errors, [], 'mobile popup interactions must not produce browser errors');
        await context.close();
        const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
        const desktopPage = await desktopContext.newPage();
        await testSubmenuDesktopHover(desktopPage);
        await desktopContext.close();
    } finally {
        await browser.close();
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
