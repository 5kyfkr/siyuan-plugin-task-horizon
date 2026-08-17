    function renderTaskList(renderContext = null, renderOptions = {}) {
        const context = (renderContext && typeof renderContext === 'object')
            ? renderContext
            : __tmBuildListRenderContext();
        const options = (renderOptions && typeof renderOptions === 'object') ? renderOptions : {};
        const titleSurface = ['table', 'calendar'].includes(String(options.titleSurface || '').trim())
            ? String(options.titleSurface || '').trim()
            : 'table';
        const colOrder = (Array.isArray(context.colOrder) && context.colOrder.length)
            ? context.colOrder
            : __tmGetDefaultColumnOrder();
        const colSet = new Set(colOrder);
        const colCount = Number(context.colCount) || colOrder.length || 7;
        const alwaysVisibleHeadingTasks = __tmGetAlwaysVisibleTaskDocHeadingTasks();
        if (state.filteredTasks.length === 0 && alwaysVisibleHeadingTasks.length === 0) {
            return `<tr><td colspan="${colCount}" style="text-align: center; padding: 40px; color: var(--tm-secondary-text);">暂无任务</td></tr>`;
        }

        const isGloballyLocked = GlobalLock.isLocked();
        const isListView = globalThis.__tmRuntimeState?.isViewMode?.('list') ?? (String(state.viewMode || '').trim() === 'list');
        const virtualThreshold = state.__tmSnapshotFirstRenderLimitMode ? 0 : 50;
        const startTaskRow = Math.max(0, Math.round(Number(options.startTaskRow) || 0));
        const virtualEnabled = isListView && (startTaskRow > 0 || state.filteredTasks.length > virtualThreshold);
        const listStep = Math.max(20, Math.min(1200, Number(state.listRenderStep) || 20));
        const taskRowLimit = virtualEnabled
            ? Math.max(listStep, Math.min(state.filteredTasks.length, Number(state.listRenderLimit) || listStep))
            : Number.POSITIVE_INFINITY;
        let visitedTaskRows = 0;
        const hasTaskRowBudget = () => visitedTaskRows < taskRowLimit;
        const isDark = __tmIsDarkMode();
        const enableGroupBg = !!SettingsStore.data.enableGroupTaskBgByGroupColor;
        let currentGroupBg = '';
        const progressBarColor = __tmGetEffectiveProgressBarColor(isDark);
        const timeBaseColor = isDark
            ? __tmNormalizeHexColor(SettingsStore.data.timeGroupBaseColorDark, '#6ba5ff')
            : __tmNormalizeHexColor(SettingsStore.data.timeGroupBaseColorLight, '#1a73e8');
        const timeOverdueColor = isDark
            ? __tmNormalizeHexColor(SettingsStore.data.timeGroupOverdueColorDark, '#ff6b6b')
            : __tmNormalizeHexColor(SettingsStore.data.timeGroupOverdueColorLight, '#d93025');
        const tableLayout = context.tableLayout || __tmGetTableWidthLayout(colOrder, SettingsStore.data.columnWidths || {}, Number(state.tableAvailableWidth) || 0);
        const tableCellStyleCache = new Map();
        const getTableCellStyle = (col, extra = '') => {
            const cacheKey = `${String(col || '').trim()}\u0001${String(extra || '')}`;
            if (tableCellStyleCache.has(cacheKey)) return tableCellStyleCache.get(cacheKey) || '';
            const style = tableLayout.cellStyle(col, extra);
            tableCellStyleCache.set(cacheKey, style);
            return style;
        };
        const statusOptions = Array.isArray(context.statusOptions) ? context.statusOptions : __tmGetStatusOptions(SettingsStore.data.customStatusOptions || []);
        const customFieldColumns = Array.isArray(context.customFieldColumns) ? context.customFieldColumns : [];
        const customFieldColumnsByKey = new Map(customFieldColumns.map((item) => [String(item?.colKey || '').trim(), item]).filter(([key]) => !!key));
        const useCustomTouchTaskDrag = __tmShouldUseCustomTouchTaskDrag();
        const useDesktopTaskDragLogic = __tmShouldUseDesktopTaskDragLogic();
        const tomatoIntegrationEnabled = !!SettingsStore.data.enableTomatoIntegration;
        const tomatoSpentAttrMode = String(SettingsStore.data.tomatoSpentAttrMode || 'minutes').trim() || 'minutes';
        const useTomatoSpentHours = tomatoIntegrationEnabled && tomatoSpentAttrMode === 'hours';
        const tomatoFocusTaskId = tomatoIntegrationEnabled ? String(state.timerFocusTaskId || '').trim() : '';
        const tomatoFocusModeEnabled = __tmIsTomatoFocusModeEnabled();
        const checkboxExtraClass = isGloballyLocked ? 'tm-operating' : '';
        const recurringBadgeInlineOptions = { className: 'tm-recurring-instance-badge--inline' };
        const completedTodayKey = __tmNormalizeDateOnly(new Date());
        const hasContentCol = colSet.has('content');
        const hasStartDateCol = colSet.has('startDate');
        const hasCompletionTimeCol = colSet.has('completionTime');
        const hasTaskCompleteAtCol = colSet.has('taskCompleteAt');
        const hasRemainingTimeCol = colSet.has('remainingTime');
        const hasStatusCol = colSet.has('status');
        const treeGuidesCache = new Map();
        const getTreeGuidesHtml = (depth) => {
            const depthLevel = Math.max(0, Number(depth) || 0);
            if (depthLevel <= 0) return '';
            if (treeGuidesCache.has(depthLevel)) return treeGuidesCache.get(depthLevel);
            const html = `<span class="tm-tree-guides" aria-hidden="true">${Array.from({ length: depthLevel }, (_, i) => `<span class="tm-tree-guide-line" style="left:${18 + i * 16}px"></span>`).join('')}</span>`;
            treeGuidesCache.set(depthLevel, html);
            return html;
        };
        const __tmGetTimeGroupLabelColor = (groupInfo) => {
            const key = String(groupInfo?.key || '');
            const sortValue = Number(groupInfo?.sortValue);
            if (key === 'pending' || !Number.isFinite(sortValue)) return 'var(--tm-secondary-text)';
            if (sortValue < 0) return timeOverdueColor || 'var(--tm-danger-color)';
            const minA = isDark ? 0.52 : 0.42;
            const step = isDark ? 0.085 : 0.11;
            const alpha = __tmClamp(1 - sortValue * step, minA, 1);
            return __tmWithAlpha(timeBaseColor || 'var(--tm-primary-color)', alpha);
        };

        // 构建全局 Filtered ID 集合和顺序映射（用于保持全局排序）
        const derived = __tmGetFilteredTaskDerivedState();
        const filteredIdSet = derived.filteredIdSet;
        const orderMap = derived.baseOrderMap;
        const docsInOrder = derived.docsInOrder;
        const docEntryById = derived.docEntryById;
        const filteredTasksByDoc = derived.filteredTasksByDoc;

        // 获取任务在 filtered 中的排序索引
        const getTaskOrder = (taskId) => orderMap.get(taskId) ?? Infinity;
        const timePriorityMemo = new Map();
        const getTimePriorityInfo = (task) => __tmGetTaskTimePriorityInfo(task, { memo: timePriorityMemo });
        const compareByTimePriority = (a, b) => {
            const ai = getTimePriorityInfo(a);
            const bi = getTimePriorityInfo(b);
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
            return getTaskOrder(String(a?.id || '')) - getTaskOrder(String(b?.id || ''));
        };
        const renderSortContext = __tmBuildRuleSortContext();
        const activeSortRuleForRender = renderSortContext.rule;
        const hasExplicitSortForRender = renderSortContext.hasExplicitSort;
        const ruleSortRuntimeForRender = renderSortContext.runtime;
        const sortRenderGroupItems = (items, fallbackCompare = null) => {
            const list = Array.isArray(items) ? items : [];
            if (list.length <= 1) return list;
            if (hasExplicitSortForRender) {
                const sorted = RuleManager.applyRuleSort(list, activeSortRuleForRender, ruleSortRuntimeForRender);
                list.splice(0, list.length, ...sorted);
                return list;
            }
            if (pinWithinGroups) return __tmSortPinnedTasksFirst(list, fallbackCompare);
            if (typeof fallbackCompare === 'function') list.sort(fallbackCompare);
            return list;
        };
        const buildTimeGroupLabelHtml = (label, diffDays) => {
            const safeLabel = esc(String(label || '').trim());
            const days = Number(diffDays);
            if (!Number.isFinite(days) || days < 0 || days > 15) return safeLabel;
            const target = new Date();
            target.setHours(12, 0, 0, 0);
            target.setDate(target.getDate() + days);
            const weekday = __tmGetTaskRepeatWeekdayLabel(target);
            return `<span class="tm-time-group-label-wrap"><span class="tm-time-group-label-text">${safeLabel}</span><span class="tm-time-group-weekday-chip">${esc(weekday)}</span></span>`;
        };
        const resolvePinnedTaskGroupBg = (task) => {
            if (!enableGroupBg || !task) return '';
            if (state.groupByDocName || state.groupByTaskName || (!state.groupByDocName && !state.groupByTime && !state.quadrantEnabled)) {
                const taskDocColor = __tmGetDocColorHex(task.root_id, isDark) || '';
                return taskDocColor ? (__tmGroupBgFromLabelColor(taskDocColor, isDark) || '') : '';
            }
            if (state.groupByTime) {
                const info = getTimePriorityInfo(task);
                const diffDays = Number(info?.diffDays);
                const groupInfo = !Number.isFinite(diffDays)
                    ? { key: 'pending', sortValue: Number.POSITIVE_INFINITY }
                    : (diffDays < 0
                        ? { key: 'overdue', sortValue: diffDays }
                        : (diffDays >= 16
                            ? { key: 'farther', sortValue: 16 }
                            : { key: `days_${diffDays}`, sortValue: diffDays }));
                return __tmGroupBgFromLabelColor(__tmGetTimeGroupLabelColor(groupInfo), isDark) || '';
            }
            if (state.quadrantEnabled) {
                const quadrantRules = (SettingsStore.data.quadrantConfig && SettingsStore.data.quadrantConfig.rules) || [];
                const priority = String(task.priority || '').toLowerCase();
                const importance = (priority === 'a' || priority === '高' || priority === 'high')
                    ? 'high'
                    : ((priority === 'b' || priority === '中' || priority === 'medium')
                        ? 'medium'
                        : ((priority === 'c' || priority === '低' || priority === 'low') ? 'low' : 'none'));
                const diffDays = Number(getTimePriorityInfo(task)?.diffDays);
                const timeRange = !Number.isFinite(diffDays)
                    ? 'nodate'
                    : (diffDays < 0 ? 'overdue' : (diffDays <= 7 ? 'within7days' : (diffDays <= 15 ? 'within15days' : (diffDays <= 30 ? 'within30days' : 'beyond30days'))));
                let ruleColor = '';
                for (const rule of quadrantRules) {
                    const importanceMatch = Array.isArray(rule?.importance) && rule.importance.includes(importance);
                    let timeRangeMatch = Array.isArray(rule?.timeRanges) && rule.timeRanges.includes(timeRange);
                    if (!timeRangeMatch && Array.isArray(rule?.timeRanges)) {
                        for (const range of rule.timeRanges) {
                            if (!String(range || '').startsWith('beyond') || range === 'beyond30days') continue;
                            const days = parseInt(String(range).replace('beyond', '').replace('days', ''), 10);
                            if (!Number.isNaN(days) && diffDays > days) { timeRangeMatch = true; break; }
                        }
                    }
                    if (importanceMatch && timeRangeMatch) {
                        const colorMap = { red: 'var(--tm-quadrant-red)', yellow: 'var(--tm-quadrant-yellow)', blue: 'var(--tm-quadrant-blue)', green: 'var(--tm-quadrant-green)' };
                        ruleColor = colorMap[String(rule?.color || '')] || 'var(--tm-text-color)';
                        break;
                    }
                }
                return ruleColor ? (__tmGroupBgFromLabelColor(ruleColor, isDark) || '') : '';
            }
            return '';
        };
        const isUngroupForRender = !state.groupByDocName && !state.groupByTaskName && !state.groupByTime && !state.quadrantEnabled;

        // 识别全局根任务：父任务不在 filtered 集合中，或本身就是顶层
        const rootTasks = derived.rootTasks;

        // 分离置顶和非置顶的根任务
        const rootSplit = __tmSplitTasksByDoneState(rootTasks);
        const activeRoots = rootSplit.active;
        const completedRoots = rootSplit.done;
        const isCalendarSidebarChecklistRender = state.__tmCalendarSidebarChecklistRender === true
            || (typeof __tmHasCalendarSidebarChecklist === 'function' && __tmHasCalendarSidebarChecklist(state.modal));
        const isChecklistLikeRender = state.viewMode === 'list' || state.viewMode === 'checklist' || isCalendarSidebarChecklistRender;
        const pinWithinGroups = !!SettingsStore.data.pinTasksWithinGroups
            && !isUngroupForRender
            && isChecklistLikeRender;
        const pinnedRoots = pinWithinGroups ? [] : activeRoots.filter(t => t.pinned);
        const normalRoots = pinWithinGroups ? activeRoots.slice() : activeRoots.filter(t => !t.pinned);
        const docRootTasksByDoc = derived.docRootTasksByDoc;
        const directChildStatsMemo = new Map();
        const getDirectChildStats = (task) => {
            const id = String(task?.id || '').trim();
            if (id && directChildStatsMemo.has(id)) return directChildStatsMemo.get(id);
            const allChildren = Array.isArray(task?.children) ? task.children : [];
            let completed = 0;
            for (let i = 0; i < allChildren.length; i += 1) {
                if (__tmIsTaskCompletedForProjection(allChildren[i])) completed += 1;
            }
            const stats = {
                total: allChildren.length,
                completed,
            };
            stats.remaining = Math.max(0, stats.total - stats.completed);
            if (id) directChildStatsMemo.set(id, stats);
            return stats;
        };

        // 渲染单行（保持原有 emitRow 逻辑）
        const emitRow = (task, depth, hasChildren, collapsed, options = {}) => {
            if (!hasTaskRowBudget()) return null;
            const taskRowIndex = visitedTaskRows;
            visitedTaskRows += 1;
            if (taskRowIndex < startTaskRow) return '';
            const opts = (options && typeof options === 'object') ? options : {};
            const { done, content, priority, completionTime, duration, remark, docName, pinned, startDate } = task;
            const taskId = String(task?.id || '').trim();
            const isMultiSelected = __tmIsTaskMultiSelected(task.id);

            // 计算子任务统计信息
            const directChildStats = getDirectChildStats(task);
            const totalChildren = directChildStats.total;
            const completedChildren = directChildStats.completed;
            const remainingChildren = directChildStats.remaining;
            const childStatsHtml = totalChildren > 0
                ? `<span class="tm-task-child-count" data-tm-subtask-count-owner="${esc(taskId)}" data-tm-subtask-count-format="remaining"${remainingChildren > 0 ? '' : ' hidden'} style="font-size: 11px; color: var(--tm-secondary-text); margin-left: 4px; background: var(--tm-doc-count-bg); padding: 1px 5px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; height: 14px;" title="共${totalChildren}个任务，已完成${completedChildren}个，剩余${remainingChildren}个">${remainingChildren}</span>`
                : '';

            const indent = Math.max(0, Number(depth) || 0) * 12;

            // 计算子任务进度条背景（复用已定义的 allChildren, totalChildren, completedChildren）
            const progressPercent = totalChildren > 0 ? Math.round((completedChildren / totalChildren) * 100) : 0;
            const groupBg = enableGroupBg ? (currentGroupBg || resolvePinnedTaskGroupBg(task)) : '';
            const progressBgStyle = progressPercent > 0
                ? `background-image: linear-gradient(90deg, ${progressBarColor} ${progressPercent}%, transparent ${progressPercent}%);background-repeat:no-repeat;background-size:100% 3px;background-position:left bottom;`
                : '';
            const globalCollectIconHtml = hasContentCol ? __tmRenderGlobalCollectDocTaskInlineIcon(task) : '';
            const renderedContent = hasContentCol ? `${API.renderTaskContentHtml(task.markdown, content)}${globalCollectIconHtml}` : '';
            const contentTooltip = hasContentCol
                ? __tmBuildTooltipAttrs(API.getTaskTitlePresentation(task.markdown, content || '(无内容)').text, { side: 'bottom', ariaLabel: false })
                : '';
            const startDateText = hasStartDateCol ? __tmFormatTaskTime(startDate) : '';
            const completionTimeText = hasCompletionTimeCol ? __tmFormatTaskTime(completionTime) : '';
            const taskCompleteAtText = hasTaskCompleteAtCol ? __tmFormatTaskCompletedAtTime(__tmResolveTaskCompletedAtRaw(task)) : '';
            const tomatoSummaryText = colSet.has('tomatoSummary') ? __tmGetTaskTomatoSummaryText(task) : '';
            const tomatoSummaryHtml = colSet.has('tomatoSummary') ? __tmGetTaskTomatoSummaryHtml(task) : '';
            const tomatoEstimateText = colSet.has('tomatoEstimateCount') ? __tmGetTomatoCountDisplay(__tmGetTaskTomatoEstimateCount(task)) : '';
            const tomatoCountText = colSet.has('tomatoCount') ? __tmGetTomatoCountDisplay(__tmGetTaskTomatoCount(task)) : '';
            const tomatoCountHtml = colSet.has('tomatoCount') ? __tmGetActualTomatoCountDisplayHtml(__tmGetTaskTomatoCount(task)) : '';
            const remainingInfo = hasRemainingTimeCol ? __tmGetTaskRemainingTimeInfo(task) : null;
            const remainingLabel = hasRemainingTimeCol ? String(remainingInfo?.label || '').trim() : '';
            const remainingHtml = hasRemainingTimeCol ? __tmRenderTaskRemainingTimeInfoHtml(remainingInfo) : '';
            const statusOption = hasStatusCol
                ? __tmResolveTaskStatusDisplayOption(task, statusOptions, { fallbackColor: '#757575' })
                : null;
            const statusChipStyle = hasStatusCol
                ? __tmBuildStatusChipStyle(statusOption?.color)
                : '';
            const reminderHtml = hasContentCol && __tmHasReminderMark(task) ? __tmRenderReminderIcon() : '';
            const completedTodayBadgeHtml = __tmRenderCompletedTodayBadge(task, {
                todayKey: completedTodayKey,
                inCompletedRootGroup: opts.inCompletedRootGroup === true,
            });
            const recurringInstanceBadgeHtml = __tmRenderRecurringInstanceBadge(task, recurringBadgeInlineOptions);
            const titleInlineBadgeClass = (completedTodayBadgeHtml || recurringInstanceBadgeHtml)
                ? ' tm-task-content-clickable--inline-badges'
                : '';
            const remarkSearchSnippetHtml = hasContentCol && !colSet.has('remark') && typeof __tmBuildTaskRemarkSearchSnippet === 'function'
                ? __tmBuildTaskRemarkSearchSnippet(task, state.searchKeyword)
                : '';
            const taskTextSearchRemarkClass = remarkSearchSnippetHtml ? ' tm-task-text--with-search-remark' : '';

            const contentIndent = 12 + depth * 16;
            const treeGuides = getTreeGuidesHtml(depth);
            const leadingClass = [
                'tm-task-leading',
                hasChildren && depth === 0 ? 'tm-task-leading--toplevel' : '',
                hasChildren ? 'tm-task-leading--branch' : '',
                hasChildren && collapsed ? 'tm-task-leading--collapsed' : '',
            ].filter(Boolean).join(' ');
            const leadingRing = hasChildren && collapsed
                ? '<span class="tm-task-leading-ring" aria-hidden="true"></span>'
                : '';
            const toggle = hasChildren
                ? `<span class="tm-tree-toggle" onclick="tmToggleCollapse('${task.id}', event)"><svg class="tm-tree-toggle-icon" viewBox="0 0 16 16" width="16" height="16"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`
                : '';

            const rowClass = tomatoFocusTaskId
                ? (tomatoFocusTaskId === String(task.id)
                    ? 'tm-timer-focus'
                    : (tomatoFocusModeEnabled ? 'tm-timer-dim' : ''))
                : '';
            const finalRowClass = [rowClass, isMultiSelected ? 'tm-task-row--multi-selected' : '', remarkSearchSnippetHtml ? 'tm-task-row--search-remark' : ''].filter(Boolean).join(' ');
            const touchDragAttr = useCustomTouchTaskDrag
                ? ` onpointerdown="tmTaskTouchDragStart(event, '${taskId}')"`
                : '';
            const rowDragAttrs = useDesktopTaskDragLogic
                ? `draggable="true" ondragstart="tmDragTaskStart(event, '${taskId}')" ondragend="tmDragTaskEnd(event)"`
                : 'draggable="false"';
            let rowHtml = `<tr data-id="${taskId}" data-depth="${depth}" class="${finalRowClass}" ${groupBg ? `style="background-color:${groupBg};"` : ''} ${rowDragAttrs} ondragenter="tmTaskRowDragOver(event, '${taskId}')" ondragover="tmTaskRowDragOver(event, '${taskId}')" ondragleave="tmTaskRowDragLeave(event, '${taskId}')" ondrop="tmTaskRowDrop(event, '${taskId}')"${touchDragAttr} onclick="tmRowClick(event, '${taskId}')" oncontextmenu="tmShowTaskContextMenu(event, '${taskId}')">`;
            for (let i = 0; i < colOrder.length; i += 1) {
                const col = colOrder[i];
                switch (col) {
                    case 'pinned':
                        rowHtml += `
                    <td style="${getTableCellStyle('pinned', 'text-align: center;')}">
                        <input type="checkbox" ${pinned ? 'checked' : ''}
                               onchange="tmSetPinned('${taskId}', this.checked, event)"
                               title="置顶">
                    </td>`;
                        break;
                    case 'content':
                        rowHtml += `
                    <td class="tm-task-content-cell" data-tm-subtask-progress-owner="${esc(taskId)}" data-tm-subtask-progress-kind="background" style="${getTableCellStyle('content', progressBgStyle)}">
                        <div class="tm-task-cell" style="padding-left:${contentIndent}px">
                            ${treeGuides}
                            <span class="${leadingClass}">
                                ${leadingRing}
                                ${__tmRenderTaskCheckbox(taskId, task, { checked: done, extraClass: checkboxExtraClass })}${toggle}
                            </span>
                            <span class="tm-task-text${taskTextSearchRemarkClass} ${done ? 'tm-task-done' : ''}"
                                  data-level="${depth}">
                                <span class="tm-task-content-clickable${titleInlineBadgeClass}" onclick="tmTaskTitleClick('${taskId}', event, { surface: '${titleSurface}' })"${contentTooltip} style="${__tmBuildTaskTitleOpacityStyle(task)}">${renderedContent}${completedTodayBadgeHtml}${__tmRenderRecurringTaskInlineIcon(task)}${__tmRenderPinnedTaskInlineIcon(task)}${reminderHtml}${recurringInstanceBadgeHtml}</span>
                                ${remarkSearchSnippetHtml}
                            </span>
                            <button class="tm-subtask-create-btn"
                                    type="button"
                                    title="新建子任务"
                                    aria-label="新建子任务"
                                    onpointerdown="event.stopPropagation()"
                                    onclick="tmCreateSubtask('${taskId}', event)">
                                <svg viewBox="0 0 16 16" aria-hidden="true">
                                    <path d="M8 3.25v9.5M3.25 8h9.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                                </svg>
                            </button>
                            ${childStatsHtml}
                        </div>
                    </td>`;
                        break;
                    case 'doc':
                        rowHtml += `
                    <td class="tm-cell-editable tm-task-meta-cell" style="${getTableCellStyle('doc')}" title="点击移动到当前分组其他文档" onclick="tmPickTaskDocInline('${taskId}', this, event)">${esc(docName || '')}</td>`;
                        break;
                    case 'h2':
                        rowHtml += `
                    <td class="tm-cell-editable tm-task-meta-cell" style="${getTableCellStyle('h2')}" title="点击切换标题" onclick="tmPickHeadingInline('${taskId}', this, event)">${esc(__tmNormalizeHeadingText(task.h2) || '无')}</td>`;
                        break;
                    case 'score': {
                        const v = Math.round(__tmEnsureTaskPriorityScore(task));
                        rowHtml += `<td class="tm-task-meta-cell" data-tm-field="score" style="${getTableCellStyle('score', 'text-align: center; font-variant-numeric: inherit;')}">${v}</td>`;
                        break;
                    }
                    case 'priority':
                        rowHtml += `<td class="tm-cell-editable tm-task-meta-cell" data-tm-field="priority" style="${getTableCellStyle('priority', 'text-align: center;')}" onclick="tmPickPriority('${taskId}', this, event)">${__tmRenderPriorityJira(priority, false)}</td>`;
                        break;
                    case 'startDate':
                        rowHtml += `
                    <td class="tm-cell-editable tm-task-meta-cell" data-tm-task-time-field="startDate" style="${getTableCellStyle('startDate')}" onclick="tmBeginCellEdit('${taskId}','startDate',this,event)">${startDateText}</td>`;
                        break;
                    case 'completionTime':
                        rowHtml += `
                    <td class="tm-cell-editable tm-task-meta-cell" data-tm-task-time-field="completionTime" style="${getTableCellStyle('completionTime')}" onclick="tmBeginCellEdit('${taskId}','completionTime',this,event)">${completionTimeText}</td>`;
                        break;
                    case 'taskCompleteAt':
                        rowHtml += `
                    <td class="tm-task-meta-cell" data-tm-task-time-field="taskCompleteAt" style="${getTableCellStyle('taskCompleteAt')}" title="${esc(taskCompleteAtText)}">${esc(taskCompleteAtText)}</td>`;
                        break;
                    case 'remainingTime':
                        rowHtml += `<td class="tm-task-meta-cell" data-tm-task-time-field="remainingTime" style="${getTableCellStyle('remainingTime', 'text-align:center;')}" title="${esc(remainingLabel)}">${remainingHtml}</td>`;
                        break;
                    case 'duration':
                        rowHtml += `
                    <td class="tm-cell-editable tm-task-meta-cell" data-tm-task-time-field="duration" style="${getTableCellStyle('duration')}" onclick="tmBeginCellEdit('${taskId}','duration',this,event)">${esc(__tmFormatDurationDisplayValue(duration || ''))}</td>`;
                        break;
                    case 'tomatoSummary':
                        rowHtml += `<td class="tm-cell-editable tm-task-meta-cell" data-tm-task-time-field="tomatoSummary" style="${getTableCellStyle('tomatoSummary', 'text-align:center; font-variant-numeric: inherit;')}" onclick="tmBeginCellEdit('${taskId}','tomatoSummary',this,event)">${tomatoSummaryHtml}</td>`;
                        break;
                    case 'tomatoEstimateCount':
                        rowHtml += `<td class="tm-cell-editable tm-task-meta-cell" data-tm-task-time-field="tomatoEstimateCount" style="${getTableCellStyle('tomatoEstimateCount', 'text-align:center; font-variant-numeric: inherit;')}" onclick="tmBeginCellEdit('${taskId}','tomatoEstimateCount',this,event)">${esc(tomatoEstimateText)}</td>`;
                        break;
                    case 'tomatoCount':
                        rowHtml += `<td class="tm-task-meta-cell" data-tm-task-time-field="tomatoCount" style="${getTableCellStyle('tomatoCount', 'text-align:center; font-variant-numeric: inherit;')}">${tomatoCountHtml || esc(tomatoCountText)}</td>`;
                        break;
                    case 'spent': {
                        const txt = useTomatoSpentHours
                            ? __tmFormatSpentHours(__tmGetTaskTomatoFocusValues(task).tomatoHours)
                            : __tmFormatSpentMinutes(__tmGetTaskSpentMinutes(task));
                        rowHtml += `<td class="tm-task-meta-cell" style="${getTableCellStyle('spent', 'text-align:center; font-variant-numeric: inherit;')}">${esc(txt)}</td>`;
                        break;
                    }
                    case 'remark':
                        rowHtml += `
                    <td class="tm-cell-editable tm-task-meta-cell" data-tm-field="remark" style="${getTableCellStyle('remark')}" title="${esc(remark || '')}" onclick="tmBeginCellEdit('${taskId}','remark',this,event)"><span class="tm-task-remark-text">${esc(remark || '')}</span></td>`;
                        break;
                    case 'attachments':
                        rowHtml += `
                    <td class="tm-task-meta-cell tm-task-attachments-cell" data-tm-field="attachments" style="${getTableCellStyle('attachments')}" onclick="tmOpenTaskDetail('${taskId}', event)">${__tmBuildTaskAttachmentSummaryHtml(task)}</td>`;
                        break;
                    case 'status':
                        rowHtml += `
                        <td class="tm-status-cell tm-task-meta-cell" data-tm-field="status" style="${getTableCellStyle('status', 'text-align: center;')}" onclick="tmOpenStatusSelect('${taskId}', event)">
                            <span class="tm-status-cell-inner">
                                <span class="tm-status-tag" style="${statusChipStyle}">
                                    ${esc(statusOption?.name || '')}
                                </span>
                            </span>
                        </td>
                     `;
                        break;
                    default: {
                        const customColumn = customFieldColumnsByKey.get(String(col || '').trim());
                        if (!customColumn) break;
                        const { field, fieldId, fieldType, colKey } = customColumn;
                        if (!__tmIsCustomFieldApplicableToTask(field, task)) {
                            rowHtml += `<td class="tm-task-meta-cell" data-tm-custom-field-cell="${esc(fieldId)}" style="${getTableCellStyle(colKey)}"></td>`;
                            break;
                        }
                        const fieldValue = __tmGetTaskCustomFieldValue(task, fieldId);
                        const displayHtml = __tmBuildCustomFieldDisplayHtml(field, fieldValue, {
                            allowEmpty: false,
                            maxTags: fieldType === 'multi' ? 2 : 1,
                        });
                        const textValue = fieldType === 'text'
                            ? String(__tmNormalizeCustomFieldValue(field, fieldValue) || '').trim()
                            : '';
                        const onClick = fieldType === 'text'
                            ? `tmBeginCellEdit('${taskId}','${colKey}',this,event)`
                            : `tmOpenCustomFieldSelect('${taskId}', '${fieldId}', event, this)`;
                        rowHtml += `
                        <td class="tm-cell-editable tm-task-meta-cell" data-tm-custom-field-cell="${esc(fieldId)}" style="${getTableCellStyle(colKey)}" ${textValue ? `title="${esc(textValue)}"` : ''} onclick="${onClick}">
                            <div class="tm-custom-field-cell">${displayHtml}</div>
                        </td>
                    `;
                        break;
                    }
                }
            }
            rowHtml += `</tr>`;
            return rowHtml;
        };

        // 递归渲染任务树，子任务按照全局 filteredTasks 顺序排列
        const renderTaskTree = (task, depth, inheritedHideCompleted = false, inCompletedRootGroup = false) => {
            const rows = [];
            const hideCompletedDescendants = __tmResolveHideCompletedDescendantsFlag(task, inheritedHideCompleted);

            // 获取该任务在 filtered 中的子任务
            const childTasks = (task.children || []).filter((c) => filteredIdSet.has(c.id) && __tmShouldKeepChildTaskVisible(task, c, inheritedHideCompleted));

            childTasks.sort((a, b) => getTaskOrder(a.id) - getTaskOrder(b.id));

            const hasChildren = childTasks.length > 0;
            const collapsed = state.collapsedTaskIds.has(String(task.id));
            const showChildren = hasChildren;

            const firstRow = emitRow(task, depth, showChildren, collapsed, { inCompletedRootGroup });
            if (firstRow === null) return rows;
            if (firstRow) rows.push(firstRow);

            if (showChildren && !collapsed) {
                childTasks.forEach(child => {
                    if (!hasTaskRowBudget()) return;
                    rows.push(...renderTaskTree(child, depth + 1, hideCompletedDescendants, inCompletedRootGroup));
                });
            }

            return rows;
        };

        const allRows = [];
        const appendCompletedRootGroup = () => {
            if (!completedRoots.length) return;
            if (!hasTaskRowBudget()) return;
            completedRoots.sort((a, b) => __tmCompareCompletedTasksRecentFirst(a, b, (x, y) => getTaskOrder(x.id) - getTaskOrder(y.id)));
            const doneGroupKey = __tmBuildCompletedRootGroupKey();
            const doneCollapsed = __tmIsCompletedRootGroupCollapsed(doneGroupKey);
            const doneToggle = `<span class="tm-group-toggle${doneCollapsed ? ' tm-group-toggle--collapsed' : ''}" onclick="tmToggleGroupCollapse('${doneGroupKey}', event)" style="cursor:pointer;margin-right:0;display:inline-flex;align-items:center;justify-content:center;width:16px;"><svg class="tm-group-toggle-icon" viewBox="0 0 16 16" width="16" height="16"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
            const doneDurationSum = __tmCalcGroupDurationText(completedRoots);
            allRows.push(`<tr class="tm-group-row" data-group-key="${doneGroupKey}"><td colspan="${colCount}" onclick="tmToggleGroupCollapse('${doneGroupKey}', event)" style="cursor:pointer;background:var(--tm-header-bg);font-weight:bold;color:var(--tm-text-color);"><div class="tm-group-sticky">${doneToggle}<span class="tm-group-label" style="color:var(--tm-secondary-text);">已完成任务</span><span class="tm-badge tm-badge--count">${completedRoots.length}</span>${doneDurationSum ? `<span class="tm-badge tm-badge--duration"><span class="tm-badge__icon">${__tmRenderBadgeIcon('chart-column')}</span>${esc(doneDurationSum)}</span>` : ''}</div></td></tr>`);
            if (!doneCollapsed) {
                currentGroupBg = '';
                completedRoots.forEach(task => {
                    if (!hasTaskRowBudget()) return;
                    allRows.push(...renderTaskTree(task, 0, false, true));
                });
            }
        };

        // 处理置顶任务（全局混排）
        if (pinnedRoots.length > 0) {
            const pinnedGroupKey = 'pinned_root_tasks';
            const pinnedCollapsed = state.collapsedGroups?.has(pinnedGroupKey);
            const pinnedToggle = `<span class="tm-group-toggle${pinnedCollapsed ? ' tm-group-toggle--collapsed' : ''}" onclick="tmToggleGroupCollapse('${pinnedGroupKey}', event)" style="cursor:pointer;margin-right:0;display:inline-flex;align-items:center;justify-content:center;width:16px;"><svg class="tm-group-toggle-icon" viewBox="0 0 16 16" width="16" height="16"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
            const pinnedDurationSum = __tmCalcGroupDurationText(pinnedRoots);
            allRows.push(`<tr class="tm-group-row" data-group-key="${pinnedGroupKey}"><td colspan="${colCount}" onclick="tmToggleGroupCollapse('${pinnedGroupKey}', event)" style="cursor:pointer;background:var(--tm-header-bg);font-weight:bold;color:var(--tm-text-color);"><div class="tm-group-sticky">${pinnedToggle}<span class="tm-checklist-group-pin-icon">${__tmRenderBadgeIcon('pin', 14)}</span><span class="tm-group-label" style="color:var(--tm-warning-color);">置顶</span><span class="tm-badge tm-badge--count">${pinnedRoots.length}</span>${pinnedDurationSum ? `<span class="tm-badge tm-badge--duration"><span class="tm-badge__icon">${__tmRenderBadgeIcon('chart-column')}</span>${esc(pinnedDurationSum)}</span>` : ''}</div></td></tr>`);
            if (!pinnedCollapsed) {
                currentGroupBg = '';
                pinnedRoots.forEach(task => {
                    if (!hasTaskRowBudget()) return;
                    allRows.push(...renderTaskTree(task, 0));
                });
            }
        }

        if (isUngroupForRender && pinnedRoots.length > 0 && normalRoots.length > 0) {
            const normalGroupKey = 'normal_root_tasks';
            const normalCollapsed = state.collapsedGroups?.has(normalGroupKey);
            const normalToggle = `<span class="tm-group-toggle${normalCollapsed ? ' tm-group-toggle--collapsed' : ''}" onclick="tmToggleGroupCollapse('${normalGroupKey}', event)" style="cursor:pointer;margin-right:0;display:inline-flex;align-items:center;justify-content:center;width:16px;"><svg class="tm-group-toggle-icon" viewBox="0 0 16 16" width="16" height="16"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
            allRows.push(`<tr class="tm-group-row" data-group-key="${normalGroupKey}"><td colspan="${colCount}" onclick="tmToggleGroupCollapse('${normalGroupKey}', event)" style="cursor:pointer;background:var(--tm-header-bg);font-weight:bold;color:var(--tm-text-color);"><div class="tm-group-sticky">${normalToggle}<span class="tm-group-label">普通</span><span class="tm-badge tm-badge--count">${normalRoots.length}</span></div></td></tr>`);
            if (!normalCollapsed) {
                currentGroupBg = '';
                normalRoots.forEach(task => {
                    if (!hasTaskRowBudget()) return;
                    const taskDocColor = __tmGetDocColorHex(task.root_id, isDark) || '';
                    currentGroupBg = (enableGroupBg && taskDocColor) ? __tmGroupBgFromLabelColor(taskDocColor, isDark) : '';
                    allRows.push(...renderTaskTree(task, 0));
                });
            }
        } else

        // 处理普通任务
        if (state.quadrantEnabled && normalRoots.length > 0) {
            // 四象限分组逻辑
            const quadrantRules = (SettingsStore.data.quadrantConfig && SettingsStore.data.quadrantConfig.rules) || [];

            // 获取任务的重要性等级
            const getImportanceLevel = (task) => {
                const priority = String(task.priority || '').toLowerCase();
                if (priority === 'a' || priority === '高' || priority === 'high') return 'high';
                if (priority === 'b' || priority === '中' || priority === 'medium') return 'medium';
                if (priority === 'c' || priority === '低' || priority === 'low') return 'low';
                return 'none';
            };

            // 获取任务的时间范围分类
            const getTimeRange = (task) => {
                const info = getTimePriorityInfo(task);
                const diffDays = Number(info?.diffDays);
                if (!Number.isFinite(diffDays)) return 'nodate';
                if (diffDays < 0) return 'overdue';
                if (diffDays <= 7) return 'within7days';
                if (diffDays <= 15) return 'within15days';
                if (diffDays <= 30) return 'within30days';
                return 'beyond30days';
            };

            // 获取任务距离今天的天数
            const getTaskDays = (task) => {
                const info = getTimePriorityInfo(task);
                const diffDays = Number(info?.diffDays);
                return Number.isFinite(diffDays) ? diffDays : Infinity;
            };

            // 将任务分配到四象限
            const quadrantGroups = {};
            quadrantRules.forEach(rule => {
                quadrantGroups[rule.id] = {
                    ...rule,
                    items: [],
                    sortOrder: 0
                };
            });

            // 四象限排序：重要紧急 > 重要不紧急 > 不重要紧急 > 不重要不紧急
            const quadrantOrder = ['urgent-important', 'not-urgent-important', 'urgent-not-important', 'not-urgent-not-important'];

            normalRoots.forEach(task => {
                const importance = getImportanceLevel(task);
                const timeRange = getTimeRange(task);
                const taskDays = getTaskDays(task);

                // 查找匹配的四象限规则
                let matchedRule = null;
                for (const rule of quadrantRules) {
                    const importanceMatch = rule.importance.includes(importance);

                    // 检查时间范围匹配（支持 beyondXdays 范围）
                    let timeRangeMatch = rule.timeRanges.includes(timeRange);
                    if (!timeRangeMatch) {
                        // 检查是否选择了 "余X天以上" 选项
                        for (const range of rule.timeRanges) {
                            if (range.startsWith('beyond') && range !== 'beyond30days') {
                                const days = parseInt(range.replace('beyond', '').replace('days', ''));
                                if (!isNaN(days) && taskDays > days) {
                                    timeRangeMatch = true;
                                    break;
                                }
                            }
                        }
                    }

                    if (importanceMatch && timeRangeMatch) {
                        matchedRule = rule;
                        break;
                    }
                }

                if (matchedRule) {
                    quadrantGroups[matchedRule.id].items.push(task);
                }
            });

            // 渲染四象限分组
            const colorMap = {
                red: 'var(--tm-quadrant-red)',
                yellow: 'var(--tm-quadrant-yellow)',
                blue: 'var(--tm-quadrant-blue)',
                green: 'var(--tm-quadrant-green)'
            };

            const bgColorMap = {
                red: 'var(--tm-quadrant-bg-red)',
                yellow: 'var(--tm-quadrant-bg-yellow)',
                blue: 'var(--tm-quadrant-bg-blue)',
                green: 'var(--tm-quadrant-bg-green)'
            };

            quadrantOrder.forEach((quadrantId, index) => {
                const group = quadrantGroups[quadrantId];
                if (!group || group.items.length === 0) return;

                const color = colorMap[group.color] || 'var(--tm-text-color)';

                // 支持折叠
                const groupKey = `quadrant_${quadrantId}`;
                const isCollapsed = state.collapsedGroups?.has(groupKey);
                const toggle = `<span class="tm-group-toggle${isCollapsed ? ' tm-group-toggle--collapsed' : ''}" onclick="tmToggleGroupCollapse('${groupKey}', event)" style="cursor:pointer;margin-right:0;display:inline-flex;align-items:center;justify-content:center;width:16px;"><svg class="tm-group-toggle-icon" viewBox="0 0 16 16" width="16" height="16"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;

                // 计算时长总和
                const calculateDuration = (items) => {
                    return __tmCalcGroupDurationText(items);
                };
                const durationSum = calculateDuration(group.items);

                allRows.push(`<tr class="tm-group-row" data-group-key="${groupKey}"><td colspan="${colCount}" onclick="tmToggleGroupCollapse('${groupKey}', event)" style="cursor:pointer;background:var(--tm-header-bg);font-weight:bold;color:${color};"><div class="tm-group-sticky">${toggle}${esc(group.name)}<span class="tm-badge tm-badge--count">${group.items.length}</span>${durationSum ? `<span class="tm-badge tm-badge--duration"><span class="tm-badge__icon">${__tmRenderBadgeIcon('chart-column')}</span>${esc(durationSum)}</span>` : ''}</div></td></tr>`);

                // 如果未折叠，渲染任务
                if (!isCollapsed) {
                    currentGroupBg = enableGroupBg ? __tmGroupBgFromLabelColor(color, isDark) : '';
                    const prefer = !!SettingsStore.data.groupSortByBestSubtaskTimeInTimeQuadrant;
                    sortRenderGroupItems(group.items, prefer ? compareByTimePriority : null);
                    group.items.forEach(task => {
                        if (!hasTaskRowBudget()) return;
                        allRows.push(...renderTaskTree(task, 0));
                    });
                }
            });
        } else if (state.groupByDocName) {
            // 按文档分组模式：不应用全局混排，按文档顺序显示，支持折叠
            const enableDocH2Subgroup = SettingsStore.data.docH2SubgroupEnabled !== false;
            const headingLevel = String(SettingsStore.data.taskHeadingLevel || 'h2').trim() || 'h2';
            const headingLabelMap = { h1: '一级标题', h2: '二级标题', h3: '三级标题', h4: '四级标题', h5: '五级标题', h6: '六级标题' };
            const noHeadingLabel = `无${headingLabelMap[headingLevel] || '标题'}`;
            docsInOrder.forEach(docId => {
                const docEntry = docEntryById.get(String(docId || '').trim());
                if (!docEntry) return;
                const alwaysVisibleDocHeadingTasks = __tmGetAlwaysVisibleTaskDocHeadingTasks(docId);

                // 获取该文档的根任务
                const docRootTasks = docRootTasksByDoc.get(String(docId || '').trim()) || [];

                // 分离置顶和非置顶
                const docNormal = pinWithinGroups ? docRootTasks.slice() : docRootTasks.filter(t => !t.pinned);
                const activeDocRootTasks = __tmShouldSeparateCompletedRootGroup()
                    ? docNormal.filter((task) => !__tmIsTaskDoneForTailGroup(task))
                    : docNormal.slice();
                if (activeDocRootTasks.length === 0 && alwaysVisibleDocHeadingTasks.length === 0) return;
                const docTasks = activeDocRootTasks;
                const renderDocTasks = sortRenderGroupItems(activeDocRootTasks.slice());

                // 渲染文档标题（支持折叠）
                const docName = docEntry.name || '未知文档';
                const groupKey = `doc_${docId}`;
                const isCollapsed = state.collapsedGroups?.has(groupKey);
                const toggle = `<span class="tm-group-toggle${isCollapsed ? ' tm-group-toggle--collapsed' : ''}" onclick="tmToggleGroupCollapse('${groupKey}', event)" style="cursor:pointer;margin-right:0;display:inline-flex;align-items:center;justify-content:center;width:16px;"><svg class="tm-group-toggle-icon" viewBox="0 0 16 16" width="16" height="16"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
                const labelColor = __tmGetDocColorHex(docId, isDark) || 'var(--tm-group-doc-label-color)';
                const createBtnHtml = __tmBuildDocGroupQuickAddBtnHtml(docId, '新建任务');
                const docGroupDropAttrs = `data-group-kind="doc" data-group-key="${esc(groupKey)}" data-tm-doc-heading-drop-kind="doc" data-tm-doc-heading-drop-doc="${esc(docId)}" ondragenter="tmDocHeadingGroupDragOver(event)" ondragover="tmDocHeadingGroupDragOver(event)" ondragleave="tmDocHeadingGroupDragLeave(event)" ondrop="tmDocHeadingGroupDrop(event)"`;

                allRows.push(`<tr class="tm-group-row" ${docGroupDropAttrs}><td colspan="${colCount}" onclick="tmToggleGroupCollapse('${groupKey}', event)" style="cursor:pointer;background:var(--tm-header-bg);font-weight:bold;color:var(--tm-text-color);"><div class="tm-group-sticky">${toggle}<span class="tm-group-label" style="color:${labelColor};">${__tmRenderDocGroupLabel(docId, docName)}</span><span class="tm-badge tm-badge--count">${docTasks.length}</span>${createBtnHtml}</div></td></tr>`);

                // 渲染该文档的任务（如果未折叠）
                if (!isCollapsed) {
                    currentGroupBg = enableGroupBg ? __tmGroupBgFromLabelColor(labelColor, isDark) : '';
                    const h2OrderSource = docTasks.concat(alwaysVisibleDocHeadingTasks);
                    const useDocH2Subgroup = enableDocH2Subgroup && __tmDocHasAnyHeading(docId, h2OrderSource);
                    if (!useDocH2Subgroup) {
                        renderDocTasks.forEach(task => {
                            if (!hasTaskRowBudget()) return;
                            allRows.push(...renderTaskTree(task, 0));
                        });
                    } else {
                        const h2Groups = new Map();
                        const h2Buckets = __tmBuildDocHeadingBuckets(h2OrderSource, noHeadingLabel);
                        h2OrderSource.forEach(task => {
                                const b = __tmGetDocHeadingBucket(task, noHeadingLabel);
                                if (!h2Groups.has(b.key)) h2Groups.set(b.key, { label: b.label, id: String(b.id || '').trim(), items: [], sourceTask: task });
                            });
                        docTasks.forEach(task => {
                                const b = __tmGetDocHeadingBucket(task, noHeadingLabel);
                                if (!h2Groups.has(b.key)) h2Groups.set(b.key, { label: b.label, id: String(b.id || '').trim(), items: [], sourceTask: task });
                                h2Groups.get(b.key).items.push(task);
                            });

                        const orderedH2Buckets = h2Buckets
                            .concat(Array.from(h2Groups.keys())
                                .filter((k) => !h2Buckets.some((b) => b.key === k))
                                .map((k) => ({ key: k, label: String(h2Groups.get(k)?.label || ''), id: String(h2Groups.get(k)?.id || '').trim() })));
                        orderedH2Buckets.forEach((bucket) => {
                            const g = h2Groups.get(bucket.key) || { label: String(bucket.label || ''), id: String(bucket.id || '').trim(), items: [] };
                            const items = Array.isArray(g.items) ? g.items : [];
                            const h2Key = `doc_${docId}__h2_${encodeURIComponent(String(bucket.key || 'label:__none__'))}`;
                            const h2Collapsed = state.collapsedGroups?.has(h2Key);
                            const toggleH2 = `<span class="tm-group-toggle${h2Collapsed ? ' tm-group-toggle--collapsed' : ''}" onclick="tmToggleGroupCollapse('${h2Key}', event)" style="cursor:pointer;margin-right:0;display:inline-flex;align-items:center;justify-content:center;width:16px;"><svg class="tm-group-toggle-icon" viewBox="0 0 16 16" width="16" height="16"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
                            const createBtnHtml = __tmBuildHeadingGroupCreateBtnHtml(docId, String(g.id || bucket.id || '').trim(), '在该标题下新建任务');
                            const h2LabelColor = __tmGetHeadingSubgroupLabelColor(labelColor, isDark);
                            const h2Id = String(g.id || bucket.id || '').trim();
                            const h2Rank = Number((items?.[0] || g.sourceTask)?.h2Rank);
                            const h2GroupDropAttrs = `data-group-kind="h2" data-group-key="${esc(h2Key)}" data-tm-doc-heading-drop-kind="heading" data-tm-doc-heading-drop-doc="${esc(docId)}" data-tm-doc-heading-drop-heading="${esc(h2Id)}" data-tm-doc-heading-drop-label="${esc(__tmNormalizeHeadingText(g.label || bucket.label || ''))}" data-tm-doc-heading-drop-rank="${Number.isFinite(h2Rank) ? h2Rank : ''}" ondragenter="tmDocHeadingGroupDragOver(event)" ondragover="tmDocHeadingGroupDragOver(event)" ondragleave="tmDocHeadingGroupDragLeave(event)" ondrop="tmDocHeadingGroupDrop(event)"`;
                            allRows.push(`<tr class="tm-group-row" ${h2GroupDropAttrs}><td colspan="${colCount}" onclick="tmToggleGroupCollapse('${h2Key}', event)" style="cursor:pointer;background:var(--tm-header-bg);font-weight:bold;color:var(--tm-text-color);"><div class="tm-group-sticky" style="padding-left:2ch;">${toggleH2}<span class="tm-group-label" style="color:${h2LabelColor};">${__tmRenderHeadingLevelIconLabel(g.label || '', SettingsStore.data.taskHeadingLevel || 'h2')}</span><span class="tm-badge tm-badge--count">${Array.isArray(items) ? items.length : 0}</span>${createBtnHtml}</div></td></tr>`);
                            if (!h2Collapsed) {
                                const renderItems = sortRenderGroupItems(items.slice());
                                renderItems.forEach(task => {
                                    if (!hasTaskRowBudget()) return;
                                    allRows.push(...renderTaskTree(task, 0));
                                });
                            }
                        });
                    }
                }
            });
        } else if (state.groupByTime && normalRoots.length > 0) {
            // 按时间分组逻辑（跨文档）
            const getTimeGroup = (task) => {
                const info = getTimePriorityInfo(task);
                const diffDays = Number(info?.diffDays);
                if (!Number.isFinite(diffDays)) {
                    return { key: 'pending', label: '待定', labelHtml: '待定', sortValue: Infinity };
                }

                if (diffDays < 0) return { key: 'overdue', label: '已过期', labelHtml: '已过期', sortValue: diffDays };
                if (diffDays === 0) return { key: 'today', label: '今天', labelHtml: buildTimeGroupLabelHtml('今天', diffDays), sortValue: 0 };
                if (diffDays === 1) return { key: 'tomorrow', label: '明天', labelHtml: buildTimeGroupLabelHtml('明天', diffDays), sortValue: 1 };
                if (diffDays === 2) return { key: 'after_tomorrow', label: '后天', labelHtml: buildTimeGroupLabelHtml('后天', diffDays), sortValue: 2 };
                if (diffDays >= 16) return { key: 'farther', label: '更远', labelHtml: '更远', sortValue: 16 };

                const label = `余${diffDays}天`;
                return {
                    key: `days_${diffDays}`,
                    label,
                    labelHtml: buildTimeGroupLabelHtml(label, diffDays),
                    sortValue: diffDays,
                };
            };

            // 按时间分组
            const timeGroups = new Map();
            normalRoots.forEach(task => {
                const groupInfo = getTimeGroup(task);
                if (!timeGroups.has(groupInfo.key)) {
                    timeGroups.set(groupInfo.key, { ...groupInfo, items: [] });
                }
                timeGroups.get(groupInfo.key).items.push(task);
            });

            // 按时间顺序渲染分组
            const sortedGroups = [...timeGroups.values()].sort((a, b) => a.sortValue - b.sortValue);

            // 计算时长总和的辅助函数
            const calculateGroupDuration = (items) => {
                return __tmCalcGroupDurationText(items, { skipNonEmptyStatus: true });
            };

            sortedGroups.forEach(group => {
                const isCollapsed = state.collapsedGroups?.has(group.key);
                const toggle = `<span class="tm-group-toggle${isCollapsed ? ' tm-group-toggle--collapsed' : ''}" onclick="tmToggleGroupCollapse('${group.key}', event)" style="cursor:pointer;margin-right:0;display:inline-flex;align-items:center;justify-content:center;width:16px;"><svg class="tm-group-toggle-icon" viewBox="0 0 16 16" width="16" height="16"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
                const labelColor = __tmGetTimeGroupLabelColor(group);
                const groupKey = String(group.key || '').trim();
                const hasWeekdayChip = group.kind === 'time' && String(group.labelHtml || '').includes('tm-time-group-weekday-chip');
                const timeGroupDropAttrs = `data-group-kind="time" data-group-key="${esc(groupKey)}" ondragenter="tmTimeGroupDragOver(event, '${groupKey}')" ondragover="tmTimeGroupDragOver(event, '${groupKey}')" ondragleave="tmTimeGroupDragLeave(event)" ondrop="tmTimeGroupDrop(event, '${groupKey}')"`;
                const quickAddBtnHtml = __tmBuildTimeGroupQuickAddBtnHtml(state.activeDocId, group);

                // 计算该分组下所有任务的时长总和
                const durationSum = calculateGroupDuration(group.items);

                allRows.push(`<tr class="tm-group-row" ${timeGroupDropAttrs}><td colspan="${colCount}" onclick="tmToggleGroupCollapse('${groupKey}', event)" style="cursor:pointer;background:var(--tm-header-bg);font-weight:bold;color:var(--tm-text-color);"><div class="tm-group-sticky">${toggle}<span class="tm-group-label tm-group-label--time${hasWeekdayChip ? ' tm-group-label--has-weekday-chip' : ''}" style="color:${labelColor};">${String(group.labelHtml || esc(group.label))}</span><span class="tm-badge tm-badge--count">${group.items.length}</span>${durationSum ? `<span class="tm-badge tm-badge--duration"><span class="tm-badge__icon">${__tmRenderBadgeIcon('chart-column')}</span>${esc(durationSum)}</span>` : ''}${quickAddBtnHtml}</div></td></tr>`);

                if (!isCollapsed) {
                    currentGroupBg = enableGroupBg
                        ? (group.key === 'pending' ? __tmGetPendingTimeGroupTaskBg(isDark) : __tmGroupBgFromLabelColor(labelColor, isDark))
                        : '';
                    const prefer = !!SettingsStore.data.groupSortByBestSubtaskTimeInTimeQuadrant;
                    sortRenderGroupItems(group.items, prefer ? compareByTimePriority : null);
                    group.items.forEach(task => {
                        if (!hasTaskRowBudget()) return;
                        allRows.push(...renderTaskTree(task, 0));
                    });
                }
            });
        } else if (state.groupByTaskName) {
            // 按任务名分组模式：只对顶级任务分组，子任务跟随父任务
            // 1. 先找出所有顶级任务
            const topLevelTasks = normalRoots;

            // 2. 按任务内容分组顶级任务
            const tasksByContent = {};
            topLevelTasks.forEach(task => {
                const content = String(task.content || '').trim();
                if (!content) return;
                if (!tasksByContent[content]) {
                    tasksByContent[content] = [];
                }
                tasksByContent[content].push(task);
            });

            // 3. 按任务名称升序排序
            const sortedGroups = Object.entries(tasksByContent)
                .sort((a, b) => String(a[0] || '').localeCompare(String(b[0] || ''), 'zh-CN'));

            // 4. 渲染分组
            sortedGroups.forEach(([content, tasks]) => {
                if (tasks.length === 0) return;

                // 渲染分组标题
                const safeContent = String(content || '').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
                const groupKey = `task_${safeContent}`;
                const isCollapsed = state.collapsedGroups?.has(groupKey);
                const toggle = `<span class="tm-group-toggle${isCollapsed ? ' tm-group-toggle--collapsed' : ''}" onclick="tmToggleGroupCollapse('${groupKey}', event)" style="cursor:pointer;margin-right:0;display:inline-flex;align-items:center;justify-content:center;width:16px;"><svg class="tm-group-toggle-icon" viewBox="0 0 16 16" width="16" height="16"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
                const labelColor = 'var(--tm-primary-color)';

                allRows.push(`<tr class="tm-group-row" data-group-key="${groupKey}"><td colspan="${colCount}" onclick="tmToggleGroupCollapse('${groupKey}', event)" style="cursor:pointer;background:var(--tm-header-bg);font-weight:bold;color:var(--tm-text-color);"><div class="tm-group-sticky">${toggle}<span class="tm-group-label" style="color:${labelColor};">🧩 ${esc(content)}</span><span class="tm-badge tm-badge--count">${tasks.length}</span></div></td></tr>`);

                // 渲染该组的顶级任务及其子任务（如果未折叠）
                if (!isCollapsed) {
                    sortRenderGroupItems(tasks);
                    // 按任务名分组时，每个任务使用自己文档的颜色
                    tasks.forEach(task => {
                        if (!hasTaskRowBudget()) return;
                        if (task.root_id) {
                            const taskDocColor = __tmGetDocColorHex(task.root_id, isDark);
                            currentGroupBg = (enableGroupBg && taskDocColor) ? __tmGroupBgFromLabelColor(taskDocColor, isDark) : '';
                        } else {
                            currentGroupBg = '';
                        }
                        allRows.push(...renderTaskTree(task, 0));
                    });
                }
            });
        } else {
            // 普通全局混排（不按时间分组，不按文档分组，不按任务名分组）
            normalRoots.forEach(task => {
                if (!hasTaskRowBudget()) return;
                const taskDocColor = __tmGetDocColorHex(task.root_id, isDark) || '';
                currentGroupBg = (enableGroupBg && taskDocColor) ? __tmGroupBgFromLabelColor(taskDocColor, isDark) : '';
                allRows.push(...renderTaskTree(task, 0));
            });
        }

        appendCompletedRootGroup();

        if (allRows.length === 0) {
            return `<tr><td colspan="${colCount}" style="text-align: center; padding: 40px; color: var(--tm-secondary-text);">暂无任务</td></tr>`;
        }

        if (virtualEnabled) {
            const remain = visitedTaskRows >= taskRowLimit
                ? Math.max(0, state.filteredTasks.length - visitedTaskRows)
                : 0;
            if (remain > 0) {
                allRows.push(`<tr class="tm-load-more-row"><td colspan="${colCount}" style="text-align:center;padding:10px;background:var(--tm-header-bg);"><button type="button" class="tm-btn tm-btn-secondary" onclick="tmListLoadMoreRows(event)">继续加载</button></td></tr>`);
            }
        }

        return allRows.join('');
    }

    window.tmListLoadMoreRows = async function(ev) {
        try { ev?.preventDefault?.(); } catch (e) {}
        try { ev?.stopPropagation?.(); } catch (e) {}
        const grown = __tmGrowViewRenderWindow('list', state.filteredTasks.length);
        if (!grown || grown.limit <= grown.previousLimit) return;
        try {
            __tmScheduleDeferredVisibleListCustomFieldHydration({
                delayMs: 180,
                reason: 'list-load-more-button',
            });
        } catch (e) {}
        if (__tmHasCalendarSidebarChecklist(state.modal)) {
            __tmRefreshCalendarSidebarChecklistPreserveScroll();
            return;
        }
        if (!__tmRerenderListInPlace(state.modal, {
            appendOnly: true,
            previousLimit: grown.previousLimit,
        })) render();
    };

    // 切换任务状态
    window.tmToggle = async function(id) {
        const tid = String(id || '').trim();
        const task = globalThis.__tmTaskBoundary?.getTask?.(tid) || null;
        if (!task) return;

        const currentDone = typeof __tmIsTaskDoneEffective === 'function'
            ? !!__tmIsTaskDoneEffective(task)
            : !!task.done;
        await window.tmSetDone(tid, !currentDone, null, {
            source: 'task-toggle-done',
            fsrsRating: !currentDone ? 3 : 0,
        });
    };

    function __tmUpdateDoneMarkdown(markdown, done) {
        const md = String(markdown || '');
        const replaced = md.replace(/^(\s*[\*\-]\s*)\[(?:\s|x|X)\]/, `$1[${done ? 'x' : ' '}]`);
        if (replaced === md) {
            const alt = md.replace(/^(\s*[\*\-]\s*)\[[xX ]\]\s*/, `$1[${done ? 'x' : ' '}] `);
            return alt;
        }
        return replaced;
    }

    let __tmRenderScheduled = false;
    let __tmRenderNeedFilters = false;

    function __tmScheduleRender(options = {}) {
        const withFilters = !(options && options.withFilters === false);
        const reason = String(options?.reason || '').trim() || 'scheduled-render';
        if (options?.deferIfDetailBusy !== false) {
            const barrier = __tmGetBusyTaskDetailBarrier();
            if (barrier) {
                try {
                    __tmPushDetailDebug('detail-host-schedule-render-deferred', {
                        withFilters,
                        reason,
                        barrier: barrier.entries.map((entry) => ({
                            scope: entry.scope,
                            taskId: entry.taskId,
                            reasons: entry.reasons.slice(),
                            holdMsLeft: entry.holdMsLeft,
                        })),
                    });
                } catch (e) {}
                __tmScheduleBusyDetailViewRefresh({
                    mode: 'full',
                    withFilters,
                    reason,
                });
                return;
            }
        }
        __tmRenderNeedFilters = __tmRenderNeedFilters || withFilters;
        if (__tmRenderScheduled) {
            return;
        }
        __tmRenderScheduled = true;
        requestAnimationFrame(() => {
            const interactionWait = (typeof __tmGetHighPriorityInteractionWaitMs === 'function')
                ? __tmGetHighPriorityInteractionWaitMs(32)
                : 0;
            if (interactionWait > 0) {
                try {
                    setTimeout(() => {
                        __tmRenderScheduled = false;
                        __tmScheduleRender({
                            withFilters: __tmRenderNeedFilters,
                            reason,
                        });
                    }, interactionWait);
                } catch (e) {
                    __tmRenderScheduled = false;
                }
                return;
            }
            __tmRenderScheduled = false;
            const needFilters = __tmRenderNeedFilters;
            __tmRenderNeedFilters = false;
            if (needFilters) {
                __tmRecomputeTaskProjection({ reason });
            }
            if (typeof __tmIsPluginVisibleNow === 'function' && !__tmIsPluginVisibleNow()) {
                return;
            }
            let preservedCalendarSideDock = false;
            if (typeof __tmHasMountedCalendarSideDock === 'function' && __tmHasMountedCalendarSideDock()) {
                try { preservedCalendarSideDock = !!__tmRerenderCurrentViewInPlace(state.modal); } catch (e) {}
            }
            if (!preservedCalendarSideDock) render();
        });
    }

    // ========== 全局操作锁 ==========

    const GlobalLock = {
        locked: false,
        timer: null,

        lock() {
            this.locked = true;
            this.updateUI();

            // 清除之前的定时器
            if (this.timer) clearTimeout(this.timer);
            this.timer = null;

            // 不再使用自动解锁，而是等待 render() 完成后手动解锁
        },

        unlock() {
            this.locked = false;
            this.timer = null;
            this.updateUI();
        },

        updateUI() {
            // The lock only serializes the legacy DOM fallback. Task mutations
            // use per-task lanes and must not disable unrelated UI controls.
            return this.locked;
        },

        isLocked() {
            return this.locked;
        }
    };

    // ============ DOM 回退树状态保护器 ============
    const TreeProtector = {
        capture(tasks) {
            const snapshot = new Map();
            const visit = (items) => {
                (Array.isArray(items) ? items : []).forEach((task) => {
                    const taskId = String(task?.id || '').trim();
                    if (taskId) {
                        snapshot.set(taskId, {
                            priority: task.priority || '',
                            duration: task.duration || '',
                            remark: task.remark || '',
                            completionTime: task.completionTime || '',
                            customTime: task.customTime || '',
                            customStatus: task.customStatus || '',
                        });
                    }
                    visit(task?.children);
                });
            };
            visit(tasks);
            return snapshot;
        },
        restore(tasks, snapshot) {
            if (!(snapshot instanceof Map) || snapshot.size === 0) return;
            const visit = (items) => {
                (Array.isArray(items) ? items : []).forEach((task) => {
                    const saved = snapshot.get(String(task?.id || '').trim());
                    if (saved) {
                        if (!task.priority && saved.priority) task.priority = saved.priority;
                        if (!task.duration && saved.duration) task.duration = saved.duration;
                        if (!task.remark && saved.remark) task.remark = saved.remark;
                        if (!task.completionTime && saved.completionTime) task.completionTime = saved.completionTime;
                        if (!task.customTime && saved.customTime) task.customTime = saved.customTime;
                        if (!task.customStatus && saved.customStatus) task.customStatus = saved.customStatus;
                    }
                    visit(task?.children);
                });
            };
            visit(tasks);
        },
        clear(snapshot) {
            if (snapshot instanceof Map) {
                snapshot.clear();
            }
        }
    };

    // 保存任务完整状态到 MetaStore
    function saveTaskFullState(task) {
        if (!task?.id) return;

        const stateData = {
            priority: task.priority || '',
            duration: task.duration || '',
            remark: task.remark || '',
            completionTime: task.completionTime || '',
            customTime: task.customTime || '',
            content: task.content || '',
            done: task.done,
            parentTaskId: task.parentTaskId || null,
            timestamp: Date.now()
        };

        MetaStore.set(task.id, stateData);
    }

    // 从 MetaStore 恢复任务状态
    function restoreTaskFromMeta(task) {
        if (!task?.id) return task;

        const saved = MetaStore.get(task.id);
        if (!saved) return task;

        // 只有当当前值为空时才恢复（避免覆盖新输入）
        if (!task.priority && saved.priority) task.priority = saved.priority;
        if (!task.duration && saved.duration) task.duration = saved.duration;
        if (!task.remark && saved.remark) task.remark = saved.remark;
        if (!task.completionTime && saved.completionTime) task.completionTime = saved.completionTime;
        if (!task.customTime && saved.customTime) task.customTime = saved.customTime;
        if (!task.customStatus && saved.customStatus) {
            task.customStatus = String(saved.customStatus || '').trim();
            task.custom_status = task.customStatus;
        }
        if (saved.customFieldValues && typeof saved.customFieldValues === 'object') {
            const current = (task.customFieldValues && typeof task.customFieldValues === 'object') ? task.customFieldValues : {};
            task.customFieldValues = __tmNormalizeTaskCustomFieldValues(current, saved.customFieldValues);
        }

        return task;
    }

    function __tmRestoreTaskTreeFromMeta(tasks) {
        const list = Array.isArray(tasks) ? tasks : [];
        list.forEach((task) => {
            restoreTaskFromMeta(task);
            if (Array.isArray(task?.children) && task.children.length > 0) {
                __tmRestoreTaskTreeFromMeta(task.children);
            }
        });
        return list;
    }

    function __tmTaskHasOwnHeadingContextFields(task) {
        if (!(task && typeof task === 'object')) return false;
        return ['h2', 'h2Id', 'h2Path', 'h2Sort', 'h2Created', 'h2Rank', 'headingLevel']
            .some((key) => Object.prototype.hasOwnProperty.call(task, key));
    }

    function __tmCopyTaskHeadingContext(target, source) {
        if (!(target && typeof target === 'object')) return target;
        const src = (source && typeof source === 'object') ? source : {};
        target.h2 = String(src.h2 || '').trim();
        target.h2Id = String(src.h2Id || '').trim();
        target.h2Path = String(src.h2Path || '').trim();
        target.h2Sort = Number(src.h2Sort);
        target.h2Created = String(src.h2Created || '').trim();
        target.h2Rank = Number(src.h2Rank);
        if (Object.prototype.hasOwnProperty.call(src, 'headingLevel')
            || Object.prototype.hasOwnProperty.call(target, 'headingLevel')) {
            target.headingLevel = String(src.headingLevel || SettingsStore?.data?.taskHeadingLevel || 'h2').trim() || 'h2';
        }
        return target;
    }

    function __tmApplyTaskHeadingContext(target, headingCtx) {
        if (!(target && typeof target === 'object')) return target;
        if (headingCtx && typeof headingCtx === 'object') {
            target.h2 = String(headingCtx.content || '').trim();
            target.h2Id = String(headingCtx.id || '').trim();
            target.h2Path = String(headingCtx.path || '').trim();
            target.h2Sort = Number(headingCtx.sort);
            target.h2Created = String(headingCtx.created || '').trim();
            target.h2Rank = Number(headingCtx.rank);
            if (Object.prototype.hasOwnProperty.call(target, 'headingLevel')) {
                target.headingLevel = String(target.headingLevel || SettingsStore?.data?.taskHeadingLevel || 'h2').trim() || 'h2';
            }
            return target;
        }
        target.h2 = String(headingCtx || '').trim();
        target.h2Id = '';
        target.h2Path = '';
        target.h2Sort = Number.NaN;
        target.h2Created = '';
        target.h2Rank = Number.NaN;
        if (Object.prototype.hasOwnProperty.call(target, 'headingLevel')) {
            target.headingLevel = String(target.headingLevel || SettingsStore?.data?.taskHeadingLevel || 'h2').trim() || 'h2';
        }
        return target;
    }

    function __tmCacheTaskInState(task, options = {}) {
        if (!task || typeof task !== 'object') return null;
        const next = task;
        const opts = (options && typeof options === 'object') ? options : {};
        const docNameFallback = String(opts.docNameFallback || next.doc_name || next.docName || '').trim() || '未命名文档';
        try { MetaStore.applyToTask(next); } catch (e) {}
        try { normalizeTaskFields(next, docNameFallback); } catch (e) {}
        const tid = String(next.id || '').trim();
        if (!tid) return next;
        const prev = globalThis.__tmTaskBoundary?.getTask?.(tid, { includePending: false, preferPending: false });
        if (!__tmTaskHasOwnHeadingContextFields(next) && prev && typeof prev === 'object') {
            __tmCopyTaskHeadingContext(next, prev);
        }
        try {
            globalThis.__tmTaskStore?.upsertLocal?.(next, { status: 'cache' });
        } catch (e) {
        }
        return next;
    }

    function __tmApplyQuickbarAttrUpdateInState(taskId, attrKey, attrValue, options = {}) {
        const tid = String(taskId || '').trim();
        const key = String(attrKey || '').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        const finish = (ok, reason = '') => {
            if (opts.returnReason === true) {
                return {
                    ok: ok === true,
                    reason: String(reason || '').trim(),
                    taskId: tid,
                    attrKey: key,
                };
            }
            return ok === true;
        };
        if (!tid || !key) return finish(false, 'invalid-input');
        const task = globalThis.__tmTaskBoundary?.getTask?.(tid) || null;
        if (!task || typeof task !== 'object') return finish(false, 'task-missing');
        const customFieldDef = __tmGetCustomFieldDefByAttrStorageKey(key);
        const customFieldId = String(customFieldDef?.id || '').trim();
        const isCustomFieldAttr = !!customFieldId;
        if (isCustomFieldAttr) {
        }
        const rawValue = attrValue == null ? '' : String(attrValue);
        const trimmedValue = String(rawValue || '').trim();
        const metaUpdate = __tmBuildMetaPatchFromAttrUpdate(key, rawValue, task);
        const comparablePatch = (metaUpdate?.patch && typeof metaUpdate.patch === 'object') ? metaUpdate.patch : null;
        if (comparablePatch) {
            const inversePatch = __tmCaptureTaskPatchInverse(tid, comparablePatch);
            if (__tmIsPatchNoop(comparablePatch, inversePatch)) {
                try {
                    const customFieldPatch = (comparablePatch.customFieldValues && typeof comparablePatch.customFieldValues === 'object' && !Array.isArray(comparablePatch.customFieldValues))
                        ? comparablePatch.customFieldValues
                        : null;
                    if (customFieldPatch) {
                        Object.entries(customFieldPatch).forEach(([fieldId, nextValue]) => {
                            const fid = String(fieldId || '').trim();
                            if (!fid) return;
                            const field = __tmGetCustomFieldDefMap().get(fid);
                            if (!field) return;
                            __tmApplyTaskCustomFieldValueLocally(task, field, nextValue);
                        });
                        __tmCacheTaskInState(task, {
                            docNameFallback: task.doc_name || task.docName || '未命名文档'
                        });
                        MetaStore.set(tid, { customFieldValues: customFieldPatch });
                    }
                } catch (e) {}
return finish(false, 'noop');
            }
        }
        let metaPatch = null;
        const taskMetaField = typeof __tmResolveTaskMetaFieldByAttrKey === 'function'
            ? __tmResolveTaskMetaFieldByAttrKey(key)
            : '';
        if (taskMetaField && metaUpdate?.patch && typeof metaUpdate.patch === 'object') {
            try {
                Object.entries(metaUpdate.patch).forEach(([field, nextValue]) => {
                    if (field === 'taskCompleteAt') {
                        const normalized = __tmNormalizeTaskCompleteAtValue(nextValue);
                        task.taskCompleteAt = normalized;
                        task.task_complete_at = normalized;
                        return;
                    }
                    if (field === 'milestone') {
                        const milestone = nextValue === true || String(nextValue || '').trim() === '1';
                        task.milestone = milestone;
                        task.custom_milestone = milestone ? '1' : '';
                        return;
                    }
                    if (field === 'pinned') {
                        const pin = String(nextValue || '').trim() === '1';
                        task.pinned = pin;
                        task.custom_pinned = pin ? '1' : '';
                        return;
                    }
                    if (field === 'allDayBottom') {
                        const bottom = String(nextValue || '').trim() === '1';
                        task.allDayBottom = bottom;
                        task.custom_all_day_bottom = bottom ? '1' : '';
                        return;
                    }
                    __tmApplyTaskMetaAttrValueToTask(task, field, nextValue);
                });
            } catch (e) {}
            metaPatch = metaUpdate.patch;
        } else {

        switch (key) {
            case 'custom-status':
                task.customStatus = trimmedValue;
                task.custom_status = trimmedValue;
                metaPatch = { customStatus: trimmedValue };
                break;
            case 'custom-priority':
                task.priority = trimmedValue;
                task.custom_priority = trimmedValue;
                metaPatch = { priority: trimmedValue };
                break;
            case 'custom-start-date':
                task.startDate = trimmedValue;
                task.start_date = trimmedValue;
                metaPatch = { startDate: trimmedValue };
                break;
            case 'custom-completion-time':
                task.completionTime = trimmedValue;
                task.completion_time = trimmedValue;
                metaPatch = { completionTime: trimmedValue };
                break;
            case 'custom-time':
                task.customTime = trimmedValue;
                task.custom_time = trimmedValue;
                metaPatch = { customTime: trimmedValue };
                break;
            case 'custom-task-complete-at':
                task.taskCompleteAt = __tmNormalizeTaskCompleteAtValue(trimmedValue);
                task.task_complete_at = task.taskCompleteAt;
                metaPatch = { taskCompleteAt: task.taskCompleteAt };
                break;
            case 'custom-duration':
                task.duration = trimmedValue;
                metaPatch = { duration: trimmedValue };
                break;
            case __tmGetTomatoEstimateAttrKey():
            case 'custom-tomato-estimate-count': {
                const normalized = __tmNormalizeTomatoCountValue(trimmedValue);
                task.tomatoEstimateCount = normalized;
                task.tomato_estimate_count = normalized;
                metaPatch = { tomatoEstimateCount: normalized };
                break;
            }
            case __tmGetTomatoCountAttrKey():
            case 'custom-tomato-count': {
                const normalized = __tmNormalizeTomatoCountValue(trimmedValue);
                task.tomatoCount = normalized;
                task.tomato_count = normalized;
                metaPatch = { tomatoCount: normalized };
                break;
            }
            case __tmGetTomatoSpentMinutesAttrKey(): {
                task.tomatoMinutes = trimmedValue;
                task.tomato_minutes = trimmedValue;
                metaPatch = { tomatoMinutes: trimmedValue };
                break;
            }
            case __tmGetTomatoSpentHoursAttrKey(): {
                task.tomatoHours = trimmedValue;
                task.tomato_hours = trimmedValue;
                metaPatch = { tomatoHours: trimmedValue };
                break;
            }
            case 'custom-remark':
                task.remark = rawValue;
                metaPatch = { remark: rawValue };
                break;
            default:
                if (__tmIsTaskAttachmentAttrKey(key)) {
                    const nextPaths = (() => {
                        const currentPaths = __tmGetTaskAttachmentPaths(task);
                        const index = __tmGetTaskAttachmentAttrIndex(key);
                        const paths = currentPaths.slice();
                        while (paths.length <= index) paths.push('');
                        paths[index] = __tmNormalizeTaskAttachmentPath(rawValue);
                        return __tmNormalizeTaskAttachmentPaths(paths);
                    })();
                    __tmApplyTaskAttachmentPathsToTask(task, nextPaths, { attrsLoaded: true });
                    metaPatch = { attachments: nextPaths };
                    break;
                }
                {
                    const field = __tmGetCustomFieldDefByAttrStorageKey(key);
                    const fieldId = String(field?.id || '').trim();
                    if (!field || !fieldId) return finish(false, 'unsupported-field');
                    const normalizedValue = __tmNormalizeCustomFieldValue(field, rawValue);
                    __tmApplyTaskCustomFieldValueLocally(task, field, normalizedValue);
                    metaPatch = { customFieldValues: { [fieldId]: normalizedValue } };
                }
                break;
            case __TM_TASK_REPEAT_RULE_ATTR:
                task.repeatRule = __tmNormalizeTaskRepeatRule(rawValue, {
                    startDate: task?.startDate,
                    completionTime: task?.completionTime,
                });
                task.repeat_rule = task.repeatRule;
                task[__TM_TASK_REPEAT_RULE_ATTR] = rawValue;
                metaPatch = { repeatRule: task.repeatRule };
                break;
            case __TM_TASK_REPEAT_STATE_ATTR:
                task.repeatState = __tmNormalizeTaskRepeatState(rawValue);
                task.repeat_state = task.repeatState;
                task[__TM_TASK_REPEAT_STATE_ATTR] = rawValue;
                metaPatch = { repeatState: task.repeatState };
                break;
            case __TM_TASK_REPEAT_HISTORY_ATTR:
                task.repeatHistory = __tmNormalizeTaskRepeatHistory(rawValue);
                task.repeat_history = task.repeatHistory;
                task[__TM_TASK_REPEAT_HISTORY_ATTR] = rawValue;
                metaPatch = { repeatHistory: task.repeatHistory };
                break;
            case 'custom-pinned':
                {
                    const pin = trimmedValue === '1' || trimmedValue.toLowerCase() === 'true';
                    task.pinned = pin;
                    task.custom_pinned = pin ? '1' : '';
                    metaPatch = { pinned: pin ? '1' : '' };
                }
                break;
            case 'custom-all-day-bottom':
                {
                    const bottom = trimmedValue === '1' || trimmedValue.toLowerCase() === 'true';
                    task.allDayBottom = bottom;
                    task.custom_all_day_bottom = bottom ? '1' : '';
                    metaPatch = { allDayBottom: bottom ? '1' : '' };
                }
                break;
            case 'custom-milestone-event':
                {
                    const milestone = trimmedValue === '1' || trimmedValue.toLowerCase() === 'true';
                    task.milestone = milestone;
                    task.custom_milestone = milestone ? '1' : '';
                    metaPatch = { milestone };
                }
                break;
        }
        }

        try {
            __tmCacheTaskInState(task, {
                docNameFallback: task.doc_name || task.docName || '未命名文档'
            });
        } catch (e) {}
        try {
            if (metaPatch && typeof metaPatch === 'object') MetaStore.set(tid, metaPatch);
        } catch (e) {}
        if (isCustomFieldAttr) {
        }
        return finish(true, 'applied');
    }

    async function __tmEnsureTaskInStateById(id) {
        const tid = String(id || '').trim();
        if (!tid) return null;
        const exists = globalThis.__tmTaskBoundary?.getTask?.(tid) || null;
        if (exists) return exists;
        let row = null;
        try { row = await API.getTaskById(tid); } catch (e) { row = null; }
        if (!row || typeof row !== 'object') return null;
        const task = { ...row };
        try {
            const parsed = API.parseTaskStatus(task.markdown);
            task.done = !!parsed.done;
            task.content = parsed.content;
        } catch (e) {}
        return __tmCacheTaskInState(task, {
            docNameFallback: task.doc_name || task.docName || '未命名文档'
        });
    }

    function __tmGetTaskAttrHostId(task) {
        return String(task?.attrHostId || task?.attr_host_id || task?.id || '').trim();
    }

    function __tmResolveLocalTaskBindingFromAnyBlockId(id) {
        const bid = String(id || '').trim();
        if (!bid) return null;
        const direct = globalThis.__tmTaskBoundary?.getTask?.(bid) || null;
        if (direct && typeof direct === 'object') {
            const taskId = String(direct?.id || bid).trim();
            return {
                taskId: taskId || bid,
                attrHostId: taskId || bid,
                task: direct,
                matchedBy: 'id',
            };
        }
        return null;
    }

    async function __tmResolveTaskBindingFromAnyBlockId(id, options = {}) {
        const bid = String(id || '').trim();
        if (!bid) return null;
        const opts = (options && typeof options === 'object') ? options : {};
        const localBinding = opts.preferLocal === false ? null : __tmResolveLocalTaskBindingFromAnyBlockId(bid);
        if (localBinding) {
            const localTask = (localBinding.task && typeof localBinding.task === 'object') ? localBinding.task : null;
            const taskId = String(localBinding.taskId || '').trim() || bid;
            return {
                taskId,
                attrHostId: taskId,
                task: localTask,
            };
        }
        const direct = await API.getTaskById(bid).catch(() => null);
        if (direct && typeof direct === 'object') {
            const taskId = String(direct.id || bid).trim();
            return {
                taskId,
                attrHostId: taskId,
                task: direct,
            };
        }

        const readBlockRow = async (blockId) => {
            try {
                const rows = await API.getBlocksByIds([blockId]);
                return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
            } catch (e) {
                return null;
            }
        };

        let cur = bid;
        for (let depth = 0; depth < 30; depth++) {
            const row = await readBlockRow(cur);
            if (!row || typeof row !== 'object') return null;
            const type = String(row.type || '').trim().toLowerCase();
            const subtype = String(row.subtype || '').trim().toLowerCase();
            const rowId = String(row.id || cur).trim();
            if (type === 'i' && subtype === 't') {
                return { taskId: rowId, attrHostId: rowId, task: null };
            }
            if (type === 'l') {
                let taskIds = [];
                try { taskIds = await API.getTaskIdsInList(rowId); } catch (e) { taskIds = []; }
                if (taskIds.length >= 1) {
                    const taskId = String(taskIds[0] || '').trim();
                    if (taskId) return { taskId, attrHostId: taskId, task: null };
                }
            }
            const parentId = String(row.parent_id || '').trim();
            if (!parentId || parentId === cur) return null;
            cur = parentId;
        }
        return null;
    }

    async function __tmResolveTaskAttrHostIdFromAnyBlockId(id) {
        const resolved = await __tmResolveTaskBindingFromAnyBlockId(id);
        return String(resolved?.attrHostId || '').trim();
    }

    async function __tmResolveTaskIdFromAnyBlockId(id, options = {}) {
        const resolved = await __tmResolveTaskBindingFromAnyBlockId(id, options);
        return String(resolved?.taskId || '').trim();
    }

    async function __tmBuildTaskLikeFromBlockId(id) {
        const bid = String(id || '').trim();
        if (!bid) return null;
        let resolvedTaskId = '';
        let attrHostId = '';
        try {
            const binding = await __tmResolveTaskBindingFromAnyBlockId(bid);
            resolvedTaskId = String(binding?.taskId || '').trim();
            attrHostId = String(binding?.attrHostId || '').trim();
        } catch (e) {}
        const sourceId = resolvedTaskId || bid;
        const attrsId = attrHostId || sourceId;
        let km = '';
        try { km = await API.getBlockKramdown(sourceId); } catch (e) { km = ''; }
        let parsed = { done: false, content: '' };
        try { parsed = API.parseTaskStatus(km || ''); } catch (e) {}
        const cleanTaskContent = (value) => {
            let text = String(value || '').trim();
            try {
                if (typeof API?.extractTaskContentLine === 'function') {
                    text = String(API.extractTaskContentLine(text) || text).trim();
                }
            } catch (e) {}
            try {
                if (typeof API?.normalizeTaskContent === 'function') {
                    text = String(API.normalizeTaskContent(text) || text).trim();
                }
            } catch (e) {}
            text = text
                .replace(/^\s*(?:[-*+]|\d+[.)])\s*\[[^\]]*\]\s*/, '')
                .replace(/\s*\{:\s*[^}]*\}\s*$/g, '')
                .trim();
            return text;
        };
        const contentText = cleanTaskContent(parsed?.content || km || '');
        let attrs = {};
        const readAttrs = async (blockId) => {
            const targetId = String(blockId || '').trim();
            if (!targetId) return {};
            try {
                const res = await API.call('/api/attr/getBlockAttrs', { id: targetId });
                if (res && res.code === 0 && res.data && typeof res.data === 'object') return res.data;
            } catch (e) {}
            return {};
        };
        try {
            const hostAttrs = await readAttrs(attrsId);
            const taskAttrs = attrsId && attrsId !== sourceId ? await readAttrs(sourceId) : hostAttrs;
            attrs = { ...taskAttrs, ...hostAttrs };
            ['startDate', 'completionTime', 'customTime'].forEach((field) => {
                const entry = typeof __tmReadTaskMetaAttrEntry === 'function'
                    ? __tmReadTaskMetaAttrEntry(taskAttrs, field)
                    : { found: false };
                const taskValue = String(entry?.value ?? '').trim();
                if (entry?.found && taskValue) attrs[entry.key] = entry.value;
            });
        } catch (e) {}
        let blockRow = null;
        try {
            const safeId = sourceId.replace(/'/g, "''");
            const res = await API.call('/api/query/sql', {
                stmt: `SELECT b.root_id, b.parent_id, b.path, b.sort, b.created, b.updated, doc.content AS doc_name, doc.hpath AS doc_path FROM blocks b LEFT JOIN blocks doc ON doc.id = b.root_id WHERE b.id = '${safeId}' LIMIT 1`
            });
            blockRow = (res && res.code === 0 && Array.isArray(res.data)) ? res.data[0] : null;
        } catch (e) {}
        const docName = String(blockRow?.doc_name || '').trim() || '当前块';
        const tomatoEstimateAttrKey = typeof __tmGetTomatoEstimateAttrKey === 'function' ? __tmGetTomatoEstimateAttrKey() : 'custom-tomato-estimate-count';
        const tomatoCountAttrKey = typeof __tmGetTomatoCountAttrKey === 'function' ? __tmGetTomatoCountAttrKey() : 'custom-tomato-count';
        const tomatoEstimateValue = __tmNormalizeTomatoCountValue(attrs[tomatoEstimateAttrKey] || attrs['custom-tomato-estimate-count'] || '');
        const tomatoCountValue = __tmNormalizeTomatoCountValue(attrs[tomatoCountAttrKey] || attrs['custom-tomato-count'] || '');
        const readMeta = (field) => typeof __tmReadTaskMetaAttrValue === 'function'
            ? __tmReadTaskMetaAttrValue(attrs, field)
            : '';
        const priorityValue = String(readMeta('priority')).trim();
        const durationValue = String(readMeta('duration')).trim();
        const remarkValue = __tmNormalizeRemarkMarkdown(readMeta('remark') || '');
        const startDateValue = String(readMeta('startDate')).trim();
        const completionTimeValue = String(readMeta('completionTime')).trim();
        const taskCompleteAtValue = String(readMeta('taskCompleteAt')).trim();
        const customStatusValue = String(readMeta('customStatus')).trim();
        const pinnedValue = String(readMeta('pinned')).trim();
        const allDayBottomValue = String(readMeta('allDayBottom')).trim();
        const milestoneValue = String(readMeta('milestone')).trim();
        const customTimeValue = String(readMeta('customTime')).trim();
        const row = {
            id: sourceId,
            markdown: km || '',
            raw_content: contentText || '(无内容)',
            content: contentText || '(无内容)',
            done: !!parsed?.done,
            priority: priorityValue,
            duration: durationValue,
            tomatoEstimateCount: tomatoEstimateValue,
            tomato_estimate_count: tomatoEstimateValue,
            tomatoCount: tomatoCountValue,
            tomato_count: tomatoCountValue,
            remark: remarkValue,
            startDate: startDateValue,
            start_date: startDateValue,
            completionTime: completionTimeValue,
            completion_time: completionTimeValue,
            taskCompleteAt: taskCompleteAtValue,
            task_complete_at: taskCompleteAtValue,
            customStatus: customStatusValue,
            custom_status: customStatusValue,
            pinned: pinnedValue,
            allDayBottom: allDayBottomValue,
            custom_all_day_bottom: allDayBottomValue,
            milestone: milestoneValue,
            custom_time: customTimeValue,
            customTime: customTimeValue,
            attrHostId: attrsId,
            attr_host_id: attrsId,
            parent_id: String(blockRow?.parent_id || '').trim(),
            parent_task_id: '',
            root_id: String(blockRow?.root_id || '').trim(),
            doc_name: docName,
            doc_path: String(blockRow?.doc_path || '').trim(),
            block_path: String(blockRow?.path || '').trim(),
            block_sort: String(blockRow?.sort ?? '').trim(),
            created: String(blockRow?.created || '').trim(),
            updated: String(blockRow?.updated || '').trim(),
        };
        try { normalizeTaskFields(row, docName); } catch (e) {}
        if (__tmShouldLogStatusDebug([bid, sourceId, attrsId], false)) {
            __tmPushStatusDebug('build-task-like', {
                blockId: bid,
                sourceId,
                attrHostId: attrsId,
                customStatus: String(row.customStatus || '').trim(),
                done: !!row.done,
                parentId: String(row.parent_id || '').trim(),
            }, [bid, sourceId, attrsId], { force: false });
        }
        return row;
    }

    async function __tmHydrateChecklistVisibleDateAttrs(tasks, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        if (!opts.force && !(globalThis.__tmRuntimeState?.isViewMode?.('checklist') ?? (String(state.viewMode || '').trim() === 'checklist'))) return { changed: false, changedCount: 0 };
        const list = Array.isArray(tasks) ? tasks.filter((task) => task && typeof task === 'object') : [];
        if (!list.length) return { changed: false, changedCount: 0 };
        const visibleDateKeys = [
            { field: 'startDate', camel: 'startDate', snake: 'start_date' },
            { field: 'completionTime', camel: 'completionTime', snake: 'completion_time' },
            { field: 'customTime', camel: 'customTime', snake: 'custom_time' },
        ];
        const blockIds = [];
        list.forEach((task) => {
            const taskId = String(task?.id || '').trim();
            const hostId = String(task?.attrHostId || task?.attr_host_id || '').trim();
            if (taskId) blockIds.push(taskId);
            if (hostId && hostId !== taskId) blockIds.push(hostId);
        });
        const rows = await __tmQueryTaskMetaAttrRowsByBlockIds(blockIds);
        if (!Array.isArray(rows) || !rows.length) {
            return { changed: false, changedCount: 0 };
        }
        const rowMap = new Map();
        rows.forEach((row) => {
            const blockId = String(row?.block_id || '').trim();
            const name = String(row?.name || '').trim();
            if (!blockId || !name) return;
            if (!rowMap.has(blockId)) rowMap.set(blockId, {});
            rowMap.get(blockId)[name] = String(row?.value ?? '');
        });
        let changedCount = 0;
        list.forEach((task) => {
            const taskId = String(task?.id || '').trim();
            if (!taskId) return;
            const hostId = String(task?.attrHostId || task?.attr_host_id || taskId).trim() || taskId;
            const taskRow = rowMap.get(taskId) || null;
            const hostRow = hostId && hostId !== taskId ? rowMap.get(hostId) || null : null;
            let patch = null;
            visibleDateKeys.forEach((item) => {
                const taskValue = typeof __tmReadTaskMetaAttrValue === 'function'
                    ? String(__tmReadTaskMetaAttrValue(taskRow, item.field) || '').trim()
                    : '';
                const hostValue = typeof __tmReadTaskMetaAttrValue === 'function'
                    ? String(__tmReadTaskMetaAttrValue(hostRow, item.field) || '').trim()
                    : '';
                const value = taskValue || hostValue;
                if (!value) return;
                if (String(task?.[item.camel] || '').trim() === value && String(task?.[item.snake] || '').trim() === value) return;
                task[item.camel] = value;
                task[item.snake] = value;
                const flatTask = state.flatTasks?.[taskId];
                if (flatTask && typeof flatTask === 'object') {
                    flatTask[item.camel] = value;
                    flatTask[item.snake] = value;
                }
                if (!patch) patch = {};
                patch[item.camel] = value;
            });
            if (patch && Object.keys(patch).length) {
                changedCount += 1;
                try { MetaStore.set(taskId, patch); } catch (e) {}
            }
        });
        return { changed: changedCount > 0, changedCount };
    }

    async function __tmSetDoneByIdStateless(id, done) {
        const tid = String(id || '').trim();
        if (!tid) return false;
        const targetDone = !!done;
        let kramdown = '';
        try { kramdown = await API.getBlockKramdown(tid); } catch (e) { kramdown = ''; }
        if (!kramdown) return false;
        let nextMd = '';
        let wasDone = false;
        let previousMarker = ' ';
        const fallbackRegex = /(\[)([^\]]?)(\])/;
        const prefixMatch = typeof __tmGetTaskListItemMarkerPrefixMatch === 'function'
            ? __tmGetTaskListItemMarkerPrefixMatch(kramdown)
            : null;
        if (prefixMatch) {
            previousMarker = __tmNormalizeTaskStatusMarker(prefixMatch?.[3], ' ');
            wasDone = __tmIsTaskMarkerDone(previousMarker);
            nextMd = typeof __tmNormalizeTaskListItemMarkdownMarker === 'function'
                ? __tmNormalizeTaskListItemMarkdownMarker(kramdown, targetDone ? 'X' : ' ')
                : '';
            if (!nextMd) {
                const statusRegex = /^(\s*(?:[\*\-]|\d+\.)\s*\[)([^\]]?)(\])/;
                nextMd = kramdown.replace(statusRegex, `$1${targetDone ? 'X' : ' '}$3`);
            }
        } else if (fallbackRegex.test(kramdown)) {
            const match = kramdown.match(fallbackRegex);
            previousMarker = __tmNormalizeTaskStatusMarker(match?.[2], ' ');
            wasDone = __tmIsTaskMarkerDone(previousMarker);
            nextMd = kramdown.replace(fallbackRegex, `$1${targetDone ? 'X' : ' '}$3`);
        } else {
            return false;
        }
        const changedToDone = targetDone && !wasDone;
        if (nextMd === kramdown) return { ok: true, changed: false, changedToDone, previousDone: wasDone, previousMarker };
        try {
            try {
                const task0 = globalThis.__tmTaskBoundary?.getTask?.(tid) || null;
                __tmMarkLocalDoneTxSuppressionForTask(task0, [tid]);
                if (typeof __tmProtectMarkdownMutationTaskFields === 'function') {
                    __tmProtectMarkdownMutationTaskFields(tid, task0, { source: 'set-done-stateless' });
                }
            } catch (e) {}
            await __tmUpdateTaskListItemMarkerWithFallback(tid, targetDone ? 'X' : ' ');
            return { ok: true, changed: true, changedToDone, previousDone: wasDone, previousMarker };
        } catch (e) {
            return false;
        }
    }

    // 更新 markdown 中的完成状态
    function updateDoneInMarkdown(markdown, done) {
        if (!markdown) return '- [ ] ';
        // 匹配列表项开头
        if (typeof __tmNormalizeTaskListItemMarkdownMarker === 'function') {
            const next = __tmNormalizeTaskListItemMarkdownMarker(markdown, done ? 'x' : ' ');
            if (next) return next;
        }
        return markdown.replace(/^(\s*[\*\-]\s*)\[[^\]]?\]/, `$1[${done ? 'x' : ' '}]`);
    }

    function __tmRemapTaskId(oldId, newId) {
        try {
            if (!oldId || !newId || oldId === newId) return;
            const flatTask = state.flatTasks?.[oldId] || null;
            const pendingTask = state.pendingInsertedTasks?.[oldId] || null;
            const existingNewTask = state.flatTasks?.[newId] || state.pendingInsertedTasks?.[newId] || null;
            const remapPendingDelete = () => {
                try {
                    const deletedStore = state.pendingDeletedTasks;
                    if (deletedStore && typeof deletedStore === 'object' && deletedStore[oldId]) {
                        deletedStore[newId] = {
                            ...deletedStore[oldId],
                            taskId: newId,
                            expiresAt: Math.max(Number(deletedStore[oldId]?.expiresAt) || 0, Date.now() + 45000),
                        };
                        delete deletedStore[oldId];
                    }
                } catch (e) {}
            };
            if (!flatTask && !pendingTask && !existingNewTask) {
                remapPendingDelete();
                return;
            }
            const task = {
                ...((flatTask && typeof flatTask === 'object') ? flatTask : {}),
                ...((existingNewTask && typeof existingNewTask === 'object') ? existingNewTask : {}),
                ...((pendingTask && typeof pendingTask === 'object') ? pendingTask : {}),
                id: newId,
            };
            if (!Object.keys(task).length || !String(task.id || '').trim()) return;
            const mergedChildren = (() => {
                const pendingChildren = Array.isArray(pendingTask?.children) ? pendingTask.children : [];
                const flatChildren = Array.isArray(flatTask?.children) ? flatTask.children : [];
                const existingChildren = Array.isArray(existingNewTask?.children) ? existingNewTask.children : [];
                const seen = new Set();
                const out = [];
                [pendingChildren, flatChildren, existingChildren].forEach((list) => {
                    list.forEach((child) => {
                        const childId = String(child?.id || '').trim();
                        if (!child || !childId || seen.has(childId)) return;
                        seen.add(childId);
                        out.push(child);
                    });
                });
                return out;
            })();
            if (mergedChildren.length) task.children = mergedChildren;
            const remapExpiresAt = Math.max(Number(pendingTask?.expiresAt) || 0, Date.now() + 45000);
            let remapped = false;
            try {
                remapped = !!globalThis.__tmTaskStore?.remapLocalId?.(oldId, newId, {
                    blockId: newId,
                    keepPending: true,
                });
                if (remapped) {
                    globalThis.__tmTaskStore?.upsertLocal?.(task, {
                        pending: true,
                        expiresAt: remapExpiresAt,
                        blockId: newId,
                        status: 'remap-task-id',
                    });
                }
            } catch (e) {}
            if (!remapped) return;
            try { MetaStore.remapId(oldId, newId); } catch (e) {}
            remapPendingDelete();
            const remapParentLink = (item) => {
                if (!(item && typeof item === 'object')) return;
                if (String(item.parentTaskId || '').trim() === oldId) {
                    item.parentTaskId = newId;
                    item.parent_task_id = newId;
                }
                if (String(item.parent_task_id || '').trim() === oldId) {
                    item.parent_task_id = newId;
                    item.parentTaskId = newId;
                }
            };

            const updateRecursive = (list) => {
                (Array.isArray(list) ? list : []).forEach(t => {
                    if (!(t && typeof t === 'object')) return;
                    if (String(t.id || '').trim() === oldId) {
                        t.id = newId;
                        Object.assign(t, task, {
                            id: newId,
                            children: Array.isArray(t.children) && t.children.length
                                ? t.children
                                : (Array.isArray(task.children) ? task.children : []),
                        });
                    }
                    remapParentLink(t);
                    if (t.children && t.children.length > 0) updateRecursive(t.children);
                });
            };

            state.taskTree.forEach(doc => {
                updateRecursive(doc.tasks);
            });
            try {
                Object.values(state.flatTasks || {}).forEach(remapParentLink);
                Object.values(state.pendingInsertedTasks || {}).forEach(remapParentLink);
                updateRecursive(state.filteredTasks);
            } catch (e) {}
            try { __tmInvalidateFilteredTaskDerivedStateCache(); } catch (e) {}
        } catch (e) {}
    }

    // ============ 重写设置完成状态（带完整树保护） ============
    window.tmSetPinned = async function(id, pinned, ev) {
        if (ev) ev.stopPropagation();

        const tid = String(id || '').trim();
        const task = globalThis.__tmTaskBoundary?.getTask?.(tid) || null;
        if (!task) return;

        const val = !!pinned;
        const patchTask = globalThis.__tmRequireTaskMutation?.('patchTask');
        if (typeof patchTask !== 'function') {
            const error = new Error('任务写入队列未就绪: patchTask');
            if (ev?.target) ev.target.checked = !val;
            hint(`❌ 操作失败: ${error.message}`, 'error');
            return false;
        }
        const commitPromise = patchTask(tid, { pinned: val ? '1' : '' }, {
            source: 'toggle-pinned',
            label: val ? '置顶' : '取消置顶',
            background: true,
            wait: false,
            skipInteractionGate: true,
            showErrorHint: false,
        });
        Promise.resolve(commitPromise).then((result) => {
            if (result === false && ev?.target) ev.target.checked = !val;
            if (result === false) hint('❌ 操作失败', 'error');
        }).catch((e) => {
            if (ev?.target) ev.target.checked = !val;
            hint(`❌ 操作失败: ${e.message}`, 'error');
        });
        return true;
    };

    window.tmSetTaskAllDayBottom = async function(id, bottom, ev) {
        if (ev) ev.stopPropagation();

        const rawId = String(id || '').trim();
        if (!rawId) return false;
        let task = globalThis.__tmTaskBoundary?.getTask?.(rawId, { includePending: false, preferPending: false }) || null;
        let persistId = rawId;
        if (!task) {
            try {
                const resolvedId = await __tmResolveTaskIdFromAnyBlockId(rawId);
                if (resolvedId) persistId = String(resolvedId || '').trim() || rawId;
            } catch (e) {}
        }
        if (!task && persistId !== rawId) {
            task = globalThis.__tmTaskBoundary?.getTask?.(persistId, { includePending: false, preferPending: false }) || null;
        }
        if (!task) {
            try { task = await __tmEnsureTaskInStateById(persistId); } catch (e) { task = null; }
        }
        if (!task && persistId !== rawId) {
            try { task = await __tmBuildTaskLikeFromBlockId(persistId); } catch (e) { task = null; }
        }
        if (!task) {
            try { task = await __tmBuildTaskLikeFromBlockId(rawId); } catch (e) { task = null; }
        }
        persistId = String(task?.id || persistId || rawId).trim();
        if (!persistId) return false;
        try {
            if (task && typeof task === 'object' && !globalThis.__tmTaskBoundary?.getTask?.(persistId, { includePending: false, preferPending: false })) {
                __tmCacheTaskInState(task, {
                    docNameFallback: task.doc_name || task.docName || '未命名文档',
                });
            }
        } catch (e) {}

        const val = !!bottom;
        const patch = { allDayBottom: val ? '1' : '' };
        const opts = {
            source: 'toggle-all-day-bottom',
            label: val ? '置底全天日程' : '取消置底全天日程',
        };
        const apply = () => {
            const patchTask = globalThis.__tmRequireTaskMutation?.('patchTask');
            if (typeof patchTask !== 'function') throw new Error('任务写入队列未就绪: patchTask');
            return patchTask(persistId, patch, opts);
        };
        try {
            const ok = await apply();
            hint(`✅ ${val ? '已置底全天日程' : '已取消置底全天日程'}`, 'success');
            return ok !== false;
        } catch (e) {
            hint(`❌ 操作失败: ${e?.message || String(e)}`, 'error');
            return false;
        }
    };

    function __tmRunSetDonePostCommitEffects(taskId, options = {}) {
        const tid = String(taskId || '').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        const targetDone = opts.done === true;
        if (!tid) return false;
        const latestTask = globalThis.__tmTaskBoundary?.getTask?.(tid)
            || ((opts.task && typeof opts.task === 'object') ? opts.task : null);
        if (!targetDone) {
            try { __tmClearRecurringTaskAdvanceTimer(tid); } catch (e) {}
            if (opts.previousDone === true) {
                try {
                    globalThis.__tmTaskLifecycle?.notifyCompletion?.(tid, false, {
                        task: latestTask,
                        previousDone: true,
                        source: String(opts.source || 'set-done').trim() || 'set-done',
                    });
                } catch (e) {}
            }
            if (opts.skipAutoCompleteParent !== true) {
                try {
                    void __tmSyncParentDoneStateFromSubtasks(tid, {
                        ...opts,
                        done: false,
                    }).catch(() => null);
                } catch (e) {}
            }
            return false;
        }
        if (opts.previousDone === true) return false;
        const completedAt = __tmNormalizeTaskCompleteAtValue(
            opts.completedAt
            || latestTask?.taskCompleteAt
            || latestTask?.task_complete_at
            || '',
        );
        let recurringScheduled = false;
        if (completedAt) {
            try {
                const fsrsRating = typeof __tmNormalizeFsrsRating === 'function'
                    ? __tmNormalizeFsrsRating(opts.fsrsRating)
                    : 0;
                let shouldSchedule = !latestTask;
                if (latestTask) {
                    const repeatRule = __tmGetTaskRepeatRule(latestTask);
                    shouldSchedule = repeatRule.type === 'fsrs'
                        ? fsrsRating >= 2
                        : !!__tmBuildTaskRepeatAdvancePatch(latestTask, repeatRule, { completedAt });
                }
                if (shouldSchedule) {
                    __tmScheduleRecurringTaskAdvanceAfterCompletion(tid, {
                        source: opts.source,
                        completedAt,
                        scheduleId: String(opts.scheduleId || '').trim(),
                        fsrsRating,
                        expectAdvance: true,
                    });
                    recurringScheduled = true;
                }
            } catch (e) {}
        }
        if (opts.delight !== false) {
            try { __tmQueueTaskDoneDelight(tid, { done: true, suppressHint: opts.suppressHint, source: opts.source }); } catch (e) {}
        }
        if (!recurringScheduled) {
            try {
                void Promise.resolve(__tmSettleTomatoAfterTaskDone(tid, {
                    task: latestTask,
                    attrHostId: String(opts.attrHostId || __tmGetTaskAttrHostId(latestTask) || tid).trim() || tid,
                    source: String(opts.source || 'set-done').trim() || 'set-done',
                })).catch(() => null);
            } catch (e) {}
        }
        const rewardPriorityScore = Math.max(0, Math.round(Number(opts.rewardPriorityScore) || 0));
        if (rewardPriorityScore > 0) {
            try {
                __tmDispatchTaskCompletedForReward(latestTask, {
                    taskId: tid,
                    attrHostId: String(opts.attrHostId || __tmGetTaskAttrHostId(latestTask) || tid).trim() || tid,
                    priorityScore: rewardPriorityScore,
                    completedAt,
                    source: String(opts.source || 'set-done').trim() || 'set-done',
                    previousDone: false,
                    nextDone: true,
                });
            } catch (e) {}
        }
        if (opts.skipAutoCompleteParent !== true) {
            try {
                void __tmSyncParentDoneStateFromSubtasks(tid, {
                    ...opts,
                    done: true,
                }).catch(() => null);
            } catch (e) {}
        }
        try {
            globalThis.__tmTaskLifecycle?.notifyCompletion?.(tid, true, {
                task: latestTask,
                previousDone: false,
                source: String(opts.source || 'set-done').trim() || 'set-done',
            });
        } catch (e) {}
        return recurringScheduled;
    }

    try { globalThis.__tmRunSetDonePostCommitEffects = __tmRunSetDonePostCommitEffects; } catch (e) {}

    async function __tmRunCommittedSetDoneEffects(taskId, options = {}) {
        const tid = String(taskId || '').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        if (!tid) throw new Error('完成后的关联处理缺少任务 ID');
        let latestTask = globalThis.__tmTaskBoundary?.getTask?.(tid) || null;
        const followUpOps = [];
        const effectId = String(opts.effectId || tid).trim() || tid;
        const targetDone = opts.done === true;
        if (!targetDone) {
            try { __tmClearRecurringTaskAdvanceTimer(tid); } catch (e) {}
            if (opts.skipAutoCompleteParent !== true) {
                const parentDefinition = await __tmSyncParentDoneStateFromSubtasks(tid, {
                    ...opts,
                    done: false,
                    source: String(opts.source || 'set-done-effects').trim() || 'set-done-effects',
                    returnMutationDefinition: true,
                });
                if (parentDefinition && typeof parentDefinition === 'object') followUpOps.push(parentDefinition);
            }
            if (opts.previousDone === true) {
                followUpOps.push({
                    id: `${effectId}:lifecycle:restore-completed`,
                    type: 'taskLifecycle',
                    docId: String(latestTask?.root_id || latestTask?.docId || '').trim(),
                    laneKey: `task:${tid}`,
                    data: {
                        action: 'restoreCompleted',
                        taskId: tid,
                        source: String(opts.source || 'set-done-effects').trim() || 'set-done-effects',
                    },
                });
            }
            return { completed: true, recurringAdvanced: false, rewardDispatched: false, followUpOps };
        }
        if (opts.previousDone === true) {
            return { completed: true, recurringAdvanced: false, rewardDispatched: false, followUpOps };
        }

        let completedAt = __tmNormalizeTaskCompleteAtValue(
            opts.completedAt
            || latestTask?.taskCompleteAt
            || latestTask?.task_complete_at
            || '',
        );
        const rewardPriorityScore = Math.max(0, Math.round(Number(opts.rewardPriorityScore) || 0));
        let rewardDispatched = false;
        if (rewardPriorityScore > 0) {
            rewardDispatched = __tmDispatchTaskCompletedForReward(latestTask, {
                taskId: tid,
                attrHostId: String(__tmGetTaskAttrHostId(latestTask) || tid).trim() || tid,
                priorityScore: rewardPriorityScore,
                completedAt,
                source: String(opts.source || 'set-done-effects').trim() || 'set-done-effects',
                previousDone: false,
                nextDone: true,
                idempotencyKey: `${effectId}:reward`,
            }) === true;
        }

        // SQL indexing can lag behind the acknowledged block write. Use it only
        // to enrich effect metadata and keep the committed transition authoritative.
        let persistedTask = null;
        try { persistedTask = await API.getTaskById(tid); } catch (e) {}
        if (persistedTask && typeof persistedTask === 'object') {
            latestTask = {
                ...((latestTask && typeof latestTask === 'object') ? latestTask : {}),
                ...persistedTask,
            };
            if (Object.prototype.hasOwnProperty.call(persistedTask, 'repeat_rule')) latestTask.repeatRule = persistedTask.repeat_rule;
            if (Object.prototype.hasOwnProperty.call(persistedTask, 'repeat_state')) latestTask.repeatState = persistedTask.repeat_state;
            if (Object.prototype.hasOwnProperty.call(persistedTask, 'repeat_history')) latestTask.repeatHistory = persistedTask.repeat_history;
            try { normalizeTaskFields(latestTask, String(latestTask.doc_name || latestTask.docName || '').trim()); } catch (e) {}
        }
        if (!latestTask || typeof latestTask !== 'object') latestTask = { id: tid };
        if (!completedAt) {
            completedAt = __tmNormalizeTaskCompleteAtValue(
                latestTask.taskCompleteAt || latestTask.task_complete_at || '',
            );
        }
        latestTask.done = true;
        if (completedAt) {
            latestTask.taskCompleteAt = completedAt;
            latestTask.task_complete_at = completedAt;
        }

        let recurringTask = false;
        let recurringAdvanced = false;
        if (latestTask && completedAt) {
            const repeatRule = __tmGetTaskRepeatRule(latestTask);
            recurringTask = repeatRule?.enabled === true && String(repeatRule.type || 'none').trim() !== 'none';
            if (recurringTask) {
                const advance = globalThis.__tmAdvanceRecurringTaskAfterCompletion;
                if (typeof advance !== 'function') throw new Error('循环任务推进服务未就绪');
                recurringAdvanced = await advance(tid, {
                    source: opts.source,
                    completedAt,
                    scheduleId: String(opts.scheduleId || '').trim(),
                    fsrsRating: Number(opts.fsrsRating) || 0,
                    task: latestTask,
                    suppressHint: true,
                    fromMutationEffect: true,
                }) === true;
            }
        }

        if (!recurringTask) {
            try {
                void Promise.resolve(__tmSettleTomatoAfterTaskDone(tid, {
                    task: latestTask,
                    attrHostId: String(__tmGetTaskAttrHostId(latestTask) || tid).trim() || tid,
                    source: String(opts.source || 'set-done-effects').trim() || 'set-done-effects',
                    effectId: String(opts.effectId || '').trim(),
                })).catch((error) => {
                    try { console.warn('[task-horizon] set-done-tomato-failed', error, { taskId: tid }); } catch (e) {}
                    try {
                        globalThis.__tmReportTaskMutationFailure?.(error, {
                            action: '完成状态已保存，但番茄联动',
                        });
                    } catch (e) {}
                });
            } catch (error) {
                try { console.warn('[task-horizon] set-done-tomato-failed', error, { taskId: tid }); } catch (e) {}
                try {
                    globalThis.__tmReportTaskMutationFailure?.(error, {
                        action: '完成状态已保存，但番茄联动',
                    });
                } catch (e) {}
            }
        }
        if (opts.skipAutoCompleteParent !== true) {
            const parentDefinition = await __tmSyncParentDoneStateFromSubtasks(tid, {
                ...opts,
                done: true,
                source: String(opts.source || 'set-done-effects').trim() || 'set-done-effects',
                returnMutationDefinition: true,
            });
            if (parentDefinition && typeof parentDefinition === 'object') followUpOps.push(parentDefinition);
        }
        if (!recurringTask) {
            const mode = __tmNormalizeTaskCompletionArchiveMode(SettingsStore?.data?.taskCompletionArchiveMode);
            const targetDocId = mode === 'document' ? String(SettingsStore?.data?.taskCompletionArchiveDocId || '').trim() : '';
            if (mode !== 'none' && (mode !== 'document' || targetDocId)) {
                const originDocId = String(latestTask?.root_id || latestTask?.docId || '').trim();
                followUpOps.push({
                    id: `${effectId}:lifecycle:archive-completed`,
                    type: 'taskLifecycle',
                    docId: originDocId,
                    laneKey: `task:${tid}`,
                    data: {
                        action: 'archiveCompleted',
                        taskId: tid,
                        mode,
                        committedDone: true,
                        originDocId,
                        targetDocId,
                        source: String(opts.source || 'set-done-effects').trim() || 'set-done-effects',
                    },
                });
            }
        }
        return { completed: true, recurringAdvanced, rewardDispatched, followUpOps };
    }

    try { globalThis.__tmRunCommittedSetDoneEffects = __tmRunCommittedSetDoneEffects; } catch (e) {}

    async function __tmSetDoneKernel(id, done, ev, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const targetDone = !!done;
        const useLocalRefreshMode = String(opts.refreshMode || '').trim() === 'local'
            || opts.deferProjection === true;
        const useCalendarLocalRefresh = !useLocalRefreshMode && __tmShouldSyncCalendarDoneInPlace(opts.source);
        if (ev) {
            ev.stopPropagation();
        }

        let task = globalThis.__tmTaskBoundary?.getTask?.(id) || null;
        if (!task) {
            try { task = await __tmEnsureTaskInStateById(id); } catch (e) { task = null; }
        }
        if (!task) {
            try { task = await __tmResolveCollectedOtherBlockTaskById(id); } catch (e) { task = null; }
        }
        if (task && __tmIsCollectedOtherBlockTask(task)) {
            const ok = await __tmSetCollectedOtherBlockDone(task, done);
            if (!ok) {
                if (ev?.target) {
                    ev.target.checked = typeof __tmIsTaskDoneEffective === 'function'
                        ? !!__tmIsTaskDoneEffective(task)
                        : !!task.done;
                }
                return;
            }
            if (opts.suppressHint !== true) {
                try { hint(done ? '✅ 已在插件内标记完成' : '✅ 已取消插件内完成', 'success'); } catch (e) {}
            }
            if (targetDone && opts.force !== true) __tmQueueTaskDoneDelight(id, { done: true, suppressHint: opts.suppressHint, source: opts.source });
            if (targetDone) {
                try { await __tmSettleTomatoAfterTaskDone(id, { source: opts.source }); } catch (e) {}
            }
            return;
        }
        const statusPatch = __tmBuildCheckboxStatusPatch(task, targetDone, opts.statusPatch);
        const taskWasDone = Object.prototype.hasOwnProperty.call(opts, 'previousDone')
            ? !!opts.previousDone
            : (typeof __tmIsTaskDoneEffective === 'function' ? !!__tmIsTaskDoneEffective(task) : !!task?.done);
        const hasExplicitTaskCompleteAt = Object.prototype.hasOwnProperty.call(opts, 'taskCompleteAt');
        const shouldStampTaskCompleteAt = !hasExplicitTaskCompleteAt && targetDone && !taskWasDone;
        const shouldClearTaskCompleteAt = !hasExplicitTaskCompleteAt && !targetDone && taskWasDone;
        const completeAtPatch = hasExplicitTaskCompleteAt
            ? { taskCompleteAt: __tmNormalizeTaskCompleteAtValue(opts.taskCompleteAt) }
            : (shouldStampTaskCompleteAt
                ? __tmBuildTaskCompleteAtPatch()
                : (shouldClearTaskCompleteAt ? { taskCompleteAt: '' } : null));
        const additionalPatch = (opts.additionalPatch && typeof opts.additionalPatch === 'object' && !Array.isArray(opts.additionalPatch))
            ? { ...opts.additionalPatch }
            : {};
        delete additionalPatch.done;
        Object.keys(statusPatch || {}).forEach((key) => {
            if (String(statusPatch[key] ?? '').trim()) delete additionalPatch[key];
        });
        const touchPatch = {
            ...((statusPatch && typeof statusPatch === 'object') ? statusPatch : {}),
            ...((completeAtPatch && typeof completeAtPatch === 'object') ? completeAtPatch : {}),
            ...additionalPatch,
        };
        if (!task) {
            const statelessResult = await __tmSetDoneByIdStateless(id, done);
            const ok = statelessResult === true || !!statelessResult?.ok;
            if (ok) {
                if (touchPatch && Object.keys(touchPatch).length > 0) {
                    try {
                        await __tmPersistMetaAndAttrsKernel(String(id || '').trim(), touchPatch, {
                            touchMetaStore: false,
                            skipFlush: false,
                            source: 'set-done-stateless-status',
                        });
                        MetaStore.set(String(id || '').trim(), touchPatch);
                    } catch (statusErr) {
                        try {
                            await __tmUpdateTaskListItemMarkerWithFallback(
                                String(id || '').trim(),
                                __tmNormalizeTaskStatusMarker(statelessResult?.previousMarker, statelessResult?.previousDone ? 'X' : ' '),
                            );
                        } catch (rollbackErr) {}
                        throw statusErr;
                    }
                }
                try {
                    if (!state.doneOverrides || typeof state.doneOverrides !== 'object') state.doneOverrides = {};
                    state.doneOverrides[String(id)] = !!done;
                } catch (e) {}
                try { __tmInvalidateAllSqlCaches(); } catch (e) {}
                if (opts.suppressHint !== true) {
                    try { hint(__tmBuildTaskDoneSuccessHint(!!done, '✅ 任务已完成'), 'success'); } catch (e) {}
                }
                if (opts.deferCompletionEffects !== true) {
                    __tmRunSetDonePostCommitEffects(id, {
                        ...opts,
                        done: targetDone,
                        previousDone: taskWasDone,
                        completedAt: completeAtPatch?.taskCompleteAt || '',
                        delight: opts.force !== true,
                    });
                }
                if (useCalendarLocalRefresh) {
                    try { globalThis.__tmCalendar?.syncTaskDoneInPlace?.(id, !!done, { allowRefetch: true }); } catch (e) {}
                } else if (!useLocalRefreshMode) {
                    try { __tmStageChecklistRenderRestore(__tmCaptureChecklistRenderRestore()); } catch (e) {}
                    try {
                        __tmScheduleViewRefresh({
                            mode: 'current',
                            withFilters: true,
                            reason: 'set-done-stateless',
                        });
                    } catch (e) {
                        try { __tmScheduleRender({ withFilters: true, reason: 'set-done-stateless-fallback' }); } catch (e2) {
                            try { render(); } catch (e3) {}
                        }
                    }
                }
                return true;
            }
            if (opts.suppressHint !== true) hint('❌ 任务不存在', 'error');
            if (ev?.target) ev.target.checked = !done;
            if (opts.force === true) throw new Error('任务不存在');
            return false;
        }
        const detailScrollSnapshot = __tmCaptureChecklistDetailScrollSnapshot();
        const checklistRenderRestoreSnapshot = __tmCaptureChecklistRenderRestore();

        if (taskWasDone === targetDone && opts.force !== true) return;

        const docId = task.root_id;
        const doc = state.taskTree.find(d => d.id === docId);
        let fallbackLocked = false;
        let fallbackTreeSnapshot = null;

        // 关键修改：先保存原始状态，然后保存到 MetaStore（保持原始状态，等点击完成后再更新）
        const originalMarkdown = Object.prototype.hasOwnProperty.call(opts, 'previousMarkdown')
            ? String(opts.previousMarkdown || '')
            : String(task.markdown || '');
        const originalDone = Object.prototype.hasOwnProperty.call(opts, 'previousDone')
            ? !!opts.previousDone
            : taskWasDone;
        const originalMarker = Object.prototype.hasOwnProperty.call(opts, 'previousMarker')
            ? __tmNormalizeTaskStatusMarker(opts.previousMarker, originalDone ? 'X' : ' ')
            : __tmResolveTaskMarker({ ...task, markdown: originalMarkdown });
        const originalCustomStatus = Object.prototype.hasOwnProperty.call(opts, 'previousStatusId')
            ? String(opts.previousStatusId || '').trim()
            : String(task.customStatus || '').trim();
        const originalTaskCompleteAt = __tmNormalizeTaskCompleteAtValue(
            task.taskCompleteAt
            || task.task_complete_at
            || MetaStore.get(id)?.taskCompleteAt
            || '',
        );
        const shouldDispatchTaskReward = !!SettingsStore?.data?.enablePointsRewardIntegration && !originalDone && targetDone && !__tmUndoState?.applying;
        const passedRewardPriorityScore = Number(opts.rewardPriorityScore);
        const taskRewardPriorityScore = shouldDispatchTaskReward && Number.isFinite(passedRewardPriorityScore) && passedRewardPriorityScore > 0
            ? Math.max(0, Math.round(passedRewardPriorityScore))
            : shouldDispatchTaskReward
            ? Math.max(0, Math.round(Number(__tmEnsureTaskPriorityScore(task, { force: true })) || 0))
            : 0;
        const taskRewardAttrHostId = String(__tmGetTaskAttrHostId(task) || id || '').trim();

        // 立即保存当前任务到 MetaStore（保持原始done状态）
        MetaStore.set(id, {
            priority: task.priority || '',
            duration: task.duration || '',
            remark: task.remark || '',
            completionTime: task.completionTime || '',
            customTime: task.customTime || '',
            customStatus: originalCustomStatus,
            done: originalDone,
            content: task.content
        });

        // 注意：不要在这里 render()，因为还没点击复选框
        // render() 会在从DOM读取实际状态后调用
        const markdownRetentionPatch = typeof __tmProtectMarkdownMutationTaskFields === 'function'
            ? __tmProtectMarkdownMutationTaskFields(id, task, { source: String(opts.source || 'set-done-markdown').trim() || 'set-done-markdown' })
            : {};

        try {
            try { __tmMarkLocalDoneTxSuppressionForTask(task, [String(id || '').trim()]); } catch (e) {}
            // 优先尝试 API 更新（解决文档未打开无法操作的问题）
            let apiSuccess = false;
            let markerResult = null;
            let clickSuccess = false;
            try {
                markerResult = await __tmUpdateTaskListItemMarkerWithFallback(id, targetDone ? 'X' : ' ');
                apiSuccess = !!markerResult;
            } catch (e) {}

            // 只有当 API 失败时才尝试查找 DOM（作为回退）
            let taskElement = null;
            if (!apiSuccess) {
                if (GlobalLock.isLocked()) {
                    const waited = opts.force === true ? await __tmWaitForGlobalUnlock(12000) : false;
                    if (!waited) throw new Error('完成状态操作仍在进行中，请稍后重试');
                }
                GlobalLock.lock();
                fallbackLocked = true;
                if (doc?.tasks) {
                    fallbackTreeSnapshot = TreeProtector.capture(doc.tasks);
                }
                // 只允许按块 ID 定位，内容相同不代表是同一个任务。
                taskElement = globalThis.__tmCompat?.findTaskListItemById?.(id) || null;
            }

            if (taskElement) {
                // 找到 protyle-action--task 元素并触发点击
                const actionElement = globalThis.__tmCompat?.findTaskCheckboxAction?.(taskElement) || taskElement.querySelector('.protyle-action--task');
                if (actionElement) {
                    // 使用多种事件触发方式
                    const mouseEvents = ['mousedown', 'mouseup', 'click', 'pointerdown', 'pointerup'];
                    for (const eventType of mouseEvents) {
                        const event = new MouseEvent(eventType, {
                            bubbles: true,
                            cancelable: true,
                            view: window,
                            button: 0
                        });
                        actionElement.dispatchEvent(event);
                    }
                    // 也尝试在列表项元素上触发点击
                    const parentEvent = new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        view: window
                    });
                    taskElement.dispatchEvent(parentEvent);

                    // 关键修复：直接点击真正的 checkbox input 元素并触发 change 事件
                    const checkboxInput = taskElement.querySelector('input[type="checkbox"]');
                    if (checkboxInput) {
                        // 直接修改 checkbox 状态
                        checkboxInput.checked = targetDone;
                        // 触发 change 事件
                        const changeEvent = new Event('change', {
                            bubbles: true,
                            cancelable: true
                        });
                        checkboxInput.dispatchEvent(changeEvent);
                    }

                    clickSuccess = true;
                }
            }

            if (!apiSuccess && !clickSuccess) {
                throw new Error('未能更新任务复选框状态');
            }

            let actualDone = targetDone;
            if (!apiSuccess) {
                await new Promise(r => setTimeout(r, 150));
                const domDoneAfter = __tmReadNativeDocTaskDoneFromDom(id);
                if (domDoneAfter === null) {
                    throw new Error('无法确认任务复选框状态');
                }
                actualDone = !!domDoneAfter;
                if (actualDone !== targetDone) {
                    throw new Error('任务复选框状态未同步成功');
                }
            }

            if (touchPatch && Object.keys(touchPatch).length > 0) {
                try {
                    await __tmPersistMetaAndAttrsKernel(id, touchPatch, {
                        touchMetaStore: false,
                        skipFlush: false,
                        source: String(opts.source || 'set-done-status-link').trim() || 'set-done-status-link',
                    });
                } catch (statusErr) {
                    try { await __tmUpdateTaskListItemMarkerWithFallback(id, originalMarker); } catch (rollbackErr) {}
                    throw statusErr;
                }
            }

            const actualMarker = actualDone ? 'X' : ' ';
            const doneStatePatch = __tmApplyDoneStateToLocalMirrors(
                id,
                task,
                actualDone,
                actualMarker,
                typeof markerResult?.markdown === 'string' ? markerResult.markdown : null,
            );
            if (touchPatch && Object.keys(touchPatch).length > 0) {
                try { __tmApplyQueuedTaskFieldPatchToTask(task, touchPatch); } catch (e) {}
                try { __tmApplyTaskFieldPatchToLocalMirrors(id, touchPatch); } catch (e) {}
            }
            // 保存到MetaStore
            MetaStore.set(id, {
                priority: task.priority || '',
                duration: task.duration || '',
                remark: task.remark || '',
                completionTime: task.completionTime || '',
                customTime: task.customTime || '',
                customStatus: Object.prototype.hasOwnProperty.call(touchPatch || {}, 'customStatus')
                    ? String(touchPatch.customStatus || '').trim()
                    : (task.customStatus || ''),
                done: actualDone,
                content: task.content,
                ...doneStatePatch,
                ...((completeAtPatch && typeof completeAtPatch === 'object') ? completeAtPatch : {}),
            });

            try {
                globalThis.__tmTaskStore?.upsertLocal?.(task, {
                    pending: !!state.pendingInsertedTasks?.[id],
                    expiresAt: state.pendingInsertedTasks?.[id]?.expiresAt || Date.now() + __TM_PENDING_INSERTED_TASK_KEEPALIVE_MS,
                    status: 'set-done-success',
                });
            } catch (e) {}
            if (opts.recordUndo !== false && !__tmUndoState?.applying) {
                const undoPatch = { done: actualDone, ...touchPatch };
                const inversePatch = { done: originalDone };
                Object.assign(inversePatch, (opts.inversePatch && typeof opts.inversePatch === 'object')
                    ? opts.inversePatch
                    : __tmCaptureTaskPatchInverse(id, touchPatch));
                if (Object.prototype.hasOwnProperty.call(touchPatch, 'customStatus')) inversePatch.customStatus = originalCustomStatus;
                if (Object.prototype.hasOwnProperty.call(touchPatch, 'taskCompleteAt')) inversePatch.taskCompleteAt = originalTaskCompleteAt;
                try {
                    __tmPushUndoRecord({
                        type: 'setDone',
                        taskId: String(id || '').trim(),
                        requestedTaskId: String(id || '').trim(),
                        patch: undoPatch,
                        inversePatch,
                        label: actualDone ? '完成任务' : '取消完成',
                        source: String(opts.source || 'set-done').trim() || 'set-done',
                    });
                } catch (e) {}
            }
            try {
                __tmScheduleTaskSnapshotAfterLocalPatch?.(id, {
                    ...((markdownRetentionPatch && typeof markdownRetentionPatch === 'object') ? markdownRetentionPatch : {}),
                    ...doneStatePatch,
                    ...((touchPatch && typeof touchPatch === 'object') ? touchPatch : {}),
                }, {
                    source: String(opts.source || 'set-done-success').trim() || 'set-done-success',
                });
            } catch (e) {}
            try {
                if (!state.doneOverrides || typeof state.doneOverrides !== 'object') state.doneOverrides = {};
                state.doneOverrides[String(id)] = !!actualDone;
            } catch (e) {}
            // 递归更新所有子任务的done状态（如果需要）
            const updateChildrenDone = (tasks) => {
                tasks.forEach(t => {
                    t.done = t.done; // 保持不变
                    if (t.children && t.children.length > 0) {
                        updateChildrenDone(t.children);
                    }
                });
            };
            if (task.children && task.children.length > 0) {
                updateChildrenDone(task.children);
            }

            recalcStats();
            const currentViewMode = globalThis.__tmRuntimeState?.getViewMode?.('') || String(state.viewMode || '').trim();
            const shouldPreserveCalendarSidebarChecklistScroll = globalThis.__tmViewPolicy?.shouldPreserveCalendarSidebarChecklistScroll?.(currentViewMode, state.modal)
                ?? ((globalThis.__tmRuntimeState?.isViewMode?.('calendar') ?? (String(state.viewMode || '').trim() === 'calendar')) && __tmHasCalendarSidebarChecklist(state.modal));
            if (useCalendarLocalRefresh) {
                try { globalThis.__tmCalendar?.syncTaskDoneInPlace?.(id, !!actualDone, { allowRefetch: true }); } catch (e) {}
                __tmRestoreChecklistDetailScrollSnapshot(detailScrollSnapshot);
            } else if (!useLocalRefreshMode) {
                try { __tmStageChecklistRenderRestore(checklistRenderRestoreSnapshot); } catch (e) {}
                try {
                    __tmScheduleViewRefresh({
                        mode: 'current',
                        withFilters: true,
                        reason: 'set-done-success',
                    });
                } catch (e) {
                    try {
                        if (shouldPreserveCalendarSidebarChecklistScroll) __tmRefreshCalendarSidebarChecklistPreserveScroll();
                        else __tmScheduleRender({ withFilters: true, reason: 'set-done-success-fallback' });
                    } catch (e2) {
                        try { render(); } catch (e3) {}
                    }
                }
                try { __tmRestoreChecklistDetailScrollSnapshot(detailScrollSnapshot); } catch (e) {}
                try {
                    requestAnimationFrame(() => {
                        try { __tmRestoreChecklistDetailScrollSnapshot(detailScrollSnapshot); } catch (e2) {}
                    });
                } catch (e) {}
            } else {
                try { __tmRestoreChecklistDetailScrollSnapshot(detailScrollSnapshot); } catch (e) {}
            }

            try {
                const did = String(docId || '').trim();
                if (did) __tmInvalidateTasksQueryCacheByDocId(did);
                else __tmInvalidateAllSqlCaches();
            } catch (e) {}

            if (opts.suppressHint !== true) {
                hint(__tmBuildTaskDoneSuccessHint(!!actualDone, '✅ 任务已完成'), 'success');
            }
            if (opts.deferCompletionEffects !== true) {
                __tmRunSetDonePostCommitEffects(id, {
                    ...opts,
                    task,
                    done: actualDone,
                    previousDone: originalDone,
                    completedAt: completeAtPatch?.taskCompleteAt || '',
                    attrHostId: taskRewardAttrHostId,
                    rewardPriorityScore: taskRewardPriorityScore,
                    delight: opts.force !== true,
                });
            }
            return true;

        } catch (err) {
            // 恢复
            const rollbackDoneStatePatch = __tmApplyDoneStateToLocalMirrors(id, task, originalDone, originalMarker, originalMarkdown);
            task.customStatus = originalCustomStatus;
            task.custom_status = originalCustomStatus;
            try {
                if (!state.doneOverrides || typeof state.doneOverrides !== 'object') state.doneOverrides = {};
                state.doneOverrides[String(id)] = originalDone;
            } catch (e) {}
            try {
                MetaStore.set(String(id || '').trim(), {
                    ...rollbackDoneStatePatch,
                    customStatus: originalCustomStatus,
                    content: task.content,
                });
            } catch (e) {}

            // 尝试恢复树状态
            if (fallbackTreeSnapshot && doc) {
                TreeProtector.restore(doc.tasks, fallbackTreeSnapshot);
            }

            recalcStats();
            const currentViewMode = globalThis.__tmRuntimeState?.getViewMode?.('') || String(state.viewMode || '').trim();
            const shouldPreserveCalendarSidebarChecklistScroll = globalThis.__tmViewPolicy?.shouldPreserveCalendarSidebarChecklistScroll?.(currentViewMode, state.modal)
                ?? ((globalThis.__tmRuntimeState?.isViewMode?.('calendar') ?? (String(state.viewMode || '').trim() === 'calendar')) && __tmHasCalendarSidebarChecklist(state.modal));
            if (useCalendarLocalRefresh) {
                try { globalThis.__tmCalendar?.syncTaskDoneInPlace?.(id, originalDone, { allowRefetch: true }); } catch (e) {}
                __tmRestoreChecklistDetailScrollSnapshot(detailScrollSnapshot);
            } else if (!useLocalRefreshMode) {
                try { __tmStageChecklistRenderRestore(checklistRenderRestoreSnapshot); } catch (e) {}
                try {
                    __tmScheduleViewRefresh({
                        mode: 'current',
                        withFilters: true,
                        reason: 'set-done-rollback',
                    });
                } catch (e) {
                    try {
                        if (shouldPreserveCalendarSidebarChecklistScroll) __tmRefreshCalendarSidebarChecklistPreserveScroll();
                        else __tmScheduleRender({ withFilters: true, reason: 'set-done-rollback-fallback' });
                    } catch (e2) {
                        try { render(); } catch (e3) {}
                    }
                }
                try { __tmRestoreChecklistDetailScrollSnapshot(detailScrollSnapshot); } catch (e) {}
                try {
                    requestAnimationFrame(() => {
                        try { __tmRestoreChecklistDetailScrollSnapshot(detailScrollSnapshot); } catch (e2) {}
                    });
                } catch (e) {}
            } else {
                try { __tmRestoreChecklistDetailScrollSnapshot(detailScrollSnapshot); } catch (e) {}
            }
            if (opts.suppressHint !== true) hint(`❌ 操作失败: ${err.message}`, 'error');
            if (opts.force === true) throw err;
            return false;
        } finally {
            TreeProtector.clear(fallbackTreeSnapshot);
            if (fallbackLocked) {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        GlobalLock.unlock();
                    });
                });
            }
        }
    };

    function __tmAutoCompleteGetTaskById(taskId) {
        const tid = String(taskId || '').trim();
        if (!tid) return null;
        return globalThis.__tmTaskBoundary?.getTask?.(tid) || null;
    }

    function __tmAutoCompleteGetParentTaskId(task) {
        return String(task?.parentTaskId || task?.parent_task_id || '').trim();
    }

    function __tmAutoCompleteIsTaskDone(task) {
        if (!(task && typeof task === 'object')) return false;
        try {
            if (typeof __tmIsTaskDoneEffective === 'function') return !!__tmIsTaskDoneEffective(task);
        } catch (e) {}
        return task.done === true;
    }

    function __tmFindParentTaskIdForAutoComplete(childId, childTask = null) {
        const cid = String(childId || '').trim();
        if (!cid) return '';
        const directParentId = __tmAutoCompleteGetParentTaskId(childTask || __tmAutoCompleteGetTaskById(cid));
        if (directParentId) return directParentId;
        let found = '';
        const walk = (tasks, parentId = '') => {
            if (!Array.isArray(tasks) || found) return;
            tasks.forEach((task) => {
                if (found || !(task && typeof task === 'object')) return;
                const tid = String(task.id || task.blockId || '').trim();
                if (tid === cid) {
                    found = String(parentId || '').trim();
                    return;
                }
                if (Array.isArray(task.children) && task.children.length) walk(task.children, tid || parentId);
            });
        };
        try { (Array.isArray(state.taskTree) ? state.taskTree : []).forEach((doc) => walk(doc?.tasks)); } catch (e) {}
        try { walk(state.filteredTasks); } catch (e) {}
        return found;
    }

    function __tmCollectDirectChildrenForAutoComplete(parentId) {
        const pid = String(parentId || '').trim();
        if (!pid) return [];
        try {
            const projectedChildren = globalThis.__tmTaskStore?.listProjectedDirectChildren?.(pid);
            if (Array.isArray(projectedChildren) && projectedChildren.length > 0) return projectedChildren;
        } catch (e) {}
        const children = new Map();
        const addChild = (child) => {
            if (!(child && typeof child === 'object')) return;
            const cid = String(child.id || child.blockId || '').trim();
            if (!cid || cid === pid) return;
            children.set(cid, child);
        };
        const parentTask = __tmAutoCompleteGetTaskById(pid);
        (Array.isArray(parentTask?.children) ? parentTask.children : []).forEach(addChild);
        const scanMap = (taskMap) => {
            Object.values((taskMap && typeof taskMap === 'object') ? taskMap : {}).forEach((task) => {
                if (__tmAutoCompleteGetParentTaskId(task) === pid) addChild(task);
            });
        };
        scanMap(state.flatTasks);
        scanMap(state.pendingInsertedTasks);
        const walk = (tasks, parentOfCurrent = '') => {
            if (!Array.isArray(tasks)) return;
            tasks.forEach((task) => {
                if (!(task && typeof task === 'object')) return;
                const tid = String(task.id || task.blockId || '').trim();
                if (String(parentOfCurrent || '').trim() === pid || __tmAutoCompleteGetParentTaskId(task) === pid) addChild(task);
                if (Array.isArray(task.children) && task.children.length) walk(task.children, tid || parentOfCurrent);
            });
        };
        try { (Array.isArray(state.taskTree) ? state.taskTree : []).forEach((doc) => walk(doc?.tasks)); } catch (e) {}
        try { walk(state.filteredTasks); } catch (e) {}
        return Array.from(children.values());
    }

    function __tmBuildSetDoneQueuedDefinition(taskId, done, task, options = {}) {
        const tid = String(taskId || '').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        const taskLike = (task && typeof task === 'object')
            ? task
            : (globalThis.__tmTaskBoundary?.getTask?.(tid) || null);
        if (!tid || !taskLike) return null;
        const targetDone = !!done;
        const effectiveTaskDone = typeof __tmIsTaskDoneEffective === 'function'
            ? !!__tmIsTaskDoneEffective(taskLike)
            : !!taskLike.done;
        const originalDone = Object.prototype.hasOwnProperty.call(opts, 'previousDone')
            ? !!opts.previousDone
            : effectiveTaskDone;
        const previousMarker = __tmResolveTaskMarker(taskLike);
        const previousMarkdown = String(taskLike.markdown || '');
        const statusPatch = __tmBuildCheckboxStatusPatch(taskLike, targetDone, opts.statusPatch);
        const originalCustomStatus = Object.prototype.hasOwnProperty.call(opts, 'previousStatusId')
            ? String(opts.previousStatusId || '').trim()
            : String(taskLike.customStatus || taskLike.custom_status || '').trim();
        let targetMarker = targetDone ? 'X' : ' ';
        const targetStatusId = String(statusPatch?.customStatus || '').trim();
        if (targetStatusId) {
            const targetStatus = __tmFindStatusOptionById(targetStatusId);
            if (targetStatus) {
                targetMarker = __tmNormalizeCompatTaskStatusMarker(
                    targetStatus.marker,
                    __tmGuessStatusOptionDefaultMarker(targetStatus),
                );
            }
        }
        const optimisticPatch = {
            done: targetDone,
            ...((statusPatch && typeof statusPatch === 'object') ? statusPatch : {}),
        };
        let taskCompleteAtDerived = false;
        if (targetDone && !originalDone) {
            const completeAtPatch = __tmBuildTaskCompleteAtPatch();
            if (completeAtPatch && typeof completeAtPatch === 'object') {
                Object.assign(optimisticPatch, completeAtPatch);
                taskCompleteAtDerived = Object.prototype.hasOwnProperty.call(completeAtPatch, 'taskCompleteAt');
            }
        } else if (!targetDone && originalDone) {
            optimisticPatch.taskCompleteAt = '';
            taskCompleteAtDerived = true;
        }
        const additionalPatch = (opts.additionalPatch && typeof opts.additionalPatch === 'object' && !Array.isArray(opts.additionalPatch))
            ? { ...opts.additionalPatch }
            : {};
        delete additionalPatch.done;
        Object.keys(statusPatch || {}).forEach((key) => {
            if (String(statusPatch[key] ?? '').trim()) delete additionalPatch[key];
        });
        if (Object.prototype.hasOwnProperty.call(additionalPatch, 'taskCompleteAt')) taskCompleteAtDerived = false;
        Object.assign(optimisticPatch, additionalPatch);
        const projectionPatch = {
            ...optimisticPatch,
            taskMarker: targetMarker,
            task_marker: targetMarker,
            markdown: __tmBuildTaskMarkdownWithMarker(taskLike, targetMarker),
        };
        const inversePatch = __tmCaptureTaskPatchInverse(tid, projectionPatch);
        inversePatch.done = originalDone;
        if (Object.prototype.hasOwnProperty.call(optimisticPatch, 'customStatus')
            && !Object.prototype.hasOwnProperty.call(inversePatch, 'customStatus')) {
            inversePatch.customStatus = originalCustomStatus;
        }
        const rewardPriorityScore = !!SettingsStore?.data?.enablePointsRewardIntegration
            && !originalDone
            && targetDone
            && !__tmUndoState?.applying
            ? Math.max(0, Math.round(Number(__tmEnsureTaskPriorityScore(taskLike, { force: true })) || 0))
            : 0;
        let deferRecurringProjectionRefresh = false;
        if (targetDone && !originalDone) {
            try {
                const repeatRule = __tmGetTaskRepeatRule(taskLike);
                deferRecurringProjectionRefresh = !!__tmBuildTaskRepeatAdvancePatch(taskLike, repeatRule, {
                    completedAt: String(optimisticPatch.taskCompleteAt || '').trim(),
                });
            } catch (e) {}
        }
        return {
            targetDone,
            definition: {
                id: String(opts.operationId || '').trim(),
                type: 'setDone',
                docId: String(taskLike.root_id || taskLike.docId || '').trim(),
                laneKey: `task:${tid}`,
                     data: {
                         taskId: tid,
                         done: targetDone,
                         patch: optimisticPatch,
                         projectionPatch,
                         additionalPatch,
                         previousAttachmentPaths: opts.previousAttachmentPaths,
                         previousAttachmentMeta: opts.previousAttachmentMeta,
                         previousAttachmentSlotCount: opts.previousAttachmentSlotCount,
                         statusPatch,
                    source: String(opts.source || 'set-done').trim() || 'set-done',
                    scheduleId: String(opts.scheduleId || '').trim(),
                    fsrsRating: Number(opts.fsrsRating) || 0,
                    suppressHint: true,
                    previousDone: originalDone,
                    previousMarker: previousMarker,
                    previousMarkdown: previousMarkdown,
                    previousStatusId: originalCustomStatus,
                    previousStatePrepared: false,
                    taskCompleteAtDerived,
                    rewardPriorityScore,
                    recordUndo: opts.recordUndo !== false,
                    withFilters: opts.withFilters === true,
                    skipInteractionGate: opts.skipInteractionGate === true,
                    deferProjection: opts.deferProjection === true || deferRecurringProjectionRefresh,
                    refreshAncestorViews: opts.refreshAncestorViews !== false,
                    skipAutoCompleteParent: opts.skipAutoCompleteParent === true,
                },
                inversePatch,
            },
        };
    }

    async function __tmSyncParentDoneStateFromSubtasks(childId, options = {}) {
        if (SettingsStore?.data?.autoCompleteParentOnSubtasksDone !== true) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        if (opts.skipAutoCompleteParent === true) return false;
        const cid = String(childId || '').trim();
        if (!cid) return false;
        let childTask = __tmAutoCompleteGetTaskById(cid);
        let parentId = __tmFindParentTaskIdForAutoComplete(cid, childTask);
        let refreshedDoc = false;
        const refreshDocForAutoComplete = async () => {
            if (refreshedDoc || opts.skipFreshDoc === true || typeof __tmRefreshTaskDocForFreshDetail !== 'function') return false;
            refreshedDoc = true;
            try {
                const freshTask = await __tmRefreshTaskDocForFreshDetail(cid, childTask, {
                    source: String(opts.source || 'auto-complete-parent-fresh-doc').trim() || 'auto-complete-parent-fresh-doc',
                    throwOnFailure: opts.returnMutationDefinition === true,
                });
                if (freshTask && typeof freshTask === 'object') childTask = freshTask;
                return true;
            } catch (e) {
                if (opts.returnMutationDefinition === true) throw e;
                return false;
            }
        };
        if ((!parentId || parentId === cid) && await refreshDocForAutoComplete()) {
            parentId = __tmFindParentTaskIdForAutoComplete(cid, childTask);
        }
        if (!parentId || parentId === cid) return false;
        let parentTask = __tmAutoCompleteGetTaskById(parentId);
        if (!parentTask && await refreshDocForAutoComplete()) {
            parentId = __tmFindParentTaskIdForAutoComplete(cid, childTask);
            parentTask = __tmAutoCompleteGetTaskById(parentId);
        }
        if (!parentTask) return false;
        const childBecameDone = Object.prototype.hasOwnProperty.call(opts, 'done')
            ? opts.done === true
            : __tmAutoCompleteIsTaskDone(childTask);
        let children = __tmCollectDirectChildrenForAutoComplete(parentId);
        if (!children.length && await refreshDocForAutoComplete()) {
            parentId = __tmFindParentTaskIdForAutoComplete(cid, childTask);
            parentTask = __tmAutoCompleteGetTaskById(parentId);
            if (!parentId || parentId === cid || !parentTask) return false;
            children = __tmCollectDirectChildrenForAutoComplete(parentId);
        }
        if (!children.length) return false;
        let allChildrenDone = children.every((child) => {
            const childTaskId = String(child?.id || child?.blockId || '').trim();
            const latestChild = childTaskId ? (__tmAutoCompleteGetTaskById(childTaskId) || child) : child;
            return __tmAutoCompleteIsTaskDone(latestChild);
        });
        if (childBecameDone && !allChildrenDone && await refreshDocForAutoComplete()) {
            parentId = __tmFindParentTaskIdForAutoComplete(cid, childTask);
            parentTask = __tmAutoCompleteGetTaskById(parentId);
            if (!parentId || parentId === cid || !parentTask) return false;
            children = __tmCollectDirectChildrenForAutoComplete(parentId);
            if (!children.length) return false;
            allChildrenDone = children.every((child) => {
                const childTaskId = String(child?.id || child?.blockId || '').trim();
                const latestChild = childTaskId ? (__tmAutoCompleteGetTaskById(childTaskId) || child) : child;
                return __tmAutoCompleteIsTaskDone(latestChild);
            });
        }
        if (childBecameDone && !allChildrenDone) return false;
        const targetParentDone = childBecameDone;
        const parentDone = __tmAutoCompleteIsTaskDone(parentTask);
        if (parentDone === targetParentDone) return false;
        const source = targetParentDone
            ? 'auto-complete-parent-on-subtasks-done'
            : 'auto-restore-parent-on-subtask-undone';
        if (opts.returnMutationDefinition === true) {
            const effectId = String(opts.effectId || childId).trim() || String(childId || '').trim();
            const built = __tmBuildSetDoneQueuedDefinition(parentId, targetParentDone, parentTask, {
                operationId: `${effectId}:parent:${parentId}`,
                previousDone: parentDone,
                source,
                recordUndo: true,
            });
            return built?.definition || false;
        }
        const result = await window.tmSetDone?.(parentId, targetParentDone, null, {
            source,
            suppressHint: true,
            wait: true,
            force: true,
            skipInteractionGate: true,
        });
        return result !== false;
    }

    try { globalThis.__tmSyncParentDoneStateFromSubtasks = __tmSyncParentDoneStateFromSubtasks; } catch (e) {}

    function __tmQueueSetDoneTask(taskId, done, task, options = {}) {
        const tid = String(taskId || '').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        const built = __tmBuildSetDoneQueuedDefinition(tid, done, task, opts);
        if (!built?.definition) return Promise.resolve(false);
        const targetDone = built.targetDone;
        let pendingPromise = null;
        let intentRevision = 0;
        const opPromise = __tmEnqueueQueuedOp(built.definition, {
            wait: opts.wait === true,
            onPending: (promise, op) => {
                pendingPromise = promise;
                intentRevision = Number(op?.data?.intentRevision) || 0;
            },
        });
        const settlePromise = pendingPromise || opPromise;
        Promise.resolve(settlePromise).then(() => {
            if (intentRevision && !__tmIsLatestSetDoneIntent(tid, intentRevision)) return;
            if (targetDone) {
                try { __tmQueueTaskDoneDelight(tid, { done: true, suppressHint: opts.suppressHint, source: opts.source }); } catch (e) {}
            }
            if (opts.suppressHint !== true) {
                try { hint(__tmBuildTaskDoneSuccessHint(targetDone, targetDone ? '✅ 任务已完成' : '✅ 已取消完成'), 'success'); } catch (e) {}
            }
        }).catch((e) => {
            if (intentRevision && !__tmIsLatestSetDoneIntent(tid, intentRevision)) return;
            if (opts.suppressHint !== true) {
                try { hint(`❌ 操作失败: ${e?.message || String(e)}`, 'error'); } catch (err) {}
            }
        });
        return opts.wait === true ? opPromise : Promise.resolve(true);
    }

    const __tmSetDoneIngressByTask = new Map();

    function __tmRunSetDoneIngress(taskId, runner) {
        const tid = String(taskId || '').trim();
        const invoke = typeof runner === 'function' ? runner : async () => false;
        const previous = tid ? __tmSetDoneIngressByTask.get(tid) : null;
        let request;
        if (previous) {
            request = previous.then(invoke);
        } else {
            try {
                request = Promise.resolve(invoke());
            } catch (error) {
                request = Promise.reject(error);
            }
        }
        if (!tid) return request;
        let tracked = null;
        tracked = request.then(() => undefined, () => undefined).finally(() => {
            if (__tmSetDoneIngressByTask.get(tid) === tracked) __tmSetDoneIngressByTask.delete(tid);
        });
        __tmSetDoneIngressByTask.set(tid, tracked);
        return request;
    }

    async function __tmSetDoneFromUi(id, done, ev, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
if (ev) {
            try { ev.stopPropagation(); } catch (e) {}
        }
        const tid = String(id || '').trim();
        let task = globalThis.__tmTaskBoundary?.getTask?.(tid) || null;
        const viewMode = globalThis.__tmRuntimeState?.getViewMode?.('') || String(state.viewMode || '').trim();
        const isChecklistListToggle = !!(ev?.target instanceof Element && ev.target.closest('.tm-checklist-item[data-id]'));
        const shouldPreserveMobileChecklistScroll = (viewMode === 'checklist')
            && (__tmIsMobileDevice() || __tmHostUsesMobileUI())
            && isChecklistListToggle;
        const checklistLocalRestoreSnapshot = shouldPreserveMobileChecklistScroll
            ? __tmCaptureChecklistRenderRestore()
            : null;
        const targetDone = !!done;
        if (__tmIsRecurringInstanceTask(task)) {
            if (targetDone !== false) {
                if (opts.suppressHint !== true) hint('⚠️ 循环完成实例只能撤销完成，请在这里取消勾选', 'warning');
                if (ev?.target) {
                    try { ev.target.checked = true; } catch (e) {}
                }
                return false;
            }
            const sourceTaskId = String(__tmResolveRecurringInstanceSourceTaskId(tid, task) || '').trim();
            const completedAt = String(task?.recurringCompletedAt || '').trim();
            if (!sourceTaskId || !completedAt) {
                if (opts.suppressHint !== true) hint('⚠️ 未找到可撤销的循环记录', 'warning');
                if (ev?.target) {
                    try { ev.target.checked = true; } catch (e) {}
                }
                return false;
            }
            try {
                const result = await __tmDeleteTaskRepeatHistoryEntry(sourceTaskId, completedAt, {
                    source: String(opts.source || 'recurring-instance-uncomplete').trim() || 'recurring-instance-uncomplete',
                    recordUndo: opts.recordUndo !== false,
                });
                if (!result) {
                    if (opts.suppressHint !== true) hint('⚠️ 未找到可撤销的循环记录', 'warning');
                    if (ev?.target) {
                        try { ev.target.checked = true; } catch (e) {}
                    }
                    return false;
                }
                if (ev?.target) {
                    try { ev.target.checked = false; } catch (e) {}
                }
                try { __tmRestoreChecklistRenderRestore(checklistLocalRestoreSnapshot); } catch (e) {}
                if (opts.suppressHint !== true) hint('✅ 已撤销循环完成记录', 'success');
                return true;
            } catch (e) {
                if (opts.suppressHint !== true) hint(`❌ 撤销失败: ${e?.message || String(e)}`, 'error');
                if (ev?.target) {
                    try { ev.target.checked = true; } catch (e2) {}
                }
                try { __tmRestoreChecklistRenderRestore(checklistLocalRestoreSnapshot); } catch (e2) {}
                return false;
            }
        }
        if (!task) {
            try { task = await __tmEnsureTaskInStateById(tid); } catch (e) { task = null; }
        }
        if (!task || __tmIsCollectedOtherBlockTask(task)) {
            return await __tmSetDoneKernel(tid, done, ev, opts);
        }
        const currentDone = typeof __tmIsTaskDoneEffective === 'function'
            ? !!__tmIsTaskDoneEffective(task)
            : !!task.done;
        let fsrsRating = __tmNormalizeFsrsRating(opts.fsrsRating);
        if (!currentDone && targetDone) {
            const repeatRule = __tmGetTaskRepeatRule(task);
            if (repeatRule.type === 'fsrs') {
                if (!fsrsRating && ev?.target) fsrsRating = 3;
                if (!fsrsRating) {
                    if (opts.suppressHint !== true) hint('⚠ FSRS 间隔重复需要明确选择“良好”或其他评分', 'warning');
                    if (ev?.target) {
                        try { ev.target.checked = false; } catch (e) {}
                    }
                    return false;
                }
            }
        }
        const explicitCheckboxIntent = String(ev?.target?.type || '').toLowerCase() === 'checkbox';
        if (currentDone === targetDone && !explicitCheckboxIntent) return;
        try {
            const setDone = globalThis.__tmRequireTaskMutation?.('setDone');
            if (typeof setDone !== 'function') throw new Error('任务完成状态写入队列未就绪');
            const request = setDone(tid, targetDone, {
                source: String(opts.source || '').trim(),
                suppressHint: opts.suppressHint === true,
                statusPatch: opts.statusPatch,
                additionalPatch: opts.additionalPatch,
                scheduleId: String(opts.scheduleId || '').trim(),
                recordUndo: opts.recordUndo !== false,
                wait: opts.wait === true,
                skipAutoCompleteParent: opts.skipAutoCompleteParent === true,
                skipInteractionGate: opts.skipInteractionGate === true,
                deferProjection: opts.deferProjection === true,
                refreshAncestorViews: opts.refreshAncestorViews !== false,
                fsrsRating,
            });
            try { __tmRestoreChecklistRenderRestore(checklistLocalRestoreSnapshot); } catch (e) {}
            if (opts.wait === true) await request;
            try { __tmRestoreChecklistRenderRestore(checklistLocalRestoreSnapshot); } catch (e) {}
            return true;
        } catch (e) {
            if (opts.suppressHint !== true) hint(`❌ 操作失败: ${e.message}`, 'error');
            if (ev?.target) ev.target.checked = !targetDone;
            try { __tmRestoreChecklistRenderRestore(checklistLocalRestoreSnapshot); } catch (e2) {}
            return false;
        }
    }

    window.tmSetDone = function(id, done, ev, options = {}) {
        const tid = String(id || '').trim();
        const targetDone = !!done;
        const input = ev?.target && String(ev.target?.type || '').toLowerCase() === 'checkbox'
            ? ev.target
            : null;
        if (ev) {
            try { ev.stopPropagation(); } catch (e) {}
        }
        const request = __tmRunSetDoneIngress(tid, async () => {
            if (input) {
                try { input.checked = targetDone; } catch (e) {}
            }
            const setDoneOptions = input
                ? { ...((options && typeof options === 'object') ? options : {}), wait: false }
                : options;
            return await __tmSetDoneFromUi(tid, targetDone, ev, setDoneOptions);
        });
        return request;
    };

    // 保存所有任务到MetaStore（递归）
    async function saveAllTasksToMeta(docId) {
        const doc = state.taskTree.find(d => d.id === docId);
        if (!doc) return;

        const saveRecursive = (tasks) => {
            tasks.forEach(task => {
                MetaStore.set(task.id, {
                    priority: task.priority || '',
                    duration: task.duration || '',
                    remark: task.remark || '',
                    completionTime: task.completionTime || '',
                    customTime: task.customTime || '',
                    customStatus: task.customStatus || '',
                    done: task.done,
                    content: task.content
                });
                if (task.children && task.children.length > 0) {
                    saveRecursive(task.children);
                }
            });
        };

        saveRecursive(doc.tasks);
        await MetaStore.saveNow();
    }

    // ============ 受保护的文档任务重载 ============
    // manualRelationships: 可选，Map<childId, parentTaskId>，用于在SQL索引未更新时强制指定父子关系
    // injectedTasks: 可选，Array<Task>，用于在SQL索引未更新时强制注入新任务（乐观更新）
    async function reloadDocTasksProtected(docId, expectId = null, manualRelationships = null, injectedTasks = null, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
// 0. 备份旧的父子关系/文档顺序（用于容灾，当SQL索引失效时恢复现有结构）
        const oldRelationships = new Map(); // Map<childId, {parentId: string, listId: string}>
        const oldTaskStateById = new Map(); // Map<taskId, {parentId: string, listId: string, docSeq?: number}>
        const backupRelationships = (tasks) => {
            tasks.forEach(t => {
                const taskId = String(t?.id || '').trim();
                if (taskId) {
                    const prevDocSeq = Number(t?.docSeq ?? t?.doc_seq);
                    oldTaskStateById.set(taskId, {
                        parentId: String(t?.parentTaskId || '').trim(),
                        listId: String(t?.parent_id || t?.parentId || '').trim(),
                        docSeq: Number.isFinite(prevDocSeq) ? prevDocSeq : undefined,
                        headingContext: {
                            h2: String(t?.h2 || '').trim(),
                            h2Id: String(t?.h2Id || '').trim(),
                            h2Path: String(t?.h2Path || '').trim(),
                            h2Sort: Number(t?.h2Sort),
                            h2Created: String(t?.h2Created || '').trim(),
                            h2Rank: Number(t?.h2Rank),
                        },
                    });
                }
                if (t.parentTaskId) {
                    oldRelationships.set(taskId, {
                        parentId: String(t.parentTaskId || '').trim(),
                        listId: String(t.parent_id || t.parentId || '').trim(), // 列表块ID，用于校验是否移动了位置
                    });
                }
                if (t.children && t.children.length > 0) {
                    backupRelationships(t.children);
                }
            });
        };
        const currentDoc = state.taskTree.find(d => d.id === docId);
        if (currentDoc && currentDoc.tasks) {
            backupRelationships(currentDoc.tasks);
        }
        const hasManualRelationships = manualRelationships instanceof Map && manualRelationships.size > 0;
        const hasInjectedTasks = Array.isArray(injectedTasks) && injectedTasks.length > 0;
        const forceDocFlowOrder = opts.forceDocFlowOrder === true || opts.forceSyncFlowRank === true;
        const shouldPreserveExistingDocOrder = !forceDocFlowOrder && !!currentDoc && (
            opts.preserveExistingSiblingOrder === true
            || hasManualRelationships
            || hasInjectedTasks
            || !__tmShouldUseResolvedFlowRankForDoc(docId)
        );
        const allowOldRelationshipFallback = !hasManualRelationships && !hasInjectedTasks;

        // 1. 重新加载数据 (带重试机制，等待索引更新)
        let flatTasks = [];
        let queryTime = 0;

        if (expectId) {
            let retries = 0;
            const maxRetries = 20; // 最多等待 5秒 (250ms * 20)
            while (retries < maxRetries) {
                const res = await API.getTasksByDocuments([docId], __TM_TASK_INDEX_QUERY_LIMIT, { forceFresh: opts.forceFresh === true });

                // 检查是否包含期望的ID
                if (res.tasks && res.tasks.find(t => t.id === expectId)) {
                    flatTasks = res.tasks;
                    queryTime = res.queryTime;
                    break;
                }

                // 如果是最后一次重试，仍然使用当前结果
                if (retries === maxRetries - 1) {
                    flatTasks = res.tasks || [];
                    queryTime = res.queryTime || 0;
                    break;
                }

                // 如果没找到，等待后重试
                await new Promise(r => setTimeout(r, 250));
                retries++;
            }
        } else {
             const res = await API.getTasksByDocuments([docId], __TM_TASK_INDEX_QUERY_LIMIT, { forceFresh: opts.forceFresh === true });
             flatTasks = res.tasks || [];
             queryTime = res.queryTime || 0;
        }

        // 1.5 注入强制任务（乐观更新）
        if (injectedTasks && injectedTasks.length > 0) {
            const injectedById = new Map((Array.isArray(injectedTasks) ? injectedTasks : [])
                .map((task) => [String(task?.id || '').trim(), task])
                .filter(([id]) => !!id));
            let mergedCount = 0;
            flatTasks = (Array.isArray(flatTasks) ? flatTasks : []).map((task) => {
                const taskId = String(task?.id || '').trim();
                const injected = injectedById.get(taskId);
                if (!taskId || !injected || typeof injected !== 'object') return task;
                const next = { ...task };
                if (Object.prototype.hasOwnProperty.call(injected, 'parent_id') || Object.prototype.hasOwnProperty.call(injected, 'parentId')) {
                    next.parent_id = String(injected?.parent_id || injected?.parentId || '').trim();
                }
                if (Object.prototype.hasOwnProperty.call(injected, 'parentTaskId') || Object.prototype.hasOwnProperty.call(injected, 'parent_task_id')) {
                    next.parent_task_id = String(injected?.parentTaskId || injected?.parent_task_id || '').trim();
                }
                if (Object.prototype.hasOwnProperty.call(injected, 'root_id') || Object.prototype.hasOwnProperty.call(injected, 'docId')) {
                    next.root_id = String(injected?.root_id || injected?.docId || '').trim();
                }
                if (Object.prototype.hasOwnProperty.call(injected, 'doc_name') || Object.prototype.hasOwnProperty.call(injected, 'docName')) {
                    next.doc_name = String(injected?.doc_name || injected?.docName || '').trim();
                }
                if (Object.prototype.hasOwnProperty.call(injected, 'h2') || Object.prototype.hasOwnProperty.call(injected, 'h2Id')) {
                    next.h2 = String(injected?.h2 || '').trim();
                    next.h2Id = String(injected?.h2Id || '').trim();
                    next.h2Path = String(injected?.h2Path || '').trim();
                    next.h2Sort = Number(injected?.h2Sort);
                    next.h2Created = String(injected?.h2Created || '').trim();
                    next.h2Rank = Number(injected?.h2Rank);
                }
                mergedCount += 1;
                return next;
            });
            injectedById.forEach((injected, taskId) => {
                if (!flatTasks.find((task) => String(task?.id || '').trim() === taskId)) {
                    flatTasks.push(injected);
                }
            });
}

        const protectedFlowRankMap = new Map();
        const forceHeadingContext = opts.forceHeadingContext === true
            || (typeof __tmShouldLoadCompactChecklistHeadingContext === 'function'
                && __tmShouldLoadCompactChecklistHeadingContext());
        const protectedHeadingContextMap = new Map();
        if ((forceDocFlowOrder || forceHeadingContext) && flatTasks.length > 0) {
            try {
                const taskIds = Array.from(new Set(flatTasks.map((task) => String(task?.id || '').trim()).filter(Boolean)));
                const taskDocMap = new Map(taskIds.map((taskId) => [taskId, String(docId || '').trim()]));
                const bundle = await API.fetchTaskEnhanceBundle(taskIds, {
                    taskDocMap,
                    needH2: forceHeadingContext,
                    needFlow: forceDocFlowOrder,
                    forceFresh: forceHeadingContext,
                });
                const flowMap = bundle?.taskFlowRankMap instanceof Map ? bundle.taskFlowRankMap : new Map();
                const headingMap = bundle?.h2ContextMap instanceof Map ? bundle.h2ContextMap : new Map();
                flatTasks.forEach((task) => {
                    const taskId = String(task?.id || '').trim();
                    if (forceDocFlowOrder) {
                        const flowRank = Number(flowMap.get(taskId));
                        if (Number.isFinite(flowRank)) {
                            __tmApplyResolvedFlowRankIfNeeded(task, flowRank);
                            protectedFlowRankMap.set(taskId, flowRank);
                        }
                    }
                    if (forceHeadingContext && headingMap.has(taskId)) {
                        protectedHeadingContextMap.set(taskId, headingMap.get(taskId));
                    }
                });
            } catch (e) {}
        }

        // 2. 构建树
        const taskMap = new Map();
        let rootTasks = [];
        const isValidValue = (val) => val !== undefined && val !== null && val !== '' && val !== 'null';

        // 先创建所有节点（从 MetaStore 读取所有自定义属性，不依赖 SQL 查询）
        flatTasks.forEach(t => {
            const parsed = API.parseTaskStatus(t.markdown);
            const taskId = String(t?.id || '').trim();
            const parsedMarker = __tmNormalizeTaskStatusMarker(parsed?.marker, parsed.done ? 'X' : ' ');

            const meta = MetaStore.get(taskId) || {};
            const allowVisibleDateFallback = __tmHasPendingVisibleDatePersistence(String(t.id || '').trim());
            const oldTaskState = oldTaskStateById.get(taskId) || null;
            const docSeq = Number(t?.doc_seq);
            const preservedDocSeq = Number(oldTaskState?.docSeq);
            const resolvedFlowRank = Number(t?.resolvedFlowRank ?? t?.resolved_flow_rank ?? t?.__tmResolvedFlowRank);
            const dbAttachmentPaths = __tmGetTaskAttachmentPaths(t);
            const metaAttachmentPaths = Object.prototype.hasOwnProperty.call(meta, 'attachments')
                ? __tmNormalizeTaskAttachmentPaths(meta.attachments)
                : [];
            const nextAttachmentPaths = dbAttachmentPaths.length ? dbAttachmentPaths : metaAttachmentPaths;
            const dbAttachmentMeta = Array.from(__tmGetTaskAttachmentMetaMap(t).values());
            const metaAttachmentMeta = Object.prototype.hasOwnProperty.call(meta, 'attachmentMeta')
                ? meta.attachmentMeta
                : [];

            const nextTask = {
                id: taskId,
                content: parsed.content,
                done: !!parsed.done,
                markdown: t.markdown,
                taskMarker: parsedMarker,
                task_marker: parsedMarker,
                parent_id: t.parent_id,
                parentId: String(t.parent_id || '').trim(),
                parent_task_id: String(t.parent_task_id || '').trim(),
                root_id: t.root_id,
                docId: String(t.root_id || '').trim(),
                docName: String(t.doc_name || '').trim(),
                doc_name: t.doc_name,
                docSeq: (shouldPreserveExistingDocOrder && Number.isFinite(preservedDocSeq))
                    ? preservedDocSeq
                    : (Number.isFinite(docSeq) ? docSeq : Number.POSITIVE_INFINITY),
                doc_seq: (shouldPreserveExistingDocOrder && Number.isFinite(preservedDocSeq))
                    ? preservedDocSeq
                    : (Number.isFinite(docSeq) ? docSeq : Number.POSITIVE_INFINITY),
                blockPath: String(t.block_path || t.path || '').trim(),
                block_path: String(t.block_path || t.path || '').trim(),
                blockSort: String(t.block_sort ?? t.sort ?? '').trim(),
                block_sort: String(t.block_sort ?? t.sort ?? '').trim(),
                created: String(t.created || '').trim(),
                updated: String(t.updated || '').trim(),
                resolvedFlowRank: Number.isFinite(resolvedFlowRank) ? resolvedFlowRank : undefined,
                resolved_flow_rank: Number.isFinite(resolvedFlowRank) ? resolvedFlowRank : undefined,
                __tmResolvedFlowRank: Number.isFinite(resolvedFlowRank) ? resolvedFlowRank : undefined,
                children: [],
                priority: (() => {
                    const dbv = String(t.priority ?? '');
                    const mv = Object.prototype.hasOwnProperty.call(meta, 'priority') ? String(meta.priority ?? '') : '';
                    if (isValidValue(dbv)) return dbv;
                    if (isValidValue(mv)) return mv;
                    return dbv;
                })(),
                duration: (() => {
                    const dbv = String(t.duration ?? '');
                    const mv = Object.prototype.hasOwnProperty.call(meta, 'duration') ? String(meta.duration ?? '') : '';
                    if (isValidValue(dbv)) return dbv;
                    if (isValidValue(mv)) return mv;
                    return dbv;
                })(),
                remark: (() => {
                    const dbv = String(t.remark ?? '');
                    const mv = Object.prototype.hasOwnProperty.call(meta, 'remark') ? String(meta.remark ?? '') : '';
                    if (isValidValue(dbv)) return dbv;
                    if (isValidValue(mv)) return mv;
                    return dbv;
                })(),
                startDate: (() => {
                    const dbv = String(t.start_date ?? '');
                    const mv = Object.prototype.hasOwnProperty.call(meta, 'startDate') ? String(meta.startDate ?? '') : '';
                    if (isValidValue(dbv)) return dbv;
                    if (allowVisibleDateFallback && isValidValue(mv)) return mv;
                    return dbv;
                })(),
                completionTime: (() => {
                    const dbv = String(t.completion_time ?? '');
                    const mv = Object.prototype.hasOwnProperty.call(meta, 'completionTime')
                        ? String(meta.completionTime ?? '')
                        : '';
                    if (isValidValue(dbv)) return dbv;
                    if (allowVisibleDateFallback && isValidValue(mv)) return mv;
                    return dbv;
                })(),
                customTime: (() => {
                    const dbv = String(t.custom_time ?? '');
                    const mv = Object.prototype.hasOwnProperty.call(meta, 'customTime') ? String(meta.customTime ?? '') : '';
                    if (isValidValue(dbv)) return dbv;
                    if (allowVisibleDateFallback && isValidValue(mv)) return mv;
                    return dbv;
                })(),
                pinned: (() => {
                    const raw = Object.prototype.hasOwnProperty.call(meta, 'pinned') ? meta.pinned : t.pinned;
                    if (typeof raw === 'boolean') return raw;
                    const s = String(raw || '').trim().toLowerCase();
                    return s === 'true' || s === '1';
                })(),
                customStatus: (() => {
                    const dbv = String(t.custom_status ?? '');
                    const mv = Object.prototype.hasOwnProperty.call(meta, 'customStatus') ? String(meta.customStatus ?? '') : '';
                    if (isValidValue(dbv)) return dbv;
                    if (isValidValue(mv)) return mv;
                    return dbv;
                })()
            };
            if (forceHeadingContext) {
                const fromTask = __tmTaskHasOwnHeadingContextFields(t) ? t : null;
                const fromEnhance = protectedHeadingContextMap.has(taskId) ? protectedHeadingContextMap.get(taskId) : null;
                const fromOld = oldTaskState?.headingContext || null;
                if (fromTask) __tmCopyTaskHeadingContext(nextTask, fromTask);
                else if (fromEnhance && typeof fromEnhance === 'object') __tmApplyTaskHeadingContext(nextTask, fromEnhance);
                else if (fromOld && typeof fromOld === 'object') __tmCopyTaskHeadingContext(nextTask, fromOld);
            }
            __tmApplyTaskAttachmentPathsToTask(nextTask, nextAttachmentPaths, {
                meta: dbAttachmentMeta.length ? dbAttachmentMeta : metaAttachmentMeta,
                attrsLoaded: __tmHasTaskAttachmentAttrSnapshot(t),
                slotCount: __tmGetTaskAttachmentAttrSlotCount(t),
            });
            taskMap.set(taskId, nextTask);
        });

        // 建立父子关系：统一复用主加载的父级回溯逻辑，避免局部刷新把夹在普通列表中的子任务还原成根任务。
        try {
            const resolvedParentLinks = await __tmResolveDocTaskParentLinks(Array.from(taskMap.values()), {
                docId,
                source: 'reload-doc-protected',
                manualRelationships,
                oldRelationships,
                allowOldRelationshipFallback,
            });
            rootTasks = Array.isArray(resolvedParentLinks?.rootTasks)
                ? resolvedParentLinks.rootTasks
                : [];
        } catch (e) {
            rootTasks = Array.from(taskMap.values()).filter((task) => !String(task?.parentTaskId || '').trim());
        }

        let siblingOrderRanks = new Map();
        try {
            const tasksByDoc = new Map([[String(docId || '').trim(), flatTasks]]);
            siblingOrderRanks = await __tmResolveTaskSiblingOrderRanks(tasksByDoc);
        } catch (e) {
            siblingOrderRanks = new Map();
        }
        __tmRestoreTaskTreeFromMeta(rootTasks);
        if (shouldPreserveExistingDocOrder) __tmSortTaskTreeByExistingOrder(rootTasks, currentDoc.tasks, siblingOrderRanks);
        else if (forceDocFlowOrder && protectedFlowRankMap.size > 0) __tmSortTaskTreeByDocFlow(rootTasks);
        else __tmSortTaskTreeBySiblingRankMap(rootTasks, siblingOrderRanks);
        __tmAssignDocSeqByTree(rootTasks, 0);
        const authoritativeTasks = [];
        const collectAuthoritativeTasks = (tasks) => {
            (Array.isArray(tasks) ? tasks : []).forEach((task) => {
                if (!(task && typeof task === 'object')) return;
                authoritativeTasks.push(task);
                collectAuthoritativeTasks(task.children);
            });
        };
        collectAuthoritativeTasks(rootTasks);
        authoritativeTasks.forEach((task) => {
            const taskId = String(task?.id || '').trim();
            if (!taskId) return;
            try { __tmConfirmLocalTaskPatchWatermarkFromTask(taskId, task); } catch (e) {}
        });
        try {
            globalThis.__tmTaskStore?.acceptAuthoritative?.(authoritativeTasks, {
                docIds: [docId],
                replaceDocuments: true,
            });
        } catch (e) {}
        try { __tmMergeLocalTaskPatchIntoTaskTree([{ tasks: rootTasks }]); } catch (e) {}

        // 3. 更新状态
        const docIndex = state.taskTree.findIndex(d => d.id === docId);
        const docInfo = state.allDocuments.find(d => d.id === docId);

        const newDoc = {
            id: docId,
            name: docInfo?.name || (docIndex >= 0 ? state.taskTree[docIndex].name : '未知文档'),
            alias: __tmNormalizeDocAliasValue(docInfo?.alias || (docIndex >= 0 ? state.taskTree[docIndex]?.alias : '')),
            icon: __tmNormalizeDocIconValue(docInfo?.icon || (docIndex >= 0 ? state.taskTree[docIndex]?.icon : '')),
            created: String(docInfo?.created || (docIndex >= 0 ? state.taskTree[docIndex]?.created : '') || '').trim(),
            tasks: rootTasks
        };

        if (docIndex >= 0) {
            state.taskTree[docIndex] = newDoc;
        } else {
            state.taskTree.push(newDoc);
        }
        try {
            __tmRememberDocSessionTaskEntry(newDoc, {
                docInfo,
                inTaskTree: true,
            });
        } catch (e) {}
        __tmInvalidateFilteredTaskDerivedStateCache();

        globalThis.__tmTaskStore?.removeFlatByDoc?.(docId);
        const flatten = (tasks) => {
            tasks.forEach(t => {
                globalThis.__tmTaskStore?.upsertLocal?.(t, { status: 'restore-doc-local' });
                if (t.children && t.children.length > 0) flatten(t.children);
            });
        };
        flatten(rootTasks);
        globalThis.__tmTaskStore?.replaceFlat?.(globalThis.__tmTaskStore?.getFlatMap?.() || state.flatTasks || {}, { mergeOtherBlocks: true });

        state.stats.queryTime = queryTime || 0;
        recalcStats();
        if (opts.applyFilters !== false) {
            __tmRecomputeTaskProjection({ reason: String(opts.reason || 'loaded-task-render').trim() || 'loaded-task-render' });
        }
        if (opts.render !== false) {
            render();
        }

        // 4. 持久化本次重载后的 MetaStore 状态
        if (opts.saveMeta !== false) {
            await MetaStore.saveNow();
        }
}

    const __tmFreshTaskDetailDocReloads = new Map();

    function __tmIsQuickbarTaskDetailOpenEvent(ev) {
        const target = ev?.target instanceof Element ? ev.target : null;
        if (!target) return false;
        try {
            return !!target.closest('.sy-custom-props-floatbar, .sy-custom-props-floatbar__action[data-action="more"]');
        } catch (e) {
            return false;
        }
    }

    async function __tmRefreshTaskDocForFreshDetail(taskId, fallbackTask = null, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const tid = String(taskId || fallbackTask?.id || '').trim();
        if (!tid && !(fallbackTask && typeof fallbackTask === 'object')) return null;
        const fallbackTitle = String(opts.fallbackTitle || '').trim();
        const fallbackContent = String(opts.fallbackContent || fallbackTitle || '').trim();
        const chooseText = (nextValue, fallbackValue) => {
            const nextText = String(nextValue || '').trim();
            if (nextText && nextText !== '(无内容)') return nextValue;
            const fallbackText = String(fallbackValue || '').trim();
            if (fallbackText && fallbackText !== '(无内容)') return fallbackValue;
            return nextValue;
        };
        const isEmptyTaskText = (value) => {
            let text = String(value || '').trim();
            if (!text) return true;
            try {
                if (typeof API?.extractTaskContentLine === 'function') {
                    text = String(API.extractTaskContentLine(text) || text).trim();
                }
            } catch (e) {}
            try {
                if (typeof API?.normalizeTaskContent === 'function') {
                    text = String(API.normalizeTaskContent(text) || text).trim();
                }
            } catch (e) {}
            text = text
                .replace(/^\s*(?:[-*+]|\d+[.)])\s*\[[^\]]*\]\s*/, '')
                .replace(/\s*\{:\s*[^}]*\}\s*$/g, '')
                .trim();
            return !text || text === '(无内容)';
        };
        const mergeTaskDetailData = (freshTask, sourceTask) => {
            const fresh = (freshTask && typeof freshTask === 'object') ? { ...freshTask } : null;
            const source = (sourceTask && typeof sourceTask === 'object') ? sourceTask : null;
            if (!fresh) return source ? { ...source } : null;
            if (!source) return fresh;
            fresh.content = chooseText(fresh.content, source.content);
            fresh.raw_content = chooseText(fresh.raw_content, source.raw_content || source.content);
            fresh.markdown = chooseText(fresh.markdown, source.markdown);
            fresh.otherBlockRawContent = chooseText(fresh.otherBlockRawContent, source.otherBlockRawContent);
            fresh.otherBlockContent = chooseText(fresh.otherBlockContent, source.otherBlockContent);
            fresh.docName = chooseText(fresh.docName, source.docName);
            fresh.doc_name = chooseText(fresh.doc_name, source.doc_name);
            fresh.h2 = chooseText(fresh.h2, source.h2);
            fresh.h2Id = chooseText(fresh.h2Id, source.h2Id);
            fresh.h2Path = chooseText(fresh.h2Path, source.h2Path);
            fresh.h2Created = chooseText(fresh.h2Created, source.h2Created);
            if (!Array.isArray(fresh.children) || fresh.children.length <= 0) {
                if (Array.isArray(source.children) && source.children.length > 0) fresh.children = source.children;
            }
            if (isEmptyTaskText(fresh.content) && fallbackContent) fresh.content = fallbackContent;
            if (isEmptyTaskText(fresh.raw_content) && fallbackContent) fresh.raw_content = fallbackContent;
            if (isEmptyTaskText(fresh.markdown) && fallbackContent) fresh.markdown = fallbackContent;
            if (isEmptyTaskText(fresh.otherBlockRawContent) && fallbackTitle) fresh.otherBlockRawContent = fallbackTitle;
            if (isEmptyTaskText(fresh.otherBlockContent) && fallbackTitle) fresh.otherBlockContent = fallbackTitle;
            return fresh;
        };
        const hasUsableTaskTitle = (taskLike) => {
            const candidates = [taskLike?.content, taskLike?.raw_content, taskLike?.markdown, taskLike?.otherBlockRawContent, taskLike?.otherBlockContent];
            return candidates.some((value) => !isEmptyTaskText(value));
        };
        let task = (fallbackTask && typeof fallbackTask === 'object') ? fallbackTask : null;
        if (!task && tid) {
            try {
                task = globalThis.__tmTaskBoundary?.getTask?.(tid) || null;
            } catch (e) { task = null; }
        }
        let docId = String(task?.root_id || task?.docId || '').trim();
        if (!docId && tid) {
            let blockTask = null;
            try { blockTask = await __tmBuildTaskLikeFromBlockId(tid); } catch (e) { blockTask = null; }
            if (blockTask && typeof blockTask === 'object') {
                task = task
                    ? {
                        ...blockTask,
                        ...task,
                        children: Array.isArray(task.children) ? task.children : blockTask.children,
                    }
                    : blockTask;
                docId = String(task?.root_id || task?.docId || '').trim();
            }
        }
        if (tid && (!hasUsableTaskTitle(task) || (fallbackTitle && isEmptyTaskText(task?.content)))) {
            let blockTask = null;
            try { blockTask = await __tmBuildTaskLikeFromBlockId(tid); } catch (e) { blockTask = null; }
            if (blockTask && typeof blockTask === 'object') {
                task = mergeTaskDetailData(task, blockTask) || blockTask;
                docId = String(task?.root_id || task?.docId || docId || '').trim();
            }
        }
        if (!docId) {
            if (!task && fallbackTitle) {
                return {
                    id: tid,
                    content: fallbackTitle,
                    raw_content: fallbackContent || fallbackTitle,
                    markdown: fallbackContent || fallbackTitle,
                };
            }
            if (task && fallbackTitle && isEmptyTaskText(task.content)) task.content = fallbackTitle;
            if (task && fallbackContent && isEmptyTaskText(task.raw_content)) task.raw_content = fallbackContent;
            return task;
        }
        try {
            if (typeof __tmFlushSqlTransactionsSafe === 'function') {
                await __tmFlushSqlTransactionsSafe(String(opts.source || 'task-detail-fresh-doc'));
            }
        } catch (e) {}
        let reloadPromise = __tmFreshTaskDetailDocReloads.get(docId);
        if (!reloadPromise) {
            reloadPromise = reloadDocTasksProtected(docId, null, null, null, {
                applyFilters: opts.applyFilters === true,
                render: false,
                saveMeta: false,
                forceFresh: opts.forceFresh !== false,
                forceDocFlowOrder: opts.forceDocFlowOrder === true,
                forceHeadingContext: opts.forceHeadingContext === true,
                preserveExistingSiblingOrder: opts.preserveExistingSiblingOrder !== false,
            });
            __tmFreshTaskDetailDocReloads.set(docId, reloadPromise);
        }
        try {
            await reloadPromise;
        } catch (e) {
            if (opts.throwOnFailure === true) throw e;
            return task;
        } finally {
            try {
                if (__tmFreshTaskDetailDocReloads.get(docId) === reloadPromise) {
                    __tmFreshTaskDetailDocReloads.delete(docId);
                }
            } catch (e) {}
        }
        const resolveFresh = (id) => {
            const targetId = String(id || '').trim();
            if (!targetId) return null;
            try {
                return (typeof __tmGetTaskDetailTaskById === 'function'
                    ? __tmGetTaskDetailTaskById(targetId, { includePending: true, preferPending: true, includeWhiteboard: true })
                    : null)
                    || globalThis.__tmTaskBoundary?.getTask?.(targetId)
                    || null;
            } catch (e) {
                return null;
            }
        };
        const freshTask = resolveFresh(tid) || resolveFresh(task?.id) || null;
        let mergedTask = mergeTaskDetailData(freshTask, task) || task;
        if (tid && (!hasUsableTaskTitle(mergedTask) || (fallbackTitle && isEmptyTaskText(mergedTask?.content)))) {
            let blockTask = null;
            try { blockTask = await __tmBuildTaskLikeFromBlockId(tid); } catch (e) { blockTask = null; }
            if (blockTask && typeof blockTask === 'object') {
                mergedTask = mergeTaskDetailData(mergedTask, blockTask) || blockTask;
            }
        }
        if (!mergedTask && fallbackTitle) {
            mergedTask = {
                id: tid,
                content: fallbackTitle,
                raw_content: fallbackContent || fallbackTitle,
                markdown: fallbackContent || fallbackTitle,
            };
        }
        if (mergedTask && fallbackTitle && isEmptyTaskText(mergedTask.content)) mergedTask.content = fallbackTitle;
        if (mergedTask && fallbackContent && isEmptyTaskText(mergedTask.raw_content)) mergedTask.raw_content = fallbackContent;
        return mergedTask;
    }

    try { globalThis.__tmRefreshTaskDocForFreshDetail = __tmRefreshTaskDocForFreshDetail; } catch (e) {}

    function __tmScheduleTaskDetailDocumentReconcile(taskId, fallbackTask = null, options = {}) {
        const tid = String(taskId || fallbackTask?.id || '').trim();
        if (!tid) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        const source = String(opts.source || 'task-detail-open-background').trim() || 'task-detail-open-background';
        const run = () => {
            Promise.resolve(__tmRefreshTaskDocForFreshDetail(tid, fallbackTask, {
                source,
                forceFresh: true,
            })).then(() => {
                try {
                    globalThis.__tmProjectVisibleTaskDetailSubtasks?.([tid]);
                    __tmRefreshVisibleTaskDetailForTask(tid, {
                        patch: {
                            content: true,
                            done: true,
                            customStatus: true,
                            priority: true,
                            startDate: true,
                            completionTime: true,
                            taskCompleteAt: true,
                            duration: true,
                            tomatoEstimateCount: true,
                            tomatoCount: true,
                            pinned: true,
                            remark: true,
                            attachments: true,
                            customFieldValues: true,
                            location: true,
                        },
                        source,
                    });
                } catch (e) {}
            }).catch(() => null);
        };
        try {
            if (typeof requestIdleCallback === 'function') {
                requestIdleCallback(run, { timeout: 1200 });
            } else {
                setTimeout(run, 180);
            }
        } catch (e) {
            try { setTimeout(run, 180); } catch (e2) {}
        }
        return true;
    }

    window.tmOpenTaskDetail = async function(id, ev, options = {}) {
        const detailOpenOptions = (options && typeof options === 'object') ? options : {};
        const isQuickbarDetailOpen = String(detailOpenOptions.source || '').trim() === 'quickbar-detail-open'
            || __tmIsQuickbarTaskDetailOpenEvent(ev);
        const shouldFreshenDetailOpen = detailOpenOptions.forceFresh === true || isQuickbarDetailOpen;
        const shouldReconcileDetailOpen = detailOpenOptions.reconcile === true;
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}
        try {
            if (typeof __tmIsTaskDetailNoteViewEventTarget === 'function' && __tmIsTaskDetailNoteViewEventTarget(ev?.target)) return false;
        } catch (e) {}
        const originalId = String(id || '').trim();
        let tid = originalId;
        try {
            const optimisticResolvedId = typeof __tmResolveOptimisticTaskId === 'function'
                ? String(__tmResolveOptimisticTaskId(originalId) || '').trim()
                : '';
            if (optimisticResolvedId) tid = optimisticResolvedId;
        } catch (e) {}
        if (!tid) return false;
        const cachedTask = globalThis.__tmTaskBoundary?.getTask?.(tid) || null;
        const recurringSourceId = __tmResolveRecurringInstanceSourceTaskId(tid, cachedTask);
        if (recurringSourceId && recurringSourceId !== tid) tid = recurringSourceId;
        if (!globalThis.__tmTaskBoundary?.getTask?.(tid)) {
            const resolved = await __tmResolveTaskIdFromAnyBlockId(tid);
            if (resolved) tid = resolved;
        }
        let task = globalThis.__tmTaskBoundary?.getTask?.(tid) || null;
        try {
            task = (typeof __tmGetTaskDetailTaskById === 'function'
                ? __tmGetTaskDetailTaskById(tid, { includePending: true, preferPending: true, includeWhiteboard: true })
                : null)
                || task;
        } catch (e) {}
        if (!task) {
            try { task = await __tmEnsureTaskInStateById(tid); } catch (e) { task = null; }
        }
        if (!task) {
            try { task = await __tmBuildTaskLikeFromBlockId(tid); } catch (e) { task = null; }
        }
        if (!task && originalId && originalId !== tid) {
            try { task = await __tmBuildTaskLikeFromBlockId(originalId); } catch (e) { task = null; }
            if (task?.id) tid = String(task.id || '').trim() || tid;
        }
        if (!task) {
            try { hint('⚠️ 未找到任务数据，无法打开详情', 'warning'); } catch (e) {}
            return false;
        }
        if (__tmIsRecurringInstanceTask(task)) {
            const sourceTaskId = String(task?.sourceTaskId || task?.recurringSourceTaskId || '').trim();
            if (sourceTaskId) {
                return await window.tmOpenTaskDetail(sourceTaskId, ev, detailOpenOptions);
            }
        }

        // 文档 quickbar 与首页都可能遇到残留的工作区视图状态，只有工作区内部请求才走 Sheet/看板浮层。
        const activeRenderMode = globalThis.__tmRuntimeState?.getActiveRenderMode?.('') || (state.homepageOpen ? 'home' : String(state.viewMode || '').trim());
        const useTaskDetailSheetMode = !isQuickbarDetailOpen
            && !!globalThis.__tmViewPolicy?.shouldUseTaskDetailSheetMode?.(activeRenderMode, state.modal);
        const detailButton = ev?.target?.closest?.('.tm-kanban-more');
        const detailCard = detailButton?.closest?.('.tm-kanban-card');
        const isCardDetailButtonClick = !!(detailButton && detailCard && !detailButton.closest('#tmKanbanDetailFloat,#tm-task-detail-overlay,#tmTaskDetailSheet'));
        const isSameDetailTask = (value) => {
            const currentId = String(value || '').trim();
            if (!currentId) return false;
            try {
                return typeof __tmAreTaskDetailIdsEquivalent === 'function'
                    ? __tmAreTaskDetailIdsEquivalent(currentId, tid)
                    : currentId === tid;
            } catch (e) {
                return currentId === tid;
            }
        };
        if (isCardDetailButtonClick) {
            if (useTaskDetailSheetMode
                && state.checklistDetailSheetOpen === true
                && isSameDetailTask(state.detailTaskId)
                && typeof window.tmTaskDetailSheetClose === 'function') {
                await window.tmTaskDetailSheetClose?.(ev);
                return true;
            }
            const kanbanDetailFloat = state.modal?.querySelector?.('#tmKanbanDetailFloat');
            if (activeRenderMode === 'kanban'
                && !__tmIsMobileDevice()
                && kanbanDetailFloat instanceof HTMLElement
                && isSameDetailTask(state.kanbanDetailTaskId)) {
                await __tmCloseKanbanDetailFloating();
                return true;
            }
            const standaloneOverlay = document.getElementById('tm-task-detail-overlay');
            const standaloneTaskId = String(standaloneOverlay?.__tmTaskDetailTaskId || standaloneOverlay?.dataset?.tmDetailTaskId || standaloneOverlay?.__tmTaskDetailTask?.id || '').trim();
            if (standaloneOverlay instanceof HTMLElement
                && isSameDetailTask(standaloneTaskId)
                && typeof standaloneOverlay.__tmTaskDetailOnClose === 'function') {
                await standaloneOverlay.__tmTaskDetailOnClose?.();
                return true;
            }
        }
        if (shouldFreshenDetailOpen) {
            try {
                const freshTask = await __tmRefreshTaskDocForFreshDetail(tid, task, {
                    source: String(detailOpenOptions.source || 'quickbar-detail-open').trim() || 'quickbar-detail-open',
                    fallbackTitle: String(detailOpenOptions.fallbackTitle || '').trim(),
                    fallbackContent: String(detailOpenOptions.fallbackContent || detailOpenOptions.fallbackTitle || '').trim(),
                });
                if (freshTask && typeof freshTask === 'object') {
                    task = freshTask;
                    tid = String(task.id || tid).trim() || tid;
                }
            } catch (e) {}
        } else if (shouldReconcileDetailOpen) {
            __tmScheduleTaskDetailDocumentReconcile(tid, task, {
                source: `${String(detailOpenOptions.source || 'task-detail-open').trim() || 'task-detail-open'}-background`,
            });
        }
        if (useTaskDetailSheetMode) {
            await __tmOpenTaskDetailSheetInPlace(tid, {
                source: `${String(activeRenderMode || 'task').trim() || 'task'}-detail-open`,
                task,
            });
            const docId = String(task?.root_id || task?.docId || '').trim();
            if (docId) {
                try { Promise.resolve(__tmWarmKanbanDocHeadings([docId], { force: true })).catch(() => null); } catch (e) {}
            }
            return true;
        }
        try {
            task = await __tmEnsureTaskDetailFieldAttrs(task, {
                taskId: tid,
                source: shouldFreshenDetailOpen ? 'fresh-detail-open' : 'task-detail-open',
                force: true,
            }) || task;
        } catch (e) {}
        try {
            task = __tmCacheTaskInState(task, {
                docNameFallback: task.doc_name || task.docName || '未命名文档'
            }) || task;
        } catch (e) {}
        {
            const docId = String(task?.root_id || task?.docId || '').trim();
            if (docId) {
                try { Promise.resolve(__tmWarmKanbanDocHeadings([docId], { force: true })).catch(() => null); } catch (e) {}
            }
        }
        if (!isQuickbarDetailOpen && activeRenderMode === 'kanban' && !__tmIsMobileDevice()) {
            if (!__tmOpenKanbanDetailFloatingInPlace(tid, state.modal, { task })) {
                state.kanbanDetailTaskId = tid;
                state.kanbanDetailAnchorTaskId = tid;
                render();
            }
            return true;
        }

        try { globalThis.__tmDisposeTaskDetailRoot?.(document.getElementById('tm-task-detail-overlay')); } catch (e) {}
        __tmRemoveElementsById('tm-task-detail-overlay');

        const overlay = document.createElement('div');
        overlay.id = 'tm-task-detail-overlay';
        overlay.className = 'tm-task-detail-overlay'
            + (SettingsStore.data.taskCheckboxCircleStyleEnabled === true ? ' tm-task-detail--task-checkbox-circle' : '');

        try {
            __tmPushDetailDebug('detail-rebuild-html', {
                taskId: tid,
                embedded: false,
                source: 'standalone-overlay-open',
                rootTag: __tmDescribeDebugElement(overlay),
                pendingSave: overlay.__tmTaskDetailPendingSave === true,
                hasActivePopover: !!overlay.__tmTaskDetailActiveInlinePopover,
                refreshHoldMsLeft: Math.max(0, Number(overlay.__tmTaskDetailRefreshHoldUntil || 0) - Date.now()),
            });
        } catch (e) {}
        overlay.innerHTML = __tmBuildTaskDetailInnerHtml(task, { embedded: false });

        const onKeydown = (e) => {
            if (e.key !== 'Escape') return;
            try { e.preventDefault(); } catch (err) {}
            try { e.stopPropagation(); } catch (err) {}
            close().catch(() => null);
        };
        const close = async () => {
            return await __tmRunTaskDetailClose(overlay, async () => {
                try { globalThis.__tmRuntimeEvents?.off?.(document, 'keydown', onKeydown, true); } catch (e) {}
                try { globalThis.__tmDisposeTaskDetailRoot?.(overlay); } catch (e) {}
                try { overlay.remove(); } catch (e) {}
            }, { holdMs: 900 });
        };
        let overlayPointerStartedOnBackdrop = false;
        overlay.addEventListener('pointerdown', (e) => {
            overlayPointerStartedOnBackdrop = e.target === overlay;
        }, true);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay && overlayPointerStartedOnBackdrop) close().catch(() => null);
            overlayPointerStartedOnBackdrop = false;
        });
        document.body.appendChild(overlay);
        try { overlay.__tmTaskDetailOnClose = close; } catch (e) {}
        __tmBindTaskDetailEditor(overlay, tid, { embedded: false, source: 'standalone-overlay-open', onClose: close, task });
        __tmApplyPopupOpenAnimation(overlay, overlay.querySelector('.tm-task-detail'), {
            mode: window.matchMedia?.('(max-width: 640px)')?.matches ? 'sheet' : 'center'
        });
        try { globalThis.__tmRuntimeEvents?.on?.(document, 'keydown', onKeydown, true); } catch (e) {}
        return true;
    };

    window.tmToggleTaskDetailCompletedSubtasks = function(taskId, nextValue) {
        const tid = String(taskId || '').trim();
        if (!tid && typeof __tmCollectVisibleTaskDetailTargetIds !== 'function') return false;
        const enabled = typeof nextValue === 'boolean'
            ? nextValue
            : !__tmShouldShowCompletedSubtasksForTask(tid);
        __tmSetCompletedSubtasksVisibilityForTask(tid, enabled);
        try { SettingsStore.syncToLocal(); } catch (e) {}
        try { SettingsStore.save(); } catch (e) {}
        try {
            const targets = typeof __tmCollectVisibleTaskDetailTargetIds === 'function'
                ? __tmCollectVisibleTaskDetailTargetIds()
                : [tid].filter(Boolean);
            globalThis.__tmProjectVisibleTaskDetailSubtasks?.(targets);
        } catch (e) {}
        try { hint(enabled ? '✅ 已显示已完成子任务' : '✅ 已隐藏已完成子任务', 'success'); } catch (e) {}
        return enabled;
    };

    // 辅助：手动插入任务到树中（支持位置控制）
    // position: 'before' | 'after' | 'child'
    // Removed manualInsertTaskToTree

    // Removed pollTaskInfo

    // Removed tmInsertSiblingAbove

    // Removed tmInsertSiblingBelow

    // Removed tmInsertChildTask

    function __tmStripLeadingTaskListMarkerFromContent(input) {
        return String(input || '').replace(/^\s*(?:(?:[-*+]|\d+[.)])\s*\[[^\]]?\]\s*)+/, '').trim();
    }

    function __tmNormalizeTaskContentEditInput(input) {
        const raw = String(input || '').replace(/\r\n?/g, '\n').trim();
        if (!raw) return '';
        let strippedFirstContentLine = false;
        const lines = raw.split('\n').map((line) => {
            const text = String(line || '').trim();
            if (!text) return '';
            if (!strippedFirstContentLine) {
                strippedFirstContentLine = true;
                return __tmStripLeadingTaskListMarkerFromContent(text);
            }
            return text;
        }).filter(Boolean);
        return lines.join(' ').replace(/\s{2,}/g, ' ').trim();
    }

    function __tmBuildTaskMarkdownWithContent(taskLike, nextContent) {
        const task = (taskLike && typeof taskLike === 'object') ? taskLike : {};
        const text = __tmNormalizeTaskContentEditInput(nextContent);
        if (!text) throw new Error('任务内容不能为空');
        let nextMarkdown = String(task.markdown || '').trim();
        const checked = !!task.done;
        const normalizedFirstLine = `- [${checked ? 'x' : ' '}] ${text}`;
        if (!nextMarkdown) {
            nextMarkdown = normalizedFirstLine;
        } else {
            const lines = String(nextMarkdown).split(/\r?\n/);
            lines[0] = normalizedFirstLine;
            nextMarkdown = lines.join('\n');
        }
        return nextMarkdown;
    }

    function __tmRefreshContentPatchPresentation(taskId, patch = {}, options = {}, fallbackReason = 'content-patch-local') {
        const tid = String(taskId || '').trim();
        const nextPatch = (patch && typeof patch === 'object') ? patch : {};
        const opts = (options && typeof options === 'object') ? options : {};
        if (!tid || !Object.keys(nextPatch).length || opts.render === false) return false;
        const reason = String(opts.reason || opts.source || fallbackReason).trim() || fallbackReason;
        try {
            const task = globalThis.__tmTaskStore?.getProjected?.(tid)
                || globalThis.__tmTaskBoundary?.getTask?.(tid)
                || null;
            globalThis.__tmTaskMutationBus?.publish?.({
                type: 'contentPatch',
                phase: 'local',
                taskId: tid,
                docId: String(task?.root_id || task?.docId || '').trim(),
                source: reason,
                patch: { ...nextPatch },
                data: {
                    presentation: {
                        preserveActiveDetail: opts.skipDetailPatch === true,
                        allowMountedInactive: opts.allowMountedInactive === true,
                    },
                },
            });
            return true;
        } catch (e) {}
        return false;
    }

    function __tmApplyContentPatchLocally(taskId, nextContent, options = {}) {
        const tid = String(taskId || '').trim();
        if (typeof __tmIsMutationTaskPendingDeleted === 'function' && __tmIsMutationTaskPendingDeleted(tid)) return false;
        const task = globalThis.__tmTaskBoundary?.getTask?.(tid) || null;
        if (!task) return false;
        const text = __tmNormalizeTaskContentEditInput(nextContent);
        if (!text) return false;
        const retentionPatch = typeof __tmProtectMarkdownMutationTaskFields === 'function'
            ? __tmProtectMarkdownMutationTaskFields(tid, task, { source: 'content-patch-local' })
            : {};
        const nextMarkdown = __tmBuildTaskMarkdownWithContent(task, text);
        const patch = {
            content: text,
            markdown: nextMarkdown,
            raw_content: text,
            rawContent: text,
        };
        const presentationPatch = { content: text, markdown: nextMarkdown };
        const applied = globalThis.__tmTaskStore?.patchLocal?.(tid, patch, {
            source: String(options.source || 'content-patch-local').trim() || 'content-patch-local',
        });
        if (applied !== true) return false;
        try {
            __tmMarkLocalTaskPatchWatermark(tid, presentationPatch, {
                source: String(options.source || 'content-patch-local').trim() || 'content-patch-local',
            });
        } catch (e) {}
        try {
            __tmScheduleTaskSnapshotAfterLocalPatch?.(tid, {
                ...((retentionPatch && typeof retentionPatch === 'object') ? retentionPatch : {}),
                content: text,
            }, {
                ...((options && typeof options === 'object') ? options : {}),
                source: String(options.source || 'content-patch-local').trim() || 'content-patch-local',
            });
        } catch (e) {}
        __tmRefreshContentPatchPresentation(tid, presentationPatch, options, 'content-patch-local');
        return true;
    }

    function __tmQueueMoveTask(taskId, payload = {}, options = {}) {
        const tid = String(taskId || '').trim();
        if (typeof __tmIsMutationTaskPendingDeleted === 'function' && __tmIsMutationTaskPendingDeleted(tid)) {
            return Promise.reject(new Error('任务已删除，移动已取消'));
        }
        const task = globalThis.__tmTaskBoundary?.getTask?.(tid) || null;
        const data = (payload && typeof payload === 'object') ? payload : {};
        const hooks = (options && typeof options === 'object') ? options : {};
        const targetDocId = String(data.targetDocId || '').trim();
        const rawMode = String(data.mode || '').trim() || 'docTop';
        const mode = String(globalThis.__tmTaskStore?.normalizeMoveMode?.(rawMode) || (rawMode === 'doc' ? 'docTop' : rawMode)).trim() || 'docTop';
        if (!tid || !task || !targetDocId) throw new Error('移动目标无效');
        const snapshot = __tmCaptureTaskLocalSnapshot(tid);
        const shouldWait = hooks.wait === true || data.wait === true;
        let pendingPromise = null;
        const opPromise = __tmEnqueueQueuedOp({
            type: 'moveTask',
            docId: String(task.root_id || task.docId || '').trim() || targetDocId,
            laneKey: targetDocId ? `doc:${targetDocId}` : `task:${tid}`,
            data: {
                taskId: tid,
                targetDocId,
                targetTaskId: String(data.targetTaskId || '').trim(),
                targetParentTaskId: String(data.targetParentTaskId || '').trim(),
                targetListId: String(data.targetListId || '').trim(),
                targetChildListId: String(data.targetChildListId || '').trim(),
                targetFirstDirectChildId: String(data.targetFirstDirectChildId || '').trim(),
                targetHeadingId: String(data.targetHeadingId || '').trim(),
                targetHeading: String(data.targetHeading || '').trim(),
                targetHeadingRank: Number(data.targetHeadingRank),
                prevSiblingTaskId: String(data.prevSiblingTaskId || '').trim(),
                targetContentAnchorId: String(data.targetContentAnchorId || '').trim(),
                targetLastDirectChildId: String(data.targetLastDirectChildId || '').trim(),
                headingId: String(data.headingId || '').trim(),
                mode,
                resolveOutdent: data.resolveOutdent === true,
                outdentResolved: data.outdentResolved === true,
                snapshot,
                customOrderPlacement: data.customOrderPlacement === true,
                preserveRenderWindow: data.preserveRenderWindow === true || hooks.preserveRenderWindow === true,
                preserveTargetCollapse: data.preserveTargetCollapse === true,
                crossDoc: String(String(task.docId || task.root_id || '').trim() !== targetDocId ? '1' : ''),
                showErrorHint: hooks.showErrorHint !== false && typeof hooks.onError !== 'function',
                suppressHint: hooks.suppressHint === true,
            },
        }, {
            wait: shouldWait,
            onPending: (promise, op) => {
                pendingPromise = promise;
                try { hooks.onPending?.(promise, op); } catch (e) {}
            },
        });
        try { hooks.onQueued?.(); } catch (e) {}
        if (!shouldWait) {
            const settlePromise = pendingPromise || opPromise;
            settlePromise.then((result) => {
                try { hooks.onSuccess?.(result); } catch (e) {}
            }).catch((e) => {
                try { hooks.onError?.(e); } catch (e2) {}
            }).finally(() => {
                try { hooks.onFinally?.(); } catch (e) {}
            });
        }
        return shouldWait ? opPromise : Promise.resolve(tid);
    }

    function __tmQueueBatchMoveTasks(taskIds, payload = {}, options = {}) {
        const ids = Array.from(new Set((Array.isArray(taskIds) ? taskIds : [])
            .map((id) => String(id || '').trim())
            .filter(Boolean)));
        if (ids.length < 2) return Promise.reject(new Error('批量移动至少需要两个任务'));
        if (ids.some((id) => typeof __tmIsMutationTaskPendingDeleted === 'function' && __tmIsMutationTaskPendingDeleted(id))) {
            return Promise.reject(new Error('选中的任务已删除，移动已取消'));
        }
        const tasks = ids.map((id) => globalThis.__tmTaskBoundary?.getTask?.(id) || null);
        const data = (payload && typeof payload === 'object') ? payload : {};
        const hooks = (options && typeof options === 'object') ? options : {};
        const targetDocId = String(data.targetDocId || '').trim();
        const targetTaskId = String(data.targetTaskId || '').trim();
        const rawMode = String(data.mode || 'child').trim() || 'child';
        const mode = String(globalThis.__tmTaskStore?.normalizeMoveMode?.(rawMode) || rawMode).trim() || 'child';
        if (tasks.some((task) => !task) || !targetDocId || !targetTaskId || !['child', 'child-top'].includes(mode)) {
            return Promise.reject(new Error('批量移动目标无效'));
        }
        const snapshots = ids.map((id) => __tmCaptureTaskLocalSnapshot(id));
        const sourceDocIds = Array.from(new Set(tasks
            .map((task) => String(task?.root_id || task?.docId || '').trim())
            .filter(Boolean)));
        const shouldWait = hooks.wait === true || data.wait === true;
        let pendingPromise = null;
        const opPromise = __tmEnqueueQueuedOp({
            type: 'batchMoveTasks',
            docId: sourceDocIds[0] || targetDocId,
            laneKey: 'doc:' + targetDocId,
            data: {
                taskIds: ids,
                targetDocId,
                targetTaskId,
                targetChildListId: String(data.targetChildListId || '').trim(),
                requestedChildListId: String(data.requestedChildListId || '').trim(),
                mode,
                snapshots,
                sourceDocIds,
                customOrderPlacement: data.customOrderPlacement === true,
                preserveRenderWindow: data.preserveRenderWindow === true || hooks.preserveRenderWindow === true,
                preserveTargetCollapse: data.preserveTargetCollapse === true,
                showErrorHint: hooks.showErrorHint !== false && typeof hooks.onError !== 'function',
                suppressHint: hooks.suppressHint === true,
            },
        }, {
            wait: shouldWait,
            onPending: (promise, op) => {
                pendingPromise = promise;
                try { hooks.onPending?.(promise, op); } catch (e) {}
            },
        });
        try { hooks.onQueued?.(); } catch (e) {}
        if (!shouldWait) {
            const settlePromise = pendingPromise || opPromise;
            settlePromise.then((result) => {
                try { hooks.onSuccess?.(result); } catch (e) {}
            }).catch((e) => {
                try { hooks.onError?.(e); } catch (e2) {}
            }).finally(() => {
                try { hooks.onFinally?.(); } catch (e) {}
            });
        }
        return shouldWait ? opPromise : Promise.resolve(ids);
    }

    function __tmGetTaskForDetachSubtask(taskOrId) {
        if (taskOrId && typeof taskOrId === 'object') return taskOrId;
        const rawId = String(taskOrId || '').trim();
        if (!rawId) return null;
        const resolvedId = typeof __tmResolveOptimisticTaskId === 'function'
            ? (String(__tmResolveOptimisticTaskId(rawId) || rawId).trim() || rawId)
            : rawId;
        return (typeof __tmGetTaskDetailTaskById === 'function'
            ? __tmGetTaskDetailTaskById(resolvedId, { includePending: true, preferPending: true, includeWhiteboard: true })
            : null)
            || globalThis.__tmTaskBoundary?.getTask?.(resolvedId)
            || (rawId !== resolvedId ? globalThis.__tmTaskBoundary?.getTask?.(rawId) : null)
            || null;
    }

    function __tmBuildDetachSubtaskInfo(taskOrId) {
        const task = __tmGetTaskForDetachSubtask(taskOrId);
        if (!(task && typeof task === 'object')) return null;
        if (typeof __tmIsTaskDetailWhiteboardSnapshotTask === 'function' && __tmIsTaskDetailWhiteboardSnapshotTask(task)) return null;
        const rawTaskId = String(task.id || task.blockId || (typeof taskOrId === 'string' ? taskOrId : '') || '').trim();
        const taskId = rawTaskId && typeof __tmResolveOptimisticTaskId === 'function'
            ? (String(__tmResolveOptimisticTaskId(rawTaskId) || rawTaskId).trim() || rawTaskId)
            : rawTaskId;
        if (!taskId) return null;
        const parentInfo = typeof __tmGetTaskDetailParentInfo === 'function'
            ? __tmGetTaskDetailParentInfo(task, { includePending: true, preferPending: true, includeWhiteboard: true })
            : null;
        if (!parentInfo?.id || !(parentInfo.task && typeof parentInfo.task === 'object')) return null;
        if (typeof __tmIsTaskDetailWhiteboardSnapshotTask === 'function' && __tmIsTaskDetailWhiteboardSnapshotTask(parentInfo.task)) return null;
        let targetParentTaskId = typeof __tmResolveTaskDetailParentTaskId === 'function'
            ? __tmResolveTaskDetailParentTaskId(parentInfo.task)
            : String(parentInfo.task.parentTaskId || parentInfo.task.parent_task_id || '').trim();
        if (targetParentTaskId === taskId) targetParentTaskId = '';
        const targetDocId = String(parentInfo.task.root_id || parentInfo.task.docId || task.root_id || task.docId || '').trim();
        if (!targetDocId) return null;
        return {
            task,
            taskId,
            parentTask: parentInfo.task,
            parentTaskId: String(parentInfo.id || '').trim(),
            parentTitle: String(parentInfo.title || '').trim(),
            targetParentTaskId,
            targetDocId,
        };
    }

    function __tmCanDetachSubtaskFromParent(taskOrId) {
        return !!__tmBuildDetachSubtaskInfo(taskOrId);
    }

    async function __tmResolveAuthoritativeDetachSubtaskInfo(info) {
        const current = (info && typeof info === 'object') ? info : null;
        const taskId = String(current?.taskId || '').trim();
        if (!current || !taskId || typeof __tmReadQueuedTaskPlacement !== 'function') return null;
        const taskPlacement = await __tmReadQueuedTaskPlacement(taskId);
        const parentTaskId = String(taskPlacement?.parentTaskId || '').trim();
        if (!parentTaskId || parentTaskId === taskId) return null;
        const parentPlacement = await __tmReadQueuedTaskPlacement(parentTaskId);
        return {
            ...current,
            parentTaskId,
            targetParentTaskId: String(parentPlacement?.parentTaskId || '').trim(),
            targetListId: String(parentPlacement?.parentListId || '').trim(),
            targetDocId: String(taskPlacement?.documentId || parentPlacement?.documentId || current.targetDocId || '').trim(),
        };
    }

    window.tmDetachSubtaskFromParent = async function(taskId, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        let info = __tmBuildDetachSubtaskInfo(taskId);
        if (!info) {
            if (opts.silent !== true) hint('⚠️ 未找到可移出的父任务', 'warning');
            return false;
        }
        try {
            info = await __tmResolveAuthoritativeDetachSubtaskInfo(info) || info;
        } catch (e) {}
        if (!info?.parentTaskId || !info?.targetDocId) {
            if (opts.silent !== true) hint('⚠️ 无法确认当前父子结构，请稍后重试', 'warning');
            return false;
        }
        const shouldWait = opts.wait === true;
        const payload = {
            mode: 'after',
            targetDocId: info.targetDocId,
            targetTaskId: info.parentTaskId,
            targetParentTaskId: info.targetParentTaskId,
            targetListId: info.targetListId,
            resolveOutdent: true,
            outdentResolved: true,
        };
        const onSuccess = () => {
            if (opts.silent !== true) hint('✅ 已移出子任务', 'success');
        };
        const onError = (e) => {
            if (opts.silent !== true) hint(`❌ 移出子任务失败: ${String(e?.message || e || '未知错误')}`, 'error');
        };
        try {
            const result = await __tmQueueMoveTask(info.taskId, payload, {
                wait: shouldWait,
                onSuccess,
                onError,
            });
            if (shouldWait) onSuccess();
            return result !== false;
        } catch (e) {
            onError(e);
            return false;
        }
    };

    function __tmRollbackContentPatchLocally(taskId, inversePatch, options = {}) {
        const tid = String(taskId || '').trim();
        if (typeof __tmIsMutationTaskPendingDeleted === 'function' && __tmIsMutationTaskPendingDeleted(tid)) return false;
        const task = globalThis.__tmTaskBoundary?.getTask?.(tid) || null;
        if (!task) return false;
        try { __tmProtectMarkdownMutationTaskFields?.(tid, task, { source: 'content-patch-rollback' }); } catch (e) {}
        const prev = (inversePatch && typeof inversePatch === 'object') ? inversePatch : {};
        const rollbackPatch = {};
        if (Object.prototype.hasOwnProperty.call(prev, 'content')) rollbackPatch.content = String(prev.content || '').trim();
        if (Object.prototype.hasOwnProperty.call(prev, 'markdown')) rollbackPatch.markdown = String(prev.markdown || '').trim();
        if (Object.prototype.hasOwnProperty.call(prev, 'raw_content')) rollbackPatch.raw_content = String(prev.raw_content || '').trim();
        if (Object.prototype.hasOwnProperty.call(prev, 'rawContent')) rollbackPatch.rawContent = String(prev.rawContent || '').trim();
        if (!Object.keys(rollbackPatch).length) return false;
        const rolledBack = globalThis.__tmTaskStore?.patchLocal?.(tid, rollbackPatch, {
            source: 'content-patch-rollback',
        });
        if (rolledBack !== true) return false;
        const presentationPatch = {};
        if (Object.prototype.hasOwnProperty.call(rollbackPatch, 'content')) presentationPatch.content = rollbackPatch.content;
        if (Object.prototype.hasOwnProperty.call(rollbackPatch, 'markdown')) presentationPatch.markdown = rollbackPatch.markdown;
        if (Object.keys(presentationPatch).length) {
            __tmRefreshContentPatchPresentation(tid, presentationPatch, options, 'content-patch-rollback');
        }
        return true;
    }

    async function __tmUpdateTaskContentBlockKernel(taskOrId, nextContent, options = {}) {
        const tid = typeof taskOrId === 'string'
            ? String(taskOrId || '').trim()
            : String(taskOrId?.id || '').trim();
        if (typeof __tmIsMutationTaskPendingDeleted === 'function' && __tmIsMutationTaskPendingDeleted(tid)) {
            throw new Error('任务已删除，写入已取消');
        }
        const task = tid
            ? (
                globalThis.__tmTaskBoundary?.getTask?.(tid) || null
            )
            : null;
        if (!task) throw new Error('未找到任务');
        const isPendingTask = !!state.pendingInsertedTasks?.[tid];
        if (options.fromQueue !== true && ((typeof __tmIsOptimisticTempTaskId === 'function' && __tmIsOptimisticTempTaskId(tid)) || isPendingTask)) {
            return await __tmQueueTaskContentPatch(taskOrId, nextContent, {
                ...((options && typeof options === 'object') ? options : {}),
                wait: false,
                renderOptimistic: true,
                skipInteractionGate: true,
            });
        }

        const text = __tmNormalizeTaskContentEditInput(nextContent);
        if (!text) throw new Error('任务内容不能为空');

        try { __tmProtectMarkdownMutationTaskFields?.(tid, task, { source: 'content-patch-kernel' }); } catch (e) {}
        const nextMarkdown = __tmBuildTaskMarkdownWithContent(task, text);

        const contentBlockId = String(await API.getTaskContentBlockId(tid) || '').trim();
        if (!contentBlockId) {
            throw new Error('未找到任务内容块，已取消写入');
        }
        await __tmBackendAdapter.updateBlock(contentBlockId, text);
        if (options.touchState !== false) {
            task.content = text;
            task.markdown = nextMarkdown;
        }
        return task;
    }

    function __tmQueueTaskContentPatch(taskOrId, nextContent, options = {}) {
        const tid = typeof taskOrId === 'string'
            ? String(taskOrId || '').trim()
            : String(taskOrId?.id || '').trim();
        if (typeof __tmIsMutationTaskPendingDeleted === 'function' && __tmIsMutationTaskPendingDeleted(tid)) {
            return Promise.reject(new Error('任务已删除，写入已取消'));
        }
        const task = tid
            ? (
                globalThis.__tmTaskBoundary?.getTask?.(tid) || null
            )
            : null;
        if (!tid || !task) return Promise.reject(new Error('未找到任务'));
        const text = __tmNormalizeTaskContentEditInput(nextContent);
        if (!text) return Promise.reject(new Error('任务内容不能为空'));
        const docId = String(options.docId || task.root_id || task.docId || '').trim();
        const inversePatch = {
            content: String(task.content || '').trim(),
            markdown: String(task.markdown || '').trim(),
            raw_content: String(task.raw_content ?? task.rawContent ?? task.content ?? '').trim(),
            rawContent: String(task.rawContent ?? task.raw_content ?? task.content ?? '').trim(),
        };
        let nextMarkdown = '';
        try {
            nextMarkdown = __tmBuildTaskMarkdownWithContent(task, text);
        } catch (e) {
            nextMarkdown = `- [${task.done ? 'x' : ' '}] ${text}`;
        }
        return __tmEnqueueQueuedOp({
            type: 'contentPatch',
            docId,
            laneKey: `task:${tid}`,
            data: {
                taskId: tid,
                nextContent: text,
                nextMarkdown,
                docId,
                renderOptimistic: options.renderOptimistic !== false,
                skipInteractionGate: options.skipInteractionGate === true,
                showErrorHint: options.showErrorHint !== false,
                suppressHint: options.suppressHint === true,
            },
            inversePatch,
        }, {
            wait: !!options.wait,
            onPending: typeof options.onPending === 'function' ? options.onPending : undefined,
        });
    }

    function __tmUpdateTaskContentBlock(taskOrId, nextContent, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        if (opts.queued === true || opts.background === true) {
            return __tmQueueTaskContentPatch(taskOrId, nextContent, {
                wait: opts.background !== true,
                docId: opts.docId,
                renderOptimistic: opts.renderOptimistic !== false,
                skipInteractionGate: opts.skipInteractionGate === true || opts.background === true,
                showErrorHint: opts.showErrorHint !== false,
                suppressHint: opts.suppressHint === true,
                onPending: typeof opts.onPending === 'function' ? opts.onPending : undefined,
            });
        }
        return __tmUpdateTaskContentBlockKernel(taskOrId, nextContent, opts);
    }

    function __tmHintQueuedTaskOperation(savePromise, getOpId, messages = {}) {
        const msg = (messages && typeof messages === 'object') ? messages : {};
        const successText = String(msg.success || '✅ 任务已同步');
        const failedPrefix = String(msg.failedPrefix || '更新失败');
        Promise.resolve(savePromise).catch((e) => {
            try { hint(`❌ ${failedPrefix}: ${e.message || '未知错误'}`, 'error'); } catch (err) {}
        });
        Promise.resolve(savePromise).then((result) => {
            const opId = String((typeof getOpId === 'function' ? getOpId() : '') || result || '').trim();
            if (!opId || !globalThis.__tmTaskMutations?.onSettle) return;
            globalThis.__tmTaskMutations.onSettle({ opId }, (detail) => {
                try {
                    if (detail?.status === 'done') hint(successText, 'success');
                    else if (detail?.status === 'failed') hint(`❌ ${failedPrefix}: ${detail?.error?.message || '未知错误'}`, 'error');
                } catch (err) {}
            }, { once: true });
        }).catch(() => null);
    }

    // 编辑任务
    window.tmEdit = async function(id) {
        const tid = String(id || '').trim();
        const task = globalThis.__tmTaskBoundary?.getTask?.(tid) || null;
        if (!task) return;
        if (!__tmEnsureEditableTaskLike(task, '编辑内容')) return;

        const currentContent = __tmNormalizeTaskContentEditInput(task.content || task.raw_content || task.rawContent || task.markdown || '');
        const newContent = await showPrompt('编辑任务', '请输入新任务内容', currentContent);
        if (newContent === null) return;
        const nextContent = __tmNormalizeTaskContentEditInput(newContent);
        if (!nextContent) {
            hint('⚠ 任务内容不能为空', 'warning');
            return;
        }
        if (nextContent === currentContent) return;

        try {
            const patchContent = globalThis.__tmRequireTaskMutation?.('patchContent');
            if (typeof patchContent !== 'function') throw new Error('任务写入队列未就绪: patchContent');
            let queuedOpId = '';
            const savePromise = patchContent(tid, nextContent, {
                background: true,
                skipInteractionGate: true,
                defer: false,
                suppressHint: true,
                onPending: (promise, op) => {
                    queuedOpId = String(op?.id || '').trim();
                },
            });
            __tmHintQueuedTaskOperation(savePromise, () => queuedOpId);
            hint('已暂存，正在同步', 'info');
        } catch (e) {
            hint(`❌ 更新失败: ${e.message}`, 'error');
        }
    };

    function __tmCaptureChecklistDetailScrollSnapshot(modalEl = null) {
        try {
            const viewMode = globalThis.__tmRuntimeState?.getViewMode?.('') || String(state.viewMode || '').trim();
            if (!(globalThis.__tmRuntimeState?.isAnyViewMode?.(['checklist', 'whiteboard'])
                ?? (viewMode === 'checklist' || viewMode === 'whiteboard'))) return null;
            const modal = modalEl instanceof Element ? modalEl : (state.modal instanceof Element ? state.modal : null);
            if (!(modal instanceof Element)) return null;
            const selectedId = String(state.detailTaskId || '').trim();
            if (!selectedId) return null;
            const panel = __tmResolveChecklistDetailPanel(modal).panel;
            if (!(panel instanceof HTMLElement)) return null;
            return {
                top: Number(panel.scrollTop || 0),
                left: Number(panel.scrollLeft || 0),
                selectedId,
            };
        } catch (e) {
            return null;
        }
    }

    function __tmRestoreChecklistDetailScrollSnapshot(snapshot, modalEl = null) {
        if (!snapshot || !String(snapshot.selectedId || '').trim()) return;
        const restore = () => {
            try {
                const modal = modalEl instanceof Element ? modalEl : (state.modal instanceof Element ? state.modal : null);
                if (!(modal instanceof Element)) return;
                const viewMode = globalThis.__tmRuntimeState?.getViewMode?.('') || String(state.viewMode || '').trim();
                if (!(globalThis.__tmRuntimeState?.isAnyViewMode?.(['checklist', 'whiteboard'])
                    ?? (viewMode === 'checklist' || viewMode === 'whiteboard'))) return;
                const currentId = String(state.detailTaskId || '').trim();
                const snapshotId = String(snapshot.selectedId || '').trim();
                const currentResolvedId = globalThis.__tmRuntimeState?.resolveOptimisticTaskId?.(currentId) || currentId;
                const snapshotResolvedId = globalThis.__tmRuntimeState?.resolveOptimisticTaskId?.(snapshotId) || snapshotId;
                if (!currentId || !snapshotId || String(currentResolvedId || '').trim() !== String(snapshotResolvedId || '').trim()) return;
                const panel = __tmResolveChecklistDetailPanel(modal).panel;
                if (!(panel instanceof HTMLElement)) return;
                panel.scrollTop = Number(snapshot.top || 0);
                panel.scrollLeft = Number(snapshot.left || 0);
            } catch (e) {}
        };
        try { restore(); } catch (e) {}
        try { requestAnimationFrame(restore); } catch (e) {}
        try { setTimeout(restore, 30); } catch (e) {}
    }

    function __tmCaptureStandaloneTaskDetailScrollSnapshot() {
        try {
            const overlay = document.getElementById('tm-task-detail-overlay');
            if (!(overlay instanceof HTMLElement)) return null;
            const taskId = String(overlay.__tmTaskDetailTask?.id || '').trim();
            if (!taskId) return null;
            const panel = overlay.querySelector('.tm-task-detail');
            if (!(panel instanceof HTMLElement)) return null;
            return {
                top: Number(panel.scrollTop || 0),
                left: Number(panel.scrollLeft || 0),
                taskId,
            };
        } catch (e) {
            return null;
        }
    }

    function __tmRestoreStandaloneTaskDetailScrollSnapshot(snapshot) {
        if (!snapshot || !String(snapshot.taskId || '').trim()) return;
        const restore = () => {
            try {
                const overlay = document.getElementById('tm-task-detail-overlay');
                if (!(overlay instanceof HTMLElement)) return;
                if (String(overlay.__tmTaskDetailTask?.id || '').trim() !== String(snapshot.taskId || '').trim()) return;
                const panel = overlay.querySelector('.tm-task-detail');
                if (!(panel instanceof HTMLElement)) return;
                panel.scrollTop = Number(snapshot.top || 0);
                panel.scrollLeft = Number(snapshot.left || 0);
            } catch (e) {}
        };
        try { restore(); } catch (e) {}
        try { requestAnimationFrame(restore); } catch (e) {}
        try { setTimeout(restore, 30); } catch (e) {}
    }

    async function __tmDeleteTaskKernel(id, options = {}) {
        const tid = String(id || '').trim();
        if (!tid) throw new Error('未找到任务');
        const opts = (options && typeof options === 'object') ? options : {};
        const taskBeforeDelete = globalThis.__tmTaskBoundary?.getTask?.(tid) || null;
        const scheduleCleanupTaskIds = __tmCollectTaskTreeIdsForScheduleCleanup(taskBeforeDelete, [
            tid,
            ...(Array.isArray(opts.scheduleCleanupTaskIds) ? opts.scheduleCleanupTaskIds : []),
        ]);
        try {
            await __tmBackendAdapter.deleteBlock(tid);
        } catch (deleteError) {
            let missing = false;
            try {
                const rows = await API.getBlocksByIds([tid]);
                missing = !Array.isArray(rows) || rows.length === 0;
            } catch (readError) {}
            if (!missing) throw deleteError;
        }
        try {
            const docId = String(taskBeforeDelete?.root_id || taskBeforeDelete?.docId || '').trim();
            if (docId) __tmInvalidateTasksQueryCacheByDocId(docId);
            else __tmInvalidateAllSqlCaches();
        } catch (e) {}
        try { MetaStore.deleteTaskIds(scheduleCleanupTaskIds); } catch (e) {}
        await __tmCleanupDeletedTaskRelations(scheduleCleanupTaskIds, {
            source: 'task-delete',
            reason: 'task-delete-schedules',
            background: opts.backgroundScheduleCleanup === true,
        });
        try { scheduleCleanupTaskIds.forEach((taskId) => __tmPurgeRecurringInstanceTasks(taskId)); } catch (e) {}
        return true;
    }

    // 删除任务
    window.tmDelete = async function(id, options = {}) {
        const tid = String(id || '').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        const task = globalThis.__tmTaskBoundary?.getTask?.(tid) || null;
        if (!task) return;
        const isRecurringInstance = __tmIsRecurringInstanceTask(task);
        const recurringSourceTaskId = isRecurringInstance
            ? String(__tmResolveRecurringInstanceSourceTaskId(tid, task) || '').trim()
            : '';
        const recurringCompletedAt = isRecurringInstance
            ? String(task?.recurringCompletedAt || '').trim()
            : '';
        if (isRecurringInstance && (!recurringSourceTaskId || !recurringCompletedAt)) {
            hint('⚠️ 未找到可删除的循环记录', 'warning');
            return false;
        }
        if (!isRecurringInstance && !__tmEnsureEditableTaskLike(task, '删除任务')) return;
        const useRecycle = !isRecurringInstance
            && __tmNormalizeTaskDeleteMode(SettingsStore?.data?.taskDeleteMode) === 'recycle';
        const recycleDocId = useRecycle ? String(SettingsStore?.data?.taskRecycleDocId || '').trim() : '';
        const taskDocId = String(task?.root_id || task?.docId || '').trim();
        if (useRecycle && !recycleDocId) {
            hint('⚠ 请先设置回收站文档', 'warning');
            return false;
        }
        if (useRecycle && recycleDocId === taskDocId) {
            hint('⚠ 回收站文档不能是任务当前文档', 'warning');
            return false;
        }
        if (!useRecycle) {
            let ok = false;
            try {
                ok = isRecurringInstance
                    ? await showConfirm('删除循环记录', '确定要删除这条循环记录吗？此操作不可恢复。')
                    : await showConfirm('删除任务', '确定要删除这个任务吗？此操作不可恢复。');
            } catch (e) {
                try {
                    ok = !!confirm(isRecurringInstance
                        ? '确定要删除这条循环记录吗？此操作不可恢复。'
                        : '确定要删除这个任务吗？此操作不可恢复。');
                } catch (e2) {
                    ok = false;
                }
            }
            if (!ok) return false;
        }

        if (isRecurringInstance) {
            try {
                const removed = await __tmDeleteTaskRepeatHistoryEntry(recurringSourceTaskId, recurringCompletedAt, {
                    source: String(opts.source || 'task-delete-recurring-instance').trim() || 'task-delete-recurring-instance',
                });
                if (removed !== true) {
                    hint('⚠️ 循环记录已不存在', 'warning');
                    return false;
                }
                try {
                    __tmRefreshVisibleTaskDetailForTask(tid, {
                        forceRebuild: true,
                        skipDefer: true,
                        source: 'task-delete-recurring-instance',
                    });
                } catch (e) {}
                hint('✅ 已删除循环记录', 'success');
                return true;
            } catch (e) {
                hint(`❌ 删除失败: ${String(e?.message || e || '')}`, 'error');
                return false;
            }
        }

        if (useRecycle) {
            try {
                const snapshot = __tmCaptureTaskLocalSnapshot(tid);
                const scheduleCleanupTaskIds = __tmCollectTaskTreeIdsForScheduleCleanup(snapshot?.task || task, tid);
                const lifecycle = globalThis.__tmTaskLifecycle;
                if (!lifecycle || typeof lifecycle.archiveDeleted !== 'function') throw new Error('任务归档服务未就绪');
                await lifecycle.archiveDeleted(tid, {
                    task,
                    snapshot,
                    targetDocId: recycleDocId,
                    scheduleCleanupTaskIds,
                    source: String(opts.source || 'task-recycle').trim() || 'task-recycle',
                    wait: true,
                });
                __tmShowActionHint('任务已移入回收站', 'success', '撤销', async () => {
                    try {
                        await lifecycle.restoreDeleted(tid, {
                            snapshot,
                            scheduleCleanupTaskIds,
                            source: 'task-recycle-undo',
                            wait: true,
                        });
                        try { __tmScheduleRender({ withFilters: true, reason: 'task-recycle-undo' }); } catch (e) {}
                        hint('✅ 任务已恢复', 'success');
                    } catch (error) {
                        hint(`❌ 恢复失败: ${String(error?.message || error || '')}`, 'error');
                    }
                }, { duration: 7000 });
                return true;
            } catch (e) {
                hint(`❌ 移入回收站失败: ${String(e?.message || e || '')}`, 'error');
                return false;
            }
        }

        try {
            const snapshot = __tmCaptureTaskLocalSnapshot(tid);
            const scheduleCleanupTaskIds = __tmCollectTaskTreeIdsForScheduleCleanup(snapshot?.task || task, tid);
            let pendingPromise = null;
            const queuePromise = __tmEnqueueQueuedOp({
                type: 'deleteTask',
                docId: String(task?.root_id || task?.docId || '').trim(),
                laneKey: String(task?.root_id || task?.docId || '').trim() ? `doc:${String(task?.root_id || task?.docId || '').trim()}` : `task:${tid}`,
                data: {
                    taskId: tid,
                    scheduleCleanupTaskIds,
                    backgroundScheduleCleanup: true,
                    snapshot,
                },
            }, {
                wait: false,
                onPending: (promise) => {
                    pendingPromise = promise;
                },
            });
            Promise.resolve(pendingPromise || queuePromise).then(() => {
                hint('✅ 任务已删除', 'success');
            }).catch((e) => {
                hint(`❌ 删除失败: ${e.message}`, 'error');
            });
            return true;
        } catch (e) {
            hint(`❌ 删除失败: ${e.message}`, 'error');
            return false;
        }
    };

    // 任务提醒
    window.tmReminder = async function(id) {
        if (!SettingsStore.data.enableTomatoIntegration) {
            hint('⚠ 番茄钟联动已关闭', 'warning');
            return;
        }
        const requestedTaskId = String(id || '').trim();
        const taskId = (typeof __tmResolveOptimisticTaskId === 'function'
            ? String(__tmResolveOptimisticTaskId(requestedTaskId) || requestedTaskId).trim()
            : requestedTaskId) || requestedTaskId;
        const task = globalThis.__tmTaskBoundary?.getTask?.(taskId)
            || globalThis.__tmTaskBoundary?.getTask?.(requestedTaskId)
            || null;
        if (!task) return;
        const showDialog = globalThis.__tomatoReminder?.showDialog;
        if (typeof showDialog === 'function') {
            const taskName = __tmNormalizeTimerTaskName(task?.content || task?.raw_content || task?.markdown || '', '任务');
            showDialog(taskId, taskName || '任务', { taskOwned: true, defaultSyncTaskDone: true });
            try { __tmRefreshReminderMarkForTask(taskId, 1200); } catch (e) {}
            return;
        }
        hint('⚠ 未检测到底栏番茄钟插件，请前往集市安装底栏番茄钟插件', 'warning');
    };

    const __tmNormalizeTimerTaskName = (primary, fallback = '任务') => {
        const source = String(primary || '').trim();
        const backup = String(fallback || '').trim() || '任务';
        try {
            return API.getTaskTitlePresentation(source, backup).text || backup;
        } catch (e) {
            return source || backup;
        }
    };

    function __tmStripTaskCopyPlainText(input) {
        let text = String(input || '').trim();
        if (!text) return '';
        const escapedTokens = [];
        const stashEscaped = (value) => `\u0000${escapedTokens.push(String(value || '')) - 1}\u0000`;
        const restoreEscaped = (value) => String(value || '').replace(/\u0000(\d+)\u0000/g, (match, index) => escapedTokens[Number(index)] || '');
        const isAsciiWord = (ch) => !!ch && /[A-Za-z0-9_]/.test(ch);
        const stripSingleMarker = (source, marker, re) => String(source || '').replace(re, (match, prefix, inner, offset, full) => {
            const start = Number(offset) + String(prefix || '').length;
            const end = Number(offset) + String(match || '').length;
            if (full[start - 1] === marker || full[start + 1] === marker) return match;
            if (full[end - 2] === marker || full[end] === marker) return match;
            if (isAsciiWord(full[start - 1] || '') && isAsciiWord(full[end] || '')) return match;
            return `${prefix}${inner}`;
        });
        text = text.replace(/^\s*(?:[-*+]|\d+[.)])\s*\[[^\]]*\]\s*/, '').trim();
        text = text.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, '').trim();
        text = text.replace(/^\[[^\]]*\]\s*/, '').trim();
        text = text.replace(/\\([\\`*_{}\[\]()#+\-.!~>+=])/g, (match, ch) => stashEscaped(ch));
        text = text.replace(/\{\:\s*[^}]*\}/g, '');
        text = text.replace(/<br\s*\/?>/gi, ' ');
        text = text.replace(/<span\b[^>]*>([\s\S]*?)<\/span>/gi, '$1');
        text = text.replace(/<(?:strong|b|em|i|u|del|s|strike|mark|code|kbd|sup|sub)\b[^>]*>([\s\S]*?)<\/(?:strong|b|em|i|u|del|s|strike|mark|code|kbd|sup|sub)>/gi, '$1');
        text = text.replace(/<[^>]+>/g, '');
        text = text.replace(/\(\(([0-9]{14}-[A-Za-z0-9]+)(?:\s+(['"])([\s\S]*?)\2)?\)\)/g, (match, id, quote, label) => String(label || id || '').trim());
        text = text.replace(/\[\[([^\]]+)\]\]/g, '$1');
        text = text.replace(/!\[([^\]]*)\]\((?:[^)(]+|\([^)]*\))*\)/g, '$1');
        text = text.replace(/\[([^\]]+)\]\((?:[^)(]+|\([^)]*\))*\)/g, '$1');
        text = text.replace(/(\*\*|__|~~|==|\+\+)([\s\S]+?)\1/g, '$2');
        text = stripSingleMarker(text, '*', /(^|[^\*])\*([^\*\n]+)\*(?!\*)/g);
        text = stripSingleMarker(text, '_', /(^|[^_])_([^_\n]+)_(?!_)/g);
        text = text.replace(/`([^`\n]+)`/g, '$1');
        text = restoreEscaped(text);
        return text.replace(/\s+/g, ' ').trim();
    }

    function __tmGetTaskCopyPlainText(taskLike, fallback = '') {
        const task = (taskLike && typeof taskLike === 'object') ? taskLike : {};
        const candidates = [
            task.content,
            task.raw_content,
            task.rawContent,
            task.markdown,
            fallback,
        ];
        for (const candidate of candidates) {
            let text = String(candidate || '').trim();
            if (!text) continue;
            try {
                const parsed = typeof API?.parseTaskStatus === 'function' ? API.parseTaskStatus(text) : null;
                if (parsed?.content) text = String(parsed.content || '').trim();
            } catch (e) {}
            try {
                if (typeof API?.extractTaskContentLine === 'function') {
                    text = String(API.extractTaskContentLine(text) || text).trim();
                }
            } catch (e) {}
            try {
                if (typeof API?.normalizeTaskContent === 'function') {
                    text = String(API.normalizeTaskContent(text) || text).trim();
                }
            } catch (e) {}
            text = __tmStripTaskCopyPlainText(text);
            if (text) return text;
        }
        return '';
    }

    async function __tmWriteTaskContextTextToClipboard(text) {
        const value = String(text || '').trim();
        if (!value) throw new Error('没有可复制的内容');
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(value);
                return true;
            }
        } catch (e) {}
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.setAttribute('readonly', 'readonly');
        textarea.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;';
        document.body.appendChild(textarea);
        try {
            textarea.focus();
            textarea.select();
            const ok = document.execCommand('copy');
            if (!ok) throw new Error('复制失败');
            return true;
        } finally {
            textarea.remove();
        }
    }

    async function __tmGetTaskCopyRefText(taskId, taskLike) {
        const tid = String(taskId || '').trim();
        if (!tid) return '';
        try {
            const res = await API.call('/api/block/getRefText', { id: tid });
            const text = String(res?.data || '').trim();
            if (res?.code === 0 && text) return text;
        } catch (e) {}
        return __tmGetTaskCopyPlainText(taskLike, tid) || tid;
    }

    async function __tmCopyTaskContextValue(taskId, taskLike, type) {
        const tid = String(taskId || '').trim();
        if (!tid) {
            hint('⚠ 未找到任务块 ID', 'warning');
            return false;
        }
        const mode = String(type || '').trim();
        let text = '';
        let label = '';
        if (mode === 'plain') {
            text = __tmGetTaskCopyPlainText(taskLike, tid);
            label = '纯文本';
        } else if (mode === 'blockRef') {
            const refText = await __tmGetTaskCopyRefText(tid, taskLike);
            text = `((${tid} '${refText}'))`;
            label = '块引用';
        } else if (mode === 'blockEmbed') {
            let embedId = tid;
            try {
                const sourceId = typeof __tmResolveRecurringInstanceSourceTaskId === 'function'
                    ? String(__tmResolveRecurringInstanceSourceTaskId(tid, taskLike) || '').trim()
                    : '';
                if (sourceId) embedId = sourceId;
            } catch (e) {}
            if (typeof __tmIsLikelyBlockId === 'function' && !__tmIsLikelyBlockId(embedId)) {
                hint('⚠ 未找到任务块 ID', 'warning');
                return false;
            }
            text = `{{select * from blocks where id='${embedId}'}}`;
            label = '嵌入块';
        } else if (mode === 'blockId') {
            text = tid;
            label = '块 ID';
        }
        try {
            await __tmWriteTaskContextTextToClipboard(text);
            hint(`✅ 已复制${label || '内容'}`, 'success');
            return true;
        } catch (e) {
            hint(`❌ ${String(e?.message || e || '复制失败')}`, 'error');
            return false;
        }
    }

    window.tmStartPomodoro = async function(id) {
        if (!SettingsStore.data.enableTomatoIntegration) {
            hint('⚠ 番茄钟联动已关闭', 'warning');
            return;
        }
        const rawId = String(id || '').trim();
        if (!rawId) return;
        const rawTask = globalThis.__tmTaskBoundary?.getTask?.(rawId, { includePending: false, preferPending: false }) || null;
        let resolvedId = rawId;
        if (!__tmIsCollectedOtherBlockTask(rawTask)) {
            try {
                const nextId = await __tmResolveTaskIdFromAnyBlockId(rawId);
                if (nextId) resolvedId = String(nextId).trim();
            } catch (e) {}
        }
        let task = rawTask
            || globalThis.__tmTaskBoundary?.getTask?.(resolvedId, { includePending: false, preferPending: false })
            || globalThis.__tmTaskBoundary?.getTask?.(rawId, { includePending: false, preferPending: false })
            || null;
        if (!task && resolvedId) {
            try { task = await __tmEnsureTaskInStateById(resolvedId); } catch (e) { task = null; }
        }
        if (!task) return;
        const taskName = __tmNormalizeTimerTaskName(task?.content || task?.markdown || '', '任务');
        const timer = globalThis.__tomatoTimer;
        const startCountdown = timer?.startCountdown;
        const startPomodoro = timer?.startPomodoro;
        const timerFocusRestoreOptions = { source: 'task-horizon' };
        if (typeof startCountdown === 'function') {
            __tmSyncTomatoFocusInPlace(resolvedId);
            startCountdown(resolvedId, taskName, 30, timerFocusRestoreOptions);
            return;
        }
        if (typeof startPomodoro === 'function') {
            __tmSyncTomatoFocusInPlace(resolvedId);
            startPomodoro(resolvedId, taskName, 30, timerFocusRestoreOptions);
            return;
        }
        hint('⚠ 未检测到番茄计时功能，请确认番茄插件已启用', 'warning');
    };

    // 任务右键菜单
    window.tmShowTaskContextMenu = function(event, taskId, extra) {
        if (globalThis.__tmViewPolicy?.shouldSuppressMobileCalendarSidebarContextMenu?.(state.modal)
            ?? (__tmHasCalendarSidebarChecklist(state.modal) && __tmIsRuntimeMobileClient())) {
            try { event.preventDefault(); } catch (e) {}
            try { event.stopPropagation(); } catch (e) {}
            return;
        }
        event.preventDefault();
        event.stopPropagation();

        const rawMenuTaskId = String(taskId || '').trim();
        const menuTaskId = rawMenuTaskId && typeof __tmResolveOptimisticTaskId === 'function'
            ? (String(__tmResolveOptimisticTaskId(rawMenuTaskId) || rawMenuTaskId).trim() || rawMenuTaskId)
            : rawMenuTaskId;
        taskId = menuTaskId;
        const taskForMenu = __tmGetCollectedOtherBlockTaskFromState(menuTaskId)
            || globalThis.__tmTaskBoundary?.getTask?.(menuTaskId)
            || (rawMenuTaskId !== menuTaskId ? globalThis.__tmTaskBoundary?.getTask?.(rawMenuTaskId) : null)
            || null;
        if (__tmIsCollectedOtherBlockTask(taskForMenu)) {
            __tmShowCollectedOtherBlockContextMenu(event, menuTaskId);
            return;
        }

        // Close any existing context menu
        const existingMenu = document.getElementById('tm-task-context-menu');
        if (existingMenu) existingMenu.remove();
        if (state.taskContextMenuCloseHandler) {
            try { __tmClearOutsideCloseHandler(state.taskContextMenuCloseHandler); } catch (e) {}
            state.taskContextMenuCloseHandler = null;
        }

        const menu = document.createElement('div');
        menu.id = 'tm-task-context-menu';
        menu.className = 'tm-task-context-menu';
        const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
        menu.style.cssText = `
            position: fixed;
            top: ${event.clientY}px;
            left: ${event.clientX}px;
            display: inline-flex;
            flex-direction: column;
            align-items: stretch;
            background: var(--b3-theme-background);
            border: 1px solid var(--b3-theme-surface-light);
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            padding: 4px 0;
            z-index: 200020;
            box-sizing: border-box;
            user-select: none;
        `;
        try {
            menu.style.setProperty('z-index', '200020', 'important');
            menu.style.setProperty('display', 'inline-flex', 'important');
            menu.style.setProperty('flex-direction', 'column', 'important');
            menu.style.setProperty('align-items', 'stretch', 'important');
            menu.style.setProperty('box-sizing', 'border-box', 'important');
        } catch (e) {}

        const createItem = (label, onClick, isDanger) => {
            const item = document.createElement('div');
            const labelText = String(label || '');
            if (/<[a-z][\s\S]*>/i.test(labelText)) item.innerHTML = labelText;
            else item.textContent = labelText;
            item.style.cssText = `
                padding: 6px 10px;
                cursor: pointer;
                font-size: 13px;
                color: ${isDanger ? 'var(--b3-theme-error)' : 'var(--b3-theme-on-background)'};
                display: flex;
                align-items: center;
                gap: 8px;
                white-space: nowrap;
                align-self: stretch;
                width: 100%;
                box-sizing: border-box;
            `;
            try {
                item.style.setProperty('display', 'flex', 'important');
                item.style.setProperty('align-self', 'stretch', 'important');
                item.style.setProperty('width', '100%', 'important');
                item.style.setProperty('max-width', '100%', 'important');
                item.style.setProperty('box-sizing', 'border-box', 'important');
            } catch (e) {}
            item.onmouseenter = () => item.style.backgroundColor = 'var(--b3-theme-surface-light)';
            item.onmouseleave = () => item.style.backgroundColor = 'transparent';
            item.onclick = (e) => {
                e.stopPropagation();
                menu.remove();
                onClick();
            };
            return item;
        };
        const createSubmenu = (label, childrenBuilder) => {
            const item = createItem(label, () => {});
            item.style.position = 'relative';
            item.style.paddingRight = '24px';
            const arrow = document.createElement('span');
            arrow.textContent = '›';
            arrow.style.cssText = 'margin-left:auto;font-size:14px;line-height:1;color:var(--b3-theme-on-background);opacity:.7;';
            item.appendChild(arrow);
            const submenu = document.createElement('div');
            submenu.style.cssText = `
                position: absolute;
                top: -4px;
                left: calc(100% - 4px);
                display: none;
                flex-direction: column;
                align-items: stretch;
                background: var(--b3-theme-background);
                border: 1px solid var(--b3-theme-surface-light);
                border-radius: 4px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                padding: 4px 0;
                min-width: 180px;
                box-sizing: border-box;
                z-index: 200021;
            `;
            const children = typeof childrenBuilder === 'function' ? childrenBuilder() : [];
            (Array.isArray(children) ? children : []).forEach((child) => submenu.appendChild(child));
            item.appendChild(submenu);
            let hideTimer = null;
            const positionSubmenu = () => {
                submenu.style.left = 'calc(100% - 4px)';
                submenu.style.right = 'auto';
                submenu.style.top = '-4px';
                try {
                    const rect = submenu.getBoundingClientRect();
                    const vw = Math.max(0, window.innerWidth || document.documentElement.clientWidth || 0);
                    const vh = Math.max(0, window.innerHeight || document.documentElement.clientHeight || 0);
                    const margin = 8;
                    if (rect.right > vw - margin) {
                        submenu.style.left = 'auto';
                        submenu.style.right = 'calc(100% - 4px)';
                    }
                    const nextRect = submenu.getBoundingClientRect();
                    if (nextRect.bottom > vh - margin) {
                        const overflow = nextRect.bottom - (vh - margin);
                        submenu.style.top = `${Math.min(-4, -4 - Math.round(overflow))}px`;
                    }
                    const finalRect = submenu.getBoundingClientRect();
                    if (finalRect.top < margin) {
                        submenu.style.top = `${Math.max(margin - (item.getBoundingClientRect().top || 0), -4)}px`;
                    }
                } catch (e) {}
            };
            const show = () => {
                if (hideTimer) {
                    clearTimeout(hideTimer);
                    hideTimer = null;
                }
                submenu.style.display = 'flex';
                positionSubmenu();
            };
            const hide = () => {
                if (hideTimer) clearTimeout(hideTimer);
                hideTimer = setTimeout(() => {
                    submenu.style.display = 'none';
                }, 120);
            };
            item.onmouseenter = show;
            item.onmouseleave = hide;
            submenu.onmouseenter = show;
            submenu.onmouseleave = hide;
            item.onclick = (e) => {
                e.stopPropagation();
                if (submenu.style.display === 'flex') submenu.style.display = 'none';
                else show();
            };
            return item;
        };
        const appendSectionSeparator = () => {
            const separator = document.createElement('div');
            separator.className = 'tm-multi-bulkbar__menu-separator tm-task-context-menu__separator';
            menu.appendChild(separator);
        };

        const task = taskForMenu || globalThis.__tmTaskBoundary?.getTask?.(taskId) || null;
        const taskName = __tmNormalizeTimerTaskName(task?.content || task?.markdown || '', '任务');
        const hasChildren = Array.isArray(task?.children) && task.children.length > 0;
        const showCompletedSubtasks = __tmShouldShowCompletedSubtasksForTask(taskId);
        const canDetachSubtask = typeof __tmCanDetachSubtaskFromParent === 'function'
            && __tmCanDetachSubtaskFromParent(task);
        const extra0 = (extra && typeof extra === 'object') ? extra : {};
        const scheduleId0 = String(extra0.scheduleId || '').trim();
        const scheduleTitle0 = __tmNormalizeTimerTaskName(extra0.title || '', '');
        const toMs = (value) => {
            if (!value) return NaN;
            const dt = value instanceof Date ? value : new Date(value);
            return Number.isNaN(dt.getTime()) ? NaN : dt.getTime();
        };
        const scheduleStartMs = toMs(extra0.start);
        const scheduleEndMs = toMs(extra0.end);
        const scheduleStartDate = Number.isFinite(scheduleStartMs) ? new Date(scheduleStartMs) : null;
        const scheduleEndDate = Number.isFinite(scheduleEndMs) ? new Date(scheduleEndMs) : null;
        const scheduleLooksAllDay = scheduleStartDate instanceof Date
            && scheduleEndDate instanceof Date
            && scheduleEndMs > scheduleStartMs
            && scheduleStartDate.getHours() === 0
            && scheduleStartDate.getMinutes() === 0
            && scheduleStartDate.getSeconds() === 0
            && scheduleEndDate.getHours() === 0
            && scheduleEndDate.getMinutes() === 0
            && scheduleEndDate.getSeconds() === 0
            && (scheduleEndMs - scheduleStartMs) % 86400000 === 0;
        const scheduleAllDay = extra0.allDay === true
            || scheduleLooksAllDay;
        const taskAllDayBottom = task?.allDayBottom === true
            || task?.allDayBottom === '1'
            || task?.custom_all_day_bottom === true
            || String(task?.custom_all_day_bottom || '').trim() === '1';
        const scheduleAllDayBottom = extra0.allDayBottom === true || (!scheduleId0 && taskAllDayBottom);
        const scheduleDurationMin = (Number.isFinite(scheduleStartMs) && Number.isFinite(scheduleEndMs) && scheduleEndMs > scheduleStartMs)
            ? Math.max(1, Math.round((scheduleEndMs - scheduleStartMs) / 60000))
            : 0;
        const tomatoEnabled = !!SettingsStore.data.enableTomatoIntegration;
        const timer = tomatoEnabled ? globalThis.__tomatoTimer : null;
        const resolveTimerTarget = async () => {
            const rawId = String(taskId || '').trim();
            let resolvedId = rawId;
            try {
                const nextId = await __tmResolveTaskIdFromAnyBlockId(rawId);
                if (nextId) resolvedId = String(nextId).trim();
            } catch (e) {}
            let nextTask = globalThis.__tmTaskBoundary?.getTask?.(resolvedId, { includePending: false, preferPending: false })
                || globalThis.__tmTaskBoundary?.getTask?.(rawId, { includePending: false, preferPending: false })
                || null;
            if (!nextTask && resolvedId) {
                try { nextTask = await __tmEnsureTaskInStateById(resolvedId); } catch (e) { nextTask = null; }
            }
            const resolvedTaskName = __tmNormalizeTimerTaskName(
                nextTask?.content || nextTask?.markdown || '',
                taskName || '任务'
            );
            return {
                taskId: resolvedId || rawId,
                task: nextTask,
                taskName: scheduleTitle0 || resolvedTaskName || '任务',
            };
        };
        const runTaskTimer = async (minutes, mode = 'countdown') => {
            const target = await resolveTimerTarget();
            const timerTaskId = String(target?.taskId || taskId || '').trim();
            const timerTaskName = String(target?.taskName || taskName || '任务').trim() || '任务';
            if (!timerTaskId) {
                hint('⚠ 未找到可关联的任务块', 'warning');
                return;
            }
            const timerFocusRestoreOptions = { source: 'task-horizon' };
            __tmSyncTomatoFocusInPlace(timerTaskId);
            if (mode === 'stopwatch') {
                const startFromTaskBlock = timer?.startFromTaskBlock;
                const startStopwatch = timer?.startStopwatch;
                let p = null;
                if (typeof startFromTaskBlock === 'function') p = startFromTaskBlock(timerTaskId, timerTaskName, 0, 'stopwatch', timerFocusRestoreOptions);
                else if (typeof startStopwatch === 'function') p = startStopwatch(timerTaskId, timerTaskName, timerFocusRestoreOptions);
                else {
                    hint('⚠ 未检测到正计时功能，请确认番茄插件已启用', 'warning');
                    return;
                }
                if (p && typeof p.finally === 'function') {
                    p.finally(() => setTimeout(() => { try { timer?.refreshUI?.(); } catch (e) {} }, 150));
                } else {
                    setTimeout(() => { try { timer?.refreshUI?.(); } catch (e) {} }, 150);
                }
                return;
            }
            const safeMin = Math.max(1, Math.round(Number(minutes) || 0));
            const startFromTaskBlock = timer?.startFromTaskBlock;
            const startCountdown = timer?.startCountdown;
            let p = null;
            if (typeof startFromTaskBlock === 'function') p = startFromTaskBlock(timerTaskId, timerTaskName, safeMin, 'countdown', timerFocusRestoreOptions);
            else if (typeof startCountdown === 'function') p = startCountdown(timerTaskId, timerTaskName, safeMin, timerFocusRestoreOptions);
            else {
                tmStartPomodoro(timerTaskId);
                return;
            }
            if (p && typeof p.finally === 'function') {
                p.finally(() => setTimeout(() => { try { timer?.refreshUI?.(); } catch (e) {} }, 150));
            } else {
                setTimeout(() => { try { timer?.refreshUI?.(); } catch (e) {} }, 150);
            }
        };
        const getDateShortcutValue = (offsetDays) => {
            const target = new Date();
            target.setHours(12, 0, 0, 0);
            target.setDate(target.getDate() + (Number(offsetDays) || 0));
            return __tmNormalizeDateOnly(target);
        };
        const createDateBlock = () => {
            const wrap = document.createElement('div');
            wrap.className = 'tm-task-context-date';
            const title = document.createElement('div');
            title.className = 'tm-task-context-date__title';
            title.textContent = '日期';
            wrap.appendChild(title);
            const row = document.createElement('div');
            row.className = 'tm-task-context-date__row';
            const currentDate = __tmNormalizeDateOnly(task?.completionTime || task?.completion_time || '');
            const shortcuts = [
                { mode: 'set', label: '今天', value: getDateShortcutValue(0), icon: 'sun' },
                { mode: 'set', label: '明天', value: getDateShortcutValue(1), icon: 'sun-horizon' },
                { mode: 'set', label: '下周', value: getDateShortcutValue(7), icon: 'calendar-plus' },
                { mode: 'pick', label: '选择日期', icon: 'calendar-dots' },
                { mode: 'clear', label: '清除日期', value: '', icon: 'calendar-x', danger: true },
            ];
            shortcuts.forEach((opt) => {
                const active = (opt.mode === 'set' && currentDate && opt.value === currentDate)
                    || (opt.mode === 'clear' && !currentDate);
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `tm-task-context-date__btn${active ? ' is-active' : ''}${opt.danger ? ' tm-task-context-date__btn--clear' : ''}`;
                btn.setAttribute('aria-label', opt.label);
                btn.setAttribute('aria-pressed', active ? 'true' : 'false');
                btn.title = opt.value ? `${opt.label} ${opt.value}` : opt.label;
                btn.innerHTML = __tmPhosphorBoldSvg(opt.icon, { size: 16, className: 'tm-task-context-date__icon' });
                btn.onclick = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (opt.mode === 'pick') {
                        if (typeof window.tmOpenTaskTimeHub !== 'function') {
                            hint('⚠ 日期面板未就绪', 'warning');
                            return;
                        }
                        btn.setAttribute('aria-haspopup', 'dialog');
                        Promise.resolve(window.tmOpenTaskTimeHub(taskId, btn, {
                            task,
                            activeField: 'completionTime',
                            source: 'context-menu-completion-time',
                            placement: 'right',
                            contextDate: true,
                            scheduleTabLabel: '时间段',
                            onClose: () => {
                                try { btn.classList.remove('is-open'); } catch (e2) {}
                                try { menu.remove(); } catch (e2) {}
                                try {
                                    if (state.taskContextMenuCloseHandler) {
                                        __tmClearOutsideCloseHandler(state.taskContextMenuCloseHandler);
                                        state.taskContextMenuCloseHandler = null;
                                    }
                                } catch (e2) {}
                            },
                        }))
                            .catch((err) => {
                                hint(`❌ 截止日期更新失败: ${err?.message || err}`, 'error');
                            });
                        return;
                    }
                    btn.disabled = true;
                    const savePromise = typeof window.tmSetTaskCompletionTime === 'function'
                        ? window.tmSetTaskCompletionTime(taskId, opt.value || '', {
                            source: 'context-menu-completion-time',
                            background: true,
                            queueDelayMs: 0,
                            skipInteractionGate: true,
                            silent: true,
                        })
                        : Promise.reject(new Error('任务日期写入函数未就绪'));
                    menu.remove();
                    Promise.resolve(savePromise).then((ok) => {
                        if (!ok) hint('❌ 截止日期更新失败', 'error');
                    }).catch((err) => {
                        hint(`❌ 截止日期更新失败: ${err?.message || err}`, 'error');
                    });
                };
                row.appendChild(btn);
            });
            wrap.appendChild(row);
            return wrap;
        };
        const createPriorityBlock = () => {
            const wrap = document.createElement('div');
            wrap.className = 'tm-task-context-priority';
            const title = document.createElement('div');
            title.className = 'tm-task-context-priority__title';
            title.textContent = '优先级';
            wrap.appendChild(title);
            const row = document.createElement('div');
            row.className = 'tm-task-context-priority__row';
            const currentKey = String(__tmGetPriorityJiraInfo(task?.priority || '')?.key || 'none').trim() || 'none';
            [
                { key: 'high', value: 'high' },
                { key: 'medium', value: 'medium' },
                { key: 'low', value: 'low' },
                { key: 'none', value: '' },
            ].forEach((opt) => {
                const info = __tmGetPriorityJiraInfo(opt.value);
                const key = String(opt.key || info?.key || 'none').trim() || 'none';
                const color = __tmGetPriorityAccentColor(key) || 'var(--tm-secondary-text)';
                const active = key === currentKey;
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `tm-task-context-priority__btn${active ? ' is-active' : ''}`;
                btn.style.setProperty('--tm-context-priority-color', color);
                btn.setAttribute('aria-label', `设置优先级为${info?.label || '无'}`);
                btn.setAttribute('aria-pressed', active ? 'true' : 'false');
                btn.title = info?.label || '无';
                btn.innerHTML = __tmRenderPriorityJira(opt.value, false);
                btn.onclick = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    btn.disabled = true;
                    const savePromise = window.tmSetTaskPriority(taskId, opt.value, {
                        source: 'context-menu-priority',
                        background: true,
                        queueDelayMs: 0,
                        skipInteractionGate: true,
                        silent: true,
                    });
                    menu.remove();
                    Promise.resolve(savePromise).then((ok) => {
                        if (!ok) hint('❌ 优先级更新失败', 'error');
                    }).catch((err) => {
                        hint(`❌ 优先级更新失败: ${err?.message || err}`, 'error');
                    });
                };
                row.appendChild(btn);
            });
            wrap.appendChild(row);
            return wrap;
        };
        const taskRepeatRule = __tmNormalizeTaskRepeatRule(task?.repeatRule || task?.repeat_rule || '', {
            startDate: task?.startDate,
            completionTime: task?.completionTime,
        });
        const canReviewFsrs = taskRepeatRule.enabled
            && taskRepeatRule.type === 'fsrs'
            && !__tmIsRecurringInstanceTask(task);
        const createFsrsReviewBlock = () => {
            const wrap = document.createElement('div');
            wrap.className = 'tm-task-context-fsrs';
            const title = document.createElement('div');
            title.className = 'tm-task-context-fsrs__title';
            const titleText = document.createElement('span');
            titleText.textContent = '复习反馈';
            const titleHint = document.createElement('span');
            titleHint.textContent = '预计下次';
            title.append(titleText, titleHint);
            wrap.appendChild(title);
            const row = document.createElement('div');
            row.className = 'tm-task-context-fsrs__row';
            row.setAttribute('role', 'group');
            row.setAttribute('aria-label', 'FSRS 复习反馈');
            const reviewedAt = new Date();
            __tmBuildFsrsReviewPreviews(task, { reviewedAt }).forEach((option) => {
                const dueDate = option.completionTime;
                const previewText = __tmFormatFsrsPreviewDate(dueDate, reviewedAt);
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `tm-task-context-fsrs__btn tm-task-context-fsrs__btn--${option.tone}${option.rating === 3 ? ' is-default' : ''}`;
                btn.setAttribute('data-tm-fsrs-rating', String(option.rating));
                btn.setAttribute('aria-label', `${option.label}，预计下次 ${dueDate || previewText}`);
                btn.title = `${option.label} · 预计 ${dueDate || previewText}`;
                const label = document.createElement('span');
                label.className = 'tm-task-context-fsrs__label';
                label.textContent = option.label;
                const preview = document.createElement('span');
                preview.className = 'tm-task-context-fsrs__due';
                preview.textContent = previewText;
                btn.append(label, preview);
                btn.onclick = async (event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    row.querySelectorAll('button').forEach((item) => { item.disabled = true; });
                    menu.remove();
                    try {
                        if (typeof window.tmReviewFsrsTask !== 'function') throw new Error('FSRS 反馈功能未就绪');
                        await window.tmReviewFsrsTask(taskId, option.rating, { source: 'task-context-fsrs-review' });
                    } catch (error) {
                        hint(`FSRS 反馈失败：${error?.message || String(error)}`, 'error');
                    }
                };
                row.appendChild(btn);
            });
            wrap.appendChild(row);
            return wrap;
        };
        let hasContextTopBlock = false;
        if (tomatoEnabled && timer && typeof timer === 'object') {
            const durations = (() => {
                const list = timer?.getDurations?.();
                const arr = Array.isArray(list) ? list.map(n => parseInt(n, 10)).filter(n => Number.isFinite(n) && n > 0) : [];
                return arr.length > 0 ? arr : [5, 15, 25, 30, 45, 60];
            })();

            const timerWrap = document.createElement('div');
            timerWrap.className = 'tm-task-context-timer';
            const title = document.createElement('div');
            title.className = 'tm-task-context-timer__title';
            title.textContent = '🍅 计时';
            timerWrap.appendChild(title);
            if (scheduleId0 && scheduleDurationMin > 0) {
                const scheduleBtn = document.createElement('button');
                scheduleBtn.type = 'button';
                scheduleBtn.className = 'tm-btn tm-btn-secondary tm-task-context-timer__schedule';
                scheduleBtn.textContent = `📅 按日程时长开始番茄（${scheduleDurationMin}m）`;
                scheduleBtn.onclick = async (e) => {
                    e.stopPropagation();
                    await runTaskTimer(scheduleDurationMin, 'countdown');
                    menu.remove();
                };
                timerWrap.appendChild(scheduleBtn);
            }
            const btnRow = document.createElement('div');
            btnRow.className = 'tm-task-context-timer__grid';
            btnRow.setAttribute('role', 'group');
            btnRow.setAttribute('aria-label', '计时方式');
            durations.forEach(min => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'tm-btn tm-btn-secondary tm-task-context-timer__btn';
                b.textContent = `${min}m`;
                b.onclick = async (e) => {
                    e.stopPropagation();
                    await runTaskTimer(min, 'countdown');
                    menu.remove();
                };
                btnRow.appendChild(b);
            });
            const sw = document.createElement('button');
            sw.type = 'button';
            sw.className = 'tm-btn tm-btn-secondary tm-task-context-timer__btn tm-task-context-timer__btn--stopwatch';
            sw.textContent = '⏱️ 正计时';
            sw.onclick = async (e) => {
                e.stopPropagation();
                await runTaskTimer(0, 'stopwatch');
                menu.remove();
            };
            btnRow.appendChild(sw);
            timerWrap.appendChild(btnRow);
            menu.appendChild(timerWrap);
            hasContextTopBlock = true;
        }

        if (task) {
            menu.appendChild(createDateBlock());
            menu.appendChild(createPriorityBlock());
            if (canReviewFsrs) menu.appendChild(createFsrsReviewBlock());
            hasContextTopBlock = true;
        }

        if (hasContextTopBlock) {
            appendSectionSeparator();
        }

        menu.appendChild(createItem(__tmRenderContextMenuLabel('pin', task?.pinned ? '取消置顶' : '置顶'), () => tmSetPinned(taskId, !task?.pinned)));
        if (tomatoEnabled) {
            menu.appendChild(createItem(__tmRenderContextMenuLabel('alarm-clock', '提醒'), () => tmReminder(taskId)));
        }
        if (tomatoEnabled && timer && typeof timer === 'object') {
            if (state.timerFocusTaskId) {
                menu.appendChild(createItem(__tmRenderContextMenuLabel('circle-dot', '取消聚焦'), () => {
                    __tmSyncTomatoFocusInPlace('');
                }));
            }
        }
        if (hasChildren) {
            menu.appendChild(createItem(__tmRenderContextMenuLabel(showCompletedSubtasks ? 'check-circle-2' : 'circle-dot', showCompletedSubtasks ? '隐藏已完成子任务' : '显示已完成子任务'), () => {
                window.tmToggleTaskDetailCompletedSubtasks?.(taskId, !showCompletedSubtasks);
            }));
        }
        menu.appendChild(createSubmenu(__tmRenderContextMenuLabel('clipboard-list', '复制'), () => [
            createItem(__tmRenderContextMenuLabel('cursor-text', '复制纯文本'), () => {
                void __tmCopyTaskContextValue(taskId, task, 'plain');
            }),
            createItem(__tmRenderContextMenuLabel('link-simple', '复制块引用'), () => {
                void __tmCopyTaskContextValue(taskId, task, 'blockRef');
            }),
            createItem(__tmRenderContextMenuLabel('stack-simple', '复制嵌入块'), () => {
                void __tmCopyTaskContextValue(taskId, task, 'blockEmbed');
            }),
            createItem(__tmRenderContextMenuLabel('file-text', '复制块 ID'), () => {
                void __tmCopyTaskContextValue(taskId, task, 'blockId');
            }),
        ]));

        appendSectionSeparator();
        menu.appendChild(createItem(__tmRenderContextMenuLabel('text-indent', '新建子任务'), () => tmCreateSubtask(taskId)));
        menu.appendChild(createItem(__tmRenderContextMenuLabel('list-bullets', '新建同级任务'), () => tmCreateSiblingTask(taskId)));
        if (canDetachSubtask) {
            const detachIconHtml = typeof __tmPhosphorBoldSvg === 'function'
                ? __tmPhosphorBoldSvg('text-outdent', { size: 14, className: 'tm-task-context-menu__icon' })
                : '';
            menu.appendChild(createItem(__tmRenderContextMenuLabel('text-outdent', '移出子任务', { iconHtml: detachIconHtml }), () => {
                window.tmDetachSubtaskFromParent?.(taskId);
            }));
        }
        if (globalThis.__tmCalendar && (typeof globalThis.__tmCalendar.openScheduleEditor === 'function' || typeof globalThis.__tmCalendar.openScheduleEditorById === 'function' || typeof globalThis.__tmCalendar.openScheduleEditorByTaskId === 'function')) {
            menu.appendChild(createItem(__tmRenderContextMenuLabel('calendar-days', '编辑日程'), () => {
                void __tmOpenScheduleEditorForBlock(taskId, null, {
                    id: scheduleId0,
                    title: scheduleTitle0 || taskName || task?.content || '',
                    taskDateStartKey: String(extra0.taskDateStartKey || '').trim(),
                    taskDateEndExclusiveKey: String(extra0.taskDateEndExclusiveKey || '').trim(),
                    calendarId: String(extra0.calendarId || '').trim(),
                    start: extra0.start || null,
                    end: extra0.end || null,
                    allDay: extra0.allDay === true,
                    occurrenceStartMs: extra0.occurrenceStartMs,
                    repeatType: extra0.repeatType,
                });
            }));
            if (scheduleAllDay) {
                menu.appendChild(createItem(__tmRenderContextMenuLabel('arrow-down', scheduleAllDayBottom ? '取消置底全天日程' : '置底全天日程'), async () => {
                    try {
                        if (scheduleId0 && typeof globalThis.__tmCalendar.setScheduleAllDayBottomById === 'function') {
                            await globalThis.__tmCalendar.setScheduleAllDayBottomById(scheduleId0, !scheduleAllDayBottom, {
                                allDay: true,
                                start: extra0.start || null,
                                end: extra0.end || null,
                            });
                            return;
                        }
                        if (typeof window.tmSetTaskAllDayBottom === 'function') {
                            await window.tmSetTaskAllDayBottom(taskId, !scheduleAllDayBottom);
                        }
                    } catch (e) {
                        hint(`❌ ${String(e?.message || e || '操作失败')}`, 'error');
                    }
                }));
            }
            if (scheduleId0 && typeof globalThis.__tmCalendar.deleteScheduleById === 'function') {
                menu.appendChild(createItem(__tmRenderContextMenuLabel('trash-2', '删除日程'), async () => {
                    try {
                        const ok = await globalThis.__tmCalendar.deleteScheduleById(scheduleId0, {
                            closeModal: false,
                            occurrenceStartMs: extra0.occurrenceStartMs,
                            start: extra0.start || null,
                        });
                        if (ok) hint('✅ 已删除日程', 'success');
                    } catch (e) {
                        hint(`❌ ${String(e?.message || e || '删除日程失败')}`, 'error');
                    }
                }, true));
            }
        }

        appendSectionSeparator();
        if (__tmIsAiFeatureEnabled()) {
            menu.appendChild(createSubmenu(__tmRenderContextMenuLabel('bot', 'AI'), () => [
                createItem(__tmRenderContextMenuLabel('sparkle', '发送到 AI'), async () => {
                    return await window.tmOpenAiSidebar({
                        selectedTaskIds: [taskId],
                        draft: '请基于这 1 个已选任务继续处理：',
                    });
                }),
                createItem(__tmRenderContextMenuLabel('bot', '优化任务名称'), async () => {
                    if (typeof window.tmRequireFullFeature === 'function' && !window.tmRequireFullFeature('ai-optimize-task-name', 'AI 优化任务名称')) return;
                    if (typeof __tmEnsureAiRuntimeLoaded === 'function' && !await __tmEnsureAiRuntimeLoaded()) return;
                    try { globalThis.tmAiOptimizeTaskName?.(taskId); } catch (e) {}
                }),
                createItem(__tmRenderContextMenuLabel('bot', '编辑字段'), async () => {
                    if (typeof window.tmRequireFullFeature === 'function' && !window.tmRequireFullFeature('ai-edit-task-fields', 'AI 编辑字段')) return;
                    if (typeof __tmEnsureAiRuntimeLoaded === 'function' && !await __tmEnsureAiRuntimeLoaded()) return;
                    try { globalThis.tmAiEditTask?.(taskId); } catch (e) {}
                }),
                createItem(__tmRenderContextMenuLabel('bot', '安排日程'), async () => {
                    if (typeof window.tmRequireFullFeature === 'function' && !window.tmRequireFullFeature('ai-plan-task-schedule', 'AI 安排日程')) return;
                    if (typeof __tmEnsureAiRuntimeLoaded === 'function' && !await __tmEnsureAiRuntimeLoaded()) return;
                    try { globalThis.tmAiPlanTaskSchedule?.(taskId); } catch (e) {}
                }),
            ]));
        }
        menu.appendChild(createItem(__tmRenderContextMenuLabel('file-text', '任务详情'), () => {
            try { window.tmOpenTaskDetail?.(taskId); } catch (e) {}
        }));
        menu.appendChild(createItem(__tmRenderContextMenuLabel('map-pin', '跳转到原块'), async () => {
            try { await window.tmJumpToTask?.(taskId); } catch (e) {}
        }));
        menu.appendChild(createItem(__tmRenderContextMenuLabel('square-pen', '修改内容'), () => tmEdit(taskId)));
        appendSectionSeparator();
        if (__tmIsRecurringInstanceTask(task)) {
            menu.appendChild(createItem(__tmRenderContextMenuLabel('trash-2', '删除记录'), () => {
                tmDelete(taskId, { source: 'context-repeat-history-delete' });
            }, true));
        } else {
            menu.appendChild(createItem(__tmRenderContextMenuLabel('trash-2', '删除任务'), () => tmDelete(taskId), true));
        }

        document.body.appendChild(menu);
        requestAnimationFrame(() => {
            try {
                const rect = menu.getBoundingClientRect();
                const vw = Math.max(0, window.innerWidth || document.documentElement.clientWidth || 0);
                const vh = Math.max(0, window.innerHeight || document.documentElement.clientHeight || 0);
                const margin = 8;
                let x = Number(event.clientX) || 0;
                let y = Number(event.clientY) || 0;
                if (x + rect.width > vw - margin) x = x - rect.width;
                if (y + rect.height > vh - margin) y = y - rect.height;
                x = clamp(x, margin, Math.max(margin, vw - rect.width - margin));
                y = clamp(y, margin, Math.max(margin, vh - rect.height - margin));
                menu.style.left = `${Math.round(x)}px`;
                menu.style.top = `${Math.round(y)}px`;
            } catch (e) {}
        });

        // Click outside to close
        const closeHandler = (ev) => {
            try {
                if (menu.contains(ev?.target)) return;
                if (ev?.target instanceof Element && ev.target.closest('.tm-task-time-hub-popover')) return;
            } catch (e) {}
            menu.remove();
            try { __tmClearOutsideCloseHandler(closeHandler); } catch (e) {}
            if (state.taskContextMenuCloseHandler === closeHandler) state.taskContextMenuCloseHandler = null;
        };
        state.taskContextMenuCloseHandler = closeHandler;
        __tmScheduleBindOutsideCloseHandler(closeHandler);
    };

    let __tmAllDocumentsFetchedAt = 0;
    let __tmAllDocumentsFetchPromise = null;
    async function __tmEnsureAllDocumentsLoaded(force = false) {
        const now = Date.now();
        if (!force && Array.isArray(state.allDocuments) && state.allDocuments.length > 0 && (now - (__tmAllDocumentsFetchedAt || 0) < 60000)) {
            return state.allDocuments;
        }
        if (force && __tmAllDocumentsFetchPromise) {
            try { await __tmAllDocumentsFetchPromise; } catch (e) {}
        } else if (!force && __tmAllDocumentsFetchPromise) return await __tmAllDocumentsFetchPromise;
        __tmAllDocumentsFetchPromise = Promise.resolve()
            .then(() => API.getAllDocuments())
            .then((docs) => {
                if (Array.isArray(docs)) state.allDocuments = docs;
                __tmAllDocumentsFetchedAt = Date.now();
                return Array.isArray(state.allDocuments) ? state.allDocuments : [];
            })
            .catch((e) => {
                try { console.error('[设置] 刷新文档列表失败:', e); } catch (e2) {}
                return Array.isArray(state.allDocuments) ? state.allDocuments : [];
            })
            .finally(() => {
                __tmAllDocumentsFetchPromise = null;
            });
        return await __tmAllDocumentsFetchPromise;
    }

    const TM_MAIN_SETTINGS_SECTIONS = Object.freeze([
        { id: 'display', label: '基础显示' },
        { id: 'new-task', label: '新建/归档' },
        { id: 'status', label: '状态选项' },
        { id: 'layout', label: '视图布局' },
        { id: 'search', label: '搜索分组' },
        { id: 'topbar', label: '顶栏入口' },
        { id: 'quickbar', label: '悬浮条' },
        { id: 'tomato', label: '番茄钟/联动' }
    ]);

    const TM_CALENDAR_SETTINGS_SECTIONS = Object.freeze([
        { id: 'calendar-general', label: '基础视图' },
        { id: 'calendar-layout', label: '视图布局' },
        { id: 'calendar-content', label: '日程与显示' },
        { id: 'calendar-reminders', label: '提醒通知' },
        { id: 'calendar-subscription', label: 'ICS 订阅' }
    ]);

    const TM_APPEARANCE_SETTINGS_SECTIONS = Object.freeze([
        { id: 'columns', label: '列设置' },
        { id: 'icons', label: '插件图标' },
        { id: 'tabs', label: '页签栏' },
        { id: 'topbar', label: '顶栏按钮' },
        { id: 'checkbox', label: '任务复选框' },
        { id: 'colors', label: '配色' }
    ]);

    function __tmGetSettingsSections(tab = state.settingsActiveTab || '') {
        const activeTab = String(tab || '').trim();
        if (activeTab === 'main') return TM_MAIN_SETTINGS_SECTIONS;
        if (activeTab === 'appearance') return TM_APPEARANCE_SETTINGS_SECTIONS;
        if (activeTab === 'calendar') return TM_CALENDAR_SETTINGS_SECTIONS;
        if (activeTab !== 'ai') return [];
        const experienceMode = String(SettingsStore.data.aiExperienceMode || '').trim() === 'legacy' ? 'legacy' : 'agent';
        if (experienceMode === 'legacy') {
            return [
                { id: 'ai-mode', label: '工作方式' },
                { id: 'ai-connection', label: '模型设置' },
                { id: 'ai-scheduled', label: '定时事件' }
            ];
        }
        const sections = [
            { id: 'ai-mode', label: '工作方式' },
            { id: 'ai-agent', label: '智能体' }
        ];
        const hasFullFeature = typeof window.tmLicenseHasFeature === 'function' && window.tmLicenseHasFeature('pro');
        if (hasFullFeature) sections.push({ id: 'ai-policy', label: '安排规则' });
        sections.push({ id: 'ai-scheduled', label: '定时事件' });
        return sections;
    }

    function __tmGetSettingsSectionAnchorTop(content, section) {
        if (!(content instanceof HTMLElement) || !(section instanceof HTMLElement)) return 0;
        const anchor = section.querySelector('.tm-settings-section-title');
        const target = anchor instanceof HTMLElement ? anchor : section;
        const contentRect = content.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        return (Number(content.scrollTop) || 0) + (targetRect.top - contentRect.top);
    }

    function __tmGetSettingsSectionProbeTop(content, subtabs) {
        const stickyOffset = (subtabs instanceof HTMLElement ? subtabs.offsetHeight : 0) + 8;
        return (Number(content?.scrollTop) || 0) + stickyOffset;
    }

    function __tmSetActiveSettingsSection(modal, sectionId, ensureVisible = false) {
        const root = modal || state.settingsModal;
        if (!root) return;
        const activeId = String(sectionId || '').trim();
        const buttons = Array.from(root.querySelectorAll('.tm-settings-subtab-btn[data-section-id]'));
        if (!buttons.length) return;
        let activeButton = null;
        buttons.forEach((button) => {
            const matched = String(button.dataset.sectionId || '') === activeId;
            button.classList.toggle('is-active', matched);
            button.setAttribute('aria-pressed', matched ? 'true' : 'false');
            if (matched) activeButton = button;
        });
        if (!ensureVisible || !(activeButton instanceof HTMLElement)) return;
        const scroller = activeButton.closest('.tm-settings-subtabs');
        if (!(scroller instanceof HTMLElement)) return;
        const btnLeft = activeButton.offsetLeft;
        const btnRight = btnLeft + activeButton.offsetWidth;
        const visibleLeft = scroller.scrollLeft;
        const visibleRight = visibleLeft + scroller.clientWidth;
        if (btnLeft >= visibleLeft && btnRight <= visibleRight) return;
        const nextLeft = Math.max(0, btnLeft - Math.max(16, Math.round((scroller.clientWidth - activeButton.offsetWidth) / 2)));
        try { scroller.scrollTo({ left: nextLeft, behavior: 'smooth' }); } catch (e) { scroller.scrollLeft = nextLeft; }
    }

    function __tmSyncSettingsSectionNav(modal) {
        const root = modal || state.settingsModal;
        if (!root || !__tmGetSettingsSections(state.settingsActiveTab || '').length) return;
        const content = root.querySelector('.tm-settings-content');
        const subtabs = root.querySelector('.tm-settings-subtabs');
        const sections = Array.from(root.querySelectorAll('.tm-settings-panel[data-tm-settings-section]'));
        if (!(content instanceof HTMLElement) || !sections.length) return;
        const pendingJump = state.settingsSectionJump;
        if (pendingJump && pendingJump.root === root) {
            const pendingId = String(pendingJump.sectionId || '').trim();
            const targetTop = Number(pendingJump.targetTop);
            const reached = Number.isFinite(targetTop) && Math.abs((Number(content.scrollTop) || 0) - targetTop) <= 6;
            if (pendingId) {
                __tmSetActiveSettingsSection(root, pendingId, false);
                if (!reached && Date.now() < (Number(pendingJump.until) || 0)) return;
                state.settingsSectionJump = null;
                return;
            }
            state.settingsSectionJump = null;
        }
        const probeTop = __tmGetSettingsSectionProbeTop(content, subtabs);
        let activeId = String(sections[0]?.dataset?.tmSettingsSection || '').trim();
        const maxScrollTop = Math.max(0, content.scrollHeight - content.clientHeight);
        if ((Number(content.scrollTop) || 0) >= maxScrollTop - 4) {
            activeId = String(sections[sections.length - 1]?.dataset?.tmSettingsSection || '').trim() || activeId;
            __tmSetActiveSettingsSection(root, activeId, false);
            return;
        }
        sections.forEach((section) => {
            const sectionId = String(section?.dataset?.tmSettingsSection || '').trim();
            if (!sectionId) return;
            if (__tmGetSettingsSectionAnchorTop(content, section) <= probeTop) activeId = sectionId;
        });
        __tmSetActiveSettingsSection(root, activeId, false);
    }

    function __tmBindHorizontalDragScroll(scroller) {
        if (!(scroller instanceof HTMLElement) || scroller.__tmHorizontalDragBound) return;
        scroller.__tmHorizontalDragBound = true;
        let startX = 0;
        let startY = 0;
        let startScrollLeft = 0;
        let dragging = false;
        let touchActive = false;
        let touchHandled = false;
        let startTarget = null;
        const threshold = 6;

        const finish = () => {
            touchActive = false;
            if (dragging || touchHandled) scroller.__tmSuppressClickUntil = Date.now() + 300;
            dragging = false;
            touchHandled = false;
            startTarget = null;
        };

        scroller.addEventListener('touchstart', (event) => {
            const touch = event.touches && event.touches[0];
            if (!touch) return;
            touchActive = true;
            touchHandled = false;
            startX = Number(touch.clientX) || 0;
            startY = Number(touch.clientY) || 0;
            startScrollLeft = Number(scroller.scrollLeft) || 0;
            dragging = false;
            startTarget = event.target instanceof Element ? event.target.closest('.tm-settings-subtab-btn') : null;
        }, { passive: true });

        scroller.addEventListener('touchmove', (event) => {
            if (!touchActive) return;
            const touch = event.touches && event.touches[0];
            if (!touch) return;
            const deltaX = (Number(touch.clientX) || 0) - startX;
            const deltaY = (Number(touch.clientY) || 0) - startY;
            if (!dragging && Math.abs(deltaX) > threshold && Math.abs(deltaX) > Math.abs(deltaY)) dragging = true;
            if (!dragging) return;
            scroller.scrollLeft = startScrollLeft - deltaX;
            touchHandled = true;
            try { event.preventDefault(); } catch (e) {}
        }, { passive: false });

        scroller.addEventListener('touchend', (event) => {
            if (!touchActive) return;
            const button = startTarget instanceof HTMLElement ? startTarget : null;
            const shouldJump = !dragging && button;
            const sectionId = shouldJump ? String(button.dataset.sectionId || '').trim() : '';
            finish();
            if (!sectionId) return;
            try { event.preventDefault(); } catch (e) {}
            try { event.stopPropagation(); } catch (e) {}
            try { window.tmJumpSettingsSection?.(sectionId); } catch (e) {}
        }, { passive: false });

        scroller.addEventListener('touchcancel', finish, { passive: true });
        scroller.addEventListener('click', (event) => {
            if ((Number(scroller.__tmSuppressClickUntil) || 0) <= Date.now()) return;
            try { event.preventDefault(); } catch (e) {}
            try { event.stopPropagation(); } catch (e) {}
        }, true);
    }

    window.tmJumpSettingsSection = function(sectionId) {
        const root = state.settingsModal;
        if (!root) return;
        const content = root.querySelector('.tm-settings-content');
        const subtabs = root.querySelector('.tm-settings-subtabs');
        if (!(content instanceof HTMLElement)) return;
        const target = Array.from(root.querySelectorAll('.tm-settings-panel[data-tm-settings-section]')).find((section) => {
            return String(section?.dataset?.tmSettingsSection || '').trim() === String(sectionId || '').trim();
        });
        if (!(target instanceof HTMLElement)) return;
        const stickyOffset = (subtabs instanceof HTMLElement ? subtabs.offsetHeight : 0) + 6;
        const maxScrollTop = Math.max(0, content.scrollHeight - content.clientHeight);
        const nextTop = Math.max(0, Math.min(maxScrollTop, __tmGetSettingsSectionAnchorTop(content, target) - stickyOffset));
        state.settingsSectionJump = {
            root,
            sectionId: String(sectionId || '').trim(),
            targetTop: nextTop,
            until: Date.now() + 2000
        };
        __tmSetActiveSettingsSection(root, sectionId, true);
        try { content.scrollTo({ top: nextTop, behavior: 'smooth' }); } catch (e) { content.scrollTop = nextTop; }
    };

    // 显示设置
