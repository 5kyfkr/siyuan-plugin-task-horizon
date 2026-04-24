(function () {
    const getSnapshot = () => {
        const compat = globalThis.__tmCompat || null;
        let legacyTabSwitch = false;
        try {
            legacyTabSwitch = typeof compat?.getCenterLayout?.()?.switchTab === 'function';
        } catch (e) {}
        let legacyScrollToBlock = false;
        try {
            legacyScrollToBlock = typeof window.siyuan?.block?.scrollToBlock === 'function';
        } catch (e) {}
        return {
            breadcrumbHook: !!compat?.findBreadcrumb?.(),
            commonMenuHook: !!compat?.findCommonMenuItems?.(),
            nativeTaskCheckboxDom: !!compat?.findTaskCheckboxAction?.(document.body),
            activeWndDom: !!compat?.findActiveWindow?.(),
            legacyTabSwitch,
            legacyScrollToBlock,
            dockHostDom: !!queryDockHost(),
        };
    };

    const queryDockHost = () => {
        try {
            const found = document.querySelector('.dock__item, .dock__panel');
            return found instanceof HTMLElement ? found : null;
        } catch (e) {
            return null;
        }
    };

    globalThis.__tmCaps = {
        snapshot: getSnapshot,
        has(name) {
            const key = String(name || '').trim();
            if (!key) return false;
            return getSnapshot()[key] === true;
        },
    };
})();
