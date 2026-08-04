'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
const refreshRuntime = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/render/39-render-doc-group-sync-and-refresh.js'),
    'utf8',
);
const legacyAi = fs.readFileSync(path.join(root, 'ai.js'), 'utf8');
const agentWorkbench = fs.readFileSync(path.join(root, 'src/ai/agent-workbench.js'), 'utf8');

const handlerStart = index.indexOf('async onDataChanged()');
const handlerEnd = index.indexOf('\n    onLayoutReady()', handlerStart);
assert.notEqual(handlerStart, -1, 'the plugin must override SiYuan onDataChanged');
assert.notEqual(handlerEnd, -1, 'the onDataChanged handler must remain independently inspectable');
const handler = index.slice(handlerStart, handlerEnd);

assert.doesNotMatch(handler, /super\.onDataChanged|this\.onunload|removeWindowTopBar/, 'storage sync must not unload the plugin or remove its topbar');
assert.match(handler, /_taskDataChangedPromise/, 'concurrent data-change notifications must share one reload');
assert.match(handler, /_taskDataChangedQueued/, 'a notification received during reload must be replayed once');
assert.match(handler, /ensureTaskMainLoaded\(\)/, 'data reload must recover the main runtime when necessary');
assert.match(handler, /__taskHorizonReloadSyncedData/, 'the plugin must delegate synchronized state hydration to the main runtime');
assert.match(handler, /syncWindowTopBar\(\)/, 'the task topbar must be reconciled after data reload');
assert.match(handler, /syncCalendarSubscriptionTopBar\(\)/, 'the calendar topbar must be reconciled after data reload');

const reloadStart = refreshRuntime.indexOf('async function __tmReloadSyncedPluginData');
const reloadEnd = refreshRuntime.indexOf('\n    async function __tmRefreshCore', reloadStart);
assert.notEqual(reloadStart, -1, 'the main runtime must expose an in-place synchronized data reload');
assert.notEqual(reloadEnd, -1, 'the synchronized data reload must remain independently inspectable');
const reload = refreshRuntime.slice(reloadStart, reloadEnd);

assert.match(reload, /SettingsStore\.loaded = false/, 'settings must be force reloaded');
assert.match(reload, /MetaStore\.loaded = false/, 'task metadata must be force reloaded');
assert.match(reload, /WhiteboardStore\.loaded = false/, 'whiteboard data must be force reloaded');
assert.match(reload, /SemanticDateRecognizedStore\.loaded = false/, 'semantic date data must be force reloaded');
assert.match(reload, /__tmInvalidateTaskSnapshotStoreCache\(\)/, 'task snapshot cache must be invalidated');
assert.match(reload, /__tmInvalidateTaskIndexStoreCache\(\)/, 'task index cache must be invalidated');
assert.match(reload, /__tmInvalidateDocScopeCache\(\)/, 'document scope cache must be invalidated');
assert.match(reload, /skipSharedStateReload: true/, 'the view refresh must not write synchronized storage back before reading it');
const saveNowIndex = reload.indexOf('await SettingsStore.saveNow?.()');
const cancelPendingSaveIndex = reload.indexOf('__tmCancelSettingsStorePendingSave()');
const settingsLoadIndex = reload.indexOf('await SettingsStore.load(');
assert.ok(saveNowIndex >= 0, 'pending settings changes must be flushed before synchronized data is reloaded');
assert.ok(saveNowIndex < cancelPendingSaveIndex, 'settings must be flushed before the pending save timer is cancelled');
assert.ok(cancelPendingSaveIndex < settingsLoadIndex, 'the pending save timer must be cancelled before settings are force reloaded');
assert.match(reload, /__tmRestoreManualRefreshSessionState\(sessionSnapshot, \{ restoreCollapse: false \}\)/, 'automatic sync reload must not restore stale collapse state from the UI snapshot');
assert.match(refreshRuntime, /globalThis\.__taskHorizonReloadSyncedData = __tmReloadSyncedPluginData/, 'the reload facade must be callable from the plugin lifecycle');
assert.match(legacyAi, /const reloadData = async \(\) => \{[\s\S]*ConversationStore\.loaded = false;[\s\S]*PromptTemplateStore\.loaded = false;/, 'the legacy AI runtime must force reload its synchronized stores');
assert.match(agentWorkbench, /const reloadData = async \(\) => \{[\s\S]*await loadStore\(\);[\s\S]*runtime\.storeLoaded = true;/, 'the Agent runtime must force reload its synchronized workbench store');

console.log('plugin data changed contract tests passed');
