'use strict';

// PLAYWRIGHT_MODULE / PLAYWRIGHT_EXECUTABLE may point to an existing installation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8').replace(/\r\n/g, '\n');
const styles = fs.readFileSync(path.join(root, 'calendar-view.css'), 'utf8');
function readFunction(name) {
    const start = source.indexOf(`    function ${name}(`);
    assert.ok(start >= 0, name);
    const signatureEnd = source.indexOf(') {', start);
    let depth = 0;
    for (let i = signatureEnd + 2; i < source.length; i++) {
        if (source[i] === '{') depth++;
        if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
    }
    throw new Error(`Incomplete function ${name}`);
}
const helpers = ['normalizeCalendarVisibleTime', 'getCalendarVisibleSlotRange', 'getPrototypeTimelineMetrics',
    'normalizeMobileTimelineScale', 'readMobileTimelineScale', 'applyMobileTimelineScale', 'bindMobileTimelinePinch',
    'resolvePrototypeSelectionRange', 'renderPrototypeSelectionPreview',
    'bindPrototypeSurfacePointerHandler',
    'prototypeTimelineYForMinute', 'prototypeTimelineMinuteForY', 'getPrototypeTimelineMetricsFromCanvas',
    'prototypeTimelineMinutesAtPoint', 'bindPrototypeScheduleDraft'].map(readFunction).join('\n');
const callbacks = [...source.matchAll(/dateClick: \(info\) => \{([\s\S]*?)\n            \},/g)].map(m => `(info) => {${m[1]}\n}`);
assert.equal(callbacks.length, 2, 'exercise both production date-click callbacks');
const selections = [...source.matchAll(/select: \(info\) => \{([\s\S]*?)\n            \},/g)].map(m => `(info) => {${m[1]}\n}`);
assert.equal(selections.length, 2);
function selectionBindings(side) {
    const target = side ? 'surface' : 'prototypeSurface';
    const endMarker = side ? '\n                }, true);' : '\n            }, true);';
    return ['pointerdown','pointermove','pointerup','pointercancel'].map(type => {
        const marker = `bindPrototypeSurfacePointerHandler(${target}, '${type}', (event) => {`;
        const start = source.indexOf(marker), end = source.indexOf(endMarker,start);
        assert.ok(start >= 0 && end > start,marker);
        return source.slice(start,end+endMarker.length);
    }).join('\n');
}

async function setup(page, mobile, side = false) {
    await page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1"><style>${styles}</style><style>
        body{margin:0;font:14px system-ui;--tm-cal-primary:#3978dc;--tm-cal-panel:#fdfdfe;--tm-cal-border:#dce0e6;--tm-cal-muted:#75808e;--tm-proto-axis-width:40px}
        .fixture{width:100%;height:680px;padding-top:40px;box-sizing:border-box}
        .tm-proto-time-scroll{height:600px!important;overflow:auto!important}
        .tm-proto-time-col{border-left:1px solid #dce0e6}
    </style><div class="fixture" data-tm-cal-surface><div class="tm-proto-time-scroll"><div class="tm-proto-time-canvas" data-tm-proto-hour-height="${mobile ? 42 : 60}" style="height:${24 * (mobile ? 42 : 60)}px;min-height:${24 * (mobile ? 42 : 60)}px">
        <div class="tm-proto-time-columns" style="grid-template-columns:40px repeat(2,minmax(0,1fr))"><span></span><div class="tm-proto-time-col" data-tm-proto-day="2026-09-28"></div><div class="tm-proto-time-col" data-tm-proto-day="2026-09-29"></div></div></div></div></div>`);
    await page.addScriptTag({ content: `
        const pad2 = n => String(n).padStart(2,'0');
        const esc = s => String(s).replaceAll('&','&amp;').replaceAll(String.fromCharCode(34),'&quot;').replaceAll('<','&lt;');
        const formatDateKey = d => d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());
        const getSettings = () => window.fixtureSettings || ({visibleStartTime:'00:00',visibleEndTime:'24:00'});
        const getPrototypeHourHeight = () => ${mobile ? 42 : 60};
        const PROTOTYPE_TIME_COLLAPSE_BAND_HEIGHT = 28;
        ${helpers}
        const prototypeSurface = document.querySelector('.fixture'), sidePrototypeSurface = prototypeSurface;
        const calendar = {unselect() {}}, cal = calendar, isMobileDevice = ${mobile};
        const getCalendarView = () => ({type:'timeGridWeek'});
        const isTimeGridViewType = type => type.startsWith('timeGrid');
        const pickDefaultCalendarId = () => 'default';
        window.opens = [];
        const openPrototypeNewScheduleCard = (params, anchor) => {
            opens.push({start:params.start.getHours()*60+params.start.getMinutes(),
                end:params.end.getHours()*60+params.end.getMinutes(),day:formatDateKey(params.start),
                endDay:formatDateKey(params.end),anchorConnected:anchor.isConnected});
            return true;
        };
        const state = {openPrototypeNewScheduleCard, calendar, sideDay:{calendar}};
        const dateClick = ${callbacks[side ? 0 : 1]};
        const selectRange = ${selections[side ? 0 : 1]};
        const surface = prototypeSurface;
        window.inputTrace = [];
        for (const type of ['pointerdown','pointermove','pointercancel','touchmove']) {
            surface.addEventListener(type,event => inputTrace.push({type,primary:event.isPrimary,pointerType:event.pointerType,target:event.target.className,
                cancelable:event.cancelable,x:event.clientX,y:event.clientY,scroll:surface.querySelector('.tm-proto-time-scroll')?.scrollTop,
                cards:surface.querySelectorAll('[data-tm-proto-draft]').length,main:prototypePointerSelection?.started,side:sidePrototypePointerSelection?.started}),true);
        }
        let prototypeEventDrag = null, sidePrototypeEventDrag = null;
        let prototypePointerSelection = null, sidePrototypePointerSelection = null;
        let prototypeSelectedEventId = '', sidePrototypeSelectedEventId = '';
        let prototypeSuppressSelectionClickUntil = 0, sidePrototypeSuppressSelectionClickUntil = 0;
        const getCalendarLongPressDelay = () => 40;
        const applySidePrototypeSelectedEventState = () => {};
        const sidePrototypeDate = () => new Date('2026-09-28T00:00:00');
        const callCalendarAdapter = (calendar,method,start,end,allDay,jsEvent,el) => {
            if (method === 'dispatchSelect') selectRange({start,end,allDay,jsEvent,el});
        };
        bindMobileTimelinePinch(prototypeSurface, {isMobile:isMobileDevice,onStart:() => { window.pinchStarts = (window.pinchStarts || 0) + 1; }});
        bindPrototypeScheduleDraft(prototypeSurface);
        ${selectionBindings(side)}
        surface.addEventListener('touchmove', event => {
            if (prototypePointerSelection?.started || sidePrototypePointerSelection?.started) event.preventDefault();
        }, {capture:true,passive:false});
        window.legacyDown = 0;
        prototypeSurface.addEventListener('pointerdown', () => legacyDown++, true);
        prototypeSurface.addEventListener('click', event => {
            if (Date.now() < (${side} ? sidePrototypeSuppressSelectionClickUntil : prototypeSuppressSelectionClickUntil)) return;
            const column = event.target.closest('.tm-proto-time-col') || document.elementFromPoint(event.clientX,event.clientY)?.closest('.tm-proto-time-col');
            if (!column) return;
            const canvas = column.closest('.tm-proto-time-canvas');
            const minute = prototypeTimelineMinutesAtPoint(canvas,event.clientY,getSettings());
            const date = new Date(column.dataset.tmProtoDay+'T00:00:00');
            date.setMinutes(Math.min(23, Math.floor(minute/60))*60);
            dateClick({date,allDay:false,el:column,jsEvent:event});
        });
        window.point = (minute, day = 0) => {
            const canvas = document.querySelector('.tm-proto-time-canvas');
            const column = document.querySelectorAll('.tm-proto-time-col')[day];
            const r = column.getBoundingClientRect();
            return {x:r.left+r.width/2,y:canvas.getBoundingClientRect().top+prototypeTimelineYForMinute(minute,getPrototypeTimelineMetricsFromCanvas(canvas,getSettings()))};
        };
        window.repaint = () => {
            const paint = () => {
                if (prototypeSurface.__tmTimelinePinch?.deferRender(paint)) return;
                if (prototypeSurface.__tmScheduleDraft.deferRender(paint)) return;
                const canvas = document.querySelector('.tm-proto-time-canvas');
                const next = canvas.cloneNode(true);
                next.querySelectorAll('[data-tm-proto-draft]').forEach(node => node.remove());
                canvas.replaceWith(next);
                const restored = prototypeSurface.__tmScheduleDraft.restore();
                inputTrace.push({type:'repaint',restored,cards:prototypeSurface.querySelectorAll('[data-tm-proto-draft]').length});
            };
            paint();
        };
        document.querySelector('.tm-proto-time-scroll').scrollTop = ${mobile ? 42 : 60} * 13;
    ` });
}
async function tapMinute(page, minute, mobile, day = 0) {
    const p = await page.evaluate(({minute,day}) => point(minute,day), {minute,day});
    if (mobile) await page.touchscreen.tap(p.x, p.y);
    else await page.mouse.click(p.x, p.y);
}
async function resizeEdge(page, edge, delta, mobile, cancel = false) {
    // Resolve the current node and geometry together; a queued repaint may replace it.
    const r = await page.evaluate(() => {
        const node = document.querySelector('[data-tm-proto-draft]');
        if (!node) return null;
        const {x,y,width,height} = node.getBoundingClientRect();
        return {x,y,width,height};
    });
    assert.ok(r,`draft stays visible: ${JSON.stringify(await page.evaluate(() => ({trace:inputTrace,opens})))}`);
    const x = r.x + r.width / 2, y = edge === 'start' ? r.y : r.y + r.height;
    await page.evaluate(data => inputTrace.push({type:'resize-start',...data}),{edge,r,x,y});
    if (mobile) {
        const session = await page.context().newCDPSession(page);
        await session.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[{x,y}]});
        await session.send('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:[{x,y:y+delta}]});
        await session.send('Input.dispatchTouchEvent', {type:cancel?'touchCancel':'touchEnd',touchPoints:[]});
        await session.detach();
    } else {
        await page.mouse.move(x,y); await page.mouse.down();
        await page.mouse.move(x,y+delta,{steps:4}); await page.mouse.up();
    }
    assert.equal(await page.locator('[data-tm-proto-draft]').count() > 0,true,`resize retains draft: ${JSON.stringify(await page.evaluate(() => ({trace:inputTrace,opens})))}`);
}
async function gesturePath(page, mobile, start, steps, options = {}) {
    const session = mobile ? await page.context().newCDPSession(page) : null;
    if (mobile) await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
    else { await page.mouse.move(start.x,start.y); await page.mouse.down(); }
    if (options.longPress) await page.waitForFunction(() => prototypePointerSelection?.started || sidePrototypePointerSelection?.started);
    for (const step of steps) {
        const point = {x:step.x,y:step.y};
        if (mobile) await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point]});
        else await page.mouse.move(point.x,point.y,{steps:4});
        if (step.check) await step.check();
    }
    if (mobile) {
        await session.send('Input.dispatchTouchEvent',{type:options.cancel?'touchCancel':'touchEnd',touchPoints:[]});
        await session.detach();
    } else await page.mouse.up();
}
async function verifyDraftMovement(page, mobile, side) {
    await page.goto('about:blank');
    await setup(page,mobile,side);
    const draft = page.locator('[data-tm-proto-draft]');
    const h = mobile ? 42 : 60;
    await tapMinute(page,16*60+15,mobile);
    await resizeEdge(page,'end',h/2,mobile);
    assert.equal(await draft.innerText(),'16:00 – 17:30');
    const box = await draft.boundingBox(), x = box.x+box.width/2, y = box.y+box.height/2;
    await gesturePath(page,mobile,{x,y},[
        {x,y:y+h,check:async () => {
            assert.equal(await draft.innerText(),'17:00 – 18:30','time updates before pointer release');
            assert.ok(Math.abs((await draft.boundingBox()).y-box.y-h)<1,'card follows the held pointer');
            await page.evaluate(() => repaint());
            assert.equal(await draft.innerText(),'17:00 – 18:30','a repaint retains the live draft');
        }},
        {x,y:y+h*1.5,check:async () => {
            assert.equal(await draft.innerText(),'17:30 – 19:00','drag continues after repaint');
            assert.ok(Math.abs((await draft.boundingBox()).y-box.y-h*1.5)<1);
        }},
    ]);
    assert.equal(await draft.innerText(),'17:30 – 19:00','release keeps the moved range');
    assert.equal(await page.evaluate(() => opens.length),0);
    await resizeEdge(page,'start',-h/2,mobile);
    assert.equal(await draft.innerText(),'17:00 – 19:00');
    await page.evaluate(() => repaint());
    const adjusted = await draft.boundingBox();
    await gesturePath(page,mobile,{x:adjusted.x+adjusted.width/2,y:adjusted.y+adjusted.height/2},[
        {x:adjusted.x+adjusted.width/2,y:adjusted.y+adjusted.height/2-h,check:async () => {
            assert.equal(await draft.innerText(),'16:00 – 18:00','move preserves the newly resized duration');
        }},
    ]);
    if (mobile) {
        const b = await draft.boundingBox();
        await gesturePath(page,true,{x:b.x+b.width/2,y:b.y+b.height/2},[
            {x:b.x+b.width/2,y:b.y+b.height/2-h/2,check:async () => assert.equal(await draft.innerText(),'15:30 – 17:30')},
        ],{cancel:true});
        assert.equal(await draft.innerText(),'16:00 – 18:00','cancel restores the most recently committed draft');
    }
    const geometry = await draft.evaluate(node => {
        const card = node.getBoundingClientRect(), col = node.parentElement.getBoundingClientRect();
        const svg = node.querySelector('svg');
        return {left:card.left-col.left,right:col.right-card.right,icon:svg.getBoundingClientRect().width,path:svg.querySelector('path').getAttribute('d')};
    });
    assert.ok(geometry.left <= 1 && geometry.right <= 1,'draft fills both sides of its date column');
    assert.equal(geometry.icon,19);
    assert.equal(geometry.path,'M2 9h15v1H2zM9 2h1v15H9z','both icon bars have equal one-pixel thickness');
    if (!side) await page.screenshot({path:path.join(root,`output/playwright/calendar-draft-moved-${mobile?'mobile':'desktop'}.png`)});
    const final = await draft.boundingBox();
    if (mobile) await page.touchscreen.tap(final.x+final.width/2,final.y+final.height/2);
    else await page.mouse.click(final.x+final.width/2,final.y+final.height/2);
    assert.deepEqual(await page.evaluate(() => opens),[{start:960,end:1080,day:'2026-09-28',endDay:'2026-09-28',anchorConnected:true}]);
}
async function verifyBlankSelection(page,mobile,side) {
    await page.goto('about:blank');
    await setup(page,mobile,side);
    const from = await page.evaluate(() => point(14*60+15));
    const to = await page.evaluate(() => point(15*60+45));
    const draft = page.locator('[data-tm-proto-draft]');
    await gesturePath(page,mobile,from,[{...to,check:async () => {
        const preview = page.locator('[data-tm-proto-selection-preview]');
        assert.equal(await preview.count(),1,`blank selection paints while held: ${JSON.stringify(await page.evaluate(() => inputTrace))}`);
        assert.equal(await preview.innerText(),'14:15 – 15:45');
        assert.equal(await preview.locator('svg.tm-proto-schedule-draft-plus').count(),1);
        assert.equal(await page.evaluate(() => opens.length),0);
        const visual = await preview.evaluate(node => {
            const box=node.getBoundingClientRect(), col=node.parentElement.getBoundingClientRect(), css=getComputedStyle(node);
            return {left:box.left-col.left,right:col.right-box.right,border:css.borderStyle,shadow:css.boxShadow};
        });
        assert.ok(visual.left <= 1 && visual.right <= 1);
        assert.equal(visual.border,'solid');
        assert.equal(visual.shadow,'none');
    }}],{longPress:mobile});
    assert.equal(await draft.innerText(),'14:15 – 15:45','release keeps the exact selected times');
    assert.equal(await page.evaluate(() => opens.length),0,'blank selection does not open the editor');
    assert.equal(await page.locator('[data-tm-proto-selection-preview]').count(),0);
    const b = await draft.boundingBox(), h = mobile ? 42 : 60;
    await gesturePath(page,mobile,{x:b.x+b.width/2,y:b.y+b.height/2},[
        {x:b.x+b.width/2,y:b.y+b.height/2+h/4,check:async () => assert.equal(await draft.innerText(),'14:30 – 16:00')},
    ]);
    assert.equal(await page.evaluate(() => opens.length),0);
    const r = await draft.boundingBox();
    if (mobile) await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);
    else await page.mouse.click(r.x+r.width/2,r.y+r.height/2);
    assert.deepEqual(await page.evaluate(() => opens),[{start:870,end:960,day:'2026-09-28',endDay:'2026-09-28',anchorConnected:true}]);
    await page.goto('about:blank');
    await setup(page,mobile,side);
    const start = await page.evaluate(() => point(13*60+15));
    const end = await page.evaluate(() => point(15*60+45,1));
    await gesturePath(page,mobile,start,[end],{longPress:mobile});
    assert.equal(await draft.count(),2,'multi-day selections retain both fragments');
    assert.equal(await page.locator('[data-tm-proto-draft] [data-tm-draft-edge]').count(),2);
    assert.equal(await page.evaluate(() => opens.length),0);
    const fragment = await draft.first().boundingBox();
    await gesturePath(page,mobile,{x:fragment.x+fragment.width/2,y:fragment.y+fragment.height/2},[
        {x:fragment.x+fragment.width/2,y:fragment.y+fragment.height/2+h/2,check:async () => {
            assert.match(await draft.first().innerText(),/13:45.*16:15/);
            assert.equal(await draft.count(),2);
        }},
    ]);
    assert.match(await draft.first().innerText(),/13:45.*16:15/);
}
async function run() {
    const browser = await chromium.launch({headless:true, ...(process.env.PLAYWRIGHT_EXECUTABLE ? {executablePath:process.env.PLAYWRIGHT_EXECUTABLE} : {})});
    try {
        for (const mobile of [false,true]) for (const side of [false,true]) {
            if (process.env.CALENDAR_DRAFT_CASE && process.env.CALENDAR_DRAFT_CASE !== `${mobile?'touch':'mouse'}-${side?'side':'main'}`) continue;
            const context = await browser.newContext({viewport:{width:mobile?390:1200,height:780},hasTouch:mobile,isMobile:mobile});
            const page = await context.newPage();
            const errors = []; page.on('pageerror', e => errors.push(e.message));
            await setup(page,mobile,side);
            const draft = page.locator('.tm-proto-schedule-draft');
            await tapMinute(page,16*60+58,mobile);
            assert.equal(await draft.count(),1,`first click stages one draft: ${JSON.stringify(errors)}`);
            assert.equal(await page.evaluate(() => opens.length),0,'first click never opens the editor');
            assert.equal(await draft.innerText(),'16:00 – 17:00','late-hour clicks stay inside their hour');
            if (!side) {
                fs.mkdirSync(path.join(root,'output/playwright'),{recursive:true});
                await page.screenshot({path:path.join(root,`output/playwright/calendar-click-draft-${mobile?'mobile':'desktop'}.png`)});
            }
            const hourHeight = mobile ? 42 : 60;
            await resizeEdge(page,'end',hourHeight/2,mobile);
            assert.match(await draft.innerText(),/16:00 – 17:30/);
            await resizeEdge(page,'start',-hourHeight/2,mobile);
            assert.match(await draft.innerText(),/15:30 – 17:30/);
            assert.equal(await page.evaluate(() => opens.length),0,'resize release never opens editor');
            assert.equal(await page.evaluate(() => legacyDown),1,'draft gestures never enter drag selection');
            if (mobile) {
                await resizeEdge(page,'end',hourHeight,mobile,true);
                assert.match(await draft.innerText(),/15:30 – 17:30/,'cancel restores the original range');
            }
            const r = await draft.boundingBox();
            if (mobile) await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);
            else await page.mouse.click(r.x+r.width/2,r.y+r.height/2);
            assert.deepEqual(await page.evaluate(() => opens),[{start:930,end:1050,day:'2026-09-28',endDay:'2026-09-28',anchorConnected:true}]);
            assert.equal(await draft.count(),0,'confirmation removes the draft');
            await tapMinute(page,17*60+10,mobile,1);
            await tapMinute(page,15*60+10,mobile);
            assert.equal(await draft.count(),1,'a new empty-hour click replaces the draft');
            assert.match(await draft.innerText(),/15:00 – 16:00/);
            await resizeEdge(page,'start',hourHeight*2,mobile);
            assert.match(await draft.innerText(),/15:45 – 16:00/,'edges retain a 15-minute minimum');
            const short = await draft.boundingBox();
            const center = {x:short.x+short.width/2,y:short.y+short.height/2};
            const hit = await page.evaluate(p => ({html:document.elementFromPoint(p.x,p.y).outerHTML,
                open:!!document.elementFromPoint(p.x,p.y).closest('.tm-proto-schedule-draft-open'),
                handles:[...document.querySelectorAll('[data-tm-draft-edge]')].map(e=>({edge:e.dataset.tmDraftEdge,rect:e.getBoundingClientRect().toJSON(),after:getComputedStyle(e,'::after').top})),
            }),center);
            assert.equal(hit.open,true,`the plus stays tappable on compact cards: ${JSON.stringify({short,center,hit})}`);
            await draft.locator('.tm-proto-schedule-draft-open').focus();
            await page.keyboard.press('Escape');
            assert.equal(await draft.count(),0);
            await page.evaluate(() => document.querySelector('.tm-proto-time-scroll').scrollTop = 2000);
            await tapMinute(page,23*60+50,mobile,1);
            assert.match(await draft.innerText(),/23:00 – 24:00/,'last-hour preview stays inside the day');
            await draft.locator('[data-tm-draft-edge="end"]').focus();
            await page.keyboard.press('ArrowDown');
            assert.match(await draft.innerText(),/23:00 – 24:00/);
            if (mobile) {
                const r = await draft.boundingBox();
                const beforeScroll = await page.locator('.tm-proto-time-scroll').evaluate(el => el.scrollTop);
                const session = await context.newCDPSession(page);
                const x = r.x+r.width/4, y = r.y+r.height/2;
                await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
                await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+80}]});
                await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
                await session.detach();
                assert.equal(await page.evaluate(() => opens.length),1,'scrolling over a draft never opens another editor');
                assert.equal(await page.locator('.tm-proto-time-scroll').evaluate(el => el.scrollTop),beforeScroll,'draft body drags the range instead of scrolling');
            }
            await verifyDraftMovement(page,mobile,side);
            await verifyBlankSelection(page,mobile,side);
            assert.deepEqual(errors,[]);
            await context.close();
            console.log(`calendar click draft: ${mobile?'touch':'mouse'} / ${side?'side':'main'} passed`);
        }
    } finally { await browser.close(); }
}
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = {setup,readFunction,tapMinute,resizeEdge,gesturePath};
