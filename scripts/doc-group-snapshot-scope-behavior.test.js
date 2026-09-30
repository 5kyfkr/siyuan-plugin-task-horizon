'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const main = path.join(__dirname, '../src/task-horizon/main');
const dialog = fs.readFileSync(path.join(main, '30-dialogs-and-ui-foundation.js'), 'utf8');
const store = fs.readFileSync(path.join(main, '10-stores-rules-and-cache.js'), 'utf8');
const extract = (name) => {
    const start = store.indexOf(`    function ${name}(`);
    const end = store.indexOf('\n    }', start);
    assert.ok(start >= 0 && end > start, `missing ${name}`);
    return store.slice(start, end + 6);
};
const start = dialog.indexOf('    window.tmSwitchDocGroup =');
const end = dialog.indexOf('\n    };', start);
assert.ok(start >= 0 && end > start, 'missing group switch handler');
const switchSource = dialog.slice(start, end + 7);
const docA = '20260901000000-aaaaaaa';
const docB = '20260901000000-bbbbbbb';
const sharedDoc = '20260901000000-ccccccc';
const noop = () => {};
const makeSnapshot = (docIds, treeIds = docIds) => ({
    version: 4, groupId: 'group-b', createdAt: Date.now(),
    scopeKey: `group-b|${docIds.slice().sort().join(',')}`,
    docIds,
    taskTree: treeIds.map(id => ({id, tasks: []})),
});

function createRuntime(snapshot, expectedDocIds = [docB], resolveScope) {
    const events = [];
    const restores = [];
    const loads = [];
    const state = {openToken: 1, activeDocId: 'all', viewMode: 'kanban', filteredTasks: [], taskTree: [{id: docA}], __tmLoadedDocIdsForTasks: [docA]};
    const context = vm.createContext({
        window: {}, console, state, Set, Map, Date,
        SettingsStore: {data: {currentGroupId: 'group-a'}, save: async () => {}},
        __TM_TASK_SNAPSHOT_VERSION: 4,
        __TM_TASK_SNAPSHOT_MAX_AGE_MS: 3 * 86400000,
        __tmIsLikelyBlockId: value => /^\d{14}-[a-z0-9]{7}$/.test(value),
        __tmApplyCompletedVisibilityToRuntime: noop,
        __tmIsRuntimeMobileClient: () => false,
        __tmHideMobileMenu: noop,
        __tmMarkContextInteractionQuiet: noop,
        __tmApplyCurrentContextViewProfile: async () => {},
        resolveDocIdsFromGroups: async options => {
            assert.equal(options.groupId, 'group-b');
            assert.equal(options.skipPersistedScope, true);
            return resolveScope ? resolveScope() : expectedDocIds;
        },
        __tmTaskSnapshotService: {
            loadLatestForGroup: async () => snapshot,
            restore: (value, options) => {
                if (!value) return null;
                restores.push({value, options});
                state.taskTree = value.taskTree;
                state.__tmLoadedDocIdsForTasks = value.docIds;
                return {docCount: value.taskTree.length};
            },
            restoreViewState: () => null,
        },
        loadSelectedDocuments: async options => {
            loads.push(options);
            state.taskTree = expectedDocIds.map(id => ({id, tasks: []}));
            state.__tmLoadedDocIdsForTasks = expectedDocIds;
            return true;
        },
        recalcStats: noop, __tmRecomputeTaskProjection: noop, __tmSetInlineLoading: noop,
        __tmRenderPreservingCalendarSideDock: noop,
        __tmScheduleTaskIndexPrewarmForDocIds: noop, __tmScheduleTaskIndexPrewarm: noop,
        __tmScheduleDocGroupSwitchVerifyAfterFirstPaint: noop, __tmSchedulePersistTaskSnapshot: noop,
        setTimeout: () => 1,
        hint: message => events.push({stage: 'hint', message}),
    });
    vm.runInContext([
        '__tmNormalizeTaskSnapshotDocIds', '__tmBuildTaskSnapshotScopeKey',
        '__tmIsPreservedTaskSnapshot', '__tmIsUsableTaskSnapshot', '__tmValidateTaskSnapshotForScope',
    ].map(extract).join('\n') + '\n' + switchSource, context);
    return {context, state, events, restores, loads};
}

async function mainTest() {
    for (const [label, snapshot, expectedDocIds] of [
        ['same-sized scope from another group', makeSnapshot([docA]), [docB]],
        ['tree outside its declared scope', makeSnapshot([docB], [docA]), [docB]],
        ['now-empty group', makeSnapshot([docA]), []],
    ]) {
        const runtime = createRuntime(snapshot, expectedDocIds);
        await runtime.context.window.tmSwitchDocGroup('group-b');
        assert.equal(runtime.restores.length, 0, `${label}: stale tasks must never reach restore`);
        assert.equal(runtime.loads.length, 1, `${label}: reload the target group`);
        assert.equal(runtime.events.length, 0, `${label}: switching must not report an error`);
        assert.deepEqual(runtime.state.__tmLoadedDocIdsForTasks, expectedDocIds);
    }
    const valid = createRuntime(makeSnapshot([docB, sharedDoc], [sharedDoc]), [sharedDoc, docB]);
    await valid.context.window.tmSwitchDocGroup('group-b');
    assert.equal(valid.loads.length, 0, 'a valid snapshot retains the fast path, including shared documents');
    assert.equal(valid.restores.length, 1);
    assert.deepEqual(Array.from(valid.restores[0].options.docIds), [docB, sharedDoc]);
    assert.equal(valid.events.length, 0);

    const failedScope = createRuntime(makeSnapshot([docB]), [docB], () => {throw new Error('scope unavailable');});
    await failedScope.context.window.tmSwitchDocGroup('group-b');
    assert.equal(failedScope.restores.length, 0);
    assert.equal(failedScope.loads.length, 1, 'an unverified scope must fall back to normal loading');

    let releaseScope;
    let markScopeStarted;
    const scopeStarted = new Promise(resolve => {markScopeStarted = resolve;});
    const pendingScope = new Promise(resolve => {releaseScope = resolve;});
    const stale = createRuntime(makeSnapshot([docB]), [docB], () => {markScopeStarted(); return pendingScope;});
    const switching = stale.context.window.tmSwitchDocGroup('group-b');
    await scopeStarted;
    stale.context.SettingsStore.data.currentGroupId = 'group-c';
    stale.state.openToken += 1;
    releaseScope([docB]);
    await switching;
    assert.equal(stale.restores.length, 0, 'a superseded scope query must not restore an old group');
    assert.equal(stale.loads.length, 0, 'a superseded switch must not start a fallback load');
    assert.equal(stale.context.SettingsStore.data.currentGroupId, 'group-c');
    console.log('doc group snapshot scope behavioral tests passed');
}

mainTest().catch(error => {console.error(error); process.exitCode = 1;});
