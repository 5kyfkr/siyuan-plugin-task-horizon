'use strict';

// Production search UI, matching, hydration and highlighting; only host reads/persistence are stubbed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const stores = read('src/task-horizon/main/10-stores-rules-and-cache.js');
const services = read('src/task-horizon/main/20-api-and-runtime-services.js');
const dialogs = read('src/task-horizon/main/30-dialogs-and-ui-foundation.js');
function extract(source, name) {
    const start = source.search(new RegExp(`    (?:async )?function ${name}\\(`));
    const end = source.indexOf('\n    }', start);
    assert.ok(start >= 0 && end > start, name);
    return source.slice(start, end + 6);
}
const production = [
    ...[
        '__tmNormalizeCustomFieldId', '__tmParseCustomFieldColumnKey', '__tmGetTaskSearchFieldOptions', '__tmGetTaskSearchFields',
        '__tmNormalizeCustomFieldIdList', '__tmNormalizeCustomFieldValue', '__tmGetTaskCustomFieldValue',
        '__tmGetTaskCustomFieldRawValues', '__tmNormalizeTaskCustomFieldValues', '__tmHydrateMissingRuntimeCustomFields',
        '__tmRememberSmallCache',
    ].map((name) => extract(stores, name)),
    ...[
        '__tmGetTaskRemarkSearchText', '__tmTaskRemarkMatchesSearch', '__tmGetTaskSearchFieldText',
        '__tmTaskMatchesSearch', '__tmBuildTaskSearchSnippet', '__tmEscapeSearchHighlightRegex',
        '__tmClearSearchHighlights', '__tmShouldSkipSearchHighlightTextNode',
        '__tmApplySearchHighlightToTextNode', '__tmApplySearchHighlights',
    ].map((name) => extract(services, name)),
    services.slice(services.indexOf('    const __tmTooltipAttrsCache ='), services.indexOf('    function __tmBindFloatingTooltipsAfterLocalRerender(')),
    extract(dialogs, '__tmNormalizeLucideIconName'),
    dialogs.slice(dialogs.indexOf('    const __tmPhosphorBoldPaths ='), dialogs.indexOf('    function __tmLucideIconSvg(')),
    extract(dialogs, '__tmPhosphorBoldSvg'),
    dialogs.slice(dialogs.indexOf('    function __tmGetInlineSearchInput('), dialogs.indexOf('    async function __tmLoadValidatedDocGroupSnapshot(')),
].join('\n');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
        await page.setContent('<main class="tm-tab-root"><section id="host"><div class="tm-main-stage"><h2>任务</h2><div id="results"></div></div></section></main>');
        await page.addStyleTag({ content: read('task-horizon.css') });
        // Simulate host/theme disclosure styling; the scope control must remain an ordinary icon button.
        await page.addStyleTag({ content: 'summary{list-style:disclosure-closed!important}summary::before{content:"\u25b6"!important;position:absolute;left:-6px;color:var(--b3-theme-primary)}' });
        await page.addStyleTag({ content: ':root{--b3-theme-primary:#3575ac;--b3-theme-background:#fafafa;--b3-theme-surface:#f1f2f4;--b3-theme-on-surface:#30343a;--b3-border-color:#d4d7dc;--tm-secondary-text:#68717c;--b3-dialog-shadow:0 6px 22px #24344922}body{margin:0;font:14px system-ui;background:#fafafa;color:#30343a}#host{position:fixed;inset:0}.tm-main-stage{position:absolute;inset:0;padding:70px 24px 24px;overflow:auto}h2{font-size:18px}article{padding:12px 0;border-bottom:1px solid #e2e5e8}.tm-task-search-remark-snippet{display:block;margin-top:6px;font-size:12px}.tm-task-search-remark-snippet__label{margin-right:8px;color:#68717c}' });
        await page.evaluate(() => {
            window.definitions = [
                { id: 'notes', name: '项目说明', type: 'text' },
                { id: 'client', name: '客户名称很长时也需要完整显示', type: 'text' },
                { id: 'disabled', name: '停用列', type: 'text', enabled: false },
                { id: 'stage', name: '阶段', type: 'single' },
            ];
            window.state = { modal: document.querySelector('#host'), flatTasks: {}, taskTree: [], filteredTasks: [], otherBlocks: [], searchKeyword: '' };
            for (let i = 0; i < 80; i += 1) state.flatTasks[`task-${i}`] = { id: `task-${i}`, root_id: 'doc-a', content: `任务 ${i}`, remark: i === 0 ? '日常核对' : '', customFieldValues: {} };
            window.saved = null;
            window.SettingsStore = { data: {}, save: async () => { saved = structuredClone(SettingsStore.data); } };
            window.MetaStore = { get: () => ({}) };
            window.__TM_CUSTOM_FIELD_COLUMN_PREFIX = 'custom:';
            window.__tmGetCustomFieldDefs = () => definitions;
            window.__tmGetCustomFieldDefMap = () => new Map(definitions.map((field) => [field.id, field]));
            window.__tmIsCustomFieldApplicableToTask = () => true;
            window.__tmMergeLocalTaskPatchIntoTask = () => {};
            window.__tmInvalidateFilteredTaskDerivedStateCache = () => {};
            window.esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
            window.__tmEscAttr = esc;
            window.messages = [];
            window.hint = (message) => messages.push(message);
            window.revision = 0;
            window.__tmTaskStore = {
                getFlatMap: () => state.flatTasks,
                captureRead: () => revision,
                isReadCurrent: (token) => token === revision,
                acceptAuthoritative: (patches) => { for (const patch of patches) Object.assign(state.flatTasks[patch.id], patch); revision += 1; },
            };
            window.loads = [];
            window.holdLoads = false;
            window.failLoads = false;
            window.__tmAttachCustomFieldAttrsToTasks = async (tasks, { fieldIds }) => {
                loads.push({ count: tasks.length, fieldIds: fieldIds.slice() });
                if (holdLoads) await new Promise((resolve) => { window.releaseLoad = resolve; });
                if (failLoads) throw new Error('host unavailable');
                for (const task of tasks) {
                    task.__customFieldRawValues = { ...(task.__customFieldRawValues || {}) };
                    for (const id of fieldIds) task.__customFieldRawValues[id] = task.id === 'task-79' ? (id === 'notes' ? '本周需要核对 API 接口和发布文档' : 'Acme') : '';
                    task.__tmLoadedCustomFieldIds = Array.from(new Set([...(task.__tmLoadedCustomFieldIds || []), ...fieldIds]));
                }
                return { queryComplete: true };
            };
            window.__tmScheduleRender = () => {
                state.renderCount = (state.renderCount || 0) + 1;
                const tasks = Object.values(state.flatTasks).filter((task) => __tmTaskMatchesSearch(task));
                state.filteredTasks = tasks;
                document.querySelector('#results').innerHTML = tasks.slice(0, 20).map((task) => `<article data-id="${task.id}"><span class="tm-task-content-clickable">${esc(task.content)}</span>${__tmBuildTaskSearchSnippet(task)}</article>`).join('');
                __tmApplySearchHighlights(state.modal);
            };
        });
        await page.addScriptTag({ content: production });
        await page.evaluate(() => { __tmScheduleRender(); tmShowSearchModal(); });
        const input = page.getByRole('searchbox', { name: '搜索关键词' });
        const scopeTrigger = page.locator('.tm-search-fields__trigger');
        const select = async (name) => page.getByRole('checkbox', { name, exact: true }).click();
        assert.equal((await scopeTrigger.innerText()).trim(), '', 'scope entry is an icon without a label or count');
        assert.equal(await scopeTrigger.locator('svg').count(), 1);
        assert.equal(await scopeTrigger.getAttribute('aria-label'), '搜索范围');
        for (const label of ['搜索', '清除搜索', '搜索范围', '关闭搜索条']) {
            const control = page.getByLabel(label, { exact: true });
            await control.hover();
            assert.equal(await page.locator('.tm-floating-tooltip').textContent(), label, 'hover displays the function label');
            // Windows headless does not retain :hover here; focus exercises the shared guard after hover dispatch.
            await control.focus();
            await page.waitForTimeout(180);
            await page.waitForFunction((text) => {
                const tooltip = document.querySelector('.tm-floating-tooltip');
                const portal = document.querySelector('#tmInlineSearchbarPortal');
                return tooltip?.textContent === text && getComputedStyle(tooltip).opacity === '1'
                    && Number(getComputedStyle(tooltip).zIndex) > Number(getComputedStyle(portal).zIndex);
            }, label);
        }
        await page.mouse.move(8, 750);
        await page.waitForFunction(() => !document.querySelector('.tm-floating-tooltip'));
        await scopeTrigger.click();
        assert.equal(await page.locator('.tm-search-fields__heading > span').textContent(), '搜索范围');
        assert.deepEqual(await page.getByRole('checkbox').allTextContents(), ['', '', '', '']);
        await select('项目说明');
        await select('标题');
        await select('备注');
        assert.deepEqual(await page.evaluate(() => saved.taskSearchFields), ['customField:notes']);
        await select('项目说明');
        assert.equal(await page.getByRole('checkbox', { name: '项目说明', exact: true }).isChecked(), true, 'one column must remain selected');
        await scopeTrigger.press('Escape');
        assert.equal(await scopeTrigger.getAttribute('aria-expanded'), 'false');
        await page.evaluate(() => { holdLoads = true; });
        await input.fill('API');
        await page.waitForFunction(() => state.searchLoading);
        await input.fill('发布文档');
        await page.waitForFunction(() => state.searchKeyword === '发布文档');
        assert.equal(await page.evaluate(() => loads.length), 1, 'typing shares the pending field load');
        assert.equal(await page.getByRole('status').textContent(), '正在加载搜索内容…');
        await page.evaluate(() => { holdLoads = false; releaseLoad(); });
        await page.waitForFunction(() => !state.searchLoading && document.querySelector('[data-id="task-79"]'));
        assert.equal(await page.evaluate(() => loads[0].count), 80, 'search hydrates tasks beyond the visible window');
        assert.equal(await page.locator('#results article').count(), 1);
        assert.equal(await page.locator('mark').textContent(), '发布文档');
        assert.ok((await page.locator('#results').textContent()).includes('项目说明'));
        await page.evaluate(() => { state.flatTasks['task-79'].content = '发布文档标题'; __tmScheduleRender(); });
        assert.equal(await page.locator('.tm-task-content-clickable mark').count(), 0, 'excluded columns must not receive search highlighting');
        await input.fill('任务');
        await page.waitForFunction(() => state.searchKeyword === '任务' && !state.searchLoading);
        assert.equal(await page.locator('#results article').count(), 0, 'excluded titles must not match');
        await input.fill('API');
        await page.waitForFunction(() => state.filteredTasks.length === 1);
        await page.evaluate(() => { state.flatTasks['task-79'].customFieldValues.notes = '内容已修改'; __tmScheduleRender(); });
        assert.equal(await page.locator('#results article').count(), 0, 'updated text must no longer match');
        await page.evaluate(() => { state.flatTasks['task-79'].customFieldValues.notes = '本周需要核对 API 接口和发布文档'; __tmScheduleRender(); });
        for (const width of [320, 768, 1440]) {
            await page.setViewportSize({ width, height: 800 });
            await scopeTrigger.click();
            const geometry = await page.locator('.tm-search-fields__panel').boundingBox();
            assert.ok(geometry.x >= 0 && geometry.x + geometry.width <= width + 1, `panel fits ${width}px`);
            const inputBox = await input.boundingBox();
            assert.ok(inputBox.width >= 70, `input remains usable at ${width}px`);
            const closeBox = await page.getByRole('button', { name: '关闭搜索条', exact: true }).boundingBox();
            assert.equal(Math.round(inputBox.y), Math.round(closeBox.y), `controls stay on one row at ${width}px`);
            const out = path.join(root, 'output/playwright');
            fs.mkdirSync(out, { recursive: true });
            await page.screenshot({ path: path.join(out, `task-search-fields-${width}.png`) });
            await scopeTrigger.press('Escape');
            await page.screenshot({ path: path.join(out, `task-search-result-${width}.png`) });
        }
        await page.setViewportSize({ width: 1100, height: 800 });
        await scopeTrigger.click();
        await page.evaluate(() => { failLoads = true; });
        await select('客户名称很长时也需要完整显示');
        await select('项目说明');
        await input.fill('Acme');
        await page.waitForFunction(() => state.searchLoadError);
        assert.ok((await page.getByRole('status').textContent()).includes('结果可能不完整'));
        await page.evaluate(() => { failLoads = false; });
        await page.getByRole('button', { name: '重试', exact: true }).click();
        await page.waitForFunction(() => !state.searchLoadError && state.filteredTasks.length === 1);
        await scopeTrigger.click();
        await page.getByRole('button', { name: '恢复默认', exact: true }).click();
        assert.deepEqual(await page.evaluate(() => saved.taskSearchFields), ['content', 'remark']);
        await page.getByRole('button', { name: '关闭搜索条', exact: true }).click();
        assert.equal(await input.count(), 0);
        await page.evaluate(() => tmShowSearchModal());
        await scopeTrigger.click();
        assert.equal(await page.getByRole('checkbox', { name: '标题', exact: true }).isChecked(), true);
        await page.mouse.click(8, 750);
        assert.equal(await scopeTrigger.getAttribute('aria-expanded'), 'false', 'outside click dismisses the menu');
        await scopeTrigger.click();
        await select('项目说明');
        await select('标题');
        await select('备注');
        await page.evaluate(() => {
            for (const task of Object.values(state.flatTasks)) delete task.__tmLoadedCustomFieldIds;
            holdLoads = true;
            void tmSearch('API');
        });
        await page.waitForFunction(() => state.searchLoading);
        await scopeTrigger.hover();
        await page.waitForFunction(() => document.querySelector('.tm-floating-tooltip'));
        await page.evaluate(() => tmCloseInlineSearch());
        assert.equal(await page.locator('.tm-floating-tooltip').count(), 0, 'closing the search portal removes its tooltip');
        const closedRenderCount = await page.evaluate(() => state.renderCount);
        await page.evaluate(async () => { holdLoads = false; releaseLoad(); await new Promise((resolve) => setTimeout(resolve, 0)); });
        assert.equal(await input.count(), 0, 'a late read cannot reopen the closed search bar');
        assert.equal(await page.evaluate(() => state.searchKeyword), '');
        assert.equal(await page.evaluate(() => state.renderCount), closedRenderCount, 'a late read cannot rerender the closed search');
        assert.deepEqual(errors, []);
        console.log('task search fields browser tests passed (320 / 768 / 1440px)');
    } catch (error) {
        console.error({ errors, state: await page.evaluate(() => ({ searchKeyword: state.searchKeyword, searchLoading: state.searchLoading, searchLoadError: state.searchLoadError, loads })) });
        throw error;
    } finally {
        await browser.close();
    }
})().catch((error) => { console.error(error); process.exitCode = 1; });
