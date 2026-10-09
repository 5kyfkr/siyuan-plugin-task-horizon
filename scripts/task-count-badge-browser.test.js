'use strict';
// Uses the same local browser dependency as settings-v2-browser.test.js.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || process.argv[2] || 'playwright');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('src/task-horizon/manifest.main.json'));
let runtime = manifest.scripts.map(file => read(`src/task-horizon/${file}`)).join('\n');
runtime = runtime.slice(0, runtime.lastIndexOf("    if (document.readyState === 'loading') {")) + `
    window.__badgeTest = { SettingsStore, state, API, RuleManager,
        nativePatch: __tmApplyNativeDocCheckboxTaskStorePatch, nativeBind: __tmBindNativeDocCheckboxStatusSync };
    SettingsStore.loaded = true;
    SettingsStore.save = async () => { __tmTaskCountBadge.configure(); };
    SettingsStore.data.filterRules = RuleManager.getDefaultRules();
    state.filterRules = SettingsStore.data.filterRules;
    state.notebooks = [{ id: 'notebook', name: '测试笔记本' }];
    state.notebooksFetchedAt = Date.now();
    state.allDocuments = [
        { id: '20261010000000-doc0001', name: '工作', path: '/work.sy', notebook: 'notebook' },
        { id: '20261010000000-doc0002', name: '工作子文档', path: '/work/child.sy', notebook: 'notebook' },
        { id: '20261010000000-doc0003', name: '个人', path: '/personal.sy', notebook: 'notebook' },
    ];
    SettingsStore.data.selectedDocIds = ['20261010000000-doc0001'];
    SettingsStore.data.docGroups = [{ id: 'work', name: '工作项目', docs: [{ id: '20261010000000-doc0001', recursive: false }] }];
    const test = window.__badgeData = { reads: 0, freshnessReads: 0, maxActive: 0, active: 0, rows: [], fail: false, delay: 0, truncated: false };
    const today = __tmNormalizeDateOnly(new Date());
    const tomorrow = __tmShiftTaskRepeatDateKey(today, 1);
    test.rows = [
        { id: '20261010000001-task001', root_id: '20261010000000-doc0001', markdown: '- [ ] 今天', completionTime: today },
        { id: '20261010000002-task002', root_id: '20261010000000-doc0001', markdown: '- [ ] 明天', completionTime: tomorrow },
        { id: '20261010000003-task003', root_id: '20261010000000-doc0002', markdown: '- [ ] 子文档', completionTime: today },
        { id: '20261010000004-task004', root_id: '20261010000000-doc0003', markdown: '- [ ] 个人', completionTime: today },
    ];
    API.getSubDocIds = async id => id === '20261010000000-doc0001' ? ['20261010000000-doc0002'] : [];
    API.getTaskFreshnessByDocuments = async ids => {
        test.freshnessReads++;
        return { map: new Map(ids.map(id => [id, { docUpdated: '20261010000000', taskCount: test.rows.filter(row => row.root_id === id).length }])), unavailable: test.fail };
    };
    API.getTasksByDocuments = async ids => {
        test.reads++; test.active++; test.maxActive = Math.max(test.maxActive, test.active);
        const rows = test.rows.filter(row => ids.includes(row.root_id)).map(row => ({ ...row }));
        if (test.delay) await new Promise(resolve => setTimeout(resolve, test.delay));
        test.active--;
        if (test.fail) return { readFailure: true };
        return { tasks: rows, limitReached: Number(test.truncated), limitReachedDocIds: test.truncated ? ids.slice(0, 1) : [] };
    };
    globalThis.__tmTaskSnapshotService.readTaskIndex = async () => null;
    __tmTaskCountBadge.configure();
    window.showSettings();
})();`;
const prelude = `window.siyuan={config:{system:{kernelVersion:'3.8.6',container:'desktop'},appearance:{mode:0}},languages:{}};
window.__tmSuppressStorageWrites=true;
window.fetch=async()=>({ok:true,status:200,json:async()=>({code:0,data:[]}),text:async()=>'',blob:async()=>new Blob()});
window.__taskHorizonPluginInstance={_taskWindowTopBarElement:document.getElementById('nativeTopbar')};`;
const nativeStyles = `body{margin:0;font:14px/1.5 system-ui}:root{--b3-theme-background:#fafafa;--b3-theme-surface:#f3f4f6;--b3-theme-on-background:#252932;--b3-theme-primary:#3877c9;--b3-border-color:#e1e5eb;--b3-theme-error:#bb3545;--b3-theme-on-error:#fff;--b3-font-family:system-ui}.dock__item,#nativeTopbar{width:28px;height:28px;border:0;background:#ddd;margin:16px;display:inline-block}#nativeTopbar>svg{width:18px;height:18px}.b3-select,.b3-text-field{border:1px solid var(--b3-border-color);padding:6px 10px;border-radius:6px;background:var(--b3-theme-background);color:inherit}.b3-switch{appearance:none;width:32px;height:18px;background:#b2b8c2;border-radius:12px;position:relative}.b3-switch:checked{background:var(--b3-theme-primary)}.b3-switch:after{content:'';position:absolute;width:14px;height:14px;top:2px;left:2px;border-radius:50%;background:white}.b3-switch:checked:after{left:16px}`;
const server = http.createServer((req, res) => {
    if (req.url === '/runtime.js') { res.setHeader('content-type', 'text/javascript'); res.end(prelude + runtime); return; }
    if (req.url === '/task.css') { res.setHeader('content-type', 'text/css'); res.end(read('task-horizon.css')); return; }
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(`<html><head><style>${nativeStyles}</style><link rel="stylesheet" href="/task.css"></head><body>
        <svg style="display:none"><symbol id="iconTaskHorizon" viewBox="0 0 24 24"><path d="M4 4h16v16H4zm4 8 3 3 5-6"/></symbol></svg>
        <button id="nativeTopbar" title="任务管理器"><svg><use href="#iconTaskHorizon"/></svg></button>
        <button class="dock__item" data-type="::task-horizon-dock" title="任务管理器"></button><script src="/runtime.js"></script></body></html>`);
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.stack));
    const waitCount = async count => {
        await page.waitForFunction(expected => __tmTaskCountBadge.getResult().status === 'error' || (__tmTaskCountBadge.getResult().status === 'ready' && __tmTaskCountBadge.getResult().count === expected), count);
        assert.deepEqual(await page.evaluate(() => ({ status: __tmTaskCountBadge.getResult().status, count: __tmTaskCountBadge.getResult().count })), { status: 'ready', count });
    };
    const configure = async patch => {
        await page.evaluate(value => {
            Object.assign(__badgeTest.SettingsStore.data.taskCountBadge, value);
            __tmTaskCountBadge.configure();
            __tmTaskCountBadge.refresh();
        }, patch);
    };
    try {
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        await page.waitForFunction(() => !!window.__badgeTest);
        await page.evaluate(() => tmOpenSettingsV2Page('appearance', 'l-icon'));
        const panel = page.locator('.tm-task-count-settings');
        await panel.waitFor();
        assert.equal(await page.locator('.tm-task-count-badge-host').count(), 0);
        assert.equal(await page.evaluate(() => __badgeData.reads + __badgeData.freshnessReads), 0, 'disabled startup performs no badge reads');
        const enable = panel.locator('input[onchange*="enabled"]');
        await page.evaluate(() => { __taskHorizonPluginInstance._taskCountBadgeStartupReady = false; });
        await enable.check();
        assert.equal(await page.evaluate(() => __badgeData.reads), 0, 'enabling only schedules the first query');
        await page.evaluate(() => { __tmTaskCountBadge.refresh(); });
        await page.waitForTimeout(50);
        assert.equal(await page.evaluate(() => __badgeData.reads + __badgeData.freshnessReads), 0, 'badge reads wait for plugin startup');
        await page.evaluate(() => { __taskHorizonPluginInstance._taskCountBadgeStartupReady = true; __tmTaskCountBadge.startAfterLoad(); });
        await waitCount(1);
        assert.equal(await page.locator('#nativeTopbar .tm-task-count-badge').innerText(), '1');
        assert.equal(await page.locator('.dock__item .tm-task-count-badge').innerText(), '1');
        assert.equal(await page.evaluate(() => __badgeData.reads), 1, 'both entries share one query');
        await page.getByRole('button', { name: '关闭设置', exact: true }).click();
        // Native document changes reach the real mutation bus with no task view.
        await page.evaluate(() => {
            __badgeTest.state.modal = null;
            const task = { ...__badgeData.rows[0], done: false };
            __tmTaskStore.upsertLocal(task);
            __badgeTest.nativePatch(task.id, { done: true, taskMarker: 'X', markdown: '- [X] 今天' }, task);
        });
        await waitCount(0);
        assert.equal(await page.locator('#nativeTopbar .tm-task-count-badge').isVisible(), false);
        assert.equal(await page.evaluate(() => __badgeData.reads), 1, 'cached native completion does not query documents');
        await page.evaluate(() => {
            __badgeTest.SettingsStore.data.taskCountBadge.hideZero = false;
            __tmTaskCountBadge.configure();
        });
        assert.equal(await page.locator('#nativeTopbar .tm-task-count-badge').innerText(), '0');
        assert.equal(await page.locator('#nativeTopbar .tm-task-count-badge').isVisible(), true);
        assert.equal(await page.evaluate(() => __badgeData.reads), 1, 'display settings do not repeat the query');
        await page.evaluate(() => {
            __badgeTest.SettingsStore.data.taskCountBadge.hideZero = true;
            __tmTaskCountBadge.configure();
        });
        await page.evaluate(() => {
            const task = __badgeData.rows[0];
            __badgeTest.nativePatch(task.id, { done: false, taskMarker: ' ', markdown: task.markdown }, task);
        });
        await waitCount(1);
        await page.evaluate(() => {
            const old = document.getElementById('nativeTopbar');
            const replacement = old.cloneNode(true);
            replacement.querySelector('.tm-task-count-badge')?.remove();
            old.replaceWith(replacement);
            __taskHorizonPluginInstance._taskWindowTopBarElement = replacement;
            __tmTaskCountBadge.render();
            __badgeTest.SettingsStore.data.taskCountBadge.topbar = false;
            __tmTaskCountBadge.configure();
        });
        assert.equal(await page.locator('#nativeTopbar .tm-task-count-badge').count(), 0);
        assert.equal(await page.locator('.dock__item .tm-task-count-badge').innerText(), '1');
        await page.evaluate(() => { __badgeTest.SettingsStore.data.taskCountBadge.topbar = true; __tmTaskCountBadge.configure(); });
        assert.equal(await page.locator('#nativeTopbar .tm-task-count-badge').innerText(), '1');
        await page.evaluate(() => {
            const task = __badgeData.rows[0];
            __tmTaskStore.applyMutation({ type: 'setDone', phase: 'optimistic', mutationId: 'badge-rollback', taskId: task.id, docId: task.root_id, patch: { done: true, taskMarker: 'X' } });
        });
        await waitCount(0);
        await page.evaluate(() => {
            const task = __badgeData.rows[0];
            __tmTaskStore.applyMutation({ type: 'setDone', phase: 'rollback', mutationId: 'badge-rollback', taskId: task.id, docId: task.root_id, inversePatch: { done: false, taskMarker: ' ' } });
        });
        await waitCount(1);
        // The native document click listener projects its marker immediately.
        await page.evaluate(() => {
            __badgeTest.nativeBind();
            const doc = document.createElement('div');
            doc.className = 'protyle-wysiwyg';
            doc.innerHTML = '<div data-node-id="20261010000001-task001" data-type="NodeListItem" data-subtype="t" data-task=" "><div class="protyle-action protyle-action--task"><svg><use href="#iconUncheck"/></svg></div><div data-node-id="20261010000005-text001" data-type="NodeParagraph">今天</div></div>';
            const protyle = document.createElement('div');
            protyle.className = 'protyle';
            protyle.append(doc);
            document.body.append(protyle);
            const action = doc.querySelector('.protyle-action--task');
            action.addEventListener('click', () => {
                doc.firstElementChild.dataset.task = 'X';
                doc.firstElementChild.classList.add('protyle-task--done');
            });
        });
        await page.locator('.protyle-action--task').click();
        await waitCount(0);
        await page.evaluate(() => {
            __badgeTest.nativePatch(__badgeData.rows[0].id, { done: false, taskMarker: ' ', markdown: __badgeData.rows[0].markdown }, __badgeData.rows[0]);
            __badgeTest.state.modal = null;
        });
        await waitCount(1);
        await page.evaluate(() => { __badgeTest.SettingsStore.data.docGroups[0].docs[0].recursive = true; });
        await configure({ scope: 'group', groupId: 'work' });
        await waitCount(2);
        await page.evaluate(() => { __badgeTest.SettingsStore.data.docGroups[0].excludedDocIds = ['20261010000000-doc0002']; });
        await configure({ scope: 'group', groupId: 'work' });
        await waitCount(1);
        await configure({ scope: 'group', groupId: 'work', ruleId: 'default_all', unfinishedOnly: false });
        await waitCount(2);
        // A user rule controls the count, independently of the current view rule.
        await configure({ scope: 'all', ruleId: 'default_today', unfinishedOnly: true });
        await waitCount(1);
        await page.evaluate(() => {
            const today = __badgeData.rows[0].completionTime;
            const task = { ...__badgeData.rows[0], id: '20261010000006-checkin', markdown: '- [ ] 打卡',
                repeatRule: { enabled: true, trigger: 'checkin', type: 'daily', every: 1, anchorDate: today },
                repeatState: {} };
            __badgeData.rows.push(task);
            __tmTaskStore.upsertLocal(task);
            __tmTaskCountBadge.refresh();
        });
        await waitCount(2);
        await page.evaluate(() => {
            const task = __badgeData.rows.at(-1);
            __badgeTest.nativePatch(task.id, { repeatState: { checkinHistory: [{ scheduledDate: task.completionTime, checkedAt: new Date().toISOString(), source: 'test' }] } }, task);
        });
        await waitCount(1);
        await configure({ unfinishedOnly: false });
        await waitCount(2);
        // In-flight results cannot replace a new local completion.
        await configure({ unfinishedOnly: true });
        await waitCount(1);
        await page.evaluate(() => { __badgeData.delay = 120; __tmTaskCountBadge.refresh(); });
        await page.waitForFunction(() => __badgeData.active === 1);
        await page.evaluate(() => {
            const task = __badgeData.rows[0];
            __badgeTest.nativePatch(task.id, { done: true, taskMarker: 'X', markdown: '- [X] 今天' }, task);
            task.markdown = '- [X] 今天';
        });
        await waitCount(0);
        await page.waitForFunction(() => __badgeData.active === 0);
        await page.waitForTimeout(350);
        assert.equal(await page.evaluate(() => __tmTaskCountBadge.getResult().count), 0);
        assert.equal(await page.evaluate(() => __badgeData.maxActive), 1, 'queries never overlap');
        await page.evaluate(() => { __badgeData.delay = 0; __badgeData.fail = true; __tmTaskCountBadge.refresh(); });
        await page.waitForFunction(() => __tmTaskCountBadge.getResult().status === 'error');
        assert.equal(await page.locator('#nativeTopbar .tm-task-count-badge').isVisible(), false, 'failed reads are not displayed as zero');
        await page.evaluate(() => { __badgeData.fail = false; __badgeData.truncated = true; __tmTaskCountBadge.refresh(); });
        await page.waitForFunction(() => __tmTaskCountBadge.getResult().status === 'partial');
        assert.match(await page.locator('#nativeTopbar').getAttribute('title'), /统计不完整/);
        await page.evaluate(() => {
            __badgeData.truncated = false;
            const source = __badgeData.rows[0];
            __badgeData.rows.push(...Array.from({ length: 2000 }, (_, index) => ({
                ...source, id: '20261010000100-' + String(index).padStart(7, '0'), markdown: '- [ ] 批量任务',
            })));
            __badgeData.longTasks = [];
            const observer = new PerformanceObserver(list => __badgeData.longTasks.push(...list.getEntries().map(entry => entry.duration)));
            observer.observe({ type: 'longtask' });
            __tmTaskCountBadge.refresh();
        });
        await waitCount(2000);
        assert.equal(await page.locator('#nativeTopbar .tm-task-count-badge').innerText(), '99+');
        assert.match(await page.locator('#nativeTopbar').getAttribute('title'), /2000/);
        console.log('2000-task count long tasks (ms):', await page.evaluate(() => __badgeData.longTasks));
        const beforeCache = await page.evaluate(() => __badgeData.reads);
        await page.evaluate(() => {
            __badgeData.rows.splice(25);
            __tmTaskSnapshotService.readTaskIndex = async ({ docIds }) => ({ taskTree: docIds.map(id => ({ id, tasks: __badgeData.rows.filter(row => row.root_id === id).map(row => ({ ...row })) })), missingDocIds: [], staleDocIds: [] });
            __tmTaskCountBadge.refresh();
        });
        await waitCount(20);
        assert.equal(await page.evaluate(() => __badgeData.reads), beforeCache, 'valid existing index avoids another task query');
        await configure({ enabled: false });
        assert.equal(await page.locator('.tm-task-count-badge-host').count(), 0);
        const reads = await page.evaluate(() => __badgeData.reads + __badgeData.freshnessReads);
        await page.evaluate(() => { window.dispatchEvent(new Event('focus')); __tmTaskCountBadge.refresh(); });
        await page.waitForTimeout(200);
        assert.equal(await page.evaluate(() => __badgeData.reads + __badgeData.freshnessReads), reads, 'disabled service stops work');
        await page.evaluate(() => tmOpenSettingsV2Page('appearance', 'l-icon'));
        assert.deepEqual(await panel.locator('select[onchange*="scope"] option').allTextContents(), ['全部已配置文档', '指定文档分组']);
        fs.mkdirSync(path.join(root, 'output/playwright'), { recursive: true });
        await page.waitForTimeout(250);
        await page.screenshot({ path: path.join(root, 'output/playwright/task-count-badge-settings.png') });
        assert.deepEqual(errors, []);
        console.log('task count badge: settings, shared queries, native completion/undo, check-in, scope, race and failure tests passed');
    } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
