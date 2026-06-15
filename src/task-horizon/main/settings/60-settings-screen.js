    const TM_SETTINGS_SEARCH_MAX_RESULTS = 12;
    const TM_SETTINGS_SEARCH_TAB_LABELS = Object.freeze({
        docs: '文档分组',
        main: '常规设置',
        appearance: '外观',
        calendar: '日历',
        ai: 'AI',
        rules: '规则管理',
        quadrant: '四象限',
        priority: '优先级算法',
        about: '关于'
    });
    const TM_SETTINGS_SEARCH_MAIN_GROUPS = Object.freeze([
        { section: 'display', titles: ['基础显示', '字体大小', '移动端字体', '行高模式', '行高(px)', '父任务名称加粗', '自动换行', '内容行数', '备注行数', '任务标题级别', '完成反馈', '文档名称显示'] },
        { section: 'new-task', titles: ['新建任务', '新建任务位置', '默认新建文档', '今天日记默认笔记本', '启用“移动内容至今天日记”', '日记追加到底部', '标题分组追加到内容末尾', '新建任务默认置顶', '子任务继承父任务字段'] },
        { section: 'status', titles: ['状态选项', '勾选完成时状态', '未完成状态默认状态'] },
        { section: 'layout', titles: ['视图布局', '默认视图', '移动端默认', '自动隐藏页签栏', '页签拖延值上色', '启用 Dock 侧边栏', 'Dock 默认视图', 'Dock 紧凑标题点击跳转', '移动端清单紧凑视图标题点击跳转', 'Dock 及移动端紧凑右侧字段', '桌面端紧凑右侧字段', '紧凑右侧字体', '时间轴卡片字段', '标题点击弹出详情页面', '看板紧凑模式', '清单紧凑模式', '清单紧凑层级线', '看板宽度', '表格和看板宽度填满窗口', '看板卡片字段', '白板卡片字段', '卡片字段常驻显示', '卡片流最小宽度', '移动端卡片流双栏', '显示已完成任务看板', '看板拖动父任务时同步更改子任务状态', '看板内子任务不与父任务分离', '时长显示格式', '实际番茄数属性名', '预计番茄数属性名'] },
        { section: 'search', titles: ['搜索分组', '搜索与分组', '递归文档数上限', '兼容旧版 Win7 思源', '父任务回溯层数', '显示已完成任务', '已完成分组仅显示今天完成', '已完成任务不单独分组', '文档分组下按二级标题子分组', '分组模式增加“按任务名分组”', '分组内置顶任务', '自动识别语义日期（全量分批）', '父任务按子任务时间参与时间相关排序', '全部折叠展开包含分组', '手动刷新时同步伺服共享设置', '手动刷新时同步当前分组/规则等会话状态'] },
        { section: 'topbar', titles: ['顶栏入口', '文档顶栏按钮(桌面)', '文档顶栏按钮(移动)', '对调文档顶栏长短按', '打开时定位当前文档', '思源窗口顶栏图标(桌面)', '思源窗口顶栏图标(移动)'] },
        { section: 'quickbar', titles: ['悬浮条', '任务悬浮条', '启用任务悬浮条', '文档任务行末尾常驻显示', '悬浮条显示图标', '常驻显示字段', '子任务数量显示未完成数', '移动端启用常驻显示'] },
        { section: 'tomato', titles: ['番茄钟/联动', '番茄钟与插件联动', '启用底栏番茄钟相关功能', '耗时读取模式', '分钟属性名', '小时属性名', '启用凡人修仙传:打卡插件联动', '不联动的文档分组', '启用任务逾期扣分', '截止日过期扣分', '日程过期扣分', '检查时间', '弹窗确认扣分'] }
    ]);
    const TM_SETTINGS_SEARCH_PAGE_ITEMS = Object.freeze([
        { tab: 'docs', title: '文档分组与管理', desc: '按笔记本分组、自定义分组、当前分组内文档、排除文档' },
        { tab: 'docs', title: '数据导入', desc: '导入滴答 CSV，自动创建文档、二级标题和任务块' },
        { tab: 'docs', title: '当前分组内文档', desc: '查看、添加、清空或移除当前分组文档' },
        { tab: 'docs', title: '排除文档', desc: '恢复或管理被排除的文档' },
        { tab: 'appearance', title: '列设置', desc: '显示、排序、宽度和自定义列' },
        { tab: 'appearance', section: 'columns', key: 'appearance-task-meta-attr-migration', title: '高级：内置字段属性名与迁移', desc: '自定义开始日期、截止日期、重要性、状态、完成时间等内置字段属性名，并可选择迁移旧任务字段' },
        { tab: 'appearance', title: '页签栏', desc: '归档入口位置' },
        { tab: 'appearance', title: '配色', desc: '调整主题、看板、时间轴和顶栏颜色' },
        { tab: 'calendar', title: '日历', desc: '日历视图与日程相关设置' },
        { tab: 'ai', title: 'AI 接入', desc: '供应商、API Key、Base URL、模型、温度、超时和上下文模式' },
        { tab: 'ai', title: '供应商', desc: 'MiniMax、DeepSeek、OpenAI 兼容和 Anthropic 兼容' },
        { tab: 'ai', title: 'API Key', desc: 'AI 服务密钥' },
        { tab: 'ai', title: 'Base URL', desc: 'AI 服务地址' },
        { tab: 'ai', title: '模型', desc: 'AI 模型名称' },
        { tab: 'ai', title: '默认上下文模式', desc: '附近块或全文上下文' },
        { tab: 'rules', title: '规则管理', desc: '筛选规则、排序规则和优先级算法入口' },
        { tab: 'rules', title: '筛选规则管理', desc: '新建、编辑、应用和删除筛选规则' },
        { tab: 'rules', title: '时间轴强制按截止日期排序', desc: '时间轴规则排序行为' },
        { tab: 'quadrant', title: '四象限', desc: '按重要性和截止日期自动分配象限' },
        { tab: 'quadrant', title: '四象限分组规则', desc: '配置四象限规则' },
        { tab: 'priority', title: '优先级算法', desc: '配置任务优先级评分权重和规则' },
        { tab: 'about', title: '关于', desc: '版本、设备识别和诊断信息' },
        { tab: 'about', title: '复制诊断', desc: '复制设备识别诊断报告' }
    ]);

    function __tmNormalizeSettingsSearchTab(tab) {
        const v = String(tab || '').trim();
        return Object.prototype.hasOwnProperty.call(TM_SETTINGS_SEARCH_TAB_LABELS, v) ? v : 'docs';
    }

    function __tmPlainSettingsSearchText(value) {
        return String(value || '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function __tmNormalizeSettingsSearchText(value) {
        try {
            return __tmPlainSettingsSearchText(value).normalize('NFKC').toLowerCase();
        } catch (e) {
            return __tmPlainSettingsSearchText(value).toLowerCase();
        }
    }

    function __tmGetSettingsSearchSectionLabel(sectionId) {
        const sid = String(sectionId || '').trim();
        if (!sid) return '';
        try {
            const section = (Array.isArray(TM_MAIN_SETTINGS_SECTIONS) ? TM_MAIN_SETTINGS_SECTIONS : [])
                .find((item) => String(item?.id || '').trim() === sid);
            return String(section?.label || '').trim();
        } catch (e) {
            return '';
        }
    }

    function __tmBuildSettingsSearchKey(tab, title, section = '') {
        const raw = `${__tmNormalizeSettingsSearchTab(tab)}|${String(section || '').trim()}|${__tmPlainSettingsSearchText(title)}`;
        try {
            return encodeURIComponent(raw);
        } catch (e) {
            return raw.replace(/["'<>\\\s]+/g, '_');
        }
    }

    function __tmSettingsSearchAttrs(tab, title, desc = '', opt = {}) {
        const normalizedTab = __tmNormalizeSettingsSearchTab(tab);
        const titleText = __tmPlainSettingsSearchText(title);
        if (!titleText) return '';
        const descText = __tmPlainSettingsSearchText(desc);
        const section = String(opt?.section || '').trim();
        const key = String(opt?.key || __tmBuildSettingsSearchKey(normalizedTab, titleText, section)).trim();
        return [
            `data-tm-settings-search-key="${esc(key)}"`,
            `data-tm-settings-search-tab="${esc(normalizedTab)}"`,
            section ? `data-tm-settings-search-section="${esc(section)}"` : '',
            `data-tm-settings-search-title="${esc(titleText)}"`,
            descText ? `data-tm-settings-search-desc="${esc(descText)}"` : ''
        ].filter(Boolean).join(' ');
    }

    function __tmCreateSettingsSearchEntry(raw = {}) {
        const tab = __tmNormalizeSettingsSearchTab(raw.tab);
        const title = __tmPlainSettingsSearchText(raw.title);
        if (!title) return null;
        const section = String(raw.section || '').trim();
        const desc = __tmPlainSettingsSearchText(raw.desc);
        const key = String(raw.key || __tmBuildSettingsSearchKey(tab, title, section)).trim();
        const tabLabel = TM_SETTINGS_SEARCH_TAB_LABELS[tab] || tab;
        const sectionLabel = tab === 'main' ? __tmGetSettingsSearchSectionLabel(section) : '';
        const haystack = __tmNormalizeSettingsSearchText([title, desc, tabLabel, sectionLabel].filter(Boolean).join(' '));
        return { tab, title, desc, section, key, tabLabel, sectionLabel, haystack, rendered: !!raw.rendered };
    }

    function __tmGetSettingsSearchStaticEntries() {
        const entries = [];
        TM_SETTINGS_SEARCH_PAGE_ITEMS.forEach((item) => {
            const entry = __tmCreateSettingsSearchEntry(item);
            if (entry) entries.push(entry);
        });
        TM_SETTINGS_SEARCH_MAIN_GROUPS.forEach((group) => {
            const section = String(group?.section || '').trim();
            const sectionLabel = __tmGetSettingsSearchSectionLabel(section);
            (Array.isArray(group?.titles) ? group.titles : []).forEach((title) => {
                const entry = __tmCreateSettingsSearchEntry({
                    tab: 'main',
                    section,
                    title,
                    desc: sectionLabel
                });
                if (entry) entries.push(entry);
            });
        });
        return entries;
    }

    function __tmCollectRenderedSettingsSearchEntries(root) {
        if (!(root instanceof HTMLElement)) return [];
        const entries = [];
        root.querySelectorAll('[data-tm-settings-search-title]').forEach((node) => {
            if (!(node instanceof HTMLElement)) return;
            const tab = __tmNormalizeSettingsSearchTab(node.dataset.tmSettingsSearchTab || state.settingsActiveTab || 'docs');
            const section = String(
                node.dataset.tmSettingsSearchSection
                || node.closest('.tm-settings-panel[data-tm-settings-section]')?.dataset?.tmSettingsSection
                || ''
            ).trim();
            const entry = __tmCreateSettingsSearchEntry({
                tab,
                section,
                title: node.dataset.tmSettingsSearchTitle || '',
                desc: node.dataset.tmSettingsSearchDesc || '',
                key: node.dataset.tmSettingsSearchKey || '',
                rendered: true
            });
            if (entry) entries.push(entry);
        });
        return entries;
    }

    function __tmGetSettingsSearchEntries() {
        const map = new Map();
        __tmGetSettingsSearchStaticEntries().forEach((entry) => {
            map.set(`${entry.tab}:${entry.key}`, entry);
        });
        __tmCollectRenderedSettingsSearchEntries(state.settingsModal).forEach((entry) => {
            map.set(`${entry.tab}:${entry.key}`, entry);
        });
        return Array.from(map.values());
    }

    function __tmScoreSettingsSearchEntry(entry, queryNorm, terms, activeTab) {
        if (!entry || !queryNorm) return 0;
        const titleNorm = __tmNormalizeSettingsSearchText(entry.title);
        const descNorm = __tmNormalizeSettingsSearchText(entry.desc);
        const metaNorm = __tmNormalizeSettingsSearchText(`${entry.tabLabel || ''} ${entry.sectionLabel || ''}`);
        if (!terms.every((term) => entry.haystack.includes(term))) return 0;
        let score = 1;
        if (titleNorm === queryNorm) score += 120;
        else if (titleNorm.startsWith(queryNorm)) score += 90;
        else if (titleNorm.includes(queryNorm)) score += 70;
        if (descNorm.includes(queryNorm)) score += 28;
        if (metaNorm.includes(queryNorm)) score += 18;
        terms.forEach((term) => {
            if (titleNorm.includes(term)) score += 18;
            else if (descNorm.includes(term)) score += 8;
            else if (metaNorm.includes(term)) score += 4;
        });
        if (entry.tab === activeTab) score += 6;
        if (entry.rendered) score += 3;
        return score;
    }

    function __tmGetSettingsSearchResults(query, activeTab = state.settingsActiveTab || 'docs') {
        const queryNorm = __tmNormalizeSettingsSearchText(query);
        if (!queryNorm) return [];
        const terms = queryNorm.split(/\s+/).map((term) => term.trim()).filter(Boolean);
        if (!terms.length) return [];
        const currentTab = __tmNormalizeSettingsSearchTab(activeTab);
        return __tmGetSettingsSearchEntries()
            .map((entry) => ({ entry, score: __tmScoreSettingsSearchEntry(entry, queryNorm, terms, currentTab) }))
            .filter((item) => item.score > 0)
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                if (a.entry.tab === currentTab && b.entry.tab !== currentTab) return -1;
                if (b.entry.tab === currentTab && a.entry.tab !== currentTab) return 1;
                return String(a.entry.title || '').localeCompare(String(b.entry.title || ''), 'zh-Hans-CN');
            })
            .slice(0, TM_SETTINGS_SEARCH_MAX_RESULTS)
            .map((item) => item.entry);
    }

    function __tmRenderSettingsSearchResultsHtml(query, activeTab) {
        const q = String(query || '').trim();
        const isOpen = !!q && state.settingsSearchResultsOpen !== false;
        if (!isOpen) return '';
        const results = __tmGetSettingsSearchResults(q, activeTab);
        if (!results.length) {
            return '<div class="tm-settings-search-empty">未找到设置项</div>';
        }
        const activeIndex = Math.max(0, Math.min(results.length - 1, Number(state.settingsSearchActiveIndex) || 0));
        state.settingsSearchActiveIndex = activeIndex;
        return results.map((entry, index) => {
            const args = esc(JSON.stringify([entry.tab, entry.section || '', entry.key || '']));
            const meta = [entry.tabLabel, entry.sectionLabel].filter(Boolean).join(' / ');
            return `
                <button class="tm-settings-search-result${index === activeIndex ? ' is-active' : ''}" type="button" data-tm-call="tmOpenSettingsSearchResult" data-tm-args='${args}' aria-selected="${index === activeIndex ? 'true' : 'false'}">
                    <span class="tm-settings-search-result__title">${esc(entry.title)}</span>
                    ${meta ? `<span class="tm-settings-search-result__meta">${esc(meta)}</span>` : ''}
                    ${entry.desc ? `<span class="tm-settings-search-result__desc">${esc(entry.desc)}</span>` : ''}
                </button>
            `;
        }).join('');
    }

    function __tmRenderSettingsSearchBox(activeTab) {
        const query = String(state.settingsSearchQuery || '');
        const hasQuery = !!query.trim();
        if (hasQuery && state.settingsSearchResultsOpen !== false && !Number.isFinite(Number(state.settingsSearchActiveIndex))) {
            state.settingsSearchActiveIndex = 0;
        }
        return `
            <div class="tm-settings-search${hasQuery ? ' has-query' : ''}" data-tm-settings-search-root>
                <div class="tm-settings-search-input-wrap">
                    <span class="tm-settings-search-icon" aria-hidden="true">🔎</span>
                    <input class="tm-settings-search-input" type="search" value="${esc(query)}" placeholder="搜索设置项" autocomplete="off" spellcheck="false" aria-label="搜索设置项" data-tm-settings-search-input data-tm-call="tmUpdateSettingsSearch" aria-expanded="${hasQuery && state.settingsSearchResultsOpen !== false ? 'true' : 'false'}">
                    <button class="tm-settings-search-clear" type="button" data-tm-action="tmClearSettingsSearch" title="清空搜索" aria-label="清空搜索"${hasQuery ? '' : ' hidden'}>×</button>
                </div>
                <div class="tm-settings-search-results" data-tm-settings-search-results${hasQuery && state.settingsSearchResultsOpen !== false ? '' : ' hidden'}>
                    ${__tmRenderSettingsSearchResultsHtml(query, activeTab)}
                </div>
            </div>
        `;
    }

    function __tmShouldRenderSettingsSearch(activeTab) {
        if (String(activeTab || '').trim() === 'rule_editor') return false;
        try {
            const info = globalThis.__tmRuntimeHost?.getInfo?.();
            const runtimeMobile = info?.runtimeMobileClient ?? (typeof __tmIsRuntimeMobileClient === 'function' && __tmIsRuntimeMobileClient());
            const mobileUi = info?.hostUsesMobileUI ?? (typeof __tmHostUsesMobileUI === 'function' && __tmHostUsesMobileUI());
            const mobileDevice = info?.isMobileDevice ?? (typeof __tmIsMobileDevice === 'function' && __tmIsMobileDevice());
            const dockHost = info?.isDockHost ?? (typeof __tmIsDockHost === 'function' && __tmIsDockHost());
            if (runtimeMobile || mobileUi || mobileDevice || dockHost) return false;
        } catch (e) {
            try {
                if (typeof __tmIsRuntimeMobileClient === 'function' && __tmIsRuntimeMobileClient()) return false;
                if (typeof __tmHostUsesMobileUI === 'function' && __tmHostUsesMobileUI()) return false;
                if (typeof __tmIsMobileDevice === 'function' && __tmIsMobileDevice()) return false;
                if (typeof __tmIsDockHost === 'function' && __tmIsDockHost()) return false;
            } catch (e2) {}
        }
        return true;
    }

    function __tmRefreshSettingsSearchResults(root = state.settingsModal) {
        if (!(root instanceof HTMLElement)) return;
        const query = String(state.settingsSearchQuery || '');
        const hasQuery = !!query.trim();
        const resultsEl = root.querySelector('[data-tm-settings-search-results]');
        const searchRoot = root.querySelector('[data-tm-settings-search-root]');
        const clearBtn = root.querySelector('.tm-settings-search-clear');
        const input = root.querySelector('[data-tm-settings-search-input]');
        if (searchRoot instanceof HTMLElement) searchRoot.classList.toggle('has-query', hasQuery);
        if (clearBtn instanceof HTMLElement) clearBtn.hidden = !hasQuery;
        if (input instanceof HTMLInputElement && input.value !== query) input.value = query;
        if (input instanceof HTMLElement) input.setAttribute('aria-expanded', hasQuery && state.settingsSearchResultsOpen !== false ? 'true' : 'false');
        if (resultsEl instanceof HTMLElement) {
            resultsEl.hidden = !hasQuery || state.settingsSearchResultsOpen === false;
            resultsEl.innerHTML = __tmRenderSettingsSearchResultsHtml(query, state.settingsActiveTab || 'docs');
            try { resultsEl.querySelector('.tm-settings-search-result.is-active')?.scrollIntoView?.({ block: 'nearest' }); } catch (e) {}
        }
    }

    function __tmFindSettingsSearchTarget(root, target = {}) {
        if (!(root instanceof HTMLElement)) return null;
        const key = String(target?.key || '').trim();
        if (key) {
            const found = Array.from(root.querySelectorAll('[data-tm-settings-search-key]')).find((node) => {
                return node instanceof HTMLElement && String(node.dataset.tmSettingsSearchKey || '') === key;
            });
            if (found instanceof HTMLElement) return found;
        }
        const section = String(target?.section || '').trim();
        if (section) {
            const found = root.querySelector(`.tm-settings-panel[data-tm-settings-section="${section}"]`);
            if (found instanceof HTMLElement) return found;
        }
        return root.querySelector('.tm-settings-content > *');
    }

    function __tmHighlightSettingsSearchTarget(target) {
        if (!(target instanceof HTMLElement)) return;
        try {
            state.settingsSearchHighlightTimer && clearTimeout(state.settingsSearchHighlightTimer);
        } catch (e) {}
        try {
            state.settingsModal?.querySelectorAll?.('.tm-settings-search-hit').forEach((item) => item.classList.remove('tm-settings-search-hit'));
        } catch (e) {}
        try {
            target.classList.add('tm-settings-search-hit');
            if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
            target.focus?.({ preventScroll: true });
        } catch (e) {}
        state.settingsSearchHighlightTimer = setTimeout(() => {
            try { target.classList.remove('tm-settings-search-hit'); } catch (e) {}
        }, 1800);
    }

    function __tmFocusSettingsSearchTarget(root, target = {}) {
        if (!(root instanceof HTMLElement)) return false;
        const tab = __tmNormalizeSettingsSearchTab(target?.tab || state.settingsActiveTab || 'docs');
        const section = String(target?.section || '').trim();
        const content = root.querySelector('.tm-settings-content');
        if (!(content instanceof HTMLElement)) return false;
        if (tab === 'main' && section) {
            try { __tmSetActiveSettingsSection(root, section, true); } catch (e) {}
        }
        const targetEl = __tmFindSettingsSearchTarget(root, target);
        if (!(targetEl instanceof HTMLElement)) return false;
        const subtabs = root.querySelector('.tm-settings-subtabs');
        const stickyOffset = (subtabs instanceof HTMLElement ? subtabs.offsetHeight : 0) + 12;
        const maxScrollTop = Math.max(0, content.scrollHeight - content.clientHeight);
        const nextTop = Math.max(0, Math.min(maxScrollTop, __tmGetSettingsSectionAnchorTop(content, targetEl) - stickyOffset));
        try { content.scrollTo({ top: nextTop, behavior: 'smooth' }); } catch (e) { content.scrollTop = nextTop; }
        __tmHighlightSettingsSearchTarget(targetEl);
        return true;
    }

    function __tmRunPendingSettingsSearchFocus(root = state.settingsModal) {
        const pending = state.settingsSearchPendingTarget;
        if (!pending || !(root instanceof HTMLElement)) return;
        if (Date.now() > (Number(pending.until) || 0)) {
            state.settingsSearchPendingTarget = null;
            return;
        }
        const activeTab = __tmNormalizeSettingsSearchTab(state.settingsActiveTab || 'docs');
        if (__tmNormalizeSettingsSearchTab(pending.tab) !== activeTab) return;
        requestAnimationFrame(() => {
            const ok = __tmFocusSettingsSearchTarget(root, pending);
            if (ok) state.settingsSearchPendingTarget = null;
        });
    }

    function __tmBindSettingsSearchEvents(root) {
        if (!(root instanceof HTMLElement) || root.__tmSettingsSearchBound) return;
        root.__tmSettingsSearchBound = true;
        const input = root.querySelector('[data-tm-settings-search-input]');
        const openSearchResultFromElement = (target) => {
            if (!(target instanceof HTMLElement)) return false;
            let args = [];
            const raw = target.dataset.tmArgs;
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    args = Array.isArray(parsed) ? parsed : [parsed];
                } catch (e) {}
            }
            window.tmOpenSettingsSearchResult?.(args[0], args[1], args[2]);
            return true;
        };
        const handleSearchResultPress = (event) => {
            const target = event.target instanceof Element ? event.target.closest('.tm-settings-search-result') : null;
            if (!(target instanceof HTMLElement) || !root.contains(target)) return;
            if (event.button !== undefined && event.button !== 0) return;
            const now = Date.now();
            if (event.type === 'mousedown' && Number(root.__tmSettingsSearchPointerHandledUntil || 0) > now) {
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            if (event.type === 'pointerdown') root.__tmSettingsSearchPointerHandledUntil = now + 350;
            event.preventDefault();
            event.stopPropagation();
            openSearchResultFromElement(target);
        };
        const handleSearchResultClick = (event) => {
            const target = event.target instanceof Element ? event.target.closest('.tm-settings-search-result') : null;
            if (!(target instanceof HTMLElement) || !root.contains(target)) return;
            event.preventDefault();
            event.stopPropagation();
            if (Number(root.__tmSettingsSearchPointerHandledUntil || 0) > Date.now()) return;
            openSearchResultFromElement(target);
        };
        if (input instanceof HTMLElement) {
            input.addEventListener('focus', () => {
                if (!String(state.settingsSearchQuery || '').trim()) return;
                state.settingsSearchResultsOpen = true;
                __tmRefreshSettingsSearchResults(root);
            });
            input.addEventListener('keydown', (event) => {
                const query = String(state.settingsSearchQuery || input.value || '').trim();
                if (!query) return;
                const results = __tmGetSettingsSearchResults(query, state.settingsActiveTab || 'docs');
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    if (!results.length) return;
                    event.preventDefault();
                    state.settingsSearchResultsOpen = true;
                    const current = Number.isFinite(Number(state.settingsSearchActiveIndex)) ? Number(state.settingsSearchActiveIndex) : 0;
                    const delta = event.key === 'ArrowDown' ? 1 : -1;
                    state.settingsSearchActiveIndex = (current + delta + results.length) % results.length;
                    __tmRefreshSettingsSearchResults(root);
                    return;
                }
                if (event.key === 'Enter') {
                    if (!results.length) return;
                    event.preventDefault();
                    const index = Math.max(0, Math.min(results.length - 1, Number(state.settingsSearchActiveIndex) || 0));
                    const entry = results[index];
                    window.tmOpenSettingsSearchResult?.(entry.tab, entry.section || '', entry.key || '');
                    return;
                }
                if (event.key === 'Escape') {
                    event.preventDefault();
                    state.settingsSearchResultsOpen = false;
                    __tmRefreshSettingsSearchResults(root);
                }
            });
        }
        root.addEventListener('pointerdown', handleSearchResultPress);
        root.addEventListener('mousedown', handleSearchResultPress);
        root.addEventListener('click', handleSearchResultClick, true);
        root.addEventListener('click', (event) => {
            if (event.target instanceof Element && event.target.closest('[data-tm-settings-search-root]')) return;
            if (!String(state.settingsSearchQuery || '').trim() || state.settingsSearchResultsOpen === false) return;
            state.settingsSearchResultsOpen = false;
            __tmRefreshSettingsSearchResults(root);
        });
    }

    window.tmUpdateSettingsSearch = function(value) {
        state.settingsSearchQuery = String(value || '');
        state.settingsSearchResultsOpen = !!String(value || '').trim();
        state.settingsSearchActiveIndex = 0;
        __tmRefreshSettingsSearchResults();
    };

    window.tmClearSettingsSearch = function() {
        state.settingsSearchQuery = '';
        state.settingsSearchResultsOpen = false;
        state.settingsSearchActiveIndex = -1;
        __tmRefreshSettingsSearchResults();
        try { state.settingsModal?.querySelector?.('[data-tm-settings-search-input]')?.focus?.(); } catch (e) {}
    };

    window.tmOpenSettingsSearchResult = function(tab, section, key) {
        const targetTab = __tmNormalizeSettingsSearchTab(tab);
        const pending = {
            tab: targetTab,
            section: String(section || '').trim(),
            key: String(key || '').trim(),
            until: Date.now() + 2000
        };
        state.settingsSearchResultsOpen = false;
        state.settingsSearchActiveIndex = -1;
        state.settingsSearchPendingTarget = pending;
        const currentTab = __tmNormalizeSettingsSearchTab(state.settingsActiveTab || 'docs');
        if (targetTab !== currentTab) {
            if (targetTab === 'priority') {
                try { state.priorityScoreDraft = state.priorityScoreDraft || __tmEnsurePriorityDraft(); } catch (e) {}
            }
            state.settingsActiveTab = targetTab;
            state.settingsContentScrollTop = 0;
            state.settingsSubtabsScrollLeft = 0;
            showSettings();
            return;
        }
        __tmRefreshSettingsSearchResults();
        if (__tmFocusSettingsSearchTarget(state.settingsModal, pending)) state.settingsSearchPendingTarget = null;
    };

    function showSettings() {
        try { __tmHideMobileMenu(); } catch (e) {}
        const shouldAnimateOpen = !state.settingsModal;
        try {
            const notebooksStale = !Array.isArray(state.notebooks)
                || state.notebooks.length === 0
                || (Date.now() - (Number(state.notebooksFetchedAt) || 0) > 60000);
            if (notebooksStale && !state.notebooksLoadingPromise) {
                __tmRefreshNotebookCache().then(() => {
                    if (state.settingsModal && document.body.contains(state.settingsModal)) showSettings();
                }).catch(() => null);
            }
        } catch (e) {}
        let savedSettingsSidebarScrollLeft = Number(state.settingsSidebarScrollLeft) || 0;
        let savedSettingsTabsScrollLeft = Number(state.settingsTabsScrollLeft) || 0;
        let savedSettingsContentScrollTop = Number(state.settingsContentScrollTop) || 0;
        let savedSettingsSubtabsScrollLeft = Number(state.settingsSubtabsScrollLeft) || 0;
        let shouldRestoreSettingsSearchFocus = false;
        if (state.settingsModal) {
            try {
                state.__settingsUnstack?.();
                state.__settingsUnstack = null;
            } catch (e) {}
            try {
                const prevSidebar = state.settingsModal.querySelector('.tm-settings-sidebar');
                const prevTabs = state.settingsModal.querySelector('.tm-settings-tabs');
                const prevContent = state.settingsModal.querySelector('.tm-settings-content');
                const prevSubtabs = state.settingsModal.querySelector('.tm-settings-subtabs');
                shouldRestoreSettingsSearchFocus = state.settingsModal.querySelector('[data-tm-settings-search-input]') === document.activeElement;
                if (prevSidebar) savedSettingsSidebarScrollLeft = Number(prevSidebar.scrollLeft) || 0;
                if (prevTabs) savedSettingsTabsScrollLeft = Number(prevTabs.scrollLeft) || 0;
                if (prevContent) savedSettingsContentScrollTop = Number(prevContent.scrollTop) || 0;
                if (prevSubtabs) savedSettingsSubtabsScrollLeft = Number(prevSubtabs.scrollLeft) || 0;
            } catch (e) {}
            try { state.settingsModal.remove(); } catch (e) {}
            state.settingsModal = null;
            state.settingsSectionJump = null;
        }
        state.settingsSidebarScrollLeft = savedSettingsSidebarScrollLeft;
        state.settingsTabsScrollLeft = savedSettingsTabsScrollLeft;
        state.settingsContentScrollTop = savedSettingsContentScrollTop;
        state.settingsSubtabsScrollLeft = savedSettingsSubtabsScrollLeft;

        const settingsUsesMobileLayout = (() => {
            try {
                const info = globalThis.__tmRuntimeHost?.getInfo?.();
                if (info?.runtimeMobileClient || info?.hostUsesMobileUI || info?.isMobileDevice) return true;
            } catch (e) {}
            try {
                if (typeof __tmIsMobileDevice === 'function' && __tmIsMobileDevice()) return true;
                if (typeof __tmHostUsesMobileUI === 'function' && __tmHostUsesMobileUI()) return true;
                if (typeof __tmIsRuntimeMobileClient === 'function' && __tmIsRuntimeMobileClient()) return true;
            } catch (e) {}
            return false;
        })();
        state.settingsModal = document.createElement('div');
        state.settingsModal.className = `tm-settings-modal${settingsUsesMobileLayout ? ' tm-settings-modal--mobile' : ''}`;

        const groups = SettingsStore.data.docGroups || [];
        const currentGroupId = SettingsStore.data.currentGroupId || 'all';
        const currentGroup = currentGroupId === 'all'
            ? null
            : (groups.find((g) => String(g?.id || '').trim() === String(currentGroupId || '').trim()) || null);
        const currentGroupCalendarOptimization = __tmGetGroupCalendarSearchOptimization(currentGroup);
        const currentGroupExcludedDocIds = __tmGetExcludedDocIdsForGroup(currentGroupId);
        let activeTab = 'docs';
        if (state.settingsActiveTab === 'main') activeTab = 'main';
        if (state.settingsActiveTab === 'docs') activeTab = 'docs';
        if (state.settingsActiveTab === 'appearance') activeTab = 'appearance';
        if (state.settingsActiveTab === 'calendar') activeTab = 'calendar';
        if (state.settingsActiveTab === 'ai') activeTab = 'ai';
        if (state.settingsActiveTab === 'rules') activeTab = 'rules';
        if (state.settingsActiveTab === 'quadrant') activeTab = 'quadrant';
        if (state.settingsActiveTab === 'priority') activeTab = 'priority';
        if (state.settingsActiveTab === 'about') activeTab = 'about';
        if (state.settingsActiveTab === 'rule_editor') activeTab = 'rule_editor';
        const settingsSearchEnabled = __tmShouldRenderSettingsSearch(activeTab);

        const renderSettingsActions = (extraClass = '') => {
            const className = `tm-settings-actions${extraClass ? ` ${extraClass}` : ''}`;
            if (activeTab === 'priority') {
                return `
                    <div class="${className}">
                        <button class="tm-btn tm-btn-secondary" data-tm-action="closePriorityScoreSettings">取消</button>
                        <button class="tm-btn tm-btn-success" data-tm-action="savePriorityScoreSettings">保存算法</button>
                    </div>
                `;
            }
            if (activeTab === 'about') {
                return `
                    <div class="${className}">
                        <button class="tm-btn tm-btn-secondary" data-tm-action="closeSettings">关闭</button>
                        <button class="tm-btn tm-btn-success" onclick="tmCopyDeviceRecognitionReport()">复制诊断</button>
                    </div>
                `;
            }
            if (activeTab === 'rule_editor') {
                return `
                    <div class="${className}">
                        <button class="tm-btn tm-btn-secondary" data-tm-action="cancelEditRule">取消</button>
                        <button class="tm-btn tm-btn-success" data-tm-action="saveEditRule">保存规则</button>
                    </div>
                `;
            }
            return `
                <div class="${className}">
                    <button class="tm-btn tm-btn-secondary" data-tm-action="closeSettings">取消</button>
                    <button class="tm-btn tm-btn-success" data-tm-action="saveSettings">保存设置</button>
                </div>
            `;
        };

        // 渲染分组选择器
        const renderGroupSelector = () => {
            const canRenameCurrentGroup = currentGroupId !== 'all' && currentGroup && !String(currentGroup.notebookId || '').trim();
            return `
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
                    <button class="tm-btn tm-btn-primary" data-tm-action="createNotebookGroup" style="padding: 6px 12px; font-size: 12px;">+ 按笔记本分组</button>
                    <button class="tm-btn tm-btn-info" data-tm-action="createCustomGroup" style="padding: 6px 12px; font-size: 12px;">+ 自定义分组</button>
                </div>
                <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <select id="groupSelector" data-tm-call="switchDocGroup"
                            style="flex: 1; padding: 6px 8px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px;">
                        <option value="all" ${currentGroupId === 'all' ? 'selected' : ''}>全部文档</option>
                        ${groups.map(g => `<option value="${g.id}" ${currentGroupId === g.id ? 'selected' : ''}>${esc(__tmResolveDocGroupName(g))}</option>`).join('')}
                    </select>
                    ${currentGroupId !== 'all' ? `${canRenameCurrentGroup ? `<button class="tm-btn tm-btn-secondary" data-tm-action="renameCurrentGroup" style="padding: 6px 10px; font-size: 12px;">重命名</button>` : ''}
                        <button class="tm-btn tm-btn-danger" data-tm-action="deleteCurrentGroup" style="padding: 6px 10px; font-size: 12px;">删除分组</button>
                        <button class="tm-btn tm-btn-success" data-tm-action="exportCurrentGroup" style="padding: 6px 10px; font-size: 12px;">导出任务</button>` : ''}
                </div>
            `;
        };


        const resolveOtherBlockSourceGroupsForSettings = () => {
            if (currentGroupId === 'all') return groups;
            return currentGroup ? [currentGroup] : [];
        };
        const normalizeOtherBlockSourceDocsForSettings = (group) => {
            const gid = String(group?.id || '').trim();
            if (!gid) return [];
            const sourceList = Array.isArray(state.otherBlockSourceDocsByGroup?.[gid])
                ? state.otherBlockSourceDocsByGroup[gid]
                : [];
            const groupName = __tmResolveDocGroupName(group);
            return sourceList.map((item) => {
                const id = String(item?.id || item?.docId || '').trim();
                if (!id) return null;
                return {
                    id,
                    kind: 'doc',
                    recursive: false,
                    hasOtherBlockSource: true,
                    otherBlockCount: Math.max(1, Number(item?.otherBlockCount) || 1),
                    otherBlockIds: Array.isArray(item?.otherBlockIds) ? item.otherBlockIds.slice() : [],
                    docName: String(item?.docName || '').trim(),
                    sourceGroupId: gid,
                    sourceGroupName: groupName
                };
            }).filter(Boolean);
        };
        const scheduleOtherBlockSourceDocRefresh = () => {
            if (activeTab !== 'docs' || typeof __tmEnsureOtherBlockSourceDocsForGroup !== 'function') return;
            if (!state.otherBlockSourceDocsLoadingByGroup || typeof state.otherBlockSourceDocsLoadingByGroup !== 'object') {
                state.otherBlockSourceDocsLoadingByGroup = {};
            }
            if (!state.otherBlockSourceDocRefsSigByGroup || typeof state.otherBlockSourceDocRefsSigByGroup !== 'object') {
                state.otherBlockSourceDocRefsSigByGroup = {};
            }
            resolveOtherBlockSourceGroupsForSettings().forEach((group) => {
                const gid = String(group?.id || '').trim();
                if (!gid || state.otherBlockSourceDocsLoadingByGroup[gid]) return;
                const refs = __tmGetOtherBlockRefsByGroup(gid);
                const refsSig = __tmNormalizeOtherBlockRefs(refs).map((item) => item.id).join(',');
                if (!refs.length) {
                    if (!state.otherBlockSourceDocsByGroup || typeof state.otherBlockSourceDocsByGroup !== 'object') {
                        state.otherBlockSourceDocsByGroup = {};
                    }
                    state.otherBlockSourceDocsByGroup[gid] = [];
                    state.otherBlockSourceDocRefsSigByGroup[gid] = refsSig;
                    return;
                }
                if (state.otherBlockSourceDocRefsSigByGroup[gid] === refsSig
                    && Array.isArray(state.otherBlockSourceDocsByGroup?.[gid])) return;
                state.otherBlockSourceDocsLoadingByGroup[gid] = true;
                Promise.resolve(__tmEnsureOtherBlockSourceDocsForGroup(gid)).then(() => {
                    delete state.otherBlockSourceDocsLoadingByGroup[gid];
                    if (state.settingsModal && document.body.contains(state.settingsModal)) showSettings();
                }).catch(() => {
                    delete state.otherBlockSourceDocsLoadingByGroup[gid];
                });
            });
        };
        scheduleOtherBlockSourceDocRefresh();

        // 获取当前显示的文档列表
        let currentDocs = [];
        const pushDirectDocEntries = (entries) => {
            (Array.isArray(entries) ? entries : []).forEach((entry) => {
                const docId = String((typeof entry === 'object' ? entry?.id : entry) || '').trim();
                const kind = String((typeof entry === 'object' ? entry?.kind : '') || 'doc').trim() || 'doc';
                if (!docId) return;
                currentDocs.push({
                    ...(typeof entry === 'object' ? entry : { id: docId }),
                    id: docId,
                    kind,
                    hasDirectDocSource: kind === 'doc'
                });
            });
        };
        if (currentGroupId === 'all') {
            // 显示所有（包括旧版和各分组）
            const legacyIds = SettingsStore.data.selectedDocIds || [];
            pushDirectDocEntries(legacyIds.map((id) => ({ id, kind: 'doc', recursive: false })));
            groups.forEach(g => {
                pushDirectDocEntries(__tmGetGroupSourceEntries(g));
            });
        } else {
            if (currentGroup) pushDirectDocEntries(__tmGetGroupSourceEntries(currentGroup));
        }
        resolveOtherBlockSourceGroupsForSettings().forEach((group) => {
            currentDocs.push(...normalizeOtherBlockSourceDocsForSettings(group));
        });
        const seenDocs = new Map();
        currentDocs.forEach((docItem) => {
            const docId = String((typeof docItem === 'object' ? docItem?.id : docItem) || '').trim();
            const itemKind = String((typeof docItem === 'object' ? docItem?.kind : '') || 'doc').trim() || 'doc';
            if (!docId) return;
            const key = `${itemKind}:${docId}`;
            const existing = seenDocs.get(key);
            if (!existing) {
                seenDocs.set(key, docItem);
                return;
            }
            existing.hasDirectDocSource = !!(existing.hasDirectDocSource || docItem.hasDirectDocSource);
            existing.hasOtherBlockSource = !!(existing.hasOtherBlockSource || docItem.hasOtherBlockSource);
            existing.otherBlockCount = (Number(existing.otherBlockCount) || 0) + (Number(docItem.otherBlockCount) || 0);
            existing.otherBlockIds = Array.from(new Set([
                ...(Array.isArray(existing.otherBlockIds) ? existing.otherBlockIds : []),
                ...(Array.isArray(docItem.otherBlockIds) ? docItem.otherBlockIds : [])
            ]));
            existing.sourceGroupIds = Array.from(new Set([
                ...(Array.isArray(existing.sourceGroupIds) ? existing.sourceGroupIds : (existing.sourceGroupId ? [existing.sourceGroupId] : [])),
                ...(Array.isArray(docItem.sourceGroupIds) ? docItem.sourceGroupIds : (docItem.sourceGroupId ? [docItem.sourceGroupId] : []))
            ].map((item) => String(item || '').trim()).filter(Boolean)));
            if (!existing.docName && docItem.docName) existing.docName = docItem.docName;
            if (!existing.sourceGroupName && docItem.sourceGroupName) existing.sourceGroupName = docItem.sourceGroupName;
            if (!existing.sourceGroupId && docItem.sourceGroupId) existing.sourceGroupId = docItem.sourceGroupId;
        });
        currentDocs = Array.from(seenDocs.values());

        const resolveDocName = (docId) => {
            if (!docId) return '未知文档';
            let doc = state.allDocuments.find(d => d.id === docId);
            if (!doc) {
                const docEntry = state.taskTree.find(d => d.id === docId);
                if (docEntry) doc = { id: docId, name: docEntry.name };
            }
            return doc ? __tmGetDocDisplayName(doc, doc.name || '未知文档') : '未知文档';
        };

        const defaultDocIdByGroup = (SettingsStore.data.defaultDocIdByGroup && typeof SettingsStore.data.defaultDocIdByGroup === 'object')
            ? SettingsStore.data.defaultDocIdByGroup
            : {};
        const defaultDocId = String((currentGroupId === 'all' ? SettingsStore.data.defaultDocId : defaultDocIdByGroup[currentGroupId]) || '').trim();
        const currentDocIds = currentDocs.map(d => (typeof d === 'object' ? d.id : d));
        const defaultDocOptions = [
            `<option value="" ${defaultDocId ? '' : 'selected'}>跟随当前/第一个文档</option>`
        ];
        currentDocs.forEach(docItem => {
            const docId = typeof docItem === 'object' ? docItem.id : docItem;
            const docName = resolveDocName(docId);
            defaultDocOptions.push(`<option value="${docId}" ${defaultDocId === docId ? 'selected' : ''}>${esc(docName)}</option>`);
        });
        if (defaultDocId && !currentDocIds.includes(defaultDocId)) {
            const fallbackName = resolveDocName(defaultDocId);
            defaultDocOptions.push(`<option value="${defaultDocId}" selected>${esc(fallbackName)} (不在当前列表)</option>`);
        }
        const allDocsForNewTask = (() => {
            const list = [];
            const legacyIds = SettingsStore.data.selectedDocIds || [];
            legacyIds.forEach(id => list.push({ id, recursive: false }));
            (SettingsStore.data.docGroups || []).forEach(g => {
                if (Array.isArray(g?.docs)) list.push(...g.docs);
            });
            (Array.isArray(state.taskTree) ? state.taskTree : []).forEach((doc) => {
                const id = String(doc?.id || '').trim();
                if (id) list.push({ id, recursive: false });
            });
            const seen = new Set();
            return list.filter(d => {
                const id = String(d?.id || '').trim();
                if (!id) return false;
                if (seen.has(id)) return false;
                seen.add(id);
                return true;
            });
        })();
        const allDocIdsForNewTask = allDocsForNewTask.map(d => String(d?.id || '').trim()).filter(Boolean);
        const newTaskDocId = String(SettingsStore.data.newTaskDocId || '').trim();
        const newTaskDailyNoteNotebookId = String(SettingsStore.data.newTaskDailyNoteNotebookId || '').trim();
        const newTaskDocOptions = [
            `<option value="" ${newTaskDocId ? '' : 'selected'}>未设置</option>`,
            `<option value="__dailyNote__" ${newTaskDocId === '__dailyNote__' ? 'selected' : ''}>今天日记</option>`
        ];
        allDocsForNewTask.forEach(docItem => {
            const docId = typeof docItem === 'object' ? docItem.id : docItem;
            const docName = resolveDocName(docId);
            newTaskDocOptions.push(`<option value="${docId}" ${newTaskDocId === docId ? 'selected' : ''}>${esc(docName)}</option>`);
        });
        if (newTaskDocId && newTaskDocId !== '__dailyNote__' && !allDocIdsForNewTask.includes(newTaskDocId)) {
            const fallbackName = resolveDocName(newTaskDocId);
            newTaskDocOptions.push(`<option value="${newTaskDocId}" selected>${esc(fallbackName)} (不在当前列表)</option>`);
        }
        const dailyNoteNotebookOptions = [
            `<option value="" ${newTaskDailyNoteNotebookId ? '' : 'selected'}>跟随当前文档所属笔记本</option>`
        ];
        (Array.isArray(state.notebooks) ? state.notebooks : []).forEach((notebook) => {
            const notebookId = String(notebook?.id || notebook?.box || '').trim();
            if (!notebookId) return;
            const notebookName = String(notebook?.name || notebook?.title || notebookId).trim() || notebookId;
            dailyNoteNotebookOptions.push(`<option value="${notebookId}" ${newTaskDailyNoteNotebookId === notebookId ? 'selected' : ''}>${esc(notebookName)}</option>`);
        });
        if (newTaskDailyNoteNotebookId && !(Array.isArray(state.notebooks) ? state.notebooks : []).some((item) => String(item?.id || item?.box || '').trim() === newTaskDailyNoteNotebookId)) {
            dailyNoteNotebookOptions.push(`<option value="${newTaskDailyNoteNotebookId}" selected>${esc(__tmGetNotebookDisplayName(newTaskDailyNoteNotebookId, newTaskDailyNoteNotebookId))} (不在当前列表)</option>`);
        }
        if (activeTab === 'main' || activeTab === 'docs') {
            try { __tmEnsureAllDocumentsLoaded(false); } catch (e) {}
        }
        let settingsSearchCurrentSection = '';
        const renderMainSettingsSubtabs = () => {
            if (activeTab !== 'main') return '';
            return `
                <div class="tm-settings-subtabs">
                    <div class="tm-settings-subtabs-inner">
                        ${TM_MAIN_SETTINGS_SECTIONS.map((section, index) => `
                            <button
                                class="tm-settings-subtab-btn${index === 0 ? ' is-active' : ''}"
                                type="button"
                                data-section-id="${esc(String(section.id || ''))}"
                                data-tm-call="tmJumpSettingsSection"
                                data-tm-args='["${esc(String(section.id || ''))}"]'
                                aria-pressed="${index === 0 ? 'true' : 'false'}"
                            >${esc(String(section.label || ''))}</button>
                        `).join('')}
                    </div>
                </div>
            `;
        };
        const renderSingleSwitchSetting = (title, desc, inputHtml, opt = {}) => {
            const extraClass = String(opt?.className || '').trim();
            const extraStyle = String(opt?.style || '').trim();
            const searchAttrs = __tmSettingsSearchAttrs(activeTab, title, desc, {
                ...opt,
                section: opt?.section != null ? opt.section : settingsSearchCurrentSection
            });
            const descHtml = String(desc || '').trim()
                ? `<div class="tm-setting-switch-desc">${desc}</div>`
                : '';
            return `
                <div class="tm-setting-switch-row${extraClass ? ` ${extraClass}` : ''}"${extraStyle ? ` style="${extraStyle}"` : ''}${searchAttrs ? ` ${searchAttrs}` : ''}>
                    <div class="tm-setting-switch-copy">
                        <div class="tm-setting-switch-title">${title}</div>
                        ${descHtml}
                    </div>
                    <label class="tm-setting-switch-control">
                        ${inputHtml}
                    </label>
                </div>
            `;
        };
        const renderSingleFieldSetting = (title, desc, controlHtml, opt = {}) => {
            const extraClass = String(opt?.className || '').trim();
            const extraStyle = String(opt?.style || '').trim();
            const controlMode = String(opt?.controlMode || opt?.layout || '').trim();
            const controlText = String(controlHtml || '');
            const isChipControl = /tm-settings-chip-(?:setting|stack|group)/.test(controlText);
            const isStacked = ['block', 'stack', 'full'].includes(controlMode) || isChipControl;
            const searchAttrs = __tmSettingsSearchAttrs(activeTab, title, desc, {
                ...opt,
                section: opt?.section != null ? opt.section : settingsSearchCurrentSection
            });
            const descHtml = String(desc || '').trim()
                ? `<div class="tm-setting-field-desc">${desc}</div>`
                : '';
            return `
                <div class="tm-setting-field-row${isStacked ? ' tm-setting-field-row--stack' : ''}${extraClass ? ` ${extraClass}` : ''}"${extraStyle ? ` style="${extraStyle}"` : ''}${searchAttrs ? ` ${searchAttrs}` : ''}>
                    <div class="tm-setting-field-copy">
                        <div class="tm-setting-field-title">${title}</div>
                        ${descHtml}
                    </div>
                    <div class="tm-setting-field-control${isStacked ? ' tm-setting-field-control--block' : ''}">
                        ${controlHtml}
                    </div>
                </div>
            `;
        };
        const __tmBuildSettingsCustomFieldChipItem = (field) => {
            const fieldId = String(field?.id || '').trim();
            if (!fieldId) return null;
            const fieldLabel = String(field?.name || fieldId || '').trim() || '未命名';
            return {
                key: `customField:${fieldId}`,
                label: `${fieldLabel}（自定义）`,
                title: `自定义列：${fieldLabel}`
            };
        };
        const __tmBuildSettingsCustomFieldChipItems = () => __tmGetCustomFieldDefs()
            .filter((field) => String(field?.id || '').trim() && field?.enabled !== false && String(field?.type || '').trim() !== 'text')
            .map((field) => __tmBuildSettingsCustomFieldChipItem(field))
            .filter((item) => item && __tmParseCustomFieldColumnKey(item.key));
        const __tmBuildSettingsChipGroup = (title, items, opt = {}) => ({
            title: String(title || '').trim(),
            items: Array.isArray(items) ? items : [],
            selectedSet: opt.selectedSet instanceof Set ? opt.selectedSet : undefined,
            selectedKeys: Array.isArray(opt.selectedKeys) ? opt.selectedKeys : undefined,
            disabled: !!opt.disabled,
            className: String(opt.className || '').trim(),
            style: String(opt.style || '').trim(),
            gridClass: String(opt.gridClass || '').trim(),
            itemClassName: String(opt.itemClassName || '').trim(),
            onToggle: typeof opt.onToggle === 'function' ? opt.onToggle : null,
            desc: String(opt.desc || '').trim()
        });
        const renderSettingsChipItems = (items, opt = {}) => {
            const selectedSet = opt.selectedSet instanceof Set
                ? opt.selectedSet
                : new Set((Array.isArray(opt.selectedKeys) ? opt.selectedKeys : []).map((value) => String(value || '').trim()).filter(Boolean));
            const disabled = !!opt.disabled;
            const itemClassName = String(opt.itemClassName || '').trim();
            const onToggle = typeof opt.onToggle === 'function' ? opt.onToggle : null;
            return (Array.isArray(items) ? items : []).map((rawItem) => {
                const item = (rawItem && typeof rawItem === 'object') ? rawItem : { key: rawItem, label: rawItem };
                const key = String(item?.key || '').trim();
                if (!key) return '';
                const label = String(item?.label || item?.name || key).trim() || key;
                const title = String(item?.title || item?.tip || '').trim() || label;
                const checked = item?.checked != null ? !!item.checked : selectedSet.has(key);
                const itemDisabled = disabled || item?.disabled === true;
                const classes = [itemClassName, item?.className, checked ? 'is-selected' : '', itemDisabled ? 'is-disabled' : '', item?.muted ? 'is-muted' : '']
                    .map((value) => String(value || '').trim())
                    .filter(Boolean)
                    .join(' ');
                const onchange = onToggle ? String(onToggle(item, checked, itemDisabled) || '').trim() : '';
                return `
                    <label class="tm-settings-chip${classes ? ` ${classes}` : ''}" title="${esc(title)}"${itemDisabled ? ' aria-disabled="true"' : ''}>
                        <input class="tm-settings-chip__input" type="checkbox" ${checked ? 'checked' : ''} ${itemDisabled ? 'disabled' : ''} onchange="${esc(onchange)}">
                        <span class="tm-settings-chip__check" aria-hidden="true"></span>
                        <span class="tm-settings-chip__label">${esc(label)}</span>
                    </label>
                `;
            }).join('');
        };
        const renderSettingsChipGroup = (group = {}) => {
            const items = Array.isArray(group.items) ? group.items.filter(Boolean) : [];
            const selectedSet = group.selectedSet instanceof Set
                ? group.selectedSet
                : new Set((Array.isArray(group.selectedKeys) ? group.selectedKeys : []).map((value) => String(value || '').trim()).filter(Boolean));
            const disabled = !!group.disabled;
            const extraClass = String(group.className || '').trim();
            const extraStyle = String(group.style || '').trim();
            const gridClass = String(group.gridClass || '').trim();
            const totalCount = items.length;
            const selectedCount = items.reduce((count, item) => count + (selectedSet.has(String(item?.key || '').trim()) ? 1 : 0), 0);
            const title = String(group.title || '').trim();
            const desc = String(group.desc || '').trim();
            const descHtml = desc ? `<div class="tm-settings-chip-group-desc">${esc(desc)}</div>` : '';
            const headHtml = title || desc ? `
                    <div class="tm-settings-chip-group-head">
                        <div class="tm-settings-chip-group-title-wrap">
                            ${title ? `<div class="tm-settings-chip-group-title">${esc(title)}</div>` : ''}
                            ${descHtml}
                        </div>
                        <div class="tm-settings-chip-group-count">已选 ${selectedCount}/${totalCount}</div>
                    </div>
            ` : '';
            return `
                <section class="tm-settings-chip-group${disabled ? ' is-disabled' : ''}${extraClass ? ` ${extraClass}` : ''}"${extraStyle ? ` style="${extraStyle}"` : ''}>
                    ${headHtml}
                    <div class="tm-settings-chip-grid${gridClass ? ` ${gridClass}` : ''}">
                        ${renderSettingsChipItems(items, {
                            selectedSet,
                            disabled,
                            itemClassName: String(group.itemClassName || '').trim(),
                            onToggle: typeof group.onToggle === 'function' ? group.onToggle : null
                        })}
                    </div>
                </section>
            `;
        };
        const renderSettingsChipSetting = (title, desc, groups, opt = {}) => {
            const extraClass = String(opt?.className || '').trim();
            const extraStyle = String(opt?.style || '').trim();
            const groupsList = Array.isArray(groups) ? groups : [];
            const heading = String(title || '').trim();
            const description = String(desc || '').trim();
            const descHtml = String(desc || '').trim()
                ? `<div class="tm-settings-chip-setting-desc">${desc}</div>`
                : '';
            if (!heading && !description) {
                return `
                    <div class="tm-settings-chip-stack${groupsList.length > 1 ? ' tm-settings-chip-stack--multi' : ''}${extraClass ? ` ${extraClass}` : ''}"${extraStyle ? ` style="${extraStyle}"` : ''}>
                        ${groupsList.map((group) => renderSettingsChipGroup(group)).join('')}
                    </div>
                `;
            }
            return `
                <div class="tm-settings-chip-setting${extraClass ? ` ${extraClass}` : ''}"${extraStyle ? ` style="${extraStyle}"` : ''}>
                    <div class="tm-settings-chip-setting-copy">
                        <div class="tm-settings-chip-setting-title">${esc(heading)}</div>
                        ${description ? `<div class="tm-settings-chip-setting-desc">${esc(description)}</div>` : ''}
                    </div>
                    <div class="tm-settings-chip-stack${groupsList.length > 1 ? ' tm-settings-chip-stack--multi' : ''}">
                        ${groupsList.map((group) => renderSettingsChipGroup(group)).join('')}
                    </div>
                </div>
            `;
        };
        const renderAiSettingsPanel = () => {
            const contextMode = String(SettingsStore.data.aiDefaultContextMode || 'nearby').trim() === 'fulltext' ? 'fulltext' : 'nearby';
            const providerRaw = String(SettingsStore.data.aiProvider || '').trim();
            const provider = providerRaw === 'deepseek'
                ? 'deepseek'
                : (providerRaw === 'openai'
                    ? 'openai'
                    : (providerRaw === 'anthropic' ? 'anthropic' : 'minimax'));
            const providerLabel = provider === 'deepseek'
                ? 'DeepSeek'
                : (provider === 'openai'
                    ? 'OpenAI 兼容'
                    : (provider === 'anthropic' ? 'Anthropic 兼容' : 'MiniMax'));
            const model = provider === 'deepseek'
                ? (String(SettingsStore.data.aiDeepSeekModel || 'deepseek-v4-flash').trim() || 'deepseek-v4-flash')
                : (provider === 'openai'
                    ? (String(SettingsStore.data.aiOpenAIModel || 'gpt-5.4-mini').trim() || 'gpt-5.4-mini')
                    : (provider === 'anthropic'
                        ? (String(SettingsStore.data.aiAnthropicModel || 'claude-sonnet-4-5').trim() || 'claude-sonnet-4-5')
                        : (String(SettingsStore.data.aiMiniMaxModel || 'MiniMax-M2.7-highspeed').trim() || 'MiniMax-M2.7-highspeed')));
            const temperature = Number.isFinite(Number(SettingsStore.data.aiMiniMaxTemperature)) ? Number(SettingsStore.data.aiMiniMaxTemperature) : 0.2;
            const maxTokens = Number.isFinite(Number(SettingsStore.data.aiMiniMaxMaxTokens)) ? Math.max(256, Math.min(8192, Math.round(Number(SettingsStore.data.aiMiniMaxMaxTokens)))) : 1600;
            const timeoutMs = Number.isFinite(Number(SettingsStore.data.aiMiniMaxTimeoutMs)) ? Math.max(5000, Math.min(180000, Math.round(Number(SettingsStore.data.aiMiniMaxTimeoutMs)))) : 30000;
            const scheduleWindows = Array.isArray(SettingsStore.data.aiScheduleWindows) && SettingsStore.data.aiScheduleWindows.length
                ? SettingsStore.data.aiScheduleWindows.map(v => String(v || '').trim()).filter(Boolean).join('\n')
                : '09:00-18:00';
            const baseUrl = esc(provider === 'deepseek'
                ? (String(SettingsStore.data.aiDeepSeekBaseUrl || 'https://api.deepseek.com').trim() || 'https://api.deepseek.com')
                : (provider === 'openai'
                    ? (String(SettingsStore.data.aiOpenAIBaseUrl || 'https://api.openai.com/v1').trim() || 'https://api.openai.com/v1')
                    : (provider === 'anthropic'
                        ? (String(SettingsStore.data.aiAnthropicBaseUrl || 'https://api.anthropic.com').trim() || 'https://api.anthropic.com')
                        : (String(SettingsStore.data.aiMiniMaxBaseUrl || 'https://api.minimaxi.com/anthropic').trim() || 'https://api.minimaxi.com/anthropic'))));
            const apiKey = esc(provider === 'deepseek'
                ? String(SettingsStore.data.aiDeepSeekApiKey || '')
                : (provider === 'openai'
                    ? String(SettingsStore.data.aiOpenAIApiKey || '')
                    : (provider === 'anthropic'
                        ? String(SettingsStore.data.aiAnthropicApiKey || '')
                        : String(SettingsStore.data.aiMiniMaxApiKey || ''))));
            return `
                <div class="tm-settings-panel" ${__tmSettingsSearchAttrs('ai', 'AI 接入', '供应商、API Key、Base URL、模型、温度、超时和上下文模式')}>
                    <div class="tm-settings-section-title">🤖 AI 接入</div>
                    <div class="tm-settings-section-desc">可在 MiniMax、DeepSeek、OpenAI 兼容和 Anthropic 兼容之间切换，用于任务命名优化、自然语言字段编辑和 SMART 分析。</div>
                    ${renderSingleSwitchSetting(
                        '启用 AI 功能',
                        '关闭后会隐藏所有 AI 相关入口、菜单和 quickbar 图标。',
                        `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.aiEnabled ? 'checked' : ''} onchange="tmUpdateAiEnabled(this.checked)">`
                    )}
                    ${renderSingleFieldSetting(
                        '供应商',
                        '切换当前使用的 AI 供应商，分别记忆各自的 API Key / Base URL / 模型。',
                        `<select class="b3-select" onchange="tmUpdateAiProvider(this.value)" style="width:220px;">
                            <option value="minimax" ${provider === 'minimax' ? 'selected' : ''}>MiniMax</option>
                            <option value="deepseek" ${provider === 'deepseek' ? 'selected' : ''}>DeepSeek</option>
                            <option value="openai" ${provider === 'openai' ? 'selected' : ''}>OpenAI 兼容</option>
                            <option value="anthropic" ${provider === 'anthropic' ? 'selected' : ''}>Anthropic 兼容</option>
                        </select>`,
                        { style: 'margin-top:10px;' }
                    )}
                    ${renderSingleFieldSetting(
                        'API Key',
                        provider === 'deepseek'
                            ? 'DeepSeek 控制台创建的 API Key，会随插件设置保存。'
                            : (provider === 'openai'
                                ? 'OpenAI 控制台创建的 API Key（sk-...），会随插件设置保存。'
                                : (provider === 'anthropic'
                                    ? 'Anthropic 控制台创建的 API Key（sk-ant-...），会随插件设置保存。'
                                    : 'MiniMax 控制台创建的 API Key，会随插件设置保存。')),
                        `<input class="b3-text-field" type="password" value="${apiKey}" placeholder="请输入 ${providerLabel} API Key" onchange="tmUpdateAiApiKey(this.value)" style="width:100%;">`
                    )}
                    ${renderSingleFieldSetting(
                        'Base URL',
                        provider === 'deepseek'
                            ? '默认走 DeepSeek OpenAI 兼容接口。'
                            : (provider === 'openai'
                                ? '默认走 OpenAI 官方 /v1 接口；可改为 Azure / 兼容代理地址。'
                                : (provider === 'anthropic'
                                    ? '默认走 Anthropic 官方 /v1/messages 接口；可改为兼容代理地址。'
                                    : '默认走 MiniMax Anthropic 兼容接口。')),
                        `<input class="b3-text-field" type="text" value="${baseUrl}" onchange="tmUpdateAiBaseUrl(this.value)" style="width:100%;">`
                    )}
                    ${renderSingleFieldSetting(
                        '模型',
                        provider === 'deepseek'
                            ? '默认 deepseek-v4-flash，可手填 deepseek-v4-pro 等模型名。'
                            : (provider === 'openai'
                                ? '默认 gpt-5.4-mini，可手填 gpt-5.5 / gpt-5.4 等模型名。'
                                : (provider === 'anthropic'
                                    ? '默认 claude-sonnet-4-5，可手填其它 Claude 或兼容模型名。'
                                    : '默认 MiniMax-M2.7-highspeed，可手填 MiniMax-M2.7 等模型名。')),
                        provider === 'deepseek'
                            ? `<input class="b3-text-field" type="text" value="${esc(model)}" placeholder="deepseek-v4-flash" onchange="tmUpdateAiModel(this.value)" style="width:220px;">`
                            : (provider === 'openai'
                                ? `<input class="b3-text-field" type="text" value="${esc(model)}" placeholder="gpt-5.4-mini" onchange="tmUpdateAiModel(this.value)" style="width:220px;">`
                                : (provider === 'anthropic'
                                    ? `<input class="b3-text-field" type="text" value="${esc(model)}" placeholder="claude-sonnet-4-5" onchange="tmUpdateAiModel(this.value)" style="width:220px;">`
                                    : `<input class="b3-text-field" type="text" value="${esc(model)}" placeholder="MiniMax-M2.7-highspeed" onchange="tmUpdateAiModel(this.value)" style="width:220px;">`))
                    )}
                    ${provider === 'openai' ? '' : renderSingleFieldSetting(
                        '温度',
                        '数值越低越稳定，越高越发散。',
                        `<input class="b3-text-field" type="number" step="0.1" min="0" max="1.5" value="${temperature}" onchange="tmUpdateAiTemperature(this.value)" style="width:88px;">`
                    )}
                    ${renderSingleFieldSetting(
                        '最大输出 tokens',
                        '控制模型最大返回长度。',
                        `<input class="b3-text-field" type="number" min="256" max="8192" value="${maxTokens}" onchange="tmUpdateAiMaxTokens(this.value)" style="width:100px;">`
                    )}
                    ${renderSingleFieldSetting(
                        '超时时间',
                        'AI 请求超时时间，单位毫秒。',
                        `<input class="b3-text-field" type="number" min="5000" max="180000" value="${timeoutMs}" onchange="tmUpdateAiTimeoutMs(this.value)" style="width:100px;">
                         <span class="tm-setting-field-unit">ms</span>`
                    )}
                    ${renderSingleFieldSetting(
                        '默认上下文模式',
                        '邻近上下文更省 token，带全文更适合 SMART 分析。',
                        `<select class="b3-select" onchange="tmUpdateAiDefaultContextMode(this.value)" style="width:180px;">
                            <option value="nearby" ${contextMode === 'nearby' ? 'selected' : ''}>邻近上下文</option>
                            <option value="fulltext" ${contextMode === 'fulltext' ? 'selected' : ''}>带全文</option>
                        </select>`
                    )}
                    ${renderSingleFieldSetting(
                        '排期时间段',
                        '支持多段时间。每行一个时间段，例如 09:00-12:00 和 14:00-18:00，AI 排期只能落在这些时间段内。',
                        `<textarea class="b3-text-field" onchange="tmUpdateAiScheduleWindows(this.value)" style="width:260px;min-height:88px;resize:vertical;">${esc(scheduleWindows)}</textarea>`
                    )}
                    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
                        <button class="tm-btn tm-btn-secondary" onclick="tmAiTestConnection()">测试连接</button>
                    </div>
                </div>
            `;
        };

        state.settingsModal.innerHTML = `
            <div class="tm-settings-box" style="overflow: hidden;">
                <div class="tm-settings-layout">
                    <div class="tm-settings-sidebar">
                        ${settingsSearchEnabled ? __tmRenderSettingsSearchBox(activeTab) : ''}
                        <div class="tm-settings-tabs">
                            ${activeTab !== 'rule_editor' ? `
                            <button class="tm-settings-nav-btn ${activeTab === 'docs' ? 'is-active' : ''}" data-tm-action="tmSwitchSettingsTab" data-tab="docs">📂 文档分组</button>
                            <button class="tm-settings-nav-btn ${activeTab === 'main' ? 'is-active' : ''}" data-tm-action="tmSwitchSettingsTab" data-tab="main">🧩 常规设置</button>
                            <button class="tm-settings-nav-btn ${activeTab === 'appearance' ? 'is-active' : ''}" data-tm-action="tmSwitchSettingsTab" data-tab="appearance">🎨 外观</button>
                            <button class="tm-settings-nav-btn ${activeTab === 'calendar' ? 'is-active' : ''}" data-tm-action="tmSwitchSettingsTab" data-tab="calendar">🗓️ 日历</button>
                            <button class="tm-settings-nav-btn ${activeTab === 'ai' ? 'is-active' : ''}" data-tm-action="tmSwitchSettingsTab" data-tab="ai">🤖 AI</button>
                            <button class="tm-settings-nav-btn ${activeTab === 'rules' ? 'is-active' : ''}" data-tm-action="tmSwitchSettingsTab" data-tab="rules">📋 规则管理</button>
                            <button class="tm-settings-nav-btn ${activeTab === 'quadrant' ? 'is-active' : ''}" data-tm-action="tmSwitchSettingsTab" data-tab="quadrant">📊 四象限</button>
                            <button class="tm-settings-nav-btn ${activeTab === 'priority' ? 'is-active' : ''}" data-tm-action="tmSwitchSettingsTab" data-tab="priority">⚙️ 优先级算法</button>
                            <button class="tm-settings-nav-btn ${activeTab === 'about' ? 'is-active' : ''}" data-tm-action="tmSwitchSettingsTab" data-tab="about">ℹ️ 关于</button>
                            ` : `
                            <button class="tm-settings-nav-btn is-active">${state.editingRule ? '✏️ 编辑规则' : '🆕 新建规则'}</button>
                            `}
                        </div>
                        ${renderSettingsActions('tm-settings-actions--desktop')}
                    </div>
                    <div class="tm-settings-main">
                        <div class="tm-settings-content">
                    ${activeTab === 'appearance' ? `
                        <div class="tm-settings-panel tm-width-settings" ${__tmSettingsSearchAttrs('appearance', '列设置', '显示、排序、宽度和自定义列')}>
                            <div style="font-weight: 600; margin-bottom: 12px;">📏 列设置 (显示/排序/宽度)</div>
                            ${renderColumnWidthSettings()}
                            ${renderSingleFieldSetting(
                                '高级：内置字段属性名与迁移',
                                '自定义开始日期、截止日期、重要性、状态、完成时间等内置字段的属性名，并按字段选择是否迁移旧值。',
                                `<button class="tm-btn tm-btn-secondary" onclick="tmOpenTaskMetaAttrMigrationDialog()">打开高级设置</button>`,
                                { style: 'margin-top:12px;', section: 'columns', key: 'appearance-task-meta-attr-migration' }
                            )}
                        </div>
                        <div class="tm-settings-panel" ${__tmSettingsSearchAttrs('appearance', '页签栏', '归档入口位置')}>
                            <div style="font-weight: 600; margin-bottom: 12px;">📑 页签栏</div>
                            ${renderSingleFieldSetting(
                                '归档入口位置',
                                '控制页签栏里归档按钮显示在“全部”页签前，或保留在文档页签后。',
                                `<select class="b3-select" onchange="updateDocTabsArchiveButtonPosition(this.value)" style="width:180px;">
                                    <option value="before-all" ${String(SettingsStore.data.docTabsArchiveButtonPosition || '') === 'before-all' ? 'selected' : ''}>全部页签前左侧</option>
                                    <option value="after-docs" ${String(SettingsStore.data.docTabsArchiveButtonPosition || '') === 'before-all' ? '' : 'selected'}>文档页签后</option>
                                </select>`
                            )}
                        </div>
                        <div class="tm-settings-panel" style="margin-bottom:0;" ${__tmSettingsSearchAttrs('appearance', '配色', '调整主题、看板、时间轴和顶栏颜色')}>
                            <div style="font-weight: 600; margin-bottom: 12px;">🎨 配色</div>
                            ${renderAppearanceColorSettings()}
                        </div>
                    ` : ''}

                    ${activeTab === 'calendar' ? `
                        <div class="tm-settings-panel" style="margin-bottom:0;" ${__tmSettingsSearchAttrs('calendar', '日历', '日历视图与日程相关设置')}>
                            <div style="font-weight: 600; margin-bottom: 12px;">🗓️ 日历</div>
                            <div id="tm-calendar-settings-root"></div>
                        </div>
                    ` : ''}

                    ${activeTab === 'ai' ? renderAiSettingsPanel() : ''}

                    ${activeTab === 'rules' ? `
                        <div class="tm-settings-panel" ${__tmSettingsSearchAttrs('rules', '筛选规则管理', '新建、编辑、应用和删除筛选规则')}>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                <div style="font-weight: 600;">📋 筛选规则管理</div>
                                <div style="display:flex;gap:8px;align-items:center;">
                                    <button class="tm-btn tm-btn-secondary" data-tm-action="tmSwitchSettingsTab" data-tab="priority" style="padding: 4px 10px; font-size: 12px;">优先级算法</button>
                                    <button class="tm-btn tm-btn-primary" data-tm-action="addNewRule" style="padding: 4px 10px; font-size: 12px;">+ 新建规则</button>
                                </div>
                            </div>
                            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; border:1px solid var(--tm-border-color); border-radius:8px; background: var(--tm-card-bg); margin-bottom: 12px;">
                                <div style="font-size:13px; color: var(--tm-text-color);">时间轴强制按截止日期排序（越近今天越靠前）</div>
                                <input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.timelineForceSortByCompletionNearToday ? 'checked' : ''} onchange="tmToggleTimelineForceSortByCompletionNearToday(this.checked)">
                            </div>
                            <div id="tm-rules-list" style="display: flex; flex-direction: column; gap: 8px;">
                                ${renderRulesList()}
                            </div>
                            <div style="font-size: 12px; color: var(--tm-secondary-text); margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--tm-border-color);">
                                规则说明：支持多条件组合筛选，可设置“包含/不包含”关键词、“优先级”、“状态”等条件。
                            </div>
                        </div>
                    ` : ''}

                    ${activeTab === 'priority' ? `
                        <div class="tm-settings-panel" ${__tmSettingsSearchAttrs('priority', '优先级算法', '配置任务优先级评分权重和规则')}>
                            <div id="tm-priority-settings">
                                ${__tmRenderPriorityScoreSettings(true)}
                            </div>
                        </div>
                    ` : ''}

                    ${activeTab === 'about' ? `
                        ${__tmRenderAboutSettingsPanel()}
                    ` : ''}

                    ${activeTab === 'quadrant' ? `
                        <div class="tm-settings-panel" ${__tmSettingsSearchAttrs('quadrant', '四象限分组规则', '按重要性和截止日期自动分配象限')}>
                            <div style="font-weight: 600; margin-bottom: 12px;">📊 四象限分组规则</div>
                            <div style="font-size: 12px; color: var(--tm-secondary-text); margin-bottom: 12px;">
                                根据任务的「重要性」和「截止日期」自动将任务分配到四个象限。
                            </div>
                            ${renderQuadrantSettings()}
                        </div>
                    ` : ''}

                    ${activeTab === 'rule_editor' ? `
                        <div class="tm-rule-editor-inline">
                            ${state.editingRule ? RuleManager.renderEditorContent(state.editingRule) : ''}
                        </div>
                    ` : ''}

                    ${activeTab === 'main' ? `
                    ${renderMainSettingsSubtabs()}
                    ${(settingsSearchCurrentSection = 'display', '')}
                    <div class="tm-settings-panel" data-tm-settings-section="display">
                        <div class="tm-settings-section-title">🖥️ 基础显示</div>
                        <div class="tm-settings-section-desc">调整常规字号、行高和文本展示方式。</div>
                        ${renderSingleFieldSetting(
                            '字体大小',
                            '设置桌面端任务管理器的基础字号。',
                            `<input class="b3-text-field" type="number" value="${SettingsStore.data.fontSize}" min="10" max="30" onchange="updateFontSize(this.value)" style="width:88px;">
                             <span class="tm-setting-field-unit">px</span>`
                        )}
                        ${renderSingleFieldSetting(
                            '移动端字体',
                            '单独设置移动端字号，未设置时跟随桌面端。',
                            `<input class="b3-text-field" type="number" value="${SettingsStore.data.fontSizeMobile || SettingsStore.data.fontSize}" min="10" max="30" onchange="updateFontSizeMobile(this.value)" style="width:88px;">
                             <span class="tm-setting-field-unit">px</span>`
                        )}
                        ${renderSingleFieldSetting(
                            '行高模式',
                            '控制任务行整体密度。',
                            `<select class="b3-select" onchange="updateRowHeightMode(this.value)" style="width:180px;">
                                <option value="auto" ${String(SettingsStore.data.rowHeightMode || 'auto') === 'auto' ? 'selected' : ''}>自动</option>
                                <option value="compact" ${String(SettingsStore.data.rowHeightMode || '') === 'compact' ? 'selected' : ''}>紧凑</option>
                                <option value="normal" ${String(SettingsStore.data.rowHeightMode || '') === 'normal' ? 'selected' : ''}>标准</option>
                                <option value="comfortable" ${String(SettingsStore.data.rowHeightMode || '') === 'comfortable' ? 'selected' : ''}>宽松</option>
                            </select>`
                        )}
                        ${renderSingleFieldSetting(
                            '行高(px)',
                            '设置具体像素值，0 表示跟随行高模式。',
                            `<input class="b3-text-field" type="number" value="${Number(SettingsStore.data.rowHeightPx) || 0}" min="0" max="120" onchange="updateRowHeightPx(this.value)" style="width:88px;">
                             <span class="tm-setting-field-unit">(0=跟随)</span>`
                        )}
                        ${renderSingleSwitchSetting(
                            '父任务名称加粗',
                            '开启后父任务名称保持加粗显示；关闭后任务名称使用普通字重。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.parentTaskNameBoldEnabled !== false ? 'checked' : ''} onchange="updateParentTaskNameBoldEnabled(this.checked)">`
                        )}
                        ${renderSingleSwitchSetting(
                            '自动换行',
                            '任务内容、备注、看板和白板中的任务内容自动换行显示。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.taskAutoWrapEnabled !== false ? 'checked' : ''} onchange="updateTaskAutoWrapEnabled(this.checked)">`
                        )}
                        ${renderSingleFieldSetting(
                            '内容行数',
                            '限制任务内容最多显示的行数。',
                            `<input class="b3-text-field" type="number" value="${Math.max(1, Math.min(10, Number(SettingsStore.data.taskContentWrapMaxLines) || 3))}" min="1" max="10"
                                   ${SettingsStore.data.taskAutoWrapEnabled !== false ? '' : 'disabled'}
                                   onchange="updateTaskContentWrapMaxLines(this.value)" style="width:88px;opacity:${SettingsStore.data.taskAutoWrapEnabled !== false ? 1 : 0.6};">
                             <span class="tm-setting-field-unit">行</span>`,
                            { style: `opacity:${SettingsStore.data.taskAutoWrapEnabled !== false ? 1 : 0.6};` }
                        )}
                        ${renderSingleFieldSetting(
                            '备注行数',
                            '限制备注最多显示的行数。',
                            `<input class="b3-text-field" type="number" value="${Math.max(1, Math.min(10, Number(SettingsStore.data.taskRemarkWrapMaxLines) || 2))}" min="1" max="10"
                                   ${SettingsStore.data.taskAutoWrapEnabled !== false ? '' : 'disabled'}
                                   onchange="updateTaskRemarkWrapMaxLines(this.value)" style="width:88px;opacity:${SettingsStore.data.taskAutoWrapEnabled !== false ? 1 : 0.6};">
                             <span class="tm-setting-field-unit">行</span>`,
                            { style: `opacity:${SettingsStore.data.taskAutoWrapEnabled !== false ? 1 : 0.6};` }
                        )}
                        ${renderSingleFieldSetting(
                            '任务标题级别',
                            '控制任务标题在详情和部分视图中的语义级别。',
                            `<select class="b3-select" onchange="updateTaskHeadingLevel(this.value)" style="width:180px;">
                                <option value="h1" ${SettingsStore.data.taskHeadingLevel === 'h1' ? 'selected' : ''}>H1 一级标题</option>
                                <option value="h2" ${SettingsStore.data.taskHeadingLevel === 'h2' ? 'selected' : ''}>H2 二级标题</option>
                                <option value="h3" ${SettingsStore.data.taskHeadingLevel === 'h3' ? 'selected' : ''}>H3 三级标题</option>
                                <option value="h4" ${SettingsStore.data.taskHeadingLevel === 'h4' ? 'selected' : ''}>H4 四级标题</option>
                                <option value="h5" ${SettingsStore.data.taskHeadingLevel === 'h5' ? 'selected' : ''}>H5 五级标题</option>
                                <option value="h6" ${SettingsStore.data.taskHeadingLevel === 'h6' ? 'selected' : ''}>H6 六级标题</option>
                            </select>`
                        )}
                        ${renderSingleSwitchSetting(
                            '完成反馈',
                            '勾选完成后播放轻微动画并显示趣味提示；关闭后恢复为普通完成提示。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.taskDoneDelightEnabled !== false ? 'checked' : ''} onchange="updateTaskDoneDelightEnabled(this.checked)">`,
                            { style: 'margin-top:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            '文档名称显示',
                            '控制插件默认显示文档原名还是思源别名；当首选项为空时会自动回退到另一项。',
                            `<select class="b3-select" onchange="updateDocDisplayNameMode(this.value)" style="width:180px;">
                                <option value="name" ${__tmGetDocDisplayNameMode() === 'name' ? 'selected' : ''}>优先文档名</option>
                                <option value="alias" ${__tmGetDocDisplayNameMode() === 'alias' ? 'selected' : ''}>优先别名</option>
                            </select>`
                        )}
                    </div>

                    ${(settingsSearchCurrentSection = 'new-task', '')}
                    <div class="tm-settings-panel" data-tm-settings-section="new-task">
                        <div class="tm-settings-section-title">📍 新建任务位置</div>
                        <div class="tm-settings-section-desc">设置快速新建任务时默认写入的文档位置。</div>
                        ${renderSingleFieldSetting(
                            '默认新建文档',
                            '用于“快速新建任务界面”的默认文档位置，可在新建界面临时切换。',
                            `<select class="b3-select" onchange="updateNewTaskDocIdFromSelect(this.value)" style="width:100%;">
                                ${newTaskDocOptions.join('')}
                            </select>`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        <div style="display:flex; gap:8px; margin-top: 8px; align-items:center;">
                            <input id="tmNewTaskDocIdInput" class="b3-text-field" list="tmNewTaskDocIdList"
                                   value="${esc(newTaskDocId === '__dailyNote__' ? '' : (newTaskDocId || ''))}"
                                   placeholder="也可直接输入文档ID"
                                   style="flex: 1;">
                            <button class="tm-btn tm-btn-secondary" onclick="tmApplyNewTaskDocIdInput()" style="padding: 6px 10px; font-size: 12px;">应用</button>
                            <button class="tm-btn tm-btn-gray" onclick="tmClearNewTaskDocIdInput()" style="padding: 6px 10px; font-size: 12px;">清空</button>
                        </div>
                        <datalist id="tmNewTaskDocIdList">
                            ${allDocsForNewTask.map(docItem => {
                                const docId = typeof docItem === 'object' ? docItem.id : docItem;
                                const docName = resolveDocName(docId);
                                return `<option value="${docId}">${esc(docName)}</option>`;
                            }).join('')}
                            ${newTaskDocId && !allDocIdsForNewTask.includes(newTaskDocId) ? `<option value="${newTaskDocId}"></option>` : ''}
                        </datalist>
                        <div style="font-size: 12px; color: var(--tm-secondary-text); margin-top: 6px;">
                            也可以直接输入文档 ID，适合当前列表里没有加载出来的文档。
                        </div>
                        <div style="margin-top:10px;">
                            ${renderSingleFieldSetting(
                                '今天日记默认笔记本',
                                '当默认新建文档或快速新建目标选择“今天日记”时，优先在这里指定的笔记本下创建/写入今天日记；留空则继续跟随当前文档所属笔记本。',
                                `<select class="b3-select" onchange="updateNewTaskDailyNoteNotebookId(this.value)" style="width:100%;">
                                    ${dailyNoteNotebookOptions.join('')}
                                </select>`
                            )}
                        </div>
                        <div style="margin-top:10px;">
                            ${renderSingleSwitchSetting(
                                '启用“移动内容至今天日记”',
                                '开启后，在块图标菜单和正文右键菜单中显示该入口，可将当前块或所选块直接移动到今天日记；日记笔记本跟随上面的“今天日记默认笔记本”设置。',
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.enableMoveBlockToDailyNote ? 'checked' : ''} onchange="updateEnableMoveBlockToDailyNote(this.checked)">`
                            )}
                        </div>
                        <div style="margin-top:10px;">
                            ${renderSingleSwitchSetting(
                                '日记追加到底部',
                                '当目标为“今天日记”时（包括快速新建任务、移动内容至今天日记），内容追加到日记文档底部，而不是插入顶部。',
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.newTaskDailyNoteAppendToBottom ? 'checked' : ''} onchange="updateNewTaskDailyNoteAppendToBottom(this.checked)">`
                            )}
                        </div>
                        <div style="margin-top:10px;">
                            ${renderSingleSwitchSetting(
                                '标题分组追加到内容末尾',
                                '文档分组里的标题分组行点击“新建任务”时，插入到该标题内容末尾；若后面还存在任何下一个标题，则插入到那个标题前。',
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.headingGroupCreateAtSectionEnd ? 'checked' : ''} onchange="updateHeadingGroupCreateAtSectionEnd(this.checked)">`
                            )}
                        </div>
                        <div style="margin-top:10px;">
                            ${renderSingleSwitchSetting(
                                '新建任务默认置顶',
                                '快速新建任务时默认勾选“置顶”。',
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.pinNewTasksByDefault ? 'checked' : ''} onchange="updatePinNewTasksByDefault(this.checked)">`
                            )}
                        </div>
                        <div style="margin-top:10px;">
                        ${renderSingleFieldSetting(
                            '子任务继承父任务字段',
                            '新建子任务时，仅继承父任务中已经填写的字段。默认不继承任何字段。',
                            renderSettingsChipSetting('', '', [
                                __tmBuildSettingsChipGroup('字段', __TM_SUBTASK_INHERIT_FIELD_OPTIONS.concat(__tmBuildSettingsCustomFieldChipItems()), {
                                    selectedSet: new Set(__tmNormalizeSubtaskInheritedFields(SettingsStore.data.subtaskInheritedFields)),
                                    onToggle: (item) => `updateSubtaskInheritedField('${escSq(String(item?.key || '').trim())}', this.checked)`
                                })
                            ])
                        )}
                    </div>
                    </div>

                    ${(settingsSearchCurrentSection = 'status', '')}
                    <div class="tm-settings-panel" style="margin-bottom: 16px;" data-tm-settings-section="status">
                        <div class="tm-settings-section-title">🏷️ 状态选项</div>
                        <div class="tm-settings-section-desc">${SettingsStore.data.legacyWin7CompatMode ? '维护任务状态列表；兼容旧版 Win7 思源时，任务方括号内仅使用空格和 X，未完成状态统一写为空格，已完成状态写为 X。' : '维护任务状态列表；marker 会写入任务 <code>- [ ]</code> 的方括号中，空格表示未完成，其他字符会被思源视为已勾选。'}</div>
                        ${renderSingleFieldSetting(
                            '勾选完成时状态',
                            '任务复选框被勾选为完成时，自动切换到这里设置的状态；可选择“不自动切换”。',
                            `<select class="b3-select" onchange="updateCheckboxStatusBinding('done', this.value)" style="width:180px;">
                                ${__tmRenderCheckboxStatusBindingOptionsHtml(SettingsStore.data.checkboxDoneStatusId)}
                            </select>`,
                            { style: 'margin-bottom:8px;' }
                        )}
                        ${renderSingleFieldSetting(
                            '未完成状态默认状态',
                            '未完成任务在取消勾选回退、快速新建默认状态、以及空状态显示回退时，统一使用这里设置的状态。',
                            `<select class="b3-select" onchange="updateCheckboxStatusBinding('undone', this.value)" style="width:180px;">
                                ${__tmRenderCheckboxStatusBindingOptionsHtml(SettingsStore.data.checkboxUndoneStatusId, { allowNone: false })}
                            </select>`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        <div id="tm-status-options-list">
                            ${renderStatusOptionsList()}
                        </div>
                        <button class="tm-btn tm-btn-primary" data-tm-action="addStatusOption" style="margin-top: 8px; font-size: 12px;">+ 添加状态</button>
                    </div>

                    ${(settingsSearchCurrentSection = 'layout', '')}
                    <div class="tm-settings-panel" data-tm-settings-section="layout">
                        <div class="tm-settings-section-title">🪟 视图与布局</div>
                        <div class="tm-settings-section-desc">控制默认视图、紧凑模式和各类展示布局。</div>
                        ${renderSingleFieldSetting(
                            '默认视图',
                            '桌面端首次打开任务管理器时默认进入的视图。',
                            `<select class="b3-select" onchange="updateDefaultViewMode(this.value)" style="width:180px;">
                                ${__tmGetEnabledViews().map((viewId) => {
                                    const view = __TM_ALL_VIEWS.find(v => v.id === viewId);
                                    return view ? `<option value="${view.id}" ${String(__tmGetSafeViewMode(SettingsStore.data.defaultViewMode || 'checklist')) === view.id ? 'selected' : ''}>${view.longLabel}</option>` : '';
                                }).join('')}
                            </select>`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            '移动端默认',
                            '移动端首次打开时使用的默认视图。',
                            `<select class="b3-select" onchange="updateDefaultViewModeMobile(this.value)" style="width:180px;">
                                ${__tmGetEnabledViews().map((viewId) => {
                                    const view = __TM_ALL_VIEWS.find(v => v.id === viewId);
                                    return view ? `<option value="${view.id}" ${String(__tmGetSafeViewMode(SettingsStore.data.defaultViewModeMobile || SettingsStore.data.defaultViewMode || 'checklist')) === view.id ? 'selected' : ''}>${view.longLabel}</option>` : '';
                                }).join('')}
                            </select>`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            '自动隐藏页签栏',
                            '开启后文档页签栏默认收起；桌面端和 Dock 鼠标移入顶栏展开，移出顶栏和页签区域收起；移动端支持轻触、下滑展开，上滑或点击外部区域收起。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.docTabsAutoHideEnabled ? 'checked' : ''} onchange="updateDocTabsAutoHideEnabled(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            '页签拖延值上色',
                            '开启后文档页签会按拖延值轻微染红；关闭后只取消页签背景上色，不影响主页拖延值和页签提示。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.docTabProcrastinationTintEnabled !== false ? 'checked' : ''} onchange="updateDocTabProcrastinationTintEnabled(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${!__tmIsRuntimeMobileClient() ? `
                        ${renderSingleSwitchSetting(
                            '启用 Dock 侧边栏',
                            '桌面端新增一个类似番茄钟的任务 Dock，界面跟随手机端布局。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.dockSidebarEnabled !== false ? 'checked' : ''} onchange="updateDockSidebarEnabled(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        <div style="margin-bottom:10px;opacity:${SettingsStore.data.dockSidebarEnabled !== false ? 1 : 0.6};">
                            ${renderSingleFieldSetting(
                                'Dock 默认视图',
                                '仅用于任务 Dock 侧边栏，默认跟随移动端默认视图。',
                                `<select class="b3-select" onchange="updateDockDefaultViewMode(this.value)" ${SettingsStore.data.dockSidebarEnabled !== false ? '' : 'disabled'} style="width:180px;">
                                    <option value="follow-mobile" ${__tmGetDockDefaultViewValue() === 'follow-mobile' ? 'selected' : ''}>跟随移动端默认</option>
                                    ${__tmGetEnabledViews().map((viewId) => {
                                        const view = __TM_ALL_VIEWS.find(v => v.id === viewId);
                                        return view ? `<option value="${view.id}" ${__tmGetDockDefaultViewValue() === view.id ? 'selected' : ''}>${view.longLabel}</option>` : '';
                                    }).join('')}
                                </select>`
                            )}
                        </div>
                        ${renderSingleSwitchSetting(
                            'Dock 紧凑标题点击跳转',
                            '桌面端 Dock 清单紧凑视图中，开启后点击任务名默认跳转文档；若开启下方“标题点击弹出详情页面”则改为打开 Dock 内任务详情抽屉。关闭后保持打开任务详情抽屉。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.dockChecklistCompactTitleJump ? 'checked' : ''} ${SettingsStore.data.dockSidebarEnabled !== false ? '' : 'disabled'} onchange="updateDockChecklistCompactTitleJump(this.checked)">`,
                            { style: `margin-bottom:10px;opacity:${SettingsStore.data.dockSidebarEnabled !== false ? 1 : 0.6};` }
                        )}
                        ${renderSingleSwitchSetting(
                            '移动端清单紧凑视图标题点击跳转',
                            '移动端清单紧凑视图中，开启后点击任务名默认跳转文档；若开启下方“标题点击弹出详情页面”则改为弹出详情页面。关闭后保持打开任务详情抽屉。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.mobileChecklistCompactTitleJump ? 'checked' : ''} onchange="updateMobileChecklistCompactTitleJump(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ` : ''}
                        <div style="margin-bottom:10px;">
                            ${renderSingleFieldSetting(
                                'Dock 及移动端紧凑右侧字段',
                                '控制 Dock 侧边栏、移动端清单紧凑视图，以及日历视图侧边栏任务清单里任务右侧显示哪些信息。默认显示截止日期和状态标签。',
                                (() => {
                                    const selected = new Set(__tmNormalizeCompactChecklistMetaFields(SettingsStore.data.dockChecklistCompactMetaFields));
                                    const customFieldOptions = __tmGetCustomFieldDefs()
                                        .filter((field) => String(field?.id || '').trim() && field?.enabled !== false && String(field?.type || '').trim() !== 'text')
                                        .map((field) => __tmBuildSettingsCustomFieldChipItem(field))
                                        .filter((item) => item && __tmParseCustomFieldColumnKey(item.key));
                                    const options = __TM_CHECKLIST_COMPACT_META_FIELD_OPTIONS.concat(customFieldOptions);
                                return renderSettingsChipSetting('', '', [
                                    __tmBuildSettingsChipGroup('字段', options, {
                                        selectedSet: selected,
                                        onToggle: (item) => `updateChecklistCompactMetaFieldVisibility('dock', '${escSq(String(item?.key || '').trim())}', this.checked)`
                                    })
                                ]);
                            })()
                            )}
                        </div>
                        ${renderSingleFieldSetting(
                            '桌面端紧凑右侧字段',
                            '控制桌面端清单紧凑视图里任务右侧显示哪些信息。默认显示截止日期和状态标签，文档名仅在全部页签下显示。',
                            (() => {
                                const selected = new Set(__tmNormalizeCompactChecklistMetaFields(SettingsStore.data.desktopChecklistCompactMetaFields));
                                    const customFieldOptions = __tmGetCustomFieldDefs()
                                        .filter((field) => String(field?.id || '').trim() && field?.enabled !== false && String(field?.type || '').trim() !== 'text')
                                        .map((field) => __tmBuildSettingsCustomFieldChipItem(field))
                                        .filter((item) => item && __tmParseCustomFieldColumnKey(item.key));
                                const options = __TM_CHECKLIST_COMPACT_META_FIELD_OPTIONS.concat(customFieldOptions);
                                return renderSettingsChipSetting('', '', [
                                    __tmBuildSettingsChipGroup('字段', options, {
                                        selectedSet: selected,
                                        onToggle: (item) => `updateChecklistCompactMetaFieldVisibility('desktop', '${escSq(String(item?.key || '').trim())}', this.checked)`
                                    })
                                ]);
                            })(),
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            '紧凑右侧字体',
                            '控制清单紧凑视图右侧字段的字体大小，状态标签会随之一起缩放。',
                            `<select class="b3-select" onchange="updateChecklistCompactRightFontSize(this.value)" style="width:140px;">
                                ${__TM_CHECKLIST_COMPACT_RIGHT_FONT_SIZE_OPTIONS.map((item) => `<option value="${item.key}" ${__tmGetChecklistCompactRightFontSize() === item.key ? 'selected' : ''}>${item.label}</option>`).join('')}
                            </select>`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            '时间轴卡片字段',
                            '控制时间轴卡片显示任务名称、状态标签和完成时间。完成时间仅在已完成且有记录时显示；所有字段关闭时，前导图标会自动隐藏。',
                            (() => {
                                const selected = new Set(__tmNormalizeTimelineCardFields(SettingsStore.data.timelineCardFields));
                                return renderSettingsChipSetting('', '', [
                                    __tmBuildSettingsChipGroup('字段', __TM_TIMELINE_CARD_FIELD_OPTIONS, {
                                        selectedSet: selected,
                                        onToggle: (item) => `updateTimelineCardFieldVisibility('${escSq(String(item?.key || '').trim())}', this.checked)`
                                    })
                                ]);
                            })(),
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            '标题点击弹出详情页面',
                            '适用于各视图的任务标题点击。开启后标题默认打开任务详情页面；在移动端/Dock 清单紧凑视图中，仍低于上方两个“标题点击跳转”开关，仅在原本允许标题点击跳转时才会生效；其中 Dock 紧凑视图会改为打开抽屉详情。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.checklistCompactTitleOpenDetailPage ? 'checked' : ''} onchange="updateChecklistCompactTitleOpenDetailPage(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        <div style="margin-bottom:10px;">
                            ${renderSettingsChipSetting('', '', [
                                __tmBuildSettingsChipGroup('显示视图', __TM_ALL_VIEWS.map((view) => {
                                    const enabledViews = __tmGetEnabledViews();
                                    const checked = enabledViews.includes(view.id);
                                    const disabled = checked && enabledViews.length <= 1;
                                    return {
                                        key: view.id,
                                        label: view.longLabel,
                                        disabled,
                                        title: view.longLabel
                                    };
                                }), {
                                    selectedSet: new Set(__tmGetEnabledViews()),
                                    onToggle: (item) => `updateEnabledView('${escSq(String(item?.key || '').trim())}', this.checked)`
                                })
                            ])}
                            <div style="font-size:12px;color:var(--tm-secondary-text);margin-top:6px;">顶栏和移动端视图切换会同步隐藏这里关闭的视图，至少保留一个。</div>
                        </div>
                        ${renderSingleSwitchSetting(
                            '看板紧凑模式',
                            '更窄更矮，显示更多卡片。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.kanbanCompactMode ? 'checked' : ''} onchange="updateKanbanCompactMode(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            '清单紧凑模式',
                            '单行任务，右侧显示文档和截止日期。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.checklistCompactMode ? 'checked' : ''} onchange="updateChecklistCompactMode(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            '清单紧凑层级线',
                            '开启后在清单紧凑模式中显示子任务层级竖线。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.checklistCompactTreeGuides ? 'checked' : ''} onchange="updateChecklistCompactTreeGuides(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            '看板宽度',
                            '调整看板列宽，适合不同信息密度。',
                            `<input type="range" min="220" max="520" step="10" value="${Number(SettingsStore.data.kanbanColumnWidth) || 320}" onchange="updateKanbanColumnWidth(this.value)" style="max-width:180px;">
                             <span class="tm-setting-field-unit" style="min-width:52px;text-align:right;">${Math.max(220, Math.min(520, Number(SettingsStore.data.kanbanColumnWidth) || 320))}px</span>`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            '表格和看板宽度填满窗口',
                            '窗口宽于所有表格列或看板列总宽时，按当前列宽比例自动拉伸填满；窗口较窄时仍保持固定列宽横向滚动。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.kanbanFillColumns ? 'checked' : ''} onchange="updateKanbanFillColumns(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            '看板卡片字段',
                            '控制看板卡片中显示哪些任务字段。',
                            (() => {
                                const selected = new Set(__tmGetTaskCardFieldList('kanban'));
                                return renderSettingsChipSetting('', '', [
                                    __tmBuildSettingsChipGroup('字段', __TM_TASK_CARD_FIELD_OPTIONS, {
                                        selectedSet: selected,
                                        onToggle: (item) => `updateTaskCardFieldVisibility('kanban', '${escSq(String(item?.key || '').trim())}', this.checked)`
                                    })
                                ]);
                            })(),
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            '白板卡片字段',
                            '控制白板卡片中显示哪些任务字段。',
                            (() => {
                                const selected = new Set(__tmGetTaskCardFieldList('whiteboard'));
                                return renderSettingsChipSetting('', '', [
                                    __tmBuildSettingsChipGroup('字段', __TM_TASK_CARD_FIELD_OPTIONS, {
                                        selectedSet: selected,
                                        onToggle: (item) => `updateTaskCardFieldVisibility('whiteboard', '${escSq(String(item?.key || '').trim())}', this.checked)`
                                    })
                                ]);
                            })(),
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            '卡片字段常驻显示',
                            '控制看板和白板卡片中的空值或默认字段是否也固定展示。',
                            (() => {
                                const selected = new Set(__tmGetTaskCardAlwaysShowFieldList());
                                return renderSettingsChipSetting('', '', [
                                    __tmBuildSettingsChipGroup('常驻字段', __TM_TASK_CARD_ALWAYS_SHOW_FIELD_OPTIONS, {
                                        selectedSet: selected,
                                        onToggle: (item) => `updateTaskCardAlwaysShowField('${escSq(String(item?.key || '').trim())}', this.checked)`
                                    })
                                ]);
                            })(),
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            '卡片流最小宽度',
                            '用于白板“全部页签”的卡片流。会按最小宽度自动在 1 到 4 栏之间切换。',
                            `<input type="range" min="220" max="520" step="10" value="${Number(SettingsStore.data.whiteboardAllTabsCardMinWidth) || 320}" onchange="updateWhiteboardAllTabsCardMinWidth(this.value)" style="max-width:180px;">
                             <span class="tm-setting-field-unit" style="min-width:52px;text-align:right;">${Math.max(220, Math.min(520, Number(SettingsStore.data.whiteboardAllTabsCardMinWidth) || 320))}px</span>`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            '移动端卡片流双栏',
                            '用于白板“全部页签”的卡片流。关闭后移动端改为单栏显示，默认开启。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.whiteboardStreamMobileTwoColumns !== false ? 'checked' : ''} onchange="updateWhiteboardStreamMobileTwoColumns(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            '显示已完成任务看板',
                            '仅在标题看板中显示“已完成”看板列。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.kanbanShowDoneColumn ? 'checked' : ''} onchange="updateKanbanShowDoneColumn(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            '看板拖动父任务时同步更改子任务状态',
                            '拖动父任务切换状态时，子任务同步更新。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.kanbanDragSyncSubtasks ? 'checked' : ''} onchange="updateKanbanDragSyncSubtasks(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            '看板内子任务不与父任务分离',
                            '开启后子任务始终跟随父任务显示，状态、日期、标题或完成列不同也不会单独拆出。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.kanbanPreventSubtaskSeparation ? 'checked' : ''} onchange="updateKanbanPreventSubtaskSeparation(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            '时长显示格式',
                            '控制耗时和番茄累计时间的展示形式。',
                            `<select class="b3-select" onchange="updateDurationFormat(this.value)" style="width:180px;">
                                <option value="hours" ${String(SettingsStore.data.durationFormat || 'hours') === 'hours' ? 'selected' : ''}>小时 (如 1.5h)</option>
                                <option value="minutes" ${String(SettingsStore.data.durationFormat || '') === 'minutes' ? 'selected' : ''}>分钟 (如 90min)</option>
                            </select>`
                        )}
                        <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--tm-border-color);">
                            <div style="font-size:13px;font-weight:600;margin-bottom:6px;">时长预设</div>
                            <div style="font-size:12px;color:var(--tm-secondary-text);margin-bottom:10px;">用于任务详情、悬浮条和表格视图的时长快捷选择。仍支持直接填写自定义数值；如果这里不添加任何预设，就继续使用当前的自由输入方式。预设里即使写了 h、min 等字符，也只会取数字部分。</div>
                            <div id="tm-duration-options-list">
                                ${renderDurationOptionsList()}
                            </div>
                            <button class="tm-btn tm-btn-primary" data-tm-action="addDurationOption" style="margin-top: 8px; font-size: 12px;">+ 添加时长预设</button>
                        </div>
                        <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--tm-border-color);opacity:${SettingsStore.data.enableTomatoIntegration ? 1 : 0.6};">
                            <div style="font-size:13px;font-weight:600;margin-bottom:6px;">时长与番茄属性</div>
                            <div style="font-size:12px;color:var(--tm-secondary-text);margin-bottom:10px;">用于“时长与番茄”弹窗、专注列和常驻字段。实际番茄由 Dock Tomato 完成一次倒计时后累计 1。</div>
                            ${renderSingleFieldSetting(
                                '实际番茄数属性名',
                                'Dock Tomato 单次完成累计 1 个番茄，例如 custom-tomato-count。',
                                `<input class="b3-text-field" type="text" value="${esc(String(SettingsStore.data.tomatoCountAttrKey || 'custom-tomato-count'))}" ${SettingsStore.data.enableTomatoIntegration ? '' : 'disabled'} onchange="updateTomatoCountAttrKey(this.value)" style="width:100%;">`,
                                { style: 'margin-bottom:10px;' }
                            )}
                            ${renderSingleFieldSetting(
                                '预计番茄数属性名',
                                '用于给任务填写预计番茄数量，例如 custom-tomato-estimate-count。',
                                `<input class="b3-text-field" type="text" value="${esc(String(SettingsStore.data.tomatoEstimateAttrKey || 'custom-tomato-estimate-count'))}" ${SettingsStore.data.enableTomatoIntegration ? '' : 'disabled'} onchange="updateTomatoEstimateAttrKey(this.value)" style="width:100%;">`
                            )}
                        </div>
                    </div>

                    ${(settingsSearchCurrentSection = 'search', '')}
                    <div class="tm-settings-panel" data-tm-settings-section="search">
                        <div class="tm-settings-section-title">🔎 搜索与分组</div>
                        <div class="tm-settings-section-desc">任务检索由本地索引、快照和增量刷新自动优化；这里仅控制文档范围与分组行为。</div>
                        ${renderSingleFieldSetting(
                            '递归文档数上限',
                            '仅用于“包含子文档”和笔记本分组时展开文档范围。数值越大，递归扫描文档越多，内存和查询压力也越大。',
                            `<input class="b3-text-field" type="number" value="${state.recursiveDocLimit}" onchange="updateRecursiveDocLimit(this.value)" style="width:96px;">
                             <span class="tm-setting-field-unit">个文档</span>`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            '兼容旧版 Win7 思源',
                            '默认关闭。仅在 win7-dev1 等旧版内核中开启，3.6.4 以前版本思源请打开此开关；开启后使用旧版任务块 SQL 和旧版可用的任务状态更新方式。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.legacyWin7CompatMode ? 'checked' : ''} onchange="updateLegacyWin7CompatMode(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            '父任务回溯层数',
                            '识别子任务时，从任务所在父级向上查找最近的任务块。夹在普通列表、无序列表里的任务可适当调大；0 表示不做额外回溯。',
                            `<input class="b3-text-field" type="number" min="0" max="${TM_TASK_PARENT_LOOKUP_DEPTH_MAX}" value="${__tmNormalizeTaskParentLookupDepth(SettingsStore.data.taskParentLookupDepth)}" onchange="updateTaskParentLookupDepth(this.value)" style="width:96px;">
                             <span class="tm-setting-field-unit">层</span>`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            '显示已完成任务',
                            '关闭时仅在视图中隐藏已完成任务；任务仍会进入本地索引，可随时重新显示。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${__tmGetShowCompletedTasksFromSettings(SettingsStore.data) ? 'checked' : ''} onchange="updateShowCompletedTasks(this.checked)">`
                        )}
                        <div style="font-size: 12px; color: var(--tm-secondary-text); margin-top: 6px; margin-bottom: 12px;">
                            默认关闭以保持日常列表清爽。打开后默认显示索引中的全部已完成任务；若开启下方限制，则仅显示今天完成。
                            <br>规则设置中将「完成状态」设为「所有状态」或「是」时，也会显示对应已完成任务。
                        </div>
                        ${renderSingleSwitchSetting(
                            '已完成分组仅显示今天完成',
                            '开启后，“已完成任务”尾部分组只保留完成日期为今天的任务；任务标题旁仍会用“今天”标签标识今天完成的任务。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.completedTasksTodayOnly ? 'checked' : ''} onchange="updateCompletedTasksTodayOnly(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            '已完成任务不单独分组',
                            '开启后，已完成任务跟随当前文档、时间、四象限或任务名分组显示，不再统一放入尾部“已完成任务”分组。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.completedTasksInlineInGroups ? 'checked' : ''} onchange="updateCompletedTasksInlineInGroups(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            '文档分组下按二级标题子分组',
                            '用于时间轴、表格、文档流和日历侧边栏。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.docH2SubgroupEnabled !== false ? 'checked' : ''} onchange="updateDocH2SubgroupEnabled(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            '分组模式增加“按任务名分组”',
                            '开启后，顶部“分组”下拉里会出现“按任务名”选项，用于把相同任务内容分为一组。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.groupByTaskName || SettingsStore.data.groupMode === 'task' ? 'checked' : ''} onchange="updateGroupByTaskName(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            '分组内置顶任务',
                            '开启后，表格和清单视图在按文档、时间、四象限或任务名分组时，置顶任务留在所属分组内并排在组内最前。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.pinTasksWithinGroups ? 'checked' : ''} onchange="updatePinTasksWithinGroups(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            '自动识别语义日期（全量分批）',
                            '开启后，刷新任务后会分批扫描全部任务里的“明天/下周五/今晚8点/从明天到周五”等表达，并弹窗确认写入开始日期或截止日期。默认开启，如需避免同步后自动弹窗可关闭。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.semanticDateAutoPromptEnabled ? 'checked' : ''} onchange="updateSemanticDateAutoPromptEnabled(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            '父任务按子任务时间参与时间相关排序',
                            '按时间/四象限分组，以及截止日期、优先级数值排序时：已过期远 > 已过期近 > 未过期近 > 未过期远。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.groupSortByBestSubtaskTimeInTimeQuadrant ? 'checked' : ''} onchange="updateGroupSortByBestSubtaskTimeInTimeQuadrant(this.checked)">`
                        )}
                        ${renderSingleSwitchSetting(
                            '全部折叠展开包含分组',
                            '开启后，顶部和右上角菜单里的“全部折叠/展开”会连同当前视图里的分组一起处理。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.collapseAllIncludesGroups ? 'checked' : ''} onchange="updateCollapseAllIncludesGroups(this.checked)">`,
                            { style: 'margin-top:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            '手动刷新时同步伺服共享设置',
                            '默认关闭。开启后点击顶部刷新按钮时，会额外从伺服重载共享设置、任务补充元数据、白板数据和语义识别记录；平时不做后台轮询，不增加常驻性能开销。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.serverSyncOnManualRefresh ? 'checked' : ''} onchange="updateServerSyncOnManualRefresh(this.checked)">`,
                            { style: 'margin-top:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            '手动刷新时同步当前分组/规则等会话状态',
                            '默认关闭。仅在上方开关开启时生效。开启后，手动刷新会一并套用另一端保存的当前分组、当前规则、折叠状态等会话类状态；关闭则保留本端当前界面上下文。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.serverSyncSessionStateOnManualRefresh ? 'checked' : ''} ${SettingsStore.data.serverSyncOnManualRefresh ? '' : 'disabled'} onchange="updateServerSyncSessionStateOnManualRefresh(this.checked)">`,
                            { style: `margin-top:10px;opacity:${SettingsStore.data.serverSyncOnManualRefresh ? 1 : 0.6};` }
                        )}
                    </div>

                    ${(settingsSearchCurrentSection = 'topbar', '')}
                    <div class="tm-settings-panel" data-tm-settings-section="topbar">
                        <div class="tm-settings-section-title">🔘 顶栏入口</div>
                        <div class="tm-settings-section-desc">分别控制文档顶栏按钮与思源窗口顶栏图标在桌面端、移动端的显示。</div>
                        ${renderSingleSwitchSetting(
                            '文档顶栏按钮(桌面)',
                            '控制桌面端文档顶栏中的任务管理按钮。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.docTopbarButtonDesktop !== false ? 'checked' : ''} onchange="updateDocTopbarButtonDesktop(this.checked)">`
                        )}
                        ${renderSingleSwitchSetting(
                            '文档顶栏按钮(移动)',
                            '控制移动端文档顶栏中的任务管理按钮。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.docTopbarButtonMobile !== false ? 'checked' : ''} onchange="updateDocTopbarButtonMobile(this.checked)">`
                        )}
                        ${renderSingleSwitchSetting(
                            '对调文档顶栏长短按',
                            '开启后，文档顶栏插件按钮会改为短按打开任务管理器，长按快速新建任务；默认关闭。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.docTopbarButtonSwapPressActions ? 'checked' : ''} onchange="updateDocTopbarButtonSwapPressActions(this.checked)">`
                        )}
                        ${renderSingleSwitchSetting(
                            '打开时定位当前文档',
                            '开启后，文档顶栏按钮在执行“打开任务管理器”时，会优先跳转到当前文档所在分组并切到该文档页签；若当前文档没有任务块或未加入分组，则保持原行为。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.docTopbarButtonLocateCurrentDocTab ? 'checked' : ''} onchange="updateDocTopbarButtonLocateCurrentDocTab(this.checked)">`
                        )}
                        ${renderSingleSwitchSetting(
                            '思源窗口顶栏图标(桌面)',
                            '控制桌面端思源窗口顶栏中的任务管理入口。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.windowTopbarIconDesktop !== false ? 'checked' : ''} onchange="updateWindowTopbarIconDesktop(this.checked)">`
                        )}
                        ${renderSingleSwitchSetting(
                            '思源窗口顶栏图标(移动)',
                            '控制移动端思源窗口顶栏中的任务管理入口；在移动端会出现在右侧抽屉菜单中。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.windowTopbarIconMobile !== false ? 'checked' : ''} onchange="updateWindowTopbarIconMobile(this.checked)">`
                        )}
                    </div>

                    ${(settingsSearchCurrentSection = 'quickbar', '')}
                    <div class="tm-settings-panel" data-tm-settings-section="quickbar">
                        <div class="tm-settings-section-title">🧷 任务悬浮条</div>
                        <div class="tm-settings-section-desc">控制任务块点击后的悬浮条与任务行末尾常驻字段显示。</div>
                        ${renderSingleSwitchSetting(
                            '启用任务悬浮条',
                            '点击任务块显示自定义字段。关闭后将不再弹出悬浮条，也不会拦截点击/长按事件。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.enableQuickbar ? 'checked' : ''} onchange="updateEnableQuickbar(this.checked)">`
                        )}
                        ${renderSingleSwitchSetting(
                            '文档任务行末尾常驻显示',
                            '在笔记中的任务行尾部常驻显示选定字段，点击后可直接编辑。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.enableQuickbarInlineMeta ? 'checked' : ''} onchange="updateEnableQuickbarInlineMeta(this.checked)">`,
                            { style: 'margin-top:8px;' }
                        )}
                        <div style="margin-top:10px;opacity:${SettingsStore.data.enableQuickbar ? 1 : 0.6};">
                            ${renderSingleFieldSetting(
                                '悬浮条显示图标',
                                '控制任务悬浮条里显示哪些字段和动作图标；取消勾选后对应按钮会隐藏。',
                                renderSettingsChipSetting('', '', [
                                    __tmBuildSettingsChipGroup('字段', [
                                        { key: 'custom-status', label: '状态' },
                                        { key: 'custom-priority', label: '重要性' },
                                        { key: 'custom-start-date', label: '开始日期' },
                                        { key: 'custom-completion-time', label: '截止日期' },
                                        { key: 'taskCompleteAt', label: '完成时间' },
                                        { key: 'custom-focus-summary', label: '专注/耗时' },
                                        { key: 'custom-remark', label: '备注' },
                                        ...__tmBuildSettingsCustomFieldChipItems(),
                                    ], {
                                        selectedSet: new Set((SettingsStore.data.quickbarVisibleItems || []).map((value) => String(value || '').trim()).filter(Boolean)),
                                        disabled: !SettingsStore.data.enableQuickbar,
                                        onToggle: (item) => `updateQuickbarVisibleItem('${escSq(String(item?.key || '').trim())}', this.checked)`
                                    }),
                                    __tmBuildSettingsChipGroup('动作', [
                                        { key: 'action-ai-title', label: 'AI 优化' },
                                        { key: 'action-reminder', label: '提醒' },
                                        { key: 'action-more', label: '更多' }
                                    ], {
                                        selectedSet: new Set((SettingsStore.data.quickbarVisibleItems || []).map((value) => String(value || '').trim()).filter(Boolean)),
                                        disabled: !SettingsStore.data.enableQuickbar,
                                        onToggle: (item) => `updateQuickbarVisibleItem('${escSq(String(item?.key || '').trim())}', this.checked)`
                                    })
                                ]),
                                { style: 'margin-top:8px;margin-bottom:10px;' }
                            )}
                        </div>
                        <div style="margin-top:10px;opacity:${SettingsStore.data.enableQuickbarInlineMeta ? 1 : 0.6};">
                            ${renderSingleFieldSetting(
                                '常驻显示字段',
                                '默认显示状态和截止日期，字段越多越容易挤占任务正文空间。',
                                renderSettingsChipSetting('', '', [
                                    __tmBuildSettingsChipGroup('字段', [
                                        { key: 'subtask-count', label: '子任务数量' },
                                        { key: 'custom-status', label: '状态' },
                                        { key: 'custom-completion-time', label: '截止日期' },
                                        { key: 'taskCompleteAt', label: '完成时间' },
                                        { key: 'custom-priority', label: '重要性' },
                                        { key: 'custom-start-date', label: '开始日期' },
                                        { key: 'custom-focus-summary', label: '专注/耗时' },
                                        { key: 'custom-remark', label: '备注' },
                                        ...__tmBuildSettingsCustomFieldChipItems()
                                    ], {
                                        selectedSet: new Set((SettingsStore.data.quickbarInlineFields || []).map((value) => String(value || '').trim()).filter(Boolean)),
                                        disabled: !SettingsStore.data.enableQuickbarInlineMeta,
                                        onToggle: (item) => `updateQuickbarInlineField('${escSq(String(item?.key || '').trim())}', this.checked)`
                                    })
                                ]),
                                { style: 'margin-bottom:10px;' }
                            )}
                            ${renderSingleSwitchSetting(
                                '子任务数量显示未完成数',
                                '开启后，子任务数量常驻标签显示未完成子任务数量；关闭时显示已完成/总数。',
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.quickbarSubtaskCountUnfinishedOnly ? 'checked' : ''} ${SettingsStore.data.enableQuickbarInlineMeta ? '' : 'disabled'} onchange="updateQuickbarSubtaskCountUnfinishedOnly(this.checked)">`
                            )}
                            ${renderSingleSwitchSetting(
                                '移动端启用常驻显示',
                                '移动端屏幕较窄，关闭时仅保留原悬浮条交互。',
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.quickbarInlineShowOnMobile ? 'checked' : ''} ${SettingsStore.data.enableQuickbarInlineMeta ? '' : 'disabled'} onchange="updateQuickbarInlineShowOnMobile(this.checked)">`
                            )}
                        </div>
                    </div>

                    ${(settingsSearchCurrentSection = 'tomato', '')}
                    <div class="tm-settings-panel" data-tm-settings-section="tomato">
                        <div class="tm-settings-section-title">🍅 番茄钟与插件联动</div>
                        <div class="tm-settings-section-desc">管理底栏番茄钟、任务耗时属性，以及其他插件的任务完成联动。</div>
                        ${renderSingleSwitchSetting(
                            '启用底栏番茄钟相关功能',
                            '包含计时、提醒和耗时列。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.enableTomatoIntegration ? 'checked' : ''} onchange="updateEnableTomatoIntegration(this.checked)">`
                        )}
                        <div style="margin-top:10px;opacity:${SettingsStore.data.enableTomatoIntegration ? 1 : 0.6};">
                            ${renderSingleFieldSetting(
                                '耗时读取模式',
                                '选择从分钟属性还是小时属性读取任务耗时。',
                                `<select class="b3-select" onchange="updateTomatoSpentAttrMode(this.value)" ${SettingsStore.data.enableTomatoIntegration ? '' : 'disabled'} style="width:180px;">
                                    <option value="minutes" ${String(SettingsStore.data.tomatoSpentAttrMode || 'minutes') === 'minutes' ? 'selected' : ''}>分钟属性</option>
                                    <option value="hours" ${String(SettingsStore.data.tomatoSpentAttrMode || '') === 'hours' ? 'selected' : ''}>小时属性</option>
                                </select>`,
                                { style: 'margin-bottom:10px;' }
                            )}
                            ${renderSingleFieldSetting(
                                '分钟属性名',
                                '思源区块属性名，例如 custom-tomato-minutes。',
                                `<input class="b3-text-field" type="text" value="${esc(String(SettingsStore.data.tomatoSpentAttrKeyMinutes || 'custom-tomato-minutes'))}" ${SettingsStore.data.enableTomatoIntegration ? '' : 'disabled'} onchange="updateTomatoSpentAttrKeyMinutes(this.value)" style="width:100%;">`,
                                { style: 'margin-bottom:10px;' }
                            )}
                            ${renderSingleFieldSetting(
                                '小时属性名',
                                '思源区块属性名，例如 custom-tomato-time。',
                                `<input class="b3-text-field" type="text" value="${esc(String(SettingsStore.data.tomatoSpentAttrKeyHours || 'custom-tomato-time'))}" ${SettingsStore.data.enableTomatoIntegration ? '' : 'disabled'} onchange="updateTomatoSpentAttrKeyHours(this.value)" style="width:100%;">`,
                                { style: 'margin-bottom:10px;' }
                            )}
                        </div>
                        ${renderSingleSwitchSetting(
                            '启用凡人修仙传:打卡插件联动',
                            '开启后，任务完成时会向凡人修仙传:打卡插件发送任务ID、标题和完成前的优先级分值；凡人修仙传:打卡插件仍需单独开启任务管理器联动。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.enablePointsRewardIntegration ? 'checked' : ''} onchange="updateEnablePointsRewardIntegration(this.checked)">`
                        )}
                        <div style="margin-top:10px;opacity:${SettingsStore.data.enablePointsRewardIntegration ? 1 : 0.6};">
                            ${renderSingleFieldSetting(
                                '不联动的文档分组',
                                '所选文档分组中的任务完成后，不会触发凡人修仙传:打卡插件奖励。',
                                (() => {
                                    const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
                                    const selected = new Set((Array.isArray(SettingsStore.data.pointsRewardExcludedGroupIds) ? SettingsStore.data.pointsRewardExcludedGroupIds : []).map((id) => String(id || '').trim()).filter(Boolean));
                                    if (!groups.length) return `<span class="tm-setting-field-unit">暂无文档分组</span>`;
                                    return renderSettingsChipSetting('', '', [
                                        __tmBuildSettingsChipGroup('文档分组', groups.map((group) => {
                                            const gid = String(group?.id || '').trim();
                                            if (!gid) return null;
                                            return {
                                                key: gid,
                                                label: __tmResolveDocGroupName(group),
                                                title: __tmResolveDocGroupName(group)
                                            };
                                        }).filter(Boolean), {
                                            selectedSet: selected,
                                            disabled: !SettingsStore.data.enablePointsRewardIntegration,
                                            onToggle: (item) => `updatePointsRewardExcludedGroup('${escSq(String(item?.key || '').trim())}', this.checked)`
                                        })
                                    ]);
                                })(),
                                { style: 'margin-bottom:10px;' }
                            )}
                            ${renderSingleSwitchSetting(
                                '启用任务逾期扣分',
                                '按设定时间检查未完成任务，支持截止日期和日程两类扣分。',
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.enablePointsPenaltyIntegration ? 'checked' : ''} ${SettingsStore.data.enablePointsRewardIntegration ? '' : 'disabled'} onchange="updateEnablePointsPenaltyIntegration(this.checked)">`
                            )}
                            <div style="margin-top:10px;opacity:${(SettingsStore.data.enablePointsRewardIntegration && SettingsStore.data.enablePointsPenaltyIntegration) ? 1 : 0.6};">
                                ${renderSingleFieldSetting(
                                    '截止日过期扣分',
                                    '任务截止日期已过且未完成时触发扣分；同一截止日期只扣一次，修改截止日期后重新计算（父任务已完成的子任务不扣）。',
                                    `<div style="display:flex;align-items:center;gap:8px;">
                                        <input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.pointsPenaltyDeadlineEnabled ? 'checked' : ''} ${(SettingsStore.data.enablePointsRewardIntegration && SettingsStore.data.enablePointsPenaltyIntegration) ? '' : 'disabled'} onchange="updatePointsPenaltyDeadlineEnabled(this.checked)">
                                        <input class="b3-text-field" type="number" min="0" max="9999" value="${Math.max(0, Math.min(9999, Math.round(Number(SettingsStore.data.pointsPenaltyDeadlineAmount) || 0)))}" ${(SettingsStore.data.enablePointsRewardIntegration && SettingsStore.data.enablePointsPenaltyIntegration && SettingsStore.data.pointsPenaltyDeadlineEnabled) ? '' : 'disabled'} onchange="updatePointsPenaltyDeadlineAmount(this.value)" style="width:88px;">
                                        <span class="tm-setting-field-unit">分/次</span>
                                    </div>`,
                                    { style: 'margin-bottom:10px;' }
                                )}
                                ${renderSingleFieldSetting(
                                    '日程过期扣分',
                                    '同一任务当天若有多个日程，只按当天最后一个日程判断是否扣分（每任务每天最多一次，父任务已完成的子任务不扣）。',
                                    `<div style="display:flex;align-items:center;gap:8px;">
                                        <input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.pointsPenaltyScheduleEnabled ? 'checked' : ''} ${(SettingsStore.data.enablePointsRewardIntegration && SettingsStore.data.enablePointsPenaltyIntegration) ? '' : 'disabled'} onchange="updatePointsPenaltyScheduleEnabled(this.checked)">
                                        <input class="b3-text-field" type="number" min="0" max="9999" value="${Math.max(0, Math.min(9999, Math.round(Number(SettingsStore.data.pointsPenaltyScheduleAmount) || 0)))}" ${(SettingsStore.data.enablePointsRewardIntegration && SettingsStore.data.enablePointsPenaltyIntegration && SettingsStore.data.pointsPenaltyScheduleEnabled) ? '' : 'disabled'} onchange="updatePointsPenaltyScheduleAmount(this.value)" style="width:88px;">
                                        <span class="tm-setting-field-unit">分/次</span>
                                    </div>`,
                                    { style: 'margin-bottom:10px;' }
                                )}
                                ${renderSingleFieldSetting(
                                    '检查时间',
                                    '每行一个时间；支持 HH:mm（当天）和 +1 HH:mm（次日检查前一天）。',
                                    `<textarea class="b3-text-field" ${(SettingsStore.data.enablePointsRewardIntegration && SettingsStore.data.enablePointsPenaltyIntegration) ? '' : 'disabled'} onchange="updatePointsPenaltyCheckTimes(this.value)" style="width:220px;min-height:72px;resize:vertical;">${esc((Array.isArray(SettingsStore.data.pointsPenaltyCheckTimes) && SettingsStore.data.pointsPenaltyCheckTimes.length ? SettingsStore.data.pointsPenaltyCheckTimes : ['23:00', '+1 08:00']).map(v => String(v || '').trim()).filter(Boolean).join('\n'))}</textarea>`,
                                    { style: 'margin-bottom:10px;' }
                                )}
                                ${renderSingleSwitchSetting(
                                    '弹窗确认扣分',
                                    '开启后先弹窗确认，可在弹窗中标记完成、免扣或修改时间。',
                                    `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.pointsPenaltyConfirmModalEnabled !== false ? 'checked' : ''} ${(SettingsStore.data.enablePointsRewardIntegration && SettingsStore.data.enablePointsPenaltyIntegration) ? '' : 'disabled'} onchange="updatePointsPenaltyConfirmModalEnabled(this.checked)">`
                                )}
                            </div>
                        </div>
                    </div>

                    ` : ''}

                    ${activeTab === 'docs' ? `
                    <div class="tm-settings-panel" style="margin-bottom: 16px;" ${__tmSettingsSearchAttrs('docs', '数据导入', '导入滴答 CSV，自动创建文档、二级标题和任务块')}>
                        <div class="tm-settings-section-title">📥 数据导入</div>
                        <div class="tm-settings-section-desc">支持导入滴答清单导出的 CSV，并自动创建文档、二级标题和任务块。滴答清单 CSV 获取路径：网页版头像 → 设置 → 账户与安全 → 备份与还原 → 生成备份。</div>
                        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
                            <button class="tm-btn tm-btn-primary" onclick="tmOpenTickTickImportDialog()" style="padding:6px 12px;font-size:12px;">导入滴答 CSV</button>
                            <div style="font-size:12px;color:var(--tm-secondary-text);line-height:1.6;">
                                支持按需导入 Status=0/1/2 任务；Status=1 已完成、Status=2 已归档会自动勾选完成，不同文档会并行写入以提升速度。
                            </div>
                        </div>
                    </div>

                    <div style="margin-bottom: 16px; padding: 12px; background: var(--tm-section-bg); border-radius: 8px;" ${__tmSettingsSearchAttrs('docs', '文档分组与管理', '按笔记本分组、自定义分组、手动添加文档和包含子文档')}>
                        <div style="font-weight: 600; margin-bottom: 8px;">📂 文档分组与管理</div>
                        <div style="font-size: 12px; color: var(--tm-secondary-text); line-height: 1.7; margin-bottom: 10px;">
                            <div><b>按笔记本分组：</b>自动搜索笔记本内有任务的文档，分组名称跟随笔记本名称。</div>
                            <div style="margin-top: 4px;"><b>自定义分组：</b>可自定义设置分组名称，文档手动添加，也支持选择“包含子文档”自动搜索有任务的子文档。</div>
                        </div>
                        ${renderGroupSelector()}
                        ${currentGroupId !== 'all' ? `
                        <div style="margin-bottom: 12px; padding: 10px; border: 1px solid var(--tm-border-color); border-radius: 8px; background: var(--tm-card-bg);" ${__tmSettingsSearchAttrs('docs', '日记分组优化搜索', '按日记日期裁剪分组搜索范围')}>
                            <div style="font-weight: 600; margin-bottom: 6px;">📅 日记分组优化搜索</div>
                            <div style="font-size: 12px; color: var(--tm-secondary-text); line-height: 1.7; margin-bottom: 10px;">
                                当当前分组主要由每天的日记文档组成时，开启后会优先按文档日期裁剪，只搜索最近 7、30、60、90 或 120 天内的日记文档任务；如果是非日记分组，也会将搜索范围限制在设定的时间内。
                            </div>
                            ${renderSingleSwitchSetting(
                                '启用日记分组优化搜索',
                                '仅对当前分组生效，默认关闭以保持原有分组行为。',
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${currentGroupCalendarOptimization.enabled ? 'checked' : ''} onchange="updateCurrentGroupCalendarSearchOptimizationEnabled(this.checked)">`
                            )}
                            <div style="margin-top:10px;opacity:${currentGroupCalendarOptimization.enabled ? 1 : 0.6};">
                                ${renderSingleFieldSetting(
                                    '搜索窗口',
                                    '当前分组仅搜索最近多少天内可识别为日记文档的任务。',
                                    `<select class="b3-select" ${currentGroupCalendarOptimization.enabled ? '' : 'disabled'} onchange="updateCurrentGroupCalendarSearchOptimizationDays(this.value)" style="width:180px;">
                                        <option value="7" ${Number(currentGroupCalendarOptimization.days) === 7 ? 'selected' : ''}>最近7天</option>
                                        <option value="30" ${Number(currentGroupCalendarOptimization.days) === 30 ? 'selected' : ''}>最近30天</option>
                                        <option value="60" ${Number(currentGroupCalendarOptimization.days) === 60 ? 'selected' : ''}>最近60天</option>
                                        <option value="90" ${Number(currentGroupCalendarOptimization.days) === 90 ? 'selected' : ''}>最近90天</option>
                                        <option value="120" ${Number(currentGroupCalendarOptimization.days) === 120 ? 'selected' : ''}>最近120天</option>
                                    </select>`
                                )}
                            </div>
                        </div>
                        ` : ''}

                        <div style="display: flex; gap: 8px; margin-top: 12px;">
                            <input type="text" id="manualDocId" placeholder="输入文档ID"
                                   style="flex: 1; padding: 8px 12px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px; font-size: 13px;">
                            <label style="display: flex; align-items: center; gap: 4px; font-size: 12px; cursor: pointer; user-select: none;">
                                <input class="b3-switch fn__flex-center" type="checkbox" id="recursiveCheck">
                                包含子文档
                            </label>
                            <button class="tm-btn tm-btn-primary" data-tm-action="addManualDoc">添加</button>
                        </div>
                        <div style="font-size: 12px; color: var(--tm-secondary-text); margin-top: 8px;">
                            提示：在思源笔记中打开文档，文档菜单中复制ID即可得到文档ID
                        </div>
                    </div>

                    <div style="margin-bottom: 0;" ${__tmSettingsSearchAttrs('docs', '当前分组内文档', '查看、添加、清空或移除当前分组文档')}>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="font-weight: 600;">📚 当前分组内文档（${currentDocs.length} 个）</span>
                            ${currentGroupId !== 'all' ? `<button class="tm-btn tm-btn-danger" data-tm-action="clearCurrentGroupDocs" style="padding: 4px 8px; font-size: 12px;">清空分组内文档</button>` : ''}
                        </div>
                        ${currentDocs.length > 0 ? `
                            <div style="max-height: min(42vh, 320px); overflow-y: auto; border: 1px solid var(--tm-border-color); border-radius: 8px; padding: 8px;">
                                ${currentDocs.map((docItem, index) => {
                                    // 尝试从 allDocuments 中查找
                                    const docId = typeof docItem === 'object' ? docItem.id : docItem;
                                    const itemKind = String((typeof docItem === 'object' ? docItem.kind : '') || 'doc').trim() || 'doc';
                                    const isNotebook = itemKind === 'notebook';
                                    const isRecursive = !isNotebook && (typeof docItem === 'object' ? !!docItem.recursive : false);
                                    const hasOtherBlockSource = !isNotebook && !!(typeof docItem === 'object' ? docItem.hasOtherBlockSource : false);
                                    const hasDirectDocSource = isNotebook || !!(typeof docItem === 'object' ? docItem.hasDirectDocSource : true);
                                    const otherBlockCount = Math.max(0, Number(typeof docItem === 'object' ? docItem.otherBlockCount : 0) || 0);
                                    const sourceGroupName = String((typeof docItem === 'object' ? docItem.sourceGroupName : '') || '').trim();
                                    const sourceGroupId = String((typeof docItem === 'object' ? (docItem.sourceGroupId || (Array.isArray(docItem.sourceGroupIds) ? docItem.sourceGroupIds[0] : '')) : '') || '').trim();

                                    let doc = isNotebook ? null : state.allDocuments.find(d => d.id === docId);

                                    // 如果找不到，尝试从 taskTree 中查找
                                    if (!doc && !isNotebook) {
                                        const docEntry = state.taskTree.find(d => d.id === docId);
                                        if (docEntry) {
                                            doc = { id: docId, name: docEntry.name };
                                        }
                                    }

                                    const fallbackOtherBlockDocName = String((typeof docItem === 'object' ? docItem.docName : '') || '').trim();
                                    const docName = isNotebook ? __tmGetNotebookDisplayName(docId, '未知笔记本') : (doc ? doc.name : (fallbackOtherBlockDocName || '未知文档'));
                                    const displayName = docName.length > 25 ? docName.substring(0, 25) + '...' : docName;
                                    const otherBlockBadgeTitle = `${sourceGroupName ? `${sourceGroupName}：` : ''}其他块页签来源${otherBlockCount > 0 ? `，${otherBlockCount} 个块` : ''}`;

                                    return `
                                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; background: var(--tm-card-bg); border-radius: 4px; margin-bottom: 4px;">
                                            <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                                                <span style="color: var(--tm-primary-color); font-weight: 500;">${index + 1}.</span>
                                                <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                                    <span title="${esc(docName)}">${esc(displayName)}</span>
                                                    ${isNotebook ? '<span style="font-size: 10px; background: var(--tm-info-bg); color: var(--tm-primary-color); padding: 1px 4px; border-radius: 4px; margin-left: 4px;">笔记本</span>' : ''}
                                                    ${isRecursive ? '<span style="font-size: 10px; background: var(--tm-info-bg); color: var(--tm-primary-color); padding: 1px 4px; border-radius: 4px; margin-left: 4px;">+子文档</span>' : ''}
                                                    ${hasOtherBlockSource ? `<span title="${esc(otherBlockBadgeTitle)}" style="font-size: 10px; background: color-mix(in srgb, var(--tm-warning-color, #f9ab00) 12%, transparent); color: var(--tm-warning-color, #f9ab00); padding: 1px 4px; border-radius: 4px; margin-left: 4px;">其他块${otherBlockCount > 1 ? ` ${otherBlockCount}` : ''}</span>` : ''}
                                                </div>
                                                <span style="font-size: 11px; color: var(--tm-task-done-color); font-family: monospace;">${docId.slice(0, 8)}...</span>
                                            </div>
                                            ${currentGroupId !== 'all' ? `
                                                ${isNotebook ? `<span style="font-size: 11px; color: var(--tm-secondary-text);">使用“清空分组内文档”移除</span>` : `
                                                <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
                                                    ${hasDirectDocSource ? `<button class="tm-btn tm-btn-danger" onclick="removeDocFromGroupById('${escSq(docId)}')" style="padding: 2px 6px; font-size: 11px;">移除</button>` : ''}
                                                    ${hasOtherBlockSource ? `<button class="tm-btn tm-btn-danger" onclick="removeOtherBlockSourceDocFromGroup('${escSq(docId)}', '${escSq(sourceGroupId)}')" style="padding: 2px 6px; font-size: 11px;">移除</button>` : ''}
                                                </div>
                                                `}
                                            ` : `
                                                ${isNotebook ? `<span style="font-size: 11px; color: var(--tm-secondary-text);">来自笔记本分组</span>` : `
                                                <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
                                                    ${hasDirectDocSource ? `<button class="tm-btn tm-btn-danger" onclick="removeDocFromAll('${escSq(docId)}')" style="padding: 2px 6px; font-size: 11px;">移除</button>` : ''}
                                                    ${hasOtherBlockSource ? `<button class="tm-btn tm-btn-danger" onclick="removeOtherBlockSourceDocFromGroup('${escSq(docId)}', '${escSq(sourceGroupId)}')" style="padding: 2px 6px; font-size: 11px;">移除</button>` : ''}
                                                </div>
                                                `}
                                            `}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        ` : '<div style="color: var(--tm-secondary-text); font-size: 13px; padding: 10px; background: var(--tm-rule-group-bg); border-radius: 8px;">暂无文档，请添加</div>'}
                    </div>
                    <div style="margin-top: 16px;" ${__tmSettingsSearchAttrs('docs', '排除文档', '恢复或管理被排除的文档')}>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="font-weight: 600;">🚫 排除文档（${currentGroupExcludedDocIds.length} 个）</span>
                        </div>
                        <div style="font-size: 12px; color: var(--tm-secondary-text); line-height: 1.7; margin-bottom: 8px;">
                            ${currentGroupId === 'all'
                                ? '右击文档页签可快速排除。这里只影响“全部文档”视图，恢复显示请从这里移出排除列表。'
                                : '右击文档页签可快速排除。恢复显示请从这里移出排除列表。'}
                        </div>
                        ${currentGroupExcludedDocIds.length > 0 ? `
                            <div style="max-height: min(32vh, 240px); overflow-y: auto; border: 1px solid var(--tm-border-color); border-radius: 8px; padding: 8px;">
                                ${currentGroupExcludedDocIds.map((docId, index) => {
                                    const docName = resolveDocName(docId);
                                    const displayName = docName.length > 25 ? docName.substring(0, 25) + '...' : docName;
                                    return `
                                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; background: var(--tm-card-bg); border-radius: 4px; margin-bottom: 4px;">
                                            <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                                                <span style="color: var(--tm-danger-color); font-weight: 500;">${index + 1}.</span>
                                                <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                                    <span title="${esc(docName)}">${esc(displayName)}</span>
                                                </div>
                                                <span style="font-size: 11px; color: var(--tm-task-done-color); font-family: monospace;">${docId.slice(0, 8)}...</span>
                                            </div>
                                            <button class="tm-btn tm-btn-success" onclick="removeExcludedDocFromCurrentGroup('${docId}')" style="padding: 2px 6px; font-size: 11px;">移出排除</button>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        ` : '<div style="color: var(--tm-secondary-text); font-size: 13px; padding: 10px; background: var(--tm-rule-group-bg); border-radius: 8px;">暂无排除文档</div>'}
                    </div>
                    ` : ''}
                </div>
                    </div>
                </div>
                ${renderSettingsActions('tm-settings-actions--mobile')}
            </div>
        `;
        document.body.appendChild(state.settingsModal);
        if (shouldAnimateOpen) {
            try {
                __tmApplyPopupOpenAnimation(state.settingsModal, state.settingsModal.querySelector('.tm-settings-box'), {
                    mode: window.matchMedia?.('(max-width: 900px)')?.matches ? 'sheet' : 'center'
                });
            } catch (e) {}
        }
        state.__settingsUnstack = __tmModalStackBind(() => window.closeSettings?.());
        try {
            const settingsSidebar = state.settingsModal.querySelector('.tm-settings-sidebar');
            const settingsTabs = state.settingsModal.querySelector('.tm-settings-tabs');
            if (settingsSidebar) {
                try { settingsSidebar.scrollLeft = Number(state.settingsSidebarScrollLeft) || 0; } catch (e) {}
                settingsSidebar.addEventListener('scroll', () => {
                    try { state.settingsSidebarScrollLeft = Number(settingsSidebar.scrollLeft) || 0; } catch (e2) {}
                }, { passive: true });
            }
            if (settingsTabs) {
                try { settingsTabs.scrollLeft = Number(state.settingsTabsScrollLeft) || 0; } catch (e) {}
                settingsTabs.addEventListener('scroll', () => {
                    try { state.settingsTabsScrollLeft = Number(settingsTabs.scrollLeft) || 0; } catch (e2) {}
                }, { passive: true });
            }
            const settingsContent = state.settingsModal.querySelector('.tm-settings-content');
            if (settingsContent) {
                try { settingsContent.scrollTop = Number(state.settingsContentScrollTop) || 0; } catch (e) {}
                settingsContent.addEventListener('scroll', () => {
                    try { state.settingsContentScrollTop = Number(settingsContent.scrollTop) || 0; } catch (e2) {}
                    try { __tmSyncSettingsSectionNav(state.settingsModal); } catch (e3) {}
                }, { passive: true });
            }
            const settingsSubtabs = state.settingsModal.querySelector('.tm-settings-subtabs');
            if (settingsSubtabs) {
                try { settingsSubtabs.scrollLeft = Number(state.settingsSubtabsScrollLeft) || 0; } catch (e) {}
                settingsSubtabs.addEventListener('scroll', () => {
                    try { state.settingsSubtabsScrollLeft = Number(settingsSubtabs.scrollLeft) || 0; } catch (e2) {}
                }, { passive: true });
            }
            const activeNav = state.settingsModal.querySelector('.tm-settings-nav-btn.is-active');
            if (activeNav instanceof HTMLElement) {
                try {
                    requestAnimationFrame(() => {
                        try { activeNav.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e2) {}
                        try { __tmSyncSettingsSectionNav(state.settingsModal); } catch (e3) {}
                    });
                } catch (e) {}
            }
        } catch (e) {}
        try {
            if (state.statusOptionDraftShouldFocus) {
                state.statusOptionDraftShouldFocus = false;
                requestAnimationFrame(() => {
                    try {
                        const input = state.settingsModal?.querySelector?.('[data-tm-status-option-draft-name]');
                        if (input instanceof HTMLInputElement) {
                            input.focus();
                            input.select?.();
                        }
                    } catch (e2) {}
                });
            }
        } catch (e) {}
        __tmBindRulesManagerEvents(state.settingsModal);
        if (settingsSearchEnabled) {
            __tmBindSettingsSearchEvents(state.settingsModal);
            __tmRefreshSettingsSearchResults(state.settingsModal);
            if (shouldRestoreSettingsSearchFocus) {
                requestAnimationFrame(() => {
                    try { state.settingsModal?.querySelector?.('[data-tm-settings-search-input]')?.focus?.(); } catch (e) {}
                });
            }
            __tmRunPendingSettingsSearchFocus(state.settingsModal);
        } else {
            state.settingsSearchResultsOpen = false;
            state.settingsSearchActiveIndex = -1;
            state.settingsSearchPendingTarget = null;
        }
        try {
            if (activeTab === 'calendar') {
                const el = state.settingsModal.querySelector('#tm-calendar-settings-root');
                if (el && globalThis.__tmCalendar && typeof globalThis.__tmCalendar.renderSettings === 'function') {
                    globalThis.__tmCalendar.renderSettings(el, SettingsStore);
                    if (settingsSearchEnabled) {
                        __tmRefreshSettingsSearchResults(state.settingsModal);
                        __tmRunPendingSettingsSearchFocus(state.settingsModal);
                    }
                }
            }
        } catch (e) {}
    }
    window.showSettings = showSettings;
