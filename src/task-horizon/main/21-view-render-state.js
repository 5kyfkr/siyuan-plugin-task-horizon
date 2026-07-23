    const __TM_VIEW_RENDER_WINDOW_POLICY = Object.freeze({
        list: Object.freeze({ desktopInitial: 80, mobileInitial: 64, desktopGrow: 40, mobileGrow: 32 }),
        checklist: Object.freeze({ desktopInitial: 120, mobileInitial: 96, desktopGrow: 60, mobileGrow: 48 }),
    });

    function __tmIsListLikeViewMode(mode) {
        const value = String(mode || state?.viewMode || '').trim();
        return value === 'list' || value === 'checklist';
    }

    function __tmGetViewRenderWindowPolicy(mode = '') {
        const value = String(mode || state?.viewMode || 'list').trim() || 'list';
        const source = __TM_VIEW_RENDER_WINDOW_POLICY[value] || __TM_VIEW_RENDER_WINDOW_POLICY.list;
        let mobileLike = false;
        try {
            mobileLike = !!(__tmIsMobileDevice() || __tmIsRuntimeMobileClient() || __tmHostUsesMobileUI());
        } catch (e) {}
        return {
            mode: value,
            initial: mobileLike ? source.mobileInitial : source.desktopInitial,
            grow: mobileLike ? source.mobileGrow : source.desktopGrow,
        };
    }

    function __tmResetViewRenderWindow(mode = '', totalInput = null) {
        const value = String(mode || state?.viewMode || '').trim();
        if (!__tmIsListLikeViewMode(value)) return null;
        const policy = __tmGetViewRenderWindowPolicy(value);
        const total = Number.isFinite(Number(totalInput))
            ? Math.max(0, Math.round(Number(totalInput)))
            : Math.max(0, Array.isArray(state?.filteredTasks) ? state.filteredTasks.length : 0);
        state.listRenderStep = policy.initial;
        state.listRenderLimit = total > 0 ? Math.min(total, policy.initial) : policy.initial;
        return {
            ...policy,
            total,
            limit: state.listRenderLimit,
        };
    }

    function __tmGetViewRenderWindow(mode = '', totalInput = null) {
        const value = String(mode || state?.viewMode || '').trim();
        if (!__tmIsListLikeViewMode(value)) return null;
        const policy = __tmGetViewRenderWindowPolicy(value);
        const total = Number.isFinite(Number(totalInput))
            ? Math.max(0, Math.round(Number(totalInput)))
            : Math.max(0, Array.isArray(state?.filteredTasks) ? state.filteredTasks.length : 0);
        const currentLimit = Math.max(
            Math.min(total || policy.initial, policy.initial),
            Math.min(total || policy.initial, Number(state?.listRenderLimit) || policy.initial)
        );
        return {
            ...policy,
            total,
            limit: currentLimit,
            remaining: Math.max(0, total - currentLimit),
        };
    }

    function __tmGrowViewRenderWindow(mode = '', totalInput = null) {
        const current = __tmGetViewRenderWindow(mode, totalInput);
        if (!current) return null;
        const nextLimit = Math.min(current.total, current.limit + current.grow);
        state.listRenderStep = current.initial;
        state.listRenderLimit = nextLimit;
        return {
            ...current,
            previousLimit: current.limit,
            limit: nextLimit,
            remaining: Math.max(0, current.total - nextLimit),
        };
    }
