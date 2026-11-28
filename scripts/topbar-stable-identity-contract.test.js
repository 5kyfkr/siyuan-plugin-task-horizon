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

const registry = [];
const drawer = new Set();
const registrations = [];
let drawerReady = false;
let showMobileEntry = true;
let opens = 0;
const unpinned = [];
const drawerSlot = { after: element => drawer.add(element) };
class DrawerItem extends TopBarElement {
    constructor(title, icon) {
        super();
        this.setAttribute('title', title);
        this.innerHTML = `<use xlink:href="#${icon}"></use>`;
    }
    querySelector(selector) {
        if (selector === 'use' || (selector.includes('iconTaskHorizon') && this.innerHTML.includes('iconTaskHorizon'))) {
            return { setAttribute() {}, setAttributeNS() {} };
        }
        return null;
    }
    remove() { drawer.delete(this); }
}
const mobileContext = vm.createContext({
    HTMLElement: DrawerItem,
    Element: DrawerItem,
    document: {
        contains: element => drawer.has(element),
        body: { contains: element => drawer.has(element) },
        querySelectorAll: () => [...drawer],
        getElementById: id => drawerReady && id === 'menuPluginTopBar' ? drawerSlot : null,
    },
    WINDOW_TOPBAR_ATTR: 'data-task-horizon-window-topbar',
    MOBILE_TOPBAR_ATTR: 'data-task-horizon-topbar',
    WINDOW_TOPBAR_ID: taskEntryId,
    WINDOW_TOPBAR_ELEMENT_ID: taskId,
    WINDOW_TOPBAR_ENTRY_KEY: `plugin:${taskEntryId}`,
    SIYUAN_UNPINNED_TOPBAR_STORAGE_KEY: 'local-plugintopunpin',
    TAB_TITLE: 'Task Horizon',
    ICON_ID: 'iconTaskHorizon',
    siyuan: { storage: { 'local-plugintopunpin': unpinned } },
    __tmShouldShowWindowTopbarIcon: () => showMobileEntry,
    __tmT: () => 'Task Horizon',
    __taskHorizonHostBridge: { i18n: { html: () => 'Task Horizon' } },
    setTimeout() {},
});
const startupMethods = index.slice(index.indexOf('    getWindowTopBarLookupSelector()'), index.indexOf('    isCalendarSubscriptionTopBarElement('));
const drawerMethods = shellEntrances.slice(shellEntrances.indexOf('    function __tmGetManagedTopBarLookupSelector()'), shellEntrances.indexOf('    function __tmRefreshShellEntrances()'));
const drawerIconHelpers = shellEntrances.slice(shellEntrances.indexOf('    const __TM_TOPBAR_ENTRY_ATTR'), shellEntrances.indexOf('    function __tmIsTaskHorizonTabHeaderEl'));
const DrawerPlugin = vm.runInContext(`(class {
    isRuntimeMobileClient() { return true; }
    ${identityBlock}
    ${startupMethods}
})`, mobileContext);
const drawerPlugin = new DrawerPlugin();
drawerPlugin.topBarIcons = registry;
drawerPlugin.openFromWindowTopBar = () => { opens++; };
drawerPlugin.addTopBar = ({ id, title, icon, callback }) => {
    registrations.push(id);
    const existing = id && registry.find(element => element.getAttribute('data-id') === id);
    const element = existing || new DrawerItem(title, icon);
    if (id) element.setAttribute('data-id', id);
    if (!existing) registry.push(element);
    element.onclick = callback;
    if (drawerReady && !unpinned.includes(element.id)) drawerSlot.after(element);
    return element;
};
mobileContext.__taskHorizonPluginInstance = drawerPlugin;
vm.runInContext(`
    let __tmTopBarEl = null;
    let __tmTopBarClickCaptureHandler = null;
    let __tmTopBarDocumentCaptureHandler = null;
    function __tmIsMobileTopBarRegistrationHost() { return true; }
    function __tmBindMobileTopBarDocumentCapture() {}
    function __tmBindTopBarClickCapture(element) { __tmTopBarEl = element; }
    ${drawerIconHelpers}
    ${drawerMethods}
`, mobileContext);

mobileContext.addTopBarIcon();
mobileContext.addTopBarIcon();
mobileContext.addTopBarIcon();
assert.deepEqual(registrations, [taskEntryId], 'repeated initialization before the drawer mounts must register only once');
assert.equal(registry.length, 1);
assert.equal(drawer.size, 0);
const mobileEntry = registry[0];
assert.equal(mobileEntry.id, taskId);
assert.equal(mobileEntry.getAttribute('data-task-horizon-topbar'), '1');
const mountDrawer = () => {
    for (const element of registry) {
        if (!unpinned.includes(element.id)) drawerSlot.after(element);
    }
};
drawerReady = true;
mountDrawer();
assert.deepEqual([...drawer], [mobileEntry]);
mobileEntry.onclick();
assert.equal(opens, 1);

const legacyEntry = new DrawerItem('?????', 'iconTaskHorizon');
legacyEntry.setAttribute('data-task-horizon-topbar', '1');
const visibleDuplicate = new DrawerItem('Task Horizon', 'iconTaskHorizon');
const calendarEntry = new DrawerItem('Calendar upload', 'iconTaskHorizonCalendarUpload');
registry.push(legacyEntry, visibleDuplicate, calendarEntry);
mountDrawer();
legacyEntry.remove();
mobileContext.addTopBarIcon();
assert.deepEqual(registry, [mobileEntry, calendarEntry], 'visible and detached duplicates must be removed from the registry');
assert.deepEqual([...drawer], [mobileEntry, calendarEntry]);
drawer.clear();
mountDrawer();
assert.deepEqual([...drawer], [mobileEntry, calendarEntry], 'remount must not restore duplicates');

unpinned.push(taskId);
mobileEntry.remove();
mobileContext.addTopBarIcon();
assert.deepEqual(registrations, [taskEntryId], 'unpinning must reuse the existing registration');
assert.deepEqual([...drawer], [calendarEntry]);
showMobileEntry = false;
mobileContext.addTopBarIcon();
assert.deepEqual(registry, [calendarEntry], 'disabling the drawer entry must also remove a detached registration');
mountDrawer();
assert.deepEqual([...drawer], [calendarEntry]);

unpinned.pop();
showMobileEntry = true;
mobileContext.addTopBarIcon();
mobileContext.addTopBarIcon();
assert.deepEqual(registrations, [taskEntryId, taskEntryId], 're-enabling the drawer entry must register only once');
assert.deepEqual(registry, [calendarEntry, drawerPlugin._taskWindowTopBarElement]);
assert.deepEqual([...drawer], registry);

console.log('topbar stable identity contract tests passed');
