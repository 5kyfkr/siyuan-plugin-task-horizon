'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const { chromium } = require('./i18n-browser-fixture');
const root = path.resolve(__dirname, '..');
execFileSync(process.execPath, [path.join(__dirname, 'shortcut-sidebar-browser-fixture.js')], { cwd: root });
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const fixture = read('output/playwright/shortcut-sidebar-plugin.html');
const boot = '__tmApplyAppearanceThemeVars();load();applyFilters();render();';
assert.ok(fixture.includes(boot));
const html = fixture.replace(boot, `
    globalThis.__taskHorizonRuntimeClientKind='mobile-app';
    __tmSetMount(null);host.remove();
    __tmApplyAppearanceThemeVars();
    __tmEnsureSettingsLoaded=async()=>SettingsStore.data;
    __tmRefreshNotebookCache=async()=>state.notebooks;
    __tmPromptInitialNotebookGroupImportIfNeeded=async()=>{};
    SettingsStore.data.selectedDocIds=[docA,docB,docC];
    SettingsStore.data.defaultViewMode=new URLSearchParams(location.search).get('view')||'kanban';
    SettingsStore.data.defaultViewModeMobile=SettingsStore.data.defaultViewMode;
    window.mobileTest={paints:[],loads:[]};
    const renderForTest=render;
    render=()=>{
        const result=renderForTest();
        mobileTest.paints.push({view:state.viewMode,tasks:state.filteredTasks.map(task=>task.id).sort(),
            text:state.modal?.textContent||'',loading:state.uiInlineLoading===true});
        return result;
    };
    const loadForTest=loadSelectedDocuments;
    loadSelectedDocuments=async options=>{
        mobileTest.loads.push(options);
        return loadForTest(options);
    };
    mobileTest.open=async(entry='topbar',options={})=>{
        if(entry==='doc')await __tmOpenManagerFromDocTopbarEntry(options);
        else if(entry==='direct')await openManager({preserveViewMode:true,awaitInitialLoad:true,...options});
        else await __tmOpenManagerFromTopbarEntry();
        await state.__tmOpenManagerInFlight?.promise;
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    };
    mobileTest.openDock=async()=>{
        let dock=document.getElementById('mobileDockFixture');
        if(!dock){
            dock=document.createElement('div');dock.id='mobileDockFixture';
            dock.dataset.tmHostMode='dock';dock.dataset.tmUiMode='mobile';
            dock.setAttribute('data-task-horizon-dock-root','1');
            document.body.appendChild(dock);
        }
        globalThis.__taskHorizonMount(dock);
        await state.__tmOpenManagerInFlight?.promise;
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    };
    mobileTest.setDirty=kind=>{
        if(kind==='external')state.externalTaskTxDirty=true;
        if(kind==='sync')state.__tmSyncedDataReloadPending=true;
        if(kind==='custom')state.__tmPendingCustomFieldFreshOpenAt=Date.now();
        if(kind==='local')state.pendingDeletedTasks=new Set(['20261014000000-taskaaa']);
    };
    mobileTest.clearDirty=()=>{
        state.externalTaskTxDirty=false;state.__tmSyncedDataReloadPending=false;
        state.__tmPendingCustomFieldFreshOpenAt=0;state.pendingDeletedTasks=new Set();
    };
    window.mobileBoot=mobileTest.open();
`);

async function run() {
    const server = http.createServer((req, res) => {
        if (req.url.endsWith('.css')) {
            res.setHeader('content-type', 'text/css');
            res.end(read(req.url.includes('basecoat') ? 'src/basecoat/basecoat.css' : 'task-horizon.css'));
        } else if (req.url.startsWith('/api/')) {
            res.setHeader('content-type', 'application/json');res.end(JSON.stringify({code:0,data:[]}));
        } else {
            res.setHeader('content-type', 'text/html; charset=utf-8');res.end(html);
        }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser=await chromium.launch({headless:true,
            ...(process.env.PLAYWRIGHT_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE}:{})});
        for(const view of ['kanban','checklist']){
        const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
        const errors=[];
        page.on('pageerror',error=>errors.push(error.message));
        await page.goto('http://127.0.0.1:'+server.address().port+'/?view='+view);
        await page.evaluate(()=>window.mobileBoot);
        const snapshot=()=>page.evaluate(()=>({
            loads:mobileTest.loads.length,paints:mobileTest.paints.length,
            tasks:shortcutTest.state.filteredTasks.map(task=>task.id).sort(),
            modal:!!shortcutTest.state.modal,gate:!!shortcutTest.state.__tmOpenManagerInFlight,
        }));
        const initial=await snapshot();
        assert.equal(initial.loads,1,'cold open must load tasks');
        assert.equal(initial.tasks.length,3);
        assert.equal(await page.evaluate(()=>shortcutTest.state.viewMode),view);
        for(const entry of ['topbar','doc','direct']){
            const before=await snapshot();
            await page.evaluate(entry=>mobileTest.open(entry),entry);
            const after=await snapshot();
            assert.equal(after.loads,before.loads,entry+': activating the visible page does not query tasks');
            assert.equal(after.paints,before.paints,entry+': activating the visible page preserves its DOM');
        }
        for(const entry of ['topbar','doc','direct','doc','topbar']){
            await page.locator('[ontouchend="tmClose(event)"]').dispatchEvent('touchend');
            assert.equal((await snapshot()).modal,false,'the actual close button removes the fullscreen shell');
            const before=await snapshot();
            await page.evaluate(entry=>mobileTest.open(entry),entry);
            const after=await snapshot();
            assert.equal(after.loads,before.loads,entry+': reopening clean loaded tasks must not load again');
            assert.equal(after.paints,before.paints+1,entry+': reopening renders a populated shell exactly once');
            assert.deepEqual(after.tasks,initial.tasks);
            assert.equal(after.modal,true);assert.equal(after.gate,false);
            const paint=await page.evaluate(()=>mobileTest.paints.at(-1));
            assert.deepEqual(paint.tasks,initial.tasks,entry+': first render already contains the task projection');
            assert.ok(paint.text.includes('今日产品任务'),entry+': first render contains task cards');
            assert.equal(paint.loading,false);
        }
        await page.evaluate(()=>window.tmClose());
        const beforeRuleChange=await snapshot();
        await page.evaluate(async()=>{
            shortcutTest.SettingsStore.data.viewProfiles.global.ruleId='today-rule';
            await mobileTest.open('direct');
        });
        const afterRuleChange=await snapshot();
        assert.equal(afterRuleChange.loads,beforeRuleChange.loads,'a built-in rule change reprojects loaded tasks without querying them');
        assert.equal(afterRuleChange.paints,beforeRuleChange.paints+1);
        assert.deepEqual(await page.evaluate(()=>mobileTest.paints.at(-1).tasks),
            ['20261014000000-taskaaa','20261014000000-taskccc'],
            'the first render after closing already applies the new rule');
        for(const kind of ['external','sync','custom','local']){
            await page.evaluate(()=>window.tmClose());
            const before=await snapshot();
            await page.evaluate(async kind=>{mobileTest.setDirty(kind);await mobileTest.open('direct');},kind);
            assert.equal((await snapshot()).loads,before.loads+1,kind+': dirty tasks still use the loader');
            await page.evaluate(()=>mobileTest.clearDirty());
        }
        for(const kind of ['external','sync','custom','local']){
            const before=await snapshot();
            await page.evaluate(async kind=>{mobileTest.setDirty(kind);await mobileTest.open('topbar');},kind);
            assert.equal((await snapshot()).loads,before.loads+1,kind+': activating a dirty visible page must still refresh');
            await page.evaluate(()=>mobileTest.clearDirty());
        }
        await page.evaluate(()=>window.tmClose());
        const beforeGroupChange=await snapshot();
        await page.evaluate(async()=>{
            shortcutTest.SettingsStore.data.docGroups.find(group=>group.id==='work').docs=[shortcutTest.docA,shortcutTest.docB];
            await mobileTest.open('doc',{forceLocate:true,docId:shortcutTest.docB});
        });
        assert.equal((await snapshot()).loads,beforeGroupChange.loads+1,'changing group must load its own scope');
        assert.equal(await page.evaluate(()=>shortcutTest.SettingsStore.data.currentGroupId),'work');
        await page.evaluate(()=>mobileTest.openDock());
        assert.equal(await page.evaluate(()=>shortcutTest.state.modal.parentElement.id),'mobileDockFixture');
        const beforeDockActivation=await snapshot();
        await page.evaluate(()=>mobileTest.openDock());
        assert.equal((await snapshot()).loads,beforeDockActivation.loads,'activating the mounted mobile Dock preserves its tasks');
        assert.equal((await snapshot()).paints,beforeDockActivation.paints,'activating the mounted mobile Dock preserves its DOM');
        await page.evaluate(()=>mobileTest.open('topbar'));
        assert.equal(await page.evaluate(()=>shortcutTest.state.modal.parentElement===document.body),true,
            'the fullscreen entry switches out of the mobile Dock');
        await page.evaluate(()=>mobileTest.openDock());
        assert.equal(await page.evaluate(()=>shortcutTest.state.modal.parentElement.id),'mobileDockFixture',
            'the existing mount flow can return to the mobile Dock');
        assert.ok((await snapshot()).tasks.length>0,'returning to the Dock still displays its tasks');
        assert.deepEqual(errors,[]);
        await page.close();
        }
        console.log('Mobile fullscreen: kanban/checklist, visible activation, ten close/reopen cycles, first render, dirty states, changed scope and mobile Dock switching passed.');
    } finally {
        await browser?.close();
        await new Promise(resolve=>server.close(resolve));
    }
}

run().catch(error=>{console.error(error);process.exitCode=1;});
