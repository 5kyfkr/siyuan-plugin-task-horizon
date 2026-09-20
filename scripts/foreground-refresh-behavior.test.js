'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
const services = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const stores = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');

function segment(source, start, end) {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, `missing segment: ${start}`);
    return source.slice(from, to);
}

function pluginHarness() {
    const handlers = new Map();
    const reloads = [];
    const context = vm.createContext({
        console: { warn: () => {} },
        document: { visibilityState: 'visible' },
        window: { dispatchEvent: () => {} },
        CustomEvent: class {},
        setTimeout, clearTimeout,
        SYNCED_DATA_RELOAD_DEBOUNCE_MS: 1,
        SIYUAN_SYNC_STATUS_EVENT: 'sync-status',
        hasTaskMainRuntime: () => true,
        __taskHorizonMountToken: 'test',
        __taskHorizonReloadSyncedData: async (options) => { reloads.push(options); return true; },
    });
    vm.runInContext(`class TestPlugin {
        ${segment(index, '    registerDocumentSyncReloadListener()', '    waitForMobileStartupPoll(')}
    }; this.plugin = new TestPlugin();`, context);
    const plugin = context.plugin;
    plugin.eventBus = {
        on: (name, handler) => handlers.set(name, handler),
        off: (name, handler) => { if (handlers.get(name) === handler) handlers.delete(name); },
    };
    plugin._taskMobileStartupAutoOpenEnabled = false;
    plugin.registerDocumentSyncReloadListener();
    plugin.registerSiyuanSyncStatusListeners();
    const emit = (name, detail) => handlers.get(name)?.({ detail });
    const settled = async () => {
        if (plugin._taskDataChangedScheduledPromise) await plugin._taskDataChangedScheduledPromise;
        if (plugin._taskDataChangedPromise) await plugin._taskDataChangedPromise;
    };
    return { plugin, handlers, reloads, emit, settled };
}

test('foreground sync with no incoming changes never loads documents', async () => {
    const h = pluginHarness();
    h.emit('sync-start');
    h.emit('sync-end');
    await h.settled();
    assert.equal(h.reloads.length, 0);
});

test('actual document sync reloads once with startup auto-open disabled', async () => {
    const h = pluginHarness();
    h.emit('sync-start');
    h.emit('ws-main', { cmd: 'syncMergeResult', data: { upsertRootIDs: ['doc1'], removeRootIDs: [] } });
    h.emit('ws-main', { cmd: 'syncMergeResult', data: { upsertRootIDs: [], removeRootIDs: ['doc2'] } });
    h.emit('sync-end');
    await h.settled();
    assert.equal(h.reloads.length, 1);
    assert.equal(h.reloads[0].reason, 'sync-merge-result');
    assert.equal(h.reloads[0].suppressStorageWrites, true);
});

test('empty or malformed sync notifications do not reload', async () => {
    const h = pluginHarness();
    for (const data of [undefined, {}, { upsertRootIDs: [], removeRootIDs: [] }, { upsertRootIDs: 'doc1' }]) {
        h.emit('ws-main', { cmd: 'syncMergeResult', data });
    }
    h.emit('ws-main', { cmd: 'unrelated', data: { upsertRootIDs: ['doc1'] } });
    await h.settled();
    assert.equal(h.reloads.length, 0);
});

test('plugin storage changes and overwrite still reload through the coordinator', async () => {
    const h = pluginHarness();
    await h.plugin.onDataChanged('overwrite');
    assert.equal(h.reloads.length, 1);
    assert.equal(h.reloads[0].suppressStorageWrites, true);
    await h.plugin.onDataChanged();
    assert.equal(h.reloads.length, 2);
});

test('document sync and status listeners are removed on unload', () => {
    const h = pluginHarness();
    h.plugin.unregisterDocumentSyncReloadListener();
    h.plugin.unregisterSiyuanSyncStatusListeners();
    assert.equal(h.handlers.size, 0);
});

test('resume keeps unchanged or unavailable documents intact, then commits a real change once', async () => {
    let freshness = { status: 'unchanged', changed: false };
    let loads = 0;
    let commits = 0;
    const context = vm.createContext({
        state: { modal: {}, viewRefreshPending: null },
        SettingsStore: { data: { currentGroupId: 'all' } },
        document: { visibilityState: 'visible' },
        __tmCalendarTxRefreshPending: false,
        __tmIsPluginVisibleNow: () => true,
        __tmHasAutoRefreshPendingSync: () => false,
        __tmProbeCurrentGroupTaskFreshness: async () => freshness,
        __tmRefreshCore: async () => { loads++; return true; },
        __tmSyncRemoteCollapsedSessionStateIfNeeded: async () => false,
        __tmCommitVisibleResumeView: () => { commits++; return true; },
        __tmScheduleReminderTaskNameMarksRefresh: () => {},
    });
    vm.runInContext(segment(services, 'async function __tmRunVisibleResumeSync(', 'function __tmScheduleVisibleResumeSync('), context);
    for (const status of ['unchanged', 'unknown']) {
        freshness = { status, changed: false };
        await context.__tmRunVisibleResumeSync('visibilitychange');
        await context.__tmRunVisibleResumeSync('focus');
    }
    assert.equal(loads, 0);
    assert.equal(commits, 0);
    freshness = { status: 'changed', changed: true };
    await context.__tmRunVisibleResumeSync('visibilitychange');
    assert.equal(loads, 1);
    assert.equal(commits, 1);
});

function tomatoHarness(initialMinutes = 30) {
    const handlers = new Map();
    const loads = [];
    const views = [];
    const markers = [];
    const quickbars = [];
    const homepages = [];
    let minutes = initialMinutes;
    const context = vm.createContext({
        state: { modal: {}, homepageOpen: true, viewMode: 'kanban' },
        SettingsStore: { data: { tomatoActualCountBySpentEnabled: true } },
        document: { visibilityState: 'visible', body: { contains: () => true } },
        window: {},
        __dockTomato: { getDefaultTomatoTimeMinutes: () => minutes },
        __tmRuntimeEvents: { on: (target, name, handler) => handlers.set(name, handler) },
        __tmRestoreTomatoFocusAfterReload: () => {},
        __tmMarkDocTitleMarkersDirty: () => markers.push(true),
        __taskHorizonQuickbarRefreshInline: () => quickbars.push(true),
        __tmScheduleHomepageRefresh: () => homepages.push(true),
        loadSelectedDocuments: async (options) => loads.push(options),
        __tmScheduleViewRefresh: (detail) => views.push({
            ...detail, count: context.__tmGetTaskTomatoCount({ tomatoMinutes: 90 }),
        }),
    });
    vm.runInContext(
        segment(stores, 'function __tmNormalizeTomatoCountValue(', 'function __tmGetMeasureFontFromStyle(')
        + segment(services, 'let __tmTomatoAssociationListenerAdded', "const __TM_TOMATO_FOCUS_SESSION_KEY")
        + segment(services, 'function __tmListenTomatoAssociationCleared()', 'function __tmClearTomatoFocusRowClasses()')
        + '\n__tmListenTomatoAssociationCleared();', context,
    );
    const emit = (nextMinutes = minutes, source = 'load') => {
        minutes = nextMinutes;
        handlers.get('tomato:default-duration-changed')({ detail: { minutes, source } });
    };
    return { context, emit, loads, views, markers, quickbars, homepages };
}

test('Tomato settings reannounced on startup and foreground leave every task view intact', () => {
    const h = tomatoHarness(45);
    for (const viewMode of ['kanban', 'calendar', 'checklist', 'list', 'timeline']) {
        h.context.state.viewMode = viewMode;
        h.emit();
        h.context.document.visibilityState = 'hidden';
        h.emit();
        h.context.document.visibilityState = 'visible';
        h.emit();
    }
    assert.equal(h.loads.length, 0);
    assert.equal(h.views.length, 0);
    assert.equal(h.markers.length + h.quickbars.length + h.homepages.length, 0);
});

test('a real Tomato duration change updates derived counts once without reloading documents', () => {
    const h = tomatoHarness();
    assert.equal(h.context.__tmGetTaskTomatoCount({ tomatoMinutes: 90 }), '3');
    h.emit(45, 'settings');
    h.emit(45, 'load');
    assert.equal(h.loads.length, 0);
    assert.equal(h.views.length, 1);
    assert.equal(h.views[0].mode, 'current');
    assert.equal(h.views[0].withFilters, true);
    assert.equal(h.views[0].count, '2');
    assert.equal(h.markers.length, 1);
    assert.equal(h.quickbars.length, 1);
    assert.equal(h.homepages.length, 1);
});

test('disabled derived Tomato counts ignore settings changes without retaining a stale duration', () => {
    const h = tomatoHarness();
    h.context.SettingsStore.data.tomatoActualCountBySpentEnabled = false;
    h.emit(45);
    h.context.SettingsStore.data.tomatoActualCountBySpentEnabled = true;
    h.emit(45);
    assert.equal(h.loads.length + h.views.length + h.markers.length + h.quickbars.length + h.homepages.length, 0);
    h.emit(60);
    assert.equal(h.views.length, 1);
    assert.equal(h.views[0].count, '1.5');
});

test('unavailable Tomato duration uses the same fallback as task counts and reacts when available', () => {
    const h = tomatoHarness(undefined);
    delete h.context.__dockTomato;
    h.emit(30);
    h.context.__dockTomato = { getDefaultTomatoTimeMinutes: () => 25 };
    h.emit(25);
    h.emit(25);
    assert.equal(h.loads.length, 0);
    assert.equal(h.views.length, 1);
    assert.equal(h.views[0].count, '3.6');
});
