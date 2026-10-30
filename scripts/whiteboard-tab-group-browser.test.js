'use strict';

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const {chromium} = require('./i18n-browser-fixture');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('src/task-horizon/manifest.main.json'));
let runtime = manifest.scripts.map(file => read('src/task-horizon/' + file)).join('\n');
const startup = runtime.lastIndexOf("    if (document.readyState === 'loading') {");
assert.ok(startup > 0);
runtime = runtime.slice(0, startup) + `
    window.whiteboardTest = {
        state, SettingsStore, WhiteboardStore, applyFilters,
        key: __tmBuildDocTabCustomGroupActiveId,
        setBoard: __tmSetWhiteboardGlobalBoardState,
        setLinks: __tmSetWhiteboardGlobalTaskLinks,
        getBoard: __tmGetWhiteboardGlobalBoardState,
        outline: __tmBuildWhiteboardTaskOutlineModel,
        timelineLinks: __tmGetTimelineDependencyLinks,
        view: __tmGetWhiteboardView, setView: __tmSetWhiteboardView,
        scene: __tmBuildRenderSceneContext,
        mount(options = {}) {
            this.options = options;
            state.renderWhiteboardBodyHtml = () => __tmBuildRenderSceneWhiteboardBodyHtml(options);
            state.modal.innerHTML = state.renderWhiteboardBodyHtml();
            __tmBindWhiteboardViewportInput(state.modal);
        }
    };
    SettingsStore.loaded = true;
    SettingsStore.save = async () => SettingsStore.syncToLocal();
    WhiteboardStore.loaded = true;
    WhiteboardStore.scheduleSave = () => {};
    render = () => whiteboardTest.mount(whiteboardTest.options);
})();`;

(async () => {
    const server = http.createServer((_req, res) => {res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><body></body></html>');});
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({headless:true});
    const page = await browser.newPage({viewport:{width:1280,height:820}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    try {
        await page.goto('http://127.0.0.1:' + server.address().port);
        await page.route('**/api/**', route => route.fulfill({json:{code:0,data:[]}}));
        await page.addStyleTag({content: read('task-horizon.css') + 'body{margin:0}#manager{position:relative;width:100vw;height:100vh}.tm-body{height:100%;box-sizing:border-box}'});
        await page.addScriptTag({content:runtime});
        await page.evaluate(() => {
            const {state,SettingsStore:store} = whiteboardTest;
            const host = document.createElement('main');host.id = 'manager';host.className = 'tm-modal';
            host.style.cssText = '--tm-bg-color:#f8fafb;--tm-header-bg:#eef2f4;--tm-text-color:#29353b;--tm-secondary-text:#64747b;--tm-primary-color:#307baa;--tm-border-color:#d6dfe3;--tm-font-size:14px;font:14px/1.5 sans-serif;';
            document.body.append(host);state.modal = host;
            const docIds = ['20261012000000-aaaaaaa','20261012000000-bbbbbbb','20261012000000-ccccccc'];
            const tasks = docIds.map((root_id,index) => ({id:['one','two','three'][index],root_id,content:['共同任务','组 A 任务','组 B 任务'][index],done:false,children:[]}));
            state.taskTree = docIds.map((id,index) => ({id,name:['共同文档','文档 A','文档 B'][index],tasks:[tasks[index]]}));
            state.allDocuments = state.taskTree.slice();
            state.flatTasks = Object.fromEntries(tasks.map(task => [task.id,task]));
            state.__tmLoadedDocIdsForTasks = docIds;
            state.__tmGlobalWhiteboardAuthoritativeScope = {groupId:'parent',docIds,complete:true};
            __tmTaskStore.acceptAuthoritative(tasks,{replaceAll:true,replaceDocuments:true,docIds,replaceStructure:true});
            Object.assign(store.data,{currentGroupId:'parent',newTaskDocId:'',selectedDocIds:docIds,whiteboardAllTabsLayoutMode:'global',
                docGroups:[{id:'parent',name:'工作',docIds}],docTabsManualArchiveOnly:true,
                docTabCustomGroups:[
                    {id:'tabs-a',name:'项目 A',docGroupId:'parent',showInTabBar:true,entries:[{id:docIds[0]},{id:docIds[1]}]},
                    {id:'tabs-b',name:'项目 B',docGroupId:'parent',showInTabBar:true,entries:[{id:docIds[0]},{id:docIds[2]}]}
                ]});
            Object.assign(state,{viewMode:'whiteboard',activeDocId:whiteboardTest.key('tabs-a'),searchKeyword:'',filterRules:[],rule:{},showCompletedTasks:false,otherBlocks:[]});
            const makeBoard = (peer,docId,title,x) => ({placedTaskIds:{one:true,[peer]:true},nodePos:{one:{docId:docIds[0],x:24,y:40},[peer]:{docId,x:380,y:40}},
                notes:[{id:'note-'+peer,docId:'__tm_global_whiteboard__',text:title,x:24,y:210,w:260,h:100}],view:{x,y:40,zoom:1}});
            whiteboardTest.setBoard(whiteboardTest.key('tabs-a'),makeBoard('two',docIds[1],'组 A 便签',60),{keepEmpty:true});
            whiteboardTest.setBoard(whiteboardTest.key('tabs-b'),makeBoard('three',docIds[2],'组 B 便签',120),{keepEmpty:true});
            whiteboardTest.setLinks([{id:'link-a',from:'one',to:'two'}],whiteboardTest.key('tabs-a'));
            whiteboardTest.setLinks([{id:'link-b',from:'one',to:'three'}],whiteboardTest.key('tabs-b'));
            whiteboardTest.applyFilters();whiteboardTest.mount();
        });
        assert.equal(await page.locator('.tm-whiteboard-node[data-task-id="two"]').count(),1);
        assert.equal(await page.locator('.tm-whiteboard-node[data-task-id="three"]').count(),0);
        assert.equal(await page.locator('.tm-whiteboard-note').innerText(),'组 A 便签');
        assert.deepEqual(await page.evaluate(() => whiteboardTest.outline('one',{scope:whiteboardTest.key('tabs-a')}).nodes.map(node=>node.id).sort()),['one','two']);
        assert.deepEqual(await page.evaluate(() => whiteboardTest.outline('one',{scope:whiteboardTest.key('tabs-b')}).nodes.map(node=>node.id).sort()),['one','three']);
        assert.equal(await page.evaluate(() => whiteboardTest.scene({}).showWhiteboardAllTabsModeToggle),true);
        await page.evaluate(() => whiteboardTest.setView({x:222,zoom:1.2}));
        assert.equal(await page.evaluate(() => whiteboardTest.getBoard(whiteboardTest.key('tabs-b')).view.x),120);
        const jumped = await page.evaluate(() => tmJumpToWhiteboardTask('three',null,{scope:whiteboardTest.key('tabs-b')}));
        assert.equal(jumped,true,'detail path jump must activate the chosen tab group');
        assert.equal(await page.evaluate(() => whiteboardTest.state.activeDocId), '__tm_doc_tab_group__:tabs-b');
        assert.equal(await page.locator('.tm-whiteboard-node[data-task-id="three"]').count(),1);
        assert.equal(await page.locator('.tm-whiteboard-note').innerText(),'组 B 便签');
        await page.setViewportSize({width:390,height:844});
        await page.evaluate(() => whiteboardTest.mount({isMobile:true}));
        await page.evaluate(() => tmSetWhiteboardLayoutModeFromMobileMenu('stream'));
        assert.equal(await page.evaluate(() => whiteboardTest.state.activeDocId), '__tm_doc_tab_group__:tabs-b');
        assert.deepEqual(await page.locator('.tm-whiteboard-stream-doc').evaluateAll(nodes => nodes.map(node => node.dataset.docId).sort()), ['20261012000000-aaaaaaa','20261012000000-ccccccc']);
        await page.evaluate(() => tmSetWhiteboardLayoutModeFromMobileMenu('board'));
        assert.equal(await page.locator('.tm-whiteboard-doc-body').count(),2);
        await page.evaluate(() => {
            const {state,SettingsStore:store} = whiteboardTest;
            state.viewMode='timeline';store.data.timelineDependencyScope='tabGroup';
        });
        assert.deepEqual(await page.evaluate(() => whiteboardTest.timelineLinks().map(link=>link.id)),['link-b']);
        await page.evaluate(() => {
            whiteboardTest.state.viewMode='whiteboard';whiteboardTest.SettingsStore.data.whiteboardAllTabsLayoutMode='global';
            whiteboardTest.mount({isDockHost:true});
        });
        assert.equal(await page.locator('.tm-whiteboard-node[data-task-id="three"]').count(),1);
        await page.evaluate(async () => {
            whiteboardTest.state.whiteboardSelectedLinkDocId='__tm_global_whiteboard__';
            await tmWhiteboardRemoveLink('link-b');
        });
        assert.equal(await page.evaluate(() => whiteboardTest.getBoard(whiteboardTest.key('tabs-b')).links.length),0);
        assert.equal(await page.evaluate(() => whiteboardTest.getBoard(whiteboardTest.key('tabs-a')).links[0].id),'link-a');
        await page.evaluate(async () => {
            whiteboardTest.setLinks([{id:'link-b',from:'one',to:'three'}],whiteboardTest.key('tabs-b'));
            await tmWhiteboardClearLinks();
        });
        assert.equal(await page.evaluate(() => whiteboardTest.getBoard(whiteboardTest.key('tabs-b')).links.length),0);
        assert.equal(await page.evaluate(() => whiteboardTest.getBoard(whiteboardTest.key('tabs-a')).links[0].id),'link-a');
        await page.evaluate(() => whiteboardTest.setLinks([{id:'link-b',from:'one',to:'three'}],whiteboardTest.key('tabs-b')));
        await page.evaluate(() => {
            const {state,SettingsStore:store} = whiteboardTest;
            const outside = {id:'unlinked',root_id:state.taskTree[1].id,content:'已移出范围的无连线任务',done:false,children:[]};
            state.flatTasks.unlinked=outside;state.taskTree[1].tasks.push(outside);
            __tmTaskStore.acceptAuthoritative(Object.values(state.flatTasks),{replaceAll:true,replaceDocuments:true,docIds:state.taskTree.map(doc=>doc.id),replaceStructure:true});
            const key=whiteboardTest.key('tabs-a'),board=whiteboardTest.getBoard(key);
            board.placedTaskIds.unlinked=true;board.nodePos.unlinked={docId:outside.root_id,x:24,y:400};
            whiteboardTest.setBoard(key,board,{keepEmpty:true});
            store.data.docTabCustomGroups[0].entries=store.data.docTabCustomGroups[0].entries.slice(0,1);
            state.activeDocId=key;state.__tmCacheFirstPaintNeedsVerify=false;
            whiteboardTest.applyFilters();whiteboardTest.mount({isMobile:true});
        });
        assert.equal(await page.locator('.tm-whiteboard-node[data-task-id="two"]').getAttribute('data-tm-whiteboard-frozen'),'1');
        assert.equal(await page.locator('.tm-whiteboard-node[data-task-id="unlinked"]').count(),0,'retained endpoint documents must not pull unrelated tasks back into the group');
        fs.mkdirSync(path.join(root,'output/tab-group-whiteboard'),{recursive:true});
        await page.screenshot({path:path.join(root,'output/tab-group-whiteboard/mobile-global.png')});
        assert.deepEqual(errors,[],'whiteboard UI must not report browser errors');
        console.log('whiteboard tab-group browser behavior tests passed');
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => {console.error(error);process.exitCode=1;});
