'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'quickbar.js'), 'utf8');
const native = fs.readFileSync(path.join(root, 'src/task-horizon/main/shell/72-shell-entrances-and-native-doc-hooks.js'), 'utf8');

function segment(text, start, end) {
    const from = text.indexOf(start);
    const to = text.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, `Missing source segment: ${start}`);
    return text.slice(from, to);
}

// Only ancestry and the selectors used by these boundary functions are mocked.
// The optional native-browser regression also exercises real browser selectors,
// SiYuan's editor snapshot validation and the complete native drag/drop view.
class Element {
    constructor(attrs = {}, parent = null) {
        this.attrs = attrs;
        this.parentElement = parent;
        this.dataset = {};
        this.removed = false;
        this.classList = { contains: name => (attrs.class || '').split(' ').includes(name), remove() {} };
    }
    closest(selectors) {
        return selectors.split(',').some(raw => {
            const selector = raw.trim();
            if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
            const attrs = [...selector.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)];
            return attrs.length && attrs.every(([, name, value]) => name in this.attrs && (value === undefined || this.attrs[name] === value));
        }) ? this : this.parentElement?.closest(selectors) || null;
    }
    querySelector() { return null; }
    remove() { this.removed = true; }
}

let editing = false;
const document = { querySelector: () => editing ? {} : null };
const functions = new Function('Element', 'HTMLElement', 'document', `
    const inlineMetaMissingHostSeenAt = new Map();
    const inlineMetaLayoutCache = new Map();
    const hasInlineMetaInBlockHost = () => false;
    ${segment(source, '    function isQuickbarNativeEditorSurface(', '    function removeInlineMetaHostByRenderKey(')}
    ${segment(source, '    function getBlockElementFromTarget(', '    function shouldRejectInlineTextParent(')}
    ${segment(source, '        function queueInlineMetaRenderBlock(', '        function drainInlineMetaRenderQueue(')}
    return {isQuickbarNativeEditorSurface, shouldPreserveQuickbarNativeEditorDOM,
        touchInlineMetaHost, removeInlineMetaHostNode, getBlockElementFromTarget,
        getTaskBlockElementFromTarget, queueInlineMetaRenderBlock};
`)(Element, Element, document);

const sourceList = new Element({'data-type': 'NodeList', 'custom-sy-list-mindmap': '1'});
const hiddenTask = new Element({'data-type': 'NodeListItem'}, sourceList);
const renderedTask = new Element({}, new Element({'data-type': 'NodeList', 'data-list-mindmap-rendered': 'true'}));
const fullscreenContent = new Element({}, new Element({class: 'list-mindmap'}));
const liteContent = new Element({}, new Element({'data-protyle-lite-render': 'true'}));
const ordinaryTask = new Element({'data-type': 'NodeListItem'});

for (const target of [hiddenTask, renderedTask, fullscreenContent, liteContent, {parentElement: hiddenTask}]) {
    assert.equal(functions.isQuickbarNativeEditorSurface(target), true);
    assert.equal(functions.getBlockElementFromTarget(target), null);
    assert.equal(functions.getTaskBlockElementFromTarget(target), null);
    assert.equal(functions.queueInlineMetaRenderBlock(target), false, 'Do not queue even already-observed mindmap tasks');
}
assert.equal(functions.isQuickbarNativeEditorSurface(ordinaryTask), false);
assert.equal(functions.isQuickbarNativeEditorSurface(null), false);

const oldHost = new Element({}, hiddenTask);
editing = true;
assert.equal(functions.removeInlineMetaHostNode(oldHost), false, 'Preserve an active native editor snapshot');
assert.equal(oldHost.removed, false);
functions.touchInlineMetaHost(oldHost, 123);
assert.equal(oldHost.dataset.inlineTouchedAt, undefined, 'Do not change even bookkeeping attributes');
editing = false;
assert.equal(functions.removeInlineMetaHostNode(oldHost), true, 'Clean stale source decorations after editing');
assert.equal(oldHost.removed, true);
assert.equal(functions.removeInlineMetaHostNode(fullscreenContent), false, 'Never mutate the native preview');
assert.equal(functions.removeInlineMetaHostNode(liteContent), false, 'Never mutate a lite editor');
functions.touchInlineMetaHost(ordinaryTask, 123);
assert.equal(ordinaryTask.dataset.inlineTouchedAt, '123', 'Ordinary task decoration remains enabled');

const excluded = new Function('Element', '__tmResolveNativeDocEventElement', `
    ${segment(native, '    function __tmIsNativeDocCheckboxSyncExcludedTarget(', '    function __tmFindNativeDocTaskListItem(')}
    return __tmIsNativeDocCheckboxSyncExcludedTarget;
`)(Element, target => target instanceof Element ? target : target?.parentElement);
assert.equal(excluded(fullscreenContent), true);
assert.equal(excluded(liteContent), true);
assert.equal(excluded(hiddenTask), false, 'Real source tasks must remain eligible for status synchronization');
assert.equal(excluded(ordinaryTask), false);

let hidden = 0;
const trigger = new Function('isQuickbarNativeEditorSurface', 'floatBar', 'hideFloatBar', `
    ${segment(source, '        function handleTrigger(e)', '        function isQuickbarEnabled(')}
    return handleTrigger;
`)(functions.isQuickbarNativeEditorSurface, {style: {display: 'block'}}, () => hidden++);
for (const type of ['pointerup', 'click']) {
    trigger({type, target: fullscreenContent,
        preventDefault() { throw new Error('Native interaction cancelled'); },
        stopPropagation() { throw new Error('Native interaction swallowed'); },
        stopImmediatePropagation() { throw new Error('Native interaction swallowed'); }});
}
assert.equal(hidden, 2);

const render = segment(source, '        async function renderInlineMetaForBlock(', '        function ');
assert.match(render, /await ensureQuickbarCustomFieldIdsForDoc[\s\S]*isQuickbarNativeEditorSurface\(blockEl\)/,
    'Recheck after asynchronous field resolution in case the list changed to mindmap');
assert.match(source, /attributeFilter:\s*\[[^\]]*'custom-sy-list-mindmap'[^\]]*'data-list-mindmap-rendered'/,
    'Observe list/mindmap transitions so normal inline fields resume when switched back');
console.log('quickbar mindmap isolation: native events, snapshots, cleanup, and source status boundary passed');
