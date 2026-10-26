'use strict';

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('src/task-horizon/manifest.main.json'));
let runtime = manifest.scripts.map(file => read('src/task-horizon/' + file)).join('\n');
const startup = runtime.lastIndexOf("    if (document.readyState === 'loading') {");
assert.ok(startup > 0);
// Isolated synthetic boards; no real documents, persistence or entitlement changes.
runtime = runtime.slice(0, startup) + `
    window.pngTest = {
        state, SettingsStore, WhiteboardStore, hints: [], blobs: [],
        dimensions: __tmWhiteboardPngDimensions,
        renderer: value => {const previous=__tmGetWhiteboardPngRenderer();if(value)__tmWhiteboardPngRenderer=value;return previous;},
        snapshot: () => __tmCreateWhiteboardPngSnapshot(state.modal.querySelector('#tmWhiteboardWorld')),
        setView: __tmSetWhiteboardView, transform: __tmApplyWhiteboardTransform,
        mount() {
            state.renderWhiteboardBodyHtml = () => __tmBuildRenderSceneWhiteboardBodyHtml({isMobile:innerWidth < 500});
            state.modal.innerHTML = state.renderWhiteboardBodyHtml();
            __tmBindWhiteboardViewportInput(state.modal);
            __tmRenderWhiteboardEdges();
        },
        reset({mode='local', dark=false, empty=false}={}) {
            document.documentElement.dataset.frontend=innerWidth<500?'browser-mobile':'browser-desktop';
            const docId='20261025000000-aaaaaaa', otherId='20261025000000-bbbbbbb';
            const tasks = [
                {id:'A',root_id:docId,content:'中文任务：需求梳理',done:false,children:[]},
                {id:'B',root_id:docId,content:'开发与交付',done:false,children:[]},
                {id:'C',root_id:otherId,content:'另一文档的任务',done:false,children:[]},
            ];
            state.taskTree=[{id:docId,name:'测试白板',tasks:tasks.slice(0,2)},{id:otherId,name:'其他文档',tasks:tasks.slice(2)}];
            state.allDocuments=state.taskTree.slice();state.flatTasks=Object.fromEntries(tasks.map(t=>[t.id,t]));
            state.__tmLoadedDocIdsForTasks=[docId,otherId];
            state.__tmGlobalWhiteboardAuthoritativeScope={groupId:'work',docIds:[docId,otherId],complete:true};
            __tmTaskStore.acceptAuthoritative(tasks,{replaceAll:true,replaceDocuments:true,docIds:[docId,otherId],replaceStructure:true});
            const notes = [
                {id:'text',docId,text:'中文备注 PNG',x:-120,y:150,width:230,fontSize:26},
                {id:'sticky',docId,type:'sticky',title:'便利贴标题',text:'保留颜色与内容',theme:'green',x:720,y:-100,width:260},
            ];
            const frames = [{id:'frame',docId,name:'项目分组',backgroundColor:'#dbeafe',x:-220,y:-150,w:1280,h:680}];
            const drawings = [{id:'stroke',docId,d:'M -260 500 L 1080 500',color:'#e53935',width:8,opacity:1,type:'pen'}];
            const nodePos = {A:{docId,x:-180,y:-70},B:{docId,x:400,y:220}};
            Object.assign(SettingsStore.data,{
                currentGroupId:'work',newTaskDocId:'',selectedDocIds:[docId,otherId],whiteboardTool:'pan',
                docGroups:[{id:'work',name:'测试工作组',docIds:[docId,otherId]}],docTabsManualArchiveOnly:true,
                docTabCustomGroups:[{id:'project-a',name:'项目 A',docGroupId:'work',showInTabBar:true,entries:[{id:docId}]}],
                whiteboardAllTabsLayoutMode:'global',whiteboardCardFields:[],whiteboardDrawingToolsEnabled:true,
                whiteboardDrawingConfig:{hidden:false},whiteboardView:{x:35,y:25,zoom:1},
                whiteboardNodePos:nodePos,whiteboardPlacedTaskIds:empty?{}:{A:true,B:true},
                whiteboardNotes:empty?[]:notes,whiteboardFrames:empty?[]:frames,whiteboardDrawings:empty?[]:drawings,
            });
            Object.assign(state,{viewMode:'whiteboard',activeDocId:mode==='local'?docId:(mode==='tabs'?'__tm_doc_tab_group__:project-a':'all'),
                searchKeyword:'',filterRules:[],rule:{},showCompletedTasks:false,otherBlocks:[],whiteboardTraversal:null,
                whiteboardSelectedTaskId:'',whiteboardSelectedNoteId:'',whiteboardSelectedFrameId:'',whiteboardBottomMoreOpen:false,
                whiteboardMultiSelectedTaskIds:[],whiteboardMultiSelectedNoteIds:[],whiteboardMultiSelectedStrokeIds:[]});
            const board = {
                placedTaskIds:empty?{}:{A:true,B:true,C:true},nodePos:{...nodePos,C:{docId:otherId,x:1450,y:220}},
                notes:empty?[]:notes,frames:empty?[]:frames,drawings:empty?[]:drawings,view:{x:35,y:25,zoom:1},
            };
            __tmSetWhiteboardGlobalBoardState('work',board,{keepEmpty:true});
            __tmSetWhiteboardGlobalBoardState('__tm_doc_tab_group__:project-a',{
                ...board,placedTaskIds:empty?{}:{A:true,B:true},
                notes:empty?[]:[{...notes[0],text:'页签组专属备注'}],
            },{keepEmpty:true});
            __tmSetManualTaskLinks(empty?[]:[{id:'link',docId,from:'A',to:'B'}]);
            __tmSetWhiteboardGlobalTaskLinks(empty?[]:[{id:'link',from:'A',to:'B'}],'work');
            __tmSetWhiteboardGlobalTaskLinks(empty?[]:[{id:'link',from:'A',to:'B'}],'__tm_doc_tab_group__:project-a');
            document.documentElement.setAttribute('data-theme-mode',dark?'dark':'light');
            state.modal.style.cssText = dark
                ? '--tm-bg-color:#20262c;--tm-header-bg:#2b333b;--tm-text-color:#e5edf3;--tm-secondary-text:#a4b2bd;--tm-primary-color:#64b5f6;--tm-border-color:#52616c;--card:#2b333b;--card-foreground:#e5edf3;--tm-font-size:14px;font:14px/1.5 sans-serif;'
                : '--tm-bg-color:#f8fafb;--tm-header-bg:#eef2f4;--tm-text-color:#29353b;--tm-secondary-text:#64747b;--tm-primary-color:#307baa;--tm-border-color:#d6dfe3;--card:#fafcfd;--card-foreground:#29353b;--tm-font-size:14px;font:14px/1.5 sans-serif;';
            this.hints=[];this.blobs=[];applyFilters();this.mount();
        }
    };
    SettingsStore.loaded=true;SettingsStore.save=async()=>{};
    WhiteboardStore.loaded=true;WhiteboardStore.scheduleSave=()=>{};
    render=()=>pngTest.mount();
    hint=(message,type)=>pngTest.hints.push({message,type});
    const originalObjectUrl=URL.createObjectURL.bind(URL);
    URL.createObjectURL=blob=>{
        const url=originalObjectUrl(blob);
        if(blob.type==='image/png')pngTest.blobs.push(blob);
        return url;
    };
})();`;

(async () => {
    const server = http.createServer((_req, res) => {
        res.setHeader('Content-Type', 'text/html');
        res.end('<!doctype html><html><body></body></html>');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({headless:true});
    const page = await browser.newPage({viewport:{width:1280,height:820},acceptDownloads:true});
    const output = path.join(root, 'output/playwright/whiteboard-png-export');
    fs.mkdirSync(output, {recursive:true});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(15000);
    const reset = options => page.evaluate(options => pngTest.reset(options), options);
    const exportPng = async (name, fromMenu=false) => {
        const downloadPromise = page.waitForEvent('download');
        if(fromMenu) {
            await page.locator('.tm-whiteboard-bottom-more-panel button').filter({hasText:'导出 PNG'}).click();
            await page.waitForFunction(() => !pngTest.state.whiteboardPngExportPending);
        } else await page.evaluate(() => tmWhiteboardExportPng());
        const download = await downloadPromise;
        const file = path.join(output, name + '.png');
        await download.saveAs(file);
        const bytes = fs.readFileSync(file);
        assert.equal(bytes.subarray(0,8).toString('hex'), '89504e470d0a1a0a');
        assert.equal(await page.locator('[data-tm-whiteboard-export]').count(), 0);
        assert.equal(await page.evaluate(() => pngTest.state.whiteboardPngExportPending), false);
        const pixels = await page.evaluate(async () => {
            const bitmap=await createImageBitmap(pngTest.blobs.at(-1));
            const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
            const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);bitmap.close();
            const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
            let red=0,blue=0,dark=0;
            for(let i=0;i<data.length;i+=4){
                if(data[i]>180&&data[i+1]<100&&data[i+2]<100)red++;
                if(data[i+2]>data[i]+20&&data[i+2]>data[i+1]+10)blue++;
                if(data[i]<110&&data[i+1]<120&&data[i+2]<130)dark++;
            }
            const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data))).map(v=>v.toString(16).padStart(2,'0')).join('');
            return {width:canvas.width,height:canvas.height,background:Array.from(data.slice(0,4)),red,blue,dark,hash};
        });
        return {filename:download.suggestedFilename(),...pixels};
    };
    try {
        await page.goto('http://127.0.0.1:' + server.address().port);
        await page.route('**/api/**', route => route.fulfill({json:{code:0,data:[]}}));
        await page.addStyleTag({content:read('task-horizon.css')+'body{margin:0}#manager{position:relative;width:100vw;height:100vh}.tm-body{height:100%;box-sizing:border-box}'});
        await page.addScriptTag({content:runtime});
        await page.evaluate(() => {
            const host=document.createElement('main');host.id='manager';host.className='tm-modal';
            document.body.append(host);pngTest.state.modal=host;
        });
        await reset();
        await page.locator('[onclick="tmWhiteboardToggleBottomMore(event)"]').click();
        assert.equal(await page.locator('.tm-whiteboard-bottom-more-panel button').filter({hasText:'导出 PNG'}).count(),1);
        assert.equal(await page.locator('[onclick="tmWhiteboardExportPng(event)"] svg').getAttribute('viewBox'),'0 0 256 256');
        await page.screenshot({path:path.join(output,'desktop-menu.png')});
        const snapshot = await page.evaluate(() => {
            const view=JSON.stringify(pngTest.SettingsStore.data.whiteboardView);
            pngTest.state.modal.querySelector('.tm-whiteboard-node--root').classList.add('tm-whiteboard-card--selected');
            const shot=pngTest.snapshot();
            const info={width:shot.width,height:shot.height,text:shot.node.textContent,
                controls:shot.node.querySelectorAll('.tm-task-link-dot,.tm-kanban-more,.tm-whiteboard-card-tools').length,
                selected:shot.node.querySelectorAll('.tm-whiteboard-card--selected').length,
                pathStroke:shot.node.querySelector('.tm-whiteboard-edge--manual')?.style.stroke,
                unchanged:view===JSON.stringify(pngTest.SettingsStore.data.whiteboardView)};
            shot.host.remove();return info;
        });
        assert.equal(snapshot.controls,0);assert.equal(snapshot.selected,0);assert.equal(snapshot.unchanged,true);
        assert.match(snapshot.text,/中文任务/);assert.match(snapshot.text,/便利贴标题/);
        assert.ok(snapshot.pathStroke,'SVG line styles must be embedded');
        assert.ok(snapshot.width<4000&&snapshot.height<2500,'crop actual content instead of the backing canvas');
        const local = await exportPng('local-light',true);
        assert.match(local.filename,/测试白板_白板_.*\.png$/);
        assert.deepEqual(local.background,[248,250,251,255]);
        assert.ok(local.red>5000,'handwriting must remain visible');
        assert.ok(local.blue>1000,'connections and frame colors must remain visible');
        assert.ok(local.dark>1000,'text and task content must remain visible');
        await page.evaluate(() => {pngTest.setView({x:900,y:-600,zoom:0.5});pngTest.transform();});
        const moved = await exportPng('local-zoomed');
        assert.deepEqual([moved.width,moved.height,moved.hash],[local.width,local.height,local.hash],'export must be independent of pan and zoom');

        const traversal = await page.evaluate(() => {
            const view=JSON.stringify(pngTest.SettingsStore.data.whiteboardView);
            const selected=pngTest.state.whiteboardSelectedTaskId;
            const body=pngTest.state.modal.querySelector('#tmWhiteboardBody');
            body.classList.add('tm-whiteboard-traversing');
            body.querySelector('.tm-whiteboard-node--root').classList.add('tm-whiteboard-traversal-dim');
            const shot=pngTest.snapshot();
            const note=shot.node.querySelector('.tm-whiteboard-note');
            const result={opacity:getComputedStyle(note).opacity,
                classes:shot.node.querySelectorAll('.tm-whiteboard-traversing,.tm-whiteboard-traversal-dim').length,
                unchanged:view===JSON.stringify(pngTest.SettingsStore.data.whiteboardView)&&selected===pngTest.state.whiteboardSelectedTaskId};
            shot.host.remove();return result;
        });
        assert.equal(traversal.classes,0);assert.equal(traversal.opacity,'1');assert.equal(traversal.unchanged,true);

        await reset();
        const failed = await page.evaluate(async () => {
            let rejectRender, calls=0;
            const previous=pngTest.renderer(()=>{calls++;return new Promise((_resolve,reject)=>{rejectRender=reject;});});
            const exporting=tmWhiteboardExportPng();
            while(!rejectRender)await new Promise(resolve=>setTimeout(resolve,0));
            await tmWhiteboardExportPng();
            pngTest.state.whiteboardBottomMoreOpen=true;pngTest.mount();
            const disabled=pngTest.state.modal.querySelector('[onclick="tmWhiteboardExportPng(event)"]').disabled;
            rejectRender(new Error('合成渲染失败'));
            await exporting;pngTest.renderer(previous);
            return {calls,disabled,pending:pngTest.state.whiteboardPngExportPending,
                enabled:!pngTest.state.modal.querySelector('[onclick="tmWhiteboardExportPng(event)"]').disabled,
                leftovers:document.querySelectorAll('[data-tm-whiteboard-export]').length,hint:pngTest.hints.at(-1)};
        });
        assert.equal(failed.calls,1);assert.equal(failed.disabled,true);assert.equal(failed.enabled,true);
        assert.equal(failed.pending,false);assert.equal(failed.leftovers,0);assert.equal(failed.hint.type,'error');
        await exportPng('retry-after-failure',true);

        await page.evaluate(() => {
            const layer=pngTest.state.modal.querySelector('.tm-whiteboard-drawing-layer');
            layer.classList.add('tm-whiteboard-drawing-layer--hidden');
        });
        const hidden = await exportPng('hidden-handwriting');
        assert.equal(hidden.red,0,'hidden handwriting must remain hidden');

        await reset({mode:'global'});
        const global = await exportPng('global-light');
        assert.ok(global.width>local.width,'global board must include its additional placed task');
        await reset({mode:'tabs'});
        const tabs = await exportPng('tab-group');
        assert.match(tabs.filename,/项目 A_白板_/);
        const scope = await page.evaluate(() => {
            const shot=pngTest.snapshot();const text=shot.node.textContent;shot.host.remove();return text;
        });
        assert.match(scope,/页签组专属备注/);assert.doesNotMatch(scope,/另一文档的任务|便利贴标题/);

        await reset({dark:true});
        const dark = await exportPng('local-dark');
        assert.deepEqual(dark.background,[32,38,44,255]);assert.ok(dark.red>5000);

        await page.setViewportSize({width:390,height:844});
        await reset({mode:'global'});
        await page.locator('[onclick="tmWhiteboardToggleBottomMore(event)"]').click();
        const menu = await page.locator('.tm-whiteboard-bottom-more-panel').boundingBox();
        assert.ok(menu.x>=0&&menu.x+menu.width<=391&&menu.y>=0&&menu.y+menu.height<=844,'mobile export menu must stay in the viewport');
        assert.equal(await page.locator('.tm-whiteboard-bottom-more-panel button').first().evaluate(node => {
            const r=node.getBoundingClientRect();return node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
        }),true,'mobile menu must be above the scrolling toolbar and clickable');
        await page.screenshot({path:path.join(output,'mobile-menu.png')});
        const mobile = await exportPng('mobile-global',true);
        assert.ok(mobile.width<=4096&&mobile.height<=4096&&mobile.width*mobile.height<=4000000);
        assert.ok(mobile.red>1000);

        await reset({empty:true});
        await page.evaluate(() => tmWhiteboardExportPng());
        assert.equal(await page.evaluate(() => pngTest.blobs.length),0);
        assert.match(await page.evaluate(() => pngTest.hints.at(-1).message),/没有可导出/);
        assert.equal(await page.locator('[data-tm-whiteboard-export]').count(),0);
        const limits = await page.evaluate(() => {
            let rejected=false;try{pngTest.dimensions(1e9,1e9);}catch{rejected=true;}
            return {desktop:pngTest.dimensions(10000,7000),mobile:pngTest.dimensions(10000,7000,true),rejected};
        });
        assert.ok(limits.desktop.width*limits.desktop.height<=16000000);
        assert.ok(limits.mobile.width*limits.mobile.height<=4000000);
        assert.equal(limits.rejected,true);
        assert.deepEqual(errors,[]);
        console.log('Whiteboard PNG export: actual images, menu, crop, pan/zoom, SVG, themes, scope, mobile and empty-state checks passed');
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => {console.error(error);process.exitCode=1;});
