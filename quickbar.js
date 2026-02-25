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
                name: '重要性',
                attrKey: 'custom-priority',
                type: 'select',
                options: [
                    { value: 'high', label: '高', color: '#ea4335' },
                    { value: 'medium', label: '中', color: '#f9ab00' },
                    { value: 'low', label: '低', color: '#4285f4' },
                    { value: 'none', label: '无', color: '#9e9e9e' }
                ],
                defaultValue: 'none'
            },
            {
                name: '状态',
                attrKey: 'custom-status',
                type: 'select',
                // 状态选项会从 SettingsStore 动态读取
                options: [],  // 运行时动态获取
                defaultValue: 'todo'
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

    function getSelectedBlockElementForMenu() {
        const direct = document.querySelector('.protyle-wysiwyg--select, .protyle-content--select');
        const el = direct ||
            document.querySelector('.protyle--focus .protyle-wysiwyg, .protyle--focus .protyle-content')?.querySelector('.protyle-wysiwyg--select, .protyle-content--select') ||
            document.querySelector('.protyle-wysiwyg, .protyle-content')?.querySelector('.protyle-wysiwyg--select, .protyle-content--select');
        if (!el) return null;
        return el.closest?.('.li,[data-type="NodeListItem"],[data-node-id]') || el;
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

    // 块菜单配置
    const menus = [
        {
            name: "📝优先🔝",
            toAvBlockId: "20240509083740-nl2p9lf",
            isBindBlock: true,
            otherCols: [
                {
                    colName: '优先',
                    getColValue: () => true
                }
            ]
        },
        {
            name: "📝高🟥",
            toAvBlockId: "20240509083740-nl2p9lf",
            isBindBlock: true,
            customAttrs: { "custom-st-event": "高" },
            otherCols: [
                {
                    colName: '状态',
                    getColValue: () => ({ mSelect: [{ content: "高" }] })
                }
            ]
        },
        {
            name: "📝中🟧",
            toAvBlockId: "20240509083740-nl2p9lf",
            isBindBlock: true,
            customAttrs: { "custom-st-event": "中" },
            otherCols: [
                {
                    colName: '状态',
                    getColValue: () => ({ mSelect: [{ content: "中" }] })
                }
            ]
        },
        {
            name: "📝低🟦",
            toAvBlockId: "20240509083740-nl2p9lf",
            isBindBlock: true,
            customAttrs: { "custom-st-event": "低" },
            otherCols: [
                {
                    colName: '状态',
                    getColValue: () => ({ mSelect: [{ content: "低" }] })
                }
            ]
        },
        {
            name: "📝备忘🟨",
            toAvBlockId: "20240509083740-nl2p9lf",
            isBindBlock: true,
            customAttrs: { "custom-st-event": "备忘" },
            otherCols: [
                {
                    colName: '状态',
                    getColValue: () => ({ mSelect: [{ content: "备忘" }] })
                }
            ]
        },
        {
            name: "📝待定🟪",
            toAvBlockId: "20240509083740-nl2p9lf",
            isBindBlock: true,
            customAttrs: { "custom-st-event": "待定" },
            otherCols: [
                {
                    colName: '状态',
                    getColValue: () => ({ mSelect: [{ content: "待定" }] })
                }
            ]
        },
        {
            name: "📝推迟🔜",
            toAvBlockId: "20240509083740-nl2p9lf",
            isBindBlock: true,
            customAttrs: { "custom-st-event": "推迟" },
            otherCols: [
                {
                    colName: '状态',
                    getColValue: () => ({ mSelect: [{ content: "推迟" }] })
                }
            ]
        },
        {
            name: "📋work-优先🔝",
            toAvBlockId: "20240405181344-g8fz3qs",
            isBindBlock: true,
            otherCols: [
                {
                    colName: '优先',
                    getColValue: () => true
                }
            ]
        },
        {
            name: "📋work-高🟥",
            toAvBlockId: "20240405181344-g8fz3qs",
            isBindBlock: true,
            customAttrs: { "custom-st-event": "高" },
            otherCols: [
                {
                    colName: '状态',
                    getColValue: () => ({ mSelect: [{ content: "高" }] })
                }
            ]
        },
        {
            name: "📋work-中🟧",
            toAvBlockId: "20240405181344-g8fz3qs",
            isBindBlock: true,
            customAttrs: { "custom-st-event": "中" },
            otherCols: [
                {
                    colName: '状态',
                    getColValue: () => ({ mSelect: [{ content: "中" }] })
                }
            ]
        },
        {
            name: "📋work-低🟦",
            toAvBlockId: "20240405181344-g8fz3qs",
            isBindBlock: true,
            customAttrs: { "custom-st-event": "低" },
            otherCols: [
                {
                    colName: '状态',
                    getColValue: () => ({ mSelect: [{ content: "低" }] })
                }
            ]
        },
        {
            name: "📋work-备忘🟨",
            toAvBlockId: "20240405181344-g8fz3qs",
            isBindBlock: true,
            customAttrs: { "custom-st-event": "备忘" },
            otherCols: [
                {
                    colName: '状态',
                    getColValue: () => ({ mSelect: [{ content: "备忘" }] })
                }
            ]
        },
        {
            name: "📋work-待定🟪",
            toAvBlockId: "20240405181344-g8fz3qs",
            isBindBlock: true,
            customAttrs: { "custom-st-event": "待定" },
            otherCols: [
                {
                    colName: '状态',
                    getColValue: () => ({ mSelect: [{ content: "待定" }] })
                }
            ]
        },
        {
            name: "📋work-推迟🔜",
            toAvBlockId: "20240405181344-g8fz3qs",
            isBindBlock: true,
            customAttrs: { "custom-st-event": "推迟" },
            otherCols: [
                {
                    colName: '状态',
                    getColValue: () => ({ mSelect: [{ content: "推迟" }] })
                }
            ]
        },
        {
            name: "💡添加到卡片库",
            toAvBlockId: "20240310163827-jbdqou9",
            isBindBlock: true
        }
    ];

    // 初始化系统版本
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
                align-items: flex-start;
                gap: 6px;
                padding: 8px;
                border-radius: 8px;
                background: var(--b3-theme-background);
                border: 1px solid var(--b3-border-color);
                box-shadow: var(--b3-dialog-shadow);
            }
            .sy-custom-props-floatbar__row {
                display: flex;
                align-items: center;
                gap: 6px;
                flex-wrap: wrap;
            }
            .sy-custom-props-floatbar__prop {
                display: inline-flex;
                align-items: center;
                height: 26px;
                padding: 0 10px;
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
            .sy-custom-props-floatbar__prop.is-active {
                background: var(--b3-theme-primary);
                border-color: var(--b3-theme-primary);
                color: var(--b3-theme-on-primary);
            }
            .sy-custom-props-floatbar__prop-value {
                margin-left: 4px;
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
                gap: 4px;
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
                background: var(--b3-theme-surface);
            }
            .sy-custom-props-floatbar__option.is-active {
                background: var(--b3-theme-primary);
                color: var(--b3-theme-on-primary);
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

        // 获取优先级的显示文本
        function getPriorityDisplay(value) {
            const priorityMap = {
                'high': '高',
                'medium': '中',
                'low': '低',
                'none': '无'
            };
            return priorityMap[value] || value;
        }

        // 获取优先级的颜色
        function getPriorityColor(value) {
            const colorMap = {
                'high': '#ea4335',
                'medium': '#f9ab00',
                'low': '#4285f4',
                'none': '#9e9e9e'
            };
            return colorMap[value] || '#757575';
        }

        // 获取优先级的背景色（带透明度）
        function getPriorityBgColor(value) {
            const colorMap = {
                'high': 'rgba(234, 67, 53, 0.15)',
                'medium': 'rgba(249, 171, 0, 0.15)',
                'low': 'rgba(66, 133, 244, 0.15)',
                'none': 'rgba(158, 158, 158, 0.12)'
            };
            return colorMap[value] || 'rgba(117, 117, 117, 0.1)';
        }

        // 获取状态选项的显示文本和颜色
        function getStatusDisplay(value) {
            const option = taskStatusOptions.find(o => o.id === value);
            return {
                name: option ? option.name : value,
                color: option ? option.color : '#757575'
            };
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

            // 第一行属性
            const firstRowProps = customPropsConfig.firstRow.map(config => {
                return renderPropElement(config, currentProps[config.attrKey]);
            });
            rows.push(`<div class="sy-custom-props-floatbar__row">${firstRowProps.join('')}</div>`);

            // 第二行属性
            const secondRowProps = customPropsConfig.secondRow.map(config => {
                return renderPropElement(config, currentProps[config.attrKey]);
            });
            const pinnedRaw = String(currentProps['custom-pinned'] || '').trim().toLowerCase();
            const pinned = pinnedRaw === 'true' || pinnedRaw === '1';
            secondRowProps.unshift(`<button class="sy-custom-props-floatbar__action is-wide" data-action="pin" title="置顶">🔝${pinned ? '✅' : '⬜'}</button>`);
            secondRowProps.push(`<button class="sy-custom-props-floatbar__action" data-action="reminder" title="添加提醒">⏰</button>`);
            rows.push(`<div class="sy-custom-props-floatbar__row">${secondRowProps.join('')}</div>`);

            floatBar.innerHTML = rows.join('');

            // 绑定点击事件
            bindPropClickEvents();
        }

        // 渲染单个属性元素
        function renderPropElement(config, value) {
            const escapedName = String(config.name).replace(/"/g, '&quot;');
            const escapedValue = String(value ?? '').replace(/"/g, '&quot;');

            if (config.type === 'select') {
                // 选择类型属性（优先级、状态）
                let displayText, bgColor, color;

                if (config.attrKey === 'custom-priority') {
                    displayText = getPriorityDisplay(value);
                    bgColor = getPriorityBgColor(value);
                    color = getPriorityColor(value);
                } else {
                    const statusInfo = getStatusDisplay(value);
                    displayText = statusInfo.name;
                    bgColor = `${statusInfo.color}20`;  // 带透明度
                    color = statusInfo.color;
                }

                return `
                    <span class="sy-custom-props-floatbar__prop"
                          data-attr="${config.attrKey}"
                          data-type="${config.type}"
                          data-name="${escapedName}"
                          data-value="${escapedValue}"
                          style="background: ${bgColor}; border-color: ${color}; color: ${color};">
                        ${escapedName}: <span class="sy-custom-props-floatbar__prop-value">${displayText}</span>
                    </span>
                `;
            } else if (config.type === 'date') {
                // 日期类型属性
                const displayText = value ? formatDate(value) : '未设置';
                const isEmpty = !value;
                const style = isEmpty ? 'opacity: 0.6;' : '';

                return `
                    <span class="sy-custom-props-floatbar__prop"
                          data-attr="${config.attrKey}"
                          data-type="${config.type}"
                          data-name="${escapedName}"
                          data-value="${escapedValue}"
                          style="${style}">
                        ${escapedName}: <span class="sy-custom-props-floatbar__prop-value">${displayText}</span>
                    </span>
                `;
            } else {
                // 文本类型属性（时长、备注）
                const displayText = value || '未设置';
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
                          style="${style}">
                        ${escapedName}: <span class="sy-custom-props-floatbar__prop-value">${truncatedValue}</span>
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
                    if (action === 'pin') {
                        const raw = String(currentProps['custom-pinned'] || '').trim().toLowerCase();
                        const pinned = raw === 'true' || raw === '1';
                        const next = pinned ? '' : 'true';
                        
                        // 1. 立即更新UI，不等后端返回
                        currentProps['custom-pinned'] = next;
                        renderFloatBar();
                        
                        // 2. 异步更新后端
                        setBlockCustomAttrs(currentBlockId, { 'custom-pinned': next }).then(success => {
                            if (success) {
                                try { globalThis.__taskHorizonOnPinnedChanged?.(currentBlockId, !pinned); } catch (e) {}
                                try { globalThis.__taskHorizonRefresh?.(); } catch (e) {}
                                showMessage(pinned ? '已取消置顶' : '已置顶', false, 1500);
                            } else {
                                // 如果失败，回滚UI
                                console.warn('置顶更新失败，回滚状态');
                                currentProps['custom-pinned'] = raw;
                                renderFloatBar();
                                showMessage('更新置顶失败', true, 1500);
                            }
                        });
                        return;
                    }
                    if (action === 'reminder') {
                        const showDialog = globalThis.__tomatoReminder?.showDialog;
                        if (typeof showDialog === 'function') {
                            const name = getTaskTitleFromBlockEl(currentBlockEl);
                            showDialog(currentBlockId, name || '任务');
                        } else {
                            showMessage('未检测到提醒功能，请确认番茄插件已启用', true, 2000);
                        }
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

            // 更新菜单内容
            selectMenu.innerHTML = options.map(opt => {
                const isActive = opt.value === currentValue ? 'is-active' : '';
                const escapedValue = String(opt.label).replace(/"/g, '&quot;');
                return `
                    <button class="sy-custom-props-floatbar__option ${isActive}"
                            data-value="${opt.value}"
                            data-label="${escapedValue}"
                            style="${config.attrKey === 'custom-priority' ? `color: ${opt.color};` : ''}">
                        ${opt.label}
                    </button>
                `.trim();
            }).join('');

            // 计算位置
            const anchorRect = anchorEl.getBoundingClientRect();
            const maxLen = options.reduce((m, o) => Math.max(m, String(o?.label || '').length), 0);
            const menuWidth = Math.min(200, Math.max(120, maxLen * 14 + 32));

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
                    try { globalThis.__taskHorizonRefresh?.(); } catch (e) {}
                    showMessage(`已更新${config.name}`, false, 1500);
                } else {
                    showMessage('更新失败', true, 2000);
                }

                selectMenu.classList.remove('is-visible');
            };
        }

        // 显示日期编辑器
        function showDateEditor(anchorEl, config, currentValue) {
            const input = inputEditor.querySelector('.sy-custom-props-floatbar__input');
            const oldValue = currentValue ? formatDate(currentValue) : '';
            input.type = 'date';
            input.value = oldValue;

            // 计算位置
            const anchorRect = anchorEl.getBoundingClientRect();
            inputEditor.style.left = `${window.scrollX + anchorRect.left}px`;
            inputEditor.style.top = `${window.scrollY + anchorRect.bottom + 4}px`;
            inputEditor.classList.add('is-visible');

            input.focus();
            try { input.showPicker?.(); } catch (e) {}
            setTimeout(() => {
                try { input.showPicker?.(); } catch (e) {}
            }, 0);
            try {
                if (input.value && typeof input.setSelectionRange === 'function') {
                    input.setSelectionRange(0, 0);
                }
            } catch (e) {}
            input.onclick = () => {
                try { input.showPicker?.(); } catch (e) {}
            };

            // 绑定事件
            const saveDate = async () => {
                const newValue = input.value ? parseDate(input.value) : '';

                const success = await setBlockCustomAttrs(currentBlockId, {
                    [config.attrKey]: newValue
                });

                if (success) {
                    currentProps[config.attrKey] = newValue;
                    renderFloatBar();
                    try { globalThis.__taskHorizonRefresh?.(); } catch (e) {}
                    showMessage(`已更新${config.name}`, false, 1500);
                } else {
                    showMessage('更新失败', true, 2000);
                }

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
                    try { globalThis.__taskHorizonRefresh?.(); } catch (e) {}
                    if (newValue) {
                        showMessage(`已更新${config.name}`, false, 1500);
                    } else {
                        showMessage(`已清除${config.name}`, false, 1500);
                    }
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
            const gap = 8;

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
        let statusIntervalId = null;
        let storageHandler = null;
        let closePopupsHandler = null;

        function startQuickbar() {
            if (quickbarStarted) return;
            quickbarStarted = true;

            initStatusOptionsListener();

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

            try { if (storageHandler) window.removeEventListener('storage', storageHandler); } catch (e) {}
            storageHandler = null;
            try { if (statusIntervalId) clearInterval(statusIntervalId); } catch (e) {}
            statusIntervalId = null;

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

            // 定期检查更新（每2秒）
            statusIntervalId = setInterval(() => {
                loadStatusOptions();
            }, 2000);
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

    // ==================== 原有块菜单逻辑（保留） ====================
    let blockMenuObserver = null;
    if (isEnableBlockContextMenu) {
        whenElementExist('#commonMenu .b3-menu__items').then((menuItems) => {
            if (!menuItems) return;
            blockMenuObserver = observeBlockMenu(menuItems, async (isTitleMenu) => {
                const isTaskContextMenu = !isTitleMenu && (
                    (lastBlockMenuTrigger.isTask && Date.now() - lastBlockMenuTrigger.ts < 1500) ||
                    isTaskBlockElement(getSelectedBlockElementForMenu())
                );

                if (isEnableTaskBlockFloatBar && isTaskContextMenu) return;
                if (menuItems.querySelector('.add-to-my-av')) return;
                const addAv = menuItems.querySelector('button[data-id="addToDatabase"]');
                if (!addAv) return;

                let blockMenus = menus.filter(m => m && m.showInBlockMenu !== false);
                if (!isTaskContextMenu) {
                    blockMenus = blockMenus.filter(m => typeof m?.name === 'string' && !m.name.startsWith('📝') && !m.name.startsWith('📋'));
                }
                if (blockMenus.length === 0) return;

                const menusReverse = [...blockMenus].reverse();
                const menuCount = menusReverse.length;

                menusReverse.forEach((menu, index) => {
                    const menuText = menu.name + (menu.isBindBlock ? '' : '（不绑定块）');
                    const menuIcon = '#iconDatabase';
                    const menuClass = `add-to-my-av-${menu.toAvBlockId}-${menuCount - index - 1}`;

                    if (!menuItems.querySelector(`.${menuClass}`)) {
                        const menuButtonHtml = `<button class="b3-menu__item ${menuClass}"><svg class="b3-menu__icon"><use xlink:href="${menuIcon}"></use></svg><span class="b3-menu__label">${menuText}</span></button>`;
                        addAv.insertAdjacentHTML('afterend', menuButtonHtml);
                        const menuBtn = menuItems.querySelector(`.${menuClass}`);

                        menuBtn.onclick = async () => {
                            window.siyuan.menus.menu.remove();
                            await menuItemClick(menu.toAvBlockId, menu.toAvColName, menu.isBindBlock, menu.otherCols, menu.customAttrs, isTitleMenu);
                        };
                    }
                });
            });
        });
    }

    // 菜单点击事件
    async function menuItemClick(toAvBlockId, toAvColName, isBindBlock, otherCols, customAttrs, isTitleMenu, blocksOverride) {
        await initSystemVersion();

        const avId = await getAvIdByAvBlockId(toAvBlockId);
        if (!avId) {
            showMessage('未找到块ID' + toAvBlockId + '所在的数据库，请检查数据库块ID配置是否正确', true);
            return;
        }

        let blocks = [];
        const protyle = document.querySelector('[data-type="wnd"].layout__wnd--active .protyle:not(.fn__none)') || document.querySelector('[data-type="wnd"] .protyle:not(.fn__none)');

        if (Array.isArray(blocksOverride) && blocksOverride.length > 0) {
            blocks = blocksOverride;
        } else if (isTitleMenu) {
            const docTitleEl = (protyle || document)?.querySelector('.protyle-title');
            const docId = docTitleEl?.dataset?.nodeId;
            const docTitle = docTitleEl?.querySelector('.protyle-title__input')?.textContent;
            blocks = [{
                dataset: { nodeId: docId },
                textContent: docTitle
            }];
        } else {
            blocks = (protyle || document)?.querySelectorAll('.protyle-wysiwyg--select');
            blocks = [...blocks].map(block => block.matches('.list') ? block.firstElementChild : block);
        }

        if (blocks.length === 0) {
            showMessage('未选中任何块', true);
            return;
        }

        const blockIds = blocks.map(block => block.dataset.nodeId);

        // 批量检查块是否在数据库中
        const existingBlocks = await checkBlocksInDatabase(blockIds, avId);
        const newBlocks = blocks.filter(block => !existingBlocks.includes(block.dataset.nodeId));
        const newBlockIds = newBlocks.map(block => block.dataset.nodeId);

        await showMessage(`开始处理 ${blockIds.length} 个块...`, false, 2000);

        const finalOtherCols = ensureCompletedCheckboxCol(otherCols);

        if (isBindBlock) {
            await processBindBlocks(newBlockIds, blockIds, avId, toAvBlockId, finalOtherCols, customAttrs);
        } else {
            await processNonBindBlocks(newBlocks, avId, toAvColName, finalOtherCols, customAttrs, blockIds);
        }
    }

    function ensureCompletedCheckboxCol(otherCols) {
        if (!isEnableCompletedCheckboxCol) return otherCols;
        const colName = (completedCheckboxColName || '').trim();
        if (!colName) return otherCols;

        const cols = Array.isArray(otherCols) ? [...otherCols] : [];
        const exists = cols.some(col => (col?.colName || '').trim() === colName);
        if (!exists) {
            cols.push({
                colName,
                getColValue: () => completedCheckboxCheckedValue
            });
        }
        return cols;
    }

    // 处理绑定块
    async function processBindBlocks(newBlockIds, allBlockIds, avId, avBlockId, otherCols, customAttrs) {
        const startTime = Date.now();

        try {
            const [addResult, colResult, attrResult] = await Promise.all([
                newBlockIds.length > 0 ? addBlocksToAv(newBlockIds, avId, avBlockId) : Promise.resolve(0),
                (isEnableMoreCols && otherCols && otherCols.length > 0) ?
                    addColsToAvOptimized(allBlockIds, otherCols, avId) : Promise.resolve(0),
                isEnableCustomAttrsInSelectedBlock ?
                    setBlocksAttrsBatch(allBlockIds, customAttrs) : Promise.resolve(0)
            ]);

            const endTime = Date.now();
            const duration = (endTime - startTime) / 1000;

            let finalMessage = `处理完成 (${duration.toFixed(1)}秒): `;
            const parts = [];

            if (addResult > 0) parts.push(`${addResult}个块`);
            if (colResult > 0) parts.push(`${colResult}个状态列`);

            if (parts.length === 0) {
                finalMessage = '所有选中块已在数据库中';
            } else {
                finalMessage += parts.join(', ');
            }

            await showMessage(finalMessage, false, 4000);

        } catch (error) {
            console.error('处理绑定块时出错:', error);
            await showMessage('处理过程中出现错误，请查看控制台', true);
        }
    }

    // 处理非绑定块
    async function processNonBindBlocks(newBlocks, avId, toAvColName, otherCols, customAttrs, allBlockIds) {
        const startTime = Date.now();

        try {
            const [addResult, attrResult] = await Promise.all([
                newBlocks.length > 0 ? addBlocksToAvNoBind(newBlocks, avId, toAvColName, otherCols) : Promise.resolve(0),
                isEnableCustomAttrsInSelectedBlock ? setBlocksAttrsBatch(allBlockIds, customAttrs) : Promise.resolve(0)
            ]);

            const endTime = Date.now();
            const duration = (endTime - startTime) / 1000;

            let finalMessage = `非绑定块处理完成 (${duration.toFixed(1)}秒)`;
            if (addResult > 0) {
                finalMessage += `: 添加${addResult}个块`;
            }

            await showMessage(finalMessage, false, 3000);
        } catch (error) {
            console.error('处理非绑定块时出错:', error);
            await showMessage('处理过程中出现错误', true);
        }
    }

    // 批量检查块是否在数据库中
    async function checkBlocksInDatabase(blockIds, avId) {
        const attrsPromises = blockIds.map(blockId => getBlockAttrs(blockId));
        const attrsResults = await Promise.all(attrsPromises);

        const existingBlocks = [];
        attrsResults.forEach((attrs, index) => {
            if (attrs && attrs['custom-avs'] && attrs['custom-avs'].includes(avId)) {
                existingBlocks.push(blockIds[index]);
            }
        });

        return existingBlocks;
    }

    async function getBlockAttrs(blockId) {
        try {
            const result = await requestApi('/api/attr/getBlockAttrs', { id: blockId });
            return result?.code === 0 ? result.data : {};
        } catch (error) {
            console.error('获取块属性失败:', error);
            return {};
        }
    }

    async function getAvIdByAvBlockId(blockId) {
        if (avCache.has(blockId)) {
            return avCache.get(blockId);
        }

        const av = await getAvBySql(`SELECT * FROM blocks WHERE type ='av' AND id='${blockId}'`);
        if (av.length === 0) {
            avCache.set(blockId, '');
            return '';
        }

        const avId = getDataAvIdFromHtml(av[0].markdown);
        avCache.set(blockId, avId);
        return avId;
    }

    function getDataAvIdFromHtml(htmlString) {
        const match = htmlString.match(/data-av-id="([^"]+)"/);
        return match && match[1] ? match[1] : "";
    }

    async function getAvBySql(sql) {
        try {
            const result = await requestApi('/api/query/sql', { "stmt": sql });
            return result?.code === 0 ? result.data : [];
        } catch (error) {
            console.error('SQL查询失败:', error);
            return [];
        }
    }

    function getRowIdByBlockId(blockId) {
        if (compareVersions(systemVersion, '3.3.0') < 0) return blockId;

        const dashIndex = blockId.indexOf('-');
        if (dashIndex === -1) return blockId;

        const prefix = blockId.slice(0, dashIndex + 1);
        const suffix = blockId.slice(dashIndex + 1);
        const reversedSuffix = suffix.split('').reverse().join('');

        return prefix + reversedSuffix;
    }

    async function addBlocksToAv(blockIds, avId, avBlockID) {
        if (!blockIds.length) return 0;

        const srcs = blockIds.map(blockId => ({
            "id": blockId,
            "itemID": getRowIdByBlockId(blockId),
            "isDetached": false
        }));

        const input = {
            "avID": avId,
            "blockID": avBlockID,
            'srcs': srcs
        };

        try {
            const result = await requestApi('/api/av/addAttributeViewBlocks', input);
            if (result?.code === 0) {
                await Promise.all(blockIds.map(blockId => setBlockAvsAttr(blockId, avId)));
                return blockIds.length;
            } else {
                console.error('添加块到数据库失败:', result);
                return 0;
            }
        } catch (error) {
            console.error('添加块到数据库异常:', error);
            return 0;
        }
    }

    async function setBlockAvsAttr(blockId, avId) {
        const attrs = await getBlockAttrs(blockId);
        let avsValue = attrs['custom-avs'] || '';

        if (avsValue) {
            const avsList = avsValue.split(',');
            if (!avsList.includes(avId)) {
                avsValue += ',' + avId;
            }
        } else {
            avsValue = avId;
        }

        await setBlockAttrs(blockId, { 'custom-avs': avsValue });
    }

    async function setBlockAttrs(blockId, attrs) {
        if (!blockId) return false;

        try {
            const result = await requestApi('/api/attr/setBlockAttrs', {
                "id": blockId,
                "attrs": attrs
            });
            return result?.code === 0;
        } catch (error) {
            console.error(`设置块 ${blockId} 属性失败:`, error);
            return false;
        }
    }

    function isCheckboxKeyType(keyType) {
        if (!keyType) return false;
        const t = String(keyType).toLowerCase();
        return t === 'checkbox' || t.includes('checkbox');
    }

    function normalizeCheckboxValue(raw) {
        if (typeof raw === 'boolean') return { checkbox: { checked: raw } };

        if (typeof raw === 'string') {
            const v = raw.trim().toLowerCase();
            if (['checked', 'true', '1', 'yes', 'y', 'on'].includes(v)) return { checkbox: { checked: true } };
            if (['unchecked', 'false', '0', 'no', 'n', 'off', ''].includes(v)) return { checkbox: { checked: false } };
        }

        if (raw && typeof raw === 'object') {
            if (raw.checkbox && typeof raw.checkbox === 'object') return raw;
            if (Object.prototype.hasOwnProperty.call(raw, 'checked')) return { checkbox: { checked: !!raw.checked } };
            if (Object.prototype.hasOwnProperty.call(raw, 'content')) return { checkbox: { checked: !!raw.content } };
        }

        return null;
    }

    function normalizeAvValue(raw, keyType) {
        if (raw && typeof raw === 'object') return raw;
        if (isCheckboxKeyType(keyType)) return normalizeCheckboxValue(raw);
        return null;
    }

    function buildValueCandidatesForKeyType(value, keyType) {
        if (!value || typeof value !== 'object') return [value];
        const t = String(keyType || '').toLowerCase();

        if (isCheckboxKeyType(keyType)) {
            const checked = value.checkbox && typeof value.checkbox === 'object'
                ? (Object.prototype.hasOwnProperty.call(value.checkbox, 'checked')
                    ? !!value.checkbox.checked
                    : Object.prototype.hasOwnProperty.call(value.checkbox, 'content')
                        ? !!value.checkbox.content
                        : !!value.checkbox)
                : !!value.checked;

            return [
                { checkbox: { checked } },
                { checkbox: { checked, isNotEmpty: true } },
                { checkbox: { content: checked } },
                { checkbox: { content: checked, isNotEmpty: true } },
            ];
        }

        if (t.includes('date') && value.date && typeof value.date === 'object' && Object.prototype.hasOwnProperty.call(value.date, 'content')) {
            const c = value.date.content;
            return [
                value,
                { date: { content: c, isNotEmpty: true } },
                typeof c === 'number' ? { date: { content: String(c) } } : null,
                typeof c === 'number' ? { date: { content: String(c), isNotEmpty: true } } : null,
            ].filter(Boolean);
        }

        if (t.includes('number') && value.number && typeof value.number === 'object' && Object.prototype.hasOwnProperty.call(value.number, 'content')) {
            const c = value.number.content;
            return [
                value,
                { number: { content: c, isNotEmpty: true } },
            ];
        }

        if ((t.includes('text') || t.includes('string')) && value.text && typeof value.text === 'object' && Object.prototype.hasOwnProperty.call(value.text, 'content')) {
            const c = value.text.content;
            return [
                value,
                { text: { content: c, isNotEmpty: true } },
            ];
        }

        if ((t.includes('select') || t.includes('mselect') || t.includes('multi')) && Object.prototype.hasOwnProperty.call(value, 'mSelect')) {
            const ms = value.mSelect;
            const contents = Array.isArray(ms) ? ms.map(x => x?.content).filter(Boolean) : [];
            return [
                value,
                { mSelect: ms, isNotEmpty: true },
                contents.length > 0 ? { mSelect: { contents } } : null,
                contents.length > 0 ? { mSelect: { contents, isNotEmpty: true } } : null,
            ].filter(Boolean);
        }

        return [value];
    }

    async function setAttributeViewBlockAttrWithFallback({ avID, keyID, rowID, cellID, value, keyType }) {
        const candidates = buildValueCandidatesForKeyType(value, keyType);
        for (const candidate of candidates) {
            const result = await requestApi("/api/av/setAttributeViewBlockAttr", {
                avID,
                keyID,
                rowID,
                cellID,
                value: candidate
            });
            if (result?.code === 0) return true;
        }
        return false;
    }

    async function addColsToAvOptimized(blockIds, cols, avID) {
        if (!blockIds.length || !cols.length) return 0;

        let keys;
        if (keysCache.has(avID)) {
            keys = keysCache.get(avID);
        } else {
            const keysResult = await requestApi("/api/av/getAttributeViewKeysByAvID", { avID });
            keys = keysResult?.data || [];
            keysCache.set(avID, keys);
        }

        if (!keys.length) return 0;

        const processedCols = [];
        for (const col of cols) {
            if (!col.colName) continue;
            const keyInfo = keys.find(item => item.name === col.colName.trim());
            if (keyInfo) {
                processedCols.push({
                    ...col,
                    keyID: keyInfo.id,
                    keyType: keyInfo.type
                });
            }
        }

        if (processedCols.length === 0) return 0;

        const processPromises = blockIds.map(blockId =>
            processBlockColumns(blockId, processedCols, avID)
        );

        const results = await Promise.all(processPromises);
        return results.reduce((sum, count) => sum + count, 0);
    }

    async function processBlockColumns(blockId, cols, avID) {
        const rowID = getRowIdByBlockId(blockId);
        let processedCount = 0;

        const colPromises = cols.map(async col => {
            if (!col.keyID || typeof col.getColValue !== 'function') return 0;

            try {
                const cellID = await getCellId(blockId, col.keyID, avID);
                if (!cellID) {
                    console.warn(`未找到块 ${blockId} 的cellID，跳过`);
                    return 0;
                }

                const rawColValue = col.getColValue(col.keyID, blockId, rowID, cellID, avID);
                const colValue = normalizeAvValue(rawColValue, col.keyType);
                if (!colValue) return 0;

                const ok = await setAttributeViewBlockAttrWithFallback({
                    avID,
                    keyID: col.keyID,
                    rowID,
                    cellID,
                    value: colValue,
                    keyType: col.keyType
                });
                return ok ? 1 : 0;
            } catch (error) {
                console.error(`处理块 ${blockId} 的列失败:`, error);
                return 0;
            }
        });

        const results = await Promise.all(colPromises);
        return results.reduce((sum, count) => sum + count, 0);
    }

    async function getCellId(blockId, keyID, avID) {
        try {
            const res = await requestApi("/api/av/getAttributeViewKeys", { id: blockId });
            if (!res?.data) return null;

            const foundItem = res.data.find(item => item.avID === avID);
            if (!foundItem || !foundItem.keyValues) return null;

            const specificKey = foundItem.keyValues.find(kv => kv.key.id === keyID);
            if (!specificKey || !specificKey.values || specificKey.values.length === 0) return null;

            return specificKey.values[0].id;
        } catch (error) {
            console.error('获取cellID失败:', error);
            return null;
        }
    }

    async function addBlocksToAvNoBind(blocks, avId, toAvColName, otherCols) {
        if (!blocks.length) return 0;

        let keys;
        if (keysCache.has(avId)) {
            keys = keysCache.get(avId);
        } else {
            const keysResult = await requestApi("/api/av/getAttributeViewKeysByAvID", { avID: avId });
            keys = keysResult?.data || [];
            keysCache.set(avId, keys);
        }

        if (!keys.length) return 0;

        let pkKeyID = keys[0]?.id || '';
        if (!pkKeyID) {
            pkKeyID = keys.find(item => item.type === 'block')?.id;
        }

        let keyID = '';
        if (toAvColName) {
            keyID = keys.find(item => item.name === toAvColName.trim())?.id;
        }

        if (isEnableMoreCols && otherCols) {
            otherCols.forEach(col => {
                if (!col.colName) return;
                const foundKey = keys.find(item => item.name === col.colName.trim());
                if (foundKey) {
                    col.keyID = foundKey.id;
                    col.keyType = foundKey.type;
                }
            });
        }

        const values = blocks.map(block => {
            const rowValues = [{
                "keyID": pkKeyID,
                "block": { "content": keyID ? "" : block.textContent }
            }];

            if (keyID) {
                rowValues.push({
                    "keyID": keyID,
                    "text": { "content": block.textContent }
                });
            }

            if (isEnableMoreCols && otherCols) {
                for (const col of otherCols) {
                    if (!col.keyID || typeof col.getColValue !== 'function') continue;

                    try {
                        const rawColValue = col.getColValue(col.keyID);
                        const colValue = normalizeAvValue(rawColValue, col.keyType);
                        if (colValue) rowValues.push({ ...colValue, keyID: col.keyID });
                    } catch (error) {
                        console.error('处理列值失败:', error);
                    }
                }
            }

            return rowValues;
        });

        const input = { "avID": avId, "blocksValues": values };

        try {
            const result = await requestApi('/api/av/appendAttributeViewDetachedBlocksWithValues', input);
            if (result?.code === 0) {
                const blockIds = blocks.map(block => block.dataset.nodeId);
                await Promise.all(blockIds.map(blockId => setBlockAvsAttr(blockId, avId)));
                return blocks.length;
            }
        } catch (error) {
            console.error('添加非绑定块失败:', error);
        }

        return 0;
    }

    async function setBlocksAttrsBatch(blockIds, attrs) {
        if (!attrs || typeof attrs !== 'object' || !blockIds.length) return 0;

        const promises = blockIds.map(blockId => setBlockAttrs(blockId, attrs));
        const results = await Promise.all(promises);
        return results.filter(result => result).length;
    }

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

    function observeBlockMenu(selector, callback) {
        let hasFlag1 = false;
        let hasFlag2 = false;
        let isTitleMenu = false;

        const observer = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach((node) => {
                        if ((hasFlag1 && hasFlag2) || isTitleMenu) return;

                        if (node.nodeType === 1) {
                            const cutLabel = node.querySelector('.b3-menu__label')?.textContent?.trim();
                            if (cutLabel === window.siyuan.languages.cut) hasFlag1 = true;
                            if (cutLabel === window.siyuan.languages.move) hasFlag2 = true;
                            if (node.closest('[data-name="titleMenu"]')) isTitleMenu = true;
                        }

                        if ((hasFlag1 && hasFlag2) || isTitleMenu) {
                            callback(isTitleMenu);
                            setTimeout(() => {
                                hasFlag1 = false;
                                hasFlag2 = false;
                                isFlag3 = false;
                            }, 200);
                        }
                    });
                }
            }
        });

        observer.observe(selector || document.body, {
            childList: true,
            subtree: false
        });

        return observer;
    }

    function whenElementExist(selector, node) {
        return new Promise(resolve => {
            const check = () => {
                if (quickbarDisposed) return;
                const el = typeof selector === 'function' ? selector() : (node || document).querySelector(selector);
                el ? resolve(el) : requestAnimationFrame(check);
            };
            check();
        });
    }

    function showMessage(message, isError = false, delay = 7000) {
        return fetch('/api/notification/' + (isError ? 'pushErrMsg' : 'pushMsg'), {
            method: "POST",
            body: JSON.stringify({ "msg": message, "timeout": delay })
        });
    }

    function compareVersions(version1, version2) {
        const v1 = version1.split('.');
        const v2 = version2.split('.');
        const len = Math.max(v1.length, v2.length);

        for (let i = 0; i < len; i++) {
            const num1 = i < v1.length ? parseInt(v1[i], 10) : 0;
            const num2 = i < v2.length ? parseInt(v2[i], 10) : 0;
            if (num1 > num2) return 1;
            if (num1 < num2) return -1;
        }
        return 0;
    }
})();
