    function __tmBuildRenderSceneWhiteboardBodyHtml(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const bodyAnimClass = String(opts.bodyAnimClass || '');
        const isMobile = !!opts.isMobile;
        const isDockHost = !!opts.isDockHost;

        const __tmRenderWhiteboardBodyHtml = () => {
            const filtered = Array.isArray(state.filteredTasks) ? state.filteredTasks : [];
            const alwaysVisibleHeadingTasks = __tmGetAlwaysVisibleTaskDocHeadingTasks();
            try { __tmUpsertWhiteboardTaskSnapshots(filtered, { persist: false }); } catch (e) {}
            const orderMap = new Map(filtered.map((t, i) => [String(t?.id || '').trim(), i]));
            const getOrder = (taskId) => orderMap.get(String(taskId || '').trim()) ?? 999999;
            const isDark = __tmIsDarkMode();
            const escSq = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const whiteboardCardFields = new Set(__tmGetTaskCardFieldList('whiteboard'));
            const keepCompletedStatusChip = __tmTaskCardAlwaysShowFieldEnabled('status');
            const isKanbanCompact = !!SettingsStore.data.kanbanCompactMode;
            const todayKey = __tmNormalizeDateOnly(new Date());
            const tomatoFocusTaskId = SettingsStore.data.enableTomatoIntegration ? String(state.timerFocusTaskId || '').trim() : '';
            const tomatoFocusModeEnabled = tomatoFocusTaskId ? __tmIsTomatoFocusModeEnabled() : false;
            const showDoneTasks = !!state.showCompletedTasks;
            const statusOptionsRaw = Array.isArray(SettingsStore.data.customStatusOptions) ? SettingsStore.data.customStatusOptions : [];
            const statusOptions = statusOptionsRaw
                .map(o => ({ id: String(o?.id || '').trim(), name: String(o?.name || '').trim(), color: String(o?.color || '').trim() }))
                .filter(o => o.id);
            const todoOpt = statusOptions.find(o => o.id === 'todo') || { id: 'todo', name: '待办', color: '#757575' };
            const currentGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
            const docsInOrder0 = __tmSortDocEntriesForTabs(state.taskTree || [], currentGroupId).map(d => String(d?.id || '').trim()).filter(Boolean);
            const visibleDocIds = (typeof __tmGetVisibleDocTabsForCurrentGroup === 'function'
                ? __tmGetVisibleDocTabsForCurrentGroup()
                : docsInOrder0).map((doc) => String(doc?.id || doc || '').trim()).filter(Boolean);
            const visibleDocIdSet = new Set(visibleDocIds);
            const docNameById = new Map((state.taskTree || []).map(d => [String(d?.id || '').trim(), String(d?.name || '').trim() || '未命名文档']));
            const snapMap = __tmGetWhiteboardCardSnapshotMap();
            // 仅使用当前分组已加载文档，避免把其他分组/历史快照文档混入“全部页签”白板
            const docsInOrder = docsInOrder0;
            let detachedMap = __tmGetDetachedChildrenMap();
            const enableDocH2Subgroup = SettingsStore.data.docH2SubgroupEnabled !== false;
            const headingLevel = String(SettingsStore.data.taskHeadingLevel || 'h2').trim() || 'h2';
            const headingLabelMap = { h1: '一级标题', h2: '二级标题', h3: '三级标题', h4: '四级标题', h5: '五级标题', h6: '六级标题' };
            const noHeadingLabel = `无${headingLabelMap[headingLevel] || '标题'}`;
            let notes = Array.isArray(SettingsStore.data.whiteboardNotes) ? SettingsStore.data.whiteboardNotes : [];
            let drawings = Array.isArray(SettingsStore.data.whiteboardDrawings) ? SettingsStore.data.whiteboardDrawings : [];
            let frames = Array.isArray(SettingsStore.data.whiteboardFrames) ? SettingsStore.data.whiteboardFrames : [];
            const drawingConfig = (typeof __tmNormalizeWhiteboardDrawingConfig === 'function')
                ? __tmNormalizeWhiteboardDrawingConfig(SettingsStore.data.whiteboardDrawingConfig)
                : (SettingsStore.data.whiteboardDrawingConfig || {});
            const noteColorOptions = ['#1f2937', '#2f6fed', '#16a34a', '#d97706', '#b91c1c', '#7c3aed'];
            const frameColorOptions = ['#dbeafe', '#dcfce7', '#fef3c7', '#fee2e2', '#ede9fe', '#e0f2fe'];
            const stickyThemeOptions = __tmGetWhiteboardStickyThemes();
            let view = __tmGetWhiteboardView();
            let posMap = { ...__tmGetWhiteboardNodePosMap() };
            let placedMap = { ...__tmGetWhiteboardPlacedTaskMap() };
            let posDirty = false;
            let placedDirty = false;
            const isDetachedTask = (taskId) => {
                const v = detachedMap[String(taskId || '').trim()];
                return !!(v && typeof v === 'object' && v.detached === true);
            };
            const whiteboardChildStatsByParentId = (typeof __tmKanbanBuildChildTasksByParentId === 'function')
                ? __tmKanbanBuildChildTasksByParentId()
                : null;
            const whiteboardDirectChildStatsMemo = new Map();
            const getWhiteboardDirectChildStats = (task, fallbackChildren = []) => {
                const id = String(task?.id || '').trim();
                if (id && whiteboardDirectChildStatsMemo.has(id)) return whiteboardDirectChildStatsMemo.get(id);
                let allChildren = [];
                if (id && typeof __tmKanbanGetChildTasksByParentId === 'function') {
                    allChildren = __tmKanbanGetChildTasksByParentId(id, whiteboardChildStatsByParentId);
                }
                if (!allChildren.length && Array.isArray(task?.children)) allChildren = task.children;
                if (!allChildren.length && Array.isArray(fallbackChildren)) allChildren = fallbackChildren;
                const seen = new Set();
                const uniqueChildren = (Array.isArray(allChildren) ? allChildren : []).filter((child) => {
                    const cid = String(child?.id || '').trim();
                    if (!cid || seen.has(cid)) return false;
                    seen.add(cid);
                    return true;
                });
                const stats = {
                    total: uniqueChildren.length,
                    completed: uniqueChildren.reduce((sum, child) => sum + (isWhiteboardTaskDone(child) ? 1 : 0), 0),
                };
                stats.remaining = Math.max(0, stats.total - stats.completed);
                if (id) whiteboardDirectChildStatsMemo.set(id, stats);
                return stats;
            };
            const isWhiteboardTaskDone = (task) => {
                try {
                    return typeof __tmIsTaskDoneEffective === 'function'
                        ? !!__tmIsTaskDoneEffective(task, statusOptions)
                        : !!task?.done;
                } catch (e) {
                    return !!task?.done;
                }
            };

            const activeDocId = String(state.activeDocId || '').trim();
            const activeDocTabCustomGroupDocIds = (typeof __tmGetActiveDocTabCustomGroupDocIdSet === 'function')
                ? __tmGetActiveDocTabCustomGroupDocIdSet(activeDocId, {
                    currentGroupId,
                    docs: state.taskTree || []
                })
                : null;
            const isDocTabCustomGroupActive = activeDocTabCustomGroupDocIds instanceof Set && activeDocTabCustomGroupDocIds.size > 0;
            const selectedDocIds = isDocTabCustomGroupActive
                ? docsInOrder.filter((id) => activeDocTabCustomGroupDocIds.has(String(id || '').trim()) && visibleDocIdSet.has(String(id || '').trim()))
                : ((state.activeDocId && state.activeDocId !== 'all')
                    ? [String(state.activeDocId)]
                    : visibleDocIds);
            const isAllTabsView = !(state.activeDocId && state.activeDocId !== 'all') || isDocTabCustomGroupActive;
            const allTabsLayoutMode = __tmGetWhiteboardAllTabsLayoutMode();
            const isGlobalBoardMode = isAllTabsView && allTabsLayoutMode === 'global';
            const globalWhiteboardGroupId = __tmGetWhiteboardGlobalBoardGroupId(currentGroupId);
            const globalWhiteboardProjection = isGlobalBoardMode && typeof __tmProjectGlobalWhiteboard === 'function'
                ? __tmProjectGlobalWhiteboard(globalWhiteboardGroupId)
                : null;
            const globalWhiteboardBoard = isGlobalBoardMode
                ? (globalWhiteboardProjection?.board || __tmGetWhiteboardGlobalBoardState(globalWhiteboardGroupId))
                : null;
            const globalWhiteboardTaskMap = globalWhiteboardProjection?.taskMap instanceof Map
                ? globalWhiteboardProjection.taskMap
                : new Map();
            const globalCollectionDocId = String(globalWhiteboardProjection?.collectionDocId || '').trim();
            const globalHistoricalDocIds = Array.from(globalWhiteboardTaskMap.values())
                .filter((task) => task?.__tmGlobalFrozen || task?.__tmGlobalRetained)
                .map((task) => String(task?.root_id || task?.docId || '').trim())
                .filter(Boolean);
            const globalCanvasSourceDocIds = Array.from(new Set(selectedDocIds
                .concat(globalCollectionDocId ? [globalCollectionDocId] : [])
                .concat(globalHistoricalDocIds)));
            if (globalCollectionDocId && !docNameById.has(globalCollectionDocId)) {
                const collectionDoc = (Array.isArray(state.allDocuments) ? state.allDocuments : [])
                    .find((doc) => String(doc?.id || '').trim() === globalCollectionDocId);
                docNameById.set(globalCollectionDocId, String(collectionDoc?.name || '').trim() || '全局收集文档');
            }
            const globalCollectionVisibleTaskIds = (() => {
                if (!isGlobalBoardMode || !globalCollectionDocId) return new Set();
                let tasks = Array.from(globalWhiteboardTaskMap.values()).filter((task) => (
                    !task?.__tmGlobalFrozen
                    && String(task?.root_id || task?.docId || '').trim() === globalCollectionDocId
                ));
                try {
                    const currentRule = typeof __tmGetCurrentRule === 'function' ? __tmGetCurrentRule() : null;
                    const rule = typeof __tmGetArchiveModeFilterRule === 'function'
                        ? __tmGetArchiveModeFilterRule(currentRule, state.docTabsArchiveMode === true)
                        : currentRule;
                    const ruleActsAsAll = typeof __tmIsAllRuleLike === 'function' ? __tmIsAllRuleLike(rule) : !rule;
                    if (!ruleActsAsAll && Array.isArray(rule?.conditions) && rule.conditions.length > 0) {
                        tasks = RuleManager.applyRuleFilter(tasks, rule, {
                            fieldInfoCache: new Map(),
                            valueMemo: new WeakMap(),
                            selectValueMemo: new WeakMap(),
                            timeValueMemo: new WeakMap(),
                            timeSortMemo: new Map(),
                        });
                    }
                } catch (e) {}
                const keyword = String(state.searchKeyword || '').trim();
                if (keyword && typeof __tmTaskMatchesSearch === 'function') {
                    tasks = tasks.filter((task) => __tmTaskMatchesSearch(task, keyword));
                }
                return new Set(tasks.map((task) => String(task?.id || '').trim()).filter(Boolean));
            })();
            if (isGlobalBoardMode && globalWhiteboardBoard) {
                notes = Array.isArray(globalWhiteboardBoard.notes) ? globalWhiteboardBoard.notes : [];
                drawings = Array.isArray(globalWhiteboardBoard.drawings) ? globalWhiteboardBoard.drawings : [];
                frames = Array.isArray(globalWhiteboardBoard.frames) ? globalWhiteboardBoard.frames : [];
                posMap = { ...((globalWhiteboardBoard.nodePos && typeof globalWhiteboardBoard.nodePos === 'object') ? globalWhiteboardBoard.nodePos : {}) };
                placedMap = { ...((globalWhiteboardBoard.placedTaskIds && typeof globalWhiteboardBoard.placedTaskIds === 'object') ? globalWhiteboardBoard.placedTaskIds : {}) };
                detachedMap = { ...((globalWhiteboardBoard.detachedChildren && typeof globalWhiteboardBoard.detachedChildren === 'object') ? globalWhiteboardBoard.detachedChildren : {}) };
                view = __tmGetWhiteboardView();
            }
            const docIdSet = new Set(isGlobalBoardMode ? globalCanvasSourceDocIds : selectedDocIds);
            const byDoc = new Map();
            const pushDocTask = (taskLike) => {
                if (!taskLike || typeof taskLike !== 'object') return;
                const docId = String(taskLike?.root_id || taskLike?.docId || '').trim();
                const id = String(taskLike?.id || '').trim();
                if (!docId || !id || !docIdSet.has(docId)) return;
                if (!showDoneTasks && isWhiteboardTaskDone(taskLike)) return;
                if (!byDoc.has(docId)) byDoc.set(docId, []);
                const list = byDoc.get(docId);
                if (list.some(x => String(x?.id || '').trim() === id)) return;
                list.push(taskLike);
            };
            filtered.forEach((task) => {
                pushDocTask(task);
            });
            if (isGlobalBoardMode) {
                globalWhiteboardTaskMap.forEach((task) => {
                    const docId = String(task?.root_id || task?.docId || '').trim();
                    const id = String(task?.id || '').trim();
                    const historical = task?.__tmGlobalFrozen || task?.__tmGlobalRetained;
                    if (!historical && (docId !== globalCollectionDocId || !globalCollectionVisibleTaskIds.has(id))) return;
                    pushDocTask(task);
                });
            }
            Object.keys(snapMap || {}).forEach((id) => {
                const snap = snapMap[id];
                if (!snap || typeof snap !== 'object') return;
                const docId = String(snap.docId || '').trim();
                if (!docId || !docIdSet.has(docId)) return;
                if (state.flatTasks?.[id]) return;
                const snapHeadingLevel = String(snap.headingLevel || '').trim();
                const useSnapHeading = snapHeadingLevel ? (snapHeadingLevel === headingLevel) : (headingLevel === 'h2');
                pushDocTask({
                    id: String(id || '').trim(),
                    content: String(snap.content || '').trim() || '(无内容)',
                    root_id: docId,
                    docId,
                    parentTaskId: String(snap.parentTaskId || '').trim(),
                    h2: useSnapHeading ? String(snap.h2 || '').trim() : '',
                    h2Id: useSnapHeading ? String(snap.h2Id || '').trim() : '',
                    h2Path: useSnapHeading ? String(snap.h2Path || '').trim() : '',
                    h2Sort: useSnapHeading ? Number(snap.h2Sort) : Number.NaN,
                    h2Created: useSnapHeading ? String(snap.h2Created || '').trim() : '',
                    h2Rank: useSnapHeading ? Number(snap.h2Rank) : Number.NaN,
                    startDate: String(snap.startDate || '').trim(),
                    completionTime: String(snap.completionTime || '').trim(),
                    done: !!snap.done,
                    __tmGhost: true,
                });
            });
            Object.keys(placedMap).forEach((taskId) => {
                const id = String(taskId || '').trim();
                if (!id || !placedMap[id]) return;
                if (isGlobalBoardMode && globalWhiteboardTaskMap.has(id)) {
                    pushDocTask(globalWhiteboardTaskMap.get(id));
                    return;
                }
                if (state.flatTasks?.[id]) {
                    pushDocTask(state.flatTasks[id]);
                    return;
                }
                const snap = snapMap[id];
                if (!snap || typeof snap !== 'object') return;
                const snapHeadingLevel = String(snap.headingLevel || '').trim();
                const useSnapHeading = snapHeadingLevel ? (snapHeadingLevel === headingLevel) : (headingLevel === 'h2');
                pushDocTask({
                    id,
                    content: String(snap.content || '').trim() || '(无内容)',
                    root_id: String(snap.docId || '').trim(),
                    docId: String(snap.docId || '').trim(),
                    parentTaskId: String(snap.parentTaskId || '').trim(),
                    h2: useSnapHeading ? String(snap.h2 || '').trim() : '',
                    h2Id: useSnapHeading ? String(snap.h2Id || '').trim() : '',
                    h2Path: useSnapHeading ? String(snap.h2Path || '').trim() : '',
                    h2Sort: useSnapHeading ? Number(snap.h2Sort) : Number.NaN,
                    h2Created: useSnapHeading ? String(snap.h2Created || '').trim() : '',
                    h2Rank: useSnapHeading ? Number(snap.h2Rank) : Number.NaN,
                    startDate: String(snap.startDate || '').trim(),
                    completionTime: String(snap.completionTime || '').trim(),
                    done: !!snap.done,
                    __tmGhost: true,
                });
            });
            Object.keys(placedMap).forEach((id) => {
                const tid = String(id || '').trim();
                if (tid) return;
                delete placedMap[id];
                placedDirty = true;
            });
            if (state.whiteboardSelectedTaskId) {
                const selId = String(state.whiteboardSelectedTaskId || '').trim();
                // 子任务通常不会单独标记为 placed，不应因此丢失选中；仅在任务不存在时清理选中态
                if (selId && !state.flatTasks?.[selId] && !snapMap?.[selId] && !globalWhiteboardTaskMap.has(selId)) {
                    state.whiteboardSelectedTaskId = '';
                }
            }
            // 不在这里按完成状态强制清空选中，避免点击已完成卡片后选中态立即丢失。
            // 仅当任务真实不存在时（见上方分支）才清理选中态。

            const allView = isAllTabsView;
            if (allView && allTabsLayoutMode === 'stream') {
                const streamDocIds = (typeof __tmGetVisibleDocTabsForCurrentGroup === 'function'
                    ? __tmGetVisibleDocTabsForCurrentGroup().map((doc) => String(doc?.id || '').trim()).filter(Boolean)
                    : selectedDocIds.slice());
                const streamDocIdSet = new Set(streamDocIds);
                const streamByDoc = new Map();
                filtered.forEach((task) => {
                    if (!task || typeof task !== 'object') return;
                    const docId = String(task?.root_id || task?.docId || '').trim();
                    const id = String(task?.id || '').trim();
                    if (!docId || !id || !streamDocIdSet.has(docId)) return;
                    if (!streamByDoc.has(docId)) streamByDoc.set(docId, []);
                    const list = streamByDoc.get(docId);
                    if (list.some((item) => String(item?.id || '').trim() === id)) return;
                    list.push(task);
                });
                const alwaysVisibleHeadingDocIds = new Set(alwaysVisibleHeadingTasks
                    .map((task) => String(task?.root_id || task?.docId || '').trim())
                    .filter(Boolean));
                const visibleDocIds0 = streamDocIds.filter((docId) => {
                    const did = String(docId || '').trim();
                    return (streamByDoc.get(did) || []).length > 0 || alwaysVisibleHeadingDocIds.has(did);
                });
                const orderedVisibleDocIds = __tmGetWhiteboardAllTabsOrderedDocIds(currentGroupId, visibleDocIds0);
                state.whiteboardAllTabsVisibleDocIds = orderedVisibleDocIds.slice();
                state.whiteboardAllTabsBaseDocIds = docsInOrder0.slice();
                if (!orderedVisibleDocIds.includes(String(state.whiteboardAllTabsDocDragId || '').trim())) {
                    state.whiteboardAllTabsDocDragId = '';
                }
                const streamGap = isMobile ? 10 : 16;
                const streamMinCardWidth = Math.max(220, Math.min(520, Number(SettingsStore.data.whiteboardAllTabsCardMinWidth) || 320));
                const mobileTwoCols = SettingsStore.data.whiteboardStreamMobileTwoColumns !== false;
                const modalWidth = Math.round(Number(state.modal?.getBoundingClientRect?.().width) || Number(state.modal?.clientWidth) || 0);
                const bodyWidth = Math.max(320, modalWidth || Number(window.innerWidth) || 1280);
                const availableWidth = Math.max(isMobile ? 280 : 220, bodyWidth - (isMobile ? 20 : 40));
                const colCount = Math.max(
                    1,
                    Math.min(
                        4,
                        orderedVisibleDocIds.length || 1,
                        isMobile
                            ? (mobileTwoCols ? 2 : 1)
                            : Math.max(1, Math.floor((availableWidth + streamGap) / (streamMinCardWidth + streamGap)))
                    )
                );
                const showMobileStreamDocCount = !(isMobile && colCount >= 2);
                const cols = Array.from({ length: colCount }, () => ({ score: 0, items: [] }));
                orderedVisibleDocIds.forEach((docId, idx) => {
                    const docTasks = (streamByDoc.get(docId) || []).slice();
                    const alwaysVisibleDocHeadingTasks = __tmGetAlwaysVisibleTaskDocHeadingTasks(docId);
                    const headingOrderSource = docTasks.concat(alwaysVisibleDocHeadingTasks);
                    const taskById = new Map(docTasks.map((task) => [String(task?.id || '').trim(), task]).filter(([id]) => !!id));
                    const childMap = new Map();
                    const orderById = new Map(docTasks.map((task, order) => [String(task?.id || '').trim(), order]));
                    docTasks.forEach((task) => {
                        const tid = String(task?.id || '').trim();
                        const pid = String(task?.parentTaskId || '').trim();
                        if (!tid || !pid || !taskById.has(pid)) return;
                        if (!childMap.has(pid)) childMap.set(pid, []);
                        childMap.get(pid).push(tid);
                    });
                    childMap.forEach((ids) => ids.sort((a, b) => (orderById.get(a) ?? 999999) - (orderById.get(b) ?? 999999)));
                    const rootTasks = docTasks.filter((task) => {
                        const tid = String(task?.id || '').trim();
                        if (!tid) return false;
                        const parentId = String(task?.parentTaskId || '').trim();
                        return !parentId || !taskById.has(parentId);
                    });
                    const rootSplit = __tmSplitTasksByDoneState(rootTasks);
                    const rootIds = rootSplit.active
                        .map((task) => String(task?.id || '').trim())
                        .filter(Boolean);
                    const getTaskDocOrder = (task) => orderById.get(String(task?.id || '').trim()) ?? 999999;
                    const completedRootTasks = rootSplit.done
                        .slice()
                        .sort((a, b) => __tmCompareCompletedTasksRecentFirst(a, b, (x, y) => getTaskDocOrder(x) - getTaskDocOrder(y)));
                    const completedRootIds = completedRootTasks
                        .map((task) => String(task?.id || '').trim())
                        .filter(Boolean);
                    const useDocH2Subgroup = enableDocH2Subgroup && __tmDocHasAnyHeading(docId, headingOrderSource);
                    const headingBuckets = useDocH2Subgroup ? __tmBuildDocHeadingBuckets(headingOrderSource, noHeadingLabel) : [];
                    const alwaysVisibleHeadingBucketKeys = new Set(alwaysVisibleDocHeadingTasks
                        .map((task) => String(__tmGetDocHeadingBucket(task, noHeadingLabel)?.key || '').trim())
                        .filter(Boolean));
                    const rootIdsByHeading = new Map();
                    const headingCountMap = new Map();
                    if (useDocH2Subgroup) {
                        rootIds.forEach((tid) => {
                            const task = taskById.get(tid);
                            const bucket = __tmGetDocHeadingBucket(task, noHeadingLabel);
                            const key = String(bucket?.key || '').trim() || `label:${noHeadingLabel}`;
                            if (!rootIdsByHeading.has(key)) rootIdsByHeading.set(key, []);
                            rootIdsByHeading.get(key).push(tid);
                        });
                        const countActiveTreeTask = (tid) => {
                            const task = taskById.get(String(tid || '').trim());
                            if (!task) return;
                            const bucket = __tmGetDocHeadingBucket(task, noHeadingLabel);
                            const key = String(bucket?.key || '').trim();
                            if (key) headingCountMap.set(key, (headingCountMap.get(key) || 0) + 1);
                            (childMap.get(String(task?.id || '').trim()) || []).forEach(countActiveTreeTask);
                        };
                        rootIds.forEach(countActiveTreeTask);
                    }
                    const renderTaskTree = (taskId, inheritedHideCompleted = false, depth = 0, inCompletedRootGroup = false) => {
                        const task = taskById.get(String(taskId || '').trim());
                        if (!task) return '';
                        const tid = String(task?.id || '').trim();
                        const hideCompletedDescendants = __tmResolveHideCompletedDescendantsFlag(task, inheritedHideCompleted);
                        const childIds = (childMap.get(tid) || []).filter((id) => {
                            const cid = String(id || '').trim();
                            const childTask = taskById.get(cid);
                            return !!cid && !!childTask && __tmShouldKeepChildTaskVisible(task, childTask, inheritedHideCompleted);
                        });
                        const collapsed = childIds.length ? __tmKanbanGetCollapsedSet().has(tid) : false;
                        const content = String(task?.content || '').trim() || '(无内容)';
                        const toggleHtml = childIds.length
                            ? `<button class="tm-kanban-toggle" onclick="tmWhiteboardToggleTaskCollapse('${escSq(tid)}', event)" title="${collapsed ? '展开子任务' : '折叠子任务'}"><svg class="tm-tree-toggle-icon" viewBox="0 0 16 16" width="10" height="10" style="transform:translate(-50%, -50%) rotate(${collapsed ? '0deg' : '90deg'});"><path d="M4.75 3.25l6.5 4.75-6.5 4.75" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`
                            : '';
                        const childrenHtml = childIds.length && !collapsed
                            ? `<div class="tm-whiteboard-stream-children"><div class="tm-whiteboard-stream-subtasks">${childIds.map((id) => renderTaskTree(id, hideCompletedDescendants, depth + 1, inCompletedRootGroup)).join('')}</div></div>`
                            : '';
                        const multiSelectCls = __tmIsTaskMultiSelected(tid) ? ' tm-task-row--multi-selected' : '';
                        const parentTaskTitleCls = depth === 0 ? ' tm-parent-task-title' : '';
                        const completedTodayBadgeHtml = __tmRenderCompletedTodayBadge(task, {
                            todayKey,
                            inCompletedRootGroup: inCompletedRootGroup === true,
                        });
                        return `
                            <div class="tm-whiteboard-stream-task-node" data-task-id="${esc(tid)}" data-id="${esc(tid)}">
                                <div class="tm-whiteboard-stream-task">
                                    <div class="tm-whiteboard-stream-task-head${multiSelectCls}" data-task-id="${esc(tid)}" data-id="${esc(tid)}" draggable="true" ondragstart="tmDragTaskStart(event, '${escSq(tid)}')" ondragend="tmDragTaskEnd(event)" oncontextmenu="tmShowTaskContextMenu(event, '${escSq(tid)}')" onclick="tmWhiteboardStreamTaskHeadClick('${escSq(tid)}', event)">
                                        ${__tmRenderTaskCheckboxWrap(tid, task, { checked: task?.done, stopMouseDown: true, stopPointerDown: true, stopClick: true, title: '完成状态', onchange: `tmWhiteboardSetDone('${escSq(tid)}', this.checked, event)` })}
                                        <span class="tm-whiteboard-stream-task-title${parentTaskTitleCls}${task?.done ? ' tm-task-done' : ''}" onpointerdown="tmWhiteboardStreamTaskTitlePointerDown(event)" onmousedown="tmWhiteboardStreamTaskTitleMouseDown(event)" onclick="tmWhiteboardStreamTaskTitleClick('${escSq(tid)}', event)"${__tmBuildTooltipAttrs(API.getTaskTitlePresentation(task?.markdown, content || '(无内容)').text, { side: 'bottom', ariaLabel: false })} style="${__tmBuildTaskTitleOpacityStyle(task)}">${API.renderTaskContentHtml(task?.markdown, content)}${__tmRenderGlobalCollectDocTaskInlineIcon(task)}${completedTodayBadgeHtml}${__tmRenderRecurringTaskInlineIcon(task)}${__tmRenderRecurringInstanceBadge(task, { className: 'tm-recurring-instance-badge--inline' })}</span>
                                        ${toggleHtml}
                                    </div>
                                </div>
                                ${childrenHtml}
                            </div>
                        `;
                    };
                    const renderCompletedRootGroup = () => {
                        if (!completedRootIds.length) return '';
                        const doneGroupKey = __tmBuildCompletedRootGroupKey(`whiteboard-stream:${docId}`);
                        const doneCollapsed = __tmIsCompletedRootGroupCollapsed(doneGroupKey);
                        return `
                            <div class="tm-whiteboard-stream-heading tm-whiteboard-stream-heading--done" onclick="tmToggleGroupCollapse('${escSq(doneGroupKey)}', event)">
                                <div class="tm-whiteboard-stream-heading-main">
                                    <span class="tm-group-toggle${doneCollapsed ? ' tm-group-toggle--collapsed' : ''}" style="cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:16px;">${__tmRenderToggleIcon(16, doneCollapsed ? 0 : 90, 'tm-group-toggle-icon')}</span>
                                    <span class="tm-whiteboard-stream-heading-label" style="color:var(--tm-secondary-text);">已完成任务</span>
                                </div>
                                <span class="tm-badge tm-badge--count">${completedRootIds.length}</span>
                            </div>
                            ${doneCollapsed ? '' : completedRootIds.map((id) => renderTaskTree(id, false, 0, true)).join('')}
                        `;
                    };
                    const headingSectionsHtml = useDocH2Subgroup
                        ? headingBuckets.map((bucket) => {
                            const key = String(bucket?.key || '').trim();
                            const rootIdsInBucket = (rootIdsByHeading.get(key) || []).slice().sort((a, b) => (orderById.get(a) ?? 999999) - (orderById.get(b) ?? 999999));
                            if (!rootIdsInBucket.length && !alwaysVisibleHeadingBucketKeys.has(key)) return '';
                            const groupKey = `wb_stream_h2_${docId}_${key}`;
                            const groupCollapsed = state.collapsedGroups?.has(groupKey);
                            const headingCount = Number(headingCountMap.get(key) || rootIdsInBucket.length);
                            return `
                                <div class="tm-whiteboard-stream-heading" onclick="tmToggleGroupCollapse('${escSq(groupKey)}', event)">
                                    <div class="tm-whiteboard-stream-heading-main">
                                        <span class="tm-group-toggle" style="cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:16px;"><svg class="tm-group-toggle-icon" viewBox="0 0 16 16" width="16" height="16" style="transform:${groupCollapsed ? 'rotate(0deg)' : 'rotate(90deg)'};"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
                                        <span class="tm-whiteboard-stream-heading-label">${esc(String(bucket?.label || noHeadingLabel).trim() || noHeadingLabel)}</span>
                                    </div>
                                    <span class="tm-badge tm-badge--count">${headingCount}</span>
                                </div>
                                ${groupCollapsed ? '' : rootIdsInBucket.map((id) => renderTaskTree(id)).join('')}
                            `;
                        }).join('')
                        : rootIds.map((id) => renderTaskTree(id)).join('');
                    const streamSectionsHtml = `${headingSectionsHtml}${renderCompletedRootGroup()}`;
                    const docAccent = __tmGetDocColorHex(docId, isDark) || 'var(--tm-primary-color)';
                    const docHeadBg = (() => {
                        const rgba = __tmParseCssColorToRgba(String(docAccent || '').trim());
                        if (!rgba) return '';
                        const a = isDark ? 0.30 : 0.20;
                        return `rgba(${Math.round(rgba.r)}, ${Math.round(rgba.g)}, ${Math.round(rgba.b)}, ${a})`;
                    })();
                    const docHtml = `
                        <section class="tm-whiteboard-stream-doc" data-doc-id="${esc(docId)}" data-doc-order="${idx}" style="--tm-whiteboard-stream-doc-accent:${docAccent};--tm-whiteboard-stream-doc-title-color:${docAccent};${docHeadBg ? `--tm-whiteboard-stream-doc-head-bg:${docHeadBg};` : ''}" ondragover="tmWhiteboardAllTabsDocDragOver(event, '${escSq(docId)}')" ondrop="tmWhiteboardAllTabsDocDrop(event, '${escSq(docId)}')">
                            <header class="tm-whiteboard-stream-doc-head">
                                <div class="tm-whiteboard-stream-doc-meta">
                                    ${__tmRenderDocIcon(docId, { fallbackText: '📄', className: 'tm-whiteboard-stream-doc-icon', size: 14 })}
                                    <span class="tm-whiteboard-stream-doc-title" onclick="event.preventDefault(); event.stopPropagation(); tmOpenDocById('${escSq(docId)}');" title="打开文档">${esc(docNameById.get(docId) || '未知文档')}</span>
                                    ${showMobileStreamDocCount ? `<span class="tm-badge tm-badge--count">${docTasks.length}</span>` : ''}
                                </div>
                                <div class="tm-whiteboard-stream-doc-actions" onclick="event.stopPropagation()">
                                    <button class="tm-group-create-btn tm-whiteboard-stream-doc-add-btn"
                                            type="button"
                                            title="新建任务"
                                            aria-label="新建任务"
                                            onpointerdown="event.stopPropagation()"
                                            onclick="event.preventDefault(); event.stopPropagation(); tmQuickAddOpenForDoc('${escSq(docId)}');">
                                        ${__tmRenderLucideIcon('plus')}
                                    </button>
                                    <span class="tm-whiteboard-stream-doc-grip" draggable="true" ondragstart="tmWhiteboardAllTabsDocDragStart(event, '${escSq(docId)}')" ondragend="tmWhiteboardAllTabsDocDragEnd(event)" title="拖拽调整文档卡片顺序">⋮⋮</span>
                                </div>
                            </header>
                            <div class="tm-whiteboard-stream-doc-list">
                                ${streamSectionsHtml || `<div class="tm-whiteboard-stream-empty">当前文档没有任务</div>`}
                            </div>
                        </section>
                    `;
                    const estHeight = 86 + docTasks.length * 38 + (enableDocH2Subgroup ? headingBuckets.length * 26 : 0);
                    let colIndex = 0;
                    for (let i = 1; i < cols.length; i++) {
                        if (cols[i].score < cols[colIndex].score) colIndex = i;
                    }
                    cols[colIndex].score += estHeight;
                    cols[colIndex].items.push(docHtml);
                });
                const streamColsHtml = cols.map((col) => `<div class="tm-whiteboard-stream-col">${col.items.join('') || ''}</div>`).join('');
                return `
                    <div class="tm-body tm-body--whiteboard tm-body--whiteboard-stream${bodyAnimClass}" id="tmWhiteboardBody">
                        ${orderedVisibleDocIds.length
                            ? `<div class="tm-whiteboard-stream" style="--tm-whiteboard-stream-gap:${streamGap}px;">${streamColsHtml}</div>`
                            : `<div class="tm-whiteboard-stream-empty">暂无任务可用于卡片流</div>`}
                    </div>
                `;
            }

            const ensureNodePos = (task, docId, idx) => {
                const id = String(task?.id || '').trim();
                const did = String(docId || '').trim();
                if (!id || !did) return { x: 24, y: 56 };
                const existing = posMap[id];
                if (existing && typeof existing === 'object' && String(existing.docId || '').trim() === did) {
                    const ex = Number(existing.x);
                    const ey = Number(existing.y);
                    if (Number.isFinite(ex) && Number.isFinite(ey)) return { x: ex, y: ey };
                }
                const x = 24 + (Number(idx) % 10) * 300;
                const y = 56 + Math.floor(Number(idx) / 10) * 220;
                posMap[id] = { docId: did, x, y, updatedAt: String(Date.now()) };
                posDirty = true;
                return { x, y };
            };

            const globalCanvasDocId = '__tm_global_whiteboard__';
            const renderDocIds = isGlobalBoardMode ? [globalCanvasDocId] : selectedDocIds;
            const docsHtml = renderDocIds.map((docIdRaw) => {
                const docId = String(docIdRaw || '').trim();
                if (!docId) return '';
                const isGlobalCanvasDoc = isGlobalBoardMode && docId === globalCanvasDocId;
                const sourceDocIdsForCanvas = isGlobalCanvasDoc ? globalCanvasSourceDocIds : [docId];
                const sourceDocSetForCanvas = new Set(sourceDocIdsForCanvas.map((id) => String(id || '').trim()).filter(Boolean));
                const docTasks0 = sourceDocIdsForCanvas
                    .flatMap((did) => byDoc.get(did) || [])
                    .slice()
                    .sort((a, b) => getOrder(a?.id) - getOrder(b?.id));
                const seenDocTask = new Set();
                const docTasks = docTasks0.filter((t) => {
                    const id = String(t?.id || '').trim();
                    if (!id || seenDocTask.has(id)) return false;
                    seenDocTask.add(id);
                    return true;
                });
                Object.keys(placedMap).forEach((taskId) => {
                    const tid = String(taskId || '').trim();
                    if (!tid || !placedMap[tid]) return;
                    const pos = posMap?.[tid];
                    const posDocId = String(pos?.docId || '').trim();
                    const taskObj = (isGlobalCanvasDoc ? globalWhiteboardTaskMap.get(tid) : null) || state.flatTasks?.[tid] || (snapMap?.[tid] ? {
                        id: tid,
                        content: String(snapMap[tid]?.content || '').trim() || '(无内容)',
                        root_id: String(snapMap[tid]?.docId || '').trim(),
                        docId: String(snapMap[tid]?.docId || '').trim(),
                        parentTaskId: String(snapMap[tid]?.parentTaskId || '').trim(),
                        h2: String(snapMap[tid]?.h2 || '').trim(),
                        startDate: String(snapMap[tid]?.startDate || '').trim(),
                        completionTime: String(snapMap[tid]?.completionTime || '').trim(),
                        done: !!snapMap[tid]?.done,
                        __tmGhost: true,
                    } : null);
                    if (!taskObj) return;
                    const taskDocId = String(taskObj?.root_id || taskObj?.docId || posDocId).trim();
                    let effectivePosDocId = posDocId;
                    if (isGlobalCanvasDoc && taskDocId && pos && typeof pos === 'object' && taskDocId !== posDocId) {
                        posMap[tid] = {
                            ...pos,
                            docId: taskDocId,
                            updatedAt: String(Date.now()),
                        };
                        effectivePosDocId = taskDocId;
                        posDirty = true;
                    }
                    if (!effectivePosDocId || (!isGlobalCanvasDoc && effectivePosDocId !== docId)) return;
                    if (seenDocTask.has(tid)) return;
                    seenDocTask.add(tid);
                    docTasks.push(taskObj);
                });
                const taskById = new Map(docTasks.map(t => [String(t?.id || '').trim(), t]).filter(([k]) => !!k));
                const childMap = new Map();
                docTasks.forEach((t) => {
                    const id = String(t?.id || '').trim();
                    const pid = String(t?.parentTaskId || '').trim();
                    if (!id || !pid || !taskById.has(pid) || isDetachedTask(id)) return;
                    if (!childMap.has(pid)) childMap.set(pid, []);
                    childMap.get(pid).push(id);
                });
                childMap.forEach((arr) => arr.sort((a, b) => getOrder(a) - getOrder(b)));
                const rootIds = docTasks
                    .map(t => String(t?.id || '').trim())
                    .filter((id) => {
                        if (!id || !placedMap[id]) return false;
                        const t = taskById.get(id);
                        if (!t) return false;
                        const pid = String(t?.parentTaskId || '').trim();
                        if (isDetachedTask(id)) return true;
                        return !pid || !taskById.has(pid) || !placedMap[pid];
                    })
                    .sort((a, b) => getOrder(a) - getOrder(b));
                const rootSet = new Set(rootIds);
                const links = isGlobalCanvasDoc ? [] : __tmGetAllTaskLinks({ docId, includeAuto: true });
                const manualNodeLinks = isGlobalCanvasDoc && typeof __tmGetWhiteboardGlobalTaskLinks === 'function'
                    ? __tmGetWhiteboardGlobalTaskLinks()
                    : __tmGetAllTaskLinks({ docId, includeAuto: false });
                const dependencyAffectedTaskIds = typeof __tmBuildWhiteboardDependencyAffectedTaskIdSet === 'function'
                    ? __tmBuildWhiteboardDependencyAffectedTaskIdSet(docTasks, manualNodeLinks, todayKey)
                    : new Set();
                const linkedTaskIdSet = new Set();
                const linkedTaskAnchorMap = new Map();
                manualNodeLinks.forEach((link) => {
                    const fromId = String(link?.from || '').trim();
                    const toId = String(link?.to || '').trim();
                    if (fromId) linkedTaskIdSet.add(fromId);
                    if (toId) linkedTaskIdSet.add(toId);
                    if (fromId) {
                        if (!linkedTaskAnchorMap.has(fromId)) linkedTaskAnchorMap.set(fromId, new Set());
                        linkedTaskAnchorMap.get(fromId).add(String(link?.fromAnchor || '').trim().toLowerCase() === 'bottom' ? 'bottom' : 'right');
                    }
                    if (toId) {
                        if (!linkedTaskAnchorMap.has(toId)) linkedTaskAnchorMap.set(toId, new Set());
                        linkedTaskAnchorMap.get(toId).add(String(link?.toAnchor || '').trim().toLowerCase() === 'top' ? 'top' : 'left');
                    }
                });
                const linkedDescendantParentInIdSet = new Set();
                const linkedDescendantParentOutIdSet = new Set();
                const markLinkedDescendantParents = (taskId, targetSet) => {
                    let currentId = String(taskId || '').trim();
                    const seenParents = new Set();
                    while (currentId && !seenParents.has(currentId)) {
                        seenParents.add(currentId);
                        const taskLike = taskById.get(currentId);
                        const parentId = String(taskLike?.parentTaskId || __tmResolveWhiteboardTaskParentId(currentId) || '').trim();
                        if (!parentId) break;
                        targetSet.add(parentId);
                        currentId = parentId;
                    }
                };
                manualNodeLinks.forEach((link) => {
                    markLinkedDescendantParents(link?.from, linkedDescendantParentOutIdSet);
                    markLinkedDescendantParents(link?.to, linkedDescendantParentInIdSet);
                });
                const indeg = new Map(rootIds.map(id => [id, 0]));
                const adj = new Map(rootIds.map(id => [id, []]));
                const seenEdge = new Set();
                links.forEach((ln) => {
                    const from = String(ln?.from || '').trim();
                    const to = String(ln?.to || '').trim();
                    if (!rootSet.has(from) || !rootSet.has(to) || from === to) return;
                    const key = `${from}->${to}`;
                    if (seenEdge.has(key)) return;
                    seenEdge.add(key);
                    adj.get(from).push(to);
                    indeg.set(to, (indeg.get(to) || 0) + 1);
                });
                const queue = rootIds.filter(id => (indeg.get(id) || 0) === 0).sort((a, b) => getOrder(a) - getOrder(b));
                const orderedRoots = [];
                while (queue.length) {
                    const id = queue.shift();
                    if (!id) continue;
                    if (orderedRoots.includes(id)) continue;
                    orderedRoots.push(id);
                    (adj.get(id) || []).forEach((to) => {
                        const n = (indeg.get(to) || 0) - 1;
                        indeg.set(to, n);
                        if (n === 0) {
                            queue.push(to);
                            queue.sort((a, b) => getOrder(a) - getOrder(b));
                        }
                    });
                }
                rootIds
                    .filter(id => !orderedRoots.includes(id))
                    .sort((a, b) => getOrder(a) - getOrder(b))
                    .forEach(id => orderedRoots.push(id));

                orderedRoots.forEach((id, idx) => {
                    const t = taskById.get(id);
                    const posDocId = isGlobalCanvasDoc ? String(t?.root_id || t?.docId || '').trim() : docId;
                    ensureNodePos(t, posDocId, idx);
                });
                const docNotes = isGlobalCanvasDoc
                    ? notes
                    : notes.filter(n => String(n?.docId || '').trim() === docId);
                const drawingEnabledForCanvas = !allView || isGlobalCanvasDoc;
                const docDrawings = drawingEnabledForCanvas
                    ? (isGlobalCanvasDoc
                        ? drawings
                        : drawings.filter((stroke) => String(stroke?.docId || '').trim() === docId))
                    : [];
                const docFrames = isGlobalCanvasDoc
                    ? frames
                    : frames.filter((frame) => String(frame?.docId || '').trim() === docId);
                const framePlan = (() => {
                    if (!allView || isGlobalCanvasDoc) return { offsetX: 0, offsetY: 0, w: 0, h: 0, empty: false };
                    const CARD_W = 320;
                    const CARD_H = 220;
                    const NOTE_W = 280;
                    const NOTE_H = 120;
                    const PAD = 32;
                    let minX = Infinity;
                    let minY = Infinity;
                    let maxX = -Infinity;
                    let maxY = -Infinity;
                    orderedRoots.forEach((rid) => {
                        const p = posMap[rid];
                        if (!p || String(p?.docId || '').trim() !== docId) return;
                        const x = Number(p.x);
                        const y = Number(p.y);
                        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
                        minX = Math.min(minX, x);
                        minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x + CARD_W);
                        maxY = Math.max(maxY, y + CARD_H);
                    });
                    docNotes.forEach((n, idx) => {
                        const x = Number.isFinite(Number(n?.x)) ? Number(n.x) : 24;
                        const y = Number.isFinite(Number(n?.y)) ? Number(n.y) : (24 + idx * 42);
                        const noteW = __tmIsWhiteboardStickyNote(n)
                            ? (__tmNormalizeWhiteboardNoteWidth(n?.width) || 260)
                            : NOTE_W;
                        const noteH = __tmIsWhiteboardStickyNote(n)
                            ? (__tmNormalizeWhiteboardNoteHeight(n?.height) || 190)
                            : NOTE_H;
                        minX = Math.min(minX, x);
                        minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x + noteW);
                        maxY = Math.max(maxY, y + noteH);
                    });
                    docFrames.forEach((frame) => {
                        const x = Number(frame?.x);
                        const y = Number(frame?.y);
                        const w = Number(frame?.w);
                        const h = Number(frame?.h);
                        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) return;
                        minX = Math.min(minX, x);
                        minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x + Math.max(80, w));
                        maxY = Math.max(maxY, y + Math.max(60, h));
                    });
                    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
                        return { offsetX: 0, offsetY: 0, w: 1000, h: 1000, empty: true };
                    }
                    // Always normalize doc-local coordinates to its own frame,
                    // so historical large absolute positions won't inflate frame size.
                    const offsetX = PAD - minX;
                    const offsetY = PAD - minY;
                    const spanW = Math.max(0, maxX - minX);
                    const spanH = Math.max(0, maxY - minY);
                    const w = Math.max(520, Math.ceil(spanW + PAD * 2));
                    const h = Math.max(220, Math.ceil(spanH + PAD * 2));
                    return { offsetX, offsetY, w, h, empty: false };
                })();

                const renderWhiteboardFrame = (frame) => {
                    const frameId = String(frame?.id || '').trim();
                    if (!frameId) return '';
                    const localX = Number.isFinite(Number(frame?.x)) ? Number(frame.x) : 24;
                    const localY = Number.isFinite(Number(frame?.y)) ? Number(frame.y) : 24;
                    const w = Math.max(80, Math.round(Number(frame?.w) || 80));
                    const h = Math.max(60, Math.round(Number(frame?.h) || 60));
                    const fx = Math.round(localX + ((allView && !isGlobalCanvasDoc) ? framePlan.offsetX : 0));
                    const fy = Math.round(localY + ((allView && !isGlobalCanvasDoc) ? framePlan.offsetY : 0));
                    const name = (typeof __tmNormalizeWhiteboardFrameName === 'function')
                        ? __tmNormalizeWhiteboardFrameName(frame?.name)
                        : (String(frame?.name || '').trim() || '分组').slice(0, 48);
                    const backgroundColor = (typeof __tmNormalizeWhiteboardFrameBackgroundColor === 'function')
                        ? __tmNormalizeWhiteboardFrameBackgroundColor(frame?.backgroundColor)
                        : (/^#[0-9a-fA-F]{6}$/.test(String(frame?.backgroundColor || '').trim()) ? String(frame.backgroundColor).trim() : '');
                    const selected = String(state.whiteboardSelectedFrameId || '').trim() === frameId;
                    const frameStyle = `left:${fx}px;top:${fy}px;width:${w}px;height:${h}px;${backgroundColor ? `--tm-whiteboard-frame-bg:${esc(backgroundColor)};` : ''}`;
                    const toolsHtml = selected ? `
                        <div class="tm-whiteboard-frame-tools" onclick="event.stopPropagation()" onpointerdown="event.stopPropagation()" onmousedown="event.stopPropagation()">
                            <input class="tm-whiteboard-frame-name-input" value="${esc(name)}" maxlength="48" onkeydown="tmWhiteboardFrameNameKeyDown(event, '${escSq(frameId)}')" onblur="tmWhiteboardUpdateFrameName('${escSq(frameId)}', this.value, event)" aria-label="分组名称">
                            <div class="tm-whiteboard-frame-swatches" role="group" aria-label="背景颜色">
                                ${frameColorOptions.map((color) => `<button type="button" class="tm-whiteboard-frame-swatch${backgroundColor.toLowerCase() === color ? ' is-active' : ''}" style="--tm-whiteboard-frame-swatch:${esc(color)};" onclick="tmWhiteboardSetFrameBackground('${escSq(frameId)}', '${escSq(color)}', event)" title="背景颜色"></button>`).join('')}
                            </div>
                            <button type="button" class="tm-whiteboard-frame-tool-btn" onclick="tmWhiteboardSetFrameBackground('${escSq(frameId)}', '', event)" title="清除背景">清除</button>
                            <button type="button" class="tm-whiteboard-frame-tool-btn tm-whiteboard-frame-tool-btn--danger" onclick="tmWhiteboardDeleteFrame('${escSq(frameId)}', event)" title="删除分组框">删除</button>
                        </div>
                    ` : '';
                    const resizeHtml = selected
                        ? `<span class="tm-whiteboard-frame-resize tm-whiteboard-frame-resize--nw" onpointerdown="tmWhiteboardFrameResizeStart(event, '${escSq(frameId)}', '${escSq(docId)}', 'nw')" onmousedown="tmWhiteboardFrameResizeStart(event, '${escSq(frameId)}', '${escSq(docId)}', 'nw')" title="拖拽调整分组框"></span><span class="tm-whiteboard-frame-resize tm-whiteboard-frame-resize--se" onpointerdown="tmWhiteboardFrameResizeStart(event, '${escSq(frameId)}', '${escSq(docId)}', 'se')" onmousedown="tmWhiteboardFrameResizeStart(event, '${escSq(frameId)}', '${escSq(docId)}', 'se')" title="拖拽调整分组框"></span>`
                        : '';
                    return `<div class="tm-whiteboard-frame${selected ? ' tm-whiteboard-frame--selected' : ''}" data-frame-id="${esc(frameId)}" data-doc-id="${esc(docId)}" data-x="${Math.round(fx)}" data-y="${Math.round(fy)}" data-local-x="${Math.round(localX)}" data-local-y="${Math.round(localY)}" data-w="${w}" data-h="${h}" style="${frameStyle}" onclick="tmWhiteboardSelectFrame('${escSq(frameId)}', event)" onpointerdown="tmWhiteboardFramePointerDown(event, '${escSq(frameId)}', '${escSq(docId)}')" onmousedown="tmWhiteboardFrameMouseDown(event, '${escSq(frameId)}', '${escSq(docId)}')" title="拖动分组框"><div class="tm-whiteboard-frame-title">${esc(name)}</div>${toolsHtml}${resizeHtml}</div>`;
                };

                const renderWhiteboardNote = (n, idx) => {
                    const nid = String(n?.id || '').trim();
                    const nx0 = Number.isFinite(Number(n?.x)) ? Number(n.x) : 24;
                    const ny0 = Number.isFinite(Number(n?.y)) ? Number(n.y) : (24 + idx * 42);
                    const nx = Math.round(nx0 + ((allView && !isGlobalCanvasDoc) ? framePlan.offsetX : 0));
                    const ny = Math.round(ny0 + ((allView && !isGlobalCanvasDoc) ? framePlan.offsetY : 0));
                    const selected = String(state.whiteboardSelectedNoteId || '').trim() === nid;
                    if (__tmIsWhiteboardStickyNote(n)) {
                        const stickyTheme = __tmNormalizeWhiteboardStickyTheme(n?.theme);
                        const stickyTitle = String(n?.title || '').trim();
                        const stickyText = __tmNormalizeRemarkMarkdown(n?.text || '');
                        const stickyWidth = __tmNormalizeWhiteboardNoteWidth(n?.width) || 260;
                        const stickyHeight = __tmNormalizeWhiteboardNoteHeight(n?.height);
                        const stickySizeStyle = `width:${stickyWidth}px;${stickyHeight > 0 ? `height:${stickyHeight}px;` : ''}`;
                        const stickyBodyHtml = stickyText
                            ? __tmRenderRemarkMarkdown(stickyText)
                            : '<div class="tm-whiteboard-sticky-empty">双击编辑内容</div>';
                        const stickyToolsHtml = selected
                            ? `<div class="tm-whiteboard-note-tools tm-whiteboard-sticky-tools">
                                ${stickyThemeOptions.map((item) => {
                                    const value = String(item?.value || '').trim();
                                    const label = String(item?.label || value).trim();
                                    if (!value) return '';
                                    return `<button class="tm-whiteboard-sticky-swatch tm-whiteboard-sticky-swatch--${esc(value)}${stickyTheme === value ? ' is-active' : ''}" onclick="tmWhiteboardSetStickyTheme('${escSq(nid)}', '${escSq(value)}', event)" title="${esc(label)}"></button>`;
                                }).join('')}
                                <button class="tm-btn tm-btn-info" style="padding:2px 8px;font-size:12px;" onclick="tmWhiteboardEditNote('${escSq(nid)}', '${escSq(docId)}', event)" title="编辑便利贴">编辑</button>
                                <button class="tm-btn tm-btn-danger" style="padding:2px 8px;font-size:12px;" onclick="tmWhiteboardDeleteNote('${escSq(nid)}', event)" title="移除便利贴">移除</button>
                            </div>`
                            : '';
                        const stickyResizeHtml = selected ? `<span class="tm-whiteboard-note-width-resize" onmousedown="tmWhiteboardNoteResizeWidthStart(event, '${escSq(nid)}', '${escSq(docId)}')" title="拖拽调节便利贴宽度"></span><span class="tm-whiteboard-note-height-resize" onmousedown="tmWhiteboardNoteResizeHeightStart(event, '${escSq(nid)}', '${escSq(docId)}')" title="向下拖拽调节便利贴高度"></span>` : '';
                        return `<div class="tm-whiteboard-note tm-whiteboard-sticky tm-whiteboard-sticky--${esc(stickyTheme)}${selected ? ' tm-whiteboard-note--selected' : ''}" data-note-id="${esc(nid)}" data-note-kind="sticky" data-doc-id="${esc(docId)}" style="position:absolute;left:${nx}px;top:${ny}px;z-index:4;${stickySizeStyle}" onclick="tmWhiteboardNoteClick('${escSq(nid)}', event)" onmousedown="tmWhiteboardNoteMouseDown(event, '${escSq(nid)}', '${escSq(docId)}')" ondblclick="tmWhiteboardEditNote('${escSq(nid)}', '${escSq(docId)}', event)" title="拖动便利贴，双击编辑">${stickyToolsHtml}<div class="tm-whiteboard-sticky-title">${esc(stickyTitle || '便利贴')}</div><div class="tm-whiteboard-sticky-body">${stickyBodyHtml}</div>${stickyResizeHtml}</div>`;
                    }
                    const noteColor = __tmNormalizeWhiteboardNoteColor(n?.color) || '';
                    const noteFont = __tmNormalizeWhiteboardNoteFontSize(n?.fontSize);
                    const noteBold = __tmNormalizeWhiteboardNoteBold(n?.bold);
                    const noteWidth = __tmNormalizeWhiteboardNoteWidth(n?.width);
                    const noteStyle = `${noteColor ? `color:${noteColor};` : ''}font-size:${noteFont}px;font-weight:${noteBold ? '700' : '400'};${noteWidth > 0 ? `width:${noteWidth}px;white-space:pre-wrap;overflow-wrap:anywhere;` : 'white-space:pre;overflow-wrap:normal;'}`;
                    const toolsHtml = selected
                        ? `<div class="tm-whiteboard-note-tools">
                            <button class="tm-btn ${noteBold ? 'tm-btn-primary' : 'tm-btn-secondary'}" style="padding:2px 8px;font-size:12px;font-weight:700;" onclick="tmWhiteboardToggleNoteBold('${escSq(nid)}', event)" title="加粗">B</button>
                            <button class="tm-btn tm-btn-info" style="padding:2px 6px;font-size:12px;" onclick="tmWhiteboardAdjustNoteFontSize('${escSq(nid)}', -1, event)" title="减小字号">A-</button>
                            <button class="tm-btn tm-btn-info" style="padding:2px 6px;font-size:12px;" onclick="tmWhiteboardAdjustNoteFontSize('${escSq(nid)}', 1, event)" title="增大字号">A+</button>
                            ${noteColorOptions.map((c) => `<button class="tm-btn" style="padding:0;width:16px;height:14px;min-width:16px;border-radius:50%;background:${c};border:${noteColor === c ? '2px solid var(--tm-primary-color)' : '1px solid var(--tm-border-color)'};" onclick="tmWhiteboardSetNoteColor('${escSq(nid)}', '${escSq(c)}', event)" title="文字颜色"></button>`).join('')}
                            <button class="tm-btn tm-btn-danger" style="padding:2px 8px;font-size:12px;" onclick="tmWhiteboardDeleteNote('${escSq(nid)}', event)" title="移除文本">移除</button>
                        </div>`
                        : '';
                    const resizeHtml = selected ? `<span class="tm-whiteboard-note-resize" onmousedown="tmWhiteboardNoteResizeStart(event, '${escSq(nid)}', '${escSq(docId)}')" title="拖拽调节字号"></span><span class="tm-whiteboard-note-width-resize" onmousedown="tmWhiteboardNoteResizeWidthStart(event, '${escSq(nid)}', '${escSq(docId)}')" title="拖拽调节文本框宽度"></span>` : '';
                    return `<div class="tm-whiteboard-note${selected ? ' tm-whiteboard-note--selected' : ''}" data-note-id="${esc(nid)}" data-doc-id="${esc(docId)}" style="position:absolute;left:${nx}px;top:${ny}px;z-index:4;${noteStyle}" onclick="tmWhiteboardNoteClick('${escSq(nid)}', event)" onmousedown="tmWhiteboardNoteMouseDown(event, '${escSq(nid)}', '${escSq(docId)}')" ondblclick="tmWhiteboardEditNote('${escSq(nid)}', '${escSq(docId)}', event)" title="拖动便签位置，双击编辑">${toolsHtml}${esc(String(n?.text || '').trim())}${resizeHtml}</div>`;
                };

                const renderTaskNode = (id, depth = 0, inheritedHideCompleted = false) => {
                    const task = taskById.get(String(id || '').trim());
                    if (!task) return '';
                    const tid = String(task.id || '').trim();
                    const taskDocId = isGlobalCanvasDoc
                        ? (String(task?.root_id || task?.docId || '').trim() || docId)
                        : docId;
                    const hideCompletedDescendants = __tmResolveHideCompletedDescendantsFlag(task, inheritedHideCompleted);
                    const children = (childMap.get(tid) || []).filter((cid) => {
                        const c = String(cid || '').trim();
                        const childTask = taskById.get(c);
                        return !!c && !!childTask && !isDetachedTask(c) && __tmShouldKeepChildTaskVisible(task, childTask, inheritedHideCompleted);
                    });
                    const isFrozen = !!task.__tmGlobalFrozen;
                    const isRetained = !!task.__tmGlobalRetained;
                    const isCollectionOverlay = !!task.__tmGlobalCollectionOverlay;
                    const isGhost = !!task.__tmGhost;
                    const selected = String(state.whiteboardSelectedTaskId || '').trim() === tid;
                    const content = String(task?.content || '').trim();
                    const taskDone = isWhiteboardTaskDone(task);
                    const dateValue = __tmGetTaskCardDateValue(task);
                    const dateTxt = dateValue ? __tmFormatTaskCardDateValue(task) : '';
                    const childTasks = children.map((cid) => taskById.get(cid)).filter(Boolean);
                    const directChildStats = getWhiteboardDirectChildStats(task, childTasks);
                    const totalChildren = Number(directChildStats.total) || 0;
                    const completedChildren = Number(directChildStats.completed) || 0;
                    const childProgressPercent = totalChildren > 0 ? Math.round((completedChildren / totalChildren) * 100) : 0;
                    const collapsed = totalChildren ? __tmKanbanGetCollapsedSet().has(tid) : false;
                    const hasTaskLinks = linkedTaskIdSet.has(tid);
                    const linkedAnchors = linkedTaskAnchorMap.get(tid) || new Set();
                    const linkDotActiveClass = (anchor) => linkedAnchors.has(anchor) ? ' tm-task-link-dot--linked' : '';
                    const hasVisibleChildren = children.length > 0;
                    const toggleTitle = collapsed ? '展开子任务' : '折叠子任务';
                    const toggleIconPathHtml = '<path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';
                    const toggleButtonIconHtml = `<svg class="tm-tree-toggle-icon" viewBox="0 0 16 16" width="12" height="12" style="transform:translate(-50%, -50%) rotate(${collapsed ? '0deg' : '90deg'});">${toggleIconPathHtml}</svg>`;
                    const toggleChevronIconHtml = `<svg class="tm-tree-toggle-icon" viewBox="0 0 16 16" width="12" height="12" style="transform:rotate(${collapsed ? '0deg' : '90deg'});">${toggleIconPathHtml}</svg>`;
                    const toggleHtml = totalChildren
                        ? `<button class="tm-kanban-toggle" onclick="tmWhiteboardToggleTaskCollapse('${escSq(tid)}', event)" title="${toggleTitle}">${toggleButtonIconHtml}</button>`
                        : '';
                    const subtaskToggleHtml = totalChildren
                        ? `<button class="tm-kanban-subtask-toggle tm-kanban-subtasks-chevron" onclick="tmWhiteboardToggleTaskCollapse('${escSq(tid)}', event)" title="${toggleTitle}">${toggleChevronIconHtml}</button>`
                        : '';
                    const collapseProxyHasInLinks = collapsed && linkedDescendantParentInIdSet.has(tid);
                    const collapseProxyHasOutLinks = collapsed && linkedDescendantParentOutIdSet.has(tid);
                    const collapseProxyDot = (collapsed && totalChildren)
                        ? `<span class="tm-task-link-dot tm-whiteboard-collapse-proxy-dot tm-whiteboard-collapse-proxy-dot--in${collapseProxyHasInLinks ? ' tm-whiteboard-collapse-proxy-dot--has-links' : ''}" title="折叠子任务输入连线汇聚点"></span><span class="tm-task-link-dot tm-whiteboard-collapse-proxy-dot tm-whiteboard-collapse-proxy-dot--out${collapseProxyHasOutLinks ? ' tm-whiteboard-collapse-proxy-dot--has-links' : ''}" title="折叠子任务输出连线汇聚点"></span>`
                        : '';
                    const verticalLinkDots = depth === 0
                        ? `<span class="tm-task-link-dot tm-task-link-dot--in tm-task-link-dot--top${linkDotActiveClass('top')}${state.whiteboardLinkFromTaskId === tid ? ' tm-task-link-dot--active' : ''}" draggable="true" onpointerdown="tmTaskLinkDotPressStart(event, '${escSq(tid)}', '${escSq(taskDocId)}', 'in')" onmousedown="tmTaskLinkDotPressStart(event, '${escSq(tid)}', '${escSq(taskDocId)}', 'in')" ondragstart="tmTaskLinkDotDragStart(event, '${escSq(tid)}', '${escSq(taskDocId)}', 'in')" ondragend="tmTaskLinkDotDragEnd(event)" ondragover="tmTaskLinkDotDragOver(event, '${escSq(tid)}', '${escSq(taskDocId)}')" ondrop="tmTaskLinkDotDrop(event, '${escSq(tid)}', '${escSq(taskDocId)}', 'top')" title="连接输入点"></span><span class="tm-task-link-dot tm-task-link-dot--out tm-task-link-dot--bottom${linkDotActiveClass('bottom')}${state.whiteboardLinkFromTaskId === tid ? ' tm-task-link-dot--active' : ''}" draggable="true" onpointerdown="tmTaskLinkDotPressStart(event, '${escSq(tid)}', '${escSq(taskDocId)}', 'out')" onmousedown="tmTaskLinkDotPressStart(event, '${escSq(tid)}', '${escSq(taskDocId)}', 'out')" ondragstart="tmTaskLinkDotDragStart(event, '${escSq(tid)}', '${escSq(taskDocId)}', 'out')" ondragend="tmTaskLinkDotDragEnd(event)" ondragover="tmTaskLinkDotDragOver(event, '${escSq(tid)}', '${escSq(taskDocId)}')" ondrop="tmTaskLinkDotDrop(event, '${escSq(tid)}', '${escSq(taskDocId)}', 'bottom')" title="连接输出点"></span>`
                        : '';
                    const childrenListHtml = hasVisibleChildren && !collapsed
                        ? children.map(cid => renderTaskNode(cid, depth + 1, hideCompletedDescendants)).join('')
                        : '';
                    const parentCls = totalChildren ? ' tm-whiteboard-node--parent' : '';
                    const linkCls = hasTaskLinks ? ' tm-whiteboard-node--has-links' : '';
                    const rootPos = depth === 0 ? (posMap[tid] || { x: 24, y: 56 }) : null;
                    const rootStyle = depth === 0
                        ? (() => {
                            const px = Math.round((Number(rootPos.x) || 24) + ((allView && !isGlobalCanvasDoc) ? framePlan.offsetX : 0));
                            const py = Math.round((Number(rootPos.y) || 56) + ((allView && !isGlobalCanvasDoc) ? framePlan.offsetY : 0));
                            return ` data-x="${px}" data-y="${py}" style="left:${px}px;top:${py}px;"`;
                        })()
                        : '';
                    const nodeMouse = isFrozen ? '' : ` onpointerdown="tmWhiteboardCardPointerDown(event, '${escSq(tid)}', '${escSq(taskDocId)}')" onmousedown="tmWhiteboardCardMouseDown(event, '${escSq(tid)}', '${escSq(taskDocId)}')"`;
                    const nodeContextMenu = isFrozen ? '' : ` oncontextmenu="return tmWhiteboardCardContextMenu(event, '${escSq(tid)}')"`;
                    const selectClick = ` onclick="tmWhiteboardSelectTask('${escSq(tid)}', event)"`;
                    const deleteTitle = isGhost ? '移除快照卡片并彻底移除记录（不进入侧边栏）' : '移除卡片并回到侧栏';
                    const parentId = __tmResolveWhiteboardTaskParentId(tid);
                    const parentTask = parentId ? (state.flatTasks?.[parentId] || (snapMap?.[parentId] ? { content: String(snapMap[parentId]?.content || '') } : null)) : null;
                    const parentText = String(parentTask?.content || '').trim();
                    const detachedOrDetachedLike = !!parentId && (
                        isDetachedTask(tid)
                        || (!!placedMap[tid] && !!placedMap[parentId] && rootSet.has(tid))
                    );
                    const remarkHtml = whiteboardCardFields.has('remark') ? __tmRenderTaskCardRemark(task) : '';
                    const multiSelectCls = __tmIsTaskMultiSelected(tid) ? ' tm-task-row--multi-selected' : '';
                    const isTaskOverdue = __tmIsTaskCardDateOverdue(task, todayKey);
                    const hasTaskDate = typeof __tmHasTaskCardDate === 'function'
                        ? __tmHasTaskCardDate(task)
                        : !!String(task?.startDate || task?.start_date || task?.completionTime || task?.completion_time || '').trim();
                    const isDependencyAffected = dependencyAffectedTaskIds.has(tid);
                    const tomatoFocusCls = tomatoFocusTaskId
                        ? (tomatoFocusTaskId === tid ? ' tm-timer-focus' : (tomatoFocusModeEnabled ? ' tm-timer-dim' : ''))
                        : '';
                    const kanbanCardCls = `tm-kanban-card${depth > 0 ? ' tm-kanban-card--sub tm-kanban-subtask-row' : ''}${(depth === 0 && detachedOrDetachedLike) ? ' tm-kanban-card--childroot' : ''}${totalChildren ? ' tm-kanban-card--parent' : ''}${task?.done ? ' tm-kanban-card--done' : ''}${isTaskOverdue ? ' tm-kanban-card--overdue' : ''}${isDependencyAffected ? ' tm-kanban-card--dependency-affected' : ''}${hasTaskDate ? ' tm-kanban-card--has-date' : ''}${remarkHtml ? ' tm-kanban-card--has-remark' : ''}${multiSelectCls}${tomatoFocusCls}`;
                    const frozenCls = isFrozen ? ' tm-whiteboard-card--frozen' : '';
                    const cls = depth === 0
                        ? `tm-whiteboard-card tm-whiteboard-node tm-whiteboard-node--root ${kanbanCardCls}${parentCls}${linkCls}${selected ? ' tm-whiteboard-card--selected' : ''}${isGhost ? ' tm-whiteboard-card--ghost' : ''}${frozenCls}`
                        : `tm-whiteboard-subcard tm-whiteboard-node tm-whiteboard-node--sub ${kanbanCardCls}${parentCls}${linkCls}${selected ? ' tm-whiteboard-card--selected' : ''}${frozenCls}`;
                    const canMoveBack = selected && !!parentId && detachedOrDetachedLike;
                    const toolsHtml = selected && !isFrozen ? `
                        <div class="tm-whiteboard-card-tools">
                            <button class="tm-btn tm-btn-danger" style="padding:2px 8px;font-size:12px;" onclick="tmWhiteboardDeleteCard('${escSq(tid)}', '${escSq(taskDocId)}', event)" title="${esc(deleteTitle)}">移除</button>
                            ${canMoveBack ? `<button class="tm-btn tm-btn-info" style="padding:2px 8px;font-size:12px;" onclick="tmWhiteboardMoveBackToParent('${escSq(tid)}', '${escSq(taskDocId)}', event)" title="移回父任务">移回父任务</button>` : ''}
                        </div>
                    ` : '';
                    const ghostTip = isFrozen
                        ? `<span class="tm-whiteboard-frozen-indicator" title="任务已移出当前分组，保留离开时内容">${__tmRenderLucideIcon('lock', '', { size: 12 })}<span>已冻结</span></span>`
                        : (isGhost ? `<span class="tm-kanban-chip tm-kanban-chip--muted" style="cursor:default;">快照</span>` : '');
                    const opt = __tmResolveTaskStatusDisplayOption(task, statusOptions, {
                        fallbackColor: taskDone ? '#9e9e9e' : '#757575',
                        fallbackName: taskDone ? '完成' : (todoOpt?.name || '待办'),
                    });
                    const editableMeta = !isGhost && !isCollectionOverlay;
                    const statusChipStyle = __tmBuildStatusChipStyle(opt.color || '#757575');
                    let statusChip = '';
                    if (!taskDone) {
                        statusChip = `<span class="tm-status-tag" style="${statusChipStyle};cursor:${editableMeta ? 'pointer' : 'default'};" ${editableMeta ? `onclick="tmWhiteboardEditStatus('${escSq(tid)}', this, event)"` : ''}>${esc(opt.name || '')}</span>`;
                    } else if (keepCompletedStatusChip) {
                        statusChip = `<span class="tm-status-tag" style="${statusChipStyle};cursor:default;">${esc(opt.name || '完成')}</span>`;
                    }
                    const priorityChipStyle = __tmBuildPriorityChipStyle(task?.priority);
                    const priorityChip = `<span class="tm-kanban-priority-chip" style="${priorityChipStyle};cursor:${editableMeta ? 'pointer' : 'default'};" ${editableMeta ? `onclick="tmWhiteboardEditPriority('${escSq(tid)}', this, event)"` : ''}>${__tmRenderPriorityJira(task?.priority, false)}</span>`;
                    const metaParts = [];
                    if (whiteboardCardFields.has('priority') && __tmShouldRenderTaskCardPriority(task)) metaParts.push(priorityChip);
                    if (whiteboardCardFields.has('status') && __tmShouldRenderTaskCardStatus(task) && statusChip) metaParts.push(statusChip);
                    if (whiteboardCardFields.has('date') && __tmShouldRenderTaskCardDate(task)) {
                        const dateChipClass = `${dateValue ? ' tm-kanban-chip--date-has-value' : ' tm-kanban-chip--date-empty'}${isTaskOverdue ? ' tm-kanban-chip--date-overdue' : ''}`;
                        metaParts.push(`<span class="tm-kanban-chip tm-kanban-chip--muted tm-kanban-chip--date${dateChipClass}" data-tm-task-time-field="date" style="cursor:${editableMeta ? 'pointer' : 'default'};" ${editableMeta ? `onclick="tmWhiteboardEditDate('${escSq(tid)}', event)"` : ''} title="${editableMeta ? '点击选择日期' : ''}">${esc(dateTxt || '日期')}</span>`);
                    }
                    if (whiteboardCardFields.has('remainingTime') && __tmShouldRenderTaskCardRemainingTime(task)) {
                        const remainingInfo = __tmGetTaskRemainingTimeInfo(task);
                        const remainingLabel = String(remainingInfo?.label || '').trim();
                        metaParts.push(`<span class="tm-kanban-chip tm-kanban-chip--muted" data-tm-task-time-field="remainingTime" title="${esc(remainingLabel)}">${__tmRenderTaskRemainingTimeInfoHtml(remainingInfo)}</span>`);
                    }
                    if (whiteboardCardFields.has('tomatoSummary')) {
                        const text = __tmGetTaskTomatoSummaryText(task);
                        if (text) metaParts.push(`<span class="tm-kanban-chip tm-kanban-chip--muted" data-tm-task-time-field="tomatoSummary" style="cursor:${editableMeta ? 'pointer' : 'default'};" ${editableMeta ? `onclick="tmEditFocusSummaryInline('${escSq(tid)}', this)"` : ''} title="${editableMeta ? '时长与番茄' : ''}">${__tmGetTaskTomatoSummaryHtml(task)}</span>`);
                    }
                    if (whiteboardCardFields.has('tomatoEstimateCount')) {
                        const text = __tmGetTomatoCountDisplay(__tmGetTaskTomatoEstimateCount(task));
                        if (text) metaParts.push(`<span class="tm-kanban-chip tm-kanban-chip--muted" data-tm-task-time-field="tomatoEstimateCount">${esc(text)}</span>`);
                    }
                    if (whiteboardCardFields.has('tomatoCount')) {
                        const text = __tmGetTomatoCountDisplay(__tmGetTaskTomatoCount(task));
                        if (text) metaParts.push(`<span class="tm-kanban-chip tm-kanban-chip--muted" data-tm-task-time-field="tomatoCount">${__tmGetActualTomatoCountDisplayHtml(__tmGetTaskTomatoCount(task))}</span>`);
                    }
                    if (isGhost) metaParts.push(ghostTip);
                    const cardMetaHtml = metaParts.length ? `<div class="tm-kanban-card-meta">${metaParts.join('')}</div>` : '';
                    const subtaskMetaHtml = metaParts.length ? `<div class="tm-kanban-subtask-meta">${metaParts.join('')}</div>` : '';
                    const checkboxHtml = __tmRenderTaskCheckboxWrap(tid, task, {
                        checked: task?.done,
                        disabled: isGhost || isCollectionOverlay,
                        extraClass: GlobalLock.isLocked() ? 'tm-operating' : '',
                        title: isGhost ? '快照任务，当前不可直接勾选' : (isCollectionOverlay ? '打开原文档后可修改任务状态' : ''),
                        stopMouseDown: true,
                        stopClick: true,
                        onchange: `tmWhiteboardSetDone('${escSq(tid)}', this.checked, event)`,
                        collapsed: !!(collapsed && totalChildren),
                    });
                    const titleInnerHtml = `${API.renderTaskContentHtml(task?.markdown, content || '(无内容)')}${__tmRenderGlobalCollectDocTaskInlineIcon(task)}${__tmRenderRecurringTaskInlineIcon(task)}${__tmRenderRecurringInstanceBadge(task, { className: 'tm-recurring-instance-badge--inline' })}`;
                    const titleAction = isFrozen || isRetained || isCollectionOverlay
                        ? `onclick="event.preventDefault();event.stopPropagation();tmOpenDocById('${escSq(tid)}')"`
                        : `onclick="tmTaskTitleClick('${escSq(tid)}', event, { surface: 'whiteboard' })"`;
                    const titleAttrs = `${titleAction}${__tmBuildTooltipAttrs(API.getTaskTitlePresentation(task?.markdown, content || '(无内容)').text, { side: 'bottom', ariaLabel: false })} style="${__tmBuildTaskTitleOpacityStyle(task)}"`;
                    const parentTaskTitleCls = depth === 0 ? ' tm-parent-task-title' : '';
                    const subtaskCountButtonHtml = totalChildren
                        ? `<button class="tm-badge tm-badge--count tm-kanban-subtasks-count" type="button" data-tm-subtask-count-owner="${esc(tid)}" onclick="tmWhiteboardToggleTaskCollapse('${escSq(tid)}', event)" title="${toggleTitle}">${completedChildren}/${totalChildren}</button>`
                        : '';
                    const subtaskToggleControlHtml = totalChildren
                        ? `<span class="tm-kanban-subtask-toggle-control">${subtaskCountButtonHtml}${subtaskToggleHtml}</span>`
                        : '';
                    const nestedSubtasksHtml = totalChildren
                        ? `<div class="tm-kanban-subtasks tm-kanban-subtasks--nested"><div class="tm-kanban-subtasks-progress" role="presentation"><span data-tm-subtask-progress-owner="${esc(tid)}" style="width:${childProgressPercent}%"></span></div>${childrenListHtml ? `<div class="tm-kanban-subtasks-list">${childrenListHtml}</div>` : ''}</div>`
                        : '';
                    const subtasksSectionHtml = totalChildren
                        ? `
                            <section class="tm-kanban-subtasks" aria-label="子任务">
                                <button class="tm-kanban-subtasks-head" type="button" aria-expanded="${collapsed ? 'false' : 'true'}" onclick="tmWhiteboardToggleTaskCollapse('${escSq(tid)}', event)" title="${toggleTitle}">
                                    <span class="tm-kanban-subtasks-label">${__tmRenderBadgeIcon('clipboard-list', 14)}<span>子任务</span></span>
                                    <span class="tm-badge tm-badge--count" data-tm-subtask-count-owner="${esc(tid)}">${completedChildren}/${totalChildren}</span>
                                    <span class="tm-kanban-subtasks-chevron" aria-hidden="true">${toggleChevronIconHtml}</span>
                                </button>
                                <div class="tm-kanban-subtasks-progress" role="presentation"><span data-tm-subtask-progress-owner="${esc(tid)}" style="width:${childProgressPercent}%"></span></div>
                                ${childrenListHtml ? `<div class="tm-kanban-subtasks-list">${childrenListHtml}</div>` : ''}
                            </section>
                        `
                        : '';
                    const parentLineHtml = (detachedOrDetachedLike && parentText)
                        ? `<div class="tm-kanban-parent-line" style="font-size:12px;color:var(--tm-secondary-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:6px;" title="${esc(parentText)}"><span>父任务：</span><span style="font-weight:${SettingsStore.data.parentTaskNameBoldEnabled === false ? '400' : '800'};color:var(--card-foreground);">${esc(parentText)}</span></div>`
                        : '';
                    if (depth > 0) {
                        return `
                        <div class="${cls}" data-task-id="${esc(tid)}" data-doc-id="${esc(taskDocId)}"${isFrozen ? ' data-tm-whiteboard-frozen="1" aria-readonly="true"' : ''}${nodeMouse}${selectClick}${nodeContextMenu}>
                                ${toolsHtml}
                                <span class="tm-task-link-dot tm-task-link-dot--in${linkDotActiveClass('left')}${state.whiteboardLinkFromTaskId === tid ? ' tm-task-link-dot--active' : ''}" draggable="true" onpointerdown="tmTaskLinkDotPressStart(event, '${escSq(tid)}', '${escSq(taskDocId)}', 'in')" onmousedown="tmTaskLinkDotPressStart(event, '${escSq(tid)}', '${escSq(taskDocId)}', 'in')" ondragstart="tmTaskLinkDotDragStart(event, '${escSq(tid)}', '${escSq(taskDocId)}', 'in')" ondragend="tmTaskLinkDotDragEnd(event)" ondragover="tmTaskLinkDotDragOver(event, '${escSq(tid)}', '${escSq(taskDocId)}')" ondrop="tmTaskLinkDotDrop(event, '${escSq(tid)}', '${escSq(taskDocId)}')" title="连接输入点"></span>
                                <span class="tm-task-link-dot tm-task-link-dot--out${linkDotActiveClass('right')}${state.whiteboardLinkFromTaskId === tid ? ' tm-task-link-dot--active' : ''}" draggable="true" onpointerdown="tmTaskLinkDotPressStart(event, '${escSq(tid)}', '${escSq(taskDocId)}', 'out')" onmousedown="tmTaskLinkDotPressStart(event, '${escSq(tid)}', '${escSq(taskDocId)}', 'out')" ondragstart="tmTaskLinkDotDragStart(event, '${escSq(tid)}', '${escSq(taskDocId)}', 'out')" ondragend="tmTaskLinkDotDragEnd(event)" ondragover="tmTaskLinkDotDragOver(event, '${escSq(tid)}', '${escSq(taskDocId)}')" ondrop="tmTaskLinkDotDrop(event, '${escSq(tid)}', '${escSq(taskDocId)}')" title="连接输出点"></span>
                                ${verticalLinkDots}
                                ${collapseProxyDot}
                                <div class="tm-kanban-subtask-row-main">
                                    ${checkboxHtml}
                                    <div class="tm-kanban-subtask-text">
                                        <span class="tm-kanban-subtask-title tm-task-content-clickable" ${titleAttrs}>${titleInnerHtml}</span>
                                        ${subtaskMetaHtml}
                                    </div>
                                    <div class="tm-kanban-subtask-actions">
                                        ${!isGhost && !isCollectionOverlay ? `<button class="tm-kanban-more tm-kanban-subtask-more" onclick="tmOpenTaskDetail('${escSq(tid)}', event)" title="任务详情">${__tmRenderLucideIcon('dots-three')}</button>` : ''}
                                        ${subtaskToggleControlHtml}
                                    </div>
                                </div>
                                ${remarkHtml}
                                ${nestedSubtasksHtml}
                            </div>
                        `;
                    }
                    return `
                        <div class="${cls}" data-task-id="${esc(tid)}" data-doc-id="${esc(taskDocId)}"${isFrozen ? ' data-tm-whiteboard-frozen="1" aria-readonly="true"' : ''}${rootStyle}${nodeMouse}${selectClick}${nodeContextMenu}>
                            ${toolsHtml}
                            <span class="tm-task-link-dot tm-task-link-dot--in${linkDotActiveClass('left')}${state.whiteboardLinkFromTaskId === tid ? ' tm-task-link-dot--active' : ''}" draggable="true" onpointerdown="tmTaskLinkDotPressStart(event, '${escSq(tid)}', '${escSq(taskDocId)}', 'in')" onmousedown="tmTaskLinkDotPressStart(event, '${escSq(tid)}', '${escSq(taskDocId)}', 'in')" ondragstart="tmTaskLinkDotDragStart(event, '${escSq(tid)}', '${escSq(taskDocId)}', 'in')" ondragend="tmTaskLinkDotDragEnd(event)" ondragover="tmTaskLinkDotDragOver(event, '${escSq(tid)}', '${escSq(taskDocId)}')" ondrop="tmTaskLinkDotDrop(event, '${escSq(tid)}', '${escSq(taskDocId)}')" title="连接输入点"></span>
                            <span class="tm-task-link-dot tm-task-link-dot--out${linkDotActiveClass('right')}${state.whiteboardLinkFromTaskId === tid ? ' tm-task-link-dot--active' : ''}" draggable="true" onpointerdown="tmTaskLinkDotPressStart(event, '${escSq(tid)}', '${escSq(taskDocId)}', 'out')" onmousedown="tmTaskLinkDotPressStart(event, '${escSq(tid)}', '${escSq(taskDocId)}', 'out')" ondragstart="tmTaskLinkDotDragStart(event, '${escSq(tid)}', '${escSq(taskDocId)}', 'out')" ondragend="tmTaskLinkDotDragEnd(event)" ondragover="tmTaskLinkDotDragOver(event, '${escSq(tid)}', '${escSq(taskDocId)}')" ondrop="tmTaskLinkDotDrop(event, '${escSq(tid)}', '${escSq(taskDocId)}')" title="连接输出点"></span>
                            ${verticalLinkDots}
                            ${collapseProxyDot}
                            <div class="tm-kanban-card-top tm-kanban-card-main">
                                <div class="tm-kanban-card-head">
                                    ${!totalChildren ? (toggleHtml || '') : ''}
                                    ${checkboxHtml}
                                    <div class="tm-kanban-card-text">
                                        <span class="tm-kanban-card-title-inline tm-task-content-clickable${parentTaskTitleCls}" ${titleAttrs}>${titleInnerHtml}</span>
                                        ${cardMetaHtml}
                                    </div>
                                </div>
                                ${!isGhost && !isCollectionOverlay ? `<button class="tm-kanban-more" onclick="tmOpenTaskDetail('${escSq(tid)}', event)" title="任务详情">${__tmRenderLucideIcon('dots-three')}</button>` : ''}
                            </div>
                            ${parentLineHtml}
                            ${remarkHtml}
                            ${subtasksSectionHtml}
                        </div>
                    `;
                };

                const cardsHtml = orderedRoots.map((rid) => renderTaskNode(rid, 0)).join('');
                let maxX = 0;
                let maxY = 0;
                orderedRoots.forEach((rid) => {
                    const p = posMap[rid];
                    const posDocId = String(p?.docId || '').trim();
                    if (!p || (!isGlobalCanvasDoc && posDocId !== docId)) return;
                    const x = Number(p.x);
                    const y = Number(p.y);
                    if (Number.isFinite(x)) maxX = Math.max(maxX, x);
                    if (Number.isFinite(y)) maxY = Math.max(maxY, y);
                });
                docFrames.forEach((frame) => {
                    const x = Number(frame?.x);
                    const y = Number(frame?.y);
                    const w = Number(frame?.w);
                    const h = Number(frame?.h);
                    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
                    maxX = Math.max(maxX, x + (Number.isFinite(w) ? Math.max(80, w) : 80));
                    maxY = Math.max(maxY, y + (Number.isFinite(h) ? Math.max(60, h) : 60));
                });
                const frameSize = __tmGetWhiteboardDocFrameSize(docId);
                const hasManualSize = false;
                const autoBoardH = isGlobalCanvasDoc ? (maxY + 230) : (allView ? framePlan.h : (maxY + 230));
                const autoBoardW = isGlobalCanvasDoc ? (maxX + 340) : (allView ? framePlan.w : (maxX + 340));
                let boardH = hasManualSize
                    ? Math.max(220, Number(frameSize?.h) || 0)
                    : (allView && !isGlobalCanvasDoc ? Math.max(220, autoBoardH) : Math.max(300, autoBoardH));
                let boardW = hasManualSize
                    ? Math.max(520, Number(frameSize?.w) || 0)
                    : (allView && !isGlobalCanvasDoc ? Math.max(520, autoBoardW) : Math.max(1000, autoBoardW));
                const noCardsAndNotes = !!framePlan.empty;
                if (allView && !isGlobalCanvasDoc && noCardsAndNotes) {
                    boardW = 500;
                    boardH = 100;
                }
                // 单文档白板不应受文档框尺寸限制：统一扩展为大画布，避免形成“方框限制区域”
                if (!allView || isGlobalCanvasDoc) {
                    boardW = Math.max(boardW, 12000);
                    boardH = Math.max(boardH, 8000);
                }
                const renderWhiteboardDrawingLayer = () => {
                    if (!drawingEnabledForCanvas) return '';
                    const selectedStrokeId = String(state.whiteboardSelectedStrokeId || '').trim();
                    const multiSelectedStrokeIds = new Set((Array.isArray(state.whiteboardMultiSelectedStrokeIds) ? state.whiteboardMultiSelectedStrokeIds : [])
                        .map((id) => String(id || '').trim())
                        .filter(Boolean));
                    const hiddenCls = drawingConfig.hidden ? ' tm-whiteboard-drawing-layer--hidden' : '';
                    const pathHtml = docDrawings.map((stroke) => {
                        const sid = String(stroke?.id || '').trim();
                        const did = String(stroke?.docId || docId).trim();
                        const d = String(stroke?.d || '').trim();
                        if (!sid || !did || !d) return '';
                        const color = /^#[0-9a-fA-F]{6}$/.test(String(stroke?.color || '').trim()) ? String(stroke.color).trim() : '#1f2937';
                        const displayColor = color.toLowerCase() === '#1f2937' ? 'var(--tm-text-color)' : color;
                        const width = Math.round(Math.max(1, Math.min(64, Number(stroke?.width) || 4)) * 10) / 10;
                        const opacity = Math.max(0.05, Math.min(1, Number(stroke?.opacity) || 1));
                        const selected = selectedStrokeId === sid || multiSelectedStrokeIds.has(sid);
                        const cls = `tm-whiteboard-drawing-stroke${String(stroke?.type || '').trim() === 'highlighter' ? ' tm-whiteboard-drawing-stroke--highlighter' : ''}${selected ? ' tm-whiteboard-drawing-stroke--selected' : ''}`;
                        return `<path class="${cls}" data-stroke-id="${esc(sid)}" data-doc-id="${esc(did)}" d="${esc(d)}" stroke="${esc(displayColor)}" stroke-width="${width}" stroke-opacity="${opacity}" fill="none" stroke-linecap="round" stroke-linejoin="round" onpointerdown="tmWhiteboardDrawingPointerDown(event, '${escSq(sid)}', '${escSq(did)}')"></path>`;
                    }).join('');
                    return `<svg class="tm-whiteboard-drawing-layer${hiddenCls}" data-doc-id="${esc(docId)}" width="${Math.round(boardW)}" height="${Math.round(boardH)}" viewBox="0 0 ${Math.round(boardW)} ${Math.round(boardH)}" aria-hidden="true">${pathHtml}</svg>`;
                };
                const cardEmptyHtml = cardsHtml || `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--tm-secondary-text);font-size:14px;">无任务</div>`;
                if (isGlobalCanvasDoc) {
                    return `
                        <section class="tm-whiteboard-doc tm-whiteboard-doc--global" data-doc-id="${esc(globalCanvasDocId)}" data-tm-whiteboard-scope="global" style="border:none;background:transparent;">
                            <div class="tm-whiteboard-doc-body" data-doc-id="${esc(globalCanvasDocId)}" data-tm-whiteboard-scope="global" style="height:${Math.round(boardH)}px;width:${Math.round(boardW)}px;" ondragover="tmWhiteboardBoardDragOver(event)" ondrop="tmWhiteboardBoardDrop(event, '${escSq(globalCanvasDocId)}')">
                                <svg class="tm-whiteboard-edges" aria-hidden="true"></svg>
                                <svg class="tm-whiteboard-edges tm-whiteboard-edges--subtask" aria-hidden="true"></svg>
                                ${docFrames.map((frame) => renderWhiteboardFrame(frame)).join('')}
                                ${renderWhiteboardDrawingLayer()}
                                ${docNotes.map((n, idx) => renderWhiteboardNote(n, idx)).join('')}
                                ${cardEmptyHtml}
                            </div>
                        </section>
                    `;
                }
                if (!allView) {
                    return `
                        <section class="tm-whiteboard-doc" data-doc-id="${esc(docId)}" style="border:none;background:transparent;">
                            <div class="tm-whiteboard-doc-body" data-doc-id="${esc(docId)}" style="height:${Math.round(boardH)}px;width:${Math.round(boardW)}px;" ondragover="tmWhiteboardBoardDragOver(event)" ondrop="tmWhiteboardBoardDrop(event, '${escSq(docId)}')">
                                <svg class="tm-whiteboard-edges" aria-hidden="true"></svg>
                                <svg class="tm-whiteboard-edges tm-whiteboard-edges--subtask" aria-hidden="true"></svg>
                                ${docFrames.map((frame) => renderWhiteboardFrame(frame)).join('')}
                                ${renderWhiteboardDrawingLayer()}
                                ${docNotes.map((n, idx) => renderWhiteboardNote(n, idx)).join('')}
                                ${cardEmptyHtml}
                            </div>
                        </section>
                    `;
                }
                return `
                    <section class="tm-whiteboard-doc" data-doc-id="${esc(docId)}" style="width:${Math.round(boardW)}px;min-width:${Math.round(boardW)}px;">
                        <header class="tm-whiteboard-doc-head" onclick="tmSwitchDoc('${escSq(docId)}')"${__tmBuildTooltipAttrs('切换到该文档页签', { side: 'bottom', ariaLabel: false })} style="cursor:pointer;">
                            <span style="display:inline-flex;align-items:center;gap:6px;min-width:0;">${__tmRenderDocIcon(docId, { fallbackText: '📄', size: 14 })}<span>${esc(docNameById.get(docId) || '未知文档')}</span></span>
                            <span class="tm-badge tm-badge--count">${docTasks.length}</span>
                        </header>
                        <div class="tm-whiteboard-doc-body" data-doc-id="${esc(docId)}" data-frame-offset-x="${allView ? Math.round(framePlan.offsetX) : 0}" data-frame-offset-y="${allView ? Math.round(framePlan.offsetY) : 0}" style="height:${Math.round(boardH)}px;min-height:${Math.round(boardH)}px;width:${Math.round(boardW)}px;min-width:${Math.round(boardW)}px;" ondragover="tmWhiteboardBoardDragOver(event)" ondrop="tmWhiteboardBoardDrop(event, '${escSq(docId)}')">
                            <svg class="tm-whiteboard-edges" aria-hidden="true"></svg>
                            <svg class="tm-whiteboard-edges tm-whiteboard-edges--subtask" aria-hidden="true"></svg>
                            ${docFrames.map((frame) => renderWhiteboardFrame(frame)).join('')}
                            ${docNotes.map((n, idx) => renderWhiteboardNote(n, idx)).join('')}
                            ${cardEmptyHtml}
                        </div>
                    </section>
                `;
            }).join('');

            const poolSourceDocIds0 = isGlobalBoardMode
                ? globalCanvasSourceDocIds
                : (allView
                    ? selectedDocIds.filter((id) => /inbox/i.test(String(docNameById.get(String(id || '').trim()) || ''))
                        || /收件箱|收集箱|收件/.test(String(docNameById.get(String(id || '').trim()) || ''))
                    )
                    : selectedDocIds);
            const poolSourceDocIds = (isGlobalBoardMode && globalCollectionDocId)
                ? [globalCollectionDocId].concat(poolSourceDocIds0.filter((id) => String(id || '').trim() !== globalCollectionDocId))
                : poolSourceDocIds0;
            const poolSelectedSet = new Set((Array.isArray(state.whiteboardPoolSelectedTaskIds) ? state.whiteboardPoolSelectedTaskIds : []).map((x) => String(x || '').trim()).filter(Boolean));
            const poolCollapsedSectionKeys = new Set((Array.isArray(state.whiteboardPoolCollapsedSectionKeys) ? state.whiteboardPoolCollapsedSectionKeys : []).map((x) => String(x || '').trim()).filter(Boolean));
            const poolGroupMode = __tmGetCurrentGroupModeValue();
            const poolPinWithinGroups = !!SettingsStore.data.pinTasksWithinGroups && poolGroupMode !== 'none';
            const poolSortContext = (() => {
                try {
                    return typeof __tmBuildRuleSortContext === 'function'
                        ? (__tmBuildRuleSortContext() || {})
                        : {};
                } catch (e) {
                    return {};
                }
            })();
            const poolHasExplicitSort = poolSortContext.hasExplicitSort === true;
            const isPoolActivePinnedTask = (task) => __tmIsTaskPinned(task) && !isWhiteboardTaskDone(task);
            const whiteboardPoolSubtaskIndent = 14;
            const sortPoolTasksLikeChecklist = (tasks, fallbackCompare = null) => {
                const list = Array.isArray(tasks) ? tasks : [];
                if (list.length <= 1) return list;
                if (poolHasExplicitSort) {
                    const sorted = RuleManager.applyRuleSort(list, poolSortContext.rule, poolSortContext.runtime);
                    list.splice(0, list.length, ...sorted);
                    return list;
                }
                if (poolPinWithinGroups) {
                    list.sort((a, b) => {
                        const aPinned = isPoolActivePinnedTask(a);
                        const bPinned = isPoolActivePinnedTask(b);
                        if (aPinned !== bPinned) return aPinned ? -1 : 1;
                        return typeof fallbackCompare === 'function' ? fallbackCompare(a, b) : 0;
                    });
                    return list;
                }
                if (typeof fallbackCompare === 'function') list.sort(fallbackCompare);
                return list;
            };
            const poolDocRankMap = new Map(poolSourceDocIds.map((id, idx) => [String(id || '').trim(), idx]));
            const poolTimePriorityMemo = new Map();
            const getPoolTimePriorityInfo = (task) => __tmGetTaskTimePriorityInfo(task, { memo: poolTimePriorityMemo });
            const comparePoolByTimePriority = (a, b) => {
                const ai = getPoolTimePriorityInfo(a);
                const bi = getPoolTimePriorityInfo(b);
                const ad = Number(ai?.diffDays);
                const bd = Number(bi?.diffDays);
                const aBucket = Number.isFinite(ad) ? (ad < 0 ? 0 : 1) : 2;
                const bBucket = Number.isFinite(bd) ? (bd < 0 ? 0 : 1) : 2;
                if (aBucket !== bBucket) return aBucket - bBucket;
                const aRank = Number.isFinite(ad) ? ad : Infinity;
                const bRank = Number.isFinite(bd) ? bd : Infinity;
                if (aRank !== bRank) return aRank - bRank;
                const ats = Number(ai?.ts || 0);
                const bts = Number(bi?.ts || 0);
                if (ats !== bts) return ats - bts;
                return getOrder(a?.id) - getOrder(b?.id);
            };
            const poolTimeBaseColor = isDark
                ? __tmNormalizeHexColor(SettingsStore.data.timeGroupBaseColorDark, '#6ba5ff')
                : __tmNormalizeHexColor(SettingsStore.data.timeGroupBaseColorLight, '#1a73e8');
            const poolTimeOverdueColor = isDark
                ? __tmNormalizeHexColor(SettingsStore.data.timeGroupOverdueColorDark, '#ff6b6b')
                : __tmNormalizeHexColor(SettingsStore.data.timeGroupOverdueColorLight, '#d93025');
            const getPoolTimeGroupLabelColor = (groupInfo) => {
                const key = String(groupInfo?.key || '');
                const sortValue = Number(groupInfo?.sortValue);
                if (key === 'pending' || !Number.isFinite(sortValue)) return 'var(--tm-secondary-text)';
                if (sortValue < 0) return poolTimeOverdueColor || 'var(--tm-danger-color)';
                const minA = isDark ? 0.52 : 0.42;
                const step = isDark ? 0.085 : 0.11;
                const alpha = __tmClamp(1 - sortValue * step, minA, 1);
                return __tmWithAlpha(poolTimeBaseColor || 'var(--tm-primary-color)', alpha);
            };
            const getPoolTimeGroupInfo = (task) => {
                const info = getPoolTimePriorityInfo(task);
                const diffDays = Number(info?.diffDays);
                const buildTimeGroupLabelHtml = (label, daysInput) => {
                    const safeLabel = esc(String(label || '').trim());
                    const days = Number(daysInput);
                    if (!Number.isFinite(days) || days < 0 || days > 15) return safeLabel;
                    const target = new Date();
                    target.setHours(12, 0, 0, 0);
                    target.setDate(target.getDate() + days);
                    const weekday = __tmGetTaskRepeatWeekdayLabel(target);
                    return `<span class="tm-time-group-label-wrap"><span class="tm-time-group-label-text">${safeLabel}</span><span class="tm-time-group-weekday-chip">${esc(weekday)}</span></span>`;
                };
                if (!Number.isFinite(diffDays)) return { key: 'pending', label: '待定', labelHtml: '待定', sortValue: Infinity };
                if (diffDays < 0) return { key: 'overdue', label: '已过期', labelHtml: '已过期', sortValue: diffDays };
                if (diffDays === 0) return { key: 'today', label: '今天', labelHtml: buildTimeGroupLabelHtml('今天', diffDays), sortValue: 0 };
                if (diffDays === 1) return { key: 'tomorrow', label: '明天', labelHtml: buildTimeGroupLabelHtml('明天', diffDays), sortValue: 1 };
                if (diffDays === 2) return { key: 'after_tomorrow', label: '后天', labelHtml: buildTimeGroupLabelHtml('后天', diffDays), sortValue: 2 };
                if (diffDays >= 16) return { key: 'farther', label: '更远', labelHtml: '更远', sortValue: 16 };
                const label = `余${diffDays}天`;
                return { key: `days_${diffDays}`, label, labelHtml: buildTimeGroupLabelHtml(label, diffDays), sortValue: diffDays };
            };
            const poolQuadrantRules = (SettingsStore.data.quadrantConfig && Array.isArray(SettingsStore.data.quadrantConfig.rules))
                ? SettingsStore.data.quadrantConfig.rules
                : [];
            const poolQuadrantOrder = ['urgent-important', 'not-urgent-important', 'urgent-not-important', 'not-urgent-not-important'];
            const poolQuadrantColorMap = {
                red: 'var(--tm-quadrant-red)',
                yellow: 'var(--tm-quadrant-yellow)',
                blue: 'var(--tm-quadrant-blue)',
                green: 'var(--tm-quadrant-green)',
            };
            const getPoolQuadrantGroupInfo = (task) => {
                const priority = String(task?.priority || '').toLowerCase();
                const importance = (priority === 'a' || priority === '高' || priority === 'high')
                    ? 'high'
                    : ((priority === 'b' || priority === '中' || priority === 'medium')
                        ? 'medium'
                        : ((priority === 'c' || priority === '低' || priority === 'low') ? 'low' : 'none'));
                const diffDays = Number(__tmGetTaskTimePriorityInfo(task)?.diffDays);
                const timeRange = !Number.isFinite(diffDays)
                    ? 'nodate'
                    : (diffDays < 0 ? 'overdue' : (diffDays <= 7 ? 'within7days' : (diffDays <= 15 ? 'within15days' : (diffDays <= 30 ? 'within30days' : 'beyond30days'))));
                for (const rule of poolQuadrantRules) {
                    const importanceMatch = Array.isArray(rule?.importance) && rule.importance.includes(importance);
                    let timeRangeMatch = Array.isArray(rule?.timeRanges) && rule.timeRanges.includes(timeRange);
                    if (!timeRangeMatch && Array.isArray(rule?.timeRanges)) {
                        for (const range of rule.timeRanges) {
                            if (!String(range || '').startsWith('beyond') || range === 'beyond30days') continue;
                            const days = parseInt(String(range).replace('beyond', '').replace('days', ''), 10);
                            if (!Number.isNaN(days) && diffDays > days) {
                                timeRangeMatch = true;
                                break;
                            }
                        }
                    }
                    if (!importanceMatch || !timeRangeMatch) continue;
                    const ruleId = String(rule?.id || '').trim();
                    const orderIndex = poolQuadrantOrder.indexOf(ruleId);
                    return {
                        key: `quadrant_${ruleId || 'other'}`,
                        label: String(rule?.name || '').trim() || '未分类',
                        sortValue: orderIndex >= 0 ? orderIndex : (poolQuadrantOrder.length + 1),
                        labelColor: poolQuadrantColorMap[String(rule?.color || '').trim()] || 'var(--tm-text-color)',
                    };
                }
                return null;
            };
            const buildWhiteboardPoolDocData = (docIdRaw) => {
                const docId = String(docIdRaw || '').trim();
                if (!docId) return null;
                const docName = String(docNameById.get(docId) || '未知文档');
                const sourceTasks = (byDoc.get(docId) || [])
                    .filter((task) => !task?.__tmGhost)
                    .slice()
                    .sort((a, b) => getOrder(a?.id) - getOrder(b?.id));
                const sourceTaskMap = new Map();
                sourceTasks.forEach((task) => {
                    const id = String(task?.id || '').trim();
                    if (!id || sourceTaskMap.has(id)) return;
                    sourceTaskMap.set(id, task);
                });
                const getTaskLike = (taskId) => {
                    const id = String(taskId || '').trim();
                    if (!id) return null;
                    return sourceTaskMap.get(id) || state.flatTasks?.[id] || null;
                };
                const hasPlacedAncestor = (taskId) => {
                    let cur = String(taskId || '').trim();
                    const seen = new Set();
                    while (cur && !seen.has(cur)) {
                        seen.add(cur);
                        const task = getTaskLike(cur);
                        const pid = String(task?.parentTaskId || '').trim();
                        if (!pid) return false;
                        if (placedMap[pid]) return true;
                        cur = pid;
                    }
                    return false;
                };
                const hasDoneAncestor = (taskId) => {
                    let cur = String(taskId || '').trim();
                    const seen = new Set();
                    while (cur && !seen.has(cur)) {
                        seen.add(cur);
                        const task = getTaskLike(cur);
                        const pid = String(task?.parentTaskId || '').trim();
                        if (!pid) return false;
                        const parentTask = getTaskLike(pid);
                        if (parentTask?.done) return true;
                        cur = pid;
                    }
                    return false;
                };
                const listMap = new Map();
                const addToList = (task, locked = false) => {
                    const id = String(task?.id || '').trim();
                    if (!id) return;
                    if (!showDoneTasks && !!task?.done) return;
                    if (hasDoneAncestor(id)) return;
                    const prev = listMap.get(id);
                    if (prev) {
                        if (!prev.__tmPoolLocked && locked) return;
                        if (prev.__tmPoolLocked && !locked) {
                            listMap.set(id, { ...(prev || {}), __tmPoolLocked: false });
                        }
                        return;
                    }
                    listMap.set(id, { ...(task || {}), __tmPoolLocked: !!locked });
                };
                Array.from(sourceTaskMap.values()).forEach((task) => {
                    const id = String(task?.id || '').trim();
                    if (!id) return;
                    const placed = !!placedMap[id];
                    const detached = isDetachedTask(id);
                    const hiddenByPlacedAncestor = hasPlacedAncestor(id);
                    if (!placed && !hiddenByPlacedAncestor) {
                        addToList(task, false);
                        return;
                    }
                    if (!placed && hiddenByPlacedAncestor) {
                        if (!detached) return;
                        addToList(task, false);
                        let cur = id;
                        const seen = new Set();
                        while (cur && !seen.has(cur)) {
                            seen.add(cur);
                            const current = sourceTaskMap.get(cur);
                            const pid = String(current?.parentTaskId || '').trim();
                            if (!pid) break;
                            const parentTask = sourceTaskMap.get(pid);
                            if (parentTask && placedMap[pid]) addToList(parentTask, true);
                            cur = pid;
                        }
                    }
                });
                const list = Array.from(listMap.values());
                if (!list.length) return null;
                const taskMap = new Map();
                list.forEach((task) => {
                    const id = String(task?.id || '').trim();
                    if (!id || taskMap.has(id)) return;
                    taskMap.set(id, task);
                });
                const childrenMap = new Map();
                list.forEach((task) => {
                    const id = String(task?.id || '').trim();
                    const pid = String(task?.parentTaskId || '').trim();
                    if (!id || !pid || !taskMap.has(pid)) return;
                    if (!childrenMap.has(pid)) childrenMap.set(pid, []);
                    childrenMap.get(pid).push(id);
                });
                childrenMap.forEach((arr) => arr.sort((a, b) => getOrder(a) - getOrder(b)));
                const rootIds = Array.from(taskMap.keys())
                    .filter((id) => {
                        const task = taskMap.get(id);
                        if (!task) return false;
                        const pid = String(task?.parentTaskId || '').trim();
                        return !pid || !taskMap.has(pid);
                    })
                    .sort((a, b) => getOrder(a) - getOrder(b));
                const countMemo = new Map();
                const countTreeNodes = (taskId) => {
                    const id = String(taskId || '').trim();
                    if (!id || !taskMap.has(id)) return 0;
                    if (countMemo.has(id)) return countMemo.get(id);
                    const total = 1 + (childrenMap.get(id) || []).reduce((sum, childId) => sum + countTreeNodes(childId), 0);
                    countMemo.set(id, total);
                    return total;
                };
                const renderPoolTaskNode = (taskId, depth = 0, options = {}) => {
                    const task = taskMap.get(String(taskId || '').trim());
                    if (!task) return '';
                    const tid = String(task?.id || '').trim();
                    if (!tid) return '';
                    const childIds = (childrenMap.get(tid) || []).filter((cid) => taskMap.has(cid));
                    const collapsed = childIds.length ? __tmKanbanGetCollapsedSet().has(tid) : false;
                    const toggleHtml = childIds.length
                        ? `<button type="button" class="tm-whiteboard-pool-toggle${collapsed ? ' tm-whiteboard-pool-toggle--collapsed' : ''}" onclick="tmWhiteboardToggleTaskCollapse('${escSq(tid)}', event)" onmousedown="event.stopPropagation()" aria-expanded="${collapsed ? 'false' : 'true'}" title="${collapsed ? '展开子任务' : '折叠子任务'}">${__tmRenderToggleIcon(10, 0, 'tm-whiteboard-pool-toggle-icon', `transform:translate(-50%, -50%) rotate(${collapsed ? 0 : 90}deg);`)}</button>`
                        : '';
                    const indent = depth > 0 ? whiteboardPoolSubtaskIndent : 0;
                    const doneCls = task?.done ? ' tm-whiteboard-pool-item--done' : '';
                    const parentCls = childIds.length ? ' tm-whiteboard-pool-item--parent' : '';
                    const topCls = depth === 0 ? ' tm-whiteboard-pool-item--top' : '';
                    const lockedCls = task?.__tmPoolLocked ? ' tm-whiteboard-pool-item--locked' : '';
                    const selectedCls = poolSelectedSet.has(tid) ? ' tm-whiteboard-pool-item--selected' : '';
                    const parentTaskTitleCls = depth === 0 ? ' tm-parent-task-title' : '';
                    const draggableAttr = task?.__tmPoolLocked ? 'false' : 'true';
                    const dragStartAttr = task?.__tmPoolLocked ? '' : ` ondragstart="tmWhiteboardPoolDragStart(event, '${escSq(tid)}', '${escSq(docId)}')"`;
                    const dragEndAttr = task?.__tmPoolLocked ? '' : ' ondragend="tmWhiteboardPoolDragEnd(event)"';
                    const mouseDownAttr = ` onmousedown="tmWhiteboardPoolItemMouseDown(event, '${escSq(tid)}', '${escSq(docId)}', ${task?.__tmPoolLocked ? 'true' : 'false'})"`;
                    const titleDragAttr = task?.__tmPoolLocked ? '' : ` draggable="true"${mouseDownAttr} ondragstart="tmWhiteboardPoolDragStart(event, '${escSq(tid)}', '${escSq(docId)}')" ondragend="tmWhiteboardPoolDragEnd(event)"`;
                    const itemTitle = task?.__tmPoolLocked ? '父任务已在白板中，不可重复拖入' : '拖动到白板';
                    const docBadgeHtml = (options.showDocBadge && depth === 0)
                        ? `<span class="tm-whiteboard-pool-item-prefix" title="${esc(docName)}">${__tmRenderDocIcon(docId, { fallbackText: '📄', size: 12 })}</span>`
                        : '';
                    const kidsHtml = (!collapsed && childIds.length)
                        ? childIds.map((cid) => renderPoolTaskNode(cid, depth + 1, options)).join('')
                        : '';
                    return `
                        <div class="tm-whiteboard-pool-node" style="padding-left:${indent}px;">
                            <div class="tm-whiteboard-pool-item${doneCls}${parentCls}${topCls}${lockedCls}${selectedCls}" data-task-id="${esc(tid)}" draggable="${draggableAttr}"${mouseDownAttr}${dragStartAttr}${dragEndAttr} oncontextmenu="tmShowTaskContextMenu(event, '${escSq(tid)}')" title="${itemTitle}">
                                ${__tmRenderTaskCheckboxWrap(tid, task, { checked: task?.done, stopMouseDown: true, stopPointerDown: true, stopClick: true, title: '完成状态', onchange: `tmWhiteboardSetDone('${escSq(tid)}', this.checked, event)`, collapsed: !!collapsed })}
                                ${docBadgeHtml}
                                <span class="tm-whiteboard-pool-item-title${parentTaskTitleCls}"${titleDragAttr}><span class="tm-task-content-clickable" onclick="tmWhiteboardPoolTitleClick('${escSq(tid)}', event)"${__tmBuildTooltipAttrs(API.getTaskTitlePresentation(task?.markdown, String(task?.content || '').trim() || '(无内容)').text, { side: 'bottom', ariaLabel: false })} style="${__tmBuildTaskTitleOpacityStyle(task)}">${API.renderTaskContentHtml(task?.markdown, String(task?.content || '').trim() || '(无内容)')}${__tmRenderGlobalCollectDocTaskInlineIcon(task)}${__tmRenderRecurringTaskInlineIcon(task)}${__tmRenderRecurringInstanceBadge(task, { className: 'tm-recurring-instance-badge--inline' })}</span></span>
                                ${toggleHtml}
                            </div>
                            ${kidsHtml}
                        </div>
                    `;
                };
                return {
                    docId,
                    docName,
                    list,
                    taskMap,
                    childrenMap,
                    rootIds,
                    countTreeNodes,
                    renderPoolTaskNode,
                };
            };
            const renderWhiteboardPoolSectionHead = ({ sectionKey, titleHtml, count, label }) => {
                const key = String(sectionKey || '').trim();
                const collapsed = !!key && poolCollapsedSectionKeys.has(key);
                return {
                    collapsed,
                    html: `
                        <button type="button" class="tm-whiteboard-pool-doc-head tm-whiteboard-pool-doc-head--toggle" onclick="tmWhiteboardTogglePoolSection('${escSq(key)}', event)" aria-expanded="${collapsed ? 'false' : 'true'}" data-pool-section-label="${esc(label || '分组')}" title="${collapsed ? '展开' : '折叠'}${esc(label || '分组')}">
                            <span class="tm-whiteboard-pool-doc-title"><span class="tm-whiteboard-pool-doc-chevron" aria-hidden="true">${__tmRenderToggleIcon(12, collapsed ? 0 : 90, 'tm-whiteboard-pool-doc-chevron-icon')}</span><span class="tm-whiteboard-pool-doc-identity">${titleHtml}</span></span>
                            <span class="tm-whiteboard-pool-doc-count">· ${Number(count) || 0}</span>
                        </button>
                    `,
                };
            };
            const renderWhiteboardPoolDocSection = (docData, options = {}) => {
                if (!docData) return '';
                const docId = String(docData.docId || '').trim();
                if (!docId) return '';
                const excludedTaskIds = options?.excludedTaskIds instanceof Set ? options.excludedTaskIds : null;
                const list = (Array.isArray(docData.list) ? docData.list : [])
                    .filter((task) => !excludedTaskIds?.has(String(task?.id || '').trim()));
                if (!list.length) return '';
                const docName = String(docData.docName || '未知文档');
                const sectionKey = `doc:${docId}`;
                const sectionHead = renderWhiteboardPoolSectionHead({
                    sectionKey,
                    titleHtml: `${__tmRenderDocIcon(docId, { fallbackText: '📄', size: 14 })}<span class="tm-whiteboard-pool-doc-name">${esc(docName)}</span>`,
                    count: list.length,
                    label: docName,
                });
                const collapsed = sectionHead.collapsed;
                const useDocH2Subgroup = enableDocH2Subgroup && __tmDocHasAnyHeading(docId, list);
                const groups = new Map();
                if (useDocH2Subgroup) {
                    list.forEach((task) => {
                        const bucket = __tmGetDocHeadingBucket(task, noHeadingLabel);
                        if (!groups.has(bucket.key)) groups.set(bucket.key, { label: bucket.label, items: [] });
                        groups.get(bucket.key).items.push(task);
                    });
                } else {
                    groups.set('__all__', { label: '', items: list.slice() });
                }
                const groupKeys0 = useDocH2Subgroup ? __tmBuildDocHeadingBuckets(list, noHeadingLabel).map((bucket) => bucket.key) : ['__all__'];
                const groupKeys = groupKeys0.concat(Array.from(groups.keys()).filter((key) => !groupKeys0.includes(key)));
                return `
                    <section class="tm-whiteboard-pool-doc${collapsed ? ' tm-whiteboard-pool-doc--collapsed' : ''}" data-doc-id="${esc(docId)}" data-pool-section-key="${esc(sectionKey)}">
                        ${sectionHead.html}
                        <div class="tm-whiteboard-pool-list"${collapsed ? ' hidden' : ''}>
                            ${groupKeys.map((groupKey) => {
                                const group = groups.get(groupKey) || { label: noHeadingLabel, items: [] };
                                const items = (Array.isArray(group.items) ? group.items : []).slice().sort((a, b) => getOrder(a?.id) - getOrder(b?.id));
                                const groupLabel = String(group.label || noHeadingLabel);
                                const groupTaskMap = new Map();
                                items.forEach((task) => {
                                    const id = String(task?.id || '').trim();
                                    if (!id || groupTaskMap.has(id)) return;
                                    groupTaskMap.set(id, task);
                                });
                                const groupChildrenMap = new Map();
                                items.forEach((task) => {
                                    const id = String(task?.id || '').trim();
                                    const pid = String(task?.parentTaskId || '').trim();
                                    if (!id || !pid || !groupTaskMap.has(pid)) return;
                                    if (!groupChildrenMap.has(pid)) groupChildrenMap.set(pid, []);
                                    groupChildrenMap.get(pid).push(id);
                                });
                                groupChildrenMap.forEach((arr) => arr.sort((a, b) => getOrder(a) - getOrder(b)));
                                const groupRootTasks = Array.from(groupTaskMap.keys())
                                    .filter((id) => {
                                        const task = groupTaskMap.get(id);
                                        if (!task) return false;
                                        const pid = String(task?.parentTaskId || '').trim();
                                        return !pid || !groupTaskMap.has(pid);
                                    })
                                    .map((id) => groupTaskMap.get(id))
                                    .filter(Boolean);
                                sortPoolTasksLikeChecklist(groupRootTasks);
                                const groupRootIds = groupRootTasks.map((task) => String(task?.id || '').trim()).filter(Boolean);
                                const h2DragTaskIds = items
                                    .map((task) => String(task?.id || '').trim())
                                    .filter((tid) => {
                                        if (!tid) return false;
                                        return !groupTaskMap.get(tid)?.__tmPoolLocked;
                                    });
                                const renderGroupTaskNode = (taskId, depth = 0) => {
                                    const task = groupTaskMap.get(String(taskId || '').trim());
                                    if (!task) return '';
                                    const tid = String(task?.id || '').trim();
                                    if (!tid) return '';
                                    const childIds = (groupChildrenMap.get(tid) || []).filter((cid) => groupTaskMap.has(cid));
                                    const collapsed = childIds.length ? __tmKanbanGetCollapsedSet().has(tid) : false;
                                    const toggleHtml = childIds.length
                                        ? `<button type="button" class="tm-whiteboard-pool-toggle${collapsed ? ' tm-whiteboard-pool-toggle--collapsed' : ''}" onclick="tmWhiteboardToggleTaskCollapse('${escSq(tid)}', event)" onmousedown="event.stopPropagation()" aria-expanded="${collapsed ? 'false' : 'true'}" title="${collapsed ? '展开子任务' : '折叠子任务'}">${__tmRenderToggleIcon(10, 0, 'tm-whiteboard-pool-toggle-icon', `transform:translate(-50%, -50%) rotate(${collapsed ? 0 : 90}deg);`)}</button>`
                                        : '';
                                    const indent = depth > 0 ? whiteboardPoolSubtaskIndent : 0;
                                    const doneCls = task?.done ? ' tm-whiteboard-pool-item--done' : '';
                                    const parentCls = childIds.length ? ' tm-whiteboard-pool-item--parent' : '';
                                    const topCls = depth === 0 ? ' tm-whiteboard-pool-item--top' : '';
                                    const lockedCls = task?.__tmPoolLocked ? ' tm-whiteboard-pool-item--locked' : '';
                                    const selectedCls = poolSelectedSet.has(tid) ? ' tm-whiteboard-pool-item--selected' : '';
                                    const parentTaskTitleCls = depth === 0 ? ' tm-parent-task-title' : '';
                                    const draggableAttr = task?.__tmPoolLocked ? 'false' : 'true';
                                    const dragStartAttr = task?.__tmPoolLocked ? '' : ` ondragstart="tmWhiteboardPoolDragStart(event, '${escSq(tid)}', '${escSq(docId)}')"`;
                                    const dragEndAttr = task?.__tmPoolLocked ? '' : ' ondragend="tmWhiteboardPoolDragEnd(event)"';
                                    const mouseDownAttr = ` onmousedown="tmWhiteboardPoolItemMouseDown(event, '${escSq(tid)}', '${escSq(docId)}', ${task?.__tmPoolLocked ? 'true' : 'false'})"`;
                                    const titleDragAttr = task?.__tmPoolLocked ? '' : ` draggable="true"${mouseDownAttr} ondragstart="tmWhiteboardPoolDragStart(event, '${escSq(tid)}', '${escSq(docId)}')" ondragend="tmWhiteboardPoolDragEnd(event)"`;
                                    const itemTitle = task?.__tmPoolLocked ? '父任务已在白板中，不可重复拖入' : '拖动到白板';
                                    const kidsHtml = (!collapsed && childIds.length)
                                        ? childIds.map((cid) => renderGroupTaskNode(cid, depth + 1)).join('')
                                        : '';
                                    return `
                                        <div class="tm-whiteboard-pool-node" style="padding-left:${indent}px;">
                                            <div class="tm-whiteboard-pool-item${doneCls}${parentCls}${topCls}${lockedCls}${selectedCls}" data-task-id="${esc(tid)}" draggable="${draggableAttr}"${mouseDownAttr}${dragStartAttr}${dragEndAttr} oncontextmenu="tmShowTaskContextMenu(event, '${escSq(tid)}')" title="${itemTitle}">
                                                ${__tmRenderTaskCheckboxWrap(tid, task, { checked: task?.done, stopMouseDown: true, stopPointerDown: true, stopClick: true, title: '完成状态', onchange: `tmWhiteboardSetDone('${escSq(tid)}', this.checked, event)`, collapsed: !!collapsed })}
                                                <span class="tm-whiteboard-pool-item-title${parentTaskTitleCls}"${titleDragAttr}><span class="tm-task-content-clickable" onclick="tmWhiteboardPoolTitleClick('${escSq(tid)}', event)"${__tmBuildTooltipAttrs(API.getTaskTitlePresentation(task?.markdown, String(task?.content || '').trim() || '(无内容)').text, { side: 'bottom', ariaLabel: false })} style="${__tmBuildTaskTitleOpacityStyle(task)}">${API.renderTaskContentHtml(task?.markdown, String(task?.content || '').trim() || '(无内容)')}${__tmRenderGlobalCollectDocTaskInlineIcon(task)}${__tmRenderRecurringTaskInlineIcon(task)}${__tmRenderRecurringInstanceBadge(task, { className: 'tm-recurring-instance-badge--inline' })}</span></span>
                                                ${toggleHtml}
                                            </div>
                                            ${kidsHtml}
                                        </div>
                                    `;
                                };
                                if (!useDocH2Subgroup) {
                                    return groupRootIds.map((rid) => renderGroupTaskNode(rid, 0)).join('');
                                }
                                return `
                                    <div class="tm-whiteboard-pool-h2"
                                        draggable="${h2DragTaskIds.length ? 'true' : 'false'}"
                                        data-doc-id="${esc(docId)}"
                                        data-h2="${esc(groupLabel)}"
                                        data-task-ids="${esc(h2DragTaskIds.join(','))}"
                                        ${h2DragTaskIds.length ? `ondragstart="tmWhiteboardPoolH2DragStart(event, '${escSq(docId)}', '${escSq(groupLabel)}')" ondragend="tmWhiteboardPoolDragEnd(event)"` : ''}
                                        title="${h2DragTaskIds.length ? '拖动该二级标题及其任务到白板' : ''}">${__tmRenderHeadingLevelIconLabel(groupLabel, SettingsStore.data.taskHeadingLevel || 'h2', { size: 14, className: 'tm-whiteboard-pool-h2-text' })}<span> · ${items.length}</span></div>
                                    ${groupRootIds.map((rid) => renderGroupTaskNode(rid, 0)).join('')}
                                `;
                            }).join('')}
                        </div>
                    </section>
                `;
            };
            const poolDocDataList = poolSourceDocIds
                .map((docId) => buildWhiteboardPoolDocData(docId))
                .filter(Boolean);
            const showPoolRootDocBadge = poolGroupMode !== 'doc' && poolDocDataList.length > 1;
            const comparePoolRootEntries = (left, right) => {
                const lOrder = getOrder(left?.rootId);
                const rOrder = getOrder(right?.rootId);
                if (lOrder !== rOrder) return lOrder - rOrder;
                const lDocRank = poolDocRankMap.has(String(left?.docId || '').trim()) ? poolDocRankMap.get(String(left?.docId || '').trim()) : 999999;
                const rDocRank = poolDocRankMap.has(String(right?.docId || '').trim()) ? poolDocRankMap.get(String(right?.docId || '').trim()) : 999999;
                if (lDocRank !== rDocRank) return lDocRank - rDocRank;
                return __tmCompareTasksByDocFlow(left?.task || null, right?.task || null);
            };
            const poolRootEntries = poolDocDataList
                .flatMap((docData) => docData.rootIds.map((rootId) => ({
                    docId: docData.docId,
                    docData,
                    rootId,
                    task: docData.taskMap.get(rootId) || null,
                })))
                .filter((entry) => !!entry?.task && !!String(entry?.rootId || '').trim())
                .sort(comparePoolRootEntries);
            const pinnedPoolRootEntries = poolPinWithinGroups
                ? []
                : poolRootEntries.filter((entry) => isPoolActivePinnedTask(entry?.task));
            const regularPoolRootEntries = poolPinWithinGroups
                ? poolRootEntries.slice()
                : poolRootEntries.filter((entry) => !isPoolActivePinnedTask(entry?.task));
            const pinnedPoolTaskIds = new Set();
            pinnedPoolRootEntries.forEach((entry) => {
                const visit = (taskId) => {
                    const id = String(taskId || '').trim();
                    if (!id || pinnedPoolTaskIds.has(id)) return;
                    pinnedPoolTaskIds.add(id);
                    (entry?.docData?.childrenMap?.get(id) || []).forEach((childId) => visit(childId));
                };
                visit(entry?.rootId);
            });
            const buildPoolSectionTitleHtml = (section) => {
                const label = String(section?.label || '').trim();
                const labelColor = String(section?.labelColor || '').trim();
                if (section?.kind === 'pinned') {
                    return __tmRenderIconLabel('pin', label || '置顶', {
                        style: labelColor ? `color:${labelColor};` : 'color:var(--tm-warning-color);',
                    });
                }
                if (section?.kind === 'task') {
                    return __tmRenderIconLabel('puzzle', label || '未命名任务', {
                        style: labelColor ? `color:${labelColor};` : '',
                    });
                }
                if (section?.kind === 'none') {
                    return `<span>${esc(label || '全部任务')}</span>`;
                }
                if (section?.kind === 'time') {
                    const rawHtml = String(section?.labelHtml || '').trim();
                    const safeHtml = rawHtml || esc(label);
                    return `<span${labelColor ? ` style="color:${esc(labelColor)};"` : ''}>${safeHtml}</span>`;
                }
                return `<span${labelColor ? ` style="color:${esc(labelColor)};"` : ''}>${esc(label)}</span>`;
            };
            const renderWhiteboardPoolGroupedSection = (section, options = {}) => {
                if (!section || !Array.isArray(section.rootEntries) || !section.rootEntries.length) return '';
                const entryByTaskId = new Map(section.rootEntries.map((entry) => [String(entry?.rootId || '').trim(), entry]));
                const preferTimeGroupSort = !!SettingsStore.data.groupSortByBestSubtaskTimeInTimeQuadrant
                    && (section?.kind === 'time' || section?.kind === 'quadrant');
                const sortedTasks = sortPoolTasksLikeChecklist(
                    section.rootEntries.map((entry) => entry?.task).filter(Boolean),
                    preferTimeGroupSort ? comparePoolByTimePriority : null
                );
                const rootEntries = sortedTasks
                    .map((task) => entryByTaskId.get(String(task?.id || '').trim()))
                    .filter(Boolean);
                const taskCount = rootEntries.reduce((sum, entry) => {
                    const count = Number(entry?.docData?.countTreeNodes?.(entry?.rootId)) || 0;
                    return sum + count;
                }, 0);
                const showDocBadge = typeof options?.showDocBadge === 'boolean'
                    ? options.showDocBadge
                    : showPoolRootDocBadge;
                const kind = String(section?.kind || 'group').trim() || 'group';
                const key = String(section?.key || section?.label || 'all').trim() || 'all';
                const label = String(section?.label || '').trim() || '分组';
                const sectionKey = `${kind}:${key}`;
                const sectionHead = renderWhiteboardPoolSectionHead({
                    sectionKey,
                    titleHtml: buildPoolSectionTitleHtml(section),
                    count: taskCount,
                    label,
                });
                const collapsed = sectionHead.collapsed;
                return `
                    <section class="tm-whiteboard-pool-doc${collapsed ? ' tm-whiteboard-pool-doc--collapsed' : ''}" data-pool-section-key="${esc(sectionKey)}">
                        ${sectionHead.html}
                        <div class="tm-whiteboard-pool-list"${collapsed ? ' hidden' : ''}>
                            ${rootEntries.map((entry) => entry.docData.renderPoolTaskNode(entry.rootId, 0, { showDocBadge })).join('')}
                        </div>
                    </section>
                `;
            };
            const whiteboardPoolSearchOpen = !!state.whiteboardPoolSearchOpen;
            const whiteboardPoolSearchKeyword = String(state.whiteboardPoolSearchKeyword || '').trim();
            const poolSearchDocRankMap = new Map((isGlobalBoardMode ? poolSourceDocIds : selectedDocIds).map((id, idx) => [String(id || '').trim(), idx]));
            const poolSearchTaskMap = new Map();
            (isGlobalBoardMode ? globalCanvasSourceDocIds : selectedDocIds).forEach((docIdRaw) => {
                const docId = String(docIdRaw || '').trim();
                if (!docId) return;
                (byDoc.get(docId) || []).forEach((task) => {
                    const id = String(task?.id || '').trim();
                    if (!id || task?.__tmGhost || poolSearchTaskMap.has(id)) return;
                    poolSearchTaskMap.set(id, { ...(task || {}), __tmSearchDocId: docId });
                });
            });
            Object.keys(placedMap || {}).forEach((taskId) => {
                const id = String(taskId || '').trim();
                if (!id || !placedMap[id] || poolSearchTaskMap.has(id)) return;
                const posDocId = String(posMap?.[id]?.docId || '').trim();
                const live = (isGlobalBoardMode ? globalWhiteboardTaskMap.get(id) : null) || state.flatTasks?.[id];
                if (!live || typeof live !== 'object') return;
                const docId = String(live?.root_id || live?.docId || posDocId).trim();
                if (!docId) return;
                if (!isGlobalBoardMode && !docIdSet.has(docId)) return;
                const task = live;
                if (!task || (!showDoneTasks && isWhiteboardTaskDone(task))) return;
                poolSearchTaskMap.set(id, { ...(task || {}), __tmSearchDocId: docId });
            });
            const getPoolSearchTaskLike = (taskId) => {
                const id = String(taskId || '').trim();
                if (!id) return null;
                const live = (isGlobalBoardMode ? globalWhiteboardTaskMap.get(id) : null) || state.flatTasks?.[id];
                if (live && typeof live === 'object') return live;
                const fromSearch = poolSearchTaskMap.get(id);
                if (fromSearch && typeof fromSearch === 'object') return fromSearch;
                const snap = snapMap?.[id];
                if (!snap || typeof snap !== 'object') return null;
                return {
                    id,
                    root_id: String(snap.docId || '').trim(),
                    docId: String(snap.docId || '').trim(),
                    parentTaskId: String(snap.parentTaskId || '').trim(),
                    done: !!snap.done,
                };
            };
            const isPoolSearchTaskOnWhiteboard = (taskId) => {
                let cur = String(taskId || '').trim();
                if (!cur) return false;
                if (placedMap[cur]) return true;
                const seen = new Set();
                while (cur && !seen.has(cur)) {
                    seen.add(cur);
                    if (isDetachedTask(cur)) return false;
                    const task = getPoolSearchTaskLike(cur);
                    const pid = String(task?.parentTaskId || '').trim();
                    if (!pid) return false;
                    if (placedMap[pid]) return true;
                    cur = pid;
                }
                return false;
            };
            const getPoolSearchText = (task) => {
                const docId = String(task?.__tmSearchDocId || task?.root_id || task?.docId || '').trim();
                return [
                    task?.content,
                    task?.markdown,
                    task?.remark,
                    task?.custom_remark,
                    task?.h2,
                    task?.h2Path,
                    docNameById.get(docId) || '',
                ].map((x) => String(x || '')).join('\n').toLowerCase();
            };
            const buildWhiteboardPoolSearchResults = (keywordRaw = '') => {
                const query = String(keywordRaw || '').trim().toLowerCase();
                return query ? Array.from(poolSearchTaskMap.values())
                    .filter((task) => showDoneTasks || !isWhiteboardTaskDone(task))
                    .filter((task) => getPoolSearchText(task).includes(query))
                    .sort((a, b) => {
                        const ad = String(a?.__tmSearchDocId || a?.root_id || a?.docId || '').trim();
                        const bd = String(b?.__tmSearchDocId || b?.root_id || b?.docId || '').trim();
                        const ar = poolSearchDocRankMap.has(ad) ? poolSearchDocRankMap.get(ad) : 999999;
                        const br = poolSearchDocRankMap.has(bd) ? poolSearchDocRankMap.get(bd) : 999999;
                        if (ar !== br) return ar - br;
                        const ao = getOrder(a?.id);
                        const bo = getOrder(b?.id);
                        if (ao !== bo) return ao - bo;
                        return __tmCompareTasksByDocFlow(a, b);
                    })
                    : [];
            };
            const renderWhiteboardPoolSearchResults = (keywordRaw = '') => {
                const keyword = String(keywordRaw || '').trim();
                const poolSearchResults = buildWhiteboardPoolSearchResults(keyword);
                if (!keyword) {
                    return `<div class="tm-whiteboard-pool-empty">输入关键词搜索任务</div>`;
                }
                if (!poolSearchResults.length) {
                    return `<div class="tm-whiteboard-pool-empty">没有匹配任务</div>`;
                }
                return `
                    <section class="tm-whiteboard-pool-doc tm-whiteboard-pool-search-results">
                        <header class="tm-whiteboard-pool-doc-head">搜索结果 · ${poolSearchResults.length}</header>
                        <div class="tm-whiteboard-pool-list">
                            ${poolSearchResults.map((task) => {
                                const tid = String(task?.id || '').trim();
                                if (!tid) return '';
                                const docId = String(task?.__tmSearchDocId || task?.root_id || task?.docId || '').trim();
                                const placed = isPoolSearchTaskOnWhiteboard(tid);
                                const selectedCls = poolSelectedSet.has(tid) ? ' tm-whiteboard-pool-item--selected' : '';
                                const taskDone = isWhiteboardTaskDone(task);
                                const doneCls = taskDone ? ' tm-whiteboard-pool-item--done' : '';
                                const placedCls = placed ? ' tm-whiteboard-pool-item--placed' : '';
                                const draggableAttr = placed ? 'false' : 'true';
                                const blockedPressAttr = placed ? ' onpointerdown="tmWhiteboardPoolSearchPressGuard(event)" onmousedown="tmWhiteboardPoolSearchPressGuard(event)"' : '';
                                const mouseDownAttr = placed ? '' : ` onmousedown="tmWhiteboardPoolItemMouseDown(event, '${escSq(tid)}', '${escSq(docId)}', false)"`;
                                const blockedDragStartAttr = ' ondragstart="event.preventDefault();event.stopPropagation();return false"';
                                const dragStartAttr = placed ? blockedDragStartAttr : ` ondragstart="tmWhiteboardPoolDragStart(event, '${escSq(tid)}', '${escSq(docId)}')"`;
                                const dragEndAttr = placed ? '' : ' ondragend="tmWhiteboardPoolDragEnd(event)"';
                                const titleDragAttr = placed
                                    ? ` draggable="false"${blockedDragStartAttr}`
                                    : ` draggable="true"${mouseDownAttr} ondragstart="tmWhiteboardPoolDragStart(event, '${escSq(tid)}', '${escSq(docId)}')" ondragend="tmWhiteboardPoolDragEnd(event)"`;
                                const contentDragAttr = placed
                                    ? ` draggable="false"${blockedDragStartAttr}`
                                    : ` draggable="true"${mouseDownAttr} ondragstart="tmWhiteboardPoolDragStart(event, '${escSq(tid)}', '${escSq(docId)}')" ondragend="tmWhiteboardPoolDragEnd(event)"`;
                                const itemTitle = placed ? '点击定位白板卡片' : '点击跳转原文档，拖动到白板';
                                return `
                                    <div class="tm-whiteboard-pool-item tm-whiteboard-pool-search-item${doneCls}${placedCls}${selectedCls}" data-task-id="${esc(tid)}" data-doc-id="${esc(docId)}" data-tm-pool-search-result="1" data-tm-pool-placed="${placed ? '1' : '0'}" draggable="${draggableAttr}" onclick="tmWhiteboardSearchResultClick('${escSq(tid)}', event)" oncontextmenu="tmShowTaskContextMenu(event, '${escSq(tid)}')"${blockedPressAttr}${mouseDownAttr}${dragStartAttr}${dragEndAttr} title="${esc(itemTitle)}">
                                        ${__tmRenderTaskCheckboxWrap(tid, task, { checked: taskDone, stopMouseDown: true, stopPointerDown: true, stopClick: true, title: '完成状态', onchange: `tmWhiteboardSetDone('${escSq(tid)}', this.checked, event)` })}
                                        <span class="tm-whiteboard-pool-item-prefix" title="${esc(docNameById.get(docId) || '未知文档')}">${__tmRenderDocIcon(docId, { fallbackText: '📄', size: 12 })}</span>
                                        <span class="tm-whiteboard-pool-item-title"${titleDragAttr}><span class="tm-task-content-clickable"${contentDragAttr}${__tmBuildTooltipAttrs(API.getTaskTitlePresentation(task?.markdown, String(task?.content || '').trim() || '(无内容)').text, { side: 'bottom', ariaLabel: false })} style="${__tmBuildTaskTitleOpacityStyle(task)}">${API.renderTaskContentHtml(task?.markdown, String(task?.content || '').trim() || '(无内容)')}${__tmRenderGlobalCollectDocTaskInlineIcon(task)}${__tmRenderRecurringTaskInlineIcon(task)}${__tmRenderRecurringInstanceBadge(task, { className: 'tm-recurring-instance-badge--inline' })}</span></span>
                                        <span class="tm-badge tm-badge--count tm-whiteboard-pool-search-status${placed ? ' tm-whiteboard-pool-search-status--placed' : ''}">${placed ? '已在白板' : '未加入'}</span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </section>
                `;
            };
            state.__tmRenderWhiteboardPoolSearchResultsHtml = () => renderWhiteboardPoolSearchResults(state.whiteboardPoolSearchKeyword);
            const pinnedPoolHtml = pinnedPoolRootEntries.length
                ? renderWhiteboardPoolGroupedSection({
                    kind: 'pinned',
                    key: 'pinned_root_tasks',
                    label: '置顶',
                    labelColor: 'var(--tm-warning-color)',
                    rootEntries: pinnedPoolRootEntries,
                }, { showDocBadge: poolDocDataList.length > 1 })
                : '';
            let poolHtml = '';
            if (poolGroupMode === 'doc') {
                poolHtml = poolDocDataList
                    .map((docData) => renderWhiteboardPoolDocSection(docData, { excludedTaskIds: pinnedPoolTaskIds }))
                    .join('');
            } else if (poolGroupMode === 'time') {
                const groups = new Map();
                regularPoolRootEntries.forEach((entry) => {
                    const info = getPoolTimeGroupInfo(entry.task);
                    if (!groups.has(info.key)) {
                        groups.set(info.key, {
                            kind: 'time',
                            key: info.key,
                            label: info.label,
                            labelHtml: info.labelHtml,
                            labelColor: getPoolTimeGroupLabelColor(info),
                            sortValue: Number(info.sortValue),
                            rootEntries: [],
                        });
                    }
                    groups.get(info.key).rootEntries.push(entry);
                });
                poolHtml = Array.from(groups.values())
                    .sort((a, b) => Number(a?.sortValue) - Number(b?.sortValue))
                    .map((section) => renderWhiteboardPoolGroupedSection(section))
                    .join('');
            } else if (poolGroupMode === 'quadrant') {
                const groups = new Map();
                regularPoolRootEntries.forEach((entry) => {
                    const info = getPoolQuadrantGroupInfo(entry.task);
                    if (!info) return;
                    if (!groups.has(info.key)) {
                        groups.set(info.key, {
                            kind: 'quadrant',
                            key: info.key,
                            label: info.label,
                            labelColor: info.labelColor,
                            sortValue: Number(info.sortValue),
                            rootEntries: [],
                        });
                    }
                    groups.get(info.key).rootEntries.push(entry);
                });
                poolHtml = Array.from(groups.values())
                    .sort((a, b) => Number(a?.sortValue) - Number(b?.sortValue))
                    .map((section) => renderWhiteboardPoolGroupedSection(section))
                    .join('');
            } else if (poolGroupMode === 'task') {
                const groups = new Map();
                regularPoolRootEntries.forEach((entry) => {
                    const content = String(entry?.task?.content || '').trim();
                    if (!content) return;
                    const safeContent = String(content).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
                    const key = `task_${safeContent}`;
                    if (!groups.has(key)) {
                        groups.set(key, {
                            kind: 'task',
                            key,
                            label: content,
                            labelColor: 'var(--tm-primary-color)',
                            rootEntries: [],
                        });
                    }
                    groups.get(key).rootEntries.push(entry);
                });
                poolHtml = Array.from(groups.values())
                    .map((section) => renderWhiteboardPoolGroupedSection(section))
                    .join('');
            } else {
                const hasSeparatePinnedGroup = pinnedPoolRootEntries.length > 0;
                poolHtml = regularPoolRootEntries.length
                    ? renderWhiteboardPoolGroupedSection({
                        kind: hasSeparatePinnedGroup ? 'normal' : 'none',
                        key: hasSeparatePinnedGroup ? 'normal_root_tasks' : 'all',
                        label: hasSeparatePinnedGroup ? '普通' : '全部任务',
                        rootEntries: regularPoolRootEntries,
                    })
                    : '';
            }
            poolHtml = `${pinnedPoolHtml}${poolHtml}`;
            const poolContentHtml = whiteboardPoolSearchOpen
                ? renderWhiteboardPoolSearchResults(whiteboardPoolSearchKeyword)
                : (poolHtml || `<div class="tm-whiteboard-pool-empty">当前没有可拖出的任务</div>`);

            let whiteboardLayoutStateDirty = false;
            if (posDirty) {
                if (isGlobalBoardMode) {
                    __tmPatchWhiteboardGlobalBoardState(globalWhiteboardGroupId, { nodePos: posMap }, { keepEmpty: true });
                } else {
                    SettingsStore.data.whiteboardNodePos = posMap;
                    try { SettingsStore.syncToLocal(); } catch (e) {}
                }
                whiteboardLayoutStateDirty = true;
            }
            if (placedDirty) {
                if (isGlobalBoardMode) {
                    __tmPatchWhiteboardGlobalBoardState(globalWhiteboardGroupId, { placedTaskIds: placedMap }, { keepEmpty: true });
                } else {
                    SettingsStore.data.whiteboardPlacedTaskIds = placedMap;
                    try { SettingsStore.syncToLocal(); } catch (e) {}
                }
                whiteboardLayoutStateDirty = true;
            }
            if (whiteboardLayoutStateDirty) {
                try { WhiteboardStore?.syncFromSettings?.(SettingsStore.data, 'render-layout-normalize'); } catch (e) {}
                try { SettingsStore.save().catch(() => null); } catch (e) {}
            }

            const whiteboardTool = String(SettingsStore.data.whiteboardTool || 'pan').trim();
            const whiteboardDrawingToolsEnabled = !isAllTabsView || isGlobalBoardMode;
            const whiteboardDrawingModeActive = whiteboardDrawingToolsEnabled && !drawingConfig.hidden && (whiteboardTool === 'pen' || whiteboardTool === 'highlighter' || whiteboardTool === 'eraser');
            const viewportToolClass = whiteboardTool === 'pan'
                ? ' tm-whiteboard-viewport--tool-pan'
                : (whiteboardDrawingModeActive ? ` tm-whiteboard-viewport--tool-${whiteboardTool}` : (whiteboardTool === 'frame' ? ' tm-whiteboard-viewport--tool-frame' : ''));
            const compactSidebarHost = !!(isMobile || isDockHost);
            if (compactSidebarHost && typeof state.whiteboardCompactSidebarCollapsed !== 'boolean') {
                state.whiteboardCompactSidebarCollapsed = true;
            }
            const sidebarCollapsed = compactSidebarHost
                ? state.whiteboardCompactSidebarCollapsed !== false
                : !!SettingsStore.data.whiteboardSidebarCollapsed;
            const sidebarWidth = Math.max(220, Math.min(520, Math.round(Number(SettingsStore.data.whiteboardSidebarWidth) || 300)));
            const layoutClass = sidebarCollapsed ? ' tm-whiteboard-layout--sidebar-collapsed' : '';
            const navigatorHidden = !!SettingsStore.data.whiteboardNavigatorHidden;
            const navigatorReadyAttr = (!navigatorHidden && state.whiteboardNavigatorModel) ? ' data-tm-ready="1"' : '';
            const sidebarToggleLabel = sidebarCollapsed ? '展开侧栏' : '折叠侧栏';
            const sidebarToggleGlyph = sidebarCollapsed ? '☰' : '⟨';
            const compactSidebarToggleHtml = compactSidebarHost
                ? `<button type="button" class="tm-btn tm-btn-info bc-btn bc-btn--sm tm-whiteboard-sidebar-title-toggle" onclick="tmWhiteboardToggleSidebar(event)"${__tmBuildTooltipAttrs('折叠任务池', { side: 'bottom' })}>⟨</button>`
                : '';
            const whiteboardPluginFullscreen = !!state.whiteboardPluginFullscreen;
            const whiteboardBottomMoreOpen = !!state.whiteboardBottomMoreOpen;
            const renderWhiteboardToolbarButton = ({ label, icon, onclick, active = false, pressed = null, extraClass = '' }) => {
                const cls = `tm-btn tm-btn-info bc-btn bc-btn--sm tm-whiteboard-toolbar-btn${active ? ' tm-whiteboard-toolbar-btn--active' : ''}${extraClass ? ` ${extraClass}` : ''}`;
                const ariaPressed = pressed == null ? '' : ` aria-pressed="${pressed ? 'true' : 'false'}"`;
                return `<button type="button" class="${cls}" onclick="${onclick}"${ariaPressed}${__tmBuildTooltipAttrs(label, { side: 'top' })}>${__tmPhosphorBoldSvg(icon, { size: 20, className: 'tm-whiteboard-toolbar-btn__icon', style: 'width:20px;height:20px;min-width:20px;min-height:20px;max-width:20px;max-height:20px;' })}</button>`;
            };
            const renderWhiteboardBottomMoreItem = ({ label, icon, onclick, danger = false }) => {
                const cls = `tm-whiteboard-bottom-more-item${danger ? ' tm-whiteboard-bottom-more-item--danger' : ''}`;
                return `<button type="button" class="${cls}" onclick="${onclick}">${__tmPhosphorBoldSvg(icon, { size: 16, className: 'tm-whiteboard-bottom-more-item__icon' })}<span>${esc(label)}</span></button>`;
            };
            const renderDrawingToolButton = ({ label, icon, onclick, active = false, danger = false, disabled = false, extraClass = '' }) => {
                const cls = `tm-btn ${danger ? 'tm-btn-danger' : 'tm-btn-info'} bc-btn bc-btn--sm tm-whiteboard-drawing-tool-btn${active ? ' tm-whiteboard-drawing-tool-btn--active' : ''}${disabled ? ' tm-whiteboard-drawing-tool-btn--disabled' : ''}${extraClass ? ` ${extraClass}` : ''}`;
                return `<button type="button" class="${cls}" onclick="${onclick}" aria-pressed="${active ? 'true' : 'false'}"${disabled ? ' disabled' : ''}${__tmBuildTooltipAttrs(label, { side: 'left' })}>${__tmPhosphorBoldSvg(icon, { size: 20, className: 'tm-whiteboard-drawing-tool-btn__icon', style: 'width:20px;height:20px;min-width:20px;min-height:20px;max-width:20px;max-height:20px;' })}</button>`;
            };
            const renderWhiteboardDrawingToolbar = () => {
                if (!whiteboardDrawingModeActive) return '';
                const cfg = drawingConfig;
                const activeColor = whiteboardTool === 'highlighter' ? cfg.highlighterColor : cfg.penColor;
                const activeWidth = whiteboardTool === 'highlighter'
                    ? cfg.highlighterWidth
                    : (whiteboardTool === 'eraser' ? cfg.eraserWidth : cfg.penWidth);
                const activeWidthValue = Math.round(Math.max(1, Math.min(64, Number(activeWidth) || 4)) * 10) / 10;
                const widthRange = whiteboardTool === 'highlighter'
                    ? { min: 4, max: 48 }
                    : (whiteboardTool === 'eraser' ? { min: 6, max: 64 } : { min: 1, max: 24 });
                const selectedStrokeCount = Math.max(
                    String(state.whiteboardSelectedStrokeId || '').trim() ? 1 : 0,
                    Array.isArray(state.whiteboardMultiSelectedStrokeIds) ? state.whiteboardMultiSelectedStrokeIds.length : 0
                );
                const drawingUndoStack = Array.isArray(state.whiteboardDrawingUndoStack) ? state.whiteboardDrawingUndoStack : [];
                const drawingUndoKey = isGlobalBoardMode
                    ? `global:${String(globalWhiteboardGroupId || '').trim() || 'all'}`
                    : (String(state.activeDocId || '').trim() ? `doc:${String(state.activeDocId || '').trim()}` : '');
                const canUndoDrawing = !!drawingUndoKey && drawingUndoStack.some((entry) => String(entry?.key || '').trim() === drawingUndoKey);
                const customColors = ['#1f2937', '#2f6fed', '#ef4444', '#64748b', '#0f766e', '#0891b2', '#16a34a', '#f59e0b', '#db2777', '#7c3aed'];
                const activeColorLower = String(activeColor || '').toLowerCase();
                const currentColor = /^#[0-9a-fA-F]{6}$/.test(activeColorLower) ? activeColorLower : '#1f2937';
                const moreColorsOpen = !!state.whiteboardDrawingMoreColorsOpen;
                const actionsOpen = !!state.whiteboardDrawingActionsOpen;
                const renderColorSwatch = (color) => `<button type="button" class="tm-whiteboard-drawing-swatch${activeColorLower === color ? ' is-active' : ''}" style="--tm-whiteboard-drawing-swatch:${esc(color)};" onclick="tmWhiteboardSetDrawingColor('${escSq(color)}', event)"${__tmBuildTooltipAttrs(`颜色 ${color}`, { side: 'left' })}></button>`;
                const renderCustomColorButton = () => {
                    const cls = `tm-whiteboard-drawing-custom-color is-active${moreColorsOpen ? ' is-open' : ''}`;
                    return `<button type="button" class="${cls}" style="--tm-whiteboard-drawing-custom-color:${esc(currentColor)};" onclick="tmWhiteboardToggleDrawingMoreColors(event)" aria-pressed="${moreColorsOpen ? 'true' : 'false'}"${__tmBuildTooltipAttrs(moreColorsOpen ? '收起颜色' : '选择颜色', { side: 'left' })}></button>`;
                };
                return `
                    <div class="tm-whiteboard-drawing-toolbar" data-tm-whiteboard-drawing-toolbar="1">
                        <div class="tm-whiteboard-drawing-toolbar__group">
                            ${renderDrawingToolButton({ label: '画笔', icon: 'pencil', onclick: "tmWhiteboardSetTool('pen')", active: whiteboardTool === 'pen' })}
                            ${renderDrawingToolButton({ label: '高亮笔', icon: 'highlighter', onclick: "tmWhiteboardSetTool('highlighter')", active: whiteboardTool === 'highlighter' })}
                            ${renderDrawingToolButton({ label: '橡皮', icon: 'eraser', onclick: "tmWhiteboardSetTool('eraser')", active: whiteboardTool === 'eraser' })}
                        </div>
                        <div class="tm-whiteboard-drawing-toolbar__group">
                            ${renderDrawingToolButton({ label: '撤销手写 Ctrl+Z', icon: 'arrow-counter-clockwise', onclick: 'tmWhiteboardUndoDrawing(event)', disabled: !canUndoDrawing })}
                        </div>
                        <div class="tm-whiteboard-drawing-toolbar__group tm-whiteboard-drawing-toolbar__colors">
                            ${renderCustomColorButton()}
                            ${moreColorsOpen ? `<div class="tm-whiteboard-drawing-color-panel" role="group" aria-label="更多颜色">${customColors.map(renderColorSwatch).join('')}</div>` : ''}
                        </div>
                        <div class="tm-whiteboard-drawing-toolbar__group tm-whiteboard-drawing-toolbar__widths">
                            <input class="tm-whiteboard-drawing-width-slider" type="range" min="${widthRange.min}" max="${widthRange.max}" step="0.1" value="${activeWidthValue}" oninput="tmWhiteboardSetDrawingWidth(this.value, event, { persist: false, render: false })" onchange="tmWhiteboardSetDrawingWidth(this.value, event)" aria-label="${whiteboardTool === 'eraser' ? '橡皮大小' : '笔画粗细'}"${__tmBuildTooltipAttrs(`${activeWidthValue}px`, { side: 'left' })}>
                            <span class="tm-whiteboard-drawing-width-value">${activeWidthValue}</span>
                        </div>
                        <div class="tm-whiteboard-drawing-toolbar__group tm-whiteboard-drawing-toolbar__actions">
                            ${renderDrawingToolButton({ label: '更多手写操作', icon: 'dots-three', onclick: 'tmWhiteboardToggleDrawingActions(event)', active: actionsOpen })}
                            ${actionsOpen ? `<div class="tm-whiteboard-drawing-actions-panel">
                                ${renderDrawingToolButton({ label: '清空当前手写', icon: 'trash', onclick: 'tmWhiteboardClearDrawings(event)', danger: true })}
                            </div>` : ''}
                        </div>
                    </div>
                `;
            };
            const poolSearchBarHtml = whiteboardPoolSearchOpen ? `
                <div class="tm-whiteboard-pool-searchbar" role="search">
                    <input id="tmWhiteboardPoolSearchInput" class="b3-text-field tm-whiteboard-pool-searchbar__input" type="search" value="${esc(whiteboardPoolSearchKeyword)}" placeholder="搜索任务池" autocomplete="off" spellcheck="false" aria-label="搜索任务池" oncompositionstart="tmWhiteboardPoolSearchCompositionStart(event)" oncompositionend="tmWhiteboardPoolSearchCompositionEnd(event)" oninput="tmWhiteboardPoolSearchInput(event)" onmousedown="event.stopPropagation()" onclick="event.stopPropagation()" onkeydown="if(event.key==='Escape'){tmWhiteboardTogglePoolSearch(event)}">
                    <button type="button" class="tm-btn tm-btn-info bc-btn bc-btn--sm tm-whiteboard-pool-searchbar__btn" onclick="tmWhiteboardClearPoolSearch(event)"${__tmBuildTooltipAttrs('清空搜索', { side: 'bottom' })}>${__tmPhosphorBoldSvg('x-circle', { size: 15, className: 'tm-whiteboard-pool-searchbar__btn-icon' })}</button>
                    <button type="button" class="tm-btn tm-btn-info bc-btn bc-btn--sm tm-whiteboard-pool-searchbar__btn" onclick="tmWhiteboardTogglePoolSearch(event)"${__tmBuildTooltipAttrs('关闭搜索', { side: 'bottom' })}>${__tmPhosphorBoldSvg('x', { size: 15, className: 'tm-whiteboard-pool-searchbar__btn-icon' })}</button>
                </div>
            ` : '';
            return `
                <div class="tm-body tm-body--whiteboard${bodyAnimClass}" id="tmWhiteboardBody">
                    <div class="tm-whiteboard-layout${layoutClass}" style="--tm-wb-sidebar-width:${sidebarWidth}px;">
                        <aside class="tm-whiteboard-sidebar">
                            <div class="tm-whiteboard-sidebar-scroll" onscroll="tmWhiteboardSidebarScroll(event)">
                                <div class="tm-whiteboard-sidebar-title-row">
                                    <div class="tm-whiteboard-sidebar-title-wrap">
                                        ${compactSidebarToggleHtml}
                                        <div class="tm-whiteboard-sidebar-title">任务池</div>
                                    </div>
                                    <div class="tm-whiteboard-sidebar-actions">
                                        <label class="tm-whiteboard-sidebar-switch" title="显示已完成任务">
                                            <input type="checkbox" ${showDoneTasks ? 'checked' : ''} onchange="tmWhiteboardToggleShowDone(this.checked)">
                                            <span>已完成</span>
                                        </label>
                                        <button type="button" class="tm-btn tm-btn-info bc-btn bc-btn--sm tm-whiteboard-pool-search-toggle${whiteboardPoolSearchOpen ? ' tm-whiteboard-pool-search-toggle--active' : ''}" onclick="tmWhiteboardTogglePoolSearch(event)" aria-pressed="${whiteboardPoolSearchOpen ? 'true' : 'false'}"${__tmBuildTooltipAttrs(whiteboardPoolSearchOpen ? '关闭搜索' : '搜索任务池', { side: 'bottom' })}>${__tmPhosphorBoldSvg('magnifying-glass', { size: 15, className: 'tm-whiteboard-pool-search-toggle__icon' })}</button>
                                    </div>
                                </div>
                                ${poolSearchBarHtml}
                                <div id="tmWhiteboardPoolContent">${poolContentHtml}</div>
                            </div>
                            <div class="tm-whiteboard-sidebar-scrollbar" aria-hidden="true"><div class="tm-whiteboard-sidebar-scrollbar-thumb"></div></div>
                        </aside>
                        <div class="tm-whiteboard-sidebar-resizer" onmousedown="tmStartWhiteboardSidebarResize(event)" title="拖拽调整侧栏宽度"></div>
                        <div class="tm-whiteboard-main">
                            <button class="tm-btn tm-btn-info tm-whiteboard-sidebar-toggle" onclick="tmWhiteboardToggleSidebar(event)" title="${sidebarToggleLabel}">${sidebarToggleGlyph}</button>
                            <div id="tmWhiteboardViewport" class="tm-whiteboard-viewport${viewportToolClass}" onpointerdown="tmWhiteboardViewportMouseDown(event)" oncontextmenu="return tmWhiteboardViewportContextMenu(event)" onclick="tmWhiteboardBoardClick(event)" ondblclick="tmWhiteboardBoardDblClick(event)" ondragover="tmWhiteboardBoardDragOver(event)" ondrop="tmWhiteboardBoardDrop(event)">
                                <div id="tmWhiteboardWorld" class="tm-whiteboard-world" style="transform:translate(${view.x}px, ${view.y}px) scale(${view.zoom});">
                                    <div class="tm-whiteboard tm-kanban--clean${isKanbanCompact ? ' tm-kanban--compact' : ''}">
                                        ${docsHtml || `<div style="padding:18px;color:var(--tm-secondary-text);">暂无任务可用于白板视图</div>`}
                                    </div>
                                </div>
                                <div id="tmWhiteboardNavigator" class="tm-whiteboard-navigator${navigatorHidden ? ' tm-whiteboard-navigator--hidden' : ''}"${navigatorReadyAttr} aria-label="白板视图浏览窗口">
                                    <button type="button" class="tm-whiteboard-navigator__hide" onclick="tmWhiteboardSetNavigatorHidden(true, event)" title="隐藏浏览窗口">${__tmRenderLucideIcon('corners-in')}</button>
                                    <div class="tm-whiteboard-navigator__surface" onpointerdown="tmWhiteboardNavigatorSurfacePointerDown(event)">
                                        <div class="tm-whiteboard-navigator__content"></div>
                                        <div class="tm-whiteboard-navigator__viewport" onpointerdown="tmWhiteboardNavigatorViewportPointerDown(event)"></div>
                                    </div>
                                </div>
                                <button id="tmWhiteboardNavigatorReveal" type="button" class="tm-whiteboard-navigator-reveal${navigatorHidden ? ' tm-whiteboard-navigator-reveal--visible' : ''}" onclick="tmWhiteboardSetNavigatorHidden(false, event)" title="显示浏览窗口">${__tmRenderLucideIcon('map')}</button>
                                ${renderWhiteboardDrawingToolbar()}
                                <div class="tm-whiteboard-bottom-toolbar">
                                    ${renderWhiteboardToolbarButton({ label: '平移模式', icon: 'hand', onclick: "tmWhiteboardSetTool('pan')", active: whiteboardTool === 'pan', pressed: whiteboardTool === 'pan' })}
                                    ${renderWhiteboardToolbarButton({ label: '多选模式', icon: 'selection-plus', onclick: "tmWhiteboardSetTool('select')", active: whiteboardTool === 'select', pressed: whiteboardTool === 'select' })}
                                    ${renderWhiteboardToolbarButton({ label: '文字模式', icon: 'cursor-text', onclick: "tmWhiteboardSetTool('text')", active: whiteboardTool === 'text', pressed: whiteboardTool === 'text' })}
                                    ${renderWhiteboardToolbarButton({ label: '便利贴模式', icon: 'note-pencil', onclick: "tmWhiteboardSetTool('sticky')", active: whiteboardTool === 'sticky', pressed: whiteboardTool === 'sticky' })}
                                    ${renderWhiteboardToolbarButton({ label: '分组框', icon: 'bounding-box', onclick: "tmWhiteboardSetTool('frame')", active: whiteboardTool === 'frame', pressed: whiteboardTool === 'frame' })}
                                    ${whiteboardDrawingToolsEnabled ? renderWhiteboardToolbarButton({ label: '手写模式', icon: 'pencil', onclick: "tmWhiteboardSetTool('pen')", active: whiteboardDrawingModeActive, pressed: whiteboardDrawingModeActive }) : ''}
                                    ${renderWhiteboardToolbarButton({ label: '缩小画布', icon: 'minus', onclick: 'tmWhiteboardZoomOut()' })}
                                    ${renderWhiteboardToolbarButton({ label: '放大画布', icon: 'plus', onclick: 'tmWhiteboardZoomIn()' })}
                                    ${renderWhiteboardToolbarButton({ label: whiteboardPluginFullscreen ? '退出全屏' : '全屏', icon: whiteboardPluginFullscreen ? 'corners-in' : 'corners-out', onclick: 'tmWhiteboardTogglePluginFullscreen(event)', active: whiteboardPluginFullscreen, pressed: whiteboardPluginFullscreen })}
                                    <div class="tm-whiteboard-bottom-more">
                                        ${renderWhiteboardToolbarButton({ label: '更多白板操作', icon: 'dots-three', onclick: 'tmWhiteboardToggleBottomMore(event)', active: whiteboardBottomMoreOpen, pressed: whiteboardBottomMoreOpen })}
                                        ${whiteboardBottomMoreOpen ? `<div class="tm-whiteboard-bottom-more-panel">
                                            ${whiteboardDrawingToolsEnabled ? renderWhiteboardBottomMoreItem({ label: drawingConfig.hidden ? '显示手写' : '隐藏手写', icon: drawingConfig.hidden ? 'eye' : 'eye-slash', onclick: 'tmWhiteboardToggleDrawingLayer(event)' }) : ''}
                                            ${renderWhiteboardBottomMoreItem({ label: '回到画布中心', icon: 'arrows-clockwise', onclick: 'tmWhiteboardResetView(event)' })}
                                            ${renderWhiteboardBottomMoreItem({ label: '清空卡片连线', icon: 'link-simple-break', onclick: 'tmWhiteboardClearLinks(event)', danger: true })}
                                        </div>` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        };


        return __tmRenderWhiteboardBodyHtml();
    }
