'use strict';
// Runs production UI and filtering against the existing isolated shortcut fixture.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {execFileSync} = require('node:child_process');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.join(__dirname, '..');
execFileSync(process.execPath,[path.join(__dirname,'shortcut-sidebar-browser-fixture.js')],{cwd:root});
const read = file => fs.readFileSync(path.join(root,file),'utf8');
const fixture = read('output/playwright/shortcut-sidebar-plugin.html').replace(
    "const host=document.getElementById('host');", "window.dateFilterTestRefresh=__tmRefreshTaskTimeAcrossViews;const host=document.getElementById('host');").replace(
    '__tmApplyAppearanceThemeVars();load();applyFilters();render();', `
    const dateTestHost=new URLSearchParams(location.search).get('host');
    if(dateTestHost==='mobile') {
        globalThis.__taskHorizonRuntimeClientKind='mobile-app';host.dataset.tmUiMode='mobile';
    } else if(dateTestHost==='dock') {
        globalThis.__taskHorizonRuntimeClientKind='desktop-browser';host.dataset.tmHostMode='dock';
    }
    __tmApplyAppearanceThemeVars();load();applyFilters();render();`);

(async () => {
    const server = http.createServer((req,res) => {
        if (req.url.startsWith('/api/')) { res.setHeader('content-type','application/json');res.end(JSON.stringify({code:0,data:[]})); }
        else if (req.url.endsWith('.css')) { res.setHeader('content-type','text/css');res.end(read(req.url.includes('basecoat')?'src/basecoat/basecoat.css':'task-horizon.css')); }
        else { res.setHeader('content-type','text/html; charset=utf-8');res.end(fixture); }
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const browser = await chromium.launch({headless:true,
        ...(process.env.PLAYWRIGHT_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE}:{})})
        .catch(async error=>{await new Promise(resolve=>server.close(resolve));throw error;});
    const page = await browser.newPage({viewport:{width:1440,height:960}});
    page.setDefaultTimeout(8000);
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    const output=path.join(root,'output/playwright/date-filter');fs.mkdirSync(output,{recursive:true});
    const shot=name=>page.screenshot({path:path.join(output,name+'.png'),animations:'disabled'});
    try {
        for(const host of ['mobile','dock']) {
            for(const week of [false,true]) await testMobileDateRange(browser,'http://127.0.0.1:'+server.address().port,output,{host,week});
        }
        await page.goto('http://127.0.0.1:'+server.address().port);
        const dates=await page.evaluate(async()=>{
            const test=shortcutTest,s=test.state;
            const today=__tmDateFilter.signature() || test.state.flatTasks['20261014000000-taskaaa'].completionTime;
            const date=new Date(today+'T12:00:00');date.setDate(date.getDate()+1);
            const tomorrow=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
            s.flatTasks['20261014000000-taskbbb'].completionTime=tomorrow;
            await test.shortcuts.save([{id:'date-all',name:'全部测试任务',groupId:'all',docId:'all',viewId:'checklist',ruleId:''}]);
            await test.shortcuts.open('date-all');
            return {today,tomorrow};
        });
        const calendarPage=()=>page.locator('.tm-date-filter-page:not(.tm-date-filter-page-ghost) > [data-tm-filter-days]');
        const day=value=>calendarPage().locator(`[data-tm-filter-date="${value}"]`);
        const center=locator=>locator.evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
        await page.waitForFunction(()=>document.querySelector('[data-shortcut-count="date-all"]')?.textContent==='3');
        const countsBefore=await page.evaluate(()=>Object.entries(localStorage).filter(([key])=>key.includes('tm_shortcut_counts')));
        assert.equal(await day(dates.tomorrow).locator('.tm-date-filter-dot').count(),1);
        await day(dates.today).click();
        await page.waitForFunction(()=>shortcutTest.state.filteredTasks.length===2 && __tmDateFilter.count()===2);
        assert.equal(await page.locator('.tm-date-filter-summary').count(),0,'Do not render a date-match banner above the task list');
        assert.equal(await page.locator('.tm-main-stage').evaluate(el=>el.firstElementChild?.classList.contains('tm-date-filter-summary')||false),false,'The task list begins in its original position');
        assert.equal(await day(dates.tomorrow).locator('.tm-date-filter-dot').count(),1,'Other dates retain their dots while one day is selected');
        await page.waitForFunction(()=>document.querySelector('[data-shortcut-count="date-all"]')?.textContent==='3');
        assert.deepEqual(await page.evaluate(()=>Object.entries(localStorage).filter(([key])=>key.includes('tm_shortcut_counts'))),countsBefore,'Temporary counts must not overwrite shortcut counts');
        const filteredSignature=await page.evaluate(()=>shortcutTest.viewSignature());
        await shot('expanded');
        await page.locator('[data-shortcut-action="collapse"]').click();
        await page.locator('.tm-date-filter-trigger').click();
        assert.equal(await page.locator('.tm-date-filter-flyout').isVisible(),true);
        await day(dates.tomorrow).click();
        await page.waitForFunction(()=>shortcutTest.state.filteredTasks.length===1);
        assert.equal(await page.locator('.tm-date-filter-flyout').isVisible(),true,'Choosing dates keeps the shared popup open through shell rerenders');
        await shot('flyout');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.tm-date-filter-flyout').isVisible(),false);
        assert.equal(await page.evaluate(()=>shortcutTest.state.filteredTasks.length),1);
        await page.locator('[data-shortcut-action="expand"]').click();
        await page.locator('[data-tm-filter-action="view"]').click();
        assert.equal(await day(dates.tomorrow).count(),1);
        assert.equal(await calendarPage().locator('[data-tm-filter-date]').count(),7);
        await shot('week');
        await page.locator('[data-tm-filter-action="view"]').click();
        await day(dates.tomorrow).click();
        await page.waitForFunction(()=>shortcutTest.state.filteredTasks.length===3);
        assert.notEqual(await page.evaluate(()=>shortcutTest.viewSignature()),filteredSignature,'Snapshots distinguish date scopes');
        await page.locator('[data-tm-filter-action="next"]').click();
        await assertFullPageSlide(page,1);
        await page.locator('[data-tm-filter-action="prev"]').click();
        await assertFullPageSlide(page,-1);

        const from=await center(day(dates.today)),to=await center(day(dates.tomorrow));
        await page.mouse.move(from.x,from.y);await page.mouse.down();
        const outlines=await day(dates.today).evaluate(el=>[getComputedStyle(el).outlineStyle,getComputedStyle(el.firstElementChild).outlineStyle]);
        assert.deepEqual(outlines,['none','none']);
        await page.mouse.move(to.x,to.y,{steps:8});
        assert.equal(await page.evaluate(()=>shortcutTest.state.dateFilter),null,'Dragging previews without filtering tasks');
        await page.mouse.up();
        await page.waitForFunction(()=>shortcutTest.state.dateFilter?.from!==shortcutTest.state.dateFilter?.to);
        assert.equal(await page.evaluate(()=>shortcutTest.state.filteredTasks.length),3);
        await day(dates.today).click();
        await page.waitForFunction(()=>shortcutTest.state.filteredTasks.length===2);
        // Change an existing task's date through the real local refresh entry point.
        await page.evaluate(tomorrow=>{
            const t=shortcutTest.state.flatTasks['20261014000000-taskaaa'];t.completionTime=tomorrow;
            window.dateFilterTestRefresh(t.id,{patch:{completionTime:tomorrow}});
        },dates.tomorrow);
        await page.waitForFunction(()=>shortcutTest.state.filteredTasks.length===1 && __tmDateFilter.count()===1);
        await page.evaluate(tomorrow=>__tmDateFilter.setRange(tomorrow),dates.tomorrow);
        await page.waitForFunction(()=>shortcutTest.state.filteredTasks.length===2);
        await page.evaluate(()=>__tmDateFilter.setRange('2098-12-31'));
        await page.waitForFunction(()=>shortcutTest.state.filteredTasks.length===0 && __tmDateFilter.count()===0);
        const calendarFallback=await page.evaluate(()=>window.tmRenderCalendarTaskTableHtml());
        assert.ok(!calendarFallback.includes('今日产品任务') && !calendarFallback.includes('明日产品任务'),'Calendar task table must not fall back from zero matches to all tasks');
        await page.evaluate(()=>__tmDateFilter.setRange(null));
        await page.waitForFunction(()=>shortcutTest.state.filteredTasks.length===3);
        await page.evaluate(async()=>{
            await shortcutTest.shortcuts.save([
                {id:'date-all',name:'全部测试任务',groupId:'all',docId:'all',viewId:'checklist',ruleId:''},
                {id:'date-list',name:'列表测试',groupId:'all',docId:'all',viewId:'list',ruleId:''},
            ]);
            __tmDateFilter.setRange('2098-12-31');
            window.dateShortcutOpened=await shortcutTest.shortcuts.open('date-list');
        });
        await page.waitForFunction(()=>window.dateShortcutOpened===true && shortcutTest.state.dateFilter===null);
        await page.waitForFunction(()=>shortcutTest.state.filteredTasks.length===3,'Shortcut transition restores the full task set');
        await page.evaluate(()=>__tmDateFilter.setRange('2098-12-31'));
        await page.evaluate(()=>tmSwitchViewMode('kanban'));
        await page.waitForFunction(()=>shortcutTest.state.viewMode==='kanban');
        assert.deepEqual(await page.evaluate(()=>shortcutTest.state.dateFilter),{from:'2098-12-31',to:'2098-12-31'},'Changing views inside the same shortcut keeps the date range');
        await page.evaluate(async()=>{window.sameDateShortcutOpened=await shortcutTest.shortcuts.open('date-list');});
        await page.waitForFunction(()=>window.sameDateShortcutOpened===true && shortcutTest.state.viewMode==='list');
        assert.deepEqual(await page.evaluate(()=>shortcutTest.state.dateFilter),{from:'2098-12-31',to:'2098-12-31'},'Reopening the same shortcut keeps its date range');
        await page.evaluate(async()=>{window.otherDateShortcutOpened=await shortcutTest.shortcuts.open('date-all');});
        await page.waitForFunction(()=>window.otherDateShortcutOpened===true && shortcutTest.state.dateFilter===null);
        // Nested tasks use the real shared projection; out-of-range siblings stay hidden.
        await page.evaluate(today=>{
            const s=shortcutTest.state,doc=s.taskTree[0],parent={id:'20261026000000-parenta',root_id:doc.id,content:'日期上下文父任务',children:[]};
            const child={id:'20261026000000-childaa',root_id:doc.id,parentTaskId:parent.id,content:'日期匹配子任务',completionTime:today,children:[]};
            const other={id:'20261026000000-childbb',root_id:doc.id,parentTaskId:parent.id,content:'其他日期子任务',completionTime:'2099-01-01',children:[]};
            parent.children=[child,other];doc.tasks.push(parent);Object.assign(s.flatTasks,{[parent.id]:parent,[child.id]:child,[other.id]:other});
            s.taskTree=s.taskTree.slice();
            __tmDateFilter.setRange(today);
        },dates.today);
        await page.waitForFunction(()=>shortcutTest.state.filteredTasks.some(task=>task.id==='20261026000000-childaa'));
        const ids=await page.evaluate(()=>shortcutTest.state.filteredTasks.map(task=>task.id));
        assert.ok(ids.includes('20261026000000-parenta'),'Keep the ancestor as context');
        assert.ok(!ids.includes('20261026000000-childbb'),'Do not expand unrelated sibling dates');
        await page.evaluate(()=>{shortcutTest.state.activeDocId=shortcutTest.docA;shortcutTest.applyFilters();shortcutTest.render();});
        const nested=page.locator('.tm-checklist-item[data-id="20261026000000-childaa"]');
        if (!await nested.isVisible()) await page.locator('.tm-checklist-item[data-id="20261026000000-parenta"] .tm-tree-toggle').first().click();
        await nested.waitFor({state:'visible'});
        assert.equal(await page.locator('.tm-checklist-item[data-id="20261026000000-childbb"]').count(),0,'Rendered hierarchy excludes out-of-range siblings');
        assert.equal(await page.evaluate(()=>__tmDateFilter.count()),1,'Context ancestors are not counted as matches');
        for (const view of ['list','checklist','kanban','timeline','whiteboard','calendar']) {
            await page.evaluate(view=>{shortcutTest.state.viewMode=view;shortcutTest.applyFilters();},view);
            assert.ok((await page.evaluate(()=>shortcutTest.state.filteredTasks.map(task=>task.id))).includes('20261026000000-childaa'),view+': same task date projection');
        }
        await page.evaluate(()=>{shortcutTest.state.viewMode='checklist';shortcutTest.applyFilters();shortcutTest.render();});
        await page.setViewportSize({width:1024,height:480});
        const dock=await page.locator('.tm-date-filter-dock').boundingBox();
        assert.ok(dock.y+dock.height<=481,'Short host must contain the calendar dock');
        await shot('short-host');
        await page.locator('[data-shortcut-action="collapse"]').click();
        await page.locator('.tm-date-filter-trigger').click();
        const popup=await page.locator('.tm-date-filter-flyout').boundingBox();
        assert.ok(popup.y>=0 && popup.y+popup.height<=480,'Flyout must fit the plugin host');
        await page.keyboard.press('Escape');
        await page.evaluate(async()=>{__tmDateFilter.setRange('2098-12-31');await tmSwitchDocGroup('work');});
        await page.waitForFunction(()=>shortcutTest.SettingsStore.data.currentGroupId==='work' && shortcutTest.state.dateFilter===null);
        await page.evaluate(()=>__tmDateFilter.setRange('2098-12-31'));
        await page.evaluate(async()=>{await tmSwitchDocGroup('work');});
        assert.deepEqual(await page.evaluate(()=>shortcutTest.state.dateFilter),{from:'2098-12-31',to:'2098-12-31'},'Reselecting the current document group keeps its date range');
        await page.evaluate(async()=>{__tmDateFilter.setRange('2098-12-31');await tmSwitchDoc(shortcutTest.docA);});
        await page.waitForFunction(()=>shortcutTest.state.activeDocId===shortcutTest.docA && shortcutTest.state.dateFilter===null);
        await page.evaluate(()=>__tmDateFilter.setRange('2098-12-31'));
        await page.evaluate(async()=>{await tmSwitchDoc(shortcutTest.docA);});
        assert.deepEqual(await page.evaluate(()=>shortcutTest.state.dateFilter),{from:'2098-12-31',to:'2098-12-31'},'Reselecting the current document tab keeps its date range');
        await page.evaluate(async()=>{__tmDateFilter.setRange('2098-12-31');await tmSwitchDocTabCustomGroup('iteration');});
        await page.waitForFunction(()=>shortcutTest.state.activeDocId==='__tm_doc_tab_group__:iteration' && shortcutTest.state.dateFilter===null);
        await page.evaluate(()=>{shortcutTest.SettingsStore.data.shortcutSidebarEnabled=false;shortcutTest.sidebar.syncEnabled();});
        assert.equal(await page.locator('.tm-date-filter-flyout').count(),0,'Disabling sidebar disposes its portal');
        assert.equal(await page.locator('.tm-date-filter-calendar').count(),0);
        await page.evaluate(()=>{shortcutTest.SettingsStore.data.shortcutSidebarEnabled=true;shortcutTest.sidebar.syncEnabled();});
        assert.equal(await page.locator('.tm-date-filter-flyout').count(),1,'Re-enabling mounts one portal');
        assert.equal(await page.locator('.tm-date-filter-calendar').count(),1,'Re-enabling mounts one shared calendar');
        assert.deepEqual(errors,[]);
        for (const options of [{week:false,rail:false},{week:true,rail:false},{week:false,rail:true},{week:true,rail:true},{week:false,rail:true,reduced:true},{week:true,rail:true,touch:true}]) {
            await testDatePaging(browser, 'http://127.0.0.1:'+server.address().port, output, options);
        }
        console.log('Shortcut date filter browser: real filtering, counts, shared calendar, drag, hierarchy, view projection, zero-result isolation and disposal passed');
    } finally { await browser.close();await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1;});

async function testMobileDateRange(browser,url,output,{host,week}) {
    const name=`${host}-${week?'week':'month'}`;
    const page=await browser.newPage({viewport:{width:host==='mobile'?390:460,height:844},isMobile:host==='mobile',hasTouch:true});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    const grid=()=>page.locator('[data-tm-filter-days]');
    const readDates=()=>grid().evaluate(el=>Array.from(el.children,node=>{
        const r=node.getBoundingClientRect();return {value:node.dataset.tmFilterDate,x:r.left+r.width/2,y:r.top+r.height/2};
    }));
    const selection=()=>page.evaluate(()=>shortcutTest.state.dateFilter);
    const sortedRange=(a,b)=>({from:a<b?a:b,to:a<b?b:a});
    const cdp=await page.context().newCDPSession(page);
    const touch=(type,point)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:point?[{x:point.x,y:point.y}]:[]});
    try {
        await page.goto(url+'/?host='+host);
        await page.locator('.tm-mobile-bottom-viewbar').waitFor({state:'visible'});
        await page.locator('.tm-shortcut-edge').tap();
        await page.waitForFunction(()=>document.querySelector('.tm-shortcut-layout')?.dataset.shortcutMode==='drawer');
        await page.waitForFunction(()=>document.querySelector('.tm-shortcut-sidebar').getAnimations().length===0);
        if(week) await page.locator('[data-tm-filter-action="view"]').tap();
        // Test real hit targets where the two surfaces actually overlap.
        const overlap=await page.evaluate(()=>{
            const sidebar=document.querySelector('.tm-shortcut-sidebar'),bar=document.querySelector('.tm-mobile-bottom-viewbar');
            const a=sidebar.getBoundingClientRect(),b=bar.getBoundingClientRect();
            const x=(Math.max(a.left,b.left)+Math.min(a.right,b.right))/2;
            const y=(Math.max(a.top,b.top)+Math.min(a.bottom,b.bottom))/2;
            return {overlaps:x>=a.left&&x<a.right&&y>=a.top&&y<a.bottom&&x>=b.left&&x<b.right&&y>=b.top&&y<b.bottom,
                sidebarOnTop:sidebar.contains(document.elementFromPoint(x,y))};
        });
        assert.equal(overlap.overlaps,true,name+': fixture includes the bottom-bar overlap');
        assert.equal(overlap.sidebarOnTop,true,name+': sidebar receives touches above the bottom view bar');
        let dates=await readDates();
        const start=dates[week?2:10],end=dates[week?4:17];
        const scrollBefore=await page.locator('.tm-date-filter-dock').evaluate(el=>el.scrollTop);
        await touch('touchStart',start);
        await touch('touchMove',end);
        assert.equal(await selection(),null,name+': touch drag only previews before release');
        assert.equal(await page.locator('[data-tm-filter-date="'+end.value+'"]').getAttribute('aria-pressed'),'true',name+': touch movement previews the endpoint');
        await touch('touchEnd');
        assert.deepEqual(await selection(),sortedRange(start.value,end.value),name+': touch release commits the date range');
        assert.equal(await page.locator('.tm-date-filter-dock').evaluate(el=>el.scrollTop),scrollBefore,name+': dragging dates does not scroll the calendar');
        // Reach the edge, hold through animation, then finish on the next page.
        await page.evaluate(()=>__tmDateFilter.setRange(null));
        dates=await readDates();const anchor=dates[week?2:10],edge=dates.at(-1),first=dates[0].value;
        await touch('touchStart',anchor);await touch('touchMove',edge);
        await page.waitForFunction(first=>document.querySelector('[data-tm-filter-days]').firstElementChild.dataset.tmFilterDate!==first,first);
        const newFirst=(await readDates())[0].value;
        await page.waitForTimeout(350);
        assert.equal((await readDates())[0].value,newFirst,name+': touch edge holds without repeated paging');
        const endpoint=(await readDates())[week?3:14];
        await touch('touchMove',endpoint);await touch('touchEnd');
        assert.deepEqual(await selection(),sortedRange(anchor.value,endpoint.value),name+': touch drag spans pages');
        // A cancelled contact preserves the previous range and releases capture.
        const committed=await selection();dates=await readDates();
        await touch('touchStart',dates[2]);await touch('touchMove',dates[4]);await touch('touchCancel');
        assert.deepEqual(await selection(),committed,name+': cancellation preserves the committed range');
        assert.equal(await page.locator('.tm-date-filter-calendar.is-selecting').count(),0,name+': cancellation ends the gesture');
        await page.screenshot({path:path.join(output,'touch-'+name+'.png'),animations:'disabled'});
        await page.locator('.tm-shortcut-scrim').tap({position:{x:host==='mobile'?360:420,y:400}});
        await page.locator('.tm-mobile-bottom-viewbar [data-tm-view-mode="list"]').tap();
        await page.waitForFunction(()=>shortcutTest.state.viewMode==='list');
        assert.deepEqual(await selection(),committed,name+': bottom-bar view changes preserve the range');
        await page.evaluate(()=>{shortcutTest.SettingsStore.data.shortcutSidebarEnabled=false;shortcutTest.sidebar.syncEnabled();});
        assert.equal(await page.locator('.tm-mobile-bottom-viewbar').count(),1,name+': disabling the sidebar preserves the bottom view bar');
        await page.locator('.tm-mobile-bottom-viewbar [data-tm-view-mode="checklist"]').tap();
        await page.waitForFunction(()=>shortcutTest.state.viewMode==='checklist');
        await page.evaluate(()=>{shortcutTest.SettingsStore.data.shortcutSidebarEnabled=true;shortcutTest.sidebar.syncEnabled();});
        await page.locator('.tm-shortcut-edge').tap();
        await page.waitForFunction(()=>document.querySelector('.tm-shortcut-sidebar').getAnimations().length===0);
        dates=await readDates();
        await page.touchscreen.tap(dates[3].x,dates[3].y);
        assert.deepEqual(await selection(),{from:dates[3].value,to:dates[3].value},name+': remounting keeps one set of gesture listeners');
        assert.deepEqual(errors,[],name+': no runtime errors');
        console.log('Date touch range passed: '+name);
    } finally { await cdp.detach();await page.close(); }
}

async function testDatePaging(browser,url,output,options) {
    const name=`${options.week?'week':'month'}-${options.rail?'popup':'inline'}${options.reduced?'-reduced':''}${options.touch?'-touch':''}`;
    const page=await browser.newPage({viewport:{width:1100,height:820},hasTouch:!!options.touch,reducedMotion:options.reduced?'reduce':'no-preference'});
    page.setDefaultTimeout(8000);
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    const grid=()=>page.locator('[data-tm-filter-days]');
    const readGrid=()=>grid().evaluate(el=>{
        const rect=el.getBoundingClientRect();
        return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,
            dates:Array.from(el.children,node=>{const r=node.getBoundingClientRect();return {value:node.dataset.tmFilterDate,x:r.left+r.width/2,y:r.top+r.height/2};})};
    });
    const firstDate=()=>grid().locator('[data-tm-filter-date]').first().getAttribute('data-tm-filter-date');
    const getRange=()=>page.evaluate(()=>shortcutTest.state.dateFilter);
    const sortedRange=(a,b)=>({from:a<b?a:b,to:a<b?b:a});
    const move=point=>page.mouse.move(point.x,point.y,{steps:6});
    const stepKey=(value,amount)=>{
        const date=new Date(value+'T12:00:00');
        if(options.week) date.setDate(date.getDate()+amount*7);
        else { date.setDate(15);date.setMonth(date.getMonth()+amount); }
        return options.week ? date.toISOString().slice(0,10) : `${date.getFullYear()}年${date.getMonth()+1}月`;
    };
    const pageKey=()=>options.week?firstDate():page.locator('[data-tm-filter-month]').innerText();
    try {
        await page.goto(url);
        if(options.week) await page.locator('[data-tm-filter-action="view"]').click();
        if(options.rail) { await page.locator('[data-shortcut-action="collapse"]').click();await page.locator('.tm-date-filter-trigger').click(); }
        let data=await readGrid();
        assert.equal(data.dates.length,options.week?7:42,name+': one live grid');
        const middle=data.dates[Math.floor(data.dates.length/2)],last=data.dates.at(-1);
        const initialKey=await pageKey();
        const reference=options.week?data.dates[0].value:await page.locator('[data-tm-filter-month]').evaluate(el=>el.textContent.replace('年','-').replace('月','-15'));
        await move(last);await page.waitForTimeout(200);
        assert.equal(await pageKey(),initialKey,name+': hovering an edge does not page');
        await move(middle);await page.mouse.down();
        await page.mouse.wheel(0,100);
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        assert.equal(await pageKey(),initialKey,name+': wheel input cannot page during a range drag');
        await page.mouse.move(data.right+16,middle.y);
        assert.equal(await pageKey(),initialKey,name+': outside the grid does not page');
        // Return directly to the interior; intermediate week-edge coordinates
        // would be a real date hit and legitimately turn the page.
        await page.mouse.move(middle.x,middle.y);
        if(!options.week) {
            await move(data.dates.at(-2));await page.waitForTimeout(200);
            assert.equal(await pageKey(),initialKey,name+': penultimate day does not page');
        }
        await move(last);
        assert.equal(await pageKey(),stepKey(reference,1),name+': edge entry advances one page');
        assert.equal(await getRange(),null,name+': dragging is a preview until release');
        assert.equal(await page.locator('[data-tm-filter-days]').count(),1,name+': animation contributes no live grid');
        assert.equal(await page.locator('[data-tm-filter-date]').count(),options.week?7:42,name+': animation contributes no date targets');
        if(options.reduced) assert.equal(await page.locator('.tm-date-filter-page-ghost').count(),0,name+': reduced motion uses immediate presentation');
        else assert.equal(await page.locator('.tm-date-filter-slide-page').count(),2,name+': both pages slide through the full viewport');
        const expectedOne=await pageKey();
        // Exercise real pointer movement throughout animation, not merely sleep.
        for(let i=0;i<16;i++) {
            await page.mouse.move(last.x+(i%2?0.4:-0.4),last.y);
            await page.waitForTimeout(25);
            assert.equal(await pageKey(),expectedOne,name+': edge jitter/animation must not rearm paging');
        }
        data=await readGrid();
        await page.mouse.move(data.right+16,last.y);await move(data.dates.at(-1));
        assert.equal(await pageKey(),expectedOne,name+': leaving and returning to the same edge stays latched');
        const nextMiddle=data.dates[Math.floor(data.dates.length/2)];
        await move(nextMiddle);await move(data.dates.at(-1));
        assert.equal(await pageKey(),stepKey(reference,2),name+': interior reentry enables exactly one more page');
        data=await readGrid();
        await move(data.dates[Math.floor(data.dates.length/2)]);await move(data.dates[0]);
        assert.equal(await pageKey(),stepKey(reference,1),name+': same drag can reverse direction');
        for(let i=0;i<10;i++) {
            await page.mouse.move(data.dates[0].x+(i%2?0.4:-0.4),data.dates[0].y);
            await page.waitForTimeout(25);
            assert.equal(await pageKey(),expectedOne,name+': reverse edge stays latched');
        }
        data=await readGrid();
        const endpoint=data.dates[Math.floor(data.dates.length/2)];
        await move(endpoint);await page.mouse.up();
        assert.deepEqual(await getRange(),sortedRange(middle.value,endpoint.value),name+': original anchor survives every page');
        await page.waitForTimeout(250);
        assert.equal(await page.locator('.tm-date-filter-page-ghost').count(),0,name+': animation cleans up');
        const finishedKey=await pageKey();
        await move(data.dates.at(-1));await page.waitForTimeout(180);
        assert.equal(await pageKey(),finishedKey,name+': release ends paging');
        // Cancelled gestures never commit their preview, even after paging.
        const beforeCancel=await getRange();
        await move(endpoint);await page.mouse.down();await move(data.dates[0]);
        await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.mouse.up();
        assert.deepEqual(await getRange(),beforeCancel,name+': cancelling preserves the committed range');
        if(options.touch) {
            await page.evaluate(()=>__tmDateFilter.setRange(null));
            data=await readGrid();
            const tap=data.dates[3];
            await page.touchscreen.tap(tap.x,tap.y);
            assert.deepEqual(await getRange(),{from:tap.value,to:tap.value},name+': a tap selects once');
            await page.touchscreen.tap(tap.x,tap.y);
            assert.equal(await getRange(),null,name+': a second tap clears once');
            const cdp=await page.context().newCDPSession(page);
            await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:tap.x,y:tap.y}]});
            await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:data.dates.at(-1).x,y:data.dates.at(-1).y}]});
            const touchKey=await pageKey();
            await page.waitForTimeout(250);assert.equal(await pageKey(),touchKey,name+': touch edge does not repeat');
            const touchEnd=(await readGrid()).dates[3];
            await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchEnd.x,y:touchEnd.y}]});
            await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
            assert.deepEqual(await getRange(),sortedRange(tap.value,touchEnd.value),name+': touch range commits once');
            await cdp.detach();
        }

        data=await readGrid();
        const wheelReference=options.week?data.dates[0].value:await page.locator('[data-tm-filter-month]').evaluate(el=>el.textContent.replace('年','-').replace('月','-15'));
        const wheelRange=await getRange();
        const wheelFirst=data.dates[0].value;
        const wheelMiddle=data.dates[Math.floor(data.dates.length/2)];
        await move(wheelMiddle);
        const scrollBefore=await page.evaluate(()=>window.scrollY);
        await page.mouse.wheel(0,100);
        await page.waitForFunction(first=>document.querySelector('[data-tm-filter-days]')?.firstElementChild?.dataset.tmFilterDate!==first,wheelFirst);
        assert.equal(await pageKey(),stepKey(wheelReference,1),name+': wheel down advances one month/week');
        await page.locator('.tm-date-filter-calendar').evaluate(el=>{
            for(let i=0;i<8;i++) el.dispatchEvent(new WheelEvent('wheel',{deltaY:100,bubbles:true,cancelable:true}));
        });
        assert.equal(await pageKey(),stepKey(wheelReference,1),name+': a wheel-event burst advances only one page');
        await page.mouse.wheel(0,-100);
        await page.waitForFunction(first=>document.querySelector('[data-tm-filter-days]')?.firstElementChild?.dataset.tmFilterDate===first,wheelFirst);
        assert.equal(await pageKey(),options.week?wheelFirst:stepKey(wheelReference,0),name+': wheel up returns to the previous month/week');
        assert.deepEqual(await getRange(),wheelRange,name+': wheel navigation preserves the selected range');
        assert.equal(await page.evaluate(()=>window.scrollY),scrollBefore,name+': wheel navigation does not scroll the page');
        const acceptsZoom=await page.locator('.tm-date-filter-calendar').evaluate(el=>el.dispatchEvent(new WheelEvent('wheel',{deltaY:100,ctrlKey:true,bubbles:true,cancelable:true})));
        assert.equal(acceptsZoom,true,name+': browser zoom gestures are not intercepted');
        await page.screenshot({path:path.join(output,'paging-'+name+'.png'),animations:'disabled'});
        assert.deepEqual(errors,[],name+': no runtime errors');
        console.log('Date paging passed: '+name);
    } finally { await page.close(); }
}

async function assertFullPageSlide(page,direction) {
    const overlay=page.locator('.tm-date-filter-page-ghost');
    const movement=await overlay.evaluate(el=>{
        const track=el.querySelector('.tm-date-filter-slide-track');
        const animation=track.getAnimations()[0];
        if(!animation) throw new Error('Calendar track animation is missing');
        animation.pause();
        const duration=Number(animation.effect.getTiming().duration);
        const position=()=>Array.from(track.children,node=>node.getBoundingClientRect().left);
        const live=el.parentElement.querySelector('[data-tm-filter-page]');
        const liveBefore=live.getBoundingClientRect().left;
        animation.currentTime=0;const start=position();
        animation.currentTime=duration/2;const middle=position();
        animation.currentTime=duration;const end=position();
        const result={width:el.clientWidth,trackWidth:track.getBoundingClientRect().width,start,middle,end,
            liveBefore,liveAfter:live.getBoundingClientRect().left,targets:el.querySelectorAll('[data-tm-filter-date]').length};
        animation.finish();return result;
    });
    assert.equal(movement.targets,0,'Visual slides have no interactive date targets');
    assert.ok(Math.abs(movement.trackWidth-2*movement.width)<1,'The track contains two full-width pages');
    assert.equal(movement.liveBefore,movement.liveAfter,'The live drag grid stays stationary');
    for(let i=0;i<2;i++) {
        const travel=movement.end[i]-movement.start[i];
        assert.ok(Math.abs(travel+direction*movement.width)<1,'Both pages travel one complete calendar width');
        assert.ok(Math.abs(movement.middle[i]-movement.start[i])>1 && Math.abs(movement.middle[i]-movement.end[i])>1,'Both pages have an intermediate translated position');
    }
    await overlay.waitFor({state:'detached'});
}
