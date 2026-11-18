'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('./i18n-browser-fixture');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.route('https://calendar.test/**', route => route.fulfill({ contentType: 'text/html', body: '<main id="settings"></main><section id="grid"></section>' }));
        await page.goto('https://calendar.test');
        await page.addStyleTag({ content: read('task-horizon.css') + read('calendar-view.css') });
        await page.evaluate(() => {
            window.store = { loaded: true, data: { calendarLinkDockTomato: true, calendarEventFields: [], kanbanCardFields: ['date'] }, async save() { this.saved = [...this.data.calendarEventFields]; } };
            const field = { id: 'team', name: 'Team', type: 'multi', options: ['Alpha','Beta','Gamma'].map(name => ({name,id:name})) };
            window.__tmGetCustomFieldDefMap = () => new Map([['team', field]]);
            window.__tmGetCustomFieldDefs = () => [field];
            window.__tmParseCustomFieldColumnKey = key => key.startsWith('customField:') ? key.slice(12) : '';
            window.__tmIsCustomFieldApplicableToTask = (_, task) => task.root_id === 'doc';
            window.__tmBuildStatusChipStyle = window.__tmBuildPriorityChipStyle = () => '';
            window.__tmGetDefaultUndoneStatusId = () => store.data.checkboxUndoneStatusId || 'todo';
            window.__tmGetStatusOptions = () => [{id:'todo',marker:' '},{id:'Ready',marker:' '},{id:'Review',marker:'/'}];
            window.__tmResolveTaskStatusDisplayOption = task => ({ id: task.customStatus || __tmGetDefaultUndoneStatusId(), name: task.customStatus, color:'#999' });
            window.SettingsStore = store;
            window.__tmPhosphorBoldSvg = icon => `<svg data-icon="${icon}"></svg>`;
            window.__tmResolveCustomFieldSelectedOptions = (def, values) => def.options.filter(opt => (values || []).includes(opt.id));
            window.__tmResolveCustomFieldScopeDocId = task => task.root_id;
            window.__tmResolveTaskMarkdownMarker = () => ' ';
            window.esc = String;
            window.reads = [];
            window.MetaStore = { applyToTask() {} };
            window.API = { getTasksByIds: async ids => { reads.push([...ids]); return ids.map(id => ({id,root_id:'doc',priority:'high',customStatus:'Ready'})); } };
            window.__tmQueryCustomFieldAttrRowsByTaskIds = async (ids, {fieldIds}) => { reads.push([...fieldIds]); return {valueMapByTaskId:new Map(ids.map(id => [id,{team:['Alpha','Beta','Gamma']}]))}; };
        });
        const model = read('src/task-horizon/main/task-runtime/50-task-model-and-repeat-utils.js');
        const stores = read('src/task-horizon/main/10-stores-rules-and-cache.js');
        await page.addScriptTag({ content: model.slice(model.indexOf('    function __tmGetPriorityJiraInfo('), model.indexOf('    function __tmGetPriorityAccentColor(')) });
        await page.addScriptTag({ content: stores.slice(stores.indexOf('    function __tmBuildCustomFieldTagsHtml('), stores.indexOf('    function __tmBuildCustomFieldDisplayHtml(')) });
        await page.addScriptTag({ content: model.slice(model.indexOf('    async function __tmReadCalendarFieldTasks('), model.indexOf('        getFields: () => __tmGetTaskCardFieldList(')) + '};' });
        await page.addScriptTag({ content: read('calendar-view.js').replace('    globalThis.__tmCalendar = {', '    window.probe = {state, getSettings, renderSidebar, attachCalendarEventFields, buildSharedPrototypeEventMarkup, calendarEventFieldMarkup, syncCalendarEventFieldPatch};\n    globalThis.__tmCalendar = {') });
        await page.evaluate(() => __tmCalendar.renderSettings(document.querySelector('#settings'), store));
        const display = page.locator('[data-tm-settings-section="calendar-content"]');
        assert.equal(await display.locator('[data-tm-calendar-field-preview]').count(), 1);
        assert.equal(await display.locator('[data-tm-cal-setting="calendarHideScheduledTaskDatesInAllDay"]').count(), 1);
        for (const key of ['calendarShowBreak','calendarShowIdle','calendarShowTaskReminders','calendarShowTaskDates','calendarShowCompletedAllDaySchedules']) assert.equal(await page.locator(`[data-tm-cal-setting="${key}"]`).count(), 0);
        const filters = await page.evaluate(() => {
            const sidebar = document.createElement('aside');
            sidebar.innerHTML = '<div data-tm-cal-role="calendar-list"></div><div data-tm-cal-role="tomato-list"></div>';
            probe.renderSidebar(sidebar, probe.getSettings());
            return [...sidebar.querySelectorAll('[data-tm-cal-filter]')].map(el => el.dataset.tmCalFilter);
        });
        for (const key of ['break','idle','taskReminders','taskDatesMaster','completedAllDaySchedules']) assert.ok(filters.includes(key), key);
        for (const field of ['status','priority','customField:team']) await page.locator(`.tm-cal-fields-setting input[value="${field}"]`).locator('..').click();
        assert.deepEqual(await page.evaluate(() => store.saved), ['status','priority','customField:team']);
        assert.deepEqual(await page.evaluate(() => store.data.kanbanCardFields), ['date']);
        assert.equal(await page.locator('[data-tm-calendar-field-preview] .tm-cal-field').count(), 3);
        assert.match(await page.locator('[data-tm-calendar-field-preview]').innerText(), /Alpha/);
        const preview = page.locator('[data-tm-calendar-field-preview] [role=img]');
        assert.equal(await preview.innerText(), '');
        assert.equal(await preview.locator('polyline').count(), 1);
        await page.evaluate(() => { store.data.priorityIconStyle = 'flag'; __tmCalendar.renderSettings(document.querySelector('#settings'), store); });
        assert.equal(await preview.locator('svg[data-icon=flag]').count(), 1);
        assert.equal(await preview.innerText(), '');
        const centerDifference = container => {
            const center = el => { const box = el.getBoundingClientRect(); return box.top + box.height / 2; };
            return center(container.querySelector('.tm-priority-jira__icon svg')) - center(container.querySelector('.tm-status-tag'));
        };
        assert.ok(Math.abs(await page.locator('[data-tm-calendar-field-preview]').evaluate(centerDifference)) <= 0.5);
        const result = await page.evaluate(async () => {
            const fields = store.saved, settings = {eventFields:fields};
            const make = (id, tid) => ({id,title:'Review',start:new Date(2030,0,1,9),end:new Date(2030,0,1,10),extendedProps:{__tmSource:'schedule',__tmTaskId:tid},setExtendedProp(k,v) {this.extendedProps[k]=v;} });
            const allDay = { ...make('all-day','other'), allDay:true };
            const events = [make('first','task'), make('second','task'), make('solo',''), allDay];
            await probe.attachCalendarEventFields(events, {});
            if (reads.length) throw Error('Default settings must fetch nothing');
            await probe.attachCalendarEventFields(events, settings);
            const grid = document.querySelector('#grid');
            for (const mode of ['allday','chip']) {
                if (probe.buildSharedPrototypeEventMarkup(allDay,mode,false,'',settings).includes('tm-cal-fields')) throw Error('Field on an all-day event');
            }
            grid.innerHTML = `<div class="tm-proto-time-col">${probe.buildSharedPrototypeEventMarkup(events[0],'block',true,'',settings)}</div>${probe.buildSharedPrototypeEventMarkup(events[0],'chip',false,'',settings)}`;
            const block = grid.querySelector('.tm-proto-event--block'), strip = grid.querySelector('.tm-proto-event--chip');
            const row = block.querySelector('.tm-cal-fields'), tag = strip.querySelector('.tm-cal-fields');
            if (!row.querySelector('svg[data-icon=flag]') || row.querySelector('.tm-priority-jira__label')) throw Error('Expected an icon-only flag on the timed event');
            store.data.priorityIconStyle = 'jira';
            if (!probe.calendarEventFieldMarkup(events[0],fields,'block').includes('<polyline')) throw Error('Expected the Jira priority icon on the timed event');
            const visible = el => getComputedStyle(el).display !== 'none';
            block.style.cssText += ';width:220px;height:90px;'; strip.style.width='200px';
            const geometry = [];
            const task = events[0].extendedProps.__tmFieldTask;
            task.priority = 'medium';
            for (const style of ['jira','flag']) {
                store.data.priorityIconStyle = style;
                row.innerHTML = probe.calendarEventFieldMarkup(events[0],fields,'block').replace(/^<span class="tm-cal-fields[^>]*>|<\/span>$/g,'');
                const bounds = el => { const box = el.getBoundingClientRect(); return box.top + box.height / 2; };
                geometry.push(bounds(row.querySelector('svg')) - bounds(row.querySelector('.tm-status-tag')));
            }
            store.data.checkboxUndoneStatusId = 'Ready';
            const defaultField = probe.calendarEventFieldMarkup(events[0], ['status'], 'block');
            const compactFirst = probe.calendarEventFieldMarkup(events[0], fields, 'chip');
            const nonDefault = probe.calendarEventFieldMarkup({...events[0], extendedProps:{...events[0].extendedProps, __tmFieldTask:{...task, customStatus:'todo'}}}, ['status'], 'block');
            const roomy = visible(row) && visible(tag) && tag.children.length === 1;
            block.style.height='25px'; strip.style.width='70px';
            const compact = !visible(row) && !visible(tag);
            probe.state.calendar = {};
            probe.state.calendarAdapter = { getEvents:() => events };
            probe.syncCalendarEventFieldPatch(['task'], {priority:'low',customStatus:'Review',customFieldValues:{team:[]}}, fields);
            const rows = events.map(e => probe.calendarEventFieldMarkup(e,fields,'block'));
            probe.syncCalendarEventFieldPatch(['task'], {customStatus:'Ready'}, fields);
            const reset = events.slice(0,2).map(e => probe.calendarEventFieldMarkup(e,['status'],'block'));
            return {reads,roomy,compact,rows,reset,geometry,defaultField,compactFirst,nonDefault,base:row.textContent};
        });
        assert.deepEqual(result.reads, [['task'],['team']]);
        assert.equal(result.defaultField,''); assert.deepEqual(result.reset,['','']); assert.match(result.nonDefault,/>todo</);
        assert.match(result.compactFirst,/tm-priority-jira--medium/); assert.doesNotMatch(result.compactFirst,/tm-status-tag/);
        assert.ok(result.geometry.every(delta => Math.abs(delta) <= 0.5), `Icon center offsets: ${result.geometry}`);
        assert.equal(result.roomy,true); assert.equal(result.compact,true); assert.match(result.base,/Ready/); assert.match(result.base,/\+1/);
        assert.equal(result.rows[0],result.rows[1]); assert.deepEqual(result.rows.slice(2),['','']); assert.match(result.rows[0],/Review/); assert.doesNotMatch(result.rows[0],/Alpha/);
        console.log('Calendar field preview, batch loading, layout and linked-event updates passed');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
