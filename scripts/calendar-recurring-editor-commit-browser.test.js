'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8').replace(/\r\n/g, '\n');
const model = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/50-task-model-and-repeat-utils.js'), 'utf8');
const editorOffset = source.indexOf('const showPrototypeScheduleEditorCard =');
function between(start, end, offset = editorOffset) {
    const from = source.indexOf(start, offset);
    const to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, start);
    return source.slice(from, to);
}
const repeatModel = model.slice(model.indexOf('function __tmParseTaskRepeatJson'), model.indexOf('function __tmGetTaskRepeatWeekdayLabel'));
const repeatAdapter = between('    function getScheduleRepeatCore()', '    function refreshScheduleAfterMutationResult(', 0);
const timeHub = between('            const readTimeHubValues =', '            const positionTimeHub =');
const closing = between('            const close = () =>', "            const pop = document.createElement('div')");
const saveBinding = between("                pop.querySelector('[data-tm-proto-edit-action=\"save\"]')?.addEventListener('click'", '\n            };\n            const close =');
const outsideClick = between('            const onDocumentClick =', '            // Some embedded/webview surfaces suppress the follow-up click');
const outsidePointer = between('            const onDocumentPointerDown =', '            // Repositioning is driven by visualViewport changes');

async function setup(page, mode = 'recurring') {
    await page.setContent(`<style>
        #editor{position:fixed;left:40px;top:40px;width:300px;padding:20px;background:#eee}
        #outside{position:fixed;right:20px;top:40px}
        .tm-proto-inline-time-hub{position:fixed;left:380px;top:40px}
        .tm-calendar-edit-modal{position:fixed;inset:0;display:grid;place-items:center;background:#ddd8}
        .tm-calendar-edit-box{padding:20px;background:#eee}
    </style><button id="anchor">组会</button><button id="outside">卡片外</button>
    <div id="editor"><button id="start-picker">开始时间</button><button id="end-picker">结束时间</button>
        <input data-tm-proto-edit-field="title" value="组会">
        <input type="hidden" data-tm-proto-edit-field="start" value="2026-07-16T18:00">
        <input type="hidden" data-tm-proto-edit-field="end" value="2026-07-16T19:00">
        <input type="hidden" data-tm-proto-edit-field="repeat" value="${mode === 'recurring' ? 'weekly' : 'none'}">
        <input type="hidden" data-tm-proto-edit-field="repeatEvery" value="1">
        <input type="hidden" data-tm-proto-edit-field="repeatEndMode" value="never">
        <input type="hidden" data-tm-proto-edit-field="calendar" value="default">
        <input type="checkbox" data-tm-proto-repeat-weekday value="4" checked hidden>
        <button data-tm-proto-edit-action="save">保存</button><button id="close-card">关闭</button><button id="cancel-card">取消</button>
    </div>`);
    await page.addScriptTag({ content: `(() => {
        const pad2 = n => String(n).padStart(2, '0');
        const formatDateKey = value => { const d = new Date(value); return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()); };
        const __tmNormalizeDateOnly = value => value instanceof Date ? formatDateKey(value) : String(value || '').match(/^\\d{4}-\\d{2}-\\d{2}/)?.[0] || '';
        ${repeatModel}
        const toMs = value => value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(String(value || ''));
        const safeISO = value => value.toISOString();
        const isAllDayRange = () => false;
        const overlap = (start,end,from,to) => end > from && start < to;
        let sequence = 0;
        const uuid = () => 'series-'+(++sequence);
        const normalizeCalendarScheduleTitleText = (value,fallback) => String(value || '').trim() || fallback;
        const getScheduleLinkedBlockId = () => '';
        const esc = value => String(value || '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
        const getOverlayZIndex = () => 200000;
        const findActionTarget = (target,attr) => target instanceof Element ? target.closest('['+attr+']') : null;
        ${repeatAdapter}
        const isNew = ${mode === 'new'}, isTaskDateEditor = false, isMobileFullscreen = false;
        const isRecurringScheduleEditor = ${mode === 'recurring'};
        const pop = document.querySelector('#editor'), anchorEl = document.querySelector('#anchor'), surfaceEl = null;
        const scheduleId = 'meeting', popoverEventId = 'meeting:current';
        const eventApi = {start:new Date('2026-07-16T18:00'),end:new Date('2026-07-16T19:00'),allDay:false};
        const ext = {__tmRepeatType:${JSON.stringify(mode === 'recurring' ? 'weekly' : 'none')},__tmRepeatEvery:1,__tmOccurrenceStartMs:eventApi.start.getTime()};
        const state = {calendarMutationVersion:0,sideDay:{},settingsStore:{data:{},save:async()=>{}}};
        const readValue = field => String(pop.querySelector('[data-tm-proto-edit-field="'+field+'"]')?.value || '');
        const getSettings = () => ({}), getCalendarView = () => ({type:'timeGridWeek'}), protoSafeDate = value => new Date(value);
        const normalizeColorInputHex = value => value;
        const protoEventColor = () => '#789';
        const initialColorInputValue = '#789', initialCustomScheduleColor = '', initialCalendarId = 'default';
        const colorTouched = false, colorClearedByCalendarChange = false;
        const linkedTaskId = '', linkedBlockId = '', linkedDocId = '', relationExplicitlyUnlinked = false, initialRemark = '';
        const inlineMonthDays = undefined, inlineMonthWeek = undefined;
        const completionControl = {save:async()=>{}};
        const syncTaskDatesAfterScheduleMutation = async()=>{};
        const refreshScheduleAfterMutationResult = ()=>{};
        const taskForId = ()=>null;
        const toast = message => window.messages.push(message);
        window.messages = []; window.writes = 0; window.failSave = false;
        window.stored = [{id:scheduleId,title:'组会',start:'2026-07-09T18:00',end:'2026-07-09T19:00',repeatRule:{enabled:${mode === 'recurring'},type:${JSON.stringify(mode === 'recurring' ? 'weekly' : 'none')},trigger:'due',every:1,weekdays:[4],anchorDate:'2026-07-09'}}];
        loadScheduleAll = async()=>JSON.parse(JSON.stringify(window.stored));
        saveScheduleAll = async list => { if(window.failSave) throw Error('test save failure'); window.writes++; window.stored=JSON.parse(JSON.stringify(list)); };
        let timeHub = null, timeHubInitialValues = null, timeHubAutoSavePending = false, timeHubAutoSaveRequest = false;
        let recurringScheduleInitialTimes = null, recurringScheduleSavePending = false, hubDateDrag = null, suppressNextHubDateClick = false;
        ${timeHub}
        const closePrototypeEventPopover = () => { pop.remove(); document.removeEventListener('click',onDocumentClick,true); document.removeEventListener('pointerdown',onDocumentPointerDown,true); };
        ${closing}
        ${saveBinding}
        const getCalendarEventIdFromElement = () => '', isReTargetedInsideTap = () => false;
        ${outsideClick}
        ${outsidePointer}
        document.addEventListener('click',onDocumentClick,true);
        document.addEventListener('pointerdown',onDocumentPointerDown,true);
        recurringScheduleInitialTimes = readTimeHubValues();
        const openPicker = field => {
            timeHubInitialValues=readTimeHubValues(); timeHub=document.createElement('div'); timeHub.className='tm-proto-inline-time-hub';
            const choose=document.createElement('button'); choose.textContent=field==='start'?'16:00':'18:00'; choose.id='choose-time';
            choose.onclick=()=>{ pop.querySelector('[data-tm-proto-edit-field="'+field+'"]').value='2026-07-16T'+choose.textContent; closeTimeHub(); };
            timeHub.append(choose); document.body.append(timeHub);
        };
        document.querySelector('#start-picker').onclick=()=>openPicker('start');
        document.querySelector('#end-picker').onclick=()=>openPicker('end');
        document.querySelector('#close-card').onclick=dismiss;
        document.querySelector('#cancel-card').onclick=close;
    })();` });
}
async function editTimes(page) {
    await page.click('#start-picker'); await page.click('#choose-time');
    assert.equal(await page.locator('#tm-calendar-recurring-scope-dialog').count(), 0, 'choosing a start time must not commit recurring edits');
    await page.click('#end-picker'); await page.click('#choose-time');
    assert.equal(await page.locator('#tm-calendar-recurring-scope-dialog').count(), 0, 'choosing an end time must not commit recurring edits');
    assert.equal(await page.evaluate(()=>window.writes), 0);
}
async function chooseScope(page, scope) {
    await page.waitForSelector('#tm-calendar-recurring-scope-dialog');
    await page.click('[data-tm-recurring-scope="'+scope+'"]');
}
async function run() {
    const browser = await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE}:{})});
    const page = await browser.newPage({timezoneId:'Asia/Shanghai'});
    page.setDefaultTimeout(5000);
    const errors=[]; page.on('pageerror',error=>{errors.push(error.message);console.error(error.message);});
    try {
        for (const trigger of ['[data-tm-proto-edit-action="save"]','#outside','#close-card']) {
            await setup(page); await editTimes(page); await page.click(trigger);
            await chooseScope(page,'future'); await page.waitForFunction(()=>window.writes===1);
            assert.equal(await page.locator('#editor').count(),0);
            const saved = await page.evaluate(()=>window.stored.at(-1));
            assert.equal(new Date(saved.start).toISOString(),'2026-07-16T08:00:00.000Z');
            assert.equal(new Date(saved.end).toISOString(),'2026-07-16T10:00:00.000Z');
        }
        await setup(page); await page.click('#outside');
        assert.equal(await page.locator('#editor').count(),0);
        assert.equal(await page.evaluate(()=>window.writes),0);
        await setup(page); await editTimes(page); await page.click('#outside'); await chooseScope(page,'cancel');
        assert.equal(await page.locator('#editor').count(),1);
        assert.equal(await page.evaluate(()=>window.writes),0);
        await page.click('[data-tm-proto-edit-action="save"]'); await chooseScope(page,'one');
        await page.waitForFunction(()=>window.writes===1);
        await setup(page); await editTimes(page); await page.click('#cancel-card');
        assert.equal(await page.evaluate(()=>window.writes),0);
        assert.equal(await page.locator('#editor').count(),0);
        await setup(page); await editTimes(page); await page.evaluate(()=>window.failSave=true);
        await page.click('#outside'); await chooseScope(page,'future');
        await page.waitForFunction(()=>window.messages.some(message=>message.includes('test save failure')));
        assert.equal(await page.locator('#editor').count(),1);
        await page.evaluate(()=>window.failSave=false);
        await page.click('[data-tm-proto-edit-action="save"]'); await chooseScope(page,'future');
        await page.waitForFunction(()=>window.writes===1);
        await setup(page); await page.click('#start-picker');
        await page.evaluate(()=>document.querySelector('[data-tm-proto-edit-field="start"]').value='2026-07-16T16:00');
        await page.click('#outside'); await chooseScope(page,'future');
        await page.waitForFunction(()=>window.writes===1);
        await setup(page,'single'); await page.click('#start-picker'); await page.click('#choose-time');
        await page.waitForFunction(()=>window.writes===1);
        assert.equal(await page.locator('#editor').count(),1, 'non-recurring hub autosave keeps the card open');
        assert.equal(await page.locator('#tm-calendar-recurring-scope-dialog').count(),0);
        await setup(page,'new'); await page.click('#start-picker'); await page.click('#choose-time');
        await page.click('#outside'); assert.equal(await page.evaluate(()=>window.writes),0);
        assert.deepEqual(errors,[]);
        console.log('recurring editor commit browser tests passed (manual save, outside dismissal, close, cancel, retry, single schedule and new draft)');
    } catch (error) {
        console.error(await page.evaluate(()=>({messages:window.messages,writes:window.writes,editor:!!document.querySelector('#editor')})));
        throw error;
    } finally { await browser.close(); }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
