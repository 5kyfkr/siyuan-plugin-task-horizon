    function __tmShouldShowCalendarSideDock() {
        if (state.homepageOpen) return false;
        const mode = globalThis.__tmRuntimeState?.getViewMode?.('') || String(state.viewMode || '').trim();
        if (!SettingsStore.data.calendarSideDockEnabled) return false;
        return mode === 'list' || mode === 'checklist' || mode === 'timeline' || mode === 'kanban' || mode === 'whiteboard';
    }

    function __tmHasMountedCalendarSideDock() {
        const modal = state.modal instanceof Element ? state.modal : null;
        if (!modal || !document.body.contains(modal) || !__tmShouldShowCalendarSideDock()) return false;
        return !!modal.querySelector('.tm-calendar-side-dock #tmCalendarSideDockTimeline');
    }

    function __tmCalendarDockGetDateKey() {
        const raw = String(state.calendarDockDate || '').trim();
        if (raw) return __tmNormalizeDateOnly(raw) || raw;
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const key = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        state.calendarDockDate = key;
        return key;
    }

    function __tmCalendarDockLabel(dateKey) {
        const ts = __tmParseTimeToTs(String(dateKey || '').trim());
        if (!ts) return String(dateKey || '');
        const d = new Date(ts);
        const week = ['日', '一', '二', '三', '四', '五', '六'];
        return `${d.getMonth() + 1}月${d.getDate()}日 周${week[d.getDay()]}`;
    }

    function __tmSetCalendarSideDockDragHidden(hidden) {
        const next = !!hidden;
        state.calendarSideDockDragHidden = next;
        const layout = state.modal?.querySelector?.('.tm-main-body-with-cal-dock');
        if (!(layout instanceof HTMLElement)) return false;
        if (!layout.querySelector('.tm-calendar-side-dock')) return false;
        try {
            layout.classList.toggle('tm-main-body-with-cal-dock--calendar-dock-hidden', next);
        } catch (e) {
            return false;
        }
        if (!next) {
            try {
                requestAnimationFrame(() => {
                    try { globalThis.__tmCalendar?.refreshSideDayLayout?.(); } catch (e2) {}
                    try { globalThis.__tmCalendar?.relayoutSideDayDate?.(); } catch (e2) {}
                });
            } catch (e) {}
        }
        return true;
    }

    function __tmCalendarDockBuildPanelHtml() {
        const dateKey = __tmCalendarDockGetDateKey();
        return `
            <div class="tm-calendar-dock-head">
                <div class="tm-calendar-dock-title">${esc(__tmCalendarDockLabel(dateKey))}</div>
                <div class="tm-calendar-dock-nav">
                    <button class="tm-btn tm-btn-info bc-btn bc-btn--sm tm-calendar-dock-nav-btn--icon" onclick="tmCalendarDockShiftDay(-1)">${__tmRenderLucideIcon('chevron-left')}</button>
                    <button class="tm-btn tm-btn-info bc-btn bc-btn--sm tm-calendar-dock-nav-btn--today" onclick="tmCalendarDockToday()">今天</button>
                    <button class="tm-btn tm-btn-info bc-btn bc-btn--sm tm-calendar-dock-nav-btn--icon" onclick="tmCalendarDockShiftDay(1)">${__tmRenderLucideIcon('chevron-right')}</button>
                </div>
            </div>
            <div id="tmCalendarSideDockTimeline" class="tm-calendar-side-dock-timeline"></div>
        `;
    }

    function __tmCalendarDockMountTimeline(timelineRoot) {
        if (!(timelineRoot instanceof HTMLElement)) return false;
        if (!globalThis.__tmCalendar || typeof globalThis.__tmCalendar.mountSideDayTimeline !== 'function') return false;
        const modal = state.modal;
        const viewMode = globalThis.__tmRuntimeState?.getViewMode?.('') || String(state.viewMode || '').trim();
        const dragHost = (() => {
            if (!(modal instanceof Element)) return null;
            if (viewMode === 'timeline') return modal.querySelector('#tmTimelineLeftTable tbody');
            if (viewMode === 'kanban') return modal.querySelector('.tm-body.tm-body--kanban');
            if (viewMode === 'checklist') return modal.querySelector('.tm-checklist-items');
            return modal.querySelector('#tmTaskTable tbody');
        })();
        return globalThis.__tmCalendar.mountSideDayTimeline(timelineRoot, {
            settingsStore: SettingsStore,
            date: __tmCalendarDockGetDateKey(),
            resolveTask: (taskId) => {
                const tid = String(taskId || '').trim();
                return globalThis.__tmRuntimeState?.getTaskById?.(tid, { includePending: true, preferPending: true })
                    || state.flatTasks?.[tid]
                    || state.pendingInsertedTasks?.[tid]
                    || null;
            },
            dragHost: dragHost || modal,
            enableExternalDrag: true,
            allowInactiveFullLoad: true,
        });
    }

    function __tmCalendarDockMount(attempt = 0, mountToken = '') {
        const root = state.modal?.querySelector?.('#tmCalendarSideDockPanel');
        if (!(root instanceof HTMLElement)) return;
        const token = mountToken || `${Date.now()}:${Math.random()}`;
        if (!mountToken) state.calendarSideDockMountToken = token;
        let timelineRoot = root.querySelector('#tmCalendarSideDockTimeline');
        if (!(timelineRoot instanceof HTMLElement) || attempt <= 0) {
            root.innerHTML = __tmCalendarDockBuildPanelHtml();
            timelineRoot = root.querySelector('#tmCalendarSideDockTimeline');
        }
        if (!(timelineRoot instanceof HTMLElement)) return;
        if (!globalThis.__tmCalendar || typeof globalThis.__tmCalendar.mountSideDayTimeline !== 'function') {
            timelineRoot.innerHTML = `<div class="tm-calendar-dock-message">日历模块加载中...</div>`;
            if (attempt < 80) {
                try {
                    setTimeout(() => {
                        try {
                            if (state.calendarSideDockMountToken !== token) return;
                            if (!root.isConnected || (state.modal && !state.modal.contains(root))) return;
                            if (!__tmShouldShowCalendarSideDock()) return;
                            __tmCalendarDockMount(attempt + 1, token);
                        } catch (e2) {}
                    }, attempt < 8 ? 80 : 160);
                } catch (e) {}
            } else {
                timelineRoot.innerHTML = `<div class="tm-calendar-dock-message">日历模块未加载。</div>`;
            }
            return;
        }
        const ok = __tmCalendarDockMountTimeline(timelineRoot);
        if (!ok) {
            timelineRoot.innerHTML = `<div class="tm-calendar-dock-message">日历初始化失败。</div>`;
            return;
        }
        if (state.calendarSideDockMountToken === token) state.calendarSideDockMountToken = '';
        try {
            requestAnimationFrame(() => {
                try { globalThis.__tmCalendar?.refreshSideDayLayout?.(); } catch (e) {}
                try { globalThis.__tmCalendar?.relayoutSideDayDate?.(); } catch (e) {}
                try {
                    requestAnimationFrame(() => {
                        try { globalThis.__tmCalendar?.refreshSideDayLayout?.(); } catch (e2) {}
                        try { globalThis.__tmCalendar?.relayoutSideDayDate?.(); } catch (e2) {}
                    });
                } catch (e) {}
            });
        } catch (e) {}
    }

    window.tmCalendarDockShiftDay = function(delta) {
        const d = Number(delta) || 0;
        if (globalThis.__tmCalendar && typeof globalThis.__tmCalendar.shiftSideDay === 'function') {
            const ok = globalThis.__tmCalendar.shiftSideDay(d);
            if (ok && typeof globalThis.__tmCalendar.getSideDayDate === 'function') {
                state.calendarDockDate = String(globalThis.__tmCalendar.getSideDayDate() || '').trim() || __tmCalendarDockGetDateKey();
            }
        } else {
            const baseTs = __tmParseTimeToTs(__tmCalendarDockGetDateKey());
            const base = baseTs ? new Date(baseTs) : new Date();
            base.setDate(base.getDate() + d);
            const pad = (n) => String(n).padStart(2, '0');
            state.calendarDockDate = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`;
        }
        const labelEl = state.modal?.querySelector?.('.tm-calendar-dock-title');
        if (labelEl) labelEl.textContent = __tmCalendarDockLabel(__tmCalendarDockGetDateKey());
    };

    window.tmCalendarDockToday = function() {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        state.calendarDockDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        if (globalThis.__tmCalendar && typeof globalThis.__tmCalendar.setSideDayDate === 'function') {
            globalThis.__tmCalendar.setSideDayDate(state.calendarDockDate);
        }
        const labelEl = state.modal?.querySelector?.('.tm-calendar-dock-title');
        if (labelEl) labelEl.textContent = __tmCalendarDockLabel(state.calendarDockDate);
    };

    window.tmStartCalendarSideDockResize = function(ev) {
        try { ev?.preventDefault?.(); } catch (e) {}
        const aside = state.modal?.querySelector?.('.tm-calendar-side-dock');
        if (!(aside instanceof HTMLElement)) return;
        const startX = Number(ev?.clientX) || 0;
        const startW = Math.max(260, Math.min(760, Math.round(aside.getBoundingClientRect().width || Number(SettingsStore.data.calendarSideDockWidth) || 340)));
        const onMove = (e2) => {
            const x = Number(e2?.clientX) || 0;
            const delta = startX - x;
            const nextW = Math.max(260, Math.min(760, Math.round(startW + delta)));
            aside.style.width = `${nextW}px`;
            aside.style.minWidth = `${nextW}px`;
            SettingsStore.data.calendarSideDockWidth = nextW;
            try { globalThis.__tmCalendar?.refreshInPlace?.({ hard: false }); } catch (e3) {}
        };
        const onUp = async () => {
            try { globalThis.__tmRuntimeEvents?.off?.(document, 'mousemove', onMove, true); } catch (e2) {}
            try { globalThis.__tmRuntimeEvents?.off?.(document, 'mouseup', onUp, true); } catch (e2) {}
            try { await SettingsStore.save(); } catch (e2) {}
        };
        try { globalThis.__tmRuntimeEvents?.on?.(document, 'mousemove', onMove, true); } catch (e2) {}
        try { globalThis.__tmRuntimeEvents?.on?.(document, 'mouseup', onUp, true); } catch (e2) {}
    };

    window.tmToggleCalendarSideDock = async function(enabled) {
        const next = (typeof enabled === 'boolean') ? enabled : !SettingsStore.data.calendarSideDockEnabled;
        SettingsStore.data.calendarSideDockEnabled = !!next;
        try { await SettingsStore.save(); } catch (e) {}
        render();
    };

    function __tmShouldShowAiSidebar() {
        if (!__tmIsAiFeatureEnabled()) return false;
        if (typeof window.tmLicenseHasFeature === 'function' && !window.tmLicenseHasFeature('pro')) return false;
        if (!SettingsStore.data.aiSideDockEnabled) return false;
        if (state.homepageOpen) return true;
        const mode = globalThis.__tmRuntimeState?.getViewMode?.('') || String(state.viewMode || '').trim();
        return mode === 'list' || mode === 'checklist' || mode === 'timeline' || mode === 'kanban' || mode === 'whiteboard' || mode === 'calendar';
    }

    function __tmAiUsesOverlayPanel() {
        return __tmIsMobileDevice() || __tmIsDockHost();
    }

    async function __tmMountAiSidebarHost(payload) {
        const useOverlayPanel = __tmAiUsesOverlayPanel();
        const selector = useOverlayPanel ? '#tmAiMobileSidebarPanel' : '#tmAiSidebarPanel';
        let host = state.modal?.querySelector?.(selector);
        if (!(host instanceof HTMLElement)) return false;
        const ready = await __tmEnsureAiRuntimeLoaded();
        if (!ready) return false;
        host = state.modal?.querySelector?.(selector);
        if (!(host instanceof HTMLElement) || !host.isConnected) return false;
        if (globalThis.__tmAI?.mountSidebar) {
            try { await globalThis.__tmAI.mountSidebar(host, { mobile: useOverlayPanel }); } catch (e) {}
        }
        if (payload && !payload.__tmAiPendingOpen && globalThis.__tmAI?.openSidebar) {
            try { await globalThis.__tmAI.openSidebar(payload); } catch (e) {}
        }
        return true;
    }

    window.tmStartAiSideDockResize = function(ev) {
        try { ev?.preventDefault?.(); } catch (e) {}
        const aside = state.modal?.querySelector?.('.tm-ai-side-dock');
        if (!(aside instanceof HTMLElement)) return;
        const startX = Number(ev?.clientX) || 0;
        const startW = Math.max(320, Math.min(720, Math.round(aside.getBoundingClientRect().width || Number(state.aiSidebarWidth) || 380)));
        const onMove = (e2) => {
            const x = Number(e2?.clientX) || 0;
            const delta = startX - x;
            const nextW = Math.max(320, Math.min(720, Math.round(startW + delta)));
            state.aiSidebarWidth = nextW;
            aside.style.width = `${nextW}px`;
            aside.style.minWidth = `${nextW}px`;
        };
        const onUp = () => {
            try { globalThis.__tmRuntimeEvents?.off?.(document, 'mousemove', onMove, true); } catch (e2) {}
            try { globalThis.__tmRuntimeEvents?.off?.(document, 'mouseup', onUp, true); } catch (e2) {}
            try { Storage.set('tm_ai_sidebar_width', Number(state.aiSidebarWidth) || 380); } catch (e2) {}
        };
        try { globalThis.__tmRuntimeEvents?.on?.(document, 'mousemove', onMove, true); } catch (e2) {}
        try { globalThis.__tmRuntimeEvents?.on?.(document, 'mouseup', onUp, true); } catch (e2) {}
    };

    window.tmCloseAiSidebar = function() {
        SettingsStore.data.aiSideDockEnabled = false;
        try { SettingsStore.save()?.catch?.(() => {}); } catch (e) {}
        if (__tmAiUsesOverlayPanel()) {
            state.aiMobilePanelOpen = false;
        } else {
            state.aiSidebarOpen = false;
            try { Storage.set('tm_ai_sidebar_open', false); } catch (e) {}
        }
        render();
    };

    window.tmToggleAiSideDock = async function(enabled) {
        const next = (typeof enabled === 'boolean') ? enabled : !SettingsStore.data.aiSideDockEnabled;
        if (next && typeof window.tmRequireFullFeature === 'function' && !window.tmRequireFullFeature('ai-workbench', 'AI 工作台')) return false;
        SettingsStore.data.aiSideDockEnabled = !!next;
        try { await SettingsStore.save(); } catch (e) {}
        if (!next) {
            if (__tmAiUsesOverlayPanel()) {
                state.aiMobilePanelOpen = false;
            } else {
                state.aiSidebarOpen = false;
                try { Storage.set('tm_ai_sidebar_open', false); } catch (e) {}
            }
            render();
            return false;
        }
        return await window.tmOpenAiSidebar({ __tmAiPendingOpen: true });
    };

    window.tmToggleAiSidebar = async function(payload) {
        if (__tmAiUsesOverlayPanel()) {
            if (state.aiMobilePanelOpen) return window.tmCloseAiSidebar();
            return await window.tmOpenAiSidebar(payload);
        }
        if (state.aiSidebarOpen) return window.tmCloseAiSidebar();
        return await window.tmOpenAiSidebar(payload);
    };

    async function __tmPrepareChecklistDetailForAiSidebar() {
        if (__tmAiUsesOverlayPanel() || state.homepageOpen) return false;
        const mode = globalThis.__tmRuntimeState?.getViewMode?.('') || String(state.viewMode || '').trim();
        if (mode !== 'checklist') return false;
        let panel = null;
        try { panel = __tmResolveChecklistDetailPanel(state.modal).panel; } catch (e) { panel = null; }
        if (panel instanceof HTMLElement) {
            try {
                await panel.__tmTaskDetailFlushSave?.({
                    showHint: false,
                    closeAfterSave: false,
                    preserveFocus: false,
                    skipRerender: true,
                });
            } catch (e) {}
            try { panel.__tmTaskDetailCloseInlinePopover?.(); } catch (e) {}
        }
        state.checklistDetailSheetOpen = false;
        state.checklistDetailSheetFullscreen = false;
        return true;
    }

    window.tmMultiSelectSendToAi = async function() {
        const taskIds = __tmGetMultiSelectedTaskIds();
        if (!taskIds.length) {
            try { hint('请先选择任务', 'info'); } catch (e) {}
            return false;
        }
        return await window.tmOpenAiSidebar({
            selectedTaskIds: taskIds,
            draft: `请基于这 ${taskIds.length} 个已选任务继续处理：`,
        });
    };

    window.tmOpenAiSidebar = async function(payload) {
        if (typeof window.tmRequireFullFeature === 'function' && !window.tmRequireFullFeature('ai-workbench', 'AI 工作台')) return false;
        if (SettingsStore.data.aiSideDockEnabled !== true) {
            SettingsStore.data.aiSideDockEnabled = true;
            try { await SettingsStore.save(); } catch (e) {}
        }
        try { await __tmPrepareChecklistDetailForAiSidebar(); } catch (e) {}
        if (__tmAiUsesOverlayPanel()) {
            state.aiMobilePanelOpen = true;
        } else {
            state.aiSidebarOpen = true;
            try { Storage.set('tm_ai_sidebar_open', true); } catch (e) {}
        }
        const canRenderInCurrentDockHost = __tmIsDockHost()
            && (globalThis.__tmRuntimeState?.hasLiveModal?.() ?? (state.modal && document.body.contains(state.modal)));
        if (!canRenderInCurrentDockHost) {
            await openManager({ preserveViewMode: true, skipLoadingHint: true });
        }
        try { render(); } catch (e) {}
        try { await __tmMountAiSidebarHost(payload); } catch (e) {}
        return true;
    };

    window.tmOpenHomepage = async function() {
        state.attachmentLibraryOpen = false;
        state.homepageOpen = true;
        try { Storage.set('tm_homepage_open', true); } catch (e) {}
        const canRenderInCurrentDockHost = __tmIsDockHost()
            && (globalThis.__tmRuntimeState?.hasLiveModal?.() ?? (state.modal && document.body.contains(state.modal)));
        if (!canRenderInCurrentDockHost) {
            await openManager({ preserveViewMode: true, skipLoadingHint: true });
        }
        try { render(); } catch (e) {}
        return true;
    };

    window.tmCloseHomepage = function() {
        state.homepageOpen = false;
        try { __tmInvalidateHomepageMount(); } catch (e) {}
        try { Storage.set('tm_homepage_open', false); } catch (e) {}
        render();
        return false;
    };

    window.tmOpenAttachmentLibrary = async function(ev) {
        try { ev?.preventDefault?.(); } catch (e) {}
        try { ev?.stopPropagation?.(); } catch (e) {}
        state.attachmentLibraryOpen = true;
        state.homepageOpen = false;
        try { __tmInvalidateHomepageMount(); } catch (e) {}
        try { Storage.set('tm_homepage_open', false); } catch (e) {}
        const canRenderInCurrentDockHost = __tmIsDockHost()
            && (globalThis.__tmRuntimeState?.hasLiveModal?.() ?? (state.modal && document.body.contains(state.modal)));
        if (!canRenderInCurrentDockHost) {
            await openManager({ preserveViewMode: true, skipLoadingHint: true });
        }
        try {
            await __tmRefreshAttachmentLibraryRealAttrs({ saveMetaNow: true });
        } catch (e) {}
        try { render(); } catch (e) {}
        return true;
    };

    window.tmCloseAttachmentLibrary = function(ev) {
        try { ev?.preventDefault?.(); } catch (e) {}
        try { ev?.stopPropagation?.(); } catch (e) {}
        state.attachmentLibraryOpen = false;
        render();
        return false;
    };

    window.tmToggleAttachmentLibrary = async function(ev) {
        try { ev?.preventDefault?.(); } catch (e) {}
        try { ev?.stopPropagation?.(); } catch (e) {}
        if (state.attachmentLibraryOpen) return window.tmCloseAttachmentLibrary();
        return await window.tmOpenAttachmentLibrary();
    };

    window.tmToggleHomepage = async function(ev) {
        try { ev?.preventDefault?.(); } catch (e) {}
        try { ev?.stopPropagation?.(); } catch (e) {}
        if (state.homepageOpen) return window.tmCloseHomepage();
        return await window.tmOpenHomepage();
    };

    const __TM_BODY_ONLY_VIEW_SWITCH_MODES = new Set(['list', 'checklist', 'timeline', 'kanban', 'calendar', 'whiteboard']);

    function __tmGetCalendarScrollHost(rootEl) {
        const root = rootEl instanceof Element ? rootEl : null;
        if (!root) return null;
        const preferred = root.querySelector('.fc-timegrid-body .fc-scroller');
        if (preferred instanceof HTMLElement && preferred.scrollHeight > preferred.clientHeight + 1) return preferred;
        const candidates = Array.from(root.querySelectorAll('.fc-scroller'));
        return candidates.find((item) => item instanceof HTMLElement && item.scrollHeight > item.clientHeight + 1)
            || (preferred instanceof HTMLElement ? preferred : null)
            || candidates.find((item) => item instanceof HTMLElement)
            || null;
    }

    function __tmCaptureBodyOnlyViewScroll(modeInput, modalEl) {
        const mode = String(modeInput || '').trim();
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return;
        state.viewScroll = state.viewScroll && typeof state.viewScroll === 'object' ? state.viewScroll : {};
        if (mode === 'timeline') {
            const globalScrollHost = __tmGetTimelineGlobalScrollHost(modal);
            const leftBody = modal.querySelector('#tmTimelineLeftBody');
            const ganttBody = modal.querySelector('#tmGanttBody');
            state.viewScroll.timeline = {
                top: Number(globalScrollHost?.scrollTop ?? leftBody?.scrollTop) || 0,
                left: Number(globalScrollHost?.scrollLeft ?? ganttBody?.scrollLeft) || 0,
            };
            return;
        }
        if (mode === 'kanban') {
            const body = modal.querySelector('.tm-body.tm-body--kanban');
            const cols = {};
            modal.querySelectorAll('.tm-kanban-col').forEach((col) => {
                const key = __tmGetKanbanColScrollKey(col);
                const colBody = col.querySelector?.('.tm-kanban-col-body');
                if (key && colBody instanceof HTMLElement) cols[key] = Number(colBody.scrollTop) || 0;
            });
            state.viewScroll.kanban = { left: Number(body?.scrollLeft) || 0, cols };
            return;
        }
        if (mode === 'calendar') {
            const scroller = __tmGetCalendarScrollHost(modal.querySelector('#tmCalendarRoot'));
            state.viewScroll.calendar = {
                top: Number(scroller?.scrollTop) || 0,
                left: Number(scroller?.scrollLeft) || 0,
            };
            return;
        }
        if (mode === 'whiteboard') return;
        const pane = mode === 'checklist'
            ? modal.querySelector('.tm-checklist-scroll')
            : modal.querySelector('.tm-body.tm-body--list');
        state.viewScroll.list = {
            top: Number(pane?.scrollTop) || 0,
            left: Number(pane?.scrollLeft) || 0,
        };
    }

    function __tmRestoreBodyOnlyViewScroll(modeInput, modalEl) {
        const mode = String(modeInput || '').trim();
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return;
        const apply = () => {
            if (mode === 'timeline') {
                const saved = state.viewScroll?.timeline || {};
                const top = Number(saved.top) || 0;
                const left = Number(saved.left) || 0;
                const globalScrollHost = __tmGetTimelineGlobalScrollHost(modal);
                const leftBody = modal.querySelector('#tmTimelineLeftBody');
                const ganttBody = modal.querySelector('#tmGanttBody');
                if (globalScrollHost instanceof HTMLElement) {
                    globalScrollHost.scrollTop = top;
                    globalScrollHost.scrollLeft = left;
                } else {
                    if (leftBody instanceof HTMLElement) leftBody.scrollTop = top;
                    if (ganttBody instanceof HTMLElement) {
                        ganttBody.scrollTop = top;
                        ganttBody.scrollLeft = left;
                    }
                }
                return;
            }
            if (mode === 'kanban') {
                const saved = state.viewScroll?.kanban || {};
                const body = modal.querySelector('.tm-body.tm-body--kanban');
                if (body instanceof HTMLElement) body.scrollLeft = Number(saved.left) || 0;
                const cols = saved.cols && typeof saved.cols === 'object' ? saved.cols : {};
                modal.querySelectorAll('.tm-kanban-col').forEach((col) => {
                    const key = __tmGetKanbanColScrollKey(col);
                    const colBody = col.querySelector?.('.tm-kanban-col-body');
                    if (key && colBody instanceof HTMLElement) colBody.scrollTop = Number(cols[key]) || 0;
                });
                return;
            }
            if (mode === 'calendar') {
                const saved = state.viewScroll?.calendar || {};
                const scroller = __tmGetCalendarScrollHost(modal.querySelector('#tmCalendarRoot'));
                if (scroller instanceof HTMLElement) {
                    scroller.scrollTop = Number(saved.top) || 0;
                    scroller.scrollLeft = Number(saved.left) || 0;
                }
                return;
            }
            if (mode === 'whiteboard') return;
            const saved = state.viewScroll?.list || {};
            const pane = mode === 'checklist'
                ? modal.querySelector('.tm-checklist-scroll')
                : modal.querySelector('.tm-body.tm-body--list');
            if (pane instanceof HTMLElement) {
                pane.scrollTop = Number(saved.top) || 0;
                pane.scrollLeft = Number(saved.left) || 0;
                try { pane.__tmChecklistScrollUpdateThumb?.(); } catch (e) {}
                try { pane.__tmTableScrollUpdateThumb?.(); } catch (e) {}
            }
        };
        try { apply(); } catch (e) {}
        try { requestAnimationFrame(() => requestAnimationFrame(apply)); } catch (e) {}
    }

    function __tmRenderBodyOnlyViewToolbarExtra(modeInput, scene) {
        const mode = String(modeInput || '').trim();
        if (mode === 'timeline') return scene?.showTopbarTimelineToolbar ? String(scene.timelineCompactToolbarGroupHtml || '') : '';
        if (mode === 'calendar') {
            const modal = state.modal instanceof Element ? state.modal : null;
            const usesCompactToggle = !!(modal && (
                modal.classList.contains('tm-modal--dock')
                || modal.classList.contains('tm-modal--mobile')
                || modal.classList.contains('tm-modal--runtime-mobile')
                || modal.classList.contains('tm-modal--host-mobile-ui')
            ));
            if (usesCompactToggle) return '';
            return `<button class="tm-btn tm-btn-info bc-btn bc-btn--sm" onclick="tmCalendarToggleSidebar()" style="padding: 0; width: 30px; min-width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center;"${__tmBuildTooltipAttrs('日历侧边栏', { side: 'bottom' })}>${__tmRenderLucideIcon('calendar-days')}</button>`;
        }
        if (mode !== 'kanban') return '';
        const boardMode = __tmGetKanbanBoardMode();
        return __tmRenderTopbarSelect({
            id: 'tmTopbarKanbanModeSelect',
            label: '看板模式',
            className: 'tm-kanban-mode-select tm-topbar-select--narrow',
            tooltip: '切换看板模式',
            options: [
                { value: 'status', label: '状态', selected: boardMode === 'status', action: "tmSetKanbanBoardMode('status')" },
                { value: 'heading', label: '标题', selected: boardMode === 'heading', action: "tmSetKanbanBoardMode('heading')" },
                { value: 'time', label: '时间', selected: boardMode === 'time', action: "tmSetKanbanBoardMode('time')" },
            ],
        });
    }

    function __tmSyncBodyOnlyViewSwitcherButtons(modalEl, activeMode) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return;
        modal.querySelectorAll('[data-tm-view-mode]').forEach((button) => {
            const active = String(button.getAttribute('data-tm-view-mode') || '').trim() === activeMode;
            button.classList.toggle('tm-view-seg-item--active', active);
            button.setAttribute('data-state', active ? 'active' : 'inactive');
            button.setAttribute('aria-selected', active ? 'true' : 'false');
        });
    }

    function __tmShowViewSwitchPendingShell(nextMode) {
        const modal = state.modal instanceof HTMLElement ? state.modal : null;
        if (!modal || !modal.isConnected) return null;
        __tmSyncBodyOnlyViewSwitcherButtons(modal, nextMode);
        modal.setAttribute('data-tm-view-switch-pending', String(nextMode || '').trim());
        const stage = modal.querySelector('.tm-main-stage');
        if (stage instanceof HTMLElement) {
            stage.classList.add('tm-main-stage--view-switch-pending');
            stage.setAttribute('aria-busy', 'true');
        }
        return modal;
    }

    function __tmClearViewSwitchPendingShell(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : null;
        if (!modal) return;
        modal.removeAttribute('data-tm-view-switch-pending');
        const stage = modal.querySelector('.tm-main-stage');
        if (stage instanceof HTMLElement) {
            stage.classList.remove('tm-main-stage--view-switch-pending');
            stage.removeAttribute('aria-busy');
        }
    }

    function __tmScheduleAfterNextPaint(callback) {
        if (typeof callback !== 'function') return false;
        const run = () => {
            try { callback(); } catch (e) {}
        };
        try {
            requestAnimationFrame(() => requestAnimationFrame(run));
        } catch (e) {
            try { setTimeout(run, 0); } catch (e2) { run(); }
        }
        return true;
    }

    function __tmScheduleViewSwitchCommit(generation, nextMode, callback) {
        const run = () => {
            if (Number(state.__tmViewSwitchCommitGeneration || 0) !== generation) return;
            if (String(state.viewMode || '').trim() !== nextMode) return;
            callback();
        };
        try {
            requestAnimationFrame(() => {
                try { setTimeout(run, 0); } catch (e) { run(); }
            });
        } catch (e) {
            try { setTimeout(run, 0); } catch (e2) { run(); }
        }
        return true;
    }

    function __tmScheduleTimelineDateHydrationAfterViewSwitch(generation) {
        if (typeof __tmHydrateChecklistVisibleDateAttrs !== 'function') return false;
        const tasks = Array.isArray(state.filteredTasks) ? state.filteredTasks.slice() : [];
        if (!tasks.length) return false;
        const groupId = String(SettingsStore?.data?.currentGroupId || 'all').trim() || 'all';
        const activeDocId = String(state.activeDocId || 'all').trim() || 'all';
        Promise.resolve(__tmHydrateChecklistVisibleDateAttrs(tasks, {
            reason: 'view-switch-timeline',
            force: true,
        })).then((meta) => {
            if (!meta?.changed) return;
            if (Number(state.__tmViewSwitchCommitGeneration || 0) !== generation) return;
            if (String(state.viewMode || '').trim() !== 'timeline') return;
            if ((String(SettingsStore?.data?.currentGroupId || 'all').trim() || 'all') !== groupId) return;
            if ((String(state.activeDocId || 'all').trim() || 'all') !== activeDocId) return;
            __tmScheduleRender({
                withFilters: true,
                reason: 'view-switch-timeline-date-hydrated',
            });
        }).catch(() => null);
        return true;
    }

    function __tmMountCalendarViewRoot(modalEl, options = {}) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        const opts = (options && typeof options === 'object') ? options : {};
        const root = modal?.querySelector?.('#tmCalendarRoot');
        if (!(root instanceof HTMLElement)) return false;
        const mount = (attempt = 0) => {
            if (!root.isConnected || (state.modal && !state.modal.contains(root))) return;
            if (!SettingsStore.data.calendarEnabled) {
                root.innerHTML = `<div style="padding:12px;color:var(--tm-secondary-text);">日历视图已关闭，可在设置 → 日历中开启。</div>`;
                return;
            }
            if (globalThis.__tmCalendar && typeof globalThis.__tmCalendar.mount === 'function') {
                const ok = globalThis.__tmCalendar.mount(root, { settingsStore: SettingsStore });
                if (!ok) {
                    root.innerHTML = `<div style="padding:12px;color:var(--tm-secondary-text);">日历初始化失败，请确认 FullCalendar 已加载。</div>`;
                    return;
                }
                try { opts.onMounted?.(root); } catch (e) {}
                return;
            }
            if (attempt >= 80) {
                root.innerHTML = `<div style="padding:12px;color:var(--tm-secondary-text);">日历模块未加载。</div>`;
                return;
            }
            if (attempt === 0) {
                root.innerHTML = `<div style="padding:12px;color:var(--tm-secondary-text);">日历模块加载中...</div>`;
            }
            try { setTimeout(() => mount(attempt + 1), attempt < 8 ? 80 : 160); } catch (e) {}
        };
        mount(0);
        return true;
    }

    function __tmBindBodyOnlyViewAfterSwitch(modeInput, modalEl, sceneInput = null) {
        const mode = String(modeInput || '').trim();
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        const scene = (sceneInput && typeof sceneInput === 'object') ? sceneInput : null;
        if (!(modal instanceof Element)) return false;
        if (mode === 'list') {
            if (!(modal.querySelector('.tm-body.tm-body--list') instanceof HTMLElement)) return false;
            try { __tmBindListScrollVisibility(modal); } catch (e) {}
            try { __tmBindAutoLoadMoreOnScroll(modal, 'list'); } catch (e) {}
        } else if (mode === 'checklist') {
            if (!(modal.querySelector('.tm-checklist-scroll') instanceof HTMLElement)) return false;
            try { __tmBindChecklistScrollVisibility(modal); } catch (e) {}
            try { __tmBindChecklistSheetTouchFallback(modal); } catch (e) {}
            try { __tmBindAutoLoadMoreOnScroll(modal, 'checklist'); } catch (e) {}
            try { __tmRefreshChecklistSelectionInPlace(modal, 'view-switch-body-only', { forceRebuild: true }); } catch (e) {}
        } else if (mode === 'timeline') {
            if (!__tmRerenderTimelineInPlace(modal, {
                rowModel: scene?.timelineRowModel,
                rangeRowModel: scene?.timelineFullRowModel,
                reuseLeftRows: true,
            })) return false;
            if (!__tmBindTimelineStageInteractions(modal)) return false;
        } else if (mode === 'kanban') {
            if (!(modal.querySelector('.tm-body.tm-body--kanban') instanceof HTMLElement)) return false;
            try { __tmNormalizeKanbanDetailFloatHost(modal); } catch (e) {}
            try { __tmBindKanbanPan(modal); } catch (e) {}
            try { __tmScheduleKanbanBottomNavAvoidance(modal); } catch (e) {}
            try { __tmRefreshKanbanDetailInPlace(modal, { source: 'view-switch-body-only' }); } catch (e) {}
            try { __tmSyncKanbanHeadingModeSegmentedUi(modal); } catch (e) {}
        } else if (mode === 'calendar') {
            if (!__tmMountCalendarViewRoot(modal, {
                onMounted: () => __tmRestoreBodyOnlyViewScroll('calendar', modal),
            })) return false;
        } else if (mode === 'whiteboard') {
            if (!(modal.querySelector('.tm-body.tm-body--whiteboard') instanceof HTMLElement)) return false;
            try { __tmBindWhiteboardViewportInput(modal); } catch (e) {}
            try { __tmApplyWhiteboardTransform(); } catch (e) {}
            try { __tmScheduleWhiteboardEdgeRedraw(); } catch (e) {}
            try { __tmUpdateWhiteboardNavigator(); } catch (e) {}
        } else {
            return false;
        }
        __tmScheduleAfterNextPaint(() => {
            if (state.modal !== modal || String(modal.getAttribute('data-tm-render-mode') || '').trim() !== mode) return;
            try { __tmBindResponsiveTableResize(modal); } catch (e) {}
            try { __tmApplySearchHighlights(modal, state.searchKeyword); } catch (e) {}
            try { __tmApplyReminderTaskNameMarks(modal); } catch (e) {}
            try { __tmScheduleReminderTaskNameMarksRefresh(modal); } catch (e) {}
            try { __tmApplyTodayScheduledTaskNameMarks(modal); } catch (e) {}
            try { __tmScheduleTodayScheduledTaskNameMarksRefresh(modal); } catch (e) {}
            try { __tmBindFloatingTooltips(modal); } catch (e) {}
            try { __tmBindTopbarOverflowTooltips(modal); } catch (e) {}
            try { __tmSyncCurrentViewDomRenderSignature(mode); } catch (e) {}
        });
        return true;
    }

    function __tmReleaseDetachedViewStage(stageEl) {
        const stage = stageEl instanceof HTMLElement ? stageEl : null;
        if (!stage) return;
        const clear = () => {
            try { stage.replaceChildren(); } catch (e) {}
        };
        try {
            if (typeof requestIdleCallback === 'function') {
                requestIdleCallback(clear, { timeout: 500 });
                return;
            }
        } catch (e) {}
        try { setTimeout(clear, 48); } catch (e) { clear(); }
    }

    const __TM_PERSISTENT_SIDE_DOCKS = Object.freeze([
        Object.freeze({ key: 'calendar', selector: '.tm-calendar-side-dock', hostSelector: '#tmCalendarSideDockPanel', scrollSelector: '#tmCalendarSideDockTimeline', sceneKey: 'showCalendarSideDock' }),
        Object.freeze({ key: 'ai', selector: '.tm-ai-side-dock', hostSelector: '#tmAiSidebarPanel', scrollSelector: '.tm-agent-messages', sceneKey: 'showAiSideDock' }),
    ]);

    function __tmGetPersistentSideDockScrollHost(key, dockNode, scrollSelector) {
        const root = dockNode instanceof HTMLElement ? dockNode : null;
        if (!root) return null;
        const candidate = root.querySelector(scrollSelector);
        if (key === 'calendar') return __tmGetCalendarScrollHost(candidate);
        return candidate instanceof HTMLElement ? candidate : null;
    }

    function __tmCapturePersistentSideDockScroll(config, dockNode) {
        const scrollHost = __tmGetPersistentSideDockScrollHost(config.key, dockNode, config.scrollSelector);
        if (!(scrollHost instanceof HTMLElement)) return null;
        return {
            top: Number(scrollHost.scrollTop) || 0,
            left: Number(scrollHost.scrollLeft) || 0,
        };
    }

    function __tmRestorePersistentSideDockScroll(transfers) {
        const list = Array.isArray(transfers) ? transfers : [];
        const apply = () => {
            for (const transfer of list) {
                if (!transfer?.scrollSnapshot || !(transfer.currentNode instanceof HTMLElement) || !transfer.currentNode.isConnected) continue;
                const scrollHost = __tmGetPersistentSideDockScrollHost(transfer.key, transfer.currentNode, transfer.scrollSelector);
                if (!(scrollHost instanceof HTMLElement)) continue;
                scrollHost.scrollTop = Number(transfer.scrollSnapshot.top) || 0;
                scrollHost.scrollLeft = Number(transfer.scrollSnapshot.left) || 0;
            }
        };
        try { apply(); } catch (e) {}
        try { requestAnimationFrame(apply); } catch (e) {}
    }

    function __tmPreparePersistentSideDockTransfers(currentStage, nextStage, scene) {
        if (!(currentStage instanceof HTMLElement) || !(nextStage instanceof HTMLElement) || !scene) return null;
        const transfers = [];
        for (const config of __TM_PERSISTENT_SIDE_DOCKS) {
            const currentNodes = Array.from(currentStage.querySelectorAll(config.selector));
            const nextNodes = Array.from(nextStage.querySelectorAll(config.selector));
            const expectedCount = scene[config.sceneKey] === true ? 1 : 0;
            if (currentNodes.length !== expectedCount || nextNodes.length !== expectedCount) return null;
            if (!expectedCount) continue;
            const currentNode = currentNodes[0];
            const placeholderNode = nextNodes[0];
            if (!(currentNode instanceof HTMLElement) || !(placeholderNode instanceof HTMLElement)) return null;
            if (!(currentNode.querySelector(config.hostSelector) instanceof HTMLElement)) return null;
            transfers.push({
                key: config.key,
                currentNode,
                placeholderNode,
                scrollSelector: config.scrollSelector,
                scrollSnapshot: __tmCapturePersistentSideDockScroll(config, currentNode),
            });
        }
        return transfers;
    }

    function __tmCommitPersistentSideDockTransfers(transfers) {
        const list = Array.isArray(transfers) ? transfers : [];
        for (const transfer of list) {
            transfer.placeholderNode.replaceWith(transfer.currentNode);
        }
        return list;
    }

    function __tmSyncPersistentSideDocksAfterViewSwitch(transfers, modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        const keys = new Set((Array.isArray(transfers) ? transfers : []).map((item) => String(item?.key || '').trim()));
        if (keys.has('calendar')) {
            const timelineRoot = modal?.querySelector?.('#tmCalendarSideDockTimeline');
            if (timelineRoot instanceof HTMLElement) {
                try { __tmCalendarDockMountTimeline(timelineRoot); } catch (e) {}
            }
        }
        __tmRestorePersistentSideDockScroll(transfers);
        if (keys.has('ai')) {
            __tmScheduleAfterNextPaint(() => {
                try { globalThis.__tmAI?.notifyTaskViewChanged?.(); } catch (e) {}
            });
        }
    }

    function __tmTrySwitchViewBodyInPlace(prevModeInput, nextModeInput) {
        const prevMode = String(prevModeInput || '').trim();
        const nextMode = String(nextModeInput || '').trim();
        if (!__TM_BODY_ONLY_VIEW_SWITCH_MODES.has(prevMode) || !__TM_BODY_ONLY_VIEW_SWITCH_MODES.has(nextMode)) return false;
        if (state.homepageOpen || state.attachmentLibraryOpen) return false;
        const modal = state.modal instanceof HTMLElement ? state.modal : null;
        if (!modal || !modal.isConnected) return false;
        if (modal.querySelector('.tm-ai-mobile-shell,.tm-checklist-sheet--open,.tm-task-detail-inline-popover')) return false;
        const activeDetailPanel = modal.querySelector('#tmChecklistDetailPanel,#tmKanbanDetailPanel,#tmTaskDetailSheetPanel');
        if (activeDetailPanel?.__tmTaskDetailPendingSave === true || activeDetailPanel?.__tmTaskDetailActiveInlinePopover || activeDetailPanel?.__tmTaskDetailNoteActive === true) return false;
        const stage = modal.querySelector('.tm-main-stage');
        const toolbarExtra = modal.querySelector('[data-tm-view-toolbar-extra="1"]');
        if (!(stage instanceof HTMLElement) || !(toolbarExtra instanceof HTMLElement) || modal.querySelectorAll('.tm-main-stage').length !== 1) return false;

        try {
            const isMobile = !!__tmIsMobileDevice();
            const isRuntimeMobile = !!__tmIsRuntimeMobileClient();
            const isDockHost = !!__tmIsDockHost();
            const isLandscape = !!(isMobile && window.matchMedia?.('(orientation: landscape)')?.matches);
            const isDesktopNarrow = !!(!isMobile && window.matchMedia?.('(max-width: 768px)')?.matches);
            const scene = __tmBuildRenderSceneContext({
                bodyAnimClass: '',
                tableAvailableWidth: Number(state.tableAvailableWidth) || 0,
                isMobile,
                isDockHost,
                isRuntimeMobile,
                isLandscape,
                isDesktopNarrow,
                mountEl: modal.classList.contains('tm-modal--tab') ? modal.parentElement : null,
            });
            if (String(scene?.renderMode || '').trim() !== nextMode || scene.showMultiSelectBar) return false;
            const bodyHtml = String(scene.mainBodyHtml || '').trim();
            if (!bodyHtml) return false;
            const nextStage = document.createElement('div');
            nextStage.className = [
                'tm-main-stage',
                scene.showMobileBottomViewBar ? 'tm-main-stage--with-bottom-viewbar' : '',
                scene.showTimelineFloatingToolbar ? 'tm-main-stage--timeline-floating-toolbar' : '',
            ].filter(Boolean).join(' ');
            nextStage.style.setProperty('--tm-view-bottom-inset', String(scene.mainStageBottomInset || '0px'));
            nextStage.innerHTML = `${scene.timelineFloatingToolbarHtml || ''}${scene.bodyWithSideDockHtml || bodyHtml}${scene.multiSelectBarHtml || ''}${scene.taskDetailSheetHtml || ''}`;
            const persistentDockTransfers = __tmPreparePersistentSideDockTransfers(stage, nextStage, scene);
            if (!persistentDockTransfers) return false;
            __tmCaptureBodyOnlyViewScroll(prevMode, modal);
            try { __tmHideFloatingTooltip(); } catch (e) {}
            if (prevMode === 'timeline') {
                try { __tmClearTimelineTodayIndicatorTimer(); } catch (e) {}
                try { modal.__tmTimelineStageInteractionsCleanup?.(); } catch (e) {}
            }
            if (prevMode === 'kanban') {
                try { __tmClearKanbanDetailFloatingHandlers(); } catch (e) {}
            }
            state.listDomRenderSignature = '';
            toolbarExtra.innerHTML = __tmRenderBodyOnlyViewToolbarExtra(nextMode, scene);
            __tmCommitPersistentSideDockTransfers(persistentDockTransfers);
            stage.replaceWith(nextStage);
            const cleanupPreviousView = () => {
                if (prevMode === 'calendar') {
                    try { globalThis.__tmCalendar?.unmount?.({ preserveRootHtml: false }); } catch (e) {}
                }
            };
            cleanupPreviousView();
            __tmReleaseDetachedViewStage(stage);
            modal.setAttribute('data-tm-render-mode', nextMode);
            __tmSyncBodyOnlyViewSwitcherButtons(modal, nextMode);
            if (!__tmBindBodyOnlyViewAfterSwitch(nextMode, modal, scene)) return false;
            __tmSyncPersistentSideDocksAfterViewSwitch(persistentDockTransfers, modal);
            __tmRestoreBodyOnlyViewScroll(nextMode, modal);
            return true;
        } catch (e) {
            try { __tmPushDiagnosticLog('view-switch-body-only-failed', e, { from: prevMode, to: nextMode }); } catch (e2) {}
            return false;
        }
    }

    window.tmHandleCalendarViewButtonContextMenu = async function(ev) {
        try { ev?.preventDefault?.(); } catch (e) {}
        try { ev?.stopPropagation?.(); } catch (e) {}
        try { await window.tmToggleCalendarSideDock(); } catch (e) {}
        return false;
    };

    window.tmSwitchViewMode = function(mode) {
        const next = __tmGetSafeViewMode(mode);
        const prev = globalThis.__tmRuntimeState?.getViewMode?.('') || String(state.viewMode || '').trim();
        let forceFullRender = false;
        state.viewModeInitialized = true;
        if (state.homepageOpen) {
            state.homepageOpen = false;
            forceFullRender = true;
            try { __tmInvalidateHomepageMount(); } catch (e) {}
            try { Storage.set('tm_homepage_open', false); } catch (e) {}
        } else if (state.attachmentLibraryOpen) {
            state.attachmentLibraryOpen = false;
            forceFullRender = true;
        } else if (prev === next) {
            return;
        }
        const perfTrace = __tmCreatePerfTrace('switchViewMode', {
            from: prev || 'unknown',
            to: next || 'unknown',
            currentGroupId: String(SettingsStore?.data?.currentGroupId || 'all').trim() || 'all',
        });
        __tmPerfTraceMark(perfTrace, 'view-switch-start', {
            from: prev || 'unknown',
            to: next || 'unknown',
        });
        state.viewMode = next;
        state.uiAnimKind = '';
        state.uiAnimTs = 0;
        try {
            const mobileLike = !!(__tmIsMobileDevice() || __tmIsRuntimeMobileClient() || __tmHostUsesMobileUI());
            __tmMarkHighPriorityInteraction('view-switch', mobileLike ? 460 : 240);
        } catch (e) {}
        try { __tmHideMobileMenu(); } catch (e) {}
        if (next === 'whiteboard') {
            try { __tmCalendarFloatingDragEnd(); } catch (e) {}
        }
        try { __tmCancelProgressiveViewRender(); } catch (e) {}
        const generation = Math.max(0, Math.round(Number(state.__tmViewSwitchCommitGeneration) || 0)) + 1;
        state.__tmViewSwitchCommitGeneration = generation;
        const pendingModal = __tmShowViewSwitchPendingShell(next);
        __tmScheduleViewSwitchCommit(generation, next, () => {
            if (pendingModal && (!pendingModal.isConnected || state.modal !== pendingModal)) {
                __tmClearViewSwitchPendingShell(pendingModal);
                return;
            }
            let progressiveJob = null;
            try {
                const liveModal = state.modal instanceof HTMLElement ? state.modal : null;
                const renderedMode = String(liveModal?.getAttribute('data-tm-render-mode') || prev || '').trim();
                if (forceFullRender || renderedMode !== next) {
                    const needRefilter = !!SettingsStore.data.whiteboardSequenceMode && (renderedMode === 'whiteboard' || next === 'whiteboard');
                    if (needRefilter) {
                        try { applyFilters(); } catch (e) {}
                    }
                    progressiveJob = __tmStartProgressiveViewRender(next);
                    try { __tmResetViewRenderWindow(next); } catch (e) {}
                    if (forceFullRender || !__tmTrySwitchViewBodyInPlace(renderedMode, next)) {
                        state.__tmPreserveShellDuringViewSwitchRender = true;
                        try { render(); } finally { state.__tmPreserveShellDuringViewSwitchRender = false; }
                    }
                }
            } finally {
                __tmClearViewSwitchPendingShell(pendingModal);
                if (state.modal !== pendingModal) __tmClearViewSwitchPendingShell(state.modal);
            }
            try { __tmScheduleProgressiveViewRender(next, progressiveJob); } catch (e) {}
            if (next === 'timeline') {
                try { __tmScheduleTimelineDateHydrationAfterViewSwitch(generation); } catch (e) {}
            }
            __tmScheduleAfterNextPaint(() => {
                if (Number(state.__tmViewSwitchCommitGeneration || 0) !== generation) return;
                try {
                    const viewMode = globalThis.__tmRuntimeState?.getViewMode?.(next || 'unknown') || String(state.viewMode || '').trim() || next || 'unknown';
                    __tmPerfTraceMark(perfTrace, 'view-switch-done', {
                        from: prev || 'unknown',
                        to: next || 'unknown',
                        viewMode,
                    });
                    __tmPerfTraceFinish(perfTrace, {
                        from: prev || 'unknown',
                        to: next || 'unknown',
                        viewMode,
                    });
                } catch (e) {}
            });
            if (next === 'whiteboard') {
                try {
                    requestAnimationFrame(() => {
                        try { window.tmWhiteboardResetView?.(); } catch (e) {}
                    });
                } catch (e) {}
            }
        });
    };

