'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const stores = read('src', 'task-horizon', 'main', '10-stores-rules-and-cache.js');
const foundation = read('src', 'task-horizon', 'main', '30-dialogs-and-ui-foundation.js');
const refresh = read('src', 'task-horizon', 'main', 'render', '39-render-doc-group-sync-and-refresh.js');
const settings = read('src', 'task-horizon', 'main', 'settings', '60-settings-screen.js');
const actions = read('src', 'task-horizon', 'main', 'settings', '70-doc-group-and-settings-actions.js');
const hooks = read('src', 'task-horizon', 'main', 'shell', '72-shell-entrances-and-native-doc-hooks.js');
const lifecycle = read('src', 'task-horizon', 'main', 'shell', '80-shell-lifecycle.js');

const segment = (source, start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(from, -1, `missing segment start: ${start}`);
    assert.notEqual(to, -1, `missing segment end: ${end}`);
    return source.slice(from, to);
};

assert.match(stores, /dockSidebarFollowCurrentDocument:\s*false/, 'the follow mode must be opt-in');
assert.match(stores, /typeof cloudData\.dockSidebarFollowCurrentDocument === 'boolean'/, 'cloud settings must restore the follow mode');
assert.match(stores, /Storage\.get\('tm_dock_sidebar_follow_current_document'/, 'local settings must load the follow mode');
assert.match(stores, /Storage\.set\('tm_dock_sidebar_follow_current_document'/, 'local settings must persist the follow mode');

assert.match(settings, /Dock\u4fa7\u8fb9\u680f\u8ddf\u968f\u5f53\u524d\u6587\u6863/, 'the setting label must match the approved copy');
assert.match(settings, /dockSidebarFollowCurrentDocument[\s\S]*dockSidebarEnabled !== false \? '' : 'disabled'[\s\S]*updateDockSidebarFollowCurrentDocument/, 'the switch must follow Dock availability');
const settingAction = segment(actions, 'window.updateDockSidebarFollowCurrentDocument', 'window.updateTaskTitleClickAction');
assert.match(settingAction, /dockSidebarFollowCurrentDocument = !!enabled[\s\S]*SettingsStore\.save\(\)[\s\S]*showSettings\(\)/, 'the setting action must save and refresh the settings screen');
assert.doesNotMatch(settingAction, /__tmDispatchDockSettingsChanged/, 'the follow setting must not reload the Dock frame');

const resolverSource = segment(foundation, 'function __tmResolveDocTabSwitchTarget', 'window.tmSwitchDoc');
const resolverSandbox = {
    state: {
        otherBlocks: [],
        taskTree: [{ id: 'doc-in', allowed: true }, { id: 'doc-hidden', allowed: false }],
        docTabsArchiveMode: false,
    },
    SettingsStore: { data: { newTaskDocId: 'doc-special', currentGroupId: 'group-1' } },
    __tmIsOtherBlockTabId: () => false,
    __tmDocShouldShowInDocTabs: (doc) => doc?.allowed === true,
    __tmGetCurrentRule: () => null,
};
vm.runInNewContext(`${resolverSource}\nthis.resolveTarget = __tmResolveDocTabSwitchTarget;`, resolverSandbox);
assert.equal(resolverSandbox.resolveTarget('doc-in', { fallbackToAll: false }), 'doc-in');
assert.equal(resolverSandbox.resolveTarget('doc-special', { fallbackToAll: false }), 'doc-special');
assert.equal(resolverSandbox.resolveTarget('doc-hidden', { fallbackToAll: false }), '');
assert.equal(resolverSandbox.resolveTarget('doc-missing', { fallbackToAll: false }), '');
assert.equal(resolverSandbox.resolveTarget('doc-missing'), 'all', 'manual switching must keep its legacy fallback');

const switchDoc = segment(foundation, 'window.tmSwitchDoc = async function', 'window.tmSwitchDocTabCustomGroup');
assert.match(switchDoc, /__tmResolveDocTabSwitchTarget\(docId, options\)[\s\S]*if \(!resolvedDocId\) return false/, 'the switch action must stop on a rejected target');

const followRuntime = segment(hooks, 'const __TM_DOCK_SIDEBAR_FOLLOW_DELAY_MS', 'async function __tmAddOtherBlocksToSourceDocGroupFromMenu');
assert.match(followRuntime, /dockSidebarFollowCurrentDocument !== true/, 'the runtime must require the setting');
assert.match(followRuntime, /dockSidebarEnabled === false/, 'the runtime must stop when Dock is disabled');
assert.match(followRuntime, /isDesktopDockHost/, 'the runtime must require the desktop Dock host');
assert.match(followRuntime, /__tmIsTaskHorizonTabActiveNow\(\)/, 'the runtime must defer to an active plugin tab');
assert.match(followRuntime, /__tmIsPluginVisibleNow\(\)/, 'the runtime must require a visible Dock');
assert.match(followRuntime, /state\.modal instanceof Element && state\.modal\.contains\(protyle\)/, 'embedded plugin editors must be ignored');
assert.match(followRuntime, /activeWindow instanceof HTMLElement && !activeWindow\.contains\(protyle\)/, 'inactive editor panes must be ignored');
assert.match(followRuntime, /runtime\?\.block\?\.rootID/, 'the native document root ID must drive the follow target');
assert.match(followRuntime, /while \(__tmDockSidebarFollowPendingDocId\)/, 'rapid switches must use a latest-target queue');
assert.match(followRuntime, /tmSwitchDoc\?\.\(docId, \{ fallbackToAll: false \}\)/, 'Dock following must never fall back to all documents');
assert.match(followRuntime, /onEventBus\?\.\('switch-protyle'/, 'the runtime must bind the official document-switch event');
assert.match(followRuntime, /offEventBus\?\.\('switch-protyle'/, 'the runtime must release the document-switch event');
assert.doesNotMatch(followRuntime, /loaded-protyle-static|loaded-protyle-dynamic/, 'loaded events must not create extra follow triggers');
assert.doesNotMatch(followRuntime, /tmSwitchDocGroup/, 'following must not change document groups');

const policySource = segment(hooks, 'function __tmCanDockSidebarFollowCurrentDocument', 'function __tmResolveDockSidebarFollowDocId');
const policyState = { setting: true, enabled: true, dock: true, tab: false, visible: true };
const policySandbox = {
    SettingsStore: { data: {} },
    __tmRuntimeHost: { getInfo: () => ({ isDesktopDockHost: policyState.dock }) },
    __tmIsDesktopDockHost: () => policyState.dock,
    __tmIsTaskHorizonTabActiveNow: () => policyState.tab,
    __tmIsPluginVisibleNow: () => policyState.visible,
};
Object.defineProperties(policySandbox.SettingsStore.data, {
    dockSidebarFollowCurrentDocument: { get: () => policyState.setting },
    dockSidebarEnabled: { get: () => policyState.enabled },
});
vm.runInNewContext(`${policySource}\nthis.canFollow = __tmCanDockSidebarFollowCurrentDocument;`, policySandbox);
assert.equal(policySandbox.canFollow(), true);
policyState.setting = false;
assert.equal(policySandbox.canFollow(), false);
policyState.setting = true;
policyState.dock = false;
assert.equal(policySandbox.canFollow(), false);
policyState.dock = true;
policyState.tab = true;
assert.equal(policySandbox.canFollow(), false);
policyState.tab = false;
policyState.visible = false;
assert.equal(policySandbox.canFollow(), false);

assert.match(lifecycle, /__tmBindTabEnterAutoRefresh\(\)[\s\S]*__tmBindDockSidebarCurrentDocumentFollow\(\)[\s\S]*if \(bindShellEntrances\)/, 'the listener must bind even when Dock is the initial host');
assert.match(lifecycle, /__tmDestroyDockSidebarCurrentDocumentFollow\(\)/, 'cleanup must destroy the follow runtime');
assert.match(refresh, /candidate\?\.headElement instanceof HTMLElement/, 'active-tab detection must support SiYuan tab models');

console.log('Dock sidebar current document follow contract tests passed');
