    window.clearCurrentGroupDocs = async function() {
        if (!confirm('确定要清空当前分组的所有文档吗？')) return;

        const currentId = SettingsStore.data.currentGroupId;
        if (currentId === 'all') return;

        const groups = SettingsStore.data.docGroups || [];
        const group = groups.find(g => g.id === currentId);
        if (group) {
            group.docs = [];
            group.excludedDocIds = [];
            delete group.notebookId;
            await SettingsStore.updateDocGroups(groups);
            showSettings();
        }
    };

    // 新增：从分组移除文档
    window.removeDocFromGroup = async function(index) {
        const currentId = SettingsStore.data.currentGroupId;
        if (currentId === 'all') return;

        const groups = SettingsStore.data.docGroups || [];
        const group = groups.find(g => g.id === currentId);
        if (group && group.docs) {
            const removed = group.docs.splice(index, 1)[0];
            const removedDocId = String((typeof removed === 'object' ? removed?.id : removed) || '').trim();
            if (removedDocId) {
                group.excludedDocIds = __tmGetGroupExcludedDocIds(group).filter((id) => id !== removedDocId);
            }
            await SettingsStore.updateDocGroups(groups);
            showSettings();
        }
    };

    window.removeExcludedDocFromCurrentGroup = async function(docId) {
        const currentId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        const result = await __tmSetDocExcludedForGroup(docId, false, currentId);
        if (!result?.changed) {
            hint('⚠ 该文档不在排除列表中', 'warning');
            return;
        }
        hint('✅ 已从排除列表移出，文档会重新显示', 'success');
    };

    window.removeDocFromAll = async function(docId) {
        const id = String(docId || '').trim();
        if (!id) return;

        let changed = false;

        try {
            const legacy = Array.isArray(SettingsStore.data.selectedDocIds) ? SettingsStore.data.selectedDocIds : [];
            const nextLegacy = legacy.filter(x => String(x) !== id);
            if (nextLegacy.length !== legacy.length) {
                SettingsStore.data.selectedDocIds = nextLegacy;
                changed = true;
            }
        } catch (e) {}

        try {
            const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
            let groupsChanged = false;
            groups.forEach(g => {
                if (!g || !Array.isArray(g.docs)) return;
                const before = g.docs.length;
                g.docs = g.docs.filter(d => String((typeof d === 'object' ? d?.id : d) || '') !== id);
                const excludedBefore = __tmGetGroupExcludedDocIds(g);
                g.excludedDocIds = excludedBefore.filter((item) => item !== id);
                if (g.excludedDocIds.length !== excludedBefore.length) groupsChanged = true;
                if (g.docs.length !== before) groupsChanged = true;
            });
            if (groupsChanged) {
                SettingsStore.data.docGroups = groups;
                changed = true;
            }
        } catch (e) {}

        try {
            const excludedAll = __tmGetAllDocsExcludedDocIds();
            const nextExcludedAll = excludedAll.filter((item) => item !== id);
            if (nextExcludedAll.length !== excludedAll.length) {
                SettingsStore.data.allDocsExcludedDocIds = nextExcludedAll;
                changed = true;
            }
        } catch (e) {}

        try {
            const pinMap = (SettingsStore.data.docPinnedByGroup && typeof SettingsStore.data.docPinnedByGroup === 'object')
                ? SettingsStore.data.docPinnedByGroup
                : {};
            let pinChanged = false;
            Object.keys(pinMap).forEach((gid) => {
                const arr = Array.isArray(pinMap[gid]) ? pinMap[gid] : [];
                const next = arr.map(x => String(x || '').trim()).filter(Boolean).filter(x => x !== id);
                if (next.length !== arr.length) {
                    pinMap[gid] = next;
                    pinChanged = true;
                }
            });
            if (pinChanged) {
                SettingsStore.data.docPinnedByGroup = pinMap;
                changed = true;
            }
        } catch (e) {}

        try {
            if (String(SettingsStore.data.defaultDocId || '').trim() === id) {
                SettingsStore.data.defaultDocId = '';
                changed = true;
            }
        } catch (e) {}

        if (!changed) {
            hint('⚠ 未找到该文档', 'warning');
            return;
        }

        await SettingsStore.save();
        state.selectedDocIds = SettingsStore.data.selectedDocIds;
        showSettings();
    };

    // 手动添加文档ID（增强版）
    window.addManualDoc = async function() {
        const input = document.getElementById('manualDocId');
        const recursiveCheck = document.getElementById('recursiveCheck');
        const docId = input.value.trim();
        const isRecursive = recursiveCheck ? recursiveCheck.checked : false;

        if (!docId) {
            hint('⚠ 请输入文档ID', 'warning');
            return;
        }

        // 验证ID格式（思源笔记ID格式：数字-字母数字组合）
        if (!/^[0-9]+-[a-zA-Z0-9]+$/.test(docId)) {
            hint('⚠ 文档ID格式不正确，格式应为：数字-字母数字组合', 'warning');
            return;
        }

        const currentGroupId = SettingsStore.data.currentGroupId || 'all';

        if (currentGroupId === 'all') {
            // 添加到旧版列表（不支持递归标志，或者我们需要升级旧版列表结构）
            // 为了兼容，我们在 "全部" 模式下只操作 selectedDocIds
            if (isRecursive) {
                hint('⚠ "全部文档"模式下不支持递归选项，请先创建或选择一个分组', 'warning');
                return;
            }
            if (SettingsStore.data.selectedDocIds.includes(docId)) {
                hint('⚠ 该文档已被添加', 'warning');
                return;
            }
            await SettingsStore.addDocId(docId);
        } else {
            // 添加到当前分组
            const groups = SettingsStore.data.docGroups || [];
            const group = groups.find(g => g.id === currentGroupId);
            if (group) {
                if (!group.docs) group.docs = [];
                // 检查重复
                if (group.docs.some(d => d.id === docId)) {
                    hint('⚠ 该文档已在当前分组中', 'warning');
                    return;
                }
                group.docs.push({ id: docId, recursive: isRecursive });
                await SettingsStore.updateDocGroups(groups);
            }
        }

        // 尝试获取文档名称
        fetchDocMeta(docId).then((docMeta) => {
            if (docMeta?.name) {
                state.allDocuments.push({ id: docId, name: docMeta.name, alias: '', icon: __tmNormalizeDocIconValue(docMeta.icon), path: '', taskCount: 0 });
            }
            showSettings(); // 重新渲染设置界面
        });

        input.value = '';
        if (recursiveCheck) recursiveCheck.checked = false;
        hint('✅ 已添加文档', 'success');
    };

    async function __tmAddDocsToGroup(docIdsInput, groupId, options = {}) {
        const docIds = __tmNormalizeDocIdsForGroupInput(docIdsInput);
        const targetGroupId = String(groupId || '').trim();
        if (!docIds.length) {
            hint('⚠ 未找到可添加的文档', 'warning');
            return { added: 0, existed: 0, group: null };
        }
        if (!targetGroupId) {
            hint('⚠ 请选择目标分组', 'warning');
            return { added: 0, existed: 0, group: null };
        }

        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        const group = groups.find((item) => String(item?.id || '').trim() === targetGroupId);
        if (!group) {
            hint('⚠ 目标分组不存在', 'warning');
            return { added: 0, existed: 0, group: null };
        }

        if (!Array.isArray(group.docs)) group.docs = [];
        let added = 0;
        let existed = 0;
        docIds.forEach((docId) => {
            const exists = group.docs.some((item) => String((typeof item === 'object' ? item?.id : item) || '').trim() === docId);
            if (exists) {
                existed += 1;
                return;
            }
            group.docs.push({ id: docId, recursive: false });
            added += 1;
        });

        if (!added) {
            const groupName = __tmResolveDocGroupName(group);
            hint(docIds.length > 1 ? `⚠ 所选文档已都在分组“${groupName}”中` : `⚠ 该文档已在分组“${groupName}”中`, 'warning');
            return { added: 0, existed, group };
        }

        await SettingsStore.updateDocGroups(groups);

        await Promise.allSettled(docIds.map(async (docId) => {
            const docMeta = await fetchDocMeta(docId);
            if (!docMeta?.name) return;
            if (!Array.isArray(state.allDocuments)) state.allDocuments = [];
            const exists = state.allDocuments.some((item) => String(item?.id || '').trim() === docId);
            if (!exists) state.allDocuments.push({ id: docId, name: docMeta.name, alias: '', icon: __tmNormalizeDocIconValue(docMeta.icon), path: '', taskCount: 0 });
        }));

        try {
            const currentGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
            if (currentGroupId === targetGroupId || currentGroupId === 'all' || options.forceRefresh) {
                await loadSelectedDocuments();
                render();
                if (state.settingsModal) showSettings();
            }
        } catch (e) {}

        return { added, existed, group };
    }

    window.tmOpenAddDocToGroupDialog = async function(docIdsInput, options = {}) {
        const docIds = __tmNormalizeDocIdsForGroupInput(docIdsInput);
        if (!docIds.length) {
            hint('⚠ 未找到当前文档', 'warning');
            return;
        }

        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        if (!groups.length) {
            hint('⚠ 请先在任务管理器中创建文档分组', 'warning');
            return;
        }

        const currentGroupId = String(SettingsStore.data.currentGroupId || '').trim();
        const defaultGroupId = groups.some((item) => String(item?.id || '').trim() === currentGroupId)
            ? currentGroupId
            : String(groups[0]?.id || '').trim();
        const selectOptions = groups.map((group) => ({
            value: String(group?.id || '').trim(),
            label: __tmResolveDocGroupName(group)
        })).filter((item) => item.value);
        if (!selectOptions.length) {
            hint('⚠ 当前没有可用的文档分组', 'warning');
            return;
        }

        let title = '添加到任务管理器分组';
        if (docIds.length > 1) {
            title = `添加 ${docIds.length} 个文档到任务管理器分组`;
        }

        const selectedGroupId = await showSelectPrompt(title, selectOptions, defaultGroupId);
        if (!selectedGroupId) return;

        const result = await __tmAddDocsToGroup(docIds, selectedGroupId, options);
        if (!result?.group || !result.added) return;

        const groupName = __tmResolveDocGroupName(result.group);
        if (result.existed > 0) {
            hint(`✅ 已添加 ${result.added} 个文档到“${groupName}”，${result.existed} 个已存在`, 'success');
            return;
        }
        hint(docIds.length > 1 ? `✅ 已将 ${result.added} 个文档添加到“${groupName}”` : `✅ 已添加到分组“${groupName}”`, 'success');
    };

    window.tmOpenAddOtherBlocksToGroupDialog = async function(blockIdsInput, options = {}) {
        const blockIds = __tmNormalizeOtherBlockRefs(Array.isArray(blockIdsInput) ? blockIdsInput : [blockIdsInput]).map((item) => item.id);
        if (!blockIds.length) {
            hint('⚠ 未找到当前块', 'warning');
            return;
        }

        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        if (!groups.length) {
            hint('⚠ 请先在任务管理器中创建文档分组', 'warning');
            return;
        }

        const currentGroupId = __tmResolveOtherBlockGroupId();
        const defaultGroupId = groups.some((item) => String(item?.id || '').trim() === currentGroupId)
            ? currentGroupId
            : String(groups[0]?.id || '').trim();
        const selectOptions = groups.map((group) => ({
            value: String(group?.id || '').trim(),
            label: __tmResolveDocGroupName(group)
        })).filter((item) => item.value);
        if (!selectOptions.length) {
            hint('⚠ 当前没有可用的文档分组', 'warning');
            return;
        }

        const title = blockIds.length > 1 ? `添加 ${blockIds.length} 个块到其他块页签` : '添加到其他块页签';
        const selectedGroupId = await showSelectPrompt(title, selectOptions, defaultGroupId);
        if (!selectedGroupId) return;

        const result = await __tmAddOtherBlocksToCollection(blockIds, selectedGroupId, options);
        if (!result?.group || !result.added) return;

        const groupName = __tmResolveDocGroupName(result.group);
        if (result.existed > 0) {
            hint(blockIds.length > 1
                ? `✅ 已添加 ${result.added} 个块到“${groupName}”，${result.existed} 个已存在`
                : `✅ 已添加到“${groupName}”，该分组中已有 ${result.existed} 个重复块`, 'success');
            return;
        }
        hint(blockIds.length > 1 ? `✅ 已将 ${result.added} 个块添加到“${groupName}”` : `✅ 已添加到“${groupName}”`, 'success');
    };

    window.tmAutoAddOtherBlocksToCurrentGroup = async function(blockIdsInput, options = {}) {
        const blockIds = __tmNormalizeOtherBlockRefs(Array.isArray(blockIdsInput) ? blockIdsInput : [blockIdsInput]).map((item) => item.id);
        if (!blockIds.length) return { added: 0, existed: 0, invalid: 0, group: null, reason: 'empty' };
        const targetGroupId = __tmResolveAutoOtherBlockTargetGroupId(options?.groupId);
        if (!targetGroupId) {
            return { added: 0, existed: 0, invalid: 0, group: null, reason: 'no-group' };
        }
        return await __tmAddOtherBlocksToCollection(blockIds, targetGroupId, {
            ...options,
            silent: options?.silent !== false,
            forceRefresh: options?.forceRefresh !== false,
        });
    };

    // 根据ID获取文档元数据
    async function fetchDocMeta(docId) {
        try {
            const sql = `SELECT content, hpath, ial FROM blocks WHERE id = '${docId}' AND type = 'd' LIMIT 1`;
            const res = await API.call('/api/query/sql', { stmt: sql });
            if (res.code === 0 && res.data && res.data.length > 0) {
                const row = res.data[0] || {};
                return {
                    name: row.content || '未命名文档',
                    icon: __tmNormalizeDocIconValue(__tmReadIalAttrValue(row.ial, 'icon'))
                };
            }
        } catch (e) {
        }
        return null;
    }

    // 根据索引移除文档
    window.removeDocByIndex = async function(index) {
        await SettingsStore.removeDocId(index);
        state.selectedDocIds = SettingsStore.data.selectedDocIds;
        showSettings(); // 重新渲染设置界面
    };

    // 清空所有文档
    window.clearAllDocs = async function() {
        if (!confirm('确定要清空所有已选文档吗？')) return;
        await SettingsStore.clearDocIds();
        state.selectedDocIds = SettingsStore.data.selectedDocIds;
        showSettings(); // 重新渲染设置界面
    };

    window.updateQueryLimit = async function(value) {
        state.queryLimit = parseInt(value) || 500;
        SettingsStore.data.queryLimit = state.queryLimit;
        await SettingsStore.save();
    };

    window.updateRecursiveDocLimit = async function(value) {
        state.recursiveDocLimit = parseInt(value) || 2000;
        SettingsStore.data.recursiveDocLimit = state.recursiveDocLimit;
        await SettingsStore.save();
    };

    window.updateCurrentGroupCalendarSearchOptimizationEnabled = async function(enabled) {
        const currentGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        if (currentGroupId === 'all') return;
        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        const group = groups.find((item) => String(item?.id || '').trim() === currentGroupId);
        if (!group) return;
        const current = __tmGetGroupCalendarSearchOptimization(group);
        group.calendarSearchOptimization = {
            ...current,
            enabled: !!enabled
        };
        SettingsStore.data.docGroups = groups.map((item) => __tmNormalizeDocGroupConfig(item, SettingsStore.data.docDefaultColorScheme)).filter(Boolean);
        __tmCalendarDocWindowCache.clear();
        await SettingsStore.save();
        try {
            await loadSelectedDocuments();
            render();
        } catch (e) {}
        showSettings();
    };

    window.updateCurrentGroupCalendarSearchOptimizationDays = async function(value) {
        const currentGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        if (currentGroupId === 'all') return;
        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        const group = groups.find((item) => String(item?.id || '').trim() === currentGroupId);
        if (!group) return;
        const current = __tmGetGroupCalendarSearchOptimization(group);
        group.calendarSearchOptimization = {
            ...current,
            days: [30, 60, 90, 120].includes(Number(value)) ? Number(value) : 90
        };
        SettingsStore.data.docGroups = groups.map((item) => __tmNormalizeDocGroupConfig(item, SettingsStore.data.docDefaultColorScheme)).filter(Boolean);
        __tmCalendarDocWindowCache.clear();
        await SettingsStore.save();
        try {
            await loadSelectedDocuments();
            render();
        } catch (e) {}
        showSettings();
    };

    window.updateEnableQuickbar = async function(enabled) {
        SettingsStore.data.enableQuickbar = !!enabled;
        await SettingsStore.save();
        try { globalThis.__taskHorizonQuickbarToggle?.(!!enabled); } catch (e) {}
        try { globalThis.__taskHorizonQuickbarRefreshInline?.(); } catch (e) {}
        showSettings();
    };

    window.updateEnableQuickbarInlineMeta = async function(enabled) {
        SettingsStore.data.enableQuickbarInlineMeta = !!enabled;
        await SettingsStore.save();
        try { globalThis.__taskHorizonQuickbarRefreshInline?.(); } catch (e) {}
        showSettings();
    };

    window.updateTaskDoneDelightEnabled = async function(enabled) {
        SettingsStore.data.taskDoneDelightEnabled = !!enabled;
        await SettingsStore.save();
        showSettings();
    };

    window.updateQuickbarInlineField = async function(field, enabled) {
        const key = String(field || '').trim();
        const allow = new Set(['custom-status', 'custom-completion-time', 'custom-priority', 'custom-start-date', 'custom-duration', 'custom-remark']);
        if (!allow.has(key)) return;
        const prev = Array.isArray(SettingsStore.data.quickbarInlineFields) ? SettingsStore.data.quickbarInlineFields : ['custom-status', 'custom-completion-time'];
        const nextSet = new Set(prev.map(v => String(v || '').trim()).filter(v => allow.has(v)));
        if (enabled) nextSet.add(key);
        else nextSet.delete(key);
        if (nextSet.size === 0) nextSet.add('custom-status');
        SettingsStore.data.quickbarInlineFields = Array.from(nextSet);
        await SettingsStore.save();
        try { globalThis.__taskHorizonQuickbarRefreshInline?.(); } catch (e) {}
        showSettings();
    };

    window.updateQuickbarVisibleItem = async function(field, enabled) {
        const key = String(field || '').trim();
        const allow = new Set(['custom-status', 'custom-priority', 'custom-start-date', 'custom-completion-time', 'custom-duration', 'custom-remark', 'action-ai-title', 'action-reminder', 'action-more']);
        if (!allow.has(key)) return;
        const defaults = ['custom-status', 'custom-priority', 'custom-start-date', 'custom-completion-time', 'custom-duration', 'custom-remark', 'action-ai-title', 'action-reminder', 'action-more'];
        const prev = Array.isArray(SettingsStore.data.quickbarVisibleItems) ? SettingsStore.data.quickbarVisibleItems : defaults;
        const nextSet = new Set(prev.map(v => String(v || '').trim()).filter(v => allow.has(v)));
        if (enabled) nextSet.add(key);
        else nextSet.delete(key);
        SettingsStore.data.quickbarVisibleItems = Array.from(nextSet);
        await SettingsStore.save();
        try { globalThis.__taskHorizonQuickbarRefresh?.(); } catch (e) {}
        showSettings();
    };

    window.updateQuickbarInlineShowOnMobile = async function(enabled) {
        SettingsStore.data.quickbarInlineShowOnMobile = !!enabled;
        await SettingsStore.save();
        try { globalThis.__taskHorizonQuickbarRefreshInline?.(); } catch (e) {}
        showSettings();
    };

    window.updateEnableTomatoIntegration = async function(enabled) {
        SettingsStore.data.enableTomatoIntegration = !!enabled;
        await SettingsStore.save();
        if (!enabled) state.timerFocusTaskId = '';
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            try { render(); } catch (e) {}
        }
    };

    window.updateTomatoSpentAttrMode = async function(mode) {
        const v = String(mode || '').trim();
        SettingsStore.data.tomatoSpentAttrMode = (v === 'hours') ? 'hours' : 'minutes';
        await SettingsStore.save();
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            loadSelectedDocuments();
        }
    };

    window.updateTomatoSpentAttrKeyMinutes = async function(value) {
        SettingsStore.data.tomatoSpentAttrKeyMinutes = String(value || '').trim();
        await SettingsStore.save();
        if (state.modal && document.body.contains(state.modal)) {
            loadSelectedDocuments();
        }
    };

    window.updateTomatoSpentAttrKeyHours = async function(value) {
        SettingsStore.data.tomatoSpentAttrKeyHours = String(value || '').trim();
        await SettingsStore.save();
        if (state.modal && document.body.contains(state.modal)) {
            loadSelectedDocuments();
        }
    };

    window.updateExcludeCompletedTasks = async function(enabled) {
        SettingsStore.data.excludeCompletedTasks = !!enabled;
        await SettingsStore.save();
        state.excludeCompletedTasks = !!enabled;
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            loadSelectedDocuments();
        }
    };

    window.updateSemanticDateAutoPromptEnabled = async function(enabled) {
        SettingsStore.data.semanticDateAutoPromptEnabled = !!enabled;
        await SettingsStore.save();
        if (!enabled) {
            try { __tmCloseSemanticDateConfirmModal(); } catch (e) {}
        }
        showSettings();
    };

    window.updateDefaultViewMode = async function(mode) {
        const next = __tmGetSafeViewMode(mode);
        SettingsStore.data.defaultViewMode = next;
        await SettingsStore.save();
        __tmDispatchDockSettingsChanged('desktop-default-view');
        showSettings();
    };

    window.updateDefaultViewModeMobile = async function(mode) {
        const next = __tmGetSafeViewMode(mode);
        SettingsStore.data.defaultViewModeMobile = next;
        await SettingsStore.save();
        __tmDispatchDockSettingsChanged('mobile-default-view');
        showSettings();
    };

    window.updateDockSidebarEnabled = async function(enabled) {
        SettingsStore.data.dockSidebarEnabled = !!enabled;
        await SettingsStore.save();
        __tmDispatchDockSettingsChanged('dock-enabled');
        showSettings();
    };

    window.updateDockDefaultViewMode = async function(mode) {
        const next = String(mode || '').trim();
        SettingsStore.data.dockDefaultViewMode = (next === 'follow-mobile' || __TM_ALL_VIEWS.some(v => v.id === next))
            ? next
            : 'follow-mobile';
        await SettingsStore.save();
        __tmDispatchDockSettingsChanged('dock-default-view');
        showSettings();
    };

    window.updateDockChecklistCompactTitleJump = async function(enabled) {
        SettingsStore.data.dockChecklistCompactTitleJump = !!enabled;
        await SettingsStore.save();
        __tmDispatchDockSettingsChanged('dock-checklist-compact-title-jump');
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            try { __tmScheduleViewRefresh({ mode: 'current', withFilters: false, reason: 'dock-checklist-compact-title-jump' }); } catch (e) {}
        }
    };

    window.updateMobileChecklistCompactTitleJump = async function(enabled) {
        SettingsStore.data.mobileChecklistCompactTitleJump = !!enabled;
        await SettingsStore.save();
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            try { __tmScheduleViewRefresh({ mode: 'current', withFilters: false, reason: 'mobile-checklist-compact-title-jump' }); } catch (e) {}
        }
    };

    window.updateChecklistCompactMetaFieldVisibility = async function(scope, fieldKey, enabled) {
        const rawScope = String(scope || '').trim();
        const scopeKey = rawScope === 'dock'
            ? 'dock'
            : (rawScope === 'desktop' ? 'desktop' : 'mobile');
        const normalizedField = String(fieldKey || '').trim();
        if (!__TM_CHECKLIST_COMPACT_META_FIELD_OPTIONS.some((item) => item.key === normalizedField)) return;
        const settingsKey = scopeKey === 'dock'
            ? 'dockChecklistCompactMetaFields'
            : (scopeKey === 'desktop' ? 'desktopChecklistCompactMetaFields' : 'mobileChecklistCompactMetaFields');
        const current = new Set(__tmNormalizeCompactChecklistMetaFields(SettingsStore.data[settingsKey]));
        if (enabled) current.add(normalizedField);
        else current.delete(normalizedField);
        SettingsStore.data[settingsKey] = __tmNormalizeCompactChecklistMetaFields(Array.from(current), []);
        if (scopeKey === 'dock') {
            SettingsStore.data.mobileChecklistCompactMetaFields = SettingsStore.data[settingsKey].slice();
        }
        await SettingsStore.save();
        if (scopeKey === 'dock') {
            __tmDispatchDockSettingsChanged('dock-checklist-compact-meta-fields');
        }
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            try { __tmScheduleViewRefresh({ mode: 'current', withFilters: false, reason: 'checklist-compact-meta-fields' }); } catch (e) {}
        }
    };

    window.updateChecklistCompactRightFontSize = async function(value) {
        SettingsStore.data.checklistCompactRightFontSize = __tmNormalizeChecklistCompactRightFontSize(value);
        await SettingsStore.save();
        if (globalThis.__tmRuntimeHost?.isDesktopDockHost?.() ?? (__tmIsDockHost() && !__tmIsRuntimeMobileClient())) {
            __tmDispatchDockSettingsChanged('checklist-compact-right-font-size');
        }
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            try { __tmScheduleViewRefresh({ mode: 'current', withFilters: false, reason: 'checklist-compact-right-font-size' }); } catch (e) {}
        }
    };

    window.updateTimelineCardFieldVisibility = async function(fieldKey, enabled) {
        const normalizedField = String(fieldKey || '').trim();
        if (!__TM_TIMELINE_CARD_FIELD_OPTIONS.some((item) => item.key === normalizedField)) return;
        const current = new Set(__tmNormalizeTimelineCardFields(SettingsStore.data.timelineCardFields));
        if (enabled) current.add(normalizedField);
        else current.delete(normalizedField);
        SettingsStore.data.timelineCardFields = __tmNormalizeTimelineCardFields(Array.from(current), []);
        await SettingsStore.save();
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            try { __tmScheduleViewRefresh({ mode: 'current', withFilters: false, reason: 'timeline-card-field-visibility' }); } catch (e) {}
        }
    };

    window.updateChecklistCompactTitleOpenDetailPage = async function(enabled) {
        SettingsStore.data.checklistCompactTitleOpenDetailPage = !!enabled;
        await SettingsStore.save();
        __tmDispatchDockSettingsChanged('checklist-compact-title-open-detail-page');
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            try { __tmScheduleViewRefresh({ mode: 'current', withFilters: false, reason: 'checklist-compact-title-open-detail-page' }); } catch (e) {}
        }
    };

    window.updateEnabledView = async function(mode, enabled) {
        const id = String(mode || '').trim();
        if (!__TM_ALL_VIEWS.some(v => v.id === id)) return;
        const current = __tmGetEnabledViews();
        let next = current.slice();
        if (enabled) {
            if (!next.includes(id)) next.push(id);
        } else {
            if (next.length <= 1) {
                try { hint('至少保留一个视图', 'warning'); } catch (e) {}
                showSettings();
                return;
            }
            next = next.filter(v => v !== id);
        }
        SettingsStore.data.enabledViews = __tmNormalizeEnabledViews(next);
        SettingsStore.data.defaultViewMode = __tmGetSafeViewMode(SettingsStore.data.defaultViewMode);
        state.viewMode = __tmGetSafeViewMode(state.viewMode);
        await SettingsStore.save();
        __tmDispatchDockSettingsChanged('enabled-views');
        showSettings();
        if (state.modal && document.body.contains(state.modal)) render();
    };

    window.updateKanbanCompactMode = async function(enabled) {
        SettingsStore.data.kanbanCompactMode = !!enabled;
        await SettingsStore.save();
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            if (!__tmRerenderCurrentViewInPlace(state.modal)) render();
        }
    };

    window.updateChecklistCompactMode = async function(enabled) {
        SettingsStore.data.checklistCompactMode = !!enabled;
        await SettingsStore.save();
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            if (!__tmRerenderCurrentViewInPlace(state.modal)) render();
        }
    };

    window.updateChecklistCompactTreeGuides = async function(enabled) {
        SettingsStore.data.checklistCompactTreeGuides = !!enabled;
        SettingsStore.data.checklistCompactTreeGuidesUpdatedAt = Date.now();
        await SettingsStore.save();
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            if (!__tmRerenderCurrentViewInPlace(state.modal)) render();
        }
    };

    window.updateKanbanColumnWidth = async function(width) {
        const n = Number(width);
        SettingsStore.data.kanbanColumnWidth = Number.isFinite(n) ? Math.max(220, Math.min(520, Math.round(n))) : 320;
        await SettingsStore.save();
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            if (!__tmRerenderCurrentViewInPlace(state.modal)) render();
        }
    };

    window.updateWhiteboardAllTabsCardMinWidth = async function(width) {
        const n = Number(width);
        SettingsStore.data.whiteboardAllTabsCardMinWidth = Number.isFinite(n) ? Math.max(220, Math.min(520, Math.round(n))) : 320;
        await SettingsStore.save();
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            try { __tmScheduleViewRefresh({ mode: 'current', withFilters: false, reason: 'whiteboard-all-tabs-card-min-width' }); } catch (e) {}
        }
    };

    window.updateWhiteboardStreamMobileTwoColumns = async function(enabled) {
        SettingsStore.data.whiteboardStreamMobileTwoColumns = !!enabled;
        await SettingsStore.save();
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            try { __tmScheduleViewRefresh({ mode: 'current', withFilters: false, reason: 'whiteboard-stream-mobile-two-columns' }); } catch (e) {}
        }
    };

    window.updateKanbanFillColumns = async function(enabled) {
        SettingsStore.data.kanbanFillColumns = !!enabled;
        await SettingsStore.save();
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            if (!__tmRerenderCurrentViewInPlace(state.modal)) render();
        }
    };

    window.updateKanbanShowDoneColumn = async function(enabled) {
        SettingsStore.data.kanbanShowDoneColumn = !!enabled;
        await SettingsStore.save();
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            if (!__tmRerenderCurrentViewInPlace(state.modal)) render();
        }
    };

    window.updateTaskCardFieldVisibility = async function(view, field, enabled) {
        const viewKey = String(view || '').trim() === 'whiteboard' ? 'whiteboardCardFields' : 'kanbanCardFields';
        const current = new Set(__tmNormalizeTaskCardFieldList(SettingsStore.data[viewKey], ['priority', 'status', 'date']));
        const key = String(field || '').trim();
        if (!key) return;
        if (enabled) current.add(key);
        else current.delete(key);
        SettingsStore.data[viewKey] = __tmNormalizeTaskCardFieldList(Array.from(current), ['priority', 'status', 'date']);
        await SettingsStore.save();
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            if (!__tmRerenderCurrentViewInPlace(state.modal)) render();
        }
    };

    window.updateTaskCardDateOnlyWithValue = async function(enabled) {
        SettingsStore.data.taskCardDateOnlyWithValue = !!enabled;
        await SettingsStore.save();
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            if (!__tmRerenderCurrentViewInPlace(state.modal)) render();
        }
    };

    window.updateDocH2SubgroupEnabled = async function(enabled) {
        SettingsStore.data.docH2SubgroupEnabled = !!enabled;
        await SettingsStore.save();
        if (enabled) {
            try { await __tmWarmKanbanDocHeadings(state.__tmLoadedDocIdsForTasks || []); } catch (e) {}
        }
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            if (!__tmRerenderCurrentViewInPlace(state.modal)) render();
        }
    };

    window.updateGroupByTaskName = async function(enabled) {
        SettingsStore.data.groupByTaskName = !!enabled;
        if (enabled) {
            SettingsStore.data.groupMode = 'task';
            SettingsStore.data.groupByDocName = false;
            SettingsStore.data.groupByTime = false;
            SettingsStore.data.quadrantConfig = SettingsStore.data.quadrantConfig || {};
            SettingsStore.data.quadrantConfig.enabled = false;
        } else {
            SettingsStore.data.groupMode = 'none';
        }
        await SettingsStore.save();
        state.groupByDocName = SettingsStore.data.groupByDocName;
        state.groupByTaskName = SettingsStore.data.groupByTaskName;
        state.groupByTime = SettingsStore.data.groupByTime;
        state.quadrantEnabled = !!(SettingsStore.data.quadrantConfig && SettingsStore.data.quadrantConfig.enabled);
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            if (!__tmRerenderCurrentViewInPlace(state.modal)) render();
        }
    };

    window.updateDurationFormat = async function(format) {
        const v = String(format || '').trim();
        SettingsStore.data.durationFormat = (v === 'minutes') ? 'minutes' : 'hours';
        state.durationFormat = SettingsStore.data.durationFormat;
        await SettingsStore.save();
        showSettings();
        if (state.modal && document.body.contains(state.modal)) {
            if (!__tmRerenderCurrentViewInPlace(state.modal)) render();
        }
    };

    window.updatePinNewTasksByDefault = async function(enabled) {
        SettingsStore.data.pinNewTasksByDefault = !!enabled;
        await SettingsStore.save();
        showSettings();
    };

    window.updateEnableMoveBlockToDailyNote = async function(enabled) {
        SettingsStore.data.enableMoveBlockToDailyNote = !!enabled;
        await SettingsStore.save();
        showSettings();
    };

    window.updateNewTaskDailyNoteAppendToBottom = async function(enabled) {
        SettingsStore.data.newTaskDailyNoteAppendToBottom = !!enabled;
        await SettingsStore.save();
        showSettings();
    };

    window.updateNewTaskDailyNoteNotebookId = async function(value) {
        SettingsStore.data.newTaskDailyNoteNotebookId = String(value || '').trim();
        await SettingsStore.save();
        showSettings();
    };

    window.updateHeadingGroupCreateAtSectionEnd = async function(enabled) {
        SettingsStore.data.headingGroupCreateAtSectionEnd = !!enabled;
        await SettingsStore.save();
        showSettings();
    };

    window.updateNewTaskDocId = async function(value, options) {
        const v = String(value || '').trim();
        SettingsStore.data.newTaskDocId = v;
        await SettingsStore.save();
        const opt = (options && typeof options === 'object') ? options : {};
        if (opt.refreshQuickAdd !== false) {
            const qa = state.quickAdd;
            if (qa) {
                if (v === '__dailyNote__') {
                    qa.docMode = 'dailyNote';
                    qa.docId = qa.docId || __tmResolveDefaultDocId();
                } else {
                    qa.docMode = 'doc';
                    qa.docId = v || __tmResolveDefaultDocId();
                }
                try { window.tmQuickAddRenderMeta?.(); } catch (e) {}
            }
        }
        if (opt.refreshPicker !== false) {
            if (state.quickAddDocPicker) {
                try { window.tmQuickAddOpenDocPicker?.(); } catch (e) {}
            }
        }
    };

    window.updateNewTaskDocIdFromSelect = async function(value) {
        await updateNewTaskDocId(value);
        try {
            const input = document.getElementById('tmNewTaskDocIdInput');
            const v = String(value || '').trim();
            if (input) input.value = v === '__dailyNote__' ? '' : v;
        } catch (e) {}
    };

    window.tmApplyNewTaskDocIdInput = async function() {
        const input = document.getElementById('tmNewTaskDocIdInput');
        const v = String(input?.value || '').trim();
        await updateNewTaskDocId(v);
        showSettings();
    };

    window.tmClearNewTaskDocIdInput = async function() {
        await updateNewTaskDocId('');
        showSettings();
    };

    window.updateDocTopbarButtonDesktop = async function(enabled) {
        SettingsStore.data.docTopbarButtonDesktop = !!enabled;
        await SettingsStore.save();
        __tmRefreshShellEntrances();
        showSettings();
    };

    window.updateDocTopbarButtonMobile = async function(enabled) {
        SettingsStore.data.docTopbarButtonMobile = !!enabled;
        await SettingsStore.save();
        __tmRefreshShellEntrances();
        showSettings();
    };

    window.updateDocTopbarButtonSwapPressActions = async function(enabled) {
        SettingsStore.data.docTopbarButtonSwapPressActions = !!enabled;
        await SettingsStore.save();
        __tmRefreshShellEntrances();
        showSettings();
    };

    window.updateDocTopbarButtonLocateCurrentDocTab = async function(enabled) {
        SettingsStore.data.docTopbarButtonLocateCurrentDocTab = !!enabled;
        await SettingsStore.save();
        __tmRefreshShellEntrances();
        showSettings();
    };

    window.updateWindowTopbarIconDesktop = async function(enabled) {
        SettingsStore.data.windowTopbarIconDesktop = !!enabled;
        await SettingsStore.save();
        __tmRefreshShellEntrances();
        showSettings();
    };

    window.updateWindowTopbarIconMobile = async function(enabled) {
        SettingsStore.data.windowTopbarIconMobile = !!enabled;
        await SettingsStore.save();
        __tmRefreshShellEntrances();
        showSettings();
    };

    window.updateDefaultDocId = async function(value) {
        const v = String(value || '').trim();
        const groupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        if (groupId === 'all') {
            SettingsStore.data.defaultDocId = v;
        } else {
            const map = (SettingsStore.data.defaultDocIdByGroup && typeof SettingsStore.data.defaultDocIdByGroup === 'object')
                ? { ...SettingsStore.data.defaultDocIdByGroup }
                : {};
            map[groupId] = v;
            SettingsStore.data.defaultDocIdByGroup = map;
        }
        await SettingsStore.save();
    };

    window.updateDefaultDocIdFromSelect = async function(value) {
        await updateDefaultDocId(value);
        try {
            const input = document.getElementById('tmDefaultDocIdInput');
            if (input) input.value = String(value || '').trim();
        } catch (e) {}
    };

    window.tmApplyDefaultDocIdInput = async function() {
        const input = document.getElementById('tmDefaultDocIdInput');
        const v = String(input?.value || '').trim();
        await updateDefaultDocId(v);
        hint(v ? '✅ 默认文档ID已更新' : '✅ 默认文档已清空', 'success');
        showSettings();
    };

    window.tmClearDefaultDocIdInput = async function() {
        const input = document.getElementById('tmDefaultDocIdInput');
        if (input) input.value = '';
        await updateDefaultDocId('');
        hint('✅ 默认文档已清空', 'success');
        showSettings();
    };

    window.toggleGroupByTime = async function(checked) {
        state.groupByTime = !!checked;
        if (state.groupByTime) {
            // 开启按时间分组时，需要将其他分组标志位设置为 false
            // 但不要修改 SettingsStore.data.groupByTaskName，以保留设置开关的状态
            state.groupByDocName = false;
            state.groupByTaskName = false;
            state.quadrantEnabled = false;
            SettingsStore.data.groupByDocName = false;
            SettingsStore.data.groupByTime = true;
            SettingsStore.data.groupMode = 'time';
            SettingsStore.data.quadrantConfig = SettingsStore.data.quadrantConfig || {};
            SettingsStore.data.quadrantConfig.enabled = false;
        } else {
            // 关闭分组模式时，需要将所有分组标志位设置为 false
            // 但不要修改 SettingsStore.data.groupByTaskName，以保留设置开关的状态
            state.groupByDocName = false;
            state.groupByTime = false;
            state.groupByTaskName = false;
            state.quadrantEnabled = false;
            SettingsStore.data.groupByDocName = false;
            SettingsStore.data.groupByTime = false;
            SettingsStore.data.groupMode = 'none';
            SettingsStore.data.quadrantConfig = SettingsStore.data.quadrantConfig || {};
            SettingsStore.data.quadrantConfig.enabled = false;
        }
        __tmPersistGlobalViewProfileFromCurrentState();
        try { SettingsStore.syncToLocal(); } catch (e) {}
        await SettingsStore.save();
        applyFilters();
        render();
    };

    window.toggleGroupByDocName = async function(checked) {
        state.groupByDocName = !!checked;
        if (state.groupByDocName) {
            // 开启按文档分组时，需要将其他分组标志位设置为 false
            // 但不要修改 SettingsStore.data.groupByTaskName，以保留设置开关的状态
            state.groupByTime = false;
            state.groupByTaskName = false;
            state.quadrantEnabled = false;
            SettingsStore.data.groupByTime = false;
            SettingsStore.data.groupByDocName = true;
            SettingsStore.data.groupMode = 'doc';
            SettingsStore.data.quadrantConfig = SettingsStore.data.quadrantConfig || {};
            SettingsStore.data.quadrantConfig.enabled = false;
        } else {
            // 关闭分组模式时，需要将所有分组标志位设置为 false
            // 但不要修改 SettingsStore.data.groupByTaskName，以保留设置开关的状态
            state.groupByDocName = false;
            state.groupByTime = false;
            state.groupByTaskName = false;
            state.quadrantEnabled = false;
            SettingsStore.data.groupByDocName = false;
            SettingsStore.data.groupByTime = false;
            SettingsStore.data.groupMode = 'none';
            SettingsStore.data.quadrantConfig = SettingsStore.data.quadrantConfig || {};
            SettingsStore.data.quadrantConfig.enabled = false;
        }
        __tmPersistGlobalViewProfileFromCurrentState();
        try { SettingsStore.syncToLocal(); } catch (e) {}
        await SettingsStore.save();
        applyFilters();
        render();
    };

    window.toggleGroupByTaskName = async function(checked) {
        state.groupByTaskName = !!checked;
        if (state.groupByTaskName) {
            state.groupByDocName = false;
            state.groupByTime = false;
            state.quadrantEnabled = false;
            SettingsStore.data.groupByDocName = false;
            SettingsStore.data.groupByTime = false;
            SettingsStore.data.groupByTaskName = true;
            SettingsStore.data.groupMode = 'task';
            SettingsStore.data.quadrantConfig = SettingsStore.data.quadrantConfig || {};
            SettingsStore.data.quadrantConfig.enabled = false;
        } else {
            SettingsStore.data.groupByTaskName = false;
            SettingsStore.data.groupMode = 'none';
        }
        __tmPersistGlobalViewProfileFromCurrentState();
        try { SettingsStore.syncToLocal(); } catch (e) {}
        await SettingsStore.save();
        applyFilters();
        render();
    };

    window.toggleQuadrantGroup = async function(checked) {
        state.quadrantEnabled = !!checked;
        if (state.quadrantEnabled) {
            state.groupByDocName = false;
            state.groupByTime = false;
            state.groupByTaskName = false;
            SettingsStore.data.groupByDocName = false;
            SettingsStore.data.groupByTime = false;
            SettingsStore.data.groupMode = 'quadrant';
            SettingsStore.data.quadrantConfig = SettingsStore.data.quadrantConfig || {};
            SettingsStore.data.quadrantConfig.enabled = true;
        } else {
            // 关闭四象限时，需要将所有分组标志位设置为 false
            // 但不要修改 SettingsStore.data.groupByTaskName，以保留设置开关的状态
            state.groupByDocName = false;
            state.groupByTime = false;
            state.groupByTaskName = false;
            state.quadrantEnabled = false;
            SettingsStore.data.quadrantConfig = SettingsStore.data.quadrantConfig || {};
            SettingsStore.data.quadrantConfig.enabled = false;
            SettingsStore.data.groupMode = 'none';
        }
        __tmPersistGlobalViewProfileFromCurrentState();
        try { SettingsStore.syncToLocal(); } catch (e) {}
        await SettingsStore.save();
        applyFilters();
        render();
    };

    window.tmSwitchGroupMode = async function(mode) {
        const m = String(mode || '').trim();
        if (m === 'doc') return toggleGroupByDocName(true);
        if (m === 'time') return toggleGroupByTime(true);
        if (m === 'task') return toggleGroupByTaskName(true);
        if (m === 'quadrant') return toggleQuadrantGroup(true);
        // 只修改当前视图状态，不修改设置开关
        state.groupByDocName = false;
        // 切换到不分组时，设置 state.groupByTaskName 为 false
        // 但不修改 SettingsStore.data.groupByTaskName，以保留设置开关的状态
        state.groupByTaskName = false;
        state.groupByTime = false;
        state.quadrantEnabled = false;
        SettingsStore.data.groupMode = 'none';
        SettingsStore.data.quadrantConfig = SettingsStore.data.quadrantConfig || {};
        SettingsStore.data.quadrantConfig.enabled = false;
        __tmPersistGlobalViewProfileFromCurrentState();
        try { SettingsStore.syncToLocal(); } catch (e) {}
        await SettingsStore.save();
        applyFilters();
        render();
    };

    window.tmToggleKanbanHeadingGroupMode = async function(ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        try { ev?.preventDefault?.(); } catch (e) {}
        const next = !(SettingsStore.data.kanbanHeadingGroupMode === true);
        SettingsStore.data.kanbanHeadingGroupMode = next;
        try { SettingsStore.syncToLocal(); } catch (e) {}
        await SettingsStore.save();
        if (next) {
            try { await __tmCleanupPlaceholderTasks(state.__tmLoadedDocIdsForTasks || []); } catch (e) {}
            try { await __tmWarmKanbanDocHeadings(state.__tmLoadedDocIdsForTasks || []); } catch (e) {}
        }
        applyFilters();
        if (!__tmRerenderCurrentViewInPlace(state.modal)) render();
        try { hint(next ? '✅ 已切换到标题看板' : '✅ 已切换到状态看板', 'success'); } catch (e) {}
    };

    window.tmSetKanbanHeadingGroupMode = async function(mode, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        try { ev?.preventDefault?.(); } catch (e) {}
        const m = String(mode || '').trim().toLowerCase();
        const next = m === 'heading';
        const prev = SettingsStore.data.kanbanHeadingGroupMode === true;
        if (next === prev) return;
        SettingsStore.data.kanbanHeadingGroupMode = next;
        try { SettingsStore.syncToLocal(); } catch (e) {}
        await SettingsStore.save();
        if (next) {
            try { await __tmCleanupPlaceholderTasks(state.__tmLoadedDocIdsForTasks || []); } catch (e) {}
            try { await __tmWarmKanbanDocHeadings(state.__tmLoadedDocIdsForTasks || []); } catch (e) {}
        }
        applyFilters();
        if (!__tmRerenderCurrentViewInPlace(state.modal)) render();
        try { hint(next ? '✅ 已切换到标题看板' : '✅ 已切换到状态看板', 'success'); } catch (e) {}
    };

    window.tmSetWhiteboardAllTabsLayoutMode = async function(mode, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        try { ev?.preventDefault?.(); } catch (e) {}
        const next = __tmNormalizeWhiteboardAllTabsLayoutMode(mode);
        const prev = __tmGetWhiteboardAllTabsLayoutMode();
        if (next === prev) return;
        SettingsStore.data.whiteboardAllTabsLayoutMode = next;
        state.whiteboardAllTabsDocDragId = '';
        try { SettingsStore.syncToLocal(); } catch (e) {}
        await SettingsStore.save();
        render();
        try { hint(next === 'stream' ? '✅ 已切换到卡片流' : '✅ 已切换到白板', 'success'); } catch (e) {}
    };

    window.tmSetWhiteboardLayoutModeFromMobileMenu = async function(mode, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        try { ev?.preventDefault?.(); } catch (e) {}
        if (String(state.viewMode || '').trim() !== 'whiteboard') return;
        const next = __tmNormalizeWhiteboardAllTabsLayoutMode(mode);
        const prev = __tmGetWhiteboardAllTabsLayoutMode();
        const activeDocId = String(state.activeDocId || 'all').trim() || 'all';
        const needSwitchAllTabs = activeDocId !== 'all';
        if (!needSwitchAllTabs && next === prev) {
            try { window.tmHideMobileMenu?.(); } catch (e) {}
            return;
        }
        if (needSwitchAllTabs) {
            await window.tmSwitchDoc('all');
            if (next === prev) {
                try { hint(next === 'stream' ? '✅ 已切换到卡片流' : '✅ 已切换到白板', 'success'); } catch (e) {}
                try { window.tmHideMobileMenu?.(); } catch (e) {}
                return;
            }
        }
        await window.tmSetWhiteboardAllTabsLayoutMode(next, ev);
    };

    window.tmWhiteboardAllTabsDocDragStart = function(ev, docId) {
        if (!__tmIsWhiteboardAllTabsStreamMode()) return;
        const id = String(docId || '').trim();
        if (!id) return;
        state.whiteboardAllTabsDocDragId = id;
        try {
            if (ev?.dataTransfer) {
                ev.dataTransfer.effectAllowed = 'move';
                ev.dataTransfer.setData('text/plain', id);
            }
        } catch (e) {}
        __tmClearWhiteboardAllTabsDocDragMarkers();
        try {
            const card = ev?.target instanceof Element ? ev.target.closest('.tm-whiteboard-stream-doc[data-doc-id]') : null;
            card?.classList?.add?.('tm-whiteboard-stream-doc--dragging');
        } catch (e) {}
    };

    window.tmWhiteboardAllTabsDocDragEnd = function() {
        state.whiteboardAllTabsDocDragId = '';
        __tmClearWhiteboardAllTabsDocDragMarkers();
    };

    window.tmWhiteboardAllTabsDocDragOver = function(ev, docId) {
        if (!__tmIsWhiteboardAllTabsStreamMode()) return;
        const sourceId = String(state.whiteboardAllTabsDocDragId || '').trim();
        const targetId = String(docId || '').trim();
        if (!sourceId || !targetId || sourceId === targetId) return;
        try { ev?.preventDefault?.(); } catch (e) {}
        try { if (ev?.dataTransfer) ev.dataTransfer.dropEffect = 'move'; } catch (e) {}
        const card = ev?.target instanceof Element ? ev.target.closest('.tm-whiteboard-stream-doc[data-doc-id]') : null;
        if (!(card instanceof HTMLElement)) return;
        const rect = card.getBoundingClientRect();
        const pos = (Number(ev?.clientY) - rect.top) > (rect.height / 2) ? 'after' : 'before';
        __tmClearWhiteboardAllTabsDocDragMarkers();
        card.classList.add(pos === 'after' ? 'tm-whiteboard-stream-doc--drag-after' : 'tm-whiteboard-stream-doc--drag-before');
        try {
            const sourceCard = state.modal?.querySelector?.(`.tm-whiteboard-stream-doc[data-doc-id="${CSS.escape(sourceId)}"]`);
            sourceCard?.classList?.add?.('tm-whiteboard-stream-doc--dragging');
        } catch (e) {}
    };

    window.tmWhiteboardAllTabsDocDrop = async function(ev, docId) {
        if (!__tmIsWhiteboardAllTabsStreamMode()) return;
        try { ev?.preventDefault?.(); } catch (e) {}
        try { ev?.stopPropagation?.(); } catch (e) {}
        const sourceId = String(state.whiteboardAllTabsDocDragId || '').trim()
            || String(ev?.dataTransfer?.getData?.('text/plain') || '').trim();
        const targetId = String(docId || '').trim();
        if (!sourceId || !targetId || sourceId === targetId) {
            __tmClearWhiteboardAllTabsDocDragMarkers();
            return;
        }
        const visibleIds = Array.from(new Set((Array.isArray(state.whiteboardAllTabsVisibleDocIds) ? state.whiteboardAllTabsVisibleDocIds : []).map((id) => String(id || '').trim()).filter(Boolean)));
        if (!visibleIds.includes(sourceId) || !visibleIds.includes(targetId)) {
            __tmClearWhiteboardAllTabsDocDragMarkers();
            return;
        }
        const card = ev?.target instanceof Element ? ev.target.closest('.tm-whiteboard-stream-doc[data-doc-id]') : null;
        let insertAfter = false;
        if (card instanceof HTMLElement) {
            const rect = card.getBoundingClientRect();
            insertAfter = (Number(ev?.clientY) - rect.top) > (rect.height / 2);
        }
        const nextVisible = visibleIds.filter((id) => id !== sourceId);
        const targetIndex = nextVisible.indexOf(targetId);
        const insertIndex = targetIndex < 0 ? nextVisible.length : Math.max(0, Math.min(nextVisible.length, targetIndex + (insertAfter ? 1 : 0)));
        nextVisible.splice(insertIndex, 0, sourceId);
        const groupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        const storedIds = Array.isArray(__tmGetWhiteboardAllTabsDocOrderByGroupMap()[groupId])
            ? __tmGetWhiteboardAllTabsDocOrderByGroupMap()[groupId]
            : [];
        const baseIds = Array.isArray(state.whiteboardAllTabsBaseDocIds) ? state.whiteboardAllTabsBaseDocIds : [];
        const remainder = [];
        const pushRemainder = (id0) => {
            const id = String(id0 || '').trim();
            if (!id || nextVisible.includes(id) || remainder.includes(id)) return;
            remainder.push(id);
        };
        storedIds.forEach(pushRemainder);
        baseIds.forEach(pushRemainder);
        state.whiteboardAllTabsVisibleDocIds = nextVisible.slice();
        __tmSetWhiteboardAllTabsDocOrder(groupId, nextVisible.concat(remainder));
        state.whiteboardAllTabsDocDragId = '';
        __tmClearWhiteboardAllTabsDocDragMarkers();
        try { await SettingsStore.save(); } catch (e) {}
        render();
    };

    window.tmToggleGroupCollapse = async function(groupKey, ev) {
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}
        const isChecklist = String(state.viewMode || '').trim() === 'checklist';
        const isCalendarSidebarChecklist = __tmHasCalendarSidebarChecklist(state.modal);

        const k0 = String(groupKey || '').trim();
        const action = state.collapsedGroups.has(k0) ? 'expand' : 'collapse';
        const mode = __tmGetCollapseAnimMode();
        const flipOpts = { kind: 'group', key: k0, action, lite: mode === 'lite' };
        let skipAnim = mode === 'none';
        try {
            const tbody = __tmGetActiveTbody(state.modal);
            const n = __tmCountAffectedRowsForCollapse(tbody, flipOpts, 161);
            if (n > 240) skipAnim = true;
            else if (n > 120 && !skipAnim) flipOpts.lite = true;
        } catch (e) {}
        if (!skipAnim) {
            try { __tmPrepareFlipAnimation(flipOpts); } catch (e) {}
        } else {
            try { __tmResetFlipState(state.modal); } catch (e) {}
        }

        if (state.collapsedGroups.has(groupKey)) state.collapsedGroups.delete(groupKey);
        else state.collapsedGroups.add(groupKey);

        SettingsStore.data.collapsedGroups = [...state.collapsedGroups];
        __tmMarkCollapseStateChanged();
        // 直接同步到本地存储，不等待云端同步，避免延迟
        try { Storage.set('tm_collapsed_groups', SettingsStore.data.collapsedGroups); } catch (e) {}
        const persistCollapsedGroups = () => {
            try {
                const p = SettingsStore.save();
                if (p && typeof p.catch === 'function') p.catch(() => null);
            } catch (e) {}
        };
        if (isChecklist) {
            persistCollapsedGroups();
            __tmRenderChecklistPreserveScroll();
            return;
        }
        if (isCalendarSidebarChecklist) {
            persistCollapsedGroups();
            __tmRefreshCalendarSidebarChecklistPreserveScroll();
            return;
        }
        try { __tmUpdateToggleGlyphInDom({ kind: 'group', key: k0, action }); } catch (e) {}
        if (action === 'collapse') {
            if (state.modal && __tmApplyVisibilityFromState(state.modal)) {
                persistCollapsedGroups();
                if (!skipAnim) {
                    try { queueMicrotask(() => { try { __tmRunFlipAnimation(state.modal); } catch (e) {} }); } catch (e) {}
                }
                return;
            }
            persistCollapsedGroups();
            __tmScheduleCollapseRerender();
            return;
        }
        persistCollapsedGroups();
        __tmScheduleCollapseRerender();
    };

    window.tmToggleCollapse = async function(id, ev) {
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}
        const isChecklist = String(state.viewMode || '').trim() === 'checklist';
        const isCalendarSidebarChecklist = __tmHasCalendarSidebarChecklist(state.modal);
        const isListView = String(state.viewMode || '').trim() === 'list';
        const key = String(id || '');
        if (!key) return;

        const action = state.collapsedTaskIds.has(key) ? 'expand' : 'collapse';
        const useFastListCollapse = !isChecklist && isListView && action === 'collapse';
        const mode = useFastListCollapse ? 'none' : __tmGetCollapseAnimMode();
        const flipOpts = { kind: 'task', key, action, lite: mode === 'lite' };
        let skipAnim = mode === 'none' || useFastListCollapse;
        if (!useFastListCollapse) {
            try {
                const tbody = __tmGetActiveTbody(state.modal);
                const n = __tmCountAffectedRowsForCollapse(tbody, flipOpts, 161);
                if (n > 240) skipAnim = true;
                else if (n > 120 && !skipAnim) flipOpts.lite = true;
            } catch (e) {}
        }
        if (!skipAnim) {
            try { __tmPrepareFlipAnimation(flipOpts); } catch (e) {}
        } else {
            try { __tmResetFlipState(state.modal); } catch (e) {}
        }
        if (state.collapsedTaskIds.has(key)) state.collapsedTaskIds.delete(key);
        else state.collapsedTaskIds.add(key);

        // 直接同步到本地存储，不等待云端同步，避免延迟
        SettingsStore.data.collapsedTaskIds = [...state.collapsedTaskIds];
        __tmMarkCollapseStateChanged();
        try { Storage.set('tm_collapsed_task_ids', SettingsStore.data.collapsedTaskIds); } catch (e) {}
        const persistCollapsedTasks = () => {
            try {
                const p = SettingsStore.save();
                if (p && typeof p.catch === 'function') p.catch(() => null);
            } catch (e) {}
        };
        if (isChecklist) {
            persistCollapsedTasks();
            __tmRenderChecklistPreserveScroll();
            return;
        }
        if (isCalendarSidebarChecklist) {
            persistCollapsedTasks();
            __tmRefreshCalendarSidebarChecklistPreserveScroll();
            return;
        }
        try { __tmUpdateToggleGlyphInDom({ kind: 'task', key, action }); } catch (e) {}
        if (action === 'collapse') {
            if (useFastListCollapse && state.modal && __tmTryCollapseTaskBranchInList(state.modal, key)) {
                persistCollapsedTasks();
                return;
            }
            if (state.modal && __tmApplyVisibilityFromState(state.modal)) {
                persistCollapsedTasks();
                if (!skipAnim) {
                    try { queueMicrotask(() => { try { __tmRunFlipAnimation(state.modal); } catch (e) {} }); } catch (e) {}
                }
                return;
            }
            persistCollapsedTasks();
            __tmScheduleCollapseRerender();
            return;
        }
        persistCollapsedTasks();
        __tmScheduleCollapseRerender();
    };

    function __tmCollectVisibleGroupKeysFromDom() {
        const modal = state.modal;
        if (!(modal instanceof HTMLElement)) return [];
        const keys = new Set();
        modal.querySelectorAll?.('[data-group-key]').forEach((el) => {
            const key = String(el?.getAttribute?.('data-group-key') || '').trim();
            if (key) keys.add(key);
        });
        return Array.from(keys);
    }

    window.tmCollapseAllTasks = async function() {
        if (state.viewMode === 'kanban' || state.viewMode === 'whiteboard') {
            const filtered = Array.isArray(state.filteredTasks) ? state.filteredTasks : [];
            const collapsed = __tmKanbanGetCollapsedSet();
            filtered.forEach(t => {
                const id = String(t?.id || '').trim();
                if (!id) return;
                const kids = Array.isArray(t?.children) ? t.children : [];
                if (!kids.length) return;
                // 子任务可能因为已完成列等原因不在同列显示，但父任务仍应纳入“全部折叠”。
                collapsed.add(id);
            });
            __tmKanbanPersistCollapsed();
            render();
            return;
        }
        const filteredSet = new Set(state.filteredTasks.map(t => t.id));
        const next = new Set(state.collapsedTaskIds || []);
        const applyCollapse = (list) => {
            list.forEach(t => {
                const hasVisibleChild = (t.children || []).some(c => filteredSet.has(c.id));
                if (filteredSet.has(t.id) && hasVisibleChild) {
                    next.add(String(t.id));
                }
                if (t.children && t.children.length > 0) applyCollapse(t.children);
            });
        };
        state.taskTree.forEach(doc => {
            if (state.activeDocId !== 'all' && doc.id !== state.activeDocId) return;
            applyCollapse(doc.tasks || []);
        });
        state.collapsedTaskIds = next;
        SettingsStore.data.collapsedTaskIds = [...next];
        __tmMarkCollapseStateChanged();
        try { Storage.set('tm_collapsed_task_ids', SettingsStore.data.collapsedTaskIds); } catch (e) {}
        if (SettingsStore.data.collapseAllIncludesGroups) {
            const nextGroups = new Set(state.collapsedGroups || []);
            __tmCollectVisibleGroupKeysFromDom().forEach((key) => nextGroups.add(key));
            state.collapsedGroups = nextGroups;
            SettingsStore.data.collapsedGroups = [...nextGroups];
            try { Storage.set('tm_collapsed_groups', SettingsStore.data.collapsedGroups); } catch (e) {}
        }
        try { __tmResetFlipState(state.modal); } catch (e) {}
        if (!(state.modal && __tmApplyVisibilityFromState(state.modal))) {
            if (!__tmRerenderCollapseInPlace()) render();
        }
        await SettingsStore.save();
    };

    window.tmExpandAllTasks = async function() {
        if (state.viewMode === 'kanban' || state.viewMode === 'whiteboard') {
            __tmKanbanGetCollapsedSet().clear();
            __tmKanbanPersistCollapsed();
            render();
            return;
        }
        state.collapsedTaskIds = new Set();
        SettingsStore.data.collapsedTaskIds = [];
        __tmMarkCollapseStateChanged();
        try { Storage.set('tm_collapsed_task_ids', []); } catch (e) {}
        if (SettingsStore.data.collapseAllIncludesGroups) {
            const visibleGroupKeys = new Set(__tmCollectVisibleGroupKeysFromDom());
            const nextGroups = new Set(Array.from(state.collapsedGroups || []).filter((key) => !visibleGroupKeys.has(String(key || '').trim())));
            state.collapsedGroups = nextGroups;
            SettingsStore.data.collapsedGroups = [...nextGroups];
            try { Storage.set('tm_collapsed_groups', SettingsStore.data.collapsedGroups); } catch (e) {}
        }
        try { __tmResetFlipState(state.modal); } catch (e) {}
        if (!__tmRerenderCollapseInPlace()) render();
        await SettingsStore.save();
    };

    window.closeSettings = function() {
        state.__settingsUnstack?.();
        state.__settingsUnstack = null;
        state.statusOptionDraft = null;
        state.statusOptionDraftShouldFocus = false;
        if (state.settingsModal) {
            state.settingsModal.remove();
            state.settingsModal = null;
        }
        state.settingsSectionJump = null;
    };

