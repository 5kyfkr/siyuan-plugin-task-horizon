    function render() {
        try {
            const guardUntil = Number(state.__tmChecklistRenderGuardUntil || 0);
            const guardReason = String(state.__tmChecklistRenderGuardReason || '').trim();
            if (guardUntil && Date.now() < guardUntil && String(state.viewMode || '').trim() === 'checklist'
                && state.modal instanceof Element && document.body.contains(state.modal)) {
                state.__tmChecklistRenderGuardUntil = 0;
                state.__tmChecklistRenderGuardReason = '';
                try {
                    __tmPushRefreshDebug('render:checklist-guard-skip', {
                        guardReason,
                        now: Date.now(),
                        until: guardUntil,
                    });
                } catch (e) {}
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
        const currentRenderMode = state.homepageOpen ? 'home' : (String(state.viewMode || 'list').trim() || 'list');
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
        if (prevModalSnapshot) {
            prevModalEl = prevModalSnapshot;
            const docTabsPane = prevModalSnapshot.querySelector('.tm-doc-tabs-scroll');
            if (docTabsPane) savedDocTabsScrollLeft = Number(docTabsPane.scrollLeft) || 0;
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
        const visibleDocs = docsForTabs
            .filter((doc) => {
                const docId = String(doc?.id || '').trim();
                if (docId && activeDocId && activeDocId !== 'all' && docId === activeDocId) return true;
                return filteredDocIdSet.size ? filteredDocIdSet.has(docId) : __tmDocHasUndoneTasks(doc);
            })
            .filter(doc => !globalNewTaskDocId || doc.id !== globalNewTaskDocId);
        const showOtherBlocksTab = currentGroupId !== 'all' && Array.isArray(state.otherBlocks) && state.otherBlocks.length > 0;

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
        const managerIconTooltip = '全部页签，右击或长按隐藏/展开页签栏';
        const isAnimatedDockHost = !!(isDockHost && !isRuntimeMobile);
        const isSplitPane = false; // 使用CSS容器查询处理分屏模式
        const isLandscape = !!(isMobile && (() => { try { return !!window.matchMedia?.('(orientation: landscape)')?.matches; } catch (e) { return false; } })());
        const isDesktopNarrow = !!(!isMobile && (() => { try { return !!window.matchMedia?.('(max-width: 768px)')?.matches; } catch (e) { return false; } })());
        const kind = String(state.uiAnimKind || '').trim();
        const hasFreshUiAnim = (Date.now() - (Number(state.uiAnimTs) || 0) < 390);
        const bodyAnimClass = ((isMobile || hostUsesMobileUI) && !isAnimatedDockHost && hasFreshUiAnim)
            ? (kind === 'from-right' ? ' tm-body-anim--from-right' : kind === 'from-left' ? ' tm-body-anim--from-left' : ' tm-body-anim')
            : '';
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

        state.modal = document.createElement('div');
        state.modal.className = 'tm-modal'
            + (__tmMountEl ? ' tm-modal--tab' : '')
            + (isMobile ? ' tm-modal--mobile' : '')
            + (isRuntimeMobile ? ' tm-modal--runtime-mobile' : '')
            + (hostUsesMobileUI ? ' tm-modal--host-mobile-ui' : '')
            + (isSplitPane ? ' tm-modal--split-pane' : '')
            + (isDockHost ? ' tm-modal--dock' : '');
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

        const {
            renderMode,
            mainBodyHtml,
            showCalendarSideDock,
            showAiSideDock,
            calendarSideDockWidth,
            aiSideDockWidth,
            showWhiteboardMobileDetailSheet,
            whiteboardDetailTaskId,
            whiteboardDetailTask,
            whiteboardDetailHtml,
            showMobileBottomViewBar,
            mobileBottomViewbarActive,
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
            whiteboardMobileDetailSheetHtml,
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
        state.modal.innerHTML = `
            <div class="tm-box${showCalendarSideDock || showAiSideDock ? ' tm-box--with-cal-dock' : ''}">
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
                            ${isMobile && renderMode === 'timeline' ? timelineSidebarToggleButtonHtml : ''}
                            ${isMobile && renderMode === 'calendar' ? `<button class="tm-btn tm-btn-info bc-btn bc-btn--sm" onclick="tmCalendarToggleSidebar()" style="padding: 0 10px; height: 30px; display: inline-flex; align-items: center; justify-content: center;"${__tmBuildTooltipAttrs('日历侧边栏', { side: 'bottom' })}>${__tmRenderLucideIcon('calendar-days')}</button>` : ''}
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
                            ${!isMobile && renderMode === 'calendar' ? `<button class="tm-btn tm-btn-info tm-calendar-sidebar-toggle-compact bc-btn bc-btn--sm" onclick="tmCalendarToggleSidebar()" style="padding: 0; width: 30px; min-width: 30px; height: 30px; align-items: center; justify-content: center;"${__tmBuildTooltipAttrs('日历侧边栏', { side: 'bottom' })}>${__tmRenderLucideIcon('calendar-days')}</button>` : ''}

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
                            <div class="tm-view-segmented tm-kanban-mode-segmented bc-tabs-list" role="tablist" aria-label="看板模式">
                                <button class="tm-view-seg-item bc-tabs-trigger ${!SettingsStore.data.kanbanHeadingGroupMode ? 'tm-view-seg-item--active' : ''}" data-state="${!SettingsStore.data.kanbanHeadingGroupMode ? 'active' : 'inactive'}" onclick="tmSetKanbanHeadingGroupMode('status', event)" role="tab" aria-selected="${!SettingsStore.data.kanbanHeadingGroupMode ? 'true' : 'false'}"${__tmBuildTooltipAttrs('状态看板', { side: 'bottom', ariaLabel: false })}>状态</button>
                                <button class="tm-view-seg-item bc-tabs-trigger ${SettingsStore.data.kanbanHeadingGroupMode ? 'tm-view-seg-item--active' : ''}" data-state="${SettingsStore.data.kanbanHeadingGroupMode ? 'active' : 'inactive'}" onclick="tmSetKanbanHeadingGroupMode('heading', event)" role="tab" aria-selected="${SettingsStore.data.kanbanHeadingGroupMode ? 'true' : 'false'}"${__tmBuildTooltipAttrs('标题看板', { side: 'bottom', ariaLabel: false })}>标题</button>
                            </div>
                        ` : showWhiteboardAllTabsModeToggle ? `
                            <div class="tm-view-segmented tm-kanban-mode-segmented bc-tabs-list" role="tablist" aria-label="白板模式">
                                <button class="tm-view-seg-item bc-tabs-trigger ${whiteboardAllTabsLayoutMode !== 'stream' ? 'tm-view-seg-item--active' : ''}" data-state="${whiteboardAllTabsLayoutMode !== 'stream' ? 'active' : 'inactive'}" onclick="tmSetWhiteboardAllTabsLayoutMode('board', event)" role="tab" aria-selected="${whiteboardAllTabsLayoutMode !== 'stream' ? 'true' : 'false'}"${__tmBuildTooltipAttrs('白板', { side: 'bottom', ariaLabel: false })}>白板</button>
                                <button class="tm-view-seg-item bc-tabs-trigger ${whiteboardAllTabsLayoutMode === 'stream' ? 'tm-view-seg-item--active' : ''}" data-state="${whiteboardAllTabsLayoutMode === 'stream' ? 'active' : 'inactive'}" onclick="tmSetWhiteboardAllTabsLayoutMode('stream', event)" role="tab" aria-selected="${whiteboardAllTabsLayoutMode === 'stream' ? 'true' : 'false'}"${__tmBuildTooltipAttrs('卡片流', { side: 'bottom', ariaLabel: false })}>卡片流</button>
                            </div>
                        ` : ''}
                        ${showTopbarTimelineToolbar ? `
                            ${timelineCompactToolbarGroupHtml}
                        ` : ''}
                        ${!isMobile && renderMode === 'calendar' ? `<button class="tm-btn tm-btn-info bc-btn bc-btn--sm" onclick="tmCalendarToggleSidebar()" style="padding: 0; width: 30px; min-width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center;"${__tmBuildTooltipAttrs('日历侧边栏', { side: 'bottom' })}>${__tmRenderLucideIcon('calendar-days')}</button>` : ''}
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
                                <div class="tm-mobile-only-item" style="display:flex; flex-direction:column; gap:6px; align-items:stretch;">
                                    <span style="color:var(--tm-text-color);">看板模式:</span>
                                    <div class="tm-view-segmented tm-kanban-mode-segmented bc-tabs-list" role="tablist" aria-label="看板模式" style="width:100%;">
                                        <button class="tm-view-seg-item bc-tabs-trigger ${!SettingsStore.data.kanbanHeadingGroupMode ? 'tm-view-seg-item--active' : ''}" data-state="${!SettingsStore.data.kanbanHeadingGroupMode ? 'active' : 'inactive'}" onclick="tmSetKanbanHeadingGroupMode('status', event)" role="tab" aria-selected="${!SettingsStore.data.kanbanHeadingGroupMode ? 'true' : 'false'}" style="flex:1;line-height:30px;">状态</button>
                                        <button class="tm-view-seg-item bc-tabs-trigger ${SettingsStore.data.kanbanHeadingGroupMode ? 'tm-view-seg-item--active' : ''}" data-state="${SettingsStore.data.kanbanHeadingGroupMode ? 'active' : 'inactive'}" onclick="tmSetKanbanHeadingGroupMode('heading', event)" role="tab" aria-selected="${SettingsStore.data.kanbanHeadingGroupMode ? 'true' : 'false'}" style="flex:1;line-height:30px;">标题</button>
                                    </div>
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
                                ${renderMode === 'list' ? `
                                <div class="tm-mobile-only-item" style="display:flex; gap:10px; align-items:center;">
                                    <button class="tm-btn tm-btn-info bc-btn bc-btn--sm" onclick="tmExportCurrentTableExcel(); tmHideMobileMenu();" style="flex:1; padding: 6px;">
                                        <span style="display:inline-flex;align-items:center;gap:6px;">${__tmRenderLucideIcon('chart-column')}<span>导出 Excel</span></span>
                                    </button>
                                </div>
                                ` : ''}
                                <div class="tm-mobile-only-item" style="display:flex; gap:10px; align-items:center;">
                                    <button class="tm-btn tm-btn-info bc-btn bc-btn--sm" onclick="window.tmAiSemanticCompletionPreview?.(); tmHideMobileMenu();" style="flex:1; padding: 6px;">
                                        <span style="display:inline-flex;align-items:center;gap:6px;">${__tmRenderLucideIcon('calendar-days')}<span>语义日期</span></span>
                                    </button>
                                </div>
                                <div class="tm-mobile-only-item" style="display:flex; gap:10px; align-items:center;">
                                    <div class="tm-btn tm-btn-info bc-btn bc-btn--sm" style="flex:1; padding: 6px 10px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
                                        <span>多选模式</span>
                                        <input class="b3-switch fn__flex-center" type="checkbox" ${state.multiSelectModeEnabled ? 'checked' : ''} onchange="tmToggleMultiSelectMode(this.checked); tmHideMobileMenu();">
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
                                    <div class="tm-btn tm-btn-info bc-btn bc-btn--sm" style="flex:1; padding: 6px 10px; display:flex; align-items:center; justify-content:space-between; gap:10px; opacity:.6; cursor:not-allowed;" title="移动端不启用日历侧边栏" aria-disabled="true">
                                        <span>日历侧边栏（移动端关闭）</span>
                                        <input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.calendarSideDockEnabled ? 'checked' : ''} disabled>
                                    </div>
                                </div>
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

                <div class="tm-doc-tabs ${state.docTabsHidden ? 'tm-doc-tabs--hidden' : ''}"
                    ondragenter="tmDocTabDragEnter(event)"
                     ondragleave="tmDocTabDragLeave(event)"
                     ondragover="tmDocTabDragOver(event)"
                     ondrop="tmDocTabDrop(event, '')">
                    <div class="tm-doc-tabs-scroll" style="display:flex; gap:8px; overflow-x:auto; flex:1; align-items:center; padding: ${isMobile ? '4px 0 4px 0' : '4px 0 4px 0'};" ondragover="tmDocTabDragOver(event)" ondrop="tmDocTabDrop(event, '')">
                        <div class="tm-doc-tab tm-doc-tab--all ${state.activeDocId === 'all' ? 'active' : ''}" onclick="tmHandleAllDocTabClick(event)" oncontextmenu="tmShowAllDocTabContextMenu(event)"${__tmBuildTooltipAttrs(`${__tmGetViewProfileSourceLabel(__tmGetEffectiveViewProfileForContext('all', currentGroupId).source)}: ${__tmDescribeViewProfile(__tmGetEffectiveViewProfileForContext('all', currentGroupId).profile)} ｜ 右键或长按查看当前分组全部页签`, { side: 'bottom', ariaLabel: false })}>全部</div>
                        ${(() => {
                            const id = String(SettingsStore.data.newTaskDocId || '').trim();
                            if (__tmIsDocExcludedInGroup(id, currentGroupId)) return '';
                            if (!id || id === '__dailyNote__') return '';
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
                            const tip = `${nameTip}全局新建文档 ｜ ${source}: ${__tmDescribeViewProfile(p)}${expectedTip ? ` ｜ 预期进度: ${expectedTip}` : ''}`;
                            setTimeout(() => __tmUpdateDocTabProgress(id, '', expectedPid), 0);
                            return `<div class="tm-doc-tab ${isActive ? 'active' : ''}" data-tm-doc-id="${esc(id)}" style="--tm-doc-color:${esc(c)}" oncontextmenu="tmShowDocTabContextMenu(event, '${id}')" onclick="tmSwitchDoc('${id}')"${__tmBuildTooltipAttrs(tip, { side: 'bottom', ariaLabel: false })}><div class="tm-doc-tab-expected${expectedPercent == null ? '' : ' is-visible'}" id="${expectedPid}" style="width:${expectedPercent || 0}%"></div><div class="tm-doc-tab-text">${__tmRenderDocIcon(id, { fallbackText: '📥', size: 14 })}<span>${esc(docName)}</span></div></div>`;
                        })()}
                        ${showOtherBlocksTab ? (() => {
                            const isActive = __tmIsOtherBlockTabId(state.activeDocId);
                            const c = __tmGetDocColorHex(__TM_OTHER_BLOCK_TAB_ID, __tmIsDarkMode());
                            const profile = __tmGetStoredDocViewProfile(__TM_OTHER_BLOCK_TAB_ID) || __tmGetStoredGroupViewProfile(currentGroupId) || __tmGetViewProfilesStore().global;
                            const profileSource = __tmGetStoredDocViewProfile(__TM_OTHER_BLOCK_TAB_ID) ? '页签自定义' : (__tmGetStoredGroupViewProfile(currentGroupId) ? '分组默认' : '全局默认');
                            const tip = `${profileSource}: ${__tmDescribeViewProfile(profile)}`;
                            return `<div class="tm-doc-tab ${isActive ? 'active' : ''}" data-tm-doc-id="${esc(__TM_OTHER_BLOCK_TAB_ID)}" style="--tm-doc-color:${esc(c)}" onclick="tmSwitchDoc('${__TM_OTHER_BLOCK_TAB_ID}')" oncontextmenu="tmShowDocTabContextMenu(event, '${__TM_OTHER_BLOCK_TAB_ID}')"${__tmBuildTooltipAttrs(tip, { side: 'bottom', ariaLabel: false })}>🧩 ${esc(__TM_OTHER_BLOCK_TAB_NAME)}</div>`;
                        })() : ''}
                        ${visibleDocs.map(doc => {
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
                            const profileTipOneLine = profileTip.replace(/\s*\n+\s*/g, ' ｜ ');
                            // 预设宽度（如果缓存有值，直接渲染，减少闪烁）
                            const cachedPercent = __tmDocProgressCache?.get(doc.id) || 0;
                            // 调度异步更新
                            setTimeout(() => __tmUpdateDocTabProgress(doc.id, pid, expectedPid), 0);
                            const iconHtml = __tmRenderDocIcon(doc, { size: 14 });
                            return `<div class="tm-doc-tab ${isActive ? 'active' : ''}"
                                data-tm-doc-id="${esc(doc.id)}"
                                style="--tm-doc-color:${esc(c)}"
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
                    </div>
                    <div style="border-left:1px solid var(--tm-border-color); padding-left:8px; margin-left:8px; display:none; gap:8px;">
                         ${!isMobile ? `` : ''}
                    </div>
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
                        overflow: visible;
                        transition: max-height 0.18s ease, opacity 0.18s ease, border-color 0.18s ease, padding-top 0.18s ease, padding-bottom 0.18s ease;
                        opacity: 1;
                        position: relative;
                        z-index: 1;
                    }
                    .tm-doc-tabs-scroll {
                        min-width: 0;
                        width: 100%;
                        justify-content: flex-start;
                    }
                    .tm-box--with-cal-dock .tm-doc-tabs {
                        flex: 0 0 auto;
                        max-height: 56px;
                        overflow: visible;
                        position: relative;
                        z-index: 1;
                    }
                    .tm-doc-tabs.tm-doc-tabs--hidden {
                        max-height: 0;
                        opacity: 0;
                        border-bottom-color: transparent;
                        padding-top: 0;
                        padding-bottom: 0;
                        pointer-events: none;
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
                        padding: 2px 8px;
                        border-radius: 6px;
                        background: var(--tm-bg-color);
                        color: var(--tm-text-color);
                        font-size: 13px;
                        cursor: pointer;
                        white-space: nowrap;
                        flex: 0 0 auto;
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
                    .tm-doc-tab:hover {
                        background: var(--tm-hover-bg);
                        border-color: var(--tm-text-color);
                    }
                    .tm-doc-tab.active {
                        background: var(--tm-bg-color);
                        color: var(--tm-text-color);
                        border-color: var(--tm-primary-color);
                        box-shadow: inset 0 0 0 1px var(--tm-primary-color), 0 0 0 1px color-mix(in srgb, var(--tm-primary-color) 18%, transparent);
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
                        display: none !important;
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
                </div>
                ${whiteboardMobileDetailSheetHtml}
                ${showMobileBottomViewBar ? `
                    <div class="tm-mobile-bottom-viewbar ${mobileBottomViewbarActive ? 'tm-mobile-bottom-viewbar--active' : ''}" onpointerdown="tmTouchMobileBottomViewbar(event)" onclick="tmTouchMobileBottomViewbar(event)">
                        <div class="tm-mobile-bottom-viewbar__inner">
                            <div class="tm-view-segmented bc-tabs-list tm-mobile-bottom-view-switcher" role="tablist" aria-label="视图">
                                ${__tmRenderViewSwitcherButtons({ compact: true })}
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
        try { __tmSyncInlineLoadingOverlay(state.modal); } catch (e) {}
        try { __tmBindDockScrollIsolation(state.modal); } catch (e) {}
        try { __tmBindTopbarOverflowTooltips(state.modal); } catch (e) {}
        try { __tmBindResponsiveTableResize(state.modal); } catch (e) {}
        try { __tmBindFloatingTooltips(state.modal); } catch (e) {}
        try { __tmBindDocTabWheelScroll(state.modal); } catch (e) {}
        try { __tmBindBottomViewbarWheelScroll(state.modal); } catch (e) {}
        try { __tmBindDocTabScrollMemory(state.modal); } catch (e) {}
        try { __tmRestoreDocTabScroll(state.modal, savedDocTabsScrollLeft); } catch (e) {}
        try { __tmBindMultiSelectPointerSweep(state.modal); } catch (e) {}
        try {
            if (renderMode === 'whiteboard' && typeof __tmUpdateWhiteboardNavigator === 'function') {
                __tmUpdateWhiteboardNavigator();
            }
        } catch (e) {}
        try { __tmBindDockPointerTaskDrag(state.modal); } catch (e) {}
        try { if (renderMode === 'list') __tmBindListScrollVisibility(state.modal); } catch (e) {}
        try { if (renderMode === 'checklist') __tmBindChecklistScrollVisibility(state.modal); } catch (e) {}
        try { if (renderMode === 'list') __tmBindAutoLoadMoreOnScroll(state.modal, 'list'); } catch (e) {}
        try { if (renderMode === 'checklist') __tmBindAutoLoadMoreOnScroll(state.modal, 'checklist'); } catch (e) {}
        try { __tmBindMobileViewportAutoRefresh(state.modal); } catch (e) {}
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
                            if (!__tmRefreshChecklistSelectionInPlace(state.modal, 'detail-close')) render();
                        }
                    });
                    try { __tmPushRefreshDebug('render-checklist-post-bind:bind-detail', { selectedId }); } catch (e) {}
                }
            }
        } catch (e) {}
        try { __tmApplyReminderTaskNameMarks(state.modal); } catch (e) {}
        try { __tmScheduleReminderTaskNameMarksRefresh(state.modal); } catch (e) {}
        try { __tmApplyTodayScheduledTaskNameMarks(state.modal); } catch (e) {}
        try { __tmScheduleTodayScheduledTaskNameMarksRefresh(state.modal); } catch (e) {}
        try {
            if (renderMode === 'calendar') {
                const el = state.modal.querySelector('#tmCalendarRoot');
                if (el) {
                    if (!SettingsStore.data.calendarEnabled) {
                        el.innerHTML = `<div style="padding:12px;color:var(--tm-secondary-text);">日历视图已关闭，可在设置 → 日历中开启。</div>`;
                    } else if (globalThis.__tmCalendar && typeof globalThis.__tmCalendar.mount === 'function') {
                        const ok = globalThis.__tmCalendar.mount(el, { settingsStore: SettingsStore });
                        if (!ok) {
                            el.innerHTML = `<div style="padding:12px;color:var(--tm-secondary-text);">日历初始化失败，请确认 FullCalendar 已加载。</div>`;
                        }
                    } else {
                        el.innerHTML = `<div style="padding:12px;color:var(--tm-secondary-text);">日历模块未加载。</div>`;
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
                            const startDate = String(patch?.startDate || '').trim();
                            const completionTime = String(patch?.completionTime || '').trim();
                            const nextStart = startDate ? __tmNormalizeDateOnly(startDate) : '';
                            const nextEnd = completionTime ? __tmNormalizeDateOnly(completionTime) : '';
                            task.startDate = nextStart;
                            task.completionTime = nextEnd;
                            try {
                                await __tmPersistMetaAndAttrsAsync(id, { startDate: nextStart, completionTime: nextEnd }, { background: true, skipFlush: true });
                            } catch (e) {
                                hint(`❌ 更新失败: ${e.message}`, 'error');
                            }
                            __tmRefreshMainViewInPlace({ withFilters: true });
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
                                await __tmPersistMetaAndAttrsAsync(id, { milestone: val ? '1' : '' }, { background: true, skipFlush: true });
                            } catch (e) {
                                hint(`❌ 更新失败: ${e.message}`, 'error');
                            }
                            __tmRefreshMainViewInPlace({ withFilters: true });
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
                    try { __tmRunFlipAnimation(state.modal); } catch (e) {}

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
                            try { __tmSyncTimelineMobileGroupStickyOffset(state.modal); } catch (e) {}
                        };
                        try { syncMobileGroupX(); } catch (e) {}
                        try { timelineScrollHost?.addEventListener('scroll', syncMobileGroupX, { passive: true }); } catch (e) {}
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
                        try { __tmRunFlipAnimation(state.modal); } catch (e) {}
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
                    const apply = () => {
                        try { if (kbBody) kbBody.scrollLeft = kanbanLeft; } catch (e) {}
                        try {
                            state.modal.querySelectorAll('.tm-kanban-col').forEach((col) => {
                                const colKey = __tmGetKanbanColScrollKey(col);
                                if (!colKey) return;
                                const colBody = col.querySelector('.tm-kanban-col-body');
                                if (!(colBody instanceof HTMLElement)) return;
                                const status = String(col.getAttribute('data-status') || '').trim();
                                const legacyKey = status || '';
                                const top = pickNum(kanbanCols[colKey], pickNum(kanbanCols[legacyKey], 0));
                                colBody.scrollTop = top;
                            });
                        } catch (e) {}
                    };
                    apply();
                    try { __tmRefreshKanbanDetailInPlace(state.modal, { scrollSnapshot: savedKanbanDetailScrollSnapshot, source: 'render-kanban-post-bind' }); } catch (e) {}
                    requestAnimationFrame(() => requestAnimationFrame(apply));
                    requestAnimationFrame(() => requestAnimationFrame(() => {
                        try { __tmRefreshKanbanDetailInPlace(state.modal, { scrollSnapshot: savedKanbanDetailScrollSnapshot, source: 'render-kanban-post-raf' }); } catch (e) {}
                        try { __tmRunFlipAnimation(state.modal); } catch (e) {}
                        if (useSoftSwap) {
                            try { state.modal.style.opacity = '1'; } catch (e) {}
                            try { state.modal.style.pointerEvents = ''; } catch (e) {}
                            if (prevModalEl) {
                                setTimeout(() => { try { prevModalEl.remove(); } catch (e2) {} }, 340);
                            }
                        }
                    }));
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
                        try { __tmRunFlipAnimation(state.modal); } catch (e) {}
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
                        try { __tmRunFlipAnimation(state.modal); } catch (e) {}
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
                         try { __tmRunFlipAnimation(state.modal); } catch (e) {}
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
        const prevDoneOnly = !!state.__tmQueryDoneOnly;
        const nextRule = ruleId ? state.filterRules.find(r => r.id === ruleId) : null;
        const nextDoneOnly = __tmRuleNeedsDoneOnly(nextRule);
        state.__tmQueryDoneOnly = nextDoneOnly;
        const nextCustomFieldPlan = __tmBuildRuntimeCustomFieldLoadPlan({ rule: nextRule });
        if (prevDoneOnly !== nextDoneOnly || __tmDoesCustomFieldPlanNeedReload(prevCustomFieldPlan, nextCustomFieldPlan)) {
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
        const prevDoneOnly = !!state.__tmQueryDoneOnly;
        state.currentRule = null;
        SettingsStore.data.currentRule = null;
        __tmPersistGlobalViewProfileFromCurrentState();
        await SettingsStore.save();
        state.__tmQueryDoneOnly = false;
        const nextCustomFieldPlan = __tmBuildRuntimeCustomFieldLoadPlan({ rule: null });
        if (prevDoneOnly || __tmDoesCustomFieldPlanNeedReload(prevCustomFieldPlan, nextCustomFieldPlan)) {
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
            const cols = modal.querySelectorAll('.tm-kanban-col.tm-kanban-col--dragover');
            cols.forEach(el => { try { el.classList.remove('tm-kanban-col--dragover'); } catch (e) {} });
        } catch (e) {}
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

    window.tmKanbanToggleCollapse = function(id, ev) {
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}
        const tid = String(id || '').trim();
        if (!tid) return;
        const s = __tmKanbanGetCollapsedSet();
        if (s.has(tid)) s.delete(tid);
        else s.add(tid);
        __tmKanbanPersistCollapsed();
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

    function __tmKanbanCollectDescendantIds(rootId) {
        const id0 = String(rootId || '').trim();
        if (!id0) return [];
        const out = [];
        const seen = new Set();
        const walk = (id) => {
            const tid = String(id || '').trim();
            if (!tid || seen.has(tid)) return;
            seen.add(tid);
            out.push(tid);
            const t = globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid];
            const kids = Array.isArray(t?.children) ? t.children : [];
            kids.forEach(k => walk(k?.id));
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
        if (!did || !hid) return { matched: false, nextID: '', appendToBottom: false, heading: null };
        try { await __tmWarmKanbanDocHeadings([did]); } catch (e) {}
        const levelHeadings = Array.isArray(state.kanbanDocHeadingsByDocId?.[did]) ? state.kanbanDocHeadingsByDocId[did] : [];
        const headingMeta = levelHeadings.find((item) => String(item?.id || '').trim() === hid) || null;
        let km = '';
        try { km = await API.getBlockKramdown(did); } catch (e) { km = ''; }
        if (!km) {
            return { matched: false, nextID: '', appendToBottom: false, heading: headingMeta };
        }
        const headings = __tmParseHeadingBlocksFromKramdown(km);
        const currentIndex = headings.findIndex((item) => String(item?.id || '').trim() === hid);
        if (currentIndex < 0) {
            return { matched: false, nextID: '', appendToBottom: false, heading: headingMeta };
        }
        const currentHeading = headings[currentIndex];
        let nextID = '';
        for (let i = currentIndex + 1; i < headings.length; i += 1) {
            nextID = String(headings[i]?.id || '').trim();
            if (nextID) break;
        }
        return {
            matched: true,
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
        const perDocLimit = Number.isFinite(Number(SettingsStore.data?.queryLimit))
            ? Math.max(1, Math.min(5000, Math.round(Number(SettingsStore.data.queryLimit))))
            : 500;
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
            const totalLimit = Math.max(perDocLimit, Math.min(500000, batch.length * perDocLimit));
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
                try { await API.deleteBlock(bid); } catch (e) {}
            }
        }
    }

    window.tmKanbanDragStart = function(ev, id) {
        try { ev.stopPropagation(); } catch (e) {}
        const taskId = String(id || '').trim();
        if (!taskId) return;
        state.draggingTaskId = taskId;
        try { __tmSetCalendarSideDockDragHidden(true); } catch (e) {}
        try { ev.dataTransfer.effectAllowed = 'move'; } catch (e) {}
        try { ev.dataTransfer.setData('application/x-tm-task-id', taskId); } catch (e) {}
        try { ev.dataTransfer.setData('text/plain', taskId); } catch (e) {}
        try {
            const meta = (typeof window.tmCalendarGetTaskDragMeta === 'function') ? window.tmCalendarGetTaskDragMeta(taskId) : null;
            const payload = {
                taskId,
                id: taskId,
                title: String(meta?.title || globalThis.__tmRuntimeState?.getFlatTaskById?.(taskId)?.content || state.flatTasks?.[taskId]?.content || '').trim(),
                durationMin: Number(meta?.durationMin) || 60,
                calendarId: String(meta?.calendarId || '').trim(),
                startDate: String(meta?.startDate || '').trim(),
                completionTime: String(meta?.completionTime || '').trim(),
            };
            ev.dataTransfer.setData('application/x-tm-task', JSON.stringify(payload));
        } catch (e) {}
        state.__tmKanbanDragId = taskId;
        state.__tmKanbanDragIds = [taskId];
        try { ev.currentTarget?.classList?.add?.('tm-kanban-card--dragging'); } catch (e) {}
        try {
            const meta = (typeof window.tmCalendarGetTaskDragMeta === 'function') ? window.tmCalendarGetTaskDragMeta(taskId) : null;
            __tmCalendarFloatingDragStart(taskId, meta, ev);
        } catch (e) {}

        if (!SettingsStore.data.kanbanDragSyncSubtasks) {
            try {
                const target = ev.currentTarget;
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
        state.draggingTaskId = '';
        try { __tmClearDocTabDropTarget(); } catch (e) {}
        try { __tmSetCalendarSideDockDragHidden(false); } catch (e) {}
        try { __tmCalendarFloatingDragEnd(); } catch (e) {}
        try { delete state.__tmKanbanDragId; } catch (e) {}
        try { delete state.__tmKanbanDragIds; } catch (e) {}
        __tmKanbanClearDragOver();
    };

    window.tmKanbanDragOver = function(ev) {
        try { ev.preventDefault(); } catch (e) {}
        try { ev.dataTransfer.dropEffect = 'move'; } catch (e) {}
        const col = ev?.target instanceof Element ? ev.target.closest('.tm-kanban-col') : null;
        if (!col) return;
        try {
            if (!col.classList.contains('tm-kanban-col--dragover')) {
                __tmKanbanClearDragOver();
                col.classList.add('tm-kanban-col--dragover');
            }
        } catch (e) {}
    };

    window.tmKanbanDragLeave = function(ev) {
        const col = ev?.target instanceof Element ? ev.target.closest('.tm-kanban-col') : null;
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

    window.tmKanbanAutoScroll = function(ev) {
        try { ev.preventDefault(); } catch (e) {}
        const modal = state.modal;
        if (!modal) return;
        const body = modal.querySelector('.tm-body.tm-body--kanban');
        if (!body) return;
        const rect = body.getBoundingClientRect();
        const x = ev.clientX;
        const y = ev.clientY;
        const edge = 48;
        const speed = 18;

        const dx = x < rect.left + edge ? -speed : x > rect.right - edge ? speed : 0;
        const dy = y < rect.top + edge ? -speed : y > rect.bottom - edge ? speed : 0;
        if (!dx && !dy) return;

        const prevTs = Number(state.__tmKanbanAutoScrollTs) || 0;
        const now = Date.now();
        if (now - prevTs < 16) return;
        state.__tmKanbanAutoScrollTs = now;

        try { if (dx) body.scrollLeft += dx; } catch (e) {}
        try {
            if (dy) {
                const col = ev?.target instanceof Element ? ev.target.closest('.tm-kanban-col') : null;
                const colBody = col?.querySelector?.('.tm-kanban-col-body');
                if (colBody) colBody.scrollTop += dy;
            }
        } catch (e) {}
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
        ghost.style.zIndex = '200030';
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

    function __tmStopKanbanMomentum() {
        const rafId = Number(state.__tmKanbanMomentumRaf) || 0;
        if (rafId) {
            try { cancelAnimationFrame(rafId); } catch (e) {}
        }
        state.__tmKanbanMomentumRaf = 0;
    }

    function __tmStartKanbanMomentum(bodyEl, initialVelocity) {
        if (!(bodyEl instanceof HTMLElement)) return;
        __tmStopKanbanMomentum();
        let velocity = Number(initialVelocity) || 0;
        if (!Number.isFinite(velocity) || Math.abs(velocity) < 0.08) return;
        const frictionPerFrame = 0.90;
        const stopVelocity = 0.02;
        let lastTs = 0;
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
                __tmStopKanbanMomentum();
                return;
            }
            state.__tmKanbanMomentumRaf = requestAnimationFrame(step);
        };
        state.__tmKanbanMomentumRaf = requestAnimationFrame(step);
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
        const cardEl = ev?.currentTarget instanceof HTMLElement
            ? ev.currentTarget
            : (ev?.target instanceof Element ? ev.target.closest('.tm-kanban-card[data-id]') : null);
        if (!(cardEl instanceof HTMLElement)) return;
        const bodyEl = state.modal?.querySelector?.('.tm-body.tm-body--kanban');
        if (!(bodyEl instanceof HTMLElement)) return;
        const colBodyEl = cardEl.closest('.tm-kanban-col')?.querySelector?.('.tm-kanban-col-body');
        const taskId = String(id || cardEl.getAttribute('data-id') || '').trim();
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
        const longPressIntentThreshold = 12;
        const axisLockRatio = 0.85;
        const longPressMs = 340;
        const longPressMoveTolerance = 14;
        const floatingMiniRevealDistance = 20;
        const floatingMiniRevealDelayMs = 120;
        const pointerId = Number.isFinite(Number(ev?.pointerId)) ? Number(ev.pointerId) : null;
        const startX = Number(ev?.clientX) || 0;
        const startY = Number(ev?.clientY) || 0;
        const baseScrollLeft = Number(bodyEl.scrollLeft || 0);
        const baseColScrollTop = colBodyEl instanceof HTMLElement ? Number(colBodyEl.scrollTop || 0) : 0;
        let lastX = startX;
        let lastY = startY;
        let mode = 'pending';
        let ended = false;
        let captured = false;
        let longPressTimer = null;
        let ghostMeta = null;
        let colBodyUserSelectTouched = false;
        let panVelocity = 0;
        let lastPanScrollLeft = baseScrollLeft;
        let lastPanTs = 0;
        let dragStartedAt = 0;
        let dragStartX = NaN;
        let dragStartY = NaN;
        let floatingMiniVisible = false;
        let floatingMiniRevealTimer = null;
        const preventTouchGestureScroll = (e2) => {
            if (ended || (mode !== 'drag' && mode !== 'pan' && mode !== 'scroll')) return;
            try { e2?.preventDefault?.(); } catch (e3) {}
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

        const canPan = () => (bodyEl.scrollWidth - bodyEl.clientWidth) > 2;
        const canScrollCol = () => (
            colBodyEl instanceof HTMLElement
            && (colBodyEl.scrollHeight - colBodyEl.clientHeight) > 2
        );

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

        const startPan = () => {
            if (mode !== 'pending' || ended) return;
            mode = 'pan';
            cancelLongPress();
            capturePointer();
            panVelocity = 0;
            lastPanScrollLeft = Number(bodyEl.scrollLeft || 0);
            lastPanTs = 0;
            setGestureActiveStyles();
        };

        const startScroll = () => {
            if (mode !== 'pending' || ended) return;
            mode = 'scroll';
            cancelLongPress();
            capturePointer();
            setGestureActiveStyles();
        };

        const startDrag = () => {
            if (mode !== 'pending' || ended) return;
            mode = 'drag';
            cancelLongPress();
            capturePointer();
            cancelFloatingMiniStart();
            setGestureActiveStyles();
            state.draggingTaskId = taskId;
            state.__tmKanbanDragId = taskId;
            state.__tmKanbanDragIds = [taskId];
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
            const dropHost = pointTarget?.closest?.('.tm-kanban-group-title, .tm-kanban-group, .tm-kanban-col') || null;
            if (!(dropHost instanceof Element)) return;
            try {
                const ret = window.tmKanbanDrop?.({
                    preventDefault() {},
                    stopPropagation() {},
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
            if (String(state.draggingTaskId || '').trim() === taskId) state.draggingTaskId = '';
            try { delete state.__tmKanbanDragId; } catch (e2) {}
            try { delete state.__tmKanbanDragIds; } catch (e2) {}
            if (mode === 'pan' || mode === 'scroll' || mode === 'drag') {
                state.__tmKanbanPanSuppressClickUntil = Date.now() + suppressClickMs;
            }
            try { bodyEl.style.cursor = ''; } catch (e2) {}
            try { bodyEl.style.userSelect = ''; } catch (e2) {}
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
                updateDragFeedback(lastX, lastY);
                try { e2.preventDefault(); } catch (e3) {}
                return;
            }
            if (mode === 'pan') {
                const maxLeft = Math.max(0, bodyEl.scrollWidth - bodyEl.clientWidth);
                const nextLeft = clamp0(baseScrollLeft - dx, 0, maxLeft);
                bodyEl.scrollLeft = nextLeft;
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
            if (mode === 'scroll') {
                if (!(colBodyEl instanceof HTMLElement)) return;
                const maxTop = Math.max(0, colBodyEl.scrollHeight - colBodyEl.clientHeight);
                colBodyEl.scrollTop = clamp0(baseColScrollTop - dy, 0, maxTop);
                try { e2.preventDefault(); } catch (e3) {}
                return;
            }
            const absX = Math.abs(dx);
            const absY = Math.abs(dy);
            const effectivePanThreshold = longPressTimer ? Math.max(panThreshold, longPressIntentThreshold) : panThreshold;
            const effectiveScrollThreshold = longPressTimer ? Math.max(scrollThreshold, longPressIntentThreshold) : scrollThreshold;
            const horizontalIntent = absX >= effectivePanThreshold && (absY <= 0.5 || absX >= (absY * axisLockRatio));
            const verticalIntent = absY >= effectiveScrollThreshold && (absX <= 0.5 || absY >= (absX * axisLockRatio));
            if (horizontalIntent && canPan()) {
                startPan();
                const maxLeft = Math.max(0, bodyEl.scrollWidth - bodyEl.clientWidth);
                const nextLeft = clamp0(baseScrollLeft - dx, 0, maxLeft);
                bodyEl.scrollLeft = nextLeft;
                lastPanTs = getGestureTs(e2);
                lastPanScrollLeft = nextLeft;
                try { e2.preventDefault(); } catch (e3) {}
                return;
            }
            if (verticalIntent && canScrollCol()) {
                startScroll();
                if (colBodyEl instanceof HTMLElement) {
                    const maxTop = Math.max(0, colBodyEl.scrollHeight - colBodyEl.clientHeight);
                    colBodyEl.scrollTop = clamp0(baseColScrollTop - dy, 0, maxTop);
                }
                try { e2.preventDefault(); } catch (e3) {}
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
            if (finalMode === 'pan') __tmStartKanbanMomentum(bodyEl, finalPanVelocity);
        };

        longPressTimer = setTimeout(() => startDrag(), longPressMs);
        state.__tmKanbanCardGestureCleanup = cleanup;
        try { document.addEventListener('pointermove', onMove, true); } catch (e2) {}
        try { document.addEventListener('pointerup', onUp, true); } catch (e2) {}
        try { document.addEventListener('pointercancel', onUp, true); } catch (e2) {}
        try { window.addEventListener('touchmove', preventTouchGestureScroll, { capture: true, passive: false }); } catch (e2) {}
        try { window.addEventListener('pointermove', preventTouchGestureScroll, { capture: true, passive: false }); } catch (e2) {}
        try { window.addEventListener('blur', onUp, true); } catch (e2) {}
    };

    function __tmBindKanbanPan(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!modal) return;
        const bodyEl = modal.querySelector('.tm-body.tm-body--kanban');
        if (!bodyEl) return;
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
            if ((bodyEl.scrollWidth - bodyEl.clientWidth) <= 2) return;
            __tmClearKanbanCardGesture();
            __tmStopKanbanMomentum();

            const startX = e.clientX;
            const startY = e.clientY;
            const baseScrollLeft = bodyEl.scrollLeft;
            let active = false;
            let ended = false;
            let captured = false;
            let panVelocity = 0;
            let lastPanScrollLeft = baseScrollLeft;
            let lastPanTs = 0;
            const threshold = 6;
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
                if (captured && Number.isFinite(Number(e?.pointerId)) && typeof bodyEl.releasePointerCapture === 'function') {
                    try { bodyEl.releasePointerCapture(e.pointerId); } catch (e2) {}
                }
                if (active) state.__tmKanbanPanSuppressClickUntil = Date.now() + suppressClickMs;
                try { bodyEl.style.cursor = ''; } catch (e2) {}
                try { bodyEl.style.userSelect = ''; } catch (e2) {}
            };

            const onWinMove = (ev) => {
                if (ended) return;
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;
                if (!active) {
                    if (Math.abs(dx) < threshold) return;
                    if (Math.abs(dx) <= Math.abs(dy)) return;
                    active = true;
                    if (Number.isFinite(Number(e?.pointerId)) && typeof bodyEl.setPointerCapture === 'function') {
                        try {
                            bodyEl.setPointerCapture(e.pointerId);
                            captured = true;
                        } catch (e2) {}
                    }
                    try { bodyEl.style.cursor = 'grabbing'; } catch (e2) {}
                    try { bodyEl.style.userSelect = 'none'; } catch (e2) {}
                }
                const maxLeft = Math.max(0, bodyEl.scrollWidth - bodyEl.clientWidth);
                const nextLeft = clamp0(baseScrollLeft - dx, 0, maxLeft);
                bodyEl.scrollLeft = nextLeft;
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
                if (shouldMomentum) __tmStartKanbanMomentum(bodyEl, finalPanVelocity);
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
            if (isDoneCol) {
                const result = await __tmMutationEngine.requestTaskPatchBatch(ids, (id) => {
                    const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(String(id || '').trim()) || state.flatTasks?.[String(id || '').trim()] || null;
                    if (task && !!task.done) return {};
                    return { done: true };
                }, {
                    source: 'kanban-drop-status',
                    label: '完成状态',
                    reason: 'kanban-drop-status',
                    suppressHint: true,
                });
                if (Number(result?.failureCount) > 0) {
                    hint(`⚠ 批量更新完成状态存在失败项（${Number(result?.failureCount) || 0}）`, 'warning');
                }
            } else {
                const result = await __tmMutationEngine.requestTaskPatchBatch(ids, { customStatus: st }, {
                    source: 'kanban-drop-status',
                    label: '状态',
                    reason: 'kanban-drop-status',
                });
                if (Number(result?.failureCount) > 0) {
                    hint(`⚠ 批量设置状态存在失败项（${Number(result?.failureCount) || 0}）`, 'warning');
                }
            }
        } catch (e) {
            hint(`❌ 状态更新失败: ${e.message}`, 'error');
            return;
        }
    }

    window.tmKanbanDrop = async function(ev) {
        try { ev.preventDefault(); } catch (e) {}
        try { ev.stopPropagation(); } catch (e) {}

        // 首先检查是否拖放到组标题（文档标题或标题分组）
        const dropTarget = ev?.target instanceof Element ? ev.target.closest('[data-tm-kb-drop-kind]') : null;
        let kind = '';
        let targetDocId = '';
        let targetHeadingId = '';
        let st = '';

        if (dropTarget) {
            // 从组标题元素读取拖放数据
            kind = String(dropTarget.dataset?.tmKbDropKind || '').trim();
            targetDocId = String(dropTarget.dataset?.tmKbDropDoc || '').trim();
            targetHeadingId = String(dropTarget.dataset?.tmKbDropHeading || '').trim();
        }

        // 如果没有从组标题获取到数据，则从列元素读取
        if (!kind) {
            const col = ev?.target instanceof Element ? ev.target.closest('.tm-kanban-col') : null;
            kind = String(col?.dataset?.kind || 'status').trim() || 'status';
            targetDocId = String(col?.dataset?.doc || '').trim();
            targetHeadingId = String(col?.dataset?.heading || '').trim();
            st = String(col?.dataset?.status || '').trim();
        }

        __tmKanbanClearDragOver();
        let id = '';
        try { id = String(ev.dataTransfer.getData('text/plain') || '').trim(); } catch (e) {}
        if (!id) id = String(state.__tmKanbanDragId || '').trim();
        if (!id) return;
        const baseIds = Array.isArray(state.__tmKanbanDragIds) && state.__tmKanbanDragIds.length ? state.__tmKanbanDragIds : [id];
        const headingDoneBoardEnabled = SettingsStore.data.kanbanHeadingGroupMode === true && !!SettingsStore.data.kanbanShowDoneColumn;
        const restoreIdsFromDoneBoard = async (seedIds) => {
            if (!headingDoneBoardEnabled) return true;
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
        if (kind === 'status') {
            if (!st) return;
            let ids = baseIds.slice();
            if (SettingsStore.data.kanbanDragSyncSubtasks) {
                const allIds = new Set(ids);
                ids.forEach(rootId => {
                    const descendants = __tmKanbanCollectDescendantIds(rootId);
                    descendants.forEach(did => allIds.add(did));
                });
                ids = Array.from(allIds);
            }
            try {
                await __tmKanbanMoveIdsToStatus(ids, st);
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
                for (const tid of ids.slice().reverse()) {
                    await __tmQueueMoveTask(tid, { targetDocId, mode: 'docTop' });
                }
            } catch (e) {
                hint(`❌ 操作失败: ${e.message}`, 'error');
            }
            applyFilters();
            render();
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
                for (const tid of ids.slice().reverse()) {
                    await __tmQueueMoveTask(tid, { targetDocId, mode: 'docTop' });
                }
            } catch (e) {
                hint(`❌ 操作失败: ${e.message}`, 'error');
            }
            applyFilters();
            render();
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
                for (const tid of ids.slice().reverse()) {
                    if (targetHeadingId && targetHeadingId !== '__none__') {
                        await __tmQueueMoveTask(tid, { targetDocId, headingId: targetHeadingId, mode: 'heading' });
                    } else {
                        await __tmQueueMoveTask(tid, { targetDocId, mode: 'docTop' });
                    }
                }
            } catch (e) {
                hint(`❌ 操作失败: ${e.message}`, 'error');
            }

            // 移动后刷新数据
            applyFilters();
            render();
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
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid];
        if (!task) return;
        const anchorEl = (ev?.currentTarget instanceof Element)
            ? ev.currentTarget
            : (ev?.target instanceof Element ? ev.target.closest('.tm-kanban-chip') : null);
        const current = String(task.completionTime || '').trim() || String(task.startDate || '').trim();

        if (!(anchorEl instanceof Element)) {
            const next = await showDatePrompt('设置日期', current);
            if (next == null) return;
            try {
                task.completionTime = String(next || '').trim();
                await __tmPersistMetaAndAttrsAsync(tid, { completionTime: String(next || '').trim() }, { background: true, skipFlush: true });
                applyFilters();
                render();
                hint(next ? '✅ 日期已更新' : '✅ 日期已清空', 'success');
            } catch (e) {
                hint(`❌ 更新失败: ${e.message}`, 'error');
            }
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
                try {
                    task.completionTime = '';
                    await __tmPersistMetaAndAttrsAsync(tid, { completionTime: '' }, { background: true, skipFlush: true });
                    close();
                    applyFilters();
                    render();
                    hint('✅ 日期已清空', 'success');
                } catch (e) {
                    hint(`❌ 更新失败: ${e.message}`, 'error');
                }
            };

            const actions = document.createElement('div');
            actions.className = 'tm-inline-editor-actions';
            actions.appendChild(clearBtn);
            editor.appendChild(actions);

            const save = async () => {
                const raw = String(input.value || '').trim();
                const next = raw ? __tmNormalizeDateOnly(raw) : '';
                try {
                    task.completionTime = next;
                    await __tmPersistMetaAndAttrsAsync(tid, { completionTime: next }, { background: true, skipFlush: true });
                    close();
                    applyFilters();
                    render();
                    hint(next ? '✅ 日期已更新' : '✅ 日期已清空', 'success');
                } catch (e) {
                    hint(`❌ 更新失败: ${e.message}`, 'error');
                }
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
        const shouldLogValueIds = Array.from(new Set([
            taskId,
            String(task?.attrHostId || task?.attr_host_id || '').trim(),
            String(task?.parent_id || '').trim(),
        ].filter(Boolean)));
        const shouldLogValue = __tmShouldLogValueDebug(shouldLogValueIds, false);
        const beforeValueSnapshot = shouldLogValue ? __tmSnapshotTaskValueDebugFields(task) : null;
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
        const rawCustomFieldValues = (task.__customFieldRawValues && typeof task.__customFieldRawValues === 'object' && !Array.isArray(task.__customFieldRawValues))
            ? task.__customFieldRawValues
            : ((task.customFieldValues && typeof task.customFieldValues === 'object' && !Array.isArray(task.customFieldValues))
                ? task.customFieldValues
                : {});
        const pin0 = task.custom_pinned ?? task.customPinned ?? task.pinned ?? '';
        task.pinned = __tmParseTaskLooseBoolean(pin0);

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
            if (!isValidValue(task.priority) && isValidValue(meta.priority)) task.priority = __tmNormalizeTaskPriorityValue(meta.priority);
            if (!isValidValue(task.duration) && isValidValue(meta.duration)) task.duration = meta.duration;
            if (!isValidValue(task.remark) && isValidValue(meta.remark)) task.remark = meta.remark;
            if (!isValidValue(task.completionTime) && allowVisibleDateFallback && isValidValue(meta.completionTime)) task.completionTime = meta.completionTime;
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
            if (!task.attachmentCount && Object.prototype.hasOwnProperty.call(meta, 'attachments')) {
                __tmApplyTaskAttachmentPathsToTask(task, meta.attachments);
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
        if (shouldLogValue) {
            __tmPushValueDebug('normalize:final', {
                taskId,
                allowVisibleDateFallback,
                allowCustomStatusFallback,
                meta: __tmSnapshotTaskMetaValueDebugFields(meta),
                dbHasRepeatRule,
                dbHasRepeatState,
                dbHasRepeatHistory,
                before: beforeValueSnapshot,
                after: __tmSnapshotTaskValueDebugFields(task),
            }, shouldLogValueIds);
        }
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
        const parentLookupDepth = __tmNormalizeTaskParentLookupDepth(
            Object.prototype.hasOwnProperty.call(opts, 'parentLookupDepth')
                ? opts.parentLookupDepth
                : SettingsStore?.data?.taskParentLookupDepth
        );
        const manualRelationships = opts.manualRelationships instanceof Map ? opts.manualRelationships : null;
        const oldRelationships = opts.oldRelationships instanceof Map ? opts.oldRelationships : null;
        const allowOldRelationshipFallback = opts.allowOldRelationshipFallback === true;
        const idMap = new Map();
        const canLogValueDebug = __tmDebugChannels.value.enabled === true && __tmValueDebugWatchTaskIds.size > 0;
        const debugMetaByTaskId = canLogValueDebug ? new Map() : null;
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

        tasks.forEach((task) => {
            const taskId = String(task?.id || '').trim();
            if (!taskId) return;
            task.children = [];
            idMap.set(taskId, task);
        });

        tasks.forEach((task) => {
            const taskId = String(task?.id || '').trim();
            if (!taskId) return;
            const directParentId = String(task?.parent_id || task?.parentId || '').trim();
            const joinedParentTaskId = String(task?.parentTaskId || task?.parent_task_id || '').trim();
            const listParentTaskId = String(task?.parent_list_parent_id || task?.parentListParentId || '').trim();
            const debugIds = canLogValueDebug ? __tmGetValueDebugMatchKeysForTaskLike(task) : [];
            const shouldLogValue = canLogValueDebug ? __tmShouldLogValueDebug(debugIds, false) : false;
            const beforeSnapshot = shouldLogValue ? __tmSnapshotTaskValueDebugFields(task) : null;
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
            if (debugMetaByTaskId) {
                debugMetaByTaskId.set(taskId, {
                    directParentId,
                    joinedParentTaskId,
                    listParentTaskId,
                    beforeSnapshot,
                debugIds,
                shouldLogValue,
                initialResolution: resolution,
                manualParentTaskId,
            });
            }
        });

        if (unresolvedParentIds.size > 0 && parentLookupDepth > 0) {
            try {
                const blockParentMap = new Map();
                let frontier = new Set(Array.from(unresolvedParentIds));
                for (let depth = 0; depth < parentLookupDepth && frontier.size > 0; depth += 1) {
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
                fallbackTargets.forEach((item) => {
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
                });
            } catch (e) {}
        }

        const rootTasks = [];
        tasks.forEach((task) => {
            const taskId = String(task?.id || '').trim();
            if (!taskId) return;
            const debugMeta = debugMetaByTaskId ? (debugMetaByTaskId.get(taskId) || null) : null;
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
            if (debugMeta?.shouldLogValue) {
                __tmPushValueDebug('parent-link:resolved', {
                    source,
                    docId,
                    taskId,
                    manualParentTaskId: debugMeta.manualParentTaskId,
                    directParentId: debugMeta.directParentId,
                    joinedParentTaskId: debugMeta.joinedParentTaskId,
                    listParentTaskId: debugMeta.listParentTaskId,
                    resolvedParentTaskId: parentTaskId,
                    resolvedInDoc,
                    initialResolution: debugMeta.initialResolution,
                    before: debugMeta.beforeSnapshot,
                    after: __tmSnapshotTaskValueDebugFields(task),
                }, debugMeta.debugIds);
            }
        });

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

    function __tmResolveAutoOtherBlockTargetGroupId(groupId) {
        const preferred = __tmResolveOtherBlockGroupId(groupId);
        if (preferred && __tmGetDocGroupById(preferred)) return preferred;
        const current = __tmResolveOtherBlockGroupId();
        if (current && __tmGetDocGroupById(current)) return current;
        const groups = Array.isArray(SettingsStore?.data?.docGroups) ? SettingsStore.data.docGroups : [];
        return String(groups[0]?.id || '').trim();
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
        if (t === 'd' || t === 'h' || t === 'p') return true;
        if ((t === 'i' || t === 'l') && (st === 'o' || st === 'u')) return true;
        return false;
    }

    function __tmGetOtherBlockTypeLabel(type, subtype) {
        const t = String(type || '').trim().toLowerCase();
        const st = String(subtype || '').trim().toLowerCase();
        if (t === 'd') return '文档块';
        if (t === 'h') return '标题块';
        if (t === 'p') return '内容块';
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
        const docId = isDocBlock
            ? id
            : (String(row?.root_id || '').trim() || id);
        const docName = isDocBlock
            ? (String(row?.content || '').trim() || String(row?.doc_name || '').trim() || '未命名文档')
            : (String(row?.doc_name || '').trim() || '未命名文档');
        const rawContent = String(row?.content || '').trim() || (isDocBlock ? docName : '');
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
            state.otherBlocks = [];
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
            if (!id || !__tmIsSupportedOtherBlockType(row?.type, row?.subtype)) return;
            rowMap.set(id, row);
        });

        const nextRefs = [];
        const nextTasks = [];
        normalizedRefs.forEach((item, idx) => {
            const id = String(item?.id || '').trim();
            const row = rowMap.get(id);
            if (!row) {
                changed = true;
                return;
            }
            nextRefs.push({ id });
            nextTasks.push(__tmBuildCollectedOtherBlockTask(row, idx, currentGroupId));
        });

        __tmSetOtherBlockRefsByGroup(currentGroupId, nextRefs);
        state.otherBlocks = nextTasks;
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

        ids.forEach((id) => {
            if (!rowMap.has(id)) {
                invalid += 1;
                return;
            }
            if (seen.has(id)) {
                existed += 1;
                return;
            }
            seen.add(id);
            nextRefs.push({ id });
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
                if (!silent) hint('⚠ 当前仅支持文档块、标题块、内容块和有序/无序列表块', 'warning');
            }
            return { added, existed, invalid, group, reason: existed > 0 ? 'exists' : (invalid > 0 ? 'invalid' : 'unchanged') };
        }

        __tmSetOtherBlockRefsByGroup(targetGroupId, nextRefs);
        try { await SettingsStore.save(); } catch (e) {}
        const currentGroupId = __tmResolveOtherBlockGroupId();
        if (currentGroupId === targetGroupId || options.forceRefresh) {
            await __tmLoadCollectedOtherBlocks({ persist: false, groupId: targetGroupId });
            state.flatTasks = __tmMergeOtherBlocksIntoFlatTasks(state.flatTasks);
            try { recalcStats(); } catch (e) {}
            try { applyFilters(); } catch (e) {}
            try { if (state.modal) render(); } catch (e) {}
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
        try { await SettingsStore.save(); } catch (e) {}
        const currentGroupId = __tmResolveOtherBlockGroupId();
        if (currentGroupId === targetGroupId || options.forceRefresh) {
            await __tmLoadCollectedOtherBlocks({ persist: false, groupId: targetGroupId });
            state.flatTasks = __tmMergeOtherBlocksIntoFlatTasks(state.flatTasks);
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

    async function __tmResolveCollectedOtherBlockTaskById(id) {
        const tid = String(id || '').trim();
        if (!tid) return null;
        const existing = globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid];
        if (existing && __tmIsCollectedOtherBlockTask(existing)) return existing;
        let rows = [];
        try { rows = await API.getOtherBlocksByIds([tid]); } catch (e) { rows = []; }
        const row = Array.isArray(rows) ? rows.find((item) => {
            const rid = String(item?.id || '').trim();
            return rid === tid && __tmIsSupportedOtherBlockType(item?.type, item?.subtype);
        }) : null;
        if (!row) return null;
        return __tmBuildCollectedOtherBlockTask(row, Number.POSITIVE_INFINITY, '');
    }

    function __tmEnsureEditableTaskLike(taskOrId, actionLabel = '该操作') {
        const task = (taskOrId && typeof taskOrId === 'object')
            ? taskOrId
            : (globalThis.__tmRuntimeState?.getFlatTaskById?.(String(taskOrId || '').trim()) || state.flatTasks?.[String(taskOrId || '').trim()]);
        if (!task) return false;
        if (!__tmIsCollectedOtherBlockTask(task)) return true;
        try { hint(`⚠ ${actionLabel}暂不支持“${__TM_OTHER_BLOCK_TAB_NAME}”中的块，请回到原文档处理`, 'warning'); } catch (e) {}
        return false;
    }

    let __contextMenuUnstack = null;

    function __tmShowCollectedOtherBlockContextMenu(event, taskId) {
        const tid = String(taskId || '').trim();
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid];
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
        const shouldLogValue = __tmShouldLogValueDebug([taskId], false);
        const beforeValueSnapshot = shouldLogValue ? __tmSnapshotTaskValueDebugFields(task) : null;
        if (!isValidValue(task.completionTime) && isValidValue(prevTask.completionTime)) {
            task.completionTime = String(prevTask.completionTime);
        }
        if (!isValidValue(task.startDate) && isValidValue(prevTask.startDate)) {
            task.startDate = String(prevTask.startDate);
        }
        if (!isValidValue(task.customTime) && isValidValue(prevTask.customTime)) {
            task.customTime = String(prevTask.customTime);
        }
        if (shouldLogValue) {
            __tmPushValueDebug('merge-prev-visible-date', {
                taskId,
                prevTask: __tmSnapshotTaskValueDebugFields(prevTask),
                before: beforeValueSnapshot,
                after: __tmSnapshotTaskValueDebugFields(task),
            }, [taskId]);
        }
        return task;
    }
