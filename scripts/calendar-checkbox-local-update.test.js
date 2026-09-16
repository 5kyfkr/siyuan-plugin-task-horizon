'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const runtime = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js'), 'utf8');
function between(text, start, end, from = 0) {
    const a = text.indexOf(start, from);
    const b = text.indexOf(end, a + start.length);
    assert.ok(a >= 0 && b > a, start);
    return text.slice(a, b);
}
const functions = [
    between(source, '    function applyTaskDoneVisual(', '    function applyCalendarEventDoneBorderTone('),
    between(source, '    function isRecurringScheduleEventExt(', '    async function setCalendarReminderOccurrenceDone('),
    between(source, '    function shouldHideCompletedAllDayCalendarEvent(', '    function getCalendarCompactEventLeadingLayoutVars('),
    between(source, '    function collectCalendarsForTaskSync(', '    function syncTaskPriorityInPlace('),
    between(source, '    function syncTaskDoneInPlace(', '    function refreshSideDayLayout('),
    between(source, '    function queueTaskDateCalendarRender(', '    function applyPendingTaskDateEventPatches('),
].join('\n');
const ingress = between(runtime, '    const __tmSetDoneIngressByTask =', '    async function __tmSetDoneFromUi(')
    + between(runtime, '    window.tmSetDone = function(', '    // 保存所有任务到MetaStore');
const reconcile = between(source, '        const syncPrototypeListControl =', '        const protoRenderList =');
const clickStart = source.indexOf('            eventClick: (arg) => {');
const mainClickStart = source.indexOf('            eventClick: (arg) => {', clickStart + 1);
const clickEnd = "                try {\n                    if (target instanceof Element && target.closest('.tm-cal-task-event-check, .tm-proto-event-check')) return;";
const clickBody = (start) => between(source, '            eventClick: (arg) => {', clickEnd, start)
    .replace('            eventClick:', '') + '\n}';
const mainSurfaceCheck = between(source, "                const checkEl = target?.closest?.('[data-tm-proto-check]');", '                const moreEl =', mainClickStart > 0 ? source.indexOf('const onPrototypeEventDocumentClick') - 12000 : 0);

const counters = { main: 0, side: 0, store: 0 };
const settings = { showCompletedAllDaySchedules: true };
const tasks = { a: false };
const context = vm.createContext({
    console, Date, Map, Set, HTMLElement: class {}, HTMLInputElement: class {},
    CSS: { escape: (value) => value },
    state: { queuePrototypeSurfaceRender: () => counters.main++, sideDay: { prototypeRender: () => counters.side++ } },
    window: { tmIsTaskDone: (id) => tasks[id] === true },
    getCalendarEvents: (cal) => cal.events,
    getCalendarView: (cal) => cal.view,
    getSettings: () => settings,
    isCalendarListViewType: (view) => view.startsWith('list'),
    normalizeScheduleRepeatType: (value) => value || 'none',
    normalizeScheduleCompletedOccurrenceKey: (value) => String(value || ''),
});
vm.runInContext(functions, context);
const dateEvent = { id: 'date-a', allDay: true, extendedProps: { __tmSource: 'taskdate', __tmTaskId: 'a', __tmTaskDone: true }, setExtendedProp() { counters.store++; } };
const schedule = { id: 'schedule-a', allDay: false, extendedProps: { __tmSource: 'schedule', __tmTaskId: 'a' } };
const history = { id: 'history-a', allDay: true, extendedProps: { __tmSource: 'taskdate', __tmTaskId: 'a', __tmSourceTaskId: 'a', __tmTaskDateReadOnly: true, __tmRecurringCompletedAt: '2026-09-09', __tmTaskDone: true } };
const unrelated = { id: 'date-b', allDay: true, extendedProps: { __tmSource: 'taskdate', __tmTaskId: 'b', __tmTaskDone: false } };
const calendar = { events: [dateEvent, schedule, history, unrelated], view: { type: 'dayGridMonth' } };
context.state.calendar = calendar;
context.state.sideDay.calendar = { events: [], view: { type: 'timeGridDay' } };
assert.equal(context.resolveCalendarEventDoneState(dateEvent.extendedProps, { taskDoneOverride: false }), false, 'explicit uncomplete must beat the old event snapshot');
assert.equal(context.resolveCalendarEventDoneState(dateEvent.extendedProps), false, 'live pending task must beat a stale completed date event');
for (const ext of [
    { __tmSource: 'taskdate', __tmTaskId: 'a', __tmRepeatType: 'daily' },
    { __tmSource: 'schedule', __tmTaskId: 'a', __tmRepeatType: 'weekly', __tmScheduleId: 'repeat', __tmOccurrenceStartMs: 123 },
    { __tmSource: 'schedule', __tmRepeatType: 'daily', __tmScheduleId: 'standalone-repeat', __tmOccurrenceStartMs: 123 },
    history.extendedProps,
]) assert.equal(context.shouldShowCalendarEventCheckbox(ext, { viewType: 'dayGridMonth' }), true, 'recurring task and completed history checkboxes must remain visible');
for (const done of [true, false, true, false]) {
    tasks.a = done;
    context.syncTaskDoneInPlace('a', done, { flushTaskPanel: false });
    assert.equal(dateEvent.extendedProps.__tmTaskDone, done);
    assert.equal(history.extendedProps.__tmTaskDone, true, 'source-task changes must not overwrite completed recurring history');
    assert.equal(context.resolveCalendarEventDoneState(history.extendedProps), true);
    assert.equal(unrelated.extendedProps.__tmTaskDone, false);
}
assert.deepEqual(counters, { main: 0, side: 0, store: 0 }, 'ordinary completion must not reload sources or redraw surfaces');
settings.showCompletedAllDaySchedules = false;
context.syncTaskDoneInPlace('a', true, { flushTaskPanel: false });
assert.equal(counters.main, 1, 'hiding completed events requires a local layout refresh');
assert.equal(calendar.events.length, 4, 'hidden events must remain available for undo');
context.syncTaskDoneInPlace('a', false, { flushTaskPanel: false });
assert.equal(counters.main, 2);
settings.showCompletedAllDaySchedules = true;
calendar.view.type = 'listMonth';
context.syncTaskDoneInPlace('child-without-own-event', true, { flushTaskPanel: false });
assert.equal(counters.main, 3, 'a child completion must update its parent list card even without its own event');
Object.assign(context, {
    prototypeSurface: new context.HTMLElement(),
    prototypePendingPartialRefresh: null,
    prototypeLastRenderKey: '', prototypeLastEventSnapshot: null,
    patchedEvents: [],
    applyRenderedEventDoneStateById: (id, done) => context.patchedEvents.push({ id, done }),
});
vm.runInContext(between(source, '        const prototypeEventSnapshotChanged =', '        const forEachPrototypeSnapshotDay =')
    + between(source, '        const tryPrototypePartialRefresh =', '        renderPrototypeSurface =')
    + '\nglobalThis.tryPartial = tryPrototypePartialRefresh;', context);
const previousSnapshots = new Map([['date-a', { id: 'date-a', allDay: true, done: false }], ['timed-a', { id: 'timed-a', allDay: false, done: false }]]);
const nextSnapshots = new Map([...previousSnapshots].map(([id, snapshot]) => [id, { ...snapshot, done: true }]));
assert.equal(context.tryPartial({ view: calendar.view, viewType: 'dayGridMonth', previousSnapshots, nextSnapshots, renderKey: 'done' }), true,
    'a later source refresh must patch mixed timed/all-day completion without rebuilding the month');
assert.equal(context.patchedEvents.length, 2);
// Completing a task can hide its all-day span and check a timed peer in one
// batch. The month renderer must only rebuild the week containing that task.
const scroller = new context.HTMLElement();
const targetRow = new context.HTMLElement(), unrelatedRow = new context.HTMLElement();
targetRow.isConnected = unrelatedRow.isConnected = true;
let replacedRows = 0;
targetRow.replaceWith = () => replacedRows++;
unrelatedRow.replaceWith = () => { throw new Error('Unrelated week rebuilt'); };
context.prototypeSurface.querySelector = () => scroller;
Object.assign(context, {
    isMobileDevice: false, prototypeShowDayPanel: false, prototypePanelDate: null,
    prototypeMonthVirtualRows: new Map([[1, targetRow], [2, unrelatedRow]]),
    forEachPrototypeSnapshotDay: (snapshot, fn) => { if (snapshot) fn(new Date(2026, 8, 19)); },
    protoDateKey: () => '2026-09-19', getPrototypeMonthCanvasGeometry: () => ({ rowHeight: 100 }),
    getPrototypeMonthWeekIndex: () => 1, buildPrototypeMonthWeekRowMarkup: () => '<div></div>',
    syncPrototypeMonthVirtualWindow: () => {},
    document: { createElement: () => {
        const row = new context.HTMLElement(); row.style = {};
        return { firstElementChild: row };
    } },
});
assert.equal(context.tryPartial({ view: calendar.view, viewType: 'dayGridMonth', previousSnapshots,
    nextSnapshots: new Map([['timed-a', nextSnapshots.get('timed-a')]]), renderKey: 'hidden', events: [] }), true,
    'mixed timed/all-day visibility changes must preserve unaffected month weeks');
assert.equal(replacedRows, 1);
assert.equal(context.prototypeMonthVirtualRows.get(2), unrelatedRow);
Object.assign(context, {
    esc: (value) => String(value),
    buildCalendarRecurringTaskIconMarkup: () => '',
    getCalendarEventColor: () => '#527acc',
    pad2: (value) => String(value).padStart(2, '0'),
});
vm.runInContext(between(source, '    function buildSharedPrototypeEventMarkup(', '    function resolveSharedPrototypeEventEnd('), context);
for (const mode of ['chip', 'allday', 'block']) {
    const markup = context.buildSharedPrototypeEventMarkup({ id: 'standalone', title: '循环日程', start: new Date(),
        extendedProps: { __tmSource: 'schedule', __tmRepeatType: 'daily', __tmScheduleId: 'standalone', __tmOccurrenceStartMs: 123 } }, mode, false, '', settings, { viewType: 'dayGridMonth' });
    assert.match(markup, /class="tm-proto-event-check"/, 'standalone recurring schedules must render an operable occurrence checkbox');
    assert.doesNotMatch(markup, /tm-proto-event--calendar-builtin/, 'all-day CSS must not hide a recurring occurrence checkbox');
}

// Build an isolated browser fixture using the actual click handlers, event store,
// completion bridge and list reconciliation. No live user task is modified.
if (process.argv.includes('--browser-fixture')) {
    const dir = path.join(root, 'output', 'playwright');
    fs.mkdirSync(dir, { recursive: true });
    const fixture = `<!doctype html><meta charset="utf-8"><title>Calendar completion regression</title>
<style>body{font:16px sans-serif} .event,.tm-proto-list-task-card{padding:10px;border:1px solid #ccc;margin:4px} .is-done,.tm-kanban-card--done{text-decoration:line-through} .tm-proto-list{height:180px;overflow:auto} .spacer{height:450px}</style>
<button id="month">切到月视图</button><button id="fail">模拟下一次保存失败</button><div id="root"></div><div id="side"></div><div id="overflow"></div><output id="result"></output>
<script>
${fs.readFileSync(path.join(root, 'src/calendar/calendar-date.js'), 'utf8')}
${fs.readFileSync(path.join(root, 'src/calendar/calendar-store.js'), 'utf8')}
const tasks = {a:false,b:false}; const counters = {store:0, main:0, side:0, writes:[]};
const settings = {showCompletedAllDaySchedules:true}; let failNext=false; let pending=Promise.resolve();
const store=__tmCalendarStore.createCalendarStore({onChange(){counters.store++}});
store.setSourceEvents('tasks', [{id:'date-a',start:'2026-09-09',end:'2026-09-15',allDay:true,extendedProps:{__tmSource:'taskdate',__tmTaskId:'a',__tmTaskDone:false}},{id:'timed-a',start:'2026-09-09T10:00:00',extendedProps:{__tmSource:'schedule',__tmTaskId:'a'}},{id:'date-b',start:'2026-09-09',allDay:true,extendedProps:{__tmSource:'taskdate',__tmTaskId:'b',__tmTaskDone:false}}]); counters.store=0;
const calendar={...store,view:{type:'listMonth'}};
const state={calendar,wrapEl:document.querySelector('#root'),sideDay:{rootEl:document.querySelector('#side'),calendar:{...store,view:{type:'timeGridDay'}},prototypeRender(){counters.side++}},__tmPrototypeMorePopover:{el:document.querySelector('#overflow')}};
const prototypeSurface=state.wrapEl; const _tmClickTracker=null;
const getCalendarView=c=>c.view, getCalendarEvents=c=>c.getEvents(), getCalendarEventById=(c,id)=>c.getEventById(id);
const getSettings=()=>settings, isCalendarListViewType=v=>v.startsWith('list'), scheduleTaskPageRender=()=>{};
const normalizeScheduleRepeatType=v=>v||'none', normalizeScheduleCompletedOccurrenceKey=v=>String(v||'');
window.tmIsTaskDone=id=>tasks[id]===true;
const getCalendarEventIdFromElement=el=>el?.getAttribute('data-tm-proto-event')||'';
const resolveCalendarEventInteractiveHit=(ev,opt)=>({kind:'checkbox',checkboxEl:ev.target,eventEl:opt.preferredEventEl});
${functions}
${reconcile}
${ingress}
const listMarkup=()=>'<div class="tm-proto-app"><div class="tm-proto-toolbar">Toolbar</div><div class="tm-proto-main"><section class="tm-proto-list"><div class="tm-proto-list-picker">Picker</div><div class="tm-proto-list-days">'+['a','b'].map(id=>'<div class="tm-proto-list-task-card '+(tasks[id]?'tm-kanban-card--done':'')+'" data-tm-proto-event="date-'+id+'"><input id="list-'+id+'" class="tm-task-checkbox" type="checkbox" '+(tasks[id]?'checked':'')+' data-task-id="'+id+'" onchange="tmSetDone(this.dataset.taskId,this.checked,event)"><span>'+id+'</span></div>').join('')+'<div class="spacer"></div></div></section></div></div>';
const eventMarkup=(id,name)=>'<div class="event tm-proto-span-bar" data-tm-proto-event="'+id+'"><input id="'+name+'" class="tm-proto-event-check" data-tm-proto-check="'+id+'" type="checkbox"><span class="tm-proto-span-title">'+name+'</span></div>';
prototypeSurface.innerHTML=listMarkup()+'<div id="month-events">'+eventMarkup('date-a','month-a')+eventMarkup('date-a','month-continuation')+eventMarkup('timed-a','timed-a')+eventMarkup('date-b','month-b')+'</div>';
state.sideDay.rootEl.innerHTML=eventMarkup('date-a','side-a'); state.__tmPrototypeMorePopover.el.innerHTML=eventMarkup('date-a','overflow-a');
state.queuePrototypeSurfaceRender=()=>{counters.main++;patchPrototypeListSurface(listMarkup())};
async function __tmSetDoneFromUi(id,done,ev,options){counters.writes.push({id,done,source:options.source}); if(failNext){failNext=false; return false;} tasks[id]=done;syncTaskDoneInPlace(id,done,{flushTaskPanel:false});return true;}
const mainClick=${clickBody(mainClickStart)};
const sideClick=(()=>{const cal=state.sideDay.calendar;return ${clickBody(clickStart)}})();
const callCalendarAdapter=(cal,method,id,event,el)=>{const original=handleCalendarEventCheckboxToggle;handleCalendarEventCheckboxToggle=(...args)=>(pending=original(...args));(cal===calendar?mainClick:sideClick)({event:getCalendarEventById(cal,id),jsEvent:event,el});handleCalendarEventCheckboxToggle=original;};
let prototypeSuppressClickUntil=0, prototypeSuppressClickEventId='';
const openPrototypeListTaskDetail=()=>false, isCompactDockLayout=()=>false, showPrototypeEventPopover=()=>{};
${between(source, '            const onPrototypeEventDocumentClick =', "            document.addEventListener('click', onPrototypeEventDocumentClick, true);")}
if(!location.search.includes('surface=1'))document.addEventListener('click',event=>{
    const original=handleCalendarEventCheckboxToggle;
    handleCalendarEventCheckboxToggle=(...args)=>(pending=original(...args));
    try{onPrototypeEventDocumentClick(event);}finally{handleCalendarEventCheckboxToggle=original;}
},true);
// Reproduce the leaked factory listener from the real log: stopPropagation
// does not suppress a second capture listener on the same document.
if(location.search.includes('duplicate=1'))document.addEventListener('click',event=>onPrototypeEventDocumentClick(event),true);
document.querySelector('#month-events').addEventListener('click',event=>{const target=event.target;${mainSurfaceCheck}});
for(const el of [state.sideDay.rootEl,state.__tmPrototypeMorePopover.el])el.addEventListener('click',event=>{if(event.target.type!=='checkbox')return;const card=event.target.closest('[data-tm-proto-event]');callCalendarAdapter(el===state.sideDay.rootEl?state.sideDay.calendar:calendar,'dispatchEventClick',getCalendarEventIdFromElement(card),event,card)});
document.querySelector('#month').onclick=()=>{calendar.view.type='dayGridMonth'};
document.querySelector('#fail').onclick=()=>{failNext=true};
window.baseline={list:document.querySelector('.tm-proto-list'),a:document.querySelector('#list-a'),b:document.querySelector('#list-b'),monthA:document.querySelector('#month-a'),monthB:document.querySelector('#month-b')};
baseline.list.scrollTop=80;
window.report=()=>({tasks:{...tasks},counters:{...counters},checks:Object.fromEntries([...document.querySelectorAll('input')].map(el=>[el.id,el.checked])),sameList:baseline.list===document.querySelector('.tm-proto-list'),sameA:baseline.a===document.querySelector('#list-a'),sameB:baseline.b===document.querySelector('#list-b'),sameMonthA:baseline.monthA===document.querySelector('#month-a'),sameMonthB:baseline.monthB===document.querySelector('#month-b'),scroll:baseline.list.scrollTop});
</script>`;
    fs.writeFileSync(path.join(dir, 'calendar-checkbox.html'), fixture);
    new vm.Script(fixture.split('<script>')[1].split('</script>')[0], { filename: 'calendar-checkbox-fixture.js' });
    console.log('Browser fixture: output/playwright/calendar-checkbox.html');
}
console.log('calendar checkbox local update tests passed');
