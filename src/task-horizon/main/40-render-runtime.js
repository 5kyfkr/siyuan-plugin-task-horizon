    function render() {
        const __tmJankRenderStarted = (typeof __tmIsJankDebugEnabled === 'function' && __tmIsJankDebugEnabled() && typeof __tmJankNow === 'function')
            ? __tmJankNow()
            : 0;
        const __tmJankRenderFinish = (outcome = '', payload = {}) => {
            if (!__tmJankRenderStarted) return;
            try {
                const modal = state.modal instanceof Element ? state.modal : null;
                const entry = {
                    phase: 'direct-render',
                    outcome: String(outcome || '').trim() || 'complete',
                    mode: String(state.attachmentLibraryOpen ? 'attachments' : (state.homepageOpen ? 'home' : (state.viewMode || 'list'))).trim() || 'list',
                    durationMs: __tmRoundPerfMs(__tmJankNow() - __tmJankRenderStarted),
                    checklistItems: modal?.querySelectorAll?.('.tm-checklist-item')?.length || 0,
                    detailSubtasks: modal?.querySelectorAll?.('.tm-task-detail-subtask:not(.tm-task-detail-subtask--draft)')?.length || 0,
                    ...((payload && typeof payload === 'object') ? payload : {}),
                };
                state.__tmJankLastRender = { ...entry, at: Date.now() };
                __tmPushJankDebug('render-direct', entry);
            } catch (e) {}
        };
        try {
            const guardUntil = Number(state.__tmChecklistRenderGuardUntil || 0);
            const guardReason = String(state.__tmChecklistRenderGuardReason || '').trim();
            if (guardUntil && Date.now() < guardUntil && String(state.viewMode || '').trim() === 'checklist'
                && state.modal instanceof Element && document.body.contains(state.modal)) {
                state.__tmChecklistRenderGuardUntil = 0;
                state.__tmChecklistRenderGuardReason = '';
__tmJankRenderFinish('guard-skip', { guardReason });
return;
            }
            if (guardUntil && Date.now() >= guardUntil) {
                state.__tmChecklistRenderGuardUntil = 0;
                state.__tmChecklistRenderGuardReason = '';
            }
        } catch (e) {}
        try { __tmEnsureDocTabTouchDelegation(); } catch (e) {}
        try { __tmEnsureAllDocTabTouchDelegation(); } catch (e) {}
        try { __tmEnsureTopbarManagerIconTouchDelegation(); } catch (e) {}
        try { __tmEnsureDocTabsAutoHideTouchDelegation(); } catch (e) {}
        try { state.dockTaskPointerGestureCleanup?.(); } catch (e) {}
        try { state.multiSelectPointerGestureCleanup?.(); } catch (e) {}
        try { __tmCloseMultiSelectMoreMenu(); } catch (e) {}
        if (!__tmIsTomatoFocusModeEnabled()) {
            __tmClearTomatoFocusRowClasses();
        }
        const kind0 = String(state.uiAnimKind || '').trim();
        const isViewSwitchAnim = (kind0 === 'from-right' || kind0 === 'from-left')
            && (Date.now() - (Number(state.uiAnimTs) || 0) < 500);
        const isTimelineView = state.viewMode === 'timeline';
        if (!isTimelineView) __tmClearTimelineTodayIndicatorTimer();
        const useSoftSwap = isViewSwitchAnim;
        const currentRenderMode = state.attachmentLibraryOpen ? 'attachments' : (state.homepageOpen ? 'home' : (String(state.viewMode || 'list').trim() || 'list'));
        const isSnapshotFirstRenderFastPath = !!state.__tmSnapshotFirstRenderLimitMode;
        const deferSnapshotLayoutWork = (fn, delayMs = 0) => {
            if (typeof fn !== 'function') return false;
            const waitForInteraction = (typeof __tmGetHighPriorityInteractionWaitMs === 'function')
                ? __tmGetHighPriorityInteractionWaitMs(24)
                : 0;
            if (!isSnapshotFirstRenderFastPath && !(waitForInteraction > 0)) return false;
            const run = () => {
                const waitMs = (typeof __tmGetHighPriorityInteractionWaitMs === 'function')
                    ? __tmGetHighPriorityInteractionWaitMs(24)
                    : 0;
                if (waitMs > 0) {
                    try { setTimeout(run, waitMs); } catch (e) {}
                    return;
                }
                try { requestAnimationFrame(fn); } catch (e) { try { fn(); } catch (e2) {} }
            };
            const delay = Math.max(Number(waitForInteraction) || 0, Math.max(0, Number(delayMs) || 0));
            try { setTimeout(run, delay); } catch (e) { run(); }
            return true;
        };
        const runFlipAnimationAfterRender = () => {
            if (isSnapshotFirstRenderFastPath) return;
            try { __tmRunFlipAnimation(state.modal); } catch (e) {}
        };
        const rememberViewDomRenderSignature = () => {
            try {
                if (typeof __tmBuildCurrentViewDomRenderSignature !== 'function') return;
                const sig = __tmBuildCurrentViewDomRenderSignature(currentRenderMode);
                if (sig) state.listDomRenderSignature = sig;
            } catch (e) {}
        };
        let prevModalEl = null;
        const prevModalSnapshot = state.modal instanceof Element ? state.modal : null;
        const prevMountRoot = prevModalSnapshot?.parentElement instanceof Element ? prevModalSnapshot.parentElement : null;
        const nextMountRoot = __tmGetMountRoot();
        const useOverlaySoftSwap = !!(useSoftSwap
            && prevModalSnapshot
            && nextMountRoot instanceof HTMLElement
            && nextMountRoot !== document.body
            && !__tmIsRuntimeMobileClient()
            && (!__tmIsMobileDevice() || __tmIsDockHost()));
        const snapshotKind = prevMountRoot instanceof Element ? __tmGetKeepaliveSnapshotKind(prevMountRoot) : '';
        const keepMountSnapshot = !!(prevModalSnapshot && snapshotKind && prevMountRoot !== nextMountRoot);
        const prevWasTimeline = !!(prevModalSnapshot && prevModalSnapshot.querySelector && prevModalSnapshot.querySelector('#tmTimelineLeftBody'));
        const prevWasCalendar = !!(prevModalSnapshot && prevModalSnapshot.querySelector && prevModalSnapshot.querySelector('#tmCalendarRoot'));
        const prevWasKanban = !!(prevModalSnapshot && prevModalSnapshot.querySelector && prevModalSnapshot.querySelector('.tm-body.tm-body--kanban'));
        const prevWasWhiteboard = !!(prevModalSnapshot && prevModalSnapshot.querySelector && prevModalSnapshot.querySelector('.tm-body.tm-body--whiteboard'));
        const prevWasChecklist = !!(prevModalSnapshot && prevModalSnapshot.querySelector && prevModalSnapshot.querySelector('.tm-checklist-scroll'));
        const prevWasHomepage = !!(prevModalSnapshot && prevModalSnapshot.querySelector && prevModalSnapshot.querySelector('#tmHomepageRoot'));
        state.__tmHomepageNextMountAnimate = !(currentRenderMode === 'home' && prevWasHomepage);
        const __tmGetKanbanColScrollKey = (colEl) => {
            if (!(colEl instanceof Element)) return '';
            const status = String(colEl.getAttribute('data-status') || '').trim();
            if (status) return `status:${status}`;
            const kind = String(colEl.getAttribute('data-kind') || '').trim();
            const time = String(colEl.getAttribute('data-time') || '').trim();
            if (kind === 'time' || time) return `time:${time || kind}`;
            const doc = String(colEl.getAttribute('data-doc') || '').trim();
            const heading = String(colEl.getAttribute('data-heading') || '').trim();
            if (kind || doc || heading) return `kind:${kind}|doc:${doc}|heading:${heading}`;
            return '';
        };

        // 保存滚动位置
        let savedScrollTop = 0;
        let savedScrollLeft = 0;
        let savedChecklistDetailScrollSnapshot = null;
        let savedTimelineScrollTop = 0;
        let savedTimelineScrollLeft = 0;
        let savedCalendarScrollTop = 0;
        let savedCalendarScrollLeft = 0;
        let savedKanbanScrollLeft = 0;
        let savedKanbanColScrollTopByStatus = {};
        let savedKanbanDetailScrollSnapshot = null;
        let savedWhiteboardSidebarScrollTop = 0;
        let savedWhiteboardBodyScrollTop = 0;
        let savedWhiteboardBodyScrollLeft = 0;
        let savedHomepageScrollTop = 0;
        let savedHomepageScrollLeft = 0;
        let savedDocTabsScrollLeft = Number(state.docTabsScrollLeft) || 0;
        let savedDocTabsScrollTop = Number(state.docTabsScrollTop) || 0;
        if (prevModalSnapshot) {
            prevModalEl = prevModalSnapshot;
            const docTabsPane = prevModalSnapshot.querySelector('.tm-doc-tabs-scroll');
            if (docTabsPane) {
                savedDocTabsScrollLeft = Number(docTabsPane.scrollLeft) || 0;
                savedDocTabsScrollTop = Number(docTabsPane.scrollTop) || 0;
            }
            const timelineLeftBody = prevModalSnapshot.querySelector('#tmTimelineLeftBody');
            const ganttBody = prevModalSnapshot.querySelector('#tmGanttBody');
            const timelineScrollHost = __tmGetTimelineGlobalScrollHost(prevModalSnapshot);
            if (timelineScrollHost) {
                savedTimelineScrollTop = Number(timelineScrollHost.scrollTop) || 0;
                savedTimelineScrollLeft = Number(timelineScrollHost.scrollLeft) || 0;
            } else if (timelineLeftBody) {
                savedTimelineScrollTop = timelineLeftBody.scrollTop;
                if (ganttBody) savedTimelineScrollLeft = ganttBody.scrollLeft;
            } else if (prevWasKanban) {
                const kbBody = prevModalSnapshot.querySelector('.tm-body.tm-body--kanban');
                if (kbBody) savedKanbanScrollLeft = Number(kbBody.scrollLeft) || 0;
                savedKanbanDetailScrollSnapshot = __tmCaptureKanbanDetailScrollSnapshot(prevModalSnapshot);
                const map = {};
                try {
                    prevModalSnapshot.querySelectorAll('.tm-kanban-col').forEach((col) => {
                        const colKey = __tmGetKanbanColScrollKey(col);
                        if (!colKey) return;
                        const body = col.querySelector('.tm-kanban-col-body');
                        map[colKey] = Number(body?.scrollTop) || 0;
                    });
                } catch (e) {}
                savedKanbanColScrollTopByStatus = map;
            } else if (prevWasWhiteboard) {
                const sidebar = prevModalSnapshot.querySelector('.tm-whiteboard-sidebar');
                if (sidebar) savedWhiteboardSidebarScrollTop = Number(sidebar.scrollTop) || 0;
                const body = prevModalSnapshot.querySelector('#tmWhiteboardBody');
                if (body) {
                    savedWhiteboardBodyScrollTop = Number(body.scrollTop) || 0;
                    savedWhiteboardBodyScrollLeft = Number(body.scrollLeft) || 0;
                }
            } else if (prevWasCalendar) {
                try {
                    const root = prevModalSnapshot.querySelector('#tmCalendarRoot');
                    const preferred = root?.querySelector?.('.fc-timegrid-body .fc-scroller') || null;
                    const list = Array.from(root?.querySelectorAll?.('.fc-scroller') || []);
                    const scroller = (preferred && preferred.scrollHeight > preferred.clientHeight + 1)
                        ? preferred
                        : (list.find((el) => el && el.scrollHeight > el.clientHeight + 1) || preferred || list[0] || null);
                    if (scroller) {
                        savedCalendarScrollTop = scroller.scrollTop;
                        savedCalendarScrollLeft = scroller.scrollLeft;
                    }
                } catch (e) {}
            } else if (prevWasChecklist) {
                const pane = prevModalSnapshot.querySelector('.tm-checklist-scroll');
                if (pane) {
                    savedScrollTop = Number(pane.scrollTop) || 0;
                    savedScrollLeft = Number(pane.scrollLeft) || 0;
                }
                savedChecklistDetailScrollSnapshot = __tmCaptureChecklistDetailScrollSnapshot(prevModalSnapshot);
            } else if (prevWasHomepage) {
                const body = prevModalSnapshot.querySelector('.tm-body.tm-body--homepage');
                if (body) {
                    savedHomepageScrollTop = Number(body.scrollTop) || 0;
                    savedHomepageScrollLeft = Number(body.scrollLeft) || 0;
                }
            } else {
                const body = prevModalSnapshot.querySelector('.tm-body');
                if (body) {
                    savedScrollTop = body.scrollTop;
                    savedScrollLeft = body.scrollLeft;
                }
            }
        }
        try {
            state.viewScroll = state.viewScroll && typeof state.viewScroll === 'object' ? state.viewScroll : {};
            if (prevModalSnapshot) {
                if (prevWasTimeline) state.viewScroll.timeline = { top: Number(savedTimelineScrollTop) || 0, left: Number(savedTimelineScrollLeft) || 0 };
                else if (prevWasKanban) state.viewScroll.kanban = { left: Number(savedKanbanScrollLeft) || 0, cols: savedKanbanColScrollTopByStatus || {} };
                else if (prevWasWhiteboard) state.viewScroll.whiteboard = {
                    sidebarTop: Number(savedWhiteboardSidebarScrollTop) || 0,
                    top: Number(savedWhiteboardBodyScrollTop) || 0,
                    left: Number(savedWhiteboardBodyScrollLeft) || 0,
                };
                else if (prevWasCalendar) state.viewScroll.calendar = { top: Number(savedCalendarScrollTop) || 0, left: Number(savedCalendarScrollLeft) || 0 };
                else if (prevWasHomepage) state.viewScroll.home = { top: Number(savedHomepageScrollTop) || 0, left: Number(savedHomepageScrollLeft) || 0 };
                else state.viewScroll.list = { top: Number(savedScrollTop) || 0, left: Number(savedScrollLeft) || 0 };
            }
        } catch (e) {}

        if (prevModalSnapshot) {
            try {
                if (prevModalSnapshot.querySelector && prevModalSnapshot.querySelector('#tmCalendarRoot')) {
                    globalThis.__tmCalendar?.unmount?.();
                }
            } catch (e) {}
            if (!useSoftSwap) {
                if (keepMountSnapshot && prevMountRoot instanceof HTMLElement) {
                    try {
                        const snapshot = __tmCreateKeepaliveSnapshot(prevModalSnapshot, snapshotKind);
                        try { prevModalSnapshot.remove(); } catch (e2) {}
                        if (snapshot) {
                            try { __tmBindKeepaliveSnapshotRestore(snapshot, prevMountRoot); } catch (e2) {}
                            try { prevMountRoot.replaceChildren(snapshot); } catch (e2) {}
                        }
                    } catch (e) {
                        try { prevModalSnapshot.remove(); } catch (e2) {}
                    }
                } else {
                    try { prevModalSnapshot.remove(); } catch (e) {}
                }
                prevModalEl = null;
            } else {
                try { prevModalSnapshot.style.pointerEvents = 'none'; } catch (e) {}
                if (useOverlaySoftSwap) {
                    try {
                        if (window.getComputedStyle(nextMountRoot).position === 'static') {
                            nextMountRoot.style.position = 'relative';
                        }
                    } catch (e) {}
                    try { prevModalSnapshot.style.position = 'absolute'; } catch (e) {}
                    try { prevModalSnapshot.style.inset = '0'; } catch (e) {}
                    try { prevModalSnapshot.style.width = '100%'; } catch (e) {}
                    try { prevModalSnapshot.style.height = '100%'; } catch (e) {}
                    try { prevModalSnapshot.style.zIndex = '0'; } catch (e) {}
                }
            }
        }

        // 应用字体大小
        document.documentElement.style.setProperty('--tm-font-size', (__tmGetFontSize()) + 'px');
        try { __tmApplyRowHeightVars(); } catch (e) {}
        try { __tmApplyTaskWrapVars(); } catch (e) {}
        try { __tmApplyAppearanceThemeVars(); } catch (e) {}

        const { totalTasks, doneTasks, queryTime } = state.stats;
        const todoTasks = totalTasks - doneTasks;
        const filteredCount = state.filteredTasks.length;

        const currentRule = state.currentRule ?
            state.filterRules.find(r => r.id === state.currentRule) : null;

        const globalNewTaskDocId = String(SettingsStore.data.newTaskDocId || '').trim();
        const currentGroupId = SettingsStore.data.currentGroupId || 'all';
        const docsForTabs = __tmSortDocEntriesForTabs(state.taskTree || [], currentGroupId);
        const activeDocId = String(state.activeDocId || '').trim();
        const filteredDocIdSet = new Set((Array.isArray(state.filteredDocIdsForTabs) ? state.filteredDocIdsForTabs : []).map((id) => String(id || '').trim()).filter(Boolean));
        const docTabsArchiveMode = state.docTabsArchiveMode === true;
        const docTaskStateCache = new Map();
        const docTabsFilterRule = __tmGetArchiveModeFilterRule(currentRule, docTabsArchiveMode);
        const hasContentFilter = __tmHasActiveDocTabContentFilter(docTabsFilterRule);
        const visibleDocs = docsForTabs
            .filter((doc) => {
                const docId = String(doc?.id || '').trim();
                if (docId && activeDocId && activeDocId !== 'all' && docId === activeDocId) return true;
                const shouldShowByTaskState = __tmDocShouldShowInDocTabs(doc, { rule: currentRule, archiveMode: docTabsArchiveMode, docStateCache: docTaskStateCache });
                if (!shouldShowByTaskState) return false;
                if (filteredDocIdSet.size || hasContentFilter) return filteredDocIdSet.has(docId);
                return shouldShowByTaskState;
            })
            .filter(doc => !globalNewTaskDocId || doc.id !== globalNewTaskDocId);
        const docTabGroupedView = __tmBuildDocTabGroupedView(visibleDocs, { currentGroupId, activeDocId });
        const customTabGroups = Array.isArray(docTabGroupedView?.groups) ? docTabGroupedView.groups : [];
        const docTabsToRender = Array.isArray(docTabGroupedView?.normalDocs) ? docTabGroupedView.normalDocs : visibleDocs;
        const archivedDocCount = docsForTabs.filter((doc) => __tmGetDocTaskStateForTabs(doc, docTaskStateCache).isArchived).length;
        const showOtherBlocksTab = !docTabsArchiveMode && currentGroupId !== 'all' && Array.isArray(state.otherBlocks) && state.otherBlocks.length > 0;

        // 获取文档分组信息
        const docGroups = SettingsStore.data.docGroups || [];
        const currentGroup = docGroups.find(g => g.id === currentGroupId);
        const groupName = currentGroupId === 'all' ? '全部文档' : (currentGroup ? __tmResolveDocGroupName(currentGroup) : '未知分组');
        const hasTaskModeOption = !!(SettingsStore.data.groupByTaskName || state.groupByTaskName);
        const hostInfo = globalThis.__tmRuntimeHost?.getInfo?.() || null;
        const isMobile = __tmIsMobileDevice();
        const isRuntimeMobile = hostInfo?.runtimeMobileClient ?? __tmIsRuntimeMobileClient();
        const isDockHost = hostInfo?.isDockHost ?? __tmIsDockHost();
        const hostUsesMobileUI = hostInfo?.hostUsesMobileUI ?? __tmHostUsesMobileUI();
        const useCompactTopbarBrand = __tmShouldUseCompactTopbarBrand();
        const managerIconTooltip = '点击折叠/展开页签栏，右击或长按打开全部页签菜单';
        const isAnimatedDockHost = !!(isDockHost && !isRuntimeMobile);
        const docTabsCanMultirow = true;
        const docTabsCollapsed = !docTabsCanMultirow || state.docTabsCollapsed !== false;
        const docTabsAutoHide = SettingsStore.data.docTabsAutoHideEnabled === true;
        const docTabsHidden = docTabsAutoHide ? state.docTabsAutoVisible !== true : !!state.docTabsHidden;
        const docTabsClass = [
            docTabsHidden ? 'tm-doc-tabs--hidden' : '',
            docTabsAutoHide ? 'tm-doc-tabs--auto-hide' : '',
            docTabsAutoHide && docTabsHidden ? 'tm-doc-tabs--auto-hidden' : '',
            docTabsAutoHide && !docTabsHidden ? 'tm-doc-tabs--auto-visible' : '',
            docTabsCanMultirow ? 'tm-doc-tabs--multirow' : '',
            docTabsCollapsed ? 'tm-doc-tabs--collapsed' : 'tm-doc-tabs--expanded',
            docTabsArchiveMode ? 'tm-doc-tabs--archive-mode' : '',
            String(SettingsStore.data.docTabsArchiveButtonPosition || '').trim() === 'before-all' ? 'tm-doc-tabs--archive-before-all' : 'tm-doc-tabs--archive-after-docs',
        ].filter(Boolean).join(' ');
        const docTabsToggleTitle = docTabsCollapsed ? '展开多行文档页签' : '折叠为单行文档页签';
        const docTabsArchiveButtonPosition = String(SettingsStore.data.docTabsArchiveButtonPosition || '').trim() === 'before-all' ? 'before-all' : 'after-docs';
        const docTabsArchiveButtonHtml = `<div
                            class="tm-doc-tab tm-doc-tab--archive ${docTabsArchiveMode ? 'active' : ''}"
                            onclick="tmToggleDocTabsArchiveMode(event)"
                            onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();tmToggleDocTabsArchiveMode(event)}"
                            role="button"
                            tabindex="0"
                            aria-label="${docTabsArchiveMode ? '退出归档页签' : '查看归档页签'}"
                            aria-pressed="${docTabsArchiveMode ? 'true' : 'false'}"
                            ${__tmBuildTooltipAttrs(docTabsArchiveMode ? '退出归档页签' : `查看归档页签${archivedDocCount ? ` (${archivedDocCount})` : ''}`, { side: 'bottom', ariaLabel: false })}>
                            ${__tmRenderLucideIcon('archive', '', { size: 14 })}
                        </div>`;
        const isSplitPane = false; // 使用CSS容器查询处理分屏模式
        const isLandscape = !!(isMobile && (() => { try { return !!window.matchMedia?.('(orientation: landscape)')?.matches; } catch (e) { return false; } })());
        const isDesktopNarrow = !!(!isMobile && (() => { try { return !!window.matchMedia?.('(max-width: 768px)')?.matches; } catch (e) { return false; } })());
        const kind = String(state.uiAnimKind || '').trim();
        const hasFreshUiAnim = (Date.now() - (Number(state.uiAnimTs) || 0) < 390);
        const bodyAnimClass = '';
        const stageAnimClass = ((!isMobile && !hostUsesMobileUI) && hasFreshUiAnim)
            ? (kind === 'from-right' ? ' tm-stage-anim--from-right' : kind === 'from-left' ? ' tm-stage-anim--from-left' : ' tm-stage-anim')
            : '';
        const tableFillColumns = SettingsStore.data.kanbanFillColumns === true;
        const tableAvailableWidth = tableFillColumns ? (() => {
            const values = [];
            try {
                const prevBody = prevModalSnapshot?.querySelector?.('.tm-body:not(.tm-body--timeline)');
                if (prevBody) values.push(Number(prevBody.clientWidth) || 0);
            } catch (e) {}
            try {
                if (nextMountRoot instanceof Element && nextMountRoot !== document.body && nextMountRoot !== document.documentElement) {
                    values.push(Number(nextMountRoot.clientWidth) || 0);
                }
            } catch (e) {}
            try {
                const vw = Number(window.innerWidth || document.documentElement?.clientWidth || 0);
                if (vw > 0) values.push(Math.max(0, vw - (isMobile ? 24 : 48)));
            } catch (e) {}
            return values.find((n) => Number.isFinite(n) && n > 0) || 0;
        })() : 0;
        state.tableAvailableWidth = tableAvailableWidth;
        const calendarSidebarHostWidth = (() => {
            try {
                if (nextMountRoot instanceof HTMLElement && nextMountRoot !== document.body && nextMountRoot !== document.documentElement) {
                    const rect = nextMountRoot.getBoundingClientRect();
                    const width = Number(rect?.width) || Number(nextMountRoot.clientWidth) || 0;
                    if (width > 0) return width;
                }
            } catch (e) {}
            try {
                return Number(window.innerWidth || document.documentElement?.clientWidth || 0) || 0;
            } catch (e) {}
            return 0;
        })();
        const isCalendarSidebarNarrowHost = calendarSidebarHostWidth > 0 && calendarSidebarHostWidth <= 768;

        state.modal = document.createElement('div');
        state.modal.className = 'tm-modal'
            + (__tmMountEl ? ' tm-modal--tab' : '')
            + (isMobile ? ' tm-modal--mobile' : '')
            + (isRuntimeMobile ? ' tm-modal--runtime-mobile' : '')
            + (hostUsesMobileUI ? ' tm-modal--host-mobile-ui' : '')
            + (isSplitPane ? ' tm-modal--split-pane' : '')
            + (isDockHost ? ' tm-modal--dock' : '')
            + (docTabsAutoHide ? ' tm-modal--doc-tabs-auto-hide' : '')
            + (docTabsAutoHide && docTabsHidden ? ' tm-modal--doc-tabs-auto-hidden' : '')
            + (docTabsAutoHide && !docTabsHidden ? ' tm-modal--doc-tabs-auto-visible' : '');
        try { state.modal.setAttribute('data-task-horizon-shell', '1'); } catch (e) {}
        try {
            const wrapCfg = __tmGetWrapConfig();
            state.modal.classList.toggle('tm-modal--task-wrap', !!wrapCfg.enabled);
            state.modal.style.setProperty('--tm-task-content-wrap-lines', String(wrapCfg.contentLines));
            state.modal.style.setProperty('--tm-task-remark-wrap-lines', String(wrapCfg.remarkLines));
            __tmApplyMobileBrowserViewportMetrics(state.modal);
        } catch (e) {}
        if (useSoftSwap && prevModalEl) {
            try { state.modal.style.pointerEvents = 'none'; } catch (e) {}
            if (useOverlaySoftSwap) {
                try {
                    if (window.getComputedStyle(nextMountRoot).position === 'static') {
                        nextMountRoot.style.position = 'relative';
                    }
                } catch (e) {}
                try { state.modal.style.position = 'absolute'; } catch (e) {}
                try { state.modal.style.inset = '0'; } catch (e) {}
                try { state.modal.style.width = '100%'; } catch (e) {}
                try { state.modal.style.height = '100%'; } catch (e) {}
                try { state.modal.style.zIndex = '1'; } catch (e) {}
            }
        }

        // 构建规则选择选项
        const ruleOptions = state.filterRules
            .filter(rule => rule.enabled)
            .map(rule => `<option value="${rule.id}" ${state.currentRule === rule.id ? 'selected' : ''}>
                ${esc(rule.name)}
            </option>`)
            .join('');
        const docGroupMenuOptions = [
            {
                value: 'all',
                label: '全部文档',
                selected: currentGroupId === 'all',
                action: `tmSwitchDocGroup('all')`
            },
            ...docGroups.map((group) => ({
                value: String(group?.id || '').trim(),
                label: __tmResolveDocGroupName(group),
                selected: currentGroupId === String(group?.id || '').trim(),
                action: `tmSwitchDocGroup('${escSq(String(group?.id || '').trim())}')`
            }))
        ];
        const ruleMenuOptions = [
            {
                value: '',
                label: '全部',
                selected: !state.currentRule,
                action: `applyFilterRule('')`
            },
            ...state.filterRules
                .filter((rule) => rule.enabled)
                .map((rule) => ({
                    value: String(rule?.id || '').trim(),
                    label: String(rule?.name || '').trim() || '未命名规则',
                    selected: state.currentRule === rule.id,
                    action: `applyFilterRule('${escSq(String(rule?.id || '').trim())}')`
                }))
        ];
        const groupModeMenuOptions = [
            {
                value: 'none',
                label: '不分组',
                selected: (!state.groupByDocName && !state.groupByTaskName && !state.groupByTime && !state.quadrantEnabled),
                action: `tmSwitchGroupMode('none')`
            },
            {
                value: 'doc',
                label: '按文档',
                selected: state.groupByDocName,
                action: `tmSwitchGroupMode('doc')`
            },
            {
                value: 'time',
                label: '按时间',
                selected: state.groupByTime,
                action: `tmSwitchGroupMode('time')`
            },
            {
                value: 'quadrant',
                label: '四象限',
                selected: state.quadrantEnabled,
                action: `tmSwitchGroupMode('quadrant')`
            },
            ...(hasTaskModeOption ? [{
                value: 'task',
                label: '按任务名',
                selected: state.groupByTaskName,
                action: `tmSwitchGroupMode('task')`
            }] : [])
        ];
        const kanbanBoardMode = __tmGetKanbanBoardMode();
        const kanbanModeMenuOptions = [
            {
                value: 'status',
                label: '状态',
                selected: kanbanBoardMode === 'status',
                action: `tmSetKanbanBoardMode('status')`
            },
            {
                value: 'heading',
                label: '标题',
                selected: kanbanBoardMode === 'heading',
                action: `tmSetKanbanBoardMode('heading')`
            },
            {
                value: 'time',
                label: '时间',
                selected: kanbanBoardMode === 'time',
                action: `tmSetKanbanBoardMode('time')`
            }
        ];

        const {
            renderMode,
            mainBodyHtml,
            showCalendarSideDock,
            showAiSideDock,
            calendarSideDockWidth,
            aiSideDockWidth,
            showTaskDetailSheet,
            taskDetailSheetTaskId,
            taskDetailSheetTask,
            taskDetailSheetHtml,
            showMobileBottomViewBar,
            mobileBottomViewbarActive,
            mobileBottomViewbarSwitching,
            useCompactTopbar,
            topbarPadding,
            topbarHeightStyle,
            whiteboardActiveDocId,
            showWhiteboardAllTabsModeToggle,
            whiteboardAllTabsLayoutMode,
            showWhiteboardMobileLayoutModeToggle,
            whiteboardMobileMenuLayoutMode,
            showInlineDocGroupQuickSelect,
            showAdaptiveTabDocGroupQuickSelect,
            showMobileTimelineFloatingToolbar,
            showDockTimelineFloatingToolbar,
            showTimelineFloatingToolbar,
            showMobileLandscapeTimelineTopbar,
            showDesktopNarrowTimelineTopbar,
            showTopbarTimelineToolbar,
            topbarAddBtnHtml,
            timelineSidebarToggleLabel,
            timelineSidebarToggleButtonHtml,
            timelineInlineToolbarButtonsHtml,
            timelineCompactToolbarButtonsHtml,
            timelineInlineToolbarGroupHtml,
            timelineCompactToolbarGroupHtml,
            timelineFloatingToolbarHtml,
            timelineRowModel,
            mainStageBottomInset,
            bodyWithSideDockHtml,
            multiSelectCount,
            showMultiSelectBar,
            multiSelectBarBottom,
            multiSelectActionDisabledAttr,
            multiSelectBarHtml,
        } = __tmBuildRenderSceneContext({
            bodyAnimClass,
            tableAvailableWidth,
            isMobile,
            isDockHost,
            isRuntimeMobile,
            isLandscape,
            isDesktopNarrow,
            mountEl: __tmMountEl,
        });
        const showCalendarSidebarMobileTopbarToggle = !!(renderMode === 'calendar' && (isMobile || isRuntimeMobile || hostUsesMobileUI));
        const showCalendarSidebarCompactToggle = !!(renderMode === 'calendar'
            && !showCalendarSidebarMobileTopbarToggle
            && (isDockHost || isDesktopNarrow || isCalendarSidebarNarrowHost));
        const showCalendarSidebarDesktopToolbarToggle = !!(renderMode === 'calendar'
            && !showCalendarSidebarMobileTopbarToggle
            && !showCalendarSidebarCompactToggle);
        const calendarSidebarCompactButtonHtml = `<button class="tm-btn tm-btn-info tm-calendar-sidebar-toggle-compact tm-calendar-sidebar-toggle-compact--visible bc-btn bc-btn--sm" onclick="tmCalendarToggleSidebar()" style="padding: 0; width: 30px; min-width: 30px; height: 30px; align-items: center; justify-content: center;"${__tmBuildTooltipAttrs('日历侧边栏', { side: 'bottom' })}>${__tmRenderLucideIcon('calendar-days')}</button>`;
        const parentTaskNameBoldClass = SettingsStore.data.parentTaskNameBoldEnabled === false ? ' tm-box--parent-task-name-normal' : '';
        try {
            if (state.modal instanceof HTMLElement) {
                state.modal.classList.toggle('tm-modal--mobile-view-switching', mobileBottomViewbarSwitching);
            }
        } catch (e) {}
        state.modal.innerHTML = `
            <div class="tm-box${showCalendarSideDock || showAiSideDock ? ' tm-box--with-cal-dock' : ''}${parentTaskNameBoldClass}">
                <div class="tm-filter-rule-bar" style="padding: ${topbarPadding};${topbarHeightStyle}">
                        <div class="tm-topbar-row tm-topbar-row--main" style="display:flex;align-items:center;gap:10px;flex-wrap:nowrap;justify-content:space-between;min-width:0;">
                        <div class="tm-topbar-row tm-topbar-row--brand" style="display:flex;align-items:center;gap:10px;min-width:0;">
                            <div class="tm-title" style="font-size: 16px; font-weight: 700; white-space: nowrap; display:inline-flex; align-items:center; gap:4px;">
                                <button
                                    type="button"
                                    class="tm-manager-brand-icon"
                                    data-tm-all-doc-menu-trigger="1"
                                    onclick="tmHandleManagerIconClick(event)"
                                    oncontextmenu="return tmHandleManagerIconContextMenu(event)"
                                    onmousedown="tmTopbarManagerIconPressStart(event)"
                                    onmousemove="tmTopbarManagerIconPressMove(event)"
                                    onmouseup="tmTopbarManagerIconPressEnd(event)"
                                    onmouseleave="tmTopbarManagerIconPressEnd(event)"
                                    ${__tmBuildTooltipAttrs(managerIconTooltip, { side: 'bottom' })}
                                >${__tmRenderTaskHorizonTopbarIcon(16)}</button>
                                ${`<button type="button" class="tm-btn tm-btn-info tm-homepage-entry-btn bc-btn bc-btn--sm ${state.homepageOpen ? 'is-active' : ''}" onclick="tmToggleHomepage(event)" style="padding: 0; width: 30px; min-width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center;"${__tmBuildTooltipAttrs(state.homepageOpen ? '返回工作区' : '主页总览', { side: 'bottom' })}>${__tmRenderHomepageEntryIcon(15)}</button>`}
                                ${useCompactTopbarBrand ? '' : `<span class="tm-manager-title-label" onclick="tmHandleManagerTitleClick(event)">任务管理器</span>`}
                            </div>
                            ${showInlineDocGroupQuickSelect || showAdaptiveTabDocGroupQuickSelect ? __tmRenderTopbarSelect({
                                id: 'tmTopbarDocQuickSelect',
                                label: '文档',
                                options: docGroupMenuOptions,
                                className: `tm-topbar-doc-quick-select${showAdaptiveTabDocGroupQuickSelect ? ' tm-topbar-doc-quick-select--tab-adaptive' : ''}`,
                                tooltip: '切换文档分组'
                            }) : ''}
                            ${showCalendarSidebarMobileTopbarToggle ? calendarSidebarCompactButtonHtml : ''}
                            ${isMobile && renderMode === 'timeline' ? timelineSidebarToggleButtonHtml : ''}
                            ${showDesktopNarrowTimelineTopbar ? timelineInlineToolbarGroupHtml : ''}
                        </div>

                        <!-- 桌面端工具栏 -->
                        <div class="tm-desktop-toolbar tm-header-selectors" style="display:${isMobile ? 'none' : 'flex'};align-items:center;gap:8px;flex:1;min-width:0;">
                            ${showInlineDocGroupQuickSelect ? '' : `
                            <div class="tm-rule-selector" style="margin-left: 6px;">
                                <span class="tm-rule-label bc-field__label">文档:</span>
                                ${__tmRenderTopbarSelect({ id: 'tmTopbarDocSelect', label: '文档', options: docGroupMenuOptions })}
                            </div>
                            `}

                            <div class="tm-rule-selector">
                                <span class="tm-rule-label bc-field__label">规则:</span>
                                ${__tmRenderTopbarSelect({ id: 'tmTopbarRuleSelect', label: '规则', options: ruleMenuOptions })}
                            </div>
                            ${currentRule ? `<div class="tm-rule-display"><span class="tm-rule-stats">${filteredCount} 个任务</span></div>` : ''}
                            <div class="tm-rule-selector">
                                <span class="tm-rule-label bc-field__label">分组:</span>
                                ${__tmRenderTopbarSelect({ id: 'tmTopbarGroupModeSelect', label: '分组', options: groupModeMenuOptions })}
                            </div>

                        </div>

                        <div class="tm-topbar-right">
                            ${!isMobile ? `
                            <div class="tm-compact-topbar-actions">
                                ${topbarAddBtnHtml}
                                <button class="tm-btn tm-btn-info tm-compact-topbar-action tm-compact-topbar-action--refresh bc-btn bc-btn--sm" onclick="tmRefresh()" style="padding: 0; width: 30px; min-width: 30px; height: 30px; align-items: center; justify-content: center;"${__tmBuildTooltipAttrs('刷新', { side: 'bottom' })}>${__tmRenderLucideIcon('arrow-clockwise')}</button>
                                <button class="tm-btn tm-btn-info tm-compact-topbar-action tm-compact-topbar-action--settings bc-btn bc-btn--sm" onclick="showSettings()" style="padding: 0; width: 30px; min-width: 30px; height: 30px; align-items: center; justify-content: center;"${__tmBuildTooltipAttrs('设置', { side: 'bottom' })}>${__tmRenderLucideIcon('settings')}</button>
                            </div>
                            ` : ''}
                            ${!isMobile && renderMode === 'timeline' && !showDesktopNarrowTimelineTopbar && !showTopbarTimelineToolbar ? timelineSidebarToggleButtonHtml : ''}
                            ${showCalendarSidebarCompactToggle ? calendarSidebarCompactButtonHtml : ''}

                        <!-- 移动端菜单按钮 -->
                            <div class="tm-mobile-menu-btn" style="display:${isMobile ? 'flex' : 'none'};">
                            <div style="display:flex;align-items:center;gap:${showMobileLandscapeTimelineTopbar ? '6px' : '10px'};">
                                ${showMobileLandscapeTimelineTopbar ? timelineCompactToolbarButtonsHtml : ''}
                                ${isMobile ? topbarAddBtnHtml : ''}
                                ${isMobile ? `<button class="tm-btn tm-btn-info bc-btn bc-btn--sm" onclick="tmRefresh()" style="padding: 0; width: 30px; min-width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center;"${__tmBuildTooltipAttrs('刷新', { side: 'bottom' })}>${__tmRenderLucideIcon('arrow-clockwise')}</button>` : ''}
                                ${!isMobile ? `
                                ` : ''}<button class="tm-btn tm-btn-info bc-btn bc-btn--sm" onclick="tmToggleMobileMenu(event)" ontouchend="tmToggleMobileMenu(event)" style="padding: 0; width: 30px; min-width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center;"${__tmBuildTooltipAttrs('菜单', { side: 'bottom' })}>
                                    ${__tmRenderLucideIcon('menu')}
                                </button>
                                ${isMobile && !isDockHost ? `<button class="tm-btn tm-btn-gray bc-btn bc-btn--sm bc-btn--ghost" onclick="tmClose(event)" ontouchend="tmClose(event)" style="padding: 0 10px; height: 30px; display: inline-flex; align-items: center; justify-content: center;"${__tmBuildTooltipAttrs('关闭', { side: 'bottom' })}>${__tmRenderLucideIcon('x')}</button>` : ''}
                            </div>
                        </div>
                        </div>
                    </div>

                    <!-- 桌面端搜索栏 -->
                    <div class="tm-search-box tm-desktop-toolbar" style="display:${isMobile ? 'none' : 'flex'}; flex-wrap: nowrap;">
                        ${renderMode === 'kanban' ? `
                            ${__tmRenderTopbarSelect({ id: 'tmTopbarKanbanModeSelect', label: '看板模式', options: kanbanModeMenuOptions, className: 'tm-kanban-mode-select tm-topbar-select--narrow', tooltip: '切换看板模式' })}
                        ` : showWhiteboardAllTabsModeToggle ? `
                            <div class="tm-view-segmented tm-kanban-mode-segmented bc-tabs-list" role="tablist" aria-label="白板模式">
                                <button class="tm-view-seg-item bc-tabs-trigger ${whiteboardAllTabsLayoutMode !== 'stream' ? 'tm-view-seg-item--active' : ''}" data-state="${whiteboardAllTabsLayoutMode !== 'stream' ? 'active' : 'inactive'}" onclick="tmSetWhiteboardAllTabsLayoutMode('board', event)" role="tab" aria-selected="${whiteboardAllTabsLayoutMode !== 'stream' ? 'true' : 'false'}"${__tmBuildTooltipAttrs('白板', { side: 'bottom', ariaLabel: false })}>白板</button>
                                <button class="tm-view-seg-item bc-tabs-trigger ${whiteboardAllTabsLayoutMode === 'stream' ? 'tm-view-seg-item--active' : ''}" data-state="${whiteboardAllTabsLayoutMode === 'stream' ? 'active' : 'inactive'}" onclick="tmSetWhiteboardAllTabsLayoutMode('stream', event)" role="tab" aria-selected="${whiteboardAllTabsLayoutMode === 'stream' ? 'true' : 'false'}"${__tmBuildTooltipAttrs('卡片流', { side: 'bottom', ariaLabel: false })}>卡片流</button>
                            </div>
                        ` : ''}
                        ${showTopbarTimelineToolbar ? `
                            ${timelineCompactToolbarGroupHtml}
                        ` : ''}
                        ${showCalendarSidebarDesktopToolbarToggle ? `<button class="tm-btn tm-btn-info bc-btn bc-btn--sm" onclick="tmCalendarToggleSidebar()" style="padding: 0; width: 30px; min-width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center;"${__tmBuildTooltipAttrs('日历侧边栏', { side: 'bottom' })}>${__tmRenderLucideIcon('calendar-days')}</button>` : ''}
                        ${!showMobileBottomViewBar ? `
                        <div class="tm-view-segmented bc-tabs-list" role="tablist" aria-label="视图">
                            ${__tmRenderViewSwitcherButtons()}
                        </div>
                        ` : ''}
                        ${topbarAddBtnHtml}
                        <button class="tm-btn tm-btn-info bc-btn bc-btn--sm" onclick="tmRefresh()" style="padding: 0; width: 30px; min-width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center;"${__tmBuildTooltipAttrs('刷新', { side: 'bottom' })}>${__tmRenderLucideIcon('arrow-clockwise')}</button>
                        ${__tmIsAiFeatureEnabled() ? `<button class="tm-btn tm-btn-info bc-btn bc-btn--sm" onclick="tmToggleAiSidebar()" style="padding: 0; width: 30px; min-width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center;"${__tmBuildTooltipAttrs(state.aiSidebarOpen ? '收起 AI 工作台' : '展开 AI 工作台', { side: 'bottom' })}>${__tmRenderLucideIcon('bot')}</button>` : ''}
                        <button class="tm-btn tm-btn-info bc-btn bc-btn--sm" onclick="showSettings()" style="padding: 0; width: 30px; min-width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center;"${__tmBuildTooltipAttrs('设置', { side: 'bottom' })}>${__tmRenderLucideIcon('settings')}</button>
                        ${!false ? `
                            <button class="tm-btn tm-btn-info tm-desktop-menu-btn bc-btn bc-btn--sm" onclick="tmToggleDesktopMenu(event)" style="padding: 0; width: 30px; min-width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center;"${__tmBuildTooltipAttrs('菜单', { side: 'bottom' })}>
                                ${__tmRenderLucideIcon('menu')}
                            </button>
                        ` : ''}
                    </div>

                        <!-- 移动端下拉菜单 -->
                        <div id="tmMobileMenu" style="display:none; position:absolute; right:0; top:45px; width:max-content; max-width:min(420px, calc(100% - 8px)); min-width:0; box-sizing:border-box; padding:10px; border:1px solid var(--tm-border-color); border-radius:6px; background:var(--tm-header-bg); z-index:10001; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                            <div style="display:flex; flex-direction:column; gap:10px;">
                                <div class="tm-mobile-only-item" style="display:flex; flex-direction:column; gap:6px; align-items:stretch;">
                                    <span style="color:var(--tm-text-color);">视图:</span>
                                    <div class="tm-mobile-view-switcher-wrap">
                                        <div class="tm-view-segmented bc-tabs-list tm-mobile-view-switcher" role="tablist" aria-label="视图">
                                            ${__tmRenderViewSwitcherButtons({ compact: true })}
                                        </div>
                                    </div>
                                </div>
                                ${renderMode === 'kanban' ? `
                                <div class="tm-mobile-only-item tm-mobile-menu-row" style="display:flex; gap:10px; align-items:center;">
                                    <span class="tm-mobile-menu-label" style="color:var(--tm-text-color);width:60px;">看板:</span>
                                    ${__tmRenderTopbarSelect({ id: 'tmMobileKanbanModeSelect', label: '看板模式', options: kanbanModeMenuOptions, style: 'flex:1;' })}
                                </div>
                                ` : ''}
                                ${showWhiteboardMobileLayoutModeToggle ? `
                                <div class="tm-mobile-only-item" style="display:flex; flex-direction:column; gap:6px; align-items:stretch;">
                                    <span style="color:var(--tm-text-color);">白板模式${showWhiteboardAllTabsModeToggle ? '' : '（切到全部页签）'}:</span>
                                    <div class="tm-view-segmented tm-kanban-mode-segmented bc-tabs-list" role="tablist" aria-label="白板模式" style="width:100%;">
                                        <button class="tm-view-seg-item bc-tabs-trigger ${whiteboardMobileMenuLayoutMode !== 'stream' ? 'tm-view-seg-item--active' : ''}" data-state="${whiteboardMobileMenuLayoutMode !== 'stream' ? 'active' : 'inactive'}" onclick="tmSetWhiteboardLayoutModeFromMobileMenu('board', event)" role="tab" aria-selected="${whiteboardMobileMenuLayoutMode !== 'stream' ? 'true' : 'false'}" style="flex:1;line-height:30px;">白板</button>
                                        <button class="tm-view-seg-item bc-tabs-trigger ${whiteboardMobileMenuLayoutMode === 'stream' ? 'tm-view-seg-item--active' : ''}" data-state="${whiteboardMobileMenuLayoutMode === 'stream' ? 'active' : 'inactive'}" onclick="tmSetWhiteboardLayoutModeFromMobileMenu('stream', event)" role="tab" aria-selected="${whiteboardMobileMenuLayoutMode === 'stream' ? 'true' : 'false'}" style="flex:1;line-height:30px;">卡片流</button>
                                    </div>
                                </div>
                                ` : ''}
                                ${showInlineDocGroupQuickSelect ? '' : `<div class="tm-mobile-only-item tm-mobile-menu-row" style="display:flex; gap:10px; align-items:center;">
                                    <span class="tm-mobile-menu-label" style="color:var(--tm-text-color);width:60px;">文档:</span>
                                    ${__tmRenderTopbarSelect({ id: 'tmMobileDocSelect', label: '文档', options: docGroupMenuOptions, style: 'flex:1;' })}
                                </div>`}
                                <div class="tm-mobile-only-item tm-mobile-menu-row" style="display:flex; gap:10px; align-items:center;">
                                    <span class="tm-mobile-menu-label" style="color:var(--tm-text-color);width:60px;">规则:</span>
                                    ${__tmRenderTopbarSelect({ id: 'tmMobileRuleSelect', label: '规则', options: ruleMenuOptions, style: 'flex:1;' })}
                                </div>
                                <div class="tm-mobile-only-item tm-mobile-menu-row" style="display:flex; gap:10px; align-items:center;">
                                    <span class="tm-mobile-menu-label" style="color:var(--tm-text-color);width:60px;">分组:</span>
                                    ${__tmRenderTopbarSelect({ id: 'tmMobileGroupModeSelect', label: '分组', options: groupModeMenuOptions, style: 'flex:1;' })}
                                </div>
                                <div style="display:flex; gap:10px; align-items:center;">
                                    <button class="tm-btn tm-btn-info bc-btn bc-btn--sm" onclick="tmShowSearchModal()" style="flex:1; padding: 6px;">
                                        <span style="display:inline-flex;align-items:center;gap:6px;">${__tmRenderLucideIcon('search')}<span>搜索 ${state.searchKeyword ? `(${state.searchKeyword})` : ''}</span></span>
                                    </button>
                                </div>
                                <div class="tm-mobile-only-item" style="display:flex; gap:10px; align-items:center;">
                                    <button class="tm-btn tm-btn-info bc-btn bc-btn--sm" onclick="tmShowSummaryModal(); tmHideMobileMenu();" style="flex:1; padding: 6px;">
                                        <span style="display:inline-flex;align-items:center;gap:6px;">${__tmRenderLucideIcon('file-text')}<span>摘要</span></span>
                                    </button>
                                </div>
                                <div class="tm-mobile-only-item" style="display:flex; gap:10px; align-items:center;">
                                    <button class="tm-btn tm-btn-info bc-btn bc-btn--sm" onclick="tmToggleAttachmentLibrary(); tmHideMobileMenu();" style="flex:1; padding: 8px; min-height:44px;">
                                        <span style="display:inline-flex;align-items:center;gap:6px;">${__tmRenderLucideIcon('paperclip')}<span>${state.attachmentLibraryOpen ? '返回工作区' : '附件库'}</span></span>
                                    </button>
                                </div>
                                ${renderMode === 'list' ? `
                                <div class="tm-mobile-only-item" style="display:flex; gap:10px; align-items:center;">
                                    <button class="tm-btn tm-btn-info bc-btn bc-btn--sm" onclick="tmExportCurrentTableExcel(); tmHideMobileMenu();" style="flex:1; padding: 6px;">
                                        <span style="display:inline-flex;align-items:center;gap:6px;">${__tmRenderLucideIcon('chart-column')}<span>导出 Excel</span></span>
                                    </button>
                                </div>
                                ` : ''}
                                <div class="tm-mobile-only-item" style="display:flex; gap:10px; align-items:center;">
                                    <div class="tm-btn tm-btn-info bc-btn bc-btn--sm" style="flex:1; padding: 6px 10px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
                                        <span>多选模式</span>
                                        <input class="b3-switch fn__flex-center" type="checkbox" ${state.multiSelectModeEnabled ? 'checked' : ''} onchange="tmToggleMultiSelectMode(this.checked); tmHideMobileMenu();">
                                    </div>
                                </div>
                                <div class="tm-mobile-only-item" style="display:flex; gap:10px; align-items:center;">
                                    <div class="tm-btn tm-btn-info bc-btn bc-btn--sm" style="flex:1; padding: 6px 10px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
                                        <span>显示已完成任务</span>
                                        <input class="b3-switch fn__flex-center" type="checkbox" ${state.showCompletedTasks ? 'checked' : ''} onchange="tmToggleShowCompletedTasks(this.checked); tmHideMobileMenu();">
                                    </div>
                                </div>
                                <div class="tm-mobile-only-item" style="display:flex; gap:10px; align-items:center;">
                                    <div class="tm-btn tm-btn-info bc-btn bc-btn--sm" style="flex:1; padding: 6px 10px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
                                        <span>已完成任务不分组</span>
                                        <input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.completedTasksInlineInGroups ? 'checked' : ''} onchange="tmToggleCompletedTasksInlineInGroups(this.checked); tmHideMobileMenu();">
                                    </div>
                                </div>
                                ${__tmIsAiFeatureEnabled() ? `
                                <div class="tm-mobile-only-item" style="display:flex; gap:10px; align-items:center;">
                                    <div class="tm-btn tm-btn-info bc-btn bc-btn--sm" style="flex:1; padding: 6px 10px; display:flex; align-items:center; justify-content:space-between; gap:10px; opacity:.6; cursor:not-allowed;" title="移动端不启用 AI 对话侧栏" aria-disabled="true">
                                        <span>AI 对话（移动端关闭）</span>
                                        <input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.aiSideDockEnabled ? 'checked' : ''} disabled>
                                    </div>
                                </div>
                                ` : ''}
                                <div class="tm-mobile-only-item" style="display:flex; gap:10px; align-items:center;">
                                    <div class="tm-btn tm-btn-info bc-btn bc-btn--sm" style="flex:1; padding: 6px 10px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
                                        <span>白板顺序模式</span>
                                        <input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.whiteboardSequenceMode ? 'checked' : ''} onchange="tmToggleWhiteboardSequenceMode(this.checked); tmHideMobileMenu();">
                                    </div>
                                </div>
                                <div class="tm-mobile-only-item" style="display:flex; gap:10px;">
                                     <button class="tm-btn tm-btn-info bc-btn bc-btn--sm" onclick="showSettings()" style="flex:1; padding: 6px;">
                                        <span style="display:inline-flex;align-items:center;gap:6px;">${__tmRenderLucideIcon('settings')}<span>设置</span></span>
                                     </button>
                                </div>
                                <div class="tm-mobile-only-item" style="display:flex; gap:10px;">
                                     <button class="tm-btn tm-btn-info bc-btn bc-btn--sm" onclick="tmCollapseAllTasks()" style="flex:1; padding: 6px;"><span style="display:inline-flex;align-items:center;gap:6px;">${__tmRenderLucideIcon('chevrons-down-up')}<span>折叠</span></span></button>
                                     <button class="tm-btn tm-btn-info bc-btn bc-btn--sm" onclick="tmExpandAllTasks()" style="flex:1; padding: 6px;"><span style="display:inline-flex;align-items:center;gap:6px;">${__tmRenderLucideIcon('chevrons-up-down')}<span>展开</span></span></button>
                                </div>
                                ${currentRule ? `<div class="tm-mobile-only-item" style="color:var(--tm-secondary-text);font-size:12px;">当前规则: ${esc(currentRule.name)} (${filteredCount}任务)</div>` : ''}
                            </div>
                        </div>
                    </div>

                    <style>
                        /* 默认隐藏移动端专属项（因为桌面端工具栏已经有了） */
                        .tm-mobile-only-item {
                            display: none !important;
                        }

                        /* 移动端下显示 */
                        @media (max-width: 768px) {
                            .tm-mobile-only-item {
                                display: flex !important;
                            }
                        }
                    </style>

                <div class="tm-doc-tabs ${docTabsClass}"
                    ondragenter="tmDocTabDragEnter(event)"
                     ondragleave="tmDocTabDragLeave(event)"
                     ondragover="tmDocTabDragOver(event)"
                     ondrop="tmDocTabDrop(event, '')">
                    <div class="tm-doc-tabs-scroll" style="display:flex; gap:8px; flex:1; padding: ${isMobile ? '4px 0 4px 0' : '4px 0 4px 0'};" oncontextmenu="tmShowDocTabsBlankContextMenu(event)" ondragover="tmDocTabDragOver(event)" ondrop="tmDocTabDrop(event, '')">
                        ${docTabsArchiveButtonPosition === 'before-all' ? docTabsArchiveButtonHtml : ''}
                        <div class="tm-doc-tab tm-doc-tab--all ${state.activeDocId === 'all' ? 'active' : ''}" onclick="tmHandleAllDocTabClick(event)" oncontextmenu="tmShowAllDocTabContextMenu(event)"${__tmBuildTooltipAttrs(`${__tmGetViewProfileSourceLabel(__tmGetEffectiveViewProfileForContext('all', currentGroupId).source)}: ${__tmDescribeViewProfile(__tmGetEffectiveViewProfileForContext('all', currentGroupId).profile)} ｜ ${docTabsArchiveMode ? '当前只看归档页签' : '右键或长按查看当前分组全部页签'}`, { side: 'bottom', ariaLabel: false })}>${docTabsArchiveMode ? '全部归档' : '全部'}</div>
                        ${(() => {
                            const id = String(SettingsStore.data.newTaskDocId || '').trim();
                            if (__tmIsDocExcludedInGroup(id, currentGroupId)) return '';
                            if (!id || id === '__dailyNote__') return '';
                            if (docTabsArchiveMode) return '';
                            const docName = __tmGetDocDisplayName(id, '未命名文档');
                            const rawName = __tmGetDocRawName(id, '未命名文档');
                            const alias = __tmGetDocAliasValue(id);
                            const isActive = state.activeDocId === id;
                            const c = __tmGetDocColorHex(id, __tmIsDarkMode());
                            const p = __tmGetStoredDocViewProfile(id) || __tmGetStoredGroupViewProfile(currentGroupId) || __tmGetViewProfilesStore().global;
                            const source = __tmGetStoredDocViewProfile(id) ? '页签自定义' : (__tmGetStoredGroupViewProfile(currentGroupId) ? '分组默认' : '全局默认');
                            const expectedMeta = __tmGetCachedDocExpectedMeta(id);
                            const expectedPercent = __tmComputeDocExpectedProgressPercent(expectedMeta);
                            const expectedTip = __tmFormatDocExpectedProgressTip(expectedMeta);
                            const expectedPid = `tm-doc-expected-special-${id}`;
                            const nameTip = alias && alias !== rawName ? `别名: ${alias} ｜ 原名: ${rawName} ｜ ` : '';
                            const procrastinationMetrics = typeof globalThis.__tmGetProcrastinationMetricsForDoc === 'function'
                                ? globalThis.__tmGetProcrastinationMetricsForDoc(id)
                                : null;
                            const procrastinationStyle = typeof globalThis.__tmBuildDocProcrastinationStyle === 'function'
                                ? globalThis.__tmBuildDocProcrastinationStyle(procrastinationMetrics)
                                : '';
                            const procrastinationTip = typeof globalThis.__tmFormatProcrastinationTip === 'function'
                                ? globalThis.__tmFormatProcrastinationTip(procrastinationMetrics)
                                : '';
                            const tip = `${nameTip}全局新建文档 ｜ ${source}: ${__tmDescribeViewProfile(p)}${expectedTip ? ` ｜ 预期进度: ${expectedTip}` : ''}${procrastinationTip ? ` ｜ ${procrastinationTip}` : ''}`;
                            setTimeout(() => __tmUpdateDocTabProgress(id, '', expectedPid), 0);
                            return `<div class="tm-doc-tab ${isActive ? 'active' : ''}" data-tm-doc-id="${esc(id)}" style="--tm-doc-color:${esc(c)};${esc(procrastinationStyle)}" oncontextmenu="tmShowDocTabContextMenu(event, '${id}')" ondragenter="tmDocTabDragEnter(event)" ondragleave="tmDocTabDragLeave(event)" ondragover="tmDocTabDragOver(event)" ondrop="tmDocTabDrop(event, '${id}')" onclick="tmSwitchDoc('${id}')"${__tmBuildTooltipAttrs(tip, { side: 'bottom', ariaLabel: false })}><div class="tm-doc-tab-expected${expectedPercent == null ? '' : ' is-visible'}" id="${expectedPid}" style="width:${expectedPercent || 0}%"></div><div class="tm-doc-tab-text">${__tmRenderDocIcon(id, { fallbackText: '📥', size: 14 })}<span>${esc(docName)}</span></div></div>`;
                        })()}
                        ${showOtherBlocksTab ? (() => {
                            const isActive = __tmIsOtherBlockTabId(state.activeDocId);
                            const c = __tmGetDocColorHex(__TM_OTHER_BLOCK_TAB_ID, __tmIsDarkMode());
                            const profile = __tmGetStoredDocViewProfile(__TM_OTHER_BLOCK_TAB_ID) || __tmGetStoredGroupViewProfile(currentGroupId) || __tmGetViewProfilesStore().global;
                            const profileSource = __tmGetStoredDocViewProfile(__TM_OTHER_BLOCK_TAB_ID) ? '页签自定义' : (__tmGetStoredGroupViewProfile(currentGroupId) ? '分组默认' : '全局默认');
                            const tip = `${profileSource}: ${__tmDescribeViewProfile(profile)}`;
                            return `<div class="tm-doc-tab ${isActive ? 'active' : ''}" data-tm-doc-id="${esc(__TM_OTHER_BLOCK_TAB_ID)}" style="--tm-doc-color:${esc(c)}" onclick="tmSwitchDoc('${__TM_OTHER_BLOCK_TAB_ID}')" oncontextmenu="tmShowDocTabContextMenu(event, '${__TM_OTHER_BLOCK_TAB_ID}')"${__tmBuildTooltipAttrs(tip, { side: 'bottom', ariaLabel: false })}>🧩 ${esc(__TM_OTHER_BLOCK_TAB_NAME)}</div>`;
                        })() : ''}
                        ${customTabGroups.map((entry) => {
                            const group = entry?.group || {};
                            const groupId = String(entry?.id || group.id || '').trim();
                            if (!groupId) return '';
                            const members = Array.isArray(entry?.members) ? entry.members : [];
                            const isActive = !!entry?.active;
                            const isAggregateActive = !!entry?.aggregateActive;
                            const groupNameText = String(entry?.name || group.name || '').trim() || '未命名页签组';
                            const label = groupNameText;
                            const c = typeof __tmGetDocTabCustomGroupColor === 'function'
                                ? __tmGetDocTabCustomGroupColor(group)
                                : 'var(--tm-primary-color)';
                            const tip = members.length
                                ? `${groupNameText} ｜ 点击查看组内全部任务 ｜ ${members.length} 个页签${isAggregateActive ? ' ｜ 当前：组内全部' : ''}`
                                : `${groupNameText} ｜ 当前没有可显示页签`;
                            return `<div class="tm-doc-tab tm-doc-tab--custom-group ${isActive ? 'active' : ''}"
                                data-tm-doc-tab-group-id="${esc(groupId)}"
                                style="--tm-doc-color:${esc(c)};--tm-doc-tab-group-color:${esc(c)}"
                                onclick="tmHandleDocTabCustomGroupClick(event, '${escSq(groupId)}')"
                                oncontextmenu="tmShowDocTabCustomGroupAllContextMenu(event, '${escSq(groupId)}')"
                                ${__tmBuildTooltipAttrs(tip, { side: 'bottom', ariaLabel: false })}>
                                <div class="tm-doc-tab-text"><span class="tm-doc-tab-label">${esc(label)}</span><button type="button" class="tm-doc-tab-group-caret" onclick="tmShowDocTabCustomGroupMenu(event, '${escSq(groupId)}')" aria-label="展开页签组" aria-expanded="false">${__tmRenderLucideIcon('caret-right', '', { size: 12 })}</button></div>
                            </div>`;
                        }).join('')}
                        ${docTabsToRender.map(doc => {
                            const isActive = state.activeDocId === doc.id;
                            const c = __tmGetDocColorHex(doc.id, __tmIsDarkMode());
                            const pid = `tm-doc-prog-${doc.id}`;
                            const expectedPid = `tm-doc-expected-${doc.id}`;
                            const docName = __tmGetDocDisplayName(doc, doc.name || '未命名文档');
                            const rawDocName = __tmGetDocRawName(doc, doc.name || '未命名文档');
                            const alias = __tmGetDocAliasValue(doc);
                            const docProfile = __tmGetStoredDocViewProfile(doc.id);
                            const groupProfile = __tmGetStoredGroupViewProfile(currentGroupId);
                            const profileSource = docProfile ? '页签自定义' : (groupProfile ? '分组默认' : '全局默认');
                            const expectedMeta = __tmGetCachedDocExpectedMeta(doc.id);
                            const expectedPercent = __tmComputeDocExpectedProgressPercent(expectedMeta);
                            const expectedTip = __tmFormatDocExpectedProgressTip(expectedMeta);
                            const profileTip = `${alias && alias !== rawDocName ? `别名: ${alias}\n原名: ${rawDocName}\n` : ''}${profileSource}: ${__tmDescribeViewProfile(docProfile || groupProfile || __tmGetViewProfilesStore().global)}${expectedTip ? `\n预期进度: ${expectedTip}` : ''}`;
                            const procrastinationMetrics = typeof globalThis.__tmGetProcrastinationMetricsForDoc === 'function'
                                ? globalThis.__tmGetProcrastinationMetricsForDoc(doc.id)
                                : null;
                            const procrastinationStyle = typeof globalThis.__tmBuildDocProcrastinationStyle === 'function'
                                ? globalThis.__tmBuildDocProcrastinationStyle(procrastinationMetrics)
                                : '';
                            const procrastinationTip = typeof globalThis.__tmFormatProcrastinationTip === 'function'
                                ? globalThis.__tmFormatProcrastinationTip(procrastinationMetrics)
                                : '';
                            const profileTipOneLine = `${profileTip.replace(/\s*\n+\s*/g, ' ｜ ')}${procrastinationTip ? ` ｜ ${procrastinationTip}` : ''}`;
                            // 预设宽度（如果缓存有值，直接渲染，减少闪烁）
                            const cachedPercent = __tmDocProgressCache?.get(doc.id) || 0;
                            // 调度异步更新
                            setTimeout(() => __tmUpdateDocTabProgress(doc.id, pid, expectedPid), 0);
                            const iconHtml = __tmRenderDocIcon(doc, { size: 14 });
                            return `<div class="tm-doc-tab ${isActive ? 'active' : ''}"
                                data-tm-doc-id="${esc(doc.id)}"
                                style="--tm-doc-color:${esc(c)};${esc(procrastinationStyle)}"
                                oncontextmenu="tmShowDocTabContextMenu(event, '${doc.id}')"
                                ondragenter="tmDocTabDragEnter(event)"
                                ondragleave="tmDocTabDragLeave(event)"
                                ondragover="tmDocTabDragOver(event)"
                                ondrop="tmDocTabDrop(event, '${doc.id}')"
                                onclick="tmSwitchDoc('${doc.id}')"
                                ${__tmBuildTooltipAttrs(profileTipOneLine, { side: 'bottom', ariaLabel: false })}>
                                <div class="tm-doc-tab-expected${expectedPercent == null ? '' : ' is-visible'}" id="${expectedPid}" style="width:${expectedPercent || 0}%"></div>
                                <div class="tm-doc-tab-bg" id="${pid}" style="width:${cachedPercent}%"></div>
                                <div class="tm-doc-tab-text">${iconHtml}<span>${esc(docName)}</span></div>
                            </div>`;
                        }).join('')}
                        ${docTabsArchiveButtonPosition === 'after-docs' ? docTabsArchiveButtonHtml : ''}
                    </div>
                    ${docTabsCanMultirow ? `
                    <div class="tm-doc-tabs-actions">
                        <button class="tm-doc-tabs-toggle bc-btn bc-btn--sm bc-btn--ghost"
                            onclick="tmToggleDocTabsCollapsed(event)"
                            aria-label="${docTabsToggleTitle}"
                            aria-pressed="${docTabsCollapsed ? 'true' : 'false'}"
                            ${__tmBuildTooltipAttrs(docTabsToggleTitle, { side: 'bottom', ariaLabel: false })}>
                            ${__tmRenderLucideIcon(docTabsCollapsed ? 'chevrons-up-down' : 'chevrons-down-up')}
                        </button>
                    </div>
                    ` : ''}
                </div>

                <style>
                    .tm-title {
                        cursor: pointer;
                        user-select: none;
                    }
                    .tm-box {
                        position: relative;
                    }
                    .tm-doc-tabs {
                        display: flex;
                        align-items: center;
                        flex-shrink: 0;
                        padding: 0;
                        border-bottom: 1px solid var(--tm-border-color);
                        background: var(--tm-header-bg);
                        max-height: 56px;
                        overflow: hidden;
                        transform: translate3d(0, 0, 0);
                        transform-origin: top center;
                        transition:
                            transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
                            max-height 0.28s cubic-bezier(0.22, 1, 0.36, 1),
                            opacity 0.14s ease;
                        opacity: 1;
                        position: relative;
                        z-index: 1;
                        will-change: transform, opacity;
                        contain: paint;
                        backface-visibility: hidden;
                        --tm-doc-tabs-action-width: 30px;
                    }
                    .tm-doc-tabs-scroll {
                        min-width: 0;
                        width: 100%;
                        justify-content: flex-start;
                        align-items: center;
                        flex-wrap: nowrap;
                        overflow-x: auto;
                        overflow-y: hidden;
                        scrollbar-gutter: stable;
                        max-height: 56px;
                        padding-right: var(--tm-doc-tabs-action-width) !important;
                        opacity: 1;
                        transition: opacity 0.14s ease;
                    }
                    .tm-doc-tabs--multirow:not(.tm-doc-tabs--collapsed) {
                        align-items: stretch;
                        max-height: 132px;
                        overflow: hidden;
                    }
                    .tm-doc-tabs--multirow:not(.tm-doc-tabs--collapsed) .tm-doc-tabs-scroll {
                        align-content: flex-start;
                        align-items: flex-start;
                        flex-wrap: wrap;
                        max-height: 132px;
                        overflow-x: hidden;
                        overflow-y: auto;
                        padding-left: 6px !important;
                        padding-right: 4px !important;
                    }
                    .tm-doc-tabs--multirow:not(.tm-doc-tabs--collapsed) .tm-doc-tab {
                        max-width: min(220px, calc(50% - 8px));
                    }
                    .tm-doc-tabs--multirow:not(.tm-doc-tabs--collapsed) .tm-doc-tab--all {
                        margin-left: 2px;
                    }
                    .tm-doc-tabs-actions {
                        display: none;
                        align-items: center;
                        justify-content: center;
                        position: absolute;
                        top: 0;
                        right: 0;
                        height: 36px;
                        width: var(--tm-doc-tabs-action-width);
                        padding: 4px 2px;
                        box-sizing: border-box;
                        background: var(--tm-header-bg);
                        z-index: 5;
                        transition: opacity 0.14s ease;
                    }
                    .tm-doc-tabs--overflowing .tm-doc-tabs-actions {
                        display: flex;
                    }
                    .tm-doc-tabs-toggle {
                        width: 24px;
                        min-width: 24px;
                        height: 24px;
                        min-height: 24px;
                        padding: 0;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        transition: background 0.16s ease, border-color 0.16s ease;
                    }
                    .tm-doc-tabs--multirow:not(.tm-doc-tabs--collapsed) .tm-doc-tabs-toggle {
                        transform: rotate(180deg);
                    }
                    .tm-modal.tm-modal--mobile .tm-doc-tabs-actions,
                    .tm-modal.tm-modal--dock .tm-doc-tabs-actions {
                        height: 36px;
                        padding: 4px 2px;
                    }
                    .tm-modal.tm-modal--mobile .tm-doc-tabs,
                    .tm-modal.tm-modal--dock .tm-doc-tabs {
                        --tm-doc-tabs-action-width: 34px;
                    }
                    .tm-modal.tm-modal--mobile .tm-doc-tabs-toggle,
                    .tm-modal.tm-modal--dock .tm-doc-tabs-toggle {
                        width: 28px;
                        min-width: 28px;
                        height: 28px;
                        min-height: 28px;
                    }
                    .tm-box--with-cal-dock .tm-doc-tabs {
                        flex: 0 0 auto;
                        position: relative;
                        z-index: 1;
                    }
                    .tm-doc-tabs.tm-doc-tabs--hidden {
                        max-height: 0 !important;
                        transform: translate3d(0, -12px, 0);
                        opacity: 0;
                        border-bottom-color: transparent;
                        padding-top: 0;
                        padding-bottom: 0;
                        pointer-events: none;
                    }
                    .tm-doc-tabs.tm-doc-tabs--hidden .tm-doc-tabs-scroll,
                    .tm-doc-tabs.tm-doc-tabs--hidden .tm-doc-tabs-actions {
                        opacity: 0;
                    }
                    @media (prefers-reduced-motion: reduce) {
                        .tm-doc-tabs,
                        .tm-doc-tabs-scroll,
                        .tm-doc-tabs-actions,
                        .tm-doc-tabs-toggle {
                            transition-duration: 0.01ms !important;
                        }
                    }
                    .tm-doc-tabs > div::-webkit-scrollbar {
                        height: 4px;
                    }
                    .tm-doc-tabs > div::-webkit-scrollbar-thumb {
                        background: var(--tm-border-color);
                        border-radius: 2px;
                    }
                    .tm-doc-tabs > div {
                        min-width: 0;
                        -webkit-overflow-scrolling: touch;
                    }
                    .tm-doc-tab {
                        --tm-doc-procrastination-bg-mix: 0%;
                        padding: 2px 8px;
                        border-radius: 6px;
                        background: color-mix(in srgb, var(--tm-danger-color) var(--tm-doc-procrastination-bg-mix), var(--tm-bg-color));
                        color: var(--tm-text-color);
                        font-size: 13px;
                        cursor: pointer;
                        white-space: nowrap;
                        flex: 0 0 auto;
                        min-width: 0;
                        border: 1px solid var(--tm-border-color);
                        transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease, background 0.12s ease;
                        user-select: none;
                        height: 24px;
                        line-height: 16px;
                        display: flex;
                        align-items: center;
                        position: relative;
                        overflow: hidden;
                    }
                    .tm-doc-tab--all {
                        margin-left: 8px;
                    }
                    .tm-doc-tabs--archive-before-all .tm-doc-tab--archive {
                        margin-left: 8px;
                    }
                    .tm-doc-tabs--archive-before-all .tm-doc-tab--all {
                        margin-left: 0;
                    }
                    .tm-doc-tabs--archive-before-all.tm-doc-tabs--multirow:not(.tm-doc-tabs--collapsed) .tm-doc-tab--archive {
                        margin-left: 2px;
                    }
                    .tm-doc-tabs--archive-before-all.tm-doc-tabs--multirow:not(.tm-doc-tabs--collapsed) .tm-doc-tab--all {
                        margin-left: 0;
                    }
                    .tm-doc-tab--archive {
                        width: 24px;
                        min-width: 24px;
                        max-width: 24px;
                        height: 24px;
                        min-height: 24px;
                        padding: 0;
                        flex: 0 0 24px;
                        box-sizing: border-box;
                        align-items: center;
                        justify-content: center;
                        color: var(--tm-secondary-text);
                    }
                    .tm-doc-tab--archive::after {
                        background: var(--tm-secondary-text);
                    }
                    .tm-doc-tabs--archive-mode .tm-doc-tab--archive {
                        color: var(--tm-primary-color);
                    }
                    .tm-doc-tab-bg {
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 0%;
                        height: 100%;
                        background: var(--tm-doc-color, transparent);
                        opacity: 0.2;
                        transition: width 0.3s ease;
                        z-index: 0;
                        pointer-events: none;
                    }
                    .tm-doc-tab-expected {
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 0%;
                        height: 2px;
                        background: var(--tm-doc-color, transparent);
                        opacity: 0;
                        transition: width 0.3s ease, opacity 0.2s ease;
                        z-index: 2;
                        pointer-events: none;
                    }
                    .tm-doc-tab-expected.is-visible {
                        opacity: 0.96;
                    }
                    .tm-doc-tab-text {
                        position: relative;
                        z-index: 3;
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                        min-width: 0;
                    }
                    .tm-doc-tab-text > span:last-child,
                    .tm-doc-tab-text > .tm-doc-tab-label {
                        min-width: 0;
                        overflow: hidden;
                        text-overflow: ellipsis;
                     }
                    .tm-doc-tab--custom-group {
                        max-width: 260px;
                        padding-right: 3px;
                        background: color-mix(in srgb, var(--tm-doc-tab-group-color, var(--tm-doc-color, var(--tm-primary-color))) 18%, var(--tm-bg-color));
                        border-color: color-mix(in srgb, var(--tm-doc-tab-group-color, var(--tm-doc-color, var(--tm-primary-color))) 44%, var(--tm-border-color));
                        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tm-doc-tab-group-color, var(--tm-doc-color, var(--tm-primary-color))) 10%, transparent);
                    }
                    .tm-doc-tab-group-caret {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        width: 18px;
                        min-width: 18px;
                        height: 18px;
                        padding: 0;
                        border: 0;
                        border-radius: 4px;
                        background: transparent;
                        color: var(--tm-secondary-text);
                        line-height: 0;
                        flex: 0 0 auto;
                        cursor: pointer;
                        position: relative;
                        z-index: 4;
                    }
                    .tm-doc-tab-group-caret:hover {
                        background: var(--tm-hover-bg);
                        color: var(--tm-text-color);
                    }
                    .tm-doc-tab--custom-group-menu-item {
                        width: 100%;
                        max-width: none;
                        box-sizing: border-box;
                        justify-content: space-between;
                        flex: 1 1 auto;
                    }
                    .tm-doc-tab--custom-group-menu-item .tm-doc-tab-label {
                        min-width: 0;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    .tm-doc-tab-custom-group-menu-list {
                        scrollbar-width: none;
                        -ms-overflow-style: none;
                    }
                    .tm-doc-tab-custom-group-menu-list::-webkit-scrollbar {
                        width: 0;
                        height: 0;
                        display: none;
                    }
                    .tm-doc-tab-tree-guide {
                        display: inline-flex;
                        align-items: stretch;
                        align-self: stretch;
                        height: 24px;
                        flex: 0 0 auto;
                        margin: 2px 1px 2px 0;
                        color: color-mix(in srgb, var(--tm-secondary-text) 42%, transparent);
                    }
                    .tm-doc-tab-tree-guide-seg {
                        position: relative;
                        display: inline-flex;
                        width: 14px;
                        min-width: 14px;
                        height: 100%;
                    }
                    .tm-doc-tab-tree-guide-seg.is-line::before,
                    .tm-doc-tab-tree-guide-seg.is-branch::before,
                    .tm-doc-tab-tree-guide-seg.is-last::before {
                        content: '';
                        position: absolute;
                        left: 7px;
                        top: 0;
                        bottom: 0;
                        border-left: 1px solid currentColor;
                    }
                    .tm-doc-tab-tree-menu-row .tm-doc-tab-tree-guide {
                        height: 28px;
                        margin-top: 0;
                        margin-bottom: 0;
                    }
                    .tm-doc-tab-tree-menu-row .tm-doc-tab-tree-guide-seg.is-line::before,
                    .tm-doc-tab-tree-menu-row .tm-doc-tab-tree-guide-seg.is-branch::before,
                    .tm-doc-tab-tree-menu-row .tm-doc-tab-tree-guide-seg.is-last::before,
                    .tm-doc-tab-tree-menu-row .tm-doc-tab-tree-guide-seg.is-blank::before {
                        content: '';
                        position: absolute;
                        left: 7px;
                        top: -2px;
                        bottom: -2px;
                        border-left: 1px solid currentColor;
                    }
                    .tm-doc-tab::after {
                        content: '';
                        position: absolute;
                        left: 0;
                        right: 0;
                        bottom: -1px;
                        height: 4px;
                        border-radius: 0;
                        background: var(--tm-doc-color, transparent);
                        opacity: 0.95;
                        z-index: 2;
                    }
                    .tm-doc-tab--custom-group::after {
                        content: none;
                        display: none;
                    }
                    .tm-doc-tab:hover {
                        background: color-mix(in srgb, var(--tm-danger-color) var(--tm-doc-procrastination-bg-mix), var(--tm-hover-bg));
                        border-color: var(--tm-text-color);
                    }
                    .tm-doc-tab.active {
                        background: color-mix(in srgb, var(--tm-danger-color) var(--tm-doc-procrastination-bg-mix), var(--tm-bg-color));
                        color: var(--tm-text-color);
                        border-color: var(--tm-primary-color);
                        box-shadow: inset 0 0 0 1px var(--tm-primary-color), 0 0 0 1px color-mix(in srgb, var(--tm-primary-color) 18%, transparent);
                    }
                    .tm-doc-tab--custom-group:hover {
                        background: color-mix(in srgb, var(--tm-doc-tab-group-color, var(--tm-doc-color, var(--tm-primary-color))) 24%, var(--tm-hover-bg));
                        border-color: color-mix(in srgb, var(--tm-doc-tab-group-color, var(--tm-doc-color, var(--tm-primary-color))) 62%, var(--tm-text-color));
                    }
                    .tm-doc-tab--custom-group.active,
                    .tm-doc-tab--custom-group.active:hover {
                        background: color-mix(in srgb, var(--tm-doc-tab-group-color, var(--tm-doc-color, var(--tm-primary-color))) 42%, var(--tm-bg-color));
                        border-color: color-mix(in srgb, var(--tm-doc-tab-group-color, var(--tm-doc-color, var(--tm-primary-color))) 86%, var(--tm-primary-color));
                        box-shadow:
                            inset 0 0 0 1px color-mix(in srgb, var(--tm-doc-tab-group-color, var(--tm-doc-color, var(--tm-primary-color))) 60%, transparent),
                            0 0 0 2px color-mix(in srgb, var(--tm-doc-tab-group-color, var(--tm-doc-color, var(--tm-primary-color))) 26%, transparent);
                    }
                    .tm-doc-tab.active .tm-doc-tab-bg {
                        opacity: 0.38;
                    }
                    .tm-doc-tab.is-drop-target {
                        transform: scale(1.06);
                        border-color: var(--tm-primary-color);
                        box-shadow: 0 6px 16px rgba(0,0,0,0.15);
                        z-index: 200;
                        transform-origin: center;
                        background: var(--tm-hover-bg);
                    }

                    @media (max-width: 768px) {
                        .tm-modal.tm-modal--mobile .tm-desktop-toolbar {
                            display: none !important;
                        }
                        .tm-modal.tm-modal--mobile .tm-compact-topbar-actions {
                            display: flex !important;
                            gap: 6px !important;
                        }
                        .tm-modal.tm-modal--mobile .tm-compact-topbar-action--refresh {
                            display: inline-flex !important;
                        }
                        .tm-modal.tm-modal--mobile .tm-mobile-menu-btn {
                            display: block !important;
                        }
                        .tm-modal.tm-modal--mobile .tm-filter-rule-bar {
                            flex-wrap: wrap;
                        }
                        .tm-modal.tm-modal--mobile .tm-doc-tabs {
                            padding: 0;
                            width: 100%;
                            box-sizing: border-box;
                        }
                        .tm-modal.tm-modal--mobile .tm-doc-tab {
                            font-size: 12px;
                            padding: 2px 8px;
                            height: 24px;
                            border-radius: 6px;
                        }
                        .tm-modal.tm-modal--mobile .tm-doc-tab.tm-doc-tab--archive {
                            width: 24px;
                            min-width: 24px;
                            max-width: 24px;
                            height: 24px;
                            min-height: 24px;
                            padding: 0;
                            flex: 0 0 24px;
                            box-sizing: border-box;
                        }

                        .tm-modal.tm-modal--mobile .tm-topbar-right {
                            gap: 6px !important;
                        }

                        .tm-modal.tm-modal--mobile .tm-compact-topbar-action--settings {
                            display: none !important;
                        }

                        .tm-modal.tm-modal--mobile:not(.tm-modal--dock),
                        .tm-modal.tm-modal--dock {
                            --tm-mobile-bottom-viewbar-offset: calc(env(safe-area-inset-bottom, 0px) + 10px);
                        }

                        .tm-modal.tm-modal--mobile:not(.tm-modal--dock) .tm-mobile-bottom-viewbar,
                        .tm-modal.tm-modal--dock .tm-mobile-bottom-viewbar {
                            position: absolute;
                            left: 0;
                            right: 0;
                            bottom: var(--tm-mobile-bottom-viewbar-offset);
                            padding: 0 14px;
                            display: flex;
                            justify-content: center;
                            pointer-events: none;
                            z-index: 45;
                        }

                        .tm-modal.tm-modal--mobile:not(.tm-modal--dock) .tm-mobile-bottom-viewbar__inner,
                        .tm-modal.tm-modal--dock .tm-mobile-bottom-viewbar__inner {
                            pointer-events: auto;
                            width: min(100%, 420px);
                            padding: 3px;
                            border-radius: 999px;
                            border: 1px solid color-mix(in srgb, var(--tm-border-color) 84%, transparent);
                            background: color-mix(in srgb, var(--tm-header-bg) 96%, rgba(255,255,255,0.12));
                            box-shadow: 0 8px 24px rgba(15, 23, 42, 0.16);
                            backdrop-filter: blur(14px);
                            -webkit-backdrop-filter: blur(14px);
                            overflow-x: auto;
                            scrollbar-width: none;
                            opacity: 0.3;
                            transition: opacity 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
                        }

                        .tm-modal.tm-modal--mobile:not(.tm-modal--dock) .tm-mobile-bottom-viewbar__inner::-webkit-scrollbar,
                        .tm-modal.tm-modal--dock .tm-mobile-bottom-viewbar__inner::-webkit-scrollbar {
                            display: none;
                        }

                        .tm-modal.tm-modal--mobile:not(.tm-modal--dock) .tm-mobile-bottom-viewbar.tm-mobile-bottom-viewbar--active .tm-mobile-bottom-viewbar__inner,
                        .tm-modal.tm-modal--mobile:not(.tm-modal--dock) .tm-mobile-bottom-viewbar:active .tm-mobile-bottom-viewbar__inner,
                        .tm-modal.tm-modal--mobile:not(.tm-modal--dock) .tm-mobile-bottom-viewbar:focus-within .tm-mobile-bottom-viewbar__inner,
                        .tm-modal.tm-modal--dock .tm-mobile-bottom-viewbar.tm-mobile-bottom-viewbar--active .tm-mobile-bottom-viewbar__inner,
                        .tm-modal.tm-modal--dock .tm-mobile-bottom-viewbar:active .tm-mobile-bottom-viewbar__inner,
                        .tm-modal.tm-modal--dock .tm-mobile-bottom-viewbar:focus-within .tm-mobile-bottom-viewbar__inner {
                            opacity: 0.8;
                        }

                        .tm-modal.tm-modal--mobile:not(.tm-modal--dock) .tm-mobile-bottom-view-switcher,
                        .tm-modal.tm-modal--dock .tm-mobile-bottom-view-switcher {
                            display: flex;
                            width: max-content;
                            min-width: 100%;
                            gap: 4px;
                            padding: 0;
                            background: transparent;
                            border: none;
                            box-shadow: none;
                            flex-wrap: nowrap;
                        }

                        .tm-modal.tm-modal--mobile:not(.tm-modal--dock) .tm-mobile-bottom-view-switcher .tm-view-seg-item,
                        .tm-modal.tm-modal--mobile:not(.tm-modal--dock) .tm-mobile-bottom-view-switcher .bc-tabs-trigger,
                        .tm-modal.tm-modal--dock .tm-mobile-bottom-view-switcher .tm-view-seg-item,
                        .tm-modal.tm-modal--dock .tm-mobile-bottom-view-switcher .bc-tabs-trigger {
                            height: 28px !important;
                            min-height: 28px !important;
                            line-height: 28px !important;
                            padding: 0 12px !important;
                            border-radius: 999px !important;
                            font-size: 13px !important;
                            font-weight: 700 !important;
                            white-space: nowrap;
                            flex: 1 0 auto;
                            background: transparent;
                            border-color: transparent;
                            box-shadow: none;
                        }

                        .tm-modal.tm-modal--mobile:not(.tm-modal--dock) .tm-mobile-bottom-view-switcher .tm-view-seg-item--active,
                        .tm-modal.tm-modal--mobile:not(.tm-modal--dock) .tm-mobile-bottom-view-switcher .bc-tabs-trigger.tm-view-seg-item--active,
                        .tm-modal.tm-modal--dock .tm-mobile-bottom-view-switcher .tm-view-seg-item--active,
                        .tm-modal.tm-modal--dock .tm-mobile-bottom-view-switcher .bc-tabs-trigger.tm-view-seg-item--active {
                            background: var(--tm-topbar-seg-item-active-bg) !important;
                            color: var(--tm-topbar-control-text) !important;
                            border-color: color-mix(in srgb, var(--tm-topbar-control-border) 72%, transparent) !important;
                            box-shadow: 0 4px 12px color-mix(in srgb, var(--tm-primary-color) 16%, transparent);
                        }

                        @media (orientation: landscape) {
                            .tm-modal.tm-modal--mobile:not(.tm-modal--dock) .tm-mobile-bottom-viewbar {
                                display: none !important;
                            }
                            .tm-modal.tm-modal--runtime-mobile.tm-modal--dock .tm-mobile-bottom-viewbar {
                                display: none !important;
                            }
                        }
                    }

                    @media (max-width: 1024px) {
                        .tm-modal.tm-modal--mobile .tm-header-selectors {
                            display: none !important;
                        }
                    }
                    .tm-modal.tm-modal--mobile:not(.tm-modal--dock) {
                        --tm-mobile-bottom-viewbar-offset: calc(env(safe-area-inset-bottom, 0px) + 10px);
                    }
                    .tm-modal.tm-modal--mobile:not(.tm-modal--dock) .tm-mobile-bottom-viewbar {
                        position: absolute;
                        left: 0;
                        right: 0;
                        bottom: var(--tm-mobile-bottom-viewbar-offset);
                        padding: 0 14px;
                        display: flex;
                        justify-content: center;
                        pointer-events: none;
                        z-index: 45;
                    }
                    .tm-modal.tm-modal--mobile:not(.tm-modal--dock) .tm-mobile-bottom-viewbar__inner {
                        pointer-events: auto;
                        width: min(100%, 420px);
                        padding: 3px;
                        border-radius: 999px;
                        border: 1px solid color-mix(in srgb, var(--tm-border-color) 84%, transparent);
                        background: color-mix(in srgb, var(--tm-header-bg) 96%, rgba(255,255,255,0.12));
                        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.16);
                        backdrop-filter: blur(14px);
                        -webkit-backdrop-filter: blur(14px);
                        overflow-x: auto;
                        scrollbar-width: none;
                        opacity: 0.3;
                        transition: opacity 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
                    }
                    .tm-modal.tm-modal--mobile:not(.tm-modal--dock) .tm-mobile-bottom-viewbar__inner::-webkit-scrollbar {
                        display: none;
                    }
                    .tm-modal.tm-modal--mobile:not(.tm-modal--dock) .tm-mobile-bottom-viewbar.tm-mobile-bottom-viewbar--active .tm-mobile-bottom-viewbar__inner,
                    .tm-modal.tm-modal--mobile:not(.tm-modal--dock) .tm-mobile-bottom-viewbar:active .tm-mobile-bottom-viewbar__inner,
                    .tm-modal.tm-modal--mobile:not(.tm-modal--dock) .tm-mobile-bottom-viewbar:focus-within .tm-mobile-bottom-viewbar__inner {
                        opacity: 0.8;
                    }
                    .tm-modal.tm-modal--mobile:not(.tm-modal--dock) .tm-mobile-bottom-view-switcher {
                        display: flex;
                        width: max-content;
                        min-width: 100%;
                        gap: 4px;
                        padding: 0;
                        background: transparent;
                        border: none;
                        box-shadow: none;
                        flex-wrap: nowrap;
                    }
                    .tm-modal.tm-modal--mobile:not(.tm-modal--dock) .tm-mobile-bottom-view-switcher .tm-view-seg-item,
                    .tm-modal.tm-modal--mobile:not(.tm-modal--dock) .tm-mobile-bottom-view-switcher .bc-tabs-trigger {
                        height: 28px !important;
                        min-height: 28px !important;
                        line-height: 28px !important;
                        padding: 0 12px !important;
                        border-radius: 999px !important;
                        font-size: 13px !important;
                        font-weight: 700 !important;
                        white-space: nowrap;
                        flex: 1 0 auto;
                        background: transparent;
                        border-color: transparent;
                        box-shadow: none;
                    }
                    .tm-modal.tm-modal--mobile:not(.tm-modal--dock) .tm-mobile-bottom-view-switcher .tm-view-seg-item--active,
                    .tm-modal.tm-modal--mobile:not(.tm-modal--dock) .tm-mobile-bottom-view-switcher .bc-tabs-trigger.tm-view-seg-item--active {
                        background: var(--tm-topbar-seg-item-active-bg) !important;
                        color: var(--tm-topbar-control-text) !important;
                        border-color: color-mix(in srgb, var(--tm-topbar-control-border) 72%, transparent) !important;
                        box-shadow: 0 4px 12px color-mix(in srgb, var(--tm-primary-color) 16%, transparent);
                    }
                    @media (orientation: landscape) {
                        .tm-modal.tm-modal--mobile:not(.tm-modal--dock) .tm-mobile-bottom-viewbar {
                            display: none !important;
                        }
                    }
                    .tm-modal.tm-modal--dock {
                        --tm-mobile-bottom-viewbar-offset: 10px;
                    }
                    .tm-modal.tm-modal--dock .tm-mobile-bottom-viewbar {
                        position: absolute;
                        left: 0;
                        right: 0;
                        bottom: var(--tm-mobile-bottom-viewbar-offset);
                        padding: 0 14px;
                        display: flex;
                        justify-content: center;
                        pointer-events: none;
                        z-index: 45;
                    }
                    .tm-modal.tm-modal--dock .tm-mobile-bottom-viewbar__inner {
                        pointer-events: auto;
                        width: fit-content;
                        max-width: min(100%, 420px);
                        padding: 3px;
                        border-radius: 999px;
                        border: 1px solid color-mix(in srgb, var(--tm-border-color) 84%, transparent);
                        background: color-mix(in srgb, var(--tm-header-bg) 96%, rgba(255,255,255,0.12));
                        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.16);
                        backdrop-filter: blur(14px);
                        -webkit-backdrop-filter: blur(14px);
                        overflow-x: auto;
                        scrollbar-width: none;
                        opacity: 0.3;
                        transition: opacity 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
                    }
                    .tm-modal.tm-modal--dock .tm-mobile-bottom-viewbar__inner::-webkit-scrollbar {
                        display: none;
                    }
                    .tm-modal.tm-modal--dock .tm-mobile-bottom-viewbar.tm-mobile-bottom-viewbar--active .tm-mobile-bottom-viewbar__inner,
                    .tm-modal.tm-modal--dock .tm-mobile-bottom-viewbar:active .tm-mobile-bottom-viewbar__inner,
                    .tm-modal.tm-modal--dock .tm-mobile-bottom-viewbar:focus-within .tm-mobile-bottom-viewbar__inner {
                        opacity: 0.8;
                    }
                    .tm-modal.tm-modal--dock .tm-mobile-bottom-viewbar:hover .tm-mobile-bottom-viewbar__inner,
                    .tm-modal.tm-modal--dock .tm-mobile-bottom-viewbar__inner:hover {
                        opacity: 1;
                    }
                    .tm-modal.tm-modal--dock .tm-mobile-bottom-view-switcher {
                        display: flex;
                        width: max-content;
                        min-width: 0;
                        gap: 4px;
                        padding: 0;
                        background: transparent;
                        border: none;
                        box-shadow: none;
                        flex-wrap: nowrap;
                    }
                    .tm-modal.tm-modal--dock .tm-mobile-bottom-view-switcher .tm-view-seg-item,
                    .tm-modal.tm-modal--dock .tm-mobile-bottom-view-switcher .bc-tabs-trigger {
                        height: 28px !important;
                        min-height: 28px !important;
                        line-height: 28px !important;
                        padding: 0 12px !important;
                        border-radius: 999px !important;
                        font-size: 13px !important;
                        font-weight: 700 !important;
                        white-space: nowrap;
                        flex: 1 0 auto;
                        background: transparent;
                        border-color: transparent;
                        box-shadow: none;
                    }
                    .tm-modal.tm-modal--dock .tm-mobile-bottom-view-switcher .tm-view-seg-item--active,
                    .tm-modal.tm-modal--dock .tm-mobile-bottom-view-switcher .bc-tabs-trigger.tm-view-seg-item--active {
                        background: var(--tm-topbar-seg-item-active-bg) !important;
                        color: var(--tm-topbar-control-text) !important;
                        border-color: color-mix(in srgb, var(--tm-topbar-control-border) 72%, transparent) !important;
                        box-shadow: 0 4px 12px color-mix(in srgb, var(--tm-primary-color) 16%, transparent);
                    }
                    .tm-modal.tm-modal--mobile-view-switching .tm-mobile-bottom-viewbar__inner,
                    .tm-modal.tm-modal--mobile-view-switching .tm-mobile-bottom-viewbar.tm-mobile-bottom-viewbar--active .tm-mobile-bottom-viewbar__inner,
                    .tm-modal.tm-modal--mobile-view-switching .tm-mobile-bottom-viewbar:active .tm-mobile-bottom-viewbar__inner,
                    .tm-modal.tm-modal--mobile-view-switching .tm-mobile-bottom-viewbar:focus-within .tm-mobile-bottom-viewbar__inner,
                    .tm-modal.tm-modal--mobile-view-switching .tm-mobile-bottom-viewbar:hover .tm-mobile-bottom-viewbar__inner,
                    .tm-modal.tm-modal--mobile-view-switching .tm-mobile-bottom-viewbar__inner:hover {
                        background: color-mix(in srgb, var(--tm-header-bg) 98%, rgba(255,255,255,0.08));
                        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);
                        backdrop-filter: none;
                        -webkit-backdrop-filter: none;
                        transition-duration: 0.08s;
                    }
                    .tm-modal.tm-modal--mobile-view-switching .tm-mobile-bottom-view-switcher .tm-view-seg-item,
                    .tm-modal.tm-modal--mobile-view-switching .tm-mobile-bottom-view-switcher .bc-tabs-trigger {
                        transition: background-color 0.08s ease, color 0.08s ease, border-color 0.08s ease, box-shadow 0.08s ease;
                    }
                    .tm-modal.tm-modal--mobile-view-switching .tm-mobile-bottom-view-switcher .tm-view-seg-item--active,
                    .tm-modal.tm-modal--mobile-view-switching .tm-mobile-bottom-view-switcher .bc-tabs-trigger.tm-view-seg-item--active {
                        box-shadow: 0 2px 8px color-mix(in srgb, var(--tm-primary-color) 14%, transparent);
                    }
                    .tm-main-body-with-cal-dock {
                        flex: 1 1 auto;
                        min-height: 0;
                        min-width: 0;
                        display: flex;
                        align-items: stretch;
                    }
                    .tm-main-body-with-cal-dock > .tm-body,
                    .tm-main-body-with-cal-dock > .tm-list-pane {
                        flex: 1 1 auto;
                        min-height: 0;
                        min-width: 0;
                    }
                    .tm-main-body-with-cal-dock.tm-main-body-with-cal-dock--calendar-dock-hidden > .tm-calendar-side-dock,
                    .tm-main-body-with-cal-dock.tm-main-body-with-cal-dock--calendar-dock-hidden > .tm-calendar-side-dock-resizer {
                        pointer-events: auto;
                        visibility: visible;
                    }
                    .tm-calendar-side-dock {
                        border-left: none;
                        background: var(--tm-bg-color);
                        overflow: hidden;
                        display: flex;
                        flex-direction: column;
                    }
                    .tm-ai-side-dock {
                        border-left: 1px solid var(--tm-border-color);
                        background: var(--tm-bg-color);
                        overflow: hidden;
                        display: flex;
                        flex-direction: column;
                    }
                    .tm-ai-side-dock-resizer {
                        width: 6px;
                        cursor: col-resize;
                        background: transparent;
                        position: relative;
                        flex: 0 0 6px;
                    }
                    .tm-ai-side-dock-resizer::after {
                        content: '';
                        position: absolute;
                        top: 0;
                        bottom: 0;
                        left: 2px;
                        width: 1px;
                        background: var(--tm-border-color);
                        opacity: .65;
                    }
                    .tm-ai-side-dock-resizer:hover::after {
                        background: var(--tm-primary-color);
                        opacity: 1;
                    }
                    .tm-calendar-side-dock-resizer {
                        width: 6px;
                        cursor: col-resize;
                        background: transparent;
                        position: relative;
                        flex: 0 0 6px;
                    }
                    .tm-calendar-side-dock-resizer::after {
                        content: '';
                        position: absolute;
                        top: 0;
                        bottom: 0;
                        left: 2px;
                        width: 1px;
                        background: var(--tm-border-color);
                        opacity: .65;
                    }
                    .tm-calendar-side-dock-resizer:hover::after {
                        background: var(--tm-primary-color);
                        opacity: 1;
                    }
                    .tm-calendar-dock-head {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 8px;
                        padding: 4px 10px 4px;
                        border-bottom: none;
                    }
                    .tm-calendar-dock-title {
                        font-size: 15px;
                        font-weight: 700;
                        line-height: 1.2;
                        transform: translateY(1px);
                    }
                    .tm-calendar-dock-nav {
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                        transform: translateY(1px);
                    }
                    .tm-calendar-dock-nav .bc-btn,
                    .tm-calendar-dock-nav .bc-btn--sm {
                        height: 26px;
                        min-height: 26px;
                        font-size: 11px;
                        font-weight: 500;
                        border-radius: var(--tm-topbar-control-radius);
                        border: var(--tm-topbar-control-border-width) solid var(--tm-topbar-control-border);
                        background: var(--tm-topbar-control-bg);
                        color: var(--tm-topbar-control-text);
                        box-shadow: var(--tm-topbar-control-shadow);
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        line-height: 24px;
                        white-space: nowrap;
                    }
                    .tm-calendar-dock-nav .bc-btn:hover,
                    .tm-calendar-dock-nav .bc-btn--sm:hover {
                        background: var(--tm-topbar-control-hover);
                    }
                    .tm-calendar-dock-nav .tm-calendar-dock-nav-btn--icon {
                        width: 26px;
                        min-width: 26px;
                        padding: 0;
                    }
                    .tm-calendar-dock-nav .tm-calendar-dock-nav-btn--today {
                        padding: 0 8px;
                        min-width: 44px;
                    }
                    .tm-calendar-dock-date {
                        padding: 6px 10px;
                        font-size: 12px;
                        color: var(--tm-secondary-text);
                        border-bottom: 1px solid var(--tm-border-color);
                    }
                    .tm-calendar-dock-empty {
                        font-size: 12px;
                        color: var(--tm-secondary-text);
                    }
                    #tmCalendarSideDockTimeline {
                        flex: 1 1 auto;
                        min-height: 0;
                        overflow: hidden;
                        scrollbar-width: none;
                        -ms-overflow-style: none;
                    }
                    #tmCalendarSideDockTimeline::-webkit-scrollbar {
                        width: 0;
                        height: 0;
                    }
                    #tmCalendarSideDockTimeline .fc {
                        height: 100%;
                        min-height: 0;
                        box-shadow: none !important;
                        filter: none !important;
                    }
                    #tmCalendarSideDockTimeline .fc-view-harness {
                        min-height: 0 !important;
                        height: 100% !important;
                        box-shadow: none !important;
                        filter: none !important;
                    }
                    #tmCalendarSideDockTimeline .fc .fc-scrollgrid,
                    #tmCalendarSideDockTimeline .fc .fc-scrollgrid-liquid {
                        border-top: 0 !important;
                        border-left: 0 !important;
                    }
                    #tmCalendarSideDockTimeline .fc .fc-scrollgrid-section > td:first-child,
                    #tmCalendarSideDockTimeline .fc .fc-scrollgrid-section > th:first-child,
                    #tmCalendarSideDockTimeline .fc td.fc-timegrid-slot-label,
                    #tmCalendarSideDockTimeline .fc .fc-timegrid-axis,
                    #tmCalendarSideDockTimeline .fc .fc-timegrid-axis-frame {
                        border-left: 0 !important;
                    }
                    #tmCalendarSideDockTimeline .fc .fc-timegrid-all-day {
                        border-bottom: 1px solid var(--fc-border-color) !important;
                        box-shadow: none !important;
                    }
                    #tmCalendarSideDockTimeline .fc .fc-timegrid-divider,
                    #tmCalendarSideDockTimeline .fc .fc-timegrid-divider td,
                    #tmCalendarSideDockTimeline .fc .fc-timegrid-divider div {
                        border-top: 0 !important;
                        box-shadow: none !important;
                        background: transparent !important;
                        height: 0 !important;
                        padding: 0 !important;
                    }
                    #tmCalendarSideDockTimeline .fc .fc-scrollgrid-section-sticky,
                    #tmCalendarSideDockTimeline .fc .fc-scrollgrid-section-sticky > td,
                    #tmCalendarSideDockTimeline .fc .fc-scrollgrid-section-sticky > th,
                    #tmCalendarSideDockTimeline .fc .fc-scrollgrid-section-sticky td,
                    #tmCalendarSideDockTimeline .fc .fc-scrollgrid-section-sticky th {
                        background: var(--tm-bg-color) !important;
                        border-color: var(--fc-border-color) !important;
                        box-shadow: none !important;
                    }
                    #tmCalendarSideDockTimeline .fc .fc-scrollgrid-section-sticky {
                        border-bottom: 1px solid var(--fc-border-color) !important;
                    }
                    #tmCalendarSideDockTimeline .fc .fc-scrollgrid-section-sticky .fc-timegrid-all-day {
                        background: var(--tm-bg-color) !important;
                        border-bottom: 1px solid var(--fc-border-color) !important;
                    }
                    #tmCalendarSideDockTimeline .fc .fc-scrollgrid col:first-child,
                    #tmCalendarSideDockTimeline .fc .fc-scrollgrid-section > td:first-child,
                    #tmCalendarSideDockTimeline .fc .fc-scrollgrid-section > th:first-child,
                    #tmCalendarSideDockTimeline .fc td.fc-timegrid-slot-label,
                    #tmCalendarSideDockTimeline .fc .fc-timegrid-axis {
                        border-right: 1px solid var(--fc-border-color) !important;
                        width: 40px !important;
                        min-width: 40px !important;
                        max-width: 40px !important;
                    }
                    #tmCalendarSideDockTimeline .fc .fc-timegrid-axis-frame,
                    #tmCalendarSideDockTimeline .fc .fc-timegrid-slot-label-frame {
                        display: flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                        height: 100% !important;
                        width: 100% !important;
                        min-width: 40px !important;
                    }
                    #tmCalendarSideDockTimeline .fc .fc-timegrid-axis-cushion,
                    #tmCalendarSideDockTimeline .fc .fc-timegrid-slot-label-cushion {
                        display: flex !important;
                        align-items: flex-start !important;
                        justify-content: center !important;
                        width: 100% !important;
                        min-height: 100% !important;
                        min-width: 40px !important;
                        padding: 0 !important;
                        text-align: center !important;
                        margin: 0 auto !important;
                        color: color-mix(in srgb, var(--tm-text-color) 72%, var(--tm-secondary-text) 28%) !important;
                        font-size: 14px !important;
                        line-height: 1 !important;
                        font-weight: 400 !important;
                        opacity: 0.82 !important;
                        transform: translateY(var(--tm-calendar-hour-translate-y, -46%)) !important;
                    }
                    #tmCalendarSideDockTimeline .fc td.fc-timegrid-slot-label,
                    #tmCalendarSideDockTimeline .fc .fc-timegrid-axis {
                        text-align: center !important;
                    }
                    #tmCalendarSideDockTimeline .fc .fc-timegrid-slot-label-cushion {
                        font-size: 14px !important;
                    }
                    #tmCalendarSideDockTimeline .fc .fc-timegrid-all-day .fc-timegrid-axis-cushion {
                        align-items: center !important;
                        font-size: 14px !important;
                        opacity: 0.74 !important;
                        transform: none !important;
                    }
                    #tmCalendarSideDockTimeline .fc td.fc-timegrid-slot-lane,
                    #tmCalendarSideDockTimeline .fc .fc-timegrid-col,
                    #tmCalendarSideDockTimeline .fc .fc-timegrid-slot-frame {
                        border-left: 0 !important;
                    }
                    #tmCalendarSideDockPanel {
                        height: 100%;
                        min-height: 0;
                        display: flex;
                        flex-direction: column;
                    }
                    .tm-ai-mobile-shell {
                        position: absolute;
                        inset: 0;
                        z-index: 10020;
                        display: flex;
                        align-items: stretch;
                        justify-content: stretch;
                    }
                    .tm-ai-mobile-mask {
                        position: absolute;
                        inset: 0;
                        background: rgba(0,0,0,.32);
                    }
                    .tm-ai-mobile-panel {
                        position: relative;
                        margin-left: auto;
                        width: min(100vw, 100%);
                        height: 100%;
                        background: var(--tm-bg-color);
                        border-left: 1px solid var(--tm-border-color);
                        display: flex;
                        flex-direction: column;
                        min-height: 0;
                    }
                </style>

                <div class="tm-main-stage${stageAnimClass}${showMobileBottomViewBar ? ' tm-main-stage--with-bottom-viewbar' : ''}${showTimelineFloatingToolbar ? ' tm-main-stage--timeline-mobile-toolbar' : ''}" style="--tm-view-bottom-inset:${mainStageBottomInset};">
                    ${timelineFloatingToolbarHtml}
                    ${bodyWithSideDockHtml}
                    ${multiSelectBarHtml}
                    ${taskDetailSheetHtml}
                </div>
                ${showMobileBottomViewBar ? `
                    <div class="tm-mobile-bottom-viewbar ${mobileBottomViewbarActive ? 'tm-mobile-bottom-viewbar--active' : ''}${mobileBottomViewbarSwitching ? ' tm-mobile-bottom-viewbar--switching' : ''}" onpointerdown="tmTouchMobileBottomViewbar(event)" onclick="tmTouchMobileBottomViewbar(event)">
                        <div class="tm-mobile-bottom-viewbar__inner">
                            <div class="tm-view-segmented bc-tabs-list tm-mobile-bottom-view-switcher" role="tablist" aria-label="视图">
                                ${__tmRenderViewSwitcherButtons({ compact: true, mobileBottom: true })}
                            </div>
                        </div>
                    </div>
                ` : ''}
                ${isMobile && state.aiMobilePanelOpen && __tmIsAiFeatureEnabled() ? `
                    <div class="tm-ai-mobile-shell">
                        <div class="tm-ai-mobile-mask" onclick="tmCloseAiSidebar()"></div>
                        <div class="tm-ai-mobile-panel">
                            <div id="tmAiMobileSidebarPanel" style="height:100%;min-height:0;"></div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        try { if (renderMode === 'kanban' && typeof __tmNormalizeKanbanDetailFloatHost === 'function') __tmNormalizeKanbanDetailFloatHost(state.modal); } catch (e) {}
        try { __tmBindPluginHostGestureIsolation(state.modal); } catch (e) {}
        try { __tmBindChecklistSheetTouchFallback(state.modal); } catch (e) {}
        try { if (renderMode === 'kanban') __tmBindKanbanPan(state.modal); } catch (e) {}
        try { if (renderMode === 'whiteboard') __tmBindWhiteboardViewportInput(state.modal); } catch (e) {}
        const finalMountRoot = nextMountRoot || __tmGetMountRoot();
        try {
            const keepMountedShell = (useSoftSwap && prevModalEl instanceof HTMLElement && prevModalEl.parentElement === finalMountRoot)
                ? prevModalEl
                : null;
            __tmPruneMountedManagerShells(finalMountRoot, keepMountedShell);
        } catch (e) {}
        finalMountRoot.appendChild(state.modal);
        try { if (renderMode === 'kanban') __tmScheduleKanbanBottomNavAvoidance(state.modal); } catch (e) {}
        rememberViewDomRenderSignature();
        try { __tmSyncInlineLoadingOverlay(state.modal); } catch (e) {}
        const bindDeferredNonCriticalShellWork = () => {
            try { __tmBindDockScrollIsolation(state.modal); } catch (e) {}
            try { __tmBindTopbarOverflowTooltips(state.modal); } catch (e) {}
            try { __tmBindDocTabsAutoHide(state.modal); } catch (e) {}
            try { __tmBindResponsiveTableResize(state.modal); } catch (e) {}
            try { __tmBindFloatingTooltips(state.modal); } catch (e) {}
            try { __tmBindDocTabWheelScroll(state.modal); } catch (e) {}
            try { __tmBindBottomViewbarWheelScroll(state.modal); } catch (e) {}
            try { __tmBindDocTabScrollMemory(state.modal); } catch (e) {}
        };
        if (!deferSnapshotLayoutWork(bindDeferredNonCriticalShellWork, 160)) bindDeferredNonCriticalShellWork();
        const bindDeferredDocTabLayoutWork = () => {
            try { __tmBindDocTabsOverflowToggle(state.modal); } catch (e) {}
            try { __tmRestoreDocTabScroll(state.modal, savedDocTabsScrollLeft, savedDocTabsScrollTop); } catch (e) {}
            try { __tmEnsureActiveDocTabVisible(state.modal); } catch (e) {}
        };
        if (!deferSnapshotLayoutWork(bindDeferredDocTabLayoutWork, 80)) bindDeferredDocTabLayoutWork();
        try { __tmBindMultiSelectPointerSweep(state.modal); } catch (e) {}
        try {
            if (renderMode === 'whiteboard' && typeof __tmUpdateWhiteboardNavigator === 'function') {
                __tmUpdateWhiteboardNavigator();
            }
        } catch (e) {}
        try { __tmBindDockPointerTaskDrag(state.modal); } catch (e) {}
        const bindDeferredMainScrollLayoutWork = () => {
            try { if (renderMode === 'list') __tmBindListScrollVisibility(state.modal); } catch (e) {}
            try { if (renderMode === 'checklist') __tmBindChecklistScrollVisibility(state.modal); } catch (e) {}
            try { if (renderMode === 'list') __tmBindAutoLoadMoreOnScroll(state.modal, 'list'); } catch (e) {}
            try { if (renderMode === 'checklist') __tmBindAutoLoadMoreOnScroll(state.modal, 'checklist'); } catch (e) {}
        };
        if (!deferSnapshotLayoutWork(bindDeferredMainScrollLayoutWork, 120)) bindDeferredMainScrollLayoutWork();
        try { __tmBindMobileViewportAutoRefresh(state.modal); } catch (e) {}
        try {
            if (showTaskDetailSheet) {
                const selectedId = String(taskDetailSheetTaskId || '').trim();
                const detailPanel = state.modal?.querySelector?.('#tmTaskDetailSheetPanel');
                const selectedTask = selectedId
                    ? (taskDetailSheetTask || globalThis.__tmRuntimeState?.getFlatTaskById?.(selectedId) || state.flatTasks?.[selectedId] || null)
                    : null;
                if (detailPanel instanceof HTMLElement && selectedTask) {
                    try { detailPanel.__tmTaskDetailTask = selectedTask; } catch (e) {}
                    try { detailPanel.dataset.tmDetailTaskId = selectedId; } catch (e) {}
                    __tmBindTaskDetailEditor(detailPanel, selectedId, {
                        embedded: true,
                        source: 'render-task-detail-sheet-post-bind',
                        task: selectedTask,
                        onClose: () => {
                            window.tmTaskDetailSheetClose?.();
                        }
                    });
                }
            }
        } catch (e) {}
        try {
            if (renderMode === 'checklist') {
                const selectedId = String(state.detailTaskId || '').trim();
                const detailPanel = __tmResolveChecklistDetailPanel(state.modal).panel;
                const selectedTask = selectedId
                    ? (globalThis.__tmRuntimeState?.getFlatTaskById?.(selectedId) || state.flatTasks?.[selectedId] || null)
                    : null;
                if (detailPanel instanceof HTMLElement && selectedTask) {
                    try { detailPanel.__tmTaskDetailTask = selectedTask; } catch (e) {}
                    try { detailPanel.dataset.tmDetailTaskId = selectedId; } catch (e) {}
                    __tmBindTaskDetailEditor(detailPanel, selectedId, {
                        embedded: true,
                        source: 'render-checklist-post-bind',
                        task: selectedTask,
                        onClose: () => {
                            state.detailTaskId = '';
                            state.checklistDetailDismissed = true;
                            state.checklistDetailSheetOpen = false;
                            state.checklistDetailSheetFullscreen = false;
                            if (!__tmRefreshChecklistSelectionInPlace(state.modal, 'detail-close')) render();
                        }
                    });
}
            }
        } catch (e) {}
        const bindDeferredTaskNameMarks = () => {
            try { __tmApplyReminderTaskNameMarks(state.modal); } catch (e) {}
            try { __tmScheduleReminderTaskNameMarksRefresh(state.modal); } catch (e) {}
            try { __tmApplyTodayScheduledTaskNameMarks(state.modal); } catch (e) {}
            try { __tmScheduleTodayScheduledTaskNameMarksRefresh(state.modal); } catch (e) {}
        };
        if (!deferSnapshotLayoutWork(bindDeferredTaskNameMarks, 220)) {
            bindDeferredTaskNameMarks();
        }
        try {
            if (renderMode === 'calendar') {
                const el = state.modal.querySelector('#tmCalendarRoot');
                if (el) {
                    const restoreCalendarScrollAfterMount = () => {
                        const apply = () => {
                            try {
                                if (!el || !el.querySelectorAll) return;
                                const preferred = el.querySelector('.fc-timegrid-body .fc-scroller');
                                const list = Array.from(el.querySelectorAll('.fc-scroller'));
                                const scroller = (preferred && preferred.scrollHeight > preferred.clientHeight + 1)
                                    ? preferred
                                    : (list.find((item) => item && item.scrollHeight > item.clientHeight + 1) || preferred || list[0] || null);
                                if (!scroller) return;
                                scroller.scrollTop = savedCalendarScrollTop;
                                scroller.scrollLeft = savedCalendarScrollLeft;
                            } catch (e2) {}
                        };
                        apply();
                        try { requestAnimationFrame(() => requestAnimationFrame(apply)); } catch (e2) {}
                        try { setTimeout(apply, 0); } catch (e2) {}
                    };
                    const mountCalendar = (deferredMount = false) => {
                        const startedAt = Date.now();
                        if (!SettingsStore.data.calendarEnabled) {
                            el.innerHTML = `<div style="padding:12px;color:var(--tm-secondary-text);">日历视图已关闭，可在设置 → 日历中开启。</div>`;
                        } else if (globalThis.__tmCalendar && typeof globalThis.__tmCalendar.mount === 'function') {
                            const ok = globalThis.__tmCalendar.mount(el, { settingsStore: SettingsStore });
                            if (!ok) {
                                el.innerHTML = `<div style="padding:12px;color:var(--tm-secondary-text);">日历初始化失败，请确认 FullCalendar 已加载。</div>`;
                            } else {
                                restoreCalendarScrollAfterMount();
                            }
                        } else {
                            el.innerHTML = `<div style="padding:12px;color:var(--tm-secondary-text);">日历模块未加载。</div>`;
                        }
                    };
                    if (!SettingsStore.data.calendarEnabled) {
                        el.innerHTML = `<div style="padding:12px;color:var(--tm-secondary-text);">日历视图已关闭，可在设置 → 日历中开启。</div>`;
                    } else {
                        mountCalendar(false);
                    }
                }
            }
            if (renderMode === 'whiteboard') {
                __tmApplyWhiteboardTransform();
                __tmScheduleWhiteboardEdgeRedraw();
            }
            if (showCalendarSideDock) {
                __tmCalendarDockMount();
            } else if (globalThis.__tmCalendar && typeof globalThis.__tmCalendar.unmountSideDayTimeline === 'function') {
                try { globalThis.__tmCalendar.unmountSideDayTimeline(); } catch (e) {}
            }
            if ((showAiSideDock || (isMobile && state.aiMobilePanelOpen && __tmIsAiFeatureEnabled()))) {
                try { __tmMountAiSidebarHost(); } catch (e) {}
            }
            if (state.homepageOpen) {
                try { __tmMountHomepageRoot(); } catch (e) {}
            } else {
                try { __tmInvalidateHomepageMount(); } catch (e) {}
                try { globalThis.__tmHomepage?.unmount?.(); } catch (e) {}
            }
        } catch (e) {}

        // 恢复滚动位置
        try {
            const isHomepage = renderMode === 'home';
            const isTimeline = renderMode === 'timeline';
            const isChecklist = renderMode === 'checklist';
            const isKanban = renderMode === 'kanban';
            const isWhiteboard = renderMode === 'whiteboard';
            const pickNum = (v, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
            const listTop = pickNum(state.viewScroll?.list?.top, 0);
            const listLeft = pickNum(state.viewScroll?.list?.left, 0);
            const homeTop = pickNum(state.viewScroll?.home?.top, 0);
            const homeLeft = pickNum(state.viewScroll?.home?.left, 0);
            const timelineTop = pickNum(state.viewScroll?.timeline?.top, 0);
            const timelineLeft = pickNum(state.viewScroll?.timeline?.left, 0);
            const calendarTop = pickNum(state.viewScroll?.calendar?.top, 0);
            const calendarLeft = pickNum(state.viewScroll?.calendar?.left, 0);
            const kanbanLeft = pickNum(state.viewScroll?.kanban?.left, 0);
            const kanbanCols = (state.viewScroll?.kanban?.cols && typeof state.viewScroll.kanban.cols === 'object')
                ? state.viewScroll.kanban.cols
                : {};
            const wbSidebarTop = pickNum(state.viewScroll?.whiteboard?.sidebarTop, 0);
            const wbBodyTop = pickNum(state.viewScroll?.whiteboard?.top, 0);
            const wbBodyLeft = pickNum(state.viewScroll?.whiteboard?.left, 0);
            const desiredTop = isHomepage ? homeTop : (prevWasTimeline ? timelineTop : listTop);
            const desiredLeft = isHomepage ? homeLeft : (isTimeline ? timelineLeft : listLeft);

            if (isHomepage) {
                const body = state.modal.querySelector('.tm-body.tm-body--homepage');
                const apply = () => {
                    try {
                        if (body) {
                            body.scrollTop = desiredTop;
                            body.scrollLeft = desiredLeft;
                        }
                    } catch (e) {}
                };
                apply();
                if (desiredTop > 0 || desiredLeft > 0) {
                    requestAnimationFrame(() => requestAnimationFrame(apply));
                }
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    if (useSoftSwap) {
                        try { state.modal.style.opacity = '1'; } catch (e) {}
                        try { state.modal.style.pointerEvents = ''; } catch (e) {}
                        if (prevModalEl) {
                            setTimeout(() => { try { prevModalEl.remove(); } catch (e2) {} }, 340);
                        }
                    }
                }));
            } else if (isTimeline) {
                const leftBody = state.modal.querySelector('#tmTimelineLeftBody');
                const ganttBody = state.modal.querySelector('#tmGanttBody');
                const ganttHeader = state.modal.querySelector('#tmGanttHeader');
                const timelineScrollHost = __tmGetTimelineGlobalScrollHost(state.modal);
                const useGlobalScroll = !!timelineScrollHost;
                try { __tmBindTimelineLeftCollapseInteractions(leftBody); } catch (e) {}

                if (useGlobalScroll) {
                    try { if (leftBody) leftBody.scrollTop = 0; } catch (e) {}
                    try {
                        if (ganttBody) {
                            ganttBody.scrollTop = 0;
                            ganttBody.scrollLeft = 0;
                        }
                    } catch (e) {}
                    try {
                        timelineScrollHost.scrollTop = desiredTop;
                        timelineScrollHost.scrollLeft = desiredLeft;
                    } catch (e) {}
                    try { __tmSyncTimelineMobileGroupStickyOffset(state.modal); } catch (e) {}
                } else {
                    if (leftBody) leftBody.scrollTop = desiredTop;
                    if (ganttBody) {
                        ganttBody.scrollTop = desiredTop;
                        ganttBody.scrollLeft = desiredLeft;
                    }
                }

                // 渲染 Gantt
                const rowModel = Array.isArray(timelineRowModel)
                    ? timelineRowModel
                    : (Array.isArray(globalThis.__tmTimelineRowModel) ? globalThis.__tmTimelineRowModel : __tmBuildTaskRowModel());
                const view = globalThis.__TaskHorizonGanttView;
                if (view && typeof view.render === 'function' && ganttHeader && ganttBody) {
                    view.render({
                        headerEl: ganttHeader,
                        bodyEl: ganttBody,
                        rowModel,
                        getTaskById: (id) => globalThis.__tmRuntimeState?.getFlatTaskById?.(String(id)) || state.flatTasks[String(id)],
                        viewState: state.ganttView,
                        onUpdateTaskDates: async (taskId, patch) => {
                            const id = String(taskId || '').trim();
                            if (!id) return;
                            const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id];
                            if (!task) return;
                            const hasStartDate = Object.prototype.hasOwnProperty.call(patch || {}, 'startDate');
                            const hasCompletionTime = Object.prototype.hasOwnProperty.call(patch || {}, 'completionTime');
                            if (!hasStartDate && !hasCompletionTime) return;
                            const datePatch = {};
                            if (hasStartDate) {
                                const startDate = String(patch?.startDate || '').trim();
                                const nextStart = startDate ? __tmNormalizeDateOnly(startDate) : '';
                                datePatch.startDate = nextStart;
                                task.startDate = nextStart;
                                task.start_date = nextStart;
                            }
                            if (hasCompletionTime) {
                                const completionTime = String(patch?.completionTime || '').trim();
                                const nextEnd = completionTime ? __tmNormalizeDateOnly(completionTime) : '';
                                datePatch.completionTime = nextEnd;
                                task.completionTime = nextEnd;
                                task.completion_time = nextEnd;
                            }
                            try {
                                const patchTask = globalThis.__tmRequireTaskOutbox?.('patchTask');
                                if (typeof patchTask !== 'function') throw new Error('任务写入队列未就绪: patchTask');
                                void patchTask(id, datePatch, {
                                    source: 'gantt-date-drag',
                                    reason: 'gantt-date-drag',
                                    label: '甘特日期',
                                    wait: false,
                                    background: true,
                                    skipSettledRefresh: true,
                                    forceProjectionRefresh: true,
                                }).catch((error) => {
                                    try { globalThis.__tmReportTaskOutboxFailure?.(error, { action: '更新甘特日期' }); } catch (e2) {}
                                });
                                try { __tmRefreshTaskTimeAcrossViews(id, { patch: datePatch, withFilters: true, reason: 'gantt-date-drag' }); } catch (e2) {
                                    try { __tmScheduleViewRefresh({ mode: 'current', withFilters: true, reason: 'gantt-date-drag' }); } catch (e3) {}
                                }
                            } catch (e) {
                                hint(`❌ 更新失败: ${e.message}`, 'error');
                            }
                        },
                        onUpdateTaskMeta: async (taskId, patch) => {
                            const id = String(taskId || '').trim();
                            if (!id || !patch || typeof patch !== 'object') return;
                            const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id];
                            if (!task) return;
                            const hasMilestone = Object.prototype.hasOwnProperty.call(patch, 'milestone');
                            if (!hasMilestone) return;
                            const val = !!patch.milestone;
                            task.milestone = val;
                            try {
                                const patch = { milestone: val ? '1' : '' };
                                const patchTask = globalThis.__tmRequireTaskOutbox?.('patchTask');
                                if (typeof patchTask !== 'function') throw new Error('任务写入队列未就绪: patchTask');
                                void patchTask(id, patch, {
                                    source: 'gantt-milestone-toggle',
                                    reason: 'gantt-milestone-toggle',
                                    label: '甘特里程碑',
                                    wait: false,
                                    background: true,
                                    skipSettledRefresh: true,
                                    forceProjectionRefresh: true,
                                }).catch((error) => {
                                    try { globalThis.__tmReportTaskOutboxFailure?.(error, { action: '更新甘特里程碑' }); } catch (e2) {}
                                });
                                try { __tmRefreshTaskFieldsAcrossViews(id, patch, { withFilters: true, reason: 'gantt-milestone-toggle' }); } catch (e2) {
                                    try { __tmScheduleViewRefresh({ mode: 'current', withFilters: true, reason: 'gantt-milestone-toggle' }); } catch (e3) {}
                                }
                            } catch (e) {
                                hint(`❌ 更新失败: ${e.message}`, 'error');
                            }
                        },
                    });
                    if (!useGlobalScroll) {
                        try { ganttBody.scrollLeft = desiredLeft; } catch (e) {}
                    }
                }
                __tmScheduleTimelineTodayIndicatorRefresh();

                const syncHeaderX = () => {
                    if (useGlobalScroll || !ganttBody || !ganttHeader) return;
                    const inner = ganttHeader.querySelector('.tm-gantt-header-inner');
                    if (!inner) return;
                    inner.style.transform = `translateX(${-ganttBody.scrollLeft}px)`;
                };
                if (useGlobalScroll) {
                    try {
                        const inner = ganttHeader?.querySelector?.('.tm-gantt-header-inner');
                        if (inner) inner.style.transform = '';
                    } catch (e) {}
                    try { __tmSyncTimelineMobileGroupStickyOffset(state.modal); } catch (e) {}
                } else {
                    syncHeaderX();
                }

                // 强制左侧对齐（如果需要）
                const forcedLeft = Number(state.ganttView?.__forceScrollLeft);
                if (Number.isFinite(forcedLeft)) {
                     if (useGlobalScroll) {
                         try { timelineScrollHost.scrollLeft = forcedLeft; } catch (e) {}
                     } else if (ganttBody) {
                         ganttBody.scrollLeft = forcedLeft;
                     }
                     delete state.ganttView.__forceScrollLeft;
                }

                requestAnimationFrame(() => requestAnimationFrame(() => {
                    try { __tmSyncTimelineDateColumnWidths(state.modal); } catch (e) {}
                    if (useGlobalScroll) {
                        try { if (leftBody) leftBody.scrollTop = 0; } catch (e) {}
                        try {
                            if (ganttBody) {
                                ganttBody.scrollTop = 0;
                                ganttBody.scrollLeft = 0;
                            }
                        } catch (e) {}
                        try {
                            timelineScrollHost.scrollTop = desiredTop;
                            timelineScrollHost.scrollLeft = desiredLeft;
                        } catch (e) {}
                        try { __tmSyncTimelineMobileGroupStickyOffset(state.modal); } catch (e) {}
                    } else {
                        try { if (leftBody) leftBody.scrollTop = desiredTop; } catch (e) {}
                        try { if (ganttBody) ganttBody.scrollTop = desiredTop; } catch (e) {}
                        try { if (ganttBody) ganttBody.scrollLeft = desiredLeft; } catch (e) {}
                        try { syncHeaderX(); } catch (e) {}
                    }
                    runFlipAnimationAfterRender();

                    if (useSoftSwap) {
                         try { state.modal.style.opacity = '1'; } catch (e) {}
                         try { state.modal.style.pointerEvents = ''; } catch (e) {}
                         if (prevModalEl) {
                             setTimeout(() => { try { prevModalEl.remove(); } catch (e2) {} }, 340);
                         }
                    }
                }));

                const syncRowHeights = (force = false) => {
                    if (!leftBody || !ganttBody) return;
                    if (!force && Date.now() - (Number(state.__tmFlipTs) || 0) < 320) return;
                    const leftRows = leftBody.querySelectorAll('tbody tr');
                    const rightRows = ganttBody.querySelectorAll('.tm-gantt-row,.tm-gantt-row--group');
                    const n = Math.min(leftRows.length, rightRows.length);
                    if (n <= 0) return;
                    for (let i = 0; i < n; i++) {
                        const lr = leftRows[i];
                        const rr = rightRows[i];
                        if (!(lr instanceof Element) || !(rr instanceof Element)) continue;
                        rr.style.height = '';
                        rr.style.minHeight = '';
                        rr.style.maxHeight = '';
                        if ((lr.style.display || '') === 'none') continue;
                        const h = lr.getBoundingClientRect?.().height;
                        if (Number.isFinite(h) && h > 0) {
                            rr.style.height = `${h}px`;
                            rr.style.minHeight = `${h}px`;
                            rr.style.maxHeight = `${h}px`;
                        }
                        const bar = rr.querySelector?.('.tm-gantt-bar');
                        if (bar) {
                            bar.style.top = 'calc((var(--tm-row-height) - var(--tm-gantt-card-height)) / 2)';
                            bar.style.transform = 'none';
                        }
                    }
                    try { state.__tmTimelineRenderDeps?.(); } catch (e) {}
                };
                try {
                    syncRowHeights(true);
                    requestAnimationFrame(() => requestAnimationFrame(() => {
                        syncRowHeights();
                        setTimeout(syncRowHeights, 60);
                        setTimeout(syncRowHeights, 260);
                        setTimeout(syncRowHeights, 420);
                    }));
                } catch (e) {}

                requestAnimationFrame(() => requestAnimationFrame(() => {
                    if (!Number.isFinite(Number(SettingsStore.data.timelineLeftWidth)) || Number(SettingsStore.data.timelineLeftWidth) <= 0) {
                        const leftTable = state.modal?.querySelector?.('#tmTimelineLeftTable');
                        const w = leftTable?.getBoundingClientRect?.().width;
                        if (Number.isFinite(w) && w > 0) {
                            SettingsStore.data.timelineLeftWidth = Math.max(360, Math.min(900, Math.round(w)));
                            try { SettingsStore.save(); } catch (e) {}
                        }
                    }
                }));

                if (leftBody && ganttBody) {
                    const onGroupClick = (ev) => {
                        const el = ev?.target instanceof Element ? ev.target.closest('.tm-gantt-row--group') : null;
                        if (!el) return;
                        const key = String(el.getAttribute('data-group-key') || '').trim();
                        if (!key) return;
                        tmToggleGroupCollapse(key, ev);
                    };
                    if (useGlobalScroll) {
                        const syncMobileGroupX = () => {
                            try { __tmSyncTimelineMobileGroupStickyOffset(state.modal, { defer: true }); } catch (e) {}
                        };
                        try { __tmSyncTimelineMobileGroupStickyOffset(state.modal); } catch (e) {}
                        try {
                            const prevSync = timelineScrollHost?.__tmTimelineMobileGroupXSync;
                            if (typeof prevSync === 'function') timelineScrollHost.removeEventListener('scroll', prevSync);
                            timelineScrollHost.__tmTimelineMobileGroupXSync = syncMobileGroupX;
                            timelineScrollHost.addEventListener('scroll', syncMobileGroupX, { passive: true });
                        } catch (e) {}
                        ganttBody.addEventListener('click', onGroupClick, true);
                    } else {
                    const onGanttWheel = (ev) => {
                        if (!ev?.shiftKey) return;
                        if (!ganttBody) return;
                        const canScrollX = (ganttBody.scrollWidth - ganttBody.clientWidth) > 2;
                        if (!canScrollX) return;
                        let delta = 0;
                        const dx = Number(ev.deltaX) || 0;
                        const dy = Number(ev.deltaY) || 0;
                        delta = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
                        if (!Number.isFinite(delta) || delta === 0) return;
                        if (ev.deltaMode === 1) delta *= 16;
                        else if (ev.deltaMode === 2) delta *= ganttBody.clientWidth;
                        ganttBody.scrollLeft = ganttBody.scrollLeft + delta;
                    };
                    let syncing = false;
                    const syncFromLeft = () => {
                        if (syncing) return;
                        syncing = true;
                        requestAnimationFrame(() => {
                            try { ganttBody.scrollTop = leftBody.scrollTop; } catch (e) {}
                            syncing = false;
                        });
                    };
                    const syncFromRight = () => {
                        if (syncing) return;
                        syncing = true;
                        requestAnimationFrame(() => {
                            try { leftBody.scrollTop = ganttBody.scrollTop; } catch (e) {}
                            syncing = false;
                        });
                    };
                    leftBody.addEventListener('scroll', syncFromLeft, { passive: true });
                    ganttBody.addEventListener('scroll', () => {
                        syncHeaderX();
                        syncFromRight();
                    }, { passive: true });
                    if (ganttHeader) ganttHeader.addEventListener('wheel', onGanttWheel, { passive: true });
                    ganttBody.addEventListener('click', onGroupClick, true);
                    }
                } else if (ganttBody) {
                    if (!useGlobalScroll) ganttBody.addEventListener('scroll', syncHeaderX, { passive: true });
                    const onGanttWheel = (ev) => {
                        if (!ev?.shiftKey) return;
                        const canScrollX = (ganttBody.scrollWidth - ganttBody.clientWidth) > 2;
                        if (!canScrollX) return;
                        let delta = 0;
                        const dx = Number(ev.deltaX) || 0;
                        const dy = Number(ev.deltaY) || 0;
                        delta = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
                        if (!Number.isFinite(delta) || delta === 0) return;
                        if (ev.deltaMode === 1) delta *= 16;
                        else if (ev.deltaMode === 2) delta *= ganttBody.clientWidth;
                        ganttBody.scrollLeft = ganttBody.scrollLeft + delta;
                    };
                    if (!useGlobalScroll && ganttHeader) ganttHeader.addEventListener('wheel', onGanttWheel, { passive: true });
                }
            } else {
                const isCalendar = state.viewMode === 'calendar';
                if (isCalendar) {
                    const root = state.modal.querySelector('#tmCalendarRoot');
                    const apply = () => {
                        try {
                            if (!root || !root.querySelectorAll) return;
                            const preferred = root.querySelector('.fc-timegrid-body .fc-scroller');
                            const list = Array.from(root.querySelectorAll('.fc-scroller'));
                            const scroller = (preferred && preferred.scrollHeight > preferred.clientHeight + 1)
                                ? preferred
                                : (list.find((el) => el && el.scrollHeight > el.clientHeight + 1) || preferred || list[0] || null);
                            if (!scroller) return;
                            scroller.scrollTop = calendarTop;
                            scroller.scrollLeft = calendarLeft;
                        } catch (e) {}
                    };
                    apply();
                    requestAnimationFrame(() => requestAnimationFrame(apply));
                    setTimeout(apply, 0);
                    requestAnimationFrame(() => requestAnimationFrame(() => {
                        runFlipAnimationAfterRender();
                        if (useSoftSwap) {
                            try { state.modal.style.opacity = '1'; } catch (e) {}
                            try { state.modal.style.pointerEvents = ''; } catch (e) {}
                            if (prevModalEl) {
                                setTimeout(() => { try { prevModalEl.remove(); } catch (e2) {} }, 340);
                            }
                        }
                    }));
                } else if (isKanban) {
                    const kbBody = state.modal.querySelector('.tm-body.tm-body--kanban');
                    const isKanbanSnapHost = !!(kbBody instanceof HTMLElement && __tmIsKanbanColumnSnapMode(kbBody));
                    const pendingSnapColumnKey = String(state.__tmKanbanPendingSnapColumnKey || '').trim();
                    if (pendingSnapColumnKey) {
                        try { delete state.__tmKanbanPendingSnapColumnKey; } catch (e) { state.__tmKanbanPendingSnapColumnKey = ''; }
                    }
                    const applyHorizontal = (options = {}) => {
                        try {
                            if (kbBody) {
                                __tmSyncKanbanSnapMetrics(kbBody, { force: true });
                                const targetColumnLeft = pendingSnapColumnKey
                                    ? __tmGetKanbanColumnSnapLeftByKey(kbBody, pendingSnapColumnKey)
                                    : NaN;
                                if (Number.isFinite(targetColumnLeft)) {
                                    kbBody.scrollLeft = targetColumnLeft;
                                    if (options.snap !== false) {
                                        __tmSnapKanbanToNearestColumn(kbBody, { behavior: 'auto', targetLeft: targetColumnLeft });
                                    }
                                    try { __tmSyncKanbanBoardNav(kbBody, { force: true }); } catch (e2) {}
                                    return;
                                }
                                kbBody.scrollLeft = kanbanLeft;
                                if (options.snap !== false) {
                                    __tmSnapKanbanToNearestColumn(kbBody, { behavior: 'auto' });
                                }
                            }
                        } catch (e) {}
                    };
                    const applyColumnScrolls = () => {
                        try {
                            state.modal.querySelectorAll('.tm-kanban-col').forEach((col) => {
                                const colKey = __tmGetKanbanColScrollKey(col);
                                if (!colKey) return;
                                const colBody = col.querySelector('.tm-kanban-col-body');
                                if (!(colBody instanceof HTMLElement)) return;
                                const status = String(col.getAttribute('data-status') || '').trim();
                                const legacyKey = status || '';
                                const top = pickNum(kanbanCols[colKey], pickNum(kanbanCols[legacyKey], 0));
                                const currentTop = Number(colBody.scrollTop || 0);
                                if (isKanbanSnapHost && !state.__tmKanbanForceRestoreColScrollOnce && Math.abs(currentTop) > 1 && Math.abs(currentTop - top) > 1) return;
                                colBody.scrollTop = top;
                            });
                        } catch (e) {}
                    };
                    const refreshKanbanDetail = (source) => {
                        try { __tmRefreshKanbanDetailInPlace(state.modal, { scrollSnapshot: savedKanbanDetailScrollSnapshot, source }); } catch (e) {}
                    };
                    const finishKanbanRender = () => {
                        runFlipAnimationAfterRender();
                        if (useSoftSwap) {
                            try { state.modal.style.opacity = '1'; } catch (e) {}
                            try { state.modal.style.pointerEvents = ''; } catch (e) {}
                            if (prevModalEl) {
                                setTimeout(() => { try { prevModalEl.remove(); } catch (e2) {} }, 340);
                            }
                        }
                    };
                    if (isKanbanSnapHost) {
                        applyHorizontal({ snap: Math.abs(Number(kanbanLeft) || 0) > 0.5 });
                        applyColumnScrolls();
                        try { state.__tmKanbanForceRestoreColScrollOnce = false; } catch (e) {}
                        refreshKanbanDetail('render-kanban-post-bind');
                        requestAnimationFrame(() => requestAnimationFrame(finishKanbanRender));
                    } else {
                        const apply = () => {
                            applyHorizontal({ snap: true });
                            applyColumnScrolls();
                            try { state.__tmKanbanForceRestoreColScrollOnce = false; } catch (e) {}
                        };
                        apply();
                        refreshKanbanDetail('render-kanban-post-bind');
                        requestAnimationFrame(() => requestAnimationFrame(apply));
                        requestAnimationFrame(() => requestAnimationFrame(() => {
                            refreshKanbanDetail('render-kanban-post-raf');
                            finishKanbanRender();
                        }));
                    }
                } else if (isWhiteboard) {
                    const sidebar = state.modal.querySelector('.tm-whiteboard-sidebar');
                    const body = state.modal.querySelector('#tmWhiteboardBody');
                    const apply = () => {
                        try { if (sidebar) sidebar.scrollTop = wbSidebarTop; } catch (e) {}
                        try {
                            if (body) {
                                body.scrollTop = wbBodyTop;
                                body.scrollLeft = wbBodyLeft;
                            }
                        } catch (e) {}
                    };
                    apply();
                    requestAnimationFrame(() => requestAnimationFrame(apply));
                    requestAnimationFrame(() => requestAnimationFrame(() => {
                        runFlipAnimationAfterRender();
                        try { __tmScheduleWhiteboardEdgeRedraw(); } catch (e) {}
                        if (useSoftSwap) {
                            try { state.modal.style.opacity = '1'; } catch (e) {}
                            try { state.modal.style.pointerEvents = ''; } catch (e) {}
                            if (prevModalEl) {
                                setTimeout(() => { try { prevModalEl.remove(); } catch (e2) {} }, 340);
                            }
                        }
                    }));
                } else if (isChecklist) {
                    const pane = state.modal.querySelector('.tm-checklist-scroll');
                    const apply = () => {
                        try {
                            if (pane) {
                                pane.scrollTop = desiredTop;
                                pane.scrollLeft = desiredLeft;
                                try { pane.__tmChecklistScrollUpdateThumb?.(); } catch (e) {}
                            }
                        } catch (e) {}
                        try { __tmRestoreChecklistDetailScrollSnapshot(savedChecklistDetailScrollSnapshot, state.modal); } catch (e) {}
                    };
                    apply();
                    requestAnimationFrame(() => requestAnimationFrame(apply));
                    requestAnimationFrame(() => requestAnimationFrame(() => {
                        try { __tmRestoreChecklistDetailScrollSnapshot(savedChecklistDetailScrollSnapshot, state.modal); } catch (e) {}
                        runFlipAnimationAfterRender();
                        if (useSoftSwap) {
                            try { state.modal.style.opacity = '1'; } catch (e) {}
                            try { state.modal.style.pointerEvents = ''; } catch (e) {}
                            if (prevModalEl) {
                                setTimeout(() => { try { prevModalEl.remove(); } catch (e2) {} }, 340);
                            }
                        }
                    }));
                } else {
                    // 列表模式
                    const body = state.modal.querySelector('.tm-body');
                    if (body) {
                        body.scrollTop = desiredTop;
                        body.scrollLeft = desiredLeft;
                        try { body.__tmTableScrollUpdateThumb?.(); } catch (e) {}
                    }

                    requestAnimationFrame(() => requestAnimationFrame(() => {
                         try { if (body) body.scrollTop = desiredTop; } catch (e) {}
                         try { body?.__tmTableScrollUpdateThumb?.(); } catch (e) {}
                         runFlipAnimationAfterRender();
                         if (state.viewMode === 'whiteboard') {
                             try { __tmScheduleWhiteboardEdgeRedraw(); } catch (e) {}
                         }

                         if (useSoftSwap) {
                             try { state.modal.style.opacity = '1'; } catch (e) {}
                             try { state.modal.style.pointerEvents = ''; } catch (e) {}
                             if (prevModalEl) {
                                 setTimeout(() => { try { prevModalEl.remove(); } catch (e2) {} }, 340);
                             }
                         }
                    }));
                }
            }
        } catch (e) {}

        if (isViewSwitchAnim) {
            try { state.uiAnimKind = ''; } catch (e) {}
        }
        __tmJankRenderFinish('complete', {
            softSwap: useSoftSwap === true,
            snapshotFirstRenderFastPath: isSnapshotFirstRenderFastPath === true,
        });
    }


    // 新增的规则应用函数
    window.applyFilterRule = async function(ruleId) {
        const prevCustomFieldPlan = __tmBuildRuntimeCustomFieldLoadPlan();
        if (ruleId) {
            state.currentRule = ruleId;
            SettingsStore.data.currentRule = ruleId;
        } else {
            state.currentRule = null;
            SettingsStore.data.currentRule = null;
        }
        __tmPersistGlobalViewProfileFromCurrentState();
        await SettingsStore.save();
        const nextRule = ruleId ? state.filterRules.find(r => r.id === ruleId) : null;
        const nextDoneOnly = __tmRuleNeedsDoneOnly(nextRule);
        state.__tmQueryDoneOnly = nextDoneOnly;
        const nextCustomFieldPlan = __tmBuildRuntimeCustomFieldLoadPlan({ rule: nextRule });
        if (__tmDoesCustomFieldPlanNeedReload(prevCustomFieldPlan, nextCustomFieldPlan)) {
            await loadSelectedDocuments();
            if (ruleId) {
                const rule = state.filterRules.find(r => r.id === ruleId);
                if (rule) {
                    hint(`✅ 已应用规则: ${rule.name}`, 'success');
                }
            }
            return;
        }
        try {
            await __tmCommitCustomFieldLoadPlan(prevCustomFieldPlan, nextCustomFieldPlan, {
                hydrateVisible: false,
            });
        } catch (e) {}
        __tmScheduleRender({ withFilters: true });

        if (ruleId) {
            const rule = state.filterRules.find(r => r.id === ruleId);
            if (rule) {
                hint(`✅ 已应用规则: ${rule.name}`, 'success');
            }
        }
    };

    window.clearFilterRule = async function() {
        const prevCustomFieldPlan = __tmBuildRuntimeCustomFieldLoadPlan();
        state.currentRule = null;
        SettingsStore.data.currentRule = null;
        __tmPersistGlobalViewProfileFromCurrentState();
        await SettingsStore.save();
        state.__tmQueryDoneOnly = false;
        const nextCustomFieldPlan = __tmBuildRuntimeCustomFieldLoadPlan({ rule: null });
        if (__tmDoesCustomFieldPlanNeedReload(prevCustomFieldPlan, nextCustomFieldPlan)) {
            await loadSelectedDocuments();
            hint('✅ 已清除筛选规则', 'success');
            return;
        }
        try {
            await __tmCommitCustomFieldLoadPlan(prevCustomFieldPlan, nextCustomFieldPlan, {
                hydrateVisible: false,
            });
        } catch (e) {}
        __tmScheduleRender({ withFilters: true });
        hint('✅ 已清除筛选规则', 'success');
    };

    // 原有的其他函数保持不变...


    function __tmBuildCalendarSidebarDocItemsCacheKey() {
        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        const groupParts = [];
        for (const g of groups) {
            const gid = String(g?.id || '').trim();
            if (!gid) continue;
            const ds = __tmGetGroupSourceEntries(g).map((d) => {
                const did = String(d?.id || '').trim();
                if (!did) return '';
                return did + (d.kind === 'notebook' ? '#nb' : (d.recursive ? '*' : ''));
            }).filter(Boolean);
            groupParts.push(`${gid}:${ds.join(',')}`);
        }
        const legacyIds = Array.isArray(SettingsStore.data.selectedDocIds) ? SettingsStore.data.selectedDocIds : [];
        const quickAddDocId = String(SettingsStore.data.newTaskDocId || '').trim();
        const treeTaskSig = (() => {
            const parts = [];
            (Array.isArray(state.taskTree) ? state.taskTree : []).forEach((doc) => {
                const id = String(doc?.id || '').trim();
                const taskCount = Array.isArray(doc?.tasks) ? doc.tasks.length : 0;
                if (!id || taskCount <= 0) return;
                parts.push(`${id}:${taskCount}`);
            });
            return parts.sort().join(',');
        })();
        const calendarCacheSig = (() => {
            const cache = window.__tmCalendarAllTasksCache;
            const parts = [];
            if (Array.isArray(cache?.tasks)) {
                const seen = new Set();
                cache.tasks.forEach((task) => {
                    const docId = String(task?.root_id || task?.docId || '').trim();
                    if (!docId || seen.has(docId)) return;
                    seen.add(docId);
                    parts.push(docId);
                });
            }
            return [
                String(cache?.key || '').trim(),
                Number(cache?.ts) || 0,
                parts.sort().join(',')
            ].join('|');
        })();
        return [
            groupParts.join('|'),
            `legacy:${legacyIds.map((id) => String(id || '').trim()).filter(Boolean).join(',')}`,
            `quick:${quickAddDocId}`,
            `mode:${__tmGetDocDisplayNameMode()}`,
            `docs:${Number(__tmAllDocumentsFetchedAt) || 0}`,
            `tree:${treeTaskSig}`,
            `calendar:${calendarCacheSig}`
        ].join('||');
    }

    function __tmBuildCalendarSidebarDocItemsName(docId, docMap) {
        const did = String(docId || '').trim();
        if (!did) return '未命名文档';
        const map = docMap instanceof Map ? docMap : new Map();
        const meta = map.get(did) || { id: did, name: did };
        const raw = String(meta?.name || meta?.content || did).trim() || did;
        try {
            return __tmGetDocDisplayName(meta, raw) || raw;
        } catch (e) {}
        return raw;
    }

    window.tmCalendarGetSidebarDocItems = function() {
        const cached = window.__tmCalendarSidebarDocItemsCache;
        if (!cached || !cached.data || typeof cached.data !== 'object') return null;
        return cached.data;
    };

    window.tmCalendarWarmSidebarDocItems = async function(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const key = __tmBuildCalendarSidebarDocItemsCacheKey();
        const prev = window.__tmCalendarSidebarDocItemsCache;
        const cacheMaxAgeMs = 5000;
        if (!opts.force && prev && prev.key === key && prev.data && typeof prev.data === 'object' && (Date.now() - (Number(prev.ts) || 0) < cacheMaxAgeMs)) {
            return prev.data;
        }
        if (!opts.force && __tmCalendarSidebarDocItemsWarmPromise && __tmCalendarSidebarDocItemsWarmPromise.key === key) {
            return await __tmCalendarSidebarDocItemsWarmPromise.promise;
        }

        let tracked = null;
        const run = Promise.resolve().then(async () => {
            try { await window.tmCalendarWarmDocsToGroupCache?.(); } catch (e) {}
            try { await __tmEnsureAllDocumentsLoaded(false); } catch (e) {}

            const docsToGroup = window.__tmCalendarDocsToGroupCache?.map instanceof Map
                ? new Map(window.__tmCalendarDocsToGroupCache.map)
                : __tmGetCalendarDocsToGroupMapSync();
            const docMap = new Map();
            (Array.isArray(state.allDocuments) ? state.allDocuments : []).forEach((doc) => {
                const id = String(doc?.id || '').trim();
                if (!id || docMap.has(id)) return;
                docMap.set(id, doc);
            });
            (Array.isArray(state.taskTree) ? state.taskTree : []).forEach((doc) => {
                const id = String(doc?.id || '').trim();
                if (!id || docMap.has(id)) return;
                docMap.set(id, {
                    id,
                    name: String(doc?.name || '').trim() || id,
                    alias: String(doc?.alias || '').trim(),
                    icon: doc?.icon,
                });
            });
            const tasksMap = new Map();
            (Array.isArray(state.taskTree) ? state.taskTree : []).forEach((doc) => {
                const id = String(doc?.id || '').trim();
                if (!id || !Array.isArray(doc?.tasks) || doc.tasks.length <= 0) return;
                tasksMap.set(id, true);
            });
            (Array.isArray(window.__tmCalendarAllTasksCache?.tasks) ? window.__tmCalendarAllTasksCache.tasks : []).forEach((task) => {
                const docId = String(task?.root_id || task?.docId || '').trim();
                if (!docId) return;
                tasksMap.set(docId, true);
            });

            const calendarDocIds = {};
            const seenByCalendar = new Map();
            const pushDoc = (calendarId0, docId0) => {
                const calendarId = String(calendarId0 || '').trim();
                const docId = String(docId0 || '').trim();
                if (!calendarId || !docId) return;
                if (!Array.isArray(calendarDocIds[calendarId])) calendarDocIds[calendarId] = [];
                if (!seenByCalendar.has(calendarId)) seenByCalendar.set(calendarId, new Set());
                const seen = seenByCalendar.get(calendarId);
                if (seen.has(docId)) return;
                seen.add(docId);
                calendarDocIds[calendarId].push(docId);
            };

            docsToGroup.forEach((gid, did) => {
                const groupId = String(gid || '').trim();
                const docId = String(did || '').trim();
                if (!groupId || !docId) return;
                pushDoc(`group:${groupId}`, docId);
            });

            let allDocIds = [];
            try {
                allDocIds = await resolveDocIdsFromGroups({
                    groupId: 'all',
                    includeQuickAddDoc: true,
                });
            } catch (e) {
                allDocIds = [];
            }
            const candidateDocIds = new Set();
            docsToGroup.forEach((gid, did) => {
                const docId = String(did || '').trim();
                if (docId) candidateDocIds.add(docId);
            });
            (Array.isArray(allDocIds) ? allDocIds : []).forEach((docId0) => {
                const docId = String(docId0 || '').trim();
                if (docId) candidateDocIds.add(docId);
            });
            try {
                await __tmFillDocHasTasksMap(Array.from(candidateDocIds), tasksMap);
            } catch (e) {}

            (Array.isArray(allDocIds) ? allDocIds : []).forEach((docId0) => {
                const docId = String(docId0 || '').trim();
                if (!docId || docsToGroup.has(docId) || !tasksMap.has(docId)) return;
                pushDoc('default', docId);
            });
            Object.keys(calendarDocIds).forEach((calendarId) => {
                const ids = Array.isArray(calendarDocIds[calendarId]) ? calendarDocIds[calendarId] : [];
                calendarDocIds[calendarId] = ids.filter((docId) => tasksMap.has(String(docId || '').trim()));
            });

            const calendars = {};
            Object.keys(calendarDocIds).forEach((calendarId) => {
                const ids = Array.isArray(calendarDocIds[calendarId]) ? calendarDocIds[calendarId] : [];
                const docs = ids.map((docId) => ({
                    id: docId,
                    name: __tmBuildCalendarSidebarDocItemsName(docId, docMap)
                }));
                if (docs.length > 0) calendars[calendarId] = docs;
            });

            const data = { key, calendars };
            window.__tmCalendarSidebarDocItemsCache = { key, data, ts: Date.now() };
            return data;
        });

        tracked = run.finally(() => {
            if (__tmCalendarSidebarDocItemsWarmPromise === tracked) __tmCalendarSidebarDocItemsWarmPromise = null;
        });
        __tmCalendarSidebarDocItemsWarmPromise = { key, promise: tracked };
        return await tracked;
    };

    function __tmKanbanClearDragOver(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!modal) return;
        try {
            const cols = modal.querySelectorAll('.tm-kanban-col.tm-kanban-col--dragover, .tm-kanban-col.tm-kanban-col--drop-forbidden');
            cols.forEach(el => { try { el.classList.remove('tm-kanban-col--dragover', 'tm-kanban-col--drop-forbidden'); } catch (e) {} });
        } catch (e) {}
    }

    function __tmBuildKanbanTimeDropTarget(timeKey) {
        const key = String(timeKey || '').trim();
        if (!key) return null;
        if (key === 'pending') return { key, dateKey: '', label: '待定' };
        const dateKey = typeof __tmResolveTimeGroupDropDateKey === 'function'
            ? __tmResolveTimeGroupDropDateKey(key)
            : '';
        if (!dateKey) return null;
        if (key === 'today') return { key, dateKey, label: '今天' };
        if (key === 'tomorrow') return { key, dateKey, label: '明天' };
        if (key === 'after_tomorrow') return { key, dateKey, label: '后天' };
        const m = /^days_(\d+)$/.exec(key);
        return { key, dateKey, label: m ? `余${m[1]}天` : dateKey };
    }

    function __tmResolveKanbanDropHost(ev) {
        const target = ev?.target instanceof Element ? ev.target : null;
        const currentTarget = ev?.currentTarget instanceof Element ? ev.currentTarget : null;
        const targetDrop = target?.closest?.('[data-tm-kb-drop-kind]') || null;
        if (targetDrop instanceof Element) return targetDrop;
        const currentDrop = currentTarget?.closest?.('[data-tm-kb-drop-kind]') || null;
        if (currentDrop instanceof Element) return currentDrop;
        const hover = state.modal?.querySelector?.('.tm-kanban-col.tm-kanban-col--dragover');
        if (String(ev?.type || '').toLowerCase() === 'drop' && hover instanceof Element) return hover;
        let el = currentTarget || target;
        if (!el && Number.isFinite(Number(ev?.clientX)) && Number.isFinite(Number(ev?.clientY))) {
            try {
                const point = document.elementFromPoint(Number(ev.clientX), Number(ev.clientY));
                el = point instanceof Element ? point : null;
            } catch (e) {
                el = null;
            }
        }
        const direct = el?.closest?.('.tm-kanban-col') || null;
        if (direct instanceof Element) return direct;
        return hover instanceof Element ? hover : null;
    }

    function __tmGetKanbanRuntimeColScrollKey(colEl) {
        if (!(colEl instanceof Element)) return '';
        const status = String(colEl.getAttribute('data-status') || '').trim();
        if (status) return `status:${status}`;
        const kind = String(colEl.getAttribute('data-kind') || '').trim();
        const time = String(colEl.getAttribute('data-time') || '').trim();
        if (kind === 'time' || time) return `time:${time || kind}`;
        const doc = String(colEl.getAttribute('data-doc') || '').trim();
        const heading = String(colEl.getAttribute('data-heading') || '').trim();
        if (kind || doc || heading) return `kind:${kind}|doc:${doc}|heading:${heading}`;
        return '';
    }

    function __tmRememberKanbanViewScroll(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        const body = modal?.querySelector?.('.tm-body.tm-body--kanban');
        if (!(body instanceof HTMLElement)) return false;
        const cols = {};
        try {
            body.querySelectorAll('.tm-kanban-col').forEach((col) => {
                const colKey = __tmGetKanbanRuntimeColScrollKey(col);
                if (!colKey) return;
                const colBody = col.querySelector('.tm-kanban-col-body');
                if (!(colBody instanceof HTMLElement)) return;
                cols[colKey] = Number(colBody.scrollTop || 0);
                const status = String(col.getAttribute('data-status') || '').trim();
                if (status) cols[status] = cols[colKey];
            });
        } catch (e) {}
        try {
            state.viewScroll = state.viewScroll && typeof state.viewScroll === 'object' ? state.viewScroll : {};
            state.viewScroll.kanban = {
                left: Number(body.scrollLeft || 0) || 0,
                cols,
            };
            state.__tmKanbanForceRestoreColScrollOnce = true;
        } catch (e) {}
        return true;
    }

    function __tmKanbanGetCollapsedSet() {
        if (!(state.__tmKanbanCollapsedIds instanceof Set)) state.__tmKanbanCollapsedIds = new Set();
        return state.__tmKanbanCollapsedIds;
    }

    function __tmKanbanPersistCollapsed() {
        try {
            const s = __tmKanbanGetCollapsedSet();
            const arr = Array.from(s).map(x => String(x || '').trim()).filter(Boolean);
            SettingsStore.data.kanbanCollapsedTaskIds = arr;
            __tmMarkCollapseStateChanged();
            try { Storage.set('tm_kanban_collapsed_task_ids', arr); } catch (e) {}
            SettingsStore.save();
        } catch (e) {}
    }

    function __tmKanbanGetCollapsedColumnSet() {
        if (!(state.__tmKanbanCollapsedColumnKeys instanceof Set)) state.__tmKanbanCollapsedColumnKeys = new Set();
        return state.__tmKanbanCollapsedColumnKeys;
    }

    function __tmKanbanPersistCollapsedColumns() {
        try {
            const s = __tmKanbanGetCollapsedColumnSet();
            const arr = Array.from(s).map(x => String(x || '').trim()).filter(Boolean);
            SettingsStore.data.kanbanCollapsedColumnKeys = arr;
            __tmMarkCollapseStateChanged();
            try { Storage.set('tm_kanban_collapsed_column_keys', arr); } catch (e) {}
            SettingsStore.save();
        } catch (e) {}
    }

    window.tmKanbanToggleCollapse = function(id, ev) {
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}
        const tid = String(id || '').trim();
        if (!tid) return;
        try { __tmMarkHighPriorityInteraction('kanban-task-collapse-toggle', 680); } catch (e) {}
        try { __tmRememberKanbanViewScroll(state.modal); } catch (e) {}
        const s = __tmKanbanGetCollapsedSet();
        if (s.has(tid)) s.delete(tid);
        else s.add(tid);
        __tmKanbanPersistCollapsed();
        if (!__tmRerenderKanbanInPlace(state.modal)) render();
    };

    window.tmKanbanToggleColumnCollapse = function(key, ev) {
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}
        const colKey = String(key || '').trim();
        if (!colKey) return;
        const s = __tmKanbanGetCollapsedColumnSet();
        if (s.has(colKey)) s.delete(colKey);
        else s.add(colKey);
        state.__tmKanbanPendingSnapColumnKey = colKey;
        __tmKanbanPersistCollapsedColumns();
        render();
    };

    window.tmKanbanCardDblClick = function(id, ev) {
        if (__tmIsMultiSelectActive('kanban')) return;
        const tid = String(id || '').trim();
        if (!tid) return;
        const target = ev?.target;
        if (target?.closest?.('button,input,select,textarea,a,.tm-task-content-clickable,.tm-task-checkbox,.tm-task-checkbox-wrap,.tm-kanban-toggle,.tm-kanban-more,.tm-status-tag,.tm-kanban-chip,.tm-priority-jira,.tm-kanban-priority-chip')) return;
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid];
        const hasChildren = Array.isArray(task?.children) && task.children.length > 0;
        if (!hasChildren) return;
        window.tmKanbanToggleCollapse(tid, ev);
    };

    window.tmKanbanCardClick = function(id, ev) {
        if (__tmConsumeDockPointerSuppressedClick(ev)) return;
        const tid = String(id || '').trim();
        if (!tid) return;
        const target = ev?.target;
        if (target?.closest?.('button,input,select,textarea,a,.tm-task-content-clickable,.tm-task-checkbox,.tm-task-checkbox-wrap,.tm-kanban-toggle,.tm-kanban-more,.tm-status-tag,.tm-kanban-chip,.tm-priority-jira,.tm-kanban-priority-chip')) return;
        if (!__tmIsMultiSelectActive('kanban')) return;
        if (Number(ev?.detail) > 1) {
            try { ev?.preventDefault?.(); } catch (e) {}
            try { ev?.stopPropagation?.(); } catch (e) {}
            return;
        }
        try { ev?.preventDefault?.(); } catch (e) {}
        try { ev?.stopPropagation?.(); } catch (e) {}
        __tmToggleTaskMultiSelection(tid);
    };

    function __tmKanbanGetParentTaskId(task) {
        const id = String(task?.id || '').trim();
        const pid = String(task?.parentTaskId || task?.parent_task_id || '').trim();
        if (!pid || pid === id) return '';
        const resolveAlias = (value) => {
            const raw = String(value || '').trim();
            if (!raw) return '';
            try {
                const fromIdentity = String(globalThis.__tmTaskIdentity?.resolve?.(raw) || '').trim();
                if (fromIdentity) return fromIdentity;
            } catch (e) {}
            try {
                const fromOptimistic = typeof __tmResolveOptimisticTaskId === 'function'
                    ? String(__tmResolveOptimisticTaskId(raw) || '').trim()
                    : '';
                if (fromOptimistic) return fromOptimistic;
            } catch (e) {}
            return raw;
        };
        const resolvedId = resolveAlias(id);
        const resolvedPid = resolveAlias(pid);
        return resolvedPid && resolvedId && resolvedPid === resolvedId ? '' : pid;
    }

    function __tmKanbanBuildChildTasksByParentId() {
        const childrenByParentId = new Map();
        const seenByParentId = new Map();
        const pushChild = (parentId, child) => {
            const pid = String(parentId || '').trim();
            const id = String(child?.id || '').trim();
            if (!pid || !id) return;
            let seen = seenByParentId.get(pid);
            if (!seen) {
                seen = new Set();
                seenByParentId.set(pid, seen);
            }
            if (seen.has(id)) return;
            seen.add(id);
            if (!childrenByParentId.has(pid)) childrenByParentId.set(pid, []);
            childrenByParentId.get(pid).push(child);
        };
        const indexTask = (task) => {
            if (!task || typeof task !== 'object') return;
            const id = String(task?.id || '').trim();
            const pid = __tmKanbanGetParentTaskId(task);
            if (pid) pushChild(pid, task);
            if (!id) return;
            (Array.isArray(task?.children) ? task.children : []).forEach((child) => {
                pushChild(id, child);
            });
        };
        Object.values((state.flatTasks && typeof state.flatTasks === 'object') ? state.flatTasks : {}).forEach(indexTask);
        try {
            const runtimeTasks = globalThis.__tmRuntimeState?.getFlatTasks?.();
            Object.values((runtimeTasks && typeof runtimeTasks === 'object') ? runtimeTasks : {}).forEach(indexTask);
        } catch (e) {}
        return childrenByParentId;
    }

    function __tmKanbanGetChildTasksByParentId(parentId, childrenByParentId) {
        const pid = String(parentId || '').trim();
        if (!pid) return [];
        const map = childrenByParentId instanceof Map ? childrenByParentId : __tmKanbanBuildChildTasksByParentId();
        return map.get(pid) || [];
    }

    function __tmKanbanCollectDescendantIds(rootId) {
        const id0 = String(rootId || '').trim();
        if (!id0) return [];
        const out = [];
        const seen = new Set();
        const childrenByParentId = __tmKanbanBuildChildTasksByParentId();
        const walk = (id) => {
            const tid = String(id || '').trim();
            if (!tid || seen.has(tid)) return;
            seen.add(tid);
            out.push(tid);
            const kids = __tmKanbanGetChildTasksByParentId(tid, childrenByParentId);
            kids.forEach(k => walk(k?.id));
        };
        walk(id0);
        return out;
    }

    function __tmKanbanGetTaskById(taskId) {
        const tid = String(taskId || '').trim();
        if (!tid) return null;
        return globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid] || null;
    }

    function __tmKanbanResolveTaskStatusColumnKey(task) {
        if (!task) return '';
        const kanbanBoardMode = __tmGetKanbanBoardMode();
        const doneBoardEnabled = (kanbanBoardMode === 'heading' || kanbanBoardMode === 'time')
            && !!state.showCompletedTasks
            && !!SettingsStore.data.kanbanShowDoneColumn;
        if (!!task.done && doneBoardEnabled) return '__done__';
        return String(__tmResolveTaskStatusId(task, SettingsStore.data.customStatusOptions || []) || '').trim();
    }

    function __tmResolveKanbanEffectiveDragTarget(taskId, sourceEl) {
        const requestedId = String(taskId || '').trim();
        const requestedCard = sourceEl instanceof HTMLElement
            ? (sourceEl.classList?.contains?.('tm-kanban-card') ? sourceEl : sourceEl.closest?.('.tm-kanban-card[data-id]'))
            : null;
        const fallbackId = String(requestedCard?.getAttribute?.('data-id') || '').trim();
        const currentId = requestedId || fallbackId;
        return { taskId: currentId, cardEl: requestedCard || null };
    }

    function __tmKanbanCollectAttachedStatusDescendantIds(rootId) {
        const id0 = String(rootId || '').trim();
        if (!id0) return [];
        const out = [];
        const seen = new Set();
        const childrenByParentId = __tmKanbanBuildChildTasksByParentId();
        const walk = (id) => {
            const tid = String(id || '').trim();
            if (!tid || seen.has(tid)) return;
            seen.add(tid);
            out.push(tid);
            const task = __tmKanbanGetTaskById(tid);
            const parentStatusKey = __tmKanbanResolveTaskStatusColumnKey(task);
            if (!parentStatusKey) return;
            const kids = __tmKanbanGetChildTasksByParentId(tid, childrenByParentId);
            kids.forEach((child) => {
                const childId = String(child?.id || '').trim();
                if (!childId) return;
                const childTask = __tmKanbanGetTaskById(childId) || child;
                if (__tmKanbanResolveTaskStatusColumnKey(childTask) !== parentStatusKey) return;
                walk(childId);
            });
        };
        walk(id0);
        return out;
    }

    async function __tmWaitForGlobalUnlock(timeoutMs = 8000) {
        const start = Date.now();
        while (GlobalLock.isLocked()) {
            if (Date.now() - start > timeoutMs) return false;
            await new Promise(r => setTimeout(r, 32));
        }
        return true;
    }

    async function __tmReassignCompletedScheduleToRecurringInstance(scheduleId, sourceTask, historyItem) {
        const sid = String(scheduleId || '').trim();
        if (!sid) return false;
        let task = (sourceTask && typeof sourceTask === 'object') ? sourceTask : null;
        try {
            const sourceTaskId = String(task?.id || '').trim();
            const latestTaskId = await __tmResolveTaskIdFromAnyBlockId(sourceTaskId);
            if (latestTaskId && latestTaskId !== sourceTaskId) {
                const latestTask = await __tmResolveTaskForRepeat(latestTaskId);
                if (latestTask?.id) task = latestTask;
            }
        } catch (e) {}
        const history = __tmNormalizeTaskRepeatHistory([historyItem])[0] || null;
        if (!task?.id || !history) return false;
        const virtualTask = __tmBuildRecurringInstanceTask(task, history, 0);
        const nextTaskId = String(virtualTask?.id || '').trim();
        if (!nextTaskId) return false;
        const calendarApi = globalThis.__tmCalendar;
        if (!calendarApi || typeof calendarApi.reassignScheduleLinkedTask !== 'function') return false;
        try {
            const result = await calendarApi.reassignScheduleLinkedTask(sid, nextTaskId, {
                sourceTaskId: String(task.id || '').trim(),
                completedAt: String(history.completedAt || '').trim(),
            });
            return result !== false;
        } catch (e) {
            return false;
        }
    }

    async function __tmKanbanWaitForUnlock(timeoutMs = 8000) {
        return await __tmWaitForGlobalUnlock(timeoutMs);
    }

    function __tmNormalizeHeadingLevel(v) {
        const s = String(v || 'h2').trim().toLowerCase();
        return /^h[1-6]$/.test(s) ? s : 'h2';
    }

    function __tmParseHeadingBlocksFromKramdown(kramdown) {
        const lines = String(kramdown || '').split(/\r?\n/);
        const headings = [];
        const parseIds = (line) => {
            const out = [];
            const s = String(line || '');
            const re = /\bid=(?:"([^"]+)"|'([^']+)')/g;
            let m;
            while ((m = re.exec(s)) !== null) {
                const id = String(m[1] || m[2] || '').trim();
                if (id) out.push(id);
            }
            return out;
        };
        const stripHeadingText = (line) => {
            return __tmNormalizeHeadingText(line);
        };
        let pendingHeading = null;
        for (let ln = 0; ln < lines.length; ln += 1) {
            const line = String(lines[ln] || '');
            const hm = line.match(/^(#{1,6})\s+(.*)$/);
            if (hm) {
                pendingHeading = {
                    level: Number(hm[1].length),
                    text: stripHeadingText(line),
                    expires: ln + 4,
                };
                const idsInline = parseIds(line);
                if (idsInline.length > 0) {
                    headings.push({
                        id: String(idsInline[0] || '').trim(),
                        content: String(pendingHeading.text || '').trim(),
                        level: Number(pendingHeading.level),
                    });
                    pendingHeading = null;
                }
            }
            const ids = parseIds(line);
            if (pendingHeading && ids.length > 0) {
                headings.push({
                    id: String(ids[0] || '').trim(),
                    content: String(pendingHeading.text || '').trim(),
                    level: Number(pendingHeading.level),
                });
                pendingHeading = null;
            }
            if (pendingHeading && ln > Number(pendingHeading.expires || 0)) {
                pendingHeading = null;
            }
        }
        return headings.filter((heading) => String(heading?.id || '').trim());
    }

    async function __tmResolveHeadingGroupInsertPlacement(docId, headingId, headingLevel) {
        const did = String(docId || '').trim();
        const hid = String(headingId || '').trim();
        const lv = __tmNormalizeHeadingLevel(headingLevel || SettingsStore.data.taskHeadingLevel || 'h2');
        const lvNum0 = Number((String(lv).match(/^h([1-6])$/) || [])[1]);
        const fallbackLevel = Number.isFinite(lvNum0) ? lvNum0 : 2;
        if (!did || !hid) return { matched: false, checked: false, insertAfterID: '', nextID: '', appendToBottom: false, heading: null };
        try { await __tmWarmKanbanDocHeadings([did]); } catch (e) {}
        const levelHeadings = Array.isArray(state.kanbanDocHeadingsByDocId?.[did]) ? state.kanbanDocHeadingsByDocId[did] : [];
        const headingMeta = levelHeadings.find((item) => String(item?.id || '').trim() === hid) || null;
        let km = '';
        let checked = false;
        try {
            km = await API.getBlockKramdown(did);
            checked = true;
        } catch (e) {
            km = '';
        }
        if (!km) {
            return { matched: false, checked, insertAfterID: '', nextID: '', appendToBottom: false, heading: headingMeta };
        }
        const headings = __tmParseHeadingBlocksFromKramdown(km);
        const currentIndex = headings.findIndex((item) => String(item?.id || '').trim() === hid);
        if (currentIndex < 0) {
            return { matched: false, checked: true, insertAfterID: '', nextID: '', appendToBottom: false, heading: headingMeta };
        }
        const currentHeading = headings[currentIndex];
        let nextID = '';
        for (let i = currentIndex + 1; i < headings.length; i += 1) {
            nextID = String(headings[i]?.id || '').trim();
            if (nextID) break;
        }
        return {
            matched: true,
            checked: true,
            insertAfterID: hid,
            nextID,
            appendToBottom: !nextID,
            heading: headingMeta || {
                id: hid,
                content: String(currentHeading?.content || '').trim(),
                rank: Number.NaN,
            },
        };
    }

    async function __tmFetchDocHeadingsByDocs(docIds, headingLevel) {
        const ids = Array.from(new Set((docIds || []).map(x => String(x || '').trim()).filter(Boolean)));
        const out = {};
        if (ids.length === 0) return out;
        const lv = __tmNormalizeHeadingLevel(headingLevel);
        const perDocLimit = Math.max(500, Math.min(__TM_TASK_INDEX_QUERY_LIMIT, Number(__TM_TASK_HOT_QUERY_LIMIT) || 5000));
        let headingOrderMap = new Map();
        try {
            headingOrderMap = await API.fetchHeadingOrderByDocs(ids, lv);
        } catch (e) {
            headingOrderMap = new Map();
        }
        const batchSize = 60;
        for (let i = 0; i < ids.length; i += batchSize) {
            const batch = ids.slice(i, i + batchSize);
            if (!batch.length) continue;
            const inList = batch.map((id) => `'${id.replace(/'/g, "''")}'`).join(',');
            const totalLimit = Math.max(perDocLimit, Math.min(__TM_SQL_MAX_TOTAL_LIMIT, batch.length * perDocLimit));
            const sql = `
                SELECT id, root_id, content, sort, created
                FROM blocks
                WHERE type = 'h'
                  AND subtype = '${lv}'
                  AND root_id IN (${inList})
                ORDER BY root_id, sort, created, id
                LIMIT ${totalLimit}
            `;
            const res = await API.call('/api/query/sql', { stmt: sql }).catch(() => ({ code: -1, data: [] }));
            const rows = (res && res.code === 0 && Array.isArray(res.data)) ? res.data : [];
            rows.forEach((r) => {
                const did = String(r?.root_id || '').trim();
                const hid = String(r?.id || '').trim();
                if (!did || !hid) return;
                if (!out[did]) out[did] = [];
                const rankByDocText = headingOrderMap.get(`${did}::${hid}`);
                out[did].push({
                    id: hid,
                    content: __tmNormalizeHeadingText(r?.content),
                    sort: Number(r?.sort),
                    created: String(r?.created || '').trim(),
                    rank: Number.isFinite(Number(rankByDocText)) ? Number(rankByDocText) : Number.NaN,
                });
            });
        }
        Object.keys(out).forEach((did) => {
            const list = Array.isArray(out[did]) ? out[did] : [];
            // 优先使用 SQL 查询的自然顺序（已经按 root_id, sort, created, id 排序）
            // 只有在 headingOrderMap 有效时才使用 rank，否则保持 SQL 顺序
            list.forEach((h, idx) => {
                const rankByDocText = headingOrderMap.get(`${did}::${h.id}`);
                // 如果有 headingOrderMap 的值就用它，否则使用 SQL 查询的自然顺序作为 rank
                if (Number.isFinite(Number(rankByDocText))) {
                    h.rank = Number(rankByDocText);
                } else {
                    h.rank = idx;
                }
            });
            // 然后按 rank 排序
            list.sort((a, b) => {
                const ar = Number(a?.rank);
                const br = Number(b?.rank);
                const aHasRank = Number.isFinite(ar);
                const bHasRank = Number.isFinite(br);
                if (aHasRank && bHasRank && ar !== br) return ar - br;
                if (aHasRank !== bHasRank) return aHasRank ? -1 : 1;
                const as = Number(a?.sort);
                const bs = Number(b?.sort);
                if (Number.isFinite(as) && Number.isFinite(bs) && as !== bs) return as - bs;
                const ac = String(a?.created || '').trim();
                const bc = String(b?.created || '').trim();
                if (ac !== bc) return ac.localeCompare(bc);
                return String(a?.id || '').localeCompare(String(b?.id || ''));
            });
            // 排序后重新设置 rank 为索引（这样可以保持原始的 SQL 顺序）
            list.forEach((h, idx) => {
                h.rank = idx;
            });
        });
        return out;
    }

    async function __tmWarmKanbanDocHeadings(docIds, options = {}) {
        const ids = Array.from(new Set((docIds || []).map(x => String(x || '').trim()).filter(Boolean)));
        const opts = (options && typeof options === 'object') ? options : {};
        const force = options === true || opts.force === true;
        const lv = __tmNormalizeHeadingLevel(SettingsStore.data.taskHeadingLevel || 'h2');
        if (state.kanbanDocHeadingsLevel !== lv) {
            state.kanbanDocHeadingsByDocId = {};
            state.kanbanDocHeadingsLevel = lv;
            state.kanbanDocHeadingsLoadedAt = 0;
        }
        const fresh = (Date.now() - (Number(state.kanbanDocHeadingsLoadedAt) || 0)) < 15000;
        const hasAll = ids.length > 0 && ids.every((id) => Array.isArray(state.kanbanDocHeadingsByDocId?.[id]));
        if (!force && fresh && hasAll) return;
        const map = await __tmFetchDocHeadingsByDocs(ids, lv);
        const nextMap = { ...(state.kanbanDocHeadingsByDocId || {}), ...(map || {}) };
        ids.forEach((id) => {
            if (!Array.isArray(nextMap[id])) nextMap[id] = [];
        });
        state.kanbanDocHeadingsByDocId = nextMap;
        state.kanbanDocHeadingsLevel = lv;
        state.kanbanDocHeadingsLoadedAt = Date.now();
    }

    async function __tmCleanupPlaceholderTasks(docIds) {
        const ids = Array.from(new Set((docIds || []).map(x => String(x || '').trim()).filter(Boolean)));
        if (!ids.length) return;
        const batchSize = 80;
        for (let i = 0; i < ids.length; i += batchSize) {
            const batch = ids.slice(i, i + batchSize);
            const inList = batch.map((id) => `'${id.replace(/'/g, "''")}'`).join(',');
            const sql = `
                SELECT id
                FROM blocks
                WHERE type = 'i'
                  AND subtype = 't'
                  AND root_id IN (${inList})
                  AND (
                    markdown LIKE '%TM_TMP_DO_NOT_EDIT%'
                    OR markdown LIKE '%__tm_tmp__%'
                  )
                LIMIT 200
            `;
            const res = await API.call('/api/query/sql', { stmt: sql }).catch(() => ({ code: -1, data: [] }));
            const rows = (res && res.code === 0 && Array.isArray(res.data)) ? res.data : [];
            for (const r of rows) {
                const bid = String(r?.id || '').trim();
                if (!bid) continue;
                try {
                    const adapter = globalThis.__tmTaskHorizonBackendAdapter;
                    if (adapter && typeof adapter.deleteBlock === 'function') await adapter.deleteBlock(bid);
                    else throw new Error('任务写入适配器未就绪: deleteBlock');
                } catch (e) {}
            }
        }
    }

    window.tmKanbanDragStart = function(ev, id) {
        try { ev.stopPropagation(); } catch (e) {}
        const sourceCard = ev?.currentTarget instanceof HTMLElement
            ? ev.currentTarget
            : (ev?.target instanceof Element ? ev.target.closest('.tm-kanban-card[data-id]') : null);
        const resolvedDrag = __tmResolveKanbanEffectiveDragTarget(id, sourceCard);
        const taskId = String(resolvedDrag?.taskId || '').trim();
        const dragCard = resolvedDrag?.cardEl instanceof HTMLElement ? resolvedDrag.cardEl : sourceCard;
        if (!taskId) return;
        state.draggingTaskId = taskId;
        try { __tmSetCalendarSideDockDragHidden(true); } catch (e) {}
        try { ev.dataTransfer.effectAllowed = 'move'; } catch (e) {}
        try { ev.dataTransfer.setData('application/x-tm-task-id', taskId); } catch (e) {}
        try { ev.dataTransfer.setData('text/plain', taskId); } catch (e) {}
        try {
            const meta = (typeof window.tmCalendarGetTaskDragMeta === 'function') ? window.tmCalendarGetTaskDragMeta(taskId) : null;
            const fallbackTitle = String(globalThis.__tmRuntimeState?.getFlatTaskById?.(taskId)?.content || state.flatTasks?.[taskId]?.content || '').trim();
            const payload = {
                taskId,
                id: taskId,
                title: String(meta?.title || '').trim() || (typeof API?.extractTaskContentLine === 'function'
                    ? String(API.extractTaskContentLine(fallbackTitle) || fallbackTitle).trim()
                    : fallbackTitle),
                durationMin: Number(meta?.durationMin) || 60,
                calendarId: String(meta?.calendarId || '').trim(),
                startDate: String(meta?.startDate || '').trim(),
                completionTime: String(meta?.completionTime || '').trim(),
            };
            ev.dataTransfer.setData('application/x-tm-task', JSON.stringify(payload));
        } catch (e) {}
        state.__tmKanbanDragId = taskId;
        state.__tmKanbanDragIds = [taskId];
        state.__tmKanbanDragSourceEl = dragCard instanceof HTMLElement ? dragCard : null;
        try { __tmBindKanbanDocumentAutoScroll(); } catch (e) {}
        try { dragCard?.classList?.add?.('tm-kanban-card--dragging'); } catch (e) {}
        try {
            const meta = (typeof window.tmCalendarGetTaskDragMeta === 'function') ? window.tmCalendarGetTaskDragMeta(taskId) : null;
            __tmCalendarFloatingDragStart(taskId, meta, ev);
        } catch (e) {}

        if (!SettingsStore.data.kanbanDragSyncSubtasks) {
            try {
                const target = dragCard;
                if (target instanceof Element && target.querySelector('.tm-kanban-subtasks')) {
                    const clone = target.cloneNode(true);
                    const sub = clone.querySelector('.tm-kanban-subtasks');
                    if (sub) sub.remove();
                    clone.style.position = 'absolute';
                    clone.style.top = '-9999px';
                    clone.style.left = '-9999px';
                    clone.style.width = `${target.offsetWidth}px`;
                    clone.style.background = getComputedStyle(target).background;
                    document.body.appendChild(clone);
                    const rect = target.getBoundingClientRect();
                    ev.dataTransfer.setDragImage(clone, ev.clientX - rect.left, ev.clientY - rect.top);
                    setTimeout(() => clone.remove(), 0);
                }
            } catch (e) {
                console.error('Failed to set drag image', e);
            }
        }
    };

    window.tmKanbanDragEnd = function(ev, id) {
        try { ev.currentTarget?.classList?.remove?.('tm-kanban-card--dragging'); } catch (e) {}
        try {
            const sourceEl = state.__tmKanbanDragSourceEl;
            if (sourceEl instanceof HTMLElement) sourceEl.classList.remove('tm-kanban-card--dragging');
        } catch (e) {}
        state.draggingTaskId = '';
        try { __tmClearDocTabDropTarget(); } catch (e) {}
        try { __tmSetCalendarSideDockDragHidden(false); } catch (e) {}
        try { __tmCalendarFloatingDragEnd(); } catch (e) {}
        try { __tmUnbindKanbanDocumentAutoScroll(); } catch (e) {}
        try { delete state.__tmKanbanDragId; } catch (e) {}
        try { delete state.__tmKanbanDragIds; } catch (e) {}
        try { delete state.__tmKanbanDragSourceEl; } catch (e) {}
        __tmKanbanClearDragOver();
    };

    window.tmKanbanDragOver = function(ev) {
        try { ev.preventDefault(); } catch (e) {}
        try { ev.dataTransfer.dropEffect = 'move'; } catch (e) {}
        const host = __tmResolveKanbanDropHost(ev);
        const col = host?.closest?.('.tm-kanban-col') || null;
        if (!col) return;
        try {
            const kind = String(col?.dataset?.kind || '').trim();
            const timeKey = String(col?.dataset?.time || '').trim();
            const timeDropForbidden = kind === 'time' && !__tmBuildKanbanTimeDropTarget(timeKey);
            if (!col.classList.contains('tm-kanban-col--dragover')) {
                __tmKanbanClearDragOver();
                col.classList.add('tm-kanban-col--dragover');
            }
            col.classList.toggle('tm-kanban-col--drop-forbidden', timeDropForbidden);
        } catch (e) {}
    };

    window.tmKanbanDragLeave = function(ev) {
        const host = __tmResolveKanbanDropHost(ev);
        const col = host?.closest?.('.tm-kanban-col') || null;
        if (!col) return;
        const rel = ev?.relatedTarget instanceof Element ? ev.relatedTarget : null;
        if (rel && col.contains(rel)) return;
        try { col.classList.remove('tm-kanban-col--dragover'); } catch (e) {}
    };

    window.tmKanbanGroupDragOver = function(ev) {
        try { ev.preventDefault(); } catch (e) {}
        try { ev.stopPropagation(); } catch (e) {}
        try { ev.dataTransfer.dropEffect = 'move'; } catch (e) {}
        const ct = ev?.currentTarget instanceof Element ? ev.currentTarget : null;
        const el0 = ct || (ev?.target instanceof Element ? ev.target.closest('.tm-kanban-group-title, .tm-kanban-group') : null);
        if (!el0) return;
        const el = el0.classList?.contains?.('tm-kanban-group-title')
            ? el0
            : (el0.querySelector?.('.tm-kanban-group-title') || null);
        if (!el) return;
        try { el.classList.add('tm-kanban-group-title--dragover'); } catch (e) {}
    };

    window.tmKanbanGroupDragLeave = function(ev) {
        try { ev.stopPropagation(); } catch (e) {}
        const ct = ev?.currentTarget instanceof Element ? ev.currentTarget : null;
        const el0 = ct || (ev?.target instanceof Element ? ev.target.closest('.tm-kanban-group-title, .tm-kanban-group') : null);
        if (!el0) return;
        const el = el0.classList?.contains?.('tm-kanban-group-title')
            ? el0
            : (el0.querySelector?.('.tm-kanban-group-title') || null);
        if (!el) return;
        const rel = ev?.relatedTarget instanceof Element ? ev.relatedTarget : null;
        if (rel && el.contains(rel)) return;
        try { el.classList.remove('tm-kanban-group-title--dragover'); } catch (e) {}
    };

    window.tmKanbanGroupDrop = function(ev) {
        try { ev.preventDefault(); } catch (e) {}
        try { ev.stopPropagation(); } catch (e) {}
        try {
            const ct = ev?.currentTarget instanceof Element ? ev.currentTarget : null;
            const el0 = ct || (ev?.target instanceof Element ? ev.target.closest('.tm-kanban-group-title, .tm-kanban-group') : null);
            const el = el0 && el0.classList?.contains?.('tm-kanban-group-title')
                ? el0
                : (el0?.querySelector?.('.tm-kanban-group-title') || null);
            el?.classList?.remove?.('tm-kanban-group-title--dragover');
        } catch (e) {}
        try { window.tmKanbanDrop(ev); } catch (e) {}
    };

    function __tmIsPointOverCalendarSideDock(clientX, clientY, target) {
        const modal = state.modal;
        if (!(modal instanceof Element)) return false;
        const targetEl = target instanceof Element ? target : null;
        if (targetEl?.closest?.('.tm-calendar-side-dock, .tm-calendar-side-dock-resizer, #tmCalendarSideDockPanel, #tmCalendarSideDockTimeline')) return true;
        const x = Number(clientX);
        const y = Number(clientY);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
        const docks = modal.querySelectorAll('.tm-calendar-side-dock, .tm-calendar-side-dock-resizer');
        for (const dock of docks) {
            if (!(dock instanceof HTMLElement)) continue;
            const rect = dock.getBoundingClientRect();
            if (!(rect.width > 0 && rect.height > 0)) continue;
            if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return true;
        }
        return false;
    }

    function __tmKanbanAutoScrollByPoint(clientX, clientY, target) {
        const modal = state.modal;
        if (!modal) return false;
        const body = modal.querySelector('.tm-body.tm-body--kanban');
        if (!(body instanceof HTMLElement)) return false;
        const rect = body.getBoundingClientRect();
        const x = Number(clientX);
        const y = Number(clientY);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
        if (__tmIsPointOverCalendarSideDock(x, y, target)) return false;
        const edge = 48;
        const speed = 18;
        const verticalBand = edge + 16;
        if (y < rect.top - verticalBand || y > rect.bottom + verticalBand) return false;

        const dx = x < rect.left + edge ? -speed : x > rect.right - edge ? speed : 0;
        const dy = y < rect.top + edge ? -speed : y > rect.bottom - edge ? speed : 0;
        if (!dx && !dy) return false;

        const prevTs = Number(state.__tmKanbanAutoScrollTs) || 0;
        const now = Date.now();
        if (now - prevTs < 16) return false;
        state.__tmKanbanAutoScrollTs = now;

        try { if (dx) body.scrollLeft += dx; } catch (e) {}
        try {
            if (dy) {
                const host = __tmResolveKanbanDropHost({
                    target: target instanceof Element ? target : null,
                    clientX: x,
                    clientY: y,
                });
                const col = host?.closest?.('.tm-kanban-col') || null;
                const colBody = col?.querySelector?.('.tm-kanban-col-body');
                if (colBody) colBody.scrollTop += dy;
            }
        } catch (e) {}
        return true;
    }

    function __tmBindKanbanDocumentAutoScroll() {
        if (state.__tmKanbanDocumentAutoScrollBound) return;
        const onDragOver = (ev) => {
            const active = String(state.__tmKanbanDragId || state.draggingTaskId || '').trim();
            if (!active) return;
            if (!(globalThis.__tmRuntimeState?.isViewMode?.('kanban') ?? (String(state.viewMode || '').trim() === 'kanban'))) return;
            try { __tmKanbanAutoScrollByPoint(ev?.clientX, ev?.clientY, ev?.target); } catch (e) {}
        };
        state.__tmKanbanDocumentAutoScrollBound = onDragOver;
        try { document.addEventListener('dragover', onDragOver, true); } catch (e) {}
    }

    function __tmUnbindKanbanDocumentAutoScroll() {
        const onDragOver = state.__tmKanbanDocumentAutoScrollBound;
        if (typeof onDragOver !== 'function') return;
        try { document.removeEventListener('dragover', onDragOver, true); } catch (e) {}
        state.__tmKanbanDocumentAutoScrollBound = null;
    }
    try {
        window.__tmKanbanAutoScrollByPoint = __tmKanbanAutoScrollByPoint;
        window.__tmBindKanbanDocumentAutoScroll = __tmBindKanbanDocumentAutoScroll;
        window.__tmUnbindKanbanDocumentAutoScroll = __tmUnbindKanbanDocumentAutoScroll;
    } catch (e) {}

    window.tmKanbanAutoScroll = function(ev) {
        try { ev.preventDefault(); } catch (e) {}
        __tmKanbanAutoScrollByPoint(ev?.clientX, ev?.clientY, ev?.target);
    };

    function __tmIsKanbanTouchPointer(ev) {
        const pType = String(ev?.pointerType || '').trim().toLowerCase();
        if (__tmShouldUseCustomTouchTaskDrag()) return true;
        return pType === 'touch' || pType === 'pen' || (!pType && __tmIsRuntimeMobileClient());
    }

    function __tmResolveKanbanPointTarget(x, y) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        try {
            const el = document.elementFromPoint(x, y);
            return el instanceof Element ? el : null;
        } catch (e) {
            return null;
        }
    }

    function __tmApplyKanbanDragHoverFromTarget(target) {
        __tmKanbanClearDragOver();
        if (!(target instanceof Element)) return;
        const groupHost = target.closest('.tm-kanban-group-title, .tm-kanban-group');
        const groupTitle = groupHost?.classList?.contains?.('tm-kanban-group-title')
            ? groupHost
            : (groupHost?.querySelector?.('.tm-kanban-group-title') || null);
        if (groupTitle instanceof Element) {
            try { groupTitle.classList.add('tm-kanban-group-title--dragover'); } catch (e) {}
            return;
        }
        const col = target.closest('.tm-kanban-col');
        if (col instanceof Element) {
            try { col.classList.add('tm-kanban-col--dragover'); } catch (e) {}
        }
    }

    function __tmBuildKanbanTouchDragGhost(cardEl, x, y) {
        if (!(cardEl instanceof HTMLElement)) return null;
        const rect = cardEl.getBoundingClientRect();
        const ghost = cardEl.cloneNode(true);
        if (!(ghost instanceof HTMLElement)) return null;
        ghost.removeAttribute('draggable');
        ghost.classList.add('tm-kanban-card--dragging');
        ghost.style.position = 'fixed';
        ghost.style.left = '0';
        ghost.style.top = '0';
        ghost.style.margin = '0';
        ghost.style.width = `${Math.max(180, Math.round(rect.width || cardEl.offsetWidth || 280))}px`;
        ghost.style.maxWidth = ghost.style.width;
        ghost.style.zIndex = '200160';
        ghost.style.pointerEvents = 'none';
        ghost.style.opacity = '0.96';
        ghost.style.transform = `translate(${Math.round(rect.left)}px, ${Math.round(rect.top)}px)`;
        ghost.style.boxShadow = '0 12px 30px rgba(0,0,0,0.18)';
        ghost.style.contain = 'none';
        ghost.style.contentVisibility = 'visible';
        try { document.body.appendChild(ghost); } catch (e) { return null; }
        return {
            ghost,
            offsetX: x - rect.left,
            offsetY: y - rect.top,
        };
    }

    function __tmPlaceKanbanTouchDragGhost(meta, x, y) {
        if (!meta?.ghost || !Number.isFinite(x) || !Number.isFinite(y)) return;
        const left = Math.round(x - (Number(meta.offsetX) || 0));
        const top = Math.round(y - (Number(meta.offsetY) || 0));
        try { meta.ghost.style.transform = `translate(${left}px, ${top}px)`; } catch (e) {}
    }

    function __tmSetKanbanScrollLeftRaf(bodyEl, nextLeft) {
        if (!(bodyEl instanceof HTMLElement)) return;
        const value = Number(nextLeft);
        if (!Number.isFinite(value)) return;
        const snapRaf = Number(bodyEl.__tmKanbanSnapAnimRaf) || 0;
        if (snapRaf) {
            try { cancelAnimationFrame(snapRaf); } catch (e) {}
            bodyEl.__tmKanbanSnapAnimRaf = 0;
            bodyEl.__tmKanbanSnapAnimToken = '';
        }
        bodyEl.__tmKanbanPendingScrollLeft = value;
        if (Number(bodyEl.__tmKanbanScrollLeftRaf) > 0) return;
        try {
            bodyEl.__tmKanbanScrollLeftRaf = requestAnimationFrame(() => {
                bodyEl.__tmKanbanScrollLeftRaf = 0;
                const pending = Number(bodyEl.__tmKanbanPendingScrollLeft);
                bodyEl.__tmKanbanPendingScrollLeft = NaN;
                if (Number.isFinite(pending)) bodyEl.scrollLeft = pending;
            });
        } catch (e) {
            bodyEl.__tmKanbanScrollLeftRaf = 0;
            bodyEl.__tmKanbanPendingScrollLeft = NaN;
            bodyEl.scrollLeft = value;
        }
    }

    function __tmFlushKanbanScrollLeftRaf(bodyEl) {
        if (!(bodyEl instanceof HTMLElement)) return;
        const rafId = Number(bodyEl.__tmKanbanScrollLeftRaf) || 0;
        if (rafId) {
            try { cancelAnimationFrame(rafId); } catch (e) {}
        }
        bodyEl.__tmKanbanScrollLeftRaf = 0;
        const pending = Number(bodyEl.__tmKanbanPendingScrollLeft);
        bodyEl.__tmKanbanPendingScrollLeft = NaN;
        if (Number.isFinite(pending)) bodyEl.scrollLeft = pending;
    }

    function __tmIsKanbanColumnSnapMode(bodyEl) {
        if (!(bodyEl instanceof HTMLElement)) return false;
        const modal = bodyEl.closest?.('.tm-modal') || null;
        if (!(modal instanceof Element)) return false;
        return modal.classList.contains('tm-modal--mobile')
            || modal.classList.contains('tm-modal--dock')
            || !!modal.closest?.('[data-tm-host-mode="dock"]');
    }

    function __tmStartKanbanBootWindow(bodyEl) {
        if (!(bodyEl instanceof HTMLElement)) return false;
        if (!__tmIsKanbanColumnSnapMode(bodyEl)) return false;
        try { bodyEl.classList.add('tm-body--kanban-booting'); } catch (e) {}
        const timer = Number(bodyEl.__tmKanbanBootTimer) || 0;
        if (timer) {
            try {
                if (String(bodyEl.__tmKanbanBootTimerType || '') === 'idle' && typeof cancelIdleCallback === 'function') {
                    cancelIdleCallback(timer);
                } else {
                    clearTimeout(timer);
                }
            } catch (e) {}
        }
        const finish = () => {
            bodyEl.__tmKanbanBootTimer = 0;
            bodyEl.__tmKanbanBootTimerType = '';
            try {
                requestAnimationFrame(() => {
                    try { bodyEl.classList.remove('tm-body--kanban-booting'); } catch (e2) {}
                });
            } catch (e) {
                try { bodyEl.classList.remove('tm-body--kanban-booting'); } catch (e2) {}
            }
        };
        try {
            bodyEl.__tmKanbanBootTimer = setTimeout(() => {
                bodyEl.__tmKanbanBootTimer = 0;
                bodyEl.__tmKanbanBootTimerType = '';
                if (typeof requestIdleCallback === 'function') {
                    bodyEl.__tmKanbanBootTimer = requestIdleCallback(finish, { timeout: 700 });
                    bodyEl.__tmKanbanBootTimerType = 'idle';
                    return;
                }
                finish();
            }, 700);
            bodyEl.__tmKanbanBootTimerType = 'timeout';
        } catch (e) {
            try {
                bodyEl.__tmKanbanBootTimer = setTimeout(finish, 900);
                bodyEl.__tmKanbanBootTimerType = 'timeout';
            } catch (e2) { finish(); }
        }
        return true;
    }

    function __tmSetKanbanSnapPanActive(bodyEl, active) {
        if (!(bodyEl instanceof HTMLElement)) return;
        bodyEl.__tmKanbanSnapPanActive = !!active;
        try {
            if (__tmIsKanbanColumnSnapMode(bodyEl)) {
                if (!active) bodyEl.classList.remove('tm-body--kanban-pan-active');
                return;
            }
            bodyEl.classList.toggle('tm-body--kanban-pan-active', !!active);
        } catch (e) {}
    }

    function __tmIsKanbanSnapPanActive(bodyEl) {
        if (!(bodyEl instanceof HTMLElement)) return false;
        return !!bodyEl.__tmKanbanSnapPanActive || bodyEl.classList.contains('tm-body--kanban-pan-active');
    }

    function __tmIsKanbanStartupInputActive(bodyEl, options = {}) {
        if (!(bodyEl instanceof HTMLElement)) return false;
        if (!__tmIsKanbanColumnSnapMode(bodyEl)) return false;
        const includeHighPriority = options?.includeHighPriority !== false;
        if (includeHighPriority) {
            try {
                if (typeof __tmGetHighPriorityInteractionWaitMs === 'function' && __tmGetHighPriorityInteractionWaitMs(0) > 0) return true;
            } catch (e) {}
        }
        return !!bodyEl.__tmKanbanSnapPointerActive
            || __tmIsKanbanSnapPanActive(bodyEl)
            || typeof state.__tmKanbanCardGestureCleanup === 'function';
    }

    function __tmDeferKanbanStartupWorkDuringInput(bodyEl, timerKey, work, delayMs = 120, options = {}) {
        if (!(bodyEl instanceof HTMLElement) || typeof work !== 'function') return false;
        if (!__tmIsKanbanStartupInputActive(bodyEl, options)) return false;
        const key = String(timerKey || '__tmKanbanStartupDeferredTimer');
        if (Number(bodyEl[key]) > 0) return true;
        const delay = Math.max(72, Math.min(260, Number(delayMs) || 120));
        try {
            bodyEl[key] = setTimeout(() => {
                bodyEl[key] = 0;
                if (bodyEl.isConnected === false) return;
                if (__tmIsKanbanStartupInputActive(bodyEl, options)) {
                    __tmDeferKanbanStartupWorkDuringInput(bodyEl, key, work, delay, options);
                    return;
                }
                try { work(); } catch (e) {}
            }, delay);
        } catch (e) {
            bodyEl[key] = 0;
            return false;
        }
        return true;
    }

    function __tmSyncKanbanSnapMetrics(bodyEl, options = {}) {
        if (!(bodyEl instanceof HTMLElement)) return false;
        const force = !!options?.force;
        const enabled = __tmIsKanbanColumnSnapMode(bodyEl);
        try { bodyEl.classList.toggle('tm-body--kanban-snap', enabled); } catch (e) {}
        if (!enabled) {
            try { bodyEl.style.removeProperty('--tm-kanban-snap-col-width'); } catch (e) {}
            try { delete bodyEl.__tmKanbanSnapMetricsKey; } catch (e) {}
            try { delete bodyEl.__tmKanbanSnapGeometryKey; } catch (e) {}
            try { delete bodyEl.__tmKanbanSnapGeometry; } catch (e) {}
            try { delete bodyEl.__tmKanbanSnapClientWidth; } catch (e) {}
            try { delete bodyEl.__tmKanbanSnapMaxScrollLeft; } catch (e) {}
            __tmSetKanbanSnapPanActive(bodyEl, false);
            return false;
        }
        if (!force && String(bodyEl.__tmKanbanSnapMetricsKey || '')) return true;
        if (force) {
            try { delete bodyEl.__tmKanbanSnapGeometryKey; } catch (e) {}
            try { delete bodyEl.__tmKanbanSnapGeometry; } catch (e) {}
        }
        let padLeft = 10;
        let padRight = 10;
        try {
            const cs = window.getComputedStyle?.(bodyEl);
            const px = (v, fallback) => {
                const n = Number.parseFloat(String(v || ''));
                return Number.isFinite(n) ? n : fallback;
            };
            padLeft = px(cs?.paddingLeft, padLeft);
            padRight = px(cs?.paddingRight, padRight);
        } catch (e) {}
        const rectWidth = (() => {
            try { return Number(bodyEl.getBoundingClientRect?.().width) || 0; } catch (e) { return 0; }
        })();
        const scrollportWidth = Number(bodyEl.clientWidth || 0) || rectWidth;
        if (!(scrollportWidth > 0)) return true;
        const colWidth = Math.max(120, Math.round(scrollportWidth - padLeft - padRight));
        const key = `${Math.round(scrollportWidth)}:${Math.round(padLeft)}:${Math.round(padRight)}:${colWidth}`;
        if (String(bodyEl.__tmKanbanSnapMetricsKey || '') !== key) {
            try { bodyEl.style.setProperty('--tm-kanban-snap-col-width', `${colWidth}px`); } catch (e) {}
            bodyEl.__tmKanbanSnapMetricsKey = key;
            try { delete bodyEl.__tmKanbanSnapGeometryKey; } catch (e) {}
            try { delete bodyEl.__tmKanbanSnapGeometry; } catch (e) {}
        }
        bodyEl.__tmKanbanSnapClientWidth = scrollportWidth;
        bodyEl.__tmKanbanSnapMaxScrollLeft = Math.max(0, Number(bodyEl.scrollWidth || 0) - Number(bodyEl.clientWidth || 0));
        return true;
    }

    function __tmGetKanbanMaxPanScrollLeft(bodyEl) {
        if (!(bodyEl instanceof HTMLElement)) return 0;
        if (__tmIsKanbanColumnSnapMode(bodyEl)) {
            const cached = Number(bodyEl.__tmKanbanSnapMaxScrollLeft);
            if (Number.isFinite(cached) && cached >= 0) return cached;
        }
        return Math.max(0, Number(bodyEl.scrollWidth || 0) - Number(bodyEl.clientWidth || 0));
    }

    function __tmGetKanbanSnapGeometry(bodyEl) {
        if (!(bodyEl instanceof HTMLElement)) return NaN;
        if (!__tmSyncKanbanSnapMetrics(bodyEl)) return NaN;
        const maxLeft = Math.max(0, Number(bodyEl.scrollWidth || 0) - Number(bodyEl.clientWidth || 0));
        if (maxLeft <= 0) return { positions: [0], maxLeft, clientWidth: Number(bodyEl.clientWidth || 0) };
        const clientWidth = Number(bodyEl.clientWidth || 0);
        if (!(clientWidth > 0)) return NaN;
        const colCount = (() => {
            try { return bodyEl.querySelectorAll('.tm-kanban-col').length; } catch (e) { return 0; }
        })();
        const cacheKey = `${String(bodyEl.__tmKanbanSnapMetricsKey || '')}:${Math.round(clientWidth)}:${Math.round(maxLeft)}:${Math.round(Number(bodyEl.scrollWidth || 0))}:${colCount}`;
        if (String(bodyEl.__tmKanbanSnapGeometryKey || '') === cacheKey && bodyEl.__tmKanbanSnapGeometry) {
            return bodyEl.__tmKanbanSnapGeometry;
        }
        const positions = [];
        const columnPositions = [];
        try {
            const board = bodyEl.querySelector('.tm-kanban');
            const boardOffsetLeft = board instanceof HTMLElement ? Number(board.offsetLeft || 0) : 0;
            bodyEl.querySelectorAll('.tm-kanban-col').forEach((col) => {
                if (!(col instanceof HTMLElement)) return;
                const width = Number(col.offsetWidth || 0);
                if (!(width > 0)) return;
                const baseLeft = col.offsetParent === board ? boardOffsetLeft : 0;
                const center = baseLeft + Number(col.offsetLeft || 0) + width / 2;
                const left = Math.max(0, Math.min(maxLeft, Math.round(center - clientWidth / 2)));
                columnPositions.push(left);
                if (!positions.some((item) => Math.abs(item - left) < 1)) {
                    positions.push(left);
                }
            });
        } catch (e) {}
        if (!positions.length) return NaN;
        positions.sort((a, b) => a - b);
        const geometry = { positions, columnPositions, maxLeft, clientWidth };
        try {
            bodyEl.__tmKanbanSnapGeometryKey = cacheKey;
            bodyEl.__tmKanbanSnapGeometry = geometry;
        } catch (e) {}
        return geometry;
    }

    function __tmGetNearestKanbanSnapIndex(positions, left) {
        if (!Array.isArray(positions) || !positions.length) return -1;
        const targetLeft = Number(left) || 0;
        let bestIndex = 0;
        let bestDistance = Infinity;
        positions.forEach((pos, idx) => {
            const distance = Math.abs(Number(pos || 0) - targetLeft);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestIndex = idx;
            }
        });
        return bestIndex;
    }

    function __tmGetNearestKanbanSnapLeft(bodyEl) {
        const geo = __tmGetKanbanSnapGeometry(bodyEl);
        if (!geo || !Array.isArray(geo.positions)) return NaN;
        const idx = __tmGetNearestKanbanSnapIndex(geo.positions, Number(bodyEl.scrollLeft || 0));
        return idx >= 0 ? geo.positions[idx] : NaN;
    }

    function __tmGetKanbanBoardNavIndex(bodyEl, left = Number(bodyEl?.scrollLeft || 0)) {
        const geo = __tmGetKanbanSnapGeometry(bodyEl);
        const positions = Array.isArray(geo?.columnPositions) && geo.columnPositions.length
            ? geo.columnPositions
            : (Array.isArray(geo?.positions) ? geo.positions : []);
        return __tmGetNearestKanbanSnapIndex(positions, left);
    }

    function __tmGetKanbanColumnSnapLeftByIndex(bodyEl, index) {
        if (!(bodyEl instanceof HTMLElement)) return NaN;
        const rawIndex = Number(index);
        if (!Number.isFinite(rawIndex)) return NaN;
        const cols = Array.from(bodyEl.querySelectorAll('.tm-kanban-col'))
            .filter((col) => col instanceof HTMLElement);
        if (!cols.length) return NaN;
        const targetIndex = Math.max(0, Math.min(cols.length - 1, Math.round(rawIndex)));
        const col = cols[targetIndex];
        if (!(col instanceof HTMLElement)) return NaN;
        try { __tmSyncKanbanSnapMetrics(bodyEl); } catch (e) {}
        const maxLeft = __tmGetKanbanMaxPanScrollLeft(bodyEl);
        const clientWidth = Number(bodyEl.clientWidth || 0);
        if (!(clientWidth > 0)) return NaN;
        try {
            const bodyRect = bodyEl.getBoundingClientRect();
            const colRect = col.getBoundingClientRect();
            const currentLeft = Number(bodyEl.scrollLeft || 0);
            const center = currentLeft + (Number(colRect.left || 0) - Number(bodyRect.left || 0)) + Number(colRect.width || 0) / 2;
            return Math.max(0, Math.min(maxLeft, Math.round(center - clientWidth / 2)));
        } catch (e) {
            const geo = __tmGetKanbanSnapGeometry(bodyEl);
            const positions = Array.isArray(geo?.columnPositions) && geo.columnPositions.length
                ? geo.columnPositions
                : (Array.isArray(geo?.positions) ? geo.positions : []);
            const left = Number(positions[targetIndex]);
            return Number.isFinite(left) ? left : NaN;
        }
    }

    function __tmGetKanbanColumnSnapLeftByKey(bodyEl, key) {
        if (!(bodyEl instanceof HTMLElement)) return NaN;
        const targetKey = String(key || '').trim();
        if (!targetKey) return NaN;
        const cols = Array.from(bodyEl.querySelectorAll('.tm-kanban-col'))
            .filter((col) => col instanceof HTMLElement);
        const index = cols.findIndex((col) => String(col.getAttribute('data-col-key') || '').trim() === targetKey);
        return index >= 0 ? __tmGetKanbanColumnSnapLeftByIndex(bodyEl, index) : NaN;
    }

    function __tmSetKanbanBoardNavActive(bodyEl, index, options = {}) {
        if (!(bodyEl instanceof HTMLElement)) return false;
        const nav = bodyEl.querySelector('.tm-kanban-board-nav');
        if (!(nav instanceof HTMLElement)) return false;
        const items = Array.from(nav.querySelectorAll('.tm-kanban-board-nav__item'))
            .filter((item) => item instanceof HTMLElement);
        if (!items.length) return false;
        const rawIndex = Number(index);
        if (!Number.isFinite(rawIndex)) return false;
        const activeIndex = Math.max(0, Math.min(items.length - 1, Math.round(rawIndex)));
        const indicatorReady = String(nav.dataset?.tmKanbanBoardNavReady || '') === '1';
        if (Number(bodyEl.__tmKanbanBoardNavActiveIndex) === activeIndex && !options?.force && indicatorReady) return true;
        bodyEl.__tmKanbanBoardNavActiveIndex = activeIndex;
        try { nav.setAttribute('data-active-index', String(activeIndex)); } catch (e) {}
        items.forEach((item, itemIndex) => {
            const active = itemIndex === activeIndex;
            try { item.classList.toggle('tm-kanban-board-nav__item--active', active); } catch (e) {}
            try { item.setAttribute('aria-selected', active ? 'true' : 'false'); } catch (e) {}
            try { item.setAttribute('data-state', active ? 'active' : 'inactive'); } catch (e) {}
        });
        const activeItem = items[activeIndex];
        const inner = nav.querySelector('.tm-kanban-board-nav__inner');
        if (activeItem instanceof HTMLElement && inner instanceof HTMLElement) {
            const indicator = nav.querySelector('.tm-kanban-board-nav__indicator');
            if (indicator instanceof HTMLElement) {
                const x = Math.round(Number(activeItem.offsetLeft || 0));
                const w = Math.max(1, Math.round(Number(activeItem.offsetWidth || 0)));
                const ready = String(nav.dataset?.tmKanbanBoardNavReady || '') === '1';
                if (!ready) {
                    try { indicator.style.transition = 'none'; } catch (e) {}
                }
                try { inner.style.setProperty('--tm-kanban-board-nav-indicator-x', `${x}px`); } catch (e) {}
                try { inner.style.setProperty('--tm-kanban-board-nav-indicator-w', `${w}px`); } catch (e) {}
                try { nav.classList.add('tm-kanban-board-nav--ready'); } catch (e) {}
                if (!ready) {
                    try {
                        requestAnimationFrame(() => {
                            try { indicator.style.transition = ''; } catch (e2) {}
                            try { nav.dataset.tmKanbanBoardNavReady = '1'; } catch (e2) {}
                        });
                    } catch (e) {
                        try { indicator.style.transition = ''; } catch (e2) {}
                        try { nav.dataset.tmKanbanBoardNavReady = '1'; } catch (e2) {}
                    }
                }
            }
            const targetLeft = Math.max(0, Math.round(
                Number(activeItem.offsetLeft || 0) - (Number(inner.clientWidth || 0) - Number(activeItem.offsetWidth || 0)) / 2
            ));
            const behavior = String(options?.behavior || 'auto') === 'smooth' ? 'smooth' : 'auto';
            try {
                inner.scrollTo({ left: targetLeft, behavior });
            } catch (e) {
                try { inner.scrollLeft = targetLeft; } catch (e2) {}
            }
        }
        return true;
    }

    function __tmSyncKanbanBoardNav(bodyEl, options = {}) {
        if (!(bodyEl instanceof HTMLElement)) return false;
        if (!__tmIsKanbanColumnSnapMode(bodyEl)) return false;
        let idx = Number.isFinite(Number(options?.index))
            ? Number(options.index)
            : NaN;
        if (!Number.isFinite(idx)) {
            const lockUntil = Number(bodyEl.__tmKanbanBoardNavLockUntil) || 0;
            const lockIndex = Number(bodyEl.__tmKanbanBoardNavLockIndex);
            if (lockUntil > Date.now() && Number.isFinite(lockIndex) && lockIndex >= 0) {
                idx = lockIndex;
            } else {
                if (lockUntil) {
                    try { bodyEl.__tmKanbanBoardNavLockUntil = 0; } catch (e) {}
                    try { delete bodyEl.__tmKanbanBoardNavLockIndex; } catch (e) {}
                }
                idx = __tmGetKanbanBoardNavIndex(bodyEl);
            }
        }
        if (idx < 0) return false;
        return __tmSetKanbanBoardNavActive(bodyEl, idx, options);
    }

    function __tmScheduleKanbanBoardNavSync(bodyEl) {
        if (!(bodyEl instanceof HTMLElement)) return false;
        if (!__tmIsKanbanColumnSnapMode(bodyEl)) return false;
        if (Number(bodyEl.__tmKanbanBoardNavSyncRaf) > 0) return true;
        try {
            bodyEl.__tmKanbanBoardNavSyncRaf = requestAnimationFrame(() => {
                bodyEl.__tmKanbanBoardNavSyncRaf = 0;
                try { __tmSyncKanbanBoardNav(bodyEl); } catch (e) {}
            });
        } catch (e) {
            bodyEl.__tmKanbanBoardNavSyncRaf = 0;
            try { __tmSyncKanbanBoardNav(bodyEl); } catch (e2) {}
        }
        return true;
    }

    function __tmScheduleKanbanBoardNavInitialSync(bodyEl) {
        if (!(bodyEl instanceof HTMLElement)) return false;
        if (!__tmIsKanbanColumnSnapMode(bodyEl)) return false;
        const sync = (options = {}) => {
            if (bodyEl.isConnected === false) return;
            if (!options?.immediate && __tmDeferKanbanStartupWorkDuringInput(bodyEl, '__tmKanbanBoardNavStartupDeferredTimer', () => sync(), 120)) {
                return;
            }
            try { __tmSyncKanbanSnapMetrics(bodyEl, { force: true }); } catch (e) {}
            try { __tmSyncKanbanBoardNav(bodyEl, { force: true }); } catch (e) {}
        };
        sync({ immediate: true });
        try { requestAnimationFrame(() => requestAnimationFrame(sync)); } catch (e) {}
        try { setTimeout(sync, 80); } catch (e) {}
        try { setTimeout(sync, 220); } catch (e) {}
        return true;
    }

    function __tmBindKanbanBoardNavSwipe(bodyEl) {
        if (!(bodyEl instanceof HTMLElement)) return false;
        const nav = bodyEl.querySelector('.tm-kanban-board-nav');
        const inner = nav?.querySelector?.('.tm-kanban-board-nav__inner') || null;
        if (!(nav instanceof HTMLElement) || !(inner instanceof HTMLElement)) return false;
        if (String(inner.dataset?.tmKanbanBoardNavSwipeBound || '') === '1') return true;
        inner.dataset.tmKanbanBoardNavSwipeBound = '1';
        const clamp0 = (n, min, max) => Math.max(min, Math.min(max, n));
        const canScroll = () => Math.max(0, Number(inner.scrollWidth || 0) - Number(inner.clientWidth || 0)) > 1;
        let pointerId = null;
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let active = false;
        let dragging = false;
        let captured = false;
        let suppressClickUntil = 0;
        const dragThreshold = 8;

        const samePointer = (ev) => {
            if (!Number.isFinite(Number(pointerId))) return true;
            const cur = Number(ev?.pointerId);
            if (!Number.isFinite(cur)) return true;
            return cur === Number(pointerId);
        };

        const endDrag = (ev) => {
            if (!active) return;
            active = false;
            if (dragging) suppressClickUntil = Date.now() + 260;
            dragging = false;
            try { nav.classList.remove('tm-kanban-board-nav--dragging'); } catch (e) {}
            try {
                if (captured && Number.isFinite(Number(pointerId)) && typeof inner.releasePointerCapture === 'function') {
                    inner.releasePointerCapture(pointerId);
                }
            } catch (e) {}
            captured = false;
            pointerId = null;
            try { ev?.stopPropagation?.(); } catch (e) {}
        };

        const onPointerDown = (ev) => {
            if (ev && typeof ev.button === 'number' && ev.button !== 0) return;
            if (!canScroll()) return;
            pointerId = Number.isFinite(Number(ev?.pointerId)) ? Number(ev.pointerId) : null;
            startX = Number(ev?.clientX) || 0;
            startY = Number(ev?.clientY) || 0;
            startLeft = Number(inner.scrollLeft || 0);
            active = true;
            dragging = false;
            captured = false;
            try { __tmMarkHighPriorityInteraction('kanban-board-nav-swipe-start', 360); } catch (e) {}
            try { ev?.stopPropagation?.(); } catch (e) {}
        };

        const onPointerMove = (ev) => {
            if (!active || !samePointer(ev)) return;
            const x = Number(ev?.clientX) || startX;
            const y = Number(ev?.clientY) || startY;
            const dx = x - startX;
            const dy = y - startY;
            if (!dragging) {
                if (Math.abs(dx) < dragThreshold) return;
                if (Math.abs(dx) <= Math.abs(dy)) {
                    endDrag(ev);
                    return;
                }
                dragging = true;
                try {
                    if (Number.isFinite(Number(pointerId)) && typeof inner.setPointerCapture === 'function') {
                        inner.setPointerCapture(pointerId);
                        captured = true;
                    }
                } catch (e) {}
                try { nav.classList.add('tm-kanban-board-nav--dragging'); } catch (e) {}
            }
            const maxLeft = Math.max(0, Number(inner.scrollWidth || 0) - Number(inner.clientWidth || 0));
            inner.scrollLeft = clamp0(startLeft - dx, 0, maxLeft);
            try { __tmMarkHighPriorityInteraction('kanban-board-nav-swipe-move', 140); } catch (e) {}
            try { ev?.preventDefault?.(); } catch (e) {}
            try { ev?.stopPropagation?.(); } catch (e) {}
        };

        const onClickCapture = (ev) => {
            if (Date.now() > suppressClickUntil) return;
            suppressClickUntil = 0;
            try { ev?.preventDefault?.(); } catch (e) {}
            try { ev?.stopPropagation?.(); } catch (e) {}
        };

        try { inner.addEventListener('pointerdown', onPointerDown, { passive: true }); } catch (e) {}
        try { inner.addEventListener('pointermove', onPointerMove, { passive: false }); } catch (e) {}
        try { inner.addEventListener('pointerup', endDrag, { passive: true }); } catch (e) {}
        try { inner.addEventListener('pointercancel', endDrag, { passive: true }); } catch (e) {}
        try { inner.addEventListener('click', onClickCapture, true); } catch (e) {}
        return true;
    }

    window.tmKanbanBoardNavJump = function(ev, index) {
        try { ev?.preventDefault?.(); } catch (e) {}
        try { ev?.stopPropagation?.(); } catch (e) {}
        const target = ev?.currentTarget instanceof Element ? ev.currentTarget : null;
        const bodyEl = target?.closest?.('.tm-body.tm-body--kanban')
            || state.modal?.querySelector?.('.tm-body.tm-body--kanban')
            || null;
        if (!(bodyEl instanceof HTMLElement)) return false;
        try { __tmMarkHighPriorityInteraction('kanban-nav-jump', 520); } catch (e) {}
        const colCount = (() => {
            try { return bodyEl.querySelectorAll('.tm-kanban-col').length; } catch (e) { return 0; }
        })();
        if (colCount <= 0) return false;
        const rawIndex = Number(index);
        if (!Number.isFinite(rawIndex)) return false;
        const targetIndex = Math.max(0, Math.min(colCount - 1, Math.round(rawIndex)));
        const targetLeft = __tmGetKanbanColumnSnapLeftByIndex(bodyEl, targetIndex);
        if (!Number.isFinite(targetLeft)) return false;
        const currentIndex = __tmGetKanbanBoardNavIndex(bodyEl);
        const velocity = targetIndex === currentIndex ? 0 : (targetIndex > currentIndex ? 1 : -1);
        try { __tmStopKanbanMomentum(); } catch (e) {}
        const settleTimer = Number(bodyEl.__tmKanbanSnapSettleTimer) || 0;
        if (settleTimer) {
            try { clearTimeout(settleTimer); } catch (e) {}
            bodyEl.__tmKanbanSnapSettleTimer = 0;
        }
        __tmFlushKanbanScrollLeftRaf(bodyEl);
        __tmSetKanbanSnapPanActive(bodyEl, false);
        bodyEl.__tmKanbanSnapPointerActive = false;
        bodyEl.__tmKanbanSnapGestureStartLeft = targetLeft;
        bodyEl.__tmKanbanSnapScrollVelocity = 0;
        __tmSetKanbanBoardNavActive(bodyEl, targetIndex, { force: true, behavior: 'smooth' });
        return __tmAnimateKanbanScrollLeft(bodyEl, targetLeft, 170, { velocity });
    };

    function __tmGetKanbanGestureSnapLeft(bodyEl, options = {}) {
        const geo = __tmGetKanbanSnapGeometry(bodyEl);
        if (!geo || !Array.isArray(geo.positions) || !geo.positions.length) return NaN;
        const positions = geo.positions;
        const currentLeft = Number(bodyEl.scrollLeft || 0);
        const currentIndex = __tmGetNearestKanbanSnapIndex(positions, currentLeft);
        if (currentIndex < 0) return NaN;
        const rawStartLeft = Number(options?.startLeft);
        const startLeft = Number.isFinite(rawStartLeft) ? rawStartLeft : positions[currentIndex];
        const startIndex = Math.max(0, __tmGetNearestKanbanSnapIndex(positions, startLeft));
        const velocity = Number(options?.velocity);
        const delta = currentLeft - startLeft;
        const nextStep = positions[Math.min(positions.length - 1, startIndex + 1)] - positions[startIndex];
        const prevStep = positions[startIndex] - positions[Math.max(0, startIndex - 1)];
        const rawStep = delta >= 0 ? nextStep : prevStep;
        const step = Math.max(1, Number(rawStep) || Number(geo.clientWidth) || 1);
        const distanceThreshold = Math.max(38, Math.min(140, step * 0.25));
        const velocityThreshold = 0.11;
        let direction = 0;
        if (Number.isFinite(velocity) && Math.abs(velocity) >= velocityThreshold) {
            direction = velocity > 0 ? 1 : -1;
        } else if (Math.abs(delta) >= distanceThreshold) {
            direction = delta > 0 ? 1 : -1;
        }
        if (!direction) return positions[currentIndex];
        const targetIndex = Math.max(0, Math.min(positions.length - 1, startIndex + direction));
        return positions[targetIndex];
    }

    function __tmGetKanbanHarmonySpringProgress(seconds, velocity = 0) {
        const t = Math.max(0, Number(seconds) || 0);
        if (t <= 0) return 0;
        const mass = 1;
        const stiffness = 520;
        const damping = 46;
        const v0 = Math.max(-4, Math.min(14, Number(velocity) || 0));
        const omega0 = Math.sqrt(stiffness / mass);
        const zeta = damping / (2 * Math.sqrt(stiffness * mass));
        let progress = 1;
        if (zeta < 1) {
            const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
            const envelope = Math.exp(-zeta * omega0 * t);
            progress = 1 - envelope * (
                Math.cos(omegaD * t)
                + ((zeta * omega0 - v0) / omegaD) * Math.sin(omegaD * t)
            );
        } else if (Math.abs(zeta - 1) < 0.001) {
            progress = 1 - Math.exp(-omega0 * t) * (1 + (omega0 - v0) * t);
        } else {
            const root = Math.sqrt(zeta * zeta - 1);
            const r1 = -omega0 * (zeta - root);
            const r2 = -omega0 * (zeta + root);
            const a = (-v0 - r2) / (r1 - r2);
            const b = 1 - a;
            progress = 1 - (a * Math.exp(r1 * t) + b * Math.exp(r2 * t));
        }
        return Math.max(0, Math.min(1, progress));
    }

    function __tmAnimateKanbanScrollLeft(bodyEl, targetLeft, durationMs = 200, options = {}) {
        if (!(bodyEl instanceof HTMLElement)) return false;
        const left = Number(targetLeft);
        if (!Number.isFinite(left)) return false;
        const maxLeft = Math.max(0, Number(bodyEl.scrollWidth || 0) - Number(bodyEl.clientWidth || 0));
        const target = Math.max(0, Math.min(maxLeft, Math.round(left)));
        const start = Number(bodyEl.scrollLeft || 0);
        if (Math.abs(start - target) < 0.5) {
            bodyEl.scrollLeft = target;
            return true;
        }
        const prevRaf = Number(bodyEl.__tmKanbanSnapAnimRaf) || 0;
        if (prevRaf) {
            try { cancelAnimationFrame(prevRaf); } catch (e) {}
        }
        const startTs = (() => {
            try { return performance.now(); } catch (e) { return Date.now(); }
        })();
        const distance = Math.abs(target - start);
        const clientWidth = Math.max(1, Number(bodyEl.clientWidth || 0) || 1);
        const distanceRatio = Math.max(0, Math.min(1.6, distance / clientWidth));
        const requestedDuration = Math.max(120, Number(durationMs) || 200);
        const maxDuration = Math.max(520, Math.min(760, requestedDuration + 260 + distanceRatio * 90));
        try { __tmMarkHighPriorityInteraction('kanban-scroll-anim', maxDuration + 120); } catch (e) {}
        const navTargetIndex = __tmGetKanbanBoardNavIndex(bodyEl, target);
        if (navTargetIndex >= 0) {
            try {
                bodyEl.__tmKanbanBoardNavLockIndex = navTargetIndex;
                bodyEl.__tmKanbanBoardNavLockUntil = Date.now() + maxDuration + 180;
                __tmSetKanbanBoardNavActive(bodyEl, navTargetIndex, { behavior: 'smooth' });
            } catch (e) {}
        }
        const token = `${startTs}:${target}:${Math.random()}`;
        bodyEl.__tmKanbanSnapAnimToken = token;
        const delta = target - start;
        const rawVelocity = Number.isFinite(Number(options?.velocity))
            ? Number(options.velocity)
            : Number(bodyEl.__tmKanbanSnapScrollVelocity);
        const initialVelocity = Math.abs(delta) > 0.5 && Number.isFinite(rawVelocity)
            ? Math.max(-4, Math.min(14, (rawVelocity * 1000) / delta))
            : 0;
        let lastAnimLeft = start;
        let lastAnimTs = startTs;
        const step = (ts) => {
            if (bodyEl.__tmKanbanSnapAnimToken !== token) return;
            const now = Number(ts) || Date.now();
            const elapsedMs = Math.max(0, now - startTs);
            const progress = __tmGetKanbanHarmonySpringProgress(elapsedMs / 1000, initialVelocity);
            const nextLeft = start + delta * progress;
            const frameDt = Math.max(1, now - lastAnimTs);
            const velocityPxPerMs = Math.abs(nextLeft - lastAnimLeft) / frameDt;
            lastAnimLeft = nextLeft;
            lastAnimTs = now;
            bodyEl.scrollLeft = nextLeft;
            const remaining = Math.abs(target - nextLeft);
            if ((remaining > 1.1 || velocityPxPerMs > 0.009) && elapsedMs < maxDuration) {
                bodyEl.__tmKanbanSnapAnimRaf = requestAnimationFrame(step);
                return;
            }
            bodyEl.__tmKanbanSnapAnimRaf = 0;
            bodyEl.__tmKanbanSnapAnimToken = '';
            bodyEl.scrollLeft = target;
            try { __tmMarkHighPriorityInteraction('kanban-scroll-anim-done', 96); } catch (e) {}
            try {
                bodyEl.__tmKanbanBoardNavLockUntil = 0;
                delete bodyEl.__tmKanbanBoardNavLockIndex;
                __tmSyncKanbanBoardNav(bodyEl, { force: true });
            } catch (e) {}
        };
        try {
            bodyEl.__tmKanbanSnapAnimRaf = requestAnimationFrame(step);
        } catch (e) {
            bodyEl.__tmKanbanSnapAnimRaf = 0;
            bodyEl.__tmKanbanSnapAnimToken = '';
            bodyEl.scrollLeft = target;
        }
        return true;
    }

    function __tmSnapKanbanToNearestColumn(bodyEl, options = {}) {
        if (!(bodyEl instanceof HTMLElement)) return false;
        const explicitLeft = Number(options?.targetLeft);
        const left = Number.isFinite(explicitLeft)
            ? explicitLeft
            : (Number.isFinite(Number(options?.startLeft)) || Number.isFinite(Number(options?.velocity))
                ? __tmGetKanbanGestureSnapLeft(bodyEl, options)
                : __tmGetNearestKanbanSnapLeft(bodyEl));
        if (!Number.isFinite(left)) return false;
        const current = Number(bodyEl.scrollLeft || 0);
        if (Math.abs(current - left) < 0.5) return true;
        let behavior = String(options?.behavior || 'smooth');
        try {
            if (behavior !== 'auto' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
                behavior = 'auto';
            }
        } catch (e) {}
        if (behavior === 'fast') {
            return __tmAnimateKanbanScrollLeft(bodyEl, left, Number(options?.durationMs) || 200, options);
        }
        try {
            bodyEl.scrollTo({ left, behavior: behavior === 'auto' ? 'auto' : 'smooth' });
        } catch (e) {
            try { bodyEl.scrollLeft = left; } catch (e2) {}
        }
        return true;
    }

    function __tmSnapKanbanByWheelStep(bodyEl, direction) {
        if (!(bodyEl instanceof HTMLElement)) return false;
        const dir = Number(direction) > 0 ? 1 : (Number(direction) < 0 ? -1 : 0);
        if (!dir) return false;
        const geo = __tmGetKanbanSnapGeometry(bodyEl);
        if (!geo || !Array.isArray(geo.positions) || geo.positions.length <= 1) return false;
        const currentLeft = Number(bodyEl.scrollLeft || 0);
        const currentIndex = __tmGetNearestKanbanSnapIndex(geo.positions, currentLeft);
        if (currentIndex < 0) return false;
        const targetIndex = Math.max(0, Math.min(geo.positions.length - 1, currentIndex + dir));
        if (targetIndex === currentIndex) return false;
        bodyEl.__tmKanbanSnapGestureStartLeft = currentLeft;
        bodyEl.__tmKanbanSnapScrollVelocity = dir;
        return __tmSnapKanbanToNearestColumn(bodyEl, {
            behavior: 'fast',
            targetLeft: geo.positions[targetIndex],
            velocity: dir,
            durationMs: 190,
        });
    }

    function __tmSettleKanbanSnapAfterStableScroll(bodyEl) {
        if (!(bodyEl instanceof HTMLElement)) return false;
        if (!__tmIsKanbanColumnSnapMode(bodyEl)) return false;
        if (Number(bodyEl.__tmKanbanSnapAnimRaf) > 0) return true;
        if (bodyEl.__tmKanbanSnapPointerActive || __tmIsKanbanSnapPanActive(bodyEl)) {
            __tmScheduleKanbanSnapSettle(bodyEl, 48);
            return true;
        }
        __tmFlushKanbanScrollLeftRaf(bodyEl);
        const before = Number(bodyEl.scrollLeft || 0);
        const finish = () => {
            if (!__tmIsKanbanColumnSnapMode(bodyEl)) return;
            if (bodyEl.__tmKanbanSnapPointerActive || __tmIsKanbanSnapPanActive(bodyEl)) {
                __tmScheduleKanbanSnapSettle(bodyEl, 48);
                return;
            }
            __tmFlushKanbanScrollLeftRaf(bodyEl);
            const after = Number(bodyEl.scrollLeft || 0);
            if (Math.abs(after - before) > 0.75) {
                __tmScheduleKanbanSnapSettle(bodyEl, 56);
                return;
            }
            __tmSnapKanbanToNearestColumn(bodyEl, {
                behavior: 'fast',
                startLeft: bodyEl.__tmKanbanSnapGestureStartLeft,
                velocity: bodyEl.__tmKanbanSnapScrollVelocity,
            });
        };
        try {
            requestAnimationFrame(() => requestAnimationFrame(finish));
        } catch (e) {
            try { setTimeout(finish, 48); } catch (e2) { finish(); }
        }
        return true;
    }

    function __tmScheduleKanbanSnapSettle(bodyEl, delayMs = 80) {
        if (!(bodyEl instanceof HTMLElement)) return false;
        if (!__tmIsKanbanColumnSnapMode(bodyEl)) return false;
        const delay = Math.max(0, Math.min(240, Number(delayMs) || 0));
        const prevTimer = Number(bodyEl.__tmKanbanSnapSettleTimer) || 0;
        if (prevTimer) {
            try { clearTimeout(prevTimer); } catch (e) {}
        }
        try {
            bodyEl.__tmKanbanSnapSettleTimer = setTimeout(() => {
                bodyEl.__tmKanbanSnapSettleTimer = 0;
                if (!__tmIsKanbanColumnSnapMode(bodyEl)) return;
                if (bodyEl.__tmKanbanSnapPointerActive || __tmIsKanbanSnapPanActive(bodyEl)) {
                    __tmScheduleKanbanSnapSettle(bodyEl, 72);
                    return;
                }
                __tmSettleKanbanSnapAfterStableScroll(bodyEl);
            }, delay);
        } catch (e) {
            bodyEl.__tmKanbanSnapSettleTimer = 0;
            __tmSnapKanbanToNearestColumn(bodyEl, { behavior: 'fast' });
        }
        return true;
    }

    function __tmBindKanbanSnapSettle(bodyEl) {
        if (!(bodyEl instanceof HTMLElement)) return false;
        if (String(bodyEl.dataset?.tmKanbanSnapSettleBound || '') === '1') return true;
        bodyEl.dataset.tmKanbanSnapSettleBound = '1';
        const getNow = () => {
            try { return performance.now(); } catch (e) { return Date.now(); }
        };
        const onInputStart = () => {
            try { __tmMarkHighPriorityInteraction('kanban-input-start', 520); } catch (e) {}
            const snapRaf = Number(bodyEl.__tmKanbanSnapAnimRaf) || 0;
            if (snapRaf) {
                try { cancelAnimationFrame(snapRaf); } catch (e) {}
                bodyEl.__tmKanbanSnapAnimRaf = 0;
                bodyEl.__tmKanbanSnapAnimToken = '';
            }
            const left = Number(bodyEl.scrollLeft || 0);
            const now = getNow();
            bodyEl.__tmKanbanSnapPointerActive = true;
            bodyEl.__tmKanbanSnapGestureStartLeft = left;
            bodyEl.__tmKanbanSnapLastScrollLeft = left;
            bodyEl.__tmKanbanSnapLastScrollTs = now;
            bodyEl.__tmKanbanSnapScrollVelocity = 0;
            const timer = Number(bodyEl.__tmKanbanSnapSettleTimer) || 0;
            if (timer) {
                try { clearTimeout(timer); } catch (e) {}
                bodyEl.__tmKanbanSnapSettleTimer = 0;
            }
        };
        const onInputEnd = () => {
            try { __tmMarkHighPriorityInteraction('kanban-input-end', 360); } catch (e) {}
            bodyEl.__tmKanbanSnapPointerActive = false;
            __tmScheduleKanbanSnapSettle(bodyEl, 28);
        };
        const onScroll = () => {
            try {
                if (__tmIsKanbanColumnSnapMode(bodyEl)) __tmMarkHighPriorityInteraction('kanban-scroll', 180);
            } catch (e) {}
            const left = Number(bodyEl.scrollLeft || 0);
            const now = getNow();
            const prevLeft = Number(bodyEl.__tmKanbanSnapLastScrollLeft);
            const prevTs = Number(bodyEl.__tmKanbanSnapLastScrollTs);
            if (Number.isFinite(prevLeft) && Number.isFinite(prevTs) && now > prevTs) {
                const dt = Math.max(1, Math.min(80, now - prevTs));
                bodyEl.__tmKanbanSnapScrollVelocity = (left - prevLeft) / dt;
            }
            bodyEl.__tmKanbanSnapLastScrollLeft = left;
            bodyEl.__tmKanbanSnapLastScrollTs = now;
            __tmScheduleKanbanBoardNavSync(bodyEl);
            if (Number(bodyEl.__tmKanbanSnapAnimRaf) > 0) return;
            if (bodyEl.__tmKanbanSnapPointerActive) return;
            __tmScheduleKanbanSnapSettle(bodyEl, 72);
        };
        const onWheel = (ev) => {
            if (!__tmIsKanbanColumnSnapMode(bodyEl)) {
                __tmScheduleKanbanSnapSettle(bodyEl, 72);
                return;
            }
            const dx = Number(ev?.deltaX) || 0;
            const dy = Number(ev?.deltaY) || 0;
            const horizontalIntent = !!ev?.shiftKey || Math.abs(dx) > Math.abs(dy);
            if (!horizontalIntent) return;
            let delta = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
            if (Number(ev?.deltaMode) === 1) delta *= 16;
            else if (Number(ev?.deltaMode) === 2) delta *= Math.max(1, Number(bodyEl.clientWidth || 1));
            if (!Number.isFinite(delta) || Math.abs(delta) < 0.5) return;
            try { __tmMarkHighPriorityInteraction('kanban-wheel', 380); } catch (e) {}
            try { ev.preventDefault?.(); } catch (e) {}
            try { ev.stopPropagation?.(); } catch (e) {}
            const now = getNow();
            const lastTs = Number(bodyEl.__tmKanbanWheelTs) || 0;
            if (!lastTs || now - lastTs > 260) bodyEl.__tmKanbanWheelAccum = 0;
            bodyEl.__tmKanbanWheelTs = now;
            bodyEl.__tmKanbanWheelAccum = (Number(bodyEl.__tmKanbanWheelAccum) || 0) + delta;
            const resetTimer = Number(bodyEl.__tmKanbanWheelResetTimer) || 0;
            if (resetTimer) {
                try { clearTimeout(resetTimer); } catch (e) {}
            }
            try {
                bodyEl.__tmKanbanWheelResetTimer = setTimeout(() => {
                    bodyEl.__tmKanbanWheelResetTimer = 0;
                    bodyEl.__tmKanbanWheelAccum = 0;
                }, 220);
            } catch (e) {}
            const threshold = Math.max(18, Math.min(44, Number(bodyEl.clientWidth || 0) * 0.08 || 28));
            const accum = Number(bodyEl.__tmKanbanWheelAccum) || 0;
            if (Math.abs(accum) < threshold) return;
            bodyEl.__tmKanbanWheelAccum = 0;
            const activeResetTimer = Number(bodyEl.__tmKanbanWheelResetTimer) || 0;
            if (activeResetTimer) {
                try { clearTimeout(activeResetTimer); } catch (e) {}
                bodyEl.__tmKanbanWheelResetTimer = 0;
            }
            __tmSnapKanbanByWheelStep(bodyEl, accum > 0 ? 1 : -1);
        };
        try { bodyEl.addEventListener('pointerdown', onInputStart, { capture: true, passive: true }); } catch (e) {}
        try { bodyEl.addEventListener('pointerup', onInputEnd, { capture: true, passive: true }); } catch (e) {}
        try { bodyEl.addEventListener('pointercancel', onInputEnd, { capture: true, passive: true }); } catch (e) {}
        try { bodyEl.addEventListener('touchstart', onInputStart, { capture: true, passive: true }); } catch (e) {}
        try { bodyEl.addEventListener('touchend', onInputEnd, { capture: true, passive: true }); } catch (e) {}
        try { bodyEl.addEventListener('touchcancel', onInputEnd, { capture: true, passive: true }); } catch (e) {}
        try { bodyEl.addEventListener('scroll', onScroll, { passive: true }); } catch (e) {}
        try { bodyEl.addEventListener('wheel', onWheel, { passive: false }); } catch (e) {}
        try { bodyEl.addEventListener('scrollend', () => {
            __tmScheduleKanbanSnapSettle(bodyEl, 0);
        }, { passive: true }); } catch (e) {}
        return true;
    }

    function __tmShouldIsolatePluginHostGestures(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return false;
        return modal.classList.contains('tm-modal--mobile')
            || modal.classList.contains('tm-modal--dock')
            || !!modal.closest?.('[data-tm-host-mode="dock"]');
    }

    function __tmBindPluginHostGestureIsolation(modalEl) {
        const modal = modalEl instanceof HTMLElement ? modalEl : (state.modal instanceof HTMLElement ? state.modal : null);
        if (!(modal instanceof HTMLElement)) return false;
        if (String(modal.dataset?.tmHostGestureIsolationBound || '') === '1') return true;
        modal.dataset.tmHostGestureIsolationBound = '1';
        const stopAtPluginBoundary = (ev) => {
            if (!__tmShouldIsolatePluginHostGestures(modal)) return;
            try { ev.stopPropagation?.(); } catch (e) {}
        };
        try { modal.addEventListener('touchstart', stopAtPluginBoundary, { passive: true }); } catch (e) {}
        try { modal.addEventListener('touchmove', stopAtPluginBoundary, { passive: true }); } catch (e) {}
        try { modal.addEventListener('touchend', stopAtPluginBoundary, { passive: true }); } catch (e) {}
        try { modal.addEventListener('touchcancel', stopAtPluginBoundary, { passive: true }); } catch (e) {}
        try { modal.addEventListener('pointerdown', stopAtPluginBoundary); } catch (e) {}
        try { modal.addEventListener('pointermove', stopAtPluginBoundary); } catch (e) {}
        try { modal.addEventListener('pointerup', stopAtPluginBoundary); } catch (e) {}
        try { modal.addEventListener('pointercancel', stopAtPluginBoundary); } catch (e) {}
        return true;
    }

    function __tmBindKanbanHostGestureIsolation(bodyEl) {
        if (!(bodyEl instanceof HTMLElement)) return false;
        if (String(bodyEl.dataset?.tmKanbanHostGestureIsolationBound || '') === '1') return true;
        bodyEl.dataset.tmKanbanHostGestureIsolationBound = '1';
        const isFromBoardNav = (ev) => {
            try { return !!(ev?.target instanceof Element && ev.target.closest('.tm-kanban-board-nav')); } catch (e) {}
            return false;
        };
        const getTouchPoint = (ev) => {
            const touches = ev?.touches || ev?.changedTouches || null;
            const touch = touches && touches.length ? touches[0] : null;
            if (!touch) return null;
            return {
                x: Number(touch.clientX) || 0,
                y: Number(touch.clientY) || 0,
            };
        };
        const reset = () => {
            bodyEl.__tmKanbanHostGestureStartX = NaN;
            bodyEl.__tmKanbanHostGestureStartY = NaN;
            bodyEl.__tmKanbanHostGestureHorizontal = false;
        };
        const onTouchStart = (ev) => {
            if (!__tmIsKanbanColumnSnapMode(bodyEl)) return;
            if (isFromBoardNav(ev)) return;
            const pt = getTouchPoint(ev);
            if (!pt) return;
            bodyEl.__tmKanbanHostGestureStartX = pt.x;
            bodyEl.__tmKanbanHostGestureStartY = pt.y;
            bodyEl.__tmKanbanHostGestureHorizontal = false;
            try { ev.stopPropagation?.(); } catch (e) {}
        };
        const onTouchMove = (ev) => {
            if (!__tmIsKanbanColumnSnapMode(bodyEl)) return;
            if (isFromBoardNav(ev)) return;
            const pt = getTouchPoint(ev);
            if (!pt) return;
            const startX = Number(bodyEl.__tmKanbanHostGestureStartX);
            const startY = Number(bodyEl.__tmKanbanHostGestureStartY);
            if (!Number.isFinite(startX) || !Number.isFinite(startY)) return;
            const dx = pt.x - startX;
            const dy = pt.y - startY;
            const absX = Math.abs(dx);
            const absY = Math.abs(dy);
            if (!bodyEl.__tmKanbanHostGestureHorizontal && absX >= 4 && absX >= absY * 0.72) {
                bodyEl.__tmKanbanHostGestureHorizontal = true;
            }
            if (!bodyEl.__tmKanbanHostGestureHorizontal) return;
            try { ev.preventDefault?.(); } catch (e) {}
            try { ev.stopPropagation?.(); } catch (e) {}
        };
        const onTouchEnd = (ev) => {
            if (isFromBoardNav(ev)) {
                reset();
                return;
            }
            if (bodyEl.__tmKanbanHostGestureHorizontal) {
                try { ev.stopPropagation?.(); } catch (e) {}
            }
            reset();
        };
        reset();
        try { bodyEl.addEventListener('touchstart', onTouchStart, { capture: true, passive: true }); } catch (e) {}
        try { bodyEl.addEventListener('touchmove', onTouchMove, { capture: true, passive: false }); } catch (e) {}
        try { bodyEl.addEventListener('touchend', onTouchEnd, { capture: true, passive: true }); } catch (e) {}
        try { bodyEl.addEventListener('touchcancel', onTouchEnd, { capture: true, passive: true }); } catch (e) {}
        return true;
    }

    function __tmStopKanbanMomentum() {
        const momentumBody = state.__tmKanbanMomentumBody;
        const rafId = Number(state.__tmKanbanMomentumRaf) || 0;
        if (rafId) {
            try { cancelAnimationFrame(rafId); } catch (e) {}
        }
        state.__tmKanbanMomentumRaf = 0;
        state.__tmKanbanMomentumBody = null;
        if (momentumBody instanceof HTMLElement) __tmSetKanbanSnapPanActive(momentumBody, false);
    }

    function __tmStartKanbanMomentum(bodyEl, initialVelocity, options = {}) {
        if (!(bodyEl instanceof HTMLElement)) return false;
        try { __tmMarkHighPriorityInteraction('kanban-momentum-start', 620); } catch (e) {}
        __tmStopKanbanMomentum();
        __tmFlushKanbanScrollLeftRaf(bodyEl);
        const snapMode = __tmSyncKanbanSnapMetrics(bodyEl);
        if (snapMode) {
            __tmSetKanbanSnapPanActive(bodyEl, false);
            bodyEl.__tmKanbanSnapGestureStartLeft = Number(options?.startLeft);
            bodyEl.__tmKanbanSnapScrollVelocity = Number(initialVelocity) || 0;
            __tmSnapKanbanToNearestColumn(bodyEl, {
                behavior: 'fast',
                startLeft: options?.startLeft,
                velocity: initialVelocity,
            });
            return false;
        }
        let velocity = Number(initialVelocity) || 0;
        if (!Number.isFinite(velocity) || Math.abs(velocity) < 0.08) {
            __tmSnapKanbanToNearestColumn(bodyEl, { behavior: 'smooth' });
            return false;
        }
        const frictionPerFrame = 0.90;
        const stopVelocity = 0.02;
        let lastTs = 0;
        __tmSetKanbanSnapPanActive(bodyEl, true);
        state.__tmKanbanMomentumBody = bodyEl;
        const step = (ts) => {
            const now = Number(ts) || Date.now();
            if (!lastTs) {
                lastTs = now;
                state.__tmKanbanMomentumRaf = requestAnimationFrame(step);
                return;
            }
            const dt = Math.max(8, Math.min(34, now - lastTs));
            lastTs = now;
            const prev = Number(bodyEl.scrollLeft || 0);
            const maxLeft = Math.max(0, bodyEl.scrollWidth - bodyEl.clientWidth);
            const next = Math.max(0, Math.min(maxLeft, prev + velocity * dt));
            bodyEl.scrollLeft = next;
            const hitEdge = (next <= 0 && velocity < 0) || (next >= maxLeft && velocity > 0) || Math.abs(next - prev) < 0.1;
            velocity *= Math.pow(frictionPerFrame, dt / 16);
            if (hitEdge || Math.abs(velocity) < stopVelocity) {
                try { __tmMarkHighPriorityInteraction('kanban-momentum-done', 120); } catch (e) {}
                __tmStopKanbanMomentum();
                __tmSnapKanbanToNearestColumn(bodyEl, { behavior: 'smooth' });
                return;
            }
            try { __tmMarkHighPriorityInteraction('kanban-momentum-frame', 140); } catch (e) {}
            state.__tmKanbanMomentumRaf = requestAnimationFrame(step);
        };
        state.__tmKanbanMomentumRaf = requestAnimationFrame(step);
        return true;
    }

    function __tmClearKanbanCardGesture() {
        const cleanup = state.__tmKanbanCardGestureCleanup;
        if (typeof cleanup !== 'function') return;
        try { cleanup(); } catch (e) {}
    }

    window.tmKanbanCardPointerDown = function(ev, id) {
        if (state.viewMode !== 'kanban') return;
        if (__tmIsMultiSelectActive('kanban')) return;
        if (!__tmIsKanbanTouchPointer(ev)) return;
        if (ev && typeof ev.button === 'number' && ev.button !== 0) return;
        try { ev.stopPropagation?.(); } catch (e) {}
        let cardEl = ev?.currentTarget instanceof HTMLElement
            ? ev.currentTarget
            : (ev?.target instanceof Element ? ev.target.closest('.tm-kanban-card[data-id]') : null);
        if (!(cardEl instanceof HTMLElement)) return;
        const rawTaskId = String(id || cardEl.getAttribute('data-id') || '').trim();
        const resolvedDrag = __tmResolveKanbanEffectiveDragTarget(rawTaskId, cardEl);
        const taskId = String(resolvedDrag?.taskId || rawTaskId || '').trim();
        if (resolvedDrag?.cardEl instanceof HTMLElement) cardEl = resolvedDrag.cardEl;
        const bodyEl = state.modal?.querySelector?.('.tm-body.tm-body--kanban');
        if (!(bodyEl instanceof HTMLElement)) return;
        try { __tmMarkHighPriorityInteraction('kanban-card-touch-start', 520); } catch (e) {}
        try { __tmSyncKanbanSnapMetrics(bodyEl); } catch (e) {}
        const colBodyEl = cardEl.closest('.tm-kanban-col')?.querySelector?.('.tm-kanban-col-body');
        if (!taskId) return;
        const calendarDragMeta = (() => {
            try {
                return (typeof window.tmCalendarGetTaskDragMeta === 'function')
                    ? window.tmCalendarGetTaskDragMeta(taskId)
                    : null;
            } catch (e) {
                return null;
            }
        })();

        __tmClearKanbanCardGesture();
        __tmStopKanbanMomentum();

        const clamp0 = (n, min, max) => Math.max(min, Math.min(max, n));
        const suppressClickMs = 260;
        const panThreshold = 2;
        const scrollThreshold = 4;
        const longPressIntentThreshold = 4;
        const axisLockRatio = 0.75;
        const longPressMs = 1000;
        const pointerType = String(ev?.pointerType || '').trim().toLowerCase();
        const isMouseLikePointer = pointerType === 'mouse' || (!pointerType && !__tmIsRuntimeMobileClient());
        const longPressMoveTolerance = isMouseLikePointer
            ? 3
            : (pointerType === 'pen' ? 4 : 8);
        const floatingMiniRevealDistance = 20;
        const floatingMiniRevealDelayMs = 120;
        const pointerId = Number.isFinite(Number(ev?.pointerId)) ? Number(ev.pointerId) : null;
        const startX = Number(ev?.clientX) || 0;
        const startY = Number(ev?.clientY) || 0;
        const baseScrollLeft = Number(bodyEl.scrollLeft || 0);
        const maxPanScrollLeft = __tmGetKanbanMaxPanScrollLeft(bodyEl);
        let lastX = startX;
        let lastY = startY;
        let mode = 'pending';
        let ended = false;
        let captured = false;
        let longPressTimer = null;
        let ghostMeta = null;
        let colBodyUserSelectTouched = false;
        let bodyGestureStylesTouched = false;
        let panVelocity = 0;
        let lastPanScrollLeft = baseScrollLeft;
        let lastPanTs = 0;
        let dragStartedAt = 0;
        let dragStartX = NaN;
        let dragStartY = NaN;
        let floatingMiniVisible = false;
        let floatingMiniRevealTimer = null;
        let preventTouchGestureScrollBound = false;
        const prevCardDraggableAttr = cardEl.getAttribute('draggable');
        const cardDraggableTouched = __tmIsKanbanColumnSnapMode(bodyEl) && prevCardDraggableAttr !== 'false';
        if (cardDraggableTouched) {
            try { cardEl.setAttribute('draggable', 'false'); } catch (e2) {}
        }
        const preventTouchGestureScroll = (e2) => {
            if (ended || (mode !== 'drag' && mode !== 'pan')) return;
            try { e2?.preventDefault?.(); } catch (e3) {}
        };
        const bindPreventTouchGestureScroll = () => {
            if (preventTouchGestureScrollBound) return;
            preventTouchGestureScrollBound = true;
            try { window.addEventListener('touchmove', preventTouchGestureScroll, { capture: true, passive: false }); } catch (e2) {}
            try { window.addEventListener('pointermove', preventTouchGestureScroll, { capture: true, passive: false }); } catch (e2) {}
        };

        const samePointer = (e2) => {
            if (!Number.isFinite(pointerId)) return true;
            const cur = Number(e2?.pointerId);
            if (!Number.isFinite(cur)) return true;
            return cur === pointerId;
        };

        const getGestureTs = (e2) => {
            const ts = Number(e2?.timeStamp);
            return Number.isFinite(ts) && ts > 0 ? ts : Date.now();
        };

        const canPan = () => maxPanScrollLeft > 2;
        const cancelLongPress = () => {
            if (!longPressTimer) return;
            try { clearTimeout(longPressTimer); } catch (e2) {}
            longPressTimer = null;
        };

        const cancelFloatingMiniStart = () => {
            if (!floatingMiniRevealTimer) return;
            try { clearTimeout(floatingMiniRevealTimer); } catch (e2) {}
            floatingMiniRevealTimer = null;
        };

        const startFloatingMini = () => {
            cancelFloatingMiniStart();
            if (mode !== 'drag' || ended || floatingMiniVisible) return false;
            try {
                floatingMiniVisible = !!__tmCalendarFloatingDragStart(taskId, calendarDragMeta, {
                    clientX: lastX,
                    clientY: lastY,
                    target: __tmResolveKanbanPointTarget(lastX, lastY) || cardEl,
                }, { mode: 'mobile', html5: false });
            } catch (e2) {
                floatingMiniVisible = false;
            }
            return floatingMiniVisible;
        };

        const capturePointer = () => {
            if (captured || !Number.isFinite(pointerId) || typeof cardEl.setPointerCapture !== 'function') return;
            try {
                cardEl.setPointerCapture(pointerId);
                captured = true;
            } catch (e2) {}
        };

        const setGestureActiveStyles = () => {
            try { bodyEl.style.cursor = 'grabbing'; } catch (e2) {}
            try { bodyEl.style.userSelect = 'none'; } catch (e2) {}
            bodyGestureStylesTouched = true;
            if (colBodyEl instanceof HTMLElement) {
                try {
                    colBodyEl.style.userSelect = 'none';
                    colBodyUserSelectTouched = true;
                } catch (e2) {}
            }
        };

        const updateDragFeedback = (x, y) => {
            if (mode !== 'drag') return;
            __tmPlaceKanbanTouchDragGhost(ghostMeta, x, y);
            if (!floatingMiniVisible) {
                const dx0 = Number.isFinite(dragStartX) ? (x - dragStartX) : 0;
                const dy0 = Number.isFinite(dragStartY) ? (y - dragStartY) : 0;
                const movedEnough = (dx0 * dx0 + dy0 * dy0) >= (floatingMiniRevealDistance * floatingMiniRevealDistance);
                if (movedEnough) {
                    const elapsed = Math.max(0, Date.now() - dragStartedAt);
                    if (elapsed >= floatingMiniRevealDelayMs) {
                        startFloatingMini();
                    } else if (!floatingMiniRevealTimer) {
                        floatingMiniRevealTimer = setTimeout(() => {
                            floatingMiniRevealTimer = null;
                            startFloatingMini();
                        }, Math.max(0, floatingMiniRevealDelayMs - elapsed));
                    }
                } else {
                    cancelFloatingMiniStart();
                }
            }
            let pointTarget = __tmResolveKanbanPointTarget(x, y);
            const floatingInfo = floatingMiniVisible
                ? __tmCalendarFloatingDragMove({
                    clientX: x,
                    clientY: y,
                    target: pointTarget || cardEl,
                }, { mode: 'mobile' })
                : null;
            if (floatingInfo?.overFloatingMini) {
                try { __tmKanbanClearDragOver(); } catch (e2) {}
                return;
            }
            try {
                window.tmKanbanAutoScroll?.({
                    preventDefault() {},
                    clientX: x,
                    clientY: y,
                    target: pointTarget || cardEl,
                });
            } catch (e2) {}
            pointTarget = __tmResolveKanbanPointTarget(x, y) || pointTarget;
            __tmApplyKanbanDragHoverFromTarget(pointTarget);
        };

        const hasMovedBeyondLongPressTolerance = () => {
            const pressDx = lastX - startX;
            const pressDy = lastY - startY;
            return (pressDx * pressDx + pressDy * pressDy) >= (longPressMoveTolerance * longPressMoveTolerance);
        };

        const armDragReady = () => {
            if (mode !== 'pending' || ended) return;
            if (hasMovedBeyondLongPressTolerance()) {
                cancelLongPress();
                return;
            }
            mode = 'drag-ready';
            cancelLongPress();
            state.__tmKanbanPanSuppressClickUntil = Date.now() + suppressClickMs;
        };

        const startPan = () => {
            if (mode !== 'pending' || ended) return;
            mode = 'pan';
            try { __tmMarkHighPriorityInteraction('kanban-card-pan-start', 520); } catch (e2) {}
            cancelLongPress();
            bindPreventTouchGestureScroll();
            __tmSetKanbanSnapPanActive(bodyEl, true);
            panVelocity = 0;
            lastPanScrollLeft = Number(bodyEl.scrollLeft || 0);
            lastPanTs = 0;
        };

        const startDrag = (options = {}) => {
            const fromReady = !!options?.fromReady;
            if ((mode !== 'pending' && mode !== 'drag-ready') || ended) return;
            if (!fromReady && hasMovedBeyondLongPressTolerance()) {
                cancelLongPress();
                return;
            }
            mode = 'drag';
            try { __tmMarkHighPriorityInteraction('kanban-card-drag-start', 520); } catch (e2) {}
            cancelLongPress();
            capturePointer();
            cancelFloatingMiniStart();
            bindPreventTouchGestureScroll();
            setGestureActiveStyles();
            state.draggingTaskId = taskId;
            state.__tmKanbanDragId = taskId;
            state.__tmKanbanDragIds = [taskId];
            try { __tmBindKanbanDocumentAutoScroll(); } catch (e2) {}
            try { __tmSetCalendarSideDockDragHidden(true); } catch (e2) {}
            try { cardEl.classList.add('tm-kanban-card--dragging'); } catch (e2) {}
            ghostMeta = __tmBuildKanbanTouchDragGhost(cardEl, lastX, lastY);
            dragStartedAt = Date.now();
            dragStartX = lastX;
            dragStartY = lastY;
            floatingMiniVisible = false;
            state.__tmKanbanPanSuppressClickUntil = Date.now() + suppressClickMs;
            updateDragFeedback(lastX, lastY);
        };

        const finishDrag = async () => {
            if (mode !== 'drag') return;
            cancelFloatingMiniStart();
            try {
                const handled = await globalThis.__tmCalendar?.finalizeFloatingMiniCalendarTouchDrop?.({
                    taskId,
                    clientX: lastX,
                    clientY: lastY,
                    target: __tmResolveKanbanPointTarget(lastX, lastY),
                    mode: 'mobile',
                });
                if (handled) return;
            } catch (e2) {}
            const pointTarget = __tmResolveKanbanPointTarget(lastX, lastY);
            const dropHost = pointTarget?.closest?.('[data-tm-kb-drop-kind], .tm-kanban-col') || null;
            if (!(dropHost instanceof Element)) return;
            try {
                const ret = window.tmKanbanDrop?.({
                    preventDefault() {},
                    stopPropagation() {},
                    currentTarget: dropHost,
                    target: dropHost,
                    dataTransfer: {
                        dropEffect: 'move',
                        getData(type) {
                            const t = String(type || '').trim();
                            if (t === 'text/plain' || t === 'application/x-tm-task-id') return taskId;
                            return '';
                        },
                    },
                });
                if (ret && typeof ret.catch === 'function') ret.catch(() => null);
            } catch (e2) {}
        };

        const cleanup = () => {
            if (ended) return;
            ended = true;
            cancelLongPress();
            cancelFloatingMiniStart();
            dragStartedAt = 0;
            __tmFlushKanbanScrollLeftRaf(bodyEl);
            __tmSetKanbanSnapPanActive(bodyEl, false);
            try { document.removeEventListener('pointermove', onMove, true); } catch (e2) {}
            try { document.removeEventListener('pointerup', onUp, true); } catch (e2) {}
            try { document.removeEventListener('pointercancel', onUp, true); } catch (e2) {}
            try { window.removeEventListener('touchmove', preventTouchGestureScroll, true); } catch (e2) {}
            try { window.removeEventListener('pointermove', preventTouchGestureScroll, true); } catch (e2) {}
            try { window.removeEventListener('blur', onUp, true); } catch (e2) {}
            if (captured && Number.isFinite(pointerId) && typeof cardEl.releasePointerCapture === 'function') {
                try { cardEl.releasePointerCapture(pointerId); } catch (e2) {}
            }
            if (ghostMeta?.ghost) {
                try { ghostMeta.ghost.remove(); } catch (e2) {}
            }
            try { cardEl.classList.remove('tm-kanban-card--dragging'); } catch (e2) {}
            try { __tmKanbanClearDragOver(); } catch (e2) {}
            try { __tmSetCalendarSideDockDragHidden(false); } catch (e2) {}
            try { __tmCalendarFloatingDragEnd(); } catch (e2) {}
            try { __tmUnbindKanbanDocumentAutoScroll(); } catch (e2) {}
            if (String(state.draggingTaskId || '').trim() === taskId) state.draggingTaskId = '';
            try { delete state.__tmKanbanDragId; } catch (e2) {}
            try { delete state.__tmKanbanDragIds; } catch (e2) {}
            if (mode === 'pan' || mode === 'drag') {
                state.__tmKanbanPanSuppressClickUntil = Date.now() + suppressClickMs;
            }
            if (mode === 'drag-ready') {
                state.__tmKanbanPanSuppressClickUntil = Date.now() + suppressClickMs;
            }
            if (cardDraggableTouched) {
                try {
                    if (prevCardDraggableAttr == null) cardEl.removeAttribute('draggable');
                    else cardEl.setAttribute('draggable', prevCardDraggableAttr);
                } catch (e2) {}
            }
            if (bodyGestureStylesTouched) {
                try { bodyEl.style.cursor = ''; } catch (e2) {}
                try { bodyEl.style.userSelect = ''; } catch (e2) {}
            }
            if (colBodyUserSelectTouched && colBodyEl instanceof HTMLElement) {
                try { colBodyEl.style.userSelect = ''; } catch (e2) {}
            }
            if (state.__tmKanbanCardGestureCleanup === cleanup) state.__tmKanbanCardGestureCleanup = null;
        };

        const onMove = (e2) => {
            if (ended || !samePointer(e2)) return;
            lastX = Number(e2?.clientX) || lastX;
            lastY = Number(e2?.clientY) || lastY;
            const dx = lastX - startX;
            const dy = lastY - startY;
            if (mode === 'drag') {
                try { __tmMarkHighPriorityInteraction('kanban-card-drag-move', 180); } catch (e3) {}
                updateDragFeedback(lastX, lastY);
                try { e2.preventDefault(); } catch (e3) {}
                return;
            }
            if (mode === 'pan') {
                try { __tmMarkHighPriorityInteraction('kanban-card-pan-move', 180); } catch (e3) {}
                const nextLeft = clamp0(baseScrollLeft - dx, 0, maxPanScrollLeft);
                __tmSetKanbanScrollLeftRaf(bodyEl, nextLeft);
                const nowTs = getGestureTs(e2);
                if (lastPanTs > 0) {
                    const dt = Math.max(1, Math.min(48, nowTs - lastPanTs));
                    panVelocity = (nextLeft - lastPanScrollLeft) / dt;
                }
                lastPanTs = nowTs;
                lastPanScrollLeft = nextLeft;
                try { e2.preventDefault(); } catch (e3) {}
                return;
            }
            if (mode === 'drag-ready') {
                if (!hasMovedBeyondLongPressTolerance()) return;
                startDrag({ fromReady: true });
                if (mode === 'drag') {
                    updateDragFeedback(lastX, lastY);
                    try { e2.preventDefault(); } catch (e3) {}
                }
                return;
            }
            const absX = Math.abs(dx);
            const absY = Math.abs(dy);
            if (longPressTimer && (dx * dx + dy * dy) >= (longPressMoveTolerance * longPressMoveTolerance)) {
                cancelLongPress();
            }
            const effectivePanThreshold = longPressTimer ? Math.max(panThreshold, longPressIntentThreshold) : panThreshold;
            const effectiveScrollThreshold = longPressTimer ? Math.max(scrollThreshold, longPressIntentThreshold) : scrollThreshold;
            const horizontalIntent = absX >= effectivePanThreshold && (absY <= 0.5 || absX >= (absY * axisLockRatio));
            const verticalIntent = absY >= effectiveScrollThreshold && (absX <= 0.5 || absY >= (absX * axisLockRatio));
            if (horizontalIntent && canPan()) {
                startPan();
                try { __tmMarkHighPriorityInteraction('kanban-card-pan-active', 360); } catch (e3) {}
                const nextLeft = clamp0(baseScrollLeft - dx, 0, maxPanScrollLeft);
                __tmSetKanbanScrollLeftRaf(bodyEl, nextLeft);
                lastPanTs = getGestureTs(e2);
                lastPanScrollLeft = nextLeft;
                try { e2.preventDefault(); } catch (e3) {}
                return;
            }
            if (verticalIntent) {
                cancelLongPress();
                cleanup();
                return;
            }
            if ((dx * dx + dy * dy) >= (longPressMoveTolerance * longPressMoveTolerance)) {
                cancelLongPress();
            }
        };

        const onUp = async (e2) => {
            if (!samePointer(e2)) return;
            const finalMode = mode;
            const finalPanVelocity = panVelocity;
            if (mode === 'drag') await finishDrag();
            cleanup();
            try { __tmMarkHighPriorityInteraction('kanban-card-touch-end', 160); } catch (e3) {}
            if (finalMode === 'pan') __tmStartKanbanMomentum(bodyEl, finalPanVelocity, { startLeft: baseScrollLeft });
        };

        longPressTimer = setTimeout(() => {
            if (isMouseLikePointer) armDragReady();
            else startDrag();
        }, longPressMs);
        state.__tmKanbanCardGestureCleanup = cleanup;
        try { document.addEventListener('pointermove', onMove, true); } catch (e2) {}
        try { document.addEventListener('pointerup', onUp, true); } catch (e2) {}
        try { document.addEventListener('pointercancel', onUp, true); } catch (e2) {}
        try { window.addEventListener('blur', onUp, true); } catch (e2) {}
    };

    function __tmGetKanbanBottomNavAvoidanceState(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return { active: false, pending: false };
        const enabled = modal.classList.contains('tm-modal--mobile')
            || modal.classList.contains('tm-modal--dock')
            || !!modal.closest?.('[data-tm-host-mode="dock"]');
        if (!enabled) return { active: false, pending: false };
        try {
            const bar = modal.querySelector('.tm-mobile-bottom-viewbar');
            if (!(bar instanceof HTMLElement)) return { active: false, pending: false };
            const style = window.getComputedStyle?.(bar);
            if (style && (style.display === 'none' || style.visibility === 'hidden')) return { active: false, pending: false };
            const rect = bar.getBoundingClientRect?.();
            if (!rect || !(rect.width > 0 && rect.height > 0)) return { active: false, pending: true };
            return { active: true, pending: false };
        } catch (e) {
            return { active: false, pending: false };
        }
    }

    function __tmMeasureKanbanBottomNavContentHeight(colBody) {
        if (!(colBody instanceof HTMLElement)) return 0;
        let basePadding = 0;
        let paddingTop = 0;
        try {
            const cs = window.getComputedStyle?.(colBody);
            const rawBase = Number.parseFloat(String(cs?.getPropertyValue?.('--tm-kanban-col-body-pad-bottom-base') || ''));
            const rawTop = Number.parseFloat(String(cs?.paddingTop || ''));
            basePadding = Number.isFinite(rawBase) ? Math.max(0, rawBase) : 0;
            paddingTop = Number.isFinite(rawTop) ? Math.max(0, rawTop) : 0;
        } catch (e) {}
        let contentBottom = 0;
        try {
            const bodyRect = colBody.getBoundingClientRect?.();
            const bodyTop = Number(bodyRect?.top);
            const scrollTop = Number(colBody.scrollTop || 0);
            Array.from(colBody.children || []).forEach((child) => {
                if (!(child instanceof HTMLElement)) return;
                const childRect = child.getBoundingClientRect?.();
                const rectBottom = Number(childRect?.bottom);
                const bottom = Number.isFinite(bodyTop) && Number.isFinite(rectBottom)
                    ? (rectBottom - bodyTop + scrollTop)
                    : (Number(child.offsetTop || 0) + Number(child.offsetHeight || 0));
                if (Number.isFinite(bottom) && bottom > contentBottom) contentBottom = bottom;
            });
        } catch (e) {}
        return Math.ceil((contentBottom > 0 ? contentBottom : paddingTop) + basePadding);
    }

    function __tmMeasureKanbanBottomNavAvailableHeight(colBody, col) {
        if (!(colBody instanceof HTMLElement)) return 0;
        let height = Math.ceil(Number(colBody.clientHeight) || 0);
        try {
            if (col instanceof HTMLElement) {
                const colRect = col.getBoundingClientRect?.();
                const colHeight = Math.ceil(Number(col.clientHeight) || Number(colRect?.height) || 0);
                const header = col.querySelector(':scope > .tm-kanban-col-header');
                const headerRect = header instanceof HTMLElement ? header.getBoundingClientRect?.() : null;
                const headerHeight = header instanceof HTMLElement
                    ? Math.ceil(Number(header.offsetHeight) || Number(headerRect?.height) || 0)
                    : 0;
                const available = Math.max(0, colHeight - headerHeight);
                if (available > height) height = available;
            }
        } catch (e) {}
        return Math.ceil(height);
    }

    function __tmSetKanbanBottomNavAvoidanceClass(colBody, enabled) {
        if (!(colBody instanceof HTMLElement)) return false;
        const active = !!enabled;
        const col = colBody.closest?.('.tm-kanban-col');
        try { colBody.classList.toggle('tm-kanban-col-body--bottom-nav-inset', active); } catch (e) {}
        if (col instanceof HTMLElement) {
            try { col.classList.toggle('tm-kanban-col--bottom-nav-inset', active); } catch (e) {}
        }
        return active;
    }

    function __tmSyncKanbanBottomNavAvoidance(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return false;
        const body = modal.querySelector('.tm-body.tm-body--kanban');
        if (!(body instanceof HTMLElement)) return false;
        const navState = __tmGetKanbanBottomNavAvoidanceState(modal);
        let hasAvoidanceColumn = false;
        let needsRecheck = navState.pending;
        try {
            body.querySelectorAll('.tm-kanban-col-body').forEach((colBody) => {
                if (!(colBody instanceof HTMLElement)) return;
                const col = colBody.closest?.('.tm-kanban-col');
                const prevScrollTop = Number(colBody.scrollTop || 0);
                const hadAvoidance = colBody.classList.contains('tm-kanban-col-body--bottom-nav-inset');
                const contentHeight = __tmMeasureKanbanBottomNavContentHeight(colBody);
                const availableHeight = __tmMeasureKanbanBottomNavAvailableHeight(colBody, col);
                const needsAvoidance = navState.active
                    && availableHeight > 0
                    && contentHeight > availableHeight + 1;
                const keepWhilePending = navState.pending && hadAvoidance;
                const applyAvoidance = needsAvoidance || keepWhilePending;
                __tmSetKanbanBottomNavAvoidanceClass(colBody, applyAvoidance);
                if (prevScrollTop > 0) {
                    try {
                        const maxTop = Math.max(0, Number(colBody.scrollHeight || 0) - Number(colBody.clientHeight || 0));
                        colBody.scrollTop = Math.min(prevScrollTop, maxTop);
                    } catch (e2) {}
                }
                if (applyAvoidance) hasAvoidanceColumn = true;
            });
            try { body.classList.toggle('tm-body--kanban-bottom-nav-inset', hasAvoidanceColumn); } catch (e) {}
            const board = body.querySelector('.tm-kanban');
            if (board instanceof HTMLElement) {
                try { board.classList.toggle('tm-kanban--bottom-nav-inset', hasAvoidanceColumn); } catch (e) {}
            }
            if (needsRecheck) {
                try {
                    if (body.__tmKanbanBottomNavAvoidanceRecheckTimer) clearTimeout(body.__tmKanbanBottomNavAvoidanceRecheckTimer);
                    body.__tmKanbanBottomNavAvoidanceRecheckTimer = setTimeout(() => {
                        body.__tmKanbanBottomNavAvoidanceRecheckTimer = 0;
                        try { __tmSyncKanbanBottomNavAvoidance(modal); } catch (e2) {}
                    }, 80);
                } catch (e) {}
            }
        } catch (e) {}
        return hasAvoidanceColumn;
    }

    function __tmScheduleKanbanBottomNavAvoidance(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return false;
        const body = modal.querySelector('.tm-body.tm-body--kanban');
        if (!(body instanceof HTMLElement)) return false;
        const syncMetrics = (force = false) => {
            try { __tmSyncKanbanSnapMetrics(body, force ? { force: true } : {}); } catch (e) {}
        };
        const sync = (forceMetrics = false) => {
            if (body.isConnected === false) return;
            syncMetrics(forceMetrics);
            try { __tmSyncKanbanBottomNavAvoidance(modal); } catch (e) {}
        };
        const scheduleRaf = (forceMetrics = false) => {
            if (Number(body.__tmKanbanBottomNavAvoidanceRaf) > 0) return true;
            try {
                body.__tmKanbanBottomNavAvoidanceRaf = requestAnimationFrame(() => {
                    body.__tmKanbanBottomNavAvoidanceRaf = 0;
                    sync(forceMetrics);
                });
            } catch (e) {
                body.__tmKanbanBottomNavAvoidanceRaf = 0;
                sync(forceMetrics);
            }
            return true;
        };
        const setupObserver = () => {
            if (typeof ResizeObserver !== 'function' || body.__tmKanbanBottomNavAvoidanceResizeObserver) return;
            try {
                const ro = new ResizeObserver(() => scheduleRaf(true));
                ro.observe(body);
                const bar = modal.querySelector('.tm-mobile-bottom-viewbar');
                if (bar instanceof Element) ro.observe(bar);
                body.querySelectorAll('.tm-kanban-col').forEach((col) => {
                    if (col instanceof Element) ro.observe(col);
                });
                body.__tmKanbanBottomNavAvoidanceResizeObserver = ro;
            } catch (e) {
                body.__tmKanbanBottomNavAvoidanceResizeObserver = null;
            }
        };
        sync(true);
        scheduleRaf(true);
        try { requestAnimationFrame(() => requestAnimationFrame(() => sync(true))); } catch (e) {}
        try { setTimeout(() => sync(true), 120); } catch (e) {}
        try { setTimeout(() => sync(true), 360); } catch (e) {}
        try { setTimeout(() => sync(true), 720); } catch (e) {}
        setupObserver();
        return true;
    }

    function __tmBindKanbanPan(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!modal) return;
        const bodyEl = modal.querySelector('.tm-body.tm-body--kanban');
        if (!bodyEl) return;
        try { __tmStartKanbanBootWindow(bodyEl); } catch (e) {}
        try { __tmSyncKanbanSnapMetrics(bodyEl); } catch (e) {}
        try { __tmBindKanbanSnapSettle(bodyEl); } catch (e) {}
        try { __tmScheduleKanbanBoardNavInitialSync(bodyEl); } catch (e) {}
        try { __tmBindKanbanBoardNavSwipe(bodyEl); } catch (e) {}
        try { __tmBindKanbanHostGestureIsolation(bodyEl); } catch (e) {}
        if (String(bodyEl.dataset?.tmKanbanPanBound || '') === '1') return;
        bodyEl.dataset.tmKanbanPanBound = '1';
        const clamp0 = (n, min, max) => Math.max(min, Math.min(max, n));
        const suppressClickMs = 260;

        const onPanClickCapture = (ev) => {
            if (Number(state.__tmKanbanPanSuppressClickUntil || 0) <= Date.now()) return;
            state.__tmKanbanPanSuppressClickUntil = 0;
            try { ev.preventDefault(); } catch (e) {}
            try { ev.stopPropagation(); } catch (e) {}
        };

        const onPanPointerDown = (e) => {
            const target = e?.target;
            if (!(target instanceof Element)) return;
            if (e && typeof e.button === 'number' && e.button !== 0) return;
            if (target.closest('.tm-kanban-card')) return;
            if (target.closest('input,button,select,textarea,a,[contenteditable="true"]')) return;
            try { __tmSyncKanbanSnapMetrics(bodyEl); } catch (e2) {}
            const snapPanMode = __tmIsKanbanColumnSnapMode(bodyEl);
            const maxPanScrollLeft = __tmGetKanbanMaxPanScrollLeft(bodyEl);
            if (maxPanScrollLeft <= 2) return;
            try { __tmMarkHighPriorityInteraction('kanban-pan-start', 520); } catch (e2) {}
            __tmClearKanbanCardGesture();
            __tmStopKanbanMomentum();

            const startX = e.clientX;
            const startY = e.clientY;
            const baseScrollLeft = bodyEl.scrollLeft;
            let active = false;
            let ended = false;
            let captured = false;
            let bodyPanStylesTouched = false;
            let panVelocity = 0;
            let lastPanScrollLeft = baseScrollLeft;
            let lastPanTs = 0;
            const threshold = 4;
            const getGestureTs = (ev) => {
                const ts = Number(ev?.timeStamp);
                return Number.isFinite(ts) && ts > 0 ? ts : Date.now();
            };

            const cleanup = () => {
                if (ended) return;
                ended = true;
                try { window.removeEventListener('pointermove', onWinMove, true); } catch (e2) {}
                try { window.removeEventListener('pointerup', onWinUp, true); } catch (e2) {}
                try { window.removeEventListener('pointercancel', onWinUp, true); } catch (e2) {}
                try { window.removeEventListener('blur', onWinUp, true); } catch (e2) {}
                __tmFlushKanbanScrollLeftRaf(bodyEl);
                __tmSetKanbanSnapPanActive(bodyEl, false);
                if (captured && Number.isFinite(Number(e?.pointerId)) && typeof bodyEl.releasePointerCapture === 'function') {
                    try { bodyEl.releasePointerCapture(e.pointerId); } catch (e2) {}
                }
                if (active) state.__tmKanbanPanSuppressClickUntil = Date.now() + suppressClickMs;
                if (bodyPanStylesTouched) {
                    try { bodyEl.style.cursor = ''; } catch (e2) {}
                    try { bodyEl.style.userSelect = ''; } catch (e2) {}
                }
            };

            const onWinMove = (ev) => {
                if (ended) return;
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;
                if (!active) {
                    if (Math.abs(dx) < threshold) return;
                    if (Math.abs(dx) <= Math.abs(dy)) return;
                    active = true;
                    try { __tmMarkHighPriorityInteraction('kanban-pan-active', 420); } catch (e2) {}
                    if (!snapPanMode && Number.isFinite(Number(e?.pointerId)) && typeof bodyEl.setPointerCapture === 'function') {
                        try {
                            bodyEl.setPointerCapture(e.pointerId);
                            captured = true;
                        } catch (e2) {}
                    }
                    if (!snapPanMode) {
                        try { bodyEl.style.cursor = 'grabbing'; } catch (e2) {}
                        try { bodyEl.style.userSelect = 'none'; } catch (e2) {}
                        bodyPanStylesTouched = true;
                    }
                    __tmSetKanbanSnapPanActive(bodyEl, true);
                }
                try { __tmMarkHighPriorityInteraction('kanban-pan-move', 180); } catch (e2) {}
                const nextLeft = clamp0(baseScrollLeft - dx, 0, maxPanScrollLeft);
                __tmSetKanbanScrollLeftRaf(bodyEl, nextLeft);
                const nowTs = getGestureTs(ev);
                if (lastPanTs > 0) {
                    const dt = Math.max(1, Math.min(48, nowTs - lastPanTs));
                    panVelocity = (nextLeft - lastPanScrollLeft) / dt;
                }
                lastPanTs = nowTs;
                lastPanScrollLeft = nextLeft;
                try { ev.preventDefault(); } catch (e2) {}
            };

            const onWinUp = () => {
                const shouldMomentum = active;
                const finalPanVelocity = panVelocity;
                cleanup();
                if (shouldMomentum) __tmStartKanbanMomentum(bodyEl, finalPanVelocity, { startLeft: baseScrollLeft });
            };

            window.addEventListener('pointermove', onWinMove, true);
            window.addEventListener('pointerup', onWinUp, true);
            window.addEventListener('pointercancel', onWinUp, true);
            window.addEventListener('blur', onWinUp, true);
        };

        bodyEl.addEventListener('pointerdown', onPanPointerDown, { passive: false });
        bodyEl.addEventListener('click', onPanClickCapture, true);
    }

    async function __tmKanbanMoveIdsToStatus(taskIds, targetStatus, options) {
        const opt = (options && typeof options === 'object') ? options : {};
        const st = String(targetStatus || '').trim();
        const ids0 = Array.isArray(taskIds) ? taskIds : [];
        const ids = Array.from(new Set(ids0.map(x => String(x || '').trim()).filter(Boolean)));
        if (!ids.length || !st) return;
        if (GlobalLock.isLocked()) {
            hint('⚠ 操作频繁，请稍后再试', 'warning');
            return;
        }

        const isDoneCol = st === '__done__';
        try {
            const patchTask = globalThis.__tmRequireTaskOutbox?.('patchTask');
            if (typeof patchTask !== 'function') throw new Error('任务写入队列未就绪: patchTask');
            let failureCount = 0;
            if (isDoneCol) {
                await Promise.all(ids.map((id) => {
                    const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(String(id || '').trim()) || state.flatTasks?.[String(id || '').trim()] || null;
                    if (task && !!task.done) return Promise.resolve(false);
                    return patchTask(id, { done: true }, {
                        source: 'kanban-drop-status',
                        label: '完成状态',
                        reason: 'kanban-drop-status',
                        background: true,
                        wait: false,
                        skipInteractionGate: true,
                        withFilters: true,
                        skipViewRefresh: true,
                        skipSettledRefresh: true,
                        showErrorHint: false,
                    }).catch((error) => {
                        failureCount += 1;
                        throw error;
                    });
                }));
                if (failureCount > 0) hint(`⚠ 批量更新完成状态存在失败项（${failureCount}）`, 'warning');
            } else {
                await Promise.all(ids.map((id) => patchTask(id, { customStatus: st }, {
                    source: 'kanban-drop-status',
                    label: '状态',
                    reason: 'kanban-drop-status',
                    background: true,
                    wait: false,
                    skipInteractionGate: true,
                    withFilters: true,
                    skipViewRefresh: true,
                    skipSettledRefresh: true,
                    showErrorHint: false,
                }).catch((error) => {
                    failureCount += 1;
                    throw error;
                })));
                if (failureCount > 0) hint(`⚠ 批量设置状态存在失败项（${failureCount}）`, 'warning');
            }
        } catch (e) {
            hint(`❌ 状态更新失败: ${e.message}`, 'error');
            return;
        }
    }

    window.tmKanbanDrop = async function(ev) {
        try { ev.preventDefault(); } catch (e) {}
        try { ev.stopPropagation(); } catch (e) {}

        const dropHost = __tmResolveKanbanDropHost(ev);
        // 首先检查是否拖放到组标题（文档标题或标题分组）
        const dropTarget = dropHost?.closest?.('[data-tm-kb-drop-kind]') || null;
        let kind = '';
        let targetDocId = '';
        let targetHeadingId = '';
        let targetTimeKey = '';
        let st = '';

        if (dropTarget) {
            // 从组标题元素读取拖放数据
            kind = String(dropTarget.dataset?.tmKbDropKind || '').trim();
            targetDocId = String(dropTarget.dataset?.tmKbDropDoc || '').trim();
            targetHeadingId = String(dropTarget.dataset?.tmKbDropHeading || '').trim();
        }

        // 如果没有从组标题获取到数据，则从列元素读取
        if (!kind) {
            const col = dropHost?.closest?.('.tm-kanban-col') || null;
            kind = String(col?.dataset?.kind || 'status').trim() || 'status';
            targetDocId = String(col?.dataset?.doc || '').trim();
            targetHeadingId = String(col?.dataset?.heading || '').trim();
            targetTimeKey = String(col?.dataset?.time || '').trim();
            st = String(col?.dataset?.status || '').trim();
        }

        __tmKanbanClearDragOver();
        let id = '';
        try { id = String(ev.dataTransfer.getData('text/plain') || '').trim(); } catch (e) {}
        if (!id) id = String(state.__tmKanbanDragId || '').trim();
        if (!id) return;
        const baseIds = Array.isArray(state.__tmKanbanDragIds) && state.__tmKanbanDragIds.length ? state.__tmKanbanDragIds : [id];
        const kanbanBoardMode = __tmGetKanbanBoardMode();
        const doneBoardEnabled = (kanbanBoardMode === 'heading' || kanbanBoardMode === 'time')
            && !!state.showCompletedTasks
            && !!SettingsStore.data.kanbanShowDoneColumn;
        const restoreIdsFromDoneBoard = async (seedIds) => {
            if (!doneBoardEnabled) return true;
            let ids = Array.isArray(seedIds) ? seedIds.slice() : [];
            if (SettingsStore.data.kanbanDragSyncSubtasks) {
                const allIds = new Set(ids);
                ids.forEach(rootId => {
                    const descendants = __tmKanbanCollectDescendantIds(rootId);
                    descendants.forEach(did => allIds.add(did));
                });
                ids = Array.from(allIds);
            }
            for (const tid of ids) {
                const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(String(tid || '').trim()) || state.flatTasks?.[String(tid || '').trim()];
                if (!task?.done) continue;
                const ok0 = await __tmKanbanWaitForUnlock();
                if (!ok0) return false;
                await tmSetDone(tid, false);
                const ok1 = await __tmKanbanWaitForUnlock();
                if (!ok1) return false;
            }
            return true;
        };
        const isSameDocTask = (task, docId) => {
            if (!task || !docId) return false;
            return String(task?.root_id || task?.docId || '').trim() === String(docId || '').trim();
        };
        const isNoHeadingTarget = (headingId) => {
            const hid = String(headingId || '').trim();
            return !hid || hid === '__none__';
        };
        const isKanbanDropNoopForTask = (task, dropKind, docId, headingId) => {
            if (!task || !dropKind) return false;
            if (dropKind === 'doc') {
                return isSameDocTask(task, docId);
            }
            if (dropKind === 'doc-top') {
                return isSameDocTask(task, docId) && !__tmTaskHasResolvedHeading(task);
            }
            if (dropKind === 'heading') {
                if (!isSameDocTask(task, docId)) return false;
                if (isNoHeadingTarget(headingId)) return !__tmTaskHasResolvedHeading(task);
                return String(task?.h2Id || '').trim() === String(headingId || '').trim();
            }
            return false;
        };
        if (kind === 'time') {
            const target = __tmBuildKanbanTimeDropTarget(targetTimeKey);
            if (!target) {
                hint(targetTimeKey === 'overdue' ? '已过期看板不能作为拖放目标' : '该时间看板不能作为拖放目标', 'info');
                return;
            }
            let changed = 0;
            let editableBlocked = false;
            const ids = baseIds.map((tid) => String(tid || '').trim()).filter(Boolean);
            const refreshIds = (() => {
                const allIds = new Set(ids);
                if (SettingsStore.data.kanbanPreventSubtaskSeparation === true || SettingsStore.data.kanbanDragSyncSubtasks === true) {
                    ids.forEach(rootId => {
                        const descendants = __tmKanbanCollectDescendantIds(rootId);
                        descendants.forEach(did => allIds.add(did));
                    });
                }
                return Array.from(allIds);
            })();
            const restoredFromDoneBoard = doneBoardEnabled && ids.some((tid) => {
                const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid];
                return !!task?.done;
            });
            const ok = await restoreIdsFromDoneBoard(ids);
            if (!ok) return;
            for (const tid of ids) {
                const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid];
                if (!task) continue;
                if (!__tmEnsureEditableTaskLike(task, '修改截止日期')) {
                    editableBlocked = true;
                    continue;
                }
                const currentDate = __tmNormalizeDateOnly(task?.completionTime || task?.completion_time || '');
                if (currentDate === target.dateKey) continue;
                const patchTask = globalThis.__tmRequireTaskOutbox?.('patchTask');
                if (typeof patchTask !== 'function') throw new Error('任务写入队列未就绪: patchTask');
                const ok = patchTask(tid, { completionTime: target.dateKey }, {
                    source: 'kanban-time-board-drop-completion-time',
                    label: '截止日期',
                    reason: 'kanban-time-board-drop-completion-time',
                    background: true,
                    wait: false,
                    withFilters: true,
                    skipViewRefresh: true,
                    skipSettledRefresh: true,
                    skipInteractionGate: true,
                    defer: false,
                    optimisticProjectionRefresh: true,
                    showErrorHint: false,
                });
                Promise.resolve(ok).catch((e) => {
                    try { hint(`❌ 更新失败: ${e.message}`, 'error'); } catch (err) {}
                });
                if (ok !== false) {
                    changed += 1;
                }
            }
            if (!changed) {
                if (restoredFromDoneBoard) {
                    const useLightweightProjection = !String(state.searchKeyword || '').trim()
                        && typeof __tmIsSimpleProjectionContext === 'function'
                        && __tmIsSimpleProjectionContext();
                    try { __tmKanbanColsHtmlCache = null; } catch (e2) {}
                    try {
                        __tmScheduleViewRefresh({
                            mode: 'current',
                            withFilters: !useLightweightProjection,
                            reason: 'kanban-time-drop-restore-done-optimistic',
                            taskIds: refreshIds,
                        });
                    } catch (e2) {
                        try { __tmScheduleRender({ withFilters: !useLightweightProjection }); } catch (e3) {}
                    }
                    hint(target.dateKey ? `✅ 已移回${target.label}看板` : '✅ 已移回待定看板', 'success');
                    return;
                }
                if (!editableBlocked) hint(target.dateKey ? `截止日期已是 ${target.dateKey}` : '截止日期已是待定', 'info');
                return;
            }
            const useLightweightProjection = !String(state.searchKeyword || '').trim()
                && typeof __tmIsSimpleProjectionContext === 'function'
                && __tmIsSimpleProjectionContext();
            try { __tmKanbanColsHtmlCache = null; } catch (e2) {}
            try {
                __tmScheduleViewRefresh({
                    mode: 'current',
                    withFilters: !useLightweightProjection,
                    reason: 'kanban-time-drop-optimistic',
                    taskIds: refreshIds,
                });
            } catch (e2) {
                try { __tmScheduleRender({ withFilters: !useLightweightProjection }); } catch (e3) {}
            }
            hint(target.dateKey ? `✅ 已移动到${target.label}看板` : '✅ 已移入待定看板', 'success');
            return;
        }
        if (kind === 'status') {
            if (!st) return;
            let ids = baseIds.slice();
            if (SettingsStore.data.kanbanDragSyncSubtasks) {
                const allIds = new Set(ids);
                ids.forEach(rootId => {
                    const descendants = __tmKanbanCollectAttachedStatusDescendantIds(rootId);
                    descendants.forEach(did => allIds.add(did));
                });
                ids = Array.from(allIds);
            }
            try {
                await __tmKanbanMoveIdsToStatus(ids, st);
                const useLightweightProjection = !String(state.searchKeyword || '').trim()
                    && typeof __tmIsSimpleProjectionContext === 'function'
                    && __tmIsSimpleProjectionContext();
                try { __tmKanbanColsHtmlCache = null; } catch (e2) {}
                try {
                    __tmScheduleViewRefresh({
                        mode: 'current',
                        withFilters: !useLightweightProjection,
                        reason: 'kanban-status-drop-optimistic',
                        taskIds: ids,
                    });
                } catch (e2) {
                    try { __tmScheduleRender({ withFilters: !useLightweightProjection }); } catch (e3) {}
                }
            } catch (e) {
                hint(`❌ 操作失败: ${e.message}`, 'error');
            }
            return;
        }
        if (kind === 'doc') {
            if (!targetDocId || targetDocId === '__unknown__') return;
            const ids = baseIds.filter((tid) => !isKanbanDropNoopForTask(globalThis.__tmRuntimeState?.getFlatTaskById?.(String(tid || '').trim()) || state.flatTasks?.[String(tid || '').trim()], kind, targetDocId, targetHeadingId));
            if (!ids.length) return;
            try {
                const ok = await restoreIdsFromDoneBoard(ids);
                if (!ok) return;
                const moveItems = ids.slice().reverse().map((tid) => ({
                    tid,
                    payload: {
                        targetDocId,
                        mode: 'docTop',
                        deferOptimisticRender: true,
                        skipOptimisticFilterWork: true,
                    },
                }));
                const useLightweightProjection = moveItems.every((item) => (
                    typeof __tmCanUseLightweightMoveProjection === 'function'
                    && __tmCanUseLightweightMoveProjection(item.tid, item.payload)
                ));
                for (const item of moveItems) {
                    const moveTask = globalThis.__tmRequireTaskOutbox?.('moveTask');
                    if (typeof moveTask !== 'function') throw new Error('任务写入队列未就绪: moveTask');
                    moveTask(item.tid, item.payload, {
                        wait: false,
                        onError: (err) => {
                            hint(`❌ 操作失败: ${err?.message || err || '未知错误'}`, 'error');
                        },
                    });
                }
                try { __tmScheduleViewRefresh({ mode: 'current', withFilters: !useLightweightProjection, reason: 'kanban-doc-drop-optimistic', taskIds: ids }); } catch (e) {
                    try { __tmScheduleRender({ withFilters: !useLightweightProjection }); } catch (e2) {}
                }
            } catch (e) {
                hint(`❌ 操作失败: ${e.message}`, 'error');
            }
            return;
        }
        // 处理 doc-top 情况：移动到文档顶部（无二级标题）
        if (kind === 'doc-top') {
            if (!targetDocId || targetDocId === '__unknown__') return;
            const ids = baseIds.filter((tid) => !isKanbanDropNoopForTask(globalThis.__tmRuntimeState?.getFlatTaskById?.(String(tid || '').trim()) || state.flatTasks?.[String(tid || '').trim()], kind, targetDocId, targetHeadingId));
            if (!ids.length) return;
            try {
                const ok = await restoreIdsFromDoneBoard(ids);
                if (!ok) return;
                const moveItems = ids.slice().reverse().map((tid) => ({
                    tid,
                    payload: {
                        targetDocId,
                        mode: 'docTop',
                        deferOptimisticRender: true,
                        skipOptimisticFilterWork: true,
                    },
                }));
                const useLightweightProjection = moveItems.every((item) => (
                    typeof __tmCanUseLightweightMoveProjection === 'function'
                    && __tmCanUseLightweightMoveProjection(item.tid, item.payload)
                ));
                for (const item of moveItems) {
                    const moveTask = globalThis.__tmRequireTaskOutbox?.('moveTask');
                    if (typeof moveTask !== 'function') throw new Error('任务写入队列未就绪: moveTask');
                    moveTask(item.tid, item.payload, {
                        wait: false,
                        onError: (err) => {
                            hint(`❌ 操作失败: ${err?.message || err || '未知错误'}`, 'error');
                        },
                    });
                }
                try { __tmScheduleViewRefresh({ mode: 'current', withFilters: !useLightweightProjection, reason: 'kanban-doc-top-drop-optimistic', taskIds: ids }); } catch (e) {
                    try { __tmScheduleRender({ withFilters: !useLightweightProjection }); } catch (e2) {}
                }
            } catch (e) {
                hint(`❌ 操作失败: ${e.message}`, 'error');
            }
            return;
        }
        if (kind === 'heading') {
            if (!targetDocId) return;
            const ids = baseIds.filter((tid) => !isKanbanDropNoopForTask(globalThis.__tmRuntimeState?.getFlatTaskById?.(String(tid || '').trim()) || state.flatTasks?.[String(tid || '').trim()], kind, targetDocId, targetHeadingId));
            if (!ids.length) return;

            // 只移动最顶层的任务（父任务），子任务会自动跟随父任务移动
            // 不需要单独移动子任务，否则会破坏父子关系

            try {
                const ok = await restoreIdsFromDoneBoard(ids);
                if (!ok) return;
                const moveItems = ids.slice().reverse().map((tid) => {
                    if (targetHeadingId && targetHeadingId !== '__none__') {
                        return {
                            tid,
                            payload: {
                            targetDocId,
                            headingId: targetHeadingId,
                            mode: 'heading',
                            deferOptimisticRender: true,
                            skipOptimisticFilterWork: true,
                            },
                        };
                    }
                    return {
                        tid,
                        payload: {
                            targetDocId,
                            mode: 'docTop',
                            deferOptimisticRender: true,
                            skipOptimisticFilterWork: true,
                        },
                    };
                });
                const useLightweightProjection = moveItems.every((item) => (
                    typeof __tmCanUseLightweightMoveProjection === 'function'
                    && __tmCanUseLightweightMoveProjection(item.tid, item.payload)
                ));
                for (const item of moveItems) {
                    const moveTask = globalThis.__tmRequireTaskOutbox?.('moveTask');
                    if (typeof moveTask !== 'function') throw new Error('任务写入队列未就绪: moveTask');
                    moveTask(item.tid, item.payload, {
                            wait: false,
                            onError: (err) => {
                                hint(`❌ 操作失败: ${err?.message || err || '未知错误'}`, 'error');
                            },
                    });
                }
                try { __tmScheduleViewRefresh({ mode: 'current', withFilters: !useLightweightProjection, reason: 'kanban-heading-drop-optimistic', taskIds: ids }); } catch (e) {
                    try { __tmScheduleRender({ withFilters: !useLightweightProjection }); } catch (e2) {}
                }
            } catch (e) {
                hint(`❌ 操作失败: ${e.message}`, 'error');
            }
            return;
        }
    };

    window.tmKanbanPickDate = async function(id, ev) {
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}
        const tid = String(id || '').trim();
        if (!tid) return;
        try { __tmMarkHighPriorityInteraction('kanban-pick-date-open', 680); } catch (e) {}
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid];
        if (!task) return;
        const anchorEl = (ev?.currentTarget instanceof Element)
            ? ev.currentTarget
            : (ev?.target instanceof Element ? ev.target.closest('.tm-kanban-chip') : null);
        const current = String(task.completionTime || '').trim() || String(task.startDate || '').trim();
        const commitKanbanDatePatch = (nextValue, reason = 'kanban-card-date-fallback') => {
            const next = String(nextValue || '').trim();
            const patch = { completionTime: next };
            try {
                task.completionTime = next;
                const patchTask = globalThis.__tmRequireTaskOutbox?.('patchTask');
                if (typeof patchTask !== 'function') throw new Error('任务写入队列未就绪: patchTask');
                void patchTask(tid, patch, {
                    source: reason,
                    reason,
                    label: '看板日期',
                    wait: false,
                    background: true,
                    skipSettledRefresh: true,
                    forceProjectionRefresh: true,
                }).catch((error) => {
                    try { globalThis.__tmReportTaskOutboxFailure?.(error, { action: '更新看板日期' }); } catch (e2) {}
                });
                try {
                    __tmRefreshTaskTimeAcrossViews(tid, { patch, withFilters: true, reason });
                } catch (e2) {
                    try { __tmScheduleViewRefresh({ mode: 'current', withFilters: true, reason, taskIds: [tid] }); } catch (e3) {}
                }
                hint(next ? '✅ 日期已更新' : '✅ 日期已清空', 'success');
                return true;
            } catch (e) {
                hint(`❌ 更新失败: ${e.message}`, 'error');
                return false;
            }
        };

        if (anchorEl instanceof HTMLElement && typeof window.tmOpenTaskTimeHub === 'function') {
            await window.tmOpenTaskTimeHub(tid, anchorEl, {
                activeField: 'completionTime',
                source: 'kanban-card',
                background: true,
                closeOnDateCommit: false,
            });
            return;
        }

        if (!(anchorEl instanceof Element)) {
            const next = await showDatePrompt('设置日期', current);
            if (next == null) return;
            commitKanbanDatePatch(next, 'kanban-card-date-prompt');
            return;
        }

        __tmOpenInlineEditor(anchorEl, ({ editor, close }) => {
            editor.style.minWidth = '168px';
            editor.style.padding = '8px';

            const input = document.createElement('input');
            input.type = 'date';
            input.className = 'tm-input';
            input.value = __tmNormalizeDateOnly(current || '');
            editor.appendChild(input);

            const clearBtn = document.createElement('button');
            clearBtn.className = 'tm-btn tm-btn-secondary';
            clearBtn.textContent = '清空';
            clearBtn.onclick = async () => {
                if (commitKanbanDatePatch('', 'kanban-card-date-clear')) close();
            };

            const actions = document.createElement('div');
            actions.className = 'tm-inline-editor-actions';
            actions.appendChild(clearBtn);
            editor.appendChild(actions);

            const save = async () => {
                const raw = String(input.value || '').trim();
                const next = raw ? __tmNormalizeDateOnly(raw) : '';
                if (commitKanbanDatePatch(next, 'kanban-card-date-inline')) close();
            };

            input.onchange = () => { save(); };
            input.onkeydown = (e) => {
                if (e.key === 'Enter') save();
            };
            input.onclick = () => { try { input.showPicker?.(); } catch (e) {} };
            setTimeout(() => {
                try {
                    input.focus();
                    input.showPicker?.();
                } catch (e) {}
            }, 0);
        });
    };

    window.tmGanttZoomIn = function() {
        const next = Math.min(60, Math.max(10, Math.round((Number(state.ganttView?.dayWidth) || 24) + 4)));
        state.ganttView.dayWidth = next;
        render();
    };

    window.tmGanttZoomOut = function() {
        const next = Math.min(60, Math.max(10, Math.round((Number(state.ganttView?.dayWidth) || 24) - 4)));
        state.ganttView.dayWidth = next;
        render();
    };

    window.tmGanttFit = function() {
        if (state.viewMode !== 'timeline') return;
        try {
            const globalScrollHost = __tmGetTimelineGlobalScrollHost(state.modal);
            const useGlobalScroll = !!globalScrollHost;
            const body = state.modal?.querySelector?.('#tmGanttBody');
            const leftPaneWidth = useGlobalScroll ? __tmGetTimelineLeftPaneWidth(state.modal) : 0;
            const currentRangeStartTs = Number(body?.dataset?.tmGanttStartTs);
            const w0 = useGlobalScroll
                ? Math.max(0, (Number(globalScrollHost?.clientWidth) || 0) - Math.round(leftPaneWidth))
                : Number(body?.clientWidth || 0);
            const w = w0;
            if (!Number.isFinite(w) || w <= 0) {
                state.ganttView.__forceScrollLeft = 0;
                render();
                return;
            }
            const view = globalThis.__TaskHorizonGanttView;
            const startOfDayTs = view?.startOfDayTs;
            const computeRangeTs = view?.computeRangeTs;
            const DAY_MS = Number(view?.DAY_MS) || 86400000;
            const maxDayCount = Math.max(1, Number(view?.TIMELINE_MAX_DAY_COUNT) || 397);
            if (typeof startOfDayTs !== 'function' || typeof computeRangeTs !== 'function') {
                state.ganttView.__forceScrollLeft = 0;
                render();
                return;
            }
            const rowModel = __tmBuildTaskRowModel();
            const tasks = [];
            for (const r of rowModel) {
                if (r?.type !== 'task') continue;
                const t = globalThis.__tmRuntimeState?.getFlatTaskById?.(String(r.id)) || state.flatTasks?.[String(r.id)];
                if (!t) continue;
                tasks.push(t);
            }
            const paddingDays = Math.max(0, Number(state.ganttView?.paddingDays) || 0);
            const rangeOptions = { anchorByStartDate: true, extraFutureMonths: 0 };
            const range = computeRangeTs(tasks, paddingDays, rangeOptions);
            const startTs = startOfDayTs(range?.startTs);
            const endTs = startOfDayTs(range?.endTs);
            if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs < startTs) {
                state.ganttView.__forceScrollLeft = 0;
                render();
                return;
            }
            const dayCount = Math.max(1, Math.min(maxDayCount, Math.round((endTs - startTs) / DAY_MS) + 1));
            const usableW = Math.max(120, w - 24);
            const next = Math.max(10, Math.min(60, Math.floor(usableW / dayCount)));
            const scrollOffsetPx = Number.isFinite(currentRangeStartTs)
                ? Math.max(0, Math.round(((startTs - currentRangeStartTs) / DAY_MS) * next))
                : 0;
            state.ganttView.dayWidth = next;
            try { delete state.ganttView.__rangeOptions; } catch (e) {}
            state.ganttView.__forceScrollLeft = useGlobalScroll
                ? Math.max(0, Math.round(leftPaneWidth + scrollOffsetPx))
                : scrollOffsetPx;
            render();
        } catch (e) {
            try { state.ganttView.__forceScrollLeft = 0; } catch (e2) {}
            render();
        }
    };

    window.tmGanttToday = function() {
        const globalScrollHost = __tmGetTimelineGlobalScrollHost(state.modal);
        const useGlobalScroll = !!globalScrollHost;
        const body = state.modal?.querySelector?.('#tmGanttBody');
        if (!body) return;
        const todayLine = body.querySelector('.tm-gantt-today');
        if (!todayLine) return;
        const left = Number.parseFloat(String(todayLine.style.left || '').replace('px', ''));
        if (!Number.isFinite(left)) return;
        const leftPaneWidth = useGlobalScroll ? __tmGetTimelineLeftPaneWidth(state.modal) : 0;
        const viewportWidth = useGlobalScroll ? Number(globalScrollHost?.clientWidth || 0) : Number(body.clientWidth || 0);
        const baseLeft = useGlobalScroll ? (leftPaneWidth + left) : left;
        const target = Math.max(0, Math.round(baseLeft - viewportWidth * 0.35));
        if (useGlobalScroll) {
            globalScrollHost.scrollLeft = target;
        } else {
            body.scrollLeft = target;
            try { body.dispatchEvent(new Event('scroll')); } catch (e) {}
        }
    };


    function __tmNormalizeTaskPriorityValue(raw) {
        const s = String(raw ?? '').trim();
        if (!s) return '';
        if (Object.prototype.hasOwnProperty.call(__TM_TASK_PRIORITY_NORMALIZE_MAP, s)) {
            return __TM_TASK_PRIORITY_NORMALIZE_MAP[s];
        }
        const lower = s.toLowerCase();
        if (Object.prototype.hasOwnProperty.call(__TM_TASK_PRIORITY_NORMALIZE_MAP, lower)) {
            return __TM_TASK_PRIORITY_NORMALIZE_MAP[lower];
        }
        return '';
    }

    function __tmParseTaskLooseBoolean(value) {
        if (typeof value === 'boolean') return value;
        const normalized = String(value || '').trim().toLowerCase();
        return normalized === 'true' || normalized === '1';
    }

    function __tmNormalizeTaskContentFieldValue(input) {
        let text = String(input || '').replace(/\r\n?/g, '\n').trim();
        if (!text) return '';
        const api = (typeof API !== 'undefined' && API) ? API : null;
        const hasTaskMarker = (value) => /^\s*(?:[-*+]|\d+[.)])\s*\[[^\]]?\]/.test(String(value || ''));
        if (hasTaskMarker(text)) {
            try {
                if (api && typeof api.parseTaskStatus === 'function') {
                    const parsed = api.parseTaskStatus(text);
                    const parsedContent = String(parsed?.content || '').trim();
                    if (parsedContent) text = parsedContent;
                }
            } catch (e) {}
            try {
                if (api && typeof api.extractTaskContentLine === 'function' && hasTaskMarker(text)) {
                    const extracted = String(api.extractTaskContentLine(text) || '').trim();
                    if (extracted) text = extracted;
                }
            } catch (e) {}
            if (hasTaskMarker(text)) {
                text = String(text || '').split('\n')[0].replace(/^\s*(?:(?:[-*+]|\d+[.)])\s*\[[^\]]?\]\s*)+/, '').trim();
            }
        }
        return String(text || '').trim();
    }

    function __tmNormalizeTaskContentField(task) {
        if (!task || typeof task !== 'object' || task.isOtherBlock === true) return;
        const candidates = [task.content, task.raw_content, task.rawContent, task.markdown];
        for (const candidate of candidates) {
            const text = __tmNormalizeTaskContentFieldValue(candidate);
            if (!text) continue;
            task.content = text;
            return;
        }
    }

    function normalizeTaskFields(task, docNameFallback, options = {}) {
        if (!task || typeof task !== 'object') return task;
        const opts = (options && typeof options === 'object') ? options : {};
        const docDisplayNameCache = opts.docDisplayNameCache instanceof Map ? opts.docDisplayNameCache : null;
        const docDisplayNameMode = String(opts.docDisplayNameMode || __tmGetDocDisplayNameMode() || '').trim() || 'name';
        const customFieldDefs = Array.isArray(opts.customFieldDefs) ? opts.customFieldDefs : null;
        const customFieldDefMap = opts.customFieldDefMap instanceof Map ? opts.customFieldDefMap : null;
        const visibleDateFallbackTaskIds = opts.visibleDateFallbackTaskIds instanceof Set ? opts.visibleDateFallbackTaskIds : null;
        const customStatusFallbackTaskIds = opts.customStatusFallbackTaskIds instanceof Set ? opts.customStatusFallbackTaskIds : null;
        const todayDateKey = String(opts.todayDateKey || '').trim();

        const isValidValue = (val) => val !== undefined && val !== null && val !== '' && val !== 'null';
        const taskId = String(task.id || '').trim();
        const resolvedDocId = String(task.docId || task.root_id || '').trim();
        const allowVisibleDateFallback = visibleDateFallbackTaskIds
            ? visibleDateFallbackTaskIds.has(taskId)
            : __tmHasPendingVisibleDatePersistence(taskId);
        const allowCustomStatusFallback = customStatusFallbackTaskIds
            ? customStatusFallbackTaskIds.has(taskId)
            : __tmHasPendingTaskFieldPersistence(taskId, ['customStatus']);
        const dbHasRepeatRule = isValidValue(task.repeat_rule)
            || isValidValue(task?.[__TM_TASK_REPEAT_RULE_ATTR])
            || (typeof task.repeatRule === 'string' && isValidValue(task.repeatRule));
        const dbHasRepeatState = isValidValue(task.repeat_state)
            || isValidValue(task?.[__TM_TASK_REPEAT_STATE_ATTR])
            || (typeof task.repeatState === 'string' && isValidValue(task.repeatState));
        const dbHasRepeatHistory = isValidValue(task.repeat_history)
            || isValidValue(task?.[__TM_TASK_REPEAT_HISTORY_ATTR])
            || (typeof task.repeatHistory === 'string' && isValidValue(task.repeatHistory));
        const p0 = task.custom_priority ?? task.customPriority ?? task.priority ?? '';
        task.priority = __tmNormalizeTaskPriorityValue(p0);
        const milestone0 = task.custom_milestone ?? task.customMilestone ?? task.milestone ?? '';
        task.milestone = __tmParseTaskLooseBoolean(milestone0);
        task.duration = isValidValue(task.duration) ? String(task.duration) : (isValidValue(task.custom_duration) ? String(task.custom_duration) : '');
        task.remark = isValidValue(task.remark) ? String(task.remark) : (isValidValue(task.custom_remark) ? String(task.custom_remark) : '');
        task.completionTime = isValidValue(task.completionTime) ? String(task.completionTime) : (isValidValue(task.completion_time) ? String(task.completion_time) : '');
        task.taskCompleteAt = isValidValue(task.taskCompleteAt) ? String(task.taskCompleteAt) : (isValidValue(task.task_complete_at) ? String(task.task_complete_at) : '');
        task.startDate = isValidValue(task.startDate) ? String(task.startDate) : (isValidValue(task.start_date) ? String(task.start_date) : '');
        const taskDateColorAttrValue = typeof __tmReadTaskMetaAttrValue === 'function'
            ? __tmReadTaskMetaAttrValue(task, 'taskDateColor')
            : '';
        task.taskDateColor = isValidValue(task.taskDateColor)
            ? String(task.taskDateColor)
            : (isValidValue(task.task_date_color)
                ? String(task.task_date_color)
                : (isValidValue(task.custom_task_date_color)
                    ? String(task.custom_task_date_color)
                    : (isValidValue(taskDateColorAttrValue)
                        ? String(taskDateColorAttrValue)
                        : (isValidValue(task['custom-task-date-color']) ? String(task['custom-task-date-color']) : ''))));
        task.task_date_color = task.taskDateColor;
        task.custom_task_date_color = task.taskDateColor;
        task.customTime = isValidValue(task.customTime) ? String(task.customTime) : (isValidValue(task.custom_time) ? String(task.custom_time) : '');
        task.customStatus = isValidValue(task.custom_status) ? String(task.custom_status) : (isValidValue(task.customStatus) ? String(task.customStatus) : '');
        task.bookmark = isValidValue(task.bookmark) ? String(task.bookmark) : '';
        task.repeatRule = __tmNormalizeTaskRepeatRule(
            task.repeatRule
            || task.repeat_rule
            || task[__TM_TASK_REPEAT_RULE_ATTR]
            || '',
            {
                anchorDate: todayDateKey,
                startDate: task.startDate,
                completionTime: task.completionTime,
            }
        );
        task.repeat_rule = task.repeatRule;
        task.repeatState = __tmNormalizeTaskRepeatState(
            task.repeatState
            || task.repeat_state
            || task[__TM_TASK_REPEAT_STATE_ATTR]
            || ''
        );
        task.repeat_state = task.repeatState;
        const repeatHistorySource = task.repeatHistory
            || task.repeat_history
            || task[__TM_TASK_REPEAT_HISTORY_ATTR]
            || '';
        task.repeatHistory = Array.isArray(repeatHistorySource)
            ? repeatHistorySource
            : __tmNormalizeTaskRepeatHistory(repeatHistorySource);
        task.repeat_history = task.repeatHistory;
        __tmApplyTaskAttachmentPathsToTask(task, task.__attachmentPaths || task.attachments || []);
        task.tomatoMinutes = isValidValue(task.tomatoMinutes) ? String(task.tomatoMinutes) : (isValidValue(task.tomato_minutes) ? String(task.tomato_minutes) : '');
        task.tomatoHours = isValidValue(task.tomatoHours) ? String(task.tomatoHours) : (isValidValue(task.tomato_hours) ? String(task.tomato_hours) : '');
        task.tomatoCount = __tmNormalizeTomatoCountValue(isValidValue(task.tomatoCount) ? task.tomatoCount : (isValidValue(task.tomato_count) ? task.tomato_count : ''));
        task.tomato_count = task.tomatoCount;
        task.tomatoEstimateCount = __tmNormalizeTomatoCountValue(isValidValue(task.tomatoEstimateCount) ? task.tomatoEstimateCount : (isValidValue(task.tomato_estimate_count) ? task.tomato_estimate_count : ''));
        task.tomato_estimate_count = task.tomatoEstimateCount;
        const rawCustomFieldValues = (task.__customFieldRawValues && typeof task.__customFieldRawValues === 'object' && !Array.isArray(task.__customFieldRawValues))
            ? task.__customFieldRawValues
            : ((task.customFieldValues && typeof task.customFieldValues === 'object' && !Array.isArray(task.customFieldValues))
                ? task.customFieldValues
                : {});
        const pin0 = task.custom_pinned ?? task.customPinned ?? task.pinned ?? '';
        task.pinned = __tmParseTaskLooseBoolean(pin0);
        const allDayBottom0 = task.custom_all_day_bottom ?? task.customAllDayBottom ?? task.allDayBottom ?? '';
        task.allDayBottom = __tmParseTaskLooseBoolean(allDayBottom0);
        task.custom_all_day_bottom = task.allDayBottom ? '1' : '';

        const meta = taskId ? MetaStore.get(taskId) : null;
        if (meta) {
            if ('pinned' in meta) {
                const ms = meta.pinned;
                if (typeof ms === 'boolean' || String(ms || '').trim() === '') task.pinned = __tmParseTaskLooseBoolean(ms);
            }
            if ('milestone' in meta) {
                const ms = meta.milestone;
                if (typeof ms === 'boolean' || String(ms || '').trim() === '') task.milestone = __tmParseTaskLooseBoolean(ms);
            }
            if ('allDayBottom' in meta) {
                const ms = meta.allDayBottom;
                if (typeof ms === 'boolean' || String(ms || '').trim() === '') task.allDayBottom = __tmParseTaskLooseBoolean(ms);
                task.custom_all_day_bottom = task.allDayBottom ? '1' : '';
            }
            if (!isValidValue(task.priority) && isValidValue(meta.priority)) task.priority = __tmNormalizeTaskPriorityValue(meta.priority);
            if (!isValidValue(task.duration) && isValidValue(meta.duration)) task.duration = meta.duration;
            if (!isValidValue(task.remark) && isValidValue(meta.remark)) task.remark = meta.remark;
            if (!isValidValue(task.completionTime) && allowVisibleDateFallback && isValidValue(meta.completionTime)) task.completionTime = meta.completionTime;
            if (!isValidValue(task.taskDateColor) && isValidValue(meta.taskDateColor)) {
                task.taskDateColor = String(meta.taskDateColor || '').trim();
                task.task_date_color = task.taskDateColor;
                task.custom_task_date_color = task.taskDateColor;
            }
            if (!isValidValue(task.taskCompleteAt) && isValidValue(meta.taskCompleteAt)) task.taskCompleteAt = meta.taskCompleteAt;
            if (!isValidValue(task.startDate) && allowVisibleDateFallback && isValidValue(meta.startDate)) task.startDate = meta.startDate;
            if (!isValidValue(task.customTime) && allowVisibleDateFallback && isValidValue(meta.customTime)) task.customTime = meta.customTime;
            if (!isValidValue(task.customStatus) && allowCustomStatusFallback && isValidValue(meta.customStatus)) task.customStatus = meta.customStatus;
            if (!dbHasRepeatRule && Object.prototype.hasOwnProperty.call(meta, 'repeatRule')) {
                task.repeatRule = __tmNormalizeTaskRepeatRule(meta.repeatRule, {
                    anchorDate: todayDateKey,
                    startDate: task.startDate,
                    completionTime: task.completionTime,
                });
            }
            if (!dbHasRepeatState && Object.prototype.hasOwnProperty.call(meta, 'repeatState')) {
                task.repeatState = __tmNormalizeTaskRepeatState(meta.repeatState);
            }
            if (!dbHasRepeatHistory && Object.prototype.hasOwnProperty.call(meta, 'repeatHistory')) {
                task.repeatHistory = __tmNormalizeTaskRepeatHistory(meta.repeatHistory);
            }
            const hasAttachmentAttrSnapshot = typeof __tmHasTaskAttachmentAttrSnapshot === 'function'
                && __tmHasTaskAttachmentAttrSnapshot(task);
            const metaAttachmentPaths = Object.prototype.hasOwnProperty.call(meta, 'attachments')
                ? __tmNormalizeTaskAttachmentPaths(meta.attachments)
                : [];
            const currentAttachmentPaths = __tmGetTaskAttachmentPaths(task);
            const currentAttachmentsMatchMeta = currentAttachmentPaths.length === metaAttachmentPaths.length
                && currentAttachmentPaths.every((path, index) => path === metaAttachmentPaths[index]);
            if (!hasAttachmentAttrSnapshot && !task.attachmentCount && Object.prototype.hasOwnProperty.call(meta, 'attachments')) {
                __tmApplyTaskAttachmentPathsToTask(task, metaAttachmentPaths, { meta: meta.attachmentMeta });
            } else if (!hasAttachmentAttrSnapshot && task.attachmentCount && currentAttachmentsMatchMeta) {
                __tmApplyTaskAttachmentPathsToTask(task, currentAttachmentPaths, { meta: meta.attachmentMeta });
            } else if (task.attachmentCount && !__tmGetTaskAttachmentMetaMap(task).size && Object.prototype.hasOwnProperty.call(meta, 'attachmentMeta')) {
                __tmApplyTaskAttachmentPathsToTask(task, currentAttachmentPaths, { meta: meta.attachmentMeta });
            }
            if (task.isOtherBlock === true && Object.prototype.hasOwnProperty.call(meta, 'done')) {
                const doneRaw = meta.done;
                task.done = doneRaw === true || doneRaw === 1 || String(doneRaw || '').trim().toLowerCase() === 'true' || String(doneRaw || '').trim() === '1';
            }
        }
        task.repeat_rule = task.repeatRule;
        task.repeat_state = task.repeatState;
        task.repeat_history = task.repeatHistory;
        const metaCustomFieldValues = (meta?.customFieldValues && typeof meta.customFieldValues === 'object' && !Array.isArray(meta.customFieldValues))
            ? meta.customFieldValues
            : null;
        task.customFieldValues = __tmNormalizeTaskCustomFieldValues(rawCustomFieldValues, metaCustomFieldValues, {
            customFieldDefs,
        });
        if (metaCustomFieldValues && Object.keys(metaCustomFieldValues).length) {
            try { __tmMaybeBackfillTaskCustomFieldAttrs(task, meta, { customFieldDefMap }); } catch (e) {}
        }
        task.taskCompleteAt = __tmNormalizeTaskCompleteAtValue(task.taskCompleteAt);
        task.task_complete_at = task.taskCompleteAt;
        __tmApplyTaskAttachmentPathsToTask(task, task.__attachmentPaths || task.attachments || []);
        {
            const directTaskMarker = __tmNormalizeTaskStatusMarker(task.taskMarker ?? task.task_marker ?? task.marker, '');
            if (directTaskMarker) {
                task.taskMarker = directTaskMarker;
                task.task_marker = directTaskMarker;
            } else {
                const parsedTaskMarker = __tmResolveTaskMarkdownMarker(task);
                if (parsedTaskMarker) {
                    task.taskMarker = parsedTaskMarker;
                    task.task_marker = parsedTaskMarker;
                }
            }
        }
        __tmNormalizeTaskContentField(task);

        const rawDocName = String(task.rawDocName || task.raw_doc_name || task.doc_name || task.docName || docNameFallback || '未知文档').trim() || '未知文档';
        task.rawDocName = rawDocName;
        if (docDisplayNameCache) {
            const cacheKey = [
                resolvedDocId,
                rawDocName,
                docDisplayNameMode,
            ].join('|');
            let displayName = String(docDisplayNameCache.get(cacheKey) || '').trim();
            if (!displayName) {
                displayName = __tmGetDocDisplayName(resolvedDocId ? { id: resolvedDocId, name: rawDocName } : { name: rawDocName }, rawDocName);
                if (displayName) docDisplayNameCache.set(cacheKey, displayName);
            }
            task.docName = displayName || rawDocName;
        } else {
            task.docName = __tmGetDocDisplayName(resolvedDocId ? { id: resolvedDocId, name: rawDocName } : { name: rawDocName }, rawDocName);
        }
        task.attrHostId = String(task.attrHostId || task.attr_host_id || taskId || '').trim();
        task.attr_host_id = task.attrHostId;
        task.parentTaskId = task.parentTaskId || task.parent_task_id || null;
        task.docId = resolvedDocId || null;
        task.docSeq = Number.isFinite(Number(task.docSeq ?? task.doc_seq)) ? Number(task.docSeq ?? task.doc_seq) : Number.POSITIVE_INFINITY;
        task.blockPath = String(task.blockPath || task.block_path || task.path || '').trim();
        task.blockSort = String(task.blockSort || task.block_sort || task.sort || '').trim();
        return task;
    }

    async function __tmResolveDocTaskParentLinks(rawTasks, options = {}) {
        const tasks = Array.isArray(rawTasks)
            ? rawTasks.filter((task) => task && typeof task === 'object')
            : [];
        const opts = (options && typeof options === 'object') ? options : {};
        const docId = String(
            opts.docId
            || tasks?.[0]?.root_id
            || tasks?.[0]?.docId
            || ''
        ).trim();
        const source = String(opts.source || 'doc-parent-links').trim() || 'doc-parent-links';
        const yieldEvery = Math.max(0, Math.round(Number(opts.yieldEvery || 0) || 0));
        const shouldYield = yieldEvery > 0;
        const yieldToBrowser = () => new Promise((resolve) => {
            try { setTimeout(resolve, 0); } catch (e) { resolve(); }
        });
        const parentLookupDepth = __tmNormalizeTaskParentLookupDepth(
            Object.prototype.hasOwnProperty.call(opts, 'parentLookupDepth')
                ? opts.parentLookupDepth
                : SettingsStore?.data?.taskParentLookupDepth
        );
        const manualRelationships = opts.manualRelationships instanceof Map ? opts.manualRelationships : null;
        const oldRelationships = opts.oldRelationships instanceof Map ? opts.oldRelationships : null;
        const allowOldRelationshipFallback = opts.allowOldRelationshipFallback === true;
        const idMap = new Map();
        const unresolvedParentIds = new Set();
        const fallbackTargets = [];
        const stats = {
            docId,
            taskCount: tasks.length,
            parentLookupDepth,
            manualResolvedCount: 0,
            directResolvedCount: 0,
            joinedResolvedCount: 0,
            listParentResolvedCount: 0,
            joinedMissingInDocCount: 0,
            fallbackCandidateCount: 0,
            fallbackQueryCount: 0,
            fallbackResolvedCount: 0,
            oldRelationshipResolvedCount: 0,
            missingParentInDocCount: 0,
        };

        for (let index = 0; index < tasks.length; index += 1) {
            if (shouldYield && index > 0 && (index % yieldEvery) === 0) await yieldToBrowser();
            const task = tasks[index];
            const taskId = String(task?.id || '').trim();
            if (!taskId) continue;
            task.children = [];
            idMap.set(taskId, task);
        }

        for (let index = 0; index < tasks.length; index += 1) {
            if (shouldYield && index > 0 && (index % yieldEvery) === 0) await yieldToBrowser();
            const task = tasks[index];
            const taskId = String(task?.id || '').trim();
            if (!taskId) continue;
            const directParentId = String(task?.parent_id || task?.parentId || '').trim();
            const joinedParentTaskId = String(task?.parentTaskId || task?.parent_task_id || '').trim();
            const listParentTaskId = String(task?.parent_list_parent_id || task?.parentListParentId || '').trim();
            const manualParentTaskId = manualRelationships
                ? String(manualRelationships.get(taskId) || '').trim()
                : '';
            let resolvedParentTaskId = '';
            let resolution = 'root';

            if (manualParentTaskId && idMap.has(manualParentTaskId)) {
                resolvedParentTaskId = manualParentTaskId;
                resolution = 'manual';
                stats.manualResolvedCount += 1;
            } else if (directParentId && idMap.has(directParentId)) {
                resolvedParentTaskId = directParentId;
                resolution = 'direct-parent';
                stats.directResolvedCount += 1;
            } else if (joinedParentTaskId && idMap.has(joinedParentTaskId)) {
                resolvedParentTaskId = joinedParentTaskId;
                resolution = 'sql-joined-parent';
                stats.joinedResolvedCount += 1;
            } else if (listParentTaskId && idMap.has(listParentTaskId)) {
                resolvedParentTaskId = listParentTaskId;
                resolution = 'parent-list-parent';
                stats.listParentResolvedCount += 1;
            } else {
                resolvedParentTaskId = joinedParentTaskId;
                if (directParentId && parentLookupDepth > 0) {
                    unresolvedParentIds.add(directParentId);
                    fallbackTargets.push({
                        task,
                        taskId,
                        directParentId,
                        joinedParentTaskId,
                        listParentTaskId,
                    });
                    stats.fallbackCandidateCount += 1;
                    if (joinedParentTaskId) stats.joinedMissingInDocCount += 1;
                }
            }

            task.parentTaskId = resolvedParentTaskId;
        }

        if (unresolvedParentIds.size > 0 && parentLookupDepth > 0) {
            try {
                const blockParentMap = new Map();
                let frontier = new Set(Array.from(unresolvedParentIds));
                for (let depth = 0; depth < parentLookupDepth && frontier.size > 0; depth += 1) {
                    if (shouldYield && depth > 0) await yieldToBrowser();
                    const queryIds = Array.from(frontier).filter((id) => id && !blockParentMap.has(id) && !idMap.has(id));
                    frontier = new Set();
                    if (!queryIds.length) continue;
                    const rows = await API.getBlocksByIds(queryIds);
                    stats.fallbackQueryCount += 1;
                    (Array.isArray(rows) ? rows : []).forEach((row) => {
                        const id = String(row?.id || '').trim();
                        const parentId = String(row?.parent_id || '').trim();
                        if (!id || blockParentMap.has(id)) return;
                        blockParentMap.set(id, parentId);
                        if (!parentId || parentId === docId || idMap.has(parentId)) return;
                        frontier.add(parentId);
                    });
                }
                for (let index = 0; index < fallbackTargets.length; index += 1) {
                    if (shouldYield && index > 0 && (index % yieldEvery) === 0) await yieldToBrowser();
                    const item = fallbackTargets[index];
                    let cursor = String(item.directParentId || '').trim();
                    const seen = new Set();
                    for (let depth = 0; cursor && depth < parentLookupDepth; depth += 1) {
                        if (seen.has(cursor)) break;
                        seen.add(cursor);
                        const parentId = String(blockParentMap.get(cursor) || '').trim();
                        if (!parentId || parentId === docId) break;
                        if (idMap.has(parentId)) {
                            if (String(item.task?.parentTaskId || '').trim() !== parentId) {
                                item.task.parentTaskId = parentId;
                                stats.fallbackResolvedCount += 1;
                            }
                            break;
                        }
                        cursor = parentId;
                    }
                }
            } catch (e) {}
        }

        const rootTasks = [];
        for (let index = 0; index < tasks.length; index += 1) {
            if (shouldYield && index > 0 && (index % yieldEvery) === 0) await yieldToBrowser();
            const task = tasks[index];
            const taskId = String(task?.id || '').trim();
            if (!taskId) continue;
            let parentTaskId = String(task?.parentTaskId || '').trim();
            let resolvedInDoc = !!(parentTaskId && idMap.has(parentTaskId));
            if (!resolvedInDoc && allowOldRelationshipFallback && oldRelationships?.has(taskId)) {
                const oldRel = oldRelationships.get(taskId);
                const directParentId = String(task?.parent_id || task?.parentId || '').trim();
                const oldListId = String(oldRel?.listId || '').trim();
                const oldParentId = String(oldRel?.parentId || '').trim();
                if (oldListId && oldListId === directParentId && oldParentId && idMap.has(oldParentId)) {
                    task.parentTaskId = oldParentId;
                    parentTaskId = oldParentId;
                    resolvedInDoc = true;
                    stats.oldRelationshipResolvedCount += 1;
                }
            }
            if (resolvedInDoc) {
                task.parent_task_id = parentTaskId;
                idMap.get(parentTaskId).children.push(task);
            } else {
                rootTasks.push(task);
                if (parentTaskId) stats.missingParentInDocCount += 1;
            }
        }

        return {
            rootTasks,
            stats,
        };
    }

    function __tmIsOtherBlockTabId(value) {
        return String(value || '').trim() === __TM_OTHER_BLOCK_TAB_ID;
    }

    function __tmResolveOtherBlockGroupId(groupId) {
        const raw = String(groupId || SettingsStore?.data?.currentGroupId || 'all').trim() || 'all';
        return raw === 'all' ? '' : raw;
    }

    function __tmGetDocGroupById(groupId) {
        const gid = String(groupId || '').trim();
        if (!gid) return null;
        const groups = Array.isArray(SettingsStore?.data?.docGroups) ? SettingsStore.data.docGroups : [];
        return groups.find((group) => String(group?.id || '').trim() === gid) || null;
    }

    function __tmIsDocExcludedInGroup(docId, groupId) {
        const id = String(docId || '').trim();
        if (!id) return false;
        return __tmGetExcludedDocIdsForGroup(groupId).includes(id);
    }

    async function __tmSetDocExcludedForGroup(docId, excluded, groupId) {
        const id = String(docId || '').trim();
        const gid = String(groupId || 'all').trim() || 'all';
        if (!id || !gid) return { changed: false, group: null, reason: 'invalid-group' };

        const isAllGroup = gid === 'all';
        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        let group = null;
        let nextExcluded = null;

        if (isAllGroup) {
            nextExcluded = new Set(__tmGetAllDocsExcludedDocIds());
        } else {
            const idx = groups.findIndex((item) => String(item?.id || '').trim() === gid);
            if (idx < 0) return { changed: false, group: null, reason: 'group-missing' };
            group = groups[idx];
            nextExcluded = new Set(__tmGetGroupExcludedDocIds(group));
        }
        const had = nextExcluded.has(id);
        if (excluded) nextExcluded.add(id);
        else nextExcluded.delete(id);
        if (had === !!excluded) return { changed: false, group, reason: had ? 'already-set' : 'already-cleared' };

        if (isAllGroup) {
            SettingsStore.data.allDocsExcludedDocIds = __tmNormalizeDocGroupExcludedDocIds(Array.from(nextExcluded));
        } else {
            const idx = groups.findIndex((item) => String(item?.id || '').trim() === gid);
            groups[idx] = {
                ...group,
                excludedDocIds: Array.from(nextExcluded)
            };
            SettingsStore.data.docGroups = groups.map((item) => __tmNormalizeDocGroupConfig(item, SettingsStore.data.docDefaultColorScheme)).filter(Boolean);
            group = __tmGetDocGroupById(gid);
        }

        if (excluded) {
            const pinMap0 = (SettingsStore.data.docPinnedByGroup && typeof SettingsStore.data.docPinnedByGroup === 'object')
                ? SettingsStore.data.docPinnedByGroup
                : {};
            const pinMap = { ...pinMap0 };
            const pinList = Array.isArray(pinMap[gid]) ? pinMap[gid] : [];
            const nextPinned = pinList.map((item) => String(item || '').trim()).filter(Boolean).filter((item) => item !== id);
            if (nextPinned.length !== pinList.length) {
                pinMap[gid] = nextPinned;
                SettingsStore.data.docPinnedByGroup = pinMap;
            }

            if (isAllGroup) {
                if (String(SettingsStore.data.defaultDocId || '').trim() === id) {
                    SettingsStore.data.defaultDocId = '';
                }
            } else {
                const defaultDocIdByGroup = (SettingsStore.data.defaultDocIdByGroup && typeof SettingsStore.data.defaultDocIdByGroup === 'object')
                    ? { ...SettingsStore.data.defaultDocIdByGroup }
                    : {};
                if (String(defaultDocIdByGroup[gid] || '').trim() === id) {
                    delete defaultDocIdByGroup[gid];
                    SettingsStore.data.defaultDocIdByGroup = defaultDocIdByGroup;
                }
            }
        }

        try { __tmDocExpandCache.clear(); } catch (e) {}
        try { __tmResolvedDocIdsCache = null; } catch (e) {}
        try { __tmResolvedDocIdsPromise = null; } catch (e) {}

        await SettingsStore.save();

        const currentGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        if (currentGroupId === gid) {
            if (excluded && String(state.activeDocId || 'all').trim() === id) state.activeDocId = 'all';
            try { await __tmApplyCurrentContextViewProfile(); } catch (e) {}
            try {
                await loadSelectedDocuments({
                    showInlineLoading: false,
                    source: excluded ? 'exclude-doc' : 'restore-excluded-doc',
                });
            } catch (e) {}
            try { render(); } catch (e) {}
        }

        if (state.settingsModal) showSettings();
        return { changed: true, group: isAllGroup ? null : group, reason: excluded ? 'excluded' : 'restored' };
    }

    function __tmNormalizeOtherBlockRefs(input) {
        const source = Array.isArray(input) ? input : [];
        const out = [];
        const seen = new Set();
        source.forEach((item) => {
            const id = String((typeof item === 'object' ? item?.id : item) || '').trim();
            if (!/^[0-9]{14}-[A-Za-z0-9]+$/.test(id) || seen.has(id)) return;
            seen.add(id);
            out.push({ id });
        });
        return out;
    }

    function __tmGetOtherBlockRefsByGroup(groupId) {
        const gid = __tmResolveOtherBlockGroupId(groupId);
        if (!gid) return [];
        const group = __tmGetDocGroupById(gid);
        return __tmNormalizeOtherBlockRefs(group?.otherBlockRefs);
    }

    function __tmCanResolveOtherBlockSourceDoc(type, subtype) {
        const t = String(type || '').trim().toLowerCase();
        const st = String(subtype || '').trim().toLowerCase();
        if (t === 'i' && st === 't') return true;
        return __tmIsSupportedOtherBlockType(t, st);
    }

    function __tmExtractOtherBlockSourceDocFromRow(row) {
        if (!row) return null;
        const type = String(row?.type || row?.otherBlockType || '').trim().toLowerCase();
        const subtype = String(row?.subtype || row?.otherBlockSubtype || '').trim().toLowerCase();
        if (!__tmCanResolveOtherBlockSourceDoc(type, subtype)) return null;
        const blockId = String(row?.id || '').trim();
        const docId = type === 'd'
            ? String(row?.id || row?.root_id || '').trim()
            : String(row?.root_id || row?.docId || '').trim();
        if (!docId) return null;
        return {
            docId,
            blockId,
            docName: type === 'd'
                ? (String(row?.content || '').trim() || String(row?.doc_name || '').trim())
                : String(row?.docName || row?.doc_name || '').trim()
        };
    }

    function __tmRememberOtherBlockSourceDocs(groupId, rows) {
        const gid = __tmResolveOtherBlockGroupId(groupId);
        if (!gid) return [];
        const out = [];
        const byDoc = new Map();
        (Array.isArray(rows) ? rows : []).forEach((row) => {
            const source = __tmExtractOtherBlockSourceDocFromRow(row);
            if (!source) return;
            const current = byDoc.get(source.docId) || {
                id: source.docId,
                kind: 'doc',
                recursive: false,
                source: 'otherBlock',
                otherBlockCount: 0,
                otherBlockIds: [],
                docName: ''
            };
            current.otherBlockCount += 1;
            if (source.blockId) current.otherBlockIds.push(source.blockId);
            if (source.docName && !current.docName) current.docName = source.docName;
            byDoc.set(source.docId, current);
        });
        byDoc.forEach((entry) => out.push(entry));
        if (!state.otherBlockSourceDocsByGroup || typeof state.otherBlockSourceDocsByGroup !== 'object') {
            state.otherBlockSourceDocsByGroup = {};
        }
        state.otherBlockSourceDocsByGroup[gid] = out;
        return out;
    }

    function __tmGetOtherBlockRefsSig(refs) {
        return __tmNormalizeOtherBlockRefs(refs).map((item) => item.id).join(',');
    }

    function __tmMarkOtherBlockSourceDocsStale(groupId) {
        const gid = __tmResolveOtherBlockGroupId(groupId);
        if (!gid) return;
        if (!state.otherBlockSourceDocRefsSigByGroup || typeof state.otherBlockSourceDocRefsSigByGroup !== 'object') {
            state.otherBlockSourceDocRefsSigByGroup = {};
        }
        delete state.otherBlockSourceDocRefsSigByGroup[gid];
    }

    async function __tmEnsureOtherBlockSourceDocsForGroup(groupId, options = {}) {
        const gid = __tmResolveOtherBlockGroupId(groupId);
        if (!gid) return [];
        const refs = __tmGetOtherBlockRefsByGroup(gid);
        const refsSig = __tmGetOtherBlockRefsSig(refs);
        if (!state.otherBlockSourceDocsByGroup || typeof state.otherBlockSourceDocsByGroup !== 'object') {
            state.otherBlockSourceDocsByGroup = {};
        }
        if (!state.otherBlockSourceDocRefsSigByGroup || typeof state.otherBlockSourceDocRefsSigByGroup !== 'object') {
            state.otherBlockSourceDocRefsSigByGroup = {};
        }
        if (!refs.length) {
            state.otherBlockSourceDocsByGroup[gid] = [];
            state.otherBlockSourceDocRefsSigByGroup[gid] = refsSig;
            return [];
        }
        if (options?.force !== true
            && state.otherBlockSourceDocRefsSigByGroup[gid] === refsSig
            && Array.isArray(state.otherBlockSourceDocsByGroup[gid])) {
            return Array.isArray(state.otherBlockSourceDocsByGroup[gid]) ? state.otherBlockSourceDocsByGroup[gid] : [];
        }
        let rows = [];
        try { rows = await API.getOtherBlocksByIds(refs.map((item) => item.id)); } catch (e) { rows = []; }
        const rowsById = new Map();
        (Array.isArray(rows) ? rows : []).forEach((row) => {
            const id = String(row?.id || '').trim();
            if (id && !rowsById.has(id)) rowsById.set(id, row);
        });
        const orderedRows = [];
        refs.forEach((ref) => {
            const row = rowsById.get(String(ref?.id || '').trim());
            if (row) orderedRows.push(row);
        });
        const out = __tmRememberOtherBlockSourceDocs(gid, orderedRows);
        state.otherBlockSourceDocRefsSigByGroup[gid] = refsSig;
        return out;
    }

    function __tmResolveAutoOtherBlockTargetGroupId(groupId) {
        const preferred = __tmResolveOtherBlockGroupId(groupId);
        if (preferred && __tmGetDocGroupById(preferred)) return preferred;
        const current = __tmResolveOtherBlockGroupId();
        if (current && __tmGetDocGroupById(current)) return current;
        const groups = Array.isArray(SettingsStore?.data?.docGroups) ? SettingsStore.data.docGroups : [];
        return String(groups[0]?.id || '').trim();
    }

    async function __tmResolveOtherBlockSourceDocId(blockIdsInput, options = {}) {
        const explicitDocId = String(options?.docId || options?.rootId || '').trim();
        if (explicitDocId) return explicitDocId;
        const ids = __tmNormalizeOtherBlockRefs(Array.isArray(blockIdsInput) ? blockIdsInput : [blockIdsInput]).map((item) => item.id);
        if (!ids.length) return '';
        let rows = [];
        try { rows = await API.getOtherBlocksByIds(ids); } catch (e) { rows = []; }
        for (const row of (Array.isArray(rows) ? rows : [])) {
            const type = String(row?.type || '').trim().toLowerCase();
            const docId = type === 'd'
                ? String(row?.id || row?.root_id || '').trim()
                : String(row?.root_id || '').trim();
            if (docId) return docId;
        }
        return '';
    }

    async function __tmResolveOtherBlockTargetGroupIdByDoc(docId) {
        const did = String(docId || '').trim();
        if (!did) return '';
        try {
            if (typeof __tmResolveDocTopbarTargetGroup === 'function') {
                const target = await __tmResolveDocTopbarTargetGroup(did);
                const groupId = String(target?.groupId || '').trim();
                if (groupId && __tmGetDocGroupById(groupId)) return groupId;
            }
        } catch (e) {}
        try {
            if (typeof window.tmCalendarWarmDocsToGroupCache === 'function') {
                await window.tmCalendarWarmDocsToGroupCache();
            }
        } catch (e) {}
        try {
            const map = window.__tmCalendarDocsToGroupCache?.map instanceof Map
                ? window.__tmCalendarDocsToGroupCache.map
                : (typeof __tmGetCalendarDocsToGroupMapSync === 'function' ? __tmGetCalendarDocsToGroupMapSync() : null);
            const groupId = String(map?.get?.(did) || '').trim();
            if (groupId && __tmGetDocGroupById(groupId)) return groupId;
        } catch (e) {}
        return '';
    }

    function __tmSetOtherBlockRefsByGroup(groupId, refs) {
        const gid = __tmResolveOtherBlockGroupId(groupId);
        if (!gid) return null;
        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        const nextGroups = groups.map((group) => {
            if (String(group?.id || '').trim() !== gid) return group;
            return {
                ...group,
                otherBlockRefs: __tmNormalizeOtherBlockRefs(refs)
            };
        });
        SettingsStore.data.docGroups = nextGroups.map((group) => __tmNormalizeDocGroupConfig(group, SettingsStore.data.docDefaultColorScheme)).filter(Boolean);
        return __tmGetDocGroupById(gid);
    }

    async function __tmMigrateLegacyOtherBlockRefsToGroups(options = {}) {
        const legacyRefs = __tmNormalizeOtherBlockRefs(SettingsStore.data.otherBlockRefs);
        if (!legacyRefs.length) return { migrated: false, group: null };
        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        if (!groups.length) return { migrated: false, group: null };
        let targetGroupId = __tmResolveOtherBlockGroupId(options?.groupId);
        if (!targetGroupId && groups.length === 1) {
            targetGroupId = String(groups[0]?.id || '').trim();
        }
        if (!targetGroupId) return { migrated: false, group: null };
        const group = __tmGetDocGroupById(targetGroupId);
        if (!group) return { migrated: false, group: null };
        const mergedRefs = __tmNormalizeOtherBlockRefs([...(group.otherBlockRefs || []), ...legacyRefs]);
        __tmSetOtherBlockRefsByGroup(targetGroupId, mergedRefs);
        SettingsStore.data.otherBlockRefs = [];
        if (options?.persist !== false) {
            try { await SettingsStore.save(); } catch (e) {}
        }
        return { migrated: true, group: __tmGetDocGroupById(targetGroupId) };
    }

    function __tmIsSupportedOtherBlockType(type, subtype) {
        const t = String(type || '').trim().toLowerCase();
        const st = String(subtype || '').trim().toLowerCase();
        if (t === 'd' || t === 'h' || t === 'p' || t === 's') return true;
        if ((t === 'i' || t === 'l') && (st === 'o' || st === 'u')) return true;
        return false;
    }

    function __tmGetOtherBlockTypeLabel(type, subtype) {
        const t = String(type || '').trim().toLowerCase();
        const st = String(subtype || '').trim().toLowerCase();
        if (t === 'd') return '文档块';
        if (t === 'h') return '标题块';
        if (t === 'p') return '内容块';
        if (t === 's') return '超级块';
        if (st === 'o') return '有序列表块';
        if (st === 'u') return '无序列表块';
        return '其他块';
    }

    function __tmIsCollectedOtherBlockTask(task) {
        return !!(task && typeof task === 'object' && task.isOtherBlock === true);
    }

    function __tmBuildCollectedOtherBlockTask(row, orderIdx = 0, groupId = '') {
        const type = String(row?.type || '').trim().toLowerCase();
        const subtype = String(row?.subtype || '').trim().toLowerCase();
        const label = __tmGetOtherBlockTypeLabel(type, subtype);
        const id = String(row?.id || '').trim();
        const isDocBlock = type === 'd';
        const isSuperBlock = type === 's';
        const docId = isDocBlock
            ? id
            : (String(row?.root_id || '').trim() || id);
        const docName = isDocBlock
            ? (String(row?.content || '').trim() || String(row?.doc_name || '').trim() || '未命名文档')
            : (String(row?.doc_name || '').trim() || '未命名文档');
        const rawContent = isSuperBlock
            ? (String(row?.fcontent || '').trim() || String(row?.content || '').trim())
            : (String(row?.content || '').trim() || (isDocBlock ? docName : ''));
        const displayContent = rawContent || '(无内容)';
        const task = {
            id,
            content: displayContent,
            markdown: displayContent,
            done: false,
            parent_id: String(row?.parent_id || '').trim(),
            parentTaskId: null,
            root_id: docId,
            docId,
            doc_name: docName,
            docName,
            children: [],
            level: 0,
            priority: '',
            duration: '',
            remark: '',
            completionTime: '',
            startDate: '',
            customTime: '',
            customStatus: '',
            pinned: false,
            milestone: false,
            block_path: String(row?.path || '').trim(),
            block_sort: String(row?.sort ?? '').trim(),
            created: String(row?.created || '').trim(),
            updated: String(row?.updated || '').trim(),
            doc_seq: Number.isFinite(Number(orderIdx)) ? Number(orderIdx) : Number.POSITIVE_INFINITY,
            isOtherBlock: true,
            otherBlockType: type,
            otherBlockSubtype: subtype,
            otherBlockTypeLabel: label,
            otherBlockRawContent: rawContent,
            otherBlockDisplayContent: displayContent,
            otherBlockGroupId: __tmResolveOtherBlockGroupId(groupId),
        };
        try { normalizeTaskFields(task, docName); } catch (e) {}
        task.children = [];
        task.parentTaskId = null;
        task.docSeq = Number.isFinite(Number(orderIdx)) ? Number(orderIdx) : Number.POSITIVE_INFINITY;
        return task;
    }

    function __tmMergeOtherBlocksIntoFlatTasks(baseFlatTasks) {
        const base = (baseFlatTasks && typeof baseFlatTasks === 'object') ? baseFlatTasks : {};
        const next = { ...base };
        Object.keys(next).forEach((id) => {
            if (__tmIsCollectedOtherBlockTask(next[id])) delete next[id];
        });
        (Array.isArray(state.otherBlocks) ? state.otherBlocks : []).forEach((task) => {
            const id = String(task?.id || '').trim();
            if (!id) return;
            next[id] = task;
        });
        return next;
    }

    function __tmCacheCollectedOtherBlockTaskInState(task, options = {}) {
        if (!__tmIsCollectedOtherBlockTask(task)) return null;
        const tid = String(task?.id || '').trim();
        if (!tid) return null;
        const opts = (options && typeof options === 'object') ? options : {};
        const targetGroupId = __tmResolveOtherBlockGroupId(opts.groupId || task.otherBlockGroupId || '');
        const nextTask = targetGroupId && String(task.otherBlockGroupId || '').trim() !== targetGroupId
            ? { ...task, otherBlockGroupId: targetGroupId }
            : task;
        try { globalThis.__tmTaskStore?.upsertLocal?.(nextTask, { status: 'other-block-cache' }); } catch (e) {}
        if (opts.touchList === false) return nextTask;

        const list = Array.isArray(state.otherBlocks) ? state.otherBlocks.slice() : [];
        const index = list.findIndex((item) => String(item?.id || '').trim() === tid);
        if (index >= 0) {
            list[index] = nextTask;
            state.otherBlocks = list;
        } else if (opts.appendToList === true || __tmIsOtherBlockTabId(state.activeDocId)) {
            list.push(nextTask);
            state.otherBlocks = list;
        }
        return nextTask;
    }

    function __tmGetCollectedOtherBlockTaskFromState(id) {
        const tid = String(id || '').trim();
        if (!tid) return null;
        const direct = globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid] || null;
        if (__tmIsCollectedOtherBlockTask(direct)) return direct;
        const pools = [
            Array.isArray(state.otherBlocks) ? state.otherBlocks : [],
            Array.isArray(state.filteredTasks) ? state.filteredTasks : [],
        ];
        for (const pool of pools) {
            const task = pool.find((item) => String(item?.id || '').trim() === tid);
            if (__tmIsCollectedOtherBlockTask(task)) return task;
        }
        return null;
    }

    async function __tmLoadCollectedOtherBlocks(options = {}) {
        const currentGroupId = __tmResolveOtherBlockGroupId(options?.groupId);
        if (currentGroupId) {
            try { await __tmMigrateLegacyOtherBlockRefsToGroups({ groupId: currentGroupId, persist: options.persist }); } catch (e) {}
        }
        const normalizedRefs = __tmGetOtherBlockRefsByGroup(currentGroupId);
        const rawCount = Array.isArray(__tmGetDocGroupById(currentGroupId)?.otherBlockRefs) ? __tmGetDocGroupById(currentGroupId).otherBlockRefs.length : 0;
        let changed = normalizedRefs.length !== rawCount;
        if (!currentGroupId || !normalizedRefs.length) {
            if (currentGroupId) __tmSetOtherBlockRefsByGroup(currentGroupId, []);
            if (currentGroupId) __tmRememberOtherBlockSourceDocs(currentGroupId, []);
            if (currentGroupId && state.otherBlockSourceDocRefsSigByGroup && typeof state.otherBlockSourceDocRefsSigByGroup === 'object') {
                state.otherBlockSourceDocRefsSigByGroup[currentGroupId] = '';
            }
            state.otherBlocks = [];
            globalThis.__tmTaskStore?.replaceFlat?.(globalThis.__tmTaskStore?.getFlatMap?.() || state.flatTasks || {}, { mergeOtherBlocks: true });
            if (__tmIsOtherBlockTabId(state.activeDocId)) state.activeDocId = 'all';
            if (currentGroupId && changed && options.persist !== false) {
                try { await SettingsStore.save(); } catch (e) {}
            }
            return [];
        }

        let rows = [];
        try { rows = await API.getOtherBlocksByIds(normalizedRefs.map((item) => item.id)); } catch (e) { rows = []; }
        const rowMap = new Map();
        (Array.isArray(rows) ? rows : []).forEach((row) => {
            const id = String(row?.id || '').trim();
            if (!id) return;
            rowMap.set(id, row);
        });

        const nextRefs = [];
        const nextTasks = [];
        const nextSourceRows = [];
        normalizedRefs.forEach((item, idx) => {
            const id = String(item?.id || '').trim();
            const row = rowMap.get(id);
            if (!row || !__tmCanResolveOtherBlockSourceDoc(row?.type, row?.subtype)) {
                changed = true;
                return;
            }
            nextRefs.push({ id });
            nextSourceRows.push(row);
            if (__tmIsSupportedOtherBlockType(row?.type, row?.subtype)) {
                nextTasks.push(__tmBuildCollectedOtherBlockTask(row, idx, currentGroupId));
            }
        });

        __tmSetOtherBlockRefsByGroup(currentGroupId, nextRefs);
        __tmRememberOtherBlockSourceDocs(currentGroupId, nextSourceRows);
        if (!state.otherBlockSourceDocRefsSigByGroup || typeof state.otherBlockSourceDocRefsSigByGroup !== 'object') {
            state.otherBlockSourceDocRefsSigByGroup = {};
        }
        state.otherBlockSourceDocRefsSigByGroup[currentGroupId] = __tmGetOtherBlockRefsSig(nextRefs);
        state.otherBlocks = nextTasks;
        globalThis.__tmTaskStore?.replaceFlat?.(globalThis.__tmTaskStore?.getFlatMap?.() || state.flatTasks || {}, { mergeOtherBlocks: true });
        if (__tmIsOtherBlockTabId(state.activeDocId) && !nextTasks.length) state.activeDocId = 'all';

        if (changed && options.persist !== false) {
            try { await SettingsStore.save(); } catch (e) {}
        }
        return nextTasks;
    }

    async function __tmAddOtherBlocksToCollection(blockIdsInput, groupIdInput, options = {}) {
        const ids = __tmNormalizeOtherBlockRefs(Array.isArray(blockIdsInput) ? blockIdsInput : [blockIdsInput]).map((item) => item.id);
        const targetGroupId = __tmResolveOtherBlockGroupId(groupIdInput);
        const silent = options?.silent === true;
        if (!ids.length) return { added: 0, existed: 0, invalid: 0, group: null };
        if (!targetGroupId) {
            if (!silent) hint('⚠ 请先选择目标文档分组', 'warning');
            return { added: 0, existed: 0, invalid: 0, group: null, reason: 'no-group' };
        }
        const group = __tmGetDocGroupById(targetGroupId);
        if (!group) {
            if (!silent) hint('⚠ 目标分组不存在', 'warning');
            return { added: 0, existed: 0, invalid: 0, group: null, reason: 'group-missing' };
        }

        let rows = [];
        try { rows = await API.getOtherBlocksByIds(ids); } catch (e) { rows = []; }
        const rowMap = new Map();
        (Array.isArray(rows) ? rows : []).forEach((row) => {
            const id = String(row?.id || '').trim();
            if (!id || !__tmIsSupportedOtherBlockType(row?.type, row?.subtype)) return;
            rowMap.set(id, row);
        });

        const currentRefs = __tmGetOtherBlockRefsByGroup(targetGroupId);
        const seen = new Set(currentRefs.map((item) => item.id));
        const nextRefs = currentRefs.slice();
        let added = 0;
        let existed = 0;
        let invalid = 0;
        const addedRows = [];

        ids.forEach((id) => {
            const row = rowMap.get(id);
            if (!row) {
                invalid += 1;
                return;
            }
            if (seen.has(id)) {
                existed += 1;
                return;
            }
            seen.add(id);
            nextRefs.push({ id });
            addedRows.push(row);
            added += 1;
        });

        if (!added) {
            const groupName = __tmResolveDocGroupName(group);
            if (existed > 0) {
                if (!silent) {
                    hint(ids.length > 1
                        ? `⚠ 所选块已都在“${groupName}”中`
                        : `⚠ 该块已在“${groupName}”中`, 'warning');
                }
            } else if (invalid > 0) {
                if (!silent) hint('⚠ 当前仅支持文档块、标题块、内容块、超级块和有序/无序列表块', 'warning');
            }
            return { added, existed, invalid, group, reason: existed > 0 ? 'exists' : (invalid > 0 ? 'invalid' : 'unchanged') };
        }

        __tmSetOtherBlockRefsByGroup(targetGroupId, nextRefs);
        __tmMarkOtherBlockSourceDocsStale(targetGroupId);
        try { await SettingsStore.save(); } catch (e) {}
        const currentGroupId = __tmResolveOtherBlockGroupId();
        if (currentGroupId === targetGroupId || options.forceRefresh) {
            await __tmLoadCollectedOtherBlocks({ persist: false, groupId: targetGroupId });
            globalThis.__tmTaskStore?.replaceFlat?.(globalThis.__tmTaskStore?.getFlatMap?.() || state.flatTasks || {}, { mergeOtherBlocks: true });
            try { recalcStats(); } catch (e) {}
            try { applyFilters(); } catch (e) {}
            try { if (state.modal) render(); } catch (e) {}
        } else {
            addedRows.forEach((row, index) => {
                try {
                    const orderIdx = Math.max(0, currentRefs.length + index);
                    const task = __tmBuildCollectedOtherBlockTask(row, orderIdx, targetGroupId);
                    __tmCacheCollectedOtherBlockTaskInState(task, { groupId: targetGroupId, touchList: false });
                } catch (e) {}
            });
        }
        return { added, existed, invalid, group: __tmGetDocGroupById(targetGroupId), reason: 'added' };
    }

    async function __tmRemoveOtherBlocksFromCollection(blockIdsInput, groupIdInput, options = {}) {
        const targetGroupId = __tmResolveOtherBlockGroupId(groupIdInput);
        const removeIds = new Set(__tmNormalizeOtherBlockRefs(Array.isArray(blockIdsInput) ? blockIdsInput : [blockIdsInput]).map((item) => item.id));
        if (!removeIds.size) return { removed: 0 };
        const currentRefs = __tmGetOtherBlockRefsByGroup(targetGroupId);
        const nextRefs = currentRefs.filter((item) => !removeIds.has(String(item?.id || '').trim()));
        const removed = currentRefs.length - nextRefs.length;
        if (removed <= 0) return { removed: 0 };

        __tmSetOtherBlockRefsByGroup(targetGroupId, nextRefs);
        try { __tmMarkOtherBlockSourceDocsStale(targetGroupId); } catch (e) {}
        try { await SettingsStore.save(); } catch (e) {}
        const currentGroupId = __tmResolveOtherBlockGroupId();
        if (currentGroupId === targetGroupId || options.forceRefresh) {
            await __tmLoadCollectedOtherBlocks({ persist: false, groupId: targetGroupId });
            globalThis.__tmTaskStore?.replaceFlat?.(globalThis.__tmTaskStore?.getFlatMap?.() || state.flatTasks || {}, { mergeOtherBlocks: true });
            if (__tmIsOtherBlockTabId(state.activeDocId) && !(Array.isArray(state.otherBlocks) && state.otherBlocks.length)) {
                state.activeDocId = 'all';
            }
            if (removeIds.has(String(state.detailTaskId || '').trim())) {
                state.detailTaskId = '';
            }
            if (removeIds.has(String(state.kanbanDetailTaskId || '').trim())) {
                state.kanbanDetailTaskId = '';
                state.kanbanDetailAnchorTaskId = '';
            }
            try { recalcStats(); } catch (e) {}
            try { applyFilters(); } catch (e) {}
            try { if (state.modal) render(); } catch (e) {}
        }
        return { removed };
    }

    async function __tmSetCollectedOtherBlockDone(taskOrId, done) {
        const task = (taskOrId && typeof taskOrId === 'object')
            ? taskOrId
            : (globalThis.__tmRuntimeState?.getFlatTaskById?.(String(taskOrId || '').trim()) || state.flatTasks?.[String(taskOrId || '').trim()]);
        const tid = String(task?.id || taskOrId || '').trim();
        if (!task || !tid || !__tmIsCollectedOtherBlockTask(task)) return false;
        const nextDone = !!done;
        task.done = nextDone;
        try {
            if (!state.doneOverrides || typeof state.doneOverrides !== 'object') state.doneOverrides = {};
            state.doneOverrides[tid] = nextDone;
        } catch (e) {}
        try { MetaStore.set(tid, { done: nextDone }); } catch (e) {}
        try { await MetaStore.saveNow?.(); } catch (e) {}
        try { recalcStats(); } catch (e) {}
        try { applyFilters(); } catch (e) {}
        try {
            if (String(state.viewMode || '').trim() === 'checklist') {
                __tmRefreshChecklistSelectionInPlace(state.modal, 'other-block-done');
            }
        } catch (e) {}
        try { if (state.modal) render(); } catch (e) {}
        return true;
    }

    async function __tmSetCollectedOtherBlockPriority(taskOrId, priority) {
        const task = (taskOrId && typeof taskOrId === 'object')
            ? taskOrId
            : (globalThis.__tmRuntimeState?.getFlatTaskById?.(String(taskOrId || '').trim()) || state.flatTasks?.[String(taskOrId || '').trim()]);
        const tid = String(task?.id || taskOrId || '').trim();
        if (!task || !tid || !__tmIsCollectedOtherBlockTask(task)) return false;
        const nextPriority = __tmNormalizeTaskPriorityValue(priority);
        task.priority = nextPriority;
        task.custom_priority = nextPriority;
        task.customPriority = nextPriority;
        try { MetaStore.set(tid, { priority: nextPriority }); } catch (e) {}
        try { await MetaStore.saveNow?.(); } catch (e) {}
        try { applyFilters(); } catch (e) {}
        try { if (state.modal) render(); } catch (e) {}
        return true;
    }

    async function __tmResolveCollectedOtherBlockTaskById(id) {
        const tid = String(id || '').trim();
        if (!tid) return null;
        const existing = __tmGetCollectedOtherBlockTaskFromState(tid);
        if (existing) return existing;
        let rows = [];
        try { rows = await API.getOtherBlocksByIds([tid]); } catch (e) { rows = []; }
        const row = Array.isArray(rows) ? rows.find((item) => {
            const rid = String(item?.id || '').trim();
            return rid === tid && __tmIsSupportedOtherBlockType(item?.type, item?.subtype);
        }) : null;
        if (!row) return null;
        const task = __tmBuildCollectedOtherBlockTask(row, Number.POSITIVE_INFINITY, __tmResolveOtherBlockGroupId());
        return __tmCacheCollectedOtherBlockTaskInState(task, {
            appendToList: __tmIsOtherBlockTabId(state.activeDocId),
        }) || task;
    }

    function __tmEnsureEditableTaskLike(taskOrId, actionLabel = '该操作') {
        const tid = String(taskOrId || '').trim();
        const task = (taskOrId && typeof taskOrId === 'object')
            ? taskOrId
            : (globalThis.__tmRuntimeState?.getTaskById?.(tid, { includePending: true, preferPending: true })
                || globalThis.__tmRuntimeState?.getFlatTaskById?.(tid)
                || state.pendingInsertedTasks?.[tid]
                || state.flatTasks?.[tid]);
        if (!task) return false;
        if (!__tmIsCollectedOtherBlockTask(task)) return true;
        try { hint(`⚠ ${actionLabel}暂不支持“${__TM_OTHER_BLOCK_TAB_NAME}”中的块，请回到原文档处理`, 'warning'); } catch (e) {}
        return false;
    }

    let __contextMenuUnstack = null;

    function __tmShowCollectedOtherBlockContextMenu(event, taskId) {
        const tid = String(taskId || '').trim();
        const task = __tmGetCollectedOtherBlockTaskFromState(tid);
        if (!tid || !task) return;

        const existingMenu = document.getElementById('tm-task-context-menu');
        if (existingMenu) existingMenu.remove();
        if (state.taskContextMenuCloseHandler) {
            try { __tmClearOutsideCloseHandler(state.taskContextMenuCloseHandler); } catch (e) {}
            state.taskContextMenuCloseHandler = null;
        }
        __contextMenuUnstack?.();
        __contextMenuUnstack = null;

        const menu = document.createElement('div');
        menu.id = 'tm-task-context-menu';
        menu.style.cssText = `
            position: fixed;
            top: ${event.clientY}px;
            left: ${event.clientX}px;
            display: inline-flex;
            flex-direction: column;
            align-items: stretch;
            background: var(--b3-theme-background);
            border: 1px solid var(--b3-theme-surface-light);
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            padding: 4px 0;
            z-index: 200000;
            min-width: 180px;
            box-sizing: border-box;
            user-select: none;
        `;

        const createItem = (label, onClick, isDanger = false) => {
            const item = document.createElement('div');
            const labelText = String(label || '');
            if (/<[a-z][\s\S]*>/i.test(labelText)) item.innerHTML = labelText;
            else item.textContent = labelText;
            item.style.cssText = `
                padding: 6px 10px;
                cursor: pointer;
                font-size: 13px;
                color: ${isDanger ? 'var(--b3-theme-error)' : 'var(--b3-theme-on-background)'};
                white-space: nowrap;
                width: 100%;
                box-sizing: border-box;
            `;
            item.onmouseenter = () => item.style.backgroundColor = 'var(--b3-theme-surface-light)';
            item.onmouseleave = () => item.style.backgroundColor = 'transparent';
            item.onclick = async (ev) => {
                try { ev.stopPropagation(); } catch (e) {}
                try { closeHandler(); } catch (e) {}
                await onClick?.();
            };
            return item;
        };

        const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
        const tomatoEnabled = !!SettingsStore.data.enableTomatoIntegration;
        const timer = tomatoEnabled ? globalThis.__tomatoTimer : null;
        const taskName = __tmNormalizeTimerTaskName(task?.otherBlockRawContent || task?.content || task?.markdown || '', '其他块');
        const createPriorityBlock = () => {
            const wrap = document.createElement('div');
            wrap.className = 'tm-task-context-priority';
            const title = document.createElement('div');
            title.className = 'tm-task-context-priority__title';
            title.textContent = '优先级';
            wrap.appendChild(title);
            const row = document.createElement('div');
            row.className = 'tm-task-context-priority__row';
            const currentKey = String(__tmGetPriorityJiraInfo(task?.priority || '')?.key || 'none').trim() || 'none';
            [
                { key: 'high', value: 'high' },
                { key: 'medium', value: 'medium' },
                { key: 'low', value: 'low' },
                { key: 'none', value: '' },
            ].forEach((opt) => {
                const info = __tmGetPriorityJiraInfo(opt.value);
                const key = String(opt.key || info?.key || 'none').trim() || 'none';
                const color = __tmGetPriorityAccentColor(key) || 'var(--tm-secondary-text)';
                const active = key === currentKey;
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `tm-task-context-priority__btn${active ? ' is-active' : ''}`;
                btn.style.setProperty('--tm-context-priority-color', color);
                btn.setAttribute('aria-label', `设置重要性为${info?.label || '无'}`);
                btn.setAttribute('aria-pressed', active ? 'true' : 'false');
                btn.title = info?.label || '无';
                btn.innerHTML = __tmRenderPriorityJira(opt.value, false);
                btn.onclick = async (e) => {
                    try { e.stopPropagation(); } catch (err) {}
                    try { e.preventDefault(); } catch (err) {}
                    btn.disabled = true;
                    const ok = await __tmSetCollectedOtherBlockPriority(task, opt.value);
                    if (ok) {
                        const label = opt.value === 'high' ? '高' : (opt.value === 'medium' ? '中' : (opt.value === 'low' ? '低' : '无'));
                        try { hint(`✅ 重要性已更新为${label}`, 'success'); } catch (err) {}
                        try { closeHandler(); } catch (err) {}
                    } else {
                        btn.disabled = false;
                    }
                };
                row.appendChild(btn);
            });
            wrap.appendChild(row);
            return wrap;
        };
        const runTaskTimer = async (minutes, mode = 'countdown') => {
            const timerTaskId = tid;
            const timerTaskName = String(taskName || '其他块').trim() || '其他块';
            state.timerFocusTaskId = timerTaskId;
            render();
            if (mode === 'stopwatch') {
                const startFromTaskBlock = timer?.startFromTaskBlock;
                const startStopwatch = timer?.startStopwatch;
                let p = null;
                if (typeof startFromTaskBlock === 'function') p = startFromTaskBlock(timerTaskId, timerTaskName, 0, 'stopwatch');
                else if (typeof startStopwatch === 'function') p = startStopwatch(timerTaskId, timerTaskName);
                else {
                    hint('⚠ 未检测到正计时功能，请确认番茄插件已启用', 'warning');
                    return;
                }
                if (p && typeof p.finally === 'function') {
                    p.finally(() => setTimeout(() => { try { timer?.refreshUI?.(); } catch (e) {} }, 150));
                } else {
                    setTimeout(() => { try { timer?.refreshUI?.(); } catch (e) {} }, 150);
                }
                return;
            }
            const safeMin = Math.max(1, Math.round(Number(minutes) || 0));
            const startFromTaskBlock = timer?.startFromTaskBlock;
            const startCountdown = timer?.startCountdown;
            let p = null;
            if (typeof startFromTaskBlock === 'function') p = startFromTaskBlock(timerTaskId, timerTaskName, safeMin, 'countdown');
            else if (typeof startCountdown === 'function') p = startCountdown(timerTaskId, timerTaskName, safeMin);
            else {
                await tmStartPomodoro(timerTaskId);
                return;
            }
            if (p && typeof p.finally === 'function') {
                p.finally(() => setTimeout(() => { try { timer?.refreshUI?.(); } catch (e) {} }, 150));
            } else {
                setTimeout(() => { try { timer?.refreshUI?.(); } catch (e) {} }, 150);
            }
        };

        if (tomatoEnabled && timer && typeof timer === 'object') {
            const durations = (() => {
                const list = timer?.getDurations?.();
                const arr = Array.isArray(list) ? list.map((n) => parseInt(n, 10)).filter((n) => Number.isFinite(n) && n > 0) : [];
                return arr.length > 0 ? arr.slice(0, 8) : [5, 15, 25, 30, 45, 60];
            })();
            const timerWrap = document.createElement('div');
            timerWrap.style.cssText = 'padding: 6px 10px 8px;';
            const title = document.createElement('div');
            title.textContent = '🍅 计时';
            title.style.cssText = 'font-size: 12px; opacity: 0.75; padding: 2px 0 6px;';
            timerWrap.appendChild(title);
            const btnRow = document.createElement('div');
            btnRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';
            durations.forEach((min) => {
                const b = document.createElement('button');
                b.className = 'tm-btn tm-btn-secondary';
                b.textContent = `${min}m`;
                b.style.cssText = 'padding: 2px 8px; font-size: 12px; line-height: 18px;';
                b.onclick = async (e) => {
                    e.stopPropagation();
                    await runTaskTimer(min, 'countdown');
                    try { closeHandler(); } catch (e2) {}
                };
                btnRow.appendChild(b);
            });
            const sw = document.createElement('button');
            sw.className = 'tm-btn tm-btn-secondary';
            sw.textContent = '⏱️ 正计时';
            sw.style.cssText = 'padding: 2px 8px; font-size: 12px; line-height: 18px;';
            sw.onclick = async (e) => {
                e.stopPropagation();
                await runTaskTimer(0, 'stopwatch');
                try { closeHandler(); } catch (e2) {}
            };
            btnRow.appendChild(sw);
            timerWrap.appendChild(btnRow);
            menu.appendChild(timerWrap);

            const hrTimer = document.createElement('hr');
            hrTimer.style.cssText = 'margin: 4px 0; border: none; border-top: 1px solid var(--b3-theme-surface-light);';
            menu.appendChild(hrTimer);

            if (state.timerFocusTaskId) {
                menu.appendChild(createItem(__tmRenderContextMenuLabel('circle-dot', '取消聚焦'), () => {
                    state.timerFocusTaskId = '';
                    render();
                }));
            }
        }

        menu.appendChild(createPriorityBlock());
        const hrPriority = document.createElement('hr');
        hrPriority.style.cssText = 'margin: 4px 0; border: none; border-top: 1px solid var(--b3-theme-surface-light);';
        menu.appendChild(hrPriority);

        menu.appendChild(createItem(__tmRenderContextMenuLabel('check-circle-2', task.done ? '取消完成（仅插件内）' : '标记完成（仅插件内）'), async () => {
            await tmSetDone(tid, !task.done);
        }));
        menu.appendChild(createItem(__tmRenderContextMenuLabel('pin', task.pinned ? '取消置顶' : '置顶'), async () => {
            await tmSetPinned(tid, !task.pinned);
        }));
        if (tomatoEnabled) {
            menu.appendChild(createItem(__tmRenderContextMenuLabel('alarm-clock', '提醒'), async () => {
                await tmReminder(tid);
            }));
        }
        if (globalThis.__tmCalendar && (typeof globalThis.__tmCalendar.openScheduleEditor === 'function' || typeof globalThis.__tmCalendar.openScheduleEditorById === 'function' || typeof globalThis.__tmCalendar.openScheduleEditorByTaskId === 'function')) {
            menu.appendChild(createItem(__tmRenderContextMenuLabel('calendar-days', '编辑日程'), async () => {
                await __tmOpenScheduleEditorForBlock(tid, null, { blockId: tid });
            }));
        }
        menu.appendChild(createItem(__tmRenderContextMenuLabel('map-pin', '跳转到原块'), async () => {
            try { await window.tmJumpToTask?.(tid); } catch (e) {}
        }));
        menu.appendChild(createItem(__tmRenderContextMenuLabel('trash-2', `从${__TM_OTHER_BLOCK_TAB_NAME}页签移除`), async () => {
            const result = await __tmRemoveOtherBlocksFromCollection([tid]);
            if (result.removed > 0) hint(`✅ 已从“${__TM_OTHER_BLOCK_TAB_NAME}”页签移除`, 'success');
        }, true));

        document.body.appendChild(menu);
        requestAnimationFrame(() => {
            try {
                const rect = menu.getBoundingClientRect();
                const vw = Math.max(0, window.innerWidth || document.documentElement.clientWidth || 0);
                const vh = Math.max(0, window.innerHeight || document.documentElement.clientHeight || 0);
                const margin = 8;
                let x = Number(event.clientX) || 0;
                let y = Number(event.clientY) || 0;
                if (x + rect.width > vw - margin) x = x - rect.width;
                if (y + rect.height > vh - margin) y = y - rect.height;
                x = clamp(x, margin, Math.max(margin, vw - rect.width - margin));
                y = clamp(y, margin, Math.max(margin, vh - rect.height - margin));
                menu.style.left = `${Math.round(x)}px`;
                menu.style.top = `${Math.round(y)}px`;
            } catch (e) {}
        });
        const closeHandler = (ev) => {
            try {
                if (menu.contains(ev?.target)) return;
            } catch (e) {}
            __contextMenuUnstack?.();
            __contextMenuUnstack = null;
            try { menu.remove(); } catch (e) {}
            try { __tmClearOutsideCloseHandler(closeHandler); } catch (e) {}
            if (state.taskContextMenuCloseHandler === closeHandler) state.taskContextMenuCloseHandler = null;
        };
        state.taskContextMenuCloseHandler = closeHandler;
        __contextMenuUnstack = __tmModalStackBind(closeHandler);
        __tmScheduleBindOutsideCloseHandler(closeHandler);
    }

    function __tmMergeVisibleDateFieldsFromPrevTask(task, prevTask) {
        if (!task || typeof task !== 'object' || !prevTask || typeof prevTask !== 'object') return task;
        const taskId = String(task.id || prevTask.id || '').trim();
        if (!__tmHasPendingVisibleDatePersistence(taskId)) return task;
        const isValidValue = (val) => val !== undefined && val !== null && val !== '' && val !== 'null';
        const aliasMap = {
            completionTime: 'completion_time',
            startDate: 'start_date',
            customTime: 'custom_time',
        };
        const readRecentPatchValue = (fieldKey) => {
            try {
                const watermark = __tmGetLocalTaskPatchWatermarkValue?.(taskId, fieldKey);
                if (watermark?.has === true) return watermark;
            } catch (e) {}
            try {
                const queuedPatch = __tmBuildQueuedTaskFieldPatchMap?.({ statuses: ['queued', 'running'] })?.get(taskId);
                if (queuedPatch && Object.prototype.hasOwnProperty.call(queuedPatch, fieldKey)) {
                    return { has: true, value: queuedPatch[fieldKey] };
                }
            } catch (e) {}
            return { has: false, value: undefined };
        };
        const applyRecentOrPrev = (fieldKey) => {
            const recent = readRecentPatchValue(fieldKey);
            if (recent.has === true) {
                const value = isValidValue(recent.value) ? String(recent.value) : '';
                task[fieldKey] = value;
                if (aliasMap[fieldKey]) task[aliasMap[fieldKey]] = value;
                return;
            }
            if (!isValidValue(task[fieldKey]) && isValidValue(prevTask[fieldKey])) {
                task[fieldKey] = String(prevTask[fieldKey]);
                if (aliasMap[fieldKey]) task[aliasMap[fieldKey]] = task[fieldKey];
            }
        };
        applyRecentOrPrev('completionTime');
        applyRecentOrPrev('startDate');
        applyRecentOrPrev('customTime');
        return task;
    }
