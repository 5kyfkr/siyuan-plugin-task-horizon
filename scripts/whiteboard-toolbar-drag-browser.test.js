'use strict';

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('src/task-horizon/manifest.main.json'));
// Isolated UI fixture with synthetic membership. The real license runtime is not loaded.
let runtime = manifest.scripts.map(file => file === 'main/08-license-runtime.js' ? `
    window.syntheticEntitlementChecks = [];
    window.tmRequireFullFeature = feature => { syntheticEntitlementChecks.push(feature); return true; };
` : read('src/task-horizon/' + file)).join('\n');
const startup = runtime.lastIndexOf("    if (document.readyState === 'loading') {");
assert.ok(startup > 0);
runtime = runtime.slice(0, startup) + `
    window.toolbarTest = {
        state, SettingsStore, WhiteboardStore,
        docId: '20261025000000-aaaaaaa',
        board: () => __tmGetWhiteboardGlobalBoardState('work'),
        closeEditor: __tmCloseWhiteboardNoteEditor,
        mount() {
            state.whiteboardToolDragCleanup?.();
            state.renderWhiteboardBodyHtml = () => __tmBuildRenderSceneWhiteboardBodyHtml({isMobile: innerWidth < 500});
            state.modal.innerHTML = state.renderWhiteboardBodyHtml();
            __tmBindWhiteboardViewportInput(state.modal);
            __tmApplyWhiteboardTransform();
        },
        reset({zoom = 1, global = true, tool = 'pan'} = {}) {
            this.closeEditor({save:false});
            const docId = this.docId;
            Object.assign(SettingsStore.data, {
                currentGroupId:'work', selectedDocIds:[docId], newTaskDocId:'',
                docGroups:[{id:'work',name:'测试工作组',docIds:[docId]}],
                docTabsManualArchiveOnly:true, whiteboardAllTabsLayoutMode:'global',
                whiteboardTool:tool, whiteboardCardFields:[],
                whiteboardPlacedTaskIds:{member:true}, whiteboardNodePos:{member:{x:260,y:160}},
                whiteboardNotes:[], whiteboardFrames:[], whiteboardView:{x:30,y:25,zoom},
            });
            const task = {id:'member',root_id:docId,content:'合成测试任务',done:false,children:[]};
            state.taskTree=[{id:docId,name:'测试白板',tasks:[task]}];
            state.allDocuments=state.taskTree.slice();state.flatTasks={member:task};
            state.__tmLoadedDocIdsForTasks=[docId];
            state.__tmGlobalWhiteboardAuthoritativeScope={groupId:'work',docIds:[docId],complete:true};
            __tmTaskStore.acceptAuthoritative([task],{replaceAll:true,replaceDocuments:true,docIds:[docId],replaceStructure:true});
            Object.assign(state,{viewMode:'whiteboard',activeDocId:global?'all':docId,
                searchKeyword:'',filterRules:[],rule:{},showCompletedTasks:false,otherBlocks:[],
                whiteboardHistoryUndoStack:[],whiteboardSuppressClickUntil:0,
                whiteboardSelectedTaskId:'',whiteboardSelectedNoteId:'',whiteboardSelectedFrameId:''});
            __tmSetWhiteboardGlobalBoardState('work',{
                placedTaskIds:{member:true},nodePos:{member:{docId,x:260,y:160}},
                notes:[],frames:[],view:{x:30,y:25,zoom},
            },{keepEmpty:true});
            syntheticEntitlementChecks.length=0;
            applyFilters();this.mount();
        }
    };
    SettingsStore.loaded=true;SettingsStore.save=async()=>{};
    WhiteboardStore.loaded=true;WhiteboardStore.scheduleSave=()=>{};
    render=()=>toolbarTest.mount();
})();`;

(async () => {
    const server = http.createServer((_req,res) => {
        res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><body></body></html>');
    });
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
    const browser = await chromium.launch({headless:true});
    const page = await browser.newPage({viewport:{width:1280,height:820},hasTouch:true});
    page.setDefaultTimeout(7000);
    const errors = [];
    const output = path.join(root,'output/playwright/whiteboard-toolbar-drag');
    fs.mkdirSync(output,{recursive:true});
    page.on('pageerror',error => errors.push(error.message));
    const tool = name => page.locator(`[data-tm-whiteboard-create-tool="${name}"]`);
    const reset = options => page.evaluate(options => toolbarTest.reset(options),options);
    const target = () => page.locator('#tmWhiteboardViewport').evaluate(node => {
        const r=node.getBoundingClientRect();return {x:r.left+r.width*0.56,y:r.top+r.height*0.38};
    });
    const begin = async (name, point) => {
        const r=await tool(name).boundingBox();
        await page.mouse.move(r.x+r.width/2,r.y+r.height/2);
        await page.mouse.down();await page.mouse.move(point.x,point.y,{steps:8});
    };
    const previewPosition = () => page.locator('.tm-whiteboard-tool-preview').evaluate(node => ({x:parseFloat(node.style.left),y:parseFloat(node.style.top)}));
    try {
        await page.goto('http://127.0.0.1:'+server.address().port);
        await page.route('**/api/**',route => route.fulfill({json:{code:0,data:[]}}));
        await page.addStyleTag({content:read('task-horizon.css')+'body{margin:0}#manager{position:relative;width:100vw;height:100vh}.tm-body{height:100%;box-sizing:border-box}'});
        await page.addScriptTag({content:runtime});
        await page.evaluate(() => {
            const host=document.createElement('main');host.id='manager';host.className='tm-modal';
            host.style.cssText='--tm-bg-color:#f8fafb;--tm-header-bg:#eef2f4;--tm-text-color:#29353b;--tm-secondary-text:#64747b;--tm-primary-color:#307baa;--tm-border-color:#d6dfe3;--tm-font-size:14px;font:14px/1.5 sans-serif;';
            document.body.append(host);toolbarTest.state.modal=host;
        });
        await reset();
        assert.equal(await page.locator('[data-tm-whiteboard-create-tool]').count(),3);
        await tool('text').click();
        assert.equal(await page.evaluate(() => toolbarTest.SettingsStore.data.whiteboardTool),'text');
        assert.equal(await page.locator('.tm-whiteboard-note-editor').count(),0);
        assert.equal(await page.evaluate(() => toolbarTest.state.whiteboardToolDragCleanup),null);

        for (const global of [true,false]) {
            for (const zoom of [0.5,1,2]) {
                await reset({global,zoom});
                const point=await target();await begin('text',point);
                const expected=await previewPosition();
                assert.equal(await page.evaluate(() => toolbarTest.state.whiteboardHistoryUndoStack.length),0,'preview must not persist data');
                await page.mouse.up();
                const input=page.locator('.tm-whiteboard-note-editor');
                await input.fill('定位测试');await input.press('Enter');
                const notes=await page.evaluate(global => global?toolbarTest.board().notes:toolbarTest.SettingsStore.data.whiteboardNotes,global);
                assert.equal(notes.length,1,'one gesture must create exactly one note');
                assert.deepEqual({x:notes[0].x,y:notes[0].y},expected,'saved position must match preview at every zoom');
                assert.equal(await page.evaluate(() => toolbarTest.SettingsStore.data.whiteboardTool),'pan');
                await page.keyboard.press('Control+z');
                assert.equal(await page.locator('.tm-whiteboard-note[data-note-id]').count(),0);
            }
        }

        await reset();await begin('sticky',await target());
        const stickyPosition=await previewPosition();await page.mouse.up();
        await page.locator('[data-tm-sticky-title]').fill('合成便利贴');
        await page.locator('[data-tm-sticky-title]').press('Enter');
        await page.locator('[data-tm-sticky-text]').press('Control+Enter');
        const sticky=await page.evaluate(() => toolbarTest.board().notes);
        assert.equal(sticky.length,1);assert.equal(sticky[0].type,'sticky');
        assert.deepEqual({x:sticky[0].x,y:sticky[0].y},stickyPosition);
        assert.deepEqual(await page.evaluate(() => syntheticEntitlementChecks),Array(3).fill('whiteboard-sticky'),'start, creation and save must share the existing membership check');

        await reset();await begin('text',await target());await page.mouse.up();
        await page.locator('.tm-whiteboard-note-editor').fill('保留未保存的文字');
        const next=await target();next.x+=180;
        await begin('sticky',next);await page.mouse.up();
        await page.locator('[data-tm-sticky-title]').fill('接着创建便利贴');
        await page.locator('[data-tm-sticky-title]').press('Enter');
        await page.locator('[data-tm-sticky-text]').press('Control+Enter');
        assert.deepEqual(await page.evaluate(() => toolbarTest.board().notes.map(note=>note.title||note.text)),['保留未保存的文字','接着创建便利贴']);

        for (const global of [true,false]) {
            for (const name of ['text','sticky']) {
                for (const surface of ['canvas','task']) {
                    await reset({global});await begin(name,await target());await page.mouse.up();
                    const content=`外部保存-${name}-${surface}`;
                    const input=page.locator(name==='text'?'.tm-whiteboard-note-editor':'[data-tm-sticky-title]');
                    await input.fill(content);
                    if (name==='sticky') {
                        await page.locator('[data-tm-sticky-text]').fill('正文');
                        assert.equal(await page.evaluate(global=>global?toolbarTest.board().notes.length:toolbarTest.SettingsStore.data.whiteboardNotes.length,global),0,'moving focus inside the editor must keep the draft open');
                    }
                    const box=await page.locator(surface==='task'?'.tm-whiteboard-node[data-task-id="member"]':'#tmWhiteboardViewport').boundingBox();
                    const outside=surface==='task'?{x:box.x+4,y:box.y+box.height/2}:{x:box.x+80,y:box.y+box.height*0.75};
                    await page.mouse.click(outside.x,outside.y);
                    await page.waitForFunction(()=>toolbarTest.state.whiteboardNoteEditor===null);
                    const notes=await page.evaluate(global=>global?toolbarTest.board().notes:toolbarTest.SettingsStore.data.whiteboardNotes,global);
                    assert.equal(notes.length,1,'an outside click in pan mode must save exactly once');
                    assert.equal(notes[0].title||notes[0].text,content);
                    assert.equal(await page.evaluate(()=>toolbarTest.SettingsStore.data.whiteboardTool),'pan');
                    assert.equal(await page.evaluate(()=>toolbarTest.state.whiteboardHistoryUndoStack.length),1);
                }
            }
        }

        await reset();
        const card=await page.locator('.tm-whiteboard-node[data-task-id="member"]').boundingBox();
        await begin('frame',{x:card.x+card.width/2,y:card.y+card.height/2});
        await page.screenshot({path:path.join(output,'desktop-frame-preview.png')});
        const framePosition=await previewPosition();await page.mouse.up();
        const frames=await page.evaluate(() => toolbarTest.board().frames);
        assert.equal(frames.length,1);assert.equal(frames[0].w,480);assert.equal(frames[0].h,320);
        assert.deepEqual({x:frames[0].x,y:frames[0].y},framePosition);
        assert.ok(frames[0].memberTaskIds.includes('member'),'toolbar frames must reuse normal frame ownership');
        assert.deepEqual(await page.evaluate(() => syntheticEntitlementChecks),Array(2).fill('whiteboard-frame'));
        await page.waitForFunction(()=>Date.now()>toolbarTest.state.whiteboardSuppressClickUntil);
        const viewport=await page.locator('#tmWhiteboardViewport').boundingBox();
        await page.mouse.click(viewport.x+70,viewport.y+viewport.height*0.7);
        assert.equal(await page.evaluate(()=>toolbarTest.state.whiteboardSelectedFrameId),'');
        const frame=page.locator('.tm-whiteboard-frame[data-frame-id]');
        const unselected=await frame.boundingBox();
        const beforePan=await page.evaluate(()=>({view:toolbarTest.board().view,task:toolbarTest.board().nodePos.member}));
        await page.mouse.move(unselected.x+20,unselected.y+290);await page.mouse.down();
        await page.mouse.move(unselected.x+50,unselected.y+300,{steps:6});await page.mouse.up();
        const panned=await page.evaluate(()=>toolbarTest.board());
        assert.deepEqual({x:panned.frames[0].x,y:panned.frames[0].y},framePosition,'dragging an unselected frame must leave its stored position unchanged');
        assert.deepEqual(panned.nodePos.member,beforePan.task);
        assert.deepEqual({x:panned.view.x,y:panned.view.y},{x:beforePan.view.x+30,y:beforePan.view.y+10},'dragging an unselected frame must pan the canvas');
        assert.equal(await page.evaluate(()=>toolbarTest.state.whiteboardSelectedFrameId),'','panning must not select a frame on release');
        await frame.click({position:{x:20,y:290}});
        assert.equal(await page.evaluate(()=>toolbarTest.state.whiteboardSelectedFrameId),frames[0].id,'pan mode must select a frame');
        const beforeMove=await page.evaluate(()=>({view:toolbarTest.board().view,task:toolbarTest.board().nodePos.member}));
        const frameBox=await frame.boundingBox();
        await page.mouse.move(frameBox.x+20,frameBox.y+290);await page.mouse.down();
        await page.mouse.move(frameBox.x+80,frameBox.y+330,{steps:6});await page.mouse.up();
        const moved=await page.evaluate(()=>toolbarTest.board());
        assert.deepEqual({x:moved.frames[0].x,y:moved.frames[0].y},{x:frames[0].x+60,y:frames[0].y+40});
        assert.deepEqual(moved.view,beforeMove.view,'moving a frame must leave the viewport in place');
        assert.deepEqual({x:moved.nodePos.member.x,y:moved.nodePos.member.y},{x:beforeMove.task.x+60,y:beforeMove.task.y+40});
        await page.keyboard.press('Control+z');
        assert.deepEqual(await page.evaluate(()=>({x:toolbarTest.board().frames[0].x,y:toolbarTest.board().frames[0].y})),framePosition);
        await page.keyboard.press('Control+z');
        assert.equal(await page.locator('.tm-whiteboard-frame[data-frame-id]').count(),0);

        // Cancellation stays effective even if the pointer is held after pressing Escape.
        await reset({tool:'text'});await begin('text',await target());
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.tm-whiteboard-tool-preview').count(),0);
        await page.waitForTimeout(350);await page.mouse.up();
        assert.equal(await page.locator('.tm-whiteboard-note-editor').count(),0);
        assert.equal(await page.evaluate(() => toolbarTest.state.whiteboardToolDragCleanup),null);

        await reset();
        const sidebar=await page.locator('.tm-whiteboard-sidebar').boundingBox();
        await begin('frame',{x:sidebar.x+30,y:sidebar.y+100});await page.mouse.up();
        assert.equal(await page.evaluate(() => toolbarTest.board().frames.length),0);
        assert.equal(await page.locator('.tm-whiteboard-tool-preview').count(),0);
        await begin('text',await target());
        await page.mouse.move(-10,-10);await page.mouse.up();
        assert.equal(await page.locator('.tm-whiteboard-note-editor').count(),0);

        await reset();await begin('frame',await target());
        await page.evaluate(() => toolbarTest.mount());await page.mouse.up();
        assert.equal(await page.locator('.tm-whiteboard-tool-preview').count(),0);
        assert.equal(await page.evaluate(() => toolbarTest.state.whiteboardToolDragCleanup),null);
        assert.equal(await page.evaluate(() => toolbarTest.board().frames.length),0);

        await page.setViewportSize({width:390,height:844});await reset();
        const touch=await page.context().newCDPSession(page);
        const r=await tool('text').boundingBox(), point=await target();
        await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width/2,y:r.y+r.height/2}]});
        await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point]});
        assert.equal(await page.locator('.tm-whiteboard-tool-preview').count(),1);
        await page.screenshot({path:path.join(output,'mobile-text-preview.png')});
        await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        assert.equal(await page.locator('.tm-whiteboard-note-editor').count(),1);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.tm-whiteboard-note[data-note-id]').count(),0);
        await reset();
        const cancelButton=await tool('frame').boundingBox();
        await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cancelButton.x+cancelButton.width/2,y:cancelButton.y+cancelButton.height/2}]});
        await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point]});
        await touch.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
        assert.equal(await page.locator('.tm-whiteboard-tool-preview').count(),0);
        assert.equal(await page.evaluate(() => toolbarTest.board().frames.length),0);
        assert.equal(await page.evaluate(() => toolbarTest.state.whiteboardToolDragCleanup),null);
        await touch.detach();
        assert.deepEqual(errors,[]);
        console.log('Whiteboard toolbar drag: three element types, zoom/scope, outside-click save, select-before-move frames, canvas pan, undo, ownership, cancellation and touch passed');
    } finally {
        await browser.close();await new Promise(resolve => server.close(resolve));
    }
})().catch(error => {console.error(error);process.exitCode=1;});
