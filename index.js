const { Plugin, openTab, openMobileFileById, platformUtils } = require("siyuan");

const PLUGIN_ID = "siyuan-plugin-task-horizon";
const TASK_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/task.js`;
const AI_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/ai.js`;
const QUICKBAR_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/quickbar.js`;
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
const TASK_DOCK_FRAME_ATTR = "data-task-horizon-dock-frame";
const TASK_DOCK_THEME_STYLE_ID = "tm-task-horizon-dock-theme";
const TASK_DOCK_MIRROR_ATTR = "data-task-horizon-dock-mirror";
const DOCK_VIEW_IDS = new Set(["list", "checklist", "timeline", "kanban", "calendar", "whiteboard"]);

const ICON_SYMBOL = `<symbol id="${ICON_ID}" viewBox="0 0 24 24">
  <g transform="translate(12 12) scale(1.25) translate(-12 -12)" fill="none" stroke="currentColor">
    <path d="M7.25 3.75h9.5c1.105 0 2 .895 2 2v12.5c0 1.105-.895 2-2 2h-9.5c-1.105 0-2-.895-2-2V5.75c0-1.105.895-2 2-2Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M8.75 7h6.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M8.75 10.5h6.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M8.75 14h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M12.1 17.6l1.55 1.55 3.2-3.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
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
    const ua = navigator.userAgent || "";
    return /Mobile|Android|iPhone|iPad|iPod/i.test(ua);
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

const loadScriptTextIntoDocument = async (targetDoc, path, sourceName) => {
    try {
        const raw = await fetchText("/api/file/getFile", { path });
        const code = unwrapGetFileText(raw);
        if (!code || !code.trim()) throw new Error("empty script");

        const script = targetDoc.createElement("script");
        script.textContent = code + `\n//# sourceURL=${sourceName}`;
        targetDoc.head.appendChild(script);
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

const loadStyleTextIntoDocument = async (targetDoc, path, sourceName) => {
    try {
        const raw = await fetchText("/api/file/getFile", { path });
        const css = unwrapGetFileText(raw);
        if (!css || !css.trim()) throw new Error("empty style");
        const style = targetDoc.createElement("style");
        style.textContent = css + `\n/*# sourceURL=${sourceName} */`;
        style.dataset.tmStyleSource = sourceName || "";
        targetDoc.head.appendChild(style);
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

const loadScriptText = async (path, sourceName) => loadScriptTextIntoDocument(document, path, sourceName);

const loadStyleText = async (path, sourceName) => loadStyleTextIntoDocument(document, path, sourceName);

const collectFontFaceCss = () => {
    const chunks = [];
    const visited = new Set();
    const walkRules = (rules) => {
        if (!rules) return;
        for (const rule of Array.from(rules)) {
            if (!rule) continue;
            try {
                if (typeof CSSFontFaceRule !== "undefined" && rule instanceof CSSFontFaceRule) {
                    chunks.push(rule.cssText);
                    continue;
                }
            } catch (e) {}
            const text = String(rule.cssText || "");
            if (text.includes("@font-face")) {
                chunks.push(text);
                continue;
            }
            const nested = rule.cssRules || rule.styleSheet?.cssRules || null;
            if (nested) walkRules(nested);
        }
    };
    try {
        for (const sheet of Array.from(document.styleSheets || [])) {
            if (!sheet || visited.has(sheet)) continue;
            visited.add(sheet);
            try {
                walkRules(sheet.cssRules || []);
            } catch (e) {}
        }
    } catch (e) {}
    return chunks.join("\n");
};

const shouldMirrorTaskDockHeadNode = (node) => {
    if (!(node instanceof Element)) return false;
    const tag = String(node.tagName || "").toUpperCase();
    if (tag === "STYLE") {
        if (node.id === TASK_DOCK_THEME_STYLE_ID) return false;
        if (node.getAttribute(TASK_DOCK_MIRROR_ATTR) === "1") return false;
        if (node.dataset?.tmTaskHorizonStyle === "1") return false;
        if (node.dataset?.tmStyleSource) return false;
        if (node.id === "sy-custom-props-floatbar-style") return false;
        return true;
    }
    if (tag === "LINK") {
        const rel = String(node.getAttribute("rel") || "").toLowerCase();
        return rel.includes("stylesheet");
    }
    return false;
};

const cloneTaskDockHeadNode = (node, targetDoc) => {
    if (!(node instanceof Element) || !targetDoc) return null;
    const tag = String(node.tagName || "").toUpperCase();
    if (tag === "STYLE") {
        const clone = targetDoc.createElement("style");
        clone.textContent = node.textContent || "";
        clone.setAttribute(TASK_DOCK_MIRROR_ATTR, "1");
        return clone;
    }
    if (tag === "LINK") {
        const clone = targetDoc.createElement("link");
        for (const attr of Array.from(node.attributes || [])) {
            if (!attr?.name) continue;
            clone.setAttribute(attr.name, attr.value);
        }
        clone.setAttribute(TASK_DOCK_MIRROR_ATTR, "1");
        return clone;
    }
    return null;
};

const syncTaskDockHeadStyles = (targetDoc, anchor) => {
    if (!targetDoc?.head) return;
    try {
        targetDoc.head.querySelectorAll(`[${TASK_DOCK_MIRROR_ATTR}="1"]`).forEach((el) => {
            try { el.remove(); } catch (e) {}
        });
    } catch (e) {}
    const frag = targetDoc.createDocumentFragment();
    try {
        Array.from(document.head?.children || []).forEach((node) => {
            if (!shouldMirrorTaskDockHeadNode(node)) return;
            const clone = cloneTaskDockHeadNode(node, targetDoc);
            if (clone) frag.appendChild(clone);
        });
    } catch (e) {}
    try {
        targetDoc.head.insertBefore(frag, anchor || null);
    } catch (e) {
        try { targetDoc.head.appendChild(frag); } catch (e2) {}
    }
};

const isVisibleDockTypographySource = (el) => {
    if (!(el instanceof Element)) return false;
    try {
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    } catch (e) {
        return false;
    }
};

const pickTaskDockTypographySource = () => {
    const fromRoot = (root) => {
        if (!(root instanceof Element)) return null;
        const selectors = [
            '.protyle-wysiwyg [contenteditable="true"][spellcheck="false"]',
            '.protyle-wysiwyg [contenteditable="true"]',
            '.protyle-content [contenteditable="true"][spellcheck="false"]',
            '.protyle-content [contenteditable="true"]',
            '.protyle-title__input',
        ];
        for (const selector of selectors) {
            try {
                const nodes = Array.from(root.querySelectorAll(selector));
                const hit = nodes.find(isVisibleDockTypographySource);
                if (hit) return hit;
            } catch (e) {}
        }
        return null;
    };

    try {
        const active = document.activeElement;
        if (active instanceof Element) {
            const activeEditable = active.matches?.('[contenteditable="true"]') ? active : null;
            if (isVisibleDockTypographySource(activeEditable) && activeEditable.closest?.(".protyle")) {
                return activeEditable;
            }
            const fromActiveProtyle = fromRoot(active.closest?.(".protyle"));
            if (fromActiveProtyle) return fromActiveProtyle;
        }
    } catch (e) {}

    const roots = [
        ...Array.from(document.querySelectorAll(".protyle--focus")),
        ...Array.from(document.querySelectorAll(".layout-tab-container .protyle")),
        ...Array.from(document.querySelectorAll(".protyle")),
    ];
    for (const root of roots) {
        const hit = fromRoot(root);
        if (hit) return hit;
    }

    try {
        const fallback = Array.from(document.querySelectorAll('div[contenteditable="true"][spellcheck="false"]'))
            .find((el) => isVisibleDockTypographySource(el) && el.closest?.(".protyle"));
        if (fallback) return fallback;
    } catch (e) {}

    return null;
};

const readTaskDockTypography = () => {
    const source = pickTaskDockTypographySource() || document.body || document.documentElement;
    try {
        const computed = getComputedStyle(source);
        return {
            family: String(computed.fontFamily || "").trim() || `"Segoe UI", sans-serif`,
            size: String(computed.fontSize || "").trim() || "14px",
            weight: String(computed.fontWeight || "").trim() || "400",
            style: String(computed.fontStyle || "").trim() || "normal",
            lineHeight: String(computed.lineHeight || "").trim() || "1.5",
            letterSpacing: String(computed.letterSpacing || "").trim() || "normal",
            featureSettings: String(computed.fontFeatureSettings || "").trim() || "normal",
            variantNumeric: String(computed.fontVariantNumeric || "").trim() || "normal",
            variationSettings: String(computed.fontVariationSettings || "").trim() || "normal",
            textShadow: String(computed.textShadow || "").trim() || "none",
            textRendering: String(computed.textRendering || computed.getPropertyValue("text-rendering") || "").trim() || "auto",
            fontSmoothing: String(computed.getPropertyValue("-webkit-font-smoothing") || "").trim() || "auto",
            textStrokeWidth: String(computed.getPropertyValue("-webkit-text-stroke-width") || "").trim() || "0px",
            textStrokeColor: String(computed.getPropertyValue("-webkit-text-stroke-color") || "").trim() || "currentColor",
        };
    } catch (e) {
        return {
            family: `"Segoe UI", sans-serif`,
            size: "14px",
            weight: "400",
            style: "normal",
            lineHeight: "1.5",
            letterSpacing: "normal",
            featureSettings: "normal",
            variantNumeric: "normal",
            variationSettings: "normal",
            textShadow: "none",
            textRendering: "auto",
            fontSmoothing: "auto",
            textStrokeWidth: "0px",
            textStrokeColor: "currentColor",
        };
    }
};

module.exports = class TaskHorizonPlugin extends Plugin {
    isRuntimeMobileClient() {
        return isRuntimeMobileClient(this);
    }

    async onload() {
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
        try { this.addIcons(ICON_SYMBOL); } catch (e) {}
        this.ensureCustomTab();
        this.initTaskDock();
        this.suppressTaskDockOnMobile();
        try {
            document.querySelectorAll('style[data-tm-style-source="calendar-view.css"]').forEach((el) => { try { el.remove(); } catch (e) {} });
        } catch (e) {}
        try {
            globalThis.__tmCalendar?.cleanup?.();
        } catch (e) {}
        try {
            delete globalThis.__tmCalendar;
        } catch (e) {}
        await loadScriptText(BASECOAT_SCRIPT_PATH, "basecoat/basecoat.js");
        await loadScriptText(TASK_SCRIPT_PATH, "task.js");
        await loadScriptText(AI_SCRIPT_PATH, "ai.js");
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
        this.addTab({
            type,
            init() {
                // Use function syntax to preserve `this` as the tab instance
                this.element.classList.add("tm-tab-root");
                this.element.style.display = "flex";
                this.element.style.flexDirection = "column";
                this.element.style.height = "100%";
                globalThis.__taskHorizonTabElement = this.element;
                if (typeof globalThis.__taskHorizonMount === "function") {
                    globalThis.__taskHorizonMount(this.element);
                }
            },
        });
        this._tabRegistered = true;
    }

    mountExistingTabs() {
        if (this.isRuntimeMobileClient()) return;
        let tries = 0;
        const run = () => {
            if (this._mountExistingTabsStopped) return;
            tries += 1;
            const mountFn = globalThis.__taskHorizonMount;
            const roots = Array.from(document.querySelectorAll(".tm-tab-root"));
            const token = String(globalThis.__taskHorizonMountToken || this._mountToken || "");
            if (typeof mountFn === "function") {
                roots.forEach((el) => {
                    if (!el) return;
                    if (token && el.dataset?.tmTaskHorizonMounted === token) return;
                    try {
                        globalThis.__taskHorizonTabElement = el;
                        mountFn(el);
                        if (token) el.dataset.tmTaskHorizonMounted = token;
                    } catch (e) {}
                });
                return;
            }
            if (tries < 50) this._mountExistingTabsTimer = setTimeout(run, 200);
        };
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
        const sync = () => {
            if (!this.isRuntimeMobileClient()) return;
            try { this.destroyTaskDockFrame(); } catch (e) {}
            try { this.syncTaskDockVisibility(); } catch (e) {}
        };
        sync();
        [80, 300, 1200].forEach((delay) => {
            try { setTimeout(sync, delay); } catch (e) {}
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
        this._taskDockMountSeq = Number(this._taskDockMountSeq || 0) + 1;
        try {
            if (host instanceof HTMLElement) host.replaceChildren();
        } catch (e) {}
        this._taskDockFrame = null;
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

    syncTaskDockTheme(frame = this._taskDockFrame) {
        const target = frame instanceof HTMLIFrameElement ? frame : null;
        const doc = target?.contentDocument;
        if (!doc) return;
        let cssVars = "";
        let effectiveFontSize = "";
        let effectiveFontWeight = "";
        let effectiveFontStyle = "";
        let effectiveLineHeight = "";
        let effectiveLetterSpacing = "";
        let effectiveFontFeatureSettings = "";
        let effectiveFontVariantNumeric = "";
        let effectiveFontVariationSettings = "";
        let fontFaceCss = "";
        try {
            const computed = getComputedStyle(document.documentElement);
            for (let i = 0; i < computed.length; i += 1) {
                const name = computed[i];
                if (!name || !name.startsWith("--")) continue;
                const value = computed.getPropertyValue(name);
                if (!value) continue;
                cssVars += `${name}:${value};`;
            }
        } catch (e) {}
        try {
            const typography = readTaskDockTypography();
            effectiveFontSize = typography.size;
            effectiveFontWeight = typography.weight;
            effectiveFontStyle = typography.style;
            effectiveLineHeight = typography.lineHeight;
            effectiveLetterSpacing = typography.letterSpacing;
            effectiveFontFeatureSettings = typography.featureSettings;
            effectiveFontVariantNumeric = typography.variantNumeric;
            effectiveFontVariationSettings = typography.variationSettings;
        } catch (e) {}
        try {
            fontFaceCss = collectFontFaceCss();
        } catch (e) {}
        const themeMode = String(document.documentElement.getAttribute("data-theme-mode") || "").trim();
        try {
            if (themeMode) doc.documentElement.setAttribute("data-theme-mode", themeMode);
            else doc.documentElement.removeAttribute("data-theme-mode");
        } catch (e) {}
        let styleEl = doc.getElementById(TASK_DOCK_THEME_STYLE_ID);
        if (!styleEl) {
            styleEl = doc.createElement("style");
            styleEl.id = TASK_DOCK_THEME_STYLE_ID;
            doc.head.appendChild(styleEl);
        }
        syncTaskDockHeadStyles(doc, styleEl);
        styleEl.textContent = `
${fontFaceCss}
:root{${cssVars}${effectiveFontSize ? `--tm-host-font-size:${effectiveFontSize};--tm-font-size:${effectiveFontSize};` : ""}${effectiveFontWeight ? `--tm-host-font-weight:${effectiveFontWeight};` : ""}${effectiveFontStyle ? `--tm-host-font-style:${effectiveFontStyle};` : ""}${effectiveLineHeight ? `--tm-host-line-height:${effectiveLineHeight};` : ""}${effectiveLetterSpacing ? `--tm-host-letter-spacing:${effectiveLetterSpacing};` : ""}${effectiveFontFeatureSettings ? `--tm-host-font-feature-settings:${effectiveFontFeatureSettings};` : ""}${effectiveFontVariantNumeric ? `--tm-host-font-variant-numeric:${effectiveFontVariantNumeric};` : ""}${effectiveFontVariationSettings ? `--tm-host-font-variation-settings:${effectiveFontVariationSettings};` : ""}}
html,body{margin:0;width:100%;height:100%;min-width:0;min-height:0;overflow:hidden;background:var(--b3-theme-background, #fff);color:var(--b3-theme-on-background, #222);font-family:var(--b3-font-family-protyle, var(--b3-font-family, "Segoe UI", sans-serif));${effectiveFontSize ? `font-size:var(--tm-host-font-size, ${effectiveFontSize});` : ""}${effectiveFontWeight ? `font-weight:var(--tm-host-font-weight, ${effectiveFontWeight});` : ""}${effectiveFontStyle ? `font-style:var(--tm-host-font-style, ${effectiveFontStyle});` : ""}${effectiveLineHeight ? `line-height:var(--tm-host-line-height, ${effectiveLineHeight});` : ""}${effectiveLetterSpacing ? `letter-spacing:var(--tm-host-letter-spacing, ${effectiveLetterSpacing});` : ""}${effectiveFontFeatureSettings ? `font-feature-settings:var(--tm-host-font-feature-settings, ${effectiveFontFeatureSettings});` : ""}${effectiveFontVariantNumeric ? `font-variant-numeric:var(--tm-host-font-variant-numeric, ${effectiveFontVariantNumeric});` : ""}${effectiveFontVariationSettings ? `font-variation-settings:var(--tm-host-font-variation-settings, ${effectiveFontVariationSettings});` : ""}}
body{box-sizing:border-box;}
*,*::before,*::after{box-sizing:inherit;}
button,input,select,textarea{font:inherit;}
.b3-select,.b3-text-field{height:36px;min-height:36px;border-radius:10px;border:1px solid var(--b3-theme-surface-light, #d7dce3);background:var(--b3-theme-surface, #fff);color:var(--b3-theme-on-background, #222);padding:0 12px;}
.b3-switch{accent-color:var(--b3-theme-primary, #4285f4);}
        `;
        try { doc.head.appendChild(styleEl); } catch (e) {}
    }

    async prepareTaskDockFrame(frame, seq) {
        const doc = frame.contentDocument;
        const win = frame.contentWindow;
        if (!doc || !win) throw new Error("dock iframe not ready");

        doc.open();
        doc.write("<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"></head><body data-tm-host-mode=\"dock\" data-tm-ui-mode=\"mobile\"></body></html>");
        doc.close();

        win.siyuan = window.siyuan;
        win.openTab = typeof openTab === "function" ? openTab : null;
        win.openMobileFileById = typeof openMobileFileById === "function" ? openMobileFileById : null;
        win.__taskHorizonPluginApp = this.app;
        win.__taskHorizonPluginInstance = this;
        win.__taskHorizonPluginIsMobile = false;
        win.__taskHorizonOpenTab = typeof openTab === "function" ? openTab : null;
        win.__taskHorizonOpenMobileFileById = typeof openMobileFileById === "function" ? openMobileFileById : null;
        win.__taskHorizonPlatformUtils = platformUtils || null;
        win.__taskHorizonHostMode = "dock";
        win.__taskHorizonHostUiMode = "mobile";
        win.__taskHorizonForceMobileUI = true;
        win.__taskHorizonDockBridge = {
            close: () => this.closeTaskDockPanel(),
            reopen: () => this.reloadTaskDockFrame(),
        };

        [
            "__dockTomato",
            "__dockTomatoFocusModeEnabled",
            "__tomatoReminder",
            "__tomatoTimer",
            "__tomatoPlatformUtils",
            "__taskHorizonPluginApp",
            "__taskHorizonPluginInstance",
            "__taskHorizonOpenTab",
            "__taskHorizonOpenMobileFileById",
            "__taskHorizonPlatformUtils",
        ].forEach((key) => {
            try {
                if (globalThis[key] !== undefined) win[key] = globalThis[key];
            } catch (e) {}
        });

        this.syncTaskDockTheme(frame);

        await loadScriptTextIntoDocument(doc, BASECOAT_SCRIPT_PATH, "basecoat/basecoat.js");
        await loadScriptTextIntoDocument(doc, TASK_SCRIPT_PATH, "task.js");
        await loadScriptTextIntoDocument(doc, AI_SCRIPT_PATH, "ai.js");
        await loadStyleTextIntoDocument(doc, BASECOAT_CSS_PATH, "basecoat/basecoat.css");
        await loadScriptTextIntoDocument(doc, FULLCALENDAR_MIN_SCRIPT_PATH, "fullcalendar/index.global.min.js");
        await loadScriptTextIntoDocument(doc, FULLCALENDAR_ZH_LOCALE_SCRIPT_PATH, "fullcalendar/locales/zh-cn.global.min.js");
        await loadScriptTextIntoDocument(doc, CALENDAR_VIEW_SCRIPT_PATH, "calendar-view.js");
        await loadStyleTextIntoDocument(doc, CALENDAR_VIEW_CSS_PATH, "calendar-view.css");
        if (this._taskDockMountSeq !== seq) return;

        const root = doc.createElement("div");
        root.id = "tmTaskHorizonDockRoot";
        root.dataset.tmHostMode = "dock";
        root.dataset.tmUiMode = "mobile";
        root.style.width = "100%";
        root.style.height = "100%";
        root.style.minWidth = "0";
        root.style.minHeight = "0";
        root.style.overflow = "hidden";
        doc.body.appendChild(root);
        if (typeof win.__taskHorizonMount !== "function") {
            throw new Error("dock mount entry is missing");
        }
        win.__taskHorizonMount(root);
    }

    reloadTaskDockFrame() {
        if (!(this._taskDockElement instanceof HTMLElement)) return;
        this.destroyTaskDockFrame(this._taskDockElement);
        this.mountTaskDockElement(this._taskDockElement, { reactivate: true });
    }

    scheduleTaskDockResizeRefresh() {
        return;
    }

    closeTaskDockPanel() {
        this.destroyTaskDockFrame(this._taskDockElement);
        this._taskDockOpen = false;
        try {
            const trigger = document.querySelector(`[data-type="${TASK_DOCK_TYPE}"]`);
            trigger?.dispatchEvent?.(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
        } catch (e) {}
    }

    onunload() {
        try {
            this._mountExistingTabsStopped = true;
            if (this._mountExistingTabsTimer) {
                clearTimeout(this._mountExistingTabsTimer);
                this._mountExistingTabsTimer = null;
            }
        } catch (e) {}
        try {
            if (this._taskDockThemeObserver) {
                this._taskDockThemeObserver.disconnect();
                this._taskDockThemeObserver = null;
            }
        } catch (e) {}
        try {
            if (this._taskDockHeadObserver) {
                this._taskDockHeadObserver.disconnect();
                this._taskDockHeadObserver = null;
            }
        } catch (e) {}
        try {
            if (this._taskDockResizeTimer) {
                clearTimeout(this._taskDockResizeTimer);
                this._taskDockResizeTimer = null;
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
                const s = String(el?.dataset?.tmStyleSource || '');
                if (s === 'calendar-view.css') {
                    try { el.remove(); } catch (e) {}
                }
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
            ];
            await Promise.all(paths.map((path) => fetch("/api/file/removeFile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path }),
            }).catch(() => null)));
        } catch (e) {}
    }
};
