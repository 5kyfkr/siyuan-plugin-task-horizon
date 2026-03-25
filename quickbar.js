// ==Siyuan==
// name: 任务悬浮条
// author: user
// version: 0.0.17
// desc: 悬浮条优先级默认改为"无"，增加状态选项监听实时同步
// ==/Siyuan==

(async () => {
    if (globalThis.__taskHorizonQuickbarLoaded) return;
    globalThis.__taskHorizonQuickbarLoaded = true;
    let quickbarDisposed = false;
    let __tmQBStatusRenderStorageHandler = null;
    // ==================== 悬浮条自定义属性配置 ====================
    // 对接任务管理器的自定义属性系统
    const isEnableCustomPropsBar = true;  // 是否启用自定义属性悬浮条
    const customPropsConfig = {
        // 第一行显示的属性
        firstRow: [
            {
                name: '状态',
                attrKey: 'custom-status',
                type: 'select',
                // 状态选项会从 SettingsStore 动态读取
                options: [],  // 运行时动态获取
                defaultValue: 'todo'
            },
            {
                name: '重要性',
                attrKey: 'custom-priority',
                type: 'select',
                options: [
                    { value: 'high', label: '高', color: '#de350b' },
                    { value: 'medium', label: '中', color: '#ff991f' },
                    { value: 'low', label: '低', color: '#1d7afc' },
                    { value: 'none', label: '无', color: '#9e9e9e' }
                ],
                defaultValue: 'none'
            },
            {
                name: '完成日期',
                attrKey: 'custom-completion-time',
                type: 'date',
                defaultValue: ''
            }
        ],
        // 第二行显示的属性
        secondRow: [
            {
                name: '时长',
                attrKey: 'custom-duration',
                type: 'text',
                placeholder: '输入时长',
                defaultValue: ''
            },
            {
                name: '备注',
                attrKey: 'custom-remark',
                type: 'text',
                placeholder: '输入备注',
                defaultValue: ''
            }
        ]
    };

    // ==================== 原有配置（保留用于数据库操作） ====================
    const isEnableMoreCols = true;
    const isEnableCustomAttrsInSelectedBlock = true;
    const isEnableCompletedCheckboxCol = false;
    const completedCheckboxColName = '优先';
    const completedCheckboxCheckedValue = false;
    const isEnableTaskBlockFloatBar = false;  // 关闭原有的AV列悬浮条
    const isEnableBlockContextMenu = false;

    // 缓存系统版本和数据库信息
    let systemVersion = '';
    let avCache = new Map();
    let keysCache = new Map();

    let lastBlockMenuTrigger = {
        ts: 0,
        isTask: false,
        source: ''
    };

    // ==================== 任务管理器状态选项缓存 ====================
    let taskStatusOptions = [
        { id: 'todo', name: '待办', color: '#757575' },
        { id: 'in_progress', name: '进行中', color: '#2196F3' },
        { id: 'done', name: '已完成', color: '#4CAF50' },
        { id: 'blocked', name: '阻塞', color: '#F44336' },
        { id: 'review', name: '待审核', color: '#FF9800' }
    ];
    const quickbarInlineFieldDefs = [
        { attrKey: 'custom-status', name: '状态', type: 'select' },
        { attrKey: 'custom-completion-time', name: '完成时间', type: 'date' },
        { attrKey: 'custom-priority', name: '重要性', type: 'select' },
        { attrKey: 'custom-start-date', name: '开始日期', type: 'date' },
        { attrKey: 'custom-duration', name: '时长', type: 'text', placeholder: '输入时长' },
        { attrKey: 'custom-remark', name: '备注', type: 'text', placeholder: '输入备注' }
    ];
    const quickbarInlineFieldAllowSet = new Set(quickbarInlineFieldDefs.map(item => item.attrKey));
    let inlineMetaCache = new Map();
    let inlineMetaLayoutCache = new Map();
    let inlineMetaObserver = null;
    let inlineMetaObservedRoots = [];
    let inlineMetaStarted = false;
    let inlineMetaRenderTimer = null;
    let inlineMetaInteractUntil = 0;
    let inlineMetaScrollHandler = null;
    let inlineMetaRafId = 0;
    let inlineMetaPositionRafId = 0;
    let inlineMetaLayer = null;
    let inlineMetaOccupiedRects = [];
    let inlineMetaScrollIdleTimer = null;
    let inlineMetaScrolling = false;
    let inlineMetaBlockObserver = null;
    let inlineMetaObservedTaskBlocks = new Map();
    let inlineMetaVisibleTaskBlocks = new Map();
    let inlineMetaNeedSyncBlocks = true;
    let inlineMetaMutationTimer = null;
    let inlineMetaLastScrollRenderTs = 0;
    let inlineMetaPropsInflight = new Map();
    let inlineMetaScrollDirection = 0;
    let inlineMetaLastScrollPos = 0;
    let inlineMetaScopeDocIds = null;
    let inlineMetaScopeDocIdsTs = 0;
    let inlineMetaScopeDocIdsPromise = null;

    // ==================== 辅助函数 ====================
    function getQuickbarInlineSettings() {
        const fallbackFields = ['custom-status', 'custom-completion-time'];
        try {
            const enabled = !!JSON.parse(localStorage.getItem('tm_enable_quickbar_inline_meta') || 'false');
            const showOnMobile = !!JSON.parse(localStorage.getItem('tm_quickbar_inline_show_on_mobile') || 'false');
            const rawFields = JSON.parse(localStorage.getItem('tm_quickbar_inline_fields') || 'null');
            const fields = Array.isArray(rawFields)
                ? rawFields.map(v => String(v || '').trim()).filter(v => quickbarInlineFieldAllowSet.has(v))
                : fallbackFields.slice();
            return {
                enabled,
                showOnMobile,
                fields: fields.length ? fields : fallbackFields.slice()
            };
        } catch (e) {
            return { enabled: false, showOnMobile: false, fields: fallbackFields.slice() };
        }
    }

    function isInlineMetaScopeStorageKey(key) {
        return key === 'tm_doc_groups'
            || key === 'tm_selected_doc_ids';
    }

    function clearInlineMetaScopeDocCache() {
        inlineMetaScopeDocIds = null;
        inlineMetaScopeDocIdsTs = 0;
        inlineMetaScopeDocIdsPromise = null;
    }

    function getDocIdFromProtyleEl(protyleEl) {
        if (!protyleEl) return '';
        try {
            const direct = [
                protyleEl.querySelector?.('.protyle-title')?.getAttribute?.('data-node-id'),
                protyleEl.querySelector?.('.protyle-title__input')?.getAttribute?.('data-node-id'),
                protyleEl.querySelector?.('.protyle-background')?.getAttribute?.('data-node-id'),
                protyleEl.dataset?.nodeId,
                protyleEl.dataset?.id
            ];
            return direct.map((v) => String(v || '').trim()).find(Boolean) || '';
        } catch (e) {
            return '';
        }
    }

    function resolveDocIdFromTaskBlock(blockEl) {
        if (!blockEl) return '';
        const protyle = blockEl.closest?.('.protyle');
        const fromProtyle = getDocIdFromProtyleEl(protyle);
        if (fromProtyle) return fromProtyle;
        try {
            const holders = blockEl.closest?.('[data-doc-id],[data-root-id]');
            const fromHolder = String(holders?.getAttribute?.('data-doc-id') || holders?.getAttribute?.('data-root-id') || '').trim();
            if (fromHolder) return fromHolder;
        } catch (e) {}
        return '';
    }

    async function ensureInlineMetaScopeDocIds(forceRefresh = false) {
        const ttlMs = 5000;
        const now = Date.now();
        if (!forceRefresh && inlineMetaScopeDocIds && (now - inlineMetaScopeDocIdsTs) < ttlMs) return inlineMetaScopeDocIds;
        if (!forceRefresh && inlineMetaScopeDocIdsPromise) return inlineMetaScopeDocIdsPromise;
        const bridge = globalThis?.['siyuan-plugin-task-horizon']?.aiBridge;
        if (typeof bridge?.getConfiguredDocIds !== 'function') {
            inlineMetaScopeDocIds = null;
            inlineMetaScopeDocIdsTs = now;
            return null;
        }
        const p = Promise.resolve(bridge.getConfiguredDocIds({ forceRefresh: !!forceRefresh }))
            .then((docIds) => {
                const next = new Set((Array.isArray(docIds) ? docIds : []).map((id) => String(id || '').trim()).filter(Boolean));
                inlineMetaScopeDocIds = next;
                inlineMetaScopeDocIdsTs = Date.now();
                return next;
            })
            .catch(() => {
                inlineMetaScopeDocIds = null;
                inlineMetaScopeDocIdsTs = Date.now();
                return null;
            })
            .finally(() => {
                if (inlineMetaScopeDocIdsPromise === p) inlineMetaScopeDocIdsPromise = null;
            });
        inlineMetaScopeDocIdsPromise = p;
        return p;
    }

    async function isInlineMetaScopeAllowedForBlock(blockEl) {
        const docId = resolveDocIdFromTaskBlock(blockEl);
        if (!docId) return true;
        const scopeDocIds = await ensureInlineMetaScopeDocIds(false);
        if (!(scopeDocIds instanceof Set)) return true;
        if (!scopeDocIds.size) return false;
        return scopeDocIds.has(docId);
    }

    function removeInlineMetaHostByTaskId(taskId) {
        const id = String(taskId || '').trim();
        if (!id) return;
        const layer = inlineMetaLayer && inlineMetaLayer.isConnected
            ? inlineMetaLayer
            : document.querySelector('.sy-custom-props-inline-layer');
        if (!layer) return;
        let host = null;
        try {
            host = layer.querySelector(`.sy-custom-props-inline-host[data-block-id="${CSS.escape(id)}"]`);
        } catch (e) {
            host = Array.from(layer.querySelectorAll('.sy-custom-props-inline-host[data-block-id]')).find((el) => String(el?.dataset?.blockId || '').trim() === id) || null;
        }
        if (!host) return;
        try { host.remove(); } catch (e) {}
    }

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function isInlineMetaEnabled() {
        const cfg = getQuickbarInlineSettings();
        if (!cfg.enabled) return false;
        if (isMobileDevice() && !cfg.showOnMobile) return false;
        return true;
    }

    function hasTaskMarkerEl(el) {
        if (!el) return false;
        const marker = el.getAttribute?.('data-marker') || '';
        if (marker.includes('[ ]') || marker.includes('[x]') || marker.includes('[X]')) return true;
        if (el.querySelector?.('[data-marker*="[ ]"],[data-marker*="[x]"],[data-marker*="[X]"]')) return true;
        return false;
    }

    function isTaskBlockElement(blockEl) {
        if (!blockEl) return false;
        const checkbox = blockEl.querySelector?.('input[type="checkbox"],.protyle-action__task,.protyle-action--task,.protyle-task--checkbox,.protyle-task,.b3-checkbox,[data-task]');
        if (checkbox) return true;
        return hasTaskMarkerEl(blockEl);
    }

    function getBlockElementFromTarget(target) {
        if (!target || target === document) return null;
        const li = target.closest?.('.li,[data-type="NodeListItem"]');
        if (li?.dataset?.nodeId) return li;
        const block = target.closest?.('[data-node-id]');
        if (block?.dataset?.nodeId) return block;
        return null;
    }

    function getTaskBlockElementFromTarget(target) {
        if (!target || target === document) return null;
        const taskIndicator = target.closest?.('.protyle-action__task,.protyle-action--task,.protyle-task--checkbox,.protyle-task,[data-task]');
        const li = (taskIndicator || target).closest?.('.li,[data-type="NodeListItem"]');
        const block = (li && li.dataset?.nodeId) ? li : (taskIndicator || target).closest?.('[data-node-id]');
        if (!block || !block.dataset?.nodeId) return null;
        if (!isTaskBlockElement(block)) return null;
        return block;
    }

        function getTaskTitleFromBlockEl(blockEl) {
            if (!blockEl) return '';
            const p = blockEl.querySelector?.(':scope > .p') || blockEl.querySelector?.('.p') || null;
            const text = p ? p.textContent : blockEl.textContent;
            return String(text || '').replace(/\s+/g, ' ').trim();
        }

        function resolveTaskNodeIdForDetail(blockEl) {
            const readId = (el) => String(el?.dataset?.nodeId || el?.getAttribute?.('data-node-id') || '').trim();
            const pickTaskLi = (root) => {
                if (!root || !(root instanceof Element)) return null;
                const li = root.matches?.('.li,[data-type="NodeListItem"]')
                    ? root
                    : root.closest?.('.li,[data-type="NodeListItem"]');
                if (li && readId(li) && isTaskBlockElement(li)) return li;
                const inner = root.querySelector?.('.li[data-node-id],[data-type="NodeListItem"][data-node-id]');
                if (inner && readId(inner) && isTaskBlockElement(inner)) return inner;
                return null;
            };
            if (!blockEl) return '';
            const id0 = readId(blockEl);
            if (id0 && isTaskBlockElement(blockEl)) return id0;
            const li = pickTaskLi(blockEl);
            if (li) return readId(li);
            const p = blockEl.closest?.('[data-node-id]');
            return readId(p) || id0;
        }

    function getSelectedBlockElementForMenu() {
        const direct = document.querySelector('.protyle-wysiwyg--select, .protyle-content--select');
        const el = direct ||
            document.querySelector('.protyle--focus .protyle-wysiwyg, .protyle--focus .protyle-content')?.querySelector('.protyle-wysiwyg--select, .protyle-content--select') ||
            document.querySelector('.protyle-wysiwyg, .protyle-content')?.querySelector('.protyle-wysiwyg--select, .protyle-content--select');
        if (!el) return null;
        return el.closest?.('.li,[data-type="NodeListItem"],[data-node-id]') || el;
    }

    function isMobileDevice() {
        try {
            if (window.siyuan?.config?.isMobile !== undefined) return !!window.siyuan.config.isMobile;
        } catch (e) {}
        const ua = navigator.userAgent || '';
        return /Mobile|Android|iPhone|iPad|iPod/i.test(ua) || (window.innerWidth || 0) <= 768;
    }

    function isAiFeatureEnabled() {
        try {
            const raw = localStorage.getItem('tm_ai_enabled');
            if (raw === null) return false;
            return raw === 'true' || raw === '1';
        } catch (e) {
            return false;
        }
    }

    function markBlockMenuTrigger(target, source) {
        const blockEl = getBlockElementFromTarget(target);
        lastBlockMenuTrigger = {
            ts: Date.now(),
            isTask: isTaskBlockElement(blockEl),
            source
        };
    }

    const __tmQBOnContextmenuCapture = (e) => {
        markBlockMenuTrigger(e.target, 'contextmenu');
    };
    document.addEventListener('contextmenu', __tmQBOnContextmenuCapture, true);

    const __tmQBOnPointerdownCapture = (e) => {
        const t = e.target;
        const isGutterTrigger = !!t?.closest?.('.protyle-gutters,.protyle-gutter,.protyle-gutter__icon,.protyle-gutter__item,[data-type="gutter"],[data-type="gutterBlock"],.protyle-action,.protyle-icon');
        if (!isGutterTrigger) return;
        markBlockMenuTrigger(t, 'gutter');
    };
    document.addEventListener('pointerdown', __tmQBOnPointerdownCapture, true);

    // ==================== 自定义属性悬浮条核心逻辑 ====================
    async function initSystemVersion() {
        if (!systemVersion) {
            const versionData = await requestApi('/api/system/version');
            systemVersion = versionData?.data || '';
        }
        return systemVersion;
    }

    // ==================== 自定义属性悬浮条核心逻辑 ====================
    if (isEnableCustomPropsBar) {
        initCustomPropsFloatBar();
    }

    function initCustomPropsFloatBar() {
        if (document.getElementById('sy-custom-props-floatbar-style') && document.querySelector('.sy-custom-props-floatbar')) return;

        // 样式定义
        const style = document.createElement('style');
        style.id = 'sy-custom-props-floatbar-style';
        style.textContent = `
            .sy-custom-props-floatbar {
                position: absolute;
                z-index: 3005;
                display: none;
                flex-direction: row;
                align-items: center;
                gap: 6px;
                padding: 6px;
                border-radius: 8px;
                background: var(--b3-theme-background);
                border: 1px solid var(--b3-border-color);
                box-shadow: var(--b3-dialog-shadow);
                white-space: nowrap;
                overflow-x: auto;
                max-width: min(92vw, 980px);
            }
            .sy-custom-props-floatbar__row {
                display: flex;
                align-items: center;
                gap: 6px;
                flex-wrap: nowrap;
            }
            .sy-custom-props-floatbar__head {
                display: flex;
                align-items: center;
                justify-content: flex-end;
                width: 100%;
            }
            .sy-custom-props-floatbar__head-actions {
                display: inline-flex;
                align-items: center;
                gap: 6px;
            }
            .sy-custom-props-floatbar__prop {
                display: inline-flex;
                align-items: center;
                height: 26px;
                padding: 0 6px;
                border-radius: 6px;
                border: 1px solid var(--b3-border-color);
                background: var(--b3-theme-surface);
                color: var(--b3-theme-on-surface);
                font-size: 12px;
                line-height: 26px;
                cursor: pointer;
                user-select: none;
                transition: all 0.2s;
            }
            .sy-custom-props-floatbar__prop:hover {
                background: var(--b3-theme-background);
                border-color: var(--b3-theme-primary);
            }
            .sy-custom-props-floatbar__prop.is-priority-prop {
                border: 0;
                background: transparent;
                padding: 0 2px;
            }
            .sy-custom-props-floatbar__prop.is-priority-prop:hover {
                border: 0;
                background: transparent;
            }
            .sy-custom-props-floatbar__prop.is-active {
                background: var(--b3-theme-primary);
                border-color: var(--b3-theme-primary);
                color: var(--b3-theme-on-primary);
            }
            .sy-custom-props-floatbar__prop-value {
                font-weight: 500;
            }
            .sy-custom-props-floatbar__select {
                position: absolute;
                z-index: 3006;
                display: none;
                min-width: 120px;
                max-width: 200px;
                padding: 6px;
                border-radius: 8px;
                background: var(--b3-theme-background);
                border: 1px solid var(--b3-border-color);
                box-shadow: var(--b3-dialog-shadow);
            }
            .sy-custom-props-floatbar__select.is-visible {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .sy-custom-props-floatbar__option {
                width: 100%;
                text-align: left;
                height: 28px;
                line-height: 28px;
                padding: 0 10px;
                border-radius: 6px;
                border: 0;
                background: transparent;
                color: var(--b3-theme-on-surface);
                cursor: pointer;
                user-select: none;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .sy-custom-props-floatbar__option:hover {
                background: var(--b3-theme-surface-light);
            }
            .sy-custom-props-floatbar__option.is-active {
                background: var(--b3-theme-primary);
                color: var(--b3-theme-on-primary);
            }
            .sy-custom-props-floatbar__option-label {
                display: inline-flex;
                align-items: center;
                max-width: 100%;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .sy-custom-props-floatbar__option-label--status {
                padding: 2px 4px;
                border-radius: 5px;
                border: 1px solid var(--qb-status-border, rgba(117,117,117,0.35));
                background: var(--qb-status-bg, rgba(117,117,117,0.16));
                color: var(--qb-status-fg, #5f6368);
                line-height: 1.25;
                font-size: 14px;
                font-weight: 400;
                transition: filter 0.16s ease, opacity 0.16s ease;
            }
            .sy-custom-props-floatbar__option.is-status {
                height: 30px;
                line-height: normal;
                display: flex;
                align-items: center;
            }
            .sy-custom-props-floatbar__option.is-status:hover .sy-custom-props-floatbar__option-label--status {
                filter: saturate(1.08);
                opacity: 0.96;
            }
            .sy-custom-props-floatbar__option.is-status.is-active {
                background: var(--b3-theme-surface-light);
                color: inherit;
            }
            .sy-custom-props-floatbar__priority-chip,
            .sy-custom-props-floatbar__option-label--priority {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                border: 1px solid var(--qb-priority-border, rgba(117,117,117,0.35));
                background: var(--qb-priority-bg, rgba(117,117,117,0.16));
                color: var(--qb-priority-fg, #5f6368);
                line-height: 1.2;
                font-size: 14px;
                font-weight: 600;
                max-width: 100%;
                transition: filter 0.16s ease, opacity 0.16s ease;
            }
            .sy-custom-props-floatbar__priority-chip {
                height: 26px;
                line-height: 26px;
                padding: 0 8px;
                border-radius: 6px;
                box-sizing: content-box;
            }
            .sy-custom-props-floatbar__option-label--priority {
                padding: 2px 6px;
                border-radius: 5px;
            }
            .sy-custom-props-floatbar__priority-icon {
                width: 18px;
                height: 100%;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                line-height: 1;
            }
            .sy-custom-props-floatbar__priority-icon svg {
                width: 18px;
                height: 18px;
                display: block;
            }
            .sy-custom-props-floatbar__priority-text {
                line-height: 1;
            }
            .sy-custom-props-floatbar__option.is-priority {
                height: 30px;
                line-height: normal;
                display: flex;
                align-items: center;
            }
            .sy-custom-props-floatbar__option.is-priority:hover .sy-custom-props-floatbar__option-label--priority {
                filter: saturate(1.08);
                opacity: 0.96;
            }
            .sy-custom-props-floatbar__option.is-priority.is-active {
                background: var(--b3-theme-surface-light);
                color: inherit;
            }
            .sy-custom-props-floatbar__input-editor {
                position: absolute;
                z-index: 3007;
                display: none;
                min-width: 160px;
                max-width: 280px;
                padding: 10px;
                border-radius: 8px;
                background: var(--b3-theme-background);
                border: 1px solid var(--b3-border-color);
                box-shadow: var(--b3-dialog-shadow);
            }
            .sy-custom-props-floatbar__input-editor.is-visible {
                display: block;
            }
            .sy-custom-props-floatbar__input {
                width: 100%;
                box-sizing: border-box;
                height: 28px;
                line-height: 28px;
                padding: 0 8px;
                border-radius: 6px;
                border: 1px solid var(--b3-border-color);
                background: var(--b3-theme-surface);
                color: var(--b3-theme-on-surface);
                outline: none;
                font-size: 13px;
            }
            .sy-custom-props-floatbar__input:focus {
                border-color: var(--b3-theme-primary);
            }
            .sy-custom-props-floatbar__input-actions {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
                margin-top: 10px;
            }
            .sy-custom-props-floatbar__btn {
                height: 26px;
                line-height: 26px;
                padding: 0 12px;
                border-radius: 6px;
                border: 1px solid var(--b3-border-color);
                background: var(--b3-theme-surface);
                color: var(--b3-theme-on-surface);
                cursor: pointer;
                user-select: none;
                font-size: 12px;
            }
            .sy-custom-props-floatbar__btn:hover {
                background: var(--b3-theme-background);
            }
            .sy-custom-props-floatbar__action {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                height: 26px;
                width: 26px;
                border-radius: 6px;
                border: 1px solid var(--b3-border-color);
                background: var(--b3-theme-surface);
                color: var(--b3-theme-on-surface);
                cursor: pointer;
                user-select: none;
                transition: all 0.2s;
                padding: 0;
            }
            .sy-custom-props-floatbar__action .qb-icon {
                font-size: 13px;
                line-height: 1;
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }
            .sy-custom-props-floatbar__action.is-wide {
                width: auto;
                padding: 0 6px;
                gap: 4px;
            }
            .sy-custom-props-floatbar__action:hover {
                background: var(--b3-theme-background);
                border-color: var(--b3-theme-primary);
            }
            .sy-custom-props-inline-host {
                position: absolute;
                left: 0;
                top: 0;
                transform: none;
                display: inline-flex;
                align-items: center;
                gap: 4px;
                flex-wrap: nowrap;
                vertical-align: middle;
                white-space: nowrap;
                max-width: min(48vw, 420px);
                z-index: 2;
                visibility: hidden;
                opacity: 0;
                pointer-events: none;
            }
            .sy-custom-props-inline-host.is-ready {
                visibility: visible;
                opacity: 1;
                pointer-events: auto;
            }
            .sy-custom-props-inline-host.is-wrap {
                flex-wrap: wrap;
                align-items: flex-start;
                row-gap: 4px;
                white-space: normal;
            }
            .sy-custom-props-inline-chip {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                max-width: min(26vw, 180px);
                min-height: 20px;
                padding: 0 6px;
                border-radius: 999px;
                border: 1px solid var(--b3-border-color);
                background: var(--b3-theme-surface);
                color: var(--b3-theme-on-surface);
                font-size: 11px;
                line-height: 1.2;
                cursor: pointer;
                user-select: none;
                vertical-align: middle;
                flex: 0 0 auto;
            }
            .sy-custom-props-inline-chip:hover {
                filter: saturate(1.05);
                border-color: var(--b3-theme-primary);
            }
            .sy-custom-props-inline-chip-label,
            .sy-custom-props-inline-chip-value {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 100%;
            }
            .sy-custom-props-inline-chip-label {
                opacity: 0.66;
            }
            .sy-custom-props-inline-chip.is-empty {
                opacity: 0.7;
                border-style: dashed;
            }
            .sy-custom-props-inline-chip--status {
                padding: 0;
                border: 0;
                background: transparent;
            }
            .sy-custom-props-inline-chip--time {
                min-width: 0;
                padding: 0 6px;
            }
            .sy-custom-props-inline-chip--remark {
                max-width: min(34vw, 280px);
            }
            .sy-custom-props-inline-chip--priority {
                padding: 0;
                border: 0;
                background: transparent;
            }
            .sy-custom-props-inline-chip--priority .sy-custom-props-floatbar__priority-chip {
                height: 20px;
                line-height: 20px;
                padding: 0 6px;
                border-radius: 999px;
            }
            .sy-custom-props-inline-chip--priority .sy-custom-props-floatbar__priority-icon {
                width: 14px;
            }
            .sy-custom-props-inline-chip--priority .sy-custom-props-floatbar__priority-icon svg {
                width: 14px;
                height: 14px;
            }
            .sy-custom-props-inline-chip .sy-custom-props-floatbar__priority-chip,
            .sy-custom-props-inline-chip .sy-custom-props-floatbar__option-label--status {
                font-size: 12px;
            }
            .sy-custom-props-inline-layer {
                position: absolute;
                inset: 0;
                pointer-events: none;
                z-index: 12;
                overflow: visible;
            }
            .sy-custom-props-inline-layer.is-scrolling .sy-custom-props-inline-host {
                transition: none !important;
            }
        `.trim();
        document.head.appendChild(style);

        // 主悬浮条容器
        const floatBar = document.createElement('div');
        floatBar.className = 'sy-custom-props-floatbar';
        document.body.appendChild(floatBar);

        // 选择下拉菜单
        const selectMenu = document.createElement('div');
        selectMenu.className = 'sy-custom-props-floatbar__select';
        document.body.appendChild(selectMenu);

        // 输入编辑器
        const inputEditor = document.createElement('div');
        inputEditor.className = 'sy-custom-props-floatbar__input-editor';
        inputEditor.innerHTML = `
            <input type="text" class="sy-custom-props-floatbar__input" placeholder="输入内容..." />
            <div class="sy-custom-props-floatbar__input-actions">
                <button class="sy-custom-props-floatbar__btn" data-action="cancel">取消</button>
                <button class="sy-custom-props-floatbar__btn" data-action="save">确定</button>
            </div>
        `.trim();
        document.body.appendChild(inputEditor);

        // 状态变量
        let currentBlockEl = null;
        let currentBlockId = '';
        let currentProps = {};  // 当前块的所有自定义属性值
        let activePropConfig = null;  // 当前编辑的属性配置
        let inputResolve = null;  // 输入框Promise解析器

        function getBlockElById(blockId) {
            const id = String(blockId || '').trim();
            if (!id) return null;
            return document.querySelector(`.li[data-node-id="${id}"],[data-type="NodeListItem"][data-node-id="${id}"],[data-node-id="${id}"]`);
        }

        function resolveCurrentTaskId() {
            const blockEl = currentBlockEl || getBlockElById(currentBlockId) || null;
            const resolvedId = String(resolveTaskNodeIdForDetail(blockEl) || '').trim();
            if (resolvedId) return resolvedId;
            return String(currentBlockId || '').trim();
        }

        function resolveCurrentTaskName() {
            const blockEl = currentBlockEl || getBlockElById(currentBlockId) || null;
            return getTaskTitleFromBlockEl(blockEl);
        }

        async function resolveCurrentTaskIdForAi() {
            const rawId = String(resolveCurrentTaskId() || '').trim();
            if (!rawId) return '';
            try {
                const bridge = globalThis?.['siyuan-plugin-task-horizon']?.aiBridge;
                if (typeof bridge?.resolveTaskId === 'function') {
                    const resolved = String(await bridge.resolveTaskId(rawId) || '').trim();
                    if (resolved) return resolved;
                }
            } catch (e) {}
            return rawId;
        }

        // ==================== 核心功能函数 ====================

        // 更新配置中的状态选项
        function updateStatusOptionsInConfig() {
            const statusConfig = [...customPropsConfig.firstRow, ...customPropsConfig.secondRow]
                .find(p => p.attrKey === 'custom-status');
            if (statusConfig) {
                statusConfig.options = taskStatusOptions.map(o => ({
                    value: o.id,
                    label: o.name,
                    color: o.color
                }));
            }
        }

        // 从任务管理器读取状态选项
        async function loadStatusOptions() {
            try {
                // 尝试从 localStorage 读取任务管理器的状态选项
                const savedOptions = localStorage.getItem('tm_custom_status_options');
                if (savedOptions) {
                    const options = JSON.parse(savedOptions);
                    if (Array.isArray(options) && options.length > 0) {
                        // 检查是否有变化
                        const currentLength = taskStatusOptions.length;
                        const newLength = options.length;

                        if (currentLength !== newLength) {
                        }

                        taskStatusOptions = options;
                        // 更新配置中的状态选项
                        updateStatusOptionsInConfig();
                    }
                }
            } catch (e) {
                console.warn('读取状态选项失败:', e);
            }
        }

        __tmQBStatusRenderStorageHandler = (e) => {
            if (!e) return;
            if (e.key === 'tm_custom_status_options') {
                loadStatusOptions().then(() => {
                    try { renderFloatBar(); } catch (e) {}
                    try { scheduleInlineMetaRender(true); } catch (e) {}
                });
                return;
            }
            if (e.key === 'tm_enable_quickbar_inline_meta' || e.key === 'tm_quickbar_inline_fields' || e.key === 'tm_quickbar_inline_show_on_mobile') {
                try { refreshInlineMetaMode(true); } catch (e) {}
                return;
            }
            if (isInlineMetaScopeStorageKey(e.key)) {
                clearInlineMetaScopeDocCache();
                try { refreshInlineMetaMode(true); } catch (e) {}
            }
        };
        window.addEventListener('storage', __tmQBStatusRenderStorageHandler);

        // 获取块的自定义属性
        async function getBlockCustomAttrs(blockId) {
            try {
                const result = await requestApi('/api/attr/getBlockAttrs', { id: blockId });
                if (result?.code === 0) {
                    return result.data || {};
                }
            } catch (e) {
                console.error('获取块属性失败:', e);
            }
            return {};
        }

        // 设置块的自定义属性
        async function setBlockCustomAttrs(blockId, attrs) {
            try {
                const result = await requestApi('/api/attr/setBlockAttrs', {
                    id: blockId,
                    attrs: attrs
                });
                if (result?.code === 0) {
                    const id = String(blockId || '').trim();
                    if (id) {
                        const prev = inlineMetaCache.get(id) || normalizeCustomProps();
                        inlineMetaCache.set(id, normalizeCustomProps({ ...prev, ...attrs }));
                    }
                }
                return result?.code === 0;
            } catch (e) {
                console.error('设置块属性失败:', e);
                return false;
            }
        }

        // 格式化日期（YYYY-MM-DD / ISO / 时间戳 -> YYYY-MM-DD）
        function formatDate(value) {
            if (!value) return '';
            const s = String(value || '').trim();
            if (!s) return '';
            if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

            let d;
            if (/^\d+$/.test(s)) {
                const n = Number(s);
                d = new Date(n);
            } else {
                d = new Date(s);
            }
            if (Number.isNaN(d.getTime()) || d.getTime() === 0) return '';
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        }

        // 解析 YYYY-MM-DD（保持日期语义，避免时区偏移）
        function parseDate(dateStr) {
            const s = String(dateStr || '').trim();
            if (!s) return '';
            const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (!m) return '';
            return `${m[1]}-${m[2]}-${m[3]}`;
        }

        function getPriorityJiraInfo(value) {
            const p = String(value || '').trim().toLowerCase();
            if (p === 'high') return { key: 'high', label: '高', iconType: 'high', color: '#de350b', bg: 'rgba(222,53,11,0.14)', border: 'rgba(222,53,11,0.34)' };
            if (p === 'medium') return { key: 'medium', label: '中', iconType: 'medium', color: '#ff991f', bg: 'rgba(255,153,31,0.14)', border: 'rgba(255,153,31,0.34)' };
            if (p === 'low') return { key: 'low', label: '低', iconType: 'low', color: '#1d7afc', bg: 'rgba(29,122,252,0.14)', border: 'rgba(29,122,252,0.32)' };
            return { key: 'none', label: '无', iconType: 'none', color: '#9e9e9e', bg: 'rgba(158,158,158,0.12)', border: 'rgba(158,158,158,0.3)' };
        }

        function getPriorityJiraIconSvg(iconType) {
            const t = String(iconType || '').trim();
            if (t === 'high') {
                return `<svg viewBox="0 0 18 18" aria-hidden="true"><polyline points="2.5,10.1 9,6.1 15.5,10.1" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
            }
            if (t === 'medium') {
                return `<svg viewBox="0 0 18 18" aria-hidden="true"><line x1="2.5" y1="6.2" x2="15.5" y2="6.2" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/><line x1="2.5" y1="11.2" x2="15.5" y2="11.2" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>`;
            }
            if (t === 'low') {
                return `<svg viewBox="0 0 18 18" aria-hidden="true"><polyline points="2.5,7.1 9,11.1 15.5,7.1" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
            }
            return `<svg viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="5.2" fill="none" stroke="currentColor" stroke-width="2.6"/></svg>`;
        }

        function buildPriorityChipStyle(value) {
            const info = getPriorityJiraInfo(value);
            return `--qb-priority-bg:${info.bg};--qb-priority-fg:${info.color};--qb-priority-border:${info.border};`;
        }

        function renderPriorityChip(value, mode) {
            const info = getPriorityJiraInfo(value);
            const cls = mode === 'option'
                ? 'sy-custom-props-floatbar__option-label sy-custom-props-floatbar__option-label--priority'
                : 'sy-custom-props-floatbar__prop-value sy-custom-props-floatbar__priority-chip';
            const text = mode === 'option'
                ? `<span class="sy-custom-props-floatbar__priority-text">${info.label}</span>`
                : '';
            return `<span class="${cls}" style="${buildPriorityChipStyle(value)}"><span class="sy-custom-props-floatbar__priority-icon">${getPriorityJiraIconSvg(info.iconType)}</span>${text}</span>`;
        }

        // 获取状态选项的显示文本和颜色
        function getStatusDisplay(value) {
            const option = taskStatusOptions.find(o => o.id === value);
            return {
                name: option ? option.name : value,
                color: option ? option.color : '#757575'
            };
        }

        function hexToRgba(hex, alpha) {
            const s = String(hex || '').trim();
            const a = Math.max(0, Math.min(1, Number(alpha) || 0));
            const m3 = /^#([0-9a-fA-F]{3})$/.exec(s);
            const m6 = /^#([0-9a-fA-F]{6})$/.exec(s);
            if (m3) {
                const h = m3[1];
                const r = parseInt(h[0] + h[0], 16);
                const g = parseInt(h[1] + h[1], 16);
                const b = parseInt(h[2] + h[2], 16);
                return `rgba(${r}, ${g}, ${b}, ${a})`;
            }
            if (m6) {
                const h = m6[1];
                const r = parseInt(h.slice(0, 2), 16);
                const g = parseInt(h.slice(2, 4), 16);
                const b = parseInt(h.slice(4, 6), 16);
                return `rgba(${r}, ${g}, ${b}, ${a})`;
            }
            return '';
        }

        function buildStatusChipStyle(color) {
            const c = String(color || '#757575').trim() || '#757575';
            const bg = hexToRgba(c, 0.16) || 'rgba(117,117,117,0.16)';
            const border = hexToRgba(c, 0.35) || 'rgba(117,117,117,0.35)';
            return `--qb-status-bg:${bg};--qb-status-fg:${c};--qb-status-border:${border};`;
        }

        function normalizeCustomProps(attrs) {
            const data = attrs && typeof attrs === 'object' ? attrs : {};
            return {
                'custom-priority': data['custom-priority'] || 'none',
                'custom-status': data['custom-status'] || 'todo',
                'custom-completion-time': data['custom-completion-time'] || '',
                'custom-start-date': data['custom-start-date'] || '',
                'custom-duration': data['custom-duration'] || '',
                'custom-remark': data['custom-remark'] || '',
                'custom-pinned': data['custom-pinned'] || ''
            };
        }

        function getInlineFieldConfig(attrKey) {
            const key = String(attrKey || '').trim();
            const inlineConfig = quickbarInlineFieldDefs.find(item => item.attrKey === key);
            if (!inlineConfig) return null;
            const floatbarConfig = [...customPropsConfig.firstRow, ...customPropsConfig.secondRow]
                .find(item => String(item?.attrKey || '').trim() === key);
            if (!floatbarConfig) return { ...inlineConfig };
            return { ...floatbarConfig, ...inlineConfig, options: Array.isArray(floatbarConfig.options) ? floatbarConfig.options : inlineConfig.options };
        }

        function truncateInlineValue(value, max = 16) {
            const text = String(value || '').trim();
            if (!text) return '';
            return text.length > max ? `${text.slice(0, max)}...` : text;
        }

        function formatInlineCompletionDisplay(value) {
            const s = String(value || '').trim();
            if (!s) return '';
            const direct = s.match(/(?:T|\s)(\d{2}:\d{2})(?::\d{2})?$/);
            if (direct) return direct[1];
            if (/^\d{2}:\d{2}(?::\d{2})?$/.test(s)) return s.slice(0, 5);
            if (/^\d+$/.test(s)) {
                const d = new Date(Number(s));
                if (Number.isNaN(d.getTime())) return '';
                if (d.getHours() || d.getMinutes()) {
                    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                }
                return formatDate(d.getTime());
            }
            return formatDate(s);
        }

        function renderInlineMetaField(config, value) {
            if (!config) return '';
            const attrKey = String(config.attrKey || '').trim();
            const escapedAttr = attrKey.replace(/"/g, '&quot;');
            const escapedName = String(config.name || '').replace(/"/g, '&quot;');
            const rawValue = String(value ?? '');
            const escapedValue = rawValue.replace(/"/g, '&quot;');
            if (attrKey === 'custom-status') {
                const statusInfo = getStatusDisplay(rawValue || 'todo');
                return `
                    <span class="sy-custom-props-inline-chip sy-custom-props-inline-chip--status" data-inline-attr="${escapedAttr}" data-inline-type="select" data-inline-name="${escapedName}" data-inline-value="${escapedValue}" title="${escapedName}">
                        <span class="sy-custom-props-floatbar__option-label sy-custom-props-floatbar__option-label--status" style="${buildStatusChipStyle(statusInfo.color)}">${statusInfo.name}</span>
                    </span>
                `.trim();
            }
            if (attrKey === 'custom-priority') {
                return `
                    <span class="sy-custom-props-inline-chip sy-custom-props-inline-chip--priority" data-inline-attr="${escapedAttr}" data-inline-type="select" data-inline-name="${escapedName}" data-inline-value="${escapedValue}" title="${escapedName}">
                        ${renderPriorityChip(rawValue || 'none', 'prop')}
                    </span>
                `.trim();
            }
            if (attrKey === 'custom-completion-time') {
                const timeText = formatInlineCompletionDisplay(rawValue);
                if (!timeText) return '';
                return `
                    <span class="sy-custom-props-inline-chip sy-custom-props-inline-chip--time" data-inline-attr="${escapedAttr}" data-inline-type="${config.type}" data-inline-name="${escapedName}" data-inline-value="${escapedValue}" title="${escapedName}">
                        <span class="sy-custom-props-inline-chip-value">${esc(timeText)}</span>
                    </span>
                `.trim();
            }
            const isDate = config.type === 'date';
            const displayValue = isDate ? formatDate(rawValue) : truncateInlineValue(rawValue, attrKey === 'custom-remark' ? 24 : 10);
            if (!displayValue) return '';
            return `
                <span class="sy-custom-props-inline-chip ${attrKey === 'custom-remark' ? 'sy-custom-props-inline-chip--remark' : ''}" data-inline-attr="${escapedAttr}" data-inline-type="${config.type}" data-inline-name="${escapedName}" data-inline-value="${escapedValue}" title="${escapedName}">
                    <span class="sy-custom-props-inline-chip-value">${esc(displayValue)}</span>
                </span>
            `.trim();
        }

        async function getTaskCustomProps(blockId, forceRefresh = false) {
            const id = String(blockId || '').trim();
            if (!id) return normalizeCustomProps();
            if (!forceRefresh && inlineMetaCache.has(id)) return inlineMetaCache.get(id);
            const attrs = await getBlockCustomAttrs(id);
            const props = normalizeCustomProps(attrs);
            inlineMetaCache.set(id, props);
            return props;
        }

        function patchInlineMetaCache(taskId, patch) {
            const id = String(taskId || '').trim();
            if (!id || !patch || typeof patch !== 'object') return;
            const base = inlineMetaCache.get(id) || normalizeCustomProps();
            const next = normalizeCustomProps({ ...base, ...patch });
            inlineMetaCache.set(id, next);
        }

        function refreshInlineMetaByTaskId(taskId, forceRefresh = false) {
            const id = String(taskId || '').trim();
            if (!id || !isInlineMetaEnabled()) return;
            const blockEl = getBlockElById(id);
            if (!blockEl) {
                requestInlineMetaRender(!!forceRefresh);
                return;
            }
            Promise.resolve(renderInlineMetaForBlock(blockEl, !!forceRefresh, 420)).catch(() => null);
        }

        function getInlineCachedProps(blockId) {
            const id = String(blockId || '').trim();
            if (!id) return normalizeCustomProps();
            return inlineMetaCache.get(id) || normalizeCustomProps();
        }

        function ensureTaskPropsReady(blockId, forceRefresh = false) {
            const id = String(blockId || '').trim();
            if (!id) return Promise.resolve(normalizeCustomProps());
            if (!forceRefresh && inlineMetaCache.has(id)) return Promise.resolve(inlineMetaCache.get(id));
            const inflight = inlineMetaPropsInflight.get(id);
            if (inflight && !forceRefresh) return inflight;
            const p = Promise.resolve(getTaskCustomProps(id, forceRefresh))
                .catch(() => normalizeCustomProps())
                .finally(() => {
                    if (inlineMetaPropsInflight.get(id) === p) inlineMetaPropsInflight.delete(id);
                });
            inlineMetaPropsInflight.set(id, p);
            return p;
        }

        function prefetchInlineMetaProps(blocks, maxCount = 220) {
            const list = Array.isArray(blocks) ? blocks : [];
            for (let i = 0; i < list.length && i < maxCount; i += 1) {
                const blockId = String(list[i]?.dataset?.nodeId || '').trim();
                if (!blockId) continue;
                if (inlineMetaCache.has(blockId) || inlineMetaPropsInflight.has(blockId)) continue;
                Promise.resolve(ensureTaskPropsReady(blockId, false)).catch(() => null);
            }
        }

        function renderInlineMetaHtml(cfg, props) {
            const settings = cfg && Array.isArray(cfg.fields) ? cfg : getQuickbarInlineSettings();
            const sourceProps = props && typeof props === 'object' ? props : normalizeCustomProps();
            return settings.fields
                .map((attrKey) => renderInlineMetaField(getInlineFieldConfig(attrKey), sourceProps[attrKey]))
                .filter(Boolean).join('');
        }

        // 获取或更新当前块的所有自定义属性
        async function refreshBlockAttrs() {
            if (!currentBlockId) return;
            currentProps = await getTaskCustomProps(currentBlockId, true);
        }

        // 渲染悬浮条
        function renderFloatBar() {
            const rows = [];
            const allProps = [...customPropsConfig.firstRow, ...customPropsConfig.secondRow]
                .map(config => renderPropElement(config, currentProps[config.attrKey]));
            if (isAiFeatureEnabled()) {
                allProps.push(`<button class="sy-custom-props-floatbar__action" data-action="ai-title" title="AI 优化任务名称"><span class="qb-icon">✨</span></button>`);
            }
            allProps.push(`<button class="sy-custom-props-floatbar__action" data-action="reminder" title="添加提醒">⏰</button>`);
            allProps.push(`<button class="sy-custom-props-floatbar__action" data-action="more" title="更多">⋯</button>`);
            rows.push(`<div class="sy-custom-props-floatbar__row">${allProps.join('')}</div>`);

            floatBar.innerHTML = rows.join('');

            // 绑定点击事件
            bindPropClickEvents();
        }

        // 渲染单个属性元素
        function renderPropElement(config, value) {
            const escapedName = String(config.name).replace(/"/g, '&quot;');
            const escapedValue = String(value ?? '').replace(/"/g, '&quot;');

            if (config.type === 'select') {
                if (config.attrKey === 'custom-priority') {
                    return `
                        <span class="sy-custom-props-floatbar__prop is-priority-prop"
                              data-attr="${config.attrKey}"
                              data-type="${config.type}"
                              data-name="${escapedName}"
                              data-value="${escapedValue}"
                              title="${escapedName}">
                            ${renderPriorityChip(value, 'prop')}
                        </span>
                    `;
                }

                // 状态选择器保持原样
                const statusInfo = getStatusDisplay(value);
                const displayText = statusInfo.name;
                const bgColor = `${statusInfo.color}20`;  // 带透明度
                const color = statusInfo.color;
                return `
                    <span class="sy-custom-props-floatbar__prop"
                          data-attr="${config.attrKey}"
                          data-type="${config.type}"
                          data-name="${escapedName}"
                          data-value="${escapedValue}"
                          title="${escapedName}"
                          style="background: ${bgColor}; border-color: ${color}; color: ${color};">
                        <span class="sy-custom-props-floatbar__prop-value">${displayText}</span>
                    </span>
                `;
            } else if (config.type === 'date') {
                // 日期类型属性
                const displayText = value ? formatDate(value) : '🗓️日期';
                const isEmpty = !value;
                const style = isEmpty ? 'opacity: 0.6;' : '';

                return `
                    <span class="sy-custom-props-floatbar__prop"
                          data-attr="${config.attrKey}"
                          data-type="${config.type}"
                          data-name="${escapedName}"
                          data-value="${escapedValue}"
                          title="${escapedName}"
                          style="${style}">
                        <span class="sy-custom-props-floatbar__prop-value">${displayText}</span>
                    </span>
                `;
            } else {
                // 文本类型属性（时长、备注）
                const displayText = value || escapedName;
                const isEmpty = !value;
                const style = isEmpty ? 'opacity: 0.6;' : '';
                const truncatedValue = String(displayText).length > 15
                    ? String(displayText).substring(0, 15) + '...'
                    : displayText;

                return `
                    <span class="sy-custom-props-floatbar__prop"
                          data-attr="${config.attrKey}"
                          data-type="${config.type}"
                          data-name="${escapedName}"
                          data-value="${escapedValue}"
                          title="${escapedName}"
                          style="${style}">
                        <span class="sy-custom-props-floatbar__prop-value">${truncatedValue}</span>
                    </span>
                `;
            }
        }

        // 绑定属性点击事件
        function bindPropClickEvents() {
            floatBar.onclick = async (e) => {
                const actionEl = e.target.closest('.sy-custom-props-floatbar__action');
                if (actionEl) {
                    const action = String(actionEl.dataset.action || '');
                    if (action === 'reminder') {
                        const showDialog = globalThis.__tomatoReminder?.showDialog;
                        if (typeof showDialog === 'function') {
                            const taskId = resolveCurrentTaskId();
                            if (!taskId) {
                                showMessage('未找到任务', true, 1800);
                                return;
                            }
                            const name = resolveCurrentTaskName();
                            showDialog(taskId, name || '任务');
                        } else {
                            showMessage('未检测到提醒功能，请确认番茄插件已启用', true, 2000);
                        }
                        return;
                    }
                    if (action === 'ai-title') {
                        try {
                            if (!isAiFeatureEnabled()) {
                                showMessage('AI 功能已关闭', true, 1800);
                                return;
                            }
                            const taskIdForAi = await resolveCurrentTaskIdForAi();
                            if (!taskIdForAi) {
                                showMessage('未找到任务', true, 1800);
                                return;
                            }
                            if (typeof globalThis.tmAiOptimizeTaskName === 'function') {
                                await globalThis.tmAiOptimizeTaskName(taskIdForAi);
                            } else {
                                showMessage('AI 模块尚未加载', true, 1800);
                            }
                        } catch (err) {
                            showMessage(String(err?.message || err || 'AI 执行失败'), true, 2200);
                        }
                        return;
                    }
                    if (action === 'more') {
                        const openTaskDetail = globalThis.tmOpenTaskDetail;
                        const detailId = resolveCurrentTaskId();
                        // 确保 ID 有效
                        if (!detailId) {
                            showMessage('无法获取任务ID', true, 1800);
                            return;
                        }
                        if (typeof openTaskDetail === 'function') {
                            try {
                                // 确保传递正确的事件对象
                                const eventObj = e || (typeof event !== 'undefined' ? event : undefined);
                                const opened = await openTaskDetail(detailId, eventObj);
                                if (opened) {
                                    hideFloatBar();
                                    return;
                                }
                            } catch (err) {
                                console.error('打开任务详情出错:', err);
                            }
                        } else {
                            console.warn('[Quickbar] tmOpenTaskDetail函数未找到，请确保任务管理器插件已加载');
                        }
                        showMessage('打开任务详情失败', true, 1800);
                    }
                    return;
                }
                const propEl = e.target.closest('.sy-custom-props-floatbar__prop');
                if (!propEl) return;

                const attrKey = propEl.dataset.attr;
                const propType = propEl.dataset.type;
                const propName = propEl.dataset.name;
                const currentValue = propEl.dataset.value;

                // 找到对应的属性配置
                const allProps = [...customPropsConfig.firstRow, ...customPropsConfig.secondRow];
                activePropConfig = allProps.find(p => p.attrKey === attrKey);
                if (!activePropConfig) return;

                // 如果是状态属性，每次打开前重新加载选项
                if (attrKey === 'custom-status') {
                    loadStatusOptions();
                }

                if (propType === 'select') {
                    // 显示选择菜单
                    showSelectMenu(propEl, activePropConfig, currentValue);
                } else if (propType === 'date') {
                    // 显示日期选择器
                    showDateEditor(propEl, activePropConfig, currentValue);
                } else {
                    // 显示文本输入框
                    showTextEditor(propEl, activePropConfig, currentValue);
                }
            };
        }

        // 显示选择菜单
        function showSelectMenu(anchorEl, config, currentValue) {
            const options = config.options;
            if (!Array.isArray(options) || options.length === 0) return;
            const isStatusSelect = String(config?.attrKey || '').trim() === 'custom-status';
            const isPrioritySelect = String(config?.attrKey || '').trim() === 'custom-priority';

            // 更新菜单内容
            selectMenu.innerHTML = options.map(opt => {
                const isActive = opt.value === currentValue ? 'is-active' : '';
                const escapedValue = String(opt.label).replace(/"/g, '&quot;');
                const optionCls = isPrioritySelect
                    ? `sy-custom-props-floatbar__option is-priority ${isActive}`
                    : (isStatusSelect
                    ? `sy-custom-props-floatbar__option is-status ${isActive}`
                    : `sy-custom-props-floatbar__option ${isActive}`);
                const labelHtml = isPrioritySelect
                    ? renderPriorityChip(opt.value, 'option')
                    : (isStatusSelect
                    ? `<span class="sy-custom-props-floatbar__option-label sy-custom-props-floatbar__option-label--status" style="${buildStatusChipStyle(opt.color)}">${opt.label}</span>`
                    : `<span class="sy-custom-props-floatbar__option-label">${opt.label}</span>`);
                return `
                    <button class="${optionCls}"
                            data-value="${opt.value}"
                            data-label="${escapedValue}">
                        ${labelHtml}
                    </button>
                `.trim();
            }).join('');

            // 计算位置
            const anchorRect = anchorEl.getBoundingClientRect();
            const maxLen = options.reduce((m, o) => Math.max(m, String(o?.label || '').length), 0);
            const menuWidth = isPrioritySelect
                ? Math.min(140, Math.max(84, maxLen * 10 + 18))
                : (isStatusSelect
                ? Math.min(170, Math.max(96, maxLen * 12 + 24))
                : Math.min(200, Math.max(120, maxLen * 14 + 32)));

            if (isPrioritySelect) {
                selectMenu.style.minWidth = '84px';
                selectMenu.style.maxWidth = '140px';
            } else if (isStatusSelect) {
                selectMenu.style.minWidth = '96px';
                selectMenu.style.maxWidth = '170px';
            } else {
                selectMenu.style.minWidth = '120px';
                selectMenu.style.maxWidth = '200px';
            }
            selectMenu.style.width = `${menuWidth}px`;
            selectMenu.style.left = `${window.scrollX + anchorRect.left}px`;
            selectMenu.style.top = `${window.scrollY + anchorRect.bottom + 4}px`;
            selectMenu.classList.add('is-visible');

            // 绑定选择事件
            selectMenu.onclick = async (e) => {
                const optionEl = e.target.closest('.sy-custom-props-floatbar__option');
                if (!optionEl) {
                    selectMenu.classList.remove('is-visible');
                    return;
                }

                const newValue = optionEl.dataset.value;
                const newLabel = optionEl.dataset.label;

                // 更新属性
                const success = await setBlockCustomAttrs(currentBlockId, {
                    [config.attrKey]: newValue
                });

                if (success) {
                    currentProps[config.attrKey] = newValue;
                    renderFloatBar();
                    patchInlineMetaCache(currentBlockId, { [config.attrKey]: newValue });
                    refreshInlineMetaByTaskId(currentBlockId, false);
                    showMessage(`已更新${config.name}`, false, 1500);
                    // 通知任务管理器刷新该任务
                    try {
                        window.dispatchEvent(new CustomEvent('tm-task-attr-updated', {
                            detail: { taskId: currentBlockId, attrKey: config.attrKey, value: newValue }
                        }));
                    } catch (e) {}
                } else {
                    showMessage('更新失败', true, 2000);
                }

                selectMenu.classList.remove('is-visible');
            };
        }

        // 显示日期编辑器
        function showDateEditor(anchorEl, config, currentValue) {
            const blockIdAtOpen = String(currentBlockId || '').trim();
            if (!blockIdAtOpen) {
                showMessage('无法获取任务ID', true, 1800);
                return;
            }
            const saveDateValue = async (rawDateValue) => {
                const newValue = rawDateValue ? parseDate(rawDateValue) : '';
                const success = await setBlockCustomAttrs(blockIdAtOpen, {
                    [config.attrKey]: newValue
                });
                if (success) {
                    if (String(currentBlockId || '').trim() === blockIdAtOpen) {
                        currentProps[config.attrKey] = newValue;
                        renderFloatBar();
                    }
                    patchInlineMetaCache(blockIdAtOpen, { [config.attrKey]: newValue });
                    refreshInlineMetaByTaskId(blockIdAtOpen, false);
                    showMessage(`已更新${config.name}`, false, 1500);
                    // 通知任务管理器刷新该任务
                    try {
                        window.dispatchEvent(new CustomEvent('tm-task-attr-updated', {
                            detail: { taskId: blockIdAtOpen, attrKey: config.attrKey, value: newValue }
                        }));
                    } catch (e) {}
                } else {
                    showMessage('更新失败', true, 2000);
                }
            };
            const isTouchLike = isMobileDevice();
            if (isTouchLike) {
                // 移动端/触屏：直接系统日期选择器，避免中间输入框导致第一次交互丢失
                inputEditor.classList.remove('is-visible');
                const anchorRect = anchorEl.getBoundingClientRect();
                const tempInput = document.createElement('input');
                tempInput.type = 'date';
                tempInput.value = currentValue ? formatDate(currentValue) : '';
                tempInput.setAttribute('aria-hidden', 'true');
                tempInput.style.cssText = `position:fixed;left:${Math.max(0, Math.round(anchorRect.left))}px;top:${Math.max(0, Math.round(anchorRect.bottom))}px;width:1px;height:1px;opacity:0;pointer-events:none;`;
                document.body.appendChild(tempInput);

                let cleaned = false;
                let committed = false;
                const cleanup = () => {
                    if (cleaned) return;
                    cleaned = true;
                    try { tempInput.oninput = null; } catch (e) {}
                    try { tempInput.onchange = null; } catch (e) {}
                    try { tempInput.remove(); } catch (e) {}
                };
                const commitIfAny = async () => {
                    if (committed) return;
                    const picked = String(tempInput.value || '').trim();
                    const oldDate = currentValue ? formatDate(currentValue) : '';
                    if (!picked && !oldDate) return;
                    if (picked === oldDate) return;
                    committed = true;
                    await saveDateValue(picked);
                    cleanup();
                };

                tempInput.oninput = () => { commitIfAny(); };
                tempInput.onchange = () => { commitIfAny(); };

                // 只做超时清理，不用 blur 结束，避免选择器未完成就被提前清理
                setTimeout(() => cleanup(), 20000);

                try { tempInput.focus({ preventScroll: true }); } catch (e) {}
                // 延迟一帧再弹起，规避首次点击事件竞争
                setTimeout(() => {
                    try { tempInput.showPicker?.(); } catch (e) {
                        try { tempInput.click(); } catch (e2) {}
                    }
                }, 60);
                return;
            }

            // 桌面端：保留输入框弹层，并支持“清除日期”
            const input = inputEditor.querySelector('.sy-custom-props-floatbar__input');
            const oldValue = currentValue ? formatDate(currentValue) : '';
            input.type = 'date';
            input.value = oldValue;

            const anchorRect = anchorEl.getBoundingClientRect();
            inputEditor.style.left = `${window.scrollX + anchorRect.left}px`;
            inputEditor.style.top = `${window.scrollY + anchorRect.bottom + 4}px`;
            inputEditor.classList.add('is-visible');

            input.focus();
            try { input.showPicker?.(); } catch (e) {}
            input.onclick = () => {
                try { input.showPicker?.(); } catch (e) {}
            };

            const saveDate = async () => {
                await saveDateValue(input.value);
                inputEditor.classList.remove('is-visible');
            };

            input.onchange = () => saveDate();
            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    saveDate();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    inputEditor.classList.remove('is-visible');
                }
            };

            inputEditor.querySelector('[data-action="save"]').onclick = saveDate;
            inputEditor.querySelector('[data-action="cancel"]').onclick = () => {
                inputEditor.classList.remove('is-visible');
            };
            return;
        }

        // 显示文本编辑器
        function showTextEditor(anchorEl, config, currentValue) {
            const input = inputEditor.querySelector('.sy-custom-props-floatbar__input');
            input.type = 'text';
            input.value = currentValue || '';
            input.placeholder = config.placeholder || '输入内容...';

            // 计算位置
            const anchorRect = anchorEl.getBoundingClientRect();
            inputEditor.style.left = `${window.scrollX + anchorRect.left}px`;
            inputEditor.style.top = `${window.scrollY + anchorRect.bottom + 4}px`;
            inputEditor.classList.add('is-visible');

            input.focus();
            input.select();

            // 绑定事件
            const saveText = async () => {
                const newValue = input.value.trim();

                const success = await setBlockCustomAttrs(currentBlockId, {
                    [config.attrKey]: newValue
                });

                if (success) {
                    currentProps[config.attrKey] = newValue;
                    renderFloatBar();
                    patchInlineMetaCache(currentBlockId, { [config.attrKey]: newValue });
                    refreshInlineMetaByTaskId(currentBlockId, false);
                    if (newValue) {
                        showMessage(`已更新${config.name}`, false, 1500);
                    } else {
                        showMessage(`已清除${config.name}`, false, 1500);
                    }
                    // 通知任务管理器刷新该任务
                    try {
                        window.dispatchEvent(new CustomEvent('tm-task-attr-updated', {
                            detail: { taskId: currentBlockId, attrKey: config.attrKey, value: newValue }
                        }));
                    } catch (e) {}
                } else {
                    showMessage('更新失败', true, 2000);
                }

                inputEditor.classList.remove('is-visible');
            };

            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    saveText();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    inputEditor.classList.remove('is-visible');
                }
            };

            inputEditor.querySelector('[data-action="save"]').onclick = saveText;
            inputEditor.querySelector('[data-action="cancel"]').onclick = () => {
                inputEditor.classList.remove('is-visible');
            };
        }

        // 隐藏所有弹出层
        function hideAllPopups() {
            selectMenu.classList.remove('is-visible');
            inputEditor.classList.remove('is-visible');
        }

        // 更新悬浮条位置
        function updatePosition() {
            if (!currentBlockEl || floatBar.style.display === 'none') return;
            if (!currentBlockEl.isConnected) {
                hideFloatBar();
                return;
            }

            const rect = currentBlockEl.getBoundingClientRect();
            const barHeight = floatBar.getBoundingClientRect().height || 40;
            const barWidth = floatBar.getBoundingClientRect().width || 240;
            const gap = 0;

            let top = window.scrollY + rect.top - gap - barHeight;
            if (top < window.scrollY + 4) {
                top = window.scrollY + rect.bottom + gap;
            }

            const desiredLeft = window.scrollX + rect.left + 30;
            const viewportW = document.documentElement?.clientWidth || window.innerWidth || 0;
            const minLeft = window.scrollX + 4;
            const maxLeft = window.scrollX + Math.max(0, viewportW - barWidth - 4);
            const left = Math.max(minLeft, Math.min(desiredLeft, maxLeft));
            floatBar.style.top = `${Math.max(0, top)}px`;
            floatBar.style.left = `${Math.max(0, left)}px`;
        }

        // 显示悬浮条
        async function showFloatBar(blockEl) {
            currentBlockEl = blockEl;
            currentBlockId = blockEl.dataset.nodeId;

            // 读取当前块的自定义属性
            await refreshBlockAttrs();

            // 渲染悬浮条
            renderFloatBar();

            // 显示并定位
            floatBar.style.display = 'flex';
            hideAllPopups();
            updatePosition();
        }

        // 隐藏悬浮条
        function hideFloatBar() {
            floatBar.style.display = 'none';
            hideAllPopups();
            currentBlockEl = null;
            currentBlockId = '';
            currentProps = {};
        }

        function removeInlineMetaNodes() {
            try { document.querySelectorAll('.sy-custom-props-inline-layer').forEach((el) => el.remove()); } catch (e) {}
            inlineMetaLayer = null;
        }

        function ensureInlineMetaLayer(blockEl) {
            const root = blockEl?.closest?.('.protyle');
            const container = root?.querySelector?.('.protyle-content') || root?.querySelector?.('.protyle-wysiwyg') || root;
            if (!container) return null;
            let layer = container.querySelector?.(':scope > .sy-custom-props-inline-layer[data-inline-layer="true"]') || null;
            const duplicateLayers = Array.from(container.querySelectorAll?.(':scope > .sy-custom-props-inline-layer[data-inline-layer="true"]') || []);
            if (!layer && duplicateLayers.length) layer = duplicateLayers[0];
            duplicateLayers.slice(layer ? 1 : 0).forEach((node) => {
                try { node.remove(); } catch (e) {}
            });
            if (layer && layer.isConnected) {
                inlineMetaLayer = layer;
                try { layer.setAttribute('contenteditable', 'false'); } catch (e) {}
                try { layer.setAttribute('aria-hidden', 'true'); } catch (e) {}
                return layer;
            }
            try {
                if (window.getComputedStyle(container).position === 'static') {
                    container.style.position = 'relative';
                }
            } catch (e) {}
            layer = document.createElement('div');
            layer.className = 'sy-custom-props-inline-layer';
            layer.setAttribute('data-inline-layer', 'true');
            layer.setAttribute('contenteditable', 'false');
            layer.setAttribute('aria-hidden', 'true');
            container.appendChild(layer);
            inlineMetaLayer = layer;
            return layer;
        }

        function getInlineHostParent(blockEl) {
            if (!blockEl) return null;
            return blockEl;
        }

        function getInlineViewportBounds(blockEl) {
            if (!blockEl) return null;
            try {
                const root = blockEl.closest?.('.protyle');
                const content = root?.querySelector?.('.protyle-content') || root?.querySelector?.('.protyle-wysiwyg') || root;
                const rect = content?.getBoundingClientRect?.();
                if (!rect) return null;
                if (rect.width <= 0 || rect.height <= 0) return null;
                return rect;
            } catch (e) {
                return null;
            }
        }

        function getInlineTextAnchor(blockEl) {
            if (!blockEl) return null;
            return blockEl.querySelector?.(':scope > .p') || blockEl.querySelector?.('.p') || null;
        }

        function rectsOverlap(a, b, gap = 4) {
            if (!a || !b) return false;
            return !(
                (a.right + gap) <= b.left ||
                (b.right + gap) <= a.left ||
                (a.bottom + gap) <= b.top ||
                (b.bottom + gap) <= a.top
            );
        }

        function isInlineRectVisibleInBounds(rect, bounds, buffer = 0) {
            if (!rect) return false;
            const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || 0;
            const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 0;
            const leftBound = Math.max(0, Math.round(bounds?.left ?? 0));
            const rightBound = Math.min(viewportWidth, Math.round(bounds?.right ?? viewportWidth));
            const topBound = Math.max(0, Math.round(bounds?.top ?? 0));
            const bottomBound = Math.min(viewportHeight, Math.round(bounds?.bottom ?? viewportHeight));
            if (rightBound <= leftBound || bottomBound <= topBound) return false;
            if ((rect.right + buffer) < leftBound) return false;
            if ((rect.left - buffer) > rightBound) return false;
            if ((rect.bottom + buffer) < topBound) return false;
            if ((rect.top - buffer) > bottomBound) return false;
            return true;
        }

        function getInlineTextTailRect(textAnchor) {
            if (!textAnchor) return null;
            try {
                const walker = document.createTreeWalker(textAnchor, NodeFilter.SHOW_TEXT, {
                    acceptNode(node) {
                        const text = String(node?.nodeValue || '').replace(/\u200b/g, '').trim();
                        if (!text) return NodeFilter.FILTER_REJECT;
                        const parent = node.parentElement;
                        if (parent?.closest?.('.sy-custom-props-inline-host')) return NodeFilter.FILTER_REJECT;
                        return NodeFilter.FILTER_ACCEPT;
                    }
                });
                let lastTextNode = null;
                while (walker.nextNode()) lastTextNode = walker.currentNode;
                if (lastTextNode) {
                    const raw = String(lastTextNode.nodeValue || '').replace(/\u200b/g, '');
                    const endOffset = raw.length;
                    if (endOffset > 0) {
                        const range = document.createRange();
                        range.setStart(lastTextNode, 0);
                        range.setEnd(lastTextNode, endOffset);
                        const rects = Array.from(range.getClientRects()).filter((rect) => rect && rect.width >= 0);
                        if (rects.length) return rects[rects.length - 1];
                        const rect = range.getBoundingClientRect();
                        if (rect && (rect.width || rect.height)) return rect;
                    }
                }
            } catch (e) {}
            return null;
        }

        function getInlinePlainText(textAnchor) {
            if (!textAnchor) return '';
            try {
                const walker = document.createTreeWalker(textAnchor, NodeFilter.SHOW_TEXT, {
                    acceptNode(node) {
                        const parent = node?.parentElement;
                        if (parent?.closest?.('.sy-custom-props-inline-host')) return NodeFilter.FILTER_REJECT;
                        return NodeFilter.FILTER_ACCEPT;
                    }
                });
                let out = '';
                while (walker.nextNode()) out += String(walker.currentNode?.nodeValue || '');
                return out.replace(/\u200b/g, '').trim();
            } catch (e) {
                return String(textAnchor.textContent || '').replace(/\u200b/g, '').trim();
            }
        }

        function getInlineTextFastSignature(textAnchor) {
            return String(textAnchor?.textContent || '').replace(/\u200b/g, '').trim();
        }

        function isInlineMetaEditingBlock(blockEl) {
            if (!blockEl) return false;
            try {
                const selection = window.getSelection?.();
                const anchorNode = selection?.anchorNode || null;
                const focusNode = selection?.focusNode || null;
                const anchorEl = anchorNode?.nodeType === Node.ELEMENT_NODE ? anchorNode : anchorNode?.parentElement;
                const focusEl = focusNode?.nodeType === Node.ELEMENT_NODE ? focusNode : focusNode?.parentElement;
                if (anchorEl && blockEl.contains(anchorEl)) return true;
                if (focusEl && blockEl.contains(focusEl)) return true;
            } catch (e) {}
            try {
                const active = document.activeElement;
                if (active && blockEl.contains(active)) return true;
            } catch (e) {}
            return false;
        }

        function ensureInlineHost(blockEl) {
            const layer = ensureInlineMetaLayer(blockEl);
            if (!layer) return null;
            const blockId = String(resolveTaskNodeIdForDetail(blockEl) || blockEl?.dataset?.nodeId || '').trim();
            if (!blockId) return null;
            let host = layer.querySelector(`.sy-custom-props-inline-host[data-block-id="${blockId}"]`);
            if (!host) {
                host = document.createElement('span');
                host.className = 'sy-custom-props-inline-host';
                host.setAttribute('contenteditable', 'false');
                host.setAttribute('data-inline-meta-host', 'true');
                host.setAttribute('data-block-id', blockId);
                host.addEventListener('pointerdown', async (e) => {
                    const chip = e.target.closest('.sy-custom-props-inline-chip');
                    if (!chip) return;
                    e.preventDefault();
                    e.stopPropagation();
                    try { e.stopImmediatePropagation?.(); } catch (err) {}
                    inlineMetaInteractUntil = Date.now() + 500;
                    const blockId = String(host.dataset.blockId || '').trim();
                    const blockRef = getBlockElById(blockId) || blockEl;
                    const attrKey = String(chip.dataset.inlineAttr || '').trim();
                    const config = getInlineFieldConfig(attrKey);
                    if (!blockRef || !config) return;
                    currentBlockEl = blockRef;
                    currentBlockId = blockId || String(blockRef.dataset.nodeId || '').trim();
                    currentProps = await getTaskCustomProps(currentBlockId, false);
                    activePropConfig = config;
                    const currentValue = String(chip.dataset.inlineValue || currentProps[attrKey] || '').trim();
                    if (config.type === 'select') showSelectMenu(chip, config, currentValue);
                    else if (config.type === 'date') showDateEditor(chip, config, currentValue);
                    else showTextEditor(chip, config, currentValue);
                }, true);
                layer.appendChild(host);
            }
            return host;
        }

        function getInlineVisibleTaskBlocks(buffer = 360, maxCount = 96) {
            return getInlineDirectionalTaskBlocks(buffer, buffer, maxCount);
        }

        function getInlineDirectionalTaskBlocks(upBuffer = 360, downBuffer = 360, maxCount = 96) {
            const viewportTop = 0 - Math.max(0, Number(upBuffer) || 0);
            const viewportBottom = (window.innerHeight || document.documentElement?.clientHeight || 0) + Math.max(0, Number(downBuffer) || 0);
            const sourceBlocks = inlineMetaVisibleTaskBlocks.size
                ? Array.from(inlineMetaVisibleTaskBlocks.values())
                : Array.from(inlineMetaObservedTaskBlocks.values());
            const out = [];
            const seen = new Set();
            for (let i = 0; i < sourceBlocks.length; i += 1) {
                const blockEl = sourceBlocks[i];
                const blockId = String(blockEl?.dataset?.nodeId || '').trim();
                if (!blockId || seen.has(blockId)) continue;
                seen.add(blockId);
                if (!isTaskBlockElement(blockEl)) continue;
                try {
                    const rect = blockEl.getBoundingClientRect();
                    if (!rect) continue;
                    if (rect.bottom < viewportTop) continue;
                    if (rect.top > viewportBottom) continue;
                    out.push(blockEl);
                    if (out.length >= maxCount) return out;
                } catch (e) {}
            }
            return out;
        }

        function getInlineScrollPositionFromEventTarget(target) {
            try {
                if (target === window || target === document || target === document.body || target === document.documentElement) {
                    return Number(window.scrollY || document.documentElement?.scrollTop || document.body?.scrollTop || 0);
                }
                const el = target instanceof Element ? target : null;
                if (!el) return Number(window.scrollY || document.documentElement?.scrollTop || 0);
                if (typeof el.scrollTop === 'number' && el.scrollHeight > el.clientHeight) return Number(el.scrollTop || 0);
            } catch (e) {}
            return Number(window.scrollY || document.documentElement?.scrollTop || 0);
        }

        function pruneInlineMetaOutsideViewport(keepBlocks) {
            const keepIds = new Set((keepBlocks || []).map((el) => String(el?.dataset?.nodeId || '').trim()).filter(Boolean));
            try {
                document.querySelectorAll('.sy-custom-props-inline-host').forEach((host) => {
                    const owner = String(host?.dataset?.blockId || '').trim();
                    if (!owner || keepIds.has(owner)) return;
                    try { host.remove(); } catch (e) {}
                    try { inlineMetaLayoutCache.delete(owner); } catch (e2) {}
                });
            } catch (e) {}
        }

        function requestInlineMetaRender(forceRefresh = false) {
            if (inlineMetaRafId) return;
            inlineMetaRafId = requestAnimationFrame(() => {
                inlineMetaRafId = 0;
                try { scheduleInlineMetaRender(forceRefresh, true); } catch (e) {}
            });
        }

        function setInlineMetaScrolling(active) {
            if (inlineMetaScrolling === !!active) return;
            inlineMetaScrolling = !!active;
            try {
                document.querySelectorAll('.sy-custom-props-inline-layer').forEach((layer) => {
                    if (active) layer.classList.add('is-scrolling');
                    else layer.classList.remove('is-scrolling');
                });
            } catch (e) {}
        }

        function updateInlineMetaSelectionVisibility() {
            let shouldHide = false;
            try {
                const selection = window.getSelection?.();
                const selectedText = String(selection?.toString?.() || '');
                if (selectedText.trim()) {
                    const anchorNode = selection?.anchorNode || null;
                    const focusNode = selection?.focusNode || null;
                    const anchorEl = anchorNode?.nodeType === Node.ELEMENT_NODE ? anchorNode : anchorNode?.parentElement;
                    const focusEl = focusNode?.nodeType === Node.ELEMENT_NODE ? focusNode : focusNode?.parentElement;
                    shouldHide = !!(
                        anchorEl?.closest?.('.protyle,.protyle-content,.protyle-wysiwyg')
                        || focusEl?.closest?.('.protyle,.protyle-content,.protyle-wysiwyg')
                    );
                }
            } catch (e) {
                shouldHide = false;
            }
            try {
                document.querySelectorAll('.sy-custom-props-inline-layer').forEach((layer) => {
                    if (shouldHide) layer.classList.add('is-selection-active');
                    else layer.classList.remove('is-selection-active');
                });
            } catch (e) {}
        }

        function shouldHandleInlineMetaViewportEvent(target) {
            const el = target instanceof Element
                ? target
                : (target?.nodeType === Node.DOCUMENT_NODE ? document.documentElement : null);
            if (!el) return false;
            if (el === document || el === document.body || el === document.documentElement || el === window) return true;
            return !!el.closest?.('.protyle,.protyle-content,.protyle-wysiwyg,.layout-tab-container');
        }

        function hasInlineMetaActiveTargets() {
            if (inlineMetaObservedTaskBlocks.size > 0 || inlineMetaVisibleTaskBlocks.size > 0) return true;
            const layer = inlineMetaLayer && inlineMetaLayer.isConnected
                ? inlineMetaLayer
                : document.querySelector('.sy-custom-props-inline-layer');
            if (!layer) return false;
            return !!layer.querySelector('.sy-custom-props-inline-host');
        }

        function hasTaskBlockInRoot(root) {
            if (!(root instanceof Element)) return false;
            const taskSelector = '.li[data-node-id] input[type="checkbox"],.li[data-node-id] .protyle-action__task,.li[data-node-id] .protyle-action--task,.li[data-node-id] .protyle-task--checkbox,.li[data-node-id] .protyle-task,.li[data-node-id] .b3-checkbox,.li[data-node-id][data-marker*="[ ]"],.li[data-node-id][data-marker*="[x]"],.li[data-node-id][data-marker*="[X]"],.li[data-node-id] [data-marker*="[ ]"],.li[data-node-id] [data-marker*="[x]"],.li[data-node-id] [data-marker*="[X]"]';
            if (root.querySelector(taskSelector)) return true;
            const items = root.querySelectorAll('.li[data-node-id], [data-type="NodeListItem"][data-node-id]');
            const limit = Math.min(items.length, 180);
            for (let i = 0; i < limit; i += 1) {
                if (isTaskBlockElement(items[i])) return true;
            }
            return false;
        }

        function getInlineMetaObserveRoots() {
            try {
                const roots = Array.from(document.querySelectorAll('.protyle'))
                    .filter((el) => {
                        if (!(el instanceof Element)) return false;
                        const rect = el.getBoundingClientRect?.();
                        if (!rect) return false;
                        if (rect.width <= 0 || rect.height <= 0) return false;
                        const style = window.getComputedStyle(el);
                        if (!style || style.display === 'none' || style.visibility === 'hidden') return false;
                        if (!hasTaskBlockInRoot(el)) return false;
                        return true;
                    });
                if (roots.length) return roots;
                const fallback = document.querySelector('.protyle--focus');
                if (fallback instanceof Element) {
                    const rect = fallback.getBoundingClientRect?.();
                    if (rect && rect.width > 0 && rect.height > 0) return [fallback];
                }
                return roots;
            } catch (e) {
                return [];
            }
        }

        function ensureInlineMetaBlockObserver() {
            if (inlineMetaBlockObserver) return inlineMetaBlockObserver;
            if (typeof IntersectionObserver !== 'function') return null;
            inlineMetaBlockObserver = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    const blockEl = entry?.target;
                    const blockId = String(blockEl?.dataset?.nodeId || '').trim();
                    if (!blockId) return;
                    if (entry.isIntersecting) inlineMetaVisibleTaskBlocks.set(blockId, blockEl);
                    else inlineMetaVisibleTaskBlocks.delete(blockId);
                });
            }, {
                root: null,
                rootMargin: '2400px 0px 2400px 0px',
                threshold: 0
            });
            return inlineMetaBlockObserver;
        }

        function syncInlineMetaTaskBlocks(force = false) {
            if (!inlineMetaStarted) return;
            if (!force && !inlineMetaNeedSyncBlocks) return;
            inlineMetaNeedSyncBlocks = false;
            const roots = inlineMetaObservedRoots.length ? inlineMetaObservedRoots : getInlineMetaObserveRoots();
            const nextBlocks = new Map();
            roots.forEach((root) => {
                const blocks = root?.querySelectorAll?.('.li[data-node-id], [data-type="NodeListItem"][data-node-id]') || [];
                for (let i = 0; i < blocks.length; i += 1) {
                    const blockEl = blocks[i];
                    const blockId = String(blockEl?.dataset?.nodeId || '').trim();
                    if (!blockId || nextBlocks.has(blockId)) continue;
                    if (!isTaskBlockElement(blockEl)) continue;
                    nextBlocks.set(blockId, blockEl);
                }
            });
            const io = ensureInlineMetaBlockObserver();
            inlineMetaObservedTaskBlocks.forEach((prevEl, blockId) => {
                if (nextBlocks.has(blockId)) return;
                if (io) {
                    try { io.unobserve(prevEl); } catch (e) {}
                }
                inlineMetaVisibleTaskBlocks.delete(blockId);
                inlineMetaLayoutCache.delete(blockId);
            });
            nextBlocks.forEach((nextEl, blockId) => {
                const prevEl = inlineMetaObservedTaskBlocks.get(blockId);
                if (prevEl === nextEl) return;
                if (io && prevEl) {
                    try { io.unobserve(prevEl); } catch (e) {}
                }
                if (io) {
                    try { io.observe(nextEl); } catch (e) {}
                }
            });
            inlineMetaObservedTaskBlocks = nextBlocks;
            if (!io) inlineMetaVisibleTaskBlocks = new Map(nextBlocks);
        }

        function cleanupInlineMetaTaskBlocks() {
            if (inlineMetaMutationTimer) clearTimeout(inlineMetaMutationTimer);
            inlineMetaMutationTimer = null;
            inlineMetaPropsInflight = new Map();
            if (inlineMetaBlockObserver) {
                try { inlineMetaBlockObserver.disconnect(); } catch (e) {}
            }
            inlineMetaBlockObserver = null;
            inlineMetaObservedTaskBlocks = new Map();
            inlineMetaVisibleTaskBlocks = new Map();
            inlineMetaNeedSyncBlocks = true;
        }

        function rebindInlineMetaObservers() {
            try { inlineMetaObserver?.disconnect?.(); } catch (e) {}
            inlineMetaObservedRoots = [];
            if (!inlineMetaStarted) return;
            inlineMetaObserver = new MutationObserver(() => {
                inlineMetaNeedSyncBlocks = true;
                if (inlineMetaMutationTimer) clearTimeout(inlineMetaMutationTimer);
                inlineMetaMutationTimer = setTimeout(() => {
                    inlineMetaMutationTimer = null;
                    requestInlineMetaRender(false);
                }, 80);
            });
            const roots = getInlineMetaObserveRoots();
            inlineMetaObservedRoots = roots;
            roots.forEach((root) => {
                try { inlineMetaObserver.observe(root, { childList: true, subtree: true }); } catch (e) {}
            });
            inlineMetaNeedSyncBlocks = true;
            syncInlineMetaTaskBlocks(true);
        }

        function syncInlineMetaObserveRoots() {
            if (!inlineMetaStarted) return;
            const nextRoots = getInlineMetaObserveRoots();
            if (nextRoots.length === inlineMetaObservedRoots.length && nextRoots.every((root, index) => root === inlineMetaObservedRoots[index])) {
                syncInlineMetaTaskBlocks(false);
                return;
            }
            rebindInlineMetaObservers();
        }

        function layoutInlineMetaHost(blockEl, host, taskId, textAnchor, html, forceRefresh = false, visibilityBuffer = 0) {
            if (!blockEl || !host || !taskId || !textAnchor) return false;
            // --- READ PHASE: batch all geometry reads before any writes ---
            const layer = host.parentElement;
            const layerRect = layer?.getBoundingClientRect?.();
            const blockRect = blockEl.getBoundingClientRect();
            const widthSig = Math.round(Number(blockRect?.width) || 0);
            const textSig = getInlineTextFastSignature(textAnchor);
            const prevLayout = inlineMetaLayoutCache.get(taskId);
            const plainText = getInlinePlainText(textAnchor);
            const textRect = getInlineTextTailRect(textAnchor);
            const bounds = getInlineViewportBounds(blockEl);
            if (!layerRect || !blockRect || (!blockRect.width && !blockRect.height) || !plainText || !textRect) {
                host.classList.remove('is-ready');
                inlineMetaLayoutCache.delete(taskId);
                return false;
            }
            if (!isInlineRectVisibleInBounds(textRect, bounds, visibilityBuffer)) {
                host.classList.remove('is-ready');
                inlineMetaLayoutCache.delete(taskId);
                return false;
            }
            const layoutHtml = String(html ?? prevLayout?.html ?? host.innerHTML ?? '');
            const localTextRect = {
                left: Math.round(textRect.left - layerRect.left),
                top: Math.round(textRect.top - layerRect.top),
                right: Math.round(textRect.right - layerRect.left),
                bottom: Math.round(textRect.bottom - layerRect.top),
                height: Math.round(textRect.height)
            };
            const viewportSig = `${localTextRect.right}:${localTextRect.top}:${localTextRect.height}`;
            // --- CACHE HIT: reuse cached layout, use cached dimensions to avoid forced reflow ---
            if (!forceRefresh && prevLayout && prevLayout.textSig === textSig && prevLayout.widthSig === widthSig && prevLayout.viewportSig === viewportSig && prevLayout.html === layoutHtml) {
                host.classList.toggle('is-wrap', !!prevLayout.wrapMode);
                host.style.left = prevLayout.left;
                host.style.top = prevLayout.top;
                host.style.maxWidth = prevLayout.maxWidth;
                host.classList.add('is-ready');
                inlineMetaOccupiedRects.push({
                    left: Number.parseInt(prevLayout.left, 10) || 0,
                    top: Number.parseInt(prevLayout.top, 10) || 0,
                    right: (Number.parseInt(prevLayout.left, 10) || 0) + Math.max(prevLayout.hostWidth || 72, 72),
                    bottom: (Number.parseInt(prevLayout.top, 10) || 0) + Math.max(prevLayout.hostHeight || 20, 20)
                });
                return true;
            }
            // --- READ host dimensions: remove is-wrap only here to measure natural size ---
            host.classList.remove('is-wrap');
            const hostRect = host.getBoundingClientRect();
            const hostWidth = Math.ceil(hostRect.width || host.offsetWidth || 0);
            const hostHeight = Math.ceil(hostRect.height || host.offsetHeight || 20);
            const layerWidth = Math.max(0, Math.round(layer.clientWidth || bounds?.width || layerRect.width || 0));
            // --- COMPUTE PHASE: pure calculations, no DOM access ---
            const minLeft = 8;
            const maxLeft = Math.max(minLeft, layerWidth - hostWidth - 8);
            const left = Math.max(minLeft, Math.min(maxLeft, Math.round(localTextRect.right + 6)));
            const top = Math.max(2, Math.round(localTextRect.top + ((localTextRect.height - hostHeight) / 2)));
            const remain = Math.max(96, Math.round(layerWidth - left - 8));
            const maxWidth = Math.max(72, Math.min(remain, Math.max(hostWidth, 320)));
            let wrapMode = remain < Math.max(140, Math.min(hostWidth + 12, 260));
            let finalLeft = left;
            let finalTop = top;
            let finalMaxWidth = maxWidth;
            if (wrapMode) {
                finalLeft = Math.max(minLeft, Math.min(Math.max(minLeft, layerWidth - 180), Math.round(localTextRect.left)));
                finalTop = Math.max(2, Math.round(localTextRect.bottom + 4));
                finalMaxWidth = Math.max(180, Math.min(Math.max(180, layerWidth - finalLeft - 8), Math.max(220, Math.min(560, Math.round(layerWidth * 0.76)))));
            }
            // Estimate actual dimensions from calculated values (avoid forced reflow from reading after writes)
            const estHostWidth = Math.min(hostWidth, finalMaxWidth);
            // In wrap mode, estimate rows from how much content overflows finalMaxWidth (row-gap: 4px)
            const estWrapRows = wrapMode ? Math.max(1, Math.ceil(hostWidth / Math.max(finalMaxWidth, 1))) : 1;
            const estHostHeight = hostHeight * estWrapRows + Math.max(0, estWrapRows - 1) * 4;
            const candidateRect = {
                left: finalLeft,
                top: finalTop,
                right: finalLeft + Math.max(estHostWidth, 72),
                bottom: finalTop + Math.max(estHostHeight, 20)
            };
            const expandedTextRect = {
                left: Math.max(0, Math.round(localTextRect.left - 2)),
                top: Math.max(0, Math.round(localTextRect.top - 2)),
                right: Math.round(localTextRect.right + 2),
                bottom: Math.round(localTextRect.bottom + 2)
            };
            if (rectsOverlap(candidateRect, expandedTextRect, 2) || inlineMetaOccupiedRects.some((rect) => rectsOverlap(candidateRect, rect, 4))) {
                host.classList.remove('is-ready');
                inlineMetaLayoutCache.delete(taskId);
                return false;
            }
            // --- WRITE PHASE: batch all DOM writes together ---
            const leftPx = `${finalLeft}px`;
            const topPx = `${finalTop}px`;
            const maxWidthPx = `${finalMaxWidth}px`;
            if (wrapMode) host.classList.add('is-wrap'); else host.classList.remove('is-wrap');
            host.style.left = leftPx;
            host.style.top = topPx;
            host.style.maxWidth = maxWidthPx;
            host.classList.add('is-ready');
            inlineMetaLayoutCache.set(taskId, { textSig, widthSig, viewportSig, html: layoutHtml, left: leftPx, top: topPx, maxWidth: maxWidthPx, wrapMode, hostWidth: estHostWidth, hostHeight: estHostHeight });
            inlineMetaOccupiedRects.push(candidateRect);
            return true;
        }

        function refreshInlineMetaPositions() {
            if (!isInlineMetaEnabled()) return;
            const layer = inlineMetaLayer && inlineMetaLayer.isConnected
                ? inlineMetaLayer
                : document.querySelector('.sy-custom-props-inline-layer');
            if (!layer) return;
            inlineMetaOccupiedRects = [];
            const hosts = Array.from(layer.querySelectorAll('.sy-custom-props-inline-host[data-block-id]'));
            // --- READ PHASE: gather all block/text anchors before any writes ---
            const entries = [];
            for (let i = 0; i < hosts.length; i++) {
                const host = hosts[i];
                const taskId = String(host?.dataset?.blockId || '').trim();
                if (!taskId) continue;
                const blockEl = getBlockElById(taskId);
                const textAnchor = getInlineTextAnchor(blockEl);
                if (!blockEl || !textAnchor) {
                    entries.push({ host, taskId, skip: true });
                    continue;
                }
                entries.push({ host, taskId, blockEl, textAnchor, html: inlineMetaLayoutCache.get(taskId)?.html || host.innerHTML || '', skip: false });
            }
            // --- WRITE PHASE: apply layouts using gathered data ---
            for (let i = 0; i < entries.length; i++) {
                const e = entries[i];
                if (e.skip) {
                    e.host.classList.remove('is-ready');
                    inlineMetaLayoutCache.delete(e.taskId);
                    continue;
                }
                layoutInlineMetaHost(e.blockEl, e.host, e.taskId, e.textAnchor, e.html, false);
            }
        }

        async function renderInlineMetaForBlock(blockEl, forceRefresh = false, visibilityBuffer = 0) {
            if (!isInlineMetaEnabled()) return;
            const taskId = String(resolveTaskNodeIdForDetail(blockEl) || blockEl?.dataset?.nodeId || '').trim();
            if (!taskId) return;
            const isInScope = await isInlineMetaScopeAllowedForBlock(blockEl);
            if (!isInScope) {
                removeInlineMetaHostByTaskId(taskId);
                inlineMetaLayoutCache.delete(taskId);
                return;
            }
            const hostParent = getInlineHostParent(blockEl);
            if (!hostParent) return;
            const textAnchor = getInlineTextAnchor(blockEl);
            if (!textAnchor) return;
            const host = ensureInlineHost(blockEl);
            if (!host) return;
            host.dataset.blockId = taskId;
            const cfg = getQuickbarInlineSettings();
            const hasCached = inlineMetaCache.has(taskId) && !forceRefresh;
            const html = renderInlineMetaHtml(cfg, getInlineCachedProps(taskId));
            if (!html) {
                host.remove();
                inlineMetaLayoutCache.delete(taskId);
                return;
            }
            if (host.innerHTML !== html) host.innerHTML = html;
            layoutInlineMetaHost(hostParent, host, taskId, textAnchor, html, forceRefresh, visibilityBuffer);
            if (hasCached) return;
            Promise.resolve(ensureTaskPropsReady(taskId, forceRefresh)).then((freshProps) => {
                if (!host.isConnected) return;
                if (String(host.dataset.blockId || '').trim() !== taskId) return;
                const freshHtml = renderInlineMetaHtml(cfg, freshProps);
                if (!freshHtml) {
                    try { host.remove(); } catch (e) {}
                    inlineMetaLayoutCache.delete(taskId);
                    return;
                }
                requestAnimationFrame(() => {
                    if (!host.isConnected) return;
                    if (String(host.dataset.blockId || '').trim() !== taskId) return;
                    if (host.innerHTML !== freshHtml) host.innerHTML = freshHtml;
                    layoutInlineMetaHost(hostParent, host, taskId, textAnchor, freshHtml, true, visibilityBuffer);
                });
            }).catch(() => null);
        }

        function scheduleInlineMetaRender(forceRefresh = false, immediate = false) {
            const run = () => {
                inlineMetaRenderTimer = null;
                if (!isInlineMetaEnabled()) {
                    removeInlineMetaNodes();
                    return;
                }
                syncInlineMetaObserveRoots();
                syncInlineMetaTaskBlocks(false);
                inlineMetaOccupiedRects = [];
                const dir = inlineMetaScrollDirection;
                const preUp = dir > 0 ? 900 : (dir < 0 ? 3200 : 2200);
                const preDown = dir > 0 ? 3200 : (dir < 0 ? 900 : 2200);
                const coreUp = dir > 0 ? 320 : (dir < 0 ? 900 : 520);
                const coreDown = dir > 0 ? 900 : (dir < 0 ? 320 : 520);
                const keepUp = dir > 0 ? 1400 : (dir < 0 ? 4200 : 3200);
                const keepDown = dir > 0 ? 4200 : (dir < 0 ? 1400 : 3200);
                const preRenderBlocks = getInlineDirectionalTaskBlocks(preUp, preDown, 620);
                const blocks = getInlineDirectionalTaskBlocks(coreUp, coreDown, 320);
                const keepBlocks = getInlineDirectionalTaskBlocks(keepUp, keepDown, 900);
                pruneInlineMetaOutsideViewport(keepBlocks);
                prefetchInlineMetaProps(preRenderBlocks, 680);
                const coreSet = new Set(blocks.map((el) => String(el?.dataset?.nodeId || '').trim()).filter(Boolean));
                preRenderBlocks.forEach((blockEl) => {
                    const blockId = String(blockEl?.dataset?.nodeId || '').trim();
                    const buffer = coreSet.has(blockId) ? 420 : 1800;
                    Promise.resolve(renderInlineMetaForBlock(blockEl, forceRefresh, buffer)).catch(() => null);
                });
            };
            if (inlineMetaRenderTimer) clearTimeout(inlineMetaRenderTimer);
            if (immediate) {
                run();
                return;
            }
            inlineMetaRenderTimer = setTimeout(run, forceRefresh ? 12 : 24);
        }

        function startInlineMeta() {
            if (inlineMetaStarted) return;
            inlineMetaStarted = true;
            inlineMetaNeedSyncBlocks = true;
            inlineMetaLastScrollRenderTs = 0;
            inlineMetaScrollDirection = 0;
            inlineMetaLastScrollPos = getInlineScrollPositionFromEventTarget(window);
            rebindInlineMetaObservers();
            inlineMetaScrollHandler = (e) => {
                if (!shouldHandleInlineMetaViewportEvent(e?.target || document.documentElement)) return;
                if (!hasInlineMetaActiveTargets()) {
                    const now = Date.now();
                    if ((now - inlineMetaLastScrollRenderTs) > 220) {
                        inlineMetaLastScrollRenderTs = now;
                        requestInlineMetaRender(false);
                    }
                    return;
                }
                setInlineMetaScrolling(true);
                if (e?.type !== 'resize') {
                    const pos = getInlineScrollPositionFromEventTarget(e?.target || document.documentElement);
                    const delta = pos - inlineMetaLastScrollPos;
                    if (Math.abs(delta) >= 1) {
                        inlineMetaScrollDirection = delta > 0 ? 1 : -1;
                        inlineMetaLastScrollPos = pos;
                    }
                }
                const now = Date.now();
                if (e?.type !== 'resize' && !inlineMetaPositionRafId) {
                    inlineMetaPositionRafId = requestAnimationFrame(() => {
                        inlineMetaPositionRafId = 0;
                        try { refreshInlineMetaPositions(); } catch (e2) {}
                    });
                }
                if (e?.type !== 'resize' && (now - inlineMetaLastScrollRenderTs) > 24) {
                    inlineMetaLastScrollRenderTs = now;
                    requestInlineMetaRender(false);
                }
                if (e?.type === 'resize' && !inlineMetaPositionRafId) {
                    inlineMetaPositionRafId = requestAnimationFrame(() => {
                        inlineMetaPositionRafId = 0;
                        try { refreshInlineMetaPositions(); } catch (e2) {}
                    });
                }
                if (inlineMetaScrollIdleTimer) clearTimeout(inlineMetaScrollIdleTimer);
                inlineMetaScrollIdleTimer = setTimeout(() => {
                    inlineMetaScrollIdleTimer = null;
                    setInlineMetaScrolling(false);
                    requestInlineMetaRender(e?.type === 'resize');
                }, e?.type === 'resize' ? 70 : 28);
            };
            try { document.addEventListener('scroll', inlineMetaScrollHandler, { capture: true, passive: true }); } catch (e) {}
            try { window.addEventListener('resize', inlineMetaScrollHandler, true); } catch (e) {}
            requestInlineMetaRender(true);
        }

        function stopInlineMeta() {
            inlineMetaStarted = false;
            if (inlineMetaRenderTimer) clearTimeout(inlineMetaRenderTimer);
            inlineMetaRenderTimer = null;
            if (inlineMetaRafId) cancelAnimationFrame(inlineMetaRafId);
            inlineMetaRafId = 0;
            if (inlineMetaPositionRafId) cancelAnimationFrame(inlineMetaPositionRafId);
            inlineMetaPositionRafId = 0;
            if (inlineMetaScrollIdleTimer) clearTimeout(inlineMetaScrollIdleTimer);
            inlineMetaScrollIdleTimer = null;
            cleanupInlineMetaTaskBlocks();
            try { inlineMetaObserver?.disconnect?.(); } catch (e) {}
            inlineMetaObserver = null;
            inlineMetaObservedRoots = [];
            try { if (inlineMetaScrollHandler) document.removeEventListener('scroll', inlineMetaScrollHandler, true); } catch (e) {}
            try { if (inlineMetaScrollHandler) window.removeEventListener('resize', inlineMetaScrollHandler, true); } catch (e) {}
            inlineMetaScrollHandler = null;
            setInlineMetaScrolling(false);
            removeInlineMetaNodes();
        }

        function refreshInlineMetaMode(forceRefresh = true) {
            if (forceRefresh) clearInlineMetaScopeDocCache();
            if (isInlineMetaEnabled()) {
                startInlineMeta();
                scheduleInlineMetaRender(!!forceRefresh);
            } else {
                stopInlineMeta();
            }
        }

        // 触发器处理
        let lastTriggerTime = 0;

        function handleTrigger(e) {
            const now = Date.now();
            if (now - lastTriggerTime < 80) return;  // 防抖
            lastTriggerTime = now;
            if (Date.now() < inlineMetaInteractUntil) return;

            const target = e.target;
            if (target?.closest?.('.sy-custom-props-inline-host,.sy-custom-props-inline-chip')) return;

            // ========== 新增：检测是否选中了文字 ==========
            const selection = window.getSelection();
            const selectedText = selection?.toString() || '';
            const hasTextSelection = selectedText.length > 0 && selection?.anchorNode;
            
            // 如果选中了文字，检查是否在任何可见的编辑器内
            if (hasTextSelection) {
                let inVisibleEditor = false;
                const anchorNode = selection.anchorNode;
                
                // 向上遍历 DOM 树，检查是否在任何可见的编辑器区域内
                let current = (anchorNode && anchorNode.nodeType === Node.ELEMENT_NODE)
                    ? anchorNode
                    : anchorNode?.parentElement;
                while (current && current !== document.body) {
                    const style = window.getComputedStyle(current);
                    const isVisible = style.display !== 'none' && style.visibility !== 'hidden';
                    
                    // 检查是否在思源编辑器区域内
                    if (current.classList) {
                        if (current.classList.contains('protyle-wysiwyg') || 
                            current.classList.contains('protyle-content') ||
                            current.classList.contains('protyle')) {
                            if (isVisible) {
                                inVisibleEditor = true;
                            }
                        }
                    }
                    // 检查父元素是否可见
                    if (!isVisible) break;
                    current = current.parentElement;
                }
                
                // 如果选中了文字且在可见编辑器内，隐藏自定义悬浮条
                if (inVisibleEditor) {
                    if (floatBar.style.display !== 'none') {
                        hideFloatBar();
                    }
                    return;
                }
            }
            // ========== 新增结束 ==========

            // 如果点击在悬浮条或其弹出层内，不处理
            if (floatBar.contains(target) || selectMenu.contains(target) || inputEditor.contains(target)) return;

            const blockEl = getTaskBlockElementFromTarget(target);

            if (!blockEl) {
                if (floatBar.style.display !== 'none') hideFloatBar();
                return;
            }

            // 阻止事件冒泡，避免触发其他处理
            if (typeof e.stopImmediatePropagation === 'function') {
                e.stopImmediatePropagation();
            }
            e.stopPropagation();

            showFloatBar(blockEl);
        }

        function isQuickbarEnabled() {
            try {
                const raw = localStorage.getItem('tm_enable_quickbar');
                if (raw == null) return true;
                const v = JSON.parse(raw);
                return !!v;
            } catch (e) {
                const raw = localStorage.getItem('tm_enable_quickbar');
                if (raw == null) return true;
                return raw !== 'false' && raw !== '0';
            }
        }

        let quickbarStarted = false;
        let storageHandler = null;
        let closePopupsHandler = null;
        let selectionChangeHandler = null;  // 新增：文字选择变化监听器
        let mouseUpHandler = null;

        function startQuickbar() {
            if (quickbarStarted) return;
            quickbarStarted = true;

            initStatusOptionsListener();

            // ========== 新增：检测文字选择并隐藏悬浮条 ==========
            const checkAndHideForTextSelection = () => {
                if (floatBar.style.display === 'none') return;
                
                try {
                    const selection = window.getSelection();
                    if (!selection) return;
                    
                    const selectedText = selection.toString();
                    if (!selectedText || selectedText.length === 0) return;
                    
                    // 简单检查：选中的节点是否在任何 protyle 编辑器内
                    let node = selection.anchorNode;
                    while (node && node !== document) {
                        if (node.classList) {
                            const className = node.className || '';
                            if (className.includes('protyle-wysiwyg') || 
                                className.includes('protyle-content') ||
                                className.includes('protyle')) {
                                // 检查元素是否可见（通过 offsetParent）
                                if (node.offsetParent !== null) {
                                    hideFloatBar();
                                    return;
                                }
                            }
                        }
                        node = node.parentNode;
                    }
                } catch (e) {
                    // 忽略错误
                }
            };
            
            // 监听多种事件
            selectionChangeHandler = () => {
                checkAndHideForTextSelection();
                updateInlineMetaSelectionVisibility();
            };
            document.addEventListener('selectionchange', selectionChangeHandler, { passive: true });
            
            // mouseup 事件 - 当用户释放鼠标时检测（选择文字后）
            mouseUpHandler = (e) => {
                // 延迟一点执行，确保 selection 已经更新
                setTimeout(() => {
                    checkAndHideForTextSelection();
                    updateInlineMetaSelectionVisibility();
                }, 10);
            };
            document.addEventListener('mouseup', mouseUpHandler, true);
            // ========== 新增结束 ==========

            document.addEventListener('pointerup', handleTrigger, true);
            document.addEventListener('click', handleTrigger, true);
            document.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition, true);

            closePopupsHandler = (e) => {
                if (Date.now() < inlineMetaInteractUntil) return;
                if (floatBar.style.display === 'none') return;
                if (e.target?.closest?.('.sy-custom-props-inline-host,.sy-custom-props-inline-chip')) return;
                if (floatBar.contains(e.target) || selectMenu.contains(e.target) || inputEditor.contains(e.target)) return;
                hideAllPopups();
            };
            document.addEventListener('pointerdown', closePopupsHandler, true);
        }

        function stopQuickbar() {
            if (!quickbarStarted) return;
            quickbarStarted = false;
            try { document.removeEventListener('pointerup', handleTrigger, true); } catch (e) {}
            try { document.removeEventListener('click', handleTrigger, true); } catch (e) {}
            try { document.removeEventListener('scroll', updatePosition, true); } catch (e) {}
            try { window.removeEventListener('resize', updatePosition, true); } catch (e) {}
            try { if (closePopupsHandler) document.removeEventListener('pointerdown', closePopupsHandler, true); } catch (e) {}
            closePopupsHandler = null;

            // ========== 新增：移除文字选择变化监听 ==========
            try { if (selectionChangeHandler) document.removeEventListener('selectionchange', selectionChangeHandler); } catch (e) {}
            selectionChangeHandler = null;
            try { if (mouseUpHandler) document.removeEventListener('mouseup', mouseUpHandler, true); } catch (e) {}
            mouseUpHandler = null;
            try {
                document.querySelectorAll('.sy-custom-props-inline-layer').forEach((layer) => {
                    layer.classList.remove('is-selection-active');
                });
            } catch (e) {}
            // ========== 新增结束 ==========

            try { if (storageHandler) window.removeEventListener('storage', storageHandler); } catch (e) {}
            storageHandler = null;

            hideFloatBar();
        }

        // 监听任务管理器状态变化
        function initStatusOptionsListener() {
            // 立即读取一次
            loadStatusOptions();

            // 监听localStorage变化（跨标签页同步）
            storageHandler = (e) => {
                if (e.key === 'tm_custom_status_options') {
                    try {
                        const options = JSON.parse(e.newValue);
                        if (Array.isArray(options) && options.length > 0) {
                            taskStatusOptions = options;
                            updateStatusOptionsInConfig();
                            console.log('🎯 检测到状态选项变化:', options.length, '个选项');
                            scheduleInlineMetaRender(true);
                        }
                    } catch (err) {
                        console.warn('解析状态选项失败:', err);
                    }
                } else if (e.key === 'tm_enable_quickbar_inline_meta' || e.key === 'tm_quickbar_inline_fields' || e.key === 'tm_quickbar_inline_show_on_mobile') {
                    refreshInlineMetaMode(true);
                } else if (isInlineMetaScopeStorageKey(e.key)) {
                    clearInlineMetaScopeDocCache();
                    refreshInlineMetaMode(true);
                }
            };
            window.addEventListener('storage', storageHandler);
        }

        globalThis.__taskHorizonQuickbarToggle = (enabled) => {
            const on = !!enabled;
            try { localStorage.setItem('tm_enable_quickbar', JSON.stringify(on)); } catch (e) {}
            if (on) startQuickbar();
            else stopQuickbar();
        };
        globalThis.__taskHorizonQuickbarRefreshInline = () => {
            try { refreshInlineMetaMode(true); } catch (e) {}
        };

        globalThis.__taskHorizonQuickbarCleanup = () => {
            quickbarDisposed = true;
            try { stopQuickbar(); } catch (e) {}
            try { stopInlineMeta(); } catch (e) {}
            try { if (__tmQBStatusRenderStorageHandler) window.removeEventListener('storage', __tmQBStatusRenderStorageHandler); } catch (e) {}
            __tmQBStatusRenderStorageHandler = null;
            try { document.removeEventListener('contextmenu', __tmQBOnContextmenuCapture, true); } catch (e) {}
            try { document.removeEventListener('pointerdown', __tmQBOnPointerdownCapture, true); } catch (e) {}
            try { blockMenuObserver?.disconnect?.(); } catch (e) {}
            blockMenuObserver = null;
            try { delete globalThis.__taskHorizonQuickbarToggle; } catch (e) {}
            try { delete globalThis.__taskHorizonQuickbarRefreshInline; } catch (e) {}
            try { delete globalThis.__taskHorizonQuickbarCleanup; } catch (e) {}
            try { delete globalThis.__taskHorizonQuickbarLoaded; } catch (e) {}
        };

        if (isQuickbarEnabled()) startQuickbar();
        else stopQuickbar();
        refreshInlineMetaMode(true);
    }

    // 思源笔记 API 请求封装
    async function requestApi(url, data, method = 'POST') {
        try {
            const response = await fetch(url, {
                method: method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data || {})
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            return await response.json();
        } catch (error) {
            console.error(`API请求失败 ${url}:`, error);
            throw error;
        }
    }

    // 思源笔记 API 封装
    function showMessage(message, isError = false, delay = 7000) {
        return fetch('/api/notification/' + (isError ? 'pushErrMsg' : 'pushMsg'), {
            method: "POST",
            body: JSON.stringify({ "msg": message, "timeout": delay })
        });
    }
})();
