'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'calendar-view.css'), 'utf8');
assert.match(source, /class="b3-switch fn__flex-center" type="checkbox" data-tm-schedule-completion-linked/, 'completion linkage uses the standard settings switch');
assert.ok(source.indexOf('tm-calendar-completion-setting') < source.indexOf('data-tm-cal-field="deviceScheduleSummary"'), 'completion linkage setting is before device reservation status');
const slice = (start, end) => {
    const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
    assert.ok(a >= 0 && b > a, start);
    return source.slice(a, b);
};
const fn = (name) => {
    const match = source.match(new RegExp(`    (?:async )?function ${name}\\(`));
    assert.ok(match, name);
    return source.slice(match.index, source.indexOf('\n    }', match.index) + 6);
};
const common = [
    slice('    function normalizeScheduleCompletedOccurrenceKey(', '    function normalizeScheduleSkippedOccurrenceKey('),
    slice('    function isTaskDateRecurringExceptionScheduleItem(', '    async function isLinkedTaskRecurringTask('),
    slice('    async function setScheduleOccurrenceDone(', '    function showScheduleRecurringEditScopeDialog('),
    slice('    function isRecurringScheduleEventExt(', '    async function setCalendarReminderOccurrenceDone('),
    slice('    function shouldHideCompletedAllDayCalendarEvent(', '    function getCalendarCompactEventLeadingLayoutVars('),
    fn('buildEventsFromSchedule'), fn('dedupeMonthScheduleEvents'),
    fn('getScheduleLinkedTaskId'), fn('getScheduleLinkedBlockId'), fn('isVirtualRecurringTaskScheduleItem'),
    fn('saveScheduleAll'), fn('applyTaskDoneVisual'),
    fn('buildSharedPrototypeEventMarkup'), fn('buildCalendarMergedReminderMarkup'),
].join('\n');
const setup = `
const settings = {showSchedule:true,showCompletedAllDaySchedules:true};
const tasks = {task:false};
let persisted = JSON.stringify(['a','b','c'].map((id,index)=>({id,taskId:'task',title:'日程 '+id,start:'2026-09-28T'+String(8+index).padStart(2,'0')+':00:00',end:'2026-09-28T'+String(9+index).padStart(2,'0')+':00:00',repeatRule:{type:'none'}})));
let storedModes = '{}', failNext = false, taskWrites = 0, historyWrites = 0, scheduleWrites = 0, patchedSchedules = [], prototypeRenders = 0;
const state = {settingsStore:{data:{calendarTaskCompletionModes:{}},async save(){storedModes=JSON.stringify(this.data.calendarTaskCompletionModes)}},sideDay:{},scheduleCache:{},queuePrototypeSurfaceRender(){prototypeRenders++}};
const getSettings = ()=>settings;
const getScheduleRepeatRule = item=>item.repeatRule||{type:item.repeatType||'none'};
const getScheduleRepeatType = item=>getScheduleRepeatRule(item).type;
const normalizeScheduleRepeatType = value=>value||'none';
const normalizeScheduleSkippedOccurrenceKey = value=>String(value||'');
const loadScheduleAll = async()=>JSON.parse(persisted);
const cloneScheduleList = items=>JSON.parse(JSON.stringify(items));
const performScheduleSaveAll = async items=>{await Promise.resolve();if(failNext){failNext=false;throw Error('disk failed')}persisted=JSON.stringify(items);scheduleWrites++};
const isLinkedTaskRecurringTask = async()=>true;
const syncTaskDateRecurringExceptionHistory = async()=>{historyWrites++;return '2026-09-28'};
const refetchAllCalendars = ()=>{};
const __tmPatchVisibleSingleScheduleInPlace = item=>{patchedSchedules.push(String(item?.id||''));return {touchedMain:true}};
const __tmSchedulePostMutationRefresh = ()=>{};
const scheduleCalendarRefresh = ()=>{};
const collectCalendarsForTaskSync = ()=>[];
const queueTaskDateCalendarRender = ()=>{};
const toMs = value=>new Date(value).getTime();
const safeISO = value=>new Date(value).toISOString();
const isAllDayRange = ()=>false;
const getCalendarDefs = ()=>[{id:'default',color:'#527acc'}];
const shouldPreferDeviceNotificationBackend = ()=>false;
const getCalendarTaskSnapshotById = id=>({id,done:tasks[id]===true});
const isCalendarTaskRecurringSnapshot = ()=>false;
const normalizeCalendarScheduleTitleText = (title,fallback)=>title||fallback;
const isCalendarEnabled = ()=>true;
const getCalendarConfigEntry = ()=>({});
const getScheduleLinkedDocId = ()=>'';
const isCalendarDocVisibleForEvent = ()=>true;
const getScheduleInheritedColorContext = ()=>({});
const isScheduleColorExplicitValue = ()=>false;
const getScheduleRepeatEvery = ()=>1, getScheduleRepeatUntil = ()=>'', getScheduleRepeatMonthlyMode = ()=>'', getScheduleRepeatCalendarMode = ()=>'';
const isScheduleAllDayBottom = ()=>false;
const buildScheduleNotificationSchedulesView = ()=>({});
const joinCalendarClassName = names=>names.join(' ');
const collectScheduleOccurrencesInRange = item=>(item.occurrences||[item.start]).map(start=>({start:new Date(start),end:new Date(new Date(start).getTime()+3600000),startMs:new Date(start).getTime()}));
const esc = value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const getCalendarEventColor = ()=>'#527acc';
const pad2 = value=>String(value).padStart(2,'0');
const buildCalendarRecurringTaskIconMarkup = ()=>'';
window.tmIsTaskDone = id=>tasks[id]===true;
window.tmSetDone = async(id,done)=>{tasks[id]=done;taskWrites++;return true};
`;
const context = vm.createContext({console,Date,Map,Set,Promise,HTMLInputElement:class {},HTMLElement:class {},window:{}});
vm.runInContext(setup + common + `
globalThis.__tmCalendar={setScheduleOccurrenceDone};
globalThis.api={state,tasks,settings,loadScheduleAll,getSettings,buildEventsFromSchedule,
 get counters(){return {taskWrites,historyWrites,scheduleWrites,patchedSchedules:patchedSchedules.slice(),prototypeRenders}},
 fail(){failNext=true},seed(items){persisted=JSON.stringify(items)},
 restart(){state.settingsStore.data.calendarTaskCompletionModes=JSON.parse(storedModes)},
 events(){return buildEventsFromSchedule(JSON.parse(persisted),new Date('2026-09-01'),new Date('2026-10-31'),settings)},
 resetModes(){state.settingsStore.data.calendarTaskCompletionModes={}},
};`, context);
const {api} = context;
const eventExt = id => api.events().find(e=>e.id===id).extendedProps;
const equal = (actual, expected) => assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected);
const stamp = Date.parse('2026-09-28T08:00:00');

(async()=>{
    assert.equal(api.events().length,3);
    assert.equal(context.isScheduleCompletionIndependent({id:'unlinked'}),false);
    assert.equal(context.shouldShowCalendarEventCheckbox({...eventExt('a'),__tmBlockId:'task'},{viewType:'timeGridDay'}),true);
    assert.equal(context.shouldShowCalendarEventCheckbox({...eventExt('a'),__tmScheduleCompletionIndependent:false,__tmBlockId:'other'},{viewType:'timeGridDay'}),true);
    for(const ext of api.events().map(e=>e.extendedProps)) {
        assert.equal(ext.__tmScheduleCompletionIndependent,false,'new linked schedules default to task completion');
        assert.equal(context.resolveCalendarEventDoneState(ext),false);
    }
    api.tasks.task=true;
    equal(api.events().map(e=>context.resolveCalendarEventDoneState(e.extendedProps)),[true,true,true]);
    api.tasks.task=false;
    // An explicit task override switches all of its schedules to independent
    // completion without changing the default for other tasks.
    await context.setCalendarTaskCompletionMode('task',false);
    api.restart();
    for(const ext of api.events().map(e=>e.extendedProps)) assert.equal(ext.__tmScheduleCompletionIndependent,true);
    equal(api.counters.patchedSchedules.slice(0,3),['a','b','c']);
    assert.ok(api.counters.patchedSchedules.length >= 3,'visible schedules are patched immediately when separation is enabled');
    assert.ok(api.counters.prototypeRenders > 0,'prototype surface is queued for an immediate style refresh');
    assert.match(styles,/\.tm-proto-event--completion-independent input\.tm-proto-event-check\[type="checkbox"\]:not\(\.b3-switch\),[\s\S]*\.tm-proto-span-bar\.tm-proto-event--completion-independent input\.tm-proto-event-check\[type="checkbox"\]:not\(\.b3-switch\),[\s\S]*\.tm-cal-task-event--completion-independent input\.tm-cal-task-event-check\[type="checkbox"\]:not\(\.b3-switch\)\{\s*border: 2px dashed /,'separation restores the original dashed checkbox rule');
    assert.doesNotMatch(styles,/repeating-conic-gradient|tm-proto-event-check-wrap::after/,'separation does not use a custom checkbox ring');
    assert.match(styles,/\.tm-calendar-completion-toggle > span\{ font-weight: 650; \}/,'completion linkage label is emphasized');
    assert.doesNotMatch(styles,/\.tm-proto-event--completion-independent[^}]*box-shadow:\s*none|\.tm-proto-event--completion-independent::after/,'separated events keep the standard associated schedule styling');
    // Concurrent clicks on separate records must all survive a fresh read.
    await Promise.all(['a','b','c'].map(id=>context.setScheduleOccurrenceDone(id,stamp,true)));
    equal((await api.loadScheduleAll()).map(x=>x.scheduleDone),[true,true,true]);
    await context.setScheduleOccurrenceDone('b',stamp,false);
    api.restart();
    equal(api.events().map(e=>context.resolveCalendarEventDoneState(e.extendedProps)),[true,false,true]);
    for(const done of [true,false]) {
        api.tasks.task=done;
        equal(api.events().map(e=>context.resolveCalendarEventDoneState(e.extendedProps,{taskDoneOverride:done})),[true,false,true]);
    }
    assert.equal(api.counters.taskWrites,0);
    assert.equal(api.counters.historyWrites,0);
    assert.equal(context.isScheduleOccurrenceDone((await api.loadScheduleAll())[0],stamp),true);

    // One task-scoped option applies to every current and future schedule.
    await context.setCalendarTaskCompletionMode('task',true);
    api.restart();
    assert.equal(context.isScheduleCompletionIndependent({taskId:'task'}),false);
    equal(api.events().map(e=>context.resolveCalendarEventDoneState(e.extendedProps)),[false,false,false]);
    api.tasks.task=true;
    assert.ok(api.events().every(e=>context.resolveCalendarEventDoneState(e.extendedProps)));
    await context.setCalendarTaskCompletionMode('task',false);
    equal(api.events().map(e=>context.resolveCalendarEventDoneState(e.extendedProps)),[true,false,true]);
    const independent = eventExt('b');
    assert.equal(context.shouldHideCompletedAllDayCalendarEvent({allDay:true,extendedProps:independent},{showCompletedAllDaySchedules:false}),false);
    // Real checkbox ingress must never call tmSetDone in independent mode.
    const check = new context.HTMLInputElement(); check.checked=true;
    await context.handleCalendarEventCheckboxToggle(check,null,null,independent,'task');
    assert.equal(api.counters.taskWrites,0);
    assert.equal(context.resolveCalendarEventDoneState(independent),true);
    check.checked=false;api.fail();
    await assert.rejects(context.handleCalendarEventCheckboxToggle(check,null,null,independent,'task'),/disk failed/);
    assert.equal(check.checked,true,'failed save rolls checkbox back');
    assert.equal(context.resolveCalendarEventDoneState(eventExt('b')),true);
    await context.setScheduleOccurrenceDone('b',stamp,false);
    assert.equal(context.resolveCalendarEventDoneState(eventExt('b')),false,'queue recovers after rejection');

    const base = (await api.loadScheduleAll())[0];
    api.seed([{...base,id:'repeat',repeatRule:{type:'daily'},scheduleDone:undefined,occurrences:[base.start,'2026-09-29T08:00:00']},
        {...base,id:'detached',scheduleDone:true,completed:true,detachedScheduleOccurrence:true},
        {...base,id:'plain',taskId:'',scheduleDone:undefined},
        {...base,id:'unlinked-repeat',taskId:'',repeatRule:{type:'daily'},completedOccurrences:[String(stamp)]}]);
    await Promise.all([context.setScheduleOccurrenceDone('repeat',stamp,true),context.setScheduleOccurrenceDone('repeat',stamp+86400000,true)]);
    await context.setScheduleOccurrenceDone('repeat',stamp,false);
    const repeating=api.events().filter(e=>e.extendedProps.__tmScheduleId==='repeat');
    equal(repeating.map(e=>context.resolveCalendarEventDoneState(e.extendedProps)),[false,true]);
    await context.setScheduleOccurrenceDone('detached',stamp,false);
    assert.equal(context.resolveCalendarEventDoneState(eventExt('detached')),false,'explicit uncheck beats detached aliases');
    assert.equal(api.counters.historyWrites,0,'detached schedule must not write task recurrence history');
    assert.equal(context.shouldShowCalendarEventCheckbox(eventExt('plain'),{viewType:'timeGridDay'}),false);
    const unlinked=api.events().find(e=>e.extendedProps.__tmScheduleId==='unlinked-repeat');
    assert.equal(context.resolveCalendarEventDoneState(unlinked.extendedProps),true,'unlinked recurring completion stays intact');
    assert.equal(context.isScheduleCompletionIndependent({...base,taskDateRecurringException:true}),false);
    assert.equal(context.isScheduleCompletionIndependent({...base,virtualTask:true}),false);
    await context.setCalendarTaskCompletionMode('task',true);
    check.checked=false;
    await context.handleCalendarEventCheckboxToggle(check,null,null,repeating[0].extendedProps={...repeating[0].extendedProps,__tmScheduleCompletionIndependent:false},'task');
    assert.equal(api.counters.taskWrites,1,'explicit linked mode writes the task even for a recurring schedule');
    await context.setCalendarTaskCompletionMode('task',false);
    const oldMode=api.state.settingsStore.data.calendarTaskCompletionModes;
    const save=api.state.settingsStore.save;
    api.state.settingsStore.save=async()=>{throw Error('settings failed')};
    await assert.rejects(context.setCalendarTaskCompletionMode('task',true),/settings failed/);
    assert.equal(api.state.settingsStore.data.calendarTaskCompletionModes,oldMode);
    api.state.settingsStore.save=save;

    for(const mode of ['chip','block','allday','list']) {
        const markup=context.buildSharedPrototypeEventMarkup(api.events()[0],mode,false,'',api.settings,{viewType:'timeGridDay'});
        assert.match(markup,/tm-proto-event--completion-independent/);
        assert.match(markup,/aria-label="完成日程"/);
        assert.doesNotMatch(markup,/独立完成|分离日程/);
    }
    const plainMarkup=context.buildSharedPrototypeEventMarkup(api.events().find(e=>e.extendedProps.__tmScheduleId==='plain'),'chip',false,'',api.settings,{viewType:'timeGridDay'});
    assert.doesNotMatch(plainMarkup,/tm-proto-event--completion-independent/,'unlinked schedules do not receive the separated marker');
    assert.equal(context.dedupeMonthScheduleEvents(api.events()).length,api.events().length);
    console.log('calendar schedule completion tests passed');
})().catch(error=>{console.error(error);process.exitCode=1});

if(process.argv.includes('--browser-fixture')) {
    const dir=path.join(root,'output','playwright');fs.mkdirSync(dir,{recursive:true});
    const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>日程独立完成验证</title>
<link rel="stylesheet" href="../../calendar-view.css"><style>
body{font:14px system-ui;margin:28px;background:var(--tm-cal-panel);color:var(--tm-text-color);--tm-cal-panel:#fff;--tm-cal-border:#dce0e7;--tm-primary-color:#527acc;--tm-text-color:#273242;--b3-theme-background:var(--tm-cal-panel)}
body.dark{--tm-cal-panel:#24272e;--tm-cal-border:#535965;--tm-text-color:#edf0f5}
main{max-width:800px;margin:auto}.cards{display:grid;gap:12px;grid-template-columns:repeat(3,minmax(0,1fr));padding:16px 0}.cards>div{min-width:0;position:relative}.tm-proto-event--block{height:85px}.tm-proto-event--list{min-height:36px}button{margin:6px;padding:7px 12px}#status{white-space:pre-wrap;font-size:12px}.tm-calendar-completion-setting{margin:16px 0}@media(max-width:500px){body{margin:16px}.cards{grid-template-columns:1fr}}
</style><main><label><input id="task" type="checkbox">关联任务</label><button id="theme">切换主题</button><button id="fail">下次保存失败</button><div data-tm-schedule-completion></div><div id="cards"></div><div id="status" role="status"></div></main><script>
${setup}${common}
persisted=localStorage.getItem('completion-fixture-schedules')||persisted;
storedModes=localStorage.getItem('completion-fixture-modes')||'{}';state.settingsStore.data.calendarTaskCompletionModes=JSON.parse(storedModes);
state.settingsStore.save=async function(){storedModes=JSON.stringify(this.data.calendarTaskCompletionModes);localStorage.setItem('completion-fixture-modes',storedModes)};
globalThis.__tmCalendar={setScheduleOccurrenceDone};
const control=bindScheduleCompletionControl(document,()=> 'task');
document.querySelector('[data-tm-schedule-completion-linked]').addEventListener('change',async()=>{await control.save();render()});
const events=()=>buildEventsFromSchedule(JSON.parse(persisted),new Date('2026-09-01'),new Date('2026-10-31'),settings);
function render(){const all=events();document.querySelector('#cards').innerHTML=['chip','block','allday','list'].map(mode=>'<div class="cards">'+all.map(event=>buildSharedPrototypeEventMarkup(event,mode,false,'',settings,{viewType:'timeGridDay'})).join('')+'</div>').join('');
const plain={...all[0],id:'plain',title:'普通日程',extendedProps:{__tmSource:'schedule',__tmScheduleId:'plain',__tmRepeatType:'none'}};
document.querySelector('#cards').innerHTML+='<div class="cards">'+buildSharedPrototypeEventMarkup(plain,'chip',false,'',settings,{viewType:'timeGridDay'})+'</div>';
document.querySelector('#status').textContent=JSON.stringify({task:tasks.task,checks:all.map(e=>resolveCalendarEventDoneState(e.extendedProps)),taskWrites,scheduleWrites});}
document.querySelector('#cards').addEventListener('change',async event=>{if(!event.target.matches('[data-tm-proto-check]'))return;const e=events().find(e=>e.id===event.target.dataset.tmProtoCheck);try{await handleCalendarEventCheckboxToggle(event.target,event.target.closest('.tm-proto-event'),null,e.extendedProps,'task');localStorage.setItem('completion-fixture-schedules',persisted);render()}catch(error){document.querySelector('#status').textContent=error.message}});
document.querySelector('#task').onchange=event=>{tasks.task=event.target.checked;render()};
document.querySelector('#theme').onclick=()=>document.body.classList.toggle('dark');document.querySelector('#fail').onclick=()=>{failNext=true};render();
</script></html>`;
    new vm.Script(html.split('<script>')[1].split('</script>')[0]);
    fs.writeFileSync(path.join(dir,'calendar-schedule-completion.html'),html);
}
