'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const api = read('src/task-horizon/main/20-api-and-runtime-services.js');
const foundation = read('src/task-horizon/main/30-dialogs-and-ui-foundation.js');
const repeatModel = read('src/task-horizon/main/task-runtime/50-task-model-and-repeat-utils.js');
function segment(source, from, to) {
    const start = source.indexOf(from), end = source.indexOf(to, start);
    assert.ok(start >= 0 && end > start, 'missing runtime segment: ' + from);
    return source.slice(start, end);
}

const runtime = `
    const state = { semanticDateAutoApplying: false, semanticDateConfirmModal: null };
    const SettingsStore = { data: { semanticDateDefaultReminderTime: '08:00' } };
    const Storage = { get: (key, fallback) => fallback };
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const __tmEscAttr = esc;
    const __tmNormalizeDateOnly = value => value instanceof Date ? value.getFullYear() + '-' + String(value.getMonth()+1).padStart(2,'0') + '-' + String(value.getDate()).padStart(2,'0') : String(value || '').slice(0,10);
    const API = { getTaskTitlePresentation: content => ({ text: content, html: esc(content) }) };
    const test = window.semanticTest = { submissions: [], hints: [], marked: [], fail: false, delay: false, host: null };
    const __tmCollectBusyTaskDetailRoots = () => test.detailRoots || [];
    const __tmGetMountRoot = () => test.host;
    const __tmModalStackBind = callback => { test.close = callback; return () => { test.close = null; }; };
    const __tmIsPluginVisibleNow = () => test.visible !== false;
    const __TM_SEMANTIC_DATE_AUTO_PROMPT_BATCH_SIZE = 2;
    const hint = (message, variant) => test.hints.push({ message, variant });
    globalThis.__tmTaskBoundary = { getTask: id => ({ docName: id === 'unsafe' ? '<img src=x onerror=alert(1)>' : '项目 / 本周安排' }) };
    async function __tmApplySemanticDateSuggestions(items) {
        test.submissions.push(items.map(item => ({ taskId: item.taskId, selectedWriteIds: item.selectedWriteIds })));
        if (test.delay) await new Promise(resolve => { test.resolve = resolve; });
        if (test.fail) throw new Error('模拟保存失败');
        const count = id => items.filter(item => item.selectedWriteIds.includes(id)).length;
        return { startApplied: count('startDate'), completionApplied: count('completionTime') + count('repeatRule'), repeatApplied: count('repeatRule'),
            calendarApplied: count('calendarSchedule'), reminderApplied: count('reminder'), failures: [], appliedItems: items };
    }
    ${segment(repeatModel, '    function __tmParseTaskRepeatJson', '    function __tmGetTaskRepeatWeekdayLabel')}
    ${segment(api, '    function __tmSemanticPad2', '    async function __tmCollectSemanticDateSuggestions')}
    ${segment(api, '    function __tmGetSemanticSuggestionWrites', '    function __tmGetSemanticSelectedWriteIds')}
    ${segment(api, '    function __tmCloseSemanticDateConfirmModal', '    function __tmPrepareTaskForSemanticScan')}
    ${segment(foundation, '    function __tmNormalizeLucideIconName', '    function __tmGetHeadingLevelIconName')}
    ${segment(api, '    function __tmShowSemanticDateConfirmModal', '    async function __tmMaybeAutoPromptSemanticDates')}
    __tmMarkSemanticDateSuggestionsRecognized = items => test.marked.push(items.map(item => item.taskId));
    test.items = () => [
        ['deadline', '明天交付项目初稿', ''],
        ['range', '明天开始，周五交付设计稿', ''],
        ['calendar', '10月28日16点与设计师评审方案', ''],
        ['reminder', '明天9点提醒我寄快递', ''],
        ['start', '明天开始整理资料', ''],
        ['existing', '明天9点提醒我检查合同', '2026-10-24 18:00'],
    ].map(([id, content, completionTime]) => {
        const item = __tmExtractSemanticTaskDateSuggestion({ id, content, completionTime, startDate: '' }, new Date(2026, 9, 24, 10));
        item.writes = __tmSemanticBuildSuggestionWrites(item, { hasCalendarModule: true });
        return item;
    });
    test.open = (options = {}) => {
        test.submissions = []; test.hints = []; test.marked = [];
        test.fail = !!options.fail; test.delay = !!options.delay;
        const mount = document.getElementById('manager');
        document.querySelector('[data-semantic-detail-fixture]')?.remove();
        test.detailRoots = [];
        mount.hidden = !options.host || !!options.hiddenManager;
        test.visible = !options.hiddenManager;
        mount.style.width = options.width ? options.width + 'px' : '';
        mount.className = options.host === 'fullscreen' ? 'tm-modal tm-modal--whiteboard-fullscreen' : '';
        mount.dataset.tmHostMode = options.host === 'dock' ? 'dock' : 'tab';
        test.host = options.host ? mount : null;
        state.modal = test.host;
        if (options.detail) {
            const detail = document.createElement('div');
            detail.id = options.detail === 'sidebar' ? 'tmChecklistDetailPanel' : 'tm-task-detail-overlay';
            detail.className = options.detail === 'sidebar' ? 'tm-kanban-detail-float' : 'tm-task-detail-overlay';
            detail.dataset.semanticDetailFixture = 'true';
            detail.innerHTML = '<textarea aria-label="detail title"></textarea><button type="button">outside input</button><div contenteditable="true"><span>editable text</span></div>';
            document.body.appendChild(detail);
            test.detailRoots = [{ scope: options.detail === 'sidebar' ? 'checklist' : 'overlay', root: detail }];
        }
        const items = test.items();
        if (options.repeat || options.bare) {
            const item = __tmExtractSemanticTaskDateSuggestion({ id: 'meal', content: options.repeat ? '每天8点吃饭' : '8点吃饭' }, new Date(2026, 9, 24, 16));
            item.writes = __tmSemanticBuildSuggestionWrites(item, { hasCalendarModule: true });
            items.splice(0, items.length, item);
        }
        if (options.long) {
            items[0].content = '跨年度的长任务标题'.repeat(16);
            items[0].writes[0].value = (new Date().getFullYear() + 1) + '-01-15';
        }
        if (options.unsafe) {
            items[0].taskId = 'unsafe';
            items[0].content = '<img src=x onerror=alert(1)>';
            items[0].writes[0].value = '"><img src=x onerror=alert(1)>';
        }
        const list = options.many ? Array.from({ length: 30 }, (_, index) => ({ ...items[index % items.length], taskId: 'long-' + index })) : items;
        __tmShowSemanticDateConfirmModal(options.batch ? list.slice(0, 2) : list,
            options.batch ? { batchIndex: 1, batchCount: 3, totalCount: 6, remainingItems: list.slice(2) } : {});
    };
    document.addEventListener('keydown', event => { if (event.key === 'Escape') test.close?.(); });
    test.shouldDefer = () => __tmShouldDeferSemanticDatePrompt();
    test.open();
`;

const nativeStyles = `body{margin:0;font:14px/1.5 system-ui;background:#edf0f3}
    #manager{position:fixed;inset:24px;box-sizing:border-box;border:1px solid #aaa;background:var(--tm-bg-color)}
    #manager[hidden]{display:none}
    .manager-label{padding:12px;color:var(--tm-text-color)}`;
const server = http.createServer((request, response) => {
    if (request.url === '/runtime.js') { response.setHeader('content-type', 'text/javascript'); response.end(runtime); return; }
    if (request.url.endsWith('.css')) {
        response.setHeader('content-type', 'text/css');
        response.end(read(request.url === '/basecoat.css' ? 'src/basecoat/basecoat.css' : 'task-horizon.css'));
        return;
    }
    response.setHeader('content-type', 'text/html; charset=utf-8');
    response.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>${nativeStyles}</style><link rel="stylesheet" href="/task.css"><link rel="stylesheet" href="/basecoat.css"></head><body><div id="manager" hidden><div class="manager-label">任务管理器</div></div><script src="/runtime.js"></script></body></html>`);
});

(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser = await chromium.launch({ headless: true,
            ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('http://127.0.0.1:' + server.address().port);
        assert.deepEqual(errors, []);
        const modal = page.locator('.tm-semantic-date-confirm-modal');
        const open = options => page.evaluate(options => semanticTest.open(options), options || {});
        const input = (index, id) => modal.locator('input[data-tm-semantic-index="' + index + '"][data-tm-semantic-write-id="' + id + '"]');
        const action = name => modal.locator('[data-tm-semantic-action="' + name + '"]');
        const clear = () => action('clear-all').click();
        const submit = async () => { await action('apply').click(); await page.waitForFunction(() => semanticTest.submissions.length > 0); return page.evaluate(() => semanticTest.submissions[0]); };
        assert.equal(await modal.getByText('确认语义识别结果', { exact: true }).count(), 1);
        assert.equal(await modal.getByRole('button', { name: '忽略', exact: true }).count(), 1);
        assert.equal(await modal.getByRole('button', { name: '取消', exact: true }).count(), 0);
        assert.equal(await modal.locator('.tm-semantic-date-confirm-task').count(), 6);
        assert.equal(await modal.locator('input:checked').count(), 9);
        assert.equal(await modal.locator('.tm-semantic-date-confirm-write-icon').count(), 11);
        assert.equal(await modal.locator('.tm-semantic-date-confirm-task').first().evaluate(element => element.offsetHeight), 64);
        assert.equal(await input(0, 'reminder').isChecked(), false);
        assert.equal(await input(3, 'reminder').isChecked(), true);
        assert.equal(await input(5, 'completionTime').count(), 0, 'existing dates must not gain a new write option');
        await input(0, 'completionTime').focus(); await page.keyboard.press('Space');
        assert.equal(await input(0, 'completionTime').isChecked(), false);
        assert.equal(await input(0, 'completionTime').evaluate(element => getComputedStyle(element.parentElement).outlineWidth), '2px');
        await action('select-all').click(); assert.equal(await modal.locator('input:checked').count(), 11);
        await clear(); await action('apply').click();
        assert.equal(await modal.count(), 1, 'empty selection must preserve the existing warning path');
        assert.equal(await page.evaluate(() => semanticTest.hints.at(-1).variant), 'warning');
        for (const [index, id, taskId] of [[1, 'startDate', 'range'], [1, 'completionTime', 'range'], [2, 'calendarSchedule', 'calendar'], [3, 'reminder', 'reminder']]) {
            await open(); await clear(); await input(index, id).locator('..').click();
            assert.deepEqual(await submit(), [{ taskId, selectedWriteIds: [id] }]);
        }
        await open(); await input(3, 'completionTime').locator('..').click();
        assert.equal(await input(3, 'reminder').isChecked(), true, 'unselecting the deadline must not change the reminder');
        assert.equal(await input(3, 'reminder').isEnabled(), true);
        await open();
        assert.deepEqual(await submit(), [
            { taskId: 'deadline', selectedWriteIds: ['completionTime'] },
            { taskId: 'range', selectedWriteIds: ['startDate', 'completionTime'] },
            { taskId: 'calendar', selectedWriteIds: ['completionTime', 'calendarSchedule'] },
            { taskId: 'reminder', selectedWriteIds: ['completionTime', 'reminder'] },
            { taskId: 'start', selectedWriteIds: ['startDate'] },
            { taskId: 'existing', selectedWriteIds: ['reminder'] },
        ]);
        await open({ bare: true });
        assert.equal(await input(0, 'completionTime').isChecked(), true);
        assert.equal(await input(0, 'calendarSchedule').isChecked(), true);
        await open({ repeat: true });
        assert.equal(await input(0, 'repeatRule').isChecked(), true);
        assert.equal(await input(0, 'reminder').isChecked(), false);
        assert.equal(await input(0, 'reminder').isEnabled(), true);
        await input(0, 'reminder').locator('..').click();
        assert.equal(await input(0, 'reminder').isChecked(), true);
        assert.equal(await input(0, 'calendarSchedule').count(), 0);
        await input(0, 'repeatRule').locator('..').click();
        assert.equal(await input(0, 'reminder').isChecked(), false);
        assert.equal(await input(0, 'reminder').isDisabled(), true);
        await action('select-all').click();
        assert.equal(await input(0, 'reminder').isEnabled(), true);
        assert.deepEqual(await submit(), [{ taskId: 'meal', selectedWriteIds: ['repeatRule', 'reminder'] }]);
        await open({ delay: true }); await action('apply').click();
        assert.equal(await action('apply').isDisabled(), true);
        assert.equal(await page.evaluate(() => semanticTest.submissions.length), 1);
        await page.evaluate(() => semanticTest.resolve()); await page.waitForFunction(() => !document.querySelector('.tm-semantic-date-confirm-modal'));
        await open({ fail: true }); await action('apply').click();
        await page.waitForFunction(() => semanticTest.hints.some(item => item.variant === 'error'));
        assert.equal(await action('apply').isEnabled(), true);
        await open({ batch: true }); await action('apply').click();
        await page.waitForFunction(() => document.querySelector('.tm-semantic-date-confirm-batch')?.textContent.includes('2 / 3'));
        assert.equal(await modal.locator('.tm-semantic-date-confirm-task').count(), 2);
        await action('close').first().click(); assert.equal(await modal.count(), 0);
        assert.equal(await page.evaluate(() => semanticTest.submissions.length), 1, 'cancelling must not apply subsequent batches');
        await open({ unsafe: true });
        assert.equal(await modal.locator('img').count(), 0, 'titles, cached document names and write values remain escaped');
        await open({ host: 'tab', hiddenManager: true });
        assert.equal(await modal.evaluate(element => element.parentElement === document.body), true, 'standalone recognition must not mount inside a hidden manager');
        for (const host of ['tab', 'fullscreen']) {
            await open({ host, detail: 'sidebar' });
            assert.equal(await modal.evaluate(element => element.parentElement === document.body), true, 'confirmation must escape the manager stacking context when a detail is present');
            const layers = await page.evaluate(() => ({
                confirm: Number(getComputedStyle(document.querySelector('.tm-semantic-date-confirm-modal')).zIndex),
                detail: Number(getComputedStyle(document.querySelector('[data-semantic-detail-fixture]')).zIndex),
                manager: Number(getComputedStyle(document.getElementById('manager')).zIndex) || 0,
            }));
            assert.ok(layers.confirm > layers.detail && layers.confirm > layers.manager, 'confirmation must be above both the detail and fullscreen manager');
            assert.equal(await action('apply').evaluate(element => {
                const rect = element.getBoundingClientRect();
                return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
            }), true, 'the visible apply button must receive pointer input above the detail');
        }
        await page.locator('[data-semantic-detail-fixture] textarea').evaluate(element => element.focus());
        assert.equal(await page.evaluate(() => semanticTest.shouldDefer()), true);
        await page.locator('[data-semantic-detail-fixture] [contenteditable]').evaluate(element => element.focus());
        assert.equal(await page.evaluate(() => semanticTest.shouldDefer()), true, 'contenteditable input also defers recognition');
        await page.locator('[data-semantic-detail-fixture] button').evaluate(element => element.focus());
        assert.equal(await page.evaluate(() => semanticTest.shouldDefer()), false, 'persistent sidebar allows recognition once focus leaves input');
        await open({ detail: 'overlay' });
        assert.equal(await page.evaluate(() => semanticTest.shouldDefer()), true, 'ordinary detail waits for close even when its input is not focused');
        const output = path.join(root, 'output', 'playwright', 'semantic-confirmation'); fs.mkdirSync(output, { recursive: true });
        await open({ repeat: true });
        await page.screenshot({ path: path.join(output, 'daily-repeat.png') });
        for (const host of ['', 'tab', 'dock', 'fullscreen']) {
            for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
                await page.setViewportSize(viewport);
                await open({ host, long: true, ...(host === 'dock' && viewport.width > 760 ? { width: 420 } : {}) });
                const bounds = await modal.evaluate(element => {
                    const box = element.querySelector('.tm-semantic-date-confirm-box'), body = element.querySelector('.tm-semantic-date-confirm-body');
                    return { horizontalOverflow: body.scrollWidth > body.clientWidth + 1,
                        boxInside: box.getBoundingClientRect().right <= element.getBoundingClientRect().right + 1,
                        footerVisible: element.querySelector('.tm-semantic-date-confirm-footer').getBoundingClientRect().bottom <= element.getBoundingClientRect().bottom + 1,
                        unusedHeight: box.clientHeight - body.offsetHeight - element.querySelector('.tm-semantic-date-confirm-header').offsetHeight - element.querySelector('.tm-semantic-date-confirm-footer').offsetHeight };
                });
                assert.equal(bounds.horizontalOverflow, false, JSON.stringify({ host, viewport, bounds }));
                assert.equal(bounds.boxInside, true); assert.equal(bounds.footerVisible, true);
                assert.ok(bounds.unusedHeight < 3, JSON.stringify({ host, viewport, bounds }));
            }
        }
        await page.setViewportSize({ width: 1440, height: 1000 }); await open();
        const typography = await modal.locator('.tm-semantic-date-confirm-write > span').evaluateAll(elements =>
            [...new Set(elements.map(element => { const css = getComputedStyle(element); return css.fontSize + '/' + css.fontWeight; }))]);
        assert.deepEqual(typography, ['13px/600']);
        await page.screenshot({ path: path.join(output, 'desktop.png') });
        await page.locator('html').evaluate(element => element.setAttribute('data-theme-mode', 'dark')); await page.waitForTimeout(180);
        await page.screenshot({ path: path.join(output, 'dark.png') });
        await page.locator('html').evaluate(element => element.removeAttribute('data-theme-mode'));
        await page.setViewportSize({ width: 390, height: 844 }); await open();
        await page.screenshot({ path: path.join(output, 'mobile.png') });
        for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 740 }, { width: 844, height: 390 }]) {
            const touchPage = await browser.newPage({ viewport, hasTouch: true, isMobile: true });
            touchPage.on('pageerror', error => errors.push(error.message));
            try {
                await touchPage.goto('http://127.0.0.1:' + server.address().port);
                const metrics = await touchPage.locator('.tm-semantic-date-confirm-modal').evaluate(element => ({
                    frame: (() => {
                        const box = element.querySelector('.tm-semantic-date-confirm-box');
                        const rect = box.getBoundingClientRect();
                        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, radius: getComputedStyle(box).borderRadius };
                    })(),
                    overflow: element.querySelector('.tm-semantic-date-confirm-body').scrollWidth > element.querySelector('.tm-semantic-date-confirm-body').clientWidth,
                    footerVisible: element.querySelector('.tm-semantic-date-confirm-footer').getBoundingClientRect().bottom <= innerHeight,
                    rows: Array.from(element.querySelectorAll('.tm-semantic-date-confirm-task')).map(row => ({
                        lines: new Set(Array.from(row.querySelectorAll('label')).map(label => Math.round(label.getBoundingClientRect().top))).size,
                        widths: Array.from(row.querySelectorAll('label')).map(label => label.getBoundingClientRect().width),
                        available: row.querySelector('.tm-semantic-date-confirm-writes').clientWidth,
                        gap: parseFloat(getComputedStyle(row.querySelector('.tm-semantic-date-confirm-writes')).columnGap),
                    })),
                    touchHeights: Array.from(element.querySelectorAll('label, [data-tm-semantic-action]')).filter(control => !control.classList.contains('tm-semantic-date-confirm-close')).map(control => {
                        const after = getComputedStyle(control, '::after');
                        const css = getComputedStyle(control);
                        return control.getBoundingClientRect().height
                            + Math.max(0, -(parseFloat(after.top) || 0) - parseFloat(css.borderTopWidth))
                            + Math.max(0, -(parseFloat(after.bottom) || 0) - parseFloat(css.borderBottomWidth));
                    }),
                    typography: [...new Set(Array.from(element.querySelectorAll('.tm-semantic-date-confirm-write > span')).map(span => {
                        const css = getComputedStyle(span); return css.fontSize + '/' + css.fontWeight;
                    }))],
                }));
                assert.equal(metrics.overflow, false, JSON.stringify({ viewport, metrics }));
                assert.equal(metrics.footerVisible, true);
                assert.deepEqual(metrics.frame, { x: 0, y: 0, width: viewport.width, height: viewport.height, radius: '0px' }, 'mobile confirmation must use the entire viewport in both orientations');
                assert.ok(metrics.touchHeights.every(height => height >= 44), 'compact labels must retain separate touch targets');
                assert.ok(metrics.rows.every(row => row.widths.every(width => width <= row.available)), 'full date and time values must fit without clipping');
                if (viewport.width <= 480) {
                    assert.deepEqual(metrics.typography, ['13px/600']);
                    assert.equal(metrics.rows[0].lines, 1, 'date and default reminder should fit on one row');
                    assert.equal(metrics.rows[3].lines, 1, 'date and explicit reminder should fit on one row');
                    if (viewport.width >= 390) {
                        // Native CJK fallback fonts differ across Windows and Linux.
                        // Keep choices together when they fit, and verify compact
                        // wrapping when their measured widths require another row.
                        for (const row of metrics.rows) {
                            let expectedLines = 1, usedWidth = 0;
                            for (const width of row.widths) {
                                const nextWidth = usedWidth ? usedWidth + row.gap + width : width;
                                if (nextWidth > row.available + 1) {
                                    expectedLines++;
                                    usedWidth = width;
                                } else usedWidth = nextWidth;
                            }
                            assert.equal(row.lines, expectedLines, 'choices should wrap only when their measured widths exceed the available row: ' + JSON.stringify({ viewport, row }));
                        }
                    }
                }
                const choice = touchPage.locator('.tm-semantic-date-confirm-write').first();
                if (viewport.width <= 480) {
                    const rect = await choice.boundingBox();
                    assert.equal(await choice.evaluate(element => {
                        const rect = element.getBoundingClientRect();
                        return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.bottom + 3));
                    }), true, 'the expanded touch edge must receive input');
                    await touchPage.touchscreen.tap(rect.x + rect.width / 2, rect.y + rect.height + 3);
                } else await choice.tap();
                assert.equal(await choice.locator('input').isChecked(), false, 'compact choices remain tappable');
                await choice.tap();
                await touchPage.evaluate(() => getSelection()?.removeAllRanges());
                await touchPage.screenshot({ path: path.join(output, `mobile-touch-${viewport.width}.png`) });
                if (viewport.width === 390) {
                    await touchPage.setViewportSize({ width: 844, height: 390 });
                    assert.equal(await touchPage.locator('.tm-semantic-date-confirm-box').evaluate(box => {
                        const rect = box.getBoundingClientRect();
                        return rect.x === 0 && rect.y === 0 && rect.width === innerWidth && rect.height === innerHeight;
                    }), true, 'an open confirmation stays fullscreen when rotating the device');
                }
            } finally { await touchPage.close(); }
        }
        await open({ many: true });
        assert.equal(await modal.locator('.tm-semantic-date-confirm-body').evaluate(element => element.scrollHeight > element.clientHeight), true);
        await page.keyboard.press('Escape'); assert.equal(await modal.count(), 0);
        assert.deepEqual(errors, []);
        console.log('semantic confirmation browser tests passed');
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
