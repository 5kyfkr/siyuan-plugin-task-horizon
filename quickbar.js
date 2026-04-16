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
                name: '开始日期',
                attrKey: 'custom-start-date',
                type: 'date',
                defaultValue: ''
            },
            {
                name: '完成日期',
                attrKey: 'custom-completion-time',
                type: 'date',
                defaultValue: ''
            },
            {
                name: '时长',
                attrKey: 'custom-duration',
                type: 'text',
                placeholder: '输入时长',
                defaultValue: ''
            }
        ],
        // 第二行显示的属性
        secondRow: [
            {
                name: '备注',
                attrKey: 'custom-remark',
                type: 'text',
                placeholder: '输入备注',
                defaultValue: ''
            },
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
        { id: 'done', name: '已完成', color: '#4CAF50' },
        { id: 'cancelled', name: '已取消', color: '#9E9E9E' },
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
    const quickbarVisibleItemDefaults = ['custom-status', 'custom-priority', 'custom-start-date', 'custom-completion-time', 'custom-duration', 'custom-remark', 'action-ai-title', 'action-reminder', 'action-more'];
    const quickbarVisibleItemAllowSet = new Set(quickbarVisibleItemDefaults);
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
    let inlineMetaMutationHasStructural = false;
    let inlineMetaMutationLastFireTs = 0;
    let inlineMetaLastScrollRenderTs = 0;
    let inlineMetaPropsInflight = new Map();
    let inlineMetaScrollDirection = 0;
    let inlineMetaLastScrollPos = 0;
    let inlineMetaWsHandler = null;
    let inlineMetaWsTimer = null;
    let inlineMetaIsComposing = false;
    let inlineMetaCompositionStartHandler = null;
    let inlineMetaCompositionEndHandler = null;
    let inlineMetaBootstrapTimers = [];
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

    function getQuickbarVisibleSettings() {
        try {
            const rawItems = JSON.parse(localStorage.getItem('tm_quickbar_visible_items') || 'null');
            const items = Array.isArray(rawItems)
                ? rawItems.map(v => String(v || '').trim()).filter(v => quickbarVisibleItemAllowSet.has(v))
                : quickbarVisibleItemDefaults.slice();
            return { items: items.length ? items : quickbarVisibleItemDefaults.slice() };
        } catch (e) {
            return { items: quickbarVisibleItemDefaults.slice() };
        }
    }

    function clearInlineMetaBootstrapTimers() {
        if (!Array.isArray(inlineMetaBootstrapTimers) || !inlineMetaBootstrapTimers.length) return;
        inlineMetaBootstrapTimers.forEach((timer) => {
            try { clearTimeout(timer); } catch (e) {}
        });
        inlineMetaBootstrapTimers = [];
    }

    function hasInlineMetaReadyHosts() {
        try {
            const layer = inlineMetaLayer && inlineMetaLayer.isConnected
                ? inlineMetaLayer
                : document.querySelector('.sy-custom-props-inline-layer');
            if (!layer) return false;
            return !!layer.querySelector('.sy-custom-props-inline-host.is-ready');
        } catch (e) {
            return false;
        }
    }

    function scheduleInlineMetaBootstrapRenders(forceRefresh = false) {
        clearInlineMetaBootstrapTimers();
        const plan = [0, 48, 160, 360, 760];
        plan.forEach((delay, index) => {
            if (delay === 0) {
                try { scheduleInlineMetaRender(!!forceRefresh, true); } catch (e) {}
                return;
            }
            const timer = setTimeout(() => {
                inlineMetaBootstrapTimers = inlineMetaBootstrapTimers.filter((item) => item !== timer);
                if (!inlineMetaStarted || !isInlineMetaEnabled()) return;
                const needRetry = inlineMetaObservedRoots.length === 0
                    || inlineMetaObservedTaskBlocks.size === 0
                    || !hasInlineMetaReadyHosts();
                if (!forceRefresh && !needRetry) return;
                try { requestInlineMetaRender(forceRefresh || index >= plan.length - 2); } catch (e) {}
            }, delay);
            inlineMetaBootstrapTimers.push(timer);
        });
    }

    function getStatusOptionsSnapshot() {
        try {
            const savedOptions = localStorage.getItem('tm_custom_status_options');
            if (savedOptions) {
                const options = JSON.parse(savedOptions);
                if (Array.isArray(options) && options.length > 0) {
                    taskStatusOptions = options;
                }
            }
        } catch (e) {}
        return Array.isArray(taskStatusOptions) && taskStatusOptions.length
            ? taskStatusOptions
            : [
                { id: 'todo', name: '待办', color: '#757575' },
                { id: 'done', name: '已完成', color: '#4CAF50' },
                { id: 'cancelled', name: '已取消', color: '#9E9E9E' },
                { id: 'blocked', name: '阻塞', color: '#F44336' },
                { id: 'review', name: '待审核', color: '#FF9800' }
            ];
    }

    function getDefaultUndoneStatusId(statusOptionsInput = null) {
        const statusOptions = Array.isArray(statusOptionsInput) && statusOptionsInput.length
            ? statusOptionsInput
            : getStatusOptionsSnapshot();
        let configured = '';
        try {
            configured = String(localStorage.getItem('tm_checkbox_undone_status_id') || '').trim();
        } catch (e) {}
        if (configured && configured !== '__none__' && statusOptions.some((item) => String(item?.id || '').trim() === configured)) {
            return configured;
        }
        const todoExists = statusOptions.some((item) => String(item?.id || '').trim() === 'todo');
        if (todoExists) return 'todo';
        return String(statusOptions[0]?.id || '').trim() || 'todo';
    }

    async function getManagedTaskStatusSnapshot(taskIdOrBlockId) {
        const rawId = String(taskIdOrBlockId || '').trim();
        if (!rawId) return null;
        const getter = globalThis?.['siyuan-plugin-task-horizon']?.getTaskStatusDisplayByAnyId;
        if (typeof getter !== 'function') return null;
        try {
            const result = await getter(rawId);
            return result && typeof result === 'object' ? result : null;
        } catch (e) {
            return null;
        }
    }

    function isInlineMetaScopeStorageKey(key) {
        return key === 'tm_doc_groups'
            || key === 'tm_selected_doc_ids'
            || key === 'tm_new_task_doc_id';
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

    function getRemarkMarkdownTools() {
        const tools = globalThis.__tmRemarkMarkdownTools;
        return tools && typeof tools === 'object' ? tools : null;
    }

    function normalizeRemarkMarkdown(value) {
        const tools = getRemarkMarkdownTools();
        if (tools && typeof tools.normalize === 'function') {
            try { return String(tools.normalize(value) || ''); } catch (e) {}
        }
        return String(value || '').replace(/\r\n?/g, '\n').trim();
    }

    function stripRemarkMarkdown(value) {
        const tools = getRemarkMarkdownTools();
        if (tools && typeof tools.stripText === 'function') {
            try { return String(tools.stripText(value) || ''); } catch (e) {}
        }
        return String(value || '').replace(/\r\n?/g, ' ').replace(/\s{2,}/g, ' ').trim();
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
        const subtype = String(el.getAttribute?.('data-subtype') || '').trim().toLowerCase();
        if (subtype === 't') return true;
        return false;
    }

    function isTaskBlockElement(blockEl) {
        if (!blockEl) return false;
        // 只检查当前块本身和直接子元素，避免父级普通列表项因为包含子任务而被误判成任务块。
        const directChildren = Array.from(blockEl.children || []);
        const hasDirectTaskControl = directChildren.some((child) => {
            if (!(child instanceof Element)) return false;
            return child.matches?.('input[type="checkbox"],.protyle-action__task,.protyle-action--task,.protyle-task--checkbox,.protyle-task,.b3-checkbox,[data-task]');
        });
        if (hasDirectTaskControl) return true;
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
            try {
                const paragraph = blockEl.querySelector?.(':scope > .p') || blockEl.querySelector?.('.p') || null;
                const textAnchor = paragraph?.querySelector?.(':scope > [contenteditable="true"]')
                    || paragraph?.querySelector?.('[contenteditable="true"]')
                    || paragraph
                    || blockEl;
                const parts = [];
                const walker = document.createTreeWalker(textAnchor, NodeFilter.SHOW_TEXT, {
                    acceptNode(node) {
                        const parent = node?.parentElement;
                        if (parent?.closest?.('.sy-custom-props-inline-host')) return NodeFilter.FILTER_REJECT;
                        if (parent?.closest?.('[contenteditable="false"],.protyle-attr,.protyle-custom')) return NodeFilter.FILTER_REJECT;
                        const text = String(node?.nodeValue || '').replace(/\u200b/g, '').trim();
                        return text ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                    }
                });
                while (walker.nextNode()) {
                    const text = String(walker.currentNode?.nodeValue || '').replace(/\u200b/g, ' ').trim();
                    if (text) parts.push(text);
                }
                const text = parts.length ? parts.join(' ') : String(textAnchor?.textContent || blockEl.textContent || '');
                return String(text || '').replace(/\s+/g, ' ').trim();
            } catch (e) {
                return String(blockEl?.textContent || '').replace(/\s+/g, ' ').trim();
            }
        }

        function resolveTaskBindingFromBlockEl(blockEl) {
            const readId = (el) => String(el?.dataset?.nodeId || el?.getAttribute?.('data-node-id') || '').trim();
            const getDirectTaskListItems = (listEl) => {
                if (!listEl || !(listEl instanceof Element)) return [];
                return Array.from(listEl.children || []).filter((child) => {
                    if (!(child instanceof Element)) return false;
                    if (!child.matches?.('.li,[data-type="NodeListItem"]')) return false;
                    if (!readId(child)) return false;
                    return isTaskBlockElement(child);
                });
            };
            const resolveTaskBindingFromTaskLi = (taskLi) => {
                if (!taskLi || !(taskLi instanceof Element)) return null;
                const taskId = readId(taskLi);
                if (!taskId) return null;
                const parentList = taskLi.parentElement instanceof Element
                    && taskLi.parentElement.matches?.('.list,[data-type="NodeList"]')
                    ? taskLi.parentElement
                    : null;
                const listId = readId(parentList);
                const listSubtype = String(parentList?.getAttribute?.('data-subtype') || parentList?.dataset?.subtype || '').trim().toLowerCase();
                const directTaskItems = getDirectTaskListItems(parentList);
                const attrHostId = (listId && listSubtype === 't' && directTaskItems.length === 1 && directTaskItems[0] === taskLi)
                    ? listId
                    : taskId;
                return { taskId, attrHostId };
            };
            const pickTaskLi = (root) => {
                if (!root || !(root instanceof Element)) return null;
                const li = root.matches?.('.li,[data-type="NodeListItem"]')
                    ? root
                    : root.closest?.('.li,[data-type="NodeListItem"]');
                if (li && readId(li) && isTaskBlockElement(li)) return li;
                const list = root.matches?.('.list,[data-type="NodeList"]')
                    ? root
                    : root.closest?.('.list,[data-type="NodeList"]');
                const directTaskItems = getDirectTaskListItems(list);
                if (directTaskItems.length === 1) return directTaskItems[0];
                const inner = root.querySelector?.('.li[data-node-id],[data-type="NodeListItem"][data-node-id]');
                if (inner && readId(inner) && isTaskBlockElement(inner)) return inner;
                return null;
            };
            if (!blockEl) return { taskId: '', attrHostId: '' };
            const selfTaskLi = pickTaskLi(blockEl);
            if (selfTaskLi) return resolveTaskBindingFromTaskLi(selfTaskLi) || { taskId: '', attrHostId: '' };
            const id0 = readId(blockEl);
            if (id0 && isTaskBlockElement(blockEl)) return { taskId: id0, attrHostId: id0 };
            const p = blockEl.closest?.('[data-node-id]');
            const fallbackId = readId(p) || id0;
            return { taskId: fallbackId, attrHostId: fallbackId };
        }

        function resolveTaskNodeIdForDetail(blockEl) {
            const binding = resolveTaskBindingFromBlockEl(blockEl);
            return String(binding?.taskId || '').trim();
        }

        function resolveTaskAttrNodeIdForDetail(blockEl) {
            const binding = resolveTaskBindingFromBlockEl(blockEl);
            return String(binding?.attrHostId || binding?.taskId || '').trim();
        }

    function getSelectedBlockElementForMenu() {
        const direct = document.querySelector('.protyle-wysiwyg--select, .protyle-content--select');
        const el = direct ||
            document.querySelector('.protyle--focus .protyle-wysiwyg, .protyle--focus .protyle-content')?.querySelector('.protyle-wysiwyg--select, .protyle-content--select') ||
            document.querySelector('.protyle-wysiwyg, .protyle-content')?.querySelector('.protyle-wysiwyg--select, .protyle-content--select');
        if (!el) return null;
        return el.closest?.('.li,[data-type="NodeListItem"],[data-node-id]') || el;
    }

    function isBlockMarkerTarget(target) {
        if (!target || target === document) return false;
        if (target.closest?.('.protyle-gutters,.protyle-gutter,.protyle-gutter__icon,.protyle-gutter__item,[data-type="gutter"],[data-type="gutterBlock"]')) {
            return true;
        }
        const iconLike = target.closest?.('.protyle-action,.protyle-icon');
        if (!iconLike) return false;
        return !!iconLike.closest?.('.protyle-gutters,.protyle-gutter,.protyle-gutter__icon,.protyle-gutter__item,[data-type="gutter"],[data-type="gutterBlock"]');
    }

    function shouldSuppressFloatBarForTarget(target, now = Date.now()) {
        if (isBlockMarkerTarget(target)) return true;
        const source = String(lastBlockMenuTrigger?.source || '').trim();
        const ts = Number(lastBlockMenuTrigger?.ts || 0);
        if (source !== 'gutter' || !ts) return false;
        return (now - ts) < 240;
    }

    function getSiyuanRuntimeBackend() {
        try {
            const container = String(window?.siyuan?.config?.system?.container || globalThis?.siyuan?.config?.system?.container || '').trim().toLowerCase();
            if (container) return container;
        } catch (e) {}
        return '';
    }

    function hasOfficialMobileRuntimeSignal() {
        try {
            if (globalThis?.JSAndroid) return true;
        } catch (e) {}
        try {
            if (globalThis?.JSHarmony) return true;
        } catch (e) {}
        try {
            const hasIosBridge = !!globalThis?.webkit?.messageHandlers;
            if (!hasIosBridge) return false;
            const ua = String(navigator?.userAgent || '');
            const maxTouchPoints = Number(navigator?.maxTouchPoints) || 0;
            if (/iPhone|iPad|iPod/i.test(ua)) return true;
            if (maxTouchPoints > 0) return true;
            return true;
        } catch (e) {}
        return false;
    }

    function isMobileBrowserViewport() {
        try {
            if (navigator?.userAgentData?.mobile === true) return true;
        } catch (e) {}
        try {
            const ua = String(navigator?.userAgent || '');
            if (/Mobile|Android|iPhone|iPad|iPod|HarmonyOS/i.test(ua)) return true;
        } catch (e) {}
        try {
            const maxTouchPoints = Number(navigator?.maxTouchPoints) || 0;
            const width = Number(window?.innerWidth) || 0;
            const coarse = !!window?.matchMedia?.('(pointer: coarse)')?.matches;
            if ((coarse || maxTouchPoints > 0) && width > 0 && width <= 900) return true;
        } catch (e) {}
        return false;
    }

    function isMobileDevice() {
        if (hasOfficialMobileRuntimeSignal()) return true;
        return isMobileBrowserViewport();
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
        const isGutterTrigger = isBlockMarkerTarget(t);
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
                flex-direction: column;
                align-items: stretch;
                gap: 6px;
                padding: 6px;
                border-radius: 8px;
                background: var(--b3-theme-background);
                border: 1px solid var(--b3-border-color);
                box-shadow: var(--b3-dialog-shadow);
                white-space: nowrap;
                overflow: visible;
                max-width: min(92vw, 980px);
            }
            .sy-custom-props-floatbar__row {
                display: flex;
                align-items: center;
                gap: 6px;
                flex-wrap: nowrap;
                min-width: 0;
                max-width: 100%;
            }
            .sy-custom-props-floatbar__row--main {
                align-items: center;
            }
            .sy-custom-props-floatbar__row--remark {
                max-width: 100%;
                white-space: normal;
                overflow: visible;
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
            .sy-custom-props-floatbar__prop--core {
                gap: 5px;
                padding: 0 8px;
                border-radius: 8px;
            }
            .sy-custom-props-floatbar__prop--remark {
                gap: 5px;
                min-width: 0;
                max-width: min(48vw, 280px);
            }
            .sy-custom-props-floatbar__row--remark .sy-custom-props-floatbar__prop--remark {
                width: 100%;
                max-width: none;
                box-sizing: border-box;
            }
            .sy-custom-props-floatbar__prop--remark:not(.sy-custom-props-floatbar__prop--icon-only) {
                height: 26px;
                min-height: 26px;
                line-height: 26px;
                align-items: center;
            }
            .sy-custom-props-floatbar__prop--core .sy-custom-props-floatbar__prop-value {
                display: inline-block;
                max-width: 132px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .sy-custom-props-floatbar__prop--remark .sy-custom-props-floatbar__prop-value {
                display: block;
                max-width: 100%;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                line-height: 1.35;
            }
            .sy-custom-props-floatbar__prop--icon-only {
                width: 26px;
                padding: 0;
                justify-content: center;
            }
            .sy-custom-props-floatbar__status-dot {
                width: 10px;
                height: 10px;
                border-radius: 999px;
                background: var(--qb-status-fg, #757575);
                box-shadow: 0 0 0 1px var(--qb-status-border, rgba(117,117,117,0.35));
                display: inline-block;
                flex: 0 0 auto;
            }
            .sy-custom-props-floatbar__prop-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                line-height: 0;
                flex: 0 0 auto;
            }
            .sy-custom-props-floatbar__prop-icon svg {
                width: 14px;
                height: 14px;
                display: block;
            }
            .sy-custom-props-floatbar [data-tooltip]::after {
                content: none !important;
                display: none !important;
            }
            .sy-custom-props-floatbar [data-tooltip]::before {
                white-space: nowrap;
                border-radius: 6px;
            }
            .sy-custom-props-floatbar [data-tooltip]:not([data-side])::before,
            .sy-custom-props-floatbar [data-tooltip][data-side="top"]::before {
                bottom: calc(100% + 8px);
            }
            .sy-custom-props-floatbar [data-tooltip][data-side="bottom"]::before {
                top: calc(100% + 8px);
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
                width: min(280px, calc(100vw - 12px));
                min-width: min(160px, calc(100vw - 12px));
                max-width: calc(100vw - 12px);
                padding: 10px;
                border-radius: 8px;
                background: var(--b3-theme-background);
                border: 1px solid var(--b3-border-color);
                box-shadow: var(--b3-dialog-shadow);
                box-sizing: border-box;
            }
            .sy-custom-props-floatbar__input-editor.is-visible {
                display: block;
            }
            .sy-custom-props-floatbar__input-editor.is-remark {
                width: min(72vw, 420px);
                min-width: min(72vw, 240px);
                max-width: calc(100vw - 12px);
            }
            .sy-custom-props-floatbar__remark-toolbar {
                display: none;
                align-items: center;
                gap: 6px;
                flex-wrap: wrap;
                margin-top: 10px;
                padding: 8px 10px;
                border-radius: 999px;
                border: 1px solid var(--b3-border-color);
                background: var(--b3-theme-surface);
                box-shadow: var(--b3-dialog-shadow);
            }
            .sy-custom-props-floatbar__remark-toolbar.is-open {
                display: inline-flex;
            }
            .sy-custom-props-floatbar__remark-tool {
                width: 28px;
                min-width: 28px;
                height: 28px;
                padding: 0;
                border-radius: 8px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 13px;
                font-weight: 700;
            }
            .sy-custom-props-floatbar__btn--remark-tools {
                display: none;
                min-width: 28px;
                width: 28px;
                padding: 0;
                font-size: 18px;
                font-weight: 500;
            }
            .sy-custom-props-floatbar__input-editor.is-remark .sy-custom-props-floatbar__btn--remark-tools {
                display: inline-flex;
                align-items: center;
                justify-content: center;
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
            .sy-custom-props-floatbar__textarea {
                width: 100%;
                box-sizing: border-box;
                min-height: 76px;
                max-height: min(60vh, 560px);
                padding: 6px 8px;
                border-radius: 6px;
                border: 1px solid var(--b3-border-color);
                background: var(--b3-theme-surface);
                color: var(--b3-theme-on-surface);
                outline: none;
                font-size: 13px;
                line-height: 1.45;
                resize: none;
                overflow-y: hidden;
                white-space: pre-wrap;
                overflow-wrap: anywhere;
                font-family: inherit;
            }
            .sy-custom-props-floatbar__input:focus {
                border-color: var(--b3-theme-primary);
            }
            .sy-custom-props-floatbar__textarea:focus {
                border-color: var(--b3-theme-primary);
            }
            .sy-custom-props-floatbar__input.is-hidden,
            .sy-custom-props-floatbar__textarea.is-hidden {
                display: none;
            }
            .sy-custom-props-floatbar__input-actions {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
                margin-top: 10px;
            }
            .sy-custom-props-floatbar__input-extra {
                display: none;
                flex-direction: column;
                gap: 8px;
                margin-top: 10px;
            }
            .sy-custom-props-floatbar__input-extra.is-visible {
                display: flex;
            }
            .sy-custom-props-floatbar__input-extra-row {
                width: 100%;
                min-height: 38px;
                border: 1px solid var(--b3-border-color);
                border-radius: 10px;
                background: var(--b3-theme-surface);
                color: var(--b3-theme-on-surface);
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                padding: 8px 10px;
                box-sizing: border-box;
                cursor: pointer;
            }
            .sy-custom-props-floatbar__input-extra-row:hover {
                border-color: var(--b3-theme-primary);
                background: var(--b3-theme-background);
            }
            .sy-custom-props-floatbar__input-extra-main {
                min-width: 0;
                display: flex;
                align-items: center;
                gap: 8px;
                flex: 1 1 auto;
            }
            .sy-custom-props-floatbar__input-extra-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 16px;
                height: 16px;
                color: var(--b3-theme-primary);
                flex: 0 0 auto;
            }
            .sy-custom-props-floatbar__input-extra-text {
                min-width: 0;
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .sy-custom-props-floatbar__input-extra-title {
                font-size: 12px;
                font-weight: 600;
                color: var(--b3-theme-on-background);
            }
            .sy-custom-props-floatbar__input-extra-desc {
                font-size: 11px;
                color: var(--b3-theme-on-surface);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .sy-custom-props-floatbar__input-extra-tail {
                color: var(--b3-theme-on-surface);
                flex: 0 0 auto;
                display: inline-flex;
                align-items: center;
                justify-content: center;
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
                display: inline-flex;
                align-items: center;
                justify-content: center;
                line-height: 0;
            }
            .sy-custom-props-floatbar__action .qb-icon svg {
                width: 14px;
                height: 14px;
                display: block;
            }
            .sy-custom-props-floatbar__action .sy-custom-props-floatbar__action-text {
                max-width: 108px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-size: 12px;
                font-weight: 600;
                line-height: 1;
            }
            .sy-custom-props-floatbar__action.is-wide {
                width: auto;
                padding: 0 6px;
                gap: 4px;
            }
            .sy-custom-props-floatbar__action.is-active {
                color: var(--b3-theme-primary);
                border-color: color-mix(in srgb, var(--b3-theme-primary) 58%, var(--b3-border-color) 42%);
                background: color-mix(in srgb, var(--b3-theme-primary-light, var(--b3-theme-surface-light)) 70%, var(--b3-theme-background) 30%);
            }
            .sy-custom-props-floatbar__action:hover {
                background: var(--b3-theme-background);
                border-color: var(--b3-theme-primary);
            }
            @media (max-width: 640px) {
                .sy-custom-props-floatbar {
                    max-width: calc(100vw - 12px);
                }
                .sy-custom-props-floatbar__row--main {
                    overflow-x: auto;
                    overflow-y: hidden;
                    -webkit-overflow-scrolling: touch;
                    scrollbar-width: thin;
                }
                .sy-custom-props-floatbar__prop--remark {
                    max-width: min(72vw, 360px);
                }
                .sy-custom-props-floatbar__prop--remark:not(.sy-custom-props-floatbar__prop--icon-only) {
                    align-items: flex-start;
                    padding-top: 5px;
                    padding-bottom: 5px;
                }
                .sy-custom-props-floatbar__prop--remark .sy-custom-props-floatbar__prop-value {
                    white-space: normal;
                    overflow-wrap: anywhere;
                    word-break: break-word;
                    text-overflow: clip;
                }
                .sy-custom-props-floatbar__prop--remark:not(.sy-custom-props-floatbar__prop--icon-only) .sy-custom-props-floatbar__prop-icon {
                    margin-top: 1px;
                }
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
                z-index: 1;
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
                display: inline-flex;
                align-items: center;
                min-width: 0;
                max-width: min(34vw, 280px);
            }
            .sy-custom-props-inline-chip--remark .sy-custom-props-inline-chip-value {
                display: block;
                max-width: 100%;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
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
                z-index: 1;
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
            <textarea class="sy-custom-props-floatbar__textarea is-hidden" placeholder="输入内容..."></textarea>
            <div class="sy-custom-props-floatbar__input-extra" data-input-extra></div>
            <div class="sy-custom-props-floatbar__remark-toolbar" data-remark-toolbar hidden>
                <button class="sy-custom-props-floatbar__btn sy-custom-props-floatbar__remark-tool" data-remark-tool="bullet"${buildTooltipAttrs('无序列表')}>•</button>
                <button class="sy-custom-props-floatbar__btn sy-custom-props-floatbar__remark-tool" data-remark-tool="ordered"${buildTooltipAttrs('有序列表')}>1.</button>
                <button class="sy-custom-props-floatbar__btn sy-custom-props-floatbar__remark-tool" data-remark-tool="bold"${buildTooltipAttrs('粗体')}>B</button>
                <button class="sy-custom-props-floatbar__btn sy-custom-props-floatbar__remark-tool" data-remark-tool="italic"${buildTooltipAttrs('斜体')}>I</button>
                <button class="sy-custom-props-floatbar__btn sy-custom-props-floatbar__remark-tool" data-remark-tool="code"${buildTooltipAttrs('行内代码')}>Code</button>
                <button class="sy-custom-props-floatbar__btn sy-custom-props-floatbar__remark-tool" data-remark-tool="link"${buildTooltipAttrs('链接')}>∞</button>
                <button class="sy-custom-props-floatbar__btn sy-custom-props-floatbar__remark-tool" data-remark-tool="quote"${buildTooltipAttrs('引用')}>❝</button>
            </div>
            <div class="sy-custom-props-floatbar__input-actions">
                <button class="sy-custom-props-floatbar__btn sy-custom-props-floatbar__btn--remark-tools" data-action="remark-tools">A</button>
                <button class="sy-custom-props-floatbar__btn" data-action="cancel">取消</button>
                <button class="sy-custom-props-floatbar__btn" data-action="save">确定</button>
            </div>
        `.trim();
        document.body.appendChild(inputEditor);

        // 状态变量
        let currentBlockEl = null;
        let currentBlockId = '';
        let currentTaskId = '';
        let currentTaskName = '';
        let currentProps = {};  // 当前块的所有自定义属性值
        let currentReminderSnapshot = null;
        let currentReminderRefreshToken = 0;
        let activePropConfig = null;  // 当前编辑的属性配置
        let inputResolve = null;  // 输入框Promise解析器

        function getInputEditorControls() {
            return {
                input: inputEditor.querySelector('.sy-custom-props-floatbar__input'),
                textarea: inputEditor.querySelector('.sy-custom-props-floatbar__textarea')
            };
        }

        function syncInputEditorTextareaHeight(textarea, minHeight = 76) {
            if (!(textarea instanceof HTMLTextAreaElement)) return;
            const baseHeight = Math.max(34, Number(minHeight) || 76);
            try { textarea.style.height = 'auto'; } catch (e) {}
            const nextHeight = Math.max(baseHeight, Math.min(420, textarea.scrollHeight || 0));
            textarea.style.height = `${nextHeight}px`;
        }

        function positionPopupNearAnchor(popupEl, anchorEl, options = {}) {
            if (!(popupEl instanceof HTMLElement) || !(anchorEl instanceof HTMLElement)) return;
            const gap = Math.max(0, Number(options.gap) || 4);
            const viewportMargin = Math.max(4, Number(options.viewportMargin) || 6);
            const viewportW = document.documentElement?.clientWidth || window.innerWidth || 0;
            const viewportH = document.documentElement?.clientHeight || window.innerHeight || 0;
            if (!viewportW || !viewportH) return;

            const anchorRect = anchorEl.getBoundingClientRect();
            const popupRect = popupEl.getBoundingClientRect();
            const popupWidth = Math.min(
                Math.max(0, popupRect.width || popupEl.offsetWidth || 0),
                Math.max(0, viewportW - viewportMargin * 2)
            );
            const popupHeight = Math.min(
                Math.max(0, popupRect.height || popupEl.offsetHeight || 0),
                Math.max(0, viewportH - viewportMargin * 2)
            );
            const viewportLeft = window.scrollX;
            const viewportTop = window.scrollY;
            const minLeft = viewportLeft + viewportMargin;
            const maxLeft = viewportLeft + Math.max(viewportMargin, viewportW - popupWidth - viewportMargin);
            let left = viewportLeft + anchorRect.left;
            if (left + popupWidth > viewportLeft + viewportW - viewportMargin) {
                left = viewportLeft + anchorRect.right - popupWidth;
            }
            left = Math.max(minLeft, Math.min(left, maxLeft));

            const minTop = viewportTop + viewportMargin;
            const maxTop = viewportTop + Math.max(viewportMargin, viewportH - popupHeight - viewportMargin);
            const belowTop = viewportTop + anchorRect.bottom + gap;
            const aboveTop = viewportTop + anchorRect.top - popupHeight - gap;
            let top = belowTop;
            if (belowTop + popupHeight > viewportTop + viewportH - viewportMargin && aboveTop >= minTop) {
                top = aboveTop;
            }
            top = Math.max(minTop, Math.min(top, maxTop));

            popupEl.style.left = `${Math.round(left)}px`;
            popupEl.style.top = `${Math.round(top)}px`;
        }

        function setInputEditorMode(mode = 'input') {
            const { input, textarea } = getInputEditorControls();
            const useTextarea = mode === 'textarea';
            const remarkToolbar = inputEditor.querySelector('[data-remark-toolbar]');
            const extraPanel = inputEditor.querySelector('[data-input-extra]');
            if (input instanceof HTMLInputElement) {
                input.classList.toggle('is-hidden', useTextarea);
                input.disabled = useTextarea;
                input.oninput = null;
                input.onkeydown = null;
                input.onchange = null;
                input.onclick = null;
            }
            if (textarea instanceof HTMLTextAreaElement) {
                textarea.classList.toggle('is-hidden', !useTextarea);
                textarea.disabled = !useTextarea;
                textarea.oninput = null;
                textarea.onkeydown = null;
            }
            inputEditor.classList.toggle('is-remark', useTextarea);
            if (remarkToolbar instanceof HTMLElement) {
                remarkToolbar.classList.remove('is-open');
                remarkToolbar.hidden = true;
            }
            if (extraPanel instanceof HTMLElement) {
                extraPanel.classList.remove('is-visible');
                extraPanel.innerHTML = '';
            }
            return useTextarea ? textarea : input;
        }

        function getBlockElById(blockId) {
            const id = String(blockId || '').trim();
            if (!id) return null;
            return document.querySelector(`.li[data-node-id="${id}"],[data-type="NodeListItem"][data-node-id="${id}"],[data-node-id="${id}"]`);
        }

        function updateCurrentTaskContext(blockEl, attrHostId = '') {
            currentBlockEl = blockEl || null;
            let binding = null;
            try {
                binding = resolveTaskBindingFromBlockEl(blockEl);
            } catch (e) {
                binding = null;
            }
            const fallbackId = String(blockEl?.dataset?.nodeId || '').trim();
            const taskId = String(binding?.taskId || fallbackId).trim();
            const hostId = String(attrHostId || binding?.attrHostId || taskId || fallbackId).trim();
            currentBlockId = hostId || fallbackId;
            currentTaskId = taskId || currentBlockId;
            try {
                currentTaskName = getTaskTitleFromBlockEl(blockEl);
            } catch (e) {
                currentTaskName = '';
            }
        }

        function resolveCurrentTaskId() {
            if (String(currentTaskId || '').trim()) return String(currentTaskId).trim();
            const blockEl = currentBlockEl || getBlockElById(currentBlockId) || null;
            const resolvedId = String(resolveTaskNodeIdForDetail(blockEl) || '').trim();
            if (resolvedId) return resolvedId;
            return String(currentBlockId || '').trim();
        }

        function dispatchTaskAttrUpdated(attrHostId, attrKey, value) {
            const key = String(attrKey || '').trim();
            const hostId = String(attrHostId || currentBlockId || '').trim();
            const blockEl = getBlockElById(hostId) || currentBlockEl || null;
            const taskId = String(resolveTaskNodeIdForDetail(blockEl) || resolveCurrentTaskId() || hostId).trim();
            if (!key || (!taskId && !hostId)) return;
            try {
                window.dispatchEvent(new CustomEvent('tm-task-attr-updated', {
                    detail: {
                        taskId: taskId || hostId,
                        attrHostId: hostId || taskId,
                        attrKey: key,
                        value: value == null ? '' : String(value),
                    }
                }));
            } catch (e) {}
        }

        function resolveCurrentTaskName() {
            if (String(currentTaskName || '').trim()) return String(currentTaskName).trim();
            const blockEl = currentBlockEl || getBlockElById(currentBlockId) || null;
            return getTaskTitleFromBlockEl(blockEl);
        }

        function normalizeReminderTaskName(value) {
            let text = String(value || '').split(/\r?\n/)[0].trim();
            if (!text) return '任务';
            text = text.replace(/^[\s>*-]*\[[xX ]\]\s*/, '').trim();
            text = text.replace(/\{\:\s*[^}]*\}/g, '');
            text = text.replace(/<span[^>]*>[\s\S]*?<\/span>/gi, '');
            text = text.replace(/<[^>]+>/g, '');
            text = text.replace(/\s{2,}/g, ' ').trim();
            return text || '任务';
        }

        async function openReminderDialogForCurrentTask() {
            const showDialog = globalThis.__tomatoReminder?.showDialog;
            if (typeof showDialog !== 'function') {
                if (typeof window.tmReminder === 'function') {
                    const fallbackTaskId = String(resolveCurrentTaskId() || currentBlockId || '').trim();
                    if (!fallbackTaskId) {
                        showMessage('未找到任务', true, 1800);
                        return;
                    }
                    Promise.resolve(window.tmReminder(fallbackTaskId)).catch(() => {
                        showMessage('未检测到提醒功能，请确认番茄插件已启用', true, 2000);
                    });
                    scheduleCurrentReminderSnapshotRefresh(true);
                    return;
                }
                showMessage('未检测到提醒功能，请确认番茄插件已启用', true, 2000);
                return;
            }

            const fallbackId = String(resolveCurrentTaskId() || currentBlockId || '').trim();
            const fallbackName = normalizeReminderTaskName(resolveCurrentTaskName());
            let taskLike = null;
            const buildTaskLike = globalThis.__taskHorizonBuildTaskLikeFromBlockId;
            if (typeof buildTaskLike === 'function' && fallbackId) {
                try { taskLike = await buildTaskLike(fallbackId); } catch (e) { taskLike = null; }
            }

            const candidateIds = [];
            const pushCandidateId = (value) => {
                const id = String(value || '').trim();
                if (!id) return;
                if (candidateIds.includes(id)) return;
                candidateIds.push(id);
            };

            pushCandidateId(taskLike?.id);
            pushCandidateId(fallbackId);
            pushCandidateId(currentTaskId);
            pushCandidateId(currentBlockId);
            pushCandidateId(resolveTaskNodeIdForDetail(currentBlockEl));
            pushCandidateId(resolveTaskAttrNodeIdForDetail(currentBlockEl));
            pushCandidateId(currentBlockEl?.dataset?.nodeId);

            if (!candidateIds.length) {
                showMessage('未找到任务', true, 1800);
                return;
            }

            const candidateNameMap = new Map();
            const normalizedTaskLikeName = normalizeReminderTaskName(taskLike?.content || taskLike?.raw_content || '');
            candidateIds.forEach((id) => {
                candidateNameMap.set(id, normalizedTaskLikeName || fallbackName || '任务');
            });
            if (fallbackId && fallbackName) candidateNameMap.set(fallbackId, fallbackName);

            const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
            const hasReminderDialog = () => !!document.getElementById('tomato-reminder-backdrop');

            try {
                document.getElementById('tomato-reminder-dialog')?.remove();
                document.getElementById('tomato-reminder-backdrop')?.remove();
            } catch (e) {}

            for (const candidateId of candidateIds) {
                const name = String(candidateNameMap.get(candidateId) || fallbackName || '任务').trim() || '任务';
                for (let attempt = 0; attempt < 2; attempt += 1) {
                    try { showDialog(candidateId, name); } catch (e) {}
                    await wait(attempt === 0 ? 120 : 180);
                    if (hasReminderDialog()) {
                        scheduleCurrentReminderSnapshotRefresh(true);
                        return;
                    }
                }
            }

            showMessage('未能打开提醒设置，请确认任务块与番茄钟插件状态', true, 2400);
        }

        async function openRepeatDialogForCurrentTask() {
            const openRepeat = globalThis.tmEditTaskRepeatRule;
            if (typeof openRepeat !== 'function') {
                showMessage('未检测到任务循环功能，请确认任务管理器已启用', true, 2000);
                return null;
            }
            const candidateIds = [
                resolveCurrentTaskId(),
                currentTaskId,
                currentBlockId,
                resolveTaskNodeIdForDetail(currentBlockEl),
                resolveTaskAttrNodeIdForDetail(currentBlockEl),
                currentBlockEl?.dataset?.nodeId,
            ].map((id) => String(id || '').trim()).filter(Boolean);
            const uniqIds = Array.from(new Set(candidateIds));
            if (!uniqIds.length) {
                showMessage('未找到任务', true, 1800);
                return null;
            }
            for (const candidateId of uniqIds) {
                try {
                    const result = await openRepeat(candidateId);
                    if (result !== null) return { candidateId, result };
                } catch (e) {}
            }
            showMessage('未能打开循环设置，请确认任务块状态', true, 2200);
            return null;
        }

        async function getRepeatRuleForTask(taskId) {
            const getter = globalThis.tmGetTaskRepeatRule;
            if (typeof getter !== 'function') return null;
            const id = String(taskId || '').trim();
            if (!id) return null;
            try { return await getter(id); } catch (e) { return null; }
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
            const statusOptions = getStatusOptionsSnapshot();
            const statusConfig = [...customPropsConfig.firstRow, ...customPropsConfig.secondRow]
                .find(p => p.attrKey === 'custom-status');
            if (statusConfig) {
                statusConfig.options = statusOptions.map(o => ({
                    value: o.id,
                    label: o.name,
                    color: o.color
                }));
                statusConfig.defaultValue = getDefaultUndoneStatusId(statusOptions);
            }
        }

        // 从任务管理器读取状态选项
        async function loadStatusOptions() {
            try {
                getStatusOptionsSnapshot();
                updateStatusOptionsInConfig();
            } catch (e) {
                console.warn('读取状态选项失败:', e);
            }
        }

        __tmQBStatusRenderStorageHandler = (e) => {
            if (!e) return;
            if (e.key === 'tm_custom_status_options' || e.key === 'tm_checkbox_undone_status_id') {
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

        async function saveTaskAttrWithUndo(blockId, attrKey, value, options = {}) {
            const id = String(blockId || '').trim();
            const key = String(attrKey || '').trim();
            if (!id || !key) return { success: false, viaSharedApi: false };
            if (key === 'custom-status') {
                const applier = globalThis?.['siyuan-plugin-task-horizon']?.applyTaskStatus;
                if (typeof applier === 'function') {
                    try {
                        const nextStatus = value == null ? '' : String(value);
                        await applier(id, nextStatus, {
                            source: 'quickbar-status',
                            label: String(options?.label || '状态'),
                            refresh: false,
                            refreshCalendar: false,
                            withFilters: false,
                            broadcast: true,
                            recordUndo: true,
                        });
                        return {
                            success: true,
                            changed: true,
                            viaSharedApi: true,
                            value: nextStatus,
                        };
                    } catch (e) {}
                }
            }
            if (key === 'custom-start-date' || key === 'custom-completion-time') {
                const updater = globalThis.tmUpdateTaskDates;
                if (typeof updater === 'function') {
                    try {
                        await updater(id, key === 'custom-start-date'
                            ? { startDate: value == null ? '' : String(value) }
                            : { completionTime: value == null ? '' : String(value) }, { refresh: false });
                        return {
                            success: true,
                            changed: true,
                            viaSharedApi: true,
                            value: value == null ? '' : String(value),
                        };
                    } catch (e) {}
                }
            }
            const success = await setBlockCustomAttrs(id, { [key]: value });
            return {
                success,
                changed: success,
                viaSharedApi: false,
                value: value == null ? '' : String(value),
            };
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

        function renderPhosphorBoldIcon(iconName, size = 14) {
            const name = String(iconName || '').trim().toLowerCase();
            const official = {
                sparkle: 'M199,125.31l-49.88-18.39L130.69,57a19.92,19.92,0,0,0-37.38,0L74.92,106.92,25,125.31a19.92,19.92,0,0,0,0,37.38l49.88,18.39L93.31,231a19.92,19.92,0,0,0,37.38,0l18.39-49.88L199,162.69a19.92,19.92,0,0,0,0-37.38Zm-63.38,35.16a12,12,0,0,0-7.11,7.11L112,212.28l-16.47-44.7a12,12,0,0,0-7.11-7.11L43.72,144l44.7-16.47a12,12,0,0,0,7.11-7.11L112,75.72l16.47,44.7a12,12,0,0,0,7.11,7.11L180.28,144ZM140,40a12,12,0,0,1,12-12h12V16a12,12,0,0,1,24,0V28h12a12,12,0,0,1,0,24H188V64a12,12,0,0,1-24,0V52H152A12,12,0,0,1,140,40ZM252,88a12,12,0,0,1-12,12h-4v4a12,12,0,0,1-24,0v-4h-4a12,12,0,0,1,0-24h4V72a12,12,0,0,1,24,0v4h4A12,12,0,0,1,252,88Z',
                repeat: 'M20,128A76.08,76.08,0,0,1,96,52h99l-3.52-3.51a12,12,0,1,1,17-17l24,24a12,12,0,0,1,0,17l-24,24a12,12,0,0,1-17-17L195,76H96a52.06,52.06,0,0,0-52,52,12,12,0,0,1-24,0Zm204-12a12,12,0,0,0-12,12,52.06,52.06,0,0,1-52,52H61l3.52-3.51a12,12,0,1,0-17-17l-24,24a12,12,0,0,0,0,17l24,24a12,12,0,1,0,17-17L61,204h99a76.08,76.08,0,0,0,76-76A12,12,0,0,0,224,116Z',
                'alarm-clock': 'M128,36A100,100,0,1,0,228,136,100.11,100.11,0,0,0,128,36Zm0,176a76,76,0,1,1,76-76A76.08,76.08,0,0,1,128,212ZM32.49,72.49a12,12,0,1,1-17-17l32-32a12,12,0,1,1,17,17Zm208,0a12,12,0,0,1-17,0l-32-32a12,12,0,1,1,17-17l32,32A12,12,0,0,1,240.49,72.49ZM176,124a12,12,0,0,1,0,24H128a12,12,0,0,1-12-12V88a12,12,0,0,1,24,0v36Z',
                'calendar-check': 'M208,28H188V20a12,12,0,0,0-24,0v8H92V20a12,12,0,0,0-24,0v8H48A20.02229,20.02229,0,0,0,28,48V208a20.02229,20.02229,0,0,0,20,20H208a20.02229,20.02229,0,0,0,20-20V48A20.02229,20.02229,0,0,0,208,28Zm-4,24V76H52V52ZM52,204V100H204V204Zm120.72559-84.2373a12.00022,12.00022,0,0,1-.499,16.96386l-46.6665,44a11.99953,11.99953,0,0,1-16.48486-.02051l-25.3335-24a11.99964,11.99964,0,1,1,16.50586-17.42187l17.1001,16.19922,38.415-36.21973A11.99993,11.99993,0,0,1,172.72559,119.7627Z',
                'calendar-plus-2': 'M208,28H188V24a12,12,0,0,0-24,0v4H92V24a12,12,0,0,0-24,0v4H48A20,20,0,0,0,28,48V208a20,20,0,0,0,20,20H208a20,20,0,0,0,20-20V48A20,20,0,0,0,208,28ZM68,52a12,12,0,0,0,24,0h72a12,12,0,0,0,24,0h16V76H52V52ZM52,204V100H204V204Zm112-52a12,12,0,0,1-12,12H140v12a12,12,0,0,1-24,0V164H104a12,12,0,0,1,0-24h12V128a12,12,0,0,1,24,0v12h12A12,12,0,0,1,164,152Z',
                'dots-three': 'M144,128a16,16,0,1,1-16-16A16,16,0,0,1,144,128ZM60,112a16,16,0,1,0,16,16A16,16,0,0,0,60,112Zm136,0a16,16,0,1,0,16,16A16,16,0,0,0,196,112Z',
                'note-pencil': 'M232.48535,55.51465l-32-32a12.00062,12.00062,0,0,0-16.9707,0l-96,96A12.002,12.002,0,0,0,84,128v32a12.00028,12.00028,0,0,0,12,12h32a11.99907,11.99907,0,0,0,8.48535-3.51465l96-96A11.99973,11.99973,0,0,0,232.48535,55.51465ZM192,48.97046,207.0293,64,196,75.0293,180.9707,60ZM123.0293,148H108V132.97046L164,76.9707,179.0293,92ZM228,128.56836V208a20.0226,20.0226,0,0,1-20,20H48a20.0226,20.0226,0,0,1-20-20V48A20.02244,20.02244,0,0,1,48,28h79.43164a12,12,0,0,1,0,24H52V204H204V128.56836a12,12,0,0,1,24,0Z',
                timer: 'M128,44a96,96,0,1,0,96,96A96.11,96.11,0,0,0,128,44Zm0,168a72,72,0,1,1,72-72A72.08,72.08,0,0,1,128,212ZM164.49,99.51a12,12,0,0,1,0,17l-28,28a12,12,0,0,1-17-17l28-28A12,12,0,0,1,164.49,99.51ZM92,16A12,12,0,0,1,104,4h48a12,12,0,0,1,0,24H104A12,12,0,0,1,92,16Z',
            }[name];
            if (official) {
                return `<svg viewBox="0 0 256 256" width="${size}" height="${size}" aria-hidden="true"><path fill="currentColor" stroke="none" d="${official}"></path></svg>`;
            }
            const body = (() => {
                switch (name) {
                    case 'caret-double-up': return '<path d="m6 15 6-6 6 6" /><path d="m6 20 6-6 6 6" />';
                    case 'caret-double-down': return '<path d="m6 4 6 6 6-6" /><path d="m6 10 6 6 6-6" />';
                    case 'minus': return '<path d="M6 12h12" />';
                    case 'circle-dot': return '<circle cx="12" cy="12" r="8.75" /><circle cx="12" cy="12" r="1.25" />';
                    default: return '<circle cx="12" cy="12" r="8.75" />';
                }
            })();
            return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.45" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
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
            const statusOptions = getStatusOptionsSnapshot();
            const resolvedValue = String(value || '').trim() || getDefaultUndoneStatusId(statusOptions);
            const option = statusOptions.find(o => o.id === resolvedValue);
            return {
                name: option ? option.name : resolvedValue,
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

        function buildTooltipAttrs(label, side = 'top') {
            const text = String(label || '').trim();
            if (!text) return '';
            return ` data-tooltip="${esc(text)}" data-side="${esc(String(side || 'top').trim() || 'top')}" aria-label="${esc(text)}"`;
        }

        function getFloatbarCoreIconName(attrKey) {
            const key = String(attrKey || '').trim();
            if (key === 'custom-start-date') return 'calendar-plus-2';
            if (key === 'custom-completion-time') return 'calendar-check';
            if (key === 'custom-duration') return 'timer';
            if (key === 'custom-remark') return 'note-pencil';
            return '';
        }

        function getFloatbarCoreDisplayValue(config, value) {
            const attrKey = String(config?.attrKey || '').trim();
            const rawValue = String(value ?? '').trim();
            if (!rawValue) return '';
            if (config?.type === 'date') return formatDate(rawValue);
            if (attrKey === 'custom-remark') return truncateInlineValue(rawValue, 24);
            if (attrKey === 'custom-duration') return truncateInlineValue(rawValue, 12);
            return truncateInlineValue(rawValue, 15);
        }

        function renderFloatbarCoreLikeProp(config, value, opts = {}) {
            const attrKey = String(config?.attrKey || '').trim();
            const rawValue = String(value ?? '').trim();
            const displayValue = String(opts.displayValue ?? getFloatbarCoreDisplayValue(config, rawValue));
            const hasValue = !!displayValue;
            const tooltipSource = rawValue;
            const tooltipText = tooltipSource ? `${String(config?.name || '').trim()}: ${tooltipSource}` : (config?.name || '');
            const className = [
                'sy-custom-props-floatbar__prop',
                'sy-custom-props-floatbar__prop--core',
                hasValue ? '' : 'sy-custom-props-floatbar__prop--icon-only',
                String(opts.extraClass || '').trim()
            ].filter(Boolean).join(' ');
            const style = hasValue ? '' : 'opacity: 0.6;';
            return `
                    <span class="${className}"
                          data-attr="${esc(attrKey)}"
                          data-type="${esc(String(config?.type || ''))}"
                          data-name="${esc(String(config?.name || ''))}"
                          data-value="${esc(String(value ?? ''))}"
                          ${buildTooltipAttrs(tooltipText)}
                          style="${style}">
                        <span class="sy-custom-props-floatbar__prop-icon">${renderPhosphorBoldIcon(getFloatbarCoreIconName(attrKey), 14)}</span>${hasValue ? `<span class="sy-custom-props-floatbar__prop-value">${esc(displayValue)}</span>` : ''}
                    </span>
                `;
        }

        function normalizeCustomProps(attrs) {
            const data = attrs && typeof attrs === 'object' ? attrs : {};
            const statusOptions = getStatusOptionsSnapshot();
            const defaultUndoneStatusId = getDefaultUndoneStatusId(statusOptions);
            return {
                'custom-priority': data['custom-priority'] || 'none',
                'custom-status': String(data['custom-status'] || '').trim() || defaultUndoneStatusId,
                'custom-completion-time': data['custom-completion-time'] || '',
                'custom-start-date': data['custom-start-date'] || '',
                'custom-duration': data['custom-duration'] || '',
                'custom-remark': data['custom-remark'] || '',
                'custom-pinned': data['custom-pinned'] || '',
                'bookmark': data['bookmark'] || ''
            };
        }

        function isReminderRelatedAttrKey(attrKey) {
            const key = String(attrKey || '').trim();
            return !key
                || key === 'bookmark'
                || key === 'custom-reminder'
                || key === 'custom-start-date'
                || key === 'custom-completion-time'
                || key === 'custom-task-repeat-rule'
                || key === 'custom-task-repeat-state';
        }

        async function refreshCurrentReminderSnapshot(force = false) {
            const getter = globalThis?.['siyuan-plugin-task-horizon']?.getTaskReminderSnapshotByAnyId;
            const lookupId = String(currentBlockId || resolveCurrentTaskId() || '').trim();
            const token = ++currentReminderRefreshToken;
            if (!lookupId || typeof getter !== 'function') {
                if (token === currentReminderRefreshToken) currentReminderSnapshot = null;
                return null;
            }
            try {
                const snapshot = await getter(lookupId, { force: !!force });
                if (token !== currentReminderRefreshToken) return currentReminderSnapshot;
                currentReminderSnapshot = snapshot && typeof snapshot === 'object' ? snapshot : null;
                return currentReminderSnapshot;
            } catch (e) {
                if (token === currentReminderRefreshToken) currentReminderSnapshot = null;
                return null;
            }
        }

        function scheduleCurrentReminderSnapshotRefresh(force = false) {
            const expectedBlockId = String(currentBlockId || '').trim();
            const expectedTaskId = String(resolveCurrentTaskId() || '').trim();
            const plan = [180, 760, 1800, 3600];
            plan.forEach((delay) => {
                try {
                    setTimeout(async () => {
                        if (!floatBar || floatBar.style.display === 'none') return;
                        const liveBlockId = String(currentBlockId || '').trim();
                        const liveTaskId = String(resolveCurrentTaskId() || '').trim();
                        if (expectedBlockId && liveBlockId && liveBlockId !== expectedBlockId) return;
                        if (expectedTaskId && liveTaskId && liveTaskId !== expectedTaskId) return;
                        await refreshCurrentReminderSnapshot(force);
                        if (!floatBar || floatBar.style.display === 'none') return;
                        renderFloatBar();
                        updatePosition();
                    }, delay);
                } catch (e) {}
            });
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
                const effectiveValue = rawValue || getDefaultUndoneStatusId();
                const statusInfo = getStatusDisplay(effectiveValue);
                return `
                    <span class="sy-custom-props-inline-chip sy-custom-props-inline-chip--status" data-inline-attr="${escapedAttr}" data-inline-type="select" data-inline-name="${escapedName}" data-inline-value="${esc(String(effectiveValue)).replace(/"/g, '&quot;')}" title="${escapedName}">
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
            const displayValue = isDate
                ? formatDate(rawValue)
                : truncateInlineValue(rawValue, attrKey === 'custom-remark' ? 24 : 10);
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
            try {
                const statusSnapshot = await getManagedTaskStatusSnapshot(id);
                if (statusSnapshot && typeof statusSnapshot === 'object') {
                    const statusValue = String(statusSnapshot.value || '').trim();
                    if (statusValue) props['custom-status'] = statusValue;
                }
            } catch (e) {}
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
                const blockId = String(resolveTaskAttrNodeIdForDetail(list[i]) || list[i]?.dataset?.nodeId || '').trim();
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

        function shouldSplitRemarkIntoOwnRow(visibleSet) {
            const visible = visibleSet instanceof Set ? visibleSet : new Set();
            if (!visible.has('custom-remark')) return false;
            const remark = String(currentProps?.['custom-remark'] || '').trim();
            if (!remark) return false;
            return (window.innerWidth || 0) <= 640;
        }

        // 渲染悬浮条
        function renderFloatBar() {
            updateStatusOptionsInConfig();
            const rows = [];
            const visibleSettings = getQuickbarVisibleSettings();
            const visibleSet = new Set(visibleSettings.items);
            const splitRemarkRow = shouldSplitRemarkIntoOwnRow(visibleSet);
            const mainConfigs = [
                ...customPropsConfig.firstRow,
                ...(splitRemarkRow ? [] : customPropsConfig.secondRow)
            ];
            const mainProps = mainConfigs
                .filter(config => visibleSet.has(String(config?.attrKey || '').trim()))
                .map(config => renderPropElement(config, currentProps[config.attrKey]));
            if (isAiFeatureEnabled() && visibleSet.has('action-ai-title')) {
                mainProps.push(`<button class="sy-custom-props-floatbar__action" data-action="ai-title"${buildTooltipAttrs('AI 优化任务名称')}><span class="qb-icon">${renderPhosphorBoldIcon('sparkle')}</span></button>`);
            }
            if (visibleSet.has('action-reminder')) {
                const hasReminder = !!(currentReminderSnapshot?.hasReminder || String(currentProps?.bookmark || '').includes('⏰'));
                const reminderText = hasReminder ? String(currentReminderSnapshot?.displayText || '').trim() : '';
                const reminderTooltip = hasReminder
                    ? (String(currentReminderSnapshot?.tooltip || '').trim() || '已添加提醒')
                    : '添加提醒';
                mainProps.push(`
                    <button class="sy-custom-props-floatbar__action ${hasReminder ? 'is-active' : ''} ${reminderText ? 'is-wide' : ''}" data-action="reminder"${buildTooltipAttrs(reminderTooltip)}>
                        <span class="qb-icon">${renderPhosphorBoldIcon('alarm-clock')}</span>${reminderText ? `<span class="sy-custom-props-floatbar__action-text">${esc(reminderText)}</span>` : ''}
                    </button>
                `.trim());
            }
            if (visibleSet.has('action-more')) {
                mainProps.push(`<button class="sy-custom-props-floatbar__action" data-action="more"${buildTooltipAttrs('更多')}><span class="qb-icon">${renderPhosphorBoldIcon('dots-three')}</span></button>`);
            }
            if (mainProps.length) {
                rows.push(`<div class="sy-custom-props-floatbar__row sy-custom-props-floatbar__row--main">${mainProps.join('')}</div>`);
            }
            if (splitRemarkRow) {
                const remarkProps = customPropsConfig.secondRow
                    .filter(config => visibleSet.has(String(config?.attrKey || '').trim()))
                    .map(config => renderPropElement(config, currentProps[config.attrKey]))
                    .filter(Boolean);
                if (remarkProps.length) {
                    rows.push(`<div class="sy-custom-props-floatbar__row sy-custom-props-floatbar__row--remark">${remarkProps.join('')}</div>`);
                }
            }

            floatBar.innerHTML = rows.join('');

            // 绑定点击事件
            bindPropClickEvents();
        }

        // 渲染单个属性元素
        function renderPropElement(config, value) {
            const escapedName = esc(String(config.name || ''));
            const escapedValue = esc(String(value ?? ''));
            const attrKey = String(config.attrKey || '').trim();

            if (config.type === 'select') {
                if (attrKey === 'custom-priority') {
                    return `
                        <span class="sy-custom-props-floatbar__prop is-priority-prop"
                              data-attr="${esc(attrKey)}"
                              data-type="${config.type}"
                              data-name="${escapedName}"
                              data-value="${escapedValue}"
                              ${buildTooltipAttrs(config.name || '')}>
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
                          data-attr="${esc(attrKey)}"
                          data-type="${config.type}"
                          data-name="${escapedName}"
                          data-value="${escapedValue}"
                          ${buildTooltipAttrs(config.name || '')}
                          style="background: ${bgColor}; border-color: ${color}; color: ${color};">
                        <span class="sy-custom-props-floatbar__prop-value">${displayText}</span>
                    </span>
                `;
            } else if (config.type === 'date') {
                return renderFloatbarCoreLikeProp(config, value);
            } else {
                // 文本类型属性（时长、备注）
                if (attrKey === 'custom-duration') {
                    return renderFloatbarCoreLikeProp(config, value);
                }
                if (attrKey === 'custom-remark') {
                    return renderFloatbarCoreLikeProp(config, value, { extraClass: 'sy-custom-props-floatbar__prop--remark' });
                }
                const style = value ? '' : 'opacity: 0.6;';
                return `
                    <span class="sy-custom-props-floatbar__prop sy-custom-props-floatbar__prop--icon-only"
                          data-attr="${esc(attrKey)}"
                          data-type="${config.type}"
                          data-name="${escapedName}"
                          data-value="${escapedValue}"
                          ${buildTooltipAttrs(config.name || '')}
                          style="${style}">
                        <span class="sy-custom-props-floatbar__prop-icon">${renderPhosphorBoldIcon(getFloatbarCoreIconName(attrKey), 14)}</span>
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
                        openReminderDialogForCurrentTask();
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

                const result = await saveTaskAttrWithUndo(currentBlockId, config.attrKey, newValue, {
                    label: config.name,
                });

                if (result.success) {
                    currentProps[config.attrKey] = newValue;
                    renderFloatBar();
                    patchInlineMetaCache(currentBlockId, { [config.attrKey]: newValue });
                    refreshInlineMetaByTaskId(currentBlockId, false);
                    showMessage(`已更新${config.name}`, false, 1500);
                    if (!result.viaSharedApi) {
                        dispatchTaskAttrUpdated(currentBlockId, config.attrKey, newValue);
                    }
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
            const isCompletionDate = String(config?.attrKey || '').trim() === 'custom-completion-time';
            const extraPanel = inputEditor.querySelector('[data-input-extra]');
            const saveDateValue = async (rawDateValue) => {
                const newValue = rawDateValue ? parseDate(rawDateValue) : '';
                const result = await saveTaskAttrWithUndo(blockIdAtOpen, config.attrKey, newValue, {
                    label: config.name,
                });
                if (result.success) {
                    if (String(currentBlockId || '').trim() === blockIdAtOpen) {
                        currentProps[config.attrKey] = newValue;
                        renderFloatBar();
                    }
                    patchInlineMetaCache(blockIdAtOpen, { [config.attrKey]: newValue });
                    refreshInlineMetaByTaskId(blockIdAtOpen, false);
                    showMessage(`已更新${config.name}`, false, 1500);
                    if (!result.viaSharedApi) {
                        dispatchTaskAttrUpdated(blockIdAtOpen, config.attrKey, newValue);
                    }
                } else {
                    showMessage('更新失败', true, 2000);
                }
            };
            const renderRepeatExtras = async () => {
                if (!isCompletionDate || !(extraPanel instanceof HTMLElement)) return;
                const repeatRule = await getRepeatRuleForTask(blockIdAtOpen);
                const repeatSummary = String(repeatRule?.summary || '').trim() || '不重复';
                const untilSummary = (repeatRule && repeatRule.enabled)
                    ? (String(repeatRule.until || '').trim() ? `结束于 ${String(repeatRule.until || '').trim()}` : '永不结束')
                    : '未设置';
                extraPanel.innerHTML = `
                    <button type="button" class="sy-custom-props-floatbar__input-extra-row" data-repeat-row="rule">
                        <span class="sy-custom-props-floatbar__input-extra-main">
                            <span class="sy-custom-props-floatbar__input-extra-icon">${renderPhosphorBoldIcon('repeat', 14)}</span>
                            <span class="sy-custom-props-floatbar__input-extra-text">
                                <span class="sy-custom-props-floatbar__input-extra-title">循环</span>
                                <span class="sy-custom-props-floatbar__input-extra-desc">${esc(repeatSummary)}</span>
                            </span>
                        </span>
                        <span class="sy-custom-props-floatbar__input-extra-tail">${renderPhosphorBoldIcon('caret-right', 12)}</span>
                    </button>
                    <button type="button" class="sy-custom-props-floatbar__input-extra-row" data-repeat-row="until">
                        <span class="sy-custom-props-floatbar__input-extra-main">
                            <span class="sy-custom-props-floatbar__input-extra-icon">${renderPhosphorBoldIcon('calendar-check', 14)}</span>
                            <span class="sy-custom-props-floatbar__input-extra-text">
                                <span class="sy-custom-props-floatbar__input-extra-title">结束方式</span>
                                <span class="sy-custom-props-floatbar__input-extra-desc">${esc(untilSummary)}</span>
                            </span>
                        </span>
                        <span class="sy-custom-props-floatbar__input-extra-tail">${renderPhosphorBoldIcon('caret-right', 12)}</span>
                    </button>
                `.trim();
                extraPanel.classList.add('is-visible');
                const handleOpenRepeat = async () => {
                    const opened = await openRepeatDialogForCurrentTask();
                    if (!opened) return;
                    try {
                        const props = await getTaskCustomProps(blockIdAtOpen, true);
                        if (String(currentBlockId || '').trim() === blockIdAtOpen) {
                            currentProps = props;
                            renderFloatBar();
                        }
                        patchInlineMetaCache(blockIdAtOpen, props);
                        refreshInlineMetaByTaskId(blockIdAtOpen, true);
                    } catch (e) {}
                    await renderRepeatExtras();
                    positionPopupNearAnchor(inputEditor, anchorEl, { gap: 4, viewportMargin: 6 });
                };
                extraPanel.querySelectorAll('[data-repeat-row]').forEach((btn) => {
                    btn.onclick = async (ev) => {
                        try { ev.preventDefault(); } catch (e) {}
                        try { ev.stopPropagation(); } catch (e) {}
                        await handleOpenRepeat();
                    };
                });
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
            const input = setInputEditorMode('input');
            if (!(input instanceof HTMLInputElement)) return;
            const oldValue = currentValue ? formatDate(currentValue) : '';
            input.type = 'date';
            input.value = oldValue;
            input.placeholder = '';

            inputEditor.classList.add('is-visible');
            positionPopupNearAnchor(inputEditor, anchorEl, { gap: 4, viewportMargin: 6 });
            Promise.resolve(renderRepeatExtras()).catch(() => null);

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
            const isRemark = String(config?.attrKey || '').trim() === 'custom-remark';
            const remarkTools = getRemarkMarkdownTools();
            const editorControl = setInputEditorMode(isRemark ? 'textarea' : 'input');
            const input = editorControl instanceof HTMLInputElement ? editorControl : null;
            const textarea = editorControl instanceof HTMLTextAreaElement ? editorControl : null;
            const valueSource = isRemark ? textarea : input;
            const remarkToolbar = inputEditor.querySelector('[data-remark-toolbar]');
            const remarkToolsBtn = inputEditor.querySelector('[data-action="remark-tools"]');
            if (!valueSource) return;
            if (input instanceof HTMLInputElement) {
                input.type = 'text';
                input.value = currentValue || '';
                input.placeholder = config.placeholder || '输入内容...';
            }
            if (textarea instanceof HTMLTextAreaElement) {
                textarea.value = currentValue || '';
                textarea.placeholder = config.placeholder || '输入内容...';
            }

            // 计算位置
            inputEditor.classList.add('is-visible');
            const repositionEditor = () => positionPopupNearAnchor(inputEditor, anchorEl, { gap: 4, viewportMargin: 6 });
            repositionEditor();
            if (textarea instanceof HTMLTextAreaElement) {
                syncInputEditorTextareaHeight(textarea, 76);
                try {
                    requestAnimationFrame(() => {
                        syncInputEditorTextareaHeight(textarea, 76);
                        repositionEditor();
                    });
                } catch (e) {}
            }

            valueSource.focus();
            if (input instanceof HTMLInputElement) {
                input.select();
            } else if (textarea instanceof HTMLTextAreaElement) {
                try { textarea.setSelectionRange(textarea.value.length, textarea.value.length); } catch (e) {}
            }

            // 绑定事件
            const saveText = async () => {
                const newValue = isRemark
                    ? normalizeRemarkMarkdown(valueSource.value || '')
                    : String(valueSource.value || '').trim();

                const result = await saveTaskAttrWithUndo(currentBlockId, config.attrKey, newValue, {
                    label: config.name,
                });

                if (result.success) {
                    currentProps[config.attrKey] = newValue;
                    renderFloatBar();
                    patchInlineMetaCache(currentBlockId, { [config.attrKey]: newValue });
                    refreshInlineMetaByTaskId(currentBlockId, false);
                    if (newValue) {
                        showMessage(`已更新${config.name}`, false, 1500);
                    } else {
                        showMessage(`已清除${config.name}`, false, 1500);
                    }
                    if (!result.viaSharedApi) {
                        dispatchTaskAttrUpdated(currentBlockId, config.attrKey, newValue);
                    }
                } else {
                    showMessage('更新失败', true, 2000);
                }

                inputEditor.classList.remove('is-visible');
            };

            if (textarea instanceof HTMLTextAreaElement) {
                textarea.oninput = () => {
                    syncInputEditorTextareaHeight(textarea, 76);
                    repositionEditor();
                };
                textarea.onkeydown = (e) => {
                    if (isRemark && remarkTools && typeof remarkTools.handleTextareaKeydown === 'function') {
                        const handled = remarkTools.handleTextareaKeydown(textarea, e);
                        if (handled) {
                            syncInputEditorTextareaHeight(textarea, 76);
                            repositionEditor();
                            return;
                        }
                    }
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        saveText();
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        if (remarkToolbar instanceof HTMLElement && remarkToolbar.classList.contains('is-open')) {
                            remarkToolbar.classList.remove('is-open');
                            remarkToolbar.hidden = true;
                            return;
                        }
                        inputEditor.classList.remove('is-visible');
                    }
                };
            }
            if (input instanceof HTMLInputElement) {
                input.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        saveText();
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        inputEditor.classList.remove('is-visible');
                    }
                };
            }

            if (isRemark && textarea instanceof HTMLTextAreaElement && remarkToolbar instanceof HTMLElement) {
                remarkToolbar.querySelectorAll('[data-remark-tool]').forEach((button) => {
                    if (!(button instanceof HTMLButtonElement)) return;
                    button.onmousedown = (e) => {
                        e.preventDefault();
                    };
                    button.onclick = (e) => {
                        e.preventDefault();
                        const action = String(button.dataset.remarkTool || '').trim();
                        if (!action || !remarkTools) return;
                        if (action === 'bold' && typeof remarkTools.wrapSelection === 'function') remarkTools.wrapSelection(textarea, '**');
                        else if (action === 'italic' && typeof remarkTools.wrapSelection === 'function') remarkTools.wrapSelection(textarea, '*');
                        else if (action === 'code' && typeof remarkTools.wrapSelection === 'function') remarkTools.wrapSelection(textarea, '`');
                        else if (action === 'link' && typeof remarkTools.insertLinkTemplate === 'function') remarkTools.insertLinkTemplate(textarea);
                        else if (action === 'quote' && typeof remarkTools.toggleLinePrefix === 'function') remarkTools.toggleLinePrefix(textarea, '> ');
                        else if (action === 'bullet' && typeof remarkTools.toggleLinePrefix === 'function') remarkTools.toggleLinePrefix(textarea, '- ');
                        else if (action === 'ordered' && typeof remarkTools.toggleOrderedList === 'function') remarkTools.toggleOrderedList(textarea);
                        syncInputEditorTextareaHeight(textarea, 76);
                        repositionEditor();
                    };
                });
                if (remarkToolsBtn instanceof HTMLButtonElement) {
                    remarkToolsBtn.onmousedown = (e) => {
                        e.preventDefault();
                    };
                    remarkToolsBtn.onclick = (e) => {
                        e.preventDefault();
                        const nextOpen = !remarkToolbar.classList.contains('is-open');
                        remarkToolbar.classList.toggle('is-open', nextOpen);
                        remarkToolbar.hidden = !nextOpen;
                        syncInputEditorTextareaHeight(textarea, 76);
                        try {
                            requestAnimationFrame(() => {
                                syncInputEditorTextareaHeight(textarea, 76);
                                repositionEditor();
                            });
                        } catch (e2) {}
                        try { textarea.focus({ preventScroll: true }); } catch (e2) { try { textarea.focus(); } catch (e3) {} }
                        repositionEditor();
                    };
                }
            } else if (remarkToolsBtn instanceof HTMLButtonElement) {
                remarkToolsBtn.onclick = null;
                remarkToolsBtn.onmousedown = null;
            }

            inputEditor.querySelector('[data-action="save"]').onclick = saveText;
            inputEditor.querySelector('[data-action="cancel"]').onclick = () => {
                if (remarkToolbar instanceof HTMLElement) {
                    remarkToolbar.classList.remove('is-open');
                    remarkToolbar.hidden = true;
                }
                inputEditor.classList.remove('is-visible');
            };
        }

        // 隐藏所有弹出层
        function hideAllPopups() {
            selectMenu.classList.remove('is-visible');
            inputEditor.classList.remove('is-visible');
        }

        // 更新悬浮条位置
        let updatePositionRafId = 0;
        function updatePosition() {
            if (updatePositionRafId) return;
            updatePositionRafId = requestAnimationFrame(() => {
                updatePositionRafId = 0;
                if (!currentBlockEl || floatBar.style.display === 'none') return;
                if (!currentBlockEl.isConnected) {
                    hideFloatBar();
                    return;
                }

                const rect = currentBlockEl.getBoundingClientRect();
                const barRect = floatBar.getBoundingClientRect();
                const barHeight = barRect.height || 40;
                const barWidth = barRect.width || 240;
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
            });
        }

        // 显示悬浮条
        async function showFloatBar(blockEl) {
            updateCurrentTaskContext(blockEl);

            // 读取当前块的自定义属性
            await refreshBlockAttrs();
            await refreshCurrentReminderSnapshot(true);

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
            currentTaskId = '';
            currentTaskName = '';
            currentProps = {};
            currentReminderSnapshot = null;
            currentReminderRefreshToken += 1;
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
                const topOcclusionBottom = getInlineTopOcclusionBottom(blockEl, rect);
                return {
                    ...rect,
                    top: Math.max(Math.round(rect.top), Math.round(topOcclusionBottom)),
                };
            } catch (e) {
                return null;
            }
        }

        function getInlineTopOcclusionBottom(blockEl, contentRect = null) {
            const baseTop = Math.max(0, Math.round(contentRect?.top ?? 0));
            if (!blockEl) return baseTop;
            try {
                const root = blockEl.closest?.('.protyle');
                if (!root) return baseTop;
                let occlusionBottom = baseTop;
                const blockers = Array.from(root.querySelectorAll('.protyle-title, .protyle-breadcrumb'));
                blockers.forEach((el) => {
                    if (!(el instanceof HTMLElement)) return;
                    const rect = el.getBoundingClientRect?.();
                    if (!rect || rect.width <= 0 || rect.height <= 0) return;
                    if (rect.bottom <= baseTop) return;
                    const style = window.getComputedStyle?.(el);
                    const position = String(style?.position || '').toLowerCase();
                    const stickyLike = position === 'sticky' || position === 'fixed' || rect.top <= (baseTop + rect.height + 24);
                    if (!stickyLike) return;
                    occlusionBottom = Math.max(occlusionBottom, Math.round(rect.bottom));
                });
                return occlusionBottom;
            } catch (e) {
                return baseTop;
            }
        }

        function getInlineTextAnchor(blockEl) {
            if (!blockEl) return null;
            const paragraph = blockEl.querySelector?.(':scope > .p') || blockEl.querySelector?.('.p') || null;
            if (!paragraph) return null;
            // 只把真正可编辑的正文区当作定位锚点，避免把其他插件插入的 contenteditable=false 信息区算进正文尾部。
            return paragraph.querySelector?.(':scope > [contenteditable="true"]')
                || paragraph.querySelector?.('[contenteditable="true"]')
                || paragraph;
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
                        if (parent?.closest?.('[contenteditable="false"],.protyle-attr,.protyle-custom')) return NodeFilter.FILTER_REJECT;
                        return NodeFilter.FILTER_ACCEPT;
                    }
                });
                let lastTextNode = null;
                while (walker.nextNode()) lastTextNode = walker.currentNode;
                if (lastTextNode) {
                    const raw = String(lastTextNode.nodeValue || '');
                    const endOffset = raw.length;
                    if (endOffset > 0) {
                        const range = document.createRange();
                        range.setStart(lastTextNode, 0);
                        range.setEnd(lastTextNode, endOffset);
                        const rects = Array.from(range.getClientRects()).filter((rect) => rect && (rect.width || rect.height));
                        let tailRect = rects.length ? rects[rects.length - 1] : null;
                        if (!tailRect) {
                            const rect = range.getBoundingClientRect();
                            if (rect && (rect.width || rect.height)) tailRect = rect;
                        }
                        let inlineRect = null;
                        let probe = lastTextNode.parentElement;
                        while (probe && probe !== textAnchor) {
                            const style = window.getComputedStyle?.(probe);
                            const display = String(style?.display || '').toLowerCase();
                            if (display.startsWith('inline')) {
                                const rect = probe.getBoundingClientRect?.();
                                if (rect && (rect.width || rect.height)) {
                                    const sameLine = !tailRect || (
                                        rect.bottom >= (tailRect.top - 1)
                                        && rect.top <= (tailRect.bottom + 1)
                                    );
                                    if (sameLine && (!tailRect || rect.right >= (tailRect.right - 1))) {
                                        inlineRect = rect;
                                    }
                                }
                            }
                            probe = probe.parentElement;
                        }
                        if (inlineRect) return inlineRect;
                        if (tailRect) return tailRect;
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
                        if (parent?.closest?.('[contenteditable="false"],.protyle-attr,.protyle-custom')) return NodeFilter.FILTER_REJECT;
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
            const blockId = String(resolveTaskAttrNodeIdForDetail(blockEl) || blockEl?.dataset?.nodeId || '').trim();
            if (!blockId) return null;
            let host = layer.querySelector(`.sy-custom-props-inline-host[data-block-id="${blockId}"]`);
            if (!host) {
                host = document.createElement('span');
                host.className = 'sy-custom-props-inline-host';
                host.setAttribute('contenteditable', 'false');
                host.setAttribute('data-inline-meta-host', 'true');
                host.setAttribute('data-block-id', blockId);
                host.addEventListener('pointerdown', async (e) => {
                    const rawTarget = e.target;
                    const targetEl = rawTarget instanceof Element ? rawTarget : rawTarget?.parentElement;
                    const chip = targetEl?.closest?.('.sy-custom-props-inline-chip');
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
                    updateCurrentTaskContext(blockRef, blockId || String(blockRef.dataset.nodeId || '').trim());
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
            inlineMetaObserver = new MutationObserver((mutations) => {
                // Ignore mutations originating from the inline meta layer itself
                // to prevent a feedback loop where our own DOM writes trigger re-renders.
                const hasRelevantMutation = mutations.some((m) => {
                    const target = m.target;
                    if (target instanceof Element) {
                        if (target.closest('.sy-custom-props-inline-layer')) return false;
                    } else if (target?.parentElement?.closest('.sy-custom-props-inline-layer')) {
                        return false;
                    }
                    return true;
                });
                if (!hasRelevantMutation) return;
                const hasStructuralChange = mutations.some((m) => {
                    if (m.type !== 'childList') return false;
                    if (m.target instanceof Element && m.target.closest('.sy-custom-props-inline-layer')) return false;
                    const nodes = [...m.addedNodes, ...m.removedNodes];
                    return nodes.some((n) => n.nodeType === Node.ELEMENT_NODE && (n.hasAttribute?.('data-node-id') || n.querySelector?.('[data-node-id]')));
                });
                inlineMetaNeedSyncBlocks = true;
                if (hasStructuralChange && !inlineMetaScrolling) {
                    inlineMetaMutationHasStructural = true;
                    inlineMetaLayoutCache.clear();
                }
                if (inlineMetaMutationTimer) clearTimeout(inlineMetaMutationTimer);
                const now = Date.now();
                const elapsed = now - inlineMetaMutationLastFireTs;
                const fireNow = elapsed >= 80;
                const fireMutation = () => {
                    inlineMetaMutationTimer = null;
                    inlineMetaMutationLastFireTs = Date.now();
                    const structural = inlineMetaMutationHasStructural;
                    inlineMetaMutationHasStructural = false;
                    requestInlineMetaRender(structural);
                };
                if (fireNow) {
                    fireMutation();
                } else {
                    inlineMetaMutationTimer = setTimeout(fireMutation, 80 - elapsed);
                }
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
            if (inlineMetaIsComposing && isInlineMetaEditingBlock(blockEl)) {
                host.classList.remove('is-ready');
                return false;
            }
            // --- FAST PATH: skip expensive geometry reads when content is unchanged ---
            const textSig = getInlineTextFastSignature(textAnchor);
            const prevLayout = inlineMetaLayoutCache.get(taskId);
            const layoutHtml = String(html ?? prevLayout?.html ?? host.innerHTML ?? '');
            if (!forceRefresh && prevLayout && prevLayout.textSig === textSig && prevLayout.html === layoutHtml && !inlineMetaScrolling) {
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
            // --- READ PHASE: batch all geometry reads before any writes ---
            const layer = host.parentElement;
            const layerRect = layer?.getBoundingClientRect?.();
            const blockRect = blockEl.getBoundingClientRect();
            const widthSig = Math.round(Number(blockRect?.width) || 0);
            const plainText = getInlinePlainText(textAnchor);
            const textRect = getInlineTextTailRect(textAnchor);
            const bounds = getInlineViewportBounds(blockEl);
            const editing = isInlineMetaEditingBlock(blockEl);
            if (!layerRect || !blockRect || (!blockRect.width && !blockRect.height) || !plainText || !textRect) {
                if (editing && prevLayout) return true;
                host.classList.remove('is-ready');
                inlineMetaLayoutCache.delete(taskId);
                return false;
            }
            if (!isInlineRectVisibleInBounds(textRect, bounds, visibilityBuffer)) {
                host.classList.remove('is-ready');
                inlineMetaLayoutCache.delete(taskId);
                return false;
            }
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
            const textCollision = rectsOverlap(candidateRect, expandedTextRect, 2);
            const occupiedCollision = inlineMetaOccupiedRects.some((rect) => rectsOverlap(candidateRect, rect, 4));
            if ((textCollision && !editing) || occupiedCollision) {
                if (editing) {
                    inlineMetaOccupiedRects.push(candidateRect);
                    const leftPx = `${finalLeft}px`;
                    const topPx = `${finalTop}px`;
                    const maxWidthPx = `${finalMaxWidth}px`;
                    if (wrapMode) host.classList.add('is-wrap'); else host.classList.remove('is-wrap');
                    host.style.left = leftPx;
                    host.style.top = topPx;
                    host.style.maxWidth = maxWidthPx;
                    host.classList.add('is-ready');
                    inlineMetaLayoutCache.set(taskId, { textSig, widthSig, viewportSig, html: layoutHtml, left: leftPx, top: topPx, maxWidth: maxWidthPx, wrapMode, hostWidth: estHostWidth, hostHeight: estHostHeight });
                    return true;
                }
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
            for (let i = 0; i < entries.length; i++) {
                const e = entries[i];
                if (e.skip) {
                    if (!inlineMetaScrolling) {
                        e.host.classList.remove('is-ready');
                        inlineMetaLayoutCache.delete(e.taskId);
                    }
                    continue;
                }
                const prevLayout = inlineMetaScrolling ? inlineMetaLayoutCache.get(e.taskId) : null;
                const ok = layoutInlineMetaHost(e.blockEl, e.host, e.taskId, e.textAnchor, e.html, false);
                if (!ok && prevLayout) {
                    e.host.classList.toggle('is-wrap', !!prevLayout.wrapMode);
                    e.host.style.left = prevLayout.left;
                    e.host.style.top = prevLayout.top;
                    e.host.style.maxWidth = prevLayout.maxWidth;
                    e.host.classList.add('is-ready');
                }
            }
        }

        async function renderInlineMetaForBlock(blockEl, forceRefresh = false, visibilityBuffer = 0) {
            if (!isInlineMetaEnabled()) return;
            const taskId = String(resolveTaskAttrNodeIdForDetail(blockEl) || blockEl?.dataset?.nodeId || '').trim();
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
                if (host.innerHTML === freshHtml) return;
                host.innerHTML = freshHtml;
                inlineMetaLayoutCache.delete(taskId);
                requestInlineMetaRender(false);
            }).catch(() => null);
        }

        function scheduleInlineMetaRender(forceRefresh = false, immediate = false) {
            const run = () => {
                inlineMetaRenderTimer = null;
                if (!isInlineMetaEnabled()) {
                    removeInlineMetaNodes();
                    return;
                }
                if (!inlineMetaScrolling || inlineMetaNeedSyncBlocks) {
                    syncInlineMetaObserveRoots();
                    syncInlineMetaTaskBlocks(false);
                }
                inlineMetaOccupiedRects = [];
                const dir = inlineMetaScrollDirection;
                const coreUp = dir > 0 ? 320 : (dir < 0 ? 900 : 520);
                const coreDown = dir > 0 ? 900 : (dir < 0 ? 320 : 520);
                const blocks = getInlineDirectionalTaskBlocks(coreUp, coreDown, 320);
                if (inlineMetaScrolling) {
                    const keepUp = dir > 0 ? 1400 : (dir < 0 ? 4200 : 3200);
                    const keepDown = dir > 0 ? 4200 : (dir < 0 ? 1400 : 3200);
                    const keepBlocks = getInlineDirectionalTaskBlocks(keepUp, keepDown, 900);
                    pruneInlineMetaOutsideViewport(keepBlocks);
                    blocks.forEach((blockEl) => {
                        Promise.resolve(renderInlineMetaForBlock(blockEl, false, 420)).catch(() => null);
                    });
                } else {
                    const preUp = dir > 0 ? 900 : (dir < 0 ? 3200 : 2200);
                    const preDown = dir > 0 ? 3200 : (dir < 0 ? 900 : 2200);
                    const keepUp = dir > 0 ? 1400 : (dir < 0 ? 4200 : 3200);
                    const keepDown = dir > 0 ? 4200 : (dir < 0 ? 1400 : 3200);
                    const preRenderBlocks = getInlineDirectionalTaskBlocks(preUp, preDown, 620);
                    const keepBlocks = getInlineDirectionalTaskBlocks(keepUp, keepDown, 900);
                    pruneInlineMetaOutsideViewport(keepBlocks);
                    prefetchInlineMetaProps(preRenderBlocks, 680);
                    const coreSet = new Set(blocks.map((el) => String(el?.dataset?.nodeId || '').trim()).filter(Boolean));
                    preRenderBlocks.forEach((blockEl) => {
                        const blockId = String(blockEl?.dataset?.nodeId || '').trim();
                        const buffer = coreSet.has(blockId) ? 420 : 1800;
                        Promise.resolve(renderInlineMetaForBlock(blockEl, forceRefresh, buffer)).catch(() => null);
                    });
                }
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
                if (!inlineMetaPositionRafId) {
                    inlineMetaPositionRafId = requestAnimationFrame(() => {
                        inlineMetaPositionRafId = 0;
                        try { refreshInlineMetaPositions(); } catch (e2) {}
                    });
                }
                if (e?.type !== 'resize' && (now - inlineMetaLastScrollRenderTs) > 120) {
                    inlineMetaLastScrollRenderTs = now;
                    requestInlineMetaRender(false);
                }
                if (inlineMetaScrollIdleTimer) clearTimeout(inlineMetaScrollIdleTimer);
                inlineMetaScrollIdleTimer = setTimeout(() => {
                    inlineMetaScrollIdleTimer = null;
                    setInlineMetaScrolling(false);
                    requestInlineMetaRender(e?.type === 'resize');
                }, e?.type === 'resize' ? 70 : 150);
            };
            try { document.addEventListener('scroll', inlineMetaScrollHandler, { capture: true, passive: true }); } catch (e) {}
            try { window.addEventListener('resize', inlineMetaScrollHandler, true); } catch (e) {}
            try {
                if (!inlineMetaCompositionStartHandler) {
                    inlineMetaCompositionStartHandler = () => {
                        inlineMetaIsComposing = true;
                        requestInlineMetaRender(false);
                    };
                }
                if (!inlineMetaCompositionEndHandler) {
                    inlineMetaCompositionEndHandler = () => {
                        inlineMetaIsComposing = false;
                        requestInlineMetaRender(false);
                    };
                }
                document.addEventListener('compositionstart', inlineMetaCompositionStartHandler, true);
                document.addEventListener('compositionend', inlineMetaCompositionEndHandler, true);
            } catch (e) {}
            try {
                const eb = globalThis.__taskHorizonPluginInstance?.eventBus || window.siyuan?.eventBus;
                if (eb && typeof eb.on === 'function' && !inlineMetaWsHandler) {
                    inlineMetaWsHandler = (msg) => {
                        const cmd = msg?.detail?.cmd || msg?.cmd;
                        if (cmd !== 'transactions') return;
                        const structuralActions = new Set(['insert', 'delete', 'move', 'append', 'prepend', 'foldHeading', 'unfoldHeading']);
                        let hasStructural = false;
                        try {
                            const data = msg?.detail?.data || msg?.data;
                            const txs = Array.isArray(data) ? data : (data ? [data] : []);
                            for (const tx of txs) {
                                const ops = tx?.doOperations || tx?.operations || [];
                                if (ops.some((op) => structuralActions.has(op?.action))) { hasStructural = true; break; }
                            }
                        } catch (e) {}
                        if (hasStructural) {
                            inlineMetaLayoutCache.clear();
                            inlineMetaNeedSyncBlocks = true;
                            if (inlineMetaWsTimer) clearTimeout(inlineMetaWsTimer);
                            inlineMetaWsTimer = setTimeout(() => {
                                inlineMetaWsTimer = null;
                                requestInlineMetaRender(true);
                            }, 60);
                        }
                    };
                    eb.on('ws-main', inlineMetaWsHandler);
                }
            } catch (e) {}
            requestInlineMetaRender(true);
        }

        function stopInlineMeta() {
            inlineMetaStarted = false;
            clearInlineMetaBootstrapTimers();
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
            try { if (inlineMetaCompositionStartHandler) document.removeEventListener('compositionstart', inlineMetaCompositionStartHandler, true); } catch (e) {}
            try { if (inlineMetaCompositionEndHandler) document.removeEventListener('compositionend', inlineMetaCompositionEndHandler, true); } catch (e) {}
            try {
                const eb = globalThis.__taskHorizonPluginInstance?.eventBus || window.siyuan?.eventBus;
                if (eb && typeof eb.off === 'function' && inlineMetaWsHandler) {
                    eb.off('ws-main', inlineMetaWsHandler);
                }
            } catch (e) {}
            inlineMetaWsHandler = null;
            if (inlineMetaWsTimer) clearTimeout(inlineMetaWsTimer);
            inlineMetaWsTimer = null;
            inlineMetaIsComposing = false;
            setInlineMetaScrolling(false);
            removeInlineMetaNodes();
        }

        function refreshInlineMetaMode(forceRefresh = true) {
            if (forceRefresh) clearInlineMetaScopeDocCache();
            if (isInlineMetaEnabled()) {
                startInlineMeta();
                scheduleInlineMetaBootstrapRenders(!!forceRefresh);
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
            if (shouldSuppressFloatBarForTarget(target, now)) {
                if (floatBar.style.display !== 'none') hideFloatBar();
                return;
            }

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
        let taskAttrUpdatedHandler = null;
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

            taskAttrUpdatedHandler = async (e) => {
                if (!e?.detail || !isReminderRelatedAttrKey(e.detail.attrKey)) return;
                if (!floatBar || floatBar.style.display === 'none') return;
                const incomingTaskId = String(e.detail.taskId || '').trim();
                const incomingAttrHostId = String(e.detail.attrHostId || '').trim();
                const currentIds = new Set([
                    String(currentBlockId || '').trim(),
                    String(currentTaskId || '').trim(),
                    String(resolveCurrentTaskId() || '').trim(),
                ].filter(Boolean));
                if (!currentIds.has(incomingTaskId) && !currentIds.has(incomingAttrHostId)) return;
                if (String(e.detail.attrKey || '').trim() === 'bookmark') {
                    currentProps = normalizeCustomProps({ ...currentProps, bookmark: String(e.detail.value || '') });
                } else if (currentBlockId) {
                    try {
                        currentProps = await getTaskCustomProps(currentBlockId, true);
                    } catch (err) {}
                }
                await refreshCurrentReminderSnapshot(true);
                if (!floatBar || floatBar.style.display === 'none') return;
                renderFloatBar();
                updatePosition();
            };
            window.addEventListener('tm-task-attr-updated', taskAttrUpdatedHandler);
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
            try { if (taskAttrUpdatedHandler) window.removeEventListener('tm-task-attr-updated', taskAttrUpdatedHandler); } catch (e) {}
            taskAttrUpdatedHandler = null;

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
                try { __tmQBStatusRenderStorageHandler?.(e); } catch (err) {}
                if (e.key === 'tm_quickbar_visible_items') {
                    try {
                        if (floatBar && floatBar.style.display !== 'none') renderFloatBar();
                    } catch (err) {}
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
        globalThis.__taskHorizonQuickbarRefresh = () => {
            try {
                if (floatBar && floatBar.style.display !== 'none') {
                    renderFloatBar();
                    updatePosition();
                }
            } catch (e) {}
        };

        globalThis.__taskHorizonQuickbarCleanup = () => {
            quickbarDisposed = true;
            try { stopQuickbar(); } catch (e) {}
            try { stopInlineMeta(); } catch (e) {}
            try { stopTaskIconPatch(); } catch (e) {}
            try { if (__tmQBStatusRenderStorageHandler) window.removeEventListener('storage', __tmQBStatusRenderStorageHandler); } catch (e) {}
            __tmQBStatusRenderStorageHandler = null;
            try { document.removeEventListener('contextmenu', __tmQBOnContextmenuCapture, true); } catch (e) {}
            try { document.removeEventListener('pointerdown', __tmQBOnPointerdownCapture, true); } catch (e) {}
            try { blockMenuObserver?.disconnect?.(); } catch (e) {}
            blockMenuObserver = null;
            try { delete globalThis.__taskHorizonQuickbarToggle; } catch (e) {}
            try { delete globalThis.__taskHorizonQuickbarRefreshInline; } catch (e) {}
            try { delete globalThis.__taskHorizonQuickbarRefresh; } catch (e) {}
            try { delete globalThis.__taskHorizonQuickbarCleanup; } catch (e) {}
            try { delete globalThis.__taskHorizonQuickbarLoaded; } catch (e) {}
        };

        if (isQuickbarEnabled()) startQuickbar();
        else stopQuickbar();
        refreshInlineMetaMode(true);
    }

    // ==================== Task Icon Patch ====================
    // data-task="-" 的任务项，图标应显示为 iconTaskCancelled 而非 iconCheck
    const taskIconMap = {
        '-': 'iconTaskCancelled',
    };
    let taskIconPatchObserver = null;
    let taskIconPatchEbHandlers = [];

    function patchTaskIcons(root) {
        const scope = root || document;
        try {
            scope.querySelectorAll('.li[data-task]').forEach((li) => {
                const targetIcon = taskIconMap[li.getAttribute('data-task')];
                if (!targetIcon) return;
                const use = li.querySelector(':scope > .protyle-action--task use');
                if (use && use.getAttribute('xlink:href') !== '#' + targetIcon) {
                    use.setAttribute('xlink:href', '#' + targetIcon);
                }
            });
        } catch (e) {}
    }

    let _patchTimer = null;
    function schedulePatchTaskIcons(root, delay = 0) {
        clearTimeout(_patchTimer);
        _patchTimer = setTimeout(() => patchTaskIcons(root), delay);
    }

    function startTaskIconPatch() {
        patchTaskIcons(document);
        try {
            taskIconPatchObserver = new MutationObserver((mutations) => {
                let needPatch = false;
                for (const m of mutations) {
                    if (m.type === 'attributes' && m.attributeName === 'data-task') {
                        needPatch = true;
                        break;
                    }
                    if (m.type === 'childList') {
                        const nodes = [...m.addedNodes];
                        if (nodes.some((n) => n.nodeType === Node.ELEMENT_NODE && (n.matches?.('[data-task]') || n.querySelector?.('[data-task]')))) {
                            needPatch = true;
                            break;
                        }
                    }
                }
                if (needPatch) {
                    // 延迟执行，确保在思源完成所有 DOM 操作（如重写 <use> href）之后
                    schedulePatchTaskIcons(document, 0);
                }
            });
            document.querySelectorAll('.protyle-wysiwyg').forEach((root) => {
                taskIconPatchObserver.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-task'] });
            });
        } catch (e) {}
        try {
            const eb = globalThis.__taskHorizonPluginInstance?.eventBus || window.siyuan?.eventBus;
            if (eb && typeof eb.on === 'function') {
                const onStatic = (e) => {
                    const protyle = e?.protyle || e?.detail?.protyle;
                    const root = protyle?.wysiwyg?.element;
                    schedulePatchTaskIcons(root || document, 20);
                };
                const onDynamic = (e) => {
                    const protyle = e?.protyle || e?.detail?.protyle;
                    const root = protyle?.wysiwyg?.element;
                    schedulePatchTaskIcons(root || document, 20);
                };
                const onWsMain = (msg) => {
                    const cmd = msg?.detail?.cmd || msg?.cmd;
                    if (cmd !== 'transactions') return;
                    try {
                        const data = msg?.detail?.data || msg?.data;
                        const txs = Array.isArray(data) ? data : (data ? [data] : []);
                        let hasUpdate = false;
                        for (const tx of txs) {
                            const ops = tx?.doOperations || tx?.operations || [];
                            for (const op of ops) {
                                if (op?.action === 'update') { hasUpdate = true; break; }
                            }
                            if (hasUpdate) break;
                        }
                        if (!hasUpdate) return;
                    } catch (e) {}
                    schedulePatchTaskIcons(document, 60);
                };
                eb.on('loaded-protyle-static', onStatic);
                eb.on('loaded-protyle-dynamic', onDynamic);
                eb.on('ws-main', onWsMain);
                taskIconPatchEbHandlers.push({ eb, event: 'loaded-protyle-static', handler: onStatic });
                taskIconPatchEbHandlers.push({ eb, event: 'loaded-protyle-dynamic', handler: onDynamic });
                taskIconPatchEbHandlers.push({ eb, event: 'ws-main', handler: onWsMain });
            }
        } catch (e) {}
    }

    function stopTaskIconPatch() {
        clearTimeout(_patchTimer);
        _patchTimer = null;
        try { taskIconPatchObserver?.disconnect?.(); } catch (e) {}
        taskIconPatchObserver = null;
        taskIconPatchEbHandlers.forEach(({ eb, event, handler }) => {
            try { eb.off(event, handler); } catch (e) {}
        });
        taskIconPatchEbHandlers = [];
    }

    // 启动 task icon patch
    startTaskIconPatch();

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
