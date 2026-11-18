'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('./i18n-browser-fixture');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const dock = read('../siyuan-plugin-docktomato/tomato.js');
const section = (from, to) => dock.slice(dock.indexOf(from), dock.indexOf(to, dock.indexOf(from)));

(async () => {
    const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.stack || String(error)));
        await page.route('https://calendar.test/**', route => route.fulfill({ contentType: 'text/html', body: '<style>body{margin:0;--b3-theme-primary:#3576aa;--b3-theme-background:#f8f9fa;--b3-theme-on-background:#243443;--b3-theme-on-surface:#5a6b78;--b3-theme-surface-light:#dbe2e8;--b3-theme-primary-lightest:#e2edf7}</style><div id="root" data-tm-ui-mode="desktop" data-tm-host-mode="tab" style="width:100%;height:900px"></div>' }));
        await page.goto('https://calendar.test');
        await page.addStyleTag({ content: read('task-horizon.css') });
        await page.addStyleTag({ content: read('calendar-view.css') });
        await page.addStyleTag({ content: 'body{font:13px system-ui;--tm-primary-color:var(--b3-theme-primary);--tm-bg-color:var(--b3-theme-background);--tm-text-color:var(--b3-theme-on-background);--tm-card-bg:var(--b3-theme-background);--tm-border-color:var(--b3-theme-surface-light);--tm-secondary-text:var(--b3-theme-on-surface)}' });
        await page.evaluate(() => {
            window.siyuan = { config: { system: { container: 'browser' }, appearance: { mode: 0 } }, languages: {} };
            window.fetch = async () => ({ ok: true, status: 200, json: async () => ({ code: 0, data: [] }), text: async () => '' });
            window.__tmSuppressStorageWrites = true;
            window.__tmCalendarAllTasksCache = { complete: true, tasks: [{ id: 'task-a', title: '设计日历交互', root_id: 'doc-a' }] };
        });
        await page.addScriptTag({ content: `(() => {
            let records = [], queue = Promise.resolve();
            const cloneSyncState = value => JSON.parse(JSON.stringify(value));
            const createTomatoUuid = prefix => prefix + crypto.randomUUID();
            const assertHistoryRecordCount = () => {}, hashHistoryText = value => value;
            const toDateSafe = value => new Date(value), normalizeLegacyDate = value => value;
            const formatDateKey = value => new Date(value).toISOString().slice(0,10), getTimePeriod = () => 'afternoon';
            const SyncManager = {getState: () => ({})};
            const mutateHistoryRecords = mutator => {
                const operation = queue.then(async () => { const draft = cloneSyncState(records); const result = await mutator(draft); if(result !== false) records = draft; return result; });
                queue = operation.catch(() => {}); return operation;
            };
            const __tomatoHistoryRefreshUI = async () => {};
            ${section('    function normalizeHistoryRecords(', '    function getHistoryRecordDurationMs(')}
            ${section('    function __tomatoFindHistoryRecordIndex(', '    async function __tomatoHistoryLoadAll(')}
            ${section('    function __tomatoHistoryAvailableParts(', '    async function __tomatoHistoryRefreshUI(')}
            window.__recordHarness = { read: () => cloneSyncState(records.filter(record => record.disposition !== 'discarded')), set: value => records = normalizeHistoryRecords(value) };
            window.__dockTomato = {history:{
                supportsScheduleOverwrite: true,
                create: __tomatoHistoryCreate, update: __tomatoHistoryUpdate, undo: __tomatoHistoryUndo,
                loadRange: async () => cloneSyncState(records.filter(record => record.disposition !== 'discarded')), updateTime: async (...args) => (await __tomatoHistoryUpdate(...args)).ok,
                delete: async () => true,
            }};
        })();` });
        const model = read('src/task-horizon/main/task-runtime/50-task-model-and-repeat-utils.js');
        await page.addScriptTag({ content: model.slice(model.indexOf('function __tmParseTaskRepeatJson'), model.indexOf('function __tmGetTaskRepeatWeekdayLabel')) });
        for (const name of ['date', 'store', 'layout', 'renderer', 'interaction', 'engine']) await page.addScriptTag({ content: read(`src/calendar/calendar-${name}.js`) });
        await page.addScriptTag({ content: read('calendar-view.js').replace('    globalThis.__tmCalendar = {', '    window.__focusTest = { state, getSettings, buildEventsFromRecords, buildSharedPrototypeDayPanelMarkup, openRecordModal };\n    globalThis.__tmCalendar = {') });
        await page.evaluate(() => {
            __tmCalendar.navigateToDate('2026-11-16');
            __tmCalendar.mount(document.querySelector('#root'), { settingsStore: { loaded: true, data: { calendarDefaultViewDesktop: 'timeGridDay', calendarLinkDockTomato: true }, save: async () => {} } });
        });
        await page.locator('.tm-proto-time-col').first().waitFor();
        await page.evaluate(() => {
            const state = __focusTest.state;
            const start = '2026-11-16T10:00:00', end = '2026-11-16T10:25:00';
            __recordHarness.set([{ recordId: 'focus-1', sessionId: 'focus-1', start, end, durationMin: 25, mode: 'countdown', taskBlockId: 'task-a', taskBlockName: '设计日历交互', timestamp: Date.parse(end) }]);
            state.calendar.addEvent({ id: 'schedule-a', title: '设计日历交互', start: new Date('2026-11-16T09:50:00'), end: new Date('2026-11-16T10:50:00'), extendedProps: { __tmSource: 'schedule', __tmScheduleId: 'schedule-a', __tmTaskId: 'task-a', calendarId: 'default' } });
            for (const event of __focusTest.buildEventsFromRecords(__recordHarness.read(), __focusTest.getSettings(), 'timeGridDay')) state.calendar.addEvent(event);
            state.queuePrototypeSurfaceRender();
        });
        const card = page.locator('.tm-proto-time-col [data-tm-proto-event="schedule-a"]').first();
        await card.waitFor();
        assert.equal(await page.locator('[data-tm-cal-tomato-style="rail"]').getAttribute('aria-pressed'), 'true', 'rail is the default without an explicit saved choice');
        await page.locator('[data-tm-cal-tomato-style="card"]').click();
        await page.locator('.tm-proto-time-col--tomato-rail').waitFor({state:'detached'});
        const before = await card.boundingBox();
        await page.locator('[data-tm-cal-tomato-style="rail"]').click();
        await page.locator('.tm-proto-tomato-rail').first().waitFor();
        const after = await card.boundingBox();
        assert.ok(after.width > before.width * 1.5, 'timer no longer consumes an overlap lane');
        assert.equal(await page.locator('.tm-calendar-nav-section--collapsed [data-tm-cal-tomato-style]').count(), 0, 'style click does not collapse filters');
        const rail = page.locator('.tm-proto-tomato-rail').first();
        const railGeometry = await rail.evaluate(el => { const r = el.getBoundingClientRect(), c = el.parentElement.getBoundingClientRect(), plan = el.parentElement.querySelector('[data-tm-proto-event="schedule-a"]').getBoundingClientRect(); return { width:r.width, edge:c.right-r.right, gap:r.left-plan.right }; });
        assert.equal(railGeometry.width, 6); assert.ok(railGeometry.edge >= 1 && railGeometry.edge <= 2, JSON.stringify(railGeometry)); assert.ok(Math.abs(railGeometry.gap - 4) < 1, JSON.stringify(railGeometry));
        const side = await page.evaluate(() => {
            const state = __focusTest.state;
            const settings = __focusTest.getSettings();
            const host = document.createElement('div');
            host.innerHTML = __focusTest.buildSharedPrototypeDayPanelMarkup({ date: new Date('2026-11-16T00:00:00'), events: state.calendar.getEvents(), settings });
            return { rails: host.querySelectorAll('.tm-proto-tomato-rail').length, lanes: host.querySelector('[data-tm-proto-event="schedule-a"]')?.getAttribute('data-tm-proto-lane-count') };
        });
        assert.equal(side.rails, 1, 'side day panel uses the same rail branch');
        assert.equal(side.lanes, '1', 'side schedule no longer shares a lane with timer records');
        await rail.hover();
        await page.locator('.tm-proto-event-popover-title').waitFor();
        const popoverBox = await page.locator('.tm-proto-event-popover').boundingBox(), railBox = await rail.boundingBox();
        assert.ok(popoverBox.x >= railBox.x + railBox.width + 7, 'main timeline popover uses available space to the right of the rail');
        assert.match(await page.locator('.tm-proto-event-popover-title').innerText(), /25m/);
        assert.equal(await page.locator('.tm-proto-tomato-related').count(), 1, 'same-day linked schedule highlights');
        await rail.click();
        await page.mouse.move(20, 20);
        assert.equal(await page.locator('.tm-proto-event-popover').count(), 1, 'click pins hover detail');
        await page.locator('.tm-proto-event-popover-close').click();
        await card.click();
        const convert = page.locator('[data-tm-proto-convert-focus]');
        await convert.waitFor();
        assert.equal(await convert.locator('..').locator('[data-tm-proto-inline-duration]').count(), 1, 'conversion is in the duration row');
        fs.mkdirSync(path.join(root, 'output/playwright'), { recursive:true });
        await page.locator('.tm-proto-event-popover').evaluate(el => el.getAnimations({subtree:true}).forEach(animation => animation.finish()));
        const alignment = await convert.locator('..').evaluate(row => {
            const label = row.querySelector('[data-tm-proto-inline-duration]').getBoundingClientRect();
            const button = row.querySelector('button').getBoundingClientRect();
            return Math.abs(label.y + label.height / 2 - button.y - button.height / 2);
        });
        assert.ok(alignment < 1, `conversion button and duration share a vertical center: ${alignment}`);
        await page.screenshot({ path: path.join(root, 'output/playwright/focus-record-schedule-light.png') });
        const endField = page.locator('[data-tm-proto-edit-field="end"]');
        await endField.evaluate(el => { el.value = '2026-11-16T10:40'; el.dispatchEvent(new Event('input', { bubbles:true })); });
        await convert.click();
        await page.screenshot({ path: path.join(root, 'output/playwright/focus-record-conversion-light.png') });
        assert.equal(await page.locator('[data-tm-cal-field="end"]').inputValue(), '2026-11-16T10:40');
        await page.locator('[data-tm-cal-action="cancel"]').click();
        assert.equal(await endField.inputValue(), '2026-11-16T10:40', 'cancel retains schedule draft');
        await page.evaluate(() => { __dockTomato.history.supportsScheduleOverwrite = false; });
        await convert.click();
        assert.equal(await page.locator('.tm-calendar-edit-modal').count(), 0, 'old create API cannot silently skip overlaps');
        await page.evaluate(() => { __dockTomato.history.supportsScheduleOverwrite = true; });
        await convert.click();
        await page.waitForFunction(() => document.querySelector('[data-tm-record-preview]')?.textContent.includes('截断 1 条'));
        await page.locator('[data-tm-cal-action="save"]').click();
        await page.waitForFunction(() => __recordHarness.read().length === 1 && __recordHarness.read()[0].entrySource === 'schedule');
        assert.equal(await page.evaluate(() => __recordHarness.read().reduce((sum, r) => sum + r.durationMin, 0)), 50, 'convert records the entire draft interval over the old focus record');
        assert.equal(await page.evaluate(() => __focusTest.state.calendar.getEventById('schedule-a').end.getMinutes()), 50, 'conversion retains source plan');
        await page.locator('.tm-proto-event-popover-close').click();
        await page.locator('[data-tm-cal-record-undo]').click();
        await page.waitForFunction(() => __recordHarness.read().length === 1 && __recordHarness.read()[0].recordId === 'focus-1');
        await card.click();
        await page.locator('[data-tm-proto-edit-field="start"]').evaluate(el => { el.value = '2026-11-16T10:05'; el.dispatchEvent(new Event('input', {bubbles:true})); });
        await endField.evaluate(el => { el.value = '2026-11-16T10:15'; el.dispatchEvent(new Event('input', {bubbles:true})); });
        await convert.click();
        await page.locator('[data-tm-cal-action="save"]').click();
        await page.waitForFunction(() => __recordHarness.read().length === 3);
        const split = await page.evaluate(() => __recordHarness.read().sort((a,b) => a.start.localeCompare(b.start)).map(record => [new Date(record.start).getMinutes(),new Date(record.end).getMinutes(),record.entrySource || 'timer']));
        assert.deepEqual(split, [[0,5,'timer'],[5,15,'schedule'],[15,25,'timer']], 'conversion splits the covered original focus record in the browser');
        await page.locator('.tm-proto-event-popover-close').click();
        await page.locator('[data-tm-cal-record-undo]').click();
        await page.waitForFunction(() => __recordHarness.read().length === 1 && __recordHarness.read()[0].recordId === 'focus-1');
        await page.locator('.tm-proto-tomato-rail').first().click();
        await page.locator('.tm-proto-popover-edit').click();
        await page.locator('[data-tm-cal-field="end"]').fill('2026-11-16T10:20');
        await page.locator('[data-tm-cal-action="save"]').click();
        await page.waitForFunction(() => __recordHarness.read()[0].durationMin === 20);
        assert.equal(await page.evaluate(() => __recordHarness.read()[0].recordId), 'focus-1', 'native Edit preserves record identity');
        await page.locator('[data-tm-cal-record-undo]').click();
        await page.waitForFunction(() => __recordHarness.read()[0].durationMin === 25);
        await page.locator('[data-tm-cal-record-add]').click();
        assert.equal(await page.locator('[data-tm-cal-field="start"]').inputValue(), '', 'supplement starts with blank actual times');
        await page.locator('[data-tm-cal-field="start"]').fill('2026-11-16T12:00');
        await page.locator('[data-tm-cal-field="end"]').fill('2026-11-16T12:30');
        await page.locator('[data-tm-cal-action="save"]').click();
        await page.waitForFunction(() => __recordHarness.read().length === 2);
        await page.evaluate(() => {
            const start=new Date('2026-11-16T08:45:30.123').toISOString(),end=new Date('2026-11-16T09:50:45.456').toISOString();
            __recordHarness.set([
                {recordId:'precision-before',start:new Date('2026-11-16T08:30:00').toISOString(),end:start,mode:'break'},
                {recordId:'precision-focus',start,end,mode:'countdown',sessionId:'precision-focus',durationMin:(Date.parse(end)-Date.parse(start))/60000},
                {recordId:'precision-after',start:end,end:new Date('2026-11-16T10:00:00').toISOString(),mode:'break'},
            ]);
            const event=__focusTest.buildEventsFromRecords([__recordHarness.read()[1]],__focusTest.getSettings(),'timeGridDay')[0];
            __focusTest.openRecordModal(event);
        });
        await page.locator('[data-tm-cal-action="save"]').click();
        await page.locator('.tm-calendar-edit-modal').waitFor({state:'detached'});
        assert.deepEqual(await page.evaluate(()=>{
            const item=__recordHarness.read().find(record=>record.recordId==='precision-focus');
            return [item.start,item.end];
        }),[new Date('2026-11-16T08:45:30.123').toISOString(),new Date('2026-11-16T09:50:45.456').toISOString()],'unchanged minute fields preserve original seconds and milliseconds');
        const reopenPrecision=async()=>page.evaluate(()=>{
            const event=__focusTest.buildEventsFromRecords([__recordHarness.read().find(record=>record.recordId==='precision-focus')],__focusTest.getSettings(),'timeGridDay')[0];
            __focusTest.openRecordModal(event);
        });
        await reopenPrecision();
        await page.locator('[data-tm-cal-field="end"]').fill('2026-11-16T09:49');
        await page.locator('[data-tm-cal-action="save"]').click();
        await page.locator('.tm-calendar-edit-modal').waitFor({state:'detached'});
        assert.match(await page.evaluate(()=>__recordHarness.read().find(record=>record.recordId==='precision-focus').start),/30\.123Z$/,'editing one endpoint preserves the other endpoint precision');
        await reopenPrecision();
        await page.locator('[data-tm-cal-field="end"]').fill('2026-11-16T09:59');
        await page.locator('[data-tm-cal-action="save"]').click();
        await page.locator('.tm-calendar-edit-modal').waitFor({state:'detached'});
        assert.equal(await page.evaluate(()=>__recordHarness.read().find(record=>record.recordId==='precision-after').start),new Date('2026-11-16T09:59').toISOString(),'extending the edited record automatically shortens its neighbour');
        await page.locator('[data-tm-cal-record-undo]').click();
        await page.waitForFunction(()=>new Date(__recordHarness.read().find(record=>record.recordId==='precision-focus').end).getMinutes()===49);
        assert.equal(await page.evaluate(()=>__recordHarness.read().find(record=>record.recordId==='precision-after').start),new Date('2026-11-16T09:50:45.456').toISOString(),'undo restores the displaced neighbour precisely');
        await reopenPrecision();
        await page.evaluate(()=>{
            const records=__recordHarness.read();records.find(record=>record.recordId==='precision-focus').end=new Date('2026-11-16T09:48').toISOString();
            __recordHarness.set(records);
        });
        await page.locator('[data-tm-cal-action="save"]').click();
        await page.waitForFunction(()=>Array.from(document.querySelectorAll('.tm-hint')).some(node=>node.textContent.includes('记录已发生变化')));
        await page.keyboard.press('Escape');
        for (const method of ['dispatchEventDrop','dispatchEventResize']) {
            const accepted=await page.evaluate(method=>{
                __recordHarness.set([
                    {recordId:'gesture-edit',sessionId:'gesture-edit',start:new Date('2026-11-16T11:00').toISOString(),end:new Date('2026-11-16T11:30').toISOString(),mode:'countdown',durationMin:30},
                    {recordId:'gesture-neighbour',start:new Date('2026-11-16T12:00').toISOString(),end:new Date('2026-11-16T13:00').toISOString(),mode:'stopwatch',durationMin:60},
                ]);
                const owner=__focusTest.state.calendar;
                const event=__focusTest.buildEventsFromRecords([__recordHarness.read()[0]],__focusTest.getSettings(),'timeGridDay')[0];
                event.id='gesture-'+method;
                owner.getEventById(event.id)?.remove();owner.addEvent(event);
                const start=method==='dispatchEventDrop'?'12:20':'11:00';
                const end=method==='dispatchEventDrop'?'12:40':'12:20';
                return owner[method](event.id,new Date('2026-11-16T'+start),new Date('2026-11-16T'+end));
            },method);
            assert.equal(accepted,true,method+' uses the production calendar gesture callback');
            await page.waitForFunction(method=>{
                const item=__recordHarness.read().find(record=>record.recordId==='gesture-edit');
                return new Date(item.end).getHours()===12&&new Date(item.end).getMinutes()===(method==='dispatchEventDrop'?40:20);
            },method);
            const retained=await page.evaluate(()=>__recordHarness.read().filter(item=>item.recordId!=='gesture-edit').sort((a,b)=>a.start.localeCompare(b.start)).map(item=>[new Date(item.start).getHours()+':'+String(new Date(item.start).getMinutes()).padStart(2,'0'),new Date(item.end).getHours()+':'+String(new Date(item.end).getMinutes()).padStart(2,'0')]));
            assert.deepEqual(retained,method==='dispatchEventDrop'?[['12:00','12:20'],['12:40','13:00']]:[['12:20','13:00']],method+' automatically displaces overlapping records');
            await page.locator('[data-tm-cal-record-undo]').click();
            await page.waitForFunction(()=>__recordHarness.read().length===2&&new Date(__recordHarness.read().find(item=>item.recordId==='gesture-edit').end).getHours()===11);
        }
        for (const width of [1024, 390, 320]) {
            await page.setViewportSize({ width, height: 900 });
            await page.evaluate(() => __focusTest.openRecordModal(null, {create:true}));
            const box = await page.locator('.tm-calendar-edit-box').boundingBox();
            assert.ok(box.x >= 0 && box.x + box.width <= width + 1, `record dialog fits ${width}px`);
            if (width === 320) await page.screenshot({ path: path.join(root, 'output/playwright/focus-record-mobile.png') });
            await page.locator('[data-tm-cal-action="cancel"]').click();
        }
        await page.setViewportSize({ width:1280, height:900 });
        await page.evaluate(() => {
            document.documentElement.setAttribute('data-theme-mode', 'dark');
            for (const [name, value] of Object.entries({'--b3-theme-background':'#20252b','--b3-theme-on-background':'#d8e2ec','--b3-theme-on-surface':'#a7b5c4','--b3-theme-surface-light':'#46535e','--b3-theme-primary':'#7eb9e9'})) document.body.style.setProperty(name, value);
            __focusTest.state.__tmShowPrototypeEventPopover(__focusTest.state.calendar.getEventById('schedule-a'), document.querySelector('[data-tm-proto-event="schedule-a"]'));
        });
        await page.locator('.tm-proto-event-popover').evaluate(el => el.getAnimations({subtree:true}).forEach(animation => animation.finish()));
        await page.screenshot({ path: path.join(root, 'output/playwright/focus-record-schedule-dark.png') });
        assert.deepEqual(errors, []);
        console.log('calendar rail, conversion draft, supplement and undo browser tests passed', railGeometry);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
