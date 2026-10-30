    const TM_SETTINGS_SEARCH_MAX_RESULTS = Infinity;
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
            const fallbackName = path.split('/').filter(Boolean).pop() || __tmT("kernel.untitledDocument");
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

    function __tmRenderDocPickerTree(tree, options = {}) {
        const selectedIds = options.selectedIds || new Set();
        const disabledIds = options.disabledIds || new Set();
        const singleSelect = options.singleSelect === true;
        const icon = (name, size) => __tmRenderLucideIcon(name, '', { size });
        const renderNode = (node, depth = 0) => {
            const docId = String(node?.id || '').trim();
            if (!docId) return '';
            const displayName = __tmGetDocDisplayName(node.doc, node.name || __tmT("kernel.untitledDocument"));
            const alreadyAdded = disabledIds.has(docId);
            const checked = alreadyAdded || selectedIds.has(docId);
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
                        <input type="${singleSelect ? 'radio' : 'checkbox'}" ${singleSelect ? 'name="tm-document-location"' : ''} data-tm-doc-picker-checkbox value="${esc(docId)}"
                            ${checked ? 'checked' : ''}${alreadyAdded ? ' disabled' : ''}
                            ${singleSelect ? '' : `onchange="tmToggleSettingsDocPickerSelection('${escSq(docId)}', this.checked)"`}>
                        <span class="tm-doc-group-manager__picker-doc-icon">${icon('file-text', 14)}</span>
                        <span class="tm-doc-group-manager__picker-name" title="${esc(node.path || displayName)}">${esc(displayName)}</span>
                        ${alreadyAdded ? `<span class="tm-doc-group-manager__picker-status">${__tmT("settings.added")}</span>` : ''}
                    </label>
                </${rowTag}>
            `;
            if (!hasChildren) return `<div class="tm-doc-group-manager__picker-item" data-tm-doc-picker-item>${row}</div>`;
            return `
                <details class="tm-doc-group-manager__picker-item tm-doc-group-manager__picker-branch" data-tm-doc-picker-item>
                    <summary>${row}</summary>
                    <div class="tm-doc-group-manager__picker-children">${node.children.map(child => renderNode(child, depth + 1)).join('')}</div>
                </details>
            `;
        };
        const countNodes = nodes => nodes.reduce((count, node) => count + 1 + countNodes(node.children), 0);
        return tree.map(group => `
            <details class="tm-doc-group-manager__picker-notebook" data-tm-doc-picker-notebook>
                <summary>
                    <span class="tm-doc-group-manager__picker-chevron" aria-hidden="true">${icon('chevron-right', 14)}</span>
                    <span class="tm-doc-group-manager__picker-notebook-icon">${icon('archive', 14)}</span>
                    <span class="tm-doc-group-manager__picker-notebook-name">${esc(group.name)}</span>
                    <span class="tm-doc-group-manager__picker-notebook-count">${countNodes(group.roots)}</span>
                </summary>
                <div class="tm-doc-group-manager__picker-notebook-docs">${group.roots.map(node => renderNode(node)).join('')}</div>
            </details>
        `).join('');
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
        docs: __tmT("calendar.documentGroups"),
        main: __tmT("settings.general"),
        appearance: __tmT("settings.appearance"),
        calendar: __tmT("calendar.calendar"),
        ai: 'AI',
        rules: __tmT("settings.rules"),
        quadrant: __tmT("task.quadrants"),
        priority: __tmT("task.priorityScore"),
        benefits: __tmT("task.featureBenefits"),
        about: __tmT("settings.about")
    });
    const TM_SETTINGS_SEARCH_INDEX_TABS = Object.freeze(Object.keys(TM_SETTINGS_SEARCH_TAB_LABELS));
    // Shared with the settings controls so the native Agent never maintains a second copy of their text.
    const __tmSettingsQueryDefinitions = {
        fontSize: {
            title: __tmT("settings.fontSize"), description: __tmT("settings.setsTheBaseFontSizeOfTheDesktopTask"),
            page: 'appearance', sub: 'l-density', scope: __tmT("calendar.desktop"), aliases: [__tmT("settings.fontSize2"), __tmT("settings.textTooSmall"), __tmT("settings.desktop"), 'font'],
            read: data => Number(data.fontSize),
        },
        fontSizeMobile: {
            title: __tmT("settings.mobileFont"), description: __tmT("settings.setsTheMobileFontSizeSeparatelyFollowsTheDesktop"),
            page: 'appearance', sub: 'l-density', scope: __tmT("calendar.mobile"), aliases: [__tmT("settings.mobile"), __tmT("settings.fontSize2"), __tmT("settings.textTooSmall"), 'mobile'],
            read: data => Number(data.fontSizeMobile || data.fontSize),
        },
        rowHeightMode: {
            title: __tmT("settings.rowHeightMode"), description: __tmT("settings.controlsTheOverallDensityOfTaskRows"),
            page: 'appearance', sub: 'l-density', scope: __tmT("settings.global"), aliases: [__tmT("settings.lineSpacing"), __tmT("settings.density"), __tmT("settings.tooCramped"), __tmT("settings.compact"), __tmT("settings.relaxed")],
            read: data => String(data.rowHeightMode || 'auto'),
        },
        taskAutoWrapEnabled: {
            title: __tmT("settings.wordWrap"), description: __tmT("settings.wrapsTaskContentRemarksAndTaskContentInKanban"),
            page: 'appearance', sub: 'l-density', scope: __tmT("settings.global"), aliases: [__tmT("settings.titleTooLong"), __tmT("settings.truncated"), __tmT("settings.notFullyShown"), __tmT("settings.wrapping")],
            read: data => data.taskAutoWrapEnabled !== false,
        },
        taskContentWrapMaxLines: {
            title: __tmT("settings.desktopContentLines"), description: __tmT("settings.limitsTheMaximumNumberOfLinesShownForTask"),
            page: 'appearance', sub: 'l-density', scope: __tmT("calendar.desktop"), aliases: [__tmT("settings.titleTooLong"), __tmT("settings.notFullyShown"), __tmT("settings.lineBreak"), __tmT("settings.desktop")],
            read: data => Math.max(1, Math.min(10, Number(data.taskContentWrapMaxLines) || 2)),
        },
        taskContentWrapMaxLinesMobile: {
            title: __tmT("settings.mobileDockContentLines"), description: __tmT("settings.limitsTheMaximumNumberOfLinesShownForTask2"),
            page: 'appearance', sub: 'l-density', scope: __tmT("settings.mobileDock"), aliases: [__tmT("settings.mobile"), __tmT("settings.sidebar"), __tmT("settings.titleTooLong"), __tmT("settings.notFullyShown"), __tmT("settings.lineBreak")],
            read: data => Math.max(1, Math.min(10, Number(data.taskContentWrapMaxLinesMobile) || 2)),
        },
        remainingTimeUseWorkdays: {
            title: __tmT("settings.countRemainingTimeInWorkdays"), description: __tmT("settings.whenEnabledRemainingTimeDisplaysSkipSaturdaysAndSundays"),
            page: 'docs', sub: 't-review', scope: __tmT("settings.global"), aliases: [__tmT("settings.weekend"), __tmT("task.countdown"), __tmT("settings.daysRemaining")],
            read: data => !!data.remainingTimeUseWorkdays,
        },
        taskDoneDelightEnabled: {
            title: __tmT("settings.completionFeedback"), description: __tmT("settings.playsASubtleAnimationAndShowsAPlayfulMessage"),
            page: 'docs', sub: 't-done', scope: __tmT("settings.global"), aliases: [__tmT("settings.completionAnimation"), __tmT("settings.celebration"), __tmT("settings.funMessage")],
            read: data => data.taskDoneDelightEnabled !== false,
        },
        checklistCompactMode: {
            title: __tmT("settings.checklistCompactMode"), description: __tmT("settings.whenOnFieldsAppearToTheRightOfTasks"),
            page: 'view', sub: 'v-table', scope: __tmT("task.checklistView"), aliases: [__tmT("settings.rightSide"), __tmT("settings.right"), __tmT("settings.below"), __tmT("settings.fieldsTooCramped"), __tmT("settings.layout")],
            read: data => !!data.checklistCompactMode,
        },
        showCompletedTasks: {
            title: __tmT("task.showCompletedTasks"), description: __tmT("settings.rememberedSeparatelyPerDocumentGroupIncludingAllDocumentsWhen"),
            page: 'docs', sub: 't-done', scope: __tmT("settings.currentDocumentGroup"), aliases: [__tmT("settings.disappearWhenDone"), __tmT("settings.disappear"), __tmT("settings.canTSee"), __tmT("settings.hideCompleted")],
            note: __tmT("settings.actualVisibilityIsAlsoAffectedByTheCurrentFilters"),
            read: data => __tmGetShowCompletedTasksFromSettings(data),
        },
        completedTasksTodayOnly: {
            title: __tmT("settings.completedGroupOnlyToday"), description: __tmT("settings.whenEnabledTheTrailingCompletedTasksGroupKeepsOnly"),
            page: 'docs', sub: 't-done', scope: __tmT("settings.global"), aliases: [__tmT("settings.completedYesterday"), __tmT("settings.completedEarlier"), __tmT("common.today")],
            read: data => !!data.completedTasksTodayOnly,
        },
        completedTasksInlineInGroups: {
            title: __tmT("settings.donTGroupCompletedTasksSeparately"), description: __tmT("settings.whenEnabledCompletedTasksFollowTheCurrentDocumentTime"),
            page: 'docs', sub: 't-done', scope: __tmT("settings.global"), aliases: [__tmT("settings.completedColumn"), __tmT("settings.completedGroup"), __tmT("settings.mixedDisplay")],
            read: data => !!data.completedTasksInlineInGroups,
        },
    };

    function __tmSettingsQueryText(id) {
        const item = __tmSettingsQueryDefinitions[id];
        return [item.title, item.description];
    }

    __tmNs.querySettings = async function(args = {}) {
        if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error(__tmT("settings.settingsQueryParametersMustBeAnObject"));
        if (args.query != null && typeof args.query !== 'string') throw new Error(__tmT("settings.theSettingsQueryKeywordMustBeText"));
        const query = String(args.query || '').trim();
        if (query.length > 200) throw new Error(__tmT("settings.theSettingsQueryKeywordCannotExceedCharacters"));
        const limit = args.limit == null ? 12 : args.limit;
        if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error(__tmT("settings.theSettingsQueryLimitMustBeAnIntegerFrom"));
        if (!SettingsStore.loaded) await __tmEnsureSettingsLoaded(false);
        if (!SettingsStore.loaded) throw new Error(__tmT("settings.settingsAreNotLoadedYetTryAgainShortly"));

        const normalized = query.toLowerCase();
        const terms = normalized.split(/\s+/).filter(Boolean);
        const matches = Object.entries(__tmSettingsQueryDefinitions).map(([id, item]) => {
            const words = [id, item.title, ...item.aliases].map(word => word.toLowerCase());
            const text = [item.description, item.scope].join(' ').toLowerCase();
            const score = !normalized ? 1
                : (words.includes(normalized) ? 100 : 0)
                    + words.filter(word => word.includes(normalized) || normalized.includes(word)).length * 10
                    + terms.filter(term => text.includes(term)).length;
            return { id, item, score };
        }).filter(match => match.score > 0).sort((a, b) => b.score - a.score);
        const data = SettingsStore.data;
        return {
            readOnly: true,
            coverage: __tmT("settings.coversCommonDisplayCompletionBehaviorAndChecklistSettingsOnly"),
            total: matches.length,
            items: matches.slice(0, limit).map(({ id, item }) => ({
                id, title: item.title, description: item.description,
                path: [TM_SETTINGS_V2_PAGES.find(page => page[0] === item.page)[1],
                    TM_SETTINGS_V3_SUBPAGES[item.page].find(sub => sub[0] === item.sub)[1], item.title].join(' → '),
                scope: item.scope,
                ...(id === 'showCompletedTasks' ? { groupID: String(data.currentGroupId || 'all') } : {}),
                currentValue: item.read(data),
                ...(item.note ? { note: item.note } : {}),
            })),
        };
    };

    let __tmSettingsSearchCaptureBuffer = null;
    let __tmSettingsSearchIndexBuilding = false;
    let __tmSettingsSearchIndexBuildTimer = 0;
    let __tmSettingsSearchIndexBuildGen = 0;
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
        const route = raw.route || __tmSettingsV3Route(tab, section);
        const tabLabel = TM_SETTINGS_V2_PAGES.find(([id]) => id === route.page)?.[1] || TM_SETTINGS_SEARCH_TAB_LABELS[tab] || tab;
        const sectionLabel = TM_SETTINGS_V3_SUBPAGES[route.page]?.find(([id]) => id === route.sub)?.[1] || __tmGetSettingsSearchSectionLabel(section, tab);
        // Breadcrumbs describe where a result lives; they must not make unrelated
        // settings match every word in a combined category such as Timeline / Kanban.
        const haystack = __tmNormalizeSettingsSearchText([title, desc, raw.aliases].filter(Boolean).join(' '));
        return { tab, title, desc, section, key, route, tabLabel, sectionLabel, haystack, rendered: !!raw.rendered };
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

    function __tmSettingsSearchStaticText(node) {
        if (!(node instanceof Element)) return '';
        if (node.matches('input,select,textarea,[contenteditable]')) return '';
        const copy = node.cloneNode(true);
        // Never index field values, API keys, prompts, or selected options.
        copy.querySelectorAll('input,select,textarea,button,svg,script,style,[contenteditable]').forEach(el => el.remove());
        return __tmPlainSettingsSearchText(copy.textContent);
    }

    function __tmDecorateSettingsSearchCoverage(root, sourceTab = state.settingsActiveTab || 'docs') {
        const content = root.querySelector('.tm-settings-content') || root;
        const headingSelector = '.tm-setting-field-title,.tm-setting-switch-title,.tm-calendar-settings-label,.tm-agent-policy-group__title,.tm-rule-section-title,.tm-settings-section-title';
        const ignored = '.tm-settings-subtabs,.tm-settings-v3-sections,.tm-settings-choice-group,.tm-settings-search,dialog,.tm-doc-group-manager__picker';
        // Repeated editors are one setting, regardless of their number of rows or action buttons.
        content.querySelectorAll('.tm-agent-policy-group,.tm-priority-settings .tm-rule-section').forEach(group => {
            if (group.hasAttribute('data-tm-settings-search-key')) return;
            const heading = group.querySelector('.tm-agent-policy-group__title,.tm-priority-section__title,[style*="font-weight"]');
            const title = __tmSettingsSearchStaticText(heading);
            if (!title) return;
            const panel = group.closest('.tm-settings-panel');
            const tab = __tmNormalizeSettingsSearchTab(panel?.dataset.tmSettingsSearchTab || sourceTab);
            const section = panel?.dataset.tmSettingsLegacySection || panel?.dataset.tmSettingsSection || tab;
            group.dataset.tmSettingsSearchKey = __tmBuildSettingsSearchKey(tab, title, section);
            group.dataset.tmSettingsSearchTitle = title;
            group.dataset.tmSettingsSearchTab = tab;
            group.dataset.tmSettingsSearchSection = section;
            group.dataset.tmSettingsSearchAliases = __tmSettingsSearchStaticText(group).slice(0, 1500);
        });
        content.querySelectorAll('input:not([type="hidden"]),select,textarea,button[onclick],button[data-tm-call],button[data-tm-action],a[href]').forEach(control => {
            if (control.closest(ignored)) return;
            const indexed = control.closest('[data-tm-settings-search-key]');
            if (indexed && !indexed.matches('.tm-settings-panel')) {
                if (!indexed.dataset.tmSettingsSearchAliases) indexed.dataset.tmSettingsSearchAliases = __tmSettingsSearchStaticText(indexed).slice(0, 1500);
                return;
            }
            const panel = control.closest('.tm-settings-panel');
            const tab = __tmNormalizeSettingsSearchTab(panel?.dataset.tmSettingsSearchTab || sourceTab);
            const section = panel?.dataset.tmSettingsLegacySection || panel?.dataset.tmSettingsSection || tab;
            const label = control.closest('label');
            const group = control.closest('.tm-agent-policy-group,.tm-rule-section,.tm-column-row,.tm-column-item,.tm-status-option-row');
            const contextTitle = __tmSettingsSearchStaticText(group?.querySelector(headingSelector));
            let title = control.dataset.tmColorLabel || control.getAttribute('aria-label') || '';
            if (!title && control.getAttribute('aria-labelledby')) {
                const id = control.getAttribute('aria-labelledby');
                title = Array.from(content.querySelectorAll('[id]')).find(el => el.id === id)?.textContent?.trim() || '';
            }
            if (!title && label) title = __tmSettingsSearchStaticText(label);
            if (!title && control.matches('button,a')) title = __tmPlainSettingsSearchText(control.textContent) || control.getAttribute('title') || '';
            if (!title) {
                for (let parent = control.parentElement; parent && parent !== content; parent = parent.parentElement) {
                    if (parent === panel) break;
                    const heading = parent.querySelector(headingSelector.split(',').map(selector => ':scope > ' + selector).join(',') + ',:scope > [style*="font-weight"],:scope > strong');
                    const text = __tmSettingsSearchStaticText(heading);
                    if (text) { title = text; break; }
                    const textOnly = __tmSettingsSearchStaticText(parent);
                    if (textOnly && textOnly.length < 90) { title = textOnly; break; }
                }
            }
            title ||= control.getAttribute('placeholder') || control.getAttribute('title') || contextTitle;
            title = __tmPlainSettingsSearchText(title).slice(0, 160);
            if (!title) return;
            if (contextTitle && !title.includes(contextTitle)) title = `${contextTitle} · ${title}`;
            const identity = control.dataset.tmColorKey || control.id || ['name', 'type', 'onchange', 'onclick', 'data-tm-call', 'data-tm-args', 'data-tm-action'].map(key => control.getAttribute(key) || '').join('|');
            control.dataset.tmSettingsSearchKey = __tmBuildSettingsSearchKey(tab, title, section) + ':' + encodeURIComponent(identity);
            control.dataset.tmSettingsSearchTitle = title;
            control.dataset.tmSettingsSearchTab = tab;
            control.dataset.tmSettingsSearchSection = section;
            control.dataset.tmSettingsSearchAliases = __tmSettingsSearchStaticText(label || group?.querySelector(headingSelector)).slice(0, 1000);
        });
    }

    function __tmCollectRenderedSettingsSearchEntries(root, sourceTab = state.settingsActiveTab || 'docs') {
        if (!(root instanceof HTMLElement)) return [];
        __tmDecorateSettingsSearchCoverage(root, sourceTab);
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
                aliases: node.dataset.tmSettingsSearchAliases || '',
                key: node.dataset.tmSettingsSearchKey || '',
                route: __tmSettingsV3Route(tab, section, node),
                rendered: true
            });
            if (entry) entries.push(entry);
        });
        return entries;
    }

    function __tmGetSettingsSearchEntries() {
        const map = new Map();
        Object.entries(TM_SETTINGS_SEARCH_TAB_LABELS).forEach(([tab, title]) => {
            const entry = __tmCreateSettingsSearchEntry({ tab, title, desc: __tmT("settings.settings") });
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
            return `<div class="tm-settings-search-empty">${__tmT("settings.noMatchingSettings")}</div>`;
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
                    <input class="tm-settings-search-input" type="search" value="${esc(query)}" placeholder="${globalThis.__taskHorizonHostBridge.i18n.html("settings.searchSettings")}" autocomplete="off" spellcheck="false" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("settings.searchSettings")}" data-tm-settings-search-input aria-expanded="${hasQuery && state.settingsSearchResultsOpen !== false ? 'true' : 'false'}">
                    <button class="tm-settings-search-clear" type="button" data-tm-action="tmClearSettingsSearch" title="${globalThis.__taskHorizonHostBridge.i18n.html("task.clearSearch2")}" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("task.clearSearch2")}"${hasQuery ? '' : ' hidden'}>×</button>
                </div>
                <div class="tm-settings-search-results" data-tm-settings-search-results${hasQuery && state.settingsSearchResultsOpen !== false ? '' : ' hidden'}>
                    ${__tmRenderSettingsSearchResultsHtml(query, activeTab)}
                </div>
            </div>
        `;
    }

    function __tmShouldRenderSettingsSearch(activeTab) {
        return String(activeTab || '').trim() !== 'rule_editor';
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
            if (found instanceof HTMLElement) return found.__tmChoiceGroup || found;
            const targetTab = __tmNormalizeSettingsSearchTab(target?.tab || state.settingsActiveTab || 'docs');
            if (targetTab === 'calendar'
                && root.querySelector('#tm-calendar-settings-root')
                && !root.querySelector('.tm-calendar-settings-row')) {
                return null;
            }
        }
        const section = String(target?.section || '').trim();
        if (section) {
            const found = root.querySelector(`.tm-settings-panel[data-tm-settings-section="${section}"],.tm-settings-panel[data-tm-settings-legacy-section="${section}"]`);
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
            if (!target.matches('input,select,textarea,button,a[href]') && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
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
        __tmRevealSettingsV3Target(root, targetEl);
        for (let parent = targetEl.parentElement; parent && parent !== root; parent = parent.parentElement) {
            if (parent.tagName === 'DETAILS') parent.open = true;
        }
        const subtabs = root.querySelector('.tm-settings-subtabs');
        const stickyOffset = (subtabs instanceof HTMLElement ? subtabs.offsetHeight : 0) + 12;
        const maxScrollTop = Math.max(0, content.scrollHeight - content.clientHeight);
        const nextTop = Math.max(0, Math.min(maxScrollTop, __tmGetSettingsSectionAnchorTop(content, targetEl) - stickyOffset));
        try { content.scrollTo({ top: nextTop, behavior: 'smooth' }); } catch (e) { content.scrollTop = nextTop; }
        __tmHighlightSettingsSearchTarget(targetEl);
        [targetEl, ...targetEl.querySelectorAll('input:not(:disabled),select:not(:disabled),textarea:not(:disabled),button:not(:disabled)')]
            .find((control) => control.matches('input,select,textarea,button') && !control.disabled && control.tabIndex >= 0 && control.getClientRects().length)?.focus({ preventScroll: true });
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
            // Search is immediate and never enters the settings-save debounce queue.
            input.addEventListener('input', (event) => {
                if (!event.isComposing) window.tmUpdateSettingsSearch(input.value);
            });
            input.addEventListener('compositionend', () => window.tmUpdateSettingsSearch(input.value));
            input.addEventListener('focus', () => {
                if (!String(state.settingsSearchQuery || '').trim()) return;
                state.settingsSearchResultsOpen = true;
                __tmRefreshSettingsSearchResults(root);
            });
            input.addEventListener('keydown', (event) => {
                if (event.isComposing || event.keyCode === 229) return;
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
        __tmFlushSettingsInputs();
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
        const entry = __tmGetSettingsSearchEntries().find((item) => item.key === pending.key);
        const route = entry?.route || __tmSettingsV3Route(targetTab, pending.section);
        const targetPage = route.page;
        const previousPage = __tmSettingsV2CurrentPage();
        (state.settingsV3Subpages ||= {})[targetPage] = route.sub;
        state.settingsV3SearchOpen = false;
        state.settingsV2Page = targetPage;
        state.settingsV2Source = targetTab;
        const currentTab = __tmNormalizeSettingsSearchTab(state.settingsActiveTab || 'docs');
        const settingsOpen = state.settingsModal instanceof HTMLElement && document.body.contains(state.settingsModal);
        if (targetTab !== currentTab || !settingsOpen || targetPage !== previousPage) {
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
        __tmToggleSettingsV3Search(state.settingsModal, false, false);
        if (__tmFocusSettingsSearchTarget(state.settingsModal, pending)) state.settingsSearchPendingTarget = null;
    };

    function __tmRenderCalendarSettingsForModal(modal = state.settingsModal) {
        if (!(modal instanceof HTMLElement)) return false;
        const container = modal.querySelector('#tm-calendar-settings-root');
        const renderer = globalThis.__tmCalendar?.renderSettings;
        if (!(container instanceof HTMLElement) || typeof renderer !== 'function') return false;
        try {
            if (renderer(container, SettingsStore) === false) return false;
            __tmDecorateCalendarSettingsSearchRows(container);
            __tmDecorateSettingsV2(modal);
            try {
                requestAnimationFrame(() => {
                    try { __tmSyncSettingsV2Nav(modal); } catch (e) {}
                });
            } catch (e) {}
            if (__tmShouldRenderSettingsSearch(state.settingsActiveTab || 'docs')) {
                __tmRefreshSettingsSearchResults(modal);
                __tmRunPendingSettingsSearchFocus(modal);
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    function __tmEnsureCalendarSettingsForModal(modal = state.settingsModal) {
        if (__tmRenderCalendarSettingsForModal(modal)) return;
        if (!(modal instanceof HTMLElement)) return;
        if (typeof globalThis.__tmCalendar?.renderSettings === 'function') return;
        const container = modal.querySelector('#tm-calendar-settings-root');
        const ensure = globalThis.__taskHorizonEnsureCalendarAssets;
        if (container instanceof HTMLElement) {
            container.innerHTML = `
                <div class="tm-calendar-settings-panel">
                    <div class="tm-settings-section-desc">${__tmT("settings.loadingCalendarSettings")}</div>
                </div>
            `;
        }
        if (typeof ensure !== 'function') {
            if (container instanceof HTMLElement) {
                container.innerHTML = `
                    <div class="tm-calendar-settings-panel">
                        <div class="tm-settings-section-desc">${__tmT("settings.theCalendarModuleIsNotLoadedYetReopenThe")}</div>
                    </div>
                `;
            }
            return;
        }
        const token = `${Date.now()}:${Math.random()}`;
        state.__tmCalendarSettingsLoadToken = token;
        Promise.resolve().then(() => ensure()).then(() => {
            if (state.__tmCalendarSettingsLoadToken !== token) return;
            if (state.settingsModal !== modal || !document.body.contains(modal)) return;
            if (modal.querySelector('#tm-calendar-settings-root')) {
                showSettings();
                return;
            }
            // Cold-start search must include calendar settings before visiting Time.
            // Refresh the index in place so loading cannot interrupt typing or drafts.
            const renderer = globalThis.__tmCalendar?.renderSettings;
            if (typeof renderer !== 'function') return;
            const probe = document.createElement('div');
            renderer(probe, SettingsStore, { indexOnly: true });
            __tmDecorateCalendarSettingsSearchRows(probe);
            state.settingsSearchGeneratedEntries = [
                ...(state.settingsSearchGeneratedEntries || []).filter(entry => entry.tab !== 'calendar'),
                ...__tmCollectRenderedSettingsSearchEntries(probe, 'calendar')
            ];
            __tmRefreshSettingsSearchResults(modal);
        }).catch(() => {
            if (state.__tmCalendarSettingsLoadToken !== token) return;
            if (state.settingsModal !== modal || !document.body.contains(modal)) return;
            if (container instanceof HTMLElement) {
                container.innerHTML = `
                    <div class="tm-calendar-settings-panel">
                        <div class="tm-settings-section-desc">${__tmT("settings.failedToLoadTheCalendarModuleTryAgainLater")}</div>
                    </div>
                `;
            }
        });
    }

    function showSettings() {
        if (__tmSettingsFlushingInputs) return;
        __tmFlushSettingsInputs();
        __tmInstallSettingsAutosave();
        const settingsFocus = __tmCaptureSettingsFocus(state.settingsModal);
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
                if (prevContent && state.settingsModal.dataset.settingsPage === __tmSettingsV2CurrentPage()) savedSettingsContentScrollTop = Number(prevContent.scrollTop) || 0;
                if (prevSubtabs && state.settingsModal.dataset.settingsPage === __tmSettingsV2CurrentPage()) savedSettingsSubtabsScrollLeft = Number(prevSubtabs.scrollLeft) || 0;
            } catch (e) {}
            try { state.settingsModal.__tmSettingsSearchUnstack?.(); state.settingsModal.__tmChoiceObserver?.disconnect(); state.settingsModal.remove(); } catch (e) {}
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

        const renderSettingsActions = () => '';

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
            if (!docId) return __tmT("task.unknownDocument");
            let doc = state.allDocuments.find(d => d.id === docId);
            if (!doc) {
                const docEntry = state.taskTree.find(d => d.id === docId);
                if (docEntry) doc = { id: docId, name: docEntry.name };
            }
            return doc ? __tmGetDocDisplayName(doc, doc.name || __tmT("task.unknownDocument")) : __tmT("task.unknownDocument");
        };
        /* 来源行副标题：优先显示父路径（同名文档可区分），ID 收进 title */
        const resolveDocPathLabel = (docId, doc = null) => {
            const id = String(docId || '').trim();
            if (!id) return { text: '', title: '' };
            const target = doc || state.allDocuments.find((item) => String(item?.id || '').trim() === id) || null;
            const rawPath = String(target?.hpath || target?.path || '').trim();
            const segs = rawPath.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
            if (segs.length) segs.pop();
            let text = segs.join(' › ');
            if (!text && target) {
                const notebookId = String(target?.notebook || target?.box || '').trim();
                if (notebookId) text = __tmGetNotebookDisplayName(notebookId, '');
            }
            if (!text) text = id;
            const title = rawPath ? __tmT("settings.documentId", { rawPath: rawPath, id: id }) : __tmT("settings.documentId2", { id: id });
            return { text, title };
        };

        let settingsDocPickerDialogMarkup = '';
        const renderDocumentGroupManager = () => {
            const searchEnabled = groups.length >= 6;
            const searchQuery = searchEnabled ? String(state.settingsDocGroupQuery || '').trim().toLowerCase() : '';
            const isAllDocs = currentGroupId === 'all';
            const isNotebookGroup = !!String(currentGroup?.notebookId || '').trim();
            const currentGroupName = isAllDocs ? __tmT("task.allDocuments") : (__tmResolveDocGroupName(currentGroup) || __tmT("kernel.untitledGroup"));
            const currentGroupIndex = isAllDocs
                ? -1
                : groups.findIndex((group) => String(group?.id || '').trim() === currentGroupId);
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
                const name = __tmResolveDocGroupName(group) || __tmT("kernel.untitledGroup");
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
                            <span class="tm-doc-group-manager__group-meta">${__tmT("settings.sources", { value1: notebook ? __tmT("settings.notebook") : __tmT("settings.custom"), sourceCount: sourceCount })}</span>
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
            const renderSourceRows = () => {
                if (!currentDocs.length) {
                    return `<div class="tm-doc-group-manager__empty">${__tmT("settings.noDocumentSourcesYetAddDocumentsAboveOrAdd")}</div>`;
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
                                ? __tmGetNotebookDisplayName(docId, __tmT("settings.unknownNotebook"))
                                : (doc ? __tmGetDocDisplayName(doc, doc.name || __tmT("task.unknownDocument")) : (fallbackOtherBlockDocName || __tmT("task.unknownDocument")));
                            const pathLabel = isNotebook ? { text: '', title: '' } : resolveDocPathLabel(docId, doc);
                            const otherBlockBadgeTitle = __tmT("settings.otherBlockTabSources", { value1: sourceGroupName ? `${sourceGroupName}：` : '', value2: otherBlockCount > 0 ? __tmT("settings.blockS", { otherBlockCount: otherBlockCount }) : '' });
                            const directRemoveAction = isAllDocs
                                ? `removeDocFromAll('${escSq(docId)}')`
                                : `removeDocFromGroupById('${escSq(docId)}')`;
                            return `
                                <div class="tm-doc-group-manager__source-row">
                                    <span class="tm-doc-group-manager__source-icon">${icon(isNotebook ? 'archive' : 'file-text', 15)}</span>
                                    <div class="tm-doc-group-manager__source-copy">
                                        <div class="tm-doc-group-manager__source-top">
                                            <div class="tm-doc-group-manager__source-name" title="${esc(docName)}">${esc(docName)}</div>
                                            ${isNotebook ? `<span class="tm-doc-group-manager__badge">${__tmT("settings.notebook")}</span>` : ''}
                                            ${isRecursive ? `<span class="tm-doc-group-manager__badge">${__tmT("settings.withSubdocuments")}</span>` : ''}
                                            ${hasOtherBlockSource ? `<span class="tm-doc-group-manager__badge tm-doc-group-manager__badge--warning" title="${esc(otherBlockBadgeTitle)}">${__tmT("settings.otherBlocks", { value1: otherBlockCount > 1 ? ` ${otherBlockCount}` : '' })}</span>` : ''}
                                        </div>
                                        ${isNotebook ? '' : `<div class="tm-doc-group-manager__source-meta"><span class="tm-doc-group-manager__source-path" title="${esc(pathLabel.title)}">${esc(pathLabel.text)}</span></div>`}
                                    </div>
                                    <div class="tm-doc-group-manager__source-actions">
                                        ${isNotebook
                                            ? `<span class="tm-doc-group-manager__row-note">${isAllDocs ? __tmT("settings.fromANotebookGroup") : __tmT("settings.unlinkInMoreActions")}</span>`
                                            : `${hasDirectDocSource ? `<button type="button" class="tm-doc-group-manager__text-action" onclick="${directRemoveAction}">${icon('trash-2', 13)}<span>${__tmT("task.remove")}</span></button>` : ''}
                                               ${hasOtherBlockSource ? `<button type="button" class="tm-doc-group-manager__text-action" onclick="removeOtherBlockSourceDocFromGroup('${escSq(docId)}', '${escSq(sourceGroupId)}')">${icon('trash-2', 13)}<span>${__tmT("settings.removeOtherBlocks")}</span></button>` : ''}`}
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
                            <strong>${__tmT("settings.sourceSyncedFromNotebook")}</strong>
                            <span>${__tmT("settings.automaticallySearchesTheNotebookForDocumentsContainingTasksThe")}</span>
                        </div>
                    </div>
                ` : '';
                if (!isNotebookGroup) {
                    settingsDocPickerDialogMarkup = `
                    <div class="tm-doc-group-manager__picker-dialog" data-tm-doc-picker-dialog hidden aria-hidden="true"
                        onclick="if (event.target === this) tmCloseSettingsDocPicker()">
                        <section class="tm-doc-group-manager__picker-dialog-box" role="dialog" aria-modal="true" aria-labelledby="tmSettingsDocPickerTitle">
                            <header class="tm-doc-group-manager__picker-dialog-head">
                                <h3 id="tmSettingsDocPickerTitle">${__tmT("task.selectDocument")}</h3>
                                <button type="button" class="tm-doc-group-manager__picker-dialog-close"
                                    data-tm-action="tmCloseSettingsDocPicker" title="${globalThis.__taskHorizonHostBridge.i18n.html("common.close")}" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("common.close")}">
                                    ${icon('x', 17)}
                                </button>
                            </header>
                            <div class="tm-doc-group-manager__picker" data-tm-doc-picker data-tm-doc-picker-group-id="${esc(currentGroupId)}">
                        <div class="tm-doc-group-manager__picker-toolbar">
                            <div class="tm-doc-group-manager__picker-search">
                                <span aria-hidden="true">${icon('search', 14)}</span>
                                <input type="search" placeholder="${globalThis.__taskHorizonHostBridge.i18n.html("settings.searchDocumentNamePathOrId")}" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("calendar.searchDocuments")}"
                                    autocomplete="off" spellcheck="false" data-tm-doc-picker-search-input data-tm-call="tmFilterSettingsDocPicker">
                                <button type="button" data-tm-action="tmClearSettingsDocPickerSearch" title="${globalThis.__taskHorizonHostBridge.i18n.html("task.clearSearch")}" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("task.clearSearch")}" hidden>${icon('x', 14)}</button>
                            </div>
                            <button type="button" class="tm-doc-group-manager__picker-refresh" data-tm-action="tmRefreshSettingsDocPicker"
                                title="${globalThis.__taskHorizonHostBridge.i18n.html("settings.refreshTheDocumentList")}" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("settings.refreshTheDocumentList")}">${icon('refresh-cw', 15)}</button>
                        </div>
                        <div class="tm-doc-group-manager__picker-tree" data-tm-doc-picker-tree aria-busy="${state.settingsDocPickerDocumentsLoading ? 'true' : 'false'}">
                            ${state.settingsDocPickerDocumentsLoading && !docPickerTree.length ? `
                                <div class="tm-doc-group-manager__picker-skeleton" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("settings.loadingDocuments")}">
                                    <span></span><span></span><span></span>
                                </div>
                            ` : docPickerTree.length
                                ? __tmRenderDocPickerTree(docPickerTree, { selectedIds: docPickerDraft, disabledIds: currentDocIdSet })
                                : `<div class="tm-doc-group-manager__picker-empty">${__tmT("settings.noSelectableDocuments")}</div>`}
                            <div class="tm-doc-group-manager__picker-empty" data-tm-doc-picker-empty hidden>${__tmT("calendar.noMatchingDocuments")}</div>
                        </div>
                        <div class="tm-doc-group-manager__picker-footer">
                            ${isAllDocs ? '<span></span>' : `
                                <label class="tm-doc-group-manager__recursive">
                                    <input class="b3-switch fn__flex-center" type="checkbox" data-tm-doc-picker-recursive>
                                    <span>${__tmT("settings.includeSubdocuments")}</span>
                                </label>
                            `}
                            <div class="tm-doc-group-manager__picker-actions">
                                <span class="tm-doc-group-manager__picker-selected" data-tm-doc-picker-selected-count>${__tmT("settings.selected", { size: docPickerDraft.size })}</span>
                                <button type="button" class="tm-btn tm-btn-primary tm-doc-group-manager__add-button"
                                    data-tm-action="tmAddSelectedSettingsDocs"${docPickerDraft.size ? '' : ' disabled'}>
                                    ${icon('plus', 15)}<span>${__tmT("settings.addSelected")}</span>
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
                    return `<div class="tm-doc-group-manager__empty">${__tmT("settings.noHiddenDocumentTabsRightClickADocumentTab")}</div>`;
                }
                return `
                    <div class="tm-doc-group-manager__pane-intro">
                        ${isAllDocs ? __tmT("settings.thisAffectsOnlyTheAllDocumentsView") : __tmT("settings.afterRestoringTheDocumentReappearsInTheCurrentGroup")}
                    </div>
                    <div class="tm-doc-group-manager__source-list">
                        ${currentGroupExcludedDocIds.map((docId) => {
                            const docName = resolveDocName(docId);
                            const excludedPathLabel = resolveDocPathLabel(docId);
                            return `
                                <div class="tm-doc-group-manager__source-row">
                                    <span class="tm-doc-group-manager__source-icon">${icon('file-text', 15)}</span>
                                    <div class="tm-doc-group-manager__source-copy">
                                        <div class="tm-doc-group-manager__source-name" title="${esc(docName)}">${esc(docName)}</div>
                                        <div class="tm-doc-group-manager__source-meta"><span class="tm-doc-group-manager__source-path" title="${esc(excludedPathLabel.title)}">${esc(excludedPathLabel.text)}</span></div>
                                    </div>
                                    <div class="tm-doc-group-manager__source-actions"><button type="button" class="tm-doc-group-manager__restore" onclick="removeExcludedDocFromCurrentGroup('${escSq(docId)}')">${__tmT("settings.showAgain")}</button></div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            };
            const renderOptimizationPane = () => `
                <div class="tm-doc-group-manager__pane-intro">${__tmT("settings.suitedToGroupsBuiltAroundDailyNotesCanAlso")}</div>
                ${renderSingleSwitchSetting(
                    __tmT("settings.enableDailyNoteGroupSearchOptimization"),
                    __tmT("settings.appliesToTheCurrentGroupOnlyOffByDefault"),
                    `<input class="b3-switch fn__flex-center" type="checkbox" ${currentGroupCalendarOptimization.enabled ? 'checked' : ''} onchange="updateCurrentGroupCalendarSearchOptimizationEnabled(this.checked)">`
                )}
                <div class="tm-doc-group-manager__optimization-days${currentGroupCalendarOptimization.enabled ? '' : ' is-disabled'}">
                    ${renderSingleFieldSetting(
                        __tmT("settings.searchWindow"),
                        __tmT("settings.onlySearchTasksThatCanBeRecognizedAsDaily"),
                        `<select class="b3-select tm-doc-group-manager__days-select" ${currentGroupCalendarOptimization.enabled ? '' : 'disabled'} onchange="updateCurrentGroupCalendarSearchOptimizationDays(this.value)">
                            <option value="7" ${Number(currentGroupCalendarOptimization.days) === 7 ? 'selected' : ''}>${__tmT("settings.lastDays")}</option>
                            <option value="30" ${Number(currentGroupCalendarOptimization.days) === 30 ? 'selected' : ''}>${__tmT("settings.lastDays2")}</option>
                            <option value="60" ${Number(currentGroupCalendarOptimization.days) === 60 ? 'selected' : ''}>${__tmT("settings.lastDays3")}</option>
                            <option value="90" ${Number(currentGroupCalendarOptimization.days) === 90 ? 'selected' : ''}>${__tmT("settings.lastDays4")}</option>
                            <option value="120" ${Number(currentGroupCalendarOptimization.days) === 120 ? 'selected' : ''}>${__tmT("settings.lastDays5")}</option>
                        </select>`
                    )}
                </div>
            `;
            const renderDetailActions = () => {
                if (isAllDocs) return '';
                const canRename = !isNotebookGroup;
                const canClear = isNotebookGroup || (Array.isArray(currentGroup?.docs) && currentGroup.docs.length > 0);
                const canMoveUp = currentGroupIndex > 0;
                const canMoveDown = currentGroupIndex >= 0 && currentGroupIndex < groups.length - 1;
                return `
                    <div class="tm-doc-group-manager__detail-actions">
                        ${!isNotebookGroup ? `<button type="button" class="tm-btn tm-btn-primary tm-doc-group-manager__picker-trigger" data-tm-action="tmOpenSettingsDocPicker">${icon('plus', 14)}<span>${__tmT("task.selectDocument")}</span></button>` : ''}
                        <button type="button" class="tm-btn tm-btn-secondary tm-doc-group-manager__export" data-tm-action="exportCurrentGroup">
                            ${icon('download', 15)}<span>${__tmT("settings.export")}</span>
                        </button>
                        <details class="tm-doc-group-manager__more">
                            <summary class="tm-doc-group-manager__icon-button" title="${globalThis.__taskHorizonHostBridge.i18n.html("settings.moreActions")}" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("settings.moreActions")}">${icon('dots-three', 17)}</summary>
                            <div class="tm-doc-group-manager__more-menu" role="menu">
                                <button type="button" role="menuitem" data-tm-call="tmMoveCurrentDocGroup" data-tm-args='${esc(JSON.stringify([-1]))}' title="${currentGroupIndex > 0 ? __tmT("settings.moveUp") : __tmT("settings.alreadyTheFirstGroup")}"${currentGroupIndex > 0 ? '' : ' disabled'}>${icon('arrow-up', 15)}<span>${__tmT("settings.moveUp")}</span></button>
                                <button type="button" role="menuitem" data-tm-call="tmMoveCurrentDocGroup" data-tm-args='${esc(JSON.stringify([1]))}' title="${currentGroupIndex >= 0 && currentGroupIndex < groups.length - 1 ? __tmT("settings.moveDown") : __tmT("settings.alreadyTheLastGroup")}"${currentGroupIndex >= 0 && currentGroupIndex < groups.length - 1 ? '' : ' disabled'}>${icon('arrow-down', 15)}<span>${__tmT("settings.moveDown")}</span></button>
                                ${canRename ? `<button type="button" data-tm-action="renameCurrentGroup" role="menuitem">${icon('pencil', 15)}<span>${__tmT("settings.rename")}</span></button>` : ''}
                                ${canClear ? `<button type="button" data-tm-action="clearCurrentGroupDocs" role="menuitem">${icon(isNotebookGroup ? 'archive' : 'trash-2', 15)}<span>${isNotebookGroup ? __tmT("settings.unlinkNotebook") : __tmT("settings.clearManualDocuments")}</span></button>` : ''}
                                <button type="button" class="is-danger" data-tm-action="deleteCurrentGroup" role="menuitem">${icon('trash-2', 15)}<span>${__tmT("settings.deleteGroup")}</span></button>
                            </div>
                        </details>
                    </div>
                `;
            };
            return `
                <section class="tm-settings-panel tm-doc-group-manager" ${__tmSettingsSearchAttrs('docs', __tmT("settings.documentGroupsManagement"), __tmT("settings.persistentGroupListDocumentSourcesHiddenDocumentTabsAnd"))}>
                    <div class="tm-doc-group-manager__heading">
                        <div>
                            <div class="tm-settings-section-title">${icon('list-bullets', 18)}<span>${__tmT("settings.documentGroupsManagement")}</span></div>
                            <div class="tm-settings-section-desc">${__tmT("settings.afterSelectingAGroupManageSourcesExclusionsAndSearch")}</div>
                        </div>
                    </div>
                    <div class="tm-doc-group-manager__workspace" aria-busy="false">
                        <aside class="tm-doc-group-manager__nav" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("calendar.documentGroups")}">
                            <div class="tm-doc-group-manager__nav-head">
                                <span>${__tmT("kernel.documentScope")}</span>
                                <span>${__tmT("settings.groups", { length: groups.length })}</span>
                            </div>
                            ${searchEnabled ? `
                                <div class="tm-doc-group-manager__search">
                                    <span>${icon('search', 14)}</span>
                                    <input type="search" value="${esc(String(state.settingsDocGroupQuery || ''))}" placeholder="${globalThis.__taskHorizonHostBridge.i18n.html("settings.searchGrouping")}" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("settings.searchDocumentsgroup")}" data-tm-call="tmUpdateDocGroupSettingsQuery">
                                    <button type="button" data-tm-action="tmClearDocGroupSettingsQuery" title="${globalThis.__taskHorizonHostBridge.i18n.html("task.clearSearch")}" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("task.clearSearch")}"${searchQuery ? '' : ' hidden'}>${icon('x', 14)}</button>
                                </div>
                            ` : ''}
                            <div class="tm-doc-group-manager__all">
                                <button type="button" class="tm-doc-group-manager__group${isAllDocs ? ' is-active' : ''}"
                                    data-tm-call="tmSwitchSettingsDocGroup" data-tm-args='${esc(JSON.stringify(['all']))}'
                                    aria-selected="${isAllDocs ? 'true' : 'false'}" title="${globalThis.__taskHorizonHostBridge.i18n.html("task.allDocuments")}">
                                    <span class="tm-doc-group-manager__group-icon">${icon('list-bullets', 15)}</span>
                                    <span class="tm-doc-group-manager__group-copy">
                                        <span class="tm-doc-group-manager__group-name">${__tmT("task.allDocuments")}</span>
                                        <span class="tm-doc-group-manager__group-meta">${__tmT("settings.aggregatesAllGroups")}</span>
                                    </span>
                                </button>
                            </div>
                            <div class="tm-doc-group-manager__group-list" role="listbox">
                                ${groups.map(renderGroupButton).join('')}
                                <div class="tm-doc-group-manager__search-empty"${visibleGroupCount > 0 ? ' hidden' : ''}>${__tmT("settings.noMatchingGroups")}</div>
                            </div>
                            <div class="tm-doc-group-manager__create">
                                <button type="button" class="tm-btn tm-btn-primary" data-tm-action="createNotebookGroup">${icon('plus', 14)}<span>${__tmT("settings.notebook")}</span></button>
                                <button type="button" class="tm-btn tm-btn-primary" data-tm-action="createCustomGroup">${icon('plus', 14)}<span>${__tmT("settings.custom")}</span></button>
                            </div>
                        </aside>
                        <div class="tm-doc-group-manager__detail">
                            <div class="tm-doc-group-manager__detail-head">
                                <div class="tm-doc-group-manager__detail-title-wrap">
                                    <div class="tm-doc-group-manager__detail-title" title="${esc(currentGroupName)}">${esc(currentGroupName)}</div>
                                    <div class="tm-doc-group-manager__detail-meta">${__tmT("settings.sources2", { value1: isAllDocs ? __tmT("settings.summaryView") : (isNotebookGroup ? __tmT("settings.notebookGroup") : __tmT("settings.customGroup")), length: currentDocs.length })}</div>
                                </div>
                                ${renderDetailActions()}
                            </div>
                            <div class="tm-doc-group-manager__pane">
                                ${renderSourcePane()}
                                <details class="tm-doc-group-manager__fold">
                                    <summary>${__tmT("settings.hiddenDocumentTabs")}<span class="tm-doc-group-manager__fold-count">${currentGroupExcludedDocIds.length}</span></summary>
                                    ${renderExcludedPane()}
                                </details>
                                ${isAllDocs ? '' : `
                                <details class="tm-doc-group-manager__fold">
                                    <summary>${__tmT("settings.searchOptimization", { value1: currentGroupCalendarOptimization.enabled ? `<span class="tm-doc-group-manager__fold-count">${__tmT("settings.enabledLastDays", { value1: Number(currentGroupCalendarOptimization.days) || 30 })}</span>` : '' })}</summary>
                                    ${renderOptimizationPane()}
                                </details>
                                `}
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
                <div style="margin-bottom: 16px; padding: 12px; background: var(--tm-section-bg); border-radius: 8px;" ${__tmSettingsSearchAttrs('docs', __tmT("settings.customTabGroups"), __tmT("settings.rightClickATabToAddItToA"))}>
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">
                        <div style="font-weight:600;">${__tmT("settings.customTabGroups2")}</div>
                        <button class="tm-btn tm-btn-info" data-tm-action="tmCreateDocTabCustomGroupFromSettings" style="padding: 6px 12px; font-size: 12px;">${__tmT("settings.newTabGroup")}</button>
                    </div>
                    <div style="font-size:12px;color:var(--tm-secondary-text);line-height:1.7;margin-bottom:10px;">${__tmT("settings.customTabGroupsOnlyCollapseTheTabBarThey")}</div>
                    ${groupsForTabs.length ? `
                        <div style="display:flex;flex-direction:column;gap:10px;">
                            ${groupsForTabs.map((group) => {
                                const gid = String(group?.id || '').trim();
                                const groupName = String(group?.name || '').trim() || __tmT("task.untitledTabGroup");
                                const entries = Array.isArray(group?.entries) ? group.entries : [];
                                return `
                                    <div style="border:1px solid var(--tm-border-color);border-radius:8px;background:var(--tm-card-bg);padding:10px;">
                                        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
                                            <div style="min-width:0;">
                                                <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(groupName)}</div>
                                                <div style="font-size:11px;color:var(--tm-secondary-text);margin-top:2px;">${__tmT("settings.directMembers", { length: entries.length })}</div>
                                            </div>
                                            <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
                                                <button class="tm-btn tm-btn-secondary" onclick="tmRenameDocTabCustomGroup('${escSq(gid)}')" style="padding:3px 8px;font-size:11px;">${__tmT("settings.rename")}</button>
                                                <button class="tm-btn tm-btn-danger" onclick="tmDeleteDocTabCustomGroup('${escSq(gid)}')" style="padding:3px 8px;font-size:11px;">${__tmT("common.delete")}</button>
                                            </div>
                                        </div>
                                        <div style="display:flex;gap:8px;margin-bottom:8px;">
                                            <input data-tm-doc-tab-group-entry-input type="text" placeholder="${globalThis.__taskHorizonHostBridge.i18n.html("settings.enterDocumentId")}"
                                                style="flex:1;min-width:0;padding:6px 8px;border:1px solid var(--tm-input-border);background:var(--tm-input-bg);color:var(--tm-text-color);border-radius:4px;font-size:12px;">
                                            <button class="tm-btn tm-btn-primary" onclick="tmAddDocTabCustomGroupEntryFromInput('${escSq(gid)}', this)" style="padding:4px 10px;font-size:12px;">${__tmT("settings.add")}</button>
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
                                                                        <input class="b3-switch fn__flex-center" type="checkbox" ${includeChildren ? 'checked' : ''} onchange="tmToggleDocTabCustomGroupEntryChildren('${escSq(gid)}', '${escSq(docId)}', this.checked)">${__tmT("settings.includeSubdocuments2")}</label>
                                                                    <button class="tm-btn tm-btn-danger" onclick="tmRemoveDocFromDocTabCustomGroup('${escSq(gid)}', '${escSq(docId)}')" style="padding:2px 7px;font-size:11px;">${__tmT("task.remove")}</button>
                                                                </div>
                                                            </div>
                                                            <div style="margin-top:7px;font-size:12px;color:var(--tm-secondary-text);line-height:1.7;">
                                                                ${childDocs.length ? `
                                                                    <div style="margin-bottom:2px;">${__tmT("settings.detectedSubdocuments", { length: childDocs.length, value2: includeChildren ? __tmT("settings.andWillBeCollectedIntoTheTabGroupWhen") : '' })}</div>
                                                                    <div style="display:flex;flex-direction:column;gap:2px;">
                                                                        ${childPreview.map((child) => {
                                                                            const depth = Math.max(1, Number(child?.depth) || 1);
                                                                            const childName = __tmGetDocDisplayName(child, child.name || __tmT("kernel.untitledDocument"));
                                                                            return `<div style="padding-left:${Math.min(28, depth * 10)}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">↳ ${esc(childName)}</div>`;
                                                                        }).join('')}
                                                                        ${childDocs.length > childPreview.length ? `<div style="padding-left:10px;">${__tmT("settings.andMore", { length: childDocs.length - childPreview.length })}</div>` : ''}
                                                                    </div>
                                                                ` : __tmT("settings.noSubdocumentsDetectedCurrentlyOnceEnabledFutureSubdocumentsMatching")}
                                                            </div>
                                                        </div>
                                                    `;
                                                }).join('')}
                                            </div>
                                        ` : `<div style="color: var(--tm-secondary-text); font-size: 12px; padding: 8px; background: var(--tm-rule-group-bg); border-radius: 6px;">${__tmT("settings.noMembersYetRightClickADocumentTabTo")}</div>`}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    ` : `<div style="color: var(--tm-secondary-text); font-size: 13px; padding: 10px; background: var(--tm-rule-group-bg); border-radius: 8px;">${__tmT("settings.noTabGroupsYetRightClickAnyDocumentTab")}</div>`}
                </div>
            `;
        };

        const defaultDocIdByGroup = (SettingsStore.data.defaultDocIdByGroup && typeof SettingsStore.data.defaultDocIdByGroup === 'object')
            ? SettingsStore.data.defaultDocIdByGroup
            : {};
        const defaultDocId = String((currentGroupId === 'all' ? SettingsStore.data.defaultDocId : defaultDocIdByGroup[currentGroupId]) || '').trim();
        const currentDocIds = currentDocs.map(d => (typeof d === 'object' ? d.id : d));
        const defaultDocOptions = [
            `<option value="" ${defaultDocId ? '' : 'selected'}>${__tmT("settings.followTheCurrentFirstDocument")}</option>`
        ];
        currentDocs.forEach(docItem => {
            const docId = typeof docItem === 'object' ? docItem.id : docItem;
            const docName = resolveDocName(docId);
            defaultDocOptions.push(`<option value="${docId}" ${defaultDocId === docId ? 'selected' : ''}>${esc(docName)}</option>`);
        });
        if (defaultDocId && !currentDocIds.includes(defaultDocId)) {
            const fallbackName = resolveDocName(defaultDocId);
            defaultDocOptions.push(`<option value="${defaultDocId}" selected>${__tmT("settings.notInTheCurrentList", { fallbackName: esc(fallbackName) })}</option>`);
        }
        const newTaskDocId = String(SettingsStore.data.newTaskDocId || '').trim();
        const newTaskLocationMode = __tmNormalizeNewTaskDefaultLocationMode(SettingsStore.data.newTaskDefaultLocationMode);
        const newTaskDailyNoteNotebookId = String(SettingsStore.data.newTaskDailyNoteNotebookId || '').trim();
        const dailyNoteNotebookOptions = [
            `<option value="" ${newTaskDailyNoteNotebookId ? '' : 'selected'}>${__tmT("settings.followTheCurrentDocumentSNotebook")}</option>`
        ];
        (Array.isArray(state.notebooks) ? state.notebooks : []).forEach((notebook) => {
            const notebookId = String(notebook?.id || notebook?.box || '').trim();
            if (!notebookId) return;
            const notebookName = String(notebook?.name || notebook?.title || notebookId).trim() || notebookId;
            dailyNoteNotebookOptions.push(`<option value="${notebookId}" ${newTaskDailyNoteNotebookId === notebookId ? 'selected' : ''}>${esc(notebookName)}</option>`);
        });
        if (newTaskDailyNoteNotebookId && !(Array.isArray(state.notebooks) ? state.notebooks : []).some((item) => String(item?.id || item?.box || '').trim() === newTaskDailyNoteNotebookId)) {
            dailyNoteNotebookOptions.push(`<option value="${newTaskDailyNoteNotebookId}" selected>${__tmT("settings.notInTheCurrentList2", { value1: esc(__tmGetNotebookDisplayName(newTaskDailyNoteNotebookId, newTaskDailyNoteNotebookId)) })}</option>`);
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
                <div class="tm-entry-icon-picker" role="radiogroup" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("settings.taskManagerpluginIcon")}">
                    ${presets.map((preset, index) => {
                        const id = String(preset?.id || '').trim();
                        const label = String(preset?.label || id).trim() || id;
                        const symbolId = String(preset?.symbolId || '').trim();
                        const active = id === selected;
                        const locked = id !== 'classic' && !hasFullFeature;
                        const orderLabel = id === 'classic' ? __tmT("settings.default") : String(index).padStart(2, '0');
                        return `
                            <button
                                type="button"
                                class="tm-entry-icon-option${active ? ' is-active' : ''}${locked ? ' is-locked' : ''}"
                                role="radio"
                                aria-checked="${active ? 'true' : 'false'}"
                                aria-label="${esc(label)}${locked ? __tmT("settings.fullFeatureBenefits") : ''}"
                                title="${esc(label)}${locked ? __tmT("settings.fullFeatureBenefits2") : ''}"
                                onclick="tmUpdateEntryIconPreset('${escSq(id)}')"
                            >
                                <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#${esc(symbolId)}" xlink:href="#${esc(symbolId)}"></use></svg>
                                <span>${orderLabel} ${esc(label)}</span>
                                ${locked ? `<small>${__tmT("settings.fullVersion")}</small>` : ''}
                            </button>
                        `;
                    }).join('')}
                </div>
            `;
        };
        const __tmBuildSettingsCustomFieldChipItem = (field) => {
            const fieldId = String(field?.id || '').trim();
            if (!fieldId) return null;
            const fieldLabel = String(field?.name || fieldId || '').trim() || __tmT("quickbar.untitled");
            return {
                key: `customField:${fieldId}`,
                label: __tmT("settings.custom2", { fieldLabel: fieldLabel }),
                title: __tmT("settings.customColumn", { fieldLabel: fieldLabel })
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
                        <div class="tm-settings-chip-group-count">${__tmT("settings.selected2", { selectedCount: selectedCount, totalCount: totalCount })}</div>
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
            const previewType = String(opt?.preview || '').trim();
            const previewHtml = previewType
                ? `<div class="tm-field-preview" data-tm-field-preview="${esc(previewType)}">${__tmRenderSettingsFieldPreview(previewType)}</div>`
                : '';
            const descHtml = String(desc || '').trim()
                ? `<div class="tm-settings-chip-setting-desc">${desc}</div>`
                : '';
            if (!heading && !description) {
                return `
                    <div class="tm-settings-chip-stack${groupsList.length > 1 ? ' tm-settings-chip-stack--multi' : ''}${extraClass ? ` ${extraClass}` : ''}"${extraStyle ? ` style="${extraStyle}"` : ''}>
                        ${groupsList.map((group) => renderSettingsChipGroup(group)).join('')}
                        ${previewHtml}
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
                        ${previewHtml}
                    </div>
                </div>
            `;
        };

        // ---------- 字段设置实时效果预览（复用真实视图类名，示例数据） ----------
        const __tmFieldPreviewStatusTag = (name, color) => {
            try { return `<span class="tm-status-tag" style="${__tmBuildStatusChipStyle(color || '#2f9e77')}">${esc(name)}</span>`; }
            catch (e) { return `<span class="tm-status-tag">${esc(name)}</span>`; }
        };
        const __tmFieldPreviewPriorityChip = () => {
            try { return `<span class="tm-kanban-priority-chip" style="${__tmBuildPriorityChipStyle('high')}">${__tmRenderPriorityJira('high', false)}</span>`; }
            catch (e) { return `<span class="tm-kanban-priority-chip">${__tmT("common.high")}</span>`; }
        };
        const __tmFieldPreviewCheckbox = () => {
            try {
                const html = __tmRenderTaskCheckbox('tm-field-preview', {}, { checked: false });
                if (html) return html;
            } catch (e) {}
            return '<span class="tm-field-preview__checkbox" aria-hidden="true"></span>';
        };
        const __tmFieldPreviewCustomFieldName = (key) => {
            const fieldId = String(key || '').replace(/^customField:/, '').trim();
            if (!fieldId) return '';
            try {
                const field = (__tmGetCustomFieldDefs() || []).find((item) => String(item?.id || '').trim() === fieldId);
                return String(field?.name || fieldId).trim() || fieldId;
            } catch (e) { return fieldId; }
        };
        const __tmFieldPreviewListMetaChip = (key) => {
            switch (key) {
                case 'docName': return `<span class="tm-checklist-meta-compact-doc">${__tmT("kernel.weeklyReport")}</span>`;
                case 'h2': return `<span class="tm-checklist-meta-compact-h2" title="${globalThis.__taskHorizonHostBridge.i18n.html("task.thisWeek")}">${__tmT("task.thisWeek")}</span>`;
                case 'startDate': return `<span class="tm-checklist-meta-compact-start tm-checklist-meta-compact-date tm-checklist-meta-compact-date--start">${__tmT("settings.sep")}</span>`;
                case 'completionTime': return `<span class="tm-checklist-meta-compact-time tm-checklist-meta-compact-date tm-checklist-meta-compact-date--completion">${__tmT("settings.sep2")}</span>`;
                case 'scheduleTime': return `<span class="tm-checklist-meta-compact-time tm-task-schedule-time--today" title="${globalThis.__taskHorizonHostBridge.i18n.html("settings.todaySScheduleStartTime")}">8:00</span>`;
                case 'remainingTime': return `<span class="tm-checklist-meta-compact-remaining" title="${globalThis.__taskHorizonHostBridge.i18n.html("settings.daysLeft")}">${__tmT("settings.daysLeft")}</span>`;
                case 'duration': return `<span class="tm-checklist-meta-compact-duration">1.5h</span>`;
                case 'tomatoSummary': return `<span class="tm-checklist-meta-compact-duration">${__tmT("settings.min")}</span>`;
                case 'tomatoEstimateCount': return `<span class="tm-checklist-meta-compact-duration">${__tmT("settings.est")}</span>`;
                case 'tomatoCount': return `<span class="tm-checklist-meta-compact-duration">${__tmT("settings.actual")}</span>`;
                case 'status': return __tmFieldPreviewStatusTag(__tmT("ai.inProgress"), '#2f9e77');
                default: {
                    const name = __tmFieldPreviewCustomFieldName(key);
                    return name ? `<span class="tm-checklist-meta-compact-custom-field" title="${esc(name)}">${__tmT("settings.example", { name: esc(name) })}</span>` : '';
                }
            }
        };
        const __tmFieldPreviewListRow = (keys, narrow) => {
            const selected = new Set(Array.isArray(keys) ? keys : []);
            const metaParts = __tmGetChecklistCompactMetaFieldOrder().filter((key) => selected.has(key)).map((key) => __tmFieldPreviewListMetaChip(key)).filter(Boolean);
            const metaHtml = metaParts.length ? `<div class="tm-checklist-meta-compact">${metaParts.join('')}</div>` : '';
            const emptyHint = !metaHtml ? `<span class="tm-field-preview__empty">${__tmT("settings.noFieldsShownOnTheRight")}</span>` : '';
            return `
                <div class="tm-checklist-pane tm-checklist-pane--compact${SettingsStore.data.checklistCompactMode ? '' : ' tm-checklist-pane--fields-below'} tm-field-preview__list-host">
                <div class="tm-checklist-group-card tm-field-preview__group-card">
                <div class="tm-checklist-group-card-items">
                <div class="tm-checklist-item tm-field-preview__row${narrow ? ' tm-field-preview__row--narrow' : ''}" style="--tm-checklist-compact-indent:0px;">
                    <div class="tm-checklist-leading"><span class="tm-tree-toggle tm-tree-toggle--placeholder" aria-hidden="true"></span>${__tmFieldPreviewCheckbox()}</div>
                    <div class="tm-checklist-item-main">
                        <div class="tm-checklist-title-row${metaHtml ? ' tm-checklist-title-row--has-compact-meta' : ''}">
                            <div class="tm-checklist-title-main"><div class="tm-checklist-title"><span class="tm-checklist-title-button"><span>${__tmT("settings.writeWeeklyReport")}</span></span></div></div>
                            ${metaHtml}${emptyHint}
                        </div>
                    </div>
                </div>
                </div>
                </div>
                </div>`;
        };
        const __tmFieldPreviewCardChip = (key) => {
            switch (key) {
                case 'priority': return __tmFieldPreviewPriorityChip();
                case 'status': return __tmFieldPreviewStatusTag(__tmT("ai.inProgress"), '#2f9e77');
                case 'date': return `<span class="tm-kanban-chip tm-kanban-chip--muted tm-kanban-chip--date tm-kanban-chip--date-has-value">${__tmT("settings.sep2")}</span>`;
                case 'scheduleTime': return `<span class="tm-kanban-chip tm-task-schedule-time--today" title="${globalThis.__taskHorizonHostBridge.i18n.html("settings.todaySScheduleStartTime")}">8:00</span>`;
                case 'remainingTime': return `<span class="tm-kanban-chip tm-kanban-chip--muted" title="${globalThis.__taskHorizonHostBridge.i18n.html("settings.daysLeft")}">${__tmT("settings.daysLeft")}</span>`;
                case 'tomatoSummary': return `<span class="tm-kanban-chip tm-kanban-chip--muted">${__tmT("settings.min")}</span>`;
                case 'tomatoEstimateCount': return `<span class="tm-kanban-chip tm-kanban-chip--muted">${__tmT("settings.est")}</span>`;
                case 'tomatoCount': return `<span class="tm-kanban-chip tm-kanban-chip--muted">${__tmT("settings.actual")}</span>`;
                case 'remark': return '';
                default: {
                    const name = __tmFieldPreviewCustomFieldName(key);
                    return name ? `<span class="tm-kanban-chip tm-kanban-chip--muted" title="${esc(name)}">${__tmT("settings.example", { name: esc(name) })}</span>` : '';
                }
            }
        };
        const __tmFieldPreviewCardFrame = (metaHtml, remarkHtml = '') => `
            <div class="tm-kanban-card tm-field-preview__card${remarkHtml ? ' tm-kanban-card--has-remark' : ''}">
                <div class="tm-kanban-card-top tm-kanban-card-main">
                    <div class="tm-kanban-card-head">
                        ${__tmFieldPreviewCheckbox()}
                        <div class="tm-kanban-card-text"><span class="tm-kanban-card-title-inline tm-task-content-clickable">${__tmT("settings.writeWeeklyReport")}</span></div>
                    </div>
                </div>
                ${metaHtml ? `<div class="tm-kanban-card-meta">${metaHtml}</div>` : ''}
                ${remarkHtml}
            </div>`;
        const __tmFieldPreviewCard = (keys) => {
            const list = Array.isArray(keys) ? keys : [];
            const metaHtml = list.map((key) => __tmFieldPreviewCardChip(key)).filter(Boolean).join('');
            const remarkHtml = list.includes('remark') ? `<div class="tm-task-card-remark">${__tmT("settings.waitingForAReply")}</div>` : '';
            const emptyHint = (!metaHtml && !remarkHtml) ? `<span class="tm-field-preview__empty">${__tmT("settings.onlyTheTitleIsShownOnTheCard")}</span>` : '';
            return __tmFieldPreviewCardFrame(metaHtml, remarkHtml) + emptyHint;
        };
        const __tmFieldPreviewStickyCard = (keys) => {
            const labels = { priority: __tmT("kernel.importance"), status: __tmT("kernel.status"), date: __tmT("calendar.date") };
            const chips = (Array.isArray(keys) ? keys : [])
                .map((key) => labels[key] ? `<span class="tm-kanban-chip tm-kanban-chip--muted tm-field-preview__chip--empty">${labels[key]} —</span>` : '')
                .filter(Boolean).join('');
            return __tmFieldPreviewCardFrame(chips);
        };
        const __tmFieldPreviewTimelineBar = (keys) => {
            const list = Array.isArray(keys) ? keys : [];
            const titleHtml = list.includes('title') ? `<span class="tm-gantt-bar__title">${__tmT("settings.writeWeeklyReport")}</span>` : '';
            const statusHtml = list.includes('status') ? `<span class="tm-gantt-bar__status">${__tmFieldPreviewStatusTag(__tmT("ai.inProgress"), '#2f9e77')}</span>` : '';
            const completeAtHtml = list.includes('taskCompleteAt') ? `<span class="tm-gantt-bar__complete-time" title="${globalThis.__taskHorizonHostBridge.i18n.html("kernel.completionTime")}"><span class="tm-gantt-bar__complete-time-value">09-22 18:30</span></span>` : '';
            const emptyHint = (!titleHtml && !statusHtml && !completeAtHtml) ? `<span class="tm-field-preview__empty">${__tmT("settings.noContentIsShownOnTheGanttBar")}</span>` : '';
            return `
                <div class="tm-field-preview__gantt-host">
                    <div class="tm-gantt-bar tm-field-preview__gantt" style="--tm-gantt-bar-fill: var(--tm-primary-color);">
                        <div class="tm-gantt-bar__surface"><span class="tm-gantt-bar__edge tm-gantt-bar__edge--end"></span></div>
                        <span class="tm-gantt-bar__label-layer">${titleHtml}${statusHtml}${completeAtHtml}</span>
                    </div>
                    ${emptyHint}
                </div>`;
        };
        const __tmFieldPreviewQuickbarProp = (attrKey, value, extraStyle = '') =>
            `<span class="sy-custom-props-floatbar__prop sy-custom-props-floatbar__prop--core" data-attr="${esc(attrKey)}"${extraStyle ? ` style="${extraStyle}"` : ''}><span class="sy-custom-props-floatbar__prop-value">${esc(value)}</span></span>`;
        const __tmFieldPreviewQuickbarItem = (key) => {
            switch (key) {
                case 'custom-status': return `<span class="sy-custom-props-floatbar__prop" data-attr="custom-status" style="background:#2f9e7720;border-color:#2f9e77;color:#2f9e77;"><span class="sy-custom-props-floatbar__prop-value">${__tmT("ai.inProgress")}</span></span>`;
                case 'custom-priority': return __tmFieldPreviewQuickbarProp('custom-priority', __tmT("common.high"));
                case 'custom-start-date': return __tmFieldPreviewQuickbarProp('custom-start-date', __tmT("settings.sep3"));
                case 'custom-completion-time': return __tmFieldPreviewQuickbarProp('custom-completion-time', __tmT("settings.sep2"));
                case 'taskCompleteAt': return __tmFieldPreviewQuickbarProp('taskCompleteAt', '09-22 18:30');
                case 'custom-focus-summary': return __tmFieldPreviewQuickbarProp('custom-focus-summary', __tmT("settings.min"));
                case 'custom-remark': return __tmFieldPreviewQuickbarProp('custom-remark', __tmT("settings.waitingForAReply"));
                case 'action-ai-title': return `<span class="sy-custom-props-floatbar__action" data-action="ai-title" title="${globalThis.__taskHorizonHostBridge.i18n.html("ai.aiOptimizeTaskName")}"><span class="qb-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4z"/></svg></span></span>`;
                case 'action-reminder': return `<span class="sy-custom-props-floatbar__action" data-action="reminder" title="${globalThis.__taskHorizonHostBridge.i18n.html("ai.warnings")}"><span class="qb-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="7"/><path d="M12 9.5V13l2.5 2.5M4.5 3.5L2.8 5.2m18.4-1.7l1.7 1.7"/></svg></span></span>`;
                case 'action-more': return `<span class="sy-custom-props-floatbar__action" data-action="more" title="${globalThis.__taskHorizonHostBridge.i18n.html("quickbar.more")}"><span class="qb-icon"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></span></span>`;
                default: {
                    const name = __tmFieldPreviewCustomFieldName(key);
                    return name ? __tmFieldPreviewQuickbarProp(key, __tmT("settings.example", { name: name })) : '';
                }
            }
        };
        const __tmFieldPreviewQuickbar = (keys) => {
            const items = (Array.isArray(keys) ? keys : []).map((key) => __tmFieldPreviewQuickbarItem(key)).filter(Boolean).join('');
            const mainRow = `<div class="sy-custom-props-floatbar__row sy-custom-props-floatbar__row--main">${items || `<span class="tm-field-preview__empty">${__tmT("settings.noFieldsShownInTheQuickbar")}</span>`}</div>`;
            return `<div class="sy-custom-props-floatbar tm-field-preview__floatbar">${mainRow}</div>`;
        };
        const __tmFieldPreviewInlineChip = (key) => {
            const chip = (cls, label, value) => `<span class="sy-custom-props-inline-chip${cls ? ` ${cls}` : ''}"><span class="sy-custom-props-inline-chip-label">${esc(label)}</span><span class="sy-custom-props-inline-chip-value">${esc(value)}</span></span>`;
            switch (key) {
                case 'subtask-count': return chip('', __tmT("calendar.subtasks"), '2/5');
                case 'custom-status': return chip('sy-custom-props-inline-chip--status', __tmT("kernel.status"), __tmT("ai.inProgress"));
                case 'custom-priority': return chip('', __tmT("kernel.importance"), __tmT("common.high"));
                case 'custom-start-date': return chip('sy-custom-props-inline-chip--time', __tmT("calendar.start"), __tmT("settings.sep3"));
                case 'custom-completion-time': return chip('sy-custom-props-inline-chip--time', __tmT("calendar.due"), __tmT("settings.sep2"));
                case 'remainingTime': return chip('', __tmT("settings.remaining"), __tmT("settings.daysLeft"));
                case 'taskCompleteAt': return chip('sy-custom-props-inline-chip--time', __tmT("quickbar.done"), '09-22 18:30');
                case 'custom-focus-summary': return chip('', __tmT("calendar.focus"), __tmT("settings.min"));
                case 'custom-remark': return chip('', __tmT("kernel.note"), __tmT("settings.waitingForAReply"));
                default: {
                    const name = __tmFieldPreviewCustomFieldName(key);
                    return name ? chip('', name, __tmT("settings.example2")) : '';
                }
            }
        };
        const __tmFieldPreviewInlineRow = (keys) => {
            const chips = (Array.isArray(keys) ? keys : []).map((key) => __tmFieldPreviewInlineChip(key)).filter(Boolean).join('');
            return `<div class="tm-field-preview__docline"><span class="tm-field-preview__docline-text">${__tmT("settings.writeWeeklyReport2")}</span>${chips || `<span class="tm-field-preview__empty">${__tmT("settings.noFieldsShownAtTheEndOfTheRow")}</span>`}</div>`;
        };
        const __tmRenderSettingsFieldPreview = (type) => {
            let caption = __tmT("settings.preview");
            let stage = '';
            let note = '';
            try {
                const data = SettingsStore.data || {};
                switch (String(type || '').trim()) {
                    case 'list-desktop':
                        caption = __tmT("settings.checklistDesktopCompactModeFieldsArrangedToTheRight");
                        stage = __tmFieldPreviewListRow(__tmNormalizeCompactChecklistMetaFields(data.desktopChecklistCompactMetaFields), false);
                        break;
                    case 'list-dock':
                        caption = __tmT("settings.checklistDockMobileFieldsOnTheRightOnNarrow");
                        stage = __tmFieldPreviewListRow(__tmNormalizeCompactChecklistMetaFields(data.dockChecklistCompactMetaFields), true);
                        break;
                    case 'timeline':
                        caption = __tmT("settings.timelineGanttBarCard");
                        stage = __tmFieldPreviewTimelineBar(__tmNormalizeTimelineCardFields(data.timelineCardFields));
                        break;
                    case 'kanban':
                        caption = __tmT("settings.kanbanCard");
                        stage = __tmFieldPreviewCard(__tmGetTaskCardFieldList('kanban'));
                        break;
                    case 'whiteboard':
                        caption = __tmT("settings.whiteboardCard");
                        stage = __tmFieldPreviewCard(__tmGetTaskCardFieldList('whiteboard'));
                        break;
                    case 'sticky':
                        caption = __tmT("settings.kanbanWhiteboardCardsReserveSpaceForEmptyFields");
                        stage = __tmFieldPreviewStickyCard(__tmGetTaskCardAlwaysShowFieldList());
                        note = `<div class="tm-field-preview__note">${__tmT("settings.selectedFieldsKeepTheirPlaceEvenWhenEmptyDashed")}</div>`;
                        break;
                    case 'quickbar':
                        caption = __tmT("settings.taskQuickbarFieldsAndActionsShownDirectly");
                        stage = __tmFieldPreviewQuickbar((Array.isArray(data.quickbarVisibleItems) ? data.quickbarVisibleItems : []).map((value) => String(value || '').trim()).filter(Boolean));
                        break;
                    case 'quickbar-inline':
                        caption = __tmT("settings.endOfDocumentTaskRowsPersistentFields");
                        stage = __tmFieldPreviewInlineRow((Array.isArray(data.quickbarInlineFields) ? data.quickbarInlineFields : []).map((value) => String(value || '').trim()).filter(Boolean));
                        break;
                    default:
                        break;
                }
            } catch (e) {}
            return `<span class="tm-field-preview__cap">${caption}</span><div class="tm-field-preview__stage">${stage || `<span class="tm-field-preview__empty">${__tmT("settings.noFieldsSelected")}</span>`}</div>${note}`;
        };
        const __tmRefreshSettingsFieldPreviews = (root) => {
            const modal = root || state.settingsModal;
            if (!modal || typeof modal.querySelectorAll !== 'function') return;
            modal.querySelectorAll('[data-tm-field-preview]').forEach((host) => {
                try { host.innerHTML = __tmRenderSettingsFieldPreview(host.dataset.tmFieldPreview); } catch (e) {}
            });
        };
        const __tmBindSettingsFieldPreviewRefresh = (modal) => {
            if (!modal || modal.__tmFieldPreviewRefreshBound) return;
            modal.__tmFieldPreviewRefreshBound = true;
            modal.addEventListener('change', () => {
                setTimeout(() => { try { __tmRefreshSettingsFieldPreviews(modal); } catch (e) {} }, 0);
            });
        };
        // 轻量刷新：chip 勾选类设置不改动设置页结构，跳过整窗重渲染，只同步选中态、计数与字段预览。
        state.__tmSettingsChipLightRefresh = () => {
            const modal = state.settingsModal;
            if (!(modal instanceof HTMLElement) || !document.body.contains(modal)) return;
            modal.querySelectorAll('.tm-settings-chip-group').forEach((section) => {
                const inputs = Array.from(section.querySelectorAll('.tm-settings-chip__input'));
                if (!inputs.length) return;
                inputs.forEach((input) => {
                    const chip = input.closest('.tm-settings-chip');
                    if (chip) chip.classList.toggle('is-selected', !!input.checked);
                });
                const countEl = section.querySelector('.tm-settings-chip-group-count');
                if (countEl) countEl.textContent = __tmT("settings.selected3", { length: inputs.filter((input) => input.checked).length, length2: inputs.length });
            });
            try { __tmRefreshSettingsFieldPreviews(modal); } catch (e) {}
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
                            <div class="tm-agent-tool-settings__summary">${__tmT("settings.readingTheToolList")}</div>
                        </div>
                    `;
                }
                const totalCount = groups.reduce((sum, group) => sum + (Array.isArray(group?.tools) ? group.tools.length : 0), 0);
                const enabledCount = groups.reduce((sum, group) => sum + (Array.isArray(group?.tools) ? group.tools.filter((tool) => tool?.effectiveEnabled === true).length : 0), 0);
                const deniedCount = groups.reduce((sum, group) => sum + (Array.isArray(group?.tools) ? group.tools.filter((tool) => tool?.enabled === true && tool?.agentAllowed === false).length : 0), 0);
                return `
                    <div class="tm-agent-tool-settings${toolsEnabled ? '' : ' is-disabled'}">
                        <div class="tm-agent-tool-settings__summary">
                            <span>${__tmT("settings.keepOnlyTheToolsYouNeedDisablingATool")}</span>
                            <span class="tm-agent-tool-settings__count">${__tmT("settings.available", { enabledCount: enabledCount, totalCount: totalCount, value3: deniedCount ? __tmT("settings.disabledInSiyuan", { deniedCount: deniedCount }) : '' })}</span>
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
                                            <span>${groupEnabledCount}/${tools.length}${groupDeniedCount ? __tmT("settings.disabledInSiyuan2", { groupDeniedCount: groupDeniedCount }) : ''}</span>
                                            <input class="b3-switch fn__flex-center" type="checkbox" ${allEnabled ? 'checked' : ''} ${toolsEnabled ? '' : 'disabled'} aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("settings.group", { value1: allEnabled ? __tmT("common.close") : __tmT("settings.enable"), value2: String(group?.label || groupID) })}" onclick="event.stopPropagation()" onchange="tmUpdateAgentMcpGroup('${escSq(groupID)}', this.checked)">
                                            <svg class="tm-agent-tool-group__chevron" aria-hidden="true"><use xlink:href="#iconDown"></use></svg>
                                        </div>
                                    </summary>
                                    <div class="tm-agent-tool-group__items">
                                        ${tools.map((tool) => {
                                            const name = String(tool?.name || '').trim();
                                            const agentDenied = tool?.enabled === true && tool?.agentAllowed === false;
                                            return `
                                                <label class="tm-agent-tool-item${agentDenied ? ' is-agent-denied' : ''}" title="${esc(agentDenied ? __tmT("settings.turnedOffInTheSiyuanAgentCapabilitySettings", { name: name }) : name)}">
                                                    <span>${esc(String(tool?.label || name))}${agentDenied ? `<small>${__tmT("settings.disabledInSiyuan3")}</small>` : ''}</span>
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
                <div class="tm-settings-panel" data-tm-settings-section="ai-mode" ${__tmSettingsSearchAttrs('ai', __tmT("settings.aiWorkflow"), __tmT("settings.siyuanAgentOrLegacyAi"))}>
                    <div class="tm-settings-section-title">${__tmT("settings.aiWorkflow")}</div>
                    <div class="tm-settings-section-desc">${__tmT("settings.siyuanAgentIsTheDefaultLegacySessionsAndSettings")}</div>
                    ${renderSingleFieldSetting(
                        __tmT("ai.currentMode"),
                        experienceMode === 'agent'
                            ? __tmT("settings.usesTheSiyuanAgentSDocumentProcessingSessionsAnd")
                            : __tmT("settings.keepsUsingThePluginSOriginalModelProvidersPrompts"),
                        `<select class="b3-select" onchange="tmUpdateAiExperienceMode(this.value)" style="width:220px;">
                            <option value="agent" ${experienceMode === 'agent' ? 'selected' : ''}>${__tmT("settings.siyuanAgentDefault")}</option>
                            <option value="legacy" ${experienceMode === 'legacy' ? 'selected' : ''}>${__tmT("settings.legacyPluginAi")}</option>
                        </select>`
                    )}
                    ${renderSingleFieldSetting(
                        __tmT("settings.chatFontSize"),
                        __tmT("settings.adjustsTheChatBodyTextOfUserAndAssistant"),
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
                    <div class="tm-settings-panel" data-tm-settings-section="ai-agent" ${__tmSettingsSearchAttrs('ai', __tmT("plugin.siyuanAgent"), __tmT("settings.taskScheduleReminderSchedulingRuleAndStatisticsTools"))}>
                        <div class="tm-settings-section-title">${__tmT("plugin.siyuanAgent")}</div>
                        <div class="tm-settings-section-desc">${__tmT("settings.modelsKeysCommonToolsAndSessionsAreManagedBy")}</div>
                        ${renderSingleSwitchSetting(
                            __tmT("settings.enableAiFeatures"),
                            __tmT("settings.hidesAiEntriesInsideTheTaskManagerWhenOff"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.aiEnabled ? 'checked' : ''} onchange="tmUpdateAiEnabled(this.checked)">`
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.enableTaskMcpTools"),
                            hasFullFeature
                                ? __tmT("settings.whenEnabledTaskHorizonRegistersTheSelectedTaskSchedule")
                                : __tmT("settings.staysOffOnTheFreeVersionTheSiyuanAgent"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${hasFullFeature && SettingsStore.data.agentMcpEnabled ? 'checked' : ''} ${hasFullFeature ? '' : 'disabled'} onchange="tmUpdateAgentMcpEnabled(this.checked)">`
                        )}
                        ${hasFullFeature ? renderAgentToolSettings(hasFullFeature) : ''}
                        ${renderSingleFieldSetting(
                            __tmT("settings.workflows"),
                            __tmT("settings.theFourWorkflowTypesCapturePlanningReviewAndTemplates"),
                            `<span class="tm-setting-field-unit">${__tmT("settings.capturePlanningReviewTemplates")}</span>`
                        )}
                        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
                            <button class="tm-btn tm-btn-secondary" onclick="tmAiTestConnection()">${__tmT("settings.checkAgent")}</button>
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
                    ? __tmT("settings.openaiCompatible")
                    : (provider === 'anthropic' ? __tmT("settings.anthropicCompatible") : 'MiniMax'));
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
                <div class="tm-settings-panel" data-tm-settings-section="ai-connection" ${__tmSettingsSearchAttrs('ai', __tmT("settings.aiAccess"), __tmT("settings.providerApiKeyBaseUrlModelTemperatureTimeoutAnd"))}>
                    <div class="tm-settings-section-title">${__tmT("settings.aiAccess2")}</div>
                    <div class="tm-settings-section-desc">${__tmT("settings.switchBetweenMinimaxDeepseekOpenaiCompatibleAndAnthropicCompatible")}</div>
                    ${renderSingleSwitchSetting(
                        __tmT("settings.enableAiFeatures"),
                        __tmT("settings.turningItOffHidesAllAiEntriesMenusAnd"),
                        `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.aiEnabled ? 'checked' : ''} onchange="tmUpdateAiEnabled(this.checked)">`
                    )}
                    ${renderSingleFieldSetting(
                        __tmT("settings.provider"),
                        __tmT("settings.switchTheActiveAiProviderApiKeysBaseUrls"),
                        `<select class="b3-select" onchange="tmUpdateAiProvider(this.value)" style="width:220px;">
                            <option value="minimax" ${provider === 'minimax' ? 'selected' : ''}>MiniMax</option>
                            <option value="deepseek" ${provider === 'deepseek' ? 'selected' : ''}>DeepSeek</option>
                            <option value="openai" ${provider === 'openai' ? 'selected' : ''}>${__tmT("settings.openaiCompatible")}</option>
                            <option value="anthropic" ${provider === 'anthropic' ? 'selected' : ''}>${__tmT("settings.anthropicCompatible")}</option>
                        </select>`,
                        { style: 'margin-top:10px;' }
                    )}
                    ${renderSingleFieldSetting(
                        'API Key',
                        provider === 'deepseek'
                            ? __tmT("settings.anApiKeyCreatedInTheDeepseekConsoleStored")
                            : (provider === 'openai'
                                ? __tmT("settings.anApiKeyCreatedInTheOpenaiConsoleSk")
                                : (provider === 'anthropic'
                                    ? __tmT("settings.anApiKeyCreatedInTheAnthropicConsoleSk")
                                    : __tmT("settings.anApiKeyCreatedInTheMinimaxConsoleStored"))),
                        `<input class="b3-text-field" type="password" value="${apiKey}" placeholder="${globalThis.__taskHorizonHostBridge.i18n.html("settings.enterApiKey", { providerLabel: providerLabel })}" onchange="tmUpdateAiApiKey(this.value)" style="width:100%;">`
                    )}
                    ${renderSingleFieldSetting(
                        'Base URL',
                        provider === 'deepseek'
                            ? __tmT("settings.usesTheDeepseekOpenaiCompatibleEndpointByDefault")
                            : (provider === 'openai'
                                ? __tmT("settings.usesTheOfficialOpenaiV1EndpointByDefaultCan")
                                : (provider === 'anthropic'
                                    ? __tmT("settings.usesTheOfficialAnthropicV1MessagesEndpointByDefault")
                                    : __tmT("settings.usesTheMinimaxAnthropicCompatibleEndpointByDefault"))),
                        `<input class="b3-text-field" type="text" value="${baseUrl}" onchange="tmUpdateAiBaseUrl(this.value)" style="width:100%;">`
                    )}
                    ${renderSingleFieldSetting(
                        __tmT("settings.model"),
                        provider === 'deepseek'
                            ? __tmT("settings.defaultsToDeepseekV4FlashEnterAnotherModelName")
                            : (provider === 'openai'
                                ? __tmT("settings.defaultsToGptMiniEnterAnotherModelNameSuch")
                                : (provider === 'anthropic'
                                    ? __tmT("settings.defaultsToClaudeSonnetEnterAnotherClaudeOrCompatible")
                                    : __tmT("settings.defaultsToMinimaxM2HighspeedEnterAnotherModelName"))),
                        provider === 'deepseek'
                            ? `<input class="b3-text-field" type="text" value="${esc(model)}" placeholder="deepseek-v4-flash" onchange="tmUpdateAiModel(this.value)" style="width:220px;">`
                            : (provider === 'openai'
                                ? `<input class="b3-text-field" type="text" value="${esc(model)}" placeholder="gpt-5.4-mini" onchange="tmUpdateAiModel(this.value)" style="width:220px;">`
                                : (provider === 'anthropic'
                                    ? `<input class="b3-text-field" type="text" value="${esc(model)}" placeholder="claude-sonnet-4-5" onchange="tmUpdateAiModel(this.value)" style="width:220px;">`
                                    : `<input class="b3-text-field" type="text" value="${esc(model)}" placeholder="MiniMax-M2.7-highspeed" onchange="tmUpdateAiModel(this.value)" style="width:220px;">`))
                    )}
                    ${provider === 'openai' ? '' : renderSingleFieldSetting(
                        __tmT("settings.temperature"),
                        __tmT("settings.lowerValuesAreMoreStableHigherValuesAreMore"),
                        `<input class="b3-text-field" type="number" step="0.1" min="0" max="1.5" value="${temperature}" onchange="tmUpdateAiTemperature(this.value)" style="width:88px;">`
                    )}
                    ${renderSingleFieldSetting(
                        __tmT("settings.maxOutputTokens"),
                        __tmT("settings.capsTheModelSMaximumResponseLength"),
                        `<input class="b3-text-field" type="number" min="256" max="8192" value="${maxTokens}" onchange="tmUpdateAiMaxTokens(this.value)" style="width:100px;">`
                    )}
                    ${renderSingleFieldSetting(
                        __tmT("settings.timeout"),
                        __tmT("settings.aiRequestTimeoutInMilliseconds"),
                        `<input class="b3-text-field" type="number" min="5000" max="180000" value="${timeoutMs}" onchange="tmUpdateAiTimeoutMs(this.value)" style="width:100px;">
                         <span class="tm-setting-field-unit">ms</span>`
                    )}
                    ${renderSingleFieldSetting(
                        __tmT("settings.defaultContextMode"),
                        __tmT("settings.nearbyContextSavesTokensFullTextSuitsSmartAnalysis"),
                        `<select class="b3-select" onchange="tmUpdateAiDefaultContextMode(this.value)" style="width:180px;">
                            <option value="nearby" ${contextMode === 'nearby' ? 'selected' : ''}>${__tmT("settings.nearbyContext")}</option>
                            <option value="fulltext" ${contextMode === 'fulltext' ? 'selected' : ''}>${__tmT("settings.withFullText")}</option>
                        </select>`
                    )}
                    ${renderSingleFieldSetting(
                        __tmT("settings.schedulingTimeSlots"),
                        __tmT("settings.multipleRangesAreSupportedOnePerLineEG"),
                        `<textarea class="b3-text-field" onchange="tmUpdateAiScheduleWindows(this.value)" style="width:260px;min-height:88px;resize:vertical;">${esc(scheduleWindows)}</textarea>`
                    )}
                    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
                        <button class="tm-btn tm-btn-secondary" onclick="tmAiTestConnection()">${__tmT("settings.testConnection")}</button>
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
                            <button class="tm-settings-nav-btn ${activeTab === 'docs' ? 'is-active' : ''}" data-tm-action="tmSwitchSettingsTab" data-tab="docs">${__tmT("settings.documentGroups")}</button>
                            <button class="tm-settings-nav-btn ${activeTab === 'main' ? 'is-active' : ''}" data-tm-action="tmSwitchSettingsTab" data-tab="main">${__tmT("settings.general2")}</button>
                            <button class="tm-settings-nav-btn ${activeTab === 'appearance' ? 'is-active' : ''}" data-tm-action="tmSwitchSettingsTab" data-tab="appearance">${__tmT("settings.appearance2")}</button>
                            <button class="tm-settings-nav-btn ${activeTab === 'calendar' ? 'is-active' : ''}" data-tm-action="tmSwitchSettingsTab" data-tab="calendar">${__tmT("settings.calendar")}</button>
                            <button class="tm-settings-nav-btn ${activeTab === 'ai' ? 'is-active' : ''}" data-tm-action="tmSwitchSettingsTab" data-tab="ai">🤖 AI</button>
                            <button class="tm-settings-nav-btn ${activeTab === 'rules' ? 'is-active' : ''}" data-tm-action="tmSwitchSettingsTab" data-tab="rules">${__tmT("settings.rules2")}</button>
                            <button class="tm-settings-nav-btn ${activeTab === 'quadrant' ? 'is-active' : ''}" data-tm-action="tmSwitchSettingsTab" data-tab="quadrant">${__tmT("settings.quadrants")}</button>
                            <button class="tm-settings-nav-btn ${activeTab === 'priority' ? 'is-active' : ''}" data-tm-action="tmSwitchSettingsTab" data-tab="priority">${__tmT("task.priorityScore3")}</button>
                            <button class="tm-settings-nav-btn ${activeTab === 'benefits' ? 'is-active' : ''}" data-tm-action="tmSwitchSettingsTab" data-tab="benefits">${__tmT("settings.featureBenefits")}</button>
                            <button class="tm-settings-nav-btn ${activeTab === 'about' ? 'is-active' : ''}" data-tm-action="tmSwitchSettingsTab" data-tab="about">${__tmT("settings.about2")}</button>
                            ` : `
                            <button class="tm-settings-nav-btn is-active">${state.editingRule ? __tmT("settings.editRule") : __tmT("settings.newRule")}</button>
                            `}
                        </div>
                        ${renderSettingsActions('tm-settings-actions--desktop')}
                    </div>
                    <div class="tm-settings-main">
                        <div class="tm-settings-content">
                    ${activeTab === 'appearance' ? `
                        ${renderSettingsSubtabs()}
                        <div class="tm-settings-panel tm-width-settings" data-tm-settings-section="columns" ${__tmSettingsSearchAttrs('appearance', __tmT("settings.tableColumns"), __tmT("settings.showOrderWidthAndCustomColumns"))}>
                            <div style="font-weight: 600; margin-bottom: 12px;">${__tmT("settings.tableColumnsShowOrderWidth")}</div>
                            ${renderColumnWidthSettings()}
                            ${renderSingleFieldSetting(
                                __tmT("settings.advancedBuiltInFieldAttributeNamesMigration"),
                                __tmT("settings.customizeTheAttributeNamesOfBuiltInFieldsSuch"),
                                `<button class="tm-btn tm-btn-secondary" onclick="tmOpenTaskMetaAttrMigrationDialog()">${__tmT("settings.openAdvancedSettings")}</button>`,
                                { style: 'margin-top:12px;', section: 'columns', key: 'appearance-task-meta-attr-migration' }
                            )}
                        </div>
                        <div class="tm-settings-panel" data-tm-settings-section="icons" ${__tmSettingsSearchAttrs('appearance', __tmT("settings.pluginIcon"), __tmT("settings.changesTheIconInTheSiyuanTopBarDocument"))}>
                            <div style="font-weight: 600; margin-bottom: 6px;">${__tmT("settings.pluginIcon")}</div>
                            <div style="font-size:13px;color:var(--tm-secondary-text);line-height:1.6;margin-bottom:12px;">${__tmT("settings.appliedToTheSiyuanTopBarDocumentBarPlugin")}</div>
                            ${renderEntryIconPresetSetting()}
                        </div>
                        ${__tmRenderTaskCountBadgeSettings(renderSingleSwitchSetting, renderSingleFieldSetting)}
                        <div class="tm-settings-panel" data-tm-settings-section="tabs" ${__tmSettingsSearchAttrs('appearance', __tmT("settings.tabBar"), __tmT("settings.manualArchiveControlArchiveEntryPosition"), { section: 'tabs' })}>
                            <div style="font-weight: 600; margin-bottom: 12px;">${__tmT("settings.tabBar2")}</div>
                            ${renderSingleSwitchSetting(
                                __tmT("settings.manualArchiveControl"),
                                __tmT("settings.whenEnabledDocumentTabsAreNotMovedToThe"),
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.docTabsManualArchiveOnly ? 'checked' : ''} onchange="updateDocTabsManualArchiveOnly(this.checked)">`,
                                { section: 'tabs' }
                            )}
                            ${renderSingleFieldSetting(
                                __tmT("settings.archiveEntryPosition"),
                                __tmT("settings.controlsWhetherTheArchiveButtonAppearsBeforeTheAll"),
                                `<select class="b3-select" onchange="updateDocTabsArchiveButtonPosition(this.value)" style="width:180px;">
                                    <option value="before-all" ${String(SettingsStore.data.docTabsArchiveButtonPosition || '') === 'before-all' ? 'selected' : ''}>${__tmT("settings.beforeTheAllTabLeft")}</option>
                                    <option value="after-docs" ${String(SettingsStore.data.docTabsArchiveButtonPosition || '') === 'before-all' ? '' : 'selected'}>${__tmT("settings.afterTheDocumentTabs")}</option>
                                </select>`
                            )}
                        </div>
                        <div class="tm-settings-panel" data-tm-settings-section="topbar" ${__tmSettingsSearchAttrs('appearance', __tmT("settings.topBarButton"), __tmT("settings.controlsTheVisibilityOfTheNewSearchRefreshCalendar"))}>
                            <div style="font-weight: 600; margin-bottom: 12px;">${__tmT("settings.topBarButton2")}</div>
                            ${renderSingleSwitchSetting(
                                __tmT("settings.newTaskButton"),
                                __tmT("settings.showsTheNewTaskEntryInTheDesktopWide"),
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${__tmIsTopbarButtonVisible('add') ? 'checked' : ''} onchange="tmUpdateTopbarButtonVisibility('add', this.checked)">`
                            )}
                            ${renderSingleSwitchSetting(
                                __tmT("settings.searchButton"),
                                __tmT("settings.showsTheTaskSearchEntryInTheDesktopWide"),
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${__tmIsTopbarButtonVisible('search') ? 'checked' : ''} onchange="tmUpdateTopbarButtonVisibility('search', this.checked)">`
                            )}
                            ${renderSingleSwitchSetting(
                                __tmT("settings.refreshButton"),
                                __tmT("settings.showsTheManualRefreshEntryInTheDesktopWide"),
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${__tmIsTopbarButtonVisible('refresh') ? 'checked' : ''} onchange="tmUpdateTopbarButtonVisibility('refresh', this.checked)">`
                            )}
                            ${renderSingleSwitchSetting(
                                __tmT("settings.calendarSidebarButton"),
                                __tmT("settings.showsAButtonInNonCalendarDesktopViewTop"),
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${__tmIsTopbarButtonVisible('calendarSidebar') ? 'checked' : ''} onchange="tmUpdateTopbarButtonVisibility('calendarSidebar', this.checked)">`
                            )}
                            ${renderSingleSwitchSetting(
                                __tmT("settings.aiWorkbenchButton"),
                                __tmT("settings.onlyVisibleWhileAiFeaturesAreEnabledThePreference"),
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${__tmIsTopbarButtonVisible('ai') ? 'checked' : ''} onchange="tmUpdateTopbarButtonVisibility('ai', this.checked)">`
                            )}
                        </div>
                        <div class="tm-settings-panel" data-tm-settings-section="checkbox" ${__tmSettingsSearchAttrs('appearance', __tmT("settings.taskCheckboxes"), __tmT("settings.roundedTaskCheckboxesColoredByPriority"))}>
                            <div style="font-weight: 600; margin-bottom: 12px;">${__tmT("settings.taskCheckboxes2")}</div>
                            ${renderSingleSwitchSetting(
                                __tmT("settings.roundedTaskCheckboxes"),
                                __tmT("settings.useTheRoundedTaskCheckboxStyle"),
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.taskCheckboxCircleStyleEnabled ? 'checked' : ''} onchange="updateTaskCheckboxCircleStyleEnabled(this.checked)">`
                            )}
                            ${renderSingleSwitchSetting(
                                __tmT("settings.colorDocumentTaskCheckboxesByPriority"),
                                __tmT("settings.colorsTaskCheckboxesInDocumentsAccordingToTheTask"),
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.taskCheckboxPriorityColorEnabled !== false ? 'checked' : ''} onchange="updateTaskCheckboxPriorityColorEnabled(this.checked)">`
                            )}
                        </div>
                        <div class="tm-settings-panel" data-tm-settings-section="colors" style="margin-bottom:0;" ${__tmSettingsSearchAttrs('appearance', __tmT("settings.colors"), __tmT("settings.adjustThemeKanbanTimelineAndTopBarColors"))}>
                            <div style="font-weight: 600; margin-bottom: 12px;">${__tmT("settings.colors2")}</div>
                            ${renderAppearanceColorSettings()}
                        </div>
                    ` : ''}

                    ${activeTab === 'calendar' ? `
                        ${renderSettingsSubtabs()}
                        <div id="tm-calendar-settings-root"></div>
                    ` : ''}

                    ${activeTab === 'ai' ? `${renderSettingsSubtabs()}${renderAiSettingsPanel()}` : ''}

                    ${activeTab === 'rules' ? `
                        <div class="tm-settings-panel" ${__tmSettingsSearchAttrs('rules', __tmT("settings.filterRules"), __tmT("settings.createEditApplyAndDeleteFilterRules"))}>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                <div style="font-weight: 600;">${__tmT("settings.filterRules2")}</div>
                                <div style="display:flex;gap:8px;align-items:center;">
                                    <button class="tm-btn tm-btn-primary" data-tm-action="addNewRule" style="padding: 4px 10px; font-size: 12px;">${__tmT("settings.newRule2")}</button>
                                    <button class="tm-btn tm-btn-secondary" data-tm-action="tmRestoreRecommendedRules" style="padding: 4px 10px; font-size: 12px;">${__tmT("task.restoreRecommendedFilters")}</button>
                                </div>
                            </div>
                            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; border:1px solid var(--tm-border-color); border-radius:8px; background: var(--tm-card-bg); margin-bottom: 12px;" ${__tmSettingsSearchAttrs('rules', __tmT("settings.forceTimelineSortByDueDate"), __tmT("settings.timelineRuleSortingBehavior"))}>
                                <div style="font-size:13px; color: var(--tm-text-color);">${__tmT("task.forceTimelineSortByDueDateCloserToToday")}</div>
                                <input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.timelineForceSortByCompletionNearToday ? 'checked' : ''} onchange="tmToggleTimelineForceSortByCompletionNearToday(this.checked)">
                            </div>
                            <div id="tm-rules-list" style="display: flex; flex-direction: column; gap: 8px;">
                                ${renderRulesList()}
                            </div>
                            <div style="font-size: 12px; color: var(--tm-secondary-text); margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--tm-border-color);">${__tmT("settings.combineKeywordInclusionExclusionImportanceStatusAndOtherConditions")}</div>
                        </div>
                    ` : ''}

                    ${activeTab === 'priority' ? `
                        <div class="tm-settings-panel" ${__tmSettingsSearchAttrs('priority', __tmT("task.priorityScore"), __tmT("settings.configurePriorityScoreWeightsAndRules"))}>
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
                        <div class="tm-settings-panel" ${__tmSettingsSearchAttrs('quadrant', __tmT("settings.quadrantGroupingRules"), __tmT("settings.automaticallyAssignsQuadrantsByPriorityAndDueDate"))}>
                            <div style="font-weight: 600; margin-bottom: 12px;">${__tmT("settings.quadrantGroupingRules2")}</div>
                            <div style="font-size: 12px; color: var(--tm-secondary-text); margin-bottom: 12px;">${__tmT("settings.automaticallyAssignsTasksToTheFourQuadrantsBasedOn")}</div>
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
                    ${settingsSearchCurrentSection = 'display', ''}
                    <div class="tm-settings-panel" data-tm-settings-section="display">
                        <div class="tm-settings-section-title">${__tmT("settings.basicDisplay")}</div>
                        <div class="tm-settings-section-desc">${__tmT("settings.adjustRegularFontSizesRowHeightAndTextPresentation")}</div>
                        ${renderSingleFieldSetting(
                            __tmT('settings.uiLanguage'),
                            __tmT('settings.uiLanguageDescription'),
                            `<select class="b3-select" data-tm-ui-language onchange="tmUpdateLanguagePreference(this.value)" style="max-width:100%;">
                                <option value="system" ${!['en', 'zh-CN'].includes(SettingsStore.data.uiLanguage) ? 'selected' : ''}>${esc(__tmT('settings.followSiyuan'))}</option>
                                <option value="zh-CN" ${SettingsStore.data.uiLanguage === 'zh-CN' ? 'selected' : ''}>简体中文</option>
                                <option value="en" ${SettingsStore.data.uiLanguage === 'en' ? 'selected' : ''}>English</option>
                            </select>
                            <button type="button" class="tm-btn tm-btn-secondary" data-tm-call="tmReloadLanguage">${esc(__tmT('settings.reloadLanguage'))}</button>`
                        )}
                        ${renderSingleFieldSetting(
                            ...__tmSettingsQueryText('fontSize'),
                            `<input class="b3-text-field" type="number" value="${SettingsStore.data.fontSize}" min="10" max="30" onchange="updateFontSize(this.value)" style="width:88px;">
                             <span class="tm-setting-field-unit">px</span>`
                        )}
                        ${renderSingleFieldSetting(
                            ...__tmSettingsQueryText('fontSizeMobile'),
                            `<input class="b3-text-field" type="number" value="${SettingsStore.data.fontSizeMobile || SettingsStore.data.fontSize}" min="10" max="30" onchange="updateFontSizeMobile(this.value)" style="width:88px;">
                             <span class="tm-setting-field-unit">px</span>`
                        )}
                        ${renderSingleFieldSetting(
                            ...__tmSettingsQueryText('rowHeightMode'),
                            `<select class="b3-select" onchange="updateRowHeightMode(this.value)" style="width:180px;">
                                <option value="auto" ${String(SettingsStore.data.rowHeightMode || 'auto') === 'auto' ? 'selected' : ''}>${__tmT("settings.auto")}</option>
                                <option value="compact" ${String(SettingsStore.data.rowHeightMode || '') === 'compact' ? 'selected' : ''}>${__tmT("settings.compact")}</option>
                                <option value="normal" ${String(SettingsStore.data.rowHeightMode || '') === 'normal' ? 'selected' : ''}>${__tmT("calendar.standard")}</option>
                                <option value="comfortable" ${String(SettingsStore.data.rowHeightMode || '') === 'comfortable' ? 'selected' : ''}>${__tmT("settings.relaxed")}</option>
                            </select>`
                        )}
                        ${renderSingleFieldSetting(
                            __tmT("settings.rowHeightPx"),
                            __tmT("settings.setsASpecificPixelValueFollowsTheRowHeight"),
                            `<input class="b3-text-field" type="number" value="${Number(SettingsStore.data.rowHeightPx) || 0}" min="0" max="120" onchange="updateRowHeightPx(this.value)" style="width:88px;">
                             <span class="tm-setting-field-unit">${__tmT("settings.follow")}</span>`
                        )}
                        ${renderSingleSwitchSetting(
                            ...__tmSettingsQueryText('remainingTimeUseWorkdays'),
                            '<input class="b3-switch fn__flex-center" type="checkbox" ' + (SettingsStore.data.remainingTimeUseWorkdays ? 'checked' : '') + ' onchange="updateRemainingTimeUseWorkdays(this.checked)">'
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.boldParentTaskNames"),
                            __tmT("settings.parentTaskNamesStayBoldWhenEnabledTaskNames"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.parentTaskNameBoldEnabled !== false ? 'checked' : ''} onchange="updateParentTaskNameBoldEnabled(this.checked)">`
                        )}
                        ${renderSingleSwitchSetting(
                            ...__tmSettingsQueryText('taskAutoWrapEnabled'),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.taskAutoWrapEnabled !== false ? 'checked' : ''} onchange="updateTaskAutoWrapEnabled(this.checked)">`
                        )}
                        ${renderSingleFieldSetting(
                            ...__tmSettingsQueryText('taskContentWrapMaxLines'),
                            `<input class="b3-text-field" type="number" value="${Math.max(1, Math.min(10, Number(SettingsStore.data.taskContentWrapMaxLines) || 2))}" min="1" max="10"
                                   ${SettingsStore.data.taskAutoWrapEnabled !== false ? '' : 'disabled'}
                                   onchange="updateTaskContentWrapMaxLines(this.value)" style="width:88px;opacity:${SettingsStore.data.taskAutoWrapEnabled !== false ? 1 : 0.6};">
                             <span class="tm-setting-field-unit">${__tmT("settings.lines")}</span>`,
                            { style: `opacity:${SettingsStore.data.taskAutoWrapEnabled !== false ? 1 : 0.6};` }
                        )}
                        ${renderSingleFieldSetting(
                            ...__tmSettingsQueryText('taskContentWrapMaxLinesMobile'),
                            `<input class="b3-text-field" type="number" value="${Math.max(1, Math.min(10, Number(SettingsStore.data.taskContentWrapMaxLinesMobile) || 2))}" min="1" max="10"
                                   ${SettingsStore.data.taskAutoWrapEnabled !== false ? '' : 'disabled'}
                                   onchange="updateTaskContentWrapMaxLinesMobile(this.value)" style="width:88px;opacity:${SettingsStore.data.taskAutoWrapEnabled !== false ? 1 : 0.6};">
                             <span class="tm-setting-field-unit">${__tmT("settings.lines")}</span>`,
                            { style: `opacity:${SettingsStore.data.taskAutoWrapEnabled !== false ? 1 : 0.6};` }
                        )}
                        ${renderSingleFieldSetting(
                            __tmT("settings.remarkLines"),
                            __tmT("settings.limitsTheMaximumNumberOfLinesShownForRemarks"),
                            `<input class="b3-text-field" type="number" value="${Math.max(1, Math.min(10, Number(SettingsStore.data.taskRemarkWrapMaxLines) || 2))}" min="1" max="10"
                                   ${SettingsStore.data.taskAutoWrapEnabled !== false ? '' : 'disabled'}
                                   onchange="updateTaskRemarkWrapMaxLines(this.value)" style="width:88px;opacity:${SettingsStore.data.taskAutoWrapEnabled !== false ? 1 : 0.6};">
                             <span class="tm-setting-field-unit">${__tmT("settings.lines")}</span>`,
                            { style: `opacity:${SettingsStore.data.taskAutoWrapEnabled !== false ? 1 : 0.6};` }
                        )}
                        ${renderSingleFieldSetting(
                            __tmT("settings.taskHeadingLevel"),
                            __tmT("settings.chooseTheH1H6HeadingLevelUsedForTask"),
                            `<select class="b3-select" onchange="updateTaskHeadingLevel(this.value)" style="width:180px;">
                                <option value="h1" ${SettingsStore.data.taskHeadingLevel === 'h1' ? 'selected' : ''}>${__tmT("settings.h1Heading")}</option>
                                <option value="h2" ${SettingsStore.data.taskHeadingLevel === 'h2' ? 'selected' : ''}>${__tmT("settings.h2Heading")}</option>
                                <option value="h3" ${SettingsStore.data.taskHeadingLevel === 'h3' ? 'selected' : ''}>${__tmT("settings.h3Heading")}</option>
                                <option value="h4" ${SettingsStore.data.taskHeadingLevel === 'h4' ? 'selected' : ''}>${__tmT("settings.h4Heading")}</option>
                                <option value="h5" ${SettingsStore.data.taskHeadingLevel === 'h5' ? 'selected' : ''}>${__tmT("settings.h5Heading")}</option>
                                <option value="h6" ${SettingsStore.data.taskHeadingLevel === 'h6' ? 'selected' : ''}>${__tmT("settings.h6Heading")}</option>
                            </select>`
                        )}
                        ${renderSingleSwitchSetting(
                            ...__tmSettingsQueryText('taskDoneDelightEnabled'),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.taskDoneDelightEnabled !== false ? 'checked' : ''} onchange="updateTaskDoneDelightEnabled(this.checked)">`,
                            { style: 'margin-top:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            __tmT("settings.documentNameDisplay"),
                            __tmT("settings.controlsWhetherThePluginShowsTheOriginalDocumentName"),
                            `<select class="b3-select" onchange="updateDocDisplayNameMode(this.value)" style="width:180px;">
                                <option value="name" ${__tmGetDocDisplayNameMode() === 'name' ? 'selected' : ''}>${__tmT("settings.preferDocumentName")}</option>
                                <option value="alias" ${__tmGetDocDisplayNameMode() === 'alias' ? 'selected' : ''}>${__tmT("settings.preferAlias")}</option>
                            </select>`
                        )}
                    </div>

                    ${settingsSearchCurrentSection = 'new-task', ''}
                    <div class="tm-settings-panel" data-tm-settings-section="new-task">
                        <div class="tm-settings-section-title">${__tmT("settings.newArchive")}</div>
                        <div class="tm-settings-section-desc">${__tmT("settings.setTheDefaultLocationForNewTasksAndHow")}</div>
                        ${renderSingleFieldSetting(
                            __tmT("settings.inboxDocument"),
                            __tmT("settings.aFixedCustomTargetDocumentIdForNewTasks"),
                            `<div style="display:flex; gap:8px; align-items:center;">
                                <input class="b3-text-field" type="text" readonly aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("settings.selectedInboxDocument")}"
                                       value="${esc(newTaskDocId)}" placeholder="${globalThis.__taskHorizonHostBridge.i18n.html("settings.noInboxDocumentSelected")}" title="${esc(newTaskDocId)}" style="flex:1;">
                                <button class="tm-btn tm-btn-secondary" type="button" onclick="tmOpenNewTaskDocSearch(this)" style="display:inline-flex;align-items:center;gap:6px;white-space:nowrap;">
                                    ${typeof __tmRenderLucideIcon === 'function' ? __tmRenderLucideIcon('search', '', { size: 14 }) : ''}<span>${__tmT("calendar.searchDocuments")}</span>
                                </button>
                            </div>`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.inboxIsShownOnlyOnItsDedicatedTab"),
                            __tmT("settings.whenEnabledTheAllTabOfCustomDocumentGroups"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.hideInboxFromAllTab === true ? 'checked' : ''} onchange="updateHideInboxFromAllTab(this.checked)">`
                        )}
                        ${renderSingleFieldSetting(
                            __tmT("settings.newTaskLocation"),
                            __tmT("settings.controlsTheLocationActuallyUsedByQuickTaskCreation"),
                            `<select class="b3-select" onchange="updateNewTaskLocationMode(this.value)" style="width:100%;">
                                <option value="configured" ${newTaskLocationMode === 'configured' ? 'selected' : ''}>${__tmT("settings.inboxDocument")}</option>
                                <option value="dailyNote" ${newTaskLocationMode === 'dailyNote' ? 'selected' : ''}>${__tmT("settings.todaySDailyNote")}</option>
                                <option value="lastSelected" ${newTaskLocationMode === 'lastSelected' ? 'selected' : ''}>${__tmT("settings.lastChoice")}</option>
                            </select>`
                        )}
                        <div style="margin-top:10px;">
                            ${renderSingleFieldSetting(
                                __tmT("settings.defaultNotebookForTodaySDailyNote"),
                                __tmT("settings.whenTheInboxDocumentOrQuickAddTargetIs"),
                                `<select class="b3-select" onchange="updateNewTaskDailyNoteNotebookId(this.value)" style="width:100%;">
                                    ${dailyNoteNotebookOptions.join('')}
                                </select>`
                            )}
                        </div>
                        <div style="margin-top:10px;">
                            ${renderSingleFieldSetting(
                                __tmT("settings.targetHeadingInTodaySDailyNote"),
                                __tmT("settings.whenConfiguredTasksCreatedInTodaySDailyNote"),
                                `<input class="b3-text-field" type="text"
                                       value="${esc(SettingsStore.data.newTaskDailyNoteTargetHeadingText || '')}"
                                       placeholder="${globalThis.__taskHorizonHostBridge.i18n.html("settings.forExampleTasks")}"
                                       onchange="updateNewTaskDailyNoteTargetHeadingText(this.value)"
                                       style="width:100%;">`
                            )}
                        </div>
                        <div style="margin-top:10px;">
                            ${renderSingleSwitchSetting(
                                __tmT("settings.enableMoveContentToTodaySDailyNote"),
                                __tmT("settings.whenEnabledTheEntryAppearsInTheBlockIcon"),
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.enableMoveBlockToDailyNote ? 'checked' : ''} onchange="updateEnableMoveBlockToDailyNote(this.checked)">`
                            )}
                        </div>
                        <div style="margin-top:10px;">
                            ${renderSingleSwitchSetting(
                                __tmT("settings.appendToTheBottomOfTheDailyNote"),
                                __tmT("settings.whenTheTargetIsTodaySDailyNoteIncluding"),
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.newTaskDailyNoteAppendToBottom ? 'checked' : ''} onchange="updateNewTaskDailyNoteAppendToBottom(this.checked)">`
                            )}
                        </div>
                        <div style="margin-top:10px;">
                            ${renderSingleSwitchSetting(
                                __tmT("settings.appendHeadingGroupsToTheEndOfTheContent"),
                                __tmT("settings.whenClickingNewTaskOnAHeadingGroupRow"),
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.headingGroupCreateAtSectionEnd ? 'checked' : ''} onchange="updateHeadingGroupCreateAtSectionEnd(this.checked)">`
                            )}
                        </div>
                        <div style="margin-top:10px;">
                            ${renderSingleSwitchSetting(
                                __tmT("settings.pinNewTasksByDefault"),
                                __tmT("settings.checksPinByDefaultWhenCreatingTasksInQuick"),
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.pinNewTasksByDefault ? 'checked' : ''} onchange="updatePinNewTasksByDefault(this.checked)">`
                            )}
                        </div>
                        <div style="margin-top:10px;">
                            ${renderSingleSwitchSetting(
                                __tmT("settings.defaultDueDateForQuickAddToday"),
                                __tmT("settings.whenEnabledQuickAddPreselectsTodayYouCanChange"),
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.quickAddDefaultCompletionToday ? 'checked' : ''} onchange="updateQuickAddDefaultCompletionToday(this.checked)">`
                            )}
                        </div>
                        <div style="margin-top:10px;">
                        ${renderSingleFieldSetting(
                            __tmT("settings.subtasksInheritParentTaskFields"),
                            __tmT("settings.whenCreatingASubtaskOnlyFieldsAlreadyFilledIn"),
                            renderSettingsChipSetting('', '', [
                                __tmBuildSettingsChipGroup(__tmT("settings.field"), __TM_SUBTASK_INHERIT_FIELD_OPTIONS.concat(__tmBuildSettingsCustomFieldChipItems()), {
                                    selectedSet: new Set(__tmNormalizeSubtaskInheritedFields(SettingsStore.data.subtaskInheritedFields)),
                                    onToggle: (item) => `updateSubtaskInheritedField('${escSq(String(item?.key || '').trim())}', this.checked)`
                                })
                            ])
                        )}
                    </div>
                        <div class="tm-settings-section-title" style="margin-top:20px;">${__tmT("task.taskArchive")}</div>
                        <div class="tm-settings-section-desc">${__tmT("settings.configureInOnePlaceHowTasksMoveAfterDeletion")}</div>
                        ${renderSingleFieldSetting(
                            __tmT("settings.whenDeletingTasks"),
                            __tmT("settings.permanentDeletionStillAsksForConfirmationRecycleBinDeletions"),
                            `<select class="b3-select" onchange="updateTaskDeleteMode(this.value)" style="width:220px;max-width:100%;">
                                <option value="permanent" ${__tmNormalizeTaskDeleteMode(SettingsStore.data.taskDeleteMode) === 'permanent' ? 'selected' : ''}>${__tmT("settings.permanentlyDelete")}</option>
                                <option value="recycle" ${__tmNormalizeTaskDeleteMode(SettingsStore.data.taskDeleteMode) === 'recycle' ? 'selected' : ''}>${__tmT("task.moveToTheRecycleBin")}</option>
                            </select>`
                        )}
                        ${renderSingleFieldSetting(
                            __tmT("settings.recycleBinDocumentId"),
                            __tmT("settings.usedOnlyWhenTheDeleteMethodIsMoveTo"),
                            `<input class="b3-text-field" type="text"
                                    value="${esc(SettingsStore.data.taskRecycleDocId || '')}"
                                    placeholder="${globalThis.__taskHorizonHostBridge.i18n.html("settings.enterRecycleBinDocumentId")}"
                                    autocomplete="off" spellcheck="false"
                                    onchange="updateTaskRecycleDocId(this.value)"
                                    style="width:100%;"
                                    ${__tmNormalizeTaskDeleteMode(SettingsStore.data.taskDeleteMode) === 'recycle' ? '' : 'disabled'}>`,
                            { style: 'margin-top:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            __tmT("settings.afterCompletingATopLevelTask"),
                            __tmT("settings.subtasksAndRecurringTasksAreNotMovedAutomaticallyThe"),
                            `<select class="b3-select" onchange="updateTaskCompletionArchiveMode(this.value)" style="width:260px;max-width:100%;">
                                <option value="none" ${__tmNormalizeTaskCompletionArchiveMode(SettingsStore.data.taskCompletionArchiveMode) === 'none' ? 'selected' : ''}>${__tmT("settings.doNotMove")}</option>
                                <option value="document" ${__tmNormalizeTaskCompletionArchiveMode(SettingsStore.data.taskCompletionArchiveMode) === 'document' ? 'selected' : ''}>${__tmT("settings.moveToASpecifiedArchiveDocument")}</option>
                                <option value="heading" ${__tmNormalizeTaskCompletionArchiveMode(SettingsStore.data.taskCompletionArchiveMode) === 'heading' ? 'selected' : ''}>${__tmT("settings.moveUnderACompletedHeadingInTheCurrentDocument")}</option>
                            </select>`,
                            { style: 'margin-top:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            __tmT("settings.completionArchiveDocumentId"),
                            __tmT("settings.usedOnlyWhenMoveToASpecifiedArchiveDocument"),
                            `<input class="b3-text-field" type="text"
                                    value="${esc(SettingsStore.data.taskCompletionArchiveDocId || '')}"
                                    placeholder="${globalThis.__taskHorizonHostBridge.i18n.html("settings.enterCompletedTaskArchiveDocumentId")}"
                                    autocomplete="off" spellcheck="false"
                                    onchange="updateTaskCompletionArchiveDocId(this.value)"
                                    style="width:100%;"
                                    ${__tmNormalizeTaskCompletionArchiveMode(SettingsStore.data.taskCompletionArchiveMode) === 'document' ? '' : 'disabled'}>`,
                            { style: 'margin-top:10px;' }
                        )}
                        <div style="font-size:12px;color:var(--tm-secondary-text);line-height:1.5;margin-top:8px;">${__tmT("settings.theCompletedHeadingIsCreatedUsingTheTaskHeading")}</div>
                    </div>

                    ${settingsSearchCurrentSection = 'status', ''}
                    <div class="tm-settings-panel" style="margin-bottom: 16px;" data-tm-settings-section="status">
                        <div class="tm-settings-section-title">${__tmT("settings.statusOptions")}</div>
                        <div class="tm-settings-section-desc">${SettingsStore.data.legacyWin7CompatMode ? __tmT("settings.maintainTheTaskStatusListForCompatibilityWithLegacy") : `${__tmT("settings.maintainTheTaskStatusListMarkersAreWrittenInto")}<code>- [ ]</code>${__tmT("settings.spaceAndAreUnfinishedXIsFinishedAndIs")}`}</div>
                        <div ${__tmSettingsSearchAttrs('main', __tmT("settings.statusList"), __tmT("settings.addEditReorderAndDeleteTaskStatusesSetTheir"), { section: 'status', key: 'main-status-options-list' })}>
                        <div id="tm-status-options-list">
                            ${renderStatusOptionsList()}
                        </div>
                        <button class="tm-btn tm-btn-primary" data-tm-action="addStatusOption" style="margin-top: 8px; margin-bottom: 10px; font-size: 12px;">${__tmT("settings.addStatus")}</button>
                        </div>
                        ${renderSingleFieldSetting(
                            __tmT("settings.statusWhenCheckedComplete"),
                            __tmT("settings.whenATaskCheckboxIsCheckedToCompleteIt"),
                            `<select class="b3-select" onchange="updateCheckboxStatusBinding('done', this.value)" style="width:180px;">
                                ${__tmRenderCheckboxStatusBindingOptionsHtml(SettingsStore.data.checkboxDoneStatusId)}
                            </select>`,
                            { style: 'margin-bottom:8px;' }
                        )}
                        ${renderSingleFieldSetting(
                            __tmT("settings.defaultUnfinishedStatus"),
                            __tmT("settings.unfinishedTasksUseTheStatusSetHereForCheckbox"),
                            `<select class="b3-select" onchange="updateCheckboxStatusBinding('undone', this.value)" style="width:180px;">
                                ${__tmRenderCheckboxStatusBindingOptionsHtml(SettingsStore.data.checkboxUndoneStatusId, { done: false })}
                            </select>`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.autoSyncParentStatusFromSubtasks"),
                            __tmT("settings.whenEnabledCompletingAllDirectSubtasksCompletesTheParent"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.autoCompleteParentOnSubtasksDone ? 'checked' : ''} onchange="updateAutoCompleteParentOnSubtasksDone(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.keepRecurringTasksCheckedInNotesAfterCompletion"),
                            __tmT("settings.whenEnabledThisCompletionStaysCheckedInTheNote"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.recurringTaskKeepNativeDoneUntilNextOccurrence === true ? 'checked' : ''} onchange="updateRecurringTaskKeepNativeDoneUntilNextOccurrence(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--tm-border-color);">
                            <div class="tm-settings-section-title">${__tmT("task.fsrsSpacedRepetition")}</div>
                            <div class="tm-settings-section-desc">${__tmT("settings.fsrsSchedulesTheNextDateFromActualReviewFeedback")}</div>
                            ${renderSingleFieldSetting(
                                __tmT("settings.targetRetention"),
                                __tmT("settings.higherValuesScheduleMoreFrequentReviewsIsRecommended"),
                                `<input class="b3-text-field" type="number" value="${Math.round((Number(SettingsStore.data.fsrsDesiredRetention) || 0.9) * 100)}" min="80" max="97" step="1" onchange="updateFsrsDesiredRetentionPercent(this.value)" style="width:88px;">
                                 <span class="tm-setting-field-unit">%</span>`
                            )}
                            ${renderSingleFieldSetting(
                                __tmT("settings.maximumReviewInterval"),
                                __tmT("settings.limitsHowManyDaysASingleSchedulingStepCan"),
                                `<input class="b3-text-field" type="number" value="${Math.max(30, Math.min(3650, Number(SettingsStore.data.fsrsMaximumIntervalDays) || 3650))}" min="30" max="3650" step="1" onchange="updateFsrsMaximumIntervalDays(this.value)" style="width:88px;">
                                 <span class="tm-setting-field-unit">${__tmT("homepage.days2")}</span>`
                            )}
                            ${renderSingleSwitchSetting(
                                __tmT("settings.spreadReviewDates"),
                                __tmT("settings.addsALittleRandomnessToLongerIntervalsSoFewer"),
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.fsrsEnableFuzz === true ? 'checked' : ''} onchange="updateFsrsEnableFuzz(this.checked)">`
                            )}
                        </div>
                    </div>

                    ${settingsSearchCurrentSection = 'layout', ''}
                    <div class="tm-settings-panel" data-tm-settings-section="layout">
                        <div class="tm-settings-section-title">${__tmT("settings.viewsLayout")}</div>
                        <div class="tm-settings-section-desc">${__tmT("settings.controlsTheDefaultViewCompactModesAndDisplayLayouts")}</div>
                        ${renderSingleFieldSetting(
                            __tmT("settings.defaultView"),
                            __tmT("settings.theViewOpenedByDefaultOnDesktopWhenThe"),
                            `<select class="b3-select" onchange="updateDefaultViewMode(this.value)" style="width:180px;">
                                ${__tmGetEnabledViews().map((viewId) => {
                                    const view = __TM_ALL_VIEWS.find(v => v.id === viewId);
                                    return view ? `<option value="${view.id}" ${String(__tmGetSafeViewMode(SettingsStore.data.defaultViewMode || 'checklist')) === view.id ? 'selected' : ''}>${view.longLabel}</option>` : '';
                                }).join('')}
                            </select>`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            __tmT("settings.mobileDefault"),
                            __tmT("settings.theDefaultViewUsedOnFirstOpenOnMobile"),
                            `<select class="b3-select" onchange="updateDefaultViewModeMobile(this.value)" style="width:180px;">
                                ${__tmGetEnabledViews().map((viewId) => {
                                    const view = __TM_ALL_VIEWS.find(v => v.id === viewId);
                                    return view ? `<option value="${view.id}" ${String(__tmGetSafeViewMode(SettingsStore.data.defaultViewModeMobile || SettingsStore.data.defaultViewMode || 'checklist')) === view.id ? 'selected' : ''}>${view.longLabel}</option>` : '';
                                }).join('')}
                            </select>`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.openTheTaskManagerOnMobileStartup"),
                            __tmT("settings.onlyAppliesAfterAColdStartOfTheSiyuan"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.mobileAutoOpenOnStartup === true ? 'checked' : ''} onchange="updateMobileAutoOpenOnStartup(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.autoHideTheTabBar"),
                            __tmT("settings.whenEnabledTheDocumentTabBarStartsCollapsedOn"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.docTabsAutoHideEnabled ? 'checked' : ''} onchange="updateDocTabsAutoHideEnabled(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.tintTabsByDelayScore"),
                            __tmT("settings.whenEnabledDocumentTabsAreTintedRedSlightlyBy"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.docTabProcrastinationTintEnabled !== false ? 'checked' : ''} onchange="updateDocTabProcrastinationTintEnabled(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${!__tmIsRuntimeMobileClient() ? `
                        ${renderSingleSwitchSetting(
                            __tmT("settings.enableTheDockSidebar"),
                            __tmT("settings.addsATaskDockOnDesktopSimilarToThe"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.dockSidebarEnabled !== false ? 'checked' : ''} onchange="updateDockSidebarEnabled(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        <div style="margin-bottom:10px;opacity:${SettingsStore.data.dockSidebarEnabled !== false ? 1 : 0.6};">
                            ${renderSingleFieldSetting(
                                __tmT("settings.dockDefaultView"),
                                __tmT("settings.usedOnlyByTheTaskDockSidebarFollowsThe"),
                                `<select class="b3-select" onchange="updateDockDefaultViewMode(this.value)" ${SettingsStore.data.dockSidebarEnabled !== false ? '' : 'disabled'} style="width:180px;">
                                    <option value="follow-mobile" ${__tmGetDockDefaultViewValue() === 'follow-mobile' ? 'selected' : ''}>${__tmT("settings.followMobileDefault")}</option>
                                    ${__tmGetEnabledViews().map((viewId) => {
                                        const view = __TM_ALL_VIEWS.find(v => v.id === viewId);
                                        return view ? `<option value="${view.id}" ${__tmGetDockDefaultViewValue() === view.id ? 'selected' : ''}>${view.longLabel}</option>` : '';
                                    }).join('')}
                                </select>`
                            )}
                        </div>
                        ${renderSingleSwitchSetting(
                            __tmT("settings.dockSidebarFollowsTheCurrentDocument"),
                            __tmT("settings.whenEnabledWhileTheDockSidebarIsVisibleAnd"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.dockSidebarFollowCurrentDocument ? 'checked' : ''} ${SettingsStore.data.dockSidebarEnabled !== false ? '' : 'disabled'} onchange="updateDockSidebarFollowCurrentDocument(this.checked)">`,
                            { style: `margin-bottom:10px;opacity:${SettingsStore.data.dockSidebarEnabled !== false ? 1 : 0.6};` }
                        )}
                        ` : ''}
                        <div class="tm-settings-section-title" style="margin-top:20px;">${__tmT("settings.taskTitleClick")}</div>
          <div class="tm-settings-section-desc">${__tmT("settings.controlsTitleClickBehaviorAcrossAllTaskViewsHolding")}</div>
                        ${renderSingleFieldSetting(
                            __tmT("settings.defaultAction"),
                            __tmT("settings.clickingATaskTitleInTheDesktopMainUi"),
                            `<select class="b3-select" onchange="updateTaskTitleClickAction(this.value)" style="width:180px;">
                                <option value="jump" ${__tmNormalizeTaskTitleClickAction(SettingsStore.data.taskTitleClickAction) === 'jump' ? 'selected' : ''}>${__tmT("calendar.openTask")}</option>
                                <option value="detail" ${__tmNormalizeTaskTitleClickAction(SettingsStore.data.taskTitleClickAction) === 'detail' ? 'selected' : ''}>${__tmT("settings.openDetails")}</option>
                            </select>`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${!__tmIsRuntimeMobileClient() ? renderSingleFieldSetting(
                            'Dock',
                            __tmT("settings.theTaskDockCanFollowTheDefaultActionOr"),
                            `<select class="b3-select" onchange="updateDockTaskTitleClickAction(this.value)" style="width:180px;">
                                <option value="inherit" ${__tmNormalizeTaskTitleClickOverride(SettingsStore.data.dockTaskTitleClickAction) === 'inherit' ? 'selected' : ''}>${__tmT("settings.followDefault")}</option>
                                <option value="jump" ${__tmNormalizeTaskTitleClickOverride(SettingsStore.data.dockTaskTitleClickAction) === 'jump' ? 'selected' : ''}>${__tmT("calendar.openTask")}</option>
                                <option value="detail" ${__tmNormalizeTaskTitleClickOverride(SettingsStore.data.dockTaskTitleClickAction) === 'detail' ? 'selected' : ''}>${__tmT("settings.openDetails")}</option>
                            </select>`,
                            { style: 'margin-bottom:10px;' }
                        ) : ''}
                        ${renderSingleFieldSetting(
                            __tmT("calendar.mobile"),
                            __tmT("settings.mobileCanFollowTheDefaultActionOrUseIts"),
                            `<select class="b3-select" onchange="updateMobileTaskTitleClickAction(this.value)" style="width:180px;">
                                <option value="inherit" ${__tmNormalizeTaskTitleClickOverride(SettingsStore.data.mobileTaskTitleClickAction) === 'inherit' ? 'selected' : ''}>${__tmT("settings.followDefault")}</option>
                                <option value="jump" ${__tmNormalizeTaskTitleClickOverride(SettingsStore.data.mobileTaskTitleClickAction) === 'jump' ? 'selected' : ''}>${__tmT("calendar.openTask")}</option>
                                <option value="detail" ${__tmNormalizeTaskTitleClickOverride(SettingsStore.data.mobileTaskTitleClickAction) === 'detail' ? 'selected' : ''}>${__tmT("settings.openDetails")}</option>
                            </select>`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        <div style="margin-bottom:10px;">
                            ${renderSingleFieldSetting(
                                __tmT("settings.dockMobileCompactRightSideFields"),
                                __tmT("settings.controlsWhichInfoAppearsToTheRightOfTasks"),
                                (() => {
                                    const selected = new Set(__tmNormalizeCompactChecklistMetaFields(SettingsStore.data.dockChecklistCompactMetaFields));
                                    const customFieldOptions = __tmGetCustomFieldDefs()
                                        .filter((field) => String(field?.id || '').trim() && field?.enabled !== false && String(field?.type || '').trim() !== 'text')
                                        .map((field) => __tmBuildSettingsCustomFieldChipItem(field))
                                        .filter((item) => item && __tmParseCustomFieldColumnKey(item.key));
                                    const options = __TM_CHECKLIST_COMPACT_META_FIELD_OPTIONS.concat(customFieldOptions);
                                return renderSettingsChipSetting('', '', [
                                    __tmBuildSettingsChipGroup(__tmT("settings.field"), options, {
                                        selectedSet: selected,
                                        onToggle: (item) => `updateChecklistCompactMetaFieldVisibility('dock', '${escSq(String(item?.key || '').trim())}', this.checked)`
                                    })
                                ], { preview: 'list-dock' });
                            })()
                            )}
                        </div>
                        ${renderSingleFieldSetting(
                            __tmT("settings.desktopCompactRightSideFields"),
                            __tmT("settings.controlsWhichInfoAppearsToTheRightOfTasks2"),
                            (() => {
                                const selected = new Set(__tmNormalizeCompactChecklistMetaFields(SettingsStore.data.desktopChecklistCompactMetaFields));
                                    const customFieldOptions = __tmGetCustomFieldDefs()
                                        .filter((field) => String(field?.id || '').trim() && field?.enabled !== false && String(field?.type || '').trim() !== 'text')
                                        .map((field) => __tmBuildSettingsCustomFieldChipItem(field))
                                        .filter((item) => item && __tmParseCustomFieldColumnKey(item.key));
                                const options = __TM_CHECKLIST_COMPACT_META_FIELD_OPTIONS.concat(customFieldOptions);
                                return renderSettingsChipSetting('', '', [
                                    __tmBuildSettingsChipGroup(__tmT("settings.field"), options, {
                                        selectedSet: selected,
                                        onToggle: (item) => `updateChecklistCompactMetaFieldVisibility('desktop', '${escSq(String(item?.key || '').trim())}', this.checked)`
                                    })
                                ], { preview: 'list-desktop' });
                            })(),
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            __tmT("settings.compactRightSideFont"),
                            __tmT("settings.controlsTheFontSizeOfTheCompactChecklistRight"),
                            `<select class="b3-select" onchange="updateChecklistCompactRightFontSize(this.value)" style="width:140px;">
                                ${__TM_CHECKLIST_COMPACT_RIGHT_FONT_SIZE_OPTIONS.map((item) => `<option value="${item.key}" ${__tmGetChecklistCompactRightFontSize() === item.key ? 'selected' : ''}>${item.label}</option>`).join('')}
                            </select>`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            __tmT("settings.timelineCardFields"),
                            __tmT("settings.controlsWhetherTimelineCardsShowTheTaskNameStatus"),
                            (() => {
                                const selected = new Set(__tmNormalizeTimelineCardFields(SettingsStore.data.timelineCardFields));
                                return renderSettingsChipSetting('', '', [
                                    __tmBuildSettingsChipGroup(__tmT("settings.field"), __TM_TIMELINE_CARD_FIELD_OPTIONS, {
                                        selectedSet: selected,
                                        onToggle: (item) => `updateTimelineCardFieldVisibility('${escSq(String(item?.key || '').trim())}', this.checked)`
                                    })
                                ], { preview: 'timeline' });
                            })(),
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            __tmT("settings.summaryTimelineLinkSource"),
                            __tmT("settings.theSummaryTimelinesOfDocumentGroupsAndTabGroups"),
                            `<select class="b3-select" onchange="tmUpdateTimelineDependencyScope(this.value)" style="width:220px;max-width:100%;">
                                ${__tmGetWhiteboardLinkSourceOptions('local').map((option) => `<option value="${option.value}" ${__tmNormalizeTimelineDependencyScope(SettingsStore.data.timelineDependencyScope) === option.value ? 'selected' : ''}>${option.label}</option>`).join('')}
                            </select>`,
                            { style: 'margin-bottom:10px;', controlMode: 'stack' }
                        )}
                        <div style="margin-bottom:10px;" ${__tmSettingsSearchAttrs('main', __tmT("settings.visibleViews"), __tmT("settings.chooseWhichViewsAreEnabledAmongTableChecklistTimeline"), { section: 'layout', key: 'main-enabled-views' })}>
                            ${renderSettingsChipSetting('', '', [
                                __tmBuildSettingsChipGroup(__tmT("settings.visibleViews"), __TM_ALL_VIEWS.map((view) => {
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
                            <div style="font-size:12px;color:var(--tm-secondary-text);margin-top:6px;">${__tmT("settings.theTopBarAndMobileViewSwitcherHideViews")}</div>
                        </div>
                        ${renderSingleSwitchSetting(
                            __tmT("settings.kanbanCompactMode"),
                            __tmT("settings.narrowerAndShorterFitsMoreCards"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.kanbanCompactMode ? 'checked' : ''} onchange="updateKanbanCompactMode(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            __tmT("settings.kanbanAppearance"),
                            __tmT("settings.cardStyleKeepsRoundedCornersVerticalLanesUseSoft"),
                            `<select class="b3-select" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("settings.kanbanAppearance")}" onchange="updateKanbanAppearance(this.value)">
                                <option value="lanes" ${SettingsStore.data.kanbanAppearance !== 'classic' ? 'selected' : ''}>${__tmT("settings.verticalLanes")}</option>
                                <option value="classic" ${SettingsStore.data.kanbanAppearance === 'classic' ? 'selected' : ''}>${__tmT("settings.cardStyle")}</option>
                            </select>`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${SettingsStore.data.kanbanAppearance !== 'classic' ? renderSingleFieldSetting(
                            __tmT("settings.laneColorIntensity"),
                            __tmT("settings.adjustsTheDepthOfVerticalLaneBackgroundColors"),
                            `<input type="range" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("settings.laneColorIntensity")}" min="6" max="30" step="1" value="${__tmNormalizeKanbanLaneColorStrength(SettingsStore.data.kanbanLaneColorStrength)}" oninput="updateKanbanLaneColorStrength(this.value,false);this.nextElementSibling.textContent=this.value+'%';" onchange="updateKanbanLaneColorStrength(this.value)" style="max-width:180px;">
                             <span class="tm-setting-field-unit" style="min-width:42px;text-align:right;">${__tmNormalizeKanbanLaneColorStrength(SettingsStore.data.kanbanLaneColorStrength)}%</span>`,
                            { style: 'margin-bottom:10px;' }
                        ) : ''}
                        ${renderSingleSwitchSetting(
                            ...__tmSettingsQueryText('checklistCompactMode'),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.checklistCompactMode ? 'checked' : ''} onchange="updateChecklistCompactMode(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.checklistCompactHierarchyLines"),
                            __tmT("settings.showsVerticalHierarchyLinesForSubtasksInTheChecklist"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.checklistCompactTreeGuides ? 'checked' : ''} onchange="updateChecklistCompactTreeGuides(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            __tmT("settings.kanbanWidth"),
                            __tmT("settings.adjustsKanbanColumnWidthForDifferentInformationDensities"),
                            `<input type="range" min="220" max="520" step="10" value="${Number(SettingsStore.data.kanbanColumnWidth) || 320}" onchange="updateKanbanColumnWidth(this.value)" style="max-width:180px;">
                             <span class="tm-setting-field-unit" style="min-width:52px;text-align:right;">${Math.max(220, Math.min(520, Number(SettingsStore.data.kanbanColumnWidth) || 320))}px</span>`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.stretchTableAndKanbanWidthsToFillTheWindow"),
                            __tmT("settings.whenTheWindowIsWiderThanTheTotalColumn"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.kanbanFillColumns ? 'checked' : ''} onchange="updateKanbanFillColumns(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            __tmT("settings.kanbanCardFields"),
                            __tmT("settings.controlsWhichTaskFieldsAppearOnKanbanCardsSingle"),
                            (() => {
                                const selected = new Set(__tmGetTaskCardFieldList('kanban'));
                                return renderSettingsChipSetting('', '', [
                                    __tmBuildSettingsChipGroup(__tmT("settings.field"), __TM_TASK_CARD_FIELD_OPTIONS.concat(__tmBuildSettingsCustomFieldChipItems()), {
                                        selectedSet: selected,
                                        onToggle: (item) => `updateTaskCardFieldVisibility('kanban', '${escSq(String(item?.key || '').trim())}', this.checked)`
                                    })
                                ], { preview: 'kanban' });
                            })(),
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            __tmT("settings.whiteboardCardFields"),
                            __tmT("settings.controlsWhichTaskFieldsAppearOnWhiteboardCardsSingle"),
                            (() => {
                                const selected = new Set(__tmGetTaskCardFieldList('whiteboard'));
                                return renderSettingsChipSetting('', '', [
                                    __tmBuildSettingsChipGroup(__tmT("settings.field"), __TM_TASK_CARD_FIELD_OPTIONS.concat(__tmBuildSettingsCustomFieldChipItems()), {
                                        selectedSet: selected,
                                        onToggle: (item) => `updateTaskCardFieldVisibility('whiteboard', '${escSq(String(item?.key || '').trim())}', this.checked)`
                                    })
                                ], { preview: 'whiteboard' });
                            })(),
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.deleteWhiteboardCardsWithTasks"),
                            __tmT("settings.whenEnabledDeletingATaskAlsoRemovesItsCard"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.deleteTaskRemovesWhiteboardCards !== false ? 'checked' : ''} onchange="updateDeleteTaskRemovesWhiteboardCards(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            __tmT("settings.whiteboardOrderSource"),
                            __tmT("settings.withWhiteboardOrderModeEnabledTasksForTheCurrent"),
                            `<select class="b3-select" onchange="updateWhiteboardSequenceScope(this.value)" style="width:180px;">
                                ${__tmGetWhiteboardLinkSourceOptions().map((option) => `<option value="${option.value}" ${__tmNormalizeWhiteboardSequenceScope(SettingsStore.data.whiteboardSequenceScope) === option.value ? 'selected' : ''}>${option.label}</option>`).join('')}
                            </select>`,
                            { style: 'margin-bottom:10px;', controlMode: 'stack' }
                        )}
                        ${renderSingleFieldSetting(
                            __tmT("settings.defaultWhiteboardTextSize"),
                            __tmT("settings.theDefaultFontSizeForTextCreatedInText"),
                            `<input class="b3-text-field" type="number" min="10" max="40" step="1" value="${Math.max(10, Math.min(40, Math.round(Number(SettingsStore.data.whiteboardNoteDefaultFontSize) || 20)))}" onchange="updateWhiteboardNoteDefaultFontSize(this.value)" style="width:88px;">
                             <span class="tm-setting-field-unit">px</span>`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            __tmT("settings.alwaysShowCardFields"),
                            __tmT("settings.controlsWhetherEmptyOrDefaultFieldsOnKanbanAnd"),
                            (() => {
                                const selected = new Set(__tmGetTaskCardAlwaysShowFieldList());
                                return renderSettingsChipSetting('', '', [
                                    __tmBuildSettingsChipGroup(__tmT("settings.persistentFields"), __TM_TASK_CARD_ALWAYS_SHOW_FIELD_OPTIONS, {
                                        selectedSet: selected,
                                        onToggle: (item) => `updateTaskCardAlwaysShowField('${escSq(String(item?.key || '').trim())}', this.checked)`
                                    })
                                ], { preview: 'sticky' });
                            })(),
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            __tmT("settings.cardStreamMinimumWidth"),
                            __tmT("settings.forTheCardStreamOnTheWhiteboardAllTabs"),
                            `<input type="range" min="220" max="520" step="10" value="${Number(SettingsStore.data.whiteboardAllTabsCardMinWidth) || 320}" onchange="updateWhiteboardAllTabsCardMinWidth(this.value)" style="max-width:180px;">
                             <span class="tm-setting-field-unit" style="min-width:52px;text-align:right;">${Math.max(220, Math.min(520, Number(SettingsStore.data.whiteboardAllTabsCardMinWidth) || 320))}px</span>`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.twoColumnCardStreamOnMobile"),
                            __tmT("settings.forTheCardStreamOnTheWhiteboardAllTabs2"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.whiteboardStreamMobileTwoColumns !== false ? 'checked' : ''} onchange="updateWhiteboardStreamMobileTwoColumns(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.separateCompletedKanbanColumn"),
                            __tmT("settings.appliesWhenDonTGroupCompletedTasksIsOff"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.kanbanShowDoneColumn ? 'checked' : ''} onchange="updateKanbanShowDoneColumn(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.syncSubtaskStatusWhenDraggingParentTasksOnThe"),
                            __tmT("settings.draggingAParentTaskToChangeStatusUpdatesIts"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.kanbanDragSyncSubtasks ? 'checked' : ''} onchange="updateKanbanDragSyncSubtasks(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.keepSubtasksWithTheirParentOnTheKanban"),
                            __tmT("settings.whenEnabledSubtasksAlwaysFollowTheirParentTaskDiffering"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.kanbanPreventSubtaskSeparation ? 'checked' : ''} onchange="updateKanbanPreventSubtaskSeparation(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            __tmT("settings.durationUnit"),
                            __tmT("settings.controlsWhetherTaskDurationsAndPresetNumbersAreInterpreted"),
                            `<select class="b3-select" onchange="updateDurationFormat(this.value)" style="width:180px;">
                                <option value="hours" ${String(SettingsStore.data.durationFormat || 'hours') === 'hours' ? 'selected' : ''}>${__tmT("settings.hoursMin")}</option>
                                <option value="minutes" ${String(SettingsStore.data.durationFormat || '') === 'minutes' ? 'selected' : ''}>${__tmT("settings.minutesH")}</option>
                            </select>`
                        )}
                        <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--tm-border-color);" ${__tmSettingsSearchAttrs('main', __tmT("settings.durationPresets"), __tmT("settings.quickDurationChoicesForTaskDetailsTheQuickbarAnd"), { section: 'layout', key: 'main-duration-presets' })}>
                            <div style="font-size:13px;font-weight:600;margin-bottom:6px;">${__tmT("settings.durationPresets")}</div>
                            <div style="font-size:12px;color:var(--tm-secondary-text);margin-bottom:10px;">${__tmT("settings.quickDurationChoicesForTaskDetailsTheQuickbarAnd2")}</div>
                            <div id="tm-duration-options-list">
                                ${renderDurationOptionsList()}
                            </div>
                            <button class="tm-btn tm-btn-primary" data-tm-action="addDurationOption" style="margin-top: 8px; font-size: 12px;">${__tmT("settings.addDurationPreset")}</button>
                        </div>
                        <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--tm-border-color);opacity:${SettingsStore.data.enableTomatoIntegration ? 1 : 0.6};">
                            <div style="font-size:13px;font-weight:600;margin-bottom:6px;">${__tmT("settings.durationPomodoroAttributes")}</div>
                            <div style="font-size:12px;color:var(--tm-secondary-text);margin-bottom:10px;">${__tmT("settings.usedByTheDurationPomodoroDialogTheFocusColumn")}</div>
                            ${renderSingleFieldSetting(
                                __tmT("settings.actualPomodoroCountAttribute"),
                                __tmT("settings.oneCompletedPomodoroInDockTomatoCountsAsE"),
                                `<input class="b3-text-field" type="text" value="${esc(String(SettingsStore.data.tomatoCountAttrKey || 'custom-tomato-count'))}" ${SettingsStore.data.enableTomatoIntegration ? '' : 'disabled'} onchange="updateTomatoCountAttrKey(this.value)" style="width:100%;">`,
                                { style: 'margin-bottom:10px;' }
                            )}
                            ${renderSingleFieldSetting(
                                __tmT("settings.estimatedPomodoroCountAttribute"),
                                __tmT("settings.usedToFillInTheEstimatedPomodoroCountFor"),
                                `<input class="b3-text-field" type="text" value="${esc(String(SettingsStore.data.tomatoEstimateAttrKey || 'custom-tomato-estimate-count'))}" ${SettingsStore.data.enableTomatoIntegration ? '' : 'disabled'} onchange="updateTomatoEstimateAttrKey(this.value)" style="width:100%;">`
                            )}
                        </div>
                    </div>

                    ${settingsSearchCurrentSection = 'search', ''}
                    <div class="tm-settings-panel" data-tm-settings-section="search">
                        <div class="tm-settings-section-title">${__tmT("settings.searchGrouping2")}</div>
                        <div class="tm-settings-section-desc">${__tmT("settings.taskRetrievalIsOptimizedAutomaticallyByTheLocalIndex")}</div>
                        ${renderSingleFieldSetting(
                            __tmT("settings.recursiveDocumentLimit"),
                            __tmT("settings.limitsTheNumberOfDocumentsExpandedPerNotebookOr"),
                            `<input class="b3-text-field" type="number" value="${state.recursiveDocLimit}" onchange="updateRecursiveDocLimit(this.value)" style="width:96px;">
                             <span class="tm-setting-field-unit">${__tmT("settings.documents")}</span>`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.legacyWin7SiyuanCompatibility"),
                            __tmT("settings.offByDefaultEnableItOnlyOnLegacyKernels"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.legacyWin7CompatMode ? 'checked' : ''} onchange="updateLegacyWin7CompatMode(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            __tmT("settings.parentLookupDepth"),
                            __tmT("settings.affectsOnlyParentChildTaskRecognitionNotHowMany"),
                            `<input class="b3-text-field" type="number" min="0" max="${TM_TASK_PARENT_LOOKUP_DEPTH_MAX}" value="${__tmNormalizeTaskParentLookupDepth(SettingsStore.data.taskParentLookupDepth)}" onchange="updateTaskParentLookupDepth(this.value)" style="width:96px;">
                             <span class="tm-setting-field-unit">${__tmT("settings.levels")}</span>`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            ...__tmSettingsQueryText('showCompletedTasks'),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${__tmGetShowCompletedTasksFromSettings(SettingsStore.data) ? 'checked' : ''} onchange="updateShowCompletedTasks(this.checked)">`
                        )}
                        <div style="font-size: 12px; color: var(--tm-secondary-text); margin-top: 6px; margin-bottom: 12px;">${__tmT("settings.onByDefaultSoCompletedTasksDoNotVanish")}<br>${__tmT("settings.whenARuleSetsCompletionStatusToAllStatuses")}</div>
                        ${renderSingleSwitchSetting(
                            ...__tmSettingsQueryText('completedTasksTodayOnly'),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.completedTasksTodayOnly ? 'checked' : ''} onchange="updateCompletedTasksTodayOnly(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            ...__tmSettingsQueryText('completedTasksInlineInGroups'),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.completedTasksInlineInGroups ? 'checked' : ''} onchange="updateCompletedTasksInlineInGroups(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            __tmT("settings.completedTaskGrouping"),
                            __tmT("settings.usedForCompletedTaskGroupingAndTheKanbanS"),
                            `<select class="b3-select" onchange="updateCompletedTasksGroupBy(this.value)">
                                <option value="date" ${__tmNormalizeCompletedTasksGroupBy(SettingsStore.data.completedTasksGroupBy) === 'date' ? 'selected' : ''}>${__tmT("calendar.byDate")}</option>
                                <option value="title" ${__tmNormalizeCompletedTasksGroupBy(SettingsStore.data.completedTasksGroupBy) === 'title' ? 'selected' : ''}>${__tmT("settings.byDocumentHeading")}</option>
                            </select>`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.subGroupByTaskHeadingLevelUnderDocumentGroups"),
                            __tmT("settings.subGroupsByTheTaskHeadingLevelSettingH1"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.docH2SubgroupEnabled !== false ? 'checked' : ''} onchange="updateDocH2SubgroupEnabled(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.alwaysShowHeadingGroupsThatContainTasks"),
                            __tmT("settings.whenEnabledAndGroupingByDocumentAHeadingGroup"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.alwaysShowTaskDocHeadingGroups ? 'checked' : ''} ${SettingsStore.data.docH2SubgroupEnabled !== false ? '' : 'disabled'} onchange="updateAlwaysShowTaskDocHeadingGroups(this.checked)">`,
                            { style: `margin-bottom:10px;opacity:${SettingsStore.data.docH2SubgroupEnabled !== false ? 1 : 0.6};` }
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.addGroupByTaskNameToGroupingModes"),
                            __tmT("settings.whenEnabledAByTaskNameOptionAppearsIn"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.groupByTaskName || SettingsStore.data.groupMode === 'task' ? 'checked' : ''} onchange="updateGroupByTaskName(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.keepPinnedTasksInsideGroups"),
                            __tmT("settings.whenEnabledPinnedTasksStayInsideTheirGroupAnd"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.pinTasksWithinGroups ? 'checked' : ''} onchange="updatePinTasksWithinGroups(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.autoDetectDatesInTaskNames"),
                            __tmT("settings.whenEnabledAfterCreatingOrRenamingATaskAnd"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.semanticDateAutoPromptEnabled ? 'checked' : ''} onchange="updateSemanticDateAutoPromptEnabled(this.checked)">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleFieldSetting(
                            __tmT("settings.defaultReminderTimeForSemanticDueDates"),
                            __tmT("settings.whenADateOnlyDueExpressionLikeDueJuly"),
                            `<input type="time" value="${esc(String(SettingsStore.data.semanticDateDefaultReminderTime || '08:00'))}" onchange="updateSemanticDateDefaultReminderTime(this.value)" style="width:128px;padding:6px 8px;border:1px solid var(--tm-border-color);border-radius:6px;background:var(--tm-bg-color);color:var(--tm-text-color);">`,
                            { style: 'margin-bottom:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.parentTasksUseSubtaskDatesInTimeRelatedSorting"),
                            __tmT("settings.whenGroupingByTimeOrQuadrantOrSortingBy"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.groupSortByBestSubtaskTimeInTimeQuadrant ? 'checked' : ''} onchange="updateGroupSortByBestSubtaskTimeInTimeQuadrant(this.checked)">`
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.collapseExpandAllIncludesGroups"),
                            __tmT("settings.whenEnabledCollapseAllExpandAllInTheTop"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.collapseAllIncludesGroups ? 'checked' : ''} onchange="updateCollapseAllIncludesGroups(this.checked)">`,
                            { style: 'margin-top:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.syncServerSharedSettingsOnManualRefresh"),
                            __tmT("settings.offByDefaultWhenEnabledClickingTheTopRefresh"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.serverSyncOnManualRefresh ? 'checked' : ''} onchange="updateServerSyncOnManualRefresh(this.checked)">`,
                            { style: 'margin-top:10px;' }
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.syncSessionStateGroupRuleOnManualRefresh"),
                            __tmT("settings.offByDefaultOnlyAppliesWhileTheToggleAbove"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.serverSyncSessionStateOnManualRefresh ? 'checked' : ''} ${SettingsStore.data.serverSyncOnManualRefresh ? '' : 'disabled'} onchange="updateServerSyncSessionStateOnManualRefresh(this.checked)">`,
                            { style: `margin-top:10px;opacity:${SettingsStore.data.serverSyncOnManualRefresh ? 1 : 0.6};` }
                        )}
                    </div>

                    ${settingsSearchCurrentSection = 'shortcuts', ''}
                    <div class="tm-settings-panel" data-tm-settings-section="shortcuts">
                        <div class="tm-settings-section-title">${__tmT("settings.shortcutSidebar")}</div>
                        ${renderSingleSwitchSetting(
                            __tmT("settings.shortcutSidebar"),
                            __tmT("settings.showsTheShortcutSidebarAndTheSideExpandButton"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.shortcutSidebarEnabled !== false ? 'checked' : ''} onchange="updateShortcutSidebarEnabled(this.checked)">`
                        )}
                    </div>

                        ${settingsSearchCurrentSection = 'topbar', ''}
                    <div class="tm-settings-panel" data-tm-settings-section="topbar">
                        <div class="tm-settings-section-title">${__tmT("settings.topBarEntry")}</div>
                        <div class="tm-settings-section-desc">${__tmT("settings.controlsTheDocumentTopBarButtonTheSiyuanWindow")}</div>
                        ${renderSingleSwitchSetting(
                            __tmT("settings.mobileTaskSidebar"),
                            __tmT("settings.registersTheTaskManagerInTheSiyuanMobileSidebar"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.mobileSidebarEnabled === true ? 'checked' : ''} onchange="updateMobileSidebarEnabled(this.checked)">`
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.siyuanWindowTopBarIconDesktop"),
                            __tmT("settings.controlsTheTaskManagerEntryInTheDesktopSiyuan"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.windowTopbarIconDesktop !== false ? 'checked' : ''} onchange="updateWindowTopbarIconDesktop(this.checked)">`
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.siyuanWindowTopBarIconMobile"),
                            __tmT("settings.controlsTheTaskManagerEntryInTheMobileSiyuan"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.windowTopbarIconMobile !== false ? 'checked' : ''} onchange="updateWindowTopbarIconMobile(this.checked)">`
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.documentTopBarButtonDesktop"),
                            __tmT("settings.controlsTheTaskManagerButtonInTheDesktopDocument"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.docTopbarButtonDesktop !== false ? 'checked' : ''} onchange="updateDocTopbarButtonDesktop(this.checked)">`
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.documentTopBarButtonMobile"),
                            __tmT("settings.controlsTheTaskManagerButtonInTheMobileDocument"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.docTopbarButtonMobile !== false ? 'checked' : ''} onchange="updateDocTopbarButtonMobile(this.checked)">`
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.swapLongShortPressOnTheDocumentTopBar"),
                            __tmT("settings.whenEnabledTheDocumentTopBarPluginButtonBecomes"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.docTopbarButtonSwapPressActions ? 'checked' : ''} onchange="updateDocTopbarButtonSwapPressActions(this.checked)">`
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.locateTheCurrentDocumentOnOpen"),
                            __tmT("settings.whenEnabledOpeningTheTaskManagerFromTheDocument"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.docTopbarButtonLocateCurrentDocTab ? 'checked' : ''} onchange="updateDocTopbarButtonLocateCurrentDocTab(this.checked)">`
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.groupFocusBadgeInTheNoteSTopRight"),
                            __tmT("settings.whenEnabledNotesThatBelongToATaskManager"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.docTitleGroupFocusEnabled !== false ? 'checked' : ''} onchange="updateDocTitleGroupFocusEnabled(this.checked)">`
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.includeEmbeddedToDoFocusTime"),
                            __tmT("settings.whenEnabledToDosInTaskManagerScopeShown"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.docTitleEmbeddedTaskFocusEnabled ? 'checked' : ''} ${SettingsStore.data.enableTomatoIntegration ? '' : 'disabled'} onchange="updateDocTitleEmbeddedTaskFocusEnabled(this.checked)">`
                        )}
                    </div>

                    ${settingsSearchCurrentSection = 'quickbar', ''}
                    <div class="tm-settings-panel" data-tm-settings-section="quickbar">
                        <div class="tm-settings-section-title">${__tmT("settings.taskQuickbar")}</div>
                        <div class="tm-settings-section-desc">${__tmT("settings.controlsTheQuickbarOnTaskBlockClickAndThe")}</div>
                        ${renderSingleSwitchSetting(
                            __tmT("settings.enableTheTaskQuickbar"),
                            __tmT("settings.clickingATaskBlockShowsCustomFieldsWhenOff"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.enableQuickbar ? 'checked' : ''} onchange="updateEnableQuickbar(this.checked)">`
                        )}
                        ${renderSingleSwitchSetting(
                            __tmT("settings.persistentFieldsAtTheEndOfDocumentTaskRows"),
                            __tmT("settings.alwaysShowsTheSelectedFieldsAtTheEndOf"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.enableQuickbarInlineMeta ? 'checked' : ''} onchange="updateEnableQuickbarInlineMeta(this.checked)">`,
                            { style: 'margin-top:8px;' }
                        )}
                        <div style="margin-top:10px;opacity:${SettingsStore.data.enableQuickbar ? 1 : 0.6};">
                            ${renderSingleFieldSetting(
                                __tmT("settings.iconsShownInTheQuickbar"),
                                __tmT("settings.controlsWhichFieldAndActionIconsAppearInThe"),
                                renderSettingsChipSetting('', '', [
                                    __tmBuildSettingsChipGroup(__tmT("settings.field"), [
                                        { key: 'custom-status', label: __tmT("kernel.status") },
                                        { key: 'custom-priority', label: __tmT("kernel.importance") },
                                        { key: 'custom-start-date', label: __tmT("kernel.startDate") },
                                        { key: 'custom-completion-time', label: __tmT("kernel.dueDate") },
                                        { key: 'taskCompleteAt', label: __tmT("kernel.completionTime") },
                                        { key: 'custom-focus-summary', label: __tmT("quickbar.focusTimeSpent") },
                                        { key: 'custom-remark', label: __tmT("kernel.note") },
                                        ...__tmBuildSettingsCustomFieldChipItems(),
                                    ], {
                                        selectedSet: new Set((SettingsStore.data.quickbarVisibleItems || []).map((value) => String(value || '').trim()).filter(Boolean)),
                                        disabled: !SettingsStore.data.enableQuickbar,
                                        onToggle: (item) => `updateQuickbarVisibleItem('${escSq(String(item?.key || '').trim())}', this.checked)`
                                    }),
                                    __tmBuildSettingsChipGroup(__tmT("settings.actions"), [
                                        { key: 'action-ai-title', label: __tmT("settings.aiOptimize") },
                                        { key: 'action-reminder', label: __tmT("ai.warnings") },
                                        { key: 'action-more', label: __tmT("quickbar.more") }
                                    ], {
                                        selectedSet: new Set((SettingsStore.data.quickbarVisibleItems || []).map((value) => String(value || '').trim()).filter(Boolean)),
                                        disabled: !SettingsStore.data.enableQuickbar,
                                        onToggle: (item) => `updateQuickbarVisibleItem('${escSq(String(item?.key || '').trim())}', this.checked)`
                                    })
                                ], { preview: 'quickbar' }),
                                { style: 'margin-top:8px;margin-bottom:10px;' }
                            )}
                        </div>
                        <div style="margin-top:10px;opacity:${SettingsStore.data.enableQuickbarInlineMeta ? 1 : 0.6};">
                            ${renderSingleFieldSetting(
                                __tmT("settings.persistentDisplayFields"),
                                __tmT("settings.showsStatusAndDueDateByDefaultRemainingTime"),
                                renderSettingsChipSetting('', '', [
                                    __tmBuildSettingsChipGroup(__tmT("settings.field"), [
                                        { key: 'subtask-count', label: __tmT("settings.subtaskCount") },
                                        { key: 'custom-status', label: __tmT("kernel.status") },
                                        { key: 'custom-priority', label: __tmT("kernel.importance") },
                                        { key: 'custom-start-date', label: __tmT("kernel.startDate") },
                                        { key: 'custom-completion-time', label: __tmT("kernel.dueDate") },
                                        { key: 'remainingTime', label: __tmT("task.remainingTime") },
                                        { key: 'taskCompleteAt', label: __tmT("kernel.completionTime") },
                                        { key: 'custom-focus-summary', label: __tmT("quickbar.focusTimeSpent") },
                                        { key: 'custom-remark', label: __tmT("kernel.note") },
                                        ...__tmBuildSettingsCustomFieldChipItems()
                                    ], {
                                        selectedSet: new Set((SettingsStore.data.quickbarInlineFields || []).map((value) => String(value || '').trim()).filter(Boolean)),
                                        disabled: !SettingsStore.data.enableQuickbarInlineMeta,
                                        onToggle: (item) => `updateQuickbarInlineField('${escSq(String(item?.key || '').trim())}', this.checked)`
                                    })
                                ], { preview: 'quickbar-inline' }),
                                { style: 'margin-bottom:10px;' }
                            )}
                            ${renderSingleSwitchSetting(
                                __tmT("settings.subtaskCountShowsUnfinished"),
                                __tmT("settings.whenOnThePersistentSubtaskCountLabelShowsThe"),
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.quickbarSubtaskCountUnfinishedOnly ? 'checked' : ''} ${SettingsStore.data.enableQuickbarInlineMeta ? '' : 'disabled'} onchange="updateQuickbarSubtaskCountUnfinishedOnly(this.checked)">`
                            )}
                            ${renderSingleSwitchSetting(
                                __tmT("settings.enablePersistentDisplayOnMobile"),
                                __tmT("settings.mobileScreensAreNarrowWhenOffOnlyTheOriginal"),
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.quickbarInlineShowOnMobile ? 'checked' : ''} ${SettingsStore.data.enableQuickbarInlineMeta ? '' : 'disabled'} onchange="updateQuickbarInlineShowOnMobile(this.checked)">`
                            )}
                        </div>
                    </div>

                    ${settingsSearchCurrentSection = 'tomato', ''}
                    <div class="tm-settings-panel" data-tm-settings-section="tomato">
                        <div class="tm-settings-section-title">${__tmT("settings.pomodoroPluginIntegrations")}</div>
                        <div class="tm-settings-section-desc">${__tmT("settings.manageTheBottomBarPomodoroTaskTimeSpentAttributes")}</div>
                        ${renderSingleSwitchSetting(
                            __tmT("settings.enableBottomBarPomodoroFeatures"),
                            __tmT("settings.includesTimingRemindersAndTheTimeSpentColumn"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.enableTomatoIntegration ? 'checked' : ''} onchange="updateEnableTomatoIntegration(this.checked)">`
                        )}
                        <div style="margin-top:10px;opacity:${SettingsStore.data.enableTomatoIntegration ? 1 : 0.6};">
                            ${renderSingleSwitchSetting(
                                __tmT("settings.estimateActualPomodorosFromFocusTime"),
                                __tmT("settings.computesTotalFocusTimeDividedByTheDockTomato"),
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.tomatoActualCountBySpentEnabled !== false ? 'checked' : ''} ${SettingsStore.data.enableTomatoIntegration ? '' : 'disabled'} onchange="updateTomatoActualCountBySpentEnabled(this.checked)">`
                            )}
                            ${renderSingleFieldSetting(
                                __tmT("settings.timeSpentReadMode"),
                                __tmT("settings.chooseWhetherTaskTimeSpentIsReadFromThe"),
                                `<select class="b3-select" onchange="updateTomatoSpentAttrMode(this.value)" ${SettingsStore.data.enableTomatoIntegration ? '' : 'disabled'} style="width:180px;">
                                    <option value="minutes" ${String(SettingsStore.data.tomatoSpentAttrMode || 'minutes') === 'minutes' ? 'selected' : ''}>${__tmT("settings.minuteAttribute")}</option>
                                    <option value="hours" ${String(SettingsStore.data.tomatoSpentAttrMode || '') === 'hours' ? 'selected' : ''}>${__tmT("settings.hourAttribute")}</option>
                                </select>`,
                                { style: 'margin-bottom:10px;' }
                            )}
                            ${renderSingleFieldSetting(
                                __tmT("settings.minuteAttributeName"),
                                __tmT("settings.aSiyuanBlockAttributeNameEGCustomTomato"),
                                `<input class="b3-text-field" type="text" value="${esc(String(SettingsStore.data.tomatoSpentAttrKeyMinutes || 'custom-tomato-minutes'))}" ${SettingsStore.data.enableTomatoIntegration ? '' : 'disabled'} onchange="updateTomatoSpentAttrKeyMinutes(this.value)" style="width:100%;">`,
                                { style: 'margin-bottom:10px;' }
                            )}
                            ${renderSingleFieldSetting(
                                __tmT("settings.hourAttributeName"),
                                __tmT("settings.aSiyuanBlockAttributeNameEGCustomTomato2"),
                                `<input class="b3-text-field" type="text" value="${esc(String(SettingsStore.data.tomatoSpentAttrKeyHours || 'custom-tomato-time'))}" ${SettingsStore.data.enableTomatoIntegration ? '' : 'disabled'} onchange="updateTomatoSpentAttrKeyHours(this.value)" style="width:100%;">`,
                                { style: 'margin-bottom:10px;' }
                            )}
                        </div>
                        ${renderSingleSwitchSetting(
                            __tmT("settings.enableTheMortalSJourneyCheckInPluginIntegration"),
                            __tmT("settings.whenEnabledCompletingATaskSendsTheTaskId"),
                            `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.enablePointsRewardIntegration ? 'checked' : ''} onchange="updateEnablePointsRewardIntegration(this.checked)">`
                        )}
                        <div style="margin-top:10px;opacity:${SettingsStore.data.enablePointsRewardIntegration ? 1 : 0.6};">
                            ${renderSingleFieldSetting(
                                __tmT("settings.groupsExcludedFromTheIntegration"),
                                __tmT("settings.tasksInTheSelectedDocumentGroupsDoNotTrigger"),
                                (() => {
                                    const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
                                    const selected = new Set((Array.isArray(SettingsStore.data.pointsRewardExcludedGroupIds) ? SettingsStore.data.pointsRewardExcludedGroupIds : []).map((id) => String(id || '').trim()).filter(Boolean));
                                    if (!groups.length) return `<span class="tm-setting-field-unit">${__tmT("settings.noDocumentGroups")}</span>`;
                                    return renderSettingsChipSetting('', '', [
                                        __tmBuildSettingsChipGroup(__tmT("calendar.documentGroups"), groups.map((group) => {
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
                                __tmT("settings.enableOverdueTaskPenalties"),
                                __tmT("settings.checksUnfinishedTasksAtTheConfiguredTimesSupportsDue"),
                                `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.enablePointsPenaltyIntegration ? 'checked' : ''} ${SettingsStore.data.enablePointsRewardIntegration ? '' : 'disabled'} onchange="updateEnablePointsPenaltyIntegration(this.checked)">`
                            )}
                            <div style="margin-top:10px;opacity:${(SettingsStore.data.enablePointsRewardIntegration && SettingsStore.data.enablePointsPenaltyIntegration) ? 1 : 0.6};">
                                ${renderSingleFieldSetting(
                                    __tmT("settings.dueDateOverduePenalty"),
                                    __tmT("settings.triggersWhenTheDueDateHasPassedAndThe"),
                                    `<div style="display:flex;align-items:center;gap:8px;">
                                        <input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.pointsPenaltyDeadlineEnabled ? 'checked' : ''} ${(SettingsStore.data.enablePointsRewardIntegration && SettingsStore.data.enablePointsPenaltyIntegration) ? '' : 'disabled'} onchange="updatePointsPenaltyDeadlineEnabled(this.checked)">
                                        <input class="b3-text-field" type="number" min="0" max="9999" value="${Math.max(0, Math.min(9999, Math.round(Number(SettingsStore.data.pointsPenaltyDeadlineAmount) || 0)))}" ${(SettingsStore.data.enablePointsRewardIntegration && SettingsStore.data.enablePointsPenaltyIntegration && SettingsStore.data.pointsPenaltyDeadlineEnabled) ? '' : 'disabled'} onchange="updatePointsPenaltyDeadlineAmount(this.value)" style="width:88px;">
                                        <span class="tm-setting-field-unit">${__tmT("settings.ptsEach")}</span>
                                    </div>`,
                                    { style: 'margin-bottom:10px;' }
                                )}
                                ${renderSingleFieldSetting(
                                    __tmT("settings.scheduleOverduePenalty"),
                                    __tmT("settings.whenATaskHasMultipleSchedulesOnTheSame"),
                                    `<div style="display:flex;align-items:center;gap:8px;">
                                        <input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.pointsPenaltyScheduleEnabled ? 'checked' : ''} ${(SettingsStore.data.enablePointsRewardIntegration && SettingsStore.data.enablePointsPenaltyIntegration) ? '' : 'disabled'} onchange="updatePointsPenaltyScheduleEnabled(this.checked)">
                                        <input class="b3-text-field" type="number" min="0" max="9999" value="${Math.max(0, Math.min(9999, Math.round(Number(SettingsStore.data.pointsPenaltyScheduleAmount) || 0)))}" ${(SettingsStore.data.enablePointsRewardIntegration && SettingsStore.data.enablePointsPenaltyIntegration && SettingsStore.data.pointsPenaltyScheduleEnabled) ? '' : 'disabled'} onchange="updatePointsPenaltyScheduleAmount(this.value)" style="width:88px;">
                                        <span class="tm-setting-field-unit">${__tmT("settings.ptsEach")}</span>
                                    </div>`,
                                    { style: 'margin-bottom:10px;' }
                                )}
                                ${renderSingleFieldSetting(
                                    __tmT("settings.checkTimes"),
                                    __tmT("settings.oneTimePerLineSupportsHhMmSameDay"),
                                    `<textarea class="b3-text-field" ${(SettingsStore.data.enablePointsRewardIntegration && SettingsStore.data.enablePointsPenaltyIntegration) ? '' : 'disabled'} onchange="updatePointsPenaltyCheckTimes(this.value)" style="width:220px;min-height:72px;resize:vertical;">${esc((Array.isArray(SettingsStore.data.pointsPenaltyCheckTimes) && SettingsStore.data.pointsPenaltyCheckTimes.length ? SettingsStore.data.pointsPenaltyCheckTimes : ['23:00', '+1 08:00']).map(v => String(v || '').trim()).filter(Boolean).join('\n'))}</textarea>`,
                                    { style: 'margin-bottom:10px;' }
                                )}
                                ${renderSingleSwitchSetting(
                                    __tmT("settings.confirmPenaltiesWithADialog"),
                                    __tmT("settings.whenEnabledADialogAsksForConfirmationFirstWhere"),
                                    `<input class="b3-switch fn__flex-center" type="checkbox" ${SettingsStore.data.pointsPenaltyConfirmModalEnabled !== false ? 'checked' : ''} ${(SettingsStore.data.enablePointsRewardIntegration && SettingsStore.data.enablePointsPenaltyIntegration) ? '' : 'disabled'} onchange="updatePointsPenaltyConfirmModalEnabled(this.checked)">`
                                )}
                            </div>
                        </div>
                    </div>

                    ` : ''}

                    ${activeTab === 'docs' ? `
                    <div class="tm-settings-panel" data-tm-settings-section="import" style="margin-bottom: 16px;" ${__tmSettingsSearchAttrs('docs', __tmT("settings.dataImport"), __tmT("settings.importTicktickCsvCreatesDocumentsHeadingsAndTaskBlocks"))}>
                        <div class="tm-settings-section-title">${__tmT("settings.dataImport2")}</div>
                        <div class="tm-settings-section-desc">${__tmT("settings.supportsImportingCsvExportedFromTicktickAndAutomaticallyCreating")}</div>
                        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
                            <button class="tm-btn tm-btn-primary" onclick="tmOpenTickTickImportDialog()" style="padding:6px 12px;font-size:12px;">${__tmT("settings.importTicktickCsv")}</button>
                            <div style="font-size:12px;color:var(--tm-secondary-text);line-height:1.6;">${__tmT("settings.importsStatusTasksOnDemandStatusCompletedAndStatus")}</div>
                        </div>
                    </div>

                    ${renderDocumentGroupManager()}

                    <div class="tm-setting-field-row" ${__tmSettingsSearchAttrs('docs', __tmT("settings.customTabGroups"), __tmT("settings.manageTabGroupsInASeparateDialogCheckDocument"))}>
                        <div class="tm-setting-field-copy">
                            <div class="tm-setting-field-title">${__tmT("task.tabGroups")}</div>
                            <div class="tm-setting-field-desc">${__tmT("settings.rightClickATabToAddItQuicklyFull")}</div>
                        </div>
                        <div class="tm-setting-field-control">
                            <button class="tm-btn tm-btn-secondary" onclick="tmOpenDocTabCustomGroupSettings()">${__tmT("task.manageTabGroups2")}</button>
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
        try { __tmBindSettingsFieldPreviewRefresh(state.settingsModal); } catch (e) {}
        // 搜索索引改为异步分片构建：每次设置项变更都会触发整窗重渲染，若同步为每个页签
        // 各渲染一遍 probe 会造成明显卡顿。这里按页签分片、让出主线程，保持交互流畅；
        // 构建期间搜索结果沿用 __tmSettingsSearchIndexBuilding 语义暂时为空，完成后自动刷新。
        {
            const buildGen = ++__tmSettingsSearchIndexBuildGen;
            if (__tmSettingsSearchIndexBuildTimer) {
                clearTimeout(__tmSettingsSearchIndexBuildTimer);
                __tmSettingsSearchIndexBuildTimer = 0;
            }
            const buildTabs = TM_SETTINGS_SEARCH_INDEX_TABS.filter((tab) => tab !== 'calendar');
            const capturedEntries = [];
            const renderedActiveTab = activeTab;
            const renderedSection = settingsSearchCurrentSection;
            let buildIndex = 0;
            const finalizeBuild = () => {
                try {
                    const calendarRenderer = globalThis.__tmCalendar?.renderSettings;
                    if (typeof calendarRenderer === 'function') {
                        const calendarProbe = document.createElement('div');
                        calendarRenderer(calendarProbe, SettingsStore, { indexOnly: true });
                        __tmDecorateCalendarSettingsSearchRows(calendarProbe);
                        __tmCollectRenderedSettingsSearchEntries(calendarProbe, 'calendar').forEach((entry) => capturedEntries.push(entry));
                    }
                } catch (e) {}
                const generatedMap = new Map();
                capturedEntries.forEach((raw) => {
                    const entry = raw?.haystack ? raw : __tmCreateSettingsSearchEntry(raw);
                    if (!entry) return;
                    generatedMap.set(`${entry.tab}:${entry.key}`, entry);
                });
                state.settingsSearchGeneratedEntries = Array.from(generatedMap.values());
            };
            const runChunk = () => {
                __tmSettingsSearchIndexBuildTimer = 0;
                if (buildGen !== __tmSettingsSearchIndexBuildGen) return;
                if (!state.settingsModal || !document.body.contains(state.settingsModal)) {
                    __tmSettingsSearchIndexBuilding = false;
                    return;
                }
                __tmSettingsSearchIndexBuilding = true;
                __tmSettingsSearchCaptureBuffer = null;
                try {
                    const tab = buildTabs[buildIndex];
                    activeTab = tab;
                    settingsSearchCurrentSection = '';
                    const probe = document.createElement('div');
                    probe.innerHTML = renderSettingsModalMarkup();
                    __tmCollectRenderedSettingsSearchEntries(probe, tab).forEach((entry) => capturedEntries.push(entry));
                } catch (e) {
                    try { console.warn('[Task Horizon] settings search index build failed', e); } catch (e2) {}
                } finally {
                    activeTab = renderedActiveTab;
                    settingsSearchCurrentSection = renderedSection;
                    __tmSettingsSearchCaptureBuffer = null;
                }
                buildIndex += 1;
                if (buildIndex < buildTabs.length) {
                    __tmSettingsSearchIndexBuildTimer = setTimeout(runChunk, 0);
                    return;
                }
                finalizeBuild();
                __tmSettingsSearchIndexBuilding = false;
                try { __tmRefreshSettingsSearchResults(state.settingsModal); } catch (e) {}
            };
            __tmSettingsSearchIndexBuilding = true;
            __tmSettingsSearchIndexBuildTimer = setTimeout(runChunk, 0);
        }
        const sourceTab = activeTab;
        __tmBuildSettingsV2(state.settingsModal, (tab) => {
            activeTab = tab;
            settingsSearchCurrentSection = '';
            try { return renderSettingsModalMarkup(); }
            finally { activeTab = sourceTab; }
        });
        document.body.appendChild(state.settingsModal);
        __tmSyncSettingsV2Nav(state.settingsModal);
        __tmRestoreSettingsFocus(state.settingsModal, settingsFocus);
        if (shouldAnimateOpen) {
            try {
                __tmApplyPopupOpenAnimation(state.settingsModal, state.settingsModal.querySelector('.tm-settings-box'), {
                    mode: window.matchMedia?.('(max-width: 900px)')?.matches ? 'sheet' : 'center'
                });
            } catch (e) {}
        }
        state.__settingsUnstack = __tmModalStackBind(() => window.closeSettings?.());
        if (state.settingsV3SearchOpen) __tmToggleSettingsV3Search(state.settingsModal, true);
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
                    try { __tmSyncSettingsV2Nav(state.settingsModal); } catch (e3) {}
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
                        try { __tmSyncSettingsV2Nav(state.settingsModal); } catch (e3) {}
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
            __tmEnsureCalendarSettingsForModal(state.settingsModal);
        } catch (e) {}
    }
    window.showSettings = showSettings;
