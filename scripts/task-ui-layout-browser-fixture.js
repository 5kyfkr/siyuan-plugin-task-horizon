'use strict';

// Isolated real-browser reproduction using production CSS, wrap measurements
// and scroll-anchor helpers. Run with Playwright CLI, not against user tasks.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
function between(start, end) {
    const from = source.indexOf(start), to = source.indexOf(end, from);
    if (from < 0 || to <= from) throw new Error(`Missing fixture source: ${start}`);
    return source.slice(from, to);
}
const runtime = between('    const __tmTaskTitleWrapCache =', '    function __tmCollectKanbanSubtaskWrapRowsFromMutation(')
    + between('    function __tmCaptureViewScrollAnchor(', '    function __tmReconcileListRowsForAppend(');
const script = `
${runtime}
const state = { viewMode:'checklist' };
window.__tmIsViewDomCommitBlocked = () => false;
const frame = () => new Promise(requestAnimationFrame);
const pause = async () => { for(let i=0;i<8;i++) await frame(); };
const longTitle = 'A multiline task title that must keep its checkbox on the first line during every replacement';
let title = longTitle;
let listCount = 100, childCount = 28, status = false;
function row(surface, id, text) {
    const wrap = __tmGetTaskTitleWrapPresentation(surface,id,text);
    const checkbox = '<span class="tm-task-checkbox-wrap"><input type="checkbox" class="tm-task-checkbox" '+(status?'checked':'')+'></span>';
    if(surface === 'kanban') return '<div class="tm-kanban-card tm-kanban-card--sub tm-kanban-subtask-row" data-id="'+id+'"><div class="tm-kanban-subtask-row-main'+wrap.className+'" data-tm-title-wrap-key="'+wrap.key+'">'+checkbox+'<div class="tm-kanban-subtask-text"><span class="tm-kanban-subtask-title tm-task-content-clickable">'+text+'</span></div><div class="tm-kanban-subtask-actions"><button>...</button></div></div></div>';
    return '<div class="tm-checklist-item'+wrap.className+'" data-id="'+id+'" data-tm-title-wrap-key="'+wrap.key+'"><div class="tm-checklist-leading">'+checkbox+'</div><div class="tm-checklist-item-main"><div class="tm-checklist-title-row"><div class="tm-checklist-title-main"><div class="tm-checklist-title"><span class="tm-checklist-title-button"><span>'+text+'</span></span></div></div></div></div></div>';
}
function render(surface) {
    if(surface === 'checklist') return Array.from({length:listCount},(_,i)=>row(surface,'list-'+i,i%4===0?title:'Task '+i)).join('');
    return Array.from({length:5},(_,group)=>'<div class="tm-kanban-card tm-kanban-card--parent" data-id="parent-'+group+'"><div class="tm-kanban-card-title">Parent '+group+'</div><div class="tm-kanban-subtasks"><div class="tm-kanban-subtasks-list">'+Array.from({length:childCount},(_,i)=>row(surface,'child-'+group+'-'+i,i%4===0?title:'Child '+i)).join('')+'</div></div></div>').join('');
}
const hosts = { checklist:document.querySelector('.tm-checklist-scroll'), kanban:document.querySelector('.tm-kanban-col-body') };
const selectors = { checklist:'.tm-checklist-item[data-id]', kanban:'.tm-kanban-subtask-row[data-id]' };
function sync(surface) { if(surface === 'checklist') __tmSyncChecklistWrappedTitleClasses(hosts[surface]); else __tmSyncKanbanSubtaskWrappedTitleClasses(hosts[surface]); }
function wrappedRows(surface) { return hosts[surface].querySelectorAll(surface==='checklist'?'.tm-checklist-item--title-wrapped':'.tm-kanban-subtask-row-main--title-wrapped'); }
function offset(surface, id) { const host=hosts[surface], row=host.querySelector('[data-id="'+id+'"]');return row.getBoundingClientRect().top-host.getBoundingClientRect().top; }
function alignment(surface,id) { const task=hosts[surface].querySelector('[data-id="'+id+'"]'); const cb=task.querySelector('.tm-task-checkbox');const title=task.querySelector(surface==='checklist'?'.tm-checklist-title-button > span':'.tm-kanban-subtask-title');return cb.getBoundingClientRect().top-title.getBoundingClientRect().top; }
window.runRegression = async () => {
    const results=[];
    for(const surface of ['checklist','kanban']) {
        state.viewMode=surface;
        const host=hosts[surface];host.innerHTML=render(surface);sync(surface);await pause();
        host.scrollTop=surface==='checklist'?600:800;await pause();sync(surface);
        const expectedVisibility=getComputedStyle(host.querySelector(surface==='checklist'?'.tm-checklist-item':'.tm-kanban-card--parent')).contentVisibility;
        if(expectedVisibility!=='visible') throw new Error(surface+': placeholder sizing is still enabled');
        for(const action of ['status','create','delete','drag','outdent','status']) {
            const anchor=__tmCaptureViewScrollAnchor(host,selectors[surface]);
            const beforeWrap=wrappedRows(surface).length;
            const beforeWrappedIds=Array.from(wrappedRows(surface),row=>row.closest('[data-id]').getAttribute('data-id'));
            const measuredId=wrappedRows(surface)[0].closest('[data-id]').getAttribute('data-id');
            const beforeAlign=alignment(surface,measuredId);
            if(action==='status') status=!status;
            if(action==='create') { if(surface==='checklist') listCount++;else childCount++; }
            if(action==='delete') { if(surface==='checklist') listCount--;else childCount--; }
            __tmCleanupTitleWrapObservers(host);
            host.innerHTML=render(surface);
            // Assert before any observer or manual synchronization can repair it.
            const inherited=wrappedRows(surface).length;
            const survivingWrapped=beforeWrappedIds.filter(id=>host.querySelector('[data-id="'+id+'"]')).length;
            const immediateAlign=alignment(surface,measuredId);
            __tmRestoreViewScrollAnchor(host,anchor);
            const immediateTop=host.scrollTop;
            await frame();sync(surface);await pause();
            const error=Math.abs(offset(surface,anchor.id)-anchor.offsetTop);
            const drift=Math.abs(host.scrollTop-immediateTop);
            const alignDrift=Math.abs(immediateAlign-beforeAlign);
            if(!inherited || inherited<survivingWrapped || error>1 || drift>1 || alignDrift>1) throw new Error(JSON.stringify({surface,action,inherited,beforeWrap,survivingWrapped,error,drift,alignDrift}));
            results.push({surface,action,scroll:host.scrollTop,anchorError:error,scrollDrift:drift,alignmentDrift:alignDrift,inherited});
        }
    }
    // A changed title and a wider column must still be allowed to unwrap.
    title='Short';hosts.kanban.innerHTML=render('kanban');sync('kanban');await pause();
    if(wrappedRows('kanban').length) throw new Error('short titles retain a stale wrapped class');
    document.querySelector('output').textContent=JSON.stringify(results,null,2);
    window.results=results;return results;
};
document.querySelector('#run').onclick=()=>runRegression().catch(error=>{document.querySelector('output').textContent=error.stack;throw error});
`;
new vm.Script(script);
const fixture = `<!doctype html><meta charset="utf-8"><title>Task layout regression</title>
<link rel="stylesheet" href="../../task-horizon.css">
<style>
body{font:16px sans-serif;margin:12px;background:#fff;color:#222}
.tm-modal{position:static;display:block;width:auto;height:auto;min-width:0;transform:none;background:#fff;--tm-font-size:16px;--tm-primary-color:#2869bb}
.fixture-columns{display:flex;gap:24px}.fixture-columns>section{width:420px;min-width:0}
.tm-body{display:block;height:380px;min-height:0;padding:0}.tm-checklist-pane{height:380px;width:100%}
.tm-checklist-scroll,.tm-kanban-col-body{height:380px;max-height:380px;overflow:auto;scroll-behavior:auto}
.tm-checklist-title-button>span,.tm-kanban-subtask-title{font-size:16px;line-height:21.6px}
output{display:block;white-space:pre-wrap;font:12px monospace;margin-top:16px}
</style><button id="run">Run layout regression</button>
<div class="tm-modal tm-modal--task-wrap"><div class="fixture-columns">
<section><h2>Checklist</h2><div class="tm-body tm-body--checklist"><div class="tm-checklist-pane tm-checklist-pane--compact tm-checklist-pane--wrap"><div class="tm-checklist-scroll tm-checklist-items"></div></div></div></section>
<section><h2>Kanban</h2><div class="tm-body tm-body--kanban"><div class="tm-kanban tm-kanban--clean"><div class="tm-kanban-col-body"></div></div></div></section>
</div></div><output></output><script>${script}</script>`;
const dir = path.join(root,'output/playwright');
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'task-ui-layout.html'),fixture);
console.log('Browser fixture: output/playwright/task-ui-layout.html');
