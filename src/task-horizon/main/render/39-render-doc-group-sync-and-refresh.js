    function __tmCancelSettingsStorePendingSave() {
        try {
            if (SettingsStore?.saveTimer) {
                clearTimeout(SettingsStore.saveTimer);
                SettingsStore.saveTimer = null;
            }
        } catch (e) {}
        try {
            SettingsStore.saveDirty = false;
            SettingsStore.saving = false;
        } catch (e) {}
        try { SettingsStore.savePromiseResolve?.(); } catch (e) {}
        try {
            SettingsStore.savePromise = null;
            SettingsStore.savePromiseResolve = null;
            SettingsStore.savePromiseReject = null;
        } catch (e) {}
    }

    function __tmCancelSimpleStorePendingSave(store) {
        const target = (store && typeof store === 'object') ? store : null;
        if (!target) return;
        try {
            if (target.saveTimer) {
                clearTimeout(target.saveTimer);
                target.saveTimer = null;
            }
        } catch (e) {}
        try { target.saveDirty = false; } catch (e) {}
    }

    function __tmSafeCloneJson(value, fallback) {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (e) {
            return fallback;
        }
    }

    const __TM_DOC_TOPBAR_SELECT_IDS = new Set([
        'tmTopbarDocQuickSelect',
        'tmTopbarDocSelect',
        'tmMobileDocSelect',
        'tmDesktopDocSelect'
    ]);
    let __tmDocGroupDropdownSyncPromise = null;

    function __tmIsDocTopbarSelectId(id) {
        return __TM_DOC_TOPBAR_SELECT_IDS.has(String(id || '').trim());
    }

    function __tmNormalizeDocIdListForSync(input) {
        const source = Array.isArray(input) ? input : [];
        const out = [];
        const seen = new Set();
        source.forEach((item) => {
            const id = String((typeof item === 'object' ? item?.id : item) || '').trim();
            if (!id || seen.has(id)) return;
            seen.add(id);
            out.push(id);
        });
        return out;
    }

    function __tmNormalizeDefaultDocIdByGroupForSync(input) {
        const source = (input && typeof input === 'object' && !Array.isArray(input)) ? input : {};
        const entries = Object.keys(source).map((key) => {
            return {
                key: String(key || '').trim(),
                value: String(source[key] || '').trim()
            };
        }).filter((item) => item.key && item.value);
        entries.sort((a, b) => a.key.localeCompare(b.key));
        const out = {};
        entries.forEach((item) => {
            out[item.key] = item.value;
        });
        return out;
    }

    function __tmNormalizeDocPinnedByGroupForSync(input) {
        const source = (input && typeof input === 'object' && !Array.isArray(input)) ? input : {};
        const entries = Object.keys(source).map((key) => {
            return {
                key: String(key || '').trim() || 'all',
                value: __tmNormalizeDocIdListForSync(source[key])
            };
        }).filter((item) => item.value.length > 0);
        entries.sort((a, b) => a.key.localeCompare(b.key));
        const out = {};
        entries.forEach((item) => {
            out[item.key] = item.value.slice();
        });
        return out;
    }

    function __tmBuildDocGroupSyncSnapshot(source) {
        const data = (source && typeof source === 'object') ? source : {};
        const fixedGlobalScheme = __tmGetDefaultDocColorSchemeConfig(1);
        const rawGroups = Array.isArray(data.docGroups) ? data.docGroups : [];
        return {
            selectedDocIds: __tmNormalizeDocIdListForSync(data.selectedDocIds),
            defaultDocId: String(data.defaultDocId || '').trim(),
            defaultDocIdByGroup: __tmNormalizeDefaultDocIdByGroupForSync(data.defaultDocIdByGroup),
            allDocsExcludedDocIds: __tmNormalizeDocGroupExcludedDocIds(data.allDocsExcludedDocIds),
            docGroups: rawGroups.map((group) => {
                const normalized = __tmNormalizeDocGroupConfig(group, fixedGlobalScheme);
                if (!normalized) return null;
                return {
                    id: normalized.id,
                    name: String(normalized.name || '').trim(),
                    notebookId: String(normalized.notebookId || '').trim(),
                    docs: (Array.isArray(normalized.docs) ? normalized.docs : []).map((doc) => ({
                        id: String(doc?.id || '').trim(),
                        recursive: !!doc?.recursive
                    })).filter((doc) => doc.id),
                    excludedDocIds: __tmNormalizeDocGroupExcludedDocIds(normalized.excludedDocIds),
                    otherBlockRefs: __tmNormalizeOtherBlockRefs(normalized.otherBlockRefs).map((item) => ({
                        id: String(item?.id || '').trim()
                    })).filter((item) => item.id),
                    docColorConfig: __tmNormalizeDocColorSchemeConfig(normalized.docColorConfig, {
                        allowInherit: true,
                        seedFallback: 1
                    }),
                    calendarSearchOptimization: __tmNormalizeCalendarSearchOptimization(normalized.calendarSearchOptimization)
                };
            }).filter(Boolean),
            otherBlockRefs: __tmNormalizeOtherBlockRefs(data.otherBlockRefs).map((item) => ({
                id: String(item?.id || '').trim()
            })).filter((item) => item.id),
            docPinnedByGroup: __tmNormalizeDocPinnedByGroupForSync(data.docPinnedByGroup)
        };
    }

    function __tmBuildDocGroupSyncFingerprint(source) {
        try {
            return JSON.stringify(__tmBuildDocGroupSyncSnapshot(source));
        } catch (e) {
            return '';
        }
    }

    function __tmGetDocGroupSettingsUpdatedAt(source, options = {}) {
        const explicit = __tmParseUpdatedAtNumber(source?.docGroupSettingsUpdatedAt);
        if (explicit > 0) return explicit;
        if (options?.useSettingsFallback === true) {
            return __tmParseUpdatedAtNumber(options?.fallbackSettingsUpdatedAt);
        }
        return 0;
    }

    function __tmGetDocGroupSnapshotEntryCount(snapshot, groupId = 'all') {
        const data = (snapshot && typeof snapshot === 'object') ? snapshot : {};
        const groups = Array.isArray(data.docGroups) ? data.docGroups : [];
        const gid = String(groupId || 'all').trim() || 'all';
        if (gid === 'all') {
            let count = Array.isArray(data.selectedDocIds) ? data.selectedDocIds.length : 0;
            groups.forEach((group) => {
                count += Array.isArray(group?.docs) ? group.docs.length : 0;
                if (String(group?.notebookId || '').trim()) count += 1;
            });
            return count;
        }
        const group = groups.find((item) => String(item?.id || '').trim() === gid);
        if (!group) return 0;
        return (Array.isArray(group.docs) ? group.docs.length : 0) + (String(group.notebookId || '').trim() ? 1 : 0);
    }

    function __tmIsDocGroupSnapshotEmpty(snapshot) {
        const data = (snapshot && typeof snapshot === 'object') ? snapshot : {};
        if (Array.isArray(data.selectedDocIds) && data.selectedDocIds.length > 0) return false;
        if (String(data.defaultDocId || '').trim()) return false;
        if (data.defaultDocIdByGroup && Object.keys(data.defaultDocIdByGroup).length > 0) return false;
        if (Array.isArray(data.allDocsExcludedDocIds) && data.allDocsExcludedDocIds.length > 0) return false;
        if (Array.isArray(data.otherBlockRefs) && data.otherBlockRefs.length > 0) return false;
        if (data.docPinnedByGroup && Object.keys(data.docPinnedByGroup).some((key) => Array.isArray(data.docPinnedByGroup[key]) && data.docPinnedByGroup[key].length > 0)) {
            return false;
        }
        const groups = Array.isArray(data.docGroups) ? data.docGroups : [];
        return !groups.some((group) => {
            return (Array.isArray(group?.docs) && group.docs.length > 0)
                || !!String(group?.notebookId || '').trim()
                || (Array.isArray(group?.excludedDocIds) && group.excludedDocIds.length > 0)
                || (Array.isArray(group?.otherBlockRefs) && group.otherBlockRefs.length > 0);
        });
    }

    function __tmShouldPreferRemoteDocGroupState(localData, remoteData, options = {}) {
        if (!remoteData || typeof remoteData !== 'object') return false;
        const localFingerprint = __tmBuildDocGroupSyncFingerprint(localData);
        const remoteFingerprint = __tmBuildDocGroupSyncFingerprint(remoteData);
        if (!remoteFingerprint || remoteFingerprint === localFingerprint) return false;
        const localSnapshot = __tmBuildDocGroupSyncSnapshot(localData);
        const remoteSnapshot = __tmBuildDocGroupSyncSnapshot(remoteData);
        if (__tmIsDocGroupSnapshotEmpty(localSnapshot) && !__tmIsDocGroupSnapshotEmpty(remoteSnapshot)) return true;
        const currentGroupId = String(options?.groupId || localData?.currentGroupId || remoteData?.currentGroupId || 'all').trim() || 'all';
        if (__tmGetDocGroupSnapshotEntryCount(localSnapshot, currentGroupId) === 0
            && __tmGetDocGroupSnapshotEntryCount(remoteSnapshot, currentGroupId) > 0) {
            return true;
        }
        const localExplicitUpdatedAt = __tmParseUpdatedAtNumber(localData?.docGroupSettingsUpdatedAt);
        const remoteExplicitUpdatedAt = __tmParseUpdatedAtNumber(remoteData?.docGroupSettingsUpdatedAt);
        if (remoteExplicitUpdatedAt > 0 || localExplicitUpdatedAt > 0) {
            if (remoteExplicitUpdatedAt > localExplicitUpdatedAt) return true;
            if (localExplicitUpdatedAt > remoteExplicitUpdatedAt) return false;
        }
        const localUpdatedAt = __tmGetDocGroupSettingsUpdatedAt(localData, {
            fallbackSettingsUpdatedAt: options?.localSettingsUpdatedAt,
            useSettingsFallback: options?.allowSettingsFallback === true,
        });
        const remoteUpdatedAt = __tmGetDocGroupSettingsUpdatedAt(remoteData, {
            fallbackSettingsUpdatedAt: options?.remoteSettingsUpdatedAt,
            useSettingsFallback: options?.allowSettingsFallback === true,
        });
        if (remoteUpdatedAt > 0 || localUpdatedAt > 0) {
            if (remoteUpdatedAt > localUpdatedAt) return true;
            if (localUpdatedAt > remoteUpdatedAt) return false;
        }
        const localSettingsUpdatedAt = __tmParseUpdatedAtNumber(options?.localSettingsUpdatedAt);
        const remoteSettingsUpdatedAt = __tmParseUpdatedAtNumber(options?.remoteSettingsUpdatedAt);
        return remoteSettingsUpdatedAt > 0
            && localSettingsUpdatedAt > 0
            && remoteSettingsUpdatedAt > localSettingsUpdatedAt;
    }

    function __tmBuildDocScopeFingerprint(docIds, groupId = SettingsStore?.data?.currentGroupId) {
        try {
            const ids = __tmNormalizeDocIdListForSync(docIds).slice().sort((a, b) => a.localeCompare(b));
            return JSON.stringify({
                groupId: String(groupId || 'all').trim() || 'all',
                ids
            });
        } catch (e) {
            return '';
        }
    }

    function __tmApplyDocGroupSyncSnapshot(source, options = {}) {
        const opt = (options && typeof options === 'object') ? options : {};
        const targetData = (opt.targetData && typeof opt.targetData === 'object') ? opt.targetData : SettingsStore?.data;
        if (!targetData) return;
        const snapshot = __tmBuildDocGroupSyncSnapshot(source);
        const seedFallback = Number(targetData?.docColorSeed) || Number(source?.docColorSeed) || 1;
        const globalScheme = __tmNormalizeDocColorSchemeConfig(targetData?.docDefaultColorScheme || source?.docDefaultColorScheme, {
            seedFallback
        });
        targetData.selectedDocIds = snapshot.selectedDocIds.slice();
        targetData.defaultDocId = snapshot.defaultDocId;
        targetData.defaultDocIdByGroup = __tmSafeCloneJson(snapshot.defaultDocIdByGroup, {});
        targetData.allDocsExcludedDocIds = snapshot.allDocsExcludedDocIds.slice();
        targetData.docGroups = snapshot.docGroups
            .map((group) => __tmNormalizeDocGroupConfig(group, globalScheme))
            .filter(Boolean);
        targetData.otherBlockRefs = __tmNormalizeOtherBlockRefs(snapshot.otherBlockRefs);
        targetData.docPinnedByGroup = __tmSafeCloneJson(snapshot.docPinnedByGroup, {});
        const remoteDocGroupUpdatedAt = __tmGetDocGroupSettingsUpdatedAt(source, {
            fallbackSettingsUpdatedAt: source?.settingsUpdatedAt,
            useSettingsFallback: false,
        });
        if (remoteDocGroupUpdatedAt > 0) targetData.docGroupSettingsUpdatedAt = remoteDocGroupUpdatedAt;
        const remoteUpdatedAt = __tmParseUpdatedAtNumber(source?.settingsUpdatedAt);
        if (opt.syncOverallUpdatedAt !== false && remoteUpdatedAt > 0) targetData.settingsUpdatedAt = remoteUpdatedAt;
    }

    function __tmEnsureDocGroupContextValidAfterSync() {
        if (!SettingsStore?.data) return false;
        let changed = false;
        const currentGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        if (currentGroupId !== 'all') {
            const exists = (Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [])
                .some((group) => String(group?.id || '').trim() === currentGroupId);
            if (!exists) {
                SettingsStore.data.currentGroupId = 'all';
                changed = true;
            }
        }
        if (String(SettingsStore.data.currentGroupId || 'all').trim() === 'all' && __tmIsOtherBlockTabId(state.activeDocId)) {
            state.activeDocId = 'all';
            changed = true;
        }
        return changed;
    }

    function __tmEnsureActiveDocValidAfterDocGroupSync() {
        const activeDocId = String(state.activeDocId || 'all').trim() || 'all';
        if (!activeDocId || activeDocId === 'all') return false;
        if (__tmIsOtherBlockTabId(activeDocId)) {
            if (Array.isArray(state.otherBlocks) && state.otherBlocks.length > 0) return false;
            state.activeDocId = 'all';
            return true;
        }
        const validDocIds = new Set(
            (Array.isArray(state.taskTree) ? state.taskTree : [])
                .map((doc) => String(doc?.id || '').trim())
                .filter(Boolean)
        );
        if (validDocIds.has(activeDocId)) return false;
        state.activeDocId = 'all';
        return true;
    }

    async function __tmReloadCurrentDocGroupAfterSync(options = {}) {
        const opt = (options && typeof options === 'object') ? options : {};
        try { await __tmApplyCurrentContextViewProfile(); } catch (e) {}
        try {
            await loadSelectedDocuments({
                skipRender: true,
                showInlineLoading: false,
                skipEmptyDocGroupCloudSync: true,
                forceRefreshScope: opt.forceRefreshScope === true,
                source: String(opt.source || 'doc-group-dropdown-sync').trim() || 'doc-group-dropdown-sync'
            });
        } catch (e) {}
        const activeDocChanged = __tmEnsureActiveDocValidAfterDocGroupSync();
        if (activeDocChanged) {
            try {
                const applied = await __tmApplyCurrentContextViewProfile();
                if (applied?.doneOnlyChanged || applied?.customFieldReloadNeeded) {
                    await loadSelectedDocuments({
                        skipRender: true,
                        showInlineLoading: false,
                        skipEmptyDocGroupCloudSync: true,
                        forceRefreshScope: opt.forceRefreshScope === true,
                        source: `${String(opt.source || 'doc-group-dropdown-sync').trim() || 'doc-group-dropdown-sync'}-active-doc`
                    });
                } else {
                    applyFilters();
                }
            } catch (e) {}
        }
        try { render(); } catch (e) {}
        try {
            if (state.settingsModal && document.body.contains(state.settingsModal)) showSettings();
        } catch (e) {}
    }

    async function __tmSyncRemoteDocGroupSettingsIfNeeded(options = {}) {
        const opt = (options && typeof options === 'object') ? options : {};
        if (!SettingsStore?.data) return false;
        if (__tmDocGroupDropdownSyncPromise) {
            if (opt.silent !== true) {
                try { hint('同步文档分组中，请稍后', 'info'); } catch (e) {}
            }
            return true;
        }
        const localSettingsBusy = !!(SettingsStore.saveDirty || SettingsStore.saving);
        const currentFingerprint = __tmBuildDocGroupSyncFingerprint(SettingsStore.data);
        let remoteSettings = null;
        let remoteFingerprint = '';
        if (!localSettingsBusy) {
            remoteSettings = await __tmReadJsonFile(SETTINGS_FILE_PATH);
            if (remoteSettings && typeof remoteSettings === 'object') {
                remoteFingerprint = __tmBuildDocGroupSyncFingerprint(remoteSettings);
            }
        }
        if (remoteFingerprint && remoteFingerprint !== currentFingerprint) {
            if (opt.silent !== true) {
                try { hint('同步文档分组中，请稍后', 'info'); } catch (e) {}
            }
            const syncPromise = Promise.resolve().then(async () => {
                __tmApplyDocGroupSyncSnapshot(remoteSettings);
                __tmEnsureDocGroupContextValidAfterSync();
                try { SettingsStore.syncToLocal(); } catch (e) {}
                try { __tmDocExpandCache.clear(); } catch (e) {}
                try { __tmResolvedDocIdsCache = null; } catch (e) {}
                try { __tmResolvedDocIdsPromise = null; } catch (e) {}
                await __tmReloadCurrentDocGroupAfterSync({
                    forceRefreshScope: true,
                    source: 'doc-group-dropdown-sync'
                });
            }).catch(() => null).finally(() => {
                if (__tmDocGroupDropdownSyncPromise === syncPromise) {
                    __tmDocGroupDropdownSyncPromise = null;
                }
            });
            __tmDocGroupDropdownSyncPromise = syncPromise;
            return true;
        }

        const currentGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        const loadedScopeFingerprint = __tmBuildDocScopeFingerprint(state.__tmLoadedDocIdsForTasks, currentGroupId);
        let refreshedDocIds = [];
        try {
            refreshedDocIds = await resolveDocIdsFromGroups({
                groupId: currentGroupId,
                forceRefreshScope: true,
            });
        } catch (e) {
            refreshedDocIds = [];
        }
        const refreshedScopeFingerprint = __tmBuildDocScopeFingerprint(refreshedDocIds, currentGroupId);
        if (!refreshedScopeFingerprint || refreshedScopeFingerprint === loadedScopeFingerprint) return false;

        if (opt.silent !== true) {
            try { hint('同步文档分组中，请稍后', 'info'); } catch (e) {}
        }
        const syncPromise = Promise.resolve().then(async () => {
            await __tmReloadCurrentDocGroupAfterSync({
                forceRefreshScope: true,
                source: 'doc-group-dropdown-scope-sync'
            });
        }).catch(() => null).finally(() => {
            if (__tmDocGroupDropdownSyncPromise === syncPromise) {
                __tmDocGroupDropdownSyncPromise = null;
            }
        });
        __tmDocGroupDropdownSyncPromise = syncPromise;
        return true;
    }

    async function __tmSyncRemoteCollapsedSessionStateIfNeeded(options = {}) {
        const opt = (options && typeof options === 'object') ? options : {};
        if (!SettingsStore?.data) return false;
        const remoteSettings = await __tmReadJsonFile(SETTINGS_FILE_PATH);
        if (!remoteSettings || typeof remoteSettings !== 'object') return false;
        const remoteUpdatedAt = __tmGetCollapsedSessionUpdatedAt(remoteSettings);
        const loadedCollapseUpdatedAt = __tmParseUpdatedAtNumber(SettingsStore?.loadedCollapseUpdatedAt);
        if (!opt.force && remoteUpdatedAt > 0 && loadedCollapseUpdatedAt > 0 && remoteUpdatedAt <= loadedCollapseUpdatedAt) {
            return false;
        }
        const localCollapseDirty = __tmGetCollapsedSessionStateFingerprint(SettingsStore.data) !== String(SettingsStore.loadedCollapseFingerprint || '');
        if (localCollapseDirty && opt.forceRemote !== true) return false;
        const currentFingerprint = __tmGetCollapsedSessionStateFingerprint(SettingsStore.data);
        const remoteFingerprint = __tmGetCollapsedSessionStateFingerprint(remoteSettings);
        if (remoteFingerprint === currentFingerprint) {
            try { SettingsStore.refreshCollapsedStateSyncState(remoteUpdatedAt); } catch (e) {}
            return false;
        }

        __tmAssignCollapsedSessionState(SettingsStore.data, remoteSettings);
        SettingsStore.data.collapseStateUpdatedAt = remoteUpdatedAt;
        try { SettingsStore.syncToLocal(); } catch (e) {}
        try { SettingsStore.refreshCollapsedStateSyncState(remoteUpdatedAt); } catch (e) {}
        try { state.collapsedTaskIds = new Set(SettingsStore.data.collapsedTaskIds || []); } catch (e) {}
        try { state.collapsedGroups = new Set(SettingsStore.data.collapsedGroups || []); } catch (e) {}
        try {
            const ids = Array.isArray(SettingsStore.data.kanbanCollapsedTaskIds) ? SettingsStore.data.kanbanCollapsedTaskIds : [];
            state.__tmKanbanCollapsedIds = new Set(ids.map((id) => String(id || '').trim()).filter(Boolean));
        } catch (e) {}

        if (opt.rerender === true && state.modal && document.body.contains(state.modal) && !state.isRefreshing) {
            try { __tmRerenderCurrentViewInPlace(state.modal); } catch (e) {
                try { render(); } catch (e2) {}
            }
        }
        return true;
    }

    function __tmMarkCollapseStateChanged(ts = Date.now()) {
        const nextTs = __tmParseUpdatedAtNumber(ts) || Date.now();
        try { SettingsStore.data.collapseStateUpdatedAt = nextTs; } catch (e) {}
        try { Storage.set('tm_collapse_state_updated_at', nextTs); } catch (e) {}
        return nextTs;
    }

    function __tmCaptureManualRefreshSessionState() {
        return {
            currentGroupId: String(SettingsStore?.data?.currentGroupId || 'all').trim() || 'all',
            currentRule: SettingsStore?.data?.currentRule ?? null,
            collapsedTaskIds: Array.from(state?.collapsedTaskIds || []),
            collapsedGroups: Array.from(state?.collapsedGroups || []),
            kanbanCollapsedTaskIds: Array.isArray(SettingsStore?.data?.kanbanCollapsedTaskIds) ? SettingsStore.data.kanbanCollapsedTaskIds.slice() : [],
            collapseStateUpdatedAt: __tmGetCollapsedSessionUpdatedAt(SettingsStore?.data),
            groupMode: String(SettingsStore?.data?.groupMode || 'none').trim() || 'none',
            groupByDocName: !!SettingsStore?.data?.groupByDocName,
            groupByTime: !!SettingsStore?.data?.groupByTime,
            groupByTaskName: !!SettingsStore?.data?.groupByTaskName,
        };
    }

    function __tmRestoreManualRefreshSessionState(snapshot) {
        const saved = (snapshot && typeof snapshot === 'object') ? snapshot : null;
        if (!saved || !SettingsStore?.data) return;
        SettingsStore.data.currentGroupId = String(saved.currentGroupId || 'all').trim() || 'all';
        SettingsStore.data.currentRule = saved.currentRule ?? null;
        SettingsStore.data.collapsedTaskIds = Array.isArray(saved.collapsedTaskIds) ? saved.collapsedTaskIds.slice() : [];
        SettingsStore.data.collapsedGroups = Array.isArray(saved.collapsedGroups) ? saved.collapsedGroups.slice() : [];
        SettingsStore.data.kanbanCollapsedTaskIds = Array.isArray(saved.kanbanCollapsedTaskIds) ? saved.kanbanCollapsedTaskIds.slice() : [];
        SettingsStore.data.collapseStateUpdatedAt = __tmParseUpdatedAtNumber(saved.collapseStateUpdatedAt)
            || __tmGetCollapsedSessionUpdatedAt(SettingsStore.data);
        SettingsStore.data.groupMode = String(saved.groupMode || 'none').trim() || 'none';
        SettingsStore.data.groupByDocName = !!saved.groupByDocName;
        SettingsStore.data.groupByTime = !!saved.groupByTime;
        SettingsStore.data.groupByTaskName = !!saved.groupByTaskName;
        SettingsStore.normalizeColumns();
        try { SettingsStore.syncToLocal(); } catch (e) {}
        try { SettingsStore.refreshCollapsedStateSyncState(SettingsStore.data.collapseStateUpdatedAt); } catch (e) {}
    }

    function __tmCaptureRefreshUiState() {
        return {
            session: __tmCaptureManualRefreshSessionState(),
            viewMode: String(state.viewMode || 'list').trim() || 'list',
            viewModeInitialized: state.viewModeInitialized === true,
            activeDocId: String(state.activeDocId || 'all').trim() || 'all',
            detailTaskId: String(state.detailTaskId || '').trim(),
            checklistDetailSheetOpen: !!state.checklistDetailSheetOpen,
            checklistDetailDismissed: !!state.checklistDetailDismissed,
            kanbanDetailTaskId: String(state.kanbanDetailTaskId || '').trim(),
            kanbanDetailAnchorTaskId: String(state.kanbanDetailAnchorTaskId || '').trim(),
            multiSelectModeEnabled: !!state.multiSelectModeEnabled,
            multiSelectedTaskIds: Array.isArray(state.multiSelectedTaskIds) ? state.multiSelectedTaskIds.slice() : [],
            multiBulkEditFieldKey: String(state.multiBulkEditFieldKey || '').trim(),
            docTabsHidden: !!state.docTabsHidden,
            homepageOpen: !!state.homepageOpen,
            aiSidebarOpen: !!state.aiSidebarOpen,
            aiMobilePanelOpen: !!state.aiMobilePanelOpen,
            calendarDockDate: String(state.calendarDockDate || '').trim(),
            listRenderLimit: Number(state.listRenderLimit) || 100,
            listRenderStep: Number(state.listRenderStep) || 100,
            viewScroll: __tmCloneHostSessionValue(state.viewScroll || {}),
        };
    }

    function __tmRestoreRefreshUiState(snapshot) {
        const saved = (snapshot && typeof snapshot === 'object') ? snapshot : null;
        if (!saved) return;
        try { __tmRestoreManualRefreshSessionState(saved.session); } catch (e) {}
        try { state.collapsedTaskIds = new Set(saved?.session?.collapsedTaskIds || []); } catch (e) {}
        try { state.collapsedGroups = new Set(saved?.session?.collapsedGroups || []); } catch (e) {}
        try {
            const ids = Array.isArray(saved?.session?.kanbanCollapsedTaskIds) ? saved.session.kanbanCollapsedTaskIds : [];
            state.__tmKanbanCollapsedIds = new Set(ids.map((id) => String(id || '').trim()).filter(Boolean));
        } catch (e) {}
        state.viewMode = String(saved.viewMode || state.viewMode || 'list').trim() || 'list';
        state.viewModeInitialized = saved.viewModeInitialized === true;
        state.activeDocId = String(saved.activeDocId || 'all').trim() || 'all';
        state.detailTaskId = String(saved.detailTaskId || '').trim();
        state.checklistDetailSheetOpen = !!saved.checklistDetailSheetOpen;
        state.checklistDetailDismissed = !!saved.checklistDetailDismissed;
        state.kanbanDetailTaskId = String(saved.kanbanDetailTaskId || '').trim();
        state.kanbanDetailAnchorTaskId = String(saved.kanbanDetailAnchorTaskId || '').trim();
        state.multiSelectModeEnabled = !!saved.multiSelectModeEnabled;
        state.multiSelectedTaskIds = Array.isArray(saved.multiSelectedTaskIds)
            ? saved.multiSelectedTaskIds.map((id) => String(id || '').trim()).filter(Boolean)
            : [];
        state.multiBulkEditFieldKey = String(saved.multiBulkEditFieldKey || '').trim();
        state.docTabsHidden = !!saved.docTabsHidden;
        state.homepageOpen = !!saved.homepageOpen;
        state.aiSidebarOpen = !!saved.aiSidebarOpen;
        state.aiMobilePanelOpen = !!saved.aiMobilePanelOpen;
        state.calendarDockDate = String(saved.calendarDockDate || '').trim();
        state.listRenderLimit = Number(saved.listRenderLimit) || 100;
        state.listRenderStep = Number(saved.listRenderStep) || 100;
        state.viewScroll = __tmCloneHostSessionValue(saved.viewScroll || {});
    }

    function __tmClearAutoRefreshDirtyFlags() {
        try { state.quickbarModifiedTaskIds?.clear?.(); } catch (e) {}
        state.quickbarModifiedTaskIdsLoaded = true;
        try { localStorage.removeItem('__tmQuickbarModifiedTasks'); } catch (e) {}
        state.externalTaskTxDirty = false;
        state.lastExternalTaskTxTime = 0;
        __tmClearPendingTxRefreshTargets();
    }

    function __tmIsTaskHorizonTabActiveNow() {
        try {
            const header = __tmFindExistingTaskManagerTab?.();
            if (!(header instanceof HTMLElement)) return false;
            if (!__tmIsTaskHorizonTabHeaderEl(header)) return false;
            const cls = String(header.className || '');
            const ariaSelected = String(header.getAttribute?.('aria-selected') || '').trim();
            return header.classList?.contains?.('item--focus')
                || /\bitem--focus\b/.test(cls)
                || /\bis-active\b/.test(cls)
                || /\bactive\b/.test(cls)
                || ariaSelected === 'true';
        } catch (e) {
            return false;
        }
    }

    async function __tmMaybeSyncServerSharedStateOnManualRefresh() {
        if (SettingsStore?.data?.serverSyncOnManualRefresh !== true) return false;
        const keepSessionState = SettingsStore?.data?.serverSyncSessionStateOnManualRefresh !== true;
        const sessionSnapshot = keepSessionState ? __tmCaptureManualRefreshSessionState() : null;
        try { await SettingsStore.saveNow?.(); } catch (e) {}
        try { await MetaStore.saveNow?.(); } catch (e) {}
        try { await WhiteboardStore.saveNow?.(); } catch (e) {}
        try { await SemanticDateRecognizedStore.saveNow?.(); } catch (e) {}
        __tmCancelSettingsStorePendingSave();
        __tmCancelSimpleStorePendingSave(MetaStore);
        __tmCancelSimpleStorePendingSave(WhiteboardStore);
        __tmCancelSimpleStorePendingSave(SemanticDateRecognizedStore);
        try { SettingsStore.loaded = false; } catch (e) {}
        try { MetaStore.loaded = false; } catch (e) {}
        try { WhiteboardStore.loaded = false; } catch (e) {}
        try { SemanticDateRecognizedStore.loaded = false; } catch (e) {}
        try { SemanticDateRecognizedStore.loadingPromise = null; } catch (e) {}
        await SettingsStore.load();
        if (keepSessionState) __tmRestoreManualRefreshSessionState(sessionSnapshot);
        await MetaStore.load();
        await WhiteboardStore.load();
        await SemanticDateRecognizedStore.load();
        try { __tmApplyAppearanceThemeVars(); } catch (e) {}
        try {
            if (globalThis.__tmCalendar && typeof globalThis.__tmCalendar.setSettingsStore === 'function') {
                globalThis.__tmCalendar.setSettingsStore(SettingsStore);
            }
        } catch (e) {}
        try { __tmDispatchDockSettingsChanged('manual-refresh-server-sync'); } catch (e) {}
        try { __tmRefreshShellEntrances(); } catch (e) {}
        try {
            if (state.settingsModal && document.body.contains(state.settingsModal)) showSettings();
        } catch (e) {}
        return true;
    }

    async function __tmRefreshCore(options = {}) {
        const opt = (options && typeof options === 'object') ? options : {};
        const silent = opt.silent === true;
        const reason = String(opt.reason || 'manual').trim() || 'manual';
        const preserveUi = opt.preserveUi !== false;
        if (state.isRefreshing) return false;
        const startedAt = __tmPerfNow();
        try {
            __tmPushRefreshDebug('refresh-core:start', {
                reason,
                silent,
                preserveUi,
                viewMode: String(state.viewMode || '').trim() || '',
            });
        } catch (e) {}

        state.openToken = (Number(state.openToken) || 0) + 1;
        const refreshToken = Number(state.openToken) || 0;
        const snapshot = preserveUi ? __tmCaptureRefreshUiState() : null;
        const mode = String(state.viewMode || '').trim();
        let _refreshHint = null;
        if (!silent) _refreshHint = hint('🔄 正在刷新...', 'info');

        state.isRefreshing = true;
        try {
            if (preserveUi && state.modal instanceof HTMLElement && document.body.contains(state.modal)) {
                try {
                    __tmSetInlineLoading(true, {
                        token: refreshToken,
                        styleKind: 'topbar',
                        delayMs: 0,
                    });
                } catch (e) {}
            }
            try { await __tmWaitForQueuedOpsIdle(900); } catch (e) {}
            try { __tmInvalidateAllSqlCaches(); } catch (e) {}
            try { window.__tmCalendarAllTasksCache = null; } catch (e) {}
            const syncedServerState = await __tmMaybeSyncServerSharedStateOnManualRefresh();
            await __tmFlushSqlTransactionsSafe(`refresh-core:${reason}`);
            await loadSelectedDocuments({
                skipRender: true,
                showInlineLoading: false,
                forceFreshTasks: true,
                source: `refresh-core:${reason}`,
            });

            if (preserveUi && snapshot) {
                try { __tmRestoreRefreshUiState(snapshot); } catch (e) {}
                try { applyFilters(); } catch (e) {}
            }
            try {
                await __tmSyncRemoteCollapsedSessionStateIfNeeded({
                    forceRemote: syncedServerState === true,
                });
            } catch (e) {}

            let removedCount = 0;
            try {
                removedCount = Number(await __tmSyncWhiteboardFrozenTasksWithLiveTasks()) || 0;
            } catch (e) {}
            if (removedCount > 0) {
                try { applyFilters(); } catch (e) {}
            }

            if (opt.deferIfDetailBusy !== false) {
                const barrier = __tmGetBusyTaskDetailBarrier();
                if (barrier) {
                    try {
                        __tmPushDetailDebug('detail-host-refresh-core-deferred', {
                            reason,
                            silent,
                            preserveUi,
                            barrier: barrier.entries.map((entry) => ({
                                scope: entry.scope,
                                taskId: entry.taskId,
                                reasons: entry.reasons.slice(),
                                holdMsLeft: entry.holdMsLeft,
                            })),
                        });
                    } catch (e) {}
                    return false;
                }
            }

            if (mode === 'calendar' && globalThis.__tmCalendar && (typeof globalThis.__tmCalendar.requestRefresh === 'function' || typeof globalThis.__tmCalendar.refreshInPlace === 'function')) {
                try {
                    __tmRequestCalendarRefresh({
                        reason: `refresh-core:${reason}`,
                        main: true,
                        side: true,
                        flushTaskPanel: true,
                        hard: true,
                    }, { hard: true });
                } catch (e) { try { render(); } catch (e2) {} }
            } else {
                try {
                    __tmRefreshMainViewInPlace({
                        withFilters: false,
                        reason: `refresh-core:${reason}`,
                    });
                } catch (e) {
                    try { render(); } catch (e2) {}
                }
            }

            try { __tmClearAutoRefreshDirtyFlags(); } catch (e) {}

            if (!silent) {
                __tmRemoveHint(_refreshHint);
                const syncedLabel = syncedServerState ? '，已同步伺服共享配置' : '';
                hint(removedCount > 0 ? `✅ 刷新完成${syncedLabel}，已清理冻结任务 ${removedCount} 项` : `✅ 刷新完成${syncedLabel}`, 'success');
            }
            try {
                __tmPushRefreshDebug('refresh-core:end', {
                    reason,
                    ok: true,
                    silent,
                    preserveUi,
                    durationMs: __tmRoundPerfMs(__tmPerfNow() - startedAt),
                    removedCount,
                });
            } catch (e) {}
            return true;
        } catch (e) {
            if (!silent) {
                __tmRemoveHint(_refreshHint);
                hint(`❌ 刷新失败: ${e.message}`, 'error');
            }
            try {
                __tmPushRefreshDebug('refresh-core:end', {
                    reason,
                    ok: false,
                    silent,
                    preserveUi,
                    durationMs: __tmRoundPerfMs(__tmPerfNow() - startedAt),
                    error: String(e?.message || e || ''),
                });
            } catch (e2) {}
            return false;
        } finally {
            state.isRefreshing = false;
            try { __tmSetInlineLoading(false); } catch (e) {}
            try { __tmFlushDeferredViewRefreshAfterTaskFieldWork(`refresh-core:${reason}:end`); } catch (e2) {}
        }
    }

    window.tmRefreshCalendarInPlace = async function(options = {}) {
        const opt = (options && typeof options === 'object') ? options : {};
        try { window.__tmCalendarAllTasksCache = null; } catch (e) {}
        try { window.__tmCalendarDocsToGroupCache = null; } catch (e) {}
        try { window.__tmCalendarSidebarDocItemsCache = null; } catch (e) {}
        if (__tmRequestCalendarRefresh({
            reason: 'manual-calendar-light',
            main: true,
            side: true,
            flushTaskPanel: true,
            hard: opt.hard === true,
            layoutOnly: opt.layoutOnly === true,
        }, {
            hard: opt.hard === true,
            layoutOnly: opt.layoutOnly === true,
        })) {
            if (opt.silent !== true) {
                try { hint('✅ 日历已刷新', 'success'); } catch (e) {}
            }
            return true;
        }
        return await __tmRefreshCore({
            silent: opt.silent === true,
            reason: 'manual-calendar',
            preserveUi: true,
        });
    };

    window.tmRefresh = async function() {
        return await __tmRefreshCore({
            silent: false,
            reason: 'manual',
            preserveUi: true,
        });
    };

    window.tmToggleTimelineMode = function() {
        const next = state.viewMode === 'timeline' ? 'list' : 'timeline';
        return window.tmSwitchViewMode(next);
    };

    window.tmToggleKanbanMode = function() {
        const next = state.viewMode === 'kanban' ? 'list' : 'kanban';
        return window.tmSwitchViewMode(next);
    };

    window.tmToggleCalendarMode = function() {
        const next = state.viewMode === 'calendar' ? 'list' : 'calendar';
        return window.tmSwitchViewMode(next);
    };

    window.tmToggleWhiteboardMode = function() {
        const next = state.viewMode === 'whiteboard' ? 'list' : 'whiteboard';
        return window.tmSwitchViewMode(next);
    };

    window.tmCalendarToggleSidebar = function() {
        try {
            if (state.viewMode !== 'calendar') return;
            if (!globalThis.__tmCalendar || typeof globalThis.__tmCalendar.toggleSidebar !== 'function') return;
            globalThis.__tmCalendar.toggleSidebar();
        } catch (e) {}
    };



