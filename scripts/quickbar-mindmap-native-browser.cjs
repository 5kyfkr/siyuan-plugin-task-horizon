'use strict';

// Optional source integration test (Node >= 22.13, Playwright + Chromium).
// SIYUAN_SOURCE_DIR must point to the extracted SiYuan 3.8.5 source root.
// PLAYWRIGHT_MODULE optionally selects an existing Playwright installation.
// No kernel, application build, or user's documents are touched.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {stripTypeScriptTypes} = require('node:module');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
assert.ok(process.env.SIYUAN_SOURCE_DIR, 'Set SIYUAN_SOURCE_DIR to SiYuan 3.8.5 sources');
const hostRoot = path.resolve(process.env.SIYUAN_SOURCE_DIR);
assert.equal(JSON.parse(fs.readFileSync(path.join(hostRoot, 'app/package.json'))).version, '3.8.5');
const quickbar = fs.readFileSync(path.join(root, 'quickbar.js'), 'utf8');
function segment(text, start, end) {
    const from = text.indexOf(start), to = text.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, `Missing segment: ${start}`);
    return text.slice(from, to);
}
function hostSource(name) {
    const source = fs.readFileSync(path.join(hostRoot, 'app/src/protyle/render/listMindmap', name + '.ts'), 'utf8');
    return stripTypeScriptTypes(source.replace(/^import [\s\S]*?;\r?\n/gm, '').replace(/^export /gm, ''), {mode: 'strip'});
}
const sources = {
    model: hostSource('model'), editor: hostSource('editor'), view: hostSource('view'),
    routing: hostSource('routing'), drop: hostSource('drop'),
    helpers: segment(quickbar, '    function isQuickbarNativeEditorSurface(', '    function removeInlineMetaHostByRenderKey('),
    mount: segment(quickbar, '        function getInlineNativeHostMount(', '        function removeInlineMetaAlternatePlacementHosts('),
    scan: segment(quickbar, '        function syncInlineMetaTaskBlocks(', '        function cleanupInlineMetaTaskBlocks('),
    directional: segment(quickbar, '        function getInlineDirectionalTaskBlocks(', '        function getInlineTaskBlockBuckets('),
    taskDetection: segment(quickbar, '    function isExplicitNonTaskListItem(', '    function isInlineMetaHiddenDoneTaskBlock('),
    blockDetection: segment(quickbar, '    function getBlockElementFromTarget(', '    function shouldRejectInlineTextParent('),
    trigger: segment(quickbar, '        function handleTrigger(e)', '        function isQuickbarEnabled('),
    hideCSS: segment(quickbar, '            .list-mindmap .sy-custom-props-inline-host,', '            .sy-custom-props-inline-host[data-inline-placement='),
};

async function setup(sources) {
    const noop = () => {};
    const load = (code, exports, deps = {}) => new Function(...Object.keys(deps), code + '; return {' + exports + '};')(...Object.values(deps));
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    window.siyuan = {languages: {listMindmapStale: '内容已更新，请重新编辑'}, config: {keymap: {editor: {general: {}}}}};
    let nextId = 0;
    window.Lute = {NewNodeID: () => 'new-' + (++nextId)};
    const Constants = {CUSTOM_SY_LIST_MINDMAP: 'custom-sy-list-mindmap', CUSTOM_SY_LIST_MINDMAP_DATA: 'custom-sy-list-mindmap-data', TIMEOUT_DBLCLICK: 250};
    const model = load(sources.model, 'readListMindmap,cleanListMindmapHTML,layoutListMindmap,moveListMindmapNode', {Constants, getOrderedListMarkerUpdates: () => []});
    const helpers = load(sources.helpers, 'isQuickbarNativeEditorSurface,shouldPreserveQuickbarNativeEditorDOM,touchInlineMetaHost,removeInlineMetaHostNode', {
        hasInlineMetaInBlockHost: el => !!el?.querySelector('.sy-custom-props-inline-host[data-inline-placement="in-block"]'),
        inlineMetaMissingHostSeenAt: new Map(), inlineMetaLayoutCache: new Map(),
    });
    const isTaskBlockElement = load(sources.taskDetection, 'isTaskBlockElement', {getListSubtype: el => el?.getAttribute('data-subtype') || ''}).isTaskBlockElement;
    const mountDeps = {...helpers, QUICKBAR_INLINE_USE_NATIVE_HOST: true,
        resolveTaskAttrNodeIdForDetail: el => el.dataset.nodeId,
        hasInlineMetaInBlockHost: el => !!el.querySelector('.sy-custom-props-inline-host'),
        invalidateInlineMetaActiveTargetsCache: noop, bindInlineHostPointerHandler: noop,
        ensureInlineMetaLayer: () => null};
    const mount = load(sources.mount, 'ensureInlineHost', mountDeps).ensureInlineHost;
    const legacyMount = load(sources.mount, 'ensureInlineHost', {...mountDeps, isQuickbarNativeEditorSurface: () => false}).ensureInlineHost;
    const item = (id, title, children = '') => `<div class="li" data-type="NodeListItem" data-node-id="${id}" data-subtype="t" data-task=" ">
        <div class="protyle-action protyle-action--task"><svg><use href="#iconUncheck"></use></svg></div>
        <div class="p" data-type="NodeParagraph" data-node-id="${id}-text"><div contenteditable="true">${title}</div><div class="protyle-attr" contenteditable="false"></div></div>${children}</div>`;
    function fixture() {
        const root = document.createElement('section');
        root.className = 'protyle-wysiwyg';
        root.innerHTML = `<div class="list" data-node-id="root" data-type="NodeList" data-subtype="t" custom-sy-list-mindmap="1" data-list-mindmap-rendered="true">${item('parent', 'Parent', `<div class="list" data-type="NodeList" data-subtype="t" data-node-id="children">${item('child', 'Original')}</div>`)}${item('target', 'Target')}<div class="list-mindmap"><div class="list-mindmap__content"></div></div></div>`;
        document.body.append(root);
        return {root, list: root.firstElementChild, element: root.querySelector('[data-node-id="child"]'), host: root.querySelector('.list-mindmap__content')};
    }
    const style = document.createElement('style');
    // Geometry-only equivalent of the native stylesheet for the isolated view.
    style.textContent = `body{font:16px sans-serif;margin:20px} [hidden]{display:none!important}
      .protyle-wysiwyg [data-list-mindmap-rendered="true"]>[data-type="NodeListItem"]{display:none}
      .list-mindmap{position:relative;display:flex;flex-direction:column;width:100%;height:460px;overflow:hidden}
      .list-mindmap__viewport{position:relative;flex:1;min-height:0;overflow:hidden;touch-action:none;user-select:none}
      .list-mindmap__world{position:absolute;left:0;top:0;transform-origin:0 0}
      .list-mindmap__canvas{position:absolute;inset:0;pointer-events:none}
      .list-mindmap__node{position:absolute;min-width:32px;max-width:300px;width:max-content;min-height:32px;padding:4px 6px;box-sizing:border-box;line-height:1.5}
      .list-mindmap__content{display:flex;align-items:center;gap:6px}
      .list-mindmap__task{width:18px;height:18px;padding:0;flex-shrink:0}
      .list-mindmap__toolbar{position:absolute;top:0;right:0;z-index:5}
      .list-mindmap__toolbar button{width:24px;height:24px}
      .list-mindmap__fold,.list-mindmap__add-child,.list-mindmap__inspector{display:none}
      .list-mindmap__ghost{pointer-events:none;position:absolute}
      svg{width:16px;height:16px}` + sources.hideCSS;
    document.head.append(style);
    const results = [];
    async function editCase(name, mutate, expected = true, beforeOpen) {
        const c = fixture();
        const p = c.element.querySelector('.p');
        if (beforeOpen) beforeOpen(c, p);
        const wysiwyg = document.createElement('div');
        wysiwyg.className = 'protyle-wysiwyg';
        const state = {saves: [], messages: []};
        const protyle = {block: {rootID: ''}, undo: {clear: noop}, wysiwyg: {flushPendingInput: async () => {}},
            toolbar: {element: document.createElement('div'), subElement: document.createElement('div')}};
        const deps = {
            showMessage: message => state.messages.push(message),
            escapeHtml: value => { const el = document.createElement('span'); el.textContent = value; return el.innerHTML; },
            isMobile: () => false, hintRef: noop, hintSlash: () => [], registerBuiltinSlashHint: x => x,
            mountProtyleLiteFragment: (target, options) => {
                target.dataset.protyleLiteRender = 'true';
                wysiwyg.innerHTML = options.initialBlockHTML;
                target.append(wysiwyg); options.afterSetContent(protyle, wysiwyg);
                return {protyle, wysiwyg, hintElement: document.createElement('div'), focus: noop,
                    getBlockHTML: () => wysiwyg.innerHTML,
                    getMarkdown: () => wysiwyg.querySelector('[contenteditable="true"]')?.textContent,
                    destroy: noop};
            },
            bindLiteCodeActions: noop, setMobileToolbarUndo: noop, getDefaultToolbar: () => [],
            hideElements: noop, matchHotKey: () => false, TABLE_CELL_SLASH_IDS: new Set(),
            configureAVRichTextLute: noop, getAVRichTextLute: () => ({}), getAVRichTextUnsupportedPasteBlocks: () => [],
            sanitizeAVRichTextBlockDOM: x => x, highlightRender: noop, mathRender: noop, cleanListMindmapHTML: model.cleanListMindmapHTML,
        };
        const open = load(sources.editor, 'openListMindmapEditor', deps).openListMindmapEditor;
        const instance = open({owner: {app: {}, notebookId: 'test', block: {rootID: 'doc'}}, node: {element: c.element}, host: c.host,
            canEdit: () => c.element.isConnected, onResize: noop, onFinish: noop, onUndo: noop,
            onSave: async html => { state.saves.push(html); p.outerHTML = html; return true; }});
        check(!!instance, `${name}: editor not opened`);
        const before = p.outerHTML;
        if (mutate) await mutate(c, p);
        const changed = before !== p.outerHTML;
        wysiwyg.querySelector('[contenteditable="true"]').textContent = '12122';
        const saved = await instance.finish();
        check(saved === expected, `${name}: saved=${saved}, messages=${state.messages}`);
        check(expected ? state.saves.length === 1 && !state.messages.length : state.messages[0]?.includes('12122'), `${name}: save/recovery mismatch`);
        if (expected) check(c.element.textContent.includes('12122'), `${name}: title not updated`);
        results.push({name, saved, sourceChangedByPlugin: changed});
        instance.destroy(); c.root.remove();
    }
    await editCase('legacy decoration reproduces stale-title error', c => legacyMount(c.element), false);
    await editCase('patched mount preserves native title save', c => check(mount(c.element) === null, 'mindmap must have no inline host'));
    await editCase('cleanup and touch preserve active editor snapshot', c => {
        const host = c.element.querySelector('.sy-custom-props-inline-host');
        const before = host.outerHTML;
        check(!helpers.removeInlineMetaHostNode(host), 'cleanup must defer while editing');
        helpers.touchInlineMetaHost(host, 999);
        check(host.outerHTML === before, 'snapshot mutated');
        check(getComputedStyle(host).display === 'none', 'mindmap fields must be hidden');
    }, true, c => { legacyMount(c.element).innerHTML = '<span>Today</span>'; });
    await editCase('real external text conflicts still recover draft', (c, p) => {p.firstElementChild.textContent = 'External edit';}, false);
    const c = fixture();
    const queued = [];
    const observed = new Map();
    const scanDeps = {...helpers, inlineMetaStarted: true, inlineMetaNeedSyncBlocks: true,
        inlineMetaObservedRoots: [c.root], getInlineMetaObserveRoots: () => [c.root],
        getInlineMetaRenderKey: (el, id) => id, isTaskBlockElement,
        isInlineMetaHiddenDoneTaskBlock: () => false, ensureInlineMetaBlockObserver: () => null,
        inlineMetaScrolling: false, inlineMetaObservedTaskBlocks: observed, inlineMetaVisibleTaskBlocks: new Map(),
        isInlineMetaScrollSettling: () => false, inlineMetaRecentStructuralUntil: 0,
        resolveTaskAttrNodeIdForDetail: el => el.dataset.nodeId, hasInlineMetaPropsCacheForBlock: () => false,
        sortInlineMetaBlocksByViewportPriority: blocks => blocks,
        queueInlineMetaRenderBlock: el => {queued.push(el.dataset.nodeId); return true;},
        invalidateInlineMetaActiveTargetsCache: noop, inlineMetaRenderCursor: 0};
    load(sources.scan, 'syncInlineMetaTaskBlocks', scanDeps).syncInlineMetaTaskBlocks(true);
    check(!queued.length && !observed.size, 'Hidden mindmap sources must not be scanned');
    observed.set('child', c.element);
    check(!load(sources.directional, 'getInlineDirectionalTaskBlocks', scanDeps).getInlineDirectionalTaskBlocks().length, 'Old observed tasks must not survive directional filtering');
    // List -> mindmap -> list: ordinary fields resume; old fields are cleaned only when safe.
    c.list.removeAttribute('custom-sy-list-mindmap'); c.list.removeAttribute('data-list-mindmap-rendered');
    const ordinaryHost = mount(c.element); check(!!ordinaryHost, 'Ordinary list failed to mount');
    c.list.setAttribute('custom-sy-list-mindmap', '1');
    check(mount(c.element) === null, 'Switched mindmap decorated');
    check(helpers.removeInlineMetaHostNode(ordinaryHost), 'Inactive source must clean old inline fields');
    check(!c.element.querySelector('.sy-custom-props-inline-host'), 'Stale host remained');
    c.list.removeAttribute('custom-sy-list-mindmap');
    check(!!mount(c.element), 'Returning to ordinary list must restore fields'); c.root.remove();
    results.push({name: 'scan, cached scan, no persistent fields, list mode transitions', passed: true});

    const routing = load(sources.routing, 'routeMindmapRelation,routeManualMindmapRelation,adjustMindmapRoute');
    const drop = load(sources.drop, 'findMindmapDrop');
    const {ListMindmapView} = load(sources.view, 'ListMindmapView', {...model, ...routing, ...drop, Constants,
        mathRender: noop, getAVRichTextSafeURL: x => x, destroyTabsRender: noop, tabsRender: noop});
    window.setupNativeView = (patched, fullscreen = false) => {
        window.nativeTest?.destroy();
        const c = fixture(), state = {moves: [], toggles: [], edits: [], adds: [], quickbars: 0};
        const host = c.root.querySelector('.list-mindmap'); host.replaceChildren();
        if (fullscreen) document.body.append(host);
        const guard = patched ? helpers.isQuickbarNativeEditorSurface : () => false;
        const blockDetection = load(sources.blockDetection, 'getTaskBlockElementFromTarget', {isQuickbarNativeEditorSurface: guard, isTaskBlockElement});
        const trigger = load('let lastTriggerTime=0; const inlineMetaInteractUntil=0;\n' + sources.trigger, 'handleTrigger', {
            isQuickbarNativeEditorSurface: guard, ...blockDetection,
            floatBar: {style: {display: 'none'}, contains: () => false}, selectMenu: {contains: () => false}, inputEditor: {contains: () => false},
            hideFloatBar: noop, isQuickbarInteractionTarget: () => false, noteQuickbarActivity: noop,
            shouldSuppressFloatBarForTarget: () => false, showFloatBar: () => state.quickbars++,
        }).handleTrigger;
        document.addEventListener('pointerup', trigger, true); document.addEventListener('click', trigger, true);
        const view = new ListMindmapView({host, model: model.readListMindmap(c.list), onExit: noop,
            onMove: (id, targetId, placement) => {
                check(model.moveListMindmapNode(c.list, id, targetId, placement), 'Native model move failed');
                state.moves.push({id, targetId, placement}); view.update(model.readListMindmap(c.list));
            }, onTaskToggle: id => state.toggles.push(id), onEdit: id => state.edits.push(id),
            onAdd: (id, kind) => state.adds.push({id, kind})});
        window.nativeTest = {state, view, c, host, parent: () => model.readListMindmap(c.list).nodes.get('child').parentId,
            destroy: () => {document.removeEventListener('pointerup', trigger, true); document.removeEventListener('click', trigger, true); view.destroy(); c.root.remove(); host.remove();}};
    };
    return results;
}

(async () => {
    const browser = await chromium.launch({headless: true});
    try {
        const page = await browser.newPage({viewport: {width: 1100, height: 750}});
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.setContent('<!doctype html><html><body></body></html>');
        const results = await page.evaluate(setup, sources);
        async function drag(patched, fullscreen = false) {
            await page.evaluate(({patched, fullscreen}) => window.setupNativeView(patched, fullscreen), {patched, fullscreen});
            const source = page.locator('[data-mindmap-id="child"] .list-mindmap__content');
            const target = page.locator('[data-mindmap-id="target"] .list-mindmap__content');
            await source.waitFor({state: 'visible'});
            // Two animation frames allow the native view's layout/initial fit to settle.
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            const a = await source.boundingBox(), b = await target.boundingBox();
            await page.mouse.move(a.x + a.width - 4, a.y + a.height / 2); await page.mouse.down();
            await page.mouse.move(b.x + b.width - 4, b.y + b.height / 2, {steps: 18}); await page.mouse.up();
            const state = await page.evaluate(() => ({...window.nativeTest.state, parent: window.nativeTest.parent()}));
            assert.equal(state.moves.length, patched ? 1 : 0, JSON.stringify(state));
            assert.equal(state.parent, patched ? 'target' : 'parent');
            if (patched) assert.equal(state.quickbars, 0);
            else assert.ok(state.quickbars > 0, 'Legacy quickbar must reproduce swallowed pointerup');
            results.push({name: `${patched ? 'patched' : 'legacy'} native drag${fullscreen ? ' fullscreen' : ''}`, ...state});
        }
        await drag(false); await drag(true); await drag(true, true);
        await page.locator('[data-mindmap-id="target"] .list-mindmap__task').click();
        await page.locator('[data-mindmap-id="child"] .list-mindmap__content').dblclick({position: {x: 40, y: 12}});
        const events = await page.evaluate(() => window.nativeTest.state);
        assert.deepEqual(events.toggles, ['target']); assert.deepEqual(events.edits, ['child']);
        results.push({name: 'native checkbox and double-click edit callbacks', passed: true});
        await page.evaluate(() => window.nativeTest.destroy());
        assert.deepEqual(errors, [], 'Browser errors');
        console.log(JSON.stringify({scope: 'Real SiYuan 3.8.5 editor/model/view/drop sources in Chromium; lite fragment, kernel APIs and unrelated renderers stubbed. Not a live application test.', results}, null, 2));
    } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
