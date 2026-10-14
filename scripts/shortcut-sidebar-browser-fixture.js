'use strict';
// Isolated fixture: production navigation, profiles, projection, UI and CSS.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('src/task-horizon/manifest.main.json'));
let runtime = manifest.scripts.map(file => read('src/task-horizon/' + file)).join('\n');
const startup = runtime.lastIndexOf("    if (document.readyState === 'loading') {");
if (startup < 0) throw new Error('Missing startup boundary');
const loader = read('src/task-horizon/main/task-runtime/53c-document-loader-runtime.js');
const ruleStart = loader.indexOf('        const shortcutContext =');
const ruleEnd = loader.indexOf('\n        state.columnWidths', ruleStart);
if (ruleStart < 0 || ruleEnd <= ruleStart) throw new Error('Missing loader rule initialization');
const loaderRuleInitialization = loader.slice(ruleStart, ruleEnd);
runtime = runtime.slice(0, startup) + `
    const docA = '20261014000000-aaaaaaa', docB = '20261014000000-bbbbbbb', docC = '20261014000000-ccccccc';
    const rows = [
        {id:'20261014000000-taskaaa',root_id:docA,content:'今日产品任务',done:false,completionTime:__tmGetTodayDateKey(),priority:'high',children:[]},
        {id:'20261014000000-taskbbb',root_id:docA,content:'明日产品任务',done:false,completionTime:'2099-01-01',children:[]},
        {id:'20261014000000-taskccc',root_id:docB,content:'今日交付任务',done:false,completionTime:__tmGetTodayDateKey(),children:[]}
    ];
    const scope = {all:[docA,docB,docC],work:[docA,docB],empty:[docC]};
    state.allDocuments=[{id:docA,name:'产品迭代'},{id:docB,name:'项目交付'},{id:docC,name:'空白文档'}];
    SettingsStore.data.docGroups=[{id:'work',name:'工作项目',entries:[]},{id:'empty',name:'空白项目',entries:[]}];
    SettingsStore.data.docTabCustomGroups=[{id:'iteration',name:'当前迭代',docGroupId:'work',entries:[{id:docA,type:'doc',includeChildDocs:false},{id:docB,type:'doc',includeChildDocs:false}]}];
    SettingsStore.data.filterRules=[{id:'today-rule',name:'今日',enabled:true,conditions:[{field:'completionTime',operator:'range_today',value:''}],sort:[]},{id:'disabled-rule',name:'停用规则',enabled:false,conditions:[]}];
    SettingsStore.data.currentRule=null;SettingsStore.data.currentGroupId='all';
    SettingsStore.data.enabledViews=['list','checklist','timeline','kanban','calendar','whiteboard'];
    SettingsStore.data.viewProfiles={global:{ruleId:null,groupMode:'doc'},groups:{work:{ruleId:null,groupMode:'doc',defaultViewMode:'kanban'}},allTabs:{},docTabGroups:{},docTabGroupAllTabs:{},docs:{}};
    SettingsStore.loaded=true;WhiteboardStore.loaded=true;MetaStore.loaded=true;
    SettingsStore.data.shortcutItems=__tmShortcuts.normalize(Storage.get('tm_shortcut_items', []));
    state.filterRules=SettingsStore.data.filterRules;
    state.viewMode='checklist';state.activeDocId='all';state.openToken=1;
    SettingsStore.save=async()=>{if(window.shortcutTest.failSave)throw new Error('Simulated write failure');SettingsStore.syncToLocal();};
    WhiteboardStore.scheduleSave=()=>{};
    resolveDocIdsFromGroups=async({groupId='all'})=>{if(window.shortcutTest.delay)await new Promise(resolve=>setTimeout(resolve,window.shortcutTest.delay));return scope[groupId]||[];};
    __tmEnsureFilterRulesLoaded=async()=>state.filterRules;
    const load = () => {
        const ids=scope[SettingsStore.data.currentGroupId]||[];
        state.taskTree=ids.map(id=>({id,name:state.allDocuments.find(doc=>doc.id===id).name,tasks:rows.filter(task=>task.root_id===id)}));
        state.flatTasks=Object.fromEntries(rows.filter(task=>ids.includes(task.root_id)).map(task=>[task.id,task]));
        state.__tmLoadedDocIdsForTasks=ids;state.otherBlocks=[];
    };
    loadSelectedDocuments=async()=>{
        window.shortcutTest.loadCalls++;
        const token=state.openToken;
        if(window.shortcutTest.loadDelay)await new Promise(resolve=>setTimeout(resolve,window.shortcutTest.loadDelay));
        if(token!==state.openToken)return;
        load();${loaderRuleInitialization}\napplyFilters();render();
    };
    window.shortcutTest={state,SettingsStore,shortcuts:__tmShortcuts,sidebar:__tmShortcutSidebar,render,applyFilters,
        applyProfile:__tmApplyCurrentContextViewProfile,homepageTasks:__tmCollectHomepageTasks,
        restoreSnapshot:__tmRestoreTaskSnapshotIntoState,
        snapshot:groupId=>({version:__TM_TASK_SNAPSHOT_VERSION,groupId,createdAt:Date.now(),
            scopeKey:__tmBuildTaskSnapshotScopeKey(scope[groupId]||[],groupId),docIds:scope[groupId]||[],
            taskTree:(scope[groupId]||[]).map(id=>({id,name:state.allDocuments.find(doc=>doc.id===id).name,tasks:rows.filter(task=>task.root_id===id)})),otherBlocks:[]}),
        docA,docB,docC,load,delay:0,loadDelay:0,loadCalls:0,failSave:false,
        profiles:()=>JSON.stringify(__tmGetViewProfilesStore()),
        seed:async()=>{await __tmShortcuts.save([
            {id:'today',name:'今天',icon:{type:'phosphor',name:'sun'},groupId:'all',tabGroupId:'',docId:'all',viewId:'checklist',ruleId:'today-rule'},
            {id:'iteration',name:'迭代全览',icon:{type:'phosphor',name:'folder'},groupId:'work',tabGroupId:'iteration',docId:'all',viewId:'whiteboard',ruleId:''},
            {id:'product',name:'产品日历',icon:{type:'phosphor',name:'calendar'},groupId:'work',tabGroupId:'iteration',docId:docA,viewId:'calendar',ruleId:'today-rule'},
            {id:'home',name:'今日首页',icon:{type:'phosphor',name:'house'},groupId:'work',tabGroupId:'',docId:docA,viewId:'home',ruleId:'today-rule'},
            {id:'empty',name:'空白清单',icon:{type:'phosphor',name:'file-text'},groupId:'empty',tabGroupId:'',docId:docC,viewId:'checklist',ruleId:''}
        ]);}
    };
    globalThis.__taskHorizonHostBridge={openEmoji:options=>{window.shortcutTest.emojiOptions=options;}};
    window.tmLicenseHasFeature=()=>true;
    const host=document.getElementById('host');__tmSetMount(host);
    __tmApplyAppearanceThemeVars();load();applyFilters();render();
})();`;
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>Shortcut plugin integration fixture</title><link rel="stylesheet" href="../../src/basecoat/basecoat.css"><link rel="stylesheet" href="../../task-horizon.css"><style>html,body{margin:0;height:100%;font:14px/1.5 system-ui}#host{position:relative;width:100%;height:100dvh}.tm-modal--tab{position:relative;inset:auto;width:100%;height:100%;background:transparent}.tm-shortcut-layout{height:100%}.tm-shortcut-backdrop .b3-text-field,.tm-shortcut-backdrop .b3-select{border:1px solid #c9d2dc;border-radius:4px;padding:6px;background:#fafcfd}.tm-shortcut-backdrop .b3-button{border:1px solid #c9d2dc;border-radius:4px;padding:6px 12px;background:#edf2f6;cursor:pointer}</style><div id="host" data-tm-host-mode="tab"></div><script>${runtime.replace(/<\/script/gi, '<\\/script')}</script></html>`;
const output = path.join(root, 'output/playwright');fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'shortcut-sidebar-plugin.html'), html);
console.log('Fixture: output/playwright/shortcut-sidebar-plugin.html');
