(function () {
    if (globalThis.__tmHomepage?.loaded) return;

    const runtime = {
        root: null,
        ctx: null,
        rangeDays: 30,
        profile: "desktop",
        clickHandler: null,
        documentClickHandler: null,
        resizeObserver: null,
        resizeHost: null,
        resizeRaf: 0,
        heatmapLayoutRaf: 0,
        settleUntil: 0,
        settleTimer: 0,
        focusState: { status: "idle", key: "", records: [], settings: null, unavailable: false },
        focusLoadSeq: 0,
        selectedFocusTaskId: "",
        focusDateOffset: 0,
        focusTaskListMode: "day",
        focusRecentDays: 90,
        focusDayPage: 0,
        focusTaskPopoverOpen: false,
        focusCalendar: { open: false, monthKey: "", status: "idle", key: "", records: [], loadSeq: 0 },
        homepageSettingsOpen: false,
    };
    const FOCUS_HISTORY_LOAD_DAYS = 90;
    const HOMEPAGE_MODULE_ORDER_STORAGE_KEY = "tm_homepage_module_order";
    const HOMEPAGE_MODULE_LAYOUT_STORAGE_KEY = "tm_homepage_module_layout";
    const HOMEPAGE_MODULE_DEFS = Object.freeze([
        { id: "overview", label: "任务概览", desc: "任务状态、完成摘要", wide: true },
        { id: "focus", label: "专注统计", desc: "番茄联动开启时展示", wide: true },
        { id: "trend", label: "完成趋势", desc: "最近完成曲线", wide: true },
        { id: "heatmap", label: "完成热力图", desc: "按月展示近一年完成情况", wide: false },
        { id: "distribution", label: "任务分布", desc: "未完成任务分布", wide: false },
        { id: "recent", label: "最近完成", desc: "最近 6 条完成记录", wide: false },
        { id: "risk", label: "风险提醒", desc: "逾期与临期任务", wide: false },
    ]);
    const HOMEPAGE_DEFAULT_MODULE_ORDER = Object.freeze(HOMEPAGE_MODULE_DEFS.map((item) => item.id));
    const HOMEPAGE_MODULE_DEF_BY_ID = HOMEPAGE_MODULE_DEFS.reduce((map, item) => {
        map[item.id] = item;
        return map;
    }, {});
    let homepageTaskMetaAttrKeySettingsRaw = null;
    let homepageTaskMetaAttrKeySettingsCache = {};
    let homepageTaskMetaAttrAliasSettingsRaw = null;
    let homepageTaskMetaAttrAliasSettingsCache = {};

    function normalizeHomepageModuleOrder(value) {
        const raw = Array.isArray(value) ? value : [];
        const out = [];
        raw.forEach((item) => {
            const id = String(item || "").trim();
            if (id && HOMEPAGE_MODULE_DEF_BY_ID[id] && !out.includes(id)) out.push(id);
        });
        HOMEPAGE_DEFAULT_MODULE_ORDER.forEach((id) => {
            if (!out.includes(id)) out.push(id);
        });
        return out;
    }

    function readHomepageModuleOrder() {
        let raw = "";
        try { raw = String(localStorage.getItem(HOMEPAGE_MODULE_ORDER_STORAGE_KEY) || ""); } catch (e) {}
        if (!raw.trim()) return normalizeHomepageModuleOrder(null);
        try {
            return normalizeHomepageModuleOrder(JSON.parse(raw));
        } catch (e) {
            return normalizeHomepageModuleOrder(null);
        }
    }

    function saveHomepageModuleOrder(order) {
        const normalized = normalizeHomepageModuleOrder(order);
        try { localStorage.setItem(HOMEPAGE_MODULE_ORDER_STORAGE_KEY, JSON.stringify(normalized)); } catch (e) {}
        return normalized;
    }

    function resetHomepageModuleOrder() {
        try { localStorage.removeItem(HOMEPAGE_MODULE_ORDER_STORAGE_KEY); } catch (e) {}
        try { localStorage.removeItem(HOMEPAGE_MODULE_LAYOUT_STORAGE_KEY); } catch (e) {}
        return normalizeHomepageModuleOrder(null);
    }

    function moveHomepageModule(moduleId, delta) {
        const id = String(moduleId || "").trim();
        const step = Math.max(-1, Math.min(1, Math.round(Number(delta) || 0)));
        if (!id || !step) return readHomepageModuleOrder();
        const order = readHomepageModuleOrder();
        const index = order.indexOf(id);
        const nextIndex = Math.max(0, Math.min(order.length - 1, index + step));
        if (index < 0 || index === nextIndex) return order;
        const next = order.slice();
        const [item] = next.splice(index, 1);
        next.splice(nextIndex, 0, item);
        return saveHomepageModuleOrder(next);
    }

    function normalizeHomepageModuleLayout(value) {
        const source = (value && typeof value === "object" && !Array.isArray(value)) ? value : {};
        return {
            focus: String(source.focus || "wide").trim() === "narrow" ? "narrow" : "wide",
            trend: String(source.trend || "wide").trim() === "narrow" ? "narrow" : "wide",
        };
    }

    function readHomepageModuleLayout() {
        let raw = "";
        try { raw = String(localStorage.getItem(HOMEPAGE_MODULE_LAYOUT_STORAGE_KEY) || ""); } catch (e) {}
        if (!raw.trim()) return normalizeHomepageModuleLayout(null);
        try {
            return normalizeHomepageModuleLayout(JSON.parse(raw));
        } catch (e) {
            return normalizeHomepageModuleLayout(null);
        }
    }

    function saveHomepageModuleLayout(layout) {
        const normalized = normalizeHomepageModuleLayout(layout);
        try { localStorage.setItem(HOMEPAGE_MODULE_LAYOUT_STORAGE_KEY, JSON.stringify(normalized)); } catch (e) {}
        return normalized;
    }

    function setHomepageTrendLayout(value) {
        const nextValue = String(value || "").trim() === "narrow" ? "narrow" : "wide";
        const layout = readHomepageModuleLayout();
        return saveHomepageModuleLayout({ ...layout, trend: nextValue });
    }

    function setHomepageFocusLayout(value) {
        const nextValue = String(value || "").trim() === "narrow" ? "narrow" : "wide";
        const layout = readHomepageModuleLayout();
        return saveHomepageModuleLayout({ ...layout, focus: nextValue });
    }

    function getHomepageTrendLayout() {
        return readHomepageModuleLayout().trend;
    }

    function getHomepageFocusLayout() {
        return readHomepageModuleLayout().focus;
    }

    function isHomepageModuleWide(id) {
        const key = String(id || "").trim();
        if (key === "focus") return getHomepageFocusLayout() !== "narrow";
        if (key === "trend") return getHomepageTrendLayout() !== "narrow";
        return HOMEPAGE_MODULE_DEF_BY_ID[key]?.wide === true;
    }

    function readHomepageTaskMetaAttrSettingsObject(storageKey, kind) {
        let raw = "";
        try { raw = String(localStorage.getItem(storageKey) || ""); } catch (e) {}
        if (kind === "keys" && raw === homepageTaskMetaAttrKeySettingsRaw) return homepageTaskMetaAttrKeySettingsCache;
        if (kind === "aliases" && raw === homepageTaskMetaAttrAliasSettingsRaw) return homepageTaskMetaAttrAliasSettingsCache;
        let value = {};
        if (raw.trim()) {
            try {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) value = parsed;
            } catch (e) {}
        }
        if (kind === "keys") {
            homepageTaskMetaAttrKeySettingsRaw = raw;
            homepageTaskMetaAttrKeySettingsCache = value;
            return homepageTaskMetaAttrKeySettingsCache;
        }
        homepageTaskMetaAttrAliasSettingsRaw = raw;
        homepageTaskMetaAttrAliasSettingsCache = value;
        return homepageTaskMetaAttrAliasSettingsCache;
    }

    function normalizeHomepageTaskMetaAttrKeyName(value, fallback = "") {
        const key = String(value || "").trim();
        if (key && /^custom-[a-zA-Z0-9_-]+$/.test(key)) return key;
        const safeFallback = String(fallback || "").trim();
        return safeFallback && /^custom-[a-zA-Z0-9_-]+$/.test(safeFallback) ? safeFallback : "";
    }

    const HOMEPAGE_TASK_META_ATTR_DEFAULT_KEYS = Object.freeze({
        completionTime: "custom-completion-time",
        taskCompleteAt: "custom-task-complete-at",
    });

    function readHomepageConfiguredTaskMetaAttr(task, field) {
        const source = (task && typeof task === "object") ? task : {};
        const metaField = String(field || "").trim();
        const defaultKey = HOMEPAGE_TASK_META_ATTR_DEFAULT_KEYS[metaField] || "";
        if (!defaultKey) return "";
        const settings = readHomepageTaskMetaAttrSettingsObject("tm_task_meta_attr_keys", "keys");
        const currentKey = normalizeHomepageTaskMetaAttrKeyName(settings?.[metaField], defaultKey) || defaultKey;
        const aliases = readHomepageTaskMetaAttrSettingsObject("tm_task_meta_attr_key_aliases", "aliases");
        const rawAliasList = Array.isArray(aliases?.[metaField]) ? aliases[metaField] : [];
        if (currentKey === defaultKey && rawAliasList.length === 0) return "";
        const keys = [];
        const push = (key) => {
            const normalized = normalizeHomepageTaskMetaAttrKeyName(key, "");
            if (normalized && !keys.includes(normalized)) keys.push(normalized);
        };
        push(currentKey);
        rawAliasList.forEach(push);
        for (const key of keys) {
            if (Object.prototype.hasOwnProperty.call(source, key)) return String(source[key] ?? "");
        }
        return "";
    }

    function readHomepageConfiguredTaskCompleteAt(task) {
        return readHomepageConfiguredTaskMetaAttr(task, "taskCompleteAt");
    }

    function readHomepageConfiguredCompletionTime(task) {
        return readHomepageConfiguredTaskMetaAttr(task, "completionTime");
    }

    const HOMEPAGE_STYLE_SOURCE = "homepage.css";
    const HOMEPAGE_STYLE_TEXT = String.raw`.tm-homepage-entry-btn.is-active {
    background: color-mix(in srgb, var(--tm-primary-color) 14%, var(--tm-card-bg));
    border-color: var(--tm-border-color);
    color: var(--tm-primary-color);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--tm-primary-color) 16%, transparent);
}

.tm-body.tm-body--homepage {
    min-height: 0;
    overflow: auto;
    background: var(--tm-bg-color);
}

#tmHomepageRoot {
    min-height: 100%;
}

@keyframes tm-home-fade-up {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

@keyframes tm-home-pulse-ring {
    0% {
        opacity: 0.65;
        transform: scale(0.92);
    }
    70% {
        opacity: 0;
        transform: scale(1.22);
    }
    100% {
        opacity: 0;
        transform: scale(1.28);
    }
}

.tm-homepage-shell {
    --tm-home-bg: var(--tm-bg-color);
    --tm-home-surface: var(--card, var(--tm-card-bg));
    --tm-home-surface-alt: color-mix(in srgb, var(--tm-home-surface) 90%, var(--tm-home-bg) 10%);
    --tm-home-surface-soft: color-mix(in srgb, var(--tm-home-surface) 84%, var(--tm-home-bg) 16%);
    --tm-home-text: var(--tm-text-color);
    --tm-home-text-muted: var(--tm-secondary-text);
    --tm-home-border: var(--border, var(--tm-border-color));
    --tm-home-border-soft: color-mix(in srgb, var(--tm-border-color) 82%, transparent);
    --tm-home-accent: var(--tm-primary-color);
    --tm-home-accent-soft: color-mix(in srgb, var(--tm-primary-color) 14%, var(--tm-card-bg));
    --tm-home-accent-soft-2: color-mix(in srgb, var(--tm-primary-color) 24%, var(--tm-card-bg));
    --tm-home-accent-ring: color-mix(in srgb, var(--tm-primary-color) 18%, transparent);
    --tm-home-success: var(--tm-success-color);
    --tm-home-success-soft: color-mix(in srgb, var(--tm-success-color) 16%, var(--tm-card-bg));
    --tm-home-warning: var(--tm-warning-color, #f9ab00);
    --tm-home-warning-soft: color-mix(in srgb, var(--tm-warning-color, #f9ab00) 16%, var(--tm-card-bg));
    --tm-home-danger: var(--tm-danger-color);
    --tm-home-danger-soft: color-mix(in srgb, var(--tm-danger-color) 16%, var(--tm-card-bg));
    --tm-home-hover: var(--tm-hover-bg);
    --tm-home-shadow: var(--shadow-sm, 0 8px 20px rgba(15, 23, 42, 0.045));
    --tm-home-gap: 16px;
    --tm-home-card-radius: calc(var(--radius, 10px) + 2px);
    --tm-home-card-padding-x: 16px;
    --tm-home-card-padding-y: 15px;
    --tm-home-card-padding: var(--tm-home-card-padding-y) var(--tm-home-card-padding-x);
    --tm-home-trend-height: 190px;
    --tm-home-heatmap-cell: 16px;
    --tm-home-heatmap-gap: 5px;
    --tm-home-heatmap-edge-inset: 0px;
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 100%;
    padding: 16px;
    box-sizing: border-box;
    overflow: hidden;
    background:
        radial-gradient(1200px 340px at -6% -14%, color-mix(in srgb, var(--tm-home-accent) 5%, transparent), transparent 62%),
        radial-gradient(920px 280px at 108% 0%, color-mix(in srgb, var(--tm-home-accent) 4%, transparent), transparent 58%),
        linear-gradient(180deg, color-mix(in srgb, var(--tm-home-accent) 3%, transparent), transparent 180px),
        var(--tm-home-bg);
    color: var(--tm-home-text);
}

.tm-homepage-shell::before,
.tm-homepage-shell::after {
    content: "";
    position: absolute;
    border-radius: 999px;
    pointer-events: none;
    filter: blur(18px);
    opacity: 0.9;
}

.tm-homepage-shell::before {
    top: -68px;
    right: 8%;
    width: 180px;
    height: 180px;
    background: color-mix(in srgb, var(--tm-home-accent) 10%, transparent);
}

.tm-homepage-shell::after {
    bottom: -44px;
    left: 6%;
    width: 140px;
    height: 140px;
    background: color-mix(in srgb, var(--tm-home-accent) 4%, transparent);
}

.tm-homepage-main {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
}

.tm-homepage-main > * {
    margin: 0;
}

.tm-homepage-main > * + * {
    margin-top: var(--tm-home-gap);
}

.tm-homepage-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
}

.tm-homepage-title-wrap {
    max-width: min(720px, 100%);
}

.tm-homepage-title {
    margin: 0;
    font-size: clamp(20px, 2vw, 26px);
    line-height: 1.1;
    font-weight: 800;
    letter-spacing: -0.045em;
    color: var(--tm-home-text);
}

.tm-homepage-subtitle {
    margin: 6px 0 0;
    font-size: 12px;
    line-height: 1.6;
    color: var(--tm-home-text-muted);
    max-width: 62ch;
}

.tm-homepage-toolbar {
    display: inline-flex;
    align-items: center;
    gap: 10px;
}

.tm-homepage-settings {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
}

.tm-homepage-settings-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border: 1px solid var(--tm-home-border);
    border-radius: 10px;
    background: color-mix(in srgb, var(--tm-home-surface) 86%, var(--tm-home-surface-alt) 14%);
    color: var(--tm-home-text-muted);
    cursor: pointer;
    transition:
        background-color 180ms ease,
        border-color 180ms ease,
        color 180ms ease,
        box-shadow 180ms ease;
}

.tm-homepage-settings-btn:hover,
.tm-homepage-settings-btn.is-active {
    background: var(--tm-home-hover);
    border-color: color-mix(in srgb, var(--tm-home-accent) 22%, var(--tm-home-border));
    color: var(--tm-home-accent);
}

.tm-homepage-settings-btn:focus-visible,
.tm-homepage-module-order-btn:focus-visible,
.tm-homepage-module-reset-btn:focus-visible,
.tm-homepage-module-layout-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--tm-home-accent-ring);
}

.tm-homepage-settings-btn svg {
    width: 16px;
    height: 16px;
    fill: currentColor;
}

.tm-homepage-settings-panel {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 30;
    width: min(330px, calc(100vw - 32px));
    padding: 10px;
    border: 1px solid var(--tm-home-border);
    border-radius: 12px;
    background: color-mix(in srgb, var(--tm-home-surface) 96%, var(--tm-home-bg) 4%);
    box-shadow: 0 16px 38px rgba(15, 23, 42, 0.16);
    box-sizing: border-box;
}

.tm-homepage-settings-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 8px;
}

.tm-homepage-settings-title {
    font-size: 12px;
    line-height: 1.35;
    font-weight: 800;
    color: var(--tm-home-text);
}

.tm-homepage-module-reset-btn {
    height: 26px;
    padding: 0 9px;
    border: 1px solid var(--tm-home-border-soft);
    border-radius: 8px;
    background: color-mix(in srgb, var(--tm-home-surface-alt) 76%, transparent);
    color: var(--tm-home-text-muted);
    font-size: 11px;
    line-height: 1;
    font-weight: 800;
    cursor: pointer;
}

.tm-homepage-module-reset-btn:hover {
    background: var(--tm-home-hover);
    color: var(--tm-home-text);
}

.tm-homepage-module-order-list {
    display: grid;
    gap: 6px;
}

.tm-homepage-module-order-item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 8px;
    border: 1px solid var(--tm-home-border-soft);
    border-radius: 10px;
    background: color-mix(in srgb, var(--tm-home-surface-alt) 70%, transparent);
}

.tm-homepage-module-order-main {
    min-width: 0;
}

.tm-homepage-module-order-label {
    font-size: 12px;
    line-height: 1.35;
    font-weight: 800;
    color: var(--tm-home-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.tm-homepage-module-order-desc {
    margin-top: 2px;
    font-size: 11px;
    line-height: 1.35;
    color: var(--tm-home-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.tm-homepage-module-layout-switch {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    flex: 0 0 auto;
    padding: 3px;
    border: 1px solid var(--tm-home-border-soft);
    border-radius: 8px;
    background: color-mix(in srgb, var(--tm-home-surface) 82%, transparent);
}

.tm-homepage-module-layout-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 22px;
    min-width: 38px;
    padding: 0 8px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--tm-home-text-muted);
    font-size: 11px;
    line-height: 1;
    font-weight: 800;
    cursor: pointer;
}

.tm-homepage-module-layout-btn:hover {
    background: var(--tm-home-hover);
    color: var(--tm-home-text);
}

.tm-homepage-module-layout-btn.is-active {
    background: var(--tm-home-accent-soft);
    color: var(--tm-home-accent);
    box-shadow: 0 0 0 1px var(--tm-home-accent-ring);
}

.tm-homepage-module-order-actions {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex: 0 0 auto;
}

.tm-homepage-module-order-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 1px solid var(--tm-home-border-soft);
    border-radius: 8px;
    background: color-mix(in srgb, var(--tm-home-surface) 82%, transparent);
    color: var(--tm-home-text);
    font-size: 14px;
    line-height: 1;
    font-weight: 800;
    cursor: pointer;
}

.tm-homepage-module-order-btn:hover {
    background: var(--tm-home-hover);
    border-color: color-mix(in srgb, var(--tm-home-accent) 18%, var(--tm-home-border));
}

.tm-homepage-module-order-btn:disabled {
    cursor: default;
    opacity: 0.36;
}

.tm-homepage-range-switch {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    border: 1px solid var(--tm-home-border);
    border-radius: var(--radius, 10px);
    background: color-mix(in srgb, var(--tm-home-surface) 84%, var(--tm-home-surface-alt) 16%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.03);
}

.tm-homepage-range-btn {
    min-width: 54px;
    height: 30px;
    padding: 0 10px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--tm-home-text-muted);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transform: translateY(0);
    filter: saturate(1);
    border-color: transparent;
    transition:
        transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
        background-color 220ms ease,
        color 220ms ease,
        border-color 220ms ease,
        box-shadow 220ms ease,
        filter 220ms ease;
}

.tm-homepage-range-btn:hover {
    background: var(--tm-home-hover);
    color: var(--tm-home-text);
    transform: translateY(0);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--tm-home-accent) 14%, transparent);
}

.tm-homepage-range-btn.is-active {
    background: var(--tm-home-accent-soft);
    color: var(--tm-home-accent);
    box-shadow: 0 0 0 1px var(--tm-home-accent-ring);
}

.tm-homepage-hero-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: stretch;
    gap: var(--tm-home-gap);
    width: 100%;
}

.tm-homepage-module-flow {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-auto-rows: auto;
    align-items: stretch;
    column-gap: var(--tm-home-gap);
    row-gap: var(--tm-home-gap);
    min-width: 0;
}

.tm-homepage-module {
    display: flex;
    align-self: stretch;
    min-width: 0;
    min-height: 0;
}

.tm-homepage-module > .tm-homepage-card,
.tm-homepage-module > [data-tm-home-trend-slot],
.tm-homepage-module > [data-tm-home-focus-slot] {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    height: 100%;
}

.tm-homepage-module > .tm-homepage-hero-grid {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    height: 100%;
}

.tm-homepage-module > [data-tm-home-trend-slot] > .tm-homepage-card,
.tm-homepage-module > [data-tm-home-focus-slot] > .tm-homepage-card {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    height: 100%;
}

.tm-homepage-module--wide {
    grid-column: 1 / -1;
}

.tm-homepage-hero-grid > .tm-homepage-card {
    align-self: stretch;
    min-height: 0;
    height: 100%;
}

.tm-homepage-card--overview,
.tm-homepage-card--summary,
.tm-homepage-card--trend {
    display: flex;
    flex-direction: column;
    min-height: 0;
}

.tm-homepage-card.tm-homepage-card--overview {
    gap: 10px;
    border-color: color-mix(in srgb, var(--tm-home-accent) 12%, var(--tm-home-border));
    background: color-mix(in srgb, var(--tm-home-surface) 97%, var(--tm-home-bg) 3%);
}

.tm-homepage-card.tm-homepage-card--summary {
    gap: 10px;
    background: color-mix(in srgb, var(--tm-home-surface) 98%, var(--tm-home-bg) 2%);
}

.tm-homepage-card--overview .tm-homepage-card-head,
.tm-homepage-card--summary .tm-homepage-card-head,
.tm-homepage-card--trend .tm-homepage-card-head {
    margin-bottom: 0;
}

.tm-homepage-overview-rate {
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    padding: 0 10px;
    border: 1px solid color-mix(in srgb, var(--tm-home-accent) 20%, var(--tm-home-border));
    border-radius: 999px;
    background: color-mix(in srgb, var(--tm-home-accent) 6%, var(--tm-home-surface));
    font-size: 12px;
    font-weight: 700;
    color: var(--tm-home-accent);
    white-space: nowrap;
}

.tm-homepage-overview-summary {
    display: grid;
    grid-template-columns: minmax(86px, max-content) minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    min-width: 0;
    padding: 8px 12px;
    border: 1px solid var(--tm-home-border-soft);
    border-radius: calc(var(--tm-home-card-radius) - 2px);
    background: color-mix(in srgb, var(--tm-home-surface) 96%, var(--tm-home-bg) 4%);
}

.tm-homepage-overview-total {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    min-width: 0;
}

.tm-homepage-overview-total-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--tm-home-text-muted);
}

.tm-homepage-overview-total-value {
    font-size: 28px;
    line-height: 1;
    font-weight: 800;
    letter-spacing: -0.045em;
    color: var(--tm-home-text);
}

.tm-homepage-overview-bar-wrap {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: stretch;
    justify-content: center;
}

.tm-homepage-overview-bar {
    position: relative;
    display: flex;
    width: 100%;
    gap: 4px;
    align-items: stretch;
    height: 12px;
    padding: 2px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--tm-home-border) 34%, transparent);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
}

.tm-homepage-overview-bar-seg {
    min-width: 8px;
    height: 100%;
    border-radius: 999px;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.14);
}

.tm-homepage-overview-bar-seg.is-accent {
    background: linear-gradient(180deg, color-mix(in srgb, var(--tm-home-accent) 90%, white 10%), color-mix(in srgb, var(--tm-home-accent) 78%, black 6%));
}

.tm-homepage-overview-bar-seg.is-warning {
    background: linear-gradient(180deg, color-mix(in srgb, var(--tm-home-warning) 90%, white 10%), color-mix(in srgb, var(--tm-home-warning) 78%, black 6%));
}

.tm-homepage-overview-bar-seg.is-success {
    background: linear-gradient(180deg, color-mix(in srgb, var(--tm-home-success) 90%, white 10%), color-mix(in srgb, var(--tm-home-success) 78%, black 6%));
}

.tm-homepage-overview-stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0;
    margin-top: 0;
    padding-top: 0;
    border-top: 1px solid var(--tm-home-border-soft);
    background: transparent;
}

.tm-homepage-overview-stat {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: baseline;
    gap: 10px;
    min-height: 0;
    padding: 9px 12px 7px;
    border-right: 1px solid var(--tm-home-border-soft);
    background: transparent;
}

.tm-homepage-overview-stat:last-child {
    border-right: none;
}

.tm-homepage-overview-stat-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    color: var(--tm-home-text);
}

.tm-homepage-overview-stat-main {
    display: inline-flex;
    align-items: baseline;
    justify-content: flex-end;
    gap: 6px;
    min-width: 0;
}

.tm-homepage-overview-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--tm-home-accent);
    box-shadow: 0 0 0 1px color-mix(in srgb, currentColor 20%, transparent);
}

.tm-homepage-overview-dot.is-accent { background: color-mix(in srgb, var(--tm-home-accent) 88%, white 12%); }
.tm-homepage-overview-dot.is-warning { background: color-mix(in srgb, var(--tm-home-warning) 88%, white 12%); }
.tm-homepage-overview-dot.is-success { background: color-mix(in srgb, var(--tm-home-success) 88%, white 12%); }

.tm-homepage-overview-stat-value {
    margin-top: 0;
    font-size: 18px;
    line-height: 1;
    font-weight: 800;
    color: var(--tm-home-text);
}

.tm-homepage-overview-stat-sub {
    font-size: 11px;
    line-height: 1;
    color: var(--tm-home-text-muted);
}

.tm-homepage-summary-layout {
    display: grid;
    grid-template-columns: minmax(138px, 168px) minmax(0, 1fr);
    gap: 12px;
    align-items: stretch;
}

.tm-homepage-summary-main {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 8px;
    padding: 14px 16px;
    border: 1px solid var(--tm-home-border-soft);
    border-radius: calc(var(--tm-home-card-radius) - 2px);
    background: color-mix(in srgb, var(--tm-home-accent) 4%, var(--tm-home-surface-alt));
}

.tm-homepage-summary-main-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--tm-home-text-muted);
}

.tm-homepage-summary-main-value {
    font-size: 34px;
    line-height: 1;
    font-weight: 800;
    letter-spacing: -0.04em;
    color: var(--tm-home-text);
}

.tm-homepage-summary-main-note {
    font-size: 11px;
    line-height: 1.4;
    color: var(--tm-home-text-muted);
}

.tm-homepage-summary-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
    gap: 10px;
    align-content: stretch;
    min-width: 0;
}

.tm-homepage-summary-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 4px;
    padding: 11px 12px 10px;
    border: 1px solid var(--tm-home-border-soft);
    border-radius: calc(var(--tm-home-card-radius) - 4px);
    background: var(--tm-home-surface-alt);
}

.tm-homepage-summary-row-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--tm-home-text-muted);
}

.tm-homepage-summary-row-value {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    white-space: nowrap;
    line-height: 1;
    color: var(--tm-home-text);
}

.tm-homepage-summary-row-number {
    font-size: 34px;
    line-height: 1;
    font-weight: 800;
    letter-spacing: -0.04em;
    color: inherit;
}

.tm-homepage-summary-row-unit {
    font-size: 17px;
    line-height: 1;
    font-weight: 700;
    color: inherit;
}

.tm-homepage-summary-row-note {
    font-size: 11px;
    line-height: 1.35;
    color: var(--tm-home-text-muted);
}

.tm-homepage-summary-row.is-success .tm-homepage-summary-row-value {
    color: color-mix(in srgb, var(--tm-home-success) 86%, var(--tm-home-text) 14%);
}

.tm-homepage-summary-row.is-warning .tm-homepage-summary-row-value {
    color: color-mix(in srgb, var(--tm-home-warning) 88%, var(--tm-home-text) 12%);
}

.tm-homepage-summary-row.is-procrastination {
    border-color: color-mix(in srgb, var(--tm-home-danger) var(--tm-home-procrastination-border-mix, 18%), var(--tm-home-border-soft));
    background: color-mix(in srgb, var(--tm-home-danger) var(--tm-home-procrastination-bg-mix, 5%), var(--tm-home-surface-alt));
}

.tm-homepage-summary-row.is-procrastination .tm-homepage-summary-row-value {
    color: color-mix(in srgb, var(--tm-home-danger) var(--tm-home-procrastination-text-mix, 36%), var(--tm-home-text));
}

.tm-homepage-card {
    border: 1px solid var(--tm-home-border);
    border-radius: var(--tm-home-card-radius);
    background: var(--tm-home-surface);
    box-shadow: var(--tm-home-shadow);
}

.tm-homepage-card {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    min-width: 0;
    min-height: 0;
    padding: var(--tm-home-card-padding);
    background: color-mix(in srgb, var(--tm-home-surface) 94%, var(--tm-home-bg) 6%);
    transform: translateY(0);
    filter: saturate(1);
    transition:
        transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
        border-color 220ms ease,
        box-shadow 220ms ease,
        background-color 220ms ease,
        filter 220ms ease;
}

.tm-homepage-card::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, color-mix(in srgb, var(--tm-home-accent) 2%, transparent), transparent 34%);
    pointer-events: none;
}

.tm-homepage-card:hover {
    transform: translateY(0);
    border-color: color-mix(in srgb, var(--tm-home-accent) 14%, var(--tm-home-border));
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--tm-home-accent) 8%, transparent);
    filter: saturate(1.015);
}

.tm-homepage-card-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 8px;
}

.tm-homepage-card-title {
    font-size: 14px;
    line-height: 1.2;
    font-weight: 800;
    color: var(--tm-home-text);
}

.tm-homepage-card-desc {
    margin-top: 2px;
    font-size: 11px;
    line-height: 1.4;
    color: var(--tm-home-text-muted);
}

.tm-homepage-card.tm-homepage-card--trend {
    gap: 10px;
    height: 100%;
    min-height: 0;
    background: color-mix(in srgb, var(--tm-home-surface) 98%, var(--tm-home-bg) 2%);
}

.tm-homepage-trend-head {
    position: relative;
    display: block;
    min-width: 0;
}

.tm-homepage-trend-head-main {
    display: grid;
    gap: 4px;
    min-width: 0;
}

.tm-homepage-trend-title-group {
    min-width: 0;
    min-height: 32px;
    padding-right: 142px;
}

.tm-homepage-trend-summary {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
    min-width: 0;
}

.tm-homepage-trend-stat {
    display: inline-flex;
    align-items: baseline;
    flex-wrap: nowrap;
    gap: 0 5px;
    min-width: 0;
    padding: 0;
    border: none;
    border-radius: 0;
    background: transparent;
    white-space: nowrap;
}

.tm-homepage-trend-stat-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--tm-home-text-muted);
}

.tm-homepage-trend-stat-value {
    font-size: 16px;
    line-height: 1;
    font-weight: 800;
    color: var(--tm-home-text);
}

.tm-homepage-trend-stat-note {
    font-size: 11px;
    line-height: 1.2;
    color: var(--tm-home-text-muted);
}

.tm-homepage-trend-head .tm-homepage-range-switch {
    position: absolute;
    top: 0;
    right: 0;
    gap: 2px;
    padding: 3px;
    border-radius: 9px;
}

.tm-homepage-trend-head .tm-homepage-range-btn {
    min-width: 40px;
    height: 26px;
    padding: 0 7px;
    border-radius: 7px;
    font-size: 11px;
}

.tm-homepage-trend-wrap {
    flex: 1 1 var(--tm-home-trend-height);
    min-height: var(--tm-home-trend-height);
    position: relative;
    box-sizing: border-box;
    border: 1px solid var(--tm-home-border-soft);
    border-radius: calc(var(--tm-home-card-radius) - 2px);
    overflow: hidden;
    padding: 6px 8px 4px;
    background:
        linear-gradient(180deg, color-mix(in srgb, var(--tm-home-accent) 2%, transparent), transparent 34%),
        var(--tm-home-surface-alt);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
}

.tm-homepage-trend-scroll {
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
}

.tm-homepage-trend-scroll-inner {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 0;
    width: 100%;
    min-width: 0;
    min-height: 0;
    height: 100%;
}

.tm-homepage-trend-svg {
    width: 100%;
    height: 100%;
    display: block;
    overflow: hidden;
}

.tm-homepage-trend-grid {
    stroke: var(--tm-home-border-soft);
    stroke-width: 1;
    stroke-dasharray: 3 7;
    opacity: 0.58;
}

.tm-homepage-trend-area {
    fill: url(#tmHomepageTrendFill);
    opacity: 0.66;
}

.tm-homepage-trend-line-glow {
    fill: none;
    stroke: color-mix(in srgb, var(--tm-home-accent) 22%, transparent);
    stroke-width: 6;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0.28;
}

.tm-homepage-trend-line {
    fill: none;
    stroke: url(#tmHomepageTrendStroke);
    stroke-width: 2.75;
    stroke-linecap: round;
    stroke-linejoin: round;
    filter: drop-shadow(0 1px 5px color-mix(in srgb, var(--tm-home-accent) 8%, transparent));
}

.tm-homepage-trend-dot {
    fill: var(--tm-home-accent);
}

.tm-homepage-trend-dot--peak {
    fill: color-mix(in srgb, var(--tm-home-accent) 86%, white 14%);
}

.tm-homepage-trend-dot--last {
    fill: var(--tm-home-surface);
    stroke: var(--tm-home-accent);
    stroke-width: 3;
}

.tm-homepage-trend-dot--last-ring {
    fill: none;
    stroke: color-mix(in srgb, var(--tm-home-accent) 22%, transparent);
    stroke-width: 2;
    transform-origin: center;
    animation: tm-home-pulse-ring 1800ms cubic-bezier(0.22, 1, 0.36, 1) infinite;
}

.tm-homepage-trend-label {
    fill: var(--tm-home-text-muted);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0;
    text-rendering: geometricPrecision;
}

.tm-homepage-trend-axis {
    display: grid;
    grid-template-columns: repeat(var(--tm-home-trend-days, 15), minmax(0, 1fr));
    gap: 3px;
    flex: 0 0 auto;
}

.tm-homepage-trend-axis-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 0;
    padding: 2px 0 0;
}

.tm-homepage-trend-axis-value {
    min-height: 12px;
    font-size: 10px;
    line-height: 1;
    font-weight: 700;
    color: var(--tm-home-text);
}

.tm-homepage-trend-axis-value.is-empty {
    opacity: 0;
}

.tm-homepage-trend-axis-date {
    min-height: 12px;
    font-size: 10px;
    line-height: 1.2;
    color: var(--tm-home-text-muted);
    white-space: nowrap;
}

.tm-homepage-trend-axis-date.is-empty {
    opacity: 0;
}

.tm-homepage-card.tm-homepage-card--focus {
    --tm-home-focus-list-height: 232px;
    --tm-home-focus-panel-min-height: 300px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
    min-height: 0;
    overflow: visible;
    background: color-mix(in srgb, var(--tm-home-surface) 97%, var(--tm-home-bg) 3%);
}

.tm-homepage-focus-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: stretch;
    gap: 12px;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
}

.tm-homepage-focus-panel {
    min-width: 0;
    min-height: var(--tm-home-focus-panel-min-height);
    height: 100%;
    padding: 12px;
    border: 1px solid var(--tm-home-border-soft);
    border-radius: calc(var(--tm-home-card-radius) - 2px);
    box-sizing: border-box;
    background: color-mix(in srgb, var(--tm-home-surface-alt) 82%, var(--tm-home-surface) 18%);
}

[data-tm-home-focus-recent-slot] {
    min-width: 0;
    height: 100%;
}

.tm-homepage-card--focus.is-narrow [data-tm-home-focus-recent-slot] {
    display: none;
}

.tm-homepage-focus-panel--placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
}

.tm-homepage-focus-today {
    align-self: stretch;
    min-height: 0;
    position: relative;
}

.tm-homepage-focus-today-layout {
    display: grid;
    grid-template-columns: minmax(176px, 1.22fr) minmax(118px, 0.78fr);
    align-items: stretch;
    gap: 12px;
    min-width: 0;
    min-height: 0;
    height: 100%;
}

.tm-homepage-focus-day-metrics {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    gap: 10px;
    min-height: 100%;
    min-width: 0;
}

.tm-homepage-focus-calendar-wrap {
    align-self: start;
    min-width: 0;
}

.tm-homepage-focus-day-summary-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    min-width: 0;
}

.tm-homepage-focus-day-summary-head .tm-homepage-focus-total {
    justify-content: flex-end;
    flex: 0 0 auto;
}

.tm-homepage-focus-day-nav {
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr) 30px;
    align-items: center;
    gap: 8px;
    min-width: 0;
}

.tm-homepage-focus-day-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: 1px solid var(--tm-home-border-soft);
    border-radius: 8px;
    background: color-mix(in srgb, var(--tm-home-surface) 84%, transparent);
    color: var(--tm-home-text);
    font-size: 17px;
    line-height: 1;
    font-weight: 800;
    cursor: pointer;
    transition:
        background-color 180ms ease,
        border-color 180ms ease,
        color 180ms ease,
        box-shadow 180ms ease;
}

.tm-homepage-focus-day-btn:hover {
    background: var(--tm-home-hover);
    border-color: color-mix(in srgb, var(--tm-home-accent) 18%, var(--tm-home-border));
}

.tm-homepage-focus-day-btn:disabled {
    cursor: default;
    opacity: 0.36;
    background: color-mix(in srgb, var(--tm-home-surface) 62%, transparent);
}

.tm-homepage-focus-day-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--tm-home-accent-ring);
}

.tm-homepage-focus-day-label {
    border: none;
    background: transparent;
    font: inherit;
    cursor: pointer;
    min-width: 0;
    padding: 2px 4px;
    border-radius: 8px;
    text-align: center;
    color: inherit;
}

.tm-homepage-focus-day-label:hover {
    background: color-mix(in srgb, var(--tm-home-hover) 56%, transparent);
}

.tm-homepage-focus-day-label:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--tm-home-accent-ring);
}

.tm-homepage-focus-day-title {
    font-size: 12px;
    line-height: 1.25;
    font-weight: 800;
    color: var(--tm-home-text);
}

.tm-homepage-focus-day-date {
    margin-top: 2px;
    font-size: 11px;
    line-height: 1.25;
    font-weight: 700;
    color: var(--tm-home-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.tm-homepage-focus-calendar-popover {
    position: static;
    width: 100%;
    padding: 7px;
    border: 1px solid color-mix(in srgb, var(--tm-home-accent) 18%, var(--tm-home-border));
    border-radius: 8px;
    background: color-mix(in srgb, var(--tm-home-surface) 96%, var(--tm-home-bg) 4%);
    box-shadow: none;
    box-sizing: border-box;
}

.tm-homepage-focus-calendar-head {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr) 24px;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
}

.tm-homepage-focus-calendar-head .tm-homepage-focus-day-btn {
    width: 24px;
    height: 24px;
    border-radius: 7px;
    font-size: 15px;
}

.tm-homepage-focus-calendar-month {
    text-align: center;
    font-size: 12px;
    line-height: 1.3;
    font-weight: 800;
    color: var(--tm-home-text);
}

.tm-homepage-focus-calendar-week,
.tm-homepage-focus-calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 3px;
}

.tm-homepage-focus-calendar-week {
    margin-bottom: 4px;
}

.tm-homepage-focus-calendar-week span {
    min-width: 0;
    text-align: center;
    font-size: 10px;
    line-height: 1.2;
    font-weight: 700;
    color: var(--tm-home-text-muted);
}

.tm-homepage-focus-calendar-day {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    width: 100%;
    aspect-ratio: 1;
    min-height: 21px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: color-mix(in srgb, var(--tm-home-surface-alt) 70%, transparent);
    color: var(--tm-home-text-muted);
    font-size: 11px;
    line-height: 1;
    font-weight: 800;
    cursor: pointer;
    transition:
        border-color 160ms ease,
        box-shadow 160ms ease,
        color 160ms ease,
        transform 160ms ease;
}

.tm-homepage-focus-calendar-day:hover {
    border-color: color-mix(in srgb, var(--tm-home-accent) 46%, var(--tm-home-border));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tm-home-accent) 28%, transparent), 0 2px 8px rgba(15, 23, 42, 0.08);
    color: var(--tm-home-text);
    transform: translateY(-1px);
}

.tm-homepage-focus-calendar-day.is-empty {
    visibility: hidden;
    pointer-events: none;
}

.tm-homepage-focus-calendar-day.is-future {
    cursor: default;
    opacity: 0.28;
    pointer-events: none;
}

.tm-homepage-focus-calendar-day.has-focus {
    color: var(--tm-home-text);
    border-color: color-mix(in srgb, var(--tm-home-accent) 14%, var(--tm-home-border));
}

.tm-homepage-focus-calendar-day.is-l1 { background: color-mix(in srgb, var(--tm-home-accent) 10%, var(--tm-home-surface)); }
.tm-homepage-focus-calendar-day.is-l2 { background: color-mix(in srgb, var(--tm-home-accent) 18%, var(--tm-home-surface)); }
.tm-homepage-focus-calendar-day.is-l3 { background: color-mix(in srgb, var(--tm-home-accent) 28%, var(--tm-home-surface)); }
.tm-homepage-focus-calendar-day.is-l4 {
    background: color-mix(in srgb, var(--tm-home-accent) 42%, var(--tm-home-surface));
    color: color-mix(in srgb, var(--tm-home-text) 92%, white 8%);
}

.tm-homepage-focus-calendar-day.is-selected {
    border-color: var(--tm-home-accent);
    box-shadow: inset 0 0 0 1px var(--tm-home-accent), 0 0 0 2px var(--tm-home-accent-ring);
}

.tm-homepage-focus-calendar-loading {
    min-height: 150px;
}

.tm-homepage-focus-total {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
}

.tm-homepage-focus-total-value {
    font-size: 36px;
    line-height: 1;
    font-weight: 800;
    letter-spacing: 0;
    color: var(--tm-home-text);
}

.tm-homepage-focus-total-unit {
    font-size: 13px;
    font-weight: 700;
    color: var(--tm-home-text-muted);
    white-space: nowrap;
}

.tm-homepage-focus-stat-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
}

.tm-homepage-focus-day-metrics .tm-homepage-focus-stat-grid {
    grid-template-columns: 1fr;
    grid-auto-rows: minmax(0, 1fr);
}

.tm-homepage-focus-day-metrics .tm-homepage-focus-empty {
    min-height: 0;
    height: 100%;
}

.tm-homepage-focus-recent > .tm-homepage-focus-empty {
    flex: 1 1 auto;
}

.tm-homepage-focus-stat {
    min-width: 0;
    padding: 9px 10px;
    border: 1px solid var(--tm-home-border-soft);
    border-radius: calc(var(--tm-home-card-radius) - 4px);
    background: color-mix(in srgb, var(--tm-home-surface) 74%, transparent);
}

.tm-homepage-focus-stat-label {
    font-size: 11px;
    line-height: 1.3;
    font-weight: 700;
    color: var(--tm-home-text-muted);
}

.tm-homepage-focus-stat-value {
    margin-top: 5px;
    font-size: 18px;
    line-height: 1;
    font-weight: 800;
    color: var(--tm-home-text);
}

.tm-homepage-focus-progress {
    display: grid;
    gap: 7px;
    min-width: 0;
}

.tm-homepage-focus-progress-meta {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    min-width: 0;
    font-size: 11px;
    line-height: 1.3;
    font-weight: 700;
    color: var(--tm-home-text-muted);
}

.tm-homepage-focus-progress-value {
    color: var(--tm-home-text);
    white-space: nowrap;
}

.tm-homepage-focus-progress-track {
    height: 10px;
    border-radius: 999px;
    overflow: hidden;
    background: color-mix(in srgb, var(--tm-home-border) 64%, transparent);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.05);
}

.tm-homepage-focus-progress-bar {
    display: block;
    height: 100%;
    width: var(--tm-home-focus-progress, 0%);
    max-width: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--tm-home-accent-soft-2), var(--tm-home-accent));
    box-shadow: inset 0 1px 0 rgba(255,255,255,.16);
}

.tm-homepage-focus-recent {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
}

.tm-homepage-focus-recent-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    min-width: 0;
}

.tm-homepage-focus-recent-title {
    font-size: 12px;
    line-height: 1.3;
    font-weight: 800;
    color: var(--tm-home-text);
}

.tm-homepage-focus-recent-range {
    font-size: 11px;
    line-height: 1.3;
    font-weight: 700;
    color: var(--tm-home-text-muted);
    white-space: nowrap;
}

.tm-homepage-focus-recent-side {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    min-width: 0;
    flex-wrap: wrap;
}

.tm-homepage-focus-mode-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 26px;
    padding: 0 10px;
    border: 1px solid var(--tm-home-border-soft);
    border-radius: 8px;
    background: color-mix(in srgb, var(--tm-home-surface) 82%, transparent);
    color: var(--tm-home-text-muted);
    font-size: 11px;
    line-height: 1;
    font-weight: 800;
    white-space: nowrap;
    cursor: pointer;
}

.tm-homepage-focus-mode-btn:hover {
    background: var(--tm-home-hover);
    border-color: color-mix(in srgb, var(--tm-home-accent) 18%, var(--tm-home-border));
    color: var(--tm-home-text);
}

.tm-homepage-focus-mode-btn.is-active {
    color: var(--tm-home-accent);
    border-color: color-mix(in srgb, var(--tm-home-accent) 24%, var(--tm-home-border));
    background: var(--tm-home-accent-soft);
}

.tm-homepage-focus-mode-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--tm-home-accent-ring);
}

.tm-homepage-focus-page-nav {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
}

.tm-homepage-focus-page-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: 1px solid var(--tm-home-border-soft);
    border-radius: 7px;
    background: color-mix(in srgb, var(--tm-home-surface) 84%, transparent);
    color: var(--tm-home-text);
    font-size: 14px;
    line-height: 1;
    font-weight: 800;
    cursor: pointer;
}

.tm-homepage-focus-page-btn:hover {
    background: var(--tm-home-hover);
    border-color: color-mix(in srgb, var(--tm-home-accent) 18%, var(--tm-home-border));
}

.tm-homepage-focus-page-btn:disabled {
    cursor: default;
    opacity: 0.36;
}

.tm-homepage-focus-page-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--tm-home-accent-ring);
}

.tm-homepage-focus-page-count {
    min-width: 30px;
    text-align: center;
    font-size: 11px;
    line-height: 1;
    font-weight: 700;
    color: var(--tm-home-text-muted);
    white-space: nowrap;
}

.tm-homepage-focus-task-popover {
    position: absolute;
    z-index: 22;
    right: 14px;
    bottom: 14px;
    left: 14px;
    display: flex;
    flex-direction: column;
    gap: 9px;
    max-height: min(328px, calc(100% - 28px));
    padding: 12px;
    border: 1px solid color-mix(in srgb, var(--tm-home-accent) 20%, var(--tm-home-border));
    border-radius: calc(var(--tm-home-card-radius) - 1px);
    background: color-mix(in srgb, var(--tm-home-surface) 98%, var(--tm-home-bg) 2%);
    box-shadow: 0 16px 38px rgba(15, 23, 42, 0.16), 0 0 0 1px color-mix(in srgb, var(--tm-home-accent) 8%, transparent);
    box-sizing: border-box;
}

.tm-homepage-focus-task-popover-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    min-width: 0;
}

.tm-homepage-focus-task-popover-title {
    font-size: 12px;
    line-height: 1.3;
    font-weight: 800;
    color: var(--tm-home-text);
}

.tm-homepage-focus-task-popover-date {
    margin-top: 2px;
    font-size: 11px;
    line-height: 1.3;
    font-weight: 700;
    color: var(--tm-home-text-muted);
}

.tm-homepage-focus-task-popover-actions {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    min-width: 0;
    flex: 0 0 auto;
}

.tm-homepage-focus-task-popover-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: 1px solid var(--tm-home-border-soft);
    border-radius: 7px;
    background: color-mix(in srgb, var(--tm-home-surface-alt) 80%, transparent);
    color: var(--tm-home-text-muted);
    font-size: 16px;
    line-height: 1;
    font-weight: 800;
    cursor: pointer;
}

.tm-homepage-focus-task-popover-close:hover {
    background: var(--tm-home-hover);
    color: var(--tm-home-text);
}

.tm-homepage-focus-task-popover-close:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--tm-home-accent-ring);
}

.tm-homepage-focus-task-popover .tm-homepage-focus-list {
    min-height: 0;
    overflow: auto;
    padding-right: 2px;
}

.tm-homepage-focus-task-popover .tm-homepage-focus-empty {
    min-height: 112px;
}

.tm-homepage-focus-list {
    display: flex;
    flex-direction: column;
    gap: 5px;
    flex: 1 1 auto;
    min-width: 0;
    min-height: var(--tm-home-focus-list-height);
}

.tm-homepage-focus-task {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 42px;
    padding: 7px 10px;
    border: none;
    border-radius: 10px;
    background: color-mix(in srgb, var(--tm-home-surface) 72%, transparent);
    color: inherit;
    cursor: pointer;
    text-align: left;
    transition:
        background-color 180ms ease,
        box-shadow 180ms ease,
        filter 180ms ease;
}

.tm-homepage-focus-task:hover {
    background: color-mix(in srgb, var(--tm-home-hover) 74%, var(--tm-home-surface) 26%);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tm-home-accent) 14%, transparent);
    filter: saturate(1.03);
}

.tm-homepage-focus-task.is-selected {
    background: color-mix(in srgb, var(--tm-home-accent) 9%, var(--tm-home-surface));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tm-home-accent) 22%, var(--tm-home-border));
}

.tm-homepage-focus-task:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--tm-home-accent-ring);
}

.tm-homepage-focus-task-main {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
}

.tm-homepage-focus-task-title {
    font-size: 13px;
    line-height: 1.35;
    font-weight: 700;
    color: var(--tm-home-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.tm-homepage-focus-task-meta {
    font-size: 11px;
    line-height: 1.35;
    color: var(--tm-home-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.tm-homepage-focus-task-side {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    min-width: 0;
    flex-wrap: wrap;
}

.tm-homepage-focus-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 24px;
    padding: 0 9px;
    border-radius: 999px;
    font-size: 11px;
    line-height: 1;
    font-weight: 700;
    white-space: nowrap;
}

.tm-homepage-focus-pill {
    color: var(--tm-home-accent);
    background: var(--tm-home-accent-soft);
}

.tm-homepage-focus-pill.is-empty {
    color: var(--tm-home-text-muted);
    background: var(--tm-home-surface-alt);
}

.tm-homepage-focus-empty,
.tm-homepage-focus-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 128px;
    padding: 14px;
    border: 1px dashed var(--tm-home-border-soft);
    border-radius: 10px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--tm-home-text-muted);
    background: var(--tm-home-surface-alt);
}

#tmHomepageRoot[data-tm-homepage-animate="1"] .tm-homepage-header {
    animation: tm-home-fade-up 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

#tmHomepageRoot[data-tm-homepage-animate="1"] .tm-homepage-module {
    animation: tm-home-fade-up 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

#tmHomepageRoot[data-tm-homepage-animate="1"] .tm-homepage-module:nth-child(1) { animation-delay: 90ms; }
#tmHomepageRoot[data-tm-homepage-animate="1"] .tm-homepage-module:nth-child(2) { animation-delay: 140ms; }
#tmHomepageRoot[data-tm-homepage-animate="1"] .tm-homepage-module:nth-child(3) { animation-delay: 190ms; }
#tmHomepageRoot[data-tm-homepage-animate="1"] .tm-homepage-module:nth-child(4) { animation-delay: 240ms; }
#tmHomepageRoot[data-tm-homepage-animate="1"] .tm-homepage-module:nth-child(5) { animation-delay: 290ms; }
#tmHomepageRoot[data-tm-homepage-animate="1"] .tm-homepage-module:nth-child(6) { animation-delay: 340ms; }
#tmHomepageRoot[data-tm-homepage-animate="1"] .tm-homepage-module:nth-child(7) { animation-delay: 390ms; }

.tm-homepage-card.tm-homepage-card--heatmap {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}

.tm-homepage-card--heatmap .tm-homepage-card-head {
    flex: 0 0 auto;
}

.tm-homepage-card--heatmap .tm-homepage-heatmap-shell {
    flex: 1 1 auto;
    min-height: 0;
}

.tm-homepage-card--heatmap .tm-homepage-heatmap-grid {
    flex: 1 1 auto;
    align-items: stretch;
    justify-content: flex-end;
    gap: var(--tm-home-heatmap-gap);
    min-height: 0;
}

.tm-homepage-card--heatmap .tm-homepage-heatmap-month {
    flex: 0 0 auto;
    min-width: 0;
    min-height: 0;
}

.tm-homepage-card--heatmap .tm-homepage-heatmap-month-grid {
    flex: 1 1 auto;
    grid-template-columns: repeat(var(--tm-home-heatmap-month-cols), var(--tm-home-heatmap-cell));
    grid-template-rows: repeat(var(--tm-home-heatmap-month-rows, 8), var(--tm-home-heatmap-cell));
    align-content: start;
    justify-content: start;
    align-items: start;
    justify-items: start;
    min-height: 0;
}

.tm-homepage-card--heatmap .tm-homepage-chart-empty {
    flex: 1 1 auto;
}

.tm-homepage-heatmap-grid {
    display: flex;
    flex-wrap: nowrap;
    gap: var(--tm-home-heatmap-gap);
    align-items: start;
    justify-content: flex-end;
    min-width: 0;
}

.tm-homepage-heatmap-shell {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 14px;
    box-sizing: border-box;
}

.tm-homepage-card--heatmap .tm-homepage-heatmap-shell::before {
    content: "";
    position: absolute;
    z-index: 3;
    top: 0;
    bottom: 0;
    left: calc(-1 * var(--tm-home-card-padding-x));
    width: calc(var(--tm-home-card-padding-x) + var(--tm-home-heatmap-edge-inset));
    background: color-mix(in srgb, var(--tm-home-surface) 94%, var(--tm-home-bg) 6%);
    pointer-events: none;
}

.tm-homepage-heatmap-month {
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex: 0 0 auto;
}

.tm-homepage-heatmap-month-label {
    font-size: 12px;
    font-weight: 700;
    color: var(--tm-home-text);
    letter-spacing: -0.01em;
}

.tm-homepage-heatmap-month-grid {
    display: grid;
    grid-template-columns: repeat(var(--tm-home-heatmap-month-cols), minmax(0, 1fr));
    grid-template-rows: repeat(var(--tm-home-heatmap-month-rows, 8), minmax(0, 1fr));
    grid-auto-flow: column;
    gap: var(--tm-home-heatmap-gap);
}

.tm-homepage-heatmap-cell {
    width: var(--tm-home-heatmap-cell);
    height: var(--tm-home-heatmap-cell);
    border-radius: calc(var(--tm-home-heatmap-cell) * 0.28);
    background: color-mix(in srgb, var(--tm-home-border) 35%, transparent);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
    transform: translateY(0) scale(1);
    filter: saturate(1);
    transition:
        transform 200ms cubic-bezier(0.22, 1, 0.36, 1),
        filter 180ms ease,
        background-color 180ms ease,
        box-shadow 180ms ease;
}

.tm-homepage-heatmap-cell:hover {
    transform: translateY(-2px) scale(1.08);
    filter: saturate(1.1);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.12), 0 0 0 1px color-mix(in srgb, var(--tm-home-accent) 14%, transparent);
}

.tm-homepage-heatmap-cell--l1 { background: color-mix(in srgb, var(--tm-home-accent) 12%, var(--tm-home-surface)); }
.tm-homepage-heatmap-cell--l2 { background: color-mix(in srgb, var(--tm-home-accent) 24%, var(--tm-home-surface)); }
.tm-homepage-heatmap-cell--l3 { background: color-mix(in srgb, var(--tm-home-accent) 40%, var(--tm-home-surface)); }
.tm-homepage-heatmap-cell--l4 { background: color-mix(in srgb, var(--tm-home-accent) 62%, var(--tm-home-surface)); }

.tm-homepage-heatmap-legend {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    flex-wrap: wrap;
    min-width: 0;
}

.tm-homepage-heatmap-legend-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--tm-home-text-muted);
    min-width: auto;
}

.tm-homepage-distribution-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.tm-homepage-distribution-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.tm-homepage-distribution-meta {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
}

.tm-homepage-distribution-label {
    font-size: 12px;
    color: var(--tm-home-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.tm-homepage-distribution-value {
    font-size: 12px;
    font-weight: 700;
    color: var(--tm-home-text-muted);
}

.tm-homepage-distribution-track {
    height: 10px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--tm-home-border) 72%, transparent);
    overflow: hidden;
}

.tm-homepage-distribution-bar {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--tm-home-accent-soft-2), var(--tm-home-accent));
    box-shadow: inset 0 1px 0 rgba(255,255,255,.16);
    filter: saturate(1) brightness(1);
    transform: translateX(0);
    transition:
        width 260ms cubic-bezier(0.22, 1, 0.36, 1),
        filter 220ms ease,
        box-shadow 220ms ease,
        transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.tm-homepage-distribution-item:hover .tm-homepage-distribution-bar {
    filter: saturate(1.12) brightness(1.04);
    transform: translateX(0);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--tm-home-accent) 16%, transparent);
}

.tm-homepage-list {
    display: flex;
    flex-direction: column;
}

.tm-homepage-list-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    min-height: 44px;
    padding: 10px 12px;
    border: none;
    border-radius: 10px;
    background: color-mix(in srgb, var(--tm-home-surface) 76%, transparent);
    color: inherit;
    cursor: pointer;
    text-align: left;
    transform: translateX(0);
    filter: saturate(1);
    transition:
        transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
        background-color 220ms ease,
        border-color 220ms ease,
        box-shadow 220ms ease,
        filter 220ms ease;
}

.tm-homepage-list-item:hover {
    background: color-mix(in srgb, var(--tm-home-hover) 76%, var(--tm-home-surface) 24%);
    transform: translateX(0);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tm-home-accent) 14%, transparent);
    filter: saturate(1.03);
}

.tm-homepage-list-item:focus-visible,
.tm-homepage-range-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--tm-home-accent-ring);
}

.tm-homepage-list-main {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    flex: 1 1 auto;
}

.tm-homepage-list-title {
    font-size: 13px;
    line-height: 1.4;
    font-weight: 700;
    color: var(--tm-home-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.tm-homepage-list-doc {
    font-size: 12px;
    line-height: 1.4;
    color: var(--tm-home-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.tm-homepage-list-side {
    flex: 0 0 auto;
}

.tm-homepage-list-date,
.tm-homepage-list-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 24px;
    padding: 0 10px;
    border-radius: 999px;
    font-size: 11px;
    line-height: 1;
    font-weight: 700;
    color: var(--tm-home-text-muted);
    background: var(--tm-home-surface-alt);
}

.tm-homepage-list-badge.is-warning {
    color: color-mix(in srgb, var(--tm-home-warning) 90%, var(--tm-home-text) 10%);
    background: var(--tm-home-warning-soft);
}

.tm-homepage-list-badge.is-danger {
    color: color-mix(in srgb, var(--tm-home-danger) 92%, var(--tm-home-text) 8%);
    background: var(--tm-home-danger-soft);
}

.tm-homepage-list-empty,
.tm-homepage-chart-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 96px;
    padding: 14px;
    border: 1px dashed var(--tm-home-border-soft);
    border-radius: 10px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--tm-home-text-muted);
    background: var(--tm-home-surface-alt);
}

.tm-homepage--dock {
    --tm-home-gap: 12px;
    --tm-home-trend-height: 172px;
    --tm-home-heatmap-cell: 15px;
    --tm-home-heatmap-gap: 5px;
}

.tm-homepage--dock .tm-homepage-hero-grid {
    grid-template-columns: 1fr;
}

.tm-homepage--dock .tm-homepage-module-flow {
    grid-template-columns: 1fr;
}

.tm-homepage--dock .tm-homepage-module--wide {
    grid-column: auto;
}

.tm-homepage--dock .tm-homepage-focus-grid,
.tm-homepage-card--focus.is-narrow .tm-homepage-focus-grid {
    grid-template-columns: 1fr;
}

.tm-homepage--dock .tm-homepage-focus-today-layout,
.tm-homepage-card--focus.is-narrow .tm-homepage-focus-today-layout {
    grid-template-columns: minmax(150px, 1.12fr) minmax(108px, 0.88fr);
    gap: 10px;
}

.tm-homepage--mobile {
    --tm-home-gap: 12px;
    --tm-home-card-padding-x: 14px;
    --tm-home-card-padding-y: 12px;
    --tm-home-trend-height: 156px;
    --tm-home-heatmap-cell: 13px;
    --tm-home-heatmap-gap: 4px;
    padding: 12px;
}

.tm-homepage--mobile .tm-homepage-card.tm-homepage-card--focus {
    --tm-home-focus-list-height: 314px;
    --tm-home-focus-panel-min-height: 374px;
}

.tm-homepage--mobile .tm-homepage-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
}

.tm-homepage--mobile .tm-homepage-toolbar {
    width: auto;
    justify-content: flex-end;
}

.tm-homepage--mobile .tm-homepage-settings {
    width: auto;
    flex-direction: column;
    align-items: flex-end;
}

.tm-homepage--mobile .tm-homepage-settings-btn {
    align-self: flex-end;
}

.tm-homepage--mobile .tm-homepage-settings-panel {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    width: min(330px, calc(100vw - 32px));
    box-shadow: none;
}

.tm-homepage--mobile .tm-homepage-trend-head-main,
.tm-homepage-card--trend.is-narrow .tm-homepage-trend-head-main {
    display: grid;
    gap: 6px;
    min-width: 0;
}

.tm-homepage--mobile .tm-homepage-trend-summary,
.tm-homepage-card--trend.is-narrow .tm-homepage-trend-summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4px 10px;
}

.tm-homepage--mobile .tm-homepage-trend-stat,
.tm-homepage-card--trend.is-narrow .tm-homepage-trend-stat {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
        "label value"
        "note note";
    align-items: end;
    gap: 2px 6px;
    min-width: 0;
    padding: 0 8px;
    border-right: 1px solid var(--tm-home-border-soft);
    white-space: normal;
}

.tm-homepage--mobile .tm-homepage-trend-stat:last-child,
.tm-homepage-card--trend.is-narrow .tm-homepage-trend-stat:last-child {
    border-right: none;
    padding-right: 0;
}

.tm-homepage--mobile .tm-homepage-trend-stat:first-child,
.tm-homepage-card--trend.is-narrow .tm-homepage-trend-stat:first-child {
    padding-left: 0;
}

.tm-homepage--mobile .tm-homepage-trend-stat-label,
.tm-homepage-card--trend.is-narrow .tm-homepage-trend-stat-label {
    grid-area: label;
    align-self: center;
    line-height: 1.1;
}

.tm-homepage--mobile .tm-homepage-trend-stat-value,
.tm-homepage-card--trend.is-narrow .tm-homepage-trend-stat-value {
    grid-area: value;
    justify-self: end;
    align-self: center;
    line-height: 1;
}

.tm-homepage--mobile .tm-homepage-trend-stat-note,
.tm-homepage-card--trend.is-narrow .tm-homepage-trend-stat-note {
    grid-area: note;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-top: 1px;
}

.tm-homepage--mobile .tm-homepage-hero-grid {
    grid-template-columns: 1fr;
}

.tm-homepage--mobile .tm-homepage-focus-grid {
    grid-template-columns: 1fr;
    gap: 10px;
}

.tm-homepage--mobile .tm-homepage-focus-today-layout {
    grid-template-columns: minmax(150px, 1.12fr) minmax(108px, 0.88fr);
    gap: 10px;
}

.tm-homepage--mobile .tm-homepage-focus-total-value {
    font-size: 32px;
}

.tm-homepage--mobile .tm-homepage-focus-stat-grid {
    gap: 7px;
}

.tm-homepage--mobile .tm-homepage-focus-stat {
    padding: 8px 9px;
}

.tm-homepage--mobile .tm-homepage-focus-task {
    grid-template-columns: minmax(0, 1fr) max-content;
    align-items: center;
    gap: 8px;
    min-height: 58px;
}

.tm-homepage--mobile .tm-homepage-focus-task-title,
.tm-homepage--mobile .tm-homepage-focus-task-meta {
    white-space: normal;
    overflow: visible;
    text-overflow: clip;
    word-break: break-word;
}

.tm-homepage--mobile .tm-homepage-focus-task-side {
    justify-content: flex-end;
    flex-wrap: nowrap;
    min-width: max-content;
}

.tm-homepage--mobile .tm-homepage-focus-pill {
    flex: 0 0 auto;
}

.tm-homepage--mobile .tm-homepage-focus-recent-side {
    justify-content: flex-start;
    flex-wrap: wrap;
}

.tm-homepage--mobile .tm-homepage-focus-task-popover {
    right: 10px;
    bottom: 10px;
    left: 10px;
    max-height: calc(100% - 20px);
    padding: 10px;
}

.tm-homepage--mobile .tm-homepage-focus-task-popover-head {
    align-items: flex-start;
    flex-direction: column;
    gap: 7px;
}

.tm-homepage--mobile .tm-homepage-focus-task-popover-actions {
    justify-content: space-between;
    width: 100%;
}

.tm-homepage--mobile .tm-homepage-focus-calendar-popover {
    position: static;
    width: 100%;
    margin-top: 0;
    transform: none;
}

.tm-homepage--mobile .tm-homepage-focus-calendar-day {
    min-height: 26px;
}

.tm-homepage--mobile .tm-homepage-overview-stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    overflow: visible;
    padding-top: 2px;
}

.tm-homepage--mobile .tm-homepage-overview-stat {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
    min-width: 0;
    padding: 9px 8px 8px;
    border-right: 1px solid var(--tm-home-border-soft);
    border-bottom: none;
}

.tm-homepage--mobile .tm-homepage-overview-stat:last-child {
    border-right: none;
}

.tm-homepage--mobile .tm-homepage-overview-stat-label {
    min-width: 0;
    white-space: normal;
    line-height: 1.3;
}

.tm-homepage--mobile .tm-homepage-overview-stat-main {
    width: 100%;
    justify-content: flex-start;
    gap: 4px;
}

.tm-homepage--mobile .tm-homepage-overview-summary {
    grid-template-columns: minmax(74px, max-content) minmax(0, 1fr);
    align-items: center;
    gap: 8px;
}

.tm-homepage--mobile .tm-homepage-overview-total {
    gap: 3px;
}

.tm-homepage--mobile .tm-homepage-overview-total-value {
    font-size: 26px;
}

.tm-homepage--mobile .tm-homepage-summary-layout {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: stretch;
    gap: 8px;
}

.tm-homepage--mobile .tm-homepage-summary-main {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
        "label value"
        "note note";
    align-items: end;
    gap: 4px 12px;
    min-width: 0;
    padding: 12px 14px 11px;
}

.tm-homepage--mobile .tm-homepage-summary-main-label {
    grid-area: label;
    align-self: start;
}

.tm-homepage--mobile .tm-homepage-summary-main-value {
    grid-area: value;
    justify-self: end;
    font-size: 32px;
}

.tm-homepage--mobile .tm-homepage-summary-main-note {
    grid-area: note;
    padding-top: 2px;
}

.tm-homepage--mobile .tm-homepage-summary-list {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    min-width: 0;
}

.tm-homepage--mobile .tm-homepage-summary-row {
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: 5px 8px;
    padding: 10px 10px 9px;
}

.tm-homepage--mobile .tm-homepage-summary-row-value {
    justify-self: end;
}

.tm-homepage--mobile .tm-homepage-summary-row-number {
    font-size: 32px;
}

.tm-homepage--mobile .tm-homepage-summary-row-unit {
    font-size: 16px;
}

.tm-homepage--mobile .tm-homepage-summary-row-note {
    grid-column: 1 / -1;
    padding-top: 1px;
}

.tm-homepage--mobile .tm-homepage-overview-rate {
    align-self: flex-start;
}

.tm-homepage--mobile .tm-homepage-module-flow {
    grid-template-columns: 1fr;
}

.tm-homepage--mobile .tm-homepage-module--wide {
    grid-column: auto;
}

.tm-homepage--mobile .tm-homepage-summary-main-value {
    font-size: 30px;
}

.tm-homepage--mobile .tm-homepage-summary-row-number {
    font-size: 30px;
}

.tm-homepage--mobile .tm-homepage-summary-row-unit {
    font-size: 15px;
}

.tm-homepage--mobile .tm-homepage-trend-wrap,
.tm-homepage-card--trend.is-narrow .tm-homepage-trend-wrap {
    padding: 6px 6px 4px;
}

.tm-homepage--mobile .tm-homepage-trend-axis,
.tm-homepage-card--trend.is-narrow .tm-homepage-trend-axis {
    gap: 2px;
}

.tm-homepage--mobile .tm-homepage-trend-axis-value,
.tm-homepage-card--trend.is-narrow .tm-homepage-trend-axis-value {
    min-height: 10px;
    font-size: 9px;
}

.tm-homepage--mobile .tm-homepage-trend-axis-date,
.tm-homepage-card--trend.is-narrow .tm-homepage-trend-axis-date {
    font-size: 9px;
}

.tm-homepage--mobile .tm-homepage-list-item {
    align-items: flex-start;
    flex-direction: row;
    justify-content: space-between;
}

.tm-homepage--mobile .tm-homepage-list-main {
    flex: 1 1 auto;
    width: auto;
    min-width: 0;
}

.tm-homepage--mobile .tm-homepage-list-title,
.tm-homepage--mobile .tm-homepage-list-doc {
    white-space: normal;
    overflow: visible;
    text-overflow: clip;
    word-break: break-word;
}

.tm-homepage--mobile .tm-homepage-list-side {
    display: flex;
    flex: 0 0 auto;
    width: auto;
    min-width: max-content;
    margin-left: 8px;
    justify-content: flex-end;
    align-self: flex-start;
}

.tm-homepage--mobile .tm-homepage-list-date,
.tm-homepage--mobile .tm-homepage-list-badge {
    max-width: none;
    white-space: nowrap;
    word-break: normal;
    flex-shrink: 0;
}

@media (max-width: 420px) {
    .tm-homepage--mobile .tm-homepage-overview-stat {
        padding-left: 7px;
        padding-right: 7px;
    }

    .tm-homepage--mobile .tm-homepage-overview-stat-value {
        font-size: 16px;
    }

    .tm-homepage--mobile .tm-homepage-overview-stat-sub {
        font-size: 10px;
    }

    .tm-homepage--mobile .tm-homepage-summary-layout,
    .tm-homepage--mobile .tm-homepage-summary-list {
        grid-template-columns: 1fr;
    }

    .tm-homepage--mobile .tm-homepage-summary-main {
        grid-column: auto;
    }

    .tm-homepage--mobile .tm-homepage-summary-main {
        grid-template-columns: minmax(0, 1fr) auto;
    }

    .tm-homepage--mobile .tm-homepage-summary-row-number {
        font-size: 30px;
    }

    .tm-homepage--mobile .tm-homepage-focus-stat-grid {
        grid-template-columns: 1fr;
    }

    .tm-homepage--mobile .tm-homepage-focus-progress-meta,
    .tm-homepage--mobile .tm-homepage-focus-recent-head {
        align-items: flex-start;
        flex-direction: column;
        gap: 4px;
    }
}

@media (prefers-reduced-motion: reduce) {
    .tm-homepage-header,
    .tm-homepage-module {
        animation: none !important;
    }

    .tm-homepage-trend-dot--last-ring {
        animation: none !important;
    }
}`;

    const esc = (value) => String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const toNumber = (value, fallback = 0) => {
        const num = Number(value);
        return Number.isFinite(num) ? num : fallback;
    };

    // Measure the homepage viewport instead of the content root itself to avoid resize/render loops.
    function getMeasureHost(root) {
        if (!(root instanceof HTMLElement)) return null;
        const host = root.closest(".tm-body.tm-body--homepage");
        if (host instanceof HTMLElement) return host;
        if (root.parentElement instanceof HTMLElement) return root.parentElement;
        return root;
    }

    function readContainerSize(root) {
        const host = getMeasureHost(root);
        if (!(host instanceof HTMLElement)) {
            return {
                host: root instanceof HTMLElement ? root : null,
                width: root instanceof HTMLElement ? Math.round(root.clientWidth || 0) : 0,
                height: root instanceof HTMLElement ? Math.round(root.clientHeight || 0) : 0,
            };
        }
        const rect = typeof host.getBoundingClientRect === "function" ? host.getBoundingClientRect() : null;
        const width = Math.round((rect?.width || host.clientWidth || 0));
        const height = Math.round((rect?.height || host.clientHeight || 0));
        return { host, width, height };
    }

    function ensureHomepageStyle() {
        let styleEl = document.querySelector('style[data-tm-homepage-style="1"]');
        if (!(styleEl instanceof HTMLStyleElement)) {
            styleEl = document.createElement("style");
            styleEl.dataset.tmHomepageStyle = "1";
            styleEl.dataset.tmStyleSource = HOMEPAGE_STYLE_SOURCE;
            document.head.appendChild(styleEl);
        }
        if (styleEl.textContent !== HOMEPAGE_STYLE_TEXT) {
            styleEl.textContent = HOMEPAGE_STYLE_TEXT + `\n/*# sourceURL=${HOMEPAGE_STYLE_SOURCE} */`;
        }
        return styleEl;
    }

    function formatDateKey(date) {
        const dt = date instanceof Date ? date : new Date(date);
        if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return "";
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, "0");
        const d = String(dt.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    }

    function normalizeDateKey(value) {
        if (!value) return "";
        if (value instanceof Date && !Number.isNaN(value.getTime())) return formatDateKey(value);
        const raw = String(value || "").trim();
        if (!raw) return "";
        if (/^\d{14}$/.test(raw)) {
            const dt = new Date(
                Number(raw.slice(0, 4)),
                Number(raw.slice(4, 6)) - 1,
                Number(raw.slice(6, 8)),
                Number(raw.slice(8, 10)),
                Number(raw.slice(10, 12)),
                Number(raw.slice(12, 14)),
                0,
            );
            return Number.isNaN(dt.getTime()) ? "" : formatDateKey(dt);
        }
        if (/^\d{8}$/.test(raw)) {
            return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
        }
        if (/^\d+$/.test(raw)) {
            const n = Number(raw);
            if (!Number.isFinite(n) || n <= 0) return "";
            const dt = new Date(n < 1e12 ? n * 1000 : n);
            return Number.isNaN(dt.getTime()) ? "" : formatDateKey(dt);
        }
        const m1 = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
        const m2 = raw.match(/^(\d{4})\/(\d{2})\/(\d{2})/);
        if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
        const dt = new Date(raw);
        return Number.isNaN(dt.getTime()) ? "" : formatDateKey(dt);
    }

    function buildDateFromKey(key) {
        const m = String(key || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return null;
        const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
        return Number.isNaN(dt.getTime()) ? null : dt;
    }

    function shiftDateKey(key, deltaDays) {
        const base = buildDateFromKey(normalizeDateKey(key));
        if (!(base instanceof Date)) return "";
        base.setDate(base.getDate() + (Number(deltaDays) || 0));
        return formatDateKey(base);
    }

    function dayDiff(fromKey, toKey) {
        const from = buildDateFromKey(normalizeDateKey(fromKey));
        const to = buildDateFromKey(normalizeDateKey(toKey));
        if (!(from instanceof Date) || !(to instanceof Date)) return 0;
        return Math.round((to.getTime() - from.getTime()) / 86400000);
    }

    function formatShortDate(key) {
        const dt = buildDateFromKey(key);
        return dt instanceof Date ? `${dt.getMonth() + 1}/${dt.getDate()}` : (key || "");
    }

    function formatListDate(key) {
        const dt = buildDateFromKey(key);
        if (!(dt instanceof Date)) return key || "";
        const week = ["日", "一", "二", "三", "四", "五", "六"];
        return `${dt.getMonth() + 1}月${dt.getDate()}日 周${week[dt.getDay()]}`;
    }

    function formatMetricValue(value) {
        const num = Number(value) || 0;
        const rounded = Math.round(num * 10) / 10;
        return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    }

    const TOMATO_SETTINGS_PATHS = Object.freeze([
        "/data/storage/petal/siyuan-plugin-docktomato/tomato-settings.json",
        "/data/storage/tomato-settings.json",
    ]);

    function parseDateTime(value) {
        if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
        const raw = String(value || "").trim();
        if (!raw) return null;
        const dt = new Date(raw);
        return Number.isNaN(dt.getTime()) ? null : dt;
    }

    function addLocalDays(date, deltaDays) {
        const base = date instanceof Date ? new Date(date.getTime()) : new Date();
        base.setDate(base.getDate() + (Number(deltaDays) || 0));
        return base;
    }

    function getLocalDayStart(key) {
        const normalized = normalizeDateKey(key);
        const day = buildDateFromKey(normalized) || new Date();
        return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
    }

    function buildFocusWindow(ctx, rangeDays = runtime.focusRecentDays) {
        const todayKey = normalizeDateKey(ctx?.todayKey) || formatDateKey(new Date());
        const todayStart = getLocalDayStart(todayKey);
        const todayEnd = addLocalDays(todayStart, 1);
        const days = Math.max(1, Math.min(90, Math.round(Number(rangeDays) || FOCUS_HISTORY_LOAD_DAYS)));
        const focusDateOffset = Math.min(0, Math.round(toNumber(runtime.focusDateOffset, 0)));
        const focusDayStart = addLocalDays(todayStart, focusDateOffset);
        const focusDayEnd = addLocalDays(focusDayStart, 1);
        return {
            todayKey,
            todayStart,
            todayEnd,
            focusDateOffset,
            focusDateKey: formatDateKey(focusDayStart),
            focusDayStart,
            focusDayEnd,
            rangeStart: addLocalDays(todayStart, -(days - 1)),
            rangeEnd: todayEnd,
            rangeDays: days,
        };
    }

    function normalizeMonthKey(value) {
        const raw = String(value || "").trim();
        const direct = raw.match(/^(\d{4})-(\d{2})$/);
        if (direct) return `${direct[1]}-${direct[2]}`;
        const key = normalizeDateKey(raw);
        return key ? key.slice(0, 7) : "";
    }

    function getMonthBounds(monthKey) {
        const normalized = normalizeMonthKey(monthKey) || formatDateKey(new Date()).slice(0, 7);
        const m = normalized.match(/^(\d{4})-(\d{2})$/);
        const start = m
            ? new Date(Number(m[1]), Number(m[2]) - 1, 1, 0, 0, 0, 0)
            : new Date(new Date().getFullYear(), new Date().getMonth(), 1, 0, 0, 0, 0);
        const end = new Date(start.getFullYear(), start.getMonth() + 1, 1, 0, 0, 0, 0);
        return {
            key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
            start,
            end,
        };
    }

    function shiftMonthKey(monthKey, deltaMonths) {
        const bounds = getMonthBounds(monthKey);
        const dt = new Date(bounds.start.getFullYear(), bounds.start.getMonth() + (Number(deltaMonths) || 0), 1, 0, 0, 0, 0);
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    }

    function formatMonthLabel(monthKey) {
        const bounds = getMonthBounds(monthKey);
        return `${bounds.start.getFullYear()}年${bounds.start.getMonth() + 1}月`;
    }

    function normalizeCalendarFirstDay(value) {
        return Number(value) === 0 ? 0 : 1;
    }

    function readStoredCalendarFirstDay() {
        try {
            const raw = localStorage.getItem("tm_calendar_first_day");
            if (raw !== null) return normalizeCalendarFirstDay(JSON.parse(raw));
        } catch (e) {}
        return 1;
    }

    function getCalendarFirstDay(ctx) {
        if (ctx && Object.prototype.hasOwnProperty.call(ctx, "calendarFirstDay")) {
            return normalizeCalendarFirstDay(ctx.calendarFirstDay);
        }
        return readStoredCalendarFirstDay();
    }

    function getCalendarWeekLabels(firstDay) {
        const labels = ["日", "一", "二", "三", "四", "五", "六"];
        const start = normalizeCalendarFirstDay(firstDay);
        return labels.slice(start).concat(labels.slice(0, start));
    }

    function getSelectedFocusDateKey(ctx) {
        return buildFocusWindow(ctx, runtime.focusRecentDays).focusDateKey;
    }

    function getFocusDateOffsetForKey(ctx, key) {
        const todayKey = normalizeDateKey(ctx?.todayKey) || formatDateKey(new Date());
        const targetKey = normalizeDateKey(key) || todayKey;
        if (dayDiff(todayKey, targetKey) > 0) return 0;
        return Math.min(0, dayDiff(todayKey, targetKey));
    }

    function setFocusDateByKey(ctx, key) {
        runtime.focusDateOffset = getFocusDateOffsetForKey(ctx, key);
        runtime.focusTaskListMode = "day";
        runtime.focusDayPage = 0;
        return getSelectedFocusDateKey(ctx);
    }

    function shouldRenderFocusSection(ctx) {
        return ctx?.tomatoIntegrationEnabled === true;
    }

    function buildFocusLoadKey(ctx) {
        if (!shouldRenderFocusSection(ctx)) return "";
        const win = buildFocusWindow(ctx, FOCUS_HISTORY_LOAD_DAYS);
        const version = Math.max(0, Math.round(toNumber(ctx?.tomatoHistoryVersion, 0)));
        return `${win.rangeDays}:${win.rangeStart.toISOString()}:${win.rangeEnd.toISOString()}:d${win.focusDateKey}:v${version}`;
    }

    function normalizeTomatoUserSettings(settings) {
        const source = (settings && typeof settings === "object" && !Array.isArray(settings)) ? settings : {};
        const target = Math.max(1, Math.min(1440, Math.round(toNumber(source.dailyFocusTargetMinutes, 180))));
        return {
            dailyFocusTargetMinutes: target,
            showHoursInTimerFormat: source?.main?.showHoursInTimerFormat === true || source.showHoursInTimerFormat === true,
        };
    }

    function isTomatoSettingsLike(value) {
        return !!(value && typeof value === "object" && !Array.isArray(value)
            && (Object.prototype.hasOwnProperty.call(value, "main")
                || Object.prototype.hasOwnProperty.call(value, "dailyFocusTargetMinutes")
                || Object.prototype.hasOwnProperty.call(value, "showBreakRecords")));
    }

    function parseTomatoSettingsText(text) {
        const raw = String(text || "").trim();
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw);
            return isTomatoSettingsLike(parsed) ? parsed : null;
        } catch (e) {
            return null;
        }
    }

    function readTomatoSettingsFromLocalStorage() {
        try {
            return parseTomatoSettingsText(localStorage.getItem("tomato-user-settings") || "");
        } catch (e) {
            return null;
        }
    }

    async function readTomatoSettingsFile(path) {
        try {
            const response = await fetch("/api/file/getFile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path }),
            });
            if (!response.ok) return null;
            return parseTomatoSettingsText(await response.text());
        } catch (e) {
            return null;
        }
    }

    async function loadTomatoUserSettings() {
        for (const path of TOMATO_SETTINGS_PATHS) {
            const fileSettings = await readTomatoSettingsFile(path);
            if (fileSettings) return normalizeTomatoUserSettings(fileSettings);
        }
        const localSettings = readTomatoSettingsFromLocalStorage();
        return normalizeTomatoUserSettings(localSettings);
    }

    async function loadTomatoHistoryRecords(start, end) {
        const api = globalThis.__dockTomato?.history?.loadRange;
        if (typeof api !== "function") return { records: [], unavailable: true };
        try {
            const records = await api.call(globalThis.__dockTomato.history, start.toISOString(), end.toISOString());
            return { records: Array.isArray(records) ? records : [], unavailable: false };
        } catch (e) {
            return { records: [], unavailable: true };
        }
    }

    async function loadTomatoFocusPayload(ctx) {
        const win = buildFocusWindow(ctx, FOCUS_HISTORY_LOAD_DAYS);
        const historyStart = new Date(Math.min(win.rangeStart.getTime(), win.focusDayStart.getTime()));
        const historyEnd = new Date(Math.max(win.rangeEnd.getTime(), win.focusDayEnd.getTime()));
        const [settings, history] = await Promise.all([
            loadTomatoUserSettings(),
            loadTomatoHistoryRecords(historyStart, historyEnd),
        ]);
        return {
            records: history.records || [],
            settings,
            unavailable: history.unavailable === true,
        };
    }

    function buildFocusCalendarKey(ctx, monthKey) {
        const month = getMonthBounds(monthKey).key;
        const version = Math.max(0, Math.round(toNumber(ctx?.tomatoHistoryVersion, 0)));
        return `${month}:v${version}`;
    }

    function mergeFocusRecords(baseRecords, nextRecords) {
        const out = [];
        const seen = new Set();
        const push = (record) => {
            if (!record || typeof record !== "object") return;
            const key = [
                String(record?.start || "").trim(),
                String(record?.end || "").trim(),
                String(record?.mode || "").trim(),
                String(record?.sessionId || "").trim(),
                String(record?.taskBlockId || "").trim(),
                String(record?.databaseBlockId || "").trim(),
                String(record?.timestamp || "").trim(),
            ].join("|");
            if (seen.has(key)) return;
            seen.add(key);
            out.push(record);
        };
        (Array.isArray(baseRecords) ? baseRecords : []).forEach(push);
        (Array.isArray(nextRecords) ? nextRecords : []).forEach(push);
        return out;
    }

    function ensureFocusCalendarLoaded(ctx, monthKey = "") {
        if (!shouldRenderFocusSection(ctx)) return false;
        const month = getMonthBounds(monthKey || runtime.focusCalendar?.monthKey || getSelectedFocusDateKey(ctx).slice(0, 7));
        const key = buildFocusCalendarKey(ctx, month.key);
        const current = runtime.focusCalendar && typeof runtime.focusCalendar === "object" ? runtime.focusCalendar : {};
        runtime.focusCalendar = {
            open: current.open === true,
            monthKey: month.key,
            status: current.status || "idle",
            key: current.key || "",
            records: Array.isArray(current.records) ? current.records : [],
            loadSeq: Math.max(0, Math.round(toNumber(current.loadSeq, 0))),
        };
        if (runtime.focusCalendar.key === key && (runtime.focusCalendar.status === "loading" || runtime.focusCalendar.status === "loaded")) return true;
        const seq = runtime.focusCalendar.loadSeq + 1;
        runtime.focusCalendar = {
            ...runtime.focusCalendar,
            status: "loading",
            key,
            loadSeq: seq,
            records: [],
        };
        loadTomatoHistoryRecords(month.start, month.end)
            .then((payload) => {
                if (runtime.focusCalendar?.loadSeq !== seq) return;
                const records = Array.isArray(payload?.records) ? payload.records : [];
                runtime.focusCalendar = {
                    ...runtime.focusCalendar,
                    status: payload?.unavailable ? "error" : "loaded",
                    records,
                };
                if (runtime.focusState && runtime.focusState.status === "loaded") {
                    runtime.focusState = {
                        ...runtime.focusState,
                        records: mergeFocusRecords(runtime.focusState.records || [], records),
                    };
                }
                updateFocusDaySlots();
            })
            .catch(() => {
                if (runtime.focusCalendar?.loadSeq !== seq) return;
                runtime.focusCalendar = {
                    ...runtime.focusCalendar,
                    status: "error",
                    records: [],
                };
                updateFocusTodaySlot();
            });
        return true;
    }

    function isFocusHistoryRecord(record) {
        const mode = String(record?.mode || "").trim();
        return mode === "countdown" || mode === "stopwatch";
    }

    function getHistoryRecordRange(record) {
        const start = parseDateTime(record?.start);
        const end = parseDateTime(record?.end);
        if (!(start instanceof Date) || !(end instanceof Date)) return null;
        if (end.getTime() <= start.getTime()) return null;
        return { start, end };
    }

    function getHistoryRecordOverlapSeconds(record, start, end) {
        const range = getHistoryRecordRange(record);
        if (!range) return 0;
        const left = Math.max(range.start.getTime(), start.getTime());
        const right = Math.min(range.end.getTime(), end.getTime());
        if (!Number.isFinite(left) || !Number.isFinite(right) || right <= left) return 0;
        return Math.max(0, Math.round((right - left) / 1000));
    }

    function getHistoryRecordEndMs(record, fallbackEnd = null) {
        const range = getHistoryRecordRange(record);
        const endMs = range?.end?.getTime?.() || toNumber(record?.timestamp, 0);
        const fallbackMs = fallbackEnd instanceof Date ? fallbackEnd.getTime() : 0;
        const ms = Number.isFinite(endMs) && endMs > 0 ? endMs : fallbackMs;
        return fallbackMs > 0 ? Math.min(ms, fallbackMs) : ms;
    }

    function getHistoryRecordSessionKey(record) {
        return String(record?.sessionId || record?.session_id || "").trim()
            || [
                String(record?.start || "").trim(),
                String(record?.end || "").trim(),
                String(record?.taskBlockId || record?.databaseBlockId || "").trim(),
                String(record?.mode || "").trim(),
            ].join("|");
    }

    function getHistoryRecordTaskIds(record) {
        const ids = [];
        const push = (value) => {
            const id = String(value || "").trim();
            if (id && !ids.includes(id)) ids.push(id);
        };
        push(record?.taskBlockId);
        push(record?.databaseBlockId);
        push(record?.blockId);
        push(record?.taskId);
        return ids;
    }

    function getTaskCandidateIds(task) {
        const ids = [];
        const push = (value) => {
            const id = String(value || "").trim();
            if (id && !ids.includes(id)) ids.push(id);
        };
        push(task?.id);
        push(task?.blockId);
        push(task?.block_id);
        push(task?.attrHostId);
        push(task?.attr_host_id);
        push(task?.taskId);
        push(task?.task_id);
        push(task?.nodeId);
        push(task?.node_id);
        push(task?.databaseBlockId);
        push(task?.database_block_id);
        return ids;
    }

    function buildFocusTaskIndex(tasks) {
        const map = new Map();
        flattenTasks(tasks || []).forEach((task) => {
            getTaskCandidateIds(task).forEach((id) => {
                if (!map.has(id)) map.set(id, task);
            });
        });
        return map;
    }

    function buildFocusDayMap(ctx, records, monthKey) {
        const month = getMonthBounds(monthKey);
        const taskIndex = buildFocusTaskIndex(ctx?.tasks || []);
        const daySeconds = new Map();
        const days = [];
        for (let dt = new Date(month.start.getTime()); dt < month.end; dt = addLocalDays(dt, 1)) {
            const key = formatDateKey(dt);
            days.push(key);
            daySeconds.set(key, 0);
        }
        (Array.isArray(records) ? records : []).forEach((record) => {
            if (!isFocusHistoryRecord(record)) return;
            const historyIds = getHistoryRecordTaskIds(record);
            let task = null;
            for (const id of historyIds) {
                task = taskIndex.get(id);
                if (task) break;
            }
            if (!task) return;
            days.forEach((key) => {
                const start = getLocalDayStart(key);
                const end = addLocalDays(start, 1);
                const sec = getHistoryRecordOverlapSeconds(record, start, end);
                if (sec > 0) daySeconds.set(key, (daySeconds.get(key) || 0) + sec);
            });
        });
        const maxMinutes = Math.max(0, ...Array.from(daySeconds.values(), (sec) => sec / 60));
        const out = new Map();
        daySeconds.forEach((sec, key) => {
            const minutes = sec / 60;
            const level = minutes > 0 && maxMinutes > 0
                ? Math.max(1, Math.min(4, Math.ceil((minutes / maxMinutes) * 4)))
                : 0;
            out.set(key, { seconds: sec, minutes, level });
        });
        return out;
    }

    function parsePositiveNumber(value) {
        const raw = String(value ?? "").trim();
        if (!raw) return 0;
        const direct = Number(raw);
        if (Number.isFinite(direct) && direct > 0) return direct;
        const matched = raw.match(/\d+(?:\.\d+)?/);
        const parsed = matched ? Number(matched[0]) : 0;
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    }

    function parseTaskDurationMinutes(task, ctx) {
        const raw = String(task?.duration ?? task?.custom_duration ?? "").trim();
        if (!raw) return 0;
        const fmt = String(ctx?.durationFormat || "hours").trim() === "minutes" ? "minutes" : "hours";
        const numericToMinutes = (num) => {
            if (!Number.isFinite(num) || num <= 0) return 0;
            return fmt === "minutes" ? num : num * 60;
        };
        if (/^\d+(?:\.\d+)?$/.test(raw)) return numericToMinutes(Number(raw));
        let total = 0;
        let matched = false;
        const re = /(\d+(?:\.\d+)?)\s*(day|days|d|hour|hours|h|小时|hr|hrs|minute|minutes|min|m|分钟)/ig;
        let match;
        while ((match = re.exec(raw))) {
            const num = Number(match[1]);
            const unit = String(match[2] || "").toLowerCase();
            if (!Number.isFinite(num) || num <= 0) continue;
            matched = true;
            if (unit === "day" || unit === "days" || unit === "d") total += num * 1440;
            else if (unit === "hour" || unit === "hours" || unit === "h" || unit === "hr" || unit === "hrs" || unit === "小时") total += num * 60;
            else total += num;
        }
        if (matched) return total;
        return numericToMinutes(Number.parseFloat(raw));
    }

    function formatFocusHoursValue(minutes) {
        const hours = Math.max(0, toNumber(minutes, 0)) / 60;
        const rounded = Math.round(hours * 10) / 10;
        return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    }

    function formatFocusHoursText(minutes) {
        return `${formatFocusHoursValue(minutes)} 小时`;
    }

    function secondsToDisplayMinutes(seconds) {
        const sec = Math.max(0, toNumber(seconds, 0));
        if (sec <= 0) return 0;
        return Math.max(1, Math.round(sec / 60));
    }

    function formatRecentFocusTime(ms, todayKey) {
        const num = Number(ms);
        if (!Number.isFinite(num) || num <= 0) return "时间未知";
        const dt = new Date(num);
        if (Number.isNaN(dt.getTime())) return "时间未知";
        const clock = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
        const key = formatDateKey(dt);
        if (key === todayKey) return `今天 ${clock}`;
        if (key === shiftDateKey(todayKey, -1)) return `昨天 ${clock}`;
        return `${dt.getMonth() + 1}/${dt.getDate()} ${clock}`;
    }

    function formatFocusDateTitle(focusDate) {
        if (focusDate?.isToday) return "今日专注";
        return "当日专注";
    }

    function formatFocusDateText(key) {
        const normalized = normalizeDateKey(key);
        return normalized ? formatListDate(normalized) : "日期未知";
    }

    function buildFocusTaskPlan(task, group, ctx) {
        const actualPomodoros = Math.max(0, group?.pomodoroSessions instanceof Set ? group.pomodoroSessions.size : 0);
        const actualMinutes = Math.max(0, secondsToDisplayMinutes(group?.totalSec || 0));
        const estimateTomatoes = parsePositiveNumber(task?.tomatoEstimateCount ?? task?.tomato_estimate_count);
        if (estimateTomatoes > 0) {
            const estimate = Number.isInteger(estimateTomatoes) ? String(estimateTomatoes) : String(Math.round(estimateTomatoes * 10) / 10);
            return { text: `${actualPomodoros} / ${estimate} 番茄`, empty: false };
        }
        const estimateMinutes = parseTaskDurationMinutes(task, ctx);
        if (estimateMinutes > 0) {
            return {
                text: `${actualMinutes} / ${Math.round(estimateMinutes)} 分钟`,
                empty: false,
            };
        }
        if (actualMinutes > 0) return { text: `${actualMinutes} / 0 分钟`, empty: false };
        return { text: "未填预估", empty: true };
    }

    function buildFocusStats(ctx, records, settings) {
        const win = buildFocusWindow(ctx, runtime.focusRecentDays);
        const safeSettings = normalizeTomatoUserSettings(settings);
        const targetMinutes = safeSettings.dailyFocusTargetMinutes;
        const todayPomodoroSessions = new Set();
        const taskIndex = buildFocusTaskIndex(ctx?.tasks || []);
        const groups = new Map();
        const dayGroups = new Map();
        let totalTodaySec = 0;
        let countdownTodaySec = 0;
        let stopwatchTodaySec = 0;
        let distractionCount = 0;
        const addGroupRecord = (map, task, record, seconds, lastFallback) => {
            if (!(map instanceof Map) || !task || seconds <= 0) return;
            const historyIds = getHistoryRecordTaskIds(record);
            const taskIds = getTaskCandidateIds(task);
            const openId = String(task?.id || taskIds[0] || historyIds[0] || "").trim();
            if (!openId) return;
            let group = map.get(openId);
            if (!group) {
                group = {
                    id: openId,
                    task,
                    totalSec: 0,
                    lastMs: 0,
                    pomodoroSessions: new Set(),
                };
                map.set(openId, group);
            }
            group.totalSec += seconds;
            group.lastMs = Math.max(group.lastMs, getHistoryRecordEndMs(record, lastFallback));
            if (String(record?.mode || "").trim() === "countdown") {
                group.pomodoroSessions.add(getHistoryRecordSessionKey(record));
            }
        };

        (Array.isArray(records) ? records : []).forEach((record) => {
            if (!isFocusHistoryRecord(record)) return;
            const historyIds = getHistoryRecordTaskIds(record);
            let task = null;
            for (const id of historyIds) {
                task = taskIndex.get(id);
                if (task) break;
            }
            if (!task) return;
            const todaySec = getHistoryRecordOverlapSeconds(record, win.focusDayStart, win.focusDayEnd);
            if (todaySec > 0) {
                totalTodaySec += todaySec;
                if (String(record?.mode || "").trim() === "countdown") {
                    countdownTodaySec += todaySec;
                    todayPomodoroSessions.add(getHistoryRecordSessionKey(record));
                } else {
                    stopwatchTodaySec += todaySec;
                }
                distractionCount += Math.max(0, Math.round(toNumber(record?.distractionCount, 0)));
                addGroupRecord(dayGroups, task, record, todaySec, win.focusDayEnd);
            }

            const rangeSec = getHistoryRecordOverlapSeconds(record, win.rangeStart, win.rangeEnd);
            if (rangeSec <= 0) return;
            addGroupRecord(groups, task, record, rangeSec, win.rangeEnd);
        });

        const mapFocusGroupItems = (map) => Array.from(map.values())
            .map((group) => {
                const plan = buildFocusTaskPlan(group.task, group, ctx);
                return {
                    id: group.id,
                    title: resolveTaskTitle(group.task),
                    doc: resolveTaskDoc(group.task),
                    lastText: formatRecentFocusTime(group.lastMs, win.todayKey),
                    lastMs: group.lastMs,
                    planText: plan.text,
                    planEmpty: plan.empty,
                    totalSec: group.totalSec,
                };
            })
            .sort((a, b) => {
                if (b.lastMs !== a.lastMs) return b.lastMs - a.lastMs;
                return b.totalSec - a.totalSec;
            });
        const recentItems = mapFocusGroupItems(groups).slice(0, 5);
        const dayAllItems = mapFocusGroupItems(dayGroups);
        const dayPageSize = 5;
        const dayTotalPages = Math.max(1, Math.ceil(dayAllItems.length / dayPageSize));
        const dayPage = Math.max(0, Math.min(dayTotalPages - 1, Math.round(toNumber(runtime.focusDayPage, 0))));
        if (Math.round(toNumber(runtime.focusDayPage, 0)) !== dayPage) runtime.focusDayPage = dayPage;
        const dayItems = dayAllItems.slice(dayPage * dayPageSize, (dayPage + 1) * dayPageSize);

        const totalTodayMinutes = totalTodaySec / 60;
        return {
            rangeDays: win.rangeDays,
            focusDate: {
                key: win.focusDateKey,
                offset: win.focusDateOffset,
                isToday: win.focusDateOffset === 0,
                canGoNext: win.focusDateOffset < 0,
            },
            today: {
                totalMinutes: totalTodayMinutes,
                countdownMinutes: countdownTodaySec / 60,
                stopwatchMinutes: stopwatchTodaySec / 60,
                pomodoroCount: todayPomodoroSessions.size,
                distractionCount,
                targetMinutes,
                progressPct: targetMinutes > 0 ? Math.min(100, Math.round((totalTodayMinutes / targetMinutes) * 100)) : 0,
            },
            taskListMode: runtime.focusTaskListMode === "day" ? "day" : "recent",
            dayItems,
            dayTotalItems: dayAllItems.length,
            dayPage,
            dayPageSize,
            dayTotalPages,
            recentItems,
        };
    }

    function flattenTasks(items, out = [], seen = new Set()) {
        (Array.isArray(items) ? items : []).forEach((item) => {
            if (!item || typeof item !== "object") return;
            const id = String(item.id || "").trim();
            if (id && seen.has(id)) return;
            if (id) seen.add(id);
            out.push(item);
            if (Array.isArray(item.children) && item.children.length) flattenTasks(item.children, out, seen);
        });
        return out;
    }

    function buildTaskRelationIndex(tasks) {
        const byId = new Map();
        const parentById = new Map();
        const seenObjects = new Set();
        const visit = (task, parentId = "") => {
            if (!task || typeof task !== "object") return;
            if (seenObjects.has(task)) return;
            seenObjects.add(task);
            const id = String(task.id || "").trim();
            const explicitParentId = String(task.parentTaskId || task.parent_task_id || "").trim();
            const resolvedParentId = explicitParentId || String(parentId || "").trim();
            if (id) {
                if (!byId.has(id)) byId.set(id, task);
                if (resolvedParentId && resolvedParentId !== id && !parentById.has(id)) parentById.set(id, resolvedParentId);
            }
            const childParentId = id || resolvedParentId;
            if (Array.isArray(task.children) && task.children.length) {
                task.children.forEach((child) => visit(child, childParentId));
            }
        };
        (Array.isArray(tasks) ? tasks : []).forEach((task) => visit(task));
        return { byId, parentById };
    }

    function hasDoneParentTask(task, relationIndex, memo = new Map()) {
        if (!task || typeof task !== "object") return false;
        const index = relationIndex && typeof relationIndex === "object" ? relationIndex : {};
        const byId = index.byId instanceof Map ? index.byId : new Map();
        const parentById = index.parentById instanceof Map ? index.parentById : new Map();
        const taskId = String(task.id || "").trim();
        if (taskId && memo.has(taskId)) return memo.get(taskId) === true;
        const checkedIds = [];
        const visited = new Set();
        let parentId = String(task.parentTaskId || task.parent_task_id || "").trim() || (taskId ? (parentById.get(taskId) || "") : "");
        while (parentId) {
            if (visited.has(parentId)) break;
            visited.add(parentId);
            checkedIds.push(parentId);
            const parent = byId.get(parentId);
            if (!parent || typeof parent !== "object") break;
            if (parent.done) {
                checkedIds.forEach((id) => memo.set(id, true));
                if (taskId) memo.set(taskId, true);
                return true;
            }
            if (memo.get(parentId) === true) {
                if (taskId) memo.set(taskId, true);
                return true;
            }
            parentId = String(parent.parentTaskId || parent.parent_task_id || "").trim() || (parentById.get(parentId) || "");
        }
        if (taskId) memo.set(taskId, false);
        return false;
    }

    function resolveTaskTitle(task) {
        return String(task?.content || task?.title || task?.name || task?.raw_content || "").trim() || "未命名任务";
    }

    function resolveTaskDoc(task) {
        return String(task?.doc_name || task?.docName || task?.root_name || task?.groupName || "").trim() || "未命名文档";
    }

    function resolveTaskDoneValue(task) {
        return String(
            readHomepageConfiguredTaskCompleteAt(task)
            || task?.["custom-task-complete-at"]
            || task?.taskCompleteAt
            || task?.task_complete_at
            || task?.completedAt
            || task?.updated
            || task?.updatedAt
            || task?.completionTime
            || ""
        ).trim();
    }

    function resolveTaskDoneTs(task) {
        const raw = resolveTaskDoneValue(task);
        if (!raw) return 0;
        const ts = new Date(raw).getTime();
        if (Number.isFinite(ts) && ts > 0) return ts;
        const key = normalizeDateKey(raw);
        const dt = buildDateFromKey(key);
        return dt instanceof Date ? dt.getTime() : 0;
    }

    function resolveTaskDoneKey(task) {
        return normalizeDateKey(resolveTaskDoneValue(task));
    }

    function resolveTaskDoneMetricValue(task) {
        return String(
            readHomepageConfiguredTaskCompleteAt(task)
            || task?.["custom-task-complete-at"]
            || task?.taskCompleteAt
            || task?.task_complete_at
            || task?.updated
            || task?.updatedAt
            || task?.completedAt
            || ""
        ).trim();
    }

    function resolveTaskDoneMetricKey(task) {
        return normalizeDateKey(resolveTaskDoneMetricValue(task));
    }

    function resolveTaskDueKey(task) {
        return normalizeDateKey(
            task?.completionTime
            || task?.completion_time
            || readHomepageConfiguredCompletionTime(task)
            || task?.["custom-completion-time"]
            || ""
        );
    }

    function resolveTaskStatus(task) {
        if (task?.done) return "已完成";
        const raw = String(task?.customStatus || task?.status || "").trim();
        return raw || "待办";
    }

    function resolveTaskPriority(task) {
        const raw = String(task?.priority || "").trim().toLowerCase();
        if (raw === "high") return "高优先级";
        if (raw === "medium") return "中优先级";
        if (raw === "low") return "低优先级";
        return "";
    }

    function resolveProfile(ctx) {
        const width = toNumber(ctx?.containerWidth, 0);
        if (ctx?.isDockHost) return "dock";
        if (ctx?.hostUsesMobileUI || ctx?.isMobileDevice || (width > 0 && width < 760)) return "mobile";
        if (width > 0 && width < 1120) return "dock";
        return "desktop";
    }

    function getLayoutMetrics(ctx, profile) {
        const containerWidth = Math.max(320, toNumber(ctx?.containerWidth, 0) || 320);
        const shellPadding = profile === "mobile" ? 24 : 32;
        const contentWidth = Math.max(280, containerWidth - shellPadding);
        const gridGap = profile === "mobile" ? 12 : 12;
        const singleCardWidth = Math.max(240, contentWidth - 32);
        const doubleCardWidth = profile === "desktop"
            ? Math.max(240, Math.floor((contentWidth - gridGap) / 2) - 16)
            : singleCardWidth;
        return {
            containerWidth,
            contentWidth,
            trendWidth: Math.max(360, contentWidth - 16),
            trendNarrowWidth: Math.max(320, doubleCardWidth),
            heatmapWidth: doubleCardWidth,
        };
    }

    function isFutureDateKey(key, todayKey) {
        const normalized = normalizeDateKey(key);
        const today = normalizeDateKey(todayKey);
        if (!normalized || !today) return false;
        return dayDiff(today, normalized) > 0;
    }

    function buildTrend(tasks, todayKey, rangeDays) {
        const doneMap = new Map();
        const days = [];
        for (let i = rangeDays - 1; i >= 0; i -= 1) days.push(shiftDateKey(todayKey, -i));
        const allowKeys = new Set(days);
        tasks.forEach((task) => {
            if (!task?.done) return;
            const key = resolveTaskDoneMetricKey(task);
            if (!key || isFutureDateKey(key, todayKey) || !allowKeys.has(key)) return;
            doneMap.set(key, (doneMap.get(key) || 0) + 1);
        });
        const points = days.map((key, index) => ({
            key,
            label: formatShortDate(key),
            value: doneMap.get(key) || 0,
            index,
        }));
        return {
            points,
            maxValue: Math.max(1, ...points.map((point) => point.value)),
        };
    }

    function buildStreak(tasks, todayKey) {
        const doneSet = new Set();
        tasks.forEach((task) => {
            if (!task?.done) return;
            const key = resolveTaskDoneMetricKey(task);
            if (key && !isFutureDateKey(key, todayKey)) doneSet.add(key);
        });
        let streak = 0;
        // 连续完成按“上一天”为统计截止点，避免今天还没结束时提前拉长 streak。
        let cursor = shiftDateKey(todayKey, -1);
        while (doneSet.has(cursor)) {
            streak += 1;
            cursor = shiftDateKey(cursor, -1);
        }
        return streak;
    }

    function buildHeatmap(tasks, todayKey, ctx, profile) {
        const doneMap = new Map();
        tasks.forEach((task) => {
            if (!task?.done) return;
            const key = resolveTaskDoneMetricKey(task);
            if (!key || isFutureDateKey(key, todayKey)) return;
            doneMap.set(key, (doneMap.get(key) || 0) + 1);
        });

        const maxCount = Math.max(1, ...Array.from(doneMap.values(), (value) => Number(value) || 0));
        const cellSize = profile === "mobile" ? 14 : (profile === "dock" ? 16 : 17);
        const gapSize = profile === "mobile" ? 5 : 6;
        const monthCols = profile === "mobile" ? 3 : 4;
        const monthCount = 12;
        const today = buildDateFromKey(todayKey) || new Date();
        let maxVisibleDays = 1;
        for (let offset = monthCount - 1; offset >= 0; offset -= 1) {
            const probe = new Date(today.getFullYear(), today.getMonth() - offset, 1, 12, 0, 0, 0);
            const daysInMonth = new Date(probe.getFullYear(), probe.getMonth() + 1, 0).getDate();
            const isCurrentMonth = probe.getFullYear() === today.getFullYear() && probe.getMonth() === today.getMonth();
            const visibleDays = isCurrentMonth ? Math.min(daysInMonth, today.getDate()) : daysInMonth;
            maxVisibleDays = Math.max(maxVisibleDays, visibleDays);
        }
        const sharedRows = Math.max(1, Math.ceil(maxVisibleDays / monthCols));
        const months = [];
        for (let offset = monthCount - 1; offset >= 0; offset -= 1) {
            const dt = new Date(today.getFullYear(), today.getMonth() - offset, 1, 12, 0, 0, 0);
            const y = dt.getFullYear();
            const m = dt.getMonth();
            const daysInMonth = new Date(y, m + 1, 0).getDate();
            const isCurrentMonth = y === today.getFullYear() && m === today.getMonth();
            const visibleDays = isCurrentMonth ? Math.min(daysInMonth, today.getDate()) : daysInMonth;
            const cells = [];
            for (let day = 1; day <= visibleDays; day += 1) {
                const key = formatDateKey(new Date(y, m, day, 12, 0, 0, 0));
                const count = doneMap.get(key) || 0;
                let level = 0;
                if (count > 0) level = Math.min(4, Math.max(1, Math.ceil((count / maxCount) * 4)));
                cells.push({ key, count, level, day });
            }
            months.push({
                key: `${y}-${String(m + 1).padStart(2, "0")}`,
                label: `${m + 1}月`,
                rows: sharedRows,
                cells,
            });
        }
        return {
            months,
            cellSize,
            gapSize,
            monthCols,
            monthCount,
            maxCount,
        };
    }

    function buildDistribution(tasks) {
        const docMap = new Map();
        tasks.forEach((task) => {
            if (task?.done) return;
            const doc = resolveTaskDoc(task);
            docMap.set(doc, (docMap.get(doc) || 0) + 1);
        });
        const docItems = Array.from(docMap.entries())
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
        return { title: "文档分布", items: docItems };
    }

    function buildRecentDone(tasks, todayKey) {
        return tasks
            .filter((task) => !!task?.done)
            .map((task) => ({
                id: String(task?.id || "").trim(),
                title: resolveTaskTitle(task),
                doc: resolveTaskDoc(task),
                dateKey: resolveTaskDoneKey(task),
                doneTs: resolveTaskDoneTs(task),
            }))
            .filter((item) => item.dateKey && !isFutureDateKey(item.dateKey, todayKey))
            .sort((a, b) => {
                if (b.doneTs !== a.doneTs) return b.doneTs - a.doneTs;
                return dayDiff(a.dateKey, b.dateKey);
            })
            .slice(0, 6);
    }

    function buildRiskList(tasks, todayKey, relationIndex = null) {
        const doneParentMemo = new Map();
        return tasks
            .filter((task) => !task?.done)
            .filter((task) => !hasDoneParentTask(task, relationIndex, doneParentMemo))
            .map((task) => {
                const dueKey = resolveTaskDueKey(task);
                if (!dueKey) return null;
                const diff = dayDiff(todayKey, dueKey);
                if (diff > 7) return null;
                return {
                    id: String(task?.id || "").trim(),
                    title: resolveTaskTitle(task),
                    doc: resolveTaskDoc(task),
                    dateKey: dueKey,
                    diffDays: diff,
                    priority: resolveTaskPriority(task),
                };
            })
            .filter(Boolean)
            .sort((a, b) => {
                if (a.diffDays !== b.diffDays) return a.diffDays - b.diffDays;
                if (!!a.priority !== !!b.priority) return a.priority ? -1 : 1;
                return String(a.title || "").localeCompare(String(b.title || ""), "zh-CN");
            })
            .slice(0, 6);
    }

    function getProcrastinationLevel(score) {
        const value = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
        if (value >= 75) return "爆红";
        if (value >= 50) return "高风险";
        if (value >= 25) return "注意";
        return "健康";
    }

    function normalizeProcrastinationMetrics(metrics, fallback = {}) {
        const source = (metrics && typeof metrics === "object") ? metrics : {};
        const base = (fallback && typeof fallback === "object") ? fallback : {};
        const score = Math.max(0, Math.min(100, Math.round(toNumber(source.score, base.score || 0))));
        const dueTaskCount = Math.max(0, Math.round(toNumber(source.dueTaskCount, base.dueTaskCount || 0)));
        const overdueCount = Math.max(0, Math.round(toNumber(source.overdueCount, base.overdueCount || 0)));
        const fallbackOverduePercent = dueTaskCount > 0 ? (overdueCount / dueTaskCount) * 100 : 0;
        const overduePercent = Math.max(0, Math.min(100, Math.round(toNumber(
            source.overduePercent,
            toNumber(base.overduePercent, fallbackOverduePercent),
        ))));
        return {
            score,
            level: String(source.level || base.level || "").trim(),
            levelLabel: String(source.levelLabel || base.levelLabel || getProcrastinationLevel(score)).trim(),
            dueTaskCount,
            overdueCount,
            overduePercent,
            penaltyCount: Math.max(0, Math.round(toNumber(source.penaltyCount, base.penaltyCount || 0))),
            penaltyEnabled: source.penaltyEnabled === false || base.penaltyEnabled === false ? false : true,
            rescheduleCount: Math.max(0, Math.round(toNumber(source.rescheduleCount, base.rescheduleCount || 0))),
            windowDays: Math.max(1, Math.round(toNumber(source.windowDays, base.windowDays || 30))),
        };
    }

    function buildProcrastinationRowStyle(score) {
        const value = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
        const bgMix = value < 50
            ? Math.max(0, Math.min(3, Math.round(value * 0.06)))
            : Math.max(8, Math.min(24, Math.round(8 + (value - 50) * 0.32)));
        const borderMix = value < 50
            ? Math.max(0, Math.min(8, Math.round(value * 0.16)))
            : Math.max(18, Math.min(54, Math.round(18 + (value - 50) * 0.72)));
        const textMix = value < 50
            ? Math.max(0, Math.min(16, Math.round(value * 0.32)))
            : Math.max(34, Math.min(92, Math.round(34 + (value - 50) * 1.16)));
        return `--tm-home-procrastination-bg-mix:${bgMix}%;--tm-home-procrastination-border-mix:${borderMix}%;--tm-home-procrastination-text-mix:${textMix}%;`;
    }

    function formatProcrastinationNote(metrics) {
        const item = normalizeProcrastinationMetrics(metrics);
        const parts = [
            `逾期 ${item.overduePercent}%（${item.overdueCount}/${item.dueTaskCount}）`,
            item.penaltyEnabled ? `扣分 ${item.penaltyCount}` : "",
            `推迟 ${item.rescheduleCount}`,
        ].filter(Boolean);
        return `${item.levelLabel} · ${parts.join("，")}`;
    }

    function buildOverview(ctx) {
        const todayKey = normalizeDateKey(ctx?.todayKey) || formatDateKey(new Date());
        const tasks = flattenTasks(ctx?.tasks || []);
        const relationIndex = buildTaskRelationIndex(tasks);
        const trend = buildTrend(tasks, todayKey, runtime.rangeDays);
        const weekDone = buildTrend(tasks, todayKey, 7).points.reduce((sum, point) => sum + point.value, 0);
        const overdue = tasks.filter((task) => !task?.done && resolveTaskDueKey(task) && dayDiff(todayKey, resolveTaskDueKey(task)) < 0).length;
        const overdueCount = tasks.filter((task) => !task?.done && resolveTaskDueKey(task) && dayDiff(todayKey, resolveTaskDueKey(task)) < 0).length;
        const doneCount = tasks.filter((task) => !!task?.done).length;
        const pendingCount = Math.max(0, tasks.length - doneCount - overdueCount);
        const completionRate = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
        const procrastinationDoneParentMemo = new Map();
        let procrastinationDueTaskCount = 0;
        let procrastinationOverdueCount = 0;
        tasks.forEach((task) => {
            if (!task || task.done) return;
            if (hasDoneParentTask(task, relationIndex, procrastinationDoneParentMemo)) return;
            const dueKey = resolveTaskDueKey(task);
            if (!dueKey) return;
            procrastinationDueTaskCount += 1;
            if (dayDiff(todayKey, dueKey) < 0) procrastinationOverdueCount += 1;
        });
        const overdueRatio = procrastinationDueTaskCount > 0
            ? Math.max(0, Math.min(1, procrastinationOverdueCount / procrastinationDueTaskCount))
            : 0;
        const fallbackProcrastination = {
            score: Math.round(overdueRatio * 100),
            dueTaskCount: procrastinationDueTaskCount,
            overdueCount: procrastinationOverdueCount,
            overduePercent: Math.round(overdueRatio * 100),
            penaltyCount: 0,
            penaltyEnabled: false,
            rescheduleCount: 0,
            windowDays: 30,
        };
        let rawProcrastination = (ctx?.procrastinationMetrics && typeof ctx.procrastinationMetrics === "object")
            ? ctx.procrastinationMetrics
            : null;
        if (!rawProcrastination && typeof globalThis.__tmGetProcrastinationMetricsForTasks === "function") {
            try { rawProcrastination = globalThis.__tmGetProcrastinationMetricsForTasks(tasks, { todayKey }); } catch (e) { rawProcrastination = null; }
        }
        const procrastination = normalizeProcrastinationMetrics(rawProcrastination, fallbackProcrastination);
        const streak = buildStreak(tasks, todayKey);
        const profile = resolveProfile(ctx);
        const scopeLabel = String(ctx?.currentDocName || ctx?.currentGroupName || "当前范围").trim() || "当前范围";
        const rangeDone = trend.points.reduce((sum, point) => sum + (Number(point?.value) || 0), 0);
        const subtitleParts = [];
        if (rangeDone > 0) subtitleParts.push(`近 ${runtime.rangeDays} 天完成 ${rangeDone} 项`);
        if (overdue > 0) subtitleParts.push(`逾期 ${overdue} 项`);
        return {
            tasks,
            trend,
            heatmap: buildHeatmap(tasks, todayKey, ctx, profile),
            distribution: buildDistribution(tasks),
            recentDone: buildRecentDone(tasks, todayKey),
            riskList: buildRiskList(tasks, todayKey, relationIndex),
            procrastination,
            title: `主页 - ${scopeLabel}`,
            subtitle: subtitleParts.length
                ? subtitleParts.join("，")
                : `近 ${runtime.rangeDays} 天暂时没有完成记录`,
            kpis: {
                todayDone: trend.points.length ? trend.points[trend.points.length - 1].value : 0,
                weekDone,
                overdue,
                total: tasks.length,
                doneCount,
                overdueCount,
                pendingCount,
                completionRate,
                streak,
                procrastination,
            },
        };
    }

    function buildGaugeSegments(overview) {
        const total = Math.max(1, Number(overview?.kpis?.total) || 0);
        return [
            {
                key: "done",
                label: "已完成",
                value: Number(overview?.kpis?.doneCount) || 0,
                pct: total > 0 ? Math.round(((Number(overview?.kpis?.doneCount) || 0) / total) * 100) : 0,
                tone: "is-accent",
            },
            {
                key: "overdue",
                label: "已过期",
                value: Number(overview?.kpis?.overdueCount) || 0,
                pct: total > 0 ? Math.round(((Number(overview?.kpis?.overdueCount) || 0) / total) * 100) : 0,
                tone: "is-warning",
            },
            {
                key: "pending",
                label: "未完成",
                value: Number(overview?.kpis?.pendingCount) || 0,
                pct: total > 0 ? Math.round(((Number(overview?.kpis?.pendingCount) || 0) / total) * 100) : 0,
                tone: "is-success",
            },
        ];
    }

    function buildTrendSummary(trend) {
        const points = Array.isArray(trend?.points) ? trend.points.slice() : [];
        if (!points.length) {
            return {
                pointCount: 0,
                total: 0,
                average: 0,
                last: { label: "", value: 0 },
                peak: { label: "", value: 0 },
            };
        }
        const total = points.reduce((sum, point) => sum + (Number(point?.value) || 0), 0);
        const last = points[points.length - 1] || { label: "", value: 0 };
        const peak = points.reduce((best, point) => {
            if (!best) return point;
            return (Number(point?.value) || 0) > (Number(best?.value) || 0) ? point : best;
        }, null) || { label: "", value: 0 };
        return {
            pointCount: points.length,
            total,
            average: points.length ? total / points.length : 0,
            last: { label: last.label || "", value: Number(last.value) || 0 },
            peak: { label: peak.label || "", value: Number(peak.value) || 0 },
        };
    }

    function getTrendAxisStep(pointCount) {
        const count = Math.max(0, Number(pointCount) || 0);
        if (count <= 14) return 1;
        if (count <= 35) return 5;
        if (count <= 70) return 7;
        return 10;
    }

    function renderTrendAxis(trend) {
        const points = Array.isArray(trend?.points) ? trend.points.slice() : [];
        if (!points.length) return "";
        const lastIndex = points.length - 1;
        const step = getTrendAxisStep(points.length);
        return `
            <div class="tm-homepage-trend-axis" style="--tm-home-trend-days:${points.length};">
                ${points.map((point, index) => {
                    const showDate = ((lastIndex - index) % step === 0) || index === 0 || index === lastIndex;
                    return `
                    <div class="tm-homepage-trend-axis-item" aria-label="${esc(`${point.label} 完成 ${Number(point.value) || 0} 项`)}">
                        <span class="tm-homepage-trend-axis-value ${(Number(point.value) || 0) > 0 ? "" : "is-empty"}">${(Number(point.value) || 0) > 0 ? Number(point.value) || 0 : ""}</span>
                        <span class="tm-homepage-trend-axis-date ${showDate ? "" : "is-empty"}">${showDate ? esc(point.label || "") : ""}</span>
                    </div>
                `;
                }).join("")}
            </div>
        `;
    }

    function buildSmoothSvgPath(points) {
        const list = Array.isArray(points) ? points : [];
        if (!list.length) return "";
        if (list.length === 1) return `M ${list[0].x} ${list[0].y}`;
        if (list.length === 2) return `M ${list[0].x} ${list[0].y} L ${list[1].x} ${list[1].y}`;
        let path = `M ${list[0].x} ${list[0].y}`;
        for (let i = 0; i < list.length - 1; i += 1) {
            const p0 = list[i - 1] || list[i];
            const p1 = list[i];
            const p2 = list[i + 1];
            const p3 = list[i + 2] || p2;
            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            let cp1y = p1.y + (p2.y - p0.y) / 6;
            let cp2y = p2.y - (p3.y - p1.y) / 6;
            const minY = Math.min(p1.y, p2.y);
            const maxY = Math.max(p1.y, p2.y);
            const p1Value = Number(p1?.value) || 0;
            const p2Value = Number(p2?.value) || 0;

            // Clamp control points to the current segment range to avoid overshooting
            // below the baseline or above the peak.
            cp1y = Math.max(minY, Math.min(maxY, cp1y));
            cp2y = Math.max(minY, Math.min(maxY, cp2y));

            // When the line touches zero, keep the tangent pinned to the baseline so it
            // flattens into the axis instead of forming a rounded bowl near y=0.
            if (p1Value <= 0) cp1y = p1.y;
            if (p2Value <= 0) cp2y = p2.y;

            path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
        }
        return path;
    }

    function renderRangeSwitch() {
        const rangeOptions = [7, 30, 90];
        return `
            <div class="tm-homepage-range-switch" role="tablist" aria-label="趋势范围">
                ${rangeOptions.map((days) => `<button type="button" class="tm-homepage-range-btn ${runtime.rangeDays === days ? "is-active" : ""}" data-tm-home-range="${days}">${days} 天</button>`).join("")}
            </div>
        `;
    }

    function renderHomepageSettings() {
        const order = readHomepageModuleOrder();
        const open = runtime.homepageSettingsOpen === true;
        return `
            <div class="tm-homepage-settings">
                <button type="button" class="tm-homepage-settings-btn ${open ? "is-active" : ""}" data-tm-home-settings-toggle="1" aria-label="主页模块排序" aria-expanded="${open ? "true" : "false"}">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
                        <path d="M128,76a52,52,0,1,0,52,52A52.06,52.06,0,0,0,128,76Zm0,80a28,28,0,1,1,28-28A28,28,0,0,1,128,156Zm113.86-49.57A12,12,0,0,0,236,98.34L208.21,82.49l-.11-31.31a12,12,0,0,0-4.25-9.12,116,116,0,0,0-38-21.41,12,12,0,0,0-9.68.89L128,37.27,99.83,21.53a12,12,0,0,0-9.7-.9,116.06,116.06,0,0,0-38,21.47,12,12,0,0,0-4.24,9.1l-.14,31.34L20,98.35a12,12,0,0,0-5.85,8.11,110.7,110.7,0,0,0,0,43.11A12,12,0,0,0,20,157.66l27.82,15.85.11,31.31a12,12,0,0,0,4.25,9.12,116,116,0,0,0,38,21.41,12,12,0,0,0,9.68-.89L128,218.73l28.14,15.74a12,12,0,0,0,9.7.9,116.06,116.06,0,0,0,38-21.47,12,12,0,0,0,4.24-9.1l.14-31.34,27.81-15.81a12,12,0,0,0,5.85-8.11A110.7,110.7,0,0,0,241.86,106.43Zm-22.63,33.18-26.88,15.28a11.94,11.94,0,0,0-4.55,4.59c-.54,1-1.11,1.93-1.7,2.88a12,12,0,0,0-1.83,6.31L184.13,199a91.83,91.83,0,0,1-21.07,11.87l-27.15-15.19a12,12,0,0,0-5.86-1.53h-.29c-1.14,0-2.3,0-3.44,0a12.08,12.08,0,0,0-6.14,1.51L93,210.82A92.27,92.27,0,0,1,71.88,199l-.11-30.24a12,12,0,0,0-1.83-6.32c-.58-.94-1.16-1.91-1.7-2.88A11.92,11.92,0,0,0,63.7,155L36.8,139.63a86.53,86.53,0,0,1,0-23.24l26.88-15.28a12,12,0,0,0,4.55-4.58c.54-1,1.11-1.94,1.7-2.89a12,12,0,0,0,1.83-6.31L71.87,57A91.83,91.83,0,0,1,92.94,45.17l27.15,15.19a11.92,11.92,0,0,0,6.15,1.52c1.14,0,2.3,0,3.44,0a12.08,12.08,0,0,0,6.14-1.51L163,45.18A92.27,92.27,0,0,1,184.12,57l.11,30.24a12,12,0,0,0,1.83,6.32c.58.94,1.16,1.91,1.7,2.88A11.92,11.92,0,0,0,192.3,101l26.9,15.33A86.53,86.53,0,0,1,219.23,139.61Z"></path>
                    </svg>
                </button>
                ${open ? `
                    <div class="tm-homepage-settings-panel" role="dialog" aria-label="主页模块排序设置">
                        <div class="tm-homepage-settings-head">
                            <div class="tm-homepage-settings-title">模块排序</div>
                            <button type="button" class="tm-homepage-module-reset-btn" data-tm-home-module-reset="1">重置</button>
                        </div>
                        <div class="tm-homepage-module-order-list">
                            ${order.map((id, index) => {
                                const def = HOMEPAGE_MODULE_DEF_BY_ID[id];
                                if (!def) return "";
                                const supportsLayout = id === "trend" || id === "focus";
                                const moduleLayout = id === "trend" ? getHomepageTrendLayout() : (id === "focus" ? getHomepageFocusLayout() : "");
                                const layoutSwitch = supportsLayout ? `
                                    <div class="tm-homepage-module-layout-switch" aria-label="${esc(`${def.label}布局`)}">
                                        <button type="button" class="tm-homepage-module-layout-btn ${moduleLayout !== "narrow" ? "is-active" : ""}" data-tm-home-module-id="${esc(id)}" data-tm-home-module-layout="wide">宽版</button>
                                        <button type="button" class="tm-homepage-module-layout-btn ${moduleLayout === "narrow" ? "is-active" : ""}" data-tm-home-module-id="${esc(id)}" data-tm-home-module-layout="narrow">窄版</button>
                                    </div>
                                ` : "";
                                return `
                                    <div class="tm-homepage-module-order-item">
                                        <div class="tm-homepage-module-order-main">
                                            <div class="tm-homepage-module-order-label">${esc(def.label)}</div>
                                            <div class="tm-homepage-module-order-desc">${esc(def.desc)}</div>
                                        </div>
                                        <div class="tm-homepage-module-order-actions">
                                            ${layoutSwitch}
                                            <button type="button" class="tm-homepage-module-order-btn" data-tm-home-module-id="${esc(id)}" data-tm-home-module-move="-1" aria-label="${esc(`上移${def.label}`)}" ${index <= 0 ? "disabled" : ""}>↑</button>
                                            <button type="button" class="tm-homepage-module-order-btn" data-tm-home-module-id="${esc(id)}" data-tm-home-module-move="1" aria-label="${esc(`下移${def.label}`)}" ${index >= order.length - 1 ? "disabled" : ""}>↓</button>
                                        </div>
                                    </div>
                                `;
                            }).join("")}
                        </div>
                    </div>
                ` : ""}
            </div>
        `;
    }

    function updateHomepageSettingsSlot() {
        if (!(runtime.root instanceof HTMLElement)) return false;
        const slot = runtime.root.querySelector("[data-tm-home-settings-slot]");
        if (!(slot instanceof HTMLElement)) return false;
        slot.innerHTML = renderHomepageSettings();
        return true;
    }

    function buildTrendSvg(trend, ctx, profile, layout = "wide") {
        const rawPoints = Array.isArray(trend?.points) ? trend.points : [];
        if (!rawPoints.length) return `<div class="tm-homepage-chart-empty">暂无趋势数据</div>`;
        const points = rawPoints.slice();
        const metrics = getLayoutMetrics(ctx, profile);
        const isNarrow = String(layout || "").trim() === "narrow";
        const width = Math.max(isNarrow ? 320 : 360, Math.round(isNarrow ? metrics.trendNarrowWidth : metrics.trendWidth));
        const height = profile === "mobile" ? 142 : (profile === "dock" ? 156 : 170);
        const padding = { top: 14, right: 12, bottom: 8, left: 12 };
        const innerW = width - padding.left - padding.right;
        const innerH = height - padding.top - padding.bottom;
        const maxValue = Math.max(1, ...points.map((point) => Number(point?.value) || 0));
        const xOf = (index) => padding.left + (points.length <= 1 ? innerW / 2 : (innerW / (points.length - 1)) * index);
        const yOf = (value) => padding.top + innerH - ((Number(value) || 0) / maxValue) * innerH;
        const chartPoints = points.map((point, index) => ({
            x: xOf(index),
            y: yOf(point.value),
            label: point.label,
            value: point.value,
        }));
        const linePath = buildSmoothSvgPath(chartPoints);
        const baselineY = padding.top + innerH;
        const areaPath = chartPoints.length
            ? `M ${chartPoints[0].x} ${baselineY} L ${chartPoints[0].x} ${chartPoints[0].y} ${linePath.slice(1)} L ${chartPoints[chartPoints.length - 1].x} ${baselineY} Z`
            : "";
        const gridLines = [0, 0.5, 1].map((ratio) => {
            const y = padding.top + innerH * ratio;
            return `<line x1="${padding.left}" y1="${y}" x2="${padding.left + innerW}" y2="${y}" class="tm-homepage-trend-grid" />`;
        }).join("");
        const lastPoint = chartPoints[chartPoints.length - 1];
        const peakPoint = chartPoints.reduce((best, point) => {
            if (!best) return point;
            if (point.value > best.value) return point;
            return best;
        }, null);
        const markers = [
            peakPoint ? `<circle cx="${peakPoint.x}" cy="${peakPoint.y}" r="3.5" class="tm-homepage-trend-dot tm-homepage-trend-dot--peak"><title>${esc(`峰值 ${peakPoint.label}：${peakPoint.value}`)}</title></circle>` : "",
            lastPoint ? `<circle cx="${lastPoint.x}" cy="${lastPoint.y}" r="5.5" class="tm-homepage-trend-dot tm-homepage-trend-dot--last"><title>${esc(`最新 ${lastPoint.label}：${lastPoint.value}`)}</title></circle>` : "",
            lastPoint ? `<circle cx="${lastPoint.x}" cy="${lastPoint.y}" r="9" class="tm-homepage-trend-dot tm-homepage-trend-dot--last-ring"></circle>` : "",
        ].join("");
        return `
            <svg class="tm-homepage-trend-svg" viewBox="0 0 ${width} ${height}" aria-label="完成趋势">
                <defs>
                    <linearGradient id="tmHomepageTrendStroke" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" style="stop-color:color-mix(in srgb, var(--tm-home-accent) 68%, var(--tm-home-accent-soft-2));"></stop>
                        <stop offset="100%" style="stop-color:var(--tm-home-accent);"></stop>
                    </linearGradient>
                    <linearGradient id="tmHomepageTrendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" style="stop-color:color-mix(in srgb, var(--tm-home-accent) 16%, transparent);"></stop>
                        <stop offset="100%" style="stop-color:color-mix(in srgb, var(--tm-home-accent) 0%, transparent);"></stop>
                    </linearGradient>
                </defs>
                ${gridLines}
                <path d="${areaPath}" class="tm-homepage-trend-area"></path>
                <path d="${linePath}" class="tm-homepage-trend-line-glow"></path>
                <path d="${linePath}" class="tm-homepage-trend-line"></path>
                ${markers}
            </svg>
        `;
    }

    function renderHeatmap(heatmap) {
        const months = Array.isArray(heatmap?.months) ? heatmap.months : [];
        if (!months.length) return `<div class="tm-homepage-chart-empty">暂无热力图数据</div>`;
        return `
            <div class="tm-homepage-heatmap-shell" style="--tm-home-heatmap-cell:${Math.max(12, Number(heatmap?.cellSize) || 16)}px;--tm-home-heatmap-gap:${Math.max(4, Number(heatmap?.gapSize) || 5)}px;--tm-home-heatmap-month-cols:${Math.max(3, Number(heatmap?.monthCols) || 4)};">
                <div class="tm-homepage-heatmap-grid" role="img" aria-label="完成热力图">
                    ${months.map((month) => `
                    <div class="tm-homepage-heatmap-month">
                        <div class="tm-homepage-heatmap-month-label">${esc(month?.label || "")}</div>
                        <div class="tm-homepage-heatmap-month-grid" style="--tm-home-heatmap-month-rows:${Math.max(1, Number(month?.rows) || 1)};">
                            ${(Array.isArray(month?.cells) ? month.cells : []).map((cell) => `
                                <span class="tm-homepage-heatmap-cell tm-homepage-heatmap-cell--l${Number(cell?.level) || 0}${cell?.placeholder ? " tm-homepage-heatmap-cell--placeholder" : ""}"${cell?.placeholder ? ' aria-hidden="true"' : ` title="${esc(`${cell?.key || ""} · 完成 ${Number(cell?.count) || 0} 项`)}"`}></span>
                            `).join("")}
                        </div>
                    </div>
                `).join("")}
                </div>
            </div>
        `;
    }

    function renderHeatmapLegend() {
        return `
            <div class="tm-homepage-heatmap-legend" aria-hidden="true">
                <span class="tm-homepage-heatmap-legend-label">低</span>
                <span class="tm-homepage-heatmap-cell tm-homepage-heatmap-cell--l0"></span>
                <span class="tm-homepage-heatmap-cell tm-homepage-heatmap-cell--l1"></span>
                <span class="tm-homepage-heatmap-cell tm-homepage-heatmap-cell--l2"></span>
                <span class="tm-homepage-heatmap-cell tm-homepage-heatmap-cell--l3"></span>
                <span class="tm-homepage-heatmap-cell tm-homepage-heatmap-cell--l4"></span>
                <span class="tm-homepage-heatmap-legend-label">高</span>
            </div>
        `;
    }

    function renderDistribution(distribution) {
        const items = Array.isArray(distribution?.items) ? distribution.items : [];
        if (!items.length) return `<div class="tm-homepage-chart-empty">暂无分布数据</div>`;
        const maxValue = Math.max(1, ...items.map((item) => Number(item?.value) || 0));
        return `
            <div class="tm-homepage-distribution-list">
                ${items.map((item) => {
                    const value = Number(item?.value) || 0;
                    const width = Math.max(6, Math.round((value / maxValue) * 100));
                    return `
                        <div class="tm-homepage-distribution-item">
                            <div class="tm-homepage-distribution-meta">
                                <span class="tm-homepage-distribution-label">${esc(item?.label || "")}</span>
                                <span class="tm-homepage-distribution-value">${value}</span>
                            </div>
                            <div class="tm-homepage-distribution-track"><span class="tm-homepage-distribution-bar" style="width:${width}%;"></span></div>
                        </div>
                    `;
                }).join("")}
            </div>
        `;
    }

    function renderTaskList(list, emptyText, kind) {
        const items = Array.isArray(list) ? list : [];
        if (!items.length) return `<div class="tm-homepage-list-empty">${esc(emptyText)}</div>`;
        return `
            <div class="tm-homepage-list">
                ${items.map((item) => {
                    const meta = kind === "risk"
                        ? (item.diffDays < 0 ? `逾期 ${Math.abs(item.diffDays)} 天` : (item.diffDays === 0 ? "今天到期" : `${item.diffDays} 天后到期`))
                        : formatListDate(item.dateKey);
                    const badge = kind === "risk"
                        ? `<span class="tm-homepage-list-badge ${item.diffDays < 0 ? "is-danger" : "is-warning"}">${esc(meta)}</span>`
                        : `<span class="tm-homepage-list-date">${esc(meta)}</span>`;
                    return `
                        <button type="button" class="tm-homepage-list-item" data-tm-home-open-task="${esc(item.id || "")}">
                            <span class="tm-homepage-list-main">
                                <span class="tm-homepage-list-title">${esc(item.title || "")}</span>
                                <span class="tm-homepage-list-doc">${esc(item.doc || "")}${item.priority ? ` · ${esc(item.priority)}` : ""}</span>
                            </span>
                            <span class="tm-homepage-list-side">${badge}</span>
                        </button>
                    `;
                }).join("")}
            </div>
        `;
    }

    function renderOverviewGauge(overview) {
        const segments = buildGaugeSegments(overview);
        const completionRate = Number(overview?.kpis?.completionRate) || 0;
        return `
            <section class="tm-homepage-card tm-homepage-card--overview">
                <div class="tm-homepage-card-head">
                    <div>
                        <div class="tm-homepage-card-title">任务状态</div>
                        <div class="tm-homepage-card-desc">完成、逾期、未完成占比</div>
                    </div>
                    <div class="tm-homepage-overview-rate">完成率 ${completionRate}%</div>
                </div>
                <div class="tm-homepage-overview-summary">
                    <div class="tm-homepage-overview-total">
                        <div class="tm-homepage-overview-total-label">总任务</div>
                        <div class="tm-homepage-overview-total-value">${Number(overview?.kpis?.total) || 0}</div>
                    </div>
                    <div class="tm-homepage-overview-bar-wrap">
                        <div class="tm-homepage-overview-bar" aria-label="任务状态概览">
                            ${segments.map((segment) => `<span class="tm-homepage-overview-bar-seg ${segment.tone}" style="width:${Math.max((segment.value > 0 ? 8 : 0), Number(segment.pct) || 0)}%;"></span>`).join("")}
                        </div>
                    </div>
                </div>
                <div class="tm-homepage-overview-stats">
                    ${segments.map((segment) => `
                        <div class="tm-homepage-overview-stat">
                            <div class="tm-homepage-overview-stat-label"><span class="tm-homepage-overview-dot ${segment.tone}"></span>${esc(segment.label)}</div>
                            <div class="tm-homepage-overview-stat-main">
                                <div class="tm-homepage-overview-stat-value">${segment.value}</div>
                                <div class="tm-homepage-overview-stat-sub">${segment.pct}%</div>
                            </div>
                        </div>
                    `).join("")}
                </div>
            </section>
        `;
    }

    function renderSummaryCard(overview) {
        const procrastination = normalizeProcrastinationMetrics(overview?.procrastination || overview?.kpis?.procrastination);
        const rows = [
            {
                label: "连续完成",
                value: Number(overview?.kpis?.streak) || 0,
                unit: "天",
                note: Number(overview?.kpis?.streak) > 0 ? "最近保持连续完成" : "最近还没有形成连续完成",
                tone: Number(overview?.kpis?.streak) > 0 ? "is-success" : "",
            },
            {
                label: "拖延值",
                value: procrastination.score,
                unit: "",
                note: formatProcrastinationNote(procrastination),
                tone: "is-procrastination",
                style: buildProcrastinationRowStyle(procrastination.score),
            },
        ];
        return `
            <section class="tm-homepage-card tm-homepage-card--summary">
                <div class="tm-homepage-card-head">
                    <div>
                        <div class="tm-homepage-card-title">完成摘要</div>
                        <div class="tm-homepage-card-desc">先看今天，再看连续性和拖延值</div>
                    </div>
                </div>
                <div class="tm-homepage-summary-layout">
                    <article class="tm-homepage-summary-main">
                        <div class="tm-homepage-summary-main-label">今日完成</div>
                        <div class="tm-homepage-summary-main-value">${overview?.kpis?.todayDone || 0}</div>
                        <div class="tm-homepage-summary-main-note">最近一周累计 ${overview?.kpis?.weekDone || 0} 项</div>
                    </article>
                    <div class="tm-homepage-summary-list">
                        ${rows.map((item) => `
                            <div class="tm-homepage-summary-row ${item.tone}"${item.style ? ` style="${esc(item.style)}"` : ""}>
                                <div class="tm-homepage-summary-row-label">${esc(item.label)}</div>
                                <div class="tm-homepage-summary-row-value">
                                    <span class="tm-homepage-summary-row-number">${esc(item.value)}</span>
                                    ${item.unit ? `<span class="tm-homepage-summary-row-unit">${esc(item.unit)}</span>` : ""}
                                </div>
                                <div class="tm-homepage-summary-row-note">${esc(item.note)}</div>
                            </div>
                        `).join("")}
                    </div>
                </div>
            </section>
        `;
    }

    function renderFocusLoadingCard(text, layout = getHomepageFocusLayout()) {
        const dayScope = Math.min(0, Math.round(toNumber(runtime.focusDateOffset, 0))) === 0 ? "今日当前范围" : "当日当前范围";
        const message = esc(text || "正在读取番茄历史...");
        const isNarrow = String(layout || "").trim() === "narrow";
        return `
            <section class="tm-homepage-card tm-homepage-card--focus ${isNarrow ? "is-narrow" : ""}">
                <div class="tm-homepage-card-head">
                    <div>
                        <div class="tm-homepage-card-title">专注统计</div>
                        <div class="tm-homepage-card-desc">${isNarrow ? dayScope : `${dayScope} · 最近专注近 90 天`}</div>
                    </div>
                </div>
                <div class="tm-homepage-focus-grid">
                    <article class="tm-homepage-focus-panel tm-homepage-focus-panel--placeholder">
                        <div class="tm-homepage-focus-loading">${message}</div>
                    </article>
                    ${isNarrow ? "" : `<article class="tm-homepage-focus-panel tm-homepage-focus-panel--placeholder">
                        <div class="tm-homepage-focus-loading">${message}</div>
                    </article>`}
                </div>
            </section>
        `;
    }

    function renderFocusCalendar(stats) {
        const focusDate = stats?.focusDate || {};
        const ctx = runtime.ctx && typeof runtime.ctx === "object" ? runtime.ctx : {};
        const selectedKey = normalizeDateKey(focusDate.key) || getSelectedFocusDateKey(ctx);
        const month = getMonthBounds(runtime.focusCalendar?.monthKey || selectedKey.slice(0, 7));
        const todayKey = normalizeDateKey(ctx?.todayKey) || formatDateKey(new Date());
        const isCurrentMonth = month.key >= todayKey.slice(0, 7);
        const status = String(runtime.focusCalendar?.status || "idle");
        const records = (status === "loaded" && runtime.focusCalendar?.key === buildFocusCalendarKey(ctx, month.key))
            ? (Array.isArray(runtime.focusCalendar?.records) ? runtime.focusCalendar.records : [])
            : [];
        const dayMap = buildFocusDayMap(ctx, records, month.key);
        const calendarFirstDay = getCalendarFirstDay(ctx);
        const weekLabels = getCalendarWeekLabels(calendarFirstDay);
        const firstWeekday = (month.start.getDay() - calendarFirstDay + 7) % 7;
        const daysInMonth = Math.round((month.end.getTime() - month.start.getTime()) / 86400000);
        const cells = [];
        for (let i = 0; i < firstWeekday; i += 1) cells.push(`<span class="tm-homepage-focus-calendar-day is-empty"></span>`);
        for (let day = 1; day <= daysInMonth; day += 1) {
            const key = formatDateKey(new Date(month.start.getFullYear(), month.start.getMonth(), day, 12, 0, 0, 0));
            const meta = dayMap.get(key) || { minutes: 0, level: 0 };
            const isSelected = key === selectedKey;
            const isFuture = dayDiff(todayKey, key) > 0;
            const minutes = Math.round(toNumber(meta.minutes, 0));
            const level = Math.max(0, Math.min(4, Math.round(toNumber(meta.level, 0))));
            const cls = [
                "tm-homepage-focus-calendar-day",
                level > 0 ? "has-focus" : "",
                level > 0 ? `is-l${level}` : "",
                isSelected ? "is-selected" : "",
                isFuture ? "is-future" : "",
            ].filter(Boolean).join(" ");
            cells.push(`
                <button type="button" class="${cls}" data-tm-home-focus-calendar-date="${esc(key)}" title="${esc(minutes > 0 ? `${key} · 专注 ${minutes} 分钟` : `${key} · 暂无专注记录`)}">
                    ${day}
                </button>
            `);
        }
        const body = status === "loading" || status === "idle"
            ? `<div class="tm-homepage-focus-empty tm-homepage-focus-calendar-loading">正在读取本月专注记录...</div>`
            : (status === "error"
                ? `<div class="tm-homepage-focus-empty tm-homepage-focus-calendar-loading">本月专注记录暂不可用。</div>`
                : `
                    <div class="tm-homepage-focus-calendar-week">
                        ${weekLabels.map((label) => `<span>${esc(label)}</span>`).join("")}
                    </div>
                    <div class="tm-homepage-focus-calendar-grid">${cells.join("")}</div>
                `);
        return `
            <div class="tm-homepage-focus-calendar-popover">
                <div class="tm-homepage-focus-calendar-head">
                    <button type="button" class="tm-homepage-focus-day-btn" data-tm-home-focus-calendar-month="-1" aria-label="查看上个月">&lsaquo;</button>
                    <div class="tm-homepage-focus-calendar-month">${esc(formatMonthLabel(month.key))}</div>
                    <button type="button" class="tm-homepage-focus-day-btn" data-tm-home-focus-calendar-month="1" aria-label="查看下个月" ${isCurrentMonth ? "disabled" : ""}>&rsaquo;</button>
                </div>
                ${body}
            </div>
        `;
    }

    function renderTodayFocusPanel(stats) {
        const today = stats?.today || {};
        const focusDate = stats?.focusDate || {};
        const dayHead = (totalMinutes = 0) => `
            <div class="tm-homepage-focus-day-summary-head">
                <div>
                    <div class="tm-homepage-focus-day-title">${esc(formatFocusDateTitle(focusDate))}</div>
                    <div class="tm-homepage-focus-day-date">${esc(formatFocusDateText(focusDate.key))}</div>
                </div>
                <div class="tm-homepage-focus-total">
                    <span class="tm-homepage-focus-total-value">${esc(formatFocusHoursValue(totalMinutes || 0))}</span>
                    <span class="tm-homepage-focus-total-unit">小时</span>
                </div>
            </div>
        `;
        const hasTodayData = toNumber(today.totalMinutes, 0) > 0
            || toNumber(today.countdownMinutes, 0) > 0
            || toNumber(today.stopwatchMinutes, 0) > 0
            || toNumber(today.pomodoroCount, 0) > 0;
        if (!hasTodayData) {
            return `
                <article class="tm-homepage-focus-panel tm-homepage-focus-today" data-tm-home-focus-today-slot>
                    <div class="tm-homepage-focus-today-layout">
                        <div class="tm-homepage-focus-calendar-wrap">${renderFocusCalendar(stats)}</div>
                        <div class="tm-homepage-focus-day-metrics">
                            ${dayHead(0)}
                            <div class="tm-homepage-focus-empty">暂无专注数据</div>
                        </div>
                    </div>
                </article>
            `;
        }
        const progressPct = Math.max(0, Math.min(100, Math.round(toNumber(today.progressPct, 0))));
        const items = [
            { label: "番茄", value: `${Math.max(0, Math.round(toNumber(today.pomodoroCount, 0)))}` },
            { label: "正计时", value: formatFocusHoursText(today.stopwatchMinutes || 0) },
            { label: "分心", value: `${Math.max(0, Math.round(toNumber(today.distractionCount, 0)))}` },
        ];
        return `
            <article class="tm-homepage-focus-panel tm-homepage-focus-today" data-tm-home-focus-today-slot>
                <div class="tm-homepage-focus-today-layout">
                    <div class="tm-homepage-focus-calendar-wrap">${renderFocusCalendar(stats)}</div>
                    <div class="tm-homepage-focus-day-metrics">
                        ${dayHead(today.totalMinutes || 0)}
                        <div class="tm-homepage-focus-progress" style="--tm-home-focus-progress:${progressPct}%;">
                            <div class="tm-homepage-focus-progress-meta">
                                <span>目标 ${esc(formatFocusHoursText(today.targetMinutes || 0))}</span>
                                <span class="tm-homepage-focus-progress-value">${progressPct}%</span>
                            </div>
                            <div class="tm-homepage-focus-progress-track" aria-label="${esc(`今日专注目标完成 ${progressPct}%`)}">
                                <span class="tm-homepage-focus-progress-bar"></span>
                            </div>
                        </div>
                        <div class="tm-homepage-focus-stat-grid">
                            ${items.map((item) => `
                                <div class="tm-homepage-focus-stat">
                                    <div class="tm-homepage-focus-stat-label">${esc(item.label)}</div>
                                    <div class="tm-homepage-focus-stat-value">${esc(item.value)}</div>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                </div>
            </article>
        `;
    }

    function renderFocusTaskListContent(items, emptyText) {
        const list = Array.isArray(items) ? items : [];
        return list.length ? `
            <div class="tm-homepage-focus-list">
                ${list.map((item) => {
                    const selected = String(item.id || "").trim() && String(item.id || "").trim() === String(runtime.selectedFocusTaskId || "").trim();
                    return `
                        <button type="button" class="tm-homepage-focus-task ${selected ? "is-selected" : ""}" data-tm-home-focus-task="${esc(item.id || "")}" data-tm-home-open-task="${esc(item.id || "")}">
                            <span class="tm-homepage-focus-task-main">
                                <span class="tm-homepage-focus-task-title">${esc(item.title || "未命名任务")}</span>
                                <span class="tm-homepage-focus-task-meta">${esc(item.doc || "未命名文档")} · ${esc(item.lastText || "时间未知")}</span>
                            </span>
                            <span class="tm-homepage-focus-task-side">
                                <span class="tm-homepage-focus-pill ${item.planEmpty ? "is-empty" : ""}">${esc(item.planText || "未填预估")}</span>
                            </span>
                        </button>
                    `;
                }).join("")}
            </div>
        ` : `<div class="tm-homepage-focus-empty">${esc(emptyText)}</div>`;
    }

    function renderFocusTaskPopover(stats) {
        if (getHomepageFocusLayout() !== "narrow" || runtime.focusTaskPopoverOpen !== true) return "";
        const page = Math.max(0, Math.round(toNumber(stats?.dayPage, 0)));
        const totalPages = Math.max(1, Math.round(toNumber(stats?.dayTotalPages, 1)));
        const pager = totalPages > 1 ? `
            <div class="tm-homepage-focus-page-nav" aria-label="当日专注任务分页">
                <button type="button" class="tm-homepage-focus-page-btn" data-tm-home-focus-day-page="-1" aria-label="上一页当日专注任务" ${page <= 0 ? "disabled" : ""}>&lsaquo;</button>
                <span class="tm-homepage-focus-page-count">${esc(`${page + 1}/${totalPages}`)}</span>
                <button type="button" class="tm-homepage-focus-page-btn" data-tm-home-focus-day-page="1" aria-label="下一页当日专注任务" ${page >= totalPages - 1 ? "disabled" : ""}>&rsaquo;</button>
            </div>
        ` : "";
        return `
            <div class="tm-homepage-focus-task-popover" data-tm-home-focus-task-popover>
                <div class="tm-homepage-focus-task-popover-head">
                    <div>
                        <div class="tm-homepage-focus-task-popover-title">当日专注任务</div>
                        <div class="tm-homepage-focus-task-popover-date">${esc(formatFocusDateText(stats?.focusDate?.key))}</div>
                    </div>
                    <div class="tm-homepage-focus-task-popover-actions">
                        ${pager}
                        <button type="button" class="tm-homepage-focus-task-popover-close" data-tm-home-focus-task-popover-close="1" aria-label="关闭当日专注任务">&times;</button>
                    </div>
                </div>
                ${renderFocusTaskListContent(stats?.dayItems, "这一天当前范围暂无专注记录。")}
            </div>
        `;
    }

    function renderRecentFocusPanel(stats) {
        const isDayMode = stats?.taskListMode === "day";
        const items = isDayMode
            ? (Array.isArray(stats?.dayItems) ? stats.dayItems : [])
            : (Array.isArray(stats?.recentItems) ? stats.recentItems : []);
        const title = isDayMode ? "当日专注任务" : "最近专注任务";
        const hint = isDayMode ? "跟随左侧选中日期" : "跟随当前页签，按最近结束时间排序";
        const range = isDayMode ? formatFocusDateText(stats?.focusDate?.key) : `近 ${Number(stats?.rangeDays) || runtime.focusRecentDays} 天`;
        const emptyText = isDayMode ? "这一天当前范围暂无专注记录。" : "当前范围暂无专注记录。";
        const page = Math.max(0, Math.round(toNumber(stats?.dayPage, 0)));
        const totalPages = Math.max(1, Math.round(toNumber(stats?.dayTotalPages, 1)));
        const pager = isDayMode && totalPages > 1 ? `
            <div class="tm-homepage-focus-page-nav" aria-label="当日专注任务分页">
                <button type="button" class="tm-homepage-focus-page-btn" data-tm-home-focus-day-page="-1" aria-label="上一页当日专注任务" ${page <= 0 ? "disabled" : ""}>&lsaquo;</button>
                <span class="tm-homepage-focus-page-count">${esc(`${page + 1}/${totalPages}`)}</span>
                <button type="button" class="tm-homepage-focus-page-btn" data-tm-home-focus-day-page="1" aria-label="下一页当日专注任务" ${page >= totalPages - 1 ? "disabled" : ""}>&rsaquo;</button>
            </div>
        ` : "";
        const modeButton = isDayMode
            ? `<button type="button" class="tm-homepage-focus-mode-btn" data-tm-home-focus-mode="recent">最近专注</button>`
            : `<button type="button" class="tm-homepage-focus-mode-btn" data-tm-home-focus-mode="day">当日任务</button>`;
        return `
            <article class="tm-homepage-focus-panel tm-homepage-focus-recent">
                <div class="tm-homepage-focus-recent-head">
                    <div>
                        <div class="tm-homepage-focus-recent-title">${esc(title)}</div>
                        <div class="tm-homepage-card-desc">${esc(hint)}</div>
                    </div>
                    <div class="tm-homepage-focus-recent-side">
                        <div class="tm-homepage-focus-recent-range">${esc(range)}</div>
                        ${modeButton}
                        ${pager}
                    </div>
                </div>
                ${renderFocusTaskListContent(items, emptyText)}
            </article>
        `;
    }

    function renderFocusSection(ctx, profile) {
        if (!shouldRenderFocusSection(ctx)) return "";
        const layout = getHomepageFocusLayout();
        const isNarrow = layout === "narrow";
        const expectedKey = buildFocusLoadKey(ctx);
        const state = runtime.focusState && typeof runtime.focusState === "object" ? runtime.focusState : {};
        const matches = String(state.key || "") === expectedKey;
        if (!matches || state.status === "idle" || state.status === "loading") {
            return renderFocusLoadingCard("正在读取番茄历史...", layout);
        }
        if (state.status === "error") {
            return renderFocusLoadingCard("番茄钟历史暂不可用。", layout);
        }
        const stats = buildFocusStats(ctx, state.records || [], state.settings || null);
        const dayScope = stats?.focusDate?.isToday ? "今日当前范围" : "当日当前范围";
        return `
            <section class="tm-homepage-card tm-homepage-card--focus ${isNarrow ? "is-narrow" : ""}">
                <div class="tm-homepage-card-head">
                    <div>
                        <div class="tm-homepage-card-title">专注统计</div>
                        <div class="tm-homepage-card-desc">${isNarrow ? dayScope : `${dayScope} · 最近专注近 90 天`}</div>
                    </div>
                </div>
                <div class="tm-homepage-focus-grid">
                    ${renderTodayFocusPanel(stats)}
                    ${isNarrow ? "" : `<div data-tm-home-focus-recent-slot>${renderRecentFocusPanel(stats)}</div>`}
                </div>
                ${isNarrow ? renderFocusTaskPopover(stats) : ""}
            </section>
        `;
    }

    function renderFocusSlot(ctx, profile) {
        if (!shouldRenderFocusSection(ctx)) return "";
        return `<div data-tm-home-focus-slot>${renderFocusSection(ctx, profile)}</div>`;
    }

    function syncHomepageHeatmapLayout() {
        if (!(runtime.root instanceof HTMLElement)) return false;
        if (resolveProfile(runtime.ctx || {}) !== "desktop") return false;
        let updated = false;
        runtime.root.querySelectorAll(".tm-homepage-card--heatmap").forEach((card) => {
            if (!(card instanceof HTMLElement)) return;
            const shell = card.querySelector(".tm-homepage-heatmap-shell");
            const monthGrids = Array.from(card.querySelectorAll(".tm-homepage-heatmap-month-grid"))
                .filter((item) => item instanceof HTMLElement);
            if (!(shell instanceof HTMLElement) || !monthGrids.length) return;
            const firstGrid = monthGrids[0];
            const styles = getComputedStyle(shell);
            const cellSize = Math.max(1, Number.parseFloat(styles.getPropertyValue("--tm-home-heatmap-cell")) || 17);
            const gapSize = Math.max(0, Number.parseFloat(styles.getPropertyValue("--tm-home-heatmap-gap")) || 6);
            const baseCols = Math.max(1, Math.round(Number.parseFloat(styles.getPropertyValue("--tm-home-heatmap-month-cols")) || 4));
            const availableHeight = Math.max(0, Math.round(firstGrid.getBoundingClientRect().height || 0));
            if (!availableHeight) return;
            const maxCellCount = Math.max(1, ...monthGrids.map((grid) => grid.querySelectorAll(".tm-homepage-heatmap-cell:not(.tm-homepage-heatmap-cell--placeholder)").length || 1));
            const baseRows = Math.max(1, Math.ceil(maxCellCount / baseCols));
            const fitRows = Math.max(1, Math.floor((availableHeight + gapSize) / (cellSize + gapSize)));
            const rows = Math.max(baseRows, Math.min(fitRows, maxCellCount, 18));
            monthGrids.forEach((grid) => {
                const cellCount = Math.max(1, grid.querySelectorAll(".tm-homepage-heatmap-cell:not(.tm-homepage-heatmap-cell--placeholder)").length || 1);
                const cols = Math.max(1, Math.ceil(cellCount / rows));
                if (grid.style.getPropertyValue("--tm-home-heatmap-month-rows") !== String(rows)) {
                    grid.style.setProperty("--tm-home-heatmap-month-rows", String(rows));
                    updated = true;
                }
                if (grid.style.getPropertyValue("--tm-home-heatmap-month-cols") !== String(cols)) {
                    grid.style.setProperty("--tm-home-heatmap-month-cols", String(cols));
                    updated = true;
                }
            });
        });
        return updated;
    }

    function scheduleHomepageHeatmapLayoutSync() {
        if (!(runtime.root instanceof HTMLElement)) return false;
        if (runtime.heatmapLayoutRaf) {
            try { cancelAnimationFrame(runtime.heatmapLayoutRaf); } catch (e) {}
            runtime.heatmapLayoutRaf = 0;
        }
        runtime.heatmapLayoutRaf = requestAnimationFrame(() => {
            runtime.heatmapLayoutRaf = 0;
            syncHomepageHeatmapLayout();
        });
        return true;
    }

    function updateFocusSlot() {
        if (!(runtime.root instanceof HTMLElement)) return false;
        const slot = runtime.root.querySelector("[data-tm-home-focus-slot]");
        if (!(slot instanceof HTMLElement)) return false;
        const ctx = runtime.ctx && typeof runtime.ctx === "object" ? runtime.ctx : {};
        runtime.profile = resolveProfile(ctx);
        slot.innerHTML = renderFocusSection(ctx, runtime.profile);
        scheduleHomepageHeatmapLayoutSync();
        return true;
    }

    function syncFocusStateForCurrentDate(ctx, records = []) {
        const state = runtime.focusState && typeof runtime.focusState === "object" ? runtime.focusState : {};
        const mergedRecords = mergeFocusRecords(state.records || [], records);
        if (!mergedRecords.length && state.status !== "loaded") return false;
        runtime.focusState = {
            ...state,
            status: "loaded",
            key: buildFocusLoadKey(ctx),
            records: mergedRecords,
        };
        return true;
    }

    function buildLoadedFocusStats(ctx) {
        const state = runtime.focusState && typeof runtime.focusState === "object" ? runtime.focusState : {};
        const expectedKey = buildFocusLoadKey(ctx);
        if (String(state.key || "") !== expectedKey || state.status !== "loaded") return null;
        return buildFocusStats(ctx, state.records || [], state.settings || null);
    }

    function updateFocusTodaySlot() {
        if (!(runtime.root instanceof HTMLElement)) return false;
        const slot = runtime.root.querySelector("[data-tm-home-focus-today-slot]");
        if (!(slot instanceof HTMLElement)) return false;
        const ctx = runtime.ctx && typeof runtime.ctx === "object" ? runtime.ctx : {};
        const stats = buildLoadedFocusStats(ctx);
        if (!stats) return false;
        slot.outerHTML = renderTodayFocusPanel(stats);
        scheduleHomepageHeatmapLayoutSync();
        return true;
    }

    function updateFocusRecentSlot() {
        if (!(runtime.root instanceof HTMLElement)) return false;
        const slot = runtime.root.querySelector("[data-tm-home-focus-recent-slot]");
        if (!(slot instanceof HTMLElement)) return false;
        const ctx = runtime.ctx && typeof runtime.ctx === "object" ? runtime.ctx : {};
        const stats = buildLoadedFocusStats(ctx);
        if (!stats) return false;
        slot.innerHTML = renderRecentFocusPanel(stats);
        scheduleHomepageHeatmapLayoutSync();
        return true;
    }

    function updateFocusDaySlots() {
        const todayUpdated = updateFocusTodaySlot();
        const recentUpdated = updateFocusRecentSlot();
        return todayUpdated || recentUpdated;
    }

    function ensureFocusStatsLoaded(ctx) {
        if (!shouldRenderFocusSection(ctx)) return false;
        const key = buildFocusLoadKey(ctx);
        if (!key) return false;
        const state = runtime.focusState && typeof runtime.focusState === "object" ? runtime.focusState : {};
        if (String(state.key || "") === key && (state.status === "loading" || state.status === "loaded")) return true;
        const seq = ++runtime.focusLoadSeq;
        runtime.focusState = { status: "loading", key, records: [], settings: null, unavailable: false };
        loadTomatoFocusPayload(ctx)
            .then((payload) => {
                if (seq !== runtime.focusLoadSeq) return;
                if (!(runtime.root instanceof HTMLElement)) return;
                runtime.focusState = {
                    status: payload?.unavailable ? "error" : "loaded",
                    key,
                    records: Array.isArray(payload?.records) ? payload.records : [],
                    settings: payload?.settings || null,
                    unavailable: payload?.unavailable === true,
                };
                ensureFocusCalendarLoaded(ctx, getSelectedFocusDateKey(ctx).slice(0, 7));
                updateFocusSlot();
            })
            .catch(() => {
                if (seq !== runtime.focusLoadSeq) return;
                runtime.focusState = { status: "error", key, records: [], settings: null, unavailable: true };
                updateFocusSlot();
            });
        return true;
    }

    function renderTrendCard(ctx, profile, overview, layout = "wide") {
        const summary = buildTrendSummary(overview?.trend);
        const stats = [
            { label: "最近", value: summary.last.value, note: summary.last.label || "暂无" },
            { label: "峰值", value: summary.peak.value, note: summary.peak.label || "暂无" },
            { label: "日均", value: formatMetricValue(summary.average), note: `近 ${summary.pointCount || 0} 天` },
        ];
        return `
            <section class="tm-homepage-card tm-homepage-card--trend ${String(layout || "").trim() === "narrow" ? "is-narrow" : ""}">
                <div class="tm-homepage-card-head tm-homepage-trend-head">
                    <div class="tm-homepage-trend-head-main">
                        <div class="tm-homepage-trend-title-group">
                        <div class="tm-homepage-card-title">完成趋势</div>
                        <div class="tm-homepage-card-desc">最近 ${runtime.rangeDays} 天完成曲线</div>
                        </div>
                        <div class="tm-homepage-trend-summary">
                            ${stats.map((item) => `
                                <div class="tm-homepage-trend-stat">
                                    <div class="tm-homepage-trend-stat-label">${esc(item.label)}</div>
                                    <div class="tm-homepage-trend-stat-value">${esc(item.value)}</div>
                                    <div class="tm-homepage-trend-stat-note">${esc(item.note)}</div>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                    ${renderRangeSwitch()}
                </div>
                <div class="tm-homepage-trend-scroll">
                    <div class="tm-homepage-trend-scroll-inner">
                        <div class="tm-homepage-trend-wrap">${buildTrendSvg(overview.trend, ctx, profile, layout)}</div>
                        ${renderTrendAxis(overview?.trend)}
                    </div>
                </div>
            </section>
        `;
    }

    function renderHeroSection(overview) {
        return `
            <div class="tm-homepage-hero-grid">
                ${renderOverviewGauge(overview)}
                ${renderSummaryCard(overview)}
            </div>
        `;
    }

    function wrapHomepageModule(id, content) {
        const def = HOMEPAGE_MODULE_DEF_BY_ID[id];
        const html = String(content || "").trim();
        if (!def || !html) return "";
        const wide = isHomepageModuleWide(id);
        return `
            <div class="tm-homepage-module ${wide ? "tm-homepage-module--wide" : ""}" data-tm-home-module="${esc(id)}">
                ${html}
            </div>
        `;
    }

    function renderHomepageModule(id, ctx, profile, overview) {
        switch (id) {
            case "overview":
                return wrapHomepageModule(id, renderHeroSection(overview));
            case "focus":
                return wrapHomepageModule(id, renderFocusSlot(ctx, profile));
            case "trend":
                return wrapHomepageModule(id, `<div data-tm-home-trend-slot>${renderTrendCard(ctx, profile, overview, getHomepageTrendLayout())}</div>`);
            case "heatmap":
                return wrapHomepageModule(id, `
                    <section class="tm-homepage-card tm-homepage-card--heatmap">
                        <div class="tm-homepage-card-head">
                            <div>
                                <div class="tm-homepage-card-title">完成热力图</div>
                                <div class="tm-homepage-card-desc">按月展示当前范围近一年的完成情况</div>
                            </div>
                            ${renderHeatmapLegend()}
                        </div>
                        ${renderHeatmap(overview.heatmap)}
                    </section>
                `);
            case "distribution":
                return wrapHomepageModule(id, `
                    <section class="tm-homepage-card">
                        <div class="tm-homepage-card-head">
                            <div>
                                <div class="tm-homepage-card-title">${esc(overview.distribution?.title || "分布")}</div>
                                <div class="tm-homepage-card-desc">当前范围内未完成任务分布</div>
                            </div>
                        </div>
                        ${renderDistribution(overview.distribution)}
                    </section>
                `);
            case "recent":
                return wrapHomepageModule(id, `
                    <section class="tm-homepage-card">
                        <div class="tm-homepage-card-head">
                            <div>
                                <div class="tm-homepage-card-title">最近完成</div>
                                <div class="tm-homepage-card-desc">保留最近 6 条完成记录</div>
                            </div>
                        </div>
                        ${renderTaskList(overview.recentDone, "当前范围内还没有完成记录。", "done")}
                    </section>
                `);
            case "risk":
                return wrapHomepageModule(id, `
                    <section class="tm-homepage-card">
                        <div class="tm-homepage-card-head">
                            <div>
                                <div class="tm-homepage-card-title">风险提醒</div>
                                <div class="tm-homepage-card-desc">逾期优先，其次展示 7 天内到期项</div>
                            </div>
                        </div>
                        ${renderTaskList(overview.riskList, "当前没有需要优先处理的风险任务。", "risk")}
                    </section>
                `);
            default:
                return "";
        }
    }

    function renderHomepageModules(ctx, profile, overview) {
        return readHomepageModuleOrder()
            .map((id) => renderHomepageModule(id, ctx, profile, overview))
            .filter(Boolean)
            .join("");
    }

    function renderShell(ctx, profile, overview) {
        return `
            <div class="tm-homepage-shell tm-homepage--${profile}">
                <div class="tm-homepage-main">
                    <header class="tm-homepage-header">
                        <div class="tm-homepage-title-wrap">
                            <h2 class="tm-homepage-title">${esc(overview.title || "主页")}</h2>
                            <p class="tm-homepage-subtitle" data-tm-home-subtitle>${esc(overview.subtitle)}</p>
                        </div>
                        <div class="tm-homepage-toolbar" data-tm-home-settings-slot>${renderHomepageSettings()}</div>
                    </header>
                    <div class="tm-homepage-module-flow">
                        ${renderHomepageModules(ctx, profile, overview)}
                    </div>
                </div>
            </div>
        `;
    }

    function doRender() {
        if (!(runtime.root instanceof HTMLElement)) return false;
        const ctx = runtime.ctx && typeof runtime.ctx === "object" ? runtime.ctx : {};
        runtime.profile = resolveProfile(ctx);
        runtime.root.dataset.tmHomepageProfile = runtime.profile;
        ensureFocusCalendarLoaded(ctx, getSelectedFocusDateKey(ctx).slice(0, 7));
        runtime.root.innerHTML = renderShell(ctx, runtime.profile, buildOverview(ctx));
        scheduleHomepageHeatmapLayoutSync();
        ensureFocusStatsLoaded(ctx);
        return true;
    }

    function doRenderRangeOnly() {
        if (!(runtime.root instanceof HTMLElement)) return false;
        const ctx = runtime.ctx && typeof runtime.ctx === "object" ? runtime.ctx : {};
        runtime.profile = resolveProfile(ctx);
        runtime.root.dataset.tmHomepageProfile = runtime.profile;
        const overview = buildOverview(ctx);
        const subtitleEl = runtime.root.querySelector("[data-tm-home-subtitle]");
        if (subtitleEl instanceof HTMLElement) subtitleEl.textContent = String(overview.subtitle || "");
        const trendSlot = runtime.root.querySelector("[data-tm-home-trend-slot]");
        if (trendSlot instanceof HTMLElement) {
            trendSlot.innerHTML = renderTrendCard(ctx, runtime.profile, overview, getHomepageTrendLayout());
            ensureFocusCalendarLoaded(ctx, getSelectedFocusDateKey(ctx).slice(0, 7));
            updateFocusSlot();
            ensureFocusStatsLoaded(ctx);
            return true;
        }
        return doRender();
    }

    function scheduleSettledRender() {
        if (!(runtime.root instanceof HTMLElement)) return false;
        if (runtime.settleTimer) {
            try { clearTimeout(runtime.settleTimer); } catch (e) {}
            runtime.settleTimer = 0;
        }
        const waitMs = Math.max(0, Number(runtime.settleUntil || 0) - Date.now());
        runtime.settleTimer = setTimeout(() => {
            runtime.settleTimer = 0;
            if (!(runtime.root instanceof HTMLElement)) return;
            doRender();
        }, waitMs);
        return true;
    }

    function bindInteractions() {
        if (!(runtime.root instanceof HTMLElement)) return;
        if (runtime.clickHandler) {
            try { runtime.root.removeEventListener("click", runtime.clickHandler); } catch (e) {}
        }
        if (runtime.documentClickHandler) {
            try { document.removeEventListener("click", runtime.documentClickHandler); } catch (e) {}
        }
        runtime.clickHandler = (event) => {
            const source = event?.target instanceof Element ? event.target : null;
            if (source && runtime.focusTaskPopoverOpen === true && !source.closest(".tm-homepage-focus-task-popover,[data-tm-home-focus-calendar-date]")) {
                runtime.focusTaskPopoverOpen = false;
                updateFocusSlot();
            }
            if (source && runtime.focusCalendar?.open === true && !source.closest(".tm-homepage-focus-calendar-popover,[data-tm-home-focus-calendar-toggle]")) {
                runtime.focusCalendar = {
                    ...(runtime.focusCalendar || {}),
                    open: false,
                };
                updateFocusTodaySlot();
            }
            if (source && runtime.homepageSettingsOpen === true && !source.closest(".tm-homepage-settings")) {
                runtime.homepageSettingsOpen = false;
                updateHomepageSettingsSlot();
            }
            const target = source ? source.closest("[data-tm-home-range],[data-tm-home-open-task],[data-tm-home-focus-task],[data-tm-home-focus-day],[data-tm-home-focus-day-page],[data-tm-home-focus-mode],[data-tm-home-focus-task-popover-close],[data-tm-home-focus-calendar-toggle],[data-tm-home-focus-calendar-month],[data-tm-home-focus-calendar-date],[data-tm-home-settings-toggle],[data-tm-home-module-layout],[data-tm-home-module-move],[data-tm-home-module-reset]") : null;
            if (!(target instanceof Element)) return;
            const focusTaskPopoverClose = String(target.getAttribute("data-tm-home-focus-task-popover-close") || "").trim();
            if (focusTaskPopoverClose) {
                runtime.focusTaskPopoverOpen = false;
                updateFocusSlot();
                return;
            }
            const settingsToggle = String(target.getAttribute("data-tm-home-settings-toggle") || "").trim();
            if (settingsToggle) {
                runtime.homepageSettingsOpen = runtime.homepageSettingsOpen !== true;
                if (!updateHomepageSettingsSlot()) doRender();
                return;
            }
            const moduleLayout = String(target.getAttribute("data-tm-home-module-layout") || "").trim();
            if (moduleLayout) {
                const moduleId = String(target.getAttribute("data-tm-home-module-id") || "").trim();
                if (moduleId === "trend") {
                    setHomepageTrendLayout(moduleLayout);
                    runtime.homepageSettingsOpen = true;
                    doRender();
                } else if (moduleId === "focus") {
                    setHomepageFocusLayout(moduleLayout);
                    if (String(moduleLayout || "").trim() !== "narrow") runtime.focusTaskPopoverOpen = false;
                    runtime.homepageSettingsOpen = true;
                    doRender();
                }
                return;
            }
            const moduleMove = String(target.getAttribute("data-tm-home-module-move") || "").trim();
            if (moduleMove) {
                moveHomepageModule(target.getAttribute("data-tm-home-module-id"), Number(moduleMove) || 0);
                runtime.homepageSettingsOpen = true;
                doRender();
                return;
            }
            const moduleReset = String(target.getAttribute("data-tm-home-module-reset") || "").trim();
            if (moduleReset) {
                resetHomepageModuleOrder();
                runtime.homepageSettingsOpen = true;
                doRender();
                return;
            }
            const nextRange = String(target.getAttribute("data-tm-home-range") || "").trim();
            if (nextRange) {
                const days = Math.max(7, Math.min(90, Number(nextRange) || 30));
                if (days !== runtime.rangeDays) {
                    runtime.rangeDays = days;
                    doRenderRangeOnly();
                }
                return;
            }
            const focusMode = String(target.getAttribute("data-tm-home-focus-mode") || "").trim();
            if (focusMode) {
                if (focusMode === "recent") {
                    runtime.focusTaskListMode = "recent";
                    runtime.focusDayPage = 0;
                    if (!updateFocusRecentSlot()) updateFocusSlot();
                    ensureFocusStatsLoaded(runtime.ctx || {});
                } else if (focusMode === "day") {
                    runtime.focusTaskListMode = "day";
                    runtime.focusDayPage = 0;
                    if (!updateFocusRecentSlot()) updateFocusSlot();
                }
                return;
            }
            const calendarToggle = String(target.getAttribute("data-tm-home-focus-calendar-toggle") || "").trim();
            if (calendarToggle) {
                const ctx = runtime.ctx || {};
                const selectedKey = getSelectedFocusDateKey(ctx);
                const nextOpen = runtime.focusCalendar?.open !== true;
                runtime.focusCalendar = {
                    ...(runtime.focusCalendar || {}),
                    open: nextOpen,
                    monthKey: normalizeMonthKey(runtime.focusCalendar?.monthKey || selectedKey.slice(0, 7)) || selectedKey.slice(0, 7),
                };
                if (!updateFocusTodaySlot()) updateFocusSlot();
                if (nextOpen) ensureFocusCalendarLoaded(ctx, runtime.focusCalendar.monthKey);
                return;
            }
            const calendarMonthDelta = String(target.getAttribute("data-tm-home-focus-calendar-month") || "").trim();
            if (calendarMonthDelta) {
                const ctx = runtime.ctx || {};
                const delta = Math.max(-1, Math.min(1, Math.round(Number(calendarMonthDelta) || 0)));
                if (delta !== 0) {
                    const selectedKey = getSelectedFocusDateKey(ctx);
                    const currentMonth = normalizeMonthKey(runtime.focusCalendar?.monthKey || selectedKey.slice(0, 7)) || selectedKey.slice(0, 7);
                    const nextMonth = shiftMonthKey(currentMonth, delta);
                    runtime.focusCalendar = {
                        ...(runtime.focusCalendar || {}),
                        monthKey: nextMonth,
                    };
                    ensureFocusCalendarLoaded(ctx, nextMonth);
                    if (!updateFocusTodaySlot()) updateFocusSlot();
                }
                return;
            }
            const calendarDate = String(target.getAttribute("data-tm-home-focus-calendar-date") || "").trim();
            if (calendarDate) {
                const ctx = runtime.ctx || {};
                const selectedKey = setFocusDateByKey(ctx, calendarDate);
                const isNarrowFocus = getHomepageFocusLayout() === "narrow";
                runtime.focusTaskPopoverOpen = isNarrowFocus;
                runtime.focusCalendar = {
                    ...(runtime.focusCalendar || {}),
                    open: false,
                    monthKey: selectedKey.slice(0, 7),
                };
                syncFocusStateForCurrentDate(ctx, runtime.focusCalendar?.records || []);
                if (isNarrowFocus) {
                    updateFocusSlot();
                } else if (!updateFocusDaySlots()) {
                    updateFocusSlot();
                }
                ensureFocusStatsLoaded(ctx);
                return;
            }
            const focusDayDelta = String(target.getAttribute("data-tm-home-focus-day") || "").trim();
            if (focusDayDelta) {
                const delta = Math.max(-1, Math.min(1, Math.round(Number(focusDayDelta) || 0)));
                if (delta !== 0) {
                    runtime.focusDateOffset = Math.min(0, Math.round(toNumber(runtime.focusDateOffset, 0)) + delta);
                    runtime.focusTaskListMode = "day";
                    runtime.focusDayPage = 0;
                    const ctx = runtime.ctx || {};
                    const selectedKey = getSelectedFocusDateKey(ctx);
                    runtime.focusCalendar = {
                        ...(runtime.focusCalendar || {}),
                        open: false,
                        monthKey: selectedKey.slice(0, 7),
                    };
                    syncFocusStateForCurrentDate(ctx, runtime.focusCalendar?.records || []);
                    ensureFocusCalendarLoaded(ctx, selectedKey.slice(0, 7));
                    if (!updateFocusDaySlots()) updateFocusSlot();
                    ensureFocusStatsLoaded(ctx);
                }
                return;
            }
            const focusDayPageDelta = String(target.getAttribute("data-tm-home-focus-day-page") || "").trim();
            if (focusDayPageDelta) {
                const delta = Math.max(-1, Math.min(1, Math.round(Number(focusDayPageDelta) || 0)));
                if (delta !== 0) {
                    runtime.focusTaskListMode = "day";
                    runtime.focusDayPage = Math.max(0, Math.round(toNumber(runtime.focusDayPage, 0)) + delta);
                    if (!updateFocusRecentSlot()) updateFocusSlot();
                }
                return;
            }
            const focusTaskId = String(target.getAttribute("data-tm-home-focus-task") || "").trim();
            if (focusTaskId) {
                runtime.selectedFocusTaskId = focusTaskId;
                if (!updateFocusRecentSlot()) updateFocusSlot();
            }
            const taskId = String(target.getAttribute("data-tm-home-open-task") || "").trim();
            if (taskId && typeof runtime.ctx?.onOpenTask === "function") runtime.ctx.onOpenTask(taskId);
        };
        runtime.root.addEventListener("click", runtime.clickHandler);
        runtime.documentClickHandler = (event) => {
            if (!(runtime.root instanceof HTMLElement)) return;
            const source = event?.target instanceof Element ? event.target : null;
            if (!source) return;
            if (runtime.focusTaskPopoverOpen === true && !source.closest(".tm-homepage-focus-task-popover,[data-tm-home-focus-calendar-date]")) {
                runtime.focusTaskPopoverOpen = false;
                updateFocusSlot();
            }
            if (runtime.focusCalendar?.open === true && !source.closest(".tm-homepage-focus-calendar-popover,[data-tm-home-focus-calendar-toggle]")) {
                runtime.focusCalendar = {
                    ...(runtime.focusCalendar || {}),
                    open: false,
                };
                updateFocusTodaySlot();
            }
            if (runtime.homepageSettingsOpen === true && !source.closest(".tm-homepage-settings")) {
                runtime.homepageSettingsOpen = false;
                updateHomepageSettingsSlot();
            }
        };
        document.addEventListener("click", runtime.documentClickHandler);
    }

    function bindResizeObserver() {
        if (!(runtime.root instanceof HTMLElement) || typeof ResizeObserver !== "function") return;
        const measure = readContainerSize(runtime.root);
        const host = measure.host instanceof HTMLElement ? measure.host : runtime.root;
        try { runtime.resizeObserver?.disconnect?.(); } catch (e) {}
        runtime.resizeHost = host;
        runtime.resizeObserver = new ResizeObserver(() => {
            if (runtime.resizeRaf) {
                try { cancelAnimationFrame(runtime.resizeRaf); } catch (e) {}
            }
            runtime.resizeRaf = requestAnimationFrame(() => {
                runtime.resizeRaf = 0;
                const currentMeasure = readContainerSize(runtime.root);
                const nextWidth = currentMeasure.width;
                const nextHeight = currentMeasure.height;
                const prevProfile = runtime.profile;
                const prevWidth = Math.round(toNumber(runtime.ctx?.containerWidth, 0));
                runtime.ctx = {
                    ...(runtime.ctx || {}),
                    containerWidth: nextWidth,
                    containerHeight: nextHeight,
                };
                scheduleHomepageHeatmapLayoutSync();
                if (resolveProfile(runtime.ctx) !== prevProfile || Math.abs(nextWidth - prevWidth) > 8) {
                    if (Date.now() < Number(runtime.settleUntil || 0)) {
                        scheduleSettledRender();
                        return;
                    }
                    doRender();
                }
            });
        });
        runtime.resizeObserver.observe(host);
    }

    function unmount() {
        if (runtime.resizeRaf) {
            try { cancelAnimationFrame(runtime.resizeRaf); } catch (e) {}
            runtime.resizeRaf = 0;
        }
        if (runtime.heatmapLayoutRaf) {
            try { cancelAnimationFrame(runtime.heatmapLayoutRaf); } catch (e) {}
            runtime.heatmapLayoutRaf = 0;
        }
        if (runtime.settleTimer) {
            try { clearTimeout(runtime.settleTimer); } catch (e) {}
            runtime.settleTimer = 0;
        }
        try { runtime.resizeObserver?.disconnect?.(); } catch (e) {}
        runtime.resizeObserver = null;
        runtime.resizeHost = null;
        runtime.settleUntil = 0;
        runtime.focusLoadSeq += 1;
        runtime.focusState = { status: "idle", key: "", records: [], settings: null, unavailable: false };
        runtime.selectedFocusTaskId = "";
        runtime.focusDateOffset = 0;
        runtime.focusTaskListMode = "day";
        runtime.focusRecentDays = 90;
        runtime.focusDayPage = 0;
        runtime.focusTaskPopoverOpen = false;
        runtime.focusCalendar = { open: false, monthKey: "", status: "idle", key: "", records: [], loadSeq: 0 };
        runtime.homepageSettingsOpen = false;
        if (runtime.root instanceof HTMLElement && runtime.clickHandler) {
            try { runtime.root.removeEventListener("click", runtime.clickHandler); } catch (e) {}
        }
        runtime.clickHandler = null;
        if (runtime.documentClickHandler) {
            try { document.removeEventListener("click", runtime.documentClickHandler); } catch (e) {}
        }
        runtime.documentClickHandler = null;
        if (runtime.root instanceof HTMLElement) {
            try { delete runtime.root.dataset.tmHomepageAnimate; } catch (e) {}
            try { runtime.root.innerHTML = ""; } catch (e) {}
        }
        runtime.root = null;
        runtime.ctx = null;
    }

    function mount(root, ctx = {}) {
        if (!(root instanceof HTMLElement)) return false;
        if (runtime.root && runtime.root !== root) unmount();
        ensureHomepageStyle();
        const measure = readContainerSize(root);
        runtime.root = root;
        runtime.settleUntil = Date.now() + 220;
        runtime.resizeHost = measure.host instanceof HTMLElement ? measure.host : root;
        runtime.ctx = {
            ...(ctx && typeof ctx === "object" ? ctx : {}),
            containerWidth: measure.width,
            containerHeight: measure.height,
        };
        const animateOnMount = runtime.ctx?.animateOnMount !== false;
        try { runtime.root.dataset.tmHomepageAnimate = animateOnMount ? "1" : "0"; } catch (e) {}
        doRender();
        if (animateOnMount) {
            try {
                requestAnimationFrame(() => {
                    if (runtime.root === root) runtime.root.dataset.tmHomepageAnimate = "0";
                });
            } catch (e) {
                try {
                    if (runtime.root === root) runtime.root.dataset.tmHomepageAnimate = "0";
                } catch (e2) {}
            }
        }
        bindInteractions();
        bindResizeObserver();
        return true;
    }

    function update(ctx = {}) {
        if (!(runtime.root instanceof HTMLElement)) return false;
        try { runtime.root.dataset.tmHomepageAnimate = "0"; } catch (e) {}
        const measure = readContainerSize(runtime.root);
        runtime.ctx = {
            ...(runtime.ctx || {}),
            ...(ctx && typeof ctx === "object" ? ctx : {}),
            containerWidth: measure.width || Math.round(toNumber(ctx?.containerWidth, 0)),
            containerHeight: measure.height || Math.round(toNumber(ctx?.containerHeight, 0)),
        };
        if (measure.host instanceof HTMLElement && measure.host !== runtime.resizeHost) {
            bindResizeObserver();
        }
        if (Date.now() < Number(runtime.settleUntil || 0)) {
            scheduleSettledRender();
            return true;
        }
        return doRender();
    }

    globalThis.__tmHomepage = {
        loaded: true,
        mount,
        update,
        unmount,
        resize: () => update(runtime.ctx || {}),
    };
})();
