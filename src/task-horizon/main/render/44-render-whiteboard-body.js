    function __tmBuildRenderSceneWhiteboardBodyHtml(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const bodyAnimClass = String(opts.bodyAnimClass || '');
        const isMobile = !!opts.isMobile;

        const __tmRenderWhiteboardBodyHtml = () => {
            const filtered = Array.isArray(state.filteredTasks) ? state.filteredTasks : [];
            try { __tmUpsertWhiteboardTaskSnapshots(filtered, { persist: false }); } catch (e) {}
            const orderMap = new Map(filtered.map((t, i) => [String(t?.id || '').trim(), i]));
            const getOrder = (taskId) => orderMap.get(String(taskId || '').trim()) ?? 999999;
            const isDark = __tmIsDarkMode();
            const escSq = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const whiteboardCardFields = new Set(__tmGetTaskCardFieldList('whiteboard'));
            const showDoneTasks = !!SettingsStore.data.whiteboardShowDone;
            const statusOptionsRaw = Array.isArray(SettingsStore.data.customStatusOptions) ? SettingsStore.data.customStatusOptions : [];
            const statusOptions = statusOptionsRaw
                .map(o => ({ id: String(o?.id || '').trim(), name: String(o?.name || '').trim(), color: String(o?.color || '').trim() }))
                .filter(o => o.id);
            const todoOpt = statusOptions.find(o => o.id === 'todo') || { id: 'todo', name: '待办', color: '#757575' };
            const currentGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
            const docsInOrder0 = __tmSortDocEntriesForTabs(state.taskTree || [], currentGroupId).map(d => String(d?.id || '').trim()).filter(Boolean);
            const docNameById = new Map((state.taskTree || []).map(d => [String(d?.id || '').trim(), String(d?.name || '').trim() || '未命名文档']));
            const snapMap = __tmGetWhiteboardCardSnapshotMap();
            // 仅使用当前分组已加载文档，避免把其他分组/历史快照文档混入“全部页签”白板
            const docsInOrder = docsInOrder0;
            const detachedMap = __tmGetDetachedChildrenMap();
            const enableDocH2Subgroup = SettingsStore.data.docH2SubgroupEnabled !== false;
            const headingLevel = String(SettingsStore.data.taskHeadingLevel || 'h2').trim() || 'h2';
            const headingLabelMap = { h1: '一级标题', h2: '二级标题', h3: '三级标题', h4: '四级标题', h5: '五级标题', h6: '六级标题' };
            const noHeadingLabel = `无${headingLabelMap[headingLevel] || '标题'}`;
            const notes = Array.isArray(SettingsStore.data.whiteboardNotes) ? SettingsStore.data.whiteboardNotes : [];
            const noteColorOptions = ['#1f2937', '#2f6fed', '#16a34a', '#d97706', '#b91c1c', '#7c3aed'];
            const stickyThemeOptions = __tmGetWhiteboardStickyThemes();
            const view = __tmGetWhiteboardView();
            const posMap = { ...__tmGetWhiteboardNodePosMap() };
            const placedMap = { ...__tmGetWhiteboardPlacedTaskMap() };
            let posDirty = false;
            let placedDirty = false;
            const isDetachedTask = (taskId) => {
                const v = detachedMap[String(taskId || '').trim()];
                return !!(v && typeof v === 'object' && v.detached === true);
            };

            const selectedDocIds = (state.activeDocId && state.activeDocId !== 'all')
                ? [String(state.activeDocId)]
                : docsInOrder;
            const isAllTabsView = !(state.activeDocId && state.activeDocId !== 'all');
            const docIdSet = new Set(selectedDocIds);
            const byDoc = new Map();
            const pushDocTask = (taskLike) => {
                if (!taskLike || typeof taskLike !== 'object') return;
                const docId = String(taskLike?.root_id || taskLike?.docId || '').trim();
                const id = String(taskLike?.id || '').trim();
                if (!docId || !id || !docIdSet.has(docId)) return;
                if (!showDoneTasks && !!taskLike?.done) return;
                if (!byDoc.has(docId)) byDoc.set(docId, []);
                const list = byDoc.get(docId);
                if (list.some(x => String(x?.id || '').trim() === id)) return;
                list.push(taskLike);
            };
            filtered.forEach((task) => {
                pushDocTask(task);
            });
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
                if (selId && !state.flatTasks?.[selId] && !snapMap?.[selId]) {
                    state.whiteboardSelectedTaskId = '';
                }
            }
            // 不在这里按完成状态强制清空选中，避免点击已完成卡片后选中态立即丢失。
            // 仅当任务真实不存在时（见上方分支）才清理选中态。

            const allView = !(state.activeDocId && state.activeDocId !== 'all');
            if (allView && __tmGetWhiteboardAllTabsLayoutMode() === 'stream') {
                const streamByDoc = new Map();
                filtered.forEach((task) => {
                    if (!task || typeof task !== 'object') return;
                    const docId = String(task?.root_id || task?.docId || '').trim();
                    const id = String(task?.id || '').trim();
                    if (!docId || !id || !docIdSet.has(docId)) return;
                    if (!streamByDoc.has(docId)) streamByDoc.set(docId, []);
                    const list = streamByDoc.get(docId);
                    if (list.some((item) => String(item?.id || '').trim() === id)) return;
                    list.push(task);
                });
                const visibleDocIds0 = selectedDocIds.filter((docId) => (streamByDoc.get(String(docId || '').trim()) || []).length > 0);
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
                    const rootIds = docTasks
                        .map((task) => String(task?.id || '').trim())
                        .filter((tid) => {
                            if (!tid) return false;
                            const parentId = String(taskById.get(tid)?.parentTaskId || '').trim();
                            return !parentId || !taskById.has(parentId);
                        });
                    const useDocH2Subgroup = enableDocH2Subgroup && __tmDocHasAnyHeading(docId, docTasks);
                    const headingBuckets = useDocH2Subgroup ? __tmBuildDocHeadingBuckets(docTasks, noHeadingLabel) : [];
                    const rootIdsByHeading = new Map();
                    const headingCountMap = new Map();
                    if (useDocH2Subgroup) {
                        docTasks.forEach((task) => {
                            const bucket = __tmGetDocHeadingBucket(task, noHeadingLabel);
                            const key = String(bucket?.key || '').trim();
                            if (!key) return;
                            headingCountMap.set(key, (headingCountMap.get(key) || 0) + 1);
                        });
                        rootIds.forEach((tid) => {
                            const task = taskById.get(tid);
                            const bucket = __tmGetDocHeadingBucket(task, noHeadingLabel);
                            const key = String(bucket?.key || '').trim() || `label:${noHeadingLabel}`;
                            if (!rootIdsByHeading.has(key)) rootIdsByHeading.set(key, []);
                            rootIdsByHeading.get(key).push(tid);
                        });
                    }
                    const renderTaskTree = (taskId, inheritedHideCompleted = false) => {
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
                            ? `<div class="tm-whiteboard-stream-children"><div class="tm-whiteboard-stream-subtasks">${childIds.map((id) => renderTaskTree(id, hideCompletedDescendants)).join('')}</div></div>`
                            : '';
                        const multiSelectCls = __tmIsTaskMultiSelected(tid) ? ' tm-task-row--multi-selected' : '';
                        return `
                            <div class="tm-whiteboard-stream-task-node" data-task-id="${esc(tid)}" data-id="${esc(tid)}">
                                <div class="tm-whiteboard-stream-task">
                                    <div class="tm-whiteboard-stream-task-head${multiSelectCls}" data-task-id="${esc(tid)}" data-id="${esc(tid)}" draggable="true" ondragstart="tmDragTaskStart(event, '${escSq(tid)}')" ondragend="tmDragTaskEnd(event)" oncontextmenu="tmShowTaskContextMenu(event, '${escSq(tid)}')" onclick="tmWhiteboardStreamTaskHeadClick('${escSq(tid)}', event)">
                                        ${__tmRenderTaskCheckboxWrap(tid, task, { checked: task?.done, stopMouseDown: true, stopClick: true, title: '完成状态' })}
                                        <span class="tm-whiteboard-stream-task-title ${task?.done ? 'tm-task-done' : ''}" onpointerdown="tmWhiteboardStreamTaskTitlePointerDown(event)" onmousedown="tmWhiteboardStreamTaskTitleMouseDown(event)" onclick="tmWhiteboardStreamTaskTitleClick('${escSq(tid)}', event)"${__tmBuildTooltipAttrs(String(content || '').trim() || '(无内容)', { side: 'bottom', ariaLabel: false })}>${API.renderTaskContentHtml(task?.markdown, content)}${__tmRenderRecurringTaskInlineIcon(task)}${__tmRenderRecurringInstanceBadge(task, { className: 'tm-recurring-instance-badge--inline' })}</span>
                                        ${toggleHtml}
                                    </div>
                                </div>
                                ${childrenHtml}
                            </div>
                        `;
                    };
                    const headingSectionsHtml = useDocH2Subgroup
                        ? headingBuckets.map((bucket) => {
                            const key = String(bucket?.key || '').trim();
                            const rootIdsInBucket = (rootIdsByHeading.get(key) || []).slice().sort((a, b) => (orderById.get(a) ?? 999999) - (orderById.get(b) ?? 999999));
                            if (!rootIdsInBucket.length) return '';
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
                                ${headingSectionsHtml || `<div class="tm-whiteboard-stream-empty">当前文档没有任务</div>`}
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

            const docsHtml = selectedDocIds.map((docIdRaw) => {
                const docId = String(docIdRaw || '').trim();
                if (!docId) return '';
                const docTasks0 = (byDoc.get(docId) || []).slice().sort((a, b) => getOrder(a?.id) - getOrder(b?.id));
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
                    if (!posDocId || posDocId !== docId) return;
                    if (seenDocTask.has(tid)) return;
                    const taskObj = state.flatTasks?.[tid] || (snapMap?.[tid] ? {
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
                const links = __tmGetAllTaskLinks({ docId, includeAuto: true });
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
                    ensureNodePos(t, docId, idx);
                });
                const docNotes = notes.filter(n => String(n?.docId || '').trim() === docId);
                const framePlan = (() => {
                    if (!allView) return { offsetX: 0, offsetY: 0, w: 0, h: 0, empty: false };
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

                const renderWhiteboardNote = (n, idx) => {
                    const nid = String(n?.id || '').trim();
                    const nx0 = Number.isFinite(Number(n?.x)) ? Number(n.x) : 24;
                    const ny0 = Number.isFinite(Number(n?.y)) ? Number(n.y) : (24 + idx * 42);
                    const nx = Math.round(nx0 + (allView ? framePlan.offsetX : 0));
                    const ny = Math.round(ny0 + (allView ? framePlan.offsetY : 0));
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
                    const hideCompletedDescendants = __tmResolveHideCompletedDescendantsFlag(task, inheritedHideCompleted);
                    const children = (childMap.get(tid) || []).filter((cid) => {
                        const c = String(cid || '').trim();
                        const childTask = taskById.get(c);
                        return !!c && !!childTask && !isDetachedTask(c) && __tmShouldKeepChildTaskVisible(task, childTask, inheritedHideCompleted);
                    });
                    const isGhost = !!task.__tmGhost;
                    const selected = String(state.whiteboardSelectedTaskId || '').trim() === tid;
                    const dateTxt = __tmFormatTaskTime(__tmGetTaskCardDateValue(task));
                    const opBtn = !isGhost
                        ? `<button class="tm-kanban-more" onclick="tmOpenTaskDetail('${escSq(tid)}', event)" title="任务详情">${__tmRenderLucideIcon('dots-three')}</button>`
                        : '';
                    const collapsed = children.length ? __tmKanbanGetCollapsedSet().has(tid) : false;
                    const linkStats = __tmGetTaskLinkStats(tid, { docId, includeAuto: false });
                    const hasTaskLinks = (Number(linkStats?.incoming || 0) + Number(linkStats?.outgoing || 0)) > 0;
                    const toggleHtml = children.length
                        ? `<button class="tm-kanban-toggle" onclick="tmWhiteboardToggleTaskCollapse('${escSq(tid)}', event)" title="${collapsed ? '展开子任务' : '折叠子任务'}"><svg viewBox="0 0 16 16" width="16" height="16"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`
                        : '';
                    const collapseProxyDot = (collapsed && children.length)
                        ? `<span class="tm-task-link-dot tm-whiteboard-collapse-proxy-dot" title="折叠子任务连线汇聚点"></span>`
                        : '';
                    const childrenHtml = children.length
                        ? (collapsed ? '' : `<div class="tm-whiteboard-subtasks">${children.map(cid => renderTaskNode(cid, depth + 1, hideCompletedDescendants)).join('')}</div>`)
                        : '';
                    const parentCls = children.length ? ' tm-whiteboard-node--parent' : '';
                    const linkCls = hasTaskLinks ? ' tm-whiteboard-node--has-links' : '';
                    const cls = depth === 0
                        ? `tm-whiteboard-card tm-whiteboard-node tm-whiteboard-node--root${parentCls}${linkCls}${selected ? ' tm-whiteboard-card--selected' : ''}${isGhost ? ' tm-whiteboard-card--ghost' : ''}`
                        : `tm-whiteboard-subcard tm-whiteboard-node tm-whiteboard-node--sub${parentCls}${linkCls}${selected ? ' tm-whiteboard-card--selected' : ''}`;
                    const rootPos = depth === 0 ? (posMap[tid] || { x: 24, y: 56 }) : null;
                    const rootStyle = depth === 0
                        ? (() => {
                            const px = Math.round((Number(rootPos.x) || 24) + (allView ? framePlan.offsetX : 0));
                            const py = Math.round((Number(rootPos.y) || 56) + (allView ? framePlan.offsetY : 0));
                            return ` data-x="${px}" data-y="${py}" style="left:${px}px;top:${py}px;"`;
                        })()
                        : '';
                    const nodeMouse = ` onmousedown="tmWhiteboardCardMouseDown(event, '${escSq(tid)}', '${escSq(docId)}')"`;
                    const selectClick = ` onclick="tmWhiteboardSelectTask('${escSq(tid)}', event)"`;
                    const deleteTitle = isGhost ? '移除快照卡片并彻底移除记录（不进入侧边栏）' : '移除卡片并回到侧栏';
                    const parentId = __tmResolveWhiteboardTaskParentId(tid);
                    const parentTask = parentId ? (state.flatTasks?.[parentId] || (snapMap?.[parentId] ? { content: String(snapMap[parentId]?.content || '') } : null)) : null;
                    const parentText = String(parentTask?.content || '').trim();
                    const detachedOrDetachedLike = !!parentId && (
                        isDetachedTask(tid)
                        || (!!placedMap[tid] && !!placedMap[parentId] && rootSet.has(tid))
                    );
                    const canMoveBack = selected && !!parentId && detachedOrDetachedLike;
                    const toolsHtml = selected ? `
                        <div class="tm-whiteboard-card-tools">
                            <button class="tm-btn tm-btn-danger" style="padding:2px 8px;font-size:12px;" onclick="tmWhiteboardDeleteCard('${escSq(tid)}', '${escSq(docId)}', event)" title="${esc(deleteTitle)}">移除</button>
                            ${canMoveBack ? `<button class="tm-btn tm-btn-info" style="padding:2px 8px;font-size:12px;" onclick="tmWhiteboardMoveBackToParent('${escSq(tid)}', '${escSq(docId)}', event)" title="移回父任务">移回父任务</button>` : ''}
                        </div>
                    ` : '';
                    const ghostTip = isGhost ? `<span class="tm-kanban-chip tm-kanban-chip--muted" style="cursor:default;">快照</span>` : '';
                    const opt = __tmResolveTaskStatusDisplayOption(task, statusOptions, {
                        fallbackColor: task?.done ? '#9e9e9e' : '#757575',
                        fallbackName: task?.done ? '完成' : (todoOpt?.name || '待办'),
                    });
                    const editableMeta = !isGhost;
                    const statusChipStyle = __tmBuildStatusChipStyle(opt.color || '#757575');
                    const statusChip = task?.done
                        ? `<span class="tm-status-tag" style="${statusChipStyle};cursor:default;">${esc(opt.name || '完成')}</span>`
                        : `<span class="tm-status-tag" style="${statusChipStyle};cursor:${editableMeta ? 'pointer' : 'default'};" ${editableMeta ? `onclick="tmWhiteboardEditStatus('${escSq(tid)}', this, event)"` : ''}>${esc(opt.name || '')}</span>`;
                    const priorityChipStyle = __tmBuildPriorityChipStyle(task?.priority);
                    const priorityChip = `<span class="tm-kanban-priority-chip" style="${priorityChipStyle};cursor:${editableMeta ? 'pointer' : 'default'};" ${editableMeta ? `onclick="tmWhiteboardEditPriority('${escSq(tid)}', this, event)"` : ''}>${__tmRenderPriorityJira(task?.priority, false)}</span>`;
                    const metaParts = [];
                    if (whiteboardCardFields.has('priority')) metaParts.push(priorityChip);
                    if (whiteboardCardFields.has('status')) metaParts.push(statusChip);
                    if (whiteboardCardFields.has('date') && __tmShouldRenderTaskCardDate(task)) {
                        metaParts.push(`<span class="tm-kanban-chip tm-kanban-chip--muted" data-tm-task-time-field="date" style="cursor:${editableMeta ? 'pointer' : 'default'};" ${editableMeta ? `onclick="tmWhiteboardEditDate('${escSq(tid)}', event)"` : ''} title="${editableMeta ? '点击选择日期' : ''}">${esc(dateTxt || '日期')}</span>`);
                    }
                    if (isGhost) metaParts.push(ghostTip);
                    const remarkHtml = whiteboardCardFields.has('remark') ? __tmRenderTaskCardRemark(task) : '';
                    return `
                        <div class="${cls}" data-task-id="${esc(tid)}" data-doc-id="${esc(docId)}"${rootStyle}${nodeMouse}${selectClick} oncontextmenu="tmShowTaskContextMenu(event, '${escSq(tid)}')">
                            ${toolsHtml}
                            <span class="tm-task-link-dot tm-task-link-dot--in${state.whiteboardLinkFromTaskId === tid ? ' tm-task-link-dot--active' : ''}" draggable="true" onmousedown="tmTaskLinkDotPressStart(event, '${escSq(tid)}', '${escSq(docId)}')" ondragstart="tmTaskLinkDotDragStart(event, '${escSq(tid)}', '${escSq(docId)}')" ondragend="tmTaskLinkDotDragEnd(event)" ondragover="tmTaskLinkDotDragOver(event, '${escSq(tid)}', '${escSq(docId)}')" ondrop="tmTaskLinkDotDrop(event, '${escSq(tid)}', '${escSq(docId)}')" title="连接输入点"></span>
                            <span class="tm-task-link-dot tm-task-link-dot--out${state.whiteboardLinkFromTaskId === tid ? ' tm-task-link-dot--active' : ''}" draggable="true" onmousedown="tmTaskLinkDotPressStart(event, '${escSq(tid)}', '${escSq(docId)}')" ondragstart="tmTaskLinkDotDragStart(event, '${escSq(tid)}', '${escSq(docId)}')" ondragend="tmTaskLinkDotDragEnd(event)" ondragover="tmTaskLinkDotDragOver(event, '${escSq(tid)}', '${escSq(docId)}')" ondrop="tmTaskLinkDotDrop(event, '${escSq(tid)}', '${escSq(docId)}')" title="连接输出点"></span>
                            ${collapseProxyDot}
                            <div class="tm-whiteboard-card-head">
                                ${toggleHtml}
                                ${__tmRenderTaskCheckboxWrap(tid, task, { checked: task?.done, disabled: isGhost, extraClass: GlobalLock.isLocked() ? 'tm-operating' : '', title: isGhost ? '快照任务，当前不可直接勾选' : '', stopMouseDown: true, stopClick: true, collapsed: !!(collapsed && children.length) })}
                                <div class="tm-whiteboard-card-title ${task?.done ? 'tm-task-done' : ''}">
                                    <span class="tm-task-content-clickable" onclick="tmJumpToTask('${escSq(tid)}', event)"${__tmBuildTooltipAttrs(String(task?.content || '').trim() || '(无内容)', { side: 'bottom', ariaLabel: false })}>${API.renderTaskContentHtml(task?.markdown, String(task?.content || '').trim() || '(无内容)')}${__tmRenderRecurringTaskInlineIcon(task)}${__tmRenderRecurringInstanceBadge(task, { className: 'tm-recurring-instance-badge--inline' })}</span>
                                </div>
                                ${opBtn}
                            </div>
                            ${(detachedOrDetachedLike && parentText) ? `<div style="font-size:12px;color:var(--tm-secondary-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:4px;" title="${esc(parentText)}"><span>父任务：</span><span style="font-weight:800;color:var(--tm-text-color);">${esc(parentText)}</span></div>` : ''}
                            ${remarkHtml}
                            ${metaParts.length ? `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">${metaParts.join('')}</div>` : ''}
                            ${childrenHtml}
                        </div>
                    `;
                };

                const cardsHtml = orderedRoots.map((rid) => renderTaskNode(rid, 0)).join('');
                let maxX = 0;
                let maxY = 0;
                orderedRoots.forEach((rid) => {
                    const p = posMap[rid];
                    if (!p || String(p?.docId || '').trim() !== docId) return;
                    const x = Number(p.x);
                    const y = Number(p.y);
                    if (Number.isFinite(x)) maxX = Math.max(maxX, x);
                    if (Number.isFinite(y)) maxY = Math.max(maxY, y);
                });
                const frameSize = __tmGetWhiteboardDocFrameSize(docId);
                const hasManualSize = false;
                const autoBoardH = allView ? framePlan.h : (maxY + 230);
                const autoBoardW = allView ? framePlan.w : (maxX + 340);
                let boardH = hasManualSize
                    ? Math.max(220, Number(frameSize?.h) || 0)
                    : (allView ? Math.max(220, autoBoardH) : Math.max(300, autoBoardH));
                let boardW = hasManualSize
                    ? Math.max(520, Number(frameSize?.w) || 0)
                    : (allView ? Math.max(520, autoBoardW) : Math.max(1000, autoBoardW));
                const noCardsAndNotes = !!framePlan.empty;
                if (allView && noCardsAndNotes) {
                    boardW = 500;
                    boardH = 100;
                }
                // 单文档白板不应受文档框尺寸限制：统一扩展为大画布，避免形成“方框限制区域”
                if (!allView) {
                    boardW = Math.max(boardW, 12000);
                    boardH = Math.max(boardH, 8000);
                }
                const cardEmptyHtml = cardsHtml || `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--tm-secondary-text);font-size:14px;">无任务</div>`;
                if (!allView) {
                    return `
                        <section class="tm-whiteboard-doc" data-doc-id="${esc(docId)}" style="border:none;background:transparent;">
                            <div class="tm-whiteboard-doc-body" data-doc-id="${esc(docId)}" style="height:${Math.round(boardH)}px;width:${Math.round(boardW)}px;" ondragover="tmWhiteboardBoardDragOver(event)" ondrop="tmWhiteboardBoardDrop(event, '${escSq(docId)}')">
                                <svg class="tm-whiteboard-edges" aria-hidden="true"></svg>
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
                            ${docNotes.map((n, idx) => renderWhiteboardNote(n, idx)).join('')}
                            ${cardEmptyHtml}
                        </div>
                    </section>
                `;
            }).join('');

            const poolSourceDocIds = allView
                ? selectedDocIds.filter((id) => /inbox/i.test(String(docNameById.get(String(id || '').trim()) || ''))
                    || /收件箱|收集箱|收件/.test(String(docNameById.get(String(id || '').trim()) || ''))
                )
                : selectedDocIds;
            const poolSelectedSet = new Set((Array.isArray(state.whiteboardPoolSelectedTaskIds) ? state.whiteboardPoolSelectedTaskIds : []).map((x) => String(x || '').trim()).filter(Boolean));
            const poolGroupMode = __tmGetCurrentGroupModeValue();
            const poolDocRankMap = new Map(poolSourceDocIds.map((id, idx) => [String(id || '').trim(), idx]));
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
                const info = __tmGetTaskTimePriorityInfo(task);
                const diffDays = Number(info?.diffDays);
                if (!Number.isFinite(diffDays)) return { key: 'pending', label: '待定', sortValue: Infinity };
                if (diffDays < 0) return { key: 'overdue', label: '已过期', sortValue: diffDays };
                if (diffDays === 0) return { key: 'today', label: '今天', sortValue: 0 };
                if (diffDays === 1) return { key: 'tomorrow', label: '明天', sortValue: 1 };
                if (diffDays === 2) return { key: 'after_tomorrow', label: '后天', sortValue: 2 };
                return { key: `days_${diffDays}`, label: `余${diffDays}天`, sortValue: diffDays };
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
                        ? `<button class="tm-whiteboard-pool-toggle" onclick="tmWhiteboardToggleTaskCollapse('${escSq(tid)}', event)" onmousedown="event.stopPropagation()" title="${collapsed ? '展开子任务' : '折叠子任务'}"><svg viewBox="0 0 16 16" width="16" height="16"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`
                        : '<span style="display:inline-block;width:16px;height:14px;"></span>';
                    const indent = Math.max(0, Math.min(10, Number(depth) || 0)) * 16;
                    const doneCls = task?.done ? ' tm-whiteboard-pool-item--done' : '';
                    const parentCls = childIds.length ? ' tm-whiteboard-pool-item--parent' : '';
                    const topCls = depth === 0 ? ' tm-whiteboard-pool-item--top' : '';
                    const lockedCls = task?.__tmPoolLocked ? ' tm-whiteboard-pool-item--locked' : '';
                    const selectedCls = poolSelectedSet.has(tid) ? ' tm-whiteboard-pool-item--selected' : '';
                    const draggableAttr = task?.__tmPoolLocked ? 'false' : 'true';
                    const dragStartAttr = task?.__tmPoolLocked ? '' : ` ondragstart="tmWhiteboardPoolDragStart(event, '${escSq(tid)}', '${escSq(docId)}')"`;
                    const dragEndAttr = task?.__tmPoolLocked ? '' : ' ondragend="tmWhiteboardPoolDragEnd(event)"';
                    const mouseDownAttr = ` onmousedown="tmWhiteboardPoolItemMouseDown(event, '${escSq(tid)}', '${escSq(docId)}', ${task?.__tmPoolLocked ? 'true' : 'false'})"`;
                    const itemTitle = task?.__tmPoolLocked ? '父任务已在白板中，不可重复拖入' : '拖动到白板';
                    const docBadgeHtml = (options.showDocBadge && depth === 0)
                        ? `<span class="tm-whiteboard-pool-item-prefix" title="${esc(docName)}">${__tmRenderDocIcon(docId, { fallbackText: '📄', size: 12 })}</span>`
                        : '';
                    const kidsHtml = (!collapsed && childIds.length)
                        ? childIds.map((cid) => renderPoolTaskNode(cid, depth + 1, options)).join('')
                        : '';
                    return `
                        <div class="tm-whiteboard-pool-node" style="padding-left:${indent}px;">
                            <div class="tm-whiteboard-pool-item${doneCls}${parentCls}${topCls}${lockedCls}${selectedCls}" data-task-id="${esc(tid)}" draggable="${draggableAttr}"${mouseDownAttr}${dragStartAttr}${dragEndAttr} title="${itemTitle}">
                                ${toggleHtml}
                                ${__tmRenderTaskCheckboxWrap(tid, task, { checked: task?.done, stopMouseDown: true, title: '完成状态', collapsed: !!collapsed })}
                                ${docBadgeHtml}
                                <span class="tm-whiteboard-pool-item-title"><span class="tm-task-content-clickable" onclick="tmJumpToTask('${escSq(tid)}', event)"${__tmBuildTooltipAttrs(String(task?.content || '').trim() || '(无内容)', { side: 'bottom', ariaLabel: false })}>${API.renderTaskContentHtml(task?.markdown, String(task?.content || '').trim() || '(无内容)')}${__tmRenderRecurringTaskInlineIcon(task)}${__tmRenderRecurringInstanceBadge(task, { className: 'tm-recurring-instance-badge--inline' })}</span></span>
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
            const renderWhiteboardPoolDocSection = (docData) => {
                if (!docData) return '';
                const docId = String(docData.docId || '').trim();
                if (!docId) return '';
                const list = Array.isArray(docData.list) ? docData.list : [];
                if (!list.length) return '';
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
                    <section class="tm-whiteboard-pool-doc">
                        <header class="tm-whiteboard-pool-doc-head"><span style="display:inline-flex;align-items:center;gap:6px;min-width:0;">${__tmRenderDocIcon(docId, { fallbackText: '📄', size: 14 })}<span>${esc(docData.docName || '未知文档')}</span></span> · ${list.length}</header>
                        <div class="tm-whiteboard-pool-list">
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
                                const groupRootIds = Array.from(groupTaskMap.keys())
                                    .filter((id) => {
                                        const task = groupTaskMap.get(id);
                                        if (!task) return false;
                                        const pid = String(task?.parentTaskId || '').trim();
                                        return !pid || !groupTaskMap.has(pid);
                                    })
                                    .sort((a, b) => getOrder(a) - getOrder(b));
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
                                        ? `<button class="tm-whiteboard-pool-toggle" onclick="tmWhiteboardToggleTaskCollapse('${escSq(tid)}', event)" onmousedown="event.stopPropagation()" title="${collapsed ? '展开子任务' : '折叠子任务'}"><svg viewBox="0 0 16 16" width="16" height="16"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`
                                        : '<span style="display:inline-block;width:16px;height:14px;"></span>';
                                    const indent = Math.max(0, Math.min(10, Number(depth) || 0)) * 16;
                                    const doneCls = task?.done ? ' tm-whiteboard-pool-item--done' : '';
                                    const parentCls = childIds.length ? ' tm-whiteboard-pool-item--parent' : '';
                                    const topCls = depth === 0 ? ' tm-whiteboard-pool-item--top' : '';
                                    const lockedCls = task?.__tmPoolLocked ? ' tm-whiteboard-pool-item--locked' : '';
                                    const selectedCls = poolSelectedSet.has(tid) ? ' tm-whiteboard-pool-item--selected' : '';
                                    const draggableAttr = task?.__tmPoolLocked ? 'false' : 'true';
                                    const dragStartAttr = task?.__tmPoolLocked ? '' : ` ondragstart="tmWhiteboardPoolDragStart(event, '${escSq(tid)}', '${escSq(docId)}')"`;
                                    const dragEndAttr = task?.__tmPoolLocked ? '' : ' ondragend="tmWhiteboardPoolDragEnd(event)"';
                                    const mouseDownAttr = ` onmousedown="tmWhiteboardPoolItemMouseDown(event, '${escSq(tid)}', '${escSq(docId)}', ${task?.__tmPoolLocked ? 'true' : 'false'})"`;
                                    const itemTitle = task?.__tmPoolLocked ? '父任务已在白板中，不可重复拖入' : '拖动到白板';
                                    const kidsHtml = (!collapsed && childIds.length)
                                        ? childIds.map((cid) => renderGroupTaskNode(cid, depth + 1)).join('')
                                        : '';
                                    return `
                                        <div class="tm-whiteboard-pool-node" style="padding-left:${indent}px;">
                                            <div class="tm-whiteboard-pool-item${doneCls}${parentCls}${topCls}${lockedCls}${selectedCls}" data-task-id="${esc(tid)}" draggable="${draggableAttr}"${mouseDownAttr}${dragStartAttr}${dragEndAttr} title="${itemTitle}">
                                                ${toggleHtml}
                                                ${__tmRenderTaskCheckboxWrap(tid, task, { checked: task?.done, stopMouseDown: true, title: '完成状态', collapsed: !!collapsed })}
                                                <span class="tm-whiteboard-pool-item-title"><span class="tm-task-content-clickable" onclick="tmJumpToTask('${escSq(tid)}', event)"${__tmBuildTooltipAttrs(String(task?.content || '').trim() || '(无内容)', { side: 'bottom', ariaLabel: false })}>${API.renderTaskContentHtml(task?.markdown, String(task?.content || '').trim() || '(无内容)')}${__tmRenderRecurringTaskInlineIcon(task)}${__tmRenderRecurringInstanceBadge(task, { className: 'tm-recurring-instance-badge--inline' })}</span></span>
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
                                        title="${h2DragTaskIds.length ? '拖动该二级标题及其任务到白板' : ''}">${__tmRenderHeadingLevelInlineIcon(SettingsStore.data.taskHeadingLevel || 'h2', { size: 14 })} ${esc(groupLabel)} · ${items.length}</div>
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
            const buildPoolSectionTitleHtml = (section) => {
                const label = String(section?.label || '').trim();
                const labelColor = String(section?.labelColor || '').trim();
                if (section?.kind === 'task') {
                    return __tmRenderIconLabel('puzzle', label || '未命名任务', {
                        style: labelColor ? `color:${labelColor};` : '',
                    });
                }
                if (section?.kind === 'none') {
                    return `<span>${esc(label || '全部任务')}</span>`;
                }
                return `<span${labelColor ? ` style="color:${esc(labelColor)};"` : ''}>${esc(label)}</span>`;
            };
            const renderWhiteboardPoolGroupedSection = (section) => {
                if (!section || !Array.isArray(section.rootEntries) || !section.rootEntries.length) return '';
                const taskCount = section.rootEntries.reduce((sum, entry) => {
                    const count = Number(entry?.docData?.countTreeNodes?.(entry?.rootId)) || 0;
                    return sum + count;
                }, 0);
                return `
                    <section class="tm-whiteboard-pool-doc">
                        <header class="tm-whiteboard-pool-doc-head">${buildPoolSectionTitleHtml(section)} · ${taskCount}</header>
                        <div class="tm-whiteboard-pool-list">
                            ${section.rootEntries.map((entry) => entry.docData.renderPoolTaskNode(entry.rootId, 0, { showDocBadge: showPoolRootDocBadge })).join('')}
                        </div>
                    </section>
                `;
            };
            let poolHtml = '';
            if (poolGroupMode === 'doc') {
                poolHtml = poolDocDataList.map((docData) => renderWhiteboardPoolDocSection(docData)).join('');
            } else if (poolGroupMode === 'time') {
                const groups = new Map();
                poolRootEntries.forEach((entry) => {
                    const info = getPoolTimeGroupInfo(entry.task);
                    if (!groups.has(info.key)) {
                        groups.set(info.key, {
                            kind: 'time',
                            key: info.key,
                            label: info.label,
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
                poolRootEntries.forEach((entry) => {
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
                poolRootEntries.forEach((entry) => {
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
                    .sort((a, b) => String(a?.label || '').localeCompare(String(b?.label || ''), 'zh-CN'))
                    .map((section) => renderWhiteboardPoolGroupedSection(section))
                    .join('');
            } else {
                poolHtml = poolRootEntries.length
                    ? renderWhiteboardPoolGroupedSection({
                        kind: 'none',
                        key: 'all',
                        label: '全部任务',
                        rootEntries: poolRootEntries,
                    })
                    : '';
            }

            let whiteboardLayoutStateDirty = false;
            if (posDirty) {
                SettingsStore.data.whiteboardNodePos = posMap;
                try { SettingsStore.syncToLocal(); } catch (e) {}
                whiteboardLayoutStateDirty = true;
            }
            if (placedDirty) {
                SettingsStore.data.whiteboardPlacedTaskIds = placedMap;
                try { SettingsStore.syncToLocal(); } catch (e) {}
                whiteboardLayoutStateDirty = true;
            }
            if (whiteboardLayoutStateDirty) {
                try { SettingsStore.save().catch(() => null); } catch (e) {}
            }

            const whiteboardTool = String(SettingsStore.data.whiteboardTool || 'pan').trim();
            const viewportPanClass = whiteboardTool === 'pan' ? ' tm-whiteboard-viewport--tool-pan' : '';
            const sidebarCollapsed = !!SettingsStore.data.whiteboardSidebarCollapsed;
            const sidebarWidth = Math.max(220, Math.min(520, Math.round(Number(SettingsStore.data.whiteboardSidebarWidth) || 300)));
            const layoutClass = sidebarCollapsed ? ' tm-whiteboard-layout--sidebar-collapsed' : '';
            const navigatorHidden = !!SettingsStore.data.whiteboardNavigatorHidden;
            const navigatorReadyAttr = (!navigatorHidden && state.whiteboardNavigatorModel) ? ' data-tm-ready="1"' : '';
            const sidebarToggleLabel = sidebarCollapsed ? '展开侧栏' : '折叠侧栏';
            const sidebarToggleGlyph = sidebarCollapsed ? '☰' : '⟨';
            const renderWhiteboardToolbarButton = ({ label, icon, onclick, active = false, pressed = null }) => {
                const cls = `tm-btn tm-btn-info bc-btn bc-btn--sm tm-whiteboard-toolbar-btn${active ? ' tm-whiteboard-toolbar-btn--active' : ''}`;
                const ariaPressed = pressed == null ? '' : ` aria-pressed="${pressed ? 'true' : 'false'}"`;
                return `<button type="button" class="${cls}" onclick="${onclick}"${ariaPressed}${__tmBuildTooltipAttrs(label, { side: 'top' })}>${__tmPhosphorBoldSvg(icon, { size: 16, className: 'tm-whiteboard-toolbar-btn__icon' })}</button>`;
            };
            return `
                <div class="tm-body tm-body--whiteboard${bodyAnimClass}" id="tmWhiteboardBody">
                    <div class="tm-whiteboard-layout${layoutClass}" style="--tm-wb-sidebar-width:${sidebarWidth}px;">
                        <aside class="tm-whiteboard-sidebar">
                            <div class="tm-whiteboard-sidebar-title-row">
                                <div class="tm-whiteboard-sidebar-title">任务池</div>
                                <label class="tm-whiteboard-sidebar-switch" title="显示已完成任务">
                                    <input type="checkbox" ${showDoneTasks ? 'checked' : ''} onchange="tmWhiteboardToggleShowDone(this.checked)">
                                    <span>已完成</span>
                                </label>
                            </div>
                            ${poolHtml || `<div style="color:var(--tm-secondary-text);font-size:12px;">当前没有可拖出的任务</div>`}
                        </aside>
                        <div class="tm-whiteboard-sidebar-resizer" onmousedown="tmStartWhiteboardSidebarResize(event)" title="拖拽调整侧栏宽度"></div>
                        <div class="tm-whiteboard-main">
                            <button class="tm-btn tm-btn-info tm-whiteboard-sidebar-toggle" onclick="tmWhiteboardToggleSidebar(event)" title="${sidebarToggleLabel}">${sidebarToggleGlyph}</button>
                            <div id="tmWhiteboardViewport" class="tm-whiteboard-viewport${viewportPanClass}" onpointerdown="tmWhiteboardViewportMouseDown(event)" onclick="tmWhiteboardBoardClick(event)" ondblclick="tmWhiteboardBoardDblClick(event)" ondragover="tmWhiteboardBoardDragOver(event)" ondrop="tmWhiteboardBoardDrop(event)">
                                <div id="tmWhiteboardWorld" class="tm-whiteboard-world" style="transform:translate(${view.x}px, ${view.y}px) scale(${view.zoom});">
                                    <div class="tm-whiteboard">
                                        ${docsHtml || `<div style="padding:18px;color:var(--tm-secondary-text);">暂无任务可用于白板视图</div>`}
                                    </div>
                                </div>
                                <div id="tmWhiteboardNavigator" class="tm-whiteboard-navigator${navigatorHidden ? ' tm-whiteboard-navigator--hidden' : ''}"${navigatorReadyAttr} aria-label="白板视图浏览窗口">
                                    <button type="button" class="tm-whiteboard-navigator__hide" onclick="tmWhiteboardSetNavigatorHidden(true, event)" title="隐藏浏览窗口">${__tmRenderLucideIcon('corners-in')}</button>
                                    <div class="tm-whiteboard-navigator__surface" onpointerdown="tmWhiteboardNavigatorSurfacePointerDown(event)" ontouchstart="tmWhiteboardNavigatorSurfaceTouchStart(event)">
                                        <div class="tm-whiteboard-navigator__content"></div>
                                        <div class="tm-whiteboard-navigator__viewport" onpointerdown="tmWhiteboardNavigatorViewportPointerDown(event)"></div>
                                    </div>
                                </div>
                                <button id="tmWhiteboardNavigatorReveal" type="button" class="tm-whiteboard-navigator-reveal${navigatorHidden ? ' tm-whiteboard-navigator-reveal--visible' : ''}" onclick="tmWhiteboardSetNavigatorHidden(false, event)" title="显示浏览窗口">${__tmRenderLucideIcon('map')}</button>
                                <div class="tm-whiteboard-bottom-toolbar">
                                    ${renderWhiteboardToolbarButton({ label: '平移模式', icon: 'hand', onclick: "tmWhiteboardSetTool('pan')", active: whiteboardTool === 'pan', pressed: whiteboardTool === 'pan' })}
                                    ${renderWhiteboardToolbarButton({ label: '多选模式', icon: 'selection-plus', onclick: "tmWhiteboardSetTool('select')", active: whiteboardTool === 'select', pressed: whiteboardTool === 'select' })}
                                    ${renderWhiteboardToolbarButton({ label: '文字模式', icon: 'cursor-text', onclick: "tmWhiteboardSetTool('text')", active: whiteboardTool === 'text', pressed: whiteboardTool === 'text' })}
                                    ${renderWhiteboardToolbarButton({ label: '便利贴模式', icon: 'note-pencil', onclick: "tmWhiteboardSetTool('sticky')", active: whiteboardTool === 'sticky', pressed: whiteboardTool === 'sticky' })}
                                    ${renderWhiteboardToolbarButton({ label: '缩小画布', icon: 'minus', onclick: 'tmWhiteboardZoomOut()' })}
                                    ${renderWhiteboardToolbarButton({ label: '放大画布', icon: 'plus', onclick: 'tmWhiteboardZoomIn()' })}
                                    ${renderWhiteboardToolbarButton({ label: '重置视图', icon: 'arrows-clockwise', onclick: 'tmWhiteboardResetView()' })}
                                    ${renderWhiteboardToolbarButton({ label: '清空手动连线', icon: 'link-simple-break', onclick: 'tmWhiteboardClearLinks()' })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        };


        return __tmRenderWhiteboardBodyHtml();
    }
