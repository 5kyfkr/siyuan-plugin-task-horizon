    // 重新计算统计信息
    function recalcStats() {
        let total = 0, done = 0;
        if (__tmIsOtherBlockTabId(state.activeDocId)) {
            const otherBlocks = Array.isArray(state.otherBlocks) ? state.otherBlocks : [];
            total = otherBlocks.length;
            done = otherBlocks.filter((task) => {
                try {
                    return typeof __tmIsTaskDoneEffective === 'function'
                        ? __tmIsTaskDoneEffective(task)
                        : !!task?.done;
                } catch (e) {
                    return !!task?.done;
                }
            }).length;
            state.stats.totalTasks = total;
            state.stats.doneTasks = done;
            state.stats.todoTasks = Math.max(0, total - done);
            try { __tmScheduleHomepageRefresh('stats-recalc-other'); } catch (e) {}
            return;
        }
        const traverse = (tasks) => {
            tasks.forEach(task => {
                total++;
                const taskDone = typeof __tmIsTaskDoneEffective === 'function'
                    ? __tmIsTaskDoneEffective(task)
                    : task.done === true;
                if (taskDone) done++;
                if (task.children && task.children.length > 0) {
                    traverse(task.children);
                }
            });
        };
        state.taskTree.forEach(doc => {
            traverse(doc.tasks);
        });
        state.stats.totalTasks = total;
        state.stats.doneTasks = done;
        state.stats.todoTasks = Math.max(0, total - done);
        try { __tmScheduleHomepageRefresh('stats-recalc'); } catch (e) {}
    }

    function __tmNormalizeDocGroupLoaderEntry(entry) {
        const source = (entry && typeof entry === 'object') ? entry : {};
        const id = String((typeof entry === 'object' ? source.id : entry) || '').trim();
        if (!id) return null;
        const kind = String(source.kind || 'doc').trim() || 'doc';
        return {
            id,
            kind,
            recursive: !!source.recursive,
            calendarOptimization: __tmNormalizeCalendarSearchOptimization(source.calendarOptimization),
            excludedDocIds: __tmNormalizeDocGroupExcludedDocIds(source.excludedDocIds)
        };
    }

    function __tmNormalizeDocGroupLoaderIds(docIds = []) {
        if (typeof __tmNormalizeDocScopeDocIds === 'function') return __tmNormalizeDocScopeDocIds(docIds);
        const out = [];
        const seen = new Set();
        (Array.isArray(docIds) ? docIds : []).forEach((id0) => {
            const id = String(id0 || '').trim();
            if (!id || seen.has(id)) return;
            seen.add(id);
            out.push(id);
        });
        return out;
    }

    function __tmBuildDocGroupLoaderSourceEntries(groupId, groups, currentGroup) {
        const gid = String(groupId || 'all').trim() || 'all';
        const out = [];
        if (gid === 'all') {
            (Array.isArray(SettingsStore?.data?.selectedDocIds) ? SettingsStore.data.selectedDocIds : [])
                .forEach((id) => out.push({ id, kind: 'doc', recursive: false }));
            (Array.isArray(groups) ? groups : []).forEach((group) => {
                out.push(...__tmGetGroupSourceEntries(group));
            });
        } else if (currentGroup) {
            out.push(...__tmGetGroupSourceEntries(currentGroup));
        }
        const normalized = out.map(__tmNormalizeDocGroupLoaderEntry).filter(Boolean);
        const sorted = __tmSortDocEntriesByPinned(normalized, gid);
        return sorted;
    }

    function __tmBuildDocGroupLoaderContext(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const groups = Array.isArray(SettingsStore?.data?.docGroups) ? SettingsStore.data.docGroups : [];
        const groupId = String(opts.groupId ?? SettingsStore?.data?.currentGroupId ?? 'all').trim() || 'all';
        const group = groupId === 'all'
            ? null
            : groups.find((item) => String(item?.id || '').trim() === groupId) || null;
        const includeQuickAddDoc = opts.includeQuickAddDoc !== false;
        const quickAddDocId = includeQuickAddDoc ? String(SettingsStore?.data?.newTaskDocId || '').trim() : '';
        const excludedDocIds = __tmNormalizeDocGroupExcludedDocIds(__tmGetExcludedDocIdsForGroup(groupId));
        const otherBlockRefs = groupId === 'all' ? [] : __tmNormalizeOtherBlockRefs(__tmGetOtherBlockRefsByGroup(groupId));
        const otherBlockRefsSig = otherBlockRefs.map((item) => item.id).join(',');
        const pinnedSig = __tmGetDocPinnedIdsForGroup(groupId).join(',');
        const entries = __tmBuildDocGroupLoaderSourceEntries(groupId, groups, group);
        const groupCalendarOptimization = group ? __tmGetGroupCalendarSearchOptimization(group) : __tmNormalizeCalendarSearchOptimization(null);
        const recursiveDocLimit = Number.isFinite(Number(SettingsStore?.data?.recursiveDocLimit))
            ? Math.max(1, Math.min(500000, Math.round(Number(SettingsStore.data.recursiveDocLimit))))
            : 2000;
        const entrySig = entries.map((entry) => {
            const cal = __tmNormalizeCalendarSearchOptimization(entry.calendarOptimization);
            return [
                String(entry.kind || 'doc').trim() || 'doc',
                String(entry.id || '').trim(),
                entry.recursive ? 1 : 0,
                cal.enabled ? 1 : 0,
                Number(cal.days) || 0,
                __tmNormalizeDocGroupExcludedDocIds(entry.excludedDocIds).join(',')
            ].join(':');
        }).join('|');
        const legacyCompat = SettingsStore?.data?.legacyWin7CompatMode === true ? 1 : 0;
        const scopeKey = [
            'doc-group-scope-v3',
            groupId,
            `compat${legacyCompat}`,
            includeQuickAddDoc ? quickAddDocId : '',
            excludedDocIds.join(','),
            otherBlockRefsSig,
            pinnedSig,
            recursiveDocLimit,
            groupCalendarOptimization.enabled ? 1 : 0,
            Number(groupCalendarOptimization.days) || 0,
            entrySig
        ].join('|');
        return {
            opts,
            groupId,
            group,
            groups,
            includeQuickAddDoc,
            quickAddDocId,
            excludedDocIds,
            excludedDocIdSet: new Set(excludedDocIds),
            otherBlockRefs,
            entries,
            scopeKey,
            memoryKey: scopeKey,
            forceRefreshScope: !!opts.forceRefreshScope,
            skipPersistedScope: !!opts.skipPersistedScope,
            skipResolvedDocIdsCache: !!opts.skipResolvedDocIdsCache,
            verifyCachedScope: opts.verifyCachedScope !== false,
        };
    }

    function __tmRememberDocGroupResolvedScope(ctx, ids, cacheSource = 'fresh') {
        const out = __tmNormalizeDocGroupLoaderIds(ids);
        const entry = {
            key: ctx.memoryKey,
            ids: out.slice(),
            t: Date.now(),
            source: String(cacheSource || 'fresh').trim() || 'fresh',
            groupId: ctx.groupId,
        };
        __tmResolvedDocIdsCache = entry;
        try { __tmRememberSmallCache(__tmResolvedDocIdsCacheMap, ctx.memoryKey, entry, 24); } catch (e) {}
        try { __tmRememberDocScope(ctx.scopeKey, out, { groupId: ctx.groupId }); } catch (e) {}
        try {
            state.__tmLastDocGroupScopeLoad = {
                groupId: ctx.groupId,
                docCount: out.length,
                source: entry.source,
                updatedAt: entry.t,
            };
        } catch (e) {}
        return out;
    }

    function __tmGetDocGroupResolvedMemoryCache(ctx) {
        const ttlMs = Number(__TM_RESOLVED_DOC_IDS_CACHE_TTL_MS) || (10 * 60 * 1000);
        const now = Date.now();
        const mapEntry = __tmResolvedDocIdsCacheMap instanceof Map ? __tmResolvedDocIdsCacheMap.get(ctx.memoryKey) : null;
        if (mapEntry && Array.isArray(mapEntry.ids) && (now - Number(mapEntry.t || 0)) < ttlMs) {
            return mapEntry.ids.slice();
        }
        const lastEntry = __tmResolvedDocIdsCache;
        if (lastEntry && lastEntry.key === ctx.memoryKey && Array.isArray(lastEntry.ids) && (now - Number(lastEntry.t || 0)) < ttlMs) {
            return lastEntry.ids.slice();
        }
        return null;
    }

    function __tmFilterDocGroupExcludedIds(ids, ctx) {
        const list = Array.isArray(ids) ? ids : [];
        if (!ctx.excludedDocIdSet || ctx.excludedDocIdSet.size === 0) return __tmNormalizeDocGroupLoaderIds(list);
        return __tmNormalizeDocGroupLoaderIds(list.filter((id0) => !ctx.excludedDocIdSet.has(String(id0 || '').trim())));
    }

    async function __tmResolveOtherBlockSourceDocIdsForDocGroup(ctx) {
        const refs = Array.isArray(ctx.otherBlockRefs) ? ctx.otherBlockRefs : [];
        if (!refs.length) return [];
        let rows = [];
        try { rows = await API.getOtherBlocksByIds(refs.map((item) => item.id)); } catch (e) { rows = []; }
        const rowsById = new Map();
        (Array.isArray(rows) ? rows : []).forEach((row) => {
            const id = String(row?.id || '').trim();
            if (id && !rowsById.has(id)) rowsById.set(id, row);
        });
        const orderedRows = [];
        refs.forEach((ref) => {
            const row = rowsById.get(String(ref?.id || '').trim());
            if (row) orderedRows.push(row);
        });
        (Array.isArray(rows) ? rows : []).forEach((row) => {
            if (!orderedRows.includes(row)) orderedRows.push(row);
        });
        try {
            if (ctx.groupId !== 'all' && typeof __tmRememberOtherBlockSourceDocs === 'function') {
                __tmRememberOtherBlockSourceDocs(ctx.groupId, orderedRows);
                if (!state.otherBlockSourceDocRefsSigByGroup || typeof state.otherBlockSourceDocRefsSigByGroup !== 'object') {
                    state.otherBlockSourceDocRefsSigByGroup = {};
                }
                state.otherBlockSourceDocRefsSigByGroup[ctx.groupId] = refs.map((item) => item.id).join(',');
            }
        } catch (e) {}
        const docIds = [];
        orderedRows.forEach((row) => {
            if (typeof __tmCanResolveOtherBlockSourceDoc === 'function'
                ? !__tmCanResolveOtherBlockSourceDoc(row?.type, row?.subtype)
                : !__tmIsSupportedOtherBlockType(row?.type, row?.subtype)) return;
            const type = String(row?.type || '').trim().toLowerCase();
            const docId = type === 'd'
                ? String(row?.id || row?.root_id || '').trim()
                : String(row?.root_id || '').trim();
            if (docId) docIds.push(docId);
        });
        return __tmNormalizeDocGroupLoaderIds(docIds);
    }

    async function __tmResolveDocGroupFreshIds(ctx) {
        const collectedIds = [];
        const collectedSeen = new Set();
        const pushCollectedId = (id0) => {
            const id = String(id0 || '').trim();
            if (!id || collectedSeen.has(id)) return;
            collectedSeen.add(id);
            collectedIds.push(id);
        };
        if (ctx.quickAddDocId
            && ctx.quickAddDocId !== '__dailyNote__'
            && !ctx.excludedDocIdSet.has(ctx.quickAddDocId)) {
            pushCollectedId(ctx.quickAddDocId);
        }
        const expandedByEntry = await Promise.all((Array.isArray(ctx.entries) ? ctx.entries : []).map(async (entry) => {
            const entryIds = [];
            try {
                await __tmExpandSourceEntryDocIds(entry, (id) => {
                    const docId = String(id || '').trim();
                    if (docId) entryIds.push(docId);
                });
            } catch (e) {}
            return entryIds;
        }));
        expandedByEntry.forEach((entryIds) => {
            (Array.isArray(entryIds) ? entryIds : []).forEach(pushCollectedId);
        });
        let out = collectedIds.slice();
        if (ctx.groupId !== 'all' && ctx.group) {
            try {
                const optimized = await __tmApplyCalendarSearchOptimizationToDocIds(out, ctx.group);
                out = Array.isArray(optimized) ? optimized.slice() : out;
            } catch (e) {}
        }
        const outSeen = new Set(out.map((id) => String(id || '').trim()).filter(Boolean));
        const otherBlockDocIds = await __tmResolveOtherBlockSourceDocIdsForDocGroup(ctx);
        otherBlockDocIds.forEach((docId) => {
            if (!docId || outSeen.has(docId)) return;
            outSeen.add(docId);
            out.push(docId);
        });
        const filtered = __tmFilterDocGroupExcludedIds(out, ctx);
        return filtered;
    }

    function __tmScheduleDocGroupScopeVerification(ctx, options, cachedIds, reason = 'doc-scope-cache-corrected') {
        if (!ctx.verifyCachedScope) return false;
        try {
            const opts = (options && typeof options === 'object') ? options : {};
            const cached = Array.isArray(cachedIds) ? cachedIds.slice() : [];
            __tmScheduleIdleTask(() => {
                resolveDocIdsFromGroups({
                    ...opts,
                    groupId: ctx.groupId,
                    forceRefreshScope: false,
                    skipPersistedScope: true,
                    skipResolvedDocIdsCache: true,
                    verifyCachedScope: false,
                    preferFastScope: false,
                }).then((freshIds) => {
                    const fresh = Array.isArray(freshIds) ? freshIds : [];
                    if (__tmHashIds(fresh) === __tmHashIds(cached)) return;
                    if (String(SettingsStore?.data?.currentGroupId || 'all').trim() !== ctx.groupId) return;
                    try {
                        loadSelectedDocuments({
                            preferFastFirstPaint: true,
                            skipSnapshotFirstPaint: true,
                            taskIndexFirstPaintCachedOnly: false,
                            refreshAfterTaskIndexFirstPaint: true,
                            forceFastFirstPaintBudget: true,
                            showInlineLoading: false,
                            source: reason,
                        }).catch(() => null);
                    } catch (e) {}
                }).catch(() => null);
            }, 900);
            return true;
        } catch (e) {
            return false;
        }
    }

    // 解析文档分组中的所有文档ID
    async function resolveDocIdsFromGroups(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const ctx = __tmBuildDocGroupLoaderContext(opts);
        if (ctx.forceRefreshScope) {
            try { __tmDocExpandCache.clear(); } catch (e) {}
            try { __tmResolvedDocIdsCacheMap.clear(); } catch (e) {}
            try { __tmResolvedDocIdsCache = null; } catch (e) {}
            try { __tmResolvedDocIdsPromise = null; } catch (e) {}
        }
        if (!ctx.skipResolvedDocIdsCache) {
            const cachedMemory = __tmGetDocGroupResolvedMemoryCache(ctx);
            if (cachedMemory) {
                return cachedMemory.slice();
            }
            if (__tmResolvedDocIdsPromise && __tmResolvedDocIdsPromise.key === ctx.memoryKey && __tmResolvedDocIdsPromise.promise) {
                const pendingIds = await __tmResolvedDocIdsPromise.promise;
                return Array.isArray(pendingIds) ? pendingIds.slice() : [];
            }
        }
        if (!ctx.forceRefreshScope && !ctx.skipPersistedScope) {
            try {
                if (typeof __tmLoadDocScopeCacheStore === 'function') await __tmLoadDocScopeCacheStore();
            } catch (e) {}
            const scopeCache = __tmGetCachedDocScope(ctx.scopeKey);
            if (scopeCache && Array.isArray(scopeCache.docIds) && scopeCache.docIds.length > 0) {
                const ids = __tmRememberDocGroupResolvedScope(ctx, scopeCache.docIds, 'persisted');
                __tmScheduleDocGroupScopeVerification(ctx, opts, ids, 'doc-scope-cache-corrected');
                return ids.slice();
            }
        }
        const resolvePromise = Promise.resolve().then(async () => {
            const fresh = await __tmResolveDocGroupFreshIds(ctx);
            return __tmRememberDocGroupResolvedScope(ctx, fresh, 'fresh');
        });
        __tmResolvedDocIdsPromise = { key: ctx.memoryKey, promise: resolvePromise };
        try {
            const ids = await resolvePromise;
            return Array.isArray(ids) ? ids.slice() : [];
        } finally {
            if (__tmResolvedDocIdsPromise && __tmResolvedDocIdsPromise.key === ctx.memoryKey) {
                __tmResolvedDocIdsPromise = null;
            }
        }
    }

    function __tmScheduleResolvedDocIdsPrewarm(options = {}) {
        try {
            const opts = (options && typeof options === 'object') ? options : {};
            const delayMs = Math.max(120, Number(opts.delayMs || 360) || 360);
            if (__tmResolvedDocIdsPrewarmState.timer || __tmResolvedDocIdsPrewarmState.running) return false;
            __tmResolvedDocIdsPrewarmState.timer = setTimeout(() => {
                __tmResolvedDocIdsPrewarmState.timer = null;
                if (__tmResolvedDocIdsPrewarmState.running) return;
                __tmResolvedDocIdsPrewarmState.running = true;
                Promise.resolve()
                    .then(async () => {
                        const groups = Array.isArray(SettingsStore?.data?.docGroups) ? SettingsStore.data.docGroups : [];
                        const currentGroupId = String(SettingsStore?.data?.currentGroupId || 'all').trim() || 'all';
                        const groupIds = ['all']
                            .concat(groups.map((group) => String(group?.id || '').trim()).filter(Boolean))
                            .filter((gid, idx, arr) => arr.indexOf(gid) === idx)
                            .sort((a, b) => {
                                if (a === currentGroupId) return -1;
                                if (b === currentGroupId) return 1;
                                if (a === 'all') return -1;
                                if (b === 'all') return 1;
                                return 0;
                            });
                        for (const gid of groupIds.slice(0, 12)) {
                            try {
                                await resolveDocIdsFromGroups({
                                    groupId: gid,
                                    includeQuickAddDoc: true,
                                });
                            } catch (e) {}
                        }
                    })
                    .catch(() => null)
                    .finally(() => {
                        __tmResolvedDocIdsPrewarmState.running = false;
                    });
            }, delayMs);
            return true;
        } catch (e) {
            return false;
        }
    }

    function isVerifyRawTaskSignatureSourceTask(task) {
        if (!task || typeof task !== 'object') return false;
        try { if (__tmIsCollectedOtherBlockTask(task)) return false; } catch (e) {}
        try { if (__tmIsRecurringInstanceTask(task)) return false; } catch (e) {}
        return true;
    }

    function buildVerifyRawTaskSignatureFromTasks(tasks) {
        try {
            const list = Array.isArray(tasks) ? tasks : [];
            const rows = [];
            list.forEach((task) => {
                if (!isVerifyRawTaskSignatureSourceTask(task)) return;
                const id = String(task.id || task.blockId || '').trim();
                if (!id) return;
                rows.push([
                    id,
                    String(task.blockId || '').trim(),
                    String(task.markdown || task.content || task.text || '').trim(),
                    String(task.updated || task.updatedAt || '').trim(),
                    String(task.root_id || task.docId || '').trim(),
                ].join('\u0001'));
            });
            rows.sort();
            return JSON.stringify(rows);
        } catch (e) {
            return '';
        }
    }

    function buildVerifyRawTaskRowsFromSignature(signature) {
        try {
            const rows = JSON.parse(String(signature || '[]'));
            return Array.isArray(rows) ? rows : [];
        } catch (e) {
            return [];
        }
    }

    function summarizeVerifyRawTaskSignatureDiff(beforeSignature, afterSignature) {
        try {
            const beforeRows = buildVerifyRawTaskRowsFromSignature(beforeSignature);
            const afterRows = buildVerifyRawTaskRowsFromSignature(afterSignature);
            const maxLen = Math.max(beforeRows.length, afterRows.length);
            let firstDiffIndex = -1;
            for (let i = 0; i < maxLen; i += 1) {
                if (String(beforeRows[i] || '') !== String(afterRows[i] || '')) {
                    firstDiffIndex = i;
                    break;
                }
            }
            const getId = (row) => String(row || '').split('\u0001')[0] || '';
            return {
                beforeCount: beforeRows.length,
                afterCount: afterRows.length,
                firstDiffIndex,
                beforeId: firstDiffIndex >= 0 ? getId(beforeRows[firstDiffIndex]) : '',
                afterId: firstDiffIndex >= 0 ? getId(afterRows[firstDiffIndex]) : '',
            };
        } catch (e) {
            return {};
        }
    }

    function buildVerifyRawTaskSignature(taskMap) {
        try {
            const map = (taskMap && typeof taskMap === 'object') ? taskMap : {};
            return buildVerifyRawTaskSignatureFromTasks(Object.keys(map).map((id) => map[id]));
        } catch (e) {
            return '';
        }
    }

    function buildVerifyTaskSignature(taskMap) {
        try {
            const map = (taskMap && typeof taskMap === 'object') ? taskMap : {};
            const rows = [];
            Object.keys(map).sort().forEach((id0) => {
                const id = String(id0 || '').trim();
                const task = id ? map[id] : null;
                if (!task || typeof task !== 'object') return;
                const childIds = (Array.isArray(task.children) ? task.children : [])
                    .map((item) => String(item?.id || item?.blockId || '').trim())
                    .filter(Boolean)
                    .join(',');
                rows.push([
                    id,
                    String(task.blockId || '').trim(),
                    String(task.content || task.markdown || task.text || '').trim(),
                    (typeof __tmIsTaskDoneEffective === 'function' ? __tmIsTaskDoneEffective(task) : task.done === true) ? 1 : 0,
                    task.pinned ? 1 : 0,
                    String(task.startDate || task.start_date || '').trim(),
                    String(task.completionTime || task.completion_time || task.taskCompleteAt || '').trim(),
                    String(task.customTime || task.custom_time || '').trim(),
                    String(task.taskCompleteAt || task.task_complete_at || '').trim(),
                    String(task.created || '').trim(),
                    String(task.updated || task.updatedAt || '').trim(),
                    String(task.root_id || task.docId || '').trim(),
                    String(task.docName || '').trim(),
                    String(task.parentTaskId || '').trim(),
                    String(task.h2 || '').trim(),
                    String(task.h2Id || '').trim(),
                    String(task.remark || '').trim(),
                    String(task.duration || '').trim(),
                    String(task.priority || '').trim(),
                    String(task.customStatus || task.status || '').trim(),
                    String(task.customFields ? JSON.stringify(task.customFields) : '').trim(),
                    Number.isFinite(Number(task.level)) ? Number(task.level) : '',
                    Number.isFinite(Number(task.docSeq)) ? Number(task.docSeq) : '',
                    childIds,
                ].join('\u0001'));
            });
            return JSON.stringify(rows);
        } catch (e) {
            return '';
        }
    }

    function buildVerifyDocSignature() {
        try {
            const docRows = (Array.isArray(state.taskTree) ? state.taskTree : []).map((doc) => {
                const docId = String(doc?.id || '').trim();
                const taskIds = [];
                const collect = (items) => {
                    (Array.isArray(items) ? items : []).forEach((task) => {
                        const id = String(task?.id || task?.blockId || '').trim();
                        if (id) taskIds.push(id);
                        if (Array.isArray(task?.children) && task.children.length > 0) collect(task.children);
                    });
                };
                collect(doc?.tasks);
                return [
                    docId,
                    String(doc?.name || '').trim(),
                    String(doc?.alias || '').trim(),
                    String(doc?.icon || '').trim(),
                    String(doc?.created || '').trim(),
                    String(doc?.updated || doc?.docUpdated || '').trim(),
                    taskIds.join(','),
                ].join('\u0001');
            }).sort();
            const loadedDocRows = (Array.isArray(state.allDocuments) ? state.allDocuments : []).map((doc) => [
                String(doc?.id || '').trim(),
                String(doc?.name || '').trim(),
                String(doc?.alias || '').trim(),
                String(doc?.icon || '').trim(),
                String(doc?.created || '').trim(),
                String(doc?.updated || doc?.docUpdated || '').trim(),
            ].join('\u0001')).sort();
            return JSON.stringify({
                selected: (Array.isArray(state.selectedDocIds) ? state.selectedDocIds : []).map((id) => String(id || '').trim()).filter(Boolean).sort(),
                loaded: (Array.isArray(state.__tmLoadedDocIdsForTasks) ? state.__tmLoadedDocIdsForTasks : []).map((id) => String(id || '').trim()).filter(Boolean).sort(),
                taskTree: docRows,
                docs: loadedDocRows,
                otherBlocks: (Array.isArray(state.otherBlocks) ? state.otherBlocks : [])
                    .map((block) => String(block?.id || block?.blockId || '').trim())
                    .filter(Boolean)
                    .sort(),
            });
        } catch (e) {
            return '';
        }
    }

    // 加载所有选中文档的任务（带递归支持）
    async function loadSelectedDocuments(options = {}) {
        try { __tmHydrateOpQueue(); } catch (e) {}
        const runtimeState = globalThis.__tmRuntimeState;
        const token = runtimeState?.getOpenToken?.() ?? (Number(state.openToken) || 0);
        const isTokenCurrent = () => runtimeState?.isCurrentOpenToken?.(token) ?? (token === (Number(state.openToken) || 0));
        const getActiveModal = () => runtimeState?.getModal?.() || state.modal;
        const getCurrentViewMode = (fallback = '') => runtimeState?.getViewMode?.(fallback) || String(state.viewMode || '').trim() || String(fallback || '').trim();
        const skipRender = !!(options && options.skipRender);
        const showInlineLoading = !skipRender && !(options && options.showInlineLoading === false);
        const preferFastFirstPaint = !!(options && options.preferFastFirstPaint);
        const skipSnapshotFirstPaint = !!(options && options.skipSnapshotFirstPaint === true);
        const snapshotFirstPaintCachedOnly = !!(options && options.snapshotFirstPaintCachedOnly === true);
        const taskIndexFirstPaintCachedOnly = !!(options && options.taskIndexFirstPaintCachedOnly === true);
        const skipTaskIndexFirstPaint = !!(options && options.skipTaskIndexFirstPaint === true);
        const skipSessionRestoreFirstPaint = !!(options && options.skipSessionRestoreFirstPaint === true);
        const skipDocSessionRestoreFirstPaint = !!(options && options.skipDocSessionRestoreFirstPaint === true);
        const forceFastFirstPaintBudget = !!(options && options.forceFastFirstPaintBudget === true);
        const forceFreshTasks = !!(options && options.forceFreshTasks === true);
        const forceSyncFlowRank = !!(options && options.forceSyncFlowRank === true);
        const forceFullLoadBudget = !!(options && options.forceFullLoadBudget);
        const forceShellRender = !!(options && options.forceShellRender === true);
        const refreshAfterTaskIndexFirstPaint = !!(options && options.refreshAfterTaskIndexFirstPaint === true);
        const waitForDocScopeResolve = !!(options && options.waitForDocScopeResolve === true);
        const skipFullLoadAfterFastFirstPaint = !!(options && options.skipFullLoadAfterFastFirstPaint === true);
        const skipTaskIndexWarmup = !!(options && options.skipTaskIndexWarmup === true);
        const skipSiblingRankFirstPaint = !!(options && options.skipSiblingRankFirstPaint === true);
        const parentLookupDepthOption = Object.prototype.hasOwnProperty.call(options || {}, 'parentLookupDepth')
            ? Number(options.parentLookupDepth)
            : Number.NaN;
        const perfTuning = __tmGetPerfTuningOptions();
        const perfTrace = (options && options.perfTrace) || __tmCreatePerfTrace('loadSelectedDocuments', {
            source: String(options?.source || 'direct').trim() || 'direct',
            token,
            skipRender: skipRender ? 1 : 0,
            forceFreshTasks: forceFreshTasks ? 1 : 0,
            runtimeMobile: (globalThis.__tmRuntimeHost?.getInfo?.()?.runtimeMobileClient ?? __tmIsRuntimeMobileClient()) ? 1 : 0,
            viewMode: getCurrentViewMode('list'),
            perfReadRepeatAttrsInline: perfTuning.readRepeatAttrsInline ? 1 : 0,
            perfDisableSiblingRank: perfTuning.disableSiblingRank ? 1 : 0,
            perfDeferRecurringReconcile: perfTuning.deferRecurringReconcile ? 1 : 0,
        });
        const sourceLabel = String(options?.source || 'direct').trim() || 'direct';
        const isSwitchDocGroupLoad = sourceLabel === 'switch-doc-group'
            || sourceLabel === 'legacy-switch-doc-group'
            || sourceLabel.startsWith('switch-doc-group:')
            || sourceLabel.startsWith('legacy-switch-doc-group:');
        const isSnapshotCacheVerifyLoad = skipRender
            && forceFreshTasks
            && sourceLabel.indexOf('snapshot-cache:verify') !== -1;
        const snapshotCacheVerifyGroupId = isSnapshotCacheVerifyLoad
            ? (String(SettingsStore?.data?.currentGroupId || 'all').trim() || 'all')
            : '';
        const getCacheVerifyRawSignatureForGroup = (groupId) => {
            try {
                const gid = String(groupId || 'all').trim() || 'all';
                const map = state.__tmLastCacheVerifyRawTaskSignatureByGroup;
                if (map && typeof map === 'object' && !Array.isArray(map)) return String(map[gid] || '').trim();
            } catch (e) {}
            return '';
        };
        const setCacheVerifyRawSignatureForGroup = (groupId, signature, candidate = false) => {
            try {
                const gid = String(groupId || 'all').trim() || 'all';
                const value = String(signature || '').trim();
                if (!value) return;
                const key = candidate
                    ? '__tmLastCacheVerifyRawTaskSignatureCandidateByGroup'
                    : '__tmLastCacheVerifyRawTaskSignatureByGroup';
                if (!state[key] || typeof state[key] !== 'object' || Array.isArray(state[key])) state[key] = {};
                state[key][gid] = value;
            } catch (e) {}
        };
        const snapshotCacheVerifyBefore = isSnapshotCacheVerifyLoad
            ? {
                groupId: snapshotCacheVerifyGroupId,
                activeDocId: String(state.activeDocId || 'all').trim() || 'all',
                viewMode: getCurrentViewMode(''),
                currentRule: String(state.currentRule || '').trim(),
                searchKeyword: String(state.searchKeyword || '').trim(),
                showCompletedTasks: state.showCompletedTasks === true ? 1 : 0,
                completedTasksTodayOnly: SettingsStore?.data?.completedTasksTodayOnly === true ? 1 : 0,
                completedTasksInlineInGroups: SettingsStore?.data?.completedTasksInlineInGroups === true ? 1 : 0,
                docTabsArchiveMode: state.docTabsArchiveMode === true ? 1 : 0,
                groupByDocName: state.groupByDocName === true ? 1 : 0,
                groupByTaskName: state.groupByTaskName === true ? 1 : 0,
                groupByTime: state.groupByTime === true ? 1 : 0,
                quadrantEnabled: state.quadrantEnabled === true ? 1 : 0,
                listRenderSignature: String(state.listRenderSignature || ''),
                listRenderLimit: Number(state.listRenderLimit) || 0,
                listRenderStep: Number(state.listRenderStep) || 0,
                filteredTaskIds: (Array.isArray(state.filteredTasks) ? state.filteredTasks : [])
                    .map((task) => String(task?.id || task?.blockId || '').trim())
                    .filter(Boolean),
                filteredDocIdsForTabs: (Array.isArray(state.filteredDocIdsForTabs) ? state.filteredDocIdsForTabs : [])
                    .map((id) => String(id || '').trim())
                    .filter(Boolean),
                rawTaskSignature: getCacheVerifyRawSignatureForGroup(snapshotCacheVerifyGroupId) || buildVerifyRawTaskSignature(state.flatTasks),
                taskSignature: buildVerifyTaskSignature(state.flatTasks),
                docSignature: buildVerifyDocSignature(),
            }
            : null;
        if (isSnapshotCacheVerifyLoad) {
            try { state.__tmLastCacheVerifyContextChanged = null; } catch (e) {}
        }
        const snapshotCacheVerifyContextSkipReasons = {
            'group-changed': true,
            'active-doc-changed': true,
            'view-mode-changed': true,
            'rule-changed': true,
            'search-changed': true,
            'completed-toggle-changed': true,
            'completed-today-only-changed': true,
            'completed-inline-groups-changed': true,
            'archive-mode-changed': true,
            'group-doc-changed': true,
            'group-task-changed': true,
            'group-time-changed': true,
            'quadrant-changed': true,
        };
        const getSnapshotCacheVerifyContextChangeReason = () => {
            if (!snapshotCacheVerifyBefore) return '';
            try {
                const currentGroupIdForVerify = String(SettingsStore?.data?.currentGroupId || 'all').trim() || 'all';
                if (currentGroupIdForVerify !== snapshotCacheVerifyBefore.groupId) return 'group-changed';
                if ((String(state.activeDocId || 'all').trim() || 'all') !== snapshotCacheVerifyBefore.activeDocId) return 'active-doc-changed';
                if (getCurrentViewMode('') !== snapshotCacheVerifyBefore.viewMode) return 'view-mode-changed';
                if (String(state.currentRule || '').trim() !== snapshotCacheVerifyBefore.currentRule) return 'rule-changed';
                if (String(state.searchKeyword || '').trim() !== snapshotCacheVerifyBefore.searchKeyword) return 'search-changed';
                if ((state.showCompletedTasks === true ? 1 : 0) !== snapshotCacheVerifyBefore.showCompletedTasks) return 'completed-toggle-changed';
                if ((SettingsStore?.data?.completedTasksTodayOnly === true ? 1 : 0) !== snapshotCacheVerifyBefore.completedTasksTodayOnly) return 'completed-today-only-changed';
                if ((SettingsStore?.data?.completedTasksInlineInGroups === true ? 1 : 0) !== snapshotCacheVerifyBefore.completedTasksInlineInGroups) return 'completed-inline-groups-changed';
                if ((state.docTabsArchiveMode === true ? 1 : 0) !== snapshotCacheVerifyBefore.docTabsArchiveMode) return 'archive-mode-changed';
                if ((state.groupByDocName === true ? 1 : 0) !== snapshotCacheVerifyBefore.groupByDocName) return 'group-doc-changed';
                if ((state.groupByTaskName === true ? 1 : 0) !== snapshotCacheVerifyBefore.groupByTaskName) return 'group-task-changed';
                if ((state.groupByTime === true ? 1 : 0) !== snapshotCacheVerifyBefore.groupByTime) return 'group-time-changed';
                if ((state.quadrantEnabled === true ? 1 : 0) !== snapshotCacheVerifyBefore.quadrantEnabled) return 'quadrant-changed';
            } catch (e) {}
            return '';
        };
        const abortSnapshotCacheVerifyIfContextChanged = (stage, payload = {}) => {
            if (!isSnapshotCacheVerifyLoad) return false;
            const reason = getSnapshotCacheVerifyContextChangeReason();
            if (!snapshotCacheVerifyContextSkipReasons[reason]) return false;
            state.__tmLastCacheVerifyContextChanged = {
                at: Date.now(),
                source: sourceLabel,
                reason,
                stage: String(stage || '').trim() || 'unknown',
                groupId: snapshotCacheVerifyBefore.groupId,
                currentGroupId: String(SettingsStore?.data?.currentGroupId || 'all').trim() || 'all',
            };

            return true;
        };
        const stabilizeSwitchGroupView = isSwitchDocGroupLoad
            && !skipRender
            && options?.allowPostSwitchRenderRefresh !== true;
        const stableSwitchNeedsCompleteLoad = stabilizeSwitchGroupView
            && options?.allowStableSwitchFastBudget !== true;
        const switchGroupRenderCap = Math.max(40, Math.min(3000, Math.round(Number(options?.switchGroupRenderCap || 1200) || 1200)));
        const prepareSwitchGroupFirstPaintWindow = () => {
            if (!isSwitchDocGroupLoad || skipRender) return;
            try {
                state.listRenderStep = stabilizeSwitchGroupView ? switchGroupRenderCap : 20;
                const filteredCount = Array.isArray(state.filteredTasks) ? state.filteredTasks.length : 0;
                const renderLimit = stabilizeSwitchGroupView ? switchGroupRenderCap : 40;
                state.listRenderLimit = filteredCount > 0 ? Math.min(renderLimit, filteredCount) : renderLimit;
            } catch (e) {}
        };
        const viewNeedsCompleteVisibleDateAttrs = () => {
            try {
                const viewMode = getCurrentViewMode('');
                if (viewMode === 'timeline' || viewMode === 'checklist') return true;
                if (state.groupByTime || state.quadrantEnabled) return true;
                const colOrder = Array.isArray(SettingsStore?.data?.columnOrder) ? SettingsStore.data.columnOrder : [];
                if (colOrder.some((col) => ['startDate', 'completionTime', 'taskCompleteAt', 'customTime', 'remainingTime'].includes(String(col || '').trim()))) return true;
                const rule = state.currentRule ? (Array.isArray(state.filterRules) ? state.filterRules.find((item) => item?.id === state.currentRule) : null) : null;
                const usesTimeField = (item) => ['startDate', 'completionTime', 'taskCompleteAt', 'customTime', 'remainingTime', 'duration'].includes(String(item?.field || '').trim());
                if ((Array.isArray(rule?.conditions) && rule.conditions.some(usesTimeField))
                    || (Array.isArray(rule?.sort) && rule.sort.some(usesTimeField))) return true;
            } catch (e) {}
            return false;
        };
        const yieldToBrowser = () => new Promise((resolve) => {
            try { setTimeout(resolve, 0); } catch (e) { resolve(); }
        });
        let perfFinished = false;
        const finishPerfTrace = (detail = {}) => {
            if (perfFinished) return;
            perfFinished = true;
            __tmPerfTraceFinish(perfTrace, detail);
        };
        const scheduleFullLoadAfterFastFirstPaint = (reason = 'fast-first-paint') => {
            if (!preferFastFirstPaint || forceFullLoadBudget || forceFreshTasks || skipRender) return false;
            if (skipFullLoadAfterFastFirstPaint) return false;
            if (stabilizeSwitchGroupView) {
                return false;
            }
            if (state.__tmFastFirstPaintFullLoadScheduled
                && Number(state.__tmFastFirstPaintFullLoadScheduledToken || 0) === token) {
                return false;
            }
            state.__tmFastFirstPaintFullLoadScheduled = true;
            state.__tmFastFirstPaintFullLoadScheduledToken = token;
            const baseSource = String(options?.source || reason || 'fast-first-paint').trim() || 'fast-first-paint';
            const run = () => {
                if (Number(state.__tmFastFirstPaintFullLoadScheduledToken || 0) === token) {
                    state.__tmFastFirstPaintFullLoadScheduled = false;
                    state.__tmFastFirstPaintFullLoadScheduledToken = 0;
                }
                if (!isTokenCurrent()) return;
                const nextOptions = {
                    ...options,
                    preferFastFirstPaint: false,
                    forceFullLoadBudget: false,
                    forceFreshTasks: true,
                    skipSnapshotFirstPaint: true,
                    skipTaskIndexFirstPaint: true,
                    taskIndexFirstPaintCachedOnly: false,
                    refreshAfterTaskIndexFirstPaint: false,
                    skipSessionRestoreFirstPaint: true,
                    skipDocSessionRestoreFirstPaint: true,
                    forceFastFirstPaintBudget: false,
                    showInlineLoading: false,
                    source: `${baseSource}:full`,
                };
                try { delete nextOptions.perfTrace; } catch (e) {}
                loadSelectedDocuments(nextOptions).catch(() => null);
            };
            const delayedFullLoadMs = Math.max(0, Number(options?.fullLoadAfterFastFirstPaintDelayMs || 0) || 0);
            if (delayedFullLoadMs > 0) {
                setTimeout(() => {
                    try { __tmScheduleIdleTask(run, 900); } catch (e) { setTimeout(run, 0); }
                }, delayedFullLoadMs);
            } else {
                try { __tmScheduleIdleTask(run, 240); } catch (e) { setTimeout(run, 240); }
            }
            return true;
        };
        const scheduleSilentVerifyAfterCacheFirstPaint = (reason = 'cache-first-paint', meta = {}) => {
            try {
                if (isSwitchDocGroupLoad) return false;
                if (typeof __tmScheduleSilentCacheVerifyAfterFirstPaint !== 'function') return false;
                const cleanReason = String(reason || 'cache-first-paint').trim() || 'cache-first-paint';
                const baseSource = isSwitchDocGroupLoad
                    ? `switch-doc-group:${cleanReason}`
                    : `${String(sourceLabel || 'load-selected-documents').trim() || 'load-selected-documents'}:${cleanReason}`;
                return __tmScheduleSilentCacheVerifyAfterFirstPaint({
                    source: baseSource,
                    delayMs: Number(meta?.delayMs || 0) || (isSwitchDocGroupLoad ? 320 : 520),
                });
            } catch (e) {
                return false;
            }
        };
        let inlineLoadingWatchdogTimer = 0;
        const clearInlineLoadingWatchdog = () => {
            if (!inlineLoadingWatchdogTimer) return;
            try { clearTimeout(inlineLoadingWatchdogTimer); } catch (e) {}
            inlineLoadingWatchdogTimer = 0;
        };
        const clearInlineLoadingForCurrentToken = () => {
            if (!showInlineLoading || Number(state.uiInlineLoadingToken) !== token) return false;
            try {
                __tmSetInlineLoading(false);
                return true;
            } catch (e) {
                return false;
            }
        };
        const armInlineLoadingWatchdog = () => {
            const defaultWatchdogMs = sourceLabel === 'openManager' ? 18000 : 30000;
            const watchdogMs = Math.max(6000, Math.min(60000, Math.round(Number(options?.loadingWatchdogMs) || defaultWatchdogMs)));
            inlineLoadingWatchdogTimer = setTimeout(() => {
                inlineLoadingWatchdogTimer = 0;
                if (!isTokenCurrent()) return;
                if (Number(state.uiInlineLoadingToken) !== token) return;
                const recovered = clearInlineLoadingForCurrentToken();
                try {
                    __tmPerfTraceMark(perfTrace, 'inline-loading-watchdog', {
                        source: sourceLabel,
                        token,
                        recovered: recovered ? 1 : 0,
                        hasTaskData: __tmHasTaskDataReadyForUi() ? 1 : 0,
                    });
                } catch (e) {}
                if (sourceLabel !== 'openManager' || __tmHasTaskDataReadyForUi()) return;
                try {
                    if (runtimeState && typeof runtimeState.nextOpenToken === 'function') {
                        runtimeState.nextOpenToken();
                    } else {
                        state.openToken = (Number(state.openToken) || 0) + 1;
                    }
                } catch (e) {
                    state.openToken = (Number(state.openToken) || 0) + 1;
                }
                try {
                    loadSelectedDocuments({
                        skipRender: false,
                        preferFastFirstPaint: false,
                        forceFreshTasks: true,
                        skipSnapshotFirstPaint: true,
                        skipTaskIndexFirstPaint: true,
                        skipSessionRestoreFirstPaint: true,
                        skipDocSessionRestoreFirstPaint: true,
                        showInlineLoading: true,
                        loadingStyleKind: 'topbar',
                        loadingDelayMs: 0,
                        loadingWatchdogMs: 30000,
                        source: 'openManager-watchdog-retry',
                    }).catch(() => null);
                } catch (e) {}
            }, watchdogMs);
        };
        if (showInlineLoading) {
            try {
                __tmSetInlineLoading(true, {
                    token,
                    styleKind: options?.loadingStyleKind,
                    delayMs: Number(options?.loadingDelayMs),
                });
                armInlineLoadingWatchdog();
            } catch (e) {}
        }
        try {
        try { state.doneOverrides = {}; } catch (e) {}
        // 加载设置（包括文档ID列表）
        await __tmEnsureSettingsLoaded();
        __tmPerfTraceMark(perfTrace, 'settings', {
            preferFastFirstPaint: preferFastFirstPaint ? 1 : 0,
            source: String(options?.source || 'direct').trim() || 'direct',
        });
        const waitNotebookCache = !!(options && options.waitNotebookCache === true);
        if (waitNotebookCache) {
            try { await __tmRefreshNotebookCache(); } catch (e) {}
        } else {
            try { __tmRefreshNotebookCache().catch(() => null); } catch (e) {}
        }
        try { __tmScheduleWarmDocScopeCache(0); } catch (e) {}
        try { __tmBindSqlCacheInvalidation(); } catch (e) {}
        try {
            if (globalThis.__tmCalendar && typeof globalThis.__tmCalendar.setSettingsStore === 'function') {
                globalThis.__tmCalendar.setSettingsStore(SettingsStore);
            }
        } catch (e) {}
        try { globalThis.__taskHorizonQuickbarToggle?.(!!SettingsStore.data.enableQuickbar); } catch (e) {}
        const currentGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        const currentOtherBlockRefs = currentGroupId === 'all' ? [] : __tmGetOtherBlockRefsByGroup(currentGroupId);
        const allowDeferredBootWork = !skipRender;
        const shouldLoadWhiteboardInline = !allowDeferredBootWork || (runtimeState?.isViewMode?.('whiteboard') ?? (String(state.viewMode || '').trim() === 'whiteboard'));
        const shouldLoadOtherBlocksInline = !isSnapshotCacheVerifyLoad
            && (!allowDeferredBootWork || __tmIsOtherBlockTabId(state.activeDocId));
        const shouldLoadMetaInline = !allowDeferredBootWork;
        const shouldLoadMetaLater = allowDeferredBootWork && !MetaStore.loaded;
        const shouldLoadWhiteboardLater = allowDeferredBootWork && !shouldLoadWhiteboardInline && !WhiteboardStore.loaded;
        const waitWhiteboardInline = !!(options && options.waitWhiteboardInline === true);
        let otherBlocksLoadedSynchronously = false;
        const loadOtherBlocksNow = async () => {
            try { await __tmMigrateLegacyOtherBlockRefsToGroups({ groupId: currentGroupId, persist: true }); } catch (e) {}
            try { await __tmLoadCollectedOtherBlocks(); } catch (e) { state.otherBlocks = []; }
            if (__tmIsOtherBlockTabId(state.activeDocId) && !(Array.isArray(state.otherBlocks) && state.otherBlocks.length)) {
                state.activeDocId = 'all';
            }
        };
        if (shouldLoadMetaInline) {
            const metaLoadStart = Date.now();
            await MetaStore.load();
        }
        if (shouldLoadWhiteboardInline) {
            const whiteboardLoadStart = Date.now();
            if (waitWhiteboardInline) {
                await WhiteboardStore.load();
            } else {
                try { WhiteboardStore.load().catch(() => null); } catch (e) {}
            }
        }
        if (shouldLoadOtherBlocksInline) {
            const otherBlocksLoadStart = Date.now();
            await loadOtherBlocksNow();
            otherBlocksLoadedSynchronously = true;
        } else if (!isSnapshotCacheVerifyLoad) {
            state.otherBlocks = [];
        } else {
        }
        const quickAddDocId = String(SettingsStore.data.newTaskDocId || '').trim();

        // 将设置同步到 state
        state.selectedDocIds = SettingsStore.data.selectedDocIds;
        state.queryLimit = __TM_TASK_INDEX_QUERY_LIMIT;
        state.recursiveDocLimit = SettingsStore.data.recursiveDocLimit;
        const gm0 = String(SettingsStore.data.groupMode || '').trim();
        const validModes = new Set(['none', 'doc', 'time', 'quadrant', 'task']);
        if (!validModes.has(gm0)) {
            // groupMode 无效时，根据标志位推导模式
            state.groupByDocName = SettingsStore.data.groupByDocName;
            state.groupByTaskName = SettingsStore.data.groupByTaskName;
            state.groupByTime = SettingsStore.data.groupByTime;
            state.quadrantEnabled = SettingsStore.data.quadrantConfig?.enabled || false;
        }
        // 根据 groupMode 设置标志位，但 groupByTaskName 只在 groupMode === 'task' 时才设置为 true
        if (gm0 === 'doc') {
            state.groupByDocName = true;
            state.groupByTime = false;
            state.quadrantEnabled = false;
        } else if (gm0 === 'time') {
            state.groupByDocName = false;
            state.groupByTime = true;
            state.quadrantEnabled = false;
        } else if (gm0 === 'task') {
            state.groupByDocName = false;
            state.groupByTaskName = true;
            state.groupByTime = false;
            state.quadrantEnabled = false;
        } else if (gm0 === 'quadrant') {
            state.groupByDocName = false;
            state.groupByTime = false;
            state.quadrantEnabled = true;
        } else {
            // 当 groupMode 为 'none' 时（用户选择了"不分组"），将 state.groupByTaskName 设置为 false
            // 这样可以正确显示"不分组"选项为选中状态
            // 注意：这里不检查 SettingsStore.data.groupByTaskName，因为它只控制开关显示，不影响当前分组模式
            state.groupByDocName = false;
            state.groupByTaskName = false;
            state.groupByTime = false;
            state.quadrantEnabled = false;
        }
        state.collapsedTaskIds = new Set(SettingsStore.data.collapsedTaskIds || []);
        state.collapsedGroups = new Set(SettingsStore.data.collapsedGroups || []);
        state.expandedCompletedGroups = new Set(SettingsStore.data.expandedCompletedGroups || []);
        state.currentRule = SettingsStore.data.currentRule;
        state.columnWidths = SettingsStore.data.columnWidths;
        try { __tmNormalizeCompletedVisibilitySettings(SettingsStore.data); } catch (e) {}
        state.showCompletedTasks = !!SettingsStore.data.showCompletedTasks;
        state.excludeCompletedTasks = !state.showCompletedTasks;

        // 加载筛选规则
        state.filterRules = await __tmEnsureFilterRulesLoaded();
        const currentRule = state.currentRule ? state.filterRules.find(r => r.id === state.currentRule) : null;
        const bulkCustomFieldPlan = __tmCollectCustomFieldLoadPlan({
            viewMode: state.viewMode,
            colOrder: Array.isArray(SettingsStore.data.columnOrder) ? SettingsStore.data.columnOrder : [],
            rule: currentRule,
        });
        state.deferredListCustomFieldIds = getCurrentViewMode('') === 'list'
            ? bulkCustomFieldPlan.deferredListFieldIds.slice()
            : [];
        state.__tmQueryDoneOnly = !!(currentRule && currentRule.conditions && currentRule.conditions.some(c => c && c.field === 'done' && c.operator === '=' && (c.value === true || String(c.value) === 'true' || c.value === '') && String(c.value) !== '__all__'));

        // 1. 解析所有需要查询的文档ID
        const resolveScopeOptions = {
            forceRefreshScope: !!state.isRefreshing || !!(options && options.forceRefreshScope === true),
            skipPersistedScope: isSwitchDocGroupLoad,
            skipResolvedDocIdsCache: false,
            verifyCachedScope: !isSwitchDocGroupLoad,
            preferFastScope: !isSwitchDocGroupLoad && !!preferFastFirstPaint && !forceFreshTasks && !state.isRefreshing,
        };
        let allDocIds = [];
        allDocIds = await resolveDocIdsFromGroups(resolveScopeOptions);
        const otherBlockDocIdSet = new Set();
        (Array.isArray(state.otherBlocks) ? state.otherBlocks : []).forEach((task) => {
            const docId = String(task?.root_id || task?.docId || '').trim();
            if (docId) otherBlockDocIdSet.add(docId);
        });
        if (currentGroupId !== 'all' && Array.isArray(currentOtherBlockRefs) && currentOtherBlockRefs.length > 0) {
            let rows = [];
            try { rows = await API.getOtherBlocksByIds(currentOtherBlockRefs.map((item) => item.id)); } catch (e) { rows = []; }
            (Array.isArray(rows) ? rows : []).forEach((row) => {
                if (typeof __tmCanResolveOtherBlockSourceDoc === 'function'
                    ? !__tmCanResolveOtherBlockSourceDoc(row?.type, row?.subtype)
                    : !__tmIsSupportedOtherBlockType(row?.type, row?.subtype)) return;
                const type = String(row?.type || '').trim().toLowerCase();
                const docId = type === 'd'
                    ? String(row?.id || row?.root_id || '').trim()
                    : String(row?.root_id || '').trim();
                if (docId) otherBlockDocIdSet.add(docId);
            });
        }
        state.__tmLoadedDocIdsForTasks = Array.isArray(allDocIds) ? allDocIds.slice() : [];
        __tmPerfTraceMark(perfTrace, 'docs', {
            docCount: Array.isArray(allDocIds) ? allDocIds.length : 0,
            groupId: currentGroupId,
        });
        const taskIndexDocUpdatedMap = __tmBuildDocUpdatedFingerprintMap(state.allDocuments);
        let taskCountMapLoadPromise = null;
        let taskCountMapMeta = null;
        const ensureTaskCountMapForCacheRestore = async (reason = 'cache-restore') => {
            if (taskCountMapMeta) return taskCountMapMeta;
            const ids = Array.isArray(allDocIds) ? allDocIds.slice() : [];
            if (!ids.length || !API || typeof API.getTaskCountsByDocuments !== 'function') {
                taskCountMapMeta = { map: new Map(), queryTime: 0, unavailable: 1 };
                return taskCountMapMeta;
            }
            if (!taskCountMapLoadPromise) {
                const countStartedAt = Date.now();
                taskCountMapLoadPromise = API.getTaskCountsByDocuments(ids)
                    .then((meta) => {
                        const map = meta?.map instanceof Map ? meta.map : new Map();
                        const out = {
                            map,
                            queryTime: Number(meta?.queryTime || 0) || (Date.now() - countStartedAt),
                        };
                        return out;
                    })
                    .catch(() => ({ map: new Map(), queryTime: 0, unavailable: 1 }));
            }
            taskCountMapMeta = await taskCountMapLoadPromise;
            return taskCountMapMeta;
        };
        let snapshotFirstRenderCommitted = false;
        if (preferFastFirstPaint && !skipSnapshotFirstPaint && !skipRender && !forceFullLoadBudget && !forceFreshTasks && !stableSwitchNeedsCompleteLoad) {
            try {
                const countMeta = await ensureTaskCountMapForCacheRestore('snapshot-cache');
                const snapshotService = globalThis.__tmTaskSnapshotService || null;
                try { await snapshotService?.refreshCache?.({ source: 'snapshot-first-paint' }); } catch (e) {}
                const snapshot = await snapshotService?.load?.({
                    docIds: allDocIds,
                    groupId: currentGroupId,
                    cachedOnly: snapshotFirstPaintCachedOnly,
                });
                const snapshotMeta = snapshotService?.restore?.(snapshot, {
                    docIds: allDocIds,
                    groupId: currentGroupId,
                    taskCountMap: countMeta?.map
                });
                if (snapshotMeta && isTokenCurrent()) {
                    try { recalcStats(); } catch (e) {}
                    let viewSnapshotMeta = null;
                    try {
                        viewSnapshotMeta = snapshotService?.restoreViewState?.(snapshot, {
                            groupId: currentGroupId,
                            viewMode: getCurrentViewMode('list'),
                            activeDocId: state.activeDocId,
                        });
                    } catch (e) {
                        viewSnapshotMeta = null;
                    }
                    if (!viewSnapshotMeta) {
                        prepareSwitchGroupFirstPaintWindow();
                        applyFilters();
                    }
                    prepareSwitchGroupFirstPaintWindow();
                    const activeModal = getActiveModal();
                    if (activeModal && isTokenCurrent()) {
                        try { if (showInlineLoading && Number(state.uiInlineLoadingToken) === token) __tmSetInlineLoading(false); } catch (e) {}
                        render();
                        __tmPerfTraceMark(perfTrace, 'snapshot-first-render', {
                            docCount: Number(snapshotMeta.docCount || 0),
                            taskCount: Number(snapshotMeta.taskCount || 0),
                            ageMs: __tmRoundPerfMs(snapshotMeta.ageMs || 0),
                        });
                        snapshotFirstRenderCommitted = true;
                        const verifyScheduled = scheduleSilentVerifyAfterCacheFirstPaint('snapshot-cache', {
                            delayMs: viewSnapshotMeta ? 520 : 260,
                        });
                        if (!verifyScheduled) scheduleFullLoadAfterFastFirstPaint('snapshot-cache');

                        return;
                    }
                }
            } catch (e) {}
        }
        const shouldLoadOtherBlocksLater = allowDeferredBootWork
            && !shouldLoadOtherBlocksInline
            && currentGroupId !== 'all'
            && Array.isArray(currentOtherBlockRefs)
            && currentOtherBlockRefs.length > 0;
        if (allDocIds.length === 0 && shouldLoadOtherBlocksLater) {
            await loadOtherBlocksNow();
            otherBlocksLoadedSynchronously = true;
        }
        if (allDocIds.length === 0
            && currentGroupId !== 'all'
            && !(options && options.skipEmptyDocGroupCloudSync === true)) {
            let resyncedEmptyGroup = false;
            try {
                resyncedEmptyGroup = await __tmSyncRemoteDocGroupSettingsIfNeeded({ silent: true });
            } catch (e) {}
            if (resyncedEmptyGroup) {
                try { if (showInlineLoading && Number(state.uiInlineLoadingToken) === token) __tmSetInlineLoading(false); } catch (e) {}
                __tmPerfTraceMark(perfTrace, 'doc-group-resync', {
                    docCount: 0,
                    groupId: currentGroupId,
                    reason: 'empty-group-cloud-sync',
                });

                return;
            }
        }
        const scheduleDeferredPostLoadWork = () => {
            if (!allowDeferredBootWork) return;
            const deferredDocIds = Array.isArray(allDocIds) ? allDocIds.slice() : [];
            __tmScheduleIdleTask(async () => {
                if (!isTokenCurrent()) return;
                let needRender = false;
                let needFilters = false;
                if (shouldLoadMetaLater) {
                    try {
                        await MetaStore.load();
                        needRender = true;
                        needFilters = true;
                    } catch (e) {}
                }
                if (!isTokenCurrent()) return;
                if (shouldLoadWhiteboardLater) {
                    try {
                        await WhiteboardStore.load();
                        if (runtimeState?.isViewMode?.('whiteboard') ?? (String(state.viewMode || '').trim() === 'whiteboard')) {
                            needRender = true;
                        }
                    } catch (e) {}
                }
                if (!isTokenCurrent()) return;
                if (shouldLoadOtherBlocksLater && !otherBlocksLoadedSynchronously) {
                    try {
                        await loadOtherBlocksNow();
                        needRender = true;
                        needFilters = true;
                    } catch (e) {}
                    if (!isTokenCurrent()) return;
                }
                try { __tmScheduleEnhanceWarmup(deferredDocIds, currentGroupId || 'all'); } catch (e) {}
                try { __tmScheduleResolvedDocIdsPrewarm({ delayMs: 260 }); } catch (e) {}
                if (!skipTaskIndexWarmup) {
                    try { __tmScheduleTaskIndexPrewarm({ currentDocIds: deferredDocIds, currentGroupId: currentGroupId || 'all' }); } catch (e) {}
                }
                try { window.tmWarmCalendarTaskCacheIfStale?.({ refresh: false, maxAgeMs: 20000 }); } catch (e) {}
                const kanbanHeadingGroupingActive = typeof __tmGetKanbanBoardMode === 'function'
                    ? __tmGetKanbanBoardMode() === 'heading'
                    : !!SettingsStore.data.kanbanHeadingGroupMode;
                if (kanbanHeadingGroupingActive || SettingsStore.data.docH2SubgroupEnabled !== false) {
                    try {
                        Promise.resolve().then(async () => {
                            if (kanbanHeadingGroupingActive) {
                                try { await __tmCleanupPlaceholderTasks(deferredDocIds); } catch (e) {}
                            }
                            try { await __tmWarmKanbanDocHeadings(deferredDocIds); } catch (e) {}
                        }).catch(() => null);
                    } catch (e) {}
                }
                try {
                    if (typeof window.tmCalendarWarmDocsToGroupCache === 'function') {
                        Promise.resolve().then(() => window.tmCalendarWarmDocsToGroupCache()).catch(() => null);
                    }
                } catch (e) {}
                const activeModal = getActiveModal();
                if (needRender && activeModal && isTokenCurrent()) {
                    if (stabilizeSwitchGroupView) {
                    } else {
                        __tmScheduleRender({ withFilters: needFilters });
                    }
                }
            }, 120);
        };
        const schedulePartialIndexReloads = (docIds, reason = 'task-index-partial-miss') => {
            const ids = Array.from(new Set((Array.isArray(docIds) ? docIds : [])
                .map((id) => String(id || '').trim())
                .filter((id) => __tmIsLikelyBlockId(id))));
            if (!ids.length) return false;
            if (stabilizeSwitchGroupView) {
                try {
                    __tmScheduleTaskIndexPrewarmForDocIds(ids, { delayMs: 420 });
                } catch (e) {}
                return true;
            }
            const chunks = [];
            for (let i = 0; i < ids.length; i += 12) chunks.push(ids.slice(i, i + 12));
            __tmScheduleIdleTask(async () => {
                for (const chunk of chunks) {
                    try {
                        await __tmRefreshAffectedDocsIncrementally({
                            docIds: chunk,
                            reason,
                            deferIfDetailBusy: true,
                        });
                    } catch (e) {}
                    try { await new Promise((resolve) => setTimeout(resolve, 60)); } catch (e) {}
                }
            }, 180);
            return true;
        };
        if (!skipRender && !forceFreshTasks && !forceFullLoadBudget && (preferFastFirstPaint || options?.allowSessionRestore === true) && !skipSessionRestoreFirstPaint && !stableSwitchNeedsCompleteLoad) {
            try {
                const countMeta = await ensureTaskCountMapForCacheRestore('session-cache');
                const sessionMeta = __tmRestoreGroupSessionTaskState({
                    docIds: allDocIds,
                    groupId: currentGroupId,
                    viewMode: getCurrentViewMode('list'),
                    customFieldIds: bulkCustomFieldPlan.bulkFieldIds,
                    taskCountMap: countMeta?.map,
                });
                if (sessionMeta && isTokenCurrent()) {
                    try { recalcStats(); } catch (e) {}
                    prepareSwitchGroupFirstPaintWindow();
                    applyFilters();
                    prepareSwitchGroupFirstPaintWindow();
                    const activeModal = getActiveModal();
                    if (activeModal && isTokenCurrent()) {
                        try { if (showInlineLoading && Number(state.uiInlineLoadingToken) === token) __tmSetInlineLoading(false); } catch (e) {}
                        render();
                        scheduleDeferredPostLoadWork();
                        __tmPerfTraceMark(perfTrace, 'session-first-render', {
                            docCount: Number(sessionMeta.docCount || 0),
                            taskCount: Number(sessionMeta.taskCount || 0),
                            ageMs: __tmRoundPerfMs(sessionMeta.ageMs || 0),
                        });
                        const verifyScheduled = scheduleSilentVerifyAfterCacheFirstPaint('session-cache', { delayMs: 420 });
                        if (!verifyScheduled) scheduleFullLoadAfterFastFirstPaint('session-cache');

                        return;
                    }
                }
            } catch (e) {}
            try {
                if (!skipDocSessionRestoreFirstPaint) {
                    const countMeta = await ensureTaskCountMapForCacheRestore('doc-session-cache');
                    const docSessionMeta = __tmRestoreDocSessionTaskState({
                        docIds: allDocIds,
                        groupId: currentGroupId,
                        docUpdatedMap: taskIndexDocUpdatedMap,
                        taskCountMap: countMeta?.map,
                    });
                    if (docSessionMeta && isTokenCurrent()) {
                        try { recalcStats(); } catch (e) {}
                        prepareSwitchGroupFirstPaintWindow();
                        applyFilters();
                        prepareSwitchGroupFirstPaintWindow();
                        const activeModal = getActiveModal();
                        if (activeModal && isTokenCurrent()) {
                            try { if (showInlineLoading && Number(state.uiInlineLoadingToken) === token) __tmSetInlineLoading(false); } catch (e) {}
                            render();
                            scheduleDeferredPostLoadWork();
                            __tmPerfTraceMark(perfTrace, 'doc-session-first-render', {
                                docCount: Number(docSessionMeta.docCount || 0),
                                taskCount: Number(docSessionMeta.taskCount || 0),
                                ageMs: __tmRoundPerfMs(docSessionMeta.ageMs || 0),
                            });
                            const verifyScheduled = scheduleSilentVerifyAfterCacheFirstPaint('doc-session-cache', { delayMs: 420 });
                            if (!verifyScheduled) scheduleFullLoadAfterFastFirstPaint('doc-session-cache');

                            return;
                        }
                    }
                }
            } catch (e) {}
        }
        const canUseTaskIndex = !skipTaskIndexFirstPaint
            && !forceFreshTasks
            && !forceFullLoadBudget
            && !state.isRefreshing;
        if (canUseTaskIndex) {
            try {
                const countMeta = await ensureTaskCountMapForCacheRestore('task-index-cache');
                const currentViewModeForTaskIndex = getCurrentViewMode('list');
                const allowPartialTaskIndex = currentViewModeForTaskIndex !== 'calendar'
                    && !stabilizeSwitchGroupView
                    && options?.allowPartialTaskIndexFirstPaint !== false;
                const indexMeta = await __tmLoadTaskIndexForScope({
                    docIds: allDocIds,
                    groupId: currentGroupId,
                    queryLimit: __TM_TASK_INDEX_QUERY_LIMIT,
                    docUpdatedMap: taskIndexDocUpdatedMap,
                    taskCountMap: countMeta?.map,
                    strictDocUpdated: stabilizeSwitchGroupView,
                    cachedOnly: taskIndexFirstPaintCachedOnly,
                    allowPartial: allowPartialTaskIndex,
                    maxPartialMisses: allowPartialTaskIndex
                        ? (isSwitchDocGroupLoad
                            ? Math.max(0, Array.isArray(allDocIds) ? allDocIds.length : 0)
                            : Math.max(12, Math.min(240, Math.ceil((Array.isArray(allDocIds) ? allDocIds.length : 0) * 0.35))))
                        : 0,
                });
                if (indexMeta && isTokenCurrent()) {
                    try { recalcStats(); } catch (e) {}
                    prepareSwitchGroupFirstPaintWindow();
                    applyFilters();
                    prepareSwitchGroupFirstPaintWindow();
                    const activeModal = getActiveModal();
                    if (activeModal && isTokenCurrent()) {
                        try { if (showInlineLoading && Number(state.uiInlineLoadingToken) === token) __tmSetInlineLoading(false); } catch (e) {}
                        let patchedTaskIndexView = false;
                        if (!skipRender) {
                            const shouldPatchTaskIndexView = isSwitchDocGroupLoad
                                && !forceShellRender
                                && String(sourceLabel || '').indexOf(':') !== -1
                                && typeof __tmRerenderCurrentViewInPlace === 'function';
                            patchedTaskIndexView = shouldPatchTaskIndexView
                                ? !!__tmRerenderCurrentViewInPlace(activeModal)
                                : false;
                            if (!patchedTaskIndexView) render();
                        }
                        scheduleDeferredPostLoadWork();
                        __tmPerfTraceMark(perfTrace, 'task-index-ready', {
                            docCount: Number(indexMeta.docCount || 0),
                            taskCount: Number(indexMeta.taskCount || 0),
                            indexAgeMs: Math.max(0, Date.now() - Number(indexMeta.indexUpdatedAt || 0)),
                            partial: indexMeta.partial ? 1 : 0,
                            reloadDocCount: Array.isArray(indexMeta.reloadDocIds) ? indexMeta.reloadDocIds.length : 0,
                        });
                        if (indexMeta.partial && Array.isArray(indexMeta.reloadDocIds) && indexMeta.reloadDocIds.length > 0) {
                            try { schedulePartialIndexReloads(indexMeta.reloadDocIds, 'task-index-partial-miss'); } catch (e) {}
                        }
                        if (Array.isArray(indexMeta.softReloadDocIds) && indexMeta.softReloadDocIds.length > 0) {
                            try { schedulePartialIndexReloads(indexMeta.softReloadDocIds, 'task-index-soft-stale'); } catch (e) {}
                        }
                        if (refreshAfterTaskIndexFirstPaint && indexMeta.partial && Array.isArray(indexMeta.reloadDocIds) && indexMeta.reloadDocIds.length > 0) {
                            if (isSwitchDocGroupLoad) {
                            } else {
                                scheduleFullLoadAfterFastFirstPaint('task-index-cache');
                            }
                        }
                        scheduleSilentVerifyAfterCacheFirstPaint('task-index-cache', {
                            delayMs: indexMeta.partial ? 260 : 480,
                        });

                        return;
                    }
                }
            } catch (e) {}
        } else {
            if (!skipTaskIndexWarmup) {
                try { __tmScheduleWarmTaskIndexStore(1600); } catch (e) {}
            }
        }

        // 如果没有文档，打开设置
        if (allDocIds.length === 0) {
            state.taskTree = [];
            globalThis.__tmTaskStore?.clearFlat?.({ mergeOtherBlocks: true });
            try { recalcStats(); } catch (e) {}
            applyFilters();
            __tmPerfTraceMark(perfTrace, 'filter', {
                filteredCount: Array.isArray(state.filteredTasks) ? state.filteredTasks.length : 0,
                reason: 'empty-docs',
                ...((state.__tmLastFilterPerf && typeof state.__tmLastFilterPerf === 'object') ? state.__tmLastFilterPerf : {}),
            });
            const activeModal = getActiveModal();
            if (!skipRender && activeModal && isTokenCurrent()) {
                try { if (showInlineLoading && Number(state.uiInlineLoadingToken) === token) __tmSetInlineLoading(false); } catch (e) {}
                render();
                __tmPerfTraceMark(perfTrace, 'first-render', {
                    filteredCount: Array.isArray(state.filteredTasks) ? state.filteredTasks.length : 0,
                    reason: 'empty-docs',
                });
                __tmPerfTraceMark(perfTrace, 'render', {
                    filteredCount: Array.isArray(state.filteredTasks) ? state.filteredTasks.length : 0,
                    reason: 'empty-docs',
                });
            }
            scheduleDeferredPostLoadWork();
            if (!(Array.isArray(state.otherBlocks) && state.otherBlocks.length) && activeModal && isTokenCurrent()) showSettings();
            __tmPerfTraceMark(perfTrace, 'full-ready', {
                docCount: 0,
                filteredCount: Array.isArray(state.filteredTasks) ? state.filteredTasks.length : 0,
                reason: 'empty-docs',
            });

            return;
        }

        try {
            const startTime = Date.now();
            const loadBudget = (preferFastFirstPaint && !snapshotFirstRenderCommitted && !stableSwitchNeedsCompleteLoad)
                ? __tmGetInitialLoadBudget({
                    forceFullLoadBudget,
                    forceFastFirstPaintBudget,
                    queryLimit: state.queryLimit,
                    initialQueryLimit: Number(options?.initialQueryLimit),
                    initialRenderLimit: Number(options?.initialRenderLimit),
                    initialListStep: Number(options?.initialListStep),
                    viewMode: state.viewMode,
                })
                : {
                    enabled: false,
                    queryLimit: state.queryLimit,
                    renderLimit: Number(state.listRenderLimit) || 100,
                    listStep: 100,
                };
            const effectiveQueryLimit = loadBudget.enabled
                ? Math.max(1, Math.min(Number(state.queryLimit) || 500, Number(loadBudget.queryLimit) || Number(state.queryLimit) || 500))
                : (Number(state.queryLimit) || 500);
            const initialRenderLimit = loadBudget.enabled
                ? Math.max(loadBudget.listStep, loadBudget.renderLimit)
                : Number.POSITIVE_INFINITY;
            state.listRenderStep = loadBudget.enabled ? loadBudget.listStep : 100;
            const queryStageStartTime = __tmPerfNow();
            const shouldForceFreshColdAllDocsLoad = !forceFreshTasks
                && String(state.activeDocId || 'all').trim() === 'all'
                && (!Array.isArray(state.taskTree) || state.taskTree.length === 0)
                && (!state.flatTasks || Object.keys(state.flatTasks).length === 0);
            const queryForceFresh = forceFreshTasks || shouldForceFreshColdAllDocsLoad;

            // 2. 批量获取任务
            // 循环完成实例挂在源任务历史上；如果只查询已完成原任务，会把已推进为未完成的源任务漏掉，
            // 从而无法注入循环记录。这里先关闭 doneOnly 查询优化，筛选交给前端规则层处理。
            const queryDoneOnly = false;
            const queryStartedAt = Date.now();
            try {
                const flushStartedAt = Date.now();
                await __tmFlushSqlTransactionsSafe(`load-selected-documents:${sourceLabel}`);
            } catch (e) {}
            if (abortSnapshotCacheVerifyIfContextChanged('after-query-flush', {
                docCount: Array.isArray(allDocIds) ? allDocIds.length : 0,
            })) return;
            const res = await API.getTasksByDocuments(allDocIds, effectiveQueryLimit, {
                doneOnly: queryDoneOnly,
                forceFresh: queryForceFresh,
                // 首次全量构建直接使用 SQL 解析 parent list -> parent task，
                // 避免首屏先把子任务算成根任务，再触发后续纠偏闪烁。
                skipParentTaskJoin: false,
                skipDocJoin: true,
                customFieldIds: bulkCustomFieldPlan.bulkFieldIds,
            });

            if (!isTokenCurrent()) {

                return;
            }
            if (abortSnapshotCacheVerifyIfContextChanged('after-query', {
                taskCount: Array.isArray(res?.tasks) ? res.tasks.length : 0,
                queryTime: Number(res?.queryTime || 0),
            })) return;
            try {
                const countMeta = await ensureTaskCountMapForCacheRestore('query-completeness');
                const expectedMap = countMeta?.map instanceof Map ? countMeta.map : null;
                if (expectedMap && expectedMap.size > 0 && Array.isArray(res.tasks)) {
                    const actualByDoc = new Map();
                    res.tasks.forEach((task) => {
                        const docId = String(task?.root_id || task?.docId || '').trim();
                        if (!docId) return;
                        actualByDoc.set(docId, Math.max(0, Math.round(Number(actualByDoc.get(docId) || 0) || 0)) + 1);
                    });
                    const underfilledDocIds = [];
                    (Array.isArray(allDocIds) ? allDocIds : []).forEach((docId0) => {
                        const docId = String(docId0 || '').trim();
                        if (!docId || !expectedMap.has(docId)) return;
                        const expected = Math.max(0, Math.round(Number(expectedMap.get(docId) || 0) || 0));
                        const actual = Math.max(0, Math.round(Number(actualByDoc.get(docId) || 0) || 0));
                        if (actual < expected) underfilledDocIds.push(docId);
                    });
                    if (underfilledDocIds.length > 0) {
                        const underfilledSet = new Set(underfilledDocIds);
                        const keptTasks = res.tasks.filter((task) => !underfilledSet.has(String(task?.root_id || task?.docId || '').trim()));
                        const replacementTasks = [];
                        let replacementQueryTime = 0;
                        for (const docId of underfilledDocIds) {
                            if (!isTokenCurrent()) {

                                return;
                            }
                            try {
                                const docRes = await API.getTasksByDocument(docId, __TM_TASK_INDEX_QUERY_LIMIT, {
                                    doneOnly: queryDoneOnly,
                                    fullTree: true,
                                    skipParentTaskJoin: false,
                                    skipDocJoin: true,
                                    customFieldIds: bulkCustomFieldPlan.bulkFieldIds,
                                });
                                replacementQueryTime += Number(docRes?.queryTime || 0);
                                replacementTasks.push(...(Array.isArray(docRes?.tasks) ? docRes.tasks : []));
                            } catch (e) {}
                            try { await new Promise((resolve) => setTimeout(resolve, 0)); } catch (e) {}
                        }
                        res.tasks = keptTasks.concat(replacementTasks);
                        res.queryTime = Number(res.queryTime || 0) + replacementQueryTime;
                        res.sqlQueryTime = Number(res.sqlQueryTime || 0) + replacementQueryTime;
                        res.totalCount = Math.max(Number(res.totalCount || 0) || 0, Array.isArray(res.tasks) ? res.tasks.length : 0);
                        res.queryCompletenessPatchedDocIds = underfilledDocIds;
                    }
                }
            } catch (e) {}
            const limitReachedDocIds = Array.isArray(res?.limitReachedDocIds)
                ? res.limitReachedDocIds.map((id) => String(id || '').trim()).filter(Boolean)
                : [];
            if (limitReachedDocIds.length > 0) {
                if (effectiveQueryLimit < __TM_TASK_INDEX_QUERY_LIMIT) {
                    scheduleFullLoadAfterFastFirstPaint('query-limit-hit');
                }
            }
            let pendingMergeMs = 0;
            let pendingValidateCount = 0;
            let pendingMergedIntoLiveCount = 0;
            let pendingInsertedCount = 0;
            let pendingDroppedCount = 0;
            try {
                const pendingMergeStartTime = __tmPerfNow();
                const taskStore = globalThis.__tmTaskStore || null;
                const pendingMap = taskStore?.getPendingMap?.() || {};
                const pendingDeletedMap = taskStore?.getPendingDeletedMap?.() || {};
                const isPendingDeletedId = (id) => {
                    const tid = String(id || '').trim();
                    if (!tid) return false;
                    const item = pendingDeletedMap[tid];
                    if (!item) return false;
                    const expiresAt = Number(item?.expiresAt) || 0;
                    if (expiresAt > 0 && expiresAt < Date.now()) {
                        try { taskStore?.forgetPendingDeleted?.(tid); } catch (e) {}
                        return false;
                    }
                    return true;
                };
                const nowTs = Date.now();
                const liveTasks = Array.isArray(res.tasks) ? res.tasks : [];
                const liveIdSet = new Set();
                const liveTaskMap = new Map();
                for (let i = 0; i < liveTasks.length; i += 1) {
                    const task = liveTasks[i];
                    const id = String(task?.id || '').trim();
                    if (!id) continue;
                    liveIdSet.add(id);
                    if (!liveTaskMap.has(id)) liveTaskMap.set(id, task);
                }
                const pendingTaskIds = Object.keys(pendingMap);
                const pendingIdsToValidate = [];
                for (let i = 0; i < pendingTaskIds.length; i += 1) {
                    const id = String(pendingTaskIds[i] || '').trim();
                    if (id && !liveIdSet.has(id)) pendingIdsToValidate.push(id);
                }
                pendingValidateCount = pendingIdsToValidate.length;
                const pendingIdsToValidateSet = new Set(pendingIdsToValidate);
                const allDocIdSet = new Set((Array.isArray(allDocIds) ? allDocIds : []).map((id) => String(id || '').trim()).filter(Boolean));
                const existingPendingIdSet = new Set();
                const shouldKeepPendingWhileOutboxSettles = (id, pending) => {
                    const tid = String(id || '').trim();
                    const task = (pending && typeof pending === 'object') ? pending : {};
                    if (!tid) return false;
                    try {
                        if (typeof __tmHasPendingQueuedOpForTask === 'function' && __tmHasPendingQueuedOpForTask(tid)) return true;
                    } catch (e) {}
                    const createdAt = Date.parse(String(task.created || task.createdAt || ''));
                    if (Number.isFinite(createdAt) && (Date.now() - createdAt) < 45000) return true;
                    const expiresAt = Number(task.expiresAt) || 0;
                    if (expiresAt && expiresAt >= Date.now()) return true;
                    return false;
                };
                if (pendingIdsToValidate.length > 0) {
                    try {
                        const rows = await API.getBlocksByIds(pendingIdsToValidate);
                        (Array.isArray(rows) ? rows : []).forEach((row) => {
                            const id = String(row?.id || '').trim();
                            if (!id) return;
                            if (String(row?.type || '').trim() !== 'i') return;
                            if (String(row?.subtype || '').trim() !== 't') return;
                            existingPendingIdSet.add(id);
                        });
                    } catch (e) {}
                }
                for (let i = 0; i < pendingTaskIds.length; i += 1) {
                    const taskId = pendingTaskIds[i];
                    const id = String(taskId || '').trim();
                    const pending = pendingMap[id];
                    if (isPendingDeletedId(id)) {
                        try { taskStore?.removePending?.(taskId); } catch (e) {}
                        pendingDroppedCount += 1;
                        continue;
                    }
                    if (!id || !pending) {
                        try { taskStore?.removePending?.(taskId); } catch (e) {}
                        pendingDroppedCount += 1;
                        continue;
                    }
                    if (liveIdSet.has(id)) {
                        const liveTask = liveTaskMap.get(id) || null;
                        const pendingHasVisibleDate = !!(
                            String(pending?.completionTime || '').trim()
                            || String(pending?.startDate || '').trim()
                            || String(pending?.customTime || '').trim()
                        );
                        if (liveTask) {
                            try { __tmMergeVisibleDateFieldsFromPrevTask(liveTask, pending); } catch (e) {}
                            if (pendingHasVisibleDate) {
                                try { __tmMarkVisibleDateFallbackTask(id); } catch (e) {}
                            }
                            pendingMergedIntoLiveCount += 1;
                        }
                        try { taskStore?.removePending?.(taskId); } catch (e) {}
                        continue;
                    }
                    if (pendingIdsToValidateSet.has(id) && !existingPendingIdSet.has(id)) {
                        const docId = String(pending.root_id || pending.docId || '').trim();
                        if (docId && allDocIdSet.has(docId) && shouldKeepPendingWhileOutboxSettles(id, pending)) {
                            pending.expiresAt = Math.max(Number(pending.expiresAt) || 0, Date.now() + __TM_PENDING_INSERTED_TASK_KEEPALIVE_MS);
                            const insertedTask = { ...pending, __tmPendingInserted: true };
                            liveTasks.push(insertedTask);
                            liveIdSet.add(id);
                            liveTaskMap.set(id, insertedTask);
                            pendingInsertedCount += 1;
                            continue;
                        }
                        try { taskStore?.removePending?.(taskId); } catch (e) {}
                        pendingDroppedCount += 1;
                        continue;
                    }
                    const expiresAt = Number(pending.expiresAt) || 0;
                    const docId = String(pending.root_id || pending.docId || '').trim();
                    if ((expiresAt && expiresAt < nowTs) || !docId || !allDocIdSet.has(docId)) {
                        try { taskStore?.removePending?.(taskId); } catch (e) {}
                        pendingDroppedCount += 1;
                        continue;
                    }
                    const insertedTask = { ...pending, __tmPendingInserted: true };
                    liveTasks.push(insertedTask);
                    liveIdSet.add(id);
                    liveTaskMap.set(id, insertedTask);
                    pendingInsertedCount += 1;
                }
                res.tasks = liveTasks;
                pendingMergeMs = __tmRoundPerfMs(__tmPerfNow() - pendingMergeStartTime);
            } catch (e) {}
            // 更新统计信息
            state.stats.queryTime = res.queryTime || (Date.now() - startTime);
            state.stats.totalTasks = res.totalCount || 0;
            state.stats.doneTasks = res.doneCount || 0;
            __tmPerfTraceMark(perfTrace, 'query', {
                queryLimit: effectiveQueryLimit,
                taskCount: Array.isArray(res.tasks) ? res.tasks.length : 0,
                queryTime: __tmRoundPerfMs(state.stats.queryTime),
                queryStageMs: __tmRoundPerfMs(__tmPerfNow() - queryStageStartTime),
                cacheHit: Number(res?.cacheHit || 0),
                chunked: Number(res?.chunked || 0),
                chunkCount: Number(res?.chunkCount || 0),
                limitHitDocCount: limitReachedDocIds.length,
                cacheAgeMs: __tmRoundPerfMs(res?.cacheAgeMs || 0),
                attrHostReadTime: __tmRoundPerfMs(res?.attrHostReadTime || 0),
                customFieldReadTime: __tmRoundPerfMs(res?.customFieldReadTime || 0),
                customFieldCacheHitCount: Number(res?.customFieldCacheHitCount || 0),
                customFieldCacheMissCount: Number(res?.customFieldCacheMissCount || 0),
                customFieldHostQueryCount: Number(res?.customFieldHostQueryCount || 0),
                customFieldSelfFallbackCount: Number(res?.customFieldSelfFallbackCount || 0),
                customFieldHostAssignedCount: Number(res?.customFieldHostAssignedCount || 0),
                customFieldSelfAssignedCount: Number(res?.customFieldSelfAssignedCount || 0),
                customFieldRequestedFieldCount: Number(res?.customFieldRequestedFieldCount || 0),
                sourceQueryTime: __tmRoundPerfMs(res?.sourceQueryTime || 0),
                sourceSqlQueryTime: __tmRoundPerfMs(res?.sourceSqlQueryTime || 0),
                sourceAttrHostReadTime: __tmRoundPerfMs(res?.sourceAttrHostReadTime || 0),
                sourceCustomFieldReadTime: __tmRoundPerfMs(res?.sourceCustomFieldReadTime || 0),
                sourceCustomFieldCacheHitCount: Number(res?.sourceCustomFieldCacheHitCount || 0),
                sourceCustomFieldCacheMissCount: Number(res?.sourceCustomFieldCacheMissCount || 0),
                sourceCustomFieldHostQueryCount: Number(res?.sourceCustomFieldHostQueryCount || 0),
                sourceCustomFieldSelfFallbackCount: Number(res?.sourceCustomFieldSelfFallbackCount || 0),
                sourceCustomFieldHostAssignedCount: Number(res?.sourceCustomFieldHostAssignedCount || 0),
                sourceCustomFieldSelfAssignedCount: Number(res?.sourceCustomFieldSelfAssignedCount || 0),
                sourceCustomFieldRequestedFieldCount: Number(res?.sourceCustomFieldRequestedFieldCount || 0),
                fastBudget: loadBudget.enabled ? 1 : 0,
                doneOnlyOptimized: queryDoneOnly ? 1 : 0,
                queryForceFresh: queryForceFresh ? 1 : 0,
                coldStartForceFresh: shouldForceFreshColdAllDocsLoad ? 1 : 0,
                pendingMergeMs,
                pendingValidateCount,
                pendingMergedIntoLiveCount,
                pendingInsertedCount,
                pendingDroppedCount,
            });
            if (abortSnapshotCacheVerifyIfContextChanged('after-query-done', {
                taskCount: Array.isArray(res.tasks) ? res.tasks.length : 0,
                queryTime: state.stats.queryTime,
            })) return;
            if (isSnapshotCacheVerifyLoad && snapshotCacheVerifyBefore?.rawTaskSignature) {
                const queriedRawTaskSignature = buildVerifyRawTaskSignatureFromTasks(res.tasks);
                if (queriedRawTaskSignature && queriedRawTaskSignature === snapshotCacheVerifyBefore.rawTaskSignature) {
                    state.__tmCacheFirstPaintNeedsVerify = false;
                    state.__tmCacheFirstPaintVerifyGroupId = '';
                    state.__tmLastCacheVerifyAt = Date.now();
                    setCacheVerifyRawSignatureForGroup(snapshotCacheVerifyBefore.groupId, queriedRawTaskSignature);

                    return;
                }
                if (queriedRawTaskSignature) setCacheVerifyRawSignatureForGroup(snapshotCacheVerifyBefore.groupId, queriedRawTaskSignature, true);
            }
            __tmPerfTraceMark(perfTrace, 'attr-read', {
                attrReadTime: __tmRoundPerfMs(res?.attrReadTime || 0),
                attrHostReadTime: __tmRoundPerfMs(res?.attrHostReadTime || 0),
                customFieldReadTime: __tmRoundPerfMs(res?.customFieldReadTime || 0),
                cacheHit: Number(res?.cacheHit || 0),
                cacheAgeMs: __tmRoundPerfMs(res?.cacheAgeMs || 0),
                customFieldCacheHitCount: Number(res?.customFieldCacheHitCount || 0),
                customFieldCacheMissCount: Number(res?.customFieldCacheMissCount || 0),
                customFieldHostQueryCount: Number(res?.customFieldHostQueryCount || 0),
                customFieldSelfFallbackCount: Number(res?.customFieldSelfFallbackCount || 0),
                customFieldHostAssignedCount: Number(res?.customFieldHostAssignedCount || 0),
                customFieldSelfAssignedCount: Number(res?.customFieldSelfAssignedCount || 0),
                customFieldRequestedFieldCount: Number(res?.customFieldRequestedFieldCount || 0),
                sourceAttrReadTime: __tmRoundPerfMs(res?.sourceAttrReadTime || 0),
                sourceAttrHostReadTime: __tmRoundPerfMs(res?.sourceAttrHostReadTime || 0),
                sourceCustomFieldReadTime: __tmRoundPerfMs(res?.sourceCustomFieldReadTime || 0),
                sourceCustomFieldCacheHitCount: Number(res?.sourceCustomFieldCacheHitCount || 0),
                sourceCustomFieldCacheMissCount: Number(res?.sourceCustomFieldCacheMissCount || 0),
                sourceCustomFieldHostQueryCount: Number(res?.sourceCustomFieldHostQueryCount || 0),
                sourceCustomFieldSelfFallbackCount: Number(res?.sourceCustomFieldSelfFallbackCount || 0),
                sourceCustomFieldHostAssignedCount: Number(res?.sourceCustomFieldHostAssignedCount || 0),
                sourceCustomFieldSelfAssignedCount: Number(res?.sourceCustomFieldSelfAssignedCount || 0),
                sourceCustomFieldRequestedFieldCount: Number(res?.sourceCustomFieldRequestedFieldCount || 0),
                readRepeatAttrsInline: res?.readRepeatAttrsInline === false ? 0 : 1,
            });

            const nextTaskTree = [];
            const nextFlatTasks = {};
            if (res.tasks) {
                const rule0 = state.currentRule ? state.filterRules.find(r => r.id === state.currentRule) : null;
                const normalizedRuleSorts0 = __tmGetNormalizedRuleSorts(rule0);
                const isUngroup = !state.groupByDocName && !state.groupByTaskName && !state.groupByTime && !state.quadrantEnabled;
                const ruleNeedsFlowRank = normalizedRuleSorts0.some(s => String(s?.field || '').trim() === 'docSeq');
                const needFlowRank = !!ruleNeedsFlowRank || (!__tmRuleHasExplicitSort(rule0) && (!!state.groupByDocName || isUngroup || !!state.groupByTaskName || !!state.groupByTime || !!state.quadrantEnabled));
                const colOrder0 = Array.isArray(SettingsStore.data.columnOrder) ? SettingsStore.data.columnOrder : [];
                const docHeadingSubgroupActive = !!state.groupByDocName && SettingsStore.data.docH2SubgroupEnabled !== false;
                const kanbanHeadingGroupingActive = typeof __tmGetKanbanBoardMode === 'function'
                    ? __tmGetKanbanBoardMode() === 'heading'
                    : !!SettingsStore.data.kanbanHeadingGroupMode;
                const needH2 = colOrder0.includes('h2')
                    || normalizedRuleSorts0.some(s => String(s?.field || '').trim() === 'h2')
                    || docHeadingSubgroupActive
                    || kanbanHeadingGroupingActive;
                const ruleNeedsH2Sort = Array.isArray(rule0?.sort) && rule0.sort.some(s => String(s?.field || '').trim() === 'h2');
                const normalizeStartTime = Date.now();
                const normalizeMetrics = {
                    taskTargetPrepMs: 0,
                    enhancePlanMs: 0,
                    enhanceBundleMs: 0,
                    optionsPrepMs: 0,
                    parseMs: 0,
                    mergeVisibleMs: 0,
                    fieldsMs: 0,
                    headingMs: 0,
                    semanticMs: 0,
                    metaSeedMs: 0,
                    virtualMs: 0,
                };
                let perfMark = __tmPerfNow();
                const enhanceTargets0 = __tmCollectTaskEnhanceTargets(res.tasks);
                const taskIds0 = enhanceTargets0.taskIds;
                const taskDocMap0 = enhanceTargets0.taskDocMap;
                normalizeMetrics.taskTargetPrepMs += (__tmPerfNow() - perfMark);
                perfMark = __tmPerfNow();
                const deferEnhance = !!perfTuning.asyncEnhance && taskIds0.length >= Number(perfTuning.deferEnhanceThreshold || 180);
                const h2StrictNeeded = !!ruleNeedsH2Sort || docHeadingSubgroupActive || kanbanHeadingGroupingActive;
                const preferAsyncEnhance = !!loadBudget.enabled;
                const deferH2Enhance = !!needH2 && !h2StrictNeeded && (deferEnhance || preferAsyncEnhance);
                const syncFlowBeforeFirstRender = forceSyncFlowRank || (sourceLabel === 'openManager' && !skipRender) || shouldForceFreshColdAllDocsLoad;
                const deferFlowEnhance = !!needFlowRank
                    && !ruleNeedsFlowRank
                    && !forceFreshTasks
                    && !syncFlowBeforeFirstRender
                    && (deferEnhance || preferAsyncEnhance);
                normalizeMetrics.enhancePlanMs += (__tmPerfNow() - perfMark);
                let h2ContextMap = new Map();
                let taskFlowRankMap = new Map();
                let h2EnhanceLoaded = false;
                let virtualTaskCount = 0;
                let enhanceBundleMeta = null;
                if ((needH2 && !deferH2Enhance) || (needFlowRank && !deferFlowEnhance)) {
                    perfMark = __tmPerfNow();
                    try {
                        const bundle = await API.fetchTaskEnhanceBundle(taskIds0, {
                            taskDocMap: taskDocMap0,
                            needH2: needH2 && !deferH2Enhance,
                            needFlow: needFlowRank && !deferFlowEnhance
                        });
                        h2ContextMap = bundle?.h2ContextMap instanceof Map ? bundle.h2ContextMap : new Map();
                        taskFlowRankMap = bundle?.taskFlowRankMap instanceof Map ? bundle.taskFlowRankMap : new Map();
                        enhanceBundleMeta = (bundle?.meta && typeof bundle.meta === 'object') ? bundle.meta : null;
                        h2EnhanceLoaded = !!(needH2 && !deferH2Enhance);
                    } catch (e) {
                        h2ContextMap = new Map();
                        taskFlowRankMap = new Map();
                        h2EnhanceLoaded = false;
                    } finally {
                        normalizeMetrics.enhanceBundleMs += (__tmPerfNow() - perfMark);
                    }
                }
                const semanticTaskBuckets = new Map();

                // 3. 获取层级信息（不再依赖，改用前端递归计算）
                // const taskIds = res.tasks.map(t => t.id);
                // const hierarchyCache = await API.getTasksHierarchy(taskIds);

                // 4. 构建任务树
                // 将任务按文档分组
                perfMark = __tmPerfNow();
                const tasksByDoc = new Map();
                const normalizeDocDisplayNameCache = new Map();
                const normalizeCustomFieldDefs = __tmGetCustomFieldDefs();
                const normalizeCustomFieldDefMap = new Map(normalizeCustomFieldDefs
                    .map((field) => [String(field?.id || '').trim(), field])
                    .filter(([fieldId]) => !!fieldId));
                const visibleDateFallbackTaskIds = __tmBuildVisibleDateFallbackTaskIdSet();
                const queuedTaskFieldPatchMap = __tmBuildQueuedTaskFieldPatchMap({ statuses: ['queued', 'running'] });
                const queuedTaskDeleteSet = (typeof __tmBuildQueuedTaskDeleteSet === 'function')
                    ? __tmBuildQueuedTaskDeleteSet({ statuses: ['queued', 'running'] })
                    : new Set();
                const isQueuedOrPendingDeletedTaskId = (taskId) => {
                    const tid = String(taskId || '').trim();
                    if (!tid) return false;
                    if (queuedTaskDeleteSet.has(tid)) return true;
                    try {
                        return !!globalThis.__tmRuntimeState?.isPendingDeletedTaskId?.(tid);
                    } catch (e) {
                        return false;
                    }
                };
                const queuedTaskMoveMap = (typeof __tmBuildQueuedTaskMoveMap === 'function')
                    ? __tmBuildQueuedTaskMoveMap({ statuses: ['queued', 'running'] })
                    : new Map();
                const customStatusFallbackTaskIds = new Set(
                    Array.from(queuedTaskFieldPatchMap.entries())
                        .filter(([, patch]) => patch && typeof patch === 'object' && Object.prototype.hasOwnProperty.call(patch, 'customStatus'))
                        .map(([taskId]) => String(taskId || '').trim())
                        .filter(Boolean)
                );
                const normalizeTodayDateKey = __tmNormalizeDateOnly(new Date());
                const normalizeTaskOptions = {
                    docDisplayNameCache: normalizeDocDisplayNameCache,
                    docDisplayNameMode: String(__tmGetDocDisplayNameMode() || '').trim() || 'name',
                    customFieldDefs: normalizeCustomFieldDefs,
                    customFieldDefMap: normalizeCustomFieldDefMap,
                    visibleDateFallbackTaskIds,
                    customStatusFallbackTaskIds,
                    todayDateKey: normalizeTodayDateKey,
                };
                normalizeMetrics.optionsPrepMs += (__tmPerfNow() - perfMark);
                const recurringDueCandidateIds = [];
                if (!MetaStore.data || typeof MetaStore.data !== 'object') MetaStore.data = {};
                const metaStoreData = MetaStore.data;
                let metaSeedCount = 0;
                let metaSeedDirty = false;
                const normalizeTasks = Array.isArray(res.tasks) ? res.tasks : [];
                const normalizeChunkSize = Number(options?.taskNormalizeChunkSize || 16);
                const normalizeYieldEvery = loadBudget.enabled
                    ? Math.max(
                        8,
                        Math.min(
                            80,
                            Math.round(Number.isFinite(normalizeChunkSize) ? normalizeChunkSize : 16)
                        )
                    )
                    : 0;
                for (let taskIndex = 0; taskIndex < normalizeTasks.length; taskIndex += 1) {
                    if (normalizeYieldEvery > 0 && taskIndex > 0 && (taskIndex % normalizeYieldEvery) === 0) {
                        await yieldToBrowser();
                        if (!isTokenCurrent()) {

                            return;
                        }
                    }
                    const task = normalizeTasks[taskIndex];
                    // 确保任务有root_id
                    if (!task.root_id) continue;
                    const taskId = String(task.id || '').trim();
                    if (taskId && isQueuedOrPendingDeletedTaskId(taskId)) continue;
                    const prevTask = state.flatTasks?.[String(task.id || '').trim()];
                    const flowRank = Number(taskFlowRankMap.get(String(task.id || '').trim()));
                    __tmApplyResolvedFlowRankIfNeeded(task, flowRank);

                    // 解析任务状态
                    let perfMark = __tmPerfNow();
                    const parsed = API.parseTaskStatus(task.markdown);
                    normalizeMetrics.parseMs += (__tmPerfNow() - perfMark);
                    const correctDone = parsed.done;
                    task.done = correctDone;
                    task.content = parsed.content;
                    const parsedMarker = __tmNormalizeTaskStatusMarker(parsed?.marker, '');
                    if (parsedMarker) {
                        task.taskMarker = parsedMarker;
                        task.task_marker = parsedMarker;
                    }

                    const queuedTaskFieldPatch = taskId ? queuedTaskFieldPatchMap.get(taskId) : null;
                    if (queuedTaskFieldPatch && typeof queuedTaskFieldPatch === 'object') {
                        __tmApplyQueuedTaskFieldPatchToTask(task, queuedTaskFieldPatch);
                    }
                    const queuedMovePatch = taskId && queuedTaskMoveMap instanceof Map ? queuedTaskMoveMap.get(taskId) : null;
                    if (queuedMovePatch && typeof queuedMovePatch === 'object') {
                        __tmApplyQueuedTaskMovePatchToTask(task, queuedMovePatch);
                    }

                    perfMark = __tmPerfNow();
                    __tmMergeVisibleDateFieldsFromPrevTask(task, prevTask);
                    normalizeMetrics.mergeVisibleMs += (__tmPerfNow() - perfMark);

                    // 标准化字段
                    const docName = task.docName || task.doc_name || '未命名文档';
                    perfMark = __tmPerfNow();
                    normalizeTaskFields(task, docName, normalizeTaskOptions);
                    normalizeMetrics.fieldsMs += (__tmPerfNow() - perfMark);

                    const hasResolvedH2 = !!taskId && h2ContextMap.has(taskId);
                    const h2ctx = hasResolvedH2 ? h2ContextMap.get(taskId) : undefined;
                    perfMark = __tmPerfNow();
                    if (hasResolvedH2) {
                        __tmApplyTaskHeadingContext(task, h2ctx);
                    } else if (!h2EnhanceLoaded && __tmTaskHasOwnHeadingContextFields(task)) {
                        __tmCopyTaskHeadingContext(task, task);
                    } else if (!h2EnhanceLoaded && prevTask && typeof prevTask === 'object') {
                        __tmCopyTaskHeadingContext(task, prevTask);
                    } else {
                        __tmApplyTaskHeadingContext(task, '');
                    }
                    normalizeMetrics.headingMs += (__tmPerfNow() - perfMark);
                    perfMark = __tmPerfNow();
                    const semanticContent = String(task.content || '').trim();
                    const semanticDocId = String(task.root_id || '').trim();
                    const semanticH2Id = String(task.h2Id || '').trim();
                    const semanticCreatedTs = __tmParseCreatedTs(task.created);
                    const semanticKey = `${semanticDocId}::${semanticH2Id}::${semanticContent}`;
                    const isPendingInserted = !!task.__tmPendingInserted;
                    if (semanticDocId && semanticContent) {
                        if (!semanticTaskBuckets.has(semanticKey)) semanticTaskBuckets.set(semanticKey, []);
                        const bucket = semanticTaskBuckets.get(semanticKey);
                        const duplicateLive = bucket.find((item) => {
                            if (!!item.isPending === isPendingInserted) return false;
                            const a = Number(item.createdTs) || 0;
                            const b = Number(semanticCreatedTs) || 0;
                            if (!a || !b) return false;
                            return Math.abs(a - b) <= 120000;
                        });
                        if (duplicateLive && isPendingInserted) {
                            try { globalThis.__tmTaskStore?.removePending?.(String(task.id || '').trim()); } catch (e) {}
                            continue;
                        }
                        if (duplicateLive && !isPendingInserted) {
                            const pendingDupId = String(duplicateLive.id || '').trim();
                            if (pendingDupId && nextFlatTasks[pendingDupId]) delete nextFlatTasks[pendingDupId];
                            if (pendingDupId) {
                                try { globalThis.__tmTaskStore?.removePending?.(pendingDupId); } catch (e) {}
                            }
                        }
                        bucket.push({
                            id: String(task.id || '').trim(),
                            createdTs: semanticCreatedTs,
                            isPending: isPendingInserted,
                        });
                    }
                    normalizeMetrics.semanticMs += (__tmPerfNow() - perfMark);

                    // 初始化 MetaStore（如果不存在）
                    perfMark = __tmPerfNow();
                    if (!metaStoreData[task.id] || typeof metaStoreData[task.id] !== 'object') {
                        metaStoreData[task.id] = {
                            priority: task.priority || '',
                            duration: task.duration || '',
                            remark: task.remark || '',
                            completionTime: task.completionTime || '',
                            customTime: task.customTime || '',
                            content: task.content,
                            repeatHistory: task.repeatHistory || [],
                        };
                        metaSeedCount += 1;
                        metaSeedDirty = true;
                    }
                    normalizeMetrics.metaSeedMs += (__tmPerfNow() - perfMark);

                    // 初始化层级（后续递归计算覆盖）
                    task.level = 0;

                    if (!tasksByDoc.has(task.root_id)) {
                        tasksByDoc.set(task.root_id, []);
                    }
                    tasksByDoc.get(task.root_id).push(task);
                    nextFlatTasks[task.id] = task;
                    perfMark = __tmPerfNow();
                    const repeatHistory = Array.isArray(task.repeatHistory) ? task.repeatHistory : [];
                    if (repeatHistory.length > 0) {
                        repeatHistory.forEach((historyItem, historyIndex) => {
                            const virtualTask = __tmBuildRecurringInstanceTask(task, historyItem, historyIndex);
                            if (!virtualTask?.id) return;
                            if (!tasksByDoc.has(virtualTask.root_id)) tasksByDoc.set(virtualTask.root_id, []);
                            tasksByDoc.get(virtualTask.root_id).push(virtualTask);
                            nextFlatTasks[virtualTask.id] = virtualTask;
                            virtualTaskCount += 1;
                        });
                    }
                    const repeatRule = (task.repeatRule && typeof task.repeatRule === 'object') ? task.repeatRule : null;
                    if (!task.done && repeatRule?.enabled && repeatRule.trigger === 'due' && repeatRule.type !== 'none') {
                        recurringDueCandidateIds.push(String(task.id || '').trim());
                    }
                    normalizeMetrics.virtualMs += (__tmPerfNow() - perfMark);
                }
                if (metaSeedDirty) {
                    try { MetaStore.scheduleSave(); } catch (e) {}
                }
                __tmPerfTraceMark(perfTrace, 'normalize', {
                    taskCount: Array.isArray(res.tasks) ? res.tasks.length : 0,
                    docBucketCount: tasksByDoc.size,
                    virtualTaskCount,
                    visibleDateFallbackCount: visibleDateFallbackTaskIds.size,
                    metaSeedCount,
                    taskTargetPrepMs: __tmRoundPerfMs(normalizeMetrics.taskTargetPrepMs),
                    enhancePlanMs: __tmRoundPerfMs(normalizeMetrics.enhancePlanMs),
                    enhanceBundleMs: __tmRoundPerfMs(normalizeMetrics.enhanceBundleMs),
                    optionsPrepMs: __tmRoundPerfMs(normalizeMetrics.optionsPrepMs),
                    parseMs: __tmRoundPerfMs(normalizeMetrics.parseMs),
                    mergeVisibleMs: __tmRoundPerfMs(normalizeMetrics.mergeVisibleMs),
                    fieldsMs: __tmRoundPerfMs(normalizeMetrics.fieldsMs),
                    headingMs: __tmRoundPerfMs(normalizeMetrics.headingMs),
                    semanticMs: __tmRoundPerfMs(normalizeMetrics.semanticMs),
                    metaSeedMs: __tmRoundPerfMs(normalizeMetrics.metaSeedMs),
                    virtualMs: __tmRoundPerfMs(normalizeMetrics.virtualMs),
                    preludeMs: __tmRoundPerfMs(
                        normalizeMetrics.taskTargetPrepMs
                        + normalizeMetrics.enhancePlanMs
                        + normalizeMetrics.enhanceBundleMs
                        + normalizeMetrics.optionsPrepMs
                    ),
                    enhanceCacheHit: enhanceBundleMeta?.cacheHit ? 1 : 0,
                    enhanceDocCount: Number(enhanceBundleMeta?.docCount || 0),
                    enhanceDocConcurrency: Number(enhanceBundleMeta?.docConcurrency || 0),
                    enhanceTaskDocMapMs: __tmRoundPerfMs(Number(enhanceBundleMeta?.taskDocMapMs || 0)),
                    enhanceSnapshotMs: __tmRoundPerfMs(Number(enhanceBundleMeta?.snapshotMs || 0)),
                    enhanceFallbackFlowMs: __tmRoundPerfMs(Number(enhanceBundleMeta?.fallbackFlowMs || 0)),
                    enhanceFallbackH2Ms: __tmRoundPerfMs(Number(enhanceBundleMeta?.fallbackH2Ms || 0)),
                    enhanceFallbackH2RecoveredCount: Number(enhanceBundleMeta?.fallbackH2RecoveredCount || 0),
                    enhanceMissingFlowCount: Number(enhanceBundleMeta?.missingFlowCount || 0),
                    enhanceMissingH2Count: Number(enhanceBundleMeta?.missingH2Count || 0),
                    durationMs: __tmRoundPerfMs(Date.now() - normalizeStartTime),
                });
                if (abortSnapshotCacheVerifyIfContextChanged('after-normalize', {
                    taskCount: Array.isArray(res.tasks) ? res.tasks.length : 0,
                    docBucketCount: tasksByDoc.size,
                })) return;
                const rootTasksByDoc = new Map();
                let parentLinkStats = {
                    docCount: 0,
                    taskCount: 0,
                    directResolvedCount: 0,
                    joinedResolvedCount: 0,
                    listParentResolvedCount: 0,
                    joinedMissingInDocCount: 0,
                    fallbackCandidateCount: 0,
                    fallbackQueryCount: 0,
                    fallbackResolvedCount: 0,
                    missingParentInDocCount: 0,
                };
                const parentLinkResults = [];
                const parentLinkStartedAt = Date.now();
                const resolveParentLinksSequentially = loadBudget.enabled;
                if (resolveParentLinksSequentially) {
                    for (let i = 0; i < allDocIds.length; i += 1) {
                        const docId = allDocIds[i];
                        if (i > 0) await yieldToBrowser();
                        if (!isTokenCurrent()) break;
                        const rawTasks = tasksByDoc.get(docId) || [];
                        const fastSwitchFirstPaint = false;
                        const parentLinkOptions = {
                            docId,
                            source: 'load-selected-documents',
                            yieldEvery: fastSwitchFirstPaint ? 4 : 16,
                            allowOldRelationshipFallback: !fastSwitchFirstPaint,
                        };
                        if (fastSwitchFirstPaint) {
                            parentLinkOptions.parentLookupDepth = 0;
                        } else if (Number.isFinite(parentLookupDepthOption)) {
                            parentLinkOptions.parentLookupDepth = Math.max(0, Math.round(parentLookupDepthOption));
                        }
                        try {
                            const resolvedParentLinks = await __tmResolveDocTaskParentLinks(rawTasks, parentLinkOptions);
                            parentLinkResults.push({
                                docId,
                                rootTasks: Array.isArray(resolvedParentLinks?.rootTasks) ? resolvedParentLinks.rootTasks : [],
                                stats: (resolvedParentLinks?.stats && typeof resolvedParentLinks.stats === 'object')
                                    ? resolvedParentLinks.stats
                                    : null,
                            });
                        } catch (e) {
                            parentLinkResults.push({
                                docId,
                                rootTasks: Array.isArray(rawTasks) ? rawTasks.slice() : [],
                                stats: null,
                            });
                        }
                    }
                } else {
                    const resolvedParentLinks = await Promise.all(allDocIds.map(async (docId) => {
                        const rawTasks = tasksByDoc.get(docId) || [];
                        const fastSwitchFirstPaint = false;
                        const parentLinkOptions = {
                            docId,
                            source: 'load-selected-documents',
                            yieldEvery: fastSwitchFirstPaint ? 4 : 0,
                            allowOldRelationshipFallback: !fastSwitchFirstPaint,
                        };
                        if (fastSwitchFirstPaint) {
                            parentLinkOptions.parentLookupDepth = 0;
                        } else if (Number.isFinite(parentLookupDepthOption)) {
                            parentLinkOptions.parentLookupDepth = Math.max(0, Math.round(parentLookupDepthOption));
                        }
                        try {
                            const resolvedParentLinks2 = await __tmResolveDocTaskParentLinks(rawTasks, parentLinkOptions);
                            return {
                                docId,
                                rootTasks: Array.isArray(resolvedParentLinks2?.rootTasks) ? resolvedParentLinks2.rootTasks : [],
                                stats: (resolvedParentLinks2?.stats && typeof resolvedParentLinks2.stats === 'object')
                                    ? resolvedParentLinks2.stats
                                    : null,
                            };
                        } catch (e) {
                            return {
                                docId,
                                rootTasks: Array.isArray(rawTasks) ? rawTasks.slice() : [],
                                stats: null,
                            };
                        }
                    }));
                    parentLinkResults.push(...resolvedParentLinks);
                }
                parentLinkResults.forEach((result) => {
                    rootTasksByDoc.set(result.docId, Array.isArray(result.rootTasks) ? result.rootTasks : []);
                    const stats = (result?.stats && typeof result.stats === 'object')
                        ? result.stats
                        : null;
                    if (!stats) return;
                    parentLinkStats.docCount += 1;
                    parentLinkStats.taskCount += Number(stats.taskCount || 0);
                    parentLinkStats.directResolvedCount += Number(stats.directResolvedCount || 0);
                    parentLinkStats.joinedResolvedCount += Number(stats.joinedResolvedCount || 0);
                    parentLinkStats.listParentResolvedCount += Number(stats.listParentResolvedCount || 0);
                    parentLinkStats.joinedMissingInDocCount += Number(stats.joinedMissingInDocCount || 0);
                    parentLinkStats.fallbackCandidateCount += Number(stats.fallbackCandidateCount || 0);
                    parentLinkStats.fallbackQueryCount += Number(stats.fallbackQueryCount || 0);
                    parentLinkStats.fallbackResolvedCount += Number(stats.fallbackResolvedCount || 0);
                    parentLinkStats.missingParentInDocCount += Number(stats.missingParentInDocCount || 0);
                });
                __tmPerfTraceMark(perfTrace, 'parent-link', parentLinkStats);
                if (abortSnapshotCacheVerifyIfContextChanged('after-parent-link', {
                    taskCount: Number(parentLinkStats?.taskCount || 0),
                    durationMs: Date.now() - parentLinkStartedAt,
                })) return;
                let siblingOrderRanks = new Map();
                const fastSwitchFirstPaint = false;
                const shouldSkipSiblingRank = fastSwitchFirstPaint || skipSiblingRankFirstPaint;
                const siblingRankStartTime = Date.now();
                if (!shouldSkipSiblingRank && !perfTuning.disableSiblingRank) {
                    try {
                        siblingOrderRanks = await __tmResolveTaskSiblingOrderRanks(tasksByDoc);
                    } catch (e) {
                        siblingOrderRanks = new Map();
                    }
                } else {
                    siblingOrderRanks = new Map();
                }
                __tmPerfTraceMark(perfTrace, 'sibling-rank', {
                    durationMs: __tmRoundPerfMs(Date.now() - siblingRankStartTime),
                    rankCount: siblingOrderRanks instanceof Map ? siblingOrderRanks.size : 0,
                    disabledByPerfFlag: perfTuning.disableSiblingRank || shouldSkipSiblingRank ? 1 : 0,
                    fastSwitchFirstPaint: fastSwitchFirstPaint ? 1 : 0,
                    skipSiblingRankFirstPaint: skipSiblingRankFirstPaint ? 1 : 0,
                });

                // 按文档顺序构建树
                const projectionStartTime = Date.now();
                for (const docId of allDocIds) {
                    // 获取该文档的所有任务
                    const rawTasks = tasksByDoc.get(docId) || [];
                    const cachedDoc = state.allDocuments.find(d => d.id === docId);

                    // 获取文档名称
                    const cachedDocName = String(cachedDoc?.name || '').trim();
                    let docName = cachedDocName || '未命名文档';
                    if (!cachedDocName && rawTasks.length > 0) {
                        docName = String(rawTasks[0].docName || rawTasks[0].doc_name || '').trim() || docName;
                    }
                    const docUpdated = String(cachedDoc?.updated || cachedDoc?.docUpdated || rawTasks?.[0]?.docUpdated || rawTasks?.[0]?.doc_updated || '').trim();
                    const rootTasks = Array.isArray(rootTasksByDoc.get(docId))
                        ? rootTasksByDoc.get(docId)
                        : [];

                    // 关键：前端递归计算层级（保证视图缩进正确）
                    const calcLevel = (tasks, level) => {
                        tasks.forEach(t => {
                            t.level = level;
                            if (t.children && t.children.length > 0) {
                                calcLevel(t.children, level + 1);
                            }
                        });
                    };
                    const preferResolvedFlowOrder = (forceSyncFlowRank || __tmShouldUseResolvedFlowRankForDoc(docId))
                        && rawTasks.some((task) => taskFlowRankMap.has(String(task?.id || '').trim()));
                    if (preferResolvedFlowOrder) __tmSortTaskTreeByDocFlow(rootTasks);
                    else __tmSortTaskTreeBySiblingRankMap(rootTasks, siblingOrderRanks);
                    calcLevel(rootTasks, 0);
                    __tmAssignDocSeqByTree(rootTasks, 0);
                    try { __tmMergeLocalTaskPatchIntoTaskTree([{ tasks: rootTasks }]); } catch (e) {}

                    // 添加到任务树
                    if (rawTasks.length > 0 || state.selectedDocIds.includes(docId) || otherBlockDocIdSet.has(docId) || (quickAddDocId && docId === quickAddDocId)) {
                         nextTaskTree.push({
                            id: docId,
                            name: docName,
                            alias: __tmNormalizeDocAliasValue(cachedDoc?.alias),
                            icon: __tmNormalizeDocIconValue(cachedDoc?.icon),
                            created: String(cachedDoc?.created || '').trim(),
                            updated: docUpdated,
                            docUpdated,
                            tasks: rootTasks
                        });
                    }
                }
                __tmPerfTraceMark(perfTrace, 'projection', {
                    durationMs: __tmRoundPerfMs(Date.now() - projectionStartTime),
                    docCount: Array.isArray(allDocIds) ? allDocIds.length : 0,
                    treeDocCount: nextTaskTree.length,
                });
                if (!isTokenCurrent()) {

                    return;
                }
                state.taskTree = __tmSortDocEntriesByPinned(
                    nextTaskTree || [],
                    String(SettingsStore.data.currentGroupId || 'all').trim() || 'all'
                );
                try {
                    __tmRememberDocSessionTaskEntries(nextTaskTree, {
                        docIds: allDocIds,
                    });
                } catch (e) {}
                globalThis.__tmTaskStore?.replaceFlat?.(nextFlatTasks, { mergeOtherBlocks: true });
                try { __tmReplayQueuedOpOptimisticState?.('after-load-selected-documents'); } catch (e) {}
                try {
                    const activeDocId = String(state.activeDocId || 'all').trim() || 'all';
                    if (activeDocId && activeDocId !== 'all' && !__tmIsOtherBlockTabId(activeDocId)) {
                        const validDocIds = new Set((Array.isArray(state.taskTree) ? state.taskTree : [])
                            .map((doc) => String(doc?.id || '').trim())
                            .filter(Boolean));
                        if (!validDocIds.has(activeDocId)) state.activeDocId = 'all';
                    }
                } catch (e) {}
                try { recalcStats(); } catch (e) {}
                __tmPerfTraceMark(perfTrace, 'enhance', {
                    taskCount: Array.isArray(res.tasks) ? res.tasks.length : 0,
                    deferredH2: deferH2Enhance ? 1 : 0,
                    deferredFlow: deferFlowEnhance ? 1 : 0,
                    parentLinkRounds: Number(parentLinkStats?.rounds || 0),
                    parentLinkQueryCalls: Number(parentLinkStats?.queryCalls || 0),
                    parentLinkResolved: Number(parentLinkStats?.resolvedCount || 0),
                });

                let visibleDateHydrateChanged = false;
                let visibleDateHydrateChangedCount = 0;
                let visibleDateHydrateFailed = false;
                try {
                    const hydrateSourceTasks = Object.values(state.flatTasks || {}).filter((task) => task && typeof task === 'object');
                    const requireVisibleDateBeforeFirstRender = isSwitchDocGroupLoad
                        && stabilizeSwitchGroupView
                        && viewNeedsCompleteVisibleDateAttrs();
                    const deferChecklistVisibleDateHydrate = isSwitchDocGroupLoad
                        && !skipRender
                        && !requireVisibleDateBeforeFirstRender
                        && (runtimeState?.isViewMode?.('checklist') ?? (String(state.viewMode || '').trim() === 'checklist'));
                    if (requireVisibleDateBeforeFirstRender) {
                        const hydrateStartedAt = Date.now();
                        const hydrateMeta = await __tmHydrateChecklistVisibleDateAttrs(hydrateSourceTasks, {
                            reason: 'load-selected-before-stable-first-render',
                            force: true,
                        });
                        visibleDateHydrateChanged = !!hydrateMeta?.changed;
                        visibleDateHydrateChangedCount = Number(hydrateMeta?.changedCount || 0);
                    } else if (deferChecklistVisibleDateHydrate) {
                        const hydrateToken = token;
                        __tmScheduleIdleTask(async () => {
                            try {
                                if (!(runtimeState?.isCurrentOpenToken?.(hydrateToken) ?? hydrateToken === (Number(state.openToken) || 0))) return;
                                const hydrateMeta = await __tmHydrateChecklistVisibleDateAttrs(hydrateSourceTasks, {
                                    reason: 'load-selected-after-first-render',
                                });
                                if (!hydrateMeta?.changed) return;
                                if (!(runtimeState?.isCurrentOpenToken?.(hydrateToken) ?? hydrateToken === (Number(state.openToken) || 0))) return;
                                if (stabilizeSwitchGroupView) {
                                    return;
                                }
                                applyFilters();
                                const deferredModal = getActiveModal();
                                if (!skipRender && deferredModal) {
                                    if (!__tmRerenderCurrentViewInPlace(deferredModal)) render();
                                }
                            } catch (e) {}
                        }, 320);
                    } else {
                        const hydrateStartedAt = Date.now();
                        const hydrateMeta = await __tmHydrateChecklistVisibleDateAttrs(hydrateSourceTasks, {
                            reason: 'load-selected-before-filter',
                        });
                        visibleDateHydrateChanged = !!hydrateMeta?.changed;
                        visibleDateHydrateChangedCount = Number(hydrateMeta?.changedCount || 0);
                    }
                } catch (e) {
                    visibleDateHydrateFailed = true;
                }

                const filterStartedAt = Date.now();
                prepareSwitchGroupFirstPaintWindow();
                let filterRemapped = false;
                let filterSkippedForVerifyContextChange = false;
                let filterRemapSkipReason = '';
                if (snapshotCacheVerifyBefore) {
                    let remapSkipReason = '';
                    try {
                        const currentGroupIdForVerify = String(SettingsStore?.data?.currentGroupId || 'all').trim() || 'all';
                        const currentTaskSignature = buildVerifyTaskSignature(state.flatTasks);
                        const currentDocSignature = buildVerifyDocSignature();
                        if (visibleDateHydrateFailed) remapSkipReason = 'visible-date-hydrate-failed';
                        else if (visibleDateHydrateChanged) remapSkipReason = 'visible-date-changed';
                        else if (currentGroupIdForVerify !== snapshotCacheVerifyBefore.groupId) remapSkipReason = 'group-changed';
                        else if ((String(state.activeDocId || 'all').trim() || 'all') !== snapshotCacheVerifyBefore.activeDocId) remapSkipReason = 'active-doc-changed';
                        else if (getCurrentViewMode('') !== snapshotCacheVerifyBefore.viewMode) remapSkipReason = 'view-mode-changed';
                        else if (String(state.currentRule || '').trim() !== snapshotCacheVerifyBefore.currentRule) remapSkipReason = 'rule-changed';
                        else if (String(state.searchKeyword || '').trim() !== snapshotCacheVerifyBefore.searchKeyword) remapSkipReason = 'search-changed';
                        else if ((state.showCompletedTasks === true ? 1 : 0) !== snapshotCacheVerifyBefore.showCompletedTasks) remapSkipReason = 'completed-toggle-changed';
                        else if ((SettingsStore?.data?.completedTasksTodayOnly === true ? 1 : 0) !== snapshotCacheVerifyBefore.completedTasksTodayOnly) remapSkipReason = 'completed-today-only-changed';
                        else if ((SettingsStore?.data?.completedTasksInlineInGroups === true ? 1 : 0) !== snapshotCacheVerifyBefore.completedTasksInlineInGroups) remapSkipReason = 'completed-inline-groups-changed';
                        else if ((state.docTabsArchiveMode === true ? 1 : 0) !== snapshotCacheVerifyBefore.docTabsArchiveMode) remapSkipReason = 'archive-mode-changed';
                        else if ((state.groupByDocName === true ? 1 : 0) !== snapshotCacheVerifyBefore.groupByDocName) remapSkipReason = 'group-doc-changed';
                        else if ((state.groupByTaskName === true ? 1 : 0) !== snapshotCacheVerifyBefore.groupByTaskName) remapSkipReason = 'group-task-changed';
                        else if ((state.groupByTime === true ? 1 : 0) !== snapshotCacheVerifyBefore.groupByTime) remapSkipReason = 'group-time-changed';
                        else if ((state.quadrantEnabled === true ? 1 : 0) !== snapshotCacheVerifyBefore.quadrantEnabled) remapSkipReason = 'quadrant-changed';
                        else if (!currentTaskSignature || currentTaskSignature !== snapshotCacheVerifyBefore.taskSignature) remapSkipReason = 'task-signature-changed';
                        else if (!currentDocSignature || currentDocSignature !== snapshotCacheVerifyBefore.docSignature) remapSkipReason = 'doc-signature-changed';
                        if (!remapSkipReason) {
                            const nextTasks = [];
                            const taskMap = state.flatTasks || {};
                            const prevIds = Array.isArray(snapshotCacheVerifyBefore.filteredTaskIds)
                                ? snapshotCacheVerifyBefore.filteredTaskIds
                                : [];
                            for (let i = 0; i < prevIds.length; i += 1) {
                                const id = String(prevIds[i] || '').trim();
                                const task = id ? taskMap[id] : null;
                                if (!task) {
                                    remapSkipReason = 'filtered-task-missing';
                                    break;
                                }
                                nextTasks.push(task);
                            }
                            if (!remapSkipReason) {
                                state.filteredTasks = nextTasks;
                                state.filteredDocIdsForTabs = (Array.isArray(snapshotCacheVerifyBefore.filteredDocIdsForTabs)
                                    ? snapshotCacheVerifyBefore.filteredDocIdsForTabs
                                    : []).slice();
                                state.listRenderSignature = String(snapshotCacheVerifyBefore.listRenderSignature || '');
                                state.listRenderLimit = Number(snapshotCacheVerifyBefore.listRenderLimit) || Number(state.listRenderLimit) || 0;
                                state.listRenderStep = Number(snapshotCacheVerifyBefore.listRenderStep) || Number(state.listRenderStep) || 20;
                                const remapDurationMs = Date.now() - filterStartedAt;
                                state.__tmLastFilterPerf = {
                                    cacheHit: 'verify-remap',
                                    visibleMs: 0,
                                    ruleMs: 0,
                                    searchMs: 0,
                                    docTabsMs: 0,
                                    orderMs: __tmRoundPerfMs(remapDurationMs),
                                    totalMs: __tmRoundPerfMs(remapDurationMs),
                                    orderedCount: nextTasks.length,
                                };
                                filterRemapped = true;
                            }
                        }
                    } catch (e) {
                        remapSkipReason = 'exception';
                    }
                    if (!filterRemapped) {
                        filterRemapSkipReason = remapSkipReason || 'unknown';
                        const verifyContextChangedSkipReasons = {
                            'group-changed': true,
                            'active-doc-changed': true,
                            'view-mode-changed': true,
                            'rule-changed': true,
                            'search-changed': true,
                            'completed-toggle-changed': true,
                            'archive-mode-changed': true,
                            'group-doc-changed': true,
                            'group-task-changed': true,
                            'group-time-changed': true,
                            'quadrant-changed': true,
                        };
                        if (isSnapshotCacheVerifyLoad && verifyContextChangedSkipReasons[filterRemapSkipReason]) {
                            filterSkippedForVerifyContextChange = true;
                            state.__tmLastFilterPerf = {
                                cacheHit: 'verify-context-skip',
                                visibleMs: 0,
                                ruleMs: 0,
                                searchMs: 0,
                                docTabsMs: 0,
                                orderMs: 0,
                                totalMs: 0,
                                orderedCount: Array.isArray(state.filteredTasks) ? state.filteredTasks.length : 0,
                            };
                            state.__tmLastCacheVerifyContextChanged = {
                                at: Date.now(),
                                source: sourceLabel,
                                reason: filterRemapSkipReason,
                                groupId: snapshotCacheVerifyBefore.groupId,
                                currentGroupId: String(SettingsStore?.data?.currentGroupId || 'all').trim() || 'all',
                            };
                        }
                    }
                }
                if (!filterRemapped && !filterSkippedForVerifyContextChange) {
                    applyFilters();
                }
                if (isSwitchDocGroupLoad) {
                    prepareSwitchGroupFirstPaintWindow();
                } else if (loadBudget.enabled) {
                    state.listRenderLimit = Math.min(
                        Array.isArray(state.filteredTasks) ? state.filteredTasks.length : 0,
                        initialRenderLimit
                    );
                }
                state.deferredListCustomFieldIds = getCurrentViewMode('') === 'list'
                    ? bulkCustomFieldPlan.deferredListFieldIds.slice()
                    : [];
                const deferredListCustomFieldFieldCount = state.deferredListCustomFieldIds.length;
                let stableListCustomFieldHydrateMeta = null;
                if (deferredListCustomFieldFieldCount > 0 && stabilizeSwitchGroupView) {
                    const listFieldStartedAt = Date.now();
                    try {
                        stableListCustomFieldHydrateMeta = await __tmHydrateVisibleListCustomFields(state.deferredListCustomFieldIds, {
                            limit: Number(state.listRenderLimit) || switchGroupRenderCap,
                            customFieldDefs: normalizeCustomFieldDefs,
                        });
                    } catch (e) {
                        stableListCustomFieldHydrateMeta = null;
                    }
                }
                const deferredListCustomFieldDeferred = deferredListCustomFieldFieldCount > 0 && !stabilizeSwitchGroupView
                    ? (() => {
                        try {
                            return __tmScheduleDeferredVisibleListCustomFieldHydration({
                                delayMs: 180,
                                reason: 'initial-list-custom-fields',
                                customFieldDefs: normalizeCustomFieldDefs,
                            }) ? 1 : 0;
                        } catch (e) {
                            return 0;
                        }
                    })()
                    : 0;
                if (deferredListCustomFieldFieldCount > 0 && stabilizeSwitchGroupView) {
                }
                if (deferredListCustomFieldDeferred === 0 && deferredListCustomFieldFieldCount > 0) {
                    try {
                        await __tmHydrateVisibleListCustomFields(state.deferredListCustomFieldIds, {
                            customFieldDefs: normalizeCustomFieldDefs,
                        });
                    } catch (e) {
                    }
                }
                __tmPerfTraceMark(perfTrace, 'filter', {
                    filteredCount: Array.isArray(state.filteredTasks) ? state.filteredTasks.length : 0,
                    listRenderLimit: Number.isFinite(Number(state.listRenderLimit)) ? Number(state.listRenderLimit) : 0,
                    deferredListCustomFieldMs: 0,
                    deferredListCustomFieldDeferred,
                    deferredListCustomFieldDeferredDelayMs: deferredListCustomFieldDeferred ? 180 : 0,
                    deferredListCustomFieldTaskCount: 0,
                    deferredListCustomFieldFieldCount: Number(deferredListCustomFieldFieldCount || 0),
                    deferredListCustomFieldHostQueryCount: 0,
                    deferredListCustomFieldCacheHitCount: 0,
                    deferredListCustomFieldCacheMissCount: 0,
                    ...((state.__tmLastFilterPerf && typeof state.__tmLastFilterPerf === 'object') ? state.__tmLastFilterPerf : {}),
                });
                __tmPerfTraceMark(perfTrace, 'data-ready', {
                    filteredCount: Array.isArray(state.filteredTasks) ? state.filteredTasks.length : 0,
                    taskCount: Array.isArray(res.tasks) ? res.tasks.length : 0,
                });
                if (isSwitchDocGroupLoad) {
                    try {
                        const whiteboardSnapshotTasks = Object.values(state.flatTasks || {});
                        const switchGroupToken = token;
                        __tmScheduleIdleTask(async () => {
                            try {
                                if (!(runtimeState?.isCurrentOpenToken?.(switchGroupToken) ?? switchGroupToken === (Number(state.openToken) || 0))) return;
                                if (String(SettingsStore?.data?.currentGroupId || 'all').trim() !== currentGroupId) return;
                            } catch (e) {}
                            try {
                                __tmUpsertWhiteboardTaskSnapshots(whiteboardSnapshotTasks, { persist: WhiteboardStore.loaded === true });
                            } catch (e) {}
                            try {
                                if (!(runtimeState?.isCurrentOpenToken?.(switchGroupToken) ?? switchGroupToken === (Number(state.openToken) || 0))) return;
                                if (String(SettingsStore?.data?.currentGroupId || 'all').trim() !== currentGroupId) return;
                                await __tmReconcileRecurringTasksOnLoad(recurringDueCandidateIds, {
                                    todayKey: __tmNormalizeDateOnly(new Date()),
                                });
                            } catch (e) {}
                        }, 120);
                    } catch (e) {}
                } else {
                    const recurringReconcileStartTime = Date.now();
                    try {
                        await __tmReconcileRecurringTasksOnLoad(recurringDueCandidateIds, {
                            todayKey: __tmNormalizeDateOnly(new Date()),
                        });
                    } catch (e) {}
                    __tmPerfTraceMark(perfTrace, 'recurring-reconcile', {
                        durationMs: __tmRoundPerfMs(Date.now() - recurringReconcileStartTime),
                        taskCount: recurringDueCandidateIds.length,
                        deferredByPerfFlag: perfTuning.deferRecurringReconcile ? 1 : 0,
                    });
                }

                const activeModal = getActiveModal();
                if (!skipRender && activeModal && isTokenCurrent()) {
                    try { if (showInlineLoading && Number(state.uiInlineLoadingToken) === token) __tmSetInlineLoading(false); } catch (e) {}
                    const renderStartedAt = Date.now();
                    const shouldPatchCurrentView = isSwitchDocGroupLoad
                        && !forceShellRender
                        && !loadBudget.enabled
                        && String(sourceLabel || '').indexOf(':full') !== -1
                        && typeof __tmRerenderCurrentViewInPlace === 'function';
                    const patchedCurrentView = shouldPatchCurrentView
                        ? !!__tmRerenderCurrentViewInPlace(activeModal)
                        : false;
                    if (!patchedCurrentView) render();
                    __tmPerfTraceMark(perfTrace, 'first-render', {
                        filteredCount: Array.isArray(state.filteredTasks) ? state.filteredTasks.length : 0,
                        fastBudget: loadBudget.enabled ? 1 : 0,
                    });
                    __tmPerfTraceMark(perfTrace, 'render', {
                        filteredCount: Array.isArray(state.filteredTasks) ? state.filteredTasks.length : 0,
                        fastBudget: loadBudget.enabled ? 1 : 0,
                    });
                }
                if (loadBudget.enabled) {
                    scheduleFullLoadAfterFastFirstPaint('query-first-paint');
                }
                if (activeModal && isTokenCurrent()) {
                    try {
                        requestAnimationFrame(() => {
                            try { void __tmMaybeAutoPromptSemanticDates(token).catch(() => null); } catch (e) {}
                        });
                    } catch (e) {
                        try { void __tmMaybeAutoPromptSemanticDates(token).catch(() => null); } catch (e2) {}
                    }
                }
                scheduleDeferredPostLoadWork();
                if ((deferH2Enhance || deferFlowEnhance) && taskIds0.length > 0) {
                    const deferredToken = token;
                    const deferredTaskIds = taskIds0.slice();
                    Promise.resolve().then(async () => {
                        if (!(runtimeState?.isCurrentOpenToken?.(deferredToken) ?? deferredToken === (Number(state.openToken) || 0))) return;
                        let h2Map = new Map();
                        let flowMap = new Map();
                        try {
                            const bundle = await API.fetchTaskEnhanceBundle(deferredTaskIds, {
                                taskDocMap: taskDocMap0,
                                needH2: deferH2Enhance,
                                needFlow: deferFlowEnhance
                            });
                            h2Map = bundle?.h2ContextMap instanceof Map ? bundle.h2ContextMap : new Map();
                            flowMap = bundle?.taskFlowRankMap instanceof Map ? bundle.taskFlowRankMap : new Map();
                        } catch (e) {
                            h2Map = new Map();
                            flowMap = new Map();
                        }
                        if (!(runtimeState?.isCurrentOpenToken?.(deferredToken) ?? deferredToken === (Number(state.openToken) || 0))) return;
                        let changed = false;
                        const flowChangedDocIds = new Set();
                        deferredTaskIds.forEach((id) => {
                            const tid = String(id || '').trim();
                            if (!tid) return;
                            const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid];
                            if (!task) return;
                            if (deferFlowEnhance) {
                                const flowRank = Number(flowMap.get(tid));
                                const docId = String(task?.root_id || task?.docId || '').trim();
                                if (__tmApplyResolvedFlowRankIfNeeded(task, flowRank)) {
                                    if (docId) flowChangedDocIds.add(docId);
                                    changed = true;
                                }
                            }
                            if (deferH2Enhance) {
                                const h2ctx = h2Map.get(tid);
                                const nextH2 = h2ctx && typeof h2ctx === 'object' ? String(h2ctx.content || '').trim() : String(h2ctx || '').trim();
                                const nextH2Id = h2ctx && typeof h2ctx === 'object' ? String(h2ctx.id || '').trim() : '';
                                const nextH2Path = h2ctx && typeof h2ctx === 'object' ? String(h2ctx.path || '').trim() : '';
                                const nextH2Sort = h2ctx && typeof h2ctx === 'object' ? Number(h2ctx.sort) : Number.NaN;
                                const nextH2Created = h2ctx && typeof h2ctx === 'object' ? String(h2ctx.created || '').trim() : '';
                                const nextH2Rank = h2ctx && typeof h2ctx === 'object' ? Number(h2ctx.rank) : Number.NaN;
                                if (String(task.h2 || '').trim() !== nextH2
                                    || String(task.h2Id || '').trim() !== nextH2Id
                                    || String(task.h2Path || '').trim() !== nextH2Path
                                    || Number(task.h2Sort) !== nextH2Sort
                                    || String(task.h2Created || '').trim() !== nextH2Created
                                    || Number(task.h2Rank) !== nextH2Rank) {
                                    task.h2 = nextH2;
                                    task.h2Id = nextH2Id;
                                    task.h2Path = nextH2Path;
                                    task.h2Sort = nextH2Sort;
                                    task.h2Created = nextH2Created;
                                    task.h2Rank = nextH2Rank;
                                    changed = true;
                                }
                            }
                        });
                        if (deferFlowEnhance && flowChangedDocIds.size > 0 && __tmReorderLoadedDocsByResolvedFlow(flowChangedDocIds)) {
                            changed = true;
                        }
                        if (!changed || !(runtimeState?.isCurrentOpenToken?.(deferredToken) ?? deferredToken === (Number(state.openToken) || 0))) return;
                        applyFilters();
                        const deferredModal = getActiveModal();
                        if (!skipRender && deferredModal && (runtimeState?.isCurrentOpenToken?.(deferredToken) ?? deferredToken === (Number(state.openToken) || 0))) {
                            if (!__tmRerenderCurrentViewInPlace(deferredModal)) render();
                        }
                    }).catch(() => null);
                }
                __tmPerfTraceMark(perfTrace, 'full-ready', {
                    docCount: Array.isArray(allDocIds) ? allDocIds.length : 0,
                    taskCount: Array.isArray(res.tasks) ? res.tasks.length : 0,
                    filteredCount: Array.isArray(state.filteredTasks) ? state.filteredTasks.length : 0,
                    fastBudget: loadBudget.enabled ? 1 : 0,
                    deferredEnhancePending: (deferH2Enhance || deferFlowEnhance) ? 1 : 0,
                });
                if (forceFreshTasks && !loadBudget.enabled) {
                    state.__tmCacheFirstPaintNeedsVerify = false;
                    state.__tmCacheFirstPaintVerifyGroupId = '';
                    state.__tmLastCacheVerifyAt = Date.now();
                }
                if (!loadBudget.enabled && (!skipRender || (forceFreshTasks && !filterRemapped && !filterSkippedForVerifyContextChange))) {
                    try {
                        globalThis.__tmTaskSnapshotService?.schedulePersist?.({
                            docIds: allDocIds,
                            groupId: currentGroupId,
                            queryLimit: effectiveQueryLimit,
                            forceFullLoadBudget: false,
                            taskCountMap: taskCountMapMeta?.map,
                        });
                    } catch (e) {}
                }
                if (!loadBudget.enabled) {
                    try {
                        __tmRememberGroupSessionTaskState({
                            docIds: allDocIds,
                            groupId: currentGroupId,
                            viewMode: getCurrentViewMode('list'),
                            customFieldIds: bulkCustomFieldPlan.bulkFieldIds,
                            source: sourceLabel,
                        });
                    } catch (e) {}
                    try {
                        __tmSchedulePersistTaskIndex({
                            docIds: allDocIds,
                            queryLimit: effectiveQueryLimit,
                            taskCountMap: taskCountMapMeta?.map,
                            delayMs: 500,
                        });
                    } catch (e) {}
                }

            }
        } catch (e) {

            console.error('[加载] 获取任务失败:', e);
            hint('❌ 加载任务失败', 'error');
        } finally {
            if (showInlineLoading && Number(state.uiInlineLoadingToken) === token) {
                try { __tmSetInlineLoading(false); } catch (e) {}
            }
        }
        } catch (e) {

            try { console.error('[加载] 获取任务失败:', e); } catch (e2) {}
            try { hint('❌ 加载任务失败', 'error'); } catch (e3) {}
        } finally {
            clearInlineLoadingWatchdog();
            clearInlineLoadingForCurrentToken();
        }
    }
