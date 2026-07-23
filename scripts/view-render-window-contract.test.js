'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const runtime = read('src/task-horizon/main/21-view-render-state.js');
const manifest = JSON.parse(read('src/task-horizon/manifest.main.json'));
const stores = read('src/task-horizon/main/10-stores-rules-and-cache.js');
const services = read('src/task-horizon/main/20-api-and-runtime-services.js');
const dialogs = read('src/task-horizon/main/30-dialogs-and-ui-foundation.js');
const refresh = read('src/task-horizon/main/render/39-render-doc-group-sync-and-refresh.js');
const viewSwitch = read('src/task-horizon/main/render/47-render-side-panels-and-view-switching.js');
const listRuntime = read('src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js');

const segment = (source, start, end) => {
    const from = source.indexOf(start);
    assert.notEqual(from, -1, `missing segment start: ${start}`);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(to, -1, `missing segment end: ${end}`);
    return source.slice(from, to);
};

const context = {
    state: { viewMode: 'list', filteredTasks: Array.from({ length: 400 }, (_, index) => ({ id: `task-${index}` })) },
    __tmIsMobileDevice: () => false,
    __tmIsRuntimeMobileClient: () => false,
    __tmHostUsesMobileUI: () => false,
};
vm.createContext(context);
vm.runInContext(runtime, context, { filename: '21-view-render-state.js' });

let windowState = context.__tmResetViewRenderWindow('list', 400);
assert.equal(windowState.limit, 80, 'desktop table view must start with 80 tasks');
assert.equal(context.state.listRenderStep, 80);
windowState = context.__tmGrowViewRenderWindow('list', 400);
assert.equal(windowState.previousLimit, 80);
assert.equal(windowState.limit, 120, 'desktop table auto-load must add 40 tasks');

windowState = context.__tmResetViewRenderWindow('checklist', 400);
assert.equal(windowState.limit, 120, 'desktop checklist must start with 120 tasks');
windowState = context.__tmGrowViewRenderWindow('checklist', 400);
assert.equal(windowState.limit, 180, 'desktop checklist auto-load must add 60 tasks');

context.__tmIsMobileDevice = () => true;
windowState = context.__tmResetViewRenderWindow('list', 400);
assert.equal(windowState.limit, 64, 'mobile table view must use the smaller initial window');
windowState = context.__tmGrowViewRenderWindow('list', 400);
assert.equal(windowState.limit, 96, 'mobile table auto-load must add 32 tasks');

const serviceIndex = manifest.scripts.indexOf('main/20-api-and-runtime-services.js');
const renderStateIndex = manifest.scripts.indexOf('main/21-view-render-state.js');
const dialogsIndex = manifest.scripts.indexOf('main/30-dialogs-and-ui-foundation.js');
assert.ok(serviceIndex >= 0 && serviceIndex < renderStateIndex && renderStateIndex < dialogsIndex, 'render state must load after state creation and before UI consumers');

const snapshotViewState = segment(stores, 'function __tmBuildTaskSnapshotViewState', 'function __tmGetTaskSnapshotViewStateCandidates');
assert.doesNotMatch(snapshotViewState, /listRender(?:Limit|Step)/, 'task snapshots must not persist transient render windows');
const snapshotRestore = segment(stores, 'function __tmRestoreTaskSnapshotViewState', 'function __tmBuildTaskSnapshotPayload');
assert.match(snapshotRestore, /__tmResetViewRenderWindow\(state\.viewMode, filtered\.length\)/, 'snapshot restore must start from a fresh render window');

const hostCapture = segment(services, 'function __tmCaptureHostSessionState', 'function __tmRestoreHostSessionState');
const hostRestore = segment(services, 'function __tmRestoreHostSessionState', 'function __tmIsMultiSelectSupportedView');
assert.doesNotMatch(hostCapture, /listRender(?:Limit|Step)/, 'host sessions must not capture transient render windows');
assert.doesNotMatch(hostRestore, /snap\.listRender(?:Limit|Step)/, 'host sessions must not restore stale render windows');

const refreshCapture = segment(refresh, 'function __tmCaptureRefreshUiState', 'function __tmRestoreRefreshUiState');
const refreshRestore = segment(refresh, 'function __tmRestoreRefreshUiState', 'const __TM_MANUAL_REFRESH_WRITE_PROTECT_FIELDS');
assert.doesNotMatch(refreshCapture, /listRender(?:Limit|Step)/, 'manual refresh snapshots must not capture render windows');
assert.doesNotMatch(refreshRestore, /saved\.listRender(?:Limit|Step)/, 'manual refresh must not restore render windows');

assert.match(viewSwitch, /state\.viewMode = next;\s*try \{ __tmResetViewRenderWindow\(next\); \} catch \(e\) \{\}/, 'view entry must reset its initial render window');
assert.match(dialogs, /const grown = __tmGrowViewRenderWindow\(mode, meta\.total\);[\s\S]*?appendOnly: true,[\s\S]*?previousLimit: grown\.previousLimit/, 'scroll auto-load must grow the window and request an incremental table patch');
assert.match(services, /function __tmReconcileListRowsForAppend[\s\S]*?currentOrder\.some[\s\S]*?commonDesiredOrder[\s\S]*?tbody\.insertBefore/, 'incremental table patches must validate stable row order before mutating DOM');
assert.match(listRuntime, /__tmGrowViewRenderWindow\('list', state\.filteredTasks\.length\)[\s\S]*?appendOnly: true/, 'manual load-more must reuse the incremental path');

console.log('view render window contract tests passed');
