'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, i18nPrelude } = require('./i18n-browser-fixture');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
        await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
        await page.addScriptTag({ content: i18nPrelude });
        await page.addStyleTag({ content: read('task-horizon.css') });
        await page.evaluate(() => {
            const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
            }[char]));
            window.__tmIsRuntimeMobileClient = () => true;
            window.__tmIsMobileDevice = () => true;
            Object.assign(window, {
                esc: escape,
                __tmEscAttr: escape,
                __tmNormalizeCustomBoardGroupMode: (value) => value || 'doc',
                __tmGetGroupModeLabel: (value) => value,
                __tmNormalizeHexColor: (value, fallback) => value || fallback,
                __tmGetDocDisplayName: (doc, id) => doc?.name || id,
                __tmResolveDocGroupName: (group) => group?.name || '',
                __tmRenderLucideIcon: () => '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"></svg>',
                __tmBuildTooltipAttrs: () => '',
                __tmModalStackBind: () => () => {},
                __tmBindPluginHostGestureIsolation: () => {},
                __tmApplyPopupOpenAnimation: () => {},
                __tmGetCustomBoardDocumentOptions: () => [
                    { id: 'doc-work', name: '工作安排' },
                    { id: 'doc-life', name: '生活计划' },
                ],
                state: {
                    allDocuments: [],
                    taskTree: [],
                    filterRules: [
                        { id: 'rule-work', name: '工作规则', enabled: true },
                        { id: 'rule-life', name: '生活规则', enabled: true },
                    ],
                },
                SettingsStore: { data: {
                    customBoardSets: [{
                        id: 'set-test',
                        name: '测试组合板',
                        boards: [{
                            id: 'board-test',
                            name: '测试子看板',
                            ruleId: 'rule-work',
                            groupMode: 'doc',
                            scope: { mode: 'all' },
                        }],
                    }],
                    activeCustomBoardSetId: 'set-test',
                    docGroups: [
                        { id: 'group-work', name: '工作' },
                        { id: 'group-life', name: '生活' },
                    ],
                    docTabCustomGroups: [
                        { id: 'tab-work', name: '工作任务', docGroupId: 'group-work' },
                    ],
                } },
            });
        });
        await page.addScriptTag({ content: read('src/task-horizon/main/35-custom-board-runtime.js') });
        await page.evaluate(() => __tmRenderCustomBoardEditor('board-test'));

        assert.equal(await page.locator('[data-field="name"]').evaluate((node) => document.activeElement === node), false,
            'opening the editor on touch must not open the software keyboard');
        assert.equal(await page.locator('.tm-custom-board-select-control').count(), 5,
            'every sub-board select must use the shared rule-management control');
        assert.equal(await page.locator('.tm-custom-board-select-control > .tm-custom-board-select-trigger.bc-select').count(), 5);
        assert.equal(await page.locator('.tm-custom-board-select-control > .tm-custom-board-select-arrow').count(), 5);
        assert.equal(await page.locator('.tm-custom-board-select-control .tm-custom-board-select-arrow svg').count(), 0,
            'the dropdown affordance must not render an additional icon');
        assert.equal(await page.locator('.tm-custom-board-select-trigger.bc-select').first().evaluate((node) => getComputedStyle(node).backgroundImage),
            'none', 'Basecoat must not add a second decorative arrow background');
        assert.deepEqual(
            await page.locator('.tm-custom-board-select-arrow').first().evaluate((node) => {
                const style = getComputedStyle(node);
                return [style.width, style.borderTopWidth, style.borderTopStyle];
            }),
            ['0px', '5px', 'solid'],
            'the dropdown affordance must be a single solid triangle',
        );
        assert.deepEqual(
            (await page.locator('[data-tm-custom-board-select-label]').allTextContents()).map((label) => label.trim()),
            ['工作规则', 'doc', '全部文档', '全部文档', '此分组暂无页签组'],
            'all selected values must be visible before interaction',
        );

        const choose = async (field, optionIndex) => {
            await page.locator(`[data-tm-custom-board-field="${field}"]`).tap();
            const picker = page.locator('#tmCustomBoardOptionPicker');
            await picker.waitFor({ state: 'visible' });
            await picker.locator('[data-tm-custom-board-option-index]').nth(optionIndex).tap();
            await picker.waitFor({ state: 'detached' });
        };

        await choose('ruleId', 2);
        assert.equal(await page.locator('select[data-field="ruleId"]').inputValue(), 'rule-life');
        assert.match(await page.locator('[data-tm-custom-board-field="ruleId"]').textContent(), /生活规则/);

        await choose('groupMode', 2);
        assert.equal(await page.locator('select[data-field="groupMode"]').inputValue(), 'time');

        await choose('scopeMode', 2);
        assert.equal(await page.locator('select[data-field="scopeMode"]').inputValue(), 'tabGroup');
        assert.equal(await page.locator('[data-scope-mode="tabGroup"]').isVisible(), true);

        assert.deepEqual(errors, [], 'the mobile sub-board selector must not throw');
        console.log('custom board mobile selector browser tests passed');
    } finally {
        await context.close();
        await browser.close();
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
