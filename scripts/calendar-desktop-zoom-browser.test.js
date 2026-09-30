'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { setup, readFunction, tapMinute, resizeEdge, gesturePath } = require('./calendar-click-draft-browser.test.js');
const storageKey = 'tm_calendar_desktop_timeline_scale';
const source = fs.readFileSync(path.resolve(__dirname, '../calendar-view.js'), 'utf8');
const wheelStart = source.indexOf('prototypeWeekWheelListener = (event) => {');
const wheelEnd = source.indexOf('// Day-granular navigation', wheelStart);
assert.ok(wheelStart > 0 && wheelEnd > wheelStart);
const frame = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const settle = page => page.waitForFunction(() => !prototypeSurface.classList.contains('tm-proto-timeline-zooming'));

async function mount(page, side, settings = {}, dock = false) {
    await page.goto('https://calendar.test/');
    await setup(page, false, side);
    await page.addStyleTag({content: '.fixture{height:auto!important;--fixture-height:600px}.tm-proto-timeline{height:auto!important}.tm-proto-time-scroll{height:var(--fixture-height)!important;flex:none!important}.fixture-tools{height:30px}'});
    await page.addScriptTag({content: [
        readFunction('getPrototypeTimelineVisibleEventSegments'),
        readFunction('buildSharedPrototypeTimelineMarkup'),
        readFunction('buildSharedPrototypeDayPanelMarkup'),
        'const normalizeCalendarWeekAllDayVisibleRows = () => 3;',
        'const isCalendarForegroundEvent = () => true;',
        'const mergeCalendarAllDayReminders = events => events;',
        'const buildSharedPrototypeAllDayToggleMarkup = () => "";',
        'const isLikelyMobileRuntime = () => false;',
        'const getIsoWeekNumber = () => 40;',
    ].join('\n')});
    await page.evaluate(({ side, settings, dock }) => {
        window.fixtureSettings = {visibleStartTime:'00:00', visibleEndTime:'24:00', ...settings};
        prototypeSurface.dataset.tmUiMode = dock ? 'mobile' : 'desktop';
        prototypeSurface.dataset.tmHostMode = dock ? 'dock' : 'tab';
        window.fixtureBusy = false;
        // The production calendar may be hosted by a dialog. Only editors
        // inside the time scroller should opt out of timeline zoom.
        prototypeSurface.setAttribute('role', 'dialog');
        window.paintCount = 0;
        window.zoomStarts = 0;
        window.zoomWrites = 0;
        const setItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key, value) {
            if (key === 'tm_calendar_desktop_timeline_scale') zoomWrites++;
            return setItem.call(this, key, value);
        };
        bindDesktopTimelineZoom(prototypeSurface, {
            isMobile:false,
            isBusy:() => fixtureBusy,
            onStart:() => zoomStarts++,
        });
        window.paintTimeline = () => {
            if (prototypeSurface.__tmTimelineZoom?.deferRender(paintTimeline)) return;
            const scroller = prototypeSurface.querySelector('.tm-proto-time-scroll');
            const scroll = scroller?.scrollTop || 0;
            const options = {
                days:[new Date('2026-09-28T00:00:00'), new Date('2026-09-29T00:00:00')],
                date:new Date('2026-09-28T00:00:00'),
                settings:getSettings(), isMobile:dock, hourHeight:dock ? 42 : 60,
                availableHeight:scroller?.clientHeight || 0, showHeader:false,
                events:[{id:'event',start:new Date('2026-09-28T17:00:00'),end:new Date('2026-09-28T18:00:00')}],
                eventEnd:event => event.end,
                eventMarkup:event => '<article class="tm-proto-event tm-proto-event--block" data-tm-proto-event="'+event.id+'" style="--tm-proto-event-color:#3978dc"><span>现有日程</span></article>',
            };
            prototypeSurface.innerHTML = side ? buildSharedPrototypeDayPanelMarkup(options)
                : '<div class="fixture-tools"></div>'+buildSharedPrototypeTimelineMarkup(options);
            prototypeSurface.querySelector('.tm-proto-time-scroll').scrollTop = scroll;
            prototypeSurface.__tmTimelineZoom.refresh();
            prototypeSurface.__tmScheduleDraft.restore();
            paintCount++;
        };
        paintTimeline();
        prototypeSurface.querySelector('.tm-proto-time-scroll').scrollTop = 600;
    }, {side, settings, dock});
    // Use the production week listener to catch precedence regressions.
    await page.addScriptTag({content: `
        let prototypeWeekWheelListener, prototypeWeekWheelRemainder = 0, prototypeWeekWheelResetTimer = 0, prototypeWeekStepAccumulator = 0;
        const isSlidingWeekViewType = () => true;
        const getCalendarDate = () => new Date('2026-09-28T00:00:00');
        const protoAddDays = (date, days) => new Date(date.getTime()+days*86400000);
        const resolvePrototypeWeekDayTarget = date => date;
        const previewPrototypeWeekScroll = () => { window.weekMoves = (window.weekMoves || 0)+1; };
        const schedulePrototypeWeekDayCommit = () => {};
        ${source.slice(wheelStart, wheelEnd)}
    `});
    await frame(page);
}

async function snapshot(page) {
    return page.evaluate(() => {
        const canvas = prototypeSurface.querySelector('.tm-proto-time-canvas');
        const scroller = canvas.closest('.tm-proto-time-scroll');
        const rect = scroller.getBoundingClientRect();
        const event = canvas.querySelector('[data-tm-proto-event]');
        return {scale:Number(canvas.dataset.tmProtoDesktopScale), hour:Number(canvas.dataset.tmProtoHourHeight),
            height:canvas.clientHeight, viewport:scroller.clientHeight, recordedViewport:Number(canvas.dataset.tmProtoViewportHeight),
            scroll:scroller.scrollTop, centerMinute:prototypeTimelineMinutesAtPoint(canvas, rect.top+rect.height/2, getSettings()),
            eventHeight:event?.getBoundingClientRect().height, font:event && getComputedStyle(event).fontSize,
            stored:localStorage.getItem('tm_calendar_desktop_timeline_scale'), writes:zoomWrites, paints:paintCount,
            pageWidth:innerWidth, browserScale:visualViewport.scale, weekMoves:window.weekMoves || 0};
    });
}

async function wheel(page, deltaY, options = {}) {
    return page.evaluate(({deltaY, options}) => {
        const canvas = prototypeSurface.querySelector('.tm-proto-time-canvas');
        const scroller = canvas.closest('.tm-proto-time-scroll');
        const rect = scroller.getBoundingClientRect();
        const col = canvas.querySelector('.tm-proto-time-col').getBoundingClientRect();
        const x = col.left+col.width*0.2, y = rect.top+rect.height/2;
        const event = new WheelEvent('wheel', {bubbles:true, cancelable:true, ctrlKey:true,
            clientX:x, clientY:y, deltaY, ...options});
        const target = document.elementFromPoint(x,y) || canvas;
        target.dispatchEvent(event);
        return event.defaultPrevented;
    }, {deltaY, options});
}

async function run() {
    const browser = await chromium.launch({headless:true, ...(process.env.PLAYWRIGHT_EXECUTABLE ? {executablePath:process.env.PLAYWRIGHT_EXECUTABLE} : {})});
    try {
        for (const {side, dock} of [{side:false,dock:false}, {side:true,dock:false}, {side:false,dock:true}, {side:true,dock:true}]) {
            const context = await browser.newContext({viewport:{width:1100,height:1100}});
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.route('https://calendar.test/**', route => route.fulfill({contentType:'text/html', body:'<!doctype html><html><body></body></html>'}));
            const mountHere = (settings = {}) => mount(page, side, settings, dock);
            await mountHere();
            await page.evaluate(() => localStorage.setItem('tm_calendar_mobile_timeline_scale','2.5'));
            const before = await snapshot(page);
            assert.equal(before.hour, dock ? 42 : 60, 'compact Dock keeps its existing base density');
            assert.equal(before.scale, 1);
            assert.equal(before.viewport, 600);
            await tapMinute(page, 16*60+15, false);
            const draft = page.locator('[data-tm-proto-draft]');
            assert.equal(await draft.innerText(), '16:00 – 17:00');
            await page.evaluate(() => { window.originalCanvas = document.querySelector('.tm-proto-time-canvas'); });
            await wheel(page, -90, {shiftKey:true, deltaX:200});
            await frame(page);
            const live = await snapshot(page);
            assert.ok(Math.abs(live.scale-Math.exp(0.18))<0.0001, 'continuous scale follows wheel magnitude');
            assert.ok(Math.abs(live.centerMinute-before.centerMinute)<1, 'mouse time stays anchored');
            assert.ok(Math.abs(live.eventHeight-before.eventHeight*live.scale)<1);
            assert.equal(live.font, before.font);
            assert.equal(live.weekMoves, 0, 'Ctrl takes precedence over week navigation');
            await page.evaluate(() => paintTimeline());
            assert.equal(await page.evaluate(() => originalCanvas.isConnected), true, 'source refresh waits for wheel completion');
            await settle(page);
            await frame(page);
            const committed = await snapshot(page);
            assert.equal(committed.writes, 1);
            assert.equal(Number(committed.stored), committed.scale);
            assert.equal(await draft.innerText(), '16:00 – 17:00');
            await resizeEdge(page, 'end', committed.hour/4, false);
            assert.equal(await draft.innerText(), '16:00 – 17:15', 'draft resizing uses scaled minutes');
            const box = await draft.boundingBox();
            await gesturePath(page, false, {x:box.x+box.width/2,y:box.y+box.height/2},
                [{x:box.x+box.width/2,y:box.y+box.height/2+committed.hour/4}]);
            assert.equal(await draft.innerText(), '16:15 – 17:30', 'draft dragging keeps scaled duration');

            await page.evaluate(() => {
                localStorage.removeItem('tm_calendar_desktop_timeline_scale');
                window.dispatchEvent(new CustomEvent('tm-calendar-desktop-timeline-scale'));
            });
            assert.equal((await snapshot(page)).scale, 1);
            assert.equal(await page.evaluate(() => localStorage.getItem('tm_calendar_mobile_timeline_scale')), '2.5');
            await page.evaluate(() => { prototypeSurface.__tmScheduleDraft.clear(); window.fixtureBusy = true; });
            assert.equal(await wheel(page, -100), true, 'active drag still blocks page zoom');
            assert.equal((await snapshot(page)).scale, 1, 'do not change drag geometry');
            await page.evaluate(() => { window.fixtureBusy = false; });
            await wheel(page, -2, {deltaMode:1});
            await frame(page);
            assert.ok(Math.abs((await snapshot(page)).scale-Math.exp(0.064))<0.0001, 'line delta is normalized');
            await settle(page);

            await page.evaluate(() => { document.querySelector('.tm-proto-time-scroll').scrollTop = 200; });
            const scrollPoint = await page.locator('.tm-proto-time-scroll').boundingBox();
            await page.mouse.move(scrollPoint.x+100,scrollPoint.y+250);
            const regular = await snapshot(page);
            await page.mouse.wheel(0, 100);
            await page.waitForFunction(start => document.querySelector('.tm-proto-time-scroll').scrollTop > start+20, regular.scroll);
            assert.equal((await snapshot(page)).scale, regular.scale, 'ordinary wheel remains scrolling');
            await page.keyboard.down('Control');
            await page.mouse.wheel(0, -80);
            await page.keyboard.up('Control');
            await settle(page);
            await frame(page);
            const native = await snapshot(page);
            assert.ok(native.scale > regular.scale, 'real Ctrl+wheel reaches the controller');
            assert.equal(native.pageWidth, regular.pageWidth, 'Ctrl+wheel does not zoom the page');
            assert.equal(native.browserScale, 1);
            await wheel(page, 80, {ctrlKey:false, shiftKey:true});
            assert.ok((await snapshot(page)).weekMoves > 0, 'Shift+wheel still navigates dates');

            await page.evaluate(() => localStorage.setItem('tm_calendar_desktop_timeline_scale','0.75'));
            await mountHere({visibleStartTime:'12:00', visibleEndTime:'18:00'});
            const short = await snapshot(page);
            assert.equal(short.hour, 68);
            assert.equal(short.height, 464, 'zoom-out is allowed to leave empty viewport space');
            const bands = await page.locator('[data-tm-proto-collapse]').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
            await page.evaluate(() => prototypeSurface.style.setProperty('--fixture-height','900px'));
            await page.waitForFunction(() => Number(document.querySelector('.tm-proto-time-canvas').dataset.tmProtoViewportHeight) === 900);
            const tall = await snapshot(page);
            assert.equal(tall.scale, 0.75);
            assert.equal(tall.hour, 105.5);
            assert.equal(tall.height, 689);
            assert.equal(tall.paints, short.paints, 'height-only changes do not rebuild the calendar');
            assert.equal(tall.writes, short.writes, 'resize does not overwrite user preference');
            await page.evaluate(() => prototypeSurface.style.setProperty('--fixture-height','400px'));
            await page.waitForFunction(() => Number(document.querySelector('.tm-proto-time-canvas').dataset.tmProtoViewportHeight) === 400);
            assert.ok(Math.abs((await snapshot(page)).hour-(dock ? 43 : 45))<0.001, 'small viewport retains the configured minimum before scaling');
            const resizedBands = await page.locator('[data-tm-proto-collapse]').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
            bands.forEach((height,index) => assert.ok(Math.abs(height-resizedBands[index])<1, 'fold bands retain fixed height'));
            await wheel(page, -120);
            await page.evaluate(() => { prototypeSurface.style.setProperty('--fixture-height','700px'); paintTimeline(); });
            await settle(page);
            await frame(page);
            assert.equal((await snapshot(page)).recordedViewport, 700, 'resize during a wheel burst settles to the latest viewport');
            const saved = (await snapshot(page)).scale;
            await page.setViewportSize({width:side ? 320 : 540,height:1000});
            await mountHere();
            assert.equal((await snapshot(page)).scale, saved, 'narrow desktop and remount retain desktop preference');
            await page.evaluate(() => {
                const canvas = document.querySelector('.tm-proto-time-canvas');
                const scroller = canvas.closest('.tm-proto-time-scroll');
                const r = scroller.getBoundingClientRect();
                for (let i=0;i<20;i++) canvas.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,ctrlKey:true,deltaY:-240,clientY:r.top+200}));
            });
            await settle(page); await frame(page);
            assert.equal((await snapshot(page)).scale, 3);
            assert.equal(await wheel(page,-120), true, 'maximum scale still consumes Ctrl+wheel');
            await settle(page);
            await page.evaluate(() => {
                const canvas = document.querySelector('.tm-proto-time-canvas');
                const r = canvas.closest('.tm-proto-time-scroll').getBoundingClientRect();
                for (let i=0;i<20;i++) canvas.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,ctrlKey:true,deltaY:240,clientY:r.top+200}));
            });
            await settle(page); await frame(page);
            assert.equal((await snapshot(page)).scale, 0.75);
            await page.evaluate(() => {
                localStorage.removeItem('tm_calendar_desktop_timeline_scale');
                window.dispatchEvent(new CustomEvent('tm-calendar-desktop-timeline-scale'));
            });
            assert.equal(await page.locator('[data-tm-timeline-zoom-reset]').count(), 0, 'zoom does not add a percentage button');
            await page.screenshot({path:path.resolve(__dirname,'../output/playwright/calendar-desktop-zoom-'+(dock?'dock-':'')+(side?'side':'main')+'.png')});
            await wheel(page, -40);
            await page.evaluate(() => window.dispatchEvent(new Event('blur')));
            assert.equal(await page.evaluate(() => prototypeSurface.classList.contains('tm-proto-timeline-zooming')), false);
            await page.evaluate(() => prototypeSurface.__tmTimelineZoom.dispose());
            assert.equal(await page.evaluate(() => !!prototypeSurface.__tmTimelineZoom), false);
            const disposed = (await snapshot(page)).scale;
            await wheel(page,-120); await frame(page);
            assert.equal((await snapshot(page)).scale, disposed, 'disposed controller leaves no wheel listener');
            assert.deepEqual(errors, []);
            await context.close();
            console.log('calendar desktop zoom: '+(dock?'dock / ':'tab / ')+(side?'side':'main')+' passed');
        }
    } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
