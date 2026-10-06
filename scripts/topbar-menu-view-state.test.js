'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const controls = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/45-render-shell-controls-and-resize.js'), 'utf8');
const switching = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/47-render-side-panels-and-view-switching.js'), 'utf8');
const slice = (source, start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, `missing runtime segment: ${start}`);
    return source.slice(from, to);
};

function fixture({ mobile = false, dock = false } = {}) {
    class Element {}
    class HTMLElement extends Element {}
    const menu = Object.assign(new HTMLElement(), { innerHTML: '' });
    const toolbar = Object.assign(new HTMLElement(), { innerHTML: '' });
    const stage = Object.assign(new HTMLElement(), { replaceWith() {} });
    const modal = Object.assign(new HTMLElement(), {
        isConnected: true,
        classList: { contains: () => false },
        querySelector: (selector) => ({ '#tmMobileMenu': menu, '.tm-main-stage': stage, '[data-tm-view-toolbar-extra="1"]': toolbar })[selector] || null,
        querySelectorAll: () => [stage],
        setAttribute() {},
    });
    const state = { viewMode: 'list', activeDocId: 'all', modal, aiSidebarOpen: false, aiMobilePanelOpen: false };
    const context = {
        state, Element, HTMLElement,
        SettingsStore: { data: {} },
        window: { matchMedia: () => ({ matches: false }) },
        document: { createElement: () => Object.assign(new HTMLElement(), { style: { setProperty() {} } }) },
        __TM_BODY_ONLY_VIEW_SWITCH_MODES: new Set(['list', 'checklist', 'kanban', 'whiteboard']),
        __tmIsMobileDevice: () => mobile,
        __tmIsRuntimeMobileClient: () => mobile,
        __tmIsDockHost: () => dock,
        __tmGetKanbanBoardMode: () => context.kanbanMode || 'heading',
        __tmGetWhiteboardAllTabsLayoutMode: () => context.whiteboardMode || 'stream',
        __tmNormalizeWhiteboardAllTabsLayoutMode: (value) => value,
        __tmBuildDocGroupMenuOptions: () => [],
        __tmBuildRuleMenuOptions: () => [],
        __tmBuildGroupModeMenuOptions: () => [],
        __tmIsAiFeatureEnabled: () => context.aiEnabled !== false,
        __tmGetEnabledViews: () => ['list', 'kanban', 'whiteboard'],
        __tmRenderViewSwitcherButtons: () => '<button>视图</button>',
        __tmRenderLucideIcon: () => '',
        __tmEscAttr: String, esc: String,
        __tmRenderTopbarSelect: ({ id, options }) => `<select id="${id}">${options.map(({ value, label, selected, action }) => `<option value="${value}"${selected ? ' selected' : ''} data-action="${action}">${label}</option>`).join('')}</select>`,
        __tmBuildRenderSceneContext: () => ({
            renderMode: state.viewMode, mainBodyHtml: '<div>任务视图</div>',
            showMobileBottomViewBar: true, showInlineDocGroupQuickSelect: mobile || dock,
            showWhiteboardAllTabsModeToggle: state.activeDocId === 'all', whiteboardAllTabsLayoutMode: 'stream',
        }),
        __tmPreparePersistentSideDockTransfers: () => [],
        __tmSyncCalendarTopbarActionForView: () => true,
        __tmBindBodyOnlyViewAfterSwitch: () => true,
    };
    for (const name of ['__tmCaptureBodyOnlyViewScroll', '__tmHideFloatingTooltip', '__tmClearKanbanDetailFloatingHandlers', '__tmCommitPersistentSideDockTransfers', '__tmReleaseDetachedViewStage', '__tmSyncBodyOnlyViewSwitcherButtons', '__tmSyncPersistentSideDocksAfterViewSwitch', '__tmRestoreBodyOnlyViewScroll']) context[name] = () => {};
    vm.createContext(context);
    vm.runInContext([
        slice(controls, '    function __tmBuildKanbanModeMenuOptions', '    let __desktopMenuUnstack'),
        slice(switching, '    function __tmAiUsesOverlayPanel', '    async function __tmMountAiSidebarHost'),
        slice(switching, '    function __tmRenderBodyOnlyViewToolbarExtra', '    function __tmSyncCalendarTopbarActionForView'),
        slice(switching, '    function __tmTrySwitchViewBodyInPlace', '    window.tmHandleCalendarViewButtonContextMenu'),
    ].join('\n'), context);
    return { context, state, menu, toolbar };
}

for (const host of [{ mobile: true }, { dock: true }]) {
    test(`${host.mobile ? 'mobile' : 'Dock'} menu follows consecutive in-place view switches`, () => {
        const { context, state, menu, toolbar } = fixture(host);
        let prev = 'list';
        for (const mode of ['kanban', 'whiteboard', 'list', 'kanban']) {
            state.viewMode = mode;
            assert.equal(context.__tmTrySwitchViewBodyInPlace(prev, mode), true);
            assert.equal(menu.innerHTML.includes('tmMobileKanbanModeSelect'), mode === 'kanban');
            assert.equal(menu.innerHTML.includes('tmMobileWhiteboardLayoutSelect'), mode === 'whiteboard');
            assert.equal(menu.innerHTML.includes('导出 Excel'), mode === 'list');
            assert.equal(toolbar.innerHTML.includes('tmTopbarKanbanModeSelect'), mode === 'kanban');
            assert.equal(toolbar.innerHTML.includes('tmTopbarWhiteboardLayoutSelect'), mode === 'whiteboard');
            assert.match(menu.innerHTML, /AI 工作台/);
            prev = mode;
        }
    });
}

test('whiteboard menu preserves selected layout and the single-document switch action', () => {
    const { context, state } = fixture({ dock: true });
    state.viewMode = 'whiteboard';
    let html = context.__tmRenderTopbarMenuContent({ mobile: true });
    assert.match(html, /value="stream" selected/);
    assert.match(html, /tmSetWhiteboardLayoutModeFromMobileMenu\('global'\)/);
    state.activeDocId = 'doc-1';
    html = context.__tmRenderTopbarMenuContent({ mobile: true });
    assert.match(html, /value="board" selected/);
    assert.match(html, /tmSetWhiteboardLayoutModeFromMobileMenu\('stream'\)/);
    assert.equal(context.__tmRenderBodyOnlyViewToolbarExtra('whiteboard', { showWhiteboardAllTabsModeToggle: false }), '');
});

test('mode selectors stay absent from unrelated views', () => {
    const { context } = fixture({ mobile: true });
    for (const viewMode of ['list', 'checklist', 'timeline', 'calendar', 'home', 'attachments']) {
        const html = context.__tmRenderTopbarMenuContent({ mobile: true, viewMode });
        assert.doesNotMatch(html, /tmMobileKanbanModeSelect|tmMobileWhiteboardLayoutSelect/);
    }
});

for (const host of [{}, { mobile: true }, { dock: true }]) {
    test(`AI button reflects the active panel in ${host.mobile ? 'mobile' : host.dock ? 'Dock' : 'desktop'}`, () => {
        const { context, state } = fixture(host);
        const overlay = host.mobile || host.dock;
        for (const open of [false, true, false]) {
            state.aiSidebarOpen = overlay ? !open : open;
            state.aiMobilePanelOpen = overlay ? open : !open;
            const html = context.__tmRenderTopbarMenuContent({ mobile: !!overlay });
            assert.ok(html.includes(`title="AI 工作台" aria-pressed="${open}"`));
        }
        context.aiEnabled = false;
        assert.doesNotMatch(context.__tmRenderTopbarMenuContent({ mobile: !!overlay }), /AI 工作台/);
    });
}
