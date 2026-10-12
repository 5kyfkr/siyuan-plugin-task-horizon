'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const read = (name) => fs.readFileSync(path.join(__dirname, '../src/task-horizon/main', name), 'utf8');
function section(source, start, end) {
    const from = source.indexOf(start), to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from, start);
    return source.slice(from, to);
}

const main = read('40-render-runtime.js');
const dialogs = read('30-dialogs-and-ui-foundation.js');
const checklist = read('render/42-render-list-and-checklist-body.js');
const kanban = read('render/43-render-timeline-kanban-calendar-body.js');
const table = read('task-runtime/53-list-render-and-document-loader.js');
const settings = read('settings/60-settings-screen.js');
const code = section(main, 'function __tmBuildHeadingGroupContextMenuAttrs(', 'function __tmParseHeadingBlocksFromKramdown(')
    + section(read('settings/70-doc-group-and-settings-actions.js'), 'window.tmRenameHeadingGroup = async function(', 'async function __tmSaveDocTabCustomGroups(')
    + section(dialogs, 'function __tmUnbindOutsideCloseHandler(', 'function __tmGetDocPinnedIdsForGroup(');

assert.match(checklist, /groupKind === 'h2'[\s\S]*__tmBuildHeadingGroupContextMenuAttrs\(docDropId, headingDropId\)/);
assert.match(checklist, /docHeadingGroupDropAttrs\}\$\{headingContextMenuAttrs\}/);
assert.match(table, /__tmBuildHeadingGroupContextMenuAttrs\(docId, h2Id\)/);
assert.match(table, /h2GroupDropAttrs\}\$\{headingContextMenuAttrs\}/);
assert.match(kanban, /__tmBuildHeadingGroupContextMenuAttrs\(docId, bucket.id\)/);
assert.match(kanban, /renderGroupTitle\(h2Key,[^\n]*contextMenuAttrs/);
assert.match(kanban, /__tmBuildHeadingGroupContextMenuAttrs\(headingDocId, headingIdForCreate\)/);
assert.match(kanban, /data-tm-kanban-column-expanded-content[^\n]*headingContextMenuAttrs/);
assert.match(kanban, /data-tm-kanban-column-collapsed-content[^\n]*headingContextMenuAttrs/);
for (let level = 1; level <= 6; level++) assert.ok(settings.includes(`<option value="h${level}"`));

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
        await page.route('**/*', (route) => route.abort());
        await page.setContent('<main id="manager"></main>');
        await page.addStyleTag({ content: fs.readFileSync(path.join(__dirname, '../task-horizon.css'), 'utf8') });
        await page.evaluate(() => {
            window.docId = '20261010120000-document';
            window.headingId = '20261010120001-heading';
            window.otherId = '20261010120002-another';
            window.reset = (level = 'h2') => {
                window.blocks = new Map([headingId, otherId].map((id) => [id,
                    `<div data-node-id="${id}" data-type="NodeHeading" data-subtype="${level}" id="${id}" updated="20261010120000" custom-color="blue" fold="1"><div contenteditable="true"><span data-type="strong">同名标题</span></div><div class="protyle-attr" contenteditable="false"></div></div>`]));
                window.writes = [];
                window.hints = [];
                window.refreshes = [];
                window.promptValue = '新的标题';
                window.unlock = true;
                window.failWrite = false;
                window.failRefresh = false;
                window.refreshResult = true;
                window.coreResult = true;
                window.changeDuringPrompt = false;
                window.promptCount = 0;
                window.readCount = 0;
            };
            window.state = {};
            window.__tmIsLikelyBlockId = (value) => /^[0-9]+-[a-zA-Z0-9]+$/.test(String(value || '').trim());
            window.API = { getBlockDOM: async (id) => { readCount++; return blocks.get(id) || ''; } };
            window.__tmBackendAdapter = {
                updateBlock: async (id, dom, type) => {
                    if (failWrite) throw new Error('写入失败');
                    writes.push({ id, dom, type });
                    blocks.set(id, dom);
                },
            };
            window.__tmRunInTaskWriterContext = (_label, run) => run();
            window.showPrompt = async (_title, _label, initial) => {
                promptCount++;
                window.promptInitial = initial;
                if (changeDuringPrompt) blocks.set(headingId, blocks.get(headingId).replace('同名标题', '其他窗口修改'));
                return promptValue;
            };
            window.hint = (message, type) => hints.push({ message, type });
            window.__tmWaitForGlobalUnlock = async () => unlock;
            window.__tmFlushSqlTransactionsSafe = async () => { refreshes.push('flush'); return true; };
            window.__tmWarmKanbanDocHeadings = async (ids, options) => refreshes.push({ warm: ids, options });
            window.__tmRefreshAffectedDocsIncrementally = async (options) => {
                refreshes.push(options);
                if (failRefresh) throw new Error('刷新失败');
                return refreshResult;
            };
            window.__tmRefreshCore = async (options) => { refreshes.push({ core: options }); return coreResult; };
            window.__tmRenderContextMenuLabel = (_icon, text) => `<span>${text}</span>`;
            reset();
        });
        await page.addScriptTag({ content: code });

        for (let level = 1; level <= 6; level++) {
            const result = await page.evaluate(async (level) => {
                reset(`h${level}`);
                promptValue = '  新名称 <script> * # &  ';
                const untouched = blocks.get(otherId);
                const ok = await tmRenameHeadingGroup(docId, headingId);
                const container = document.createElement('div');
                container.innerHTML = blocks.get(headingId);
                const block = container.firstElementChild;
                return { ok, writes, initial: promptInitial, level: block.dataset.subtype,
                    name: block.querySelector('[contenteditable="true"]').textContent,
                    custom: block.getAttribute('custom-color'), fold: block.getAttribute('fold'),
                    id: block.dataset.nodeId, untouched: blocks.get(otherId) === untouched,
                    script: !!block.querySelector('script'), refreshes };
            }, level);
            assert.equal(result.ok, true);
            assert.equal(result.writes.length, 1);
            assert.equal(result.writes[0].id, '20261010120001-heading');
            assert.equal(result.writes[0].type, 'dom');
            assert.equal(result.initial, '同名标题');
            assert.equal(result.level, `h${level}`);
            assert.equal(result.name, '新名称 <script> * # &');
            assert.equal(result.custom, 'blue');
            assert.equal(result.fold, '1');
            assert.equal(result.id, result.writes[0].id);
            assert.equal(result.untouched, true, 'same-name headings must remain independent');
            assert.equal(result.script, false, 'names must remain literal text');
            assert.equal(result.refreshes[0], 'flush');
            assert.deepEqual(result.refreshes[1].warm, ['20261010120000-document']);
            assert.deepEqual(result.refreshes[2].docIds, ['20261010120000-document']);
            assert.equal(result.refreshes[2].forceDocRefresh, true);
            assert.equal(result.refreshes[2].preserveRenderWindow, true);
        }

        for (const input of [null, '', '   ', '同名标题', '第一行\n第二行']) {
            const result = await page.evaluate(async (input) => {
                reset(); promptValue = input;
                return { ok: await tmRenameHeadingGroup(docId, headingId), writes: writes.length, refreshes: refreshes.length };
            }, input);
            assert.deepEqual(result, { ok: false, writes: 0, refreshes: 0 });
        }
        for (const failure of ['unlock', 'failWrite', 'changeDuringPrompt', 'deleted', 'notHeading']) {
            const result = await page.evaluate(async (failure) => {
                reset();
                if (failure === 'unlock') unlock = false;
                else if (failure === 'deleted') blocks.delete(headingId);
                else if (failure === 'notHeading') blocks.set(headingId, blocks.get(headingId).replace('NodeHeading', 'NodeParagraph'));
                else window[failure] = true;
                const ok = await tmRenameHeadingGroup(docId, headingId);
                return { ok, writes: writes.length, hints, refreshes: refreshes.length };
            }, failure);
            assert.equal(result.ok, false, failure);
            assert.equal(result.writes, 0, failure);
            assert.equal(result.refreshes, 0, failure);
            assert.ok(result.hints.some((hint) => ['warning', 'error'].includes(hint.type)), failure);
        }
        for (const mode of ['fallback', 'deferred', 'failed']) {
            const result = await page.evaluate(async (mode) => {
                reset(); refreshResult = false;
                if (mode === 'deferred') coreResult = false;
                if (mode === 'failed') failRefresh = true;
                return { ok: await tmRenameHeadingGroup(docId, headingId), writes: writes.length, hints, refreshes };
            }, mode);
            assert.equal(result.ok, true, 'a view refresh failure must not imply the committed rename failed');
            assert.equal(result.writes, 1);
            if (mode === 'fallback') assert.ok(result.refreshes.some((item) => item.core));
            else assert.ok(result.hints.some((item) => item.type === 'warning'));
        }

        await page.evaluate(() => {
            reset();
            const attrs = __tmBuildHeadingGroupContextMenuAttrs(docId, headingId);
            document.querySelector('#manager').innerHTML = `<div id="heading"${attrs}>同名标题</div>`;
        });
        await page.locator('#heading').click({ button: 'right' });
        assert.equal(await page.getByRole('menuitem', { name: '修改名称' }).count(), 1);
        await page.keyboard.press('Escape');
        assert.equal(await page.getByRole('menu').count(), 0);
        await page.locator('#heading').click({ button: 'right' });
        await page.getByRole('menuitem', { name: '修改名称' }).click();
        await page.waitForFunction(() => hints.some((item) => item.type === 'success'));
        assert.equal(await page.evaluate(() => writes.length), 1);
        assert.equal(await page.getByRole('menu').count(), 0);
        await page.evaluate(() => tmShowHeadingGroupContextMenu({ clientX: 799, clientY: 599 }, docId, headingId));
        const box = await page.getByRole('menu').boundingBox();
        assert.ok(box.x >= 8 && box.y >= 8 && box.x + box.width <= 792 && box.y + box.height <= 592);
        await page.mouse.click(400, 300);
        assert.equal(await page.getByRole('menu').count(), 0);
        assert.equal(await page.evaluate(() => state.taskContextMenuCloseHandler), null);
        const invalid = await page.evaluate(async () => {
            reset();
            return { attrs: __tmBuildHeadingGroupContextMenuAttrs(docId, '__none__'),
                ok: await tmRenameHeadingGroup(docId, '__none__'), reads: readCount, writes: writes.length };
        });
        assert.deepEqual(invalid, { attrs: '', ok: false, reads: 0, writes: 0 });
        assert.deepEqual(errors, []);
        console.log('heading group rename browser tests passed (H1–H6, identity, validation, persistence, refresh, context menu)');
    } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
