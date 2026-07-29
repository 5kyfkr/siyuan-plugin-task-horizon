'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const rowModelRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js'), 'utf8');
const viewSwitchRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/47-render-side-panels-and-view-switching.js'), 'utf8');
const dialogRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/30-dialogs-and-ui-foundation.js'), 'utf8');
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
    `${docTabVisibility}; return __tmDocShouldShowInDocTabs;`
);
const doneDoc = { id: 'doc-a', tasks: [{ id: 'task-a', done: true, children: [] }] };
const automaticPolicy = buildVisibilityPolicy({ data: { currentGroupId: 'group-a', docTabsManualArchiveOnly: false } }, (task) => task.done === true, () => false);
assert.equal(automaticPolicy(doneDoc, { archiveMode: false }), false, 'completed documents should remain automatically archived by default');
assert.equal(automaticPolicy(doneDoc, { archiveMode: true }), true, 'completed documents should appear in the archive by default');
const manualPolicy = buildVisibilityPolicy({ data: { currentGroupId: 'group-a', docTabsManualArchiveOnly: true } }, (task) => task.done === true, () => false);
assert.equal(manualPolicy(doneDoc, { archiveMode: false }), true, 'manual archive control should keep completed document tabs active');
assert.equal(manualPolicy(doneDoc, { archiveMode: true }), false, 'manual archive control should not auto-add completed documents to the archive');
const manuallyArchivedPolicy = buildVisibilityPolicy({ data: { currentGroupId: 'group-a', docTabsManualArchiveOnly: true } }, (task) => task.done === true, () => true);
assert.equal(manuallyArchivedPolicy(doneDoc, { archiveMode: false }), false, 'explicitly archived completed documents should leave the active tabs');
assert.equal(manuallyArchivedPolicy(doneDoc, { archiveMode: true }), true, 'explicitly archived completed documents should remain recoverable from the archive');
assert.match(dialogRuntime, /canManuallyArchiveDocTab[\s\S]*docTabsManualArchiveOnly === true[\s\S]*docTabStateForMenu\.hasAny/, 'completed tabs must keep the manual archive menu action when automatic archiving is disabled');
assert.match(settingsRuntime, /手动控制归档[\s\S]*updateDocTabsManualArchiveOnly\(this\.checked\)/, 'settings must expose the archive policy through the native switch pattern');
assert.match(settingsRuntime, /__tmSettingsSearchCaptureBuffer\.push\([\s\S]*TM_SETTINGS_SEARCH_INDEX_TABS[\s\S]*renderSettingsModalMarkup\(\)/, 'manual archive control must be discoverable through the renderer-generated cross-tab search index');
assert.match(settingsRuntime, /__tmSettingsSearchAttrs\('appearance', '页签栏',[\s\S]*\{ section: 'tabs' \}\)[\s\S]*'手动控制归档',[\s\S]*\{ section: 'tabs' \}/, 'manual archive search results must target the page-tabs section and setting row');
assert.match(storeRuntime, /docTabsManualArchiveOnly: false[\s\S]*tm_doc_tabs_manual_archive_only[\s\S]*docTabsManualArchiveOnly = !!this\.data\.docTabsManualArchiveOnly/, 'manual archive control must have a backward-compatible default and normalized local persistence');
assert.match(storeRuntime, /docTabsManualArchiveOnly: data\.docTabsManualArchiveOnly \? 1 : 0/, 'snapshot view signatures must separate automatic and manual archive policies');
assert.match(dialogRuntime, /String\(archiveMode \? 1 : 0\),\s*String\(SettingsStore\?\.data\?\.docTabsManualArchiveOnly \? 1 : 0\)/, 'filter render signatures must change when the archive policy changes');
assert.match(rowModelRuntime, /window\.updateDocTabsManualArchiveOnly[\s\S]*__tmResolveDocTabSwitchTarget\(activeDocId\)[\s\S]*applyFilters\(\)/, 'changing archive policy must validate the active tab and refresh every aggregate scope');

const timelineHydration = segment(
    viewSwitchRuntime,
    'function __tmScheduleTimelineDateHydrationAfterViewSwitch(generation)',
    'function __tmMountCalendarViewRoot'
);
assert.match(timelineHydration, /__tmHydrateChecklistVisibleDateAttrs\(tasks, \{[\s\S]*force: true/, 'timeline switches must refresh date attributes even when the source view is not the checklist');
assert.match(timelineHydration, /__tmViewSwitchCommitGeneration[\s\S]*state\.viewMode[\s\S]*currentGroupId[\s\S]*state\.activeDocId/, 'late date hydration must not refresh a newer view or document context');
assert.match(timelineHydration, /if \(!meta\?\.changed\) return;[\s\S]*__tmScheduleRender\(\{[\s\S]*withFilters: true/, 'timeline switches should rerender only when hydration repairs stale task dates');
assert.match(viewSwitchRuntime, /__tmScheduleProgressiveViewRender\(next, progressiveJob\)[\s\S]*next === 'timeline'[\s\S]*__tmScheduleTimelineDateHydrationAfterViewSwitch\(generation\)/, 'timeline hydration must run after the initial non-blocking view switch commit');

console.log('document-tab completed filtering and timeline hydration contract tests passed');
