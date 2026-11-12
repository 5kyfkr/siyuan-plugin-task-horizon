'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, i18nPrelude } = require('./i18n-browser-fixture');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const waitForVisibleDocs = (page, expected) => page.waitForFunction((labels) => {
    const actual = Array.from(document.querySelectorAll('.tm-custom-board-document-list [data-doc-name]'))
        .filter(row => getComputedStyle(row).display !== 'none')
        .map(row => row.textContent.trim());
    return actual.length === labels.length && actual.every((label, index) => label === labels[index]);
}, expected, { timeout: 10000 });

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(5000);
    try {
        await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
        await page.addScriptTag({ content: i18nPrelude });
        await page.addStyleTag({ content: read('task-horizon.css') });
        await page.evaluate(() => {
            const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
            }[char]));
            Object.assign(window, {
                esc: escape,
                __tmEscAttr: escape,
                __tmNormalizeCustomBoardGroupMode: value => value || 'doc',
                __tmGetGroupModeLabel: value => value,
                __tmNormalizeHexColor: (value, fallback) => value || fallback,
                __tmGetDocDisplayName: (doc, id) => doc?.name || id,
                __tmRenderLucideIcon: () => '<svg viewBox="0 0 16 16" aria-hidden="true"></svg>',
                __tmBuildTooltipAttrs: () => '',
                __tmModalStackBind: () => () => {},
                state: {
                    allDocuments: [
                        { id: 'doc-work', name: '工作安排' },
                        { id: 'doc-life', name: '生活计划' },
                        { id: 'doc-project', name: 'Project Alpha' },
                    ],
                    taskTree: [],
                    filterRules: [],
                },
                SettingsStore: { data: {
                    customBoardSets: [{ id: 'set-test', name: 'Test', boards: [{
                        id: 'board-edit', name: 'Existing',
                        scope: { mode: 'docs', docIds: ['doc-work'] },
                    }] }],
                    activeCustomBoardSetId: 'set-test',
                } },
            });
        });
        await page.addScriptTag({ content: read('src/task-horizon/main/35-custom-board-runtime.js') });
        for (const width of [1000, 390]) {
            await page.setViewportSize({ width, height: 900 });
            for (const boardId of ['', 'board-edit']) {
                await page.evaluate(id => { __tmRenderCustomBoardEditor(id); }, boardId);
                // The dialog focuses its first input on the next animation frame.
                // Let that finish before entering a query in the search field.
                await page.waitForFunction(() => document.activeElement ===
                    document.querySelector('#tmCustomBoardEditor [data-field="name"]'));
                await page.locator('[data-field="scopeMode"]').selectOption('docs');
                const search = page.locator('[data-field="docSearch"]');
                const visibleRows = page.locator('.tm-custom-board-document-list [data-doc-name]:visible');
                const work = page.locator('.tm-custom-board-document-list input[value="doc-work"]');
                const life = page.locator('.tm-custom-board-document-list input[value="doc-life"]');
                assert.equal(await visibleRows.count(), 3);
                if (boardId) assert.equal(await work.isChecked(), true, 'editing must retain saved documents');
                else await work.check();

                await search.fill('生活');
                await waitForVisibleDocs(page, ['生活计划']);
                assert.deepEqual(await visibleRows.allTextContents(), ['生活计划'],
                    'search must visually hide nonmatching rows, including flex rows with the hidden attribute');
                await life.check();
                await search.fill('  pRoJeCt  ');
                await waitForVisibleDocs(page, ['Project Alpha']);
                assert.deepEqual(await visibleRows.allTextContents(), ['Project Alpha']);
                await search.fill('没有匹配的文档');
                await waitForVisibleDocs(page, []);
                assert.equal(await visibleRows.count(), 0, 'an unmatched query must hide every document');
                await search.fill('');
                await waitForVisibleDocs(page, ['工作安排', '生活计划', 'Project Alpha']);
                assert.equal(await visibleRows.count(), 3, 'clearing search must restore all documents');
                assert.equal(await work.isChecked(), true, 'filtering must preserve hidden selections');
                assert.equal(await life.isChecked(), true, 'filtering must preserve newly selected documents');
            }
        }
        assert.deepEqual(errors, [], 'document search must not cause browser errors');
        console.log('custom-board document search browser tests passed');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
