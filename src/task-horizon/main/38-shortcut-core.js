    // Shortcut definitions and navigation use plugin settings; entries keep separate host states.
    const __tmShortcuts = (() => {
        const views = ['home', 'timeline', 'calendar', 'kanban', 'list', 'checklist', 'whiteboard'];
        let generation = 0, openingGeneration = 0;
        const documentNames = new Map(), documentScopes = new Map();
        const restoredSessions = new Set();
        const text = value => String(value ?? '').trim();
        const groups = () => [{ id: 'all', name: '全部文档' }, ...(SettingsStore.data.docGroups || []).map(group => ({ ...group, name: __tmResolveDocGroupName(group) }))];
        const rules = () => Array.isArray(state.filterRules) ? state.filterRules : [];
        const tabGroups = groupId => (SettingsStore.data.docTabCustomGroups || [])
            .filter(group => __tmGetDocTabCustomGroupScopeId(group) === groupId);
        const documentName = id => documentNames.get(id) || [...(state.allDocuments || []), ...(state.taskTree || [])].find(doc => doc.id === id)?.name || '';
        function normalize(input) {
            const seen = new Set();
            return (Array.isArray(input) ? input : []).flatMap(source => {
                if (!source || typeof source !== 'object') return [];
                const id = text(source.id), name = text(source.name).slice(0, 32);
                if (!id || !name || seen.has(id)) return [];
                seen.add(id);
                const icon = source.icon?.type === 'siyuan'
                    ? { type: 'siyuan', value: text(source.icon.value).slice(0, 4096) }
                    : { type: 'phosphor', name: /^[a-z0-9-]+$/.test(source.icon?.name || '') ? source.icon.name : 'star' };
                return [{ id, name, icon, groupId: text(source.groupId) || 'all', tabGroupId: text(source.tabGroupId),
                    docId: text(source.docId) || 'all', viewId: text(source.viewId) || 'checklist',
                    ruleId: text(source.ruleId), groupMode: __tmNormalizeGroupModeValue(source.groupMode, ''),
                    kanbanBoardMode: __tmNormalizeKanbanBoardMode(source.kanbanBoardMode),
                    targetNames: { ...(source.targetNames || {}) } }];
            });
        }
        const items = () => normalize(SettingsStore.data.shortcutItems);
        function names(item) {
            return {
                group: groups().find(group => group.id === item.groupId)?.name || item.targetNames?.group || item.groupId,
                tabGroup: tabGroups(item.groupId).find(group => group.id === item.tabGroupId)?.name || item.targetNames?.tabGroup || item.tabGroupId,
                doc: item.docId === 'all' ? '全部页签' : documentName(item.docId) || item.targetNames?.doc || item.docId,
                view: item.viewId === 'home' ? '首页' : __TM_ALL_VIEWS.find(view => view.id === item.viewId)?.label || item.viewId,
                groupMode: item.groupMode ? __tmGetGroupModeLabel(item.groupMode) : '保持当前分组',
                kanbanBoardMode: item.kanbanBoardMode ? __tmGetKanbanBoardModeLongLabel(item.kanbanBoardMode) : '保持当前看板模式',
                rule: !item.ruleId ? '不应用规则' : rules().find(rule => rule.id === item.ruleId)?.name || item.targetNames?.rule || item.ruleId,
            };
        }
        function issues(item, checkDocument = true) {
            const result = [], labels = names(item);
            if (!groups().some(group => group.id === item.groupId)) result.push(`文档分组「${labels.group}」已删除或不可用`);
            if (item.tabGroupId && !tabGroups(item.groupId).some(group => group.id === item.tabGroupId)) result.push(`页签组「${labels.tabGroup}」已删除或不属于此分组`);
            if (!views.includes(item.viewId) || (item.viewId !== 'home' && !__tmIsViewEnabled(item.viewId))) result.push(`视图「${labels.view}」已停用或不可用`);
            if (item.ruleId && !rules().some(rule => rule.id === item.ruleId && rule.enabled !== false)) result.push(`规则「${labels.rule}」已删除或停用`);
            const scope = documentScopes.get(item.groupId + '|' + item.tabGroupId);
            if (checkDocument && item.docId !== 'all' && scope && scope.version === Number(SettingsStore.data.docGroupSettingsUpdatedAt || 0) && !scope.ids.has(item.docId)) result.push(`文档「${labels.doc}」已删除或移出所选范围`);
            return result;
        }
        async function documents(groupId, tabGroupId = '', withNames = false) {
            if (!groups().some(group => group.id === groupId)) throw new Error('文档分组不存在');
            const ids = await resolveDocIdsFromGroups({ groupId, skipPersistedScope: true, verifyCachedScope: false });
            const known = new Map([...(state.allDocuments || []), ...(state.taskTree || [])].map(doc => [doc.id, doc]));
            let docs = (ids || []).map(id => ({ ...(known.get(id) || {}), id, name: known.get(id)?.name || id }));
            if (tabGroupId) {
                const members = __tmGetDocTabCustomGroupDocIdSet(tabGroupId, { currentGroupId: groupId, docs, includeSpecialNewTaskDoc: true });
                docs = docs.filter(doc => members.has(doc.id));
            }
            documentScopes.set(groupId + '|' + tabGroupId, { version: Number(SettingsStore.data.docGroupSettingsUpdatedAt || 0), ids: new Set(docs.map(doc => doc.id)) });
            if (withNames) {
                const missing = docs.filter(doc => !documentName(doc.id) && /^[0-9]+-[a-zA-Z0-9]+$/.test(doc.id));
                if (missing.length) {
                    const response = await API.call('/api/query/sql', { stmt: `SELECT id, content FROM blocks WHERE type = 'd' AND id IN (${missing.map(doc => `'${doc.id}'`).join(',')})` });
                    if (response?.code !== 0) throw new Error('无法加载文档名称');
                    for (const row of response.data || []) documentNames.set(row.id, String(row.content || '').trim() || '未命名文档');
                }
                docs = docs.map(doc => ({ ...doc, name: documentName(doc.id) || doc.name }));
            }
            return docs;
        }
        function context() {
            const value = state.shortcutContext;
            return value && value.groupId === (SettingsStore.data.currentGroupId || 'all')
                && value.activeDocId === (state.activeDocId || 'all') ? value : null;
        }
        const sessionKey = () => `${__tmIsRuntimeMobileClient() ? 'mobile' : 'desktop'}_${__tmIsDockHost() ? 'dock' : 'main'}`;
        async function persistSession() {
            if (openingGeneration) return false;
            const key = sessionKey(), value = context();
            restoredSessions.add(key);
            const stored = SettingsStore.data.shortcutNavigationSessions;
            const sessions = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
            let saved = null;
            if (value && items().some(item => item.id === value.shortcutId)) {
                const { shortcutId, groupId, tabGroupId, docId, viewId, ruleId, groupMode, kanbanBoardMode } = value;
                saved = { shortcutId, groupId, tabGroupId, docId, viewId, ruleId, groupMode, kanbanBoardMode };
            }
            if (!saved && !sessions[key]) return true;
            SettingsStore.data.shortcutNavigationSessions = { ...sessions, [key]: saved };
            try {
                await SettingsStore.save({ suppressMobileCloseSyncDirty: true });
                return true;
            } catch (error) {
                hint('快捷方式状态保存失败，请稍后重试', 'warning');
                return false;
            }
        }
        async function restoreSession({ isCurrent = () => true } = {}) {
            const key = sessionKey(), request = generation;
            if (restoredSessions.has(key) || context()) return false;
            const saved = SettingsStore.data.shortcutNavigationSessions?.[key];
            if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
                restoredSessions.add(key);
                return false;
            }
            try { await __tmEnsureFilterRulesLoaded(); } catch (e) { return false; }
            if (request !== generation || key !== sessionKey() || !isCurrent()) return false;
            const item = items().find(entry => entry.id === saved.shortcutId);
            const value = item && { ...item, viewId: text(saved.viewId), ruleId: text(saved.ruleId),
                groupMode: __tmNormalizeGroupModeValue(saved.groupMode, '') || item.groupMode || __tmGetCurrentGroupModeValue(),
                kanbanBoardMode: __tmNormalizeKanbanBoardMode(saved.kanbanBoardMode) || item.kanbanBoardMode || __tmGetKanbanBoardMode() };
            if (!value || value.groupId !== saved.groupId || value.tabGroupId !== saved.tabGroupId
                || value.docId !== saved.docId || issues(value, false).length) {
                restoredSessions.add(key);
                await persistSession();
                return false;
            }
            if (value.docId !== 'all') {
                let docs;
                try { docs = await documents(value.groupId, value.tabGroupId); } catch (e) { return false; }
                if (request !== generation || key !== sessionKey() || !isCurrent()) return false;
                if (!docs.some(doc => doc.id === value.docId)) {
                    restoredSessions.add(key);
                    await persistSession();
                    return false;
                }
            }
            restoredSessions.add(key);
            SettingsStore.data.currentGroupId = value.groupId;
            state.activeDocId = value.docId !== 'all' ? value.docId
                : value.tabGroupId ? __tmBuildDocTabCustomGroupActiveId(value.tabGroupId) : 'all';
            state.shortcutContext = { ...value, shortcutId: item.id, activeDocId: state.activeDocId };
            state.homepageOpen = value.viewId === 'home';
            state.attachmentLibraryOpen = false;
            if (value.viewId !== 'home') state.viewMode = value.viewId;
            state.viewModeInitialized = true;
            state.currentRule = value.ruleId || null;
            __tmApplyCompletedVisibilityToRuntime();
            __tmApplyGroupModeToRuntime(value.groupMode);
            return true;
        }
        function clearContext({ preserveSession = false } = {}) {
            generation++;
            openingGeneration = 0;
            state.shortcutContext = null;
            if (!preserveSession) {
                void persistSession();
            }
        }
        function activeId() {
            const value = context();
            const item = value && items().find(entry => entry.id === value.shortcutId);
            const view = state.homepageOpen ? 'home' : state.viewMode;
            return item && item.viewId === view && item.ruleId === text(state.currentRule)
                && (!item.groupMode || item.groupMode === __tmGetCurrentGroupModeValue())
                && (view !== 'kanban' || !item.kanbanBoardMode || item.kanbanBoardMode === __tmGetKanbanBoardMode())
                ? value.shortcutId : '';
        }
        function updateContext(patch) {
            const value = context();
            if (!value) return false;
            Object.assign(value, patch);
            void persistSession();
            return true;
        }
        async function save(nextItems) {
            const before = SettingsStore.data.shortcutItems;
            SettingsStore.data.shortcutItems = normalize(nextItems);
            try { await SettingsStore.save(); }
            catch (error) { SettingsStore.data.shortcutItems = before; throw error; }
            await persistSession();
            __tmShortcutSidebar.refresh();
        }
        async function open(id) {
            const request = ++generation;
            const item = items().find(entry => entry.id === id);
            if (!item) return false;
            await Promise.all([__tmShortcutSidebar.closeDrawer(), __tmEnsureFilterRulesLoaded()]);
            let invalid = issues(item, false);
            if (!invalid.length && item.docId !== 'all') {
                try {
                    const docs = await documents(item.groupId, item.tabGroupId);
                    if (!docs.some(doc => doc.id === item.docId)) invalid.push(`文档「${names(item).doc}」已删除或移出所选范围`);
                } catch (error) {
                    if (request === generation) hint('暂时无法确认文档范围，请稍后重试', 'warning');
                    return false;
                }
            }
            if (request !== generation) return false;
            if (invalid.length) { __tmShortcutSidebar.refresh();__tmShortcutSidebar.showInvalid(item, invalid); return false; }
            const previous = { groupId: SettingsStore.data.currentGroupId, activeDocId: state.activeDocId,
                viewMode: state.viewMode, currentRule: state.currentRule, homepageOpen: state.homepageOpen,
                shortcutContext: state.shortcutContext, searchKeyword: state.searchKeyword,
                attachmentLibraryOpen: state.attachmentLibraryOpen, docTabsArchiveMode: state.docTabsArchiveMode,
                whiteboardSelectedTaskId: state.whiteboardSelectedTaskId,
                whiteboardMultiSelectedTaskIds: state.whiteboardMultiSelectedTaskIds,
                groupMode: __tmGetCurrentGroupModeValue(), kanbanBoardMode: __tmGetKanbanBoardMode(),
                queryDoneOnly: state.__tmQueryDoneOnly, dateFilter: state.dateFilter };
            if (previous.shortcutContext?.shortcutId !== item.id) {
                globalThis.__tmDateFilter?.clearForContextChange?.();
            }
            const groupChanged = previous.groupId !== item.groupId;
            SettingsStore.data.currentGroupId = item.groupId;
            state.activeDocId = item.docId !== 'all' ? item.docId
                : item.tabGroupId ? __tmBuildDocTabCustomGroupActiveId(item.tabGroupId) : 'all';
            state.shortcutContext = { ...item, groupMode: item.groupMode || previous.groupMode,
                kanbanBoardMode: item.viewId === 'kanban' && item.kanbanBoardMode || previous.kanbanBoardMode,
                shortcutId: item.id, activeDocId: state.activeDocId };
            openingGeneration = request;
            state.openToken = (Number(state.openToken) || 0) + 1;
            const token = state.openToken;
            const isCurrent = () => request === generation && token === state.openToken;
            state.__tmViewSwitchCommitGeneration = (Number(state.__tmViewSwitchCommitGeneration) || 0) + 1;
            state.homepageOpen = item.viewId === 'home';
            state.attachmentLibraryOpen = false;
            if (item.viewId !== 'home') state.viewMode = item.viewId;
            state.viewModeInitialized = true;
            state.searchKeyword = '';
            state.docTabsArchiveMode = false;
            state.whiteboardSelectedTaskId = '';
            state.whiteboardMultiSelectedTaskIds = [];
            __tmApplyCompletedVisibilityToRuntime();
            try {
                const applied = await __tmApplyCurrentContextViewProfile({ skipLocalSync: true });
                if (!isCurrent()) return false;
                let snapshotRestored = false;
                if (groupChanged && !applied.customFieldReloadNeeded) {
                    const cached = await __tmLoadValidatedDocGroupSnapshot({
                        groupId: item.groupId, isCurrent, runtimeMobileFastPath: __tmIsRuntimeMobileClient(),
                    });
                    if (!isCurrent()) return false;
                    if (cached) snapshotRestored = !!globalThis.__tmTaskSnapshotService?.restore?.(cached.snapshot, {
                        groupId: item.groupId, docIds: cached.docIds, taskCountMap: null,
                    });
                }
                if (!snapshotRestored && (groupChanged || applied.customFieldReloadNeeded || !(state.taskTree || []).length)) {
                    const loaded = await loadSelectedDocuments({ source: 'shortcut', showInlineLoading: true,
                        skipSnapshotFirstPaint: true, skipSessionRestoreFirstPaint: true,
                        skipDocSessionRestoreFirstPaint: true, waitWhiteboardInline: item.viewId === 'whiteboard' });
                    if (loaded === false) throw new Error('任务加载失败，请稍后重试');
                } else {
                    if (snapshotRestored) recalcStats();
                    __tmRecomputeTaskProjection({ reason: 'shortcut' });
                    render();
                    if (snapshotRestored) __tmScheduleDocGroupSwitchVerifyAfterFirstPaint({
                        source: 'shortcut:snapshot-verify', scopeVerifyTtlMs: 60000,
                    });
                }
                if (!isCurrent()) return false;
                openingGeneration = 0;
                await persistSession();
                if (!isCurrent()) return false;
                __tmShortcutSidebar.refresh();
                return true;
            } catch (error) {
                if (request !== generation || token !== state.openToken) return false;
                SettingsStore.data.currentGroupId = previous.groupId;
                Object.assign(state, { activeDocId: previous.activeDocId, viewMode: previous.viewMode,
                    currentRule: previous.currentRule, homepageOpen: previous.homepageOpen,
                    shortcutContext: previous.shortcutContext, searchKeyword: previous.searchKeyword,
                    attachmentLibraryOpen: previous.attachmentLibraryOpen, docTabsArchiveMode: previous.docTabsArchiveMode,
                    whiteboardSelectedTaskId: previous.whiteboardSelectedTaskId,
                    whiteboardMultiSelectedTaskIds: previous.whiteboardMultiSelectedTaskIds,
                    __tmQueryDoneOnly: previous.queryDoneOnly, dateFilter: previous.dateFilter });
                globalThis.__tmDateFilter?.refresh?.();
                __tmApplyCompletedVisibilityToRuntime();
                __tmApplyGroupModeToRuntime(previous.groupMode);
                __tmRecomputeTaskProjection({ reason: 'shortcut-rollback' });
                render();
                __tmShortcutSidebar.refresh();
                hint(`打开快捷项失败：${error?.message || error}`, 'error');
                return false;
            } finally {
                if (openingGeneration === request) openingGeneration = 0;
            }
        }
        function filterHomepageTasks(tasks) {
            const value = context();
            return value ? RuleManager.applyRuleFilter(tasks, __tmGetCurrentRule()) : tasks;
        }
        function countKey(item) {
            const rule = rules().find(entry => entry.id === item.ruleId);
            const group = item.groupId === 'all'
                ? [SettingsStore.data.docGroups, SettingsStore.data.selectedDocIds, SettingsStore.data.allDocsExcludedDocIds]
                : SettingsStore.data.docGroups?.find(entry => entry.id === item.groupId);
            const tabGroup = item.tabGroupId ? tabGroups(item.groupId).find(entry => entry.id === item.tabGroupId) : null;
            return JSON.stringify([item.groupId, item.tabGroupId, item.docId, item.viewId, item.ruleId, item.groupMode,
                item.viewId === 'kanban' ? item.kanbanBoardMode : '',
                rule?.enabled, rule?.conditions, group, tabGroup, __tmGetTodayDateKey(),
                SettingsStore.data.excludeCompleted, SettingsStore.data.showCompletedTasksByGroup?.[item.groupId],
                SettingsStore.data.completedTasksTodayOnly, SettingsStore.data.completedTasksInlineInGroups, 'root-tasks-v1']);
        }
        // Count the same projected roots as the topbar and task groups.
        // Remember that exact result; do not run a parallel filtering engine for shortcuts.
        function counts() {
            const result = new Map();
            if (openingGeneration || !Array.isArray(state.filteredTasks) || globalThis.__tmDateFilter?.active()) return result;
            const viewId = state.homepageOpen ? 'home' : state.viewMode;
            for (const item of items()) {
                const activeDocId = item.docId !== 'all' ? item.docId
                    : item.tabGroupId ? __tmBuildDocTabCustomGroupActiveId(item.tabGroupId) : 'all';
                if (item.groupId === (SettingsStore.data.currentGroupId || 'all')
                    && activeDocId === (state.activeDocId || 'all')
                    && item.viewId === viewId && item.ruleId === String(state.currentRule || '')
                    && (!item.groupMode || item.groupMode === __tmGetCurrentGroupModeValue())
                    && (viewId !== 'kanban' || !item.kanbanBoardMode || item.kanbanBoardMode === __tmGetKanbanBoardMode())
                    && !issues(item, false).length) result.set(item.id, __tmGetFilteredTaskDerivedState().rootTasks.length);
            }
            return result;
        }
        return { normalize, items, groups, rules, tabGroups, names, issues, documents, context,
            clearContext, updateContext, restoreSession, activeId, save, open, views, filterHomepageTasks, counts, countKey };
    })();
