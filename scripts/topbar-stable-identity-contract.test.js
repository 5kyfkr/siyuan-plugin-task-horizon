'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
const shellEntrances = fs.readFileSync(path.join(root, 'src/task-horizon/main/shell/72-shell-entrances-and-native-doc-hooks.js'), 'utf8');

const taskId = index.match(/const WINDOW_TOPBAR_ELEMENT_ID = "([^"]+)";/)?.[1];
const calendarId = index.match(/const CALENDAR_SUBSCRIPTION_TOPBAR_ELEMENT_ID = "([^"]+)";/)?.[1];
assert.ok(taskId, 'task manager topbar must define a stable element ID');
assert.ok(calendarId, 'calendar subscription topbar must define a stable element ID');
assert.notEqual(taskId, calendarId, 'task manager and calendar subscription topbars must not share an ID');

const identityStart = index.indexOf('applyStableTopBarIdentity(element, stableId)');
const identityEnd = index.indexOf('\n    applyEntryIconPreset', identityStart);
const identityBlock = index.slice(identityStart, identityEnd);
assert.match(identityBlock, /element\.id = stableId/, 'stable identity must replace SiYuan positional topbar IDs');
assert.match(identityBlock, /SIYUAN_UNPINNED_TOPBAR_STORAGE_KEY[\s\S]*ids\.includes\(stableId\)/, 'native unpin state must be read by stable ID');
assert.match(identityBlock, /classList\.toggle\("fn__none", unpinned\)/, 'desktop visibility must be reapplied after replacing the positional ID');
assert.match(identityBlock, /getElementById\("menuPluginTopBar"\)[\s\S]*after\(element\)/, 'mobile visibility must recover beside SiYuan\'s plugin topbar slot');

const taskMarkStart = index.indexOf('markWindowTopBarElement(element)');
const taskMarkEnd = index.indexOf('\n    removeWindowTopBarElement', taskMarkStart);
assert.match(index.slice(taskMarkStart, taskMarkEnd), /applyStableTopBarIdentity\(element, WINDOW_TOPBAR_ELEMENT_ID\)/, 'task manager topbar must apply its stable ID');
const calendarMarkStart = index.indexOf('markCalendarSubscriptionTopBarElement(element)');
const calendarMarkEnd = index.indexOf('\n    removeCalendarSubscriptionTopBar', calendarMarkStart);
assert.match(index.slice(calendarMarkStart, calendarMarkEnd), /applyStableTopBarIdentity\(element, CALENDAR_SUBSCRIPTION_TOPBAR_ELEMENT_ID\)/, 'calendar subscription topbar must apply its stable ID');
assert.match(shellEntrances, /__tmMarkManagedTopBarEntry[\s\S]*__taskHorizonApplyWindowTopBarIdentity\?\.\(el\)/, 'mobile task manager registration must reuse the stable ID path');

const syncStart = index.indexOf('    syncWindowTopBar() {');
const syncEnd = index.indexOf('\n    ensureWindowTopBar()', syncStart);
assert.ok(syncStart >= 0 && syncEnd > syncStart, 'topbar sync method must be present');
const SyncPlugin = vm.runInNewContext(`(class {
    isRuntimeMobileClient() { return this.mobile; }
    removeWindowTopBar() { this.removals += 1; }
    ensureWindowTopBar() { return true; }
    ${index.slice(syncStart, syncEnd)}
})`, { readWindowTopbarEnabled: () => false });
const mobile = new SyncPlugin();
mobile.mobile = true;
mobile.removals = 0;
mobile.syncWindowTopBar();
assert.equal(mobile.removals, 0, 'mobile sync must not remove the drawer topbar entry');
const desktop = new SyncPlugin();
desktop.mobile = false;
desktop.removals = 0;
desktop.syncWindowTopBar();
assert.equal(desktop.removals, 1, 'desktop sync must still remove a disabled topbar entry');

class TopBarElement {
    constructor() {
        this.id = taskId.replace(/_task-manager$/, '_0');
        this.connected = false;
        this.classList = { toggle() {} };
    }
    remove() { this.connected = false; }
}
const menuSlot = { after: (element) => { element.connected = true; } };
const identityContext = {
    HTMLElement: TopBarElement,
    document: {
        contains: (element) => element.connected,
        getElementById: (id) => id === 'menuPluginTopBar' ? menuSlot : null,
    },
    SIYUAN_UNPINNED_TOPBAR_STORAGE_KEY: 'local-plugintopunpin',
    siyuan: { storage: { 'local-plugintopunpin': [taskId.replace(/_task-manager$/, '_0')] } },
};
const IdentityPlugin = vm.runInNewContext(`(class {
    isRuntimeMobileClient() { return true; }
    ${identityBlock}
})`, identityContext);
const entry = new TopBarElement();
new IdentityPlugin().applyStableTopBarIdentity(entry, taskId);
assert.equal(entry.id, taskId);
assert.equal(entry.connected, true, 'legacy unpin state must not strand a visible mobile entry');

console.log('topbar stable identity contract tests passed');
