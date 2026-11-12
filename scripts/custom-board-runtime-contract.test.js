'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');
const runtimeSource = read('src/task-horizon/main/35-custom-board-runtime.js');
const loaderSource = read('src/task-horizon/main/task-runtime/53c-document-loader-runtime.js');
const detailOpenSource = read('src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js');
const projectionSource = read('src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js');
const storeSource = read('src/task-horizon/main/10-stores-rules-and-cache.js');
const appearanceSource = read('src/task-horizon/main/settings/61-settings-appearance-and-import.js');
const settingsScreenSource = read('src/task-horizon/main/settings/60-settings-screen.js');
const settingsActionsSource = read('src/task-horizon/main/settings/70-doc-group-and-settings-actions.js');
const servicesSource = read('src/task-horizon/main/20-api-and-runtime-services.js');
const kanbanRenderSource = read('src/task-horizon/main/render/43-render-timeline-kanban-calendar-body.js');
const stylesSource = read('task-horizon.css');
const sceneContextSource = read('src/task-horizon/main/render/41-render-scene-context.js');
const renderRuntimeSource = read('src/task-horizon/main/40-render-runtime.js');
const shortcutCoreSource = read('src/task-horizon/main/38-shortcut-core.js');
const docTabsSource = read('src/task-horizon/main/30-dialogs-and-ui-foundation.js');
const detailRuntimeSource = read('src/task-horizon/main/task-runtime/52-task-detail-runtime.js');
const viewSwitchSource = read('src/task-horizon/main/render/47-render-side-panels-and-view-switching.js');
const manifest = JSON.parse(read('src/task-horizon/manifest.main.json'));
const combinedRuntimeSource = manifest.scripts
    .map((script) => read(`src/task-horizon/${script}`))
    .join('\n');
assert.doesNotThrow(() => new vm.Script(combinedRuntimeSource, { filename: 'task-horizon.main.js' }),
    'manifest fragments must parse when loaded in plugin order');

const groupDocs = {
    all: ['doc-a1', 'doc-b1', 'doc-b-tab', 'doc-b-child', 'doc-c1'],
    groupA: ['doc-a1'],
    groupB: ['doc-b1', 'doc-b-tab', 'doc-b-child'],
};
const context = {
    console,
    Map,
    Set,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Math,
    Date,
    Promise,
    setTimeout,
    clearTimeout,
    SettingsStore: {
        data: {
            currentGroupId: 'groupA',
            docGroups: [
                { id: 'groupA', name: 'A' },
                { id: 'groupB', name: 'B' },
            ],
            docTabCustomGroups: [
                {
                    id: 'tab-b',
                    docGroupId: 'groupB',
                    entries: [
                        { id: 'doc-b-tab', includeChildren: true },
                    ],
                },
            ],
        },
    },
    state: { allDocuments: [], taskTree: [] },
    __tmT: (key) => key,
    __tmNormalizeEnabledViews: (views) => Array.from(new Set((Array.isArray(views) ? views : []).map(String))),
    __tmNormalizeHexColor: (value, fallback = '') => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toLowerCase() : fallback,
    __tmNormalizeDocScopeDocIds: (ids) => Array.from(new Set((Array.isArray(ids) ? ids : []).map((id) => String(id || '').trim()).filter(Boolean))),
    __tmIsLikelyBlockId: () => true,
    __tmResolveDocGroupName: (group) => group.name,
    __tmExpandDocTabCustomGroup: (group) => new Map([
        ['doc-b-tab', { direct: true }],
        ['doc-b-child', { direct: false }],
        ['doc-a1', { direct: false }],
    ]),
    resolveDocIdsFromGroups: async ({ groupId }) => groupDocs[groupId] || [],
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(runtimeSource, context, { filename: '35-custom-board-runtime.js' });
const migrationStart = storeSource.indexOf('    function __tmNormalizeCustomBoardGroupMode(');
const migrationEnd = storeSource.indexOf('    // 设置存储', migrationStart);
assert.ok(migrationStart >= 0 && migrationEnd > migrationStart, 'missing custom-board settings migration');
vm.runInContext(storeSource.slice(migrationStart, migrationEnd), context, { filename: 'custom-board-settings-migration.js' });
const normalizeViewsStart = servicesSource.indexOf('    const __tmNormalizeEnabledViews =');
const normalizeViewsEnd = servicesSource.indexOf('\n    const __tmGetEnabledViews =', normalizeViewsStart);
assert.ok(normalizeViewsStart >= 0 && normalizeViewsEnd > normalizeViewsStart, 'missing enabled-view normalizer');
const viewOrderProbe = vm.createContext({});
vm.runInContext(`
    const __TM_ALL_VIEWS = ${JSON.stringify(
        ['list', 'checklist', 'timeline', 'kanban', 'comboBoard', 'calendar', 'whiteboard'].map((id) => ({ id }))
    )};
    ${servicesSource.slice(normalizeViewsStart, normalizeViewsEnd)}
    globalThis.normalizeViewOrder = __tmNormalizeEnabledViews;
`, viewOrderProbe, { filename: 'view-order-normalizer.js' });
assert.deepEqual(
    Array.from(viewOrderProbe.normalizeViewOrder(['whiteboard', 'list', 'kanban', 'list'])),
    ['whiteboard', 'list', 'kanban'],
    'view normalization must preserve stored order while removing duplicates'
);
context.SettingsStore.data.customBoardSets = [];
assert.equal(vm.runInContext('__tmCanCreateAdditionalCustomBoardSet()', context), true,
    'free users may create their first combination board');
context.SettingsStore.data.customBoardSets = [{ id: 'set-free', name: 'Free', boards: [] }];
delete context.tmLicenseHasFeature;
assert.equal(vm.runInContext('__tmCanCreateAdditionalCustomBoardSet()', context), false,
    'free users cannot create a second combination board');
context.tmLicenseHasFeature = () => true;
assert.equal(vm.runInContext('__tmCanCreateAdditionalCustomBoardSet()', context), true,
    'full-feature users may create additional combination boards');
context.SettingsStore.data.customBoardSets = [];

(async () => {
    let licenseLoadCalls = 0;
    context.SettingsStore.data.customBoardSets = [{ id: 'set-free', name: 'Free', boards: [] }];
    context.tmLicenseHasFeature = () => false;
    context.tmGetLicenseState = () => ({ loaded: true, active: false });
    context.tmLicenseLoad = async () => { licenseLoadCalls += 1; };
    assert.equal(await vm.runInContext('__tmCanCreateAdditionalCustomBoardSetAfterLicenseCheck()', context), false,
        'a loaded free license must be rejected immediately');
    assert.equal(licenseLoadCalls, 0, 'a loaded free license must not trigger another slow license read');
    context.tmGetLicenseState = () => ({ loaded: false, active: false });
    context.tmLicenseLoad = async () => {
        licenseLoadCalls += 1;
        context.tmLicenseHasFeature = () => true;
    };
    assert.equal(await vm.runInContext('__tmCanCreateAdditionalCustomBoardSetAfterLicenseCheck()', context), true,
        'an unloaded license may be loaded once before entitlement is rejected');
    assert.equal(licenseLoadCalls, 1);
    context.SettingsStore.data.customBoardSets = [
        { id: 'set-first', name: 'First', boards: [] },
        { id: 'set-second', name: 'Second', boards: [] },
    ];
    context.SettingsStore.data.activeCustomBoardSetId = 'set-second';
    context.tmGetLicenseState = () => ({ loaded: true, active: false, features: [] });
    assert.equal(vm.runInContext('__tmGetActiveCustomBoardSet().id', context), 'set-first',
        'an expired or free license must enter only the first board set');
    assert.equal(vm.runInContext('__tmCanAccessCustomBoardSetIndex(1)', context), false,
        'an expired or free license must not access the second board set');
    context.tmGetLicenseState = () => ({ loaded: true, active: true, features: ['pro'] });
    assert.equal(vm.runInContext('__tmGetActiveCustomBoardSet().id', context), 'set-second',
        'an active full-feature license may access later board sets');
    assert.equal(vm.runInContext('__tmCanAccessCustomBoardSetIndex(1)', context), true);
    context.HTMLElement = class HTMLElement {};
    context.document = { getElementById: () => null };
    context.tmOpenCustomBoardSetManager = () => {};
    context.render = () => {};
    let boardSetOrderSaves = 0;
    context.SettingsStore.save = async () => { boardSetOrderSaves += 1; };
    context.SettingsStore.data.customBoardSets = [
        { id: 'set-a', name: 'A', boards: [] },
        { id: 'set-b', name: 'B', boards: [] },
        { id: 'set-c', name: 'C', boards: [] },
    ];
    context.SettingsStore.data.activeCustomBoardSetId = 'set-b';
    assert.equal(await vm.runInContext("tmMoveCustomBoardSet('set-c', -1)", context), true);
    assert.deepEqual(
        Array.from(context.SettingsStore.data.customBoardSets, (set) => set.id),
        ['set-a', 'set-c', 'set-b'],
        'moving a board set must change the persisted topbar selector order',
    );
    assert.equal(context.SettingsStore.data.activeCustomBoardSetId, 'set-b',
        'reordering board sets must not switch the active set or reload its tasks');
    assert.equal(boardSetOrderSaves, 1);
    const compositeScopeCache = new Map();
    context.__tmLoadDocScopeCacheStore = async () => null;
    context.__tmGetCachedDocScope = (key) => compositeScopeCache.get(key) || null;
    context.__tmRememberDocScope = (key, docIds, options = {}) => {
        compositeScopeCache.set(key, { key, docIds: docIds.slice(), boardDocIds: options.boardDocIds || {} });
        return true;
    };
    context.SettingsStore.data.customBoardSets = [{
        id: 'set-cache',
        name: 'Cache',
        boards: [
            { id: 'board-a', name: 'A', scope: { mode: 'groups', groupIds: ['groupA'] } },
            { id: 'board-b', name: 'B', scope: { mode: 'docs', docIds: ['doc-b1'] } },
        ],
    }];
    context.SettingsStore.data.activeCustomBoardSetId = 'set-cache';
    let scopeResolutionCalls = 0;
    context.resolveDocIdsFromGroups = async ({ groupId }) => {
        scopeResolutionCalls += 1;
        return groupDocs[groupId] || [];
    };
    const firstScope = await vm.runInContext('__tmResolveCustomBoardSetDocumentScopes()', context);
    const secondScope = await vm.runInContext('__tmResolveCustomBoardSetDocumentScopes()', context);
    assert.equal(scopeResolutionCalls, 1, 'the combination-board document scope must reuse the existing scope cache across repeated loads');
    assert.deepEqual(Array.from(firstScope.docIds), ['doc-a1', 'doc-b1']);
    assert.deepEqual(Array.from(secondScope.boardDocIds['board-a']), ['doc-a1']);
    assert.ok(Array.from(compositeScopeCache.values()).some((entry) => entry.boardDocIds?.['board-b']?.includes('doc-b1')),
        'composite combination-board scopes must persist per-board membership through the existing doc-scope cache API');
    assert.equal(vm.runInContext(
        "__tmNormalizeCachedCustomBoardDocIds({ 'board-a': [] }, [{ id: 'board-a' }])",
        context,
    ), null, 'an all-empty persisted scope must not suppress a fresh combination-board scope read');
    context.SettingsStore.data.customBoardSets = [];
    context.SettingsStore.data.activeCustomBoardSetId = '';

    const legacySettings = {
        customBoardFeatureVersion: 0,
        enabledViews: ['list', 'kanban'],
        customBoardSets: [],
        activeCustomBoardSetId: '',
    };
    context.legacySettings = legacySettings;
    assert.equal(vm.runInContext('__tmMigrateCustomBoardFeatureSettings(legacySettings)', context), true);
    assert.ok(legacySettings.enabledViews.includes('comboBoard'),
        'legacy settings must add the combination board after cloud hydration');
    assert.equal(legacySettings.customBoardFeatureVersion, 1);
    assert.equal(legacySettings.viewSwitcherStyle, 'icons',
        'the first custom-board release must switch the compact topbar to icon mode');
    assert.equal(legacySettings.viewSwitcherStyleVersion, 1);
    assert.equal(legacySettings.customBoardGroupMode, 'doc',
        'legacy settings must receive the combination-board grouping default');
    assert.equal(vm.runInContext(`__tmNormalizeCustomBoardGroupMode('invalid')`, context), 'doc',
        'invalid combination-board grouping values must fall back to document grouping');
    assert.match(storeSource, /customBoardGroupMode:\s*'doc'/,
        'combination-board grouping must have a persisted global default');
    assert.match(storeSource, /Storage\.set\('tm_custom_board_group_mode',\s*this\.data\.customBoardGroupMode\)/,
        'the combination-board grouping default must persist to local settings');

    const disabledSettings = {
        customBoardFeatureVersion: 1,
        enabledViews: ['list', 'kanban'],
        customBoardSets: [],
        activeCustomBoardSetId: '',
        customBoardGroupMode: 'doc',
        viewSwitcherStyle: 'text',
        viewSwitcherStyleVersion: 1,
    };
    context.disabledSettings = disabledSettings;
    assert.equal(vm.runInContext('__tmMigrateCustomBoardFeatureSettings(disabledSettings)', context), false);
    assert.ok(!disabledSettings.enabledViews.includes('comboBoard'),
        'an explicit post-migration view choice must not re-enable the combination board');
    assert.ok((storeSource.match(/__tmMigrateCustomBoardFeatureSettings\(this\.data\)/g) || []).length >= 2,
        'custom-board migration must run after cloud hydration and on the local fallback path');
    assert.match(storeSource,
        /enabledViews: \['list', 'checklist', 'timeline', 'kanban', 'comboBoard', 'calendar', 'whiteboard'\]/,
        'combination board must sit beside Kanban so it remains visible in the top switcher');
    assert.match(runtimeSource, /__tmRenderTopbarSelect\(\{[\s\S]*?id: 'tmTopbarCustomBoardSetSelect'/,
        'board-set switching must use the shared Basecoat topbar select');
    assert.match(runtimeSource, /id: 'tmTopbarCustomBoardSetSelect'[\s\S]*?className: 'tm-custom-board-set-select'/,
        'the board-set selector must use its dedicated auto-width control class');
    assert.match(stylesSource, /\.tm-filter-rule-bar \.tm-custom-board-set-select\s*\{[^}]*width:\s*max-content !important;[^}]*min-width:\s*0;/,
        'the board-set selector width must follow the current set name');
    assert.doesNotMatch(stylesSource, /\.tm-filter-rule-bar \.tm-custom-board-set-select\s*\{[^}]*width:\s*min\(180px, 22vw\);/,
        'the board-set selector must not return to a fixed desktop-style width');
    assert.match(stylesSource, /\.tm-modal:is\(\.tm-modal--mobile, \.tm-modal--dock\)[\s\S]*?\.tm-custom-board-set-select \.bc-select-trigger__chevron\s*\{[^}]*display:\s*none;/,
        'narrow combination-board selectors must hide the unused expansion chevron');
    assert.match(stylesSource, /\.tm-modal:is\(\.tm-modal--mobile, \.tm-modal--dock\)[\s\S]*?\.tm-custom-board-topbar\s*\{[^}]*gap:\s*var\(--tm-topbar-icon-gap\);[^}]*\}[\s\S]*?\.tm-topbar-right\s*\{[^}]*gap:\s*var\(--tm-topbar-icon-gap\) !important;/,
        'narrow combination-board controls must retain explicit gaps between adjacent buttons');
    assert.match(stylesSource, /\.tm-filter-rule-bar\s*\{[^}]*--tm-topbar-icon-gap:\s*6px;/,
        'topbar buttons must share the compact spacing used by the combination board');
    assert.match(stylesSource, /\.tm-filter-rule-bar \.tm-topbar-right\s*\{[^}]*gap:\s*var\(--tm-topbar-icon-gap\);/,
        'the right-side icon cluster must use the shared compact gap');
    assert.match(stylesSource, /\.tm-filter-rule-bar \.tm-compact-topbar-actions\s*\{[^}]*gap:\s*var\(--tm-topbar-icon-gap\);/,
        'compact desktop icon actions must use the shared compact gap');
    assert.match(stylesSource, /\.tm-filter-rule-bar \.tm-mobile-menu-btn > div\s*\{[^}]*gap:\s*var\(--tm-topbar-icon-gap\) !important;/,
        'mobile and Dock action buttons must keep the same compact spacing');
    assert.match(stylesSource, /@container tm-modal \(max-width: 760px\)[\s\S]*?\[data-tm-render-mode="comboBoard"\][\s\S]*?grid-template-columns:\s*minmax\(0, max-content\) var\(--tm-combo-manage-track\)[\s\S]*?\.bc-select-trigger__chevron\s*\{[^}]*display:\s*none;/,
        'container-width layout must reserve the manager button column and hide the chevron');
    assert.doesNotMatch(renderRuntimeSource, /tm-custom-board-mobile-controls/,
        'the narrow topbar menu must not duplicate board-set switching and management in a footer');
    assert.doesNotMatch(renderRuntimeSource, /tm-mobile-topbar-fold|tm-mobile-topbar-secondary-actions|__tmCompactTopbar/,
        'narrow topbar actions must not have a fold button, collapsible wrapper or collapse state');
    assert.doesNotMatch(stylesSource, /tm-compact-topbar-icons-collapsed|tm-compact-topbar-icons-expanded|tm-mobile-topbar-fold/,
        'narrow topbar actions must not retain collapse or expansion styles');
    assert.match(stylesSource, /\[data-tm-render-mode="comboBoard"\] \.tm-topbar-row--main\s*\{[^}]*display:\s*grid !important;[^}]*grid-template-columns:\s*minmax\(0, 1fr\) max-content;/,
        'the narrow combo topbar must reserve the right action group before shrinking the brand controls');
    assert.match(stylesSource, /\[data-tm-render-mode="comboBoard"\] \.tm-title\s*\{[^}]*display:\s*grid !important;[^}]*grid-template-columns:\s*var\(--tm-combo-brand-track, 30px\) var\(--tm-combo-home-track\) var\(--tm-combo-choice-track\);/,
        'the narrow combo title must reserve brand, home and selector tracks explicitly');
    assert.match(stylesSource, /\[data-tm-render-mode="comboBoard"\] \.tm-mobile-menu-btn > div\s*\{[^}]*gap:\s*var\(--tm-topbar-icon-gap\) !important;/,
        'mobile add, refresh, menu and close buttons must use a compact non-overlapping gap');
    assert.match(servicesSource, /comboBoard: __tmT\("task\.preparingTheCombinationBoard"\)/,
        'combination-board loading must not reuse the Kanban loading label');
    const homepageCtxStart = servicesSource.indexOf('    function __tmBuildHomepageCtx(');
    const homepageCtxEnd = servicesSource.indexOf('\n    let __tmHomepageRefreshTimer', homepageCtxStart);
    assert.ok(homepageCtxStart >= 0 && homepageCtxEnd > homepageCtxStart, 'missing homepage context builder');
    const homepageCtxSource = servicesSource.slice(homepageCtxStart, homepageCtxEnd);
    const homepageCtxContext = vm.createContext({
        SettingsStore: { data: {
            currentGroupId: 'groupA',
            docGroups: [{ id: 'groupA', name: 'A' }],
        } },
        state: {
            homepageOpen: true,
            viewMode: 'comboBoard',
            activeDocId: 'doc-a1',
            taskTree: [{ id: 'doc-a1', name: 'Document A' }],
        },
        HTMLElement: class HTMLElement {},
        __tmT: (key) => key,
        __tmResolveDocGroupName: (group) => group.name,
        __tmCollectHomepageTasks: () => [],
        __tmNormalizeDateOnly: () => '2026-11-07',
        __tmTomatoHistoryVersion: 0,
        __tmIsAiFeatureEnabled: () => false,
        __tmIsDockHost: () => false,
        __tmIsMobileDevice: () => false,
        __tmHostUsesMobileUI: () => false,
        __tmGetProcrastinationMetricsForTasks: () => ({}),
        __tmBuildHomepageProjects: () => ({}),
        __tmGetActiveCustomBoardSet: () => ({ id: 'set-work', name: '工作看板' }),
    });
    homepageCtxContext.window = homepageCtxContext;
    vm.runInContext(`${homepageCtxSource}\nglobalThis.homepageCtx = __tmBuildHomepageCtx();`, homepageCtxContext,
        { filename: 'homepage-context.js' });
    assert.equal(homepageCtxContext.homepageCtx.currentGroupName, 'A',
        'the document group must remain available to homepage modules');
    assert.equal(homepageCtxContext.homepageCtx.currentDocName, '工作看板',
        'homepage opened from a combination board must use the active board-set name as its visible scope');
    homepageCtxContext.state.viewMode = 'kanban';
    vm.runInContext('globalThis.normalHomepageCtx = __tmBuildHomepageCtx();', homepageCtxContext);
    assert.equal(homepageCtxContext.normalHomepageCtx.currentDocName, 'Document A',
        'ordinary task views must retain the existing document scope name on the homepage');
    assert.match(runtimeSource, /bc-btn bc-btn--sm tm-custom-board-manage-btn/,
        'the board-set manager action must use the shared topbar button style');
    assert.match(runtimeSource, /tm-custom-board-manage-btn[^\n]*__tmRenderLucideIcon\('settings-2', '', \{ size: 15 \}\)/,
        'the topbar board-set manager action must reuse the edit-sub-board sliders icon');
    assert.doesNotMatch(runtimeSource, /tm-custom-board-manage-btn[^\n]*__tmRenderLucideIcon\('settings'\)/,
        'the board-set manager action must not duplicate the plugin settings gear');
    assert.match(runtimeSource, /bc-btn bc-btn--sm bc-btn--ghost tm-custom-board-manager-icon-btn/,
        'custom-board manager row actions must reuse Basecoat button styles');
    assert.match(runtimeSource, /function __tmCanCreateAdditionalCustomBoardSet[\s\S]*?tmLicenseHasFeature\('pro'\)/,
        'additional combination boards must require the full-feature entitlement');
    assert.match(runtimeSource, /licenseState\?\.loaded !== true[\s\S]*?await window\.tmLicenseLoad/,
        'entitlement checks must avoid rereading an already loaded free license');
    assert.match(runtimeSource, /window\.tmRequireFullFeature\?\.\('pro'[\s\S]*?onViewBenefits:\s*\(\)\s*=>\s*window\.tmCloseCustomBoardDialog\(\)/,
        'the combination-board manager must close only when the user opens feature benefits');
    assert.doesNotMatch(runtimeSource, /tm-custom-board-manager__benefit/,
        'the manager must not show a persistent combination-board entitlement card');
    assert.match(runtimeSource, /tmRequireFullFeature\?\.\('pro', __tmT\("task\.additionalCombinationBoardSets"\)/,
        'the upgrade prompt must appear only when a limited user clicks create');
    assert.match(runtimeSource, /function __tmGetAccessibleCustomBoardSets[\s\S]*sets\.slice\(0, 1\)/,
        'free and expired licenses must expose only the first board set');
    assert.match(loaderSource, /const filterRulesPromise = __tmEnsureFilterRulesLoaded\(\)[\s\S]*const docTabOrderGroupIds = customBoardMode[\s\S]*const docTabOrderEntriesPromise = customBoardMode[\s\S]*__tmResolveCurrentGroupAllDocEntries[\s\S]*Promise\.all\(\[[\s\S]*filterRulesPromise,[\s\S]*docTabOrderEntriesPromise,[\s\S]*state\.__tmDocTabOrderByGroup = docTabOrderByGroup/,
        'custom-board loading must resolve filter rules and every relevant document-group tab order concurrently');
    assert.match(loaderSource, /const countMetaPromise = ensureTaskCountMapForCacheRestore\('snapshot-cache'\)[\s\S]*Promise\.all\(\[\s*countMetaPromise,[\s\S]*snapshotService\?\.load/,
        'snapshot loading must run concurrently with task-count retrieval');
    assert.match(loaderSource, /taskCountMapPromise: countMetaPromise/,
        'task-index restoration must run concurrently with task-count retrieval');
    assert.match(storeSource, /taskCountMapPromise[\s\S]*Promise\.all\(\[storePromise, countPromise\]\)/, 'task-index storage and count reads must be parallel');
    assert.match(runtimeSource, /function __tmBuildCustomBoardProjectionShell[\s\S]*tasks: \[\][\s\S]*__tmBuildCustomBoardProjectionShell/,
        'combination boards must render their column shell from saved board settings before tasks arrive');
    assert.match(kanbanRenderSource, /state\.__tmCustomBoardLoading === true[\s\S]*tm-custom-board-column-loading[\s\S]*tm-inline-loading-kanban-card/,
        'the early combination-board shell must show task skeletons inside each column');
    assert.match(kanbanRenderSource, /customBoardLoadingClass = state\.__tmCustomBoardLoading === true[\s\S]*tm-body--custom-board\$\{bodyAnimClass\}\$\{customBoardLoadingClass\}/,
        'the populated early shell must retain its loading class while task skeletons are visible');
    assert.match(storeSource, /normalizedEntry\.boardDocIds = boardDocIds[\s\S]*cached\.boardDocIds = Object\.fromEntries/,
        'the existing doc-scope cache must preserve optional per-board membership metadata');
    assert.match(runtimeSource, /custom-board-set-scope-v1[\s\S]*__tmRememberDocScope\(key, docIds, \{[\s\S]*boardDocIds/,
        'combination-board scope caching must reuse the existing doc-scope cache');
    assert.match(shortcutCoreSource, /activeComboBoardSet\?\.id[\s\S]*saved = \{ viewId: 'comboBoard', comboBoardSetId/,
        'the existing shortcut session store must remember the last combination-board view and set');
    assert.match(shortcutCoreSource, /saved\.viewId === 'comboBoard'[\s\S]*accessibleSets[\s\S]*restoredSet/,
        'plugin startup must restore the last combination-board view, falling back to the first accessible set when needed');
    assert.match(runtimeSource, /tm-custom-board-manager__set-item[^\n]*is-locked[\s\S]*__tmRenderLucideIcon\(locked \? 'lock'/,
        'later retained board sets must render as locked entries after expiry');
    assert.match(runtimeSource, /tm-custom-board-manager__set-order[\s\S]*tmMoveCustomBoardSet\([^\n]* -1\)[\s\S]*tmMoveCustomBoardSet\([^\n]* 1\)/,
        'each board set must expose the same up/down ordering controls used by sub-boards');
    assert.match(runtimeSource, /window\.tmMoveCustomBoardSet = async function[\s\S]*__tmCanAccessCustomBoardSetIndexAfterLicenseCheck\(1, sets\)[\s\S]*SettingsStore\.save\(\)/,
        'board-set reordering must require multiple-set access and persist the new order');
    assert.match(runtimeSource, /function __tmBuildCustomBoardProjection\(options = \{\}\)[\s\S]*?state\.__tmCustomBoardLoading === true && opts\.allowWhileLoading !== true[\s\S]*?return Array\.isArray\(state\.customBoardProjection\)/,
        'stale task trees must not build or cache a projection while a new custom-board load is running');
    assert.match(loaderSource, /__tmBuildCustomBoardProjection\(\{ allowWhileLoading: true \}\)/,
        'only the completed custom-board loader pass may build the final projection while the loading token is active');
    assert.match(stylesSource, /\.tm-custom-board-manager__set-order\s*\{[^}]*display:\s*grid;[^}]*flex:\s*0 0 24px;/,
        'board-set ordering controls must use a compact vertical control column');
    assert.match(stylesSource, /@media \(max-width: 680px\)[\s\S]*?\.tm-custom-board-modal > \.tm-custom-board-manager\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\)/,
        'the mobile manager must reserve fixed header/footer space and give the remaining height to content');
    assert.match(stylesSource, /@media \(max-width: 680px\)[\s\S]*?\.tm-custom-board-manager__set-list\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/,
        'mobile board sets must use a compact single-column list');
    assert.match(stylesSource, /@media \(max-width: 680px\)[\s\S]*?\.tm-custom-board-manager__set-item > \.tm-badge\s*\{[^}]*display:\s*none;/,
        'mobile board-set cards must not repeat the sub-board count shown below the name');
    assert.match(stylesSource, /@media \(max-width: 680px\)[\s\S]*?\.tm-custom-board-manager__detail \.tm-custom-board-manager__list\s*\{[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/,
        'the mobile sub-board list must own vertical scrolling instead of clipping rows');
    assert.match(runtimeSource, /__tmBindPluginHostGestureIsolation\(modal\)/,
        'mobile sub-board dialogs must isolate host touch gestures');
    assert.match(runtimeSource, /const usesTouchInput = \([\s\S]*?if \(firstInput && !usesTouchInput\)/,
        'mobile sub-board dialogs must not autofocus text fields before a native select is tapped');
    assert.match(runtimeSource, /function __tmDecorateCustomBoardSelects[\s\S]*?tm-rule-select-control[\s\S]*?tm-custom-board-select-arrow/,
        'sub-board selects must reuse the rule-management select control');
    assert.match(runtimeSource, /trigger\.className\s*=\s*'bc-select tm-custom-board-select-trigger'/,
        'the option trigger must retain the shared Basecoat select class');
    assert.match(runtimeSource, /select\.classList\.add\('bc-select'\)/,
        'sub-board selects must inherit the native Basecoat select treatment');
    assert.match(renderRuntimeSource, /tm-custom-board-modal[\s\S]*?isTouchStandaloneDialog/,
        'standalone sub-board dialogs must stop host touch handlers on touch devices');
    assert.match(stylesSource, /\.tm-custom-board-editor \.tm-custom-board-field select,[\s\S]*?min-height:\s*44px;[\s\S]*?font-size:\s*16px;/,
        'mobile sub-board selects must expose a full native touch target');
    assert.match(stylesSource, /\.tm-custom-board-select-control\s*\{[^}]*width:\s*100%;/,
        'the shared sub-board select control must fill the editor field');
    assert.match(stylesSource, /\.tm-custom-board-select-trigger::before,[\s\S]*?\.tm-custom-board-select-trigger::after\s*\{[^}]*content:\s*none !important;/,
        'the Basecoat trigger must not add a second pseudo-element arrow');
    assert.match(stylesSource, /\.tm-custom-board-select-trigger\.bc-select\s*\{[^}]*background-image:\s*none !important;/,
        'the Basecoat trigger must not retain its background arrow');
    assert.match(runtimeSource, /window\.tmSelectCustomBoardSet = async function[\s\S]*__tmCanAccessCustomBoardSetIndexAfterLicenseCheck[\s\S]*__tmPromptCustomBoardSetAccessRestriction/,
        'the manager must block entering inaccessible board sets');
    assert.match(runtimeSource, /window\.tmSelectCustomBoardSetFromTopbar = async function[\s\S]*__tmCanAccessCustomBoardSetIndexAfterLicenseCheck/,
        'the topbar selector must enforce the same board-set access limit');
    assert.match(runtimeSource, /const handler = \(\) => \{[\s\S]*__tmEnforceCustomBoardSetAccess\(\)[\s\S]*on\(window, 'tm:task-horizon-license-changed'/,
        'license changes must immediately clamp an expired session back to the first board set');
    assert.match(runtimeSource, /function __tmEnforceCustomBoardSetAccess\(\)[\s\S]*if \(document\.querySelector\('\.tm-custom-board-modal'\)\)[\s\S]*__tmRefreshCustomBoardSetManagerInPlace/,
        'license refreshes must not open the combination-board manager when none is visible');
    assert.match(shortcutCoreSource, /activeCustomBoardSetId = value\.comboBoardSetId;[\s\S]*__tmGetActiveCustomBoardSet[\s\S]*activeCustomBoardSetId = accessibleSetId/,
        'restored combination-board shortcuts must also resolve to an accessible board set');
    assert.match(shortcutCoreSource, /activeCustomBoardSetId = item\.comboBoardSetId;[\s\S]*__tmGetActiveCustomBoardSet[\s\S]*activeCustomBoardSetId = accessibleSetId/,
        'opening a combination-board shortcut must also resolve to an accessible board set');
    assert.match(servicesSource, /task\.combinationBoardSets[\s\S]*task\.multipleCombinationBoardSets/,
        'the feature comparison must list one board set for free and multiple for full feature access');
    assert.match(renderRuntimeSource, /tm-homepage-entry-btn[\s\S]*?__tmRenderCustomBoardSetTopbar\(\)/,
        'the combination-board set selector must sit immediately to the right of the homepage button');
    assert.match(renderRuntimeSource, /\$\{!comboBoardMode \? `\s*<div class="tm-rule-selector">\s*<span class="tm-rule-label[^]*?task\.tasks2/,
        'combination boards must omit document, rule and task-count controls while retaining grouping');
    assert.match(appearanceSource, /tm-settings-topbar-controls[\s\S]*?settings\.viewSwitcherStyle[\s\S]*?bc-tabs-list tm-settings-choice-group[\s\S]*?updateViewSwitcherStyle\('text'\)/,
        'view-switcher style must be exposed as a flat appearance topbar-control row');
    assert.doesNotMatch(appearanceSource, /settings\.topBarControlStyle/,
        'the nested duplicate topbar-control-shape heading must not return');
    assert.match(stylesSource, /tm-settings-topbar-controls[\s\S]*tm-settings-topbar-metric-grid[\s\S]*tm-settings-topbar-metric-label[\s\S]*border-bottom/,
        'topbar appearance controls must use flat divider rows instead of nested cards');
    assert.match(servicesSource, /Tabler LayoutKanban[\s\S]*kanban: '<path d="M4 4h6M14 4h6"\/><rect x="4" y="8" width="6" height="12"/,
        'the kanban view must use the more recognizable Tabler layout icon');
    assert.match(servicesSource, /data-tm-view-icon="\$\{__tmEscAttr\(normalizedId\)\}"/,
        'prototype view icons must expose their view id for icon-specific rendering');
    assert.doesNotMatch(stylesSource, /data-tm-view-icon="checklist"[\s\S]*fill:\s*currentColor !important;[\s\S]*stroke:\s*none !important;/,
        'the checklist icon must remain outlined rather than filled');
    assert.match(servicesSource, /const iconOnly = \(opts\.desktopTopbar === true \|\| opts\.mobileBottom === true\)/,
        'the narrow-screen bottom switcher must follow the same icon or text setting as the top switcher');
    assert.match(renderRuntimeSource, /tm-mobile-bottom-view-switcher \.tm-view-seg-item\.tm-view-seg-item--icon-only[\s\S]*?flex: 1 1 0% !important;[\s\S]*?min-width: 34px !important;[\s\S]*?max-width: none !important;/,
        'narrow-screen bottom switcher icons must distribute across the available width with a compact minimum size');
    assert.match(servicesSource, /const ordered = arr\.filter\(\(id\) =>[\s\S]*?seen\.add\(id\)/,
        'enabled views must preserve the user-visible array order');
    assert.match(settingsScreenSource, /data-tm-view-order[\s\S]*tmMoveEnabledView/,
        'visible-view settings must expose controls for reordering');
    assert.match(settingsActionsSource, /window\.tmMoveEnabledView = async function/,
        'view-order changes must persist through a dedicated settings action');
    assert.match(kanbanRenderSource, /renderCustomBoardTaskTree\(child, depthInCol \+ 1[,)]/,
        'combination-board parents and subtasks must stay in one visual tree');
    assert.match(kanbanRenderSource, /const boardGroupMode = __tmNormalizeCustomBoardGroupMode\(column\?\.groupMode\)[\s\S]*?renderCustomBoardGroupedTasks\(\s*boardId,\s*boardGroupMode/,
        'each sub-board must apply its own grouping mode inside its lane');
    assert.match(kanbanRenderSource, /const visibleTabDocs = typeof __tmGetVisibleDocTabsForCurrentGroup === 'function'[\s\S]*?__tmGetVisibleDocTabsForCurrentGroup\(\)[\s\S]*?__tmSortDocEntriesForTabs\(state\.taskTree \|\| \[\], currentGroupId\)[\s\S]*?const docRank = new Map/,
        'document groups must derive their primary order from the final visible document-tab order');
    assert.match(kanbanRenderSource, /const currentGroupDocTabOrder = state\.__tmDocTabOrderByGroup\?\.\[currentGroupId\][\s\S]*?const orderedVisibleFromGroup[\s\S]*?\.\.\.pinnedIds,[\s\S]*?\.\.\.orderedVisibleFromGroup,[\s\S]*?\.\.\.visibleTabDocIds/,
        'current-group tab order and visible pinned tabs must lead the remaining tab order');
    assert.match(kanbanRenderSource, /getCustomBoardDocTabOrderIds = \(board\)[\s\S]*scope\.mode === 'groups'[\s\S]*createCustomBoardDocGroupComparator[\s\S]*compareBoardDocGroupOrder\(a\.key, b\.key\)/,
        'each document-grouped sub-board must rank documents from its own scope group tab order');
    assert.match(kanbanRenderSource, /const compareDocGroupOrder[\s\S]*?docRank\.get\(aKey\)[\s\S]*?docOrderById\.get\(aKey\)/,
        'documents outside the current tab scope must fall back to the stable document-registry order');
    assert.match(kanbanRenderSource, /customBoardGroupMode === 'doc'[\s\S]*?compareBoardDocGroupOrder\(a\.key, b\.key\)/,
        'moving a task must not reorder document groups based on the first task position');
    assert.match(kanbanRenderSource, /const kanbanAppearance = SettingsStore\.data\.kanbanAppearance === 'classic' \? 'classic' : 'lanes'/,
        'combination boards must reuse the same card or lane appearance setting as the Kanban view');
    assert.match(kanbanRenderSource, /tm-body--custom-board[^`]*data-kanban-appearance="\$\{kanbanAppearance\}"\$\{laneStrengthStyle\}/,
        'combination-board containers must expose the shared appearance value used by Kanban card styling');
    assert.match(settingsActionsSource, /updateKanbanAppearance[\s\S]*?viewMode !== 'kanban' && viewMode !== 'comboBoard'/,
        'changing the shared Kanban appearance must rerender an open combination board immediately');
    assert.match(kanbanRenderSource, /const separateCompletedRootGroup = state\.showCompletedTasks === true[\s\S]*?completedTasksInlineInGroups !== true[\s\S]*?__tmSplitTasksByDoneState/,
        'completed tasks must be separated unless the completed-inline setting is enabled');
    assert.match(kanbanRenderSource, /return renderActiveGroups\(\) \+ renderCompletedRootGroup\(\);/,
        'the completed root group must render at the bottom of each custom-board lane');
    assert.match(kanbanRenderSource, /dropKind:\s*docId === '__unknown__' \? '' : 'doc'[\s\S]*?dropKind:\s*typeof __tmBuildKanbanTimeDropTarget[\s\S]*?'time'[\s\S]*?dropKind:\s*rule \? 'quadrant'/,
        'document, time and quadrant group rows must expose matching task drop targets');
    assert.match(kanbanRenderSource, /data-tm-kb-drop-time[\s\S]*?data-tm-kb-drop-quadrant[\s\S]*?tmKanbanGroupDrop\(event\)/,
        'custom-board grouping rows must bind the shared Kanban group drop handlers');
    assert.match(kanbanRenderSource, /const cardDragAttrs = useKanbanCustomCardGesture/,
        'desktop combination-board cards must keep native draggable attributes');
    assert.doesNotMatch(settingsScreenSource, /main-custom-board-group-mode/,
        'the per-board grouping setting must live in the combination-board manager, not general settings');
    assert.match(runtimeSource, /tm-custom-board-manager__layout[\s\S]*task\.subBoardGrouping[\s\S]*data-field="groupMode"/,
        'each sub-board editor must expose its own grouping setting');
    assert.match(runtimeSource, /function __tmRefreshCustomBoardSetManagerInPlace\(\)[\s\S]*window\.tmSelectCustomBoardSet = async function[\s\S]*__tmRefreshCustomBoardSetManagerInPlace\(\)/,
        'switching board sets must refresh the manager contents in place instead of recreating the modal');
    assert.doesNotMatch(settingsActionsSource, /updateCustomBoardGroupMode/,
        'combination-board grouping must not be managed as a board-set or global setting');
    assert.match(kanbanRenderSource, /class="tm-kanban-col\$\{isColumnCollapsed/,
        'combination-board columns must reuse the existing Kanban column markup');
    assert.match(kanbanRenderSource, /data-kind="custom"[\s\S]*?ondragover="tmKanbanDragOver\(event\)"[\s\S]*?ondrop="tmKanbanDrop\(event\)"/,
        'combination-board columns must receive the same drag-over and drop events as Kanban');
    assert.doesNotMatch(kanbanRenderSource, /tm-kanban-col--custom|tm-custom-board-lane-header/,
        'combination-board columns must not introduce a separate card visual style');
    assert.match(stylesSource, /\.tm-view-seg-item__svg,\s*\.tm-view-seg-item__svg \*\s*\{[^}]*fill:\s*none !important;[^}]*stroke:\s*currentColor !important;/,
        'prototype view icons must remain outlined when the host theme forces SVG fill');
    assert.match(runtimeSource, /function __tmIsCustomBoardShellContext\(modeInput = ''\)[\s\S]*?mode === __TM_CUSTOM_BOARD_VIEW_MODE[\s\S]*?state\.homepageOpen === true[\s\S]*?state\.viewMode \|\| ''\)\.trim\(\) === __TM_CUSTOM_BOARD_VIEW_MODE/,
        'combination-board shell context must include both the board view and its homepage');
    assert.match(docTabsSource, /function __tmDocTabsForcedHiddenForActiveView\(\)[\s\S]*?return __tmIsCustomBoardShellContext\(mode\)/,
        'every document-tab visibility update must honor the shared combination-board shell context');
    assert.match(renderRuntimeSource, /const docTabsHidden = __tmIsCustomBoardShellContext\(renderMode\)/,
        'the initial shell render must hide document tabs for a combination-board homepage');
    const previousHomepageOpen = context.state.homepageOpen;
    const previousViewMode = context.state.viewMode;
    context.state.homepageOpen = true;
    context.state.viewMode = 'comboBoard';
    assert.equal(vm.runInContext("__tmIsCustomBoardShellContext('home')", context), true,
        'a homepage opened from a combination board must retain the combination-board shell context');
    context.state.viewMode = 'kanban';
    assert.equal(vm.runInContext("__tmIsCustomBoardShellContext('home')", context), false,
        'an ordinary view homepage must keep its normal document-tab behavior');
    context.state.homepageOpen = previousHomepageOpen;
    context.state.viewMode = previousViewMode;
    assert.match(stylesSource, /\.tm-modal\[data-tm-render-mode="comboBoard"\]\s+\.tm-doc-tabs\s*\{[^}]*display:\s*none !important;/,
        'combination-board mode must keep the document-tab bar out of layout even during visibility updates');
    assert.match(stylesSource, /\.tm-view-seg-item\.tm-view-seg-item--icon-only\s*\{[^}]*display:\s*inline-grid(?:\s*!important)?;[^}]*place-items:\s*center(?:\s*!important)?;[^}]*transform:\s*none !important;/,
        'view-switcher icons must use the prototype static grid without layout or transform drift');
    assert.match(stylesSource, /\.tm-view-seg-item--icon-only \.tm-view-seg-item__icon\s*\{[^}]*position:\s*static;[^}]*place-items:\s*center;[^}]*transition:\s*none !important;/,
        'view-switcher icon wrappers must not be absolutely positioned during document-tab transitions');
    assert.match(stylesSource, /\.tm-color-picker-backdrop\s*\{[^}]*z-index:\s*200100;/,
        'the color picker must stay above custom-board prompt dialogs');
    assert.match(sceneContextSource, /min-height:42px;max-height:42px;height:42px;/,
        'desktop topbar must retain the existing fixed 42px height');
    assert.match(renderRuntimeSource, /\.tm-modal\.tm-modal--doc-tabs-hidden \.tm-filter-rule-bar\s*\{[^}]*border-bottom-color:\s*transparent;/,
        'hiding document tabs must preserve the topbar border box so controls keep the same vertical center');
    assert.doesNotMatch(renderRuntimeSource, /\.tm-modal\.tm-modal--doc-tabs-hidden \.tm-filter-rule-bar\s*\{[^}]*border-bottom:\s*0;/,
        'hiding document tabs must not remove the topbar border from its fixed-height box');
    assert.doesNotMatch(stylesSource, /\.tm-filter-rule-bar\s*\{[^}]*flex:\s*0 0 56px;/,
        'document-tab expansion must not alter the topbar flex height');
    assert.match(kanbanRenderSource, /state\.__tmCustomBoardLoading === true && !customBoardColumns\.length/,
        'combination boards must show loading instead of the empty-board call to action while data loads');
    assert.match(kanbanRenderSource, /tm-inline-loading-overlay tm-inline-loading-overlay--skeleton" data-tm-loading-mode="kanban"/,
        'combination-board loading must reuse the exact Kanban skeleton markup and styling');
    assert.match(stylesSource, /\.tm-body--custom-board-loading \.tm-inline-loading-title::before[\s\S]*tm-inline-loading-spin/,
        'combination-board loading must show a visible spinner in the skeleton title');
    assert.match(stylesSource, /\.tm-body--custom-board-loading :is\(\.tm-inline-loading-kanban-col, \.tm-custom-board-column-loading\)[\s\S]*tm-custom-board-loading-breathe/,
        'combination-board skeleton columns must animate while task data loads');
    assert.match(stylesSource, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.tm-body--custom-board-loading[\s\S]*animation: none/,
        'combination-board loading motion must respect reduced-motion preferences');
    assert.match(loaderSource, /__tmCustomBoardLoading = true/,
        'the shared document loader must enter the combination-board loading state');
    assert.ok(detailOpenSource.includes("activeRenderMode === 'kanban' || activeRenderMode === 'comboBoard'"),
        'combination boards must open task details through the Kanban floating panel');
    assert.match(detailOpenSource, /clickedKanbanColumnKey[\s\S]*anchorColumnKey:\s*clickedKanbanColumnKey/,
        'task detail openings must retain the clicked combination-board lane');
    assert.match(detailRuntimeSource, /mode === 'kanban' \|\| mode === 'comboBoard'/,
        'task detail lifecycle helpers must accept the combination-board mode');
    assert.match(detailRuntimeSource, /const scopedCard = anchorColumnKey && cardSelector[\s\S]*tm-kanban-col\[data-col-key="\$\{CSS\.escape\(anchorColumnKey\)\}"\][\s\S]*const card = scopedCard \|\|/,
        'duplicate tasks in combination-board lanes must anchor detail to the clicked lane');
    assert.match(renderRuntimeSource, /kanbanHostMode !== 'kanban' && kanbanHostMode !== 'comboBoard'/,
        'the shared touch drag gesture must support combination boards');
    assert.match(renderRuntimeSource, /kind === 'custom'[\s\S]*combinationBoardCardsCanOnlyBeNestedWithinTheSameSubBoard/,
        'cross-lane combination-board drops must fail with a clear explanation');
    assert.match(renderRuntimeSource, /if \(kind === 'custom'\)\s*\{\s*__tmKanbanClearSurfaceDragOver\(\);[\s\S]*?return;/,
        'combination-board drag hover must not add the Kanban column background state');
    assert.match(renderRuntimeSource, /targetTimeKey = String\(dropTarget\.dataset\?\.tmKbDropTime[\s\S]*?targetQuadrantId = String\(dropTarget\.dataset\?\.tmKbDropQuadrant/,
        'group-row drops must pass time and quadrant targets into the shared mutation logic');
    assert.match(renderRuntimeSource, /targetColumnKind === 'custom'[\s\S]*The target card owns the highlight/,
        'touch dragging in combination boards must highlight only the target card');

    const normalized = vm.runInContext(`__tmNormalizeCustomBoardSets([
        { id: 'set-a', name: 'Work', groupMode: 'time', boards: [
            { id: 'board-a', name: 'Today', ruleId: 'rule-today', color: '#3B82F6', scope: { mode: 'groups', groupIds: ['groupA', 'groupB', 'groupA'] } },
            { id: 'board-a', name: 'duplicate', scope: { mode: 'all' } }
        ] },
        { id: 'set-a', name: 'duplicate set', boards: [] }
    ])`, context);
    assert.equal(normalized.length, 1, 'set IDs must be unique');
    assert.equal(normalized[0].boards.length, 1, 'sub-board IDs must be unique within a set');
    assert.equal(normalized[0].boards[0].groupMode, 'time',
        'sub-board grouping must migrate from the legacy set-level value');
    assert.equal(normalized[0].groupMode, undefined,
        'board sets must not retain a shared grouping value');
    assert.deepEqual(Array.from(normalized[0].boards[0].scope.groupIds), ['groupA', 'groupB']);
    assert.equal(normalized[0].boards[0].color, '#3b82f6');

    const resolved = await vm.runInContext(`__tmResolveCustomBoardSetDocumentScopes({
        id: 'set-a',
        boards: [
            { id: 'both-groups', scope: { mode: 'groups', groupIds: ['groupA', 'groupB'] } },
            { id: 'tab-in-b', scope: { mode: 'tabGroup', groupId: 'groupB', tabGroupId: 'tab-b' } },
            { id: 'explicit-doc', scope: { mode: 'docs', docIds: ['doc-c1'] } }
        ]
    })`, context);
    const plain = JSON.parse(JSON.stringify(resolved));
    assert.deepEqual(plain.boardDocIds['both-groups'].sort(), ['doc-a1', 'doc-b-child', 'doc-b-tab', 'doc-b1']);
    assert.deepEqual(plain.boardDocIds['tab-in-b'].sort(), ['doc-b-child', 'doc-b-tab'],
        'tab-group membership must be intersected with its owning document group');
    assert.deepEqual(plain.docIds, ['doc-a1', 'doc-b-child', 'doc-b-tab', 'doc-b1', 'doc-c1'],
        'scope unions must cross document groups and be independent of the active group');

    const rootTask = { id: 'root-task', root_id: 'doc-a1', content: 'Parent', done: false };
    const matchingChild = { id: 'matching-child', root_id: 'doc-a1', parentTaskId: 'root-task', content: 'needle', done: false };
    const siblingTask = { id: 'sibling-task', root_id: 'doc-a1', parentTaskId: 'root-task', content: 'Sibling', done: false };
    const siblingChild = { id: 'sibling-child', root_id: 'doc-a1', parentTaskId: 'sibling-task', content: 'Nested sibling', done: false };
    const unrelatedTask = { id: 'unrelated', root_id: 'doc-a1', content: 'Other', done: false };
    context.SettingsStore.data.customBoardSets = [{
        id: 'set-projection',
        name: 'Projection',
        boards: [{ id: 'board-projection', name: 'Filtered', ruleId: 'rule-needle', scope: { mode: 'docs', docIds: ['doc-a1'] } }],
    }];
    context.SettingsStore.data.activeCustomBoardSetId = 'set-projection';
    context.state.filterRules = [{
        id: 'rule-needle',
        conditions: [{ field: 'content', operator: '=', value: 'needle' }],
        sort: [],
    }];
    context.state.flatTasks = {
        'root-task': rootTask,
        'matching-child': matchingChild,
        'sibling-task': siblingTask,
        'sibling-child': siblingChild,
        unrelated: unrelatedTask,
    };
    context.state.__tmCustomBoardSourceDocIdsByBoard = { 'board-projection': ['doc-a1'] };
    context.state.showCompletedTasks = false;
    let taskStoreGlobalRevision = 1;
    const taskStoreDocRevisions = new Map([['doc-a1', 1]]);
    context.__tmTaskStore = {
        getFlatMap: () => context.state.flatTasks,
        revision: () => taskStoreGlobalRevision,
        captureRead: (docIds = []) => ({
            docRevisions: Object.fromEntries(docIds.map((id) => [id, taskStoreDocRevisions.get(id) || 0])),
        }),
        isReadCurrent: (token) => Object.entries(token?.docRevisions || {})
            .every(([id, revision]) => (taskStoreDocRevisions.get(id) || 0) === revision),
    };
    context.RuleManager = {
        applyRuleFilter: (tasks, rule) => tasks.filter((task) => rule.conditions.every((condition) => String(task[condition.field] || '') === String(condition.value))),
        applyRuleSort: (tasks) => tasks,
    };
    context.__tmProjectVisibility = { filterTasks: (tasks) => tasks, isTaskHidden: () => false };
    context.__tmIsTaskCompletedForProjection = () => false;
    context.__tmIsTaskCanceled = () => false;
    context.__tmIsInboxHiddenFromAllTab = () => false;
    context.__tmGetNormalizedRuleSorts = (rule) => rule?.sort || [];
    context.__tmSortPinnedTasksFirst = (tasks) => tasks;
    context.__tmUpdateFilteredTaskRenderWindowState = () => {};
    context.CustomEvent = function CustomEvent() {};
    context.window.dispatchEvent = () => {};
    const projected = vm.runInContext('__tmBuildCustomBoardProjection()', context);
    assert.deepEqual(Array.from(projected[0].tasks, (task) => task.id), ['root-task', 'matching-child'],
        'matching a child must preserve its parent path, while excluding unrelated siblings');
    context.state.filterRules[0].conditions = [{ field: 'content', operator: '=', value: 'Parent' }];
    const matchingParentProjected = vm.runInContext('__tmBuildCustomBoardProjection()', context);
    assert.deepEqual(Array.from(matchingParentProjected[0].tasks, (task) => task.id), ['root-task'],
        'matching a parent must not include non-matching descendants when the full-tree switch is off');
    context.state.filterRules[0].conditions = [{ field: 'content', operator: '=', value: 'needle' }];
    context.state.filterRules[0].keepMatchedTaskSubtree = true;
    const wholeTreeProjected = vm.runInContext('__tmBuildCustomBoardProjection()', context);
    assert.deepEqual(
        Array.from(wholeTreeProjected[0].tasks, (task) => task.id),
        ['root-task', 'matching-child', 'sibling-task', 'sibling-child'],
        'an enabled full-tree filter must show the top-level parent and all descendants',
    );
    context.__tmDateFilter = {
        active: () => true,
        matches: (task) => task.id === 'matching-child',
        setCandidates() {},
    };
    const dateWholeTreeProjected = vm.runInContext('__tmBuildCustomBoardProjection()', context);
    assert.deepEqual(
        Array.from(dateWholeTreeProjected[0].tasks, (task) => task.id),
        ['root-task', 'matching-child', 'sibling-task', 'sibling-child'],
        'date filtering must honor the full parent-tree switch in combination boards',
    );
    delete context.__tmDateFilter;
    context.state.filterRules[0].keepMatchedTaskSubtree = false;
    vm.runInContext('__tmBuildCustomBoardProjection()', context);
    context.state.__tmLoadedDocIdsForTasks = ['doc-a1'];
    assert.equal(vm.runInContext('__tmRememberCurrentCustomBoardProjectionCache()', context), true,
        'a completed combination-board projection must be retained for the active set');
    context.SettingsStore.data.customBoardSets.push({ id: 'set-other', name: 'Other', boards: [] });
    context.SettingsStore.data.activeCustomBoardSetId = 'set-other';
    assert.equal(vm.runInContext('__tmTryRestoreCachedCustomBoardProjection()', context), false,
        'another board set must not reuse a different set projection');
    context.SettingsStore.data.activeCustomBoardSetId = 'set-projection';
    assert.equal(vm.runInContext('__tmTryRestoreCachedCustomBoardProjection()', context), true,
        'returning to a previously loaded board set must restore its projection without a task reload');
    assert.deepEqual(Array.from(context.state.customBoardProjection[0].tasks, (task) => task.id), ['root-task', 'matching-child'],
        'the restored projection must preserve the set rule result');
    taskStoreGlobalRevision += 1;
    taskStoreDocRevisions.set('doc-b1', taskStoreGlobalRevision);
    context.state.viewMode = 'comboBoard';
    context.state.openToken = 1;
    context.render = () => {};
    let cachedReloadTaskLoads = 0;
    context.loadSelectedDocuments = async () => { cachedReloadTaskLoads += 1; };
    assert.equal(await vm.runInContext('__tmReloadCustomBoardTasks()', context), true);
    assert.equal(cachedReloadTaskLoads, 0,
        'switching to a fresh cached board set must render without invoking the document/task loader');
    taskStoreGlobalRevision += 1;
    taskStoreDocRevisions.set('doc-a1', taskStoreGlobalRevision);
    const changedCachedDocs = vm.runInContext(
        "Array.from(__tmGetChangedCachedCustomBoardDocIds(__tmCustomBoardProjectionCache.get('set-projection')))",
        context,
    );
    assert.deepEqual(Array.from(changedCachedDocs), ['doc-a1'],
        'only documents whose task versions changed should be selected for refresh');
    const incrementalRefreshCalls = [];
    context.__tmRefreshAffectedDocsIncrementally = async (options = {}) => {
        incrementalRefreshCalls.push(Array.from(options.docIds || []));
        return true;
    };
    assert.equal(vm.runInContext("__tmScheduleCustomBoardProjectionRefresh('set-projection')", context), true);
    await new Promise((resolve) => setTimeout(resolve, 260));
    assert.deepEqual(incrementalRefreshCalls, [['doc-a1']],
        'stale combination-board caches must reuse the existing incremental document refresh');
    assert.equal(cachedReloadTaskLoads, 0,
        'incremental document refresh must not fall back to a full task load');
    context.state.filterRules[0].conditions[0].value = 'changed-rule';
    assert.equal(vm.runInContext('__tmTryRestoreCachedCustomBoardProjection()', context), false,
        'rule edits must invalidate a cached board-set projection');

    const loaderScopes = loaderSource.slice(loaderSource.indexOf('let allDocIds = []'), loaderSource.indexOf('const editorOrderSnapshots'));
    assert.match(loaderScopes, /if \(customBoardMode\)[\s\S]*?await customBoardScopesPromise[\s\S]*?state\.__tmCustomBoardSourceDocIdsByBoard = resolvedScopes\.boardDocIds/,
        'custom-board loads must consume the concurrently resolved selected-set scope before querying');
    const projectionContext = projectionSource.slice(
        projectionSource.indexOf('function __tmBuildTaskProjectionContext('),
        projectionSource.indexOf('function __tmAnalyzeTaskProjectionPatch('),
    );
    assert.match(projectionContext, /customBoardRules\.flatMap\(\(rule\) => Array\.isArray\(rule\?\.conditions\)/,
        'incremental projection must track fields referenced by any sub-board rule');
    assert.match(projectionContext, /viewMode: isCustomBoardMode \? 'kanban'/,
        'custom-board task moves must invalidate document-scope membership');
    assert.match(runtimeSource, /async function __tmReloadCustomBoardTasks\(\)[\s\S]*?__tmTryRestoreCachedCustomBoardProjection\(\)[\s\S]*?state\.__tmCustomBoardLoading = true/,
        'combination-board switching must try the in-memory projection before entering the loading skeleton');
    assert.ok(loaderSource.indexOf('__tmRestoreGroupSessionTaskState') < loaderSource.indexOf("snapshotService?.load?.({"),
        'session memory caches must be attempted before reading the persistent snapshot store');
    assert.match(runtimeSource, /function __tmBuildCustomBoardDocumentFingerprints[\s\S]*?__tmBuildTaskProjectionDataSignature/,
        'combination-board cache invalidation must distinguish changed document content from repeated authoritative reads');
    assert.match(runtimeSource,
        /function __tmRememberCurrentCustomBoardProjectionCache[\s\S]*?sourceDocIds\.length === 0[\s\S]*?return false/,
        'a transient all-empty combination-board load must not cache an empty projection');
    assert.match(runtimeSource, /for \(let offset = 0; offset < refreshDocIds\.length; offset \+= 12\)/,
        'stale combination-board caches must refresh large change sets in bounded batches');
    assert.match(viewSwitchSource, /normalProjectionRestored = __tmTryRestoreCustomBoardReturnScope\(\)/,
        'leaving a combination board must reuse the captured normal-view document scope when valid');
    assert.match(kanbanRenderSource, /const kanbanRenderMode = isCustomBoard \? 'comboBoard' : 'kanban'[\s\S]*?__tmStartProgressiveViewRender\(kanbanRenderMode\)/,
        'combination boards must reuse the existing view-window scheduler for bounded first paint');
    assert.match(kanbanRenderSource, /const reusable = columnPatch\?\.reuseEnabled[\s\S]*?data-tm-kanban-reuse/,
        'combination-board partial refreshes must reuse unchanged live cards');
    assert.match(viewSwitchSource, /state\.viewMode = next;[\s\S]*?customBoardProjectionRestored = __tmTryRestoreCachedCustomBoardProjection\(\) === true;[\s\S]*?if \(!customBoardProjectionRestored\)\s*\{[\s\S]*?__tmBuildCustomBoardProjectionShell\(\)/,
        'combination-board projections must restore synchronously before the target view is rendered');
    assert.match(viewSwitchSource, /if \(next === __TM_CUSTOM_BOARD_VIEW_MODE && !customBoardProjectionRestored\)[\s\S]*?loadSelectedDocuments\(\{[\s\S]*?source: 'custom-board-view-switch'/,
        're-entering a cached combination board must not call the general document loader');
    assert.match(runtimeSource,
        /async function __tmReloadCustomBoardTasks\(\)[\s\S]*?loadSelectedDocuments\(\{[\s\S]*?source: 'custom-board-change'[\s\S]*?retryEmptyDocScope: true/,
        'first opening an uncached board set must retry a transient empty document scope');
    assert.match(viewSwitchSource,
        /if \(next === __TM_CUSTOM_BOARD_VIEW_MODE && !customBoardProjectionRestored\)[\s\S]*?loadSelectedDocuments\(\{[\s\S]*?source: 'custom-board-view-switch'[\s\S]*?retryEmptyDocScope: true/,
        'entering a combination board must recover from a transient empty document scope');
    assert.match(viewSwitchSource, /else if \(prev === __TM_CUSTOM_BOARD_VIEW_MODE && next !== __TM_CUSTOM_BOARD_VIEW_MODE && !normalProjectionRestored\)[\s\S]*?loadSelectedDocuments\(\{ source: 'custom-board-view-switch'/,
        'leaving combination boards must load documents only when the existing memory scope cannot restore the regular view');
    assert.doesNotMatch(runtimeSource, /CUSTOM_BOARD_PROJECTION_CACHE_TTL/,
        'combination-board caches must not expire on a timer while their documents are unchanged');
    assert.match(runtimeSource, /__tmGetChangedCachedCustomBoardDocIds[\s\S]*?__tmRefreshAffectedDocsIncrementally\(\{[\s\S]*?commitView: false[\s\S]*?refreshView: false/,
        'changed cached projections must reuse the existing incremental document refresh');
    assert.match(runtimeSource, /custom-board-cache-refresh[\s\S]*?skipRender: true[\s\S]*?showInlineLoading: false/,
        'the full-load fallback must remain silent for oversized or unsupported incremental changes');
    assert.match(runtimeSource, /addedDocIds[\s\S]*?__tmRefreshAffectedDocsIncrementally\(\{[\s\S]*?reason: 'custom-board-scope-refresh'/,
        'scope changes must incrementally load only newly added documents');
    assert.match(runtimeSource, /window\.tmSelectCustomBoardSetFromTopbar = async function[\s\S]*?const savePromise = SettingsStore\.save\(\)[\s\S]*?__tmReloadCustomBoardTasks\(\)[\s\S]*?await savePromise/,
        'the topbar selector must render cached content before waiting for settings persistence');
    assert.ok(manifest.scripts.includes('main/35-custom-board-runtime.js'),
        'the custom-board runtime must be included in the plugin manifest');

    console.log('custom board runtime contract tests passed');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
