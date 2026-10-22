'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readFunction, readCallback, readPointerHandler } = require('./calendar-all-day-drag.test.js');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8').replace(/\r\n/g, '\n');

function declaration(name) {
    const match = new RegExp(`^( +)(?:const )?${name} = .*?=> \\{`, 'm').exec(source);
    assert.ok(match, name);
    const start = match.index;
    return source.slice(start, source.indexOf(`\n${match[1]}};`, start) + match[1].length + 4);
}

function fixture(side = false, view = 'timeGridWeek', sourceType = 'taskdate', spanDays = 1, continuation = false, rollup = false) {
    const count = side || view === 'timeGridDay' ? 1 : view === 'timeGrid3Day' ? 3 : 7;
    const engine = ['calendar-date', 'calendar-store', 'calendar-layout', 'calendar-renderer', 'calendar-engine']
        .map(name => fs.readFileSync(path.join(root, 'src/calendar', `${name}.js`), 'utf8')).join('\n');
    const helpers = ['parseDateOnly', 'resolveSharedPrototypeEventStart', 'resolveSharedPrototypeEventEnd', 'resolvePrototypeTimedDropHit',
        'buildPrototypeTimedDragPreview', 'isRollupTaskDateDrag', 'createScheduleFromRollupTaskDateDrop',
        'bindPrototypeSurfacePointerHandler', 'isPrototypeEventTextHit',
        'lockPrototypeTouchDragScroll', 'suppressPrototypeOpeningPointerClick',
        'getPrototypeTimelineMetrics', 'getPrototypeTimelineMetricsFromCanvas',
        'prototypeTimelineMinutesAtPoint', 'prototypeTimelineMinuteForY', 'prototypeTimelineYForMinute']
        .concat(['getPrototypeTimelineVisibleEventSegments', 'buildSharedPrototypeTimelineMarkup',
            'buildSharedPrototypeSpanMarkup', 'buildSharedPrototypeEventMarkup', 'buildSharedPrototypeAllDayToggleMarkup',
            'buildSharedPrototypeDayPanelMarkup'])
        .map(readFunction).join('\n');
    return `<!doctype html><meta charset="utf-8"><style>${fs.readFileSync(path.join(root, 'calendar-view.css'), 'utf8')}</style><style>
        body{margin:20px;font:14px system-ui;--tm-cal-primary:#3978dc;--tm-cal-panel:#fdfdfe;--tm-cal-border:#ccd1d9;--tm-proto-axis-width:40px}
        .fixture{height:650px;width:${side ? 360 : 900}px}
        .tm-proto-timeline{height:600px;--tm-proto-cols:${count}}
        .tm-proto-time-scroll{height:480px!important;flex:none!important}
        .tm-proto-event{background:#dce9fc;color:#17305b;touch-action:none}
        .tm-proto-time-col>.tm-proto-event{position:absolute;left:4px;right:4px}
        .overlay{position:absolute;inset:0;z-index:300;pointer-events:auto}
    </style><div class="fixture" ${side ? 'data-tm-side-proto-surface' : 'data-tm-cal-surface'}></div><script>${engine}</script><script>
        const side = ${side}, count = ${count};
        const surface = document.querySelector('.fixture'), prototypeSurface = surface, sidePrototypeSurface = surface;
        const formatDateKey = date => date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
        const getSettings = () => ({visibleStartTime:'00:00',visibleEndTime:'24:00'});
        const getCalendarVisibleSlotRange = () => ({slotMinTime:'00:00:00',slotMaxTime:'24:00:00'});
        const getPrototypeHourHeight = () => 60;
        const isLikelyMobileRuntime = () => false;
        const readDesktopTimelineScale = () => 1;
        const readMobileTimelineScale = () => 1;
        const applyPrototypeTimelineScale = value => value;
        const pad2 = value => String(value).padStart(2,'0');
        const esc = value => String(value);
        const normalizeCalendarWeekAllDayVisibleRows = () => 5;
        const isCalendarForegroundEvent = () => true;
        const mergeCalendarAllDayReminders = events => events;
        const isScheduleAllDayBottom = () => false;
        const compareSharedPrototypeEvents = () => 0;
        const getIsoWeekNumber = () => 43;
        const resolveCalendarEventDoneState = () => false;
        const isCalendarBuiltinScheduleEvent = () => false;
        const shouldShowCalendarEventCheckbox = () => ${continuation};
        const isIndependentScheduleEventExt = () => false;
        const getCalendarEventColor = () => '#3978dc';
        const buildCalendarRecurringTaskIconMarkup = () => '';
        const buildCalendarMergedReminderMarkup = () => '';
        const parseCalendarTimeToMinutes = value => Number(String(value).split(':')[0])*60+Number(String(value).split(':')[1] || 0);
        const PROTOTYPE_TIME_COLLAPSE_BAND_HEIGHT = 28;
        ${helpers}
        let prototypeEventDrag = null, sidePrototypeEventDrag = null, prototypePointerSelection = null, sidePrototypePointerSelection = null;
        let prototypeSelectedEventId = '', sidePrototypeSelectedEventId = '', prototypeLastRenderKey = '';
        let prototypeSuppressClickUntil = 0, prototypeSuppressClickEventId = '', prototypeSuppressSelectionClickUntil = 0;
        let sidePrototypeSuppressClickUntil = 0, sidePrototypeSuppressClickEventId = '', sidePrototypeSuppressSelectionClickUntil = 0;
        window.writes = []; window.notices = []; window.dispatches = []; window.pending = 0;
        const state = {sideDay:{},isMobileDevice:false};
        const owner = __tmCalendarEngine.createCalendarEngine(null, {
            initialView:${JSON.stringify(view)},initialDate:'2026-10-22',
            eventDrop:${readCallback('eventDrop', side)}, eventResize:${readCallback('eventResize', side)}
        });
        ${side ? 'const cal = owner; state.sideDay.calendar = owner;' : 'const calendar = owner; state.calendar = owner;'}
        owner.render();
        owner.addEvent({id:'task',title:${JSON.stringify(continuation ? '在线监控铭牌ECN' : '全天任务')},start:'2026-10-${continuation ? 20 : 22}',end:'2026-10-${22 + spanDays}',allDay:true,
            editable:${!rollup},startEditable:${!rollup},durationEditable:${!rollup},
            extendedProps:{__tmSource:${JSON.stringify(sourceType)},__tmTaskId:'task',__tmDurationMin:60,__tmTaskDateRollup:${rollup}}});
        ${continuation ? "owner.addEvent({id:'second',title:'样机ZP/VP泵安装',start:'2026-10-22',end:'2026-10-25',allDay:true,extendedProps:{__tmSource:'taskdate',__tmTaskId:'second'}});" : ''}
        const getCalendarView = value => value.view;
        const getCalendarEventById = (value,id) => value.getEventById(id);
        const getSidePrototypeEvent = getCalendarEventById;
        const getCalendarEventIdFromElement = el => el.getAttribute('data-tm-proto-event');
        const protoSafeDate = value => value ? new Date(value) : null;
        const protoDayStart = value => { const date=protoSafeDate(value); if(date) date.setHours(0,0,0,0); return date; };
        const protoAddDays = (value,days) => { const date=new Date(value); date.setDate(date.getDate()+days); return date; };
        const protoEventEnd = resolveSharedPrototypeEventEnd;
        const protoDateKey = formatDateKey;
        const sidePrototypeDate = () => new Date('2026-10-22T00:00:00');
        const getCalendarLongPressDelay = () => 30;
        const clampNewScheduleDurationMin = value => value > 0 ? value : 60;
        const getPrototypeDayColumnWidth = () => (surface.clientWidth-40)/count;
        ${declaration('protoIsSpanEvent')}
        const protoEventTitle = event => event.title;
        const protoEventColor = () => '#3978dc';
        const isCompactDockLayout = () => false;
        ${side ? '' : declaration('protoSpanMarkup')}
        const applyPrototypeSelectedEventState = () => {};
        const applySidePrototypeSelectedEventState = () => {};
        const beginSidePrototypeDragScrollSnapshot = () => {};
        const finishSidePrototypeDragScroll = () => {};
        const beginSidePrototypeCommittedDrag = () => null;
        const clearPrototypeDragLayer = () => {};
        const renderPrototypeSelectionPreview = () => {};
        const resolvePrototypeSelectionRange = () => null;
        const rememberPendingTaskDateEventPatch = () => pending++;
        const forgetPendingTaskDateEventPatch = () => {};
        const buildTaskDatePatchFromEvent = () => ({taskId:'task'});
        const shouldCreateScheduleFromTaskDateDrop = arg => !arg.event.allDay;
        const createScheduleFromTaskDateDrop = async arg => { writes.push({kind:'create',hour:arg.event.start.getHours()});arg.revert?.(); };
        const persistTaskDateEventChange = async (arg,options) => { if(options.calendar!==owner) throw Error('wrong owner');writes.push({kind:'date'});return {}; };
        const persistScheduleEventTimeChange = async arg => { writes.push({kind:'schedule',hour:arg.event.start.getHours()});return {}; };
        const settleSidePrototypeCommittedDrag = () => {};
        const toast = (message,level) => notices.push({message,level});
        const callCalendarAdapter = (value,method,...args) => { dispatches.push(method);return value[method](...args); };
        ${declaration('resolvePrototypeDayCellAtPoint')}
        ${declaration('resolvePrototypeDayAtPoint')}
        ${declaration('resolvePrototypeAllDayCellAtPoint')}
        ${declaration('resolvePrototypeTimedDropAtPoint')}
        ${declaration('resolveSidePrototypeTimedDropAtPoint')}
        ${declaration('getPrototypeAllDayDragDates')}
        ${declaration('restorePrototypeDragPreview')}
        ${declaration('restoreSidePrototypeDragPreview')}
        const getDrag = () => side ? sidePrototypeEventDrag : prototypeEventDrag;
        function paint() {
            const scrollTop=surface.querySelector('.tm-proto-time-scroll')?.scrollTop ?? 480;
            const drag=getDrag(), live=owner.getEventById('task');
            const events=(drag?.previewMode==='timed' ? buildPrototypeTimedDragPreview(live,drag) : [live]).concat(owner.getEvents().filter(event=>event.id!=='task'));
            surface.innerHTML=${side ? 'buildSharedPrototypeDayPanelMarkup' : 'buildSharedPrototypeTimelineMarkup'}({date:new Date(2026,9,22),panelClass:'tm-proto-side-panel',days:Array.from({length:count},(_,i)=>new Date(2026,9,22+i)),
                settings:getSettings(),events,hourHeight:60,availableHeight:480,showHeader:false,viewType:${JSON.stringify(view)},
                eventEnd:resolveSharedPrototypeEventEnd,${side ? '' : 'spanMarkup:protoSpanMarkup,'}});
            surface.querySelector('.tm-proto-time-scroll').scrollTop=scrollTop;
            if(drag) {
                const id=drag.previewMode==='timed' ? drag.previewEventId : drag.id;
                const next=Array.from(surface.querySelectorAll('[data-tm-proto-event]')).find(el=>el.dataset.tmProtoEvent===id);
                if(next) { drag.eventEl=next;drag.visualEl=next;drag.eventCell=next.closest('.tm-proto-allday-cell');drag.previewRendered=true; }
            }
        }
        const renderPrototypeSurface=paint, renderSidePrototype=paint;
        const queuePrototypeSurfaceRender=()=>requestAnimationFrame(paint), queueSidePrototypeRender=queuePrototypeSurfaceRender;
        paint();
        ${['pointerdown','pointermove','pointerup','pointercancel'].map(type => `bindPrototypeSurfacePointerHandler(surface,'${type}',${readPointerHandler(type,side)},true);`).join('\n')}
        window.previewState=()=>({origin:surface.querySelectorAll('.tm-proto-allday-cell [data-tm-proto-event="task"]').length,
            preview:surface.querySelectorAll('.tm-proto-event--drag-preview').length,writes,dispatches,pending,notices,
            active:!!getDrag(),top:surface.querySelector('.tm-proto-time-scroll').getBoundingClientRect().top});
    </script>`;
}

async function verify(page, side, view, sourceType, action, touch = false, spanDays = 1, grabFraction = null, continuation = false, rollup = false) {
    await page.goto('about:blank');
    await page.setContent(fixture(side, view, sourceType, spanDays, continuation, rollup));
    const before = await page.evaluate(() => previewState());
    const origin = page.locator('.tm-proto-allday-cell [data-tm-proto-event="task"]').first();
    const box = await (spanDays > 1 && grabFraction === null ? origin.locator('.tm-proto-span-title') : origin).boundingBox();
    if (continuation && side) {
        assert.equal(await origin.locator('.tm-proto-span-continuation-marker--start').count(),1);
        assert.equal(await origin.locator('.tm-proto-span-continuation-marker--end').count(),1);
    }
    if (spanDays > 1 && !touch) await origin.locator('.tm-proto-span-title').evaluate(el => {
        const range=document.createRange();range.selectNodeContents(el);getSelection().removeAllRanges();getSelection().addRange(range);
    });
    const start = {x:box.x+box.width*(grabFraction ?? 0.5),y:box.y+box.height/2};
    const target = {x:start.x,y:before.top+120};
    const session = touch ? await page.context().newCDPSession(page) : null;
    const move = async point => {
        if (touch) await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point]});
        else await page.mouse.move(point.x,point.y,{steps:4});
        await page.evaluate(() => new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    };
    if (touch) {
        await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
        await page.waitForFunction(() => (side ? sidePrototypeEventDrag : prototypeEventDrag)?.started);
    } else { await page.mouse.move(start.x,start.y);await page.mouse.down(); }
    // Cover the slot with a non-column layer, as happens with collapse controls.
    await page.evaluate(() => { const layer=document.createElement('div');layer.className='overlay';document.querySelector('.tm-proto-time-canvas').appendChild(layer); });
    await move(target);
    let current = await page.evaluate(() => previewState());
    assert.equal(current.preview,1,`${side}/${view}: show the timed preview even under another layer`);
    assert.ok(current.origin>=1,'the original all-day card must stay visible');
    assert.equal(current.top,before.top,'preview must not change the all-day lane height');
    assert.equal(current.writes.length,0,'moving only previews');
    if (action === 'return' || action === 'again') {
        await move(start);
        current = await page.evaluate(() => previewState());
        assert.equal(current.preview,0,'returning to the all-day lane removes the timed preview');
        assert.ok(current.origin>=1);
        if (action === 'again') await move(target);
    }
    if (action === 'cancel') {
        if (touch) await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
        else await page.evaluate(() => surface.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,pointerType:'mouse',bubbles:true})));
    } else if (touch) await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    else await page.mouse.up();
    if (session) await session.detach();
    if (!touch && action === 'cancel') await page.mouse.up();
    await page.evaluate(() => new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    current = await page.evaluate(() => previewState());
    const commit = action === 'drop' || action === 'again';
    assert.equal(current.writes.length,commit ? 1 : 0,`${side}/${view}/${action}: commit exactly once only at the final timed drop`);
    assert.equal(current.dispatches.length,commit && !rollup ? 1 : 0);
    if (rollup) {
        const original = await page.evaluate(() => {
            const event=owner.getEventById('task');
            return {allDay:event.allDay,editable:event.editable,start:formatDateKey(event.start),end:formatDateKey(event.end)};
        });
        assert.deepEqual(original,{allDay:true,editable:false,start:'2026-10-20',end:'2026-10-25'},'scheduling must never mutate the rollup dates');
        assert.equal(current.pending,0,'scheduling must not queue date writes for rollup tasks');
    }
    assert.equal(current.active,false);
    assert.equal(current.preview,0,'finishing or cancelling removes the preview');
    assert.equal(current.notices.some(notice=>notice.level==='error'),false,JSON.stringify(current.notices));
}

async function main() {
    const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
    const browser = await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE ? {executablePath:process.env.PLAYWRIGHT_EXECUTABLE} : {})});
    try {
        const context = await browser.newContext({viewport:{width:1100,height:800},hasTouch:true});
        const page = await context.newPage();
        const errors=[];
        page.on('pageerror',error=>{errors.push(error.message);console.error(error.message);});
        const verifyContinuations = async () => {
            for (const rollup of [false,true]) {
                for (const touch of [false,true]) {
                    for (const action of ['drop','return','again','cancel']) await verify(page,true,'timeGridDay','taskdate',action,touch,3,null,true,rollup);
                }
                console.log('sidebar middle continuation: rollup='+rollup+' passed');
            }
            for (const touch of [false,true]) {
                for (const action of ['drop','return','again','cancel']) await verify(page,false,'timeGridDay','taskdate',action,touch,3,null,true,true);
            }
        };
        if (process.argv.includes('--continuation')) {
            await verifyContinuations();
            assert.deepEqual(errors,[]);
            return;
        }
        for (const side of [true,false]) {
            for (const view of side ? ['timeGridDay'] : ['timeGridDay','timeGrid3Day','timeGridWeek']) {
                for (const sourceType of ['taskdate','schedule']) {
                    for (const action of ['return','drop','again','cancel']) await verify(page,side,view,sourceType,action);
                }
                console.log(`all-day browser drag: ${side?'sidebar':view}, mouse passed`);
            }
        }
        for (const side of [true,false]) {
            for (const action of ['return','again','cancel']) await verify(page,side,'timeGridDay','taskdate',action,true);
        }
        for (const side of [true,false]) {
            for (const action of ['return','drop','again','cancel']) await verify(page,side,'timeGridWeek','schedule',action,false,3);
            for (const action of ['return','again','cancel']) await verify(page,side,'timeGridWeek','schedule',action,true,3);
        }
        await verify(page,false,'timeGridWeek','schedule','return',false,3,0.7);
        await verifyContinuations();
        assert.deepEqual(errors,[],'browser gesture handlers must not throw');
        console.log('all-day browser drag: touch, persistent origins, live previews, repeated moves and cancellation passed');
    } finally { await browser.close(); }
}

if (process.argv.includes('--fixture')) {
    const output=path.join(root,'output/playwright/calendar-all-day-drag');
    fs.mkdirSync(output,{recursive:true});
    fs.writeFileSync(path.join(output,'sidebar.html'),fixture(true,'timeGridDay'));
    console.log(path.join(output,'sidebar.html'));
} else if (require.main === module) main().catch(error=>{console.error(error);process.exitCode=1;});
