const { Plugin, openTab, openMobileFileById } = require("siyuan");

const PLUGIN_ID = "siyuan-plugin-task-horizon";
const TASK_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/task.js`;
const QUICKBAR_SCRIPT_PATH = `/data/plugins/${PLUGIN_ID}/quickbar.js`;
const TAB_TYPE = "task-horizon";
const TAB_TITLE = "任务管理器";
const ICON_ID = "iconTaskHorizon";

const ICON_SYMBOL = `<symbol id="${ICON_ID}" viewBox="0 0 24 24">
  <g transform="translate(12 12) scale(1.25) translate(-12 -12)" fill="none" stroke="currentColor">
    <path d="M7.25 3.75h9.5c1.105 0 2 .895 2 2v12.5c0 1.105-.895 2-2 2h-9.5c-1.105 0-2-.895-2-2V5.75c0-1.105.895-2 2-2Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M8.75 7h6.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M8.75 10.5h6.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M8.75 14h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M12.1 17.6l1.55 1.55 3.2-3.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</symbol>`;

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
        globalThis.__taskHorizonCustomTabId = this.name + TAB_TYPE;
        try { this.addIcons(ICON_SYMBOL); } catch (e) {}
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
                icon: ICON_ID,
                id: this.name + TAB_TYPE,
            },
        });
    }

    onunload() {
        try { globalThis.__TaskManagerCleanup?.(); } catch (e) {}
        try { globalThis.__taskHorizonQuickbarCleanup?.(); } catch (e) {}
        try { globalThis.tmClose?.(); } catch (e) {}

        try { delete globalThis.__taskHorizonPluginApp; } catch (e) {}
        try { delete globalThis.__taskHorizonPluginInstance; } catch (e) {}
        try { delete globalThis.__taskHorizonPluginIsMobile; } catch (e) {}
        try { delete globalThis.__taskHorizonOpenTab; } catch (e) {}
        try { delete globalThis.__taskHorizonOpenMobileFileById; } catch (e) {}
        try { delete globalThis.__taskHorizonOpenTabView; } catch (e) {}
        try { delete globalThis.__taskHorizonTabElement; } catch (e) {}
        try { delete globalThis.__taskHorizonQuickbarLoaded; } catch (e) {}
        try { delete globalThis.__taskHorizonQuickbarToggle; } catch (e) {}
        try { delete globalThis.__taskHorizonQuickbarCleanup; } catch (e) {}
    }

    async uninstall() {
        try { globalThis.__TaskManagerCleanup?.(); } catch (e) {}
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
