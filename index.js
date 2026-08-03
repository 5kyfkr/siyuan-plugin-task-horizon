const { Plugin, Protyle, openTab, openMobileFileById, platformUtils, getFrontend } = require("siyuan");

const PLUGIN_ID = "siyuan-plugin-task-horizon";
const TASK_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/task.js`;
const TASK_MAIN_STYLE_PATH = `/data/plugins/${PLUGIN_ID}/task-horizon.css`;
const TASK_DEV_MANIFEST_PATH = `/data/plugins/${PLUGIN_ID}/src/task-horizon/manifest.main.json`;
const TASK_DEV_SOURCE_ROOT = `/data/plugins/${PLUGIN_ID}/src/task-horizon`;
const AI_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/ai.js`;
const AGENT_WORKBENCH_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/src/ai/agent-workbench.js`;
const AGENT_WORKBENCH_STYLE_PATH = `/data/plugins/${PLUGIN_ID}/src/ai/agent-workbench.css`;
const HOMEPAGE_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/homepage.js`;
const QUICKBAR_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/quickbar.js`;
const XLSX_VENDOR_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/src/vendor/xlsx.full.min.js`;
const FULLCALENDAR_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/src/fullcalendar/fullcalendar.global.js`;
const FULLCALENDAR_LOCALES_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/src/fullcalendar/locales-all/global.js`;
const FULLCALENDAR_FORMA_THEME_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/src/fullcalendar/themes/forma/global.js`;
const FULLCALENDAR_SKELETON_CSS_PATH = `/data/plugins/${PLUGIN_ID}/src/fullcalendar/skeleton.css`;
const FULLCALENDAR_FORMA_THEME_CSS_PATH = `/data/plugins/${PLUGIN_ID}/src/fullcalendar/themes/forma/theme.css`;
const FULLCALENDAR_FORMA_BASECOAT_CSS_PATH = `/data/plugins/${PLUGIN_ID}/src/fullcalendar/themes/forma/palettes/basecoat.css`;
const BASECOAT_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/src/basecoat/basecoat.js`;
const BASECOAT_CSS_PATH = `/data/plugins/${PLUGIN_ID}/src/basecoat/basecoat.css`;
const CALENDAR_SUBSCRIPTION_CORE_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/calendar-subscription-core.js`;
const CALENDAR_VIEW_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/calendar-view.js`;
const CALENDAR_VIEW_CSS_PATH = `/data/plugins/${PLUGIN_ID}/calendar-view.css`;
const PLUGIN_MANIFEST_PATH = `/data/plugins/${PLUGIN_ID}/plugin.json`;
const TAB_TYPE = "task-horizon";
const TAB_TITLE = "任务管理器";
const COMMAND_OPEN_TASK_HORIZON = "openTaskHorizon";
const COMMAND_OPEN_QUICK_ADD_TASK_WINDOW = "openQuickAddTaskWindow";
const ICON_ID = "iconTaskHorizon";
const ENTRY_ICON_PRESET_STORAGE_KEY = "tm_entry_icon_preset";
const DEFAULT_ENTRY_ICON_PRESET = "classic";
const WINDOW_TOPBAR_ATTR = "data-task-horizon-window-topbar";
const WINDOW_TOPBAR_ELEMENT_ID = "plugin_siyuan-plugin-task-horizon_task-manager";
const CALENDAR_SUBSCRIPTION_TOPBAR_ICON_ID = "iconTaskHorizonCalendarUpload";
const CALENDAR_SUBSCRIPTION_TOPBAR_ATTR = "data-task-horizon-calendar-subscription-topbar";
const CALENDAR_SUBSCRIPTION_TOPBAR_ELEMENT_ID = "plugin_siyuan-plugin-task-horizon_calendar-subscription";
const SIYUAN_UNPINNED_TOPBAR_STORAGE_KEY = "local-plugintopunpin";
const CUSTOM_TAB_ID = PLUGIN_ID + TAB_TYPE;
const TASK_DOCK_TYPE = "::task-horizon-dock";
const TASK_DOCK_TITLE = "任务侧栏";
const TASK_DOCK_ROOT_ATTR = "data-task-horizon-dock-root";
const TASK_DOCK_SNAPSHOT_ATTR = "data-task-horizon-dock-snapshot";
const RESOURCE_FETCH_TIMEOUT_MS = 12000;
const DOCK_VIEW_IDS = new Set(["list", "checklist", "timeline", "kanban", "calendar", "whiteboard"]);
const AI_EXPERIENCE_MODE_KEY = "tm_ai_experience_mode";
const AI_EXPERIENCE_MODE_INITIALIZED_KEY = "tm_ai_experience_mode_initialized";
const AGENT_WORKBENCH_STORE_FILE = "agent-workbench.json";
const AGENT_BUILTIN_SKILL_NAMES = Object.freeze(["task-capture", "task-planning", "task-review", "task-template"]);

const hashAgentSkillContent = async (content) => {
    const value = String(content || "");
    if (globalThis.crypto?.subtle && typeof TextEncoder === "function") {
        try {
            const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
            return Array.from(new Uint8Array(digest), (item) => item.toString(16).padStart(2, "0")).join("");
        } catch (e) {}
    }
    let first = 0x811c9dc5;
    let second = 0x9e3779b9;
    for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index);
        first = Math.imul(first ^ code, 0x01000193) >>> 0;
        second = Math.imul(second ^ (code + index), 0x85ebca6b) >>> 0;
    }
    return `fallback:${first.toString(16).padStart(8, "0")}${second.toString(16).padStart(8, "0")}:${value.length}`;
};

const removeUnmodifiedAgentSkills = async (pluginInstance) => {
    let store = null;
    try { store = await pluginInstance?.loadData?.(AGENT_WORKBENCH_STORE_FILE); } catch (e) {}
    const tracked = store?.builtinSkills && typeof store.builtinSkills === "object" ? store.builtinSkills : {};
    for (const name of AGENT_BUILTIN_SKILL_NAMES) {
        const trackedHash = String(tracked?.[name]?.hash || "").trim();
        if (!trackedHash) continue;
        try {
            const response = await fetch("/api/ai/agent/getSkill", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });
            const payload = response.ok ? await response.json() : null;
            const content = payload && Number(payload.code) === 0 ? payload.data?.content : null;
            if (typeof content !== "string" || await hashAgentSkillContent(content) !== trackedHash) continue;
            const removed = await fetch("/api/ai/agent/removeSkill", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });
            if (!removed.ok) continue;
            const result = await removed.json().catch(() => null);
            if (result && Number(result.code) !== 0) console.warn("[task-horizon] remove Agent skill failed", name, result.msg || "");
        } catch (e) {
            console.warn("[task-horizon] cleanup Agent skill failed", name, e);
        }
    }
};

const notifyTaskHorizonHostLifecycle = (phase, element) => {
    try {
        window.dispatchEvent(new CustomEvent("tm:task-horizon-host-lifecycle", {
            detail: { phase: String(phase || "update"), element: element || null },
        }));
    } catch (e) {}
};

const ENTRY_ICON_PRESETS = Object.freeze([
    {
        id: "classic",
        label: "经典图标",
        symbolId: "iconTaskHorizonPresetClassic",
        viewBox: "0 0 24 24",
        body: `<g transform="translate(12 12) scale(1.25) translate(-12 -12)" fill="none" stroke="currentColor">
<path d="M7.25 3.75h9.5c1.105 0 2 .895 2 2v12.5c0 1.105-.895 2-2 2h-9.5c-1.105 0-2-.895-2-2V5.75c0-1.105.895-2 2-2Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path>
<path d="M8.75 7h6.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
<path d="M8.75 10.5h6.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
<path d="M8.75 14h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
<path d="M12.1 17.6l1.55 1.55 3.2-3.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path>
</g>`,
    },
    {
        id: "inbox",
        label: "任务收件箱",
        symbolId: "iconTaskHorizonPresetInbox",
        viewBox: "1.5 1.5 21 21",
        body: `<path d="M5.25 4.25h13.5l1.5 9.25v5.25H3.75V13.5l1.5-9.25Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path>
<path d="M3.75 13.5h4.1l1.35 2h5.6l1.35-2h4.1M9.2 10.05l1.8 1.8 3.8-4.15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>`,
    },
    {
        id: "complete",
        label: "任务完成",
        symbolId: "iconTaskHorizonPresetComplete",
        viewBox: "1.5 1.5 21 21",
        body: `<rect x="4.25" y="4.25" width="15.5" height="15.5" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"></rect>
<path d="m8.25 12.15 2.4 2.4 5.15-5.65" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>`,
    },
    {
        id: "list",
        label: "任务列表",
        symbolId: "iconTaskHorizonPresetList",
        viewBox: "1.5 1.5 21 21",
        body: `<circle cx="5" cy="6" r="1.35" fill="currentColor"></circle>
<circle cx="5" cy="12" r="1.35" fill="currentColor"></circle>
<circle cx="5" cy="18" r="1.35" fill="currentColor"></circle>
<path d="M9 6h11M9 12h8M9 18h10" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"></path>`,
    },
    {
        id: "calendar",
        label: "日程任务",
        symbolId: "iconTaskHorizonPresetCalendar",
        viewBox: "1.5 1.5 21 21",
        body: `<rect x="3.5" y="4.5" width="17" height="16" rx="2.75" fill="none" stroke="currentColor" stroke-width="1.8"></rect>
<path d="M7.5 2.75v3.5M16.5 2.75v3.5M3.5 9.25h17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
<path d="m8.25 14.75 2.1 2.1 4.8-5.2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"></path>`,
    },
    {
        id: "focus",
        label: "聚焦完成",
        symbolId: "iconTaskHorizonPresetFocus",
        viewBox: "1.5 1.5 21 21",
        body: `<circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" stroke-width="1.8"></circle>
<path d="m8.25 12.2 2.45 2.45 5.15-5.65" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
<path d="M12 1.75v2M12 20.25v2M1.75 12h2M20.25 12h2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path>`,
    },
]);

const normalizeEntryIconPreset = (value) => {
    const id = String(value || "").trim();
    return ENTRY_ICON_PRESETS.some((preset) => preset.id === id) ? id : DEFAULT_ENTRY_ICON_PRESET;
};

const getEntryIconPreset = (value) => {
    const id = normalizeEntryIconPreset(value);
    return ENTRY_ICON_PRESETS.find((preset) => preset.id === id) || ENTRY_ICON_PRESETS[0];
};

const buildEntryIconSymbols = (value) => {
    const selected = getEntryIconPreset(value);
    const symbols = ENTRY_ICON_PRESETS.map((preset) => (
        `<symbol id="${preset.symbolId}" viewBox="${preset.viewBox}">${preset.body}</symbol>`
    ));
    symbols.unshift(`<symbol id="${ICON_ID}" viewBox="${selected.viewBox}">${selected.body}</symbol>`);
    symbols.push(`<symbol id="${CALENDAR_SUBSCRIPTION_TOPBAR_ICON_ID}" viewBox="0 0 24 24">
<path d="M12 13v8m-4-4 4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
<path d="M5 16a4 4 0 0 1-.4-7.98A6 6 0 0 1 16.5 6.6 4.5 4.5 0 0 1 18 15.35" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
</symbol>`);
    return symbols.join("\n");
};

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

const readWindowTopbarEnabled = () => {
    const key = isRuntimeMobileClient() ? "tm_window_topbar_icon_mobile" : "tm_window_topbar_icon_desktop";
    return readLocalJson(key, true) !== false;
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

const getOfficialFrontend = () => {
    try {
        return String(typeof getFrontend === "function" ? getFrontend() : "").trim().toLowerCase();
    } catch (e) {
        return "";
    }
};

const isMobileBrowserViewport = () => {
    const frontend = getOfficialFrontend();
    if (frontend === "browser-mobile") return true;
    if (frontend === "mobile" || frontend === "desktop" || frontend === "desktop-window" || frontend === "browser-desktop") return false;
    try {
        if (navigator?.userAgentData?.mobile === true) return true;
    } catch (e) {}
    try {
        const ua = String(navigator?.userAgent || "");
        if (/Android|iPhone|iPad|iPod|HarmonyOS|Mobile/i.test(ua)) return true;
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
    const frontend = getOfficialFrontend();
    if (frontend === "mobile") return "mobile-app";
    if (frontend === "browser-mobile") return "mobile-browser";
    if (frontend === "desktop" || frontend === "desktop-window" || frontend === "browser-desktop") return "desktop-browser";
    return isMobileBrowserViewport() ? "mobile-browser" : "desktop-browser";
};

const isRuntimeMobileClient = () => {
    return getRuntimeClientKind() !== "desktop-browser";
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

const resetTaskDockReloadVisibility = (plugin = null) => {
    const pluginName = String(plugin?.name || PLUGIN_ID).trim() || PLUGIN_ID;
    const fullType = `${pluginName}${TASK_DOCK_TYPE}`;
    try {
        const pluginDocks = globalThis.siyuan?.storage?.["local-plugin-docks"];
        const savedDock = pluginDocks?.[pluginName]?.[fullType];
        if (!savedDock || savedDock.show === false) return;
        savedDock.show = false;
        platformUtils?.setStorageVal?.("local-plugin-docks", pluginDocks);
    } catch (e) {}
};

const fetchText = async (url, data, timeoutMs = RESOURCE_FETCH_TIMEOUT_MS) => {
    let controller = null;
    let timer = null;
    try {
        if (typeof AbortController === "function" && Number(timeoutMs) > 0) {
            controller = new AbortController();
            timer = setTimeout(() => {
                try { controller.abort(); } catch (e) {}
            }, Math.max(1000, Number(timeoutMs) || RESOURCE_FETCH_TIMEOUT_MS));
        }
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data || {}),
            signal: controller?.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.text();
    } catch (e) {
        if (String(e?.name || "") === "AbortError") {
            throw new Error(`HTTP request timeout: ${url}`);
        }
        throw e;
    } finally {
        if (timer) {
            try { clearTimeout(timer); } catch (e) {}
        }
    }
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

const hasTaskMainRuntime = () => {
    try {
        return typeof globalThis.__taskHorizonMount === "function";
    } catch (e) {
        return false;
    }
};

const resetStaleTaskMainRuntimeFlag = () => {
    if (hasTaskMainRuntime()) return;
    try { delete globalThis.__TaskHorizonLoaded; } catch (e) {}
};

const clearPluginResourceTextCache = () => {
    try { __tmResourceTextCache.clear(); } catch (e) {}
    try { __tmResourceTextInflight.clear(); } catch (e) {}
    try { __tmDeferredScriptLoaders.clear(); } catch (e) {}
};

const releasePluginResourceText = (path) => {
    const key = String(path || "").trim();
    if (!key) return;
    try { __tmResourceTextCache.delete(key); } catch (e) {}
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
    } catch (e) {
    } finally {
        releasePluginResourceText(PLUGIN_MANIFEST_PATH);
    }
    try {
        return normalizePluginManifest(pluginInstance?.manifest);
    } catch (e) {}
    return normalizePluginManifest(null);
};

const createTaskHorizonHostBridge = (pluginInstance) => ({
    plugin: pluginInstance || null,
    kernel: pluginInstance?.kernel || null,
    app: pluginInstance?.app || null,
    eventBus: pluginInstance?.eventBus || null,
    platformUtils: platformUtils || null,
    getFrontend: () => getOfficialFrontend(),
    Protyle: typeof Protyle === "function" ? Protyle : null,
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

const normalizeTaskHorizonAssetPath = (assetPath) => String(assetPath || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

const joinTaskHorizonPath = (...parts) => {
    const normalized = parts
        .map((part) => String(part || "").trim().replace(/\\/g, "/"))
        .filter(Boolean);
    if (!normalized.length) return "";
    const first = normalized.shift().replace(/\/+$/, "");
    const rest = normalized.map((part) => part.replace(/^\/+|\/+$/g, ""));
    return [first, ...rest].filter(Boolean).join("/");
};

const getTaskHorizonWorkspaceDir = () => {
    const candidates = [
        window?.siyuan?.config?.system?.workspaceDir,
        window?.siyuan?.config?.system?.workspace,
        window?.siyuan?.config?.system?.homeDir,
    ];
    for (const item of candidates) {
        const value = String(item || "").trim();
        if (value) return value;
    }
    return "";
};

const openTaskHorizonSystemPath = async (absolutePath) => {
    const path = String(absolutePath || "").trim();
    if (!path) return false;
    const utils = platformUtils || null;
    const methods = ["openPath", "openFile", "openBy", "openExternal"];
    for (const name of methods) {
        const fn = utils && typeof utils[name] === "function" ? utils[name] : null;
        if (!fn) continue;
        try {
            const result = await fn(path);
            if (result === false || typeof result === "string") continue;
            return true;
        } catch (e) {}
    }
    try {
        const electron = require("electron");
        if (electron?.shell && typeof electron.shell.openPath === "function") {
            const result = await electron.shell.openPath(path);
            if (!result) return true;
        }
    } catch (e) {}
    return false;
};

const decodeTaskHorizonFilePathPart = (value) => {
    const text = String(value || "");
    try { return decodeURIComponent(text); } catch (e) {}
    try { return decodeURI(text); } catch (e) {}
    return text;
};

const normalizeTaskHorizonLocalSystemPath = (value) => {
    const raw = String(value || "").trim();
    if (!/^file:/i.test(raw)) return "";
    let text = raw.replace(/\\/g, "/");
    if (/^file:\/\/[A-Za-z]:\//i.test(text)) text = text.replace(/^file:\/\//i, "file:///");
    try {
        const url = new URL(text);
        if (String(url.protocol || "").toLowerCase() !== "file:") return "";
        const host = String(url.hostname || "").trim();
        const pathname = decodeTaskHorizonFilePathPart(url.pathname || "");
        if (/^[A-Za-z]:$/i.test(host)) {
            return `${host}\\${pathname.replace(/^\/+/, "").replace(/\//g, "\\")}`;
        }
        if (host) return `\\\\${host}${pathname.replace(/\//g, "\\")}`;
        return pathname.replace(/^\/([A-Za-z]:\/)/, "$1").replace(/\//g, "\\");
    } catch (e) {
        const body = decodeTaskHorizonFilePathPart(text.replace(/^file:(?:\/\/)?/i, ""));
        return body.replace(/^\/([A-Za-z]:\/)/, "$1").replace(/\//g, "\\");
    }
};

const openTaskHorizonAssetWithSystem = async (assetPath) => {
    const localPath = normalizeTaskHorizonLocalSystemPath(assetPath);
    if (localPath) return await openTaskHorizonSystemPath(localPath);
    const normalized = normalizeTaskHorizonAssetPath(assetPath);
    if (!normalized || !/^assets\//i.test(normalized)) return false;
    const workspaceDir = getTaskHorizonWorkspaceDir();
    if (!workspaceDir) return false;
    return await openTaskHorizonSystemPath(joinTaskHorizonPath(workspaceDir, "data", normalized));
};

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
        } finally {
            releasePluginResourceText(fullPath);
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
    } finally {
        releasePluginResourceText(TASK_DEV_MANIFEST_PATH);
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
    if (hasTaskMainRuntime()) return true;
    resetStaleTaskMainRuntimeFlag();
    const devLoad = await loadTaskDevManifestScripts();
    if (devLoad.status === "loaded") {
        if (hasTaskMainRuntime()) {
            console.log(`[task-horizon] dev sources loaded (${devLoad.scripts.length} files): task-horizon.dev-main.js`);
            return true;
        }
        console.error("[task-horizon] task dev main loaded but runtime mount is unavailable", devLoad.scripts);
        resetStaleTaskMainRuntimeFlag();
    }
    const bundledLoaded = await loadScriptText(TASK_SCRIPT_PATH, "task.js");
    if (bundledLoaded) {
        if (hasTaskMainRuntime()) return true;
        console.error("[task-horizon] task.js loaded but runtime mount is unavailable");
        resetStaleTaskMainRuntimeFlag();
    }
    if (devLoad.status !== "missing" && !bundledLoaded) {
        console.error("[task-horizon] task main load failed; dev manifest and task.js fallback are unavailable");
    }
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
    } finally {
        releasePluginResourceText(path);
    }
};

const hasAiRuntime = () => {
    try {
        return !!globalThis.__tmAI?.loaded;
    } catch (e) {
        return false;
    }
};

const hasAgentWorkbenchRuntime = () => {
    try {
        return !!(globalThis.__tmAI?.loaded && globalThis.__tmAI?.runtimeKind === "agent");
    } catch (e) {
        return false;
    }
};

const getAiExperienceMode = () => {
    try {
        const raw = JSON.parse(localStorage.getItem(AI_EXPERIENCE_MODE_KEY) || '""');
        if (raw === "agent" || raw === "legacy") return raw;
    } catch (e) {}
    return "agent";
};

const persistAiExperienceMode = (mode) => {
    const normalized = String(mode || "").trim() === "legacy" ? "legacy" : "agent";
    try {
        localStorage.setItem(AI_EXPERIENCE_MODE_KEY, JSON.stringify(normalized));
        localStorage.setItem(AI_EXPERIENCE_MODE_INITIALIZED_KEY, JSON.stringify(true));
    } catch (e) {}
    return normalized;
};

const ensureAiExperienceRuntime = async (requestedMode = "") => {
    const requested = String(requestedMode || "").trim();
    const mode = requested === "agent" || requested === "legacy" ? requested : getAiExperienceMode();
    const currentKind = globalThis.__tmAI?.runtimeKind === "agent" ? "agent" : (globalThis.__tmAI?.loaded ? "legacy" : "");
    if (currentKind && currentKind !== mode) {
        try { globalThis.__tmAI?.cleanup?.(); } catch (e) {}
        try { delete globalThis.__tmAI; } catch (e) {}
    }
    if (mode === "agent") {
        if (hasAgentWorkbenchRuntime()) return true;
        await loadStyleText(AGENT_WORKBENCH_STYLE_PATH, "agent-workbench.css");
        return await ensureDeferredScriptText("agent-workbench", AGENT_WORKBENCH_SCRIPT_PATH, "agent-workbench.js", hasAgentWorkbenchRuntime);
    }
    return await ensureDeferredScriptText("legacy-ai", AI_SCRIPT_PATH, "ai.js", hasAiRuntime);
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
    } finally {
        releasePluginResourceText(path);
    }
};

module.exports = class TaskHorizonPlugin extends Plugin {
    isRuntimeMobileClient() {
        return isRuntimeMobileClient(this);
    }

    applyStableTopBarIdentity(element, stableId) {
        if (!(element instanceof HTMLElement)) return null;
        try { element.id = stableId; } catch (e) {}
        let unpinned = false;
        try {
            const ids = globalThis.siyuan?.storage?.[SIYUAN_UNPINNED_TOPBAR_STORAGE_KEY];
            unpinned = Array.isArray(ids) && ids.includes(stableId);
        } catch (e) {}
        if (this.isRuntimeMobileClient()) {
            if (unpinned) {
                try { element.remove(); } catch (e) {}
            } else if (!document.contains(element)) {
                try { document.querySelector("#menuConfigAbout")?.after(element); } catch (e) {}
            }
        } else {
            try { element.classList.toggle("fn__none", unpinned); } catch (e) {}
        }
        return element;
    }

    applyEntryIconPreset(value) {
        const preset = getEntryIconPreset(value);
        const symbol = document.querySelector(`svg[data-name="${PLUGIN_ID}"] symbol#${ICON_ID}`);
        if (!(symbol instanceof Element)) return preset.id;
        try { symbol.setAttribute("viewBox", preset.viewBox); } catch (e) {}
        try { symbol.innerHTML = preset.body; } catch (e) {}
        this._entryIconPreset = preset.id;
        return preset.id;
    }

    syncEntryIconEntitlement(value = this._entryIconDesiredPreset) {
        const desired = normalizeEntryIconPreset(value);
        this._entryIconDesiredPreset = desired;
        const canUsePremium = desired === DEFAULT_ENTRY_ICON_PRESET
            || (typeof window.tmLicenseHasFeature === "function" && window.tmLicenseHasFeature("pro"));
        return this.applyEntryIconPreset(canUsePremium ? desired : DEFAULT_ENTRY_ICON_PRESET);
    }

    initEntryIconRuntime(value) {
        this._entryIconDesiredPreset = normalizeEntryIconPreset(value);
        const presets = Object.freeze(ENTRY_ICON_PRESETS.map((preset) => Object.freeze({
            id: preset.id,
            label: preset.label,
            symbolId: preset.symbolId,
        })));
        globalThis.__taskHorizonEntryIconRegistry = Object.freeze({
            plugin: this,
            presets,
            normalize: normalizeEntryIconPreset,
            applyPreset: (nextValue) => this.syncEntryIconEntitlement(nextValue),
            getActivePreset: () => String(this._entryIconPreset || DEFAULT_ENTRY_ICON_PRESET),
        });
        this._entryIconStorageHandler = (event) => {
            if (String(event?.key || "") !== ENTRY_ICON_PRESET_STORAGE_KEY) return;
            this.syncEntryIconEntitlement(readLocalJson(ENTRY_ICON_PRESET_STORAGE_KEY, DEFAULT_ENTRY_ICON_PRESET));
        };
        this._entryIconLicenseHandler = () => this.syncEntryIconEntitlement();
        try { window.addEventListener("storage", this._entryIconStorageHandler); } catch (e) {}
        try { window.addEventListener("tm:task-horizon-license-changed", this._entryIconLicenseHandler); } catch (e) {}
        return this.syncEntryIconEntitlement();
    }

    destroyEntryIconRuntime() {
        try {
            if (this._entryIconStorageHandler) {
                window.removeEventListener("storage", this._entryIconStorageHandler);
                this._entryIconStorageHandler = null;
            }
            if (this._entryIconLicenseHandler) {
                window.removeEventListener("tm:task-horizon-license-changed", this._entryIconLicenseHandler);
                this._entryIconLicenseHandler = null;
            }
        } catch (e) {}
        try {
            if (globalThis.__taskHorizonEntryIconRegistry?.plugin === this) {
                delete globalThis.__taskHorizonEntryIconRegistry;
            }
        } catch (e) {}
        this._entryIconPreset = null;
        this._entryIconDesiredPreset = null;
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
        this._taskPostMainAssetsLoaded = false;
        this._taskPostMainAssetsLoading = null;
        this._taskMainRuntimeRecoveryTimer = null;
        this._taskDataChangedPromise = null;
        this._taskDataChangedQueued = false;
        this._taskWindowTopBarLayoutReady = false;
        this._taskCalendarSubscriptionTopBarElement = null;
        this._taskCalendarSubscriptionTopBarMeta = { enabled: false, running: false, title: "立即上传日历 ICS" };
        globalThis.__taskHorizonPluginApp = this.app;
        globalThis.__taskHorizonPluginInstance = this;
        globalThis.__taskHorizonPluginIsMobile = runtimeMobile;
        globalThis.__taskHorizonPluginIsNativeMobile = runtimeNativeMobile;
        globalThis.__taskHorizonFrontend = getOfficialFrontend();
        globalThis.__taskHorizonRuntimeClientKind = getRuntimeClientKind();
        globalThis.__taskHorizonOpenTab = typeof openTab === "function" ? openTab : null;
        globalThis.__taskHorizonProtyle = typeof Protyle === "function" ? Protyle : null;
        globalThis.__taskHorizonOpenMobileFileById = typeof openMobileFileById === "function" ? openMobileFileById : null;
        globalThis.__taskHorizonPlatformUtils = platformUtils || null;
        globalThis.__taskHorizonOpenAssetWithSystem = openTaskHorizonAssetWithSystem;
        globalThis.__taskHorizonOpenTabView = this.openTaskHorizonTab.bind(this);
        globalThis.__taskHorizonSyncWindowTopBar = this.syncWindowTopBar.bind(this);
        globalThis.__taskHorizonSyncCalendarSubscriptionTopBar = this.syncCalendarSubscriptionTopBar.bind(this);
        globalThis.__taskHorizonApplyWindowTopBarIdentity = (element) => this.applyStableTopBarIdentity(element, WINDOW_TOPBAR_ELEMENT_ID);
        globalThis.__taskHorizonHostBridge = createTaskHorizonHostBridge(this);
        globalThis.__taskHorizonCustomTabId = CUSTOM_TAB_ID;
        globalThis.__taskHorizonTabType = TAB_TYPE;
        globalThis.__taskHorizonMountToken = mountToken;
        globalThis.__taskHorizonGetAiExperienceMode = getAiExperienceMode;
        globalThis.__taskHorizonEnsureAiModuleLoaded = ensureAiExperienceRuntime;
        globalThis.__taskHorizonSetAiExperienceMode = async (mode, options = {}) => {
            const normalized = String(mode || "").trim() === "legacy" ? "legacy" : "agent";
            const previousMode = getAiExperienceMode();
            const currentKind = globalThis.__tmAI?.runtimeKind === "agent" ? "agent" : (globalThis.__tmAI?.loaded ? "legacy" : "");
            if (currentKind === normalized) {
                persistAiExperienceMode(normalized);
                return true;
            }
            try { globalThis.__tmAI?.cleanup?.(); } catch (e) {}
            try { delete globalThis.__tmAI; } catch (e) {}
            try {
                const ready = await ensureAiExperienceRuntime(normalized);
                if (!ready) throw new Error(`无法加载${normalized === "agent" ? "思源智能体" : "旧版 AI"}运行时`);
                persistAiExperienceMode(normalized);
                try {
                    window.dispatchEvent(new CustomEvent("tm:task-horizon-ai-mode-changed", { detail: { mode: normalized } }));
                } catch (e) {}
                if (options?.open === true) {
                    try { await globalThis.tmOpenAiSidebar?.({ __tmAiPendingOpen: false }); } catch (e) {}
                }
                return true;
            } catch (error) {
                try { globalThis.__tmAI?.cleanup?.(); } catch (e) {}
                try { delete globalThis.__tmAI; } catch (e) {}
                const restored = await ensureAiExperienceRuntime(previousMode).catch(() => false);
                persistAiExperienceMode(previousMode);
                if (!restored) console.error("[task-horizon] restore previous AI runtime failed", previousMode);
                throw error;
            }
        };
        globalThis.__taskHorizonEnsureHomepageModuleLoaded = () => ensureDeferredScriptText("homepage", HOMEPAGE_SCRIPT_PATH, "homepage.js", () => !!globalThis.__tmHomepage?.loaded);
        globalThis.__taskHorizonEnsureXlsxModuleLoaded = () => ensureDeferredScriptText("xlsx", XLSX_VENDOR_SCRIPT_PATH, "vendor/xlsx.full.min.js", hasXlsxRuntime);
        globalThis.__taskHorizonPluginManifest = normalizePluginManifest(this?.manifest);
        Promise.resolve(loadPluginManifest(this)).then((manifest) => {
            if (String(globalThis.__taskHorizonMountToken || "") !== mountToken) return;
            globalThis.__taskHorizonPluginManifest = manifest;
        }).catch(() => null);
        const entryIconPreset = normalizeEntryIconPreset(readLocalJson(ENTRY_ICON_PRESET_STORAGE_KEY, DEFAULT_ENTRY_ICON_PRESET));
        try { this.addIcons(buildEntryIconSymbols(entryIconPreset)); } catch (e) {}
        try { this.initEntryIconRuntime(entryIconPreset); } catch (e) {}
        try { this.registerTaskHorizonAgentActions(); } catch (e) { console.warn("[task-horizon] register Agent actions failed", e); }
        try {
            if (!runtimeMobile && readWindowTopbarEnabled()) this.ensureWindowTopBar();
        } catch (e) {}
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
        if (mainLoaded) {
            await this.activateTaskMainRuntime("post-load");
        } else {
            console.warn("[task-horizon] task main runtime is not ready; scheduling recovery");
            this.scheduleTaskMainRuntimeRecovery("post-load", { delayMs: 300 });
        }
        this.addIcons(`
            <symbol id="iconTaskCancelled" viewBox="0 0 32 32">
                <path d="M28.444 0h-24.889c-1.956 0-3.556 1.6-3.556 3.556v24.889c0 1.956 1.6 3.556 3.556 3.556h24.889c1.956 0 3.556-1.6 3.556-3.556v-24.889c0-1.956-1.6-3.556-3.556-3.556zM28.444 28.445h-24.889v-24.889h24.889v24.889z"></path>
                <path d="M24.485 10.343l-2.828-2.828-5.657 5.657-5.657-5.657-2.828 2.828 5.657 5.657-5.657 5.657 2.828 2.828 5.657-5.657 5.657 5.657 2.828-2.828-5.657-5.657z"></path>
            </symbol>
        `);
    }

    async onDataChanged() {
        this._taskDataChangedQueued = true;
        if (this._taskDataChangedPromise) return await this._taskDataChangedPromise;

        const mountToken = String(globalThis.__taskHorizonMountToken || this._mountToken || "");
        this._taskDataChangedPromise = (async () => {
            let refreshed = false;
            do {
                this._taskDataChangedQueued = false;
                try {
                    if (!hasTaskMainRuntime()) {
                        const loaded = await ensureTaskMainLoaded();
                        if (!loaded) {
                            this.scheduleTaskMainRuntimeRecovery("data-changed", { delayMs: 180 });
                            continue;
                        }
                    }
                    const reloadSyncedData = globalThis.__taskHorizonReloadSyncedData;
                    if (typeof reloadSyncedData !== "function") {
                        console.warn("[task-horizon] synchronized data reload is unavailable");
                        continue;
                    }
                    refreshed = await reloadSyncedData({ reason: "siyuan-data-changed" }) !== false || refreshed;
                } catch (e) {
                    console.warn("[task-horizon] synchronized data reload failed", e);
                } finally {
                    if (String(globalThis.__taskHorizonMountToken || "") === mountToken) {
                        try { this.syncWindowTopBar(); } catch (e) {}
                        try { this.syncCalendarSubscriptionTopBar(); } catch (e) {}
                    }
                }
            } while (this._taskDataChangedQueued
                && String(globalThis.__taskHorizonMountToken || "") === mountToken);
            return refreshed;
        })().finally(() => {
            this._taskDataChangedPromise = null;
            if (this._taskDataChangedQueued
                && String(globalThis.__taskHorizonMountToken || "") === mountToken) {
                Promise.resolve(this.onDataChanged()).catch((e) => {
                    console.warn("[task-horizon] queued synchronized data reload failed", e);
                });
            }
        });
        return await this._taskDataChangedPromise;
    }

    onLayoutReady() {
        resetTaskDockReloadVisibility(this);
        this._taskWindowTopBarLayoutReady = true;
        this.syncWindowTopBar();
        this.syncCalendarSubscriptionTopBar();
    }

    registerCommands() {
        if (this._commandsRegistered) return;
        this.addCommand({
            langKey: COMMAND_OPEN_TASK_HORIZON,
            langText: "打开任务管理器",
            hotkey: "",
            callback: () => {
                this.openTaskHorizonTab();
            },
        });
        this.addCommand({
            langKey: COMMAND_OPEN_QUICK_ADD_TASK_WINDOW,
            langText: "新建任务窗口",
            hotkey: "",
            callback: () => {
                void this.openQuickAddTaskWindow();
            },
        });
        this._commandsRegistered = true;
    }

    resolveActiveAgentTaskScope() {
        try {
            const activeHeader = document.querySelector('.layout__wnd--active [data-type="tab-header"].item--focus')
                || document.querySelector('ul.layout-tab-bar > [data-type="tab-header"].item--focus');
            if (!(activeHeader instanceof HTMLElement)) return { scope: 'unsupported', source: 'no_active_tab' };
            const tabID = String(activeHeader.getAttribute('data-id') || '').trim();
            const activeWindow = activeHeader.closest('.layout__wnd--active') || document;
            const panel = Array.from(activeWindow.querySelectorAll('[data-id]')).find((element) => (
                element !== activeHeader
                && String(element.getAttribute('data-id') || '').trim() === tabID
                && (element.classList.contains('tm-tab-root') || !!element.querySelector('.tm-tab-root, .protyle'))
            )) || null;
            const opened = typeof this.getOpenedTab === 'function' ? this.getOpenedTab() : null;
            const taskTabs = Array.isArray(opened?.[TAB_TYPE]) ? opened[TAB_TYPE] : [];
            const isTaskHorizonTab = taskTabs.some((model) => (
                model?.tab?.headElement === activeHeader
                || String(model?.tab?.id || '').trim() === tabID
                || (panel && model?.element === panel)
            )) || panel?.classList?.contains('tm-tab-root') === true;
            if (isTaskHorizonTab) return { scope: 'current_view', source: 'task_horizon_tab' };
            const protyle = panel?.matches?.('.protyle') ? panel : panel?.querySelector?.('.protyle');
            const documentID = [
                protyle?.querySelector?.('.protyle-title')?.getAttribute?.('data-node-id'),
                protyle?.querySelector?.('.protyle-title__input')?.getAttribute?.('data-node-id'),
                protyle?.querySelector?.('.protyle-background')?.getAttribute?.('data-node-id'),
                protyle?.dataset?.nodeId,
                protyle?.dataset?.id,
            ].map((value) => String(value || '').trim()).find((value) => /^[0-9]{14}-[A-Za-z0-9]+$/.test(value)) || '';
            if (documentID) return { scope: 'focused_document', source: 'siyuan_document_tab', documentID };
            return { scope: 'unsupported', source: 'unsupported_active_tab' };
        } catch (e) {
            return { scope: 'unsupported', source: 'active_tab_error' };
        }
    }

    registerTaskHorizonAgentActions() {
        if (this._taskHorizonAgentActionsRegistered || typeof this.addAgentAction !== "function") return false;
        const handlers = new Map();
        const register = (name, description, handler) => {
            const fullName = this.addAgentAction({ name, description, handler });
            const entry = { name: fullName, description };
            handlers.set(name, handler);
            handlers.set(fullName, handler);
            return entry;
        };
        const descriptors = [
            register("open_task_manager", "打开任务管理器的指定视图、任务或功能面板", async (args = {}) => {
                try {
                    this.openTaskHorizonTab();
                    const view = String(args.view || "").trim();
                    const taskID = String(args.taskID || args.taskId || "").trim();
                    const panel = String(args.panel || "").trim();
                    if (view && typeof globalThis.tmSwitchViewMode === "function") {
                        await globalThis.tmSwitchViewMode(view);
                    }
                    if (taskID && typeof globalThis.tmOpenTaskDetail === "function") {
                        await globalThis.tmOpenTaskDetail(taskID, null, { source: "agent-action", panel });
                    }
                    return { result: JSON.stringify({ opened: true, view, taskID, panel }) };
                } catch (e) {
                    return { error: String(e?.message || e || "打开任务管理器失败") };
                }
            }),
            register("focus_task", "在任务管理器中定位并聚焦一个任务", async (args = {}) => {
                const taskID = String(args.taskID || args.taskId || "").trim();
                if (!taskID) return { error: "缺少任务 ID" };
                try {
                    this.openTaskHorizonTab();
                    if (typeof globalThis.tmJumpToTask === "function") await globalThis.tmJumpToTask(taskID);
                    else if (typeof globalThis.tmOpenTaskDetail === "function") await globalThis.tmOpenTaskDetail(taskID, null, { source: "agent-focus" });
                    return { result: JSON.stringify({ focused: true, taskID }) };
                } catch (e) {
                    return { error: String(e?.message || e || "定位任务失败") };
                }
            }),
            register("get_task_view_context", "按活动页签注册任务范围；返回当前视图 scopeToken 和可重新筛选的 containerScopeToken；scope 可显式覆盖", async (args = {}) => {
                try {
                    const taskBridge = globalThis[PLUGIN_ID]?.aiBridge;
                    if (!taskBridge) throw new Error("任务上下文服务尚未就绪");
                    const registerScope = this.kernel?.rpc?.call?.taskHorizonRegisterTaskScope;
                    if (typeof registerScope !== "function") throw new Error("任务范围注册服务尚未就绪");
                    const explicitScope = String(args.scope || args.mode || "").trim();
                    const explicitDocumentID = String(args.documentID || args.documentId || "").trim();
                    const activeScope = this.resolveActiveAgentTaskScope();
                    const requestedScope = explicitScope || (explicitDocumentID ? "focused_document" : activeScope.scope);
                    if (requestedScope === "focused_document") {
                        const documentID = explicitDocumentID || (activeScope.scope === "focused_document" ? activeScope.documentID : "");
                        if (!/^[0-9]{14}-[A-Za-z0-9]+$/.test(documentID)) throw new Error("无法确定当前思源文档");
                        if (typeof taskBridge?.getDocumentTaskReadScope !== "function") throw new Error("文档任务范围服务尚未就绪");
                        const documentScope = await taskBridge.getDocumentTaskReadScope([documentID]);
                        const registeredDocument = await registerScope({
                            scopeID: String(documentScope?.scopeID || `documents:${documentID}`).trim(),
                            scopeMode: "documents",
                            taskIDs: [],
                            documentIDs: [documentID],
                            taskValues: Array.isArray(documentScope?.taskValues) ? documentScope.taskValues : [],
                            virtualTasks: Array.isArray(documentScope?.virtualTasks) ? documentScope.virtualTasks : [],
                        });
                        if (!registeredDocument || registeredDocument.ok !== true) throw new Error(String(registeredDocument?.error?.message || "文档任务范围注册失败"));
                        return { result: JSON.stringify({
                            source: (explicitScope || explicitDocumentID) ? "focused_document" : activeScope.source,
                            scopeToken: registeredDocument.data?.scopeToken,
                            viewScopeToken: registeredDocument.data?.scopeToken,
                            containerScopeToken: registeredDocument.data?.scopeToken,
                            scopeID: registeredDocument.data?.scopeID,
                            expiresAt: registeredDocument.data?.expiresAt,
                            documentID,
                            visibleTaskCount: registeredDocument.data?.taskCount,
                            realTaskCount: registeredDocument.data?.realTaskCount,
                            virtualTaskCount: registeredDocument.data?.virtualTaskCount,
                            containerTaskCount: registeredDocument.data?.taskCount,
                            documentCount: 1,
                        }) };
                    }
                    if (requestedScope !== "current_view") throw new Error("当前活动页签不是任务管理器或思源笔记");
                    if (typeof taskBridge.getCurrentViewContext !== "function") throw new Error("任务视图范围服务尚未就绪");
                    const context = await taskBridge.getCurrentViewContext();
                    const registered = await registerScope({
                        scopeID: String(context?.scopeID || "").trim(),
                        taskIDs: Array.isArray(context?.visibleTaskIDs) ? context.visibleTaskIDs : [],
                        documentIDs: Array.isArray(context?.documentIDs) ? context.documentIDs : [],
                        taskValues: Array.isArray(context?.taskValues) ? context.taskValues : [],
                        virtualTasks: Array.isArray(context?.virtualTasks) ? context.virtualTasks : [],
                    });
                    if (!registered || registered.ok !== true) throw new Error(String(registered?.error?.message || "任务范围注册失败"));
                    const containerDocumentIDs = Array.from(new Set((Array.isArray(context?.documentIDs) ? context.documentIDs : []).map((id) => String(id || "").trim()).filter(Boolean)));
                    let containerRegistered = registered;
                    if (containerDocumentIDs.length) {
                        if (typeof taskBridge?.getDocumentTaskReadScope !== "function") throw new Error("文档任务范围服务尚未就绪");
                        const containerScope = await taskBridge.getDocumentTaskReadScope(containerDocumentIDs);
                        containerRegistered = await registerScope({
                            scopeID: `${String(context?.groupID || "all").trim()}|${String(context?.activeDocID || "all").trim()}|container`,
                            scopeMode: "documents",
                            taskIDs: [],
                            documentIDs: containerDocumentIDs,
                            taskValues: Array.isArray(containerScope?.taskValues) ? containerScope.taskValues : [],
                            virtualTasks: Array.isArray(containerScope?.virtualTasks) ? containerScope.virtualTasks : [],
                        });
                        if (!containerRegistered || containerRegistered.ok !== true) throw new Error(String(containerRegistered?.error?.message || "任务容器范围注册失败"));
                    }
                    const selectedTaskIDs = Array.isArray(context?.selectedTaskIDs) ? context.selectedTaskIDs : [];
                    const selectedVirtualTasks = Array.isArray(context?.selectedVirtualTasks) ? context.selectedVirtualTasks : [];
                    let selectedRegistered = null;
                    if (selectedTaskIDs.length || selectedVirtualTasks.length) {
                        selectedRegistered = await registerScope({
                            scopeID: `${String(context?.scopeID || "").trim()}|selected`,
                            taskIDs: selectedTaskIDs,
                            documentIDs: Array.isArray(context?.documentIDs) ? context.documentIDs : [],
                            taskValues: (Array.isArray(context?.taskValues) ? context.taskValues : []).filter((item) => selectedTaskIDs.includes(String(item?.id || "").trim())),
                            virtualTasks: selectedVirtualTasks,
                        });
                        if (!selectedRegistered || selectedRegistered.ok !== true) throw new Error(String(selectedRegistered?.error?.message || "已选任务范围注册失败"));
                    }
                    return { result: JSON.stringify({
                        source: explicitScope ? "current_view" : activeScope.source,
                        scopeToken: registered.data?.scopeToken,
                        viewScopeToken: registered.data?.scopeToken,
                        containerScopeToken: containerRegistered.data?.scopeToken,
                        scopeID: context?.scopeID,
                        expiresAt: registered.data?.expiresAt,
                        groupID: context?.groupID,
                        groupLabel: context?.groupLabel,
                        activeDocID: context?.activeDocID,
                        activeDocLabel: context?.activeDocLabel,
                        view: context?.view,
                        viewLabel: context?.viewLabel,
                        filter: context?.filter,
                        visibleTaskCount: registered.data?.taskCount,
                        realTaskCount: registered.data?.realTaskCount,
                        virtualTaskCount: registered.data?.virtualTaskCount,
                        containerTaskCount: containerRegistered.data?.taskCount,
                        documentCount: registered.data?.documentCount,
                        focusedTaskID: context?.focusedTaskID,
                        selectedTaskCount: selectedTaskIDs.length + selectedVirtualTasks.length,
                        selectedScopeToken: selectedRegistered?.data?.scopeToken,
                        selectedTaskIDs: selectedTaskIDs.length + selectedVirtualTasks.length <= 20
                            ? selectedTaskIDs.concat(selectedVirtualTasks.map((item) => String(item?.id || "").trim()).filter(Boolean))
                            : [],
                        selectedTasksTruncated: selectedTaskIDs.length + selectedVirtualTasks.length > 20,
                    }) };
                } catch (e) {
                    return { error: String(e?.message || e || "读取任务视图失败") };
                }
            }),
        ];
        globalThis.__taskHorizonAgentActionDescriptors = descriptors;
        globalThis.__taskHorizonInvokeAgentAction = async (name, args = {}) => {
            const handler = handlers.get(String(name || "").trim());
            if (typeof handler !== "function") return { error: `未知前端动作: ${String(name || "")}` };
            return await handler(args, this.app);
        };
        this._taskHorizonAgentActionsRegistered = true;
        return true;
    }

    async loadTaskHorizonPostMainAssets() {
        if (this._taskPostMainAssetsLoaded) return true;
        if (this._taskPostMainAssetsLoading) return await this._taskPostMainAssetsLoading;
        this._taskPostMainAssetsLoading = Promise.resolve().then(async () => {
            await loadScriptText(BASECOAT_SCRIPT_PATH, "basecoat/basecoat.js");
            await loadScriptText(QUICKBAR_SCRIPT_PATH, "quickbar.js");
            await loadStyleText(BASECOAT_CSS_PATH, "basecoat/basecoat.css");
            await loadStyleText(FULLCALENDAR_SKELETON_CSS_PATH, "fullcalendar/skeleton.css");
            await loadStyleText(FULLCALENDAR_FORMA_THEME_CSS_PATH, "fullcalendar/themes/forma/theme.css");
            await loadStyleText(FULLCALENDAR_FORMA_BASECOAT_CSS_PATH, "fullcalendar/themes/forma/palettes/basecoat.css");
            await loadScriptText(FULLCALENDAR_SCRIPT_PATH, "fullcalendar/fullcalendar.global.js");
            await loadScriptText(FULLCALENDAR_FORMA_THEME_SCRIPT_PATH, "fullcalendar/themes/forma/global.js");
            await loadScriptText(FULLCALENDAR_LOCALES_SCRIPT_PATH, "fullcalendar/locales-all/global.js");
            await loadScriptText(CALENDAR_SUBSCRIPTION_CORE_SCRIPT_PATH, "calendar-subscription-core.js");
            await loadScriptText(CALENDAR_VIEW_SCRIPT_PATH, "calendar-view.js");
            await loadStyleText(CALENDAR_VIEW_CSS_PATH, "calendar-view.css");
            this._taskPostMainAssetsLoaded = true;
            return true;
        }).finally(() => {
            this._taskPostMainAssetsLoading = null;
        });
        return await this._taskPostMainAssetsLoading;
    }

    async activateTaskMainRuntime(reason = "manual") {
        this.cancelTaskMainRuntimeRecovery();
        this.registerCommands();
        await this.loadTaskHorizonPostMainAssets();
        this.mountExistingTabs(this.isRuntimeMobileClient() ? 7000 : 5000);
        if (!this.isRuntimeMobileClient()) {
            const dockElement = this.resolveTaskDockElement();
            if (dockElement instanceof HTMLElement) {
                this.reloadTaskDockFrame();
            } else {
                this.scheduleTaskDockRecovery(`runtime-ready:${reason}`, { delayMs: 80 });
            }
        }
    }

    cancelTaskMainRuntimeRecovery() {
        try {
            if (this._taskMainRuntimeRecoveryTimer) {
                clearTimeout(this._taskMainRuntimeRecoveryTimer);
                this._taskMainRuntimeRecoveryTimer = null;
            }
        } catch (e) {}
    }

    scheduleTaskMainRuntimeRecovery(reason = "manual", options = {}) {
        if (hasTaskMainRuntime()) {
            Promise.resolve(this.activateTaskMainRuntime(reason)).catch((e) => {
                console.error("[task-horizon] activate recovered runtime failed", e);
            });
            return true;
        }
        if (this._taskMainRuntimeRecoveryTimer) return true;
        const attempt = Math.max(0, Number(options?.attempt) || 0);
        const maxAttempts = Math.max(1, Number(options?.maxAttempts) || 10);
        if (attempt >= maxAttempts) {
            console.error("[task-horizon] task main runtime recovery gave up", reason);
            return false;
        }
        const delayMs = Math.max(120, Number(options?.delayMs) || (attempt === 0 ? 300 : Math.min(8000, 500 * (2 ** Math.min(attempt, 4)))));
        this._taskMainRuntimeRecoveryTimer = setTimeout(() => {
            this._taskMainRuntimeRecoveryTimer = null;
            Promise.resolve().then(async () => {
                if (hasTaskMainRuntime()) {
                    await this.activateTaskMainRuntime(`recovered:${reason}`);
                    return;
                }
                const loaded = await ensureTaskMainLoaded();
                if (loaded && hasTaskMainRuntime()) {
                    await this.activateTaskMainRuntime(`recovered:${reason}`);
                    return;
                }
                this.scheduleTaskMainRuntimeRecovery(reason, {
                    attempt: attempt + 1,
                    maxAttempts,
                    delayMs: Math.min(10000, Math.round(delayMs * 1.7)),
                });
            }).catch((e) => {
                console.error("[task-horizon] task main runtime recovery failed", e);
                this.scheduleTaskMainRuntimeRecovery(reason, {
                    attempt: attempt + 1,
                    maxAttempts,
                    delayMs: Math.min(10000, Math.round(delayMs * 1.7)),
                });
            });
        }, delayMs);
        return true;
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
                notifyTaskHorizonHostLifecycle("tab-init", this.element);
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
        if (!hasTaskMainRuntime()) {
            this.scheduleTaskMainRuntimeRecovery("open-tab", { delayMs: 120 });
        }
        if (this.focusExistingTaskHorizonTab()) {
            Promise.resolve().then(() => this.remountBestTaskHorizonTab()).catch(() => null);
            return;
        }
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

    focusExistingTaskHorizonTab() {
        const clickElement = (el) => {
            if (!(el instanceof HTMLElement)) return false;
            try {
                el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
                return true;
            } catch (e) {
                try {
                    el.click();
                    return true;
                } catch (e2) {
                    return false;
                }
            }
        };
        try {
            const opened = typeof this.getOpenedTab === "function" ? this.getOpenedTab() : null;
            const customs = [];
            if (opened && typeof opened === "object") {
                Object.values(opened).forEach((arr) => {
                    if (Array.isArray(arr)) arr.forEach((item) => customs.push(item));
                });
            }
            for (const custom of customs) {
                const type = String(custom?.type || "").trim();
                const tabId = String(custom?.tab?.id || custom?.id || "").trim();
                if (type === PLUGIN_ID + TAB_TYPE || type === TAB_TYPE || tabId === CUSTOM_TAB_ID) {
                    const head = custom?.tab?.headElement || custom?.headElement || null;
                    if (clickElement(head)) return true;
                }
            }
        } catch (e) {}
        try {
            const selector = `.layout-tab-bar [data-id="${CUSTOM_TAB_ID}"], .layout-tab-bar [data-key="${CUSTOM_TAB_ID}"]`;
            const header = document.querySelector(selector);
            if (clickElement(header)) return true;
        } catch (e) {}
        return false;
    }

    openFromWindowTopBar() {
        try {
            if (typeof globalThis.__taskHorizonOpenManagerFromTopbarEntry === "function") {
                const result = globalThis.__taskHorizonOpenManagerFromTopbarEntry();
                if (result !== false) return result;
            }
        } catch (e) {}
        return this.openTaskHorizonTab();
    }

    getWindowTopBarLookupSelector() {
        return `[${WINDOW_TOPBAR_ATTR}="1"], [aria-label="${TAB_TITLE}"], [title="${TAB_TITLE}"]`;
    }

    windowTopBarElementHasTaskIcon(element) {
        if (!(element instanceof HTMLElement)) return false;
        try {
            if (element.querySelector?.(`use[href="#${ICON_ID}"]`)) return true;
        } catch (e) {}
        try {
            return String(element.innerHTML || "").includes(ICON_ID);
        } catch (e) {}
        return false;
    }

    isWindowTopBarElement(element) {
        if (!(element instanceof HTMLElement)) return false;
        if (element === this._taskWindowTopBarElement) return true;
        try {
            if (element.getAttribute(WINDOW_TOPBAR_ATTR) === "1") {
                return this.windowTopBarElementHasTaskIcon(element);
            }
        } catch (e) {}
        const label = String(element.getAttribute("aria-label") || element.getAttribute("title") || "").trim();
        if (label !== TAB_TITLE) return false;
        if (element.closest?.(".layout-tab-bar, .layout-tab-bar__item, .layout-tab-container, .tm-modal")) return false;
        return this.windowTopBarElementHasTaskIcon(element);
    }

    findWindowTopBarElements() {
        const entries = [];
        const seen = new Set();
        const push = (element) => {
            if (!(element instanceof HTMLElement) || seen.has(element) || !this.isWindowTopBarElement(element)) return;
            seen.add(element);
            entries.push(element);
        };
        try {
            if (this._taskWindowTopBarElement instanceof HTMLElement && document.contains(this._taskWindowTopBarElement)) {
                push(this._taskWindowTopBarElement);
            }
        } catch (e) {}
        try {
            if (Array.isArray(this.topBarIcons)) {
                this.topBarIcons.forEach((element) => push(element));
            }
        } catch (e) {}
        try {
            Array.from(document.querySelectorAll(this.getWindowTopBarLookupSelector())).forEach((element) => push(element));
        } catch (e) {}
        return entries;
    }

    markWindowTopBarElement(element) {
        if (!(element instanceof HTMLElement)) return null;
        try { element.setAttribute(WINDOW_TOPBAR_ATTR, "1"); } catch (e) {}
        try { if (!element.getAttribute("aria-label")) element.setAttribute("aria-label", TAB_TITLE); } catch (e) {}
        try { if (!element.getAttribute("title")) element.setAttribute("title", TAB_TITLE); } catch (e) {}
        this.applyStableTopBarIdentity(element, WINDOW_TOPBAR_ELEMENT_ID);
        return element;
    }

    removeWindowTopBarElement(element) {
        if (!(element instanceof HTMLElement)) return;
        try {
            if (Array.isArray(this.topBarIcons)) {
                let idx = this.topBarIcons.indexOf(element);
                while (idx >= 0) {
                    this.topBarIcons.splice(idx, 1);
                    idx = this.topBarIcons.indexOf(element);
                }
            }
        } catch (e) {}
        try { element.remove(); } catch (e) {}
    }

    reconcileWindowTopBarElements(removeDuplicates = true) {
        const entries = this.findWindowTopBarElements();
        const keeper = entries.includes(this._taskWindowTopBarElement)
            ? this._taskWindowTopBarElement
            : (entries[0] || null);
        if (keeper instanceof HTMLElement) {
            this.markWindowTopBarElement(keeper);
        }
        if (removeDuplicates) {
            entries.forEach((element) => {
                if (element !== keeper) this.removeWindowTopBarElement(element);
            });
        }
        this._taskWindowTopBarElement = keeper instanceof HTMLElement ? keeper : null;
        return this._taskWindowTopBarElement;
    }

    syncWindowTopBar() {
        try { globalThis.__taskHorizonSyncWindowTopBar = this.syncWindowTopBar.bind(this); } catch (e) {}
        if (this.isRuntimeMobileClient()) {
            this.removeWindowTopBar();
            return false;
        }
        if (!readWindowTopbarEnabled()) {
            this.removeWindowTopBar();
            return false;
        }
        if (!this._taskWindowTopBarLayoutReady) {
            return false;
        }
        return this.ensureWindowTopBar();
    }

    ensureWindowTopBar() {
        if (typeof this.addTopBar !== "function") return false;
        const existing = this.reconcileWindowTopBarElements(true);
        if (existing instanceof HTMLElement && document.contains(existing)) {
            return true;
        }
        try {
            this._taskWindowTopBarElement = this.addTopBar({
                icon: ICON_ID,
                title: TAB_TITLE,
                position: "right",
                callback: () => {
                    try { this.openFromWindowTopBar(); } catch (e) {}
                },
            }) || null;
            this.markWindowTopBarElement(this._taskWindowTopBarElement);
            const reconciled = this.reconcileWindowTopBarElements(true);
            return reconciled instanceof HTMLElement && document.contains(reconciled);
        } catch (e) {
            this._taskWindowTopBarElement = null;
            return false;
        }
    }

    removeWindowTopBar() {
        try {
            const entries = this.findWindowTopBarElements();
            if (this._taskWindowTopBarElement instanceof HTMLElement && !entries.includes(this._taskWindowTopBarElement)) {
                entries.push(this._taskWindowTopBarElement);
            }
            entries.forEach((element) => this.removeWindowTopBarElement(element));
        } catch (e) {}
        this._taskWindowTopBarElement = null;
    }

    isCalendarSubscriptionTopBarElement(element) {
        if (!(element instanceof HTMLElement)) return false;
        if (element === this._taskCalendarSubscriptionTopBarElement) return true;
        if (element.getAttribute(CALENDAR_SUBSCRIPTION_TOPBAR_ATTR) === "1") return true;
        try {
            return !!element.querySelector?.(`use[href="#${CALENDAR_SUBSCRIPTION_TOPBAR_ICON_ID}"]`);
        } catch (e) {
            return false;
        }
    }

    findCalendarSubscriptionTopBarElements() {
        const entries = [];
        const seen = new Set();
        const push = (element) => {
            if (!(element instanceof HTMLElement) || seen.has(element) || !this.isCalendarSubscriptionTopBarElement(element)) return;
            seen.add(element);
            entries.push(element);
        };
        push(this._taskCalendarSubscriptionTopBarElement);
        try {
            if (Array.isArray(this.topBarIcons)) this.topBarIcons.forEach(push);
        } catch (e) {}
        try {
            document.querySelectorAll(`[${CALENDAR_SUBSCRIPTION_TOPBAR_ATTR}="1"]`).forEach(push);
        } catch (e) {}
        return entries;
    }

    markCalendarSubscriptionTopBarElement(element) {
        if (!(element instanceof HTMLElement)) return null;
        const meta = this._taskCalendarSubscriptionTopBarMeta || {};
        const title = String(meta.title || "立即上传日历 ICS");
        try { element.setAttribute(CALENDAR_SUBSCRIPTION_TOPBAR_ATTR, "1"); } catch (e) {}
        try { element.setAttribute("title", title); } catch (e) {}
        try { element.setAttribute("aria-label", title); } catch (e) {}
        try { element.setAttribute("aria-busy", meta.running === true ? "true" : "false"); } catch (e) {}
        try { element.classList.toggle("tm-calendar-subscription-topbar--running", meta.running === true); } catch (e) {}
        try { if ("disabled" in element) element.disabled = meta.running === true; } catch (e) {}
        this.applyStableTopBarIdentity(element, CALENDAR_SUBSCRIPTION_TOPBAR_ELEMENT_ID);
        return element;
    }

    removeCalendarSubscriptionTopBar() {
        try {
            const entries = this.findCalendarSubscriptionTopBarElements();
            if (this._taskCalendarSubscriptionTopBarElement instanceof HTMLElement && !entries.includes(this._taskCalendarSubscriptionTopBarElement)) {
                entries.push(this._taskCalendarSubscriptionTopBarElement);
            }
            entries.forEach((element) => this.removeWindowTopBarElement(element));
        } catch (e) {}
        this._taskCalendarSubscriptionTopBarElement = null;
    }

    ensureCalendarSubscriptionTopBar() {
        if (typeof this.addTopBar !== "function") return false;
        const entries = this.findCalendarSubscriptionTopBarElements();
        const keeper = entries.includes(this._taskCalendarSubscriptionTopBarElement)
            ? this._taskCalendarSubscriptionTopBarElement
            : (entries[0] || null);
        entries.forEach((element) => {
            if (element !== keeper) this.removeWindowTopBarElement(element);
        });
        if (keeper instanceof HTMLElement && document.contains(keeper)) {
            this._taskCalendarSubscriptionTopBarElement = keeper;
            this.markCalendarSubscriptionTopBarElement(keeper);
            return true;
        }
        try {
            this._taskCalendarSubscriptionTopBarElement = this.addTopBar({
                icon: CALENDAR_SUBSCRIPTION_TOPBAR_ICON_ID,
                title: String(this._taskCalendarSubscriptionTopBarMeta?.title || "立即上传日历 ICS"),
                position: "right",
                callback: () => {
                    if (this._taskCalendarSubscriptionTopBarMeta?.running === true) return;
                    const publisher = globalThis.__tmCalendarSubscription;
                    if (typeof publisher?.publishNow !== "function") return;
                    void publisher.publishNow({ source: "topbar", force: true, interactive: true });
                },
            }) || null;
            this.markCalendarSubscriptionTopBarElement(this._taskCalendarSubscriptionTopBarElement);
            return this._taskCalendarSubscriptionTopBarElement instanceof HTMLElement
                && document.contains(this._taskCalendarSubscriptionTopBarElement);
        } catch (e) {
            this._taskCalendarSubscriptionTopBarElement = null;
            return false;
        }
    }

    syncCalendarSubscriptionTopBar(meta) {
        try { globalThis.__taskHorizonSyncCalendarSubscriptionTopBar = this.syncCalendarSubscriptionTopBar.bind(this); } catch (e) {}
        if (meta && typeof meta === "object") {
            this._taskCalendarSubscriptionTopBarMeta = {
                ...(this._taskCalendarSubscriptionTopBarMeta || {}),
                ...meta,
            };
        }
        const current = this._taskCalendarSubscriptionTopBarMeta || {};
        if (!this._taskWindowTopBarLayoutReady
            || current.enabled !== true) {
            this.removeCalendarSubscriptionTopBar();
            return false;
        }
        return this.ensureCalendarSubscriptionTopBar();
    }

    async openQuickAddTaskWindow() {
        const openQuickAdd = typeof globalThis.tmQuickAddOpen === "function" ? globalThis.tmQuickAddOpen : null;
        if (!openQuickAdd) {
            console.warn("[task-horizon] quick add command skipped: tmQuickAddOpen is unavailable");
            return false;
        }
        try {
            await openQuickAdd();
            return true;
        } catch (e) {
            console.error("[task-horizon] quick add command failed", e);
            return false;
        }
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
                notifyTaskHorizonHostLifecycle("dock-init", this.element || null);
                const mounted = plugin.mountTaskDockElement(this.element || null);
                if (!mounted) {
                    plugin.scheduleTaskDockRecovery("dock-init", { element: this.element || null });
                }
                setTimeout(() => plugin.syncTaskDockVisibility(), 0);
            },
            update() {
                plugin._taskDockElement = this.element || null;
                plugin._taskDockOpen = true;
                notifyTaskHorizonHostLifecycle("dock-update", this.element || null);
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
                notifyTaskHorizonHostLifecycle("dock-destroy", this.element || null);
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
            this.scheduleTaskMainRuntimeRecovery(String(options?.reason || "mount-waiting"), { delayMs: 180 });
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
        this._taskDataChangedQueued = false;
        try { this.destroyEntryIconRuntime(); } catch (e) {}
        try {
            this._mountExistingTabsStopped = true;
            if (this._mountExistingTabsTimer) {
                clearTimeout(this._mountExistingTabsTimer);
                this._mountExistingTabsTimer = null;
            }
        } catch (e) {}
        try { this.cancelTaskMainRuntimeRecovery(); } catch (e) {}
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
        try { this.removeCalendarSubscriptionTopBar(); } catch (e) {}
        try { this.removeWindowTopBar(); } catch (e) {}
        try { this.destroyTaskDockFrame(); } catch (e) {}
        try { globalThis.__TaskManagerCleanup?.(); } catch (e) {}
        try { globalThis.__taskHorizonAiCleanup?.(); } catch (e) {}
        try { globalThis.__taskHorizonQuickbarCleanup?.(); } catch (e) {}
        try { globalThis.__tmLicenseCleanup?.(); } catch (e) {}
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
        try { delete globalThis.__taskHorizonFrontend; } catch (e) {}
        try { delete globalThis.__taskHorizonRuntimeClientKind; } catch (e) {}
        try { delete globalThis.__taskHorizonOpenTab; } catch (e) {}
        try { delete globalThis.__taskHorizonProtyle; } catch (e) {}
        try { delete globalThis.__taskHorizonOpenMobileFileById; } catch (e) {}
        try { delete globalThis.__taskHorizonPlatformUtils; } catch (e) {}
        try { delete globalThis.__taskHorizonOpenAssetWithSystem; } catch (e) {}
        try { delete globalThis.__taskHorizonHostBridge; } catch (e) {}
        try { delete globalThis.__taskHorizonOpenTabView; } catch (e) {}
        try { delete globalThis.__taskHorizonSyncWindowTopBar; } catch (e) {}
        try { delete globalThis.__taskHorizonSyncCalendarSubscriptionTopBar; } catch (e) {}
        try { delete globalThis.__taskHorizonApplyWindowTopBarIdentity; } catch (e) {}
        try { delete globalThis.__taskHorizonCustomTabId; } catch (e) {}
        try { delete globalThis.__taskHorizonTabElement; } catch (e) {}
        try { delete globalThis.__taskHorizonQuickbarLoaded; } catch (e) {}
        try { delete globalThis.__taskHorizonQuickbarToggle; } catch (e) {}
        try { delete globalThis.__taskHorizonQuickbarCleanup; } catch (e) {}
        try { delete globalThis.__taskHorizonExplicitWindowExportKeys; } catch (e) {}
        try { delete globalThis.__taskHorizonAiCleanup; } catch (e) {}
        try { delete globalThis.__taskHorizonEnsureAiModuleLoaded; } catch (e) {}
        try { delete globalThis.__taskHorizonGetAiExperienceMode; } catch (e) {}
        try { delete globalThis.__taskHorizonSetAiExperienceMode; } catch (e) {}
        try { delete globalThis.__taskHorizonAgentActionDescriptors; } catch (e) {}
        try { delete globalThis.__taskHorizonInvokeAgentAction; } catch (e) {}
        try { delete globalThis.__taskHorizonEnsureXlsxModuleLoaded; } catch (e) {}
        try { delete globalThis.__taskHorizonMount; } catch (e) {}
        try { delete globalThis.__TaskManagerCleanup; } catch (e) {}
        try { delete globalThis.__taskHorizonMountToken; } catch (e) {}
        try { delete globalThis.__taskHorizonTabType; } catch (e) {}
        try { delete globalThis.__tmHost; } catch (e) {}
        try { delete globalThis.__tmCompat; } catch (e) {}
        try { delete globalThis.__tmCaps; } catch (e) {}
        try { delete globalThis.__tmLicenseCleanup; } catch (e) {}
        try { delete globalThis.__tmRuntimeHost; } catch (e) {}
        try { delete globalThis.__tmViewPolicy; } catch (e) {}
        try { delete globalThis.__tmRuntimeState; } catch (e) {}
        try { delete globalThis.__tmRuntimeEvents; } catch (e) {}
    }

    async uninstall() {
        try { globalThis.__TaskManagerCleanup?.(); } catch (e) {}
        try { globalThis.__taskHorizonAiCleanup?.(); } catch (e) {}
        try { globalThis.__taskHorizonQuickbarCleanup?.(); } catch (e) {}

        try { await removeUnmodifiedAgentSkills(this); } catch (e) {}

        try {
            const ns = globalThis["siyuan-plugin-task-horizon"];
            if (ns && typeof ns.uninstallCleanup === "function") {
                await ns.uninstallCleanup();
            }
        } catch (e) {}

        try {
            const paths = [
                "/data/storage/petal/siyuan-plugin-task-horizon/task-meta.json",
                "/data/storage/petal/siyuan-plugin-task-horizon/task-snapshot.json",
                "/data/storage/petal/siyuan-plugin-task-horizon/diagnostic-logs.json",
                "/data/storage/petal/siyuan-plugin-task-horizon/ai-conversations.json",
                "/data/storage/petal/siyuan-plugin-task-horizon/ai-debug.json",
                "/data/storage/petal/siyuan-plugin-task-horizon/ai-prompt-templates.json",
                "/data/storage/petal/siyuan-plugin-task-horizon/agent-workbench.json",
                "/data/storage/petal/siyuan-plugin-task-horizon/agent-mcp-config.json",
                "/data/storage/petal/siyuan-plugin-task-horizon/ai-policy-config.json",
                "/data/storage/petal/siyuan-plugin-task-horizon/agent-scheduled-events.json",
            ];
            await Promise.all(paths.map((path) => fetch("/api/file/removeFile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path }),
            }).catch(() => null)));
        } catch (e) {}
    }
};
