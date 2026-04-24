(function () {
    const __TM_RUNTIME_STATE_DEFAULT_MODAL = Symbol('tm-runtime-state-default-modal');

    const normalizeId = (value) => String(value || '').trim();

    const getModal = () => {
        try {
            return state?.modal || null;
        } catch (e) {
            return null;
        }
    };

    const hasLiveModal = (modalEl = __TM_RUNTIME_STATE_DEFAULT_MODAL) => {
        const modal = modalEl === __TM_RUNTIME_STATE_DEFAULT_MODAL ? getModal() : modalEl;
        if (!(modal instanceof Element)) return false;
        try {
            return !!document.body?.contains?.(modal);
        } catch (e) {
            return false;
        }
    };

    const getOpenToken = () => {
        try {
            return Number(state?.openToken) || 0;
        } catch (e) {
            return 0;
        }
    };

    const nextOpenToken = () => {
        try {
            state.openToken = getOpenToken() + 1;
            return getOpenToken();
        } catch (e) {
            return getOpenToken();
        }
    };

    const isCurrentOpenToken = (token) => (Number(token) || 0) === getOpenToken();

    const getViewMode = (fallback = '') => {
        try {
            const current = String(state?.viewMode || '').trim();
            if (current) return current;
        } catch (e) {}
        return String(fallback || '').trim();
    };

    const isViewMode = (mode) => getViewMode() === normalizeId(mode);

    const isAnyViewMode = (modes) => {
        const current = getViewMode();
        if (!current || !Array.isArray(modes)) return false;
        return modes.some((mode) => normalizeId(mode) === current);
    };

    const getActiveRenderMode = (fallback = '') => {
        try {
            if (state?.homepageOpen) return 'home';
        } catch (e) {}
        return getViewMode(fallback);
    };

    const getFlatTaskById = (id) => {
        const tid = normalizeId(id);
        if (!tid) return null;
        try {
            return state?.flatTasks?.[tid] || null;
        } catch (e) {
            return null;
        }
    };

    const getPendingTaskById = (id) => {
        const tid = normalizeId(id);
        if (!tid) return null;
        try {
            return state?.pendingInsertedTasks?.[tid] || null;
        } catch (e) {
            return null;
        }
    };

    const getTaskById = (id, options = {}) => {
        const tid = normalizeId(id);
        if (!tid) return null;
        const includePending = options?.includePending !== false;
        const preferPending = options?.preferPending === true;
        if (preferPending) {
            const pendingFirst = getPendingTaskById(tid);
            if (pendingFirst) return pendingFirst;
        }
        const liveTask = getFlatTaskById(tid);
        if (liveTask) return liveTask;
        return includePending ? getPendingTaskById(tid) : null;
    };

    globalThis.__tmRuntimeState = {
        normalizeId,
        getModal,
        hasLiveModal,
        getOpenToken,
        nextOpenToken,
        isCurrentOpenToken,
        getViewMode,
        isViewMode,
        isAnyViewMode,
        getActiveRenderMode,
        getFlatTaskById,
        getPendingTaskById,
        getTaskById,
    };

    const on = (target, name, handler, options) => {
        if (!target || typeof target.addEventListener !== 'function') return false;
        if (!String(name || '').trim() || typeof handler !== 'function') return false;
        try {
            target.addEventListener(name, handler, options);
            return true;
        } catch (e) {
            return false;
        }
    };

    const off = (target, name, handler, options) => {
        if (!target || typeof target.removeEventListener !== 'function') return false;
        if (!String(name || '').trim() || typeof handler !== 'function') return false;
        try {
            target.removeEventListener(name, handler, options);
            return true;
        } catch (e) {
            return false;
        }
    };

    const listen = (target, name, handler, options) => {
        if (!on(target, name, handler, options)) return () => false;
        return () => off(target, name, handler, options);
    };

    const getEventBus = () => {
        try {
            return globalThis.__tmHost?.getEventBus?.() || null;
        } catch (e) {
            return null;
        }
    };

    const onEventBus = (name, handler, eventBus = null) => {
        const bus = eventBus || getEventBus();
        if (!bus || typeof bus.on !== 'function') return false;
        if (!String(name || '').trim() || typeof handler !== 'function') return false;
        try {
            bus.on(name, handler);
            return true;
        } catch (e) {
            return false;
        }
    };

    const offEventBus = (name, handler, eventBus = null) => {
        const bus = eventBus || getEventBus();
        if (!bus || typeof bus.off !== 'function') return false;
        if (!String(name || '').trim() || typeof handler !== 'function') return false;
        try {
            bus.off(name, handler);
            return true;
        } catch (e) {
            return false;
        }
    };

    globalThis.__tmRuntimeEvents = {
        on,
        off,
        listen,
        getEventBus,
        onEventBus,
        offEventBus,
    };
})();
