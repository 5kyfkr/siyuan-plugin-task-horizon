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
const taskEntryId = index.match(/const WINDOW_TOPBAR_ID = "([^"]+)";/)?.[1];
const calendarEntryId = index.match(/const CALENDAR_SUBSCRIPTION_TOPBAR_ID = "([^"]+)";/)?.[1];
assert.ok(taskId, 'task manager topbar must define a stable element ID');
assert.ok(calendarId, 'calendar subscription topbar must define a stable element ID');
assert.notEqual(taskId, calendarId, 'task manager and calendar subscription topbars must not share an ID');
assert.ok(taskEntryId, 'task manager topbar must define a stable entry ID');
assert.ok(calendarEntryId, 'calendar subscription topbar must define a stable entry ID');
assert.notEqual(taskEntryId, calendarEntryId, 'task manager and calendar subscription topbars must not share a topbar entry');

const identityStart = index.indexOf('    applyStableTopBarIdentity(element, stableId');
const identityEnd = index.indexOf('\n    applyEntryIconPreset', identityStart);
const identityBlock = index.slice(identityStart, identityEnd);
assert.match(identityBlock, /element\.id = stableId/, 'stable identity must replace SiYuan positional topbar IDs');
assert.match(identityBlock, /element\.setAttribute\("data-id", entryId\)/, 'stable identity must replace positional plugin entry data IDs');
assert.match(identityBlock, /element\.setAttribute\("data-topbar-entry", entryKey\)/, 'stable identity must use a dedicated topbar entry key');
assert.match(identityBlock, /SIYUAN_UNPINNED_TOPBAR_STORAGE_KEY[\s\S]*ids\.includes\(stableId\)/, 'native unpin state must be read by stable ID');
assert.match(identityBlock, /classList\.remove\("fn__none"\)/, 'desktop visibility must not inherit a mobile unpin state');
assert.match(identityBlock, /getElementById\("menuPluginTopBar"\)[\s\S]*after\(element\)/, 'mobile visibility must recover beside SiYuan\'s plugin topbar slot');

const taskMarkStart = index.indexOf('markWindowTopBarElement(element)');
const taskMarkEnd = index.indexOf('\n    removeWindowTopBarElement', taskMarkStart);
assert.match(index.slice(taskMarkStart, taskMarkEnd), /applyStableTopBarIdentity\(element, WINDOW_TOPBAR_ELEMENT_ID, WINDOW_TOPBAR_ID, WINDOW_TOPBAR_ENTRY_KEY\)/, 'task manager topbar must apply its stable ID and entry key');
const calendarMarkStart = index.indexOf('markCalendarSubscriptionTopBarElement(element)');
const calendarMarkEnd = index.indexOf('\n    removeCalendarSubscriptionTopBar', calendarMarkStart);
assert.match(index.slice(calendarMarkStart, calendarMarkEnd), /applyStableTopBarIdentity\([\s\S]*CALENDAR_SUBSCRIPTION_TOPBAR_ELEMENT_ID[\s\S]*CALENDAR_SUBSCRIPTION_TOPBAR_ID[\s\S]*CALENDAR_SUBSCRIPTION_TOPBAR_ENTRY_KEY/, 'calendar subscription topbar must apply its stable ID and entry key');
assert.match(index, /addTopBar\(\{\s*id: WINDOW_TOPBAR_ID,[\s\S]*?position: "right"/, 'task manager topbar must register its stable ID in the right-hand toolbar');
assert.match(index, /addTopBar\(\{\s*id: CALENDAR_SUBSCRIPTION_TOPBAR_ID,[\s\S]*?position: "right"/, 'calendar subscription topbar must register its stable ID in the right-hand toolbar');
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
        this.hidden = false;
        this.parentElement = null;
        this.attributes = new Map();
        this.classList = { remove: (name) => { if (name === 'fn__none') this.hidden = false; } };
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); }
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
new IdentityPlugin().applyStableTopBarIdentity(entry, taskId, taskEntryId, `plugin:${taskEntryId}`);
assert.equal(entry.id, taskId);
assert.equal(entry.getAttribute('data-id'), taskEntryId);
assert.equal(entry.getAttribute('data-topbar-entry'), `plugin:${taskEntryId}`);
assert.equal(entry.connected, true, 'legacy unpin state must not strand a visible mobile entry');

let desktopMoves = 0;
const toolbarParent = {};
const desktopAnchor = {
    parentElement: toolbarParent,
    before(element) {
        desktopMoves += 1;
        element.parentElement = toolbarParent;
    },
};
const desktopIdentityContext = {
    ...identityContext,
    document: {
        contains: () => true,
        getElementById: () => desktopAnchor,
    },
};
const DesktopIdentityPlugin = vm.runInNewContext(`(class {
    isRuntimeMobileClient() { return false; }
    ${identityBlock}
})`, desktopIdentityContext);
const migrated = new TopBarElement();
migrated.connected = true;
migrated.hidden = true;
migrated.parentElement = toolbarParent;
migrated.attributes.set('data-topbar-entry', 'plugin:siyuan-plugin-task-horizon:legacy-index%3A1');
migrated.attributes.set('data-entry-hidden', 'true');
new DesktopIdentityPlugin().applyStableTopBarIdentity(migrated, taskId, taskEntryId, `plugin:${taskEntryId}`);
assert.equal(migrated.hidden, false, 'a mobile unpin must not hide a desktop topbar entry');
assert.equal(migrated.getAttribute('data-entry-hidden'), null, 'a migrated topbar entry must clear stale catalog visibility');
assert.equal(desktopMoves, 1, 'a migrated topbar entry must return to the right-hand toolbar slot');

console.log('topbar stable identity contract tests passed');
