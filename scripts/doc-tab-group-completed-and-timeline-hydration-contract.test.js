'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const rowModelRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js'), 'utf8');
const viewSwitchRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/47-render-side-panels-and-view-switching.js'), 'utf8');
const dialogRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/30-dialogs-and-ui-foundation.js'), 'utf8');
const loaderRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53c-document-loader-runtime.js'), 'utf8');
const storeRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const settingsRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/60-settings-screen.js'), 'utf8');

const segment = (source, start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(from, -1, `missing segment start: ${start}`);
    assert.notEqual(to, -1, `missing segment end: ${end}`);
    return source.slice(from, to);
};

const archivedDocs = segment(
    rowModelRuntime,
    'function __tmGetArchivedDocIdsForAllTabCompletedTailGroup()',
    'function __tmShouldSeparateCompletedRootGroup()'
);
assert.match(archivedDocs, /activeDocId === 'all'[\s\S]*__tmIsDocTabCustomGroupActiveId\(activeDocId\)/, 'completed tail groups must treat custom document-tab groups as aggregate all-tab contexts');
assert.match(archivedDocs, /__tmDocShouldShowInDocTabs\(doc, \{[\s\S]*archiveMode: true,[\s\S]*groupId: currentGroupId/, 'completed tail groups must exclude documents considered archived by the current policy');

const docTabVisibility = segment(
    dialogRuntime,
    'function __tmGetDocTaskStateForTabs(doc, cache = null)',
    'function __tmGetArchiveModeFilterRule'
);
const buildVisibilityPolicy = new Function(
    'SettingsStore',
    '__tmIsTaskDoneEffective',
    '__tmIsDocManuallyArchivedInGroup',
    '__tmIsDocManuallyUnarchivedInGroup',
    `${docTabVisibility}; return __tmDocShouldShowInDocTabs;`
);
const doneDoc = { id: 'doc-a', tasks: [{ id: 'task-a', done: true, children: [] }] };
const automaticPolicy = buildVisibilityPolicy({ data: { currentGroupId: 'group-a', docTabsManualArchiveOnly: false } }, (task) => task.done === true, () => false, () => false);
assert.equal(automaticPolicy(doneDoc, { archiveMode: false }), false, 'completed documents should remain automatically archived by default');
assert.equal(automaticPolicy(doneDoc, { archiveMode: true }), true, 'completed documents should appear in the archive by default');
const manualPolicy = buildVisibilityPolicy({ data: { currentGroupId: 'group-a', docTabsManualArchiveOnly: true } }, (task) => task.done === true, () => false, () => false);
assert.equal(manualPolicy(doneDoc, { archiveMode: false }), true, 'manual archive control should keep completed document tabs active');
assert.equal(manualPolicy(doneDoc, { archiveMode: true }), false, 'manual archive control should not auto-add completed documents to the archive');
const manuallyArchivedPolicy = buildVisibilityPolicy({ data: { currentGroupId: 'group-a', docTabsManualArchiveOnly: true } }, (task) => task.done === true, () => true, () => false);
assert.equal(manuallyArchivedPolicy(doneDoc, { archiveMode: false }), false, 'explicitly archived completed documents should leave the active tabs');
assert.equal(manuallyArchivedPolicy(doneDoc, { archiveMode: true }), true, 'explicitly archived completed documents should remain recoverable from the archive');
const manuallyUnarchivedPolicy = buildVisibilityPolicy({ data: { currentGroupId: 'group-a', docTabsManualArchiveOnly: false } }, (task) => task.done === true, () => false, () => true);
assert.equal(manuallyUnarchivedPolicy(doneDoc, { archiveMode: false }), true, 'manually unarchived completed documents should return to active tabs');
assert.equal(manuallyUnarchivedPolicy(doneDoc, { archiveMode: true }), false, 'manually unarchived completed documents should leave the archive tabs');
assert.match(dialogRuntime, /canManuallyArchiveDocTab[\s\S]*docTabsManualArchiveOnly === true[\s\S]*docTabStateForMenu\.hasAny/, 'completed tabs must keep the manual archive menu action when automatic archiving is disabled');
assert.match(dialogRuntime, /移出归档页签[\s\S]*__tmSetDocManualUnarchivedForGroup/, 'archive-tab context menus must expose a manual unarchive action for automatically archived documents');
const unarchiveMenuIndex = dialogRuntime.indexOf("__tmRenderContextMenuLabel('tray-arrow-up', '移出归档页签')");
const archiveMenuIndex = dialogRuntime.indexOf("__tmRenderContextMenuLabel('archive', '归档页签')");
const hideTabMenuIndex = dialogRuntime.indexOf("__tmRenderContextMenuLabel('eye-off', excludeDocMenuLabel)");
assert.notEqual(unarchiveMenuIndex, -1, 'manual unarchive must use the Phosphor tray-arrow-up icon');
assert.notEqual(archiveMenuIndex, -1, 'active document tabs must retain the manual archive action');
assert.ok(archiveMenuIndex < hideTabMenuIndex, 'manual archive must render directly before hide document tab');
assert.ok(unarchiveMenuIndex < hideTabMenuIndex, 'manual unarchive must render directly before hide document tab');
assert.match(dialogRuntime, /__tmPhosphorBoldPaths\['tray-arrow-up'\]\s*=/, 'the tray-arrow-up bold asset path must be registered');
assert.match(settingsRuntime, /手动控制归档[\s\S]*updateDocTabsManualArchiveOnly\(this\.checked\)/, 'settings must expose the archive policy through the native switch pattern');
assert.match(settingsRuntime, /__tmSettingsSearchCaptureBuffer\.push\([\s\S]*TM_SETTINGS_SEARCH_INDEX_TABS[\s\S]*renderSettingsModalMarkup\(\)/, 'manual archive control must be discoverable through the renderer-generated cross-tab search index');
assert.match(settingsRuntime, /__tmSettingsSearchAttrs\('appearance', '页签栏',[\s\S]*\{ section: 'tabs' \}\)[\s\S]*'手动控制归档',[\s\S]*\{ section: 'tabs' \}/, 'manual archive search results must target the page-tabs section and setting row');
assert.match(storeRuntime, /docTabsManualArchiveOnly: false[\s\S]*tm_doc_tabs_manual_archive_only[\s\S]*docTabsManualArchiveOnly = !!this\.data\.docTabsManualArchiveOnly/, 'manual archive control must have a backward-compatible default and normalized local persistence');
assert.match(storeRuntime, /docTabsManualUnarchivedByGroup[\s\S]*tm_doc_tabs_manual_unarchived_by_group/, 'manual unarchive overrides must be persisted');
assert.match(storeRuntime, /docTabsManualArchiveOnly: data\.docTabsManualArchiveOnly \? 1 : 0/, 'snapshot view signatures must separate automatic and manual archive policies');
assert.match(dialogRuntime, /String\(archiveMode \? 1 : 0\),\s*String\(SettingsStore\?\.data\?\.docTabsManualArchiveOnly \? 1 : 0\)/, 'filter render signatures must change when the archive policy changes');
assert.match(rowModelRuntime, /window\.updateDocTabsManualArchiveOnly[\s\S]*__tmResolveDocTabSwitchTarget\(activeDocId\)[\s\S]*applyFilters\(\)/, 'changing archive policy must validate the active tab and refresh every aggregate scope');

const customGroupRegionPolicySource = segment(
    dialogRuntime,
    'function __tmShouldShowDocTabCustomGroupInRegion(group, regionState, archiveMode)',
    'function __tmBuildDocTabGroupedView(visibleDocs, options = {})'
);
const customGroupRegionPolicy = new Function(`${customGroupRegionPolicySource}; return __tmShouldShowDocTabCustomGroupInRegion;`)();
assert.equal(customGroupRegionPolicy({ showInTabBar: true }, { hasActive: true, hasArchived: false }, false), true, 'active-only tab groups must remain in the active region');
assert.equal(customGroupRegionPolicy({ showInTabBar: true }, { hasActive: true, hasArchived: false }, true), false, 'active-only tab groups must stay out of the archive region');
assert.equal(customGroupRegionPolicy({ showInTabBar: true }, { hasActive: false, hasArchived: true }, false), false, 'fully archived tab groups must leave the active region');
assert.equal(customGroupRegionPolicy({ showInTabBar: true }, { hasActive: false, hasArchived: true }, true), true, 'fully archived tab groups must appear in the archive region');
assert.equal(customGroupRegionPolicy({ showInTabBar: true }, { hasActive: true, hasArchived: true }, false), true, 'mixed tab groups must remain available in the active region');
assert.equal(customGroupRegionPolicy({ showInTabBar: true }, { hasActive: true, hasArchived: true }, true), true, 'mixed tab groups must remain available in the archive region');
assert.equal(customGroupRegionPolicy({ showInTabBar: true }, { hasActive: false, hasArchived: false }, false), true, 'empty configured tab groups must remain editable from the active region');
assert.equal(customGroupRegionPolicy({ showInTabBar: true }, { hasActive: false, hasArchived: false }, true), false, 'empty tab groups must not appear archived');
assert.match(dialogRuntime, /__tmGetDocTabCustomGroupRegionState\(group,[\s\S]*__tmShouldShowDocTabCustomGroupInRegion\(group, regionState, archiveMode\)/, 'tab group rendering must use member archive state instead of showInTabBar alone');
assert.match(dialogRuntime, /activeGroupRegionState[\s\S]*__tmShouldShowDocTabCustomGroupInRegion\(activeGroup, activeGroupRegionState, archiveMode\)[\s\S]*state\.activeDocId = 'all'/, 'an aggregate tab group that moves regions must release the hidden active context');

const activeCustomGroupValidationSource = segment(
    dialogRuntime,
    "const activeDocIdBeforeFilter = String(state.activeDocId || 'all').trim() || 'all';",
    'const isOtherBlocksActive = __tmIsOtherBlockTabId(state.activeDocId) && hasOtherBlocks;'
);
const validateActiveCustomGroup = new Function(
    'state',
    'SettingsStore',
    'archiveMode',
    'currentGroupId',
    'docTaskStateCache',
    '__tmParseDocTabCustomGroupActiveId',
    '__tmSortDocEntriesForTabs',
    '__tmGetDocTabCustomGroupDocIdSet',
    '__tmFindDocTabCustomGroupById',
    '__tmGetDocTabCustomGroupRegionState',
    '__tmShouldShowDocTabCustomGroupInRegion',
    `${activeCustomGroupValidationSource}; return state.activeDocId;`
);
const runActiveCustomGroupValidation = ({ archiveMode, completedTasksInlineInGroups, groupExists = true, regionVisible = true }) => {
    const activeId = '__tm_doc_tab_group__:group-a';
    const state = { activeDocId: activeId, taskTree: [{ id: 'doc-a', tasks: [] }] };
    const docTaskStateCache = new Map();
    let receivedCache = null;
    const result = validateActiveCustomGroup(
        state,
        { data: { currentGroupId: 'scope-a', completedTasksInlineInGroups } },
        archiveMode,
        'scope-a',
        docTaskStateCache,
        () => 'group-a',
        (docs) => docs,
        () => new Set(['doc-a']),
        () => groupExists ? { id: 'group-a' } : null,
        (_group, options) => { receivedCache = options.docStateCache; return { hasActive: true, hasArchived: true }; },
        () => regionVisible
    );
    return { result, receivedCache, docTaskStateCache };
};
for (const archiveMode of [false, true]) {
    for (const completedTasksInlineInGroups of [false, true]) {
        const validation = runActiveCustomGroupValidation({ archiveMode, completedTasksInlineInGroups });
        assert.equal(validation.result, '__tm_doc_tab_group__:group-a', 'valid aggregate tab groups must survive active/archive filtering in either completed-grouping mode');
        assert.equal(validation.receivedCache, validation.docTaskStateCache, 'aggregate region validation must receive the declared document task-state cache');
    }
}
assert.equal(runActiveCustomGroupValidation({ archiveMode: false, completedTasksInlineInGroups: false, groupExists: false }).result, 'all', 'deleted aggregate tab groups must fall back to all');
assert.equal(runActiveCustomGroupValidation({ archiveMode: true, completedTasksInlineInGroups: true, regionVisible: false }).result, 'all', 'aggregate tab groups hidden from the current archive region must fall back to all');

const customGroupClickSource = segment(
    dialogRuntime,
    'window.tmHandleDocTabCustomGroupClick = async function(event, groupId)',
    'window.tmSaveCurrentViewProfileToGroup = async function(groupId)'
);
const buildCustomGroupClickHandler = new Function(
    'window',
    'state',
    '__tmParseDocTabCustomGroupActiveId',
    '__tmIsDocTabCustomGroupMenuOpen',
    '__tmHideDocTabMenu',
    `${customGroupClickSource}; return window.tmHandleDocTabCustomGroupClick;`
);
const runCustomGroupClick = async ({ activeDocId, menuOpen = false }) => {
    const calls = { hide: 0, switches: [] };
    const window = {
        tmSwitchDocTabCustomGroup: async (groupId) => { calls.switches.push(groupId); }
    };
    const handler = buildCustomGroupClickHandler(
        window,
        { activeDocId },
        (value) => String(value || '').startsWith('__tm_doc_tab_group__:') ? String(value).slice('__tm_doc_tab_group__:'.length) : '',
        () => menuOpen,
        () => { calls.hide += 1; }
    );
    await handler({ preventDefault() {}, stopPropagation() {}, clientX: 10, clientY: 20 }, 'group-a');
    return calls;
};

const customGroupClickAssertions = Promise.all([
    runCustomGroupClick({ activeDocId: 'doc-in-group' }),
    runCustomGroupClick({ activeDocId: 'doc-outside-group' }),
    runCustomGroupClick({ activeDocId: '__tm_doc_tab_group__:group-a' }),
    runCustomGroupClick({ activeDocId: 'doc-in-group', menuOpen: true }),
    runCustomGroupClick({ activeDocId: '__tm_doc_tab_group__:group-a', menuOpen: true })
]).then(([member, outside, aggregate, memberWithMenu, aggregateWithMenu]) => {
    assert.deepEqual(member.switches, ['group-a'], 'clicking a highlighted member group must enter the aggregate tab');
    assert.deepEqual(outside.switches, ['group-a'], 'clicking a group from an outside document must enter the aggregate tab');
    assert.deepEqual(aggregate.switches, [], 'an already active aggregate tab must not reload itself');
    assert.equal(memberWithMenu.hide, 1, 'clicking a group body must close its open menu first');
    assert.deepEqual(memberWithMenu.switches, ['group-a'], 'closing an open menu must not block aggregate navigation from a member document');
    assert.equal(aggregateWithMenu.hide, 1, 'clicking an active aggregate with an open menu must close it');
    assert.deepEqual(aggregateWithMenu.switches, [], 'closing the active aggregate menu must not reload the aggregate');
});

assert.doesNotMatch(customGroupClickSource, /classList\.contains\('active'\)/, 'group-body navigation must not infer aggregate state from shared active styling');
assert.match(loaderRuntime, /activeDocId !== 'all'[\s\S]*!__tmIsOtherBlockTabId\(activeDocId\)[\s\S]*!__tmIsDocTabCustomGroupActiveId\(activeDocId\)[\s\S]*validDocIds/, 'document reload validation must preserve aggregate tab-group IDs');

const timelineHydration = segment(
    viewSwitchRuntime,
    'function __tmScheduleTimelineDateHydrationAfterViewSwitch(generation)',
    'function __tmMountCalendarViewRoot'
);
assert.match(timelineHydration, /__tmHydrateChecklistVisibleDateAttrs\(tasks, \{[\s\S]*force: true/, 'timeline switches must refresh date attributes even when the source view is not the checklist');
assert.match(timelineHydration, /__tmViewSwitchCommitGeneration[\s\S]*state\.viewMode[\s\S]*currentGroupId[\s\S]*state\.activeDocId/, 'late date hydration must not refresh a newer view or document context');
assert.match(timelineHydration, /if \(!meta\?\.changed\) return;[\s\S]*__tmScheduleRender\(\{[\s\S]*withFilters: true/, 'timeline switches should rerender only when hydration repairs stale task dates');
assert.match(viewSwitchRuntime, /__tmScheduleProgressiveViewRender\(next, progressiveJob\)[\s\S]*next === 'timeline'[\s\S]*__tmScheduleTimelineDateHydrationAfterViewSwitch\(generation\)/, 'timeline hydration must run after the initial non-blocking view switch commit');

customGroupClickAssertions
    .then(() => console.log('document-tab completed filtering and timeline hydration contract tests passed'))
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
