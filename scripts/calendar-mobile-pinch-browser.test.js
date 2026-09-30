'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup,readFunction,tapMinute,resizeEdge,gesturePath} = require('./calendar-click-draft-browser.test.js');
const storageKey = 'tm_calendar_mobile_timeline_scale';
const frame = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function mount(page, mobile = true, side = false, settings = {}, expanded = false) {
    await page.goto('https://calendar.test/');
    await setup(page,mobile,side);
    await page.addScriptTag({content:[
        readFunction('getPrototypeTimelineVisibleEventSegments'),
        readFunction('buildSharedPrototypeTimelineMarkup'),
        'const normalizeCalendarWeekAllDayVisibleRows = () => 3;',
        'const isCalendarForegroundEvent = () => true;',
        'const mergeCalendarAllDayReminders = events => events;',
        'const buildSharedPrototypeAllDayToggleMarkup = () => "";',
        'const isLikelyMobileRuntime = () => isMobileDevice;',
    ].join('\n')});
    await page.evaluate(({settings,expanded}) => {
        window.fixtureSettings = {visibleStartTime:'00:00',visibleEndTime:'24:00',...settings};
        window.fixtureExpanded = expanded;
        window.paintTimeline = () => {
            if (prototypeSurface.__tmTimelinePinch?.deferRender(paintTimeline)) return;
            const scrollTop = prototypeSurface.querySelector('.tm-proto-time-scroll')?.scrollTop || 0;
            prototypeSurface.innerHTML = buildSharedPrototypeTimelineMarkup({
                days:[new Date('2026-09-28T00:00:00'),new Date('2026-09-29T00:00:00')],
                settings:getSettings(), isMobile:isMobileDevice, hourHeight:getPrototypeHourHeight(), availableHeight:600,
                showHeader:false, timeRangeExpanded:fixtureExpanded,
                events:[{id:'event',start:new Date('2026-09-28T17:00:00'),end:new Date('2026-09-28T18:00:00')}],
                eventEnd:event => event.end,
                eventMarkup:event => '<article class="tm-proto-event tm-proto-event--block" data-tm-proto-event="'+event.id+'" style="--tm-proto-event-color:#3978dc"><span>现有日程</span></article>',
            });
            prototypeSurface.querySelector('.tm-proto-time-scroll').scrollTop = scrollTop;
            prototypeSurface.__tmScheduleDraft.restore();
        };
        paintTimeline();
        prototypeSurface.querySelector('.tm-proto-time-scroll').scrollTop = 300;
        window.zoomStorageWrites = 0;
        const setItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key,value) {
            if (key === 'tm_calendar_mobile_timeline_scale') zoomStorageWrites++;
            return setItem.call(this,key,value);
        };
    },{settings,expanded});
}

async function snapshot(page, y = null) {
    return page.evaluate(y => {
        const canvas = document.querySelector('.tm-proto-time-canvas');
        const scroller = canvas.parentElement;
        const rect = scroller.getBoundingClientRect();
        const event = canvas.querySelector('[data-tm-proto-event]');
        const metrics = getPrototypeTimelineMetricsFromCanvas(canvas,getSettings());
        return {scale:Number(canvas.dataset.tmProtoMobileScale || 1), hour:metrics.hourHeight,
            stored:localStorage.getItem('tm_calendar_mobile_timeline_scale'), writes:zoomStorageWrites,
            minute:prototypeTimelineMinutesAtPoint(canvas,y ?? rect.top+rect.height/2,getSettings()),
            scroll:scroller.scrollTop, canvasHeight:canvas.getBoundingClientRect().height,
            eventHeight:event.getBoundingClientRect().height, font:getComputedStyle(event).fontSize,
            opens:opens.length, drafts:canvas.querySelectorAll('[data-tm-proto-draft]').length,
            browserScale:visualViewport.scale, pinching:prototypeSurface.classList.contains('tm-proto-timeline-pinching')};
    },y);
}

async function pinch(page, ratios, options = {}) {
    const center = await page.evaluate(() => {
        const scroller = document.querySelector('.tm-proto-time-scroll').getBoundingClientRect();
        const col = document.querySelector('.tm-proto-time-col').getBoundingClientRect();
        return {x:col.x+col.width*0.3,y:scroller.y+scroller.height/2};
    });
    const points = (ratio = 1) => [
        {id:1,x:center.x,y:center.y-50*ratio},
        {id:2,x:center.x,y:center.y+50*ratio},
    ];
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[points()[0]]});
    if (options.afterFirst) await options.afterFirst();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points()});
    await frame(page);
    if (options.afterStart) await options.afterStart(center);
    for (const ratio of ratios) {
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(ratio)});
        await frame(page);
        if (options.check) await options.check(ratio,center);
    }
    if (options.leaveOne) {
        const first = points(ratios.at(-1))[0];
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[first]});
        const before = await snapshot(page);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...first,y:first.y+70}]});
        await frame(page);
        const after = await snapshot(page);
        assert.equal(after.scale,before.scale,'one remaining finger must not continue zooming');
        assert.equal(after.scroll,before.scroll,'one remaining finger must not scroll or drag');
    }
    await cdp.send('Input.dispatchTouchEvent',{type:options.cancel?'touchCancel':'touchEnd',touchPoints:[]});
    await cdp.detach();
    await frame(page);
}

async function run() {
    const browser = await chromium.launch({headless:true, ...(process.env.PLAYWRIGHT_EXECUTABLE ? {executablePath:process.env.PLAYWRIGHT_EXECUTABLE} : {})});
    try {
        for (const side of [false,true]) {
            const context = await browser.newContext({viewport:{width:390,height:780},hasTouch:true,isMobile:true});
            const page = await context.newPage();
            await page.route('https://calendar.test/**',route => route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));
            const errors = []; page.on('pageerror',error => errors.push(error.message));
            await mount(page,true,side);
            assert.deepEqual(await page.evaluate(() => [null,0,-1,'bad',Infinity,0.1,1.234,9].map(normalizePrototypeTimelineScale)),
                [1,1,1,1,1,0.75,1.234,3],'stored preferences are validated without discrete zoom steps');
            const initial = await snapshot(page);
            assert.equal(initial.hour,42);
            assert.equal(initial.stored,null);
            await tapMinute(page,16*60+15,true);
            await resizeEdge(page,'end',21,true);
            const draft = page.locator('[data-tm-proto-draft]');
            assert.equal(await draft.innerText(),'16:00 – 17:30');
            await page.evaluate(() => {
                window.originalCanvas = document.querySelector('.tm-proto-time-canvas');
                window.originalEvent = document.querySelector('[data-tm-proto-event]');
            });
            await pinch(page,[1.37,1.83],{
                afterStart:async () => assert.equal(await draft.innerText(),'16:00 – 17:30','pinch restores a draft cleared by the first finger'),
                check:async ratio => {
                    const live = await snapshot(page);
                    assert.ok(Math.abs(live.scale-ratio)<0.001,'scale follows continuously before release');
                    assert.ok(Math.abs(live.hour-42*ratio)<0.001);
                    assert.ok(Math.abs(live.minute-initial.minute)<1,'the midpoint keeps the same time');
                    assert.ok(Math.abs(live.eventHeight-initial.eventHeight*ratio)<1,'event height tracks the shared minute geometry');
                    assert.equal(live.font,initial.font,'text is not visually scaled');
                    assert.equal(live.browserScale,1,'pinch does not zoom the page');
                    assert.equal(live.stored,null,'do not persist every movement');
                    assert.equal(live.opens,0);
                    await page.evaluate(() => paintTimeline());
                    assert.equal(await page.evaluate(() => originalCanvas.isConnected && originalEvent.isConnected),true,'live scaling and source refresh retain touch targets');
                },leaveOne:true,
            });
            const committed = await snapshot(page);
            assert.ok(Math.abs(committed.scale-1.83)<0.001);
            assert.equal(committed.writes,1,'one persistence write per completed gesture');
            assert.equal(committed.pinching,false);
            assert.equal(await draft.innerText(),'16:00 – 17:30');
            await page.screenshot({path:path.resolve(__dirname,'../output/playwright/calendar-mobile-pinch-'+(side?'side':'main')+'.png')});
            await page.evaluate(() => {
                const button = document.createElement('button');
                button.id = 'toolbar-action'; button.textContent = '工具栏';
                button.style.cssText = 'position:absolute;top:0;left:0;width:100px;height:30px;';
                button.onclick = event => { event.stopPropagation(); window.toolbarClicks = (window.toolbarClicks || 0) + 1; };
                prototypeSurface.prepend(button);
            });
            await page.touchscreen.tap(40,15);
            assert.equal(await page.evaluate(() => toolbarClicks),1,'a fresh toolbar tap works after pinch');
            await pinch(page,[0.8],{cancel:true});
            assert.ok(Math.abs((await snapshot(page)).scale-committed.scale)<0.001,'cancellation restores the committed zoom');
            assert.equal((await snapshot(page)).writes,1,'cancel does not save a new preference');
            await mount(page,true,side);
            const restored = await snapshot(page);
            assert.ok(Math.abs(restored.hour-committed.hour)<0.001,'remount restores the mobile scale');
            await pinch(page,[4]);
            assert.equal((await snapshot(page)).scale,3,'maximum density is bounded');
            await pinch(page,[0.1]);
            assert.equal((await snapshot(page)).scale,0.75,'minimum density is bounded');
            await mount(page,false,side);
            assert.equal((await snapshot(page)).hour,60,'narrow desktop ignores the mobile preference');
            const desktopStored = (await snapshot(page)).stored;
            await pinch(page,[1.5]);
            assert.equal((await snapshot(page)).hour,60,'touch on a desktop host does not enable mobile zoom');
            assert.equal((await snapshot(page)).stored,desktopStored);
            await mount(page,true,side,{visibleStartTime:'06:00',visibleEndTime:'22:00'});
            const bands = await page.locator('[data-tm-proto-collapse]').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
            await pinch(page,[1.6]);
            const scaledBands = await page.locator('[data-tm-proto-collapse]').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
            bands.forEach((height,i) => assert.ok(Math.abs(height-scaledBands[i])<1,'fold controls keep their height'));
            await mount(page,true,side,{visibleStartTime:'22:00',visibleEndTime:'06:00'},true);
            await pinch(page,[1.15]);
            assert.equal(await page.evaluate(() => {
                const canvas = document.querySelector('.tm-proto-time-canvas');
                const metrics = getPrototypeTimelineMetricsFromCanvas(canvas,getSettings());
                return Math.round(prototypeTimelineMinuteForY(prototypeTimelineYForMinute(660,metrics),metrics));
            }),660,'overnight expanded coordinates remain reversible');
            await mount(page,true,side);
            await page.evaluate(() => { document.querySelector('.tm-proto-time-scroll').scrollTop = 600; });
            const from = await page.evaluate(() => point(14*60+15));
            const to = await page.evaluate(() => point(15*60+45));
            await gesturePath(page,true,from,[to],{longPress:true});
            assert.equal(await draft.innerText(),'14:15 – 15:45','original long-press selection works at restored zoom');
            assert.equal((await snapshot(page)).opens,0);
            const hour = (await snapshot(page)).hour;
            await resizeEdge(page,'end',hour/4,true);
            assert.equal(await draft.innerText(),'14:15 – 16:00','resizing uses zoomed minute coordinates');
            const b = await draft.boundingBox();
            await gesturePath(page,true,{x:b.x+b.width/2,y:b.y+b.height/2},[{x:b.x+b.width/2,y:b.y+b.height/2+hour/4}]);
            assert.equal(await draft.innerText(),'14:30 – 16:15','whole-card dragging keeps duration after zoom');
            await page.evaluate(() => { document.querySelector('.tm-proto-time-scroll').scrollTop = 100; });
            await pinch(page,[1.05],{afterFirst:async () => page.waitForFunction(() => prototypePointerSelection?.started || sidePrototypePointerSelection?.started)});
            assert.equal(await page.evaluate(() => !!prototypePointerSelection || !!sidePrototypePointerSelection),false,'pinch cancels a pending long-press selection');
            assert.equal(await page.locator('[data-tm-proto-selection-preview]').count(),0);
            await draft.scrollIntoViewIfNeeded();
            const confirmed = await draft.boundingBox();
            await page.touchscreen.tap(confirmed.x+confirmed.width/2,confirmed.y+confirmed.height/2);
            assert.deepEqual(await page.evaluate(() => opens.map(({start,end}) => ({start,end}))),[{start:870,end:975}],
                'a fresh draft tap opens the editor with the resized times after zoom');
            await page.evaluate(() => {
                prototypeSurface.__tmScheduleDraft.clear();
                document.querySelector('.tm-proto-time-scroll').scrollTop = 100;
            });
            const scrollBefore = (await snapshot(page)).scroll;
            await gesturePath(page,true,{x:90,y:300},[{x:90,y:180}]);
            await page.waitForFunction(before => document.querySelector('.tm-proto-time-scroll').scrollTop > before+20,scrollBefore);
            assert.equal((await snapshot(page)).opens,1,'single-finger scrolling creates no additional editor');
            await page.evaluate(() => prototypeSurface.__tmTimelinePinch.dispose());
            assert.equal(await page.evaluate(() => !!prototypeSurface.__tmTimelinePinch),false,'unmount disposes the gesture controller');
            assert.deepEqual(errors,[]);
            await context.close();
            console.log('calendar mobile pinch: '+(side?'side':'main')+' passed');
        }
    } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
