'use strict';

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const manifest = JSON.parse(read('src/task-horizon/manifest.main.json'));
let runtime = manifest.scripts.map(file => read('src/task-horizon/' + file)).join('\n');
const startup = runtime.lastIndexOf("    if (document.readyState === 'loading') {");
assert.ok(startup > 0);
runtime = runtime.slice(0, startup) + `
    window.kanbanTest = {
        state, SettingsStore, applyFilters, defaultAppearance: SettingsStore.data.kanbanAppearance,
        mount(progressive = false) {
            __tmCleanupKanbanLaneAppearance();
            __tmCancelProgressiveViewRender();
            __tmKanbanColsHtmlCache = null;
            if (progressive) __tmStartProgressiveViewRender('kanban');
            state.renderKanbanBodyHtml = options => __tmBuildRenderSceneKanbanBodyHtml(options);
            state.modal.innerHTML = state.renderKanbanBodyHtml();
            __tmBindKanbanPan(state.modal);
        },
        loadNext(key) { return state.__tmProgressiveViewRender?.columns?.find(column => column.key === key)?.loadNextBatch(state.modal); },
        patch: ids => __tmTryRefreshKanbanColumns(state.modal, ids),
        mutateAndRefresh(mutation) {
            __tmTaskStore.applyMutation(mutation);
            __tmRecomputeTaskProjection({ reason: 'kanban-background-regression' });
            if (__tmTryRefreshKanbanColumns(state.modal, [mutation.taskId])) return 'columns';
            return __tmRerenderKanbanInPlace(state.modal) ? 'body' : 'failed';
        },
        cleanup: __tmCleanupKanbanLaneAppearance,
        render,
        setMount: __tmSetMount,
        session: () => state.__tmKanbanLaneAppearance,
        restore: __tmRestoreBodyOnlyViewScroll,
        projectStats(tasks) {
            const stats = __tmCreateProjectTaskStats();
            tasks.forEach(task => __tmAddProjectTaskToStats(stats, task));
            return { ...stats, progress: __tmGetProjectProgressPercent(stats) };
        },
        projectProgress: __tmGetProjectProgressPercent,
        invalidateProgress: __tmInvalidateDocProgressCache,
        nativePatch: __tmApplyNativeDocCheckboxTaskStorePatch,
        taskMarkdown: __tmBuildTaskMarkdownWithMarker,
    };
    SettingsStore.loaded = true;
    SettingsStore.save = async () => SettingsStore.syncToLocal();
    window.__taskHorizonHostBridge = {};
})();`;

(async () => {
    const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><body></body></html>'); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.goto('http://127.0.0.1:' + server.address().port);
        await page.route('**/api/query/sql', async route => {
            const stmt = route.request().postDataJSON()?.stmt || '';
            const rows = await page.evaluate(stmt => {
                if (!stmt.includes('AS completed')) return [];
                const groups = new Map();
                Object.values(kanbanTest.state.flatTasks).forEach(base => {
                    const task = __tmTaskStore.getProjected(base.id) || base;
                    if (!stmt.includes(task.root_id)) return;
                    const row = groups.get(task.root_id) || {root_id:task.root_id,total:0,completed:0};
                    row.total++;
                    if (task.done || task.taskMarker==='-') row.completed++;
                    groups.set(task.root_id,row);
                });
                return Array.from(groups.values()).map(row => ({...row,...window.__sqlProjectCounts?.[row.root_id]}));
            },stmt);
            await route.fulfill({json:{code:0,data:rows}});
        });
        await page.addStyleTag({ content: read('task-horizon.css') + `
          body { margin:0; background:#f8fafb; }
          #manager { position:relative; width:100vw; height:100vh; background:var(--tm-bg-color); }
          .tm-body { box-sizing:border-box; }
        ` });
        await page.addScriptTag({ content: runtime });
        assert.equal(await page.evaluate(()=>kanbanTest.defaultAppearance),'lanes','vertical lanes is the default appearance');
        await page.evaluate(() => {
            const { state, SettingsStore } = kanbanTest;
            const manager = document.createElement('main');
            manager.id = 'manager'; manager.className = 'tm-modal';
            document.body.append(manager); state.modal = manager;
            manager.style.cssText = '--tm-bg-color:#f8fafb;--tm-header-bg:#eef2f4;--tm-text-color:#29353b;--tm-secondary-text:#64747b;--tm-primary-color:#307baa;--tm-border-color:#d6dfe3;--card:#fcfdfd;--card-foreground:#29353b;--border:#d6dfe3;--tm-font-size:14px;font:14px/1.5 sans-serif;';
            Object.assign(SettingsStore.data, { kanbanAppearance:'lanes', kanbanBoardMode:'heading',
                kanbanFillColumns:true, kanbanPreventSubtaskSeparation:true, completedTasksInlineInGroups:true,
                currentGroupId:'all', newTaskDocId:'', completedTasksTodayOnly:false });
            Object.assign(state, { viewMode:'kanban', activeDocId:'all', showCompletedTasks:false, rule:{},
                filterRules:[], groupByDocName:false, groupByTime:false, groupByTaskName:false,
                quadrantEnabled:false, otherBlocks:[], searchKeyword:'' });
            const a = '20261012000000-aaaaaaa', b = '20261012000000-bbbbbbb';
            const archive = '20261012000000-ccccccc', inbox = '20261012000000-ddddddd';
            SettingsStore.data.newTaskDocId = inbox;
            const tasks = [
                { id:'active', root_id:a, content:'明确演示功能范围', done:false, children:[
                    { id:'child', root_id:a, parentTaskId:'active', content:'补充验收条件', done:true, children:[] }
                ] },
                { id:'complete', root_id:a, content:'完成需求评审', done:true, children:[] },
                { id:'canceled', root_id:a, content:'取消的演示任务', done:false, taskMarker:'-', children:[] },
                { id:'archived-complete', root_id:archive, content:'已归档演示项目', done:true, children:[] },
                { id:'inbox-complete', root_id:inbox, content:'收集箱已处理条目', done:true, children:[] },
                ...Array.from({length:30}, (_,i)=>({id:'task-'+i, root_id:b, content:'验证界面流程 '+i,done:false,children:[]})),
                ...Array.from({length:45}, (_,i)=>({id:'done-'+i, root_id:b, content:'已完成演示任务 '+i,done:true,children:[]})),
            ];
            state.taskTree = [{id:a,name:'需求规划',tasks:tasks.filter(task=>task.root_id===a)},
                {id:b,name:'功能开发',tasks:tasks.filter(task=>task.root_id===b)},
                {id:archive,name:'历史归档示例',tasks:tasks.filter(task=>task.root_id===archive)},
                {id:inbox,name:'演示收集箱',tasks:tasks.filter(task=>task.root_id===inbox)}];
            state.flatTasks = Object.fromEntries([...tasks,tasks[0].children[0]].map(task=>[task.id,task]));
            __tmTaskStore.acceptAuthoritative(Object.values(state.flatTasks), {replaceAll:true,replaceDocuments:true,docIds:[a,b,archive,inbox],replaceStructure:true});
            kanbanTest.applyFilters(); kanbanTest.mount();
        });
        const settle = async () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await settle();
        const first = page.locator('.tm-kanban-col[data-col-key="doc:20261012000000-aaaaaaa"]');
        assert.equal(await first.locator('.tm-kanban-col-progress').getAttribute('aria-valuenow'), '75', 'homepage project semantics include subtasks and ended/canceled tasks');
        assert.equal(await first.locator('.tm-kanban-col-progress').getAttribute('aria-valuetext'), '项目进度 75%');
        assert.equal(await page.evaluate(()=>kanbanTest.projectStats(Object.values(kanbanTest.state.flatTasks).filter(task=>task.root_id==='20261012000000-aaaaaaa')).progress),75,'both surfaces share the same calculation');
        assert.deepEqual(await first.locator('.tm-kanban-col-body').evaluate(el=>({left:getComputedStyle(el).paddingLeft,right:getComputedStyle(el).paddingRight})),{left:'10px',right:'10px'},'requested horizontal card inset applies');
        await first.locator('.tm-kanban-col-body').evaluate(el => {el.scrollTop=50;});
        const strengthPreview = await page.evaluate(async () => {
            const body=document.querySelector('.tm-body--kanban');
            const card=body.querySelector('.tm-kanban-card');
            const bar=body.querySelector('.tm-kanban-col-progress');
            const barColor=getComputedStyle(bar).backgroundColor;
            const list=card.closest('.tm-kanban-col-body');
            const top=list.scrollTop;
            const canvas=body.querySelector('.tm-kanban-lane-background canvas');
            const before=canvas.toDataURL();
            await updateKanbanLaneColorStrength(30);
            await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
            const after=canvas.toDataURL();
            const strength=body.style.getPropertyValue('--tm-kanban-lane-strength');
            const unchanged=card===body.querySelector('.tm-kanban-card') && list.scrollTop===top && getComputedStyle(bar).backgroundColor===barColor;
            await updateKanbanLaneColorStrength(15);
            return {strength,changed:before!==after,unchanged};
        });
        assert.deepEqual(strengthPreview,{strength:'30%',changed:true,unchanged:true},'changing background strength does not replace cards, move scroll or recolor progress');
        assert.equal(await first.locator('.tm-kanban-col-progress').evaluate(el=>el.offsetHeight), 4);
        assert.equal(await page.locator('.tm-kanban-lane-background canvas').count(), 1, 'one shared color field avoids additive overlapping washes');
        assert.equal(await page.locator('.tm-kanban-col[data-col-key="doc:20261012000000-bbbbbbb"] .tm-kanban-col-progress').getAttribute('aria-valuenow'),'60','large document uses all 75 roots, including 45 hidden completed tasks');
        await page.evaluate(()=>{window.__sqlProjectCounts={'20261012000000-bbbbbbb':{total:100,completed:80}};kanbanTest.invalidateProgress();kanbanTest.mount();});
        await page.waitForFunction(()=>document.querySelector('[data-col-key="doc:20261012000000-bbbbbbb"] .tm-kanban-col-progress')?.getAttribute('aria-valuenow')==='80');
        assert.equal(await page.evaluate(()=>kanbanTest.projectProgress({total:75,done:45},'20261012000000-bbbbbbb')),80,'homepage and board reuse the authoritative document cache when local task data is incomplete');
        await page.evaluate(async()=>{
            window.__sqlProjectCounts={'20261012000000-bbbbbbb':{total:75,completed:75}};
            kanbanTest.invalidateProgress();
            await __tmLoadDocProgressBatch(['20261012000000-bbbbbbb']);
            kanbanTest.mount();
        });
        await settle();
        assert.equal(await page.locator('.tm-kanban-col[data-col-key="doc:20261012000000-bbbbbbb"] .tm-kanban-col-progress').getAttribute('aria-valuenow'),'60','background paints must not replace known unfinished tasks with a stale 100 percent cache');
        await page.evaluate(()=>{window.__sqlProjectCounts=null;kanbanTest.invalidateProgress();kanbanTest.mount();});
        await page.waitForFunction(()=>document.querySelector('[data-col-key="doc:20261012000000-bbbbbbb"] .tm-kanban-col-progress')?.getAttribute('aria-valuenow')==='60');
        await page.setViewportSize({width:390,height:844});
        const nativeSweep = await page.evaluate(async () => {
            globalThis.__taskHorizonRuntimeClientKind='harmony-app';
            kanbanTest.state.modal.classList.add('tm-modal--mobile','tm-modal--runtime-mobile');
            const body = document.querySelector('.tm-body--kanban');
            const card = body.querySelector('.tm-kanban-card');
            const nativeTasks = Object.values(kanbanTest.state.flatTasks).filter(task=>task.id.startsWith('done-')).slice(0, 9);
            let bodyReplacements = 0;
            const observer = new MutationObserver(records=>records.forEach(record=>record.removedNodes.forEach(node=>{
                if(node instanceof Element && node.matches('.tm-body--kanban')) bodyReplacements++;
            })));
            observer.observe(kanbanTest.state.modal, {childList:true,subtree:true});
            for (let pass=0;pass<4;pass++) for (const base of nativeTasks) {
                const task=__tmTaskStore.getProjected(base.id);
                kanbanTest.nativePatch(task.id,{done:true,taskMarker:'X',task_marker:'X',markdown:kanbanTest.taskMarkdown(task,'X')},task);
                await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
            }
            observer.disconnect();
            const result={bodyReplacements,bodyKept:body===document.querySelector('.tm-body--kanban'),cardKept:card===document.querySelector('.tm-kanban-card')};
            delete globalThis.__taskHorizonRuntimeClientKind;
            kanbanTest.state.modal.classList.remove('tm-modal--mobile','tm-modal--runtime-mobile');
            return result;
        });
        assert.deepEqual(nativeSweep,{bodyReplacements:0,bodyKept:true,cardKept:true},'repeated native synchronization of hidden completed tasks must not rebuild the mobile board');
        await page.setViewportSize({width:1200,height:800});
        const headingProgress = await page.evaluate(async () => {
            kanbanTest.state.activeDocId='20261012000000-aaaaaaa'; kanbanTest.applyFilters(); kanbanTest.mount();
            const body=document.querySelector('.tm-body--kanban');
            const bar=body.querySelector('.tm-kanban-col-progress');
            const card=body.querySelector('.tm-kanban-card');
            __tmTaskStore.applyMutation({type:'taskPatch',opId:'heading-progress-only',taskId:'complete',phase:'optimistic',patch:{done:false},data:{deferProjection:true,deferSnapshot:true}});
            await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
            const percent=bar.getAttribute('aria-valuenow');
            __tmTaskStore.applyMutation({type:'taskPatch',opId:'heading-progress-only',taskId:'complete',phase:'rollback',patch:{done:false},inversePatch:{done:true},data:{deferProjection:true,deferSnapshot:true}});
            await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
            const result={percent,restored:bar.getAttribute('aria-valuenow'),bodyKept:body===document.querySelector('.tm-body--kanban'),barKept:bar===document.querySelector('.tm-kanban-col-progress'),cardKept:card===document.querySelector('.tm-kanban-card')};
            kanbanTest.state.activeDocId='all'; kanbanTest.applyFilters(); kanbanTest.mount();
            return result;
        });
        assert.deepEqual(headingProgress,{percent:'50',restored:'75',bodyKept:true,barKept:true,cardKept:true},'single-document heading progress must update and roll back without card rendering');
        const mutationFrames = await page.evaluate(async () => {
            const sample = () => {
                const board = document.querySelector('.tm-kanban');
                const canvas = board.querySelector('.tm-kanban-lane-background canvas');
                if (!canvas) return null;
                const column = board.querySelector('[data-col-key="doc:20261012000000-aaaaaaa"]');
                const rect = column.getBoundingClientRect();
                const x = (rect.left - board.getBoundingClientRect().left + rect.width / 2) * canvas.width / canvas.clientWidth;
                return Array.from(canvas.getContext('2d').getImageData(Math.floor(x), 16, 1, 1).data);
            };
            const initial = sample();
            const operations = [
                {type:'taskPatch',opId:'background-status',taskId:'task-9',patch:{done:true},inversePatch:{done:false}},
                {type:'createTaskInDoc',opId:'background-create',taskId:'background-new',docId:'20261012000000-ddddddd',
                    task:{id:'background-new',root_id:'20261012000000-ddddddd',content:'检查演示背景连续性',done:false,children:[]}},
            ];
            const results = [];
            for (const operation of operations) {
                await new Promise(resolve => requestAnimationFrame(resolve));
                const path = kanbanTest.mutateAndRefresh({...operation,phase:'optimistic'});
                const frames = [sample()];
                for (let i = 0; i < 4; i++) {
                    await new Promise(resolve => requestAnimationFrame(resolve));
                    frames.push(sample());
                }
                results.push({path,frames});
                kanbanTest.mutateAndRefresh({...operation,phase:'rollback'});
                frames.push(sample());
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                frames.push(sample());
            }
            return {initial,results};
        });
        assert.deepEqual(mutationFrames.results.map(result=>result.path),['columns','body'],'status edits patch columns; a task in the empty inbox triggers a full body refresh');
        for (const result of mutationFrames.results) {
            result.frames.forEach(pixel=>assert.deepEqual(pixel,mutationFrames.initial,'task changes keep the unaffected column tint visible, including the refresh frame'));
        }
        await page.evaluate(()=>kanbanTest.mount(true));
        await settle();
        const largeColumn = page.locator('.tm-kanban-col[data-col-key="doc:20261012000000-bbbbbbb"]');
        assert.ok(await largeColumn.locator('.tm-kanban-card').count()<30,'fixture exercises partial mounting');
        assert.equal(await largeColumn.locator('.tm-kanban-col-progress').getAttribute('aria-valuenow'),'60','progress is independent of mounted card count');
        await page.evaluate(()=>kanbanTest.loadNext('doc:20261012000000-bbbbbbb'));
        await settle();
        assert.equal(await largeColumn.locator('.tm-kanban-col-progress').getAttribute('aria-valuenow'),'60','appending a batch does not change progress');
        await page.evaluate(()=>__tmTaskStore.applyMutation({type:'taskPatch',opId:'complete-unmounted-task',taskId:'task-9',patch:{done:true},phase:'optimistic'}));
        await page.waitForFunction(()=>document.querySelector('[data-col-key="doc:20261012000000-bbbbbbb"] .tm-kanban-col-progress')?.getAttribute('aria-valuenow')==='61');
        await page.evaluate(()=>__tmTaskStore.applyMutation({type:'taskPatch',opId:'complete-unmounted-task',taskId:'task-9',patch:{done:true},inversePatch:{done:false},phase:'rollback'}));
        await page.waitForFunction(()=>document.querySelector('[data-col-key="doc:20261012000000-bbbbbbb"] .tm-kanban-col-progress')?.getAttribute('aria-valuenow')==='60');
        await page.evaluate(()=>kanbanTest.mount());
        const visibleKeys = await page.locator('.tm-kanban-col').evaluateAll(elements=>elements.map(el=>el.dataset.colKey));
        assert.ok(!visibleKeys.includes('doc:20261012000000-ccccccc'), 'statistics do not resurrect archived/completed-only columns');
        assert.ok(!visibleKeys.includes('doc:20261012000000-ddddddd'), 'statistics do not create empty inbox columns');
        await page.evaluate(()=>{kanbanTest.SettingsStore.data.kanbanAppearance='classic';kanbanTest.applyFilters();kanbanTest.mount();});
        assert.deepEqual(await page.locator('.tm-kanban-col').evaluateAll(elements=>elements.map(el=>el.dataset.colKey)),visibleKeys,'both appearances use identical visible columns');
        await page.evaluate(()=>{kanbanTest.SettingsStore.data.kanbanAppearance='lanes';kanbanTest.applyFilters();kanbanTest.mount();});
        await page.evaluate(()=>{kanbanTest.SettingsStore.data.kanbanFillColumns=false;kanbanTest.mount();});
        await settle();
        const lastEdge = await page.evaluate(() => {
            const body=document.querySelector('.tm-body--kanban');
            const board=body.querySelector('.tm-kanban');
            const canvas=board.querySelector('canvas');
            const columns=Array.from(board.querySelectorAll(':scope > .tm-kanban-col'));
            const last=columns[columns.length-1].getBoundingClientRect();
            const origin=board.getBoundingClientRect().left;
            const scale=canvas.width/canvas.clientWidth;
            const context=canvas.getContext('2d');
            const pixel=x=>Array.from(context.getImageData(Math.floor(x*scale),16,1,1).data).slice(0,3);
            return {own:pixel(last.left-origin+last.width/2),edge:pixel(last.right-origin),
                beyond:pixel(last.right-origin+15),base:pixel(canvas.clientWidth-1),
                extraScroll:body.scrollWidth>body.clientWidth};
        });
        assert.notDeepEqual(lastEdge.edge,lastEdge.own,'last column fades toward the empty area');
        assert.notDeepEqual(lastEdge.edge,lastEdge.base,'last-column boundary still has color rather than a white cut');
        assert.deepEqual(lastEdge.beyond,lastEdge.base,'last-column transition settles into the page background');
        assert.equal(lastEdge.extraScroll,false,'background transition does not add horizontal scrolling');
        await page.screenshot({path:path.join(root,'output/playwright/kanban-lanes-last-edge.png')});
        for (const compact of [false,true]) {
            await page.setViewportSize({width:500,height:800});
            await page.evaluate(compact=>{kanbanTest.SettingsStore.data.kanbanCompactMode=compact;kanbanTest.SettingsStore.data.kanbanFillColumns=false;kanbanTest.mount();},compact);
            await settle();
            const overflow = await page.locator('.tm-body--kanban').evaluate(el=>{
                const before=el.scrollLeft;el.scrollLeft=el.scrollWidth;
                return {overflow:el.scrollWidth>el.clientWidth,moved:el.scrollLeft>before};
            });
            assert.deepEqual(overflow,{overflow:true,moved:true},'new appearance permits horizontal scrolling, including compact fixed-width columns');
            assert.equal(await page.locator('.tm-kanban-col-body').first().evaluate(el=>getComputedStyle(el).paddingLeft),'10px','compact and normal modes retain 10px inset');
        }
        await page.setViewportSize({width:1200,height:800});
        await page.evaluate(()=>{kanbanTest.SettingsStore.data.kanbanCompactMode=false;kanbanTest.SettingsStore.data.kanbanFillColumns=true;kanbanTest.mount();});
        const second = page.locator('.tm-kanban-col[data-col-key="doc:20261012000000-bbbbbbb"]');
        const titleBefore = await second.locator('.tm-kanban-col-header:not(.tm-kanban-col-header--collapsed)').boundingBox();
        await second.locator('.tm-kanban-col-body').evaluate(el=>{el.scrollTop=400;});
        await settle();
        const top = await second.locator('.tm-kanban-col-body').evaluate(el=>el.scrollTop);
        assert.ok(top>0, 'long column scrolls independently');
        assert.equal((await second.locator('.tm-kanban-col-header:not(.tm-kanban-col-header--collapsed)').boundingBox()).y, titleBefore.y);
        await page.evaluate(() => {
            const completed = kanbanTest.state.flatTasks.complete;
            completed.done = false;
            kanbanTest.invalidateProgress(completed.root_id);
            __tmTaskStore.acceptAuthoritative([{...completed}], {replaceStructure:true});
            kanbanTest.applyFilters();
            kanbanTest.patch(['complete']);
        });
        await settle();
        assert.equal(await first.locator('.tm-kanban-col-progress').getAttribute('aria-valuenow'), '50', 'local completion refresh updates project progress');
        assert.equal(await second.locator('.tm-kanban-col-body').evaluate(el=>el.scrollTop), top, 'unrelated column scroll is preserved');
        await page.evaluate(() => {
            kanbanTest.state.showCompletedTasks = true;
            kanbanTest.applyFilters(); kanbanTest.mount();
        });
        assert.equal(await first.locator('.tm-kanban-col-progress').getAttribute('aria-valuenow'), '50', 'display toggle does not change project progress');
        await page.evaluate(() => { kanbanTest.state.searchKeyword='需求评审';kanbanTest.applyFilters();kanbanTest.mount(); });
        assert.equal(await page.locator('.tm-kanban-col-progress').first().getAttribute('aria-valuetext'), '项目进度 50%', 'project progress follows homepage scope rather than search-card count');
        await page.evaluate(() => {kanbanTest.state.searchKeyword='';kanbanTest.SettingsStore.data.kanbanBoardMode='status';kanbanTest.applyFilters();kanbanTest.mount();});
        assert.equal(await page.locator('.tm-kanban-col-progress').count(), 0, 'status board has no completion statistics');
        await page.evaluate(() => {kanbanTest.SettingsStore.data.kanbanBoardMode='time';kanbanTest.applyFilters();kanbanTest.mount();});
        assert.equal(await page.locator('.tm-kanban-col-progress').count(), 0, 'time board has no completion statistics');
        await page.evaluate(() => {kanbanTest.SettingsStore.data.kanbanBoardMode='heading';kanbanTest.applyFilters();kanbanTest.mount();});
        await first.locator('.tm-kanban-col-collapse').first().click();
        assert.ok((await first.getAttribute('class')).includes('tm-kanban-col--collapsed'));
        assert.equal(await first.evaluate(el=>getComputedStyle(el.querySelector('.tm-kanban-col-header--collapsed')).borderRadius), '0px');
        await settle();
        const collapsedHeight = await first.evaluate(el => {
            const height = el.getBoundingClientRect().height;
            const header = el.querySelector('.tm-kanban-col-header--collapsed').getBoundingClientRect().height;
            const progress = el.querySelector('.tm-kanban-col-progress').getBoundingClientRect().height;
            return { height, contentHeight: header + progress, boardHeight: el.parentElement.clientHeight };
        });
        assert.ok(collapsedHeight.height < collapsedHeight.boardHeight, 'collapsed lane follows its contents rather than filling the board');
        assert.equal(collapsedHeight.height, collapsedHeight.contentHeight, 'no unused vertical space remains below collapsed content');
        await page.setViewportSize({width:1200,height:1000});
        await settle();
        assert.equal(await first.evaluate(el=>el.getBoundingClientRect().height), collapsedHeight.height, 'collapsed height does not grow with the viewport');
        const railBottom = await first.evaluate(el => {
            const canvas = el.parentElement.querySelector('.tm-kanban-lane-background canvas');
            const origin = el.parentElement.getBoundingClientRect();
            const rect = el.getBoundingClientRect();
            const x = Math.floor((rect.left - origin.left + rect.width / 2) * canvas.width / canvas.clientWidth);
            const pixel = y => Array.from(canvas.getContext('2d').getImageData(x, Math.floor(y), 1, 1).data);
            return {below:pixel(rect.height + 10),base:pixel(canvas.height - 1)};
        });
        assert.deepEqual(railBottom.below, railBottom.base, 'folded background ends at its actual content height');
        await page.screenshot({path:path.join(root,'output/playwright/kanban-lanes-plugin-collapsed.png')});
        await first.evaluate(el => {
            const board = el.parentElement;
            board.insertBefore(el, board.querySelector('[data-col-key="doc:20261012000000-bbbbbbb"]'));
            el.style.setProperty('--tm-kanban-lane-color', '#6297aa');
            el.previousElementSibling?.style.setProperty('--tm-kanban-lane-color', '#55a89c');
            el.nextElementSibling?.style.setProperty('--tm-kanban-lane-color', '#b6985f');
            document.activeElement?.blur();
        });
        await settle();
        const assertDirectTransitions = async () => {
            const seams = await page.evaluate(() => {
                const canvas = document.querySelector('.tm-kanban-lane-background canvas');
                const board = canvas.parentElement.parentElement;
                const origin = board.getBoundingClientRect().left;
                const scale = canvas.width / canvas.clientWidth;
                const paint = canvas.getContext('2d');
                const pixel = (x,y) => Array.from(paint.getImageData(Math.floor(x * scale),y,1,1).data).slice(0,3);
                const columns = Array.from(board.querySelectorAll(':scope > .tm-kanban-col'));
                return columns.slice(0,-1).flatMap((column,index) => {
                    const a=column.getBoundingClientRect(),b=columns[index+1].getBoundingClientRect();
                    return [16,Math.min(canvas.height-1,Math.floor(Math.min(a.height,b.height)+30))].map(y => ({
                        left:pixel(a.left-origin+a.width/2,y),right:pixel(b.left-origin+b.width/2,y),middle:pixel(b.left-origin,y)
                    }));
                });
            });
            seams.forEach(seam => {
                seam.middle.forEach((channel,index) => {
                    assert.ok(channel>=Math.min(seam.left[index],seam.right[index])-2, 'interpolated seam does not accumulate a dark band');
                    assert.ok(channel<=Math.max(seam.left[index],seam.right[index])+2, 'interpolated seam has no white stripe');
                });
            });
        };
        await assertDirectTransitions();
        await page.screenshot({path:path.join(root,'output/playwright/kanban-lanes-collapsed-boundaries-light.png')});
        const managerStyle = await page.locator('#manager').getAttribute('style');
        await page.locator('#manager').evaluate(el => {
            el.style.setProperty('--tm-bg-color', '#24282a');
            el.style.setProperty('--tm-text-color', '#dce4e7');
            el.style.setProperty('--tm-secondary-text', '#adb9bf');
        });
        await settle();
        await page.screenshot({path:path.join(root,'output/playwright/kanban-lanes-collapsed-boundaries-dark.png')});
        await page.locator('#manager').evaluate((el, style) => el.setAttribute('style', style), managerStyle);
        await second.locator('.tm-kanban-col-collapse').first().click();
        await settle();
        await assertDirectTransitions();
        await second.locator('.tm-kanban-col-collapse--expand').click();
        await settle();
        await page.setViewportSize({width:390,height:844});
        // Mount after resizing so initial snap metrics use the Dock viewport.
        await page.evaluate(()=>{kanbanTest.state.modal.classList.add('tm-modal--dock');kanbanTest.mount();});
        await settle();
        await page.getByRole('tab', {name:'需求规划',exact:true}).click();
        await page.waitForFunction(()=>!document.querySelector('.tm-body--kanban').__tmKanbanSnapAnimRaf);
        assert.ok((await first.getAttribute('class')).includes('tm-kanban-col--collapsed'), 'navigation preserves collapsed state');
        assert.equal(await first.evaluate(el=>el.getBoundingClientRect().height), collapsedHeight.height, 'dock collapsed lane also uses its actual content height');
        await first.locator('.tm-kanban-col-collapse--expand').click();
        await settle();
        try {
            await page.waitForFunction(()=>{
                const body=document.querySelector('.tm-body--kanban');
                const col=body.querySelector('[data-col-key="doc:20261012000000-aaaaaaa"]');
                const a=body.getBoundingClientRect(),b=col.getBoundingClientRect();
                return b.left>=a.left-1 && b.right<=a.right+1;
            });
        } catch (error) {
            console.error('Dock column alignment', await first.evaluate(col=>{
                const body=col.closest('.tm-body--kanban');
                const bounds=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width};};
                return {body:bounds(body),column:bounds(col),scrollLeft:body.scrollLeft,
                    clientWidth:body.clientWidth,snapWidth:body.style.getPropertyValue('--tm-kanban-snap-col-width')};
            }));
            throw error;
        }
        assert.ok(!(await first.getAttribute('class')).includes('tm-kanban-col--collapsed'));
        assert.equal(await first.locator('.tm-kanban-col-body').evaluate(el=>getComputedStyle(el).paddingRight),'10px','dock retains 10px inset');
        await page.screenshot({path:path.join(root,'output/playwright/kanban-lanes-plugin-mobile.png')});
        await page.setViewportSize({width:1200,height:800});
        await page.evaluate(()=>{kanbanTest.state.modal.classList.remove('tm-modal--dock');kanbanTest.mount();});
        await settle();
        await page.screenshot({path:path.join(root,'output/playwright/kanban-lanes-plugin-desktop.png')});
        const columnScroll = await second.locator('.tm-kanban-col-body').evaluate(el=>{el.scrollTop=300;return el.scrollTop;});
        await page.evaluate(async()=>{await updateKanbanAppearance('classic');});
        await settle();
        assert.equal(await second.locator('.tm-kanban-col-body').evaluate(el=>el.scrollTop),columnScroll,'switching appearance retains column scrolling');
        await page.evaluate(async()=>{await updateKanbanAppearance('lanes');});
        await settle();
        assert.equal(await second.locator('.tm-kanban-col-body').evaluate(el=>el.scrollTop),columnScroll,'switching back retains column scrolling');
        await page.screenshot({path:path.join(root,'output/playwright/kanban-lanes-plugin-switch.png')});
        await page.evaluate(()=>{kanbanTest.SettingsStore.data.kanbanAppearance='classic';kanbanTest.applyFilters();kanbanTest.mount();});
        assert.equal(await page.locator('.tm-kanban-lane-background').count(),0,'classic appearance has no new observers/background');
        assert.equal(await page.locator('.tm-kanban-col-progress').count(),0);
        assert.equal(await page.evaluate(()=>kanbanTest.session()),null);
        assert.equal(await first.evaluate(el=>getComputedStyle(el).borderRadius),'10px','classic styling remains');
        await page.evaluate(async()=>{kanbanTest.state.viewMode='list';await updateKanbanAppearance('lanes');});
        assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('tm_kanban_appearance'))),'lanes','setting uses existing persistence');
        await page.evaluate(async()=>{await updateKanbanAppearance('invalid');});
        assert.equal(await page.evaluate(()=>kanbanTest.SettingsStore.data.kanbanAppearance),'lanes','invalid input falls back to default lanes');
        await page.evaluate(()=>{localStorage.setItem('tm_kanban_appearance',JSON.stringify('classic'));kanbanTest.SettingsStore.loadFromLocal();});
        assert.equal(await page.evaluate(()=>kanbanTest.SettingsStore.data.kanbanAppearance),'classic','explicit card-style preference survives local loading');
        await page.evaluate(()=>{localStorage.removeItem('tm_kanban_appearance');delete kanbanTest.SettingsStore.data.kanbanAppearance;kanbanTest.SettingsStore.loadFromLocal();});
        assert.equal(await page.evaluate(()=>kanbanTest.SettingsStore.data.kanbanAppearance),'lanes','old settings without an appearance use lanes');
        await page.evaluate(() => {
            kanbanTest.cleanup();
            kanbanTest.state.modal.remove();
            kanbanTest.state.modal = null;
            kanbanTest.state.viewMode = 'kanban';
            kanbanTest.SettingsStore.data.kanbanBoardMode = 'heading';
            kanbanTest.applyFilters();
            const host = document.createElement('main');
            host.id = 'manager';
            host.style.cssText = 'width:100vw;height:100vh;position:relative;';
            document.body.append(host);
            kanbanTest.setMount(host);
        });
        for (const hostMode of ['tab','dock']) {
            for (const attempt of ['initial','rerender']) {
                const fullRender = await page.evaluate(async ({hostMode,attempt}) => {
                    const host = document.querySelector('#manager');
                    host.dataset.tmHostMode = hostMode;
                    if (attempt === 'initial') {
                        kanbanTest.cleanup();
                        kanbanTest.state.modal?.remove();
                        kanbanTest.state.modal = null;
                    }
                    kanbanTest.render();
                    const sample = () => {
                        const session = kanbanTest.session();
                        if (!session) return null;
                        const column = session.board.querySelector('.tm-kanban-col');
                        const rect = column.getBoundingClientRect();
                        const x = (rect.left - session.board.getBoundingClientRect().left + rect.width / 2) * session.canvas.width / session.canvas.clientWidth;
                        const pixel = Array.from(session.canvas.getContext('2d').getImageData(Math.floor(x),16,1,1).data);
                        const savedColor = session.colorProbe.style.color;
                        session.colorProbe.style.color = 'var(--tm-bg-color)';
                        const base = getComputedStyle(session.colorProbe).color;
                        session.colorProbe.style.color = savedColor;
                        return {connected:session.board.isConnected,pixel,base};
                    };
                    const initial = sample();
                    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                    return {initial,settled:sample()};
                },{hostMode,attempt});
                for (const sample of [fullRender.initial,fullRender.settled]) {
                    assert.ok(sample?.connected,`${hostMode} ${attempt}: the full shell renderer retains a live background session`);
                    assert.equal(sample.pixel[3],255,`${hostMode} ${attempt}: background is painted on mount`);
                    assert.notEqual(`rgb(${sample.pixel.slice(0,3).join(', ')})`,sample.base,`${hostMode} ${attempt}: mounted columns retain their tint`);
                }
            }
        }
        assert.deepEqual(errors,[]);
        console.log('kanban appearance browser tests passed');
    } finally {
        await browser.close();
        await new Promise(resolve=>server.close(resolve));
    }
})().catch(error=>{console.error(error);process.exitCode=1;});
