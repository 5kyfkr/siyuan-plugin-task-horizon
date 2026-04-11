const { Plugin, openTab, openMobileFileById, platformUtils } = require("siyuan");

const PLUGIN_ID = "siyuan-plugin-task-horizon";
const TASK_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/task.js`;
const AI_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/ai.js`;
const QUICKBAR_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/quickbar.js`;
const XLSX_VENDOR_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/src/vendor/xlsx.full.min.js`;
const FULLCALENDAR_MIN_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/src/fullcalendar/index.global.min.js`;
const FULLCALENDAR_ZH_LOCALE_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/src/fullcalendar/locales/zh-cn.global.min.js`;
const BASECOAT_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/src/basecoat/basecoat.js`;
const BASECOAT_CSS_PATH = `/data/plugins/${PLUGIN_ID}/src/basecoat/basecoat.css`;
const CALENDAR_VIEW_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/calendar-view.js`;
const CALENDAR_VIEW_CSS_PATH = `/data/plugins/${PLUGIN_ID}/calendar-view.css`;
const TAB_TYPE = "task-horizon";
const TAB_TITLE = "任务管理器";
const ICON_ID = "iconTaskHorizon";
const CUSTOM_TAB_ID = PLUGIN_ID + TAB_TYPE;
const TASK_DOCK_TYPE = "::task-horizon-dock";
const TASK_DOCK_TITLE = "任务侧栏";
const TASK_DOCK_ROOT_ATTR = "data-task-horizon-dock-root";
const TASK_DOCK_SNAPSHOT_ATTR = "data-task-horizon-dock-snapshot";
const DOCK_VIEW_IDS = new Set(["list", "checklist", "timeline", "kanban", "calendar", "whiteboard"]);

const ICON_SYMBOL = `<symbol id="${ICON_ID}" viewBox="0 0 24 24">
  <g transform="translate(12 12) scale(1.25) translate(-12 -12)" fill="none" stroke="currentColor">
    <path d="M7.25 3.75h9.5c1.105 0 2 .895 2 2v12.5c0 1.105-.895 2-2 2h-9.5c-1.105 0-2-.895-2-2V5.75c0-1.105.895-2 2-2Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path>
    <path d="M8.75 7h6.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
    <path d="M8.75 10.5h6.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
    <path d="M8.75 14h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
    <path d="M12.1 17.6l1.55 1.55 3.2-3.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path>
  </g>
</symbol>`;

const readLocalJson = (key, fallback) => {
    try {
        const raw = globalThis?.localStorage?.getItem?.(key);
        return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
        return fallback;
    }
};

const normalizeDockDefaultViewMode = (value) => {
    const raw = String(value || "").trim();
    return raw === "follow-mobile" || DOCK_VIEW_IDS.has(raw) ? raw : "follow-mobile";
};

const readTaskDockSettings = () => ({
    enabled: readLocalJson("tm_dock_sidebar_enabled", true) !== false,
    defaultViewMode: normalizeDockDefaultViewMode(readLocalJson("tm_dock_default_view_mode", "follow-mobile")),
});

const MOBILE_RUNTIME_CONTAINERS = new Set(["android", "ios", "harmony"]);

const getSiyuanRuntimeBackend = () => {
    try {
        const container = globalThis?.siyuan?.config?.system?.container;
        if (typeof container === "string" && container.trim()) return container.trim().toLowerCase();
    } catch (e) {}
    try {
        const container = window?.siyuan?.config?.system?.container;
        if (typeof container === "string" && container.trim()) return container.trim().toLowerCase();
    } catch (e) {}
    try {
        const os = globalThis?.siyuan?.config?.system?.os;
        if (typeof os === "string" && os.trim()) return os.trim().toLowerCase();
    } catch (e) {}
    try {
        const os = window?.siyuan?.config?.system?.os;
        if (typeof os === "string" && os.trim()) return os.trim().toLowerCase();
    } catch (e) {}
    return "";
};

const hasOfficialMobileRuntimeSignal = () => {
    try {
        if (window?.siyuan?.mobile && typeof window.siyuan.mobile === "object") return true;
    } catch (e) {}
    try {
        if (globalThis?.siyuan?.mobile && typeof globalThis.siyuan.mobile === "object") return true;
    } catch (e) {}
    try {
        if (globalThis?.JSAndroid || globalThis?.JSHarmony) return true;
    } catch (e) {}
    return false;
};

const isRuntimeMobileClient = (pluginInstance = null) => {
    try {
        if (globalThis?.siyuan?.config?.isMobile !== undefined) {
            return !!globalThis.siyuan.config.isMobile;
        }
    } catch (e) {}
    try {
        if (window?.siyuan?.config?.isMobile !== undefined) {
            return !!window.siyuan.config.isMobile;
        }
    } catch (e) {}
    try {
        if (pluginInstance && pluginInstance.isMobile !== undefined) {
            return !!pluginInstance.isMobile;
        }
    } catch (e) {}
    const backend = getSiyuanRuntimeBackend();
    if (MOBILE_RUNTIME_CONTAINERS.has(backend)) return true;
    if (hasOfficialMobileRuntimeSignal()) return true;
    const ua = navigator.userAgent || "";
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
    return false;
};

const findDockTabPath = (node, type, path = []) => {
    if (!node) return null;
    if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i += 1) {
            const found = findDockTabPath(node[i], type, path.concat(i));
            if (found) return found;
        }
        return null;
    }
    if (typeof node === "object") {
        try {
            if (node.type === type) return { path, tab: node };
        } catch (e) {}
        for (const key of Object.keys(node)) {
            const found = findDockTabPath(node[key], type, path.concat(key));
            if (found) return found;
        }
    }
    return null;
};

const getDockPlacementFromHit = (hit) => {
    try {
        const path = hit?.path;
        if (!Array.isArray(path)) return null;
        const area = path.includes("left") ? "left" : path.includes("right") ? "right" : path.includes("bottom") ? "bottom" : null;
        if (!area) return null;

        const dataIdx = path.lastIndexOf("data");
        const groupIndex = dataIdx >= 0 ? path[dataIdx + 1] : null;
        const index = dataIdx >= 0 ? path[dataIdx + 2] : null;
        if (!Number.isFinite(groupIndex) || !Number.isFinite(index)) return null;

        let position = "RightBottom";
        if (area === "left") position = groupIndex === 0 ? "LeftTop" : "LeftBottom";
        if (area === "right") position = groupIndex === 0 ? "RightTop" : "RightBottom";
        if (area === "bottom") position = groupIndex === 0 ? "BottomLeft" : "BottomRight";

        return { position, index };
    } catch (e) {}
    return null;
};

const getDockPlacementFromCurrentUiLayout = (type) => {
    try {
        const uiLayout = globalThis?.siyuan?.config?.uiLayout;
        if (!uiLayout) return null;
        const hit = findDockTabPath(uiLayout, type);
        if (!hit) return null;
        return getDockPlacementFromHit(hit);
    } catch (e) {}
    return null;
};

const fetchText = async (url, data) => {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data || {}),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
};

const unwrapGetFileText = (raw) => {
    const text = String(raw ?? "");
    const trimmed = text.replace(/^\uFEFF/, "").trim();
    if (!trimmed) return "";
    if (!trimmed.startsWith("{")) return text;
    if (!/\"(code|msg|data|content)\"\s*:/.test(trimmed)) return text;

    let obj;
    try {
        obj = JSON.parse(trimmed);
    } catch (e) {
        throw new Error(`getFile response looks like JSON but failed to parse: ${e?.message || e}`);
    }

    if (obj && typeof obj === "object") {
        if (typeof obj.data === "string") return obj.data;
        if (typeof obj.content === "string") return obj.content;
        if (obj.data && typeof obj.data === "object" && typeof obj.data.content === "string") return obj.data.content;
        if (typeof obj.msg === "string" && typeof obj.code !== "undefined") {
            throw new Error(`getFile error: ${obj.code} ${obj.msg}`);
        }
    }
    return text;
};

const __tmResourceTextCache = new Map();
const __tmResourceTextInflight = new Map();
const __tmDeferredScriptLoaders = new Map();

const clearPluginResourceTextCache = () => {
    try { __tmResourceTextCache.clear(); } catch (e) {}
    try { __tmResourceTextInflight.clear(); } catch (e) {}
    try { __tmDeferredScriptLoaders.clear(); } catch (e) {}
};

const fetchPluginResourceText = async (path) => {
    const key = String(path || "").trim();
    if (!key) throw new Error("empty resource path");
    if (__tmResourceTextCache.has(key)) {
        return __tmResourceTextCache.get(key);
    }
    if (__tmResourceTextInflight.has(key)) {
        return await __tmResourceTextInflight.get(key);
    }
    const task = Promise.resolve().then(async () => {
        const raw = await fetchText("/api/file/getFile", { path: key });
        const text = unwrapGetFileText(raw);
        if (!text || !text.trim()) throw new Error("empty resource");
        __tmResourceTextCache.set(key, text);
        return text;
    }).finally(() => {
        __tmResourceTextInflight.delete(key);
    });
    __tmResourceTextInflight.set(key, task);
    return await task;
};

const loadScriptText = async (path, sourceName) => {
    try {
        const code = await fetchPluginResourceText(path);

        const script = document.createElement("script");
        script.textContent = code + `\n//# sourceURL=${sourceName}`;
        document.head.appendChild(script);
        script.remove();

        return true;
    } catch (e) {
        const msg = String(e?.message || e || "");
        if (msg.includes("getFile error: 404") || msg.includes("file does not exist")) {
            console.warn("[task-horizon] script not found", sourceName);
            return false;
        }
        console.error("[task-horizon] load script failed", sourceName, e);
        return false;
    }
};

const hasAiRuntime = () => {
    try {
        return !!globalThis.__tmAI?.loaded;
    } catch (e) {
        return false;
    }
};

const hasXlsxRuntime = () => {
    const candidates = [
        globalThis.XLSX,
        globalThis.exports,
        globalThis.module?.exports,
        (typeof window !== "undefined" ? window.XLSX : null),
        (typeof window !== "undefined" ? window.exports : null),
        (typeof window !== "undefined" ? window.module?.exports : null),
    ];
    return candidates.some((candidate) => !!(candidate && candidate.utils && (typeof candidate.writeFile === "function" || typeof candidate.writeFileXLSX === "function")));
};

const ensureDeferredScriptText = async (key, path, sourceName, readyCheck) => {
    try {
        if (typeof readyCheck === "function" && readyCheck()) return true;
    } catch (e) {}
    const cacheKey = String(key || "").trim() || String(sourceName || path || "").trim();
    if (__tmDeferredScriptLoaders.has(cacheKey)) {
        return await __tmDeferredScriptLoaders.get(cacheKey);
    }
    const task = Promise.resolve().then(async () => {
        const ok = await loadScriptText(path, sourceName);
        if (!ok) return false;
        try {
            return typeof readyCheck === "function" ? !!readyCheck() : true;
        } catch (e) {
            return true;
        }
    }).finally(() => {
        try {
            if (!(typeof readyCheck === "function" && readyCheck())) {
                __tmDeferredScriptLoaders.delete(cacheKey);
            }
        } catch (e) {
            __tmDeferredScriptLoaders.delete(cacheKey);
        }
    });
    __tmDeferredScriptLoaders.set(cacheKey, task);
    return await task;
};

const loadStyleText = async (path, sourceName) => {
    try {
        const css = await fetchPluginResourceText(path);
        const style = document.createElement("style");
        style.textContent = css + `\n/*# sourceURL=${sourceName} */`;
        style.dataset.tmStyleSource = sourceName || "";
        document.head.appendChild(style);
        return true;
    } catch (e) {
        const msg = String(e?.message || e || "");
        if (msg.includes("getFile error: 404") || msg.includes("file does not exist")) {
            console.warn("[task-horizon] style not found", sourceName);
            return false;
        }
        console.error("[task-horizon] load style failed", sourceName, e);
        return false;
    }
};

module.exports = class TaskHorizonPlugin extends Plugin {
    isRuntimeMobileClient() {
        return isRuntimeMobileClient(this);
    }

    async onload() {
        clearPluginResourceTextCache();
        const mountToken = String(Date.now());
        const runtimeMobile = this.isRuntimeMobileClient();
        this._mountToken = mountToken;
        this._mountExistingTabsStopped = false;
        this._mountExistingTabsTimer = null;
        globalThis.__taskHorizonPluginApp = this.app;
        globalThis.__taskHorizonPluginInstance = this;
        globalThis.__taskHorizonPluginIsMobile = runtimeMobile;
        globalThis.__taskHorizonOpenTab = typeof openTab === "function" ? openTab : null;
        globalThis.__taskHorizonOpenMobileFileById = typeof openMobileFileById === "function" ? openMobileFileById : null;
        globalThis.__taskHorizonPlatformUtils = platformUtils || null;
        globalThis.__taskHorizonOpenTabView = this.openTaskHorizonTab.bind(this);
        globalThis.__taskHorizonCustomTabId = CUSTOM_TAB_ID;
        globalThis.__taskHorizonTabType = TAB_TYPE;
        globalThis.__taskHorizonMountToken = mountToken;
        globalThis.__taskHorizonEnsureAiModuleLoaded = () => ensureDeferredScriptText("ai", AI_SCRIPT_PATH, "ai.js", hasAiRuntime);
        globalThis.__taskHorizonEnsureXlsxModuleLoaded = () => ensureDeferredScriptText("xlsx", XLSX_VENDOR_SCRIPT_PATH, "vendor/xlsx.full.min.js", hasXlsxRuntime);
        try { this.addIcons(ICON_SYMBOL); } catch (e) {}
        this.ensureCustomTab();
        this.initTaskDock();
        this.suppressTaskDockOnMobile();
        try {
            document.querySelectorAll('style[data-tm-style-source]').forEach((el) => { try { el.remove(); } catch (e) {} });
        } catch (e) {}
        try {
            globalThis.__tmCalendar?.cleanup?.();
        } catch (e) {}
        try {
            delete globalThis.__tmCalendar;
        } catch (e) {}
        await loadScriptText(BASECOAT_SCRIPT_PATH, "basecoat/basecoat.js");
        await loadScriptText(TASK_SCRIPT_PATH, "task.js");
        await loadScriptText(QUICKBAR_SCRIPT_PATH, "quickbar.js");
        await loadStyleText(BASECOAT_CSS_PATH, "basecoat/basecoat.css");
        await loadScriptText(FULLCALENDAR_MIN_SCRIPT_PATH, "fullcalendar/index.global.min.js");
        await loadScriptText(FULLCALENDAR_ZH_LOCALE_SCRIPT_PATH, "fullcalendar/locales/zh-cn.global.min.js");
        await loadScriptText(CALENDAR_VIEW_SCRIPT_PATH, "calendar-view.js");
        await loadStyleText(CALENDAR_VIEW_CSS_PATH, "calendar-view.css");
        this.mountExistingTabs();
    }

    ensureCustomTab() {
        if (this._tabRegistered) return;
        const type = TAB_TYPE;
        const plugin = this;
        this.addTab({
            type,
            init() {
                // Use function syntax to preserve `this` as the tab instance
                this.element.classList.add("tm-tab-root");
                this.element.style.display = "flex";
                this.element.style.flexDirection = "column";
                this.element.style.height = "100%";
                this.element.style.isolation = "isolate";
                globalThis.__taskHorizonTabElement = this.element;
                plugin.tryMountTabRoot(this.element, {
                    maxWaitMs: plugin.isRuntimeMobileClient() ? 7000 : 2600,
                });
            },
        });
        this._tabRegistered = true;
    }

    hasMountedTabContent(element) {
        if (!(element instanceof HTMLElement)) return false;
        try {
            return !!element.querySelector?.(".tm-modal, .tm-box, [data-task-horizon-dock-root], [data-task-horizon-dock-snapshot]");
        } catch (e) {
            return false;
        }
    }

    isTabRootMountedForCurrentToken(element) {
        if (!(element instanceof HTMLElement)) return false;
        const token = String(globalThis.__taskHorizonMountToken || this._mountToken || "");
        if (!token) return this.hasMountedTabContent(element);
        return element.dataset?.tmTaskHorizonMounted === token && this.hasMountedTabContent(element);
    }

    tryMountTabRoot(element, options = {}) {
        if (!(element instanceof HTMLElement)) return false;
        const maxWaitMs = Math.max(200, Number(options?.maxWaitMs) || 2600);
        const retryDelayMs = Math.max(80, Number(options?.retryDelayMs) || 180);
        const startedAt = Date.now();
        const run = () => {
            if (this._mountExistingTabsStopped) return;
            if (!(element instanceof HTMLElement)) return;
            if (this.isTabRootMountedForCurrentToken(element)) return;
            if (!document.body.contains(element)) {
                if (Date.now() - startedAt < maxWaitMs) {
                    element.__tmTaskHorizonMountRetryTimer = setTimeout(run, retryDelayMs);
                }
                return;
            }
            const mountFn = globalThis.__taskHorizonMount;
            if (typeof mountFn === "function") {
                try {
                    globalThis.__taskHorizonTabElement = element;
                    mountFn(element);
                    const token = String(globalThis.__taskHorizonMountToken || this._mountToken || "");
                    if (token) element.dataset.tmTaskHorizonMounted = token;
                    if (this.hasMountedTabContent(element)) return;
                } catch (e) {}
            }
            if (Date.now() - startedAt < maxWaitMs) {
                element.__tmTaskHorizonMountRetryTimer = setTimeout(run, retryDelayMs);
            }
        };
        try {
            if (element.__tmTaskHorizonMountRetryTimer) {
                clearTimeout(element.__tmTaskHorizonMountRetryTimer);
                element.__tmTaskHorizonMountRetryTimer = null;
            }
        } catch (e) {}
        run();
        return this.isTabRootMountedForCurrentToken(element);
    }

    mountExistingTabs(maxWaitMs = null) {
        const waitMs = Math.max(400, Number(maxWaitMs) || (this.isRuntimeMobileClient() ? 7000 : 2600));
        const startedAt = Date.now();
        const run = () => {
            if (this._mountExistingTabsStopped) return;
            const roots = Array.from(document.querySelectorAll(".tm-tab-root"));
            let mountedAny = false;
            if (roots.length) {
                roots.forEach((el) => {
                    if (!(el instanceof HTMLElement)) return;
                    if (this.isTabRootMountedForCurrentToken(el)) {
                        mountedAny = true;
                        return;
                    }
                    if (this.tryMountTabRoot(el, { maxWaitMs: Math.max(600, waitMs - (Date.now() - startedAt)) })) {
                        mountedAny = true;
                    }
                });
            }
            if (mountedAny && roots.length) {
                return;
            }
            if (Date.now() - startedAt < waitMs) {
                this._mountExistingTabsTimer = setTimeout(run, 200);
            }
        };
        try {
            if (this._mountExistingTabsTimer) {
                clearTimeout(this._mountExistingTabsTimer);
                this._mountExistingTabsTimer = null;
            }
        } catch (e) {}
        run();
    }

    async remountBestTaskHorizonTab(maxWaitMs = 2200) {
        if (this.isRuntimeMobileClient()) return null;
        const startedAt = Date.now();
        while (Date.now() - startedAt < Math.max(200, Number(maxWaitMs) || 2200)) {
            const mountFn = globalThis.__taskHorizonMount;
            if (typeof mountFn !== "function") {
                await new Promise((resolve) => setTimeout(resolve, 60));
                continue;
            }
            const roots = Array.from(document.querySelectorAll(".tm-tab-root"))
                .filter((el) => !!el && document.body.contains(el));
            if (!roots.length) {
                await new Promise((resolve) => setTimeout(resolve, 60));
                continue;
            }
            const isVisible = (el) => {
                try {
                    const rect = el?.getBoundingClientRect?.();
                    return !!rect && rect.width > 0 && rect.height > 0;
                } catch (e) {
                    return false;
                }
            };
            const visible = roots.filter(isVisible);
            const target = visible[visible.length - 1] || roots[roots.length - 1] || null;
            if (!target) {
                await new Promise((resolve) => setTimeout(resolve, 60));
                continue;
            }
            const token = String(globalThis.__taskHorizonMountToken || this._mountToken || "");
            try {
                globalThis.__taskHorizonTabElement = target;
                mountFn(target);
                if (token) target.dataset.tmTaskHorizonMounted = token;
                return target;
            } catch (e) {
                await new Promise((resolve) => setTimeout(resolve, 60));
            }
        }
        return null;
    }

    openTaskHorizonTab() {
        if (this.isRuntimeMobileClient()) {
            // Mobile has no tabs; fallback is handled by task.js.
            return;
        }
        this.ensureCustomTab();
        openTab({
            app: this.app,
            openNewTab: false,
            custom: {
                title: TAB_TITLE,
                icon: ICON_ID,
                id: CUSTOM_TAB_ID,
            },
        });
        Promise.resolve().then(() => this.remountBestTaskHorizonTab()).catch(() => null);
    }

    initTaskDock() {
        if (this.isRuntimeMobileClient()) return;
        this._taskDockSettingsHandler = () => {
            this.handleTaskDockSettingsChanged();
        };
        this._taskDockStorageHandler = (event) => {
            const key = String(event?.key || "");
            if (key && key !== "tm_dock_sidebar_enabled" && key !== "tm_dock_default_view_mode" && key !== "tm_default_view_mode_mobile" && key !== "tm_enabled_views") {
                return;
            }
            this.handleTaskDockSettingsChanged();
        };
        try { window.addEventListener("tm:task-horizon-dock-settings-changed", this._taskDockSettingsHandler); } catch (e) {}
        try { window.addEventListener("storage", this._taskDockStorageHandler); } catch (e) {}

        const settings = readTaskDockSettings();
        if (settings.enabled) {
            this.ensureTaskDockRegistered("startup");
        } else {
            this.syncTaskDockVisibility();
        }
    }

    handleTaskDockSettingsChanged() {
        if (this.isRuntimeMobileClient()) {
            this.destroyTaskDockFrame();
            this.syncTaskDockVisibility();
            return;
        }
        const settings = readTaskDockSettings();
        if (settings.enabled) {
            this.ensureTaskDockRegistered("settings");
            this.reloadTaskDockFrame();
        } else {
            this.destroyTaskDockFrame();
        }
        this.syncTaskDockVisibility();
    }

    ensureTaskDockRegistered(reason = "manual") {
        if (this.isRuntimeMobileClient()) return false;
        if (typeof this.addDock !== "function") return false;
        if (this._taskDockAdded) {
            this.syncTaskDockVisibility();
            return true;
        }

        const placement = getDockPlacementFromCurrentUiLayout(TASK_DOCK_TYPE);
        const plugin = this;
        this.addDock({
            type: TASK_DOCK_TYPE,
            config: {
                position: placement?.position || "RightBottom",
                size: { width: 420, height: 680 },
                icon: ICON_ID,
                title: TASK_DOCK_TITLE,
                index: Number.isFinite(placement?.index) ? placement.index : undefined,
            },
            data: { plugin: this, reason },
            init() {
                plugin._taskDockElement = this.element || null;
                plugin._taskDockOpen = true;
                plugin.mountTaskDockElement(this.element || null);
                setTimeout(() => plugin.syncTaskDockVisibility(), 0);
            },
            update() {
                plugin._taskDockElement = this.element || null;
                plugin._taskDockOpen = true;
                plugin.mountTaskDockElement(this.element || null, { reactivate: false });
                setTimeout(() => plugin.syncTaskDockVisibility(), 0);
            },
            resize() {
                plugin._taskDockElement = this.element || null;
                plugin._taskDockOpen = true;
                plugin.mountTaskDockElement(this.element || null, { reactivate: false });
            },
            destroy() {
                if (plugin._taskDockElement === (this.element || null)) {
                    plugin._taskDockElement = null;
                }
                plugin._taskDockOpen = false;
                plugin.destroyTaskDockFrame(this.element || null);
            },
        });
        this._taskDockAdded = true;
        this.syncTaskDockVisibility();
        return true;
    }

    getTaskDockHosts() {
        try {
            const nodes = Array.from(document.querySelectorAll(`[data-type="${TASK_DOCK_TYPE}"]`));
            const set = new Set();
            nodes.forEach((node) => {
                const host = node.closest(".dock__item, .dock__panel") || node;
                if (host) set.add(host);
            });
            return Array.from(set);
        } catch (e) {
            return [];
        }
    }

    syncTaskDockVisibility() {
        const visible = !this.isRuntimeMobileClient() && readTaskDockSettings().enabled;
        const hosts = this.getTaskDockHosts();
        hosts.forEach((host) => {
            try { host.style.display = visible ? "" : "none"; } catch (e) {}
            try {
                if (visible) host.removeAttribute("aria-hidden");
                else host.setAttribute("aria-hidden", "true");
            } catch (e) {}
        });
    }

    suppressTaskDockOnMobile() {
        if (!this.isRuntimeMobileClient()) return;
        if (!Array.isArray(this._taskDockMobileSuppressTimers)) {
            this._taskDockMobileSuppressTimers = [];
        }
        const sync = () => {
            if (!this.isRuntimeMobileClient()) return;
            try { this.destroyTaskDockFrame(); } catch (e) {}
            try { this.syncTaskDockVisibility(); } catch (e) {}
        };
        sync();
        [80, 300, 1200].forEach((delay) => {
            try {
                const timer = setTimeout(() => {
                    try {
                        if (Array.isArray(this._taskDockMobileSuppressTimers)) {
                            this._taskDockMobileSuppressTimers = this._taskDockMobileSuppressTimers.filter((id) => id !== timer);
                        }
                    } catch (e2) {}
                    sync();
                }, delay);
                this._taskDockMobileSuppressTimers.push(timer);
            } catch (e) {}
        });
    }

    renderTaskDockNotice(element, title, desc, actions = []) {
        if (!(element instanceof HTMLElement)) return;
        const shell = document.createElement("div");
        shell.style.cssText = "height:100%;display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box;background:var(--b3-theme-background);color:var(--b3-theme-on-background);";
        const card = document.createElement("div");
        card.style.cssText = "width:100%;max-width:320px;display:flex;flex-direction:column;gap:10px;padding:18px 16px;border:1px solid var(--b3-theme-surface-light);border-radius:16px;background:var(--b3-theme-surface);box-sizing:border-box;";
        const titleEl = document.createElement("div");
        titleEl.style.cssText = "font-size:16px;font-weight:700;line-height:1.35;";
        titleEl.textContent = title;
        const descEl = document.createElement("div");
        descEl.style.cssText = "font-size:12px;line-height:1.7;opacity:.78;";
        descEl.textContent = desc;
        card.appendChild(titleEl);
        card.appendChild(descEl);
        if (actions.length) {
            const row = document.createElement("div");
            row.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;";
            actions.forEach((action) => {
                if (!action || typeof action.onClick !== "function") return;
                const btn = document.createElement("button");
                btn.type = "button";
                btn.textContent = action.label || "打开";
                btn.style.cssText = "flex:1 1 120px;height:34px;border:none;border-radius:10px;background:var(--b3-theme-primary, #4285f4);color:#fff;font-size:13px;cursor:pointer;";
                btn.addEventListener("click", action.onClick);
                row.appendChild(btn);
            });
            card.appendChild(row);
        }
        shell.appendChild(card);
        try { element.replaceChildren(shell); } catch (e) {}
    }

    destroyTaskDockFrame(element) {
        const host = element instanceof HTMLElement ? element : this._taskDockElement;
        try {
            if (host instanceof HTMLElement) host.replaceChildren();
        } catch (e) {}
        this._taskDockRoot = null;
    }

    ensureTaskDockRoot(element) {
        if (!(element instanceof HTMLElement)) return null;
        try {
            element.style.display = "flex";
            element.style.flexDirection = "column";
            element.style.minWidth = "0";
            element.style.minHeight = "0";
            element.style.height = "100%";
            element.style.overflow = "hidden";
        } catch (e) {}
        let root = null;
        try {
            root = element.querySelector(`[${TASK_DOCK_ROOT_ATTR}="1"]`);
        } catch (e) {}
        if (!(root instanceof HTMLElement)) {
            root = document.createElement("div");
            root.setAttribute(TASK_DOCK_ROOT_ATTR, "1");
            try { element.replaceChildren(root); } catch (e) {}
        }
        root.dataset.tmHostMode = "dock";
        root.dataset.tmUiMode = "mobile";
        root.style.width = "100%";
        root.style.height = "100%";
        root.style.minWidth = "0";
        root.style.minHeight = "0";
        root.style.flex = "1 1 auto";
        root.style.position = "relative";
        root.style.overflow = "hidden";
        root.style.isolation = "isolate";
        if (root.dataset.tmDockReactivateBound !== "1") {
            root.addEventListener("click", () => {
                try {
                    if (!root?.querySelector?.(`[${TASK_DOCK_SNAPSHOT_ATTR}="1"]`)) return;
                    this.mountTaskDockElement(element, { reactivate: true });
                } catch (e) {}
            });
            root.dataset.tmDockReactivateBound = "1";
        }
        this._taskDockRoot = root;
        return root;
    }

    async mountTaskDockElement(element, options = {}) {
        if (!(element instanceof HTMLElement)) return false;
        const reactivate = options?.reactivate !== false;
        this._taskDockElement = element;
        this._taskDockOpen = true;
        const settings = readTaskDockSettings();
        if (!settings.enabled) {
            this.renderTaskDockNotice(
                element,
                "任务 Dock 已关闭",
                "可以在任务管理器设置里的“视图与布局”重新开启这个侧边栏。",
                [
                    {
                        label: "打开任务管理器",
                        onClick: () => this.openTaskHorizonTab(),
                    },
                ],
            );
            return false;
        }

        const root = this.ensureTaskDockRoot(element);
        if (!(root instanceof HTMLElement)) return false;
        const hasLiveModal = !!root.querySelector(`.tm-modal.tm-modal--dock:not([${TASK_DOCK_SNAPSHOT_ATTR}="1"])`);
        const hasSnapshot = !!root.querySelector(`[${TASK_DOCK_SNAPSHOT_ATTR}="1"]`);
        if (hasLiveModal) {
            return true;
        }
        if (!reactivate) {
            return hasSnapshot;
        }
        if (hasSnapshot) {
            try { root.replaceChildren(); } catch (e) {}
        }
        const mountFn = globalThis.__taskHorizonMount;
        if (typeof mountFn !== "function") {
            this.renderTaskDockNotice(element, "任务 Dock 加载中", "正在等待任务管理器入口挂载。");
            return false;
        }
        try {
            mountFn(root);
            return true;
        } catch (e) {
            console.error("[task-horizon] native dock mount failed", e);
            this.renderTaskDockNotice(
                element,
                "任务 Dock 加载失败",
                String(e?.message || e || "未知错误"),
                [
                    {
                        label: "重试",
                        onClick: () => this.reloadTaskDockFrame(),
                    },
                    {
                        label: "打开任务管理器",
                        onClick: () => this.openTaskHorizonTab(),
                    },
                ],
            );
            return false;
        }
    }

    reloadTaskDockFrame() {
        if (!(this._taskDockElement instanceof HTMLElement)) return;
        this.destroyTaskDockFrame(this._taskDockElement);
        this.mountTaskDockElement(this._taskDockElement, { reactivate: true });
    }

    onunload() {
        clearPluginResourceTextCache();
        try {
            this._mountExistingTabsStopped = true;
            if (this._mountExistingTabsTimer) {
                clearTimeout(this._mountExistingTabsTimer);
                this._mountExistingTabsTimer = null;
            }
        } catch (e) {}
        try {
            if (Array.isArray(this._taskDockMobileSuppressTimers)) {
                this._taskDockMobileSuppressTimers.forEach((timer) => {
                    try { clearTimeout(timer); } catch (e2) {}
                });
                this._taskDockMobileSuppressTimers = [];
            }
        } catch (e) {}
        try {
            if (this._taskDockSettingsHandler) {
                window.removeEventListener("tm:task-horizon-dock-settings-changed", this._taskDockSettingsHandler);
                this._taskDockSettingsHandler = null;
            }
            if (this._taskDockStorageHandler) {
                window.removeEventListener("storage", this._taskDockStorageHandler);
                this._taskDockStorageHandler = null;
            }
        } catch (e) {}
        try { this.destroyTaskDockFrame(); } catch (e) {}
        try { globalThis.__TaskManagerCleanup?.(); } catch (e) {}
        try { globalThis.__taskHorizonAiCleanup?.(); } catch (e) {}
        try { globalThis.__taskHorizonQuickbarCleanup?.(); } catch (e) {}
        try { globalThis.tmClose?.(); } catch (e) {}

        try {
            const styles = Array.from(document.querySelectorAll('style[data-tm-style-source]'));
            styles.forEach((el) => {
                try { el.remove(); } catch (e) {}
            });
        } catch (e) {}

        try { delete globalThis.__taskHorizonPluginApp; } catch (e) {}
        try { delete globalThis.__taskHorizonPluginInstance; } catch (e) {}
        try { delete globalThis.__taskHorizonPluginIsMobile; } catch (e) {}
        try { delete globalThis.__taskHorizonOpenTab; } catch (e) {}
        try { delete globalThis.__taskHorizonOpenMobileFileById; } catch (e) {}
        try { delete globalThis.__taskHorizonPlatformUtils; } catch (e) {}
        try { delete globalThis.__taskHorizonOpenTabView; } catch (e) {}
        try { delete globalThis.__taskHorizonCustomTabId; } catch (e) {}
        try { delete globalThis.__taskHorizonTabElement; } catch (e) {}
        try { delete globalThis.__taskHorizonQuickbarLoaded; } catch (e) {}
        try { delete globalThis.__taskHorizonQuickbarToggle; } catch (e) {}
        try { delete globalThis.__taskHorizonQuickbarCleanup; } catch (e) {}
        try { delete globalThis.__taskHorizonAiCleanup; } catch (e) {}
        try { delete globalThis.__taskHorizonEnsureAiModuleLoaded; } catch (e) {}
        try { delete globalThis.__taskHorizonEnsureXlsxModuleLoaded; } catch (e) {}
        try { delete globalThis.__taskHorizonMount; } catch (e) {}
        try { delete globalThis.__TaskManagerCleanup; } catch (e) {}
        try { delete globalThis.__taskHorizonMountToken; } catch (e) {}
        try { delete globalThis.__taskHorizonTabType; } catch (e) {}
    }

    async uninstall() {
        try { globalThis.__TaskManagerCleanup?.(); } catch (e) {}
        try { globalThis.__taskHorizonAiCleanup?.(); } catch (e) {}
        try { globalThis.__taskHorizonQuickbarCleanup?.(); } catch (e) {}

        try {
            const ns = globalThis["siyuan-plugin-task-horizon"];
            if (ns && typeof ns.uninstallCleanup === "function") {
                await ns.uninstallCleanup();
            }
        } catch (e) {}

        try {
            const paths = [
                "/data/storage/petal/siyuan-plugin-task-horizon/task-settings.json",
                "/data/storage/petal/siyuan-plugin-task-horizon/task-meta.json",
                "/data/storage/petal/siyuan-plugin-task-horizon/ai-conversations.json",
                "/data/storage/petal/siyuan-plugin-task-horizon/ai-debug.json",
                "/data/storage/petal/siyuan-plugin-task-horizon/ai-prompt-templates.json",
            ];
            await Promise.all(paths.map((path) => fetch("/api/file/removeFile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path }),
            }).catch(() => null)));
        } catch (e) {}
    }
};
