'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
execFileSync(process.execPath, [path.join(__dirname, 'shortcut-sidebar-browser-fixture.js')], { cwd: root });
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const fixture = read('output/playwright/shortcut-sidebar-plugin.html');
const boot = '__tmApplyAppearanceThemeVars();load();applyFilters();render();';
assert.ok(fixture.includes(boot));
const html = fixture.replace(boot, `
    __tmApplyAppearanceThemeVars();
    __tmEnsureSettingsLoaded=async()=>SettingsStore.data;
    __tmRefreshNotebookCache=async()=>state.notebooks;
    __tmPromptInitialNotebookGroupImportIfNeeded=async()=>{};
    SettingsStore.data.selectedDocIds=[docA];
    SettingsStore.data.defaultViewMode='checklist';
    SettingsStore.save=async()=>{
        SettingsStore.syncToLocal();
        const response=await fetch('/fixture-settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
            shortcutItems:SettingsStore.data.shortcutItems,shortcutNavigationSessions:SettingsStore.data.shortcutNavigationSessions,
        })});
        if(!response.ok)throw new Error('Settings save failed');
    };
    window.shortcutPaints=[];
    const renderForTest=render;
    render=()=>{window.shortcutPaints.push([state.viewMode,state.currentRule]);return renderForTest();};
    window.shortcutBoot=(async()=>{
        const settings=await fetch('/fixture-settings').then(response=>response.json());
        Object.assign(SettingsStore.data,settings);
        return openManager({skipEnsureTabOpened:true,awaitInitialLoad:true});
    })();
`);

async function run() {
    let settingsFile={};
    const handler = (req, res) => {
        if(req.url==='/fixture-settings'){
            res.setHeader('content-type','application/json');
            if(req.method==='POST'){
                let body='';req.on('data',chunk=>{body+=chunk;});
                req.on('end',()=>{settingsFile=JSON.parse(body);res.end(JSON.stringify({code:0}));});
            }else res.end(JSON.stringify(settingsFile));
        } else if (req.url.endsWith('.css')) {
            res.setHeader('content-type', 'text/css');
            res.end(read(req.url.includes('basecoat') ? 'src/basecoat/basecoat.css' : 'task-horizon.css'));
        } else if (req.url.startsWith('/api/')) {
            res.setHeader('content-type', 'application/json');res.end(JSON.stringify({ code: 0, data: [] }));
        } else {
            res.setHeader('content-type', 'text/html; charset=utf-8');res.end(html);
        }
    };
    const server = http.createServer(handler), restartedServer=http.createServer(handler);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    await new Promise(resolve => restartedServer.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser = await chromium.launch({ headless: true,
            ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const ready = () => page.evaluate(() => window.shortcutBoot);
        await page.goto('http://127.0.0.1:' + server.address().port);
        await ready();
        await page.evaluate(async () => {
            await shortcutTest.seed();
            await shortcutTest.shortcuts.save([...shortcutTest.shortcuts.items(), {
                id: 'remember-board', name: '今日工作看板', groupId: 'work', docId: 'all', tabGroupId: '',
                viewId: 'kanban', ruleId: 'today-rule', groupMode: 'time', kanbanBoardMode: 'heading',
            }]);
        });
        await page.locator('[data-shortcut-id="remember-board"]').click();
        await page.waitForFunction(() => shortcutTest.shortcuts.activeId() === 'remember-board');
        const snapshot = () => page.evaluate(() => ({
            view: shortcutTest.state.viewMode, rule: shortcutTest.state.currentRule,
            group: shortcutTest.SettingsStore.data.currentGroupId,
            grouping: shortcutTest.groupMode(), board: shortcutTest.kanbanMode(),
            active: shortcutTest.shortcuts.activeId(),
            tasks: shortcutTest.state.filteredTasks.map(task => task.id).sort(),
            highlighted: document.querySelector('.tm-shortcut-go[aria-current="page"]')?.dataset.shortcutId || '',
        }));
        const before = await snapshot();
        assert.equal(before.view, 'kanban');assert.equal(before.rule, 'today-rule');
        assert.equal(before.tasks.length, 2);
        await page.evaluate(() => window.__TaskManagerCleanup());
        await page.reload();await ready();
        assert.deepEqual(await snapshot(), before, 'a real plugin cleanup and page reload restore the shortcut and its task projection');
        assert.deepEqual(await page.evaluate(() => window.shortcutPaints[0]), ['kanban', 'today-rule'],
            'the first rendered frame already uses the saved shortcut');
        assert.equal(await page.evaluate(() => shortcutTest.SettingsStore.data.currentRule), null,
            'remembering navigation does not rewrite the default rule');
        await page.evaluate(() => window.__TaskManagerCleanup());
        await page.close();
        const restartedPage=await browser.newPage({viewport:{width:1440,height:900}});
        restartedPage.on('pageerror',error=>errors.push(error.message));
        await restartedPage.goto('http://127.0.0.1:'+restartedServer.address().port);
        await restartedPage.evaluate(()=>window.shortcutBoot);
        const cold=await restartedPage.evaluate(()=>({
            view:shortcutTest.state.viewMode,rule:shortcutTest.state.currentRule,active:shortcutTest.shortcuts.activeId(),
            highlighted:document.querySelector('.tm-shortcut-go[aria-current="page"]')?.dataset.shortcutId||'',
            paints:window.shortcutPaints[0],
        }));
        assert.deepEqual(cold,{view:'kanban',rule:'today-rule',active:'remember-board',highlighted:'remember-board',paints:['kanban','today-rule']},
            'a new application origin restores the selection and first paint from plugin settings');
        await restartedPage.close();
        const returnedPage=await browser.newPage({viewport:{width:1440,height:900}});
        await returnedPage.goto('http://127.0.0.1:'+server.address().port);
        await returnedPage.evaluate(()=>window.shortcutBoot);
        await returnedPage.evaluate(async()=>{await window.tmSwitchDoc(shortcutTest.docA);await shortcutTest.SettingsStore.save();});
        await returnedPage.evaluate(()=>window.__TaskManagerCleanup());
        await returnedPage.goto('http://127.0.0.1:'+restartedServer.address().port);
        await returnedPage.evaluate(()=>window.shortcutBoot);
        assert.equal(await returnedPage.evaluate(()=>shortcutTest.shortcuts.activeId()),'',
            'leaving a shortcut clears its selection across application origins');
        await returnedPage.close();
        assert.deepEqual(errors, []);
        console.log('Shortcut browser restart: settings persistence across origins, cleanup, first paint, projection and manual exit passed.');
    } finally {
        await browser?.close();
        await new Promise(resolve => server.close(resolve));
        await new Promise(resolve => restartedServer.close(resolve));
    }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
