    function __tmShouldShowCalendarSideDock() {
        if (state.homepageOpen) return false;
        const mode = globalThis.__tmRuntimeState?.getViewMode?.('') || String(state.viewMode || '').trim();
        if (!SettingsStore.data.calendarSideDockEnabled) return false;
        return mode === 'list' || mode === 'checklist' || mode === 'timeline' || mode === 'kanban' || mode === 'whiteboard';
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
            <div id="tmCalendarSideDockTimeline" style="flex:1 1 auto;min-height:0;"></div>
        `;
    }

    function __tmCalendarDockMount() {
        const root = state.modal?.querySelector?.('#tmCalendarSideDockPanel');
        if (!(root instanceof HTMLElement)) return;
        root.innerHTML = __tmCalendarDockBuildPanelHtml();
        const timelineRoot = root.querySelector('#tmCalendarSideDockTimeline');
        if (!(timelineRoot instanceof HTMLElement)) return;
        if (!globalThis.__tmCalendar || typeof globalThis.__tmCalendar.mountSideDayTimeline !== 'function') {
            timelineRoot.innerHTML = `<div style="padding:12px;color:var(--tm-secondary-text);">日历模块未加载。</div>`;
            return;
        }
        const dragHost = (() => {
            const modal = state.modal;
            const viewMode = globalThis.__tmRuntimeState?.getViewMode?.('') || String(state.viewMode || '').trim();
            if (!(modal instanceof Element)) return null;
            if (viewMode === 'timeline') return modal.querySelector('#tmTimelineLeftTable tbody');
            if (viewMode === 'kanban') return modal.querySelector('.tm-body.tm-body--kanban');
            if (viewMode === 'checklist') return modal.querySelector('.tm-checklist-items');
            return modal.querySelector('#tmTaskTable tbody');
        })();
        const ok = globalThis.__tmCalendar.mountSideDayTimeline(timelineRoot, {
            settingsStore: SettingsStore,
            date: __tmCalendarDockGetDateKey(),
            resolveTask: (taskId) => globalThis.__tmRuntimeState?.getFlatTaskById?.(taskId) || state.flatTasks?.[String(taskId || '').trim()] || null,
            dragHost: dragHost || state.modal,
            enableExternalDrag: false,
        });
        if (!ok) {
            timelineRoot.innerHTML = `<div style="padding:12px;color:var(--tm-secondary-text);">日历初始化失败。</div>`;
            return;
        }
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
        if (!SettingsStore.data.aiSideDockEnabled) return false;
        if (state.homepageOpen) return true;
        const mode = globalThis.__tmRuntimeState?.getViewMode?.('') || String(state.viewMode || '').trim();
        return mode === 'list' || mode === 'checklist' || mode === 'timeline' || mode === 'kanban' || mode === 'whiteboard' || mode === 'calendar';
    }

    async function __tmMountAiSidebarHost(payload) {
        const isMobile = __tmIsMobileDevice();
        const host = state.modal?.querySelector?.(isMobile ? '#tmAiMobileSidebarPanel' : '#tmAiSidebarPanel');
        if (!(host instanceof HTMLElement)) return false;
        const ready = await __tmEnsureAiRuntimeLoaded();
        if (!ready) return false;
        if (globalThis.__tmAI?.mountSidebar) {
            try { await globalThis.__tmAI.mountSidebar(host, { mobile: isMobile }); } catch (e) {}
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
        if (__tmIsMobileDevice()) {
            state.aiMobilePanelOpen = false;
        } else {
            state.aiSidebarOpen = false;
            try { Storage.set('tm_ai_sidebar_open', false); } catch (e) {}
        }
        render();
    };

    window.tmToggleAiSideDock = async function(enabled) {
        const next = (typeof enabled === 'boolean') ? enabled : !SettingsStore.data.aiSideDockEnabled;
        SettingsStore.data.aiSideDockEnabled = !!next;
        try { await SettingsStore.save(); } catch (e) {}
        if (!next) {
            if (__tmIsMobileDevice()) {
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
        if (__tmIsMobileDevice()) {
            if (state.aiMobilePanelOpen) return window.tmCloseAiSidebar();
            return await window.tmOpenAiSidebar(payload);
        }
        if (state.aiSidebarOpen) return window.tmCloseAiSidebar();
        return await window.tmOpenAiSidebar(payload);
    };

    window.tmOpenAiSidebar = async function(payload) {
        if (SettingsStore.data.aiSideDockEnabled !== true) {
            SettingsStore.data.aiSideDockEnabled = true;
            try { await SettingsStore.save(); } catch (e) {}
        }
        if (__tmIsMobileDevice()) {
            state.aiMobilePanelOpen = true;
        } else {
            state.aiSidebarOpen = true;
            try { Storage.set('tm_ai_sidebar_open', true); } catch (e) {}
        }
        await openManager({ preserveViewMode: true, skipLoadingHint: true });
        try { render(); } catch (e) {}
        try { await __tmMountAiSidebarHost(payload); } catch (e) {}
        return true;
    };

    window.tmOpenHomepage = async function() {
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

    window.tmToggleHomepage = async function(ev) {
        try { ev?.preventDefault?.(); } catch (e) {}
        try { ev?.stopPropagation?.(); } catch (e) {}
        if (state.homepageOpen) return window.tmCloseHomepage();
        return await window.tmOpenHomepage();
    };

    window.tmHandleCalendarViewButtonContextMenu = async function(ev) {
        try { ev?.preventDefault?.(); } catch (e) {}
        try { ev?.stopPropagation?.(); } catch (e) {}
        try { await window.tmToggleCalendarSideDock(); } catch (e) {}
        return false;
    };

    window.tmSwitchViewMode = function(mode) {
        const next = __tmGetSafeViewMode(mode);
        const prev = globalThis.__tmRuntimeState?.getViewMode?.('') || String(state.viewMode || '').trim();
        if (state.homepageOpen) {
            state.homepageOpen = false;
            try { __tmInvalidateHomepageMount(); } catch (e) {}
            try { Storage.set('tm_homepage_open', false); } catch (e) {}
            if (prev === next) {
                render();
                return;
            }
        } else if (prev === next) {
            return;
        }
        const enabledViews = __tmGetEnabledViews();
        const prevIdx = enabledViews.indexOf(prev);
        const nextIdx = enabledViews.indexOf(next);
        const perfTrace = __tmCreatePerfTrace('switchViewMode', {
            from: prev || 'unknown',
            to: next || 'unknown',
            currentGroupId: String(SettingsStore?.data?.currentGroupId || 'all').trim() || 'all',
        });
        __tmPerfTraceMark(perfTrace, 'view-switch-start', {
            from: prev || 'unknown',
            to: next || 'unknown',
        });
        const needRefilter = !!SettingsStore.data.whiteboardSequenceMode && (prev === 'whiteboard' || next === 'whiteboard');
        state.viewMode = next;
        state.uiAnimKind = (prevIdx >= 0 && nextIdx >= 0 && nextIdx !== prevIdx)
            ? (nextIdx > prevIdx ? 'from-right' : 'from-left')
            : '';
        state.uiAnimTs = Date.now();
        try { __tmHideMobileMenu(); } catch (e) {}
        if (next === 'whiteboard') {
            try { __tmCalendarFloatingDragEnd(); } catch (e) {}
        }
        if (needRefilter) {
            try { applyFilters(); } catch (e) {}
        }
        render();
        try {
            requestAnimationFrame(() => requestAnimationFrame(() => {
                try {
                    __tmPerfTraceMark(perfTrace, 'view-switch-done', {
                        from: prev || 'unknown',
                        to: next || 'unknown',
                        viewMode: globalThis.__tmRuntimeState?.getViewMode?.(next || 'unknown') || String(state.viewMode || '').trim() || next || 'unknown',
                    });
                    __tmPerfTraceFinish(perfTrace, {
                        from: prev || 'unknown',
                        to: next || 'unknown',
                        viewMode: globalThis.__tmRuntimeState?.getViewMode?.(next || 'unknown') || String(state.viewMode || '').trim() || next || 'unknown',
                    });
                } catch (e) {}
            }));
        } catch (e) {
            try {
                __tmPerfTraceMark(perfTrace, 'view-switch-done', {
                    from: prev || 'unknown',
                    to: next || 'unknown',
                    viewMode: globalThis.__tmRuntimeState?.getViewMode?.(next || 'unknown') || String(state.viewMode || '').trim() || next || 'unknown',
                });
                __tmPerfTraceFinish(perfTrace, {
                    from: prev || 'unknown',
                    to: next || 'unknown',
                    viewMode: globalThis.__tmRuntimeState?.getViewMode?.(next || 'unknown') || String(state.viewMode || '').trim() || next || 'unknown',
                });
            } catch (e2) {}
        }
        if (next !== 'calendar') {
            const refreshDock = () => {
                try { globalThis.__tmCalendar?.refreshSideDayLayout?.(); } catch (e) {}
                try { globalThis.__tmCalendar?.relayoutSideDayDate?.(); } catch (e) {}
            };
            try { requestAnimationFrame(refreshDock); } catch (e) {}
            try { requestAnimationFrame(() => requestAnimationFrame(refreshDock)); } catch (e) {}
            try { setTimeout(refreshDock, 0); } catch (e) {}
            try { setTimeout(refreshDock, 80); } catch (e) {}
        }
        if (next === 'whiteboard') {
            try {
                requestAnimationFrame(() => {
                    try { window.tmWhiteboardResetView?.(); } catch (e) {}
                });
            } catch (e) {}
        }
    };

