'use strict';

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('src/task-horizon/manifest.main.json'));
let runtime = manifest.scripts.map(file => read('src/task-horizon/' + file)).join('\n');
const startup = runtime.lastIndexOf("    if (document.readyState === 'loading') {");
assert.ok(startup > 0);
runtime = runtime.slice(0, startup) + `
    window.traversalTest = {
        state, SettingsStore, WhiteboardStore, applyFilters,
        setBoard: __tmSetWhiteboardGlobalBoardState, setLinks: __tmSetWhiteboardGlobalTaskLinks,
        getBoard: __tmGetWhiteboardGlobalBoardState, setLocalLinks: __tmSetManualTaskLinks,
        collapsed: __tmKanbanGetCollapsedSet, selection: __tmApplyWhiteboardCardSelectionDom,
        redraw: __tmRenderWhiteboardEdges, transform: __tmApplyWhiteboardTransform,
        setView: __tmSetWhiteboardView, cache: () => __tmWhiteboardTraversalCache?.model,
        mount(options = {}) {
            this.options = options;
            state.renderWhiteboardBodyHtml = () => __tmBuildRenderSceneWhiteboardBodyHtml(options);
            state.modal.innerHTML = state.renderWhiteboardBodyHtml();
            __tmBindWhiteboardViewportInput(state.modal);
            __tmRenderWhiteboardEdges();
        }
    };
    SettingsStore.loaded = true;
    SettingsStore.save = async () => {};
    WhiteboardStore.loaded = true;
    WhiteboardStore.scheduleSave = () => {};
    render = () => traversalTest.mount(traversalTest.options);
})();`;

(async () => {
    const server = http.createServer((_req, res) => {res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><body></body></html>');});
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({headless:true});
    const page = await browser.newPage({viewport:{width:1600,height:950}});
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const output = path.join(root, 'output/playwright/whiteboard-traversal');
    fs.mkdirSync(output, {recursive:true});
    const card = id => page.locator(`.tm-whiteboard-node[data-task-id="${id}"]`);
    const opacity = selector => page.locator(selector).evaluate(node => {
        let value = 1;
        for (let element = node; element; element = element.parentElement) value *= Number(getComputedStyle(element).opacity);
        return Math.round(value * 100) / 100;
    });
    const select = id => page.evaluate(id => tmWhiteboardSelectTask(id, {stopPropagation(){}}), id);
    const toggle = () => page.locator('[data-tm-whiteboard-traverse]').last().click();
    const waitForOpacity = (selector, expected) => page.waitForFunction(({selector,expected}) => {
        let value=1;
        const node=document.querySelector(selector);
        if (!node) return false;
        for (let element=node;element;element=element.parentElement) value*=Number(getComputedStyle(element).opacity);
        return Number(value.toFixed(2))===expected;
    }, {selector,expected});
    try {
        await page.goto('http://127.0.0.1:' + server.address().port);
        await page.route('**/api/**', route => route.fulfill({json:{code:0,data:[]}}));
        await page.addStyleTag({content:read('task-horizon.css') + 'body{margin:0}#manager{position:relative;width:100vw;height:100vh}.tm-body{height:100%;box-sizing:border-box}'});
        await page.addScriptTag({content:runtime});
        await page.evaluate(() => {
            const test = traversalTest, {state,SettingsStore:store} = test;
            const host = document.createElement('main');host.id='manager';host.className='tm-modal';
            host.style.cssText='--tm-bg-color:#f8fafb;--tm-header-bg:#eef2f4;--tm-text-color:#29353b;--tm-secondary-text:#64747b;--tm-primary-color:#307baa;--tm-border-color:#d6dfe3;--card:#fafcfd;--card-foreground:#29353b;--tm-font-size:14px;font:14px/1.5 sans-serif;';
            document.body.append(host);state.modal=host;
            const docId='20261024000000-aaaaaaa';
            const names={A:'需求准备',B:'核心开发',C:'联调验收',D:'接口确认',E:'上线交付',G:'资源准备',F:'其他项目',X:'其他输入',P:'日常事项',T:'关联子任务',U:'无关子任务',Z:'独立任务'};
            const tasks=Object.entries(names).map(([id,content]) => ({id,root_id:docId,content,done:false,children:[]}));
            const byId=Object.fromEntries(tasks.map(task=>[task.id,task]));
            byId.P.children=[byId.T,byId.U];byId.T.parentTaskId='P';byId.U.parentTaskId='P';
            state.taskTree=[{id:docId,name:'项目白板',tasks:tasks.filter(task=>!task.parentTaskId)}];
            state.allDocuments=state.taskTree.slice();state.flatTasks=byId;state.__tmLoadedDocIdsForTasks=[docId];
            state.__tmGlobalWhiteboardAuthoritativeScope={groupId:'work',docIds:[docId],complete:true};
            __tmTaskStore.acceptAuthoritative(tasks,{replaceAll:true,replaceDocuments:true,docIds:[docId],replaceStructure:true});
            Object.assign(store.data,{currentGroupId:'work',newTaskDocId:'',selectedDocIds:[docId],whiteboardTool:'pan',whiteboardAllTabsLayoutMode:'global',whiteboardDrawingToolsEnabled:true,
                docGroups:[{id:'work',name:'工作',docIds:[docId]}],docTabsManualArchiveOnly:true,whiteboardCardFields:[]});
            Object.assign(state,{viewMode:'whiteboard',activeDocId:'all',searchKeyword:'',filterRules:[],rule:{},showCompletedTasks:false,otherBlocks:[]});
            const positions={A:[24,100],D:[24,260],G:[24,420],B:[360,260],C:[690,260],E:[1020,260],F:[360,600],X:[690,100],P:[1020,470],Z:[690,600]};
            test.links=[['A','B'],['D','B'],['G','B'],['B','C'],['C','E'],['A','F'],['X','C'],['B','T']].map(([from,to])=>({id:from+'-'+to,from,to,docId}));
            test.docId=docId;
            test.setBoard('work',{placedTaskIds:Object.fromEntries(tasks.map(task=>[task.id,true])),
                nodePos:Object.fromEntries(Object.entries(positions).map(([id,[x,y]])=>[id,{docId,x,y}])),
                notes:[{id:'note',docId:'__tm_global_whiteboard__',text:'项目备注',x:24,y:620,width:240,height:90}],
                frames:[{id:'frame',docId:'__tm_global_whiteboard__',name:'参考分组',x:5,y:60,w:300,h:500}],
                drawings:[{id:'stroke',docId:'__tm_global_whiteboard__',points:[[50,750],[250,750]],color:'#4d85a4',width:4}],
                view:{x:20,y:20,zoom:0.8}}, {keepEmpty:true});
            test.setLinks(test.links,'work');test.applyFilters();test.mount();
        });
        await select('B');
        assert.equal(await page.locator('[data-tm-whiteboard-traverse]').last().innerText(),'遍历关联');
        assert.deepEqual(await page.locator('.tm-whiteboard-card-tools').last().locator('button').allTextContents(),['遍历关联','移除']);
        const before = await page.evaluate(() => JSON.stringify(traversalTest.getBoard('work')));
        await toggle();
        const tasks = await page.evaluate(() => [...traversalTest.cache().taskIds].sort());
        assert.deepEqual(tasks,['A','B','C','D','E','G','T']);
        assert.equal(await opacity('.tm-whiteboard-node[data-task-id="D"]'),1);
        assert.equal(await opacity('.tm-whiteboard-node[data-task-id="G"]'),1);
        assert.equal(await opacity('.tm-whiteboard-node[data-task-id="F"]'),0.24);
        assert.equal(await opacity('.tm-whiteboard-node[data-task-id="X"]'),0.24);
        assert.equal(await opacity('.tm-whiteboard-node[data-task-id="T"]'),1,'a related subtask must remain clear inside an unrelated parent');
        assert.equal(await opacity('.tm-whiteboard-node[data-task-id="P"] > .tm-kanban-card-top'),0.24);
        assert.equal(await opacity('.tm-whiteboard-node[data-task-id="U"]'),0.24);
        for (const selector of ['.tm-whiteboard-note','.tm-whiteboard-frame','.tm-whiteboard-drawing-layer']) assert.equal(await opacity(selector),0.24,selector);
        assert.equal(await opacity('.tm-whiteboard-sidebar'),1);
        assert.equal(await opacity('.tm-whiteboard-bottom-toolbar'),1);
        assert.equal(await opacity('.tm-whiteboard-edge[data-link-id="A-F"]'),0.24);
        assert.equal(await opacity('.tm-whiteboard-edge[data-link-id="B-T"]'),0.9,'subtask SVG edges must stay clear');
        assert.equal(await page.evaluate(() => JSON.stringify(traversalTest.getBoard('work'))),before,'traversal must not write board data');
        await page.screenshot({path:path.join(output,'desktop.png')});
        await page.evaluate(() => {
            window.savedTraversalModel=traversalTest.cache();
            traversalTest.setView({x:30,y:30,zoom:0.75},{persist:false,syncLocal:false});traversalTest.transform();
        });
        await page.evaluate(() => new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        assert.equal(await page.evaluate(() => savedTraversalModel===traversalTest.cache()),true,'pan and zoom must reuse the graph result');

        // A drag on the empty canvas must not be interpreted as an exit click.
        const viewport=await page.locator('#tmWhiteboardViewport').boundingBox();
        await page.mouse.move(viewport.x+100,viewport.y+viewport.height-65);
        await page.mouse.down();await page.mouse.move(viewport.x+150,viewport.y+viewport.height-50,{steps:4});await page.mouse.up();
        assert.equal(await page.evaluate(() => traversalTest.state.whiteboardTraversal?.taskId),'B');
        await page.evaluate(() => {traversalTest.state.whiteboardPluginFullscreen=true;});
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => traversalTest.state.whiteboardPluginFullscreen),true,'Escape must exit traversal before exiting fullscreen');
        await page.evaluate(() => {traversalTest.state.whiteboardPluginFullscreen=false;});
        assert.equal(await opacity('.tm-whiteboard-node[data-task-id="F"]'),1);
        assert.equal(await page.locator('.tm-whiteboard-traversal-exit').isVisible(),false);
        await toggle();await toggle();
        assert.equal(await page.evaluate(() => traversalTest.state.whiteboardTraversal),null,'the card button must also exit traversal');

        await toggle();
        await page.evaluate(() => tmWhiteboardToggleTaskCollapse('P'));
        await waitForOpacity('.tm-whiteboard-edge[data-link-id="B-T"]',0.9);
        await waitForOpacity('.tm-whiteboard-node[data-task-id="P"]',1);
        assert.equal(await card('T').count(),0);
        assert.equal(await opacity('.tm-whiteboard-node[data-task-id="P"]'),1,'a collapsed parent must represent its related endpoint');
        assert.equal(await opacity('.tm-whiteboard-edge[data-link-id="B-T"]'),0.9);
        await page.evaluate(() => tmWhiteboardToggleTaskCollapse('P'));
        await waitForOpacity('.tm-whiteboard-node[data-task-id="T"]',1);
        assert.equal(await opacity('.tm-whiteboard-node[data-task-id="T"]'),1);
        await select('D');
        assert.equal(await page.evaluate(() => traversalTest.state.whiteboardTraversal.taskId),'D');
        assert.equal(await opacity('.tm-whiteboard-node[data-task-id="A"]'),0.24,'changing origin must not retain another predecessor of B');
        await page.mouse.click(viewport.x+200,viewport.y+viewport.height-180);
        assert.equal(await page.evaluate(() => traversalTest.state.whiteboardTraversal),null,'a blank canvas click must exit traversal');
        await select('D');await toggle();

        await page.locator('.tm-whiteboard-traversal-exit').click();
        await select('Z');await toggle();
        assert.equal(await page.evaluate(() => traversalTest.state.whiteboardTraversal),null,'an isolated task must leave the board undimmed');
        await select('B');await toggle();
        await page.evaluate(() => {traversalTest.setLinks(traversalTest.links.filter(link=>link.id!=='G-B'),'work');traversalTest.redraw();});
        assert.equal(await opacity('.tm-whiteboard-node[data-task-id="G"]'),0.24,'changing links must invalidate traversal');
        await page.evaluate(() => document.querySelector('.tm-hint')?.click());
        await page.locator('.tm-hint').waitFor({state:'detached'});

        for (const width of [820,390]) {
            await page.setViewportSize({width,height:844});
            await page.evaluate(width => traversalTest.mount({isMobile:width<500}),width);
            assert.equal(await page.locator('.tm-whiteboard-traversal-exit').isVisible(),true);
            await page.screenshot({path:path.join(output,`${width<500?'mobile':'tablet'}.png`)});
        }
        await page.evaluate(() => {traversalTest.state.activeDocId=traversalTest.docId;traversalTest.mount();});
        assert.equal(await page.evaluate(() => traversalTest.state.whiteboardTraversal),null,'switching boards must clear the mode');
        // The document board uses its own links, rather than the global board graph.
        await page.evaluate(() => {
            const test=traversalTest;
            test.SettingsStore.data.whiteboardPlacedTaskIds={A:true,B:true,D:true};
            test.SettingsStore.data.whiteboardNodePos={A:{x:24,y:60},B:{x:360,y:60},D:{x:24,y:260}};
            test.setLocalLinks([{id:'local',from:'A',to:'B',docId:test.docId}]);test.mount({isMobile:true});
        });
        await select('B');
        await page.evaluate(() => traversalTest.selection('B'));
        assert.deepEqual(await page.locator('.tm-whiteboard-card-tools[data-tm-wb-dyn="1"] button').allTextContents(),['遍历关联','移除'],'dynamic selection must use the same button order');
        await page.evaluate(() => tmWhiteboardToggleTraversal('B'));
        assert.deepEqual(await page.evaluate(() => [...traversalTest.cache().taskIds].sort()),['A','B']);
        assert.equal(await opacity('.tm-whiteboard-node[data-task-id="D"]'),0.24);
        await page.evaluate(() => tmWhiteboardDeleteCard('B',traversalTest.docId));
        assert.equal(await page.evaluate(() => traversalTest.state.whiteboardTraversal),null,'removing the origin must restore the board');
        await page.evaluate(() => {
            const test=traversalTest;
            test.setLocalLinks([{id:'local-next',from:'A',to:'D',docId:test.docId}]);test.mount({isMobile:true});
            tmWhiteboardSelectTask('A',{stopPropagation(){}});tmWhiteboardToggleTraversal('A');
            tmSwitchViewMode('list');
        });
        assert.equal(await page.evaluate(() => traversalTest.state.whiteboardTraversal),null,'leaving whiteboard view must clear traversal');
        await page.evaluate(() => {
            traversalTest.state.viewMode='whiteboard';traversalTest.mount({isMobile:true});
            tmWhiteboardSelectTask('A',{stopPropagation(){}});tmWhiteboardToggleTraversal('A');
            tmClose();
        });
        assert.equal(await page.evaluate(() => traversalTest.state.whiteboardTraversal),null,'closing the manager must clear traversal');
        assert.equal(await page.evaluate(() => traversalTest.state.modal),null);
        assert.deepEqual(errors,[],'traversal must not report browser errors');
        console.log('whiteboard traversal browser behavior tests passed (desktop, tablet, mobile)');
    } finally {
        await browser.close();
        await new Promise(resolve=>server.close(resolve));
    }
})().catch(error=>{console.error(error);process.exitCode=1;});
