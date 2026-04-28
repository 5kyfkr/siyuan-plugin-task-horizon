    function renderTaskList(renderContext = null) {
        const context = (renderContext && typeof renderContext === 'object')
            ? renderContext
            : __tmBuildListRenderContext();
        const colOrder = (Array.isArray(context.colOrder) && context.colOrder.length)
            ? context.colOrder
            : __tmGetDefaultColumnOrder();
        const colSet = new Set(colOrder);
        const colCount = Number(context.colCount) || colOrder.length || 7;
        if (state.filteredTasks.length === 0) {
            return `<tr><td colspan="${colCount}" style="text-align: center; padding: 40px; color: var(--tm-secondary-text);">暂无任务</td></tr>`;
        }

        const isGloballyLocked = GlobalLock.isLocked();
        const isListView = globalThis.__tmRuntimeState?.isViewMode?.('list') ?? (String(state.viewMode || '').trim() === 'list');
        const virtualThreshold = 50;
        const virtualEnabled = isListView && state.filteredTasks.length > virtualThreshold;
        const listStep = Math.max(100, Math.min(1200, Number(state.listRenderStep) || 100));
        const taskRowLimit = virtualEnabled
            ? Math.max(listStep, Math.min(state.filteredTasks.length, Number(state.listRenderLimit) || listStep))
            : Number.POSITIVE_INFINITY;
        let renderedTaskRows = 0;
        const hasTaskRowBudget = () => renderedTaskRows < taskRowLimit;
        const isDark = __tmIsDarkMode();
        const enableGroupBg = !!SettingsStore.data.enableGroupTaskBgByGroupColor;
        let currentGroupBg = '';
        const progressBarColor = isDark
            ? __tmNormalizeHexColor(SettingsStore.data.progressBarColorDark, '#81c784')
            : __tmNormalizeHexColor(SettingsStore.data.progressBarColorLight, '#4caf50');
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
        const tomatoIntegrationEnabled = !!SettingsStore.data.enableTomatoIntegration;
        const tomatoSpentAttrMode = String(SettingsStore.data.tomatoSpentAttrMode || 'minutes').trim() || 'minutes';
        const useTomatoSpentHours = tomatoIntegrationEnabled && tomatoSpentAttrMode === 'hours';
        const tomatoFocusTaskId = tomatoIntegrationEnabled ? String(state.timerFocusTaskId || '').trim() : '';
        const tomatoFocusModeEnabled = __tmIsTomatoFocusModeEnabled();
        const checkboxExtraClass = isGloballyLocked ? 'tm-operating' : '';
        const recurringBadgeInlineOptions = { className: 'tm-recurring-instance-badge--inline' };
        const hasContentCol = colSet.has('content');
        const hasStartDateCol = colSet.has('startDate');
        const hasCompletionTimeCol = colSet.has('completionTime');
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
                        : { key: `days_${diffDays}`, sortValue: diffDays });
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
        const pinnedRoots = rootTasks.filter(t => t.pinned);
        const normalRoots = rootTasks.filter(t => !t.pinned);
        const docRootTasksByDoc = derived.docRootTasksByDoc;
        const directChildStatsMemo = new Map();
        const getDirectChildStats = (task) => {
            const id = String(task?.id || '').trim();
            if (id && directChildStatsMemo.has(id)) return directChildStatsMemo.get(id);
            const allChildren = Array.isArray(task?.children) ? task.children : [];
            let completed = 0;
            for (let i = 0; i < allChildren.length; i += 1) {
                if (allChildren[i]?.done) completed += 1;
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
        const emitRow = (task, depth, hasChildren, collapsed) => {
            if (!hasTaskRowBudget()) return '';
            const { done, content, priority, completionTime, duration, remark, docName, pinned, startDate } = task;
            const taskId = String(task?.id || '').trim();
            const isMultiSelected = __tmIsTaskMultiSelected(task.id);

            // 计算子任务统计信息
            const directChildStats = getDirectChildStats(task);
            const totalChildren = directChildStats.total;
            const completedChildren = directChildStats.completed;
            const remainingChildren = directChildStats.remaining;
            const childStatsHtml = remainingChildren > 0
                ? `<span class="tm-task-child-count" style="font-size: 11px; color: var(--tm-secondary-text); margin-left: 4px; background: var(--tm-doc-count-bg); padding: 1px 5px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; height: 14px;" title="共${totalChildren}个任务，已完成${completedChildren}个，剩余${remainingChildren}个">${remainingChildren}</span>`
                : '';

            const indent = Math.max(0, Number(depth) || 0) * 12;

            // 计算子任务进度条背景（复用已定义的 allChildren, totalChildren, completedChildren）
            const progressPercent = totalChildren > 0 ? Math.round((completedChildren / totalChildren) * 100) : 0;
            const groupBg = enableGroupBg ? (currentGroupBg || resolvePinnedTaskGroupBg(task)) : '';
            const progressBgStyle = (hasChildren && progressPercent > 0)
                ? (enableGroupBg && groupBg
                    ? `background-image: linear-gradient(90deg, ${progressBarColor} ${progressPercent}%, transparent ${progressPercent}%);background-repeat:no-repeat;background-size:100% 3px;background-position:left bottom;`
                    : `background-image: linear-gradient(90deg, ${progressBarColor} ${progressPercent}%, transparent ${progressPercent}%);background-repeat:no-repeat;`)
                : '';
            const renderedContent = hasContentCol ? API.renderTaskContentHtml(task.markdown, content) : '';
            const contentTooltip = hasContentCol
                ? __tmBuildTooltipAttrs(String(content || '').trim() || '(无内容)', { side: 'bottom', ariaLabel: false })
                : '';
            const startDateText = hasStartDateCol ? __tmFormatTaskTime(startDate) : '';
            const completionTimeText = hasCompletionTimeCol ? __tmFormatTaskTime(completionTime) : '';
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
            const finalRowClass = [rowClass, isMultiSelected ? 'tm-task-row--multi-selected' : ''].filter(Boolean).join(' ');
            const touchDragAttr = useCustomTouchTaskDrag
                ? ` onpointerdown="tmTaskTouchDragStart(event, '${taskId}')"`
                : '';
            let rowHtml = `<tr data-id="${taskId}" data-depth="${depth}" class="${finalRowClass}" ${groupBg ? `style="background-color:${groupBg};"` : ''} draggable="true" ondragstart="tmDragTaskStart(event, '${taskId}')" ondragend="tmDragTaskEnd(event)" ondragenter="tmTaskRowDragOver(event, '${taskId}')" ondragover="tmTaskRowDragOver(event, '${taskId}')" ondragleave="tmTaskRowDragLeave(event, '${taskId}')" ondrop="tmTaskRowDrop(event, '${taskId}')"${touchDragAttr} onclick="tmRowClick(event, '${taskId}')" oncontextmenu="tmShowTaskContextMenu(event, '${taskId}')">`;
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
                    <td class="tm-task-content-cell" style="${getTableCellStyle('content', progressBgStyle)}">
                        <div class="tm-task-cell" style="padding-left:${contentIndent}px">
                            ${treeGuides}
                            <span class="${leadingClass}">
                                ${leadingRing}
                                ${__tmRenderTaskCheckbox(taskId, task, { checked: done, extraClass: checkboxExtraClass })}${toggle}
                            </span>
                            <span class="tm-task-text ${done ? 'tm-task-done' : ''}"
                                  data-level="${depth}">
                                <span class="tm-task-content-clickable" onclick="tmJumpToTask('${taskId}', event)"${contentTooltip}>${renderedContent}${__tmRenderRecurringTaskInlineIcon(task)}${reminderHtml}${__tmRenderRecurringInstanceBadge(task, recurringBadgeInlineOptions)}</span>
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
                    case 'remainingTime':
                        rowHtml += `<td class="tm-task-meta-cell" data-tm-task-time-field="remainingTime" style="${getTableCellStyle('remainingTime', 'text-align:center;')}" title="${esc(remainingLabel)}">${remainingHtml}</td>`;
                        break;
                    case 'duration':
                        rowHtml += `
                    <td class="tm-cell-editable tm-task-meta-cell" data-tm-task-time-field="duration" style="${getTableCellStyle('duration')}" onclick="tmBeginCellEdit('${taskId}','duration',this,event)">${esc(duration || '')}</td>`;
                        break;
                    case 'spent': {
                        const txt = useTomatoSpentHours
                            ? __tmFormatSpentHours(__tmParseNumber(task?.tomatoHours))
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
            renderedTaskRows += 1;
            return rowHtml;
        };

        // 递归渲染任务树，子任务按照全局 filteredTasks 顺序排列
        const renderTaskTree = (task, depth, inheritedHideCompleted = false) => {
            const rows = [];
            const hideCompletedDescendants = __tmResolveHideCompletedDescendantsFlag(task, inheritedHideCompleted);

            // 获取该任务在 filtered 中的子任务
            const childTasks = (task.children || []).filter((c) => filteredIdSet.has(c.id) && __tmShouldKeepChildTaskVisible(task, c, inheritedHideCompleted));

            childTasks.sort((a, b) => getTaskOrder(a.id) - getTaskOrder(b.id));

            const hasChildren = childTasks.length > 0;
            const collapsed = state.collapsedTaskIds.has(String(task.id));
            const showChildren = hasChildren;

            const firstRow = emitRow(task, depth, showChildren, collapsed);
            if (!firstRow) return rows;
            rows.push(firstRow);

            if (showChildren && !collapsed) {
                childTasks.forEach(child => {
                    if (!hasTaskRowBudget()) return;
                    rows.push(...renderTaskTree(child, depth + 1, hideCompletedDescendants));
                });
            }

            return rows;
        };

        const allRows = [];

        // 处理置顶任务（全局混排）
        if (pinnedRoots.length > 0) {
            const pinnedGroupKey = 'pinned_root_tasks';
            const pinnedCollapsed = state.collapsedGroups?.has(pinnedGroupKey);
            const pinnedToggle = `<span class="tm-group-toggle${pinnedCollapsed ? ' tm-group-toggle--collapsed' : ''}" onclick="tmToggleGroupCollapse('${pinnedGroupKey}', event)" style="cursor:pointer;margin-right:0;display:inline-flex;align-items:center;justify-content:center;width:16px;"><svg class="tm-group-toggle-icon" viewBox="0 0 16 16" width="16" height="16"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
            const pinnedDurationSum = __tmCalcGroupDurationText(pinnedRoots);
            allRows.push(`<tr class="tm-group-row" data-group-key="${pinnedGroupKey}"><td colspan="${colCount}" onclick="tmToggleGroupCollapse('${pinnedGroupKey}', event)" style="cursor:pointer;background:var(--tm-header-bg);font-weight:bold;color:var(--tm-text-color);"><div class="tm-group-sticky">${pinnedToggle}<span style="display:inline-flex;align-items:center;justify-content:center;width:16px;min-width:16px;color:var(--tm-warning-color);">📌</span><span class="tm-group-label" style="color:var(--tm-warning-color);">置顶</span><span class="tm-badge tm-badge--count">${pinnedRoots.length}</span>${pinnedDurationSum ? `<span class="tm-badge tm-badge--duration"><span class="tm-badge__icon">${__tmRenderBadgeIcon('chart-column')}</span>${esc(pinnedDurationSum)}</span>` : ''}</div></td></tr>`);
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
                    if (prefer) group.items.sort(compareByTimePriority);
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

                // 获取该文档在 filtered 中的任务
                const docTasks = filteredTasksByDoc.get(String(docId || '').trim()) || [];
                if (docTasks.length === 0) return;

                // 获取该文档的根任务
                const docRootTasks = docRootTasksByDoc.get(String(docId || '').trim()) || [];

                // 分离置顶和非置顶
                const docNormal = docRootTasks.filter(t => !t.pinned);

                // 渲染文档标题（支持折叠）
                const docName = docEntry.name || '未知文档';
                const groupKey = `doc_${docId}`;
                const isCollapsed = state.collapsedGroups?.has(groupKey);
                const toggle = `<span class="tm-group-toggle${isCollapsed ? ' tm-group-toggle--collapsed' : ''}" onclick="tmToggleGroupCollapse('${groupKey}', event)" style="cursor:pointer;margin-right:0;display:inline-flex;align-items:center;justify-content:center;width:16px;"><svg class="tm-group-toggle-icon" viewBox="0 0 16 16" width="16" height="16"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
                const labelColor = __tmGetDocColorHex(docId, isDark) || 'var(--tm-group-doc-label-color)';

                allRows.push(`<tr class="tm-group-row" data-group-key="${groupKey}"><td colspan="${colCount}" onclick="tmToggleGroupCollapse('${groupKey}', event)" style="cursor:pointer;background:var(--tm-header-bg);font-weight:bold;color:var(--tm-text-color);"><div class="tm-group-sticky">${toggle}<span class="tm-group-label" style="color:${labelColor};">${__tmRenderDocGroupLabel(docId, docName)}</span><span class="tm-badge tm-badge--count">${docTasks.length}</span></div></td></tr>`);

                // 渲染该文档的任务（如果未折叠）
                if (!isCollapsed) {
                    currentGroupBg = enableGroupBg ? __tmGroupBgFromLabelColor(labelColor, isDark) : '';
                    const useDocH2Subgroup = enableDocH2Subgroup && __tmDocHasAnyHeading(docId, docTasks);
                    if (!useDocH2Subgroup) {
                        docNormal.forEach(task => {
                            if (!hasTaskRowBudget()) return;
                            allRows.push(...renderTaskTree(task, 0));
                        });
                    } else {
                        const h2Groups = new Map();
                        const h2OrderSource = docTasks;
                        const h2Buckets = __tmBuildDocHeadingBuckets(h2OrderSource, noHeadingLabel);
                        docNormal.forEach(task => {
                                const b = __tmGetDocHeadingBucket(task, noHeadingLabel);
                                if (!h2Groups.has(b.key)) h2Groups.set(b.key, { label: b.label, id: String(b.id || '').trim(), items: [] });
                                h2Groups.get(b.key).items.push(task);
                            });

                        const orderedH2Buckets = h2Buckets
                            .filter((bucket) => (h2Groups.get(bucket.key)?.items || []).length > 0)
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
                            allRows.push(`<tr class="tm-group-row" data-group-kind="h2" data-group-key="${esc(h2Key)}"><td colspan="${colCount}" onclick="tmToggleGroupCollapse('${h2Key}', event)" style="cursor:pointer;background:var(--tm-header-bg);font-weight:bold;color:var(--tm-text-color);"><div class="tm-group-sticky" style="padding-left:2ch;">${toggleH2}<span class="tm-group-label" style="color:${h2LabelColor};">${__tmRenderHeadingLevelIconLabel(g.label || '', SettingsStore.data.taskHeadingLevel || 'h2')}</span><span class="tm-badge tm-badge--count">${Array.isArray(items) ? items.length : 0}</span>${createBtnHtml}</div></td></tr>`);
                            if (!h2Collapsed) {
                                items.forEach(task => {
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
                    return { key: 'pending', label: '待定', sortValue: Infinity };
                }

                if (diffDays < 0) return { key: 'overdue', label: '已过期', sortValue: diffDays };
                if (diffDays === 0) return { key: 'today', label: '今天', sortValue: 0 };
                if (diffDays === 1) return { key: 'tomorrow', label: '明天', sortValue: 1 };
                if (diffDays === 2) return { key: 'after_tomorrow', label: '后天', sortValue: 2 };

                return { key: `days_${diffDays}`, label: `余${diffDays}天`, sortValue: diffDays };
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
                return __tmCalcGroupDurationText(items);
            };

            sortedGroups.forEach(group => {
                const isCollapsed = state.collapsedGroups?.has(group.key);
                const toggle = `<span class="tm-group-toggle${isCollapsed ? ' tm-group-toggle--collapsed' : ''}" onclick="tmToggleGroupCollapse('${group.key}', event)" style="cursor:pointer;margin-right:0;display:inline-flex;align-items:center;justify-content:center;width:16px;"><svg class="tm-group-toggle-icon" viewBox="0 0 16 16" width="16" height="16"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
                const labelColor = __tmGetTimeGroupLabelColor(group);

                // 计算该分组下所有任务的时长总和
                const durationSum = calculateGroupDuration(group.items);

                allRows.push(`<tr class="tm-group-row" data-group-key="${esc(group.key)}"><td colspan="${colCount}" onclick="tmToggleGroupCollapse('${group.key}', event)" style="cursor:pointer;background:var(--tm-header-bg);font-weight:bold;color:var(--tm-text-color);"><div class="tm-group-sticky">${toggle}<span class="tm-group-label" style="color:${labelColor};">${esc(group.label)}</span><span class="tm-badge tm-badge--count">${group.items.length}</span>${durationSum ? `<span class="tm-badge tm-badge--duration"><span class="tm-badge__icon">${__tmRenderBadgeIcon('chart-column')}</span>${esc(durationSum)}</span>` : ''}</div></td></tr>`);

                if (!isCollapsed) {
                    currentGroupBg = enableGroupBg
                        ? (group.key === 'pending' ? __tmGetPendingTimeGroupTaskBg(isDark) : __tmGroupBgFromLabelColor(labelColor, isDark))
                        : '';
                    // 组内任务按照全局顺序排列
                    const prefer = !!SettingsStore.data.groupSortByBestSubtaskTimeInTimeQuadrant;
                    if (prefer) group.items.sort(compareByTimePriority);
                    group.items.forEach(task => {
                        if (!hasTaskRowBudget()) return;
                        allRows.push(...renderTaskTree(task, 0));
                    });
                }
            });
        } else if (state.groupByTaskName) {
            // 按任务名分组模式：只对顶级任务分组，子任务跟随父任务
            // 1. 先找出所有顶级任务
            const topLevelTasks = state.filteredTasks.filter(t => !t.parentTaskId);

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

        if (allRows.length === 0) {
            return `<tr><td colspan="${colCount}" style="text-align: center; padding: 40px; color: var(--tm-secondary-text);">暂无任务</td></tr>`;
        }

        if (virtualEnabled) {
            const remain = renderedTaskRows >= taskRowLimit
                ? Math.max(0, state.filteredTasks.length - renderedTaskRows)
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
        const step = Math.max(100, Math.min(1200, Number(state.listRenderStep) || 100));
        const next = Math.max(step, Number(state.listRenderLimit) || step) + step;
        state.listRenderLimit = Math.min(state.filteredTasks.length, next);
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
        render();
    };

    // 切换任务状态
    window.tmToggle = async function(id) {
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id];
        if (!task) return;

        await window.tmSetDone(id, !task.done);
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
        if (__tmRenderScheduled) return;
        __tmRenderScheduled = true;
        requestAnimationFrame(() => {
            __tmRenderScheduled = false;
            const needFilters = __tmRenderNeedFilters;
            __tmRenderNeedFilters = false;
            if (needFilters) applyFilters();
            render();
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
            // 更新所有复选框的禁用状态
            const checkboxes = document.querySelectorAll('.tm-task-checkbox');
            checkboxes.forEach(cb => {
                cb.disabled = this.locked;
                if (this.locked) {
                    cb.classList.add('tm-operating');
                } else {
                    cb.classList.remove('tm-operating');
                }
            });
        },

        isLocked() {
            return this.locked;
        }
    };

    // ============ 树形状态保护器（解决父子任务属性丢失） ============
    const TreeProtector = {
        // 操作前保存完整树状态：内容 -> {id, parentId, data, collapsed}
        snapshot: new Map(),
        idMapping: new Map(), // oldId -> newId
        collapsedState: new Map(), // oldId -> boolean

        // 递归保存树
        saveTree(tasks, parentId = null, level = 0) {
            tasks.forEach(task => {
                // 保存关键信息，以内容为key（因为ID会变，内容相对稳定）
                const key = `${level}:${parentId || 'root'}:${task.content}`;
                this.snapshot.set(key, {
                    oldId: task.id,
                    parentId: parentId,
                    level: level,
                    data: {
                        priority: task.priority || '',
                        duration: task.duration || '',
                        remark: task.remark || '',
                        completionTime: task.completionTime || '',
                        customTime: task.customTime || '',
                        customStatus: task.customStatus || ''
                    },
                    done: task.done
                });

                // 保存折叠状态
                this.collapsedState.set(task.id, state.collapsedTaskIds.has(task.id));

                // 递归保存子任务
                if (task.children && task.children.length > 0) {
                    this.saveTree(task.children, task.id, level + 1);
                }
            });
        },

        // 操作后恢复树属性
        restoreTree(tasks, parentId = null, level = 0) {
            tasks.forEach(task => {
                // 构建查找key
                const key = `${level}:${parentId || 'root'}:${task.content}`;
                const saved = this.snapshot.get(key);

                if (saved) {
                    // 建立ID映射
                    this.idMapping.set(saved.oldId, task.id);

                    // 恢复属性（优先使用保存的，除非新任务已有值）
                    if (!task.priority && saved.data.priority) task.priority = saved.data.priority;
                    if (!task.duration && saved.data.duration) task.duration = saved.data.duration;
                    if (!task.remark && saved.data.remark) task.remark = saved.data.remark;
                    if (!task.completionTime && saved.data.completionTime) task.completionTime = saved.data.completionTime;
                    if (!task.customTime && saved.data.customTime) task.customTime = saved.data.customTime;
                    if (!task.customStatus && saved.data.customStatus) task.customStatus = saved.data.customStatus;

                    // 恢复MetaStore映射
                if (saved.oldId !== task.id) {
                    MetaStore.remapId(saved.oldId, task.id);
                }

            }

                // 递归恢复子任务
                if (task.children && task.children.length > 0) {
                    this.restoreTree(task.children, task.id, level + 1);
                }
            });
        },

        // 恢复折叠状态（基于ID映射）
        restoreCollapsedState() {
            if (!(this.collapsedState instanceof Map) || this.collapsedState.size === 0) return;
            const nextCollapsed = new Set(state.collapsedTaskIds || SettingsStore.data.collapsedTaskIds || []);
            let changed = false;
            for (const [oldId, wasCollapsed] of this.collapsedState.entries()) {
                const oldKey = String(oldId || '').trim();
                if (!oldKey || !this.idMapping.has(oldKey)) continue;
                const newId = String(this.idMapping.get(oldKey) || oldKey).trim();
                if (newId && newId !== oldKey && nextCollapsed.delete(oldKey)) changed = true;
                if (wasCollapsed) {
                    if (newId && !nextCollapsed.has(newId)) {
                        nextCollapsed.add(newId);
                        changed = true;
                    }
                } else if (newId && nextCollapsed.delete(newId)) {
                    changed = true;
                }
            }
            state.collapsedTaskIds = nextCollapsed;
            SettingsStore.data.collapsedTaskIds = [...nextCollapsed];
            if (changed) {
                try { __tmMarkCollapseStateChanged(); } catch (e) {}
                try { Storage.set('tm_collapsed_task_ids', SettingsStore.data.collapsedTaskIds); } catch (e) {}
                try {
                    const p = SettingsStore.save();
                    if (p && typeof p.catch === 'function') p.catch(() => null);
                } catch (e) {}
            }
        },

        clear() {
            this.snapshot.clear();
            this.idMapping.clear();
            this.collapsedState.clear();
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
        if (!state.flatTasks || typeof state.flatTasks !== 'object') state.flatTasks = {};
        const prev = globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid];
        if (!__tmTaskHasOwnHeadingContextFields(next) && prev && typeof prev === 'object') {
            __tmCopyTaskHeadingContext(next, prev);
        }
        state.flatTasks[tid] = next;
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
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid];
        if (!task || typeof task !== 'object') return finish(false, 'task-missing');
        const rawValue = attrValue == null ? '' : String(attrValue);
        const trimmedValue = String(rawValue || '').trim();
        const metaUpdate = __tmBuildMetaPatchFromAttrUpdate(key, rawValue, task);
        const comparablePatch = (metaUpdate?.patch && typeof metaUpdate.patch === 'object') ? metaUpdate.patch : null;
        if (comparablePatch) {
            const inversePatch = __tmCaptureTaskPatchInverse(tid, comparablePatch);
            if (__tmIsPatchNoop(comparablePatch, inversePatch)) {
                try {
                    __tmPushRefreshDebug('task-attr-apply-skip-noop', {
                        taskId: tid,
                        attrKey: key,
                    });
                } catch (e) {}
                return finish(false, 'noop');
            }
        }
        let metaPatch = null;

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
            case __TM_TASK_COMPLETE_AT_ATTR:
                task.taskCompleteAt = __tmNormalizeTaskCompleteAtValue(trimmedValue);
                task.task_complete_at = task.taskCompleteAt;
                metaPatch = { taskCompleteAt: task.taskCompleteAt };
                break;
            case 'custom-duration':
                task.duration = trimmedValue;
                metaPatch = { duration: trimmedValue };
                break;
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
                    __tmApplyTaskAttachmentPathsToTask(task, nextPaths);
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
            case 'custom-milestone-event':
                {
                    const milestone = trimmedValue === '1' || trimmedValue.toLowerCase() === 'true';
                    task.milestone = milestone;
                    task.custom_milestone = milestone ? '1' : '';
                    metaPatch = { milestone };
                }
                break;
        }

        try {
            __tmCacheTaskInState(task, {
                docNameFallback: task.doc_name || task.docName || '未命名文档'
            });
        } catch (e) {}
        try {
            if (metaPatch && typeof metaPatch === 'object') MetaStore.set(tid, metaPatch);
        } catch (e) {}
        return finish(true, 'applied');
    }

    async function __tmEnsureTaskInStateById(id) {
        const tid = String(id || '').trim();
        if (!tid) return null;
        const exists = globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid];
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
        const direct = globalThis.__tmRuntimeState?.getTaskById?.(bid) || state.flatTasks?.[bid] || state.pendingInsertedTasks?.[bid] || null;
        if (direct && typeof direct === 'object') {
            const taskId = String(direct?.id || bid).trim();
            const explicitAttrHostId = String(direct?.attrHostId || direct?.attr_host_id || '').trim();
            return {
                taskId: taskId || bid,
                attrHostId: explicitAttrHostId || taskId || bid,
                task: direct,
                matchedBy: 'id',
            };
        }

        let attrHostMatch = null;
        let attrHostAmbiguous = false;
        let parentHostMatch = null;
        let parentHostAmbiguous = false;
        const seenTaskIds = new Set();
        const rememberCandidate = (kind, task) => {
            const nextTask = (task && typeof task === 'object') ? task : null;
            const taskId = String(nextTask?.id || '').trim();
            if (!nextTask || !taskId) return;
            if (kind === 'attrHostId') {
                if (!attrHostMatch) {
                    attrHostMatch = nextTask;
                    return;
                }
                if (String(attrHostMatch?.id || '').trim() !== taskId) attrHostAmbiguous = true;
                return;
            }
            if (!parentHostMatch) {
                parentHostMatch = nextTask;
                return;
            }
            if (String(parentHostMatch?.id || '').trim() !== taskId) parentHostAmbiguous = true;
        };
        const scanStore = (store) => {
            const source = (store && typeof store === 'object') ? store : {};
            Object.keys(source).forEach((key) => {
                const task = source[key];
                const taskId = String(task?.id || key || '').trim();
                if (!taskId || seenTaskIds.has(taskId)) return;
                seenTaskIds.add(taskId);
                const explicitAttrHostId = String(task?.attrHostId || task?.attr_host_id || '').trim();
                if (explicitAttrHostId && explicitAttrHostId === bid && taskId !== bid) {
                    rememberCandidate('attrHostId', task);
                }
                const parentId = String(task?.parent_id || task?.parentId || '').trim();
                if (!parentId || parentId !== bid) return;
                const resolvedFromShape = __tmResolveTaskAttrHostIdFromParentShape(taskId, parentId, task);
                if (resolvedFromShape?.resolved === true && String(resolvedFromShape?.attrHostId || '').trim() === bid) {
                    rememberCandidate('parentHostId', task);
                }
            });
        };
        scanStore(state.flatTasks);
        scanStore(state.pendingInsertedTasks);

        if (attrHostMatch && !attrHostAmbiguous) {
            const taskId = String(attrHostMatch?.id || '').trim();
            return {
                taskId,
                attrHostId: bid,
                task: attrHostMatch,
                matchedBy: 'attrHostId',
            };
        }
        if (parentHostMatch && !parentHostAmbiguous) {
            const taskId = String(parentHostMatch?.id || '').trim();
            return {
                taskId,
                attrHostId: bid,
                task: parentHostMatch,
                matchedBy: 'parentHostId',
            };
        }
        return null;
    }

    async function __tmResolveTaskBindingFromAnyBlockId(id) {
        const bid = String(id || '').trim();
        if (!bid) return null;
        const resolveTaskAttrHostIdByTask = async (taskId, parentListId = '', source = null) => {
            return await __tmResolveStableTaskAttrHostId(taskId, parentListId, source);
        };
        const localBinding = __tmResolveLocalTaskBindingFromAnyBlockId(bid);
        if (localBinding) {
            const localTask = (localBinding.task && typeof localBinding.task === 'object') ? localBinding.task : null;
            const taskId = String(localBinding.taskId || '').trim() || bid;
            let attrHostId = String(localBinding.attrHostId || __tmGetTaskAttrHostId(localTask) || taskId).trim() || taskId;
            try {
                attrHostId = await resolveTaskAttrHostIdByTask(taskId, localTask?.parent_id, localTask);
            } catch (e) {}
            return {
                taskId,
                attrHostId: attrHostId || taskId,
                task: localTask,
            };
        }
        const direct = await API.getTaskById(bid).catch(() => null);
        if (direct && typeof direct === 'object') {
            const taskId = String(direct.id || bid).trim();
            let attrHostId = String(__tmGetTaskAttrHostId(direct) || taskId).trim() || taskId;
            try {
                attrHostId = await resolveTaskAttrHostIdByTask(taskId, direct.parent_id, direct);
            } catch (e) {}
            return {
                taskId,
                attrHostId: attrHostId || taskId,
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
                const attrHostId = await resolveTaskAttrHostIdByTask(rowId, row.parent_id, row);
                return { taskId: rowId, attrHostId: attrHostId || rowId, task: null };
            }
            if (type === 'l') {
                let taskIds = [];
                try { taskIds = await API.getTaskIdsInList(rowId); } catch (e) { taskIds = []; }
                if (taskIds.length === 1) {
                    const taskId = String(taskIds[0] || '').trim();
                    if (taskId) return { taskId, attrHostId: rowId, task: null };
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

    async function __tmResolveTaskIdFromAnyBlockId(id) {
        const resolved = await __tmResolveTaskBindingFromAnyBlockId(id);
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
        let attrs = {};
        try {
            const res = await API.call('/api/attr/getBlockAttrs', { id: attrsId });
            if (res && res.code === 0 && res.data && typeof res.data === 'object') attrs = res.data;
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
        const row = {
            id: sourceId,
            markdown: km || '',
            raw_content: String(parsed?.content || '').trim() || '(无内容)',
            content: String(parsed?.content || '').trim() || '(无内容)',
            done: !!parsed?.done,
            priority: String(attrs['custom-priority'] || '').trim(),
            duration: String(attrs['custom-duration'] || '').trim(),
            remark: __tmNormalizeRemarkMarkdown(attrs['custom-remark'] || ''),
            startDate: String(attrs['custom-start-date'] || '').trim(),
            start_date: String(attrs['custom-start-date'] || '').trim(),
            completionTime: String(attrs['custom-completion-time'] || '').trim(),
            completion_time: String(attrs['custom-completion-time'] || '').trim(),
            taskCompleteAt: String(attrs[__TM_TASK_COMPLETE_AT_ATTR] || '').trim(),
            task_complete_at: String(attrs[__TM_TASK_COMPLETE_AT_ATTR] || '').trim(),
            customStatus: String(attrs['custom-status'] || '').trim(),
            custom_status: String(attrs['custom-status'] || '').trim(),
            pinned: String(attrs['custom-pinned'] || '').trim(),
            milestone: String(attrs['custom-milestone-event'] || '').trim(),
            custom_time: String(attrs['custom-time'] || '').trim(),
            customTime: String(attrs['custom-time'] || '').trim(),
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

    async function __tmSetDoneByIdStateless(id, done) {
        const tid = String(id || '').trim();
        if (!tid) return false;
        const targetDone = !!done;
        let kramdown = '';
        try { kramdown = await API.getBlockKramdown(tid); } catch (e) { kramdown = ''; }
        if (!kramdown) return false;
        const statusRegex = /^(\s*(?:[\*\-]|\d+\.)\s*\[)([ xX])(\])/;
        const fallbackRegex = /(\[)([ xX])(\])/;
        let nextMd = '';
        if (statusRegex.test(kramdown)) {
            nextMd = kramdown.replace(statusRegex, `$1${targetDone ? 'x' : ' '}$3`);
        } else if (fallbackRegex.test(kramdown)) {
            nextMd = kramdown.replace(fallbackRegex, `$1${targetDone ? 'x' : ' '}$3`);
        } else {
            return false;
        }
        if (nextMd === kramdown) return true;
        try {
            try {
                const task0 = globalThis.__tmRuntimeState?.getTaskById?.(tid) || state.flatTasks?.[tid] || state.pendingInsertedTasks?.[tid] || null;
                __tmMarkLocalDoneTxSuppressionForTask(task0, [tid]);
            } catch (e) {}
            const res = await API.call('/api/block/updateBlock', {
                dataType: 'markdown',
                data: nextMd,
                id: tid
            });
            if (!(res && res.code === 0)) return false;
            if (targetDone) {
                try {
                    await __tmPersistMetaAndAttrsKernel(tid, __tmBuildTaskCompleteAtPatch(), {
                        touchMetaStore: false,
                        skipFlush: false,
                    });
                } catch (e) {}
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    // 更新 markdown 中的完成状态
    function updateDoneInMarkdown(markdown, done) {
        if (!markdown) return '- [ ] ';
        // 匹配列表项开头
        return markdown.replace(/^(\s*[\*\-]\s*)\[[ xX]\]/, `$1[${done ? 'x' : ' '}]`);
    }

    // ========== 原有完成状态处理 ==========

    const __tmDoneDesired = new Map();
    const __tmDoneBase = new Map();
    const __tmDoneChain = new Map();

    function __tmRemapTaskId(oldId, newId) {
        try {
            if (!oldId || !newId || oldId === newId) return;
            const task = state.flatTasks[oldId];
            if (!task) return;
            delete state.flatTasks[oldId];
            task.id = newId;
            state.flatTasks[newId] = task;
            try { MetaStore.remapId(oldId, newId); } catch (e) {}

            const updateRecursive = (list) => {
                list.forEach(t => {
                    if (t.id === oldId) t.id = newId;
                    if (t.children && t.children.length > 0) updateRecursive(t.children);
                });
            };

            state.taskTree.forEach(doc => {
                updateRecursive(doc.tasks);
            });
            if (__tmDoneDesired.has(oldId)) {
                __tmDoneDesired.set(newId, __tmDoneDesired.get(oldId));
                __tmDoneDesired.delete(oldId);
            }
            if (__tmDoneBase.has(oldId)) {
                __tmDoneBase.set(newId, __tmDoneBase.get(oldId));
                __tmDoneBase.delete(oldId);
            }
            if (__tmDoneChain.has(oldId)) {
                __tmDoneChain.set(newId, __tmDoneChain.get(oldId));
                __tmDoneChain.delete(oldId);
            }
        } catch (e) {}
    }

    // ============ 重写设置完成状态（带完整树保护） ============
    window.tmSetPinned = async function(id, pinned, ev) {
        if (ev) ev.stopPropagation();

        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id];
        if (!task) return;

        const val = !!pinned;
        if (__tmShouldUseChecklistLegacyFieldCommit()) {
            try {
                await __tmRequestChecklistLegacyTaskPatch(String(id || '').trim(), { pinned: val ? '1' : '' }, {
                    source: 'toggle-pinned',
                    label: val ? '置顶' : '取消置顶',
                    withFilters: true,
                });
                hint(`✅ ${val ? '已置顶' : '已取消置顶'}`, 'success');
                return true;
            } catch (e) {
                hint(`❌ 操作失败: ${e.message}`, 'error');
                if (ev?.target) ev.target.checked = !val;
                return false;
            }
        }
        return await __tmCommitUiFriendlyTaskPatch(String(id || '').trim(), { pinned: val ? '1' : '' }, {
            source: 'toggle-pinned',
            label: val ? '置顶' : '取消置顶',
            withFilters: true,
            onError: () => {
                if (ev?.target) ev.target.checked = !val;
            },
        });
    };

    async function __tmSetDoneKernel(id, done, ev, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const targetDone = !!done;
        const useCalendarLocalRefresh = __tmShouldSyncCalendarDoneInPlace(opts.source);
        const useLocalRefreshMode = String(opts.refreshMode || '').trim() === 'local';
        if (ev) {
            ev.stopPropagation();
            ev.preventDefault();
        }

        let task = globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id] || null;
        if (!task) {
            try { task = await __tmEnsureTaskInStateById(id); } catch (e) { task = null; }
        }
        if (!task) {
            try { task = await __tmResolveCollectedOtherBlockTaskById(id); } catch (e) { task = null; }
        }
        if (task && __tmIsCollectedOtherBlockTask(task)) {
            const ok = await __tmSetCollectedOtherBlockDone(task, done);
            if (!ok) {
                if (ev?.target) ev.target.checked = !!task.done;
                return;
            }
            if (opts.suppressHint !== true) {
                try { hint(done ? '✅ 已在插件内标记完成' : '✅ 已取消插件内完成', 'success'); } catch (e) {}
            }
            if (targetDone && opts.force !== true) __tmQueueTaskDoneDelight(id, { done: true, suppressHint: opts.suppressHint, source: opts.source });
            return;
        }
        const statusPatch = __tmBuildCheckboxStatusPatch(task, targetDone, opts.statusPatch);
        const completeAtPatch = targetDone ? __tmBuildTaskCompleteAtPatch() : null;
        const touchPatch = {
            ...((statusPatch && typeof statusPatch === 'object') ? statusPatch : {}),
            ...((completeAtPatch && typeof completeAtPatch === 'object') ? completeAtPatch : {}),
        };
        if (!task) {
            const ok = await __tmSetDoneByIdStateless(id, done);
            if (ok) {
                if (statusPatch && Object.keys(statusPatch).length > 0) {
                    try {
                        await __tmPersistMetaAndAttrsKernel(String(id || '').trim(), statusPatch, {
                            touchMetaStore: false,
                            skipFlush: false,
                        });
                        MetaStore.set(String(id || '').trim(), {
                            ...statusPatch,
                            ...((targetDone && completeAtPatch) ? completeAtPatch : {}),
                        });
                    } catch (statusErr) {
                        try { console.error('[完成状态] 状态联动保存失败:', statusErr); } catch (e) {}
                    }
                } else if (targetDone && completeAtPatch) {
                    try { MetaStore.set(String(id || '').trim(), completeAtPatch); } catch (e) {}
                }
                try {
                    if (!state.doneOverrides || typeof state.doneOverrides !== 'object') state.doneOverrides = {};
                    state.doneOverrides[String(id)] = !!done;
                } catch (e) {}
                try { __tmInvalidateAllSqlCaches(); } catch (e) {}
                if (opts.suppressHint !== true) {
                    try { hint(__tmBuildTaskDoneSuccessHint(!!done, '✅ 任务已完成'), 'success'); } catch (e) {}
                }
                if (targetDone && opts.force !== true) __tmQueueTaskDoneDelight(id, { done: true, suppressHint: opts.suppressHint, source: opts.source });
                if (targetDone) {
                    try {
                        __tmScheduleRecurringTaskAdvanceAfterCompletion(id, {
                            source: opts.source,
                            completedAt: __tmNowInChinaTimezoneIso(),
                            scheduleId: String(opts.scheduleId || '').trim(),
                        });
                    } catch (e) {}
                } else {
                    try { __tmClearRecurringTaskAdvanceTimer(id); } catch (e) {}
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
                        try { __tmRefreshMainViewInPlace({ withFilters: true }); } catch (e2) {
                            try { render(); } catch (e3) {}
                        }
                    }
                }
                return;
            }
            if (opts.suppressHint !== true) hint('❌ 任务不存在', 'error');
            if (ev?.target) ev.target.checked = !done;
            return;
        }
        const detailScrollSnapshot = __tmCaptureChecklistDetailScrollSnapshot();
        const checklistRenderRestoreSnapshot = __tmCaptureChecklistRenderRestore();

        // 检查全局锁
        if (GlobalLock.isLocked()) {
            const waited = opts.force === true ? await __tmWaitForGlobalUnlock(12000) : false;
            if (!waited) {
                if (opts.force === true) {
                    throw new Error('完成状态操作仍在进行中，请稍后重试');
                }
                if (opts.suppressHint !== true) hint('⚠ 操作频繁，请等待当前勾选完成后再试', 'warning');
                if (ev?.target) ev.target.checked = !targetDone;
                return;
            }
        }

        if (task.done === targetDone && opts.force !== true) return;

        // 锁定
        GlobalLock.lock();
        const docId = task.root_id;

        // 关键：保存整个文档树的完整状态（包括所有子任务）
        const doc = state.taskTree.find(d => d.id === docId);
        if (doc) {
            TreeProtector.clear();
            TreeProtector.saveTree(doc.tasks);
        }

        // 关键修改：先保存原始状态，然后保存到 MetaStore（保持原始状态，等点击完成后再更新）
        const originalMarkdown = task.markdown;
        const originalDone = Object.prototype.hasOwnProperty.call(opts, 'previousDone')
            ? !!opts.previousDone
            : !!task.done;
        const originalCustomStatus = Object.prototype.hasOwnProperty.call(opts, 'previousStatusId')
            ? String(opts.previousStatusId || '').trim()
            : String(task.customStatus || '').trim();
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

        // 关键：同时保存整个文档树的所有任务的属性到 MetaStore
        // 这样即使思源重新解析列表块，MetaStore 中有完整备份
        let savedCount = 1;
        const saveAllTasksToMetaRecursive = (tasks) => {
            tasks.forEach(t => {
                savedCount++;
                MetaStore.set(t.id, {
                    priority: t.priority || '',
                    duration: t.duration || '',
                    remark: t.remark || '',
                    completionTime: t.completionTime || '',
                    customTime: t.customTime || '',
                    customStatus: t.customStatus || '',
                    done: t.done,
                    content: t.content
                });
                if (t.children && t.children.length > 0) {
                    saveAllTasksToMetaRecursive(t.children);
                }
            });
        };
        // 从已经获取的 doc 中获取所有任务并保存
        if (doc && doc.tasks) {
            saveAllTasksToMetaRecursive(doc.tasks);
        }

        // 注意：不要在这里 render()，因为还没点击复选框
        // render() 会在从DOM读取实际状态后调用

        try {
            try { __tmMarkLocalDoneTxSuppressionForTask(task, [String(id || '').trim()]); } catch (e) {}
            // 优先尝试 API 更新（解决文档未打开无法操作的问题）
            let apiSuccess = false;
            let clickSuccess = false;
            try {
                // 1. 获取 kramdown
                const kramdown = await API.getBlockKramdown(id);

                if (kramdown) {
                    // 2. 正则匹配：匹配行首的任务标记，容忍前面的空白
                    // 匹配：(任意空白)(*或-或数字.)(任意空白)[(空格或xX)](右括号)
                    const statusRegex = /^(\s*(?:[\*\-]|\d+\.)\s*\[)([ xX])(\])/;
                    const match = kramdown.match(statusRegex);

                    if (match) {
                        const currentStatusChar = match[2];
                        const isCurrentlyDone = currentStatusChar !== ' ';

                        if (isCurrentlyDone === targetDone) {
                            apiSuccess = true;
                        } else {
                            // 3. 构造新的 kramdown
                            const newStatusChar = targetDone ? 'x' : ' ';
                            const newKramdown = kramdown.replace(statusRegex, `$1${newStatusChar}$3`);
                            // 4. 调用 updateBlock
                            const res = await API.call('/api/block/updateBlock', {
                                dataType: 'markdown',
                                data: newKramdown,
                                id: id
                            });

                            if (res && res.code === 0) {
                                apiSuccess = true;
                            } else {
                                console.error('[完成状态] API更新失败:', res);
                            }
                        }
                    } else {
                        // Fallback: 尝试查找内容中的第一个复选框标记（即使不在行首）
                        const fallbackRegex = /(\[)([ xX])(\])/;
                        const fallbackMatch = kramdown.match(fallbackRegex);
                        if (fallbackMatch) {
                             const newStatusChar = targetDone ? 'x' : ' ';
                             // 只替换第一个匹配项
                             const newKramdown = kramdown.replace(fallbackRegex, `$1${newStatusChar}$3`);

                             const res = await API.call('/api/block/updateBlock', {
                                dataType: 'markdown',
                                data: newKramdown,
                                id: id
                            });
                            if (res && res.code === 0) {
                                apiSuccess = true;
                            }
                        } else {
                            console.error('[完成状态] 无法在kramdown中找到任务标记');
                        }
                    }
                } else {
                    console.error('[完成状态] 未获取到kramdown内容');
                }
            } catch (e) {
                console.error('[完成状态] API处理异常:', e);
            }

            // 只有当 API 失败时才尝试查找 DOM（作为回退）
            let taskElement = null;
            if (!apiSuccess) {
                // 尝试多种方式找到复选框并点击
                // 方式1：通过 task.id 直接查询列表项
                taskElement = globalThis.__tmCompat?.findTaskListItemById?.(id) || null;

                // 方式2：遍历所有任务列表项，通过内容匹配
                if (!taskElement) {
                    const allItems = document.querySelectorAll('[data-type="NodeListItem"]');
                    for (const item of allItems) {
                        const paragraph = item.querySelector('[data-type="NodeParagraph"] > div[contenteditable="true"]');
                        if (paragraph && paragraph.textContent?.trim() === task.content) {
                            taskElement = item;
                            break;
                        }
                    }
                }

                // 方式3：遍历所有 protyle-wysiwyg 下的列表项
                if (!taskElement) {
                    const allItems = document.querySelectorAll('.protyle-wysiwyg [data-type="NodeListItem"]');
                    for (const item of allItems) {
                        const paragraph = item.querySelector('[data-type="NodeParagraph"] > div[contenteditable="true"]');
                        if (paragraph && paragraph.textContent?.trim() === task.content) {
                            taskElement = item;
                            break;
                        }
                    }
                }
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

            // 等待思源处理完成
            await new Promise(r => setTimeout(r, 150));

            let actualDone = targetDone;
            if (!apiSuccess) {
                const domDoneAfter = __tmReadNativeDocTaskDoneFromDom(id);
                if (domDoneAfter === null) {
                    throw new Error('无法确认任务复选框状态');
                }
                actualDone = !!domDoneAfter;
                if (actualDone !== targetDone) {
                    throw new Error('任务复选框状态未同步成功');
                }
            }

            let statusSyncError = null;
            if (touchPatch && Object.keys(touchPatch).length > 0) {
                try {
                    await __tmPersistMetaAndAttrsKernel(id, touchPatch, {
                        touchMetaStore: false,
                        skipFlush: false,
                    });
                    __tmApplyAttrPatchLocally(id, touchPatch, { render: false, withFilters: false });
                } catch (statusErr) {
                    statusSyncError = statusErr;
                    try { console.error('[完成状态] 状态联动保存失败:', statusErr); } catch (e) {}
                    const restorePatch = {};
                    if (Object.prototype.hasOwnProperty.call(touchPatch, 'customStatus')) restorePatch.customStatus = originalCustomStatus;
                    if (Object.keys(restorePatch).length > 0) {
                        try { __tmApplyAttrPatchLocally(id, restorePatch, { render: false, withFilters: false }); } catch (e) {}
                    }
                }
            }

            // 保存到MetaStore
            MetaStore.set(id, {
                priority: task.priority || '',
                duration: task.duration || '',
                remark: task.remark || '',
                completionTime: task.completionTime || '',
                customTime: task.customTime || '',
                customStatus: task.customStatus || '',
                done: actualDone,
                content: task.content,
                ...((actualDone && completeAtPatch) ? completeAtPatch : {}),
            });

            // 更新本地状态
            task.done = actualDone;
            if (actualDone && completeAtPatch) {
                task.taskCompleteAt = String(completeAtPatch.taskCompleteAt || '').trim();
                task.task_complete_at = task.taskCompleteAt;
            }
            state.flatTasks[id] = task;
            try {
                if (!state.doneOverrides || typeof state.doneOverrides !== 'object') state.doneOverrides = {};
                state.doneOverrides[String(id)] = !!actualDone;
            } catch (e) {}
            if (shouldDispatchTaskReward && actualDone) {
                try {
                    __tmDispatchTaskCompletedForReward(task, {
                        taskId: String(id || '').trim(),
                        attrHostId: taskRewardAttrHostId || String(id || '').trim(),
                        priorityScore: taskRewardPriorityScore,
                        completedAt: String(completeAtPatch?.taskCompleteAt || '').trim(),
                        source: String(opts.source || 'set-done').trim() || 'set-done',
                    });
                } catch (e) {}
            }

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
                        else __tmRefreshMainViewInPlace({ withFilters: true });
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
                if (statusSyncError) hint(`${__tmBuildTaskDoneSuccessHint(!!actualDone, '✅ 任务已完成')}，但状态同步失败`, 'warning');
                else hint(__tmBuildTaskDoneSuccessHint(!!actualDone, '✅ 任务已完成'), 'success');
            }
            if (actualDone) {
                try {
                    __tmScheduleRecurringTaskAdvanceAfterCompletion(id, {
                        source: opts.source,
                        completedAt: __tmNowInChinaTimezoneIso(),
                        scheduleId: String(opts.scheduleId || '').trim(),
                    });
                } catch (e) {}
            } else {
                try { __tmClearRecurringTaskAdvanceTimer(id); } catch (e) {}
            }

        } catch (err) {
            console.error('[完成操作失败]', err);

            // 恢复
            task.markdown = originalMarkdown;
            task.done = originalDone;
            task.customStatus = originalCustomStatus;
            task.custom_status = originalCustomStatus;
            try {
                if (!state.doneOverrides || typeof state.doneOverrides !== 'object') state.doneOverrides = {};
                state.doneOverrides[String(id)] = originalDone;
            } catch (e) {}
            try {
                MetaStore.set(String(id || '').trim(), {
                    done: originalDone,
                    customStatus: originalCustomStatus,
                    content: task.content,
                });
            } catch (e) {}

            // 尝试恢复树状态
            if (doc) {
                TreeProtector.restoreTree(doc.tasks);
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
                        else __tmRefreshMainViewInPlace({ withFilters: true });
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
        } finally {
            // render() 完成后手动解锁
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    GlobalLock.unlock();
                });
            });
        }
    };

    window.tmSetDone = async function(id, done, ev, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        try {
            __tmPushRefreshDebug('tmSetDone:start', {
                taskId: String(id || '').trim(),
                nextDone: !!done,
                source: String(opts.source || '').trim(),
                viewMode: globalThis.__tmRuntimeState?.getViewMode?.('') || String(state.viewMode || '').trim(),
                detailTaskId: String(state.detailTaskId || '').trim(),
            });
        } catch (e) {}
        if (ev) {
            try { ev.stopPropagation(); } catch (e) {}
            try { ev.preventDefault(); } catch (e) {}
        }
        const tid = String(id || '').trim();
        let task = globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid] || null;
        const viewMode = globalThis.__tmRuntimeState?.getViewMode?.('') || String(state.viewMode || '').trim();
        const isChecklistListToggle = !!(ev?.target instanceof Element && ev.target.closest('.tm-checklist-item[data-id]'));
        const shouldPreserveMobileChecklistScroll = (viewMode === 'checklist')
            && (__tmIsMobileDevice() || __tmHostUsesMobileUI())
            && isChecklistListToggle;
        const checklistLocalRestoreSnapshot = shouldPreserveMobileChecklistScroll
            ? __tmCaptureChecklistRenderRestore()
            : null;
        if (__tmIsRecurringInstanceTask(task)) {
            if (opts.suppressHint !== true) hint('⚠️ 循环完成实例为只读记录，请在原任务中继续操作', 'warning');
            if (ev?.target) {
                try { ev.target.checked = true; } catch (e) {}
            }
            return false;
        }
        if (!task) {
            try { task = await __tmEnsureTaskInStateById(tid); } catch (e) { task = null; }
        }
        if (!task || __tmIsCollectedOtherBlockTask(task)) {
            return await __tmSetDoneKernel(tid, done, ev, opts);
        }
        const targetDone = !!done;
        if (!!task.done === targetDone) return;
        try {
            const request = __tmMutationEngine.requestTaskPatch(tid, { done: targetDone }, {
                source: String(opts.source || '').trim(),
                label: __tmGetUndoLabel(opts.label, '完成状态'),
                suppressHint: opts.suppressHint === true,
                statusPatch: opts.statusPatch,
                scheduleId: String(opts.scheduleId || '').trim(),
                optimistic: !shouldPreserveMobileChecklistScroll,
            });
            try { __tmRestoreChecklistRenderRestore(checklistLocalRestoreSnapshot); } catch (e) {}
            await request;
            try { __tmRestoreChecklistRenderRestore(checklistLocalRestoreSnapshot); } catch (e) {}
            try {
                __tmPushRefreshDebug('tmSetDone:success', {
                    taskId: tid,
                    nextDone: targetDone,
                    detailTaskId: String(state.detailTaskId || '').trim(),
                });
            } catch (e) {}
            if (targetDone) __tmQueueTaskDoneDelight(tid, { done: true, suppressHint: opts.suppressHint, source: opts.source });
            if (opts.suppressHint === true) return true;
        } catch (e) {
            try {
                __tmPushRefreshDebug('tmSetDone:error', {
                    taskId: tid,
                    nextDone: targetDone,
                    error: String(e?.message || e || ''),
                });
            } catch (e2) {}
            hint(`❌ 操作失败: ${e.message}`, 'error');
            if (ev?.target) ev.target.checked = !targetDone;
            try { __tmRestoreChecklistRenderRestore(checklistLocalRestoreSnapshot); } catch (e2) {}
        }
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

    // 通过内容在任务树中查找任务（使用更灵活的匹配）
    function findTaskByContent(tasks, content, depth = 0) {
        for (const t of tasks) {
            // 使用模糊匹配：检查内容是否包含或被包含
            const oldContent = String(t.content || '').trim();
            const newContent = String(content || '').trim();
            // 精确匹配或新内容包含旧内容（旧内容更短）
            if (oldContent === newContent || (newContent.length > oldContent.length && newContent.includes(oldContent))) {
                return t;
            }
            if (t.children && t.children.length > 0) {
                const found = findTaskByContent(t.children, content, depth + 1);
                if (found) return found;
            }
        }
        return null;
    }

    // ============ 受保护的重载（带树恢复） ============
    // manualRelationships: 可选，Map<childId, parentTaskId>，用于在SQL索引未更新时强制指定父子关系
    // injectedTasks: 可选，Array<Task>，用于在SQL索引未更新时强制注入新任务（乐观更新）
    async function reloadDocTasksProtected(docId, expectId = null, manualRelationships = null, injectedTasks = null, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        try {
            __tmPushRefreshDebug('reload-doc-protected:start', {
                docId: String(docId || '').trim(),
                expectId: String(expectId || '').trim(),
                manualRelationshipCount: manualRelationships instanceof Map ? manualRelationships.size : 0,
                injectedTaskCount: Array.isArray(injectedTasks) ? injectedTasks.length : 0,
                options: {
                    applyFilters: opts.applyFilters !== false,
                    render: opts.render !== false,
                    saveMeta: opts.saveMeta !== false,
                },
            });
        } catch (e) {}
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
        const shouldPreserveExistingDocOrder = !forceDocFlowOrder && (hasManualRelationships
            || hasInjectedTasks
            || !__tmShouldUseResolvedFlowRankForDoc(docId));
        const allowOldRelationshipFallback = !hasManualRelationships && !hasInjectedTasks;

        // 1. 重新加载数据 (带重试机制，等待索引更新)
        let flatTasks = [];
        let queryTime = 0;

        if (expectId) {
            let retries = 0;
            const maxRetries = 20; // 最多等待 5秒 (250ms * 20)
            while (retries < maxRetries) {
                const res = await API.getTasksByDocuments([docId], state.queryLimit);

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
             const res = await API.getTasksByDocuments([docId], state.queryLimit);
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
                mergedCount += 1;
                return next;
            });
            injectedById.forEach((injected, taskId) => {
                if (!flatTasks.find((task) => String(task?.id || '').trim() === taskId)) {
                    flatTasks.push(injected);
                }
            });
            try {
                __tmPushRefreshDebug('reload-doc-protected:injected-merge', {
                    docId: String(docId || '').trim(),
                    injectedCount: injectedById.size,
                    mergedCount,
                });
            } catch (e) {}
        }

        const protectedFlowRankMap = new Map();
        if (forceDocFlowOrder && flatTasks.length > 0) {
            try {
                const taskIds = Array.from(new Set(flatTasks.map((task) => String(task?.id || '').trim()).filter(Boolean)));
                const taskDocMap = new Map(taskIds.map((taskId) => [taskId, String(docId || '').trim()]));
                const bundle = await API.fetchTaskEnhanceBundle(taskIds, {
                    taskDocMap,
                    needH2: false,
                    needFlow: true,
                });
                const flowMap = bundle?.taskFlowRankMap instanceof Map ? bundle.taskFlowRankMap : new Map();
                flatTasks.forEach((task) => {
                    const taskId = String(task?.id || '').trim();
                    const flowRank = Number(flowMap.get(taskId));
                    if (Number.isFinite(flowRank)) {
                        __tmApplyResolvedFlowRankIfNeeded(task, flowRank);
                        protectedFlowRankMap.set(taskId, flowRank);
                    }
                });
            } catch (e) {}
        }

        // 2. 关键：先建立内容到 MetaStore 数据的映射
        // 因为思源操作后子任务ID可能改变，需要用内容匹配来找回旧ID的MetaStore数据
        const contentToMeta = new Map();

        // 遍历旧的任务树（如果有的话），建立内容到MetaStore的映射
        const oldDoc = state.taskTree.find(d => d.id === docId);
        if (oldDoc && oldDoc.tasks) {
            const traverseOld = (tasks) => {
                tasks.forEach(t => {
                    const key = (t.content || '').trim();
                    if (key) {
                        const meta = MetaStore.get(t.id);
                        if (meta && Object.keys(meta).length > 0) {
                            contentToMeta.set(key, meta);
                        }
                    }
                    if (t.children && t.children.length > 0) {
                        traverseOld(t.children);
                    }
                });
            };
            traverseOld(oldDoc.tasks);
        }

        // 3. 构建树（保持原有逻辑）
        const taskMap = new Map();
        let rootTasks = [];
        const isValidValue = (val) => val !== undefined && val !== null && val !== '' && val !== 'null';

        // 先创建所有节点（从 MetaStore 读取所有自定义属性，不依赖 SQL 查询）
        flatTasks.forEach(t => {
            const parsed = API.parseTaskStatus(t.markdown);
            const taskId = String(t?.id || '').trim();

            // 关键：优先从内容映射读取 MetaStore 数据（因为ID可能已变化）
            const contentKey = (parsed.content || '').trim();
            let meta = MetaStore.get(taskId) || {};

            // 如果当前ID没有MetaStore数据，尝试从内容映射找回
            if (Object.keys(meta).length === 0 && contentKey && contentToMeta.has(contentKey)) {
                const oldMeta = contentToMeta.get(contentKey);
                meta = oldMeta;

                // 同时保存到当前ID下，确保后续能直接读取
                MetaStore.set(taskId, oldMeta);
            }
            const allowVisibleDateFallback = __tmHasPendingVisibleDatePersistence(String(t.id || '').trim());
            const oldTaskState = oldTaskStateById.get(taskId) || null;
            const docSeq = Number(t?.doc_seq);
            const preservedDocSeq = Number(oldTaskState?.docSeq);
            const resolvedFlowRank = Number(t?.resolvedFlowRank ?? t?.resolved_flow_rank ?? t?.__tmResolvedFlowRank);

            taskMap.set(taskId, {
                id: taskId,
                content: parsed.content,
                // 关键：优先使用 MetaStore 中的 done 状态，而不是从 markdown 解析
                done: meta.done !== undefined ? meta.done : parsed.done,
                markdown: t.markdown,
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
            });
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

        // 3. 关键：通过内容匹配恢复旧ID到新ID的映射，并更新MetaStore
        // 因为思源操作后子任务ID可能改变，需要用内容匹配来找回旧ID
        const oldIdToNewId = new Map();
        const newIdToOldId = new Map();

        // 遍历旧的任务树（如果有的话），建立ID映射
        // 注意：oldDoc 已在前面声明，这里直接使用
        if (oldDoc && oldDoc.tasks) {
            const traverseOld = (tasks) => {
                tasks.forEach(t => {
                    if (t.content) {
                        // 在新任务树中找内容相同的任务
                        const newTask = findTaskByContent(rootTasks, t.content);
                        if (newTask && newTask.id !== t.id) {
                            oldIdToNewId.set(t.id, newTask.id);
                            newIdToOldId.set(newTask.id, t.id);

                            // 如果MetaStore中有旧ID的数据，复制到新ID
                            const oldMeta = MetaStore.get(t.id);
                            if (oldMeta) {
                                // 不覆盖新ID已有的数据
                                const newMeta = MetaStore.get(newTask.id) || {};
                                const mergedMeta = { ...oldMeta, ...newMeta };
                                MetaStore.set(newTask.id, mergedMeta);
                            }
                        }
                    }
                    if (t.children && t.children.length > 0) {
                        traverseOld(t.children);
                    }
                });
            };
            traverseOld(oldDoc.tasks);
        }

        let siblingOrderRanks = new Map();
        try {
            const tasksByDoc = new Map([[String(docId || '').trim(), flatTasks]]);
            siblingOrderRanks = await __tmResolveTaskSiblingOrderRanks(tasksByDoc);
        } catch (e) {
            siblingOrderRanks = new Map();
        }
        TreeProtector.restoreTree(rootTasks);
        __tmRestoreTaskTreeFromMeta(rootTasks);
        if (forceDocFlowOrder && protectedFlowRankMap.size > 0) __tmSortTaskTreeByDocFlow(rootTasks);
        else __tmSortTaskTreeBySiblingRankMap(rootTasks, siblingOrderRanks);
        __tmAssignDocSeqByTree(rootTasks, 0);

        // 4. 恢复折叠状态
        TreeProtector.restoreCollapsedState();
        TreeProtector.clear();

        // 5. 更新状态
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
        __tmInvalidateFilteredTaskDerivedStateCache();

        // 6. 更新flatTasks
        const flatten = (tasks) => {
            tasks.forEach(t => {
                state.flatTasks[t.id] = t;
                if (t.children && t.children.length > 0) flatten(t.children);
            });
        };

        // 清理旧数据
        Object.keys(state.flatTasks).forEach(key => {
            if (state.flatTasks[key].root_id === docId) delete state.flatTasks[key];
        });
        flatten(rootTasks);
        state.flatTasks = __tmMergeOtherBlocksIntoFlatTasks(state.flatTasks);

        state.stats.queryTime = queryTime || 0;
        recalcStats();
        if (opts.applyFilters !== false) {
            applyFilters();
        }
        if (opts.render !== false) {
            render();
        }

        // 7. 保存恢复后的数据
        if (opts.saveMeta !== false) {
            await MetaStore.saveNow();
        }
        try {
            __tmPushRefreshDebug('reload-doc-protected:end', {
                docId: String(docId || '').trim(),
                expectId: String(expectId || '').trim(),
                rootTaskCount: Array.isArray(rootTasks) ? rootTasks.length : 0,
                flatTaskCount: flatTasks.length,
            });
        } catch (e) {}
    }

    window.tmSetTaskPriority = async function(id, value, opts = {}) {
        const tid = String(id || '').trim();
        if (!tid) return false;
        const options = (opts && typeof opts === 'object') ? opts : {};
        const raw = String(value || '').trim().toLowerCase();
        const next = raw === 'high' || raw === 'medium' || raw === 'low' ? raw : '';
        if (__tmShouldUseChecklistLegacyFieldCommit(options)) {
            try {
                await __tmRequestChecklistLegacyTaskPatch(tid, { priority: next }, {
                    source: String(options.source || 'external-priority').trim() || 'external-priority',
                    label: '重要性',
                    skipDetailPatch: options.skipDetailPatch === true,
                });
                if (options.silent !== true) {
                    const label = next === 'high' ? '高' : (next === 'medium' ? '中' : (next === 'low' ? '低' : '无'));
                    hint(`✅ 重要性已更新为${label}`, 'success');
                }
                return true;
            } catch (e) {
                if (options.silent !== true) hint(`❌ 更新失败: ${e.message}`, 'error');
                return false;
            }
        }
        const result = await __tmCommitUiFriendlyTaskPatch(tid, { priority: next }, {
            source: String(options.source || 'external-priority').trim() || 'external-priority',
            label: '重要性',
            skipDetailPatch: options.skipDetailPatch === true,
            defer: options.defer === true,
            showErrorHint: options.silent !== true,
        });
        if (result !== false && options.silent !== true) {
            const label = next === 'high' ? '高' : (next === 'medium' ? '中' : (next === 'low' ? '低' : '无'));
            hint(`✅ 重要性已更新为${label}`, 'success');
        }
        return result !== false;
    };

    function __tmOpenPriorityInlinePicker(anchorEl, options = {}) {
        if (!(anchorEl instanceof HTMLElement)) return;
        const opts = (options && typeof options === 'object') ? options : {};
        const currentValue = String(opts.currentValue || '').trim();
        const currentKey = String(__tmGetPriorityJiraInfo(currentValue)?.key || 'none').trim() || 'none';
        const onPick = typeof opts.onPick === 'function' ? opts.onPick : null;
        const waitForPickBeforeClose = opts.waitForPickBeforeClose === true;
        if (!onPick) return;

        __tmOpenInlineEditor(anchorEl, ({ editor, close }) => {
            editor.style.minWidth = '60px';
            editor.style.width = '60px';
            editor.style.padding = '8px';
            if (Number.isFinite(Number(opts.zIndex)) && Number(opts.zIndex) > 0) {
                editor.style.zIndex = String(Math.round(Number(opts.zIndex)));
            }
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.style.gap = '6px';
            const mk = (value) => {
                const info = __tmGetPriorityJiraInfo(value);
                const key = String(info?.key || 'none').trim() || 'none';
                const color = __tmGetPriorityAccentColor(key) || '#9e9e9e';
                const active = key === currentKey;
                const b = document.createElement('button');
                b.className = `tm-priority-option-btn${active ? ' is-active' : ''}`;
                b.type = 'button';
                b.style.fontSize = '12px';
                b.style.textAlign = 'center';
                b.style.setProperty('--tm-priority-option-color', color);
                b.style.setProperty('--tm-priority-option-bg', active
                    ? `color-mix(in srgb, ${color} 14%, var(--tm-bg-color))`
                    : 'transparent');
                b.style.setProperty('--tm-priority-option-border', active
                    ? color
                    : `color-mix(in srgb, ${color} 34%, var(--tm-border-color) 66%)`);
                b.style.setProperty('--tm-priority-option-hover-bg', `color-mix(in srgb, ${color} 14%, var(--tm-hover-bg) 86%)`);
                b.style.setProperty('--tm-priority-option-hover-border', color);
                b.setAttribute('aria-pressed', active ? 'true' : 'false');
                b.innerHTML = __tmRenderPriorityJira(key === 'none' ? '' : key, true);
                b.onclick = waitForPickBeforeClose ? async () => {
                    try {
                        await onPick(key === 'none' ? '' : key, info);
                        close();
                    } catch (e) {
                        const msg = String(e?.message || e || '').trim() || '未知错误';
                        hint(`❌ 更新失败: ${msg}`, 'error');
                    }
                } : () => {
                    const request = Promise.resolve(onPick(key === 'none' ? '' : key, info));
                    close();
                    request.catch((e) => {
                        const msg = String(e?.message || e || '').trim() || '未知错误';
                        hint(`❌ 更新失败: ${msg}`, 'error');
                    });
                };
                return b;
            };
            wrap.appendChild(mk(''));
            wrap.appendChild(mk('high'));
            wrap.appendChild(mk('medium'));
            wrap.appendChild(mk('low'));
            editor.appendChild(wrap);
        });
    }

    window.tmPickPriority = function(id, el, ev) {
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id];
        if (!task) return;
        const useChecklistLegacy = __tmShouldUseChecklistLegacyFieldCommit();
        __tmOpenPriorityInlinePicker(el, {
            currentValue: task.priority,
            waitForPickBeforeClose: useChecklistLegacy,
            onPick: useChecklistLegacy
                ? (value) => __tmRequestChecklistLegacyTaskPatch(id, { priority: value || '' }, {
                    source: 'inline-priority',
                    label: '重要性',
                })
                : (value) => __tmCommitUiFriendlyTaskPatch(id, { priority: value || '' }, {
                    source: 'inline-priority',
                    label: '重要性',
                }),
        });
    };

    window.tmOpenStatusSelect = function(id, ev) {
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}
        const el = ev.target.closest('td');
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id];
        if (!task || !el) return;
        const useChecklistLegacy = __tmShouldUseChecklistLegacyFieldCommit();

        __tmOpenInlineEditor(el, ({ editor, close }) => {
            const options = SettingsStore.data.customStatusOptions || [];
            const maxLen = options.reduce((m, o) => Math.max(m, String(o?.name || '').length), 0);
            const w = Math.min(220, Math.max(92, maxLen * 12 + 22));
            editor.style.minWidth = '0';
            editor.style.width = `${w}px`;
            editor.style.padding = '8px';
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.style.gap = '4px';
            options.forEach(opt => {
                const b = document.createElement('button');
                b.className = 'tm-status-option-btn';
                b.style.fontSize = '12px';
                b.style.textAlign = 'left';
                const chip = document.createElement('span');
                chip.className = 'tm-status-tag';
                chip.style.cssText = __tmBuildStatusChipStyle(opt.color);
                chip.textContent = String(opt?.name || opt?.id || '');
                b.appendChild(chip);
                b.onclick = () => {
                    close();
                    if (useChecklistLegacy) {
                        void (async () => {
                            try {
                                await __tmRequestChecklistLegacyTaskPatch(id, { customStatus: opt.id }, {
                                    source: 'inline-status',
                                    label: '状态',
                                });
                            } catch (e) {
                                hint(`❌ 更新失败: ${e.message}`, 'error');
                            }
                        })();
                        return;
                    }
                    void __tmCommitUiFriendlyTaskPatch(id, { customStatus: opt.id }, {
                        source: 'inline-status',
                        label: '状态',
                    });
                };
                wrap.appendChild(b);
            });

            editor.appendChild(wrap);
        });
    };

    function __tmApplyTaskCustomFieldValueLocally(task, field, nextValue) {
        if (!(task && typeof task === 'object')) return;
        const def = (field && typeof field === 'object') ? field : {};
        const fieldId = String(def.id || '').trim();
        if (!fieldId) return;
        const normalized = __tmNormalizeCustomFieldValue(def, nextValue);
        const serialized = __tmSerializeCustomFieldValue(def, normalized);
        const nextValues = {
            ...((task.customFieldValues && typeof task.customFieldValues === 'object' && !Array.isArray(task.customFieldValues)) ? task.customFieldValues : {})
        };
        const nextRawValues = {
            ...((task.__customFieldRawValues && typeof task.__customFieldRawValues === 'object' && !Array.isArray(task.__customFieldRawValues)) ? task.__customFieldRawValues : {})
        };
        if (Array.isArray(normalized)) {
            if (normalized.length) nextValues[fieldId] = normalized;
            else delete nextValues[fieldId];
        } else if (String(normalized || '').trim()) {
            nextValues[fieldId] = normalized;
        } else {
            delete nextValues[fieldId];
        }
        if (serialized) nextRawValues[fieldId] = serialized;
        else delete nextRawValues[fieldId];
        task.customFieldValues = nextValues;
        task.__customFieldRawValues = nextRawValues;
    }

    async function __tmPersistTaskCustomFieldValue(taskId, fieldId, nextValue, options = {}) {
        const tid = String(taskId || '').trim();
        const fid = String(fieldId || '').trim();
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid];
        const field = __tmGetCustomFieldDefMap().get(fid);
        if (!tid || !task || !field) return false;
        const normalized = __tmNormalizeCustomFieldValue(field, nextValue);
        const opts = (options && typeof options === 'object') ? options : {};
        const useChecklistLegacy = __tmShouldUseChecklistLegacyFieldCommit(opts);
        const previewAnchorEl = opts.anchorEl instanceof Element ? opts.anchorEl : null;
        if (previewAnchorEl instanceof Element) {
            const valueWrap = previewAnchorEl.querySelector('.tm-task-detail-custom-field-value');
            if (valueWrap instanceof HTMLElement) {
                valueWrap.innerHTML = __tmBuildCustomFieldDisplayHtml(field, normalized, {
                    emptyText: '未设置',
                    maxTags: String(field?.type || '').trim() === 'multi' ? 3 : 1,
                });
            }
        }
        const result = useChecklistLegacy
            ? await __tmRequestChecklistLegacyTaskPatch(tid, {
                customFieldValues: { [fid]: normalized }
            }, {
                source: String(opts.source || 'custom-field').trim() || 'custom-field',
                label: String(field?.name || '自定义列').trim() || '自定义列',
                withFilters: opts.withFilters !== false,
                skipDetailPatch: opts.skipDetailPatch === true,
                skipViewRefresh: opts.skipViewRefresh === true,
                broadcast: opts.broadcast !== false,
            })
            : await __tmCommitUiFriendlyTaskPatch(tid, {
                customFieldValues: { [fid]: normalized }
            }, {
                source: String(opts.source || 'custom-field').trim() || 'custom-field',
                label: String(field?.name || '自定义列').trim() || '自定义列',
                withFilters: opts.withFilters !== false,
                skipDetailPatch: opts.skipDetailPatch === true,
                skipViewRefresh: opts.skipViewRefresh === true,
                broadcast: opts.broadcast !== false,
            });
        if (result !== false && typeof opts.onAfterSave === 'function') {
            try { opts.onAfterSave(normalized, field); } catch (e) {}
        }
        return result !== false;
    }

    function __tmOpenCustomFieldInlineEditor(taskId, fieldId, anchorEl, options = {}) {
        const tid = String(taskId || '').trim();
        const fid = String(fieldId || '').trim();
        const field = __tmGetCustomFieldDefMap().get(fid);
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid];
        if (!(anchorEl instanceof Element) || !field || !task) return;
        const selected = __tmNormalizeCustomFieldValue(field, __tmGetTaskCustomFieldValue(task, fid));
        const isMulti = String(field.type || '').trim() === 'multi';
        const useChecklistLegacy = __tmShouldUseChecklistLegacyFieldCommit(options);
        __tmOpenInlineEditor(anchorEl, ({ editor, close }) => {
            const viewportWidth = Math.max(240, window.innerWidth || document.documentElement.clientWidth || 0);
            const minEditorWidth = isMulti ? 112 : 96;
            const maxEditorWidth = Math.max(minEditorWidth, Math.min(420, viewportWidth - 24));
            editor.style.minWidth = '0';
            editor.style.width = 'auto';
            editor.style.maxWidth = `${maxEditorWidth}px`;
            editor.style.padding = '8px';
            const wrap = document.createElement('div');
            wrap.style.display = 'inline-flex';
            wrap.style.flexDirection = 'column';
            wrap.style.gap = '6px';
            wrap.style.alignItems = 'flex-start';
            wrap.style.width = 'auto';
            wrap.style.maxWidth = '100%';

            const title = document.createElement('div');
            title.style.fontSize = '12px';
            title.style.color = 'var(--tm-secondary-text)';
            title.style.maxWidth = '100%';
            title.style.whiteSpace = 'nowrap';
            title.style.overflow = 'hidden';
            title.style.textOverflow = 'ellipsis';
            title.textContent = String(field.name || field.id || '自定义列').trim() || '自定义列';
            wrap.appendChild(title);

            const list = document.createElement('div');
            list.style.display = 'inline-flex';
            list.style.flexDirection = 'column';
            list.style.gap = '4px';
            list.style.alignItems = 'flex-start';
            list.style.width = 'auto';
            list.style.maxWidth = '100%';
            wrap.appendChild(list);

            let actions = null;
            const syncEditorWidth = () => {
                try {
                    editor.style.width = 'auto';
                    const naturalWidth = Math.max(
                        minEditorWidth,
                        Math.ceil(title.scrollWidth || 0),
                        Math.ceil(list.scrollWidth || 0),
                        Math.ceil(actions?.scrollWidth || 0)
                    );
                    editor.style.width = `${Math.min(maxEditorWidth, naturalWidth)}px`;
                } catch (e) {}
            };

            const draft = new Set(Array.isArray(selected) ? selected : (String(selected || '').trim() ? [String(selected || '').trim()] : []));
            const renderOptions = () => {
                list.innerHTML = '';
                const optionsList = Array.isArray(field.options) ? field.options : [];
                if (!optionsList.length) {
                    const empty = document.createElement('div');
                    empty.style.fontSize = '12px';
                    empty.style.color = 'var(--tm-secondary-text)';
                    empty.textContent = '当前字段还没有配置选项';
                    list.appendChild(empty);
                    return;
                }
                optionsList.forEach((opt) => {
                    const optionId = String(opt?.id || '').trim();
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'tm-status-option-btn';
                    button.style.fontSize = '12px';
                    button.style.textAlign = 'left';
                    button.style.width = 'fit-content';
                    button.style.maxWidth = '100%';
                    button.setAttribute('data-selected', draft.has(optionId) ? 'true' : 'false');
                    const chip = document.createElement('span');
                    chip.className = 'tm-status-tag';
                    chip.style.cssText = __tmBuildStatusChipStyle(opt?.color || '#9ca3af');
                    chip.textContent = String(opt?.name || optionId || '').trim() || optionId;
                    if (draft.has(optionId)) chip.textContent += isMulti ? '  ✓' : '';
                    button.appendChild(chip);
                    button.onclick = () => {
                        if (isMulti) {
                            if (draft.has(optionId)) draft.delete(optionId);
                            else draft.add(optionId);
                            renderOptions();
                            return;
                        }
                        if (useChecklistLegacy) {
                            void (async () => {
                                try {
                                    await __tmPersistTaskCustomFieldValue(tid, fid, optionId, options);
                                    close();
                                } catch (e) {
                                    hint(`❌ 更新失败: ${e.message}`, 'error');
                                }
                            })();
                            return;
                        }
                        close();
                        void __tmPersistTaskCustomFieldValue(tid, fid, optionId, options);
                    };
                    list.appendChild(button);
                });
                syncEditorWidth();
            };
            renderOptions();

            actions = document.createElement('div');
            actions.className = 'tm-inline-editor-actions';
            actions.style.display = 'inline-flex';
            actions.style.justifyContent = 'flex-start';
            actions.style.width = 'auto';
            actions.style.alignSelf = 'flex-start';
            const clearBtn = document.createElement('button');
            clearBtn.type = 'button';
            clearBtn.className = 'tm-btn tm-btn-secondary';
            clearBtn.style.padding = '6px 10px';
            clearBtn.textContent = '清空';
            clearBtn.onclick = () => {
                if (useChecklistLegacy) {
                    void (async () => {
                        try {
                            await __tmPersistTaskCustomFieldValue(tid, fid, isMulti ? [] : '', options);
                            close();
                        } catch (e) {
                            hint(`❌ 更新失败: ${e.message}`, 'error');
                        }
                    })();
                    return;
                }
                close();
                void __tmPersistTaskCustomFieldValue(tid, fid, isMulti ? [] : '', options);
            };
            actions.appendChild(clearBtn);
            if (isMulti) {
                const saveBtn = document.createElement('button');
                saveBtn.type = 'button';
                saveBtn.className = 'tm-btn tm-btn-primary';
                saveBtn.style.padding = '6px 10px';
                saveBtn.textContent = '确定';
                saveBtn.onclick = () => {
                    if (useChecklistLegacy) {
                        void (async () => {
                            try {
                                await __tmPersistTaskCustomFieldValue(tid, fid, Array.from(draft), options);
                                close();
                            } catch (e) {
                                hint(`❌ 更新失败: ${e.message}`, 'error');
                            }
                        })();
                        return;
                    }
                    close();
                    void __tmPersistTaskCustomFieldValue(tid, fid, Array.from(draft), options);
                };
                actions.appendChild(saveBtn);
            }
            wrap.appendChild(actions);
            editor.appendChild(wrap);
            syncEditorWidth();
        });
    }

    window.tmOpenCustomFieldSelect = function(id, fieldId, ev, anchorEl = null, options = {}) {
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}
        const anchor = anchorEl instanceof Element ? anchorEl : ev?.target?.closest?.('td,button,[data-tm-custom-field-anchor]');
        if (!(anchor instanceof Element)) return;
        __tmOpenCustomFieldInlineEditor(id, fieldId, anchor, options);
    };

    window.tmKanbanOpenStatusSelect = function(id, el, ev) {
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id];
        if (!task || !(el instanceof Element)) return;

        __tmOpenInlineEditor(el, ({ editor, close }) => {
            const options = SettingsStore.data.customStatusOptions || [];
            const maxLen = options.reduce((m, o) => Math.max(m, String(o?.name || '').length), 0);
            const w = Math.min(220, Math.max(92, maxLen * 12 + 22));
            editor.style.minWidth = '0';
            editor.style.width = `${w}px`;
            editor.style.padding = '8px';
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.style.gap = '4px';
            options.forEach(opt => {
                const b = document.createElement('button');
                b.className = 'tm-status-option-btn';
                b.style.fontSize = '12px';
                b.style.textAlign = 'left';
                const chip = document.createElement('span');
                chip.className = 'tm-status-tag';
                chip.style.cssText = __tmBuildStatusChipStyle(opt.color);
                chip.textContent = String(opt?.name || opt?.id || '');
                b.appendChild(chip);
                b.onclick = () => {
                    close();
                    void __tmCommitUiFriendlyTaskPatch(id, { customStatus: opt.id }, {
                        source: 'kanban-status',
                        label: '状态',
                    });
                };
                wrap.appendChild(b);
            });
            editor.appendChild(wrap);
        });
    };

    window.tmOpenTaskDetail = async function(id, ev) {
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}
        const originalId = String(id || '').trim();
        let tid = originalId;
        if (!tid) return false;
        const cachedTask = globalThis.__tmRuntimeState?.getTaskById?.(tid) || state.flatTasks?.[tid] || state.pendingInsertedTasks?.[tid] || null;
        const recurringSourceId = __tmResolveRecurringInstanceSourceTaskId(tid, cachedTask);
        if (recurringSourceId && recurringSourceId !== tid) tid = recurringSourceId;
        if (!(globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid])) {
            const resolved = await __tmResolveTaskIdFromAnyBlockId(tid);
            if (resolved) tid = resolved;
        }
        let task = globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid] || null;
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
                return await window.tmOpenTaskDetail(sourceTaskId, ev);
            }
        }
        try {
            task = __tmCacheTaskInState(task, {
                docNameFallback: task.doc_name || task.docName || '未命名文档'
            }) || task;
        } catch (e) {}
        {
            const docId = String(task?.root_id || task?.docId || '').trim();
            if (docId) {
                try { await __tmWarmKanbanDocHeadings([docId], { force: true }); } catch (e) {}
            }
        }

        // 首页会保留上一个工作区视图的 state.viewMode，不能把首页里的点击误判成看板内详情打开。
        const activeRenderMode = globalThis.__tmRuntimeState?.getActiveRenderMode?.('') || (state.homepageOpen ? 'home' : String(state.viewMode || '').trim());
        if (activeRenderMode === 'kanban' && !__tmIsMobileDevice()) {
            state.kanbanDetailTaskId = tid;
            state.kanbanDetailAnchorTaskId = tid;
            render();
            return true;
        }

        __tmRemoveElementsById('tm-task-detail-overlay');

        const overlay = document.createElement('div');
        overlay.id = 'tm-task-detail-overlay';
        overlay.className = 'tm-task-detail-overlay';

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
            __tmMarkTaskDetailRootClosing(overlay, { holdMs: 900 });
            try {
                await overlay.__tmTaskDetailFlushSave?.({
                    showHint: false,
                    closeAfterSave: false,
                    preserveFocus: false,
                    skipRerender: true,
                });
            } catch (e) {}
            try { globalThis.__tmRuntimeEvents?.off?.(document, 'keydown', onKeydown, true); } catch (e) {}
            try { overlay.__tmTaskDetailAbortController?.abort?.(); } catch (e) {}
            __tmMarkTaskDetailRootClosed(overlay);
            try { overlay.remove(); } catch (e) {}
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
        if (!tid) return false;
        const enabled = typeof nextValue === 'boolean'
            ? nextValue
            : !__tmShouldShowCompletedSubtasksForTask(tid);
        __tmSetCompletedSubtasksVisibilityForTask(tid, enabled);
        try { SettingsStore.syncToLocal(); } catch (e) {}
        try { SettingsStore.save(); } catch (e) {}
        try { __tmRefreshVisibleTaskDetailForTask(tid); } catch (e) {}
        try {
            const liveModal = globalThis.__tmRuntimeState?.getModal?.() || state.modal;
            if (globalThis.__tmRuntimeState?.hasLiveModal?.(liveModal) ?? (state.modal && document.body.contains(state.modal))) {
                if (!__tmRerenderCurrentViewInPlace(liveModal)) render();
            }
        } catch (e) {
            try { render(); } catch (e2) {}
        }
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

    function __tmBuildTaskMarkdownWithContent(taskLike, nextContent) {
        const task = (taskLike && typeof taskLike === 'object') ? taskLike : {};
        const text = String(nextContent || '').trim();
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

    function __tmApplyContentPatchLocally(taskId, nextContent, options = {}) {
        const tid = String(taskId || '').trim();
        const task = globalThis.__tmRuntimeState?.getTaskById?.(tid) || state.flatTasks?.[tid] || state.pendingInsertedTasks?.[tid] || null;
        if (!task) return false;
        const text = String(nextContent || '').trim();
        if (!text) return false;
        const nextMarkdown = __tmBuildTaskMarkdownWithContent(task, text);
        task.content = text;
        task.markdown = nextMarkdown;
        try {
            if (state.pendingInsertedTasks?.[tid]) {
                state.pendingInsertedTasks[tid].content = text;
                state.pendingInsertedTasks[tid].markdown = nextMarkdown;
            }
        } catch (e) {}
        if (options.render !== false) {
            try { __tmScheduleRender({ withFilters: options.withFilters !== false }); } catch (e) {}
        }
        return true;
    }

    function __tmQueueMoveTask(taskId, payload = {}) {
        const tid = String(taskId || '').trim();
        const task = state.flatTasks?.[tid] || null;
        const data = (payload && typeof payload === 'object') ? payload : {};
        const targetDocId = String(data.targetDocId || '').trim();
        const mode = String(data.mode || '').trim() || 'doc';
        if (!tid || !task || !targetDocId) throw new Error('移动目标无效');
        const snapshot = __tmCaptureTaskLocalSnapshot(tid);
        const movePayload = {
            ...data,
            taskId: tid,
            snapshot,
        };
        return __tmEnqueueQueuedOp({
            type: 'moveTask',
            docId: String(task.root_id || task.docId || '').trim() || targetDocId,
            laneKey: targetDocId ? `doc:${targetDocId}` : `task:${tid}`,
            data: {
                taskId: tid,
                targetDocId,
                targetTaskId: String(data.targetTaskId || '').trim(),
                targetParentTaskId: String(data.targetParentTaskId || '').trim(),
                targetHeadingId: String(data.targetHeadingId || '').trim(),
                targetHeading: String(data.targetHeading || '').trim(),
                targetHeadingRank: Number(data.targetHeadingRank),
                targetLastDirectChildId: String(data.targetLastDirectChildId || '').trim(),
                headingId: String(data.headingId || '').trim(),
                mode,
                snapshot,
                crossDoc: String(String(task.docId || task.root_id || '').trim() !== targetDocId ? '1' : ''),
            },
        }, { wait: true });
    }

    function __tmRollbackContentPatchLocally(taskId, inversePatch, options = {}) {
        const tid = String(taskId || '').trim();
        const task = globalThis.__tmRuntimeState?.getTaskById?.(tid) || state.flatTasks?.[tid] || state.pendingInsertedTasks?.[tid] || null;
        if (!task) return false;
        const prev = (inversePatch && typeof inversePatch === 'object') ? inversePatch : {};
        if (Object.prototype.hasOwnProperty.call(prev, 'content')) task.content = String(prev.content || '').trim();
        if (Object.prototype.hasOwnProperty.call(prev, 'markdown')) task.markdown = String(prev.markdown || '').trim();
        try {
            if (state.pendingInsertedTasks?.[tid]) {
                if (Object.prototype.hasOwnProperty.call(prev, 'content')) state.pendingInsertedTasks[tid].content = String(prev.content || '').trim();
                if (Object.prototype.hasOwnProperty.call(prev, 'markdown')) state.pendingInsertedTasks[tid].markdown = String(prev.markdown || '').trim();
            }
        } catch (e) {}
        if (options.render !== false) {
            try { __tmScheduleRender({ withFilters: options.withFilters !== false }); } catch (e) {}
        }
        return true;
    }

    async function __tmUpdateTaskContentBlockKernel(taskOrId, nextContent, options = {}) {
        const tid = typeof taskOrId === 'string'
            ? String(taskOrId || '').trim()
            : String(taskOrId?.id || '').trim();
        const task = tid ? (globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid] || null) : null;
        if (!task) throw new Error('未找到任务');

        const text = String(nextContent || '').trim();
        if (!text) throw new Error('任务内容不能为空');

        const nextMarkdown = __tmBuildTaskMarkdownWithContent(task, text);

        await API.updateBlock(tid, nextMarkdown);
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
        const task = tid ? (globalThis.__tmRuntimeState?.getTaskById?.(tid) || state.flatTasks?.[tid] || state.pendingInsertedTasks?.[tid] || null) : null;
        if (!tid || !task) return Promise.reject(new Error('未找到任务'));
        const text = String(nextContent || '').trim();
        if (!text) return Promise.reject(new Error('任务内容不能为空'));
        const docId = String(options.docId || task.root_id || task.docId || '').trim();
        const inversePatch = {
            content: String(task.content || '').trim(),
            markdown: String(task.markdown || '').trim(),
        };
        return __tmEnqueueQueuedOp({
            type: 'contentPatch',
            docId,
            laneKey: `task:${tid}`,
            coalesceKey: `content:${tid}`,
            data: {
                taskId: tid,
                nextContent: text,
                docId,
                renderOptimistic: options.renderOptimistic !== false,
                withFilters: options.withFilters !== false,
            },
            inversePatch,
        }, { wait: !!options.wait });
    }

    async function __tmUpdateTaskContentBlock(taskOrId, nextContent, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        if (opts.queued === true || opts.background === true) {
            return await __tmQueueTaskContentPatch(taskOrId, nextContent, {
                wait: opts.background !== true,
                docId: opts.docId,
                renderOptimistic: opts.renderOptimistic !== false && opts.background !== true,
                withFilters: opts.withFilters !== false,
            });
        }
        return await __tmUpdateTaskContentBlockKernel(taskOrId, nextContent, opts);
    }

    // 编辑任务
    window.tmEdit = async function(id) {
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id];
        if (!task) return;
        if (!__tmEnsureEditableTaskLike(task, '编辑内容')) return;

        const newContent = await showPrompt('编辑任务', '请输入新任务内容', task.content);
        if (newContent === null || newContent === task.content) return;

        try {
            await __tmUpdateTaskContentBlock(task, newContent, { background: true });
            __tmRefreshMainViewInPlace({ withFilters: true });
            hint('✅ 任务已更新', 'success');
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
                if (String(state.detailTaskId || '').trim() !== String(snapshot.selectedId || '').trim()) return;
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

    async function __tmDeleteTaskKernel(id) {
        const tid = String(id || '').trim();
        if (!tid) throw new Error('未找到任务');
        await API.deleteBlock(tid);
        try {
            const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid] || null;
            const docId = String(task?.root_id || task?.docId || '').trim();
            if (docId) __tmInvalidateTasksQueryCacheByDocId(docId);
            else __tmInvalidateAllSqlCaches();
        } catch (e) {}
        return true;
    }

    // 删除任务
    window.tmDelete = async function(id) {
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id];
        if (!task) return;
        if (!__tmEnsureEditableTaskLike(task, '删除任务')) return;
        let ok = false;
        try {
            if (__tmIsMobileDevice()) {
                ok = await showConfirm('删除任务', '确定要删除这个任务吗？此操作不可恢复。');
            } else {
                ok = !!confirm('确定要删除这个任务吗？此操作不可恢复。');
            }
        } catch (e) {
            try {
                ok = await showConfirm('删除任务', '确定要删除这个任务吗？此操作不可恢复。');
            } catch (e2) {
                ok = false;
            }
        }
        if (!ok) return;

        try {
            const snapshot = __tmCaptureTaskLocalSnapshot(id);
            await __tmEnqueueQueuedOp({
                type: 'deleteTask',
                docId: String(task?.root_id || task?.docId || '').trim(),
                laneKey: String(task?.root_id || task?.docId || '').trim() ? `doc:${String(task?.root_id || task?.docId || '').trim()}` : `task:${String(id || '').trim()}`,
                data: {
                    taskId: String(id || '').trim(),
                    snapshot,
                },
            }, { wait: true });
            __tmRefreshMainViewInPlace({ withFilters: true });
            hint('✅ 任务已删除', 'success');
        } catch (e) {
            hint(`❌ 删除失败: ${e.message}`, 'error');
        }
    };

    // 任务提醒
    window.tmReminder = async function(id) {
        if (!SettingsStore.data.enableTomatoIntegration) {
            hint('⚠ 番茄钟联动已关闭', 'warning');
            return;
        }
        const taskId = String(id || '').trim();
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(taskId) || state.flatTasks?.[taskId];
        if (!task) return;
        const showDialog = globalThis.__tomatoReminder?.showDialog;
        if (typeof showDialog === 'function') {
            showDialog(taskId, task.content || '任务');
            try { __tmRefreshReminderMarkForTask(taskId, 1200); } catch (e) {}
            return;
        }
        hint('⚠ 未检测到提醒功能，请确认番茄插件已启用', 'warning');
    };

    const __tmNormalizeTimerTaskName = (primary, fallback = '任务') => {
        const source = String(primary || '').trim();
        const backup = String(fallback || '').trim() || '任务';
        const base = source || backup;
        if (!base) return '任务';
        try {
            const firstLine = (typeof API?.extractTaskContentLine === 'function')
                ? API.extractTaskContentLine(base)
                : base.split(/\r?\n/)[0].trim();
            const normalized = (typeof API?.normalizeTaskContent === 'function')
                ? API.normalizeTaskContent(firstLine)
                : firstLine;
            return String(normalized || firstLine || backup || '任务').trim() || '任务';
        } catch (e) {
            return base;
        }
    };

    window.tmStartPomodoro = async function(id) {
        if (!SettingsStore.data.enableTomatoIntegration) {
            hint('⚠ 番茄钟联动已关闭', 'warning');
            return;
        }
        const rawId = String(id || '').trim();
        if (!rawId) return;
        const rawTask = globalThis.__tmRuntimeState?.getFlatTaskById?.(rawId) || state.flatTasks?.[rawId] || null;
        let resolvedId = rawId;
        if (!__tmIsCollectedOtherBlockTask(rawTask)) {
            try {
                const nextId = await __tmResolveTaskIdFromAnyBlockId(rawId);
                if (nextId) resolvedId = String(nextId).trim();
            } catch (e) {}
        }
        let task = rawTask
            || globalThis.__tmRuntimeState?.getFlatTaskById?.(resolvedId)
            || globalThis.__tmRuntimeState?.getFlatTaskById?.(rawId)
            || state.flatTasks?.[resolvedId]
            || state.flatTasks?.[rawId]
            || null;
        if (!task && resolvedId) {
            try { task = await __tmEnsureTaskInStateById(resolvedId); } catch (e) { task = null; }
        }
        if (!task) return;
        const taskName = __tmNormalizeTimerTaskName(task?.content || task?.markdown || '', '任务');
        const timer = globalThis.__tomatoTimer;
        const startCountdown = timer?.startCountdown;
        const startPomodoro = timer?.startPomodoro;
        if (typeof startCountdown === 'function') {
            startCountdown(resolvedId, taskName, 30);
            return;
        }
        if (typeof startPomodoro === 'function') {
            startPomodoro(resolvedId, taskName, 30);
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

        const taskForMenu = globalThis.__tmRuntimeState?.getFlatTaskById?.(String(taskId || '').trim()) || state.flatTasks?.[String(taskId || '').trim()];
        if (__tmIsCollectedOtherBlockTask(taskForMenu)) {
            __tmShowCollectedOtherBlockContextMenu(event, taskId);
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
            width: auto;
            max-width: calc(100vw - 16px);
            min-width: 0;
            box-sizing: border-box;
            user-select: none;
        `;
        try {
            menu.style.setProperty('z-index', '200020', 'important');
            menu.style.setProperty('display', 'inline-flex', 'important');
            menu.style.setProperty('flex-direction', 'column', 'important');
            menu.style.setProperty('align-items', 'stretch', 'important');
            menu.style.setProperty('width', 'auto', 'important');
            menu.style.setProperty('min-width', '0', 'important');
            menu.style.setProperty('max-width', 'calc(100vw - 16px)', 'important');
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

        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(taskId) || state.flatTasks?.[taskId];
        const taskName = __tmNormalizeTimerTaskName(task?.content || task?.markdown || '', '任务');
        const hasChildren = Array.isArray(task?.children) && task.children.length > 0;
        const showCompletedSubtasks = __tmShouldShowCompletedSubtasksForTask(taskId);
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
            let nextTask = globalThis.__tmRuntimeState?.getFlatTaskById?.(resolvedId)
                || globalThis.__tmRuntimeState?.getFlatTaskById?.(rawId)
                || state.flatTasks?.[resolvedId]
                || state.flatTasks?.[rawId]
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
            state.timerFocusTaskId = timerTaskId;
            render();
            if (mode === 'stopwatch') {
                const startFromTaskBlock = timer?.startFromTaskBlock;
                const startStopwatch = timer?.startStopwatch;
                let p = null;
                if (typeof startFromTaskBlock === 'function') p = startFromTaskBlock(timerTaskId, timerTaskName, 0, 'stopwatch');
                else if (typeof startStopwatch === 'function') p = startStopwatch(timerTaskId, timerTaskName);
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
            if (typeof startFromTaskBlock === 'function') p = startFromTaskBlock(timerTaskId, timerTaskName, safeMin, 'countdown');
            else if (typeof startCountdown === 'function') p = startCountdown(timerTaskId, timerTaskName, safeMin);
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
        if (tomatoEnabled && timer && typeof timer === 'object') {
            const durations = (() => {
                const list = timer?.getDurations?.();
                const arr = Array.isArray(list) ? list.map(n => parseInt(n, 10)).filter(n => Number.isFinite(n) && n > 0) : [];
                return arr.length > 0 ? arr.slice(0, 8) : [5, 15, 25, 30, 45, 60];
            })();

            const timerWrap = document.createElement('div');
            timerWrap.style.cssText = 'padding: 6px 10px 8px;';
            const title = document.createElement('div');
            title.textContent = '🍅 计时';
            title.style.cssText = 'font-size: 12px; opacity: 0.75; padding: 2px 0 6px;';
            timerWrap.appendChild(title);
            if (scheduleId0 && scheduleDurationMin > 0) {
                const scheduleBtn = document.createElement('button');
                scheduleBtn.className = 'tm-btn tm-btn-secondary';
                scheduleBtn.textContent = `📅 按日程时长开始番茄（${scheduleDurationMin}m）`;
                scheduleBtn.style.cssText = 'display:block; width:100%; margin-bottom:6px; padding: 4px 8px; font-size: 12px; line-height: 18px;';
                scheduleBtn.onclick = async (e) => {
                    e.stopPropagation();
                    await runTaskTimer(scheduleDurationMin, 'countdown');
                    menu.remove();
                };
                timerWrap.appendChild(scheduleBtn);
            }
            const btnRow = document.createElement('div');
            btnRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';
            durations.forEach(min => {
                const b = document.createElement('button');
                b.className = 'tm-btn tm-btn-secondary';
                b.textContent = `${min}m`;
                b.style.cssText = 'padding: 2px 8px; font-size: 12px; line-height: 18px;';
                b.onclick = async (e) => {
                    e.stopPropagation();
                    await runTaskTimer(min, 'countdown');
                    menu.remove();
                };
                btnRow.appendChild(b);
            });
            const sw = document.createElement('button');
            sw.className = 'tm-btn tm-btn-secondary';
            sw.textContent = '⏱️ 正计时';
            sw.style.cssText = 'padding: 2px 8px; font-size: 12px; line-height: 18px;';
            sw.onclick = async (e) => {
                e.stopPropagation();
                await runTaskTimer(0, 'stopwatch');
                menu.remove();
            };
            btnRow.appendChild(sw);
            timerWrap.appendChild(btnRow);
            menu.appendChild(timerWrap);

            const hrTimer = document.createElement('hr');
            hrTimer.style.cssText = 'margin: 4px 0; border: none; border-top: 1px solid var(--b3-theme-surface-light);';
            menu.appendChild(hrTimer);

            if (state.timerFocusTaskId) {
                menu.appendChild(createItem(__tmRenderContextMenuLabel('circle-dot', '取消聚焦'), () => {
                    state.timerFocusTaskId = '';
                    render();
                }));
            }
        }

        menu.appendChild(createItem(__tmRenderContextMenuLabel('text-indent', '新建子任务'), () => tmCreateSubtask(taskId)));
        menu.appendChild(createItem(__tmRenderContextMenuLabel('list-bullets', '新建同级任务'), () => tmCreateSiblingTask(taskId)));
        menu.appendChild(createItem(__tmRenderContextMenuLabel('pin', task?.pinned ? '取消置顶' : '置顶'), () => tmSetPinned(taskId, !task?.pinned)));
        if (hasChildren) {
            menu.appendChild(createItem(__tmRenderContextMenuLabel(showCompletedSubtasks ? 'check-circle-2' : 'circle-dot', showCompletedSubtasks ? '隐藏已完成子任务' : '显示已完成子任务'), () => {
                window.tmToggleTaskDetailCompletedSubtasks?.(taskId, !showCompletedSubtasks);
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
                });
            }));
            if (scheduleId0 && typeof globalThis.__tmCalendar.deleteScheduleById === 'function') {
                menu.appendChild(createItem(__tmRenderContextMenuLabel('trash-2', '删除日程'), async () => {
                    try {
                        const ok = await globalThis.__tmCalendar.deleteScheduleById(scheduleId0, { closeModal: false });
                        if (ok) hint('✅ 已删除日程', 'success');
                        else hint('⚠️ 未找到日程', 'warning');
                    } catch (e) {
                        hint(`❌ ${String(e?.message || e || '删除日程失败')}`, 'error');
                    }
                }, true));
            }
        }
        if (__tmIsAiFeatureEnabled()) {
            menu.appendChild(createItem(__tmRenderContextMenuLabel('bot', 'AI 优化任务名称'), () => {
                try { globalThis.tmAiOptimizeTaskName?.(taskId); } catch (e) {}
            }));
            menu.appendChild(createItem(__tmRenderContextMenuLabel('bot', 'AI 编辑字段'), () => {
                try { globalThis.tmAiEditTask?.(taskId); } catch (e) {}
            }));
            menu.appendChild(createItem(__tmRenderContextMenuLabel('bot', 'AI 安排日程'), () => {
                try { globalThis.tmAiPlanTaskSchedule?.(taskId); } catch (e) {}
            }));
        }
        menu.appendChild(createItem(__tmRenderContextMenuLabel('file-text', '任务详情'), () => {
            try { window.tmOpenTaskDetail?.(taskId); } catch (e) {}
        }));
        menu.appendChild(createItem(__tmRenderContextMenuLabel('square-pen', '修改内容'), () => tmEdit(taskId)));
        if (tomatoEnabled) {
            menu.appendChild(createItem(__tmRenderContextMenuLabel('alarm-clock', '提醒'), () => tmReminder(taskId)));
        }
        if (__tmIsRecurringInstanceTask(task)) {
            menu.appendChild(createItem(__tmRenderContextMenuLabel('trash-2', '删除记录'), async () => {
                const completedAt = String(task?.recurringCompletedAt || '').trim();
                const sourceTaskId = String(task?.sourceTaskId || task?.recurringSourceTaskId || '').trim();
                if (!completedAt || !sourceTaskId) {
                    hint('⚠️ 未找到可删除的循环记录', 'warning');
                    return;
                }
                let ok = false;
                try {
                    ok = await showConfirm('删除循环记录', '确定要删除这条循环记录吗？此操作不可恢复。');
                } catch (e) {
                    ok = false;
                }
                if (!ok) return;
                try {
                    await __tmDeleteTaskRepeatHistoryEntry(sourceTaskId, completedAt, { source: 'context-repeat-history-delete' });
                    hint('✅ 已删除循环记录', 'success');
                } catch (e) {
                    hint(`❌ 删除失败: ${String(e?.message || e || '')}`, 'error');
                }
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
            } catch (e) {}
            menu.remove();
            try { __tmClearOutsideCloseHandler(closeHandler); } catch (e) {}
            if (state.taskContextMenuCloseHandler === closeHandler) state.taskContextMenuCloseHandler = null;
        };
        state.taskContextMenuCloseHandler = closeHandler;
        __tmScheduleBindOutsideCloseHandler(closeHandler);
    };

    function __tmResolveConfiguredQuickAddDocId() {
        const configured = String(SettingsStore.data.newTaskDocId || '').trim();
        if (!configured || configured === '__dailyNote__') return null;
        const exists = state.taskTree.some(d => d.id === configured) || state.allDocuments.some(d => d.id === configured);
        return exists ? configured : null;
    }

    const __TM_QUICK_ADD_RECENT_DOCS_KEY = 'tm_quick_add_recent_docs';
    const __TM_QUICK_ADD_RECENT_DOCS_LIMIT = 6;

    function __tmResolveQuickAddRecentDocMeta(docId, fallback = null) {
        const id = String(docId || '').trim();
        if (!id || id === '__dailyNote__') return null;
        const fromAll = (Array.isArray(state.allDocuments) ? state.allDocuments : [])
            .find((doc) => String(doc?.id || '').trim() === id);
        const fromTree = (Array.isArray(state.taskTree) ? state.taskTree : [])
            .find((doc) => String(doc?.id || '').trim() === id);
        const fb = (fallback && typeof fallback === 'object') ? fallback : null;
        const name = String(fromAll?.name || fromTree?.name || fb?.name || '').trim() || '未命名文档';
        const path = String(fromAll?.path || fromTree?.path || fb?.path || '').trim();
        return { id, name, path };
    }

    function __tmGetQuickAddRecentDocs() {
        const raw = Storage.get(__TM_QUICK_ADD_RECENT_DOCS_KEY, []);
        const list = Array.isArray(raw) ? raw : [];
        const seen = new Set();
        const out = [];
        list.forEach((entry) => {
            const id = String((typeof entry === 'object' ? entry?.id : entry) || '').trim();
            if (!id || id === '__dailyNote__' || seen.has(id)) return;
            const meta = __tmResolveQuickAddRecentDocMeta(id, entry);
            if (!meta) return;
            seen.add(id);
            out.push({
                ...meta,
                ts: Number(typeof entry === 'object' ? entry?.ts : 0) || 0,
            });
        });
        return out.slice(0, __TM_QUICK_ADD_RECENT_DOCS_LIMIT);
    }

    function __tmRememberQuickAddRecentDoc(docId, fallback = null) {
        const meta = __tmResolveQuickAddRecentDocMeta(docId, fallback);
        if (!meta) return;
        const existing = __tmGetQuickAddRecentDocs()
            .filter((entry) => String(entry?.id || '').trim() !== meta.id);
        const next = [{ ...meta, ts: Date.now() }, ...existing]
            .slice(0, __TM_QUICK_ADD_RECENT_DOCS_LIMIT);
        Storage.set(__TM_QUICK_ADD_RECENT_DOCS_KEY, next);
    }

    function __tmResolveDefaultDocId() {
        const configuredDocId = __tmResolveConfiguredQuickAddDocId();
        if (configuredDocId) return configuredDocId;
        if (state.activeDocId && state.activeDocId !== 'all') return state.activeDocId;
        if (state.taskTree && state.taskTree.length > 0) return state.taskTree[0].id;
        if (state.selectedDocIds && state.selectedDocIds.length > 0) return state.selectedDocIds[0];
        const cacheEnt = __tmQuickbarResolveConfiguredDocIds?.__cache;
        if (cacheEnt && Array.isArray(cacheEnt.ids) && (Date.now() - Number(cacheEnt.t || 0)) < 30000) {
            const cachedId = String(cacheEnt.ids.find((id) => String(id || '').trim()) || '').trim();
            if (cachedId) return cachedId;
        }
        return null;
    }

    async function __tmResolveDefaultDocIdAsync() {
        const directId = __tmResolveDefaultDocId();
        if (directId) return directId;
        try {
            const ids = await __tmQuickbarResolveConfiguredDocIds();
            const fallbackId = String((Array.isArray(ids) ? ids : []).find((id) => String(id || '').trim()) || '').trim();
            return fallbackId || null;
        } catch (e) {
            return null;
        }
    }

    function __tmResolveQuickAddDocId() {
        const configured = String(SettingsStore.data.newTaskDocId || '').trim();
        if (configured === '__dailyNote__') return __tmResolveDefaultDocId();
        const configuredDocId = __tmResolveConfiguredQuickAddDocId();
        if (configuredDocId) return configuredDocId;
        return __tmResolveDefaultDocId();
    }

    function __tmResolveConfiguredDailyNoteNotebookId() {
        const configured = String(SettingsStore.data.newTaskDailyNoteNotebookId || '').trim();
        if (!configured) return '';
        const notebooks = Array.isArray(state.notebooks) ? state.notebooks : [];
        const exists = notebooks.some((item) => String(item?.id || item?.box || '').trim() === configured);
        return exists ? configured : '';
    }

    async function __tmResolveInsertedTaskBlockId(insertedId) {
        const seedId = String(insertedId || '').trim();
        if (!seedId) return '';
        const isTaskBlock = async (id) => {
            try {
                const rows = await API.getBlocksByIds([id]);
                const row = Array.isArray(rows) ? rows[0] : null;
                return String(row?.id || '').trim() === id
                    && String(row?.type || '').trim() === 'i'
                    && String(row?.subtype || '').trim() === 't';
            } catch (e) {
                return false;
            }
        };
        if (await isTaskBlock(seedId)) return seedId;
        const retryDelays = [60, 160, 320, 640, 1000];
        for (let i = 0; i <= retryDelays.length; i++) {
            try {
                const resolvedId = String(await API.getFirstTaskDescendantId(seedId, 6) || '').trim();
                if (resolvedId && await isTaskBlock(resolvedId)) return resolvedId;
                const directTaskId = String(await API.getFirstTaskIdUnderBlock(seedId) || '').trim();
                if (directTaskId && await isTaskBlock(directTaskId)) return directTaskId;
            } catch (e) {}
            if (i < retryDelays.length) {
                await new Promise((resolve) => setTimeout(resolve, retryDelays[i]));
            }
        }
        return seedId;
    }

    async function __tmPersistNewTaskAttrsWithRetry(taskId, patch, resolveId, options = {}) {
        const payload = (patch && typeof patch === 'object') ? patch : {};
        const opts = (options && typeof options === 'object') ? options : {};
        if (!Object.keys(payload).length) return String(taskId || '').trim();
        let currentId = String(taskId || '').trim();
        let lastErr = null;
        for (let i = 0; i < 5; i += 1) {
            try {
                if (resolveId && i > 0) {
                    const nextId = String(await resolveId() || '').trim();
                    if (nextId) currentId = nextId;
                }
                if (!currentId) throw new Error('未找到任务块');
                await __tmPersistMetaAndAttrsAsync(currentId, payload, opts);
                return currentId;
            } catch (e) {
                lastErr = e;
                await new Promise((resolve) => setTimeout(resolve, 180 + i * 220));
            }
        }
        throw lastErr || new Error('保存属性失败');
    }

    function __tmUpsertLocalTask(task) {
        const nextTask = (task && typeof task === 'object') ? task : null;
        const taskId = String(nextTask?.id || '').trim();
        const docId = String(nextTask?.docId || nextTask?.root_id || '').trim();
        if (!taskId || !docId || !nextTask) return;
        state.flatTasks[taskId] = nextTask;
        const doc = state.taskTree.find(d => String(d?.id || '').trim() === docId);
        if (!doc) return;
        if (!Array.isArray(doc.tasks)) doc.tasks = [];
        if (!doc.tasks.some((item) => String(item?.id || '').trim() === taskId)) {
            doc.tasks.push(nextTask);
        }
    }

    function __tmGenerateTempTaskId(prefix = 'task') {
        return `tm_tmp_${String(prefix || 'task').trim() || 'task'}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function __tmInsertTaskIntoDocLocal(task, options = {}) {
        const nextTask = (task && typeof task === 'object') ? task : null;
        const opts = (options && typeof options === 'object') ? options : {};
        const taskId = String(nextTask?.id || '').trim();
        const docId = String(nextTask?.docId || nextTask?.root_id || '').trim();
        if (!nextTask || !taskId || !docId) return false;
        if (!state.flatTasks || typeof state.flatTasks !== 'object') state.flatTasks = {};
        state.flatTasks[taskId] = nextTask;
        const doc = state.taskTree.find((item) => String(item?.id || '').trim() === docId);
        if (!doc) return false;
        if (!Array.isArray(doc.tasks)) doc.tasks = [];
        if (doc.tasks.some((item) => String(item?.id || '').trim() === taskId)) return true;
        const insertBeforeId = String(opts.insertBeforeId || '').trim();
        if (insertBeforeId) {
            const idx = doc.tasks.findIndex((item) => String(item?.id || '').trim() === insertBeforeId);
            if (idx >= 0) {
                doc.tasks.splice(idx, 0, nextTask);
                return true;
            }
        }
        if (opts.atTop === true) {
            doc.tasks.unshift(nextTask);
            return true;
        }
        doc.tasks.push(nextTask);
        return true;
    }

    function __tmRestoreTaskSubtreeIntoFlatMap(task) {
        const nextTask = (task && typeof task === 'object') ? task : null;
        if (!nextTask) return false;
        if (!state.flatTasks || typeof state.flatTasks !== 'object') state.flatTasks = {};
        __tmRestoreTaskFlatMap(nextTask);
        return true;
    }

    function __tmCollectLocalDocTasks(docTasks, target = []) {
        const out = Array.isArray(target) ? target : [];
        (Array.isArray(docTasks) ? docTasks : []).forEach((task) => {
            if (!task || typeof task !== 'object') return;
            out.push(task);
            if (Array.isArray(task.children) && task.children.length) {
                __tmCollectLocalDocTasks(task.children, out);
            }
        });
        return out;
    }

    function __tmRebuildLocalDocTree(docId) {
        const did = String(docId || '').trim();
        if (!did) return false;
        const doc = (Array.isArray(state.taskTree) ? state.taskTree : []).find((item) => String(item?.id || '').trim() === did);
        if (!doc || !Array.isArray(doc.tasks)) return false;
        const allTasks = __tmCollectLocalDocTasks(doc.tasks, []);
        if (!allTasks.length) return false;
        const idMap = new Map();
        allTasks.forEach((task) => {
            const tid = String(task?.id || '').trim();
            if (!tid) return;
            task.children = [];
            idMap.set(tid, task);
        });
        const rootTasks = [];
        allTasks.forEach((task) => {
            const tid = String(task?.id || '').trim();
            if (!tid) return;
            const parentTaskId = String(task?.parentTaskId || '').trim();
            if (parentTaskId && idMap.has(parentTaskId)) {
                idMap.get(parentTaskId).children.push(task);
            } else {
                rootTasks.push(task);
            }
        });
        const calcLevel = (tasks, level) => {
            (Array.isArray(tasks) ? tasks : []).forEach((task) => {
                if (!task || typeof task !== 'object') return;
                task.level = level;
                if (Array.isArray(task.children) && task.children.length) calcLevel(task.children, level + 1);
            });
        };
        // Keep the in-memory drag/drop insertion order here.
        // During optimistic moves, block_sort still reflects the old document layout
        // and would scramble the just-updated sibling order.
        calcLevel(rootTasks, 0);
        __tmAssignDocSeqByTree(rootTasks, 0);
        doc.tasks = rootTasks;
        try {
            Object.keys(state.flatTasks || {}).forEach((key) => {
                const task = state.flatTasks[key];
                const rootId = String(task?.root_id || task?.docId || '').trim();
                if (rootId === did) delete state.flatTasks[key];
            });
        } catch (e) {}
        rootTasks.forEach((task) => __tmRestoreTaskFlatMap(task));
        return true;
    }

    function __tmAssignDocSeqByTree(tasks, startIndex = 0, options = null) {
        const opts = (options && typeof options === 'object') ? options : {};
        const preserveExistingFinite = opts.preserveExistingFinite === true;
        let nextIndex = Number.isFinite(Number(startIndex)) ? Math.max(0, Math.floor(Number(startIndex))) : 0;
        const walk = (list) => {
            (Array.isArray(list) ? list : []).forEach((task) => {
                if (!task || typeof task !== 'object') return;
                const existingDocSeq = Number(task?.docSeq ?? task?.doc_seq);
                if (preserveExistingFinite && Number.isFinite(existingDocSeq)) {
                    task.docSeq = existingDocSeq;
                    task.doc_seq = existingDocSeq;
                    nextIndex = Math.max(nextIndex, Math.floor(existingDocSeq) + 1);
                } else {
                    task.docSeq = nextIndex;
                    task.doc_seq = nextIndex;
                    nextIndex += 1;
                }
                if (Array.isArray(task.children) && task.children.length) walk(task.children);
            });
        };
        walk(tasks);
        return nextIndex;
    }

    function __tmSortTaskTreeByDocFlow(tasks) {
        const list = Array.isArray(tasks) ? tasks : [];
        list.sort(__tmCompareTasksByDocFlow);
        list.forEach((task) => {
            if (Array.isArray(task?.children) && task.children.length > 0) {
                __tmSortTaskTreeByDocFlow(task.children);
            }
        });
        return list;
    }

    function __tmReorderLoadedDocsByResolvedFlow(docIds) {
        const ids = docIds instanceof Set
            ? Array.from(docIds)
            : (Array.isArray(docIds) ? docIds : [docIds]);
        const wanted = new Set(ids.map((id) => String(id || '').trim()).filter(Boolean));
        if (wanted.size <= 0) return false;
        const hasFlowRank = (tasks) => {
            return (Array.isArray(tasks) ? tasks : []).some((task) => {
                const rank = Number(task?.resolvedFlowRank ?? task?.resolved_flow_rank ?? task?.__tmResolvedFlowRank);
                return Number.isFinite(rank) || hasFlowRank(task?.children);
            });
        };
        const calcLevel = (tasks, level) => {
            (Array.isArray(tasks) ? tasks : []).forEach((task) => {
                if (!task || typeof task !== 'object') return;
                task.level = level;
                if (Array.isArray(task.children) && task.children.length > 0) calcLevel(task.children, level + 1);
            });
        };
        let changed = false;
        (Array.isArray(state.taskTree) ? state.taskTree : []).forEach((doc) => {
            const docId = String(doc?.id || '').trim();
            if (!docId || !wanted.has(docId) || !Array.isArray(doc?.tasks) || doc.tasks.length <= 0) return;
            if (!__tmShouldUseResolvedFlowRankForDoc(docId) || !hasFlowRank(doc.tasks)) return;
            __tmSortTaskTreeByDocFlow(doc.tasks);
            calcLevel(doc.tasks, 0);
            __tmAssignDocSeqByTree(doc.tasks, 0);
            changed = true;
        });
        if (changed) __tmInvalidateFilteredTaskDerivedStateCache();
        return changed;
    }

    function __tmCompareSiblingTasksByBlockOrder(a, b) {
        // A parent task can own multiple child NodeList blocks. When their per-list
        // sibling ranks collide, we must fall back to full document flow instead of
        // local block_sort only, otherwise reload/reconcile can scramble the merged
        // child array even though the document DOM order is already correct.
        return __tmCompareTasksByDocFlow(a, b);
    }

    function __tmSortTaskTreeBySiblingOrder(tasks) {
        const list = Array.isArray(tasks) ? tasks : [];
        list.sort(__tmCompareSiblingTasksByBlockOrder);
        list.forEach((task) => {
            if (Array.isArray(task?.children) && task.children.length > 0) {
                __tmSortTaskTreeBySiblingOrder(task.children);
            }
        });
        return list;
    }

    async function __tmResolveTaskSiblingOrderRanks(tasksByDoc) {
        const source = tasksByDoc instanceof Map ? tasksByDoc : new Map();
        const rankMap = new Map();
        const directListIds = new Set();
        const parentTaskIds = new Set();
        const listDocIdMap = new Map();
        const parentTaskDocIdMap = new Map();
        let preferDomDirectListCount = 0;
        let preferDomParentTaskCount = 0;
        let refreshedDirectListCount = 0;
        let refreshedParentTaskCount = 0;

        const applyRanks = (taskIds, kind = 'local', options = {}) => {
            const rankKey = kind === 'parent' ? 'parentRank' : 'localRank';
            const force = options && typeof options === 'object' && options.force === true;
            (Array.isArray(taskIds) ? taskIds : []).forEach((taskId, index) => {
                const tid = String(taskId || '').trim();
                if (!tid) return;
                const prev = __tmGetTaskSiblingRankEntry(rankMap, tid) || {};
                const next = { ...prev };
                if (force || !Number.isFinite(Number(next?.[rankKey]))) {
                    next[rankKey] = index;
                }
                rankMap.set(tid, next);
            });
        };

        source.forEach((rawTasks) => {
            const localCounters = new Map();
            const parentCounters = new Map();
            (Array.isArray(rawTasks) ? rawTasks : []).forEach((task) => {
                if (!task || __tmIsRecurringInstanceTask(task)) return;
                const taskId = String(task?.id || '').trim();
                if (!taskId) return;
                const docId = String(task?.root_id || task?.docId || '').trim();
                const parentId = String(task?.parent_id || task?.parentId || '').trim();
                const parentTaskId = String(task?.parentTaskId || task?.parent_task_id || '').trim();
                const prev = __tmGetTaskSiblingRankEntry(rankMap, taskId) || {};
                const next = { ...prev };
                if (parentId) {
                    directListIds.add(parentId);
                    if (docId && !listDocIdMap.has(parentId)) listDocIdMap.set(parentId, docId);
                    const localRank = Number(localCounters.get(parentId) || 0);
                    if (!Number.isFinite(Number(next.localRank))) next.localRank = localRank;
                    localCounters.set(parentId, localRank + 1);
                }
                if (parentTaskId) {
                    parentTaskIds.add(parentTaskId);
                    if (docId && !parentTaskDocIdMap.has(parentTaskId)) parentTaskDocIdMap.set(parentTaskId, docId);
                    const parentRank = Number(parentCounters.get(parentTaskId) || 0);
                    if (!Number.isFinite(Number(next.parentRank))) next.parentRank = parentRank;
                    parentCounters.set(parentTaskId, parentRank + 1);
                }
                rankMap.set(taskId, next);
            });
        });

        await Promise.all(Array.from(parentTaskIds).map(async (parentTaskId) => {
            const pid = String(parentTaskId || '').trim();
            if (!pid) return;
            const preferDom = !__tmShouldUseResolvedFlowRankForDoc(parentTaskDocIdMap.get(pid));
            if (!preferDom) return;
            preferDomParentTaskCount += 1;
            try {
                const taskIds = await API.getDirectChildTaskIdsOfTask(pid, { preferDom: true });
                if (Array.isArray(taskIds) && taskIds.length > 0) {
                    applyRanks(taskIds, 'parent', { force: true });
                    refreshedParentTaskCount += 1;
                }
            } catch (e) {}
        }));

        await Promise.all(Array.from(directListIds).map(async (parentId) => {
            const listId = String(parentId || '').trim();
            if (!listId) return;
            const preferDom = !__tmShouldUseResolvedFlowRankForDoc(listDocIdMap.get(listId));
            if (!preferDom) return;
            preferDomDirectListCount += 1;
            try {
                const taskIds = await API.getTaskIdsInList(listId, { preferDom: true });
                if (Array.isArray(taskIds) && taskIds.length > 0) {
                    applyRanks(taskIds, 'local', { force: true });
                    refreshedDirectListCount += 1;
                }
            } catch (e) {}
        }));

        try {
            __tmPushRefreshDebug('task-sibling-ranks:resolved', {
                directListCount: directListIds.size,
                parentTaskCount: parentTaskIds.size,
                preferDomDirectListCount,
                preferDomParentTaskCount,
                refreshedDirectListCount,
                refreshedParentTaskCount,
                rankCount: rankMap.size,
                source: 'local-doc-scan+held-dom-refresh',
            });
        } catch (e) {}
        return rankMap;
    }

    function __tmSortTaskTreeBySiblingRankMap(tasks, rankMap = null) {
        const ranks = rankMap instanceof Map ? rankMap : null;
        const list = Array.isArray(tasks) ? tasks : [];
        const compare = (a, b) => {
            const parentRankA = __tmGetTaskParentScopedRank(ranks, a);
            const parentRankB = __tmGetTaskParentScopedRank(ranks, b);
            const localRankA = __tmGetTaskLocalSiblingRank(ranks, a);
            const localRankB = __tmGetTaskLocalSiblingRank(ranks, b);
            const parentA = String(a?.parentTaskId || a?.parent_task_id || '').trim();
            const parentB = String(b?.parentTaskId || b?.parent_task_id || '').trim();
            const listA = String(a?.parent_id || a?.parentId || '').trim();
            const listB = String(b?.parent_id || b?.parentId || '').trim();
            const canCompareByParentRank = !!parentA && parentA === parentB;
            if (canCompareByParentRank) {
                if (Number.isFinite(parentRankA) && Number.isFinite(parentRankB) && parentRankA !== parentRankB) return parentRankA - parentRankB;
                if (Number.isFinite(parentRankA) && !Number.isFinite(parentRankB)) return -1;
                if (!Number.isFinite(parentRankA) && Number.isFinite(parentRankB)) return 1;
            }
            // When parent-level merged order is unavailable, same-list local ranks are
            // still safe within a single child NodeList.
            const canCompareByLocalSiblingRank = !!listA && listA === listB;
            if (canCompareByLocalSiblingRank) {
                if (Number.isFinite(localRankA) && Number.isFinite(localRankB) && localRankA !== localRankB) return localRankA - localRankB;
                if (Number.isFinite(localRankA) && !Number.isFinite(localRankB)) return -1;
                if (!Number.isFinite(localRankA) && Number.isFinite(localRankB)) return 1;
            }
            return __tmCompareSiblingTasksByBlockOrder(a, b);
        };
        list.sort(compare);
        list.forEach((task) => {
            if (Array.isArray(task?.children) && task.children.length > 0) {
                __tmSortTaskTreeBySiblingRankMap(task.children, ranks);
            }
        });
        return list;
    }

    function __tmResolveLocalTaskSiblings(targetTaskId) {
        const targetId = String(targetTaskId || '').trim();
        const targetTask = state.flatTasks?.[targetId] || null;
        if (!targetId || !targetTask) return null;
        const parentTaskId = String(targetTask.parentTaskId || '').trim();
        if (parentTaskId) {
            const parentTask = state.flatTasks?.[parentTaskId] || null;
            if (!parentTask) return null;
            if (!Array.isArray(parentTask.children)) parentTask.children = [];
            return {
                list: parentTask.children,
                parentTaskId,
                parentTask,
                docId: String(parentTask.docId || parentTask.root_id || targetTask.docId || targetTask.root_id || '').trim(),
            };
        }
        const docId = String(targetTask.docId || targetTask.root_id || '').trim();
        const doc = (Array.isArray(state.taskTree) ? state.taskTree : []).find((item) => String(item?.id || '').trim() === docId);
        if (!doc) return null;
        if (!Array.isArray(doc.tasks)) doc.tasks = [];
        return {
            list: doc.tasks,
            parentTaskId: '',
            parentTask: null,
            docId,
            doc,
        };
    }

    function __tmInsertTaskBeforeLocal(task, targetTaskId) {
        const nextTask = (task && typeof task === 'object') ? task : null;
        const targetId = String(targetTaskId || '').trim();
        const siblings = __tmResolveLocalTaskSiblings(targetId);
        if (!nextTask || !targetId || !siblings?.list) return false;
        const idx = siblings.list.findIndex((item) => String(item?.id || '').trim() === targetId);
        if (idx < 0) return false;
        __tmRestoreTaskSubtreeIntoFlatMap(nextTask);
        siblings.list.splice(idx, 0, nextTask);
        return true;
    }

    function __tmInsertTaskAfterLocal(task, targetTaskId) {
        const nextTask = (task && typeof task === 'object') ? task : null;
        const targetId = String(targetTaskId || '').trim();
        const siblings = __tmResolveLocalTaskSiblings(targetId);
        if (!nextTask || !targetId || !siblings?.list) return false;
        const idx = siblings.list.findIndex((item) => String(item?.id || '').trim() === targetId);
        if (idx < 0) return false;
        __tmRestoreTaskSubtreeIntoFlatMap(nextTask);
        siblings.list.splice(idx + 1, 0, nextTask);
        return true;
    }

    function __tmInsertTaskAsChildLocal(task, parentTaskId, options = {}) {
        const nextTask = (task && typeof task === 'object') ? task : null;
        const pid = String(parentTaskId || '').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        const parentTask = state.flatTasks?.[pid] || null;
        if (!nextTask || !pid || !parentTask) return false;
        if (!Array.isArray(parentTask.children)) parentTask.children = [];
        __tmRestoreTaskSubtreeIntoFlatMap(nextTask);
        if (opts.atTop === true) parentTask.children.unshift(nextTask);
        else parentTask.children.push(nextTask);
        try { state.collapsedTaskIds?.delete?.(pid); } catch (e) {}
        return true;
    }

    function __tmGetMoveTargetHeadingMeta(payload = {}) {
        const targetTask = state.flatTasks?.[String(payload.targetTaskId || '').trim()] || null;
        const rank0 = Number(payload.targetHeadingRank);
        return {
            h2Id: String(payload.targetHeadingId || targetTask?.h2Id || '').trim(),
            h2: String(payload.targetHeading || targetTask?.h2 || '').trim(),
            h2Rank: Number.isFinite(rank0) ? rank0 : Number(targetTask?.h2Rank),
        };
    }

    function __tmApplyOptimisticDocTask(payload = {}) {
        const docId = String(payload.docId || '').trim();
        const tempId = String(payload.tempId || '').trim();
        const content = String(payload.content || '').trim();
        if (!docId || !tempId || !content) return null;
        const docName = state.allDocuments.find((d) => String(d?.id || '').trim() === docId)?.name || '未知文档';
        const pr0 = String(payload.priority ?? '').trim();
        const prMap = { '高': 'high', '中': 'medium', '低': 'low', '无': '', 'none': '' };
        const priority = Object.prototype.hasOwnProperty.call(prMap, pr0) ? prMap[pr0] : pr0;
        const statusOptions = __tmGetStatusOptions(SettingsStore.data.customStatusOptions || []);
        const requestedStatusId = String(payload.customStatus || '').trim();
        const requestedStatusOption = requestedStatusId ? __tmFindStatusOptionById(requestedStatusId, statusOptions) : null;
        const initialMarker = requestedStatusOption
            ? __tmNormalizeTaskStatusMarker(requestedStatusOption.marker, __tmGuessStatusOptionDefaultMarker(requestedStatusOption))
            : ' ';
        const nextTask = {
            id: tempId,
            done: __tmIsTaskMarkerDone(initialMarker),
            pinned: payload.pinned !== undefined ? !!payload.pinned : !!SettingsStore.data.pinNewTasksByDefault,
            content,
            markdown: `- [${initialMarker}] ${content}`,
            priority: priority || '',
            duration: '',
            remark: '',
            completionTime: String(payload.completionTime || '').trim(),
            customTime: '',
            customStatus: String(payload.customStatus || '').trim(),
            taskMarker: initialMarker,
            task_marker: initialMarker,
            docName,
            root_id: docId,
            docId,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            children: [],
            level: 0,
        };
        try { normalizeTaskFields(nextTask, docName); } catch (e) {}
        if (String(nextTask.completionTime || '').trim() || String(nextTask.startDate || '').trim() || String(nextTask.customTime || '').trim()) {
            try { __tmMarkVisibleDateFallbackTask(tempId); } catch (e) {}
        }
        try {
            state.pendingInsertedTasks[tempId] = {
                ...nextTask,
                expiresAt: Date.now() + 15000,
            };
        } catch (e) {}
        __tmInsertTaskIntoDocLocal(nextTask, {
            atTop: payload.atTop === true,
            insertBeforeId: String(payload.insertBeforeId || '').trim(),
        });
        try { recalcStats(); } catch (e) {}
        try { applyFilters(); } catch (e) {}
        return nextTask;
    }

    function __tmRemoveTaskFromLocalState(taskId, options = {}) {
        const tid = String(taskId || '').trim();
        if (!tid) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        let removed = false;
        const removeRecursive = (list) => {
            if (!Array.isArray(list)) return false;
            const idx = list.findIndex((item) => String(item?.id || '').trim() === tid);
            if (idx >= 0) {
                list.splice(idx, 1);
                return true;
            }
            return list.some((item) => removeRecursive(item?.children));
        };
        try {
            state.taskTree.forEach((doc) => {
                if (removeRecursive(doc?.tasks)) removed = true;
            });
        } catch (e) {}
        try { delete state.flatTasks[tid]; } catch (e) {}
        try { delete state.pendingInsertedTasks[tid]; } catch (e) {}
        if (opts.recalc !== false) {
            try { recalcStats(); } catch (e) {}
        }
        if (opts.filter !== false) {
            try { applyFilters(); } catch (e) {}
        }
        return removed;
    }

    function __tmCommitOptimisticTaskId(tempId, realId) {
        const tmp = String(tempId || '').trim();
        const rid = String(realId || '').trim();
        if (!tmp || !rid || tmp === rid) return false;
        try { __tmTransferVisibleDateFallbackTaskId(tmp, rid); } catch (e) {}
        try {
            if (state.pendingInsertedTasks?.[tmp]) {
                state.pendingInsertedTasks[rid] = {
                    ...state.pendingInsertedTasks[tmp],
                    id: rid,
                    expiresAt: Date.now() + 10000,
                };
                delete state.pendingInsertedTasks[tmp];
            }
        } catch (e) {}
        try { __tmRemapTaskId(tmp, rid); } catch (e) { return false; }
        return true;
    }

    function __tmCaptureTaskLocalSnapshot(taskId) {
        const tid = String(taskId || '').trim();
        if (!tid) return null;
        let foundTask = null;
        let parentTaskId = '';
        let docId = '';
        let index = -1;
        const walk = (list, ownerDocId, ownerParentId) => {
            if (!Array.isArray(list)) return false;
            const idx = list.findIndex((item) => String(item?.id || '').trim() === tid);
            if (idx >= 0) {
                foundTask = list[idx];
                parentTaskId = String(ownerParentId || '').trim();
                docId = String(ownerDocId || foundTask?.docId || foundTask?.root_id || '').trim();
                index = idx;
                return true;
            }
            return list.some((item) => walk(item?.children, ownerDocId, item?.id));
        };
        (Array.isArray(state.taskTree) ? state.taskTree : []).some((doc) => walk(doc?.tasks, doc?.id, ''));
        if (!foundTask) return null;
        let cloned = null;
        try {
            cloned = JSON.parse(JSON.stringify(foundTask));
        } catch (e) {
            cloned = { ...foundTask };
        }
        return {
            task: cloned,
            taskId: tid,
            parentTaskId,
            docId,
            index,
            detailSelected: String(state.detailTaskId || '').trim() === tid,
        };
    }

    function __tmRestoreTaskFlatMap(task) {
        const nextTask = (task && typeof task === 'object') ? task : null;
        if (!nextTask) return;
        const taskId = String(nextTask.id || '').trim();
        if (!taskId) return;
        state.flatTasks[taskId] = nextTask;
        const children = Array.isArray(nextTask.children) ? nextTask.children : [];
        children.forEach((child) => __tmRestoreTaskFlatMap(child));
    }

    function __tmApplyDeleteOptimisticLocal(snapshot) {
        const snap = (snapshot && typeof snapshot === 'object') ? snapshot : null;
        const tid = String(snap?.taskId || '').trim();
        if (!tid) return false;
        __tmRemoveTaskFromLocalState(tid);
        if (snap?.detailSelected) {
            state.detailTaskId = '';
            state.checklistDetailDismissed = true;
            state.checklistDetailSheetOpen = false;
        }
        try { __tmScheduleRender({ withFilters: true }); } catch (e) {}
        return true;
    }

    function __tmRollbackDeleteOptimisticLocal(snapshot) {
        const snap = (snapshot && typeof snapshot === 'object') ? snapshot : null;
        const task = snap?.task;
        const taskId = String(task?.id || '').trim();
        if (!task || !taskId) return false;
        if (!state.flatTasks || typeof state.flatTasks !== 'object') state.flatTasks = {};
        if (snap.parentTaskId) {
            const parent = state.flatTasks?.[String(snap.parentTaskId || '').trim()] || null;
            if (parent) {
                if (!Array.isArray(parent.children)) parent.children = [];
                const idx = Math.max(0, Math.min(parent.children.length, Number(snap.index) || 0));
                if (!parent.children.some((item) => String(item?.id || '').trim() === taskId)) {
                    parent.children.splice(idx, 0, task);
                }
            }
        } else {
            const doc = state.taskTree.find((item) => String(item?.id || '').trim() === String(snap.docId || '').trim());
            if (doc) {
                if (!Array.isArray(doc.tasks)) doc.tasks = [];
                const idx = Math.max(0, Math.min(doc.tasks.length, Number(snap.index) || 0));
                if (!doc.tasks.some((item) => String(item?.id || '').trim() === taskId)) {
                    doc.tasks.splice(idx, 0, task);
                }
            }
        }
        __tmRestoreTaskFlatMap(task);
        if (snap?.detailSelected) {
            state.detailTaskId = taskId;
            state.checklistDetailDismissed = false;
        }
        try { recalcStats(); } catch (e) {}
        try { applyFilters(); } catch (e) {}
        try { __tmScheduleRender({ withFilters: true }); } catch (e) {}
        return true;
    }

    function __tmShouldSyncCalendarDoneInPlace(source) {
        return String(source || '').trim() === 'calendar'
            && (globalThis.__tmRuntimeState?.isViewMode?.('calendar') ?? (String(state.viewMode || '').trim() === 'calendar'))
            && !!globalThis.__tmCalendar?.syncTaskDoneInPlace;
    }

    function __tmApplyDoneOptimisticLocal(taskId, done, statusPatch = null, source = '') {
        const tid = String(taskId || '').trim();
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid] || null;
        if (!task) return false;
        const nextStatusPatch = (statusPatch && typeof statusPatch === 'object' && !Array.isArray(statusPatch)) ? statusPatch : null;
        if (nextStatusPatch && Object.keys(nextStatusPatch).length > 0) {
            __tmApplyAttrPatchLocally(tid, nextStatusPatch, { render: false, withFilters: true });
        }
        task.done = !!done;
        try {
            if (!state.doneOverrides || typeof state.doneOverrides !== 'object') state.doneOverrides = {};
            state.doneOverrides[tid] = !!done;
        } catch (e) {}
        try { MetaStore.set(tid, { done: !!done, content: task.content }); } catch (e) {}
        try {
            __tmSyncTaskPriorityScoreLocal(tid, {
                includeAncestors: true,
                refreshAncestorViews: true,
                reason: 'done-local-priority-sync',
            });
        } catch (e) {}
        try { recalcStats(); } catch (e) {}
        if (__tmShouldSyncCalendarDoneInPlace(source)) {
            try { globalThis.__tmCalendar.syncTaskDoneInPlace(tid, !!done, { allowRefetch: true }); } catch (e) {}
        }
        return true;
    }

    function __tmRollbackDoneOptimisticLocal(taskId, inversePatch, source = '') {
        const tid = String(taskId || '').trim();
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid] || null;
        if (!task) return false;
        const prevPatch = (inversePatch && typeof inversePatch === 'object' && !Array.isArray(inversePatch)) ? inversePatch : {};
        const prevDone = !!(Object.prototype.hasOwnProperty.call(prevPatch, 'done') ? prevPatch.done : task.done);
        const prevStatusPatch = { ...prevPatch };
        delete prevStatusPatch.done;
        if (Object.keys(prevStatusPatch).length > 0) {
            __tmRollbackAttrPatchLocally(tid, prevStatusPatch, { render: false, withFilters: true });
        }
        task.done = prevDone;
        try {
            if (!state.doneOverrides || typeof state.doneOverrides !== 'object') state.doneOverrides = {};
            state.doneOverrides[tid] = prevDone;
        } catch (e) {}
        try { MetaStore.set(tid, { done: prevDone, content: task.content }); } catch (e) {}
        try {
            __tmSyncTaskPriorityScoreLocal(tid, {
                includeAncestors: true,
                refreshAncestorViews: true,
                reason: 'done-rollback-priority-sync',
            });
        } catch (e) {}
        try { recalcStats(); } catch (e) {}
        if (__tmShouldSyncCalendarDoneInPlace(source)) {
            try { globalThis.__tmCalendar.syncTaskDoneInPlace(tid, prevDone, { allowRefetch: true }); } catch (e) {}
            return true;
        }
        try {
            __tmScheduleViewRefresh({
                mode: 'current',
                withFilters: true,
                reason: 'rollback-done-optimistic',
            });
        } catch (e) {
            try { __tmRefreshMainViewInPlace({ withFilters: true }); } catch (e2) {
                try { render(); } catch (e3) {}
            }
        }
        return true;
    }

    function __tmResolveMoveTargetListId(payload = {}) {
        const data = (payload && typeof payload === 'object') ? payload : {};
        const mode = String(data.mode || '').trim();
        if (mode === 'child' || mode === 'child-top') {
            return String(data.targetChildListId || data.targetTaskId || '').trim();
        }
        if (mode === 'before' || mode === 'after') {
            return String(data.targetListId || data.targetParentTaskId || '').trim();
        }
        if (mode === 'heading' || mode === 'doc' || mode === 'docTop') {
            return String(data.targetListId || '').trim();
        }
        return String(data.targetListId || '').trim();
    }

    function __tmApplyMovePayloadToTaskRecursive(task, payload = {}, isRoot = true) {
        const nextTask = (task && typeof task === 'object') ? task : null;
        if (!nextTask) return;
        const mode = String(payload.mode || '').trim();
        const targetDocId = String(payload.targetDocId || '').trim();
        const headingId = String(payload.headingId || '').trim();
        const docName = state.allDocuments.find((item) => String(item?.id || '').trim() === targetDocId)?.name || nextTask.docName || nextTask.doc_name || '';
        const targetParentTaskId = String(payload.targetParentTaskId || '').trim();
        const targetTaskId = String(payload.targetTaskId || '').trim();
        const targetListId = __tmResolveMoveTargetListId(payload);
        const headingMeta = __tmGetMoveTargetHeadingMeta(payload);
        nextTask.root_id = targetDocId;
        nextTask.docId = targetDocId;
        if (docName) {
            nextTask.docName = docName;
            nextTask.doc_name = docName;
        }
        if (mode === 'heading' && headingId) {
            const headings = state.kanbanDocHeadingsByDocId?.[targetDocId];
            const heading = Array.isArray(headings) ? headings.find((item) => String(item?.id || '').trim() === headingId) : null;
            nextTask.h2Id = headingId;
            nextTask.h2 = __tmNormalizeHeadingText(heading?.content);
            nextTask.h2Rank = Number(heading?.rank);
        } else if (mode === 'before' || mode === 'after' || mode === 'child' || mode === 'child-top') {
            nextTask.h2Id = headingMeta.h2Id;
            nextTask.h2 = headingMeta.h2;
            nextTask.h2Rank = headingMeta.h2Rank;
            nextTask.h2Path = '';
            nextTask.h2Sort = Number.NaN;
            nextTask.h2Created = '';
        } else {
            nextTask.h2Id = '';
            nextTask.h2 = '';
            nextTask.h2Rank = Number.NaN;
            nextTask.h2Path = '';
            nextTask.h2Sort = Number.NaN;
            nextTask.h2Created = '';
        }
        if (isRoot) {
            if (mode === 'child' || mode === 'child-top') nextTask.parentTaskId = targetTaskId;
            else if (mode === 'before' || mode === 'after') nextTask.parentTaskId = targetParentTaskId;
            else if (mode !== 'heading' || String(payload.crossDoc || '').trim() === '1') nextTask.parentTaskId = '';
            nextTask.parent_task_id = String(nextTask.parentTaskId || '').trim();
            if (targetListId || mode === 'heading' || mode === 'doc' || mode === 'docTop') {
                nextTask.parent_id = String(targetListId || '').trim();
                nextTask.parentId = nextTask.parent_id;
            }
        }
        (Array.isArray(nextTask.children) ? nextTask.children : []).forEach((child) => __tmApplyMovePayloadToTaskRecursive(child, payload, false));
    }

    function __tmApplyMoveOptimisticLocal(payload = {}) {
        const snap = payload?.snapshot;
        const task = snap?.task;
        const taskId = String(task?.id || payload?.taskId || '').trim();
        const targetDocId = String(payload?.targetDocId || '').trim();
        if (!task || !taskId || !targetDocId) return false;
        __tmRemoveTaskFromLocalState(taskId, { recalc: false, filter: false });
        const nextTask = JSON.parse(JSON.stringify(task));
        __tmApplyMovePayloadToTaskRecursive(nextTask, payload, true);
        const mode = String(payload?.mode || '').trim();
        let inserted = false;
        if (mode === 'heading') {
            __tmInsertTaskIntoDocLocal(nextTask, { atTop: false });
            inserted = true;
        } else if (mode === 'before') {
            inserted = __tmInsertTaskBeforeLocal(nextTask, payload?.targetTaskId);
        } else if (mode === 'after') {
            inserted = __tmInsertTaskAfterLocal(nextTask, payload?.targetTaskId);
        } else if (mode === 'child-top') {
            inserted = __tmInsertTaskAsChildLocal(nextTask, payload?.targetTaskId, {
                atTop: true,
            });
        } else if (mode === 'child') {
            inserted = __tmInsertTaskAsChildLocal(nextTask, payload?.targetTaskId, {
                atTop: String(payload?.targetLastDirectChildId || '').trim() ? false : true,
            });
        }
        if (!inserted) {
            if (mode === 'heading') {
                __tmInsertTaskIntoDocLocal(nextTask, { atTop: false });
            } else {
                __tmInsertTaskIntoDocLocal(nextTask, { atTop: true });
            }
        }
        try {
            const affectedDocIds = new Set([
                String(snap?.docId || '').trim(),
                String(targetDocId || '').trim(),
            ].filter(Boolean));
            affectedDocIds.forEach((docId) => {
                try { __tmRebuildLocalDocTree(docId); } catch (e) {}
            });
        } catch (e) {}
        try { recalcStats(); } catch (e) {}
        try { applyFilters(); } catch (e) {}
        try { __tmScheduleRender({ withFilters: true }); } catch (e) {}
        return true;
    }

    function __tmRollbackMoveOptimisticLocal(snapshot) {
        const snap = (snapshot && typeof snapshot === 'object') ? snapshot : null;
        const tid = String(snap?.taskId || snap?.task?.id || '').trim();
        if (!tid) return false;
        __tmRemoveTaskFromLocalState(tid, { recalc: false, filter: false });
        return __tmRollbackDeleteOptimisticLocal(snapshot);
    }

    async function __tmCreateTaskInDocKernel({ docId, content, priority, completionTime, pinned, customStatus, atTop, appendToBottom, insertBeforeId, localInsert = true } = {}) {
        const parentDocId = String(docId || '').trim();
        const text = String(content || '').trim();
        if (!parentDocId) throw new Error('未设置文档');
        if (!text) throw new Error('请输入任务内容');
        const statusOptions = __tmGetStatusOptions(SettingsStore.data.customStatusOptions || []);
        const requestedStatusId = String(customStatus || '').trim();
        const requestedStatusOption = requestedStatusId ? __tmFindStatusOptionById(requestedStatusId, statusOptions) : null;
        const initialMarker = requestedStatusOption
            ? __tmNormalizeTaskStatusMarker(requestedStatusOption.marker, __tmGuessStatusOptionDefaultMarker(requestedStatusOption))
            : ' ';
        const md = `- [${initialMarker}] ${text}`;

        let nextID = String(insertBeforeId || '').trim();
        if (!nextID && atTop) {
            try { nextID = String(await API.getFirstDirectChildIdOfDoc(parentDocId) || '').trim(); } catch (e) { nextID = ''; }
        }
        const insertedId = appendToBottom && !atTop && !nextID
            ? await __tmAppendBlockWithRetry(parentDocId, md)
            : await __tmInsertBlockWithRetry(parentDocId, md, nextID || undefined);
        // 某些端会返回外层列表块 ID，需要继续解析到真正的任务块。
        let taskId = await __tmResolveInsertedTaskBlockId(insertedId);

        const patch = {};
        const pin = pinned !== undefined ? !!pinned : !!SettingsStore.data.pinNewTasksByDefault;
        if (pin) patch.pinned = true;
        const pr0 = String(priority ?? '').trim();
        const prMap = {
            '高': 'high',
            '中': 'medium',
            '低': 'low',
            '无': '',
            'none': '',
        };
        const pr = prMap.hasOwnProperty(pr0) ? prMap[pr0] : pr0;
        if (pr === 'high' || pr === 'medium' || pr === 'low') patch.priority = pr;
        const ct = String(completionTime || '').trim();
        if (ct) patch.completionTime = ct;
        const st0 = String(customStatus || '').trim();
        if (st0) {
            const ok = statusOptions.some(o => String(o?.id || '').trim() === st0);
            if (ok) patch.customStatus = st0;
        }
        if (Object.keys(patch).length > 0) {
            taskId = await __tmPersistNewTaskAttrsWithRetry(taskId, patch, async () => await __tmResolveInsertedTaskBlockId(insertedId));
        }
        try { __tmInvalidateTasksQueryCacheByDocId(parentDocId); } catch (e) {}

        const docName = state.allDocuments.find(d => d.id === parentDocId)?.name || '未知文档';
        const newTask = {
            id: taskId,
            done: __tmIsTaskMarkerDone(initialMarker),
            pinned: !!pin,
            content: text,
            markdown: md,
            priority: patch.priority || '',
            duration: '',
            remark: '',
            completionTime: patch.completionTime || '',
            customTime: '',
            customStatus: patch.customStatus || '',
            taskMarker: initialMarker,
            task_marker: initialMarker,
            docName,
            root_id: parentDocId,
            docId: parentDocId,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            children: [],
            level: 0,
        };
        try { normalizeTaskFields(newTask, docName); } catch (e) {}
        try {
            state.pendingInsertedTasks[taskId] = {
                ...newTask,
                expiresAt: Date.now() + 10000,
            };
        } catch (e) {}

        if (localInsert !== false) {
            __tmUpsertLocalTask(newTask);
            try { recalcStats(); } catch (e) {}
            try { applyFilters(); } catch (e) {}
            if (state.modal) render();
        }
        return taskId;
    }

    function __tmBuildHeadingGroupCreateBtnHtml(docId, headingId, title = '新建任务') {
        const did = String(docId || '').trim();
        if (!did) return '';
        const hid = String(headingId || '').trim();
        return `
            <span class="tm-group-actions" onclick="event.stopPropagation()">
                <button class="tm-group-create-btn"
                        type="button"
                        title="${esc(title)}"
                        aria-label="${esc(title)}"
                        onpointerdown="event.stopPropagation()"
                        onclick="tmCreateTaskForHeadingGroup('${escSq(did)}','${escSq(hid)}', event)">
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M8 3.25v9.5M3.25 8h9.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                </button>
            </span>
        `;
    }

    window.tmCreateTaskForHeadingGroup = async function(docId, headingId, ev) {
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}

        const did = String(docId || '').trim();
        const hid = String(headingId || '').trim();
        if (!did) {
            hint('❌ 未找到文档', 'error');
            return;
        }
        const text = await showPrompt('新建任务', '请输入任务内容', '');
        if (text == null) return;
        const nextText = String(text || '').trim();
        if (!nextText) {
            hint('⚠ 请输入任务内容', 'warning');
            return;
        }
        try {
            let taskId = '';
            const useSectionEnd = !!SettingsStore.data.headingGroupCreateAtSectionEnd;
            let createdAtSectionEnd = false;
            if (hid && hid !== '__none__' && useSectionEnd) {
                const placement = await __tmResolveHeadingGroupInsertPlacement(did, hid, SettingsStore.data.taskHeadingLevel || 'h2');
                if (placement.matched) {
                    taskId = await __tmQueueCreateTaskInDoc({
                        docId: did,
                        content: nextText,
                        insertBeforeId: placement.nextID || '',
                        appendToBottom: placement.appendToBottom === true,
                        pinned: false,
                    });
                    createdAtSectionEnd = true;
                    const task = state.pendingInsertedTasks?.[String(taskId || '').trim()];
                    if (task) {
                        task.h2 = __tmNormalizeHeadingText(placement.heading?.content);
                        task.h2Id = hid;
                        task.h2Rank = Number(placement.heading?.rank);
                        task.h2Path = '';
                        task.h2Sort = Number.NaN;
                        task.h2Created = '';
                    }
                }
            }
            if (!taskId) {
                taskId = await __tmQueueCreateTaskInDoc({ docId: did, content: nextText, atTop: true, pinned: false });
            }
            if (hid && hid !== '__none__' && !createdAtSectionEnd) {
                await __tmQueueMoveTask(taskId, { targetDocId: did, headingId: hid, mode: 'heading' });
            } else if (!hid || hid === '__none__') {
                const task = state.pendingInsertedTasks?.[String(taskId || '').trim()];
                if (task) {
                    task.h2 = '';
                    task.h2Id = '';
                    if (state.pendingInsertedTasks?.[taskId]) {
                        state.pendingInsertedTasks[taskId].h2 = '';
                        state.pendingInsertedTasks[taskId].h2Id = '';
                    }
                }
            }
            const pendingTask = state.pendingInsertedTasks?.[String(taskId || '').trim()];
            if (pendingTask) __tmUpsertLocalTask(pendingTask);
            __tmRefreshMainViewInPlace({ withFilters: true });
            __tmLoadSelectedDocumentsPreserveChecklistScroll({
                source: 'heading-create-task',
                forceSyncFlowRank: true,
            }).catch((err) => {
                try { console.error('[标题分组新建任务] 刷新失败:', err); } catch (e) {}
            });
            hint('✅ 任务已创建', 'success');
        } catch (e) {
            hint(`❌ 新建任务失败: ${e.message}`, 'error');
        }
    };

    function __tmShouldRetryBlockMutationError(error) {
        const msg = String(error?.message || error || '').toLowerCase();
        return msg.includes('tree not found')
            || msg.includes('invalid id argument')
            || msg.includes('invalid id')
            || msg.includes('id argument')
            || msg.includes('not found')
            || msg.includes('找不到');
    }

    async function __tmAppendBlockWithRetry(parentId, md, options = {}) {
        const targetParentId = String(parentId || '').trim();
        const markdown = String(md || '').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        if (!targetParentId) throw new Error('未找到目标块');
        if (!markdown) throw new Error('内容为空');
        let lastErr = null;
        const retryDelays = Array.isArray(opts.retryDelays) && opts.retryDelays.length
            ? opts.retryDelays
            : [120, 300, 520, 860, 1280];
        for (let i = 0; i <= retryDelays.length; i += 1) {
            try {
                return await API.appendBlock(targetParentId, markdown);
            } catch (e) {
                lastErr = e;
                const retryable = __tmShouldRetryBlockMutationError(e);
                if (!retryable || i >= retryDelays.length) break;
                try { await API.call('/api/sqlite/flushTransaction', {}); } catch (e2) {}
                await new Promise((resolve) => setTimeout(resolve, retryDelays[i]));
            }
        }
        throw lastErr || new Error('追加块失败');
    }

    async function __tmInsertBlockWithRetry(parentId, md, placement, options = {}) {
        const targetParentId = String(parentId || '').trim();
        const markdown = String(md || '').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        if (!targetParentId) throw new Error('未找到目标块');
        if (!markdown) throw new Error('内容为空');
        let lastErr = null;
        const retryDelays = Array.isArray(opts.retryDelays) && opts.retryDelays.length
            ? opts.retryDelays
            : [120, 300, 520, 860, 1280];
        for (let i = 0; i <= retryDelays.length; i += 1) {
            try {
                return await API.insertBlock(targetParentId, markdown, placement);
            } catch (e) {
                lastErr = e;
                const retryable = __tmShouldRetryBlockMutationError(e);
                if (!retryable || i >= retryDelays.length) break;
                try { await API.call('/api/sqlite/flushTransaction', {}); } catch (e2) {}
                await new Promise((resolve) => setTimeout(resolve, retryDelays[i]));
            }
        }
        throw lastErr || new Error('插入块失败');
    }

    async function __tmCreateSubtaskForTaskKernel(parentTaskId, content) {
        const pid = String(parentTaskId || '').trim();
        const parentTask = globalThis.__tmRuntimeState?.getFlatTaskById?.(pid) || state.flatTasks?.[pid];
        if (!pid || !parentTask) throw new Error('未找到父任务');
        const text = String(content || '').trim();
        if (!text) throw new Error('请输入子任务内容');

        const insertedId = await __tmAppendBlockWithRetry(pid, `- [ ] ${text}`);
        const taskId = await __tmResolveInsertedTaskBlockId(insertedId);
        try { await __tmPersistMetaAndAttrsAsync(taskId, { pinned: false }); } catch (e) {}
        try {
            const docId = String(parentTask.docId || parentTask.root_id || '').trim();
            if (docId) __tmInvalidateTasksQueryCacheByDocId(docId);
        } catch (e) {}
        return taskId;
    }

    async function __tmResolveTaskListBlockId(taskId) {
        const tid = String(taskId || '').trim();
        if (!tid) return '';
        try {
            const rows = await API.getBlocksByIds([tid]);
            const row = Array.isArray(rows) ? rows[0] : null;
            const parentId = String(row?.parent_id || '').trim();
            if (parentId) return parentId;
        } catch (e) {}
        const cachedListId = String(
            globalThis.__tmRuntimeState?.getFlatTaskById?.(tid)?.parent_id
            || state.flatTasks?.[tid]?.parent_id
            || ''
        ).trim();
        if (cachedListId) {
            try {
                const rows = await API.getBlocksByIds([cachedListId]);
                const row = Array.isArray(rows) ? rows[0] : null;
                if (String(row?.id || '').trim() === cachedListId && String(row?.type || '').trim() === 'l') {
                    return cachedListId;
                }
            } catch (e) {}
        }
        return '';
    }

    async function __tmCreateSiblingTaskForTaskKernel(taskId, content) {
        const tid = String(taskId || '').trim();
        const currentTask = globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid];
        if (!tid || !currentTask) throw new Error('未找到当前任务');
        const text = String(content || '').trim();
        if (!text) throw new Error('请输入任务内容');

        const listId = await __tmResolveTaskListBlockId(tid);
        if (!listId) throw new Error('未找到当前任务所在的任务列表');

        const insertedId = await __tmInsertBlockWithRetry(listId, `- [ ] ${text}`, { previousID: tid });
        const nextTaskId = await __tmResolveInsertedTaskBlockId(insertedId);
        try { await __tmPersistMetaAndAttrsAsync(nextTaskId, { pinned: false }); } catch (e) {}
        try {
            const docId = String(currentTask.docId || currentTask.root_id || '').trim();
            if (docId) __tmInvalidateTasksQueryCacheByDocId(docId);
        } catch (e) {}
        return nextTaskId;
    }

    async function __tmCreateTaskInDoc(options = {}) {
        return await __tmCreateTaskInDocKernel(options);
    }

    async function __tmCreateSubtaskForTask(parentTaskId, content) {
        return await __tmCreateSubtaskForTaskKernel(parentTaskId, content);
    }

    async function __tmCreateSiblingTaskForTask(taskId, content) {
        return await __tmCreateSiblingTaskForTaskKernel(taskId, content);
    }

    function __tmQueueCreateSubtask(parentTaskId, content, options = {}) {
        const pid = String(parentTaskId || '').trim();
        const text = String(content || '').trim();
        if (!pid) throw new Error('未找到父任务');
        if (!text) throw new Error('请输入子任务内容');
        const hooks = (options && typeof options === 'object') ? options : {};
        const tempId = __tmGenerateTempTaskId('subtask');
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(pid) || state.flatTasks?.[pid];
        const docId = String(task?.docId || task?.root_id || '').trim();
        const opPromise = __tmEnqueueQueuedOp({
            type: 'createSubtask',
            docId,
            laneKey: docId ? `doc:${docId}` : `task:${pid}`,
            data: {
                parentTaskId: pid,
                tempId,
                content: text,
                docId,
            },
        }, { wait: true });
        try { hooks.onQueued?.(tempId); } catch (e) {}
        opPromise.then((result) => {
            try { state.collapsedTaskIds?.delete?.(pid); } catch (e) {}
            try { hooks.onSuccess?.(String(result?.realId || tempId).trim() || tempId); } catch (e) {}
            if (hooks.silent !== true) hint('✅ 已新增', 'success');
        }).catch((e) => {
            try { hooks.onError?.(e); } catch (e2) {}
            if (hooks.silent !== true) hint(`❌ 新建子任务失败: ${e.message}`, 'error');
        }).finally(() => {
            try { hooks.onFinally?.(); } catch (e) {}
        });
        return opPromise;
    }

    function __tmApplyOptimisticSubtask(parentTaskId, subtaskId, content) {
        const pid = String(parentTaskId || '').trim();
        const tid = String(subtaskId || '').trim();
        const text = String(content || '').trim();
        const parentTask = globalThis.__tmRuntimeState?.getFlatTaskById?.(pid) || state.flatTasks?.[pid];
        if (!pid || !tid || !text || !parentTask) return;

        const nextTask = {
            id: tid,
            done: false,
            pinned: false,
            content: text,
            markdown: `- [ ] ${text}`,
            priority: '',
            duration: '',
            remark: '',
            completionTime: '',
            customTime: '',
            customStatus: '',
            docName: parentTask.docName || '',
            root_id: parentTask.root_id || parentTask.docId || '',
            docId: parentTask.docId || parentTask.root_id || '',
            parentTaskId: pid,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            children: [],
            level: Math.max(0, Number(parentTask.level) || 0) + 1,
            h2: parentTask.h2 || '',
            h2Id: parentTask.h2Id || '',
        };
        try { normalizeTaskFields(nextTask, nextTask.docName || '未知文档'); } catch (e) {}

        if (!Array.isArray(parentTask.children)) parentTask.children = [];
        if (!parentTask.children.some((child) => String(child?.id || '').trim() === tid)) {
            parentTask.children.push(nextTask);
        }
        state.flatTasks[tid] = nextTask;
        try {
            state.pendingInsertedTasks[tid] = {
                ...nextTask,
                expiresAt: Date.now() + 10000,
            };
        } catch (e) {}
    }

    function __tmApplyOptimisticSiblingTask(sourceTaskId, siblingTaskId, content) {
        const sid = String(sourceTaskId || '').trim();
        const tid = String(siblingTaskId || '').trim();
        const text = String(content || '').trim();
        const sourceTask = globalThis.__tmRuntimeState?.getFlatTaskById?.(sid) || state.flatTasks?.[sid];
        if (!sid || !tid || !text || !sourceTask) return;

        const parentTaskId = String(sourceTask.parentTaskId || '').trim();
        const parentTask = parentTaskId
            ? (globalThis.__tmRuntimeState?.getFlatTaskById?.(parentTaskId) || state.flatTasks?.[parentTaskId] || null)
            : null;
        const nextTask = {
            id: tid,
            done: false,
            pinned: false,
            content: text,
            markdown: `- [ ] ${text}`,
            priority: '',
            duration: '',
            remark: '',
            completionTime: '',
            customTime: '',
            customStatus: '',
            docName: sourceTask.docName || '',
            root_id: sourceTask.root_id || sourceTask.docId || '',
            docId: sourceTask.docId || sourceTask.root_id || '',
            parent_id: sourceTask.parent_id || '',
            parentTaskId: parentTaskId || null,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            children: [],
            level: Math.max(0, Number(sourceTask.level) || 0),
            h2: sourceTask.h2 || '',
            h2Id: sourceTask.h2Id || '',
        };
        try { normalizeTaskFields(nextTask, nextTask.docName || '未知文档'); } catch (e) {}
        try {
            const sourceDocSeq = Number(sourceTask?.docSeq);
            if (Number.isFinite(sourceDocSeq)) nextTask.docSeq = sourceDocSeq + 0.5;
        } catch (e) {}

        state.flatTasks[tid] = nextTask;
        if (parentTask) {
            if (!Array.isArray(parentTask.children)) parentTask.children = [];
            if (!parentTask.children.some((child) => String(child?.id || '').trim() === tid)) {
                const sourceIndex = parentTask.children.findIndex((child) => String(child?.id || '').trim() === sid);
                if (sourceIndex >= 0) parentTask.children.splice(sourceIndex + 1, 0, nextTask);
                else parentTask.children.push(nextTask);
            }
        } else {
            const docId = String(nextTask.docId || nextTask.root_id || '').trim();
            const doc = state.taskTree.find((item) => String(item?.id || '').trim() === docId);
            if (doc) {
                if (!Array.isArray(doc.tasks)) doc.tasks = [];
                if (!doc.tasks.some((item) => String(item?.id || '').trim() === tid)) {
                    const sourceIndex = doc.tasks.findIndex((item) => String(item?.id || '').trim() === sid);
                    if (sourceIndex >= 0) doc.tasks.splice(sourceIndex + 1, 0, nextTask);
                    else doc.tasks.push(nextTask);
                }
            } else {
                __tmUpsertLocalTask(nextTask);
            }
        }
        try {
            state.pendingInsertedTasks[tid] = {
                ...nextTask,
                expiresAt: Date.now() + 10000,
            };
        } catch (e) {}
    }

    function __tmQueueCreateTaskInDoc(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const docId = String(opts.docId || '').trim();
        const content = String(opts.content || '').trim();
        if (!docId) throw new Error('未设置文档');
        if (!content) throw new Error('请输入任务内容');
        const tempId = __tmGenerateTempTaskId('task');
        const opPromise = __tmEnqueueQueuedOp({
            type: 'createTaskInDoc',
            docId,
            laneKey: `doc:${docId}`,
            data: {
                ...opts,
                docId,
                content,
                tempId,
            },
        }, { wait: true });
        return opPromise.then((result) => String(result?.realId || tempId).trim() || tempId);
    }

    function __tmQueueCreateSiblingTask(taskId, content, options = {}) {
        const tid = String(taskId || '').trim();
        const text = String(content || '').trim();
        const currentTask = globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid];
        if (!tid || !currentTask) throw new Error('未找到当前任务');
        if (!text) throw new Error('请输入任务内容');
        const tempId = __tmGenerateTempTaskId('sibling');
        const docId = String(currentTask.docId || currentTask.root_id || '').trim();
        const opPromise = __tmEnqueueQueuedOp({
            type: 'createSibling',
            docId,
            laneKey: docId ? `doc:${docId}` : `task:${tid}`,
            data: {
                sourceTaskId: tid,
                tempId,
                content: text,
                docId,
            },
        }, { wait: true });
        return opPromise.then((result) => String(result?.realId || tempId).trim() || tempId);
    }

    window.tmCreateSubtask = async function(parentTaskId, ev) {
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}

        const pid = String(parentTaskId || '').trim();
        const parentTask = globalThis.__tmRuntimeState?.getFlatTaskById?.(pid) || state.flatTasks?.[pid];
        if (!pid || !parentTask) {
            hint('❌ 未找到父任务', 'error');
            return;
        }
        if (!__tmEnsureEditableTaskLike(parentTask, '新建子任务')) return;

        const text = await showPrompt('新建子任务', '请输入子任务内容', '');
        if (text == null) return;
        const nextText = String(text || '').trim();
        if (!nextText) {
            hint('⚠ 请输入子任务内容', 'warning');
            return;
        }

        try {
            __tmQueueCreateSubtask(pid, nextText, {
                onSuccess: () => {
                    __tmRefreshMainViewInPlace({ withFilters: true });
                    __tmLoadSelectedDocumentsPreserveChecklistScroll({
                        source: 'create-subtask',
                        forceSyncFlowRank: true,
                    }).catch((err) => {
                        try { console.error('[子任务] 刷新失败:', err); } catch (e) {}
                    });
                }
            });
        } catch (e) {
            hint(`❌ 新建子任务失败: ${e.message}`, 'error');
        }
    };

    window.tmCreateSiblingTask = async function(taskId, ev) {
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}

        const tid = String(taskId || '').trim();
        const currentTask = globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid];
        if (!tid || !currentTask) {
            hint('❌ 未找到当前任务', 'error');
            return;
        }
        if (!__tmEnsureEditableTaskLike(currentTask, '新建同级任务')) return;

        const text = await showPrompt('新建同级任务', '请输入任务内容', '');
        if (text == null) return;
        const nextText = String(text || '').trim();
        if (!nextText) {
            hint('⚠ 请输入任务内容', 'warning');
            return;
        }

        try {
            const siblingTaskId = await __tmQueueCreateSiblingTask(tid, nextText);
            __tmRefreshMainViewInPlace({ withFilters: true });
            __tmLoadSelectedDocumentsPreserveChecklistScroll({
                source: 'create-sibling',
                forceSyncFlowRank: true,
            }).catch((err) => {
                try { console.error('[同级任务] 刷新失败:', err); } catch (e) {}
            });
            hint('✅ 同级任务已创建', 'success');
        } catch (e) {
            hint(`❌ 新建同级任务失败: ${e.message}`, 'error');
        }
    };

    // 注册全局刷新回调，供悬浮条调用
    globalThis.__taskHorizonRefresh = () => {
        try {
            const modifiedIds = Array.from(__tmModifiedTaskIds || []).map((id) => String(id || '').trim()).filter(Boolean);
            const pluginVisible = __tmIsPluginVisibleNow();
            try {
                __tmPushRefreshDebug('quickbar-auto-update:refresh-enter', {
                    modifiedCount: modifiedIds.length,
                    modifiedIds,
                    pluginVisible,
                    isRefreshing: state.isRefreshing === true,
                    viewMode: globalThis.__tmRuntimeState?.getViewMode?.('') || String(state.viewMode || '').trim() || '',
                });
            } catch (e) {}
            if (pluginVisible) {
                if (modifiedIds.length > 0) {
                    modifiedIds.forEach((taskId) => {
                        try { __tmViewControllers.detail.patchTask(taskId); } catch (e) {}
                    });
                }
                let rerenderedInPlace = false;
                try {
                    const liveModal = globalThis.__tmRuntimeState?.getModal?.() || state.modal;
                    if (globalThis.__tmRuntimeState?.hasLiveModal?.(liveModal) ?? (state.modal && document.body.contains(state.modal))) {
                        rerenderedInPlace = !!__tmRerenderCurrentViewInPlace(liveModal);
                        if (!rerenderedInPlace) {
                            __tmScheduleViewRefresh({
                                mode: 'current',
                                withFilters: true,
                                reason: 'quickbar-refresh-visible',
                            });
                        }
                    }
                } catch (e) {}
                try {
                    __tmPushRefreshDebug('quickbar-auto-update:refresh-visible', {
                        modifiedCount: modifiedIds.length,
                        modifiedIds,
                        rerenderedInPlace,
                        detailPatchedCount: modifiedIds.length,
                    });
                } catch (e) {}
                try { __tmModifiedTaskIds.clear(); } catch (e) {}
                return;
            }
            // 不可见时再退回静默就地刷新，避免切回页面后数据过旧。
            if (state.isRefreshing) {
                try {
                    __tmPushRefreshDebug('quickbar-auto-update:refresh-hidden-busy', {
                        modifiedCount: modifiedIds.length,
                        modifiedIds,
                    });
                } catch (e) {}
                setTimeout(() => { try { __tmSilentRefreshAfterQuickbarUpdate(); } catch (e) {} }, 500);
                return;
            }
            try {
                __tmPushRefreshDebug('quickbar-auto-update:refresh-hidden', {
                    modifiedCount: modifiedIds.length,
                    modifiedIds,
                });
            } catch (e) {}
            __tmSilentRefreshAfterQuickbarUpdate();
        } catch (e) {
            try {
                __tmPushRefreshDebug('quickbar-auto-update:refresh-error', {
                    error: String(e?.message || e || '').trim(),
                });
            } catch (e2) {}
            console.error('__taskHorizonRefresh error:', e);
        }
    };

    // 标记任务被修改，供悬浮条调用
    globalThis.__taskHorizonMarkModified = (taskId) => {
        if (taskId) {
            __tmModifiedTaskIds.add(String(taskId));
            try {
                __tmPushRefreshDebug('quickbar-auto-update:mark-modified-global', {
                    taskId: String(taskId || '').trim(),
                    modifiedCount: Number(__tmModifiedTaskIds?.size || 0),
                });
            } catch (e) {}
        }
    };

    // 清除修改标记，供刷新后调用
    globalThis.__taskHorizonClearModified = () => {
        __tmModifiedTaskIds.clear();
    };

    globalThis.__taskHorizonBuildTaskLikeFromBlockId = async (blockId) => {
        try {
            return await __tmBuildTaskLikeFromBlockId(blockId);
        } catch (e) {
            return null;
        }
    };

    window.tmQuickAddClose = function() {
        state.__quickAddDocPickerUnstack?.();
        state.__quickAddDocPickerUnstack = null;
        state.__quickAddUnstack?.();
        state.__quickAddUnstack = null;
        if (state.quickAddModal) {
            try { state.quickAddModal.remove(); } catch (e) {}
            state.quickAddModal = null;
        }
        if (state.quickAddDocPicker) {
            try { state.quickAddDocPicker.remove(); } catch (e) {}
            state.quickAddDocPicker = null;
        }
        state.quickAdd = null;
    };

    window.tmQuickAddOpen = async function() {
        if (state.quickAddModal) {
            try { state.quickAddModal.remove(); } catch (e) {}
            state.quickAddModal = null;
        }
        if (state.quickAddDocPicker) {
            try { state.quickAddDocPicker.remove(); } catch (e) {}
            state.quickAddDocPicker = null;
        }

        const configuredNewTaskDoc = String(SettingsStore.data.newTaskDocId || '').trim();
        const docId = await __tmResolveDefaultDocIdAsync();
        if (!docId && configuredNewTaskDoc !== '__dailyNote__') {
            hint('⚠ 请先在设置中选择文档', 'warning');
            showSettings();
            return;
        }

        const initialMode = configuredNewTaskDoc === '__dailyNote__' ? 'dailyNote' : 'doc';
        const initialDocId = configuredNewTaskDoc === '__dailyNote__' ? (docId || '') : docId;

        const stOptions = SettingsStore.data.customStatusOptions || [];
        const defaultStatusId = __tmGetDefaultUndoneStatusId(stOptions);
        state.quickAdd = {
            docId: initialDocId,
            docMode: initialMode,
            customStatus: defaultStatusId,
            priority: 'none',
            completionTime: '',
            openReminderAfterCreate: false,
        };

        const modal = document.createElement('div');
        modal.className = 'tm-quick-add-modal';
        modal.style.zIndex = '100010';

        // 优先级配置
        const prConfig = {
            'high': { label: '高', color: 'var(--tm-danger-color)', bg: 'color-mix(in srgb, var(--tm-danger-color) 10%, transparent)' },
            'medium': { label: '中', color: 'var(--tm-warning-color, #f9ab00)', bg: 'color-mix(in srgb, var(--tm-warning-color, #f9ab00) 10%, transparent)' },
            'low': { label: '低', color: 'var(--tm-primary-color)', bg: 'color-mix(in srgb, var(--tm-primary-color) 10%, transparent)' },
            'none': { label: '无', color: 'var(--tm-text-color)', bg: 'transparent' }
        };

        modal.innerHTML = `
            <div class="tm-prompt-box" style="width: min(92vw, 520px);">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
                    <div class="tm-prompt-title" style="margin:0;">添加待办</div>
                    <button class="tm-btn tm-btn-gray" id="tmQuickAddCloseBtn" onclick="tmQuickAddClose()" style="padding: 6px 12px; font-size: 13px;">关闭</button>
                </div>

                <input type="text" id="tmQuickAddInput" class="tm-prompt-input" placeholder="输入事项…" style="margin-top:16px; font-size: 16px; padding: 12px;">

                <div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap;margin-top:16px;">
                    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;flex:1 1 280px;min-width:0;">
                        <button class="tm-btn tm-btn-secondary" onclick="tmQuickAddOpenDocPicker()" style="padding: 6px 12px; font-size: 13px; display:flex; align-items:center; gap:4px; max-width:100%;">
                            📁 <span id="tmQuickAddDocName">文档</span>
                        </button>

                        <button id="tmQuickAddPriorityBtn" class="tm-btn tm-btn-secondary" onclick="tmQuickAddOpenPriorityPicker(event)" aria-haspopup="listbox" style="padding: 6px 12px; font-size: 13px; display:flex; align-items:center; gap:4px;">
                            ${__tmRenderPriorityJira('none', false)}
                        </button>

                        <div style="display:flex;align-items:center;gap:6px;">
                            <button id="tmQuickAddStatusBtn" class="tm-btn tm-btn-secondary" onclick="tmQuickAddOpenStatusPicker()" style="padding: 6px 10px; font-size: 13px; height: 32px; display:flex; align-items:center; gap:6px;">
                                状态
                            </button>
                        </div>

                        <div style="position:relative; display:inline-block; max-width:100%;">
                            <!-- 桌面端/移动端通用的日期选择器 -->
                            <div style="position:relative; display:inline-block; max-width:100%;">
                                <button class="tm-btn tm-btn-secondary" onclick="tmQuickAddOpenDatePicker()" style="padding: 6px 12px; font-size: 13px; display:flex; align-items:center; gap:4px; max-width:100%;">
                                    🗓 <span id="tmQuickAddDateLabel" style="display:inline-block; max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">截止日期</span>
                                </button>
                                <input type="date" id="tmQuickAddDateInput" oninput="tmQuickAddDateChanged(this.value)" onchange="tmQuickAddDateChanged(this.value)"
                                       style="position:absolute; opacity:0; width:1px; height:1px; left:0; bottom:0; pointer-events:none; border:0; padding:0; margin:0; overflow:hidden; z-index:-1;">
                            </div>
                        </div>

                        <button id="tmQuickAddReminderBtn" class="tm-btn tm-btn-secondary" onclick="tmQuickAddToggleReminder()" style="padding: 6px 12px; font-size: 13px; display:flex; align-items:center; gap:4px;">
                            ⏰ <span>提醒</span>
                        </button>
                    </div>

                    <div style="display:flex; justify-content:flex-end; flex:0 0 auto; margin-left:auto; min-width:max-content;">
                        <button class="tm-btn tm-btn-primary" id="tmQuickAddSubmitBtn" onclick="tmQuickAddSubmit()" style="padding: 6px 14px; font-size: 13px; min-width: 96px; text-align:center; white-space:nowrap;">提交</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        state.quickAddModal = modal;
        __tmApplyPopupOpenAnimation(modal, modal.querySelector('.tm-prompt-box'), {
            mode: window.matchMedia?.('(max-width: 640px)')?.matches ? 'sheet' : 'center'
        });

        // 自动聚焦 (兼容移动端)
        const input = document.getElementById('tmQuickAddInput');
        if (input) {
            setTimeout(() => {
                input.focus();
                try { input.click(); } catch(e) {}
            }, 300);
            input.onkeydown = (e) => {
                if (e.key !== 'Enter') return;
                if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
                try { e.preventDefault(); } catch (e2) {}
                try { e.stopPropagation(); } catch (e2) {}
                window.tmQuickAddSubmit?.();
            };
        }

        state.__quickAddUnstack = __tmModalStackBind(() => window.tmQuickAddClose?.());

        modal.onclick = (e) => {
            if (e.target === modal) window.tmQuickAddClose?.();
        };

        window.tmQuickAddRenderMeta?.();
    };

    window.tmQuickAddOpenForDoc = async function(docId) {
        const id = String(docId || '').trim();
        await window.tmQuickAddOpen?.();
        if (!id) return;
        if (!state.quickAdd) return;
        state.quickAdd.docMode = 'doc';
        state.quickAdd.docId = id;
        try { window.tmQuickAddRenderMeta?.(); } catch (e) {}
        try {
            const input = document.getElementById('tmQuickAddInput');
            input?.focus?.();
        } catch (e) {}
    };

    window.tmQuickAddOpenForPreset = async function(docId, statusId) {
        const did = String(docId || '').trim();
        const sid = String(statusId || '').trim();
        await window.tmQuickAddOpen?.();
        const qa = state.quickAdd;
        if (!qa) return;
        if (did) {
            qa.docMode = 'doc';
            qa.docId = did;
        }
        if (sid) {
            const statusOptions = __tmGetStatusOptions(SettingsStore.data.customStatusOptions || []);
            if (__tmFindStatusOptionById(sid, statusOptions)) {
                qa.customStatus = sid;
            }
        }
        try { window.tmQuickAddRenderMeta?.(); } catch (e) {}
        try {
            const input = document.getElementById('tmQuickAddInput');
            input?.focus?.();
        } catch (e) {}
    };

    // 绑定全局点击事件，用于处理日期选择和关闭按钮（防止事件未被正确绑定）
    if (!window.tmQuickAddEventsBound) {
        window.tmQuickAddEventsBound = true;
        __tmQuickAddGlobalClickHandler = (e) => {
            const target = e.target;
            // 检查是否点击了文档选择器的关闭按钮（只关闭选择器，不关闭整个弹窗）
            if (target.id === 'tmQuickAddDocPickerCloseBtn' || (target.matches('.tm-btn-gray') && target.textContent.trim() === '关闭' && target.closest('#tmQuickAddDocList'))) {
                if (state.quickAddDocPicker) {
                    tmQuickAddCloseDocPicker();
                }
                e.stopPropagation();
                return;
            }
            // 检查是否点击了主弹窗的关闭按钮（关闭整个弹窗）
            if (target.id === 'tmQuickAddCloseBtn' || (target.matches('.tm-btn-gray') && target.textContent.trim() === '关闭' && !target.closest('#tmQuickAddDocList'))) {
                if (state.quickAddModal) {
                    tmQuickAddClose();
                }
            }
        };
        globalThis.__tmRuntimeEvents?.on?.(document, 'click', __tmQuickAddGlobalClickHandler);
    }

    window.tmQuickAddRenderMeta = function() {
        try {
            const qa = state.quickAdd || {};

            // 更新文档按钮文字
            const docName = qa.docMode === 'dailyNote'
                ? '今天日记'
                : (state.allDocuments.find(d => d.id === qa.docId)?.name || '未知文档');
            const docBtn = document.getElementById('tmQuickAddDocName');
            if (docBtn) docBtn.textContent = docName;

            // 更新优先级按钮样式（Jira 风格）
            const prBtn = document.getElementById('tmQuickAddPriorityBtn');
            if (prBtn) {
                const pr = qa.priority || 'none';
                prBtn.innerHTML = __tmRenderPriorityJira(pr, false);
                prBtn.style.color = '';
                prBtn.style.borderColor = '';
                prBtn.style.background = '';
            }

            window.tmQuickAddRefreshStatusSelect?.();
            const stBtn = document.getElementById('tmQuickAddStatusBtn');
            if (stBtn) {
                const options = SettingsStore.data.customStatusOptions || [];
                const id = __tmResolveUndoneStatusValue(qa.customStatus, options);
                const opt = options.find(o => o && o.id === id) || { id, name: id || '待办', color: '#757575' };
                const chipStyle = __tmBuildStatusChipStyle(opt.color);
                const name = String(opt?.name || opt?.id || '待办');
                stBtn.innerHTML = `<span class="tm-status-tag" style="${chipStyle};cursor:default;">${esc(name)}</span>`;
            }

            // 更新日期显示
            const dateLabel = document.getElementById('tmQuickAddDateLabel');
            const dateInput = document.getElementById('tmQuickAddDateInput');
            if (dateLabel && dateInput) {
                const ct = qa.completionTime ? __tmFormatTaskTime(qa.completionTime) : '截止日期';
                dateLabel.textContent = ct;
                dateInput.value = qa.completionTime ? __tmNormalizeDateOnly(qa.completionTime) : '';

                const btn = document.getElementById('tmQuickAddDateLabel')?.parentElement;
                if (btn) {
                    if (qa.completionTime) {
                        btn.style.color = 'var(--tm-primary-color)';
                        btn.style.borderColor = 'var(--tm-primary-color)';
                    } else {
                        btn.style.color = '';
                        btn.style.borderColor = '';
                    }
                }
            }

            const reminderBtn = document.getElementById('tmQuickAddReminderBtn');
            if (reminderBtn) {
                const enabled = !!SettingsStore.data.enableTomatoIntegration;
                const active = !!qa.openReminderAfterCreate;
                reminderBtn.style.opacity = enabled ? '1' : '0.55';
                reminderBtn.style.cursor = enabled ? 'pointer' : 'not-allowed';
                reminderBtn.style.color = active ? 'var(--tm-primary-color)' : '';
                reminderBtn.style.borderColor = active ? 'var(--tm-primary-color)' : '';
                reminderBtn.style.background = active ? 'color-mix(in srgb, var(--tm-bg-color) 82%, var(--tm-primary-color) 18%)' : '';
                reminderBtn.title = enabled ? (active ? '提交后打开提醒设置' : '点击后提交时会打开提醒设置') : '番茄钟联动未启用';
                reminderBtn.innerHTML = `⏰ <span>${active ? '提醒: 开' : '提醒'}</span>`;
                reminderBtn.disabled = !enabled;
            }
        } catch (e) {}
    };

    window.tmQuickAddToggleReminder = function() {
        const qa = state.quickAdd;
        if (!qa) return;
        if (!SettingsStore.data.enableTomatoIntegration) {
            hint('⚠ 番茄钟联动已关闭', 'warning');
            return;
        }
        qa.openReminderAfterCreate = !qa.openReminderAfterCreate;
        window.tmQuickAddRenderMeta?.();
    };

    window.tmQuickAddStatusChanged = function(value) {
        const qa = state.quickAdd;
        if (!qa) return;
        qa.customStatus = String(value || '').trim();
        window.tmQuickAddRenderMeta?.();
    };

    window.tmQuickAddOpenStatusPicker = function() {
        const qa = state.quickAdd;
        const btn = document.getElementById('tmQuickAddStatusBtn');
        if (!qa || !btn) return;
        const options = SettingsStore.data.customStatusOptions || [];
        if (!Array.isArray(options) || options.length === 0) return;
        __tmOpenInlineEditor(btn, ({ editor, close }) => {
            const maxLen = options.reduce((m, o) => Math.max(m, String(o?.name || o?.id || '').length), 0);
            const w = Math.min(220, Math.max(98, maxLen * 12 + 24));
            // 快速添加弹窗 z-index 为 100010，内联编辑器需要更高层级避免被遮挡
            editor.style.zIndex = '100020';
            editor.style.minWidth = '0';
            editor.style.width = `${w}px`;
            editor.style.padding = '8px';
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.style.gap = '4px';
            options.forEach((opt) => {
                const id = String(opt?.id || '').trim();
                if (!id) return;
                const b = document.createElement('button');
                b.className = 'tm-status-option-btn';
                b.style.fontSize = '12px';
                b.style.textAlign = 'left';
                const chip = document.createElement('span');
                chip.className = 'tm-status-tag';
                chip.style.cssText = __tmBuildStatusChipStyle(opt?.color);
                chip.textContent = String(opt?.name || id);
                b.appendChild(chip);
                b.onclick = () => {
                    window.tmQuickAddStatusChanged(id);
                    close();
                };
                wrap.appendChild(b);
            });
            editor.appendChild(wrap);
        });
    };

    window.tmQuickAddRefreshStatusSelect = function() {
        const options = SettingsStore.data.customStatusOptions || [];
        if (!Array.isArray(options) || options.length === 0) {
            return;
        }
        const qa = state.quickAdd;
        let current = String(qa?.customStatus || '').trim();
        if (!options.some(o => String(o?.id || '').trim() === current)) {
            current = __tmGetDefaultUndoneStatusId(options);
            if (qa) qa.customStatus = current;
        }
    };

    window.tmQuickAddDateChanged = function(val) {
        const qa = state.quickAdd;
        if (!qa) return;
        const normalized = String(val || '').trim();
        qa.completionTime = normalized ? __tmNormalizeDateOnly(normalized) : '';
        window.tmQuickAddRenderMeta?.();
    };
    // 确保该函数在全局可见
    window.tmQuickAddDateChanged = window.tmQuickAddDateChanged;

    window.tmQuickAddOpenDatePicker = async function() {
        const qa = state.quickAdd;
        if (!qa) return;
        const input = document.getElementById('tmQuickAddDateInput');
        if (__tmIsMobileDevice()) {
            const next = await showDatePrompt('设置截止日期', __tmNormalizeDateOnly(String(qa.completionTime || '')));
            if (next === null) return;
            qa.completionTime = String(next || '').trim();
            window.tmQuickAddRenderMeta?.();
            return;
        }
        if (!(input instanceof HTMLInputElement)) return;
        try {
            if (typeof input.showPicker === 'function') input.showPicker();
            else input.click();
        } catch (e) {
            try { input.click(); } catch (e2) {}
        }
    };

    window.tmQuickAddOpenPriorityPicker = function(ev) {
        const qa = state.quickAdd;
        const btn = ev?.currentTarget instanceof HTMLElement
            ? ev.currentTarget
            : document.getElementById('tmQuickAddPriorityBtn');
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}
        if (!qa || !(btn instanceof HTMLElement)) return;
        __tmOpenPriorityInlinePicker(btn, {
            currentValue: qa.priority,
            zIndex: 100020,
            onPick: async (value) => {
                qa.priority = value || 'none';
                window.tmQuickAddRenderMeta?.();
            },
        });
    };

    window.tmQuickAddPickCompletion = async function() {
        const qa = state.quickAdd;
        if (!qa) return;
        const v = await showPrompt('截止日期', '输入日期，如 2026-02-07（留空清除）', String(qa.completionTime || ''));
        if (v === null) return;
        qa.completionTime = String(v || '').trim();
        window.tmQuickAddRenderMeta?.();
    };

    window.tmQuickAddOpenDocPicker = async function() {
        const qa = state.quickAdd;
        if (!qa) return;
        if (state.quickAddDocPicker) {
            try { state.quickAddDocPicker.remove(); } catch (e) {}
            state.quickAddDocPicker = null;
        }
        const groups = SettingsStore.data.docGroups || [];
        // 移除未分组逻辑

        const resolveDocName = (docId) => {
            if (!docId) return '未知文档';
            const found = state.allDocuments.find(d => d.id === docId);
            if (found) return found.name || '未命名文档';
            const entry = state.taskTree.find(d => d.id === docId);
            return entry?.name || '未命名文档';
        };
        const configuredNewTaskDoc = String(SettingsStore.data.newTaskDocId || '').trim();
        const defaultDocIsDailyNote = configuredNewTaskDoc === '__dailyNote__';
        const defaultDocId = defaultDocIsDailyNote
            ? ''
            : (__tmResolveConfiguredQuickAddDocId() || __tmResolveDefaultDocId());
        const defaultDocName = defaultDocIsDailyNote
            ? '今天日记'
            : (defaultDocId ? resolveDocName(defaultDocId) : '未设置');
        const defaultDocReady = defaultDocIsDailyNote || !!defaultDocId;
        const recentDocs = __tmGetQuickAddRecentDocs();
        const recentSectionHtml = recentDocs.length > 0 ? `
                <div style="border:1px solid var(--tm-border-color);border-radius:8px;margin-bottom:8px;overflow:hidden;">
                    <div style="padding:8px 10px;background:var(--tm-header-bg);font-weight:600;">最近选择</div>
                    <div style="padding:6px 10px;">
                        ${recentDocs.map((doc) => {
                            const id = String(doc?.id || '').trim();
                            const checked = qa.docMode !== 'dailyNote' && qa.docId === id;
                            const name = esc(String(doc?.name || resolveDocName(id) || '未命名文档'));
                            const path = String(doc?.path || '').trim();
                            return `
                                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;cursor:pointer;" onclick="tmQuickAddSelectDoc('${escSq(id)}')">
                                    <div style="min-width:0;flex:1;">
                                        <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${name}</div>
                                        ${path ? `<div style="margin-top:2px;font-size:12px;color:var(--tm-secondary-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(path)}</div>` : ''}
                                    </div>
                                    <div style="margin-left:10px;">${checked ? '✅' : '◻️'}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
        ` : '';

        const picker = document.createElement('div');
        picker.className = 'tm-quick-add-modal';
        picker.style.zIndex = '100011';
        picker.innerHTML = `
            <div class="tm-prompt-box" style="width:min(92vw,520px);max-height:70vh;overflow:auto;">
                <div class="tm-prompt-title" style="margin:0 0 10px 0;">选择文档</div>
                <div style="border:1px solid var(--tm-border-color);border-radius:8px;margin-bottom:8px;overflow:hidden;">
                    <div style="padding:8px 10px;background:var(--tm-header-bg);font-weight:600;">快捷</div>
                    <div style="padding:6px 10px;">
                        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;cursor:pointer;" onclick="tmQuickAddUseTodayDiary();tmQuickAddCloseDocPicker();">
                            <div style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">今天日记</div>
                            <div style="margin-left:10px;">${qa.docMode === 'dailyNote' ? '✅' : '◻️'}</div>
                        </div>
                        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;cursor:${defaultDocReady ? 'pointer' : 'not-allowed'};opacity:${defaultDocReady ? 1 : 0.6};" onclick="${defaultDocReady ? `tmQuickAddUseDefaultDoc();tmQuickAddCloseDocPicker();` : ''}">
                            <div style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">默认任务文档：${esc(defaultDocName)}</div>
                            <div style="margin-left:10px;">${defaultDocIsDailyNote ? (qa.docMode === 'dailyNote' ? '✅' : '◻️') : (qa.docMode !== 'dailyNote' && qa.docId === defaultDocId ? '✅' : '◻️')}</div>
                        </div>
                    </div>
                </div>
                ${recentSectionHtml}
                <div id="tmQuickAddDocList"></div>
                <div style="display:flex;gap:8px;margin-top:10px;">
                    <button class="tm-btn tm-btn-gray" id="tmQuickAddDocPickerCloseBtn" onclick="tmQuickAddCloseDocPicker()" style="padding: 6px 10px; font-size: 12px;">关闭</button>
                </div>
            </div>
        `;
        document.body.appendChild(picker);
        state.quickAddDocPicker = picker;
        __tmApplyPopupOpenAnimation(picker, picker.querySelector('.tm-prompt-box'), {
            mode: window.matchMedia?.('(max-width: 640px)')?.matches ? 'sheet' : 'center'
        });

        state.__quickAddDocPickerUnstack = __tmModalStackBind(() => window.tmQuickAddCloseDocPicker?.());

        picker.onclick = (e) => {
            if (e.target === picker) window.tmQuickAddCloseDocPicker?.();
        };

        const listEl = picker.querySelector('#tmQuickAddDocList');
        const renderGroup = (label, docs, groupKey, initialOpen = false) => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'border:1px solid var(--tm-border-color);border-radius:8px;margin-bottom:8px;overflow:hidden;';
            const head = document.createElement('div');
            head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--tm-header-bg);cursor:pointer;';
            head.innerHTML = `<div style="font-weight:600;">${esc(label)}</div><div style="opacity:0.75;">${initialOpen ? '▾' : '▸'}</div>`;
            const body = document.createElement('div');
            body.style.cssText = `padding:6px 10px;display:${initialOpen ? 'block' : 'none'};`;

            // 渲染文档列表的辅助函数
            const renderDocs = (docList) => {
                body.innerHTML = '';
                if (docList.length === 0) {
                    body.innerHTML = '<div style="color:var(--tm-secondary-text);padding:8px 0;font-size:13px;">暂无文档</div>';
                    return;
                }
                docList.forEach(d => {
                    const id = String(d?.id || d || '').trim();
                    if (!id) return;
                    const row = document.createElement('div');
                    const checked = id === qa.docId;
                    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 0;cursor:pointer;';
                    row.innerHTML = `<div style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(resolveDocName(id))}</div><div style="margin-left:10px;">${checked ? '✅' : '◻️'}</div>`;
                    row.onclick = () => window.tmQuickAddSelectDoc?.(id);
                    body.appendChild(row);
                });
            };

            // 初始状态下不渲染文档列表，或者渲染配置的文档（视需求而定）
            // 用户要求：点击后展示全部以查询到有任务的文档名，而不只是设置中的文档
            // 所以初始状态可以是空的或者只显示配置文档，展开时再动态加载
            if (initialOpen) {
                renderDocs(docs); // 初始展开时先显示配置的
            }

            // 点击分组标题展开/折叠
            head.onclick = async () => {
                const open = body.style.display !== 'none';
                if (!open) {
                    // 展开时
                    body.style.display = 'block';
                    head.lastElementChild.textContent = '▾';

                    // 动态查询该分组下所有包含任务的文档
                    if (groupKey) {
                        // 显示加载中状态
                        body.innerHTML = '<div style="color:var(--tm-secondary-text);padding:8px 0;font-size:13px;">🔄 加载文档中...</div>';
                        try {
                            // 使用 SQL 查询：假设 docGroups 配置的是根文档或目录
                            // 但 docGroups 配置的是文档列表。
                            // 如果用户意图是：通过 SQL 查询该分组下（假设分组 ID 是目录 ID？）的文档
                            // 但 docGroups 的 ID 是随机生成的 UUID，不对应真实目录。
                            // 唯一关联真实目录的是 g.docs 里的文档 ID。

                            // 另一种理解：用户希望在点击分组时，列出当前 state.taskTree 中加载的所有属于该分组的文档
                            // 即使它们不在 SettingsStore 的 g.docs 配置里（可能是递归加载进来的）

                            // 1. 获取该分组配置的所有根文档 ID
                            const rootDocIds = new Set(docs.map(d => String(d?.id || d || '')));

                            // 2. 遍历 state.taskTree，找到所有属于这些根文档（或其子文档）的文档
                            // state.taskTree 是扁平的文档列表（包含递归加载的子文档）
                            // 我们需要一种方法判断 taskTree 中的文档是否属于当前分组
                            // 这里的逻辑假设：如果 taskTree 中的文档是 g.docs 中某个文档的子孙，则属于该分组。
                            // 但 taskTree 结构中没有直接保留层级关系，只有 doc.id
                            // 幸好 resolveDocIdsFromGroups 会解析递归，加载到 taskTree

                            // 所以，我们可以认为 state.taskTree 中目前加载的所有文档，
                            // 如果它是 g.docs 中某个文档的后代（或者就是它自己），那么它就属于该分组。
                            // 但我们如何判断“后代”关系？API.getSubDocIds 是异步的。
                            // state.allDocuments 包含了所有文档路径信息（如果有 path 字段）
                            // 但 state.allDocuments 只包含 ID 和 Name。

                            // 简便方案：既然 resolveDocIdsFromGroups 已经处理了递归逻辑并将结果存入 state.taskTree
                            // 我们可以尝试重新运行一次 resolveDocIdsFromGroups 的逻辑（针对特定分组），
                            // 获取该分组应该包含的所有文档 ID（包括递归的）。

                            // 获取该分组的所有目标文档（含递归标记）
                            const targetDocs = docs;
                            const alwaysVisibleDocIds = new Set(
                                (Array.isArray(targetDocs) ? targetDocs : [])
                                    .filter((doc) => {
                                        const kind = String(doc?.kind || 'doc').trim() || 'doc';
                                        return kind === 'doc' && !doc?.recursive;
                                    })
                                    .map((doc) => String(doc?.id || '').trim())
                                    .filter(Boolean)
                            );
                            const finalIds = new Set();

                            const promises = targetDocs.map((doc) => __tmExpandSourceEntryDocIds(doc, (sid) => {
                                const id = String(sid || '').trim();
                                if (id) finalIds.add(id);
                            }));
                            await Promise.all(promises);

                            // 动态查询文档的任务状态（即使不在 taskTree 中）
                            const allIds = Array.from(finalIds);
                            // 1. 先从 taskTree 中检查
                            const tasksMap = new Map();
                            const taskTreeDocMap = new Map((Array.isArray(state.taskTree) ? state.taskTree : []).map((doc) => [String(doc?.id || '').trim(), doc]));
                            allIds.forEach(id => {
                                const treeDoc = taskTreeDocMap.get(String(id || '').trim());
                                if (treeDoc && treeDoc.tasks && treeDoc.tasks.length > 0) {
                                    tasksMap.set(id, true);
                                }
                            });

                            await __tmFillDocHasTasksMap(allIds, tasksMap);

                            // 手动添加的单个文档始终显示；笔记本/递归子文档仍按“有任务”显示
                            const docList = allIds.map(id => {
                                const docId = String(id || '').trim();
                                return {
                                    id: docId,
                                    hasTasks: tasksMap.has(docId),
                                    alwaysVisible: alwaysVisibleDocIds.has(docId),
                                };
                            }).filter(item => item.alwaysVisible || item.hasTasks);

                            // 排序：按名称
                            docList.sort((a, b) => {
                                return resolveDocName(a.id).localeCompare(resolveDocName(b.id));
                            });

                            // 渲染
                            renderDocs(docList);

                        } catch (e) {
                            console.error('[QuickAdd] 加载分组文档失败', e);
                            renderDocs(docs); // 回退
                        }
                    } else {
                        renderDocs(docs);
                    }
                } else {
                    body.style.display = 'none';
                    head.lastElementChild.textContent = '▸';
                }
            };

            wrap.appendChild(head);
            wrap.appendChild(body);
            return wrap;
        };

        groups.forEach(g => {
            const docs = __tmGetGroupSourceEntries(g);
            if (docs.length === 0) return;
            // 传递 group.id 以便进行动态查询
            listEl.appendChild(renderGroup(__tmResolveDocGroupName(g), docs, String(g?.id || '')));
        });
    };

    window.tmQuickAddCloseDocPicker = function() {
        state.__quickAddDocPickerUnstack?.();
        state.__quickAddDocPickerUnstack = null;
        if (state.quickAddDocPicker) {
            try { state.quickAddDocPicker.remove(); } catch (e) {}
            state.quickAddDocPicker = null;
        }
    };

    window.tmQuickAddSelectDoc = async function(docId) {
        const qa = state.quickAdd;
        if (!qa) return;
        const id = String(docId || '').trim();
        if (!id) return;
        // 仅更新本地状态，不修改全局设置
        qa.docId = id;
        qa.docMode = 'doc';
        __tmRememberQuickAddRecentDoc(id);
        // 移除对 updateNewTaskDocId 的调用，避免修改全局新建文档设置
        window.tmQuickAddRenderMeta?.();
        window.tmQuickAddCloseDocPicker?.();
    };

    window.tmQuickAddUseTodayDiary = function() {
        const qa = state.quickAdd;
        if (!qa) return;
        qa.docMode = 'dailyNote';
        try { window.tmQuickAddCloseDocPicker?.(); } catch (e) {}
        window.tmQuickAddRenderMeta?.();
    };

    window.tmQuickAddUseDefaultDoc = async function() {
        const qa = state.quickAdd;
        if (!qa) return;
        const configured = String(SettingsStore.data.newTaskDocId || '').trim();
        if (configured === '__dailyNote__') {
            qa.docMode = 'dailyNote';
            window.tmQuickAddRenderMeta?.();
            return;
        }
        const id = __tmResolveConfiguredQuickAddDocId() || await __tmResolveDefaultDocIdAsync();
        if (!id) {
            hint('⚠ 未设置默认任务文档', 'warning');
            return;
        }
        qa.docId = id;
        qa.docMode = 'doc';
        __tmRememberQuickAddRecentDoc(id);
        window.tmQuickAddRenderMeta?.();
    };

    window.tmQuickAddSubmit = async function() {
        const qa = state.quickAdd;
        if (!qa) return;
        if (state.quickAddSubmitting) return;
        const input = document.getElementById('tmQuickAddInput');
        const dateInput = document.getElementById('tmQuickAddDateInput');
        const content = String(input?.value || '').trim();
        if (!content) return;
        const completionTime = (() => {
            const raw = dateInput instanceof HTMLInputElement
                ? String(dateInput.value || '').trim()
                : String(qa.completionTime || '').trim();
            return raw ? __tmNormalizeDateOnly(raw) : '';
        })();
        qa.completionTime = completionTime;
        state.quickAddSubmitting = true;
        const payload = {
            docId: qa.docId,
            docMode: qa.docMode,
            priority: qa.priority,
            customStatus: qa.customStatus,
            completionTime,
            openReminderAfterCreate: !!qa.openReminderAfterCreate,
            content,
        };
        window.tmQuickAddClose?.();
        state.quickAddSubmitting = false;
        (async () => {
            try {
                let targetDocId = payload.docId;
                if (payload.docMode === 'dailyNote') {
                    let notebook = __tmResolveConfiguredDailyNoteNotebookId();
                    if (!notebook) {
                        try { await __tmRefreshNotebookCache(); } catch (e) {}
                        notebook = __tmResolveConfiguredDailyNoteNotebookId();
                    }
                    if (!notebook) notebook = await API.getDocNotebook(payload.docId);
                    if (!notebook) throw new Error('无法确定日记所属笔记本');
                    targetDocId = await API.createDailyNote(notebook);
                    if (!String(targetDocId || '').trim()) throw new Error('获取日记文档失败');
                }
                const createdTaskId = await __tmQueueCreateTaskInDoc({
                    docId: targetDocId,
                    content: payload.content,
                    priority: payload.priority,
                    customStatus: payload.customStatus,
                    completionTime: payload.completionTime,
                    appendToBottom: payload.docMode === 'dailyNote' && SettingsStore.data.newTaskDailyNoteAppendToBottom === true,
                });
                hint('✅ 任务已创建', 'success');
                if (payload.openReminderAfterCreate && createdTaskId) {
                    setTimeout(() => {
                        try { window.tmReminder?.(createdTaskId); } catch (e) {}
                    }, 80);
                }
            } catch (e) {
                hint(`❌ 创建失败: ${e.message}`, 'error');
            }
        })();
    };

    window.tmAdd = async function() {
        window.tmQuickAddOpen?.();
    };

    // 重新计算统计信息
    function recalcStats() {
        let total = 0, done = 0;
        if (__tmIsOtherBlockTabId(state.activeDocId)) {
            const otherBlocks = Array.isArray(state.otherBlocks) ? state.otherBlocks : [];
            total = otherBlocks.length;
            done = otherBlocks.filter((task) => !!task?.done).length;
            state.stats.totalTasks = total;
            state.stats.doneTasks = done;
            state.stats.todoTasks = Math.max(0, total - done);
            try { __tmScheduleHomepageRefresh('stats-recalc-other'); } catch (e) {}
            return;
        }
        const traverse = (tasks) => {
            tasks.forEach(task => {
                total++;
                if (task.done) done++;
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

    // 解析文档分组中的所有文档ID
    async function resolveDocIdsFromGroups(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const groups = SettingsStore.data.docGroups || [];
        const currentGroupIdRaw = (opts.groupId ?? SettingsStore.data.currentGroupId ?? 'all');
        const currentGroupId = String(currentGroupIdRaw).trim() || 'all';
        const includeQuickAddDoc = opts.includeQuickAddDoc !== false;
        const forceRefreshScope = !!opts.forceRefreshScope;
        const quickAddDocId = includeQuickAddDoc ? String(SettingsStore.data.newTaskDocId || '').trim() : '';
        const currentGroupExcludedDocIds = __tmGetExcludedDocIdsForGroup(currentGroupId);

        let targetDocs = [];

        if (currentGroupId === 'all') {
            // “全部”模式：包含旧版 selectedDocIds 和所有分组中的文档
            // 1. 旧版 selectedDocIds (视为无递归)
            const legacyIds = SettingsStore.data.selectedDocIds || [];
            legacyIds.forEach(id => targetDocs.push({ id, kind: 'doc', recursive: false }));

            // 2. 所有分组中的文档
            groups.forEach(g => {
                targetDocs.push(...__tmGetGroupSourceEntries(g));
            });
        } else {
            // 特定分组模式
            const group = groups.find(g => g.id === currentGroupId);
            if (group) {
                targetDocs = __tmGetGroupSourceEntries(group);
            }
        }

        // 归一化文档项并按当前分组钉住顺序前置
        const normalizedDocs = (targetDocs || [])
            .map((doc) => {
                const id = String((typeof doc === 'object' ? doc?.id : doc) || '').trim();
                if (!id) return null;
                return {
                    id,
                    kind: String((typeof doc === 'object' ? doc?.kind : '') || 'doc').trim() || 'doc',
                    recursive: !!(typeof doc === 'object' ? doc?.recursive : false),
                    excludedDocIds: __tmNormalizeDocGroupExcludedDocIds(typeof doc === 'object' ? doc?.excludedDocIds : [])
                };
            })
            .filter(Boolean);
        if (forceRefreshScope) {
            try { __tmDocExpandCache.clear(); } catch (e) {}
            try { __tmResolvedDocIdsCache = null; } catch (e) {}
            try { __tmResolvedDocIdsPromise = null; } catch (e) {}
        }
        const resolveCacheKey = [
            currentGroupId,
            quickAddDocId,
            currentGroupExcludedDocIds.join(','),
            ...normalizedDocs.map((doc) => `${doc.kind}:${doc.id}:${doc.recursive ? 1 : 0}:${__tmNormalizeDocGroupExcludedDocIds(doc?.excludedDocIds).join(',')}`)
        ].join('|');
        const resolveCacheEnt = __tmResolvedDocIdsCache;
        const resolveCacheTtlMs = 30000;
        if (resolveCacheEnt
            && resolveCacheEnt.key === resolveCacheKey
            && Array.isArray(resolveCacheEnt.ids)
            && (Date.now() - Number(resolveCacheEnt.t || 0)) < resolveCacheTtlMs) {
            return resolveCacheEnt.ids.slice();
        }
        if (__tmResolvedDocIdsPromise && __tmResolvedDocIdsPromise.key === resolveCacheKey && __tmResolvedDocIdsPromise.promise) {
            const ids = await __tmResolvedDocIdsPromise.promise;
            return Array.isArray(ids) ? ids.slice() : [];
        }
        const docsInOrder = __tmSortDocEntriesByPinned(normalizedDocs, currentGroupId);

        // 解析递归文档（保持顺序去重）
        const finalIds = [];
        const seen = new Set();
        const pushId = (id0) => {
            const id = String(id0 || '').trim();
            if (!id || seen.has(id)) return;
            seen.add(id);
            finalIds.push(id);
        };
        const excludeCurrentGroupDocs = (ids) => {
            const list = Array.isArray(ids) ? ids : [];
            if (!currentGroupExcludedDocIds.length) return list.slice();
            const excludedSet = new Set(currentGroupExcludedDocIds);
            return list.filter((id0) => !excludedSet.has(String(id0 || '').trim()));
        };
        const quickAddExcluded = __tmIsDocExcludedInGroup(quickAddDocId, currentGroupId);
        if (quickAddDocId && quickAddDocId !== '__dailyNote__' && !quickAddExcluded) pushId(quickAddDocId);

        const resolvePromise = Promise.resolve().then(async () => {
            const promises = docsInOrder.map((doc) => __tmExpandSourceEntryDocIds(doc, pushId));
            await Promise.all(promises);
            if (currentGroupId !== 'all') {
                const currentGroup = groups.find((g) => String(g?.id || '').trim() === String(currentGroupId || '').trim());
                if (currentGroup) {
                    const out0 = await __tmApplyCalendarSearchOptimizationToDocIds(finalIds, currentGroup);
                    const out1 = excludeCurrentGroupDocs(Array.isArray(out0) ? out0.slice() : []);
                    __tmResolvedDocIdsCache = { key: resolveCacheKey, ids: out1, t: Date.now() };
                    return out1;
                }
            }
            const out = excludeCurrentGroupDocs(finalIds);
            __tmResolvedDocIdsCache = { key: resolveCacheKey, ids: out, t: Date.now() };
            return out;
        });
        __tmResolvedDocIdsPromise = { key: resolveCacheKey, promise: resolvePromise };
        try {
            const ids = await resolvePromise;
            return Array.isArray(ids) ? ids.slice() : [];
        } finally {
            if (__tmResolvedDocIdsPromise && __tmResolvedDocIdsPromise.key === resolveCacheKey) {
                __tmResolvedDocIdsPromise = null;
            }
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
        const forceFreshTasks = !!(options && options.forceFreshTasks === true);
        const forceSyncFlowRank = !!(options && options.forceSyncFlowRank === true);
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
        try {
            __tmPushRefreshDebug('load-selected:start', {
                source: sourceLabel,
                token,
                skipRender,
                showInlineLoading,
                preferFastFirstPaint,
                forceFreshTasks,
                viewMode: getCurrentViewMode(''),
            });
        } catch (e) {}
        try {
            if (sourceLabel === 'openManager' || sourceLabel === 'openManager-soft-reuse') {
                __tmStartStartupLagProbe(sourceLabel, {
                    durationMs: 12000,
                    longFrameMs: 42,
                });
            }
        } catch (e) {}
        let perfFinished = false;
        const finishPerfTrace = (detail = {}) => {
            if (perfFinished) return;
            perfFinished = true;
            __tmPerfTraceFinish(perfTrace, detail);
        };
        if (showInlineLoading) {
            try {
                __tmSetInlineLoading(true, {
                    token,
                    styleKind: options?.loadingStyleKind,
                    delayMs: Number(options?.loadingDelayMs),
                });
            } catch (e) {}
        }
        try { state.doneOverrides = {}; } catch (e) {}
        // 加载设置（包括文档ID列表）
        await __tmEnsureSettingsLoaded();
        __tmPerfTraceMark(perfTrace, 'settings', {
            preferFastFirstPaint: preferFastFirstPaint ? 1 : 0,
            source: String(options?.source || 'direct').trim() || 'direct',
        });
        try { await __tmRefreshNotebookCache(); } catch (e) {}
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
        const shouldLoadOtherBlocksInline = !allowDeferredBootWork || __tmIsOtherBlockTabId(state.activeDocId);
        const shouldLoadMetaInline = !allowDeferredBootWork;
        const shouldLoadMetaLater = allowDeferredBootWork && !MetaStore.loaded;
        const shouldLoadWhiteboardLater = allowDeferredBootWork && !shouldLoadWhiteboardInline && !WhiteboardStore.loaded;
        let otherBlocksLoadedSynchronously = false;
        const loadOtherBlocksNow = async () => {
            try { await __tmMigrateLegacyOtherBlockRefsToGroups({ groupId: currentGroupId, persist: true }); } catch (e) {}
            try { await __tmLoadCollectedOtherBlocks(); } catch (e) { state.otherBlocks = []; }
            if (__tmIsOtherBlockTabId(state.activeDocId) && !(Array.isArray(state.otherBlocks) && state.otherBlocks.length)) {
                state.activeDocId = 'all';
            }
        };
        if (shouldLoadMetaInline) {
            await MetaStore.load();
        }
        if (shouldLoadWhiteboardInline) {
            await WhiteboardStore.load();
        }
        if (shouldLoadOtherBlocksInline) {
            await loadOtherBlocksNow();
            otherBlocksLoadedSynchronously = true;
        } else {
            state.otherBlocks = [];
        }
        const quickAddDocId = String(SettingsStore.data.newTaskDocId || '').trim();

        // 将设置同步到 state
        state.selectedDocIds = SettingsStore.data.selectedDocIds;
        state.queryLimit = SettingsStore.data.queryLimit;
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
        state.currentRule = SettingsStore.data.currentRule;
        state.columnWidths = SettingsStore.data.columnWidths;
        state.excludeCompletedTasks = !!SettingsStore.data.excludeCompletedTasks;

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
        const allDocIds = await resolveDocIdsFromGroups({
            forceRefreshScope: !!state.isRefreshing,
        });
        state.__tmLoadedDocIdsForTasks = Array.isArray(allDocIds) ? allDocIds.slice() : [];
        __tmPerfTraceMark(perfTrace, 'docs', {
            docCount: Array.isArray(allDocIds) ? allDocIds.length : 0,
            groupId: currentGroupId,
        });
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
                finishPerfTrace({
                    docCount: 0,
                    filteredCount: Array.isArray(state.filteredTasks) ? state.filteredTasks.length : 0,
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
                if (SettingsStore.data.kanbanHeadingGroupMode || SettingsStore.data.docH2SubgroupEnabled !== false) {
                    try {
                        Promise.resolve().then(async () => {
                            if (SettingsStore.data.kanbanHeadingGroupMode) {
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
                    __tmScheduleRender({ withFilters: needFilters });
                }
            }, 120);
        };

        // 如果没有文档，打开设置
        if (allDocIds.length === 0) {
            state.taskTree = [];
            state.flatTasks = __tmMergeOtherBlocksIntoFlatTasks({});
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
            finishPerfTrace({
                docCount: 0,
                filteredCount: Array.isArray(state.filteredTasks) ? state.filteredTasks.length : 0,
                reason: 'empty-docs',
            });
            return;
        }

        try {
            const startTime = Date.now();
            const loadBudget = preferFastFirstPaint
                ? __tmGetInitialLoadBudget({
                    forceFullLoadBudget: !!(options && options.forceFullLoadBudget),
                    queryLimit: state.queryLimit,
                    viewMode: state.viewMode,
                })
                : {
                    enabled: false,
                    queryLimit: state.queryLimit,
                    renderLimit: Number(state.listRenderLimit) || 100,
                    listStep: 100,
                };
            const effectiveQueryLimit = state.queryLimit;
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
                finishPerfTrace({ cancelled: 1, reason: 'stale-token-after-query' });
                return;
            }
            let pendingMergeMs = 0;
            let pendingValidateCount = 0;
            let pendingMergedIntoLiveCount = 0;
            let pendingInsertedCount = 0;
            let pendingDroppedCount = 0;
            try {
                const pendingMergeStartTime = __tmPerfNow();
                const pendingMap = (state.pendingInsertedTasks && typeof state.pendingInsertedTasks === 'object')
                    ? state.pendingInsertedTasks
                    : {};
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
                    if (!id || !pending) {
                        delete pendingMap[taskId];
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
                        delete pendingMap[taskId];
                        continue;
                    }
                    if (pendingIdsToValidateSet.has(id) && !existingPendingIdSet.has(id)) {
                        delete pendingMap[taskId];
                        pendingDroppedCount += 1;
                        continue;
                    }
                    const expiresAt = Number(pending.expiresAt) || 0;
                    const docId = String(pending.root_id || pending.docId || '').trim();
                    if ((expiresAt && expiresAt < nowTs) || !docId || !allDocIdSet.has(docId)) {
                        delete pendingMap[taskId];
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
                const kanbanHeadingGroupingActive = !!SettingsStore.data.kanbanHeadingGroupMode;
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
                const preferAsyncEnhance = !!(loadBudget.enabled || preferFastFirstPaint);
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
                res.tasks.forEach(task => {
                    // 确保任务有root_id
                    if (!task.root_id) return;
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

                    const taskId = String(task.id || '').trim();
                    const queuedTaskFieldPatch = taskId ? queuedTaskFieldPatchMap.get(taskId) : null;
                    if (queuedTaskFieldPatch && typeof queuedTaskFieldPatch === 'object') {
                        __tmApplyQueuedTaskFieldPatchToTask(task, queuedTaskFieldPatch);
                    }

                    perfMark = __tmPerfNow();
                    __tmMergeVisibleDateFieldsFromPrevTask(task, prevTask);
                    normalizeMetrics.mergeVisibleMs += (__tmPerfNow() - perfMark);

                    // 标准化字段
                    const docName = task.docName || '未命名文档';
                    perfMark = __tmPerfNow();
                    normalizeTaskFields(task, docName, normalizeTaskOptions);
                    normalizeMetrics.fieldsMs += (__tmPerfNow() - perfMark);
                    const taskValueDebugIds = Array.from(new Set([
                        taskId,
                        String(task?.attrHostId || task?.attr_host_id || '').trim(),
                        String(task?.parent_id || '').trim(),
                    ].filter(Boolean)));
                    if (__tmShouldLogValueDebug(taskValueDebugIds, false)) {
                        __tmPushValueDebug('load:normalized-task', {
                            taskId,
                            parsedDone: correctDone,
                            parsedMarker,
                            queuedPatchKeys: queuedTaskFieldPatch ? Object.keys(queuedTaskFieldPatch) : [],
                            prevTask: __tmSnapshotTaskValueDebugFields(prevTask),
                            after: __tmSnapshotTaskValueDebugFields(task),
                        }, taskValueDebugIds);
                    }

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
                            try { delete state.pendingInsertedTasks[String(task.id || '').trim()]; } catch (e) {}
                            return;
                        }
                        if (duplicateLive && !isPendingInserted) {
                            const pendingDupId = String(duplicateLive.id || '').trim();
                            if (pendingDupId && nextFlatTasks[pendingDupId]) delete nextFlatTasks[pendingDupId];
                            if (pendingDupId && state.pendingInsertedTasks?.[pendingDupId]) {
                                try { delete state.pendingInsertedTasks[pendingDupId]; } catch (e) {}
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
                    if (__tmShouldLogValueDebug(taskValueDebugIds, false)) {
                        __tmPushValueDebug('load:flat-commit', {
                            taskId,
                            docId: String(task.root_id || '').trim(),
                            task: __tmSnapshotTaskValueDebugFields(task),
                        }, taskValueDebugIds);
                    }
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
                });
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
                const parentLinkResults = await Promise.all(allDocIds.map(async (docId) => {
                    const rawTasks = tasksByDoc.get(docId) || [];
                    try {
                        const resolvedParentLinks = await __tmResolveDocTaskParentLinks(rawTasks, {
                            docId,
                            source: 'load-selected-documents',
                        });
                        return {
                            docId,
                            rootTasks: Array.isArray(resolvedParentLinks?.rootTasks) ? resolvedParentLinks.rootTasks : [],
                            stats: (resolvedParentLinks?.stats && typeof resolvedParentLinks.stats === 'object')
                                ? resolvedParentLinks.stats
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
                try { __tmPushRefreshDebug('parent-link:resolved', parentLinkStats); } catch (e) {}
                let siblingOrderRanks = new Map();
                const siblingRankStartTime = Date.now();
                try {
                    siblingOrderRanks = await __tmResolveTaskSiblingOrderRanks(tasksByDoc);
                } catch (e) {
                    siblingOrderRanks = new Map();
                }
                __tmPerfTraceMark(perfTrace, 'sibling-rank', {
                    durationMs: __tmRoundPerfMs(Date.now() - siblingRankStartTime),
                    rankCount: siblingOrderRanks instanceof Map ? siblingOrderRanks.size : 0,
                    disabledByPerfFlag: perfTuning.disableSiblingRank ? 1 : 0,
                });

                // 按文档顺序构建树
                const projectionStartTime = Date.now();
                for (const docId of allDocIds) {
                    // 获取该文档的所有任务
                    const rawTasks = tasksByDoc.get(docId) || [];
                    const cachedDoc = state.allDocuments.find(d => d.id === docId);

                    // 获取文档名称
                    let docName = '未命名文档';
                    if (rawTasks.length > 0) {
                        docName = rawTasks[0].docName;
                    } else {
                        if (cachedDoc) docName = cachedDoc.name;
                    }
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

                    // 添加到任务树
                    if (rawTasks.length > 0 || state.selectedDocIds.includes(docId) || (quickAddDocId && docId === quickAddDocId)) {
                         nextTaskTree.push({
                            id: docId,
                            name: docName,
                            alias: __tmNormalizeDocAliasValue(cachedDoc?.alias),
                            icon: __tmNormalizeDocIconValue(cachedDoc?.icon),
                            created: String(cachedDoc?.created || '').trim(),
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
                    finishPerfTrace({ cancelled: 1, reason: 'stale-token-before-commit' });
                    return;
                }
                state.taskTree = __tmSortDocEntriesByPinned(
                    nextTaskTree || [],
                    String(SettingsStore.data.currentGroupId || 'all').trim() || 'all'
                );
                state.flatTasks = nextFlatTasks;
                try { __tmUpsertWhiteboardTaskSnapshots(Object.values(state.flatTasks || {}), { persist: WhiteboardStore.loaded === true }); } catch (e) {}
                state.flatTasks = __tmMergeOtherBlocksIntoFlatTasks(state.flatTasks);
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

                applyFilters();
                if (loadBudget.enabled) {
                    state.listRenderLimit = Math.min(
                        Array.isArray(state.filteredTasks) ? state.filteredTasks.length : 0,
                        initialRenderLimit
                    );
                }
                state.deferredListCustomFieldIds = getCurrentViewMode('') === 'list'
                    ? bulkCustomFieldPlan.deferredListFieldIds.slice()
                    : [];
                const deferredListCustomFieldFieldCount = state.deferredListCustomFieldIds.length;
                const deferredListCustomFieldDeferred = deferredListCustomFieldFieldCount > 0
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

                const activeModal = getActiveModal();
                if (!skipRender && activeModal && isTokenCurrent()) {
                    try { if (showInlineLoading && Number(state.uiInlineLoadingToken) === token) __tmSetInlineLoading(false); } catch (e) {}
                    render();
                    __tmPerfTraceMark(perfTrace, 'first-render', {
                        filteredCount: Array.isArray(state.filteredTasks) ? state.filteredTasks.length : 0,
                        fastBudget: loadBudget.enabled ? 1 : 0,
                    });
                    __tmPerfTraceMark(perfTrace, 'render', {
                        filteredCount: Array.isArray(state.filteredTasks) ? state.filteredTasks.length : 0,
                        fastBudget: loadBudget.enabled ? 1 : 0,
                    });
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
                finishPerfTrace({
                    docCount: Array.isArray(allDocIds) ? allDocIds.length : 0,
                    taskCount: Array.isArray(res.tasks) ? res.tasks.length : 0,
                    filteredCount: Array.isArray(state.filteredTasks) ? state.filteredTasks.length : 0,
                    fastBudget: loadBudget.enabled ? 1 : 0,
                    viewMode: getCurrentViewMode('list'),
                });
            }
        } catch (e) {
            finishPerfTrace({
                error: String(e?.message || e || '').trim() || 'load-failed',
                docCount: Array.isArray(allDocIds) ? allDocIds.length : 0,
            });
            console.error('[加载] 获取任务失败:', e);
            hint('❌ 加载任务失败', 'error');
        } finally {
            if (showInlineLoading && Number(state.uiInlineLoadingToken) === token) {
                try { __tmSetInlineLoading(false); } catch (e) {}
            }
        }
    }

    let __tmAllDocumentsFetchedAt = 0;
    let __tmAllDocumentsFetchPromise = null;
    async function __tmEnsureAllDocumentsLoaded(force = false) {
        const now = Date.now();
        if (!force && Array.isArray(state.allDocuments) && state.allDocuments.length > 0 && (now - (__tmAllDocumentsFetchedAt || 0) < 60000)) {
            return state.allDocuments;
        }
        if (!force && __tmAllDocumentsFetchPromise) return await __tmAllDocumentsFetchPromise;
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
        { id: 'new-task', label: '新建任务' },
        { id: 'status', label: '状态选项' },
        { id: 'layout', label: '视图布局' },
        { id: 'search', label: '搜索分组' },
        { id: 'topbar', label: '顶栏入口' },
        { id: 'quickbar', label: '悬浮条' },
        { id: 'tomato', label: '番茄钟/联动' }
    ]);

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
        if (!root || String(state.settingsActiveTab || 'docs') !== 'main') return;
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
