'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, i18nPrelude } = require('./i18n-browser-fixture');
const root = path.resolve(__dirname, '..');
const modulePath = path.join(root, 'src/task-horizon/main/task-runtime/51a-task-title-editor-runtime.js');
const apiSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const detailSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/52-task-detail-runtime.js'), 'utf8');
const uiSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/30-dialogs-and-ui-foundation.js'), 'utf8');
const storesSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const navigationSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js'), 'utf8');
assert.doesNotMatch(apiSource + detailSource + navigationSource, /__tmLogTaskTitleUnderline|__tmTraceTaskTitleRender|__tmTitleUnderline|diagnostics-v\d/, 'temporary diagnostic state, scans and call sites are removed');
const lutePath = process.env.SIYUAN_LUTE_PATH || ['3.8.9', '3.8.8']
    .map(version => path.resolve(root, `../siyuan-${version}/app/stage/protyle/js/lute/lute.min.js`))
    .find(candidate => fs.existsSync(candidate));
function between(source, start, end) {
    const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
    assert.ok(a >= 0 && b > a, start);
    return source.slice(a, b);
}

async function main() {
    assert.ok(lutePath && fs.existsSync(lutePath), 'Set SIYUAN_LUTE_PATH to the real SiYuan lute.min.js; do not replace it with a parser mock');
    const browser = await chromium.launch({ headless: true,
        ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
    const errors = [];
    const diagnosticMessages = [];
    try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.text().startsWith('[Task Horizon][TitleUnderline]')) diagnosticMessages.push(message.text()); });
        await page.setContent(`<style>${fs.readFileSync(path.join(root, 'task-horizon.css'), 'utf8')}</style>
            <style>body{margin:32px;font:14px system-ui;background:#f4f5f6;color:#263238;--tm-font-size:14px;--tm-text-color:#263238;--tm-card-bg:#fafbfc;--tm-bg-color:#f4f5f6;--tm-input-bg:#f4f5f6;--tm-input-border:#a6adb5;--tm-primary-color:#447a9b;--tm-border-color:#c6ccd2;--radius:8px}#fixture{max-width:640px;padding:24px;background:var(--tm-card-bg)}button,input{font:inherit}button{cursor:pointer}input{box-sizing:border-box;padding:7px}button{padding:6px 10px}.tm-task-detail-inline-popover{padding:12px;background:var(--tm-card-bg);border:1px solid var(--tm-border-color);border-radius:8px}</style>
            <main id="fixture"></main><button id="outside">Outside</button>`);
        await page.addScriptTag({ content: i18nPrelude });
        await page.addScriptTag({ path: lutePath });
        await page.addScriptTag({ content: `
            ${between(apiSource, '    function __tmGetTaskListItemMarkerPrefixMatch', '    function __tmNormalizeTaskListItemMarkdownMarker')}
            window.esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            window.API = { extractTaskContentLine: __tmExtractTaskOwnContentLine, getTaskContentBlockId: async () => '',
                getBlockDOM: async () => '', call: async (url, args) => { window.calls.push({url,args}); return {code:0,data:'原块名称'}; } };
            window.calls = [];
            window.__tmOpenTaskAttachmentBlockRef = id => window.opened = id;
            window.__tmRenderLucideIcon = () => '';
            window.__tmIsMobileDevice = () => matchMedia('(pointer: coarse)').matches;
        ` });
        await page.addScriptTag({ path: modulePath });
        await page.addScriptTag({ content: `
            const __tmTaskContentHtmlCache = new Map();
            ${between(apiSource, '    function __tmIsTaskInlineEscaped(', '    function __tmRememberTaskStatusParse(')}
            Object.assign(API, { normalizeTaskContent: value => String(value || '').trim(),
                ${between(apiSource, "        renderTaskContentHtml(markdown, fallback = '')", '        parseTaskStatus(markdown)')}
            });
        ` });
        await page.addScriptTag({ content: `
            const __tmEscAttr = window.esc;
            ${between(uiSource, '    function __tmNormalizeLucideIconName(', '    function __tmLucideIconSvg(')}
            ${between(uiSource, '    function __tmPhosphorBoldSvg(', '    // Calendar view is loaded')}
        ` });
        await page.addScriptTag({ content: `
            window.__tmRenderLucideIcon=(name,extra,options={})=>__tmPhosphorBoldSvg(name,options);
            window.__tmRuntimeEvents={on:(target,type,handler,options)=>target.addEventListener(type,handler,options),off:(target,type,handler,options)=>target.removeEventListener(type,handler,options)};
            window.__tmResolveTaskAttachmentHref=value=>'/'+value.replace(/^\\.?\\/?/, '');
            window.openedUrls=[];
            window.open=(href,target,features)=>{openedUrls.push({href,target,features});return null;};
            ${between(navigationSource, '    function __tmOpenTaskTitleLink(', '    function __tmBuildTaskAttachmentThumbHtml(')}
        ` });
        const indexCodec = ['__tmBuildTaskIndexBlockEntry', '__tmRestoreTaskIndexBlockEntry'].map(name => {
            const start=storesSource.indexOf(`    function ${name}(`);
            const end=storesSource.indexOf('\n    }',start)+6;
            assert.ok(start>=0 && end>start);
            return storesSource.slice(start,end);
        }).join('\n');
        await page.addScriptTag({content:`
            const SettingsStore={data:{}};
            const __TM_TASK_ATTACHMENT_META_ATTR='custom-attachment-meta';
            const __tmIsLikelyBlockId=value=>/^\\d{14}-[a-z0-9]{7}$/.test(value);
            const __tmCompactTaskIndexText=value=>String(value||'');
            const __tmCompactTaskIndexValue=value=>value;
            const __tmGetTaskAttachmentMetaMap=()=>new Map();
            const __tmGetTaskAttachmentPaths=()=>[];
            const __tmHasTaskAttachmentAttrSnapshot=()=>false;
            const __tmNormalizeTomatoCountValue=value=>value;
            const __tmNormalizeTaskAttachmentMetaMap=()=>new Map();
            const __tmSerializeTaskAttachmentMeta=()=>'';
            const __tmCloneTaskSnapshotValue=value=>value;
            ${indexCodec}
            window.cachedTask=source=>{
                const doc={id:'20260101000000-doc0001'};
                const task={id:'20260101000000-task001',root_id:doc.id,markdown:'- [ ] '+source,content:'plain display text'};
                const entry=__tmBuildTaskIndexBlockEntry(task,doc);
                return __tmRestoreTaskIndexBlockEntry(JSON.parse(JSON.stringify(entry)),doc);
            };
        `});
        const titleBinding = between(detailSource, `        const titleTextarea = root.querySelector('[data-tm-detail="content"]');`, '        const fsrsReviewButtons =');
        const diff = between(detailSource, '        const buildDetailDiff =', '        const runSaveOnce =');
        await page.addScriptTag({ content: `
            let abort;
            window.harness = {
                create(markdown, readOnly = false) {
                    abort?.abort(); abort = new AbortController();
                    this.task = { id:'20261104090000-task001', markdown:'- [ ] '+markdown, content:'display text' };
                    const root = document.querySelector('#fixture');
                    root.innerHTML = __tmBuildTaskTitleEditorHtml(this.task, { attributes:'data-tm-detail="content"', readOnly });
                    const editor = root.querySelector('[data-tm-title-editor]');
                    __tmMountTaskTitleEditor(editor, this.task, { signal:abort.signal });
                    this.requests=[];
                    const on = (target,event,handler,options={}) => target?.addEventListener(event,handler,{...options,signal:abort.signal});
                    const syncAutoHeight = () => {};
                    const scheduleAutoSave = delay => this.requests.push({type:'schedule',delay,value:editor.value});
                    const flushAutoSaveNow = async () => { this.requests.push({type:'flush',value:editor.value}); return true; };
                    ${titleBinding}
                    return editor.value;
                },
                snapshot() {
                    const el=document.querySelector('[data-tm-title-editor]');
                    return {value:el.value,html:el.innerHTML,text:el.textContent,
                        marks:[...el.querySelectorAll('[data-type]')].map(n=>({type:n.getAttribute('data-type'),href:n.getAttribute('data-href'),title:n.getAttribute('data-title'),id:n.getAttribute('data-id'),subtype:n.getAttribute('data-subtype'),text:n.textContent.replace(/[\u200b\u2060]/g,'')}))};
                },
                createSubtask(markdown) {
                    abort?.abort(); abort = new AbortController();
                    const abortController=abort;
                    this.task={id:'20261104090000-task002',markdown:'- [ ] '+markdown,content:'display text'};
                    const root=document.querySelector('#fixture');
                    root.innerHTML=__tmBuildTaskTitleEditorHtml(this.task,{className:'tm-task-detail-subtask-title',attributes:'data-tm-detail-subtask-content="20261104090000-task002"'});
                    this.requests=[];
                    const on=(target,event,handler,options={})=>target?.addEventListener(event,handler,{...options,signal:abort.signal});
                    const resolveDetailTaskById=()=>this.task;
                    const subtaskTextareaMinHeight=30;
                    const syncAutoHeight=()=>{};
                    const setSubtaskContentEditingHold=()=>{};
                    const clearSubtaskContentEditingHold=()=>{};
                    const clearSubtaskSaveTimer=()=>{};
                    const scheduleSubtaskSave=el=>this.requests.push({value:el.value});
                    const saveSubtaskContent=async el=>{this.requests.push({value:el.value});return true;};
                    ${between(detailSource, '        const bindSubtaskContentEditor =', '        const restoreSubtaskEmptyState =')}
                    ${between(detailSource, '        const bindSubtaskEditors =', '        const syncSubtaskEditorHeights =')}
                    bindSubtaskEditors();
                    return root.querySelector('[data-tm-title-editor]').value;
                },
                markSaved() { const el=document.querySelector('[data-tm-title-editor]');el.dataset.savedValue=el.value; },
                destroy() {abort.abort();},
            };
            const getBoundTask=()=>harness.task;
            const __tmResolveTaskStatusId=()=>'';
            const __tmGetTaskTomatoEstimateCount=()=>'';
            const __tmNormalizeRemarkMarkdown=value=>String(value||'');
            const __tmGetTaskDetailRemarkRaw=()=>'';
            ${diff}
            window.readDiff=nextContent=>buildDetailDiff(harness.task,{nextContent,nextStatus:'',nextPriority:'',nextPinned:false,nextStart:'',nextEnd:'',nextDuration:'',nextTomatoEstimateCount:'',nextRemark:'',nextCustomFieldTextValues:{}});
        ` });
        const id = '20260101000000-abcdefg';
        const samples = [
            '开始 [文档](https://example.invalid/a(b)?a=1&b=2 "提示") 结束',
            `开始 ((${id} "静态引用")) 结束`,
            `开始 ((${id} '动态引用')) 结束`,
            `开始 ((${id})) 结束`,
            '开始 [**文档**](https://example.invalid "提示") 结束',
            `开始 <span data-type="block-ref strong" data-id="${id}" data-subtype="d">计划</span> 结束`,
            `开始 \`((${id} "字面文本"))\` 结束`,
            `开始 <span data-type="a" data-href="https://example.invalid">文档</span> 与 \`((${id} "字面文本"))\` 结束`,
            '开始 [同名](https://example.invalid/a) 和 [同名](https://example.invalid/b) 结束',
        ];
        for (const source of samples) {
            assert.equal(await page.evaluate(source => harness.create(source), source), source, 'opening preserves the original source');
            const before = await page.evaluate(() => harness.snapshot());
            assert.equal((await page.evaluate(source => readDiff(source), source)).contentChanged, false, 'unchanged title must not write when other fields save');
            await page.locator('[data-tm-title-editor]').focus();
            await page.keyboard.press('Control+End');
            await page.keyboard.type(' changed');
            const after = await page.evaluate(() => harness.snapshot());
            assert.deepEqual(after.marks, before.marks, 'typing ordinary text preserves every native mark and its attributes');
            assert.ok(after.value.includes('changed'));
            assert.doesNotMatch(after.value, /data-node-id|data-tm-|contenteditable|tabindex/, 'temporary control attributes never enter persisted content');
            const reloaded = await page.evaluate(source => { harness.create(source); return harness.snapshot(); }, after.value);
            assert.deepEqual(reloaded.marks, before.marks, `native source reload preserves mark meaning: ${JSON.stringify({ value: after.value, html: after.html })}`);
        }
        console.log('9 real-Lute ordinary-edit and reload cases passed');

        await page.evaluate(() => harness.create('开始 [**文档**](https://example.invalid/old "保留提示") 结束'));
        await page.locator('[data-type~="a"]').click();
        await page.locator('[data-title-edit]').click();
        await page.locator('[name="label"]').fill('新名称');
        await page.locator('[name="target"]').fill('https://example.invalid/new');
        const requestsDuringPanel = await page.evaluate(() => harness.requests);
        assert.equal(requestsDuringPanel.filter(r => r.type === 'flush').length, 0, 'moving focus into the link panel must not flush the old title');
        await page.locator('.tm-title-link-form button[type="submit"]').click();
        let snap = await page.evaluate(() => harness.snapshot());
        assert.equal(snap.marks[0].href, 'https://example.invalid/new');
        assert.equal(snap.marks[0].text, '新名称');
        assert.equal(snap.marks[0].title, '保留提示');
        assert.ok(snap.marks[0].type.includes('strong'));
        await page.keyboard.press('Control+z');
        snap = await page.evaluate(() => harness.snapshot());
        assert.equal(snap.marks[0].href, 'https://example.invalid/old', 'link edit participates in undo');
        await page.keyboard.press('Control+Shift+z');
        assert.equal((await page.evaluate(() => harness.snapshot())).marks[0].href, 'https://example.invalid/new');
        console.log('link edit, tooltip preservation, focus handoff and undo/redo passed');

        await page.evaluate(id => harness.create(`开始 ((${id} '动态引用')) 结束`), id);
        await page.locator('[data-type~="block-ref"]').click();
        await page.locator('[data-title-edit]').click();
        assert.equal(await page.locator('[name="label"]').isDisabled(), true);
        await page.locator('[name="dynamic"]').uncheck();
        await page.locator('[name="label"]').fill('我的名称');
        await page.locator('.tm-title-link-form button[type="submit"]').click();
        await page.waitForFunction(() => !document.querySelector('.tm-title-link-popover'));
        assert.equal((await page.evaluate(() => harness.snapshot())).marks[0].subtype, 's');
        assert.ok((await page.evaluate(() => calls)).every(c => c.url === '/api/block/getRefText'), 'editing a reference must never rename its target');
        await page.locator('[data-type~="block-ref"]').click();
        await page.locator('[data-title-edit]').click();
        await page.locator('[name="dynamic"]').check();
        await page.locator('.tm-title-link-form button[type="submit"]').click();
        await page.waitForFunction(() => !document.querySelector('.tm-title-link-popover'));
        snap = await page.evaluate(() => harness.snapshot());
        assert.equal(snap.marks[0].subtype, 'd');
        assert.equal(snap.marks[0].text, '原块名称');
        console.log('static/dynamic reference semantics passed');

        assert.equal(await page.evaluate(()=>harness.createSubtask('测试[链接](baidu.com "666")')), '测试[链接](baidu.com "666")', 'the real outer subtask binder mounts the rich control');
        await page.locator('[data-type~="a"]').click();
        await page.locator('[data-title-edit]').click();
        await page.locator('[name="label"]').fill('子任务链接');
        await page.locator('.tm-title-link-form button[type="submit"]').click();
        assert.equal((await page.evaluate(()=>harness.snapshot())).marks[0].text, '子任务链接');
        assert.ok((await page.evaluate(()=>harness.requests)).some(request=>request.value.includes('baidu.com')), 'subtask input hands full link metadata to its save path');
        console.log('real subtask outer binding and link edit passed');

        await page.evaluate(() => harness.create('前 [同名](https://example.invalid/a) 和 [同名](https://example.invalid/b) 后'));
        await page.locator('[data-type~="a"]').nth(1).click();
        await page.locator('[data-title-edit]').click();
        await page.locator('[name="target"]').fill('https://example.invalid/c');
        await page.locator('.tm-title-link-form button[type="submit"]').click();
        snap = await page.evaluate(() => harness.snapshot());
        assert.deepEqual(snap.marks.map(m => m.href), ['https://example.invalid/a', 'https://example.invalid/c']);
        await page.locator('[data-type~="a"]').nth(1).click();
        await page.locator('[data-title-edit]').click();
        await page.locator('[data-title-unlink]').click();
        snap = await page.evaluate(() => harness.snapshot());
        assert.equal(snap.marks.length, 1);
        assert.ok(snap.text.includes('同名'));
        console.log('duplicate-label targeting and unlink passed');

        await page.evaluate(() => harness.create('开始 [文档](https://example.invalid) 结束'));
        await page.locator('[data-tm-title-editor]').focus();
        await page.evaluate(() => {
            const el = document.querySelector('[data-tm-title-editor]');
            el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
            el.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
        });
        assert.equal((await page.evaluate(() => harness.requests)).length, 0, 'IME composition must not enqueue a half-finished title');
        await page.evaluate(() => document.querySelector('[data-tm-title-editor]').dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })));
        assert.equal((await page.evaluate(() => harness.requests))[0].delay, 500);
        await page.evaluate(() => {
            const el=document.querySelector('[data-tm-title-editor]');
            const data=new DataTransfer();data.setData('application/x-task-horizon-title','<span data-type="a" data-href="https://example.invalid/paste">粘贴链接</span>');
            const range=document.createRange();range.selectNodeContents(el);range.collapse(false);getSelection().removeAllRanges();getSelection().addRange(range);
            el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));
        });
        assert.equal((await page.evaluate(() => harness.snapshot())).marks.at(-1).href, 'https://example.invalid/paste');
        console.log('IME and internal rich paste passed');

        await page.evaluate(() => harness.markSaved());
        await page.locator('#outside').focus();
        await page.evaluate(() => __tmPatchTaskTitleEditor(document.querySelector('[data-tm-title-editor]'), {markdown:'- [ ] 外部 [更新](https://example.invalid/external)'}));
        assert.equal((await page.evaluate(() => harness.snapshot())).marks[0].href, 'https://example.invalid/external');
        await page.locator('[data-tm-title-editor]').focus();
        await page.keyboard.press('Control+End'); await page.keyboard.type(' draft');
        await page.locator('#outside').focus();
        await page.evaluate(() => __tmPatchTaskTitleEditor(document.querySelector('[data-tm-title-editor]'), {markdown:'- [ ] Stale text'}));
        assert.ok((await page.evaluate(() => harness.snapshot())).value.includes('draft'), 'inactive dirty drafts survive refresh');
        console.log('clean refresh and dirty-draft preservation passed');

        const output = path.join(root, 'output/playwright/task-title-editor');
        fs.mkdirSync(output, { recursive: true });
        for (const width of [360, 820, 1200]) {
            await page.setViewportSize({ width, height: 860 });
            await page.evaluate(id => harness.create(`整理 [项目文档](https://example.invalid/project "项目资料") 与 ((${id} '迭代计划')) 后提交复盘`), id);
            await page.locator('[data-type~="a"]').click();
            const compact = await page.locator('.tm-title-link-popover').evaluate(panel => {
                const actions=panel.querySelector('.tm-title-link-actions').getBoundingClientRect();
                const rect=panel.getBoundingClientRect();
                return {width:rect.width,actionsWidth:actions.width,icons:[...panel.querySelectorAll('.tm-title-link-actions svg')].map(svg=>({viewBox:svg.getAttribute('viewBox'),path:svg.querySelector('path')?.getAttribute('d')}))};
            });
            assert.ok(compact.width - compact.actionsWidth <= 16, 'the action-only popover uses compact 6px padding without a blank column');
            assert.equal(compact.icons.length, 2);
            for (const icon of compact.icons) { assert.equal(icon.viewBox, '0 0 256 256'); assert.ok(icon.path?.length > 50); }
            await page.screenshot({path:path.join(output, `link-actions-${width}.png`)});
            await page.locator('[data-title-edit]').click();
            const rect=await page.locator('.tm-title-link-popover').boundingBox();
            assert.ok(rect.x >= 0 && rect.x + rect.width <= width + 1, 'popover stays inside the viewport');
            await page.screenshot({path:path.join(output, `link-edit-${width}.png`)});
            await page.keyboard.press('Escape');
        }
        await page.evaluate(() => harness.destroy());
        assert.equal(await page.locator('.tm-title-link-popover').count(), 0, 'teardown removes detached editing panels');
        await page.setViewportSize({width:1000,height:900});
        await page.evaluate(id => {
            const fixture=document.querySelector('#fixture');
            const sources=['323232[链接111](baidu.com1111 "666")',`前缀 ((${id} '个人节假日界面优化跨行链接需要完整保留下划线')) 后缀`];
            const markup=sources.map(source=>{const task=cachedTask(source);return API.renderTaskContentHtml(task.markdown,task.content);}).join('<br>');
            const native=__tmSerializeTaskTitleInline(__tmTaskTitleInlineFromMarkdown(sources[1]));
            fixture.style.maxWidth='900px';
            fixture.innerHTML=`<div class="tm-modal tm-modal--task-wrap" style="display:block;position:relative;inset:auto;width:auto;height:auto;padding:0;background:transparent;box-shadow:none;z-index:auto"><div style="display:flex;gap:32px;align-items:flex-start;font-size:22px;--tm-font-size:23px;--tm-task-content-wrap-lines:4"><div class="tm-kanban tm-kanban--clean" style="width:230px"><div class="tm-kanban-subtask-title tm-task-content-clickable">${markup}</div></div><div class="tm-checklist-pane--compact tm-checklist-pane--wrap" style="width:230px"><div class="tm-checklist-title"><span class="tm-checklist-title-button"><span><span class="tm-checklist-title-text">${markup}</span></span></span></div></div><div style="width:230px"><span class="tm-task-content-clickable">${API.renderTaskContentHtml('- [ ] '+native,'')}</span></div></div></div>`;
        },id);
        await page.mouse.move(0,0);
        assert.equal(await page.locator('#fixture .tm-kanban [class~="tm-linked-text"]').count(),2,'Kanban renders the short child link and wrapped reference');
        assert.equal(await page.locator('#fixture .tm-checklist-pane--compact [class~="tm-linked-text"]').count(),2,'checklist renders the short child link and wrapped reference');
        const wrapped=await page.locator('#fixture .tm-linked-text').evaluateAll(links=>links.map(link=>({type:getComputedStyle(link).textDecorationLine,skip:getComputedStyle(link).textDecorationSkipInk,rects:[...link.getClientRects()].map(rect=>({x:rect.x,y:rect.y,width:rect.width,height:rect.height}))})));
        assert.ok(wrapped.some(link=>link.rects.length>=2),'fixture exercises a link that wraps across lines');
        for(const link of wrapped){assert.ok(link.type.includes('underline'));assert.equal(link.skip,'none');}
        await page.screenshot({path:path.join(output,'subtask-links-wrapped.png')});
        console.log('real index-cache restore into Kanban, checklist and wrapped native title underlines passed');
        const hoverCases=[
            {surface:'checklist',source:'[网页](https://example.invalid/a(b)?x=1&y=2 "提示")',href:'https://example.invalid/a(b)?x=1&y=2'},
            {surface:'kanban',source:'[无协议网址](baidu.com "说明")',href:'https://baidu.com'},
            {surface:'whiteboard',source:'<span data-type="a strong" data-href="https://example.invalid/native">原生链接</span>',href:'https://example.invalid/native'},
            {surface:'calendar',source:'[附件](assets/test.pdf)',href:'/assets/test.pdf'},
            {surface:'table',source:'[邮箱](mailto:test@example.invalid)',href:'mailto:test@example.invalid'},
            {surface:'checklist',source:'<https://example.invalid/auto>',href:'https://example.invalid/auto'},
            {surface:'kanban',source:'[带尖括号的网址](<https://example.invalid/a%20b> "说明")',href:'https://example.invalid/a%20b'},
            {surface:'whiteboard',source:'<a href="https://example.invalid/html" title="说明">HTML 链接</a>',href:'https://example.invalid/html'},
            {surface:'kanban',source:`[思源链接](siyuan://blocks/${id})`,block:id},
        ];
        for(const scenario of hoverCases){
            await page.evaluate(({source,surface})=>{
                const fixture=document.querySelector('#fixture');
                fixture.innerHTML=`<div class="hover-task-${surface}" onclick="window.navigationTaskClicks++"><span class="tm-task-content-clickable">${API.renderTaskContentHtml('- [ ] '+source,'')}</span></div>`;
                window.navigationTaskClicks=0;window.openedUrls=[];window.opened='';
            },scenario);
            await page.locator('#fixture .tm-task-title-link').hover();
            const button=page.locator('.tm-task-title-block-ref-floating-jump.is-visible');
            await button.waitFor({state:'visible'});
            assert.ok(await button.locator('svg path').getAttribute('d'),'hover action includes a real icon');
            await button.click();
            if(scenario.block)assert.equal(await page.evaluate(()=>opened),scenario.block,'SiYuan links use native block navigation');
            else assert.equal((await page.evaluate(()=>openedUrls)).at(-1).href,scenario.href,`${scenario.surface} opens the selected link target`);
            assert.equal(await page.evaluate(()=>navigationTaskClicks),0,'using the floating open action must not select or open the task');
        }
        await page.evaluate(id=>{
            document.querySelector('#fixture').innerHTML=API.renderTaskContentHtml(`- [ ] ((${id} "块引用")) 和 [普通链接](https://example.invalid/second)`,'');
            window.openedUrls=[];window.opened='';
        },id);
        await page.locator('#fixture .tm-task-title-block-ref').hover();
        assert.equal(await page.locator('.tm-task-title-block-ref-floating-jump').getAttribute('data-tm-block-ref-id'),id);
        await page.locator('#fixture .tm-task-title-link').hover();
        assert.equal(await page.locator('.tm-task-title-block-ref-floating-jump').getAttribute('data-tm-block-ref-id'),null,'moving from a block reference to a URL clears the previous target');
        await page.locator('.tm-task-title-block-ref-floating-jump.is-visible').click();
        assert.equal((await page.evaluate(()=>openedUrls)).at(-1).href,'https://example.invalid/second');
        await page.locator('#fixture .tm-task-title-block-ref').hover();
        await page.locator('.tm-task-title-block-ref-floating-jump.is-visible').click();
        assert.equal(await page.evaluate(()=>opened),id,'existing block-reference hover navigation is preserved');
        await page.locator('#fixture .tm-task-title-link').focus();
        await page.keyboard.press('Enter');
        assert.equal((await page.evaluate(()=>openedUrls)).at(-1).href,'https://example.invalid/second','keyboard navigation uses the same target');
        await page.locator('#outside').focus();
        await page.locator('#fixture .tm-task-title-link').hover();
        await page.screenshot({path:path.join(output,'view-link-hover-open.png'),animations:'disabled'});
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.tm-task-title-block-ref-floating-jump.is-visible').count(),0);
        assert.equal(await page.evaluate(()=>__tmOpenTaskTitleLink('java\nscript:alert(1)')),false,'control characters cannot bypass unsafe URL rejection');
        await page.evaluate(()=>__tmCleanupTaskTitleBlockRefJumpDelegation());
        assert.equal(await page.locator('.tm-task-title-block-ref-floating-jump').count(),0,'view teardown removes the shared floating action');
        console.log('ordinary and native hover links across views, native block navigation, URL safety, keyboard and cleanup passed');
        assert.deepEqual(diagnosticMessages, [], 'temporary title diagnostics stay removed');
        assert.deepEqual(errors, []);
        console.log('task title editor browser tests passed');
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
