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

    // ==================== 辅助函数 ====================
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
            if (e.key !== 'tm_custom_status_options') return;
            loadStatusOptions().then(() => {
                try { renderFloatBar(); } catch (e) {}
            });
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

        // 获取或更新当前块的所有自定义属性
        async function refreshBlockAttrs() {
            if (!currentBlockId) return;
            const attrs = await getBlockCustomAttrs(currentBlockId);

            // 解析并存储属性值
            currentProps = {
                'custom-priority': attrs['custom-priority'] || 'none',
                'custom-status': attrs['custom-status'] || 'todo',
                'custom-completion-time': attrs['custom-completion-time'] || '',
                'custom-duration': attrs['custom-duration'] || '',
                'custom-remark': attrs['custom-remark'] || '',
                'custom-pinned': attrs['custom-pinned'] || ''
            };
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

        // 触发器处理
        let lastTriggerTime = 0;

        function handleTrigger(e) {
            const now = Date.now();
            if (now - lastTriggerTime < 80) return;  // 防抖
            lastTriggerTime = now;

            const target = e.target;

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
            };
            document.addEventListener('selectionchange', selectionChangeHandler, { passive: true });
            
            // mouseup 事件 - 当用户释放鼠标时检测（选择文字后）
            let mouseUpHandler = null;
            mouseUpHandler = (e) => {
                // 延迟一点执行，确保 selection 已经更新
                setTimeout(checkAndHideForTextSelection, 10);
            };
            document.addEventListener('mouseup', mouseUpHandler, true);
            // ========== 新增结束 ==========

            document.addEventListener('pointerup', handleTrigger, true);
            document.addEventListener('click', handleTrigger, true);
            document.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition, true);

            closePopupsHandler = (e) => {
                if (floatBar.style.display === 'none') return;
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
            // ========== 新增结束 ==========

            try { if (storageHandler) window.removeEventListener('storage', storageHandler); } catch (e) {}
            storageHandler = null;

            hideFloatBar();
            try { document.querySelectorAll('.sy-custom-props-floatbar, .sy-custom-props-floatbar__select, .sy-custom-props-floatbar__input-editor').forEach(el => el.remove()); } catch (e) {}
            try { document.getElementById('sy-custom-props-floatbar-style')?.remove?.(); } catch (e) {}
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
                        }
                    } catch (err) {
                        console.warn('解析状态选项失败:', err);
                    }
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

        globalThis.__taskHorizonQuickbarCleanup = () => {
            quickbarDisposed = true;
            try { stopQuickbar(); } catch (e) {}
            try { if (__tmQBStatusRenderStorageHandler) window.removeEventListener('storage', __tmQBStatusRenderStorageHandler); } catch (e) {}
            __tmQBStatusRenderStorageHandler = null;
            try { document.removeEventListener('contextmenu', __tmQBOnContextmenuCapture, true); } catch (e) {}
            try { document.removeEventListener('pointerdown', __tmQBOnPointerdownCapture, true); } catch (e) {}
            try { blockMenuObserver?.disconnect?.(); } catch (e) {}
            blockMenuObserver = null;
            try { delete globalThis.__taskHorizonQuickbarToggle; } catch (e) {}
            try { delete globalThis.__taskHorizonQuickbarCleanup; } catch (e) {}
            try { delete globalThis.__taskHorizonQuickbarLoaded; } catch (e) {}
        };

        if (isQuickbarEnabled()) startQuickbar();
        else stopQuickbar();
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
