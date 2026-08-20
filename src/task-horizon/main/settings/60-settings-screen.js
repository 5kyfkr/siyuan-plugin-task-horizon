    const TM_SETTINGS_SEARCH_MAX_RESULTS = 12;
    const __tmAgentMcpExpandedToolGroups = new Set();
    const __tmSettingsDocPickerDraft = { groupId: '', selectedIds: new Set() };

    function __tmNormalizeSettingsDocPickerText(value) {
        const text = String(value || '').replace(/\s+/g, ' ').trim();
        try { return text.normalize('NFKC').toLowerCase(); } catch (e) { return text.toLowerCase(); }
    }

    function __tmSettingsDocPickerMatches(haystack, query) {
        const normalizedQuery = __tmNormalizeSettingsDocPickerText(query);
        return !normalizedQuery || __tmNormalizeSettingsDocPickerText(haystack).includes(normalizedQuery);
    }

    function __tmNormalizeSettingsDocPickerPath(value) {
        const path = String(value || '').trim().replace(/\\/g, '/').replace(/\/+$/g, '');
        if (!path) return '';
        return path.startsWith('/') ? path : `/${path}`;
    }

    function __tmBuildSettingsDocPickerTree(documents = [], notebooks = []) {
        const notebookMeta = new Map();
        (Array.isArray(notebooks) ? notebooks : []).forEach((item, index) => {
            const id = String(item?.id || item?.box || '').trim();
            if (!id) return;
            notebookMeta.set(id, {
                name: String(item?.name || item?.title || id).trim() || id,
                order: index
            });
        });

        const groups = new Map();
        (Array.isArray(documents) ? documents : []).forEach((doc) => {
            const id = String(doc?.id || '').trim();
            const notebookId = String(doc?.notebook || doc?.box || doc?.notebookId || '').trim();
            if (!id || !notebookId) return;
            if (!groups.has(notebookId)) {
                const meta = notebookMeta.get(notebookId);
                groups.set(notebookId, {
                    id: notebookId,
                    name: meta?.name || notebookId,
                    order: Number.isFinite(meta?.order) ? meta.order : Number.MAX_SAFE_INTEGER,
                    nodesById: new Map(),
                    roots: []
                });
            }
            const group = groups.get(notebookId);
            if (group.nodesById.has(id)) return;
            const path = __tmNormalizeSettingsDocPickerPath(doc?.path || doc?.hpath);
            const fallbackName = path.split('/').filter(Boolean).pop() || '未命名文档';
            group.nodesById.set(id, {
                id,
                notebookId,
                name: String(doc?.name || doc?.content || fallbackName).trim() || fallbackName,
                alias: String(doc?.alias || '').trim(),
                path,
                sort: Number(doc?.sort),
                doc,
                children: []
            });
        });

        const sortNodes = (nodes) => {
            nodes.sort((a, b) => {
                const aSort = Number.isFinite(a.sort) ? a.sort : Number.MAX_SAFE_INTEGER;
                const bSort = Number.isFinite(b.sort) ? b.sort : Number.MAX_SAFE_INTEGER;
                return aSort - bSort || a.name.localeCompare(b.name, 'zh-CN');
            });
            nodes.forEach((node) => sortNodes(node.children));
        };

        groups.forEach((group) => {
            const pathMap = new Map();
            group.nodesById.forEach((node) => {
                if (node.path) pathMap.set(node.path, node);
            });
            group.nodesById.forEach((node) => {
                const splitAt = node.path.lastIndexOf('/');
                const parentPath = splitAt > 0 ? node.path.slice(0, splitAt) : '';
                const parent = parentPath ? pathMap.get(parentPath) : null;
                if (parent && parent !== node) parent.children.push(node);
                else group.roots.push(node);
            });
            sortNodes(group.roots);
            delete group.nodesById;
        });

        return Array.from(groups.values()).sort((a, b) => (
            a.order - b.order || a.name.localeCompare(b.name, 'zh-CN')
        ));
    }

    function __tmPrepareSettingsDocPickerDraft(groupId, existingIds = []) {
        const normalizedGroupId = String(groupId || 'all').trim() || 'all';
        if (__tmSettingsDocPickerDraft.groupId !== normalizedGroupId) {
            __tmSettingsDocPickerDraft.groupId = normalizedGroupId;
            __tmSettingsDocPickerDraft.selectedIds.clear();
        }
        const existing = existingIds instanceof Set ? existingIds : new Set(existingIds);
        existing.forEach((id) => __tmSettingsDocPickerDraft.selectedIds.delete(String(id || '').trim()));
        return __tmSettingsDocPickerDraft.selectedIds;
    }

    window.tmSetAgentMcpToolGroupExpanded = function(groupID, expanded) {
        const id = String(groupID || '').trim();
        if (!id) return;
        if (expanded === true) __tmAgentMcpExpandedToolGroups.add(id);
        else __tmAgentMcpExpandedToolGroups.delete(id);
    };
    const TM_SETTINGS_SEARCH_TAB_LABELS = Object.freeze({
        docs: '文档分组',
        main: '常规设置',
        appearance: '外观',
        calendar: '日历',
        ai: 'AI',
        rules: '规则管理',
        quadrant: '四象限',
        priority: '优先级算法',
        benefits: '功能权益',
        about: '关于'
    });
    const TM_SETTINGS_SEARCH_INDEX_TABS = Object.freeze(Object.keys(TM_SETTINGS_SEARCH_TAB_LABELS));
    let __tmSettingsSearchCaptureBuffer = null;
    let __tmSettingsSearchIndexBuilding = false;
    function __tmNormalizeSettingsSearchTab(tab) {
        const v = String(tab || '').trim();
        if (v === 'scheduled') return 'ai';
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

    function __tmGetSettingsSearchSectionLabel(sectionId, tab = 'main') {
        const sid = String(sectionId || '').trim();
        if (!sid) return '';
        try {
            const section = __tmGetSettingsSections(tab)
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
        if (Array.isArray(__tmSettingsSearchCaptureBuffer)) {
            __tmSettingsSearchCaptureBuffer.push({
                tab: normalizedTab,
                section,
                title: titleText,
                desc: descText,
                key,
                rendered: true
            });
        }
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
        const sectionLabel = __tmGetSettingsSearchSectionLabel(section, tab);
        const haystack = __tmNormalizeSettingsSearchText([title, desc, tabLabel, sectionLabel].filter(Boolean).join(' '));
        return { tab, title, desc, section, key, tabLabel, sectionLabel, haystack, rendered: !!raw.rendered };
    }

    function __tmDecorateCalendarSettingsSearchRows(root) {
        if (!(root instanceof HTMLElement)) return;
        root.querySelectorAll('.tm-calendar-settings-row').forEach((row) => {
            if (!(row instanceof HTMLElement)) return;
            const label = row.querySelector('.tm-calendar-settings-label');
            if (!(label instanceof HTMLElement)) return;
            const title = __tmPlainSettingsSearchText(Array.from(label.childNodes)
                .filter((node) => node?.nodeType === 3)
                .map((node) => node.textContent || '')
                .join(' '));
            if (!title) return;
            const descNode = label.querySelector('.tm-calendar-settings-label-desc');
            const desc = __tmPlainSettingsSearchText(descNode?.textContent || label.getAttribute('title') || '');
            row.dataset.tmSettingsSearchKey = __tmBuildSettingsSearchKey('calendar', title);
            row.dataset.tmSettingsSearchTab = 'calendar';
            row.dataset.tmSettingsSearchTitle = title;
            if (desc) row.dataset.tmSettingsSearchDesc = desc;
            else delete row.dataset.tmSettingsSearchDesc;
        });
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
        Object.entries(TM_SETTINGS_SEARCH_TAB_LABELS).forEach(([tab, title]) => {
            const entry = __tmCreateSettingsSearchEntry({ tab, title, desc: '设置页' });
            if (!entry) return;
            map.set(`${entry.tab}:${entry.key}`, entry);
        });
        (Array.isArray(state.settingsSearchGeneratedEntries) ? state.settingsSearchGeneratedEntries : []).forEach((entry) => {
            if (!entry) return;
            map.set(`${entry.tab}:${entry.key}`, entry);
        });
        __tmDecorateCalendarSettingsSearchRows(state.settingsModal);
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
        if (__tmSettingsSearchIndexBuilding) return '';
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
            const targetTab = __tmNormalizeSettingsSearchTab(target?.tab || state.settingsActiveTab || 'docs');
            if (targetTab === 'calendar'
                && root.querySelector('#tm-calendar-settings-root')
                && !root.querySelector('.tm-calendar-settings-row')) {
                return null;
            }
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
        if (section) {
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
        const settingsOpen = state.settingsModal instanceof HTMLElement && document.body.contains(state.settingsModal);
        if (targetTab !== currentTab || !settingsOpen) {
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
            try { window.tmCloseSettingsDocPicker?.({ restoreFocus: false }); } catch (e) {}
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
        if (shouldAnimateOpen) {
            __tmSettingsDocPickerDraft.groupId = String(currentGroupId || 'all').trim() || 'all';
            __tmSettingsDocPickerDraft.selectedIds.clear();
        }
        const currentGroupCalendarOptimization = __tmGetGroupCalendarSearchOptimization(currentGroup);
        const currentGroupExcludedDocIds = __tmGetExcludedDocIdsForGroup(currentGroupId);
        let activeTab = 'docs';
        if (state.settingsActiveTab === 'main') activeTab = 'main';
        if (state.settingsActiveTab === 'docs') activeTab = 'docs';
        if (state.settingsActiveTab === 'appearance') activeTab = 'appearance';
        if (state.settingsActiveTab === 'calendar') activeTab = 'calendar';
        if (state.settingsActiveTab === 'ai' || state.settingsActiveTab === 'scheduled') {
            activeTab = 'ai';
            state.settingsActiveTab = 'ai';
        }
        if (state.settingsActiveTab === 'rules') activeTab = 'rules';
        if (state.settingsActiveTab === 'quadrant') activeTab = 'quadrant';
        if (state.settingsActiveTab === 'priority') activeTab = 'priority';
        if (state.settingsActiveTab === 'benefits') activeTab = 'benefits';
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
            if (activeTab === 'benefits') {
                return `
                    <div class="${className}">
                        <button class="tm-btn tm-btn-secondary" data-tm-action="closeSettings">关闭</button>
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

        let settingsDocPickerDialogMarkup = '';
        const renderDocumentGroupManager = () => {
            const searchEnabled = groups.length >= 6;
            const searchQuery = searchEnabled ? String(state.settingsDocGroupQuery || '').trim().toLowerCase() : '';
            const isAllDocs = currentGroupId === 'all';
            const isNotebookGroup = !!String(currentGroup?.notebookId || '').trim();
            const currentGroupName = isAllDocs ? '全部文档' : (__tmResolveDocGroupName(currentGroup) || '未命名分组');
            const currentGroupIndex = isAllDocs
                ? -1
                : groups.findIndex((group) => String(group?.id || '').trim() === currentGroupId);
            const detailTabs = isAllDocs ? ['sources', 'excluded'] : ['sources', 'excluded', 'optimization'];
            const requestedDetailTab = String(state.settingsDocGroupDetailTab || 'sources').trim();
            const activeDetailTab = detailTabs.includes(requestedDetailTab) ? requestedDetailTab : 'sources';
            const icon = (name, size = 16) => __tmLucideIconSvg(name, {
                size,
                className: 'tm-doc-group-manager__icon-svg'
            });
            const sourceCountForGroup = (group) => {
                const gid = String(group?.id || '').trim();
                const directCount = __tmGetGroupSourceEntries(group).length;
                const otherCount = gid ? __tmGetOtherBlockRefsByGroup(gid).length : 0;
                return directCount + otherCount;
            };
            const renderGroupButton = (group) => {
                const gid = String(group?.id || '').trim();
                if (!gid) return '';
                const name = __tmResolveDocGroupName(group) || '未命名分组';
                const selected = gid === currentGroupId;
                const notebook = !!String(group?.notebookId || '').trim();
                const sourceCount = sourceCountForGroup(group);
                const searchableName = name.toLowerCase();
                const hidden = !!searchQuery && !searchableName.includes(searchQuery);
                return `
                    <button type="button"
                        class="tm-doc-group-manager__group${selected ? ' is-active' : ''}"
                        data-tm-doc-group-search-name="${esc(searchableName)}"
                        data-tm-call="tmSwitchSettingsDocGroup"
                        data-tm-args='${esc(JSON.stringify([gid]))}'
                        aria-selected="${selected ? 'true' : 'false'}"
                        title="${esc(name)}"${hidden ? ' hidden' : ''}>
                        <span class="tm-doc-group-manager__group-icon">${icon(notebook ? 'archive' : 'file', 15)}</span>
                        <span class="tm-doc-group-manager__group-copy">
                            <span class="tm-doc-group-manager__group-name">${esc(name)}</span>
                            <span class="tm-doc-group-manager__group-meta">${notebook ? '笔记本' : '自定义'} · ${sourceCount} 项来源</span>
                        </span>
                    </button>
                `;
            };
            const visibleGroupCount = groups.filter((group) => {
                if (!searchQuery) return true;
                return String(__tmResolveDocGroupName(group) || '').toLowerCase().includes(searchQuery);
            }).length;
            const currentDocIdSet = new Set(currentDocs.map((docItem) => {
                const kind = String((typeof docItem === 'object' ? docItem?.kind : '') || 'doc').trim() || 'doc';
                return kind === 'doc' ? String((typeof docItem === 'object' ? docItem?.id : docItem) || '').trim() : '';
            }).filter(Boolean));
            const docPickerDraft = __tmPrepareSettingsDocPickerDraft(currentGroupId, currentDocIdSet);
            const docPickerTree = __tmBuildSettingsDocPickerTree(state.allDocuments, state.notebooks);
            const renderDocPickerNode = (node, depth = 0) => {
                const docId = String(node?.id || '').trim();
                if (!docId) return '';
                const displayName = __tmGetDocDisplayName(node.doc, node.name || '未命名文档');
                const alreadyAdded = currentDocIdSet.has(docId);
                const checked = alreadyAdded || docPickerDraft.has(docId);
                const hasChildren = Array.isArray(node.children) && node.children.length > 0;
                const searchText = [displayName, node.name, node.alias, node.path, docId].filter(Boolean).join(' ');
                const rowTag = hasChildren ? 'span' : 'div';
                const row = `
                    <${rowTag} class="tm-doc-group-manager__picker-row${alreadyAdded ? ' is-added' : ''}"
                        data-tm-doc-picker-row data-tm-doc-picker-search="${esc(searchText)}"
                        style="--tm-doc-picker-depth:${Math.max(0, depth)}">
                        <span class="tm-doc-group-manager__picker-indent" aria-hidden="true"></span>
                        ${hasChildren
                            ? `<span class="tm-doc-group-manager__picker-chevron" aria-hidden="true">${icon('chevron-right', 14)}</span>`
                            : '<span class="tm-doc-group-manager__picker-chevron-placeholder" aria-hidden="true"></span>'}
                        <label class="tm-doc-group-manager__picker-label" onclick="event.stopPropagation()">
                            <input type="checkbox" data-tm-doc-picker-checkbox value="${esc(docId)}"
                                ${checked ? 'checked' : ''}${alreadyAdded ? ' disabled' : ''}
                                onchange="tmToggleSettingsDocPickerSelection('${escSq(docId)}', this.checked)">
                            <span class="tm-doc-group-manager__picker-doc-icon">${icon('file-text', 14)}</span>
                            <span class="tm-doc-group-manager__picker-name" title="${esc(node.path || displayName)}">${esc(displayName)}</span>
                            ${alreadyAdded ? '<span class="tm-doc-group-manager__picker-status">已添加</span>' : ''}
                        </label>
                    </${rowTag}>
                `;
                if (!hasChildren) {
                    return `<div class="tm-doc-group-manager__picker-item" data-tm-doc-picker-item>${row}</div>`;
                }
                return `
                    <details class="tm-doc-group-manager__picker-item tm-doc-group-manager__picker-branch" data-tm-doc-picker-item>
                        <summary>${row}</summary>
                        <div class="tm-doc-group-manager__picker-children">
                            ${node.children.map((child) => renderDocPickerNode(child, depth + 1)).join('')}
                        </div>
                    </details>
                `;
            };
            const countDocPickerNodes = (nodes) => (Array.isArray(nodes) ? nodes : [])
                .reduce((count, node) => count + 1 + countDocPickerNodes(node.children), 0);
            const renderDocPickerNotebook = (group) => `
                <details class="tm-doc-group-manager__picker-notebook" data-tm-doc-picker-notebook>
                    <summary>
                        <span class="tm-doc-group-manager__picker-chevron" aria-hidden="true">${icon('chevron-right', 14)}</span>
                        <span class="tm-doc-group-manager__picker-notebook-icon">${icon('archive', 14)}</span>
                        <span class="tm-doc-group-manager__picker-notebook-name">${esc(group.name)}</span>
                        <span class="tm-doc-group-manager__picker-notebook-count">${countDocPickerNodes(group.roots)}</span>
                    </summary>
                    <div class="tm-doc-group-manager__picker-notebook-docs">
                        ${group.roots.map((node) => renderDocPickerNode(node, 0)).join('')}
                    </div>
                </details>
            `;
            const renderSourceRows = () => {
                if (!currentDocs.length) {
                    return '<div class="tm-doc-group-manager__empty">暂无文档来源。可在上方添加文档，或从思源文档菜单加入当前分组。</div>';
                }
                return `
                    <div class="tm-doc-group-manager__source-list">
                        ${currentDocs.map((docItem) => {
                            const docId = String((typeof docItem === 'object' ? docItem?.id : docItem) || '').trim();
                            const itemKind = String((typeof docItem === 'object' ? docItem?.kind : '') || 'doc').trim() || 'doc';
                            const isNotebook = itemKind === 'notebook';
                            const isRecursive = !isNotebook && !!(typeof docItem === 'object' ? docItem?.recursive : false);
                            const hasOtherBlockSource = !isNotebook && !!(typeof docItem === 'object' ? docItem?.hasOtherBlockSource : false);
                            const hasDirectDocSource = isNotebook || !!(typeof docItem === 'object' ? docItem?.hasDirectDocSource : true);
                            const otherBlockCount = Math.max(0, Number(typeof docItem === 'object' ? docItem?.otherBlockCount : 0) || 0);
                            const sourceGroupName = String((typeof docItem === 'object' ? docItem?.sourceGroupName : '') || '').trim();
                            const sourceGroupId = String((typeof docItem === 'object'
                                ? (docItem?.sourceGroupId || (Array.isArray(docItem?.sourceGroupIds) ? docItem.sourceGroupIds[0] : ''))
                                : '') || '').trim();
                            let doc = isNotebook ? null : state.allDocuments.find((item) => item.id === docId);
                            if (!doc && !isNotebook) {
                                const docEntry = state.taskTree.find((item) => item.id === docId);
                                if (docEntry) doc = { id: docId, name: docEntry.name };
                            }
                            const fallbackOtherBlockDocName = String((typeof docItem === 'object' ? docItem?.docName : '') || '').trim();
                            const docName = isNotebook
                                ? __tmGetNotebookDisplayName(docId, '未知笔记本')
                                : (doc ? __tmGetDocDisplayName(doc, doc.name || '未知文档') : (fallbackOtherBlockDocName || '未知文档'));
                            const otherBlockBadgeTitle = `${sourceGroupName ? `${sourceGroupName}：` : ''}其他块页签来源${otherBlockCount > 0 ? `，${otherBlockCount} 个块` : ''}`;
                            const directRemoveAction = isAllDocs
                                ? `removeDocFromAll('${escSq(docId)}')`
                                : `removeDocFromGroupById('${escSq(docId)}')`;
                            return `
                                <div class="tm-doc-group-manager__source-row">
                                    <span class="tm-doc-group-manager__source-icon">${icon(isNotebook ? 'archive' : 'file-text', 15)}</span>
                                    <div class="tm-doc-group-manager__source-copy">
                                        <div class="tm-doc-group-manager__source-name" title="${esc(docName)}">${esc(docName)}</div>
                                        <div class="tm-doc-group-manager__source-meta">
                                            <span class="tm-doc-group-manager__source-id" title="${esc(docId)}">${esc(docId)}</span>
                                            ${isNotebook ? '<span class="tm-doc-group-manager__badge">笔记本</span>' : ''}
                                            ${isRecursive ? '<span class="tm-doc-group-manager__badge">含子文档</span>' : ''}
                                            ${hasOtherBlockSource ? `<span class="tm-doc-group-manager__badge tm-doc-group-manager__badge--warning" title="${esc(otherBlockBadgeTitle)}">其他块${otherBlockCount > 1 ? ` ${otherBlockCount}` : ''}</span>` : ''}
                                        </div>
                                    </div>
                                    <div class="tm-doc-group-manager__source-actions">
                                        ${isNotebook
                                            ? `<span class="tm-doc-group-manager__row-note">${isAllDocs ? '来自笔记本分组' : '在更多操作中解除关联'}</span>`
                                            : `${hasDirectDocSource ? `<button type="button" class="tm-doc-group-manager__text-action" onclick="${directRemoveAction}">${icon('trash-2', 13)}<span>移除</span></button>` : ''}
                                               ${hasOtherBlockSource ? `<button type="button" class="tm-doc-group-manager__text-action" onclick="removeOtherBlockSourceDocFromGroup('${escSq(docId)}', '${escSq(sourceGroupId)}')">${icon('trash-2', 13)}<span>移除其他块</span></button>` : ''}`}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            };
            const renderSourcePane = () => {
                const addForm = isNotebookGroup ? `
                    <div class="tm-doc-group-manager__notice">
                        ${icon('archive', 16)}
                        <div>
                            <strong>来源由笔记本同步</strong>
                            <span>自动搜索该笔记本内包含任务的文档，名称跟随笔记本显示名。</span>
                        </div>
                    </div>
                ` : `
                    <div class="tm-doc-group-manager__picker-trigger-row">
                        <button type="button" class="tm-btn tm-btn-primary tm-doc-group-manager__picker-trigger"
                            data-tm-action="tmOpenSettingsDocPicker">
                            <span>选择文档</span>
                        </button>
                    </div>
                `;
                if (!isNotebookGroup) {
                    settingsDocPickerDialogMarkup = `
                    <div class="tm-doc-group-manager__picker-dialog" data-tm-doc-picker-dialog hidden aria-hidden="true"
                        onclick="if (event.target === this) tmCloseSettingsDocPicker()">
                        <section class="tm-doc-group-manager__picker-dialog-box" role="dialog" aria-modal="true" aria-labelledby="tmSettingsDocPickerTitle">
                            <header class="tm-doc-group-manager__picker-dialog-head">
                                <h3 id="tmSettingsDocPickerTitle">选择文档</h3>
                                <button type="button" class="tm-doc-group-manager__picker-dialog-close"
                                    data-tm-action="tmCloseSettingsDocPicker" title="关闭" aria-label="关闭">
                                    ${icon('x', 17)}
                                </button>
                            </header>
                            <div class="tm-doc-group-manager__picker" data-tm-doc-picker data-tm-doc-picker-group-id="${esc(currentGroupId)}">
                        <div class="tm-doc-group-manager__picker-toolbar">
                            <div class="tm-doc-group-manager__picker-search">
                                <span aria-hidden="true">${icon('search', 14)}</span>
                                <input type="search" placeholder="搜索文档名称、路径或 ID" aria-label="搜索文档"
                                    autocomplete="off" spellcheck="false" data-tm-doc-picker-search-input data-tm-call="tmFilterSettingsDocPicker">
                                <button type="button" data-tm-action="tmClearSettingsDocPickerSearch" title="清除搜索" aria-label="清除搜索" hidden>${icon('x', 14)}</button>
                            </div>
                            <button type="button" class="tm-doc-group-manager__picker-refresh" data-tm-action="tmRefreshSettingsDocPicker"
                                title="刷新文档列表" aria-label="刷新文档列表">${icon('refresh-cw', 15)}</button>
                        </div>
                        <div class="tm-doc-group-manager__picker-tree" data-tm-doc-picker-tree aria-busy="${state.settingsDocPickerDocumentsLoading ? 'true' : 'false'}">
                            ${state.settingsDocPickerDocumentsLoading && !docPickerTree.length ? `
                                <div class="tm-doc-group-manager__picker-skeleton" aria-label="正在加载文档">
                                    <span></span><span></span><span></span>
                                </div>
                            ` : docPickerTree.length
                                ? docPickerTree.map(renderDocPickerNotebook).join('')
                                : '<div class="tm-doc-group-manager__picker-empty">没有可选择的文档</div>'}
                            <div class="tm-doc-group-manager__picker-empty" data-tm-doc-picker-empty hidden>没有匹配的文档</div>
                        </div>
                        <div class="tm-doc-group-manager__picker-footer">
                            ${isAllDocs ? '<span></span>' : `
                                <label class="tm-doc-group-manager__recursive">
                                    <input class="b3-switch fn__flex-center" type="checkbox" data-tm-doc-picker-recursive>
                                    <span>包含子文档</span>
                                </label>
                            `}
                            <div class="tm-doc-group-manager__picker-actions">
                                <span class="tm-doc-group-manager__picker-selected" data-tm-doc-picker-selected-count>已选择 ${docPickerDraft.size} 项</span>
                                <button type="button" class="tm-btn tm-btn-primary tm-doc-group-manager__add-button"
                                    data-tm-action="tmAddSelectedSettingsDocs"${docPickerDraft.size ? '' : ' disabled'}>
                                    ${icon('plus', 15)}<span>添加所选</span>
                                </button>
                            </div>
                        </div>
                            </div>
                        </section>
                    </div>
                    `;
                }
                return `${addForm}${renderSourceRows()}`;
            };
            const renderExcludedPane = () => {
                if (!currentGroupExcludedDocIds.length) {
                    return '<div class="tm-doc-group-manager__empty">暂无隐藏的文档页签。右击任务管理器中的文档页签可以快速隐藏。</div>';
                }
                return `
                    <div class="tm-doc-group-manager__pane-intro">
                        ${isAllDocs ? '这里只影响“全部文档”视图。' : '恢复后，文档会重新出现在当前分组中。'}
                    </div>
                    <div class="tm-doc-group-manager__source-list">
                        ${currentGroupExcludedDocIds.map((docId) => {
                            const docName = resolveDocName(docId);
                            return `
                                <div class="tm-doc-group-manager__source-row">
                                    <span class="tm-doc-group-manager__source-icon">${icon('file-text', 15)}</span>
                                    <div class="tm-doc-group-manager__source-copy">
                                        <div class="tm-doc-group-manager__source-name" title="${esc(docName)}">${esc(docName)}</div>
                                        <div class="tm-doc-group-manager__source-meta"><span class="tm-doc-group-manager__source-id" title="${esc(String(docId))}">${esc(String(docId))}</span></div>
                                    </div>
                                    <button type="button" class="tm-doc-group-manager__restore" onclick="removeExcludedDocFromCurrentGroup('${escSq(docId)}')">恢复显示</button>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            };
            const renderOptimizationPane = () => `
                <div class="tm-doc-group-manager__pane-intro">
                    适合以日记文档为主的分组，也可用于限制普通分组的任务搜索范围。
                </div>
                ${renderSingleSwitchSetting(
                    '启用日记分组优化搜索',
                    '仅对当前分组生效，默认关闭以保持原有行为。',
                    `<input class="b3-switch fn__flex-center" type="checkbox" ${currentGroupCalendarOptimization.enabled ? 'checked' : ''} onchange="updateCurrentGroupCalendarSearchOptimizationEnabled(this.checked)">`
                )}
                <div class="tm-doc-group-manager__optimization-days${currentGroupCalendarOptimization.enabled ? '' : ' is-disabled'}">
                    ${renderSingleFieldSetting(
                        '搜索窗口',
                        '只搜索最近多少天内可识别为日记文档的任务。',
                        `<select class="b3-select tm-doc-group-manager__days-select" ${currentGroupCalendarOptimization.enabled ? '' : 'disabled'} onchange="updateCurrentGroupCalendarSearchOptimizationDays(this.value)">
                            <option value="7" ${Number(currentGroupCalendarOptimization.days) === 7 ? 'selected' : ''}>最近 7 天</option>
                            <option value="30" ${Number(currentGroupCalendarOptimization.days) === 30 ? 'selected' : ''}>最近 30 天</option>
                            <option value="60" ${Number(currentGroupCalendarOptimization.days) === 60 ? 'selected' : ''}>最近 60 天</option>
                            <option value="90" ${Number(currentGroupCalendarOptimization.days) === 90 ? 'selected' : ''}>最近 90 天</option>
                            <option value="120" ${Number(currentGroupCalendarOptimization.days) === 120 ? 'selected' : ''}>最近 120 天</option>
                        </select>`
                    )}
                </div>
            `;
            const renderDetailActions = () => {
                if (isAllDocs) return '';
                const canRename = !isNotebookGroup;
                const canClear = isNotebookGroup || (Array.isArray(currentGroup?.docs) && currentGroup.docs.length > 0);
                return `
                    <div class="tm-doc-group-manager__detail-actions">
                        <button type="button" class="tm-doc-group-manager__icon-button"
                            data-tm-call="tmMoveCurrentDocGroup" data-tm-args='${esc(JSON.stringify([-1]))}'
                            title="${currentGroupIndex > 0 ? '上移分组' : '已是第一个分组'}" aria-label="上移分组"${currentGroupIndex > 0 ? '' : ' disabled'}>
                            ${icon('arrow-up', 15)}
                        </button>
                        <button type="button" class="tm-doc-group-manager__icon-button"
                            data-tm-call="tmMoveCurrentDocGroup" data-tm-args='${esc(JSON.stringify([1]))}'
                            title="${currentGroupIndex >= 0 && currentGroupIndex < groups.length - 1 ? '下移分组' : '已是最后一个分组'}" aria-label="下移分组"${currentGroupIndex >= 0 && currentGroupIndex < groups.length - 1 ? '' : ' disabled'}>
                            ${icon('arrow-down', 15)}
                        </button>
                        <button type="button" class="tm-btn tm-btn-secondary tm-doc-group-manager__export" data-tm-action="exportCurrentGroup">
                            ${icon('download', 15)}<span>导出</span>
                        </button>
                        <details class="tm-doc-group-manager__more">
                            <summary class="tm-doc-group-manager__icon-button" title="更多操作" aria-label="更多操作">${icon('dots-three', 17)}</summary>
                            <div class="tm-doc-group-manager__more-menu" role="menu">
                                ${canRename ? `<button type="button" data-tm-action="renameCurrentGroup" role="menuitem">${icon('pencil', 15)}<span>重命名</span></button>` : ''}
                                ${canClear ? `<button type="button" data-tm-action="clearCurrentGroupDocs" role="menuitem">${icon(isNotebookGroup ? 'archive' : 'trash-2', 15)}<span>${isNotebookGroup ? '解除笔记本关联' : '清空手动文档'}</span></button>` : ''}
                                <button type="button" class="is-danger" data-tm-action="deleteCurrentGroup" role="menuitem">${icon('trash-2', 15)}<span>删除分组</span></button>
                            </div>
                        </details>
                    </div>
                `;
            };
            const renderDetailTab = (tab, label, count = null) => {
                const active = activeDetailTab === tab;
                return `
                    <button type="button" class="tm-doc-group-manager__tab${active ? ' is-active' : ''}"
                        data-tm-call="tmSetDocGroupSettingsDetailTab"
                        data-tm-args='${esc(JSON.stringify([tab]))}'
                        role="tab" aria-selected="${active ? 'true' : 'false'}">
                        <span>${label}</span>${count === null ? '' : `<span class="tm-doc-group-manager__tab-count">${count}</span>`}
                    </button>
                `;
            };
            const detailPaneHtml = activeDetailTab === 'excluded'
                ? renderExcludedPane()
                : (activeDetailTab === 'optimization' ? renderOptimizationPane() : renderSourcePane());
            return `
                <section class="tm-settings-panel tm-doc-group-manager" ${__tmSettingsSearchAttrs('docs', '文档分组与管理', '常驻分组列表、文档来源、隐藏文档页签和搜索优化')}>
                    <div class="tm-doc-group-manager__heading">
                        <div>
                            <div class="tm-settings-section-title">${icon('list-bullets', 18)}<span>文档分组与管理</span></div>
                            <div class="tm-settings-section-desc">选择分组后管理来源、排除范围与搜索优化。</div>
                        </div>
                    </div>
                    <div class="tm-doc-group-manager__workspace" aria-busy="false">
                        <aside class="tm-doc-group-manager__nav" aria-label="文档分组">
                            <div class="tm-doc-group-manager__nav-head">
                                <span>文档范围</span>
                                <span>${groups.length} 个分组</span>
                            </div>
                            ${searchEnabled ? `
                                <div class="tm-doc-group-manager__search">
                                    <span>${icon('search', 14)}</span>
                                    <input type="search" value="${esc(String(state.settingsDocGroupQuery || ''))}" placeholder="搜索分组" aria-label="搜索文档分组" data-tm-call="tmUpdateDocGroupSettingsQuery">
                                    <button type="button" data-tm-action="tmClearDocGroupSettingsQuery" title="清除搜索" aria-label="清除搜索"${searchQuery ? '' : ' hidden'}>${icon('x', 14)}</button>
                                </div>
                            ` : ''}
                            <div class="tm-doc-group-manager__all">
                                <button type="button" class="tm-doc-group-manager__group${isAllDocs ? ' is-active' : ''}"
                                    data-tm-call="tmSwitchSettingsDocGroup" data-tm-args='${esc(JSON.stringify(['all']))}'
                                    aria-selected="${isAllDocs ? 'true' : 'false'}" title="全部文档">
                                    <span class="tm-doc-group-manager__group-icon">${icon('list-bullets', 15)}</span>
                                    <span class="tm-doc-group-manager__group-copy">
                                        <span class="tm-doc-group-manager__group-name">全部文档</span>
                                        <span class="tm-doc-group-manager__group-meta">汇总所有分组</span>
                                    </span>
                                </button>
                            </div>
                            <div class="tm-doc-group-manager__group-list" role="listbox">
                                ${groups.map(renderGroupButton).join('')}
                                <div class="tm-doc-group-manager__search-empty"${visibleGroupCount > 0 ? ' hidden' : ''}>没有匹配的分组</div>
                            </div>
                            <div class="tm-doc-group-manager__create">
                                <button type="button" class="tm-btn tm-btn-primary" data-tm-action="createNotebookGroup">${icon('plus', 14)}<span>笔记本</span></button>
                                <button type="button" class="tm-btn tm-btn-primary" data-tm-action="createCustomGroup">${icon('plus', 14)}<span>自定义</span></button>
                            </div>
                        </aside>
                        <div class="tm-doc-group-manager__detail">
                            <div class="tm-doc-group-manager__detail-head">
                                <div class="tm-doc-group-manager__detail-title-wrap">
                                    <div class="tm-doc-group-manager__detail-title" title="${esc(currentGroupName)}">${esc(currentGroupName)}</div>
                                    <div class="tm-doc-group-manager__detail-meta">
                                        ${isAllDocs ? '汇总视图' : (isNotebookGroup ? '笔记本分组' : '自定义分组')} · ${currentDocs.length} 项来源
                                    </div>
                                </div>
                                ${renderDetailActions()}
                            </div>
                            <div class="tm-doc-group-manager__tabs" role="tablist" aria-label="分组详情">
                                ${renderDetailTab('sources', '文档来源', currentDocs.length)}
                                ${renderDetailTab('excluded', '隐藏文档页签', currentGroupExcludedDocIds.length)}
                                ${isAllDocs ? '' : renderDetailTab('optimization', '搜索优化')}
                            </div>
                            <div class="tm-doc-group-manager__pane" role="tabpanel">
                                ${detailPaneHtml}
                            </div>
                        </div>
                    </div>
                </section>
            `;
        };

        const docTabCustomGroups = __tmGetDocTabCustomGroups();
        const resolveDocTabGroupDoc = (docId) => {
            const id = String(docId || '').trim();
            if (!id) return null;
            return (Array.isArray(state.allDocuments) ? state.allDocuments : []).find((doc) => String(doc?.id || '').trim() === id)
                || (Array.isArray(state.taskTree) ? state.taskTree : []).find((doc) => String(doc?.id || '').trim() === id)
                || { id, name: resolveDocName(id) };
        };
        const renderDocTabCustomGroupSettings = () => {
            const groupsForTabs = __tmNormalizeDocTabCustomGroups(docTabCustomGroups);
            return `
                <div style="margin-bottom: 16px; padding: 12px; background: var(--tm-section-bg); border-radius: 8px;" ${__tmSettingsSearchAttrs('docs', '页签自定义分组', '右击页签加入分组，手动选择是否包含子文档，只影响页签栏显示')}>
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">
                        <div style="font-weight:600;">📑 页签自定义分组</div>
                        <button class="tm-btn tm-btn-info" data-tm-action="tmCreateDocTabCustomGroupFromSettings" style="padding: 6px 12px; font-size: 12px;">+ 新建页签组</button>
                    </div>
                    <div style="font-size:12px;color:var(--tm-secondary-text);line-height:1.7;margin-bottom:10px;">
                        自定义页签组只折叠页签栏，不改变任务搜索范围和文档分组。父子文档不会自动成组；只有直接成员开启“包含子文档”后，子文档页签才会被收进该页签组。
                    </div>
                    ${groupsForTabs.length ? `
                        <div style="display:flex;flex-direction:column;gap:10px;">
                            ${groupsForTabs.map((group) => {
                                const gid = String(group?.id || '').trim();
                                const groupName = String(group?.name || '').trim() || '未命名页签组';
                                const entries = Array.isArray(group?.entries) ? group.entries : [];
                                return `
                                    <div style="border:1px solid var(--tm-border-color);border-radius:8px;background:var(--tm-card-bg);padding:10px;">
                                        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
                                            <div style="min-width:0;">
                                                <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(groupName)}</div>
                                                <div style="font-size:11px;color:var(--tm-secondary-text);margin-top:2px;">${entries.length} 个直接成员</div>
                                            </div>
                                            <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
                                                <button class="tm-btn tm-btn-secondary" onclick="tmRenameDocTabCustomGroup('${escSq(gid)}')" style="padding:3px 8px;font-size:11px;">重命名</button>
                                                <button class="tm-btn tm-btn-danger" onclick="tmDeleteDocTabCustomGroup('${escSq(gid)}')" style="padding:3px 8px;font-size:11px;">删除</button>
                                            </div>
                                        </div>
                                        <div style="display:flex;gap:8px;margin-bottom:8px;">
                                            <input data-tm-doc-tab-group-entry-input type="text" placeholder="输入文档 ID"
                                                style="flex:1;min-width:0;padding:6px 8px;border:1px solid var(--tm-input-border);background:var(--tm-input-bg);color:var(--tm-text-color);border-radius:4px;font-size:12px;">
                                            <button class="tm-btn tm-btn-primary" onclick="tmAddDocTabCustomGroupEntryFromInput('${escSq(gid)}', this)" style="padding:4px 10px;font-size:12px;">添加</button>
                                        </div>
                                        ${entries.length ? `
                                            <div style="display:flex;flex-direction:column;gap:6px;">
                                                ${entries.map((entry) => {
                                                    const docId = String(entry?.id || '').trim();
                                                    if (!docId) return '';
                                                    const doc = resolveDocTabGroupDoc(docId);
                                                    const docName = resolveDocName(docId);
                                                    const includeChildren = !!entry.includeChildren;
                                                    const childDocs = __tmGetDocTabChildDocs(docId, [doc]).filter((child) => String(child?.id || '').trim() !== docId);
                                                    const childPreview = childDocs.slice(0, 6);
                                                    return `
                                                        <div style="border:1px solid var(--tm-border-color);border-radius:6px;padding:8px;background:var(--tm-bg-color);">
                                                            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                                                                <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                                                                    ${__tmRenderDocIcon(doc, { size: 14 })}
                                                                    <div style="min-width:0;">
                                                                        <div style="font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(docName)}">${esc(docName)}</div>
                                                                        <div style="font-size:11px;color:var(--tm-task-done-color);font-family:monospace;">${esc(docId.slice(0, 8))}...</div>
                                                                    </div>
                                                                </div>
                                                                <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                                                                    <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;user-select:none;">
                                                                        <input class="b3-switch fn__flex-center" type="checkbox" ${includeChildren ? 'checked' : ''} onchange="tmToggleDocTabCustomGroupEntryChildren('${escSq(gid)}', '${escSq(docId)}', this.checked)">
                                                                        包含子文档
                                                                    </label>
                                                                    <button class="tm-btn tm-btn-danger" onclick="tmRemoveDocFromDocTabCustomGroup('${escSq(gid)}', '${escSq(docId)}')" style="padding:2px 7px;font-size:11px;">移除</button>
                                                                </div>
                                                            </div>
                                                            <div style="margin-top:7px;font-size:12px;color:var(--tm-secondary-text);line-height:1.7;">
                                                                ${childDocs.length ? `
                                                                    <div style="margin-bottom:2px;">检测到 ${childDocs.length} 个子文档${includeChildren ? '，符合页签显示条件时会收入页签组' : ''}</div>
                                                                    <div style="display:flex;flex-direction:column;gap:2px;">
                                                                        ${childPreview.map((child) => {
                                                                            const depth = Math.max(1, Number(child?.depth) || 1);
                                                                            const childName = __tmGetDocDisplayName(child, child.name || '未命名文档');
                                                                            return `<div style="padding-left:${Math.min(28, depth * 10)}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">↳ ${esc(childName)}</div>`;
                                                                        }).join('')}
                                                                        ${childDocs.length > childPreview.length ? `<div style="padding-left:10px;">还有 ${childDocs.length - childPreview.length} 个...</div>` : ''}
                                                                    </div>
                                                                ` : '当前未检测到子文档。开启后，后续符合父子路径的子文档也会收入页签组。'}
                                                            </div>
                                                        </div>
                                                    `;
                                                }).join('')}
                                            </div>
                                        ` : '<div style="color: var(--tm-secondary-text); font-size: 12px; padding: 8px; background: var(--tm-rule-group-bg); border-radius: 6px;">暂无成员。可以右击文档页签加入，或在上方输入文档 ID。</div>'}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    ` : '<div style="color: var(--tm-secondary-text); font-size: 13px; padding: 10px; background: var(--tm-rule-group-bg); border-radius: 8px;">暂无页签组。右击任意文档页签可快速新建并加入。</div>'}
                </div>
            `;
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
        const newTaskDefaultLocationMode = __tmNormalizeNewTaskDefaultLocationMode(SettingsStore.data.newTaskDefaultLocationMode);
        const selectedNewTaskLocation = newTaskDefaultLocationMode === 'lastSelected' ? '__lastSelected__' : newTaskDocId;
        const newTaskDailyNoteNotebookId = String(SettingsStore.data.newTaskDailyNoteNotebookId || '').trim();
        const newTaskDocOptions = [
            `<option value="" ${selectedNewTaskLocation ? '' : 'selected'}>未设置</option>`,
            `<option value="__dailyNote__" style="font-weight:700;" ${selectedNewTaskLocation === '__dailyNote__' ? 'selected' : ''}>今天日记</option>`,
            `<option value="__lastSelected__" style="font-weight:700;" ${selectedNewTaskLocation === '__lastSelected__' ? 'selected' : ''}>上次选择</option>`
        ];
        allDocsForNewTask.forEach(docItem => {
            const docId = typeof docItem === 'object' ? docItem.id : docItem;
            const docName = resolveDocName(docId);
            newTaskDocOptions.push(`<option value="${docId}" ${selectedNewTaskLocation === docId ? 'selected' : ''}>${esc(docName)}</option>`);
        });
        if (newTaskDocId && newTaskDocId !== '__dailyNote__' && !allDocIdsForNewTask.includes(newTaskDocId)) {
            const fallbackName = resolveDocName(newTaskDocId);
            newTaskDocOptions.push(`<option value="${newTaskDocId}" ${selectedNewTaskLocation === newTaskDocId ? 'selected' : ''}>${esc(fallbackName)} (不在当前列表)</option>`);
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
            try {
                if (!Array.isArray(state.allDocuments) || !state.allDocuments.length) {
                    if (!state.settingsDocPickerDocumentsLoading) {
                        state.settingsDocPickerDocumentsLoading = true;
                        let loadedDocuments = false;
                        Promise.resolve(__tmEnsureAllDocumentsLoaded(false))
                            .then((docs) => { loadedDocuments = Array.isArray(docs) && docs.length > 0; })
                            .catch(() => null)
                            .finally(() => {
                                state.settingsDocPickerDocumentsLoading = false;
                                if (loadedDocuments && state.settingsModal && document.body.contains(state.settingsModal)) showSettings();
                            });
                    }
                } else {
                    __tmEnsureAllDocumentsLoaded(false).catch(() => null);
                }
            } catch (e) {}
        }
        let settingsSearchCurrentSection = '';
        const renderSettingsSubtabs = () => {
            const sections = __tmGetSettingsSections(activeTab);
            if (!sections.length) return '';
            return `
                <div class="tm-settings-subtabs">
                    <div class="tm-settings-subtabs-inner">
                        ${sections.map((section, index) => `
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
        const renderEntryIconPresetSetting = () => {
            const registry = globalThis.__taskHorizonEntryIconRegistry;
            const presets = Array.isArray(registry?.presets) ? registry.presets : [];
            if (!presets.length) return '';
            const hasFullFeature = typeof window.tmLicenseHasFeature === 'function' && window.tmLicenseHasFeature('pro');
            const selected = __tmNormalizeEntryIconPreset(registry?.getActivePreset?.() || SettingsStore.data.entryIconPreset);
            return `
                <div class="tm-entry-icon-picker" role="radiogroup" aria-label="任务管理器插件图标">
                    ${presets.map((preset, index) => {
                        const id = String(preset?.id || '').trim();
                        const label = String(preset?.label || id).trim() || id;
                        const symbolId = String(preset?.symbolId || '').trim();
                        const active = id === selected;
                        const locked = id !== 'classic' && !hasFullFeature;
                        const orderLabel = id === 'classic' ? '默认' : String(index).padStart(2, '0');
                        return `
                            <button
                                type="button"
                                class="tm-entry-icon-option${active ? ' is-active' : ''}${locked ? ' is-locked' : ''}"
                                role="radio"
                                aria-checked="${active ? 'true' : 'false'}"
                                aria-label="${esc(label)}${locked ? '，全功能权益' : ''}"
                                title="${esc(label)}${locked ? ' · 全功能权益' : ''}"
                                onclick="tmUpdateEntryIconPreset('${escSq(id)}')"
                            >
                                <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#${esc(symbolId)}" xlink:href="#${esc(symbolId)}"></use></svg>
                                <span>${orderLabel} ${esc(label)}</span>
                                ${locked ? '<small>全功能</small>' : ''}
                            </button>
                        `;
                    }).join('')}
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
            const experienceMode = String(SettingsStore.data.aiExperienceMode || '').trim() === 'legacy' ? 'legacy' : 'agent';
            const scheduledEventsPanel = __tmRenderScheduledEventsSettingsPanel();
            const policyPanel = typeof __tmRenderAgentPolicySettingsPanel === 'function' ? __tmRenderAgentPolicySettingsPanel() : '';
            const renderAgentToolSettings = (hasFullFeature) => {
                const groups = typeof window.tmGetAgentMcpToolGroups === 'function'
                    ? window.tmGetAgentMcpToolGroups()
                    : [];
                const toolsEnabled = hasFullFeature && SettingsStore.data.agentMcpEnabled === true;
                if (!Array.isArray(groups) || !groups.length) {
                    return `
                        <div class="tm-agent-tool-settings is-disabled">
                            <div class="tm-agent-tool-settings__summary">正在读取工具列表…</div>
                        </div>
                    `;
                }
                const totalCount = groups.reduce((sum, group) => sum + (Array.isArray(group?.tools) ? group.tools.length : 0), 0);
                const enabledCount = groups.reduce((sum, group) => sum + (Array.isArray(group?.tools) ? group.tools.filter((tool) => tool?.effectiveEnabled === true).length : 0), 0);
                const deniedCount = groups.reduce((sum, group) => sum + (Array.isArray(group?.tools) ? group.tools.filter((tool) => tool?.enabled === true && tool?.agentAllowed === false).length : 0), 0);
                return `
                    <div class="tm-agent-tool-settings${toolsEnabled ? '' : ' is-disabled'}">
                        <div class="tm-agent-tool-settings__summary">
                            <span>按需要保留工具；关闭后会从下一次智能体对话中移除，可减少模型上下文占用，不影响任务管理器界面。这里的开关会同步思源智能体能力设置。</span>
                            <span class="tm-agent-tool-settings__count">${enabledCount}/${totalCount} 可用${deniedCount ? ` · 思源关闭 ${deniedCount}` : ''}</span>
                        </div>
                        ${groups.map((group) => {
                            const tools = Array.isArray(group?.tools) ? group.tools : [];
                            const groupEnabledCount = tools.filter((tool) => tool?.effectiveEnabled === true).length;
                            const groupDeniedCount = tools.filter((tool) => tool?.enabled === true && tool?.agentAllowed === false).length;
                            const allEnabled = tools.length > 0 && groupEnabledCount === tools.length;
                            const partial = groupEnabledCount > 0 && !allEnabled;
                            const groupID = String(group?.id || '').trim();
                            const expanded = __tmAgentMcpExpandedToolGroups.has(groupID);
                            return `
                                <details class="tm-agent-tool-group${partial ? ' is-partial' : ''}" ${expanded ? 'open' : ''} ontoggle="tmSetAgentMcpToolGroupExpanded('${escSq(groupID)}', this.open)">
                                    <summary class="tm-agent-tool-group__head">
                                        <div class="tm-agent-tool-group__copy">
                                            <div class="tm-agent-tool-group__title">${esc(String(group?.label || groupID))}</div>
                                            <div class="tm-agent-tool-group__desc">${esc(String(group?.description || ''))}</div>
                                        </div>
                                        <div class="tm-agent-tool-group__control">
                                            <span>${groupEnabledCount}/${tools.length}${groupDeniedCount ? ` · 思源关闭 ${groupDeniedCount}` : ''}</span>
                                            <input class="b3-switch fn__flex-center" type="checkbox" ${allEnabled ? 'checked' : ''} ${toolsEnabled ? '' : 'disabled'} aria-label="${allEnabled ? '关闭' : '启用'}${esc(String(group?.label || groupID))}分组" onclick="event.stopPropagation()" onchange="tmUpdateAgentMcpGroup('${escSq(groupID)}', this.checked)">
                                            <svg class="tm-agent-tool-group__chevron" aria-hidden="true"><use xlink:href="#iconDown"></use></svg>
                                        </div>
                                    </summary>
                                    <div class="tm-agent-tool-group__items">
                                        ${tools.map((tool) => {
                                            const name = String(tool?.name || '').trim();
                                            const agentDenied = tool?.enabled === true && tool?.agentAllowed === false;
                                            return `
                                                <label class="tm-agent-tool-item${agentDenied ? ' is-agent-denied' : ''}" title="${esc(agentDenied ? `${name}：已在思源智能体能力设置中关闭` : name)}">
                                                    <span>${esc(String(tool?.label || name))}${agentDenied ? '<small>思源已关闭</small>' : ''}</span>
                                                    <input class="b3-switch fn__flex-center" type="checkbox" ${tool?.effectiveEnabled === true ? 'checked' : ''} ${toolsEnabled ? '' : 'disabled'} onchange="tmUpdateAgentMcpTool('${escSq(name)}', this.checked)">
                                                </label>
                                            `;
                                        }).join('')}
                                    </div>
                                </details>
                            `;
                        }).join('')}
                    </div>
                `;
            };
            const conversationFontSize = Number.isFinite(Number(SettingsStore.data.aiConversationFontSize))
                ? Math.max(12, Math.min(22, Math.round(Number(SettingsStore.data.aiConversationFontSize))))
                : 14;
            const modePanel = `
                <div class="tm-settings-panel" data-tm-settings-section="ai-mode" ${__tmSettingsSearchAttrs('ai', 'AI 工作方式', '思源智能体或旧版 AI')}>
                    <div class="tm-settings-section-title">AI 工作方式</div>
                    <div class="tm-settings-section-desc">默认使用思源智能体；旧版会话和设置保持独立，不会迁移或混合。</div>
                    ${renderSingleFieldSetting(
                        '当前模式',
                        experienceMode === 'agent'
                            ? '使用思源智能体的文档处理、会话和工具能力，插件补充任务界面与上下文。'
                            : '继续使用插件原有模型供应商、提示词和会话。',
                        `<select class="b3-select" onchange="tmUpdateAiExperienceMode(this.value)" style="width:220px;">
                            <option value="agent" ${experienceMode === 'agent' ? 'selected' : ''}>思源智能体（默认）</option>
                            <option value="legacy" ${experienceMode === 'legacy' ? 'selected' : ''}>旧版插件 AI</option>
                        </select>`
                    )}
                    ${renderSingleFieldSetting(
                        '对话字体大小',
                        '调整用户和助手的对话正文，不影响输入框、工具卡片及其他界面。',
                        `<label style="display:flex;align-items:center;gap:6px;">
                            <input class="b3-text-field" type="number" min="12" max="22" step="1" value="${conversationFontSize}" onchange="tmUpdateAiConversationFontSize(this.value)" style="width:72px;">
                            <span class="tm-setting-field-unit">px</span>
                        </label>`
                    )}
                </div>
            `;
            if (experienceMode === 'agent') {
                const hasFullFeature = typeof window.tmLicenseHasFeature === 'function' && window.tmLicenseHasFeature('pro');
                return `${modePanel}
                    <div class="tm-settings-panel" data-tm-settings-section="ai-agent" ${__tmSettingsSearchAttrs('ai', '思源智能体', '任务、日程、提醒、安排规则和统计工具')}>
                        <div class="tm-settings-section-title">思源智能体</div>
                        <div class="tm-settings-section-desc">模型、密钥、通用工具和会话由思源统一管理；任务管理器只补充任务上下文与领域操作。</div>
                        ${renderSingleSwitchSetting(
                            '启用 AI 功能',
                            '关闭后隐藏任务管理器内的 AI 入口，不影响思源自身的智能体。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.aiEnabled ? 'checked' : ''} onchange="tmUpdateAiEnabled(this.checked)">`
                        )}
                        ${renderSingleSwitchSetting(
                            '启用任务 MCP 工具',
                            hasFullFeature
                                ? '开启后，Task Horizon 会把所选任务、日程、提醒、安排规则和统计能力注册到思源智能体。思源主智能体、插件工作台及其他使用同一智能体运行时的入口都可以调用；普通写入会确认，删除需要先预览。'
                                : '免费版保持关闭，仍可使用思源智能体的文档对话；升级全功能后可启用这些任务 MCP 工具。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${hasFullFeature && SettingsStore.data.agentMcpEnabled ? 'checked' : ''} ${hasFullFeature ? '' : 'disabled'} onchange="tmUpdateAgentMcpEnabled(this.checked)">`
                        )}
                        ${hasFullFeature ? renderAgentToolSettings(hasFullFeature) : ''}
                        ${renderSingleFieldSetting(
                            '工作流程',
                            '任务收集、计划、复盘和模板四类流程会按可用能力逐步启用。',
                            `<span class="tm-setting-field-unit">任务收集 · 任务计划 · 任务复盘 · 场景模板</span>`
                        )}
                        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
                            <button class="tm-btn tm-btn-secondary" onclick="tmAiTestConnection()">检查智能体</button>
                        </div>
                    </div>
                    ${hasFullFeature ? policyPanel : ''}
                    ${scheduledEventsPanel}
                `;
            }
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
            return `${modePanel}
                <div class="tm-settings-panel" data-tm-settings-section="ai-connection" ${__tmSettingsSearchAttrs('ai', 'AI 接入', '供应商、API Key、Base URL、模型、温度、超时和上下文模式')}>
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
                ${scheduledEventsPanel}
            `;
        };

        const renderSettingsModalMarkup = () => `
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
                            <button class="tm-settings-nav-btn ${activeTab === 'benefits' ? 'is-active' : ''}" data-tm-action="tmSwitchSettingsTab" data-tab="benefits">💎 功能权益</button>
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
                        ${renderSettingsSubtabs()}
                        <div class="tm-settings-panel tm-width-settings" data-tm-settings-section="columns" ${__tmSettingsSearchAttrs('appearance', '列设置', '显示、排序、宽度和自定义列')}>
                            <div style="font-weight: 600; margin-bottom: 12px;">📏 列设置 (显示/排序/宽度)</div>
                            ${renderColumnWidthSettings()}
                            ${renderSingleFieldSetting(
                                '高级：内置字段属性名与迁移',
                                '自定义开始日期、截止日期、重要性、状态、完成时间等内置字段的属性名，并按字段选择是否迁移旧值。',
                                `<button class="tm-btn tm-btn-secondary" onclick="tmOpenTaskMetaAttrMigrationDialog()">打开高级设置</button>`,
                                { style: 'margin-top:12px;', section: 'columns', key: 'appearance-task-meta-attr-migration' }
                            )}
                        </div>
                        <div class="tm-settings-panel" data-tm-settings-section="icons" ${__tmSettingsSearchAttrs('appearance', '插件图标', '统一更换顶栏、文档栏、页签、Dock 侧栏和插件顶栏左上角图标')}>
                            <div style="font-weight: 600; margin-bottom: 6px;">插件图标</div>
                            <div style="font-size:13px;color:var(--tm-secondary-text);line-height:1.6;margin-bottom:12px;">统一应用于思源窗口顶栏、文档栏、插件页签、Dock 侧栏和插件顶栏左上角。经典图标免费可用，其余预设属于全功能权益。</div>
                            ${renderEntryIconPresetSetting()}
                        </div>
                        <div class="tm-settings-panel" data-tm-settings-section="tabs" ${__tmSettingsSearchAttrs('appearance', '页签栏', '手动控制归档 归档入口位置', { section: 'tabs' })}>
                            <div style="font-weight: 600; margin-bottom: 12px;">📑 页签栏</div>
                            ${renderSingleSwitchSetting(
                                '手动控制归档',
                                '开启后，任务全部完成不会自动把文档页签移入归档区；仅通过页签菜单执行归档。',
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.docTabsManualArchiveOnly ? 'checked' : ''} onchange="updateDocTabsManualArchiveOnly(this.checked)">`,
                                { section: 'tabs' }
                            )}
                            ${renderSingleFieldSetting(
                                '归档入口位置',
                                '控制页签栏里归档按钮显示在“全部”页签前，或保留在文档页签后。',
                                `<select class="b3-select" onchange="updateDocTabsArchiveButtonPosition(this.value)" style="width:180px;">
                                    <option value="before-all" ${String(SettingsStore.data.docTabsArchiveButtonPosition || '') === 'before-all' ? 'selected' : ''}>全部页签前左侧</option>
                                    <option value="after-docs" ${String(SettingsStore.data.docTabsArchiveButtonPosition || '') === 'before-all' ? '' : 'selected'}>文档页签后</option>
                                </select>`
                            )}
                        </div>
                        <div class="tm-settings-panel" data-tm-settings-section="topbar" ${__tmSettingsSearchAttrs('appearance', '顶栏按钮', '控制新建、搜索、刷新和 AI 工作台按钮的显示')}>
                            <div style="font-weight: 600; margin-bottom: 12px;">🔘 顶栏按钮</div>
                            ${renderSingleSwitchSetting(
                                '新建任务按钮',
                                '在桌面宽屏和紧凑顶栏显示新建任务入口。',
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${__tmIsTopbarButtonVisible('add') ? 'checked' : ''} onchange="tmUpdateTopbarButtonVisibility('add', this.checked)">`
                            )}
                            ${renderSingleSwitchSetting(
                                '搜索按钮',
                                '在桌面宽屏和紧凑顶栏显示任务搜索入口。',
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${__tmIsTopbarButtonVisible('search') ? 'checked' : ''} onchange="tmUpdateTopbarButtonVisibility('search', this.checked)">`
                            )}
                            ${renderSingleSwitchSetting(
                                '刷新按钮',
                                '在桌面宽屏和紧凑顶栏显示手动刷新入口。',
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${__tmIsTopbarButtonVisible('refresh') ? 'checked' : ''} onchange="tmUpdateTopbarButtonVisibility('refresh', this.checked)">`
                            )}
                            ${renderSingleSwitchSetting(
                                'AI 工作台按钮',
                                '仅在 AI 功能启用时显示，关闭 AI 后仍保留此偏好。',
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${__tmIsTopbarButtonVisible('ai') ? 'checked' : ''} onchange="tmUpdateTopbarButtonVisibility('ai', this.checked)">`
                            )}
                        </div>
                        <div class="tm-settings-panel" data-tm-settings-section="checkbox" ${__tmSettingsSearchAttrs('appearance', '任务复选框', '使用圆形任务复选框样式，按重要性上色')}>
                            <div style="font-weight: 600; margin-bottom: 12px;">☑️ 任务复选框</div>
                            ${renderSingleSwitchSetting(
                                '圆形任务复选框',
                                '使用圆形任务复选框样式',
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.taskCheckboxCircleStyleEnabled ? 'checked' : ''} onchange="updateTaskCheckboxCircleStyleEnabled(this.checked)">`
                            )}
                            ${renderSingleSwitchSetting(
                                '按重要性给文档任务复选框上色',
                                '根据任务重要性属性为文档内任务复选框着色',
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.taskCheckboxPriorityColorEnabled !== false ? 'checked' : ''} onchange="updateTaskCheckboxPriorityColorEnabled(this.checked)">`
                            )}
                        </div>
                        <div class="tm-settings-panel" data-tm-settings-section="colors" style="margin-bottom:0;" ${__tmSettingsSearchAttrs('appearance', '配色', '调整主题、看板、时间轴和顶栏颜色')}>
                            <div style="font-weight: 600; margin-bottom: 12px;">🎨 配色</div>
                            ${renderAppearanceColorSettings()}
                        </div>
                    ` : ''}

                    ${activeTab === 'calendar' ? `
                        ${renderSettingsSubtabs()}
                        <div id="tm-calendar-settings-root"></div>
                    ` : ''}

                    ${activeTab === 'ai' ? `${renderSettingsSubtabs()}${renderAiSettingsPanel()}` : ''}

                    ${activeTab === 'rules' ? `
                        <div class="tm-settings-panel" ${__tmSettingsSearchAttrs('rules', '筛选规则管理', '新建、编辑、应用和删除筛选规则')}>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                <div style="font-weight: 600;">📋 筛选规则管理</div>
                                <div style="display:flex;gap:8px;align-items:center;">
                                    <button class="tm-btn tm-btn-secondary" data-tm-action="tmSwitchSettingsTab" data-tab="priority" style="padding: 4px 10px; font-size: 12px;">优先级算法</button>
                                    <button class="tm-btn tm-btn-primary" data-tm-action="addNewRule" style="padding: 4px 10px; font-size: 12px;">+ 新建规则</button>
                                </div>
                            </div>
                            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; border:1px solid var(--tm-border-color); border-radius:8px; background: var(--tm-card-bg); margin-bottom: 12px;" ${__tmSettingsSearchAttrs('rules', '时间轴强制按截止日期排序', '时间轴规则排序行为')}>
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

                    ${activeTab === 'benefits' ? `
                        ${typeof __tmRenderBenefitsSettingsPanel === 'function' ? __tmRenderBenefitsSettingsPanel() : ''}
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
                    ${renderSettingsSubtabs()}
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
                        <div class="tm-settings-section-title">📍 新建/归档</div>
                        <div class="tm-settings-section-desc">设置新建任务的默认位置，以及删除和完成任务后的归档方式。</div>
                        ${renderSingleFieldSetting(
                            '默认新建文档',
                            '用于“快速新建任务界面”的默认位置；选择“上次选择”后，会记住最近一次手动选择的文档或今天日记。',
                            `<select class="b3-select" onchange="updateNewTaskDocIdFromSelect(this.value)" style="width:100%;">
                                ${newTaskDocOptions.join('')}
                            </select>`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        <div style="display:flex; gap:8px; margin-top: 8px; align-items:center;">
                            <input id="tmNewTaskDocIdInput" class="b3-text-field" list="tmNewTaskDocIdList"
                                   value="${esc(selectedNewTaskLocation === '__dailyNote__' || selectedNewTaskLocation === '__lastSelected__' ? '' : (newTaskDocId || ''))}"
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
                            ${newTaskDocId && newTaskDocId !== '__dailyNote__' && !allDocIdsForNewTask.includes(newTaskDocId) ? `<option value="${newTaskDocId}"></option>` : ''}
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
                            ${renderSingleFieldSetting(
                                '今天日记目标标题',
                                '配置后，新建任务到今天日记时会追加到同名标题分节末尾；标题不存在时自动创建。留空则继续使用日记默认位置规则。',
                                `<input class="b3-text-field" type="text"
                                       value="${esc(SettingsStore.data.newTaskDailyNoteTargetHeadingText || '')}"
                                       placeholder="例如：任务"
                                       onchange="updateNewTaskDailyNoteTargetHeadingText(this.value)"
                                       style="width:100%;">`
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
                            ${renderSingleSwitchSetting(
                                '快速新建默认截止日期为今天',
                                '开启后，打开快速新建时预先选中今天；提交前可修改或清空，多行任务会统一应用。',
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.quickAddDefaultCompletionToday ? 'checked' : ''} onchange="updateQuickAddDefaultCompletionToday(this.checked)">`
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
                        <div class="tm-settings-section-title" style="margin-top:20px;">任务归档</div>
                        <div class="tm-settings-section-desc">统一设置删除任务和完成顶层任务后的移动方式。</div>
                        ${renderSingleFieldSetting(
                            '删除任务时',
                            '永久删除仍会二次确认；移入回收站后可从提示中撤销。',
                            `<select class="b3-select" onchange="updateTaskDeleteMode(this.value)" style="width:220px;max-width:100%;">
                                <option value="permanent" ${__tmNormalizeTaskDeleteMode(SettingsStore.data.taskDeleteMode) === 'permanent' ? 'selected' : ''}>永久删除</option>
                                <option value="recycle" ${__tmNormalizeTaskDeleteMode(SettingsStore.data.taskDeleteMode) === 'recycle' ? 'selected' : ''}>移入回收站</option>
                            </select>`
                        )}
                        ${renderSingleFieldSetting(
                            '回收站文档 ID',
                            '仅在删除方式为“移入回收站”时使用；清空表示未设置。',
                            `<input class="b3-text-field" type="text"
                                    value="${esc(SettingsStore.data.taskRecycleDocId || '')}"
                                    placeholder="输入回收站文档 ID"
                                    autocomplete="off" spellcheck="false"
                                    onchange="updateTaskRecycleDocId(this.value)"
                                    style="width:100%;"
                                    ${__tmNormalizeTaskDeleteMode(SettingsStore.data.taskDeleteMode) === 'recycle' ? '' : 'disabled'}>`,
                            { style: 'margin-top:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            '完成顶层任务后',
                            '子任务和循环任务不会自动移动。两种归档位置互斥。',
                            `<select class="b3-select" onchange="updateTaskCompletionArchiveMode(this.value)" style="width:260px;max-width:100%;">
                                <option value="none" ${__tmNormalizeTaskCompletionArchiveMode(SettingsStore.data.taskCompletionArchiveMode) === 'none' ? 'selected' : ''}>不移动</option>
                                <option value="document" ${__tmNormalizeTaskCompletionArchiveMode(SettingsStore.data.taskCompletionArchiveMode) === 'document' ? 'selected' : ''}>移入指定归档文档</option>
                                <option value="heading" ${__tmNormalizeTaskCompletionArchiveMode(SettingsStore.data.taskCompletionArchiveMode) === 'heading' ? 'selected' : ''}>移到当前文档“已完成”标题下</option>
                            </select>`,
                            { style: 'margin-top:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            '完成归档文档 ID',
                            '仅在完成后选择“移入指定归档文档”时使用；清空表示未设置。',
                            `<input class="b3-text-field" type="text"
                                    value="${esc(SettingsStore.data.taskCompletionArchiveDocId || '')}"
                                    placeholder="输入完成归档文档 ID"
                                    autocomplete="off" spellcheck="false"
                                    onchange="updateTaskCompletionArchiveDocId(this.value)"
                                    style="width:100%;"
                                    ${__tmNormalizeTaskCompletionArchiveMode(SettingsStore.data.taskCompletionArchiveMode) === 'document' ? '' : 'disabled'}>`,
                            { style: 'margin-top:10px;' }
                        )}
                        <div style="font-size:12px;color:var(--tm-secondary-text);line-height:1.5;margin-top:8px;">
                            创建“已完成”标题时使用基础显示中的任务标题级别；已有标题保留原等级。取消完成后，任务回到来源文档当前的默认新建位置。撤销回收会恢复任务块及属性，不恢复已清理的日程和白板关联。
                        </div>
                    </div>

                    ${(settingsSearchCurrentSection = 'status', '')}
                    <div class="tm-settings-panel" style="margin-bottom: 16px;" data-tm-settings-section="status">
                        <div class="tm-settings-section-title">🏷️ 状态选项</div>
                        <div class="tm-settings-section-desc">${SettingsStore.data.legacyWin7CompatMode ? '维护任务状态列表；兼容旧版 Win7 思源时，任务方括号内仅使用空格和 X，未完成状态统一写为空格，已完成状态写为 X。' : '维护任务状态列表；语法标记会写入任务 <code>- [ ]</code> 的方括号中，空格表示未完成，其他字符会被思源视为已勾选。'}</div>
                        <div id="tm-status-options-list">
                            ${renderStatusOptionsList()}
                        </div>
                        <button class="tm-btn tm-btn-primary" data-tm-action="addStatusOption" style="margin-top: 8px; margin-bottom: 10px; font-size: 12px;">+ 添加状态</button>
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
                        ${renderSingleSwitchSetting(
                            '子任务状态自动同步父任务',
                            '开启后，所有直接子任务都完成时自动完成父任务；任一直接子任务恢复未完成时，父任务也会恢复为未完成。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.autoCompleteParentOnSubtasksDone ? 'checked' : ''} onchange="updateAutoCompleteParentOnSubtasksDone(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--tm-border-color);">
                            <div class="tm-settings-section-title">FSRS 间隔重复</div>
                            <div class="tm-settings-section-desc">FSRS 根据实际复习反馈安排下一次日期；参数修改只影响后续评分。</div>
                            ${renderSingleFieldSetting(
                                '目标记忆率',
                                '越高会安排得越频繁，推荐保持 90%。',
                                `<input class="b3-text-field" type="number" value="${Math.round((Number(SettingsStore.data.fsrsDesiredRetention) || 0.9) * 100)}" min="80" max="97" step="1" onchange="updateFsrsDesiredRetentionPercent(this.value)" style="width:88px;">
                                 <span class="tm-setting-field-unit">%</span>`
                            )}
                            ${renderSingleFieldSetting(
                                '最大复习间隔',
                                '限制一次排期最多向后延伸的天数。',
                                `<input class="b3-text-field" type="number" value="${Math.max(30, Math.min(3650, Number(SettingsStore.data.fsrsMaximumIntervalDays) || 3650))}" min="30" max="3650" step="1" onchange="updateFsrsMaximumIntervalDays(this.value)" style="width:88px;">
                                 <span class="tm-setting-field-unit">天</span>`
                            )}
                            ${renderSingleSwitchSetting(
                                '分散复习日期',
                                '为较长间隔加入少量随机扰动，减少大量任务集中在同一天。',
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.fsrsEnableFuzz === true ? 'checked' : ''} onchange="updateFsrsEnableFuzz(this.checked)">`
                            )}
                        </div>
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
                            '移动端启动时自动打开任务管理器',
                            '仅在 Android、iOS 和 HarmonyOS 思源 App 冷启动后生效。启动同步仍在进行时先显示本地数据，数据合并完成后自动刷新。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.mobileAutoOpenOnStartup === true ? 'checked' : ''} onchange="updateMobileAutoOpenOnStartup(this.checked)">`,
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
                            'Dock侧边栏跟随当前文档',
                            '开启后，当 Dock 侧边栏正在显示且任务管理器页签未激活时，切换思源文档会同步切换到 Dock 中对应的文档页签；当前文档不在 Dock 当前分组内时保持原视图。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.dockSidebarFollowCurrentDocument ? 'checked' : ''} ${SettingsStore.data.dockSidebarEnabled !== false ? '' : 'disabled'} onchange="updateDockSidebarFollowCurrentDocument(this.checked)">`,
                            { style: `margin-bottom:10px;opacity:${SettingsStore.data.dockSidebarEnabled !== false ? 1 : 0.6};` }
                        )}
                        ` : ''}
                        <div class="tm-settings-section-title" style="margin-top:20px;">任务标题点击</div>
          <div class="tm-settings-section-desc">统一控制全部任务视图中的标题点击行为。按住 Ctrl（macOS 为 Cmd）点击标题，会在“跳转任务”和“打开详情”之间临时反转。</div>
                        ${renderSingleFieldSetting(
                            '默认动作',
                            '桌面主界面中的任务标题默认执行此动作。',
                            `<select class="b3-select" onchange="updateTaskTitleClickAction(this.value)" style="width:180px;">
                                <option value="jump" ${__tmNormalizeTaskTitleClickAction(SettingsStore.data.taskTitleClickAction) === 'jump' ? 'selected' : ''}>跳转任务</option>
                                <option value="detail" ${__tmNormalizeTaskTitleClickAction(SettingsStore.data.taskTitleClickAction) === 'detail' ? 'selected' : ''}>打开详情</option>
                            </select>`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${!__tmIsRuntimeMobileClient() ? renderSingleFieldSetting(
                            'Dock',
                            '任务 Dock 可跟随默认动作，或使用独立动作。',
                            `<select class="b3-select" onchange="updateDockTaskTitleClickAction(this.value)" style="width:180px;">
                                <option value="inherit" ${__tmNormalizeTaskTitleClickOverride(SettingsStore.data.dockTaskTitleClickAction) === 'inherit' ? 'selected' : ''}>跟随默认</option>
                                <option value="jump" ${__tmNormalizeTaskTitleClickOverride(SettingsStore.data.dockTaskTitleClickAction) === 'jump' ? 'selected' : ''}>跳转任务</option>
                                <option value="detail" ${__tmNormalizeTaskTitleClickOverride(SettingsStore.data.dockTaskTitleClickAction) === 'detail' ? 'selected' : ''}>打开详情</option>
                            </select>`,
                            { style: 'margin-bottom:10px;' }
                        ) : ''}
                        ${renderSingleFieldSetting(
                            '移动端',
                            '移动端可跟随默认动作，或使用独立动作。',
                            `<select class="b3-select" onchange="updateMobileTaskTitleClickAction(this.value)" style="width:180px;">
                                <option value="inherit" ${__tmNormalizeTaskTitleClickOverride(SettingsStore.data.mobileTaskTitleClickAction) === 'inherit' ? 'selected' : ''}>跟随默认</option>
                                <option value="jump" ${__tmNormalizeTaskTitleClickOverride(SettingsStore.data.mobileTaskTitleClickAction) === 'jump' ? 'selected' : ''}>跳转任务</option>
                                <option value="detail" ${__tmNormalizeTaskTitleClickOverride(SettingsStore.data.mobileTaskTitleClickAction) === 'detail' ? 'selected' : ''}>打开详情</option>
                            </select>`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        <div style="margin-bottom:10px;">
                            ${renderSingleFieldSetting(
                                'Dock 及移动端紧凑右侧字段',
                                '控制 Dock 侧边栏、移动端清单紧凑视图，以及日历视图侧边栏任务清单里任务右侧显示哪些信息。默认显示截止日期和状态标签，二级标题仅在任务有所属标题时显示。',
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
                            '控制桌面端清单紧凑视图里任务右侧显示哪些信息。默认显示截止日期和状态标签，文档名仅在全部页签下显示，二级标题仅在任务有所属标题时显示。',
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
                        ${renderSingleFieldSetting(
                            '全部页签时间轴依赖线',
                            '仅影响全部页签时间轴；单文档时间轴始终使用各文档连线。全局模式读取当前分组的全局白板连线。',
                            `<select class="b3-select" onchange="tmUpdateTimelineDependencyScope(this.value)" style="width:220px;max-width:100%;">
                                <option value="global" ${SettingsStore.data.timelineDependencyScope === 'global' ? 'selected' : ''}>全局白板连线</option>
                                <option value="local" ${SettingsStore.data.timelineDependencyScope === 'local' ? 'selected' : ''}>各文档连线</option>
                            </select>`,
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
                        ${renderSingleSwitchSetting(
                            '删除任务同步删除白板卡片',
                            '开启后，删除任务本体时同步移除白板上的对应卡片、快照和手动连线；关闭后保留白板卡片作为历史记录。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.deleteTaskRemovesWhiteboardCards !== false ? 'checked' : ''} onchange="updateDeleteTaskRemovesWhiteboardCards(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            '白板顺序依据',
                            '启用白板顺序模式后，选择按当前文档分组的全局白板，或按每个文档自己的白板连线计算当前顺序。',
                            `<select class="b3-select" onchange="updateWhiteboardSequenceScope(this.value)" style="width:180px;">
                                <option value="document" ${__tmNormalizeWhiteboardSequenceScope(SettingsStore.data.whiteboardSequenceScope) === 'document' ? 'selected' : ''}>单文档白板</option>
                                <option value="global" ${__tmNormalizeWhiteboardSequenceScope(SettingsStore.data.whiteboardSequenceScope) === 'global' ? 'selected' : ''}>全局白板</option>
                            </select>`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            '白板文字默认字号',
                            '文字模式中新建文字的默认字号；已创建的文字不受影响。',
                            `<input class="b3-text-field" type="number" min="10" max="40" step="1" value="${Math.max(10, Math.min(40, Math.round(Number(SettingsStore.data.whiteboardNoteDefaultFontSize) || 20)))}" onchange="updateWhiteboardNoteDefaultFontSize(this.value)" style="width:88px;">
                             <span class="tm-setting-field-unit">px</span>`,
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
                            '单独已完成看板列',
                            '在“已完成任务不单独分组”关闭时生效。开启后，标题看板和日期看板使用单独的“已完成”列；关闭时，已完成任务收纳到各列底部折叠分组。',
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
                            <div style="font-size:12px;color:var(--tm-secondary-text);margin-bottom:10px;">用于“时长与番茄”弹窗、专注列和常驻字段。关闭耗时评估后，实际番茄读取 Dock Tomato 完成倒计时累计的属性。</div>
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
                            '开启后，已完成任务跟随当前文档、时间、四象限或任务名分组显示；看板中也不再显示单独已完成列或列底部已完成分组。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.completedTasksInlineInGroups ? 'checked' : ''} onchange="updateCompletedTasksInlineInGroups(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            '文档分组下按任务标题级别子分组',
                            '按照“任务标题级别”设置（H1-H6）对子分组，用于时间轴、表格、文档流和日历侧边栏。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.docH2SubgroupEnabled !== false ? 'checked' : ''} onchange="updateDocH2SubgroupEnabled(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            '有任务的标题分组始终显示',
                            '开启后，在按文档分组时，只要当前“任务标题级别”下的标题包含任务，就始终保留标题分组行，不受任务完成状态或“显示已完成任务”开关影响。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.alwaysShowTaskDocHeadingGroups ? 'checked' : ''} ${SettingsStore.data.docH2SubgroupEnabled !== false ? '' : 'disabled'} onchange="updateAlwaysShowTaskDocHeadingGroups(this.checked)">`,
                            { style: `margin-bottom:10px;opacity:${SettingsStore.data.docH2SubgroupEnabled !== false ? 1 : 0.6};` }
                        )}
                        ${renderSingleSwitchSetting(
                            '分组模式增加“按任务名分组”',
                            '开启后，顶部“分组”下拉里会出现“按任务名”选项，用于把相同任务内容分为一组。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.groupByTaskName || SettingsStore.data.groupMode === 'task' ? 'checked' : ''} onchange="updateGroupByTaskName(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            '分组内置顶任务',
                            '开启后，表格、清单、看板和白板任务池在按文档、时间、四象限或任务名分组时，置顶任务留在所属分组内并排在组内最前。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.pinTasksWithinGroups ? 'checked' : ''} onchange="updatePinTasksWithinGroups(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            '自动识别语义日期（全量分批）',
                            '开启后，刷新任务后会分批扫描全部任务里的“明天/下周五/今晚8点/从明天到周五”等表达，并弹窗确认写入开始日期或截止日期。默认开启，如需避免同步后自动弹窗可关闭。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.semanticDateAutoPromptEnabled ? 'checked' : ''} onchange="updateSemanticDateAutoPromptEnabled(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            '语义截止默认提醒时间',
                            '当识别到“7月10日截止”这类仅日期截止时，自动按这个时间写入一次任务提醒。',
                            `<input type="time" value="${esc(String(SettingsStore.data.semanticDateDefaultReminderTime || '08:00'))}" onchange="updateSemanticDateDefaultReminderTime(this.value)" style="width:128px;padding:6px 8px;border:1px solid var(--tm-border-color);border-radius:6px;background:var(--tm-bg-color);color:var(--tm-text-color);">`,
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
                            '开启后，文档顶栏按钮在执行“打开任务管理器”时，会优先跳转到当前文档所在分组并切到该文档页签；若当前文档没有任务块或未加入分组，则保持原行为。之后从思源窗口顶栏打开时，会返回定位前分组的“全部”页签。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.docTopbarButtonLocateCurrentDocTab ? 'checked' : ''} onchange="updateDocTopbarButtonLocateCurrentDocTab(this.checked)">`
                        )}
                        ${renderSingleSwitchSetting(
                            '统计嵌入待办专注时长',
                            '开启后，任务管理器范围内的待办通过嵌入块显示在其他文档中时，也会在该文档右上角汇总显示专注时长。',
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.docTitleEmbeddedTaskFocusEnabled ? 'checked' : ''} ${SettingsStore.data.enableTomatoIntegration ? '' : 'disabled'} onchange="updateDocTitleEmbeddedTaskFocusEnabled(this.checked)">`
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
                            ${renderSingleSwitchSetting(
                                '按专注耗时评估实际番茄数',
                                '按总专注耗时除以 Dock Tomato 默认番茄时长计算，正计时耗时也会计入。',
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.tomatoActualCountBySpentEnabled !== false ? 'checked' : ''} ${SettingsStore.data.enableTomatoIntegration ? '' : 'disabled'} onchange="updateTomatoActualCountBySpentEnabled(this.checked)">`
                            )}
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

                    ${renderDocumentGroupManager()}

                    <div style="margin-bottom: 16px; padding: 12px; background: var(--tm-section-bg); border-radius: 8px;" ${__tmSettingsSearchAttrs('docs', '页签自定义分组', '独立弹窗管理页签组，勾选当前文档分组页签并选择是否包含子文档')}>
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
                            <div>
                                <div style="font-weight:600;">📑 页签自定义分组</div>
                                <div style="font-size:12px;color:var(--tm-secondary-text);line-height:1.6;margin-top:4px;">右击页签可快速加入；完整勾选、包含子文档和重命名请在独立弹窗中管理。</div>
                            </div>
                            <button class="tm-btn tm-btn-info" onclick="tmOpenDocTabCustomGroupSettings()" style="padding: 6px 12px; font-size: 12px;">管理页签分组</button>
                        </div>
                    </div>

                    ` : ''}
                </div>
                    </div>
                </div>
                ${renderSettingsActions('tm-settings-actions--mobile')}
            </div>
            ${settingsDocPickerDialogMarkup}
        `;
        state.settingsModal.innerHTML = renderSettingsModalMarkup();
        {
            const renderedActiveTab = activeTab;
            const renderedSection = settingsSearchCurrentSection;
            const capturedEntries = [];
            __tmSettingsSearchIndexBuilding = true;
            __tmSettingsSearchCaptureBuffer = capturedEntries;
            try {
                TM_SETTINGS_SEARCH_INDEX_TABS
                    .filter((tab) => !['calendar', 'benefits', 'about'].includes(tab))
                    .forEach((tab) => {
                        activeTab = tab;
                        settingsSearchCurrentSection = '';
                        renderSettingsModalMarkup();
                    });
                const calendarRenderer = globalThis.__tmCalendar?.renderSettings;
                if (typeof calendarRenderer === 'function') {
                    const calendarProbe = document.createElement('div');
                    calendarRenderer(calendarProbe, SettingsStore, { indexOnly: true });
                    __tmDecorateCalendarSettingsSearchRows(calendarProbe);
                    __tmCollectRenderedSettingsSearchEntries(calendarProbe).forEach((entry) => capturedEntries.push(entry));
                }
            } catch (e) {
                try { console.warn('[Task Horizon] settings search index build failed', e); } catch (e2) {}
            } finally {
                activeTab = renderedActiveTab;
                settingsSearchCurrentSection = renderedSection;
                __tmSettingsSearchCaptureBuffer = null;
                __tmSettingsSearchIndexBuilding = false;
            }
            const generatedMap = new Map();
            capturedEntries.forEach((raw) => {
                const entry = raw?.haystack ? raw : __tmCreateSettingsSearchEntry(raw);
                if (!entry) return;
                generatedMap.set(`${entry.tab}:${entry.key}`, entry);
            });
            state.settingsSearchGeneratedEntries = Array.from(generatedMap.values());
        }
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
                try { __tmBindHorizontalDragScroll(settingsSubtabs); } catch (e) {}
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
                    try {
                        requestAnimationFrame(() => {
                            try { __tmSyncSettingsSectionNav(state.settingsModal); } catch (e2) {}
                        });
                    } catch (e) {}
                    if (settingsSearchEnabled) {
                        __tmRefreshSettingsSearchResults(state.settingsModal);
                        __tmRunPendingSettingsSearchFocus(state.settingsModal);
                    }
                }
            }
        } catch (e) {}
    }
    window.showSettings = showSettings;
