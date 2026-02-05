const { Plugin, openTab, openMobileFileById } = require("siyuan");

const PLUGIN_ID = "siyuan-plugin-task-horizon";
const TASK_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/task.js`;
const QUICKBAR_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/quickbar.js`;
const TAB_TYPE = "task-horizon";
const TAB_TITLE = "任务管理";

const fetchText = async (url, data) => {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data || {}),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
};

const loadScriptText = async (path, sourceName) => {
    try {
        const code = await fetchText("/api/file/getFile", { path });
        if (!code || !code.trim()) throw new Error("empty script");

        const script = document.createElement("script");
        script.textContent = code + `\n//# sourceURL=${sourceName}`;
        document.head.appendChild(script);
        script.remove();

        return true;
    } catch (e) {
        console.error("[task-horizon] load script failed", sourceName, e);
        return false;
    }
};

module.exports = class TaskHorizonPlugin extends Plugin {
    async onload() {
        globalThis.__taskHorizonPluginApp = this.app;
        globalThis.__taskHorizonPluginInstance = this;
        globalThis.__taskHorizonPluginIsMobile = !!this.isMobile;
        globalThis.__taskHorizonOpenTab = typeof openTab === "function" ? openTab : null;
        globalThis.__taskHorizonOpenMobileFileById = typeof openMobileFileById === "function" ? openMobileFileById : null;
        globalThis.__taskHorizonOpenTabView = this.openTaskHorizonTab.bind(this);
        this.ensureCustomTab();
        await loadScriptText(TASK_SCRIPT_PATH, "task.js");
        await loadScriptText(QUICKBAR_SCRIPT_PATH, "quickbar.js");
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
        if (this.isMobile) return;
        let tries = 0;
        const run = () => {
            tries += 1;
            const mountFn = globalThis.__taskHorizonMount;
            const roots = Array.from(document.querySelectorAll(".tm-tab-root"));
            if (typeof mountFn === "function") {
                roots.forEach((el) => {
                    if (!el || el.dataset?.tmTaskHorizonMounted === "1") return;
                    try {
                        globalThis.__taskHorizonTabElement = el;
                        mountFn(el);
                        el.dataset.tmTaskHorizonMounted = "1";
                    } catch (e) {}
                });
                return;
            }
            if (tries < 50) setTimeout(run, 200);
        };
        run();
    }

    openTaskHorizonTab() {
        if (this.isMobile) {
            // Mobile has no tabs; fallback is handled by task.js.
            return;
        }
        this.ensureCustomTab();
        openTab({
            app: this.app,
            custom: {
                title: TAB_TITLE,
                icon: "iconList",
                id: this.name + TAB_TYPE,
            },
        });
    }

    onunload() {
        try { globalThis.__TaskManagerCleanup?.(); } catch (e) {}
        try { globalThis.tmClose?.(); } catch (e) {}

        try { delete globalThis.__taskHorizonPluginApp; } catch (e) {}
        try { delete globalThis.__taskHorizonPluginInstance; } catch (e) {}
        try { delete globalThis.__taskHorizonPluginIsMobile; } catch (e) {}
        try { delete globalThis.__taskHorizonOpenTab; } catch (e) {}
        try { delete globalThis.__taskHorizonOpenMobileFileById; } catch (e) {}
        try { delete globalThis.__taskHorizonOpenTabView; } catch (e) {}
        try { delete globalThis.__taskHorizonTabElement; } catch (e) {}
        try { delete globalThis.__taskHorizonQuickbarLoaded; } catch (e) {}
    }
};
