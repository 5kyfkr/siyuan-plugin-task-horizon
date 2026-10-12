'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../src/task-horizon/main');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const runtime = read('task-runtime/51-whiteboard-and-link-runtime.js');
const foundation = read('30-dialogs-and-ui-foundation.js');
const interactions = read('render/49-render-whiteboard-interactions.js');
const stores = read('10-stores-rules-and-cache.js');
const api = read('20-api-and-runtime-services.js');
const actions = read('settings/70-doc-group-and-settings-actions.js');
const detail = read('task-runtime/52-task-detail-runtime.js');

function section(source, start, end) {
    const from = source.indexOf(start), to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, `missing production section: ${start}`);
    return source.slice(from, to);
}

function createHarness() {
    const ctx = { console, structuredClone };
    vm.createContext(ctx);
    vm.runInContext(`
        var state = { viewMode: 'whiteboard', activeDocId: 'all', flatTasks: {}, taskTree: [], allDocuments: [] };
        var SettingsStore = { data: {
            currentGroupId: 'parent', whiteboardAllTabsLayoutMode: 'global',
            whiteboardGlobalBoardsByGroup: {}, whiteboardAllTabsDocOrderByGroup: {},
            whiteboardNotes: [], whiteboardFrames: [], whiteboardView: {x: 1, y: 2, zoom: 1},
            docTabCustomGroups: [
                {id: 'tabs-a', docGroupId: 'parent', entries: [{id: 'doc-a'}, {id: 'doc-b'}]},
                {id: 'tabs-b', docGroupId: 'parent', entries: [{id: 'doc-a'}, {id: 'doc-c'}]}
            ]
        }, save: async () => {}, syncLocalFields() {}, syncToLocal() {} };
        var WhiteboardStore = { loaded: true, data: {}, scheduleSave() {} };
        var API = {};
        var __tmGlobalWhiteboardOptimisticMoves = new Map();
        var __tmGlobalWhiteboardCollectionTaskCache = {docId:'',tasks:[],loadedAt:0,authoritative:false,promise:null};
        var switched = [], queued = [], reads = [], dateUpdates = [], undoRecords = [];
        var manualLinks = [];
        var window = globalThis;
        var Storage = {set() {}};
        function esc(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }
        function __tmNormalizeHexColor(value) { return value || ''; }
        function __tmNormalizeDocAliasValue(value) { return value || ''; }
        function __tmNormalizeDocIconValue(value) { return value || ''; }
        function __tmSortDocEntriesForTabs(docs) { return docs; }
        function __tmIsOtherBlockTabId(id) { return id === '__other__'; }
        function __tmGetWhiteboardGlobalCanvasDocId() { return '__tm_global_whiteboard__'; }
        function __tmNormalizeWhiteboardGlobalBoardState(board = {}) {
            return { nodePos: {}, placedTaskIds: {}, detachedChildren: {}, notes: [], drawings: [], frames: [], links: [], linkedTaskSnapshots: {}, view: {x:64,y:40,zoom:1}, ...structuredClone(board) };
        }
        function __tmNormalizeWhiteboardGlobalBoardsByGroupMap(map) { return structuredClone(map || {}); }
        function __tmNormalizeWhiteboardFrameArray(frames) { return structuredClone(frames || []); }
        function __tmGetManualTaskLinks() { return manualLinks; }
        function __tmSetManualTaskLinks(links) { manualLinks = links; }
        function __tmGetAllTaskLinks(options = {}) { return manualLinks.filter(link => !options.docId || link.docId === options.docId); }
        function __tmGetTaskDocIdById(id) { return state.flatTasks[id]?.root_id || state.flatTasks[id]?.docId || ''; }
        function __tmNormalizeWhiteboardLinkedTaskSnapshotMap(map) { return map; }
        function __tmBuildGlobalWhiteboardLinkedTaskSnapshot(task) { return task; }
        function __tmSetGlobalWhiteboardConfirmedFrozen() {}
        function __tmIsGlobalWhiteboardConfirmedFrozen() { return false; }
        async function __tmEnsureGlobalWhiteboardCollectionTasks() { return []; }
        function __tmGetGlobalWhiteboardLoadedDocIdSet() { return new Set(state.taskTree.map(doc => doc.id)); }
        function __tmGetWhiteboardCardSnapshot() { return null; }
        function __tmGetWhiteboardPlacedTaskMap() { return SettingsStore.data.whiteboardPlacedTaskIds || {}; }
        function __tmResolveWhiteboardTaskParentId(id) { return state.flatTasks[id]?.parentTaskId || ''; }
        function __tmIsWhiteboardChildDetached() { return false; }
        function __tmKanbanGetCollapsedSet() { return new Set(); }
        function __tmTaskCreatedOrderValue() { return 0; }
        function render() {}
        function hint() {}
        function __tmEnqueueTimelineMutation(operation) { queued.push(operation); return Promise.resolve(); }
        function __tmPushWhiteboardHistorySnapshot() {}
        function __tmPushUndoRecord(record) { undoRecords.push(record); }
        window.tmUpdateTaskDates = async (id,patch) => { dateUpdates.push({id,patch});Object.assign(state.flatTasks[id],patch); };
        function __tmNormalizeTaskLinkSide(side) { return side === 'in' ? 'in' : 'out'; }
        function __tmNormalizeTaskLinkAnchor(anchor) { return anchor || ''; }
        function __tmResolveWhiteboardTargetAnchor() { return ''; }
        function __tmGetWhiteboardGlobalBodyFromElement() { return null; }
        function __tmGetWhiteboardGlobalCanvasBody() { return null; }
        function __tmResetLinkDragState() {}
        function __tmScheduleWhiteboardEdgeRedraw() {}
        function __tmCanLinkTasks(from, to) { return {ok: true, docId: __tmGetTaskDocIdById(from)}; }
        class Element {}
        class HTMLElement extends Element {}
        window.tmSwitchDoc = async id => { switched.push(id); state.activeDocId = id; };
        ${section(foundation, 'function __tmNormalizeDocTabCustomGroups(', 'function __tmCompareDocTabGroupMenuSortValue(')}
        ${section(foundation, 'function __tmGetDocTabCustomGroupDocIdSet(', 'function __tmGetDocTabCustomGroupMembershipForDoc(')}
        ${section(api, 'function __tmNormalizeWhiteboardAllTabsLayoutMode(', 'function __tmCompareTasksByDocFlow(')}
        ${section(stores, 'function __tmNormalizeTimelineDependencyScope(', 'function __tmGetTimelineColumnOrder(')}
        ${section(stores, 'function __tmIsPlainObjectWithKeys(', 'function __tmBuildWhiteboardSettingsState(')}
        ${section(stores, 'function __tmNormalizeWhiteboardGlobalBoardsByGroupMap(', 'function __tmIsPlainObjectWithKeys(')}
        ${section(runtime, 'function __tmGetWhiteboardAllTabsLayoutMode()', 'const __tmGlobalWhiteboardCollectionTaskCache =')}
        ${section(runtime, 'function __tmGetGlobalWhiteboardCollectionDocId()', 'function __tmBuildGlobalWhiteboardLinkedTaskSnapshot(')}
        ${section(runtime, 'function __tmGetGlobalWhiteboardTaskSource(', 'function __tmCollectGlobalWhiteboardMovedTaskSnapshots(')}
        ${section(runtime, 'function __tmGetWhiteboardGlobalBoardsByGroupMap()', 'function __tmClearWhiteboardAllTabsDocDragMarkers()')}
        ${section(runtime, 'function __tmIsWhiteboardGlobalCanvasActive()', 'function __tmGetWhiteboardNodePosMap()')}
        ${section(runtime, 'function __tmResolveWhiteboardTaskLocation(', 'function __tmRemapWhiteboardTaskId(')}
        ${section(runtime, 'function __tmGetWhiteboardOutlineTaskLike(', 'function __tmGetDetachedChildrenMap(')}
        ${section(detail, 'const buildWhiteboardOutlineScopeOptions =', 'const renderWhiteboardOutlineHtmlForPopover =')}
        globalThis.detailScopeOptions = buildWhiteboardOutlineScopeOptions;
        ${section(interactions, 'function __tmGetWhiteboardNoteStorage(', 'function __tmSaveWhiteboardNotesToStorage(')}
        ${section(interactions, 'function __tmNormalizeWhiteboardFrameArrayLocal(', 'function __tmSaveWhiteboardFrameStorage(')}
        ${section(interactions, 'function __tmIsWhiteboardDrawingEnabled()', 'function __tmGetWhiteboardDrawingConfig()')}
        ${section(actions, 'window.tmSetWhiteboardAllTabsLayoutMode =', 'window.tmWhiteboardAllTabsDocDragStart =')}
        ${read('task-runtime/55-timeline-dependency-runtime.js')}
        ${section(interactions, 'window.tmTaskLinkDotDrop = async function', 'window.tmWhiteboardRemoveLink =')}
        ${section(interactions, 'window.tmTimelineRemoveLink =', 'function __tmIsWhiteboardCompactSidebarHost()')}
    `, ctx);
    ctx.state.taskTree = ['doc-a', 'doc-b', 'doc-c'].map(id => ({id, name: id}));
    ctx.state.allDocuments = ctx.state.taskTree.slice();
    ctx.state.flatTasks = Object.fromEntries([
        ['a', 'doc-a'], ['b', 'doc-b'], ['c', 'doc-c'], ['other', 'outside']
    ].map(([id, root_id]) => [id, {id, root_id, content: id, startDate: '2026-10-12', completionTime: '2026-10-13'}]));
    ctx.__tmTaskBoundary = {getTask: id => ctx.state.flatTasks[id] || null};
    return ctx;
}

async function test() {
    const ctx = createHarness();
    const {state, SettingsStore: store} = ctx;
    const keyA = ctx.__tmBuildDocTabCustomGroupActiveId('tabs-a');
    const keyB = ctx.__tmBuildDocTabCustomGroupActiveId('tabs-b');
    state.activeDocId = keyA;
    assert.equal(ctx.__tmIsWhiteboardGlobalCanvasActive(), true, 'tab-group aggregate must activate its global canvas');
    assert.equal(ctx.__tmIsWhiteboardDrawingEnabled(), true, 'drawing must work on the tab-group global canvas');
    const scopeA = ctx.__tmResolveWhiteboardScope();
    assert.equal(scopeA.boardKey, keyA);
    assert.deepEqual(Array.from(scopeA.docIds).sort(), ['doc-a', 'doc-b']);
    assert.equal(ctx.__tmResolveWhiteboardScope({source:'global'}).boardKey, 'parent', 'legacy global source must still use the parent group');
    assert.equal(ctx.__tmResolveWhiteboardScope({source:'tabGroup'}).boardKey, keyA);
    ctx.__tmSetWhiteboardGlobalBoardState(keyA, {notes:[{id:'note-a'}],frames:[{id:'frame-a'}],view:{x:111,y:222,zoom:1.5}}, {keepEmpty:true});
    ctx.__tmSetWhiteboardGlobalBoardState(keyB, {notes:[{id:'note-b'}],view:{x:333,y:444,zoom:2}}, {keepEmpty:true});
    assert.equal(ctx.__tmGetWhiteboardNoteStorage().groupId, keyA);
    assert.equal(ctx.__tmGetWhiteboardFrameStorage().frames[0].id, 'frame-a');
    assert.equal(ctx.__tmGetWhiteboardView().x, 111);
    ctx.__tmSetWhiteboardView({x:999});
    assert.equal(ctx.__tmGetWhiteboardGlobalBoardState(keyA).view.x, 999);
    assert.equal(ctx.__tmGetWhiteboardGlobalBoardState(keyB).view.x, 333);
    assert.equal(store.data.whiteboardView.x, 1);
    store.data.whiteboardAllTabsLayoutMode = 'stream';
    assert.equal(ctx.__tmIsWhiteboardAllTabsStreamMode(), true);
    assert.equal(ctx.__tmIsWhiteboardDrawingEnabled(), false);
    await ctx.tmSetWhiteboardLayoutModeFromMobileMenu('board');
    assert.equal(state.activeDocId, keyA, 'mobile mode switch must keep the active tab group');
    assert.equal(ctx.switched.length, 0);
    state.activeDocId = 'doc-a';
    assert.equal(ctx.__tmGetEffectiveTimelineDependencyScope({scope:'tabGroup'}), 'local');
    assert.equal(ctx.__tmResolveWhiteboardScope({source:'tabGroup'}).boardKey, 'parent', 'tab-group source has an explicit parent fallback');
    state.activeDocId = keyA;
    store.data.timelineDependencyScope = 'local';
    ctx.__tmSetManualTaskLinks([{id:'doc-link',from:'a',to:'b',docId:'doc-a'},{id:'unrelated',from:'c',to:'other',docId:'doc-c'}]);
    assert.equal(ctx.__tmGetTimelineDependencyLinks()[0].id, 'doc-link', 'document source aggregates member document links rather than querying the virtual ID');
    assert.equal(ctx.__tmGetTimelineDependencyLinks().length, 1);
    ctx.__tmSetWhiteboardGlobalTaskLinks([{id:'link-a',from:'a',to:'b'}], keyA);
    ctx.__tmSetWhiteboardGlobalTaskLinks([{id:'link-b',from:'a',to:'c'}], keyB);
    ctx.__tmSetWhiteboardGlobalTaskLinks([{id:'parent-link',from:'b',to:'c'}], 'parent');
    store.data.timelineDependencyScope = 'tabGroup';
    assert.equal(ctx.__tmGetTimelineDependencyLinks()[0].id, 'link-a');
    store.data.timelineDependencyScope = 'global';
    assert.equal(ctx.__tmGetTimelineDependencyLinks()[0].id, 'parent-link');
    store.data.timelineDependencyScope = 'tabGroup';
    await ctx.tmTimelineRemoveLink('link-a');
    state.activeDocId = keyB;
    await ctx.queued.shift()();
    assert.equal(ctx.__tmGetWhiteboardGlobalTaskLinks(keyA).length, 0, 'queued deletion must target the original group');
    assert.equal(ctx.__tmGetWhiteboardGlobalTaskLinks(keyB)[0].id, 'link-b');
    state.viewMode = 'timeline';state.activeDocId = keyA;
    state.whiteboardLinkFromTaskId = 'a';state.whiteboardLinkFromDocId = 'doc-a';
    await ctx.tmTaskLinkDotDrop({}, 'b', 'doc-b');
    state.activeDocId = keyB;
    await ctx.queued.shift()();
    assert.equal(ctx.__tmGetWhiteboardGlobalTaskLinks(keyA)[0].to, 'b', 'queued link creation must use the captured source');
    state.activeDocId = keyA;
    await ctx.__tmCommitTimelineDependencyShift({sourceTaskId:'a',sourcePatch:{startDate:'2026-10-13',completionTime:'2026-10-14'},deltaDays:1});
    state.activeDocId = keyB;
    await ctx.queued.shift()();
    assert.deepEqual(Array.from(ctx.dateUpdates, update => update.id).sort(), ['a','b'], 'queued dependency shifts must follow the selected group graph');
    assert.equal(ctx.undoRecords.length,1);
    ctx.__tmSetWhiteboardGlobalTaskLinks([{from:'a',to:'b'},{from:'a',to:'other'},{from:'other',to:'c'}], keyA);
    state.activeDocId = keyA;ctx.dateUpdates.length=0;
    await ctx.__tmCommitTimelineDependencyShift({sourceTaskId:'a',sourcePatch:{startDate:'2026-10-14',completionTime:'2026-10-15'},deltaDays:1});
    await ctx.queued.shift()();
    assert.deepEqual(Array.from(ctx.dateUpdates, update=>update.id).sort(),['a','b'],
        'historical links must not shift tasks outside the tab-group scope or traverse them into another group');
    state.activeDocId=keyB;
    state.viewMode = 'whiteboard';
    assert.equal(ctx.__tmNormalizeTimelineDependencyScope('tabGroup'), 'tabGroup');
    assert.equal(ctx.__tmNormalizeWhiteboardSequenceScope('tabGroup'), 'tabGroup');
    assert.equal(ctx.__tmResolveWhiteboardScope({activeDocId:'__other__'}).docIds.size,0, 'other-block tabs must not be interpreted as all document tasks');
    const emptyKey = ctx.__tmBuildDocTabCustomGroupActiveId('empty');
    ctx.__tmSetWhiteboardGlobalBoardState(emptyKey, {view:{x:345,y:678,zoom:0.7}}, {keepEmpty:true});
    assert.equal(ctx.__tmGetWhiteboardGlobalBoardState(emptyKey).view.x, 345, 'empty canvases must retain their saved view');
    state.__tmGlobalWhiteboardAuthoritativeScope = {groupId:'parent',docIds:['doc-a','doc-b','doc-c'],complete:true};
    state.activeDocId = keyA;
    ctx.__tmSetWhiteboardGlobalTaskLinks([{id:'link-a',from:'a',to:'b'}], keyA);
    ctx.__tmPatchWhiteboardGlobalBoardState(keyA, {placedTaskIds:{a:true,b:true}});
    ctx.__tmPatchWhiteboardGlobalBoardState(keyB, {placedTaskIds:{a:true,c:true}});
    const sourceA = ctx.__tmGetGlobalWhiteboardTaskSource(keyA);
    assert.deepEqual(Array.from(sourceA.taskMap.keys()).sort(), ['a','b'], 'global projection must exclude other tab-group tasks');
    state.filteredTasks = [];
    ctx.__tmReconcileGlobalWhiteboard(keyA, {authoritative:true});
    assert.equal(ctx.__tmGetWhiteboardGlobalBoardState(keyA).placedTaskIds.b, true, 'display filters must not clean up group members');
    const outlineA = ctx.__tmBuildWhiteboardTaskOutlineModel('a', {scope:keyA});
    const outlineB = ctx.__tmBuildWhiteboardTaskOutlineModel('a', {scope:keyB});
    assert.deepEqual(Array.from(outlineA.nodes, node => node.id).sort(), ['a','b']);
    assert.deepEqual(Array.from(outlineB.nodes, node => node.id).sort(), ['a','c']);
    assert.equal(outlineA.scope, keyA);
    state.activeDocId = 'all';
    assert.equal(ctx.__tmResolveWhiteboardTaskLocation('a').scope, keyA, 'detail paths must discover an existing tab-group placement outside the aggregate tab');
    assert.deepEqual(Array.from(ctx.detailScopeOptions('a'), option => option.value), [keyA,keyB], 'multiple group paths must keep distinct identities');
    ctx.__tmSetWhiteboardAllTabsDocOrder(keyA,['doc-b','doc-a']);
    ctx.__tmSetWhiteboardAllTabsDocOrder(keyB,['doc-a','doc-c']);
    store.data.docTabCustomGroups[0].entries = [{id:'doc-a'}];
    const frozen = ctx.__tmProjectGlobalWhiteboard(keyA);
    assert.equal(frozen.taskMap.get('b').__tmGlobalFrozen, true, 'linked endpoints that leave group membership become read-only snapshots');
    assert.equal(ctx.__tmBuildWhiteboardTaskOutlineModel('a',{scope:keyA}).nodes.find(node=>node.id==='b').snapshot,true,
        'detail paths must keep frozen group endpoints read-only even when the moved task is live elsewhere');
    Object.assign(state.taskTree[0],{path:'/a',notebook:'box'});
    const childDoc = {id:'doc-a-child',name:'子文档',path:'/a/child',notebook:'box'};
    state.taskTree.push(childDoc);state.allDocuments=state.taskTree.slice();
    store.data.docTabCustomGroups[0].entries[0].includeChildren=true;
    assert.equal(ctx.__tmResolveWhiteboardScope({activeDocId:keyA}).docIds.has(childDoc.id),true,
        'recursive members must reuse the existing tab-group document expansion');
    assert.throws(() => ctx.__tmSetWhiteboardScopeLinks(ctx.__tmResolveWhiteboardScope({activeDocId:keyA,source:'tabGroup'}), [{from:'a',to:'other'}]), /范围内/);
    ctx.__tmRemoveWhiteboardScopes([keyA]);
    assert.equal(Object.hasOwn(store.data.whiteboardGlobalBoardsByGroup,keyA), false);
    assert.equal(Object.hasOwn(ctx.WhiteboardStore.data.globalBoardsByGroup,keyA), false);
    assert.equal(store.data.whiteboardAllTabsDocOrderByGroup[keyB][1], 'doc-c');
    console.log('whiteboard tab-group scope behavior tests passed');
}

module.exports = {createHarness, section};
if (require.main === module) test().catch(error => {console.error(error);process.exitCode = 1;});
