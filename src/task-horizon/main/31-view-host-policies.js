(function () {
    const hasCalendarSidebarChecklist = (modalEl = null) => {
        try {
            return !!__tmHasCalendarSidebarChecklist(modalEl);
        } catch (e) {
            return false;
        }
    };

    const shouldPreserveCalendarSidebarChecklistScroll = (viewMode, modalEl = null) => {
        return String(viewMode || '').trim() === 'calendar' && hasCalendarSidebarChecklist(modalEl);
    };

    const shouldSuppressMobileCalendarSidebarContextMenu = (modalEl = null) => {
        try {
            const runtimeMobile = globalThis.__tmRuntimeHost?.getInfo?.()?.runtimeMobileClient ?? __tmIsRuntimeMobileClient();
            return !!(hasCalendarSidebarChecklist(modalEl) && runtimeMobile);
        } catch (e) {
            return false;
        }
    };

    const getCompactChecklistMetaFieldsForCurrentHost = () => {
        try {
            return __tmGetCompactChecklistMetaFieldsForCurrentHost();
        } catch (e) {
            return Array.isArray(__TM_CHECKLIST_COMPACT_META_FIELD_DEFAULTS) ? __TM_CHECKLIST_COMPACT_META_FIELD_DEFAULTS.slice() : [];
        }
    };

    const getCompactChecklistMetaFieldSetForCurrentHost = () => new Set(getCompactChecklistMetaFieldsForCurrentHost());

    const shouldShowCompactChecklistDocName = () => {
        try {
            return __tmShouldShowCompactChecklistDocName();
        } catch (e) {
            return true;
        }
    };

    const getChecklistTitleClickPolicy = () => {
        const scopedJumpSettings = !!__tmChecklistTitleClickUsesScopedJumpSettings();
        const openDetailDrawer = !!__tmShouldOpenChecklistDetailDrawerOnTitleClick();
        const openDetailPage = !!__tmShouldOpenTaskDetailPageOnChecklistTitleClick();
        const jumpOnDock = !!__tmShouldJumpOnDockChecklistTitleClick();
        const jumpOnMobile = !!__tmShouldJumpOnMobileChecklistTitleClick();
        let mode = 'jump-task';
        if (scopedJumpSettings) {
            if (openDetailDrawer) mode = 'open-detail-drawer';
            else if (openDetailPage) mode = 'open-detail-page';
            else if (jumpOnDock || jumpOnMobile) mode = 'jump-task';
            else mode = 'select';
        }
        return {
            scopedJumpSettings,
            jumpOnDock,
            jumpOnMobile,
            openDetailDrawer,
            openDetailPage,
            mode,
        };
    };

    const shouldUseChecklistSheetMode = (modalEl = null) => {
        try {
            if (state.__tmCalendarSidebarChecklistRender === true) return true;
        } catch (e) {}
        if (hasCalendarSidebarChecklist(modalEl)) return true;
        try {
            if (String(state.viewMode || '').trim() === 'checklist' && __tmShouldShowCalendarSideDock()) {
                return true;
            }
        } catch (e) {}
        const modal = modalEl instanceof Element ? modalEl : state?.modal;
        const modalWidth = Number(modal?.clientWidth || 0);
        try {
            if (__tmIsMobileDevice()) return true;
        } catch (e) {}
        if (modalWidth > 0) return modalWidth <= 960;
        return (Number(window.innerWidth || 0) > 0) ? window.innerWidth <= 960 : false;
    };

    const taskDetailSheetViewModes = new Set(['list', 'kanban', 'whiteboard', 'calendar', 'timeline']);

    const getHostWidth = (modalEl = null) => {
        const modal = modalEl instanceof Element ? modalEl : state?.modal;
        const modalWidth = Number(modal?.clientWidth || 0);
        if (modalWidth > 0) return modalWidth;
        try {
            const mountWidth = Number(__tmMountEl?.clientWidth || 0);
            if (mountWidth > 0) return mountWidth;
        } catch (e) {}
        try {
            const windowWidth = Number(window.innerWidth || document.documentElement?.clientWidth || 0);
            if (windowWidth > 0) return windowWidth;
        } catch (e) {}
        return 0;
    };

    const shouldUseTaskDetailSheetMode = (viewMode = '', modalEl = null) => {
        const mode = String(viewMode || '').trim()
            || (globalThis.__tmRuntimeState?.getActiveRenderMode?.('') || '')
            || String(state?.viewMode || '').trim();
        if (!taskDetailSheetViewModes.has(mode)) return false;
        try {
            const desktopDock = globalThis.__tmRuntimeHost?.isDesktopDockHost?.() ?? (__tmIsDockHost() && !__tmIsRuntimeMobileClient());
            if (desktopDock) return true;
        } catch (e) {}
        let mobileLike = false;
        try {
            mobileLike = !!(__tmHostUsesMobileUI() || __tmIsRuntimeMobileClient() || __tmIsMobileDevice());
        } catch (e) {}
        if (!mobileLike) return false;
        const width = getHostWidth(modalEl);
        return width > 0 ? width < 768 : true;
    };

    const shouldUseDockPointerTaskDrag = () => {
        try {
            return globalThis.__tmRuntimeHost?.isDesktopDockHost?.() ?? (__tmIsDockHost() && !__tmIsRuntimeMobileClient());
        } catch (e) {
            return false;
        }
    };

    globalThis.__tmViewPolicy = {
        hasCalendarSidebarChecklist,
        shouldPreserveCalendarSidebarChecklistScroll,
        shouldSuppressMobileCalendarSidebarContextMenu,
        getCompactChecklistMetaFieldsForCurrentHost,
        getCompactChecklistMetaFieldSetForCurrentHost,
        shouldShowCompactChecklistDocName,
        getChecklistTitleClickPolicy,
        shouldUseChecklistSheetMode,
        shouldUseTaskDetailSheetMode,
        shouldUseDockPointerTaskDrag,
    };
})();
