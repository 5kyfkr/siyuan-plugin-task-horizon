'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const main = 'src/task-horizon/main/';
const renderer = read(main + 'render/42-render-list-and-checklist-body.js');
const models = read(main + 'task-runtime/50-task-model-and-repeat-utils.js');
const patches = read(main + 'task-runtime/51-whiteboard-and-link-runtime.js');
const services = read(main + '20-api-and-runtime-services.js');
const dialogs = read(main + '30-dialogs-and-ui-foundation.js');
const settingsActions = read(main + 'settings/70-doc-group-and-settings-actions.js');
const settingsScreen = read(main + 'settings/60-settings-screen.js');
const timePatches = read(main + 'render/46-render-local-task-time-refresh.js');
function extract(source, name, assignment = false) {
    let start = source.indexOf(assignment ? `    window.${name} = function(` : `    function ${name}(`);
    if (assignment && start < 0) start = source.indexOf(`    window.${name} = async function(`);
    const end = source.indexOf(assignment ? '\n    };' : '\n    }', start);
    assert.ok(start >= 0 && end > start, name);
    return source.slice(start, end + (assignment ? 7 : 6));
}
const helpers = ['__tmRenderChecklistTaskRemark', '__tmBuildChecklistTitleContentHtml', '__tmRenderChecklistSubtaskProgress', '__tmShouldRenderChecklistTaskStatus', '__tmRenderTaskCheckbox']
    .map((name) => extract(models, name)).join('\n') + '\n' + extract(services, '__tmGetChecklistCompactMetaFieldOrder');
const patchCode = ['__tmUpdateTaskDoneInDOM', '__tmUpdateTaskRemarkInDOM', '__tmBuildTaskInlineContentHtml', '__tmUpdateTaskContentInDOM', '__tmSyncTaskSubtaskSummaryInPlace', '__tmUpdateTaskStatusTagInDOM', '__tmEnsureChecklistMetaContainer', '__tmEnsureChecklistCompactMetaContainer', '__tmSyncChecklistMetaContainerVisibility', '__tmEnsureChecklistTimeNode', '__tmUpdateTaskCustomFieldsInDOM']
    .map((name) => extract(patches, name)).join('\n') + '\n' + extract(timePatches, '__tmUpdateChecklistTaskTimeInDOM');
const wrapCode = services.slice(services.indexOf('    const __tmTaskTitleWrapCache ='), services.indexOf('    function __tmCollectKanbanSubtaskWrapRowsFromMutation('));
const toggleCode = extract(dialogs, 'tmChecklistToggleRemark', true);
const hostFieldsStart=services.indexOf('    const __tmGetCompactChecklistMetaFieldsForCurrentHost =');
const hostFieldsEnd=services.indexOf('    const __tmShouldLoadCompactChecklistHeadingContext =',hostFieldsStart);
assert.ok(hostFieldsStart>=0 && hostFieldsEnd>hostFieldsStart);
const hostFieldsCode=services.slice(hostFieldsStart,hostFieldsEnd).replace('const __tmGetCompactChecklistMetaFieldsForCurrentHost =','window.__tmReadConfiguredChecklistFields =');
const fieldOptionsStart=services.indexOf('    const __TM_CHECKLIST_COMPACT_META_FIELD_OPTIONS =');
const fieldOptionsEnd=services.indexOf('\n    ]);',fieldOptionsStart);
const fieldOptionsCode=services.slice(fieldOptionsStart,fieldOptionsEnd+8).replace('const __TM_CHECKLIST_COMPACT_META_FIELD_OPTIONS =','window.__TM_CHECKLIST_COMPACT_META_FIELD_OPTIONS =');
const fieldSettingsCode=extract(settingsActions,'updateChecklistCompactMetaFieldVisibility',true);
const layoutSettingsCode=extract(settingsActions,'updateChecklistCompactMode',true);
const headingPolicyCode=services.slice(hostFieldsEnd,services.indexOf('    const __tmShouldShowCompactChecklistDocName =',hostFieldsEnd)).replace('const __tmShouldLoadCompactChecklistHeadingContext =','window.__tmShouldLoadCompactChecklistHeadingContext =');
const fieldPreviewCode=settingsScreen.slice(settingsScreen.indexOf('        const __tmFieldPreviewStatusTag ='),settingsScreen.indexOf('        const __tmFieldPreviewCardChip =')).replace(/const (__tmFieldPreview\w+) =/g, 'window.$1 =');
const realFunctions = new Set([...(renderer + helpers + patchCode + wrapCode).matchAll(/function\s+(__tm\w+)\(/g)].map(match => match[1]));
const stubNames = [...new Set((renderer + helpers + patchCode).match(/\b__tm\w+/g))].filter(name => !realFunctions.has(name));
const setup = `
for (const name of ${JSON.stringify(stubNames)}) window[name] = () => '';
window.esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
window.state = {viewMode:'checklist',activeDocId:'all',groupByDocName:true,filteredTasks:[],listRenderStep:20,detailTaskId:'',checklistDetailDismissed:true,checklistExpandedRemarks:new Set()};
window.SettingsStore = {data:{checklistCompactMode:true,checklistCompactTreeGuides:true,enableGroupTaskBgByGroupColor:false,checkboxUndoneStatusId:'todo'},save:async()=>{window.settingSaveCount=(window.settingSaveCount || 0)+1;}};
window.__tmParseCustomFieldColumnKey = key => String(key || '').startsWith('customField:')?String(key).slice(12):'';
window.__tmDispatchDockSettingsChanged = () => {window.settingDispatchCount=(window.settingDispatchCount || 0)+1;};
window.__tmScheduleSettingsViewRefresh = () => {window.settingRefreshCount=(window.settingRefreshCount || 0)+1;};
window.GlobalLock = {isLocked:()=>false};
window.__tmCollapseMotion = {config:{maxDisclosureItems:24}};
window.__tmClamp = (v,min,max) => Math.max(min,Math.min(max,v));
window.__tmNormalizeRemarkMarkdown = value => String(value || '').trim();
window.__tmIsDarkMode = () => document.documentElement.dataset.themeMode === 'dark';
window.__tmGetChecklistCompactRightFontSize = () => window.rightSize || 'medium';
window.__tmGetWrapConfig = () => ({enabled:true});
window.__tmGetEffectiveProgressBarColor = () => '#3278c9';
window.__tmGroupBgFromLabelColor = () => '#e8f0ec';
window.__tmGetDocColorHex = () => '#3f7b63';
window.__tmGetCompactChecklistMetaFieldsForCurrentHost = () => window.useConfiguredHostFields?__tmReadConfiguredChecklistFields():window.selectedFields || ['completionTime','status'];
window.__tmNormalizeCompactChecklistMetaFields = (fields,defaults=['completionTime','status']) => Array.isArray(fields)?fields.slice():defaults.slice();
window.__tmIsDesktopDockHost = () => ['dock','dock-mobile'].includes(window.currentHost);
window.__tmIsScopedMobileHost = () => window.currentHost==='mobile';
window.__tmHasCalendarSidebarChecklist = () => window.currentHost==='calendar';
window.__tmFormatDurationDisplayValue = value => String(value || '');
window.__tmNormalizeHeadingText = value => String(value || '').trim();
window.__tmGetCustomFieldDefs = () => [{id:'tag',name:'类别',type:'single',enabled:true},{id:'team',name:'团队',type:'single',enabled:true}];
window.__tmGetCustomFieldDefMap = () => new Map(__tmGetCustomFieldDefs().map(field=>[field.id,field]));
window.__tmGetTaskCustomFieldValue = (task,id) => task.customFieldValues?.[id] || '';
window.__tmIsCustomFieldApplicableToTask = () => true;
window.__tmBuildCustomFieldDisplayHtml = (_field,value) => value?'<span class="tm-status-tag">'+esc(value)+'</span>':'';
window.__tmGetStatusOptions = () => [{id:'todo',name:'待办',marker:' ',color:'#78879c'},{id:'doing',name:'进行中',marker:'/',color:'#3278c9'},{id:'done',name:'已完成',marker:'X',color:'#3f7b63'},{id:'ready',name:'待处理',marker:' ',color:'#78879c'},{id:'abandoned',name:'放弃',marker:'-',color:'#78879c'}];
window.__tmGetDefaultUndoneStatusId = () => SettingsStore.data.checkboxUndoneStatusId || 'todo';
window.__tmResolveTaskStatusDisplayOption = task => __tmGetStatusOptions().find(option=>option.id===(task.done?'done':task.customStatus || __tmGetDefaultUndoneStatusId()));
window.__tmBuildStatusChipStyle = () => '';
window.__tmIsTaskCanceled = task => task.taskMarker==='-' || task.customStatus==='abandoned';
window.__tmIsTaskClosedForDisplay = task => !!task.done || __tmIsTaskCanceled(task);
window.__tmIsTaskDoneEffective = task => !!task.done;
window.__tmIsCheckinTask = () => false;
window.__tmBuildTaskCheckboxStyle = () => 'style="--tm-checklist-checkbox-color:#b7bec8"';
window.__tmGetTaskDateFieldDisplayValue = (t,key) => t[key] || '';
window.__tmFormatTaskDateFieldDisplayValue = (t,key) => t[key] || '';
window.__tmRenderToggleIcon = () => '<svg class="tm-tree-toggle-icon" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
window.__tmBuildDocGroupQuickAddBtnHtml = () => '<button class="tm-group-actions" onclick="event.stopPropagation();calls.add++">＋</button>';
window.__tmRenderDocGroupLabel = (_id,label) => esc(label);
window.__tmRenderHeadingLevelIconLabel = label => '<span class="tm-icon-label"><span>'+esc(label)+'</span></span>';
window.testIcon = '<svg class="tm-lucide-emoji__svg" viewBox="0 0 24 24"><path d="M5 12h14M12 5v14" stroke="currentColor" stroke-width="2"/></svg>';
window.__tmRenderPinnedTaskInlineIcon = t => t.pinned?'<span class="tm-pinned-task-icon" data-tm-inline-field="pinned" onclick="event.stopPropagation();calls.pin++"><span class="tm-lucide-emoji">'+testIcon+'</span></span>':'';
window.__tmRenderRecurringTaskInlineIcon = t => t.recurring?'<span class="tm-recurring-task-icon"><span class="tm-lucide-emoji">'+testIcon+'</span></span>':'';
window.__tmRenderTaskAttachmentIcon = t => t.attachments?'<span class="tm-task-attachment-emoji" onclick="event.stopPropagation();calls.attachment++">'+testIcon+'</span>':'';
window.__tmRenderCompletedTodayBadge = () => '';
window.__tmBuildTooltipAttrs = () => '';
window.API = {renderTaskContentHtml:(_md,text)=>esc(text),getTaskTitlePresentation:(_md,text)=>({text,html:esc(text)})};
window.__TM_CHECKLIST_COMPACT_META_FIELD_DEFAULTS = ['completionTime','status'];
window.calls = {select:0,title:0,done:0,collapse:0,group:0,add:0,pin:0,attachment:0};
window.tmChecklistSelectTask = () => calls.select++;
window.tmChecklistTitleClick = () => calls.title++;
window.tmSetDone = () => calls.done++;
window.tmToggleCollapse = (_id,e) => {e.stopPropagation();calls.collapse++};
window.tmToggleGroupCollapse = () => calls.group++;
window.__tmIsViewDomCommitBlocked = () => false;
window.__tmDoesTaskDomTargetBelongToTask = () => true;
window.__tmApplyTaskTitleOpacityToElement = () => false;
window.__tmTaskBoundary = {getTask:id=>state.filteredTasks.find(t=>t.id===id)};
window.__tmGetProjectedDirectChildStats = id => {
 const t=__tmTaskBoundary.getTask(id),list=t.children || [],completed=list.filter(x=>x.done).length;
 return {total:list.length,completed,percent:list.length?Math.round(completed/list.length*100):0};
};
window.__tmBuildTaskRowModel = () => window.rowModelOverride || [
 {type:'group',kind:window.previewPinned?'pinned':'doc',key:'doc',docId:'doc',label:window.previewPinned?'置顶':window.longGroupNames?'产品需求与跨文档任务管理的完整分组名称':'产品需求文档',labelColor:'#3f7b63',count:6},
 ...(window.includeHeading?[{type:'group',kind:'h2',key:'heading',docId:'doc',headingId:'heading',label:window.longGroupNames?'开发计划与版本记录的较长二级标题':'开发',labelColor:'#3f7b63',count:6}]:[]),
 ...state.filteredTasks.map(t=>({type:'task',id:t.id,depth:t.depth,hasChildren:t.children.length>0}))];
const make = (id,depth,content,remark='') => ({id,depth,content,remark,customStatus:'doing',root_id:'doc',docName:'任务管理器',h2:'开发',markdown:'',children:[],completionTime:'2026-10-11',customFieldValues:{tag:'新增',team:'产品'}});
const t0=make('parent',0,'整理本周产品反馈，提炼三个共性问题','把客服、社区和访谈里的反馈合并到同一份文档，先写结论，再补证据。'.repeat(5));
t0.pinned=true;t0.recurring=true;t0.attachments=true;
const t1=make('done',1,'汇总客服工单里的高频关键词');t1.done=true;
const t2=make('branch',1,'补充访谈原话作为证据');
const t3=make('nested',2,'回查原文与受访者编号');
const t4=make('deep',3,'补上访谈来源链接');
const t5=make('short',0,'和设计确认清单视图的交互方案','短备注');
t0.children=[t1,t2];t2.children=[t3];t3.children=[t4];state.filteredTasks=[t0,t1,t2,t3,t4,t5];
window.mount = (host='desktop',width=1000,theme='light',circle=true) => {
 window.currentHost=host;
 window.currentWidth=width;
 __tmCleanupTitleWrapObservers(document.querySelector('#mount'));
 document.documentElement.dataset.themeMode=theme;
 const el=document.querySelector('#mount');
 el.className='tm-modal tm-modal--task-wrap'+(circle?' tm-modal--task-checkbox-circle':'')+(['mobile','dock-mobile'].includes(host)?' tm-modal--mobile':'')+(['dock','dock-mobile'].includes(host)?' tm-modal--dock':'');
 el.style.width=width+'px';state.modal=el;__tmChecklistUseSheetMode=()=>host!=='desktop';
 el.innerHTML=__tmBuildRenderSceneChecklistBodyHtml();
 if(host==='calendar'){const body=el.firstElementChild;el.innerHTML='<div class="tm-calendar-task-page-list tm-calendar-task-page-list--checklist"></div>';el.firstElementChild.append(body);}
 __tmSyncChecklistWrappedTitleClasses(el);
};
window.__tmRerenderCurrentViewInPlace = () => {mount(currentHost,currentWidth);return true;};
`;

(async () => {
    const browser = await chromium.launch({headless:true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE} : {})});
    const output = path.join(root, 'output/playwright/list-style-integration');
    fs.mkdirSync(output, {recursive:true});
    try {
        const touch=process.env.PLAYWRIGHT_TOUCH_TEST==='1';
        const page = await browser.newPage({viewport:{width:1440,height:1000},hasTouch:touch});
        const errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        const frameCss=`body{margin:20px;font:14px "Microsoft YaHei",sans-serif}.tm-modal{position:static;transform:none;min-width:0;height:860px;padding:0;display:block}.tm-body,.tm-checklist-layout{height:100%;max-height:none}.tm-checklist-side,.tm-checklist-resizer{display:none}.tm-checklist-pane{min-width:0;width:100%;height:100%}.tm-calendar-task-page-list{height:100%;min-height:0}`;
        await page.setContent('<main id="mount"></main>');
        await page.addStyleTag({content:read('task-horizon.css')+'\n'+read('calendar-view.css')+'\n'+frameCss});
        await page.addScriptTag({content:setup+helpers+wrapCode+renderer+patchCode+toggleCode+hostFieldsCode+fieldOptionsCode+fieldSettingsCode+fieldPreviewCode+layoutSettingsCode+headingPolicyCode});
        // Shared behavior coverage replaces the old remark markup contracts.
        for (const [host, width] of [['desktop', 1000], ['mobile', 390]]) {
            await page.evaluate(({host,width}) => mount(host,width), {host,width});
            const row = page.locator('[data-id="parent"]');
            const remark = row.locator('.tm-checklist-remark');
            const geometry = await row.evaluate(node => {
                const title = node.querySelector('.tm-checklist-title-text').getBoundingClientRect();
                const checkbox = node.querySelector('.tm-task-checkbox').getBoundingClientRect();
                const titleRow = node.querySelector('.tm-checklist-title-row').getBoundingClientRect();
                const remark = node.querySelector('.tm-checklist-remark').getBoundingClientRect();
                const lineHeight = parseFloat(getComputedStyle(node.querySelector('.tm-checklist-title')).lineHeight);
                return { overflow: node.scrollWidth - node.clientWidth, remarkBelow: remark.top >= titleRow.bottom - 1,
                    checkboxOffset: Math.abs(checkbox.top + checkbox.height / 2 - title.top - lineHeight / 2),
                    duplicateRemarkIcon: !!node.querySelector('[data-tm-field="remarkIcon"]')?.textContent.trim() };
            });
            assert.ok(geometry.overflow <= 1, host + ': task row must fit its host');
            assert.ok(geometry.remarkBelow, host + ': remark must remain below title and fields');
            assert.ok(geometry.checkboxOffset <= 2, host + ': checkbox must align with the first title line');
            assert.equal(geometry.duplicateRemarkIcon, false);
            await page.waitForFunction(() => !document.querySelector('[data-id="parent"] .tm-checklist-remark-toggle').hidden);
            const collapsedHeight = await row.evaluate(node => node.offsetHeight);
            await remark.locator('button').click();
            assert.equal(await remark.locator('button').getAttribute('aria-expanded'), 'true');
            assert.ok(await row.evaluate(node => node.offsetHeight) > collapsedHeight);
            await page.evaluate(() => {
                window.smokeRow = document.querySelector('[data-id="parent"]');
                const task = state.filteredTasks[0];
                task.content = 'Updated task title';
                __tmUpdateTaskContentInDOM(smokeRow, task);
                task.remark += ' Updated remark';
                __tmUpdateTaskRemarkInDOM(smokeRow, task);
                task.children.forEach(child => { child.done = true; });
                __tmSyncTaskSubtaskSummaryInPlace('parent');
            });
            assert.equal(await row.locator('.tm-checklist-title-text').textContent(), 'Updated task title');
            assert.equal(await remark.locator('button').getAttribute('aria-expanded'), 'true', 'local updates keep expanded remarks');
            assert.equal(await row.locator('.tm-checklist-progress-count').textContent(), '2/2');
            assert.equal(await row.locator('[role="progressbar"]').getAttribute('aria-valuenow'), '2');
            await remark.locator('button').click();
            assert.equal(await remark.locator('button').getAttribute('aria-expanded'), 'false');
            await page.evaluate(() => {
                const task = state.filteredTasks[0]; task.remark = '';
                __tmUpdateTaskRemarkInDOM(smokeRow, task);
            });
            assert.equal(await remark.count(), 0);
            await page.evaluate(() => {
                const task = state.filteredTasks[0]; task.remark = 'Restored remark';
                __tmUpdateTaskRemarkInDOM(smokeRow, task);
            });
            assert.equal(await remark.locator('.tm-checklist-remark-text').textContent(), 'Restored remark');
            assert.equal(await page.evaluate(() => smokeRow === document.querySelector('[data-id="parent"]')), true, 'remark changes retain the mounted task row');
            await row.locator('.tm-task-checkbox').click();
            await row.locator(host === 'mobile' ? '.tm-checklist-mobile-toggle' : '.tm-tree-toggle').click();
            await page.evaluate(() => {
                const task = state.filteredTasks[0];
                task.content = '整理本周产品反馈，提炼三个共性问题';
                task.remark = '把客服、社区和访谈里的反馈合并到同一份文档，先写结论，再补证据。'.repeat(5);
                task.children[1].done = false;
                state.checklistExpandedRemarks.clear();
            });
        }
        for (const circle of [false, true]) {
            for (const theme of ['light', 'dark']) {
                await page.evaluate(({circle,theme}) => {
                    mount('desktop',1000,theme,circle);
                    const preview = document.createElement('div');
                    preview.id = 'canceled-checkbox-preview';
                    preview.style.cssText = 'display:flex;gap:24px;padding:24px;';
                    document.querySelector('#mount').prepend(preview);
                    const shapes = circle ? 'tm-task-checkbox--circle' : '';
                    const surfaces = [
                        ['list','tm-checklist-item',shapes],
                        ['detail','tm-task-detail-shell'+(circle?' tm-task-detail--task-checkbox-circle':''),shapes],
                        ['overlay','',shapes],
                        ['calendar-modal','tm-calendar-schedule-editor-modal','tm-calendar-edit-relation-check '+shapes],
                        ['calendar-inline','tm-proto-inline-schedule-editor','tm-proto-inline-relation-check '+shapes],
                    ];
                    for (const [name,classes,extraClass] of surfaces) {
                        const task = {id:'checkbox-'+name,taskMarker:'-',customStatus:'renamed',done:false};
                        const root = document.createElement('div');
                        root.className = classes;
                        root.dataset.surface = name;
                        if (name==='overlay') root.id='tm-task-detail-overlay';
                        root.innerHTML = '<span>'+name+'</span><div class="tm-task-detail-subtask-main">'+__tmRenderTaskCheckbox(task.id,task,{extraClass})+'</div>';
                        preview.append(root);
                    }
                }, {circle,theme});
                const readMark = node => {
                    const style = getComputedStyle(node,'::after');
                    return {checked:node.checked,canceled:node.classList.contains('tm-task-checkbox--canceled'),width:parseFloat(style.width),height:parseFloat(style.height),right:style.borderRightWidth,bottom:style.borderBottomWidth,transform:style.transform,radius:getComputedStyle(node).borderRadius};
                };
                for (const surface of ['list','detail','overlay','calendar-modal','calendar-inline']) {
                    const checkbox = page.locator('#canceled-checkbox-preview [data-surface="'+surface+'"] input');
                    const dash = await checkbox.evaluate(readMark);
                    assert.equal(dash.checked,true,JSON.stringify({circle,theme,surface,dash}));
                    assert.equal(dash.canceled,true);
                    assert.ok(dash.width>=5 && dash.height===0,'dash must be horizontal: '+JSON.stringify({circle,theme,surface,dash}));
                    assert.equal(dash.right,'0px');
                    assert.equal(dash.bottom,'2px');
                    assert.ok(dash.transform.startsWith('matrix(1, 0, 0, 1,'),'dash must not rotate');
                    assert.equal(dash.radius,circle?'999px':'4px');
                    for (const marker of ['X',' ','-']) {
                        await checkbox.evaluate((input,marker) => {
                            const root = input.closest('[data-surface]');
                            __tmUpdateTaskDoneInDOM(root,{id:input.dataset.taskId,taskMarker:marker,done:marker==='X'});
                        },marker);
                        const updated = await checkbox.evaluate(readMark);
                        assert.equal(updated.checked,marker!==' ');
                        assert.equal(updated.canceled,marker==='-','state changes must clear and restore the dash');
                        if (marker==='X') assert.ok(updated.height>0 && updated.right==='2px','completion restores the check mark');
                    }
                }
                await page.locator('#canceled-checkbox-preview').screenshot({path:path.join(output,'canceled-checkbox-'+(circle?'circle':'square')+'-'+theme+'.png')});
                await page.locator('#canceled-checkbox-preview').evaluate(node=>node.remove());
            }
        }
        if (process.env.TM_TEST_SMOKE === '1') {
            assert.deepEqual(errors, []);
            console.log('Checklist release smoke passed: two hosts, alignment, remark changes, progress, checkbox and collapse');
            return;
        }
        await page.evaluate(() => Object.keys(calls).forEach(key => { calls[key] = 0; }));
        const results=[];
        const alignmentChecks=[];
        const typographyChecks=[];
        const stickyChecks=[];
        for(const width of [440,1000]) {
            await page.evaluate(width=>{
                window.stickySavedTasks=state.filteredTasks;
                window.stickySavedLimit=state.listRenderLimit;
                state.filteredTasks=Array.from({length:80},(_,i)=>({...stickySavedTasks[5],id:'sticky-'+i,content:'分组滚动任务 '+i,remark:'',children:[],customStatus:'todo'}));
                state.listRenderLimit=80;
                window.rowModelOverride=[];
                for(let group=0;group<2;group++) {
                    rowModelOverride.push({type:'group',kind:'doc',key:'sticky-group-'+group,docId:'doc',label:'滚动分组 '+group,labelColor:'#3f7b63',count:40});
                    rowModelOverride.push(...state.filteredTasks.slice(group*40,(group+1)*40).map(t=>({type:'task',id:t.id,depth:0,hasChildren:false})));
                }
                mount('desktop',width);
                const scroll=document.querySelector('.tm-checklist-scroll'),headers=document.querySelectorAll('.tm-checklist-group');
                window.stickySecondOffset=headers[1].getBoundingClientRect().top-scroll.getBoundingClientRect().top;
                window.stickyHeaderHeight=headers[0].getBoundingClientRect().height;
            },width);
            for(const remaining of [5,0,-8]) {
                const positions=await page.evaluate(remaining=>{
                    const scroll=document.querySelector('.tm-checklist-scroll');
                    scroll.scrollTop=stickySecondOffset-stickyHeaderHeight-remaining;
                    const top=scroll.getBoundingClientRect().top,headers=document.querySelectorAll('.tm-checklist-group');
                    return {first:headers[0].getBoundingClientRect().top-top,second:headers[1].getBoundingClientRect().top-top,height:stickyHeaderHeight};
                },remaining);
                assert.ok(Math.abs(positions.first-Math.min(0,remaining))<=1,JSON.stringify({width,remaining,positions}));
                assert.ok(Math.abs(positions.second-positions.height-remaining)<=1,JSON.stringify({width,remaining,positions}));
                stickyChecks.push({width,remaining,...positions});
            }
            await page.evaluate(()=>{state.filteredTasks=stickySavedTasks;state.listRenderLimit=stickySavedLimit;window.rowModelOverride=null;});
        }
        for(const host of ['desktop','calendar','dock','mobile']) {
            for(const theme of ['light','dark']) {
                for(const width of [280,440,760,1000]) {
                    await page.evaluate(({host,width,theme})=>mount(host,width,theme),{host,width,theme});
                    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
                    const geometry=await page.evaluate(()=>{
                        const pane=document.querySelector('.tm-checklist-pane'),row=document.querySelector('[data-id="parent"]'),text=row.querySelector('.tm-checklist-title-text'),cb=row.querySelector('input'),r=text.getBoundingClientRect(),c=cb.getBoundingClientRect();
                        const lines=[...document.querySelectorAll('.tm-checklist-tree-guide-line')].map(el=>({x:el.getBoundingClientRect().left,width:el.getBoundingClientRect().width,opacity:getComputedStyle(el.querySelector('::before')||el).opacity}));
                        const parentX=c.left+c.width/2;
                        const child=document.querySelector('[data-id="branch"] input').getBoundingClientRect();
                        const guide=document.querySelector('[data-id="done"] .tm-checklist-tree-guide-line').getBoundingClientRect();
                        const toggles=[...pane.querySelectorAll('.tm-checklist-item--has-branch-leading')].map(item=>{
                            const leading=item.querySelector('.tm-checklist-leading .tm-tree-toggle'),trailing=item.querySelector('.tm-checklist-mobile-toggle'),title=item.querySelector('.tm-checklist-title-text'),t=title.getBoundingClientRect(),b=trailing.getBoundingClientRect(),row=item.getBoundingClientRect();
                            return {leading:getComputedStyle(leading).display,trailing:getComputedStyle(trailing).display,rightGap:row.right-b.right-parseFloat(getComputedStyle(item).paddingRight),offset:b.top+b.height/2-t.top-parseFloat(getComputedStyle(title).lineHeight)/2,contentGap:b.left-item.querySelector('.tm-checklist-title-row').getBoundingClientRect().right};
                        });
                        return {paneWidth:pane.clientWidth,checkboxGutter:c.left-row.getBoundingClientRect().left-parseFloat(getComputedStyle(row).paddingLeft),toggles,overflow:pane.scrollWidth-pane.clientWidth,offset:(c.top+c.height/2)-(r.top+parseFloat(getComputedStyle(text).lineHeight)/2),guideOffset:guide.left-parentX,indent:child.left-c.left,cardRadius:getComputedStyle(document.querySelector('.tm-checklist-group-card')).borderRadius,lines};
                    });
                    assert.ok(geometry.overflow<=1,JSON.stringify({host,theme,width,geometry}));
                    assert.ok(Math.abs(geometry.offset)<=1,JSON.stringify({host,theme,width,geometry}));
                    assert.ok(Math.abs(geometry.guideOffset)<=1,JSON.stringify({host,theme,width,geometry}));
                    assert.equal(geometry.indent,22);
                    assert.equal(geometry.cardRadius,'0px');
                    assert.ok(geometry.lines.every(l=>l.width===1));
                    const rightToggle=host!=='desktop' || geometry.paneWidth<=760 || touch;
                    assert.ok(Math.abs(geometry.checkboxGutter-(rightToggle?0:20))<=1,JSON.stringify({host,theme,width,touch,rightToggle,geometry}));
                    assert.ok(geometry.toggles.every(toggle=>rightToggle
                        ? toggle.leading==='none' && toggle.trailing!=='none' && Math.abs(toggle.rightGap)<=1 && Math.abs(toggle.offset)<=1 && toggle.contentGap>=8
                        : toggle.leading!=='none' && toggle.trailing==='none'),JSON.stringify({host,theme,width,touch,rightToggle,geometry}));
                    if(rightToggle) {
                        const before=await page.evaluate(()=>({...calls}));
                        await page.locator('[data-id="parent"] .tm-checklist-mobile-toggle').click();
                        const after=await page.evaluate(()=>({...calls}));
                        assert.equal(after.collapse,before.collapse+1);
                        assert.equal(after.select,before.select);
                        await page.evaluate(before=>{window.calls=before;},before);
                    }
                    results.push({host,theme,width,offset:geometry.offset,overflow:geometry.overflow,checkboxGutter:geometry.checkboxGutter,toggles:geometry.toggles});
                    if(theme==='light' && (width===1000 || width===440)) await page.screenshot({path:path.join(output,host+'-'+width+'.png')});
                    if(theme==='dark' && host==='desktop' && width===1000) await page.screenshot({path:path.join(output,'desktop-dark-1000.png')});
                }
            }
        }
        const outerSpacingChecks=[];
        const hoverSelectionChecks=[];
        for(const host of ['desktop','calendar','dock','mobile']) {
            for(const width of [440,1000]) {
                for(const compact of [true,false]) {
                    for(const selection of ['single','multi']) {
                    await page.evaluate(({host,width,compact,selection})=>{
                        SettingsStore.data.checklistCompactMode=compact;
                        state.detailTaskId=selection==='single'?'branch':'';mount(host,width);
                        if(selection==='multi') document.querySelector('[data-id="branch"]').classList.add('tm-task-row--multi-selected');
                    },{host,width,compact,selection});
                    const selected=page.locator('[data-id="branch"]');
                    const border=await selected.evaluate(row=>getComputedStyle(row).boxShadow);
                    assert.notEqual(border,'none');
                    await selected.hover();
                    assert.equal(await selected.evaluate(row=>getComputedStyle(row).boxShadow),border,JSON.stringify({host,width,compact,selectedHover:true}));
                    await page.locator('[data-id="nested"]').hover();
                    const layers=await page.evaluate(()=>({selected:Number(getComputedStyle(document.querySelector('[data-id="branch"]')).zIndex)||0,hovered:Number(getComputedStyle(document.querySelector('[data-id="nested"]')).zIndex)||0}));
                    assert.ok(layers.selected>layers.hovered,JSON.stringify({host,width,compact,layers}));
                    await page.evaluate(()=>document.querySelector('.tm-checklist-scroll').classList.add('tm-scroll-active'));
                    await selected.hover();
                    assert.equal(await selected.evaluate(row=>getComputedStyle(row).boxShadow),border,JSON.stringify({host,width,compact,scrolling:true}));
                    hoverSelectionChecks.push({host,width,compact,selection,border,layers});
                    }
                }
            }
        }
        await page.evaluate(()=>{state.detailTaskId='';SettingsStore.data.checklistCompactMode=true;});
        for(const host of ['desktop','calendar','dock','mobile']) {
            for(const calendarOpen of [false,true]) {
                await page.evaluate(({host,calendarOpen})=>{
                    mount(host,1000);
                    document.querySelector('#mount').classList.toggle('tm-box--with-cal-dock',calendarOpen);
                },{host,calendarOpen});
                const spacing=await page.evaluate(()=>{
                    const scroll=document.querySelector('.tm-checklist-scroll'),pane=document.querySelector('.tm-checklist-pane'),header=document.querySelector('.tm-checklist-group');
                    const p=pane.getBoundingClientRect(),h=header.getBoundingClientRect(),style=getComputedStyle(scroll);
                    return {top:h.top-p.top,left:h.left-p.left,right:p.right-h.right,paddingTop:style.paddingTop,paddingLeft:style.paddingLeft,paddingRight:style.paddingRight};
                });
                assert.ok(Math.abs(spacing.top)<=1 && Math.abs(spacing.left)<=1 && Math.abs(spacing.right)<=1,JSON.stringify({host,calendarOpen,spacing}));
                assert.equal(spacing.paddingTop,'0px');assert.equal(spacing.paddingLeft,'0px');assert.equal(spacing.paddingRight,'0px');
                outerSpacingChecks.push({host,calendarOpen,...spacing});
            }
        }
        await page.mouse.move(1360,960);
        await page.evaluate(()=>{SettingsStore.data.enableGroupTaskBgByGroupColor=true;mount('desktop',1000);});
        const colors=await page.evaluate(()=>({rows:[...document.querySelectorAll('.tm-checklist-item')].map(el=>getComputedStyle(el).backgroundColor),header:getComputedStyle(document.querySelector('.tm-checklist-group')).backgroundColor,pane:getComputedStyle(document.querySelector('.tm-checklist-pane')).backgroundColor}));
        assert.ok(colors.rows.every(color=>color==='rgba(0, 0, 0, 0)'),JSON.stringify(colors));
        assert.notEqual(colors.header,colors.pane);
        await page.evaluate(()=>{SettingsStore.data.enableGroupTaskBgByGroupColor=false;});
        for (const host of ['desktop','calendar','dock','mobile']) {
        for (const font of [14,20]) {
            for (const size of ['large','medium','small']) {
                await page.evaluate(({font,size,host})=>{
                    window.rightSize=size;
                    window.includeHeading=true;
                    window.selectedFields=['docName','h2','customField:tag','status'];
                    document.documentElement.style.setProperty('--tm-font-size',font+'px');
                    document.documentElement.style.setProperty('--tm-row-height',Math.max(32,font*1.5+16)+'px');
                    mount(host,1000);
                },{font,size,host});
                const alignment=await page.evaluate(()=>{
                    const row=document.querySelector('[data-id="done"]'),text=row.querySelector('.tm-checklist-title-text'),status=row.querySelector('[data-tm-field="status"]');
                    const r=row.getBoundingClientRect(),t=text.getBoundingClientRect(),s=status.getBoundingClientRect();
                    const style=getComputedStyle(status);
                    const field=row.querySelector('.tm-checklist-meta-compact-custom-field .tm-status-tag').getBoundingClientRect();
                    return {status:(s.top+s.height/2)-(t.top+parseFloat(getComputedStyle(text).lineHeight)/2),custom:(field.top+field.height/2)-(t.top+parseFloat(getComputedStyle(text).lineHeight)/2),top:t.top-r.top,bottom:r.bottom-t.bottom,statusStyle:{height:s.height,margin:style.marginTop,lineHeight:style.lineHeight,font:style.fontSize,padding:style.padding}};
                });
                assert.ok(Math.abs(alignment.status)<=1,JSON.stringify({font,size,alignment}));
                assert.ok(Math.abs(alignment.custom)<=1,JSON.stringify({font,size,alignment}));
                assert.ok(Math.abs(alignment.top-alignment.bottom)<=1,JSON.stringify({font,size,alignment}));
                const typography=await page.evaluate(()=>({
                    doc:parseFloat(getComputedStyle(document.querySelector('.tm-checklist-group--doc .tm-checklist-group-label')).fontSize),
                    heading:parseFloat(getComputedStyle(document.querySelector('.tm-checklist-group--h2 .tm-checklist-group-label')).fontSize),
                    task:parseFloat(getComputedStyle(document.querySelector('.tm-checklist-title-text')).fontSize)
                }));
                assert.equal(typography.doc,typography.task,JSON.stringify({host,font,typography}));
                assert.ok(typography.heading<typography.task,JSON.stringify({host,font,typography}));
                assert.equal(typography.task,font);
                typographyChecks.push({host,font,...typography});
                const groupLayout=await page.evaluate(()=>[...document.querySelectorAll('.tm-checklist-group')].map(group=>{
                    const label=group.querySelector('.tm-checklist-group-label').getBoundingClientRect(),count=group.querySelector('.tm-badge--count').getBoundingClientRect(),style=getComputedStyle(group);
                    const toggle=group.querySelector('.tm-group-toggle').getBoundingClientRect();
                    return {heading:group.classList.contains('tm-checklist-group--h2'),toggleColor:getComputedStyle(group.querySelector('.tm-group-toggle')).color,taskToggleColor:getComputedStyle(document.querySelector('.tm-checklist-item--has-branch-leading .tm-tree-toggle')).color,countBorder:getComputedStyle(group.querySelector('.tm-badge--count')).borderTopWidth,toggleRightGap:group.getBoundingClientRect().right-toggle.right-parseFloat(style.paddingRight),borderTop:style.borderTopWidth,paddingTop:parseFloat(style.paddingTop),paddingBottom:parseFloat(style.paddingBottom),countGap:count.left-label.right,rowHeight:group.getBoundingClientRect().height,labelHeight:label.height};
                }));
                assert.ok(groupLayout.every(group=>group.borderTop==='0px'),JSON.stringify({host,font,groupLayout}));
                assert.ok(groupLayout.every(group=>Math.abs(group.toggleRightGap)<=1),JSON.stringify({host,font,groupLayout}));
                assert.ok(groupLayout.every(group=>group.toggleColor===group.taskToggleColor && group.countBorder==='0px'),JSON.stringify({host,font,groupLayout}));
                assert.ok(groupLayout.every(group=>group.paddingTop===(group.heading?4:6) && group.paddingBottom===group.paddingTop),JSON.stringify({host,font,groupLayout}));
                assert.ok(groupLayout.every(group=>group.countGap>=0 && group.countGap<=10),JSON.stringify({host,font,groupLayout}));
                assert.ok(groupLayout.every(group=>group.rowHeight>=group.labelHeight+group.paddingTop+group.paddingBottom),JSON.stringify({host,font,groupLayout}));
                const icons=await page.evaluate(()=>{
                    const row=document.querySelector('[data-id="parent"]'),text=row.querySelector('.tm-checklist-title-text').getBoundingClientRect();
                    const line=parseFloat(getComputedStyle(row.querySelector('.tm-checklist-title-text')).lineHeight);
                    return [...row.querySelectorAll('.tm-pinned-task-icon svg,.tm-recurring-task-icon svg,.tm-task-attachment-emoji svg')].map(el=>{const r=el.getBoundingClientRect();return (r.top+r.height/2)-(text.top+line/2);});
                });
                assert.ok(icons.every(offset=>Math.abs(offset)<=1),JSON.stringify({font,size,icons}));
                alignmentChecks.push({host,font,size,statusOffset:alignment.status,customTagOffset:alignment.custom,topPadding:alignment.top,bottomPadding:alignment.bottom,iconOffsets:icons});
                if(font===20 && size==='large' && (host==='desktop' || host==='calendar')) await page.screenshot({path:path.join(output,host+'-font20-large.png')});
            }
        }
        }
        for(const host of ['desktop','calendar','dock','mobile']) {
            for(const width of [280,440]) {
                await page.evaluate(({host,width})=>{window.longGroupNames=true;mount(host,width);},{host,width});
                const headingLayout=await page.evaluate(()=>{
                    const pane=document.querySelector('.tm-checklist-pane');
                    return {overflow:pane.scrollWidth-pane.clientWidth,headers:[...pane.querySelectorAll('.tm-checklist-group')].map(el=>({row:el.getBoundingClientRect().height,label:el.querySelector('.tm-checklist-group-label').getBoundingClientRect().height}))};
                });
                assert.ok(headingLayout.overflow<=1,JSON.stringify({host,width,headingLayout}));
                assert.ok(headingLayout.headers.every(header=>header.label<=header.row),JSON.stringify({host,width,headingLayout}));
            }
        }
        await page.evaluate(()=>{window.includeHeading=false;window.longGroupNames=false;});
        const configuredFieldChecks=[];
        for(const host of ['dock','dock-mobile','mobile','calendar']) {
            await page.evaluate(({host})=>{
                SettingsStore.data.desktopChecklistCompactMetaFields=['completionTime'];
                SettingsStore.data.dockChecklistCompactMetaFields=['docName','h2','startDate','duration','customField:tag','status'];
                SettingsStore.data.mobileChecklistCompactMetaFields=['completionTime','status'];
                window.useConfiguredHostFields=true;
                state.activeDocId='doc';
                state.filteredTasks[5].startDate='2026-10-11';state.filteredTasks[5].duration='45m';
                mount(host,440);
            },{host});
            const configured=await page.evaluate(()=>{
                const row=document.querySelector('[data-id="short"]');
                return {fields:__tmGetCompactChecklistMetaFieldsForCurrentHost(),doc:row.querySelector('.tm-checklist-meta-compact-doc')?.textContent,heading:row.querySelector('.tm-checklist-meta-compact-h2')?.textContent,start:row.querySelector('[data-tm-task-time-field="startDateCompact"]')?.textContent,duration:row.querySelector('[data-tm-task-time-field="durationCompact"]')?.textContent,custom:row.querySelector('[data-tm-custom-field-cell="tag"]')?.textContent};
            });
            assert.equal(configured.doc,undefined,JSON.stringify({host,configured}));
            assert.equal(configured.heading,'开发',JSON.stringify({host,configured}));
            assert.equal(configured.start,'2026-10-11',JSON.stringify({host,configured}));
            assert.equal(configured.duration,'45m',JSON.stringify({host,configured}));
            assert.equal(configured.custom,'新增',JSON.stringify({host,configured}));
            await page.evaluate(({host})=>{state.activeDocId='all';mount(host,440);},{host});
            assert.equal(await page.locator('[data-id="short"] .tm-checklist-meta-compact-doc').textContent(),'任务管理器');
            configuredFieldChecks.push({host,...configured});
            await page.evaluate(async()=>{await updateChecklistCompactMetaFieldVisibility('dock','duration',false);});
            await page.evaluate(({host})=>mount(host,440),{host});
            assert.equal(await page.locator('[data-id="short"] [data-tm-task-time-field="durationCompact"]').count(),0);
            await page.evaluate(async()=>{await updateChecklistCompactMetaFieldVisibility('mobile','duration',true);});
            await page.evaluate(({host})=>mount(host,440),{host});
            assert.equal(await page.locator('[data-id="short"] [data-tm-task-time-field="durationCompact"]').textContent(),'45m');
            const saved=await page.evaluate(()=>({dock:SettingsStore.data.dockChecklistCompactMetaFields,mobile:SettingsStore.data.mobileChecklistCompactMetaFields,desktop:SettingsStore.data.desktopChecklistCompactMetaFields,save:window.settingSaveCount,dispatch:window.settingDispatchCount,refresh:window.settingRefreshCount}));
            assert.deepEqual(saved.dock,saved.mobile);
            assert.deepEqual(saved.desktop,['completionTime']);
            assert.ok(saved.save>0 && saved.dispatch>0 && saved.refresh>0);
        }
        await page.evaluate(()=>{mount('desktop',1000);});
        assert.equal(await page.locator('[data-id="short"] .tm-checklist-meta-compact-doc').count(),0);
        assert.equal(await page.locator('[data-id="short"] [data-tm-task-time-field="completionTimeCompact"]').count(),1);
        await page.evaluate(()=>{window.useConfiguredHostFields=false;state.activeDocId='all';});
        const fieldOrderChecks=[];
        const expectedFieldOrder=['docName','h2','startDate','completionTime','remainingTime','duration','tomatoSummary','tomatoEstimateCount','tomatoCount','status','customField:tag','customField:team'];
        for(const host of ['desktop','calendar','dock','mobile']) {
            for(const compact of [true,false]) {
            for(const width of [440,1000]) {
                await page.evaluate(({host,width,compact,expectedFieldOrder})=>{
                    SettingsStore.data.checklistCompactMode=compact;
                    const selected=expectedFieldOrder.slice().reverse();
                    SettingsStore.data.desktopChecklistCompactMetaFields=selected;
                    SettingsStore.data.dockChecklistCompactMetaFields=selected;
                    window.useConfiguredHostFields=true;
                    window.__tmGetTaskRemainingTimeInfo=()=>({label:'还剩 2 天'});
                    window.__tmRenderTaskRemainingTimeInfoHtml=info=>info?.label || '';
                    window.__tmShouldRenderTaskCardRemainingTime=()=>true;
                    window.__tmGetTaskTomatoSummaryText=()=> '45 分钟';
                    window.__tmGetTaskTomatoSummaryHtml=()=> '45 分钟';
                    window.__tmGetTaskTomatoEstimateCount=()=>3;
                    window.__tmGetTaskTomatoCount=()=>2;
                    window.__tmGetTomatoCountDisplay=value=>String(value);
                    window.__tmGetActualTomatoCountDisplayHtml=value=>String(value);
                    Object.assign(state.filteredTasks[5],{startDate:'2026-10-11',duration:'45m',customStatus:'doing',customFieldValues:{tag:'新增',team:'产品'}});
                    mount(host,width);
                    window.readCompactFieldOrder=()=>[...document.querySelector('[data-id="short"] .tm-checklist-meta-compact').children]
                        .filter(node=>!node.hidden && node.style.display!=='none')
                        .map(node=>node.getAttribute('data-tm-checklist-compact-field'));
                },{host,width,compact,expectedFieldOrder});
                assert.deepEqual(await page.evaluate(()=>readCompactFieldOrder()),expectedFieldOrder,{host,width});
                const positions=await page.evaluate(()=>[...document.querySelector('[data-id="short"] .tm-checklist-meta-compact').children].map(node=>{
                    const r=node.getBoundingClientRect();return {x:r.left,y:r.top+r.height/2};
                }));
                assert.ok(positions.every((p,i)=>i===0 || p.y>=positions[i-1].y-1 && (Math.abs(p.y-positions[i-1].y)>1 || p.x>=positions[i-1].x)),JSON.stringify({host,width,positions}));
                const preview=await page.evaluate(({width})=>{
                    const holder=document.createElement('div');holder.innerHTML=__tmFieldPreviewListRow(__tmGetCompactChecklistMetaFieldsForCurrentHost(),width<760);
                    return [...holder.querySelector('.tm-checklist-meta-compact').children].map(node=>node.textContent);
                },{width});
                assert.deepEqual(preview,['周报','本周','9月20日 09:00','9月25日','还剩 2 天','1.5h','45 分钟','预计 3','实际 2','进行中','类别·示例','团队·示例']);
                await page.evaluate(({host,width})=>{
                    Object.assign(state.filteredTasks[5],{startDate:'',duration:'',customFieldValues:{team:'产品'}});
                    mount(host,width);
                    const row=document.querySelector('[data-id="short"]');
                    window.retainedOrderRow=row;
                    window.retainedOrderStatus=row.querySelector('[data-tm-field="status"]');
                    window.retainedOrderCustom=row.querySelector('[data-tm-custom-field-cell="team"]');
                    const task=state.filteredTasks[5];
                    task.duration='90m';__tmUpdateChecklistTaskTimeInDOM(task.id,row,task);
                    task.startDate='2026-10-12';__tmUpdateChecklistTaskTimeInDOM(task.id,row,task);
                    task.customFieldValues.tag='新增';__tmUpdateTaskCustomFieldsInDOM(row,task,{customFieldValues:{tag:'新增'}});
                },{host,width});
                assert.deepEqual(await page.evaluate(()=>readCompactFieldOrder()),expectedFieldOrder,{host,width,localUpdate:true});
                assert.equal(await page.evaluate(()=>document.querySelector('[data-id="short"]')===retainedOrderRow && retainedOrderRow.querySelector('[data-tm-field="status"]')===retainedOrderStatus && retainedOrderRow.querySelector('[data-tm-custom-field-cell="team"]')===retainedOrderCustom),true);
                await page.evaluate(()=>{
                    const task=state.filteredTasks[5];task.customStatus='todo';__tmUpdateTaskStatusTagInDOM(retainedOrderRow,task);
                    task.customFieldValues.tag='';__tmUpdateTaskCustomFieldsInDOM(retainedOrderRow,task,{customFieldValues:{tag:''}});
                });
                assert.deepEqual(await page.evaluate(()=>readCompactFieldOrder()),expectedFieldOrder.filter(key=>!['status','customField:tag'].includes(key)));
                fieldOrderChecks.push({host,width,compact,initial:true,preview:true,localInsert:true,nodeIdentity:true,hiddenFields:true});
            }
            }
        }
        const layoutModeChecks=[];
        for(const host of ['desktop','calendar','dock','mobile']) {
            for(const width of [280,440,1000]) {
                const layouts=[];
                for(const compact of [true,false,true]) {
                    const layout=await page.evaluate(async({host,width,compact})=>{
                        window.useConfiguredHostFields=false;window.selectedFields=['h2','status'];
                        window.includeHeading=true;
                        Object.assign(state.filteredTasks[5],{content:'插件说明文档',remark:'',customStatus:'doing'});
                        mount(host,width);
                        await updateChecklistCompactMode(compact);
                        const pane=document.querySelector('.tm-checklist-pane'),row=document.querySelector('[data-id="short"]'),title=row.querySelector('.tm-checklist-title-main'),meta=row.querySelector('.tm-checklist-meta-compact');
                        const r=row.getBoundingClientRect(),t=title.getBoundingClientRect(),m=meta.getBoundingClientRect(),group=document.querySelector('.tm-checklist-group'),checkbox=row.querySelector('input');
                        const preview=document.createElement('div');preview.innerHTML=__tmFieldPreviewListRow(selectedFields,false);
                        const toggles=[...document.querySelectorAll('.tm-checklist-group')].map(header=>({rightGap:header.getBoundingClientRect().right-header.querySelector('.tm-group-toggle').getBoundingClientRect().right-parseFloat(getComputedStyle(header).paddingRight),last:header.querySelector('.tm-checklist-group-controls').lastElementChild===header.querySelector('.tm-group-toggle')}));
                        return {compact,below:m.top>=t.bottom-1,aligned:Math.abs(m.left-t.left)<=1,sharedStyle:pane.classList.contains('tm-checklist-pane--compact'),belowClass:pane.classList.contains('tm-checklist-pane--fields-below'),padding:getComputedStyle(row).paddingTop,font:getComputedStyle(row).fontSize,radius:getComputedStyle(row).borderRadius,background:getComputedStyle(row).backgroundColor,groupColor:getComputedStyle(group).backgroundColor,groupHeight:group.getBoundingClientRect().height,checkboxWidth:checkbox.getBoundingClientRect().width,treeGuides:document.querySelectorAll('.tm-checklist-tree-guide-line').length,headingLoads:__tmShouldLoadCompactChecklistHeadingContext(),legacyMeta:row.querySelectorAll('.tm-checklist-meta,.tm-checklist-custom-field-tags').length,previewBelow:preview.querySelector('.tm-checklist-pane').classList.contains('tm-checklist-pane--fields-below'),fields:[...meta.children].map(node=>node.getAttribute('data-tm-checklist-compact-field')),toggles};
                    },{host,width,compact});
                    assert.equal(layout.below,!compact || width<=760,JSON.stringify({host,width,layout}));
                    if(layout.below) assert.equal(layout.aligned,true,JSON.stringify({host,width,layout}));
                    assert.equal(layout.sharedStyle,true);
                    assert.equal(layout.belowClass,!compact);
                    assert.equal(layout.previewBelow,!compact);
                    assert.equal(layout.headingLoads,true);
                    assert.equal(layout.legacyMeta,0);
                    assert.deepEqual(layout.fields,['h2','status']);
                    assert.ok(layout.toggles.every(toggle=>toggle.last && Math.abs(toggle.rightGap)<=1),JSON.stringify({host,width,layout}));
                    layouts.push(layout);
                }
                for(const key of ['padding','font','radius','background','groupColor','groupHeight','checkboxWidth','treeGuides']) {
                    assert.equal(layouts[0][key],layouts[1][key],JSON.stringify({host,width,key,layouts}));
                    assert.equal(layouts[0][key],layouts[2][key]);
                }
                await page.evaluate(async()=>{await updateChecklistCompactMode(false);});
                if(width===1000 && ['desktop','calendar'].includes(host)) await page.screenshot({path:path.join(output,host+'-fields-below-1000.png')});
                layoutModeChecks.push({host,width,layouts});
            }
        }
        await page.evaluate(()=>{window.useConfiguredHostFields=false;window.includeHeading=false;SettingsStore.data.checklistCompactMode=true;});
        const hostHeightChecks=[];
        for(const font of [14,20]) {
            for(const width of [440,1000]) {
                for(const rowHeight of [32,44,56]) {
                    for(const shape of ['plain','status','multiline']) {
                        const measurements=[];
                        for(const host of ['desktop','calendar','dock','mobile','dock-mobile']) {
                            const measurement=await page.evaluate(({font,width,rowHeight,shape,host})=>{
                                document.documentElement.style.setProperty('--tm-font-size',font+'px');
                                document.documentElement.style.setProperty('--tm-row-height',rowHeight+'px');
                                window.selectedFields=['status'];
                                const task=state.filteredTasks[5];task.content=shape==='multiline'?'任务管理清单需要保持一致的行高和首行对齐'.repeat(4):'插件说明文档';task.remark='';task.pinned=false;task.customStatus=shape==='plain'?'todo':'doing';
                                mount(host,width);
                                const row=document.querySelector('[data-id="short"]'),text=row.querySelector('.tm-checklist-title-text');
                                return {host,height:row.getBoundingClientRect().height,padding:getComputedStyle(row).paddingTop,textHeight:text.getBoundingClientRect().height};
                            },{font,width,rowHeight,shape,host});
                            measurements.push(measurement);
                        }
                        assert.ok(measurements.every(m=>Math.abs(m.height-measurements[0].height)<=1 && m.padding===measurements[0].padding),JSON.stringify({font,width,rowHeight,shape,touch,measurements}));
                        hostHeightChecks.push({font,width,rowHeight,shape,touch,measurements});
                    }
                }
            }
        }
        await page.evaluate(()=>{state.filteredTasks[5].customStatus='doing';});
        const narrowChecks=[];
        const densityChecks=[];
        for(const host of ['desktop','calendar','dock','mobile']) {
            for(const width of [280,360,440]) {
                await page.evaluate(({host,width})=>{
                    window.selectedFields=['status'];window.rightSize='large';
                    document.documentElement.style.setProperty('--tm-font-size','20px');
                    document.documentElement.style.setProperty('--tm-row-height','46px');
                    const task=state.filteredTasks[5];task.content='NOTE 变更安全栅供应商，提交防爆变更及在线监测控制板验证';task.remark='';task.pinned=true;
                    mount(host,width);
                },{host,width});
                const gaps=await page.evaluate(()=>{
                    const row=document.querySelector('[data-id="short"]'),title=row.querySelector('.tm-checklist-title'),text=row.querySelector('.tm-checklist-title-text'),tag=row.querySelector('[data-tm-field="status"]');
                    return {titleExtra:title.getBoundingClientRect().height-text.getBoundingClientRect().height,tagGap:tag.getBoundingClientRect().top-text.getBoundingClientRect().bottom,emptySlots:[...title.querySelectorAll('[data-tm-field]:empty')].map(el=>el.getBoundingClientRect().height)};
                });
                assert.ok(gaps.titleExtra<=1,JSON.stringify({host,width,gaps}));
                assert.ok(gaps.tagGap<=10,JSON.stringify({host,width,gaps}));
                assert.ok(gaps.emptySlots.every(height=>height===0));
                narrowChecks.push({host,width,...gaps});
                if(host==='calendar' && width===360) await page.screenshot({path:path.join(output,'calendar-multiline-360.png')});
                await page.evaluate(({host,width})=>{
                    const task=state.filteredTasks[5];task.content='插件说明文档';task.pinned=false;
                    mount(host,width);
                },{host,width});
                const density=await page.evaluate(()=>{
                    const row=document.querySelector('[data-id="short"]'),text=row.querySelector('.tm-checklist-title-text'),tag=row.querySelector('[data-tm-field="status"]');
                    const r=row.getBoundingClientRect(),t=text.getBoundingClientRect(),s=tag.getBoundingClientRect();
                    return {height:r.height,tagGap:s.top-t.bottom,topPadding:t.top-r.top,bottomPadding:r.bottom-s.bottom,titleWidth:t.width,statusLeft:s.left-text.getBoundingClientRect().left};
                });
                const widePadding=await page.evaluate(({host})=>{
                    mount(host,1000);
                    const row=document.querySelector('[data-id="short"]'),r=row.getBoundingClientRect(),text=row.querySelector('.tm-checklist-title-text').getBoundingClientRect();
                    return text.top-r.top;
                },{host});
                await page.evaluate(({host,width})=>mount(host,width),{host,width});
                assert.ok(Math.abs(density.topPadding-widePadding)<=1 && Math.abs(density.bottomPadding-widePadding)<=1,JSON.stringify({host,width,density,widePadding}));
                assert.ok(density.tagGap>=0 && density.tagGap<=2,JSON.stringify({host,width,density}));
                assert.ok(Math.abs(density.statusLeft)<=1,JSON.stringify({host,width,density}));
                densityChecks.push({host,width,...density});
                if(host==='calendar' && width===440) await page.screenshot({path:path.join(output,'calendar-compact-status-440.png')});
            }
        }
        await page.evaluate(()=>{state.filteredTasks[5].content='和设计确认清单视图的交互方案';state.filteredTasks[5].remark='短备注';state.filteredTasks[5].pinned=false;});
        const defaultStatusChecks=[];
        for(const host of ['desktop','calendar','dock','mobile']) {
            for(const compact of [true,false]) {
                await page.evaluate(({host,compact})=>{
                    SettingsStore.data.checklistCompactMode=compact;SettingsStore.data.checkboxUndoneStatusId='todo';
                    window.selectedFields=['status'];state.filteredTasks[5].remark='';state.filteredTasks[5].customStatus='';
                    mount(host,440);
                },{host,compact});
                const tag=page.locator('[data-id="short"] [data-tm-field="status"]');
                assert.equal(await tag.isVisible(),false);
                let hiddenGeometry=null;
                {
                    hiddenGeometry=await page.locator('[data-id="short"]').evaluate(row=>{
                        const text=row.querySelector('.tm-checklist-title-text').getBoundingClientRect(),r=row.getBoundingClientRect();
                        return {rowHeight:r.height,textHeight:text.height,topPadding:text.top-r.top,bottomPadding:r.bottom-text.bottom,statusHeight:row.querySelector('[data-tm-field="status"]').getBoundingClientRect().height};
                    });
                    assert.equal(hiddenGeometry.statusHeight,0);
                    assert.ok(Math.abs(hiddenGeometry.rowHeight-hiddenGeometry.textHeight-hiddenGeometry.topPadding-hiddenGeometry.bottomPadding)<=1,JSON.stringify({host,hiddenGeometry}));
                    assert.ok(Math.abs(hiddenGeometry.topPadding-hiddenGeometry.bottomPadding)<=1,JSON.stringify({host,hiddenGeometry}));
                }
                await page.evaluate(()=>{
                    const task=state.filteredTasks[5],row=document.querySelector('[data-id="short"]');
                    task.customStatus='doing';__tmUpdateTaskStatusTagInDOM(row,task);
                });
                assert.equal(await tag.isVisible(),true);
                assert.equal(await tag.textContent(),'进行中');
                await page.evaluate(()=>{
                    const task=state.filteredTasks[5],row=document.querySelector('[data-id="short"]');
                    task.customStatus='todo';__tmUpdateTaskStatusTagInDOM(row,task);
                });
                assert.equal(await tag.isVisible(),false);
                await page.evaluate(()=>{
                    const task=state.filteredTasks[5],row=document.querySelector('[data-id="short"]');
                    SettingsStore.data.checkboxUndoneStatusId='ready';task.customStatus='ready';__tmUpdateTaskStatusTagInDOM(row,task);
                });
                assert.equal(await tag.isVisible(),false);
                await page.evaluate(()=>{
                    const task=state.filteredTasks[5],row=document.querySelector('[data-id="short"]');
                    task.customStatus='todo';__tmUpdateTaskStatusTagInDOM(row,task);
                });
                assert.equal(await tag.isVisible(),true);
                await page.evaluate(()=>{
                    const task=state.filteredTasks[5],row=document.querySelector('[data-id="short"]');
                    task.customStatus='abandoned';__tmUpdateTaskStatusTagInDOM(row,task);
                });
                assert.equal(await tag.isVisible(),true);
                assert.equal(await tag.textContent(),'放弃');
                defaultStatusChecks.push({host,compact,defaultHidden:true,updatesInPlace:true,configuredDefaultRespected:true,abandonedVisible:true,hiddenGeometry});
            }
        }
        await page.evaluate(()=>{SettingsStore.data.checklistCompactMode=true;SettingsStore.data.checkboxUndoneStatusId='todo';state.filteredTasks[5].customStatus='doing';state.filteredTasks[5].remark='短备注';});
        await page.evaluate(()=>{window.rightSize='medium';window.selectedFields=null;document.documentElement.style.removeProperty('--tm-font-size');document.documentElement.style.removeProperty('--tm-row-height');});
        await page.evaluate(()=>mount('desktop',1000));
        const toggle=page.locator('[data-id="parent"] .tm-checklist-remark-toggle');
        await toggle.waitFor({state:'visible'});
        const height=await page.locator('[data-id="parent"]').evaluate(el=>el.offsetHeight);
        await toggle.click();
        assert.equal(await toggle.getAttribute('aria-expanded'),'true');
        assert.ok(await page.locator('[data-id="parent"]').evaluate(el=>el.offsetHeight)>height);
        await page.evaluate(()=>{
            const task=state.filteredTasks[0],row=document.querySelector('[data-id="parent"]');
            task.remark+='\n更新后的备注仍保持展开';__tmUpdateTaskRemarkInDOM(row,task);
            task.content='更新后的长任务标题'.repeat(12);__tmUpdateTaskContentInDOM(row,task);
        });
        assert.equal(await toggle.getAttribute('aria-expanded'),'true');
        assert.equal(await page.locator('[data-id="parent"] .tm-checklist-title-text').count(),1);
        assert.equal(await page.locator('[data-id="parent"] [data-tm-inline-field="pinned"]').count(),1);
        await page.evaluate(()=>{state.filteredTasks[2].done=true;__tmSyncTaskSubtaskSummaryInPlace('parent');});
        assert.equal(await page.locator('[data-id="parent"] .tm-checklist-progress-count').textContent(),'2/2');
        assert.equal(await page.locator('[data-id="parent"] [role="progressbar"]').getAttribute('aria-valuenow'),'2');
        await page.evaluate(()=>mount('desktop',1000));
        assert.equal(await toggle.getAttribute('aria-expanded'),'true');
        await toggle.click();
        assert.equal(await toggle.getAttribute('aria-expanded'),'false');
        assert.equal(await page.locator('[data-id="short"] .tm-checklist-remark-toggle').isVisible(),false);
        await page.locator('[data-id="parent"] input').click();
        await page.locator(touch?'[data-id="parent"] .tm-checklist-mobile-toggle':'[data-id="parent"] .tm-tree-toggle').click();
        await page.locator('[data-id="parent"] [data-tm-inline-field="pinned"]').click();
        await page.locator('.tm-checklist-group').hover();
        await page.locator('.tm-group-actions').click();
        await page.locator('.tm-checklist-group .tm-group-toggle').click();
        const calls=await page.evaluate(()=>window.calls);
        assert.deepEqual(calls,{select:0,title:0,done:1,collapse:1,group:1,add:1,pin:1,attachment:0});
        await page.evaluate(()=>{const t=state.filteredTasks[0];t.remark='';__tmUpdateTaskRemarkInDOM(document.querySelector('[data-id="parent"]'),t);});
        assert.equal(await page.locator('[data-id="parent"] .tm-checklist-remark').count(),0);
        const pinPath=dialogs.match(/'pin': '([^']+)'/)[1];
        await page.evaluate((pinSvg)=>{
            window.previewPinned=true;window.includeHeading=true;window.rightSize='large';
            window.__tmRenderBadgeIcon=name=>name==='pin'?pinSvg:'';
            document.documentElement.style.setProperty('--tm-font-size','20px');
            document.documentElement.style.setProperty('--tm-row-height','46px');
        },'<svg viewBox="0 0 256 256" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="'+pinPath+'"></path></svg>');
        for(const theme of ['light','dark']) {
            await page.evaluate(theme=>mount('desktop',1000,theme),theme);
            await page.mouse.move(1360,960);
            await page.screenshot({path:path.join(output,'pinned-group-'+theme+'.png')});
        }
        assert.deepEqual(errors,[]);
        fs.writeFileSync(path.join(output,touch?'results-touch.json':'results.json'),JSON.stringify({geometry:results,sticky:stickyChecks,hoverSelection:hoverSelectionChecks,outerSpacing:outerSpacingChecks,typography:typographyChecks,configuredFields:configuredFieldChecks,fieldOrder:fieldOrderChecks,layoutModes:layoutModeChecks,hostHeight:hostHeightChecks,alignment:alignmentChecks,narrow:narrowChecks,density:densityChecks,defaultStatus:defaultStatusChecks,colors,operations:calls,errors},null,2));
        console.log('checklist style browser regression: host geometry, alignment, field settings/order, previews, local patches and action isolation passed');
    } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
