'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const renderRuntime = read('src/task-horizon/main/40-render-runtime.js');
const viewSwitchRuntime = read('src/task-horizon/main/render/47-render-side-panels-and-view-switching.js');
const dialogRuntime = read('src/task-horizon/main/30-dialogs-and-ui-foundation.js');
const loaderRuntime = read('src/task-horizon/main/task-runtime/53c-document-loader-runtime.js');
const settingsRuntime = read('src/task-horizon/main/settings/62-settings-columns-and-rules.js');

const segment = (source, start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(from, -1, `missing segment start: ${start}`);
    assert.notEqual(to, -1, `missing segment end: ${end}`);
    return source.slice(from, to);
};

const fullRenderTransfer = segment(viewSwitchRuntime, 'function __tmPrepareCalendarSideDockFullRenderTransfer', 'function __tmSyncPersistentSideDocksAfterViewSwitch');
const renderBody = segment(renderRuntime, 'function render()', '\n    function __tmGetKanbanBodyForDomSync');
const switchGroup = segment(dialogRuntime, 'window.tmSwitchDocGroup = async function', 'window.tmDocTabDragOver');
const groupVerify = segment(dialogRuntime, 'function __tmScheduleDocGroupSwitchVerifyAfterFirstPaint', 'async function __tmRefreshVisibleViewAfterTaskSnapshotSync');
const loadSelected = loaderRuntime.slice(loaderRuntime.indexOf('async function loadSelectedDocuments'));
assert.notEqual(loadSelected.length, loaderRuntime.length, 'missing loadSelectedDocuments function');
const legacySwitch = segment(settingsRuntime, 'window.switchDocGroup = async function', 'async function __tmCreateGroupAndSelect');

assert.match(fullRenderTransfer, /__tmPreserveCalendarSideDockDuringRender[\s\S]*?currentNode\.remove\(\)/, 'full render preservation must detach the live calendar dock before the old shell is removed');
assert.match(fullRenderTransfer, /placeholderNode = placeholders\[0\][\s\S]*?__tmCommitPersistentSideDockTransfers\(\[transfer\]\)/, 'the detached calendar dock must replace the new shell placeholder');
assert.match(fullRenderTransfer, /function __tmRenderPreservingCalendarSideDock\(\)[\s\S]*?try \{[\s\S]*?render\(\)[\s\S]*?finally/, 'calendar preservation must be scoped to one synchronous full render');
assert.doesNotMatch(fullRenderTransfer, /__tmRequestCalendarRefresh|refreshSideDay|refetchEvents|unmountSideDayTimeline/, 'calendar dock transfer must not reload or unmount calendar events');

assert.match(renderBody, /__tmPrepareCalendarSideDockFullRenderTransfer\(prevModalSnapshot\)[\s\S]*?prevModalSnapshot\.remove\(\)/, 'render must preserve the dock before removing the previous shell');
assert.match(renderBody, /state\.modal\.innerHTML =[\s\S]*?__tmCommitCalendarSideDockFullRenderTransfer\([\s\S]*?finalMountRoot\.appendChild\(state\.modal\)/, 'render must restore the live dock into the new shell before mounting it');
assert.match(renderBody, /if \(reusedCalendarSideDock\) \{[\s\S]*?__tmSyncPersistentSideDocksAfterViewSwitch[\s\S]*?\} else \{[\s\S]*?__tmCalendarDockMount\(\)/, 'a reused dock must skip normal calendar mounting and only rebind its existing timeline root');

assert.match(switchGroup, /__tmRenderPreservingCalendarSideDock\(\)[\s\S]*?snapshotRendered = true/, 'snapshot-backed group switching must preserve the existing calendar dock');
assert.match(groupVerify, /__tmRerenderCurrentViewInPlace\(modal\)\) __tmRenderPreservingCalendarSideDock\(\)/, 'deferred group freshness fallback must also preserve the calendar dock');
assert.match(loaderRuntime, /const isSwitchDocGroupLoad =[\s\S]*?'legacy-switch-doc-group'[\s\S]*?const renderLoadedState = \(\) => \{[\s\S]*?__tmRenderPreservingCalendarSideDock\(\)/, 'all current and legacy group loader sources must use the preserving render wrapper');
assert.equal((loadSelected.match(/\brender\(\)/g) || []).length, 1, 'document loading must not bypass the source-aware render wrapper');
assert.match(legacySwitch, /source: 'legacy-switch-doc-group'[\s\S]*?await savePromise;[\s\S]*?__tmRenderPreservingCalendarSideDock\(\)/, 'legacy group switching must preserve the calendar dock on its final render');

console.log('doc group calendar sidebar refresh isolation contract tests passed');
