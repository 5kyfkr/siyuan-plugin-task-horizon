'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('./i18n-browser-fixture');
const { fixture } = require('./calendar-tomato-rail-hosts-browser.test');

async function check(browser, kind) {
    const {page, errors} = await fixture(browser, kind);
    try {
        await page.clock.install({time:new Date('2026-11-16T10:05:10')});
        await page.evaluate(kind => {
            if (window.releaseHistory) releaseHistory();
            window.liveSnapshot = { status:'RUNNING', activeTimer:{status:'RUNNING',phase:'focus',timerMode:'countdown',
                openRecordId:'running-1',sessionId:'session-live',segmentStartMs:new Date('2026-11-16T10:00:00').getTime(),plannedDurationSec:1500,accumulatedMs:0},
                integrationEnvelope:{taskAssociation:{taskBlockId:'live-task',taskBlockName:'实时任务'}} };
            window.stateReads = 0;
            window.__tomatoTimerV2 = {getState:() => {stateReads++; return JSON.parse(JSON.stringify(liveSnapshot));}};
            const owner = kind === 'side' ? __railHosts.state.sideDay.calendar : __railHosts.state.calendar;
            owner.addEvent({id:'live-plan',title:'实时任务',start:new Date('2026-11-16T09:00:00'),end:new Date('2026-11-16T09:30:00'),
                extendedProps:{__tmSource:'schedule',__tmScheduleId:'live-plan',__tmTaskId:'live-task'}});
            if (kind === 'main') owner.changeView('timeGrid3Day',new Date('2026-11-16T00:00:00'));
            if (kind === 'side') __railHosts.state.sideDay.prototypeRender();
            else __railHosts.state.queuePrototypeSurfaceRender({nowIndicatorChanged:true});
        },kind);
        if (kind === 'month') await page.locator('.tm-proto-month-cell[data-tm-proto-day="2026-11-16"] .tm-proto-day-number').first().click();
        const surface = kind === 'side' ? page.locator('[data-tm-side-proto-surface]') : page.locator('[data-tm-cal-surface]');
        const live = surface.locator('[data-tm-live-record]');
        await live.waitFor();
        assert.equal(await live.count(),1,`${kind}: current unsaved segment appears`);
        await page.waitForFunction(() => __railHosts.state.dockHistoryReadInFlight === 0);
        const initial = await live.evaluate(el => {
            window.originalLiveNode=el;window.originalLiveColumn=el.parentElement;window.originalCanvas=el.closest('.tm-proto-time-canvas');
            window.originalPlan=document.querySelector('[data-tm-proto-event="live-plan"]');
            return {height:parseFloat(el.style.height),label:el.getAttribute('aria-label')};
        });
        assert.match(initial.label,/实时任务.*计时中/);
        await live.hover();
        // Advance only the hover delay. This is still before the next minute.
        await page.clock.runFor(150);
        await page.locator('.tm-proto-event-popover-title').waitFor();
        assert.match(await page.locator('.tm-proto-event-popover-title').innerText(),/计时中/);
        assert.equal(await page.locator('.tm-proto-popover-edit').count(),0,'running records cannot be edited');
        assert.ok(await surface.locator('[data-tm-proto-event="live-plan"].tm-proto-tomato-related').count() >= 1,'running record shares task association');
        await live.click();
        await page.mouse.move(20,20);
        // Settle source/resize frames, then measure only the minute work.
        await page.clock.runFor(3000);
        const reads = await page.evaluate(() => historyReads.length);
        const stateReads = await page.evaluate(() => stateReads);
        const before = await live.evaluate(el => {window.originalLiveNode=el;window.originalLiveColumn=el.parentElement;window.originalCanvas=el.closest('.tm-proto-time-canvas');return parseFloat(el.style.height);});
        await page.clock.runFor(60000);
        const minute = await live.evaluate(el => ({same:el===originalLiveNode,column:el.parentElement===originalLiveColumn,canvas:el.closest('.tm-proto-time-canvas')===originalCanvas,height:parseFloat(el.style.height),minute:el.dataset.tmProtoEndMinute}));
        assert.ok(minute.height > before,`${kind}: unsaved segment grows at the minute boundary`);
        assert.ok(minute.same && minute.column && minute.canvas,'minute refresh retains existing timeline and rail DOM');
        assert.equal(await page.evaluate(() => historyReads.length),reads,'minute refresh never rereads saved history');
        assert.ok((await page.evaluate(() => stateReads))-stateReads <= 2,'one snapshot read per minute, not every second');
        assert.match(await page.locator('.tm-proto-event-popover-title').innerText(),/6m.*计时中/,'pinned tooltip updates with minute tick');
        await page.locator('.tm-proto-event-popover-close').click();
        fs.mkdirSync(path.join(__dirname,'../output/playwright'),{recursive:true});
        await live.scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(__dirname,`../output/playwright/live-tomato-${kind}.png`)});
        await page.evaluate(kind => {
            liveSnapshot.status='PAUSED';liveSnapshot.activeTimer.status='PAUSED';liveSnapshot.activeTimer.segmentStartMs=null;
            const owner=kind==='side'?__railHosts.state.sideDay.calendar:__railHosts.state.calendar;
            owner.addEvent({id:'saved-running-1',title:'实时任务 · 6m',start:new Date('2026-11-16T10:00:00'),end:new Date('2026-11-16T10:06:00'),backgroundColor:'#3576aa',
                extendedProps:{__tmSource:'tomato',__tmRecordKey:{recordId:'running-1'},taskBlockId:'live-task',mode:'countdown',__tmDayPanelOnly:kind==='month'}});
            if(kind==='side')__railHosts.state.sideDay.prototypeRender();else __railHosts.state.queuePrototypeSurfaceRender();
        },kind);
        await page.clock.runFor(100);
        assert.equal(await live.count(),0,'pause removes the running overlay');
        assert.ok(await surface.locator('[data-tm-proto-event="saved-running-1"]').count()>=1,'saved record takes over the same time');
        await page.evaluate(() => {
            liveSnapshot.status='RUNNING';Object.assign(liveSnapshot.activeTimer,{status:'RUNNING',segmentStartMs:new Date('2026-11-16T10:10:00').getTime(),openRecordId:'running-2',accumulatedMs:360000});
        });
        await page.clock.setSystemTime(new Date('2026-11-16T10:12:00'));
        await page.evaluate(() => __railHosts.refreshCalendarNowIndicators());
        await page.clock.runFor(100);
        await live.waitFor();
        assert.match(await live.getAttribute('aria-label'),/10:10.*10:12/,'resume starts a new segment and excludes paused time');
        await page.evaluate(kind => {
            const owner=kind==='side'?__railHosts.state.sideDay.calendar:__railHosts.state.calendar;
            // Save notification can arrive while the timer snapshot still points
            // to the closing segment. Stable recordId must suppress the overlay.
            owner.addEvent({id:'saved-running-2',title:'saved',start:new Date('2026-11-16T10:10:00'),end:new Date('2026-11-16T10:12:00'),
                extendedProps:{__tmSource:'tomato',__tmRecordKey:{recordId:'running-2'},mode:'countdown',__tmDayPanelOnly:kind==='month'}});
            if(kind==='side')__railHosts.state.sideDay.prototypeRender();else __railHosts.state.queuePrototypeSurfaceRender();
        },kind);
        await page.clock.runFor(100);
        assert.equal(await live.count(),0,'saved identity prevents an overlapping live duplicate');
        await page.evaluate(() => {
            Object.assign(liveSnapshot.activeTimer,{phase:'break',timerMode:'stopwatch',segmentStartMs:new Date('2026-11-16T10:11:00').getTime(),openRecordId:'running-break'});
            __railHosts.refreshCalendarNowIndicators();
        });
        await page.clock.runFor(100);
        await live.waitFor();
        assert.match(await live.getAttribute('aria-label'),/计时中/);
        await page.evaluate(() => {hostStore.data.calendarShowBreak=false;__railHosts.refreshCalendarNowIndicators();});
        await page.clock.runFor(100);
        assert.equal(await live.count(),0,'source filter hides the corresponding running segment');
        await page.evaluate(() => {hostStore.data.calendarShowBreak=true;hostStore.data.calendarShowTomatoMaster=false;__railHosts.refreshCalendarNowIndicators();});
        await page.clock.runFor(100);
        assert.equal(await live.count(),0,'master filter hides all running segments');
        if (kind === 'main') {
            await page.evaluate(() => {
                hostStore.data.calendarShowTomatoMaster=true;hostStore.data.calendarTomatoDisplayMode='card';
                Object.assign(liveSnapshot.activeTimer,{phase:'focus',timerMode:'stopwatch',openRecordId:'live-stopwatch'});
                __railHosts.refreshCalendarNowIndicators();
            });
            await page.clock.runFor(100);
            assert.equal(await live.locator('.tm-proto-event-title').count(),1,'card style also displays the running record');
            const cardReads=await page.evaluate(()=>historyReads.length);
            await page.clock.runFor(60000);
            assert.equal(await page.evaluate(()=>historyReads.length),cardReads,'card growth never reloads history sources');
            await page.evaluate(() => {hostStore.data.calendarTomatoDisplayMode='rail';__railHosts.refreshCalendarNowIndicators();});
            await page.clock.runFor(100);
            const hiddenReads=await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});return stateReads;});
            await page.clock.runFor(60000);
            assert.equal(await page.evaluate(()=>stateReads),hiddenReads,'hidden calendar performs no timer snapshot work');
            await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
            await page.clock.runFor(100);
            assert.ok(await page.evaluate(()=>stateReads)>hiddenReads,'foreground resume catches up immediately');
            await page.evaluate(()=>{
                Object.assign(liveSnapshot.activeTimer,{timerMode:'countdown',segmentStartMs:new Date('2026-11-16T10:00:00').getTime(),plannedDurationSec:600,accumulatedMs:0,openRecordId:'expired-display'});
                __railHosts.refreshCalendarNowIndicators();
            });
            await page.clock.runFor(100);
            assert.match(await live.getAttribute('aria-label'),/10:00.*10:10/,'expired countdown drawing stops at its actual completion boundary');
            await page.clock.setSystemTime(new Date('2026-11-17T00:01:00'));
            await page.evaluate(()=>{
                Object.assign(liveSnapshot.activeTimer,{timerMode:'stopwatch',segmentStartMs:new Date('2026-11-16T23:59:00').getTime(),openRecordId:'overnight',accumulatedMs:0});
                __railHosts.refreshCalendarNowIndicators();
            });
            await page.clock.runFor(100);
            assert.equal(await live.count(),2,'cross-midnight active interval is clipped into both visible day columns');
            const overnight=await live.evaluateAll(nodes=>nodes.map(node=>[node.parentElement.dataset.tmProtoDay,Number(node.dataset.tmProtoMinute),Number(node.dataset.tmProtoEndMinute)]));
            assert.deepEqual(overnight.map(([day,start,end])=>[day,Math.round(start),Math.round(end)]),[['2026-11-16',1439,1440],['2026-11-17',0,1]]);
        }
        assert.deepEqual(errors,[],`${kind}: runtime errors`);
        console.log(`${kind}: live minute growth, DOM reuse, pause/resume, saved dedupe and filters passed`);
    } finally {await page.close();}
}

(async()=>{
    const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE}:{})});
    try{for(const kind of ['main','side','month'])await check(browser,kind);}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
