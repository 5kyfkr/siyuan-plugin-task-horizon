'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const main = path.join(__dirname, '../src/task-horizon/main');
const source = fs.readFileSync(path.join(main, '38-shortcut-core.js'), 'utf8');
const dialog = fs.readFileSync(path.join(main, '30-dialogs-and-ui-foundation.js'), 'utf8');
const storeSource = fs.readFileSync(path.join(main, '10-stores-rules-and-cache.js'), 'utf8');
const extract = (content, declaration) => {
    const start = content.indexOf(declaration), end = content.indexOf('\n    }', start);
    assert.ok(start >= 0 && end > start, `missing ${declaration}`);
    return content.slice(start, end + 6);
};
const snapshotSource = extract(dialog, '    async function __tmLoadValidatedDocGroupSnapshot(');
const snapshotValidation = ['__tmNormalizeTaskSnapshotDocIds', '__tmBuildTaskSnapshotScopeKey',
    '__tmIsPreservedTaskSnapshot', '__tmIsUsableTaskSnapshot', '__tmValidateTaskSnapshotForScope']
    .map(name => extract(storeSource, `    function ${name}(`)).join('\n');
const noOp = () => {};
function fixture() {
    const state = {activeDocId:'all',viewMode:'checklist',currentRule:null,openToken:0,taskTree:[{id:'doc-a'}],filterRules:[{id:'today',enabled:true},{id:'off',enabled:false}]};
    const profiles = {global:{ruleId:'global-rule'},groups:{work:{ruleId:'group-rule'}}};
    const store = {data:{currentGroupId:'all',currentRule:'global-rule',docGroups:[{id:'work',name:'工作'}],docTabCustomGroups:[],viewProfiles:profiles,shortcutItems:[]},save:async()=>{}};
    const events = [], invalid = [], loads = [];
    const ctx = vm.createContext({state,SettingsStore:store,console,Map,Set,Date,Math,Promise,setTimeout,clearTimeout,
        __TM_TASK_SNAPSHOT_VERSION:4,__TM_TASK_SNAPSHOT_MAX_AGE_MS:3*86400000,
        __tmIsLikelyBlockId:value=>/^\d{14}-[a-z0-9]{7}$/.test(value),
        __tmIsRuntimeMobileClient:()=>false,
        __tmResolveDocGroupName:group=>group.name,
        __tmGetTodayDateKey:()=> '2026-10-15',
        __TM_ALL_VIEWS:['checklist','calendar','whiteboard'].map(id=>({id,label:id})),
        __tmIsViewEnabled:id=>['checklist','calendar','whiteboard'].includes(id),
        __tmGetDocTabCustomGroupScopeId:group=>group.docGroupId,
        __tmGetDocTabCustomGroupDocIdSet:()=>new Set(),
        __tmBuildDocTabCustomGroupActiveId:id=>'tab:'+id,
        __tmEnsureFilterRulesLoaded:async()=>{},
        resolveDocIdsFromGroups:async({groupId})=>groupId==='work'?['doc-a','doc-b']:['doc-a'],
        API:{call:async()=>({code:0,data:[]})},
        __tmApplyCompletedVisibilityToRuntime:noOp,
        __tmApplyCurrentContextViewProfile:async()=>{state.currentRule=state.shortcutContext.ruleId||null;return {customFieldReloadNeeded:false};},
        __tmRecomputeTaskProjection:noOp,render:()=>events.push('render'),recalcStats:noOp,
        __tmScheduleDocGroupSwitchVerifyAfterFirstPaint:noOp,
        hint:message=>events.push(message),
        __tmGetCurrentRule:()=>state.filterRules.find(rule=>rule.id===state.currentRule),
        RuleManager:{applyRuleFilter:(tasks,rule)=>tasks.filter(task=>!rule||task.today)},
        __tmShortcutSidebar:{refresh:noOp,closeDrawer:noOp,showInvalid:(item,issues)=>invalid.push({item,issues})},
        loadSelectedDocuments:async()=>{loads.push(state.openToken);},
    });
    vm.runInContext(snapshotValidation+'\n'+snapshotSource+'\n'+source+'\nglobalThis.core=__tmShortcuts;',ctx);
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
    const counting=fixture();counting.store.data.shortcutItems=[counting.shortcut('today'),counting.shortcut('work',{groupId:'work',ruleId:''})];
    counting.state.currentRule='today';
    counting.state.filteredTasks=Array.from({length:6},(_,index)=>({id:String(index)}));
    counting.state.flatTasks=Object.fromEntries(Array.from({length:10},(_,index)=>[String(index),{id:String(index),today:true}]));
    counting.ctx.resolveDocIdsFromGroups=()=>{throw new Error('Counting must not load another task scope');};
    assert.equal(counting.core.counts().get('today'),6,'shortcut count is the same final projection as the topbar, not ten raw matches');
    assert.equal(counting.core.counts().has('work'),false,'an unopened scope cannot overwrite a cached count');
    const key=counting.core.countKey(counting.core.items()[0]);
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
    const docA='20261015000000-aaaaaaa',docB='20261015000000-bbbbbbb';
    const snapshot={version:4,groupId:'work',createdAt:Date.now(),scopeKey:'work|'+[docA,docB].join(','),docIds:[docA,docB],
        taskTree:[{id:docA,tasks:[{id:'now',today:true},{id:'later',today:false}]},{id:docB,tasks:[]}]};
    const cachedFixture=()=>{
        const value=fixture(),restores=[],paints=[],verifies=[];
        value.store.data.shortcutItems=[value.shortcut('cached',{groupId:'work'})];
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
    const interrupted=cachedFixture();interrupted.store.data.shortcutItems.push(interrupted.shortcut('latest',{groupId:'all',ruleId:''}));
    let releaseSnapshot,startedSnapshot;
    const pending=new Promise(resolve=>{releaseSnapshot=resolve;}),started=new Promise(resolve=>{startedSnapshot=resolve;});
    interrupted.ctx.__tmTaskSnapshotService.loadLatestForGroup=groupId=>{if(groupId==='work'){startedSnapshot();return pending;}return null;};
    const pendingOpen=interrupted.core.open('cached');await started;
    assert.equal(await interrupted.core.open('latest'),true);releaseSnapshot(snapshot);assert.equal(await pendingOpen,false);
    assert.equal(interrupted.restores.length,0,'a superseded snapshot cannot replace the newest target');
    assert.equal(interrupted.store.data.currentGroupId,'all');assert.equal(interrupted.state.currentRule,null);
    console.log('Shortcut navigation: independent defaults, invalid preservation, first-click rules, authoritative counts, validated snapshot first paint and latest-click behavior passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
