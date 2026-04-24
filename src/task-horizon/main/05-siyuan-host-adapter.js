(function () {
    const getBridge = () => {
        try {
            return globalThis.__taskHorizonHostBridge || null;
        } catch (e) {
            return null;
        }
    };

    const getPlugin = () => {
        try {
            return getBridge()?.plugin || globalThis.__taskHorizonPluginInstance || null;
        } catch (e) {
            return null;
        }
    };

    const getApp = () => {
        try {
            return getBridge()?.app || globalThis.__taskHorizonPluginApp || getPlugin()?.app || window.siyuan?.app || null;
        } catch (e) {
            return null;
        }
    };

    const getEventBus = () => {
        try {
            return getBridge()?.eventBus || getPlugin()?.eventBus || window.siyuan?.eventBus || null;
        } catch (e) {
            return null;
        }
    };

    const getEventBuses = () => {
        const seen = new Set();
        const out = [];
        const push = (candidate) => {
            if (!candidate || seen.has(candidate)) return;
            seen.add(candidate);
            out.push(candidate);
        };
        try { push(getBridge()?.eventBus || null); } catch (e) {}
        try { push(getPlugin()?.eventBus || null); } catch (e) {}
        try { push(window.siyuan?.eventBus || null); } catch (e) {}
        return out;
    };

    const getOpenTabFn = () => {
        try {
            return getBridge()?.openTab || globalThis.__taskHorizonOpenTab || window.openTab || window.siyuan?.openTab || window.siyuan?.ws?.openTab || null;
        } catch (e) {
            return null;
        }
    };

    const getOpenMobileFileByIdFn = () => {
        try {
            return getBridge()?.openMobileFileById || globalThis.__taskHorizonOpenMobileFileById || window.openMobileFileById || window.siyuan?.openMobileFileById || null;
        } catch (e) {
            return null;
        }
    };

    const on = (name, handler) => {
        const eb = getEventBus();
        if (!eb || typeof eb.on !== 'function') return false;
        try {
            eb.on(name, handler);
            return true;
        } catch (e) {
            return false;
        }
    };

    const off = (name, handler) => {
        const eb = getEventBus();
        if (!eb || typeof eb.off !== 'function') return false;
        try {
            eb.off(name, handler);
            return true;
        } catch (e) {
            return false;
        }
    };

    const getAllModels = () => {
        try {
            const bridgeGetter = getBridge()?.getAllModels;
            if (typeof bridgeGetter === 'function') {
                const models = bridgeGetter();
                if (models && typeof models === 'object') return models;
            }
        } catch (e) {}
        try {
            if (typeof window.siyuan?.getAllModels === 'function') {
                const models = window.siyuan.getAllModels();
                if (models && typeof models === 'object') return models;
            }
        } catch (e) {}
        return null;
    };

    const openTaskTab = (...args) => {
        try {
            const fn = getBridge()?.openTaskTab || globalThis.__taskHorizonOpenTabView;
            if (typeof fn !== 'function') return false;
            return fn(...args);
        } catch (e) {
            return false;
        }
    };

    const openMobileFileById = (...args) => {
        const fn = getOpenMobileFileByIdFn();
        if (typeof fn !== 'function') return false;
        try {
            return fn(...args);
        } catch (e) {
            return false;
        }
    };

    const isMobileRuntime = () => {
        try {
            const checker = getBridge()?.isMobileRuntime;
            if (typeof checker === 'function') return checker() === true;
        } catch (e) {}
        try {
            if (globalThis.__taskHorizonPluginIsMobile === true) return true;
        } catch (e) {}
        try {
            if (window.siyuan?.config?.isMobile === true) return true;
        } catch (e) {}
        return false;
    };

    const isNativeMobileRuntime = () => {
        try {
            const checker = getBridge()?.isNativeMobileRuntime;
            if (typeof checker === 'function') return checker() === true;
        } catch (e) {}
        try {
            return globalThis.__taskHorizonPluginIsNativeMobile === true;
        } catch (e) {
            return false;
        }
    };

    const getRuntimeClientKind = () => {
        try {
            const getter = getBridge()?.getRuntimeClientKind;
            if (typeof getter === 'function') return String(getter() || '').trim();
        } catch (e) {}
        try {
            return String(globalThis.__taskHorizonRuntimeClientKind || '').trim();
        } catch (e) {
            return '';
        }
    };

    const getPlatformUtils = () => {
        try {
            return getBridge()?.platformUtils || globalThis.__taskHorizonPlatformUtils || null;
        } catch (e) {
            return null;
        }
    };

    const loadData = async (key, fallback = null) => {
        const plugin = getPlugin();
        if (!plugin || typeof plugin.loadData !== 'function') return fallback;
        try {
            const data = await plugin.loadData(key);
            return data == null ? fallback : data;
        } catch (e) {
            return fallback;
        }
    };

    const saveData = async (key, value) => {
        const plugin = getPlugin();
        if (!plugin || typeof plugin.saveData !== 'function') return false;
        try {
            await plugin.saveData(key, value);
            return true;
        } catch (e) {
            return false;
        }
    };

    const removeData = async (key) => {
        const plugin = getPlugin();
        if (!plugin || typeof plugin.removeData !== 'function') return false;
        try {
            await plugin.removeData(key);
            return true;
        } catch (e) {
            return false;
        }
    };

    const postKernel = async (path, payload, options = {}) => {
        const url = String(path || '').trim();
        if (!url) return null;
        const method = String(options?.method || 'POST').trim().toUpperCase() || 'POST';
        const headers = {
            'Content-Type': 'application/json',
            ...(options?.headers && typeof options.headers === 'object' ? options.headers : {}),
        };
        try {
            const res = await fetch(url, {
                method,
                headers,
                body: method === 'GET' ? undefined : JSON.stringify(payload || {}),
            });
            const text = await res.text();
            try {
                return JSON.parse(text);
            } catch (e) {
                return text;
            }
        } catch (e) {
            return null;
        }
    };

    globalThis.__tmHost = {
        getBridge,
        getPlugin,
        getApp,
        getEventBus,
        getEventBuses,
        getOpenTabFn,
        getOpenMobileFileByIdFn,
        getAllModels,
        getPlatformUtils,
        getRuntimeClientKind,
        isMobileRuntime,
        isNativeMobileRuntime,
        on,
        off,
        openTaskTab,
        openMobileFileById,
        loadData,
        saveData,
        removeData,
        postKernel,
    };
})();
