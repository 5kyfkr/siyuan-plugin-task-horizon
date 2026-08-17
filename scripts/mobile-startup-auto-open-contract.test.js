'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
const store = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'),
    'utf8',
);
const settings = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/settings/60-settings-screen.js'),
    'utf8',
);
const actions = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/settings/70-doc-group-and-settings-actions.js'),
    'utf8',
);

assert.match(index, /MOBILE_AUTO_OPEN_ON_STARTUP_STORAGE_KEY = "tm_mobile_auto_open_on_startup"/, 'startup must read the same local key as SettingsStore');

const nativeCheckStart = index.indexOf('const isSupportedNativeMobileAppClient');
const nativeCheckEnd = index.indexOf('\n};', nativeCheckStart) + 3;
assert.notEqual(nativeCheckStart, -1, 'native mobile App detection must exist');
const nativeCheck = index.slice(nativeCheckStart, nativeCheckEnd);
assert.match(nativeCheck, /container === "android"[\s\S]*JSAndroid/, 'Android must require the native container and bridge');
assert.match(nativeCheck, /container === "ios"[\s\S]*webkit\?\.messageHandlers/, 'iOS must require the native container and bridge');
assert.match(nativeCheck, /container === "harmony"[\s\S]*JSHarmony/, 'HarmonyOS must require the native container and bridge');
assert.doesNotMatch(nativeCheck, /userAgent|innerWidth|matchMedia/, 'native App detection must not rely on browser heuristics');

assert.match(index, /_taskMobileStartupColdLoad = this\._taskMobileStartupAutoOpenEnabled[\s\S]*siyuan\?\.isReady !== true/, 'hot plugin loads after SiYuan readiness must not auto-open');
assert.match(index, /globalThis\?\.siyuan\?\.isReady === true && typeof opener === "function"/, 'startup opening must wait for SiYuan and the manager runtime');
assert.match(index, /__taskHorizonOpenManagerFromTopbarEntry/, 'startup must use the mobile-compatible manager opener');
assert.match(index, /sessionStorage\?\.setItem\?\.\(sessionKey, "1"\)/, 'startup must be guarded once per workspace session');
assert.match(index, /MOBILE_STARTUP_READY_TIMEOUT_MS/, 'readiness waiting must be bounded');
assert.match(index, /onLayoutReady\(\)[\s\S]*scheduleMobileStartupAutoOpen\(\)/, 'auto-open must begin from the layout-ready lifecycle');

const syncStart = index.indexOf('    registerStartupSyncReloadListener()');
const syncEnd = index.indexOf('\n    unregisterStartupSyncReloadListener()', syncStart);
assert.notEqual(syncStart, -1, 'the startup sync listener must exist');
const syncListener = index.slice(syncStart, syncEnd);
assert.match(syncListener, /eventBus\.on\("ws-main"/, 'the listener must use SiYuan plugin events');
assert.match(syncListener, /syncMergeResult/, 'document refresh must wait for the authoritative merge notification');
assert.match(syncListener, /requestSyncedDataReload\("sync-merge-result"/, 'merge refresh must share the data-change reload coordinator');
assert.doesNotMatch(syncListener, /sync-start|sync-end|sync-fail|performSync/, 'startup must not maintain a redundant sync state machine or start another sync');
assert.match(index, /eventBus\?\.off\?\.\("ws-main"/, 'the sync listener must be removed on unload');
assert.match(index, /cancelMobileStartupAutoOpen\(\)/, 'startup polling must be cancelled on unload');

assert.match(store, /mobileAutoOpenOnStartup: false/, 'the setting must default to off');
assert.match(store, /cloudData\.mobileAutoOpenOnStartup === 'boolean'/, 'the setting must accept synchronized boolean values');
assert.match(store, /Storage\.get\('tm_mobile_auto_open_on_startup'/, 'the setting must load from local storage');
assert.match(store, /Storage\.set\('tm_mobile_auto_open_on_startup'/, 'the setting must persist to local storage');
assert.match(store, /mobileAutoOpenOnStartup = this\.data\.mobileAutoOpenOnStartup === true/, 'the setting must normalize to a strict boolean');

assert.match(settings, /移动端启动时自动打开任务管理器/, 'the layout settings section must render the switch');
assert.match(settings, /Android、iOS 和 HarmonyOS 思源 App 冷启动后生效/, 'the setting copy must state the exact supported App scope');
assert.match(settings, /updateMobileAutoOpenOnStartup\(this\.checked\)/, 'the switch must call its settings action');
assert.match(actions, /window\.updateMobileAutoOpenOnStartup = async function\(enabled\)/, 'the switch action must exist');
assert.match(actions, /SettingsStore\.data\.mobileAutoOpenOnStartup = enabled === true/, 'the switch action must store a strict boolean');

console.log('mobile startup auto-open contract tests passed');
