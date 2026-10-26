'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const main = path.join(__dirname, '../src/task-horizon/main');
const source = fs.readFileSync(path.join(main, '38-shortcut-core.js'), 'utf8');
const dialog = fs.readFileSync(path.join(main, '30-dialogs-and-ui-foundation.js'), 'utf8');
const storeSource = fs.readFileSync(path.join(main, '10-stores-rules-and-cache.js'), 'utf8');
const apiSource = fs.readFileSync(path.join(main, '20-api-and-runtime-services.js'), 'utf8');
const projectionSource = fs.readFileSync(path.join(main, 'task-runtime/51-whiteboard-and-link-runtime.js'), 'utf8');
const extract = (content, declaration) => {
    const start = content.indexOf(declaration), end = content.indexOf('\n    }', start);
    assert.ok(start >= 0 && end > start, `missing ${declaration}`);
    return content.slice(start, end + 6);
};
const snapshotSource = extract(dialog, '    async function __tmLoadValidatedDocGroupSnapshot(');
const derivedSource = ['__tmBuildFilteredTaskDerivedState', '__tmGetFilteredTaskDerivedState']
    .map(name => extract(projectionSource, `    function ${name}(`)).join('\n');
const groupRuntime = ['__tmNormalizeGroupModeValue', '__tmGetCurrentGroupModeValue', '__tmGetEffectiveGroupModeValue',
    '__tmApplyGroupModeToRuntime', '__tmApplyViewProfileToRuntime', '__tmGetEffectiveViewProfileForContext', '__tmGetGroupModeLabel', '__tmGetKanbanBoardModeLongLabel']
    .map(name => extract(dialog, `    function ${name}(`)).join('\n')
    + '\n' + extract(dialog, '    async function __tmApplyCurrentContextViewProfile(');
const settingsSource = fs.readFileSync(path.join(main, 'settings/70-doc-group-and-settings-actions.js'), 'utf8');
const switchStart = settingsSource.indexOf('    window.tmSwitchGroupMode =');
const switchSource = settingsSource.slice(switchStart, settingsSource.indexOf('\n    };', switchStart) + 7);
const boardSwitchStart = settingsSource.indexOf('    window.tmSetKanbanBoardMode =');
const boardRuntime = ['__tmNormalizeKanbanBoardMode', '__tmGetStoredKanbanBoardMode', '__tmGetKanbanBoardMode', '__tmSetKanbanBoardModeState']
    .map(name => extract(apiSource, `    function ${name}(`)).join('\n')
    + '\n' + settingsSource.slice(boardSwitchStart, settingsSource.indexOf('\n    };', boardSwitchStart) + 7);
const snapshotValidation = ['__tmNormalizeTaskSnapshotDocIds', '__tmBuildTaskSnapshotScopeKey',
    '__tmIsPreservedTaskSnapshot', '__tmIsUsableTaskSnapshot', '__tmValidateTaskSnapshotForScope']
    .map(name => extract(storeSource, `    function ${name}(`)).join('\n');
const noOp = () => {};
function fixture(storage = new Map(), host = { mobile: false, dock: false }) {
    const state = {activeDocId:'all',viewMode:'checklist',currentRule:null,groupByDocName:true,openToken:0,taskTree:[{id:'doc-a'}],filterRules:[{id:'today',enabled:true},{id:'off',enabled:false}]};
    const profiles = {global:{ruleId:'global-rule',groupMode:'doc'},groups:{work:{ruleId:'group-rule',groupMode:'doc'}},allTabs:{},docTabGroups:{},docTabGroupAllTabs:{},docs:{}};
    const store = {loaded:true,data:{currentGroupId:'all',currentRule:'global-rule',groupMode:'doc',groupByDocName:true,groupByTime:false,groupByTaskName:false,quadrantConfig:{enabled:false},kanbanBoardMode:'status',kanbanHeadingGroupMode:false,docGroups:[{id:'work',name:'工作'}],docTabCustomGroups:[],viewProfiles:profiles,shortcutItems:[],shortcutNavigationSessions:JSON.parse(storage.get('settings-file')||'{}').shortcutNavigationSessions||{}},save:async()=>{storage.set('settings-file',JSON.stringify({shortcutNavigationSessions:store.data.shortcutNavigationSessions}));}};
    const events = [], invalid = [], loads = [];
    const ctx = vm.createContext({state,SettingsStore:store,console,Map,Set,Date,Math,Promise,setTimeout,clearTimeout,
        __TM_TASK_SNAPSHOT_VERSION:4,__TM_TASK_SNAPSHOT_MAX_AGE_MS:3*86400000,
        __tmIsLikelyBlockId:value=>/^\d{14}-[a-z0-9]{7}$/.test(value),
        __tmIsRuntimeMobileClient:()=>host.mobile,
        __tmIsDockHost:()=>host.dock,
        Storage:{get:(key,fallback)=>storage.has(key)?JSON.parse(storage.get(key)):fallback,
            set:(key,value)=>storage.set(key,JSON.stringify(value)),remove:key=>storage.delete(key)},
        __tmResolveDocGroupName:group=>group.name,
        __tmGetTodayDateKey:()=> '2026-10-15',
        __tmSortDocEntriesForTabs:docs=>docs,__tmGetDocTabSortMode:()=> 'manual',
        __tmGetDocPinnedIdsForGroup:()=>[],__tmResolveOptimisticTaskId:id=>id==='temp-parent'?'parent':id,
        __TM_ALL_VIEWS:['checklist','calendar','whiteboard','kanban'].map(id=>({id,label:id})),
        __tmIsViewEnabled:id=>['checklist','calendar','whiteboard','kanban'].includes(id),
        __tmGetDocTabCustomGroupScopeId:group=>group.docGroupId,
        __tmGetDocTabCustomGroupDocIdSet:()=>new Set(),
        __tmBuildDocTabCustomGroupActiveId:id=>'tab:'+id,
        __tmEnsureFilterRulesLoaded:async()=>{},
        resolveDocIdsFromGroups:async({groupId})=>groupId==='work'?['doc-a','doc-b']:['doc-a'],
        API:{call:async()=>({code:0,data:[]})},
        __tmApplyCompletedVisibilityToRuntime:noOp,
        __tmNormalizeViewProfile:(profile,fallback={})=>({...fallback,...profile}),
        __tmGetViewProfilesStore:()=>store.data.viewProfiles,
        __tmParseDocTabCustomGroupActiveId:id=>id.startsWith('tab:')?id.slice(4):'',
        __tmFindDocTabCustomGroupForProfileDoc:()=>null,
        __tmResolveContextViewDefaults:()=>({defaultViewMode:null,defaultKanbanBoardMode:null}),
        __tmFindRuleById:id=>id?{id}:null,__tmRuleNeedsDoneOnly:()=>false,
        __tmNormalizeViewProfileDefaultViewMode:value=>value||null,
        __tmNormalizeViewProfileKanbanBoardMode:value=>value||null,__tmGetSafeViewMode:value=>value,
        __tmBuildRuntimeCustomFieldLoadPlan:()=>({}),__tmDoesCustomFieldPlanNeedReload:()=>false,
        __tmCommitCustomFieldLoadPlan:async()=>{},__tmRefreshSettingsProjectionView:noOp,
        __tmCleanupPlaceholderTasks:async()=>{},__tmWarmKanbanDocHeadings:async()=>{},
        __tmRecomputeTaskProjection:noOp,render:()=>events.push('render'),recalcStats:noOp,
        __tmScheduleDocGroupSwitchVerifyAfterFirstPaint:noOp,
        hint:message=>events.push(message),
        __tmGetCurrentRule:()=>state.filterRules.find(rule=>rule.id===state.currentRule),
        RuleManager:{applyRuleFilter:(tasks,rule)=>tasks.filter(task=>!rule||task.today)},
        __tmShortcutSidebar:{refresh:noOp,closeDrawer:noOp,showInvalid:(item,issues)=>invalid.push({item,issues})},
        loadSelectedDocuments:async()=>{loads.push(state.openToken);},
    });
    ctx.window=ctx;
    vm.runInContext(snapshotValidation+'\n'+snapshotSource+'\n'+groupRuntime+'\n'+boardRuntime+'\n'+derivedSource+'\n'+source+'\n'+switchSource+'\nglobalThis.core=__tmShortcuts;',ctx);
    const shortcut = (id, patch={}) => ({id,name:id,icon:{type:'phosphor',name:'sun'},groupId:'all',tabGroupId:'',docId:'all',viewId:'checklist',ruleId:'today',...patch});
    return {ctx,core:ctx.core,state,store,events,invalid,loads,shortcut,profiles};
}
(async()=>{
    const f=fixture(),{core,state,store,shortcut,invalid}=f;
    store.data.shortcutItems=[shortcut('today'),shortcut('missing',{groupId:'deleted'}),shortcut('off',{ruleId:'off'}),shortcut('deleted-doc',{docId:'deleted'}),shortcut('hidden-view',{viewId:'timeline'})];
    const defaults=JSON.stringify(store.data.viewProfiles);
    assert.equal(await core.open('today'),true);
    assert.equal(state.currentRule,'today');assert.equal(store.data.currentRule,'global-rule');assert.equal(JSON.stringify(store.data.viewProfiles),defaults);
    const active={group:store.data.currentGroupId,doc:state.activeDocId,view:state.viewMode,rule:state.currentRule};
    for(const id of ['missing','off','deleted-doc','hidden-view']){
        assert.equal(await core.open(id),false);assert.deepEqual({group:store.data.currentGroupId,doc:state.activeDocId,view:state.viewMode,rule:state.currentRule},active);
    }
    assert.equal(invalid.length,4);
    assert.equal(core.normalize(store.data.shortcutItems).length,5,'normalization retains invalid references');
    assert.equal(core.activeId(),'today');core.updateContext({viewId:'calendar'});state.viewMode='calendar';assert.equal(core.activeId(),'','manual changes do not keep a misleading active shortcut');
    assert.equal(core.items().find(item=>item.id==='today').viewId,'checklist','manual changes do not rewrite saved shortcut');
    assert.deepEqual(core.filterHomepageTasks([{today:true},{today:false}]),[{today:true}]);core.clearContext();assert.equal(core.filterHomepageTasks([{today:true},{today:false}]).length,2);
    store.save=async()=>{throw new Error('disk full');};const before=store.data.shortcutItems;
    await assert.rejects(core.save([shortcut('new')]),/disk full/);assert.equal(store.data.shortcutItems,before,'failed persistence rolls back definition edits');
    const racing=fixture();racing.store.data.shortcutItems=[racing.shortcut('slow',{docId:'doc-a'}),racing.shortcut('latest',{groupId:'work',viewId:'whiteboard',ruleId:''})];
    let finishScope;racing.ctx.resolveDocIdsFromGroups=()=>new Promise(resolve=>{finishScope=resolve;});
    const first=racing.core.open('slow');await Promise.resolve();await Promise.resolve();
    assert.equal(await racing.core.open('latest'),true);finishScope(['doc-a']);assert.equal(await first,false);
    assert.equal(racing.state.viewMode,'whiteboard');assert.equal(racing.store.data.currentGroupId,'work');
    for(const stage of ['rules','documents','tasks','save']){
        const closing=fixture();
        closing.store.data.shortcutItems=[closing.shortcut('pending',{groupId:'work',docId:'doc-a'})];
        let drawerClosed=0,release,started;
        const pending=new Promise(resolve=>{release=resolve;}),entered=new Promise(resolve=>{started=resolve;});
        const wait=()=>{started();return pending;};
        closing.ctx.__tmShortcutSidebar.closeDrawer=()=>drawerClosed++;
        if(stage==='rules')closing.ctx.__tmEnsureFilterRulesLoaded=wait;
        if(stage==='documents')closing.ctx.resolveDocIdsFromGroups=wait;
        if(stage==='tasks')closing.ctx.loadSelectedDocuments=wait;
        if(stage==='save')closing.store.save=wait;
        const opening=closing.core.open('pending');
        assert.equal(drawerClosed,1,stage+': clicking closes the drawer synchronously');
        await entered;
        assert.equal(drawerClosed,1,stage+': the drawer is closed while navigation is pending');
        release(stage==='documents'?['doc-a','doc-b']:undefined);
        assert.equal(await opening,true,stage+': navigation completes after closing the drawer');
        assert.equal(drawerClosed,1,stage+': completing an old navigation must not close the drawer again');
    }
    const counting=fixture();counting.store.data.shortcutItems=[counting.shortcut('today'),counting.shortcut('work',{groupId:'work',ruleId:''})];
    counting.state.currentRule='today';
    counting.state.filteredTasks=Array.from({length:6},(_,index)=>({id:String(index)}));
    counting.state.flatTasks=Object.fromEntries(Array.from({length:10},(_,index)=>[String(index),{id:String(index),today:true}]));
    counting.ctx.resolveDocIdsFromGroups=()=>{throw new Error('Counting must not load another task scope');};
    assert.equal(counting.core.counts().get('today'),6,'shortcut count is the same final projection as the topbar, not ten raw matches');
    assert.equal(counting.core.counts().has('work'),false,'an unopened scope cannot overwrite a cached count');
    const parent={id:'parent',pinned:true},child={id:'child',parentTaskId:'parent'};
    const roots=[parent,...Array.from({length:4},(_,index)=>({id:`root-${index}`,pinned:index<3}))];
    counting.state.filteredTasks=[...roots,child];
    assert.equal(counting.core.counts().get('today'),5,'four pinned roots and one normal root count as five even with a matching child');
    counting.state.filteredTasks=[...roots,child,{id:'grandchild',parent_task_id:'child'}];
    assert.equal(counting.core.counts().get('today'),5,'nested descendants must not inflate shortcut counts');
    counting.state.filteredTasks=[child];
    assert.equal(counting.core.counts().get('today'),1,'a child whose parent is filtered out counts as an independent result');
    counting.state.filteredTasks=[parent,{...child,parentTaskId:'temp-parent'}];
    assert.equal(counting.core.counts().get('today'),1,'optimistic parent aliases must use the same hierarchy as the topbar');
    counting.state.filteredTasks=[];
    assert.equal(counting.core.counts().get('today'),0,'empty shortcuts must show zero');
    counting.state.filteredTasks=[...roots,child];
    const key=counting.core.countKey(counting.core.items()[0]);
    const legacyKey=JSON.stringify(['all','','all','checklist','today','', '',true,undefined,
        [counting.store.data.docGroups,undefined,undefined],null,'2026-10-15',undefined,undefined,undefined,undefined]);
    counting.ctx.Storage.set('tm_shortcut_counts',{today:{key:legacyKey,count:6}});
    const countSidebarSource=fs.readFileSync(path.join(main,'38-shortcut-sidebar.js'),'utf8');
    const cacheStart=countSidebarSource.indexOf('        const lastCounts = new Map(');
    const cacheEnd=countSidebarSource.indexOf('        let hoverId =',cacheStart);
    assert.ok(cacheStart>=0&&cacheEnd>cacheStart);
    vm.runInContext(countSidebarSource.slice(cacheStart,cacheEnd),counting.ctx);
    counting.store.data.currentGroupId='work';counting.state.currentRule=null;counting.state.filteredTasks=[{id:'work-1'}];
    assert.equal(vm.runInContext('cachedCount(__tmShortcuts.items()[0])',counting.ctx),null,'unopened shortcuts must reject cached counts from the old all-task policy');
    counting.store.data.currentGroupId='all';counting.state.currentRule='today';counting.state.filteredTasks=[...roots,child];
    vm.runInContext('rememberCounts()',counting.ctx);
    assert.equal(vm.runInContext('cachedCount(__tmShortcuts.items()[0])',counting.ctx),5,'reopening stores the corrected root count');
    assert.equal(counting.ctx.Storage.get('tm_shortcut_counts').today.count,5,'the corrected count must survive a sidebar reload');
    counting.store.data.currentGroupId='work';counting.state.currentRule=null;counting.state.filteredTasks=[{},{}];
    assert.equal(counting.core.counts().get('work'),2);
    assert.equal(counting.core.countKey(counting.core.items()[0]),key,'navigation does not invalidate another shortcut count');
    const loader=fs.readFileSync(path.join(main,'task-runtime/53c-document-loader-runtime.js'),'utf8');
    const start=loader.indexOf('        const shortcutContext ='),end=loader.indexOf('\n',loader.indexOf('        state.currentRule =',start));
    assert.ok(start>0&&end>start);
    for(const ruleId of ['today','']){
        const loading=fixture();loading.store.data.shortcutItems=[loading.shortcut('first',{groupId:'work',ruleId})];
        loading.ctx.loadSelectedDocuments=async()=>{vm.runInContext(loader.slice(start,end),loading.ctx);};
        assert.equal(await loading.core.open('first'),true);
        assert.equal(loading.state.currentRule,ruleId||null,'the real loader initialization preserves the first click override');
        assert.equal(loading.store.data.currentRule,'global-rule');
    }
    const grouping=fixture(), groupModes=['none','doc','time','quadrant','task'];
    grouping.store.data.shortcutItems=groupModes.map(groupMode=>grouping.shortcut(groupMode,{groupMode}));
    grouping.store.data.shortcutItems.push(grouping.shortcut('legacy'),grouping.shortcut('invalid-mode',{groupMode:'unknown'}));
    const groupDefaults=JSON.stringify(grouping.store.data);
    await grouping.core.save(grouping.core.items());
    assert.equal(grouping.core.items().find(item=>item.id==='invalid-mode').groupMode,'','unknown modes preserve the current grouping');
    for(const groupMode of groupModes){
        await grouping.core.open('task');
        assert.equal(await grouping.core.open(groupMode),true);
        assert.equal(grouping.ctx.__tmGetCurrentGroupModeValue(),groupMode);
        assert.equal(grouping.core.activeId(),groupMode);
        assert.equal(['groupByDocName','groupByTime','groupByTaskName','quadrantEnabled'].filter(key=>grouping.state[key]).length,groupMode==='none'?0:1,'all grouping flags remain mutually exclusive');
        vm.runInContext('{'+loader.slice(start,end)+'}',grouping.ctx);
        await grouping.ctx.__tmApplyCurrentContextViewProfile();
        assert.equal(grouping.ctx.__tmGetCurrentGroupModeValue(),groupMode,'reload and profile reapplication preserve shortcut grouping');
    }
    grouping.state.filteredTasks=[{},{}];
    assert.equal(grouping.core.counts().get('task'),2);
    assert.equal(grouping.core.counts().has('doc'),false,'a different grouping cannot overwrite another shortcut count');
    const normalizedDefaults=JSON.parse(groupDefaults);
    for(const key of ['groupMode','groupByDocName','groupByTime','groupByTaskName','quadrantConfig','viewProfiles','currentRule']){
        assert.equal(JSON.stringify(grouping.store.data[key]),JSON.stringify(normalizedDefaults[key]),`${key} stays unchanged during shortcut navigation and reload`);
    }
    await grouping.ctx.tmSwitchGroupMode('time');
    assert.equal(grouping.ctx.__tmGetCurrentGroupModeValue(),'time');
    assert.equal(grouping.core.context().groupMode,'time');
    assert.equal(grouping.core.activeId(),'','manual grouping changes clear the saved shortcut highlight');
    assert.equal(grouping.core.items().find(item=>item.id==='task').groupMode,'task');
    for(const key of ['groupMode','groupByDocName','groupByTime','groupByTaskName','quadrantConfig','viewProfiles','currentRule']){
        assert.equal(JSON.stringify(grouping.store.data[key]),JSON.stringify(normalizedDefaults[key]),`manual grouping also preserves ${key}`);
    }
    vm.runInContext('{'+loader.slice(start,end)+'}',grouping.ctx);
    assert.equal(grouping.ctx.__tmGetCurrentGroupModeValue(),'time','manual grouping survives a loader refresh');
    assert.equal(await grouping.core.open('legacy'),true);
    assert.equal(grouping.ctx.__tmGetCurrentGroupModeValue(),'time','old shortcuts preserve the grouping used before opening');
    assert.equal(await grouping.core.open('task'),true,'reopening restores the saved grouping');
    assert.equal(grouping.ctx.__tmGetCurrentGroupModeValue(),'task');
    const savedKey=grouping.core.countKey(grouping.core.items()[0]);
    assert.notEqual(grouping.core.countKey({...grouping.core.items()[0],groupMode:'doc'}),savedKey,'grouping participates in count cache identity');
    grouping.core.clearContext();
    await grouping.ctx.__tmApplyCurrentContextViewProfile();
    assert.equal(grouping.ctx.__tmGetCurrentGroupModeValue(),'doc','leaving shortcuts restores the normal profile');
    await grouping.core.open('time');
    const previousContext=grouping.core.context();
    grouping.store.data.shortcutItems.push(grouping.shortcut('failed',{groupId:'work',groupMode:'quadrant'}));
    grouping.ctx.loadSelectedDocuments=async()=>{throw new Error('load failed');};
    assert.equal(await grouping.core.open('failed'),false);
    assert.equal(grouping.core.context(),previousContext);
    assert.equal(grouping.ctx.__tmGetCurrentGroupModeValue(),'time','failed opening restores the previous grouping');
    assert.equal(grouping.core.activeId(),'time');
    for(const failure of ['returned-false','thrown']){
        const failed=fixture();
        failed.store.data.shortcutItems=[failed.shortcut('original',{groupMode:'time'}),failed.shortcut('failed',{groupId:'work',viewId:'kanban',kanbanBoardMode:'heading',groupMode:'quadrant',ruleId:''})];
        await failed.core.open('original');
        failed.state.searchKeyword='previous search';
        failed.state.docTabsArchiveMode=true;
        const previous=failed.core.context();
        let drawerClosed=0;
        failed.ctx.__tmShortcutSidebar.closeDrawer=()=>drawerClosed++;
        failed.ctx.loadSelectedDocuments=async()=>{
            failed.state.currentRule=null;
            if(failure==='thrown')throw new Error('load failed');
            return false;
        };
        const paints=failed.events.filter(event=>event==='render').length;
        assert.equal(await failed.core.open('failed'),false,failure+' cannot report successful navigation');
        assert.equal(failed.store.data.currentGroupId,'all');
        assert.equal(failed.state.viewMode,'checklist');
        assert.equal(failed.core.context(),previous);
        assert.equal(failed.core.activeId(),'original');
        assert.equal(failed.ctx.__tmGetCurrentGroupModeValue(),'time');
        assert.equal(failed.state.searchKeyword,'previous search');
        assert.equal(failed.state.docTabsArchiveMode,true);
        assert.equal(drawerClosed,1,'the drawer closes on click even when loading fails');
        assert.ok(failed.events.filter(event=>event==='render').length>paints,'failure repaints the restored navigation');
        assert.ok(failed.events.some(event=>String(event).includes('打开快捷项失败')));
        failed.ctx.loadSelectedDocuments=async()=>{};
        assert.equal(await failed.core.open('failed'),true,'a subsequent attempt can succeed');
        assert.equal(drawerClosed,2,'retrying closes the drawer immediately again');
    }
    const staleFailure=fixture();
    staleFailure.store.data.shortcutItems=[staleFailure.shortcut('slow',{groupId:'work',viewId:'kanban'}),staleFailure.shortcut('latest',{groupId:'all',viewId:'whiteboard',ruleId:''})];
    let failOldLoad,loadStarted;
    const oldLoad=new Promise(resolve=>{failOldLoad=resolve;}),didStartLoad=new Promise(resolve=>{loadStarted=resolve;});
    staleFailure.ctx.loadSelectedDocuments=()=>{loadStarted();return oldLoad;};
    const oldOpen=staleFailure.core.open('slow');await didStartLoad;
    staleFailure.ctx.loadSelectedDocuments=async()=>{};
    assert.equal(await staleFailure.core.open('latest'),true);
    failOldLoad(false);assert.equal(await oldOpen,false);
    assert.equal(staleFailure.store.data.currentGroupId,'all');
    assert.equal(staleFailure.state.viewMode,'whiteboard','an older failure cannot roll back a later click');
    assert.equal(staleFailure.core.activeId(),'latest');
    assert.equal(staleFailure.events.filter(event=>String(event).includes('打开快捷项失败')).length,0);
    const rememberedStorage=new Map();
    const remembered=fixture(rememberedStorage);
    remembered.store.data.shortcutItems=[remembered.shortcut('remembered',{groupId:'work',viewId:'kanban',ruleId:'today',groupMode:'quadrant',kanbanBoardMode:'heading'})];
    assert.equal(await remembered.core.open('remembered'),true);
    const rememberedItems=JSON.parse(JSON.stringify(remembered.store.data.shortcutItems));
    const coldStorage=new Map([...rememberedStorage].filter(([key])=>key==='settings-file'));
    const coldRestarted=fixture(coldStorage);coldRestarted.store.data.shortcutItems=rememberedItems;
    assert.equal(await coldRestarted.core.restoreSession(),true,'a cold start restores from plugin settings without the old browser origin storage');
    assert.equal(coldRestarted.core.activeId(),'remembered');
    remembered.core.clearContext({preserveSession:true});
    const restarted=fixture(rememberedStorage);restarted.store.data.shortcutItems=rememberedItems;
    const restartedDefaults=JSON.stringify(restarted.store.data);
    assert.equal(await restarted.core.restoreSession(),true,'a new plugin runtime restores the last shortcut');
    assert.equal(restarted.store.data.currentGroupId,'work');
    assert.equal(restarted.state.viewMode,'kanban');assert.equal(restarted.state.currentRule,'today');
    assert.equal(restarted.ctx.__tmGetCurrentGroupModeValue(),'quadrant');
    assert.equal(restarted.ctx.__tmGetKanbanBoardMode(),'heading');
    assert.equal(restarted.core.activeId(),'remembered');
    assert.equal(restarted.loads.length,0,'restoration leaves task loading to the normal startup loader');
    assert.equal(restarted.store.data.currentRule,'global-rule');
    assert.equal(JSON.stringify(restarted.store.data.viewProfiles),JSON.stringify(JSON.parse(restartedDefaults).viewProfiles));
    assert.equal(restarted.ctx.__tmGetStoredKanbanBoardMode(),'status');
    const lifecycle=fs.readFileSync(path.join(main,'shell/80-shell-lifecycle.js'),'utf8');
    const cold=fixture(new Map(rememberedStorage));cold.store.data.shortcutItems=rememberedItems;
    class HostElement {}
    const firstPaints=[],firstLoads=[];
    Object.assign(cold.ctx,{
        Element:HostElement,HTMLElement:HostElement,document:{body:{contains:()=>false}},__tmMountEl:{},
        __tmMarkContextInteractionQuiet:noOp,__tmListenPinnedChanged:noOp,__tmEnsureMount:noOp,
        __tmEnsureSettingsLoaded:async()=>{},__tmIsMobileDevice:()=>false,__tmGetConfiguredDefaultViewMode:()=> 'checklist',
        __tmReadManagerModalRenderMode:()=>'',__tmGetExpectedManagerRenderMode:()=>cold.state.viewMode,
        __tmHasQuickbarModificationsSync:()=>false,__tmRefreshNotebookCache:async()=>{},checkAnyGroupHasDocs:async()=>true,
        setTimeout:()=>1,requestAnimationFrame:callback=>callback(),
        render:()=>{cold.state.modal=new HostElement();firstPaints.push([cold.state.viewMode,cold.state.currentRule,cold.ctx.__tmGetKanbanBoardMode()]);},
        loadSelectedDocuments:async()=>{firstLoads.push([cold.state.viewMode,cold.state.currentRule,cold.core.activeId()]);},
    });
    vm.runInContext(extract(lifecycle,'    async function openManager('),cold.ctx);
    await cold.ctx.openManager({skipEnsureTabOpened:true,awaitInitialLoad:true});
    assert.deepEqual(firstPaints,[['kanban','today','heading']],'the first startup paint already uses the saved shortcut instead of the configured default view');
    assert.deepEqual(firstLoads,[['kanban','today','remembered']],'startup issues one normal task load using the restored rule');
    const initStart=lifecycle.indexOf('            // 初始化状态'),initEnd=lifecycle.indexOf('            state.columnWidths =',initStart);
    assert.ok(initStart>=0&&initEnd>initStart);
    cold.ctx.__TM_TASK_INDEX_QUERY_LIMIT=500;
    vm.runInContext('{'+lifecycle.slice(initStart,initEnd)+'}',cold.ctx);
    assert.equal(cold.state.currentRule,'today','late shell initialization cannot reset the restored shortcut rule');
    assert.equal(cold.ctx.__tmGetCurrentGroupModeValue(),'quadrant');
    restarted.state.viewMode='calendar';
    assert.equal(await restarted.core.restoreSession(),false,'a later manager open does not overwrite current navigation');
    assert.equal(restarted.state.viewMode,'calendar');
    restarted.core.updateContext({viewId:'calendar',ruleId:'',groupMode:'time',kanbanBoardMode:'time'});
    const modified=fixture(rememberedStorage);modified.store.data.shortcutItems=rememberedItems;
    assert.equal(await modified.core.restoreSession(),true);
    assert.equal(modified.state.viewMode,'calendar');assert.equal(modified.state.currentRule,null);
    assert.equal(modified.ctx.__tmGetCurrentGroupModeValue(),'time','manual shortcut overrides also survive reload');
    assert.equal(modified.core.activeId(),'','modified navigation does not highlight the unchanged shortcut definition');
    modified.core.clearContext();
    const exited=fixture(rememberedStorage);exited.store.data.shortcutItems=rememberedItems;
    assert.equal(await exited.core.restoreSession(),false,'leaving shortcuts clears the saved navigation');
    assert.equal(exited.store.data.currentGroupId,'all');
    for(const invalidSession of ['deleted-shortcut','deleted-group','disabled-view','deleted-rule']){
        const cache=new Map(),saved=fixture(cache);saved.store.data.shortcutItems=rememberedItems;
        await saved.core.open('remembered');
        const invalid=fixture(cache);invalid.store.data.shortcutItems=JSON.parse(JSON.stringify(rememberedItems));
        if(invalidSession==='deleted-shortcut')invalid.store.data.shortcutItems=[];
        if(invalidSession==='deleted-group')invalid.store.data.docGroups=[];
        if(invalidSession==='disabled-view')invalid.ctx.__tmIsViewEnabled=()=>false;
        if(invalidSession==='deleted-rule')invalid.state.filterRules=[];
        assert.equal(await invalid.core.restoreSession(),false,invalidSession+' falls back to normal startup');
        assert.equal(invalid.state.shortcutContext,undefined);
        assert.ok(Object.values(invalid.store.data.shortcutNavigationSessions).every(value=>value===null),'invalid saved navigation is cleared in plugin settings');
    }
    const isolatedStorage=new Map(),desktopHost={mobile:false,dock:false};
    const desktop=fixture(isolatedStorage,desktopHost);desktop.store.data.shortcutItems=rememberedItems;await desktop.core.open('remembered');
    for(const host of [{mobile:false,dock:true},{mobile:true,dock:false}]){
        const other=fixture(isolatedStorage,host);other.store.data.shortcutItems=rememberedItems;
        assert.equal(await other.core.restoreSession(),false,'another device or entry does not adopt the saved tab shortcut');
    }
    const failedRestore=fixture(new Map(isolatedStorage));failedRestore.store.data.shortcutItems=rememberedItems;
    failedRestore.ctx.__tmEnsureFilterRulesLoaded=async()=>{throw new Error('rules unavailable');};
    assert.equal(await failedRestore.core.restoreSession(),false);
    failedRestore.ctx.__tmEnsureFilterRulesLoaded=async()=>{};
    assert.equal(await failedRestore.core.restoreSession(),true,'a temporary rules read failure does not discard saved navigation');
    const docStorage=new Map(),docNavigation=fixture(docStorage);
    docNavigation.store.data.shortcutItems=[docNavigation.shortcut('document',{groupId:'work',docId:'doc-a',viewId:'kanban'})];
    await docNavigation.core.open('document');
    const missingDocument=fixture(new Map(docStorage));missingDocument.store.data.shortcutItems=docNavigation.store.data.shortcutItems;
    missingDocument.ctx.resolveDocIdsFromGroups=async()=>[];
    assert.equal(await missingDocument.core.restoreSession(),false,'a document removed from its scope cannot restore an empty shortcut view');
    const unavailableDocument=fixture(new Map(docStorage));unavailableDocument.store.data.shortcutItems=docNavigation.store.data.shortcutItems;
    unavailableDocument.ctx.resolveDocIdsFromGroups=async()=>{throw new Error('scope unavailable');};
    assert.equal(await unavailableDocument.core.restoreSession(),false);
    unavailableDocument.ctx.resolveDocIdsFromGroups=async()=>['doc-a'];
    assert.equal(await unavailableDocument.core.restoreSession(),true,'a transient scope failure retains the saved navigation for a later retry');
    assert.equal(unavailableDocument.state.activeDocId,'doc-a');
    const cancelledRestore=fixture(new Map(docStorage));cancelledRestore.store.data.shortcutItems=[...docNavigation.store.data.shortcutItems,cancelledRestore.shortcut('newer')];
    let resolveRestoredScope,restoredScopeStarted;
    const restoringScope=new Promise(resolve=>{resolveRestoredScope=resolve;}),restoringScopeDidStart=new Promise(resolve=>{restoredScopeStarted=resolve;});
    cancelledRestore.ctx.resolveDocIdsFromGroups=()=>{restoredScopeStarted();return restoringScope;};
    const restoring=cancelledRestore.core.restoreSession();await restoringScopeDidStart;
    await cancelledRestore.core.open('newer');resolveRestoredScope(['doc-a']);
    assert.equal(await restoring,false,'an old restore cannot replace newer user navigation');
    assert.equal(cancelledRestore.core.activeId(),'newer');
    const inFlightCache=new Map(),inFlight=fixture(inFlightCache);inFlight.store.data.shortcutItems=rememberedItems;
    await inFlight.core.open('remembered');
    const committedNavigation=JSON.stringify([...inFlightCache]);
    inFlight.store.data.shortcutItems.push(inFlight.shortcut('failed-persist',{groupId:'all',viewId:'whiteboard',ruleId:''}));
    inFlight.ctx.loadSelectedDocuments=async()=>false;
    assert.equal(await inFlight.core.open('failed-persist'),false);
    assert.equal(JSON.stringify([...inFlightCache]),committedNavigation,'failed navigation cannot overwrite the last successful session');
    const boards=fixture(), boardModes=['heading','time','status'];
    boards.store.data.shortcutItems=boardModes.map(kanbanBoardMode=>boards.shortcut(kanbanBoardMode,{viewId:'kanban',kanbanBoardMode}));
    boards.store.data.shortcutItems.push(boards.shortcut('legacy-board',{viewId:'kanban'}));
    const boardDefaults=JSON.stringify(boards.store.data);
    await boards.core.save(boards.core.items());
    assert.equal(boards.core.normalize([boards.shortcut('unknown',{kanbanBoardMode:'unknown'})])[0].kanbanBoardMode,'');
    assert.equal(boards.core.normalize([boards.shortcut('uppercase',{kanbanBoardMode:'TIME'})])[0].kanbanBoardMode,'time');
    for(const mode of boardModes){
        assert.equal(await boards.core.open(mode),true);
        assert.equal(boards.ctx.__tmGetKanbanBoardMode(),mode);
        assert.equal(boards.core.activeId(),mode);
        vm.runInContext('{'+loader.slice(start,end)+'}',boards.ctx);
        await boards.ctx.__tmApplyCurrentContextViewProfile();
        assert.equal(boards.ctx.__tmGetKanbanBoardMode(),mode,'board mode survives reload and profile reapplication');
        assert.equal(boards.ctx.__tmGetStoredKanbanBoardMode(),'status','runtime board mode does not change the persistent default');
    }
    boards.state.filteredTasks=[{},{}];
    assert.equal(boards.core.counts().get('status'),2);
    assert.equal(boards.core.counts().has('heading'),false,'counts distinguish different board modes');
    await boards.ctx.tmSetKanbanBoardMode('heading');
    assert.equal(boards.ctx.__tmGetKanbanBoardMode(),'heading');
    assert.equal(boards.core.activeId(),'','manual board changes clear the saved shortcut highlight');
    assert.equal(boards.core.items().find(item=>item.id==='status').kanbanBoardMode,'status');
    await boards.ctx.__tmApplyCurrentContextViewProfile();
    assert.equal(boards.ctx.__tmGetKanbanBoardMode(),'heading','manual board changes survive profile reapplication');
    for(const key of ['kanbanBoardMode','kanbanHeadingGroupMode','viewProfiles']){
        assert.equal(JSON.stringify(boards.store.data[key]),JSON.stringify(JSON.parse(boardDefaults)[key]),`board switching preserves ${key}`);
    }
    assert.equal(await boards.core.open('legacy-board'),true);
    assert.equal(boards.ctx.__tmGetKanbanBoardMode(),'heading','old board shortcuts preserve the current board mode');
    boards.store.data.shortcutItems.push(boards.shortcut('hidden-board-mode',{kanbanBoardMode:'time'}));
    assert.equal(await boards.core.open('hidden-board-mode'),true);
    assert.equal(boards.ctx.__tmGetKanbanBoardMode(),'heading','board settings do not apply to a non-board shortcut');
    await boards.core.open('heading');
    const previousBoardContext=boards.core.context();
    boards.store.data.shortcutItems.push(boards.shortcut('failed-board',{groupId:'work',viewId:'kanban',kanbanBoardMode:'time'}));
    boards.ctx.loadSelectedDocuments=async()=>{throw new Error('board load failed');};
    assert.equal(await boards.core.open('failed-board'),false);
    assert.equal(boards.core.context(),previousBoardContext);
    assert.equal(boards.ctx.__tmGetKanbanBoardMode(),'heading','failed opening restores the previous board mode');
    const headingItem=boards.core.items().find(item=>item.id==='heading');
    assert.notEqual(boards.core.countKey(headingItem),boards.core.countKey({...headingItem,kanbanBoardMode:'time'}));
    boards.core.clearContext();
    assert.equal(boards.ctx.__tmGetKanbanBoardMode(),'status','leaving shortcuts restores the persistent board mode');
    const docA='20261015000000-aaaaaaa',docB='20261015000000-bbbbbbb';
    const snapshot={version:4,groupId:'work',createdAt:Date.now(),scopeKey:'work|'+[docA,docB].join(','),docIds:[docA,docB],
        taskTree:[{id:docA,tasks:[{id:'now',today:true},{id:'later',today:false}]},{id:docB,tasks:[]}]};
    const cachedFixture=()=>{
        const value=fixture(),restores=[],paints=[],verifies=[];
        value.store.data.shortcutItems=[value.shortcut('cached',{groupId:'work',groupMode:'quadrant'})];
        value.ctx.resolveDocIdsFromGroups=async()=>[docA,docB];
        value.ctx.__tmTaskSnapshotService={loadLatestForGroup:async()=>snapshot,
            restore:(entry,options)=>{restores.push(options);value.state.taskTree=entry.taskTree;return {taskCount:2};},
            restoreViewState:()=>{throw new Error('Never restore another shortcut rule projection');}};
        value.ctx.__tmRecomputeTaskProjection=()=>{value.state.filteredTasks=value.core.filterHomepageTasks(value.state.taskTree.flatMap(doc=>doc.tasks||[]));};
        value.ctx.render=()=>paints.push(value.state.filteredTasks.map(task=>task.id));
        value.ctx.__tmScheduleDocGroupSwitchVerifyAfterFirstPaint=options=>verifies.push(options);
        return {...value,restores,paints,verifies};
    };
    const fast=cachedFixture();
    assert.equal(await fast.core.open('cached'),true);
    assert.equal(fast.loads.length,0,'a valid group snapshot avoids the full task query before first paint');
    assert.equal(fast.restores.length,1);
    assert.deepEqual(fast.paints,[['now']],'the first cached paint already uses the shortcut rule');
    assert.equal(fast.verifies[0].source,'shortcut:snapshot-verify','reuse existing deferred freshness verification');
    assert.equal(fast.state.currentRule,'today');assert.equal(fast.store.data.currentRule,'global-rule');
    assert.equal(fast.ctx.__tmGetCurrentGroupModeValue(),'quadrant','the cached first paint uses shortcut grouping');
    const boardFast=cachedFixture();
    Object.assign(boardFast.store.data.shortcutItems[0],{viewId:'kanban',kanbanBoardMode:'heading'});
    let paintedBoardMode='';
    boardFast.ctx.render=()=>{paintedBoardMode=boardFast.ctx.__tmGetKanbanBoardMode();};
    assert.equal(await boardFast.core.open('cached'),true);
    assert.equal(boardFast.loads.length,0);
    assert.equal(paintedBoardMode,'heading','the cached first paint already uses the shortcut board mode');
    assert.equal(boardFast.ctx.__tmGetStoredKanbanBoardMode(),'status');
    for(const [label,patch] of [
        ['foreign group',{groupId:'all'}],['changed document scope',{docIds:[docA],scopeKey:'work|'+docA}],
        ['unexpected tree document',{taskTree:[{id:'20261015000000-ccccccc',tasks:[]}]}],
    ]){
        const stale=cachedFixture();stale.ctx.__tmTaskSnapshotService.loadLatestForGroup=async()=>({...snapshot,...patch});
        assert.equal(await stale.core.open('cached'),true);
        assert.equal(stale.restores.length,0,label+' cannot restore stale tasks');assert.equal(stale.loads.length,1,label+' falls back to the document loader');
    }
    const missing=cachedFixture();missing.ctx.__tmTaskSnapshotService.loadLatestForGroup=async()=>null;
    assert.equal(await missing.core.open('cached'),true);assert.equal(missing.loads.length,1);
    const timeout=cachedFixture();timeout.ctx.__tmTaskSnapshotService.loadLatestForGroup=()=>new Promise(()=>{});
    assert.equal(await timeout.core.open('cached'),true);assert.equal(timeout.loads.length,1,'a stalled snapshot cannot block fallback loading');
    const customFields=cachedFixture();customFields.ctx.__tmApplyCurrentContextViewProfile=async()=>{customFields.state.currentRule='today';return {customFieldReloadNeeded:true};};
    assert.equal(await customFields.core.open('cached'),true);assert.equal(customFields.restores.length,0);assert.equal(customFields.loads.length,1,'new required custom fields still reload before filtering');
    const interrupted=cachedFixture();
    Object.assign(interrupted.store.data.shortcutItems[0],{viewId:'kanban',kanbanBoardMode:'heading'});
    interrupted.store.data.shortcutItems.push(interrupted.shortcut('latest',{groupId:'all',viewId:'kanban',kanbanBoardMode:'time',ruleId:'',groupMode:'time'}));
    let releaseSnapshot,startedSnapshot;
    const pending=new Promise(resolve=>{releaseSnapshot=resolve;}),started=new Promise(resolve=>{startedSnapshot=resolve;});
    interrupted.ctx.__tmTaskSnapshotService.loadLatestForGroup=groupId=>{if(groupId==='work'){startedSnapshot();return pending;}return null;};
    const pendingOpen=interrupted.core.open('cached');await started;
    assert.equal(await interrupted.core.open('latest'),true);releaseSnapshot(snapshot);assert.equal(await pendingOpen,false);
    assert.equal(interrupted.restores.length,0,'a superseded snapshot cannot replace the newest target');
    assert.equal(interrupted.store.data.currentGroupId,'all');assert.equal(interrupted.state.currentRule,null);
    assert.equal(interrupted.ctx.__tmGetCurrentGroupModeValue(),'time','an older cached opening cannot override the latest grouping');
    assert.equal(interrupted.ctx.__tmGetKanbanBoardMode(),'time','an older cached opening cannot override the latest board mode');
    const sidebarSource=fs.readFileSync(path.join(main,'38-shortcut-sidebar.js'),'utf8');
    const exportMarker='return { mount, refresh, closeDrawer, showInvalid, edit, dispose, syncEnabled, iconHtml };';
    assert.ok(sidebarSource.includes(exportMarker));
    const testSidebar=sidebarSource.replace(exportMarker,'return { preferences, restorePreferences, persistPreferences };');
    const restartSidebar=(file={},cache={},mobile=false)=>{
        let savedFile=JSON.parse(JSON.stringify(file));
        const sessionStore={loaded:false,data:{shortcutSidebarPreferences:{}},save:async()=>{savedFile=JSON.parse(JSON.stringify(sessionStore.data.shortcutSidebarPreferences));}};
        const context=vm.createContext({SettingsStore:sessionStore,
            Storage:{get:(key,fallback)=>cache[key]??fallback,set:(key,value)=>{cache[key]=JSON.parse(JSON.stringify(value));}},
            __tmIsRuntimeMobileClient:()=>mobile,hint:noOp});
        vm.runInContext(testSidebar+'\nglobalThis.sidebar=__tmShortcutSidebar;',context);
        context.sidebar.restorePreferences();
        sessionStore.data.shortcutSidebarPreferences=JSON.parse(JSON.stringify(file));sessionStore.loaded=true;
        context.sidebar.restorePreferences();
        return {sidebar:context.sidebar,store:sessionStore,file:()=>savedFile};
    };
    for(const mode of ['full','rail','hidden']){
        const session=restartSidebar();Object.assign(session.sidebar.preferences,{mode,width:280,edgePosition:.27,hideGuideAcknowledged:true});
        session.sidebar.persistPreferences();await Promise.resolve();
        const restarted=restartSidebar(session.file(),{});
        assert.equal(restarted.sidebar.preferences.mode,mode,'desktop mode restores after all local caches are lost');
        assert.equal(restarted.sidebar.preferences.width,280,'sidebar width restores from the settings file');
        assert.equal(restarted.sidebar.preferences.edgePosition,.27,'floating button position restores from the settings file');
        assert.equal(restarted.sidebar.preferences.hideGuideAcknowledged,true,'hide-guide acknowledgement restores from the settings file');
    }
    const persistedDesktop={desktop:{mode:'rail',width:260,edgePosition:.3}};
    const mobileSession=restartSidebar(persistedDesktop,{},true);
    Object.assign(mobileSession.sidebar.preferences,{mode:'hidden',edgePosition:.7});mobileSession.sidebar.persistPreferences();await Promise.resolve();
    assert.deepEqual(mobileSession.file().desktop,persistedDesktop.desktop,'mobile state saves cannot overwrite desktop state');
    assert.equal(restartSidebar(mobileSession.file()).sidebar.preferences.mode,'rail');
    assert.equal(restartSidebar(mobileSession.file(),{},true).sidebar.preferences.edgePosition,.7);
    const migrated=restartSidebar({}, {'tm_shortcut_sidebar_preferences':{mode:'hidden',width:220,edgePosition:.8}});
    assert.equal(migrated.sidebar.preferences.mode,'hidden','existing local sidebar preferences remain usable');
    assert.equal(migrated.sidebar.preferences.hideGuideAcknowledged,false,'older preferences show the hide guide until it is acknowledged');
    console.log('Shortcut navigation: independent defaults, session grouping and board modes, reload, rollback, authoritative counts, validated snapshot first paint and latest-click behavior passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
