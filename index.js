const { Plugin, openTab, openMobileFileById, platformUtils } = require("siyuan");

const PLUGIN_ID = "siyuan-plugin-task-horizon";
const TASK_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/task.js`;
const TASK_MAIN_STYLE_PATH = `/data/plugins/${PLUGIN_ID}/task-horizon.css`;
const TASK_DEV_MANIFEST_PATH = `/data/plugins/${PLUGIN_ID}/src/task-horizon/manifest.main.json`;
const TASK_DEV_SOURCE_ROOT = `/data/plugins/${PLUGIN_ID}/src/task-horizon`;
const AI_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/ai.js`;
const HOMEPAGE_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/homepage.js`;
const QUICKBAR_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/quickbar.js`;
const XLSX_VENDOR_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/src/vendor/xlsx.full.min.js`;
const FULLCALENDAR_MIN_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/src/fullcalendar/index.global.min.js`;
const FULLCALENDAR_ZH_LOCALE_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/src/fullcalendar/locales/zh-cn.global.min.js`;
const BASECOAT_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/src/basecoat/basecoat.js`;
const BASECOAT_CSS_PATH = `/data/plugins/${PLUGIN_ID}/src/basecoat/basecoat.css`;
const CALENDAR_VIEW_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/calendar-view.js`;
const CALENDAR_VIEW_CSS_PATH = `/data/plugins/${PLUGIN_ID}/calendar-view.css`;
const PLUGIN_MANIFEST_PATH = `/data/plugins/${PLUGIN_ID}/plugin.json`;
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
        if (globalThis?.JSAndroid) return true;
    } catch (e) {}
    try {
        if (globalThis?.JSHarmony) return true;
    } catch (e) {}
    try {
        const hasIosBridge = !!globalThis?.webkit?.messageHandlers;
        if (!hasIosBridge) return false;
        const ua = String(navigator?.userAgent || "");
        const maxTouchPoints = Number(navigator?.maxTouchPoints) || 0;
        if (/iPhone|iPad|iPod/i.test(ua)) return true;
        if (maxTouchPoints > 0) return true;
        return true;
    } catch (e) {}
    return false;
};

const isMobileBrowserViewport = () => {
    try {
        if (navigator?.userAgentData?.mobile === true) return true;
    } catch (e) {}
    try {
        const ua = String(navigator?.userAgent || "");
        if (/Android|iPhone|iPad|iPod|HarmonyOS|Mobile/i.test(ua)) return true;
    } catch (e) {}
    try {
        const maxTouchPoints = Number(navigator?.maxTouchPoints) || 0;
        const width = Number(window?.innerWidth) || 0;
        const coarse = !!window?.matchMedia?.("(pointer: coarse)")?.matches;
        if ((coarse || maxTouchPoints > 0) && width > 0 && width <= 900) return true;
    } catch (e) {}
    return false;
};

const isNativeMobileRuntimeClient = () => hasOfficialMobileRuntimeSignal();

const getRuntimeClientKind = () => {
    try {
        if (globalThis?.JSAndroid) return "android-app";
    } catch (e) {}
    try {
        if (globalThis?.JSHarmony) return "harmony-app";
    } catch (e) {}
    try {
        if (globalThis?.webkit?.messageHandlers) return "ios-app";
    } catch (e) {}
    return isMobileBrowserViewport() ? "mobile-browser" : "desktop-browser";
};

const isRuntimeMobileClient = () => {
    if (hasOfficialMobileRuntimeSignal()) return true;
    return isMobileBrowserViewport();
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

const resolveDockHostElement = (element) => {
    if (!(element instanceof HTMLElement)) return null;
    try {
        return element.closest(".dock__item, .dock__panel") || element;
    } catch (e) {
        return element;
    }
};

const getDockContainmentHosts = (element) => {
    const out = [];
    const seen = new Set();
    const push = (host) => {
        if (!(host instanceof HTMLElement) || seen.has(host)) return;
        seen.add(host);
        out.push(host);
    };
    push(element?.parentElement || null);
    push(resolveDockHostElement(element));
    return out;
};

const getDockHostsByType = (type) => {
    try {
        const nodes = Array.from(document.querySelectorAll(`[data-type="${type}"]`));
        const set = new Set();
        nodes.forEach((node) => {
            const host = resolveDockHostElement(node);
            if (host) set.add(host);
        });
        return Array.from(set);
    } catch (e) {
        return [];
    }
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

const normalizePluginManifest = (manifest) => {
    const source = (manifest && typeof manifest === "object") ? manifest : {};
    return {
        name: String(source.name || "").trim() || PLUGIN_ID,
        version: String(source.version || "").trim(),
        frontends: Array.isArray(source.frontends) && source.frontends.length ? source.frontends.slice() : ["all"],
        backends: Array.isArray(source.backends) && source.backends.length ? source.backends.slice() : ["all"],
    };
};

const loadPluginManifest = async (pluginInstance) => {
    try {
        const text = await fetchPluginResourceText(PLUGIN_MANIFEST_PATH);
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === "object") return normalizePluginManifest(parsed);
    } catch (e) {}
    try {
        return normalizePluginManifest(pluginInstance?.manifest);
    } catch (e) {}
    return normalizePluginManifest(null);
};

const createTaskHorizonHostBridge = (pluginInstance) => ({
    plugin: pluginInstance || null,
    app: pluginInstance?.app || null,
    eventBus: pluginInstance?.eventBus || null,
    platformUtils: platformUtils || null,
    openTab: typeof openTab === "function" ? openTab : null,
    openMobileFileById: typeof openMobileFileById === "function" ? openMobileFileById : null,
    openTaskTab: (...args) => {
        try {
            return pluginInstance?.openTaskHorizonTab?.(...args);
        } catch (e) {
            return false;
        }
    },
    getAllModels: () => {
        try {
            return typeof window?.siyuan?.getAllModels === "function" ? window.siyuan.getAllModels() : null;
        } catch (e) {
            return null;
        }
    },
    isMobileRuntime: () => {
        try {
            return pluginInstance?.isRuntimeMobileClient?.() === true;
        } catch (e) {
            return false;
        }
    },
    isNativeMobileRuntime: () => {
        try {
            return isNativeMobileRuntimeClient();
        } catch (e) {
            return false;
        }
    },
    getRuntimeClientKind: () => {
        try {
            return getRuntimeClientKind();
        } catch (e) {
            return "";
        }
    },
    loadData: (...args) => {
        try {
            return pluginInstance?.loadData?.(...args);
        } catch (e) {
            return null;
        }
    },
    saveData: (...args) => {
        try {
            return pluginInstance?.saveData?.(...args);
        } catch (e) {
            return null;
        }
    },
    removeData: (...args) => {
        try {
            return pluginInstance?.removeData?.(...args);
        } catch (e) {
            return null;
        }
    },
});

const normalizeTaskDevScriptPath = (value) => {
    const raw = String(value || "").replace(/\\/g, "/").trim();
    if (!raw) return "";
    const parts = raw.split("/").filter(Boolean);
    if (!parts.length) return "";
    for (const part of parts) {
        if (part === "." || part === "..") return "";
    }
    return parts.join("/");
};

const TASK_GLOBAL_EXPORT_PATTERN = /(?:window|globalThis)\.([A-Za-z0-9_]+)\s*=(?!=)/g;

const extractTaskWindowExportKeys = (code) => {
    const text = String(code || "");
    if (!text) return [];
    const keys = [];
    const seen = new Set();
    TASK_GLOBAL_EXPORT_PATTERN.lastIndex = 0;
    let match = TASK_GLOBAL_EXPORT_PATTERN.exec(text);
    while (match) {
        const key = String(match[1] || "").trim();
        if (key && !seen.has(key)) {
            seen.add(key);
            keys.push(key);
        }
        match = TASK_GLOBAL_EXPORT_PATTERN.exec(text);
    }
    TASK_GLOBAL_EXPORT_PATTERN.lastIndex = 0;
    return keys;
};

const rememberTaskWindowExportKeys = (code) => {
    const keys = extractTaskWindowExportKeys(code);
    try {
        globalThis.__taskHorizonExplicitWindowExportKeys = keys;
    } catch (e) {}
    return keys;
};

const buildTaskDevCombinedCode = async (scripts) => {
    const chunks = [];
    for (const scriptPath of scripts) {
        const fullPath = `${TASK_DEV_SOURCE_ROOT}/${scriptPath}`;
        try {
            const code = await fetchPluginResourceText(fullPath);
            chunks.push(`/* task-horizon dev: begin ${scriptPath} */\n${code}\n/* task-horizon dev: end ${scriptPath} */\n`);
        } catch (e) {
            console.error("[task-horizon] load task dev script failed", scriptPath, e);
            return "";
        }
    }
    return chunks.join("\n");
};

const loadTaskDevManifestScripts = async () => {
    let text = "";
    try {
        text = await fetchPluginResourceText(TASK_DEV_MANIFEST_PATH);
    } catch (e) {
        const msg = String(e?.message || e || "");
        if (msg.includes("getFile error: 404") || msg.includes("file does not exist")) {
            return { status: "missing", scripts: [] };
        }
        console.error("[task-horizon] load task dev manifest failed", e);
        return { status: "error", scripts: [] };
    }
    try {
        const parsed = JSON.parse(text);
        const scripts = Array.isArray(parsed?.scripts) ? parsed.scripts.map(normalizeTaskDevScriptPath).filter(Boolean) : [];
        if (!scripts.length) {
            console.error("[task-horizon] task dev manifest has no scripts");
            return { status: "error", scripts: [] };
        }
        const combinedCode = await buildTaskDevCombinedCode(scripts);
        if (!combinedCode) {
            return { status: "error", scripts };
        }
        rememberTaskWindowExportKeys(combinedCode);
        const script = document.createElement("script");
        script.textContent = combinedCode + `\n//# sourceURL=task-horizon.dev-main.js`;
        try {
            document.head.appendChild(script);
        } finally {
            try { script.remove(); } catch (e) {}
        }
        return { status: "loaded", scripts };
    } catch (e) {
        console.error("[task-horizon] parse task dev manifest failed", e);
        return { status: "error", scripts: [] };
    }
};

const ensureTaskMainLoaded = async () => {
    const devLoad = await loadTaskDevManifestScripts();
    if (devLoad.status === "loaded") {
        console.info("[task-horizon] loaded task main from src/task-horizon manifest", devLoad.scripts);
        return true;
    }
    if (devLoad.status === "missing") {
        return await loadScriptText(TASK_SCRIPT_PATH, "task.js");
    }
    console.error("[task-horizon] task main load aborted; skip task.js fallback to avoid duplicate runtime");
    return false;
};

const loadScriptText = async (path, sourceName) => {
    try {
        const code = await fetchPluginResourceText(path);
        if (path === TASK_SCRIPT_PATH) {
            rememberTaskWindowExportKeys(code);
        }

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
        try { delete globalThis.__taskHorizonExplicitWindowExportKeys; } catch (e) {}
        const mountToken = String(Date.now());
        const runtimeMobile = this.isRuntimeMobileClient();
        const runtimeNativeMobile = isNativeMobileRuntimeClient();
        this._mountToken = mountToken;
        this._mountExistingTabsStopped = false;
        this._mountExistingTabsTimer = null;
        globalThis.__taskHorizonPluginApp = this.app;
        globalThis.__taskHorizonPluginInstance = this;
        globalThis.__taskHorizonPluginIsMobile = runtimeMobile;
        globalThis.__taskHorizonPluginIsNativeMobile = runtimeNativeMobile;
        globalThis.__taskHorizonRuntimeClientKind = getRuntimeClientKind();
        globalThis.__taskHorizonOpenTab = typeof openTab === "function" ? openTab : null;
        globalThis.__taskHorizonOpenMobileFileById = typeof openMobileFileById === "function" ? openMobileFileById : null;
        globalThis.__taskHorizonPlatformUtils = platformUtils || null;
        globalThis.__taskHorizonOpenTabView = this.openTaskHorizonTab.bind(this);
        globalThis.__taskHorizonHostBridge = createTaskHorizonHostBridge(this);
        globalThis.__taskHorizonCustomTabId = CUSTOM_TAB_ID;
        globalThis.__taskHorizonTabType = TAB_TYPE;
        globalThis.__taskHorizonMountToken = mountToken;
        globalThis.__taskHorizonEnsureAiModuleLoaded = () => ensureDeferredScriptText("ai", AI_SCRIPT_PATH, "ai.js", hasAiRuntime);
        globalThis.__taskHorizonEnsureHomepageModuleLoaded = () => ensureDeferredScriptText("homepage", HOMEPAGE_SCRIPT_PATH, "homepage.js", () => !!globalThis.__tmHomepage?.loaded);
        globalThis.__taskHorizonEnsureXlsxModuleLoaded = () => ensureDeferredScriptText("xlsx", XLSX_VENDOR_SCRIPT_PATH, "vendor/xlsx.full.min.js", hasXlsxRuntime);
        globalThis.__taskHorizonPluginManifest = await loadPluginManifest(this);
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
        await loadStyleText(TASK_MAIN_STYLE_PATH, "task-horizon.css");
        await loadScriptText(BASECOAT_SCRIPT_PATH, "basecoat/basecoat.js");
        const mainLoaded = await ensureTaskMainLoaded();
        if (!mainLoaded) return;
        await loadScriptText(QUICKBAR_SCRIPT_PATH, "quickbar.js");
        await loadStyleText(BASECOAT_CSS_PATH, "basecoat/basecoat.css");
        await loadScriptText(FULLCALENDAR_MIN_SCRIPT_PATH, "fullcalendar/index.global.min.js");
        await loadScriptText(FULLCALENDAR_ZH_LOCALE_SCRIPT_PATH, "fullcalendar/locales/zh-cn.global.min.js");
        await loadScriptText(CALENDAR_VIEW_SCRIPT_PATH, "calendar-view.js");
        await loadStyleText(CALENDAR_VIEW_CSS_PATH, "calendar-view.css");
        this.mountExistingTabs();
        this.scheduleTaskDockRecovery("post-load", { delayMs: 60 });
        this.addIcons(`
            <symbol id="iconTaskCancelled" viewBox="0 0 32 32">
                <path d="M28.444 0h-24.889c-1.956 0-3.556 1.6-3.556 3.556v24.889c0 1.956 1.6 3.556 3.556 3.556h24.889c1.956 0 3.556-1.6 3.556-3.556v-24.889c0-1.956-1.6-3.556-3.556-3.556zM28.444 28.445h-24.889v-24.889h24.889v24.889z"></path>
                <path d="M24.485 10.343l-2.828-2.828-5.657 5.657-5.657-5.657-2.828 2.828 5.657 5.657-5.657 5.657 2.828 2.828 5.657-5.657 5.657 5.657 2.828-2.828-5.657-5.657z"></path>
            </symbol>
        `);
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
                plugin.prepareTaskTabRoot(this.element);
                globalThis.__taskHorizonTabElement = this.element;
                const mounted = plugin.tryImmediateMountTabRoot(this.element, { force: true });
                if (!mounted) {
                    plugin.tryMountTabRoot(this.element, {
                        maxWaitMs: plugin.isRuntimeMobileClient() ? 7000 : 2600,
                        skipFastMount: true,
                    });
                }
            },
        });
        this._tabRegistered = true;
    }

    prepareTaskTabRoot(element) {
        if (!(element instanceof HTMLElement)) return;
        try {
            element.dataset.tmHostMode = "tab";
            element.dataset.tmUiMode = "desktop";
            element.style.display = "flex";
            element.style.flexDirection = "column";
            element.style.minWidth = "0";
            element.style.minHeight = "0";
            element.style.height = "100%";
            element.style.overflow = "hidden";
            element.style.overscrollBehavior = "none";
            element.style.isolation = "isolate";
        } catch (e) {}
        try {
            const containmentHosts = [
                element.parentElement,
                element.closest(".layout-tab-container"),
            ];
            const seen = new Set();
            containmentHosts.forEach((host) => {
                if (!(host instanceof HTMLElement) || seen.has(host)) return;
                seen.add(host);
                host.style.display = host.style.display || "flex";
                host.style.flexDirection = host.style.flexDirection || "column";
                host.style.minWidth = "0";
                host.style.minHeight = "0";
                host.style.overflow = "hidden";
                host.style.overscrollBehavior = "none";
            });
        } catch (e) {}
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

    tryImmediateMountTabRoot(element, options = {}) {
        if (!(element instanceof HTMLElement)) return false;
        this.prepareTaskTabRoot(element);
        if (this.isTabRootMountedForCurrentToken(element)) return true;
        const mountFn = globalThis.__taskHorizonMount;
        if (typeof mountFn !== "function") return false;
        const token = String(globalThis.__taskHorizonMountToken || this._mountToken || "");
        const allowRepeat = options?.force === true;
        try {
            if (!allowRepeat && token && element.__tmTaskHorizonFastMountToken === token) {
                return this.isTabRootMountedForCurrentToken(element);
            }
        } catch (e) {}
        try {
            element.__tmTaskHorizonFastMountToken = token || `fast:${Date.now()}`;
        } catch (e) {}
        try {
            globalThis.__taskHorizonTabElement = element;
            mountFn(element);
            if (token) element.dataset.tmTaskHorizonMounted = token;
        } catch (e) {}
        return this.isTabRootMountedForCurrentToken(element);
    }

    tryMountTabRoot(element, options = {}) {
        if (!(element instanceof HTMLElement)) return false;
        if (!options?.skipFastMount && this.tryImmediateMountTabRoot(element, options)) {
            return true;
        }
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
                    this.prepareTaskTabRoot(el);
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
            roots.forEach((el) => {
                if (el instanceof HTMLElement) this.prepareTaskTabRoot(el);
            });
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

    cancelTaskDockRecovery() {
        try {
            if (this._taskDockRecoveryTimer) {
                clearTimeout(this._taskDockRecoveryTimer);
                this._taskDockRecoveryTimer = null;
            }
        } catch (e) {}
        this._taskDockRecoveryToken = "";
    }

    resolveTaskDockElement(preferred = null) {
        const direct = preferred instanceof HTMLElement ? preferred : null;
        if (direct && document.body.contains(direct)) return direct;
        const cached = this._taskDockElement instanceof HTMLElement ? this._taskDockElement : null;
        if (cached && document.body.contains(cached)) return cached;
        try {
            const nodes = Array.from(document.querySelectorAll(`[data-type="${TASK_DOCK_TYPE}"]`));
            const target = nodes.find((node) => node instanceof HTMLElement && document.body.contains(node)) || null;
            if (target instanceof HTMLElement) return target;
        } catch (e) {}
        return null;
    }

    scheduleTaskDockRecovery(reason = "manual", options = {}) {
        if (this.isRuntimeMobileClient()) return;
        if (readTaskDockSettings().enabled === false) {
            this.cancelTaskDockRecovery();
            return;
        }
        const attempt = Math.max(0, Number(options?.attempt) || 0);
        const maxAttempts = Math.max(1, Number(options?.maxAttempts) || 5);
        if (attempt >= maxAttempts) return;
        const delayMs = Math.max(60, Number(options?.delayMs) || (attempt === 0 ? 120 : Math.min(1800, 180 * (attempt + 1))));
        const element = options?.element instanceof HTMLElement ? options.element : null;
        const token = `${Date.now()}:${Math.random()}:${reason}:${attempt}`;
        this.cancelTaskDockRecovery();
        this._taskDockRecoveryToken = token;
        this._taskDockRecoveryTimer = setTimeout(() => {
            if (this._taskDockRecoveryToken !== token) return;
            this._taskDockRecoveryTimer = null;
            if (this.isRuntimeMobileClient()) return;
            if (readTaskDockSettings().enabled === false) return;
            const target = this.resolveTaskDockElement(element);
            if (!(target instanceof HTMLElement)) {
                this.scheduleTaskDockRecovery(reason, {
                    attempt: attempt + 1,
                    maxAttempts,
                    delayMs: Math.min(2200, delayMs * 2),
                });
                return;
            }
            const mounted = this.mountTaskDockElement(target, {
                reactivate: true,
                reason: `recover:${reason}:${attempt + 1}`,
                fromRecovery: true,
            });
            if (!mounted) {
                this.scheduleTaskDockRecovery(reason, {
                    element: target,
                    attempt: attempt + 1,
                    maxAttempts,
                    delayMs: Math.min(2200, Math.round(delayMs * 1.8)),
                });
            }
        }, delayMs);
    }

    initTaskDock() {
        if (this.isRuntimeMobileClient()) return;
        this._taskDockSettingsHandler = () => {
            this.handleTaskDockSettingsChanged();
        };
        this._taskDockStorageHandler = (event) => {
            const key = String(event?.key || "");
            if (key && key !== "tm_dock_sidebar_enabled" && key !== "tm_dock_default_view_mode" && key !== "tm_dock_checklist_compact_meta_fields" && key !== "tm_default_view_mode_mobile" && key !== "tm_enabled_views") {
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
                const mounted = plugin.mountTaskDockElement(this.element || null);
                if (!mounted) {
                    plugin.scheduleTaskDockRecovery("dock-init", { element: this.element || null });
                }
                setTimeout(() => plugin.syncTaskDockVisibility(), 0);
            },
            update() {
                plugin._taskDockElement = this.element || null;
                plugin._taskDockOpen = true;
                const mounted = plugin.mountTaskDockElement(this.element || null, { reactivate: false, reason: "update" });
                if (!mounted) {
                    plugin.scheduleTaskDockRecovery("dock-update", { element: this.element || null });
                }
                setTimeout(() => plugin.syncTaskDockVisibility(), 0);
            },
            resize() {
                plugin._taskDockElement = this.element || null;
                plugin._taskDockOpen = true;
                const mounted = plugin.mountTaskDockElement(this.element || null, { reactivate: false, reason: "resize" });
                if (!mounted) {
                    plugin.scheduleTaskDockRecovery("dock-resize", { element: this.element || null, delayMs: 180 });
                }
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
        return getDockHostsByType(TASK_DOCK_TYPE);
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
        this.cancelTaskDockRecovery();
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
            element.style.overscrollBehavior = "none";
        } catch (e) {}
        try {
            const containmentHosts = getDockContainmentHosts(element);
            containmentHosts.forEach((host) => {
                host.style.minWidth = "0";
                host.style.minHeight = "0";
                host.style.overflow = "hidden";
                host.style.overscrollBehavior = "none";
            });
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
        root.style.display = "flex";
        root.style.flexDirection = "column";
        root.style.position = "relative";
        root.style.overflow = "hidden";
        root.style.overscrollBehavior = "none";
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

    mountTaskDockElement(element, options = {}) {
        if (!(element instanceof HTMLElement)) return false;
        const reactivate = options?.reactivate !== false;
        const fromRecovery = options?.fromRecovery === true;
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
            this.cancelTaskDockRecovery();
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
            if (!fromRecovery) {
                this.scheduleTaskDockRecovery(String(options?.reason || "mount-waiting"));
            }
            return false;
        }
        try {
            mountFn(root);
            if (!fromRecovery) {
                this.scheduleTaskDockRecovery(String(options?.reason || "mount-post"));
            }
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
            if (!fromRecovery) {
                this.scheduleTaskDockRecovery(String(options?.reason || "mount-error"), { delayMs: 260 });
            }
            return false;
        }
    }

    reloadTaskDockFrame() {
        const element = this.resolveTaskDockElement();
        if (!(element instanceof HTMLElement)) return;
        this.destroyTaskDockFrame(element);
        const mounted = this.mountTaskDockElement(element, { reactivate: true, reason: "reload" });
        if (!mounted) {
            this.scheduleTaskDockRecovery("dock-reload", { element });
        }
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
        try { this.cancelTaskDockRecovery(); } catch (e) {}
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
        try { delete globalThis.__taskHorizonPluginManifest; } catch (e) {}
        try { delete globalThis.__taskHorizonPluginIsMobile; } catch (e) {}
        try { delete globalThis.__taskHorizonPluginIsNativeMobile; } catch (e) {}
        try { delete globalThis.__taskHorizonRuntimeClientKind; } catch (e) {}
        try { delete globalThis.__taskHorizonOpenTab; } catch (e) {}
        try { delete globalThis.__taskHorizonOpenMobileFileById; } catch (e) {}
        try { delete globalThis.__taskHorizonPlatformUtils; } catch (e) {}
        try { delete globalThis.__taskHorizonHostBridge; } catch (e) {}
        try { delete globalThis.__taskHorizonOpenTabView; } catch (e) {}
        try { delete globalThis.__taskHorizonCustomTabId; } catch (e) {}
        try { delete globalThis.__taskHorizonTabElement; } catch (e) {}
        try { delete globalThis.__taskHorizonQuickbarLoaded; } catch (e) {}
        try { delete globalThis.__taskHorizonQuickbarToggle; } catch (e) {}
        try { delete globalThis.__taskHorizonQuickbarCleanup; } catch (e) {}
        try { delete globalThis.__taskHorizonExplicitWindowExportKeys; } catch (e) {}
        try { delete globalThis.__taskHorizonAiCleanup; } catch (e) {}
        try { delete globalThis.__taskHorizonEnsureAiModuleLoaded; } catch (e) {}
        try { delete globalThis.__taskHorizonEnsureXlsxModuleLoaded; } catch (e) {}
        try { delete globalThis.__taskHorizonMount; } catch (e) {}
        try { delete globalThis.__TaskManagerCleanup; } catch (e) {}
        try { delete globalThis.__taskHorizonMountToken; } catch (e) {}
        try { delete globalThis.__taskHorizonTabType; } catch (e) {}
        try { delete globalThis.__tmHost; } catch (e) {}
        try { delete globalThis.__tmCompat; } catch (e) {}
        try { delete globalThis.__tmCaps; } catch (e) {}
        try { delete globalThis.__tmRuntimeHost; } catch (e) {}
        try { delete globalThis.__tmViewPolicy; } catch (e) {}
        try { delete globalThis.__tmRuntimeState; } catch (e) {}
        try { delete globalThis.__tmRuntimeEvents; } catch (e) {}
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
