'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.js'), 'utf8');

const segment = (start, end) => {
    const from = index.indexOf(start);
    assert.notEqual(from, -1, `missing segment start: ${start}`);
    const to = index.indexOf(end, from + start.length);
    assert.ok(to > from, `missing segment end: ${end}`);
    return index.slice(from, to);
};

assert.match(index, /const PLUGIN_ID = "siyuan-plugin-task-horizon";/, 'the sandbox plugin id must match the shipped one');
assert.match(index, /const TASK_DOCK_TYPE = "::task-horizon-dock";/, 'the sandbox Dock type must match the shipped one');

const dockTypeSource = segment('const getMobileTaskDockType = (plugin) =>', 'const getMobileTaskDockNodes = (plugin) => {');
const dockNodesSource = segment('const getMobileTaskDockNodes = (plugin) => {', 'const isMobileTaskDockPanelOpen = (node) => {');
const panelOpenSource = segment('const isMobileTaskDockPanelOpen = (node) => {', 'const clearFocusInsideElement = (element) =>');
const resolveSource = segment('    resolveMobileTaskDockElement(preferred = null) {', '    scheduleTaskDockRecovery(reason = "manual", options = {}) {');

const context = vm.createContext({ console });
vm.runInContext(`
class FakeElement {
    constructor(tag = "div") {
        this.tagName = String(tag).toUpperCase();
        this.attrs = {};
        this.parentElement = null;
        this.style = { transform: "" };
        this.children = [];
    }
    getAttribute(name) {
        return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
    }
    setAttribute(name, value) {
        this.attrs[name] = String(value);
    }
    appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
        return child;
    }
    matches(selector) {
        return String(selector).split(",").some((raw) => matchesOne(this, raw.trim()));
    }
    closest(selector) {
        let node = this;
        while (node instanceof FakeElement) {
            if (node.matches(selector)) return node;
            node = node.parentElement;
        }
        return null;
    }
}
const classNames = (node) => String(node.getAttribute("class") || "").split(/\\s+/).filter(Boolean);
const matchesOne = (node, selector) => {
    if (!selector) return false;
    const tag = /^[a-z0-9*-]+/i.exec(selector);
    if (tag && tag[0] !== "*" && node.tagName !== tag[0].toUpperCase()) return false;
    for (const cls of selector.match(/\\.[A-Za-z0-9_-]+/g) || []) {
        if (!classNames(node).includes(cls.slice(1))) return false;
    }
    const attrPattern = /\\[([^\\]=]+)(?:="([^"]*)")?\\]/g;
    let match;
    while ((match = attrPattern.exec(selector))) {
        const value = node.getAttribute(match[1]);
        if (value == null) return false;
        if (typeof match[2] === "string" && value !== match[2]) return false;
    }
    return true;
};
const allNodes = [];
const createElement = (tag = "div", attrs = {}) => {
    const element = new FakeElement(tag);
    Object.keys(attrs).forEach((key) => element.setAttribute(key, attrs[key]));
    allNodes.push(element);
    return element;
};
const document = {
    body: new FakeElement("body"),
    querySelectorAll: (selector) => allNodes.filter((node) => node.matches(selector)),
};
document.body.contains = (node) => {
    let current = node;
    while (current instanceof FakeElement) {
        if (current === document.body) return true;
        current = current.parentElement;
    }
    return false;
};
const HTMLElement = FakeElement;
const PLUGIN_ID = "siyuan-plugin-task-horizon";
const TASK_DOCK_TYPE = "::task-horizon-dock";
${dockTypeSource}
${dockNodesSource}
${panelOpenSource}
class TestPlugin {
${resolveSource}
}
this.harness = {
    createElement,
    document,
    TestPlugin,
    getMobileTaskDockNodes,
    getMobileTaskDockType,
    isMobileTaskDockPanelOpen,
};
`, context);

const { createElement, document, TestPlugin, getMobileTaskDockNodes, getMobileTaskDockType, isMobileTaskDockPanelOpen } = context.harness;

const plugin = new TestPlugin();
plugin.name = 'siyuan-plugin-task-horizon';
const DOCK_TYPE = getMobileTaskDockType(plugin);
assert.equal(DOCK_TYPE, 'siyuan-plugin-task-horizon::task-horizon-dock', 'the Dock type must stay wired to the plugin id');

const buildSidePanel = () => {
    const panel = createElement('div', { class: 'side-panel' });
    document.body.appendChild(panel);
    const toolbar = createElement('div');
    panel.appendChild(toolbar);
    const tab = createElement('svg', {
        'data-type': `sidebar-${DOCK_TYPE}-tab`,
        'data-mobile-plugin-dock-tab': DOCK_TYPE,
    });
    toolbar.appendChild(tab);
    const content = createElement('div', {
        'data-type': `sidebar-${DOCK_TYPE}`,
        'data-mobile-plugin-dock-content': DOCK_TYPE,
    });
    panel.appendChild(content);
    return { panel, toolbar, tab, content };
};

assert.equal(isMobileTaskDockPanelOpen(null), false, 'a missing node is never an open Dock host');
assert.equal(isMobileTaskDockPanelOpen(createElement('div')), true, 'a host without a side panel ancestor stays usable');

const dock = buildSidePanel();
assert.equal(isMobileTaskDockPanelOpen(dock.content), false, 'a Dock node inside a closed side panel must report closed');

assert.equal(plugin.resolveMobileTaskDockElement(), null,
    'a closed side panel must not claim the single manager instance while a full-screen entry is waiting for it');
assert.equal(plugin.resolveMobileTaskDockElement(dock.content), null,
    'an explicitly preferred host inside a closed side panel must be rejected');

dock.panel.style.transform = 'translateX(0px)';
assert.equal(isMobileTaskDockPanelOpen(dock.content), true, 'an opened side panel must report open');
assert.equal(plugin.resolveMobileTaskDockElement(), dock.content, 'an opened side panel must resolve the Dock content node');
assert.notEqual(plugin.resolveMobileTaskDockElement(), dock.tab, 'the Dock tab icon must never become the manager host');

dock.panel.style.transform = '';
plugin._taskDockElement = dock.content;
assert.equal(plugin.resolveMobileTaskDockElement(), null, 'a cached host inside a closed side panel must not be reused');
dock.panel.style.transform = 'translateX(0px)';
assert.equal(plugin.resolveMobileTaskDockElement(), dock.content, 'a cached host must be reused once its panel is opened');

dock.panel.style.transform = '';
const detached = createElement('div', { 'data-mobile-plugin-dock-content': DOCK_TYPE });
document.body.appendChild(detached);
assert.equal(plugin.resolveMobileTaskDockElement(), detached, 'a Dock node without a side panel ancestor must keep working as a host');

const otherDock = createElement('div', { 'data-mobile-plugin-dock-content': 'another-plugin::dock' });
document.body.appendChild(otherDock);
const resolvedNodes = getMobileTaskDockNodes(plugin);
assert.ok(resolvedNodes.includes(dock.content), 'the Task Horizon Dock content node must stay addressable');
assert.ok(resolvedNodes.includes(detached), 'the fallback Task Horizon Dock node must stay addressable');
assert.ok(!resolvedNodes.includes(otherDock), 'foreign plugin Dock nodes must never be addressed as the manager host');

console.log('mobile Dock host visibility tests passed');
